import { useState, type ReactNode } from 'react';
import { OBJECTIVES, SCENARIOS, scenarioProvenance, type Ranking } from '../data/scenarios';
import { DEFAULT_SOL_PLAN, acquireWeather, commitPlan, declineUnusualRock, endSol, forecastSol, missionChecks, prioritizeData, resolveRoute, runMoxie, scienceSummary, skipQuietSols, setOperatingDownlink, reviewRemainingPlan, transmit, waitHours, type MissionOptions, type SolPlan } from '../engine/campaign';
import { useGameStore } from '../store/gameStore';
import { useMarsStore } from '../store/marsStore';
import { FIXED } from '../nasa/data';
import './mission-planning.css';

export function ScenarioSetup() {
  const options=useGameStore(s=>s.missionOptions),setOptions=useGameStore(s=>s.setMissionOptions);
  const rank=(index:number,id:string)=>{const next=[...options.ranking] as Ranking;const prior=next.indexOf(id as Ranking[number]);[next[index],next[prior]]=[next[prior],next[index]];setOptions({ranking:next});};
  return <div className="scenario-setup"><p className="hub-note">Geologist: choose a route. Astrobiologist: rank the returned evidence. All sites are synthetic game scenarios based on Mars science contexts.</p>
    <fieldset><legend>Landing scenario</legend><div className="scenario-choices">{SCENARIOS.map(site=><button type="button" key={site.id} aria-pressed={site.id===options.site} onClick={()=>setOptions({site:site.id})}><b>{site.name}</b><span>{site.context}</span><small>{site.terrain} · detour {site.detour} m · E2 sol {site.outageSol}</small><small>ASSUMED screening factor h={site.hazard.toFixed(2)} · not a failure probability</small></button>)}</div></fieldset>
    <fieldset><legend>Rank scientific objectives</legend>{options.ranking.map((id,index)=><label className="hub-field" key={index}>Priority {index+1} · {[50,30,20][index]}%<select aria-label={`Objective priority ${index+1}`} value={id} onChange={e=>rank(index,e.target.value)}>{OBJECTIVES.map(objective=><option key={objective.id} value={objective.id}>{objective.name}</option>)}</select></label>)}<p className="hub-note">Only fully returned evidence bundles count: geology 4, potential biosignature context 4, environment 10. Ranking changes scientific value (30 points) and transmission priority.</p></fieldset>
    <details><summary>Scenario assumptions</summary><p className="hub-note">{scenarioProvenance}</p></details>
  </div>;
}
export function LaunchSetup() {
  const options=useGameStore(s=>s.missionOptions),config=useGameStore(s=>s.roverConfig),setOptions=useGameStore(s=>s.setMissionOptions),notice=useGameStore(s=>s.notice),attempt=useGameStore(s=>s.launchAttempt);
  const check=missionChecks(options,config);
  const selection=(field:'vehicle'|'relay'|'window',value:string)=>setOptions({[field]:value} as Partial<MissionOptions>);
  const risk=(key:keyof MissionOptions['risks'],label:string)=> <label className="mission-risk"><input type="checkbox" checked={options.risks[key]} disabled={key==='mass'&&attempt===2} onChange={e=>setOptions({risks:{...options.risks,[key]:e.target.checked}})}/>{label}</label>;
  return <div className="launch-setup"><h3>Launch and landing checks</h3>
    <label className="hub-field">Launch vehicle<select aria-label="Launch vehicle" value={options.vehicle} onChange={e=>selection('vehicle',e.target.value)}><option value="light">Light · 1,200 kg · $120 M</option><option value="medium">Medium · 1,500 kg · $180 M</option><option value="heavy">Heavy · 1,550 kg · $245 M</option></select></label>
    <label className="hub-field">Relay orbit<select aria-label="Relay orbit" value={options.relay} onChange={e=>selection('relay',e.target.value)}><option value="O1">Existing orbiters · 960 Mbit/sol · $0 M</option><option value="O2">Own elliptical · 2,880 Mbit/sol · $80 M</option><option value="O3">Own areostationary · 1,800 Mbit/sol · $140 M</option></select></label>
    <label className="hub-field">Arrival season<select aria-label="Arrival season" value={options.window} onChange={e=>selection('window',e.target.value)}><option value="W1">W1 · Ls 0° · E1 sol 5</option><option value="W2">W2 · Ls 90° · E1 sol 6</option><option value="W3">W3 · Ls 270° · E1 sol 7</option></select></label>
    <dl className="scenario-checks"><div><dt>Launch mass / capacity</dt><dd>{check.launchMass.toFixed(1)} / {check.capacity} kg</dd></div><div><dt>Landing index / capacity (assumed)</dt><dd>{check.landingDemand.toFixed(2)} / 1125 kg-equivalent</dd></div><div><dt>Mission cost / budget</dt><dd>${check.budget.totalCostUsdMillion} / ${check.budget.budget.amountUsdMillion} M</dd></div><div><dt>Surface duration</dt><dd>{check.budget.withinBudget?'30 sols':'20 sols if budget risk accepted'}</dd></div></dl>
    {!check.massPass&&risk('mass',attempt===2?'Mass failure locked on retry — fix the design.':'Accept launch failure and one redesign attempt')}
    {!check.landingPass&&risk('landing','Accept hard landing: mobility will be lost; stationary science remains')}
    {!check.budget.withinBudget&&risk('budget','Accept budget overrun: surface operations shorten from 30 to 20 sols')}
    <p className="hub-note">Vehicle allowances, relay masses, landing indices and season snapshots are approved game assumptions. MMRTG generation does not depend on sunlight. Antenna power remains in the baseline load.</p>
    {notice&&<p className="hub-warning" role="status">{notice}</p>}
  </div>;
}

export default function SolControls({ children }: { children?: ReactNode } = {}) {
  const campaign=useGameStore(s=>s.campaign),setCampaign=useGameStore(s=>s.setCampaign);
  const [plan,setPlan]=useState<SolPlan>(()=>({...useGameStore.getState().campaign?.plan??DEFAULT_SOL_PLAN}));
  if(!campaign)return null;
  const forecast=forecastSol(campaign,plan),summary=scienceSummary(campaign);
  const apply=(next:typeof campaign)=>setCampaign(next);
  const close=()=>apply(endSol(campaign));
  return <aside className={'sol-console '+(campaign.mode==='planning'?'is-planning':'')} aria-label="Sol operations" data-coach="sol-plan">
    {children}
    <details key={`${campaign.sol}-${campaign.mode}`} open={campaign.mode==='planning'||campaign.safe}>
      <summary><span>SOL {campaign.sol} / {campaign.totalSols} <b>//</b> {campaign.safe?'SAFE RECOVERY':campaign.mode==='planning'?'PLAN':'OPERATIONS'}</span><small>{campaign.energyWh.toFixed(1)} Wh</small></summary>
      <div className="sol-console-body">{campaign.majorFailures.length>0&&<p className="sol-message" role="alert">{campaign.majorFailures.at(-1)}</p>}<p>{SCENARIOS.find(s=>s.id===campaign.options.site)?.name} · {campaign.mobilityDisabled?'MOBILITY DISABLED · stationary science':'MMRTG / PERSEVERANCE'}</p>
      <p className="sol-meta">Simulated time: {campaign.elapsedHours.toFixed(2)} / {FIXED.solHours.toFixed(2)} h. Science: {(campaign.scienceSpentHours??0).toFixed(2)} / {(campaign.plan.scienceHours??8.5).toFixed(2)} h. Planning and animation do not consume mission time.</p>
      {campaign.events.filter(e=>!e.resolved).map(event=><div className="sol-event" data-coach="event" key={event.id}><strong>{event.title}</strong><p>{event.detail}</p>{event.id==='E1'&&<div className="sol-buttons"><button onClick={()=>apply(resolveRoute(campaign,'reroute'))}>Reroute safely</button><button onClick={()=>apply(resolveRoute(campaign,'cross'))}>Cross anyway · lose mobility</button></div>}{event.id==='E2'&&<><p>Prioritize the return queue, or end sol to wait. Scoring weights stay fixed.</p><div className="sol-buttons">{OBJECTIVES.map(o=><button key={o.id} onClick={()=>apply(prioritizeData(campaign,o.id))}>Return {o.id} first</button>)}</div></>}{event.id==='D12'&&<><p>Examine with SHERLOC and PIXL in the world, or permanently give up this bundle. Close Engineering to approach the rock. Biosignature completion after moving on is capped at 3/4 (75%).</p><button onClick={()=>{if(window.confirm('Move on permanently? This forfeits the unusual rock\u2019s biosignature bundle and caps that objective at 3/4 (75%).')){useMarsStore.getState().cancelScienceInteraction();apply(declineUnusualRock(campaign));}}}>Move on without sample</button></>}</div>)}
      {campaign.mode==='planning'&&<>
        <label>Contact strategy<select aria-label="Operating downlink" value={campaign.config.downlink} onChange={e=>apply(setOperatingDownlink(campaign,e.target.value as 'UHF'|'X-band'))}><option value="UHF">Use fitted UHF relay hardware</option><option value="X-band">Use fitted X-band / one-hour contact</option></select></label>
        <label>Drive allocation (h, assumed maximum 4)<input aria-label="Planned drive hours" type="number" min="0" max="4" step=".5" value={plan.driveHours} onChange={e=>setPlan({...plan,driveHours:Number(e.target.value)})}/></label>
        <label>Science allocation (hours, excluding MEDA context)<input aria-label="Planned science hours" type="number" min="0" max={FIXED.solHours} step=".5" value={plan.scienceHours} onChange={e=>setPlan({...plan,scienceHours:Number(e.target.value)})}/></label>
        <label><input type="checkbox" checked={plan.science} onChange={e=>setPlan({...plan,science:e.target.checked})}/>Enable science work</label>
        <label><input type="checkbox" checked={plan.weather} onChange={e=>setPlan({...plan,weather:e.target.checked})}/>Schedule MEDA weather</label>
        <label><input type="checkbox" checked={plan.transmit} onChange={e=>setPlan({...plan,transmit:e.target.checked})}/>Use end-sol contact</label>
        <p className="sol-meta">Flat-drive estimate + science power ceiling: {forecast.loadWh.toFixed(1)} Wh load / {forecast.generationWh.toFixed(1)} Wh generation. Net {forecast.netWh.toFixed(1)} Wh. Estimated reserve bound (flat-drive assumption) {(forecast.minimumWh/2408*100).toFixed(1)}%.</p>
        <div className="sol-buttons"><button onClick={()=>apply(skipQuietSols(campaign))}>Skip to next target</button><button onClick={()=>apply(commitPlan(campaign,plan,true))}>Accept safe mode</button></div>
      </>}
      {campaign.mode==='operations'&&<><p className="sol-meta">{campaign.safe?(campaign.skipNext?'Safe mode: optional work canceled. One next-sol skip is recorded.':'Recovery sol: baseline and planned contact only. End sol to resume planning.'):'WASD to drive; E scans nearby available rocks. A scan executes its modeled instrument hours once.'}</p>
        <div className="sol-buttons"><button disabled={campaign.safe} onClick={()=>apply(reviewRemainingPlan(campaign))}>Review remaining plan</button><button disabled={campaign.safe} onClick={()=>apply(acquireWeather(campaign))}>Record MEDA weather</button><button disabled={campaign.safe||!campaign.config.moxieRun} onClick={()=>apply(runMoxie(campaign))}>Run MOXIE</button><button onClick={()=>apply(waitHours(campaign,1))}>Wait / charge 1 modeled hour</button><button onClick={()=>apply(transmit(campaign))}>Transmit queued science</button></div>
      </>}
      <p className="sol-meta">Scientific value {summary.sciencePoints.toFixed(2)} / 30 · G {(summary.fractions.G*100).toFixed(0)}% · B {(summary.fractions.B*100).toFixed(0)}% · E {(summary.fractions.E*100).toFixed(0)}%. Only returned bundles count.</p>
      <p className="sol-meta">Idle recovery uses (MMRTG − baseline) × hours × √0.90. Reserve {campaign.config.reserve*100}% is a safety threshold. No automatic battery refill.</p>
      </div>
    </details>
    <div className="sol-console-footer">
      {campaign.mode==='planning'&&<>
        {!children&&<p className="sol-plan-explanation">Each sol starts with a plan. Review the allocations, then commit this draft to begin operations.</p>}
        <p className="sol-plan-draft" aria-label="Draft sol allocation"><span>Draft sol {campaign.sol}</span><strong>Drive {plan.driveHours.toFixed(1)} h · Science {plan.science?`${plan.scienceHours.toFixed(1)} h`:'off'}</strong></p>
      </>}
      {campaign.message&&<p className="sol-message" role="status">{campaign.message}</p>}
      <div className="sol-footer-actions">
        {campaign.mode==='planning'&&<button className="sol-commit" onClick={()=>apply(commitPlan(campaign,plan))}>Commit sol plan</button>}
        <button data-coach="end-sol" className="sol-end" onClick={close}>{campaign.mode==='planning'?(campaign.sol===campaign.totalSols?'Complete final sol':'End sol'):`End sol ${campaign.sol}`}</button>
      </div>
    </div>
  </aside>;
}
