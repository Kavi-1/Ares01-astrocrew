import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import MissionProgress from '../ui/components/MissionProgress';
import { useGameStore } from '../store/gameStore';
import './launch.css';
import { missionChecks } from '../engine/campaign';
import { getScenario } from '../data/scenarios';

const stages = ['PAD CHECKOUT', 'COUNTDOWN', 'ASCENT', 'CRUISE', 'MARS ARRIVAL', 'ROVER DEPLOYMENT'];
const kickers = ['FLIGHT READINESS', 'FLIGHT READINESS', 'INTERPLANETARY TRANSIT', 'INTERPLANETARY TRANSIT', 'MARS ARRIVAL', 'MARS ARRIVAL'];
const titles = ['Final vehicle checks', 'Launch in progress', 'Trans-Mars injection', 'Cruise to Jezero', 'Entry, descent & landing', 'Deploy the rover'];
const copy = [
  'The configured rover is sealed inside the fairing. Review the flight manifest, then begin the countdown.',
  'Vehicle systems nominal. Confirm the countdown to ignite.',
  'The launch vehicle is ascending. The rover and cruise stage are on their interplanetary trajectory.',
  'Cruise complete. The entry vehicle is approaching Mars.',
  'Touchdown confirmed in Jezero Crater. Lowering the rover to the surface.',
  'Surface systems nominal. Your configured Perseverance rover is ready.',
];
const actions = ['BEGIN COUNTDOWN', 'CONFIRM LIFTOFF', 'CONTINUE FLIGHT', 'BEGIN MARS APPROACH', 'DEPLOY ROVER', 'ENTER MARS OPERATIONS'];

/** Scripted flight presentation. It reads the confirmed mission; it never decides an outcome. */
export default function LaunchCenter({ onArrive, onBack }: { onArrive: () => void; onBack: () => void }) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const arrived = useRef(false);
  const schedule = (callback: () => void, delay: number) => { timers.current.push(setTimeout(callback, delay)); };
  const arrive = () => {
    if (arrived.current || useGameStore.getState().missionPhase !== 'launch') return;
    arrived.current = true;
    onArrive();
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const host = useRef<HTMLDivElement>(null);
  const stage=useGameStore(s=>s.launchStage);
  const setStage=(value:number|((stage:number)=>number))=>useGameStore.getState().setLaunchStage(typeof value==='function'?value(useGameStore.getState().launchStage):value);
  const [busy, setBusy] = useState(false);
  const mission = useGameStore(s => s.confirmedMission);
  const stageRef = useRef(0);
  stageRef.current = stage;

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05080f');
    scene.fog = new THREE.FogExp2('#0b1220', .011);
    const camera = new THREE.PerspectiveCamera(46, root.clientWidth / Math.max(1, root.clientHeight), .1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    root.appendChild(renderer.domElement);

    // One shadowed key light plus ambient, as before the redesign: extra lights cost every pixel.
    scene.add(new THREE.HemisphereLight('#9dbfe6', '#2a1f18', .9));
    const key = new THREE.DirectionalLight('#ffd2a6', 3.2);
    key.position.set(16, 20, 12); key.castShadow = true;
    key.shadow.camera.left = -16; key.shadow.camera.right = 16; key.shadow.camera.top = 26; key.shadow.camera.bottom = -8;
    scene.add(key);

    const standard = (color: string, roughness = .7, metalness = .1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = scene) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    };
    const ground = add(new THREE.CircleGeometry(220, 48), standard('#0d1017', 1), 0, -.96, 0);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    const pad = add(new THREE.CylinderGeometry(9, 10.5, .8, 48), standard('#30363f', .85), 0, -.55, 0); pad.receiveShadow = true;
    const marking = add(new THREE.RingGeometry(6.2, 6.5, 64), new THREE.MeshBasicMaterial({ color: '#f4a862', transparent: true, opacity: .75 }), 0, -.14, 0);
    marking.rotation.x = -Math.PI / 2;
    const flameTrench = add(new THREE.BoxGeometry(3.2, .5, 15), standard('#191d24', .9), 0, -.6, 6); flameTrench.receiveShadow = true;

    // Service tower: a few boxes read as a lattice at this distance and cost almost nothing.
    const steel = standard('#4b5563', .55, .6), tower = new THREE.Group();
    const lattice: THREE.BufferGeometry[] = [];
    const beam = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); lattice.push(g); };
    for (const [x, z] of [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]]) beam(.14, 13, .14, x, 6.5, z);
    for (let y = 1.5; y <= 12.5; y += 2.2) { beam(1.54, .1, .1, 0, y, -.7); beam(1.54, .1, .1, 0, y, .7); beam(.1, .1, 1.54, -.7, y, 0); beam(.1, .1, 1.54, .7, y, 0); }
    // The whole lattice is a single draw call.
    const latticeGeometry = mergeGeometries(lattice); lattice.forEach(g => g.dispose());
    add(latticeGeometry, steel, 0, 0, 0, tower).castShadow = true;
    const arms: THREE.Mesh[] = [];
    for (const y of [4.4, 8.6]) { const arm = add(new THREE.BoxGeometry(2.6, .16, .34), steel, 1.2, y, 1.4, tower); arm.rotation.y = -.87; arms.push(arm); }
    const beaconMaterial = new THREE.MeshBasicMaterial({ color: '#ff6b5f' });
    add(new THREE.SphereGeometry(.12, 10, 8), beaconMaterial, 0, 13.2, 0, tower);
    tower.position.set(-2.2, 0, -2.6); scene.add(tower);
    const lampMaterial = new THREE.MeshBasicMaterial({ color: '#ffe2bf' });
    for (const [x, z] of [[7.4, -5.5], [-1.5, -8.5]]) {
      add(new THREE.CylinderGeometry(.05, .07, 3.2, 8), steel, x, 1.2, z);
      add(new THREE.BoxGeometry(.5, .28, .16), lampMaterial, x, 2.9, z);
    }

    const rocket = new THREE.Group(); scene.add(rocket);
    const white = standard('#e9e5da', .36, .22), dark = standard('#262b33', .42, .5), orange = standard('#d9743a', .46, .3);
    const body = add(new THREE.CylinderGeometry(.72, .88, 9, 32), white, 0, 4.5, 0, rocket); body.castShadow = true;
    add(new THREE.CylinderGeometry(.74, .74, .5, 32), dark, 0, 7.2, 0, rocket);
    const nose = add(new THREE.ConeGeometry(.72, 2.2, 32), white, 0, 10.1, 0, rocket); nose.castShadow = true;
    add(new THREE.CylinderGeometry(.8, .8, 1.4, 32), dark, 0, 1.7, 0, rocket);
    add(new THREE.CylinderGeometry(.56, .74, .7, 24), dark, 0, -.3, 0, rocket);
    for (let i = 0; i < 4; i++) {
      const fin = add(new THREE.BoxGeometry(.16, 1.8, .85), orange, Math.cos(i * Math.PI / 2) * .83, .9, Math.sin(i * Math.PI / 2) * .83, rocket);
      fin.rotation.y = -i * Math.PI / 2;
    }
    for (const x of [-1.15, 1.15]) {
      add(new THREE.CylinderGeometry(.3, .35, 6, 18), white, x, 3.2, 0, rocket).castShadow = true;
      add(new THREE.ConeGeometry(.3, .8, 18), orange, x, 6.6, 0, rocket);
      add(new THREE.CylinderGeometry(.22, .3, .4, 14), dark, x, 0, 0, rocket);
    }
    const flame = add(new THREE.ConeGeometry(.72, 3.4, 24), new THREE.MeshBasicMaterial({ color: '#ff9a4d', transparent: true, opacity: .88 }), 0, -2.2, 0, rocket);
    flame.rotation.x = Math.PI; flame.visible = false;
    const flameCore = add(new THREE.ConeGeometry(.34, 2.2, 16), new THREE.MeshBasicMaterial({ color: '#fff0d2', transparent: true, opacity: .95 }), 0, -1.6, 0, rocket);
    flameCore.rotation.x = Math.PI; flameCore.visible = false;

    const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#d6e6f2', size: .11, fog: false }));
    const coordinates: number[] = [];
    for (let i = 0; i < 520; i++) coordinates.push((Math.random() - .5) * 190, Math.random() * 110 - 6, (Math.random() - .5) * 120 - 40);
    stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(coordinates, 3)); scene.add(stars);
    const marsPlanet = new THREE.Group(); marsPlanet.position.set(-4, 78, -62);
    add(new THREE.SphereGeometry(17, 40, 28), standard('#a85b40', 1, 0), 0, 0, 0, marsPlanet);
    add(new THREE.SphereGeometry(17.4, 40, 28), new THREE.MeshBasicMaterial({ color: '#f0a070', transparent: true, opacity: .14, side: THREE.BackSide, fog: false }), 0, 0, 0, marsPlanet);
    marsPlanet.visible = false; scene.add(marsPlanet);

    // The rocket sits on the major golden section; the flight panel owns the minor one.
    const base = new THREE.Vector3(12.5, 6.2, 19), side = new THREE.Vector3(), look = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let cameraY = base.y;
    const frame = (targetY: number) => {
      const wide = camera.aspect > 1.05;
      side.set(base.x, 0, base.z).cross(up).normalize();
      const shift = wide ? 4.2 : 0;
      camera.position.set(base.x + side.x * shift, cameraY, base.z + side.z * shift);
      look.set(side.x * shift, targetY - (wide ? 0 : 3.2), side.z * shift);
      camera.lookAt(look);
    };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, disposed = false, elapsed = 0, last = performance.now();
    const animate = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min((now - last) / 1000, .05); last = now; elapsed += dt;
      const rate = dt * 60, flightStage = stageRef.current;
      if (!reduced) rocket.rotation.y = Math.sin(elapsed * .2) * .035;
      const burning = flightStage === 2;
      flame.visible = flameCore.visible = burning;
      if (burning && !reduced) flame.scale.set(1, 1 + Math.sin(elapsed * 50) * .08, 1);
      for (const arm of arms) arm.scale.x = THREE.MathUtils.lerp(arm.scale.x, flightStage >= 1 ? .35 : 1, Math.min(1, dt * 2));
      beaconMaterial.color.set(Math.sin(elapsed * 4) > 0 ? '#ff6b5f' : '#5a1f1b');
      let targetY = 4.6;
      if (flightStage === 2) {
        rocket.position.y = Math.min(70, rocket.position.y + .18 * rate);
        cameraY += (rocket.position.y + 9 - cameraY) * Math.min(1, .035 * rate); targetY = rocket.position.y + 4;
      } else if (flightStage === 3) {
        rocket.position.y = Math.min(70, rocket.position.y + .08 * rate); marsPlanet.visible = true;
        cameraY += (rocket.position.y + 8 - cameraY) * Math.min(1, .02 * rate); targetY = rocket.position.y + 4;
      } else if (flightStage === 4) {
        rocket.position.y = Math.max(0, rocket.position.y - .12 * rate); marsPlanet.visible = true; targetY = rocket.position.y + 4;
      } else if (flightStage === 5) targetY = rocket.position.y + 4;
      frame(targetY);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(animate);
    const observer = new ResizeObserver(() => {
      camera.aspect = root.clientWidth / Math.max(1, root.clientHeight); camera.updateProjectionMatrix();
      renderer.setSize(root.clientWidth, root.clientHeight);
    });
    observer.observe(root);
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach(item => item.dispose()); else material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === root) root.removeChild(renderer.domElement);
    };
  }, []);

  const advance = () => {
    if (busy) return;
    setBusy(true);
    if (stage === 0) { if(!useGameStore.getState().checkLaunch())return; setStage(1); }
    if (stage === 1) { setStage(2); schedule(() => setStage(3), 1800); }
    else if (stage === 2 || stage === 3) setStage(s => Math.min(4, s + 1));
    else if (stage === 4) { setStage(5); schedule(arrive, 2100); }
    else if (stage === 5) arrive();
    schedule(() => setBusy(false), stage === 1 || stage === 4 ? 1900 : 380);
  };
  const results = mission?.results, config = mission?.config;
  const checks=mission?.options?missionChecks(mission.options,mission.config):null,site=mission?.options?getScenario(mission.options.site).name:'Jezero';
  const actualTitle=stage===3?`Cruise to ${site}`:titles[stage];
  const actualCopy=stage===4&&checks?`Landing screening: ${checks.landingDemand.toFixed(2)} / 1125 kg-equivalent. ${checks.landingPass?'Mobility available after deployment.':'Accepted hard landing: mobility disabled after deployment.'}`:stage===5&&checks&&!checks.landingPass?'Stationary science remains available. The hard-landing cause remains in the mission record.':copy[stage];

  return <main className="ares-launch" data-launch-stage={stage}>
    <div className="ares-launch-world" ref={host} />
    <header className="ares-launch-top">
      <div className="launch-brand"><span className="surface-emblem" aria-hidden="true">A</span><div><b>ARES<em>—01</em></b><small>LAUNCH COMPLEX<span> // PERSEVERANCE CLASS</span></small></div></div>
      <MissionProgress phase="launch" />
      <div className="launch-header-actions"><span data-tutorial-tools/><span className="launch-clock" aria-hidden="true">{stage < 2 ? 'T−  HOLD' : stage < 4 ? 'T+  FLIGHT' : 'MARS  ARRIVAL'}</span></div>
    </header>
    <section className="ares-launch-panel" aria-label="Flight sequence">
      <p className="ares-kicker"><i aria-hidden="true" />[ FLIGHT <span aria-hidden="true">//</span> {kickers[stage]} ]</p>
      <h1>{actualTitle}</h1>
      <p className="launch-copy">{actualCopy}</p>
      <dl data-coach="flight-result" className="launch-manifest" aria-label="Flight manifest">
        <div><dt>ROVER MASS <small>CALC</small></dt><dd>{results ? results.massKg.toFixed(1) : '—'} <i>kg</i></dd></div>
        <div><dt>INSTRUMENTS</dt><dd>{config ? config.instruments.length : '—'} <i>/ 7</i></dd></div>
        <div><dt>RESERVE</dt><dd>{config ? (config.reserve * 100).toFixed(0) : '—'}<i>%</i></dd></div>
        <div><dt>DOWNLINK</dt><dd>{config?.downlink ?? '—'}</dd></div>
      </dl>
      <button className="ares-primary ax-btn ax-btn--primary" disabled={busy} onClick={advance}>{busy ? 'SEQUENCE IN PROGRESS…' : actions[stage]} <ArrowRight size={17} aria-hidden="true" /></button>
      <button className="ares-launch-back" onClick={() => { arrived.current = true; timers.current.forEach(clearTimeout); onBack(); }}><ArrowLeft size={14} aria-hidden="true" /> Return to engineering</button>
    </section>
    <ol className="ares-launch-steps" aria-label="Flight stages">
      {stages.map((name, index) => <li key={name} className={index === stage ? 'active' : index < stage ? 'done' : ''} aria-current={index === stage ? 'step' : undefined}>
        <span>{index < stage ? '✓' : String(index + 1).padStart(2, '0')}</span><small>{name}</small>
      </li>)}
    </ol>
  </main>;
}
