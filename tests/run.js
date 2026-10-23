import { LangError } from '../src/errors.js';
import { lex } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { print } from '../src/ast.js';
import { evaluate } from '../src/eval.js';
import { formatValue } from '../src/values.js';
import { createImage } from '../src/image.js';
import {
  lexerCases,
  positionCases,
  errorCases,
  parserCases,
  parserErrorCases,
  evalCases,
  evalErrorCases,
  evalLocationCases,
  imageCases,
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

function checkEval(label, source, expected) {
  try {
    check(label, formatValue(evaluate(source).value), expected);
  } catch (err) {
    failed++;
    console.log(`FAIL ${label}\n  threw ${err.toString()}`);
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

for (const testCase of evalCases) {
  checkEval(testCase.name, testCase.source, testCase.expected);
}

for (const testCase of evalErrorCases) {
  checkThrows(testCase.name, () => evaluate(testCase.source));
}

const testInput = createImage(
  2,
  2,
  new Float32Array([
    0.25, 0.5, 0.75, 1,
    1, 0, 0, 1,
    0, 1, 0.5, 0.5,
    0.1, 0.2, 0.3, 1,
  ]),
);

for (const testCase of evalLocationCases) {
  try {
    evaluate(testCase.source, testCase.withInput ? { input: testInput } : {});
    failed++;
    console.log(`FAIL ${testCase.name}\n  expected a LangError, got none`);
  } catch (err) {
    const messageOk = testCase.message === undefined || err.message === testCase.message;
    if (err instanceof LangError && err.line === testCase.line && err.col === testCase.col && messageOk) {
      passed++;
    } else {
      failed++;
      console.log(
        `FAIL ${testCase.name}\n  expected ${testCase.line}:${testCase.col} ${testCase.message ?? ''}, got ${err.line}:${err.col} ${err.message}`,
      );
    }
  }
}

const round4 = (v) => Math.round(v * 10000) / 10000;

for (const testCase of imageCases) {
  try {
    const image = evaluate(testCase.source, { input: testInput }).value;
    if (testCase.size) {
      check(`${testCase.name} (size)`, `${image.width}x${image.height}`, `${testCase.size[0]}x${testCase.size[1]}`);
    }
    if (testCase.at) {
      const [x, y] = testCase.at;
      const i = (y * image.width + x) * 4;
      const actual = [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]].map(round4);
      check(testCase.name, JSON.stringify(actual), JSON.stringify(testCase.rgba));
    }
  } catch (err) {
    failed++;
    console.log(`FAIL ${testCase.name}\n  threw ${err.toString()}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
