import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, CircleHelp, RotateCcw, X } from 'lucide-react';
import { getTutorialPrompt, GLOSSARY, STATION_HELP, type TutorialContext } from '../../engine/tutorial';
import { useGameStore } from '../../store/gameStore';
import { useMarsStore } from '../../store/marsStore';
import './tutorial.css';
import FieldNotes from './FieldNotes';

type View = 'welcome'|'preparation'|'launch'|'surface'|'report';
type Active = {id:string;scope:string;manual:boolean}|null;

/** Presentation only. No tutorial handler dispatches a mission, crew-hint or physics action. */
export default function TutorialLayer({view}:{view:View}) {
  const state=useGameStore(),surface=useMarsStore();
  const context:TutorialContext={...state,view,phase:surface.phase,nearbyTargetId:surface.nearbyTargetId,scanningTargetId:surface.scanningTargetId,instrumentChange:state.tutorialInstrumentChange??undefined};
  const scope=[view,state.preparation.stage,state.preparation.activeStation,view==='launch'?(state.launchStage>=4?'landing':state.launchStage>=1?'result':'ready'):'',view==='surface'?state.campaign?.mode:'',view==='surface'?state.campaign?.sol:'',state.tutorialInstrumentChange?JSON.stringify(state.tutorialInstrumentChange):''].join('/');
  const [active,setActive]=useState<Active>(null),[help,setHelp]=useState(false),[tab,setTab]=useState<'help'|'glossary'|'tutorial'>('help');
  const [station,setStation]=useState<string>(''),[slot,setSlot]=useState<Element|null>(null),[historyId,setHistoryId]=useState('');
  const [fieldSlot,setFieldSlot]=useState<Element|null>(null);
  const launcher=useRef<HTMLButtonElement>(null),coach=useRef<HTMLElement>(null),helpPanel=useRef<HTMLElement>(null);
  const [position,setPosition]=useState<{left:number;top:number}>({left:16,top:140});
  const auto=state.tutorialMode==='guided'?getTutorialPrompt(context,state.tutorialStepsSeen):null;
  const visible=active?.scope===scope&&(active.manual||state.tutorialMode==='guided')&&(view!=='surface'||surface.phase==='active'||active.manual)?getTutorialPrompt(context,[],active.id):null;
  const progress=new Set(state.tutorialStepsSeen.map(id=>id.split(':')[0])).size;

  useEffect(()=>{
    if(active?.scope===scope)return;
    if(auto){setActive({id:auto.id,scope,manual:false});state.markTutorialStepSeen(auto.id);}
    else if(active)setActive(null);
  },[scope,auto?.id,active,state.markTutorialStepSeen]);

  // A dismissed concept yields to the next relevant explanation, without any required click path.
  useEffect(()=>{
    if(!active&&auto){setActive({id:auto.id,scope,manual:false});state.markTutorialStepSeen(auto.id);}
  },[active,auto?.id,scope,state.markTutorialStepSeen]);

  useEffect(()=>{
    const locate=()=>{setSlot(document.querySelector('[data-tutorial-tools]'));setFieldSlot(document.querySelector('[data-field-coach]'));};
    locate();const observer=new MutationObserver(locate);observer.observe(document.getElementById('root')!,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[view]);
  useEffect(()=>{
    const open=(event:Event)=>{setStation(String((event as CustomEvent).detail??''));setTab('help');setHelp(true);};
    window.addEventListener('ares:station-help',open);return()=>window.removeEventListener('ares:station-help',open);
  },[]);
  const dismiss=()=>{setActive(null);window.dispatchEvent(new CustomEvent('ares:tutorial-dismiss'));};
  const closeHelp=()=>{setHelp(false);launcher.current?.focus({preventScroll:true});};
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.repeat||!['Escape','F2'].includes(event.key))return;
      if(!help&&!visible&&!document.querySelector('[data-tutorial-preview="red-check"]'))return;
      event.preventDefault();event.stopImmediatePropagation();
      if(help)closeHelp();else dismiss();
    };
    window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
  },[help,visible?.id]);

  useLayoutEffect(()=>{
    if(!visible||help)return;
    const findTarget=()=>{
      const nodes=[...document.querySelectorAll<HTMLElement>(`[data-coach="${visible.target}"]`)];
      const shown=nodes.filter(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0;});
      return shown.find(node=>{const r=node.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0;})??shown[0]??(visible.target==='red-preview'?document.querySelector<HTMLElement>('[data-coach="red-preview-trigger"]'):null);
    };
    let target=findTarget();target?.classList.add('tutorial-highlight');
    let observer:ResizeObserver|undefined,listening=true;
    const position=(next:{left:number;top:number})=>setPosition(previous=>previous.left===next.left&&previous.top===next.top?previous:next);
    const place=()=>{
      if(!listening)return;
      const panel=coach.current;if(!panel)return;
      const current=findTarget();if(current!==target){if(target)observer?.unobserve(target);target?.classList.remove('tutorial-highlight');target=current;target?.classList.add('tutorial-highlight');if(target)observer?.observe(target);}
      const shell=document.querySelector<HTMLElement>('.game-shell'),solConsole=document.querySelector<HTMLElement>('.sol-console');
      if(view==='surface'&&fieldSlot&&surface.phase==='active'){
        shell?.classList.remove('with-surface-coach');shell?.style.removeProperty('--tutorial-note-bottom');
        panel.style.width='';panel.style.maxHeight='';position({left:0,top:0});return;
      }
      // Surface notes reserve space beside or above the complete sol console,
      // regardless of which sub-control the current concept highlights.
      if(view==='surface'&&shell&&solConsole){
        const rect=solConsole.getBoundingClientRect(),gap=rect.left-28,top=Math.max(76,(document.querySelector('.surface-top')?.getBoundingClientRect().bottom??68)+8);
        const width=gap>=220?Math.min(350,gap):Math.min(350,window.innerWidth-32);
        panel.style.width=`${width}px`;
        panel.style.maxHeight='190px';
        if(gap<220){shell.classList.add('with-surface-coach');shell.style.setProperty('--tutorial-note-bottom',`${top+panel.getBoundingClientRect().height+12}px`);}
        else {shell.classList.remove('with-surface-coach');shell.style.removeProperty('--tutorial-note-bottom');}
        position({left:gap>=220?Math.max(16,rect.left-width-16):16,top});return;
      }
      shell?.classList.remove('with-surface-coach');shell?.style.removeProperty('--tutorial-note-bottom');panel.style.width='';
      const width=Math.min(350,window.innerWidth-24),height=panel.getBoundingClientRect().height;
      const consoleBody=view==='preparation'&&window.innerWidth<=820?document.querySelector<HTMLElement>('.console-body'):null;
      if(consoleBody){
        const header=document.querySelector('.prep-top')?.getBoundingClientRect(),body=consoleBody.getBoundingClientRect();
        const top=Math.max(76,(header?.bottom??68)+8),available=Math.max(75,body.top-top-12);
        panel.style.maxHeight=`${available}px`;position({left:16,top});return;
      }
      panel.style.maxHeight='';
      const r=target?.getBoundingClientRect(),margin=16,minTop=78,maxTop=Math.max(minTop,window.innerHeight-height-105);
      let left=Math.max(12,(window.innerWidth-width)/2),top=minTop;
      if(r&&r.width&&r.height){
        if(r.left-width-margin>=12){left=r.left-width-margin;top=r.top;}
        else if(r.right+width+margin<=window.innerWidth-12){left=r.right+margin;top=r.top;}
        else {left=Math.max(12,Math.min(window.innerWidth-width-12,r.left));top=r.top-height-margin>=minTop?r.top-height-margin:r.bottom+margin;}
      }
      position({left:Math.max(12,Math.min(window.innerWidth-width-12,left)),top:Math.max(minTop,Math.min(maxTop,top))});
    };
    place();observer=new ResizeObserver(place);if(target)observer.observe(target);if(coach.current)observer.observe(coach.current);
    const surfaceShell=view==='surface'?document.querySelector('.game-shell'):null;if(surfaceShell)observer.observe(surfaceShell);
    const domObserver=new MutationObserver(place);domObserver.observe(document.getElementById('root')!,{childList:true,subtree:true});
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{listening=false;const shell=document.querySelector<HTMLElement>('.game-shell');shell?.classList.remove('with-surface-coach');shell?.style.removeProperty('--tutorial-note-bottom');target?.classList.remove('tutorial-highlight');observer?.disconnect();domObserver.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[visible?.id,visible?.target,help,scope,fieldSlot,surface.phase]);
  useLayoutEffect(()=>{
    if(!help||!helpPanel.current)return;
    const r=launcher.current?.getBoundingClientRect(),p=helpPanel.current;
    p.style.left=`${Math.max(12,Math.min(window.innerWidth-Math.min(380,window.innerWidth-24)-12,r?.left??12))}px`;
    p.style.top=`${Math.max(68,Math.min(window.innerHeight-210,(r?.bottom??55)+10))}px`;
  },[help,tab,view]);

  const reopen=(id:string)=>{if(!id||!getTutorialPrompt(context,[],id))return;setActive({id,scope,manual:true});setHelp(false);};
  const history=state.tutorialStepsSeen.filter(id=>!['C7','C8','C9'].includes(id));
  const helpKey=station||(view==='preparation'?(state.preparation.stage==='entry'?'crew':state.preparation.activeStation??'briefing'):view);
  const purpose=STATION_HELP[helpKey]??STATION_HELP.surface;
  const canReopen=!!state.tutorialLastPromptId&&!!getTutorialPrompt(context,[],state.tutorialLastPromptId);
  const button=<span className="tutorial-tools-controls" data-tutorial-ui>{!help&&visible&&<button key="dismiss" className="tutorial-dismiss-trigger" aria-label="Dismiss prompt" title="Dismiss coach (F2 / Esc)" onClick={dismiss}><X size={16} aria-hidden="true"/></button>}<button key="help" ref={launcher} type="button" className="tutorial-help-trigger" aria-label="Help" aria-expanded={help} onClick={()=>{setStation('');setTab('help');setHelp(!help);}}><CircleHelp size={16} aria-hidden="true"/><span>Help</span></button></span>;

  const coachCard=!help&&visible&&<aside ref={coach} className="tutorial-coach" style={position} data-tutorial-ui data-tutorial-prompt={visible.id} role="complementary" aria-label="Tutorial coach">
      <div className="tutorial-coach-heading"><span>{visible.step} <i>//</i> {progress} / 9 CONCEPTS SEEN</span></div>
      <h2>{visible.title}</h2><p aria-live="polite" aria-atomic="true">{visible.body[0]}</p>
      <div className="tutorial-coach-foot"><small>F2 / Esc dismiss · Help for the full explanation</small></div>
    </aside>;
  return <>
    {slot?createPortal(button,slot):<div className="tutorial-trigger-fallback">{button}</div>}
    {fieldSlot&&view==='surface'&&surface.phase==='active'?createPortal(coachCard,fieldSlot):coachCard}
    {help&&<aside ref={helpPanel} className="tutorial-help-panel" data-tutorial-ui data-tutorial-panel role="complementary" aria-label="Mission help">
      <div className="tutorial-coach-heading"><span>ASTROCREW <i>//</i> FIELD GUIDE</span><button aria-label="Close help" onClick={closeHelp}><X size={16} aria-hidden="true"/></button></div>
      <nav aria-label="Help sections"><button aria-pressed={tab==='help'} onClick={()=>setTab('help')}>Help</button><button aria-pressed={tab==='glossary'} onClick={()=>setTab('glossary')}>Glossary</button><button aria-pressed={tab==='tutorial'} onClick={()=>setTab('tutorial')}>Tutorial menu</button></nav>
      {tab==='help'&&<><h2>At this station</h2><p>{purpose}</p>{(visible??(state.tutorialLastPromptId?getTutorialPrompt(context,[],state.tutorialLastPromptId):null))&&<details className="tutorial-full-explanation"><summary>Full current explanation</summary>{(visible??getTutorialPrompt(context,[],state.tutorialLastPromptId!))!.body.map((text,i)=><p key={i}>{text}</p>)}</details>}{state.paceMode==='explore'&&<FieldNotes config={state.campaign?.config??state.confirmedMission?.config??state.roverConfig}/>}<p className="tutorial-muted">Help explains the controls. Crew advice remains separate; opening this guide earns no hint or teamwork credit.</p><button className="tutorial-wide" disabled={!canReopen} onClick={()=>reopen(state.tutorialLastPromptId!)}>Reopen tutorial prompt</button>{state.tutorialLastPromptId&&!canReopen&&<p className="tutorial-muted">This explanation can be reopened when its mission stage is available.</p>}<button className="tutorial-wide" onClick={()=>{state.replayTutorial();setActive(null);setHelp(false);}}>Replay Tutorial</button><button className="tutorial-wide" onClick={()=>{state.setTutorialMode('skip');dismiss();setHelp(false);}}>Disable tutorial prompts</button></>}
      {tab==='glossary'&&<><h2>Mission glossary</h2><dl className="tutorial-glossary">{Object.entries(GLOSSARY).map(([term,meaning])=><div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>)}</dl></>}
      {tab==='tutorial'&&<><h2>Your field guide</h2><label>Coach prompts<select aria-label="Tutorial mode" value={state.tutorialMode} onChange={e=>{state.setTutorialMode(e.target.value as 'guided'|'skip');if(e.target.value==='skip')dismiss();}}><option value="guided">Guided</option><option value="skip">Skip</option></select></label><label>Pacing<select aria-label="Pacing mode" value={state.paceMode} onChange={e=>state.setPaceMode(e.target.value as 'quick'|'explore')}><option value="quick">Quick</option><option value="explore">Explore</option></select></label><p>{progress} of 9 concepts seen. Pacing and coaching do not change mission rules.</p><label>Seen explanations<select aria-label="Tutorial explanation" value={historyId} onChange={e=>setHistoryId(e.target.value)}><option value="">Choose an explanation</option>{history.map(id=><option key={id} value={id}>{id} · {getTutorialPrompt(context,[],id)?.title??'Available at its mission stage'}</option>)}</select></label><button className="tutorial-wide" disabled={!historyId||!getTutorialPrompt(context,[],historyId)} onClick={()=>reopen(historyId)}>Reopen selected explanation</button><button className="tutorial-wide" onClick={()=>{state.replayTutorial();setActive(null);setHelp(false);}}><RotateCcw size={14} aria-hidden="true"/> Replay Tutorial</button><button className="tutorial-wide" onClick={()=>{state.setTutorialMode('skip');dismiss();}}>Disable tutorial prompts</button></>}
      <p className="tutorial-muted"><BookOpen size={13} aria-hidden="true"/> F2 or Esc closes this guide. The world stays interactive.</p>
    </aside>}
  </>;
}
