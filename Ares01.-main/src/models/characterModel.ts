import * as THREE from 'three';
import { disposeModel, loadModel, MODEL_PATHS, type ModelLoadOptions } from './assets';
import type { CrewId } from '../data/crew';

export async function createCharacterModel(id: CrewId, options: ModelLoadOptions = {}) {
  const gltf = await loadModel(MODEL_PATHS.crew(id), options);
  const root = new THREE.Group();
  root.add(gltf.scene);
  try {
    options.signal?.throwIfAborted();
    // Keep authored bone poses: the supplied clothing includes rigid meshes.
    // Rotating limb bones independently would separate the body from the uniform.
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 1.8 / Math.max(.01, size.y);
    gltf.scene.position.set(-center.x, -bounds.min.y, -center.z);
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    return root;
  } catch (error) { disposeModel(root); throw error; }
}

export function createCharacterStudio(canvas: HTMLCanvasElement, width: number, height: number) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e5f2ff', '#343039', 2.8));
  const key = new THREE.DirectionalLight('#ffe5cf', 3.2);
  key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#8bd6df', 2);
  rim.position.set(-3, 2, -2); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, width / height, .01, 50);
  camera.position.set(0, 1.1, 4.3);
  camera.lookAt(0, .95, 0);
  return { renderer, scene, camera };
}

export function frameCharacterPortrait(root: THREE.Object3D, camera: THREE.PerspectiveCamera) {
  root.updateMatrixWorld(true);
  const head = root.getObjectByName('J_Bip_C_Head');
  const target = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.55, 0);
  target.y -= .03;
  camera.position.copy(target).add(new THREE.Vector3(0, .02, 1.15));
  camera.lookAt(target);
}
