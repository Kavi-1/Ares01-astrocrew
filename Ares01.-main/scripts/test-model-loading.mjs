import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Texture } from 'three';
const server = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let passed = 0;
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
const test = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
function clock() {
  let now=0, seq=0;const timers=new Map();
  return { setTimer(fn,ms){const id=++seq;timers.set(id,{fn,at:now+ms});return id},clearTimer(id){timers.delete(id)},get count(){return timers.size},
    async advance(ms){const end=now+ms;while(true){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await flush()}now=end;await flush()} };
}
function network({total,encoding,status=200,headersPending=false}={}) {
  const requests=[];
  const fetch=async(url,{signal})=>{
    let stream, rejectHeaders;
    const body=new ReadableStream({start(c){stream=c}});
    const request={url,signal,push:n=>stream.enqueue(new Uint8Array(n)),close:()=>stream.close()};requests.push(request);
    signal.addEventListener('abort',()=>{const error=new DOMException('Aborted','AbortError');stream.error(error);rejectHeaders?.(error)},{once:true});
    if(headersPending)return new Promise((_,reject)=>{rejectHeaders=reject});
    return new Response(body,{status,headers:{...(total===undefined?{}:{'content-length':String(total)}),...(encoding?{'content-encoding':encoding}:{})}});
  };return {fetch,requests};
}
try {
 const {ModelDownloads,loadModel,disposeModel,modelProgressText}=await server.ssrLoadModule('/src/models/assets.ts');
 await test('ordinary download, truthful bytes, cache reuse and no remaining stall timer',async()=>{
  const net=network({total:8}),time=clock(),cache=new ModelDownloads({...net,...time}),states=[];
  const p=cache.get('/ordinary',{onProgress:x=>states.push(x)});await flush();net.requests[0].push(3);await flush();net.requests[0].push(5);net.requests[0].close();const b=await p;
  assert.equal(b.byteLength,8);assert.deepEqual(states.filter(x=>x.loadedBytes).map(x=>x.loadedBytes),[3,8]);assert.ok(states.every(x=>x.phase==='downloading'));
  assert.equal(await cache.get('/ordinary'),b);assert.equal(net.requests.length,1);assert.equal(time.count,0);assert.deepEqual(cache.stats,{active:0,entries:1,bytes:8});
 });
 await test('Lautaro 16,802,132 bytes progresses at 4 Mbps for 33.605 simulated seconds',async()=>{
  const total=16802132,net=network({total}),time=clock(),cache=new ModelDownloads({...net,...time});const p=cache.get('/lautaro');await flush();
  let remaining=total;while(remaining){const n=Math.min(500000,remaining);await time.advance(n/500);net.requests[0].push(n);await flush();remaining-=n;}
  net.requests[0].close();assert.equal((await p).byteLength,total);assert.equal(net.requests[0].signal.aborted,false);assert.equal(time.count,0);
 });
 await test('continuing progress can exceed several total-timeout windows',async()=>{
  const net=network({total:5}),time=clock(),cache=new ModelDownloads({...net,...time});const p=cache.get('/long');await flush();
  for(let i=0;i<5;i++){await time.advance(29999);net.requests[0].push(1);await flush();}net.requests[0].close();assert.equal((await p).byteLength,5);
 });
 for(const headersPending of [false,true])await test(`genuine stall ${headersPending?'before headers':'after progress'} fails and is retryable`,async()=>{
  const net=network({total:8,headersPending}),time=clock(),cache=new ModelDownloads({...net,...time});const p=cache.get('/stall');const rejected=assert.rejects(p,/stalled.*\/stall.*30s/);await flush();
  if(!headersPending){net.requests[0].push(2);await flush();}
  await time.advance(30000);await rejected;assert.equal(net.requests[0].signal.aborted,true);assert.deepEqual(cache.stats,{active:0,entries:0,bytes:0});assert.equal(time.count,0);
 });
 await test('retry starts a fresh request after failure',async()=>{
  const net=network({total:4}),time=clock(),cache=new ModelDownloads({...net,...time});const old=cache.get('/retry'),rejected=assert.rejects(old,/stalled/);await flush();await time.advance(30000);await rejected;
  const fresh=cache.get('/retry');await flush();net.requests[1].push(4);net.requests[1].close();assert.equal((await fresh).byteLength,4);assert.equal(net.requests.length,2);
 });
 await test('concurrent consumers share download; cancelling one preserves the other',async()=>{
  const net=network({total:4}),time=clock(),cache=new ModelDownloads({...net,...time}),a=new AbortController(),seen=[];
  const first=cache.get('/shared',{signal:a.signal,onProgress:p=>seen.push(p)}),rejected=assert.rejects(first,{name:'AbortError'}),second=cache.get('/shared');await flush();a.abort();await rejected;const count=seen.length;
  assert.equal(net.requests.length,1);assert.equal(net.requests[0].signal.aborted,false);net.requests[0].push(4);net.requests[0].close();assert.equal((await second).byteLength,4);assert.equal(seen.length,count);
 });
 await test('last cancellation aborts download; stale completion cannot remove its replacement',async()=>{
  const net=network({total:4}),time=clock(),cache=new ModelDownloads({...net,...time}),a=new AbortController();
  const first=cache.get('/race',{signal:a.signal}),rejected=assert.rejects(first,{name:'AbortError'});await flush();a.abort();const second=cache.get('/race');await flush();await rejected;
  assert.equal(net.requests[0].signal.aborted,true);assert.equal(net.requests[1].signal.aborted,false);assert.equal(cache.stats.active,1);
  net.requests[1].push(4);net.requests[1].close();await second;assert.equal(cache.stats.entries,1);
 });
 await test('pre-cancelled request performs no network work',async()=>{const net=network(),cache=new ModelDownloads(net),a=new AbortController();a.abort();await assert.rejects(cache.get('/never',{signal:a.signal}),{name:'AbortError'});assert.equal(net.requests.length,0)});
 for(const [name,options,bytes,error] of [['HTTP error',{status:503},0,/HTTP 503/],['empty',{},0,/Empty model/],['truncated',{total:8},4,/Incomplete model/]])await test(name+' never enters cache',async()=>{
  const net=network(options),time=clock(),cache=new ModelDownloads({...net,...time});const p=cache.get('/invalid'),rejected=assert.rejects(p,error);await flush();if(options.status!==503){if(bytes)net.requests[0].push(bytes);net.requests[0].close()}await rejected;assert.equal(cache.stats.entries,0);assert.equal(time.count,0);
 });
 for(const options of [{},{total:2,encoding:'gzip'}])await test('unknown/encoded totals report bytes without invented percentage '+JSON.stringify(options),async()=>{
  const net=network(options),cache=new ModelDownloads(net),states=[];const p=cache.get('/unknown',{onProgress:x=>states.push(x)});await flush();net.requests[0].push(5);net.requests[0].close();await p;
  assert.ok(states.every(x=>x.totalBytes===undefined));assert.ok(!modelProgressText(states.at(-1),'crew').includes('%'));
 });
 await test('LRU has both entry and byte bounds; active requests are not evicted',async()=>{
  const net=network({total:4}),cache=new ModelDownloads({...net,maxEntries:2,maxBytes:8});
  const pending=cache.get('/active');await flush();
  for(const url of ['/a','/b','/c']){const p=cache.get(url);await flush();net.requests.at(-1).push(4);net.requests.at(-1).close();await p;}
  assert.equal(cache.stats.active,1);assert.equal(net.requests[0].signal.aborted,false);assert.equal(cache.stats.entries,2);assert.equal(cache.stats.bytes,8);
  net.requests[0].push(4);net.requests[0].close();await pending;assert.equal(cache.stats.bytes,8);
  const p=cache.get('/a');await flush();assert.equal(net.requests.length,5);net.requests.at(-1).push(4);net.requests.at(-1).close();await p;
 });
 await test('oversized download is usable without retained cache bytes',async()=>{const net=network({total:4}),cache=new ModelDownloads({...net,maxBytes:3});const p=cache.get('/large');await flush();net.requests[0].push(4);net.requests[0].close();await p;assert.equal(cache.stats.entries,0)});
 const originalFetch=globalThis.fetch,originalParse=GLTFLoader.prototype.parseAsync;
 try {
  globalThis.fetch=async()=>new Response(new Uint8Array([1,2,3,4]),{headers:{'content-length':'4'}});
  await test('load lifecycle stays preparing until consumer has prepared/rendered; no false ready',async()=>{
    GLTFLoader.prototype.parseAsync=async()=>({scene:new Group(),scenes:[]});const states=[];await loadModel('/parse-success',{onProgress:p=>states.push(p.phase)});
    assert.equal(states[0],'waiting');assert.ok(states.includes('downloading'));assert.equal(states.at(-1),'preparing');assert.ok(!states.includes('ready'));
  });
  await test('cancellation during parse rejects promptly and disposes late geometry/material/texture exactly once',async()=>{
    const root=new Group(),geometry=new BoxGeometry(),texture=new Texture(),material=new MeshBasicMaterial({map:texture});root.add(new Mesh(geometry,material));let g=0,m=0,t=0;
    geometry.addEventListener('dispose',()=>g++);material.addEventListener('dispose',()=>m++);texture.addEventListener('dispose',()=>t++);
    let finish,started;const startedPromise=new Promise(r=>started=r);GLTFLoader.prototype.parseAsync=()=>{started();return new Promise(r=>finish=r)};
    const controller=new AbortController(),states=[];const p=loadModel('/late-parse',{signal:controller.signal,onProgress:p=>states.push(p.phase)}),rejected=assert.rejects(p,{name:'AbortError'});
    await startedPromise;controller.abort();await rejected;const count=states.length;finish({scene:root,scenes:[root,root]});await flush();assert.deepEqual([g,m,t],[1,1,1]);assert.equal(states.length,count);
  });
  await test('malformed parse invalidates cached bytes so retry fetches again',async()=>{
    let fetches=0;globalThis.fetch=async()=>{fetches++;return new Response(new Uint8Array([1,2,3,4]))};GLTFLoader.prototype.parseAsync=async()=>{throw new Error('bad GLB')};
    await assert.rejects(loadModel('/corrupt'),/\/corrupt.*bad GLB/);GLTFLoader.prototype.parseAsync=async()=>({scene:new Group(),scenes:[]});await loadModel('/corrupt');assert.equal(fetches,2);
  });
  await test('disposal deduplicates shared geometry, materials and skeletons',async()=>{
    const root=new Group(),g=new BoxGeometry(),m=new MeshBasicMaterial();let disposed=0,skinned=0;g.addEventListener('dispose',()=>disposed++);const skeleton={dispose(){skinned++}};
    for(let i=0;i<2;i++){const mesh=new Mesh(g,m);mesh.skeleton=skeleton;root.add(mesh)}disposeModel(root);assert.equal(disposed,1);assert.equal(skinned,1);
  });
 } finally { globalThis.fetch=originalFetch;GLTFLoader.prototype.parseAsync=originalParse; }
 console.log(`PASS ${passed} focused model-loading tests`);
} finally {await server.close();}
