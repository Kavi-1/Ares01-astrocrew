import * as THREE from 'three';
import { seeded } from '../../../game/terrain';

/** Six low-poly procedural Mars rock silhouettes; reused by instancing. */
export function createRockLibrary(seed = 7831) {
  const random = seeded(seed);
  const geometries = [
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.DodecahedronGeometry(1, 1),
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.DodecahedronGeometry(1, 1),
  ];
  geometries.forEach((geometry, kind) => {
    const position = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(position, i);
      const rough = kind === 1 ? 0.97 + random() * 0.04 : kind === 2 ? 0.82 + random() * 0.32 : 0.72 + random() * 0.55;
      v.multiplyScalar(rough);
      if (kind === 2) v.y *= 0.32; // tilted slab
      if (kind === 3) v.multiplyScalar(0.8 + random() * 0.2); // rounded cobble
      if (kind === 4) { v.y *= 0.48; v.x *= 1.24; } // layered slab
      if (kind === 5) { v.y *= 0.74; v.z *= 0.82; } // compact cluster rock
      position.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
  });
  return geometries;
}
