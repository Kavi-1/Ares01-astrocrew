import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
let checks=0;const near=(a,b,tol=1e-7)=>{assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);checks++};
try {
 const e=await server.ssrLoadModule('/src/engine/campaign.ts');
 const {DEFAULT_CONFIG}=await server.ssrLoadModule('/src/nasa/data.ts');
 const {scenarioTargets,SCENARIOS}=await server.ssrLoadModule('/src/data/scenarios.ts');
 const {routeGeometry,scenarioHeightAt}=await server.ssrLoadModule('/src/game/terrain.ts');
 const cfg={...DEFAULT_CONFIG,instruments:['mastcam-z','sherloc','pixl','meda']};
 const opts=()=>structuredClone(e.DEFAULT_OPTIONS);
 const plan={driveHours:0,science:true,weather:true,transmit:true};
 const rankPermutations=[['G','B','E'],['G','E','B'],['B','G','E'],['B','E','G'],['E','G','B'],['E','B','G']];
 for(const ranking of rankPermutations){assert.equal(e.validRanking(ranking),true);checks++;const c=e.createCampaign({...opts(),ranking},cfg);c.products=[{id:'weather',objective:'E',unit:1,sol:1,bits:88e6,sentBits:88e6,method:'MEDA'}];near(e.scienceSummary(c).sciencePoints,[.5,.3,.2][ranking.indexOf('E')]*3);}
 assert.equal(e.validRanking(['G','G','E']),false);checks++;
 for(const site of SCENARIOS)for(const short of [false,true]){
  const options={...opts(),site:site.id,relay:short?'O3':'O1',risks:{budget:short,landing:false,mass:false}};
  const config=short?DEFAULT_CONFIG:cfg;
  if(site.id==='columbia'&&short)options.risks.landing=true;
  let c=e.createCampaign(options,config);
  assert.equal(c.totalSols,short?20:30);checks++;
  const frozen=JSON.stringify(c);assert.equal(JSON.stringify(e.restoreCampaign(e.snapshotCampaign(c))),frozen);checks++;
  for(let sol=1;sol<=c.totalSols;sol++){
   assert.equal(c.sol,sol);checks++;
   if(c.events.some(event=>event.id==='E1'&&!event.resolved))c=e.resolveRoute(c,'reroute');
   if(c.mode==='planning')c=e.commitPlan(c,plan);
   assert.equal(c.mode,'operations',c.message);checks++;
   if(sol<=10)c=e.acquireWeather(c);
   if(!c.mobilityDisabled){for(const target of scenarioTargets(site.id).filter(t=>t.availableSol===sol)){c=e.acquireTarget(c,target.id,target.x,target.z);}}
   const saved=e.restoreCampaign(e.snapshotCampaign(c));assert.deepEqual(e.endSol(saved),e.endSol(c));checks++;
   c=e.endSol(c);
  }
  assert.equal(c.mode,'finished');checks++;
  assert.equal(c.history.length,c.totalSols);checks++;
  assert.equal(c.events.find(event=>event.id==='E1').sol,5);checks++;
  assert.equal(c.events.find(event=>event.id==='E2').sol,site.outageSol);checks++;
  if(!c.mobilityDisabled){near(e.scienceSummary(c).fractions.G,1);near(e.scienceSummary(c).fractions.B,1);}
  near(e.scienceSummary(c).fractions.E,1);
  for(const record of c.history)near(record.generatedWh,e.generationForSol({...c,sol:record.sol})*(88775/3600));
  const route=routeGeometry(site.id);near(route.detourM-route.directM,site.detour);
 }
 const options=opts();let c=e.createCampaign(options,cfg);c.energyWh=1000;c=e.commitPlan(c,{...plan,science:false,weather:false});
 const wait=e.waitHours(c,1);near(wait.energyWh-1000,35*Math.sqrt(.9));assert.deepEqual(e.waitHours(c,1),wait);checks++;
 const one=e.traverse(e.commitPlan(e.createCampaign(options,cfg),{...plan,driveHours:4}),100);
 for(const steps of [10,30,60,144]) {let split=e.commitPlan(e.createCampaign(options,cfg),{...plan,driveHours:4});for(let i=0;i<steps;i++)split=e.traverse(split,100/steps);near(split.energyWh,one.energyWh);near(split.elapsedHours,one.elapsedHours);}
 for(const reserve of [.2,.3,.4]){const ready=e.commitPlan(e.createCampaign(options,{...cfg,reserve}),{...plan,driveHours:0});assert.equal(ready.mode,'operations');checks++;}
 const stopped={...e.createCampaign(options,cfg),energyWh:0};let safe=e.enterSafe(stopped);safe=e.endSol(safe);assert.equal(safe.safe,true);checks++;safe=e.endSol(safe);assert.equal(safe.safe,false);checks++;assert.ok(safe.energyWh>0);checks++;
 assert.notEqual(scenarioHeightAt(30,50,'jezero'),scenarioHeightAt(30,50,'syrtis'));checks++;
 console.log(`PASS ${checks} scenario/ranking, energy partition, save/resume and full-duration progression checks.`);
}finally{await server.close();}
