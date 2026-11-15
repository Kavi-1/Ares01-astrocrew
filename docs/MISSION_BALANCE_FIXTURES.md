# Deterministic mission balance fixtures

Reviewed 2026-11-15, HEAD `17dddad1ef31439a5a72ffd72d76e235bfb8d66e`. These are **reference specifications and independently calculated candidate fixtures**, not evidence that the current game implements them. Proposed inputs require the approvals in [OWNER_APPROVAL_ITEMS](OWNER_APPROVAL_ITEMS.md). The companion [engineering decisions](ENGINEERING_DECISIONS_U1_U11.md) define contracts and [provenance register](SCIENTIFIC_PROVENANCE_AND_EQUATIONS.md) identifies sources.

Status meanings: **PASS—REFERENCE** means the included independent calculation/assertion ran; **CONDITIONAL** means arithmetic passes but its assumptions or integration remain unapproved; **SPECIFIED, NOT EXECUTED** means a future behavior test is described; **BLOCKED** means the expected physical/game result cannot honestly be established. No browser, GPU, FPS, actual six-seat playthrough or human pacing test was performed in this task.

## 1. Common inputs and numerical method

Costs are the existing integer USD-million table: fixed2155, instruments `[40,55,50,50,30,45,30]` in canonical order `[mastcam-z,supercam,sherloc,pixl,meda,moxie,rimfax]`; vehicles120/180/245; relays0/80/140; budget2700. Proposed effective capacities1200/1500/1550kg; relay masses0/75/350kg. Empty-instrument rover973.165kg; selected masses `[4,10.6,4.72,6.915,5.5,17.1,3]`. These mass reconstructions inherit the conservative RIMFAX bound and residual assumption.

Energy: T=88775s, baseline75W, initial charge2408Wh, reserve40%, age0 at landing. MMRTG start-of-sol power is `110*exp(-ln(110/72)/17 * (sol-1)*88775/(365.25*86400))`. Use fixed logical schedule intervals and `sqrt(.9)` charging/discharging efficiency. No temporal randomness; no seasonal multiplier. Distance uses the existing force equation with g3.73, Crr.15, drive efficiency.5, selected rover mass, flat reference routes and .042m/s scheduling speed. The E1 blocked path is never traversed in the successful fixture.

Data: decimal Mbit, integer-byte products; buffer5760Mbit. Radio has no additional energy debit because baseline already includes it. Contacts are end-sol logical service. Prioritize objective prerequisites ahead of background survey products during E2. No observation contributes to two completion units, and no fragment earns a unit. O3 E2=900Mbit is **A05b conditional**, not a verified orbital calculation.

All assertions use independent input literals, Python standard-library exact Fraction arithmetic where applicable and Float64 for exp/trigonometry/energy integration. No game calculation function is imported. Fixed expected results are separate literals or exact identities; generated iteration is used to enumerate configurations, not to bless a function's own output. The executable reference appears in §8 for reproducibility.

## 2. Exhaustive configuration balance

**PASS—REFERENCE / CONDITIONAL on A02+A05:** all128 instrument subsets ×3 vehicles ×3 relays =1152. Counts below are configuration checks, not full mission outcomes; objective access, landing/site, energy, science schedule and score are separate constraints.

| Vehicle / relay | Configurations | Launch mass fits | Systems ≥10% | Budget fits | Mass + budget fit | Systems + budget fit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Light/O1 |128|128|128|128|128|128|
| Light/O2 |128|128|88|128|128|88|
| Light/O3 |128|0|0|127|0|0|
| Medium/O1 |128|128|128|128|128|128|
| Medium/O2 |128|128|128|127|127|127|
| Medium/O3 |128|128|67|117|117|67|
| Heavy/O1 |128|128|128|128|128|128|
| Heavy/O2 |128|128|128|115|115|115|
| Heavy/O3 |128|128|128|72|72|72|
| **Total** |**1152**|**1024**|**923**|**1070**|**943**|**853**|

The earlier candidate Medium1300 was rejected: core+O3 would need Heavy and cost2710, over budget. At1500, core+O3 costs2645 with10.38% margin. Heavy1550 admits full+O3 with≥10%, but its2840 cost triggers the documented20-sol consequence. These are explicit trade-offs, not invented NASA service capacities. O1/all-seven/Heavy remains exactly2700 as required by B01–B05; O2/O3 versions remain2780/2840.

## 3. F01/F08/F11 — feasible baseline, normal30-sol mission and six-seat full score

**PASS—REFERENCE / CONDITIONAL** on A01–A06/A08/A09. TutorialSkip and Quick presentation with explicit review, SiteJezero, W1, Light, O2, UHF, core `{mastcam-z,sherloc,pixl,meda}`, reserve40%, budget2700; rank B first, G second, E third. Core rover994.3kg; launch1069.3kg; margin10.8916667%; cost2525; landing demand1024.129kg-equivalent ≤1125. No accepted risks; one normal launch and landing. All three required scientific capabilities are present.

### Exact proposed itinerary and product association

Drive sols2,5,8,12,16,19. Normal route300m each; E1sol5 reroutes an extra40m, totaling1840m. Before crossing31°/.45m, stop and choose the safe detour. E2sol12 removes O2 slot2. D12sol8 examines the unusual rock. All other sols remain legitimate planned science/communications sols, not extra live-driving targets.

| Objective unit | Acquisition sol / target | Distinct prerequisites that must return |
| --- | --- | --- |
| G1 |2 / outcrop-1|MZ:s2 + PIXL:s2|
| G2 |5 / outcrop-2|MZ:s5 + PIXL:s5|
| G3 |12 / outcrop-3|MZ:s12 + PIXL:s12, prioritized during E2|
| G4 |16 / outcrop-4|MZ:s16 + PIXL:s16|
| B1 |3 / rock-1 at first stop|SH:s3:block1:products1–4 + PIXL:s3|
| B2 |8 / unusual-rock|SH:s8:sample:products1–4 + PIXL:s8:sample|
| B3 |17 / rock-3 at fifth stop|SH:s17:block1:products1–4 + PIXL:s17|
| B4 |19 / rock-4 at sixth stop|SH:s19:block1:products1–4 + PIXL:s19|
| E1–E10 |sols1–10|one distinct MEDA:sol product each|

A stationary follow-up sol3 or17 uses a reachable feature at the current stop, not teleportation. All other acquired science products are distinct planned survey/context data; they do not create extra objective points. Relabeling or resending a product cannot complete another unit.

Normal enriched plan each sol: SHERLOC6h (24products), PIXL2h, Mastcam.5h, MEDAT/4h overlapping as specified. Data2164.8Mbit; baseline-inclusive load2305.782986Wh. Core300m drive adds92.718475Wh;40m adds12.362463Wh.

On sol8 the initial D12 proposal adds98.8Wh/334.8Mbit. With the drive it would use2497.301461Wh, prompting the Power hint for <10% energy margin. The player **acts**: remove routine SH blocks5 and6 (97.6Wh,637.6Mbit). Keep routine blocks1–4, the additional sample block's four products, and both distinct PIXL activities. Revised sol8 data1862.0Mbit; load2399.701461Wh. The sample remains scientifically complete. This is a real reviewed workload change, not a fabricated “acted” flag.

For the interval-energy proof: SH runs first for6h (4h on sol8), then PIXL2h, then Mastcam.5h; MEDA runs over the firstT/4h. Drive, if scheduled, follows at.042m/s. Sol8's extra SH1h and PIXL2h follow the drive. Baseline runs throughout. This conservative ordering fits every sol, respects sequential arm work, checks peak sums, and leaves ample reserve. Different cinematic speed does not alter these intervals.

### Measured reference results

| Quantity | Independently calculated expected result |
| --- | ---: |
| Mission duration |30sols|
| Total delivered load |69,743.362896667Wh|
| Total generation with stated decay sampling |81,294.387425922Wh|
| Minimum stored battery |2,209.598115818Wh (above40% reserve963.2Wh)|
| Final stored battery |2,408Wh|
| Conversion loss |634.223586824Wh|
| Curtailed generation |10,916.800942432Wh|
| Collected and returned science data |64,641.2Mbit|
| Available O2 capacity |85,440Mbit =30×2880−960|
| Largest pre-service queue |2,409.6Mbit (within5760)|
| E2sol12 end backlog |244.8Mbit; next-sol return2409.6 clears it|
| Final dropped / unreturned |0 /0Mbit|
| Final objective fractions (B,G,E) |1,1,1|
| Mass / energy / data utilization |89.108333% /85.791117% /75.656835%|
| Budget utilization |93.518519%|
| Category scores |30performance +30science +15efficiency +15decisions +10teamwork =**100**|

Energy conservation includes curtailed generator surplus; initial+generation equals final+delivered+loss+curtailed. Do not compare delivered load directly to battery change and call the difference an unexplained loss.

### Six-seat records required for the100-point witness

The initial reviewable draft uses the core payload, Medium/O2 and Columbia Hills. The budget hint is shown/read and followed by changing Medium to Light (2585→2525); the landing hint is shown/read and followed by changing Columbia to Jezero (1113.616→1024.129kg-equivalent). Final budget margin6.481481% and landing margin8.966311% remain below10%, but the requested feasible improvements were performed. Keep those warnings and their existing opportunity IDs through final review; do not silently require an unspecified10% landing or budget minimum.

For every seat, the player explicitly reviews D4/D5/D6/D9 with live margins and confirms all30 relevant D11 plans. A takeover or explicit review is allowed even when a bot authored a different seat's proposal; blind team-plan acceptance is not used. All budget, landing, E1/E2 and Power-sol8 hints are shown, read and acted upon. Canonical keys merge the matching E1 or E2 order into the same opportunity rather than double counting.

| Seat | Required distinctive recorded action | Relevant shown/read/acted opportunities | Expected score |
| --- | --- | ---: | ---: |
| Kavi | Review go/no-go and each cross-domain decision |5/5/5|100|
| Lautaro | Choose and confirm the E1 detour; review other checkpoints |5/5/5|100|
| Rihabe | Take D12; prioritize G3's returned products for E2; matching Comms order deduplicated |5/5/5|100|
| Aaryan | Verify10.8917% launch margin; review remaining choices |5/5/5|100|
| Houssam | Revise sol8, obey Geo reroute and Astro sample orders; Geo order deduplicates its hint |6/6/6|100|
| Huzaifa | Prioritize the E2 queue and confirm capacity; review remaining choices |5/5/5|100|

These are explicit candidate journals tested by the reference scoring contract. The current interface does not yet implement every journal entry; **actual six-seat100-point reachability remains unverified until integration/playtesting**. A separate zero-opportunity scoring test is required; missing logging must never be mistaken for zero legitimate opportunities.

## 4. Failure, recovery, data and boundary fixtures

| ID / status | Exact inputs and checks | Expected consequences and score-relevant record |
| --- | --- | --- |
| F02 — infeasible launch / CONDITIONAL | All7+Light+O3:1375kg versus1200; cost2715; mass deficit175kg, Systems deficit295kg. For an isolated mass case, use core+Light+O3 on JezeroW1 with the typical889.6-Mbit schedule (not the enriched2164.8-Mbit profile):1344.3kg, cost2585, deficit144.3kg. | No safe Systems proposal on Light. Without D9 acceptance cannot launch. Accepting the mass risk causes first launch failure, R1, exact cause and one retry. Core→Medium fixes launch and Systems, costs2645; recheck all risks. Retry ends in launch; original failure persists in final FAILED headline and recovery tier. Transition test specified, not run in game. |
| F03 — hard landing / CONDITIONAL | Core+SuperCam+MOXIE (six instruments, no RIMFAX), rover1022kg, Heavy/O1, ColumbiaHills h.12:1144.64>1125. Cost2670. Typical stationary data952.6<960. | Refusing landing risk requires revision. Explicit acceptance yields exactly mobility lost at S6; normal stationary MEDA/arm observations and link remain. Landing failure forces FAILED regardless of recovered science. Assert one damage record/no reload restoration. |
| F03b — normal/boundary / PASS—REFERENCE | Core994.3×1.12=1113.616 safe. At h.12 exact boundary rover1125/1.12=1004.464285714…kg; exact rational equality passes; +.000001kg (1mg) fails. | Comparison strict above; no rounding-based rescue. If implementation uses integer-gram mass inputs, nearest realizable tests1004.464kg passes and1004.465kg fails; do not pretend the exact rational boundary is an installed payload. |
| F04 — temporary outage / PASS—REFERENCE arithmetic, reducer test specified | O1, no accepted data risk/refusal; sol10 observations A400+B400, capacity0; sol11 C100, capacity960. | First sol stored800/returned0/dropped0; next returns900 and empties queue. E2 cause is waiting, not loss. |
| F05 — accepted loss / PASS—REFERENCE arithmetic, reducer test specified | New cohort A500,B400,C200; A>B>C priority, nominalO1960; explicit accepted risk. | Drop whole C200, retain900. With E2 store900, return0; E2 itself loses0. Without E2 return900. Show why140Mbit numerical excess costs200Mbit indivisible observation. C science0; history retains risk→drop. |
| F05b — refusal / SPECIFIED, NOT EXECUTED | A600+B500, actual960; applicable Comms order. | Obey: returnA600+B360, B140waits. Refuse under A01: whole B500dropped, A600returns; correct cause recorded once. |
| F06 — partial/final return / PASS—REFERENCE arithmetic | A700+B400 with legal queued backlog;960capacity. Final-sol separate case A960+B8. | First Acomplete/B260returned+140pending; next140completes B once. Final case leavesB8 unreturned, not dropped; no sol31/21. Bytes alone do not create science credit. |
| F07 — deficit/safe mode / CONDITIONAL, transition test specified | Planned negative-net sol at B1000Wh; alternative nondeficit plan exactly at40% reserve vs just below; retained baseline75W,110W at age0. | Cut-load option recomputes without charging canceled work. Accept safe mode enters now, skips next sol once; baseline-only interval restores818.799331Wh from empty or to1818.799331Wh from1000 before saturation. Negative-net warning, actual energy, reserve breach and zero counter are separate fields. Exact current/next timing requires A04. |
| F07b — zero counter / PASS—REFERENCE unit contract; physical loss BLOCKED | Committed end-sol readings[0,0,1Wh,0,0,0]. | Counts[1,2,0,1,2,3], loss only at final entry under proposed endpoint rule. These are injected states, not a physically produced healthy-rover trajectory. Baseline safe-mode charging prevents this trajectory at age0; no invented generator fault. |
| F09 — budget override20sol / CONDITIONAL | All7+Heavy+O3, JezeroW1;1375kg,11.2903%margin,1055.75landing index;2840cost versus2700; only budget override. Explicit schedule below. | Horizon20, no invented landing/launch failure. Budget score0; risk→shortened mission cause recorded. All objective products return by sol19. O3E2 interpretation still requires A05b:900Mbit is half capacity, whereas half that sol's1191.6-Mbit cohort is595.8Mbit. |
| F10 — scientifically incomplete / PASS—REFERENCE score arithmetic | At horizon, eligible returned fractions(B,G,E)=(0,1,.5); no§5failure. Five eligible weather days, four Gbundles, no complete Bbundle. | Performance10 (top objective missing, at least one returns); science12. HeadlinePARTIAL. Stored Bfragments cannot change this. Other categories need their own resource/review ledgers, not invented full points. |
| F10b — sample skipped / PASS—REFERENCE score arithmetic | F01 but no unusual-rock bundle; other Bthreeunits returned; fractions(.75,1,1). | Science26.25 instead30; performance remains30 because all3 objectives returned eligible data. SUCCESS headline absent major failure. No D12energy/data; adjust ledger/efficiency rather than subtracting an invented extra penalty. |
| F12 — buffer/save / PASS—REFERENCE capacity arithmetic; save test specified | Occupancy5660,new100Mbit fits5760; one more byte cannot start. Reload B260/400Mbit transmitted. | No automatic deletion or canceled-acquisition debit; resume140pending, same sequence/priorities/cause, no retransmission credit. Mid-scan/motion and crash-atomic snapshots require implementation tests. |
| F13 — feasible/infeasible proposals / PASS—REFERENCE margins, proposal reducer specified | Core+Light+O2 has130.7kg margin≥120; full+Light+O2 margin100kg<120; empty+Light+O3 launch1323.165kg>1200. | First valid; second cannot be offered by Systems despite passing hard mass; third no valid payload adjustment on that vehicle, with243.165kg deficit to10% criterion. Never weaken10%. Tie policy A09 must be approved and tested independent of input ordering. |
| F14 — score boundaries / PASS—REFERENCE | Resourceu=0,.35,.70,.95,.9500001,1; budgetb=0,.95,.975,1,1.000001. | Resource0,2,4,4,0,0. Budget3,3,2,1,0 under A08. Required jump above95% is preserved. Grid bounds and one D11category cap checked. |
| F15 — window/site / PASS—REFERENCE arithmetic in source research; gameplay not tested | Northern lat18, southern−15;Ls0/90/270;obliquity25.19. Siteh.03/.08/.12;128payloads each. | Noon elevations72/82.81/46.81 north,75/49.81/79.81 south. Jezero/NEall128landing-safe;Columbia84safe44hard. Synthetic hazards/illumination snapshots are not real flight predictions. |

F07's negative-net input is an evaluator/transition fixture, not a fabricated NASA operational schedule. A physical example of a proposed long survey plan is SH18h +PIXL2h +Mast.5h +MEDAT/4h +MOXIE1h:3191.382986Wh demand at BOL versus2712.569444Wh supply, a478.813542Wh deficit. Its large data demand is also red; both checks must be exposed. Accepting protective safe mode cancels unexecuted observations, so it must not be represented as actual consumption of the canceled3191Wh. Reserve-only E4 can occur with positive net energy when early loads exceed the chosen reserve; it is a separate acceptance fixture.

### F09 exact20-sol schedule and limitations

Player seat is Kavi. Before go, read the landing warning and change Columbia to Jezero; the landing margin improves from negative to6.155556%, and the same warning remains visible. Use the same six driven sols and40m detour; same core objective product associations through sol19. Core typical profile (two SHblocks), SuperCam .5h daily. MOXIE runs1h only on the14 stationary sols; it is deliberately omitted on the six drive sols to avoid a low-energy-margin plan. RIMFAX operates only while driving:1840m yields1472Mbit and121.693121693Wh radar energy. D12 adds its distinct98.8Wh/334.8Mbit package on sol8. The14 MOXIE runs in20sols are an explicit educational cadence, not the actual instrument's historical operating schedule; warm-up, cool-down and full thermal feasibility remain unverified under A06. No new weather/timing shortcut completes objectives early.

Data total **20×952.6 −6 +1472 +334.8 =20,852.8Mbit**. O3 proposed available capacity20×1800−900=35,100Mbit; all data clears by horizon. Requested/delivered aggregate load **47,397.384510582Wh**, generation **54,215.260394958Wh** with stated decay convention. Maximum pre-service queue1526.4Mbit. Aggregate energy and data checks pass; the embedded script does not independently integrate this20-sol profile's within-sol reserve/peak history. That additional interval check, A05b and full game execution remain required before calling F09 an end-to-end pass.

Score-reference journal: all choices reviewed; D4 and D9 fail the proposed budget-margin predicate, D5/D6/D11 pass (9decision points). Exactly four canonical relevant hint records in this Kavi journal: budget warning read but not followed, landing-site improvement read/acted, E1 reroute read/acted, E2 priority read/acted; teamwork7.5. Houssam would receive an additional sample order, so this is not a seat-independent score. Actual order generation must reproduce this ledger or the score must be recomputed. Resource score is4mass+4energy+3.394839235data+0budget; performance30/science30. Candidate total **87.894839235**, displayed87.89. This is conditional on A08 and the specified journal, not a current game result. A different live opportunity ledger must not be overwritten to force this score.

## 5. What passed and what did not

The independently executed script below contains31,836 successful assertions in the current run: mostly grid bounds and configuration enumeration, plus arithmetic, interval conservation, queue arithmetic and explicit boundary checks. This is **not31,836 distinct gameplay tests**. There are1152 enumerated design combinations and the named fixtures above. Research agents separately checked targeted arithmetic; overlapping checks are not added to inflate this count.

Commands actually executed for numerical validation:

- `python3 /tmp/ares-master/validate.py > /tmp/ares-master/validation.json` — final exit0. The first run stopped on an over-precise mistyped expected delivered-battery literal; corrected independent value is1827.54350536451Wh. A later run stopped on a rounded expected F09score literal; the original three-opportunity arithmetic was5347753/61425; the final four-opportunity journal correctly raises its score to87.89483923483923. These were reference-document harness corrections, not production or test changes.
- Small independent Python/Fraction calculations checked vehicle/site counts, source-unit conversions, sample loads and final score fractions. They did not import production modules.
- The reproducible document extraction command in §8 runs the same reference code. Final recorded outcome and scope verification are in §9.

No production build or old audit suite was rerun: this task changes documentation only, and it does not repeat completed audits unnecessarily. Existing tests passing on different rules would not prove this new candidate is implemented. There is no runtime/compliance/performance claim.

## 6. Remaining blocked fixtures and regression requirements

- A physically realizable three-zero-sol loss with healthy110W/75W safe recovery is BLOCKED. Counter-vector validation does not resolve this.
- O3's short-outage/half-return rule is BLOCKED on interpretation, despite a calculable900-Mbit quota candidate.
- Full NASA Mars-launch capacities, actual landing capability, battery voltage/efficiency/housekeeping, an allocated science buffer, true instrument observation intervals and orbital contacts were not established by public data. Proposed game parameters are labeled assumptions, not missing facts quietly filled in.
- D8's lighting snapshots are calculable; quantitative optical/thermal pass/fail consequences and real Earth-departure mappings are not supplied. Do not invent them.
- Existing mission states, three-zero transition,30/20-sol control, observation reducer, five-category scoring, six-seat journal, exact resume and voiced failure reaction need actual implementation/integration tests. Reference fixtures are acceptance inputs for that work.
- Human tests must still establish6–10minute pacing, clear engineering explanations, meaningful crew decisions and parity across seats/modes. Performance tests must use real measured renderers/hardware; none were run here.

Before any approved integration, run pure unit/property checks, deterministic command replay, saved/resumed versus uninterrupted comparisons, then existing engineering/preparation/budget/loading/model suites and production build. Add live interaction coverage for E1 stop/reroute/cross, E2 waiting/refusal/priority, E4 cut/safe mode, stationary science, D12 sample/move, and report cause chains. Vary rendering FPS and graphic quality without changing any authoritative state or scientific result.

## 7. Source-based educational interpretation

The [NASA Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/), “MDL Disciplines,” describes coordinated subsystem studies of requirements, alternatives, mass, power, data and risk. The [Design and Develop Science Missions webinar](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf), printedpp8,13,18–19, connects mission segments, operations concepts, required data and planned verification. Those inspected ideas are used here to connect an objective to a product, instrument, resource cost, return path and test. They do not certify the proposed numerical balance or constitute a claim that a new in-game lesson has already shipped.

## 8. Reproducible independent reference

Extract the following sole Python block to a temporary file and run it. It imports only the standard library, writes no repository files and does not call the production evaluators:

```sh
python3 - <<'PY'
from pathlib import Path
s=Path('docs/MISSION_BALANCE_FIXTURES.md').read_text()
code=s.split('```python\n',1)[1].split('\n```',1)[0]
Path('/tmp/ares-master-reference.py').write_text(code)
PY
python3 /tmp/ares-master-reference.py > /tmp/ares-master-reference-results.json
```

```python
from fractions import Fraction as F
from itertools import product
from math import exp, log, sqrt, sin, cos, radians
import json

checks = 0
def check(ok, label):
    global checks
    assert ok, label
    checks += 1
def near(x,y,label,tol=1e-8): check(abs(float(x)-y)<=tol,label)
T=F(88775,3600); G=110*T; base=75*T; eta=sqrt(.9)
mass=list(map(F,['4','10.6','4.72','6.915','5.5','17.1','3']))
cost=[40,55,50,50,30,45,30]
vehicles=[(1200,120),(1500,180),(1550,245)]; relays=[(0,0),(75,80),(350,140)]
counts=[0]*6
rows=[]
for cap,vc in vehicles:
 for rm,rc in relays:
  row=[0]*6
  for mask in range(128):
   m=F('973.165')+sum((v for i,v in enumerate(mass) if mask>>i&1),F(0))+rm
   c=2155+sum(v for i,v in enumerate(cost) if mask>>i&1)+vc+rc
   fits=m<=cap; systems=10*m<=9*cap; budget=c<=2700
   flags=[1,fits,systems,budget,fits and budget,systems and budget]
   row=[a+int(b) for a,b in zip(row,flags)]
   check(m>=F('973.165') and c>=2275,'positive fixed costs/mass')
  rows.append(row); counts=[a+b for a,b in zip(counts,row)]
check(counts==[1152,1024,923,1070,943,853],'all 1152 balance counts')
near(G,2712.569444444444,'generation'); near(base,1849.479166666667,'baseline')
near(log(110/72)/17,.02493024981037417,'decay'); near(110*exp(-log(110/72)/17*1.881),104.96075998727093,'decay 1.881yr')
near(2*43*28,2408,'battery');near(2408*.8*eta,1827.54350536451,'delivered')
near(1025*3.73*.15*100/3600/.5,31.860416666666666,'drive')
near((110-75)*float(T)*eta,818.799331238,'safe recharge')
for x,expected in [(0,0),(.35,2),(.7,4),(.95,4),(.9500001,0),(1,0)]:
 def efficiency(u): return 4*u/.7 if 0<=u<.7 else 4 if .7<=u<=.95 else 0
 near(efficiency(x),expected,'efficiency boundary')
def budget_score(u): return 3 if 0<=u<=.95 else 3-40*(u-.95) if u<=1 else 0
for x,y in [(0,3),(.95,3),(.975,2),(1,1),(1.000001,0)]:near(budget_score(x),y,'budget boundary')
for i in range(10001):
 u=F(i,10000)
 check(0<=efficiency(float(u))<=4,'efficiency bounds')
 check(0<=budget_score(float(u))<=3,'budget bounds')
 check(0<=float(15*u)<=15,'decision bounds')
for h,expected in [(F('.03'),0),(F('.08'),0),(F('.12'),44)]:
 failed=sum((F('973.165')+sum((m for i,m in enumerate(mass) if mask>>i&1),F(0)))*(1+h)>1125 for mask in range(128))
 check(failed==expected,'landing subsets')
boundary=F(1125)/F('1.12')
check(boundary*F('1.12')==1125,'landing equality')
check((boundary+F(1,1000000))*F('1.12')>1125,'landing above')
near(F(1022)*F('1.12'),1144.64,'hard landing')
near(F('994.3')*F('1.12'),1113.616,'core safe')
core=F('994.3'); drive300=core*F('3.73')*F('.15')*300/3600/F('.5')
drive40=drive300*F(40,300)
typical=base+F('48.8')*2+25*2+F('17.4')/2+17*T/4
enriched=base+F('48.8')*6+25*2+F('17.4')/2+17*T/4
near(typical,2110.582986111111,'typical');near(enriched,2305.782986111111,'enriched')
near(drive300,92.718475,'core drive');near(drive40,12.362463333333,'reroute')
near(8*F('79.7')+16+148+88,889.6,'typical data')
near(24*F('79.7')+16+148+88,2164.8,'enriched data')
near(F('889.6')+62+240+1,1192.6,'full target data')
near(4*F('79.7')+16,334.8,'sample data');near(F('48.8')+50,98.8,'sample energy')
queue=F(0); acquired=F(0); returned=F(0); occupancy=F(0)
mission_load=F(0); gen_total=0; sol_data=[]
for sol in range(1,31):
 d=F('2164.8')+(F('334.8')-F('637.6') if sol==8 else 0)
 cap=1920 if sol==12 else 2880
 acquired+=d; queue+=d; occupancy=max(occupancy,queue)
 sent=min(queue,cap);queue-=sent;returned+=sent
 check(acquired==returned+queue,'queue conservation')
 check(queue>=0 and occupancy<=5760,'buffer capacity')
 load=enriched+(drive300 if sol in [2,5,8,12,16,19] else 0)+(drive40 if sol==5 else 0)+(F('98.8')-F('97.6') if sol==8 else 0)
 mission_load+=load
 gen=float(G)*exp(-log(110/72)/17*(sol-1)*88775/(365.25*86400));gen_total+=gen
 check(float(load)<=gen*.95,'every reference sol respects energy full-score upper threshold')
 sol_data.append([sol,float(d),cap,float(sent),float(queue),float(load),gen])
check(queue==0 and returned==F('64641.2'),'30sol all returned after acted-on Power advice')
capacity=30*2880-960
uM=float((core+75)/1200);uE=float(mission_load)/gen_total;uD=float(returned)/capacity;uB=2525/2700
def tier(f): return 30 if all(x>0 for x in f) else 20 if f[0]>0 and f[1]>0 else 10 if any(x>0 for x in f) else 0
near(tier([F('.75'),1,1]),30,'breadth not full-completion tier')
near(30*(F('.5')*F('.75')+F('.3')+F('.2')),26.25,'partial objective credit')
near(tier([0,1,F('.5')]),10,'missing top objective')
near(30*(F('.3')+F('.2')*F('.5')),12,'incomplete science')
score=30+30+sum(map(efficiency,[uM,uE,uD]))+budget_score(uB)+15+10
seat_records={}
for seat in ['kavi','lautaro','rihabe','aaryan','houssam','huzaifa']:
 # Same qualified physical mission, different received-order opportunity set.
 opportunities=['director:budget-design','geo:landing-design','geo:E1','power:D11-sol8','comms:E2']
 if seat=='houssam': opportunities.append('astro:D12')
 canonical=set(opportunities+(['geo:E1'] if seat=='houssam' else [])+(['comms:E2'] if seat=='rihabe' else []))
 check(len(canonical)==(6 if seat=='houssam' else 5),'hint/order dedup '+seat)
 teamwork=10*len(canonical)/len(canonical)
 decisions=3*4+3*30/30
 near(teamwork,10,'teamwork '+seat);near(decisions,15,'review checkpoint cap '+seat)
 seat_score=30+30+sum(map(efficiency,[uM,uE,uD]))+budget_score(uB)+decisions+teamwork
 near(seat_score,100,'full score '+seat)
 seat_records[seat]={'reviewed_D4_D5_D6_D9':4,'good_reviewed_D11':30,'eligible_read_acted_opportunities':len(canonical),'score':seat_score}
check(all(.7<=u<=.95 for u in [uM,uE,uD]),'full-score bands')
near(2155+300+245,2700,'budget A');near(2155+300+245+80,2780,'budget B');near(2155+300+245+140,2840,'budget C')
check((30 if 2700<=2700 else 20)==30,'normal horizon')
check((20 if 2840>2700 else 30)==20,'override horizon')
zeros=0;trace=[]
for b in [0,0,1,0,0,0]: zeros=zeros+1 if b==0 else 0;trace.append(zeros)
check(trace==[1,2,0,1,2,3],'zero counter contract only')
for e in [0,F('2408')*F('.4'),2408]:check(0<=e<=2408,'battery bounds')
partial=F(960)-700
check(partial==260 and 400-partial==140,'partial observation')
check(500+400<=960 and 500+400+200>960,'whole observation drop')
check(5660+100==5760 and F(5760)+F(8,1000000)>5760,'storage boundary')
near(2000000*480/1e6,960,'O1');near(3*2000000*480/1e6,2880,'O2');near(500*3600/1e6,1.8,'DTE')
near(1800e6/88775,20275.97859757815,'O3 rate')
check(400+400==800 and min(800+100,960)==900,'F04 outage then return arithmetic')
check(500+400==900 and 200==1100-900,'F05 loss cohort conservation')
check(min(900,0)==0 and 900-min(900,0)==900,'F05 accepted loss plus E2')
check(600+360==960 and 500-360==140,'F05b obeyed priority')
check(600+500==1100 and min(600,960)==600,'F05b refused whole product')
check(960+8-960==8,'F06 final backlog')
near(1000+(110-75)*float(T)*eta,1818.799331238,'F07 safe initial1000')
near(base+F('48.8')*18+50+F('8.7')+17*T/4+300,3191.382986111111,'F07 proposed deficit schedule')
check(F('973.165')+350-F('.9')*1200==F('243.165'),'F13 no compliant Light/O3')
# Explicit interval schedule for the healthy full-score witness; no renderer.
B=2408.; min_b=B; delivered_total=0.; conversion=0.; curtailed=0.
for sol in range(1,31):
 gen=sol_data[sol-1][6]/float(T)
 sh=4 if sol==8 else 6
 acts=[(0.,float(sh),48.8),(float(sh),float(sh+2),25.),(float(sh+2),sh+2.5,17.4),(0.,float(T/4),17.)]
 cursor=sh+2.5
 if sol in [2,5,8,12,16,19]:
  distance=340 if sol==5 else 300
  duration=distance/.042/3600
  drive_w=float(core)*3.73*.15*.042/.5
  acts.append((cursor,cursor+duration,drive_w));cursor+=duration
 if sol==8:
  acts.extend([(cursor,cursor+1,48.8),(cursor+1,cursor+3,25.)]);cursor+=3
 check(cursor<float(T),'schedule fits a sol')
 boundaries=sorted({0.,float(T),*[t for a,b,_ in acts for t in [a,b]]})
 day_delivered=0.
 for start,end in zip(boundaries,boundaries[1:]):
  midpoint=(start+end)/2
  power=75+sum(p for a,b,p in acts if a<=midpoint<b)
  check(power<=900,'schedule instantaneous power')
  generation=gen*(end-start); load=power*(end-start)
  before=B
  if generation>=load:
   surplus=generation-load; accepted=min(surplus*eta,2408-B)
   draw=accepted/eta
   loss=draw-accepted; spill=surplus-draw;B+=accepted
  else:
   withdrawal=(load-generation)/eta
   check(withdrawal<=B,'no unserved witness load')
   B-=withdrawal;loss=withdrawal-(load-generation);spill=0
  near(before+generation,B+load+loss+spill,'interval conservation',1e-7)
  min_b=min(min_b,B);day_delivered+=load;conversion+=loss;curtailed+=spill
 near(day_delivered,sol_data[sol-1][5],'schedule vs independent sol total',1e-6)
 check(B>=2408*.4 and min_b>=2408*.4,'reserve40 respected')
 delivered_total+=day_delivered
near(delivered_total,float(mission_load),'mission activity integration',1e-6)
near(2408+gen_total,B+delivered_total+conversion+curtailed,'mission conservation',1e-6)
# Twenty-sol budget override: all instruments, Heavy/O3, same six routes.
# O3 E2=900 is a proposed interpretation, not validated mission physics.
q20=F(0);returned20=F(0);load20=F(0);gen20=0.;peak20=F(0)
for sol in range(1,21):
 distance=340 if sol==5 else 300 if sol in [2,8,12,16,19] else 0
 d=F('952.6')-(1 if distance else 0)+F('.8')*distance+(F('334.8') if sol==8 else 0)
 load=typical+F('8.95')+(0 if distance else 300)+F(1025)*F('3.73')*F('.15')*distance/3600/F('.5')+10*F(distance)/F('.042')/3600+(F('98.8') if sol==8 else 0)
 load20+=load;gen20+=float(G)*exp(-log(110/72)/17*(sol-1)*88775/(365.25*86400))
 q20+=d;peak20=max(peak20,q20);sent=min(q20,900 if sol==12 else 1800);q20-=sent;returned20+=sent
 check(q20>=0 and peak20<=5760,'20sol queue')
check(q20==0 and returned20==F('20852.8'),'20sol data return')
check(2155+300+245+140==2840 and 2840>2700,'budget override cost exact')
check(1025+350<=F('.9')*1550,'20sol Systems margin')
check(F(1025)*F('1.03')<=1125,'20sol normal landing')
score20=30+30+efficiency(1375/1550)+efficiency(float(load20)/gen20)+efficiency(float(returned20)/35100)+budget_score(2840/2700)+9+10*3/4
near(score20,87.89483923483923,'20sol score proposed record')
result={'assertions':checks,'enumeration':counts,'rows':rows,'core_mass_kg':float(core),'landing_boundary_kg':float(boundary),'load_30_Wh':float(mission_load),'generation_30_Wh':gen_total,'utilization':{'mass':uM,'energy':uE,'data':uD,'budget':uB},'score_each_seat':score,'seat_records':seat_records,'queue_peak_Mbit':float(occupancy),'returned_Mbit':float(returned),'minimum_stored_Wh':min_b,'end_stored_Wh':B,'conversion_loss_Wh':conversion,'curtailed_Wh':curtailed,'override20':{'cost':2840,'returned_Mbit':float(returned20),'load_Wh':float(load20),'generation_Wh':gen20,'available_Mbit':35100,'queue_peak_Mbit':float(peak20),'score':score20},'sols':sol_data}
print(json.dumps(result,indent=2))
```

## 9. Final verification record

The document-embedded Python was extracted exactly as shown and executed on2026-11-15: exit0, **31,836 assertion checks**,1152 enumerated designs and six conditional100-point score records. Its SHA256 is `a33d41d9a908385a073f16cf2d75e6e5d31273bff1f6dc8ea8d4a0b84083495a`. F09's revised Kavi journal returns87.89483923483924; its O3 semantics and within-sol execution remain conditional as stated above.

Verification commands/checks:

- `git status --short`, `git rev-parse HEAD`: four requested untracked Markdown deliverables only; HEAD remains17dddad1ef31439a5a72ffd72d76e235bfb8d66e.
- `git diff --check` plus a separate check of all four untracked Markdown files: no trailing whitespace, unbalanced fences or broken local document links. Untracked-file inspection is necessary because ordinary Git diff alone omits them.
- Python SHA256 comparison against the start-of-task manifest: all268 pre-existing tracked files outside the excluded directories unchanged, including GAMEPLAY, production source, tests and assets. No files in the excluded directories were opened.
- Python GLB JSON-chunk inspection of `public/models/crew/*.glb`: all six lack VRM extensions/embedded animation clips; existing procedural animation source inspected separately. No conversions or asset writes.
- Official/public-source browsing and independent research arithmetic are catalogued in the provenance register. Failed source queries and unknown inputs remain labeled.

No installation, dependency update, production build, browser test, hardware benchmark, deploy, push, merge, history operation or stash operation was performed. The only repository additions are the four requested documents. Documentation/reference checks do not establish that the existing game is compliant.
