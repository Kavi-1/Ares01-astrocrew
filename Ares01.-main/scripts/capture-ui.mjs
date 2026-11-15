// Task 006 screenshots from real UI navigation only; never writes game stores or outcomes.
// CHROMIUM_PATH=... ARES_UI_ORIGIN=http://127.0.0.1:5181 node scripts/capture-ui.mjs before /tmp/ares-task006/ui-before
// ARES_UI_SCENARIOS=failure,partial-onboard,partial-returned; ARES_UI_STRICT=1 makes recorded overflow/errors fail at the end.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const tag = process.argv[2] ?? 'before';
const directory = path.resolve(process.argv[3] ?? `/tmp/ares-task006/ui-${tag}`);
const origin = process.env.ARES_UI_ORIGIN ?? 'http://127.0.0.1:5181';
const strict = process.env.ARES_UI_STRICT === '1';
const scenarios = (process.env.ARES_UI_SCENARIOS ?? 'failure,partial-onboard,partial-returned').split(',').filter(Boolean);
const viewports = [{ width: 1440, height: 1000 }, { width: 1366, height: 768 }, { width: 820, height: 900 }, { width: 390, height: 900 }];
const result = { tag, origin, environment: { cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, systemMemoryBytes: os.totalmem(), platform: os.platform() },
  screenshots: [], findings: [], pageErrors: [], outcomes: [], homeRendererSamples: [], scope: 'Actual UI only; no store mutation, teleports or outcome injection.',
  unplayed: ['FULL SUCCESS: all three targets were not traversed in this harness.', 'RECOVERABLE ANOMALY: this harness does not configure an anomaly scenario.'] };
await mkdir(directory, { recursive: true });
const record = async () => writeFile(path.join(directory, 'results.json'), JSON.stringify(result, null, 2));
const check = (passed, description, details = {}) => {
  result.findings.push({ passed, description, ...details });
  console.log(JSON.stringify({ passed, description, ...details }));
};
let browser, context, page;
const timeout = 120_000;

async function renderers() {
  return page.evaluate(() => window.__uiAudit.renderers.map(({ ref, ...record }) => ({ ...record, attached: !!ref.deref()?.domElement.isConnected,
    parentClass: ref.deref()?.domElement.parentElement?.className ?? null })));
}

async function capture(label, report = false) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (report) await page.locator('main').evaluate(el => { el.scrollTop = 0; });
    const dimensions = await page.evaluate(() => {
      const main = document.querySelector('main');
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
        mainWidth: main?.clientWidth, mainScrollWidth: main?.scrollWidth, mainHeight: main?.clientHeight, mainScrollHeight: main?.scrollHeight };
    });
    const overflow = dimensions.documentWidth > dimensions.width + 1 || dimensions.bodyWidth > dimensions.width + 1 ||
      (dimensions.mainWidth !== undefined && dimensions.mainScrollWidth > dimensions.mainWidth + 1);
    check(!overflow, `${label} has no horizontal overflow at ${viewport.width}×${viewport.height}`, dimensions);
    const file = path.join(directory, `${label}-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path: file, fullPage: true });
    result.screenshots.push({ label, viewport, file, scroll: 'top', dimensions });
    if (report && dimensions.mainScrollHeight > dimensions.mainHeight + 1) {
      await page.locator('main').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const bottom = path.join(directory, `${label}-${viewport.width}x${viewport.height}-bottom.png`);
      await page.screenshot({ path: bottom, fullPage: true });
      result.screenshots.push({ label, viewport, file: bottom, scroll: 'main bottom' });
    }
    if (!report) result.homeRendererSamples.push({ viewport, renderers: await renderers() });
    await record();
  }
  await page.setViewportSize(viewports[0]);
}

async function launchFromHome() {
  const enter = page.getByRole('button', { name: 'ENTER MISSION CONTROL' });
  await expect(enter).toBeVisible({ timeout });
  await enter.focus();
  check(await enter.evaluate(el => el === document.activeElement), 'Home mission action accepts keyboard focus');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Enter mission control', exact: true }).click();
  await page.getByRole('button', { name: 'Begin workshop', exact: true }).click();
  await page.getByRole('button', { name: 'Review mission', exact: true }).click();
  await page.getByRole('button', { name: 'Approve & launch', exact: true }).click();
  for (const name of ['BEGIN COUNTDOWN', 'CONFIRM LIFTOFF', 'BEGIN MARS APPROACH', 'DEPLOY ROVER']) {
    await page.getByRole('button', { name, exact: false }).click();
  }
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout });
  await expect(page.getByRole('button', { name: 'End mission', exact: true })).toBeVisible({ timeout });
}

async function scanFirstTarget() {
  // Spawn heading is toward -Z, with the first target 10 m ahead. Drive by actual keyboard,
  // stopping when the game's scan affordance appears; neither transforms nor state are changed here.
  await page.keyboard.down('w');
  try { await expect(page.getByRole('button', { name: 'START SCAN', exact: false })).toBeVisible({ timeout: 90_000 }); }
  finally { await page.keyboard.up('w'); }
  await page.keyboard.down('Space');
  try {
    const speed = page.locator('.telemetry > div').filter({ has: page.getByText('ROVER SPEED', { exact: true }) }).locator('b');
    await expect.poll(async () => Math.abs(parseFloat(await speed.innerText())), { timeout: 30_000 }).toBeLessThan(0.5);
  } finally { await page.keyboard.up('Space'); }
  await expect(page.locator('.scan-context')).toContainText('ANCIENT LAKEBED OUTCROP');
  await page.keyboard.press('e');
  await expect(page.getByRole('button', { name: /Uplink · 1/ })).toBeVisible({ timeout: 90_000 });
  check(true, 'First target was reached by keyboard, braked and scanned with E');
}

async function reportFacts() {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const targets = ['Ancient Lakebed Outcrop', 'Basalt Fracture Zone', 'Iron-Rich Ejecta'].map(name => {
      const label = [...main.querySelectorAll('*')].find(el => el.children.length === 0 && el.textContent.trim() === name);
      let container = label?.parentElement;
      for (let level = 0; container && level < 4; level++, container = container.parentElement) {
        if (/RETURNED|NOT COMPLETED|ONBOARD/i.test(container.innerText)) return { name, text: container.innerText };
      }
      return { name, text: label?.parentElement?.innerText ?? null };
    });
    return { heading: main.querySelector('h1')?.innerText, text: main.innerText, targets };
  });
}

async function inspectDossier() {
  // Only the new presentation has sections. Exercise real recorded data without writing it.
  if (!await page.locator('.dossier-navigation').count()) return;
  const saved = await page.evaluate(() => localStorage.getItem('ares-01-campaign'));
  const next = page.getByRole('button', { name: 'Next report section', exact: true });
  await next.focus(); await next.press('Enter');
  await expect(page.locator('#dossier-page-title')).toHaveText('Engineering contribution');
  await expect(page.locator('#dossier-page-title')).toBeFocused();
  await page.locator('summary').filter({ hasText: 'Read the engineering figures' }).click();
  await expect(page.locator('.dossier-details .dossier-data > div')).toHaveCount(10);
  await expect(page.locator('.dossier-details')).toContainText('assumed nominal voltage and efficiency');
  await capture('engineering', true);
  for (const name of ['Events & recovery', 'Model guidance', 'Sources & credits']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('#dossier-page-title')).toHaveText(name);
  }
  await expect(page.locator('#dossier-page')).toContainText('not endorsed by NASA or JPL');
  await capture('sources', true);
  await page.getByRole('button', { name: 'Science return', exact: true }).click();
  check(await page.evaluate(() => localStorage.getItem('ares-01-campaign')) === saved,
    'Reading all dossier sections preserves the recorded campaign and focuses paged content');
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true,
    args: ['--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  result.browser = browser.version();
  result.gpu = (await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')).gpu.devices;
  context = await browser.newContext({ viewport: viewports[0], deviceScaleFactor: 1 });
  page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.on('pageerror', error => result.pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__uiAudit = { renderers: [] };
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
      const renderer = event.detail;
      if (!renderer.isWebGLRenderer) return;
      const sample = { id: window.__uiAudit.renderers.length, ref: new WeakRef(renderer), created: performance.now(), disposed: null, firstModelRender: null, frames: 0 };
      window.__uiAudit.renderers.push(sample);
      const render = renderer.render, dispose = renderer.dispose;
      renderer.render = function (...args) {
        const value = render.apply(this, args); sample.frames++;
        if (sample.firstModelRender === null && args[0].getObjectByName('Imported_Perseverance')) sample.firstModelRender = performance.now();
        return value;
      };
      renderer.dispose = function () { sample.disposed = performance.now(); return dispose.call(this); };
    });
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'ENTER MISSION CONTROL' })).toBeVisible({ timeout });
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout });
  result.homeReadyMs = await page.evaluate(() => performance.now());
  await capture('home');
  const activeIds = result.homeRendererSamples.map(sample => sample.renderers.filter(r => r.disposed === null && r.attached).map(r => r.id).join(','));
  check(activeIds.every(id => id === activeIds[0]), 'Viewport changes retain the existing home renderer', { activeIds });

  for (const scenario of scenarios) {
    if (!['failure', 'partial-onboard', 'partial-returned'].includes(scenario)) throw new Error(`Unsupported real-UI scenario: ${scenario}`);
    await launchFromHome();
    if (scenario !== 'failure') {
      await scanFirstTarget();
      if (scenario === 'partial-returned') await page.getByRole('button', { name: /Uplink · 1/ }).click();
    }
    await page.getByRole('button', { name: 'End mission', exact: true }).click();
    const expected = scenario === 'failure' ? 'MISSION FAILURE' : 'PARTIAL SUCCESS';
    await expect(page.getByRole('heading', { name: expected, exact: true })).toBeVisible({ timeout });
    const facts = await reportFacts();
    check(facts.heading === expected, `${scenario} uses the existing real mission outcome`, { heading: facts.heading });
    const first = facts.targets[0].text ?? '';
    check(scenario === 'failure' ? /NOT COMPLETED/.test(first) : scenario === 'partial-onboard' ? /ONBOARD.*NOT RETURNED/s.test(first) : /RETURNED/.test(first) && !/NOT RETURNED/.test(first),
      `${scenario} distinguishes transmitted records from collected-only observations`, { firstTarget: first });
    result.outcomes.push({ scenario, ...facts, renderers: await renderers() });
    await capture(scenario, true);
    if (scenario === 'failure' && process.env.ARES_UI_DOSSIER === '1') await inspectDossier();
    await page.getByRole('button', { name: 'NEW CAMPAIGN', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ENTER MISSION CONTROL' })).toBeVisible({ timeout });
    check(true, `${scenario} report replay returns to the existing home flow`);
    await record();
  }
  check(result.pageErrors.length === 0, 'No uncaught page errors', { errors: result.pageErrors });
  result.completed = true;
  await record();
  if (strict && result.findings.some(finding => !finding.passed)) throw new Error('Strict UI verification found failures; inspect results.json.');
  console.log(`Captured ${result.screenshots.length} screenshots; ${result.findings.filter(f => !f.passed).length} recorded findings. Full success was not played.`);
} catch (error) {
  result.failure = String(error);
  if (page) await page.screenshot({ path: path.join(directory, 'harness-error.png'), fullPage: true }).catch(() => {});
  await record();
  throw error;
} finally {
  await context?.close();
  await browser?.close();
}
