import * as THREE from 'three';
import { visualConfig } from '../config/visualConfig';

export function createMarsEnvironmentMap(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const context = canvas.getContext('2d'); if (!context) return null;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#8E6A63'); gradient.addColorStop(0.42, '#B98A78'); gradient.addColorStop(0.53, visualConfig.lighting.horizon); gradient.addColorStop(1, '#5A2E1E');
  context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
  const source = new THREE.CanvasTexture(canvas); source.mapping = THREE.EquirectangularReflectionMapping; source.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
  try { const target = pmrem.fromEquirectangular(source); source.dispose(); pmrem.dispose(); return target; }
  catch { source.dispose(); pmrem.dispose(); return null; }
}
