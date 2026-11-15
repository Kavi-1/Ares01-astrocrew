# ARES-01

A browser game for the 2026 NASA Space Apps Challenge "Space Mission Design Game". You lead a six-person team planning a Perseverance-class Mars rover mission: pick the science goal, choose instruments, rocket and relay orbit within a real budget, launch, then drive the rover on Mars and send the science home. Every choice trades off mass, power, data, budget and time, and the report explains why the mission succeeded or failed.

Built with React, TypeScript, Three.js, Zustand and Vite. Runs locally, with no account or backend.

## Run

Requirements: Node.js 20.19+ and pnpm.

Run commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev                # start the game at the URL Vite prints
pnpm build              # production build
pnpm preview            # serve the production build locally
```

For npm, use `npm ci` and the equivalent `npm run <script>` commands. Both existing lockfiles are retained.

Add `?visual=v2` to the URL for the improved Mars visuals, and `?quality=low` or `?quality=high` to change graphics quality.

## Checks

```sh
pnpm test:engineering     # NASA engineering and save-game checks
pnpm test:preparation     # crew proposals, navigation and preparation saves
pnpm test:mission-budget  # mission budget fixtures and boundary cases
pnpm test:model-loading   # model download, retry, cache and disposal checks
pnpm exec playwright install chromium
pnpm test:models          # browser, presentation and mission-flow tests
```

Playwright starts its own development server. Set `CHROMIUM_PATH` to use an existing Chromium executable, or `ARES_TEST_PORT` to change the default test port (5176).

## Controls (on Mars)

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` or arrow keys | Drive and steer |
| `Shift` / `Space` | Boost / brake |
| `E` (or **Start Scan**) | Scan a science target when stopped in range |
| Drag / scroll | Orbit / zoom the camera |
| `Esc` | Pause |

In mission control, walk with `W` `A` `S` `D` or the arrow keys (or click the floor), press `E` to talk to the nearest teammate, and click a numbered rover marker to inspect that instrument. On the crew-selection screen, `←` `→` compare seats and dragging turns the selected crew member.

## Repository layout

```text
src/
  data/         Mission, crew, instrument and cost data
  engine/       Mission rules, budgets and preparation calculations
  game/         Game screens, Mars world and screen styles
  models/       3D asset loading, models and crew animation
  nasa/         NASA reference data and engineering equations
  ops/visual/   Terrain, atmosphere, rover details and effects
  store/        Campaign and Mars state
  ui/           Shared components, crew interfaces and design styles
public/         Rover and crew models, portrait images
scripts/        Checks, asset generation, captures and profiling tools
tests/          Playwright browser tests
docs/           Gameplay, science, visual and attribution references
```

The application entry point, package manifests and build/test configuration live at the repository root. Production output is generated in `dist/`.

## Documents

| Document | Contents |
| --- | --- |
| [docs/GAMEPLAY.md](docs/GAMEPLAY.md) | **Source of truth for game rules:** stages, decisions, margin checks, budget, relay orbits, events, crew seats, tutorial, scoring, who delivers what |
| [docs/NASA_ENGINEERING.md](docs/NASA_ENGINEERING.md) | Real Perseverance data, equations and sources, each tagged documented, calculated or assumed |
| [docs/VISUALS.md](docs/VISUALS.md) | UI style, rover, terrain, lighting, camera, Blender model rules, crew characters, audio |
| [docs/SCIENTIFIC_PROVENANCE_AND_EQUATIONS.md](docs/SCIENTIFIC_PROVENANCE_AND_EQUATIONS.md) | Scientific sources, assumptions and research proposals; proposed values are not automatically implemented game rules |
| [docs/SPACE_APPS_CHALLENGE_ALIGNMENT.md](docs/SPACE_APPS_CHALLENGE_ALIGNMENT.md) | Challenge requirements, educational references and the dated alignment review |
| [docs/ASSET_LICENSING_AND_ATTRIBUTION.md](docs/ASSET_LICENSING_AND_ATTRIBUTION.md) | Model and font provenance, attribution and asset licensing records |

These references include design intent and dated research; they do not imply that every proposed feature is implemented. Retired development plans, status reports, audits, patch bundles and verification captures remain available in Git history.

## Ground rules

- **Real versus fiction:** every number is tagged documented, calculated or assumed. Never invent a NASA figure.
- **MMRTG only:** the rover is Perseverance-class; no solar panels.
- **No NASA branding:** no NASA logo, patches or NASA-attributed quotes in the game. The ARES-01 agency, crew and story are fictional.
