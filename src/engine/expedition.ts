import { scenarioTargets, getScenario, WINDOWS } from '../data/scenarios';
import { commitPlan, endSol, type Campaign, type SolPlan } from './campaign';

export type ExpeditionBeat = {
  id:string; sol:number; index:number; total:number; title:string; briefing:string;
  kind:'landing'|'science'|'route'|'communications'|'environment'|'finale';
  crew:string; targetIds:string[]; activeSols:number[];
};
export type ExpeditionAdvance = { campaign:Campaign; skippedSols:number[]; summary:string };

/** Authored field days retain all original target releases and exact event dates. */
export function activeExpeditionSols(c:Campaign):number[] {
  const sols=new Set([1,WINDOWS[c.options.window].hazardSol,getScenario(c.options.site).outageSol,...scenarioTargets(c.options.site).map(t=>t.availableSol)]);
  if(sols.size<10)sols.add(c.totalSols);
  return [...sols].filter(sol=>sol<=c.totalSols).sort((a,b)=>a-b);
}

export function getExpeditionBeat(c:Campaign):ExpeditionBeat {
  const activeSols=activeExpeditionSols(c),site=getScenario(c.options.site),targetIds=scenarioTargets(c.options.site).filter(t=>t.availableSol===c.sol).map(t=>t.id);
  const index=Math.min(activeSols.length,activeSols.filter(sol=>sol<c.sol).length+1);
  let kind:ExpeditionBeat['kind']='environment',title='Read the Martian environment',crew='Houssam',briefing='Use MEDA to compare this sol with earlier weather records. Generation, baseline load and contact capacity remain real mission resources.';
  if(c.sol===1){kind='landing';title='First tracks';crew='Kavi';briefing=`Welcome to ${site.name}. Test the rover, frame the terrain and record the first MEDA context. Your ranked objectives guide the expedition.`;}
  else if(c.sol===WINDOWS[c.options.window].hazardSol){kind='route';title='The route ahead';crew='Lautaro';briefing=`A ${site.slope}° slope and ${site.obstacle} m obstacle exceed the planned crossing limits. Review the ${site.detour} m safe detour before choosing a route.`;}
  else if(c.sol===site.outageSol){kind='communications';title='Bring the discoveries home';crew='Huzaifa';briefing='A scheduled relay opportunity is unavailable. Choose which science returns first; the remaining data stays onboard.';}
  else if(targetIds.length){kind='science';const target=scenarioTargets(c.options.site).find(t=>t.id===targetIds[0])!;crew=target.objective==='B'?'Rihabe':'Lautaro';title=target.objective==='B'?'A rock with a story':'Read the mineral landscape';briefing=target.objective==='B'?'Compare SHERLOC organic/mineral context with a co-located PIXL elemental map. These observations can constrain habitability; they cannot establish life.':'Frame a Mastcam-Z context image, then choose the installed composition instrument or a qualifying unique RIMFAX track.';}
  else if(c.sol===c.totalSols){kind='finale';title='One last look';crew='Kavi';briefing='Capture the final environmental context, review the onboard queue and return what the remaining contact can carry. The report will distinguish acquired science from returned evidence.';}
  return {id:`${c.options.site}:${c.sol}`,sol:c.sol,index,total:activeSols.length,title,briefing,kind,crew,targetIds,activeSols};
}

function needsReview(c:Campaign) {
  return c.safe||c.skipNext||c.events.some(e=>!e.resolved);
}

/**
 * Invoked only by an explicit End-sol action. Every intervening sol executes the
 * same canonical reducers as manual operation. Quiet days do no optional work;
 * they cannot resolve a decision, acquire weather or refill a battery directly.
 */
export function advanceExpedition(c:Campaign):ExpeditionAdvance {
  const skippedSols:number[]=[];
  if(c.mode==='finished')return {campaign:c,skippedSols,summary:'Mission duration completed.'};
  const beganSafe=c.safe||c.skipNext,transmit=c.plan.transmit,standingPlan={...c.plan};
  let quietDraftApplied=false;
  let next=endSol(c);
  if(next.sol===c.sol||next.mode==='finished')return {campaign:next,skippedSols,summary:next.message};
  const active=new Set(activeExpeditionSols(c));
  if(!beganSafe&&!needsReview(next)){
    for(let count=0;count<c.totalSols&&next.mode!=='finished'&&!active.has(next.sol)&&!needsReview(next);count++){
      const quietPlan:SolPlan={driveHours:0,scienceHours:0,science:false,weather:false,transmit};
      quietDraftApplied=true;
      next=commitPlan(next,quietPlan);
      if(next.mode!=='operations'||needsReview(next))break;
      const quietSol=next.sol,closed=endSol(next);
      if(closed.sol===quietSol&&closed.mode!=='finished'){next=closed;break;}
      skippedSols.push(quietSol);next=closed;
    }
  }
  // Quiet-day allocations describe executed quiet days, not the player's next
  // field-day draft. Carry the chosen draft forward without committing it or
  // changing any energy, activity, contact or safety result. Safe mode still
  // forbids optional work even when its future planning draft has allocations.
  if(quietDraftApplied&&next.mode!=='finished')next={...next,plan:standingPlan};
  const summary=skippedSols.length?`${skippedSols.length} quiet sol${skippedSols.length===1?'':'s'} simulated: MMRTG generation, baseline consumption and selected contacts accounted for. ${next.mode==='finished'?'Mission duration completed.':`Sol ${next.sol} awaits your review.`}`:next.message;
  return {campaign:next,skippedSols,summary};
}
