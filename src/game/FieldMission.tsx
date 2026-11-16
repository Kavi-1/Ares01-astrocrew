import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { BookOpen, Camera, ArrowUp, Radio, Settings2, Wind, X, ChevronRight, FlaskConical } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useMarsStore } from '../store/marsStore';
import { acquireWeather, commitPlan, dataSummary, declineUnusualRock, generationForSol, holdForRelay, objectiveCapabilities, prioritizeData, resolveRoute, runMoxie, scienceSummary, transmit, type Campaign } from '../engine/campaign';
import { advanceExpedition, getExpeditionBeat } from '../engine/expedition';
import { getFieldBrief, getFormationStory, getObservationInsight, getCrewFieldReaction } from '../data/fieldExperience';
import { getCrew } from '../data/crew';
import { OBJECTIVES, scenarioTargets } from '../data/scenarios';
import { FIXED, type InstrumentId } from '../nasa/data';
import SolControls from './MissionPlanning';
import FieldScience from './FieldScience';
import './field-mission.css';

const cue = (kind:string) => window.dispatchEvent(new CustomEvent('ares:field-cue',{detail:{kind}}));
const mbit = (bits:number) => (bits/1e6).toFixed(1);

export default function FieldMission({drivingStatus}:{drivingStatus:ReactNode}) {
  const c=useGameStore(s=>s.campaign)!;
  const setCampaign=useGameStore(s=>s.setCampaign);
  const progress=useGameStore(s=>s.missionProgress);
  const phase=useMarsStore(s=>s.phase);
  const speed=useMarsStore(s=>s.speed),distance=useMarsStore(s=>s.distance);
  const camera=useMarsStore(s=>s.cameraMode),anchors=useMarsStore(s=>s.worldAnchors);
  const focus=useMarsStore(s=>s.focusedTargetId);
  const readingTarget=useMarsStore(s=>s.activeScienceStage?.targetId);
  const [panel,setPanel]=useState<'engineering'|'comms'|'journal'|null>(null);
  const [expanded,setExpanded]=useState(true);
  const [activity,setActivity]=useState<'meda'|'moxie'|null>(null);
  const [reading,setReading]=useState(0);
  const [notice,setNotice]=useState('');
  const [discovery,setDiscovery]=useState<{title:string;body:string;crew:string}|null>(null);
  const [leaveOpen,setLeaveOpen]=useState(false);
  const [samplingEngaged,setSamplingEngaged]=useState(false);
  const resume=useRef(false),lastCompleted=useRef(c.completed);
  const timer=useRef<number|undefined>(undefined);
  const brief=getFieldBrief(c),beat=getExpeditionBeat(c),data=dataSummary(c),summary=scienceSummary(c);
  const targets=scenarioTargets(c.options.site);
  const known=targets.filter(t=>t.availableSol<=c.sol&&!c.completed.includes('science:'+t.id)&&!c.completed.includes('declined:'+t.id));
  const goal=known.find(t=>t.id===focus)??known.find(t=>t.availableSol===c.sol)??known[0];
  const goalDistance=goal?Math.hypot(progress.x-goal.x,progress.z-goal.z):0;
  const goalBearing=goal?Math.atan2(-(goal.x-progress.x),-(goal.z-progress.z))-progress.heading:0;
  const weatherDone=c.completed.includes('science:weather:'+c.sol)||c.completed.includes('science:moxie:'+c.sol);
  const meda=c.config.instruments.includes('meda');
  const pendingEvent=c.events.find(e=>!e.resolved);
  const samplingPending=c.events.some(e=>e.id==='D12'&&!e.resolved);
  const recordCount=new Set(c.products.filter(p=>p.method==='MEDA'||p.method==='MOXIE + MEDA context').map(p=>p.sol)).size;
  const apply=(next:Campaign)=>{setCampaign(next);if(next.message)setNotice(next.message);};
  const announce=(instrument:InstrumentId)=>{
    const target=targets.find(t=>t.id===(useMarsStore.getState().focusedTargetId??useMarsStore.getState().nearbyTargetId));
    const insight=getObservationInsight(c.options.site,target?.objective??'E',instrument,target?.unit);
    setDiscovery({title:insight.title,body:insight.explanation,crew:insight.crewId});
    cue('discovery');window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setDiscovery(null),9000);
  };
  useEffect(()=>{
    const added=c.completed.filter(id=>id.startsWith('science:')&&!lastCompleted.current.includes(id));
    lastCompleted.current=c.completed;
    if(added.length){
      const id=added.at(-1)!;
      if(id.includes('weather:'))announce('meda');
      else if(id.includes('moxie:'))announce('moxie');
      else {const target=targets.find(t=>'science:'+t.id===id);if(target)announce(target.objective==='B'?'sherloc':'pixl');}
    }
  },[c.completed]);
  useEffect(()=>{setExpanded(true);setActivity(null);setReading(0);setSamplingEngaged(false);},[c.sol]);
  useEffect(()=>{if(!notice)return;const timeout=window.setTimeout(()=>setNotice(''),5500);return()=>window.clearTimeout(timeout);},[notice]);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  const advance=(moveOn=false)=>{
    useMarsStore.getState().cancelScienceInteraction();
    const current=useGameStore.getState().campaign!;
    const result=advanceExpedition(moveOn?declineUnusualRock(current):current);
    apply(result.campaign);setNotice(result.summary);setPanel(null);
  };
  const changeLeave=(open:boolean)=>{
    if(open){resume.current=useMarsStore.getState().phase==='active';if(resume.current)useMarsStore.getState().togglePause();}
    else if(resume.current&&useGameStore.getState().missionPhase==='mars'&&useMarsStore.getState().phase==='paused')useMarsStore.getState().togglePause();
    setLeaveOpen(open);
  };
  const continueMission=()=>{
    if(samplingPending){changeLeave(true);return;}
    const capabilities=objectiveCapabilities(c.config);
    const unfinished=targets.some(t=>t.availableSol===c.sol&&capabilities[t.objective]&&!c.completed.includes('science:'+t.id)&&!c.completed.includes('declined:'+t.id));
    if((unfinished||meda&&c.plan.weather&&!weatherDone&&recordCount<10)&&!c.safe)changeLeave(true);else advance();
  };
  const startEnvironment=(instrument:'meda'|'moxie')=>{
    useMarsStore.getState().cancelScienceInteraction();
    setActivity(instrument);setReading(0);setPanel(null);
    useMarsStore.getState().setScienceTool(instrument);
    useMarsStore.getState().setCameraMode('mast');cue(instrument);
  };
  const confirmEnvironment=()=>{
    cue(activity??'meda');
    if(reading===0){setReading(1);return;}
    const before=useGameStore.getState().campaign!;
    const next=activity==='moxie'?runMoxie(before):acquireWeather(before);
    apply(next);
    if(next.products.length>before.products.length)setNotice((activity==='moxie'?'MOXIE / MEDA':'MEDA')+' context recorded for Sol '+before.sol+'. Its data is onboard until returned.');
    setActivity(null);setReading(0);
  };
  useEffect(()=>{
    if(!activity||phase!=='active')return;
    const interact=(event:Event)=>{event.preventDefault();confirmEnvironment();};
    window.addEventListener('ares:field-interact',interact);
    return()=>window.removeEventListener('ares:field-interact',interact);
  },[activity,reading,phase]);
  const uniqueAnchors=anchors.filter(a=>a.visible).filter((a,index,array)=>array.findIndex(other=>Math.hypot(other.x-a.x,other.y-a.y)<25)===index);
  return <div className={'field-hud '+(phase==='active'?'':'is-inactive')} data-camera-mode={camera}>
    <aside className="field-mission" aria-label="Field mission" data-active-sol={beat.index} data-coach="sol-plan">
      <div className="field-chapter"><span>FIELD {String(beat.index).padStart(2,'0')} / {beat.total} <i>·</i> SOL {c.sol} / {c.totalSols}</span><button aria-label={expanded?'Minimize field briefing':'Expand field briefing'} onClick={()=>setExpanded(!expanded)}>{expanded?'−':'+'}</button></div>
      <h2>{brief.title}</h2><p className="field-subtitle">{brief.subtitle}</p>
      {(expanded||c.mode==='planning')&&<div className="field-brief-body"><p><b>{getCrew(brief.crewId).name}</b> {brief.briefing}</p><small>{brief.whyItMatters}</small></div>}
      {!panel&&<div className="field-coach-slot" data-field-coach/>}
      {c.mode==='planning'&&<small className="field-plan-draft">Draft: {c.plan.driveHours.toFixed(1)} h drive · {c.plan.science?c.plan.scienceHours.toFixed(1)+' h science':'science off'} · weather {c.plan.weather?'on':'off'} · contact {c.plan.transmit?'on':'off'}. Review under Engineering.</small>}
      {c.mode==='planning'&&panel!=='engineering'&&<button className="ax-btn ax-btn--primary field-commit" onClick={()=>{apply(commitPlan(c,c.plan));setExpanded(false);}}>Commit sol plan <ChevronRight size={15}/></button>}
      <small className="field-model-label">Authored expedition · {beat.total} active field sols · {c.totalSols} modeled sols</small>
    </aside>
    <div className="field-camera-controls" aria-label="Camera controls">
      {(['chase','mast','survey'] as const).map(mode=><button key={mode} aria-label={mode[0].toUpperCase()+mode.slice(1)+' camera'} aria-pressed={camera===mode} onClick={()=>useMarsStore.getState().setCameraMode(mode)}><Camera size={14}/><span>{mode}</span></button>)}
      <button aria-label="Reset camera" onClick={()=>useMarsStore.getState().resetCamera()}>↺</button>
    </div>
    {phase==='active'&&uniqueAnchors.map(anchor=>{
      const target=targets.find(t=>t.id===anchor.id);if(!target)return null;
      return <button key={anchor.id} className={'field-world-anchor '+(focus===anchor.id?'is-selected':'')} style={{left:anchor.x,top:anchor.y}} aria-label={'Inspect '+target.name} onClick={()=>{useMarsStore.getState().setFocusedTarget(anchor.id);setExpanded(false);}}><span aria-hidden="true">◇</span><small>{getFormationStory(c.options.site,target.unit).name} <i>{Math.round(anchor.distance)} m</i></small></button>;
    })}
    {goal&&phase==='active'&&<div className="field-bearing" aria-label="Navigation bearing"><ArrowUp size={18} style={{transform:'rotate('+(-goalBearing)+'rad)'}}/><span>{getFormationStory(c.options.site,goal.unit).name}</span><b>{Math.round(goalDistance)} m</b></div>}
    {phase==='active'&&pendingEvent&&(pendingEvent.id!=='D12'||!samplingEngaged&&readingTarget!==c.options.site+'-B-2')&&<section className="field-decision" aria-label="Field decision" data-coach="event" data-event-id={pendingEvent.id}>
      <small>CREW UPLINK / {pendingEvent.id}</small><h3>{pendingEvent.title}</h3><p>{pendingEvent.detail}</p>
      {pendingEvent.id==='E1'&&<><button onClick={()=>apply(resolveRoute(c,'reroute'))}>Reroute safely</button><button className="field-risk" onClick={()=>{if(window.confirm('Crossing this authored hazard permanently disables mobility. Continue with stationary science?'))apply(resolveRoute(c,'cross'));}}>Cross anyway · lose mobility</button></>}
      {pendingEvent.id==='E2'&&<><button onClick={()=>setPanel('comms')}>Review return queue</button><button onClick={()=>apply(holdForRelay(c))}>Wait for next relay pass</button></>}
      {pendingEvent.id==='D12'&&<><button onClick={()=>{useMarsStore.getState().setFocusedTarget(c.options.site+'-B-2');useMarsStore.getState().setScienceTool(null);useMarsStore.getState().setCameraMode('survey');setExpanded(false);setSamplingEngaged(true);}}>Examine unusual rock</button><button className="field-risk" onClick={()=>{if(window.confirm('Move on permanently? This forfeits the unusual rock\u2019s biosignature bundle. Biosignature completion can reach at most 3/4 (75%). Collected partial data and spent resources remain recorded.')){useMarsStore.getState().cancelScienceInteraction();apply(declineUnusualRock(c));}}}>Move on without sample</button></>}
      {pendingEvent.id.startsWith('E4')&&<button onClick={()=>setPanel('engineering')}>Review power plan</button>}
    </section>}
    <div className="field-science-slot"><FieldScience onDiscovery={announce}/></div>
    {activity&&phase==='active'&&<section className="field-environment" aria-label="Environmental observation">
      <small>{activity==='meda'?'MEDA · ATMOSPHERIC CONTEXT':'MOXIE · OXYGEN DEMONSTRATION'}</small>
      <h3>{reading===0?'Read the conditions':'Connect the evidence'}</h3>
      <div className={'field-sensor-view '+activity}><i/><i/><i/><span>{activity==='meda'?'WIND / DUST / ATMOSPHERE':'CO₂ → O₂'}</span></div>
      <p>{activity==='meda'?'Record a distinct sol of weather context. The patterns are illustrative; no synthetic temperature or wind reading is presented as NASA data.':'Compare the power cost of oxygen production with the steady MMRTG supply. The animation illustrates the process, rather than a measured oxygen yield.'}</p>
      <small>Model: {activity==='meda'?'17 W · 25% sol duty cycle (assumed)':'300 W × 1 h + MEDA context'}. Interaction timing is compressed.</small>
      <button className="ax-btn ax-btn--primary" onClick={confirmEnvironment}>{reading===0?'Compare sensor view':'Confirm environmental record'}</button><button className="ax-btn" onClick={()=>setActivity(null)}>Cancel observation</button>
    </section>}
    {discovery&&phase==='active'&&<aside className="field-discovery" role="status" aria-label="Discovery recorded"><small>OBSERVATION SECURED / {getCrew(discovery.crew).name}</small><h3>{discovery.title}</h3><p>{discovery.body}</p><button onClick={()=>{setDiscovery(null);setPanel('journal');}}>Open field notebook</button><button aria-label="Dismiss discovery" onClick={()=>setDiscovery(null)}>×</button></aside>}
    {!panel&&<div className="field-status">{drivingStatus}</div>}
    <div className="field-telemetry" aria-label="Rover telemetry"><span data-rover-speed={speed>0?FIXED.driveSpeedMps.toFixed(3):'0.000'}>{speed>0?FIXED.driveSpeedMps.toFixed(3):'0.000'}<small> m/s modeled</small></span><span>{distance.toFixed(1)}<small> m traversed</small></span><span>{c.energyWh.toFixed(1)}<small> Wh · {(c.energyWh/2408*100).toFixed(1)}%</small><i className="field-battery"><em style={{width:c.energyWh/2408*100+'%'}}/><b style={{left:c.config.reserve*100+'%'}}/></i></span></div>
    <nav className="field-tools" aria-label="Field tools">
      <button title={!c.plan.weather?'Enable weather in the sol plan':weatherDone?'This sol already has its context record':undefined} disabled={c.mode!=='operations'||c.safe||!meda||!c.plan.weather||weatherDone||Math.abs(speed)>.8} onClick={()=>startEnvironment('meda')}><Wind size={17}/><span>Log weather</span><small>{Math.min(10,recordCount)}/10 sols</small></button>
      {c.config.moxieRun&&c.config.instruments.includes('moxie')&&<button disabled={c.mode!=='operations'||c.safe||!meda||!c.plan.weather||weatherDone||Math.abs(speed)>.8} onClick={()=>startEnvironment('moxie')}><FlaskConical size={17}/><span>MOXIE</span></button>}
      <button aria-label="Communications" aria-expanded={panel==='comms'} onClick={()=>setPanel(panel==='comms'?null:'comms')}><Radio size={17}/><span>{mbit(data.onboardBits)} Mbit onboard</span></button>
      <button aria-label="Field notebook" aria-expanded={panel==='journal'} onClick={()=>setPanel(panel==='journal'?null:'journal')}><BookOpen size={17}/><span>Notebook</span></button>
      <button aria-label="Engineering" aria-expanded={panel==='engineering'} onClick={()=>setPanel(panel==='engineering'?null:'engineering')}><Settings2 size={17}/><span>Engineering</span></button>
      <button className="field-continue" data-coach="end-sol" onClick={continueMission}>Continue expedition <ChevronRight size={17}/></button>
    </nav>
    {panel&&<section className={'field-drawer is-'+panel} aria-label={panel==='engineering'?'Engineering review':panel==='comms'?'Science return queue':'Field notebook'}><header><strong>{panel==='engineering'?'Engineering review':panel==='comms'?'Return the discoveries':'Field notebook'}</strong><button aria-label="Close field panel" onClick={()=>setPanel(null)}><X size={17}/></button></header>{drivingStatus}<div className="field-coach-slot" data-field-coach/>
      {panel==='engineering'?<><p>MMRTG {generationForSol(c).toFixed(2)} W · baseline {c.config.baselineW} W · reserve {c.config.reserve*100}% (assumed policy). Reading and aiming do not spend modeled time.</p><SolControls key={c.sol}/></>:panel==='comms'?<>
        <p>{getCrewFieldReaction(c,'transmit').text}</p><dl><div><dt>Collected</dt><dd>{mbit(data.collectedBits)} Mbit</dd></div><div><dt>Returned</dt><dd>{mbit(data.returnedBits)} Mbit</dd></div><div><dt>Onboard</dt><dd>{mbit(data.onboardBits)} Mbit</dd></div><div><dt>Unrecoverable</dt><dd>{mbit(data.lostBits)} Mbit</dd></div></dl>
        <p className="field-assumption">Science-available storage capacity: UNKNOWN. NASA's 2 GB flash specification is not an allocated science buffer. Data remains onboard when a pass is full or unavailable.</p>
        <div className="field-return-priority">{OBJECTIVES.map(o=><button key={o.id} aria-pressed={c.dataPriority[0]===o.id} onClick={()=>apply(prioritizeData(c,o.id))}>Return {o.id} first</button>)}</div>
        <button className="ax-btn ax-btn--primary" onClick={()=>{cue('relay');apply(transmit(c));}}>Transmit queued science</button>
        <ol>{c.products.filter(p=>p.sentBits<p.bits).map(p=><li key={p.id}>{p.method} <span>{mbit(p.bits-p.sentBits)} Mbit pending</span></li>)}</ol>
      </>:<><p>Returned evidence: {summary.sciencePoints.toFixed(2)} / 30 scientific value. Ranking {c.options.ranking.join(' → ')} uses 50% / 30% / 20%.</p>{targets.map(t=>{
        const products=c.products.filter(p=>p.id.startsWith(t.id+':')),complete=c.completed.includes('science:'+t.id),returned=complete&&products.length>0&&products.every(p=>p.sentBits===p.bits);
        const declined=c.completed.includes('declined:'+t.id);
        if(!products.length&&!declined)return null;const story=getFormationStory(c.options.site,t.unit);
        return <article className="field-note" key={t.id}><small>{declined?'D12 · OPPORTUNITY FORFEITED':returned?'RETURNED':complete?'ONBOARD':'PARTIAL BUNDLE · NO CREDIT YET'}</small><h3>{story.name}</h3><p>{declined?'The crew chose to move on permanently. This rock cannot earn a biosignature unit; that objective is capped at 3/4 (75%). Any partial data and spent resources remain recorded.':getObservationInsight(c.options.site,t.objective,t.objective==='B'?'sherloc':'mastcam-z',t.unit).explanation}</p><small>{products.map(p=>p.method).filter((p,i,a)=>a.indexOf(p)===i).join(' · ')}</small></article>;
      })}<p className="field-assumption">All formations, map patterns and crew narratives are authored educational interpretations, not measured NASA terrain products. Organic context is not proof of life.</p></>}
    </section>}
    {notice&&phase==='active'&&<div className="field-notice" role="status" onClick={()=>setNotice('')}>{notice}</div>}
    <AlertDialog.Root open={leaveOpen} onOpenChange={changeLeave}><AlertDialog.Portal><AlertDialog.Overlay className="dialog-overlay"/><AlertDialog.Content className="mission-dialog field-leave-dialog"><AlertDialog.Title>{samplingPending?'Move on from the unusual rock?':'Leave this field sol?'}</AlertDialog.Title><AlertDialog.Description>{samplingPending?'D12 is irreversible: leaving now forfeits this rock\u2019s biosignature bundle and caps that objective at 3/4 (75%). Any partial data and spent resources remain recorded. Stay to complete SHERLOC and PIXL at the rock.':'There is unfinished science or an unrecorded weather context. Your collected work stays recorded; incomplete or unreturned bundles earn no scientific credit. Quiet days will still consume baseline power and use only the selected contacts.'}</AlertDialog.Description><div className="dialog-actions"><AlertDialog.Cancel asChild><button className="ax-btn">Stay and explore</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="ax-btn ax-btn--primary" onClick={()=>advance(samplingPending)}>{samplingPending?'Move on permanently':'Leave for next field sol'}</button></AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>
  </div>;
}
