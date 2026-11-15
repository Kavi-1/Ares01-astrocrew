import { FIXED, INSTRUMENTS, type RoverConfig, type InstrumentId } from '../nasa/data';
import { calculateEngineering, driveEnergyWh, nominalBatteryWh, rtgPowerW } from '../nasa/engineering';
import { batteryPercent, belowReserve, integrateEnergy, zeroEnergyStreak } from './energy';
import { getScenario, OBJECTIVES, scenarioTargets, WINDOWS, type ObjectiveId, type Ranking, type SiteId, type WindowId } from '../data/scenarios';
import { calculateMissionBudget } from './missionBudget';
import type { LaunchVehicleId, RelayOrbitId } from '../data/missionCosts';

export type MissionOptions = { site: SiteId; ranking: Ranking; window: WindowId; vehicle: LaunchVehicleId; relay: RelayOrbitId; risks: { budget: boolean; landing: boolean; mass: boolean } };
export const DEFAULT_OPTIONS: MissionOptions = { site: 'jezero', ranking: ['G','B','E'], window: 'W1', vehicle: 'heavy', relay: 'O1', risks: { budget:false, landing:false, mass:false } };
export const VEHICLE_KG = { light:1200, medium:1500, heavy:1550 } as const;
export const RELAY_KG = { O1:0, O2:75, O3:350 } as const;
export type ScienceProduct = { id: string; objective: ObjectiveId; unit: number; sol: number; bits: number; sentBits: number; method: string };
export type CampaignEvent = { id:string; sol:number; title:string; detail:string; resolved:boolean; actionable?:boolean };
export type EnergyEntry = { id:string; sol:number; hours:number; generatedWh:number; requestedWh:number; servedWh:number; conversionLossWh:number; curtailedWh:number; unservedWh:number; storedWh:number };
export type SolRecord = { sol:number; endWh:number; safe:boolean; generatedWh:number; loadWh:number; driveMeters:number };
export type SolPlan = { driveHours:number; scienceHours:number; science:boolean; weather:boolean; transmit:boolean };
export type Campaign = {
  version:1; options:MissionOptions; config:RoverConfig; sol:number; totalSols:20|30; mode:'planning'|'operations'|'finished';
  energyWh:number; elapsedHours:number; scienceSpentHours:number; driveHours:number; driveMeters:number; profileMeters:number; radarUnits:number; radarKeys:string[]; radarRemainder:number;
  plan:SolPlan; products:ScienceProduct[]; events:CampaignEvent[]; energy:EnergyEntry[]; history:SolRecord[];
  completed:string[]; zeroStreak:number; safe:boolean; skipNext:boolean; mobilityDisabled:boolean; majorFailures:string[];
  route:'pending'|'reroute'|'cross'; dataPriority:Ranking; contactUsedBits:number; message:string;
};
export const DEFAULT_SOL_PLAN: SolPlan = { driveHours:4, scienceHours:8.5, science:true, weather:true, transmit:true };
export function validRanking(value: unknown): value is Ranking {
  return Array.isArray(value) && value.length===3 && new Set(value).size===3 && value.every(id=>OBJECTIVES.some(o=>o.id===id));
}
export function validateOptions(options: MissionOptions) {
  if (!['jezero','syrtis','columbia'].includes(options.site) || !validRanking(options.ranking) || !Object.hasOwn(WINDOWS,options.window) || !Object.hasOwn(VEHICLE_KG,options.vehicle) || !Object.hasOwn(RELAY_KG,options.relay)) throw new Error('Invalid mission selections.');
}
export function missionChecks(options:MissionOptions, config:RoverConfig) {
  validateOptions(options);
  const mass=calculateEngineering(config).massKg, launchMass=mass+RELAY_KG[options.relay];
  const landingDemand=mass*(1+getScenario(options.site).hazard);
  const budget=calculateMissionBudget({ instruments:config.instruments, vehicle:options.vehicle, relayOrbit:options.relay });
  return { mass,launchMass,capacity:VEHICLE_KG[options.vehicle], massPass:launchMass<=VEHICLE_KG[options.vehicle], landingDemand,landingPass:landingDemand<=1125,budget };
}
export function launchBlocks(options:MissionOptions, config:RoverConfig, retry=false) {
  const c=missionChecks(options,config), errors=calculateEngineering(config).issues;
  if (!c.massPass && (retry || !options.risks.mass)) errors.push(`Launch mass ${c.launchMass.toFixed(2)} kg exceeds ${c.capacity} kg. ${retry?'Retry requires a fix.':'Fix or explicitly accept the mass risk.'}`);
  if (!c.landingPass && !options.risks.landing) errors.push(`Landing index ${c.landingDemand.toFixed(2)} exceeds 1125 kg-equivalent. Fix or accept mobility loss.`);
  if (!c.budget.withinBudget && !options.risks.budget) errors.push('Budget exceeded. Fix the budget or accept a 20-sol mission.');
  return errors;
}
export function createCampaign(options:MissionOptions, config:RoverConfig, priorFailures:string[]=[]):Campaign {
  const check=missionChecks(options,config);
  if(!check.massPass)throw new Error('A failed launch cannot enter surface operations.');
  if(!check.budget.withinBudget&&!options.risks.budget)throw new Error('Budget overrun must be explicitly accepted.');
  if(!check.landingPass&&!options.risks.landing)throw new Error('Landing risk must be explicitly accepted.');
  return scheduleEvents({ version:1,options:structuredClone(options),config:structuredClone(config),sol:1,totalSols:check.budget.withinBudget?30:20,mode:'planning',energyWh:nominalBatteryWh(),elapsedHours:0,scienceSpentHours:0,driveHours:0,driveMeters:0,profileMeters:0,radarUnits:0,radarKeys:[],radarRemainder:0,plan:{...DEFAULT_SOL_PLAN},products:[],events:[],energy:[],history:[],completed:[],zeroStreak:0,safe:false,skipNext:false,mobilityDisabled:!check.landingPass,majorFailures:[...priorFailures,...(!check.landingPass?[`S6 hard landing: ${check.landingDemand.toFixed(3)} > 1125 kg-equivalent; mobility disabled.`]:[])],route:'pending',dataPriority:[...options.ranking] as Ranking,contactUsedBits:0,message:'' });
}
export function generationForSol(c:Campaign) { return rtgPowerW((c.sol-1)*FIXED.solHours/(365.25*24)); }
function interval(c:Campaign,id:string,hours:number,extraW=0,extraWh=0):Campaign {
  if (!Number.isFinite(hours) || hours<0 || c.elapsedHours+hours>FIXED.solHours+1e-8) return {...c,message:'Activity does not fit in the remaining sol.'};
  const driving=id.startsWith('drive:');
  if(!driving&&c.completed.includes(id))return c;
  const result=integrateEnergy(c.energyWh,{hours,generationW:generationForSol(c),loadW:c.config.baselineW+extraW,extraLoadWh:extraWh});
  const entry={id,sol:c.sol,hours,...result};
  const prior=c.energy.at(-1),energy=[...c.energy];
  if(driving&&prior?.id===id){energy[energy.length-1]={...entry,hours:prior.hours+hours,generatedWh:prior.generatedWh+result.generatedWh,requestedWh:prior.requestedWh+result.requestedWh,servedWh:prior.servedWh+result.servedWh,conversionLossWh:prior.conversionLossWh+result.conversionLossWh,curtailedWh:prior.curtailedWh+result.curtailedWh,unservedWh:prior.unservedWh+result.unservedWh};}else energy.push(entry);
  const next={...c,energyWh:result.storedWh,elapsedHours:c.elapsedHours+hours,energy,scienceSpentHours:c.scienceSpentHours+(id.startsWith('activity:')&&!id.endsWith(':meda')?hours:0),completed:driving||result.unservedWh>1e-8?c.completed:[...c.completed,id],message:''};
  if(result.unservedWh>1e-8) return enterSafe({...next,message:'Requested work could not be fully powered; no science product was credited.'});
  if(!c.safe&&belowReserve(result.storedWh,c.config.reserve))return enterSafe({...next,events:c.events.some(e=>e.id===`E4:${c.sol}`)?c.events:[...c.events,{id:`E4:${c.sol}`,sol:c.sol,title:'E4 · Reserve threshold crossed',detail:'Actual executed work reached the selected safety reserve. Optional work is suspended.',resolved:true}]});
  return next;
}
function scheduleEvents(c:Campaign):Campaign {
  const site=getScenario(c.options.site), next={...c,events:[...c.events]};
  if(c.sol>=WINDOWS[c.options.window].hazardSol && !c.events.some(e=>e.id==='E1'))next.events.push({id:'E1',sol:WINDOWS[c.options.window].hazardSol,title:'E1 · Route hazard',detail:`${site.slope}° slope / ${site.obstacle} m obstacle. Safe detour adds ${site.detour} m. Crossing disables mobility (assumed severity).${c.mobilityDisabled?' Non-actionable: mobility is already disabled; no traversal or response credit.':''}`,resolved:c.mobilityDisabled,actionable:!c.mobilityDisabled});
  if(c.sol>=site.outageSol && !c.events.some(e=>e.id==='E2'))next.events.push({id:'E2',sol:site.outageSol,title:'E2 · Relay window loss',detail:'One relay opportunity is unavailable this sol. Reprioritize data or wait; backlog is preserved.',resolved:false});
  return next;
}
export function forecastSol(c:Campaign,plan:SolPlan) {
  const remainingHours=Math.max(0,FIXED.solHours-c.elapsedHours);
  const driveHours=Math.max(0,plan.driveHours-c.driveHours);
  const scienceHours=plan.science?Math.max(0,(plan.scienceHours??8.5)-(c.scienceSpentHours??0)):0;
  const medaDone=c.completed.includes(`activity:weather:${c.sol}:meda`)||c.completed.includes(`activity:moxie:${c.sol}:meda`);
  const weatherHours=plan.weather&&c.config.instruments.includes('meda')&&!medaDone?FIXED.solHours*.25:0;
  const active=INSTRUMENTS.filter(i=>c.config.instruments.includes(i.id)&&!['meda','rimfax','moxie'].includes(i.id));
  const maxScienceW=Math.max(0,...active.map(i=>i.powerW));
  const moxieHours=plan.science&&c.config.moxieRun&&c.config.instruments.includes('moxie')&&!c.completed.includes(`activity:moxie:${c.sol}:moxie`)?Math.min(1,scienceHours):0;
  const scienceWh=moxieHours*300+Math.max(0,scienceHours-moxieHours)*maxScienceW;
  const driveWh=driveEnergyWh(driveHours*3600*FIXED.driveSpeedMps,0,calculateEngineering(c.config).massKg)+(c.config.instruments.includes('rimfax')?10*driveHours:0);
  const optionalWh=driveWh+scienceWh+17*weatherHours;
  const loadWh=c.config.baselineW*remainingHours+optionalWh,generationWh=generationForSol(c)*remainingHours;
  return {loadWh,generationWh,netWh:generationWh-loadWh,minimumWh:Math.max(0,c.energyWh-optionalWh/Math.sqrt(FIXED.roundTripEfficiency)),scienceHours,driveHours,weatherHours,remainingHours};
}
export function commitPlan(c:Campaign, plan:SolPlan, acceptSafe=false):Campaign {
  if(c.mode!=='planning')return c;
  if(!Number.isFinite(plan.driveHours)||plan.driveHours<0||plan.driveHours>4) return {...c,message:'Drive allocation must be between 0 and 4 hours (assumed operational limit).'};
  if(c.events.some(e=>e.id==='E1'&&!e.resolved))return {...c,message:'Resolve the route hazard before committing work.'};
  plan={...plan,scienceHours:plan.scienceHours??8.5};
  if(!Number.isFinite(plan.scienceHours)||plan.scienceHours<0||plan.scienceHours>FIXED.solHours||plan.driveHours<c.driveHours-1e-9||plan.scienceHours<(c.scienceSpentHours??0)-1e-9)return {...c,message:'Allocations must be finite, fit one sol and retain already-executed hours.'};
  const forecast=forecastSol(c,plan);
  if(forecast.driveHours+forecast.scienceHours+forecast.weatherHours>forecast.remainingHours+1e-9) return {...c,message:'Sequential activity durations exceed one sol.'};
  if(forecast.netWh<0||belowReserve(forecast.minimumWh,c.config.reserve)) {
    const warned={...c,events:c.events.some(e=>e.id===`E4:${c.sol}`)?c.events.map(e=>e.id===`E4:${c.sol}`?{...e,resolved:acceptSafe}:e):[...c.events,{id:`E4:${c.sol}`,sol:c.sol,title:'E4 · Low-energy forecast',detail:'Cut a planned load or accept protective safe mode and one next-sol skip.',resolved:acceptSafe}]};
    return acceptSafe?enterSafe({...warned,plan}):{...warned,message:'Energy forecast breaches the selected reserve or has a deficit. Cut loads or explicitly accept safe mode.'};
  }
  return {...c,plan:{...plan},events:c.events.map(e=>e.id===`E4:${c.sol}`?{...e,resolved:true}:e),mode:'operations',safe:false,message:'Sol plan committed. Only executed activities consume energy.'};
}
export function enterSafe(c:Campaign):Campaign {return {...c,safe:true,mode:'operations',skipNext:true,message:c.message||'Safe mode: optional work canceled; the next sol is skipped once.'};}
export function waitHours(c:Campaign,hours:number):Campaign {
  if(c.mode!=='operations')return c;
  const remaining=Math.min(hours,FIXED.solHours-c.elapsedHours);
  if(!Number.isFinite(hours)||hours<=0)return {...c,message:'Wait duration must be positive.'};
  return interval(c,`wait:${c.sol}:${c.elapsedHours}`,remaining);
}
export function traverse(c:Campaign,meters:number,slopeDeg=0,segment?:{from:[number,number];to:[number,number]}):Campaign {
  if(c.mode!=='operations'||c.safe||c.mobilityDisabled||meters<=0||!Number.isFinite(meters)||!Number.isFinite(slopeDeg))return c;
  if(c.events.some(e=>e.id==='E1'&&!e.resolved))return {...c,message:'Resolve the route hazard before driving.'};
  if(slopeDeg>30)return {...c,message:'E1: route exceeds the documented 30° limit; reroute.'};
  const remainingDrive=Math.max(0,c.plan.driveHours-c.driveHours),remainingSol=Math.max(0,FIXED.solHours-c.elapsedHours);
  if(remainingDrive<=1e-12||remainingSol<=1e-12)return {...c,message:'Planned drive allocation exhausted. Science may continue; end the sol or review the remaining plan.'};
  let hours=Math.min(meters/FIXED.driveSpeedMps/3600,remainingDrive,remainingSol);
  // A stopped rover's residual visual velocity must not revoke a committed plan.
  if(hours<=1e-12)return c;
  const allowedMeters=hours*3600*FIXED.driveSpeedMps;
  const watts=Math.max(0,driveEnergyWh(allowedMeters,slopeDeg,calculateEngineering(c.config).massKg))/hours+(c.config.instruments.includes('rimfax')?10:0);
  const projected=integrateEnergy(c.energyWh,{hours,generationW:generationForSol(c),loadW:c.config.baselineW+watts});
  const threshold=nominalBatteryWh()*c.config.reserve;
  const reserveStop=projected.storedWh<threshold;
  if(reserveStop){
    const demand=(c.config.baselineW+watts-generationForSol(c))/Math.sqrt(FIXED.roundTripEfficiency);
    hours=Math.min(hours,Math.max(0,(c.energyWh-threshold)/Math.max(1e-12,demand)));
  }
  const traveled=hours*3600*FIXED.driveSpeedMps;
  let next=interval(c,`drive:${c.sol}`,hours,watts);
  next={...next,driveHours:c.driveHours+hours,driveMeters:c.driveMeters+traveled};
  if(segment&&c.config.instruments.includes('rimfax')){
    const keys=new Set(c.radarKeys), spacing=.1, count=Math.floor((c.radarRemainder+traveled+1e-9)/spacing);
    let added=0;
    for(let i=0;i<count&&keys.size<2000;i++){
      const along=spacing-c.radarRemainder+i*spacing,t=along/meters;
      const x=segment.from[0]+(segment.to[0]-segment.from[0])*t,z=segment.from[1]+(segment.to[1]-segment.from[1])*t;
      const key=`${Math.round(x/spacing)},${Math.round(z/spacing)}`;
      if(!keys.has(key)){keys.add(key);added+=spacing;}
    }
    next={...next,radarKeys:[...keys],radarRemainder:Math.max(0,c.radarRemainder+traveled-count*spacing),profileMeters:c.profileMeters+added};
  }
  if(reserveStop)next=enterSafe({...next,events:c.events.some(e=>e.id===`E4:${c.sol}`)?c.events:[...c.events,{id:`E4:${c.sol}`,sol:c.sol,title:'E4 · Drive reserve limit',detail:'Drive stopped at the selected reserve. Optional work is suspended.',resolved:true}]});
  return next;
}
function productsFor(c:Campaign,id:string,objective:ObjectiveId,unit:number,method:string,parts:Array<[InstrumentId,number,number]>):Campaign {
  if(c.mode!=='operations'||c.safe||(!c.plan.science&&method!=='MEDA')||c.completed.includes(`science:${id}`))return c;
  if(parts.some(([instrument])=>!c.config.instruments.includes(instrument)))return {...c,message:'Required instruments are not installed.'};
  const pending=parts.filter(([instrument])=>!c.completed.includes(`activity:${id}:${instrument}`));
  if(pending.reduce((a,[,h])=>a+h,0)>FIXED.solHours-c.elapsedHours+1e-9||pending.filter(([instrument])=>instrument!=='meda').reduce((a,[,h])=>a+h,0)>(c.plan.scienceHours??8.5)-(c.scienceSpentHours??0)+1e-9)return {...c,message:'The whole science bundle does not fit the remaining sol or science-hour allocation.'};
  let next=c;
  for(const [instrument,hours] of pending) {
    const watts=INSTRUMENTS.find(i=>i.id===instrument)!.powerW;
    if(next.elapsedHours+hours>FIXED.solHours)return {...c,message:'Science does not fit this sol.'};
    next=interval(next,`activity:${id}:${instrument}`,hours,watts);
    if(!next.completed.includes(`activity:${id}:${instrument}`)||next.safe)return next;
  }
  const products=parts.map(([instrument,,mbit])=>({id:`${id}:${instrument}`,objective,unit,sol:c.sol,bits:Math.round(mbit*1e6),sentBits:0,method}));
  return {...next,products:[...next.products,...products],completed:[...next.completed,`science:${id}`],message:'Observation acquired; it counts only after all its products return.'};
}
export function acquireTarget(c:Campaign,targetId:string,x:number,z:number):Campaign {
  const target=scenarioTargets(c.options.site).find(t=>t.id===targetId);
  if(!target||target.availableSol>c.sol||Math.hypot(x-target.x,z-target.z)>8)return {...c,message:'Target is not available or is outside the 8 m scan range.'};
  if(target.objective==='B')return productsFor(c,targetId,'B',target.unit,'SHERLOC + PIXL', [['sherloc',1,318.8],['pixl',2,16]]);
  const composition=c.config.instruments.includes('pixl')?'pixl':c.config.instruments.includes('supercam')?'supercam':null;
  if(composition)return productsFor(c,targetId,'G',target.unit,`Mastcam-Z + ${composition}`, [['mastcam-z',.5,148],[composition,composition==='pixl'?2:.5,composition==='pixl'?16:62]]);
  if(c.config.instruments.includes('rimfax')&&c.profileMeters>=100-1e-8&&c.radarUnits<2) {
    const next=productsFor(c,targetId,'G',target.unit,'Mastcam-Z + RIMFAX', [['mastcam-z',.5,148]]);
    if(next.products.length===c.products.length)return next;
    return {...next,profileMeters:Math.max(0,c.profileMeters-100),radarUnits:c.radarUnits+1,products:[...next.products,{id:`${targetId}:rimfax`,objective:'G',unit:target.unit,sol:c.sol,bits:80e6,sentBits:0,method:'Mastcam-Z + RIMFAX'}]};
  }
  return {...c,message:'Geology needs Mastcam-Z plus composition, or an unused 100 m RIMFAX profile (maximum two alternatives).'};
}
export function acquireWeather(c:Campaign):Campaign {
  if(!c.plan.weather||!c.config.instruments.includes('meda'))return {...c,message:'A distinct MEDA record requires weather enabled and the instrument installed.'};
  if(c.completed.includes(`science:moxie:${c.sol}`))return {...c,message:'This sol already has a MOXIE/MEDA context unit; it cannot also count as weather.'};
  return productsFor(c,`weather:${c.sol}`,'E',c.sol,'MEDA', [['meda',FIXED.solHours*.25,88]]);
}
export function runMoxie(c:Campaign):Campaign {
  if(!c.config.moxieRun||!c.plan.weather)return {...c,message:'Schedule MOXIE and MEDA context in the plan first.'};
  if(c.completed.includes(`science:weather:${c.sol}`))return {...c,message:'This sol already supplied a weather unit; its context cannot be credited twice.'};
  if(c.products.filter(p=>p.method==='MOXIE + MEDA context'&&p.id.endsWith(':moxie')).length>=2)return {...c,message:'At most two MOXIE/context units can replace weather units.'};
  return productsFor(c,`moxie:${c.sol}`,'E',100+c.sol,'MOXIE + MEDA context', [['meda',FIXED.solHours*.25,88],['moxie',1,1]]);
}
export function contactCapacityBits(c:Campaign) {
  if(c.config.downlink==='X-band')return 500*3600;
  const outage=c.sol===getScenario(c.options.site).outageSol;
  return (c.options.relay==='O1'?(outage?0:960):c.options.relay==='O2'?(outage?1920:2880):(outage?900:1800))*1e6;
}
export function transmit(c:Campaign):Campaign {
  if(!c.plan.transmit||c.mode==='finished')return c;
  let capacity=Math.max(0,contactCapacityBits(c)-c.contactUsedBits), used=0;
  const sorted=[...c.products].sort((a,b)=>(c.dataPriority??c.options.ranking).indexOf(a.objective)-(c.dataPriority??c.options.ranking).indexOf(b.objective)||a.sol-b.sol||(a.id<b.id?-1:a.id>b.id?1:0));
  const updates=new Map<string,number>();
  for(const p of sorted){const send=Math.min(p.bits-p.sentBits,capacity);updates.set(p.id,p.sentBits+send);capacity-=send;used+=send;}
  return {...c,products:c.products.map(p=>({...p,sentBits:updates.get(p.id)!})),contactUsedBits:c.contactUsedBits+used,events:c.events.map(e=>e.id==='E2'&&e.sol===c.sol?{...e,resolved:true}:e),message:`${(used/1e6).toFixed(2)} Mbit returned; unsent products remain onboard.`};
}
export function resolveRoute(c:Campaign,choice:'reroute'|'cross'):Campaign {
  if(c.route!=='pending'||!c.events.some(e=>e.id==='E1'&&!e.resolved))return c;
  return {...c,route:choice,mobilityDisabled:c.mobilityDisabled||choice==='cross',events:c.events.map(e=>e.id==='E1'?{...e,resolved:true,detail:e.detail+(choice==='cross'?' Crossed: mobility lost.':' Safe detour chosen; distance is charged when traversed.')} :e),message:choice==='cross'?'Mobility disabled by the accepted terrain crossing.':'Safe route selected. Follow the detour corridor.'};
}
export function prioritizeData(c:Campaign,id:ObjectiveId):Campaign {return {...c,dataPriority:[id,...(c.dataPriority??c.options.ranking).filter(other=>other!==id)] as Ranking,message:'Return priority updated; scientific ranking and weights are unchanged.'};}
export function scienceSummary(c:Campaign) {
  const fractions={G:0,B:0,E:0};
  for(const o of OBJECTIVES){
    const units=new Map<number,ScienceProduct[]>();
    for(const p of c.products.filter(p=>p.objective===o.id))units.set(p.unit,[...(units.get(p.unit)??[]),p]);
    const complete=[...units.values()].filter(parts=>parts.length>0&&parts.every(p=>p.sentBits===p.bits));
    const done=o.id==='E'?complete.filter(parts=>parts[0].method==='MEDA').length+Math.min(2,complete.filter(parts=>parts[0].method==='MOXIE + MEDA context'&&parts.length===2).length):complete.length;
    fractions[o.id]=Math.min(1,done/o.required);
  }
  const present=c.options.ranking.filter(id=>fractions[id]>0), topTwo=c.options.ranking.slice(0,2).every(id=>fractions[id]>0);
  const tier=present.length===3?'full':topTwo?'baseline':present.length?'minimum':'none';
  const sciencePoints=c.options.ranking.reduce((sum,id,index)=>sum+[.5,.3,.2][index]*fractions[id]*30,0);
  return {fractions,tier,sciencePoints,performancePoints:tier==='full'?30:tier==='baseline'?20:tier==='minimum'?10:0,failed:c.majorFailures.length>0||tier==='none'};
}
export function endSol(c:Campaign):Campaign {
  if(c.mode==='finished')return c;
  if(c.events.some(e=>e.id==='E1'&&!e.resolved))return {...c,message:'Resolve the pending route hazard before ending the sol.'};
  let next=interval(c,`close:${c.sol}`,Math.max(0,FIXED.solHours-c.elapsedHours));
  next=transmit(next);
  const entries=next.energy.filter(e=>e.sol===c.sol), zeros=zeroEnergyStreak(c.zeroStreak,next.energyWh);
  const record={sol:c.sol,endWh:next.energyWh,safe:next.safe,generatedWh:entries.reduce((a,e)=>a+e.generatedWh,0),loadWh:entries.reduce((a,e)=>a+e.requestedWh,0),driveMeters:c.driveMeters};
  next={...next,zeroStreak:zeros,history:[...c.history,record]};
  if(zeros>=3)return {...next,mode:'finished',majorFailures:[...next.majorFailures,'S7 rover lost: three consecutive end-sol zero-energy readings.']};
  if(c.sol===c.totalSols)return {...next,mode:'finished',message:'Mission duration completed.'};
  const recoveryRequired=next.skipNext;
  next=scheduleEvents({...next,sol:c.sol+1,elapsedHours:0,scienceSpentHours:0,driveHours:0,driveMeters:0,contactUsedBits:0,mode:'planning',safe:false,skipNext:false,message:recoveryRequired?'Safe-mode recovery sol: no optional work.':''});
  if(recoveryRequired)next={...next,safe:true,mode:'operations'};
  return next;
}
export function snapshotCampaign(c:Campaign) {return JSON.stringify(c);}
export function restoreCampaign(json:string):Campaign {
  const c=JSON.parse(json) as Campaign;validateOptions(c.options);
  const invalid=()=>{throw new Error('Invalid campaign save.');};
  const finite=(n:number,min=0,max=Number.MAX_VALUE)=>Number.isFinite(n)&&n>=min&&n<=max;
  if(c.version!==1||!finite(c.energyWh,0,nominalBatteryWh())||![20,30].includes(c.totalSols)||!Number.isSafeInteger(c.sol)||c.sol<1||c.sol>c.totalSols||!['planning','operations','finished'].includes(c.mode))invalid();
  if(!Array.isArray(c.energy)||!Array.isArray(c.products)||!Array.isArray(c.completed)||!Array.isArray(c.events)||!Array.isArray(c.history)||!Array.isArray(c.radarKeys)||!Array.isArray(c.majorFailures))invalid();
  for(const entry of c.energy)if(typeof entry.id!=='string'||!Number.isSafeInteger(entry.sol)||entry.sol<1||entry.sol>c.sol||!finite(entry.hours,0,FIXED.solHours)||['generatedWh','requestedWh','servedWh','conversionLossWh','curtailedWh','unservedWh','storedWh'].some(key=>!finite(entry[key as keyof EnergyEntry] as number)))invalid();
  // Early version-1 drafts stored executed science in the energy ledger only.
  if(c.scienceSpentHours===undefined)c.scienceSpentHours=c.energy.filter(e=>e.sol===c.sol&&e.id.startsWith('activity:')&&!e.id.endsWith(':meda')).reduce((sum,e)=>sum+e.hours,0);
  c.plan={...c.plan,scienceHours:c.plan.scienceHours??Math.max(DEFAULT_SOL_PLAN.scienceHours,c.scienceSpentHours)};
  if(!finite(c.elapsedHours,0,FIXED.solHours)||!finite(c.scienceSpentHours,0,c.elapsedHours+1e-8)||!finite(c.driveHours,0,4)||!finite(c.driveMeters)||!finite(c.profileMeters)||!finite(c.radarRemainder)||!finite(c.contactUsedBits)||!finite(c.zeroStreak)||!finite(c.plan.driveHours,0,4)||!finite(c.plan.scienceHours,0,FIXED.solHours))invalid();
  if(!validRanking(c.dataPriority)||!finite(c.config.baselineW)||![.2,.3,.4].includes(c.config.reserve)||!['UHF','X-band'].includes(c.config.downlink)||!Array.isArray(c.config.instruments)||c.config.instruments.some(id=>!INSTRUMENTS.some(i=>i.id===id)))invalid();
  for(const product of c.products)if(typeof product.id!=='string'||!OBJECTIVES.some(o=>o.id===product.objective)||!Number.isSafeInteger(product.bits)||!Number.isSafeInteger(product.sentBits)||!finite(product.bits)||!finite(product.sentBits,0,product.bits)||!Number.isSafeInteger(product.unit)||!Number.isSafeInteger(product.sol)||product.sol<1||product.sol>c.sol)invalid();
  return c;
}
export { batteryPercent };

export function objectiveCapabilities(config:RoverConfig) {
  const has=(id:InstrumentId)=>config.instruments.includes(id);
  return {G:has('mastcam-z')&&(has('pixl')||has('supercam')||has('rimfax')),B:has('sherloc')&&has('pixl'),E:has('meda')};
}
export function skipQuietSols(c:Campaign):Campaign {
  let next=c;
  for(let i=0;i<30&&next.mode!=='finished';i++) {
    const available=scenarioTargets(next.options.site).some(t=>t.availableSol<=next.sol&&!next.completed.includes(`science:${t.id}`));
    const weather=next.config.instruments.includes('meda')&&!next.completed.includes(`science:weather:${next.sol}`)&&scienceSummary(next).fractions.E<1;
    if(available&&!next.mobilityDisabled||weather||next.events.some(e=>!e.resolved))return {...next,message:'A target or event needs review on this sol.'};
    next=endSol(next);
  }
  return next;
}

export function setOperatingDownlink(c:Campaign,downlink:'UHF'|'X-band'):Campaign {
  if(c.mode!=='planning'||c.elapsedHours!==0||c.contactUsedBits!==0)return {...c,message:'Change the fixed-antenna contact strategy at the start of a sol.'};
  return {...c,config:{...c.config,downlink},message:'Operating downlink changed. Radio power is already included in the baseline.'};
}

export function targetReadiness(c:Campaign,id:string):{allowed:boolean;reason:string} {
  const t=scenarioTargets(c.options.site).find(target=>target.id===id),has=(instrument:InstrumentId)=>c.config.instruments.includes(instrument);
  if(!t||t.availableSol>c.sol||c.completed.includes(`science:${id}`))return {allowed:false,reason:'This target is not currently available.'};
  if(c.mode!=='operations'||c.safe||!c.plan.science)return {allowed:false,reason:'Commit a science-enabled plan outside safe mode first.'};
  const instruments:InstrumentId[]=t.objective==='B'?['sherloc','pixl']:['mastcam-z',has('pixl')?'pixl':has('supercam')?'supercam':'rimfax'];
  if(instruments.some(i=>!has(i)))return {allowed:false,reason:'The complete instrument bundle is not installed.'};
  if(instruments.includes('rimfax')&&(c.profileMeters<100-1e-8||c.radarUnits>=2))return {allowed:false,reason:'A unique unused 100 m radar profile is required (maximum two alternatives).'};
  const pending=instruments.filter(i=>i!=='rimfax'&&!c.completed.includes(`activity:${id}:${i}`));
  const hours=pending.reduce((sum,i)=>sum+INSTRUMENTS.find(instrument=>instrument.id===i)!.hours,0);
  if(hours>FIXED.solHours-c.elapsedHours+1e-9||hours>(c.plan.scienceHours??8.5)-(c.scienceSpentHours??0)+1e-9)return {allowed:false,reason:'Revise the remaining science-hour allocation or continue next sol.'};
  return {allowed:true,reason:''};
}
export function reviewRemainingPlan(c:Campaign):Campaign {return c.mode==='operations'&&!c.safe?{...c,mode:'planning',message:'Executed work is retained. Revise only the remaining allocations.'}:c;}

/** Shared by the live world and deterministic tests; unsupported co-located targets cannot block eligible science. */
export function nearbyScienceTarget(c:Campaign,x:number,z:number,ids:readonly string[]):string|undefined {
  const allowed=new Set(ids);
  const nearby=scenarioTargets(c.options.site).filter(t=>allowed.has(t.id)&&t.availableSol<=c.sol).map(target=>({target,distance:Math.hypot(x-target.x,z-target.z)})).filter(t=>t.distance<=8).sort((a,b)=>a.distance-b.distance||c.options.ranking.indexOf(a.target.objective)-c.options.ranking.indexOf(b.target.objective)||(a.target.id<b.target.id?-1:a.target.id>b.target.id?1:0));
  return (nearby.find(t=>targetReadiness(c,t.target.id).allowed)??nearby[0])?.target.id;
}
