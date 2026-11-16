import type { RoverConfig } from '../nasa/data';
import type { ReturnTypeEngineering } from './missionTypes';

export type MissionOutcome = 'full-success' | 'baseline-success' | 'partial-success' | 'recoverable-anomaly' | 'mission-failure' | 'mission-abort';
export type MissionEventKind = 'power-budget' | 'power-reserve' | 'communication-backlog' | 'instrument-unavailable' | 'mobility-limit' | 'sampling-decision';
export type MissionEvent = {
  id: string;
  kind: MissionEventKind;
  title: string;
  trigger: string;
  explanation: string;
  model: string;
  recoverable: boolean;
  status: 'active' | 'limitation' | 'recovered';
  recovery?: string;
  sol: number;
};
export type MissionRecord = {
  events: MissionEvent[];
  transmittedTargets: string[];
  safeMode: boolean;
  mobilityReplanned: boolean;
  ended: boolean;
  outcome: MissionOutcome | null;
  endReason: string;
  rewardApplied: boolean;
};
export type MissionOutcomeInput = {
  requested?: 'complete' | 'abort';
  batteryPercent: number;
  objectiveCount: number;
  scannedTargets: string[];
  transmittedTargets: string[];
  events: MissionEvent[];
};

export function createMissionRecord(config: RoverConfig, results: ReturnTypeEngineering, targetRequirements: Array<{ id: string; name: string; requiredInstruments: string[] }>): MissionRecord {
  const events: MissionEvent[] = [];
  if (results.netWh < 0) events.push({
    id: 'energy-budget', kind: 'power-budget', title: 'Projected daily energy deficit',
    trigger: `The selected schedule projects ${results.netWh.toFixed(1)} Wh net energy per sol.`,
    explanation: 'The modeled daily science workload exceeds the fitted MMRTG generation after the assumed housekeeping load. This is a campaign energy-balance model, not a NASA flight qualification limit.',
    model: 'CALC: Pgen × sol − (assumed 75 W baseline × sol) − selected instrument W × assumed active hours. Extended cadence multiplies non-MOXIE assumed hours by four; a scheduled MOXIE experiment stays at its documented approximate one hour.',
    recoverable: true, status: 'active', sol: 1,
  });
  if (config.downlink === 'X-band' && results.dataMbit > results.linkMbit) events.push({
    id: 'science-data-backlog', kind: 'communication-backlog', title: 'Direct-link data backlog',
    trigger: `The selected payload data-volume proxy (${results.dataMbit.toFixed(1)} Mbit) exceeds the idealized X-band capacity (${results.linkMbit.toFixed(1)} Mbit/sol).`,
    explanation: 'Science can still be collected, but this simplified plan cannot return the modeled payload volume directly to Earth in one sol. The rover carries UHF relay hardware as well as X-band antennas.',
    model: 'ASSUMED/CALC: X-band is modeled at continuous 500 bps; UHF uses a 2 Mbps rate and an assumed 8-minute pass. Instrument data figures include mixed per-sol and per-experiment values, so the payload-volume proxy is an educational warning, not a flight prediction.',
    recoverable: true, status: 'active', sol: 1,
  });
  for (const target of targetRequirements) {
    if (!target.requiredInstruments.some((id) => config.instruments.some((instrument) => instrument === id))) events.push({
      id: `payload-gap:${target.id}`, kind: 'instrument-unavailable', title: `Payload cannot perform: ${target.name}`,
      trigger: `None of this objective's supported instruments (${target.requiredInstruments.join(', ')}) is selected.`,
      explanation: 'This objective is unavailable after launch because the required science instrument was not included in the payload. The capability mapping is an ARES-01 objective rule, not a NASA requirement.',
      model: 'GAME DESIGN: target capability mapping; instrument list and mounts are taken from the documented Perseverance payload.',
      recoverable: false, status: 'limitation', sol: 1,
    });
  }
  return { events, transmittedTargets: [], safeMode: false, mobilityReplanned: false, ended: false, outcome: null, endReason: '', rewardApplied: false };
}

export function missionOutcome(input: MissionOutcomeInput): MissionOutcome {
  if (input.requested === 'abort') return 'mission-abort';
  if (input.batteryPercent <= 0) return 'mission-failure';
  const activeRecoverable = input.events.some((event) => event.recoverable && event.status === 'active');
  const allReturned = new Set(input.transmittedTargets).size >= input.objectiveCount && input.objectiveCount > 0;
  const anyReturned = new Set(input.transmittedTargets).size > 0;
  const anyScanned = new Set(input.scannedTargets).size > 0;
  const allScanned = new Set(input.scannedTargets).size >= input.objectiveCount && input.objectiveCount > 0;
  if (allScanned && allReturned && !activeRecoverable) return 'full-success';
  if (activeRecoverable) return 'recoverable-anomaly';
  return anyReturned || anyScanned ? 'partial-success' : 'mission-failure';
}

export function recoverEvent(events: MissionEvent[], id: string): MissionEvent[] {
  return events.map((event) => event.id === id && event.recoverable && event.status === 'active'
    ? { ...event, status: 'recovered', recovery: event.kind === 'power-budget' ? 'Science cadence reduced before power reserve was exhausted.' : event.kind === 'communication-backlog' ? 'UHF relay strategy selected; the modeled capacity can carry the current data proxy.' : event.kind === 'mobility-limit' ? 'Traverse plan acknowledged; operator must steer around the steep grade.' : 'Operating reserve policy acknowledged and safe mode entered.' }
    : event);
}

export function missionReportLessons(outcome: MissionOutcome, events: MissionEvent[]): string[] {
  const lessons = new Set<string>();
  if (events.some((event) => event.kind === 'power-budget')) lessons.add('Daily energy balance depends on both the RTG generation and the assumed science schedule. Reduce workload before the reserve is depleted.');
  if (events.some((event) => event.kind === 'instrument-unavailable')) lessons.add('Payload selection determines which science objectives are possible after launch; missing instruments cannot be added on Mars.');
  if (events.some((event) => event.kind === 'communication-backlog')) lessons.add('Collected science has value only after a modeled return link transmits it. Link capacities here are idealized, not contact predictions.');
  if (outcome === 'mission-abort') lessons.add('An abort preserves the rover and its unreturned science in this educational campaign model.');
  if (outcome === 'mission-failure') lessons.add('Rover loss requires three consecutive end-sol zero-energy readings. Perseverance battery discharge limits are unknown; reserve policies and safe-mode timing are game assumptions.');
  if (!lessons.size) lessons.add('The selected payload and operating plan supported the returned science objectives.');
  lessons.add('Thermal operating limits, battery discharge limits, and flight qualification criteria are unknown here and are not simulated.');
  return [...lessons];
}

export function scienceRewardForReturnedTargets(targetIds: string[], targets: Array<{ id: string; reward: number }>): number {
  return targets.reduce((sum, target) => sum + (targetIds.includes(target.id) ? target.reward : 0), 0);
}
