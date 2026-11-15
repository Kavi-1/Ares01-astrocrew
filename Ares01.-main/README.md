# ARES-01

A browser game for the 2026 NASA Space Apps Challenge "Space Mission Design Game". You lead a six-person team planning a Perseverance-class Mars rover mission: pick the science goal, choose instruments, rocket and relay orbit within a real budget, launch, then drive the rover on Mars and send the science home. Every choice trades off mass, power, data, budget and time, and the report explains why the mission succeeded or failed.

Built with React, TypeScript, Three.js, Zustand and Vite. Runs locally, with no account or backend.

## Run

Requirements: Node.js 20.19+ and pnpm.

```sh
pnpm install
pnpm dev                # start the game at the URL Vite prints
pnpm build              # production build
pnpm test:engineering   # NASA engineering and save-game checks
```

Add `?visual=v2` to the URL for the improved Mars visuals, and `?quality=low` or `?quality=high` to change graphics quality.

## Controls (on Mars)

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` or arrow keys | Drive and steer |
| `Shift` / `Space` | Boost / brake |
| `E` (or **Start Scan**) | Scan a science target when stopped in range |
| Drag / scroll | Orbit / zoom the camera |
| `Esc` | Pause |

In mission control, walk with `W` `A` `S` `D` or the arrow keys (or click the floor), press `E` to talk to the nearest teammate, and click a numbered rover marker to inspect that instrument. On the crew-selection screen, `←` `→` compare seats and dragging turns the selected crew member.

## Documents

| Document | Contents |
| --- | --- |
| [docs/GAMEPLAY.md](docs/GAMEPLAY.md) | **Source of truth for game rules:** stages, decisions, margin checks, budget, relay orbits, events, crew seats, tutorial, scoring, who delivers what |
| [docs/NASA_ENGINEERING.md](docs/NASA_ENGINEERING.md) | Real Perseverance data, equations and sources, each tagged documented, calculated or assumed |
| [docs/VISUALS.md](docs/VISUALS.md) | UI style, rover, terrain, lighting, camera, Blender model rules, crew characters, audio |
| [docs/STATUS.md](docs/STATUS.md) | What is built, what is broken, what is still missing, open team decisions |
| [docs/ARES01_UI_REDESIGN_REPORT.md](docs/ARES01_UI_REDESIGN_REPORT.md) | The ASTROCREW visual system, what changed on each screen, before/after screenshots, test and performance results |

Older plans (the management-game spec, design guide, v2 gameplay plan, visual spec, asset plan, development log and audit) were removed; they remain in git history at commit `c20aa4d`.

## Ground rules

- **Real versus fiction:** every number is tagged documented, calculated or assumed. Never invent a NASA figure.
- **MMRTG only:** the rover is Perseverance-class; no solar panels.
- **No NASA branding:** no NASA logo, patches or NASA-attributed quotes in the game. The ARES-01 agency, crew and story are fictional.
