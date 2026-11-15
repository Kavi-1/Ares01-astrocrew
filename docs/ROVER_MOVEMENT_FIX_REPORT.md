# ARES-01 rover movement repair

## Result and root cause

The reported Sol 2 / 30, full-battery, zero-distance state is reproducible: `endSol` deliberately starts the next sol in `planning`, while live traversal requires `operations`. GAMEPLAY.md requires plan, then drive. The interface hid the commit action inside collapsible, scrollable details and did not explain this driving gate. This repair exposes the plan requirement and a persistent, explicit Commit sol plan action. It never commits or changes an allocation automatically.

Two additional movement defects were repaired: the terrain probe always looked along the rover's nose, so it could reject reversing away from a steep approach; and velocity, wheels and telemetry could continue reporting requested movement after the terrain or energy solver rejected it. The canonical campaign safe-mode flag now also governs live movement and science, so a stale duplicate legacy record cannot disable an otherwise valid restored mission.

This reproduces the supplied symptom in the available source. The original affected browser save and screenshot were not available for a separate save-specific diagnosis.

## Changes

- Persistent Driving status explains planning, pause, route decisions, damage, safe recovery, zero/used drive allocation, sol time, obstacles, slopes and mapped boundaries. A low-energy advisory defers each segment to the existing energy solver.
- Commit, draft drive/science hours, failed-commit feedback and End Sol stay outside collapsible details. Sol changes recreate the draft from the authoritative plan. The planner scrolls while these actions stay visible. Tutorial notes reserve a separate lane beside or above the entire console across mobile and desktop resizing, so the driving reason and plan controls stay readable.
- Both WASD physical keys and arrow keys drive. Text/number/select fields, Help and modal dialogs keep native input. Focusing a form clears held rover keys. An explicit Return to driving action and focusable, labeled canvas restore driving focus.
- Keys clear at sol, plan, pause and dialog boundaries. OS key repeats whose original press was cleared cannot start movement in the new state.
- Braking suppresses throttle and reaches a true stationary state. Velocity resets across phase/sol/plan boundaries.
- Slope sampling follows the proposed signed travel direction. Obstacle, boundary and slope checks remain effective; reversing or steering away remains possible.
- Rover position, wheel rotation, dust and speed telemetry use accepted travel. Rejected attempts do not spend drive energy or animate travel. A partial reserve stop moves only the accepted fraction.

## Scientific and gameplay preservation

Three.js, seeded terrain, mission duration, objectives, loss and safety rules remain in place. `src/engine/campaign.ts`, `src/engine/energy.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `docs/GAMEPLAY.md` and `docs/NASA_ENGINEERING.md` are byte-identical to the supplied tutorial-update baseline. No NASA values or gameplay assumptions were introduced. Fixed 20%, 30% and 40% reserves remain thresholds; charging and consumption are still computed by the original solver.

At or below a reserve, a generation-supported downhill segment is evaluated by `traverse`, rather than disabled by a new terrain-blind battery gate. Canonical safe mode still prohibits optional work. The actual segment energy ledger remains authoritative and independent of render-frame partitioning.

## Verification

Production TypeScript/Vite build passed. Existing node suites passed: engineering; preparation (72 proposal scenarios and 36 station paths, hydration/migration); mission budget (1,239 cases); model loading (20 cases); battery (20 cases); campaign (688 full-duration/scenario/ranking checks plus 272 boundaries); tutorial (138 checks).

New `node scripts/test-mobility.mjs` passed 17,114 checks: three sites, six objective rankings, both mission durations (900 sols), driving before/after science, plan/recommit boundaries, save/load equivalence, fixed reserve stops and recovery, generation-supported downhill restoration, damage/hazard/allocation restrictions and energy partition equivalence at 10/30/60/144 segments. This verifies energy against accepted distance, not identical real-world input timing at every frame rate.

Three new Playwright mobility cases passed after targeted reruns:

| Case | Verified behavior | Result |
| --- | --- | --- |
| Native input and progression | WASD, all arrows, held-throttle braking, post-observation driving, Help and Return focus, pause/resume, fresh keys, Sol 2–3, identical pose/campaign after reload and resumed driving | Passed, 7.6 min |
| Restrictions and reserves | Zero/used allocation, sol exhaustion, safe recovery, damage, E1, stale duplicate safe flag, real 20%/30%/40% reserve stops and final-sol report input ownership | Passed, 5.4 min |
| Terrain | Authored barrier without penetration, reverse escape, forward steep-slope restriction and a legal reverse escape | Passed, 2.7 min |

Native planner field and Commit visibility passed at 390×844 and 640×600 with tutorial guidance open. Seven mobility screenshots and the corrected desktop coach screenshot are included in the verification archive. Test environment: Node 24.22.1, pnpm 11.25.0, Chromium 156.0.8078.79 on Debian Linux with SwiftShader.

The tests exposed two UI defects in the initial implementation: the short-height planner could collapse its editor, and the Return action could unmount when focused. Both were corrected before the passing input flow. The existing tutorial suite also exposed desktop coach overlap after resizing; safe-lane placement and observer cleanup were corrected, and the same strict three-width assertion then passed in the full guided flow. The first terrain fixture had an illegal instantaneous reverse grade above 30° despite its legal two-metre average; the unchanged traverse rules correctly rejected it. The corrected synthetic fixture tests a legal reverse route. The test save fixture also now seeds storage before hydration, avoiding an overwrite by the outgoing live page. Earlier diagnostic logs are distinguished from the final passing cases.

The 28 runnable existing browser cases passed: six mission flows, four tutorial cases, four model/control cases and fourteen presentation cases. This includes all three native 30-sol sites, all six rankings, the accepted-budget 20-sol variant, launch retry, G/B scans, save/resume, exactly-once billing, Help, abort/reset and report behavior. The failed desktop-overlap tutorial case was rerun in full after the layout correction; the strict assertion was unchanged. All production and development test servers were closed afterward.

Five original-asset cases were explicitly blocked and excluded: two original rover/crew rig or workshop-readiness cases and three original-model welcome presentation cases. They require the unavailable GLBs and are not counted among the 28 passes. Their exact names and commands are recorded in `rover-regression-summary.json` inside the verification archive.

Final result: 31 unique browser cases passed across the new mobility tests and runnable existing regressions, with no unresolved tested failure. Earlier diagnostic failures remain labeled as superseded in the evidence. The final production build passed; its only warning was the existing large JavaScript chunk warning.

## Remaining limits

Original rover/crew GLB assets are absent from the available source bundle. Production movement is tested with the existing Three.js procedural fallback. Original imported-model rig appearance and its model-ready browser cases cannot be claimed as passed. Keep the original project's model assets when applying this update.

No deployment was performed. No new scientific assumption approval is needed for these changes.

## Run and apply

Apply the patch to the immediately preceding tutorial-update project or overlay the ZIP's source/configuration files while preserving original assets. Install dependencies, then run `pnpm test:mobility`, the existing node suites, `pnpm build`, and `CHROMIUM_PATH=/path/to/chromium pnpm exec playwright test --config playwright.mobility.config.ts`. The source ZIP excludes dependencies, build output and unchanged historical screenshot galleries. Current verification screenshots are in the separate verification ZIP. Existing saves use the same schema and retain their committed campaign state; a planning save still requires an explicit valid commit.
