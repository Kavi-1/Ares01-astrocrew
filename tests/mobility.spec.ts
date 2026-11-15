import { test, expect, type Page } from '@playwright/test';
import type { Campaign } from '../src/engine/campaign';
import type { MissionProgress } from '../src/store/gameStore';
import type { RoverConfig } from '../src/nasa/data';

// Every fixture begins as a native, launched campaign. Restored boundary states
// below exercise actual production input/physics, never a replacement outcome.
type SavedGame = {
  version: number;
  state: {
    campaign: Campaign;
    missionProgress: MissionProgress;
    missionPhase: string;
    missionRecord: { safeMode: boolean; ended: boolean; outcome: string | null };
    confirmedMission: { config: RoverConfig; [key: string]: unknown };
    roverConfig: RoverConfig;
    [key: string]: unknown;
  };
};

test.use({ viewport: { width: 640, height: 700 }, reducedMotion: 'reduce' });

const saved = (page: Page): Promise<SavedGame> => page.evaluate(() => JSON.parse(localStorage.getItem('ares-01-campaign')!));
const driving = (page: Page) => page.getByRole('status', { name: 'Driving status', exact: true });
const speed = (page: Page) => page.locator('.telemetry > div').first().locator('b');
const press = async (page: Page, name: string) => {
  const button = page.getByRole('button', { name, exact: true });
  await button.focus();
  await button.press('Enter');
};
const errors = (page: Page) => {
  const list: string[] = [];
  page.on('pageerror', error => list.push(error.message));
  return list;
};
async function launch(page: Page) {
  console.log('[mobility] Native mission launch');
  await page.addInitScript(() => {
    const prefix = 'ares-mobility-restoration:';
    if (window.name.startsWith(prefix)) {
      localStorage.setItem('ares-01-campaign', window.name.slice(prefix.length));
      window.name = '';
    }
  });
  await page.goto('/?visual=v2&quality=low');
  const skip = page.getByRole('radio', { name: 'Skip', exact: true });
  if (await skip.isVisible()) await skip.check();
  for (const name of [
    'ENTER MISSION CONTROL', 'Enter mission control', 'Begin workshop',
    'Review mission', 'Approve & launch', 'BEGIN COUNTDOWN', 'CONFIRM LIFTOFF',
    'BEGIN MARS APPROACH', 'DEPLOY ROVER',
  ]) await press(page, name);
  await expect(page.getByRole('complementary', { name: 'Sol operations', exact: true })).toBeVisible();
  await expect(page.locator('.sol-console summary')).toContainText('SOL 1 / 30');
  console.log('[mobility] Surface deployed, Sol 1 planning');
}
async function brake(page: Page) {
  // Space retains native activation on the Help button; brake in the driving view.
  await page.getByLabel('Mars rover driving view', { exact: true }).focus();
  await page.keyboard.down(' ');
  await expect(speed(page)).toContainText('0.000');
  await page.keyboard.up(' ');
}
async function focusDrive(page: Page) {
  await page.getByLabel('Mars rover driving view', { exact: true }).focus();
}
async function move(page: Page, keys: string[], minimum = .12) {
  const before = (await saved(page)).state.missionProgress;
  for (const key of keys) await page.keyboard.down(key);
  await expect.poll(async () => (await saved(page)).state.missionProgress.distance).toBeGreaterThan(before.distance + minimum);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
  await brake(page);
  return { before, after: (await saved(page)).state.missionProgress };
}
async function heldStill(page: Page, key = 'w') {
  const before = (await saved(page)).state;
  await page.keyboard.down(key);
  await page.waitForTimeout(1_000);
  await page.keyboard.up(key);
  const after = (await saved(page)).state;
  expect(after.missionProgress.distance).toBe(before.missionProgress.distance);
  expect(after.campaign.energyWh).toBe(before.campaign.energyWh);
}
async function restore(page: Page, base: SavedGame, change: (state: SavedGame['state']) => void) {
  const next = structuredClone(base);
  change(next.state);
  // The old live RAF continuously persists pose. Apply the fixture before the
  // next document hydrates, so it cannot be overwritten between write/reload.
  await page.evaluate(value => { window.name = 'ares-mobility-restoration:' + JSON.stringify(value); }, next);
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Sol operations', exact: true })).toBeVisible();
  await focusDrive(page);
  expect((await saved(page)).state.campaign).toEqual(next.state.campaign);
}

test('Sol 2 planning explains the stop; native keyboard, science, pause, new sols and save/load retain driving', async ({ page }) => {
  const uncaught = errors(page);
  await launch(page);
  await press(page, 'End sol');
  await expect(page.locator('.sol-console summary')).toContainText('SOL 2 / 30');
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'planning');
  await expect(driving(page)).toContainText(/commit|plan/i);
  expect((await saved(page)).state.campaign.energyWh).toBe(2408);
  // Reproduce the reported 100%-battery / Sol-2 / zero-distance state.
  await focusDrive(page);
  await heldStill(page);
  const hours = page.getByRole('spinbutton', { name: 'Planned drive hours', exact: true });
  await hours.focus();
  // Planning remains the primary restriction while native number editing works.
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'planning');
  await heldStill(page);
  await hours.press('ArrowDown');
  await expect(hours).toHaveValue('3.5');
  await hours.press('ArrowUp');
  await expect(hours).toHaveValue('4');
  const uncommitted = (await saved(page)).state.campaign;
  await focusDrive(page);
  expect((await saved(page)).state.campaign).toEqual(uncommitted);
  await page.locator('.sol-console summary').focus();
  await page.locator('.sol-console summary').press('Enter');
  await press(page, 'Help');
  await press(page, 'Replay Tutorial');
  await expect(page.locator('[data-tutorial-prompt="C7:landing"]')).toBeVisible();
  await press(page, 'Dismiss prompt');
  await expect(page.locator('[data-tutorial-prompt="C8:plan"]')).toBeVisible();
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 600 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.locator('.sol-console summary').focus();
    await page.locator('.sol-console summary').press('Enter');
    await hours.focus();
    await expect(hours).toBeInViewport({ ratio: .5 });
    const scienceHours = page.getByRole('spinbutton', { name: 'Planned science hours', exact: true });
    await scienceHours.focus();
    await expect(scienceHours).toBeInViewport({ ratio: .5 });
    await page.screenshot({ path: `work-logs/mobility-screenshots/sol-2-plan-expanded-${width}.png`, fullPage: true });
    await page.locator('.sol-console summary').focus();
    await page.locator('.sol-console summary').press('Enter');
    await expect(page.getByRole('button', { name: 'Commit sol plan', exact: true })).toBeInViewport({ ratio: .5 });
    await page.screenshot({ path: `work-logs/mobility-screenshots/sol-2-plan-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 640, height: 700 });
  await press(page, 'Help');
  await press(page, 'Disable tutorial prompts');
  await press(page, 'Commit sol plan');
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'ready');
  console.log('[mobility] Sol 2 planning/focus/mobile footer verified; plan committed');
  // No canvas click or page reload is required after a focused commit button.
  await move(page, ['w']);
  await expect(page.getByRole('button', { name: /START SCAN/ })).toBeVisible();
  await page.getByRole('button', { name: /START SCAN/ }).focus();
  await page.getByRole('button', { name: /START SCAN/ }).press('Enter');
  await expect.poll(async () => (await saved(page)).state.campaign.completed, { timeout: 90_000 }).toContain('science:jezero-G-1');
  console.log('[mobility] Native science observation completed');
  expect((await saved(page)).state.campaign.mode).toBe('operations');
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'ready');
  // All drive keys act on the actual world after the scientific observation.
  for (const keys of [['w'], ['s'], ['w', 'a'], ['w', 'd'], ['ArrowUp'], ['ArrowDown'], ['ArrowUp', 'ArrowLeft'], ['ArrowUp', 'ArrowRight']]) {
    console.log(`[mobility] Native keys ${keys.join('+')}`);
    const { before, after } = await move(page, keys);
    const projection = -Math.sin(before.heading) * (after.x - before.x) - Math.cos(before.heading) * (after.z - before.z);
    if (keys[0] === 's' || keys[0] === 'ArrowDown') expect(projection).toBeLessThan(0);
    else expect(projection).toBeGreaterThan(0);
    if (keys.includes('a') || keys.includes('ArrowLeft')) expect(after.heading).toBeGreaterThan(before.heading);
    if (keys.includes('d') || keys.includes('ArrowRight')) expect(after.heading).toBeLessThan(before.heading);
  }
  const driven = (await saved(page)).state;
  expect(driven.campaign.driveMeters).toBeGreaterThan(1);
  expect(driven.campaign.energyWh).toBeLessThan(2408);
  expect(driven.campaign.energy.some(entry => entry.id.startsWith('drive:'))).toBe(true);
  // Braking overrides even an intentionally held forward throttle.
  await focusDrive(page);
  await page.keyboard.down('w');
  await expect.poll(async () => (await saved(page)).state.missionProgress.distance).toBeGreaterThan(driven.missionProgress.distance + .12);
  await page.keyboard.down(' ');
  await expect(speed(page)).toContainText('0.000');
  const brakedDistance = (await saved(page)).state.missionProgress.distance;
  await page.waitForTimeout(750);
  expect((await saved(page)).state.missionProgress.distance).toBe(brakedDistance);
  await page.keyboard.up('w');
  await page.keyboard.up(' ');
  await heldStill(page, ' ');
  await press(page, 'Help');
  await page.getByRole('complementary', { name: 'Mission help', exact: true }).getByRole('button', { name: 'Close help', exact: true }).focus();
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'editing');
  await heldStill(page);
  await press(page, 'Return to driving');
  await expect(page.getByLabel('Mars rover driving view', { exact: true })).toBeFocused();
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'ready');
  await move(page, ['w']);
  console.log('[mobility] Help focus recovery verified');
  await press(page, 'Close help');
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
  await move(page, ['ArrowUp']);
  // An already held key must not leak across a pause/resume boundary.
  await focusDrive(page);
  await page.keyboard.down('w');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-surface-phase=paused]')).toBeVisible();
  const paused = (await saved(page)).state;
  await page.waitForTimeout(1_000);
  expect((await saved(page)).state.missionProgress.distance).toBe(paused.missionProgress.distance);
  expect((await saved(page)).state.campaign.energyWh).toBe(paused.campaign.energyWh);
  await press(page, 'RESUME MISSION');
  await page.keyboard.down('w'); // The still-held key is now an OS-style repeat.
  await page.waitForTimeout(750);
  expect((await saved(page)).state.missionProgress.distance).toBe(paused.missionProgress.distance);
  await page.keyboard.up('w');
  await move(page, ['w']);
  console.log('[mobility] Pause/resume and fresh key verified');
  // Likewise, End Sol resets the drive gate and waits for a fresh press after commit.
  await page.keyboard.down('w');
  await press(page, 'End sol 2');
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'planning');
  const sol3 = (await saved(page)).state.missionProgress.distance;
  await press(page, 'Commit sol plan');
  await page.keyboard.down('w');
  await page.waitForTimeout(750);
  expect((await saved(page)).state.missionProgress.distance).toBe(sol3);
  await page.keyboard.up('w');
  await move(page, ['ArrowUp']);
  const beforeReload = (await saved(page)).state;
  await page.reload();
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'ready');
  const reloaded = (await saved(page)).state;
  expect(reloaded.campaign).toEqual(beforeReload.campaign);
  expect(reloaded.missionProgress).toEqual(beforeReload.missionProgress);
  await focusDrive(page);
  await move(page, ['s']);
  console.log('[mobility] Sol 3 driving and save/load verified');
  await page.screenshot({ path: 'work-logs/mobility-screenshots/sol-3-driving.png', fullPage: true });
  expect(uncaught).toEqual([]);
});

test('real power, allocation, recovery, hazard and damage gates remain effective and explain why', async ({ page }) => {
  const uncaught = errors(page);
  await launch(page);
  await press(page, 'Commit sol plan');
  const base = await saved(page);
  const cases: Array<{ label: string; code: RegExp; reason: RegExp; change: (state: SavedGame['state']) => void }> = [
    { label: 'zero allocation', code: /no-allocation|zero-allocation/, reason: /0.*hour|allocat/i, change: s => { s.campaign.plan.driveHours = 0; } },
    { label: 'used allocation', code: /drive-exhausted/, reason: /exhaust|allocat/i, change: s => { s.campaign.driveHours = s.campaign.plan.driveHours; s.campaign.elapsedHours = s.campaign.driveHours; } },
    { label: 'sol duration', code: /sol-exhausted/, reason: /sol|time/i, change: s => { s.campaign.elapsedHours = 88775 / 3600; } },
    { label: 'safe recovery', code: /safe-mode/, reason: /safe|recovery/i, change: s => { s.campaign.safe = true; s.campaign.skipNext = true; s.missionRecord.safeMode = true; } },
    { label: 'mobility damage', code: /damage/, reason: /damage|mobility|landing/i, change: s => { s.campaign.mobilityDisabled = true; s.campaign.majorFailures.push('S6 hard landing: mobility disabled.'); } },
    { label: 'unresolved route decision', code: /route-hazard/, reason: /hazard|decision|route/i, change: s => { s.campaign.events.push({ id: 'E1', sol: 1, title: 'E1 · Route hazard', detail: 'A route decision is required.', resolved: false, actionable: true }); } },
  ];
  for (const fixture of cases) await test.step(fixture.label, async () => {
    console.log(`[mobility] Restriction ${fixture.label}`);
    await restore(page, base, fixture.change);
    await expect(driving(page)).toHaveAttribute('data-drive-state', fixture.code);
    await expect(driving(page)).toContainText(fixture.reason);
    await heldStill(page);
  });
  await test.step('stale legacy safe flag', async () => {
    console.log('[mobility] Canonical mission overrides stale legacy safe flag');
    await restore(page, base, s => { s.missionRecord.safeMode = true; });
    await expect(driving(page)).toHaveAttribute('data-drive-state', 'ready');
    await move(page, ['w']);
    expect((await saved(page)).state.campaign.safe).toBe(false);
  });
  // The fixed reserve policy is reached through actual driving and becomes safe
  // mode at precisely the selected Wh; it must never become a charging rate.
  for (const reserve of [.2, .3, .4] as const) await test.step(`${reserve * 100}% reserve`, async () => {
    console.log(`[mobility] Actual drive to ${reserve * 100}% reserve`);
    await restore(page, base, s => {
      s.campaign.config.reserve = reserve;
      s.confirmedMission.config.reserve = reserve;
      s.roverConfig.reserve = reserve;
      s.campaign.energyWh = 2408 * reserve + .02;
      s.missionProgress.battery = s.campaign.energyWh / 2408 * 100;
    });
    await page.keyboard.down('w');
    await expect.poll(async () => (await saved(page)).state.campaign.safe).toBe(true);
    await page.keyboard.up('w');
    const stopped = (await saved(page)).state;
    expect(stopped.campaign.energyWh).toBeCloseTo(2408 * reserve, 7);
    expect(stopped.campaign.driveMeters).toBeGreaterThan(0);
    await expect(driving(page)).toHaveAttribute('data-drive-state', 'safe-mode');
    await heldStill(page, 'ArrowUp');
  });
  // Finish an actual final-sol transition: the report must own input afterward.
  await restore(page, base, s => { s.campaign.sol = 30; s.missionProgress.sol = 30; });
  console.log('[mobility] Final-sol report transition');
  await press(page, 'End sol 30');
  await expect(page.getByRole('button', { name: 'Open mission dossier', exact: true })).toBeVisible();
  const ended = (await saved(page)).state;
  await page.keyboard.press('w');
  expect((await saved(page)).state.campaign).toEqual(ended.campaign);
  expect(ended.campaign.mode).toBe('finished');
  expect(uncaught).toEqual([]);
});

test('the authored terrain obstacle blocks forward travel while reverse remains a usable escape', async ({ page }) => {
  const uncaught = errors(page);
  await launch(page);
  await press(page, 'Commit sol plan');
  const base = await saved(page);
  // Jezero's authored route barrier is centred at (-52,-9). This native pose is
  // half a metre outside its narrow edge and faces into the blocking geometry.
  await restore(page, base, s => {
    s.missionProgress.x = -52 + 2 * 24 / Math.hypot(24, 16);
    s.missionProgress.z = -9 + 2 * 16 / Math.hypot(24, 16);
    s.missionProgress.heading = Math.atan2(24, 16);
  });
  console.log('[mobility] Authored barrier approach / reverse escape');
  await page.keyboard.down('w');
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'obstacle');
  await page.keyboard.up('w');
  await brake(page);
  const contact = (await saved(page)).state.missionProgress;
  expect(contact.distance).toBeGreaterThan(0);
  expect(contact.distance).toBeLessThan(.51);
  const dx = contact.x + 52, dz = contact.z + 9;
  const across = dx * (-24 / Math.hypot(24, 16)) - dz * (16 / Math.hypot(24, 16));
  expect(Math.abs(across)).toBeGreaterThanOrEqual(1.5);
  await page.keyboard.down('w');
  await page.waitForTimeout(1_000);
  await page.keyboard.up('w');
  await brake(page);
  const retry = (await saved(page)).state.missionProgress;
  const retryAcross = (retry.x + 52) * (-24 / Math.hypot(24, 16)) - (retry.z + 9) * (16 / Math.hypot(24, 16));
  // A fresh, slower approach may use the valid gap left by the first blocked
  // step. Assert no penetration rather than an arbitrary stopping tolerance.
  expect(Math.abs(retryAcross)).toBeGreaterThanOrEqual(1.5);
  expect(retry.distance - contact.distance).toBeLessThanOrEqual(Math.abs(across) - 1.5 + 1e-8);
  const { before, after } = await move(page, ['s'], .3);
  expect(Math.hypot(after.x + 52, after.z + 9)).toBeGreaterThan(Math.hypot(before.x + 52, before.z + 9));
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'ready');
  await page.screenshot({ path: 'work-logs/mobility-screenshots/obstacle-reverse-escape.png', fullPage: true });
  // A collision-free Jezero approach has a 31.85° forward probe, a 16.07° rear
  // probe and a legal 27.97° first reverse segment. Nose-only probing trapped it.
  await restore(page, base, s => {
    s.missionProgress.x = -80;
    s.missionProgress.z = -53.5;
    s.missionProgress.heading = 0;
  });
  console.log('[mobility] Jezero forward-grade restriction / reverse escape');
  await page.keyboard.down('w');
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'slope');
  await page.keyboard.up('w');
  expect((await saved(page)).state.missionProgress.distance).toBe(0);
  const downhill = await move(page, ['s'], .3);
  expect(downhill.after.z).toBeGreaterThan(downhill.before.z);
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'ready');
  await page.screenshot({ path: 'work-logs/mobility-screenshots/slope-reverse-escape.png', fullPage: true });
  expect(uncaught).toEqual([]);
});
