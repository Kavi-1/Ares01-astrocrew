import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let checks = 0;
const equal = (a, b, message) => { assert.equal(a, b, message); checks++; };
const near = (a, b, tolerance = 1e-7) => { assert.ok(Math.abs(a - b) < tolerance, `${a} vs ${b}`); checks++; };

try {
  const e = await server.ssrLoadModule('/src/engine/campaign.ts');
  const { getDriveStatus } = await server.ssrLoadModule('/src/engine/mobility.ts');
  const { DEFAULT_CONFIG, FIXED } = await server.ssrLoadModule('/src/nasa/data.ts');
  const { nominalBatteryWh } = await server.ssrLoadModule('/src/nasa/engineering.ts');
  const { SCENARIOS, scenarioTargets } = await server.ssrLoadModule('/src/data/scenarios.ts');
  const cfg = { ...DEFAULT_CONFIG, instruments: ['mastcam-z', 'sherloc', 'pixl', 'meda'] };
  const options = structuredClone(e.DEFAULT_OPTIONS);
  const plan = { driveHours: 1, scienceHours: 6, science: true, weather: true, transmit: true };
  const initial = () => e.createCampaign(options, cfg);
  const ready = () => e.commitPlan(initial(), plan);
  const code = (c, expected, phase = 'active') => {
    const before = e.snapshotCampaign(c);
    const result = getDriveStatus(c, phase);
    equal(result.code, expected);
    equal(result.allowed, expected === 'ready');
    assert.ok(result.reason.length && result.action.length); checks++;
    equal(e.snapshotCampaign(c), before, 'Checking movement eligibility must not mutate the mission.');
    return result;
  };

  code(initial(), 'planning');
  code(ready(), 'ready');
  code(ready(), 'paused', 'paused');
  code(ready(), 'briefing', 'briefing');
  code(ready(), 'finished', 'complete');
  equal(getDriveStatus(null).allowed, true, 'Legacy campaigns retain their established live controls.');
  equal(getDriveStatus(null, 'paused').allowed, false);

  // The reported Sol 2 / full battery state is a legitimate new-sol plan, not a
  // power shortage. Committing that plan must immediately restore eligibility.
  let c = e.endSol(ready());
  equal(c.sol, 2);
  near(c.energyWh, nominalBatteryWh());
  code(c, 'planning');
  c = e.commitPlan(c, plan);
  code(c, 'ready');
  const firstTarget = scenarioTargets('jezero').find(target => target.availableSol === 2);
  const afterScience = e.acquireTarget(c, firstTarget.id, firstTarget.x, firstTarget.z);
  assert.ok(afterScience.completed.includes(`science:${firstTarget.id}`)); checks++;
  code(afterScience, 'ready');
  const afterScienceDrive = e.traverse(afterScience, 5, 10);
  assert.ok(afterScienceDrive.driveMeters > afterScience.driveMeters); checks++;
  assert.ok(afterScienceDrive.energyWh < afterScience.energyWh); checks++;

  // A stationary/braked frame does not spend energy, advance sol time or revoke
  // the committed plan. Native braking and key behavior are browser regressions.
  for (const meters of [0, -1, NaN, 1e-12]) {
    equal(e.traverse(afterScienceDrive, meters), afterScienceDrive);
  }
  const restoredScience = e.restoreCampaign(e.snapshotCampaign(afterScienceDrive));
  assert.deepEqual(getDriveStatus(restoredScience), getDriveStatus(afterScienceDrive)); checks++;
  assert.deepEqual(e.traverse(restoredScience, 7, 4), e.traverse(afterScienceDrive, 7, 4)); checks++;

  // Allocation, elapsed time, pause and mission completion remain independent
  // restrictions; completed observations never consume the drive allocation.
  code(e.commitPlan(initial(), { ...plan, driveHours: 0 }), 'no-allocation');
  const driven = e.traverse(ready(), FIXED.driveSpeedMps * 3600);
  const exhausted = code(driven, 'drive-exhausted');
  near(exhausted.remainingDriveHours, 0);
  equal(driven.mode, 'operations');
  const revised = e.reviewRemainingPlan(driven);
  code(revised, 'planning');
  const recommitted = e.commitPlan(revised, { ...plan, driveHours: 2 });
  code(recommitted, 'ready');
  near(recommitted.driveHours, driven.driveHours);
  near(recommitted.driveMeters, driven.driveMeters);
  const solExhausted = e.waitHours(ready(), FIXED.solHours);
  code(solExhausted, 'sol-exhausted');
  near(getDriveStatus(solExhausted).remainingSolHours, 0);
  code({ ...ready(), mode: 'finished' }, 'finished');

  // All fixed reserve choices use the same documented energy integrator. A
  // reserve is a stopping threshold, never a frame-based charging multiplier.
  for (const reserve of [.2, .3, .4]) {
    const threshold = nominalBatteryWh() * reserve;
    let low = e.commitPlan(e.createCampaign(options, { ...cfg, reserve }), plan);
    const below = e.restoreCampaign(e.snapshotCampaign({ ...low, energyWh: threshold - 1 }));
    const advisory = code(below, 'ready');
    assert.match(advisory.reason, /Battery below reserve/); checks++;
    const downhill = e.traverse(below, 5, -10);
    near(downhill.driveMeters, 5);
    assert.ok(downhill.energyWh > below.energyWh); checks++;
    equal(downhill.safe, false, 'Generation-supported restored downhill motion must retain canonical eligibility.');
    const uphill = e.traverse(below, 5, 10);
    near(uphill.driveMeters, 0);
    code(uphill, 'safe-mode');
    code({ ...low, energyWh: threshold }, 'ready');
    low = { ...low, energyWh: threshold + 1 };
    const stopped = e.traverse(low, 100, 10);
    near(stopped.energyWh, threshold);
    assert.ok(stopped.driveMeters > 0 && stopped.driveMeters < 100); checks++;
    code(stopped, 'safe-mode');
    equal(e.traverse(stopped, 5), stopped);
    const recovery = e.endSol(stopped);
    code(recovery, 'safe-mode');
    equal(recovery.skipNext, false, 'The recovery sol must be skipped once.');
    const recovered = e.endSol(recovery);
    code(recovered, 'planning');
    code(e.commitPlan(recovered, plan), 'ready');
  }

  // Energy depends on accepted distance/slope and modeled activity time, never
  // on the number of render steps. Include generation-supported downhill motion.
  for (const slope of [-10, 0, 10]) {
    const start = { ...ready(), energyWh: 2000 };
    const once = e.traverse(start, 100, slope);
    for (const steps of [10, 30, 60, 144]) {
      let split = start;
      for (let frame = 0; frame < steps; frame++) split = e.traverse(split, 100 / steps, slope);
      near(split.energyWh, once.energyWh);
      near(split.elapsedHours, once.elapsedHours);
      near(split.driveHours, once.driveHours);
      near(split.driveMeters, once.driveMeters);
      equal(getDriveStatus(split).code, getDriveStatus(once).code);
    }
  }
  const charging = { ...ready(), energyWh: 1500 };
  near(e.waitHours(charging, 1).energyWh - charging.energyWh,
    (e.generationForSol(charging) - cfg.baselineW) * Math.sqrt(FIXED.roundTripEfficiency));

  let hazard = initial();
  while (hazard.sol < 5) hazard = e.endSol(hazard);
  code(hazard, 'route-hazard');
  equal(e.traverse({ ...hazard, mode: 'operations' }, 1).driveMeters, 0);
  const rerouted = e.commitPlan(e.resolveRoute(hazard, 'reroute'), plan);
  code(rerouted, 'ready');
  const crossed = e.resolveRoute(hazard, 'cross');
  code(crossed, 'damage');
  assert.match(getDriveStatus(crossed).reason, /accepted terrain crossing/); checks++;
  equal(e.traverse({ ...crossed, mode: 'operations' }, 1).driveMeters, 0);
  const damaged = e.createCampaign({ ...options, site: 'columbia', risks: { ...options.risks, landing: true } }, DEFAULT_CONFIG);
  code(damaged, 'damage');
  assert.match(getDriveStatus(damaged).reason, /landing damage/); checks++;

  // Every site, ranking and 30-/20-sol duration gets repeated committed driving,
  // target acquisition, save/load and End Sol transitions, including E1/E2 sols.
  const rankings = [['G', 'B', 'E'], ['G', 'E', 'B'], ['B', 'G', 'E'], ['B', 'E', 'G'], ['E', 'G', 'B'], ['E', 'B', 'G']];
  for (const site of SCENARIOS) for (const ranking of rankings) for (const short of [false, true]) {
    let mission = e.createCampaign({ ...options, site: site.id, ranking, relay: short ? 'O3' : 'O1', risks: { budget: short, landing: false, mass: false } }, cfg);
    equal(mission.totalSols, short ? 20 : 30);
    for (let sol = 1; sol <= mission.totalSols; sol++) {
      equal(mission.sol, sol);
      if (mission.events.some(event => event.id === 'E1' && !event.resolved)) {
        code(mission, 'route-hazard');
        mission = e.resolveRoute(mission, 'reroute');
      }
      code(mission, 'planning');
      mission = e.commitPlan(mission, plan);
      code(mission, 'ready');
      const beforeDrive = mission;
      mission = e.traverse(mission, 5, 2);
      assert.ok(mission.driveMeters > beforeDrive.driveMeters); checks++;
      assert.ok(mission.energyWh < beforeDrive.energyWh); checks++;
      if (sol <= 10) mission = e.acquireWeather(mission);
      for (const target of scenarioTargets(site.id).filter(target => target.availableSol === sol)) {
        mission = e.acquireTarget(mission, target.id, target.x, target.z);
        assert.ok(mission.completed.includes(`science:${target.id}`)); checks++;
      }
      code(mission, 'ready');
      const afterWork = mission;
      mission = e.traverse(mission, 5, 2);
      assert.ok(mission.driveMeters > afterWork.driveMeters); checks++;
      const restored = e.restoreCampaign(e.snapshotCampaign(mission));
      assert.deepEqual(getDriveStatus(restored), getDriveStatus(mission)); checks++;
      assert.deepEqual(e.endSol(restored), e.endSol(mission)); checks++;
      mission = e.endSol(restored);
    }
    code(mission, 'finished');
    equal(mission.history.length, mission.totalSols);
  }

  console.log(`PASS ${checks} mobility eligibility, science/sol transitions, all scenarios/rankings/durations, reserve/recovery, deterministic energy and save/load checks.`);
} finally {
  await server.close();
}
