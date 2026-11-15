# ARES-01 UI redesign report

Date: 2026-11-15. Scope: presentation and interaction only. No change to `docs/GAMEPLAY.md`, engineering formulas, stores' rules, scoring or outcomes. Reference images: the four approved files in `ARES01_UI_REFERENCES_TASK006.zip` (kept outside the repository). The `design_references` / `design-references` directories were not opened.

## What changed, screen by screen

| Screen | Before | After |
| --- | --- | --- |
| Design system | Six overlapping stylesheets, two of them for the removed management game | One token file (`src/ui/design/system.css`): navy/graphite surfaces, amber for the player's action, cyan for science and returned data, coral red for hazards, Manrope display and DM Mono labels, shared buttons, key caps, gauges, chips, dialog, focus ring and reduced-motion rule |
| Welcome | Title and one button | Numbered mission menu over the live Mars scene; copy on the minor golden section; sources, controls and the non-endorsement note in menu item 02 |
| Crew selection | Grid of six cards covering the room | The selected crew member stands in the room on the major golden section. Dossier on the left shows name, role, responsibility, the station they own and how teammates' proposals work. `←` `→`, the seat rail, or clicking a teammate in the room switches seat; dragging turns the character |
| Mission preparation | Left column of station cards and a large right-hand panel | The room is the interface: floating name tags on the crew, numbered rover markers, a station dock at the bottom, a slim always-visible **mission margins** rail (mass, peak power, energy per sol, usable battery, downlink, science targets) and a compact station console that opens only when a station is in use |
| Instrument inspection | Numbered buttons, drifting slightly while the camera eased | Markers snap to whole pixels and the camera settles exactly, so markers hold still; the selected marker shows the instrument name; each instrument row shows its mass and power from `src/nasa/data.ts` |
| Crew interaction | Text paragraphs in the panel | A speaker block (portrait, name, role, then what they say). Accept proposal, Ask to revise, Take over, Apply changes and Discard preview are unchanged in behavior. A confirmation line appears when a decision is recorded |
| Engineering feedback | Six stat cards per panel | The margins rail shows the current plan and, while an edit or proposal is pending, the previewed value beside it (`→`). Gauges turn amber above 90% of a limit and red above it. Hard-check failures and advisories are counted from the model's own `issues` and `warnings` |
| Launch | Flat disc, unlit rocket behind the text | Pad with markings, service tower with retracting arms, rocket on the major golden section, flight manifest read from the confirmed mission (rover mass, instruments, reserve, downlink), six-stage timeline |
| Mars surface | Boxed panels and a stepper | Edge-anchored HUD: objective with a per-target status list (next / onboard / returned), telemetry with the chosen reserve policy marked on the power gauge, key-cap control hints, stacked mission actions, crew-voiced event cards, redesigned pause screen and abort dialog |
| Mission dossier | Paper dossier (kept) | Same structure and content. Added a tone tape, an outcome stamp that restates the recorded outcome and returned-record count, bracketed section numbers and status chips |
| Credits | In welcome notes and dossier | Unchanged wording, including the asset-rights caveat and the non-endorsement disclaimer |

Golden-ratio use is limited to large composition: copy columns take about 38.2% of the width and the 3D subject is framed on the remaining 61.8% (welcome, crew selection, launch, pause, station consoles). Components are sized for their content.

## Files

**Added:** `src/ui/design/system.css`, `src/ui/crew/prep.css`, `src/game/launch.css`, `src/game/surface.css`, `tests/redesign.spec.ts`, `scripts/capture-journey.mjs`, `scripts/measure-scenes.mjs`.

**Rewritten or changed:** `src/main.tsx`, `index.html`, `src/game/MarsGame.tsx` (HUD markup only; state and effects untouched), `src/game/WelcomeScreen.tsx`, `src/game/welcome.css`, `src/game/LaunchCenter.tsx` (scene and layout; stage sequence and timers unchanged), `src/game/MissionReport.tsx` (stamp, tape, section numbers), `src/game/mission-report.css`, `src/ui/crew/PreparationHub.tsx` (layout; decision logic unchanged), `src/ui/crew/CrewRoom.tsx` (lighting, rover turntable, name tags, seat framing, drag-to-turn, steady markers), `src/ui/crew/CrewPortrait.tsx`, `README.md`, `docs/STATUS.md`.

**Removed (dead legacy UI, not imported by the game):** `src/ui/App.tsx`, `src/ui/Engineering.tsx`, `src/ui/crew/CrewSelection.tsx`, `src/ui/components/ResourceMargin.tsx`, `src/ui/styles.css`, `src/ui/nasa-flow.css`, `src/ui/mission-ui.css`, `src/game/game.css`, `src/ui/crew/crew.css`, `src/ui/crew/hub.css`. The legacy data and store fields remain because the save format and engine tests read them.

## Screenshots

Not included in this commit. `scripts/capture-journey.mjs` captures the 20-step journey at 1440, 1366, 820 and 390 px from a running build (`ARES_UI_ORIGIN=<url> node scripts/capture-journey.mjs after <folder>`). Every screen was reviewed from such captures at all four sizes during the work; a before/after set can be regenerated from commit `ba5ef95` and this one.

## Test results

| Suite | Result |
| --- | --- |
| `npm run test:engineering` | PASS, 60 checks |
| `npm run test:preparation` | PASS, 72 scenarios and 36 station paths |
| `npm run test:mission-budget` | PASS, 1,239 cases |
| `npm run test:model-loading` | PASS, 20 tests |
| `npm run test:models` (existing 25 Playwright tests, unmodified) | PASS, 25 of 25 |
| `tests/redesign.spec.ts` (new) | PASS, 3 of 3 |
| `npm run build` | PASS. JS 1,090 kB (was 1,071 kB); CSS 94 kB (was 125 kB) |

No existing test was edited. The new tests check that seat selection, the margins rail, the launch manifest and the surface reserve marker show values read from the store and `calculateEngineering`, that a preview never changes the plan, and that there is no horizontal overflow at 390, 820 and 1366 px.

The launch scene was simplified after these runs (see Performance). After that change the type check and build pass and the launch-to-Mars test in `tests/redesign.spec.ts` passes; the other Playwright suites were not re-run.

## Accessibility

- Every existing accessible name used by the tests is unchanged. Decorative portraits are hidden from assistive technology so button names are the crew member and role only.
- One visible focus ring everywhere (2 px amber, 3 px offset).
- `prefers-reduced-motion` removes animations and makes camera moves immediate; the existing reduced-motion tests pass.
- Keyboard: `←` `→` on crew selection, `E` and `Esc` in the room, all station controls are native buttons, selects and checkboxes.
- Not done: a screen-reader pass with real assistive technology, and contrast measurement of every text and background pair.

## Performance

Measured by `scripts/measure-scenes.mjs` on production builds, 1440×1000, headless Chromium with **software rendering (SwiftShader)** on an Intel Core i7-12700 under WSL2. These figures compare two builds on one host. They say nothing about real GPUs, and the 30/60 FPS targets were **not** tested on real low-end or mid-range hardware.

| Scene | Before FPS | After FPS | Draw calls before → after | Triangles before → after |
| --- | --- | --- | --- | --- |
| Crew selection | 3.89 | 4.06 | 437 → 418 | 400,469 → 336,945 |
| Workshop idle | 3.62 | 3.81 | 444 → 452 | 401,645 → 402,165 |
| Mars idle | 1.70 | 1.54 | 571 → 571 | 393,330 → 393,330 |
| Mars driving | 1.72 | 1.59 | 564 → 565 | 391,410 → 391,590 |
| Launch pad | 45.5 | 18.2 (see note) | 14 → 65 | 904 → 2,316 |

- One sample per build; run-to-run noise on this host is large (the welcome scene, whose 3D content is unchanged, measured 2.7 and 1.2 FPS in two baseline passes). The Mars differences are within that noise; the scene code is untouched.
- **Launch pad regression, then fix:** the first redesigned launch scene added two point lights, a second directional light and about 50 separate tower meshes, and dropped from 45 to 18 FPS in software rendering. The scene was then cut back to the original light count (one shadowed key light plus ambient) and the tower lattice merged into one mesh. That version builds and plays through, but **its frame rate has not been re-measured**.
- No new WebGL renderers, post-processing, textures or particle systems. The room gained one cylinder, one ring and six small screen quads, and lost the wireframe globe. An extra room point light was added and then removed because it slowed software rendering.
- Task 005's loading, retry and cancellation code is unchanged.

## Remaining limitations

- No touch driving controls on Mars (existing gap). The room has an on-screen pad on touch devices.
- Crew still use the supplied GLB models with procedural motion. No toon shading or authored animation was added.
- The display font is Manrope 800. A heavier monospace display face closer to the references would need a new font package.
- The room and Mars scenes are heavy for integrated graphics (about 400,000 triangles and 450 to 570 draw calls each). That is unchanged by this task.
- On phones the welcome menu sits over the rover.

## GAMEPLAY.md features with no interface yet

The rules for these are not implemented, so no interface was invented for them. The layout has room for each one.

| Feature | Where it will go |
| --- | --- |
| Landing site and objective ranking (D2, D3) | A sixth dock station and console; site shown on the launch manifest |
| Launch vehicle, launch window, relay orbit (D7, D8, D9, D15) | Dock stations; vehicle capacity replaces the fixed 1,025 kg allowance on the mass gauge |
| Budget bar | A seventh row in the margins rail, fed by `src/engine/missionBudget.ts` once vehicle and relay choices exist |
| Go/no-go checklist with override, accepted risks | The readiness-review console, which already lists station decisions, hard checks and advisories |
| Launch and landing outcomes, retry and damaged operations (S5, S6, R1, R2) | Launch stage timeline and panel; they currently show the scripted sequence only |
| Sol plan, End sol, 30-sol clock, events E1, E2, E4, sampling (D11, D12) | Surface top line (sol clock) and the event cards |
| 100-point score, tiers, cause chain | Additional dossier sections |
| Tutorial, coach prompts, glossary, Quick/Explore | Not started |
| Order responses (Obey, Counter, Refuse) | Not implemented in the game, so not present in the console |
