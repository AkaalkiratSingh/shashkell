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

export async function loadImageFromFile(file, maxSize) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();

  return imageFromImageData(context.getImageData(0, 0, width, height));
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
