// Optional production playthrough. ALL game changes occur through normal buttons/keyboard.
// Read-only renderer pose observation steers those inputs; no store writes, teleports or clock overrides.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const origin = process.argv[2] ?? 'http://127.0.0.1:5183';
const directory = process.argv[3] ?? '/tmp/ares-task006/full-success-play';
const maxMs = Number(process.env.ARES_PLAY_TIMEOUT_MS ?? 480000);
await mkdir(directory, { recursive: true });
const out = { origin, startedAt: new Date().toISOString(), method: 'Normal production UI and keyboard only. Renderer pose and persisted campaign evidence are read-only. No source, physics, clock or store mutation by the harness.', actions: [], targets: [], errors: [] };
const started = Date.now();
let browser, page, timer;
const held = new Set();
const save = () => writeFile(`${directory}/result.json`, JSON.stringify(out, null, 2));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function keys(next) {
  const desired = new Set(next);
  if (desired.size === held.size && [...desired].every(k => held.has(k))) return;
  for (const key of [...held]) if (!desired.has(key)) { await page.keyboard.up(key); held.delete(key); }
  for (const key of desired) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
  out.actions.push({ ms: Date.now() - started, action: 'keyboard', keys: [...held] });
}
async function click(name, exact = true) {
  await keys([]); await page.getByRole('button', { name, exact }).click();
  out.actions.push({ ms: Date.now() - started, action: 'click', name: String(name) });
}
const pose = () => page.evaluate(() => window.__driveProbe.pose);
async function recoverVisibleEvents() {
  for (const name of ['ACKNOWLEDGE', 'SWITCH TO UHF RELAY', 'REDUCE SCIENCE CADENCE']) {
    const action = page.getByRole('button', { name, exact: true });
    if (await action.isVisible()) await click(name);
  }
}
async function driveTo(x, z, tolerance = 4) {
  let stuckSince = Date.now(), lastProgress = await pose(), recoveryCount = 0, lastLog = 0;
  while (true) {
    const p = await pose();
    if (!p) throw new Error('Rendered rover pose unavailable.');
    const distance = Math.hypot(x - p.x, z - p.z);
    if (distance <= tolerance) { await keys(['Space']); await sleep(700); await keys([]); return p; }
    const desired = Math.atan2(-(x - p.x), -(z - p.z));
    const error = Math.atan2(Math.sin(desired - p.heading), Math.cos(desired - p.heading));
    const input = ['w'];
    if (Math.abs(error) > .055) input.push(error > 0 ? 'a' : 'd');
    if (Math.abs(error) > 1.2) input.push('Space');
    else if (distance > 16 && Math.abs(error) < .14) input.push('Shift');
    await keys(input);
    if (Math.hypot(p.x - lastProgress.x, p.z - lastProgress.z) > .35) { lastProgress = p; stuckSince = Date.now(); }
    if (Date.now() - stuckSince > 8000) {
      if (++recoveryCount > 6) throw new Error(`Unable to reach waypoint ${x},${z} using ordinary controls; last position ${p.x},${p.z}.`);
      out.actions.push({ ms: Date.now() - started, action: 'keyboard unstuck maneuver', waypoint: { x, z }, pose: p });
      await keys(['s', recoveryCount % 2 ? 'a' : 'd']); await sleep(2200); await keys(['Space']); await sleep(600);
      await recoverVisibleEvents(); lastProgress = await pose(); stuckSince = Date.now();
    }
    if (Date.now() - lastLog > 10000) {
      lastLog = Date.now(); console.log(JSON.stringify({ action: 'drive', waypoint: { x, z }, remaining: distance.toFixed(1), pose: p, keys: [...held] }));
    }
    await sleep(350);
  }
}
async function scanTarget(target, count) {
  await driveTo(target.x, target.z, 6.3);
  await keys(['Space']); await sleep(900);
  const start = page.getByRole('button', { name: /^START SCAN/ });
  await expect(start).toBeVisible({ timeout: 15000 }); await start.click();
  out.actions.push({ ms: Date.now() - started, action: 'start scan', target: target.id, pose: await pose() });
  await expect(page.locator('.objective small')).toContainText(`${count}/3`, { timeout: 90000 });
  await keys([]); await recoverVisibleEvents();
  out.targets.push({ id: target.id, ms: Date.now() - started, pose: await pose(), objective: await page.locator('.objective').innerText() });
  console.log(JSON.stringify({ action: 'scan complete', ...out.targets.at(-1) })); await save();
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--enable-unsafe-swiftshader'] });
  out.browser = browser.version();
  timer = setTimeout(() => { out.timedOut = true; void browser.close(); }, maxMs);
  const context = await browser.newContext({ viewport: { width: 640, height: 600 }, deviceScaleFactor: 1 });
  page = await context.newPage(); page.setDefaultTimeout(45000); page.on('pageerror', e => out.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__driveProbe = { pose: null }; window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
      const renderer = event.detail; if (!renderer.isWebGLRenderer) return;
      const render = renderer.render; let roverRef;
      renderer.render = function(scene, camera, ...args) {
        const result = render.call(this, scene, camera, ...args);
        if (this.domElement.parentElement?.classList.contains('mars-world')) {
          const rover = roverRef?.deref() ?? scene.getObjectByName('ARES01_Root');
          if (rover) { roverRef = new WeakRef(rover); window.__driveProbe.pose = { x: rover.position.x, z: rover.position.z, heading: rover.rotation.y, at: performance.now() }; }
        }
        return result;
      };
    });
  });
  await page.goto(origin);
  await click('ENTER MISSION CONTROL', false); await click('Enter mission control'); await click('Begin workshop');
  await expect(page.locator('.room-canvas')).toHaveAttribute('data-rover-status', 'ready', { timeout: 120000 });
  await click('Review mission'); await click('Approve & launch');
  for (const name of ['BEGIN COUNTDOWN', 'CONFIRM LIFTOFF', 'BEGIN MARS APPROACH', 'DEPLOY ROVER']) await click(name, false);
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout: 120000 });
  await expect(page.getByRole('button', { name: 'End mission', exact: true })).toBeVisible();
  await scanTarget({ id: 'ancient-outcrop', x: -18, z: 2 }, 1);
  // Read-only terrain sampling found these route segments below 10° in the existing terrain.
  // They avoid the main crater rims/rock clusters; no physics or collision rule is modified.
  for (const [x, z] of [[-45, 0], [-75, -20]]) await driveTo(x, z);
  await scanTarget({ id: 'basalt-fracture', x: -92, z: -36 }, 2);
  for (const [x, z] of [[-70, -16], [-45, -12], [-18, 4], [25, -35], [78, -40]]) await driveTo(x, z);
  await scanTarget({ id: 'iron-ejecta', x: 78, z: -64 }, 3);
  await keys([]); await recoverVisibleEvents();
  await click(/^Uplink/, false); await click('End mission');
  await expect(page.getByRole('heading', { level: 1, name: 'FULL SUCCESS', exact: true })).toBeVisible({ timeout: 30000 });
  out.outcome = await page.locator('.mission-report h1').innerText();
  out.reportText = await page.locator('.mission-report').innerText();
  out.persistedEvidence = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('ares-01-campaign') ?? 'null')?.state;
    return { missionRecord: state?.missionRecord, missionProgress: state?.missionProgress, agencyRP: state?.agency?.rp };
  });
  expect(out.persistedEvidence.missionRecord?.outcome).toBe('full-success');
  expect(new Set(out.persistedEvidence.missionRecord?.transmittedTargets).size).toBe(3);
  for (const size of [{ width: 1440, height: 1000 }, { width: 1366, height: 768 }, { width: 820, height: 900 }, { width: 390, height: 900 }]) {
    await page.setViewportSize(size);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.mission-report').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `${directory}/full-success-live-${size.width}.png`, fullPage: true });
    const scrolls = await page.locator('.mission-report').evaluate(el => el.scrollHeight > el.clientHeight + 1);
    if (scrolls) {
      await page.locator('.mission-report').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.screenshot({ path: `${directory}/full-success-live-${size.width}-bottom.png`, fullPage: true });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  }
  out.completedAt = new Date().toISOString(); out.durationMs = Date.now() - started; await save();
  console.log('PASS genuine FULL SUCCESS via ordinary driving, scans, uplink and End mission; 3 returned observations.');
} catch (error) {
  out.failure = String(error); out.durationMs = Date.now() - started;
  if (page && !page.isClosed()) { out.lastPose = await pose().catch(() => null); await page.screenshot({ path: `${directory}/incomplete-live.png`, fullPage: true, timeout: 5000 }).catch(() => {}); }
  await save(); throw error;
} finally {
  clearTimeout(timer); if (page && !page.isClosed()) await keys([]).catch(() => {}); await browser?.close();
}
