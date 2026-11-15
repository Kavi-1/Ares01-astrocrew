import * as THREE from 'three';
import { visualConfig } from '../config/visualConfig';

export function addInstancedGrousers(tire: THREE.Mesh, material: THREE.Material) {
  const { grouserCount } = visualConfig.effects, radius = visualConfig.rover.wheelRadiusM + 0.006;
  const geometry = new THREE.BoxGeometry(visualConfig.rover.wheelWidthM * 0.92, 0.022, 0.065);
  const mesh = new THREE.InstancedMesh(geometry, material, grouserCount);
  const dummy = new THREE.Object3D();
  for (let index = 0; index < grouserCount; index++) {
    const angle = index / grouserCount * Math.PI * 2;
    dummy.position.set(0, Math.cos(angle) * radius, Math.sin(angle) * radius);
    dummy.rotation.set(angle, 0, 0); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
  }
  mesh.name = '48_Documented_Wheel_Grousers'; tire.add(mesh); return mesh;
}
