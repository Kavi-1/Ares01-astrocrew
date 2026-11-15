import type { CrewId } from '../data/crew';
import { SCIENCE_TARGETS } from '../data/scienceTargets';
import { INSTRUMENTS, type RoverConfig } from '../nasa/data';
import { calculateEngineering } from '../nasa/engineering';

export type PreparationStage = 'entry' | 'briefing' | 'workshop' | 'review';
export type StationId = 'briefing' | 'payload' | 'power' | 'communications' | 'review';
export type ProposalPriority = 'science' | 'safety' | 'mass';
export type DecisionStation = 'payload' | 'power' | 'communications';
export type PreparationState = {
  preparationOpen?: boolean; // Presentation only: distinguish Welcome from the saved crew-selection screen.
  stage: PreparationStage;
  activeStation: StationId | null;
  decisions: Partial<Record<DecisionStation, { mode: 'accepted' | 'takeover' | 'direct'; fingerprint: string }>>;
};
export const INITIAL_PREPARATION: PreparationState = { stage: 'entry', activeStation: null, decisions: {}, preparationOpen:false };
export const STATION_OWNERS: Record<StationId, CrewId> = {
  briefing: 'lautaro', payload: 'aaryan', power: 'houssam', communications: 'huzaifa', review: 'kavi',
};
export const STATION_LABELS: Record<StationId, string> = {
  briefing: 'Science briefing', payload: 'Payload workshop', power: 'Power station',
  communications: 'Communications', review: 'Readiness review',
};
export const CREW_STATION: Record<CrewId, StationId> = {
  kavi: 'review', aaryan: 'payload', houssam: 'power', huzaifa: 'communications', lautaro: 'briefing', rihabe: 'briefing',
};
export const configFingerprint = (config: RoverConfig) => JSON.stringify({ ...config, instruments: [...config.instruments].sort() });
export const supportedTargets = (config: RoverConfig) => SCIENCE_TARGETS.filter(t => t.requiredInstruments.some(id => config.instruments.includes(id)));
export const proposalSafe = (config: RoverConfig) => {
  const r = calculateEngineering(config);
  return !r.issues.length && r.netWh >= 0 && r.dataMbit <= r.linkMbit;
};
export type CrewProposal = {
  owner: CrewId; station: DecisionStation; priority: ProposalPriority;
  basedOn: string; config: RoverConfig | null; reason: string;
  before: ReturnType<typeof calculateEngineering>; after: ReturnType<typeof calculateEngineering> | null;
};

// Exhaustive search over the small supported choice sets. Owners only change
// their own settings; infeasible cross-domain constraints are reported, not hidden.
export function proposeConfiguration(config: RoverConfig, station: DecisionStation, priority: ProposalPriority): CrewProposal {
  const candidates: RoverConfig[] = [];
  if (station === 'payload') {
    for (let mask = 0; mask < 1 << INSTRUMENTS.length; mask++) {
      const instruments = INSTRUMENTS.filter((_, i) => mask & (1 << i)).map(i => i.id);
      candidates.push({ ...config, instruments });
    }
  } else if (station === 'power') {
    for (const reserve of [.2, .3, .4] as const)
      for (const scienceCadence of [1, 4] as const)
        for (const moxieRun of [false, true]) candidates.push({ ...config, reserve, scienceCadence, moxieRun });
  } else {
    candidates.push({ ...config, downlink: 'UHF' }, { ...config, downlink: 'X-band' });
  }
  const coverage = supportedTargets(config).length;
  const safe = candidates.filter(c => proposalSafe(c) && supportedTargets(c).length >= coverage);
  const score = (c: RoverConfig): number[] => {
    const r = calculateEngineering(c);
    const science = c.instruments.length + (c.scienceCadence === 4 ? 2 : 0) + Number(c.moxieRun);
    if (priority === 'science') return [supportedTargets(c).length, science, c.reserve, r.netWh, -r.massKg, r.linkMbit];
    if (priority === 'mass') return [-r.massKg, r.netWh, c.reserve, science, r.linkMbit];
    // The systems target is a preference, not an invented hard limit.
    if (station === 'payload') return [Number(r.massMarginKg >= (r.massKg + r.massMarginKg) * .1), -r.massKg, science, r.netWh];
    if (station === 'power') return [c.reserve, r.netWh, science];
    return [Number(c.downlink === 'UHF'), r.linkMbit - r.dataMbit];
  };
  safe.sort((a,b) => {
    const sa = score(a), sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i];
    return configFingerprint(a).localeCompare(configFingerprint(b));
  });
  const next = safe[0] ?? null, before = calculateEngineering(config), after = next ? calculateEngineering(next) : null;
  const reason = after
    ? `${after.massMarginKg.toFixed(1)} kg mass margin · ${after.netWh.toFixed(0)} Wh/sol energy margin · ${after.dataMbit.toFixed(1)} / ${after.linkMbit.toFixed(1)} Mbit data. ${station === 'payload' && after.massMarginKg < (after.massKg + after.massMarginKg) * .1 ? 'The preferred 10% mass margin is not achievable with the current science coverage; this is the closest feasible plan.' : 'Existing target access is preserved.'}`
    : 'No safe proposal can preserve current target access using only this station’s controls. Review the other stations or take over; nothing has been changed.';
  return { owner: STATION_OWNERS[station], station, priority, basedOn: configFingerprint(config), config: next, reason, before, after };
}
