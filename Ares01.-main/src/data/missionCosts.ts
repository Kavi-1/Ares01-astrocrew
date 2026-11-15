import type { DataStatus, InstrumentId } from '../nasa/data';

/** Authoritative GAMEPLAY.md §4 costs. All money is integer USD millions. */
export const MISSION_COST_UNIT = 'USD million' as const;
export type LaunchVehicleId = 'light' | 'medium' | 'heavy';
export type RelayOrbitId = 'O1' | 'O2' | 'O3';
export type FixedCostId = 'platform' | 'operations';

export type CostProvenance = Readonly<{
  status: Exclude<DataStatus, 'UNKNOWN'>;
  specification: string;
  source: string;
  note: string;
  /** A calculated value can depend on assumed inputs without becoming DOC. */
  hasAssumptions: boolean;
}>;

export type MissionCost<Id extends string = string> = Readonly<{
  id: Id;
  label: string;
  amountUsdMillion: number;
  provenance: CostProvenance;
}>;

const specification = 'docs/GAMEPLAY.md §4, Budget values (lines 134–147)';
const gameplaySource = 'docs/GAMEPLAY.md#budget-values-starting-proposal-for-member-2';
const nasaSource = 'https://www.jpl.nasa.gov/news/press_kits/mars_2020/launch/quick_facts/';

function cost<Id extends string>(id: Id, label: string, amountUsdMillion: number, provenance: CostProvenance): MissionCost<Id> {
  return Object.freeze({ id, label, amountUsdMillion, provenance: Object.freeze(provenance) });
}

export const BASELINE_MISSION_BUDGET = cost('mission-budget', 'Baseline mission budget', 2700, {
  status: 'DOC', specification, source: nasaSource, hasAssumptions: false,
  note: 'GAMEPLAY fixes 2,700 from the published approximate 2,400 build/launch plus 300 landing/operations totals; not an exact audited NASA cost.',
});

export const FIXED_MISSION_COSTS = Object.freeze({
  platform: cost('platform', 'Rover body, EDL system and cruise stage', 1855, {
    status: 'CALC', specification, source: gameplaySource, hasAssumptions: true,
    note: '2,400 documented build/launch total minus 245 assumed heavy vehicle and 300 assumed instrument total. This residual depends on assumed costs.',
  }),
  operations: cost('operations', 'Operations', 300, {
    status: 'DOC', specification, source: nasaSource, hasAssumptions: false,
    note: 'Published approximate landing/operations total; GAMEPLAY uses 300 as the fixed operations line item.',
  }),
} satisfies Readonly<Record<FixedCostId, MissionCost<FixedCostId>>>);

const instrumentProvenance: CostProvenance = {
  status: 'ASSUMED', specification, source: gameplaySource, hasAssumptions: true,
  note: 'GAMEPLAY instrument costs scaled by size and complexity; individual instrument costs are not published.',
};
const vehicleProvenance: CostProvenance = {
  status: 'ASSUMED', specification, source: gameplaySource, hasAssumptions: true,
  note: 'GAMEPLAY light/medium/heavy prices, anchored to NASA launch awards; these are assumed game prices, not vehicle capacities or exact award amounts.',
};
const relayProvenance: CostProvenance = {
  status: 'ASSUMED', specification, source: gameplaySource, hasAssumptions: true,
  note: 'GAMEPLAY D15 relay-option costs; no relay mass, capacity or scientific parameter is inferred.',
};

// Stable presentation order follows the existing instrument catalogue, not input order.
export const INSTRUMENT_COSTS = Object.freeze({
  'mastcam-z': cost('mastcam-z', 'Mastcam-Z', 40, instrumentProvenance),
  supercam: cost('supercam', 'SuperCam', 55, instrumentProvenance),
  sherloc: cost('sherloc', 'SHERLOC', 50, instrumentProvenance),
  pixl: cost('pixl', 'PIXL', 50, instrumentProvenance),
  meda: cost('meda', 'MEDA', 30, instrumentProvenance),
  moxie: cost('moxie', 'MOXIE', 45, instrumentProvenance),
  rimfax: cost('rimfax', 'RIMFAX', 30, instrumentProvenance),
} satisfies Readonly<Record<InstrumentId, MissionCost<InstrumentId>>>);

export const LAUNCH_VEHICLE_COSTS = Object.freeze({
  light: cost('light', 'Light vehicle', 120, vehicleProvenance),
  medium: cost('medium', 'Medium vehicle', 180, vehicleProvenance),
  heavy: cost('heavy', 'Heavy vehicle', 245, vehicleProvenance),
} satisfies Readonly<Record<LaunchVehicleId, MissionCost<LaunchVehicleId>>>);

export const RELAY_ORBIT_COSTS = Object.freeze({
  O1: cost('O1', 'Existing relay', 0, relayProvenance),
  O2: cost('O2', 'Elliptical relay', 80, relayProvenance),
  O3: cost('O3', 'Areostationary relay', 140, relayProvenance),
} satisfies Readonly<Record<RelayOrbitId, MissionCost<RelayOrbitId>>>);
