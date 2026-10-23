import { LangError } from './errors.js';
import { createImage, drawImage } from './image.js';
import { evaluate } from './eval.js';
import { formatValue, isImage } from './values.js';

const canvas = document.getElementById('output');
const editor = document.getElementById('editor');
const runButton = document.getElementById('run');
const resetButton = document.getElementById('reset');
const log = document.getElementById('log');

const input = makeDefaultImage(256, 256);
drawImage(canvas, input);

const defaultSource = editor.value;

runButton.addEventListener('click', () => {
  const source = editor.value;
  try {
    const { value } = evaluate(source, { input });
    if (isImage(value)) {
      drawImage(canvas, value);
      showText(`rendered ${value.width}x${value.height} image`);
    } else {
      showText(formatValue(value));
    }
  } catch (err) {
    showError(err, source);
  }
});

resetButton.addEventListener('click', () => {
  editor.value = defaultSource;
  showText('');
  drawImage(canvas, input);
});

function showText(text) {
  log.classList.remove('is-error');
  log.textContent = text;
}

function showError(error, source) {
  log.classList.add('is-error');

  if (!(error instanceof LangError)) {
    log.textContent = String(error);
    return;
  }

  const lines = source.split('\n');
  const index = Math.min(Math.max(error.line - 1, 0), lines.length - 1);
  const text = lines[index] ?? '';
  const gutter = String(error.line);
  const pad = ' '.repeat(gutter.length);
  const caret = ' '.repeat(Math.max(0, error.col - 1));

  log.innerHTML =
    `<span class="error-message">${escapeHtml(error.message)}</span>` +
    `<span class="error-where"> line ${error.line}, column ${error.col}</span>\n` +
    `${gutter} | <span class="error-line">${escapeHtml(text)}</span>\n` +
    `${pad} | <span class="error-caret">${caret}^</span>`;
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
