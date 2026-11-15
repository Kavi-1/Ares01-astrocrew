import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Footprints, X } from 'lucide-react';
import { CREW, getCrew, type CrewId, type CrewMember } from '../../data/crew';
import { SCIENCE_TARGETS } from '../../data/scienceTargets';
import { FIXED, INSTRUMENTS, SOURCES, type InstrumentId, type RoverConfig } from '../../nasa/data';
import { calculateEngineering } from '../../nasa/engineering';
import { useGameStore } from '../../store/gameStore';
import {
  CREW_STATION, STATION_LABELS, STATION_OWNERS, configFingerprint, proposeConfiguration, proposalSafe, supportedTargets,
  type StationId, type PreparationStage, type ProposalPriority, type DecisionStation,
} from '../../engine/preparation';
import CrewRoom from './CrewRoom';
import CrewPortrait from './CrewPortrait';
import MissionProgress from '../components/MissionProgress';
import './prep.css';

const RESPONSIBILITIES: Record<CrewId,string> = {
  kavi:'Lead readiness review and the final launch decision.',
  aaryan:'Choose the science payload. Balance hardware and mass.',
  houssam:'Set reserve, science cadence, and the MOXIE schedule.',
  huzaifa:'Choose the downlink strategy and protect science return.',
  lautaro:'Explain Jezero’s terrain and field targets.',
  rihabe:'Connect science questions to instrument capabilities.',
};
const STATIONS = Object.keys(STATION_LABELS) as StationId[];
const isDecision = (id:StationId|null): id is DecisionStation => id==='payload'||id==='power'||id==='communications';
const TITLES: Record<PreparationStage,string> = { entry:'Choose your seat.', briefing:'Science briefing', workshop:'Mission workshop', review:'Flight readiness review' };
const STEPS: Record<PreparationStage,string> = { entry:'Choose a role', briefing:'1 / 3 · Brief', workshop:'2 / 3 · Configure', review:'3 / 3 · Review' };
type Results = ReturnType<typeof calculateEngineering>;

export default function PreparationHub({ onHome }: {onHome:()=>void}) {
  const selected=useGameStore(s=>s.selectedCrewId), select=useGameStore(s=>s.selectCrew);
  const prep=useGameStore(s=>s.preparation), setPrep=useGameStore(s=>s.setPreparation);
  const config=useGameStore(s=>s.roverConfig), setConfig=useGameStore(s=>s.setRoverConfig);
  const [focus,setFocus]=useState<CrewId>(selected);
  const [navigate,setNavigate]=useState<{id:CrewId;seq:number}>();
  const [instrument,setInstrument]=useState<InstrumentId>('mastcam-z');
  const [priority,setPriority]=useState<ProposalPriority>('safety');
  const [draft,setDraft]=useState<RoverConfig>(config);
  const [message,setMessage]=useState('');
  // Confirms that a decision was recorded; it survives the plan refresh that clears `message`.
  const [receipt,setReceipt]=useState<{station:StationId;text:string}|null>(null);
  const station=prep.activeStation, entry=prep.stage==='entry';
  const fingerprint=configFingerprint(config);
  useEffect(()=>{setDraft(config);setMessage('');},[fingerprint,station]); // Reset uncommitted edits when a different plan/station is opened.
  const result=useMemo(()=>calculateEngineering(config),[config]);
  const draftResult=useMemo(()=>calculateEngineering(draft),[draft]);
  const proposal=useMemo(()=>isDecision(station)?proposeConfiguration(config,station,priority):null,[config,station,priority]);
  const direct=isDecision(station)&&(selected===STATION_OWNERS[station]||prep.decisions[station]?.mode==='takeover');
  const changed=configFingerprint(draft)!==fingerprint;
  const member=getCrew(station&&station!=='briefing'?STATION_OWNERS[station]:focus);
  const go=(stage:PreparationStage,activeStation:StationId|null)=>{
    setPrep({stage,activeStation});
    useGameStore.getState().setMissionPhase(stage==='entry'||stage==='briefing'?'briefing':'engineering');
  };
  const open=(id:StationId,speaker?:CrewId)=>{
    if(prep.stage==='entry')return;
    if(prep.stage==='briefing'&&id!=='briefing'){setMessage('Complete the science briefing to open the workshop.');setPrep({activeStation:'briefing'});return;}
    setFocus(speaker??STATION_OWNERS[id]);setPriority('safety');setMessage('');
    if(id==='review')go('review',id);
    else if(prep.stage==='review'&&isDecision(id))go('workshop',id);
    else setPrep({activeStation:id});
  };
  const close=()=>{setPrep({activeStation:null});setDraft(config);setMessage('');setReceipt(null);};
  const record=(id:DecisionStation,mode:'accepted'|'takeover'|'direct',next:RoverConfig)=>{
    setPrep({decisions:{...prep.decisions,[id]:{mode,fingerprint:configFingerprint(next)}}});
  };
  const accept=()=>{
    if(!proposal?.config||!isDecision(station))return;
    // A proposal is only valid against the exact configuration it was calculated from.
    if(proposal.basedOn!==configFingerprint(useGameStore.getState().roverConfig)||!proposalSafe(proposal.config)){
      setMessage('The plan changed. Review the refreshed proposal before accepting.');return;
    }
    setConfig(proposal.config);record(station,'accepted',proposal.config);
    setReceipt({station,text:'Proposal accepted. The mission plan now uses these settings.'});
  };
  const apply=()=>{
    if(!isDecision(station)||draftResult.issues.length)return;
    setConfig(draft);record(station,selected===STATION_OWNERS[station]?'direct':'takeover',draft);
    setReceipt({station,text:changed?'Changes applied to the mission plan.':'Current plan confirmed for this station.'});
  };
  const walk=(id:StationId)=>{
    close();setFocus(STATION_OWNERS[id]);setNavigate(n=>({id:STATION_OWNERS[id],seq:(n?.seq??0)+1}));
  };
  const toggle=(id:InstrumentId)=>{
    setInstrument(id);
    const instruments=draft.instruments.includes(id)?draft.instruments.filter(i=>i!==id):[...draft.instruments,id];
    setDraft({...draft,instruments,moxieRun:instruments.includes('moxie')&&draft.moxieRun});
  };
  const primary=()=>{
    if(prep.stage==='entry'){setFocus('lautaro');go('briefing','briefing');return;}
    if(prep.stage==='briefing'){go('workshop',null);return;}
    if(prep.stage==='workshop'){open('review');return;}
    if(useGameStore.getState().confirmMission())setPrep({activeStation:null});
  };
  const takeSeat=(id:CrewId)=>{select(id);setFocus(id);};
  const stepSeat=(delta:number)=>{
    const index=CREW.findIndex(c=>c.id===selected);
    takeSeat(CREW[(index+delta+CREW.length)%CREW.length].id);
  };
  useEffect(()=>{
    if(!entry)return;
    const key=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;
      if(e.key==='ArrowLeft'){e.preventDefault();stepSeat(-1);}
      if(e.key==='ArrowRight'){e.preventDefault();stepSeat(1);}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  // The margins rail previews whichever plan the open console would produce.
  const preview=isDecision(station)?(direct?(changed?draft:null):proposal?.config&&configFingerprint(proposal.config)!==fingerprint?proposal.config:null):null;
  const decisionStatus=(id:StationId)=>isDecision(id)&&prep.decisions[id]?(prep.decisions[id]?.fingerprint===fingerprint?(prep.decisions[id]?.mode==='takeover'?'YOUR CONTROL':'REVIEWED'):'PLAN CHANGED'):'';
  const seat=getCrew(selected), seatStation=CREW_STATION[selected];
  const inspected=INSTRUMENTS.find(i=>i.id===instrument);

  return <main className={'mission-room-shell prep '+(station?'has-station':'')} data-stage={prep.stage}>
    <CrewRoom focus={focus} selected={selected} speaking={entry||!!station} navigate={navigate}
      mode={entry?'seat':'hub'} shift={entry?-1.15:1.25}
      onClose={close} onSelect={id=>entry?takeSeat(id):open(CREW_STATION[id],id)}
      workshop={{config:station==='payload'&&direct?draft:config,inspecting:station==='payload'?instrument:null,
        onInspect:id=>{if(prep.stage==='entry')return;if(station!=='payload')open('payload');setInstrument(id);}}}/>
    <div className="prep-scrim" aria-hidden="true"/>
    <header className="prep-top">
      <div className="prep-title">
        <p className="ax-label">ARES-01 <span className="ax-slash">//</span> MISSION CONTROL <span className="ax-slash">//</span> <span className="hub-progress">{STEPS[prep.stage]}</span></p>
        <h1>{TITLES[prep.stage]}</h1>
        <p className="prep-sub">{entry?'Six specialists, one rover. Pick the responsibilities you want to own.':seat.name+' · '+seat.role}</p>
      </div>
      <MissionProgress phase={entry||prep.stage==='briefing'?'briefing':'engineering'}/>
    </header>

    {entry?<section className="seat-select" aria-label="Choose your crew member">
      <div className="seat-dossier">
        <p className="ax-label ax-label--amber">SEAT {String(CREW.findIndex(c=>c.id===selected)+1).padStart(2,'0')} <span className="ax-slash">//</span> {String(CREW.length).padStart(2,'0')}</p>
        <h2>{seat.name}</h2>
        <p className="seat-role">{seat.role}</p>
        <blockquote>{seat.introduction}</blockquote>
        <dl>
          <div><dt>Responsibility</dt><dd>{RESPONSIBILITIES[selected]}</dd></div>
          <div><dt>Your station</dt><dd>{STATION_LABELS[seatStation]}<small>{isDecision(seatStation)?'You set this decision directly.':'Advisory seat. Every engineering station brings you a proposal.'}</small></dd></div>
          <div><dt>Teammates</dt><dd>Accept a proposal, ask for a revision, or take over.<small>Your role determines which controls you own. You can always take over a teammate’s decision.</small></dd></div>
        </dl>
      </div>
      <div className="seat-rail" role="group" aria-label="Crew seats">
        <button className="seat-step" aria-label="Previous crew member" onClick={()=>stepSeat(-1)}><ChevronLeft size={18} aria-hidden="true"/></button>
        {CREW.map(c=><button className="seat-tab" key={c.id} aria-pressed={selected===c.id} onClick={()=>takeSeat(c.id)}><CrewPortrait member={c} decorative/><span><b>{c.name}</b><small>{c.role}</small></span></button>)}
        <button className="seat-step" aria-label="Next crew member" onClick={()=>stepSeat(1)}><ChevronRight size={18} aria-hidden="true"/></button>
      </div>
      <p className="seat-hint"><kbd className="ax-key">←</kbd><kbd className="ax-key">→</kbd> Compare seats <i aria-hidden="true">·</i> Drag to turn <i aria-hidden="true">·</i> Click a teammate in the room</p>
    </section>:<>
      <Vitals result={result} preview={preview} config={config}/>
      {!station&&<p className="room-explore-note">Walk to a teammate and press <kbd className="ax-key">E</kbd>, click a rover marker, or open a station below.<small>Briefing → Workshop → Readiness review · No timed decisions</small></p>}
      {station&&<section className="hub-panel" aria-label={STATION_LABELS[station]}>
        <div className="hub-panel-heading">
          <div><span className="ax-label ax-label--amber">STATION <span className="ax-slash">//</span> {String(STATIONS.indexOf(station)+1).padStart(2,'0')}</span><h2>{STATION_LABELS[station]}</h2></div>
          <button className="console-close" aria-label="Close station" onClick={close}><X size={18} aria-hidden="true"/></button>
        </div>
        <div className="console-body">
        {receipt?.station===station&&!changed&&<p className="hub-good console-receipt" role="status">{receipt.text}</p>}
        {station==='briefing'&&<>
          <Speech member={getCrew('lautaro')} second={getCrew('rihabe')}><p>Perseverance will study three formations in Jezero Crater. Stop at each cyan marker to scan, then transmit the discoveries before ending the mission.</p></Speech>
          <ol className="console-targets">{SCIENCE_TARGETS.map((t,index)=>{
            const supported=supportedTargets(config).some(s=>s.id===t.id);
            return <li className="hub-target" key={t.id}><span className="console-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div><b>{t.name}</b><p>{t.description}</p><small>{t.requiredInstruments.map(id=>INSTRUMENTS.find(i=>i.id===id)?.name).join(' / ')}</small></div><em className={'ax-chip '+(supported?'ax-chip--cyan':'ax-chip--amber')}>{supported?'SUPPORTED':'PAYLOAD REQUIRED'}</em></li>;
          })}</ol>
          <p className="hub-note">All three current targets share the same instrument compatibility. These observations provide geological evidence, not proof of life. New sites and weighted objectives are not modeled yet.</p>
        </>}
        {isDecision(station)&&<>
          <Speech member={member}>
            <p className="hub-ownership">{direct?selected===member.id?'You own this decision.':'You have taken over this decision.':member.name+' proposes. You decide.'}</p>
            {!direct&&proposal&&<p>{proposal.reason}</p>}
            {direct&&station==='payload'&&<p>Click a rover marker to inspect it. Toggle hardware to preview the change before applying it.</p>}
          </Speech>
          {!direct&&proposal&&<>
            <label className="hub-field">Ask to revise<select aria-label="Proposal priority" value={priority} onChange={e=>setPriority(e.target.value as ProposalPriority)}><option value="safety">More safety margin</option><option value="science">More science</option><option value="mass">Less mass</option></select></label>
            {proposal.config&&<><PlanSummary config={proposal.config}/><PlanDelta before={config} after={proposal.config}/></>}
            <div className="hub-button-row"><button className="ax-btn ax-btn--primary" onClick={accept} disabled={!proposal.config}>Accept proposal</button><button className="ax-btn" onClick={()=>record(station,'takeover',config)}>Take over</button></div>
          </>}
          {direct&&<>
            {station==='payload'&&<div className="hub-instruments">{INSTRUMENTS.map((i,index)=><div key={i.id} className={draft.instruments.includes(i.id)?'is-installed':''}>
              <span className="console-index" aria-hidden="true">{index+1}</span>
              <button className={instrument===i.id?'active':''} onClick={()=>setInstrument(i.id)} aria-label={'Inspect '+i.name}>{i.name}</button>
              <span className="console-meta">{i.massKg} kg · {i.powerW} W</span>
              <label><input type="checkbox" checked={draft.instruments.includes(i.id)} onChange={()=>toggle(i.id)}/><span>{draft.instruments.includes(i.id)?'Installed':'Add'} {i.name}</span></label>
            </div>)}</div>}
            {station==='power'&&<>
              <label className="hub-field">Battery reserve<select aria-label="Battery reserve" value={draft.reserve} onChange={e=>setDraft({...draft,reserve:Number(e.target.value) as RoverConfig['reserve']})}><option value={.2}>20%</option><option value={.3}>30%</option><option value={.4}>40%</option></select></label>
              <label className="hub-field">Science cadence<select aria-label="Science cadence" value={draft.scienceCadence} onChange={e=>setDraft({...draft,scienceCadence:Number(e.target.value) as RoverConfig['scienceCadence']})}><option value={1}>Standard</option><option value={4}>Extended · 4× activity</option></select></label>
              <label className="hub-check"><input type="checkbox" disabled={!draft.instruments.includes('moxie')} checked={draft.moxieRun} onChange={e=>setDraft({...draft,moxieRun:e.target.checked})}/> Schedule MOXIE · 300 Wh{!draft.instruments.includes('moxie')?' (install MOXIE first)':''}</label>
            </>}
            {station==='communications'&&<label className="hub-field">Downlink strategy<select aria-label="Downlink strategy" value={draft.downlink} onChange={e=>setDraft({...draft,downlink:e.target.value as RoverConfig['downlink']})}><option value="UHF">UHF relay · assumed 8-minute pass</option><option value="X-band">Direct X-band · optimistic continuous link</option></select></label>}
            <PlanDelta before={config} after={draft}/>
            {draftResult.issues.map(issue=><p className="hub-error" role="alert" key={issue}>{issue}</p>)}
            {draftResult.warnings.map(warning=><p className="hub-warning" key={warning}>{warning}</p>)}
            <div className="hub-button-row"><button className="ax-btn ax-btn--primary" onClick={apply} disabled={!!draftResult.issues.length}>{changed?'Apply changes':'Confirm current plan'}</button>{changed&&<button className="ax-btn" onClick={()=>setDraft(config)}>Discard preview</button>}</div>
          </>}
          {station==='payload'&&inspected&&<article className="hub-target console-inspect"><div><b>{inspected.name}</b><p>{inspected.detail}</p><small>{instrument==='moxie'?'INTERNAL INSTRUMENT · inspection marker only':instrument==='meda'?'SHARED MAST ASSEMBLY · inspection marker only':'EXTERIOR HARDWARE · selected component highlighted'}</small></div><em className="ax-chip">{inspected.mount.toUpperCase()} MOUNT</em></article>}
        </>}
        {station==='review'&&<>
          <Speech member={getCrew('kavi')}><p>Review the mission as a team. Changes at another station can invalidate earlier decisions; the numbers below always reflect the current plan.</p></Speech>
          <p className={'console-verdict '+(result.issues.length?'hub-error':'hub-good')}>{result.issues.length?'BLOCKED · fix the engineering checks':'READY · modeled hard checks pass'}</p>
          <ul className="console-ledger" aria-label="Station decisions">{(['payload','power','communications'] as const).map(id=><li key={id}><span>{STATION_LABELS[id]}</span><small>{getCrew(STATION_OWNERS[id]).name}</small><em className={'ax-chip '+(decisionStatus(id)==='PLAN CHANGED'?'ax-chip--amber':decisionStatus(id)?'ax-chip--cyan':'')}>{decisionStatus(id)||'NOT REVIEWED'}</em></li>)}</ul>
          <PlanSummary config={config}/>
          <PlanDelta before={config} after={config}/>
          {result.issues.map(issue=><p role="alert" className="hub-error" key={issue}>{issue}</p>)}
          {result.warnings.map(warning=><p className="hub-warning" key={warning}>{warning}</p>)}
          <p className="hub-note">Warnings describe operational limitations. Launching retains those consequences; the crew cannot waive hard checks.</p>
          <div className="hub-button-row"><button className="ax-btn" onClick={()=>go('workshop',null)}>Return to workshop</button></div>
        </>}
        <p className="hub-note">DOC / CALC / ASSUMED · resource totals use the existing educational engineering model. Costs and alternate relay orbits are not modeled here.</p>
        <details className="hub-basis"><summary>Engineering basis & sources</summary><p>Mass allowance: 1,025 kg (scenario assumption). MMRTG: 110 W at beginning of mission. Peak electrical limit: 900 W. Energy uses power × duration, a 75 W assumed baseline, and the selected activity schedule.</p><p>Usable battery assumes two 43 Ah packs, 28 V, the selected reserve and √0.90 efficiency. UHF assumes one eight-minute 2 Mbps pass; X-band assumes continuous 500 bps. Actual contact time and science data volume vary.</p>{SOURCES.map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}</details>
        {changed&&direct&&<p className="hub-warning">Unapplied preview · closing or changing station discards these edits.</p>}
        {message&&<p className="console-message" role="status">{message}</p>}
        </div>
        <button className="room-leave" onClick={close}>Return to room <kbd className="ax-key">Esc</kbd></button>
      </section>}
    </>}

    <footer className="prep-foot">
      <button className="ax-btn ax-btn--ghost prep-home" onClick={onHome}><ArrowLeft size={16} aria-hidden="true"/> Home</button>
      {!entry&&<nav className="hub-stations" aria-label="Mission stations">{STATIONS.map((id,index)=>{
        const locked=prep.stage==='briefing'&&id!=='briefing', status=decisionStatus(id);
        return <div key={id} className={(station===id?'is-open ':'')+(status==='PLAN CHANGED'?'is-stale':status?'is-reviewed':'')}>
          <button className="dock-open" aria-pressed={station===id} disabled={locked} onClick={()=>open(id)}><span className="console-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><CrewPortrait member={getCrew(STATION_OWNERS[id])} decorative/><b>{STATION_LABELS[id]}</b><small>{selected===STATION_OWNERS[id]?'YOUR STATION':getCrew(STATION_OWNERS[id]).name}{status?' · '+status:''}</small></button>
          <button className="dock-walk" aria-label={'Walk to '+STATION_LABELS[id]} title={'Walk to '+STATION_LABELS[id]} disabled={locked} onClick={()=>walk(id)}><Footprints size={14} aria-hidden="true"/></button>
        </div>;
      })}</nav>}
      <button className="ax-btn ax-btn--primary prep-primary" disabled={prep.stage==='review'&&!!result.issues.length} onClick={primary}>{prep.stage==='entry'?'Enter mission control':prep.stage==='briefing'?'Begin workshop':prep.stage==='workshop'?'Review mission':'Approve & launch'}<ArrowRight size={16} aria-hidden="true"/></button>
    </footer>
  </main>;
}

/** A crew member speaking: portrait, name, then what they say. */
function Speech({member,second,children}:{member:CrewMember;second?:CrewMember;children:React.ReactNode}){
  return <div className="console-speech">
    <div className="console-speakers"><CrewPortrait member={member} decorative/>{second&&<CrewPortrait member={second} decorative/>}</div>
    <div><span className="console-speaker">{member.name}{second?' & '+second.name:''} <small>// {second?'Field science':member.role}</small></span>{children}</div>
  </div>;
}
function PlanSummary({config}:{config:RoverConfig}){
  return <div className="hub-plan"><b>{config.instruments.length} instruments</b><p>{config.instruments.map(id=>INSTRUMENTS.find(i=>i.id===id)?.name).join(', ')||'No instruments'}</p><small>{config.reserve*100}% reserve · {config.scienceCadence===1?'Standard':'Extended'} science · {config.downlink} · MOXIE {config.moxieRun?'scheduled':'off'}</small></div>;
}
function PlanDelta({before,after}:{before:RoverConfig;after:RoverConfig}){
  const a=calculateEngineering(before),b=calculateEngineering(after);
  const values:[string,number,number,string][]=[['Mass',a.massKg,b.massKg,'kg'],['Energy margin',a.netWh,b.netWh,'Wh/sol'],['Usable battery',a.eDeliveredWh,b.eDeliveredWh,'Wh'],['Science data',a.dataMbit,b.dataMbit,'Mbit/sol'],['Link capacity',a.linkMbit,b.linkMbit,'Mbit/sol'],['Supported targets',supportedTargets(before).length,supportedTargets(after).length,'/ 3']];
  return <dl className="hub-deltas">{values.map(([name,from,to,unit])=><div key={name} className={Math.abs(to-from)>.00001?'is-changed':''}><dt>{name}</dt><dd>{to.toFixed(name==='Supported targets'?0:1)} <small>{unit}</small>{Math.abs(to-from)>.00001&&<span>{to>from?'+':''}{(to-from).toFixed(1)} change</span>}</dd></div>)}</dl>;
}

/** Always-visible mission margins, read straight from the engineering model. */
function Vitals({result,preview,config}:{result:Results;preview:RoverConfig|null;config:RoverConfig}){
  const next=useMemo(()=>preview?calculateEngineering(preview):null,[preview]);
  const targets=supportedTargets(config).length, nextTargets=preview?supportedTargets(preview).length:null;
  const fmt=(value:number,digits=0)=>value.toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits});
  const rows:{label:string;value:string;unit:string;ratio:number;note:string;next?:string|null}[]=[
    {label:'Mass',value:fmt(result.massKg,1),unit:`/ ${fmt(FIXED.allowanceKg)} kg`,ratio:result.massKg/FIXED.allowanceKg,note:`${fmt(result.massMarginKg,1)} kg margin`,next:next&&Math.abs(next.massKg-result.massKg)>.001?fmt(next.massKg,1):null},
    {label:'Peak power',value:fmt(result.peakW,1),unit:`/ ${FIXED.peakW} W`,ratio:result.peakW/FIXED.peakW,note:`${fmt(FIXED.peakW-result.peakW,1)} W headroom`,next:next&&Math.abs(next.peakW-result.peakW)>.001?fmt(next.peakW,1):null},
    {label:'Energy per sol',value:(result.netWh>=0?'+':'')+fmt(result.netWh),unit:'Wh margin',ratio:(result.baseWh+result.activityWh)/Math.max(1,result.genWh),note:`${fmt(result.baseWh+result.activityWh)} of ${fmt(result.genWh)} Wh used`,next:next&&Math.abs(next.netWh-result.netWh)>.5?(next.netWh>=0?'+':'')+fmt(next.netWh):null},
    {label:'Usable battery',value:fmt(result.eDeliveredWh),unit:'Wh',ratio:1-result.eDeliveredWh/Math.max(1,result.eNominalWh),note:`${fmt(config.reserve*100)}% held in reserve`,next:next&&Math.abs(next.eDeliveredWh-result.eDeliveredWh)>.5?fmt(next.eDeliveredWh):null},
    {label:'Downlink',value:fmt(result.dataMbit,1),unit:`/ ${fmt(result.linkMbit,1)} Mbit`,ratio:result.dataMbit/Math.max(1,result.linkMbit),note:`${config.downlink} · per sol`,next:next&&(Math.abs(next.dataMbit-result.dataMbit)>.05||Math.abs(next.linkMbit-result.linkMbit)>.05)?`${fmt(next.dataMbit,1)} / ${fmt(next.linkMbit,1)}`:null},
    {label:'Science targets',value:String(targets),unit:`/ ${SCIENCE_TARGETS.length} supported`,ratio:targets/SCIENCE_TARGETS.length,note:`${config.instruments.length} of ${INSTRUMENTS.length} instruments`,next:nextTargets!==null&&nextTargets!==targets?String(nextTargets):null},
  ];
  return <aside className="prep-vitals" aria-label="Mission margins">
    <p className="ax-label">MISSION MARGINS <span className="ax-slash">//</span> {preview?<span className="vitals-mode is-preview">PREVIEW</span>:<span className="vitals-mode">CURRENT PLAN</span>}</p>
    <dl>{rows.map((row,index)=>{
      // The last two gauges fill as capability grows; the others fill as a limit is consumed.
      const consumed=index<5&&index!==3, state=consumed?(row.ratio>1?'is-over':row.ratio>.9?'is-tight':''):'';
      return <div key={row.label} className={state}>
        <dt>{row.label}</dt>
        <dd><b>{row.value}</b> <small>{row.unit}</small>{row.next&&<em>→ {row.next}</em>}</dd>
        <div className="ax-gauge" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,row.ratio*100))}%`}}/></div>
        <small className="vitals-note">{row.note}</small>
      </div>;
    })}</dl>
    <p className={'vitals-status '+(result.issues.length?'is-blocked':result.warnings.length?'is-advisory':'is-clear')}>{result.issues.length?`${result.issues.length} hard check${result.issues.length===1?'':'s'} failing`:result.warnings.length?`${result.warnings.length} advisor${result.warnings.length===1?'y':'ies'} · review before launch`:'All modeled checks pass'}</p>
  </aside>;
}
