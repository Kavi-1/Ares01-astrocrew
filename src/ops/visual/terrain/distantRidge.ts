import * as THREE from 'three';
import { heightAt, seeded } from '../../../game/terrain';

/** Aerial-perspective skyline, deliberately an artistic horizon rather than measured Mars topography. */
export function addDistantRidges(scene: THREE.Scene, seed = 4201) {
  const random = seeded(seed), meshes: THREE.Mesh[] = [];
  const layers = [
    { radius: 170, thickness: 18, relief: 14, color: '#704a40' },
    { radius: 186, thickness: 16, relief: 20, color: '#89594a' },
    { radius: 201, thickness: 15, relief: 27, color: '#a46f5b' },
  ];
  for (const [layerIndex, layer] of layers.entries()) {
    const segments = 192, vertices: number[] = [], colors: number[] = [], indices: number[] = [];
    const base = new THREE.Color(layer.color), haze = new THREE.Color('#c18468');
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const jitter = (random() - 0.5) * layer.thickness * 0.36;
      const radius = layer.radius + jitter;
      const x = Math.sin(angle) * radius, z = Math.cos(angle) * radius;
      const ground = heightAt(x, z) - 0.35;
      const summit = ground + layer.relief * (0.4 + random() * 0.8);
      vertices.push(x, ground, z, x, summit, z);
      const low = base.clone().lerp(haze, 0.34), high = base.clone().lerp(haze, 0.16);
      colors.push(low.r, low.g, low.b, high.r, high.g, high.b);
      if (i < segments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    const ridge = new THREE.Mesh(geometry, material); ridge.name = `VisualV2_Horizon_${layerIndex}`; ridge.frustumCulled = false; scene.add(ridge); meshes.push(ridge);
  }
  return meshes;
}
