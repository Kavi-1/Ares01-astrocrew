import PreparationHub from '../ui/crew/PreparationHub';
import { CrewMessage } from '../ui/crew/CrewAdvice';
import { eventAdviser, getCrew } from '../data/crew';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Pause, Play, ScanLine, Radio, Flag, OctagonX, ShieldCheck, Wrench } from 'lucide-react';
import MissionProgress from '../ui/components/MissionProgress';
import { useEffect, useRef, useState } from 'react';
import MarsWorld from './MarsWorld';
import { useMarsStore } from '../store/marsStore';
import { SCIENCE_TARGETS } from '../data/scienceTargets';
import { useGameStore } from '../store/gameStore';
import LaunchCenter from './LaunchCenter';
import { INSTRUMENTS } from '../nasa/data';
import MissionReport from './MissionReport';
import WelcomeScreen from './WelcomeScreen';
import './surface.css';

export default function MarsGame() {
  const [crewOpen, setCrewOpen] = useState(()=>useGameStore.getState().preparation.stage!=='entry');
  const selectedCrewId = useGameStore(state => state.selectedCrewId);
  const keys = useRef(new Set<string>());
  const [abortOpen, setAbortOpen] = useState(false);
  const resumeAfterDialog = useRef(false);
  const changeAbortOpen = (open: boolean) => {
    keys.current.clear();
    if (open) {
      resumeAfterDialog.current = useMarsStore.getState().phase === 'active';
      if (resumeAfterDialog.current) useMarsStore.getState().togglePause();
    } else if (useGameStore.getState().missionPhase === 'mars' && resumeAfterDialog.current && useMarsStore.getState().phase === 'paused') {
      useMarsStore.getState().togglePause();
    }
    setAbortOpen(open);
  };
  const [phaseFade,setPhaseFade]=useState<'none'|'cover'|'reveal'>('none');
  const transitionTimer = useRef<number | undefined>(undefined);
  const crossfade = (change: () => void) => {
    window.clearTimeout(transitionTimer.current);
    const fromPhase = useGameStore.getState().missionPhase;
    setPhaseFade('cover');
    transitionTimer.current = window.setTimeout(() => {
      if (useGameStore.getState().missionPhase !== fromPhase) {
        setPhaseFade('none');
        return;
      }
      change();
      setPhaseFade('reveal');
      transitionTimer.current = window.setTimeout(() => setPhaseFade('none'), 440);
    }, 440);
  };
  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);
  const missionPhase=useGameStore(s=>s.missionPhase);const setMissionPhase=useGameStore(s=>s.setMissionPhase);const confirmedMission=useGameStore(s=>s.confirmedMission);const missionRecord=useGameStore(s=>s.missionRecord);const startSurfaceMission=useGameStore(s=>s.startSurfaceMission);const setSafeMode=useGameStore(s=>s.setSafeMode);const recoverMissionEvent=useGameStore(s=>s.recoverMissionEvent);const uplinkResults=useGameStore(s=>s.uplinkResults);const endMission=useGameStore(s=>s.endMission);
  useEffect(() => {
    if (missionPhase !== 'mars') {
      keys.current.clear();
      setAbortOpen(false);
      resumeAfterDialog.current = false;
    }
    if (missionPhase === 'briefing' && useGameStore.getState().preparation.stage === 'entry') setCrewOpen(false);
    if (missionPhase === 'report' || missionPhase === 'briefing') {
      window.clearTimeout(transitionTimer.current);
      setPhaseFade('none');
    }
  }, [missionPhase]);
  const phase = useMarsStore((s) => s.phase);
  const begin = useMarsStore((s) => s.begin);
  const resetMission = useMarsStore((s) => s.resetMission);
  const togglePause = useMarsStore((s) => s.togglePause);
  const battery = useMarsStore((s) => s.battery);
  const sol = useMarsStore((s) => s.sol);
  const speed = useMarsStore((s) => s.speed);
  const distance = useMarsStore((s) => s.distance);
  const scannedTargets = useMarsStore((s) => s.scannedTargets);
  const nearbyTargetId = useMarsStore((s) => s.nearbyTargetId);
  const scanningTargetId = useMarsStore((s) => s.scanningTargetId);
  const scanProgress = useMarsStore((s) => s.scanProgress);
  const scanMessage = useMarsStore((s) => s.scanMessage);
  const lastDiscovery = useMarsStore((s) => s.lastDiscovery);
  const requestScan = useMarsStore((s) => s.requestScan);
  const science = useMarsStore((s) => s.science);
  const warning = useMarsStore((s) => s.warning);
  useEffect(()=>{if(missionPhase==='mars'&&phase==='active'&&battery<=0)endMission('complete',0)},[missionPhase,phase,battery,endMission]);
  const target = SCIENCE_TARGETS.find((item) => item.id === (nearbyTargetId ?? scanningTargetId))
    ?? SCIENCE_TARGETS.find((item) => !scannedTargets.includes(item.id));
  const nearbyTarget = SCIENCE_TARGETS.find((item) => item.id === nearbyTargetId);
  const allTargetsAnalyzed = scannedTargets.length === SCIENCE_TARGETS.length;
  const configured=confirmedMission?.config;
  const targetInstrument=nearbyTarget?nearbyTarget.requiredInstruments.map(id=>INSTRUMENTS.find(i=>i.id===id)!).find(i=>configured?configured.instruments.includes(i.id):true):undefined;
  const targetAlternates=nearbyTarget?.requiredInstruments.map(id=>INSTRUMENTS.find(i=>i.id===id)?.name).filter(Boolean).join(' / ');
  const canUseTarget=!!nearbyTarget&&(!configured||nearbyTarget.requiredInstruments.some(id=>configured.instruments.includes(id)));
  const missingSciencePayload=!!configured&&!configured.instruments.some(id=>['supercam','pixl','sherloc'].includes(id));

  const isWelcome = missionPhase === 'briefing' && phase === 'briefing';

  // A confirmed campaign may already be in Mars Operations after a browser
  // refresh; resume the active world instead of presenting the first briefing again.
  useEffect(()=>{if(missionPhase==='mars'&&confirmedMission&&!missionRecord)startSurfaceMission();if(missionPhase==='mars'&&phase==='briefing'&&confirmedMission)begin()},[missionPhase,phase,confirmedMission,missionRecord,startSurfaceMission,begin]);

  useEffect(() => {
    keys.current.clear();
    if (missionPhase !== 'mars' || abortOpen) return;
    const down = (e: KeyboardEvent) => {
      // HUD buttons retain focus after clicks; movement shortcuts must still work.
      // Preserve text editing, form controls, and modal keyboard interaction.
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, [contenteditable="true"], [role="dialog"], [role="alertdialog"]')) return;
      const key = e.key.toLowerCase();
      if (phase === 'active' && [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
      if (key === 'escape' && !e.repeat) togglePause();
      if (key === 'e' && !e.repeat && phase === 'active') requestScan();
      if (phase === 'active') keys.current.add(key);
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); };
    const blur = () => { keys.current.clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [togglePause, requestScan, phase, missionPhase, abortOpen]);

  if ((missionPhase === 'briefing' && crewOpen) || missionPhase === 'engineering')
    return <PreparationHub onHome={()=>{setCrewOpen(false);setMissionPhase('briefing');}} />;

  if(missionPhase==='launch')return <><div className={`phase-curtain ${phaseFade}`}/><LaunchCenter onBack={()=>crossfade(()=>{useGameStore.getState().setPreparation({stage:'workshop',activeStation:null});setMissionPhase('engineering');})} onArrive={()=>crossfade(()=>{resetMission();startSurfaceMission();begin()})}/></>;
  if(missionPhase==='report')return <MissionReport/>;

  const scanEnergy = targetInstrument ? `${(targetInstrument.powerW*targetInstrument.hours).toFixed(1)} Wh` : null;
  const reservePercent = configured ? configured.reserve*100 : null;
  const batteryState = battery < 18 ? 'is-over' : reservePercent !== null && battery <= reservePercent ? 'is-tight' : '';
  const activeEvents = missionRecord?.events.filter(e=>e.status==='active'||e.status==='limitation') ?? [];
  const overlay = !isWelcome && !abortOpen && (phase === 'briefing' || phase === 'paused' || phase === 'complete');
  const crew = getCrew(selectedCrewId);

  return <><div className={`phase-curtain ${phaseFade}`}/><main className={`game-shell${isWelcome ? ' is-welcome' : ''}`} data-surface-phase={phase}>
    <MarsWorld keys={keys} config={confirmedMission?.config} />
    <div className="vignette" />
    {!isWelcome && <header className="surface-top">
      <div className="surface-brand"><span className="surface-emblem" aria-hidden="true">A</span><div><b>ARES<em>—01</em></b><small>FIELD OPERATIONS // SOL {String(sol).padStart(2, '0')}</small></div></div>
      <MissionProgress phase={missionPhase} />
      <button className="ax-btn ax-btn--icon surface-pause" aria-label="Pause" onClick={togglePause}>{phase === 'paused' ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}</button>
    </header>}
    {(phase === 'active' || abortOpen) && <>
      <section className="objective" aria-label="Current objective">
        <small>FIELD SCIENCE // {scannedTargets.length}/{SCIENCE_TARGETS.length} DISCOVERIES</small>
        <strong>{allTargetsAnalyzed ? 'GEOLOGY SURVEY COMPLETE' : target ? `ANALYZE · ${target.name.toUpperCase()}` : 'SEARCH THE CRATER'}</strong>
        <span>{allTargetsAnalyzed ? 'All marked sites analyzed. Continue exploring the crater.' : nearbyTarget ? canUseTarget?`${nearbyTarget.description} · ${scanEnergy ?? 'configured instrument'} per scan`:`Payload incomplete · requires ${targetAlternates}` : 'Follow a cyan beacon to a marked geological formation.'}</span>
        <ol className="objective-track" aria-label="Science targets">{SCIENCE_TARGETS.map(item=>{
          const returned=missionRecord?.transmittedTargets.includes(item.id), scanned=scannedTargets.includes(item.id);
          return <li key={item.id} className={returned?'is-returned':scanned?'is-scanned':item.id===target?.id&&!allTargetsAnalyzed?'is-next':''}><i aria-hidden="true"/><span>{item.name}</span><em>{returned?'RETURNED':scanned?'ONBOARD':item.id===target?.id&&!allTargetsAnalyzed?'NEXT':'—'}</em></li>;
        })}</ol>
        {missingSciencePayload&&<button className="payload-repair ax-btn ax-btn--small" onClick={()=>crossfade(()=>setMissionPhase('engineering'))}><Wrench size={14} aria-hidden="true"/>CONFIGURE A GEOLOGY INSTRUMENT</button>}
      </section>
      <div className="hud-bottom">
        <div className="telemetry">
          <div><small>ROVER SPEED</small><b>{speed.toFixed(1)} <i>m/s</i></b></div>
          <div><small>TRAVERSED</small><b>{distance.toFixed(0)} <i>m</i></b></div>
          <div className={`battery ${batteryState}`}><small>POWER RESERVE</small><b>{battery.toFixed(1)}<i>%</i></b>
            <div className="battery-track ax-gauge"><i style={{ width: `${battery}%` }} />{reservePercent!==null&&<span className="battery-reserve" style={{left:`${reservePercent}%`}} title={`Chosen reserve policy · ${reservePercent.toFixed(0)}%`} />}</div>
            {reservePercent!==null&&<em>RESERVE POLICY {reservePercent.toFixed(0)}%</em>}
          </div>
        </div>
        <div className="controls" aria-label="Rover controls"><span><kbd className="ax-key">W</kbd><kbd className="ax-key">A</kbd><kbd className="ax-key">S</kbd><kbd className="ax-key">D</kbd><i>DRIVE</i></span><span><kbd className="ax-key">SHIFT</kbd><i>BOOST</i></span><span><kbd className="ax-key">SPACE</kbd><i>BRAKE</i></span><span className="controls-camera"><kbd className="ax-key">DRAG</kbd><i>ORBIT</i></span><span className="controls-camera"><kbd className="ax-key">SCROLL</kbd><i>ZOOM</i></span></div>
      </div>
      {nearbyTarget && <div className="scan-wrap">
        <div className="scan-context"><small>SCIENCE TARGET // {nearbyTarget.name.toUpperCase()}</small><span>{!canUseTarget?`REQUIRES ${targetAlternates?.toUpperCase()}`:Math.abs(speed) > 0.8 ? 'BRAKE TO SCAN' : scanningTargetId ? scanMessage : `${nearbyTarget.description} · ${targetInstrument?(targetInstrument.powerW*targetInstrument.hours).toFixed(1):'—'} Wh`}</span>{scanningTargetId && <div className="scan-progress-track ax-gauge"><i style={{ width: `${scanProgress * 100}%` }} /></div>}</div>
        <button className="scan-button ax-btn ax-btn--primary" disabled={!canUseTarget} onClick={requestScan}><ScanLine size={18} aria-hidden="true" />{scanningTargetId ? 'CANCEL SCAN' : 'START SCAN'} <small className="ax-key">E</small></button>
      </div>}
      {!nearbyTarget && scanMessage && <div className="world-notice" role="status">{scanMessage}</div>}
      {warning && <div className="world-notice is-warning" role="status">{warning}</div>}
      <div className="mission-events" aria-label="Mission events">{activeEvents.map(event=>{
        const adviser=eventAdviser(event.kind);
        return <aside className={`mission-event is-${event.status}`} key={event.id}>
          <small className="mission-event-kind">MISSION EVENT // {event.kind.toUpperCase()}</small>
          <CrewMessage member={adviser} compact>{event.title}</CrewMessage>
          <b>{event.title}</b><p>{event.explanation}</p>
          <details><summary>Engineering basis</summary><p>{event.model}</p></details>
          {event.recoverable&&event.status==='active'&&<button className="ax-btn ax-btn--small" onClick={()=>event.kind==='power-reserve'?setSafeMode(true):recoverMissionEvent(event.id)}>{event.kind==='power-reserve'?'ENTER SAFE MODE':event.kind==='communication-backlog'?'SWITCH TO UHF RELAY':event.kind==='power-budget'?'REDUCE SCIENCE CADENCE':'ACKNOWLEDGE'}</button>}
        </aside>;
      })}</div>
      <div className="mission-actions">
        {missionRecord?.safeMode&&<button className="ax-btn ax-btn--small" onClick={()=>setSafeMode(false)}><ShieldCheck size={15} aria-hidden="true" />EXIT SAFE MODE</button>}
        {scannedTargets.length>0&&<button className="ax-btn ax-btn--small mission-uplink" onClick={uplinkResults}><Radio size={15} aria-hidden="true" /> Uplink · {scannedTargets.length}</button>}
        <button className="ax-btn ax-btn--small" onClick={()=>endMission('complete',battery)}><Flag size={15} aria-hidden="true" /> End mission</button>
        <AlertDialog.Root open={abortOpen} onOpenChange={changeAbortOpen}>
          <AlertDialog.Trigger asChild><button className="ax-btn ax-btn--small ax-btn--danger abort-trigger"><OctagonX size={15} aria-hidden="true" /> Abort</button></AlertDialog.Trigger>
          <AlertDialog.Portal><AlertDialog.Overlay className="dialog-overlay" /><AlertDialog.Content className="mission-dialog">
            <OctagonX className="dialog-symbol" size={28} aria-hidden="true" />
            <AlertDialog.Title>Abort this mission?</AlertDialog.Title>
            <AlertDialog.Description>This ends surface operations and opens your mission report. Only science already transmitted to Earth earns points.</AlertDialog.Description>
            <div className="dialog-actions"><AlertDialog.Cancel asChild><button className="ax-btn">Keep exploring</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="ax-btn ax-btn--danger danger-button" onClick={()=>endMission('abort',battery)}>Abort mission</button></AlertDialog.Action></div>
          </AlertDialog.Content></AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
      {scannedTargets.length > 0 && <div className="science-stamp" role="status"><small>LATEST OBSERVATION</small>{lastDiscovery || 'SCIENCE DATA SECURED'}<b>{science} RESEARCH POINTS · {scannedTargets.length}/{SCIENCE_TARGETS.length}</b></div>}
    </>}
    {isWelcome && <WelcomeScreen onEnter={() => setCrewOpen(true)} />}
    {overlay && <div className="intro-overlay"><div className="intro-content">
      <p className="eyebrow"><i aria-hidden="true" /> [ MARS // JEZERO CRATER // SOL {String(sol).padStart(2, '0')} ]</p>
      <h1>{phase === 'briefing' ? <>A WORLD<br /><em>UNFOLDS.</em></> : phase === 'paused' ? <>MISSION<br /><em>PAUSED.</em></> : <>SIGNAL<br /><em>LOST.</em></>}</h1>
      <p>{phase === 'briefing' ? 'Plan a Perseverance-class science payload, launch to Mars, then drive the rover across Jezero Crater.' : phase === 'paused' ? 'Take a breath. The red planet can wait.' : 'The rover has exhausted its reserves.'}</p>
      <dl className="brief-meta"><div><dt>ROVER</dt><dd>MARS 2020 · PERSEVERANCE</dd></div><div><dt>MISSION</dt><dd>ECHOES OF JEZERO</dd></div><div><dt>{phase === 'briefing' ? 'CREW' : 'YOUR SEAT'}</dt><dd>{phase === 'briefing' ? 'SIX SEATS · ONE MISSION' : `${crew.name.toUpperCase()} · ${crew.role.toUpperCase()}`}</dd></div></dl>
      <button className="start-button ax-btn ax-btn--primary" onClick={() => phase === 'briefing' ? setCrewOpen(true) : phase === 'paused' ? togglePause() : begin()}>{phase === 'briefing' ? 'ENTER MISSION CONTROL' : phase === 'paused' ? 'RESUME MISSION' : 'RESTART'} <b aria-hidden="true">↗</b></button>
      <p className="intro-foot"><kbd className="ax-key">W</kbd><kbd className="ax-key">A</kbd><kbd className="ax-key">S</kbd><kbd className="ax-key">D</kbd> DRIVE <kbd className="ax-key">SPACE</kbd> BRAKE <kbd className="ax-key">E</kbd> SCAN <kbd className="ax-key">ESC</kbd> PAUSE</p>
    </div></div>}
  </main></>;
}
