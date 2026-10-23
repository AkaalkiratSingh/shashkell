import { imageFromImageData, drawImage } from './image.js';
import { lex } from './lexer.js';

const canvas = document.getElementById('output');
const editor = document.getElementById('editor');
const runButton = document.getElementById('run');
const log = document.getElementById('log');

const input = makeDefaultImage(256, 256);
drawImage(canvas, input);

runButton.addEventListener('click', () => {
  const source = editor.value;
  console.log(source);
  try {
    const tokens = lex(source);
    console.log(tokens);
    showLog(tokens.map(formatToken).join('\n'));
  } catch (err) {
    showLog(err.toString(), true);
  }
});

function formatToken(token) {
  const at = `${token.line}:${token.col}`;
  const value = token.value === null ? '' : ` ${JSON.stringify(token.value)}`;
  return `${at.padStart(8)}  ${token.type}${value}`;
}

function showLog(text, isError = false) {
  log.textContent = text;
  log.classList.toggle('is-error', isError);
}

function makeDefaultImage(width, height) {
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  const ctx = source.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#264653');
  gradient.addColorStop(0.55, '#e9c46a');
  gradient.addColorStop(1, '#e76f51');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  const cells = 8;
  const size = width / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * size, y * size, size, size);
    }
  }

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#101217';
  ctx.lineWidth = 3;
  for (const [cx, cy, r] of [
    [0.32, 0.34, 0.16],
    [0.68, 0.66, 0.22],
  ]) {
    ctx.beginPath();
    ctx.arc(cx * width, cy * height, r * width, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  return imageFromImageData(ctx.getImageData(0, 0, width, height));
}
