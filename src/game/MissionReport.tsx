import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Circle, FileText, Radio, Rocket, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { CrewDebrief } from '../ui/crew/CrewAdvice';
import { INSTRUMENTS, SOURCES, type RoverConfig } from '../nasa/data';
import { SCIENCE_TARGETS } from '../data/scienceTargets';
import { missionReportLessons, scienceRewardForReturnedTargets, type MissionRecord } from '../engine/missionFailure';
import type { ReturnTypeEngineering } from '../engine/missionTypes';
import { useGameStore, type MissionProgress as RecordedProgress } from '../store/gameStore';
import ProjectCredits from './ProjectCredits';
import './mission-report.css';

const outcomeLabel = {
  'full-success': 'FULL SUCCESS',
  'partial-success': 'PARTIAL SUCCESS',
  'recoverable-anomaly': 'RECOVERABLE ANOMALY',
  'mission-failure': 'MISSION FAILURE',
  'mission-abort': 'MISSION ABORT',
} as const;
const sections = [
  { id: 'science', label: 'Science return', title: 'Science return', note: 'Follow each observation from scan to return.' },
  { id: 'engineering', label: 'Engineering', title: 'Engineering contribution', note: 'The configuration behind this mission.' },
  { id: 'events', label: 'Events & recovery', title: 'Events & recovery', note: 'Recorded conditions and responses.' },
  { id: 'guidance', label: 'Model guidance', title: 'Model guidance', note: 'Read the result in its scientific context.' },
  { id: 'sources', label: 'Sources & credits', title: 'Sources & credits', note: 'The evidence behind the educational model.' },
] as const;
type PageId = typeof sections[number]['id'];

export type MissionReportViewProps = {
  record: MissionRecord | null;
  mission: { config: RoverConfig; results: ReturnTypeEngineering } | null;
  progress: Pick<RecordedProgress, 'scannedTargets'> | null;
  debrief?: ReactNode;
  onRestart: () => void;
};

// The desk changes only presentation state; it never selects or writes a mission outcome.
export function MissionReportView({ record, mission, progress, debrief, onRestart }: MissionReportViewProps) {
  const outcome = record?.outcome;
  const isIncident = outcome === 'mission-failure' || outcome === 'mission-abort';
  const pages = isIncident ? [sections[2], sections[0], sections[1], sections[3], sections[4]] : sections;
  const [desk, setDesk] = useState(true);
  const [active, setActive] = useState<PageId>(isIncident ? 'events' : 'science');
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const reportHeading = useRef<HTMLHeadingElement>(null);
  const dossierButton = useRef<HTMLButtonElement>(null);
  const focusDestination = useRef<'report' | 'desk' | 'page' | null>(null);
  useEffect(() => {
    const destination = focusDestination.current;
    focusDestination.current = null;
    if (destination === 'page') {
      pageHeading.current?.focus({ preventScroll: true });
      pageHeading.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    } else if (destination === 'report') reportHeading.current?.focus({ preventScroll: true });
    else if (destination === 'desk') dossierButton.current?.focus({ preventScroll: true });
  }, [desk, active]);
  const turnPage = (id: PageId) => {
    if (active === id) { pageHeading.current?.focus(); return; }
    focusDestination.current = 'page'; setActive(id);
  };
  const changeDesk = (value: boolean) => {
    focusDestination.current = value ? 'desk' : 'report'; setDesk(value);
  };
  const pageIndex = pages.findIndex(page => page.id === active);
  const page = pages[pageIndex];
  const returned = record?.transmittedTargets ?? [];
  const reward = scienceRewardForReturnedTargets(returned, SCIENCE_TARGETS);
  const tone = outcome === 'full-success' ? 'success' : isIncident ? 'failure' : outcome ? 'caution' : 'unavailable';
  const label = outcome ? outcomeLabel[outcome] : 'REPORT UNAVAILABLE';
  const reason = record?.endReason || (outcome ? 'No closing reason was recorded.' : 'No finalized mission outcome is available.');
  const OutcomeIcon = isIncident ? TriangleAlert : outcome === 'full-success' ? ShieldCheck : FileText;

  if (desk) return <main className={`mission-report mission-dossier dossier-${tone} debrief-desk`}>
    <div className="desk-surface">
      <header className="desk-header">
        <div><p className="archive-eyebrow">ARES-01 / ASTROCREW / POST-FLIGHT ARCHIVE</p>
          <h1>COMMAND DESK <span>//</span><br />MISSION DEBRIEF</h1>
          <p className="desk-intro">Your mission is on record. Open the dossier to inspect the science return, engineering decisions, and recorded events.</p></div>
        <div className="desk-status"><OutcomeIcon size={18} aria-hidden="true" /><span>{label}</span></div>
      </header>
      <div className="desk-stage">
        <div className="desk-mug" aria-hidden="true"><span>A</span><small>ASTROCREW</small></div>
        <div className="desk-pen" aria-hidden="true" />
        <div className="desk-cartridge" aria-hidden="true"><span>SCIENCE RETURN</span><div><i /><i /><i /><i /></div><strong>{record ? String(returned.length).padStart(2, '0') : '—'}<small> RECORDS</small></strong><span>ARES-01 / FIELD DATA</span></div>
        <button ref={dossierButton} type="button" className="desk-dossier" onClick={() => changeDesk(false)} aria-label="Open mission dossier">
          <span className="desk-folder-tab">ARES-01 <span>//</span> FIELD RECORD</span>
          <span className="desk-folder-cover">
            <span className="desk-cover-top"><Rocket size={28} aria-hidden="true" /><span>ASTROCREW<br /><small>MISSION OPERATIONS</small></span><span className="desk-barcode" aria-hidden="true" /></span>
            <span className="desk-cover-title">ARES<span>—01</span><small>AFTER-ACTION REPORT</small></span>
            <span className="desk-cover-outcome"><OutcomeIcon size={20} aria-hidden="true" />{label}</span>
            <span className="desk-cover-bottom">PERSEVERANCE / JEZERO CRATER<span>OBSERVATIONS · ENGINEERING · EVENTS</span></span>
          </span>
          <span className="desk-open-prompt"><span><i aria-hidden="true" /> MISSION RECORD</span><strong>OPEN MISSION DOSSIER <ArrowRight size={20} aria-hidden="true" /></strong><small>Inspect the full report</small></span>
        </button>
      </div>
      <footer className="desk-footer"><span><Radio size={18} aria-hidden="true" /> MISSION ARCHIVE</span><span>{record ? `${returned.length} OF ${SCIENCE_TARGETS.length} TARGET RECORDS RETURNED` : 'NO MISSION RECORD AVAILABLE'}</span><span>ARES-01 <b>//</b> ASTROCREW</span></footer>
    </div>
  </main>;

  return <main className={`mission-report mission-dossier dossier-${tone}`}>
    <div className="archive-frame">
      <div className="archive-registration" aria-hidden="true"><span>ARES-01 // POST-FLIGHT RECORD</span><span>ASTROCREW / MISSION ARCHIVE</span></div>
      <header className="archive-masthead">
        <div className="archive-agency"><span className="archive-emblem"><Rocket size={30} aria-hidden="true" /></span><div><strong>ASTROCREW <span>//</span> MISSION OPERATIONS</strong><p>PERSEVERANCE / JEZERO CRATER / POST-FLIGHT REVIEW</p></div></div>
        <span className="archive-status"><OutcomeIcon size={15} aria-hidden="true" />{outcome ? 'OUTCOME RECORDED' : 'RECORD UNAVAILABLE'}</span>
      </header>
      <nav className="dossier-navigation" aria-label="Report sections">
        {pages.map((item, index) => <button key={item.id} type="button" aria-label={item.label}
          aria-current={active === item.id ? 'page' : undefined} aria-controls="dossier-page" onClick={() => turnPage(item.id)}>
          <span className="dossier-page-number" aria-hidden="true">[ {String(index + 1).padStart(2, '0')} :</span>{item.label}<span aria-hidden="true"> ]</span>
        </button>)}
      </nav>
      <article className="dossier-paper" aria-label="Mission report document">
        <div className="dossier-tape" aria-hidden="true" />
        <header className="dossier-outcome">
          <div className="dossier-title-block"><p className="dossier-kicker"><OutcomeIcon size={15} aria-hidden="true" />{isIncident ? 'POST-MISSION INCIDENT REVIEW' : 'ARES-01 / EXPEDITION RECORD'}</p>
            <h1 ref={reportHeading} tabIndex={-1}>{!outcome ? label : isIncident ? label : 'FLIGHT DEBRIEF REPORT'}</h1>
            <p className="dossier-reason">{reason}</p></div>
          {outcome && <div className="dossier-stamp"><b>{isIncident ? '× ' : '★ '}{label}{isIncident ? ' ×' : ' ★'}</b><small>{returned.length} OF {SCIENCE_TARGETS.length} RECORDS RETURNED TO EARTH</small></div>}
        </header>
        <section id="dossier-page" className={`dossier-page page-${active}`} aria-labelledby="dossier-page-title">
          <div className="dossier-section-heading"><h2 id="dossier-page-title" ref={pageHeading} tabIndex={-1} aria-live="polite" aria-atomic="true">{page.title}</h2><span>SECTION {String(pageIndex + 1).padStart(2, '0')}</span></div>
          <p className="dossier-page-intro">{page.note}</p>
          {active === 'science' && <>
            <div className="dossier-science-grid"><div>
              {record ? <p className="dossier-return-summary">{returned.length} of {SCIENCE_TARGETS.length} target records returned · campaign award +{reward} RP.</p>
                : <p className="dossier-empty">No science-return record is available.</p>}
              <div className="dossier-observations">
                {SCIENCE_TARGETS.map(target => {
                  const received = !!record && returned.includes(target.id);
                  const scanned = !!progress?.scannedTargets.includes(target.id);
                  const status = received ? 'RETURNED' : !record ? 'RETURN STATUS UNAVAILABLE' : scanned ? 'ONBOARD · NOT RETURNED' : progress ? 'NOT COMPLETED' : 'COLLECTION STATUS UNAVAILABLE';
                  return <article className={`report-row ${received ? 'is-returned' : scanned ? 'is-onboard' : ''}`} key={target.id} data-target-id={target.id}>
                    <span className="dossier-observation-mark" aria-hidden="true">{received ? <Check /> : scanned ? <Circle /> : <X />}</span>
                    <div><h3>{target.name}</h3>{(received || scanned) && <p>{target.discovery}</p>}</div>
                    <b className="dossier-observation-status">{status}</b>
                  </article>;
                })}
              </div>
              <p className="dossier-caption">Only transmitted observations earn the campaign award. A scan still onboard is not a science return.</p>
            </div><aside className="dossier-crew">
              <p className="archive-eyebrow">{outcome && debrief ? 'CREW / MISSION DEBRIEF' : 'MISSION / RECORD SUMMARY'}</p>
              {outcome && debrief ? debrief : <div className="dossier-summary"><FileText size={30} aria-hidden="true" /><strong>{label}</strong><p>{reason}</p></div>}
              <div className="dossier-receipt"><Radio size={13} aria-hidden="true" /><span>{record ? `${returned.length} TARGET RECORDS RETURNED` : 'RETURN DATA UNAVAILABLE'}</span></div>
            </aside></div>
          </>}
          {active === 'engineering' && (mission ? <>
            <p className="dossier-configuration">{mission.config.instruments.map(id => INSTRUMENTS.find(instrument => instrument.id === id)?.name ?? id).join(' · ') || 'No science instruments selected.'}</p>
            <dl className="dossier-data">
              <div><dt>Modeled rover mass <small>CALC</small></dt><dd>{mission.results.massKg.toFixed(1)} kg</dd></div>
              <div><dt>Daily energy balance <small>CALC / ASSUMED SCHEDULE</small></dt><dd>{mission.results.netWh.toFixed(0)} Wh/sol</dd></div>
              <div><dt>Chosen battery reserve <small>ASSUMED POLICY</small></dt><dd>{(mission.config.reserve * 100).toFixed(0)}%</dd></div>
              <div><dt>Downlink strategy</dt><dd>{mission.config.downlink}</dd></div>
            </dl>
            {mission.results.issues.map(issue => <p className="report-alert" key={issue}>Constraint: {issue}</p>)}
            {mission.results.warnings.map(warning => <p className="report-note" key={warning}>Design note: {warning}</p>)}
            <details className="dossier-details"><summary>Read the engineering figures</summary>
              <p>Calculated values combine rover reference data with the model’s assumed schedule and contact duration. Battery energy also uses assumed nominal voltage and efficiency; the actual Mars 2020 values are not established in this model.</p>
              <dl className="dossier-data">
                <div><dt>Mass margin</dt><dd>{mission.results.massMarginKg.toFixed(1)} kg</dd></div>
                <div><dt>MMRTG generation</dt><dd>{mission.results.genWh.toFixed(1)} Wh/sol</dd></div>
                <div><dt>Baseline load</dt><dd>{mission.results.baseWh.toFixed(1)} Wh/sol</dd></div>
                <div><dt>Science activity load</dt><dd>{mission.results.activityWh.toFixed(1)} Wh/sol</dd></div>
                <div><dt>Nominal battery energy</dt><dd>{mission.results.eNominalWh.toFixed(1)} Wh</dd></div>
                <div><dt>Usable battery energy</dt><dd>{mission.results.eUsableWh.toFixed(1)} Wh</dd></div>
                <div><dt>Delivered battery energy</dt><dd>{mission.results.eDeliveredWh.toFixed(1)} Wh</dd></div>
                <div><dt>Modeled peak load</dt><dd>{mission.results.peakW.toFixed(1)} W</dd></div>
                <div><dt>Payload data-volume proxy</dt><dd>{mission.results.dataMbit.toFixed(1)} Mbit</dd></div>
                <div><dt>Idealized link capacity</dt><dd>{mission.results.linkMbit.toFixed(1)} Mbit/sol</dd></div>
              </dl>
            </details>
          </> : <p className="dossier-empty">No confirmed configuration recorded.</p>)}

          {active === 'events' && isIncident && record && <div className="incident-summary" aria-label="Recorded incident summary">
            <div><TriangleAlert size={22} aria-hidden="true" /><h3>Closing record</h3><p>{reason}</p></div>
            <div><Radio size={22} aria-hidden="true" /><h3>Science return</h3><p>{returned.length} of {SCIENCE_TARGETS.length} target records returned to Earth.</p></div>
            <div><FileText size={22} aria-hidden="true" /><h3>Event log</h3><p>{record.events.length} recorded event{record.events.length === 1 ? '' : 's'} · {record.events.filter(event => event.status === 'recovered').length} marked recovered.</p></div>
          </div>}

          {active === 'events' && (record ? record.events.length ? <ol className="dossier-event-list">
            {record.events.map(event => <li className="report-event" key={event.id}>
              <div className="dossier-event-meta"><span>SOL {String(event.sol).padStart(2, '0')}</span><b>{event.status.toUpperCase()}</b></div>
              <h3>{event.title}</h3><p className="dossier-event-trigger">{event.trigger}</p><p>{event.explanation}</p>
              {event.recovery && <p className="dossier-recovery">Recovery: {event.recovery}</p>}
              <details className="dossier-details"><summary>Engineering basis</summary><p>{event.model}</p></details>
            </li>)}
          </ol> : <p className="dossier-empty">No modeled anomalies occurred.</p> : <p className="dossier-empty">No event record is available.</p>)}

          {active === 'guidance' && <>
            <p>These notes explain the educational model and its limitations. The recorded outcome and events describe this mission.</p>
            {outcome ? <ul className="dossier-guidance">{missionReportLessons(outcome, record?.events ?? []).map(lesson => <li key={lesson}>{lesson}</li>)}</ul>
              : <p className="dossier-empty">Mission-specific guidance is unavailable without a recorded outcome.</p>}
          </>}

          {active === 'sources' && <>
            <p>Scientific reference data and educational assumptions are distinct. Source links document the model’s inputs; they do not certify this mission.</p>
            <ul className="dossier-sources">{SOURCES.map(source => <li key={source.id}>
              <span>{source.id}</span><a href={source.url} target="_blank" rel="noreferrer">{source.label}<span className="dossier-sr-only"> (opens a new tab)</span><span aria-hidden="true"> ↗</span></a>
            </li>)}</ul>
            <ProjectCredits />
          </>}
        </section>
        <footer className="dossier-paper-foot">
          <button type="button" aria-label="Previous report section" disabled={pageIndex === 0} onClick={() => turnPage(pages[pageIndex - 1].id)}><ArrowLeft size={16} aria-hidden="true" /><span>PREV PAGE</span></button>
          <span>PAGE {String(pageIndex + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</span>
          <button type="button" aria-label="Next report section" disabled={pageIndex === pages.length - 1} onClick={() => turnPage(pages[pageIndex + 1].id)}><span>NEXT PAGE</span><ArrowRight size={16} aria-hidden="true" /></button>
        </footer>
      </article>
      <div className="dossier-actions"><button className="report-desk-return" type="button" onClick={() => changeDesk(true)}><ArrowLeft size={18} aria-hidden="true" />[ RETURN TO DESK ]</button>
        <button className="report-return" type="button" aria-label="NEW CAMPAIGN" onClick={onRestart}><span>[ NEW CAMPAIGN ]</span><Rocket size={20} aria-hidden="true" /></button></div>
      <footer className="dossier-bottomline"><span>ARES-01 <span aria-hidden="true">/</span> ASTROCREW</span><span>INDEPENDENT EDUCATIONAL MISSION GAME</span></footer>
    </div>
  </main>;
}

export default function MissionReport() {
  const record = useGameStore(state => state.missionRecord);
  const mission = useGameStore(state => state.confirmedMission);
  const progress = useGameStore(state => state.missionProgress);
  const restart = useGameStore(state => state.reset);
  return <MissionReportView record={record} mission={mission} progress={progress} onRestart={restart} debrief={record?.outcome ? <CrewDebrief /> : undefined} />;
}
