import { useEffect, useRef } from 'react';
import { Camera, Check, Crosshair, ScanLine } from 'lucide-react';
import { scienceSteps, targetReadiness, type Campaign, type ScienceMethod } from '../engine/campaign';
import { getFormationStory, getInstrumentExperience, getObservationInsight } from '../data/fieldExperience';
import { scenarioTargets, type ScenarioTarget } from '../data/scenarios';
import { INSTRUMENTS, type InstrumentId } from '../nasa/data';
import { useGameStore } from '../store/gameStore';
import { useMarsStore } from '../store/marsStore';
import './field-science.css';

function compositionMethod(c: Campaign, target: ScenarioTarget, tool: InstrumentId | null): ScienceMethod | undefined {
  if (target.objective === 'B') return undefined;
  const mars = useMarsStore.getState();
  const activeMethod = mars.activeScienceStage?.targetId === target.id
    && mars.scienceRequest?.targetId === target.id && mars.scienceRequest.sol === c.sol
    ? mars.scienceRequest.method : undefined;
  return c.targetMethods?.[target.id]
    ?? activeMethod
    ?? (tool === 'pixl' || tool === 'supercam' || tool === 'rimfax' ? tool : undefined)
    ?? (c.config.instruments.includes('pixl') ? 'pixl' : c.config.instruments.includes('supercam') ? 'supercam' : 'rimfax');
}

function contextTarget(c: Campaign, includeRemote: boolean): ScenarioTarget | undefined {
  const game = useGameStore.getState(), mars = useMarsStore.getState();
  const targets = scenarioTargets(c.options.site).filter(target => target.availableSol <= c.sol);
  const inRange = (target: ScenarioTarget) => Math.hypot(target.x - game.missionProgress.x, target.z - game.missionProgress.z) <= 8;
  const pending = (target: ScenarioTarget) => !c.completed.includes(`science:${target.id}`) && !c.completed.includes(`declined:${target.id}`);
  const active = targets.find(target => target.id === mars.activeScienceStage?.targetId);
  const focused = targets.find(target => target.id === mars.focusedTargetId);
  const nearby = targets.find(target => target.id === mars.nearbyTargetId);
  return active
    ?? (focused && pending(focused) && inRange(focused) ? focused : undefined)
    ?? (nearby && pending(nearby) && inRange(nearby) ? nearby : undefined)
    ?? (includeRemote ? focused ?? nearby : undefined);
}

/** Context shortcut only. The live world validates and executes completed readings. */
export function requestContextScience(): void {
  const c = useGameStore.getState().campaign, mars = useMarsStore.getState();
  if (!c || mars.phase !== 'active' || c.mode !== 'operations' || c.safe) return;
  if (mars.activeScienceStage) { mars.confirmSciencePoint(); return; }
  const target = contextTarget(c, false);
  if (!target) return;
  const method = compositionMethod(c, target, mars.scienceTool);
  const steps = scienceSteps(c, target.id, method);
  const selected = steps.find(step => step.instrument === mars.scienceTool && !step.completed && step.available);
  const next = selected ?? steps.find(step => !step.completed && step.available);
  if (next) mars.requestScienceStep(target.id, next.instrument, method);
}

type FieldScienceProps = { onDiscovery?: (instrument: InstrumentId) => void };

export default function FieldScience({ onDiscovery }: FieldScienceProps) {
  const c = useGameStore(state => state.campaign);
  const focusedId = useMarsStore(state => state.focusedTargetId);
  const nearbyId = useMarsStore(state => state.nearbyTargetId);
  const tool = useMarsStore(state => state.scienceTool);
  const stage = useMarsStore(state => state.activeScienceStage);
  const phase = useMarsStore(state => state.phase);
  const speed = useMarsStore(state => state.speed);
  const scanMessage = useMarsStore(state => state.scanMessage);
  // Anchor updates refresh range without subscribing the panel to every drive frame.
  const anchors = useMarsStore(state => state.worldAnchors);
  const knownProducts = useRef<Set<string> | null>(null);
  useEffect(() => {
    const products = c?.products ?? [];
    const previous = knownProducts.current;
    knownProducts.current = new Set(products.map(product => product.id));
    if (!previous || !onDiscovery) return;
    for (const product of products) {
      if (previous.has(product.id)) continue;
      const instrument = INSTRUMENTS.find(item => product.id.endsWith(`:${item.id}`));
      if (instrument) onDiscovery(instrument.id);
    }
  }, [c?.products, onDiscovery]);

  if (!c || (!focusedId && !nearbyId && !stage)) return null;
  const target = contextTarget(c, true);
  if (!target) return null;
  const method = compositionMethod(c, target, tool);
  const steps = scienceSteps(c, target.id, method);
  const selected = steps.find(step => step.instrument === (stage?.instrument ?? tool) && !step.completed && step.available);
  const next = selected ?? steps.find(step => !step.completed && step.available) ?? steps.find(step => !step.completed);
  const instrument = stage?.instrument ?? next?.instrument ?? steps.at(-1)?.instrument ?? 'mastcam-z';
  const experience = getInstrumentExperience(instrument);
  const formation = getFormationStory(c.options.site, target.unit);
  const insight = getObservationInsight(c.options.site, target.objective, instrument, target.unit);
  const position = useGameStore.getState().missionProgress;
  const distance = anchors.find(anchor => anchor.id === target.id)?.distance ?? Math.hypot(position.x - target.x, position.z - target.z);
  const inRange = Math.hypot(position.x - target.x, position.z - target.z) <= 8;
  const complete = c.completed.includes(`science:${target.id}`);
  const declined = c.completed.includes(`declined:${target.id}`);
  const peers = scenarioTargets(c.options.site).filter(item => item.availableSol <= c.sol && item.x === target.x && item.z === target.z && !c.completed.includes(`science:${item.id}`) && !c.completed.includes(`declined:${item.id}`));
  const active = phase === 'active' && c.mode === 'operations' && !c.safe;
  const steady = Math.abs(speed) <= .08;
  const startAllowed = active && inRange && steady && !!next?.available && !complete;
  const disabledReason = !active ? c.safe ? 'Safe mode: optional science is suspended.' : phase === 'paused' ? 'Resume the mission before observing.' : 'Commit a science-enabled sol plan to use the instruments.'
    : !inRange ? `Approach within 8 m · currently ${distance.toFixed(1)} m away.`
      : !steady ? 'Brake to hold the rover steady.'
        : next && !next.available ? next.reason : '';
  const recorded = steps.filter(step => step.completed).length;
  const focusTarget = (id: string) => {
    if (stage) return;
    useMarsStore.getState().setFocusedTarget(id);
    useMarsStore.getState().setScienceTool(null);
  };
  const begin = () => {
    if (!startAllowed || !next) return;
    useMarsStore.getState().requestScienceStep(target.id, next.instrument, method);
  };

  return <aside className={`field-science${stage ? ' is-observing' : ''}${complete ? ' is-recorded' : ''}`} aria-label="Field science" data-coach="scan" data-target-id={target.id}>
    <header className="field-science-header">
      <div><small>FIELD INVESTIGATION · {target.objective === 'G' ? 'GEOLOGY' : 'POTENTIAL BIOSIGNATURE CONTEXT'}</small><h2>{formation.name}</h2></div>
    </header>
    {peers.length > 1 && <div className="field-science-objectives" role="group" aria-label="Investigate this formation">
      {peers.map(peer => <button type="button" key={peer.id} aria-pressed={peer.id === target.id} disabled={!!stage} onClick={() => focusTarget(peer.id)}>{peer.objective === 'G' ? 'G · Geology' : 'B · Organic context'}</button>)}
    </div>}
    {!stage && <p className="field-science-question">{formation.question}</p>}
    {target.objective === 'G' && !complete && !declined && <div className="field-science-method" role="group" aria-label="Geology composition method">
      {(['pixl', 'supercam', 'rimfax'] as const).map(choice => <button type="button" key={choice} aria-pressed={method === choice} disabled={!!stage || !c.config.instruments.includes(choice) || !!c.targetMethods?.[target.id] && c.targetMethods[target.id] !== choice} title={!c.config.instruments.includes(choice) ? 'Instrument not installed' : c.targetMethods?.[target.id] ? 'The first recorded product commits this method' : `Use ${INSTRUMENTS.find(item => item.id === choice)!.name}`} onClick={() => useMarsStore.getState().setScienceTool(choice)}>{choice === 'pixl' ? 'PIXL' : choice === 'supercam' ? 'SuperCam' : 'RIMFAX'}</button>)}
    </div>}
    {!stage && !complete && !declined && <ol className="field-science-steps" aria-label="Instrument evidence bundle">
      {steps.map(step => <li key={step.instrument} className={step.completed ? 'is-done' : next?.instrument === step.instrument ? 'is-next' : ''}>
        <span className="field-science-step-icon" aria-hidden="true">{step.completed ? <Check size={12} /> : <span />}</span>
        <div><b>{step.label}</b><small>{step.instrument === 'rimfax' ? 'Review acquired 100 m profile · no added time or power' : `${step.hours.toFixed(1)} h modeled · ${step.powerW.toFixed(1)} W`}<em>{(step.bits / 1e6).toFixed(1)} Mbit {step.completed ? 'recorded' : 'product'}</em></small></div>
      </li>)}
    </ol>}

    {declined ? <div className="field-science-complete" role="status"><div><b>D12 · Opportunity forfeited</b><p>The crew moved on permanently. Biosignature completion is capped at 3/4 (75%); this rock cannot be observed again.</p></div></div> : stage ? <>
      <div className={`field-science-visual is-${experience.interaction}`} aria-label={`${stage.label}, illustrative pattern`}>
        <svg viewBox="0 0 280 76" role="img" aria-label="Authored rock pattern, not a NASA measurement">
          <path className="field-rock-fill" d="M0 67 18 48 36 52 65 24 95 37 120 13 151 29 177 20 208 34 236 17 280 39V76H0Z" />
          <path className="field-rock-line" d="m0 64 34-7 28 5 40-11 29 5 46-10 28 7 42-8 33 6M0 72l52-4 35 4 49-9 43 3 40-6 61 8M20 47l37 2 43-5 35 3 48-9 48 5 49-9" />
          {Array.from({ length: stage.required }, (_, index) => <g key={index} className={index < stage.points ? 'is-confirmed' : index === stage.points ? 'is-current' : ''}>
            <circle className="field-reading-ring" cx={stage.required === 1 ? 140 : 45 + index * 190 / (stage.required - 1)} cy={38 + (index % 2) * 12} r="12" />
            <circle className="field-reading-dot" cx={stage.required === 1 ? 140 : 45 + index * 190 / (stage.required - 1)} cy={38 + (index % 2) * 12} r="3" />
          </g>)}
        </svg>
        <small>ILLUSTRATIVE PATTERN · NOT FLIGHT DATA</small>
      </div>
      <div className="field-science-reading"><b>{stage.label}</b><span>{stage.points} / {stage.required}</span><progress aria-label="Confirmed reading points" value={stage.points} max={stage.required} /></div>
      <p className="field-science-tip">{stage.tip}</p>
      <div className="field-science-actions">
        <button type="button" className="field-science-primary" disabled={!active || !steady || !inRange} onClick={() => useMarsStore.getState().confirmSciencePoint()}><Crosshair size={15} aria-hidden="true" />Confirm reading <kbd>E</kbd></button>
        <button type="button" className="field-science-cancel" onClick={() => useMarsStore.getState().cancelScienceInteraction()}>Cancel observation</button>
      </div>
      <small className="field-science-compression">Visual confirmations compress the presentation. The complete reading executes its modeled hours once.</small>
    </> : complete ? <div className="field-science-complete" role="status"><Check size={18} aria-hidden="true" /><div><b>Evidence bundle acquired</b><p>Keep the context together and return every product for objective credit.</p></div></div> : <>
      <div className="field-science-next"><span>{recorded ? 'CONTINUE THE BUNDLE' : 'NEXT OBSERVATION'}</span><b>{experience.verb}</b></div>
      <p className="field-science-instructions">{experience.instructions}</p>
      {instrument === 'rimfax' && <p className="field-science-profile">Fresh profile {c.profileMeters.toFixed(1)} / 100 m · alternatives {c.radarUnits} / 2 used</p>}
      {disabledReason && <p className="field-science-reason" role="status">{disabledReason}</p>}
      <button type="button" className="field-science-primary" disabled={!startAllowed} onClick={begin}><ScanLine size={15} aria-hidden="true" />Begin {next?.label ?? 'observation'} <kbd>E</kbd></button>
      <div className="field-science-camera"><button type="button" onClick={() => useMarsStore.getState().setCameraMode('mast')}><Camera size={12} aria-hidden="true" />Mast view</button><button type="button" onClick={() => useMarsStore.getState().setCameraMode('survey')}>Survey view</button></div>
      <details className="field-science-details"><summary>Science context and quick observation</summary><p>{insight.explanation}</p><p>Instrument purposes and rated power: NASA data. Bundle durations, product quantities and authored field patterns: existing educational gameplay rules. Full returned bundles determine the score.</p><p>Visual interactions are compressed; modeled instrument hours remain unchanged.</p><button type="button" aria-label="START SCAN" disabled={!active || !inRange || !steady || !targetReadiness(c, target.id).allowed} onClick={() => useMarsStore.getState().requestScan()}>START SCAN · quick full observation</button></details>
    </>}
    {stage && disabledReason && <p className="field-science-reason" role="status">{disabledReason}</p>}
    {scanMessage && !stage && !complete && <small className="field-science-message" role="status">{scanMessage}</small>}
  </aside>;
}
