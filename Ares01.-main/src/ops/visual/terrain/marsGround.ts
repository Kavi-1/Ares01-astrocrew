import * as THREE from 'three';
import { visualConfig } from '../config/visualConfig';

/** Tileable low-amplitude sand grain; large terrain colour variation stays in the shared height field. */
export function createMarsGroundTexture(seed = 4201) {
  const size = visualConfig.rocks.detailTextureSize;
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  const image = context.createImageData(size, size);
  let state = seed >>> 0;
  const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  const coarseSize = 32, coarse = new Float32Array(coarseSize * coarseSize);
  for (let i = 0; i < coarse.length; i++) coarse[i] = rand() - 0.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = x / size * coarseSize, cy = y / size * coarseSize;
    const ix = Math.floor(cx), iy = Math.floor(cy), fx = cx - ix, fy = cy - iy;
    const at = (px: number, py: number) => coarse[((py % coarseSize + coarseSize) % coarseSize) * coarseSize + ((px % coarseSize + coarseSize) % coarseSize)];
    const top = THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), fx);
    const bottom = THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), fx);
    const grain = THREE.MathUtils.lerp(top, bottom, fy) * 8 + (rand() - 0.5) * 5;
    const value = THREE.MathUtils.clamp(238 + grain, 0, 255), index = (y * size + x) * 4;
    image.data[index] = value; image.data[index + 1] = value * 0.98; image.data[index + 2] = value * 0.95; image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(visualConfig.terrain.textureRepeat, visualConfig.terrain.textureRepeat);
  texture.anisotropy = 8; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}
