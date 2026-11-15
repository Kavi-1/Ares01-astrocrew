# Task 005 — model loading reliability and feedback

Review date: 2026-11-15. Scope: loading lifecycle, cancellation/retry, contextual feedback and resource cleanup only. Baseline: branch `main`, commit `c7b88d752ce7594674ee0e6c38bf636732cb6195`, including the pre-existing, uncommitted Task 004 budget module and audit documents. No history, stashes, deployment or dependencies changed. Neither design-reference directory was inspected.

## Implementation and ownership

The previous loader applied a 30-second deadline to an entire download. It could therefore reject a healthy slow connection. Its three-entry promise cache also mixed ongoing requests with completed downloads. Consumers had no cancellation or granular progress contract, and room/surface failures lacked an in-place model retry.

The loader now uses a **30-second inactivity watchdog**. It starts before headers and resets whenever nonempty data arrives. A connection can take longer than 30 seconds overall; a connection delivering no data for 30 seconds fails with its URL and stall duration. There is no automatic retry loop or new gameplay timing rule. Players explicitly retry failed models.

| Phase | Meaning and feedback |
| --- | --- |
| Waiting | Queued/requested model; crew loads remain sequential. |
| Downloading | Actual bytes received. Percentages require a trustworthy, positive Content-Length; encoded/unknown lengths show received MB. Updates are rate-limited to approximately 10/second, with known-total completion always reported. |
| Preparing | Download finished or cached bytes found; GLB parsing, image decoding and consumer preparation are underway. No invented completion percentage. |
| Ready | Consumer prepared and attached the model, then completed a renderer call with it in the scene. This is render submission, not a guarantee of GPU completion or visibility of every off-screen mesh. |
| Failed/retryable | Useful diagnostic retained/logged; player sees unavailable status and a retry control. Existing procedural rover/station proxies remain usable. |

`loadModel(url, { signal?, onProgress? })` does not declare a model ready by itself. `createCharacterModel` and `createRoverModel` accept the same optional options. Existing callers remain compatible. CrewRoom and MarsWorld retries retain their current scene/canvas; CharacterPreview retains its existing retry-effect architecture.

Ongoing downloads are shared by URL and reference-counted separately from completed bytes. Cancelling one consumer does not cancel another. Cancelling the last consumer removes that request's identity and aborts its fetch. An older completion/failure cannot remove or overwrite a replacement request. Completed bytes use a three-entry LRU with a **40 MiB aggregate cap**; the entry count is unchanged. This cap accommodates the three largest current files and bounds retained bytes. In-flight chunks and transient parse allocations are additional memory, not covered by that cap.

Parsed scenes remain independently owned. There is **no shared parsed/GPU asset cache**, and repeated parsing/crew preparation remains. A failed parse invalidates only its matching cached buffer so retry can obtain fresh bytes. GLTFLoader parsing is not interruptible: cancellation rejects promptly and disposes a late successful result instead of attaching it. Consumer lifetime/attempt guards prevent late application after unmount or retry.

Disposal deduplicates geometries, materials, textures, skeletons and ImageBitmaps within a scene. It includes line/point renderables, closes decoded ImageBitmaps, and preserves independent model ownership. Scene teardown cancels animation work, removes listeners, aborts unused downloads, disposes resources and explicitly releases the WebGL context. MarsWorld now releases material textures as well as geometries/materials.

The room reports the active crew member and ready count alongside rover status. Optional model loading does not block station controls, proposals, mission navigation or procedural rover movement. No loading gate was added to mission progression or the sol clock. The display remains in a loading/preparing state until the foreground model has reached its first renderer call, even if the surrounding scene has already opened.

## Exact files changed by Task 005

| File | Change |
| --- | --- |
| `src/models/assets.ts` | Lifecycle, streaming download watchdog, shared-request ownership, bounded byte cache, diagnostics and safe disposal. |
| `src/models/characterModel.ts` | Optional loading options, cancellation and cleanup around preparation; original normalization unchanged. |
| `src/models/roverModel.ts` | Optional loading options/cancellation; original geometry, wheels and instrument preparation unchanged. |
| `src/ui/crew/CharacterPreview.tsx` | Phase feedback, retry/cancellation and renderer teardown. |
| `src/ui/crew/CrewRoom.tsx` | Per-model feedback, failed-only retry queue, cancellation, readiness after rendering and cleanup. |
| `src/game/MarsWorld.tsx` | Rover phase/retry lifecycle and cleanup; simulation calculations untouched. |
| `src/ui/crew/crew.css` | Small contextual status/retry styles and keyboard focus treatment. |
| `package.json` | Adds `test:model-loading`; preserves the already-present `test:mission-budget`. |
| `scripts/test-model-loading.mjs` | New deterministic lifecycle/network/resource tests. |
| `tests/model-loading.spec.ts` | New browser interaction, retry, cancellation and navigation tests. |
| `scripts/profile-model-loading.mjs` | Reproducible isolated original-model and real-time throttled-download measurements. |
| `scripts/test-model-loading-production.mjs` | Built-application navigation, interaction and teardown measurement harness. |
| `docs/TASK_005_MODEL_LOADING.md` | This implementation/verification record. |

Existing Task 001–004/NASA audit files and the mission-budget source/tests were preserved. Existing `tests/models.spec.ts` was not edited or weakened.

## Measurement method and limitations

Host: Linux, Intel Core i7-12700, 20 logical CPUs, 33,510,207,488 bytes system RAM. Headless Chromium 151.0.7922.34 with ANGLE/Vulkan **SwiftShader**, DPR 1. This is a software renderer on a desktop CPU, **not a real low-end or mid-range GPU**. No 30/60 FPS compatibility claim, average FPS or 1% low claim is made. Actual GPU VRAM and peak GPU process allocations were not available.

Before measurements used the original working-tree source, including the pre-existing Task 004 work. An isolated baseline copy was reconstructed from the original file hashes/read-only Git content; no working-tree restoration occurred. Before and final measurements used the same assets, camera/studio method, browser binary and host. They are individual samples, not statistically established speedups. Runs were sequential to avoid concurrent browser-profile interference. Ordinary downloads use local HTTP and do not represent remote hosting performance.

The isolated harness constructs a 480×640 studio, downloads/parses a model, prepares the crew rig where applicable, attaches the model and renders. It uses `gl.finish()` and a one-pixel readback to measure completion of that frame. This includes shader/texture/geometry initialization and drawing; it cannot isolate GPU upload time. The normal seven-model sequence is followed by rover and Lautaro repeats in the same page. The separate 4 Mbps case uses a fresh context, disabled HTTP cache, CDP throughput of 500,000 bytes/second and 80 ms latency, loading Lautaro's original 16,802,132-byte file. It measures character model preparation without the room animation rig.

### Isolated original-model timings

All times below are milliseconds, rounded to one decimal. Each cell is **before → final**. Ready includes download, GLTF parsing and model/rig preparation; parsing is also listed separately. First frame is cumulative from load start through GPU completion/readback in the isolated studio.

| Model | Download | GLTF parse | Model ready | First frame |
| --- | ---: | ---: | ---: | ---: |
| Rover | 71.5 → 28.9 | 229.5 → 91.3 | 342.5 → 152.2 | 1484.2 → 929.4 |
| Aaryan | 81.1 → 42.4 | 221.4 → 133.3 | 564.0 → 431.3 | 1992.9 → 1722.5 |
| Houssam | 62.6 → 32.5 | 180.1 → 99.7 | 520.5 → 297.0 | 1700.9 → 1570.9 |
| Huzaifa | 37.6 → 34.0 | 101.0 → 101.0 | 299.2 → 321.8 | 1273.9 → 1473.3 |
| Kavi | 37.9 → 44.3 | 101.3 → 178.0 | 313.8 → 577.0 | 1396.8 → 1882.8 |
| Lautaro | 67.6 → 59.4 | 164.1 → 177.6 | 461.7 → 439.8 | 1529.9 → 1488.8 |
| Rihabe | 40.4 → 35.0 | 109.5 → 104.3 | 290.2 → 283.6 | 1406.6 → 1359.3 |
| Rover repeat | 29.7 → 24.8 | 77.1 → 72.1 | 127.2 → 116.4 | 794.8 → 771.8 |
| Lautaro repeat | cached → cached | 177.1 → 172.6 | 609.7 → 626.4 | 1695.2 → 1706.8 |

Some final timings are slower. No universal reduction in loading/rendering cost is established. Both runs perform nine parses; cached bytes still require parsing and preparation. Rover was evicted and downloaded again; Lautaro was retained in both final/baseline sequences. The task does not eliminate every repeated navigation load.

### Actual 4 Mbps reproduction

| Measurement | Before | Final |
| --- | --- | --- |
| Download | Aborted at 30,000.2 ms | Complete in 33,734.2 ms |
| Model ready | Never reached | 33,938.9 ms |
| First frame completed | Never reached | 35,331.2 ms |
| Outcome | `AbortError: The user aborted a request.` despite progress | Original Lautaro model loaded successfully; download and preparing phases remained distinct. |

The baseline instrumentation only receives a completed ArrayBuffer; its aborted record's zero bytes does **not** mean the network transferred zero bytes. The final streaming instrumentation records all 16,802,132 bytes. This demonstrates the fixed false timeout, not accelerated transfer or smaller models.

### Resource counts and repeated navigation

For all nine isolated renders, before/final drawn triangle counts are identical: rover 69,339; Aaryan 53,772; Houssam 50,238; Huzaifa 50,562; Kavi 50,142; Lautaro 58,788; Rihabe 63,940. These are renderer counts for the test scene, not a new inventory of the raw GLB topology. Every isolated disposal reports zero geometries and one renderer-internal texture before renderer/context destruction, in both runs.

Six preview switches (Kavi/Aaryan/Lautaro twice) verify one live renderer, bounded completed-byte cache and identical per-model geometry/texture counts on revisits. After unmount, all preview renderers are disposed, with zero geometries and at most one internal texture before renderer destruction. This does not prove absence of every browser/driver leak.

Production measurements use the built app at 1440×1000, two complete home → crew selection → workshop → launch → surface → abort/report → replay cycles. Actual keyboard walking/driving and a power-station proposal are exercised. Weak references avoid retaining renderer instances in the measurement harness. Post-report JavaScript heap is measured after explicit GC. Room-ready time starts at entering mission control and includes UI navigation and all six crew loads; it is not just download time. First rover render in production means a completed renderer call with the imported rover attached, not a GPU fence.

| Production measure | Before cycle 1 / 2 | Final cycle 1 / 2 |
| --- | ---: | ---: |
| Room ready, ms | 21,303 / 22,197 | 24,173 / 25,870 |
| Room first imported rover render after renderer creation, ms | 767.2 / 744.2 | 770.3 / 797.5 |
| Surface first imported rover render after renderer creation, ms | 7353.9 / 7679.5 | 7909.2 / 7719.7 |
| Post-report JS heap, MiB | 41.045 / 41.449 | 41.101 / 41.534 |
| Cumulative created renderers | 4 / 9 | 4 / 9 |
| Cumulative parses | 9 / 20 | 9 / 19 |
| Cumulative GLB resource entries (including cancelled requests) | 8 / 15 | 8 / 16 |
| Every created renderer disposed and detached at report | Yes / yes | Yes / yes |
| Uncaught page errors | 0 / 0 | 0 / 0 |

Both final cycles pass all navigation/interaction assertions. Room-ready samples are **2.87 and 3.67 seconds slower** than baseline. Stricter readiness waits for a rendered scene; software rendering, scheduling and progress overhead may also contribute, but this run does not isolate their shares. This is an unresolved measured navigation-cost regression, not evidence of a speedup. The first surface-frame samples are also slightly slower. Additional profiling on physical hardware is needed before attributing those differences or promising faster navigation.

Post-GC heap grows 0.404 MiB across the two baseline cycles and 0.433 MiB across the two final cycles. This short run shows similar heap behavior and complete renderer teardown, not proof of long-term stability. MarsWorld now has three residual renderer-managed textures immediately before renderer disposal instead of six; room has one in both runs. Geometries are zero at each teardown. Context loss follows renderer disposal. These are Three.js resource counts, not measured VRAM. Launch renderer cleanup is unchanged.

Final production room and surface screenshots were opened and visually inspected. The original crew and rover are visible and recognizable, with the existing lighting, terrain, room and controls. No before/after pixel-equivalence claim is made: camera/player positions and animated content vary. Model hashes and identical isolated draw counts independently support unchanged assets/geometry. The inspected readiness panel retains its existing presentation; this task does not redesign it.

## Automated verification

| Command | Exit | Result |
| --- | ---: | --- |
| `npm run test:model-loading` | 0 | 20 focused tests pass. |
| `npm run test:engineering` | 0 | 60 engineering/campaign checks pass. |
| `npm run test:preparation` | 0 | 72 proposal scenarios, 36 station paths, migration/persistence/reset pass. |
| `npm run test:mission-budget` | 0 | 1,239 cases: 5 fixtures, 1,152 combinations, 78 validation/boundary cases and 4 contracts pass. |
| `npm run build` | 0 | TypeScript project build and Vite production build pass. Existing >500 kB chunk warning remains. |
| `CHROMIUM_PATH=… npm run test:models -- --output=/tmp/ares-task005-browser-results-final` | 0 | **12/12 pass** (6 existing + 6 added), 4.8 minutes on the final source. |
| `CHROMIUM_PATH=… node scripts/test-model-loading-production.mjs dist final /tmp/ares-task005-production-final.json` | 0 | Two production cycles; walking, proposal, launch, driving, reporting/replay and teardown assertions pass. |
| `CHROMIUM_PATH=… node scripts/profile-model-loading.mjs final /tmp/ares-task005-profile-final.json` | 0 | Nine isolated original-model loads/renders plus successful real-time 4 Mbps test. |
| `node --check` on each of the three new `.mjs` scripts | 0 each | All three parse successfully. |
| `git diff --check` | 0 | No whitespace errors. |

Deterministic tests use controlled response streams and a fake clock, including the actual Lautaro byte size at 4 Mbps (33.604264 simulated seconds). They cover ordinary transfer, continuously progressing transfers across multiple timeout windows, stalls before headers and after bytes, fresh retry, concurrent consumers with one cancellation, last-consumer cancellation followed by a replacement, pre-aborted signals, HTTP/empty/truncated bodies, unknown/encoded lengths, LRU entry/byte limits, oversize non-retention, honest preparation state, cancellation during parse, late resource disposal and bad-parse cache invalidation.

The six added browser tests cover preparation feedback until render, original-model triangle counts and orbit interaction, HTTP failure/retry, unmount during a held parse and replacement character, six preview switches, workshop fallback/walking/retry without scene replacement, and MarsWorld fallback/retry without canvas replacement. Existing model tests remain intact, including rover hotspot interaction and responsive behavior. The existing RIMFAX interaction test passed in this run; its camera behavior was not changed. Intentional HTTP/network-failure fixtures produce expected diagnostic warnings.

The Node engineering/preparation/loading scripts print a Vite HMR `EPERM` warning while attempting a sandboxed WebSocket bind; assertions still run and commands exit 0. Browser/server commands were run with approved local-process access. An intermediate TypeScript build failed with TS6133 for an unused import while the MarsWorld status markup was being updated; it was corrected and the final build passes. The first production harness attempt had an over-strict home-button selector (the label includes an arrow); the harness selector was corrected without changing the app or existing tests.

## Reproduction and evidence

Use an installed Playwright Chromium, optionally supplied through `CHROMIUM_PATH`. This environment used `/home/kavi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome` because the default expected browser revision was not installed. No browser package/dependency was added.

```sh
npm run test:model-loading
npm run test:engineering
npm run test:preparation
npm run test:mission-budget
npm run build
CHROMIUM_PATH=/path/to/chrome npm run test:models -- --output=/tmp/ares-model-browser-results
CHROMIUM_PATH=/path/to/chrome node scripts/test-model-loading-production.mjs dist current /tmp/ares-production-current.json
# Start Vite in another terminal for the isolated profiler:
npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
CHROMIUM_PATH=/path/to/chrome node scripts/profile-model-loading.mjs current /tmp/ares-model-profile-current.json
git diff --check
```

Session evidence (temporary local artifacts, not promised permanent repository files): `/tmp/ares-task005-before.json`, `/tmp/ares-task005-profile-final.json`, `/tmp/ares-task005-production-before.json`, `/tmp/ares-task005-production-final.json`, their production room/surface screenshots, and `/tmp/ares-task005-*-final.log`. Baseline production command used `/tmp/ares-task005-baseline-dist`; final command used `dist`. The durable measurement summary is this document and the harnesses above.

## Scope safeguards, remaining risks and deviations

SHA256 comparison of the 96 pre-existing project files found exactly the eight modified files listed above and 88 unchanged files. All seven original GLBs are byte-identical. `docs/GAMEPLAY.md`, NASA/engineering data, stores, mission-budget code, save schemas and existing test files are unchanged. Diff inspection found MarsWorld simulation/sol-clock/energy equations, room navigation, rover geometry preparation, mission transitions and outcomes unchanged. Passing engineering, preparation and budget suites provide additional regression evidence, not exhaustive proof of every gameplay behavior.

The implementation stays within Task 005. A byte cap and identity-safe cache were added without increasing the existing entry count. Failed models retry in place where practical; there is no shared GPU cache, compressed/modified model, quality preset, terrain optimization, RIMFAX camera change or visual redesign. An experimental pre-parse timer yield was removed after a provisional production run was slower; final code avoids that extra scheduling delay and rate-limits progress callbacks. Provisional measurements are not presented as final results.

Remaining costs include fresh GLTF parsing, crew rig preparation, large decoded textures, shader compilation, terrain creation and GPU upload on scene recreation. They require separately authorized work. The first-render and navigation samples include variability and some regressions; speedup is not an acceptance claim. A true 30-second pause still requires retry; offline/background throttling can cause such a pause. Hardware/WebGL initialization failures remain subject to the existing fallback interfaces. Physical-device performance, long-duration memory soak, exhaustive touch-device use and every loading-overlay combination were not verified. Existing RIMFAX camera/interaction concerns remain outside this task even if its test passes in this run.

Task 005 ends here; no next-phase implementation or deployment is authorized by this record.
