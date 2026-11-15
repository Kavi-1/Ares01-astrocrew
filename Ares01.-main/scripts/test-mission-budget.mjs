import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Use the existing SSR test convention, without the app config/React plugin,
// browser globals, application stores, or a listening HTTP/WebSocket server.
const server = await createServer({
  configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
});
const counts = { fixtures: 0, exhaustive: 0, validation: 0, contracts: 0 };
function check(group, name, run) {
  try { run(); } catch (error) { error.message = `${name}: ${error.message}`; throw error; }
  counts[group]++;
}

// Independent GAMEPLAY §4 oracle. No production cost constants/evaluator output
// are used to generate expected amounts. Bit order is explicit and stable.
const instrumentIds = ['mastcam-z', 'supercam', 'sherloc', 'pixl', 'meda', 'moxie', 'rimfax'];
const instrumentPrices = [40, 55, 50, 50, 30, 45, 30];
const expectedSubsetTotals = [
  0, 40, 55, 95, 50, 90, 105, 145, 50, 90, 105, 145, 100, 140, 155, 195,
  30, 70, 85, 125, 80, 120, 135, 175, 80, 120, 135, 175, 130, 170, 185, 225,
  45, 85, 100, 140, 95, 135, 150, 190, 95, 135, 150, 190, 145, 185, 200, 240,
  75, 115, 130, 170, 125, 165, 180, 220, 125, 165, 180, 220, 175, 215, 230, 270,
  30, 70, 85, 125, 80, 120, 135, 175, 80, 120, 135, 175, 130, 170, 185, 225,
  60, 100, 115, 155, 110, 150, 165, 205, 110, 150, 165, 205, 160, 200, 215, 255,
  75, 115, 130, 170, 125, 165, 180, 220, 125, 165, 180, 220, 175, 215, 230, 270,
  105, 145, 160, 200, 155, 195, 210, 250, 155, 195, 210, 250, 205, 245, 260, 300,
];
// Independently specified fixed + vehicle + relay totals, before instruments.
const expectedBaseTotals = {
  light: { O1: 2275, O2: 2355, O3: 2415 },
  medium: { O1: 2335, O2: 2415, O3: 2475 },
  heavy: { O1: 2400, O2: 2480, O3: 2540 },
};
const vehiclePrices = { light: 120, medium: 180, heavy: 245 };
const relayPrices = { O1: 0, O2: 80, O3: 140 };
const full = { instruments: instrumentIds, vehicle: 'heavy', relayOrbit: 'O1' };

try {
  const { calculateMissionBudget } = await server.ssrLoadModule('/src/engine/missionBudget.ts');
  const data = await server.ssrLoadModule('/src/data/missionCosts.ts');
  const numbers = (result, expected) => {
    for (const [field, value] of Object.entries(expected)) assert.equal(result[field], value, field);
  };

  check('fixtures', 'A: full payload, heavy, existing relay', () => {
    const result = calculateMissionBudget(full);
    numbers(result, {
      fixedCostUsdMillion: 2155, instrumentCostUsdMillion: 300, flexibleBudgetUsdMillion: 545,
      flexibleSpendingUsdMillion: 545, totalCostUsdMillion: 2700, remainingBudgetUsdMillion: 0,
      budgetMarginFraction: 0, withinBudget: true,
    });
    assert.equal(result.budget.amountUsdMillion, 2700);
    assert.equal(result.vehicleCost.amountUsdMillion, 245);
    assert.equal(result.relayCost.amountUsdMillion, 0);
  });
  check('fixtures', 'B: elliptical relay exceeds baseline', () => {
    numbers(calculateMissionBudget({ ...full, relayOrbit: 'O2' }), {
      totalCostUsdMillion: 2780, flexibleSpendingUsdMillion: 625, remainingBudgetUsdMillion: -80,
      budgetMarginFraction: -80 / 2700, withinBudget: false,
    });
  });
  check('fixtures', 'C: areostationary relay exceeds baseline', () => {
    numbers(calculateMissionBudget({ ...full, relayOrbit: 'O3' }), {
      totalCostUsdMillion: 2840, flexibleSpendingUsdMillion: 685, remainingBudgetUsdMillion: -140,
      budgetMarginFraction: -140 / 2700, withinBudget: false,
    });
  });
  check('fixtures', 'D: removing SuperCam and SHERLOC saves 105', () => {
    const result = calculateMissionBudget({ ...full, instruments: ['mastcam-z', 'pixl', 'meda', 'moxie', 'rimfax'] });
    numbers(result, {
      instrumentCostUsdMillion: 195, flexibleSpendingUsdMillion: 440,
      totalCostUsdMillion: 2595, remainingBudgetUsdMillion: 105,
      budgetMarginFraction: 105 / 2700, withinBudget: true,
    });
    assert.equal(2700 - result.totalCostUsdMillion, 105);
  });
  check('fixtures', 'E: fixed expenses survive an empty payload', () => {
    const result = calculateMissionBudget({ ...full, instruments: [] });
    numbers(result, {
      fixedCostUsdMillion: 2155, instrumentCostUsdMillion: 0, flexibleSpendingUsdMillion: 245,
      totalCostUsdMillion: 2400, remainingBudgetUsdMillion: 300, withinBudget: true,
    });
    assert.deepEqual(result.fixedCosts.map(item => [item.id, item.amountUsdMillion]), [['platform', 1855], ['operations', 300]]);
    assert.deepEqual(result.instrumentCosts, []);
  });

  for (let mask = 0; mask < 128; mask++) {
    const instruments = Object.freeze(instrumentIds.filter((_, bit) => mask & (1 << bit)));
    for (const vehicle of ['light', 'medium', 'heavy']) for (const relayOrbit of ['O1', 'O2', 'O3']) {
      check('exhaustive', `F: mask ${mask}, ${vehicle}, ${relayOrbit}`, () => {
        const input = Object.freeze({ instruments, vehicle, relayOrbit });
        const result = calculateMissionBudget(input);
        const expectedTotal = expectedBaseTotals[vehicle][relayOrbit] + expectedSubsetTotals[mask];
        numbers(result, {
          fixedCostUsdMillion: 2155, instrumentCostUsdMillion: expectedSubsetTotals[mask],
          flexibleBudgetUsdMillion: 545, flexibleSpendingUsdMillion: expectedTotal - 2155,
          totalCostUsdMillion: expectedTotal, remainingBudgetUsdMillion: 2700 - expectedTotal,
          budgetMarginFraction: (2700 - expectedTotal) / 2700, withinBudget: expectedTotal <= 2700,
        });
        assert.equal(result.budget.amountUsdMillion, 2700);
        assert.deepEqual(result.fixedCosts.map(item => item.amountUsdMillion), [1855, 300]);
        assert.equal(result.vehicleCost.id, vehicle);
        assert.equal(result.vehicleCost.amountUsdMillion, vehiclePrices[vehicle]);
        assert.equal(result.relayCost.id, relayOrbit);
        assert.equal(result.relayCost.amountUsdMillion, relayPrices[relayOrbit]);
        assert.deepEqual(result.instrumentCosts.map(item => [item.id, item.amountUsdMillion]),
          instrumentIds.flatMap((id, bit) => mask & (1 << bit) ? [[id, instrumentPrices[bit]]] : []));
        if (relayOrbit === 'O1') assert.equal(result.withinBudget, true, 'every O1 combination fits');
        for (const field of ['fixedCostUsdMillion', 'instrumentCostUsdMillion', 'flexibleBudgetUsdMillion',
          'flexibleSpendingUsdMillion', 'totalCostUsdMillion', 'remainingBudgetUsdMillion']) {
          assert.ok(Number.isSafeInteger(result[field]), `${field} is exact integer money`);
        }
        assert.deepEqual(result, calculateMissionBudget(input), 'deterministic repeat');
      });
    }
  }

  for (const [budget, remaining, withinBudget] of [[2699, -1, false], [2700, 0, true], [2701, 1, true]]) {
    check('validation', `G: budget boundary ${budget}`, () => {
      const result = calculateMissionBudget({ ...full, scenarioBudgetUsdMillion: budget });
      numbers(result, {
        totalCostUsdMillion: 2700, remainingBudgetUsdMillion: remaining,
        budgetMarginFraction: remaining / budget, withinBudget,
      });
      assert.equal(result.budget.amountUsdMillion, budget);
    });
  }
  check('validation', 'custom budget changes the limit, not the cost table', () => {
    numbers(calculateMissionBudget({ ...full, relayOrbit: 'O2', scenarioBudgetUsdMillion: 2780 }), {
      totalCostUsdMillion: 2780, flexibleBudgetUsdMillion: 625, remainingBudgetUsdMillion: 0,
      budgetMarginFraction: 0, withinBudget: true,
    });
  });
  check('validation', 'budget below fixed expenses is a deficit, not an invalid scenario', () => {
    numbers(calculateMissionBudget({ instruments: [], vehicle: 'light', relayOrbit: 'O1', scenarioBudgetUsdMillion: 1 }), {
      fixedCostUsdMillion: 2155, flexibleBudgetUsdMillion: -2154, totalCostUsdMillion: 2275,
      remainingBudgetUsdMillion: -2274, budgetMarginFraction: -2274, withinBudget: false,
    });
  });
  check('validation', 'largest safe integer budget retains exact money', () => {
    const result = calculateMissionBudget({ instruments: [], vehicle: 'light', relayOrbit: 'O1', scenarioBudgetUsdMillion: Number.MAX_SAFE_INTEGER });
    assert.equal(result.totalCostUsdMillion, 2275);
    assert.equal(result.remainingBudgetUsdMillion, 9007199254738716);
    assert.ok(Number.isSafeInteger(result.remainingBudgetUsdMillion));
  });
  check('validation', 'omitted or undefined budget uses the baseline', () => {
    assert.deepEqual(calculateMissionBudget(full), calculateMissionBudget({ ...full, scenarioBudgetUsdMillion: undefined }));
  });
  for (const input of [undefined, null, [], 'budget', 2700, true, {}]) {
    check('validation', 'reject malformed or incomplete request', () => {
      assert.throws(() => calculateMissionBudget(input), TypeError);
    });
  }
  for (const instruments of [undefined, null, 'supercam', {}, new Set(['supercam']), 7]) {
    check('validation', 'reject non-array instrument selections', () => {
      assert.throws(() => calculateMissionBudget({ ...full, instruments }), /instruments must be an array/);
    });
  }
  for (const id of ['unknown', 'constructor', 'toString', '__proto__', 'MASTCAM-Z', '', null, true, 1, {}]) {
    check('validation', 'reject unknown or mistyped instrument ID', () => {
      assert.throws(() => calculateMissionBudget({ ...full, instruments: [id] }), /known instrument IDs/);
    });
  }
  check('validation', 'reject sparse instrument array', () => {
    assert.throws(() => calculateMissionBudget({ ...full, instruments: Array(1) }), /known instrument IDs/);
  });
  for (const id of instrumentIds) {
    check('validation', `reject duplicate ${id}`, () => {
      assert.throws(() => calculateMissionBudget({ ...full, instruments: [id, id] }), /Duplicate instrument ID/);
    });
  }
  for (const vehicle of [undefined, null, '', 'lv_light', 'Heavy', 'unknown', 'constructor', 'toString', '__proto__', 0, true, {}]) {
    check('validation', 'reject unknown/missing vehicle, including legacy IDs', () => {
      assert.throws(() => calculateMissionBudget({ ...full, vehicle }), /vehicle must be/);
    });
  }
  for (const relayOrbit of [undefined, null, '', 'o1', 'existing', 'unknown', 'constructor', 'toString', '__proto__', 0, true, {}]) {
    check('validation', 'reject unknown/missing relay orbit', () => {
      assert.throws(() => calculateMissionBudget({ ...full, relayOrbit }), /relayOrbit must be/);
    });
  }
  for (const budget of [0, -1, -2700, 2700.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MIN_VALUE]) {
    check('validation', 'reject invalid numeric budget', () => {
      assert.throws(() => calculateMissionBudget({ ...full, scenarioBudgetUsdMillion: budget }), RangeError);
    });
  }
  for (const budget of [null, '2700', '', true, [], {}, 2700n]) {
    check('validation', 'reject nonnumeric budget without coercion', () => {
      assert.throws(() => calculateMissionBudget({ ...full, scenarioBudgetUsdMillion: budget }), TypeError);
    });
  }

  check('contracts', 'input is not mutated and selection order is irrelevant', () => {
    const input = { instruments: [...instrumentIds].reverse(), vehicle: 'heavy', relayOrbit: 'O1' };
    const before = structuredClone(input);
    const result = calculateMissionBudget(input);
    assert.deepEqual(input, before);
    assert.deepEqual(result, calculateMissionBudget(full));
    const frozen = Object.freeze({ ...input, instruments: Object.freeze(input.instruments) });
    assert.deepEqual(result, calculateMissionBudget(frozen));
  });
  check('contracts', 'result mutations cannot affect later calls or the catalogue', () => {
    const result = calculateMissionBudget(full);
    assert.throws(() => { result.totalCostUsdMillion = 0; }, TypeError);
    assert.throws(() => result.instrumentCosts.push(result.instrumentCosts[0]), TypeError);
    assert.throws(() => { result.fixedCosts[0].amountUsdMillion = 0; }, TypeError);
    assert.throws(() => { result.vehicleCost.provenance.status = 'DOC'; }, TypeError);
    assert.throws(() => { data.INSTRUMENT_COSTS.supercam.amountUsdMillion = 0; }, TypeError);
    assert.throws(() => { data.INSTRUMENT_COSTS.unknown = result.instrumentCosts[0]; }, TypeError);
    calculateMissionBudget({ instruments: [], vehicle: 'light', relayOrbit: 'O3', scenarioBudgetUsdMillion: 1 });
    assert.deepEqual(result, calculateMissionBudget(full));
    assert.equal(JSON.stringify(result), JSON.stringify(calculateMissionBudget(full)));
  });
  check('contracts', 'all input costs have appropriate provenance and units', () => {
    const result = calculateMissionBudget(full);
    assert.equal(result.unit, 'USD million');
    const expected = [
      [result.budget, 'DOC', false],
      [data.FIXED_MISSION_COSTS.platform, 'CALC', true],
      [data.FIXED_MISSION_COSTS.operations, 'DOC', false],
      ...Object.values(data.INSTRUMENT_COSTS).map(item => [item, 'ASSUMED', true]),
      ...Object.values(data.LAUNCH_VEHICLE_COSTS).map(item => [item, 'ASSUMED', true]),
      ...Object.values(data.RELAY_ORBIT_COSTS).map(item => [item, 'ASSUMED', true]),
    ];
    assert.equal(expected.length, 16);
    for (const [item, status, hasAssumptions] of expected) {
      assert.equal(item.provenance.status, status, item.id);
      assert.equal(item.provenance.hasAssumptions, hasAssumptions, item.id);
      assert.match(item.provenance.specification, /docs\/GAMEPLAY\.md §4/);
      assert.ok(item.provenance.source.length > 0 && item.provenance.note.length > 0);
      assert.ok(Object.isFrozen(item) && Object.isFrozen(item.provenance));
    }
    assert.match(data.FIXED_MISSION_COSTS.platform.provenance.note, /245 assumed heavy vehicle and 300 assumed instrument/);
    assert.equal(result.calculationProvenance.status, 'CALC');
    assert.equal(result.calculationProvenance.hasAssumptions, true);
  });
  check('contracts', 'custom budget provenance never claims a NASA measurement', () => {
    for (const amount of [2700, 2780]) {
      const result = calculateMissionBudget({ ...full, scenarioBudgetUsdMillion: amount });
      assert.equal(result.budget.provenance.status, 'ASSUMED');
      assert.equal(result.budget.provenance.hasAssumptions, true);
      assert.equal(result.budget.provenance.source, 'caller:scenarioBudgetUsdMillion');
      assert.match(result.budget.provenance.note, /not asserted to be a documented NASA budget/);
      assert.ok(Object.isFrozen(result.budget) && Object.isFrozen(result.budget.provenance));
    }
  });

  assert.equal(counts.exhaustive, 1152);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  console.log('PASS fixtures A–E: 2700 within budget; 2780/2840 over budget; removal saves 105; fixed costs 2155');
  console.log(`PASS ${total} mission-budget cases: ${counts.fixtures} fixtures, ${counts.exhaustive} exhaustive combinations, ${counts.validation} boundary/validation cases, ${counts.contracts} determinism/immutability/provenance cases`);
} finally {
  await server.close();
}
