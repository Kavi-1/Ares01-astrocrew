// Frame-rate and render-load samples for the room, launch pad and Mars surface.
// Usage: ARES_UI_ORIGIN=http://127.0.0.1:4173 node scripts/measure-scenes.mjs <label> <output.json>
// Drives only visible controls. The Three.js devtools hook is read-only: it counts frames and
// reads renderer.info; it does not change scenes, quality settings or game state.
// Headless Chromium here renders with SwiftShader (software), so absolute FPS is far below any
// real GPU. Use these numbers to compare two builds on the same host, never as hardware claims.
import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';

const label = process.argv[2] ?? 'build';
const output = process.argv[3] ?? `/tmp/ares-measure-${label}.json`;
const origin = process.env.ARES_UI_ORIGIN ?? 'http://127.0.0.1:4173';
const timeout = 180_000;
const result = { label, origin, host: { cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, platform: os.platform() }, renderer: null, scenes: [], errors: [] };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  const probe = window.__aresProbe = { renderers: [] };
  window.__THREE_DEVTOOLS__ = new EventTarget();
  window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
    const object = event.detail;
    if (!object?.isWebGLRenderer) return;
    const record = { ref: new WeakRef(object), disposed: false, stamps: [], calls: 0, triangles: 0 };
    probe.renderers.push(record);
    const render = object.render, dispose = object.dispose;
    object.render = function (...args) {
      record.stamps.push(performance.now());
      const value = render.apply(this, args);
      record.calls = this.info.render.calls; record.triangles = this.info.render.triangles;
      return value;
    };
    object.dispose = function () { record.disposed = true; return dispose.call(this); };
  });
});
const page = await context.newPage();
page.on('pageerror', error => result.errors.push(error.message));
const click = (name, exact = true) => page.getByRole('button', { name, exact }).click();

async function sample(scene, seconds) {
  await page.evaluate(() => { for (const record of window.__aresProbe.renderers) record.stamps.length = 0; });
  await page.waitForTimeout(seconds * 1000);
  const data = await page.evaluate(() => {
    const live = window.__aresProbe.renderers.filter(record => !record.disposed);
    const record = live.at(-1);
    const intervals = record.stamps.slice(1).map((stamp, index) => stamp - record.stamps[index]).sort((a, b) => a - b);
    const total = intervals.reduce((sum, value) => sum + value, 0);
    const context = record.ref.deref()?.getContext();
    const info = context?.getExtension('WEBGL_debug_renderer_info');
    return {
      liveRenderers: live.length, frames: record.stamps.length, drawCalls: record.calls, triangles: record.triangles,
      averageFps: intervals.length ? 1000 * intervals.length / total : 0,
      meanFrameMs: intervals.length ? total / intervals.length : 0,
      p99FrameMs: intervals.length ? intervals[Math.min(intervals.length - 1, Math.ceil(intervals.length * .99) - 1)] : 0,
      maxFrameMs: intervals.at(-1) ?? 0,
      domNodes: document.querySelectorAll('*').length,
      heapMiB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
      gpu: info && context ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
    };
  });
  result.renderer ??= data.gpu;
  const entry = { scene, seconds, ...data };
  delete entry.gpu;
  result.scenes.push(entry);
  console.log(JSON.stringify(entry));
}

try {
  await page.goto(origin);
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout });
  await sample('welcome', 15);
  await click('ENTER MISSION CONTROL', false);
  await expect(page.locator('.room-status')).toHaveCount(0, { timeout });
  await sample('crew-selection', 20);
  await click('Enter mission control');
  await click('Begin workshop');
  await expect(page.locator('.room-canvas')).toHaveAttribute('data-rover-status', 'ready', { timeout });
  await expect(page.locator('.room-status')).toHaveCount(0, { timeout });
  await page.waitForTimeout(3000);
  await sample('workshop-idle', 25);
  await click('Review mission');
  await click('Approve & launch');
  await expect(page.getByRole('button', { name: 'BEGIN COUNTDOWN' })).toBeVisible();
  await page.waitForTimeout(1500);
  await sample('launch-pad', 12);
  for (const name of ['BEGIN COUNTDOWN', 'CONFIRM LIFTOFF', 'BEGIN MARS APPROACH', 'DEPLOY ROVER']) await click(name, false);
  await expect(page.getByRole('button', { name: 'End mission', exact: true })).toBeVisible({ timeout });
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout });
  await page.waitForTimeout(3000);
  await sample('mars-idle', 25);
  await page.keyboard.down('w');
  await sample('mars-driving', 20);
  await page.keyboard.up('w');
} catch (error) {
  result.errors.push(String(error));
} finally {
  await writeFile(output, JSON.stringify(result, null, 2));
  await browser.close();
}
if (result.errors.length) { console.error(result.errors); process.exitCode = 1; }
