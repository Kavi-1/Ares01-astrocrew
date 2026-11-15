import { useEffect, useRef, useState } from 'react';
import { RotateCcw, UserRound } from 'lucide-react';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CrewMember } from '../../data/crew';
import { createCharacterModel, createCharacterStudio } from '../../models/characterModel';
import { disposeModel, isModelAbort, modelFailure, modelProgressText, type ModelProgress } from '../../models/assets';

export default function CharacterPreview({ member }: { member: CrewMember }) {
  const host = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<ModelProgress>({ phase: 'waiting' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    const controller = new AbortController();
    let model: Awaited<ReturnType<typeof createCharacterModel>> | undefined;
    let cleanup = () => {};
    setProgress({ phase: 'waiting' });
    try {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('aria-label', `3D preview of ${member.name}. Drag to rotate.`);
      const { renderer, scene, camera } = createCharacterStudio(canvas, container.clientWidth, container.clientHeight);
      container.appendChild(canvas);
      const controls = new OrbitControls(camera, canvas);
      controls.target.set(0, .95, 0);
      controls.enablePan = false;
      controls.minDistance = 2.8; controls.maxDistance = 5.5;
      controls.minPolarAngle = Math.PI / 3; controls.maxPolarAngle = Math.PI / 1.8;
      const render = () => renderer.render(scene, camera);
      controls.addEventListener('change', render);
      const observer = new ResizeObserver(() => {
        if (!container.clientWidth || !container.clientHeight) return;
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix(); render();
      });
      observer.observe(container);
      cleanup = () => { observer.disconnect(); controls.dispose(); if (model) disposeModel(model); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); };
      void createCharacterModel(member.id, { signal: controller.signal, onProgress: value => { if (!disposed) setProgress(value); } }).then(asset => {
        if (disposed) { disposeModel(asset); return; }
        model = asset; scene.add(asset); controls.update(); render(); setProgress({ phase: 'ready' });
      }).catch(error => { if (!disposed && !isModelAbort(error)) { console.warn('Character preview unavailable.', member.id, error); setProgress(modelFailure(error)); } });
    } catch (error) { setProgress(modelFailure(error)); }
    return () => { disposed = true; controller.abort(); cleanup(); };
  }, [member.id, member.name, attempt]);
  const status = progress.phase === 'ready' ? 'ready' : progress.phase === 'failed' ? 'error' : 'loading';
  return <div className="character-stage" data-model-status={status} data-model-phase={progress.phase}>
    <div className="character-canvas" ref={host} />
    {status !== 'ready' && <div className="character-placeholder" role="status"><UserRound size={40} /><span>{modelProgressText(progress, member.name)}</span>{status === 'error' && <button onClick={() => setAttempt(value => value + 1)}><RotateCcw size={16} /> Retry preview</button>}</div>}
    <span className="character-stage-hint">{status === 'ready' ? 'Drag to rotate · Scroll to zoom' : 'You can continue while the preview loads'}</span>
  </div>;
}
