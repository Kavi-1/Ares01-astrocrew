# Implementation readiness — Tasks 002 and 003 boundary

Date: 2026-11-14. Repository: `main`, `c7b88d752ce7594674ee0e6c38bf636732cb6195` (Remove dust event (E3) from gameplay doc). This investigation supplements, and does not rewrite, `BASELINE_AUDIT.md` or `COMPLIANCE_MATRIX.md`. Source, tests, assets, GAMEPLAY, Git history and stashes were not changed. Both excluded design-reference directories were ignored. Task 003 measurements and its separate first implementation proposal are in `PERFORMANCE_AUDIT.md`.

**Readiness conclusion:** 30° terrain limits, fixed budget values, one launch retry, deterministic outcomes and the score category weights are already specified. They do not need another design vote. Data retention, several failure semantics, scoring edge cases and missing scenario/engineering tables do need decisions before their dependent gameplay can be implemented. An isolated cost evaluator and the separately proposed loading work can proceed after authorization without resolving all those questions.

Line references below refer to this checkout. “Proposed” means a recommendation for review, not an adopted rule. NASA evidence documents the spacecraft; it cannot supply rules for fictional launch options, scoring or scenario balance.

## 1. Authority and conflict investigation

### 1.1 Terrain: 30° is the implementation requirement

- `GAMEPLAY.md:122`, §4: “30 degree slope and 0.40 m obstacle limits”. `:173`, E1: “a slope above 30 degrees or obstacles above 0.40 m”; “the rover stops at the limit and E1 opens; it never crosses on its own”. These explicitly establish the gameplay threshold and the stop/choice sequence. The exact boundary is above, not at, 30°/0.40 m.
- `src/nasa/data.ts:22`: `slopeLimitDeg:24`. `MarsWorld.tsx:529–534` tests that value, emits a 24-degree warning and blocks movement; obstacle collision uses horizontal radii, not measured 0.40 m obstacle height. `scripts/test-engine.mjs` asserts the 24° rule. Those are incompatible implementations, not authority to amend GAMEPLAY.
- `NASA_ENGINEERING.md:223`, C9 explicitly records “The code uses 24°” versus the 30° gameplay limit. Its mobility data at `:133–135`, EQ8 range at `:418`, assumption/example discussion at `:524`, V09 at `:573` and T22 at `:617` retain 30°/0.40 m. `STATUS.md:15,32,60` and `VISUALS.md:91` repeat the open-decision language. `BASELINE_AUDIT.md` §9 item 1 and matrix E07/SF05 inherited that framing; it overstates the remaining decision under the user's hierarchy.
- The official [NASA rover components page](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) describes avoiding slopes beyond 30° and a different 45° static tipping capability. A [NASA driving update, 2026-10-21](https://science.nasa.gov/blog/tracks-along-the-longest-drive-on-another-world/) says the team “raised the rover’s tilt limit to 24 degrees”. Operational planning limits and physical capability are distinct contexts; the newer article does not silently amend this game's specification.
- **Resolution:** implement 30° and 0.40 m when terrain work is authorized; retain the operational 24° fact as contextual provenance. No owner choice is needed to select the threshold. Owner/science input is still needed for terrain datasets, measurement/probe conventions, reroute routes and deterministic damage (U3/U6). Changing GAMEPLAY to 24° would require explicit approval and a separate specification change.

### 1.2 Data: deliberate loss and temporary outage are not fully reconciled

Exact rules:

| Reference | Exact wording |
| --- | --- |
| GAMEPLAY §4, :121 | “Excess data is dropped; those observations score zero” |
| GAMEPLAY §3 O1, :103 | “all data waits a sol” |
| GAMEPLAY §6 E2, :174 | “Capacity for that sol = rate times remaining pass time; the rest waits in storage.” |
| GAMEPLAY §7 Comms order, :250 | “The chosen data returns; the rest waits”; refusal: “The excess data is dropped (section 4)” |
| GAMEPLAY §7 Comms story, :232 | “No data was dropped” |

The scope qualifiers matter: §4 describes a failed design check that was overridden; E2 describes a scheduled outage; the order table describes obey/refuse consequences. **Recommended interpretation for approval:** queue data for a normal E2 outage and for obeyed prioritization; drop the excess specifically for the accepted over-capacity risk/refused warned order. Preserve zero scientific credit for observations actually dropped. This accommodates the text but does not define a complete algorithm by itself.

Unspecified: effective science buffer size; unit and identity of a stored observation; partial transmission versus all-or-nothing observation; deterministic queue/tie-break; when a risk-related drop occurs relative to an E2 outage; buffer overflow; whether data can wait beyond the final sol. These affect both scoring and Comms story results, so **U1 blocks the data ledger, E2, related bots and scoring**.

Conflicting implementation/documents: `src/nasa/engineering.ts:20–21,32–33` only estimates aggregate selected-instrument data and nominal links; `src/store/gameStore.ts:31` transfers all scanned IDs without capacity or queue; `src/engine/missionFailure.ts:44–51,65–75` treats backlog as a recoverable anomaly and permits partial success for scans without returns. `NASA_ENGINEERING.md:147–148,539` lists 2 GB flash / 256 MB DRAM and a storage chain; neither establishes that all flash is available as a game science buffer. V08 (`:572`) is only a warning. The obsolete agency path's numeric storage is not a scientific queue contract. No value should be copied from it to resolve U1.

### 1.3 Engineering input inventory: known, assumed and genuinely absent

`GAMEPLAY.md:338`: “Margin thresholds, vehicle capacity and cost, mission budget per scenario and the cost of every instrument and of operations, landing capability, relay pass times and data rates for each relay orbit (D15), relay orbiter masses, energy per metre”. `:339`: “Terrain and hazard data per site, objective completion criteria”. These are explicit handoffs, not permission to fabricate NASA measurements.

| Area | Established inputs and conflicting definitions | Still needed; recommendation; implementation impact |
| --- | --- | --- |
| Vehicles | §3 D7 `:83`: “3 vehicles”; capacity “must cover the rover plus any relay orbiter”. §4 `:117`: capacity to Mars, documented or placeholder. Costs `:142`: 120/180/245 USD million, ASSUMED. Active `data.ts:22` uses `allowanceKg:1025`; legacy `src/data/vehicles.ts:3–5` uses payload 150/300/500 and costs 30/60/110 with reliabilities .90/.93/.96. | U2: supply three effective capacities to Mars and provenance. Do not add cruise/EDL mass to the specified rover-plus-relay expression. If the real capacity is quoted for a full transfer stack, document its conversion to an effective allowance. 1,025 kg is flown rover mass, not a launch vehicle or sky-crane capability. Blocks D7/launch/Systems bot. |
| Budget | §4 `:134–147` and “Decided” `:343` explicitly establish budget 2,700; platform 1,855; ops 300; instrument costs 55/50/50/45/40/30/30; vehicle 120/180/245; relay 0/80/140. Fixed 2,155 and flexible 545 follow arithmetically. Legacy funding/costs are incompatible. | No missing numeric decision for the baseline budget. “starting proposal”/member-2 confirmation text asks for balance/provenance validation; it does not authorize replacing the decided figures. Retain the instrument/vehicle/relay ASSUMED tags and label platform CALCULATED **from mixed documented and assumed inputs**. Scenario budgets beyond baseline require U2. |
| Landing | §4 `:118`: “Mass and site hazard versus landing capability”; “Hard landing: one subsystem lost”. §5 `:154`: stationary science if no mobility. Legacy `src/data/sites.ts:3–5` has `edlSafety` modifiers; `LaunchCenter.tsx:16` always announces touchdown. | U3: approved units, landing limit/equation, site hazard values, and deterministic single-subsystem mapping/tie-break. A percentage or random EDL chance would violate §1/§4. Blocks S6/R2. |
| Windows / terrain | D2 `:78` three sites; D8 `:84` three windows affecting season and lighting; E1/E2 always scheduled (`:169–177`). Current site data mixes obsolete solar and safety bonuses; MarsWorld has one procedural height field and fixed targets. | U2/U6: site/window IDs, lighting/season effects, terrain and event schedules, safe alternate route distance. No dust-storm gameplay event: this HEAD removed E3; `VISUALS.md:105` is stale optional visual planning, not authorization to restore it. |
| Energy | Peak 900 W (`:119`); reserve 20/30/40% (D5). NASA_ENGINEERING EQ3–EQ5 `:300–337`, EQ7 `:361–372`: power×time, RTG fit, battery efficiency and terrain force. `:495–509`: baseline 75 W, 28 V, .9 round-trip, drive efficiency .5, rolling coefficient .15, activity durations are stated assumptions. `:507`: antenna power **included in P_base**; `:508`: engineering cameras included there too. | Not all energy numbers are absent. U4 must define a sol activity/concurrency schedule, one accounting boundary for baseline/science/drive/transmit, initial battery/RTG age and safe-mode loads/counters. A separate radio wattage must not be added on top of baseline without revising that accounting assumption. No invented NASA radio power required to implement the stated baseline. |
| Energy code mismatch | `engineering.ts:19` uses baseline + largest instrument, whereas EQ3 sums concurrent loads; `:34` projects SoC without charge/discharge efficiency. `MarsWorld.tsx:557–599` charges routine activity plus scans, uses flat slope and 1,025 kg for drive, literal 2,408 Wh and render-derived time. | U4 fixes schedule semantics before replacing either expression. Preserve physics formulas; feed correct activities/mass/slope and remove double counting only after tests define expected ledger. Downhill negative drive work must not silently become regenerative charging. |
| Relays / direct link | O1 `:103`: ~960 Mbit, one ~8-minute pass, no added mass; O2 `:104`: 3 passes/~2,880 Mbit, cost 80; O3 `:105`: continuous/~1,800 Mbit, cost 140/heaviest; E2 O3 half returns. `:107`: “relay orbiter masses are placeholders”. Current UHF2 Mbps×480s=960; X-band 500 bps×whole sol≈44.39 Mbit is explicitly an assumed continuous contact (`engineering.ts:21,33`). | U5: masses, pass lengths/rates/distribution, O3 effective rate/outage schedule, direct-link contact time and energy boundary. O2 1,920 Mbit after loss is valid **if three equal passes are approved**; the total and pass count alone do not prove equality. Do not use a real satellite launch mass as a fictional option without approval. |
| Instruments / science | NASA_ENGINEERING `:157–163` contains mixed per-experiment/per-day/raw volumes; MEDA 11 MB lacks period, RIMFAX5–10 kB per sounding lacks sounding cadence. Seven masses sum 51.835 kg; `:179` notes a 59 kg payload-total mismatch. Active `src/nasa/data.ts:13–19` omits MEDA/RIMFAX data and sums remaining 259.2 Mbit. §3 `:109`: “a full instrument load produces more data than O1 can send”. | U6: normalize observation durations, per-sol cadence, compression/raw semantics, missing data intervals and complete objective/instrument compatibility; supply D12 sample energy/value. Do not rescale NASA facts until a documented educational schedule explains >960 Mbit. The [JPL launch quick facts](https://www.jpl.nasa.gov/news/press_kits/mars_2020/launch/quick_facts/) lists 59 kg for the seven-instrument payload as well as the 1,025 kg rover; the local “secondary source” description is incomplete. This does not identify how to distribute the 7.165 kg difference. |
| Inherited validation | §4 `:113` “reuse the Milestone 4 validation rules”. NASA_ENGINEERING V01–V14 `:565–578` includes mount conflicts, MOXIE ≥300 Wh at start, installed-instrument rules, torque display and provenance. Its gate `:580` requires V01–V04/V06 to pass, and V09 blocks terrain. `:555` suggests a random sand trap. | Authority resolves strict gate versus explicit override/crossing in favor of GAMEPLAY. Random sand traps are disallowed. U6 must distinguish engineering co-location/concurrency rules from literal exclusive mounting: the specified all-seven real rover must remain feasible. Add explicit cross-references/tests for inherited validations; do not adopt optional extensions as new gameplay. |

The [JPL cost facts](https://www.jpl.nasa.gov/news/press_kits/mars_2020/launch/quick_facts/) support approximate mission totals, not individually measured game component costs or exact accounting to the dollar. This is a provenance correction, not a recommendation to change the stated game budget.

### 1.4 Deterministic failure and recovery

| Exact requirement / reference | Conflict or omission | Specification-preserving recommendation |
| --- | --- | --- |
| §4 `:127`: “Without an override, no failure can occur”; `:128`: “Nothing is random.” | Later E1 crossing/E4/unsafe sol choices do not define how risk acceptance is recorded. Current warnings permit unrecorded risks; manual Abort/End mission can terminate early. §2 `:71` says rover loss “is the only case where play stops early”. | U7: record the relevant explicit surface choice as risk acceptance and causal evidence; decide whether manual early exit is save/abandon or a scored mission ending. Do not silently keep a new abort outcome. |
| §4 `:120`: “Safe mode on the first sol with a deficit; 3 in a row loses the rover”. §5 `:155`: “energy at zero for 3 sols”. E4 `:175`: “accepting safe mode skips the next sol”. | Deficit, crossing reserve and zero battery are three different predicates. Counter timing, reset, recovery and skipped-sol energy treatment are undefined. Code ends immediately at zero (`MarsGame.tsx:80`, `missionFailure.ts:69`) and has manual toggling. | U4: keep deficit as safe-mode trigger; propose the explicit §2/§5 zero-energy predicate for loss, with a separately named deficit counter if needed. Owner must reconcile §4 wording, define end/start-of-sol checks and skipped-sol energy, before implementation. |
| §5 `:159`: “One retry per run”; `:161`: “the retry always ends in a launch”; `:162`: “All other checks are re-evaluated”. | Launch mass is currently the only specified launch-stage failure, so locking that cause is sufficient with present rules. An invented new launch-stage failure would undermine the promise. | Implement only the specified mass failure/locked cause; recompute other phase risks on retry. No extra retry, probability or new launch checks. U3/U7 only for simultaneous consequences and explicit risk records, not the retry count. |
| §4 `:119`: “that instrument goes offline”; `:118`: “one subsystem lost”; E1 `:173`: “crossing risks mobility damage”. | Which instrument causes a simultaneous overload, which landing subsystem is lost, damage severity and simultaneous-order precedence absent. “Risks” does not allow rolling dice under §1. | U3/U4/U7: approve deterministic mappings and precedence. Propagate disabled capability through planning, scans, drive and report, not just appearance. |
| §5 `:165`: “if any failure above occurred, the headline is **MISSION FAILED**”; §9 `:328`: recovery tier separate. | §5 enumerates launch, landing and rover loss; it does not explicitly promote every brownout, terrain damage or missed pass to that headline. Current code introduces recoverable-anomaly/abort and scanned-only success. | Preserve §5 headline scope. U7 must confirm presentation for damage outside §5; do not assume every event means FAILED. Returned data, not scans, determines tier. |

### 1.5 Scoring

Established verbatim: §9 `:316` “Total 100 points”; `:320` “full 30, baseline 20, minimum 10, none 0”; `:321` “Sum over objectives of (rank weight times fraction completed with data returned) times 30”; D3 `:79` weights 0.5/0.3/0.2. `:322`: “full points at 70 to 95 percent use, partial below 70, none when margin is under 5 percent”; budget “full points at or under 95 percent of the budget, partial up to 100 percent, none when over budget”. `:323` specifies three points at each of D4/D5/D6/D9/D11 with respected margins **and** review; blind accept, including Accept team plan, gets none. `:324`: “Share of relevant hints and received orders that were read and acted on, times 10”. `:326`: full all three, baseline top-ranked two, minimum at least one returned.

**U8 blocks a complete scoring oracle:** partial-credit curves below 70% and budget 95–100%; denominators for mass/energy/data utilization and temporal aggregation; rounding; objective completion/returned fraction and the minimum data needed to count toward tier (U6/U1); repeated D11 aggregation into its single flag; hint/order relevance, deduplication and zero-denominator behavior. The exact 95% boundary receives full credit; no rule authorizes an arbitrary linear curve. Proposal for review: explicit piecewise curves and units; one ledger record per meaningful hint/order; a documented zero-opportunity policy preserving all-seat 100-point reachability. Do not adopt numerical formulas before approval.

`missionFailure.ts:65–98`, `scienceTargets.ts:19,24,29` and `MissionReport.tsx` implement different categorical outcomes and fixed 25/32/30 RP (87 total), not the specified score. Existing passing tests for scanned-but-unreturned partial success contradict §9. `NASA_ENGINEERING.md:25` correctly treats scoring as game design, not NASA data. No NASA source can settle U8.

### 1.6 Other findings that affect readiness

- Systems rule `GAMEPLAY.md:209`: “mass margin at 10 percent or more”. The example line at the same row mentions 8%; `:213` identifies the third-column rules as design intent; the contradictory dialogue is in the fourth column. The example cannot replace the normative threshold. `preparation.ts:61–74` currently downgrades 10% to a preference and falls back. Even removing all instrument mass from the current 1,025 kg allowance produces only~5.06% margin. **U9** is an infeasible-proposal/vehicle-table policy decision, not permission to lower 10%. Recommend no-safe-proposal and an owner request to change the vehicle; verify every seat can still earn 100 with approved capacities.
- Save: `GAMEPLAY.md:31` says “resumes exactly where they stopped”, and `:332` says “Autosave at the start of every stage”. Stage checkpoints are a minimum, not evidence that losing five seconds of movement complies. **U10** asks the owner to define acceptance granularity for mid-drive, mid-scan and cinematic resume; recommend persisting the authoritative state and tutorial first-use preference separately from campaign reset. `gameStore.ts` version 6 skips development hydration; production persistence is the acceptance target.
- Formats/creative delivery: `GAMEPLAY.md:351` asks for six VRM crew and idle/talk/gesture animations. All six supplied character GLBs lack VRM extensions and animation clips; procedural posing does exist. Do not claim GLB/VRM equivalence from extension alone. **U11**: approve a compliant VRM delivery or explicit format exception, and narrative/voice content. Existing identities/appearance must be preserved. This does not block an isolated cost evaluator or measurements.

## 2. Unresolved-decision table

Only the following items require owner/data-owner decisions. Recommendations above are not silently applied. Datasets may be supplied as clearly tagged, approved assumptions where GAMEPLAY permits placeholders.

| ID | Decision required | Owner / impact |
| --- | --- | --- |
| U1 | Approve drop-versus-queue precedence, buffer policy, observation granularity and final-sol backlog handling. | Director + Engineering; blocks data ledger, E2, Comms outcomes and science score. |
| U2 | Supply three vehicle capacities, three windows/site effects and any non-baseline scenario budgets. | Engineering + Science, Director approval; blocks D7/D8 and launch/bot feasibility. |
| U3 | Supply landing equation/hazards and deterministic damage selection, severity and precedence. | Engineering + Science, Director approval; blocks S6/R2 and terrain-damage consequences. |
| U4 | Reconcile deficit versus three zero-energy sols; define safe-mode timing, activity/concurrency and energy accounting inputs. | Engineering + Director; blocks sol simulation, E4 and brownouts. |
| U5 | Supply relay masses/pass profiles and direct-link contact assumptions. | Engineering, Director approval; blocks D15, launch mass and E2 capacity. |
| U6 | Supply objective completion/instrument tables, normalized data schedules, site/event routes and sampling costs. | Science + Engineering, Director approval; blocks D2/D3/D12, E1/E2 and weighted science. |
| U7 | Define runtime risk acceptance, manual early exit and non-§5 damage reporting/precedence. | Director; blocks complete failure/cause-chain contract. |
| U8 | Define partial-score curves, utilization aggregation, repeated-review and hint denominator/rounding rules. | Director; blocks exact 100-point scoring tests. |
| U9 | Confirm no-safe-proposal behavior when the mandatory 10% Systems margin is infeasible. | Director + Engineering; blocks complete Systems bot, not the 10% threshold itself. |
| U10 | Define exact-resume acceptance granularity and first-use tutorial preference lifetime. | Director; blocks comprehensive save/onboarding acceptance. |
| U11 | Resolve VRM delivery versus format exception and approve missing narrative/voice content. | Director + Art/Narrative; blocks those handoffs, not pure engineering or loading work. |

**Already settled, no new owner decision:** 30°/0.40 m; stated baseline cost table and 2,700 total; one retry; deterministic/non-random outcomes; 30/20-sol duration; score category totals/weights; Guided/Skip and Quick/Explore must preserve rules. Required decisions are U1–U11 within their listed scope, not a blanket stop on independent work.

## 3. Review of all 129 matrix rows

Method: read GAMEPLAY in full; cross-check every existing row against current source, test assertions, baseline evidence and the new isolated hotspot result. No matrix row is promoted to completed gameplay because related code exists. Prior Task 001 test results remain attributed to that run; no claim that the full suite was rerun here. The file itself is intentionally unchanged.

Recommended classification corrections: **A05 PARTIAL→MISSING** for the actual skip/speed/subtitle requirement (ordinary stage advance is not a skip system); **SV03 MISSING→PARTIAL** because a limited saved check-results snapshot exists; **CR09 PARTIAL→INCORRECT** because a mandatory 10% proposal rule is explicitly weakened to a preference, in addition to missing vehicle support. On the same 129 rows this would yield 1 VERIFIED, 47 PARTIAL, 18 INCORRECT, 61 MISSING, 2 BLOCKED. These are compound-row counts, not completion percentages. No row is demonstrated fully implemented but merely awaiting a test; leaving that category unused is acceptable.

Coverage corrections without inventing new rules:

1. Add explicit subrequirements for Quick's **prefilled designs and preselected bot plan** (`GAMEPLAY:93`) under A06/D13/CR12, and “player is not asked every time” (`:343`) under D14/TU02. Existing broad rows do not make those behaviors separately reviewable.
2. Add explicit inherited validation links for mount/concurrency compatibility, MOXIE start energy, torque display and per-value provenance under E01/HD01/A03; resolve conflicts through §4 authority, not by copying every NASA_ENGINEERING suggestion. Add an explicit report assertion for “no random failures” under E08/F02.
3. Keep CR01 VERIFIED only for the six named roster/seat mapping; neither six complete bots nor all-seat 100-point attainability was tested. Narrow F01's required **voiced** response to launch failure (`:153`); other failures require immediate cause disclosure but no universal voice requirement is stated.
4. Remove E02's implied extra “transfer stack” mass requirement. GAMEPLAY explicitly says rover plus relay; capacity conversion is an engineering provenance issue. Do not treat fixed cost figures as missing owner decisions. For O2 do not assert equal lost-pass volume without a stated equal-pass assumption.
5. CR03's once-per-priority proposal behavior must coexist with “nothing is locked”; do not impose a permanent ban on revising after changing a design. HD06 must not invent a requirement for **authored** clips where the text only requests the animations. HD08 describes already-present design documentation; runtime compliance is assessed by its linked rows, not by claiming the document is missing.
6. There are no duplicate IDs. There are deliberate overlapping obligations: S3/D4/CR09; A06/D13; E06/O1/SF06; E07/SF05; A09/SF01–03; R1d/F02/SC06; A07/TU06 and HD handoffs. Preserve traceability, use one acceptance assertion per behavior, and avoid counting the overlaps as independent delivered systems. “About 4–6” driven sols is a pacing target, not an invented fixed exact count.

Evidence codes in the row-by-row ledger: **S** current source/spec inspection only; **T1** relevant subfeature exercised in Task 001 (not whole-row verification); **T2** isolated connected-workshop test passed in this task; **H** human/full-system verification blocked. Files are repeated explicitly so the ledger can be read without expanding the previous matrix's aliases.

| ID | Original → reviewed status | Evidence | Files inspected / row finding |
| --- | --- | --- | --- |
| A01 | PARTIAL → PARTIAL | S + T1 | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/ui/crew/PreparationHub.tsx`, `src/game/MarsWorld.tsx`; `src/models/roverModel.ts`. Active configuration fixes MMRTG/body and offers all seven; EDL/cruise not modeled. Legacy solar design remains in G |
| A02 | INCORRECT → INCORRECT | S + T1 | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/engine/preparation.ts`, `src/game/LaunchCenter.tsx`, `src/game/MarsWorld.tsx`, `src/engine/missionFailure.ts`. Equations and proposals deterministic; launch/landing unconditional; outcome ignores missing checks |
| A03 | PARTIAL → PARTIAL | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/ui/crew/PreparationHub.tsx`, `src/engine/missionFailure.ts`; `docs/NASA_ENGINEERING.md`. Source list and explanatory labels exist; Instrument/FIXED values lack per-value status/source fields; generic badge does not identify each threshold |
| A04 | INCORRECT → INCORRECT | S | `src/game/MarsWorld.tsx`:506,557–569,659; `src/game/MarsGame.tsx`. Surface sol advances from render elapsed time, including pauses; active idle consumes/produces energy |
| A05 | PARTIAL → MISSING | S | `src/game/LaunchCenter.tsx`, `src/ui/crew/CrewRoom.tsx`, `src/models/characterModel.ts`, `src/models/crewAnimation.ts`. Correction: stage-advance controls do not implement cinematic skip/speed or subtitle advance. |
| A06 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`, `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`. Also track prefilled Quick defaults and preselected team proposals explicitly. |
| A07 | BLOCKED → BLOCKED | S + H | `src/ui/crew/PreparationHub.tsx`, `src/game/LaunchCenter.tsx`, `src/game/MarsWorld.tsx`. No Quick/Explore or complete 30-sol run; no first-time playtest evidence |
| S0 | PARTIAL → PARTIAL | S + T1 | `src/game/MarsGame.tsx`, `src/store/gameStore.ts`. Existing welcome enters crew selection; no Guided/Skip or required welcome copy |
| S1 | PARTIAL → PARTIAL | S + T1 | `src/ui/crew/PreparationHub.tsx`, `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/store/gameStore.ts`. Six selectable named seats persist; no D13 and only three decision domains owned |
| S2 | PARTIAL → PARTIAL | S + T1 | `src/ui/crew/PreparationHub.tsx`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`; legacy `src/data/sites.ts`. Briefing exists for fixed Jezero targets; no site or ranking selection |
| S3 | PARTIAL → PARTIAL | S + T1 + T2 | `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/store/gameStore.ts`. Workshop draft/apply/control flow tested; complete engineering/budget remains absent. New isolated workshop PASS. |
| S4 | PARTIAL → PARTIAL | S + T1 | `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`. Readiness screen blocks hard issues, warns on energy/data; no required choices/overrides |
| S5 | INCORRECT → INCORRECT | S + T1 | `src/game/LaunchCenter.tsx`, `src/store/gameStore.ts`. Multiple confirmation buttons drive scripted success; no result or adviser reactions |
| S6 | INCORRECT → INCORRECT | S + T1 | `src/game/LaunchCenter.tsx`, `src/store/gameStore.ts`. Text announces touchdown; no landing calculation or separate state |
| S7 | PARTIAL → PARTIAL | S + T1 | `src/game/MarsGame.tsx`, `src/game/MarsWorld.tsx`, `src/store/marsStore.ts`, `src/store/gameStore.ts`, `src/engine/missionFailure.ts`. Live driving, scans, basic events and position save exist; plans and scheduled events absent |
| S8 | PARTIAL → PARTIAL | S + T1 | `src/game/MissionReport.tsx`, `src/store/gameStore.ts`. Report/reset exist; no export, finalScore or prescribed tier/headline |
| R1 | MISSING → MISSING | S | `src/game/LaunchCenter.tsx`, `src/store/gameStore.ts`, `src/engine/missionFailure.ts`. No launch failure, attempt counter, redesign route |
| R1b | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`. No failure snapshot or retry-specific proposals |
| R1c | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/ui/crew/PreparationHub.tsx`. No override locks or accepted-risk list |
| R1d | MISSING → MISSING | S | `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`. No failure history or recovery tier |
| R2 | MISSING → MISSING | S | `src/game/LaunchCenter.tsx`, `src/game/MarsWorld.tsx`, `src/store/gameStore.ts`, `src/engine/missionFailure.ts`. No damage state or subsystem disablement |
| A08 | INCORRECT → INCORRECT | S | `src/game/MarsGame.tsx`:80, `src/engine/missionFailure.ts`, `src/game/MarsWorld.tsx`. First battery zero ends immediately; End mission/Abort also exposed |
| A09 | INCORRECT → INCORRECT | S | `src/game/MarsWorld.tsx`, `src/game/MarsGame.tsx`, `src/store/gameStore.ts`. Unlimited 90-second sols; three static targets; no plan/end-sol/skip/20-or-30 cap |
| D1 | PARTIAL → PARTIAL | S + T1 | `src/ui/crew/PreparationHub.tsx`, `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/store/gameStore.ts`, `src/engine/preparation.ts`. All six selectable; only payload/power/communications have proposals |
| D2 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`. Fixed Jezero |
| D3 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`, `src/engine/missionFailure.ts`. No ordered objectives/weights |
| D4 | PARTIAL → PARTIAL | S + T1 + T2 | `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`. Seven choices/draft/apply tested; actual objective/cost consequences incomplete. New isolated workshop PASS. |
| D5 | PARTIAL → PARTIAL | S + T1 + T2 | `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/game/MarsWorld.tsx`. Choices and proposal work; reserve alert after depletion, no planning reserve check |
| D6 | PARTIAL → PARTIAL | S + T1 | `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/store/gameStore.ts`. UHF/X-band choice; link estimate; uplink ignores actual capacity |
| D7 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/nasa/data.ts`, `src/nasa/engineering.ts`; legacy `src/data/vehicles.ts`. Active launch uses 1,025 kg allowance; unused vehicles 150/300/500 kg, costs 30/60/110 |
| D8 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/game/LaunchCenter.tsx`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`. No window setting or season model |
| D9 | INCORRECT → INCORRECT | S + T1 | `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`. Hard issues unoverrideable; energy/data can launch with warnings without explicit risk |
| D10 | PARTIAL → PARTIAL | S | `src/engine/missionFailure.ts`, `src/game/MarsGame.tsx`. Recovery buttons exist; no specified choices/team review |
| D11 | MISSING → MISSING | S | `src/game/MarsWorld.tsx`, `src/game/MarsGame.tsx`, `src/store/gameStore.ts`. No allocation; automatic background loads; no drive-energy pool |
| D12 | MISSING → MISSING | S | `src/data/scienceTargets.ts`, `src/game/terrain.ts`, `src/game/MarsGame.tsx`. Generic scans are not this choice |
| D13 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`. No setting |
| D14 | MISSING → MISSING | S | `src/game/MarsGame.tsx`, `src/store/gameStore.ts`. Also track first-use preference and no repeated mode question, GAMEPLAY:343. U10. |
| D15 | MISSING → MISSING | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`. Only UHF strategy, no orbit/mass/cost |
| O1 | PARTIAL → PARTIAL | S + T1 | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/store/gameStore.ts`, `src/engine/missionFailure.ts`. 2 Mbps×480 s=960 Mbit exists; no orbit identity, pass calendar or E2 storage |
| O2 | MISSING → MISSING | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/store/gameStore.ts`. Three passes/2,880 total specified; equal pass volume after outage is still an assumption. U5. |
| O3 | MISSING → MISSING | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/store/gameStore.ts`. No areostationary option/calculation |
| O4 | INCORRECT → INCORRECT | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/ui/crew/PreparationHub.tsx`. Full selected data proxy is 259.2 Mbit, below 960; MEDA/RIMFAX omitted, no cadence scaling |
| E01 | PARTIAL → PARTIAL | S + T1 | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/ui/crew/PreparationHub.tsx`. Pure mass/battery/RTG/Wh/link equations implemented; missing full launch/landing/budget/terrain checks |
| E02 | INCORRECT → INCORRECT | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/game/LaunchCenter.tsx`. Wrong fixed allowance; remove suggested extra transfer-stack mass from this requirement. U2/U5. |
| E03 | MISSING → MISSING | S | `src/game/LaunchCenter.tsx`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/engine/missionFailure.ts`. No landing evaluator |
| E04 | PARTIAL → PARTIAL | S + T1 | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/game/MarsWorld.tsx`, `src/store/gameStore.ts`. 900 W hard check exists, peak = baseline + largest active instrument; no override/brownout |
| E05 | INCORRECT → INCORRECT | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/game/MarsWorld.tsx`, `src/game/MarsGame.tsx`. Net Wh warning launches freely; manual safe mode; immediate zero failure; scans add costs atop schedule |
| E06 | INCORRECT → INCORRECT | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/store/gameStore.ts`, `src/engine/missionFailure.ts`. Estimate present; uplink transfers all scanned IDs instantly; no data ledger, partial/drop state |
| E07 | INCORRECT → INCORRECT | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/game/MarsWorld.tsx`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`. 24° hard stop; rock radius collision, not 0.40 m height test; no cross option or damage |
| E08 | INCORRECT → INCORRECT | S | `src/store/gameStore.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`. Add explicit report assertion explaining that random failure risk is not simulated. U7. |
| B01 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/ui/crew/PreparationHub.tsx`, `src/nasa/data.ts`, `src/nasa/engineering.ts`. Agency funding is unrelated legacy economy, not mission budget |
| B02 | MISSING → MISSING | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/ui/crew/PreparationHub.tsx`; legacy `src/data/constants.ts`. No active cost fields/bar |
| B03 | MISSING → MISSING | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`. Instrument schema has no cost |
| B04 | MISSING → MISSING | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`; legacy vehicles. Only incompatible unused legacy costs |
| B05 | MISSING → MISSING | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/ui/crew/PreparationHub.tsx`. No budget/vehicle/orbit integration |
| B06 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/game/MarsWorld.tsx`, `src/engine/missionFailure.ts`. No funding consequence or fixed mission duration |
| F01 | PARTIAL → PARTIAL | S | `src/game/LaunchCenter.tsx`, `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`, `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`. Voice is explicitly required for launch failure; avoid broadening that to every event. Cause disclosure remains required. |
| F02 | INCORRECT → INCORRECT | S | `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`, `src/store/gameStore.ts`. Five outcome labels; event descriptions are not causal decision records |
| SF01 | MISSING → MISSING | S | `src/game/MarsGame.tsx`, `src/store/gameStore.ts`, `src/game/MarsWorld.tsx`. Directly enters active rover mode |
| SF02 | PARTIAL → PARTIAL | S + T1 | `src/game/MarsGame.tsx`, `src/game/MarsWorld.tsx`, `src/store/marsStore.ts`. Live controls and range/stopping checks implemented; no allocation |
| SF03 | MISSING → MISSING | S | `src/game/MarsGame.tsx`, `src/game/MarsWorld.tsx`, `src/store/gameStore.ts`. End mission only; timed sols; manual instant uplink |
| SF04 | INCORRECT → INCORRECT | S | `src/engine/missionFailure.ts`, `src/game/MarsWorld.tsx`, `src/store/gameStore.ts`. Unscheduled deficit/backlog/payload/grade/reserve events; default may have none |
| SF05 | PARTIAL → PARTIAL | S | `src/game/MarsWorld.tsx`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`, `src/engine/missionFailure.ts`, `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`. Grade stop/adviser text; wrong limit, no scheduled response or paid reroute/cross damage |
| SF06 | MISSING → MISSING | S | `src/engine/missionFailure.ts`, `src/store/gameStore.ts`, `src/game/MarsGame.tsx`. Direct-link backlog event unrelated to scheduled loss |
| SF07 | INCORRECT → INCORRECT | S | `src/game/MarsWorld.tsx`, `src/engine/missionFailure.ts`, `src/game/MarsGame.tsx`. Alert after battery reaches reserve; manual entry/exit; no sol skip or load choice |
| SF08 | PARTIAL → PARTIAL | S + T1 | `src/data/scienceTargets.ts`, `src/game/terrain.ts`, `src/ui/crew/PreparationHub.tsx`, `src/game/MarsWorld.tsx`. Three one-shot geology targets share SuperCam/PIXL/SHERLOC OR mapping; fixed RP rewards |
| CR01 | VERIFIED → VERIFIED | S + T1 | `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`. Verified only the named six-seat roster/mapping; no claim of six complete bots or 100-point attainability. |
| CR02 | PARTIAL → PARTIAL | S + T1 | `src/engine/preparation.ts`, `src/ui/crew/PreparationHub.tsx`. Pure deterministic search only for D4/D5/D6; other owner decisions absent |
| CR03 | PARTIAL → PARTIAL | S + T1 + T2 | `src/engine/preparation.ts`, `src/ui/crew/PreparationHub.tsx`. Acceptance/revision/takeover tested in subset; once-per-priority history absent. Do not make revisions permanently locked. |
| CR04 | PARTIAL → PARTIAL | S + T1 | `src/engine/preparation.ts`, `src/ui/crew/PreparationHub.tsx`. Existing candidate filter rejects hard issues, deficit and backlog; absent budget/landing/vehicle checks |
| CR05 | PARTIAL → PARTIAL | S | `src/engine/preparation.ts`, `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/engine/missionFailure.ts`. Different search priorities but no dialogue conflicts; no 100-point scoring |
| CR06 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`. Static review text, no Director bot |
| CR07 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`. Informational briefing/adviser only |
| CR08 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`. Informational briefing only |
| CR09 | PARTIAL → INCORRECT | S + T1 | `src/engine/preparation.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`. Correction: explicit fallback below 10% contradicts the normative Systems rule; no vehicle choice. U2/U9. |
| CR10 | PARTIAL → PARTIAL | S + T1 | `src/engine/preparation.ts`, `src/ui/crew/PreparationHub.tsx`, `src/game/MarsWorld.tsx`. Reserve search present; no plans/E4 proposal |
| CR11 | PARTIAL → PARTIAL | S + T1 | `src/engine/preparation.ts`, `src/ui/crew/PreparationHub.tsx`, `src/nasa/data.ts`, `src/nasa/engineering.ts`. UHF preference and capacity filter only |
| CR12 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`. Only per-station accept |
| CR13 | PARTIAL → PARTIAL | S | `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/game/MissionReport.tsx`. Only selected crew gives generic outcome line |
| CR14 | MISSING → MISSING | S | `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/store/gameStore.ts`, `src/game/LaunchCenter.tsx`, `src/game/MarsGame.tsx`. No branches, beats or story state |
| CR15 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/engine/missionFailure.ts`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`. No corresponding measures |
| CR16 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/engine/missionFailure.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`. No historical measures |
| CR17 | PARTIAL → PARTIAL | S | `src/game/MissionReport.tsx`, `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/store/gameStore.ts`. Reset lets player reselect seat; no seatResults/story |
| OR01 | PARTIAL → PARTIAL | S + T1 | `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`, `src/store/gameStore.ts`. Revision priority and no-safe reason; no structured received orders or counter/refuse |
| OR02 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`, `src/engine/preparation.ts`. No order schema/guards |
| OR03 | MISSING → MISSING | S | `src/engine/preparation.ts`, `src/store/gameStore.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`. No triggers or consequences |
| OR04 | MISSING → MISSING | S | `src/engine/preparation.ts`, `src/store/gameStore.ts`, `src/engine/missionFailure.ts`. No priority/sample/reroute requests |
| OR05 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/game/MissionReport.tsx`, `src/engine/missionFailure.ts`. No orders/causal links/teamwork |
| HI01 | PARTIAL → PARTIAL | S | `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`. Proposal reasons and warnings; old CrewAdvice not active in hub; no universal <10% hint logic |
| HI02 | PARTIAL → PARTIAL | S | `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/ui/crew/PreparationHub.tsx`, `src/engine/preparation.ts`. Energy/data/payload messages subset; missing decisions mean missing hints |
| HI03 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/ui/crew/PreparationHub.tsx`, `src/game/MissionReport.tsx`. No hintsShown/hintsFollowed/read/action tracking |
| TU01 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/game/MarsGame.tsx`, `src/store/gameStore.ts`. No coach overlay |
| TU02 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/ui/crew/PreparationHub.tsx`, `src/game/MarsGame.tsx`. No tutorial state/controls |
| TU03 | MISSING → MISSING | S | `src/game/MarsGame.tsx`. Current world welcome has different copy/no mode |
| C1 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`. Seat copy exists but no coach step |
| C2 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`. Controls subset but no coach |
| C3 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`. No ranking or prompt |
| C4 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/nasa/data.ts`, `src/nasa/engineering.ts`; `src/ui/components/ResourceMargin.tsx`. Numeric deltas, no coach/budget bars; margin component in older screen |
| C5 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`. Normal edit preview is not a deliberate failed-check tutorial |
| C6 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`. No override or coach |
| C7 | MISSING → MISSING | S | `src/game/LaunchCenter.tsx`. Scripted success only |
| C8 | MISSING → MISSING | S | `src/game/MarsGame.tsx`, `src/game/MarsWorld.tsx`. No guided sequence/plan/end-sol |
| C9 | MISSING → MISSING | S | `src/game/MarsGame.tsx`, `src/game/MissionReport.tsx`. No coach/score/chain |
| TU04 | PARTIAL → PARTIAL | S | `src/ui/crew/PreparationHub.tsx`, `src/game/MarsGame.tsx`. Engineering-basis details only; no complete glossary/reopen/help system |
| TU05 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/game/MarsGame.tsx`. New campaign reset only |
| TU06 | BLOCKED → BLOCKED | S + H | No playtest artifact; `src/ui/crew/PreparationHub.tsx`/`src/game/MarsGame.tsx` lack mode. Human evidence and implementation absent |
| SC01 | MISSING → MISSING | S | `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`. RP rewards total 87 for three targets, not prescribed score |
| SC02 | MISSING → MISSING | S | `src/engine/missionFailure.ts`, `src/data/scienceTargets.ts`, `src/game/terrain.ts`, `src/game/MissionReport.tsx`. Returned fractions depend on U1/U6; existing RP is not this score. |
| SC03 | MISSING → MISSING | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`. No score implementation; partial curves and aggregation genuinely unspecified. U8. |
| SC04 | MISSING → MISSING | S | `src/ui/crew/PreparationHub.tsx`, `src/store/gameStore.ts`, `src/game/MissionReport.tsx`. Three station fingerprints/modes do not implement reviewed flags or scoring |
| SC05 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`. No relevance/read/acted ledger; zero-denominator policy unspecified. U8. |
| SC06 | INCORRECT → INCORRECT | S | `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`. Scanned-but-unreturned counts partial; top two not recognized; recoverable-anomaly/abort alternatives |
| SV01 | PARTIAL → PARTIAL | S + T1 | `src/store/gameStore.ts`, `src/engine/preparation.ts`. selectedCrewId and per-station decisions persist; proposals generated, other logs absent |
| SV02 | PARTIAL → PARTIAL | S + T1 | `src/store/gameStore.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`. roverConfig instruments/reserve/downlink/cadence/MOXIE saved; no site/ranking/sol profile |
| SV03 | MISSING → PARTIAL | S | `src/store/gameStore.ts`. Correction: confirmedMission.results saves a limited check-results snapshot; other requested fields absent. |
| SV04 | MISSING → MISSING | S | `src/store/gameStore.ts`, `src/game/LaunchCenter.tsx`. Launch stage is local React state and resets on reload |
| SV05 | PARTIAL → PARTIAL | S + T1 | `src/store/gameStore.ts`, `src/engine/missionFailure.ts`, `src/store/marsStore.ts`. Current event list/transmitted IDs persisted; no plan/quantity/history |
| SV06 | MISSING → MISSING | S | `src/store/gameStore.ts`. Three station decisions only |
| SV07 | PARTIAL → PARTIAL | S + T1 | `src/store/gameStore.ts`, `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`. outcome/rewardApplied/endReason persist; no score/causal chain/frozen report |
| SV08 | PARTIAL → PARTIAL | S + T1 | `src/store/gameStore.ts`, `src/store/marsStore.ts`, `src/game/MarsWorld.tsx`, `src/game/LaunchCenter.tsx`. Production checkpoint reload passed in Task 001; exact mid-action resume remains unproved. U10. |
| HD01 | PARTIAL → PARTIAL | S | `src/nasa/data.ts`, `src/nasa/engineering.ts`; `docs/NASA_ENGINEERING.md`. Known assumptions should not be relabeled absent; missing capacities/landing/relay tables and inherited validations remain. |
| HD02 | MISSING → MISSING | S | `scripts/test-engine.mjs`, `scripts/test-preparation.mjs`. Variants tested but no launch/landing failure can occur |
| HD03 | PARTIAL → PARTIAL | S + T1 + T2 | `scripts/test-engine.mjs`, `scripts/test-preparation.mjs`, `tests/models.spec.ts`. New isolated workshop PASS diagnoses timing; does not certify mission events/scoring. |
| HD04 | PARTIAL → PARTIAL | S | `src/data/scienceTargets.ts`, `src/game/terrain.ts`, `src/ui/crew/PreparationHub.tsx`; `docs/NASA_ENGINEERING.md`. Procedural terrain, descriptions and OR compatibility exist; no three scenario datasets/weighted objectives/sampling |
| HD05 | PARTIAL → PARTIAL | S | `src/data/crew.ts`, `src/ui/crew/CrewAdvice.tsx`, `src/ui/crew/PreparationHub.tsx`, `src/engine/missionFailure.ts`, `src/game/MissionReport.tsx`. Intro, briefing and event messages subset; selected-only debrief |
| HD06 | PARTIAL → PARTIAL | S | `src/ui/crew/CrewRoom.tsx`, `src/models/characterModel.ts`, `src/models/crewAnimation.ts`, `src/game/MarsWorld.tsx`, `src/game/LaunchCenter.tsx`; `public/models/crew/*.glb`. GLBs lack VRM extensions/clips; procedural animations exist. Do not invent an authored-clip requirement. U11. |
| HD07 | PARTIAL → PARTIAL | S | `src/store/gameStore.ts`, `src/engine/preparation.ts`, `src/ui/crew/PreparationHub.tsx`. Partial interfaces and preparation UI; no full mission contract/orders/coach/handoff schemas |
| HD08 | PARTIAL → PARTIAL | S | `docs/GAMEPLAY.md`; `src/store/gameStore.ts`/`src/engine/preparation.ts`/`src/engine/missionFailure.ts`. Design document exists; linked runtime systems remain incomplete. This is a handoff roll-up, not another independent system. |
| HD09 | PARTIAL → PARTIAL | S | `docs/VISUALS.md`, `docs/STATUS.md`, `tests/models.spec.ts`, `src/ui/crew/PreparationHub.tsx`, `src/game/MarsGame.tsx`. Visual/status docs and tests exist; no evidence of required full human QA or recorded compliant run |

## 4. RIMFAX hotspot: root cause and verification limits

The original Task 001 failure was `TimeoutError: locator.click: Timeout 30000ms exceeded` at `tests/models.spec.ts:68`, with repeated `element is not stable`. It did not show a missing RIMFAX node, invisible marker or failed geometry assertion.

New isolated execution, unchanged test/source:

```
CHROMIUM_PATH=/home/kavi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome npm run test:models -- --grep 'connected workshop' --trace on --output=/tmp/ares-task002-original-test
```

**PASS:1 test, 1.4 minutes total.** The formerly blocked review, scene-identity and 390/820px assertions were reached. This improves the evidence for those existing subfeatures only; it is not a rerun of all six tests.

Trace of that pass: RIMFAX locator click ran from 44,271.939 to 58,345.012 ms (~14.07 s); “element is not stable” repeated until~57,382 ms, followed by a successful pointer action. A separate temporary observation probe repeated the same interaction with normal and reduced motion:

| Probe | Click action elapsed | Samples / identical consecutive bounds | Pointer hit evidence | Result |
| --- | --- | --- | --- | --- |
| Normal motion | 18.476 s | 113 /4 | 112 of 112 adjacent-frame samples hit the marker at its center | PASS; one click event; no page errors |
| Reduced motion | 3.571 s | 26 /24 | 25 of 25 adjacent-frame samples hit the marker at its center | PASS; one click event; no page errors |

These are action elapsed times, including automation/scheduling, not pure animation or hardware response times. They are separate short software-rendered runs, not a controlled statistically powered A/B performance benchmark.

Causal chain, supported by code and trace:

1. `PreparationHub.tsx:78–81` calls `setInstrument(id)` when RIMFAX is unchecked. Thus the selected RIMFAX panel is **already active before the subsequent marker click**; both probes confirmed that. The following active-class assertion is weak evidence of a click-induced selection change.
2. `CrewRoom.tsx:195–202` retargets the camera to that instrument and eases it with `1-exp(-dt*3)`. `:159` clamps `dt` to 0.05 seconds. At very low FPS, camera settling takes far more wall time; there is no finite settling snap.
3. `CrewRoom.tsx:215–221` projects the fixed 3D anchor to a CSS transform every frame. Selected text also changes the marker's width. Tiny ongoing movements prevent exact stable screen bounds.
4. The installed Playwright stability checker compares consecutive `getBoundingClientRect()` values for exact equality. The unchanged test waits for that predicate before clicking. Reduced-motion code (`CrewRoom:119,202`) uses blend 1 and largely removes the movement; both trace and observations agree with the mechanism.

**Diagnosis:** performance-sensitive camera/DOM-hotspot timing and a weak test assertion. Geometry/node positioning is not demonstrated defective; center hit-testing succeeded. Rendering load amplifies settling, so this is more than arbitrary test flakiness: users on slow systems may wait for moving targets and cameras. The original >30-second delay cannot be apportioned precisely between software GPU load, other simultaneous work and camera interpolation after the fact. No claim of a gameplay engineering defect or RIMFAX data loss is justified. A one-frame camera-matrix/projection ordering issue is worth checking during a fix but was not isolated as the cause here.

Recommended fix, not applied: give cosmetic camera movement a bounded wall-clock settle and finite position/orientation snap; project hotspots after the current camera matrices are updated; preserve click/touch/keyboard access during motion. Expose a real settled/ready signal if tests need it. Add a normal-motion low-FPS regression and an assertion that an actual click changes inspection from a different instrument while the removed RIMFAX marker remains usable. A reduced-motion interaction test may isolate basic functionality, but must not replace normal-motion coverage. Do not mask the issue using force-click or only increasing timeouts.

Temporary evidence: `/tmp/ares-task002-original-test` trace, `/tmp/ares-task002-hotspot.log`, `/tmp/ares-task002-no-preference-samples.json`, `/tmp/ares-task002-reduce-samples.json`. These are diagnostic artifacts, not committed tests. Production/browser performance limitations are documented in PERFORMANCE_AUDIT.

## 5. Smallest safe first gameplay implementation proposal

**Proposed task: a pure, deterministic mission-cost evaluator with provenance and reference fixtures.** This is a future task requiring implementation authorization; no code was added. It can be developed while U1–U11 are resolved because the baseline cost figures are already settled. Do not enable over-budget launch or the 20-sol consequence until the corresponding risk and sol state exists.

- Requirements: B02/B03/B04/B05 and the calculation portion of B01/E01/A03/HD01/HD03. It does **not** complete B06, D7/D15, budget UI, go/no-go or saved-state integration.
- Exact proposed files: new `src/data/missionCosts.ts`, new `src/engine/missionBudget.ts`, new `scripts/test-mission-budget.mjs`; add an explicit test command in `package.json`. Existing `src/nasa/data.ts`, `src/engine/preparation.ts`, `src/store/gameStore.ts` and `PreparationHub.tsx` are consumers for a later integration task, not files to change in this first slice.
- Inputs: seven existing instrument IDs, a typed light/medium/heavy choice, O1/O2/O3 and a scenario budget defaulting to 2,700 USD million. Reject unknown/duplicate instruments and invalid budgets instead of silently charging twice or substituting arbitrary values.
- Outputs: immutable line items and source tags, locked 2,155, flexible available 545 for the default scenario, selected flexible spend, total, signed remaining budget and pass/fail at total≤budget. Keep money in exact integer USD millions for current tables. No launch/outcome side effects or formula changes.
- Dependencies: exact §4 costs and IDs; provenance metadata should identify platform derivation and assumed subinputs. No capacity/relay-mass/scoring assumptions needed. A tighter scenario budget is accepted only as supplied data, not invented by the implementation.
- Acceptance: all seven+heavy+O1=2,700 and passes at equality; same withO2=2,780 andO3=2,840 fails baseline budget; dropping SuperCam+SHERLOC saves 105; fixed platform/ops never disappear when instruments are removed; every valid O1 loadout/vehicle fits default budget; repeated identical inputs produce identical outputs without mutating inputs.
- Required tests: independent expected-cost fixtures; exhaustive 128 instrument subsets×3 vehicles×3 relays; boundary total/budget equality and one-unit shortfall; invalid/duplicate inputs; source-tag completeness. Run existing engineering/preparation suites, production build/TypeScript after the authorized change. Do not write tests mirroring the calculation line for line.
- Regression risks: accidental reuse of legacy funding/costs; counting platform/instruments twice; calling an assumption NASA-documented; coupling the new evaluator prematurely to incomplete vehicle/risk state. Keep this slice pure and dormant until an integration task is approved.

Separate restoration task available now: repair RIMFAX camera settling as above (S3/D4/HD03), preserving geometry, controls and all mission calculations. Task 003's asset/quality proposal is separate and must not expand this engineering slice into a redesign.

## 6. Investigation commands, results and stop boundary

- Read-only `git status`, branch/commit/stash inspection, `rg`, `nl`, package/test/source inspection and hashes: baseline unchanged; previous audit documents remain unmodified.
- New unchanged isolated Playwright test:1 PASS as recorded above. Original Task 001 full-suite result remains 5 PASS/1 FAIL; no unsupported claim that a new full-suite run passed.
- Temporary normal/reduced-motion probes: both PASS with observed event delivery and no page errors; timing results above. No production or test edits.
- `npm run dev -- --host 127.0.0.1 --port 5181 --strictPort`: local server for diagnostic modules. Local browser initially failed under sandbox socket restrictions; execution was permitted through automatic approval review. No unresolved approval rejection.
- Official NASA source review distinguishes real rover operational data from game design. No unsupported numerical inputs were added.
- Build/engineering/preparation results are inherited from Task 001, not rerun as new evidence here. This investigation changes documentation only.

Deliver for Game Director review and stop. Implementation proposals and owner recommendations are not implementation, merge, deployment or specification-change approval.

Final scope check: tracked and staged Git diffs are empty; HEAD and stash list are unchanged. SHA256 checks confirm GAMEPLAY, the original model test, BASELINE_AUDIT and COMPLIANCE_MATRIX remain byte-for-byte unchanged. The only additions in Tasks 002/003 are IMPLEMENTATION_READINESS.md and PERFORMANCE_AUDIT.md.
