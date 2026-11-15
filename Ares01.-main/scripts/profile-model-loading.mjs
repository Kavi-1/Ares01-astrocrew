import {chromium} from '@playwright/test';
import fs from 'node:fs';
// Run against the same local Vite origin before/after; no application mutations.
const tag=process.argv[2]??'current', origin=process.env.ARES_PROFILE_ORIGIN??'http://127.0.0.1:5181';
const output=process.argv[3]??`/tmp/ares-model-profile-${tag}.json`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader','--enable-precise-memory-info']});
const out={tag,measurements:[]};
async function setup(){
 const context=await browser.newContext({viewport:{width:1000,height:800},deviceScaleFactor:1});const page=await context.newPage();
 await page.route('**/loading-probe',r=>r.fulfill({contentType:'text/html',body:'<body style="background:#18212c"></body>'}));await page.goto(origin+'/loading-probe');
 await page.evaluate(async()=>{
  window.loads=[];window.parses=[];window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',e=>{if(typeof e.detail.parseAsync==='function'){const f=e.detail.parseAsync;e.detail.parseAsync=async function(...a){const s=performance.now();try{return await f.apply(this,a);}finally{window.parses.push(performance.now()-s)}}}});
  const f=window.fetch;window.fetch=async(...a)=>{const record={url:String(a[0]),start:performance.now(),bytes:0};if(record.url.includes('.glb'))window.loads.push(record);try{const r=await f(...a);record.headers=performance.now();const ab=r.arrayBuffer.bind(r);r.arrayBuffer=async()=>{try{const v=await ab();record.bytes=v.byteLength;record.end=performance.now();return v}catch(e){record.error=String(e);record.end=performance.now();throw e}};if(r.body){const get=r.body.getReader.bind(r.body);r.body.getReader=(...a)=>{const reader=get(...a),read=reader.read.bind(reader);reader.read=async()=>{try{const v=await read();record.bytes+=v.value?.byteLength??0;if(v.done)record.end=performance.now();return v}catch(e){record.error=String(e);record.end=performance.now();throw e}};return reader}}return r}catch(e){record.error=String(e);record.end=performance.now();throw e}};
  window.cm=await import('/src/models/characterModel.ts');window.rm=await import('/src/models/roverModel.ts');window.ca=await import('/src/models/crewAnimation.ts');window.am=await import('/src/models/assets.ts');
 });return {context,page};
}
try{
 out.system=await(await browser.newBrowserCDPSession()).send('SystemInfo.getInfo');
 const {context,page}=await setup();
 for(const id of ['rover','aaryan','houssam','huzaifa','kavi','lautaro','rihabe','rover','lautaro']){
  const row=await page.evaluate(async id=>{const studio=window.cm.createCharacterStudio(document.body.appendChild(document.createElement('canvas')),480,640);const start=performance.now(),n=window.loads.length,p=window.parses.length;const asset=id==='rover'?await window.rm.createRoverModel(['mastcam-z','supercam','pixl','sherloc','rimfax','meda','moxie']):null;const root=asset?.root??await window.cm.createCharacterModel(id);if(!asset)window.ca.prepareCrewAnimation(root)(0,false,true);const ready=performance.now()-start;studio.scene.add(root);if(asset){studio.camera.position.set(5,4,6);studio.camera.lookAt(0,1,0)}studio.renderer.render(studio.scene,studio.camera);const gl=studio.renderer.getContext();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));const first=performance.now()-start,resources={...studio.renderer.info.memory},triangles=studio.renderer.info.render.triangles;const heap=performance.memory.usedJSHeapSize;studio.scene.remove(root);if(asset)asset.dispose();else window.am.disposeModel(root);studio.renderer.render(studio.scene,studio.camera);const disposed={...studio.renderer.info.memory};studio.renderer.dispose();studio.renderer.forceContextLoss();studio.renderer.domElement.remove();return {id,readyMs:ready,firstRenderMs:first,downloads:window.loads.slice(n).map(r=>({...r,durationMs:r.end-r.start})),parseMs:window.parses.slice(p),resources,disposed,triangles,heap}},id);out.measurements.push(row);console.log(JSON.stringify(row));fs.writeFileSync(output,JSON.stringify(out,null,2));
 }
 await context.close();
 const slow=await setup(),cdp=await slow.context.newCDPSession(slow.page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:500000,uploadThroughput:500000});
 out.slow=await slow.page.evaluate(async()=>{
  const studio=window.cm.createCharacterStudio(document.body.appendChild(document.createElement('canvas')),480,640);
  const s=performance.now(),states=[];let root;
  try {
   root=await window.cm.createCharacterModel('lautaro',{onProgress:p=>states.push({...p,ms:performance.now()-s})});
   const ready=performance.now()-s;studio.scene.add(root);studio.renderer.render(studio.scene,studio.camera);
   const gl=studio.renderer.getContext();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
   return {ok:true,readyMs:ready,firstRenderMs:performance.now()-s,downloads:window.loads,states};
  }catch(e){return {ok:false,ms:performance.now()-s,error:String(e),downloads:window.loads,states}}
  finally{if(root)window.am.disposeModel(root);studio.renderer.dispose();studio.renderer.forceContextLoss();studio.renderer.domElement.remove()}
 });console.log('slow',JSON.stringify(out.slow));fs.writeFileSync(output,JSON.stringify(out,null,2));await slow.context.close();
}finally{await browser.close()}
