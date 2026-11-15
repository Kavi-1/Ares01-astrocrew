import { useMemo } from 'react';
import { CREW } from '../../data/crew';
import { getScenario, OBJECTIVES } from '../../data/scenarios';
import { missionChecks } from '../../engine/campaign';
import { calculateEngineering } from '../../nasa/engineering';
import type { RoverConfig } from '../../nasa/data';
import { useGameStore } from '../../store/gameStore';

/** Existing crew writing and actual mission observations; this disclosure has no hint/score side effects. */
export default function FieldNotes({config}:{config:RoverConfig}) {
  const options=useGameStore(s=>s.missionOptions),campaign=useGameStore(s=>s.campaign);
  const engineering=useMemo(()=>calculateEngineering(config),[config]);
  const checks=useMemo(()=>missionChecks(options,config),[options,config]);
  const site=getScenario(options.site);
  const observations:Record<string,string>={
    kavi:`Current mission cost $${checks.budget.totalCostUsdMillion} M / $${checks.budget.budget.amountUsdMillion} M. ${checks.budget.withinBudget?'The design fits the budget.':'Accepting this budget overrun shortens operations to 20 sols.'}`,
    aaryan:`Rover ${checks.mass.toFixed(2)} kg; rover plus relay ${checks.launchMass.toFixed(2)} kg against ${checks.capacity} kg for the selected vehicle. Landing index ${checks.landingDemand.toFixed(2)} / 1125 kg-equivalent (approved game assumption).`,
    houssam:`Current setup estimate: ${engineering.genWh.toFixed(1)} Wh generated, ${(engineering.baseWh+engineering.activityWh).toFixed(1)} Wh consumed per sol. Reserve ${config.reserve*100}% is a safety threshold. The surface plan charges only work actually executed.`,
    huzaifa:`Selected contact strategy: ${config.downlink==='UHF'?`UHF via ${options.relay}`:'direct X-band'}. Only completely returned observation bundles earn scientific value. An outage leaves unsent products onboard.`,
    lautaro:`${site.name}: ${site.context} ${site.terrain}. The authored barrier is ${site.slope}° / ${site.obstacle} m; its safe detour adds ${site.detour} m.`,
    rihabe:`Ranked objectives: ${options.ranking.map((id,index)=>`${OBJECTIVES.find(o=>o.id===id)!.name} (${[50,30,20][index]}%)`).join('; ')}. Organic/mineral context is not proof of life.`,
  };
  return <details className="field-notes-journal"><summary>Field notes journal</summary><p className="field-notes-caption">Explore · Full available crew dialogue and current observations. Coach explanations are separate.</p>
    {CREW.map(member=><article key={member.id}><h3>{member.name} <small>{member.role}</small></h3><p>{member.introduction}</p><p>{observations[member.id]}</p></article>)}
    {(engineering.issues.length>0||engineering.warnings.length>0)&&<section aria-label="Relevant engineering advice"><h3>Checks to discuss with the crew</h3><ul>{[...engineering.issues,...engineering.warnings].map(text=><li key={text}>{text}</li>)}</ul></section>}
    {campaign&&campaign.events.length>0&&<section><h3>Encountered mission events</h3>{campaign.events.map(event=><p key={event.id}>{event.title}: {event.detail}</p>)}</section>}
  </details>;
}
