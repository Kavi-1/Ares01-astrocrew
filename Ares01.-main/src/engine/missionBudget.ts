import type { InstrumentId } from '../nasa/data';
import {
  BASELINE_MISSION_BUDGET, FIXED_MISSION_COSTS, INSTRUMENT_COSTS,
  LAUNCH_VEHICLE_COSTS, MISSION_COST_UNIT, RELAY_ORBIT_COSTS,
  type CostProvenance, type FixedCostId, type LaunchVehicleId, type MissionCost, type RelayOrbitId,
} from '../data/missionCosts';

export type MissionBudgetInput = Readonly<{
  /** An array representing a set: duplicate IDs are errors, never deduplicated. */
  instruments: readonly InstrumentId[];
  vehicle: LaunchVehicleId;
  relayOrbit: RelayOrbitId;
  /** Positive safe-integer USD millions. Omitted/undefined uses the baseline. */
  scenarioBudgetUsdMillion?: number;
}>;

export type MissionBudgetResult = Readonly<{
  unit: typeof MISSION_COST_UNIT;
  budget: MissionCost<'mission-budget'>;
  fixedCosts: readonly MissionCost<FixedCostId>[];
  instrumentCosts: readonly MissionCost<InstrumentId>[];
  vehicleCost: MissionCost<LaunchVehicleId>;
  relayCost: MissionCost<RelayOrbitId>;
  fixedCostUsdMillion: number;
  instrumentCostUsdMillion: number;
  flexibleBudgetUsdMillion: number;
  flexibleSpendingUsdMillion: number;
  totalCostUsdMillion: number;
  remainingBudgetUsdMillion: number;
  /** Signed (budget - total) / budget, unrounded; not a score or risk threshold. */
  budgetMarginFraction: number;
  withinBudget: boolean;
  calculationProvenance: CostProvenance;
}>;

const calculationProvenance: CostProvenance = Object.freeze({
  status: 'CALC', specification: 'docs/GAMEPLAY.md §4, total-cost check and budget values',
  source: 'src/engine/missionBudget.ts', hasAssumptions: true,
  note: 'Totals sum the stated cost line items, including assumed costs. Remaining = scenario budget - total; margin fraction = remaining / scenario budget. No scoring or mission consequence is applied.',
});

function isInstrumentId(id: unknown): id is InstrumentId {
  return typeof id === 'string' && Object.hasOwn(INSTRUMENT_COSTS, id);
}

/**
 * Pure B01–B05 arithmetic; does not authorize launch or implement an override.
 * All monetary outputs are exact integers; only the descriptive margin is a ratio.
 * Throws TypeError for malformed selections/types, RangeError for invalid numeric
 * budgets. No minimum funding beyond a positive budget is imposed: an unfunded
 * design returns a signed deficit. Returned data is frozen and shares no mutable
 * state with callers. Input order does not affect the canonical result.
 */
export function calculateMissionBudget(input: MissionBudgetInput): MissionBudgetResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError('Mission budget input must be an object.');
  }
  const { instruments, vehicle, relayOrbit, scenarioBudgetUsdMillion } = input;
  if (!Array.isArray(instruments)) throw new TypeError('instruments must be an array of instrument IDs.');
  const installed = new Set<InstrumentId>();
  for (const id of instruments) {
    if (!isInstrumentId(id)) {
      throw new TypeError('instruments must contain only known instrument IDs.');
    }
    if (installed.has(id)) throw new TypeError(`Duplicate instrument ID: ${id}.`);
    installed.add(id);
  }
  if (typeof vehicle !== 'string' || !Object.hasOwn(LAUNCH_VEHICLE_COSTS, vehicle)) {
    throw new TypeError('vehicle must be light, medium or heavy.');
  }
  if (typeof relayOrbit !== 'string' || !Object.hasOwn(RELAY_ORBIT_COSTS, relayOrbit)) {
    throw new TypeError('relayOrbit must be O1, O2 or O3.');
  }
  const budgetAmount = scenarioBudgetUsdMillion === undefined
    ? BASELINE_MISSION_BUDGET.amountUsdMillion : scenarioBudgetUsdMillion;
  if (typeof budgetAmount !== 'number') throw new TypeError('scenarioBudgetUsdMillion must be a number.');
  if (!Number.isSafeInteger(budgetAmount) || budgetAmount <= 0) {
    throw new RangeError('scenarioBudgetUsdMillion must be a positive safe integer in USD millions.');
  }
  const budget: MissionCost<'mission-budget'> = scenarioBudgetUsdMillion === undefined
    ? BASELINE_MISSION_BUDGET
    : Object.freeze({
      id: 'mission-budget', label: 'Scenario mission budget', amountUsdMillion: budgetAmount,
      provenance: Object.freeze({
        status: 'ASSUMED', specification: 'docs/GAMEPLAY.md §4, scenario budget (line 147)',
        source: 'caller:scenarioBudgetUsdMillion', hasAssumptions: true,
        note: 'Caller-supplied scenario setting; not asserted to be a documented NASA budget.',
      }),
    });
  const fixedCosts = Object.freeze([FIXED_MISSION_COSTS.platform, FIXED_MISSION_COSTS.operations]);
  const instrumentCosts = Object.freeze(Object.values(INSTRUMENT_COSTS).filter(item => installed.has(item.id)));
  const vehicleCost = LAUNCH_VEHICLE_COSTS[vehicle], relayCost = RELAY_ORBIT_COSTS[relayOrbit];
  const fixedCostUsdMillion = fixedCosts.reduce((sum, item) => sum + item.amountUsdMillion, 0);
  const instrumentCostUsdMillion = instrumentCosts.reduce((sum, item) => sum + item.amountUsdMillion, 0);
  const flexibleSpendingUsdMillion = instrumentCostUsdMillion + vehicleCost.amountUsdMillion + relayCost.amountUsdMillion;
  const totalCostUsdMillion = fixedCostUsdMillion + flexibleSpendingUsdMillion;
  const remainingBudgetUsdMillion = budgetAmount - totalCostUsdMillion;
  return Object.freeze({
    unit: MISSION_COST_UNIT, budget, fixedCosts, instrumentCosts, vehicleCost, relayCost,
    fixedCostUsdMillion, instrumentCostUsdMillion,
    flexibleBudgetUsdMillion: budgetAmount - fixedCostUsdMillion,
    flexibleSpendingUsdMillion, totalCostUsdMillion, remainingBudgetUsdMillion,
    budgetMarginFraction: remainingBudgetUsdMillion / budgetAmount,
    withinBudget: remainingBudgetUsdMillion >= 0, calculationProvenance,
  });
}
