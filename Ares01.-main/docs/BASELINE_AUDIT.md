# ARES-01 baseline audit — Task 001

Date: 2026-11-14. Authority: [GAMEPLAY.md](GAMEPLAY.md), read in full (379 lines). This is an audit of the actual checkout, not an endorsement of prior status documents. The complete requirement-by-requirement assessment is [COMPLIANCE_MATRIX.md](COMPLIANCE_MATRIX.md). No implementation, refactoring, deployment, push, merge, reset or stash restoration was performed. The excluded `design-references` directory was not inspected. Only these two audit documents are deliverables.

**Assessment:** the current build is a working partial prototype, not a compliant implementation of GAMEPLAY.md. Production/TypeScript and the two Node test suites pass; the actual browser suite passes 5 of 6 tests. The matrix contains 129 requirement rows: 1 VERIFIED, 48 PARTIAL, 17 INCORRECT, 61 MISSING and 2 BLOCKED. Many PARTIAL rows contain tested subfeatures; the counts are not a weighted completion percentage. The critical gaps are computed mission consequences, the thirty-sol resource loop, full crew decisions and prescribed scoring/reporting.

## 1. Repository state and version

| Item | Observed baseline |
| --- | --- |
| Working directory | `/home/kavi/code/Ares01` |
| Branch | `main` |
| HEAD | `c7b88d752ce7594674ee0e6c38bf636732cb6195` |
| Commit | `Remove dust event (E3) from gameplay doc` |
| Commit timestamp | 2026-11-14 11:53:55 -0500 |
| Package | `ares-01`, private, version `0.1.0`, ES modules |
| Initial staged / modified / untracked | None; `git status --short`, unstaged diff and cached diff all empty |
| Stashes | `stash@{0}: WIP on main: bb3ff1b Clean up md files`; listed only, not opened/applied/modified |
| Local instructions | No applicable AGENTS.md found in project or ancestor directories |
| Current implementation | Connected preparation hub → scripted launch/arrival → live Jezero rover → report. `src/main.tsx` mounts `MarsGame`, not the old agency dashboard `App` |

The checked-out version is this exact commit plus the two new audit documents. Prior history and stash contents were not used to infer implementation. `docs/STATUS.md` was consulted only after source inspection; its “E1 to E4” and dust-storm backlog language does not supersede the current E1/E2/E4 specification.

Structure: `src/nasa` contains active reference data/calculations; `src/engine` preparation, outcomes and legacy economy/design; `src/store` campaign and surface Zustand stores; `src/ui/crew` preparation UI and Three.js room; `src/game` launch/surface/report; `src/models` GLB loading and runtime rig adaptation; `src/ops/visual` optional v2 terrain/effects; `src/data` crew/targets plus legacy parts/sites/vehicles/technology; `public/models` and `public/portraits` shipped assets; `scripts` Node/Vite checks and portrait generator; `tests/models.spec.ts` browser checks. Documentation is in `docs`; Vite, TypeScript and Playwright configuration files are at root.

Dependencies from package.json: React/React DOM, Three.js, Zustand, Vite with React plugin, TypeScript, Radix tooltip/alert-dialog, lucide-react, Manrope/DM Mono fonts; development dependencies Playwright and React/Three type packages. Several versions are `latest`; a `pnpm-lock.yaml` exists. Installed versions actually used: React/DOM 19.3.1, Three 0.187.0, TypeScript 7.0.2, Vite 8.3.6, Zustand 5.1.0, Playwright 1.65.1. Node is v24.11.1; README requires Node 20.19+ and pnpm. Existing node_modules occupies 443 MB. A fresh reproducible installation was **not** verified.

## 2. Commands, build and test results

### Execution ledger

| Command / operation | Actual result |
| --- | --- |
| `pwd`; targeted `rg --files`, `rg -n`, `cat`, `sed`, `nl`, `wc`, asset `du`; scoped ancestor instruction reads | Read repository/code/spec/tests/assets, excluding design-references. No source edits |
| `git status --short`; `git branch --show-current`; `git rev-parse HEAD`; `git log -1 --format=fuller`; `git diff --stat`; `git diff --cached --stat`; `git stash list` | Clean baseline and one untouched stash as above |
| `node --version` | v24.11.1 |
| `pnpm --version`; `pnpm install` | Failed: `Error: Cannot find module '/home/kavi/.cache/node/corepack/v1/pnpm/12.18.0/bin/pnpm.cjs'`, code `MODULE_NOT_FOUND`. Installation never ran |
| `npm run build` (run twice while recovering truncated combined tool output) | Exit 0; `tsc -b && vite build`. Production compilation and strict TypeScript project build passed |
| `npm run test:engineering` | Exit 0; printed `PASS 60 engineering/campaign checks: NASA equations, constraints, assumptions, outcomes, recovery, rewards and persistence` |
| `npm run test:preparation` | Exit 0; printed `PASS 72 proposal scenarios, all 36 station paths, save migration, preparation persistence and reset` |
| Both Node/Vite suites above | Also emitted `WebSocket server error: Error: listen EPERM: operation not permitted 0.0.0.0:24678` in sandbox. Assertions completed; this was a server permission warning, not a failed assertion |
| `npm run test:models -- --output=/tmp/ares-audit-test-results` in sandbox | Exit 1: `Error: Process from config.webServer was not able to start. Exit code: 1` |
| Same command with local-server sandbox escalation | Server ran; all six tests failed before execution because expected browser was absent: `Executable doesn't exist at /home/kavi/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell` |
| `CHROMIUM_PATH=/home/kavi/.cache/ms-playwright/chromium-1234/chrome-linux/chrome npm run test:models -- --output=/tmp/ares-audit-browser-results` | Setup attempt used wrong installed path; all six failed to launch. Error: executable doesn't exist at that path. No app assertion evaluated |
| `CHROMIUM_PATH=/home/kavi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome npm run test:models -- --output=/tmp/ares-audit-browser-results` | Actual browser execution: **5 passed, 1 failed**, 4.5 minutes; details below |
| `npm run preview -- --host 127.0.0.1 --port 5180 --strictPort` | Built game served locally for additional production smoke checks; no deployment |
| `node /tmp/ares-audit-smoke.mjs` | Temporary outside-repository browser probe. First attempt captured home but timed out on an overly exact accessible-name selector (rendered arrow is part of button name); probe selector corrected, application untouched. Final run exit 0: preparation reload, launch, drive/scan/uplink, surface reload, report; no page errors. Results below |
| `node -e ...` reading installed package.json versions; targeted Chromium cache file discovery | Confirmed installed versions and available Chromium 1234; no browser downloaded |

No `test`, lint, or separate typecheck script exists. Package scripts are `dev: vite`, `build: tsc -b && vite build`, `preview: vite preview`, `test:engineering: node scripts/test-engine.mjs`, `test:preparation: node scripts/test-preparation.mjs`, `test:models: playwright test`, `assets:portraits: node scripts/generate-portraits.mjs`. The asset generator was not run because it writes assets. npm was used to invoke the same scripts after pnpm failed; no alternate npm install or lockfile rewrite was performed. Build/cache output is ignored; test/probe artifacts are in `/tmp`.

Build output: 2,208 modules transformed; JS `dist/assets/index-axLATvOG.js` 1,053.19 kB (297.31 kB gzip); CSS 103.09 kB (30.71 kB gzip). Exact warning: `(!) Some chunks are larger than 500 kB after minification.` This is a warning, not a build failure.

### Existing browser suite

Actual Chromium run, without test/source edits:

| Test | Result and limits |
| --- | --- |
| Six rover axle pivots, ground alignment, instrument visibility | PASS, 890 ms. Checks all five mapped exterior instrument groups, fixed hardware, wheel rotation and 1.8–2.5 m model height; does not validate every scientific model detail |
| Connected workshop, ownership, previews, mobile layout | FAIL after 1.6 min at `tests/models.spec.ts:68`, clicking `Inspect RIMFAX on rover`. `TimeoutError: locator.click: Timeout 30000ms exceeded`; repeated `element is not stable`. Earlier ownership/draft/apply/MOXIE assertions reached; review/canvas identity/mobile assertions after line 68 **not reached** |
| Proposal acceptance and changed constraints | PASS, 38.3 s; accept changes reserve and unsafe 950 W scenario blocks proposal/launch |
| Walking, station navigation/closure controls | PASS, 46.8 s |
| Review→launch→drive→abort→report→new campaign | PASS, 57.9 s; no page errors asserted by that test. Does not test engineering-based launch/landing failure |
| Missing model fallback, controls, development reload home | PASS, 23.5 s; deliberate GLB request abortion emitted `Rover model unavailable; using procedural rover. TypeError: Failed to fetch` as expected |

The browser suite used an older installed Chromium revision through the repository's supported `CHROMIUM_PATH` override. Its required Playwright revision was missing. The hotspot failure is an observed actionability problem in this environment, not a proven all-browser failure. A concurrent production probe may have increased rendering pressure. It remains unresolved; tests were not weakened to pass. Earlier `/tmp/ares-hub-*.png` files predated this audit and were not treated as current evidence.

### Additional production smoke (built output)

A fresh temporary Chromium profile used the actual UI, with no injected mission state. The final probe exited 0 and recorded `PAGE_ERRORS []`.

| Flow | Actual observation |
| --- | --- |
| Preparation save/resume | Entered as Kavi, accepted Houssam’s 40% reserve proposal, reloaded production. `preparation.stage=workshop`, `activeStation=power`, accepted mode and configuration fingerprint matched before/after |
| Launch/landing presentation | Clicked countdown, liftoff, Mars approach and deploy; reached active rover. This verifies the scripted path only |
| Exploration/science | Drove forward 3.3495 m, braked, used Start Scan at Ancient Lakebed Outcrop; discovery recorded, then clicked Uplink |
| Surface save/resume | Before/after reload persisted state matched: x=-18, z=8.6504689384, heading=0, distance=3.3495310616, battery=97.9235880399%, sol=1, scannedTargets and transmittedTargets both `[ancient-outcrop]`, science=25. No events. This is a checkpoint-resume result, not proof of exact mid-frame/mid-scan resumption |
| Report | End mission opened PARTIAL SUCCESS; first target RETURNED, two NOT COMPLETED, +25 RP. Persisted ended=true, outcome=partial-success, rewardApplied=true |
| Responsive surface | At 390×900, scrollWidth=390 and innerWidth=390. Fresh screenshot inspected; no horizontal overflow, visible rover/target/action buttons/telemetry. Touch driving was not possible through any visible surface movement control; keyboard drive instructions disappear at this width. Do not infer that workshop responsiveness passed |
| Performance | Approximately 2.218 requestAnimationFrame callbacks/second in a roughly two-second sampling window at 1440×1000 after reload, using installed headless Chromium with SwiftShader allowed. This environment was not smooth enough for acceptable live play. This is not a representative hardware benchmark; no claim about user-device FPS or v2 performance |

Fresh evidence captured under `/tmp`: `ares-audit-home.png`, `ares-audit-seats.png`, `ares-audit-power.png`, `ares-audit-review.png`, `ares-audit-launch.png`, `ares-audit-mars.png`, `ares-audit-scan.png`, `ares-audit-mars-mobile.png`, `ares-audit-report.png`; probe/log `ares-audit-smoke.mjs` and `ares-audit-smoke.log`. Home, power, review, launch, Mars, scan, mobile and report images were actually opened for inspection, as was the failing workshop test image in `/tmp/ares-audit-browser-results/models-connected-workshop--370bc--previews-and-mobile-layout/test-failed-1.png`. These are temporary local evidence, not additional repository deliverables. No claim is made that all three targets, every event, or a full thirty-sol mission were browser-tested.

### Coverage caveat

The engine suite asserts partial success for scanned-but-unreturned data, immediate failure at zero battery, and a 24° terrain rule. These passing expectations contradict GAMEPLAY.md. Preparation checks prove deterministic and safe proposals only against the **implemented subset** of checks; budget, landing, launch vehicle and relay masses are absent. No existing automated suite validates the full S0–S8/R1/R2 flow, thirty sols, prescribed E1/E2/E4 calendar, ordered objectives, 100-point score, tutorial equivalence or Quick pacing.

## 3. Current architecture

`src/main.tsx` installs fonts/global CSS/Tooltip.Provider and mounts `MarsGame` in React.StrictMode. `MarsGame.tsx` selects the preparation hub, launch, Mars world or report using `gameStore.missionPhase`. It also manages abort dialog, fade timers, keyboard input and the battery-zero endpoint. There is no authoritative S0–S8 transition reducer.

`gameStore.ts` is a persisted Zustand store (`ares-01-campaign`, version 6). It owns preparation stage/station/decision fingerprints, selected seat, editable roverConfig, confirmed config/calculation snapshot, progress, events/transmissions/outcome, plus old agency/design fields and actions. `marsStore.ts` duplicates battery/sol/scans/science/distance with a separate transient active/paused/complete phase. A subscription synchronizes only selected campaign-phase changes. `MarsWorld.tsx` keeps another copy of battery, elapsed sol time, position, heading, distance and scan progress in its render effect closure. It pushes telemetry about every 125 ms and persistence every five simulation seconds. This distributed ownership is the main consistency risk.

`nasa/engineering.ts` is a useful pure-calculation layer: residual platform mass, MMRTG exponential fit, battery Ah×V/reserve/efficiency, per-sol generation/activity Wh, peak load, idealized link capacity, drive energy and slope angle. `engine/preparation.ts` enumerates instrument subsets or small power/link choice sets, filters current hard issues/negative energy/data excess, scores domain candidates and uses a stable configuration tie-break. H presents a proposal/draft until explicit acceptance/application. `missionFailure.ts` handles a different, smaller anomaly/outcome model rather than the specified state/failure/scoring system.

Rendering uses imperative Three.js inside React effects, not another engine: independent scenes/renderers/cameras in CrewRoom, LaunchCenter and MarsWorld; DOM panels/HUD layered over canvases; requestAnimationFrame loops and ResizeObservers; raycast/projected hotspots and room paths; procedural terrain queried by drive physics; imported rover with wheel split/steering pivots; crew rig normalization and procedural motion. V2 terrain, horizon, instanced rocks/pebbles, tracks, dust, beacons and environment maps are opt-in through `?visual=v2`; quality query low/medium/high. Default remains v1. Shadow maps, tone mapping, pixel-ratio caps and disposal paths exist. Live resource simulation is embedded in the Mars renderer.

### Assets and paths

`src/models/assets.ts` fetches `/models/rover.glb` (~6.4 MiB) and `/models/crew/{id}.glb`, with 30-second abort timeout and GLTFLoader.parseAsync. It caches **three promises of downloaded bytes**, not shared live scenes, and evicts oldest entries. Each consumer owns/disposes its scene. Crew GLBs are about 8.6–17 MiB each (~66 MiB total); six portraits `/portraits/{id}.png` are roughly 76–84 KiB each. `CrewPortrait.tsx` supplies portrait presentation; crew models arrive progressively. Fonts are bundled from @fontsource. Terrain/effects/textures and launch rocket are procedural; no shipped voice/audio files were found in the public asset inventory.

Rover adapter `src/models/roverModel.ts` splits source wheels, rotates/grounds the imported rover and maps Mastcam-Z/SuperCam/PIXL/SHERLOC/RIMFAX nodes. MOXIE/MEDA have inspection markers but no independent visibility nodes. Character adapter and `crewAnimation.ts` normalize height, suppress duplicate rigs, transfer skin weights from nearest body vertices at runtime and animate bones procedurally. Model download failure retains preparation controls and procedural surface fallback. Root-absolute `/models` and `/portraits` paths assume root hosting; subpath deployment is unverified. No asset changes were made.

## 4. Verified working features

Execution establishes production/TypeScript compilation; implemented engineering arithmetic and configuration rejection; stored selected seat/configuration/progress/outcome; reward-on-return logic; three-domain deterministic proposal generation and ownership boundaries; station pathfinding across all 36 seat/station combinations; preparation migration/reset. Browser execution additionally establishes rover model geometry/visibility, proposal acceptance/invalid constraints, room walking/interactions, launch-to-Mars driving, abort/report/reset, and model-missing fallback controls. The production probe additionally verified first-target scan/uplink/report and preparation/surface checkpoint reload.

These are narrow verified behaviors. They do not establish whole-mechanic compliance. In particular the existing launch cinematic runs, but does not compute mission outcomes; the report opens, but does not implement the required score/headline/tier; the tested save subset is not exact resumption of every mission state.

## 5. Missing gameplay systems

Highest-impact absences: site scenarios and ranked objectives; mission budget and instrument/vehicle/orbit costs; vehicle/window/orbit choices; explicit override/accepted risks and launch/landing checks; retry with locked failure cause; damaged surface operations; thirty-sol planning and transmission ledger; mandatory scheduled E1/E2 and predictive E4; sampling choice; full six-seat bot ownership/orders/stories/hints; 100-point score, recovery tier and causal report/export; Guided/Skip coaching/glossary and Quick/Explore pacing. See matrix for every decision, state and handoff rather than treating this list as exhaustive.

## 6. Incorrect/conflicting implementation and practical consequences

| Priority / finding | Exact affected files and evidence | Player/engineering consequence |
| --- | --- | --- |
| P0 — State ownership split | `gameStore.ts` State/setMissionPhase; `marsStore.ts` savedProgress/phase; `MarsWorld.tsx:473` closure, :659 telemetry, :663 checkpoint; `PreparationHub.tsx` go; `LaunchCenter.tsx` local stage | No guarded legal mission path; phase/progress/config can disagree; changes require synchronized edits across renderer/stores/UI |
| P0 — Scripted flight | `LaunchCenter.tsx` advance and render copy; `gameStore.ts` confirmMission/startSurfaceMission | Always announces successful transfer/touchdown; no capacity/site risk, R1 or R2; decisions cannot produce required consequences |
| P0 — Incorrect mission clock | `MarsWorld.tsx:506` increments elapsed outside active-phase guard, :659 derives sol via floor(elapsed/90)+1 | Sol advances while paused/home; no plan/end-sol, cap or scheduled calendar. Frame delta clamped to .05 also ties elapsed mission progress to frame delivery |
| P0 — Wrong accounting | `MarsWorld.tsx:557–567`: routine activity charged over time plus scan charge :593–599; driveEnergyWh uses slope 0 and fixed FIXED.massKg; nominal 2408 literal; `nasa/engineering.ts` returns delivered efficiency-adjusted energy separately | No drive/science/transmit allocation; selected mass/actual slope do not affect drive cost; potential double charging science; reserve delivery model and runtime disagree |
| P0 — No data/energy transmission ledger | `gameStore.ts` uplinkResults; `missionFailure.ts` createMissionRecord; `nasa/engineering.ts` dataMbit/linkMbit | Uplink moves every scanned ID instantaneously without pass time, per-objective volume or transmit energy. Active backlog blocks everything; switching UHF clears it, not actual queued data |
| P0 — Wrong outcomes/failure endpoint | `missionFailure.ts` missionOutcome; `MarsGame.tsx:80`; `MissionReport.tsx`; `scripts/test-engine.mjs` no-return partial assertion | Zero battery fails immediately; scanned-only mission can be partial despite zero returns; two top objectives not baseline SUCCESS; no failure-history recovery distinction |
| P0 — Terrain limit conflict | `nasa/data.ts` FIXED.slopeLimitDeg=24; `MarsWorld.tsx:529–534`; `scripts/test-engine.mjs` 24/25 assertions vs GAMEPLAY §4/§6 30° | Player blocked at different threshold; no choice to cross/reroute; obstacle geometry collision not 0.40 m capability check. Owner must resolve without silently changing authority |
| P1 — Warning/override mismatch | `nasa/engineering.ts` issues versus warnings; `PreparationHub.tsx` review/apply; `gameStore.ts` confirmMission | Energy/data failure conditions proceed without explicit accepted risk; hard failures cannot be overridden at all |
| P1 — Snapshot mutability and stale closures | `gameStore.ts` recoverMissionEvent replaces confirmed config/results; `MarsWorld.tsx` effect depends on instrument visualKey, not complete config; closure reads config.baselineW/reserve while activityWh reads latest store | “Confirmed” design is altered after launch; future same-payload setting updates may leave renderer using old settings; original versus recovery design not preserved |
| P1 — Hardware can be changed after landing | `MarsGame.tsx` CONFIGURE A GEOLOGY INSTRUMENT action sends missing-payload mission back to engineering; normal approve/launch redeploy resets progress | Physical payload limitation can be undone through free engineering/relaunch path rather than specified reduced mission; no retry count/history |
| P1 — Save not exact | `gameStore.ts` skipHydration in DEV/partialize/migrate; `LaunchCenter.tsx` useState(0); `MarsWorld.tsx` periodic save and reconstructed elapsed; `marsStore.ts` transient scan/phase | Dev reload intentionally erases active session view; production launch restarts at pad; scan/pause/partial-sol lost; last movement may be missing from checkpoint/report |
| P1 — Event history incomplete | `gameStore.ts` raiseMissionEvent replaces previously recovered same ID; `missionFailure.ts` recoverEvent | Repeated reserve/terrain episodes overwrite earlier history; report cannot establish complete consequence chain or no-safe-mode/no-drop story measures |
| P1 — Review data incomplete | `PreparationHub.tsx` record and fingerprints; `preparation.ts` safe filter and scoring | Three station records cannot distinguish all five scored decisions, blind accepts, hints/orders; cost priority absent and 10% mass preference unreachable with current allowance |
| P1 — Large models and runtime rig work | `assets.ts` 3-entry cache vs 7 models; `crewAnimation.ts` nested clothing-vertex/body-sample nearest search; CrewRoom progressive loader | Loading/re-entering may re-download/reparse large files; synchronous skinning and wheel split can stall UI. No measured memory/leak budget established |
| P1 — Unstable inspection target | `CrewRoom.tsx:216` projected hotspot positions; TB:68 timeout | Removed RIMFAX hotspot did not settle for automated click in observed run; pointer usability/reproducibility risk |
| P2 — Dead/legacy system remains connected to persistence | `src/ui/App.tsx` not imported by entry; `Engineering.tsx`, `crew/CrewSelection.tsx`, `crew/CharacterPreview.tsx` older alternatives; `engine/design.ts`, `economy.ts`, `data/parts.ts`, `sites.ts`, `vehicles.ts`, `techs.ts`, `constants.ts`; G imports/actions | Duplicate design/route/economy vocabulary and incompatible solar/cost/vehicle values confuse future work. Not all code is dead: legacy state/reward dependencies still used, so removal needs dependency audit |
| P2 — Rendering/resource concerns | `MarsWorld.tsx` builds hidden procedural rover including invisible solar panels, then imports GLB; render cleanup disposes materials/geometries but not every procedural texture explicitly; separate quality branch collision obstacle lists | Extra GPU/CPU work; possible texture retention needs profiling; v1/v2 obstacle lists differ so visual mode may change traversability. Solar panels are hidden: not claimed visible gameplay |
| P2 — Bundle/resilience | `src/main.tsx` eager import graph/all legacy CSS; MarsWorld/LaunchCenter WebGL constructors lack CrewRoom-style catch; models root paths | Large first load; WebGL-unavailable surface can fail rather than fall back gracefully; subpath deployment uncertain |

## 7. Technical risks and limits

Preserve Three.js and the existing controls/proposals/model adapters while designing later fixes. A green build is not a compliance gate. Current tests intentionally codify several conflicting rules; revising those tests requires approved behavioral changes, not merely loosening assertions. Data/simulation must be separated from display timing before implementing deterministic thirty-sol events or reliable saves.

Fresh pnpm installation and the exact Playwright-pinned browser remain unverified. Production bundle warning and large assets are measured; acceptable real-device performance, mobile touch-driving, prolonged memory behavior and cross-browser support are not established. No external NASA source was fetched or independently verified; this audit checks the project's labels, data paths and equation use, not scientific certification.

## 8. Visual and UX findings

Only newly captured runtime images are evidence. Fresh default home and failed-workshop screenshots were opened with the image viewer. The home is a full Three.js landscape with a large recognizable rover, orange terrain, distant ridges, cyan target and clear primary action. It is already world-centered. Workshop combines a large rover/crew scene with a five-station left rail and dense right-hand forms/metric tiles. It is interactive, but engineering work is still primarily menu/panel-driven; it has dashboard characteristics even though the old agency dashboard is not mounted.

The inspected workshop image shows a close rover view partly hidden by the right panel, small floating numbered/hardware markers, bright body highlights and a crew figure behind. Camera focus supports hardware inspection but panel occlusion and moving targets reduce clarity. Home typography/action hierarchy is strong; the workshop has more competing labels and numerical tiles. Mass/Wh/Mbit deltas and proposal reasons expose useful tradeoffs, but absence of budget/risk consequences prevents understanding the documented mission design. Crew do provide actionable proposals in three domains; the remaining seats and launch reactions lack meaningful decision/story systems.

Golden-ratio-informed composition (1:1.618) is a future design constraint; no measured ratio compliance is claimed and no redesign was attempted. Production evidence is recorded in §2. The inspected power-station reload image still showed placeholder geometry while the next review image showed loaded crew/rover, demonstrating progressive loading. Launch uses a simple procedural rocket against a dark background; visual fidelity differs markedly from the detailed imported rover. The report is a readable text/list page, but exposes RP and generic lessons instead of the specified score and causal analysis. At 390×900 the surface composition retained the rover and bottom actions without overflow, but no touch movement UI was visible; full mobile play is not verified. Static images and a short software-rendered browser run cannot certify immersive pacing, learning outcomes, acceptable hardware performance or an entire responsive experience.

## 9. Specification ambiguities requiring owner decisions

GAMEPLAY remains authoritative until explicitly changed. These are decisions to resolve before dependent implementation, not reasons to alter it during audit.

1. **Slope:** GAMEPLAY says 30°, code and NASA engineering's later operational rule use 24°. Confirm the rule or explicitly amend GAMEPLAY; default compliance target remains 30°.
2. **Missing mission inputs:** capacities to Mars, vehicle/window effects, relay masses, landing capability/hazard/damage mapping, site hazard maps, objective completion criteria, sample cost/value and scheduled event sols require member 2/4 data or approved tagged assumptions. Clarify whether transfer mass includes fixed cruise/EDL in addition to rover and relay.
3. **Data loss versus waiting:** §4 drops excess with zero score, while E2 queues remainder and orders allow prioritized waiting. Specify buffer size, priority, drop trigger and whether losses differ for accepted design risk versus scheduled outage. O1 needs typical-fit/full-payload-overload generation assumptions normalized across per-experiment/per-sol data.
4. **Safe-mode/loss definition:** §4 says deficit then three in a row loses rover; §2/§5 says battery zero for three consecutive sols; E4 skips next sol. Clarify counter/reset timing and how safe mode interacts with zero energy and MMRTG recovery.
5. **No failure without override:** how do later unsafe sol plans, live terrain crossing and repeated depletion record accepted risks? Define whether End mission/Abort are allowed before sol 30/20 and what their headlines should be; the specification describes rover loss as the only early stop.
6. **Scoring edges:** partial credit curves under 70% utilization / budget 95–100%; interval/aggregation for energy/data efficiency; no-relevant-hints denominator; partial objective fractions; repeated D11 checkpoint review aggregation. Clarify whether “confirmed on review screen” differs from blind per-station Accept.
7. **10% Systems margin:** seat rule says ≥10%, example allows 8%; define preference versus mandatory safe proposal. Current fixed allowance makes 10% unattainable even with no instruments. Approved vehicle capacities should resolve rather than silently lowering the rule.
8. **Narrative/assets:** approve 36 story lines, order/counter texts, full dialogue/field notes/glossary, voice delivery and VRM versus current GLB expectations. Human acceptance requires three playtesters and measured Guided/Quick times.
9. **Save precision and onboarding preference:** reconcile stage-start autosave with “exactly where they stopped” mid-drive/cinematic; decide whether first-launch tutorial preference survives new mission reset. Production behavior should be acceptance target even if dev intentionally starts home.

## 10. Prioritized recommendations for Director review

1. **P0 — Agree the data and rule contract.** Resolve items 1–7 above; approve scenario/vehicle/relay/landing/objective tables with source tags. Keep current GAMEPLAY semantics until explicit amendments.
2. **P0 — Establish one mission simulation/state contract.** Model S0–S8/R1/R2, legal transitions, immutable check/risk/result history, thirty-sol resource ledger and save schema independently of renderer timing. Preserve current usable math and live controls.
3. **P0 — Implement consequence-complete vertical flow in a separately authorized task.** Budget/vehicle/orbit/go-no-go → computed launch/retry → landing/damage → planned surface/event/data return → prescribed report. Define acceptance fixtures before claiming compliance.
4. **P1 — Complete crew, score and onboarding on the same state.** All fifteen decisions, scheduled events, orders/hints/stories, five score categories, tutorial/pacing parity, export/replay and exact resume.
5. **P1 — Resolve observed browser regression and strengthen verification.** Stabilize inspection hotspots; restore documented package/browser reproducibility; add specification-based tests including failure/recovery and production reload. Do not relabel the existing green unit suites as full gameplay acceptance.
6. **P2 — Profile and polish after behavior is stable.** Profile large rig preparation, cache/disposal, bundle split and responsive surface controls; retain Three.js as central world, reduce panel obstruction, apply the future 1:1.618 composition guidance. Remove legacy code only after dependency/save migration review.

No Phase 1 implementation is authorized or begun by this audit. Stop for independent Game Director review after these documents are delivered.

## Final scope verification

Final `git status --short` contains only `?? docs/BASELINE_AUDIT.md` and `?? docs/COMPLIANCE_MATRIX.md`; tracked/cached diffs are empty, HEAD and stash list unchanged. Documentation validation checked seven columns/status values for all 129 matrix rows, all S0–S8/D1–D15/R1/R2/C1–C9 entries, local file references and trailing whitespace. The local preview was stopped after smoke testing; no server was deployed. Temporary probes and test output were kept outside the repository.
