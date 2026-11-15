import assert from 'node:assert/strict';
import {createServer} from 'vite';
const saved=new Map();
globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
globalThis.window={localStorage:globalThis.localStorage};
const server=await createServer({configFile:'vite.config.ts',server:{middlewareMode:true,hmr:false},appType:'custom'});
try {
  const {proposeConfiguration,proposalSafe,configFingerprint,supportedTargets}=await server.ssrLoadModule('/src/engine/preparation.ts');
  const {DEFAULT_CONFIG}=await server.ssrLoadModule('/src/nasa/data.ts');
  const {roomPath,roomBlocked,CREW_STATIONS}=await server.ssrLoadModule('/src/ui/crew/roomNavigation.ts');
  let checked=0;
  for(const reserve of [.2,.4])for(const downlink of ['UHF','X-band'])for(const scienceCadence of [1,4])for(const station of ['payload','power','communications'])for(const priority of ['science','safety','mass']){
    const config={...DEFAULT_CONFIG,reserve,downlink,scienceCadence};
    const p=proposeConfiguration(config,station,priority);
    assert.deepEqual(p,proposeConfiguration(config,station,priority),'deterministic proposal');
    assert.equal(p.basedOn,configFingerprint(config));
    if(p.config){
      assert.ok(proposalSafe(p.config),'bot never proposes failed constraints or modeled deficit/backlog');
      assert.ok(supportedTargets(p.config).length>=supportedTargets(config).length);
      const allowed=station==='payload'?['instruments']:station==='power'?['reserve','scienceCadence','moxieRun']:['downlink'];
      for(const key of Object.keys(config))if(!allowed.includes(key))assert.deepEqual(p.config[key],config[key],station+' only edits owned fields');
    }
    checked++;
  }
  const impossible=proposeConfiguration({...DEFAULT_CONFIG,baselineW:950},'communications','safety');
  assert.equal(impossible.config,null);
  const stale=proposeConfiguration(DEFAULT_CONFIG,'power','safety');
  assert.notEqual(stale.basedOn,configFingerprint({...DEFAULT_CONFIG,reserve:.4}));
  for(let seat=0;seat<6;seat++)for(const [x,z] of CREW_STATIONS){
    const path=roomPath({x:0,z:3.8},{x,z:z+1.15},seat);
    assert.ok(path.length);
    assert.ok(path.every(p=>!roomBlocked(p.x,p.z,seat)));
    assert.ok(Math.hypot(path.at(-1).x-x,path.at(-1).z-z)<1.9,'every station is reachable');
  }
  const {useGameStore}=await server.ssrLoadModule('/src/store/gameStore.ts');
  saved.set('ares-01-campaign',JSON.stringify({version:5,state:{missionPhase:'engineering',roverConfig:{...DEFAULT_CONFIG,reserve:.3},selectedCrewId:'rihabe'}}));
  await useGameStore.persist.rehydrate();
  assert.equal(useGameStore.getState().preparation.stage,'workshop');
  assert.equal(useGameStore.getState().roverConfig.reserve,.3);
  useGameStore.getState().setPreparation({stage:'review',activeStation:'review'});
  const persisted=JSON.parse(saved.get('ares-01-campaign'));
  assert.equal(persisted.state.preparation.stage,'review');
  useGameStore.getState().reset();
  assert.equal(useGameStore.getState().preparation.stage,'entry');
  assert.deepEqual(useGameStore.getState().preparation.decisions,{});
  const campaignEngine=await server.ssrLoadModule('/src/engine/campaign.ts');
  let live={...campaignEngine.createCampaign(campaignEngine.DEFAULT_OPTIONS,DEFAULT_CONFIG),sol:2};
  live=campaignEngine.commitPlan(live,{driveHours:0,scienceHours:8.5,science:true,weather:false,transmit:true});
  live=campaignEngine.acquireTarget(live,'jezero-G-1',-18,6);
  saved.set('ares-01-campaign',JSON.stringify({version:7,state:{campaign:live,missionPhase:'mars'}}));
  await useGameStore.persist.rehydrate();assert.deepEqual(useGameStore.getState().campaign,live);
  const earlyDraft=structuredClone(live);delete earlyDraft.scienceSpentHours;delete earlyDraft.plan.scienceHours;
  saved.set('ares-01-campaign',JSON.stringify({version:7,state:{campaign:earlyDraft,missionPhase:'mars'}}));
  await useGameStore.persist.rehydrate();assert.equal(useGameStore.getState().campaign.scienceSpentHours,2.5);assert.equal(useGameStore.getState().campaign.plan.scienceHours,8.5);
  saved.set('ares-01-campaign',JSON.stringify({version:7,state:{campaign:{...live,elapsedHours:-1},missionPhase:'mars'}}));
  await useGameStore.persist.rehydrate();assert.equal(useGameStore.getState().campaign,null);assert.equal(useGameStore.getState().missionPhase,'engineering');assert.match(useGameStore.getState().notice,/invalid/);
  useGameStore.getState().reset();
  console.log('PASS current and early-draft surface save hydration, hour normalization and invalid-save rejection');
  console.log('PASS '+checked+' proposal scenarios, all 36 station paths, save migration, preparation persistence and reset');
} finally {await server.close();}
