export const CREW = [
  { id: 'kavi', name: 'Kavi', role: 'Mission Director', focus: 'Bring the whole mission together.', introduction: 'Every choice has a consequence. Let’s build a mission we can explain, and return science we can be proud of.' },
  { id: 'aaryan', name: 'Aaryan', role: 'Systems Engineer', focus: 'Balance payload and capability.', introduction: 'The best payload is the one that fits the mission. Check the mass margin and give every instrument a purpose.' },
  { id: 'houssam', name: 'Houssam', role: 'Power Engineer', focus: 'Make every watt-hour count.', introduction: 'Our MMRTG supplies steady power. The science schedule decides whether we finish each sol with energy to spare.' },
  { id: 'huzaifa', name: 'Huzaifa', role: 'Communications Engineer', focus: 'Get the discoveries back to Earth.', introduction: 'An observation isn’t finished when we collect it. It’s finished when the science reaches home.' },
  { id: 'lautaro', name: 'Lautaro', role: 'Geologist', focus: 'Read the terrain. Find the evidence.', introduction: 'Those layers tell a story. Approach the science markers carefully, stop the rover, and let the instruments work.' },
  { id: 'rihabe', name: 'Rihabe', role: 'Astrobiologist', focus: 'Choose the tools for the science.', introduction: 'Our geology targets need SuperCam, PIXL, or SHERLOC. Pick the questions first, then the instruments to investigate them.' },
] as const;
export type CrewId = typeof CREW[number]['id'];
export type CrewMember = typeof CREW[number];
export function getCrew(id: string | undefined): CrewMember { return CREW.find(member => member.id === id) ?? CREW[0]; }
export function eventAdviser(kind: string): CrewMember {
  if (kind.startsWith('power')) return getCrew('houssam');
  if (kind === 'communication-backlog') return getCrew('huzaifa');
  if (kind === 'mobility-limit') return getCrew('lautaro');
  if (kind === 'instrument-unavailable') return getCrew('rihabe');
  return getCrew('kavi');
}
