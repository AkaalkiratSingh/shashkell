import { LangError } from './errors.js';
import { lex } from './lexer.js';
import * as ast from './ast.js';

const INFIX = {
  '|>': 1,
  '||': 2,
  '&&': 3,
  '==': 4,
  '/=': 4,
  '!=': 4,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
};

const APPLY_BP = 8;
const SWIZZLE_BP = 9;
const UNARY_BP = 7;

function at(node, token) {
  node.line = token.line;
  node.col = token.col;
  return node;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(k = 0) {
    return this.tokens[Math.min(this.pos + k, this.tokens.length - 1)];
  }

  next() {
    return this.tokens[this.pos++];
  }

  at(type, value) {
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  eat(type, value, what) {
    const token = this.peek();
    if (token.type === type && (value === undefined || token.value === value)) {
      return this.next();
    }
    throw new LangError(`expected ${what ?? describe({ type, value })}, found ${describe(token)}`, token.line, token.col);
  }

  fail(message, token = this.peek()) {
    throw new LangError(message, token.line, token.col);
  }

  expectEnd() {
    if (!this.at('eof')) this.fail(`unexpected ${describe(this.peek())}`);
  }

  startsAtom(token) {
    if (token.type === 'number' || token.type === 'color' || token.type === 'ident') return true;
    if (token.type === 'keyword') return token.value === 'true' || token.value === 'false';
    return token.type === 'punct' && token.value === '(';
  }

  parseExpression(minBp = 0) {
    let left = this.parsePrefix();
    for (;;) {
      const token = this.peek();

      if (token.type === 'punct' && token.value === '.') {
        if (SWIZZLE_BP < minBp) break;
        left = this.parseSwizzle(left);
        continue;
      }

      if (this.startsAtom(token)) {
        if (APPLY_BP < minBp) break;
        left = at(ast.App(left, this.parseExpression(APPLY_BP + 1)), token);
        continue;
      }

      const bp = token.type === 'op' ? INFIX[token.value] : undefined;
      if (bp === undefined || bp < minBp) break;
      this.next();
      left = at(ast.BinOp(token.value, left, this.parseExpression(bp + 1)), token);
    }
    return left;
  }

  parsePrefix() {
    const token = this.peek();

    if (token.type === 'number') {
      this.next();
      return ast.Num(token.value);
    }
    if (token.type === 'color') {
      this.next();
      return ast.Color(token.value);
    }
    if (token.type === 'ident') {
      this.next();
      return at(ast.Var(token.value), token);
    }
    if (token.type === 'keyword' && (token.value === 'true' || token.value === 'false')) {
      this.next();
      return ast.Bool(token.value === 'true');
    }
    if (token.type === 'keyword' && token.value === 'if') return this.parseIf();
    if (token.type === 'keyword' && token.value === 'let') return this.parseLet();
    if (token.type === 'op' && token.value === '\\') return this.parseLambda();
    if (token.type === 'op' && token.value === '-') {
      this.next();
      return at(ast.UnaryOp('-', this.parseExpression(UNARY_BP)), token);
    }
    if (token.type === 'punct' && token.value === '(') return this.parseParen();

    this.fail(`unexpected ${describe(token)}`);
  }

  parseSwizzle(target) {
    const dot = this.next();
    const field = this.eat('ident', undefined, 'a swizzle field');
    return at(ast.Swizzle(target, field.value), dot);
  }

  parseParen() {
    this.eat('punct', '(');
    if (this.at('punct', ')')) {
      this.next();
      return ast.Tuple([]);
    }
    const first = this.parseExpression(0);
    if (!this.at('punct', ',')) {
      this.eat('punct', ')', "')'");
      return first;
    }
    const items = [first];
    while (this.at('punct', ',')) {
      this.next();
      if (this.at('punct', ')')) break;
      items.push(this.parseExpression(0));
    }
    this.eat('punct', ')', "')'");
    return ast.Tuple(items);
  }

  parseLambda() {
    this.next();
    const params = [];
    while (this.at('ident')) params.push(this.next().value);
    if (params.length === 0) this.fail('expected a parameter after \\');
    this.eat('op', '->', "'->'");
    return ast.Lambda(params, this.parseExpression(0));
  }

  parseIf() {
    this.next();
    const cond = this.parseExpression(0);
    this.eat('keyword', 'then');
    const then = this.parseExpression(0);
    this.eat('keyword', 'else');
    return ast.If(cond, then, this.parseExpression(0));
  }

  parseLet() {
    this.next();
    const name = this.eat('ident', undefined, 'a name').value;
    this.eat('op', '=');
    const value = this.parseExpression(0);
    this.eat('keyword', 'in');
    return ast.Let(name, value, this.parseExpression(0));
  }

  parsePipelineDecl() {
    if (!this.at('keyword', 'pipeline')) return null;
    this.next();
    const name = this.eat('ident', undefined, 'a pipeline name').value;
    this.eat('punct', '(');
    const params = [];
    if (!this.at('punct', ')')) {
      params.push(this.eat('ident', undefined, 'a parameter').value);
      while (this.at('punct', ',')) {
        this.next();
        params.push(this.eat('ident', undefined, 'a parameter').value);
      }
    }
    this.eat('punct', ')');
    this.eat('op', '=');
    return ast.Decl('pipeline', name, params, this.parseExpression(0));
  }

  tryDeclaration() {
    const save = this.pos;

    if (this.at('keyword', 'let')) {
      this.next();
      const name = this.eat('ident', undefined, 'a name').value;
      this.eat('op', '=');
      const value = this.parseExpression(0);
      if (this.at('keyword', 'in')) {
        this.pos = save;
        return null;
      }
      return ast.Decl('let', name, [], value);
    }

    const headToken = this.peek();
    let head;
    try {
      head = this.parseExpression(0);
    } catch {
      this.pos = save;
      return null;
    }
    if (!this.at('op', '=')) {
      this.pos = save;
      return null;
    }
    const parts = declarationHead(head);
    if (!parts) this.fail('invalid declaration target', headToken);
    this.next();
    const body = this.parseExpression(0);
    const kind = parts.params.length > 0 ? 'fun' : 'def';
    return ast.Decl(kind, parts.name, parts.params, body);
  }
}

function declarationHead(node) {
  const args = [];
  let current = node;
  while (current.type === 'App') {
    args.unshift(current.arg);
    current = current.fn;
  }
  if (current.type !== 'Var') return null;
  const params = [];
  for (const arg of args) {
    if (arg.type !== 'Var') return null;
    params.push(arg.name);
  }
  return { name: current.name, params };
}

function describe(token) {
  if (!token || token.type === 'eof') return 'end of input';
  return `${token.type} '${token.value}'`;
}

function splitStatements(tokens) {
  const statements = [];
  let current = [];
  let depth = 0;
  let lastLine = 1;
  let endToken = tokens[tokens.length - 1];

  for (const token of tokens) {
    if (token.type === 'eof') {
      endToken = token;
      break;
    }
    if (current.length > 0 && depth === 0 && token.col === 1 && token.line > lastLine) {
      statements.push(current);
      current = [];
    }
    if (token.type === 'punct' && token.value === ';') {
      if (current.length > 0) {
        statements.push(current);
        current = [];
      }
      lastLine = token.line;
      continue;
    }
    current.push(token);
    if (token.type === 'punct' && token.value === '(') depth++;
    else if (token.type === 'punct' && token.value === ')') depth = Math.max(0, depth - 1);
    lastLine = token.line;
  }

  if (current.length > 0) statements.push(current);
  return statements.map((statement) => [...statement, endToken]);
}

export function parse(source) {
  const tokens = lex(source);
  return splitStatements(tokens).map((statement) => {
    const parser = new Parser(statement);
    const node = parser.parsePipelineDecl() ?? parser.tryDeclaration() ?? parser.parseExpression(0);
    parser.expectEnd();
    return node;
  });
}
