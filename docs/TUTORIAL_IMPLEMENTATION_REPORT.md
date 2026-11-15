# ARES-01 — Interactive Tutorial Implementation Report

Implementation date: 15 November 2026. Authority: `GAMEPLAY.md` §8 and the supplied tutorial implementation task. This work adds presentation and persisted onboarding metadata to the actual game; it does not introduce a separate tutorial simulation. Old design-reference directories were not consulted for this tutorial implementation.

## Implementation and trigger conditions

The nine documented steps use **14 independently persisted concept IDs**. This lets launch and landing, the four surface activities, and the event/report explanations appear at their actual stages without replaying an already seen concept.

| Step / concept ID | Actual trigger | What is taught and highlighted |
| --- | --- | --- |
| C1 / `C1` | The real crew-seat selection opens. | Selected crew member and responsibility, six selectable seats, five deterministic teammates; highlights the actual seat controls. |
| C2 / `C2` | A non-owner opens a payload, power or communications station showing a real bot proposal, before taking over. | Accept applies that displayed proposal; Ask to revise recomputes its priority; Take over opens direct controls. Formal order terminology is explained with its missing-system limitation. |
| C3 / `C3` | The science briefing/objective-ranking station opens. | Current ranking and its 50%, 30%, 20% weights; highlights the actual scenario/ranking controls. |
| C4 / `C4` | The player adds an instrument to the real payload draft. Removing or retaining hardware does not trigger it. | Actual before/after mass, peak power, data and budget from a copied draft snapshot, plus green/amber/red margins; highlights the live margin rail. Applying the draft remains the player's decision. |
| C5 / `C5` | The payload lesson offers the failed-check demonstration; the player can open it using **Show me a red check**. | A compact isolated preview keeps the exact current rover payload, compares the real selectable Light vehicle + O3 relay against its mass limit, then shows the Medium-vehicle fix. The current loadout, vehicle, orbit, accepted risks and mission state do not change. |
| C6 / `C6` | The actual readiness/go/no-go station opens. | Fix, Drop and supported Override behavior, with current launch mass, landing index and budget values. Every supported failed check names its deterministic consequence before acceptance. |
| C7 / `C7:launch` | The launch-mass result is available in the launch flow, or a failed launch has returned to the workshop. | Confirmed mass versus vehicle capacity, the actual failure cause if present, and the one locked retry. The coach does not roll or change a result. |
| C7 / `C7:landing` | The landing phase/result is reached, including the first surface view. | Current rover mass and site landing index versus the approved game limit; a failed landing names mobility loss and the retained FAILED outcome. |
| C8 / `C8:plan` | A real surface plan opens, or safe recovery is active. | Current sol/duration, stored Wh, MMRTG output, baseline, selected reserve in Wh/percent, remaining work and deficit/safe-mode meaning. |
| C8 / `C8:drive` | Surface operations are active, mobility is available and the committed drive allocation has time remaining. | Real WASD/arrow driving, braking, modeled speed and remaining allocation; target dates are respected. No rock is made available early to accommodate the tutorial. |
| C8 / `C8:scan` | A nearby currently available target passes the authoritative instrument, proximity and remaining-time readiness checks. | E / Start scan, stopping in range, once-only modeled instrument work and complete returned-bundle science credit. |
| C8 / `C8:end` | Real operations have used modeled time or acquired a science observation. | End sol, remaining baseline integration, planned contact, queued data and explicit Wait / charge behavior. |
| C9 / `C9:event` | The first scheduled E1/E2 event is encountered, including a non-actionable event on its scheduled sol. Conditional E4 does not consume this scheduled-event lesson. | Actual event text/date and supported responses. An already immobile rover is not told to reroute or given false response credit. |
| C9 / `C9:report` | The actual report opens. | Recorded outcome/cause chain, recovery tier, returned objective fractions and implemented scientific/performance scores. Missing remaining rubric ledgers are identified explicitly. |

Preparation lessons read the current workshop design and options, including edits made after returning from launch. Launch lessons use the confirmed flight snapshot; surface/report lessons use the campaign. Reopened C7 lessons require a real confirmed snapshot or retained failure cause and do not invent a completed flight.

The coach reads the existing mission, engineering and campaign reducers. It never accepts a proposal, changes hardware, commits a plan, advances a sol, resolves an event, transmits science, moves the camera or pauses the game.

## Welcome, Help and pacing

S0 displays the required message: **“You choose. The numbers decide. The report tells you why.”** Guided is initially selected for the first mission entry. The subsequent-run default is Skip; the application does not require another tutorial-choice screen on each visit. Explicit mode changes and Replay remain available from Help.

Quick is the default presentation mode and retains the existing prefilled design choices and preselected proposal priority. It uses concise crew text. Explore exposes all currently authored crew introductions, the field-notes journal and actual site, objective, engineering, budget and encountered-event observations. Relevant existing engineering issues/warnings are available in its notes. There is no playtime limit in either mode, and neither mode is a physics or scoring input.

A Help launcher is available across welcome, preparation, launch, surface and report views. Every preparation station also has **Station help**, opening a concise explanation of that station's purpose and what to examine. The field guide includes:

- The ten requested glossary terms: margin, reserve, sol, safe mode, accepted risk, relay pass, relay orbit, areostationary, tier and budget.
- Reopen the last prompt and choose an earlier seen explanation where its required mission context is available.
- Replay Tutorial, which resets tutorial progress without resetting the mission.
- Guided/Skip and Quick/Explore settings, plus disabling prompts at any time.
- Explore field notes during preparation and through Help in later stages.

Automatic coach notes show one compact instruction; Help → Full current explanation contains the complete live explanation. Notes never intercept pointer input. Dismiss actions sit beside Help in the existing header, so a coach control cannot cover a mission checkbox. Small preparation screens reserve the area above the form for the note; phone surface screens reserve a note strip and adjust only the sol console layout, while tablets use the free space beside it. The mobile C4 lesson highlights a sticky applied/preview readout containing the actual mass, peak, data and budget, rather than a hidden desktop rail.

Coach prompts and C5's inline preview close with F2 or Escape. Native buttons also provide mouse/touch dismissal. The root keyboard handler closes the tutorial presentation before any conflicting game Escape handler, without changing the actual station draft or mission. Help-field keyboard input is isolated from game controls; closing Help restores focus to its header button while normal walking, driving and seat-selection shortcuts continue to work. Tutorial header buttons retain native Space/Enter activation, while the existing Pause/Scan HUD controls retain their Space-brake behavior. No tutorial autofocus, backdrop or focus trap is added. The Three.js world and existing controls remain interactive.

## Persistence and accessibility

The saved preparation UI flag `preparation.preparationOpen` distinguishes Welcome from crew selection, so a production reload resumes S1 correctly and a deliberate Home return remains at Welcome. It has no physics or scoring role.

Onboarding metadata lives in the authoritative persisted game store: `tutorialMode`, `tutorialStepsSeen[]`, first-entry/run flags, the last explanation ID, copied instrument-change context and `paceMode`. Campaign reset preserves tutorial preferences/progress and marks the next run for its documented default. A normal reload preserves seen concepts instead of unexpectedly replaying completed explanations. Replay changes only tutorial metadata.

Persistence implementation includes normalization/migration for earlier saves and invalid tutorial values. Browser save/resume acceptance is reported separately below; a unit-level round trip alone is not presented as proof of a screen resuming correctly.

The UI uses native buttons, radio controls, selects and disclosures, labeled Help and close actions, visible keyboard focus, responsive bounded panels and at least 44px tutorial action targets. Tutorial highlight/panel styles honor `prefers-reduced-motion`; no additional camera animation, particles or post-processing was introduced. Source inspection is not a substitute for the browser accessibility/layout results below.

## Screenshots from the running game

These images are captures of the actual production-preview UI, not design references or mocked mission results. Original GLB assets were unavailable, so the retained Three.js procedural fallback is visible. The packaged screenshot files live in `docs/tutorial/screenshots/`.

![Crew-selection coach at 1440px](tutorial/screenshots/crew-coach-1440.png)

![Crew-selection coach at 820px](tutorial/screenshots/crew-coach-820.png)

![Crew-selection coach at 390px](tutorial/screenshots/crew-coach-390.png)

![Mission glossary in the running game](tutorial/screenshots/glossary.png)

![Actual mobile instrument deltas and visible highlight](tutorial/screenshots/instrument-delta.png)

![Calculated red check and fix, without applying them](tutorial/screenshots/red-check-fix.png)

![First-sol coach and controls at 390px, without overlap](tutorial/screenshots/first-sol-coach-390.png)

![First-sol coach beside the real controls at 820px](tutorial/screenshots/first-sol-coach-820.png)

![Actual abort-report tutorial, not a fabricated mission outcome](tutorial/screenshots/tutorial-report.png)

## Automated verification

The following command results were observed in the implementation workspace. Logs are supplied with the handoff.

| Command | Observed result / scope |
| --- | --- |
| `pnpm test:tutorial` | **PASS 138 checks.** All 14 actual concept triggers and negative trigger cases; pure prompt derivation; live values; C5 clone isolation and calculated failure/fix; first/subsequent defaults; mode/progress persistence; normalization; reset/replay isolation; Guided/Skip × Quick/Explore parity. |
| `pnpm test:mission-energy` | **PASS 20 checks.** Existing battery integration, reserve thresholds, interval partitioning and three-zero counter. |
| `pnpm test:campaign` | **PASS 688 campaign + 272 boundary checks.** Existing scenarios, rankings, duration, energy, safety, products/returns, save/resume and progression. |
| `pnpm test:engineering` | **PASS.** Existing NASA arithmetic, constraints, recovery/outcomes and persistence regressions. |
| `pnpm test:preparation` | **PASS 72 proposal scenarios and all 36 station paths**, plus current/early-draft save hydration, migration, preparation persistence and reset. |
| `pnpm test:mission-budget` | **PASS 1239 cases**, including the exhaustive 1152 instrument/vehicle/relay combinations. |
| `pnpm test:model-loading` | **PASS 20 focused loader checks**, including cancellation, retry, cache invalidation and deduplicated disposal. |
| `pnpm build` | **PASS TypeScript and production build.** The existing large-bundle warning remains. |

Guided/Skip and Quick/Explore parity is tested by executing the same real 30-sol mission decisions under all four combinations and comparing the resulting campaign, scheduled events, energy ledger and science/performance summary. Tutorial replay, dismissal metadata and preferences do not enter the campaign reducer.

The hint-isolation test preserves sentinel `hintsShown`, `hintsFollowed` and teamwork values while tutorial actions execute. Those sentinels test non-mutation; they do **not** claim that a missing authoritative hint/order/teamwork ledger has been implemented.

### Production-browser results

**PASS: all four production tutorial browser tests in one clean run (5.4 minutes).** See `verification/tutorial-browser-verified.log`.

The run verifies Guided/Skip and Quick/Explore controls, first/subsequent defaults, exact S1/Home resume, dismissal/disable/reopen/replay, live values and C5 non-mutation, native keyboard/mouse/touch, reduced motion, actual launches/scans/events/reports and responsive layouts. Additional direct checks prove that closing Help leaves its header button focused while real room walking and rover driving still work; native Space opens that Help button, ordinary Pause-focused Space still brakes, and arrows inside the glossary do not change the actual crew selection.

The final focused suite includes fresh Guided/Quick defaults; exact S1/Home reload; Help, glossary, replay and disable; native keyboard/mouse/touch; Explore notes; live objective and instrument values; visible mobile highlighting; pure C5 preview; an actual return from launch to engineering with retained O1 confirmation and new O3/$2840/20-sol workshop values; actual launch, scan, event and report; and zero coach/sol-console overlap at 390/820/1440 with unchanged physical state.

**Existing browser regressions:**

- Four existing model/control cases pass with local fonts: proposal handling, room walking/station closure, review → launch → driving → abort → reset, and missing-model fallback/development reload. See `tutorial-regression-model-controls.log`.
- The complete six-case model suite was run. It reports four passes and two failures caused by unavailable original rover GLBs: real wheel/node integration cannot load the asset, and the connected-workshop asset-ready check receives the preserved fallback state. These two checks remain blocked, not passed.
- Fourteen asset-independent presentation regressions pass, including all supplied outcome labels, legacy reward/value preservation, keyboard navigation, long-content responsive layouts, real missing-asset welcome controls and fixture captures. The three additional presentation cases requiring a real ready GLB were not run because that prerequisite is absent. See `tutorial-regression-presentation.log`.
- An initial development-server font-path issue came from dependencies symlinked outside the Vite root. Identical locked dependencies were copied locally and the four control tests rerun; the final control/presentation logs have no font allowlist errors. Production tutorial checks always used bundled fonts.

**PASS: all six full production mission-browser regressions (10.1 minutes).** All sites and six rankings/save reload; Jezero, Northeast Syrtis and Columbia Hills 30-sol flows; accepted 20-sol budget overrun with one locked mass retry and retained failure; and real G/B driving/scanning with save/resume and once-only instrument billing. See `tutorial-regression-mission-browser.log`.

The focused tutorial browser suite is `tests/tutorial.spec.ts` with `playwright.tutorial.config.ts`, run through `pnpm test:tutorial-ui` in production preview. The focused flows are reported from their final outputs above. Broader existing browser-suite results are recorded from their actual output below.

## Human acceptance goals

These three required human acceptance checks have **not been performed** and are not claimed as passed:

1. Guided adds no more than 90 seconds to a person's playthrough.
2. A first-time player completes a run without external instructions.
3. Three independent playtesters explain a red check and an override before launch.

The prompts are optional and impose no waiting period, but that property does not establish human completion time or comprehension. These goals require real human playtesting.

## Existing-system limitations

- **Formal orders:** The existing game has real proposals, revision priorities and takeover controls, but no authoritative Obey/Counter/Refuse order flow. C2 teaches the available proposal controls and identifies the formal-order limitation instead of fabricating an order interaction or marking an order obeyed.
- **Hints and teamwork:** No new crew-hint/order ledger or teamwork points are invented. Coach/Help/field-note presentation does not write hint credit. A full authoritative teamwork acceptance check remains dependent on that gameplay system.
- **Full 100-point rubric:** Scientific value /30 and mission performance /30 are available. The remaining resource-efficiency, decision-quality and teamwork formulas/ledgers are not completed by this tutorial task. C9 identifies their categories without presenting fabricated totals or awards.
- **Explore writing:** Explore shows the full crew dialogue actually supplied, plus existing engineering advice and state-derived notes. Additional authored storyline dialogue is absent from the accessible source and has not been invented to imply a complete narrative library.
- **Legacy in-flight saves:** Saves without the canonical campaign/sol ledger retain their original operations. C8's plan-based coaching requires a new canonical campaign; old raw observations are not fabricated into a ledger or modern objective bundles.
- **Original assets and hardware:** Original rover/crew GLBs and their target-hardware performance were unavailable. Focused loader tests and procedural-fallback browser checks do not establish full asset integration or GPU/FPS acceptance.

The implementation is based on the retained, accessible source containing the preceding scenario/battery update. Large original project archives and `tt.zip` exceeded the downloader's 32 MiB limit; newer edits confined to those archives could not be compared.

## Exact implementation files changed

Compared with `/workspace/work/ares-missions`, the implementation changes/adds the following files. Screenshot assets and this report are delivery documentation in addition to the code/test list.

| File | Change |
| --- | --- |
| `package.json` | Adds tutorial and presentation commands; scopes the existing model-browser command to its own file. |
| `playwright.tutorial.config.ts` | Adds focused production-preview tutorial test configuration. |
| `scripts/test-tutorial.mjs` | Adds trigger, values, clone isolation, persistence, hint isolation and parity tests. |
| `src/engine/preparation.ts` | Adds the optional saved preparation-open UI flag; decision and proposal calculations are unchanged. |
| `src/engine/tutorial.ts` | Adds pure tutorial context/prompts, glossary/help content, isolated C5 preview and metadata normalization. |
| `src/store/gameStore.ts` | Persists authoritative tutorial/preferences and presentation-only actions alongside the existing game store. |
| `src/game/WelcomeScreen.tsx` | Adds required sentence, first-entry Guided/Skip, pacing and field-guide slot. |
| `src/game/welcome.css` | Styles responsive accessible welcome preferences. |
| `src/game/MarsGame.tsx` | Integrates tutorial layers and compatible keyboard/resume routing with the real views. |
| `src/game/LaunchCenter.tsx` | Adds actual flight-result/tutorial targets and Help placement. |
| `src/game/MissionPlanning.tsx` | Adds targets around real sol-planning, event and End-sol controls. |
| `src/game/MissionReport.tsx` | Adds report tutorial/Help targets and placement. |
| `src/ui/crew/CrewRoom.tsx` | Keeps tutorial UI interaction from invoking room keyboard/navigation actions. |
| `src/ui/crew/PreparationHub.tsx` | Adds actual target annotations, copied instrument-add snapshots, station Help, C5 preview, actual budget/power deltas and Explore presentation. |
| `src/ui/tutorial/TutorialLayer.tsx` | Adds the contextual coach and field guide across the real game views. |
| `src/ui/tutorial/tutorial.css` | Styles bounded coach/help panels, highlights, focus and reduced motion. |
| `src/ui/tutorial/FieldNotes.tsx` | Adds Explore's supplied crew dialogue and state-derived journal. |
| `src/ui/tutorial/preparation-tutorial.css` | Styles compact C5/station-help/journal content and responsive preparation integration. |
| `tests/models.spec.ts` | Selects Skip in the existing mechanics fixture so coaching has separate coverage. Asset checks remain unchanged. |
| `tests/missions.spec.ts` | Selects Skip in the existing mission-flow fixture; the new tutorial suite separately exercises Guided. |
| `tests/tutorial.spec.ts` | Adds actual UI tutorial/preference/dismissal/help/replay/preview/persistence/layout checks. |
| `docs/TUTORIAL_IMPLEMENTATION_REPORT.md` | Records implementation, evidence and remaining limits. |

`docs/GAMEPLAY.md`, `docs/NASA_ENGINEERING.md`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/engine/campaign.ts` and `src/engine/energy.ts` remain byte-for-byte unchanged from that baseline. No scientific calculation, reserve threshold, scenario schedule, mission tier, score rule or accepted-risk consequence is changed by this tutorial layer.

No deployment or merge was performed.
