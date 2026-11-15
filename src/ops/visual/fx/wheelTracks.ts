import * as THREE from 'three';
import { visualConfig } from '../config/visualConfig';

export function createWheelTracks() {
  const { trackCount } = visualConfig.effects;
  const geometry = new THREE.BoxGeometry(0.18, 0.012, 0.34);
  const material = new THREE.MeshStandardMaterial({ color: '#49352e', roughness: 1, metalness: 0, transparent: true, opacity: 0.48, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geometry, material, trackCount); mesh.count = 0; mesh.name = 'Wheel_Track_Ring_Buffer'; mesh.frustumCulled = false;
  return { mesh, capacity: trackCount, spacingM: visualConfig.effects.trackSpacingM };
}
