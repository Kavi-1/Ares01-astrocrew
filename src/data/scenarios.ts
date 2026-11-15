import type { ScienceTarget } from './scienceTargets';
export const OBJECTIVES = [
  { id: 'G', name: 'Geology and mineral context', required: 4, instruments: 'Mastcam-Z + PIXL or SuperCam; up to two RIMFAX alternatives' },
  { id: 'B', name: 'Potential biosignature context', required: 4, instruments: 'SHERLOC + PIXL at the same rock; not proof of life' },
  { id: 'E', name: 'Environment and exploration', required: 10, instruments: 'MEDA on distinct sols' },
] as const;
export type ObjectiveId = typeof OBJECTIVES[number]['id'];
export type Ranking = [ObjectiveId, ObjectiveId, ObjectiveId];
export type SiteId = 'jezero' | 'syrtis' | 'columbia';
export type WindowId = 'W1' | 'W2' | 'W3';
export const SCENARIOS = [
  { id: 'jezero' as const, name: 'Jezero', context: 'Lake and delta sediments, clay minerals and volcanic crater floor.', hazard: .03, slope: 31, obstacle: .45, detour: 40, outageSol: 12, seed: 73, hue: '#a86e55', terrain: 'Layered delta, basin and safe level detour', origin: [0, 0] },
  { id: 'syrtis' as const, name: 'Northeast Syrtis', context: 'Altered rock contacts and contrasting mineral compositions.', hazard: .08, slope: 10, obstacle: .41, detour: 45, outageSol: 13, seed: 137, hue: '#796c58', terrain: 'Rocky contact ridges and a blocked step', origin: [110, -80] },
  { id: 'columbia' as const, name: 'Columbia Hills', context: 'Silica-rich and hydrothermal-context observations; no confirmed life.', hazard: .12, slope: 31, obstacle: .41, detour: 60, outageSol: 14, seed: 251, hue: '#9d6748', terrain: 'Hillside approaches, steep barrier and longer safe detour', origin: [-120, 80] },
] as const;
export const getScenario = (id: SiteId) => SCENARIOS.find(s => s.id === id)!;
export const WINDOWS: Record<WindowId, { season: number; hazardSol: number }> = { W1: { season: 0, hazardSol: 5 }, W2: { season: 90, hazardSol: 6 }, W3: { season: 270, hazardSol: 7 } };
export type ScenarioTarget = ScienceTarget & { objective: 'G' | 'B'; unit: number; availableSol: number };
/** Synthetic course coordinates are authored game geometry, not NASA terrain products. */
export function scenarioTargets(site: SiteId): ScenarioTarget[] {
  const locations = [[-18,6],[-82,-30],[68,-62],[96,52]];
  const gSols = [2,5,12,16], bSols = [3,8,17,19];
  return (['G','B'] as const).flatMap(objective => locations.map(([x,z], i) => ({
    id: `${site}-${objective}-${i+1}`, name: `${getScenario(site).name} ${objective === 'G' ? 'mineral contact' : 'context rock'} ${i+1}`,
    description: getScenario(site).context, discovery: objective === 'G' ? 'Compositional and geological context recorded' : 'Organic/mineral context recorded; not evidence of confirmed life',
    x: site === 'syrtis' ? -18+(z-12) : site === 'columbia' ? -18-(x+18) : x,
    z: site === 'syrtis' ? 12-(x+18) : z,
    duration: 2.6, energyCost: 0, reward: 0, objective, unit: i+1,
    availableSol: (objective === 'G' ? gSols : bSols)[i],
    requiredInstruments: objective === 'G' ? ['pixl','supercam','rimfax'] : ['sherloc','pixl'],
  })));
}
export const scenarioProvenance = 'ASSUMED game scenarios and completion rules approved in this chat: A02/A03/A04/A05/A05b/A06. NASA context does not validate these maps, landing indices, event dates or completion rubrics.';

export function sunElevationDeg(site:SiteId,window:WindowId) {
  const latitude=site==='columbia'?-15:18, ls=WINDOWS[window].season*Math.PI/180;
  const declination=Math.asin(Math.sin(25.19*Math.PI/180)*Math.sin(ls))*180/Math.PI;
  return 90-Math.abs(latitude-declination);
}
