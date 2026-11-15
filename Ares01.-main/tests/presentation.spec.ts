import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const screenshots = '/tmp/ares-task006/ui-fixtures';
const sizes = [{ width: 390, height: 900 }, { width: 820, height: 900 }, { width: 1366, height: 768 }, { width: 1440, height: 1000 }];
const outcomes = {
  'full-success': 'FULL SUCCESS',
  'partial-success': 'PARTIAL SUCCESS',
  'recoverable-anomaly': 'RECOVERABLE ANOMALY',
  'mission-failure': 'MISSION FAILURE',
  'mission-abort': 'MISSION ABORT',
};
type FixtureOptions = { outcome?: keyof typeof outcomes | null; missingRecord?: boolean; missingProgress?: boolean; longText?: boolean; populatedMission?: boolean };

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  expect(await page.locator('main').evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth + 1))).toBeTruthy();
}

async function reportHarness(page: Page) {
  // This response exists only inside Playwright. It does not write outcomes into a game store.
  await page.route('**/presentation-fixture', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><meta charset="utf-8"><div role="note" data-testid="fixture-banner" style="padding:12px 16px;background:#fff2b5;color:#202124;font:600 14px/1.5 sans-serif">PRESENTATION FIXTURE — synthetic view inputs, not a played mission or production outcome.</div><div id="fixture-root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`,
  }));
  await page.goto('/presentation-fixture');
  await page.waitForFunction(() => (window as any).__vite_plugin_react_preamble_installed__);
  await page.evaluate(async () => {
    const w = window as any, source = await (await fetch('/src/main.tsx')).text();
    const reactPath = source.match(/from "([^"]*\/react.js[^\"]*)"/)![1];
    const domPath = source.match(/from "([^"]*react-dom_client[^\"]*)"/)![1];
    // Match the application font/base-style order without importing main.tsx or starting the game.
    for (const match of source.matchAll(/^import\s+["']([^"']+)["'];?\s*$/gm)) await import(match[1]);
    const React = (await import(reactPath)).default, dom = await import(domPath);
    const View = (await import('/src/game/MissionReport.tsx')).MissionReportView;
    const root = (dom.createRoot ?? dom.default.createRoot)(document.querySelector('#fixture-root'));
    w.fixtureRestartCount = 0; w.fixtureRevision = 0;
    w.renderReportFixture = (options: FixtureOptions = {}) => {
      const outcome = options.outcome === undefined ? 'partial-success' : options.outcome;
      const returned = outcome === 'full-success' ? ['ancient-outcrop', 'basalt-fracture', 'iron-ejecta'] : outcome === 'partial-success' ? ['ancient-outcrop'] : [];
      const scanned = outcome === 'full-success' ? [...returned] : ['ancient-outcrop', 'basalt-fracture'];
      const reason = options.longText ? `Fixture-only long recorded explanation: ${'LongUnbrokenRecordValue'.repeat(18)}` : 'Presentation fixture only: the supplied outcome was not simulated.';
      const event = {
        id: 'presentation-fixture-event', kind: 'communication-backlog', title: `Fixture-only recorded event ${'LongEventTitle'.repeat(14)}`,
        trigger: 'Fixture-only trigger text.', explanation: `Fixture-only long explanation ${'LongUnbrokenExplanation'.repeat(18)}`,
        model: 'Fixture-only provenance text; not scientific evidence.', recoverable: true,
        status: outcome === 'recoverable-anomaly' ? 'active' : 'recovered', recovery: 'Fixture-only recorded recovery text.', sol: 1,
      };
      const record = options.missingRecord ? null : {
        events: options.longText || outcome === 'recoverable-anomaly' ? [event] : [], transmittedTargets: returned,
        safeMode: false, mobilityReplanned: false, ended: outcome !== null, outcome,
        endReason: outcome === null ? '' : reason, rewardApplied: outcome !== null,
      };
      const progress = options.missingProgress ? null : { scannedTargets: scanned };
      // Deliberately synthetic display inputs, not NASA data or an evaluated configuration.
      // Distinct values catch swapped/omitted report fields without invoking an engine/store.
      const mission = options.populatedMission ? {
        config: { instruments: ['mastcam-z', 'rimfax'], reserve: .3, downlink: 'UHF', moxieRun: false, baselineW: 75, scienceCadence: 1 },
        results: {
          massKg: 1234.5, netWh: -678.4, massMarginKg: -209.5, genWh: 2101.1,
          baseWh: 1802.2, activityWh: 303.3, eNominalWh: 2404.4, eUsableWh: 1605.5,
          eDeliveredWh: 1506.6, peakW: 707.7, dataMbit: 808.8, linkMbit: 909.9,
          rtgW: 101.2, projectedSoc: .45, selected: ['mastcam-z', 'rimfax'],
          issues: ['Fixture-only constraint — do not treat as a real engineering failure.'],
          warnings: ['Fixture-only warning — these values are synthetic display inputs.'],
        },
      } : null;
      w.fixtureInputs = { record, mission, progress };
      w.fixtureBefore = JSON.stringify(w.fixtureInputs);
      const revision = ++w.fixtureRevision;
      root.render(React.createElement('div', { 'data-fixture-revision': revision }, React.createElement(View, { ...w.fixtureInputs, key: revision, onRestart: () => { w.fixtureRestartCount++; } })));
      return revision;
    };
  });
}

async function renderReport(page: Page, options: FixtureOptions = {}) {
  const revision = await page.evaluate(options => (window as any).renderReportFixture(options), options);
  await expect(page.locator(`[data-fixture-revision="${revision}"]`)).toBeVisible();
  await expect(page.locator('.mission-report')).toBeVisible();
  await expect(page.getByTestId('fixture-banner')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Open mission dossier', exact: true }).click();
}

test('welcome notes preserve the Three.js canvas and keyboard entry keeps the existing crew flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.welcome-screen')).toBeVisible();
  await expect(page.locator('.is-welcome .mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout: 120000 });
  const canvas = page.locator('.mars-world canvas');
  await canvas.evaluate(element => element.setAttribute('data-presentation-canvas', 'original'));
  const notes = page.locator('.welcome-screen summary').filter({ hasText: 'Sources & project notes' });
  await notes.focus(); await page.keyboard.press('Enter');
  await expect(notes.locator('..')).toHaveAttribute('open', '');
  await expect(canvas).toHaveAttribute('data-presentation-canvas', 'original');
  await expect(page.locator('.welcome-screen')).toContainText('ASTROCREW');
  await expect(page.locator('.welcome-screen')).toContainText(/not endorsed/i);
  await page.keyboard.press('Enter');
  await expect(notes.locator('..')).not.toHaveAttribute('open', '');
  const enter = page.getByRole('button', { name: 'ENTER MISSION CONTROL' });
  await enter.focus();
  expect(await enter.evaluate(element => element.matches(':focus-visible'))).toBeTruthy();
  await enter.press('Enter');
  await expect(page.getByRole('region', { name: 'Choose your crew member' })).toBeVisible();
});

test('welcome remains responsive with reduced motion, valid actions and visible focus', async ({ page }) => {
  await mkdir(screenshots, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout: 120000 });
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: 'ENTER MISSION CONTROL' })).toBeVisible();
    expect(await page.locator('#welcome-title').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(43);
    expect(await page.locator('.welcome-description').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(11);
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `${screenshots}/welcome-live-${size.width}.png`, fullPage: true });
    const notes = page.locator('.welcome-screen summary').filter({ hasText: 'Sources & project notes' });
    await notes.click(); await noHorizontalOverflow(page);
    await expect(page.getByRole('button', { name: 'ENTER MISSION CONTROL' })).toBeVisible();
    await notes.click();
  }
  await expect(page.getByRole('button', { name: /^(quit|exit)$/i })).toHaveCount(0);
  expect(await page.locator('.welcome-screen').evaluate(root => [...root.querySelectorAll('*')].every(element => getComputedStyle(element).animationName === 'none'))).toBeTruthy();
});

test.describe('touch welcome presentation', () => {
  test.use({ viewport: { width: 390, height: 900 }, hasTouch: true });
  test('native notes and mission entry accept touch without replacing the world canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout: 120000 });
    const canvas = page.locator('.mars-world canvas');
    await canvas.evaluate(element => element.setAttribute('data-presentation-canvas', 'touch-original'));
    const notes = page.locator('.welcome-screen summary').filter({ hasText: 'Sources & project notes' });
    await notes.tap(); await expect(notes.locator('..')).toHaveAttribute('open', '');
    await expect(canvas).toHaveAttribute('data-presentation-canvas', 'touch-original');
    await noHorizontalOverflow(page);
    await notes.tap(); await expect(notes.locator('..')).not.toHaveAttribute('open', '');
    await expect(canvas).toHaveAttribute('data-presentation-canvas', 'touch-original');
    await page.getByRole('button', { name: 'ENTER MISSION CONTROL' }).tap();
    await expect(page.getByRole('region', { name: 'Choose your crew member' })).toBeVisible();
  });
});

for (const [outcome, label] of Object.entries(outcomes)) test(`presentation fixture preserves existing outcome label: ${label}`, async ({ page }) => {
  await reportHarness(page); await renderReport(page, { outcome: outcome as keyof typeof outcomes });
  await expect(page.locator('.dossier-stamp b')).toContainText(label);
  await expect(page.getByRole('button', { name: 'NEW CAMPAIGN', exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.mission-report')).not.toContainText(/\b100-point score\s*[:=]\s*\d|\b\d+\s*\/\s*100\b/i);
});

test('report separates returned observations from onboard scans and preserves the existing 25 RP award', async ({ page }) => {
  await reportHarness(page); await renderReport(page, { outcome: 'partial-success' });
  await expect(page.locator('.report-row').filter({ hasText: 'Ancient Lakebed Outcrop' }).getByText('RETURNED', { exact: true })).toBeVisible();
  await expect(page.locator('.report-row').filter({ hasText: 'Basalt Fracture Zone' }).getByText('ONBOARD · NOT RETURNED', { exact: true })).toBeVisible();
  await expect(page.locator('.report-row').filter({ hasText: 'Iron-Rich Ejecta' }).getByText('NOT COMPLETED', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 3 target records returned · campaign award +25 RP.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify((window as any).fixtureInputs) === (window as any).fixtureBefore)).toBeTruthy();
});

test('synthetic engineering fixture preserves all summary/detail figures, constraints and provenance without mutation', async ({ page }) => {
  await reportHarness(page); await renderReport(page, { populatedMission: true });
  const saved = await page.evaluate(() => localStorage.getItem('ares-01-campaign'));
  await page.getByRole('button', { name: 'Engineering', exact: true }).click();
  await expect(page.locator('.dossier-configuration')).toHaveText('Mastcam-Z · RIMFAX');
  const summaryRows = page.locator('#dossier-page > .dossier-data > div');
  await expect(summaryRows).toHaveCount(4);
  for (const [label, value] of [
    ['Modeled rover mass', '1234.5 kg'], ['Daily energy balance', '-678 Wh/sol'],
    ['Chosen battery reserve', '30%'], ['Downlink strategy', 'UHF'],
  ]) await expect(summaryRows.filter({ hasText: label }).locator('dd')).toHaveText(value);
  await expect(summaryRows.filter({ hasText: 'Modeled rover mass' }).locator('small')).toHaveText('CALC');
  await expect(summaryRows.filter({ hasText: 'Daily energy balance' }).locator('small')).toHaveText('CALC / ASSUMED SCHEDULE');
  await expect(summaryRows.filter({ hasText: 'Chosen battery reserve' }).locator('small')).toHaveText('ASSUMED POLICY');
  await expect(page.getByText('Constraint: Fixture-only constraint — do not treat as a real engineering failure.', { exact: true })).toBeVisible();
  await expect(page.getByText('Design note: Fixture-only warning — these values are synthetic display inputs.', { exact: true })).toBeVisible();
  const detailToggle = page.locator('summary').filter({ hasText: 'Read the engineering figures' });
  await detailToggle.focus(); await detailToggle.press('Enter');
  await expect(page.locator('.dossier-details')).toContainText('Battery energy also uses assumed nominal voltage and efficiency; the actual Mars 2020 values are not established in this model.');
  const detailRows = page.locator('.dossier-details .dossier-data > div');
  await expect(detailRows).toHaveCount(10);
  for (const [label, value] of [
    ['Mass margin', '-209.5 kg'], ['MMRTG generation', '2101.1 Wh/sol'],
    ['Baseline load', '1802.2 Wh/sol'], ['Science activity load', '303.3 Wh/sol'],
    ['Nominal battery energy', '2404.4 Wh'], ['Usable battery energy', '1605.5 Wh'],
    ['Delivered battery energy', '1506.6 Wh'], ['Modeled peak load', '707.7 W'],
    ['Payload data-volume proxy', '808.8 Mbit'], ['Idealized link capacity', '909.9 Mbit/sol'],
  ]) await expect(detailRows.filter({ hasText: label }).locator('dd')).toHaveText(value);
  for (const size of sizes) { await page.setViewportSize(size); await noHorizontalOverflow(page); }
  expect(await page.evaluate(() => JSON.stringify((window as any).fixtureInputs) === (window as any).fixtureBefore)).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem('ares-01-campaign'))).toBe(saved);
});

test('missing report or outcome stays unavailable instead of inventing a mission result', async ({ page }) => {
  await reportHarness(page);
  for (const fixture of [{ missingRecord: true, missingProgress: true }, { outcome: null, missingProgress: true }] satisfies FixtureOptions[]) {
    await renderReport(page, fixture);
    await expect(page.getByRole('heading', { level: 1, name: 'REPORT UNAVAILABLE', exact: true })).toBeVisible();
    await expect(page.locator('.mission-report h1')).not.toHaveText(/FULL SUCCESS|PARTIAL SUCCESS|MISSION FAILURE|MISSION ABORT|RECOVERABLE ANOMALY/);
    await page.getByRole('button', { name: 'Engineering', exact: true }).click();
    await expect(page.locator('#dossier-page')).toContainText(/No confirmed configuration/);
    await noHorizontalOverflow(page);
  }
});

test('dossier navigation and replay are keyboard operable without mutating supplied records or campaign storage', async ({ page }) => {
  await reportHarness(page); await renderReport(page);
  const saved = await page.evaluate(() => localStorage.getItem('ares-01-campaign'));
  await page.setViewportSize({ width: 390, height: 900 });
  const next = page.getByRole('button', { name: 'Next report section', exact: true });
  await next.focus(); await next.press('Enter');
  await expect(page.locator('#dossier-page-title')).toHaveText('Engineering contribution');
  await expect(page.locator('#dossier-page-title')).toBeFocused();
  expect(await page.locator('#dossier-page-title').evaluate(element => {
    const bounds = element.getBoundingClientRect(); return bounds.top >= 0 && bounds.bottom <= innerHeight;
  })).toBeTruthy();
  const previous = page.getByRole('button', { name: 'Previous report section', exact: true });
  await previous.focus(); await previous.press('Enter');
  await expect(page.locator('#dossier-page-title')).toHaveText('Science return');
  await expect(page.locator('#dossier-page-title')).toBeFocused();
  const science = page.getByRole('button', { name: 'Science return', exact: true });
  await science.focus(); await page.keyboard.press('Tab');
  const engineering = page.getByRole('button', { name: 'Engineering', exact: true });
  await expect(engineering).toBeFocused();
  expect(await engineering.evaluate(element => element.matches(':focus-visible') && getComputedStyle(element).outlineStyle !== 'none')).toBeTruthy();
  await page.keyboard.press('Enter');
  await expect(engineering).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#dossier-page-title')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#dossier-page-title')).toHaveAttribute('aria-atomic', 'true');
  await expect(page.locator('#dossier-page-title')).toHaveText('Engineering contribution');
  await engineering.focus(); await page.keyboard.press('Tab');
  const events = page.getByRole('button', { name: 'Events & recovery', exact: true });
  await expect(events).toBeFocused(); await page.keyboard.press('Enter');
  await expect(events).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#dossier-page-title')).toHaveText('Events & recovery');
  for (const name of ['Model guidance', 'Sources & credits']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.focus(); await button.press('Enter');
    await expect(button).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#dossier-page')).toBeVisible();
  }
  await expect(page.locator('#dossier-page')).toContainText(/not endorsed/i);
  await page.getByRole('button', { name: 'NEW CAMPAIGN', exact: true }).focus(); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as any).fixtureRestartCount)).toBe(1);
  expect(await page.evaluate(() => JSON.stringify((window as any).fixtureInputs) === (window as any).fixtureBefore)).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem('ares-01-campaign'))).toBe(saved);
});

test('explicit report fixtures handle long records, reduced motion and four responsive widths', async ({ page }) => {
  await mkdir(screenshots, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await reportHarness(page);
  for (const outcome of ['full-success', 'partial-success', 'mission-failure'] as const) {
    for (const size of sizes) {
      await page.setViewportSize(size); await renderReport(page, { outcome, longText: true });
      await noHorizontalOverflow(page);
      await expect(page.locator('.dossier-stamp b')).toContainText(outcomes[outcome]);
      await page.screenshot({ path: `${screenshots}/report-fixture-${outcome}-${size.width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Events & recovery', exact: true }).click();
      await expect(page.locator('#dossier-page')).toContainText('Fixture-only recorded event');
      await noHorizontalOverflow(page);
      await page.getByRole('button', { name: 'Sources & credits', exact: true }).click();
      await noHorizontalOverflow(page);
    }
  }
  expect(await page.locator('.mission-report').evaluate(root => [...root.querySelectorAll('*')].every(element => getComputedStyle(element).animationName === 'none'))).toBeTruthy();
});


test('desk opens the recorded dossier and returns keyboard focus without changing results', async ({ page }) => {
  await reportHarness(page); await renderReport(page, { outcome: 'full-success' });
  await expect(page.locator('.dossier-outcome h1')).toBeFocused();
  await page.getByRole('button', { name: '[ RETURN TO DESK ]', exact: true }).click();
  const folder = page.getByRole('button', { name: 'Open mission dossier', exact: true });
  await expect(folder).toBeFocused();
  await expect(page.locator('.desk-status')).toHaveText('FULL SUCCESS');
  await expect(page.locator('.desk-footer')).toContainText('3 OF 3 TARGET RECORDS RETURNED');
  for (const size of sizes) {
    await page.setViewportSize(size); await noHorizontalOverflow(page);
    await expect(folder).toBeVisible();
    await page.screenshot({ path: `${screenshots}/desk-${size.width}.png`, fullPage: true });
  }
  await folder.press('Enter');
  await expect(page.locator('.dossier-outcome h1')).toBeFocused();
  expect(await page.evaluate(() => JSON.stringify((window as any).fixtureInputs) === (window as any).fixtureBefore)).toBeTruthy();
  expect(await page.evaluate(() => (window as any).fixtureRestartCount)).toBe(0);
});

test('failure opens recorded incidents first, with available science kept on a separate page', async ({ page }) => {
  await reportHarness(page); await renderReport(page, { outcome: 'mission-failure', longText: true });
  await expect(page.locator('#dossier-page-title')).toHaveText('Events & recovery');
  await expect(page.locator('.report-event')).toContainText('Fixture-only trigger text.');
  await expect(page.locator('.dossier-reason')).toContainText('Fixture-only long recorded explanation');
  await expect(page.locator('.dossier-tape')).toHaveCSS('background-image', /repeating-linear-gradient/);
  await page.getByRole('button', { name: 'Science return', exact: true }).click();
  await expect(page.locator('.dossier-return-summary')).toContainText('0 of 3 target records returned');
  expect(await page.evaluate(() => JSON.stringify((window as any).fixtureInputs) === (window as any).fixtureBefore)).toBeTruthy();
});

test('welcome fallback keeps controls, notes and keyboard entry usable across four widths', async ({ page }) => {
  await mkdir(screenshots, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Explicit missing-asset scenario, separate from the original real-model tests.
  await page.route('**/*.glb', route => route.fulfill({ status: 404, body: 'Missing asset fixture' }));
  await page.goto('/');
  const canvas = page.locator('.mars-world canvas');
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'fallback');
  await canvas.evaluate(el => el.setAttribute('data-redesign-canvas', 'same'));
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: 'ENTER MISSION CONTROL', exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
    const controls = page.getByRole('button', { name: /MISSION CONTROLS/ });
    await controls.click();
    await expect(controls).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#welcome-controls')).toContainText('Uplink');
    await controls.click();
    const notes = page.locator('.welcome-notes summary');
    await notes.focus(); await notes.press('Enter');
    await expect(page.locator('.welcome-notes')).toHaveAttribute('open', '');
    await expect(page.locator('.welcome-notes-content:visible')).toContainText('not endorsed');
    await noHorizontalOverflow(page);
    await notes.press('Enter');
    await expect(canvas).toHaveAttribute('data-redesign-canvas', 'same');
  }
  const enter = page.getByRole('button', { name: 'ENTER MISSION CONTROL', exact: true });
  await enter.focus(); await enter.press('Enter');
  await expect(page.getByRole('region', { name: 'Choose your crew member' })).toBeVisible();
});

test('capture reference comparison views with explicitly labeled presentation fixtures', async ({ page }) => {
  await mkdir(screenshots, { recursive: true });
  await reportHarness(page);
  for (const outcome of ['full-success', 'partial-success', 'mission-failure'] as const) {
    for (const size of sizes) {
      await page.setViewportSize(size);
      await renderReport(page, { outcome });
      await expect(page.locator('.dossier-stamp b')).toContainText(outcomes[outcome]);
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${screenshots}/reference-${outcome}-${size.width}.png`, fullPage: true });
      await page.locator('.mission-report').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.screenshot({ path: `${screenshots}/reference-${outcome}-${size.width}-bottom.png`, fullPage: true });
    }
  }
});
