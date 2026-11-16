import { test, expect, type Page } from '@playwright/test';

// Interaction checks for the redesigned presentation. Every expected figure is read from the
// existing store or engineering model in the page; nothing here writes a mission outcome.
const state = (page: Page) => page.evaluate(async () => {
  const s = (await import('/src/store/gameStore.ts')).useGameStore.getState();
  return { seat: s.selectedCrewId, stage: s.preparation.stage, config: s.roverConfig, confirmed: s.confirmedMission };
});
const model = (page: Page, patch: Record<string, unknown> = {}) => page.evaluate(async patch => {
  const { calculateEngineering } = await import('/src/nasa/engineering.ts');
  const { useGameStore } = await import('/src/store/gameStore.ts');
  return calculateEngineering({ ...useGameStore.getState().roverConfig, ...patch });
}, patch);
const format = (value: number, digits = 0) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

async function enterWorkshop(page: Page, seat = 'Kavi') {
  await page.goto('/');
  // These checks cover engineering/mission controls; the dedicated tutorial
  // suite tests Guided, whose Escape key intentionally dismisses its note.
  const skip=page.getByRole('radio',{name:'Skip',exact:true});
  if(await skip.isVisible())await skip.check();
  await page.getByRole('button', { name: 'ENTER MISSION CONTROL' }).click();
  if (seat !== 'Kavi') await page.getByRole('button', { name: new RegExp('^' + seat + ' ') }).click();
  await page.getByRole('button', { name: 'Enter mission control', exact: true }).click();
  await page.getByRole('button', { name: 'Begin workshop', exact: true }).click();
}

test('seat selection: arrow keys, rail and dossier stay in step with the selected seat', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'ENTER MISSION CONTROL' }).click();
  const seats = page.getByRole('region', { name: 'Choose your crew member' });
  await expect(seats.getByRole('heading', { name: 'Kavi', exact: true })).toBeVisible();
  // Portraits are decorative, so each seat is named by its crew member and role only.
  await expect(page.getByRole('button', { name: 'Kavi Mission Director', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('ArrowRight');
  await expect(seats.getByRole('heading', { name: 'Aaryan', exact: true })).toBeVisible();
  expect((await state(page)).seat).toBe('aaryan');
  await expect(page.getByRole('button', { name: /^Aaryan / })).toHaveAttribute('aria-pressed', 'true');
  await expect(seats).toContainText('Payload workshop');
  await expect(seats).toContainText('You set this decision directly.');

  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  expect((await state(page)).seat).toBe('rihabe');
  await expect(seats).toContainText('Advisory seat.');
  await page.getByRole('button', { name: 'Next crew member', exact: true }).click();
  expect((await state(page)).seat).toBe('kavi');
  await page.getByRole('button', { name: /^Huzaifa / }).click();
  await expect(seats.getByRole('heading', { name: 'Huzaifa', exact: true })).toBeVisible();
  await expect(seats).toContainText('Communications');
  expect((await state(page)).stage).toBe('entry');

  for (const width of [390, 820, 1366]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Enter mission control', exact: true })).toBeVisible();
    await expect(seats.getByRole('heading', { name: 'Huzaifa', exact: true })).toBeVisible();
  }
});

test('mission margins mirror the engineering model, preview pending edits and confirm applied ones', async ({ page }) => {
  await enterWorkshop(page, 'Houssam');
  const rail = page.getByRole('complementary', { name: 'Mission margins' });
  const current = await model(page);
  const baselineConfig = (await state(page)).config;
  await expect(rail).toContainText('CURRENT PLAN');
  await expect(rail).toContainText(format(current.massKg, 1));
  await expect(rail).toContainText(format(current.eDeliveredWh));
  await expect(rail).toContainText(`${format(current.dataMbit, 1)}`);
  await expect(rail).toContainText(`/ ${format(current.linkMbit, 1)} Mbit`);

  await page.getByRole('button', { name: 'Power station YOUR STATION', exact: true }).click();
  await page.getByLabel('Battery reserve', { exact: true }).selectOption('0.4');
  const pending = await model(page, { reserve: .4 });
  await expect(rail).toContainText('PREVIEW');
  await expect(rail).toContainText(`→ ${format(pending.eDeliveredWh)}`);
  // A preview never changes the plan.
  expect((await state(page)).config).toEqual(baselineConfig);
  await expect(rail).toContainText(format(current.eDeliveredWh));

  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  expect((await state(page)).config.reserve).toBe(.4);
  await expect(rail).toContainText('CURRENT PLAN');
  await expect(rail).not.toContainText('→');
  await expect(rail).toContainText(format(pending.eDeliveredWh));
  await expect(page.getByRole('status').filter({ hasText: 'Changes applied to the mission plan.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Power station YOUR STATION · REVIEWED', exact: true })).toBeVisible();

  // A failing hard check is reported from the model, not styled away.
  await page.evaluate(async () => { const s = (await import('/src/store/gameStore.ts')).useGameStore.getState(); s.setRoverConfig({ ...s.roverConfig, baselineW: 950 }); });
  await expect(rail).toContainText('1 hard check failing');
});

test('launch manifest and surface instruments show the confirmed mission', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await enterWorkshop(page);
  await page.getByRole('button', { name: 'Power station Houssam', exact: true }).click();
  await page.getByRole('button', { name: 'Take over', exact: true }).click();
  await page.getByLabel('Battery reserve', { exact: true }).selectOption('0.3');
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await page.getByRole('button', { name: 'Review mission', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Station decisions' })).toContainText('YOUR CONTROL');
  await page.getByRole('button', { name: 'Approve & launch', exact: true }).click();

  const confirmed = (await state(page)).confirmed!;
  const manifest = page.locator('.launch-manifest');
  await expect(manifest).toContainText(confirmed.results.massKg.toFixed(1));
  await expect(manifest).toContainText(`${confirmed.config.instruments.length} / 7`);
  await expect(manifest).toContainText('30%');
  await expect(manifest).toContainText(confirmed.config.downlink);
  await expect(page.getByRole('list', { name: 'Flight stages' }).locator('[aria-current="step"]')).toContainText('PAD CHECKOUT');

  for (const name of ['BEGIN COUNTDOWN', 'CONFIRM LIFTOFF', 'BEGIN MARS APPROACH', 'DEPLOY ROVER']) await page.getByRole('button', { name }).click();
  await expect(page.getByRole('button', { name: 'Continue expedition', exact: true })).toBeVisible();
  expect(await page.locator('.field-battery b').evaluate(element => (element as HTMLElement).style.left)).toBe('30%');
  const surface = await page.evaluate(async () => {
    const s = (await import('/src/store/gameStore.ts')).useGameStore.getState();
    const { scenarioTargets } = await import('/src/data/scenarios.ts');
    return { campaign: s.campaign!, targets: scenarioTargets(s.campaign!.options.site) };
  });
  expect(surface.campaign.config).toEqual(confirmed.config);
  expect(surface.campaign.config.reserve).toBe(.3);
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toHaveAttribute('data-active-sol', '1');
  await expect(page.getByRole('complementary', { name: 'Field mission', exact: true })).toContainText('SOL 1 / 30');
  await expect(page.getByRole('button', { name: /^Log weather/ })).toContainText('0/10 sols');
  // The canonical campaign replaced the old three-marker demo with four
  // geology and four co-located context bundles, released on specific sols.
  expect(surface.targets).toHaveLength(8);
  expect(surface.targets.filter(t => t.objective === 'G').map(t => t.availableSol)).toEqual([2, 5, 12, 16]);
  expect(surface.targets.filter(t => t.objective === 'B').map(t => t.availableSol)).toEqual([3, 8, 17, 19]);

  // Pause is a real state change, not a cosmetic overlay.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: /MISSION\s*PAUSED\./ })).toBeVisible();
  expect(await page.evaluate(async () => (await import('/src/store/marsStore.ts')).useMarsStore.getState().phase)).toBe('paused');
  await page.getByRole('button', { name: /RESUME MISSION/ }).click();
  expect(await page.evaluate(async () => (await import('/src/store/marsStore.ts')).useMarsStore.getState().phase)).toBe('active');
  expect(errors).toEqual([]);
});
