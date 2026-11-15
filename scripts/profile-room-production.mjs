// Matched production-build workshop benchmark; no source transforms or store injection.
// ARES_PROFILE_REPETITIONS=3 CHROMIUM_PATH=... node scripts/profile-room-production.mjs dist label /tmp/result.json
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

const directory = path.resolve(process.argv[2] ?? 'dist');
const label = process.argv[3] ?? 'current';
const output = process.argv[4] ?? `/tmp/ares-production-room-${label}.json`;
const repetitions = Number(process.env.ARES_PROFILE_REPETITIONS ?? 3);
if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('ARES_PROFILE_REPETITIONS must be positive.');
const modelUrls = ['/models/rover.glb', ...['kavi', 'aaryan', 'houssam', 'huzaifa', 'lautaro', 'rihabe'].map(id => `/models/crew/${id}.glb`)];
const byteLengthToUrl = {};
for (const url of modelUrls) {
  const { size } = await stat(path.join(directory, url));
  if (byteLengthToUrl[size]) throw new Error('GLB byte lengths must be unique to identify production parse records.');
  byteLengthToUrl[size] = url;
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(directory, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(directory + path.sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream', 'content-length': info.size, 'cache-control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file); res.once('close', () => stream.destroy()); stream.pipe(res);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const out = {
  label, directory, repetitions,
  harnessSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  environment: { cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, systemMemoryBytes: os.totalmem(), platform: os.platform(), viewport: { width: 1440, height: 1000 }, dpr: 1 },
  method: {
    runtime: 'Production build served locally, no source transforms and no store injection. Normal app effects retained; production does not replay development StrictMode effects.',
    cache: 'Server Cache-Control:no-store and CDP HTTP cache disabled. Cold=fresh browser context, warm=same-page Home/re-entry with existing bounded application byte cache. Warm retains workshop state; compare versions within each condition, not cold versus warm as a pure cache effect.',
    start: 'Navigation start is sampled before the existing Enter Mission Control action. rendererObservedAt is Three.js constructor observation, after renderer initialization; it excludes constructor cost.',
    homeGate: 'Every entry/home return waits for both the existing ready label and an observed original-rover mesh draw in the current connected MarsWorld renderer. This removes pre005/005 home-label readiness differences.',
    readiness: 'All six Group roots tagged userData.crew and the original Imported_Perseverance root attached to the scene after a renderer call returns. Mesh proxies are excluded. DOM status disappearance is separate.',
    visibility: 'First mesh onAfterRender callback is an actual frustum-eligible draw submission, not GPU completion or proof of unoccluded pixels.',
    parsing: 'GLB parse attribution uses unique byte lengths measured from the exact build assets. Parse spans include asynchronous decode/scheduling.',
    unavailable: 'Production rig preparation and React/progress CPU breakdown cannot be isolated without source instrumentation; see the separate matched development benchmark. Three.js resource counts are not VRAM. SwiftShader is not physical low-end hardware.',
  },
  assetByteLengths: byteLengthToUrl, runs: [], errors: [],
};

function installProbe(byteLengthToUrl) {
  const p = window.__productionRoomProbe = { downloads: [], parses: [], renderers: [], rooms: [], navigationStart: null };
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    if (!String(args[0]).includes('.glb')) return originalFetch(...args);
    const record = { url: String(args[0]), start: performance.now(), bytes: 0 };
    p.downloads.push(record);
    try {
      const response = await originalFetch(...args); record.headers = performance.now(); record.status = response.status;
      const originalArrayBuffer = response.arrayBuffer.bind(response);
      response.arrayBuffer = async () => {
        try { const bytes = await originalArrayBuffer(); record.bytes = bytes.byteLength; record.end = performance.now(); return bytes; }
        catch (error) { record.error = String(error); record.end = performance.now(); throw error; }
      };
      if (response.body) {
        const getReader = response.body.getReader.bind(response.body);
        response.body.getReader = (...args) => {
          const reader = getReader(...args), read = reader.read.bind(reader);
          reader.read = async () => {
            try { const result = await read(); record.bytes += result.value?.byteLength ?? 0; if (result.done) record.end = performance.now(); return result; }
            catch (error) { record.error = String(error); record.end = performance.now(); throw error; }
          };
          return reader;
        };
      }
      return response;
    } catch (error) { record.error = String(error); record.end = performance.now(); throw error; }
  };
  window.__THREE_DEVTOOLS__ = new EventTarget();
  window.__THREE_DEVTOOLS__.addEventListener('observe', event => {
    const object = event.detail;
    if (typeof object.parseAsync === 'function') {
      const parse = object.parseAsync;
      object.parseAsync = async function (...args) {
        const start = performance.now(), url = byteLengthToUrl[args[0]?.byteLength] ?? 'unknown';
        try { return await parse.apply(this, args); }
        finally { p.parses.push({ url, start, end: performance.now() }); }
      };
    }
    if (!object.isWebGLRenderer) return;
    const record = { ref: new WeakRef(object), rendererObservedAt: performance.now(), disposed: null };
    p.renderers.push(record);
    const render = object.render, dispose = object.dispose, hooked = new WeakSet();
    object.render = function (scene, camera, ...args) {
      const node = this.domElement.parentElement;
      if (node?.classList.contains('mars-world') && !record.homeRoverHooked) {
        const rover = scene.getObjectByName('Imported_Perseverance');
        if (rover) {
          record.homeRoverHooked = true;
          rover.traverse(mesh => {
            if (!mesh.isMesh) return;
            const original = mesh.onAfterRender;
            mesh.onAfterRender = function (...args) { original.apply(this, args); record.homeRoverFirstDraw ??= performance.now(); this.onAfterRender = original; };
          });
        }
      }
      if (!node?.classList.contains('room-canvas')) return render.call(this, scene, camera, ...args);
      if (!record.room) {
        record.room = { rendererObservedAt: record.rendererObservedAt, navigationStart: p.navigationStart, node: new WeakRef(node), selected: 'kavi', firstSceneRender: null, allCrewSceneRender: null, allAssetsSceneRender: null, firstDrawn: {}, firstAttachedRender: {}, domReady: null, statusChanges: [], renderCalls: 0, renderMs: 0, hookMs: 0 };
        p.rooms.push(record.room);
      }
      const room = record.room, hookStart = performance.now(), roots = [];
      // Crew roots are direct scene children, except the selected actor inside the player Group.
      // This bounded two-level walk avoids scanning every GLB mesh on each frame.
      for (const child of scene.children) for (const candidate of [child, ...child.children]) {
        if (candidate.name === 'Imported_Perseverance') roots.push({ id: 'rover', root: candidate });
        else if (candidate.isGroup && typeof candidate.userData.crew === 'string') roots.push({ id: candidate.userData.crew, root: candidate });
      }
      for (const { id, root } of roots) {
        if (hooked.has(root)) continue;
        hooked.add(root);
        root.traverse(mesh => {
          if (!mesh.isMesh) return;
          const original = mesh.onAfterRender;
          mesh.onAfterRender = function (...args) { original.apply(this, args); room.firstDrawn[id] ??= performance.now(); this.onAfterRender = original; };
        });
      }
      room.hookMs += performance.now() - hookStart;
      const start = performance.now(), result = render.call(this, scene, camera, ...args), end = performance.now();
      room.renderCalls++; room.renderMs += end - start; room.firstSceneRender ??= end;
      const attached = roots.map(r => r.id);
      for (const id of attached) room.firstAttachedRender[id] ??= end;
      if (['kavi', 'aaryan', 'houssam', 'huzaifa', 'lautaro', 'rihabe'].every(id => attached.includes(id))) {
        room.allCrewSceneRender ??= end;
        if (attached.includes('rover')) {
          room.allAssetsSceneRender ??= end;
          room.resourcesAtReady ??= { ...this.info.memory };
          room.drawAtReady ??= { calls: this.info.render.calls, triangles: this.info.render.triangles };
        }
      }
      return result;
    };
    object.dispose = function () {
      const start = performance.now(); record.resourcesBeforeRendererDispose = { ...this.info.memory };
      try { return dispose.call(this); }
      finally { record.disposed = performance.now(); record.disposeMs = record.disposed - start; }
    };
  });
  const observer = new MutationObserver(() => {
    const room = p.rooms.at(-1), node = room?.node.deref();
    if (!node?.isConnected) return;
    const status = node.parentElement.querySelector('.room-status'), text = status?.textContent ?? '';
    if (room.statusChanges.at(-1)?.text !== text) room.statusChanges.push({ at: performance.now(), text });
    if (!status && room.firstSceneRender !== null) room.domReady ??= performance.now();
  });
  document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true, characterData: true }));
}

async function waitForHomeModel(page) {
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout: 120000 });
  await page.waitForFunction(() => window.__productionRoomProbe.renderers.some(record => {
    const canvas = record.ref.deref()?.domElement;
    return record.homeRoverFirstDraw != null && canvas?.isConnected && canvas.parentElement?.classList.contains('mars-world');
  }), null, { timeout: 120000 });
}

let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  out.browser = browser.version(); out.gpu = (await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')).gpu.devices;
  for (let repetition = 0; repetition < repetitions; repetition++) {
    const context = await browser.newContext({ viewport: out.environment.viewport, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      page.setDefaultTimeout(120000); page.on('pageerror', error => out.errors.push({ repetition, error: String(error) }));
      await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await page.addInitScript(installProbe, byteLengthToUrl); await page.goto(origin);
      for (const condition of ['cold', 'warm']) {
        await waitForHomeModel(page);
        await page.evaluate(() => { window.__productionRoomProbe.navigationStart = performance.now(); });
        await page.getByRole('button', { name: 'ENTER MISSION CONTROL' }).click();
        await expect(page.locator('.room-canvas')).toBeVisible();
        const entry = page.getByRole('button', { name: 'Enter mission control', exact: true });
        if (await entry.isVisible()) {
          await expect(page.getByRole('button', { name: /^Kavi / })).toHaveAttribute('aria-pressed', 'true');
          await entry.click();
        }
        const briefing = page.getByRole('button', { name: 'Begin workshop', exact: true });
        if (await briefing.isVisible()) await briefing.click();
        const controlsUsable = await page.evaluate(() => performance.now());
        const initial = Number(await page.locator('.room-canvas').getAttribute('data-player-x'));
        await page.keyboard.down('a');
        await expect.poll(async () => Number(await page.locator('.room-canvas').getAttribute('data-player-x')), { timeout: 30000 }).toBeLessThan(initial - .15);
        await page.keyboard.up('a');
        const movementVerified = await page.evaluate(() => performance.now());
        await page.waitForFunction(() => window.__productionRoomProbe.rooms.at(-1)?.allAssetsSceneRender != null, null, { timeout: 120000 });
        await expect(page.locator('.room-status')).toHaveCount(0, { timeout: 120000 });
        const measured = await page.evaluate(({ controlsUsable, movementVerified }) => {
          const p = window.__productionRoomProbe, room = p.rooms.at(-1), cutoff = performance.now();
          const overlapping = list => list.filter(r => r.start <= cutoff && (r.end === undefined || r.end >= room.rendererObservedAt));
          const { node, ...r } = room;
          return { ...r, controlsUsable, movementVerified, cutoff,
            timing: {
              navigationToControlsUsableMs: controlsUsable - room.navigationStart,
              navigationToMovementVerifiedMs: movementVerified - room.navigationStart,
              rendererToFirstSceneRenderMs: room.firstSceneRender - room.rendererObservedAt,
              rendererToFirstRoverDrawMs: room.firstDrawn.rover === undefined ? null : room.firstDrawn.rover - room.rendererObservedAt,
              rendererToFirstSelectedCrewDrawMs: room.firstDrawn[room.selected] === undefined ? null : room.firstDrawn[room.selected] - room.rendererObservedAt,
              rendererToAllCrewRenderMs: room.allCrewSceneRender - room.rendererObservedAt,
              rendererToAllAssetsRenderMs: room.allAssetsSceneRender - room.rendererObservedAt,
              navigationToAllAssetsRenderMs: room.allAssetsSceneRender - room.navigationStart,
              rendererToDomReadyMs: room.domReady === null ? null : room.domReady - room.rendererObservedAt,
              domAfterActualMs: room.domReady === null ? null : room.domReady - room.allAssetsSceneRender,
            },
            downloads: overlapping(p.downloads), parses: overlapping(p.parses), heapBeforeExit: performance.memory.usedJSHeapSize,
          };
        }, { controlsUsable, movementVerified });
        await page.getByRole('button', { name: 'Home', exact: true }).click();
        await expect(page.locator('.room-canvas')).toHaveCount(0);
        await waitForHomeModel(page);
        await cdp.send('HeapProfiler.collectGarbage');
        const cleanup = await page.evaluate(rendererObservedAt => {
          const p = window.__productionRoomProbe;
          return { heapAfterExitGC: performance.memory.usedJSHeapSize, renderers: p.renderers.filter(r => r.rendererObservedAt === rendererObservedAt).map(({ ref, room, ...r }) => ({ ...r, attached: !!ref.deref()?.domElement.isConnected })) };
        }, measured.rendererObservedAt);
        expect(cleanup.renderers.length).toBe(1); expect(cleanup.renderers.every(r => r.disposed !== null && !r.attached)).toBeTruthy();
        const row = { repetition, condition, ...measured, cleanup }; out.runs.push(row); await writeFile(output, JSON.stringify(out, null, 2));
        console.log(JSON.stringify({ label, repetition, condition, ...row.timing, downloadCount: row.downloads.length, parseCount: row.parses.length, parseMs: row.parses.reduce((n, r) => n + r.end - r.start, 0), hookMs: row.hookMs }));
      }
    } finally { await context.close(); }
  }
  out.summary = {};
  for (const condition of ['cold', 'warm']) {
    out.summary[condition] = {};
    for (const key of Object.keys(out.runs.find(r => r.condition === condition).timing)) {
      const values = out.runs.filter(r => r.condition === condition).map(r => r.timing[key]).filter(v => v !== null).sort((a, b) => a - b);
      out.summary[condition][key] = values.length ? { n: values.length, median: values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2, min: values[0], max: values.at(-1) } : null;
    }
  }
  expect(out.errors).toEqual([]); await writeFile(output, JSON.stringify(out, null, 2));
  console.log(`PASS ${out.runs.length} production room navigations; all-six readiness, controls, DOM reporting and renderer cleanup measured.`);
} catch (error) {
  out.failure = String(error); await writeFile(output, JSON.stringify(out, null, 2)); throw error;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
