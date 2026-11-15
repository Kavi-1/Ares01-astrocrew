// Phase A room-navigation benchmark. Instrumentation is response-only; app files/state are not edited.
// ARES_PROFILE_ORIGIN=http://127.0.0.1:5181 ARES_PROFILE_REPETITIONS=3 CHROMIUM_PATH=...
// node scripts/profile-loading-regression.mjs label /tmp/room-profile.json
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';

const origin = process.env.ARES_PROFILE_ORIGIN ?? 'http://127.0.0.1:5181';
const repetitions = Number(process.env.ARES_PROFILE_REPETITIONS ?? 3);
const label = process.argv[2] ?? 'current';
const output = process.argv[3] ?? `/tmp/ares-loading-regression-${label}.json`;
if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('ARES_PROFILE_REPETITIONS must be positive.');
const out = {
  label, origin, repetitions,
  harnessSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  environment: { cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, systemMemoryBytes: os.totalmem(), platform: os.platform(), viewport: { width: 1440, height: 1000 }, dpr: 1 },
  method: {
    cache: 'HTTP cache disabled throughout; cold=fresh browser context, warm=same-page re-entry with existing bounded application byte cache. Both include normal home navigation. Warm retains workshop state; compare versions within each condition, not cold versus warm as a pure cache effect.',
    readiness: 'All six original crew roots and rover attached to the room scene, after a renderer call returns; DOM status disappearance is recorded separately.',
    visibility: 'First model mesh onAfterRender callback: an actual frustum-eligible draw submission, not proof of unoccluded pixels or GPU completion.',
    instrumentation: 'Equivalent response-only wrappers on both source versions; synchronous durations and weak references. Wrapper microtasks and instrumentation have some overhead. React body and setter enqueue durations exclude reconciliation/commit/layout.',
    runtime: 'Vite development runtime with normal StrictMode effect behavior retained. This is not a production-build or physical-GPU certification.',
    attribution: 'Download records include transfers overlapping the live room interval, including requests begun by a discarded StrictMode effect. Live load requests identify newly started, shared-in-flight, or no-new-transfer cache-hit paths. Parse/model/rig/callback records retain start-during-room attribution; model disposal records are explicitly all-app interval records.',
  },
  sourceHashes: {}, runs: [], errors: [],
};

function wrapExport(source, name, async, body) {
  const pattern = new RegExp(`export ${async ? 'async ' : ''}function ${name}\\(`);
  if (!pattern.test(source)) throw new Error(`Missing instrumentation anchor: ${name}`);
  return source.replace(pattern, `${async ? 'async ' : ''}function __probeOriginal_${name}(`)
    + `\nexport ${async ? 'async ' : ''}function ${name}(...args) { ${body} }\n`;
}

function instrument(source, pathname) {
  const probe = 'window.__loadingProbe';
  if (pathname.endsWith('/assets.ts')) {
    const anchor = /export async function loadModel\([^)]*\)\s*\{/;
    if (!anchor.test(source)) throw new Error('Missing loadModel start anchor');
    source = source.replace(anchor, match => `${match}\n${probe}.loadStarted(url);`);
    if (!source.includes('new GLTFLoader()')) throw new Error('Missing GLTFLoader anchor');
    source = source.replaceAll('new GLTFLoader()', `(${probe}.parseUrl = url, new GLTFLoader())`);
    return wrapExport(source, 'disposeModel', false, `const start=performance.now();try{return __probeOriginal_disposeModel(...args);}finally{${probe}.disposals.push({start,end:performance.now(),id:args[0]?.userData?.__probeModelId??args[0]?.name});}`);
  }
  if (pathname.endsWith('/characterModel.ts') || pathname.endsWith('/roverModel.ts')) {
    const character = pathname.endsWith('/characterModel.ts'), name = character ? 'createCharacterModel' : 'createRoverModel';
    return wrapExport(source, name, true, `const start=performance.now(),id=${character ? 'args[0]' : "'rover'"};try{const result=await __probeOriginal_${name}(...args);const root=${character ? 'result' : 'result.root'};root.userData.__probeModelId=id;${probe}.roots.push({id,ref:new WeakRef(root)});${probe}.models.push({id,start,end:performance.now()});return result;}catch(error){${probe}.models.push({id,start,end:performance.now(),error:String(error)});throw error;}`);
  }
  if (pathname.endsWith('/crewAnimation.ts')) {
    return wrapExport(source, 'prepareCrewAnimation', false, `const start=performance.now();try{return __probeOriginal_prepareCrewAnimation(...args);}finally{${probe}.rigs.push({id:args[0].userData.__probeModelId,start,end:performance.now()});}`);
  }
  if (pathname.endsWith('/CrewRoom.tsx')) {
    const defaultFunction = /export default function CrewRoom\(/.test(source);
    const declaration = defaultFunction ? /export default function CrewRoom\(/ : /function CrewRoom\(/;
    if (!declaration.test(source)) throw new Error('Missing CrewRoom declaration');
    source = source.replace(declaration, 'function __probeOriginal_CrewRoom(');
    source += `\n${defaultFunction ? 'export default ' : ''}function CrewRoom(...args){const start=performance.now();try{return __probeOriginal_CrewRoom(...args);}finally{${probe}.reactBodies.push({start,end:performance.now()});}}\n`;
    const node = /const node = host\.current;/;
    if (!node.test(source)) throw new Error('Missing room mount anchor');
    source = source.replace(node, `const node = host.current; ${probe}.beginRoom(node, latest.current.selected);`);
    const controls = /document\.addEventListener\((["'])visibilitychange\1, visibility\);/;
    if (!controls.test(source)) throw new Error('Missing room control registration anchor');
    source = source.replace(controls, match => `${match} ${probe}.room().controlsRegistered=performance.now();`);
    for (const setter of ['setStatus', 'setModelProgress']) {
      const declaration = new RegExp(`const \\[([^,\\]]+), ${setter}\\] = ([^;]+);`);
      if (!declaration.test(source)) continue;
      source = source.replace(declaration, (_, state, init) => `const [${state}, __probe_${setter}] = ${init};\nconst ${setter}=(...args)=>{const start=performance.now();try{return __probe_${setter}(...args);}finally{${probe}.progressUpdates.push({start,end:performance.now(),setter:'${setter}'});}};`);
    }
    return source;
  }
  return source;
}

function installProbe() {
  const p = window.__loadingProbe = {
    roots: [], loads: [], downloads: [], parses: [], models: [], rigs: [], disposals: [], reactBodies: [], progressUpdates: [], rooms: [], renderers: [],
    room() { return this.rooms.at(-1); },
    loadStarted(url) {
      this.loads.push({ id: this.loads.length, url, start: performance.now(), inFlightAtStart: this.downloads.filter(d => d.url === url && d.end === undefined).map(d => d.id), startedDownloads: [] });
    },
    beginRoom(node, selected) {
      this.rooms.push({ start: performance.now(), selected, node: new WeakRef(node), controlsRegistered: null, firstSceneRender: null, allCrewSceneRender: null, allAssetsSceneRender: null, firstDrawn: {}, firstAttachedRender: {}, domReady: null, statusChanges: [], renderCalls: 0, renderMs: 0, hookMs: 0 });
    },
  };
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    if (!String(args[0]).includes('.glb')) return originalFetch(...args);
    const record = { id: p.downloads.length, url: String(args[0]), start: performance.now(), bytes: 0 };
    // fetch begins synchronously inside loadModel/get before its first await.
    // Preserve the relationship even when StrictMode started it in a discarded effect.
    const load = p.loads.findLast(r => r.url === record.url);
    if (load) { record.startedByLoadId = load.id; load.startedDownloads.push(record.id); }
    p.downloads.push(record);
    try {
      const response = await originalFetch(...args); record.headers = performance.now(); record.status = response.status;
      const originalArrayBuffer = response.arrayBuffer.bind(response);
      response.arrayBuffer = async () => { try { const bytes = await originalArrayBuffer(); record.bytes = bytes.byteLength; record.end = performance.now(); return bytes; } catch (error) { record.error = String(error); record.end = performance.now(); throw error; } };
      if (response.body) {
        const getReader = response.body.getReader.bind(response.body);
        response.body.getReader = (...args) => {
          const reader = getReader(...args), read = reader.read.bind(reader);
          reader.read = async () => { try { const result = await read(); record.bytes += result.value?.byteLength ?? 0; if (result.done) record.end = performance.now(); return result; } catch (error) { record.error = String(error); record.end = performance.now(); throw error; } };
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
      const parse = object.parseAsync, url = p.parseUrl;
      object.parseAsync = async function (...args) { const start = performance.now(); try { return await parse.apply(this, args); } finally { p.parses.push({ url, start, end: performance.now() }); } };
    }
    if (!object.isWebGLRenderer) return;
    const record = { ref: new WeakRef(object), created: performance.now(), disposed: null };
    p.renderers.push(record);
    const render = object.render, dispose = object.dispose, hooked = new WeakSet();
    object.render = function (scene, camera, ...args) {
      const node = this.domElement.parentElement;
      const room = node?.classList.contains('room-canvas') ? p.rooms.findLast(r => r.node.deref() === node) : null;
      if (!room) return render.call(this, scene, camera, ...args);
      record.roomStart = room.start;
      const hookStart = performance.now(), attached = [];
      for (const entry of p.roots) {
        const root = entry.ref.deref();
        if (!root) continue;
        let ancestor = root;
        while (ancestor && ancestor !== scene) ancestor = ancestor.parent;
        if (ancestor !== scene) continue;
        attached.push(entry.id);
        if (hooked.has(root)) continue;
        hooked.add(root);
        root.traverse(mesh => {
          if (!mesh.isMesh) return;
          const original = mesh.onAfterRender;
          mesh.onAfterRender = function (...args) {
            original.apply(this, args);
            room.firstDrawn[entry.id] ??= performance.now();
            this.onAfterRender = original;
          };
        });
      }
      room.hookMs += performance.now() - hookStart;
      const start = performance.now();
      const result = render.call(this, scene, camera, ...args);
      const end = performance.now();
      room.renderCalls++; room.renderMs += end - start; room.firstSceneRender ??= end;
      for (const id of attached) room.firstAttachedRender[id] ??= end;
      if (['kavi', 'aaryan', 'houssam', 'huzaifa', 'lautaro', 'rihabe'].every(id => attached.includes(id))) {
        room.allCrewSceneRender ??= end;
        if (attached.includes('rover')) room.allAssetsSceneRender ??= end;
      }
      return result;
    };
    object.dispose = function () {
      const start = performance.now(); record.resourcesBeforeRendererDispose = { ...this.info.memory };
      try { return dispose.call(this); } finally { record.disposed = performance.now(); record.disposeMs = record.disposed - start; }
    };
  });
  const observer = new MutationObserver(() => {
    const room = p.room(), node = room?.node.deref();
    if (!node?.isConnected) return;
    const status = node.parentElement.querySelector('.room-status');
    const text = status?.textContent ?? '';
    if (room.statusChanges.at(-1)?.text !== text) room.statusChanges.push({ at: performance.now(), text });
    if (!status && room.firstSceneRender !== null) room.domReady ??= performance.now();
  });
  document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true, characterData: true }));
}

let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  out.browser = browser.version();
  out.gpu = (await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')).gpu.devices;
  for (let repetition = 0; repetition < repetitions; repetition++) {
    const context = await browser.newContext({ viewport: out.environment.viewport, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      page.setDefaultTimeout(120000); page.on('pageerror', error => out.errors.push(String(error)));
      await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await page.addInitScript(installProbe);
      await page.route(/\/src\/(?:models\/(?:assets|characterModel|roverModel|crewAnimation)\.ts|ui\/crew\/CrewRoom\.tsx)(?:\?|$)/, async route => {
        const response = await route.fetch(), source = await response.text(), pathname = new URL(route.request().url()).pathname;
        out.sourceHashes[pathname] = createHash('sha256').update(source).digest('hex');
        await route.fulfill({ response, body: instrument(source, pathname) });
      });
      await page.goto(origin);
      for (const condition of ['cold', 'warm']) {
        // Complete the existing home foreground model first in both versions.
        await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout: 120000 });
        const navigationStart = await page.evaluate(() => performance.now());
        await page.getByRole('button', { name: 'ENTER MISSION CONTROL' }).click();
        await expect(page.locator('.room-canvas')).toBeVisible();
        const entry = page.getByRole('button', { name: 'Enter mission control', exact: true });
        if (await entry.isVisible()) await entry.click();
        const briefing = page.getByRole('button', { name: 'Begin workshop', exact: true });
        if (await briefing.isVisible()) await briefing.click();
        const controlsUsable = await page.evaluate(() => performance.now());
        const initial = Number(await page.locator('.room-canvas').getAttribute('data-player-x'));
        await page.keyboard.down('a');
        await expect.poll(async () => Number(await page.locator('.room-canvas').getAttribute('data-player-x')), { timeout: 30000 }).toBeLessThan(initial - .15);
        await page.keyboard.up('a');
        const movementVerified = await page.evaluate(() => performance.now());
        await page.waitForFunction(() => window.__loadingProbe.room()?.allAssetsSceneRender != null, null, { timeout: 120000 });
        await expect(page.locator('.room-status')).toHaveCount(0, { timeout: 120000 });
        const measured = await page.evaluate(({ navigationStart, controlsUsable, movementVerified }) => {
          const p = window.__loadingProbe, room = p.room(), cutoff = performance.now();
          const during = list => list.filter(r => r.start >= room.start && r.start <= cutoff);
          const overlapping = list => list.filter(r => r.start <= cutoff && (r.end === undefined || r.end >= room.start));
          const duration = list => list.reduce((sum, r) => sum + (r.end - r.start), 0);
          const { node, ...r } = room;
          return {
            ...r, navigationStart, controlsUsable, movementVerified, cutoff,
            timing: { sceneToControlsRegisteredMs: room.controlsRegistered - room.start, navigationToControlsUsableMs: controlsUsable - navigationStart, sceneToControlsUsableMs: controlsUsable - room.start, sceneToMovementVerifiedMs: movementVerified - room.start, firstSceneRenderMs: room.firstSceneRender - room.start, firstRoverDrawMs: room.firstDrawn.rover === undefined ? null : room.firstDrawn.rover - room.start, firstSelectedCrewDrawMs: room.firstDrawn[room.selected] === undefined ? null : room.firstDrawn[room.selected] - room.start, allCrewRenderMs: room.allCrewSceneRender - room.start, allAssetsRenderMs: room.allAssetsSceneRender - room.start, domReadyMs: room.domReady === null ? null : room.domReady - room.start, reportAfterActualMs: room.domReady === null ? null : room.domReady - room.allAssetsSceneRender },
            downloads: overlapping(p.downloads), loads: during(p.loads).map(load => ({ ...load, transferDisposition: load.startedDownloads.length ? 'started-download' : load.inFlightAtStart.length ? 'shared-in-flight' : 'no-new-transfer-cache-hit' })), parses: during(p.parses), models: during(p.models), rigs: during(p.rigs),
            progressUpdates: { count: during(p.progressUpdates).length, enqueueMs: duration(during(p.progressUpdates)) },
            reactBodies: { count: during(p.reactBodies).length, bodyMs: duration(during(p.reactBodies)) },
            heapBeforeExit: performance.memory.usedJSHeapSize,
          };
        }, { navigationStart, controlsUsable, movementVerified });
        await page.getByRole('button', { name: 'Home', exact: true }).click();
        await expect(page.locator('.room-canvas')).toHaveCount(0);
        await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status', 'ready', { timeout: 120000 });
        await cdp.send('HeapProfiler.collectGarbage');
        const cleanup = await page.evaluate(start => {
          const p = window.__loadingProbe;
          return { heapAfterExitGC: performance.memory.usedJSHeapSize, allAppDisposalsSinceRoomMount: p.disposals.filter(d => d.start >= start), renderers: p.renderers.filter(r => r.roomStart === start).map(({ ref, ...r }) => ({ ...r, attached: !!ref.deref()?.domElement.isConnected })) };
        }, measured.start);
        expect(cleanup.renderers.length).toBe(1);
        expect(cleanup.renderers.every(r => r.disposed !== null && !r.attached)).toBeTruthy();
        const row = { repetition, condition, ...measured, cleanup };
        out.runs.push(row); await writeFile(output, JSON.stringify(out, null, 2));
        console.log(JSON.stringify({ label, repetition, condition, ...row.timing, progressUpdates: row.progressUpdates, reactBodies: row.reactBodies, downloadCount: row.downloads.length, parseMs: row.parses.reduce((n, r) => n + r.end - r.start, 0), rigMs: row.rigs.reduce((n, r) => n + r.end - r.start, 0) }));
      }
    } finally { await context.close(); }
  }
  const summary = {};
  for (const condition of ['cold', 'warm']) {
    summary[condition] = {};
    for (const key of Object.keys(out.runs.find(r => r.condition === condition).timing)) {
      const values = out.runs.filter(r => r.condition === condition).map(r => r.timing[key]).filter(v => v !== null).sort((a, b) => a - b);
      summary[condition][key] = values.length ? { n: values.length, median: values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2, min: values[0], max: values.at(-1) } : null;
    }
  }
  out.summary = summary;
  expect(out.errors).toEqual([]);
  await writeFile(output, JSON.stringify(out, null, 2));
  console.log(`PASS ${out.runs.length} actual scene navigations; timings use matched response instrumentation, not model-only loads.`);
} catch (error) {
  out.failure = String(error); await writeFile(output, JSON.stringify(out, null, 2)); throw error;
} finally { await browser?.close(); }
