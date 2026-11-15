// Screenshots of the real player journey, driven only through visible controls.
// Usage: ARES_UI_ORIGIN=http://127.0.0.1:5190 node scripts/capture-journey.mjs <tag> <output-dir> [all|desktop]
// Never writes game stores or outcomes; the surface leg ends through the real Abort dialog.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const tag = process.argv[2] ?? 'after';
const directory = path.resolve(process.argv[3] ?? `/tmp/ares-journey-${tag}`);
const origin = process.env.ARES_UI_ORIGIN ?? 'http://127.0.0.1:5190';
const all = (process.argv[4] ?? 'all') === 'all';
const viewports = all
  ? [{ width: 1440, height: 1000 }, { width: 1366, height: 768 }, { width: 820, height: 900 }, { width: 390, height: 900 }]
  : [{ width: 1440, height: 1000 }];
const timeout = 120_000;
const result = { tag, origin, shots: [], overflow: [], errors: [] };
await mkdir(directory, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: viewports[0], deviceScaleFactor: 1 })).newPage();
page.on('pageerror', error => result.errors.push(error.message));

async function shot(label, settle = 900) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(settle);
    const size = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, inner: innerWidth }));
    if (size.doc > size.inner + 1) result.overflow.push({ label, viewport, ...size });
    // JPEG keeps the documentation set small; pass ARES_SHOT_FORMAT=png for lossless captures.
    const jpeg = (process.env.ARES_SHOT_FORMAT ?? 'jpeg') === 'jpeg';
    const file = path.join(directory, `${label}-${viewport.width}.${jpeg ? 'jpg' : 'png'}`);
    await page.screenshot(jpeg ? { path: file, type: 'jpeg', quality: 82 } : { path: file });
    result.shots.push(file);
  }
  await page.setViewportSize(viewports[0]);
}
const click = (name, exact = true) => page.getByRole('button', { name, exact }).click();

try {
  await page.goto(origin);
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', /ready|fallback/, { timeout });
  await shot('01-welcome');
  await click('ENTER MISSION CONTROL', false);
  await expect(page.getByRole('region', { name: 'Choose your crew member' })).toBeVisible();
  await expect(page.locator('.room-status')).toHaveCount(0, { timeout });
  await shot('02-crew-select', 2500);
  await page.getByRole('button', { name: /^Aaryan / }).click();
  await shot('03-crew-select-aaryan', 2500);
  await click('Enter mission control');
  await expect(page.getByRole('region', { name: 'Science briefing' })).toBeVisible();
  await shot('04-briefing', 2500);
  await click('Begin workshop');
  await expect(page.locator('.room-canvas')).toHaveAttribute('data-rover-status', /ready|fallback/, { timeout });
  await shot('05-workshop', 2500);
  await click('Payload workshop YOUR STATION');
  await shot('06-payload', 2500);
  await click('Inspect SuperCam');
  await shot('07-payload-inspect', 2500);
  await click('Power station Houssam');
  await shot('08-power-proposal', 2500);
  await click('Take over');
  await shot('09-power-direct', 1200);
  await click('Communications Huzaifa');
  await shot('10-communications', 2500);
  await click('Review mission');
  await expect(page.getByRole('heading', { name: 'Flight readiness review', exact: true })).toBeVisible();
  await shot('11-review', 2500);
  await click('Approve & launch');
  await expect(page.getByRole('button', { name: 'BEGIN COUNTDOWN' })).toBeVisible();
  await shot('12-launch-pad', 1200);
  await click('BEGIN COUNTDOWN', false);
  await click('CONFIRM LIFTOFF', false);
  await page.waitForTimeout(1200);
  await shot('13-launch-ascent', 0);
  await click('BEGIN MARS APPROACH', false);
  await shot('14-launch-arrival', 800);
  await click('DEPLOY ROVER', false);
  await expect(page.getByRole('button', { name: 'End mission', exact: true })).toBeVisible({ timeout });
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', /ready|fallback/, { timeout });
  await shot('15-mars', 2500);
  await page.keyboard.down('w'); await page.waitForTimeout(4000);
  await shot('16-mars-driving', 0);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await shot('17-mars-paused', 600);
  await page.keyboard.press('Escape');
  await click('Abort');
  await shot('18-mars-abort-dialog', 600);
  await click('Abort mission');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await shot('19-report', 900);
  await click('Engineering');
  await shot('20-report-engineering', 600);
} catch (error) {
  result.errors.push(String(error));
  await page.screenshot({ path: path.join(directory, 'zz-failure.png') }).catch(() => {});
} finally {
  await writeFile(path.join(directory, 'results.json'), JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ shots: result.shots.length, overflow: result.overflow, errors: result.errors }, null, 2));
if (result.errors.length) process.exitCode = 1;
