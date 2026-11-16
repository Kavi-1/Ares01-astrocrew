import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let checks=0,playthroughs=0;
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const near=(a,b,message)=>{assert.ok(Math.abs(a-b)<1e-7,`${message??''}: ${a} vs ${b}`);checks++;};
try {
  const e=await server.ssrLoadModule('/src/engine/campaign.ts');
  const expedition=await server.ssrLoadModule('/src/engine/expedition.ts');
  const {DEFAULT_CONFIG,FIXED}=await server.ssrLoadModule('/src/nasa/data.ts');
  const {SCENARIOS,WINDOWS,scenarioTargets}=await server.ssrLoadModule('/src/data/scenarios.ts');
  const core={...DEFAULT_CONFIG,instruments:['mastcam-z','sherloc','pixl','meda']};
  const rankings=[['G','B','E'],['G','E','B'],['B','G','E'],['B','E','G'],['E','G','B'],['E','B','G']];
  const plan={driveHours:4,scienceHours:8.5,science:true,weather:true,transmit:true};
  const options=(site='jezero',window='W1',short=false,ranking=rankings[0])=>({...structuredClone(e.DEFAULT_OPTIONS),site,window,ranking:[...ranking],relay:short?'O3':'O1',risks:{budget:short,landing:false,mass:false}});
  const quietPlan={driveHours:0,scienceHours:0,science:false,weather:false,transmit:true};
  const conservation=c=>{const d=e.dataSummary(c);equal(d.collectedBits,d.returnedBits+d.onboardBits+d.lostBits,'Integer science bits are conserved.');equal(d.capacityBits,null,'Unapproved science buffer capacity remains unspecified.');};
  function manualAdvance(c,active) {
    const beganSafe=c.safe||c.skipNext,transmit=c.plan.transmit;
    let quietDraftApplied=false;
    let next=e.endSol(c);
    if(next.sol===c.sol||next.mode==='finished'||beganSafe)return next;
    while(next.mode!=='finished'&&!active.includes(next.sol)&&!next.safe&&!next.skipNext&&!next.events.some(event=>!event.resolved)){
      quietDraftApplied=true;
      next=e.commitPlan(next,{...quietPlan,transmit});
      if(next.mode!=='operations'||next.safe||next.events.some(event=>!event.resolved))break;
      next=e.endSol(next);
    }
    if(quietDraftApplied&&next.mode!=='finished')next={...next,plan:{...c.plan}};
    return next;
  }

  for(const site of SCENARIOS)for(const window of Object.keys(WINDOWS))for(const short of [false,true])for(const ranking of rankings){
    let c=e.createCampaign(options(site.id,window,short,ranking),core),position=[-18,12],activeCount=0;
    const active=expedition.activeExpeditionSols(c);
    assert.ok(active.length>=10&&active.length<=11);checks++;
    equal(active,[...new Set(active)].sort((a,b)=>a-b));
    assert.ok(active.includes(WINDOWS[window].hazardSol)&&active.includes(site.outageSol));checks++;
    for(const target of scenarioTargets(site.id)){assert.ok(active.includes(target.availableSol));checks++;}
    const visited=[];
    while(c.mode!=='finished'){
      visited.push(c.sol);activeCount++;
      if(c.events.some(event=>event.id==='E1'&&!event.resolved))c=e.resolveRoute(c,'reroute');
      if(c.mode==='planning')c=e.commitPlan(c,c.plan);
      equal(c.mode,'operations',c.message);
      if(!c.safe){
        c=e.acquireWeather(c);
        for(const target of scenarioTargets(site.id).filter(t=>t.availableSol===c.sol)){
          const meters=Math.hypot(target.x-position[0],target.z-position[1]);
          c=e.traverse(c,meters,0,{from:position,to:[target.x,target.z]});position=[target.x,target.z];
          for(const step of e.scienceSteps(c,target.id)){
            const prior=c;
            c=e.executeScienceStep(c,target.id,step.instrument,target.x,target.z);
            assert.ok(c.products.length>prior.products.length,c.message);checks++;
            equal(e.executeScienceStep(c,target.id,step.instrument,target.x,target.z),c,'A repeated stage cannot charge or duplicate products.');
            const restored=e.restoreCampaign(e.snapshotCampaign(c));equal(restored,c,'Every instrument stage survives save/load.');
            c=restored;conservation(c);
          }
          assert.ok(c.completed.includes(`science:${target.id}`));checks++;
        }
      }
      const frozen=e.restoreCampaign(e.snapshotCampaign(c));
      const result=expedition.advanceExpedition(c);
      equal(result.campaign,manualAdvance(frozen,active),'Automatic quiet days equal individual canonical reducers.');
      for(const sol of result.skippedSols){
        assert.ok(!active.includes(sol));checks++;
        assert.ok(!result.campaign.energy.some(entry=>entry.sol===sol&&(entry.id.startsWith('activity:')||entry.id.startsWith('drive:'))));checks++;
      }
      c=result.campaign;conservation(c);
    }
    equal(visited,active,'Only authored active calendar days require player operation.');
    equal(activeCount,active.length);equal(c.history.length,c.totalSols);equal(c.totalSols,short?20:30);
    equal(e.scienceSummary(c).fractions,{G:1,B:1,E:1});
    equal(c.events.find(event=>event.id==='E1').sol,WINDOWS[window].hazardSol);
    equal(c.events.find(event=>event.id==='E2').sol,site.outageSol);
    for(const record of c.history)near(record.generatedWh,e.generationForSol({...c,sol:record.sol})*FIXED.solHours,'Every sol retains generation and decay.');
    playthroughs++;
  }

  const ready=(config=core,sol=2)=>e.commitPlan(e.restoreCampaign(e.snapshotCampaign({...e.createCampaign(options(),config),sol})),plan);
  const beforeGap=ready(core,3),afterGap=expedition.advanceExpedition(beforeGap);
  equal(afterGap.campaign.sol,5);equal(afterGap.skippedSols,[4]);equal(afterGap.campaign.mode,'planning');
  equal(afterGap.campaign.plan,beforeGap.plan,'The next field-day draft retains the player\'s drive, science, weather and contact choices.');
  assert.ok(afterGap.campaign.plan.driveHours>0&&afterGap.campaign.plan.science&&afterGap.campaign.plan.weather);checks++;
  let fieldAgain=e.resolveRoute(afterGap.campaign,'reroute');fieldAgain=e.commitPlan(fieldAgain,fieldAgain.plan);
  equal(fieldAgain.mode,'operations');fieldAgain=e.traverse(fieldAgain,1);near(fieldAgain.driveMeters,1);
  fieldAgain=e.acquireWeather(fieldAgain);fieldAgain=e.acquireTarget(fieldAgain,'jezero-G-2',-82,-30);
  assert.ok(fieldAgain.completed.includes('science:weather:5')&&fieldAgain.completed.includes('science:jezero-G-2'));checks++;
  const deliberateZero=e.commitPlan({...e.createCampaign(options(),core),sol:3},quietPlan);
  equal(expedition.advanceExpedition(deliberateZero).campaign.plan,quietPlan,'An explicitly selected zero-work draft is never replaced with forced driving.');
  // An injected high-baseline transition fixture, not a new NASA/production load.
  const warningAtQuiet={...beforeGap,elapsedHours:FIXED.solHours,energyWh:500,config:{...core,baselineW:200}};
  const reviewQuiet=expedition.advanceExpedition(warningAtQuiet).campaign;
  equal(reviewQuiet.sol,4);equal(reviewQuiet.mode,'planning');equal(reviewQuiet.plan,warningAtQuiet.plan,'A quiet-day safety review retains the uncommitted field draft.');
  assert.ok(reviewQuiet.events.some(event=>event.id==='E4:4'&&!event.resolved));checks++;
  let partial=ready();
  partial=e.executeScienceStep(partial,'jezero-G-1','mastcam-z',-18,6);partial=e.transmit(partial);
  near(e.scienceSummary(partial).fractions.G,0,'An isolated returned panorama earns no complete objective unit.');
  const afterCamera=partial;
  partial=e.executeScienceStep(partial,'jezero-G-1','pixl',-18,6);
  near(partial.elapsedHours-afterCamera.elapsedHours,2,'PIXL retains its full modeled two hours.');
  equal(partial.products.map(p=>p.bits),[148e6,16e6]);
  near(e.scienceSummary(e.transmit(partial)).fractions.G,.25);
  const allAtOnce=e.acquireTarget(ready(),'jezero-G-1',-18,6);
  near(allAtOnce.energyWh,partial.energyWh);near(allAtOnce.elapsedHours,partial.elapsedHours);
  equal(allAtOnce.completed,partial.completed);
  equal(e.acquireTarget(partial,'jezero-G-1',-18,6),partial);
  let bio=ready(core,3);bio=e.executeScienceStep(bio,'jezero-B-1','sherloc',-18,6);bio=e.transmit(bio);
  near(e.scienceSummary(bio).fractions.B,0);bio=e.executeScienceStep(bio,'jezero-B-1','pixl',-18,6);
  equal(bio.products.map(p=>p.bits),[318.8e6,16e6]);near(e.scienceSummary(e.transmit(bio)).fractions.B,.25);
  const both={...core,instruments:[...core.instruments,'supercam']};
  let laser=ready(both);laser=e.executeScienceStep(laser,'jezero-G-1','mastcam-z',-18,6,'supercam');
  const locked=e.executeScienceStep(laser,'jezero-G-1','pixl',-18,6,'pixl');
  near(locked.energyWh,laser.energyWh);equal(locked.products,laser.products);
  laser=e.executeScienceStep(laser,'jezero-G-1','supercam',-18,6,'supercam');
  equal(laser.products.map(p=>p.bits),[148e6,62e6]);near(laser.elapsedHours,1);
  equal(e.restoreCampaign(e.snapshotCampaign(laser)).targetMethods,{'jezero-G-1':'supercam'});

  let radar=ready({...core,instruments:['mastcam-z','rimfax']});
  radar=e.traverse(radar,100,0,{from:[-118,6],to:[-18,6]});
  radar=e.executeScienceStep(radar,'jezero-G-1','mastcam-z',-18,6,'rimfax');
  const radarBefore=radar;radar=e.executeScienceStep(radar,'jezero-G-1','rimfax',-18,6,'rimfax');
  near(radar.energyWh,radarBefore.energyWh,'RIMFAX power was already charged during driving.');
  near(radar.profileMeters,0);equal(radar.radarUnits,1);equal(radar.products.map(p=>p.bits),[148e6,80e6]);
  near(e.scienceSummary(e.transmit(radar)).fractions.G,.25);
  equal(e.executeScienceStep(radar,'jezero-G-1','rimfax',-18,6,'rimfax'),radar);
  const noTrack=ready({...core,instruments:['mastcam-z','rimfax']});
  equal(e.acquireTarget(noTrack,'jezero-G-1',-18,6).products.length,0);
  const absent=ready({...core,instruments:['mastcam-z']});equal(e.executeScienceStep(absent,'jezero-G-1','mastcam-z',-18,6).products.length,0);
  equal(e.executeScienceStep(ready(),'jezero-G-1','mastcam-z',NaN,6).products.length,0);
  equal(e.executeScienceStep(ready(),'jezero-G-1','pixl',-18,6).products.length,0,'Context observation must precede composition.');

  let low={...ready(core,3),energyWh:490};low=e.executeScienceStep(low,'jezero-B-1','sherloc',-18,6);
  equal(low.safe,true);equal(low.products.length,1);near(e.scienceSummary(e.transmit(low)).fractions.B,0);
  const recovery=expedition.advanceExpedition(low);equal(recovery.campaign.safe,true);equal(recovery.skippedSols,[]);
  const recovered=expedition.advanceExpedition(recovery.campaign);equal(recovered.skippedSols,[]);equal(recovered.campaign.sol,5);
  let retry=e.resolveRoute(recovered.campaign,'reroute');retry=e.commitPlan(retry,plan);
  const beforeRetry=retry;retry=e.acquireTarget(retry,'jezero-B-1',-18,6);
  near(retry.elapsedHours-beforeRetry.elapsedHours,2,'Recovery does not charge a completed SHERLOC observation twice.');
  equal(retry.products.length,2);
  for(const reserve of [.2,.3,.4]){
    const c=ready({...core,reserve}),threshold=2408*reserve;
    const stopped=e.traverse({...c,energyWh:threshold+1},100,10);
    near(stopped.energyWh,threshold);equal(stopped.safe,true);
    equal(expedition.advanceExpedition(stopped).skippedSols,[]);
  }
  let unsafeQuiet={...ready(),config:{...core,baselineW:200},energyWh:1200};
  unsafeQuiet={...unsafeQuiet,sol:3};const blocked=expedition.advanceExpedition(unsafeQuiet);
  assert.ok(blocked.campaign.safe||blocked.campaign.events.some(event=>!event.resolved));checks++;
  equal(blocked.skippedSols,[],'Automatic advancement stops for energy safety review.');
  let waiting=ready();waiting=e.executeScienceStep(waiting,'jezero-G-1','mastcam-z',-18,6);waiting={...waiting,mode:'finished'};
  const backlog=e.dataSummary(waiting);equal(backlog.unreturnedBits,148e6);equal(backlog.lostBits,0);conservation(waiting);
  const lost={...waiting,majorFailures:['S7 rover lost: three consecutive end-sol zero-energy readings.']};
  equal(e.dataSummary(lost).lostBits,148e6);equal(e.dataSummary(lost).onboardBits,0);conservation(lost);
  let noContact=ready();noContact={...noContact,plan:{...noContact.plan,transmit:false},sol:3};
  const noContactAdvance=expedition.advanceExpedition(noContact);equal(noContactAdvance.campaign.plan.transmit,false);
  let relay=ready({...core,downlink:'X-band'});
  relay=e.executeScienceStep(relay,'jezero-G-1','mastcam-z',-18,6);relay=e.transmit(relay);
  while(relay.sol<12){if(relay.events.some(event=>event.id==='E1'&&!event.resolved))relay=e.resolveRoute(relay,'reroute');if(relay.events.some(event=>event.id==='D12'&&!event.resolved))relay=e.declineUnusualRock(relay);relay=e.endSol(relay);}
  equal(relay.events.find(event=>event.id==='E2').resolved,false);
  const withoutDecision=c=>{const copy=structuredClone(c);delete copy.events;delete copy.message;return copy;};
  const held=e.holdForRelay(relay);
  equal(withoutDecision(held),withoutDecision(relay),'Choosing to wait changes no products, quota, energy, time, plan or engineering state.');
  equal(held.events.filter(event=>event.id!=='E2'),relay.events.filter(event=>event.id!=='E2'));
  equal(held.events.find(event=>event.id==='E2').resolved,true);
  assert.match(held.events.find(event=>event.id==='E2').detail,/Crew chose to hold data for the next pass/);checks++;
  equal(e.holdForRelay(held),held,'The explicit wait decision is idempotent.');
  equal(e.restoreCampaign(e.snapshotCampaign(held)),held,'The wait decision and unchanged queue survive save/load.');
  equal(expedition.advanceExpedition(held).campaign.sol,16,'An explicit E2 wait permits quiet-sol progression to the next field day.');
  const overdue=e.endSol({...relay,plan:{...relay.plan,transmit:false}});
  equal(overdue.sol,13);equal(overdue.events.find(event=>event.id==='E2').resolved,false);
  const heldOverdue=e.holdForRelay(overdue);
  equal(withoutDecision(heldOverdue),withoutDecision(overdue),'Legacy overdue E2 saves can acknowledge wait without changing resources.');
  equal(heldOverdue.events.find(event=>event.id==='E2').resolved,true);
  const resumedOverdue=expedition.advanceExpedition(heldOverdue).campaign;
  equal(resumedOverdue.sol,16);equal(resumedOverdue.plan,heldOverdue.plan,'An overdue event review cannot replace the player\'s standing draft with quiet-day zero allocations.');
  const finishedRelay={...relay,mode:'finished'};equal(e.holdForRelay(finishedRelay),finishedRelay);
  // Owner-approved D12: only an explicit Move on choice forfeits this one rock.
  const withoutSamplingDecision=c=>{const copy=structuredClone(c);delete copy.events;delete copy.completed;delete copy.message;return copy;};
  for(const site of SCENARIOS)for(const ranking of rankings)for(const partialReading of [false,true]){
    const unusual=scenarioTargets(site.id).find(target=>target.objective==='B'&&target.unit===2);
    let sample=e.restoreCampaign(e.snapshotCampaign({...e.createCampaign(options(site.id,'W1',false,ranking),core),sol:8}));
    sample=e.commitPlan(sample,plan);
    equal(sample.events.find(event=>event.id==='D12').resolved,false,'Sol8 requires a real sampling decision.');
    const noDecision=e.endSol(sample);
    equal(noDecision.sol,8);near(noDecision.elapsedHours,sample.elapsedHours);near(noDecision.energyWh,sample.energyWh);equal(noDecision.history,sample.history);
    if(partialReading){sample=e.executeScienceStep(sample,unusual.id,'sherloc',unusual.x,unusual.z);sample=e.transmit(sample);}
    const beforeDecline=sample;sample=e.declineUnusualRock(sample);
    equal(withoutSamplingDecision(sample),withoutSamplingDecision(beforeDecline),'Move on preserves actual instrument energy, time, data and contact quota.');
    equal(sample.completed.filter(id=>id===`declined:${unusual.id}`).length,1);equal(sample.events.find(event=>event.id==='D12').resolved,true);equal(sample.events.find(event=>event.id==='D12').actionable,false,'Forfeiture is a recorded limitation, not a recoverable anomaly.');
    equal(e.declineUnusualRock(sample),sample,'D12 decline is idempotent.');
    equal(e.restoreCampaign(e.snapshotCampaign(sample)),sample,'The forfeiture survives reload.');
    equal(e.targetReadiness(sample,unusual.id).allowed,false);
    assert.ok(e.scienceSteps(sample,unusual.id).every(step=>!step.available));checks++;
    const rejected=e.executeScienceStep(sample,unusual.id,'pixl',unusual.x,unusual.z);
    equal(withoutSamplingDecision(rejected),withoutSamplingDecision(sample));equal(rejected.completed,sample.completed);
    equal(withoutSamplingDecision(e.acquireTarget(sample,unusual.id,unusual.x,unusual.z)),withoutSamplingDecision(sample));
    near(e.scienceSummary(sample).fractions.B,0,'A declined partial product cannot become a B unit.');
    if(!partialReading&&ranking===rankings[0]){
      const onlyDeclinedPending={...sample,config:{...sample.config,instruments:sample.config.instruments.filter(id=>id!=='meda')},completed:[...sample.completed,...scenarioTargets(site.id).filter(target=>target.id!==unusual.id).map(target=>`science:${target.id}`)]};
      assert.ok(e.skipQuietSols(onlyDeclinedPending).sol>8,'The legacy quiet-skip helper does not stall on an explicitly forfeited rock.');checks++;
    }
    while(sample.mode!=='finished'){
      if(sample.events.some(event=>event.id==='E1'&&!event.resolved))sample=e.resolveRoute(sample,'reroute');
      if(sample.mode==='planning')sample=e.commitPlan(sample,plan);
      for(const target of scenarioTargets(site.id).filter(target=>target.objective==='B'&&target.unit!==2&&(target.unit===1?sample.sol===8:target.availableSol===sample.sol)))sample=e.acquireTarget(sample,target.id,target.x,target.z);
      sample=e.endSol(sample);
    }
    near(e.scienceSummary(sample).fractions.B,.75,'Returning the other three B bundles cannot resurrect declined B2.');
    near(e.scienceSummary(sample).sciencePoints,30*.75*[.5,.3,.2][ranking.indexOf('B')]);conservation(sample);
  }
  for(const site of SCENARIOS){
    const unusual=scenarioTargets(site.id).find(target=>target.objective==='B'&&target.unit===2);
    let examined=e.restoreCampaign(e.snapshotCampaign({...e.createCampaign(options(site.id),core),sol:8}));examined=e.commitPlan(examined,plan);
    examined=e.acquireTarget(examined,unusual.id,unusual.x,unusual.z);
    equal(examined.events.find(event=>event.id==='D12').resolved,true);equal(e.declineUnusualRock(examined),examined,'Already acquired B2 cannot be retroactively declined.');
    equal(e.endSol(examined).sol,9);near(e.scienceSummary(e.transmit(examined)).fractions.B,.25);
    const oldCurrent=structuredClone(examined);oldCurrent.events=oldCurrent.events.filter(event=>event.id!=='D12');
    const hydratedCurrent=e.restoreCampaign(e.snapshotCampaign(oldCurrent));equal(hydratedCurrent.events.find(event=>event.id==='D12').resolved,true,'Legacy completed Sol8 B2 is recognized.');
    const oldLate={...e.createCampaign(options(site.id),core),sol:9};
    const hydratedLate=e.restoreCampaign(e.snapshotCampaign(oldLate));equal(hydratedLate.events.some(event=>event.id==='D12'),false,'An old post-sol8 save receives no retroactive expiry.');
    const lateReady=e.commitPlan(hydratedLate,plan);equal(e.targetReadiness(lateReady,unusual.id).allowed,true);
    const lateDecline=e.declineUnusualRock(lateReady);equal(e.targetReadiness(lateDecline,unusual.id).allowed,false,'A legacy player may explicitly decline later.');
    const beforeRelease=e.createCampaign(options(site.id),core);equal(e.declineUnusualRock(beforeRelease),beforeRelease);
  }
  const legacy=structuredClone(allAtOnce);delete legacy.targetMethods;equal(e.restoreCampaign(e.snapshotCampaign(legacy)),legacy);
  for(const bad of [null,[],{'jezero-G-1':'invented'},{'syrtis-G-1':'pixl'}])assert.throws(()=>e.restoreCampaign(e.snapshotCampaign({...allAtOnce,targetMethods:bad})));checks+=4;
  console.log(`PASS ${checks} expedition/staged-science/data checks; ${playthroughs} complete playthroughs (3 sites × 3 windows × 2 durations × 6 rankings).`);
} finally { await server.close(); }
