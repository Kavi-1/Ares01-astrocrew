import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CREW, getCrew, type CrewId } from '../../data/crew';
import { createCharacterModel } from '../../models/characterModel';
import { disposeModel, isModelAbort, modelFailure, modelProgressText, type ModelProgress } from '../../models/assets';
import { createRoverModel, INSTRUMENT_NODES } from '../../models/roverModel';
import { INSTRUMENTS, type InstrumentId, type RoverConfig } from '../../nasa/data';
import { prepareCrewAnimation } from '../../models/crewAnimation';

import { CREW_STATIONS as positions, roomBlocked, roomPath, type RoomPoint } from './roomNavigation';
type AssetId = CrewId | 'rover';
const initialProgress = () => Object.fromEntries([...CREW.map(member => [member.id, { phase: 'waiting' }]), ['rover', { phase: 'waiting' }]]) as Record<AssetId, ModelProgress>;
type Props = { workshop?: {config:RoverConfig; inspecting:InstrumentId|null; onInspect:(id:InstrumentId)=>void}; focus: CrewId; selected: CrewId; speaking: boolean; onSelect: (id: CrewId) => void; onClose: () => void; navigate?: { id: CrewId; seq: number };
  /** 'seat' frames the selected crew member for inspection; 'hub' is the walkable room. */
  mode?: 'seat' | 'hub';
  /** Sideways framing in metres, so the subject clears the open panel on wide screens. */
  shift?: number };
export default function CrewRoom(props: Props) {
  const host = useRef<HTMLDivElement>(null), latest = useRef(props);
  latest.current = props;
  const input = useRef(new Set<string>());
  const interact = useRef<() => void>(() => {});
  const [nearby, setNearby] = useState<CrewId | null>(null);
  const [modelProgress, setModelProgress] = useState(initialProgress);
  const retryModels = useRef<() => void>(() => {});
  const [unavailable, setUnavailable] = useState(false);
  useEffect(()=>{if(unavailable&&props.navigate)latest.current.onSelect(props.navigate.id);},[unavailable,props.navigate]);
  useEffect(() => {
    const node = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setUnavailable(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#070b14'); scene.fog = new THREE.Fog('#070b14', 17, 40);
    const camera = new THREE.PerspectiveCamera(43, 1, .1, 60); camera.position.set(0, 5, 10);
    // Two-colour ambient: cool from above, warm bounce from the Mars window. No extra per-pixel lights.
    scene.add(new THREE.HemisphereLight(0xc4d8f2, 0x5a3324, 2.2));
    const light = new THREE.DirectionalLight(0xffdcb8, 3.4); light.position.set(3, 7, 6); scene.add(light);
    const cyan = new THREE.PointLight(0x66d7df, 16, 12); cyan.position.set(0, 2.6, -1.8); scene.add(cyan);
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .65 })); o.position.set(x,y,z); scene.add(o); return o;
    };
    box(14,.2,14,0,-.12,0,'#121b2a');
    const grid=new THREE.GridHelper(14,14,0x2a3a54,0x1a2538);scene.add(grid);
    box(14,1, .3,0,.5,-6,'#182236'); box(14,.2,.3,0,4.4,-6,'#2f415c');
    for (const x of [-6,-3,0,3,6]) box(.12,4,.2,x,2.5,-6,'#3a4c66');
    // Rover bay: a marked turntable makes the vehicle the room's centrepiece.
    const bay=new THREE.Mesh(new THREE.CylinderGeometry(2.45,2.45,.05,48),new THREE.MeshStandardMaterial({color:'#18233a',roughness:.8}));bay.position.set(0,.015,-1.8);scene.add(bay);
    const bayRing=new THREE.Mesh(new THREE.RingGeometry(2.36,2.42,64),new THREE.MeshBasicMaterial({color:0xf4a862,transparent:true,opacity:.7,side:THREE.DoubleSide}));bayRing.rotation.x=-Math.PI/2;bayRing.position.set(0,.05,-1.8);scene.add(bayRing);
    const mars = new THREE.Mesh(new THREE.SphereGeometry(3.8,48,32),new THREE.MeshStandardMaterial({color:'#b76342',roughness:1})); mars.position.set(3,3,-13); scene.add(mars);
    const table = box(2.6,.12,2.2,0,.85,-1.8,'#425762');
    const tableBase = box(1.4,.8,1.2,0,.4,-1.8,'#172731');
    if(latest.current.workshop){table.visible=false;tableBase.visible=false;}
    // Fixed workstations remain usable even when their crew member is the player.
    for(const [i,[x,z]] of positions.entries()){
      const consoleMesh=box(.55,.75,.3,x,.38,z-.9,'#1b2740');
      consoleMesh.userData.crew=CREW[i].id;
      const screen=new THREE.Mesh(new THREE.BoxGeometry(.47,.02,.22),new THREE.MeshBasicMaterial({color:0x2f8f99}));screen.position.set(x,.765,z-.9);scene.add(screen);
    }
    const actors: {id:CrewId; root:THREE.Group; animate:ReturnType<typeof prepareCrewAnimation>}[] = [];
    const clickables: THREE.Object3D[] = [];
    scene.children.forEach(o=>{if(o.userData.crew)clickables.push(o);});
    const stations = CREW.map((member,i) => {
      const [x,z] = positions[i];
      const ring = new THREE.Mesh(new THREE.RingGeometry(.57,.62,40),new THREE.MeshBasicMaterial({color:0x73dfe4,side:THREE.DoubleSide})); ring.rotation.x=-Math.PI/2; ring.position.set(x,.02,z); scene.add(ring);
      const proxy = box(.85,1.9,.65,x,.95,z,'#22304a'); proxy.userData.crew=member.id; clickables.push(proxy);
      return {proxy,ring};
    });
    // Floating name tags identify each specialist without a roster panel.
    const nameplates = CREW.map(member => {
      const tag=document.createElement('span');tag.className='room-nameplate';tag.setAttribute('aria-hidden','true');
      const name=document.createElement('b');name.textContent=member.name;const role=document.createElement('i');role.textContent=member.role;
      tag.append(name,role);tag.hidden=true;node.appendChild(tag);return tag;
    });
    const plateAnchor=new THREE.Vector3();
    const player = new THREE.Group(); player.position.set(0,0,3.8); scene.add(player);
    const fallback = new THREE.Mesh(new THREE.CapsuleGeometry(.25,.8,4,8), new THREE.MeshStandardMaterial({color:'#efae75'}));
    fallback.position.y=.85; player.add(fallback);
    const playerRing = new THREE.Mesh(new THREE.RingGeometry(.35,.4,32),new THREE.MeshBasicMaterial({color:0xffc28c,side:THREE.DoubleSide}));
    playerRing.rotation.x=-Math.PI/2; playerRing.position.y=.03; player.add(playerRing);
    const marker = new THREE.Mesh(new THREE.RingGeometry(.15,.22,32),new THREE.MeshBasicMaterial({color:0x8ce5e9,side:THREE.DoubleSide}));
    marker.rotation.x=-Math.PI/2; marker.position.y=.03; marker.visible=false; scene.add(marker);
    let path:RoomPoint[]=[], pending:CrewId|null=null, near:CrewId|null=null, lastNavigate=-1, wasSpeaking=false, lastSeat:CrewId|null=null;
    const seat=()=>CREW.findIndex(c=>c.id===latest.current.selected);
    const release=()=>{input.current.clear();};
    const stop=()=>{release();path=[];pending=null;marker.visible=false;};
    const talk=(id:CrewId)=>{stop();latest.current.onSelect(id);};
    interact.current=()=>{if(near&&!latest.current.speaking)talk(near);};
    const navigate=(id:CrewId)=>{
      if(id===latest.current.selected&&!latest.current.workshop){talk(id);return;}
      const [x,z]=positions[CREW.findIndex(c=>c.id===id)];
      path=roomPath(player.position,{x,z:z+1.15},seat());pending=id;
      if(Math.hypot(player.position.x-x,player.position.z-z)<1.8)talk(id);
    };
    const down=(e:KeyboardEvent)=>{
      const key=e.key.toLowerCase();
      if(key==='escape'){stop();latest.current.onClose();return;}
      if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;
      if(latest.current.speaking)return;
      if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','e'].includes(key))e.preventDefault();
      if(key==='e'&&!e.repeat)interact.current();else input.current.add(key);
    };
    const up=(e:KeyboardEvent)=>input.current.delete(e.key.toLowerCase());
    const visibility=()=>{if(document.hidden)stop();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',stop);
    document.addEventListener('visibilitychange',visibility);
    let disposed=false, frame=0;
    const controller = new AbortController(), states = initialProgress();
    const awaitingRender = new Set<AssetId>();
    const report = (id: AssetId, progress: ModelProgress) => {
      if (disposed) return;
      states[id] = progress;
      setModelProgress(previous => ({ ...previous, [id]: progress }));
      if (id === 'rover') {
        node.dataset.roverPhase = progress.phase;
        node.dataset.roverStatus = progress.phase === 'ready' ? 'ready' : progress.phase === 'failed' ? 'fallback' : 'loading';
      }
    };
    const hotspots:THREE.Mesh[]=[];
    const instrumentButtons:{id:InstrumentId;button:HTMLButtonElement;anchor:THREE.Vector3}[]=[];
    const anchors=new Map<InstrumentId,THREE.Vector3>();
    let rover:Awaited<ReturnType<typeof createRoverModel>>|null=null, roverConfigKey='';
    let highlight:THREE.BoxHelper|null=null, highlighted:InstrumentId|null=null;
    const roverFallback=box(2,.5,2.5,0,.35,-1.8,'#2a3a55');roverFallback.visible=!!latest.current.workshop;
    node.dataset.roverStatus=latest.current.workshop?'loading':'unused';
    const loadRover = () => {
      if (!latest.current.workshop || disposed) return;
      report('rover', { phase: 'waiting' });
      void createRoverModel(latest.current.workshop.config.instruments, { signal: controller.signal, onProgress: progress => report('rover', progress) }).then(asset=>{
      if(disposed){asset.dispose();return;}
      rover=asset;asset.root.position.set(0,0,-1.8);scene.add(asset.root);asset.root.updateMatrixWorld(true);
      roverFallback.visible=false;awaitingRender.add('rover');
      for(const [i,instrument] of INSTRUMENTS.entries()){
        const name=INSTRUMENT_NODES[instrument.id]?.[0];
        const target=name?asset.root.getObjectByName(name):null;
        const anchor=target?new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3()):new THREE.Vector3(instrument.id==='moxie'?.6:-.6,instrument.id==='moxie'?1.1:1.7,-1.8);
        anchors.set(instrument.id,anchor);
        const hotspot=new THREE.Mesh(new THREE.SphereGeometry(.045,12,8),new THREE.MeshBasicMaterial({color:0x8de5e7,depthTest:false}));
        hotspot.position.copy(anchor);hotspot.userData.instrument=instrument.id;hotspot.renderOrder=10;scene.add(hotspot);hotspots.push(hotspot);
        // Screen-sized buttons keep nearby mast markers readable and keyboard accessible.
        const button=document.createElement('button');
        button.className='rover-hotspot';button.type='button';
        button.setAttribute('aria-label','Inspect '+instrument.name+' on rover');
        button.title=instrument.name;button.textContent=String(i+1);
        button.onclick=()=>latest.current.workshop?.onInspect(instrument.id);
        node.appendChild(button);instrumentButtons.push({id:instrument.id,button,anchor});

      }
      }).catch(error => {
        if (!disposed && !isModelAbort(error)) {
          awaitingRender.delete('rover');
          if (rover) { rover.root.removeFromParent(); rover.dispose(); rover = null; }
          for (const hotspot of hotspots.splice(0)) { hotspot.removeFromParent(); disposeModel(hotspot); }
          for (const { button } of instrumentButtons.splice(0)) { button.onclick = null; button.remove(); }
          anchors.clear(); roverFallback.visible = true;
          console.warn('Room rover unavailable; controls remain active.', error); report('rover', modelFailure(error));
        }
      });
    };
    loadRover();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const crewQueue = CREW.map(member => member.id);
    let loadingCrew = false;
    const loadCrew = async () => {
      if (loadingCrew || disposed) return;
      loadingCrew = true;
      try {
        while (crewQueue.length && !disposed) {
          const id = crewQueue.shift()!, i = CREW.findIndex(member => member.id === id);
          let root: THREE.Group | undefined;
          try {
            root = await createCharacterModel(id, { signal: controller.signal, onProgress: progress => report(id, progress) });
            if (disposed) { disposeModel(root); break; }
            const animate = prepareCrewAnimation(root); animate(0,false,true);
            root.position.set(positions[i][0],0,positions[i][1]); root.rotation.y=positions[i][0]<0?.35:-.35;
            root.userData.crew=id; scene.add(root); clickables.push(root); stations[i].proxy.visible=false; actors.push({id,root,animate});
            awaitingRender.add(id);
          } catch (error) {
            if (root) { root.removeFromParent(); disposeModel(root); }
            if (!disposed && !isModelAbort(error)) { console.warn('Crew model unavailable; station remains active.', id, error); report(id, modelFailure(error)); }
          }
        }
      } finally { loadingCrew = false; }
    };
    void loadCrew();
    retryModels.current = () => {
      if (states.rover.phase === 'failed') loadRover();
      for (const member of CREW) if (states[member.id].phase === 'failed') {
        report(member.id, { phase: 'waiting' }); crewQueue.push(member.id);
      }
      void loadCrew();
    };
    const resize=()=>{const w=node.clientWidth,h=node.clientHeight;renderer.setSize(w,h);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize); observer.observe(node);resize();
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    let pointerStart={x:0,y:0}, turning=false, turnX=0;
    const pointerDown=(e:PointerEvent)=>{pointerStart={x:e.clientX,y:e.clientY};turning=latest.current.mode==='seat';turnX=e.clientX;};
    // Seat inspection: drag to turn the selected crew member in place.
    const pointerMove=(e:PointerEvent)=>{if(!turning||latest.current.mode!=='seat')return;player.rotation.y+=(e.clientX-turnX)*.012;turnX=e.clientX;};
    const pointerEnd=()=>{turning=false;};
    const click=(event:PointerEvent)=>{
      turning=false;
      if(event.button!==0||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>12)return;
      const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
      if(latest.current.workshop && (!latest.current.speaking||latest.current.workshop.inspecting)){
        const hit=ray.intersectObjects(hotspots,false)[0];
        if(hit){latest.current.workshop.onInspect(hit.object.userData.instrument);return;}
      }
      if(latest.current.mode==='seat'){
        for(const hit of ray.intersectObjects(clickables,true)){
          let o:THREE.Object3D|null=hit.object;while(o&&!o.userData.crew)o=o.parent;
          if(o){latest.current.onSelect(o.userData.crew);return;}
        }
        return;
      }
      if(latest.current.speaking)return;
      for(const hit of ray.intersectObjects(clickables,true)){
        let o:THREE.Object3D|null=hit.object;while(o&&!o.userData.crew)o=o.parent;
        if(o){navigate(o.userData.crew);return;}
      }
      const hit=new THREE.Vector3();
      if(ray.ray.intersectPlane(ground,hit)){path=roomPath(player.position,hit,seat());pending=null;}
    };
    renderer.domElement.addEventListener('pointerdown',pointerDown);
    renderer.domElement.addEventListener('pointermove',pointerMove);
    renderer.domElement.addEventListener('pointercancel',pointerEnd);
    renderer.domElement.addEventListener('pointerleave',pointerEnd);
    renderer.domElement.addEventListener('pointerup',click);
    const look=new THREE.Vector3(0,1,-2), goal=new THREE.Vector3(), lookGoal=new THREE.Vector3(); let last=performance.now();
    const tick=(now:number)=>{
      if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;
      const p=latest.current, index=CREW.findIndex(c=>c.id===p.focus);
      const [x,z]=p.focus===p.selected?[player.position.x,player.position.z]:positions[index];
      if(p.speaking&&!wasSpeaking)stop();wasSpeaking=p.speaking;
      if(p.selected!==lastSeat){lastSeat=p.selected;if(p.mode==='seat')player.rotation.y=0;}
      if(p.navigate&&p.navigate.seq!==lastNavigate){lastNavigate=p.navigate.seq;navigate(p.navigate.id);}
      const old=player.position.clone(), direction=new THREE.Vector2();
      if(!p.speaking&&!document.hidden){
        const k=input.current;
        direction.set(Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft')),Number(k.has('s')||k.has('arrowdown'))-Number(k.has('w')||k.has('arrowup')));
        if(direction.lengthSq()){path=[];pending=null;}
        else if(path.length){const next=path[0];direction.set(next.x-player.position.x,next.z-player.position.z);if(direction.length()<.12){path.shift();direction.set(0,0);}}
        const remaining=direction.length();direction.normalize();
        const step=Math.min((k.has('shift')?3.8:2.6)*dt,remaining);
        if(!roomBlocked(player.position.x+direction.x*step,player.position.z,seat()))player.position.x+=direction.x*step;
        if(!roomBlocked(player.position.x,player.position.z+direction.y*step,seat()))player.position.z+=direction.y*step;
        if(pending&&!path.length){const id=pending,[tx,tz]=positions[CREW.findIndex(c=>c.id===id)];pending=null;if(Math.hypot(player.position.x-tx,player.position.z-tz)<1.9)talk(id);}
      }
      const moving=player.position.distanceToSquared(old)>.000001;
      if(moving){const angle=Math.atan2(direction.x,direction.y);player.rotation.y+=Math.atan2(Math.sin(angle-player.rotation.y),Math.cos(angle-player.rotation.y))*Math.min(1,dt*12);}
      marker.visible=path.length>0;if(path.length){const end=path[path.length-1];marker.position.set(end.x,.03,end.z);}
      let nearest:CrewId|null=null, distance=1.85;
      positions.forEach(([sx,sz],i)=>{if(i===seat()&&!p.workshop)return;const d=Math.hypot(player.position.x-sx,player.position.z-sz);if(d<distance){nearest=CREW[i].id;distance=d;}});
      if(nearest!==near){near=nearest;setNearby(near);}
      node.dataset.playerX=player.position.x.toFixed(3);node.dataset.playerZ=player.position.z.toFixed(3);
      const portrait=camera.aspect<1, wide=camera.aspect>=1.15;
      if(p.mode==='seat'){goal.set(x,1.5,z+(portrait?5.8:4.2));lookGoal.set(x,portrait?.3:1.02,z);}
      else if(p.speaking){goal.set(x*.75,2.3,z+(portrait?6:4.6));lookGoal.set(x,portrait?.25:1.1,z);}else{const px=player.position.x*.65,pz=player.position.z*.55;goal.set(px,camera.aspect<.8?9:7,pz+(camera.aspect<.8?12:9));lookGoal.set(px,.7,pz-1.4);}
      const workshop=p.workshop;
      if(workshop&&rover){
        const key=workshop.config.instruments.join(',');
        if(key!==roverConfigKey){rover.setInstruments(workshop.config.instruments);roverConfigKey=key;}
        const selected=workshop.inspecting;
        if(selected!==highlighted){
          if(highlight){scene.remove(highlight);highlight.geometry.dispose();(highlight.material as THREE.Material).dispose();highlight=null;}
          highlighted=selected;
          const name=selected?INSTRUMENT_NODES[selected]?.[0]:null, target=name?rover.root.getObjectByName(name):null;
          if(target){highlight=new THREE.BoxHelper(target,0xffbb7c);scene.add(highlight);}
        }
        if(selected&&anchors.has(selected)){
          const target=anchors.get(selected)!;
          goal.copy(target).add(new THREE.Vector3(2.7,portrait?2.6:1.5,4));
          lookGoal.copy(target);
          // Bottom-sheet layouts: aim below the instrument so it sits in the clear upper band.
          if(portrait)lookGoal.y-=1.3;
        }
        hotspots.forEach(o=>{(o.material as THREE.MeshBasicMaterial).color.set(o.userData.instrument===selected?'#ffb576':'#8de5e7');});
      }
      const shift=wide&&(p.speaking||p.mode==='seat')?p.shift??0:0;
      if(shift){goal.x+=shift;lookGoal.x+=shift;}
      const blend=reduced?1:1-Math.exp(-dt*3);
      // Settle exactly once the remaining travel is imperceptible, so markers stop drifting.
      if(camera.position.distanceToSquared(goal)<1e-5&&look.distanceToSquared(lookGoal)<1e-5){camera.position.copy(goal);look.copy(lookGoal);}
      else{camera.position.lerp(goal,blend);look.lerp(lookGoal,blend);}
      camera.lookAt(look);
      fallback.visible=!actors.some(a=>a.id===p.selected);
      actors.forEach((actor,i)=>{
        const isPlayer=actor.id===p.selected, station=positions[CREW.findIndex(c=>c.id===actor.id)];
        if(isPlayer){if(actor.root.parent!==player)player.add(actor.root);actor.root.position.set(0,moving&&!reduced?Math.abs(Math.sin(now/1000*9))*.025:0,0);actor.root.rotation.y=0;}
        else{
          if(actor.root.parent!==scene)scene.add(actor.root);actor.root.position.set(station[0],0,station[1]);
          const angle=Math.atan2(player.position.x-station[0],player.position.z-station[1]);
          actor.root.rotation.y+=Math.atan2(Math.sin(angle-actor.root.rotation.y),Math.cos(angle-actor.root.rotation.y))*Math.min(1,dt*2);
        }
        actor.animate(now/1000+i,p.speaking&&p.focus===actor.id,reduced,isPlayer&&moving);
      });
      stations.forEach((s,i)=>(s.ring.material as THREE.MeshBasicMaterial).color.set(i===index?'#f4a862':'#2b4560'));
      nameplates.forEach((tag,i)=>{
        const own=i===seat();
        plateAnchor.set(own?player.position.x:positions[i][0],2.04,own?player.position.z:positions[i][1]).project(camera);
        // Tags yield to the panels: the dossier in seat mode, the margins rail in the hub.
        const plateX=(plateAnchor.x+1)*node.clientWidth/2, clear=!wide||plateX>(p.mode==='seat'?node.clientWidth*.52:330);
        const shown=!own&&clear&&(p.mode==='seat'||!p.speaking)&&plateAnchor.z>-1&&plateAnchor.z<1&&Math.abs(plateAnchor.x)<.96&&Math.abs(plateAnchor.y)<.92;
        tag.hidden=!shown;
        if(shown)tag.style.transform=`translate(${Math.round(plateX)}px,${Math.round((1-plateAnchor.y)*node.clientHeight/2)}px) translate(-50%,-100%)`;
        tag.classList.toggle('is-near',CREW[i].id===near);
      });
      instrumentButtons.forEach(({id,button,anchor},i)=>{
        const projected=anchor.clone().project(camera);
        const visible=!!workshop&&(!p.speaking||!!workshop.inspecting)&&projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1;
        button.hidden=!visible;hotspots[i].visible=visible;
        // Whole-pixel placement keeps markers steady while the camera eases to rest.
        button.style.transform=`translate(${Math.round((projected.x+1)*node.clientWidth/2)}px,${Math.round((1-projected.y)*node.clientHeight/2)}px) translate(-50%,-50%)`;
        button.classList.toggle('selected',workshop?.inspecting===id);
        button.textContent=workshop?.inspecting===id?INSTRUMENTS.find(instrument=>instrument.id===id)!.name:String(i+1);
      });
      if(!document.hidden) {
        renderer.render(scene,camera);
        for (const id of awaitingRender) report(id, { phase: 'ready' });
        awaitingRender.clear();
      }
    };frame=requestAnimationFrame(tick);
    return()=>{disposed=true;controller.abort();crewQueue.length=0;retryModels.current=()=>{};stop();interact.current=()=>{};window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointercancel',pointerEnd);renderer.domElement.removeEventListener('pointerleave',pointerEnd);for(const tag of nameplates)tag.remove();cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener('pointerup',click);for(const {button} of instrumentButtons){button.onclick=null;button.remove();}
      disposeModel(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[]);
  const arriving = CREW.find(member => !['ready', 'failed'].includes(modelProgress[member.id].phase));
  const readyCount = CREW.filter(member => modelProgress[member.id].phase === 'ready').length;
  const failed = CREW.some(member => modelProgress[member.id].phase === 'failed') || !!props.workshop && modelProgress.rover.phase === 'failed';
  return <><div className="crew-room" aria-label="3D mission briefing room"><div className="room-canvas" ref={host} />
    {(unavailable || arriving || failed || !!props.workshop && modelProgress.rover.phase !== 'ready') && <div className="room-status" role="status">
      {unavailable ? <span>3D unavailable. Use the crew buttons to continue.</span> : <>
        {props.workshop && modelProgress.rover.phase !== 'ready' && <span data-loading-asset="rover" data-loading-phase={modelProgress.rover.phase}>{modelProgressText(modelProgress.rover, 'Perseverance')}</span>}
        {arriving && <span data-loading-asset={arriving.id} data-loading-phase={modelProgress[arriving.id].phase}>{modelProgressText(modelProgress[arriving.id], arriving.name)} · {readyCount}/6 crew ready</span>}
        {failed && <><span>Some models unavailable · controls remain active</span><button type="button" onClick={() => retryModels.current()}>Retry unavailable models</button></>}
      </>}
    </div>}
  </div><div className="room-walk-controls">
      {!props.speaking&&<>
      {nearby&&<button className="room-talk" onClick={()=>interact.current()}><kbd className="ax-key">E</kbd> Talk to {getCrew(nearby).name}</button>}
      <p className="room-keys"><kbd className="ax-key">WASD</kbd> Walk <kbd className="ax-key">Shift</kbd> Run <kbd className="ax-key">Click</kbd> Move</p>
      <div className="room-dpad" aria-label="Walk controls">{[['w','↑'],['a','←'],['s','↓'],['d','→']].map(([key,label])=><button key={key} aria-label={'Walk '+({w:'forward',a:'left',s:'backward',d:'right'}[key])} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);input.current.add(key);}} onPointerUp={()=>input.current.delete(key)} onPointerCancel={()=>input.current.clear()} onLostPointerCapture={()=>input.current.delete(key)}>{label}</button>)}</div></>}
    </div></>;
}
