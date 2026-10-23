import { LangError } from './errors.js';
import { createImage } from './image.js';
import { builtin, isNumber, isTuple, isImage, tuple, valueType } from './values.js';

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

function zipNumbers(name, a, b, node, fn) {
  if (isTuple(a) && isTuple(b)) {
    if (a.items.length !== b.items.length) {
      errAt(node, `${name} cannot combine tuples of length ${a.items.length} and ${b.items.length}`);
    }
    return tuple(a.items.map((item, i) => zipNumbers(name, item, b.items[i], node, fn)));
  }
  if (isTuple(a)) return tuple(a.items.map((item) => zipNumbers(name, item, b, node, fn)));
  if (isTuple(b)) return tuple(b.items.map((item) => zipNumbers(name, a, item, node, fn)));
  requireNumber(a, name, node);
  requireNumber(b, name, node);
  return fn(a, b);
}

const numeric1 = (name, fn) =>
  builtin(name, 1, ([x], _ctx, node) => mapNumber(name, x, node, fn));

const numeric2 = (name, fn) =>
  builtin(name, 2, ([a, b], _ctx, node) => zipNumbers(name, a, b, node, fn));

const LUMA = [0.2126, 0.7152, 0.0722];

function lumaOf(color) {
  return LUMA[0] * color.items[0] + LUMA[1] * color.items[1] + LUMA[2] * color.items[2];
}

function requireImage(value, name, node) {
  if (!isImage(value)) errAt(node, `${name} expects an image, got a ${valueType(value)}`);
}

function makeFrame() {
  return tuple([tuple([0, 0]), tuple([0, 0, 0])]);
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

export const builtins = {
  sqrt: numeric1('sqrt', Math.sqrt),
  abs: numeric1('abs', Math.abs),
  floor: numeric1('floor', Math.floor),
  ceil: numeric1('ceil', Math.ceil),
  round: numeric1('round', Math.round),
  min: numeric2('min', Math.min),
  max: numeric2('max', Math.max),

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
};
