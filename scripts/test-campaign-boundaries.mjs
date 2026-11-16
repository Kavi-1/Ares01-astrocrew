import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let checks=0;const near=(a,b,tol=1e-7)=>{assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);checks++};
try{
 const e=await server.ssrLoadModule('/src/engine/campaign.ts');
 const energy=await server.ssrLoadModule('/src/engine/energy.ts');
 const {DEFAULT_CONFIG,FIXED}=await server.ssrLoadModule('/src/nasa/data.ts');
 const {scenarioTargets,sunElevationDeg,SCENARIOS}=await server.ssrLoadModule('/src/data/scenarios.ts');
 const {hazardContains,routeGeometry,scenarioHeightAt}=await server.ssrLoadModule('/src/game/terrain.ts');
 const cfg={...DEFAULT_CONFIG,instruments:['mastcam-z','sherloc','pixl','meda']},options=structuredClone(e.DEFAULT_OPTIONS);
 const plan={driveHours:4,science:true,weather:true,transmit:true};
 for(const reserve of [.2,.3,.4]){
  let c=e.createCampaign(options,{...cfg,reserve});c.energyWh=2408*reserve+1;c.mode='operations';
  const once=e.traverse(c,100,10);
  for(const n of [1,10,30,60,144]){let split=c;for(let i=0;i<n;i++)split=e.traverse(split,100/n,10);near(split.energyWh,once.energyWh);near(split.driveMeters,once.driveMeters);assert.equal(split.safe,true);checks++;}
  near(once.energyWh,2408*reserve);assert.equal(once.skipNext,true);checks++;
 }
 for(const initial of [0,1,1000,2408])for(const watts of [0,75,110,375,900]){
  const result=energy.integrateEnergy(initial,{hours:1,generationW:110,loadW:watts});
  near(initial+result.generatedWh,result.storedWh+result.servedWh+result.conversionLossWh+result.curtailedWh);
  near(result.requestedWh,result.servedWh+result.unservedWh);
 }
 let loss=e.createCampaign(options,{...cfg,baselineW:200});loss.energyWh=0;loss=e.enterSafe(loss);
 for(let sol=1;sol<=3;sol++){loss=e.endSol(loss);assert.equal(loss.zeroStreak,sol);checks++;assert.equal(loss.mode==='finished',sol===3);checks++;}
 assert.match(loss.majorFailures.at(-1),/three consecutive/);checks++;
 // The high baseline above is an injected transition fixture, not a new NASA load or production fault.
 const moxPlan={...plan,driveHours:0,scienceHours:1};
 let mox=e.commitPlan(e.createCampaign(options,{...DEFAULT_CONFIG,moxieRun:true}),moxPlan);
 for(let sol=1;sol<=10;sol++){
  if(mox.events.some(x=>x.id==='E1'&&!x.resolved))mox=e.resolveRoute(mox,'reroute');
  if(mox.mode==='planning')mox=e.commitPlan(mox,moxPlan);
  mox=sol<=2?e.runMoxie(mox):e.acquireWeather(mox);
  const before=mox.energyWh,duplicate=sol<=2?e.acquireWeather(mox):e.acquireWeather(mox);near(duplicate.energyWh,before);
  if(mox.events.some(event=>event.id==='D12'&&!event.resolved))mox=e.declineUnusualRock(mox);
  mox=e.endSol(mox);
 }
 near(e.scienceSummary(mox).fractions.E,1);
 assert.equal(mox.products.filter(p=>p.method==='MOXIE + MEDA context').length,4);checks++;
 let slow=e.commitPlan(e.createCampaign(options,{...cfg,downlink:'X-band'}),plan);slow=e.acquireWeather(slow);
 const acquired=slow.energyWh;slow=e.acquireWeather(slow);near(slow.energyWh,acquired);
 slow=e.transmit(slow);near(slow.products[0].sentBits,1.8e6);near(e.scienceSummary(slow).fractions.E,0);
 const restored=e.restoreCampaign(e.snapshotCampaign(slow));assert.deepEqual(e.transmit(restored),e.transmit(slow));checks++;
 near(e.transmit(slow).products[0].sentBits,1.8e6);
 const outage={...slow,sol:12,contactUsedBits:0,config:{...slow.config,downlink:'UHF'}};
 near(e.contactCapacityBits(outage),0);near(e.transmit(outage).products[0].sentBits,1.8e6);
 for(const [relay,capacity]of[['O2',1920],['O3',900]])near(e.contactCapacityBits({...outage,options:{...outage.options,relay}}),capacity*1e6);
 const ranked=e.prioritizeData(slow,'E');assert.deepEqual(ranked.options.ranking,options.ranking);assert.equal(ranked.dataPriority[0],'E');checks+=2;
 const radarCfg={...DEFAULT_CONFIG,instruments:['mastcam-z','rimfax']};
 let radar=e.createCampaign(options,radarCfg);radar.sol=2;radar=e.commitPlan(radar,plan);
 radar=e.traverse(radar,100,0,{from:[-118,6],to:[-18,6]});near(radar.profileMeters,100);
 const first=scenarioTargets('jezero')[0];radar=e.acquireTarget(radar,first.id,first.x,first.z);assert.ok(radar.completed.includes(`science:${first.id}`));checks++;
 radar=e.traverse(radar,100,0,{from:[-18,6],to:[-118,6]});assert.ok(radar.profileMeters<1,'repeating the same ground does not create a second unique profile');checks++;
 for(const site of SCENARIOS){const g=routeGeometry(site.id);assert.equal(hazardContains(...g.midpoint,site.id),true);assert.equal(hazardContains(...g.via,site.id),false);checks+=2;
  for(let i=1;i<20;i++){const t=i/20;for(const [a,b]of[[g.a,g.via],[g.via,g.b]]){const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;assert.ok(Number.isFinite(scenarioHeightAt(x,z,site.id)));checks++;}}
 }
 near(sunElevationDeg('jezero','W2'),82.81,.001);near(sunElevationDeg('columbia','W2'),49.81,.001);
 const risk={...options,vehicle:'light',relay:'O3',risks:{budget:true,landing:false,mass:true}};
 assert.ok(!e.missionChecks(risk,DEFAULT_CONFIG).massPass);assert.equal(e.launchBlocks(risk,DEFAULT_CONFIG,false).length,0);assert.ok(e.launchBlocks(risk,DEFAULT_CONFIG,true).some(x=>x.includes('Retry')));checks+=3;
 const short={...options,relay:'O3',risks:{budget:true,landing:false,mass:false}};near(e.missionChecks(short,DEFAULT_CONFIG).budget.totalCostUsdMillion,2840);assert.equal(e.createCampaign(short,DEFAULT_CONFIG).totalSols,20);checks++;
 assert.throws(()=>e.restoreCampaign(JSON.stringify({...slow,energyWh:-1})));checks++;

 // Review regressions: interrupted unpowered work must never become free science.
 const thinPlan={driveHours:0,scienceHours:8.5,science:true,weather:false,transmit:true};
 let interrupted={...e.createCampaign(options,cfg),sol:3,mode:'operations',energyWh:1,plan:thinPlan};
 interrupted=e.acquireTarget(interrupted,'jezero-B-1',-18,6);
 assert.ok(!interrupted.completed.includes('activity:jezero-B-1:sherloc'));checks++;
 interrupted=e.endSol(e.endSol(interrupted));
 interrupted=e.resolveRoute(interrupted,'reroute');interrupted=e.commitPlan(interrupted,thinPlan);
 const beforeRetry=interrupted.energy.length;interrupted=e.acquireTarget(interrupted,'jezero-B-1',-18,6);
 assert.equal(interrupted.products.length,2);assert.ok(interrupted.energy.slice(beforeRetry).some(x=>x.id==='activity:jezero-B-1:sherloc'&&x.unservedWh===0));checks+=2;
 let partial={...e.createCampaign(options,cfg),sol:3,mode:'operations',energyWh:490,plan:thinPlan};
 partial=e.acquireTarget(partial,'jezero-B-1',-18,6);assert.ok(partial.completed.includes('activity:jezero-B-1:sherloc'));checks++;
 partial=e.endSol(e.endSol(partial));partial=e.resolveRoute(partial,'reroute');partial=e.commitPlan(partial,thinPlan);
 const partialStart=partial.energy.length;partial=e.acquireTarget(partial,'jezero-B-1',-18,6);
 assert.equal(partial.products.length,2);assert.ok(!partial.energy.slice(partialStart).some(x=>x.id==='activity:jezero-B-1:sherloc'));checks+=2;
 const close=e.endSol({...e.createCampaign(options,cfg),mode:'operations',energyWh:1,elapsedHours:FIXED.solHours-.001,plan:thinPlan});
 assert.equal(close.safe,true);assert.equal(close.mode,'operations');checks+=2;
 const tight=e.commitPlan({...e.createCampaign(options,cfg),sol:3},{...thinPlan,scienceHours:2.5});
 const denied=e.acquireTarget(tight,'jezero-B-1',-18,6);near(denied.energyWh,tight.energyWh);near(denied.elapsedHours,tight.elapsedHours);assert.equal(denied.products.length,0);checks++;
 const bOnly={...e.createCampaign(options,{...cfg,instruments:['sherloc','pixl','meda']}),sol:3,mode:'operations',plan:thinPlan};
 assert.equal(e.nearbyScienceTarget(bOnly,-18,12,scenarioTargets('jezero').map(t=>t.id)),'jezero-B-1');checks++;
 const stopped=e.commitPlan(e.createCampaign(options,cfg),plan);
 assert.equal(e.traverse(stopped,1e-12).mode,'operations');checks++;
 const exhausted={...stopped,sol:3,driveHours:4,plan:{...stopped.plan,driveHours:4}};
 const stillOperating=e.traverse(exhausted,1);assert.equal(stillOperating.mode,'operations');checks++;
 assert.equal(e.acquireTarget(stillOperating,'jezero-B-1',-18,6).products.length,2);checks++;
 const oldDraft=structuredClone(partial);delete oldDraft.scienceSpentHours;delete oldDraft.plan.scienceHours;
 const upgraded=e.restoreCampaign(JSON.stringify(oldDraft));assert.ok(Number.isFinite(upgraded.scienceSpentHours));assert.ok(Number.isFinite(upgraded.plan.scienceHours));checks+=2;
 for(const corrupt of [{...partial,elapsedHours:null},{...partial,scienceSpentHours:null},{...partial,products:[{...partial.products[0],sentBits:1e20}]}]){assert.throws(()=>e.restoreCampaign(JSON.stringify(corrupt)));checks++;}
 console.log(`PASS ${checks} safety, conservation, partial return, relay outage, MOXIE context, unique radar, route and risk boundary checks.`);
}finally{await server.close();}
