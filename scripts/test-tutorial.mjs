import assert from 'node:assert/strict';
import {createServer} from 'vite';
const saved=new Map();
globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
globalThis.window={localStorage:globalThis.localStorage};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
let count=0;const ok=(value,msg)=>{assert.ok(value,msg);count++;},eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);count++;};
try {
 const t=await server.ssrLoadModule('/src/engine/tutorial.ts');
 const e=await server.ssrLoadModule('/src/engine/campaign.ts');
 const {DEFAULT_CONFIG}=await server.ssrLoadModule('/src/nasa/data.ts');
 const {calculateEngineering}=await server.ssrLoadModule('/src/nasa/engineering.ts');
 const {useGameStore:store}=await server.ssrLoadModule('/src/store/gameStore.ts');
 const options=structuredClone(e.DEFAULT_OPTIONS),config=structuredClone(DEFAULT_CONFIG);
 const base={view:'preparation',preparation:{stage:'entry',activeStation:null,decisions:{}},selectedCrewId:'kavi',roverConfig:config,missionOptions:options,campaign:null,launchStage:0,launchFailures:[],launchAttempt:1,confirmedMission:null,missionRecord:null,missionProgress:{distance:0,scannedTargets:[]},phase:'active',nearbyTargetId:null};
 const only=(ctx,id)=>t.getTutorialPrompt(ctx,t.TUTORIAL_CONCEPT_IDS.filter(other=>other!==id));
 const beforeAdd={...config,instruments:config.instruments.filter(id=>id!=='pixl')};
 const change={before:beforeAdd,after:config,instrument:'pixl'};
 let campaign=e.createCampaign(options,config),operation=e.commitPlan(campaign,{driveHours:4,scienceHours:8.5,science:true,weather:true,transmit:true});
 const surface={...base,view:'surface',campaign};
 const contexts={
  C1:base,
  C2:{...base,preparation:{stage:'workshop',activeStation:'payload',decisions:{}}},
  C3:{...base,preparation:{stage:'briefing',activeStation:'briefing',decisions:{}}},
  C4:{...base,preparation:{stage:'workshop',activeStation:'payload',decisions:{}},tutorialInstrumentChange:change},
  C5:{...base,preparation:{stage:'workshop',activeStation:'payload',decisions:{}}},
  C6:{...base,preparation:{stage:'review',activeStation:'review',decisions:{}}},
  'C7:launch':{...base,view:'launch',launchStage:1,confirmedMission:{config,options}},
  'C7:landing':{...base,view:'launch',launchStage:4,confirmedMission:{config,options}},
  'C8:plan':surface,
  'C8:drive':{...surface,campaign:operation},
  'C8:scan':{...surface,campaign:{...operation,sol:2},nearbyTargetId:'jezero-G-1'},
  'C8:end':{...surface,campaign:e.waitHours(operation,1)},
  'C9:event':{...surface,campaign:{...campaign,sol:5,events:[{id:'E1',sol:5,title:'Route hazard',detail:'Actual route exceeds its mobility limit.',resolved:false}]}},
  'C9:report':{...surface,view:'report',campaign:{...campaign,mode:'finished'},missionRecord:{endReason:'Completed 30 sols with no returned evidence.'}},
 };
 for(const [id,context]of Object.entries(contexts)){
  const snapshot=JSON.stringify(context),prompt=only(context,id);
  eq(prompt?.id,id,'actual trigger '+id);eq(prompt.step,id.slice(0,2));ok(prompt.body.length>0&&prompt.target);eq(JSON.stringify(context),snapshot,'prompt is pure '+id);
  eq(t.getTutorialPrompt(context,t.TUTORIAL_CONCEPT_IDS),null,'completed concepts stay silent '+id);
 }
 eq(only({...base,view:'welcome'},'C1'),null);
 eq(t.getTutorialPrompt({...base,view:'welcome'},[],'C7:launch'),null,'manual reopen cannot invent a confirmed launch');
 eq(t.getTutorialPrompt({...base,view:'welcome'},[],'C7:landing'),null,'manual reopen cannot invent a completed landing');
 eq(only({...contexts.C2,selectedCrewId:'aaryan'},'C2'),null,'direct owner is not a bot proposal');
 eq(only({...contexts.C2,proposalVisible:false},'C2'),null);
 eq(only({...contexts.C4,tutorialInstrumentChange:{...change,before:config}},'C4'),null,'removal/unchanged payload does not trigger added instrument');
 eq(only({...contexts['C7:launch'],launchStage:0},'C7:launch'),null,'no invented launch result before check');
 eq(only({...surface,campaign:operation,nearbyTargetId:'jezero-G-1'},'C8:scan'),null,'sol1 cannot scan future rock');
 eq(only({...contexts['C8:scan'],campaign:{...operation,sol:2,safe:true}},'C8:scan'),null);
 eq(only({...surface,campaign:{...operation,mobilityDisabled:true}},'C8:drive'),null);
 eq(only(surface,'C9:event'),null);
 eq(only({...surface,campaign:{...campaign,events:[{id:'E4:1',sol:1,title:'Conditional deficit',detail:'Actual low-energy forecast',resolved:false}]}},'C9:event'),null,'conditional E4 does not consume the scheduled-event concept');
 const immobile={...contexts['C9:event'],campaign:{...contexts['C9:event'].campaign,events:[{...contexts['C9:event'].campaign.events[0],resolved:true,actionable:false}]}};
 ok(only(immobile,'C9:event').body.join(' ').includes('requires no reroute'),'non-actionable scheduled event remains honest');
 const live=only(contexts.C4,'C4').body.join(' '),a=calculateEngineering(beforeAdd),b=calculateEngineering(config);
 ok(live.includes(a.massKg.toFixed(1))&&live.includes(b.massKg.toFixed(1))&&live.includes(b.peakW.toFixed(1))&&live.includes(b.dataMbit.toFixed(1)),'C4 live values');
 const previewBefore=JSON.stringify({config,options}),preview=t.getFailedCheckPreview(config,options);
 eq(JSON.stringify({config,options}),previewBefore,'C5 does not mutate payload or settings');
 ok(preview.failed.value>preview.failed.limit);ok(preview.fixed.value<=preview.fixed.limit);
 eq(preview.failed.value,e.missionChecks(preview.previewOptions,config).launchMass);
 eq(preview.fixed.value,e.missionChecks(preview.fixedOptions,config).launchMass);
 preview.previewConfig.instruments.length=0;eq(config.instruments.length,7,'isolated clone cannot mutate live loadout');
 const landing=only({...contexts['C7:landing'],confirmedMission:{config,options:{...options,site:'columbia'}}},'C7:landing');
 ok(landing.body.join(' ').includes('1148.00')&&landing.body.join(' ').includes('disables mobility'));
 // Returning from launch retains the old confirmation, but workshop explanations must follow current controls.
 const redesign={...contexts.C6,roverConfig:{...config,instruments:config.instruments.filter(id=>id!=='rimfax')},missionOptions:{...options,relay:'O3',ranking:['E','G','B']},confirmedMission:{config,options}};
 const redesignedCheck=e.missionChecks(redesign.missionOptions,redesign.roverConfig);
 const redesignedBody=only(redesign,'C6').body.join(' ');
 ok(redesignedBody.includes('$'+redesignedCheck.budget.totalCostUsdMillion)&&redesignedBody.includes('20 sols'),'C6 uses current workshop rather than retained confirmation');
 const fullRedesign={...redesign,roverConfig:config};
 ok(only(fullRedesign,'C6').body.join(' ').includes('$2840'),'retained O1 confirmation cannot hide current O3 overrun');
 const ranked=t.getTutorialPrompt({...redesign,preparation:{stage:'briefing',activeStation:'briefing',decisions:{}}},[],'C3').body[0];
 ok(ranked.startsWith('50% Environment and exploration'),'C3 uses current objective order after returning to engineering');
 const relaunched=t.getTutorialPrompt(redesign,[],'C7:launch').body[0];
 ok(relaunched.includes('1025.0 / 1550')&&!relaunched.includes('1372.0'),'C7 manual reopen retains confirmed launch snapshot');
 const landed=t.getTutorialPrompt({...redesign,missionOptions:{...redesign.missionOptions,site:'columbia'}},[],'C7:landing').body[0];
 ok(landed.includes('1055.75')&&!landed.includes('1144.64'),'C7 landing reopens the confirmed site and payload');
 const red=only({...contexts.C6,missionOptions:{...options,relay:'O3',vehicle:'light'}},'C6').body.join(' ');
 ok(red.includes('1375.0 > 1200')&&red.includes('20 sols')&&red.includes('one locked retry'));
 ok(only(contexts.C2,'C2').body.join(' ').includes('not implemented'),'no fabricated formal orders');
 ok(only(contexts['C9:report'],'C9:report').body.join(' ').includes('not implemented'),'no fabricated full score');
 eq(Object.keys(t.GLOSSARY).map(x=>x.toLowerCase()).sort(),['margin','reserve','sol','safe mode','accepted risk','relay pass','relay orbit','areostationary','tier','budget'].sort());
 for(const station of ['briefing','payload','power','communications','review'])ok(t.STATION_HELP[station]?.length>0);

 const s=()=>store.getState();
 eq(s().tutorialMode,'guided');eq(s().tutorialHasLaunched,false);eq(s().paceMode,'quick');
 s().setTutorialMode('skip');s().beginTutorialRun('skip');eq(s().tutorialMode,'skip');eq(s().tutorialHasLaunched,true);
 s().setTutorialMode('guided');s().markTutorialStepSeen('C7:launch');eq(s().tutorialStepsSeen,['C7','C7:launch']);
 s().markTutorialStepSeen('C7:launch');eq(s().tutorialStepsSeen,['C7','C7:launch']);eq(s().tutorialLastPromptId,'C7:launch');
 ok(only(contexts['C7:landing'],'C7:landing')!==null,'subsequent landing concept remains available');
 s().setPaceMode('explore');const preferences={mode:s().tutorialMode,seen:s().tutorialStepsSeen,pace:s().paceMode};
 s().reset();eq({mode:s().tutorialMode,seen:s().tutorialStepsSeen,pace:s().paceMode},preferences,'campaign reset preserves tutorial preferences and progress');
 eq(s().tutorialRunStarted,false);s().beginTutorialRun();eq(s().tutorialMode,'skip','subsequent launch defaults Skip without asking');
 s().reset();s().setTutorialMode('guided');s().beginTutorialRun();eq(s().tutorialMode,'guided','explicit Help choice on later welcome takes precedence over default');
 s().setTutorialMode('guided');s().beginTutorialRun();eq(s().tutorialMode,'guided','existing run/home resume preserves chosen mode');
 const persistence=JSON.parse(saved.get('ares-01-campaign'));eq(persistence.version,8);eq(persistence.state.paceMode,'explore');
 store.setState({tutorialMode:'skip',paceMode:'quick',tutorialStepsSeen:[]});saved.set('ares-01-campaign',JSON.stringify(persistence));await store.persist.rehydrate();
 eq(s().tutorialMode,'guided');eq(s().paceMode,'explore');eq(s().tutorialStepsSeen,['C7','C7:launch']);
 const gameplay=state=>Object.fromEntries(Object.entries(state).filter(([key,value])=>!key.startsWith('tutorial')&&key!=='paceMode'&&typeof value!=='function'));
 store.setState({campaign,missionPhase:'mars',hintsShown:['existing-crew-hint'],hintsFollowed:['existing-crew-hint'],teamworkPoints:7});
 const realBefore=structuredClone(gameplay(s()));
 s().markTutorialStepSeen('C8:plan');s().setTutorialMode('skip');s().setPaceMode('quick');s().replayTutorial();
 eq(s().tutorialStepsSeen,[]);eq(s().tutorialMode,'guided');eq(gameplay(s()),realBefore,'coach actions and replay leave mission, hints and points untouched');
 const changeBefore=JSON.stringify(config);s().recordTutorialInstrumentChange(beforeAdd,config,'pixl');eq(JSON.stringify(config),changeBefore);eq(s().tutorialInstrumentChange.instrument,'pixl');
 // Same real decisions through the reducer under every tutorial/pace combination.
 function play(mode,pace){
  s().setTutorialMode(mode);s().setPaceMode(pace);
  let c=e.createCampaign(options,{...config,instruments:['mastcam-z','pixl','sherloc','meda']});
  for(let sol=1;sol<=30;sol++){
   if(c.events.some(event=>event.id==='E1'&&!event.resolved))c=e.resolveRoute(c,'reroute');
   if(c.mode==='planning')c=e.commitPlan(c,{driveHours:0,scienceHours:8.5,science:true,weather:true,transmit:true});
   const prompt=t.getTutorialPrompt({...surface,campaign:c},[]);if(prompt&&mode==='guided')s().markTutorialStepSeen(prompt.id);
   if(sol<=10)c=e.acquireWeather(c);
   c=e.endSol(c);
  }
  return {campaign:c,summary:e.scienceSummary(c)};
 }
 const canonical=play('skip','quick');
 for(const mode of ['guided','skip'])for(const pace of ['quick','explore'])eq(play(mode,pace),canonical,'identical events, energy, outcomes and scoring '+mode+'/'+pace);
 const legacy={version:7,state:{started:true,preparation:{stage:'briefing',activeStation:'briefing',decisions:{}},roverConfig:config}};
 saved.set('ares-01-campaign',JSON.stringify(legacy));await store.persist.rehydrate();eq(s().tutorialMode,'skip');eq(s().tutorialHasLaunched,true);
 const normalized=t.normalizeTutorialState({tutorialMode:'corrupt',tutorialStepsSeen:['C1','C1','fake'],paceMode:'invalid'});eq(normalized.tutorialMode,'guided');eq(normalized.tutorialStepsSeen,['C1']);eq(normalized.paceMode,'quick');
 console.log(`PASS ${count} tutorial trigger, live-value, preview immutability, preference/save, hint isolation and Guided/Skip × Quick/Explore parity checks.`);
 console.log('NOT CLAIMED: human first-time completion, added tutorial duration <=90 seconds, or three-playtester comprehension. Formal orders and remaining full-score ledgers are not fabricated.');
} finally {await server.close();}
