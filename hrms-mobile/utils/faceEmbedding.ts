import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';
import type { TensorflowModel } from 'react-native-fast-tflite';

export type FaceFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const INPUT_SIZE = 112;
const NORMALIZE_MEAN = 127.5;
const NORMALIZE_STD = 128.0;

const getImageSize = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const buildCropArea = (
  faceFrame: FaceFrame,
  imageWidth: number,
  imageHeight: number
) => {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight) || imageWidth <= 1 || imageHeight <= 1) {
    throw new Error('Invalid image size for face crop.');
  }
  if (
    !Number.isFinite(faceFrame.x) ||
    !Number.isFinite(faceFrame.y) ||
    !Number.isFinite(faceFrame.width) ||
    !Number.isFinite(faceFrame.height) ||
    faceFrame.width <= 1 ||
    faceFrame.height <= 1
  ) {
    throw new Error('Invalid face frame for crop.');
  }
  const padding = Math.max(faceFrame.width, faceFrame.height) * 0.2;
  const rawOriginX = faceFrame.x - padding;
  const rawOriginY = faceFrame.y - padding;
  const rawWidth = faceFrame.width + padding * 2;
  const rawHeight = faceFrame.height + padding * 2;

  let originX = Math.floor(clamp(rawOriginX, 0, imageWidth - 1));
  let originY = Math.floor(clamp(rawOriginY, 0, imageHeight - 1));
  let width = Math.round(clamp(rawWidth, 1, imageWidth));
  let height = Math.round(clamp(rawHeight, 1, imageHeight));

  if (originX + width > imageWidth) {
    width = Math.max(1, imageWidth - originX);
  }
  if (originY + height > imageHeight) {
    height = Math.max(1, imageHeight - originY);
  }

  if (width < 1 || height < 1) {
    throw new Error('Computed face crop is outside image bounds.');
  }

  return { originX, originY, width, height };
};

const l2Normalize = (embedding: ArrayLike<number>) => {
  let sum = 0;
  for (let i = 0; i < embedding.length; i += 1) {
    sum += embedding[i] * embedding[i];
  }
  const norm = Math.sqrt(sum) || 1;
  const normalized = new Float32Array(embedding.length);
  for (let i = 0; i < embedding.length; i += 1) {
    normalized[i] = embedding[i] / norm;
  }
  return normalized;
};

const decodeBase64ToFloat32 = (base64: string) => {
  const imageBuffer = Buffer.from(base64, 'base64');
  const decoded = jpeg.decode(imageBuffer, { useTArray: true });
  if (!decoded?.data) {
    throw new Error('Unable to decode face image.');
  }

  const { data } = decoded;
  const input = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);

  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i += 1) {
    const offset = i * 4;
    const outputOffset = i * 3;
    input[outputOffset] = (data[offset] - NORMALIZE_MEAN) / NORMALIZE_STD;
    input[outputOffset + 1] = (data[offset + 1] - NORMALIZE_MEAN) / NORMALIZE_STD;
    input[outputOffset + 2] = (data[offset + 2] - NORMALIZE_MEAN) / NORMALIZE_STD;
  }

  return input;
};

export const generateFaceEmbedding = async ({
  model,
  imageUri,
  faceFrame,
  imageWidth,
  imageHeight,
}: {
  model: TensorflowModel;
  imageUri: string;
  faceFrame: FaceFrame;
  imageWidth?: number;
  imageHeight?: number;
}) => {
  const size =
    imageWidth && imageHeight
      ? { width: imageWidth, height: imageHeight }
      : await getImageSize(imageUri);
  let crop;
  try {
    crop = buildCropArea(faceFrame, size.width, size.height);
  } catch {
    const fallbackSize = Math.min(size.width, size.height);
    const originX = Math.floor((size.width - fallbackSize) / 2);
    const originY = Math.floor((size.height - fallbackSize) / 2);
    crop = { originX, originY, width: fallbackSize, height: fallbackSize };
  }
  let cropped;
  try {
    cropped = await manipulateAsync(
      imageUri,
      [{ crop }, { resize: { width: INPUT_SIZE, height: INPUT_SIZE } }],
      {
        base64: true,
        format: SaveFormat.JPEG,
        compress: 1,
      }
    );
  } catch (error) {
    console.warn('Face crop failed, retrying with full-frame resize.', {
      error,
      imageSize: size,
      faceFrame,
      crop,
    });
    cropped = await manipulateAsync(
      imageUri,
      [{ resize: { width: INPUT_SIZE, height: INPUT_SIZE } }],
      {
        base64: true,
        format: SaveFormat.JPEG,
        compress: 1,
      }
    );
  }

  if (!cropped.base64) {
    throw new Error('Unable to extract face pixels.');
  }

  const inputTensor = decodeBase64ToFloat32(cropped.base64);
  const outputs = await model.run([inputTensor]);
  const embedding = outputs[0];
  if (!embedding) {
    throw new Error('Embedding model did not return data.');
  }

  return l2Normalize(embedding);
};
