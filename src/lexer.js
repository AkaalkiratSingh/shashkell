import { LangError } from './errors.js';

const KEYWORDS = new Set([
  'let',
  'in',
  'if',
  'then',
  'else',
  'pipeline',
  'true',
  'false',
]);

const OPERATORS = [
  '|>',
  '->',
  '==',
  '/=',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '+',
  '-',
  '*',
  '/',
  '=',
  '<',
  '>',
  '\\',
];

const PUNCTUATION = new Set(['(', ')', ',', '.', ';']);

const isDigit = (c) => c >= '0' && c <= '9';
const isHexDigit = (c) =>
  isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
const isIdentStart = (c) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isIdentPart = (c) => isIdentStart(c) || isDigit(c) || c === "'";

export function lex(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const at = (k = 0) => source[i + k];
  const done = () => i >= source.length;

  function step() {
    const ch = source[i++];
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  }

  function push(type, value, tokenLine, tokenCol) {
    tokens.push({ type, value, line: tokenLine, col: tokenCol });
  }

  function fail(message, tokenLine = line, tokenCol = col) {
    throw new LangError(message, tokenLine, tokenCol);
  }

  while (!done()) {
    const startLine = line;
    const startCol = col;
    const ch = at();

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      step();
      continue;
    }

    if (ch === '-' && at(1) === '-') {
      while (!done() && at() !== '\n') step();
      continue;
    }

    if (ch === '/' && at(1) === '*') {
      step();
      step();
      while (!done() && !(at() === '*' && at(1) === '/')) step();
      if (done()) fail('unterminated block comment', startLine, startCol);
      step();
      step();
      continue;
    }

    if (isDigit(ch)) {
      let text = '';
      while (!done() && isDigit(at())) text += step();

      if (at() === '.' && isDigit(at(1))) {
        text += step();
        while (!done() && isDigit(at())) text += step();
      }

      if (at() === 'e' || at() === 'E') {
        const save = { i, line, col };
        let exponent = step();
        if (at() === '+' || at() === '-') exponent += step();
        if (isDigit(at())) {
          while (!done() && isDigit(at())) exponent += step();
          text += exponent;
        } else {
          i = save.i;
          line = save.line;
          col = save.col;
        }
      }

      push('number', Number(text), startLine, startCol);
      continue;
    }

    if (ch === '#') {
      step();
      let digits = '';
      while (!done() && isHexDigit(at())) digits += step();
      if (![3, 4, 6, 8].includes(digits.length)) {
        fail(`invalid hex color '#${digits}'`, startLine, startCol);
      }
      push('color', '#' + digits.toLowerCase(), startLine, startCol);
      continue;
    }

    if (isIdentStart(ch)) {
      let name = '';
      while (!done() && isIdentPart(at())) name += step();
      push(KEYWORDS.has(name) ? 'keyword' : 'ident', name, startLine, startCol);
      continue;
    }

    const operator = OPERATORS.find((op) => source.startsWith(op, i));
    if (operator) {
      for (let k = 0; k < operator.length; k++) step();
      push('op', operator, startLine, startCol);
      continue;
    }

    if (PUNCTUATION.has(ch)) {
      step();
      push('punct', ch, startLine, startCol);
      continue;
    }

    fail(`unexpected character '${ch}'`, startLine, startCol);
  }

  push('eof', null, line, col);
  return tokens;
}
