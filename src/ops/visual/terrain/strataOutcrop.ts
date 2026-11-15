import * as THREE from 'three';
import { heightAt, seeded } from '../../../game/terrain';

/** Layered lakebed visual inspired by sedimentary textures; an artistic formation, not mapped geology. */
export function addLakebedOutcrop(scene: THREE.Scene, x: number, z: number, seed = 3901) {
  const random = seeded(seed), group = new THREE.Group();
  const palette = ['#9e7558', '#c39a72', '#665044', '#b48763', '#d0a77b', '#855c47', '#b78b67'];
  for (let layer = 0; layer < 7; layer++) {
    const width = 3.1 - layer * 0.16, depth = 2.15 - layer * 0.1, height = 0.22 + random() * 0.1;
    const geo = new THREE.BoxGeometry(width, height, depth, 5, 1, 4), position = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(position, i);
      p.y += (random() - 0.5) * 0.13; p.x += Math.sin(p.z * 1.8 + layer) * 0.035;
      position.setXYZ(i, p.x, p.y, p.z);
    }
    geo.computeVertexNormals();
    const slab = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: palette[layer], roughness: 1, flatShading: true }));
    slab.position.set((random() - 0.5) * 0.34, 0.16 + layer * 0.23, (random() - 0.5) * 0.28);
    slab.rotation.y = (random() - 0.5) * 0.16; slab.castShadow = true; slab.receiveShadow = true; group.add(slab);
  }
  group.position.set(x, heightAt(x, z) - 0.22, z); group.name = 'Artistic_Layered_Lakebed_Outcrop'; scene.add(group); return group;
}
