ARES-01 — reference-led UI redesign

APPLY TO YOUR EXISTING PROJECT
1. Back up your current project.
2. Copy the src/, tests/, package.json and pnpm-lock.yaml from this ZIP into your project root, replacing only the matching files.
3. Keep your existing public/ models, portraits, scripts/ and other files. None are supplied or replaced here.
4. Run: pnpm install --frozen-lockfile
5. Run: pnpm build
6. Run: pnpm dev

Alternative: apply ares01-redesign.patch from the project root to the same uploaded source revision. Do not apply both methods.

WHAT CHANGED
- Cinematic welcome composition, three numbered functional menu actions, amber selection, right-weighted live rover, responsive layout.
- Interactive debrief desk with an openable dossier and native keyboard-accessible controls. Desk reading changes only local view state.
- Wide charcoal report replaces the cream sheet and left sidebar. Horizontal document sections, cyan success stamp, red incident stripe/stamp, technical headings.
- Failure/abort starts with recorded events, closing record, returned science and event-log facts. No fictional outcomes or causes.
- Return-to-desk restores focus; opening a report focuses its heading. The existing New Campaign callback remains unchanged.
- Space Mono 700 display font added. Existing dependencies keep their original locked versions.

SOURCE SCOPE
Only the nine application/package/test files listed in manifest.json changed. Gameplay, stores, calculations, loading, physics, assets and GAMEPLAY.md are byte-for-byte unchanged from your uploads. No deployment.

PREVIEW
Open preview/index.html for actual browser screenshots at four widths. If local file URLs are blocked by your browser, serve the extracted folder with python -m http.server 5181 and visit http://localhost:5181/preview/index.html.
Welcome captures show the live procedural fallback because public/models/ was not uploaded.
Report/desk previews are explicitly labeled presentation fixtures; these outcomes were not injected into the running game. Production still reads real mission records.
Reference JPEGs are not included or used as shipped artwork.

REPEAT THE FOCUSED BROWSER CHECKS
Use your normal Playwright browser installation, or set CHROMIUM_PATH to an installed Chromium.
pnpm exec playwright test tests/presentation.spec.ts --grep "presentation fixture|report separates|synthetic engineering|missing report|dossier navigation|explicit report|desk opens|failure opens|welcome fallback|capture reference"
pnpm exec playwright test tests/models.spec.ts --grep "hub review launches"

VERIFICATION
- Production build and TypeScript compile: PASS. Existing large-bundle warning remains.
- 14 focused Playwright presentation checks: PASS. Includes all five outcome labels, unavailable results, engineering figures/provenance, state immutability, keyboard focus, desk round trip, 390/820/1366/1440 widths, long strings, reduced motion, and a missing-model welcome interaction.
- Existing launch / drive / abort / open dossier / New Campaign integration journey: PASS (1 test). See verification/journey.log.
- Engineering/preparation/budget/loader Node suites could not run: the uploaded ZIPs omit scripts/test-engine.mjs, scripts/test-preparation.mjs, scripts/test-mission-budget.mjs and scripts/test-model-loading.mjs. Logs preserve these errors.
- Model-dependent suites need your original seven GLBs. No physical GPU/FPS or loading-performance certification is claimed.

The initial development test attempts caught outdated selectors after the report layout change and an overly broad missing-asset route that also intercepted source modules. Those test-harness issues were corrected. The final 14-test run passes.
