import { LangError } from './errors.js';
import { parse } from './parser.js';
import { builtins } from './builtins.js';
import {
  createEnv,
  envDefine,
  envLookup,
  tuple,
  closure,
  isNumber,
  isBoolean,
  isTuple,
  SWIZZLE_COMPONENTS,
  valueType,
} from './values.js';

export function createGlobalEnv(ctx = {}) {
  const env = createEnv();
  for (const [name, value] of Object.entries(builtins)) envDefine(env, name, value);
  if (ctx.input) envDefine(env, 'input', ctx.input);
  env.preludeErrors = [];
  for (const source of ctx.prelude ?? []) {
    try {
      evalProgram(parse(source), env, makeRuntime(ctx));
    } catch (error) {
      env.preludeErrors.push(error);
    }
  }
  return env;
}

export function makeRuntime(ctx = {}) {
  return { ...ctx, apply: applyFn };
}

export function evaluate(source, ctx = {}) {
  const env = createGlobalEnv(ctx);
  const value = evalProgram(parse(source), env, makeRuntime(ctx));
  return { value, env };
}

export function evalProgram(program, env, ctx = {}) {
  let value;
  for (const statement of program) {
    value = statement.type === 'Decl' ? evalDecl(statement, env, ctx) : evalExpr(statement, env, ctx);
  }
  return value;
}

function evalDecl(decl, env, ctx) {
  if (decl.params.length > 0) {
    const fn = closure(decl.params, decl.body, env);
    envDefine(env, decl.name, fn);
    return fn;
  }
  const value = evalExpr(decl.body, env, ctx);
  envDefine(env, decl.name, value);
  return value;
}

function errAt(node, message) {
  throw new LangError(message, node?.line ?? 1, node?.col ?? 1);
}

export function evalExpr(node, env, ctx = {}) {
  switch (node.type) {
    case 'Num':
      return node.value;
    case 'Bool':
      return node.value;
    case 'Str':
      return node.value;
    case 'Color':
      return colorValue(node.value);
    case 'Var':
      return lookupVar(node, env);
    case 'Lambda':
      return closure(node.params, node.body, env);
    case 'App':
      return applyFn(evalExpr(node.fn, env, ctx), evalExpr(node.arg, env, ctx), node, ctx);
    case 'UnaryOp':
      return negate(evalExpr(node.operand, env, ctx), node);
    case 'BinOp':
      return evalBinOp(node, env, ctx);
    case 'If': {
      const cond = evalExpr(node.cond, env, ctx);
      if (!isBoolean(cond)) errAt(node, `'if' condition must be a boolean, got a ${valueType(cond)}`);
      return evalExpr(cond ? node.then : node.alt, env, ctx);
    }
    case 'Let': {
      const child = createEnv(env);
      envDefine(child, node.name, evalExpr(node.value, env, ctx));
      return evalExpr(node.body, child, ctx);
    }
    case 'Tuple':
      return tuple(node.items.map((item) => evalExpr(item, env, ctx)));
    case 'Swizzle':
      return evalSwizzle(node, env, ctx);
    default:
      errAt(node, `cannot evaluate a '${node.type}'`);
  }
}

function lookupVar(node, env) {
  const value = envLookup(env, node.name);
  if (value === undefined) errAt(node, `unknown name '${node.name}'`);
  return value;
}

export function applyFn(fn, arg, node, ctx = {}) {
  if (fn && fn.type === 'closure') {
    const child = createEnv(fn.env);
    bindPattern(child, fn.params[0], arg, node);
    if (fn.params.length === 1) return evalExpr(fn.body, child, ctx);
    return closure(fn.params.slice(1), fn.body, child);
  }
  if (fn && fn.type === 'builtin') {
    const args = [...fn.args, arg];
    if (args.length < fn.arity) return { ...fn, args };
    return fn.fn(args, ctx, node);
  }
  errAt(node, `cannot apply a ${valueType(fn)} as a function`);
}

function bindPattern(env, pattern, value, node) {
  if (typeof pattern === 'string') {
    envDefine(env, pattern, value);
    return;
  }
  if (!isTuple(value)) {
    errAt(node, `cannot destructure a ${valueType(value)} with a ${pattern.length}-tuple pattern`);
  }
  if (value.items.length !== pattern.length) {
    errAt(node, `pattern expects ${pattern.length} values, got ${value.items.length}`);
  }
  pattern.forEach((part, i) => bindPattern(env, part, value.items[i], node));
}

function evalBinOp(node, env, ctx) {
  const { op } = node;

  if (op === '|>') {
    const left = evalExpr(node.left, env, ctx);
    return applyFn(evalExpr(node.right, env, ctx), left, node, ctx);
  }

  if (op === '&&' || op === '||') {
    const left = evalExpr(node.left, env, ctx);
    if (!isBoolean(left)) errAt(node, `'${op}' expects booleans, got a ${valueType(left)}`);
    if (op === '&&' && !left) return false;
    if (op === '||' && left) return true;
    const right = evalExpr(node.right, env, ctx);
    if (!isBoolean(right)) errAt(node, `'${op}' expects booleans, got a ${valueType(right)}`);
    return right;
  }

  const left = evalExpr(node.left, env, ctx);
  const right = evalExpr(node.right, env, ctx);

  switch (op) {
    case '+':
    case '-':
    case '*':
    case '/':
      return arithmetic(op, left, right, node);
    case '==':
      return equalValues(left, right);
    case '!=':
    case '/=':
      return !equalValues(left, right);
    case '<':
    case '>':
    case '<=':
    case '>=':
      return compare(op, left, right, node);
    default:
      errAt(node, `unknown operator '${op}'`);
  }
}

function arithmetic(op, a, b, node) {
  if (isTuple(a) || isTuple(b)) return broadcast(op, a, b, node);
  if (!isNumber(a)) errAt(node, `cannot use '${op}' on a ${valueType(a)}`);
  if (!isNumber(b)) errAt(node, `cannot use '${op}' on a ${valueType(b)}`);
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    default:
      return a / b;
  }
}

function broadcast(op, a, b, node) {
  if (isTuple(a) && isTuple(b)) {
    if (a.items.length !== b.items.length) {
      errAt(node, `cannot combine tuples of length ${a.items.length} and ${b.items.length}`);
    }
    return tuple(a.items.map((item, i) => arithmetic(op, item, b.items[i], node)));
  }
  if (isTuple(a)) return tuple(a.items.map((item) => arithmetic(op, item, b, node)));
  return tuple(b.items.map((item) => arithmetic(op, a, item, node)));
}

function negate(value, node) {
  if (isNumber(value)) return -value;
  if (isTuple(value)) return tuple(value.items.map((item) => negate(item, node)));
  errAt(node, `cannot negate a ${valueType(value)}`);
}

function compare(op, a, b, node) {
  if (!isNumber(a) || !isNumber(b)) {
    errAt(node, `cannot compare a ${valueType(a)} with a ${valueType(b)}`);
  }
  switch (op) {
    case '<':
      return a < b;
    case '>':
      return a > b;
    case '<=':
      return a <= b;
    default:
      return a >= b;
  }
}

function equalValues(a, b) {
  if (isTuple(a) && isTuple(b)) {
    return a.items.length === b.items.length && a.items.every((item, i) => equalValues(item, b.items[i]));
  }
  return a === b;
}

function evalSwizzle(node, env, ctx) {
  const target = evalExpr(node.target, env, ctx);
  if (!isTuple(target)) errAt(node, `cannot swizzle a ${valueType(target)}`);
  const indices = [];
  for (const ch of node.field) {
    const index = SWIZZLE_COMPONENTS[ch];
    if (index === undefined) errAt(node, `unknown swizzle '.${ch}'`);
    if (index >= target.items.length) {
      errAt(node, `swizzle '.${node.field}' needs ${index + 1} components, got ${target.items.length}`);
    }
    indices.push(index);
  }
  if (indices.length === 1) return target.items[indices[0]];
  return tuple(indices.map((index) => target.items[index]));
}

function colorValue(hex) {
  const digits = hex.slice(1);
  const channel = (pair) => parseInt(pair, 16) / 255;
  if (digits.length === 3 || digits.length === 4) {
    return tuple([...digits].map((d) => channel(d + d)));
  }
  const parts = [];
  for (let i = 0; i < digits.length; i += 2) parts.push(channel(digits.slice(i, i + 2)));
  return tuple(parts);
}
