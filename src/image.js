export function createImage(width, height, data) {
  return {
    type: 'image',
    width,
    height,
    data: data ?? new Float32Array(width * height * 4),
  };
}

export function imageFromImageData(imageData) {
  const { width, height, data } = imageData;
  const out = new Float32Array(width * height * 4);
  for (let i = 0; i < out.length; i++) out[i] = data[i] / 255;
  return createImage(width, height, out);
}

export function imageToImageData(image) {
  const out = new Uint8ClampedArray(image.width * image.height * 4);
  for (let i = 0; i < out.length; i++) out[i] = clamp01(image.data[i]) * 255;
  return new ImageData(out, image.width, image.height);
}

export function drawImage(canvas, image) {
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').putImageData(imageToImageData(image), 0, 0);
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
