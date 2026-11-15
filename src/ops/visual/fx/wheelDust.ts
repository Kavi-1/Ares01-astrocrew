import * as THREE from 'three';
import { seeded } from '../../../game/terrain';
import { visualConfig } from '../config/visualConfig';

export function createWheelDust(seed = 551) {
  const count = visualConfig.effects.dustCount, random = seeded(seed), positions = new Float32Array(count * 3);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) { const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30); gradient.addColorStop(0, 'rgba(232,173,127,.5)'); gradient.addColorStop(1, 'rgba(232,173,127,0)'); context.fillStyle = gradient; context.fillRect(0, 0, 64, 64); }
  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: '#d9a68a', map: texture, size: 0.28, transparent: true, opacity: 0.3, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material); points.name = 'LowCost_WheelDust_Pool';
  const velocity = Array.from({ length: count }, () => new THREE.Vector3());
  const age = new Float32Array(count).fill(-1), lifetime = new Float32Array(count);
  let cursor = 0, emission = 0;
  const spawn = (rover: THREE.Group, heightAt: (x: number, z: number) => number) => {
    const index = cursor++ % count, side = random() < 0.5 ? -1 : 1, axle = random() < 0.5 ? -1 : 1;
    const local = rover.localToWorld(new THREE.Vector3(side * 0.82, 0.1, axle * 1.15));
    positions[index * 3] = local.x; positions[index * 3 + 1] = heightAt(local.x, local.z) + 0.12; positions[index * 3 + 2] = local.z;
    velocity[index].set((random() - 0.5) * 0.45, 0.2 + random() * 0.5, 0.25 + random() * 0.55).applyAxisAngle(new THREE.Vector3(0, 1, 0), rover.rotation.y);
    age[index] = 0; lifetime[index] = 0.8 + random() * 0.8;
  };
  const update = (rover: THREE.Group, speed: number, dt: number, heightAt: (x: number, z: number) => number) => {
    if (speed > visualConfig.effects.dustKickSpeed) {
      emission += dt * 45;
      while (emission >= 1) { spawn(rover, heightAt); emission -= 1; }
    } else emission = Math.min(emission, 0.99);
    for (let i = 0; i < count; i++) if (age[i] >= 0) {
      age[i] += dt;
      if (age[i] >= lifetime[i]) { age[i] = -1; positions[i * 3 + 1] = -1000; continue; }
      velocity[i].y -= dt * 0.18; velocity[i].x += dt * 0.04;
      positions[i * 3] += velocity[i].x * dt; positions[i * 3 + 1] += velocity[i].y * dt; positions[i * 3 + 2] += velocity[i].z * dt;
      positions[i * 3 + 1] = Math.max(positions[i * 3 + 1], heightAt(positions[i * 3], positions[i * 3 + 2]) + 0.025);
    }
    geometry.attributes.position.needsUpdate = true;
  };
  return { points, update };
}
