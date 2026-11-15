import * as THREE from 'three';
import { geologyAt, heightAt, seeded } from '../../../game/terrain';
import { visualConfig } from '../config/visualConfig';

export function addPebbleField(scene: THREE.Scene, seed = 9721) {
  const { pebbleCount, startClearanceM } = visualConfig.rocks, random = seeded(seed);
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshStandardMaterial({ color: '#a8825f', roughness: 1, flatShading: true });
  const pebbles = new THREE.InstancedMesh(geometry, material, pebbleCount); pebbles.name = 'Seeded_VisualV2_Pebbles';
  pebbles.castShadow = false; pebbles.receiveShadow = true;
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  let count = 0, attempts = 0;
  while (count < pebbleCount && attempts < pebbleCount * 8) {
    attempts++;
    const x = (random() - 0.5) * 292, z = (random() - 0.5) * 292;
    if (Math.hypot(x + 18, z - 12) < startClearanceM || Math.hypot(x + 18, z - 12) < 12) continue;
    if (Math.abs(x + 18) < 8 && z < 12 && z > -88) continue;
    const scale = 0.035 + random() * 0.11;
    dummy.position.set(x, heightAt(x, z) + scale * (0.72 + geologyAt(x, z) * 0.08), z);
    dummy.scale.set(scale * (0.8 + random() * 0.5), scale * (0.5 + random() * 0.35), scale * (0.7 + random() * 0.7));
    dummy.rotation.set(random() * 0.5, random() * Math.PI * 2, random() * 0.5); dummy.updateMatrix(); pebbles.setMatrixAt(count, dummy.matrix);
    const shade = 0.78 + random() * 0.33; tint.setRGB(shade, shade * 0.84, shade * 0.72); pebbles.setColorAt(count, tint); count++;
  }
  pebbles.count = count; pebbles.instanceMatrix.needsUpdate = true; if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  scene.add(pebbles); return pebbles;
}
