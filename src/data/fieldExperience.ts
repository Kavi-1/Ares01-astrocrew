import { batteryPercent, contactCapacityBits, forecastSol, type Campaign } from '../engine/campaign';
import { INSTRUMENTS, type InstrumentId } from '../nasa/data';
import { getScenario, scenarioTargets, type ObjectiveId, type SiteId } from './scenarios';
import type { CrewId } from './crew';

/** Presentation only: these authored field activities never award science or change physics. */
export const FIELD_EXPERIENCE_PROVENANCE = 'EDUCATIONAL GAMEPLAY: fictional field stops and illustrative instrument patterns; not NASA terrain, flight measurements or evidence of life. Interaction seconds compress the presentation only. Modeled hours, energy and data come from the mission engine.';

export type FieldBrief = {
  title: string; subtitle: string; crewId: CrewId; briefing: string;
  primaryActivity: string; whyItMatters: string; assumption: string;
};
export type ObservationInsight = {
  title: string; explanation: string; visualLabel: string; crewId: CrewId; reaction: string;
};
export type InstrumentInteraction = 'frame' | 'target' | 'map' | 'profile' | 'weather' | 'oxygen';
export type InstrumentExperience = {
  label: string; verb: string; instructions: string; interaction: InstrumentInteraction;
  steps: string[]; /** Visual interaction seconds; never an instrument activity duration. */
  duration: number;
};
export type FormationStory = {
  name: string; question: string; context: string; geology: string; biosignature: string;
};

const FORMATIONS: Record<SiteId, readonly FormationStory[]> = {
  jezero: [
    { name: 'Delta Front', question: 'What can the layers tell us about moving water?', context: 'An authored exposure inspired by Jezero’s lake and delta setting.', geology: 'Compare the bedding before examining composition: rock texture and chemistry answer different parts of the same question.', biosignature: 'Fine-grained sediment can provide useful preservation context. Map organic and mineral signals together before drawing conclusions.' },
    { name: 'Clay Contact', question: 'Does this material record alteration by water?', context: 'An illustrative mineral contact in the synthetic Jezero course.', geology: 'Compare the light and dark surfaces. Elemental chemistry alone does not identify a mineral or prove how it formed.', biosignature: 'Compare an altered surface with its surrounding rock. A contextual mineral map helps evaluate an organic signal without calling it life.' },
    { name: 'Dark Crater Floor', question: 'How does the floor rock differ from the delta?', context: 'A fictional field stop inspired by the contrast between Jezero’s volcanic floor and sedimentary deposits.', geology: 'Relate the rock’s visible texture to its composition. Contrasting units help build a geological history.', biosignature: 'An apparent signal needs its host rock and geological setting. A comparison here helps avoid treating every unusual patch as biological.' },
    { name: 'Basin Boundary', question: 'Which observations connect the different rock units?', context: 'An authored boundary where the expedition compares its earlier observations.', geology: 'Use the previous images and composition maps as context. A boundary can be more informative than another isolated rock.', biosignature: 'Compare the organic/mineral context with earlier sites. Repetition, differences and geological setting matter more than a dramatic single signal.' },
  ],
  syrtis: [
    { name: 'Alteration Front', question: 'What changed across this rock contact?', context: 'A synthetic field stop inspired by Northeast Syrtis’s diverse altered rocks.', geology: 'Compare the two sides of the contact. Chemistry and imagery can constrain alteration without inventing its exact temperature or age.', biosignature: 'Map the host rock as carefully as any interesting signal. Alteration can preserve, move or obscure chemical context.' },
    { name: 'Fracture Veins', question: 'Did fluids leave a different material along these fractures?', context: 'Illustrative fracture textures in the authored Syrtis terrain.', geology: 'Target a fracture and its surrounding rock for comparison. Different chemistry can motivate a hypothesis; it does not establish a complete history.', biosignature: 'Compare a vein with the surrounding material. Organic and mineral associations need geological context and can have nonbiological explanations.' },
    { name: 'Contrasting Ridge', question: 'Is the bright surface a separate rock or a surface change?', context: 'A fictional contact ridge on the synthetic Northeast Syrtis course.', geology: 'Use a broader image before inspecting a small patch. A local elemental map and a remote composition measurement sample different scales.', biosignature: 'A bright patch is a place to investigate, not a discovery by itself. Keep the organic map paired with its elemental and visual context.' },
    { name: 'Layered Contact', question: 'How do these observations fit the surrounding sequence?', context: 'An authored comparison point inspired by regional mineral diversity.', geology: 'Compare the layered contact with the earlier alteration front. Build an explanation from several observations rather than one attractive marker.', biosignature: 'Evaluate repeated patterns across the sequence. Context supports a careful interpretation; it cannot confirm ancient life.' },
  ],
  columbia: [
    { name: 'Pale Hillside', question: 'Why does this exposure contrast with the darker hillside?', context: 'A synthetic stop inspired by Columbia Hills’s silica-rich and hydrothermal-context observations.', geology: 'Pair surface texture with composition. Silica-rich material can motivate several geological hypotheses, not a single automatic origin story.', biosignature: 'Hydrothermal settings are scientifically interesting, but an interesting setting is not evidence of life. Examine the host material first.' },
    { name: 'Silica Outcrop', question: 'Which observations can constrain this material’s origin?', context: 'An illustrative pale outcrop on the authored Columbia Hills course.', geology: 'Compare the exposed face with surrounding rock. An elemental map is one line of evidence; geological context remains essential.', biosignature: 'Pair organic and mineral mapping with an elemental comparison. An organic signal may be nonbiological and is not a confirmed biosignature.' },
    { name: 'Fractured Bench', question: 'Did the rock change along the fracture network?', context: 'A fictional hillside bench with authored fracture textures.', geology: 'Inspect the fracture and host rock at different scales. Explain what the instruments measure before proposing how the contrast formed.', biosignature: 'Map the signal’s position relative to the fracture. Spatial association guides the next question; it does not establish a biological source.' },
    { name: 'Summit Context', question: 'What does the wider setting add to the close-up maps?', context: 'An authored final comparison point on the synthetic hill route.', geology: 'Connect the hillside panorama with the earlier close-up observations. A useful interpretation accounts for the surrounding terrain.', biosignature: 'Compare all four contexts. A careful scientific result can be a well-supported geological explanation rather than a claim of life.' },
  ],
};

export function getFormationStory(site: SiteId, unit = 1): FormationStory {
  const index = Number.isFinite(unit) ? Math.max(0, Math.min(3, Math.floor(unit) - 1)) : 0;
  return { ...FORMATIONS[site][index] };
}

const INSTRUMENT_EXPERIENCES: Record<InstrumentId, InstrumentExperience> = {
  'mastcam-z': {
    label: 'Mastcam-Z · stereo context', verb: 'Frame the outcrop', interaction: 'frame', duration: 2.6,
    instructions: 'Frame the layers and their surroundings. This illustrative view teaches context; the engine accounts for the imaging activity.',
    steps: ['Find the exposed face', 'Include its surrounding layers', 'Record the geological context'],
  },
  supercam: {
    label: 'SuperCam · remote composition', verb: 'Target an exposed surface', interaction: 'target', duration: 2.8,
    instructions: 'Compare the exposed surface with the surrounding rock. The display illustrates remote chemistry and mineralogy, not a real spectrum.',
    steps: ['Choose an exposed surface', 'Observe the remote analysis', 'Compare composition with the image'],
  },
  pixl: {
    label: 'PIXL · elemental map', verb: 'Map the rock surface', interaction: 'map', duration: 3.2,
    instructions: 'Follow the mapping pass across the surface. PIXL uses X-ray fluorescence to map elements; this map is an illustrative pattern.',
    steps: ['Inspect the close-up context', 'Trace the elemental mapping pass', 'Compare contrasting patches'],
  },
  sherloc: {
    label: 'SHERLOC · organic/mineral context', verb: 'Compare the mapped patches', interaction: 'map', duration: 3.4,
    instructions: 'Inspect the organic and mineral context together. SHERLOC uses Raman and fluorescence spectroscopy; an organic signal is not proof of life.',
    steps: ['Locate the mapped patch', 'Compare organic and mineral context', 'Keep the PIXL comparison at the same rock'],
  },
  meda: {
    label: 'MEDA · environmental context', verb: 'Record this sol’s weather', interaction: 'weather', duration: 2.4,
    instructions: 'Read the environmental context around the rover. The visual is illustrative; the engine executes the planned MEDA duty period once for this sol.',
    steps: ['Observe the local setting', 'Read the weather context', 'Store a distinct-sol record'],
  },
  rimfax: {
    label: 'RIMFAX · subsurface profile', verb: 'Follow a fresh traverse', interaction: 'profile', duration: 3,
    instructions: 'Drive new ground to extend the profile. Repeating a track does not create a fresh profile; the canonical engine checks the required unique distance.',
    steps: ['Choose a safe fresh route', 'Build the profile while driving', 'Connect the subsurface view to surface geology'],
  },
  moxie: {
    label: 'MOXIE · oxygen demonstration', verb: 'Run the oxygen experiment', interaction: 'oxygen', duration: 3.2,
    instructions: 'Review the power trade-off before running the demonstration. The short animation represents a modeled one-hour run; it does not accelerate charging.',
    steps: ['Review energy and reserve', 'Run the oxygen demonstration', 'Keep the matching MEDA context'],
  },
};

export function getInstrumentExperience(instrument: InstrumentId): InstrumentExperience {
  const experience = INSTRUMENT_EXPERIENCES[instrument];
  return { ...experience, steps: [...experience.steps] };
}

export function getObservationInsight(site: SiteId, objective: ObjectiveId, instrument: InstrumentId, unit = 1): ObservationInsight {
  const formation = getFormationStory(site, unit);
  const instrumentName = INSTRUMENTS.find(item => item.id === instrument)!.name;
  if (instrument === 'moxie') return {
    title: 'Oxygen production is an engineering experiment', crewId: 'aaryan', visualLabel: 'ILLUSTRATIVE OXYGEN DEMONSTRATION',
    explanation: 'MOXIE demonstrates extracting oxygen from Mars’s carbon-dioxide atmosphere. This is a technology demonstration, not a search for organisms. The game credits only the existing MOXIE plus MEDA context bundle.',
    reaction: 'That is the trade-off we came to test: a useful technology demonstration with a real power cost. Bring its context data home too.',
  };
  if (instrument === 'meda' || objective === 'E') return {
    title: 'A landscape needs environmental context', crewId: 'houssam', visualLabel: 'ILLUSTRATIVE WEATHER CONTEXT',
    explanation: 'MEDA measures atmospheric and environmental conditions including wind, temperature, humidity and dust. Distinct-sol records give the other observations context; repeating the action this sol earns no extra unit.',
    reaction: 'One useful record for this sol. The weather series matters because we observe on different sols, not because we repeat a button.',
  };
  if (objective === 'B') return {
    title: `${formation.name} · context before conclusions`, crewId: 'rihabe', visualLabel: 'ILLUSTRATIVE ORGANIC / MINERAL MAP',
    explanation: `${formation.biosignature} SHERLOC’s Raman and fluorescence mapping and PIXL’s elemental mapping form one contextual evidence bundle at this rock. These authored patterns are not a detection on Mars.`,
    reaction: 'Interesting context. Keep the geological explanation beside the organic map, and keep “potential” in the interpretation. We have not confirmed life.',
  };
  if (instrument === 'rimfax') return {
    title: `${formation.name} · beneath the surface`, crewId: 'lautaro', visualLabel: 'ILLUSTRATIVE SUBSURFACE PROFILE',
    explanation: 'RIMFAX uses ground-penetrating radar along the rover’s track. Connect the subsurface profile with the Mastcam-Z surface context; the display shows authored patterns rather than measured underground layers.',
    reaction: 'The traverse now asks a geological question. Surface imagery and subsurface structure can give us complementary context.',
  };
  const measurement = instrument === 'pixl'
    ? 'PIXL maps elemental composition through X-ray fluorescence; elemental contrast alone does not uniquely identify a mineral.'
    : instrument === 'supercam'
      ? 'SuperCam investigates chemistry and mineralogy remotely, adding compositional context to the image.'
      : 'Mastcam-Z provides stereo and zoom imaging, connecting a close-up observation with the surrounding landscape.';
  return {
    title: `${formation.name} · read the rock`, crewId: 'lautaro', visualLabel: `ILLUSTRATIVE ${instrumentName.toUpperCase()} OBSERVATION`,
    explanation: `${formation.geology} ${measurement}`,
    reaction: 'A useful comparison, not just another marker. Keep the image and composition together, then return the complete evidence bundle.',
  };
}

export function getFieldBrief(c: Campaign): FieldBrief {
  const site = getScenario(c.options.site);
  const base = { subtitle: `${site.name} · Sol ${c.sol} / ${c.totalSols}`, assumption: FIELD_EXPERIENCE_PROVENANCE };
  if (c.mode === 'finished') return { ...base, title: 'The evidence comes home', crewId: 'kavi', briefing: 'The surface timeline is complete. Review what was collected, what returned and what each decision cost.', primaryActivity: 'Read the mission outcome', whyItMatters: 'The report follows the recorded science and engineering outcomes, including any accepted failures.' };
  if (c.safe) return { ...base, title: 'Protect the rover', crewId: 'houssam', briefing: 'Optional driving and science are suspended. Review the energy ledger and let the required recovery sol run with its baseline load.', primaryActivity: 'Review recovery, then advance the sol', whyItMatters: 'Recovery uses the modeled generation-minus-consumption rate. Reserve is a safety threshold, never a charging rate.' };
  if (c.events.some(event => event.id.startsWith('E4:') && !event.resolved)) return { ...base, title: 'Choose the work that matters', crewId: 'houssam', briefing: 'The forecast puts the chosen reserve at risk. Cut a planned load, or explicitly accept the protective safe-mode consequence.', primaryActivity: 'Revise the remaining energy plan', whyItMatters: 'The same generation, load and battery equations determine both the forecast and the executed work.' };
  if (c.events.some(event => event.id === 'E1' && !event.resolved)) return { ...base, title: 'Read the route', crewId: 'lautaro', briefing: `The authored route hazard exceeds the mission’s terrain allowance. The safe detour adds ${site.detour} m; choosing to cross causes the approved mobility-loss consequence.`, primaryActivity: 'Inspect the barrier and choose the route', whyItMatters: 'A detour costs real traversed distance and drive energy. No random failure roll decides the crossing.' };
  if (c.events.some(event => event.id === 'E2' && !event.resolved)) return { ...base, title: 'Bring the right evidence home', crewId: 'huzaifa', briefing: 'A scheduled relay opportunity is unavailable. Compare the queued evidence with the remaining contact capacity; choose return priority or wait.', primaryActivity: 'Review the return queue', whyItMatters: 'Priority changes the transmission order, not the original objective ranking. Unsent observations wait onboard.' };
  if (c.mobilityDisabled) return { ...base, title: 'Science from where we stand', crewId: 'aaryan', briefing: 'The recorded damage prevents driving. Available stationary work still follows the installed instruments, range, time and power checks.', primaryActivity: 'Choose feasible stationary science', whyItMatters: 'A reduced mission keeps the failure honest while returning the observations the surviving hardware can support.' };
  if (c.sol === 1) return { ...base, title: 'First tracks, first questions', crewId: 'lautaro', briefing: `Welcome to ${site.name}. Get a feel for the rover and frame the surroundings before the first close-up investigation.`, primaryActivity: c.config.instruments.includes('meda') ? 'Commit the plan, explore and record MEDA context' : 'Commit the plan and explore the terrain', whyItMatters: 'The instruments answer different questions. Learn the terrain and choose a question before spending the science allocation.' };
  const pending = scenarioTargets(c.options.site)
    .filter(target => target.availableSol <= c.sol && !c.completed.includes(`science:${target.id}`))
    .sort((a, b) => Number(b.availableSol === c.sol) - Number(a.availableSol === c.sol)
      || c.options.ranking.indexOf(a.objective) - c.options.ranking.indexOf(b.objective)
      || a.availableSol - b.availableSol || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const target = pending[0];
  if (target) {
    const formation = getFormationStory(c.options.site, target.unit);
    const biosignature = target.objective === 'B';
    return { ...base, title: `${formation.name} · ${biosignature ? 'look closer' : 'read the landscape'}`, crewId: biosignature ? 'rihabe' : 'lautaro', briefing: `${formation.question} ${biosignature ? formation.biosignature : formation.geology}`, primaryActivity: biosignature ? 'Compare SHERLOC and PIXL at the same rock' : 'Connect a Mastcam-Z view with composition or a qualified radar profile', whyItMatters: formation.context };
  }
  if (c.sol === c.totalSols) return { ...base, title: 'One last look at Mars', crewId: 'huzaifa', briefing: 'Review the evidence still onboard, complete any feasible final context observation and use the remaining contact.', primaryActivity: 'Complete final observations and return queued science', whyItMatters: 'Collection and return are different steps. Only complete returned bundles contribute scientific value.' };
  const environmentActivity = !c.config.instruments.includes('meda')
    ? 'Inspect the terrain and review the next investigation'
    : c.config.moxieRun && c.config.instruments.includes('moxie')
      ? 'Choose MEDA context or the planned MOXIE demonstration'
      : 'Record a distinct-sol MEDA context';
  return { ...base, title: 'The environment between discoveries', crewId: 'houssam', briefing: 'Inspect the landscape, record any available environmental context or review the next investigation. Quiet sols can advance without waiting in real time.', primaryActivity: environmentActivity, whyItMatters: 'Mission time advances through modeled activities and end-sol accounting; thinking and camera movement remain free.' };
}

export type FieldReactionTrigger = 'arrival' | 'observation' | 'transmit' | 'route' | 'weather' | 'moxie' | 'plan';
export type CrewFieldReaction = { crewId: CrewId; text: string; detail: string };
/** All quantities come from the current campaign, not authored measurements. */
export function getCrewFieldReaction(c: Campaign, trigger: FieldReactionTrigger = 'arrival'): CrewFieldReaction {
  const reserve = c.config.reserve * 100;
  const soc = batteryPercent(c.energyWh);
  const pendingBits = c.products.reduce((sum, product) => sum + product.bits - product.sentBits, 0);
  const returnedBits = c.products.reduce((sum, product) => sum + product.sentBits, 0);
  if (c.safe) return { crewId: 'houssam', text: 'Protect the rover and keep the recovery honest.', detail: `Battery ${soc.toFixed(1)}%; selected reserve ${reserve.toFixed(0)}%. Optional work is suspended by the recorded safe-mode state.` };
  if (trigger === 'route') return c.route === 'cross'
    ? { crewId: 'aaryan', text: 'The accepted crossing has disabled mobility. We can still assess stationary science.', detail: 'The terrain consequence is deterministic; no further driving is permitted with this damage.' }
    : c.route === 'reroute'
      ? { crewId: 'lautaro', text: 'Safe route selected. Follow the corridor and keep the geology in view.', detail: `The authored detour adds ${getScenario(c.options.site).detour} m. Only accepted traversed distance is charged.` }
      : { crewId: 'lautaro', text: 'Inspect the approach before committing the rover.', detail: `The scenario’s hazard is ${getScenario(c.options.site).slope}° / ${getScenario(c.options.site).obstacle.toFixed(2)} m. Resolve the route decision before further work.` };
  if (trigger === 'transmit') return { crewId: 'huzaifa', text: pendingBits > 0 ? 'Some evidence is home; the rest still needs a contact.' : returnedBits > 0 ? 'The acquired evidence is back on Earth.' : 'The return queue is empty. There is no science to transmit yet.', detail: `Returned ${(returnedBits / 1e6).toFixed(1)} Mbit; onboard ${(pendingBits / 1e6).toFixed(1)} Mbit. Remaining sol contact ${Math.max(0, (contactCapacityBits(c) - c.contactUsedBits) / 1e6).toFixed(1)} Mbit.` };
  if (trigger === 'plan' || trigger === 'moxie') {
    const forecast = forecastSol(c, c.plan);
    return { crewId: 'houssam', text: trigger === 'moxie' ? 'A technology demonstration earns its place by paying its energy cost.' : 'Choose the work, then check the margin before committing.', detail: `Current battery ${soc.toFixed(1)}%; reserve ${reserve.toFixed(0)}%. Remaining-plan estimate ${forecast.netWh >= 0 ? '+' : ''}${forecast.netWh.toFixed(1)} Wh; terrain can change the drive cost.` };
  }
  if (trigger === 'weather') return { crewId: 'houssam', text: 'Environmental context is useful across distinct sols.', detail: `This is Sol ${c.sol}. The mission engine prevents duplicate environment credit within the same sol.` };
  if (trigger === 'observation') return { crewId: 'rihabe', text: 'Keep the observation and its explanation together. Collection still needs a return path.', detail: `${(pendingBits / 1e6).toFixed(1)} Mbit currently waits onboard. Complete returned bundles, not animation or repeated scans, determine the science score.` };
  return { crewId: 'lautaro', text: getFieldBrief(c).briefing, detail: 'Field locations and displayed patterns are authored educational content. Engineering outcomes follow the recorded mission state.' };
}
