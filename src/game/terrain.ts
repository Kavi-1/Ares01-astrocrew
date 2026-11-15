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

import { getScenario, scenarioTargets, type SiteId } from '../data/scenarios';
export function routeGeometry(site: SiteId) {
  const transform=(x:number,z:number):[number,number]=>site==='syrtis'?[-18+(z-12),12-(x+18)]:site==='columbia'?[-18-(x+18),z]:[x,z];
  const a=transform(-40,-1), b=transform(-64,-17), d=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const extra=getScenario(site).detour, h=Math.sqrt(((d+extra)/2)**2-(d/2)**2);
  const midpoint:[number,number]=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const side:[number,number]=[-(b[1]-a[1])/d,(b[0]-a[0])/d];
  const via:[number,number]=[midpoint[0]+side[0]*h,midpoint[1]+side[1]*h];
  return { a,b,via,midpoint,side,directM:d,detourM:2*Math.hypot(d/2,h),extraM:extra };
}
function distanceToSegment(x:number,z:number,a:readonly number[],b:readonly number[]) {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
export function hazardContains(x:number,z:number,site:SiteId) {
  const route=routeGeometry(site),dx=x-route.midpoint[0],dz=z-route.midpoint[1];
  const along=dx*route.side[0]+dz*route.side[1],across=dx*route.side[1]-dz*route.side[0];
  return Math.abs(along)<8 && Math.abs(across)<1.5;
}
const terrainQueryCache=new Map<SiteId,{route:ReturnType<typeof routeGeometry>;targets:ReturnType<typeof scenarioTargets>;points:[number,number][]}>();
function queryLayout(site:SiteId){let layout=terrainQueryCache.get(site);if(!layout){const targets=scenarioTargets(site);layout={route:routeGeometry(site),targets,points:[[-18,12],...targets.filter(t=>t.objective==='G').map(t=>[t.x,t.z] as [number,number])]};terrainQueryCache.set(site,layout);}return layout;}
/** Authored synthetic maps: shared by every mesh, collision and slope query. */
export function scenarioHeightAt(x:number,z:number,site:SiteId) {
  const s=getScenario(site), shift=s.origin;
  let height=heightAt(x+shift[0],z+shift[1]);
  if(site==='syrtis')height+=1.8*Math.sin((x+z)*.035);
  if(site==='columbia')height+=2.5*Math.sin(x*.025)*Math.cos(z*.02);
  const {route,targets,points}=queryLayout(site);
  const corridor=Math.min(...points.slice(1).map((point,index)=>distanceToSegment(x,z,points[index],point)),distanceToSegment(x,z,route.a,route.via),distanceToSegment(x,z,route.via,route.b));
  const local=Math.min(Math.hypot(x+18,z-12),...targets.map(t=>Math.hypot(x-t.x,z-t.z)));
  const edge=Math.max(0,Math.min(1,Math.min((corridor-5)/18,(local-12)/18)));
  const blend=edge*edge*(3-2*edge);
  height*=.08+.92*blend;

  return height;
}
