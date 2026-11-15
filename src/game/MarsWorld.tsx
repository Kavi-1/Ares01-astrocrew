import { useEffect, useRef, useState } from 'react';
import { createRoverModel, type ImportedRover } from '../models/roverModel';
import { disposeModel, isModelAbort, modelFailure, modelProgressText, type ModelProgress } from '../models/assets';
import * as THREE from 'three';
import { geologyAt, scenarioHeightAt, hazardContains, routeGeometry, seeded } from './terrain';
import { scenarioTargets, getScenario, sunElevationDeg, type SiteId } from '../data/scenarios';
import { traverse, targetReadiness, nearbyScienceTarget } from '../engine/campaign';
import { integrateEnergy } from '../engine/energy';
import { getDriveStatus } from '../engine/mobility';
import { useMarsStore } from '../store/marsStore';
import { SCIENCE_TARGETS as LEGACY_TARGETS } from '../data/scienceTargets';
import { DEFAULT_CONFIG, FIXED, INSTRUMENTS, type RoverConfig } from '../nasa/data';
import { driveEnergyWh, rtgPowerW, slopeAngleDeg } from '../nasa/engineering';
import { useGameStore } from '../store/gameStore';
import { visualConfig, visualQuality, visualV2Enabled } from '../ops/visual/config/visualConfig';
import { createMarsGroundTexture } from '../ops/visual/terrain/marsGround';
import { createRockLibrary } from '../ops/visual/terrain/rockGeometry';
import { addPebbleField } from '../ops/visual/terrain/pebbleField';
import { addDistantRidges } from '../ops/visual/terrain/distantRidge';
import { addInstancedGrousers } from '../ops/visual/rover/grousers';
import { createBeaconColumn } from '../ops/visual/fx/beacon';
import { createWheelTracks } from '../ops/visual/fx/wheelTracks';
import { createWheelDust } from '../ops/visual/fx/wheelDust';
import { createMarsEnvironmentMap } from '../ops/visual/atmosphere/environmentMap';
import { addLakebedOutcrop } from '../ops/visual/terrain/strataOutcrop';

type Props = { keys: React.MutableRefObject<Set<string>>; config?: RoverConfig; preview?: boolean; quality?: ReturnType<typeof visualQuality> };
const SCAN_RANGE = 8;

function roundedDeck(width: number, height: number, length: number, material: THREE.Material) {
  const r = Math.min(width, height) * 0.14;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + r, 0); shape.lineTo(width / 2 - r, 0); shape.quadraticCurveTo(width / 2, 0, width / 2, r);
  shape.lineTo(width / 2, height - r); shape.quadraticCurveTo(width / 2, height, width / 2 - r, height);
  shape.lineTo(-width / 2 + r, height); shape.quadraticCurveTo(-width / 2, height, -width / 2, height - r);
  shape.lineTo(-width / 2, r); shape.quadraticCurveTo(-width / 2, 0, -width / 2 + r, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.055, bevelThickness: 0.045, curveSegments: 4 });
  geometry.translate(0, 0, -length / 2);
  return new THREE.Mesh(geometry, material);
}

function makeTireGeometry(radius = 0.52, width = 0.4) {
  const geometry = new THREE.CylinderGeometry(radius, radius, width, 48, 1, false);
  geometry.rotateZ(Math.PI / 2);
  return geometry;
}

function beamBetween(parent: THREE.Object3D, start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.78, radius, direction.length(), 10), material);
  beam.position.copy(start).add(end).multiplyScalar(0.5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.castShadow = true; parent.add(beam); return beam;
}

function makeMesaGeometry(radius: number, height: number, seed: number) {
  const random = seeded(seed), segments = 32;
  const levels = [0, 0.09, 0.23, 0.4, 0.58, 0.72, 0.89, 1];
  const profiles = [0.82, 0.98, 0.94, 0.79, 0.73, 0.58, 0.4, 0.24];
  const vertices: number[] = [], indices: number[] = [];
  for (let ring = 0; ring < levels.length; ring++) {
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const rough = 0.86 + random() * 0.28;
      const shoulder = ring > 1 && ring < 6 ? (random() - 0.5) * 0.025 : 0;
      const r = radius * profiles[ring] * rough;
      vertices.push(Math.cos(angle) * r, height * levels[ring] + height * shoulder, Math.sin(angle) * r);
    }
  }
  for (let ring = 0; ring < levels.length - 1; ring++) for (let i = 0; i < segments; i++) {
    const a = ring * segments + i, b = ring * segments + (i + 1) % segments, c = (ring + 1) * segments + i, d = (ring + 1) * segments + (i + 1) % segments;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function makeGroundTexture() {
  const size = 256, canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const broad = Math.sin((u * 7 + Math.sin(v * Math.PI * 2 * 3) * 0.08) * Math.PI * 2) * 5;
      const cross = Math.cos((v * 9 + Math.sin(u * Math.PI * 2 * 2) * 0.06) * Math.PI * 2) * 4;
      const grain = Math.sin((u * 31 + v * 23) * Math.PI * 2) * 2.5 + Math.cos((u * 47 - v * 39) * Math.PI * 2) * 1.5;
      const value = 235 + broad + cross + grain;
      const i = (y * size + x) * 4;
      image.data[i] = value; image.data[i + 1] = value * 0.96; image.data[i + 2] = value * 0.89; image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(36, 36); texture.anisotropy = 8;
  return texture;
}

function makeLayeredOutcrop(seed: number, palette: string[]) {
  const random = seeded(seed), group = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    for (let j = 0; j < positions.count; j++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, j);
      const relief = 0.91 + random() * 0.16 + Math.sin(p.x * 5 + p.z * 4 + seed) * 0.035;
      p.multiplyScalar(relief); positions.setXYZ(j, p.x, p.y, p.z);
    }
    geometry.computeVertexNormals();
    const rock = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 1, flatShading: false }));
    const scale = 2.1 + random() * 2.2;
    rock.scale.set(scale * (1.2 + random() * 0.7), scale * (0.38 + random() * 0.25), scale * (0.75 + random() * 0.55));
    rock.position.set((random() - 0.5) * 4.5, rock.scale.y * 0.6, (random() - 0.5) * 3.5);
    rock.rotation.y = random() * Math.PI; rock.castShadow = true; rock.receiveShadow = true; group.add(rock);
  }
  return group;
}

function pointSegmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, lengthSq = dx * dx + dz * dz;
  const t = lengthSq === 0 ? 0 : THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / lengthSq, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export default function MarsWorld({ keys, config=DEFAULT_CONFIG, preview=false, quality:qualityProp }: Props) {
  const site = useGameStore(s=>s.campaign?.options.site??s.missionOptions.site);
  const campaignMode=useGameStore(s=>!!s.campaign);
  const host = useRef<HTMLDivElement>(null);
  const [modelProgress, setModelProgress] = useState<ModelProgress>({ phase: 'waiting' });
  const retryModel = useRef<() => void>(() => {});
  const modelStatus = modelProgress.phase === 'ready' ? 'ready' : modelProgress.phase === 'failed' ? 'fallback' : 'loading';
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null),sunRef=useRef<THREE.DirectionalLight|null>(null),rockMeshesRef=useRef<THREE.InstancedMesh[]>([]),rockBaseCountsRef=useRef<number[]>([]),pebbleRef=useRef<THREE.InstancedMesh|null>(null);
  const cameraView = useRef({ yaw: preview ? 2.7 : 0.34, pitch: 0.16, zoom: 10.5 });
  const previewZoomInitialized = useRef(false);
  const updateTelemetry = useMarsStore((s) => s.updateTelemetry);
  const visualKey = [...config.instruments].sort().join(',');
  const visualV2 = !preview && visualV2Enabled();
  const quality = qualityProp??visualQuality();

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const heightAt=(x:number,z:number)=>scenarioHeightAt(x,z,site as SiteId);
    const SCIENCE_TARGETS=campaignMode?scenarioTargets(site):LEGACY_TARGETS;
    const siteRules=getScenario(site);
    const sunElevation=sunElevationDeg(site,useGameStore.getState().campaign?.options.window??useGameStore.getState().missionOptions.window)*Math.PI/180;
    const savedProgress=preview ? { ...useGameStore.getState().missionProgress, x:-18, z:12, heading:0 } : useGameStore.getState().missionProgress;
    if (visualV2) cameraView.current = { ...cameraView.current, pitch: THREE.MathUtils.degToRad(visualConfig.camera.elevation), zoom: visualConfig.camera.distance };
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(siteRules.hue);
    scene.fog = new THREE.FogExp2(visualV2 ? visualConfig.lighting.horizon : '#bf8063', visualV2 ? visualConfig.terrain.fogClear : 0.0027);
    const camera = new THREE.PerspectiveCamera(preview ? 42 : visualV2 ? visualConfig.camera.fov : 52, root.clientWidth / root.clientHeight, 0.1, visualV2 ? visualConfig.camera.far : 700);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    rendererRef.current=renderer;
    renderer.setPixelRatio(Math.min(devicePixelRatio, visualV2 && quality === 'low' ? 1 : visualV2 && quality === 'high' ? 2 : 1.5));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = visualV2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = visualV2 ? visualConfig.lighting.exposure : 1.08;
    root.appendChild(renderer.domElement);
    if (!preview) {
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute('aria-label', 'Mars rover driving view');
    }

    const environmentTarget = createMarsEnvironmentMap(renderer);
    if (environmentTarget) { scene.environment = environmentTarget.texture; scene.environmentIntensity = 0.62; }

    scene.add(new THREE.HemisphereLight(visualV2 ? visualConfig.lighting.hemisphereSky : '#f8d3b1', visualV2 ? visualConfig.lighting.hemisphereGround : '#3c2926', visualV2 ? visualConfig.lighting.hemisphereIntensity : 1.35));
    const sun = new THREE.DirectionalLight(visualV2 ? visualConfig.lighting.sun : '#ffe2c3', visualV2 ? visualConfig.lighting.sunIntensity : 3.6);
    sunRef.current=sun;
    sun.position.set(-55, 90, 40); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
    const shadowHalf = visualV2 ? visualConfig.lighting.shadowRange : 42, shadowSize = visualV2 && quality === 'low' ? 1024 : visualV2 ? visualConfig.lighting.shadowSize : 1536;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.camera.left = -shadowHalf; sun.shadow.camera.right = shadowHalf; sun.shadow.camera.top = shadowHalf; sun.shadow.camera.bottom = -shadowHalf;
    sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);
    const fill = new THREE.AmbientLight('#aebdce', 0.23); scene.add(fill);

    const terrainGeo = new THREE.PlaneGeometry(visualConfig.terrain.widthM, visualConfig.terrain.widthM, visualConfig.terrain.segments, visualConfig.terrain.segments);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
      pos.setY(i, h);
    }
    terrainGeo.computeVertexNormals();
    const normals = terrainGeo.attributes.normal as THREE.BufferAttribute;
    const basalt = new THREE.Color('#604641'), rust = new THREE.Color('#a85b40'), sand = new THREE.Color('#cf8a60'), dustTint = new THREE.Color('#e1aa7f');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), slope = 1 - normals.getY(i), noise = geologyAt(x, z);
      const c = basalt.clone().lerp(rust, THREE.MathUtils.clamp((h + 5.5) / 5 + noise * 0.16, 0.08, 0.92));
      c.lerp(sand, THREE.MathUtils.clamp((h + noise * 1.3 - 0.5) / 7, 0, 0.42));
      c.lerp(dustTint, THREE.MathUtils.clamp((slope - 0.12) * 1.4, 0, 0.24));
      const mineral = (noise + 1) * 0.009;
      colors.push(c.r + mineral, c.g + mineral * 0.55, c.b + mineral * 0.32);
    }
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const groundTexture = visualV2 ? createMarsGroundTexture() : makeGroundTexture();
    const ground = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTexture, bumpMap: groundTexture, bumpScale: visualV2 ? 0.008 : 0.035, roughness: 0.97, metalness: 0.01 }));
    ground.receiveShadow = true; scene.add(ground);

    // Angular mountain ridges and mesas fade into the horizon haze.
    const rand = seeded(4201);
    const ridgeMats = ['#795044', '#8a5948', '#9a654f'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    if (visualV2) addDistantRidges(scene);
    else for (let i = 0; i < 42; i++) {
      const radius = 15 + rand() * 17, height = 9 + rand() * 22;
      const angle = (i / 42) * Math.PI * 2 + (rand() - 0.5) * 0.12;
      const range = 170 + rand() * 34;
      const x = Math.sin(angle) * range, z = Math.cos(angle) * range;
      const mountain = new THREE.Mesh(makeMesaGeometry(radius, height, 7800 + i * 17), ridgeMats[i % ridgeMats.length]);
      mountain.position.set(x, heightAt(x, z) - 0.5, z);
      mountain.scale.set(1.15 + rand() * 0.8, 0.72 + rand() * 0.7, 0.75 + rand() * 0.7);
      mountain.rotation.y = rand() * Math.PI; mountain.castShadow = false; scene.add(mountain);
    }
    const outcropMaterials = ['#86513f', '#a1674a', '#754b43', '#bc7b56'];
    for (const [index, [x, z]] of [[-92, -36], [78, -64], [92, 86]].entries()) {
      const outcrop = makeLayeredOutcrop(9300 + index * 41, outcropMaterials);
      outcrop.position.set(x, heightAt(x, z) - 0.3, z); scene.add(outcrop);
    }
    if (visualV2) addLakebedOutcrop(scene, -14, 4);

    // Three weathered basalt variants share instancing to keep the draw cost low.
    const rockGeos = visualV2 ? createRockLibrary() : [new THREE.IcosahedronGeometry(1, 2), new THREE.IcosahedronGeometry(1, 3), new THREE.DodecahedronGeometry(1, 2)];
    rockGeos.forEach((geometry, variant) => {
      if (visualV2) return;
      const attr = geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(attr, i);
        const roughness = 0.93 + rand() * 0.14;
        v.multiplyScalar(roughness); v.y *= 0.82 + (variant * 0.07);
        attr.setXYZ(i, v.x, v.y, v.z);
      }
      geometry.computeVertexNormals();
    });
    const rockColors = visualV2 ? ['#5E4636', '#A8825F', '#725344', '#8C674F', '#62493B', '#977154'] : ['#63453b', '#765344', '#8c5b43'];
    const rockMats = rockColors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0.02, flatShading: visualV2 }));
    const rockCapacity = visualV2 ? visualConfig.rocks.boulderCapacity : 64;
    const rocks = rockGeos.map((geometry, i) => new THREE.InstancedMesh(geometry, rockMats[i], rockCapacity));
    rockMeshesRef.current=rocks;rockBaseCountsRef.current=rocks.map(()=>0);
    rocks.forEach((mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); });
    const dummy = new THREE.Object3D();
    const obstaclePositions: { x: number; z: number; r: number }[] = [];
    const rockCounts = rockGeos.map(() => 0);
    const rockClusters: Array<[number, number, number]> = [[-92, -52, 17], [64, -66, 18], [-112, 68, 16], [92, 80, 20], [118, -4, 15], [-132, -112, 15], [14, -126, 16], [138, 125, 14], [78, 20, 14], ...visualV2 ? [[-145, 4, 12], [142, -119, 14], [-48, -130, 16], [5, 145, 12], [126, 72, 16], [-137, -23, 13], [33, 108, 15], [-68, 121, 14], [143, 28, 12]] as Array<[number, number, number]> : []];
    let rockIndex = 0;
    const addRock = (centerX: number, centerZ: number, spread: number) => {
      let x = centerX, z = centerZ, placed = false;
      for (let attempt = 0; attempt < 18 && !placed; attempt++) {
        const angle = rand() * Math.PI * 2, radius = Math.sqrt(rand()) * spread;
        x = THREE.MathUtils.clamp(centerX + Math.cos(angle) * radius, -145, 145);
        z = THREE.MathUtils.clamp(centerZ + Math.sin(angle) * radius, -145, 145);
        const onMainRoute = pointSegmentDistance(x, z, -18, 12, -18, -88) < 10;
        const nearOutcrop = [[-92, -36], [78, -64], [92, 86]].some(([ox, oz]) => Math.hypot(x - ox, z - oz) < 13);
        const nearScienceSite = SCIENCE_TARGETS.some((target) => Math.hypot(x - target.x, z - target.z) < 13);
        const path=routeGeometry(site);
        const onSafeDetour=campaignMode&&(pointSegmentDistance(x,z,...path.a,...path.via)<8||pointSegmentDistance(x,z,...path.via,...path.b)<8);
        placed = !onMainRoute && !nearOutcrop && !nearScienceSite && !onSafeDetour;
      }
      if (!placed) return;
      const scale = visualV2 ? 0.08 + Math.pow(rand(), 2.8) * 2.12 : 0.45 + rand() * 1.6;
      const scaleY = scale * (0.55 + rand() * 0.6);
      dummy.position.set(x, heightAt(x, z) + (visualV2 ? scaleY * 0.74 : scale * 0.52), z);
      dummy.scale.set(scale * (0.75 + rand() * 0.65), scaleY, scale);
      dummy.rotation.set(rand() * 0.3, rand() * 6, rand() * 0.3); dummy.updateMatrix();
      const kind = rockIndex % rocks.length, localIndex = rockCounts[kind]++;
      rocks[kind].setMatrixAt(localIndex, dummy.matrix);
      const tint = 0.88 + rand() * 0.18; rocks[kind].setColorAt(localIndex, new THREE.Color(tint, tint * (0.96 + rand() * 0.06), tint * (0.91 + rand() * 0.08)));
      if (!visualV2 || scale >= 0.25) obstaclePositions.push({ x, z, r: scale * 1.05 });
      rockIndex++;
    };
    for (const [centerX, centerZ, spread] of rockClusters) {
      const clusterCount = visualV2 ? 42 + Math.floor(rand() * 14) : 13 + Math.floor(rand() * 7);
      for (let i = 0; i < clusterCount; i++) addRock(centerX, centerZ, spread);
    }
    rocks.forEach((mesh, index) => { mesh.count = rockCounts[index]; mesh.instanceMatrix.needsUpdate = true; });
    rockBaseCountsRef.current=[...rockCounts];
    rocks.forEach((mesh) => { if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; });
    if (visualV2) pebbleRef.current=addPebbleField(scene);

    const rover = new THREE.Group(); rover.name = 'ARES01_Root'; scene.add(rover);
    const chassis = new THREE.Group(); chassis.name = 'Chassis'; rover.add(chassis);
    const bodyMat = new THREE.MeshStandardMaterial({ color: visualV2 ? '#D8D6D0' : '#d8d1c5', metalness: visualV2 ? 0.1 : 0.26, roughness: visualV2 ? 0.55 : 0.58 });
    const darkMat = new THREE.MeshStandardMaterial({ color: visualV2 ? '#3A3D42' : '#252d35', metalness: visualV2 ? 0.8 : 0.64, roughness: visualV2 ? 0.5 : 0.38 });
    const goldMat = new THREE.MeshStandardMaterial({ color: visualV2 ? '#C98A2B' : '#c39758', metalness: visualV2 ? 0.4 : 0.72, roughness: visualV2 ? 0.35 : 0.34 });
    const instrumentMat = new THREE.MeshStandardMaterial({ color: '#587a78', metalness: 0.48, roughness: 0.38, emissive: '#173936', emissiveIntensity: 0.14 });
    const tireCanvas = document.createElement('canvas'); tireCanvas.width = 384; tireCanvas.height = 96;
    const tireContext = tireCanvas.getContext('2d');
    if (tireContext) {
      tireContext.fillStyle = '#272b2d'; tireContext.fillRect(0, 0, 384, 96);
      tireContext.strokeStyle = '#414548'; tireContext.lineWidth = 4;
      for (let i = -96; i < 480; i += 24) {
        tireContext.beginPath(); tireContext.moveTo(i, 0); tireContext.lineTo(i + 42, 48); tireContext.lineTo(i, 96); tireContext.stroke();
      }
      tireContext.strokeStyle = 'rgba(12,14,15,.7)'; tireContext.lineWidth = 2;
      for (let y = 9; y < 96; y += 16) { tireContext.beginPath(); tireContext.moveTo(0, y); tireContext.lineTo(384, y); tireContext.stroke(); }
    }
    const tireTexture = new THREE.CanvasTexture(tireCanvas); tireTexture.wrapS = THREE.RepeatWrapping; tireTexture.colorSpace = THREE.SRGBColorSpace;
    const rubberMat = new THREE.MeshStandardMaterial({ color: '#8a8980', map: tireTexture, bumpMap: tireTexture, bumpScale: 0.018, metalness: 0.02, roughness: 0.96 });
    const steelMat = new THREE.MeshStandardMaterial({ color: visualV2 ? '#B9BDC2' : '#adb5ba', metalness: 0.9, roughness: visualV2 ? 0.45 : 0.3 });
    const panelMat = new THREE.MeshStandardMaterial({ color: '#16384c', metalness: 0.62, roughness: 0.28, emissive: '#06202d', emissiveIntensity: 0.08 });
    const box = (parent: THREE.Object3D, sx: number, sy: number, sz: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const belly = roundedDeck(visualV2 ? visualConfig.rover.bodyWidthM : 2.35, visualConfig.rover.bodyHeightM, visualV2 ? visualConfig.rover.bodyLengthM : 3.2, bodyMat); belly.position.y = visualV2 ? 0.92 : 1.2; belly.castShadow = true; belly.receiveShadow = true; chassis.add(belly);
    const deck = roundedDeck(visualV2 ? 1.08 : 1.95, 0.11, visualV2 ? 1.8 : 2.92, goldMat); deck.position.y = visualV2 ? 1.55 : 1.83; deck.castShadow = true; chassis.add(deck);
    box(chassis, visualV2 ? 0.88 : 1.55, 0.22, visualV2 ? 1.38 : 1.75, darkMat, 0, visualV2 ? 0.76 : 1.06, 0.05);
    // Exposed frame rails and instrument bays break up the broad rover silhouette.
    for (const side of [-1, 1]) {
      box(chassis, 0.095, 0.12, visualV2 ? 1.72 : 2.85, steelMat, side * (visualV2 ? 0.57 : 1.12), visualV2 ? 1.59 : 1.86, 0);
      for (const z of [-0.72, -0.2, 0.32, 0.84]) {
        const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.48, 8), darkMat);
        vent.rotation.z = Math.PI / 2; vent.position.set(side * (visualV2 ? 0.48 : 1.02), visualV2 ? 1.3 : 1.57, z * (visualV2 ? 0.62 : 1)); chassis.add(vent);
      }
    }
    // Camera mast with paired sapphire optics and protective sensor brow.
    const mast = new THREE.Group(); mast.name = 'Mast_Pan'; mast.position.set(0, visualV2 ? 1.48 : 1.9, -0.72); chassis.add(mast);
    const mastPost = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.11, visualV2 ? 0.52 : 1.32, 12), steelMat); mastPost.position.y = visualV2 ? 0.26 : 0.66; mast.add(mastPost);
    const cameraHead = new THREE.Group(); cameraHead.name = 'Mast_Tilt'; cameraHead.position.y = visualV2 ? 0.52 : 1.28; mast.add(cameraHead);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.5, 0.46), bodyMat); head.castShadow = true; cameraHead.add(head);
    box(cameraHead, 0.72, 0.3, 0.055, darkMat, 0, -0.02, -0.245);
    const lensMat = new THREE.MeshPhysicalMaterial({ color: visualV2 ? '#0B1118' : '#42d9e8', emissive: visualV2 ? '#07151c' : '#116a78', emissiveIntensity: visualV2 ? 0.08 : 0.42, metalness: visualV2 ? 0 : 0.5, roughness: visualV2 ? 0.05 : 0.12, clearcoat: 1 });
    for (const x of [-0.24, 0.24]) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), lensMat); lens.position.set(x, -0.02, -0.29); cameraHead.add(lens);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 8, 28), goldMat); rim.position.copy(lens.position); cameraHead.add(rim);
    }
    if(config.instruments.includes('mastcam-z')) for(const x of [-.12,.12]) { const cam=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.14,18),goldMat);cam.rotation.x=Math.PI/2;cam.position.set(x,.24,-.32);cameraHead.add(cam); }
    else if (visualV2) for(const x of [-.12,.12]) box(cameraHead,.13,.13,.08,darkMat,x,.24,-.32);
    if(config.instruments.includes('supercam')) { const sc=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,.14,24),goldMat);sc.rotation.x=Math.PI/2;sc.position.set(0,-.18,-.3);cameraHead.add(sc); }
    else if (visualV2) box(cameraHead,.2,.14,.08,darkMat,0,-.18,-.3);
    box(cameraHead, 1.02, 0.07, 0.16, goldMat, 0, 0.28, -0.16);
    box(cameraHead, 0.18, 0.07, 0.13, darkMat, 0, -0.18, -0.24);

    // Articulated high-gain dish and receiver above the rear equipment deck.
    const antenna = new THREE.Group(); antenna.name = 'HGA_Pan'; antenna.position.set(-0.72, 1.98, 0.88); chassis.add(antenna);
    const dishProfile = [new THREE.Vector2(0.02, 0), new THREE.Vector2(0.21, 0.025), new THREE.Vector2(0.4, 0.09), new THREE.Vector2(0.48, 0.17)];
    const dish = new THREE.Mesh(visualV2 ? new THREE.CylinderGeometry(0.42, 0.42, 0.045, 6) : new THREE.LatheGeometry(dishProfile, 40), steelMat); if(visualV2){dish.rotation.x=Math.PI/2;dish.position.y=.22;}else dish.rotation.x = Math.PI / 2; dish.castShadow = true; antenna.add(dish);
    beamBetween(antenna, new THREE.Vector3(0, 0.08, -0.02), new THREE.Vector3(0, 0.48, -0.28), 0.025, goldMat);
    const feed = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), darkMat); feed.position.set(0, 0.48, -0.28); antenna.add(feed);
    const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.48, 10), steelMat); antennaStem.position.y = -0.22; antenna.add(antennaStem);

    // Compact radioisotope generator and heat-rejection fins at the aft deck.
    const generator = new THREE.Group(); generator.position.set(0.55, 1.47, 1.34); chassis.add(generator);
    const rtgBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.82, 24), darkMat); rtgBody.rotation.z = Math.PI / 2; generator.add(rtgBody);
    for (let i = 0; i < (visualV2 ? 8 : 9); i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.72, 0.12), visualV2 ? darkMat : steelMat);
      fin.position.set((i - (visualV2 ? 3.5 : 4)) * 0.082, 0, 0.26); fin.castShadow = true; generator.add(fin);
    }
    const rtgCap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), goldMat); rtgCap.rotation.z = Math.PI / 2; rtgCap.position.x = 0.45; generator.add(rtgCap);
    const batteryCapacity = 2408;
    const batteryModule = box(chassis, 0.58, 0.28, 0.48, darkMat, 0.78, 2.0, 0.02);
    batteryModule.scale.setScalar(THREE.MathUtils.clamp(0.78 + batteryCapacity / 5000, 0.86, 1.18));
    box(chassis, 0.34, 0.12, 0.04, instrumentMat, 0.78, 2.16, -0.23);

    // Twin solar wings: blue cell glass, fine bus bars and metallic perimeter rails.
    const solarScale = 1;
    if(!visualV2) for (const side of [-1, 1]) {
      const panel = new THREE.Group(); panel.position.set(side * 2.02, 1.78, 0.04); chassis.add(panel); panel.visible = false;
      panel.scale.x = solarScale;
      box(panel, 1.36, 0.065, 2.62, darkMat, 0, 0, 0);
      box(panel, 1.25, 0.025, 2.49, panelMat, 0, 0.044, 0);
      const linePositions: number[] = [];
      for (let i = -2; i <= 2; i++) { const x = i * 0.205; linePositions.push(x, 0.061, -1.22, x, 0.061, 1.22); }
      for (let i = -4; i <= 4; i++) { const z = i * 0.27; linePositions.push(-0.61, 0.061, z, 0.61, 0.061, z); }
      const gridGeometry = new THREE.BufferGeometry(); gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      panel.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: '#81a3ac', transparent: true, opacity: 0.66 })));
      for (const x of [-0.67, 0.67]) box(panel, 0.045, 0.07, 2.7, goldMat, x, 0, 0);
      for (const z of [-1.32, 1.32]) box(panel, 1.34, 0.07, 0.045, goldMat, 0, 0, z);
      beamBetween(chassis, new THREE.Vector3(side * 1.13, 1.68, 0.88), new THREE.Vector3(side * 1.68, 1.76, 0.88), 0.035, steelMat);
    }
    // Forward robotic arm has visible shoulders, elbow, wrist and drill cartridge.
    const arm = new THREE.Group(); arm.name = 'Arm_J1_Yaw'; arm.position.set(0.85, 1.58, -1.25); chassis.add(arm);
    const armJoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.46, -0.18, -0.32), new THREE.Vector3(0.58, -0.72, -0.6), new THREE.Vector3(0.34, -1.02, -0.76)];
    for (let i = 0; i < armJoints.length - 1; i++) beamBetween(arm, armJoints[i], armJoints[i + 1], i === 0 ? 0.12 : 0.075, i === 1 ? goldMat : steelMat);
    for (const point of armJoints.slice(1)) { const joint = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), goldMat); joint.position.copy(point); joint.castShadow = true; arm.add(joint); }
    const turret = new THREE.Group(); turret.name = 'Turret'; turret.position.copy(armJoints[3]); arm.add(turret);
    const toolMount = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.12, 12), darkMat); turret.add(toolMount);
    const drill = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.035, 0.42, 12), steelMat); drill.position.y = -0.25; turret.add(drill);
    const drillTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 10), goldMat); drillTip.position.y = -0.52; turret.add(drillTip);
    const samplePort = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 18), goldMat); samplePort.position.set(-0.2, -0.04, 0.06); turret.add(samplePort);
    drill.visible = config.instruments.includes('sherloc');
    drillTip.visible = config.instruments.includes('sherloc');
    // PIXL's arm-mounted X-ray spectrometer is shown beside the shared turret.
    if (config.instruments.includes('pixl')) {
      const pixl = new THREE.Group(); pixl.name = 'Configured_PIXL'; pixl.position.set(0.18, -0.02, 0.14); turret.add(pixl);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.27), instrumentMat); housing.castShadow = true; pixl.add(housing);
      const aperture = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.12, 16), goldMat); aperture.rotation.x = Math.PI / 2; aperture.position.set(0, -0.08, -0.17); pixl.add(aperture);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), lensMat); lens.position.copy(aperture.position).add(new THREE.Vector3(0, 0, -0.06)); pixl.add(lens);
    } else if (visualV2) box(turret,0.24,0.16,0.2,darkMat,.18,-.02,.14);
    if (config.instruments.includes('meda')) {
      const weatherMast = new THREE.Group(); weatherMast.position.set(-0.94, 1.92, 0.18); chassis.add(weatherMast);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.42, 8), steelMat); stem.position.y = 0.21; weatherMast.add(stem);
      const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8), instrumentMat); sensor.position.y = 0.45; weatherMast.add(sensor);
      for (const side of [-1, 1]) { const vane = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.04), goldMat); vane.position.set(side * 0.12, 0.45, 0); weatherMast.add(vane); }
    } else if(visualV2) { const emptyMeda=box(chassis,.07,.3,.07,darkMat,-.5,1.7,.15);emptyMeda.name='Empty_MEDa_Mount'; }
    if (config.instruments.includes('supercam')) {
      const spectrometer = box(chassis, 0.36, 0.24, 0.34, instrumentMat, -0.56, 2.0, -0.12);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 16), lensMat); lens.rotation.x = Math.PI / 2; lens.position.set(-0.56, 2.02, -0.31); chassis.add(lens);
      spectrometer.name = 'Configured_Spectrometer';
    }
    if (config.instruments.includes('rimfax')) {
      const radar = box(chassis, 0.9, 0.08, 0.55, instrumentMat, 0, 0.52, 0.22); radar.name = 'Configured_Ground_Radar';
    } else if(visualV2) { const mount=box(chassis,.58,.05,.36,darkMat,0,.5,.22);mount.name='Empty_RIMFAX_Mount'; }
    if (config.instruments.includes('moxie')&&!visualV2) {
      const analyzer = box(chassis, 0.38, 0.25, 0.36, goldMat, 0.25, 2.0, -0.12); analyzer.name = 'Configured_Biosignature_Analyzer';
    } else if(visualV2){const glow=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:config.moxieRun?'#f7ad4f':'#48423a'}));glow.position.set(.25,1.15,-.12);glow.name='MOXIE_Run_Status_Light';chassis.add(glow);}

    // Rocker-bogie profile, steering knuckles and individually spinning lugged wheels.
    const wheels: THREE.Mesh[] = [], steerPivots: { pivot: THREE.Group; side: number }[] = [];
    const wheelPivots: { pivot: THREE.Group; x: number; z: number }[] = [];
    const wheelRadius=visualV2?visualConfig.rover.wheelRadiusM:0.52;
    const wheelCenterY=visualV2?visualConfig.rover.wheelGroundOffsetM:0.58;
    const tireGeo = makeTireGeometry(wheelRadius,visualV2?visualConfig.rover.wheelWidthM:0.4);
    const grouserMat=new THREE.MeshStandardMaterial({color:'#8b9195',metalness:.62,roughness:.48});
    for (const side of [-1, 1]) {
      const x = side * 1.16;
      beamBetween(chassis, new THREE.Vector3(side * 0.82, 1.1, -0.18), new THREE.Vector3(x, 0.73, -1.15), 0.115, steelMat);
      beamBetween(chassis, new THREE.Vector3(side * 0.82, 1.1, -0.18), new THREE.Vector3(side * 0.94, 0.69, 0.62), 0.11, goldMat);
      beamBetween(chassis, new THREE.Vector3(side * 0.94, 0.69, 0.62), new THREE.Vector3(x, 0.7, 1.15), 0.095, steelMat);
      beamBetween(chassis, new THREE.Vector3(side * 0.82, 1.04, -0.18), new THREE.Vector3(side * 0.82, 1.04, 0.18), 0.16, darkMat);
      for (const [axleIndex, axle] of [-1, 0, 1].entries()) {
        const pivot = new THREE.Group(); pivot.name = axleIndex === 0 ? `Bogey_${side < 0 ? 'L' : 'R'}_Wheel` : `Steer_${axleIndex === 0 ? 'M' : axle < 0 ? 'F' : 'R'}${side < 0 ? 'L' : 'R'}`;
        pivot.position.set(x, wheelCenterY, axle * 1.15); rover.add(pivot);
        if (axleIndex !== 0) steerPivots.push({ pivot, side });
        wheelPivots.push({ pivot, x, z: axle * 1.15 });
        const wheel = new THREE.Mesh(tireGeo, rubberMat); wheel.name = `Wheel_${axle < 0 ? 'F' : axle > 0 ? 'R' : 'M'}${side < 0 ? 'L' : 'R'}`; wheel.castShadow = false; wheel.receiveShadow = false; pivot.add(wheel); wheels.push(wheel); if(visualV2)addInstancedGrousers(wheel,grouserMat);
        for (const face of [-1, 1]) {
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(visualV2?0.12:0.235, visualV2?0.12:0.235, visualV2?0.19:0.39, 24), darkMat); hub.rotation.z = Math.PI / 2; hub.position.x = face * 0.015; pivot.add(hub);
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(visualV2?0.082:0.16, visualV2?0.082:0.16, visualV2?0.205:0.405, 20), goldMat); cap.rotation.z = Math.PI / 2; cap.position.x = face * 0.02; pivot.add(cap);
          const lip = new THREE.Mesh(new THREE.TorusGeometry(visualV2?0.148:0.31, visualV2?0.014:0.025, 8, 28), steelMat); lip.rotation.y = Math.PI / 2; lip.position.x = face * (visualV2?0.1:0.205); pivot.add(lip);
        }
        const axleRod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, visualV2?0.3:0.62, 10), goldMat); axleRod.rotation.z = Math.PI / 2; pivot.add(axleRod);
      }
    }
    // The M2020 rover platform and all three antenna assemblies are fixed.
    rover.position.set(savedProgress.x, heightAt(savedProgress.x, savedProgress.z) + (visualV2 ? 0.01 : 0.03), savedProgress.z);
    rover.rotation.y=savedProgress.heading;

    if(campaignMode&&!preview){const route=routeGeometry(site);const barrier=new THREE.Mesh(new THREE.BoxGeometry(16,siteRules.obstacle,2.4),new THREE.MeshStandardMaterial({color:'#724c42',roughness:1}));barrier.position.set(route.midpoint[0],heightAt(...route.midpoint)+siteRules.obstacle/2,route.midpoint[1]);barrier.rotation.y=Math.atan2(-route.side[1],route.side[0]);barrier.name='Scenario_E1_Barrier';scene.add(barrier);
      const path=new THREE.BufferGeometry().setFromPoints([route.a,route.via,route.b].map(([x,z])=>new THREE.Vector3(x,heightAt(x,z)+.09,z)));scene.add(new THREE.Line(path,new THREE.LineBasicMaterial({color:'#e9ab67'})));}
    const beacons = preview ? [] : SCIENCE_TARGETS.map((target, index) => {
      const beacon = new THREE.Group(); beacon.position.set(target.x, heightAt(target.x, target.z) + 0.1, target.z); scene.add(beacon);
      const rockMat = new THREE.MeshStandardMaterial({ color: ['#a78e78', '#594740', '#bd7950'][index%3], roughness: 0.92, flatShading: true, emissive: '#163d42', emissiveIntensity: 0 });
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(index === 0 ? 1.05 : 1.35, 1), rockMat);
      rock.position.y = index === 0 ? 0.8 : 1; rock.scale.set(1.2, 0.8, 1); rock.castShadow = true; beacon.add(rock);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(visualV2?visualConfig.beacon.ringRadiusM:2.8, visualV2?0.045:0.055, 8, 64), new THREE.MeshBasicMaterial({ color: '#56e3ea', fog: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; beacon.add(ring);
      const ring2 = visualV2 ? new THREE.Mesh(new THREE.TorusGeometry(visualConfig.beacon.ringRadiusM*1.18,.025,6,64),new THREE.MeshBasicMaterial({color:'#9bf6fa',transparent:true,opacity:.72,fog:false})) : null;
      if(ring2){ring2.rotation.x=Math.PI/2;ring2.position.y=.13;beacon.add(ring2);}
      const pillar = visualV2 ? createBeaconColumn() : new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 4, 8), new THREE.MeshBasicMaterial({ color: '#5cebf3', transparent: true, opacity: 0.68 }));
      if(!visualV2)pillar.position.y=3;beacon.add(pillar);
      return { target, beacon, rock, rockMat, ring, ring2, pillar };
    });

    const trackTrail=visualV2&&!preview?createWheelTracks():null;if(trackTrail)scene.add(trackTrail.mesh);
    const wheelDust=visualV2&&!preview?createWheelDust():null;if(wheelDust)scene.add(wheelDust.points);
    const scanBeam=visualV2&&!preview?new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,1,7),new THREE.MeshBasicMaterial({color:'#5cebf3',transparent:true,opacity:.62,depthWrite:false})):null;
    if(scanBeam){scanBeam.visible=false;scanBeam.name='Instrument_To_Target_Scan_Beam';scene.add(scanBeam);}
    const contactShadow=visualV2?(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');if(ctx){const g=ctx.createRadialGradient(64,64,2,64,64,62);g.addColorStop(0,'rgba(32,20,17,.48)');g.addColorStop(.5,'rgba(32,20,17,.2)');g.addColorStop(1,'rgba(32,20,17,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);}const tex=new THREE.CanvasTexture(canvas);const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:.82});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.6,3.5),mat);mesh.rotation.x=-Math.PI/2;mesh.position.set(rover.position.x,heightAt(rover.position.x,rover.position.z)+.012,rover.position.z);mesh.name='Soft_Rover_Contact_Shadow';scene.add(mesh);return mesh;})():null;

    const skyGeometry = new THREE.SphereGeometry(420, 48, 28);
    const skyPositions = skyGeometry.attributes.position as THREE.BufferAttribute;
    const zenith = new THREE.Color('#664553'), haze = new THREE.Color('#c18468'), horizon = new THREE.Color('#dfa27b');
    const skyColors: number[] = [];
    for (let i = 0; i < skyPositions.count; i++) {
      const vertical = skyPositions.getY(i) / 420;
      const color = vertical > 0.08 ? haze.clone().lerp(zenith, THREE.MathUtils.smoothstep(vertical, 0.08, 0.8)) : haze.clone().lerp(horizon, THREE.MathUtils.smoothstep(-vertical, 0, 0.45));
      skyColors.push(color.r, color.g, color.b);
    }
    skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    const sky = new THREE.Mesh(skyGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })); scene.add(sky);
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 20), new THREE.MeshBasicMaterial({ color: '#fff0d6' }));
    sunDisc.position.set(-115, 74, -205); scene.add(sunDisc);
    const sunHalo = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 20), new THREE.MeshBasicMaterial({ color: '#f1a879', transparent: true, opacity: 0.12, depthWrite: false }));
    sunHalo.position.copy(sunDisc.position); scene.add(sunHalo);

    // Small suspended dust catches the light without competing with the terrain.
    const dustCount = 220, dustPositions: number[] = [];
    for (let i = 0; i < dustCount; i++) dustPositions.push((rand() - 0.5) * 26, 0.15 + rand() * 5.5, (rand() - 0.5) * 26);
    const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    const dustCanvas = document.createElement('canvas'); dustCanvas.width = 64; dustCanvas.height = 64;
    const dustContext = dustCanvas.getContext('2d');
    if (dustContext) { const grad = dustContext.createRadialGradient(32, 32, 0, 32, 32, 30); grad.addColorStop(0, 'rgba(255,238,219,.85)'); grad.addColorStop(1, 'rgba(255,210,174,0)'); dustContext.fillStyle = grad; dustContext.fillRect(0, 0, 64, 64); }
    const dustTexture = new THREE.CanvasTexture(dustCanvas);
    const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#f6d0ac', map: dustTexture, size: 0.24, transparent: true, opacity: 0.22, depthWrite: false, sizeAttenuation: true })); scene.add(dust);

    let yaw = cameraView.current.yaw, yawTarget = cameraView.current.yaw, pitch = cameraView.current.pitch, pitchTarget = cameraView.current.pitch;
    if (preview && !previewZoomInitialized.current) { cameraView.current.zoom = 5.5; previewZoomInitialized.current = true; }
    const minZoom=preview?3.5:visualV2?visualConfig.camera.minDistance:5.5,maxZoom=visualV2?visualConfig.camera.maxDistance:18;
    let zoom = THREE.MathUtils.clamp(cameraView.current.zoom, minZoom, maxZoom), zoomTarget = zoom, speed = 0, heading = savedProgress.heading, scanProgress = 0, lastHud = 0, elapsed = (savedProgress.sol-1)*90, distance = savedProgress.distance, battery = savedProgress.battery, collisionUntil = 0, lastScanRequest = 0, scanNotice = '', scanStatusNearby: string | null = null, lastCampaignSave=elapsed;
    // Stop immediately at control boundaries, even if pause/resume or
    // review/commit both happen between rendered frames. Never clear held input
    // on ordinary per-segment energy updates.
    const stopControls = () => { speed=0; keys.current.clear(); };
    const unsubscribePhase=useMarsStore.subscribe((state,previous)=>{if(state.phase!==previous.phase)stopControls();});
    const unsubscribeCampaign=useGameStore.subscribe((state,previous)=>{
      if(state.missionPhase!==previous.missionPhase||state.campaign?.sol!==previous.campaign?.sol||state.campaign?.mode!==previous.campaign?.mode||state.campaign?.safe!==previous.campaign?.safe||state.campaign?.mobilityDisabled!==previous.campaign?.mobilityDisabled||(!state.campaign&&state.missionRecord?.safeMode!==previous.missionRecord?.safeMode))stopControls();
    });
    let framePending=true,lastPresentation='';
    let dragging = false, lastX = 0, lastY = 0, disposed = false,lastDebugUpdate=0;
    let importedRover: ImportedRover | null = null;
    const fallbackParts = [...rover.children];
    let loadController: AbortController | undefined, generation = 0, awaitingModelRender = false;
    const loadRover = () => {
      const attempt = ++generation;
      loadController?.abort();
      loadController = new AbortController();
      setModelProgress({ phase: 'waiting' });
      void createRoverModel(config.instruments, { signal: loadController.signal, onProgress: progress => {
        if (!disposed && attempt === generation) setModelProgress(progress);
      } }).then(asset => {
        if (disposed || attempt !== generation) { asset.dispose(); return; }
        importedRover = asset;
        fallbackParts.forEach(part => { part.visible = false; });
        rover.add(asset.root);
        awaitingModelRender = true;
      }).catch(error => {
        if (!disposed && attempt === generation && !isModelAbort(error)) {
          console.warn('Rover model unavailable; using procedural rover.', error);
          setModelProgress(modelFailure(error));
        }
      });
    };
    retryModel.current = loadRover;
    loadRover();
    const debugOverlay=visualV2&&new URLSearchParams(window.location.search).has('debug')?document.createElement('div'):null;
    if(debugOverlay){debugOverlay.className='mars-visual-debug';root.appendChild(debugOverlay);}
    let lastCameraInput=performance.now(),lastActivity=performance.now(),introStart=performance.now(),boostZoom=0,trackDistance=0,trackNext=0,trackUsed=0;
    const trackDummy=new THREE.Object3D(), trackWorld=new THREE.Vector3(), trackColor=new THREE.Color('#49352e');
    const lookTargetSmooth=rover.position.clone().add(new THREE.Vector3(0,visualV2?.9:1.6,0));
    const pointerDown = (e: PointerEvent) => { if (!preview) renderer.domElement.focus({preventScroll:true}); dragging = true; lastX = e.clientX; lastY = e.clientY; lastCameraInput=performance.now(); framePending=true; renderer.domElement.setPointerCapture(e.pointerId); };
    const pointerMove = (e: PointerEvent) => { if (!dragging) return; framePending=true; lastCameraInput=performance.now();yawTarget -= (e.clientX - lastX) * 0.006; pitchTarget = visualV2?THREE.MathUtils.clamp(pitchTarget + (e.clientY-lastY)*0.004,THREE.MathUtils.degToRad(visualConfig.camera.minElevation),THREE.MathUtils.degToRad(visualConfig.camera.maxElevation)):THREE.MathUtils.clamp(pitchTarget + (e.clientY - lastY) * 0.004, 0.08, 0.72); lastX = e.clientX; lastY = e.clientY; };
    const pointerUp = () => { dragging = false; framePending=true; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); framePending=true; lastCameraInput=performance.now();zoomTarget = THREE.MathUtils.clamp(zoomTarget + e.deltaY * (visualV2?0.02:0.012), minZoom, maxZoom); };
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointermove', pointerMove); renderer.domElement.addEventListener('pointerup', pointerUp); renderer.domElement.addEventListener('pointercancel', pointerUp); renderer.domElement.addEventListener('wheel', wheel);
    const resize = () => { if (!root) return; framePending=true; camera.aspect = root.clientWidth / root.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(root.clientWidth, root.clientHeight); };
    const observer = new ResizeObserver(resize); observer.observe(root);
    let prev = performance.now(), animationFrame = 0, motionBoundary = '';
    const animate = () => {
      if (disposed) return;
      animationFrame = requestAnimationFrame(animate);
      const now = performance.now(), dt = Math.min((now - prev) / 1000, 0.05); prev = now; elapsed += dt;
      let movedThisFrame=0, signedMovedThisFrame=0;
      const campaign=useGameStore.getState().campaign;
      const nextBoundary=`${campaign?.sol}/${campaign?.mode}/${useMarsStore.getState().phase}`;
      if(nextBoundary!==motionBoundary){speed=0;motionBoundary=nextBoundary;}
      if(campaign)battery=useGameStore.getState().missionProgress.battery;
      const presentation=campaign?`${campaign.sol}/${campaign.mode}/${useMarsStore.getState().phase}/${useMarsStore.getState().scannedTargets.join(',')}`:'';
      if(presentation!==lastPresentation){framePending=true;lastPresentation=presentation;beacons.forEach(({target,ring,pillar})=>{ring.visible=pillar.visible=!useMarsStore.getState().scannedTargets.includes(target.id)&&(!campaign||!('availableSol' in target)||Number(target.availableSol)<=campaign.sol);});}
      const active = !preview && useMarsStore.getState().phase === 'active' && (!campaign||campaign.mode==='operations');
      scanStatusNearby = null;
      const input = keys.current;
      if(input.size>0)lastActivity=now;
      if(visualV2&&!dragging&&Math.abs(speed)>.3&&now-lastCameraInput>visualConfig.camera.yawResumeMs){const yawHome=Math.atan2(Math.sin(-yawTarget),Math.cos(-yawTarget));yawTarget+=yawHome*(1-Math.exp(-dt*0.99));}
      if((!campaign||active)&&visualV2&&!dragging&&input.size===0&&now-lastActivity>visualConfig.camera.idleOrbitAfter*1000)yawTarget+=dt*Math.PI/60;
      const forward = input.has('w') || input.has('arrowup'), reverse = input.has('s') || input.has('arrowdown');
      const left = input.has('a') || input.has('arrowleft'), right = input.has('d') || input.has('arrowright');
      if (active) {
        const missionRecord=useGameStore.getState().missionRecord;
        // Campaign.safe is authoritative for canonical missions, including after
        // save restoration. The legacy duplicate record cannot lock a new sol.
        const safe = campaign ? campaign.safe : !!missionRecord?.safeMode;
        const driveAllowed = getDriveStatus(campaign).allowed && !safe;
        const braking = input.has(' ');
        const throttle = !driveAllowed || braking ? 0 : forward ? 1 : reverse ? -0.5 : 0;
        const topSpeed = input.has('shift') ? 8 : 4.5;
        speed += ((throttle * topSpeed) - speed) * Math.min(1, dt * (input.has(' ') ? 8 : throttle === 0 ? 1.8 : 3.2));
        if (braking) speed *= Math.max(0, 1 - dt * 2.8);
        if (!driveAllowed || (throttle === 0 && Math.abs(speed) < .02)) speed = 0;
        // In Three.js, positive Y rotation turns the rover's local -Z nose toward -X.
        // Keep steering, visible nose direction and travel vector on that same convention.
        if (driveAllowed) heading += ((left ? 1 : 0) - (right ? 1 : 0)) * dt * Math.min(1, Math.abs(speed) * 0.45 + 0.25);
        const dx = -Math.sin(heading) * speed * dt, dz = -Math.cos(heading) * speed * dt;
        const nx = rover.position.x + dx, nz = rover.position.z + dz;
        const slope = Math.abs(heightAt(nx, nz) - heightAt(rover.position.x, rover.position.z));
        const meters=Math.hypot(dx,dz);
        // Probe along actual travel, including reverse. Sampling the nose while
        // reversing can trap the rover against a steep slope it is leaving.
        const gradeProbe=2;const aheadX=nx+(meters>0?dx/meters:0)*gradeProbe,aheadZ=nz+(meters>0?dz/meters:0)*gradeProbe;const gradeAngle=slopeAngleDeg(heightAt(aheadX,aheadZ)-heightAt(nx,nz),gradeProbe);
        const steep=gradeAngle>(campaign?30:FIXED.slopeLimitDeg);
        if(!campaign&&steep&&forward){useGameStore.getState().raiseMissionEvent({id:'terrain-grade',kind:'mobility-limit',title:'Traverse exceeds operational tilt',trigger:`Local terrain estimate ${gradeAngle.toFixed(1)}° exceeds the ${FIXED.slopeLimitDeg}° operational driving limit.`,explanation:'Rover motion is blocked on this steep approach. Turn onto a gentler route and do not repeatedly attempt the grade.',model:'CALC/SIMPLIFIED: central 2 m height sample from procedural terrain, compared with the NASA-reported 24° updated operational driving limit. This is a local slope estimate, not flight terrain navigation software.',recoverable:true,status:'active',sol:Math.floor(elapsed/90)+1});}
        const hit = (campaignMode&&hazardContains(nx,nz,site)) || obstaclePositions.some((o) => Math.hypot(nx - o.x, nz - o.z) < o.r + 1.15);
        if (hit) collisionUntil = elapsed + 1.2;
        const boundary = Math.abs(nx) >= 153 || Math.abs(nz) >= 153;
        if (meters>0 && !boundary && !hit && slope < 0.9 && !steep) {
          const travelSign=Math.sign(speed);
          const before=useGameStore.getState().campaign;
          const after=before?traverse(before,meters,Math.atan2(heightAt(nx,nz)-heightAt(rover.position.x,rover.position.z),meters||1)*180/Math.PI,{from:[rover.position.x,rover.position.z],to:[nx,nz]}):null;
          const accepted=!before||!!after&&after.driveMeters>before.driveMeters;
          if(after&&after!==before)useGameStore.getState().setCampaign(after);
          if(accepted){const actual=before&&after?after.driveMeters-before.driveMeters:meters;const fraction=actual/meters;rover.position.x+=dx*fraction;rover.position.z+=dz*fraction;movedThisFrame=actual;signedMovedThisFrame=actual*travelSign;distance+=actual;useMarsStore.getState().setDriveContact(null);if(actual<meters-1e-10)speed=0;}
          else { speed=0; const status=getDriveStatus(after??before); if(status.allowed)useMarsStore.getState().setDriveContact({code:'energy',reason:after?.message||'This segment cannot be powered. Review the energy plan or wait/charge.'}); }
        }
        else if (meters>0) {
          speed=0;
          useMarsStore.getState().setDriveContact(boundary
            ? {code:'boundary',reason:'Mapped terrain boundary reached. Reverse or turn back into the mission area.'}
            : hit ? {code:'obstacle',reason:'Obstacle blocks this approach. Reverse or steer around it.'}
            : {code:'slope',reason:`Terrain approach exceeds the ${campaign?30:FIXED.slopeLimitDeg}° slope or step limit. Reverse or choose a gentler route.`});
        }
        rover.position.y = heightAt(rover.position.x, rover.position.z) + (visualV2 ? 0.01 : 0.03);
        rover.rotation.y = heading;
        wheels.forEach((w) => { w.rotation.x -= signedMovedThisFrame / wheelRadius; });
        const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
        steerPivots.forEach(({ pivot, side }) => { pivot.rotation.y += (steerInput * side * 0.34 - pivot.rotation.y) * Math.min(1, dt * 7); });
        const sampleHeight = (lx: number, lz: number) => { const p = rover.localToWorld(new THREE.Vector3(lx, 0, lz)); return heightAt(p.x, p.z); };
        const frontHeight = sampleHeight(0, -1.15), rearHeight = sampleHeight(0, 1.15);
        const leftHeight = sampleHeight(-1.16, 0), rightHeight = sampleHeight(1.16, 0);
        chassis.rotation.x += (THREE.MathUtils.clamp(Math.atan2(frontHeight - rearHeight, 2.3) * 0.48, -0.19, 0.19) - chassis.rotation.x) * Math.min(1, dt * 5);
        chassis.rotation.z += (THREE.MathUtils.clamp(Math.atan2(rightHeight - leftHeight, 2.32) * 0.42, -0.15, 0.15) - chassis.rotation.z) * Math.min(1, dt * 5);
        wheelPivots.forEach(({ pivot, x, z }) => {
          const p = rover.localToWorld(new THREE.Vector3(x, 0, z));
          const targetY = visualV2?THREE.MathUtils.clamp(wheelCenterY+heightAt(p.x,p.z)-rover.position.y,0.12,0.42):THREE.MathUtils.clamp(0.58 + heightAt(p.x, p.z) - rover.position.y, 0.42, 0.74);
          pivot.position.y += (targetY - pivot.position.y) * Math.min(1, dt * 9);
        });
        importedRover?.update(signedMovedThisFrame, driveAllowed ? (Number(left) - Number(right)) * .35 : 0, chassis.rotation.x, chassis.rotation.z);
        mast.rotation.y = Math.sin(elapsed * 0.32) * 0.08;
        const scanState = useMarsStore.getState();
        if(safe&&scanState.scanningTargetId){scanNotice='SAFE MODE · SCIENCE WORKLOAD SUSPENDED';useMarsStore.getState().cancelScan(scanNotice);scanProgress=0;}
        arm.rotation.x = scanState.scanningTargetId ? Math.sin(elapsed * 8) * 0.16 : 0;
        if(scanBeam){const activeEntry=scanState.scanningTargetId?beacons.find(entry=>entry.target.id===scanState.scanningTargetId):undefined;scanBeam.visible=!!activeEntry;if(activeEntry){const from=rover.localToWorld(new THREE.Vector3(.35,.78,-.95));const to=new THREE.Vector3(activeEntry.target.x,heightAt(activeEntry.target.x,activeEntry.target.z)+.8,activeEntry.target.z);const vector=to.sub(from);scanBeam.position.copy(from).addScaledVector(vector,.5);scanBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vector.clone().normalize());scanBeam.scale.y=vector.length();}}
        // New missions advance only executed physical activities, never rendering time.
        // Legacy saves retain their old live mode, with corrected EQ-8 efficiencies and no duplicate routine science load.
        if(!campaign){const hours=dt/3600;const result=integrateEnergy(battery/100*2408,{hours,generationW:rtgPowerW(),loadW:config.baselineW,extraLoadWh:driveEnergyWh(movedThisFrame,gradeAngle,(useGameStore.getState().confirmedMission?.results.massKg??FIXED.massKg))});battery=result.storedWh/2408*100;}
        if(campaign)useGameStore.getState().setMissionProgress({x:rover.position.x,z:rover.position.z,heading,distance});
        const availableTargets = beacons.filter(({ target }) => !scanState.scannedTargets.includes(target.id) && (!campaign || !('availableSol' in target) || Number(target.availableSol)<=campaign.sol));
        const candidateId=campaign?nearbyScienceTarget(useGameStore.getState().campaign!,rover.position.x,rover.position.z,availableTargets.map(e=>e.target.id)):undefined;
        const nearby = campaign?availableTargets.map(entry=>({...entry,distance:Math.hypot(rover.position.x-entry.target.x,rover.position.z-entry.target.z)})).find(entry=>entry.target.id===candidateId):availableTargets.map(entry=>({...entry,distance:Math.hypot(rover.position.x-entry.target.x,rover.position.z-entry.target.z)})).filter(entry=>entry.distance<=SCAN_RANGE).sort((a,b)=>a.distance-b.distance)[0];
        scanStatusNearby = nearby?.target.id ?? null;
        if (scanState.scanRequestId !== lastScanRequest) {
          lastScanRequest = scanState.scanRequestId;
          if (scanState.scanningTargetId) { scanNotice = 'SCAN ABORTED'; useMarsStore.getState().cancelScan(scanNotice); scanProgress = 0; }
          else if (safe) scanNotice = 'SAFE MODE · SCIENCE WORKLOAD SUSPENDED';
          else if (!nearby) scanNotice = 'MOVE CLOSER TO A SCIENCE TARGET';
          else if (campaign&&!targetReadiness(useGameStore.getState().campaign!,nearby.target.id).allowed)scanNotice=targetReadiness(useGameStore.getState().campaign!,nearby.target.id).reason;
          else if (!nearby.target.requiredInstruments.some(id=>config.instruments.includes(id))) scanNotice = `SCIENCE TARGET REQUIRES ${nearby.target.requiredInstruments.map(id=>INSTRUMENTS.find(i=>i.id===id)?.name).join(' / ').toUpperCase()}`;
          else if (!campaign && battery < (INSTRUMENTS.find(i=>i.id===nearby.target.requiredInstruments.find(id=>config.instruments.includes(id))!)!.powerW*INSTRUMENTS.find(i=>i.id===nearby.target.requiredInstruments.find(id=>config.instruments.includes(id))!)!.hours/2408*100)) scanNotice = 'INSUFFICIENT POWER TO SCAN';
          else { scanNotice = ''; useMarsStore.getState().beginScan(nearby.target.id); scanProgress = 0; }
        }
        const currentScan = useMarsStore.getState().scanningTargetId;
        const activeTarget = currentScan ? beacons.find((entry) => entry.target.id === currentScan) : undefined;
        if (activeTarget) {
          const targetDistance = Math.hypot(rover.position.x - activeTarget.target.x, rover.position.z - activeTarget.target.z);
          if (targetDistance > SCAN_RANGE + 1) { scanProgress = 0; scanNotice = 'SCAN LOST · RETURN TO TARGET'; useMarsStore.getState().cancelScan(scanNotice); }
          else if (Math.abs(speed) > 0.8) scanNotice = 'BRAKE TO SCAN';
          else {
            scanNotice = 'SPECTROMETER ANALYZING';
            scanProgress = Math.min(1, scanProgress + dt / activeTarget.target.duration);
            if (scanProgress >= 1) {
              const instrument=INSTRUMENTS.find(i=>i.id===activeTarget.target.requiredInstruments.find(id=>config.instruments.includes(id))!)!;
              const energyWh=campaign?0:instrument.powerW*instrument.hours;
              const energyPercent=energyWh/2408*100;
              const completed = useMarsStore.getState().completeScan(activeTarget.target.id, energyPercent, activeTarget.target.reward, activeTarget.target.discovery, battery, energyWh);
              if (completed) {
                battery = useMarsStore.getState().battery;
                scanNotice = useMarsStore.getState().scanMessage;
              }
              else { scanNotice = useGameStore.getState().campaign?.message||'INSUFFICIENT POWER TO SCAN'; useMarsStore.getState().cancelScan(scanNotice); }
              scanProgress = 0;
            }
          }
        } else {
          scanProgress = 0;
          if (!scanNotice || scanNotice === 'SPECTROMETER ANALYZING' || scanNotice === 'BRAKE TO SCAN') scanNotice = '';
        }
        beacons.forEach(({ target, ring, pillar, rockMat }) => {
          const scanned = useMarsStore.getState().scannedTargets.includes(target.id);
          ring.visible = pillar.visible = !scanned && (!campaign || !('availableSol' in target) || Number(target.availableSol)<=campaign.sol);
          ring.rotation.z += dt * 0.2;
          const focused = useMarsStore.getState().scanningTargetId === target.id;
          ring.scale.setScalar(focused ? 1 + Math.sin(elapsed * 5) * 0.06 : 1);
          const selectedBeacon=beacons.find(e=>e.target.id===target.id);if(selectedBeacon?.ring2)selectedBeacon.ring2.scale.setScalar(1+Math.sin(elapsed*2.2)*.035);
          rockMat.emissiveIntensity = focused ? 0.24 + Math.sin(elapsed * 7) * 0.1 : 0;
        });
        if(trackTrail&&movedThisFrame>0){trackDistance+=movedThisFrame;while(trackDistance>=trackTrail.spacingM){trackDistance-=trackTrail.spacingM;for(const side of [-1,1])for(const axle of [-1,0,1]){rover.localToWorld(trackWorld.set(side*1.16,0,axle*1.15));trackDummy.position.set(trackWorld.x,heightAt(trackWorld.x,trackWorld.z)+.012,trackWorld.z);trackDummy.rotation.set(0,heading,0);trackDummy.updateMatrix();trackTrail.mesh.setMatrixAt(trackNext,trackDummy.matrix);trackTrail.mesh.setColorAt(trackNext,trackColor);trackNext=(trackNext+1)%trackTrail.capacity;trackUsed=Math.min(trackTrail.capacity,trackUsed+1);}trackTrail.mesh.count=trackUsed;trackTrail.mesh.instanceMatrix.needsUpdate=true;if(trackTrail.mesh.instanceColor)trackTrail.mesh.instanceColor.needsUpdate=true;}}
        if(wheelDust)wheelDust.update(rover,dt>0?movedThisFrame/dt:0,dt,heightAt);
        if(contactShadow){contactShadow.position.set(rover.position.x,heightAt(rover.position.x,rover.position.z)+.012,rover.position.z);contactShadow.rotation.z=heading;}
      } else speed = 0;
      dust.rotation.y = elapsed * 0.018;
      const cameraDamp = 1 - Math.exp(-dt * (visualV2?Math.LN2/.18:5.2));
      const yawDelta = Math.atan2(Math.sin(yawTarget - yaw), Math.cos(yawTarget - yaw));
      yaw += yawDelta * cameraDamp;
      pitch += (pitchTarget - pitch) * (visualV2?1-Math.exp(-dt*4.62):cameraDamp);
      zoom += (zoomTarget - zoom) * (visualV2?1-Math.exp(-dt*(Math.LN2/.12)):cameraDamp);
      boostZoom+=(Number(input.has('shift'))-boostZoom)*(1-Math.exp(-dt/(visualV2?.4:.18)));
      cameraView.current = { yaw, pitch, zoom };
      const introBlend=visualV2?THREE.MathUtils.smoothstep((now-introStart)/4000,0,1):1;
      const baseZoom=visualV2?THREE.MathUtils.lerp(16,zoom,introBlend):zoom;
      const activeTarget=visualV2?beacons.map(entry=>({...entry,distance:Math.hypot(rover.position.x-entry.target.x,rover.position.z-entry.target.z)})).filter(entry=>entry.distance<30).sort((a,b)=>a.distance-b.distance)[0]:undefined;
      const targetFrame=activeTarget?1-activeTarget.distance/30:0;
      const framedZoom=baseZoom*(1+targetFrame*.15)*(1+boostZoom*.12);
      const lookTarget = rover.position.clone().add(new THREE.Vector3(0, preview?1.05:visualV2?visualConfig.camera.targetHeight:1.6, visualV2?0:-0.35));
      if(visualV2&&Math.abs(speed)>.05){lookTarget.x+=-Math.sin(heading)*Math.sign(speed)*Math.min(1.5,Math.abs(speed)*.25);lookTarget.z+=-Math.cos(heading)*Math.sign(speed)*Math.min(1.5,Math.abs(speed)*.25);}
      if(activeTarget){const midpoint=rover.position.clone().lerp(new THREE.Vector3(activeTarget.target.x,heightAt(activeTarget.target.x,activeTarget.target.z)+.8,activeTarget.target.z),.5);lookTarget.lerp(midpoint,targetFrame*.4);}
      if(visualV2)lookTargetSmooth.lerp(lookTarget,1-Math.exp(-dt*(Math.LN2/.15)));else lookTargetSmooth.copy(lookTarget);
      const cameraElevation=visualV2?THREE.MathUtils.lerp(THREE.MathUtils.degToRad(8),pitch,introBlend):0.3+pitch;
      const behind = new THREE.Vector3(Math.sin(heading + yaw) * framedZoom, visualV2?framedZoom*Math.tan(cameraElevation):framedZoom*cameraElevation, Math.cos(heading + yaw) * framedZoom);
      const desired = rover.position.clone().add(behind);
      desired.y = Math.max(desired.y, heightAt(desired.x, desired.z) + (visualV2?visualConfig.camera.clearance:1.65));
      // Short terrain probes keep the chase line from passing behind a ridge.
      let safeFraction = 1;
      for (let i = 1; i <= 10; i++) {
        const t = i / 10, probe = lookTargetSmooth.clone().lerp(desired, t), clearance=visualV2?visualConfig.camera.clearance:1.1;
        if (probe.y < heightAt(probe.x, probe.z) + clearance) { if(visualV2)desired.y=Math.max(desired.y,lookTargetSmooth.y+(heightAt(probe.x,probe.z)+clearance-lookTargetSmooth.y)/t);else safeFraction = Math.max(0.2, t - 0.1); }
      }
      desired.lerpVectors(lookTargetSmooth, desired, safeFraction);
      camera.position.lerp(desired, 1 - Math.exp(-dt * (visualV2?Math.LN2/.18:4.2)));
      camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + (visualV2?visualConfig.camera.clearance:1.35));
      if(visualV2){const requestedFov=THREE.MathUtils.lerp(visualConfig.camera.introFov,visualConfig.camera.fov,introBlend)+boostZoom*4;if(Math.abs(camera.fov-requestedFov)>.1){camera.fov=requestedFov;camera.updateProjectionMatrix();}}
      camera.up.set(0,1,0);camera.lookAt(lookTargetSmooth);
      sun.position.set(rover.position.x - 70*Math.cos(sunElevation), rover.position.y + 100*Math.sin(sunElevation), rover.position.z - 70*Math.cos(sunElevation));
      const texelSize=(shadowHalf*2)/shadowSize;sun.target.position.set(Math.round(rover.position.x/texelSize)*texelSize,rover.position.y,Math.round(rover.position.z/texelSize)*texelSize); sun.target.updateMatrixWorld();
      dust.position.set(rover.position.x, rover.position.y, rover.position.z);
      if(campaign)battery=useGameStore.getState().missionProgress.battery;
      if (!preview && now - lastHud > 125) {
        updateTelemetry({ battery, speed: dt>0?movedThisFrame/dt:0, sol: useGameStore.getState().campaign?.sol ?? useMarsStore.getState().sol, distance, warning: battery < config.reserve*100 ? 'RESERVE THRESHOLD' : elapsed < collisionUntil ? 'ROCK CONTACT' : '' });
        useMarsStore.getState().updateScanStatus(scanStatusNearby, scanProgress, scanNotice);
        lastHud = now;
      }
      if(!preview && !campaign && elapsed-lastCampaignSave>=5){useGameStore.getState().setMissionProgress({x:rover.position.x,z:rover.position.z,heading,distance,battery,sol:Math.floor(elapsed/90)+1,scannedTargets:useMarsStore.getState().scannedTargets,science:useMarsStore.getState().science});lastCampaignSave=elapsed}
      // Planning is untimed. Preserve the canvas and render only changed views while it is idle.
      const idlePlan=!!campaign&&(campaign.mode==='planning'||useMarsStore.getState().phase==='paused');
      const cameraMoving=camera.position.distanceTo(desired)>.01||Math.abs(yawTarget-yaw)>.001||Math.abs(pitchTarget-pitch)>.001||Math.abs(zoomTarget-zoom)>.001;
      if(!idlePlan||framePending||dragging||cameraMoving||awaitingModelRender){
        renderer.render(scene,camera);framePending=false;
        if(awaitingModelRender){awaitingModelRender=false;setModelProgress({phase:'ready'});}
      }
      if(debugOverlay&&now-lastDebugUpdate>500){const info=renderer.info;debugOverlay.textContent=`VISUAL V2 · ${quality.toUpperCase()} | ${Math.round(1/Math.max(dt,.001))} FPS · ${info.render.calls} calls · ${info.render.triangles.toLocaleString()} tris`;lastDebugUpdate=now;}
    };
    animate();
    return () => {
      disposed = true; cancelAnimationFrame(animationFrame); unsubscribePhase(); unsubscribeCampaign(); keys.current.clear(); loadController?.abort(); retryModel.current = () => {}; observer.disconnect();
      if (importedRover) { rover.remove(importedRover.root); importedRover.dispose(); }
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointercancel', pointerUp); renderer.domElement.removeEventListener('wheel', wheel);
      disposeModel(scene);
      if(rendererRef.current===renderer)rendererRef.current=null;if(sunRef.current===sun)sunRef.current=null;rockMeshesRef.current=[];rockBaseCountsRef.current=[];pebbleRef.current=null;if(debugOverlay?.parentElement===root)root.removeChild(debugOverlay);environmentTarget?.dispose();
      renderer.dispose(); renderer.forceContextLoss(); if (renderer.domElement.parentElement === root) root.removeChild(renderer.domElement);
    };
  }, [keys, updateTelemetry, preview, visualKey, visualV2, site, campaignMode]);

  useEffect(()=>{if(!visualV2)return;const renderer=rendererRef.current;if(!renderer)return;const cap=quality==='low'?1:quality==='high'?2:1.5;renderer.setPixelRatio(Math.min(devicePixelRatio,cap));if(host.current)renderer.setSize(host.current.clientWidth,host.current.clientHeight);const sun=sunRef.current;if(sun){sun.shadow.map?.dispose();sun.shadow.map=null;const mapSize=quality==='low'?1024:visualConfig.lighting.shadowSize;sun.shadow.mapSize.set(mapSize,mapSize);}const rockLimit=quality==='low'?800:quality==='high'?3500:2000;let left=rockLimit;rockMeshesRef.current.forEach((mesh,index)=>{mesh.count=Math.min(rockBaseCountsRef.current[index],left);left-=mesh.count;});if(pebbleRef.current)pebbleRef.current.count=quality==='low'?Math.min(160,pebbleRef.current.count):quality==='medium'?Math.min(visualConfig.rocks.pebbleCount,pebbleRef.current.count):pebbleRef.current.count;},[quality,visualV2]);

  return <div className={`mars-world${preview ? ' engineering-rover-world' : ''}`} ref={host} aria-label={preview ? 'Live 3D rover configuration preview' : 'Interactive 3D Mars rover exploration'} data-rover-config={visualKey} data-preview-config={preview ? visualKey : undefined} data-visual-variant={visualV2?'v2':'v1'} data-quality={quality} data-model-status={modelStatus} data-model-phase={modelProgress.phase}>{modelStatus !== 'ready' && <span className="model-status" role="status">{modelProgressText(modelProgress, 'Perseverance')}{modelStatus === 'fallback' && <> · Using procedural rover <button type="button" onClick={() => retryModel.current()}>Retry rover model</button></>}</span>}</div>;
}
