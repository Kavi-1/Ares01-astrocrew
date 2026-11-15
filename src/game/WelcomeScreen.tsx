import { useState } from 'react';
import { ArrowUpRight, ChevronDown, Radio, Rocket, ScrollText, SlidersHorizontal } from 'lucide-react';
import ProjectCredits from './ProjectCredits';
import './welcome.css';

/** Presentation over the existing live world. No mission state is changed by the notes. */
export default function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const [controlsOpen, setControlsOpen] = useState(false);
  return <section className="welcome-screen" aria-labelledby="welcome-title">
    <header className="welcome-masthead"><span className="welcome-emblem" aria-hidden="true">A</span><span>ASTROCREW<small>MISSION OPERATIONS</small></span><span className="welcome-masthead-end">MARS EXPLORATION PROGRAM</span></header>
    <div className="welcome-mission-copy">
      <p className="welcome-kicker"><span aria-hidden="true" /> [ ARES-01 // MARS EXPEDITION ]</p>
      <h1 id="welcome-title" aria-label="ARES-01">ARES <span>—01</span></h1>
      <p className="welcome-lead">ASTROCREW // JEZERO CRATER</p>
      <p className="welcome-description">Build the mission. Bring the science home.</p>
      <div className="welcome-menu">
        <button className="welcome-enter" onClick={onEnter}>
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
