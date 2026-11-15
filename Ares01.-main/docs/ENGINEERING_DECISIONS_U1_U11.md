# Engineering decisions U1–U11 — review specification

Reviewed 2026-11-15 against commit `17dddad1ef31439a5a72ffd72d76e235bfb8d66e`. The working tree was clean before this task. Both excluded reference directories were ignored. GAMEPLAY was read completely; NASA_ENGINEERING was read before proposing parameters. This document supersedes the *open questions* in IMPLEMENTATION_READINESS, not GAMEPLAY or the existing implementation.

**Disposition: internally testable candidate, not an approved gameplay specification.** No proposed number, scoring rule, schema or dialogue below has been integrated. Four documentation files are the only repository changes. Mathematical reference checks are distinguished from game tests in [MISSION_BALANCE_FIXTURES](MISSION_BALANCE_FIXTURES.md). All scientific inputs, limitations and source locations are registered in [SCIENTIFIC_PROVENANCE_AND_EQUATIONS](SCIENTIFIC_PROVENANCE_AND_EQUATIONS.md). Genuine decisions are collected in [OWNER_APPROVAL_ITEMS](OWNER_APPROVAL_ITEMS.md).

## 1. Authority and resolution status

References are to the current 379-line GAMEPLAY. Existing implementation is evidence of behavior, never a competing authority. DOCUMENTED means source-backed; CALCULATED identifies a derivation; ASSUMED identifies an educational choice. An approved assumption would remain ASSUMED. Confidence that code exists is not evidence that gameplay passes.

| Issue | Already settled; no new owner vote | Remaining approval / readiness |
| --- | --- | --- |
| U1 | §3 O1 `:103` says “all data waits a sol”; §4 `:121` says “Excess data is dropped; those observations score zero” for overridden capacity; §6 `:174` says remaining E2 data waits; §7 `:250` distinguishes obey/refuse. The directive clarifies these scopes. | A01: observation/storage/drop contract below. Data ledger and score integration blocked on this contract. |
| U2 | Exactly three vehicles/sites/windows; rover-plus-relay launch mass; fixed costs; season/lighting effects (§3 `:78,83–89`). | A02/A05: effective capacities, sites, window representation, event routes and relay masses. No new transfer probability. |
| U3 | §4 `:118`: “Mass and site hazard versus landing capability”; hard landing loses one subsystem. §5 `:154` preserves stationary science. | A03: simplified comparison and damage mapping. NASA does not supply the proposed game equation. |
| U4 | Deficit, reserve breach and zero battery are distinct. E4 below selected reserve offers cut-load/safe mode, accepted safe mode skips next sol (`:175`). One zero event cannot immediately end the mission. | A04: §4 `:120` three-deficit wording versus §2/§5 `:71,155` three-zero wording; exact safe-mode entry, zero-counter boundary and recovery. |
| U5 | O1/O2/O3 concepts, costs and nominal capacities remain fixed (§3 `:103–109`). | A05: contacts/masses/DTE; A05b: O3 short-outage/half-return conflict. |
| U6 | Seven instruments; rank three objectives .5/.3/.2; only returned science; D12 sample/move choice (`:79–88,321`). | A06: normalized activities, compatible products, completion units and sample package. |
| U7 | §5 `:153–165` controls failures; risk acceptance must cause the matching deterministic consequence; an ordinary damage record is not automatically a major failure. | Resolved at rule level by GAMEPLAY plus this directive. Event/schema conventions below do not create a new outcome. Dependent damage values await A03/A04. |
| U8 | Categories 30+30+15+15+10; fixed full-credit bands and review rules (`:320–328`). | A08: functions, aggregation and denominator rules. Global continuous efficiency scoring conflicts mathematically with fixed thresholds. |
| U9 | §7 `:209,213`: Systems proposals require at least 10% mass margin. The illustrative 8% dialogue is not the normative rule. Never offer an unsafe fallback. | Resolved at behavior level by this directive. Numerical feasible designs await A02; tie-break implementation can be deterministic as specified below. |
| U10 | §1 `:31`: “resumes exactly where they stopped”; stage autosave `:332` is a minimum. Tutorial preferences survive campaign reset (`:275–305`). | Resolved at behavior level. Save contract below is engineering design; exact persistence and interruption tests remain implementation work, not a request to permit lost progress. |
| U11 | §12 `:351` requires six VRM characters with idle/talk/gesture; §5 `:153` explicitly requires a voiced launch-failure reaction. | A11: compliant conversion versus explicit format exception; rights-cleared voice delivery still required. Original draft story content is below. |

Also already settled: 30°/0.40 m terrain boundaries, one launch retry, 30/20-sol durations, scheduled E1/E2 and conditional E4, no RNG, Quick/Explore and Guided/Skip parity, six seats and unchanged score maximum. No owner is asked to choose these again.

### Existing documentation conflicts excluded from the candidate

NASA_ENGINEERING §9 suggests optional random sand traps and alternate platforms; GAMEPLAY prohibits those extensions. Its V09 blocking language does not remove the explicit player choice to cross a warned terrain limit. Its strict pre-launch gate does not remove D9's documented overrides. Shared mast/turret mounting must allow all seven installed instruments; sequential arm operation is a different constraint. The published 1,025 kg flown rover mass is neither a Mars launch-vehicle capacity nor a proven landing-system limit. None of these conflicts authorizes changing GAMEPLAY.

## 2. U1 — observation ledger and communications loss

**A01 proposal.** Represent science storage with metadata, ranges and byte counters, not720MB of dummy in-memory data. Buffer capacity is a simulated mission resource, independent of device RAM; compact representation must preserve observation identities and pending offsets. Use immutable observation IDs `(runId, instrumentId, targetId, sol, acquisitionSequence)`, integer bytes (decimal Mbit/MB), original product size, encoding/source classification, objective membership, acquired/transmitted/dropped byte counts and cause IDs. Reserve the complete product's storage before acquisition. An interrupted acquisition retains executed energy/progress but is not a completed observation. Partial downlink is allowed; scientific credit requires every byte of the complete observation and every prerequisite in its objective bundle. No partial credit for a fragment masquerading as a complete observation.

Proposed science buffer: **5,760 Mbit = 720,000,000 bytes**, twice O2's nominal daily capacity. This is an educational allocation, not NASA's published 2 GB physical flash. Six typical 889.6-Mbit cohorts fit; seven do not. Two enriched 2,164.8-Mbit cohorts fit; three do not. Check capacity before starting an acquisition; when full, explain that acquisition cannot begin until space is freed. Do not silently destroy old data or charge unperformed work. Buffer capacity and overflow prevention affect player choices and require approval.

Queue ordering is explicit priority, then acquisition sol, sequence, then ordinal canonical ID. Do not use locale-sensitive sorting. A partially sent observation keeps its transmitted counter if reprioritized. Available capacity services pending bytes only. Free buffer space byte-for-byte as data returns; retain metadata and cause history separately.

At End sol, use this proposed precedence:

1. Apply the accepted **design** over-capacity consequence to that sol's newly acquired, warned cohort against the normal nominal capacity. Drop lowest-priority whole observations until the retained cohort fits. A 140-Mbit excess can therefore cost a 200-Mbit indivisible product; warn about the actual product loss before acceptance.
2. Apply an explicitly refused applicable Communications order to its captured cohort and warned **actual available** capacity. Never silently make an E2 queue into a refusal. On overlapping causes, drop a product once and retain both cause references. An accepted design risk is not erased by obeying a later order; revise the risk-producing plan before its consequence boundary to avoid its future loss.
3. Apply E2 availability and service the surviving queue. Ordinary missed passes and obeyed prioritization retain waiting observations. Older E2 backlog is excluded from the new design-risk cohort.
4. At the final sol, perform the last available service, then mark remaining products `unreturned-at-mission-end`. No extra sol/pass; no automatic transmission; no false `dropped` label. Unreturned products earn no completion credit but do not independently invent a failure type.

Physical invariant for each completed acquisition: `totalBytes = pendingBytes + transmittedBytes + droppedBytes`. A deliberately abandoned incomplete product has a terminal disposition, physically returned fragments, and dropped remaining bytes; it is never scientifically complete. Completed-objective IDs and physical-byte accounting are separate so retransmission cannot earn credit twice. Save the full ledger and partially sent offsets.

Current gaps: `src/store/gameStore.ts` returns all scanned target IDs without capacity; `src/engine/missionFailure.ts` permits scanned-but-unreturned partial success; `src/nasa/engineering.ts` sums incompatible data periods. Implementing a queue requires replacing these boundaries together in a later task. Acceptance: F04–F06 and F12 in the fixture document, including simultaneous risk/E2, exact buffer capacity, refusal, partial return and final-sol backlog.

## 3. U2/U5 — coordinated candidate choices

All newly proposed values here are **ASSUMED**, unless explicitly identified as source context. These are fictional effective rover-plus-relay allowances after omitted transfer-stack accommodation; they are not payload-to-LEO figures or certified Mars services.

| Vehicle | Effective Mars allowance kg | Fixed cost USD million | Practical effect |
| --- | ---: | ---: | --- |
| Light | 1,200 | 120 | Full rover/O1 fits; full rover/O2 fits the hard limit but misses Systems' 10% margin; O3 cannot fit even an empty-instrument rover. |
| Medium | 1,500 | 180 | Core payload/O3 has 10.38% margin and costs 2,645; full payload/O3 falls short of Systems' margin. |
| Heavy | 1,550 | 245 | Full payload/O3 has 11.29% margin; its 2,840 cost needs the documented budget override. |

The preliminary 1,300-kg Medium was rejected during this investigation: it forced every O3 scientific core onto Heavy, costing 2,710 and making that core over budget. The final candidate is 1,500, not both values. The small Heavy increment is a game trade-off, not a claim about a real launcher fleet. Enumeration and the rejected package's consequence are documented in the fixtures.

| Link | Added relay kg | Nominal service | E2 service | Incremental radio-energy debit |
| --- | ---: | --- | --- | --- |
| O1 | 0 (established) | One logical 480-s slot at 2 Mbps = 960 Mbit | 0; queue all ordinary data | 0 additional Wh; radio is already in baseline |
| O2 | 75 | Three equal 480-s slots at 2 Mbps = 2,880 Mbit | Lose slot 2: 1,920 Mbit | Same accounting boundary |
| O3 | 350 | Effective `1,800e6/88,775` bit/s = 20,275.978598 bit/s; 1,800 Mbit | Proposed effective 900-Mbit quota; A05b unresolved | Same accounting boundary |
| Direct X-band | No extra orbiter for direct service | 500 bit/s for assumed 3,600 s = 1.8 Mbit | No invented DTE outage; scheduled E2 still reports the unused relay opportunity | Same accounting boundary |

D6 selects which service carries science; do not add DTE and relay capacities unless separately specified. D15 still chooses one option with its cost/mass, even when direct service is selected. End-sol contact slots are the GAMEPLAY transmission abstraction, not an ephemeris. Partial bytes consume capacity; a disabled/unused link cannot secretly transmit. The existing continuous-DTE assumption is 44.3875 Mbit/sol: the proposed one-hour contact is a substantial reduction and requires approval.

**O3 genuine conflict:** constant lower-rate service plus a *short* outage does not mathematically yield only half a sol's capacity under §6's rate-times-remaining-time rule. Proposed 900-Mbit effective service is a scheduling abstraction, not a derived orbital fact. No invented ten-minute interruption or secret rate change. A second ambiguity is “half that sol’s data”: a900-Mbit quota is half nominal capacity, not necessarily half the acquired cohort. For F09's1191.6-Mbit E2 cohort it returns900Mbit, whereas a literal half-cohort reading returns595.8Mbit before considering older backlog. These interpretations change waiting/completion timing and efficiency denominators. Its E2 outcome remains blocked until the Director explicitly resolves both the quantity and service model; approval cannot be inferred from the convenient900 calculation.

### Sites, windows and events

| Scenario | Verified geographic/scientific context | Synthetic representation and objectives | Candidate landing hazard factor |
| --- | --- | --- | ---: |
| Jezero | Ancient lake/delta; sedimentary and volcanic contexts | Layered outcrops, organic/mineral context and environment measurements. Core instruments can address all three objectives. | .03 |
| Northeast Syrtis | Diverse mineral/alteration history investigated as a landing candidate | Altered-rock contacts, compositions and weather. Surface mesh and hazard placement are authored, not an orbital terrain product. | .08 |
| Columbia Hills | Gusev/Spirit context including silica-rich deposits | Hydrothermal-context investigation, compositional observations and environment measurements. No claim of verified life. | .12 |

These numbers are **not a measured comparative NASA risk ranking**. Three scenario centers use rounded illustrative latitudes +18°, +18°, −15°. W1/W2/W3 use arrival-season solar longitude 0°/90°/270°. With documented 25.19° obliquity, `declination=asin(sin(obliquity)*sin(Ls))`, and representative noon elevation `90°−abs(latitude−declination)`, northern examples are 72°/82.81°/46.81°; southern examples 75°/49.81°/79.81°. These are scenario illumination snapshots, not actual Earth departure dates or orbit-transfer calculations. They change coherent scene lighting and planning information, not MMRTG output or invented power penalties. Time-of-day/season integration into optical observations needs operational criteria before it can become an engineering pass/fail rule.

Proposed E1 schedule: sol5/6/7 for W1/W2/W3; E2: sol12/13/14 for Jezero/Northeast Syrtis/Columbia Hills. All occur inside 20 sols and are persisted, never rerolled. Terrain encounter and safe alternate route are fixed per site; complete route parameters are in the provenance register. The reference Jezero W1 mission uses a blocked 31°/0.45-m crossing and a 40-m safe detour. These authored values require approval. The actual crossing gate remains strictly **above** 30° or 0.40 m; equality is not an E1 violation. For W2/W3, E1 can be a scheduled route review on nondriven sol6/7: record the chosen route, and charge only the actual later traversal. With mobility already disabled, record the scheduled warning as non-actionable; fabricate neither a drive nor a scored response opportunity. Event dates are mission-sol facts, not timers tied to 3D frames. A skipped sol cannot erase a required event: deliver its pending review at the next planning boundary before affected work; no rescheduling lottery.

## 4. U3 — landing and damage contract

**A03 candidate:** compare `landingDemand = roverMassKg × (1 + siteHazardFactor)` with **1,125 kg-equivalent**. The factor is dimensionless; this screening index is not a physical force, impulse, probability, actual sky-crane limit or NASA equation. Relay mass contributes to launch, not to the rover's landing index.

Normal landing when demand ≤ capability, including exact equality. A failed comparison must be shown before launch; without acceptance, revise the design. If accepted and still failed at S6, create exactly one landing-failure record and disable **mobility**. This constant subsystem mapping is transparent and deterministic; it does not choose randomly among instruments or add hidden severities. It leaves fixed-site science and available communications active. No restoring mobility by reloading or changing graphic quality.

Persist `damageId`, triggering check/decision IDs, subsystem, disabled capabilities, logical time, and original comparison. If a subsystem was already disabled by an earlier cause, keep that same disabled state and append the cause; do not choose a second subsystem to make the animation more dramatic. Landing failure remains a major failure in S8 even if stationary science succeeds. A03 also proposes that E1 crossing fully disables mobility; GAMEPLAY specifies mobility damage but does not specify its severity. That severity requires approval. Record it as terrain damage, not retroactively as a landing failure.

For a separately accepted peak-power risk, the first instrument activity that raises total load above 900 W goes offline as GAMEPLAY says. For simultaneous instrument starts, order by activity sequence then canonical instrument ID; first crossing wins. Compute the cause before removing its load, retain the failure, and do not damage every concurrent instrument. If no instrument start caused the crossing, the documented instrument consequence has no defined target: block that scenario and report the missing rule, rather than damaging a random part. No current instrument-rating combination alone exceeds 900 W; the threshold can be unit-tested without claiming every consequence is reachable in the current mission catalogue.

Fixtures include normal/core landing, full-payload high-hazard landing, exact boundary and +1 mg. Source concepts motivate mass/site coupling but do not validate the assumed coefficients. Before adoption require a unit test that mobility loss disables driving while a reachable local target and MEDA can still collect and return science.

## 5. U4 — unified energy ledger, deficit and safe mode

Reuse existing equations and their provenance: power × duration, sum concurrent loads, MMRTG fit, two 43-Ah packs at assumed 28 V, assumed 75-W housekeeping, reserve20/30/40%, round-trip .90 with charge/discharge `sqrt(.90)`, Crr .15, drive efficiency .5, and actual rover mass. Radio/engineering cameras remain in baseline; RIMFAX power is charged once, never both auxiliary drive and instrument activity.

One authoritative ledger advances logical activity intervals. Every activity has an ID, actual duration/distance and one debit. No elapsed render-time energy, automatic 90-second sol, routine science plus duplicate scan debit, or graphics-dependent result. A sol is 88,775 simulated seconds, closed by the specified controls/work allocation; Quick/Explore only changes presentation. Split intervals at activity boundaries; integrate generation/baseline once over the complete sol. Proposed BOL age at landing is0 years, initial charge2,408 Wh; sample RTG output at sol start using elapsed physical seconds divided by a 365.25-day Earth year. These are explicit scenario assumptions, not claims about actual flight-unit age.

For an interval with generation G, requested load L, stored B and efficiency η: on surplus, accept at most `(G−L)η` into remaining battery space; record conversion loss and curtailed surplus. On deficit, withdraw at most B toward `(L−G)/η`; record actual delivered load, conversion loss and unserved demand. Clamping alone must not hide an unserved load. Reserve is compared to stored charge, not subtracted from generation a second time. For downhill negative traction, propose zero propulsion debit plus baseline/auxiliary loads, not regenerative charging; this behavioral extension requires A04 approval.

**A04 timing proposal:** at plan commit, a projected negative-energy sol offers a load correction; if the risk remains accepted, enter protective safe mode immediately on that first sol and cancel unexecuted optional activities. An accepted E4 choice or refused applicable Power order schedules exactly one next-sol skip. Duplicate causes never skip twice. Mid-sol revisions apply at their logical boundary and retain consumed energy and completed observations. The current remaining work may therefore be lost *as well as* the next sol: that is a proposal requiring approval, not hidden wording in GAMEPLAY.

During the skipped sol run generation and baseline only, retain storage, and allow already-planned contacts under the baseline radio allowance. No new science or driving. At the following planning boundary, resume optional activity only after a forecast satisfies the chosen reserve and nondeficit rules; a further waiting/safe sol remains recorded if recovery is insufficient. No magical battery refill and no empty-battery immediate loss.

**Counter proposal:** increment once at committed sol end iff stored Wh is exactly zero; reset on any positive end-sol energy; third consecutive zero closes the mission. Log within-sol zero crossings separately. This adopts the directive's recommended §2/§5 reading and needs explicit reconciliation with §4's three-deficit wording. A deficit without an empty battery must not increment this counter.

With healthy110-W generation and75-W baseline, an empty battery gains818.799331 Wh in a constant-BOL safe sol. Thus the proposed healthy-rover safe-mode model cannot physically produce three consecutive end-sol zeros. A counter-vector test is possible; a credible end-to-end rover-loss fixture is **blocked** without another already-authorized persistent fault or a different approved interpretation. Do not manufacture one. The fixed three-zero loss rule remains intact even if currently unreachable.

## 6. U6 — authentic capabilities and proposed observation schedule

All exact product/time assignments below are **A06 assumptions**; published masses/powers/data examples and their uncertainties are separately recorded. This is an educational campaign, not a reconstructed Perseverance operations log. In particular, SHERLOC's published79.7-Mbit raw quantity and MEDA's11-MB figure do not establish daily intervals. A primary PIXL operations paper shows much longer detailed maps; a proposed two-hour activity is a simplified targeted measurement. MOXIE completed its real Mars campaign in2023; the selectable capability is historical/hypothetical, not a claim of operation in2026.

| Activity | Candidate duration / products | Data Mbit | Energy Wh |
| --- | --- | ---: | ---: |
| Mastcam-Z context | .5 h; one context bundle | 148 | 8.7 |
| SuperCam | .5 h; four15.5-Mbit experiments | 62 | 8.95 |
| SHERLOC block | 1 h; four assumed79.7-Mbit raw products | 318.8 | 48.8 |
| PIXL targeted product | 2 h; one16-Mbit experiment | 16 | 50 |
| MEDA sol record | 25% of a sol at17W; assumed daily11 decimal MB | 88 | 104.803819 |
| MOXIE demonstration | 1 h production-only abstraction; assumed1-Mbit telemetry | 1 | 300 |
| RIMFAX | 10,000 bytes per assumed0.1-m sounding;10W while driving | .8 per metre | 10×drive hours |

Typical core = Mastcam-Z + SHERLOC(two blocks) + PIXL + MEDA: **889.6 Mbit**, total baseline-inclusive2,110.582986 Wh. Enriched core uses six SHERLOC blocks: **2,164.8 Mbit**,2,305.782986 Wh. Full seven-instrument *target-sol* template adds SuperCam, MOXIE and300m of RIMFAX: **1,192.6 Mbit**, exceeding O1. Stationary full-payload sols produce952.6 Mbit without driving/radar. Do not claim every sol produces the target-sol amount or multiply fixed NASA quantities without exposing the schedule. RIMFAX at the lower5-kB endpoint would produce120 rather than240 Mbit over300m; show that sensitivity, not a false exact raw-data prediction.

| Objective / candidate completion | Compatible products | Exclusions and safeguards |
| --- | --- | --- |
| G — geological history, four distinct completed target bundles | Mastcam-Z context + PIXL **or** SuperCam composition. Up to two units may instead use distinct100-m RIMFAX profiles with context. | Imagery alone is not elemental analysis; radar is subsurface structure, not direct organic detection. |
| B — potential biosignature context, four distinct rock bundles | One SHERLOC block (four products) + PIXL context at the same rock. | Neither instrument alone proves life; positive and negative synthetic measurements can both be valid science. No “life confirmed” result. |
| E — environment/exploration conditions, ten distinct-sol MEDA records | MEDA; optionally up to two technology-demonstration units from MOXIE with separate MEDA context. | At least eight MEDA weather units if using the alternative; a context record cannot also count as a different completion unit. No new oxygen score category. |

Fractions are `min(completedUnits/requiredUnits,1)` and only whole returned prerequisites complete a unit. Lock target/product associations before acquisition; no relabeling after transmission. A product may inform a narrative in several ways but earns one objective completion unit; alternatives do not raise the category cap. Detailed roles and raw/compressed distinctions are in the provenance register.

D12 candidate on sol8: an additional1-h SHERLOC block plus2-h PIXL product, **98.8 Wh and334.8 Mbit**. Completing and returning all five products supplies one of objective B's four units; moving on spends neither and forfeits that unit. Do not debit it again if it was already included in the confirmed activity list. In the reference itinerary no later replacement for that unusual rock exists: if all other B units return, skipping reduces B to.75. If B ranks first/second/third this loses3.75/2.25/1.5 science points, respectively, before any change to mission-performance tier. The same conditional opportunity is available from every seat.

## 7. U7/U9 — risks, proposals and outcome records

Use an append-only causal ledger: decision/revision ID; evaluated configuration fingerprint; check value, limit and signed margin; explicit acceptance; activation phase; actual consequence; damage/data IDs; linked refused order. A configuration change invalidates stale acceptance and forces the documented recheck. Risk acceptance is not proof that its consequence happened. Outcome and narrative are derived from actual events, not the cinematic animation selected.

Only §5 launch failure, landing failure and three-zero-sol rover loss force the failure headline. A first launch failure stays in the cause chain after the one retry; recovery performance is a separate tier. Terrain/brownout/data damage can reduce science and appear in the report without fabricating another major-failure classification. Full/baseline/minimum/no objective performance follows §9, never scanned-target RP.

Voluntary exit records `runDisposition=abandoned` and an unfinished ledger outside the evaluated mission-result field. Do not award SUCCESS/PARTIAL SUCCESS, fabricate a new §5 failure or bypass the30/20-sol end. Resume remains possible from the last authoritative snapshot unless the player explicitly starts a new campaign. A completed failure/report and an abandoned session are distinct records.

Systems proposal search filters *before* ranking: all applicable hard checks pass, no accepted red risk, mass margin `(capacity−rover−relay)/capacity ≥ .10`, and relevant required objective access preserved. If no candidate meets this, return `noCompliantProposal` plus limiting constraint and deficit `max(0, launchMass−.9×capacity)` kg. Suggest a separate vehicle/payload change the station is allowed to request; never silently change another seat's confirmed choice. A zero-instrument rover with O3 cannot meet Light's margin, so no fallback is permitted.

A09 proposed tie-break: preserve the current payload and player-locked choices if a valid vehicle exists; choose the smallest fitting vehicle for that payload. For an authorized payload revision, first filter the same mandatory conditions, then rank by the selected priority: science = descending sum of rank weight times forecast objective fraction under the committed schedule; safety = descending minimum of the normalized mass, landing, peak, sol-energy, data and budget margins; less mass/cost = ascending launch mass, then cost. Here each margin is (limit minus demand)/limit, with sol generation as the energy limit and nominal link capacity as the data limit. Reject undefined/zero denominators. Finally prefer fewer changed fields, smaller vehicle capacity, lower cost, lower mass, then canonical instrument bitmask and ASCII relay/vehicle IDs. All ties are therefore total and stable; the choice policy, unlike the established10% threshold, is approval-dependent. Scoped station proposals cannot mutate unrelated choices. Return all ranking components for reproducibility. Other bots retain their exact §7 priorities: Director fewest red checks/best window margins, Geologist safest terrain then layered rock, Astrobiologist maximal supported science, Power highest feasible reserve, Comms cheapest adequate relay. No RNG, locale ordering or unreviewed acceptance of red checks. This is a deterministic implementation policy, not a changed10% threshold.

## 8. U8 — pure scoring contract proposed for approval

Candidate public API: `evaluateMissionScore(readonly authoritativeReport): ScoreBreakdown`. No React/Zustand/Three.js/clock/RNG. Return each category, inputs, eligibility, exact reasons and provenance; reject unknown/missing records rather than silently invent zeros. This is an API specification and independently executed reference mathematics, **not a new production engine**.

Let `u` be nonnegative utilization. For mass, energy and data propose:

```
f(u) = 4u/0.70       for 0 <= u < 0.70
       4            for 0.70 <= u <= 0.95
       0            for u > 0.95
```

Each segment is monotonic and bounded. The mandated full4 at exactly.95 and zero for any margin below.05 force a discontinuity immediately above.95. A globally continuous, globally monotonic function satisfying both is impossible. The directive's continuity preference cannot supersede GAMEPLAY. No interpolation is inserted in that forbidden band.

For budget utilization `b=missionCost/originalApprovedBudget`, propose:

```
g(b) = 3                      for 0 <= b <= 0.95
       3 - 40*(b - 0.95)      for 0.95 < b <= 1
       0                      for b > 1
```

This gives3 at95%,2 at97.5%,1 at100%,0 above budget. The1-point endpoint and slope40 are **assumptions**, selected to preserve positive partial credit through100%; they are not in GAMEPLAY. A continuous taper to0 at100% would need a different interpretation of “partial ... through100%”. Approval item A08 exposes the choice.

Proposed denominators: mass = confirmed rover+relay / selected vehicle capacity at go; energy = physically delivered baseline+activity Wh / generated Wh over completed mission sols (battery discharge is not counted again as load); data = unique physically returned science-product bits / actual available selected-link capacity over those sols, including E2 reductions; budget = full mission cost / unchanged approved scenario budget. Transmission fragments consume capacity and can count physical resource use, but only complete products count scientific success. Count each acquired product/byte once; duplicate retransmissions and artificial duplicates are ineligible. Curtailed generation is not a bonus. Reject a zero/undefined capacity report instead of silently using1; a known zero opportunity has0 efficiency points. These denominator choices affect results and require approval.

Science = `30 × (.5*f_top + .3*f_second + .2*f_third)`. Performance counts objective breadth with eligible returned data:30 when all3 fractions are positive,20 when the top2 are positive,10 when at least1 is positive, otherwise0. GAMEPLAY says objectives “returned data”; it does not impose a second100%-completion threshold on tiers. Fully returned prerequisite bundles can earn partial objective fractions; byte fragments alone earn none. Thus fractions(.75,1,1) still have full performance but reduced science. A scientifically incomplete mission is not automatically a major failure. Raw returned products without any completed prerequisite bundle do not yet constitute eligible objective data under A06; they have zero objective contribution, and this eligibility interpretation is part of A06 approval. Preserve any overriding §5 failure headline separately from recovered performance.

Decision quality: D4/D5/D6/D9 each contribute3 only if the final relevant choice is both reviewed and respects its applicable margins. Proposed applicable checks: D4 installation/capability and mass/peak/landing/cost limits; D5 nondeficit plan and chosen reserve; D6 nominal acquisition fits selected link; D9 no unresolved accepted red check. D11 contributes **one** `3 × goodReviewedRelevantPlans / relevantPlans` term across committed optional-work sol plans. Zero relevant plans contributes0, not free decision points. Safe-mode automatic skips are not extra review opportunities. A repeated edit does not create another denominator entry; keep the final effective revision per sol. Reaching the five-category maximum requires explicit review of all relevant decisions from every seat; blind “Accept team plan” still gives no review credit.

Teamwork = `10 × readAndActedRelevantOpportunities / relevantOpportunities`. Assign a stable opportunity ID to the underlying actionable cause and controlling decision, retaining domain/station/direction as metadata. A revision or an echo on the final review screen retains that ID; a new actionable cause gets a new ID. One order that also appears as the same hint counts once. Do not suppress an unresolved under-10% warning just because it is no longer a new scoring opportunity. The denominator includes relevant delivered opportunities even if unread, never irrelevant/unshown coach content. Obey or a safe counter counts acted; explicit read evidence is still recorded. Following a specific feasible improvement (for example selecting a cheaper vehicle or safer site) counts as acting on that request even if its margin remains under10%; retain the warning and actual residual margin. Mere acknowledgement is not an action. “Accept team plan” obeys received orders but does not fabricate reads of hidden hints. Re-showing/reloading does not add opportunities. Proposed zero denominator =10 (no relevant collaboration missed), preserving100 reachability without manufacturing warnings. Missing instrumentation is a validation error, not an empty denominator.

Use integer USD millions/bytes, stable units and unrounded Float64 values for physical integration; exact rational/cross-multiplied comparisons for score ratios and thresholds. Test tolerances are not gameplay epsilon exemptions. Sum unrounded categories, assert0–100, then round *only display* to two decimals, half-up from the canonical score representation. Never sum independently rounded category displays or use a rounded margin to decide a boundary. Save the score-version and source ledger, and recompute reproducibly from it.

## 9. U10 — authoritative save/resume contract

One versioned authoritative mission snapshot owns phase S0–S8/recovery and subphase, accepted configuration/versions, launchAttempt and causes, pending choices/orders/review flags, mission horizon, sol, logical activity cursor and remaining allocations, rover position/heading, battery/ledger, observation buffer/partial transmissions, objective progress, fixed event schedule/resolution, damage, counters, report data, and active interaction progress. Retain scan elapsed *logical work*, not solely a progress-bar percentage. Store separate persistent tutorial-seen/preferences and an explicit replay action; a new campaign resets neither preference by accident nor a prior campaign's immutable report.

Create a pure snapshot serializer/validator and migrations. Apply each authoritative command, resulting state and its idempotency/event sequence atomically; checkpoint on every committed decision, event, completed activity, End sol, stage entry and before leaving. Persist motion/interaction increments through the same command journal so the latest acknowledged move/scan can resume. Batch cosmetic rendering, not acknowledged gameplay progress. Browser lifecycle flush is supplementary, not the only save. If storage fails, expose the failure and do not claim a successful checkpoint. Never overwrite an unreadable/future-version save with a fresh default silently.

Hydrate before constructing surface stores or evaluating events. The renderer reads the snapshot; it cannot recalculate outcomes from animation progress. Cinematic resume may restart a shot, but must not repeat launch/landing checks, consume retry, transmit data or advance the sol. Preserve pending side effects with applied command IDs. Exact crash atomicity needs persistence tests; do not promise it merely because localStorage exists.

Acceptance: interrupt before/after each decision, halfway through drive/scan, between partial transmissions, after damage, before/after sol commit, during safe-mode skip and launch replay. Compare resumed/uninterrupted authoritative states and reports byte-for-byte after normalization. Change display FPS/quality/pacing during replay; all scientific outputs remain identical. Test new campaign tutorial retention and explicit replay separately. Current dual stores (`gameStore.ts`, `marsStore.ts`) plus MarsWorld's frame-owned locals/five-second snapshots do not yet satisfy this.

## 10. U11 — format, story and voice delivery

All six `public/models/crew/*.glb` JSON chunks were inspected this task: they declare clearcoat/specular material extensions, no VRM extension, and zero animation clips. Skin counts Aaryan2/Houssam1/Huzaifa1/Kavi1/Lautaro3/Rihabe1. `src/models/crewAnimation.ts` supplies procedural posing and clothing-weight preparation; it does not make these VRM files.

The [VRM1 specification](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/README.md), “Format and Extension”, “Humanoid” and “Meta”, defines a glTF binary container with VRM semantics including required humanoid mapping and metadata. Renaming `.glb` to `.vrm` is insufficient. Its character format does not use ordinary stored animation clips as a substitute for runtime character behavior.

A11 options: (1) reproducible export of separately preserved derivatives with valid VRM metadata/rig mapping and tested idle/talk/gesture, retaining originals and recognizable materials/clothes/face; or (2) explicit owner-approved exception retaining GLBs and validating equivalent *required behaviors*, without claiming format equivalence. Neither conversion nor a new loader is authorized here. Conversion needs asset-rights evidence, appearance comparison, animation/rig and loading measurements; source creators/permissions remain subject to the existing asset-licensing audit.

### Original ASTROCREW draft: 36 beat lines

These fictional lines were newly drafted for team review; they are not NASA quotations, real-astronaut speech or implemented content. Each row supplies A/B/C × Kept/Strained. Use actual checks to select branches at each beat, and keep the displayed line/branch in the save. Beats never change score or physics.

| Seat | A Kept | A Strained | B Kept | B Strained | C Kept | C Strained |
| --- | --- | --- | --- | --- | --- | --- |
| Kavi | Every limit has a place in our plan. I can explain this go decision. | This plan still needs a clear account of what we accepted. | The checks tell us what the sequence achieved. Keep the team on the same facts. | That consequence belongs in our record. We will work from the rover we have. | We are protecting the plan through each new decision. | We accepted a risk, and its cost is now part of our mission. |
| Lautaro | These layers give us a reason to choose this route. | A useful outcrop is not permission to cross an unsafe approach. | From here, we can plan a route that respects the terrain limits. | Record the crossing before we promise another traverse. | Take the longer route. The rock will still be there. | We crossed the limit. Plan the next observation around the mobility we have. |
| Rihabe | Returned evidence is what will answer our first question. | Our first question still needs returned evidence. Keep its instruments ready. | I am waiting for evidence, not a claim of discovery. | We have not returned evidence for our first question yet. | This returned observation advances our first question. It does not confirm life. | We still owe that question a returned observation. Review what remains possible. |
| Aaryan | The mass margin clears ten percent. Each instrument has a place. | This does not meet the ten-percent proposal rule. We need another configuration. | The go decision preserved the margin we committed to. | The record shows a go decision below our mass-margin rule. | Keep capability changes in the engineering record as they happen. | We cannot recover a missing margin by hiding a damaged capability. |
| Houssam | Generation, loads and reserve are accounted for. | The plan has already required a safe-mode sol. Let us preserve the remaining work. | No safe-mode sol is on the record. Keep watching the activity ledger. | Safe mode is part of this mission's history. Recovery still needs an energy balance. | We have kept the planned work inside the available energy. | Use the recovery sol carefully. Charging takes simulated mission time. |
| Huzaifa | Every planned product has a return path. | The data-loss record needs to stay visible in this plan. | The link plan is ready. Collection and return are separate achievements. | Some observations have been lost. We will not credit missing evidence. | Reorder the queue; a missed pass can leave data waiting safely. | Keep the surviving observations moving. Dropped data cannot earn science credit. |

Branch predicates are the literal §7 measures: actual accepted-risk consequence; any terrain-limit crossing; any returned top-objective data; all go decisions meeting10%; any safe-mode sol; any dropped observation. Until a go decision exists use the currently reviewed mass check for Systems. Before any top-objective data returns, the Astrobiologist's literal predicate is false, so A/B use the waiting/Strained lines; do not fabricate prelaunch science to display Kept. This wording makes the literal rule playable without a new scientific result. If narrative wants a different pre-return predicate, request a separate explicit exception.

At S8 render six domain result lines using these templates: Kavi “Accepted risks caused {count} recorded consequences”; Lautaro “Terrain limits crossed: {count}; mobility: {state}”; Rihabe “Returned evidence for top objective: {fraction}; completion: {state}”; Aaryan “Minimum go mass margin: {percent}”; Houssam “Safe-mode sols: {count}; longest zero-energy run: {count}”; Huzaifa “Returned {Mbit}; dropped {Mbit}; unreturned {Mbit}”. Follow each with its Kept/Strained label. The player's fuller paragraph joins their preparation decision, actual launch/landing consequence, surface decision and final domain result using cause IDs; never infer an event from a prewritten dramatic line.

Proposal, order and coach content uses the live numbers rather than new dialogue rules. Proposal: “{choice} gives {margin}; it preserves {objective access}. Accept, revise or take over.” Infeasible: “No compliant proposal: {constraint}, short by {quantity}. Change {available choice}.” Order: “{requested action} addresses {check}; refusing leaves {documented consequence}.” Reply: “Applied {action}; the recomputed margin is {margin}.” A rejected counter says why it is unsafe. C1–C9 retain the exact GAMEPLAY triggers, skippable overlays, spotlight and help behavior; their explanation uses selected site/objectives, payload, reserve, link, vehicle, risks, live controls and report. Tutorial copy and these story lines must not count as scored hints.

### Original proposal, order and coach copy for later integration

Each template substitutes the authoritative evaluator's current values; unresolved values display “not yet specified,” never a plausible-looking invented number. A proposal appears only after its feasibility predicate passes.

| Seat | Domain proposal / explanation template |
| --- | --- |
| Kavi | “{choice} leaves {redCount} failed checks. Here is the remaining constraint before we call go.” |
| Lautaro | “{site} offers {compatibleTargets}. The planned route avoids {hazard}; the alternative adds {distance} metres.” |
| Rihabe | “{instruments} can investigate {rankedObjectives}. These observations support potential biosignature context, not a claim of life.” |
| Aaryan | “{vehicle} carries {launchMass} kg with {margin}% margin. This proposal meets the ten-percent rule.” If none: “No compliant proposal fits this vehicle. We need {deficit} kg less launch mass or another vehicle.” |
| Houssam | “At {reserve}% reserve, this schedule uses {load} Wh against {generation} Wh generation. {action} keeps the confirmed plan feasible.” |
| Huzaifa | “{relay} provides {available} Mbit for {planned} Mbit. Put {priorityProducts} first; the ledger shows what will wait.” |

| Order | Original delivery template; choices remain Obey / Counter / Refuse |
| --- | --- |
| Director → red-check owner | “Resolve {check} before go. If you keep it, the documented consequence is {consequence} and requires your explicit risk acceptance.” |
| Systems → Astrobiologist | “Mass margin is {margin}%, below ten. Remove {proposedInstrument} or counter with a change that meets the same rule.” |
| Power → biggest-load owner | “This plan leaves {energyMargin}% energy margin. Cut {loadActivity}; the revised forecast is {revisedMargin}.” |
| Comms → Astrobiologist | “Available return capacity is {capacity}. Choose the observations to send first; the remaining products will wait if you obey.” |
| Astrobiologist → Power | “The unusual-rock examination needs {sampleWh} Wh. The forecast permits it; return its products to earn the objective contribution.” |
| Geologist → Power | “The planned crossing exceeds {terrainLimit}. The safe detour needs {detourWh} Wh more.” |

Refusal text names only the documented matching consequence. A counter is accepted only after a fresh valid check; neither dialogue nor a character animation can override the evaluator. These are authored variants of the existing order table, not additional orders or reward opportunities.

| Coach | Exact existing trigger/action retained | Original explanatory line |
| --- | --- | --- |
| C1 | S1 seat screen; choose seat | “Choose your decision role. The other five specialists propose from the same mission limits.” |
| C2 | First bot proposal/team review | “Accept this proposal, ask for a revision, or take over. Orders can be obeyed, countered or refused; bots never accept a failed check for you.” |
| C3 | S2 objective ranking | “Your first, second and third objectives carry half, three-tenths and two-tenths of the science weight. Returned evidence determines the fraction earned.” |
| C4 | S3 first instrument added | “Watch mass, power, data and cost change. Margin is limit minus demand; under ten percent is amber, and a failed check is red.” |
| C5 | S3 voluntary red-check preview | “Preview one failing check and its fix. This demonstration does not change your loadout.” |
| C6 | S4 go/no-go | “Fix the check, remove a load, or explicitly accept its stated consequence. Read that consequence before confirming.” |
| C7 | S5/S6 result | “{actualCheckAndResult} produced this result. The cinematic presents that decision; it does not roll for an outcome.” |
| C8 | First surface sol | “Allocate this sol's work and keep the reserve visible. Drive with WASD or arrows, use E at a compatible target, then choose End sol. Driving spends the allocated energy; a wall-clock timer does not end your turn.” |
| C9 | First event, then S8 | “This event was scheduled. In the report, follow the decision, check and consequence beside the score breakdown.” |

The S0 three-line wording remains GAMEPLAY's exact “You choose. The numbers decide. The report tells you why.” The copy above does not waive the ≤90-second onboarding target: prompts are skippable, never hold input, and do not count toward teamwork. Their reading time, placement and first-sol interaction still need the specified human QA.

Station help uses the same domain sentence and live check as its proposal. Glossary draft: **margin**—limit minus demand; **reserve**—selected battery energy kept available; **sol**—one Martian mission day; **safe mode**—the specified protective operating state; **accepted risk**—a failed check the player knowingly allows with its stated consequence; **relay pass**—an available contact opportunity; **relay orbit**—the selected relay scenario; **areostationary**—an ideal equatorial orbit matching Mars's rotation; **tier**—the breadth of objectives with eligible returned data; **budget**—the approved cost limit including fixed and selected expenses. Help can reopen dismissed prompts; tutorial replay resets its seen flags without changing a mission rule.

Required voice is explicitly the **launch-failure crew reaction** (§5), not a mandate that every line be voiced. Proposed minimal script for Kavi: “Launch failed. The accepted payload limit was exceeded. We have one redesign attempt.” Display the exact computed kg/cause alongside it; the successful retry reaction is “The redesign meets the locked launch check. Keep the first failure in our record.” GAMEPLAY requires the retry to end in launch; no second-failure branch is introduced. Only play the matching actual cause. Obtain a consenting team voice performer and written permission for game distribution, retain transcript/source recording/credit, and verify playback, subtitles, mute/skip and no blocked progression. No real-person voice imitation or NASA-recording attribution. No recording or rights clearance occurred in this task; text alone does not satisfy voice delivery.

## 11. Implementation sequence and acceptance gates

Safe work can continue on pure contracts with injected inputs, provenance rendering, immutable cause/review records, deterministic sorting, save serializers, and already-settled boundary tests. Do not hardcode the candidate values as defaults before approval. The already isolated budget evaluator remains authoritative for costs.

Smallest next gameplay implementation after A01 approval: an isolated observation/storage/transmission reducer, independent of stores/rendering, with F04–F06/F12 tests and no UI integration. Proposed new files `src/engine/scienceData.ts`, `scripts/test-science-data.mjs`; existing consumer boundaries later `gameStore.ts`, `marsStore.ts`, `MarsWorld.tsx`, `missionFailure.ts`, `MissionReport.tsx`. Require conservation, atomic loss, partial return, idempotency and save round-trip before connecting a scene. Do not integrate U1 alone into a score path that still credits scans.

Then approved scenario data and pure landing/energy evaluators; then one authoritative sol reducer; then objective/scoring evaluation; finally save/presentation integration and measured human validation. Existing files needing later changes are identified by topic above, plus `src/data/sites.ts`, `src/data/vehicles.ts`, `src/data/scienceTargets.ts`, `src/nasa/data.ts`, `src/nasa/engineering.ts`, `src/engine/preparation.ts`, `src/game/LaunchCenter.tsx` and `src/ui/crew/PreparationHub.tsx`. This is a roadmap, not authorization to edit them now.

Acceptance must include actual production gameplay tests for all six seats, Guided/Skip and Quick/Explore parity, live rover interaction, stationary science, three event paths, complete cause chains and exact resume. Reference arithmetic cannot certify the 6–10-minute experience or low-end-PC performance. Three.js, the approved visual identity, immersive world interaction and golden-ratio-informed composition remain presentation constraints; none may alter a scientific calculation.
