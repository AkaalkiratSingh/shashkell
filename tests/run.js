import { LangError } from '../src/errors.js';
import { lex } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { print } from '../src/ast.js';
import {
  lexerCases,
  positionCases,
  errorCases,
  parserCases,
  parserErrorCases,
} from './cases.js';

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.log(`FAIL ${label}`);
    console.log(`  expected: ${expected}`);
    console.log(`  actual:   ${actual}`);
  }
}

function checkThrows(label, fn) {
  try {
    fn();
    failed++;
    console.log(`FAIL ${label}\n  expected a LangError, got none`);
  } catch (err) {
    if (err instanceof LangError) {
      passed++;
    } else {
      failed++;
      console.log(`FAIL ${label}\n  expected a LangError, got ${err.toString()}`);
    }
  }
}

const asPairs = (tokens) => JSON.stringify(tokens.map((t) => [t.type, t.value]));

for (const testCase of lexerCases) {
  try {
    check(testCase.name, asPairs(lex(testCase.source)), JSON.stringify(testCase.tokens));
  } catch (err) {
    failed++;
    console.log(`FAIL ${testCase.name}\n  threw ${err.toString()}`);
  }
}

for (const testCase of positionCases) {
  try {
    const actual = lex(testCase.source)
      .slice(testCase.from ?? 0)
      .map((t) => [t.line, t.col, t.value]);
    check(testCase.name, JSON.stringify(actual), JSON.stringify(testCase.positions));
  } catch (err) {
    failed++;
    console.log(`FAIL ${testCase.name}\n  threw ${err.toString()}`);
  }
}

for (const testCase of errorCases) {
  checkThrows(testCase.name, () => lex(testCase.source));
}

const pretty = (source) => print(parse(source));

for (const testCase of parserCases) {
  try {
    check(testCase.name, pretty(testCase.source), testCase.printed);
    check(`${testCase.name} (round-trip)`, pretty(pretty(testCase.source)), testCase.printed);
  } catch (err) {
    failed++;
    console.log(`FAIL ${testCase.name}\n  threw ${err.toString()}`);
  }
}

for (const testCase of parserErrorCases) {
  checkThrows(testCase.name, () => parse(testCase.source));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
