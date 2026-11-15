import { getCrew, type CrewMember } from '../../data/crew';
import type { ReturnTypeEngineering } from '../../engine/missionTypes';
import { useGameStore } from '../../store/gameStore';
import CrewPortrait from './CrewPortrait';

export function CrewMessage({ member, children, compact = false }: { member: CrewMember; children: React.ReactNode; compact?: boolean }) {
  return <aside className={`crew-message ${compact ? 'compact' : ''}`}><CrewPortrait member={member} /><div><span>{member.name} <small>· {member.role}</small></span><p>{children}</p></div></aside>;
}

export default function CrewAdvice({ result }: { result: ReturnTypeEngineering }) {
  const selected = useGameStore(state => state.selectedCrewId);
  let member = getCrew(selected);
  let message: string = member.introduction;
  if (result.issues.length) { member = getCrew('aaryan'); message = `We need to resolve the flight check before launch. ${result.issues[0]}`; }
  else if (result.netWh < 0) { member = getCrew('houssam'); message = `This plan uses ${Math.abs(result.netWh).toFixed(0)} Wh more than we generate each sol. Reduce science cadence or skip the MOXIE run to protect the reserve.`; }
  else if (result.dataMbit > result.linkMbit) { member = getCrew('huzaifa'); message = `The payload data estimate is ${result.dataMbit.toFixed(1)} Mbit against ${result.linkMbit.toFixed(1)} Mbit of modeled capacity. Consider the UHF relay.`; }
  else if (!result.selected.some(id => ['supercam', 'pixl', 'sherloc'].includes(id))) { member = getCrew('rihabe'); message = 'We need SuperCam, PIXL, or SHERLOC to study the geology targets. Launch is possible, but those objectives would be unavailable.'; }
  else { message = `The plan has ${result.netWh.toFixed(0)} Wh of daily energy margin. On Mars, stop at a cyan marker to scan, then uplink the results before ending the mission.`; }
  return <CrewMessage member={member}>{message}</CrewMessage>;
}

export function CrewDebrief() {
  const selected = useGameStore(state => state.selectedCrewId);
  const record = useGameStore(state => state.missionRecord);
  const member = getCrew(selected);
  const returned = record?.transmittedTargets.length ?? 0;
  const message = record?.outcome === 'mission-abort'
    ? `We called the mission early. ${returned} target record${returned === 1 ? '' : 's'} made it home. Review the event log before planning the next attempt.`
    : record?.outcome === 'full-success'
      ? 'Every target record made it home. Our payload, operating plan, and relay strategy worked together.'
      : `${returned} target record${returned === 1 ? '' : 's'} returned. The report connects our decisions to the result, so we can refine the next mission.`;
  return <CrewMessage member={member}>{message}</CrewMessage>;
}
