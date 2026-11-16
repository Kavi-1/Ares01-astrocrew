import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dataSummary, restoreCampaign, scienceSummary, targetReadiness, type Campaign } from '../src/engine/campaign';
import { activeExpeditionSols } from '../src/engine/expedition';
import { getScenario, scenarioTargets, type SiteId } from '../src/data/scenarios';
import type { MissionProgress } from '../src/store/gameStore';
import type { RoverConfig } from '../src/nasa/data';

/**
 * Native launch, controls, instrument activities, event choices and final report.
 * After proving real keyboard travel, distant formations use POSE-ONLY restore
 * fixtures. These are software-GPU interaction playthroughs, not demonstrations
 * of navigating every metre of the course. Campaign reducers are never seeded,
 * advanced, credited or replaced by the test.
 */
type SavedGame = {
  version: number;
  state: {
    campaign: Campaign;
    missionProgress: MissionProgress;
    missionPhase: string;
    confirmedMission: { config: RoverConfig; [key: string]: unknown };
    roverConfig: RoverConfig;
    missionRecord: { outcome: string | null; [key: string]: unknown };
    [key: string]: unknown;
  };
};

test.use({ viewport: { width: 640, height: 700 }, reducedMotion: 'reduce' });

const saved = (page: Page): Promise<SavedGame> => page.evaluate(() => JSON.parse(localStorage.getItem('ares-01-campaign')!));
const campaign = async (page: Page) => (await saved(page)).state.campaign;
const driving = (page: Page) => page.getByRole('status', { name: 'Driving status', exact: true });
const press = async (page: Page, name: string | RegExp) => {
  const button = page.getByRole('button', { name, exact: typeof name === 'string' });
  await button.focus();
  await button.press('Enter');
};
const focusDrive = (page: Page) => page.getByLabel('Mars rover driving view', { exact: true }).focus();
const errors = (page: Page) => {
  const uncaught: string[] = [];
  page.on('pageerror', error => uncaught.push(error.message));
  return uncaught;
};

async function launch(page: Page, site: SiteId) {
  await page.addInitScript(() => {
    // Apply a restored pose before hydration, so the old world's live RAF cannot
    // overwrite the fixture between a storage write and the new document.
    const prefix = 'ares-expedition-restoration:';
    if (window.name.startsWith(prefix)) {
      localStorage.setItem('ares-01-campaign', window.name.slice(prefix.length));
      window.name = '';
    }
  });
  await page.goto('/?quality=low'); // Cinematic v2 is now the default.
  const skip = page.getByRole('radio', { name: 'Skip', exact: true });
  if (await skip.isVisible()) await skip.check();
  await press(page, 'ENTER MISSION CONTROL');
  await press(page, 'Enter mission control');
  await press(page, new RegExp('^' + getScenario(site).name + ' '));
  await press(page, 'Begin workshop');
  if (site === 'columbia') {
    // A genuine engineering choice avoids Columbia's default hard landing while
    // retaining every instrument needed for the G4/B4/E10 completion bundles.
    await press(page, /^Payload workshop /);
    await press(page, 'Take over');
    await page.getByRole('checkbox', { name: 'Installed MOXIE', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Installed SuperCam', exact: true }).uncheck();
    await press(page, 'Apply changes');
  }
  for (const name of ['Review mission', 'Approve & launch', 'BEGIN COUNTDOWN', 'CONFIRM LIFTOFF', 'BEGIN MARS APPROACH', 'DEPLOY ROVER']) await press(page, name);
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
  await expect(driving(page)).toHaveAttribute('data-drive-state', 'planning');
  await expect(page.locator('.mars-world')).toHaveAttribute('data-visual-variant', 'v2');
  expect((await campaign(page)).mobilityDisabled).toBe(false);
}

async function brake(page: Page) {
  await focusDrive(page);
  await page.keyboard.down(' ');
  await expect.poll(() => page.locator('[data-rover-speed]').getAttribute('data-rover-speed')).toBe('0.000');
  await page.keyboard.up(' ');
}

async function drive(page: Page, key: string) {
  const before = (await saved(page)).state;
  await focusDrive(page);
  await page.keyboard.down(key);
  await expect.poll(async () => (await saved(page)).state.missionProgress.distance).toBeGreaterThan(before.missionProgress.distance + .15);
  await page.keyboard.up(key);
  await brake(page);
  const after = (await saved(page)).state;
  const projection = -Math.sin(before.missionProgress.heading) * (after.missionProgress.x - before.missionProgress.x)
    - Math.cos(before.missionProgress.heading) * (after.missionProgress.z - before.missionProgress.z);
  expect(key === 'ArrowDown' || key === 's' ? -projection : projection).toBeGreaterThan(0);
  expect(after.campaign.driveMeters).toBeGreaterThan(before.campaign.driveMeters);
  expect(after.campaign.driveHours).toBeGreaterThan(before.campaign.driveHours);
  expect(after.campaign.energy.some(entry => entry.id === `drive:${after.campaign.sol}`)).toBe(true);
  const sum = (c: Campaign, key: 'generatedWh' | 'requestedWh' | 'servedWh' | 'conversionLossWh' | 'curtailedWh') => c.energy.reduce((total, entry) => total + entry[key], 0);
  const delta = (key: 'generatedWh' | 'requestedWh' | 'servedWh' | 'conversionLossWh' | 'curtailedWh') => sum(after.campaign, key) - sum(before.campaign, key);
  expect(delta('requestedWh')).toBeGreaterThan(0);
  expect(delta('servedWh')).toBeCloseTo(delta('requestedWh'), 8);
  expect(after.campaign.energyWh).toBeCloseTo(before.campaign.energyWh + delta('generatedWh') - delta('servedWh') - delta('conversionLossWh') - delta('curtailedWh'), 7);
  // Signed terrain can reduce the driving load. Assert discharge only where
  // the actual modeled demand exceeds generation, rather than inventing a
  // uniform battery penalty for every direction on every site.
  if (delta('requestedWh') > delta('generatedWh')) expect(after.campaign.energyWh).toBeLessThan(before.campaign.energyWh);
}

async function poseAt(page: Page, targetId: string) {
  const before = await saved(page);
  const target = scenarioTargets(before.state.campaign.options.site).find(t => t.id === targetId)!;
  if (Math.hypot(before.state.missionProgress.x - target.x, before.state.missionProgress.z - target.z) < 7) return;
  const restored = structuredClone(before);
  restored.state.missionProgress.x = target.x;
  restored.state.missionProgress.z = target.z + 6;
  restored.state.missionProgress.heading = 0;
  await page.evaluate(value => { window.name = 'ares-expedition-restoration:' + JSON.stringify(value); }, restored);
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
  expect(await campaign(page)).toEqual(before.state.campaign);
  expect((await saved(page)).state.missionProgress.distance).toBe(before.state.missionProgress.distance);
}

async function observation(page: Page, targetId: string, instrument: 'mastcam-z' | 'pixl' | 'sherloc', verifyReload: boolean) {
  const before = await campaign(page);
  const activity = `activity:${targetId}:${instrument}`;
  const product = `${targetId}:${instrument}`;
  const required = instrument === 'sherloc' ? 2 : 3;
  const field = page.getByRole('complementary', { name: 'Field science', exact: true });
  await expect(field).toHaveAttribute('data-target-id', targetId);
  const name = instrument === 'mastcam-z' ? 'Mastcam-Z' : instrument === 'pixl' ? 'PIXL' : 'SHERLOC';
  await press(page, new RegExp('^Begin ' + name));
  const interaction = page.getByRole('progressbar', { name: 'Confirmed reading points', exact: true });
  await expect(interaction).toHaveAttribute('value', '0');
  await expect(interaction).toHaveAttribute('max', String(required));
  if (verifyReload) {
    await focusDrive(page);
    await page.keyboard.press('e');
    await expect(interaction).toHaveAttribute('value', '1');
    await page.screenshot({ path: 'work-logs/expedition-screenshots/jezero-context-framing.png', fullPage: true });
    // Aiming and an incomplete interaction have no modeled energy or products.
    expect(await campaign(page)).toEqual(before);
    await page.reload();
    await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
    expect(await campaign(page)).toEqual(before);
    await expect(interaction).toHaveCount(0);
    await expect(field).toHaveAttribute('data-target-id', targetId);
    await press(page, new RegExp('^Begin ' + name));
    await expect(interaction).toHaveAttribute('value', '0');
  }
  for (let point = 0; point < required; point++) {
    await press(page, /^Confirm reading/);
    if (point < required - 1) await expect(interaction).toHaveAttribute('value', String(point + 1));
  }
  await expect.poll(async () => (await campaign(page)).completed).toContain(activity);
  const after = await campaign(page);
  expect(after.products.filter(p => p.id === product)).toHaveLength(1);
  expect(after.energy.filter(e => e.id === activity)).toHaveLength(1);
  expect(after.elapsedHours - before.elapsedHours).toBeCloseTo(instrument === 'mastcam-z' ? .5 : instrument === 'pixl' ? 2 : 1, 9);
  expect(after.products.find(p => p.id === product)!.bits).toBe(instrument === 'mastcam-z' ? 148e6 : instrument === 'pixl' ? 16e6 : 318.8e6);
  await expect(interaction).toHaveCount(0);
  if (verifyReload) {
    // The first camera image is real collected data, yet cannot satisfy the
    // geology bundle until its composition reading also exists and returns.
    expect(scienceSummary(after).fractions.G).toBe(0);
    await page.reload();
    await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
    expect(await campaign(page)).toEqual(after);
  }
}

for (const site of ['jezero', 'syrtis', 'columbia'] as const) test(`${getScenario(site).name}: interactive field campaign, quiet-sol accounting, science return and report`, async ({ page }) => {
  const uncaught = errors(page);
  await launch(page, site);
  await page.screenshot({ path: `work-logs/expedition-screenshots/${site}-first-tracks.png`, fullPage: true });
  if (site === 'jezero') {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.getByRole('button', { name: 'Commit sol plan', exact: true })).toBeInViewport({ ratio: .5 });
      await page.screenshot({ path: `work-logs/expedition-screenshots/field-brief-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 640, height: 700 });
  }
  const initial = await campaign(page);
  const active = activeExpeditionSols(initial);
  expect(active.length).toBeGreaterThanOrEqual(10);
  expect(active.length).toBeLessThanOrEqual(11);
  const visited: number[] = [];
  while ((await saved(page)).state.missionPhase === 'mars') {
    const current = await campaign(page);
    expect(active).toContain(current.sol);
    visited.push(current.sol);
    console.log(`[expedition] ${site}: active sol ${current.sol}/${current.totalSols}`);
    const route = current.events.find(e => e.id === 'E1' && !e.resolved);
    if (route) await press(page, 'Reroute safely');
    if (current.events.some(e => e.id === 'E2' && !e.resolved)) await press(page, 'Wait for next relay pass');
    if (current.events.some(e => e.id === 'D12' && !e.resolved)) await press(page, 'Examine unusual rock');
    await press(page, 'Commit sol plan');
    await expect(driving(page)).toHaveAttribute('data-drive-state', 'ready');
    if (current.sol === 1) {
      await drive(page, 'w');
      await drive(page, 'ArrowDown');
      // Camera choice and idle viewing cannot spend modeled mission time.
      const cameraState = await campaign(page);
      for (const name of ['Mast camera', 'Survey camera', 'Chase camera']) {
        await press(page, name);
        await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
      }
      await focusDrive(page);
      await page.keyboard.press('c');
      await expect(page.getByRole('button', { name: 'Mast camera', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('r');
      await page.waitForTimeout(250);
      expect(await campaign(page)).toEqual(cameraState);
    }
    await press(page, /^Log weather/);
    await press(page, 'Compare sensor view');
    await press(page, 'Confirm environmental record');
    const targets = scenarioTargets(site).filter(t => t.availableSol === current.sol);
    for (const target of targets) {
      await poseAt(page, target.id);
      for (const instrument of target.objective === 'G' ? ['mastcam-z', 'pixl'] as const : ['sherloc', 'pixl'] as const) {
        await observation(page, target.id, instrument, site === 'jezero' && target.id === 'jezero-G-1' && instrument === 'mastcam-z');
      }
      expect((await campaign(page)).completed).toContain(`science:${target.id}`);
      if (target.id === `${site}-G-1`) {
        const partial = await campaign(page);
        await page.reload();
        await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
        expect(await campaign(page)).toEqual(partial);
      }
    }
    const beforeAdvance = await campaign(page);
    await press(page, 'Continue expedition');
    await expect.poll(async () => {
      const next = await campaign(page);
      return next.mode === 'finished' || next.sol > beforeAdvance.sol;
    }).toBe(true);
    const next = await campaign(page);
    expect(next.history.slice(beforeAdvance.history.length).map(h => h.sol)).toEqual(Array.from({ length: next.history.length - beforeAdvance.history.length }, (_, index) => beforeAdvance.sol + index));
    // Every quiet day is a real energy-accounted day; optional science remains
    // player-operated, so no product may originate on an unvisited quiet sol.
    for (const day of next.history.slice(beforeAdvance.history.length)) {
      expect(day.generatedWh).toBeGreaterThan(0);
      expect(day.loadWh).toBeGreaterThan(0);
      expect(day.endWh).toBeGreaterThanOrEqual(0);
      expect(day.endWh).toBeLessThanOrEqual(2408);
    }
    const inventory = dataSummary(next);
    expect(inventory.collectedBits).toBe(inventory.returnedBits + inventory.onboardBits + inventory.lostBits);
    expect(inventory.capacityBits).toBeNull();
  }
  expect(visited).toEqual(active);
  const final = (await saved(page)).state;
  expect(final.campaign.history.map(h => h.sol)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
  expect(final.campaign.products.filter(p => p.objective === 'G')).toHaveLength(8);
  expect(final.campaign.products.filter(p => p.objective === 'B')).toHaveLength(8);
  expect(final.campaign.products.filter(p => p.objective === 'E')).toHaveLength(active.length);
  expect(final.campaign.products.every(p => p.sentBits === p.bits)).toBe(true);
  expect(final.campaign.products.every(p => visited.includes(p.sol))).toBe(true);
  expect(final.campaign.events.filter(e => ['E1', 'E2'].includes(e.id)).every(e => e.resolved)).toBe(true);
  expect(scienceSummary(final.campaign).fractions).toEqual({ G: 1, B: 1, E: 1 });
  expect(scienceSummary(final.campaign).sciencePoints).toBe(30);
  expect(final.missionRecord.outcome).toBe('full-success');
  await mkdir('work-logs', { recursive: true });
  await writeFile(`work-logs/expedition-${site}-final.json`, JSON.stringify(final, null, 2));
  await press(page, 'Open mission dossier');
  await press(page, 'Science return');
  await expect(page.locator('.campaign-result')).toContainText(`${getScenario(site).name} / 30-sol mission`);
  await expect(page.locator('.campaign-result')).toContainText('30.00 / 30');
  await page.screenshot({ path: `work-logs/expedition-screenshots/${site}-complete.png`, fullPage: true });
  expect(uncaught).toEqual([]);
});

test('Jezero: world pointer confirms a framed reading and responsive field controls remain usable', async ({ page }) => {
  const uncaught = errors(page);
  await launch(page, 'jezero');
  for (const width of [390, 640, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole('button', { name: 'Commit sol plan', exact: true })).toBeInViewport({ ratio: .5 });
    const badge = page.locator('.mars-world > .model-status');
    if (await badge.isVisible()) {
      await expect.poll(async () => {
        const a = await badge.boundingBox(), b = await page.locator('.field-mission h2').boundingBox();
        if (!a || !b) return 0;
        return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
          * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      }).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: `work-logs/expedition-screenshots/field-final-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 640, height: 700 });
  await press(page, 'Commit sol plan');
  await press(page, /^Log weather/);
  await press(page, 'Compare sensor view');
  await press(page, 'Confirm environmental record');
  await press(page, 'Continue expedition');
  await expect.poll(async () => (await campaign(page)).sol).toBe(2);
  await press(page, 'Commit sol plan');
  await press(page, 'Mast camera');
  await expect(page.getByRole('button', { name: 'Mast camera', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const before = await campaign(page);
  await press(page, /^Begin Mastcam-Z/);
  const progress = page.getByRole('progressbar', { name: 'Confirmed reading points', exact: true });
  await expect(progress).toHaveAttribute('value', '0');
  // In this authored initial pose the mast framing places Delta Front across
  // the left-centre of the canvas. Click the actual mesh, below the DOM anchor
  // and outside the science panel; this exercises production raycasting.
  const canvas = page.getByLabel('Mars rover driving view', { exact: true });
  const box = (await canvas.boundingBox())!;
  const point = { x: box.x + box.width * .3, y: box.y + box.height * .5 };
  await expect.poll(() => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('aria-label'), point)).toBe('Mars rover driving view');
  await page.waitForTimeout(750);
  await page.mouse.click(point.x, point.y);
  await expect(progress).toHaveAttribute('value', '1');
  expect(await campaign(page)).toEqual(before);
  await page.screenshot({ path: 'work-logs/expedition-screenshots/jezero-world-pointer-reading.png', fullPage: true });
  await press(page, 'Cancel observation');
  await expect(progress).toHaveCount(0);
  expect(await campaign(page)).toEqual(before);
  expect(uncaught).toEqual([]);
});

test('D12: native examine and irreversible move-on branches preserve real work and survive save/load', async ({ page }) => {
  const uncaught = errors(page);
  await launch(page, 'jezero');
  await press(page, 'Commit sol plan');
  await drive(page, 'w');
  const leave = async () => {
    await press(page, 'Continue expedition');
    const confirmation = page.getByRole('button', { name: 'Leave for next field sol', exact: true });
    await expect(confirmation).toBeVisible();
    await press(page, 'Leave for next field sol');
  };
  while ((await campaign(page)).sol < 8) {
    if ((await campaign(page)).events.some(event => event.id === 'E1' && !event.resolved)) await press(page, 'Reroute safely');
    await leave();
  }
  await expect.poll(async () => (await campaign(page)).sol).toBe(8);
  // The field decision must be engaged before the primary plan action is shown.
  // Examination itself is free; committing still precedes movement or science.
  await press(page, 'Examine unusual rock');
  await press(page, 'Commit sol plan');
  await poseAt(page, 'jezero-B-2');
  const predecision = await saved(page);
  expect(predecision.state.campaign.events.find(event => event.id === 'D12')?.resolved).toBe(false);
  await mkdir('work-logs', { recursive: true });
  await writeFile('work-logs/expedition-d12-native-predecision.json', JSON.stringify(predecision, null, 2));
  // Canceling the explicit irreversible-choice warning cannot alter the game.
  await press(page, 'Continue expedition');
  await expect(page.getByRole('heading', { name: 'Move on from the unusual rock?', exact: true })).toBeVisible();
  await expect(page.getByRole('alertdialog')).toContainText('3/4 (75%)');
  await press(page, 'Stay and explore');
  expect(await campaign(page)).toEqual(predecision.state.campaign);
  await press(page, 'Examine unusual rock');
  expect(await campaign(page)).toEqual(predecision.state.campaign);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('complementary', { name: 'Field science', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Begin SHERLOC/ })).toBeVisible();
  await page.screenshot({ path: 'work-logs/expedition-screenshots/d12-mobile-examine.png', fullPage: true });
  await observation(page, 'jezero-B-2', 'sherloc', false);
  const partial = await campaign(page);
  expect(partial.events.find(event => event.id === 'D12')?.resolved).toBe(false);
  expect(scienceSummary(partial).fractions.B).toBe(0);
  await page.setViewportSize({ width: 640, height: 700 });
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
  expect(await campaign(page)).toEqual(partial);
  await press(page, 'Examine unusual rock');
  await observation(page, 'jezero-B-2', 'pixl', false);
  const examined = await campaign(page);
  expect(examined.events.find(event => event.id === 'D12')?.resolved).toBe(true);
  expect(examined.completed).toContain('science:jezero-B-2');
  const entries = examined.energy.filter(entry => entry.id.startsWith('activity:jezero-B-2:'));
  expect(entries).toHaveLength(2);
  expect(entries.reduce((sum, entry) => sum + entry.hours, 0)).toBe(3);
  expect(entries.reduce((sum, entry) => sum + entry.requestedWh, 0)).toBeCloseTo(3 * examined.config.baselineW + 98.8, 8);
  expect(examined.products.filter(product => product.id.startsWith('jezero-B-2:')).reduce((sum, product) => sum + product.bits, 0)).toBe(334.8e6);
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
  expect(await campaign(page)).toEqual(examined);
  await writeFile('work-logs/expedition-d12-native-examined.json', JSON.stringify(await saved(page), null, 2));
  // Restore the actual unmodified predecision save to explore the other branch.
  // This is a separate saved playthrough, not undoing a declined choice in-place.
  await page.evaluate(value => { window.name = 'ares-expedition-restoration:' + JSON.stringify(value); }, predecision);
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
  expect(await campaign(page)).toEqual(predecision.state.campaign);
  page.once('dialog', dialog => dialog.dismiss());
  await press(page, 'Move on without sample');
  expect(await campaign(page)).toEqual(predecision.state.campaign);
  page.once('dialog', dialog => dialog.accept());
  await press(page, 'Move on without sample');
  const declined = await campaign(page);
  expect(declined.completed).toContain('declined:jezero-B-2');
  expect(declined.events.find(event => event.id === 'D12')?.resolved).toBe(true);
  expect(declined.events.find(event => event.id === 'D12')?.actionable).toBe(false);
  const recordedDecision = ((await saved(page)).state.missionRecord.events as Array<{ id: string; status: string; recoverable: boolean }>).find(event => event.id === 'D12');
  expect(recordedDecision?.status).toBe('limitation');
  expect(recordedDecision?.recoverable).toBe(false);
  expect(declined.elapsedHours).toBe(predecision.state.campaign.elapsedHours);
  expect(declined.energyWh).toBe(predecision.state.campaign.energyWh);
  expect(declined.energy).toEqual(predecision.state.campaign.energy);
  expect(declined.products).toEqual(predecision.state.campaign.products);
  expect(targetReadiness(declined, 'jezero-B-2').allowed).toBe(false);
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
  expect(await campaign(page)).toEqual(declined);
  await press(page, 'Field notebook');
  await expect(page.getByRole('region', { name: 'Field notebook', exact: true })).toContainText('OPPORTUNITY FORFEITED');
  await press(page, 'Close field panel');
  // B2 shares its physical formation with G2. Declining the biosignature
  // opportunity cannot remove the rock or block an independent geology unit.
  expect(targetReadiness(declined, 'jezero-G-2').allowed).toBe(true);
  await expect(page.getByRole('complementary', { name: 'Field science', exact: true })).toHaveAttribute('data-target-id', 'jezero-G-2');
  await observation(page, 'jezero-G-2', 'mastcam-z', false);
  await observation(page, 'jezero-G-2', 'pixl', false);
  const sharedFormation = await campaign(page);
  expect(sharedFormation.completed).toContain('science:jezero-G-2');
  expect(sharedFormation.completed).toContain('declined:jezero-B-2');
  expect(sharedFormation.products.filter(product => product.id.startsWith('jezero-G-2:'))).toHaveLength(2);
  expect(sharedFormation.products.some(product => product.id.startsWith('jezero-B-2:'))).toBe(false);
  expect(targetReadiness(sharedFormation, 'jezero-B-2').allowed).toBe(false);
  await writeFile('work-logs/expedition-d12-native-declined.json', JSON.stringify(await saved(page), null, 2));
  // The expedition-leave confirmation is another explicit route to the same
  // irreversible decision; exercise its accepted branch from that same save.
  await page.evaluate(value => { window.name = 'ares-expedition-restoration:' + JSON.stringify(value); }, predecision);
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
  expect(await campaign(page)).toEqual(predecision.state.campaign);
  await press(page, 'Continue expedition');
  await expect(page.getByRole('heading', { name: 'Move on from the unusual rock?', exact: true })).toBeVisible();
  await press(page, 'Move on permanently');
  await expect.poll(async () => (await campaign(page)).sol).toBeGreaterThan(8);
  const future = await campaign(page);
  expect(future.completed).toContain('declined:jezero-B-2');
  expect(targetReadiness(future, 'jezero-B-2').allowed).toBe(false);
  expect(future.products.some(product => product.id.startsWith('jezero-B-2:'))).toBe(false);
  await expect(page.getByRole('button', { name: 'Inspect Jezero context rock 2', exact: true })).toHaveCount(0);
  await writeFile('work-logs/expedition-d12-native-forfeited.json', JSON.stringify(await saved(page), null, 2));
  await page.screenshot({ path: 'work-logs/expedition-screenshots/d12-forfeited.png', fullPage: true });
  expect(uncaught).toEqual([]);
});

// Optional diagnostic continuation of a real persisted native playthrough. The
// checkpoint is supplied by the caller; the test never manufactures progression.
// This lets an interrupted software-rendering run prove the normal save/resume
// route without silently claiming that the original timed-out case passed.
if (process.env.ARES_EXPEDITION_CHECKPOINT) test('Jezero: resume the unmodified native Sol 19 autosave and finish the expedition', async ({ page }) => {
  const uncaught = errors(page);
  const checkpoint: SavedGame = JSON.parse(await readFile(process.env.ARES_EXPEDITION_CHECKPOINT!, 'utf8'));
  expect(checkpoint.state.campaign.options.site).toBe('jezero');
  expect(checkpoint.state.campaign.sol).toBe(19);
  expect(checkpoint.state.campaign.history).toHaveLength(18);
  expect(checkpoint.state.campaign.completed).toContain('science:jezero-B-3');
  expect(checkpoint.state.campaign.completed).not.toContain('science:jezero-B-4');
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('ares-expedition-checkpoint-loaded')) {
      localStorage.setItem('ares-01-campaign', JSON.stringify(value));
      sessionStorage.setItem('ares-expedition-checkpoint-loaded', '1');
    }
  }, checkpoint);
  await page.goto('/?quality=low');
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toBeVisible();
  expect(await campaign(page)).toEqual(restoreCampaign(JSON.stringify(checkpoint.state.campaign)));
  expect((await saved(page)).state.missionProgress).toEqual(checkpoint.state.missionProgress);
  for (const instrument of ['sherloc', 'pixl'] as const) {
    if (!checkpoint.state.campaign.completed.includes(`activity:jezero-B-4:${instrument}`)) await observation(page, 'jezero-B-4', instrument, false);
  }
  await press(page, 'Continue expedition');
  await expect.poll(async () => (await campaign(page)).sol).toBe(30);
  expect((await campaign(page)).history.map(h => h.sol)).toEqual(Array.from({ length: 29 }, (_, index) => index + 1));
  await press(page, 'Commit sol plan');
  await press(page, /^Log weather/);
  await press(page, 'Compare sensor view');
  await press(page, 'Confirm environmental record');
  await press(page, 'Continue expedition');
  await expect(page.getByRole('button', { name: 'Open mission dossier', exact: true })).toBeVisible();
  const final = (await saved(page)).state;
  expect(final.campaign.mode).toBe('finished');
  expect(final.campaign.history.map(h => h.sol)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
  expect(final.campaign.products.filter(p => p.objective === 'G')).toHaveLength(8);
  expect(final.campaign.products.filter(p => p.objective === 'B')).toHaveLength(8);
  expect(final.campaign.products.filter(p => p.objective === 'E')).toHaveLength(10);
  expect(final.campaign.products.every(p => p.sentBits === p.bits)).toBe(true);
  expect(new Set(final.campaign.products.map(p => p.id)).size).toBe(final.campaign.products.length);
  expect(scienceSummary(final.campaign).fractions).toEqual({ G: 1, B: 1, E: 1 });
  expect(scienceSummary(final.campaign).sciencePoints).toBe(30);
  expect(final.missionRecord.outcome).toBe('full-success');
  await mkdir('work-logs', { recursive: true });
  await writeFile('work-logs/expedition-jezero-resumed-final.json', JSON.stringify(final, null, 2));
  await press(page, 'Open mission dossier');
  await press(page, 'Science return');
  await expect(page.locator('.campaign-result')).toContainText('Jezero / 30-sol mission');
  await expect(page.locator('.campaign-result')).toContainText('30.00 / 30');
  await page.screenshot({ path: 'work-logs/expedition-screenshots/jezero-resumed-complete.png', fullPage: true });
  expect(uncaught).toEqual([]);
});
