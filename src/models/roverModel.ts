import * as THREE from 'three';
import type { InstrumentId } from '../nasa/data';
import { disposeModel, loadModel, MODEL_PATHS, type ModelLoadOptions } from './assets';

// Exact node names in the supplied rover.glb (Three.js sanitizes punctuation).
// MOXIE is internal and MEDA is not a separate identifiable assembly in this export.
export const INSTRUMENT_NODES: Partial<Record<InstrumentId, string[]>> = {
  'mastcam-z': ['Mastcam_Z_cams'],
  supercam: ['lens'],
  pixl: ['PIXL', 'PIXL_cover_01'],
  sherloc: ['WATSON'],
  rimfax: ['RIMFAX'],
};

type Wheel = { steering: THREE.Group; rolling: THREE.Group; center: THREE.Vector3 };

// The source has six disconnected wheels merged by material. Partition triangles
// by wheel position, preserving UVs/normals/materials, then create real axle pivots.
function splitWheels(model: THREE.Object3D): Wheel[] {
  const source = model.getObjectByName('Wheels_objs');
  if (!source) return [];
  model.updateMatrixWorld(true);
  const pieces: THREE.Mesh[] = [];
  source.traverse(object => { if (object instanceof THREE.Mesh) pieces.push(object); });
  const groups = Array.from({ length: 6 }, () => new THREE.Group());
  for (const piece of pieces) {
    const geometry = piece.geometry;
    const positions = geometry.getAttribute('position');
    const buckets: number[][] = Array.from({ length: 6 }, () => []);
    const index = geometry.index;
    const count = index?.count ?? positions.count;
    const point = new THREE.Vector3();
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
      let x = 0, z = 0;
      for (const id of ids) {
        point.fromBufferAttribute(positions, id).applyMatrix4(piece.matrixWorld);
        x += point.x / 3; z += point.z / 3;
      }
      const axle = z < -.55 ? 0 : z > .55 ? 2 : 1;
      buckets[(x < 0 ? 0 : 3) + axle].push(...ids);
    }
    buckets.forEach((ids, bucket) => {
      if (!ids.length) return;
      const part = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const values = new Float32Array(ids.length * attribute.itemSize);
        ids.forEach((id, vertex) => {
          for (let j = 0; j < attribute.itemSize; j++) values[vertex * attribute.itemSize + j] = attribute.getComponent(id, j);
        });
        part.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
      }
      part.applyMatrix4(piece.matrixWorld);
      const mesh = new THREE.Mesh(part, piece.material);
      mesh.castShadow = true;
      groups[bucket].add(mesh);
    });
  }
  // Keep the original hidden so its geometry and shared materials are disposed once.
  source.visible = false;
  return groups.map((rolling, i) => {
    const bounds = new THREE.Box3().setFromObject(rolling);
    const center = bounds.getCenter(new THREE.Vector3());
    for (const object of rolling.children) (object as THREE.Mesh).geometry.translate(-center.x, -center.y, -center.z);
    const steering = new THREE.Group();
    steering.name = `ImportedWheel_${i}`;
    steering.position.copy(center);
    rolling.name = 'RollingAxle';
    steering.add(rolling);
    model.add(steering);
    return { steering, rolling, center };
  });
}

export async function createRoverModel(instruments: InstrumentId[], options: ModelLoadOptions = {}) {
  const gltf = await loadModel(MODEL_PATHS.rover, options);
  const model = gltf.scene;
  try {
    options.signal?.throwIfAborted();
    const wheels = splitWheels(model);
    // The supplied GLB is already in metres, +Y up, front +Z. Game front is -Z.
    const root = new THREE.Group();
    root.name = 'Imported_Perseverance';
    model.rotation.y = Math.PI;
    const floor = new THREE.Box3().setFromObject(model).min.y;
    model.position.y -= floor;
    model.traverse(object => {
      if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    root.add(model);
    const setInstruments = (selected: InstrumentId[]) => {
      for (const [id, names] of Object.entries(INSTRUMENT_NODES)) {
        for (const name of names) {
          const node = model.getObjectByName(name);
          if (node) node.visible = selected.includes(id as InstrumentId);
        }
      }
    };
    setInstruments(instruments);
    const scienceNodes=new Map<InstrumentId,Array<{node:THREE.Object3D;rotation:THREE.Euler}>>();
    for(const [instrument,names] of Object.entries(INSTRUMENT_NODES)){
      scienceNodes.set(instrument as InstrumentId,names.flatMap(name=>{
        const node=model.getObjectByName(name);return node?[{node,rotation:node.rotation.clone()}]:[];
      }));
    }
    return {
      root,
      setInstruments,
      // Optional named-node posing keeps unknown or differently rigged assets
      // intact. These small aim cues are presentation, never flight kinematics.
      setSciencePose(instrument:InstrumentId|null,progress:number,yaw:number){
        scienceNodes.forEach((nodes,id)=>nodes.forEach(({node,rotation})=>{
          node.rotation.copy(rotation);
          if(id!==instrument)return;
          if(id==='mastcam-z'||id==='supercam')node.rotation.y+=THREE.MathUtils.clamp(yaw,-.32,.32);
          else if(id==='pixl'||id==='sherloc')node.rotation.x-=.06+progress*.04;
        }));
      },
      update(distance: number, steeringAngle: number, pitch: number, roll: number) {
        root.rotation.set(pitch, 0, roll);
        wheels.forEach((wheel, i) => {
          wheel.rolling.rotation.x += distance / .2625;
          wheel.steering.rotation.y = i % 3 === 1 ? 0 : steeringAngle * (i % 3 === 2 ? 1 : -1);
        });
      },
      dispose() { disposeModel(root); },
    };
  } catch (error) {
    disposeModel(model);
    throw error;
  }
}
export type ImportedRover = Awaited<ReturnType<typeof createRoverModel>>;
