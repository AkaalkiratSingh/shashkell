import { LangError } from '../src/errors.js';
import { lex } from '../src/lexer.js';
import { lexerCases, positionCases, errorCases } from './cases.js';

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
    const tokens = lex(testCase.source).slice(testCase.from ?? 0);
    const actual = tokens.map((t) => [t.line, t.col, t.value]);
    check(testCase.name, JSON.stringify(actual), JSON.stringify(testCase.positions));
  } catch (err) {
    failed++;
    console.log(`FAIL ${testCase.name}\n  threw ${err.toString()}`);
  }
}

for (const testCase of errorCases) {
  try {
    lex(testCase.source);
    failed++;
    console.log(`FAIL ${testCase.name}\n  expected a LangError, got none`);
  } catch (err) {
    check(testCase.name, err instanceof LangError, true);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
