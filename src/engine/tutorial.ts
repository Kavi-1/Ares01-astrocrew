import { FIXED, INSTRUMENTS, type InstrumentId, type RoverConfig } from '../nasa/data';
import { calculateEngineering } from '../nasa/engineering';
import { missionChecks, generationForSol, forecastSol, scienceSummary, targetReadiness, type Campaign, type MissionOptions } from './campaign';
import { STATION_OWNERS, type PreparationState } from './preparation';
import { getCrew, type CrewId } from '../data/crew';
import { OBJECTIVES, scenarioTargets } from '../data/scenarios';
import type { MissionRecord } from './missionFailure';

export type TutorialMode = 'guided' | 'skip';
export type PaceMode = 'quick' | 'explore';
export type TutorialStep = 'C1'|'C2'|'C3'|'C4'|'C5'|'C6'|'C7'|'C8'|'C9';
export const TUTORIAL_STEPS: TutorialStep[] = ['C1','C2','C3','C4','C5','C6','C7','C8','C9'];
export const TUTORIAL_CONCEPT_IDS = ['C1','C2','C3','C4','C5','C6','C7:launch','C7:landing','C8:plan','C8:drive','C8:scan','C8:end','C9:event','C9:report'] as const;
export type TutorialConceptId = typeof TUTORIAL_CONCEPT_IDS[number];
export type TutorialInstrumentChange = { before:RoverConfig; after:RoverConfig; instrument:InstrumentId };
export type TutorialContext = {
  view:'welcome'|'crew'|'preparation'|'launch'|'surface'|'report';
  preparation:PreparationState; selectedCrewId:CrewId; roverConfig:RoverConfig;
  missionOptions:MissionOptions; campaign:Campaign|null; launchStage:number;
  launchFailures:string[]; launchAttempt:1|2;
  confirmedMission?:{config:RoverConfig;options?:MissionOptions}|null;
  missionRecord?:MissionRecord|null;
  missionProgress:{distance:number;scannedTargets:string[]};
  tutorialInstrumentChange?:TutorialInstrumentChange|null;
  instrumentChange?:TutorialInstrumentChange|null;
  phase?:string; nearbyTargetId?:string|null; scanningTargetId?:string|null;
  proposalVisible?:boolean;
};
export type TutorialPrompt = { id:TutorialConceptId; step:TutorialStep; title:string; body:string[]; target:string; action?:'red-check' };
export function isTutorialConcept(id:unknown):id is TutorialConceptId {return typeof id==='string'&&(TUTORIAL_CONCEPT_IDS as readonly string[]).includes(id);}
const stepFor=(id:TutorialConceptId)=>id.slice(0,2) as TutorialStep;
const n=(value:number,digits=1)=>value.toFixed(digits);
const signed=(value:number,digits=1)=>(value>=0?'+':'')+n(value,digits);
const name=(id:string)=>OBJECTIVES.find(o=>o.id===id)?.name??id;

export const GLOSSARY:Record<string,string> = {
  Margin:'Limit minus the design value. Negative fails the check; under 10% remaining is an amber advisory, not a new hard limit.',
  Reserve:'The chosen 20%, 30% or 40% battery safety threshold. It is not a charging rate.',
  Sol:'One Mars day: about 24.66 modeled hours. Reading and planning use no mission time.',
  'Safe mode':'Protective operations that cancel optional work and skip the next sol once. Baseline power and an already-planned contact remain.',
  'Accepted risk':'A failed check explicitly accepted with its deterministic consequence shown beforehand. It is not a random chance.',
  'Relay pass':'A contact opportunity that transfers queued data within its capacity; unreturned observations do not yet count.',
  'Relay orbit':'The selected relay arrangement. It changes contact capacity, launch mass and cost.',
  Areostationary:'An orbit matching Mars’s rotation, keeping the relay over the same longitude. The game’s effective service quota is an approved assumption.',
  Tier:'Returned-evidence breadth: full covers all three objectives, baseline covers the top-ranked two, minimum covers at least one.',
  Budget:'The fixed mission spending limit. An accepted overrun shortens surface operations from 30 to 20 sols.',
};
export const STATION_HELP:Record<string,string> = {
  welcome:'Enter the real mission. Guided explains controls; Quick and Explore change presentation only.',
  crew:'Choose one of six responsibilities. Five deterministic teammates propose; you can review or take over.',
  briefing:'Choose a site and order the three objectives. The ranking gives 50%, 30% and 20% scientific weights.',
  payload:'Inspect the rover hardware and compare mass, power, data and budget before applying an instrument change.',
  power:'Examine reserve and the assumed activity schedule. Reserve is a safety threshold; only executed work consumes mission energy.',
  communications:'Compare queued science with contact capacity. Partial transmission preserves the remaining data.',
  review:'Check vehicle mass, landing index and budget. Fix the design or read the exact supported override consequence.',
  launch:'Watch the confirmed launch and landing calculations. Their results follow the selected design, without dice.',
  surface:'Commit a sol plan, drive to available targets, scan and return evidence, then end the sol. Thinking time is unlimited.',
  report:'Read the outcome and cause chain, then compare returned objective fractions and the implemented scoring categories.',
};
export type FailedCheckPreview = {
  title:string; explanation:string; failure:string; fix:string;
  failed:{label:string;value:number;limit:number;unit:string;margin:number};
  fixed:{label:string;value:number;limit:number;unit:string;margin:number};
  previewConfig:RoverConfig;previewOptions:MissionOptions;fixedOptions:MissionOptions;
};
/** An isolated counterfactual built entirely from real selectable values, never committed. */
export function getFailedCheckPreview(config:RoverConfig,options:MissionOptions):FailedCheckPreview {
  const previewConfig=structuredClone(config);
  const previewOptions:MissionOptions={...structuredClone(options),vehicle:'light',relay:'O3'};
  const failed=missionChecks(previewOptions,previewConfig);
  const fixedOptions:MissionOptions={...structuredClone(previewOptions),vehicle:'medium'};
  const fixed=missionChecks(fixedOptions,previewConfig);
  return {
    title:'Preview only · a real launch-mass red check',
    explanation:'This counterfactual keeps your current rover payload, but previews the selectable light vehicle and O3 relay. It does not change your loadout, launch choices or accepted risks. Vehicle allowances and relay mass are approved game assumptions.',
    failed:{label:'Light vehicle + O3 relay',value:failed.launchMass,limit:failed.capacity,unit:'kg',margin:failed.capacity-failed.launchMass},
    fixed:{label:'Medium vehicle + O3 relay',value:fixed.launchMass,limit:fixed.capacity,unit:'kg',margin:fixed.capacity-fixed.launchMass},
    failure:`${n(failed.launchMass)} kg exceeds ${failed.capacity} kg by ${n(failed.launchMass-failed.capacity)} kg. Accepting this actual mass failure would fail launch and require the one locked redesign retry.`,
    fix:`Change only the preview vehicle to medium: ${n(fixed.launchMass)} / ${fixed.capacity} kg, leaving ${n(fixed.capacity-fixed.launchMass)} kg mass margin. Other checks must still be reviewed; a green mass check alone is not launch approval.`,
    previewConfig,previewOptions,fixedOptions,
  };
}

/** Pure explanations of authoritative state; neither tutorial nor pace is a physics input. */
export function getTutorialPrompt(ctx:TutorialContext,seen:readonly string[]=[],forceId?:string):TutorialPrompt|null {
  const c=ctx.campaign,workshop=['welcome','crew','preparation'].includes(ctx.view);
  const config=workshop?ctx.roverConfig:c?.config??ctx.confirmedMission?.config??ctx.roverConfig;
  const options=workshop?ctx.missionOptions:c?.options??ctx.confirmedMission?.options??ctx.missionOptions;
  const checks=missionChecks(options,config),r=calculateEngineering(config),station=ctx.preparation.activeStation;
  const change=ctx.instrumentChange??ctx.tutorialInstrumentChange;
  const ids:TutorialConceptId[]=[];
  if(ctx.view==='crew'||ctx.view==='preparation'&&ctx.preparation.stage==='entry')ids.push('C1');
  if(ctx.view==='preparation'&&station&&['payload','power','communications'].includes(station)&&ctx.selectedCrewId!==STATION_OWNERS[station]&&ctx.preparation.decisions[station as 'payload'|'power'|'communications']?.mode!=='takeover'&&ctx.proposalVisible!==false)ids.push('C2');
  if(ctx.view==='preparation'&&station==='briefing')ids.push('C3');
  if(ctx.view==='preparation'&&station==='payload'&&change&&!change.before.instruments.includes(change.instrument)&&change.after.instruments.includes(change.instrument))ids.push('C4');
  if(ctx.view==='preparation'&&station==='payload')ids.push('C5');
  if(ctx.view==='preparation'&&station==='review')ids.push('C6');
  if(ctx.view==='launch'&&ctx.launchStage>=1&&ctx.launchStage<4||ctx.view==='preparation'&&ctx.launchFailures.length>0)ids.push('C7:launch');
  if(ctx.view==='launch'&&ctx.launchStage>=4||ctx.view==='surface'&&c)ids.push('C7:landing');
  if(ctx.view==='surface'&&c&&ctx.phase!=='paused'){
    if(c.events.some(e=>(e.id==='E1'||e.id==='E2')&&(!e.resolved||e.sol===c.sol)))ids.push('C9:event');
    if(c.mode==='planning')ids.push('C8:plan');
    if(c.mode==='operations'&&!c.safe){
      if(!c.mobilityDisabled&&c.plan.driveHours>c.driveHours)ids.push('C8:drive');
      if(ctx.nearbyTargetId&&targetReadiness(c,ctx.nearbyTargetId).allowed)ids.push('C8:scan');
      if(c.elapsedHours>0||c.completed.some(id=>id.startsWith('science:')))ids.push('C8:end');
    }
    if(c.safe)ids.push('C8:plan');
  }
  if(ctx.view==='report')ids.push('C9:report');
  const aliases:Record<string,TutorialConceptId>={C7:'C7:launch',C8:'C8:plan',C9:'C9:event'};
  const wanted=forceId?(aliases[forceId]??forceId):undefined;
  const id=wanted?(isTutorialConcept(wanted)?wanted:null):ids.find(id=>!seen.includes(id));
  if(!id)return null;
  const prompt=(title:string,target:string,body:string[],action?:'red-check'):TutorialPrompt=>({id,step:stepFor(id),title,target,body,...(action?{action}:{})});
  switch(id){
    case 'C1':return prompt('Choose your responsibility','seats',[
      `${getCrew(ctx.selectedCrewId).name} is your selected ${getCrew(ctx.selectedCrewId).role.toLowerCase()}. Compare all six seats with the arrows or select a teammate in the room. Five deterministic bots advise; you decide.`,
      'You own one responsibility. Five deterministic bots propose and comment; you can accept, revise or take over. Nothing rolls dice or locks your decisions.',
    ]);
    case 'C2':return prompt('Review a real teammate’s proposal','team-proposal',[
      'Accept applies the displayed proposal. Ask to revise changes its priority; compare the new margins. Take over opens the same controls for your own decision.',
      'Formal Obey / Counter / Refuse orders are not implemented in this build. These would mean follow, propose an alternative, or decline an order; the coach does not fabricate an order or award teamwork points.',
    ]);
    case 'C3':return prompt('Rank the evidence you want back','objectives',[
      options.ranking.map((objective,index)=>`${[50,30,20][index]}% ${name(objective)}`).join(' · '),
      'Rank changes scientific weights and initial return priority. Only fully returned, qualifying evidence bundles count. Changing a dropdown swaps priorities so all three stay distinct.',
    ]);
    case 'C4':{
      if(!change)return null;
      const before=calculateEngineering(change.before),after=calculateEngineering(change.after);
      const a=missionChecks(options,change.before),b=missionChecks(options,change.after);
      return prompt('Watch what this instrument changes','margins',[
        `${INSTRUMENTS.find(i=>i.id===change.instrument)?.name??change.instrument} in your last instrument-add preview: mass ${n(before.massKg)} → ${n(after.massKg)} kg (${signed(after.massKg-before.massKg)}); peak ${n(before.peakW)} → ${n(after.peakW)} W; data ${n(before.dataMbit)} → ${n(after.dataMbit)} Mbit; budget $${a.budget.totalCostUsdMillion} → $${b.budget.totalCostUsdMillion} M.`,
        `Budget $${a.budget.totalCostUsdMillion} → $${b.budget.totalCostUsdMillion} M; ${signed(b.budget.remainingBudgetUsdMillion,0)} M remains in that preview. Your current applied rover is ${n(r.massKg)} kg; the preview changes it only when confirmed.`,
        'Margin = limit − value. Green passes; amber means under 10% remaining, not an automatic failure; red fails that check. An installed instrument may add no peak demand if another instrument already sets the peak.',
      ]);
    }
    case 'C5':return prompt('Learn a red check without changing your rover','red-preview',[
      'Use “Show me a red check” here to compare your exact payload with two real selectable vehicle/relay combinations. The failed calculation and its fix are isolated previews.',
      `Your actual rover remains ${n(r.massKg)} kg with ${config.instruments.length} installed instruments. No preview accepts risk or changes the mission.`,
    ],'red-check');
    case 'C6':{
      const consequences=[!checks.massPass?`Mass ${n(checks.launchMass)} > ${checks.capacity} kg: accepting fails launch and permits one locked retry.`:`Launch mass ${n(checks.launchMass)} / ${checks.capacity} kg passes.`,!checks.landingPass?`Landing index ${n(checks.landingDemand,2)} > 1125 kg-equivalent: accepting disables mobility and leaves the final headline FAILED.`:`Landing index ${n(checks.landingDemand,2)} / 1125 kg-equivalent passes.`,!checks.budget.withinBudget?`Cost $${checks.budget.totalCostUsdMillion} > $${checks.budget.budget.amountUsdMillion} M: accepting shortens surface operations to 20 sols.`:`Budget $${checks.budget.totalCostUsdMillion} / $${checks.budget.budget.amountUsdMillion} M permits 30 sols.`];
      return prompt('Read the consequence before go/no-go','readiness',[
        'Fix means return to the owning station; Drop means remove hardware there and recheck science access. Override means explicitly accept a supported failed check using its checkbox. Unsupported hard checks cannot be waived.',
        ...consequences,
      ]);
    }
    case 'C7:launch':{
      if(!ctx.confirmedMission&&!c&&!ctx.launchFailures.length)return null;
      const confirmed=missionChecks(ctx.confirmedMission?.options??c?.options??ctx.missionOptions,ctx.confirmedMission?.config??c?.config??ctx.roverConfig);
      return prompt('Launch follows the confirmed mass check','flight-result',[
      ctx.launchFailures.length?ctx.launchFailures.at(-1)!:`Confirmed launch mass ${n(confirmed.launchMass)} / ${confirmed.capacity} kg: ${confirmed.massPass?'the launch-mass check passes':'the launch-mass check fails'}.`,
      ctx.launchFailures.length?'The failure returns to engineering once. Its mass check is locked on retry, and the original cause stays in the final report.':'This calculation includes the chosen relay mass. The cinematic does not roll a success chance.',
    ]);
    }
    case 'C7:landing':{
      if(!ctx.confirmedMission&&!c)return null;
      const confirmed=missionChecks(ctx.confirmedMission?.options??c?.options??ctx.missionOptions,ctx.confirmedMission?.config??c?.config??ctx.roverConfig);
      return prompt('Landing follows mass and site hazard','flight-result',[
      `Landing index ${n(confirmed.mass)} × site factor = ${n(confirmed.landingDemand,2)} / 1125 kg-equivalent. ${confirmed.landingPass?'The modeled landing check passes.':'The accepted hard landing disables mobility; stationary science remains possible and the cause stays FAILED.'}`,
      'This educational landing index is an approved game assumption, not a NASA flight limit or probability.',
    ]);
    }
    case 'C8:plan':{
      if(!c)return null;
      const f=forecastSol(c,c.plan),reserve=c.config.reserve*2408;
      return prompt(c.safe?'Recover with baseline power':'Plan one real sol','sol-plan',[
        `Sol ${c.sol} / ${c.totalSols}: ${n(c.energyWh)} Wh stored; ${n(c.config.reserve*100,0)}% reserve = ${n(reserve)} Wh. MMRTG output ${n(generationForSol(c),2)} W; baseline ${n(c.config.baselineW)} W. ${c.safe?'End sol for baseline recovery.':'Allocate hours, then commit.'}`,
        c.safe?'Safe mode cancels optional work and skips one next sol. Baseline and an already-planned contact remain. End sol integrates recovery; three consecutive end-sol zeros lose the rover.':`Current flat-drive plan estimate: ${n(f.loadWh)} Wh load / ${n(f.generationWh)} Wh generation. Allocate drive and science hours, then Commit sol plan. Reduce a deficit or explicitly accept safe mode.`,
        'Reading does not advance time. A sol is about 24.66 modeled hours; executed work and End sol advance its energy ledger. The reserve is a threshold, not a recharge rate.',
      ]);
    }
    case 'C8:drive':{
      if(!c)return null;
      const target=scenarioTargets(c.options.site).find(t=>!c.completed.includes(`science:${t.id}`));
      return prompt('Drive the rover in the real world','drive',[
        c.mobilityDisabled?'This rover has lost mobility. Continue the stationary observations within range.':`WASD or arrows steer and drive; Space brakes. ${n(c.plan.driveHours-c.driveHours,2)} driving hours remain. Actual distance uses ${FIXED.driveSpeedMps} modeled m/s and mass/slope work, independent of render FPS.`,
        target&&target.availableSol>c.sol?`The first unrecorded rock opens on sol ${target.availableSol}. MEDA weather can be recorded earlier if installed and planned; End sol reaches later target dates.`:'Follow an available beacon. Braking keeps the rover in scan range; no camera move or drive command is issued by the coach.',
      ]);
    }
    case 'C8:scan':{
      if(!c)return null;
      const target=scenarioTargets(c.options.site).find(t=>t.id===ctx.nearbyTargetId);
      return prompt('Scan available evidence with E','scan',[
        target?`${target.name} is available on sol ${c.sol}. Stop within 8 m, then press E or Start scan.`:'Stop beside an available beacon, then press E or Start scan. A complete installed bundle and remaining science hours are required.',
        'A completed scan executes the instruments’ modeled hours once. Data stays onboard until transmitted; every product in the bundle must return before it counts toward an objective.',
      ]);
    }
    case 'C8:end':return c?prompt('Close the sol when you are ready','end-sol',[
      `${n(c.elapsedHours,2)} / ${n(FIXED.solHours,2)} modeled hours used. End sol integrates the remaining baseline and the planned contact; unsent evidence stays queued.`,
      'Wait / charge advances one modeled hour only. Battery charge requires MMRTG generation above the active loads; there is no artificial refill. Use the next sol’s plan to continue.',
    ]):null;
    case 'C9:event':{
      const scheduled=c?.events.filter(e=>e.id==='E1'||e.id==='E2')??[];
      const event=scheduled.find(e=>!e.resolved)??scheduled[0];if(!event)return null;
      return prompt('Respond to a scheduled event','event',[
        `${event.title} · scheduled sol ${event.sol}. ${event.detail}`,
        event.actionable===false?'Mobility is already disabled, so this event requires no reroute and grants no response credit.':event.id==='E1'?'Reroute selects the real safe corridor; distance is charged when traversed. Crossing accepts mobility loss.':event.id==='E2'?'Choose which evidence returns first or wait for another contact. Priority changes do not alter scientific rank weights.':'Cut a planned load, or accept baseline-only safe recovery. The coach does not resolve this event for you.',
      ]);
    }
    case 'C9:report':{
      const summary=c?scienceSummary(c):null;
      return prompt('Read the outcome and its cause chain','report',[
        ctx.missionRecord?.endReason||'The report explains the mission outcome from recorded decisions and returned evidence.',
        summary?`Recovery tier ${summary.tier}; scientific value ${n(summary.sciencePoints,2)} / 30; mission performance ${summary.performancePoints} / 30. Returned fractions: ${c!.options.ranking.map(o=>`${o} ${n(summary.fractions[o]*100,0)}%`).join(' · ')}.`:'Read which records returned, the recorded outcome and the engineering limitations.',
        'The full rubric also names resource efficiency (15), decision quality (15) and teamwork (10). Their authoritative formulas/ledgers are not implemented here; these prompts award no points. A launch, landing or rover-loss failure keeps the FAILED headline even after useful recovery.',
      ]);
    }
  }
}

export type TutorialStateData = {
  tutorialMode:TutorialMode;tutorialStepsSeen:string[];tutorialHasLaunched:boolean;
  tutorialRunStarted:boolean;tutorialLastPromptId:TutorialConceptId|null;
  tutorialInstrumentChange:TutorialInstrumentChange|null;paceMode:PaceMode;
};
export const INITIAL_TUTORIAL:TutorialStateData={tutorialMode:'guided',tutorialStepsSeen:[],tutorialHasLaunched:false,tutorialRunStarted:false,tutorialLastPromptId:null,tutorialInstrumentChange:null,paceMode:'quick'};
export function normalizeTutorialState(value:Partial<TutorialStateData>|undefined,legacyStarted=false):TutorialStateData {
  const hasLaunched=typeof value?.tutorialHasLaunched==='boolean'?value.tutorialHasLaunched:legacyStarted;
  return {
    tutorialMode:value?.tutorialMode==='guided'||value?.tutorialMode==='skip'?value.tutorialMode:hasLaunched?'skip':'guided',
    tutorialStepsSeen:Array.isArray(value?.tutorialStepsSeen)?[...new Set(value.tutorialStepsSeen.filter(id=>isTutorialConcept(id)||TUTORIAL_STEPS.includes(id as TutorialStep)))]:[],
    tutorialHasLaunched:hasLaunched,
    tutorialRunStarted:typeof value?.tutorialRunStarted==='boolean'?value.tutorialRunStarted:legacyStarted,
    tutorialLastPromptId:isTutorialConcept(value?.tutorialLastPromptId)?value.tutorialLastPromptId:null,
    tutorialInstrumentChange:value?.tutorialInstrumentChange&&Array.isArray(value.tutorialInstrumentChange.before?.instruments)&&Array.isArray(value.tutorialInstrumentChange.after?.instruments)&&INSTRUMENTS.some(i=>i.id===value.tutorialInstrumentChange?.instrument)?structuredClone(value.tutorialInstrumentChange):null,
    paceMode:value?.paceMode==='explore'?'explore':'quick',
  };
}
