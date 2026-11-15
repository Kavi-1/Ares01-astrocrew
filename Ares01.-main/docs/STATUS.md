# ARES-01 Status

What exists in the code today, what is broken, and what [GAMEPLAY.md](GAMEPLAY.md) still needs. The full dated development log (`DEVELOPMENT_STATUS.md`) is in git history at commit `c20aa4d`.

## Built and working

**Game flow:** Home → brief role selection → connected preparation hub (science briefing, workshop, readiness review) → Launch → Mars Operations → Mission Report. The hub keeps one room mounted across its stages. Production saves restore the preparation stage, station, configuration, and decision records. Development page loads intentionally start at home.

| Area | What works |
| --- | --- |
| Preparation hub | Walkable room, selected crew avatar, WASD/arrows, click paths, E interaction, Escape, touch controls, and direct station shortcuts. Aaryan owns payload, Houssam power, Huzaifa downlink, and Kavi readiness review. Lautaro and Rihabe explain existing targets and instrument compatibility. |
| Mission Engineering | Fixed Perseverance with seven instruments; clickable inspection markers, camera close-ups, exterior highlights, and previews before applying edits. Power reserve, science cadence, MOXIE scheduling, and UHF/X-band controls use the existing calculator. Panels remain usable without models. |
| Crew proposals | Deterministic proposals for the three implemented control domains. Accept, revise for science/safety/mass, or take over. Proposals cannot fail hard checks, create routine energy deficits, overload the link, or reduce existing target coverage. They recompute when configuration changes; accepted decisions are marked stale when another station changes the plan. |
| Launch | Scripted 3D sequence: pad checkout, countdown, liftoff, ascent, cruise, Mars arrival, deployment. No risk check, rocket choice or orbit choice yet |
| Mars Operations | Procedural terrain, rocks, outcrops, sky and haze. Live driving (controls in the README). Collisions and a 24 degree slope block. 3 geology targets scanned with E; scanning needs SuperCam, PIXL or SHERLOC and costs modeled energy |
| Events | Power deficit, battery reserve reached, data backlog, missing instrument, steep slope. Recovery actions: safe mode, switch to UHF relay, reduce science cadence |
| Report | Five outcomes (full success, partial success, recoverable anomaly, failure, abort), event causes, lessons and NASA source links. Only uplinked science earns points |
| Visuals (`?visual=v2`) | New ground texture, ridge horizon, pebbles, layered outcrops, 48-grouser wheels, wheel dust and tracks, soft cyan beacons, environment reflections, quality setting (`?quality=low` or `high`) |

**Checks:** `npm run test:engineering` covers 60 engineering/campaign checks. `npm run test:preparation` covers 72 proposal scenarios, 36 station paths, migration, preparation persistence, and reset. `npm run test:models` covers browser interactions and the hub-to-launch-to-surface flow.

## Imported assets

The supplied Perseverance model is shared by the workshop and surface implementation, with six wheel pivots and supported exterior-instrument visibility. MOXIE is internal; MEDA has no independent identifiable mesh, so both use clearly labeled inspection markers. Markers remain selectable when hardware is removed.

All six supplied character models load progressively in the hub. The selected character walks, other crew turn toward the player, and procedural bone motion provides gestures. Runtime uniform skinning and duplicate-rig cleanup accommodate the supplied exports; these are not authored animation clips.

## Known limitations

- Crew GLBs are large; initial loading can be noticeable. Controls and fallback geometry stay usable.
- The existing bundle-size warning remains.
- Terrain uses a 24-degree limit while GAMEPLAY.md still describes 30 degrees; that team decision remains unresolved.
- The three current geology targets share instrument compatibility. No distinct site hazards or weighted science-objective effects are invented.

## Not built yet (needed by GAMEPLAY.md)

| Feature | GAMEPLAY.md reference |
| --- | --- |
| Welcome and tutorial setting, coach prompts, glossary | S0, section 8 |
| Full six-seat decision ownership beyond the existing controls, structured orders, Quick/Explore modes, and seat storylines | S1, section 7 |
| Landing site choice and objective ranking (3 objectives not yet defined) | S2, D2, D3 |
| Budget check and budget bar | Section 4 |
| Launch vehicle, launch window, relay orbit choices; go/no-go checklist with override | S4, D7, D8, D9, D15 |
| Launch and landing results from margin checks; redesign retry and damaged-operations paths | S5, S6, R1, R2 |
| Sol plan before driving, "End sol", "Skip to next target", 30-sol clock | S7, D11 |
| Scheduled events E1 to E4 and the sampling decision | Section 6, D12 |
| 100-point score, tiers, cause chain | Section 9 |
| Authored animation clips, audio, additional environments and dust storms | VISUALS.md sections 4, 7 to 9 |

## Leftover code

The old management game's screens were removed in the UI redesign (`src/ui/App.tsx`, `src/ui/Engineering.tsx`, `src/ui/crew/CrewSelection.tsx`, `ResourceMargin.tsx` and the stylesheets `styles.css`, `nasa-flow.css`, `game.css`, `mission-ui.css`, `crew.css`, `hub.css`). Its data and state are still in the code because the save format and engine tests read them: `src/data/parts.ts`, `techs.ts`, `vehicles.ts`, `sites.ts`, `constants.ts`, `src/engine/economy.ts`, `design.ts`, and old fields in `src/store/gameStore.ts`. Remove them together with a save-version migration.

## Presentation

All screens share one stylesheet system (`src/ui/design/system.css`) and screen-level files (`welcome.css`, `prep.css`, `launch.css`, `surface.css`, `mission-report.css`). See [ARES01_UI_REDESIGN_REPORT.md](ARES01_UI_REDESIGN_REPORT.md) for what each screen shows and which GAMEPLAY.md features still have no interface because their rules are not implemented.

## Not modeled (stated honestly in the report)

Real battery voltage and discharge limits, thermal limits, real Deep Space Network contact windows and data volumes, flight failure probabilities, random failures. Activity durations, baseline load (75 W), UHF pass length and per-target science credit are assumptions, tagged as such.

## Open team decisions

1. Slope limit: 24 degrees (code, newer NASA source) or 30 degrees (GAMEPLAY.md).
2. Source authored animation clips for the supplied GLB crew rigs.
3. Make `?visual=v2` the default.
4. Solo only, or also a pass-the-laptop mode for up to 4 players.
