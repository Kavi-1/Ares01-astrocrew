import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let checks = 0;
const near=(a,b,tol=1e-8)=>{assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);checks++};
try {
 const { integrateEnergy, belowReserve, zeroEnergyStreak } = await server.ssrLoadModule('/src/engine/energy.ts');
 const eta=Math.sqrt(.9), capacity=2408;
 near(integrateEnergy(1000,{hours:1,generationW:110,loadW:75}).storedWh,1000+35*eta);
 near(integrateEnergy(1000,{hours:1,generationW:110,loadW:375}).storedWh,1000-265/eta);
 near(integrateEnergy(1000,{hours:1,generationW:110,loadW:110}).storedWh,1000);
 const full=integrateEnergy(capacity,{hours:1,generationW:110,loadW:75});near(full.storedWh,capacity);near(full.curtailedWh,35);
 const empty=integrateEnergy(1,{hours:1,generationW:0,loadW:75});near(empty.storedWh,0);near(empty.unservedWh,75-eta);
 for(const reserve of [.2,.3,.4]) { assert.equal(belowReserve(capacity*reserve,reserve),false); assert.equal(belowReserve(capacity*reserve-.01,reserve),true);checks+=2; }
 for(const frames of [10,30,60,144]) {
  let energy=1000;
  for(let frame=0;frame<frames;frame++) energy=integrateEnergy(energy,{hours:1/frames,generationW:110,loadW:150}).storedWh;
  near(energy,integrateEnergy(1000,{hours:1,generationW:110,loadW:150}).storedWh);
 }
 let count=0; const actual=[0,0,1,0,0,0].map(end=>count=zeroEnergyStreak(count,end));assert.deepEqual(actual,[1,2,0,1,2,3]);checks++;
 for(const input of [{hours:-1,generationW:110,loadW:75},{hours:1,generationW:NaN,loadW:75}]) { assert.throws(()=>integrateEnergy(1000,input),RangeError);checks++; }
 console.log(`PASS ${checks} battery checks: EQ-8/8b, efficiencies, saturation/unserved energy, reserve thresholds, interval partition and three-zero counter.`);
} finally { await server.close(); }
