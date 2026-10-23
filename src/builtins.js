import { LangError } from './errors.js';
import { createImage } from './image.js';
import { builtin, isNumber, isTuple, isImage, isWindow, tuple, valueType } from './values.js';

function errAt(node, message) {
  throw new LangError(message, node?.line ?? 1, node?.col ?? 1);
}

function requireNumber(value, name, node) {
  if (!isNumber(value)) errAt(node, `${name} expects numbers, got a ${valueType(value)}`);
}

function mapNumber(name, value, node, fn) {
  if (isTuple(value)) return tuple(value.items.map((item) => mapNumber(name, item, node, fn)));
  requireNumber(value, name, node);
  return fn(value);
}

const numeric1 = (name, fn) =>
  builtin(name, 1, ([x], _ctx, node) => mapNumber(name, x, node, fn));

function combine(a, b, node, fn) {
  if (isTuple(a) && isTuple(b)) {
    if (a.items.length !== b.items.length) {
      errAt(node, `cannot combine tuples of length ${a.items.length} and ${b.items.length}`);
    }
    return tuple(a.items.map((item, i) => fn(item, b.items[i])));
  }
  if (isTuple(a)) return tuple(a.items.map((item) => fn(item, b)));
  if (isTuple(b)) return tuple(b.items.map((item) => fn(a, item)));
  return fn(a, b);
}

function requireCollection(value, name, node) {
  if (!isTuple(value) || value.items.length === 0) {
    errAt(node, `${name} expects a non-empty collection, got a ${valueType(value)}`);
  }
}

function foldCollection(value, name, node, init, fn) {
  requireCollection(value, name, node);
  const items = init === undefined ? value.items.slice(1) : value.items;
  const start = init === undefined ? value.items[0] : init;
  return items.reduce(
    (acc, item) =>
      combine(acc, item, node, (x, y) => {
        requireNumber(x, name, node);
        requireNumber(y, name, node);
        return fn(x, y);
      }),
    start,
  );
}

function medianCollection(value, node) {
  requireCollection(value, 'median', node);
  const items = value.items;
  if (isNumber(items[0])) {
    const sorted = [...items].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  if (isTuple(items[0])) {
    const size = items[0].items.length;
    const channels = [];
    for (let i = 0; i < size; i++) {
      const column = items.map((item) => item.items[i]).sort((a, b) => a - b);
      channels.push(column[Math.floor(column.length / 2)]);
    }
    return tuple(channels);
  }
  errAt(node, 'median expects numbers or colors');
}

const LUMA = [0.2126, 0.7152, 0.0722];

function lumaOf(color) {
  return LUMA[0] * color.items[0] + LUMA[1] * color.items[1] + LUMA[2] * color.items[2];
}

function requireImage(value, name, node) {
  if (!isImage(value)) errAt(node, `${name} expects an image, got a ${valueType(value)}`);
}

function requireWindow(value, name, node) {
  if (!isWindow(value)) errAt(node, `${name} expects a window, got a ${valueType(value)}`);
}

function makeFrame() {
  return tuple([tuple([0, 0, 0]), tuple([0, 0, 0])]);
}

function eachPixel(image, frame, fn) {
  const { width, height, data } = image;
  const uv = frame.items[0];
  const color = frame.items[1];
  const out = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      uv.items[0] = (x + 0.5) / width;
      uv.items[1] = (y + 0.5) / height;
      uv.items[2] = width / height;
      color.items[0] = data[i];
      color.items[1] = data[i + 1];
      color.items[2] = data[i + 2];
      writePixel(out, i, fn(frame), data[i + 3]);
    }
  }
  return createImage(width, height, out);
}

function writePixel(out, i, value, alpha) {
  if (isNumber(value)) {
    out[i] = value;
    out[i + 1] = value;
    out[i + 2] = value;
    out[i + 3] = alpha;
    return;
  }
  if (isTuple(value) && value.items.length >= 3) {
    out[i] = value.items[0];
    out[i + 1] = value.items[1];
    out[i + 2] = value.items[2];
    out[i + 3] = value.items.length >= 4 ? value.items[3] : alpha;
    return;
  }
  if (isTuple(value) && value.items.length === 1) {
    out[i] = value.items[0];
    out[i + 1] = value.items[0];
    out[i + 2] = value.items[0];
    out[i + 3] = alpha;
    return;
  }
  errAt(null, `a pixel function must return a number or color, got a ${valueType(value)}`);
}

function mirrorIndex(v, n) {
  if (n <= 1) return 0;
  const m = 2 * (n - 1);
  const p = ((v % m) + m) % m;
  return p < n ? p : m - p;
}

function sampleColor(window, x, y) {
  const { image, mode } = window;
  const { width, height, data } = image;
  let sx;
  let sy;
  if (mode === 'wrap') {
    sx = ((x % width) + width) % width;
    sy = ((y % height) + height) % height;
  } else if (mode === 'mirror') {
    sx = mirrorIndex(x, width);
    sy = mirrorIndex(y, height);
  } else {
    sx = x < 0 ? 0 : x >= width ? width - 1 : x;
    sy = y < 0 ? 0 : y >= height ? height - 1 : y;
  }
  const i = (sy * width + sx) * 4;
  return tuple([data[i], data[i + 1], data[i + 2]]);
}

function applyStencil(image, radius, fn, mode, ctx, node) {
  const { width, height, data } = image;
  const pixels = Math.max(0, Math.round(radius * height));
  const out = new Float32Array(width * height * 4);
  const window = { type: 'window', image, x: 0, y: 0, radius: pixels, mode };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      window.x = x;
      window.y = y;
      writePixel(out, i, ctx.apply(fn, window, node, ctx), data[i + 3]);
    }
  }
  return createImage(width, height, out);
}

const stencilBuiltin = (name, mode) =>
  builtin(name, 3, ([radius, fn, image], ctx, node) => {
    requireNumber(radius, name, node);
    requireImage(image, name, node);
    return applyStencil(image, radius, fn, mode, ctx, node);
  });

export const builtins = {
  sqrt: numeric1('sqrt', Math.sqrt),
  abs: numeric1('abs', Math.abs),
  floor: numeric1('floor', Math.floor),
  ceil: numeric1('ceil', Math.ceil),
  round: numeric1('round', Math.round),

  sum: builtin('sum', 1, ([value], _ctx, node) => foldCollection(value, 'sum', node, 0, (x, y) => x + y)),
  mean: builtin('mean', 1, ([value], _ctx, node) => {
    requireCollection(value, 'mean', node);
    const total = foldCollection(value, 'mean', node, 0, (x, y) => x + y);
    return combine(total, 1 / value.items.length, node, (x, scale) => x * scale);
  }),
  min: builtin('min', 1, ([value], _ctx, node) => foldCollection(value, 'min', node, undefined, Math.min)),
  max: builtin('max', 1, ([value], _ctx, node) => foldCollection(value, 'max', node, undefined, Math.max)),
  median: builtin('median', 1, ([value], _ctx, node) => medianCollection(value, node)),

  luma: builtin('luma', 1, ([color], _ctx, node) => {
    if (isNumber(color)) return color;
    if (isTuple(color)) {
      if (color.items.length < 3) errAt(node, 'luma expects a color with at least 3 components');
      return lumaOf(color);
    }
    errAt(node, `luma expects a color, got a ${valueType(color)}`);
  }),

  mix: builtin('mix', 3, ([a, b, t], _ctx, node) => {
    requireNumber(t, 'mix', node);
    return combine(a, b, node, (x, y) => {
      requireNumber(x, 'mix', node);
      requireNumber(y, 'mix', node);
      return x * (1 - t) + y * t;
    });
  }),

  grayscale: builtin('grayscale', 1, ([image], _ctx, node) => {
    requireImage(image, 'grayscale', node);
    return eachPixel(image, makeFrame(), (frame) => lumaOf(frame.items[1]));
  }),

  invert: builtin('invert', 1, ([image], _ctx, node) => {
    requireImage(image, 'invert', node);
    return eachPixel(image, makeFrame(), (frame) => {
      const color = frame.items[1];
      return tuple([1 - color.items[0], 1 - color.items[1], 1 - color.items[2]]);
    });
  }),

  mapPx: builtin('mapPx', 2, ([fn, image], ctx, node) => {
    requireImage(image, 'mapPx', node);
    const frame = makeFrame();
    return eachPixel(image, frame, (pixel) => ctx.apply(fn, pixel, node, ctx));
  }),

  center: builtin('center', 1, ([window], _ctx, node) => {
    requireWindow(window, 'center', node);
    return sampleColor(window, window.x, window.y);
  }),

  at: builtin('at', 2, ([window, offset], _ctx, node) => {
    requireWindow(window, 'at', node);
    if (!isTuple(offset) || offset.items.length < 2) errAt(node, 'at expects an (dx, dy) offset');
    requireNumber(offset.items[0], 'at', node);
    requireNumber(offset.items[1], 'at', node);
    const dx = Math.round(offset.items[0]);
    const dy = Math.round(offset.items[1]);
    return sampleColor(window, window.x + dx, window.y + dy);
  }),

  neighbors: builtin('neighbors', 1, ([window], _ctx, node) => {
    requireWindow(window, 'neighbors', node);
    const { radius } = window;
    const items = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        items.push(sampleColor(window, window.x + dx, window.y + dy));
      }
    }
    return tuple(items);
  }),

  pos: builtin('pos', 1, ([window], _ctx, node) => {
    requireWindow(window, 'pos', node);
    return tuple([window.x, window.y]);
  }),

  sample: builtin('sample', 2, ([image, uv], _ctx, node) => {
    requireImage(image, 'sample', node);
    if (!isTuple(uv) || uv.items.length < 2) errAt(node, 'sample expects a (u, v) coordinate');
    requireNumber(uv.items[0], 'sample', node);
    requireNumber(uv.items[1], 'sample', node);
    const { width, height, data } = image;
    const x = Math.min(width - 1, Math.max(0, Math.floor(uv.items[0] * width)));
    const y = Math.min(height - 1, Math.max(0, Math.floor(uv.items[1] * height)));
    const i = (y * width + x) * 4;
    return tuple([data[i], data[i + 1], data[i + 2]]);
  }),

  size: builtin('size', 1, ([image], _ctx, node) => {
    requireImage(image, 'size', node);
    return tuple([image.width, image.height]);
  }),

  debug: builtin('debug', 2, ([label, image], _ctx, node) => {
    if (typeof label !== 'string') {
      errAt(node, `debug expects a string label, got a ${valueType(label)}`);
    }
    requireImage(image, 'debug', node);
    return { ...image, label };
  }),

  len: builtin('len', 1, ([value], _ctx, node) => {
    if (isNumber(value)) return Math.abs(value);
    if (isTuple(value)) return Math.sqrt(value.items.reduce((sum, item) => sum + item * item, 0));
    errAt(node, `len expects a number or tuple, got a ${valueType(value)}`);
  }),

  dot: builtin('dot', 2, ([a, b], _ctx, node) => {
    if (!isTuple(a) || !isTuple(b) || a.items.length !== b.items.length) {
      errAt(node, 'dot expects two tuples of the same length');
    }
    return a.items.reduce((sum, item, i) => sum + item * b.items[i], 0);
  }),

  clamp: builtin('clamp', 3, ([value, low, high], _ctx, node) => {
    requireNumber(low, 'clamp', node);
    requireNumber(high, 'clamp', node);
    return mapNumber('clamp', value, node, (v) => (v < low ? low : v > high ? high : v));
  }),

  stencil: stencilBuiltin('stencil', 'clamp'),
  stencilWrap: stencilBuiltin('stencilWrap', 'wrap'),
  stencilMirror: stencilBuiltin('stencilMirror', 'mirror'),
};
