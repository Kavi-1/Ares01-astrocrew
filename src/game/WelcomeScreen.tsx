import { useState } from 'react';
import { ArrowUpRight, ChevronDown, Radio, Rocket, ScrollText, SlidersHorizontal } from 'lucide-react';
import ProjectCredits from './ProjectCredits';
import { useGameStore } from '../store/gameStore';
import './welcome.css';

/** Presentation over the existing live world. No mission state is changed by the notes. */
export default function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const tutorialMode=useGameStore(s=>s.tutorialMode),hasLaunched=useGameStore(s=>s.tutorialHasLaunched);
  const pace=useGameStore(s=>s.paceMode),setPace=useGameStore(s=>s.setPaceMode),setTutorialMode=useGameStore(s=>s.setTutorialMode);
  const enter=()=>{useGameStore.getState().beginTutorialRun(!hasLaunched?tutorialMode:undefined);onEnter();};
  return <section className="welcome-screen" aria-labelledby="welcome-title">
    <header className="welcome-masthead"><span className="welcome-emblem" aria-hidden="true">A</span><span>ASTROCREW<small>MISSION OPERATIONS</small></span><span className="welcome-masthead-end">MARS EXPLORATION PROGRAM</span><span data-tutorial-tools/></header>
    <div className="welcome-mission-copy">
      <p className="welcome-kicker"><span aria-hidden="true" /> [ ARES-01 // MARS EXPEDITION ]</p>
      <h1 id="welcome-title" aria-label="ARES-01">ARES <span>—01</span></h1>
      <p className="welcome-lead">ASTROCREW // JEZERO CRATER</p>
      <p className="welcome-description">You choose. The numbers decide. The report tells you why.</p>
      <div className="welcome-onboarding" aria-label="Onboarding preferences">
        {!hasLaunched&&<fieldset><legend>Your first mission</legend><label><input type="radio" name="welcome-tutorial" value="guided" checked={tutorialMode==='guided'} onChange={()=>setTutorialMode('guided')}/>Guided</label><label><input type="radio" name="welcome-tutorial" value="skip" checked={tutorialMode==='skip'} onChange={()=>setTutorialMode('skip')}/>Skip</label><p>Optional coach prompts in the real game. Dismiss any prompt with F2.</p></fieldset>}
        <fieldset><legend>Mission pace</legend><label><input type="radio" name="welcome-pace" value="quick" checked={pace==='quick'} onChange={()=>setPace('quick')}/>Quick</label><label><input type="radio" name="welcome-pace" value="explore" checked={pace==='explore'} onChange={()=>setPace('explore')}/>Explore</label><p>{pace==='quick'?'Short dialogue and prefilled choices. No timed decisions.':'Full available crew dialogue, field notes and relevant advice. No time limit.'}</p></fieldset>
      </div>
      <div className="welcome-menu">
        <button className="welcome-enter" onClick={enter}>
          <span className="welcome-index" aria-hidden="true">[ 01 ]</span><span>ENTER MISSION CONTROL</span><Rocket size={20} aria-hidden="true" />
        </button>
        <button className="welcome-secondary" type="button" aria-expanded={controlsOpen} aria-controls="welcome-controls" onClick={() => setControlsOpen(!controlsOpen)}>
          <span className="welcome-index" aria-hidden="true">[ 02 ]</span><span>MISSION CONTROLS</span><SlidersHorizontal size={18} aria-hidden="true" />
        </button>
        {controlsOpen && <div className="welcome-notes-content" id="welcome-controls"><p><strong>On Mars</strong> · WASD / arrow keys to drive · Space to brake · E to scan · Esc to pause.</p><p>Drag to orbit the rover. Scroll to zoom. Uplink your collected observations before ending the mission.</p></div>}
        <details className="welcome-notes">
          <summary><span className="welcome-index" aria-hidden="true">[ 03 ]</span><span>Sources &amp; project notes</span><ScrollText className="welcome-notes-icon" size={18} aria-hidden="true" /><ChevronDown className="welcome-notes-chevron" size={16} aria-hidden="true" /></summary>
          <div className="welcome-notes-content"><ProjectCredits /></div>
        </details>
      </div>
      <p className="welcome-team"><Radio size={12} aria-hidden="true" /> SIX CREW SEATS <span aria-hidden="true">//</span> ONE MISSION</p>
    </div>
    <div className="welcome-world-note"><span className="welcome-cross" aria-hidden="true">+</span><p>PERSEVERANCE<small>Jezero crater / Mars</small><small>Drag to orbit · Scroll to zoom <ArrowUpRight size={12} aria-hidden="true" /></small></p></div>
    <footer className="welcome-footer"><span>ARES-01 // ASTROCREW</span><span>MISSION PREPARATION → SURFACE EXPLORATION</span></footer>
  </section>;
}
