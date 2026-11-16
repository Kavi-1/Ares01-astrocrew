# ARES-01 — Build the Mission. Bring the Science Home.

**Team ASTROCREW · 2026 NASA Space Apps Challenge · Space Mission Design Game**

ARES-01 is a browser-based Mars mission design game featuring a Perseverance-inspired rover. Lead a six-person virtual crew, make engineering trade-offs, launch, explore Mars and return scientific observations. **Your decisions shape the mission's outcome.**

> **Independent educational project by ASTROCREW.** Not an official NASA product or endorsed by NASA or JPL.

## The challenge

Space mission design balances science against launch capacity, mass, energy, communications, time, cost and risk. ARES-01 makes these trade-offs tangible: a more capable instrument can expand scientific access while increasing resource requirements.

This project addresses the **[2026 Space Mission Design Game challenge](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/)** through an interactive, educational mission simulation.

## Play and demo

- **[Play ARES-01](https://ares01-astrocrew.vercel.app/)** — public browser game; no account required.
- **[View the demo](https://docs.google.com/presentation/d/1zIt9-3P3KQw-xXMPhGbLWeiW11gltPOr/edit?usp=sharing&ouid=103721580173308071919&rtpof=true&sd=true)** — ASTROCREW's presentation.
- **[Source code](https://github.com/Kavi-1/Ares01-astrocrew)** — this repository.

The demo covers gameplay, engineering, teamwork, NASA references and technology.

## Meet Team ASTROCREW

ARES-01 is an **original project conceived, designed and directed by ASTROCREW**. The six in-game crew characters represent the team members:

| Team member | In-game crew representation |
| --- | --- |
| **Rihabe Ouabine** | Rihabe |
| **Kavi Lu** | Kavi |
| **Choubik Houssam** | Houssam |
| **Muhammad Huzaifa Saqib** | Huzaifa |
| **Aaryan Shlok** | Aaryan |
| **Lautaro Leguizamon** | Lautaro |

## What players do

1. **Choose a role.** Join five rule-based teammates whose specialties shape their proposals.
2. **Define the science.** Choose Jezero, Northeast Syrtis or Columbia Hills and rank geology, potential-biosignature context and environmental objectives.
3. **Design the mission.** Choose from seven Perseverance instruments and balance payload, power reserve, communications, launch vehicle, relay orbit, launch window and budget.
4. **Review engineering margins.** Check calculations, revise plans and make risk decisions where allowed.
5. **Launch and explore.** Reach Mars, plan each sol, drive, investigate targets, operate instruments and choose observations to transmit.
6. **Read the results.** Review science returned, resource trade-offs and decisions in the mission dossier; replay with different choices.

The game defines a **30-sol mission** and a **20-sol variant** for a budget override. Quieter sols can advance automatically. **Guided / Skip** tutorials and **Quick / Explore** pacing support different play styles.

### A mission shaped by engineering

ARES-01 models a Perseverance-class rover powered by an MMRTG. Players balance mass, peak load, battery reserve, science-data volume and relay capacity. The selected reserve (20%, 30% or 40%) is a **protected charge threshold**. Charge follows modeled generation and consumption, and the game distinguishes science **collected** from science **returned to Earth**.

The **$2.7 billion educational budget**, component prices and mission options include game assumptions. See [gameplay specifications](docs/GAMEPLAY.md) for the cost breakdown.

## Controls

| Context | Input | Action |
| --- | --- | --- |
| Mars surface | `W` / `A` / `S` / `D` or arrow keys | Drive and steer when the active sol plan permits movement |
| Mars surface | `Space` | Brake |
| Mars surface | `Shift` | Boost where permitted |
| Mars surface | `E` or **Start Scan** | Examine an eligible target while stopped in range |
| Mars surface | Drag / scroll | Orbit / zoom the camera |
| Mission control | `WASD` / arrows or click floor | Navigate the crew/workshop room |
| Mission control | `E` | Interact with a nearby crew member |
| Mission control | Rover inspection markers | Focus on instruments |

**If the rover does not move:** select **Commit sol plan** when in **Planning** mode. The driving status explains restrictions from mission state, drive allocation, safe mode, damage or terrain.

## Technology

- **React + TypeScript + Vite** — browser application
- **Three.js** — 3D rover, crew, mission rooms and Martian terrain
- **Zustand** — client-side state and persistence
- **Playwright + Node test scripts** — UI, model, mission and engineering checks
- **CSS** — responsive mission-control interface

Gameplay runs entirely in the browser.

## Run locally

**Node.js 24 recommended.** Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite. For a production build:

```bash
pnpm build
pnpm preview
```

For npm, use `npm ci`, `npm run dev`, `npm run build` and `npm run preview`.

## Testing

```bash
pnpm build
pnpm test:engineering
pnpm test:preparation
pnpm test:mission-budget
pnpm test:mission-energy
pnpm test:campaign
pnpm test:tutorial
pnpm test:mobility
pnpm test:model-loading
pnpm test:models
```

Additional browser suites: `test:campaign-ui`, `test:tutorial-ui`, `test:mobility-ui` and `test:presentation`. Install Chromium with `pnpm exec playwright install chromium`, or set `CHROMIUM_PATH` to an existing installation.

## NASA data, educational resources and scientific integrity

ARES-01 distinguishes three kinds of inputs:

| Label | Meaning |
| --- | --- |
| **DOCUMENTED** | A value supported by a cited NASA/JPL source |
| **CALCULATED** | A result derived from stated equations and inputs |
| **ASSUMED** | An educational approximation or gameplay parameter |

The game uses static NASA/JPL engineering references, compiled in [src/nasa/data.ts](src/nasa/data.ts), alongside mission-design research:

- [Perseverance instruments](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/), [power systems](https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power/) and [rover components](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/): instrument mass, power, data volumes, battery and rover specifications.
- [NASA — Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf): mission lifecycle, requirements and mission segments, used in supporting documentation.
- [NASA Goddard — Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/): trade studies and mission architecture, used in supporting documentation.
- [NASA/JPL — Mars 2020 Perseverance rover](https://science.nasa.gov/mission/mars-2020-perseverance/): rover and mission context.
- [NASA — Mars Perseverance Rover 3D Model](https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/): reference content for the adapted rover model.

Further reading: [Engineering equations](docs/NASA_ENGINEERING.md) · [Scientific provenance](docs/SCIENTIFIC_PROVENANCE_AND_EQUATIONS.md) · [Challenge alignment](docs/SPACE_APPS_CHALLENGE_ALIGNMENT.md).

**Educational scope:** Terrain, scenarios, hazard factors, cost allocations and some observation schedules are game models. They are not NASA-validated flight plans. Potential biosignature context does not establish evidence of life.

## Assets, rights and credits

**Team-created assets:** ASTROCREW designed the six crew-character models, original visual assets and game presentation with AI assistance.

**NASA-origin rover:** The adapted model incorporates NASA/JPL-Caltech content matching the official [Perseverance model](https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/). Its intermediate editing history remains under review.

See [asset licensing and attribution](docs/ASSET_LICENSING_AND_ATTRIBUTION.md) for the inventory, third-party notices and outstanding clearance. NASA and third-party assets retain their respective usage terms.

## Originality and AI-assisted production

**The idea and engineering direction are original ASTROCREW work.** The team defined the scientific objectives, directed implementation and reviewed the results.

**OpenAI Codex and ChatGPT** assisted with code, game content, 3D assets, iteration, testing, debugging, deployment and documentation. The team determined how to apply NASA/JPL scientific references.

## Project documentation and current limitations

- [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md) — authoritative gameplay specification.
- [`docs/NASA_ENGINEERING.md`](docs/NASA_ENGINEERING.md) — engineering models and NASA sources.
- [`docs/ENGINEERING_DECISIONS_U1_U11.md`](docs/ENGINEERING_DECISIONS_U1_U11.md) — proposed choices and assumptions, including which require approval.
- [`docs/OWNER_APPROVAL_ITEMS.md`](docs/OWNER_APPROVAL_ITEMS.md) — unresolved decision and approval register.
- [`docs/COMPLIANCE_MATRIX.md`](docs/COMPLIANCE_MATRIX.md) — requirements traceability; its original baseline classifications may predate recent code changes.
- [`docs/ARES01_UI_REDESIGN_REPORT.md`](docs/ARES01_UI_REDESIGN_REPORT.md) — interface changes, screenshots and testing notes.
- [`docs/ROVER_MOVEMENT_FIX_REPORT.md`](docs/ROVER_MOVEMENT_FIX_REPORT.md) — driving and sol-plan interaction repair.

Full mission integration, low-end GPU performance and asset clearance remain subjects of release validation. Older audits describe earlier versions; consult the running build and current tests for present behavior.

---

**ARES-01 · Team ASTROCREW** — Build the mission. Bring the science home.
