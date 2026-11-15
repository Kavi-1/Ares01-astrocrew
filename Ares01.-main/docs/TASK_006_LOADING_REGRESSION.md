# Task 006 — Phase A: loading regression investigation

Date: 2026-11-15. Authority: the user-supplied `CODEX_TASK_006_COMBINED.md` in `ARES01_UI_REFERENCES_TASK006.zip`, and `docs/GAMEPLAY.md`. Phase A precedes all UI styling/layout work. The existing `design_references` and `design-references` directories remain excluded.

## Baselines and review boundary

The working tree initially contained Task 005 and the earlier uncommitted audits/budget work. Its 101 pre-existing files were copied and SHA256 recorded in `/tmp/ares-task006/before` and `/tmp/ares-task006/initial-hashes.json`. No reset, stash operation, commit/history edit, push or deployment occurred.

The pre-Task-005 comparison source is the preserved `/tmp/ares-task005-baseline-project`, not a speculative historical branch. The Task 006 starting source is Task 005's final implementation. The unchanged production build was also preserved as `/tmp/ares-task006/phase-a-dist` for subsequent visual comparisons. Existing audit/budget changes are not attributed to Task 006.

## Why the historical numbers were not equivalent

Task 005 reported two whole-navigation room-ready samples of 21,303/22,197 ms before versus 24,173/25,870 ms after. Those were valid observations of its harness, but not equivalent measurements of finished 3D work:

- The old room cleared `.room-status` immediately after preparing and attaching the final crew actor. The new room clears it after `renderer.render()` returns. A DOM label is therefore a different endpoint in the two versions.
- `scripts/test-model-loading-production.mjs` starts before the three entry/briefing/workshop clicks. Its result includes UI navigation, scheduling and camera changes, not just scene construction or download.
- The old first-rover check looked for `Imported_Perseverance` in the scene; membership does not prove that a visible mesh was submitted for drawing.
- The old repeat cycle did not establish HTTP-cache warmth. Its server supplied no cache validation headers and recorded full-file transfers. The three-entry application byte cache was the relevant retained cache.

The current room effect still has an empty dependency array. Progress state updates do not recreate its renderer, models or scene. Character normalization and `prepareCrewAnimation` geometry work are unchanged. The latter still performs a repeated nearest-body-vertex search for clothing vertices. That is a pre-existing CPU cost, not a regression introduced by the loading lifecycle.

## Equivalent measurement method

New harness: `scripts/profile-loading-regression.mjs`. It modifies only served module responses inside the browser test; it does not edit application files, gameplay timing or saved data. The same wrappers are applied to both source versions, and the harness SHA256 is recorded with each result.

Environment: Linux, Intel Core i7-12700, 20 logical CPUs, approximately 31.2 GiB system RAM; Chromium 151.0.7922.34, ANGLE/Vulkan SwiftShader, 1440×1000, DPR 1. No CPU throttle and no physical GPU test. These are instrumented **Vite development/React StrictMode** measurements, not physical low-end certification or production FPS results. Task 005 production samples remain separately labeled historical evidence.

Three independent browser contexts per version, each with a cold navigation followed by a same-page repeat navigation. HTTP cache is disabled in every condition. Cold means a new context followed by the normal home model load; it does not mean the room has no reused rover bytes. Warm means the application's existing bounded byte cache survives Home → re-entry. Warm also retains the workshop stage, while cold traverses seat selection and briefing. Compare versions **within each condition**; cold/warm differences are not exclusively cache effects.

Final run order alternates pairs: original-a, current-a, current-b, original-b, original-c, current-c. Browser workloads run sequentially. A preliminary two-navigation pilot was excluded after finding a download-count attribution issue: a request begun by React's discarded effect can remain in flight into the live effect. Final downloads include interval overlap and classify live model requests as new transfer, shared in-flight, or no-new-transfer/cache hit. The underlying loader was not changed to fix the measurement.

Recorded endpoints:

| Measurement | Meaning and limit |
| --- | --- |
| Room mount | Start of the live room effect, before renderer construction. |
| Controls registered | Existing input/visibility listeners installed; does not assert that every navigation panel has closed. |
| Controls usable / movement verified | Normal UI entry completed, then actual keyboard movement observed in `data-player-x`. |
| First scene render | First renderer call returned. |
| Foreground rover / selected crew | A descendant mesh's first `onAfterRender` callback; actual draw submission, not a GPU fence or proof of unoccluded pixels. |
| Full crew / all assets | Six prepared crew roots, and optionally the rover, attached when the renderer call returns. Off-screen crew are not required to draw visible pixels. |
| DOM-ready | Actual disappearance of `.room-status`, kept separate from 3D readiness. |
| Download | Fetch start, headers, delivered body bytes and completion, including overlapping shared transfers. Main-thread delivery time is not pure wire time. |
| Parse / rig | GLTFLoader parse span and synchronous `prepareCrewAnimation` duration. Parse includes asynchronous decoding/scheduling; sums can include overlapping work. |
| Progress / React | Setter enqueue duration/count and component function-body duration/count. These exclude reconciliation, commit, layout and indirect scheduling costs. |
| Teardown | Room renderer disposal/detachment and geometry/texture counts; broader model-disposal records are explicitly marked as all-app interval records. |

Instrumentation overhead exists in both versions. Module wrapping introduces some microtasks; mesh hooks and weak-reference traversal also have cost. No GPU upload time, peak driver VRAM, complete React commit cost or physical-device frame pacing is claimed.

### Production confirmation

`scripts/profile-room-production.mjs` serves each unmodified production build with `Cache-Control: no-store`, also disables browser HTTP caching, and uses only fetch/GLTFLoader/Three.js observation. There are no source transforms or injected game outcomes. It uses the same host/browser/viewport and the same alternating three-pair order. Initial and returning home screens must submit an original rover mesh draw before navigation begins, avoiding the old/new home-ready label distinction.

Production scene timing starts at the Three.js renderer observation after its constructor; it explicitly excludes constructor time. Navigation-to-ready is also recorded and includes that cost. Six `Group` roots carrying crew IDs distinguish real models from mesh proxies. Rig/React breakdown cannot be isolated in the production bundle and is not inferred from parse spans. The development measurements supply that limited breakdown separately.

## Measurements and decision

### Development diagnostics (three samples per cell)

Milliseconds; median [minimum, maximum]. These are the source-instrumented runs, **not production timing claims**.

| Endpoint | Original cold | Task 005 cold | Original repeat | Task 005 repeat |
| --- | ---: | ---: | ---: | ---: |
| All crew and rover rendered | 19803.2 [17135.8, 22786.8] | 19046.6 [17911.5, 27989.2] | 22788.3 [17634.9, 23935.2] | 18759.7 [18688.1, 19540.1] |
| Cumulative parse spans | 12793.3 [12606.8, 15407.7] | 10942.2 [10216.7, 15935.7] | 14618.7 [11292.7, 15642.3] | 9954.8 [9636.1, 10164.7] |
| Synchronous crew rig preparation | 1438.5 [1325.3, 1574.7] | 1438.7 [1347.5, 1648.9] | 2100.4 [1986.4, 2204.2] | 1808.6 [1760.6, 1872.6] |

The current-c cold run is a real 27.989-second outlier; it is retained. Paired current-minus-original cold differences were +775.7, −756.6 and +5202.4 ms; repeat differences were +1053.2, −4395.1 and −4028.6 ms. There is no consistent sign. Source and harness hashes were stable within each version. This does not establish a universal speedup or identify a cause for the outlier.

Median progress setter calls increased from 6 to 53 cold / 56 repeat; component function executions from 16 to 60 cold and 12 to 60 repeat. Combined measured setter/body CPU time was 3.5 → 16.8 ms cold and 3.3 → 19.9 ms repeat. The slow current-c sample had only 55 updates and 17.3 ms of this direct work. There is no callback-count explosion; indirect reconciliation/layout/render scheduling remains unmeasured.

Each room transferred all **67,747,440 crew bytes**; the rover reused retained bytes. Original latest-room calls comprise five new crew transfers, one shared in-flight crew request and one rover cache hit. Current calls comprise six crew transfers and one rover cache hit, plus a zero-byte cancelled request from the discarded development effect. Original development work contains nine parse spans versus seven current spans because abandoned mount work still parses in the old loader. These counts are **not production cache/parse results**.

The DOM-ready-minus-actual-render medians were original 683.1 / current 638.9 ms cold, and 736.7 / 801.3 ms repeat. Changed label semantics alone do not explain the development elapsed-time differences. Every room renderer was disposed/detached, with zero geometries and one internal texture immediately before renderer disposal.

### Production confirmation (three samples per cell)

Milliseconds; median [minimum, maximum]. The first three rows start at renderer observation after constructor completion. The controls row starts before normal UI navigation.

| Endpoint | Original cold | Task 005 cold | Original repeat | Task 005 repeat |
| --- | ---: | ---: | ---: | ---: |
| First rover mesh draw | 681.2 [596.7, 766.5] | 639.8 [629.2, 724.8] | 681.5 [647.5, 691.9] | 687.2 [654.0, 741.5] |
| First selected crew mesh draw | 2539.3 [2218.0, 2730.3] | 2413.3 [2291.5, 2542.4] | 2358.1 [2331.3, 2483.2] | 2269.8 [2266.0, 2334.6] |
| All six crew and rover rendered | 23411.3 [20134.9, 23999.4] | 21773.3 [20785.9, 27959.8] | 22584.4 [21493.8, 22593.1] | 21870.5 [20389.0, 22557.6] |
| Navigation to usable controls | 11591.8 [8900.9, 11753.2] | 10962.5 [10262.2, 11495.0] | 6000.4 [5987.9, 6084.9] | 6115.2 [6025.2, 6150.4] |
| Navigation to all assets rendered | 29370.1 [24559.6, 29952.1] | 27357.9 [26524.0, 34106.5] | 28100.3 [27011.7, 28194.3] | 27494.0 [25902.4, 28089.3] |
| DOM-ready after actual all-assets render | 674.1 [607.4, 803.6] | 665.8 [639.7, 679.3] | 680.6 [626.4, 684.2] | 761.7 [629.8, 772.0] |

The current-b cold run took **27,959.8 ms** from renderer observation, outside the original cold range; it is not discarded. Paired cold differences were +1638.4, +4548.5 and −3213.5 ms. Repeat differences were −722.6, −26.8 and −1104.8 ms. There is no established consistent regression across repetitions/conditions, and no general speedup claim. Three samples are a limited diagnostic set; host scheduling and software-render variability were not independently controlled or isolated.

Every production room had six crew transfers totaling 67,747,440 bytes and seven parses (including the cached rover). All room-ready samples reported 419 geometries, 204 textures, 444 draw calls and 401,645 drawn triangles. Teardown consistently left zero geometries and one internal texture before renderer disposal; each renderer was disposed and detached. Post-exit GC heap was 57.22–57.23 MiB original cold / 57.37–57.38 current cold, and 57.62–57.65 original repeat / 57.81–57.84 current repeat. Both conditions include the reopened home scene. This short sample does not prove long-term memory stability or measure driver VRAM.

**Conclusion:** the historical two-sample production slowdown is not established as a repeatable loader regression by these equivalent measurements. The changed label contract made the earlier endpoint uncontrolled, but both labels happened to disappear after the actual frame in these new runs; that change is **not proven to explain the entire old 2.87–3.67-second difference**. Direct measured progress/React work is small, but indirect scheduling remains unresolved. The individual slow outliers' root cause remains uncertain. Repeated rig preparation, parsing, downloads after LRU eviction and software rendering remain measured/pre-existing costs. No production loader fix is justified by this evidence; Task 005's reliability and honest readiness labels are retained.

Detailed per-asset download/parse/rig records, endpoint values, cache paths, hashes, environment and resource counters are retained in [loading-development.json](task006/loading-development.json) and [loading-production.json](task006/loading-production.json). Both final harnesses completed 12 actual scene navigations each with zero failures/page errors. The preliminary development pilot is excluded from these artifacts and all final statistics.

## Verification before UI work

| Command | Exit | Actual result |
| --- | ---: | --- |
| `npm run test:model-loading` | 0 | 20 focused tests, including 4 Mbps progressing transfer, genuine stall, retry, concurrent cancellation, late parse cleanup and cache bounds. |
| `npm run test:engineering` | 0 | 60 engineering/campaign checks. |
| `npm run test:preparation` | 0 | 72 proposal scenarios, 36 station paths, migration/persistence/reset. |
| `npm run test:mission-budget` | 0 | 1,239 cases. |
| `npm run build` | 0 | TypeScript and Vite pass; existing large-chunk warning remains. |
| `CHROMIUM_PATH=… npm run test:models -- --output=/tmp/ares-task006/phase-a-browser-results` | 0 | 12/12 pass in 4.6 minutes; six existing and six Task 005 loading/interaction tests. |
| `node --check scripts/profile-loading-regression.mjs` | 0 | Harness syntax passes; both versions' five instrumented modules also parsed successfully during harness development. |
| `node --check scripts/profile-room-production.mjs` | 0 | Production harness syntax passes and received an independent read-only review. |
| Six `profile-loading-regression.mjs` commands, alternating versions, `ARES_PROFILE_REPETITIONS=1` | 0 each | 3 cold + 3 repeat navigations per version, 12 total. |
| Six `profile-room-production.mjs` commands with the preserved original/current build paths, same repetition/order | 0 each | 3 cold + 3 repeat navigations per version, 12 total; identical harness SHA256 in all results. |
| `git diff --check` | 0 | No whitespace errors. |

The browser binary was `/home/kavi/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`. Node SSR checks retain the existing sandboxed Vite HMR warning where emitted; deliberate failure fixtures log expected diagnostics. No assertions were weakened or existing test contracts edited. The successful real-time 4 Mbps Task 005 result remains prior evidence; the Phase A deterministic reproduction passes, and its production loader source is protected by the initial hash comparison.

Reproduction, with a server for each source version:

```sh
ARES_PROFILE_ORIGIN=http://127.0.0.1:5182 ARES_PROFILE_REPETITIONS=1 CHROMIUM_PATH=/path/to/chrome node scripts/profile-loading-regression.mjs original-a /tmp/original-a.json
ARES_PROFILE_ORIGIN=http://127.0.0.1:5181 ARES_PROFILE_REPETITIONS=1 CHROMIUM_PATH=/path/to/chrome node scripts/profile-loading-regression.mjs current-a /tmp/current-a.json
# Repeat in the documented alternating order for b and c; keep browser workloads sequential.
ARES_PROFILE_REPETITIONS=1 CHROMIUM_PATH=/path/to/chrome node scripts/profile-room-production.mjs /tmp/ares-task005-baseline-dist prod-original-a /tmp/prod-original-a.json
ARES_PROFILE_REPETITIONS=1 CHROMIUM_PATH=/path/to/chrome node scripts/profile-room-production.mjs /tmp/ares-task006/phase-a-dist prod-current-a /tmp/prod-current-a.json
# Repeat b and c in the same alternating order. This production harness is frozen for the Phase B comparison.
```

## Independent Phase A review artifact

**Gate: NON-BLOCKING; bounded Phase B may proceed.** All required suites passed before UI work. No critical reliability failure or repeatable substantial new loading regression was established. Outliers and attribution limits remain visible above; this is not a claim that every loading delay is explained or solved.

Exact Phase A changes: two new profiling scripts (`scripts/profile-loading-regression.mjs`, `scripts/profile-room-production.mjs`), this standalone report and the two measurement artifacts. **No pre-existing application/source/UI/test/asset file changed** against the 101-file starting manifest. In particular, all seven GLBs, loader consumers, `GAMEPLAY.md`, mission stores and engineering/budget logic are unchanged.

The standalone implementation diff is [phase-a.patch](task006/phase-a.patch); it contains only the new harness code. Audit text/generated measurement evidence are separate. The full Phase A source/document snapshot is `/tmp/ares-task006/phase-a-snapshot`, with SHA256 manifest at `docs/task006/phase-a-hashes.json`. The untouched starting snapshot remains `/tmp/ares-task006/before`. Phase B receives a separate implementation patch; no Git history modification is used for either boundary.
