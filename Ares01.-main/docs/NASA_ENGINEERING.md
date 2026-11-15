# ARES-01 NASA Engineering Data

The real rover data, equations and sources behind the game (the "Milestone 4" values). Game rules, scoring and budget are in [GAMEPLAY.md](GAMEPLAY.md); rover visuals in [VISUALS.md](VISUALS.md). Implemented in `src/nasa/data.ts` and `src/nasa/engineering.ts`; checked by `pnpm test:engineering`.

**Research date:** 9 Nov 2026. All sources below were retrieved during preparation of this document.

---

## 0. Honesty Legend (read first)

Every number in this document carries one status tag. The UI must display this tag next to each value (badge or tooltip).

| Tag | Meaning |
|---|---|
| **DOC** | Stated in an official NASA/JPL/PDS/NASA-hosted source (URL given). |
| **CALC** | Calculated here from DOC values using a shown equation. |
| **SEC** | Found only in a non-official or secondary source. Use for visuals/flavour, never as a hard rule. |
| **ASSUMED** | Chosen by this spec for gameplay or because no source was found. **Not NASA data.** |
| **UNKNOWN** | No value found. Do not invent one; implement as a configurable placeholder if needed. |

Rules:
1. Never render an ASSUMED or UNKNOWN value without its badge.
2. Never present a CALC value as a NASA specification.
3. Where two NASA sources disagree, both are listed (see "Conflicts" in §3.9). Use the value named "use".
4. Game scoring, funding, reputation, and event mechanics are **game design**, not NASA data, and are out of scope for this document.

---

## 1. Selected Reference Mission and Justification

**Selected: Mars 2020 — Perseverance (MMRTG / radioisotope-powered architecture).**

Why:
- **Best-documented public data set** among current rovers: NASA publishes mass, power, and per-instrument mass/power/data-return tables (S3), plus a JPL press kit covering power and telecom (S1, S5).
- **One consistent power architecture** for the whole campaign: a single Multi-Mission Radioisotope Thermoelectric Generator (MMRTG) charging two Li-ion batteries. No solar-panel assumptions are mixed in.
- **Richest science choice set**: seven science instruments with documented specs, giving real trade-offs (e.g. MOXIE at 300 W vs. RIMFAX at 5–10 W).
- **Heritage coverage**: NASA states Perseverance's power system is identical to Curiosity's (S1), so a Curiosity-class platform can be added later without changing the energy model.

Not selected for the MVP:
- **Spirit/Opportunity (MER, solar):** documented in the PDS (S11) and useful for a solar module, but a different architecture (dust, seasons, night survival). Not used in the game, which is MMRTG-only; never mix solar and MMRTG components in one rover.
- **Curiosity:** a valid second platform ("stretch"). Instrument specs were not collected in this pass (see §13).

---

## 2. Rover Architecture (campaign configuration)

### 2.1 Architecture summary (Perseverance-class)

```
MMRTG (110 W continuous, BOL) ─┬─> Rover power bus ──> avionics/thermal baseline (ASSUMED load)
                               ├─> Li-ion battery pair (2 x 43 Ah) ──> peak demand support (up to 900 W)
                               └─> waste heat via fluid loop ──> keeps electronics warm
Mobility: 6 wheels (52.5 cm), rocker-bogie suspension, individual drive motors
Computer: 200 MHz, 2 GB flash, 256 MB DRAM
Comms:   UHF relay (~2 Mbps to orbiter) | X-band HGA (160–500 bps) | X-band LGA (~10 bps)
Science: Mast (Mastcam-Z, SuperCam, Navcam, MEDA parts) | Arm turret (PIXL, SHERLOC) | Internal (MOXIE) | Underside rear (RIMFAX)
```

### 2.2 What the player can and cannot choose (important design honesty)

Real flight rovers do **not** offer alternative chassis/battery/antenna options per mission. To keep the game scientifically defensible and still interactive:

| Player-facing choice | Real basis | MVP behaviour |
|---|---|---|
| **Platform** | Two documented heritage platforms: Perseverance-class (MVP) and Curiosity-class (stretch). | MVP ships Perseverance-class only. Curiosity-class is a data-driven stub with UNKNOWN fields. |
| **Wheels / mobility** | Wheel redesign is documented (52.5 cm, 48 grousers vs Curiosity 50.8 cm) but they are *platform-specific*, not interchangeable. | Wheel set is shown as part of the platform. Not a free selector. |
| **Battery** | 2 x 43 Ah (Perseverance), 2 x 42 Ah (Curiosity-class, SEC). | Fixed by platform. Player chooses **reserve policy** (ASSUMED parameter), not capacity. |
| **Solar panels** | Not applicable to MMRTG rovers. | **Not shown.** Prevents mixing architectures. |
| **Power management** | Documented fact: MMRTG supplies steady power, batteries cover peaks. | Player picks an **operating profile** (load limits and battery reserve). ASSUMED policy values. |
| **Science instruments** | Seven documented instruments; NASA selected them from 58 proposals (SEC). | Player selects a subset within scenario limits. |
| **Cameras** | Mastcam-Z (selectable science camera); Navcam/Hazcam (engineering, fixed). | Mastcam-Z selectable; engineering cameras always present. |
| **Communications** | All three antennas physically exist on the rover. | Player chooses **per-sol downlink strategy** (UHF relay vs direct X-band). Antenna mass/power are UNKNOWN. |
| **Onboard computer** | Fixed hardware (200 MHz). | Fixed; shown as read-only reference. |

**Optional "What-If Lab" (clearly labelled NON-NASA):** a sandbox switch that lets the player vary battery Ah or add hypothetical parts using the same real equations. All results from this mode show a **"HYPOTHETICAL — not flown hardware"** banner. Not needed for the MVP.

### 2.3 Visual update rules (rover model must react to selection)

Instrument mount locations (documented in S3) and how the rover model shows them are in [VISUALS.md](VISUALS.md) section 3.2.

---

## 3. Component Reference Database

Mission column: **M2020** = Mars 2020 Perseverance, **MSL** = Curiosity, **MER** = Spirit/Opportunity.
Source IDs `S#` refer to §4.

### 3.1 Vehicle

| ID | Parameter | Value | Unit | Mission | Status | Source |
|---|---|---|---|---|---|---|
| R-001 | Rover mass (Earth), incl. arm | 1025 | kg | M2020 | DOC | S2 |
| R-002 | Arm turret mass | 45 | kg | M2020 | DOC | S2 |
| R-003 | Mass-equivalent weight on Mars | 393 | kg | M2020 | DOC | S2 (see conflict C-4) |
| R-004 | Dimensions (L x W x H) | 2.9 x 2.7 x 2.2 | m | M2020 | SEC | S21 (visual use only) |
| R-005 | Curiosity mass | 899 | kg | MSL | SEC | S22 (stretch platform) |
| R-006 | MER rover mass | 185 | kg | MER | SEC | S11 gives ~180 kg incl. science package; S23 gives 185 |

### 3.2 Power

| ID | Parameter | Value | Unit | Mission | Status | Source |
|---|---|---|---|---|---|---|
| R-010 | MMRTG electrical power, beginning of life | 110 | W | M2020 | DOC | S1, S7, S8 |
| R-011 | MMRTG thermal power | 1975 (S8) / ~2000 (S7) | W | M2020 | DOC | S7, S8 |
| R-012 | MMRTG mass | 45 (S1) / 43.6 (S8) | kg | M2020 | DOC | S1, S8 (conflict C-1; use 45) |
| R-013 | Plutonium dioxide mass | 4.8 | kg | M2020 | DOC | S1, S7 |
| R-014 | Estimated end-of-design-life power at 17 years | 72 | W | MMRTG | DOC | S7 |
| R-015 | Fuel half-life | 87.75 | yr | M2020 | DOC | S8 |
| R-016 | Design life | >= 14 | yr | M2020 | DOC | S1, S8 |
| R-017 | BOL system efficiency | 6 | % | MMRTG | DOC | S7 (CALC check: 110/1975 = 5.57%) |
| R-018 | Annual degradation | "a few percent" | — | M2020 | DOC (qualitative) | S1 |
| R-019 | Planning degradation rates used by NASA RPS program | 3.8 and 4.8 | %/yr | MMRTG | DOC | S18 (planning envelope; conflicts with R-014 fit, see C-2) |
| R-020 | Battery count / chemistry | 2 / Li-ion | — | M2020 | DOC | S1 |
| R-021 | Battery capacity (each) | 43 | Ah | M2020 | DOC | S1 |
| R-022 | Battery mass (both) | 26.5 | kg | M2020 | DOC | S1 |
| R-023 | Battery nominal voltage | 28 | V | MSL | SEC | S20 (28 V, 42 Ah; **M2020 voltage: UNKNOWN**) |
| R-024 | MMRTG design bus voltage | 28 (design stage) / 30 (load voltage) | V | MMRTG | DOC | S19-style IEEE abstract S24; S7 (conflict C-3) |
| R-025 | Peak demand during science | up to 900 | W | M2020 | DOC | S1 |
| R-026 | Rover quiescent/housekeeping load | — | W | M2020 | **UNKNOWN** | none found |
| R-027 | Battery depth-of-discharge limit | — | % | M2020 | **UNKNOWN** | none found |
| R-028 | Battery round-trip efficiency | — | % | M2020 | **UNKNOWN** | none found |

### 3.3 Mobility

| ID | Parameter | Value | Unit | Mission | Status | Source |
|---|---|---|---|---|---|---|
| R-030 | Wheel count | 6 | — | M2020 | DOC | S4 |
| R-031 | Wheel diameter | 52.5 (S4) / 52.6 (S25) | cm | M2020 | DOC | conflict C-5; use 52.5 |
| R-032 | Grousers per wheel | 48 | — | M2020 | DOC | S4 |
| R-033 | Wheel material | Aluminium, titanium spokes | — | M2020 | DOC | S4 |
| R-034 | Maximum wheel (drive) speed | 4.2 | cm/s | M2020 | DOC | S12 |
| R-035 | Top speed on flat hard ground | ~152 | m/h | M2020 | DOC | S4 / S12 |
| R-036 | Obstacle capability | 40 | cm | M2020 | DOC | S4 |
| R-037 | Static tilt tolerance | 45 | deg | M2020 | DOC | S4 |
| R-038 | Operational tilt avoidance | >30 | deg | M2020 | DOC | S4 |
| R-039 | Curiosity wheel diameter | 50.8 | cm | MSL | DOC | S4/S25 |
| R-040 | Drive motor torque | — | N·m | M2020 | **UNKNOWN** | One secondary article claims 1000 N·m (S26); **not used** (unverified, likely post-gearing) |
| R-041 | Drive power | — | W | M2020 | **UNKNOWN** | Modelled via CALC (§5.9), not sourced |
| R-042 | Rolling-resistance coefficient on Mars soil | — | — | M2020 | **UNKNOWN** | ASSUMED in §5.9 |
| R-043 | Distance per wheel turn | 1.65 | m | M2020 | SEC | S27 (CALC check: π·0.525 = 1.649 m) |

### 3.4 Onboard computer

| ID | Parameter | Value | Unit | Status | Source |
|---|---|---|---|---|---|
| R-050 | Clock speed | up to 200 | MHz | DOC | S4 |
| R-051 | Flash memory | 2 | GB | DOC | S4 |
| R-052 | DRAM | 256 | MB | DOC | S4 |
| R-053 | Computer power draw | — | W | **UNKNOWN** | none found |

### 3.5 Science instruments (Perseverance)

All from S3 unless noted. Power is as published; duty cycles/durations are **not** published (ASSUMED in §8).

| ID | Instrument | Mount | Mass (kg) | Power (W) | Data return | Status |
|---|---|---|---|---|---|---|
| I-01 | Mastcam-Z | Mast | ~4 | ~17.4 | ~148 Mbit/sol average | DOC |
| I-02 | SuperCam | Mast + body | 5.6 mast + 4.8 body + 0.2 target = 10.6 | 17.9 | 15.5 Mbit/experiment; ~4.2 Mbit/day | DOC |
| I-03 | SHERLOC | Arm turret + body | 3.11 turret + 1.61 body = 4.72 | 32.2 turret; 16.6 body | 79.7 Mbit raw | DOC |
| I-04 | PIXL | Arm turret + body | 4.3 sensor head + 2.6 electronics + 0.015 target = 6.915 | ~25 | ~16 Mbit/experiment; ~2 MB/day | DOC |
| I-05 | MEDA | Mast neck, deck, body | ~5.5 | up to 17 | ~11 MB (period not stated) | DOC |
| I-06 | MOXIE | Internal, front right | ~17.1 | 300 | ~1 h O2 production per experiment | DOC |
| I-07 | RIMFAX | Rear underside | <3 | 5 to 10 | 5–10 kB per sounding location | DOC |

Selected capability figures (DOC, S3):
- Mastcam-Z: 1600 x 1200 px max, ~2 MP, stereo (24.2 cm separation), zoom, 0.15 mm/px to 7.4 mm/px depending on distance.
- SuperCam: chemistry/mineralogy of targets as small as a pencil point from >7 m.
- SHERLOC: Autofocus/Context Imager 10.1 µm/px, WATSON camera 15.9 µm/px, laser spot 100 µm; spectroscopy field 7 x 7 mm.
- PIXL: fine-scale X-ray fluorescence elemental mapping.
- MEDA: wind, temperature, humidity, dust measurements.
- MOXIE: best 12 g O2/h at >=98% purity; 122 g total over mission (S3 text). *Conflict C-6:* the same page's spec table says "up to 10 g/hour".
- RIMFAX: 150–1200 MHz, 15–30 cm vertical resolution, >10 m penetration depth, one sounding about every 10 cm of drive.

Engineering cameras (fixed, always present):
- 20 MP, 5120 x 3840, each <750 g and ~4.5 W (PDS Annex S14). *Conflict C-7:* a secondary article says <425 g (S28); use S14.
- Navcam: mast-mounted stereo pair, 42.4 cm baseline (S14).
- Total of 16 engineering cameras on the mission, 9 for surface operations (S15).

**Mass roll-up (CALC):** sum of listed instrument masses = 4 + 10.6 + 4.72 + 6.915 + 5.5 + 17.1 + 3 (RIMFAX upper bound) = **51.835 kg**. A secondary source (S29) quotes a 59 kg payload; the ~7.2 kg difference is unexplained (cabling, mounts, calibration hardware?). **Do not hide this discrepancy in the UI.**

### 3.6 Communications

| ID | Parameter | Value | Unit | Mission | Status | Source |
|---|---|---|---|---|---|---|
| R-060 | UHF relay link rate (rover to orbiter) | up to 2 | Mbps | M2020 | DOC | S6 |
| R-061 | UHF carrier | ~400 | MHz | M2020 | DOC | S6 (NASA Glenn slide) |
| R-062 | X-band HGA to Earth (34 m / 70 m DSN) | 160–500 / 800–3000 | bps | M2020 | DOC (160–500: S6); SEC (800/3000: S30) | S6, S30 |
| R-063 | X-band LGA to Earth (34 m / 70 m) | ~10 / ~30 | bps | M2020 | SEC | S30 |
| R-064 | Share of science data via UHF | 99.9 | % | M2020 | DOC | S5 |
| R-065 | Orbiter visibility per day | ~8 | min | M2020 | DOC (context: NASA Glenn talk) | S6 |
| R-066 | Antenna mass and power | — | — | M2020 | **UNKNOWN** | none found |
| R-067 | Typical real daily data volume returned | — | Mbit | M2020 | **UNKNOWN** | none found |

### 3.7 Environment (Mars)

| ID | Parameter | Value | Unit | Status | Source |
|---|---|---|---|---|---|
| E-001 | Surface gravity, mean | 3.73 | m/s² | DOC | S9 |
| E-002 | Surface gravity, equatorial (older fact sheet) | 3.71 | m/s² | DOC | S9 archives |
| E-003 | Mean solar irradiance at Mars orbit | 586.2 | W/m² | DOC | S9 |
| E-004 | Perihelion / aphelion distance | 206.650 / 249.261 | 10^6 km | DOC | S9 |
| E-005 | Semimajor axis | 227.956 | 10^6 km | DOC | S9 |
| E-006 | Solar day (sol) | 24 h 39 m 35 s (88,775 s) | s | DOC | S10 |
| E-007 | Irradiance at perihelion / aphelion | ~713 / ~490 | W/m² | CALC | §5.7 |
| E-008 | Typical dust-factor loss on solar arrays | 0.2 (range 0.05–2) | %/sol | DOC | S13 (peer-reviewed) |

### 3.8 MER reference (removed)

The game is MMRTG-only, so the Spirit/Opportunity solar data is not used. The original data is in git history (commit c20aa4d, `ARES01_NASA_ENGINEERING.md`).

### 3.9 Conflicts between sources (display in an "About the data" panel)

| # | Conflict | Decision |
|---|---|---|
| C-1 | MMRTG mass 45 kg (S1) vs 43.6 kg (S8) | Use 45 (JPL press kit). |
| C-2 | Single-exponential fit from S7 (110 W to 72 W at 17 yr, about 2.5%/yr) vs S18 planning rates 3.8–4.8%/yr vs older doc stating ~100 W at 14 yr from a 123 W start | Use the S7 fit (CALC). Show range as "uncertainty". Over a 1–2 Mars-year game it changes power by only a few W. |
| C-3 | Bus voltage 28 V (design) vs 30 V (S7 load voltage) | Use 28 V as ASSUMED for battery energy only. |
| C-4 | "393 kg on Mars" (S2) vs m·g/g_Earth = 1025·3.73/9.81 ≈ 390 kg | Use m·g with E-001; ignore the 393 figure. |
| C-5 | Wheel 52.5 cm vs 52.6 cm | Use 52.5. |
| C-6 | MOXIE 10 vs 12 g/h | Use 12 g/h as demonstrated best, 10 as spec. |
| C-7 | Engineering camera mass <750 g (S14) vs <425 g (S28) | Use S14. |
| C-8 | MMRTG specific power 2.8 W/kg (S7) vs 110/45 = 2.44 W/kg | Do not use specific power; use mass and power separately. |
| C-9 | Operational slope limit: avoid slopes above 30° (S4, R-038) vs 24° in NASA Science's more recent Perseverance driving update | The code uses 24°; GAMEPLAY.md uses 30°. **Team to pick one.** |

---

## 4. NASA / JPL Source Links

Primary (official):
- **S1** JPL Perseverance Landing Press Kit, Power: https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power/
- **S2** JPL Mars 2020 Quick Facts: https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/quick_facts
- **S3** NASA Science, Perseverance Science Instruments: https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/
- **S4** NASA Science, Perseverance Rover Components: https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/
- **S5** JPL Press Kit, Telecommunications: https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/telecommunications/
- **S6** NASA Glenn (SCaN), Mars Perseverance Communications (NTRS): https://ntrs.nasa.gov/api/citations/20210010148/downloads/Mars%20Perseverance%20Communications%202021%20revised.pdf
- **S7** NASA MMRTG Fact Sheet: https://science.nasa.gov/wp-content/uploads/2024/02/mmrtg-factsheet-updated-5-18-20-1.pdf
- **S8** NASA Mars 2020 MMRTG sheet: https://www.nasa.gov/sites/default/files/files/4_Mars_2020_MMRTG.pdf
- **S9** NASA NSSDC Mars Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- **S10** JPL Mars at a Glance: https://www.jpl.nasa.gov/news/press_kits/insight/launch/facts/mars-at-a-glance
- **S11** PDS Atmospheres Node, MER Instrument Host description: https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/MER/spirit/logs/MER2_INSTHOST.pdf
- **S12** JPL Robotics, Mars 2020 mobility: https://robotics.jpl.nasa.gov/what-we-do/flight-projects/mars-2020-rover/m2020mobility/
- **S14** PDS Annex, Mars 2020 Engineering Cameras: https://an.rsl.wustl.edu/help/Content/About%20the%20mission/M20/Instruments/M20%20ECAM.htm
- **S15** Maki et al. 2020, Mars 2020 engineering cameras (Space Science Reviews, open access): https://pmc.ncbi.nlm.nih.gov/articles/PMC7686239
- **S18** NASA New Frontiers 4 workshop, RPS assumptions (Zakrajsek): https://newfrontiers.larc.nasa.gov/NF4/PDF_FILES/02-Zakrajsek.pdf
- **S19** NASA New Frontiers 3 RPS description: https://newfrontiers.larc.nasa.gov/NF3/PDF_FILES/RPS_Descrip.pdf
- **S25** NASA Perseverance wheels page: https://mars.nasa.gov/mars2020/spacecraft/rover/wheels
- **S32** NASA LRV mobility/power analysis (Apollo, wheel-soil power method reference): https://www.nasa.gov/wp-content/uploads/static/history/alsj/19730008090_1973008090.pdf
- **S33** JPL "Next Mars Rover Will Have 23 Eyes": https://www.jpl.nasa.gov/news/next-mars-rover-will-have-23-eyes

Peer-reviewed / educational:
- **S13** Lorenz et al. 2021, *Planetary and Space Science* 207:105337: https://doi.org/10.1016/j.pss.2021.105337
- **S16** Iagnemma, terramechanics for planetary rovers (KISS workshop slides): https://kiss.caltech.edu/workshops/xTerra/presentations1/iagnemma.pdf
- **S17** OpenStax University Physics Vol. 2, §9.5 Electrical Energy and Power: https://openstax.org/books/university-physics-volume-2/pages/9-5-electrical-energy-and-power
- **S30** Review of Mars communications (arXiv 2211.14245): https://arxiv.org/pdf/2211.14245

Secondary / not authoritative (flagged SEC):
- **S20** EE Power on Curiosity hybrid power system (28 V, 42 Ah): https://eepower.com/news/curiosity-rover-features-unique-hybrid-power-system/
- **S21** Perseverance dimensions (encyclopedic summary): https://en.wikipedia.org/wiki/Perseverance_(rover)
- **S22** Curiosity mass (encyclopedic summary): https://en.wikipedia.org/wiki/Curiosity_(rover)
- **S23** MER summary: https://kiwix.lema.org/wikipedia_en_all_mini_2024-02/A/MER-A
- **S24** IEEE abstract, MMRTG design stage (28 VDC): https://ieeexplore.ieee.org/document/1368101
- **S26** Gardner Business Media interview on Perseverance mobility (1000 N·m claim, not used): https://www.gardnerweb.com/articles/engineering-an-autonomous-atvfor-mars
- **S27** Wheel facts (1.65 m per turn): https://3dgo.app/models/printables/1224404
- **S28** Digital Camera World, engineering camera weight claim: https://www.digitalcameraworld.com/news/these-are-all-the-cameras-on-nasas-mars-perseverance-rover
- **S29** RocketSTEM mission overview (59 kg payload): https://www.rocketstem.org/2020/07/20/mars-2020-mission-overview/
- **S31** Smithsonian-hosted MER summary (140 W for up to 4 h): https://sites.google.com/si.edu/ai-mars/mission-to-mars/rovers/mars-exploration-rover

Textbook references without a retrieved URL (verify before citing in the UI): rotational power P = τ·ω and wheel torque (any university mechanics text, e.g. OpenStax University Physics Vol. 1, work and power for rotational motion); Bekker/Wong terramechanics (Wong, *Theory of Ground Vehicles*).

---

## 5. Engineering Equations

Each equation lists: expression, variables, physical meaning, source, assumptions/limits. Symbols are collected in §6.

### 5.1 Electrical power

```
P = V · I                       (EQ-1)
P = I² · R = V² / R             (EQ-1b, resistive loads only)
```
- **Variables:** P power [W], V voltage [V], I current [A], R resistance [Ω].
- **Meaning:** electrical power is the rate at which electrical energy is transferred.
- **Source:** S17.
- **Assumptions/limits:** DC, steady state. Rover loads are switching electronics and motors, so EQ-1 is applied to *average* consumption per activity, not circuit-level behaviour. EQ-1b applies only to resistive heaters.

### 5.2 Energy and unit conversion

```
E = P · t                       (EQ-2)       1 Wh = 3600 J
```
- **Variables:** E energy [J or Wh], P [W], t time [s or h].
- **Meaning:** energy is power integrated over time. For varying power, E = ∫P dt; the game uses piecewise-constant power per activity.
- **Source:** S17 (E = Pt; 1 kWh = 3.6 MJ).
- **Limits:** constant power during each activity.

### 5.3 Subsystem consumption and total electrical load

```
P_load(t) = P_base + Σ_i ( u_i(t) · P_i )                (EQ-3)
E_load,sol = P_base · T_sol + Σ_i ( P_i · τ_i )           (EQ-3b)
```
- **Variables:** P_base baseline load [W] (ASSUMED), P_i documented power of component i [W], u_i(t) ∈ {0,1} on/off (or duty fraction 0–1), τ_i active time of component i in the sol [s], T_sol sol length [s].
- **Meaning:** loads add. Instantaneous peak load must stay within the documented 900 W peak demand (R-025).
- **Source:** summation of EQ-1 loads (S17); P_i from S3/S14.
- **Assumptions/limits:** P_base is **UNKNOWN** in public sources and set as an ASSUMED scenario value. Instrument power values are published ratings; actual draw varies with operating mode. Instrument activity durations τ_i are ASSUMED (only MOXIE's ~1 h is documented).

### 5.4 Power generation (MMRTG)

```
E_gen,sol = P_gen(t) · T_sol                                     (EQ-4)
P_gen(t)  = P_0 · exp( −λ · t )                                  (EQ-5)
λ         = ln( P_0 / P_EODL ) / t_EODL                          (EQ-5b, CALC fit)
```
- **Variables:** P_0 = 110 W (R-010), P_EODL = 72 W at t_EODL = 17 yr (R-014), t elapsed time since beginning of life [yr], λ decay constant [1/yr].
- **Meaning:** an RTG converts steady heat to electricity; output declines as Pu-238 decays and thermocouples degrade. Pu-238 decay alone gives λ_Pu = ln2 / 87.75 yr ≈ 0.0079 /yr (0.79 %/yr, CALC); the remaining decline comes from conversion degradation (consistent with NASA's statement of "a few percent per year").
- **Source:** S1, S7, S8 for inputs. The exponential fit is a **CALC convenience model**, not a NASA formula.
- **Assumptions/limits:** single exponential; NASA planning envelopes (S18) give 3.8–4.8 %/yr in some corners, so show the fit as nominal with uncertainty. "Beginning of life" is fuelling time, not landing; offset between fuelling and landing is **UNKNOWN** here and ignored.

### 5.5 Battery: capacity, stored energy, usable energy

```
E_nom    = N_cells_packs · Q · V_nom                              (EQ-6)
E_usable = E_nom · (1 − SoC_reserve)                              (EQ-7)
E_deliv  = E_usable · η_d                                         (EQ-7b)
```
- **Variables:** N number of battery packs (2), Q capacity per pack [Ah] (43), V_nom nominal voltage [V] (28, ASSUMED for M2020), SoC_reserve minimum state of charge kept in reserve (ASSUMED 0.20), η_d discharge efficiency (ASSUMED √0.90 ≈ 0.949).
- **Meaning:** energy [Wh] = charge [Ah] x voltage [V].
- **Source:** EQ-1/EQ-2 (S17); Q and mass from S1; V from S20 (SEC, Curiosity).
- **Assumptions/limits:** V_nom for Perseverance, DoD limit, and efficiency are **UNKNOWN** (R-023, R-027, R-028). Capacity fade, temperature derating, and discharge-rate effects are ignored.

**State of charge dynamics (per time step Δt):**
```
P_net = P_gen − P_load
if P_net ≥ 0:  SoC ← SoC + ( P_net · Δt · η_c ) / E_nom           (EQ-8, charging)
if P_net < 0:  SoC ← SoC + ( P_net · Δt / η_d ) / E_nom           (EQ-8b, discharging)
SoC clamped to [0, 1]
```
- **Meaning:** surplus from the MMRTG charges the pack; deficits are drawn from the pack. This mirrors the documented architecture (MMRTG charges batteries; batteries cover peaks above MMRTG output, S1).
- **Limits:** no battery power limit is modelled (**UNKNOWN**); the only documented limit is the 900 W peak demand.

### 5.6 Mass budget

```
m_total     = m_fixed_platform + m_MMRTG + m_battery + Σ_j m_instr,j        (EQ-9)
m_margin    = m_allow − m_total                                             (EQ-9b)
m_fixed_platform = m_rover,ref − m_MMRTG − m_battery − Σ m_instr,ref        (EQ-9c, CALC)
```
- **Variables:** m_rover,ref = 1025 kg (R-001), m_MMRTG = 45 kg, m_battery = 26.5 kg, m_instr,j documented instrument masses, m_allow scenario mass allowance [kg] (ASSUMED).
- **Meaning:** simple additive mass accounting.
- **Source:** component masses from S1, S2, S3.
- **Assumptions/limits:** m_fixed_platform is a **calculated residual**, not a NASA allocation. It lumps chassis, suspension, wheels, arm, sample-caching system, avionics, antennas, harness, and thermal hardware (individual masses **UNKNOWN**). The real allowance of the sky-crane landing system is **UNKNOWN**; the 1025 kg flown mass is a demonstrated value, not a published limit.

### 5.7–5.8 Solar power (removed)

Not used: the game is MMRTG-only. The original equations are in git history (commit c20aa4d).

### 5.9 Mobility: speed, torque, power, energy

```
v      = ω · r                                                       (EQ-12)
F_res  = m · g · ( C_rr · cos α + sin α )                            (EQ-13)
F_w    = F_res / N_w                                                  (EQ-13b)
τ_w    = F_w · r                                                      (EQ-14)
P_mech = τ_total · ω = F_res · v                                      (EQ-15)
P_elec,drive = P_mech / η_drive + P_aux,drive                         (EQ-16)
E_drive = P_elec,drive · t = ( F_res · d ) / η_drive                  (EQ-17)
```
- **Variables:** v speed [m/s], ω wheel angular speed [rad/s], r wheel radius [m] = 0.2625 (R-031), m rover mass [kg], g Mars gravity [m/s²] = 3.73, C_rr motion-resistance coefficient [-] (ASSUMED 0.15), α slope angle [rad], N_w = 6 wheels, F_res total resistive force [N], F_w force per wheel [N], τ_w torque per wheel [N·m], P_mech mechanical power [W], η_drive overall drive efficiency (ASSUMED 0.5), P_aux,drive extra power while driving [W] (ASSUMED 0 here; RIMFAX 5–10 W may be added), d distance [m].
- **Meaning:** required tractive force is rolling/compaction resistance plus the gravity component on slopes; torque is force times wheel radius; mechanical power is force times speed (P = F·v, S17).
- **Sources:** P = F·v appears in S17; τ = F·r and P = τ·ω are standard rigid-body mechanics (textbook). Terramechanics background: S16, S32.
- **Assumptions/limits:** C_rr stands in for compaction, sinkage, and flexure resistance, which real terramechanics (Bekker/Wong) model with soil parameters (S16). It is a **lumped ASSUMED coefficient**; real values vary strongly with soil (sand vs. rock). Equal load per wheel, steady speed, no slip, no acceleration, no suspension losses. Motor torque and drive power limits are **UNKNOWN**; the model outputs *required* torque for information, not a pass/fail test.
- **Documented geometric cross-check:** wheel circumference π·D = π·0.525 = 1.649 m, matches the stated 1.65 m per turn (S27, SEC).

### 5.10 Data link capacity

```
D_link  = R_link · t_pass                                             (EQ-18)
t_tx    = D_data / R_link                                             (EQ-19)
```
- **Variables:** D data volume [bit], R_link data rate [bit/s], t_pass link duration [s].
- **Meaning:** a link can move at most rate x time bits.
- **Source:** rates from S6/S30; pass time ~8 min/day from S6.
- **Limits:** assumes the full nominal rate for the whole pass. Real UHF rate varies with geometry and orbiter; pass counts and durations vary (**UNKNOWN** per-sol statistics). Light-time delay is ignored (it affects command latency, not link capacity).

### 5.11 Sol time

```
T_sol = 88,775 s = 24.6597 h                                          (E-006)
```
Used to convert power to energy per Mars day. Source: S10.

---

## 6. Variable Definitions and Units

| Symbol | Meaning | Unit (SI) | Typical game value | Status |
|---|---|---|---|---|
| P | Power | W | see tables | — |
| V, I, R | Voltage, current, resistance | V, A, Ω | — | — |
| E | Energy | J (UI shows Wh) | — | — |
| T_sol | Sol length | s | 88,775 | DOC |
| P_0 | MMRTG BOL electrical power | W | 110 | DOC |
| P_EODL, t_EODL | MMRTG end-of-design-life power and time | W, yr | 72, 17 | DOC |
| λ | MMRTG decay constant | 1/yr | 0.02493 | CALC |
| Q | Battery capacity per pack | Ah | 43 | DOC |
| N | Number of battery packs | — | 2 | DOC |
| V_nom | Battery nominal voltage | V | 28 | ASSUMED (Curiosity SEC) |
| SoC_reserve | Minimum state-of-charge kept | — | 0.20 | ASSUMED |
| η_c, η_d | Charge/discharge efficiency | — | 0.949 each (round trip 0.90) | ASSUMED |
| P_base | Baseline housekeeping/thermal electrical load | W | 75 | ASSUMED |
| m_total, m_allow | Rover mass, scenario allowance | kg | see §7 | CALC / ASSUMED |
| r, D | Wheel radius, diameter | m | 0.2625, 0.525 | DOC |
| ω | Wheel angular speed | rad/s | up to 0.16 | CALC |
| v | Drive speed | m/s | up to 0.042 | DOC |
| g | Mars gravity | m/s² | 3.73 | DOC |
| C_rr | Motion-resistance coefficient | — | 0.15 (range 0.10–0.30) | ASSUMED |
| α | Slope angle | rad | 0 to 30° | DOC (limit) |
| η_drive | Overall drive efficiency | — | 0.5 | ASSUMED |
| N_w | Wheel count | — | 6 | DOC |
| R_link, t_pass | Link rate, pass time | bit/s, s | see §3.6 | DOC |

---

## 7. Calculation Examples (documented inputs shown)

All examples must pass as unit tests (§12).

### 7.1 Mass budget, full science payload
Inputs: rover 1025 kg (S2), MMRTG 45 kg (S1), batteries 26.5 kg (S1), instruments from S3.
- Instrument sum = 4 + 10.6 + 4.72 + 6.915 + 5.5 + 17.1 + 3 = **51.835 kg** (CALC; RIMFAX at its upper bound).
- Fixed platform residual = 1025 − 45 − 26.5 − 51.835 = **901.665 kg** (CALC, residual only).
- Total with all seven instruments = 1025.000 kg by construction; margin versus ASSUMED allowance = 0.

Example subset (Mastcam-Z + SuperCam + MEDA + RIMFAX): 4 + 10.6 + 5.5 + 3 = 23.1 kg → total 996.265 kg (−28.735 kg versus the full payload).

### 7.2 Daily energy generation
E_gen = 110 W x 24.6597 h = **2712.6 Wh** (9.765 MJ) per sol at beginning of life.

### 7.3 MMRTG decay (fit)
λ = ln(110/72)/17 = **0.02493 /yr**.
At 1.881 yr (≈ one Mars year): P = 110 · exp(−0.02493 · 1.881) = **104.96 W**.
At 14 yr (fit): 77.6 W (note conflict C-2: older documents quote ~100 W at 14 yr from a higher starting point).

### 7.4 Battery energy
E_nom = 2 x 43 Ah x 28 V = **2408 Wh** (voltage ASSUMED). Mass-based pack specific energy = 2408 / 26.5 = 90.9 Wh/kg (CALC, voltage-dependent).
Usable (20 % reserve): 2408 x 0.8 = 1926.4 Wh; delivered to loads at η_d = 0.949 → **1827.5 Wh**.
Peak support: with the documented 900 W peak demand and 110 W generation, battery supplies 790 W → 1827.5 / 790 = **2.31 h** (CALC).
Curiosity-class variant: 2 x 42 Ah x 28 V = 2352 Wh (SEC).

### 7.5 Mobility
Wheel circumference π·0.525 = 1.649 m. Max ω = 0.042 / 0.2625 = **0.160 rad/s = 1.53 rpm**.
Weight on Mars: W = 1025 · 3.73 = 3823.25 N.

| Case | C_rr | Slope | F_res (N) | Torque per wheel (N·m) | P_mech (W) | P_elec at η = 0.5 (W) |
|---|---|---|---|---|---|---|
| Level | 0.15 | 0° | 573.5 | 25.1 | 24.1 | 48.2 |
| Slope | 0.15 | 10° | 1228.7 | 53.8 | 51.6 | 103.2 |

Energy for 100 m on level ground: mechanical 15.9 Wh; electrical 31.9 Wh at η = 0.5. Time at top speed: 2381 s (39.7 min). Electrical cost ≈ 0.319 Wh/m. *All drive figures are CALC with ASSUMED C_rr and η; sensitivity: C_rr 0.10 → −33 %, 0.30 → +100 %.*

### 7.6 Communications
UHF at 2 Mbps for 480 s: capacity **960 Mbit** per sol (theoretical).
Mastcam-Z average 148 Mbit/sol: UHF 74 s; X-band HGA at 500 bps: 296,000 s = **82.2 h**.
SuperCam experiment 15.5 Mbit: UHF 7.75 s; HGA at 500 bps: 31,000 s = 8.6 h.
HGA in one hour at 500 bps = 1.8 Mbit, about 1/533 of the UHF pass capacity (CALC). This is the physical reason science data goes through orbiters (S5: 99.9 % via UHF).

### 7.7 MOXIE energy per run
300 W x 1 h = **300 Wh** (1.08 MJ) per documented ~1 h experiment (S3). At the demonstrated best 12 g O2/h → 25 Wh per gram of O2 (instrument power only, CALC).

### 7.8 Sample sol energy plan (illustrative; durations ASSUMED)

| Activity | Power (W) | Assumed duration | Energy (Wh) |
|---|---|---|---|
| Drive 100 m (level) | 48.2 (CALC) | 0.661 h | 31.9 |
| RIMFAX while driving (upper bound 10 W) | 10 | 0.661 h | 6.6 |
| Mastcam-Z panorama | 17.4 | 0.5 h | 8.7 |
| SuperCam analysis | 17.9 | 0.5 h | 9.0 |
| PIXL scan | 25 | 2 h | 50.0 |
| SHERLOC scan (turret + body) | 48.8 | 1 h | 48.8 |
| MEDA (duty 25 %, 17 W peak rating) | 17 x 0.25 | 24.66 h | 104.8 |
| **Activities total** | | | **259.8 Wh** |
| Baseline 75 W x 24.66 h (ASSUMED) | | | 1849.5 |
| Generation | | | 2712.6 |
| **Net surplus to battery** | | | **603.3 Wh** |

Adding one MOXIE run (300 Wh) leaves 303.3 Wh surplus. The ASSUMED baseline sets how tight this is; see §8.

---

## 8. Assumptions and Approximations

| ID | Item | Value | Why | Replace when |
|---|---|---|---|---|
| A-01 | Baseline load P_base | 75 W | No public quiescent load found. Chosen so the 110 W supply is a real constraint. Tunable 60–90 W. | A JPL/NTRS source for rover quiescent load is found |
| A-02 | Battery voltage | 28 V | Curiosity-class and MMRTG bus design suggest 28 V; M2020 value not retrieved | M2020 battery datasheet found |
| A-03 | Battery reserve policy | 20 % (player may select 20/30/40 %) | Operational policy; real limit unknown | Source found |
| A-04 | Round-trip efficiency | 0.90 | Generic Li-ion assumption | Source found |
| A-05 | Drive efficiency η_drive | 0.5 | Lumps motor, gearbox, slip, controller | Mobility power data found |
| A-06 | Motion-resistance coefficient C_rr | 0.15 (0.10–0.30) | Lumped stand-in for terramechanics | Terrain-specific data or Bekker parameters |
| A-07 | Instrument activity durations | see §7.8 | Not published (except MOXIE ~1 h) | Operations documentation found |
| A-08 | Arm instruments run one at a time | PIXL, SHERLOC sequential | Both mounted on one turret | Documented |
| A-09 | MEDA duty fraction | 0.25 | Only "up to 17 W" published | Source found |
| A-10 | Scenario mass allowance | 1025 kg (flown mass) | Real landing-system limit not published | Source found |
| A-11 | Max drive time per sol | 4 h | Operational limit unknown | Source found |
| A-12 | UHF pass | 480 s/sol | From NASA Glenn "about 8 minutes per day" | Per-sol pass data found |
| A-13 | Antenna power | included in P_base | Not published | Source found |
| A-14 | Engineering cameras | Always on during drives, power ~4.5 W each (S14), included in P_base | Duty unknown | Source found |
| A-15 | Time scale | 1 game sol = 88,775 s of energy accounting | Real | — |

Approximations stated plainly:
- Power is piecewise-constant per activity; no transients or inrush.
- Thermal behaviour is not simulated. The MMRTG's waste heat is real and important (S1) but not modelled; seasonal heater load is folded into P_base.
- Terramechanics is reduced to one coefficient.
- Radio link is a fixed rate over a fixed window.
- MMRTG decay uses one exponential from two published points.

---

## 9. Component Dependencies

```
Platform (Perseverance-class)
 ├─ fixes: wheels (52.5 cm), suspension limits (40 cm obstacle, 30° operational slope), computer, MMRTG, battery
 ├─ requires: MMRTG architecture flag  ──> blocks any solar component
 └─ provides: mounting points {mast, arm turret, internal bay, rear underside}

Instrument ──requires──> mount point
  Mastcam-Z, SuperCam, MEDA     -> mast
  SHERLOC, PIXL                 -> arm turret (sequential use, A-08)
  MOXIE                         -> internal bay; needs 300 W available during its ~1 h run
  RIMFAX                        -> rear underside; measures along the drive track

Energy chain
  MMRTG output (EQ-4,5) ──> power bus ──> loads (EQ-3) ; surplus ──> battery (EQ-8)
  Battery ──> covers load above MMRTG output (limit: 900 W documented peak)

Data chain
  Instrument data volume ──> onboard storage (2 GB flash) ──> link strategy (UHF or X-band) ──> returned science
```

### Component choices and their effect on the mission (grounded)

| Choice | Real-hardware basis | Effect in mission |
|---|---|---|
| Instrument set | Documented mass/power/data per instrument | Determines which experiments exist, total mass, peak load, and data volume per experiment |
| MOXIE included | 300 W, 17.1 kg | Large energy sink; requires reserve in the battery; technology-demonstration objective, not geology |
| RIMFAX included | 5–10 W, ground-penetrating radar, 10 cm sampling | Cheap power; adds subsurface profile data proportional to distance driven |
| Mastcam-Z included | Zoom and stereo, 2 MP | Panoramas and multispectral targets; its ~148 Mbit/sol average sets downlink load |
| Operating profile | Documented 110 W continuous, 900 W peak | Limits concurrent loads and sets battery reserve |
| Downlink strategy | UHF 2 Mbps vs X-band 160–500 bps | UHF returns ~1 Gbit/sol window; direct X-band only suits small packets/commands |
| Platform (Curiosity-class, stretch) | 50.8 cm wheels, 2 x 42 Ah, 899 kg | Slightly lower battery energy and different mass; instrument list **UNKNOWN** until researched |
| Battery capacity (What-If Lab only) | Hypothetical | Operating time scales linearly with E_nom; flagged HYPOTHETICAL |

**Terrain rules grounded in documentation:** obstacles up to 40 cm are traversable; slopes beyond 30° are avoided operationally; static tilt tolerance is 45° (S4). Sand-trap behaviour (as seen on MER, S11 context) is a real hazard but is **not quantified** here: implement as an optional random event with an ASSUMED probability.

---

## 10. Validation Rules

Implement as pure functions returning `{ level: 'error'|'warning'|'info', code, message, status }`.

| Code | Rule | Level |
|---|---|---|
| V-01 | All selected components have `powerArchitecture = "MMRTG"`. Any solar component → error. | error |
| V-02 | `m_total ≤ m_allow` (ASSUMED allowance; show badge). | error |
| V-03 | Each instrument's mount point is available and no mount is double-booked (one mast set, one arm turret). | error |
| V-04 | Planned instantaneous load `P_load ≤ 900 W` (documented peak demand R-025). | error |
| V-05 | Planned `E_gen − E_load,sol ≥ 0` over a sol; if negative → warning "battery will drain". | warning |
| V-06 | Projected SoC never drops below `SoC_reserve` over the sol. | error |
| V-07 | MOXIE run requires `E_deliv ≥ 300 Wh` at start plus MMRTG contribution; else block. | error |
| V-08 | Planned data volume per sol ≤ link capacity of the chosen downlink strategy (EQ-18). | warning |
| V-09 | Drive plan: slope ≤ 30°, obstacle ≤ 0.40 m (DOC limits). Beyond → blocked. | error |
| V-10 | Required wheel torque (EQ-14) displayed; no pass/fail because limit is UNKNOWN. | info |
| V-11 | Any ASSUMED or UNKNOWN parameter used by a result → "Result depends on assumption A-xx" info. | info |
| V-12 | Experiment is only available when the required instrument is installed. | error |
| V-13 | MMRTG output uses decay model; if mission length > 5 Mars years, show uncertainty band (conflict C-2). | info |
| V-14 | Campaign-level consistency: platform, power system, and instrument list belong to the same reference mission. Mixing platforms' instruments → error. | error |

**Pre-launch gate:** a rover can proceed to launch only if V-01 to V-04 and V-06 pass.

---

## 11. Implementation

Implemented in `src/nasa/data.ts` (components, constants, sources) and `src/nasa/engineering.ts` (equations and validation). Every number shown in the game carries its status badge, and an "About the data" view lists the conflicts in §3.9 and the unknowns in §13. The rover model reacts to the instrument selection as described in [VISUALS.md](VISUALS.md).

---

## 12. Acceptance Tests

Tolerances: ±0.01 unless stated.

| ID | Test | Expected |
|---|---|---|
| T-01 | Instrument mass sum (all 7, RIMFAX 3 kg) | 51.835 kg |
| T-02 | Fixed platform residual | 901.665 kg |
| T-03 | `m_total` with all instruments | 1025.000 kg |
| T-04 | `m_total` for Mastcam-Z + SuperCam + MEDA + RIMFAX | 996.265 kg |
| T-05 | Daily generation at t = 0 | 2712.57 Wh (±0.5) |
| T-06 | λ from 110 W → 72 W over 17 yr | 0.02493 /yr (±0.00001) |
| T-07 | MMRTG output at 1.881 yr | 104.96 W (±0.05) |
| T-08 | Battery nominal energy (2 x 43 Ah x 28 V) | 2408 Wh |
| T-09 | Delivered battery energy at 20 % reserve, η_d = √0.9 | 1827.5 Wh (±0.5) |
| T-10 | Peak support time at 900 W demand | 2.31 h (±0.01) |
| T-11 | Wheel circumference | 1.649 m (±0.001) |
| T-12 | Max wheel angular speed | 0.160 rad/s; 1.528 rpm |
| T-13 | Torque per wheel, level, C_rr = 0.15, g = 3.73, m = 1025 | 25.09 N·m (±0.05) |
| T-14 | Torque per wheel, 10° slope | 53.75 N·m (±0.05) |
| T-15 | Drive energy, 100 m level, η = 0.5 | 31.86 Wh (±0.05) |
| T-16 | UHF capacity at 2 Mbps x 480 s | 960 Mbit |
| T-17 | X-band HGA time to send 148 Mbit at 500 bps | 82.2 h (±0.1) |
| T-18 | MOXIE energy per 1 h run | 300 Wh |
| T-19 | Sample sol plan (§7.8) net surplus | 603.3 Wh (±0.5) |
| T-20 | Load of 901 W is rejected by V-04; 900 W accepted | pass |
| T-21 | A solar panel in an MMRTG rover is rejected (V-01) | error code V-01 |
| T-22 | Drive over a 31° slope or 0.41 m obstacle is blocked (V-09) | error code V-09 |
| T-23 | Experiment requiring PIXL is unavailable when PIXL is not installed (V-12) | error code V-12 |
| T-24 | Every rendered numeric parameter has a status badge | snapshot test |
| T-25 | Changing P_base from 75 to 90 W changes the sol net by exactly −15 W x 24.6597 h = −369.9 Wh | pass |
| T-26 | Reloading the page keeps selected components and assumptions | pass |
| T-27 | No UNKNOWN value is used in a pass/fail rule except through an ASSUMED placeholder labelled as such | code review check |

---

## 13. Open Items — Not Found, Not Invented

Do not fill these without a real source. If a value is needed, use the ASSUMED placeholder and keep the badge.

1. Rover quiescent (housekeeping and thermal) electrical load: **UNKNOWN** (A-01).
2. Perseverance battery nominal voltage, depth-of-discharge limit, maximum discharge power, round-trip efficiency: **UNKNOWN**.
3. Wheel motor torque and drive power: **UNKNOWN**. A single secondary source claims 1000 N·m (S26); **not used**.
4. UHF and X-band antenna mass and power consumption: **UNKNOWN**.
5. Instrument activity durations (except MOXIE ~1 h) and duty cycles: **UNKNOWN**.
6. Real per-sol data volumes returned and the real number/duration of orbiter passes: **UNKNOWN**.
7. Mass of chassis, suspension, wheels, robotic arm (excluding the 45 kg turret), sampling/caching system, avionics, harness: **UNKNOWN** (only the residual is calculable).
8. Landing-system maximum rover mass: **UNKNOWN**.
9. Curiosity instrument specifications (ChemCam, Mastcam, MAHLI, APXS, CheMin, SAM, REMS, RAD, DAN, MARDI): not collected. Required before enabling the Curiosity-class platform.
10. MER solar cell efficiency and an integrated daily insolation curve: not collected (only S11 energy-per-sol values).
11. Terrain-specific resistance coefficients and sand-trap statistics: not collected.
12. Sample-caching system power and masses: not collected (not needed for the MVP).

Recommended next research tasks (post-hackathon): fetch the full JPL Perseverance landing press-kit PDF and the Space Science Reviews papers for each Mars 2020 instrument, and the Curiosity MSL instrument pages, to close items 1–9 where possible.

---

*Document status: v1.0. Scientific accuracy takes priority over gameplay. Any later change that adds a number must add a status tag and a source or assumption ID.*
