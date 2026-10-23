import { createImage, drawImage } from './image.js';
import { parse } from './parser.js';
import { print } from './ast.js';

const canvas = document.getElementById('output');
const editor = document.getElementById('editor');
const runButton = document.getElementById('run');
const log = document.getElementById('log');

const input = makeDefaultImage(256, 256);
drawImage(canvas, input);

runButton.addEventListener('click', () => {
  try {
    const program = parse(editor.value);
    console.log(program);
    showLog(print(program));
  } catch (err) {
    showLog(err.toString(), true);
  }
});

function showLog(text, isError = false) {
  log.textContent = text;
  log.classList.toggle('is-error', isError);
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
