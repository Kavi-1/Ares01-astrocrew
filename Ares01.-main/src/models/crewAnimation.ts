import * as THREE from 'three';

// The exported uniforms are rigid meshes. Transfer weights from the nearest
// authored body vertex in world space before posing, so clothes follow the rig.
export function prepareCrewAnimation(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const bodies: THREE.SkinnedMesh[] = [], clothes: THREE.Mesh[] = [];
  root.traverse(o => {
    if (o instanceof THREE.SkinnedMesh && (o.name.startsWith('Body') || o.parent?.name === 'Body')) bodies.push(o);
    if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh) && (o.name.startsWith('ARES_') || o.parent?.name.startsWith('ARES_'))) clothes.push(o);
  });
  // Two files also contain earlier overlapping avatar exports. Keep the final
  // body/face rig (the one paired with the authored hair) to avoid duplicate limbs.
  const canonical = bodies.at(-1)?.skeleton;
  if (canonical) {
    root.traverse(o => { if (o instanceof THREE.SkinnedMesh && o.skeleton.bones[0] !== canonical.bones[0]) o.visible = false; });
    for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].skeleton.bones[0] !== canonical.bones[0]) bodies.splice(i, 1);
  }
  if (bodies.length) {
    const uniformSkeleton = new THREE.Skeleton(bodies[0].skeleton.bones);
    const samples = bodies.flatMap(body => {
      const p = body.geometry.getAttribute('position');
      return Array.from({ length: p.count }, (_, i) => ({ point: new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(body.matrixWorld), body, i }));
    });
    for (const mesh of clothes) {
      const p = mesh.geometry.getAttribute('position'), indices: number[] = [], weights: number[] = [];
      // Map bone names because some exports split the body across skins.
      for (let i = 0; i < p.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
        let best = samples[0], distance = Infinity;
        for (const sample of samples) { const d = point.distanceToSquared(sample.point); if (d < distance) { best = sample; distance = d; } }
        const ids = best.body.geometry.getAttribute('skinIndex'), ws = best.body.geometry.getAttribute('skinWeight');
        for (let j = 0; j < 4; j++) { const sourceBone = best.body.skeleton.bones[ids.getComponent(best.i, j)];
          const mapped = bodies[0].skeleton.bones.findIndex(b => b.name === sourceBone?.name);
          indices.push(Math.max(0, mapped)); weights.push(mapped < 0 ? 0 : ws.getComponent(best.i, j)); }
      }
      mesh.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
      mesh.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
      const replacement = new THREE.SkinnedMesh(mesh.geometry, mesh.material);
      replacement.name = mesh.name; replacement.position.copy(mesh.position); replacement.quaternion.copy(mesh.quaternion); replacement.scale.copy(mesh.scale);
      mesh.parent!.add(replacement); replacement.updateMatrixWorld(true);
      replacement.bind(uniformSkeleton, mesh.matrixWorld); replacement.normalizeSkinWeights(); mesh.removeFromParent();
    }
  }
  const joints: { object: THREE.Object3D; original: THREE.Quaternion; side: number; leg?: boolean }[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Bone)) return;
    if (/^J_Bip_[LR]_UpperArm(?:_\d+)?$/.test(object.name)) joints.push({object,original:object.quaternion.clone(),side:object.name.includes('_L_')?-1:1});
    if (/^J_Bip_[LR]_UpperLeg(?:_\d+)?$/.test(object.name)) joints.push({object,original:object.quaternion.clone(),side:object.name.includes('_L_')?-1:1,leg:true});
    if (/^J_Bip_C_Head(?:_\d+)?$/.test(object.name)) joints.push({object,original:object.quaternion.clone(),side:0});
  });
  const q = new THREE.Quaternion(), x = new THREE.Vector3(1,0,0), z = new THREE.Vector3(0,0,1), y = new THREE.Vector3(0,1,0);
  return (time: number, speaking: boolean, reduced: boolean, walking = false) => {
    for (const {object,original,side,leg} of joints) {
      if(leg){object.quaternion.copy(original).multiply(q.setFromAxisAngle(x,walking&&!reduced?Math.sin(time*9)*side*.35:0));continue;}
      const angle = side ? side * (1.15 + (!reduced && speaking ? Math.sin(time * 2.3) * .12 : 0))
        : reduced ? 0 : Math.sin(time * (speaking ? 1.7 : .6)) * (speaking ? .12 : .04);
      object.quaternion.copy(original).multiply(q.setFromAxisAngle(side ? z : y, angle));
      if(side&&walking&&!reduced)object.quaternion.multiply(q.setFromAxisAngle(x,Math.sin(time*9)*side*.25));
    }
  };
}
