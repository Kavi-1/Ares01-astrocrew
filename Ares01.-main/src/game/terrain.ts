// Deterministic, queryable geology shared by the rendered surface and rover physics.
function hash(ix: number, iz: number): number {
  const v = Math.sin(ix * 127.1 + iz * 311.7 + 74.7) * 43758.5453123;
  return v - Math.floor(v);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = THREE_LERP(hash(ix, iz), hash(ix + 1, iz), sx);
  const b = THREE_LERP(hash(ix, iz + 1), hash(ix + 1, iz + 1), sx);
  return THREE_LERP(a, b, sz) * 2 - 1;
}

function THREE_LERP(a: number, b: number, t: number) { return a + (b - a) * t; }

export function geologyAt(x: number, z: number): number {
  return valueNoise(x * 0.18, z * 0.18) * 0.65 + valueNoise(x * 0.065 + 13, z * 0.065 - 8) * 0.35;
}

function craterBowl(x: number, z: number, cx: number, cz: number, radius: number, depth: number) {
  const d = Math.hypot(x - cx, z - cz) / radius;
  const basin = -depth * Math.exp(-d * d * 3.2);
  const rim = 1.05 * Math.exp(-Math.pow((d - 0.93) * 7, 2));
  const ejecta = 0.32 * Math.exp(-Math.pow((d - 1.18) * 2.4, 2));
  return basin + rim + ejecta;
}

export function heightAt(x: number, z: number): number {
  const continental = valueNoise(x * 0.016, z * 0.016) * 4.1;
  const erodedRidges = valueNoise(x * 0.048 + 5, z * 0.048 - 9) * 1.25;
  const dunes = Math.sin(x * 0.038 + Math.sin(z * 0.024)) * 0.72
    + Math.cos(z * 0.043 + Math.sin(x * 0.019)) * 0.58;
  const ripples = valueNoise(x * 0.12 - 31, z * 0.12 + 11) * 0.22;
  return continental + erodedRidges + dunes + ripples
    + craterBowl(x, z, 28, -8, 18, 4.2)
    + craterBowl(x, z, -12, -46, 22, 4.5)
    + craterBowl(x, z, -44, 28, 13, 3.1)
    + craterBowl(x, z, 70, 55, 22, 4.7)
    + craterBowl(x, z, -83, -68, 17, 3.6);
}

export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
