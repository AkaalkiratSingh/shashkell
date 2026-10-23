import { LangError } from './errors.js';
import { createImage, drawImage } from './image.js';
import { formatValue, isImage } from './values.js';
import {
  createNotebook,
  insertCell,
  moveCell,
  notebookFromJSON,
  notebookJSON,
  removeCellAt,
  setSource,
  update,
} from './notebook.js';
import { PRELUDE } from './prelude.js';

const STORAGE_KEY = 'shaskell.notebook';
const PREVIEW_SIZE = 128;
const FULL_SIZE = 256;
const UPDATE_DELAY = 180;

const DEFAULT_CELLS = [
  '-- the library is preloaded: blur, dilate, erode, medianFilter, edges,',
  '-- threshold, vignette, duotone, pixelate, glitch, zoom',
  '-- a channel split: sample each colour channel from a different offset',
  'split = stencil 0 (\\w -> ((at w (64, 0)).g, (at w (0, -64)).r, (center w).r))',
  'input |> split |> blur 0.006 |> vignette 0.6',
];

const cellsEl = document.getElementById('cells');
const outputCanvas = document.getElementById('output');
const log = document.getElementById('log');
const addButton = document.getElementById('add');
const exportButton = document.getElementById('export');
const importButton = document.getElementById('import');
const importFile = document.getElementById('import-file');
const resetButton = document.getElementById('reset');

const previewInput = makeDefaultImage(PREVIEW_SIZE, PREVIEW_SIZE);
const fullInput = makeDefaultImage(FULL_SIZE, FULL_SIZE);

const cellNodes = new Map();
let notebook = loadNotebook();
let renderedIds = [];
let updateTimer = null;

render();
reportPreludeErrors();

const ctxFor = (input) => ({ input, prelude: PRELUDE });

function reportPreludeErrors() {
  const errors = (notebook.env && notebook.env.preludeErrors) || [];
  if (errors.length > 0) showMessage(`library error: ${errors[0].message}`, true);
}

function loadNotebook() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return notebookFromJSON(saved);
  } catch (error) {
    showMessage(`could not restore notebook: ${error.message}`, true);
  }
  return createNotebook(DEFAULT_CELLS);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, notebookJSON(notebook));
  } catch (error) {
    showMessage(`could not save notebook: ${error.message}`, true);
  }
}

function render() {
  const results = update(notebook, ctxFor(previewInput));
  const ids = notebook.cells.map((cell) => cell.id);
  const structureChanged =
    ids.length !== renderedIds.length || ids.some((id, index) => id !== renderedIds[index]);

  if (structureChanged) {
    rebuildCells();
    renderedIds = ids;
  }

  notebook.cells.forEach((cell, index) => {
    const nodes = cellNodes.get(cell.id);
    if (nodes) updateCellOutput(nodes, results[index], cell.source);
  });

  renderOutputPane();
}

function renderOutputPane() {
  const scratch = createNotebook(notebook.cells.map((cell) => cell.source));
  const results = update(scratch, ctxFor(fullInput));

  for (let index = results.length - 1; index >= 0; index--) {
    const value = results[index] && results[index].value;
    if (isImage(value)) {
      drawImage(outputCanvas, value);
      return;
    }
  }

  showMessage('no cell produces an image');
}

function rebuildCells() {
  cellsEl.replaceChildren();
  cellNodes.clear();
  notebook.cells.forEach((cell, index) => {
    const nodes = buildCell(cell, index);
    cellsEl.appendChild(nodes.root);
    cellNodes.set(cell.id, nodes);
  });
}

function buildCell(cell, index) {
  const root = document.createElement('div');
  root.className = 'cell';
  root.dataset.id = cell.id;

  const bar = document.createElement('div');
  bar.className = 'cell-bar';

  const label = document.createElement('span');
  label.className = 'cell-index';
  label.textContent = `cell ${index + 1}`;

  const actions = document.createElement('div');
  actions.className = 'cell-actions';
  for (const [act, text, title] of [
    ['up', '↑', 'move up'],
    ['down', '↓', 'move down'],
    ['full', 'full res', 'render this cell at full resolution'],
    ['delete', '✕', 'delete this cell'],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn small';
    button.dataset.act = act;
    button.title = title;
    button.textContent = text;
    actions.appendChild(button);
  }
  bar.append(label, actions);

  const input = document.createElement('textarea');
  input.className = 'cell-input';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.value = cell.source;

  const output = document.createElement('div');
  output.className = 'cell-output';

  const canvas = document.createElement('canvas');
  canvas.className = 'cell-canvas';
  canvas.hidden = true;

  const text = document.createElement('pre');
  text.className = 'cell-text';
  text.hidden = true;

  const error = document.createElement('pre');
  error.className = 'cell-error';
  error.hidden = true;

  output.append(canvas, text, error);
  root.append(bar, input, output);
  return { root, input, canvas, text, error, output };
}

function updateCellOutput(nodes, result, source) {
  nodes.canvas.hidden = true;
  nodes.text.hidden = true;
  nodes.error.hidden = true;
  nodes.output.hidden = true;
  nodes.root.classList.remove('has-error', 'is-blocked');
  if (!result) return;

  if (result.blocked) {
    nodes.output.hidden = false;
    nodes.error.hidden = false;
    nodes.error.textContent = `blocked: ${result.reason}`;
    nodes.root.classList.add('is-blocked');
    return;
  }

  if (result.error) {
    nodes.output.hidden = false;
    nodes.error.hidden = false;
    nodes.error.innerHTML = errorHtml(result.error, source);
    nodes.root.classList.add('has-error');
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(result, 'value')) return;
  const { value } = result;
  if (isImage(value)) {
    nodes.output.hidden = false;
    drawImage(nodes.canvas, value);
    nodes.canvas.hidden = false;
    if (value.label) {
      nodes.text.hidden = false;
      nodes.text.textContent = value.label;
    }
  } else if (value !== undefined) {
    nodes.output.hidden = false;
    nodes.text.hidden = false;
    nodes.text.textContent = formatValue(value);
  }
}

function errorHtml(error, source) {
  if (!(error instanceof LangError)) return escapeHtml(String(error));

  const lines = source.split('\n');
  const index = Math.min(Math.max(error.line - 1, 0), lines.length - 1);
  const text = lines[index] ?? '';
  const gutter = String(error.line);
  const pad = ' '.repeat(gutter.length);
  const caret = ' '.repeat(Math.max(0, error.col - 1));

  return (
    `<span class="error-message">${escapeHtml(error.message)}</span>` +
    `<span class="error-where"> line ${error.line}, column ${error.col}</span>\n` +
    `${gutter} | <span class="error-line">${escapeHtml(text)}</span>\n` +
    `${pad} | <span class="error-caret">${caret}^</span>`
  );
}

function indexOfCell(id) {
  return notebook.cells.findIndex((cell) => cell.id === id);
}

function renderFullRes(index) {
  const scratch = createNotebook(notebook.cells.map((cell) => cell.source));
  const result = update(scratch, ctxFor(fullInput))[index];

  if (result && result.error) {
    showMessage(result.error.toString(), true);
    return;
  }
  if (result && isImage(result.value)) {
    drawImage(outputCanvas, result.value);
    showMessage(`cell ${index + 1} rendered at ${result.value.width}x${result.value.height}`);
    return;
  }
  showMessage(`cell ${index + 1} does not produce an image`);
}

function showMessage(text, isError = false) {
  log.textContent = text;
  log.classList.toggle('is-error', isError);
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
}

function makeDefaultImage(width, height) {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = width > 1 ? x / (width - 1) : 0;
      data[i + 1] = height > 1 ? y / (height - 1) : 0;
      data[i + 2] = 0;
      data[i + 3] = 1;
    }
  }
  return createImage(width, height, data);
}

cellsEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-act]');
  if (!button) return;
  const cellEl = button.closest('.cell');
  const index = indexOfCell(cellEl.dataset.id);
  if (index === -1) return;

  switch (button.dataset.act) {
    case 'up':
      moveCell(notebook, index, -1);
      break;
    case 'down':
      moveCell(notebook, index, 1);
      break;
    case 'delete':
      removeCellAt(notebook, index);
      break;
    case 'full':
      renderFullRes(index);
      return;
    default:
      return;
  }
  render();
  save();
});

cellsEl.addEventListener('input', (event) => {
  const textarea = event.target.closest('textarea');
  if (!textarea) return;
  const index = indexOfCell(textarea.closest('.cell').dataset.id);
  if (index === -1) return;

  setSource(notebook, index, textarea.value);
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    render();
    save();
  }, UPDATE_DELAY);
});

addButton.addEventListener('click', () => {
  insertCell(notebook, notebook.cells.length, '');
  render();
  save();
  const last = cellNodes.get(notebook.cells[notebook.cells.length - 1].id);
  if (last) last.input.focus();
});

resetButton.addEventListener('click', () => {
  notebook = createNotebook(DEFAULT_CELLS);
  renderedIds = [];
  render();
  save();
  showMessage('notebook reset');
});

exportButton.addEventListener('click', () => {
  const blob = new Blob([notebookJSON(notebook)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'notebook.json';
  anchor.click();
  URL.revokeObjectURL(url);
});

importButton.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    notebook = notebookFromJSON(await file.text());
    renderedIds = [];
    render();
    save();
    showMessage(`imported ${notebook.cells.length} cells`);
  } catch (error) {
    showMessage(`import failed: ${error.message}`, true);
  }
  importFile.value = '';
});
