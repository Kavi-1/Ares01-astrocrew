import { useState } from 'react';
import { UserRound } from 'lucide-react';
import type { CrewMember } from '../../data/crew';
/** `decorative` hides the image from assistive tech when the name is already written beside it. */
export default function CrewPortrait({ member, decorative = false }: { member: CrewMember; decorative?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className="crew-portrait" aria-hidden={decorative || undefined}>{failed
    ? <UserRound aria-label={decorative ? undefined : member.name} aria-hidden={decorative || undefined} />
    : <img src={`/portraits/${member.id}.png`} alt={decorative ? '' : member.name} loading="lazy" onError={() => setFailed(true)} />}</span>;
}
