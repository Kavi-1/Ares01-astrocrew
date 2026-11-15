import { test, expect, type Page } from '@playwright/test';

async function harness(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.modelProbe = { renderers: [], parses: 0, releases: [], holdParse: false };
    w.__THREE_DEVTOOLS__ = new EventTarget();
    w.__THREE_DEVTOOLS__.addEventListener('observe', (event: any) => {
      const object = event.detail;
      if (object.isWebGLRenderer) {
        const record: any = { ref: new WeakRef(object), disposed: false, frames: 0, triangles: 0 };
        w.modelProbe.renderers.push(record);
        const render = object.render, dispose = object.dispose;
        object.render = function(...args: any[]) { const result = render.apply(this, args); record.frames++; record.triangles = this.info.render.triangles; return result; };
        object.dispose = function() { record.disposed = true; record.released = { ...this.info.memory }; return dispose.call(this); };
      } else if (typeof object.parseAsync === 'function') {
        const parse = object.parseAsync;
        object.parseAsync = async function(...args: any[]) {
          const result = await parse.apply(this, args); w.modelProbe.parses++;
          if (w.modelProbe.holdParse) await new Promise(resolve => w.modelProbe.releases.push(resolve));
          return result;
        };
      }
    });
  });
  await page.route('**/loading-test', route => route.fulfill({contentType:'text/html',body:`<style>body{background:#18212c;color:white}.character-stage{position:relative;width:480px;height:640px}.character-canvas{width:480px;height:640px}.mars-world{width:800px;height:650px}</style><div id="probe"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>`}));
  await page.goto('/loading-test');
  await page.waitForFunction(() => (window as any).__vite_plugin_react_preamble_installed__);
  await page.evaluate(async () => {
    const w = window as any, source = await (await fetch('/src/main.tsx')).text();
    const reactPath = source.match(/from "([^"]*\/react.js[^\"]*)"/)![1];
    const domPath = source.match(/from "([^"]*react-dom_client[^\"]*)"/)![1];
    w.React = (await import(reactPath)).default;
    const dom = await import(domPath);
    w.root = (dom.createRoot ?? dom.default.createRoot)(document.querySelector('#probe'));
    w.Preview = (await import('/src/ui/crew/CharacterPreview.tsx')).default;
    w.crew = (await import('/src/data/crew.ts')).CREW;
    w.draw = (ids: string[]) => w.root.render(w.React.createElement(w.React.Fragment, null, ...ids.map(id => w.React.createElement(w.Preview, {key:id, member:w.crew.find((c: any)=>c.id===id)}))));
  });
}

test('preview reports preparing until rendered, retains original model, and supports orbit interaction', async ({page}) => {
  await harness(page);
  await page.evaluate(() => { const w=window as any; w.modelProbe.holdParse=true;w.draw(['kavi']); });
  await expect(page.locator('.character-stage')).toHaveAttribute('data-model-phase','preparing');
  await page.waitForFunction(() => (window as any).modelProbe.releases.length === 1);
  await expect(page.getByText('Preparing Kavi…',{exact:true})).toBeVisible();
  await expect(page.locator('.character-stage')).not.toHaveAttribute('data-model-status','ready');
  await page.evaluate(() => {const w=window as any;w.modelProbe.holdParse=false;w.modelProbe.releases.shift()();});
  await expect(page.locator('.character-stage')).toHaveAttribute('data-model-phase','ready');
  const info=await page.evaluate(()=>{const p=(window as any).modelProbe;return {frames:p.renderers[0].frames,triangles:p.renderers[0].triangles}});
  expect(info.frames).toBeGreaterThan(0);expect(info.triangles).toBeGreaterThan(40000);
  await page.mouse.move(220,250);await page.mouse.down();await page.mouse.move(310,280,{steps:5});await page.mouse.up();
  expect(await page.evaluate(()=>(window as any).modelProbe.renderers[0].frames)).toBeGreaterThan(info.frames);
});

test('preview retries a recoverable HTTP failure and re-downloads original asset', async ({page}) => {
  let requests=0;
  await page.route('**/models/crew/kavi.glb',route=>{requests++;return requests===1?route.fulfill({status:503,body:'temporary failure'}):route.continue()});
  await harness(page);await page.evaluate(()=>(window as any).draw(['kavi']));
  await expect(page.locator('.character-stage')).toHaveAttribute('data-model-phase','failed');
  await page.getByRole('button',{name:'Retry preview'}).click();
  await expect(page.locator('.character-stage')).toHaveAttribute('data-model-phase','ready');
  expect(requests).toBe(2);
  expect(await page.evaluate(()=>(window as any).modelProbe.renderers.filter((r:any)=>!r.disposed).length)).toBe(1);
});

test('unmount during parsing releases old result and cannot replace newer character', async ({page}) => {
  await harness(page);
  await page.evaluate(()=>{const w=window as any;w.modelProbe.holdParse=true;w.draw(['kavi']);});
  await page.waitForFunction(()=>(window as any).modelProbe.releases.length===1);
  await page.evaluate(()=>{const w=window as any;w.modelProbe.holdParse=false;w.draw(['houssam']);});
  await expect(page.locator('.character-stage')).toHaveAttribute('data-model-phase','ready');
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/Houssam/);
  await page.evaluate(()=>(window as any).modelProbe.releases.shift()());
  await page.waitForTimeout(100);
  await expect(page.locator('canvas')).toHaveAttribute('aria-label',/Houssam/);
  expect(await page.evaluate(()=>(window as any).modelProbe.renderers.filter((r:any)=>!r.disposed).length)).toBe(1);
});

test('repeated preview navigation releases renderer resources and keeps byte cache bounded',async({page})=>{
  await harness(page);
  const samples:any[]=[];
  for(const id of ['kavi','aaryan','lautaro','kavi','aaryan','lautaro']){
    const before=await page.evaluate(()=>(window as any).modelProbe.parses);
    await page.evaluate(id=>(window as any).draw([id]),id);
    await page.waitForFunction(({id,before})=>{const w=window as any;return w.modelProbe.parses>before&&document.querySelector('.character-stage')?.getAttribute('data-model-phase')==='ready'&&document.querySelector('canvas')?.getAttribute('aria-label')?.toLowerCase().includes(id)},{id,before});
    samples.push(await page.evaluate(async()=>{const w=window as any;return {alive:w.modelProbe.renderers.filter((r:any)=>!r.disposed).length,memory:{...w.modelProbe.renderers.at(-1).ref.deref().info.memory},cache:(await import('/src/models/assets.ts')).modelDownloadStats()}}));
  }
  expect(samples.every(s=>s.alive===1&&s.cache.entries<=3&&s.cache.bytes<=40*1024*1024)).toBeTruthy();
  for(let i=0;i<3;i++)expect(samples[i].memory).toEqual(samples[i+3].memory);
  await page.evaluate(()=>(window as any).root.unmount());
  const records=await page.evaluate(()=>(window as any).modelProbe.renderers.map((r:any)=>({disposed:r.disposed,released:r.released})));
  expect(records.every((r:any)=>r.disposed&&r.released.geometries===0&&r.released.textures<=1)).toBeTruthy();
});

test('workshop fallback stays interactive and retry preserves the scene and original rover',async({page})=>{
  let failures=true;
  await page.route('**/models/rover.glb',route=>failures?route.fulfill({status:503,body:'temporary failure'}):route.continue());
  await page.goto('/');await page.getByRole('button',{name:'ENTER MISSION CONTROL'}).click();
  await page.getByRole('button',{name:'Enter mission control',exact:true}).click();
  await page.getByRole('button',{name:'Begin workshop',exact:true}).click();
  await expect(page.locator('.room-canvas')).toHaveAttribute('data-rover-status','fallback');
  await page.locator('.room-canvas canvas').evaluate(el=>el.setAttribute('data-loading-scene','same'));
  const initial=Number(await page.locator('.room-canvas').getAttribute('data-player-x'));
  await page.keyboard.down('a');await expect.poll(async()=>Number(await page.locator('.room-canvas').getAttribute('data-player-x'))).toBeLessThan(initial-.15);await page.keyboard.up('a');
  failures=false;await page.getByRole('button',{name:'Retry unavailable models'}).click();
  await expect(page.locator('.room-canvas')).toHaveAttribute('data-rover-phase','ready');
  await expect(page.locator('.room-canvas canvas')).toHaveAttribute('data-loading-scene','same');
  await expect(page.getByRole('button',{name:'Inspect MOXIE on rover',exact:true})).toBeVisible();
});

test('surface preview keeps procedural fallback and retries without replacing its canvas',async({page})=>{
  let failures=true;await page.route('**/models/rover.glb',route=>failures?route.abort():route.continue());
  await harness(page);
  await page.evaluate(async()=>{const w=window as any;const Mars=(await import('/src/game/MarsWorld.tsx')).default;w.root.render(w.React.createElement(Mars,{preview:true,keys:{current:new Set()}}));});
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status','fallback');
  await page.locator('canvas').evaluate(el=>el.setAttribute('data-loading-scene','same'));
  expect(await page.evaluate(()=>(window as any).modelProbe.renderers.at(-1).triangles)).toBeGreaterThan(0);
  failures=false;await page.getByRole('button',{name:'Retry rover model'}).click();
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-phase','ready');
  await expect(page.locator('canvas')).toHaveAttribute('data-loading-scene','same');
});
