import { LangError } from '../src/errors.js';
import { lex } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { print } from '../src/ast.js';
import { evaluate } from '../src/eval.js';
import { formatValue, isImage } from '../src/values.js';
import { createImage } from '../src/image.js';
import {
  createNotebook,
  setSource,
  insertCell,
  removeCellAt,
  moveCell,
  update,
  notebookJSON,
  notebookFromJSON,
} from '../src/notebook.js';
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
  stencilCases,
  preludeCases,
} from './cases.js';
import { PRELUDE } from '../src/prelude.js';

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

const stencilInput = createImage(
  3,
  3,
  new Float32Array([
    0, 0, 0, 1, 0.5, 0, 0, 1, 1, 0, 0, 1,
    0, 0.5, 0, 1, 0.5, 0.5, 0, 1, 1, 0.5, 0, 1,
    0, 1, 0, 1, 0.5, 1, 0, 1, 1, 1, 0, 1,
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

function runPixelCases(cases, inputImage, extra = {}) {
  for (const testCase of cases) {
    try {
      const image = evaluate(testCase.source, { ...extra, input: inputImage }).value;
      if (testCase.size) {
        check(
          `${testCase.name} (size)`,
          `${image.width}x${image.height}`,
          `${testCase.size[0]}x${testCase.size[1]}`,
        );
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
}

runPixelCases(imageCases, testInput);
runPixelCases(stencilCases, stencilInput);
runPixelCases(preludeCases, stencilInput, { prelude: PRELUDE });

{
  const labelled = evaluate('debug "hello" input', { input: testInput }).value;
  check('debug labels its image', labelled.label, 'hello');
  check('debug passes the image through', `${labelled.width}x${labelled.height}`, '2x2');
}

const runsOf = (notebook) => notebook.cells.map((cell) => notebook.runs.get(cell.id) ?? 0);

{
  const notebook = createNotebook(['b = a + 1', 'a = 41', 'b']);
  const results = update(notebook);
  check('notebook: dependency order', formatValue(results[2].value), '42');
}

{
  const notebook = createNotebook(['a = 1', 'b = a + 1', 'd = 100', 'a + d']);
  update(notebook);
  setSource(notebook, 0, 'a = 2');
  update(notebook);
  check('notebook: only dependents re-run', JSON.stringify(runsOf(notebook)), JSON.stringify([2, 2, 1, 2]));
  check('notebook: dependent value updates', formatValue(update(notebook)[3].value), '102');
}

{
  const notebook = createNotebook(['a = 1', 'a * 2']);
  update(notebook);
  const before = JSON.stringify(runsOf(notebook));
  update(notebook);
  check('notebook: memoized when unchanged', JSON.stringify(runsOf(notebook)), before);
}

{
  const notebook = createNotebook(['x = 1', 'y = nope', 'x + 1']);
  const results = update(notebook);
  check('notebook: error isolated', results[1].error instanceof LangError, true);
  check('notebook: siblings still evaluate', formatValue(results[2].value), '2');
}

{
  const notebook = createNotebook(['a = nope', 'a + 1']);
  const results = update(notebook);
  check('notebook: dependent blocked', results[1].blocked, true);
}

{
  const notebook = createNotebook(['a = b + 1', 'b = a + 1']);
  const results = update(notebook);
  check('notebook: cycle reported', results.every((result) => result.error instanceof LangError), true);
}

{
  const notebook = createNotebook(['a = 1', 'a + 1']);
  const restored = notebookFromJSON(notebookJSON(notebook));
  check(
    'notebook: json round-trip',
    JSON.stringify(restored.cells.map((cell) => cell.source)),
    JSON.stringify(['a = 1', 'a + 1']),
  );
  check('notebook: restored notebook evaluates', formatValue(update(restored)[1].value), '2');
}

{
  const notebook = createNotebook(['f = mapPx (\\(uv, c) -> c * 0.5)', 'input |> f']);
  const results = update(notebook, { input: testInput });
  check('notebook: cells can call pixel builtins', isImage(results[1].value), true);
}

{
  const notebook = createNotebook(['x = 1']);
  insertCell(notebook, 1, 'a + 1');
  check('notebook: insert cell', notebook.cells.length, 2);
  moveCell(notebook, 0, 1);
  check('notebook: move cell', notebook.cells[0].source, 'a + 1');
  removeCellAt(notebook, 0);
  check('notebook: remove cell', notebook.cells.length, 1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
