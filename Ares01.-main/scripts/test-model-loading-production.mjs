// Production smoke + repeat-navigation measurements. Does not mutate game assets/state schemas.
// Usage: CHROMIUM_PATH=... node scripts/test-model-loading-production.mjs [dist] [label] [output.json]
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const directory=path.resolve(process.argv[2]??'dist'),label=process.argv[3]??'current',output=process.argv[4]??`/tmp/ares-model-loading-${label}.json`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try {const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(directory,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(directory+path.sep)){res.writeHead(403).end();return}const info=await stat(file);res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream','content-length':info.size});createReadStream(file).pipe(res)}catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
const out={label,environment:{cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,systemMemoryBytes:os.totalmem(),platform:os.platform()},cycles:[],errors:[]};
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader','--enable-precise-memory-info']});
 out.browser=browser.version();out.gpu=(await(await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')).gpu;
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});const page=await context.newPage();page.on('pageerror',e=>out.errors.push(e.message));const cdp=await context.newCDPSession(page);
 await page.addInitScript(()=>{
  window.loadingAudit={renderers:[],parses:[]};window.__THREE_DEVTOOLS__=new EventTarget();
  window.__THREE_DEVTOOLS__.addEventListener('observe',e=>{const object=e.detail;
   if(object.isWebGLRenderer){const record={ref:new WeakRef(object),created:performance.now(),disposed:null,firstModelRender:null};window.loadingAudit.renderers.push(record);const render=object.render,dispose=object.dispose;
    object.render=function(...args){const result=render.apply(this,args);if(record.firstModelRender===null&&args[0].getObjectByName('Imported_Perseverance'))record.firstModelRender=performance.now();return result};
    object.dispose=function(){record.disposed=performance.now();record.resourcesBeforeRendererDispose={...this.info.memory};return dispose.call(this)};
   } else if(typeof object.parseAsync==='function'){const parse=object.parseAsync;object.parseAsync=async function(...args){const start=performance.now();try{return await parse.apply(this,args)}finally{window.loadingAudit.parses.push(performance.now()-start)}}}
  });
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 for(let cycle=0;cycle<2;cycle++){
  const started=Date.now();
  await page.getByRole('button',{name:'ENTER MISSION CONTROL'}).click();
  await page.getByRole('button',{name:'Enter mission control',exact:true}).click();
  await page.getByRole('button',{name:'Begin workshop',exact:true}).click();
  await expect(page.locator('.room-canvas')).toHaveAttribute('data-rover-status','ready',{timeout:120000});
  await expect(page.locator('.room-status')).toHaveCount(0,{timeout:120000});
  const roomReadyMs=Date.now()-started;
  const x=Number(await page.locator('.room-canvas').getAttribute('data-player-x'));await page.keyboard.down('a');await expect.poll(async()=>Number(await page.locator('.room-canvas').getAttribute('data-player-x')),{timeout:30000}).toBeLessThan(x-.15);await page.keyboard.up('a');
  await page.getByRole('button',{name:'Power station Houssam',exact:true}).click();await expect(page.getByRole('button',{name:'Accept proposal',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Accept proposal',exact:true}).click();
  await page.getByRole('button',{name:'Review mission',exact:true}).click();
  await page.screenshot({path:output+`.room-${cycle}.png`});
  await page.getByRole('button',{name:'Approve & launch',exact:true}).click();
  for(const name of ['BEGIN COUNTDOWN','CONFIRM LIFTOFF','BEGIN MARS APPROACH','DEPLOY ROVER'])await page.getByRole('button',{name}).click();
  await expect(page.locator('.mars-world')).toHaveAttribute('data-model-status','ready',{timeout:120000});
  const position=()=>page.evaluate(()=>{const renderer=window.loadingAudit.renderers.filter(r=>!r.disposed).at(-1)?.ref.deref();return renderer?.domElement.parentElement?.dataset.modelStatus});await expect.poll(position).toBe('ready');
  // The persistent game clock/physics are untouched; use the actual keyboard controls.
  const distance=page.locator('.telemetry > div').filter({has:page.getByText('TRAVERSED',{exact:true})}).locator('b');
  const initialDistance=parseFloat(await distance.innerText());
  await page.keyboard.down('w');await expect.poll(async()=>parseFloat(await distance.innerText()),{timeout:30000}).toBeGreaterThan(initialDistance);await page.keyboard.up('w');
  await page.screenshot({path:output+`.mars-${cycle}.png`});
  await page.getByRole('button',{name:'Abort',exact:true}).click();await page.getByRole('button',{name:'Abort mission',exact:true}).click();await expect(page.getByRole('heading',{name:'MISSION ABORT',exact:true})).toBeVisible();
  await cdp.send('HeapProfiler.collectGarbage');
  const metrics=await page.evaluate(()=>({heapBytes:performance.memory.usedJSHeapSize,parses:[...window.loadingAudit.parses],renderers:window.loadingAudit.renderers.map(({ref,...r})=>({...r,attached:!!ref.deref()?.domElement.isConnected})),downloads:performance.getEntriesByType('resource').filter(r=>r.name.includes('.glb')).map(r=>({name:r.name.split('/').at(-1),durationMs:r.responseEnd-r.startTime,bytes:r.decodedBodySize,transferSize:r.transferSize}))}));
  expect(metrics.renderers.every(r=>r.disposed!==null&&!r.attached)).toBeTruthy();
  out.cycles.push({cycle,roomReadyMs,...metrics});console.log(JSON.stringify({cycle,roomReadyMs,heapBytes:metrics.heapBytes,renderers:metrics.renderers.length,parses:metrics.parses.length}));await writeFile(output,JSON.stringify(out,null,2));
  await page.getByRole('button',{name:'NEW CAMPAIGN'}).click();await expect(page.getByRole('button',{name:'ENTER MISSION CONTROL'})).toBeVisible();
 }
 expect(out.errors).toEqual([]);console.log('PASS 2 production navigation cycles: crew movement/proposals, launch, surface controls, abort/report/replay; renderer cleanup');
 await context.close();
} catch(error){out.failure=String(error);await writeFile(output,JSON.stringify(out,null,2));throw error}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
