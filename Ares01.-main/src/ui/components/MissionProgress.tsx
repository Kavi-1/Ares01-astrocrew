import { Check } from 'lucide-react';
const phases = ['briefing', 'engineering', 'launch', 'mars', 'report'] as const;
const labels = ['Briefing', 'Engineering', 'Launch', 'Mars', 'Report'];
export default function MissionProgress({ phase }: { phase: typeof phases[number] }) {
  const current = phases.indexOf(phase);
  return <nav className="mission-progress" aria-label="Mission progress"><ol>{phases.map((id, i) => <li key={id} aria-current={id === phase ? 'step' : undefined} className={i < current ? 'is-complete' : ''}><span className="progress-number">{i < current ? <Check size={14} aria-hidden="true" /> : i + 1}</span><span>{labels[i]}</span></li>)}</ol></nav>;
}
