# ARES-01 asset licensing and attribution record

Review date: **2026-11-14**. Scope: repository assets, selected dependency notices, and official public source material. This record grants no license and does not certify clearance for publication.

## Evidence labels and scope

- **VERIFIED** means directly observed in files, a byte comparison, a cited policy, or repository history. A verified source credit is not a verified permission for every use.
- **INFERRED** means a conclusion supported by identified evidence, without a complete acquisition or editing record.
- **UNRESOLVED** means evidence or a rights decision is still needed.
- **PROPOSED** marks recommended wording or future action, not an implemented change or permission.

**VERIFIED — baseline:** branch `main`, commit `c7b88d752ce7594674ee0e6c38bf636732cb6195`. The four previous audit documents, isolated mission-budget implementation/test, and its package script were already present as working-tree changes. They are outside this change. Both excluded design-reference directories were omitted from inspection. No model, production code, license file, or dependency was changed.

**UNRESOLVED — release conclusion:** licensing is **not fully cleared**. The exact acquisition/editing chain of the local rover, embedded agency identifiers, crew models and their artwork, and distribution of dependency notices require follow-up. NASA's media conditions do not cover every project asset.

## 1. Repository asset inventory

**VERIFIED — inventory boundary:** `public/` contains seven GLBs and six PNG portraits. No standalone audio, video, font, or terrain texture files were found there; none of those external binary asset formats were found under `src/`. Fonts enter through npm CSS imports, icons through `lucide-react`, and GLBs contain additional embedded images. Generated `dist/` is a build artifact, not an independent provenance source.

Every row below is **VERIFIED for path, byte size and SHA256 only**. Creator/permission status follows in the next sections. Hashes identify this reviewed version, not its license.

| Repository path | Bytes | SHA256 |
| --- | ---: | --- |
| `public/models/crew/aaryan.glb` | 12,582,312 | `85cde4c74c0219480867fa9851a8dcdcf4a2239e2fd8aaae49b946d9a3e177f6` |
| `public/models/crew/houssam.glb` | 9,011,952 | `b82196531e2b9d5516e60a5d8ddc357a200e4a30bef6d118948de33deb5e44e5` |
| `public/models/crew/huzaifa.glb` | 9,016,548 | `e1390461d5d17653a6e6cb5a3435b3f487029cf222187d58a1029919b4ea6100` |
| `public/models/crew/kavi.glb` | 9,812,416 | `e03f011f98c3fcbb3a44323cfff4203911b0827b1b83afb7a84656ea8ac14f8d` |
| `public/models/crew/lautaro.glb` | 16,802,132 | `933c0a5cad129fc63bc039ab9d61f4209b30beb2f097d529947413df9551ed60` |
| `public/models/crew/rihabe.glb` | 10,522,080 | `32600980d815989bfe87d1c4b54b9769640d3993f4b0abf8a614aecf82f40296` |
| `public/models/rover.glb` | 6,670,792 | `340dd6a8934ebae94a6e6325df61b9f189cf7b9f078abda772d8f87109245c1e` |
| `public/portraits/aaryan.png` | 79,703 | `b2858c35b2816048463ec93e21a55d011bf8978f4ef0a98b535e865b91e43ee2` |
| `public/portraits/houssam.png` | 77,376 | `d971f5e7b81745d2c3d6c0532e9d9b3e7b17a089a0d8968773211cb4a5506000` |
| `public/portraits/huzaifa.png` | 78,031 | `72378e58c6a93736e2abb39f44b90152859979fcf2d3a9fc9b54b9cfe2e79a81` |
| `public/portraits/kavi.png` | 79,217 | `e05d56a8c7a0f870d7fae1e3c3848958a3391041d7b6d19c8d83413e20de92ed` |
| `public/portraits/lautaro.png` | 78,030 | `02285385a080e3d49135dcc8f43eb2b94648930c77818d00a447a1fb871f806f` |
| `public/portraits/rihabe.png` | 85,817 | `a0874723ff68efdeba0024b7417e4aa64410bc0cbb7a51fcc2f6fa42b747c601` |

| Asset group | Creator and source evidence | Provenance / rights status |
| --- | --- | --- |
| Rover, including embedded images | NASA's [Mars Perseverance Rover, 3D Model](https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/) credits NASA/JPL-Caltech. All 23 local images match its downloadable GLB. | **VERIFIED** NASA-hosted matching content; **INFERRED** adapted mesh lineage; **UNRESOLVED** exact local-file acquisition and editor history. |
| Six crew GLBs | No creator, source URL or license in their glTF `asset` fields; no accompanying asset-specific rights document found. | **UNRESOLVED** body, hair, clothing, texture and character-design rights for each model. Blender generator text identifies software, not an author or license. |
| Six portraits | `scripts/generate-portraits.mjs:4–24` renders the six crew IDs to these paths; `docs/VISUALS.md:211–212` describes that pipeline. | **VERIFIED** documented generation path; **INFERRED** existing PNGs are those derivatives; **UNRESOLVED** exact export history and underlying model/art rights. |
| Manrope / DM Mono | Installed Fontsource packages, their metadata, CSS and OFL files; details below. | **VERIFIED** package provenance and OFL-1.1 terms; **UNRESOLVED** complete release-notice delivery. |
| UI icons | `lucide-react` package and imports in `src/ui`, `src/game`; some icons originate in Feather. | **VERIFIED** ISC and included Feather MIT notice; retain both applicable notices. |
| Procedural world, rooms, launch graphics, effects | `src/game/terrain.ts`, `src/game/MarsWorld.tsx`, `src/game/LaunchCenter.tsx`, `src/ui/crew/CrewRoom.tsx`, `src/ops/visual/`. | **VERIFIED** generated in source rather than loaded as separate image assets; **UNRESOLVED** authorship/rights chain of original project work. A procedural technique does not prove original authorship. |
| Audio | No shipped audio files or active `AudioContext`/`new Audio` integration found in the scoped source search. `docs/VISUALS.md:184–186` labels audio unbuilt. | **VERIFIED** inventory finding; no audio license inferred or assigned. |

## 2. Rover fingerprint and metadata

**VERIFIED — local file:** `public/models/rover.glb`, **6,670,792 bytes**, SHA256 **`340dd6a8934ebae94a6e6325df61b9f189cf7b9f078abda772d8f87109245c1e`**.

**VERIFIED — parsed GLB:** glTF 2.0; generator `Khronos glTF Blender I/O v4.5.51`; no `asset.copyright`, author/source/license field, root extras, or node extras identifying rights. One scene named `Scene`; 66 nodes; 65 mesh definitions; 248 primitives; 69,235 indexed triangles; 48 materials; 37 texture definitions referring to 23 embedded PNG/JPEG images; no skins, animations or declared extensions. Triangle counts are raw mesh primitives, not rendered frames or a performance measurement.

**VERIFIED — structure:** the hierarchy includes `Body`, front/rear hazard cameras, `Wheels_objs`, `suspension`, the arm/turret assemblies, `PIXL`, `WATSON`, `RIMFAX`, `rtg`, three antenna assemblies, `Mastcam_Z_cams`, `NavCams`, sample-handling components and calibration targets. Materials include named rover surface maps, metals, glass, foil and graphics, with glTF material/texture definitions. The embedded-image appendix records every local image and its source match. These names are identifiers, not engineering validation of scale or instrument capabilities.

**VERIFIED — repository history:** `git log --follow --format='%h %ad %s' --date=iso -- public/models/rover.glb` identifies a single addition, `991f58f`, 2026-11-14, “Add 3D assets.” The inspected docs describe a supplied model but do not record an original download, exporter recipe or editor. No asset-specific license/credit manifest was found in the scoped project files before this audit.

## 3. Comparison with official downloads

**VERIFIED — downloads:** the following binaries were fetched with validated TLS into `/tmp`, without replacing repository assets. The NASA collection page links its GitHub model directory and GLB. NASA GitHub `master` resolved to `11ebb4ee043715aefbba6aeec8a61746fad67fa7` during inspection.

| Official source | Download / identity | Bytes / SHA256 | Comparison with local rover |
| --- | --- | --- | --- |
| [NASA 3D Resources: Mars 2020 Perseverance Rover](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/) | [Collection GLB](https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/mars-2020-perseverance-rover/Mars%202020%20Perseverance%20Rover.glb) | 4,987,176; `10db7c03a5e63a5a3b3e7baa6243aa4918ba045fa8ff0a731d0217491adc727f` | **VERIFIED:** not identical. 88 nodes, 68 meshes, 252 primitives, 199,521 triangles, 47 materials, 44 images, one skin, 23 animations; exporter v4.2.57. |
| [NASA GitHub model directory](https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Mars%202020%20Perseverance%20Rover) | `Mars 2020 Perseverance Rover.glb`, downloaded from the directory's raw URL | 4,987,176; same `10db7c03…adc727f` hash above | **VERIFIED:** identical to the NASA collection download, not the repository rover. |
| [NASA: Mars Perseverance Rover, 3D Model](https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/) | [25042_Perseverance.glb](https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/25042_Perseverance.glb) | 11,687,880; `484f00aa5d3739b127b6d413e77149a2d74ae87b76ae57463c4b91965ffb4990` | **VERIFIED:** strongest content match, not an identical file. 66 nodes, 65 meshes, 249 primitives, 199,309 triangles, 48 materials, 24 image entries, no skins/animations; exporter v1.1.46. Page credit: NASA/JPL-Caltech. |

**VERIFIED — matching evidence, beyond appearance:** local and `25042` node names/order, parent-child hierarchy and mesh assignments are identical. Every one of the local 23 encoded image byte sequences has a SHA256 match in `25042`; two original foil image entries have identical bytes and only one survives locally. Retained images have unchanged dimensions, ranging from 64×64 to 1024×1024. The `clear.png` source image is named `clear` locally. One material is renamed `Material` → `Material.001`.

**VERIFIED — differences:** the local file has 130,074 fewer triangles, about 65.26% fewer than `25042`, and one fewer primitive. Most accessor lengths differ. The exporter signature changed and 29 node transform records differ. Translation/scale differences are small; quaternion representations also differ. This comparison does **not** establish physical accuracy, an intended resizing operation, or the algorithm used to change geometry.

**INFERRED — adaptation:** the shared hierarchy and all-image matches strongly support derivation from the same model lineage as NASA's `25042` download. The smaller geometry and newer exporter support a simplified/re-exported version. They do not establish who edited it, whether an intermediate distributor was used, or whether decimation rather than another remeshing process was applied. There is no evidence of resizing/recompressing the retained texture bytes. Reduced triangle count alone is not a measured performance improvement.

**UNRESOLVED — exact provenance:** neither tested official binary matches the local SHA256. The exact origin of the **local file as supplied remains unverified**. This search examined two current official model variants, not all historic exports or the contents of NASA's Blender source. Needed evidence: original download URL/date and original hash; original file or retained download record; editor/contributor identity; export settings or script; modification log; any intermediate source's terms. Matching images do not establish a complete chain of title.

**VERIFIED — runtime adaptation, distinct from disk history:** `src/models/roverModel.ts` rotates/grounds the loaded scene, partitions `Wheels_objs` into wheel pivots, and toggles identifiable instrument nodes. `src/models/assets.ts` loads bytes. These operations do not overwrite `rover.glb`. They should be described as ARES-01 runtime adaptations, not as evidence of the earlier GLB export process.

## 4. Official usage guidance reviewed

All sources in this section were reviewed on **2026-11-14**. Statements labeled VERIFIED describe the guidance; applicability to a particular distribution can remain unresolved.

**VERIFIED — [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/), “NASA Images and Media Usage Guidelines,” “Non-commercial use,” and “Commercial use”:** the guidance expressly includes 3D polygon data and texture maps. It generally permits factual educational/informational use with NASA acknowledgment, subject to its conditions. It distinguishes third-party copyrighted content: NASA hosting it does not transfer the owner's rights. Promotional/commercial uses must not imply endorsement; logos and identifiable people can require additional clearance. These conditional statements do not establish universal public-domain status or a CC0/MIT/Creative Commons license.

**UNRESOLVED — modification and redistribution:** that page is usage guidance, not a model-specific standardized license or a recorded approval for this adapted binary. Do not describe it as an unrestricted relicensing grant. Preserve source credit and modification disclosure; confirm any additional restrictions for redistributed files, embedded identifiers and intermediate contributions before release.

**VERIFIED — [NASA Brand Guidelines](https://www.nasa.gov/nasa-brand-center/brand-guidelines/), “NASA Insignia” and “Identifiers”:** the page restricts insignia/logotype/seal use and forbids using them as third-party branding or to suggest support. Mission identifiers have separate restrictions. **UNRESOLVED:** the reviewed guidance does not expressly settle this game's depiction of logos already embedded on the rover. A model download is not an express logo-use authorization.

**VERIFIED — [JPL Image Use Policy](https://www.jpl.nasa.gov/jpl-image-use-policy/):** JPL's policy covers images/video on JPL public sites, requires source credit and non-endorsement, disclaims ownership warranties, and identifies logo/person/third-party exceptions. It calls for prior written approval for the JPL logo. Its scope should not be silently extended into a universal license for this GLB hosted on `science.nasa.gov`. **UNRESOLVED:** whether this particular embedded-logo depiction is covered or needs permission should be resolved with the relevant NASA/JPL contact or a qualified rights reviewer.

**VERIFIED — [NASA 3D Resources README](https://github.com/nasa/NASA-3D-Resources):** the collection describes free resources and directs users to NASA usage guidance; it also lists outside contributors. A public repository, the collection statement and a similar filename are insufficient to assign an SPDX license to this local derivative. No model-specific standardized license was identified in the two candidate listings inspected.

### Embedded identifiers and other graphics

**VERIFIED — actual image inspection:** the local rover's embedded `arm_graphics` JPEG contains the NASA insignia and the red JPL logo. Its bytes match `25042`. This conflicts with the broad “no NASA logo” statement in `README.md:47`; it does not prove the game claims endorsement. The local `nameplate` image was also inspected. No running application was inspected in this task, so visibility/prominence in each camera view was not verified.

**VERIFIED — crew texture inspection:** Kavi's image named `NASA_Trim_Atlas` actually shows an ARES-01 mission patch, a cat in a helmet, a nameplate and flag artwork. The filename is not proof of NASA authorship or a NASA logo. **UNRESOLVED:** creator, source and terms for the cat image, patch and other embedded graphics. Only this crew atlas was visually inspected; the other five atlases were inventoried, not visually cleared.

**PROPOSED:** keep ARES-01 branding separate from agency identifiers; obtain a decision on existing embedded logos before public use. Do not silently remove logos or replace the model in this documentation task. No permission request was sent to NASA, JPL or any asset creator.

## 5. Crew and portrait evidence

**VERIFIED:** all six crew GLBs report `Khronos glTF Blender I/O v4.5.51`, glTF 2.0, and clearcoat/specular material extensions; none contains authored animation clips or a license in `asset`. Counts below describe embedded content, not independent works or license owners.

| GLB | Nodes / meshes / materials / images / skins | Status |
| --- | --- | --- |
| `aaryan.glb` | 295 / 11 / 27 / 21 / 2 | VERIFIED metadata; UNRESOLVED rights |
| `houssam.glb` | 140 / 9 / 16 / 20 / 1 | VERIFIED metadata; UNRESOLVED rights |
| `huzaifa.glb` | 155 / 9 / 16 / 20 / 1 | VERIFIED metadata; UNRESOLVED rights |
| `kavi.glb` | 155 / 9 / 16 / 20 / 1 | VERIFIED metadata; UNRESOLVED rights |
| `lautaro.glb` | 401 / 13 / 35 / 30 / 3 | VERIFIED metadata; UNRESOLVED rights |
| `rihabe.glb` | 161 / 9 / 17 / 21 / 1 | VERIFIED metadata; UNRESOLVED rights |

**VERIFIED:** names include `ARES_belt`, `ARES_jacket`, `ARES_insignia`, `J_Bip_*` bones and `N00_000_*` materials. **INFERRED:** some naming resembles common avatar export conventions. **UNRESOLVED:** naming is insufficient to establish VRoid/VRM origin, a particular marketplace, creator identity, or rights to any body/hair/clothing component. No VRoid or marketplace license is assigned here.

**VERIFIED:** `src/models/characterModel.ts` normalizes presentation bounds; `src/models/crewAnimation.ts` applies runtime rig/clothing adaptations and procedural posing. `src/ui/crew/CrewPortrait.tsx` loads the portrait PNGs. **UNRESOLVED:** those code paths do not settle ownership of source characters, team-member likeness permissions, uniform artwork, or the derivative portrait exports. Obtain contributor/source declarations per character and per incorporated component. Do not assume NASA's terms apply to them.

## 6. Fonts, icons, source code and notices

**VERIFIED — fonts:** `src/main.tsx:3–6` imports Manrope 400/600/700 and DM Mono 400 normal. Installed `@fontsource/manrope@5.3.0` and `@fontsource/dm-mono@5.3.0` metadata and `LICENSE` files specify **SIL Open Font License 1.1**. The copyright credits identify the [Manrope Project Authors](https://github.com/sharanda/manrope) (2019) and [DM Mono Project Authors](https://github.com/googlefonts/dm-mono) (2020). Package metadata identifies [Google Fonts](https://github.com/google/fonts) and [Fontsource font-files](https://github.com/fontsource/font-files) as the distribution chain. These are verified package declarations, not independently reconstructed upstream history.

**VERIFIED — OFL conditions:** the inspected local licenses allow bundling/embedding under conditions including retention of copyright and license text, no standalone font sale, and any applicable Reserved Font Name restrictions for modifications. Font permissions do not determine the license of ARES-01 source code. License-file SHA256: Manrope `d826ab6583b12c26807d8716a545bdbbb672df04f48608a364ba9efdbe501c30`; DM Mono `d2766c396a8534cba53340f8af2037749b6a0a1dd3587348c917a70e779d2e32`.

**VERIFIED — font delivery:** imported CSS references 40 files: 36 Manrope and four DM Mono. All matched the existing build by hash: 34 separate `dist/assets` font files and six small Manrope files embedded as CSS data URLs. The appendix inventories the actual imported package files, including the inline subset. No font was added or rebuilt during this audit.

**VERIFIED — direct dependency notices:** installed package metadata and local notice files were inspected. Paths in the table are relative to `node_modules/`; package-lock provenance is separate from asset authorship.

| Package / installed version | Declared license and inspected notice | Role / action |
| --- | --- | --- |
| `react`, `react-dom` 19.3.1 | MIT; each `LICENSE` | Runtime; retain notices. |
| `three` 0.187.0 | MIT; `three/LICENSE` | Engine; model data is not licensed by Three.js's license. |
| `zustand` 5.1.0 | MIT; `zustand/LICENSE` | Runtime state. |
| `@radix-ui/react-alert-dialog` 1.2.1; `@radix-ui/react-tooltip` 1.4.1 | MIT; each `LICENSE` | UI/runtime and transitive packages need release notice coverage. |
| `lucide-react` 1.73.0 | ISC; `lucide-react/LICENSE` also includes MIT for Feather-derived icons | Credit Lucide Icons and Contributors; retain the included Cole Bemis/Feather notice where applicable. |
| Fontsource packages 5.3.0 | OFL-1.1; each `LICENSE` | Preserve font copyright and OFL text. |
| `vite` 8.3.6; `@vitejs/plugin-react` 6.2.1 | MIT; `vite/LICENSE.md`, plugin `LICENSE` | Build tooling; included third-party notices may have additional terms. |
| `typescript` 7.0.2 | Apache-2.0; `typescript/LICENSE`, `NOTICE.txt` | Compiler/tool redistribution scope differs from game bundle. |
| `@playwright/test` 1.65.1 | Apache-2.0; `LICENSE`, `NOTICE` | Test tooling; not a rover/character license. |
| `@types/react` 19.3.0; `@types/react-dom` 19.3.0; `@types/three` 0.187.0 | MIT; each `LICENSE` | Type declarations/tooling. |

**VERIFIED:** no project-level `LICENSE`, asset `CREDITS` or standalone `NOTICE` file was found in the scoped project inventory; `package.json` has `private: true` and no `license` field. The existing `dist/` contains no standalone license/credit/notice file. **UNRESOLVED:** full transitive notice compliance and whether embedded notices/metadata are sufficient and accessible in every release format. This limited inventory is not a complete software bill of materials or legal clearance. Existing package license files do not prove notices are delivered to players.

**UNRESOLVED — original work:** the owner must select/confirm rights and a license for original ARES-01 code and team-created art separately. MIT dependencies do not make the application MIT, and NASA guidance does not license the crew. `docs/VISUALS.md:137` requests CC0/CC-BY downloads; neither this historical rule nor a filename permits relabeling NASA content. This audit records the actual terms and leaves that document unchanged.

## 7. Recommended credits and disclaimer

**PROPOSED — wording supported now, with uncertainty visible:**

> Perseverance rover model incorporates NASA/JPL-Caltech content matching the official Mars Perseverance Rover 3D model. Used in an independent educational game. The local mesh is adapted; its acquisition and editing history remain under review.

Source: [NASA Mars Perseverance Rover, 3D Model](https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/); matching [original GLB content](https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/25042_Perseverance.glb). **VERIFIED:** these links identify the compared source, not a byte-identical local download.

**PROPOSED — after the derivative chain is confirmed:**

> Perseverance rover 3D model: NASA/JPL-Caltech. Adapted for ARES-01 from NASA's Mars Perseverance Rover 3D model, including geometry simplification and runtime articulation. Used in an independent educational game.

Retain the same source links, identify the confirmed editor, and record the actual export process. Do not call it an unmodified NASA original or claim NASA approved the adaptation.

**PROPOSED — separate non-endorsement disclaimer, using the requested wording:**

> ARES-01 is an independent project created for the NASA Space Apps Challenge. It is not an official NASA product and is not endorsed by NASA or JPL.

**PROPOSED — other credit entries:** “Manrope — The Manrope Project Authors; DM Mono — The DM Mono Project Authors. SIL Open Font License 1.1.” “Icons — Lucide Icons and Contributors; includes Feather-derived icons by Cole Bemis. ISC/MIT notices apply.” Full notices must accompany the appropriate distribution; these short credits are not substitutes. Do not publish invented creator credits for the crew, portraits or cat artwork. Keep their provenance pending until supported.

**VERIFIED — implementation status:** these credits exist only in this document. No credit screen, repository license, packaging notice, branding or public deployment was changed. The model does not itself satisfy educational mission-design integration; see [SPACE_APPS_CHALLENGE_ALIGNMENT.md](SPACE_APPS_CHALLENGE_ALIGNMENT.md).

## 8. Owner actions before release

| Priority / issue | Evidence status | Required action |
| --- | --- | --- |
| P0 — rover acquisition and adaptations | **UNRESOLVED** exact local provenance; strong **VERIFIED** content matches | Obtain original/download record, editor identity and conversion/optimization history. Preserve original files and hashes. |
| P0 — embedded NASA/JPL identifiers | **VERIFIED** in `arm_graphics`; **UNRESOLVED** authorization for intended context | Resolve the model's factual depiction under NASA/JPL conditions and the README's no-logo rule. Seek clarification/permission if needed; any asset change requires separate approval. A disclaimer is not permission. |
| P0 — crew and embedded artwork | **UNRESOLVED** creators and permissions | Obtain per-character source declarations and rights for body, hair, clothing, cat/patch artwork and any likenesses; link portraits to cleared inputs. |
| P1 — font/software notice delivery | **VERIFIED** local licenses; **UNRESOLVED** release completeness | Review bundled/transitive dependencies and deliver applicable OFL/ISC/MIT/Apache notices in a separately authorized packaging task. |
| P1 — original project licensing | **UNRESOLVED** | Choose a code/team-art license only for rights the team controls; explicitly separate NASA and other third-party assets. |
| P1 — intended use | **UNRESOLVED** beyond independent educational challenge entry | Confirm intended distribution, promotional screenshots and any commercial/merchandise uses against applicable conditions. Do not infer approval from Space Apps participation. |

## 9. Verification record

**VERIFIED — commands and methods executed:**

| Command / operation | Result |
| --- | --- |
| `git status --short --untracked-files=normal`; branch/commit inspection; scoped `git log --follow ... -- public/models/rover.glb` | Exit 0; recorded working tree and the single model-addition commit. No Git mutation. |
| Scoped `rg --files`, `rg -n`, `sed`, Python `pathlib` reads | Inventoried permitted files, source loading paths, attribution mentions and package licenses. A search initially used `src/game/gameStore.ts`/`marsStore.ts` and exited 2; corrected paths are `src/store/`. |
| Python standard-library `hashlib.sha256`, `struct`, `json` over all public files / GLB chunks | Exit 0; full file hashes and parsed inventories. An initial optional NumPy comparison attempt exited 1 because NumPy was absent; replaced with standard-library decoding, without installation. |
| `sha256sum public/models/rover.glb docs/GAMEPLAY.md /tmp/ares-nasa-rover /tmp/ares-github-rover-binary /tmp/ares-nasa-25042` | Exit 0; independently reproduced the local/specification and three downloaded-binary hashes recorded above. |
| Python `urllib.request.urlopen` of the two NASA binary URLs, NASA GitHub directory/raw GLB and commit API | Initial sandbox DNS failures; authorized network retry succeeded, HTTP 200. TLS validated for the binary comparisons. Downloads remained in `/tmp`. |
| Encoded image SHA256 comparison; node/hierarchy, primitive and accessor comparison | Exit 0; all 23 local images match `25042`; file/mesh differences documented above. No image content is redistributed in this document. |
| Extract three existing images to `/tmp` and inspect with image viewer | Viewed Kavi's trim atlas, rover `arm_graphics`, and rover `nameplate`; no asset editing. |
| Package CSS URL enumeration, file hashing and build data-URL decoding | Exit 0; all 40 imported font files matched existing build content. |
| Official pages via web tools; NASA mission PDF download | Sources reviewed as cited. `pdftotext` was unavailable (127); PDF text was read using the web PDF tool instead. |
| Final SHA256 snapshot comparison, local Markdown link/placeholder checks, and `git diff --check` | Exit 0: all 94 pre-existing snapshot files unchanged; no missing local links or unfilled placeholders; no tracked whitespace errors. Only the two requested documents were added by this task. |

**VERIFIED — limits:** no browser gameplay, fresh production build, unit-suite rerun, hardware performance test or deployment was performed for this documentation task. Prior audit results are not new measurements. No dependencies, models, tests, history or stashes were changed. Research artifacts under `/tmp` are temporary; the hashes, URLs and method above are the durable evidence in this document.

## Appendix A. Embedded rover image evidence

**VERIFIED:** each row is a local encoded image with an identical SHA256 in official `25042_Perseverance.glb`. Dimensions and hashes do not independently clear logos or other rights. The source has one additional duplicate foil image entry.

| Local image name | Dimensions | SHA256 of encoded bytes |
| --- | --- | --- |
| `mars_2020_03` | 1024×1024 | `454e0fe55561af5472a569b9a30288191647ea87b5e8dbe3236e2c3e9c469d2b` |
| `mars_2020_01` | 1024×1024 | `a38ee60b787fda5bea77381c34c1de96649fcc786e914866a1009d90dc3ca859` |
| `mars_2020_04` | 1024×1024 | `eaec5f90c0749176a2e462d66777c2af866f0847226a6f2631f0528bf7db613e` |
| `mars_2020_02` | 1024×1024 | `95ff75ac88f5b6511b973aa26cde7d9f810bfd2446cec6e146a2c65d9414ad58` |
| `mars_2020_05` | 1024×1024 | `1a3e079a072efe60f27e89e4ae726902b44b1918114f7380ca352a616e1e0261` |
| `mars_2020_spring_n` | 256×256 | `24fdce4207a96ed013aca89c66a0d812a93d050707da581e679dc78447ff3c38` |
| `mars_2020_hub_n` | 256×256 | `f289d4bf60dc524ab8db5bccaf145897e38509bba067bb548961bd05b9a368df` |
| `mars_2020_hub` | 256×256 | `215351e543a950c4c04099a2943b8e98203de8b1e078d6aac4abd08378e67211` |
| `mars_2020_05_n` | 1024×1024 | `ae90d32ef091a4bbf41b18b291bd4ff2f2849e89926373615dfec1d164e8362c` |
| `foil_n` | 512×512 | `be922b7ea550409b042aaf666a70af1f32175a6ac732030812c2bac04595c578` |
| `glass` | 128×128 | `d881400fda91cf5e13ab72d858e3b7133d5e65b63bdeeb1588cabda3c6f56648` |
| `clear` | 64×64 | `ffaa1621fee1989cd7487f42702600ce0559ea86804dd0b990cd0675a7b50cb9` |
| `mars_2020_07_BLACKOUT` | 512×512 | `d3230a280f2203e5d0388245ba88a338bbd561cbc6e80eee0523e050d91ff685` |
| `mars_2020_06` | 1024×1024 | `33af93441c6aa004089176aab90b551abb04c26888a898a43cfd84d5ed4bb628` |
| `arm_graphics` | 512×512 | `a5c95fda5591ddd89ae742b377232ca1da21b2033fd8ee6fa3423f9a9b313a45` |
| `mars_2020_02_n` | 1024×1024 | `0e3be914c382ec71842829a1cec6aa703cc5befbb08d6878c8d0b348085f7587` |
| `mars_2020_05_r` | 1024×1024 | `2f44f50ff47c52667e6eb5b1cbed83f1937031c8f26ca05186dbec97bbcc9212` |
| `nameplate` | 1024×512 | `4df1b79be6e71ad5e34edd51fb568c4ccabf87c7dad4ad5c84e45f1dc2dfa574` |
| `mars_2020_01_n` | 1024×1024 | `688eee39989fdd858c68df7a324fa2551ceee826ae44363bf0cc3c9bf48984ff` |
| `blade` | 1024×512 | `6904656ecfc5434d93e76cab94fb85bafb1070efa9f2a2bfa65c646875324da1` |
| `mars_2020_06_n` | 1024×1024 | `e2ef092ce7b273fa651f5bb3793702b2e32694ea6f74949e5d384b892d4e3d1c` |
| `cvoidPlaque` | 512×512 | `bac851be808116312b461e876f717e21e5c0159db69500936bf0fa1a47fc912b` |
| `sample_handling_door` | 512×512 | `6bdf4d5be7ad1369bd0099c8a809999ca06fc4da18cfbd3afcec4b41ca443a5d` |

## Appendix B. Imported font fingerprints

**VERIFIED:** paths below are relative to `node_modules/@fontsource/`. “Inline” means byte-identical content embedded in the existing built CSS; “file” means a byte-identical font under `dist/assets/`. Exact package source paths and SHA256 remain stable evidence even if build filenames change.

| Imported package path | Bytes | SHA256 | Existing build |
| --- | ---: | --- | --- |
| `manrope/files/manrope-cyrillic-400-normal.woff` | 10,032 | `377eaffaf00d2fe381870f08f098e3ad266618253c9d4197647b89816784e49c` | file |
| `manrope/files/manrope-cyrillic-400-normal.woff2` | 7,840 | `5a987d1484070f1ea54de7c10ebfa4057a18e379361dbe5fd5c4fa4c2d95ef39` | file |
| `manrope/files/manrope-cyrillic-600-normal.woff` | 10,060 | `716a12f36cf789e399e0ad0bd205e3d1c66e4de66fe0c7e94a59ab7f007fce89` | file |
| `manrope/files/manrope-cyrillic-600-normal.woff2` | 7,872 | `80b86efbef1c9fb66557cc4cc7b6db42db2fd631f1a9b8735f3bbefbb5128799` | file |
| `manrope/files/manrope-cyrillic-700-normal.woff` | 10,004 | `64d81d2579261c073c8e7ed0964f7b1735707ac3afc6c60a49531918e1cb128f` | file |
| `manrope/files/manrope-cyrillic-700-normal.woff2` | 7,852 | `2ad647b9159d27d27f4999b30598f92e60449fb20d80803bc7b85afafbb446d5` | file |
| `manrope/files/manrope-cyrillic-ext-400-normal.woff` | 2,200 | `2ba8c74e257f85e4462880a1bf39ca3db270b11923d14a674080ef8f6289a7da` | inline |
| `manrope/files/manrope-cyrillic-ext-400-normal.woff2` | 1,624 | `2888616ddce6d7a011b083bc27527df3313f1df71dc54fd752a83f347f4e8e29` | inline |
| `manrope/files/manrope-cyrillic-ext-600-normal.woff` | 2,192 | `af1f6f3fa552cf928315a8c18c09806f1d7d3c143ad16ccf2c0597064456f69b` | inline |
| `manrope/files/manrope-cyrillic-ext-600-normal.woff2` | 1,612 | `a9d78164da8b9d756bc97d7c45ced1dcb10c4ff894a249d2a759406ec54c2532` | inline |
| `manrope/files/manrope-cyrillic-ext-700-normal.woff` | 2,176 | `eed028eaa08fc76f336ca9e4c0a629f6f538d23530c49bf4411703df7d3fe723` | inline |
| `manrope/files/manrope-cyrillic-ext-700-normal.woff2` | 1,568 | `0dc9d9b75bffd07e25f727e8d67a39cc731e21c718b3b86267226bb4e2757813` | inline |
| `manrope/files/manrope-greek-400-normal.woff` | 6,772 | `b1ef144fe025cbadcfb7880bc611535586d7f45461e7add7305ea2ea9ccad6ed` | file |
| `manrope/files/manrope-greek-400-normal.woff2` | 5,280 | `47f1b5621859a25df69ec1f1c7ed0ca3aadc3eccd1770c6e89cd5af06f1a0bf8` | file |
| `manrope/files/manrope-greek-600-normal.woff` | 6,740 | `59fa49c299110657ee3dbc02beed32f5fda899423686058a0ce7e499851e6e7a` | file |
| `manrope/files/manrope-greek-600-normal.woff2` | 5,232 | `18d69aa241a76095c4c5f8c224abe6519ff60db3b4085e843d59fb4965a4eebd` | file |
| `manrope/files/manrope-greek-700-normal.woff` | 6,744 | `caefb2ca9d80515325f901a72b5f3a88a6cb23b603a7aa2ed25e07133214aeb3` | file |
| `manrope/files/manrope-greek-700-normal.woff2` | 5,236 | `b37807fe106dc58c57642635ae7ea172abe65b380fea7b8894615a5883b26ec5` | file |
| `manrope/files/manrope-latin-400-normal.woff` | 18,292 | `1bf66c29a29f1b71d507cb97fc138cd130b856ed05b55decd3a2944b413cb636` | file |
| `manrope/files/manrope-latin-400-normal.woff2` | 14,108 | `849290ef12a2eeb9af5c11924120d11aa4ae8b435ed3347d7fc8bc240c293ca3` | file |
| `manrope/files/manrope-latin-600-normal.woff` | 18,384 | `8d1f509774bca963fa02faf674678ce9244474306361ca2798583fa600346df6` | file |
| `manrope/files/manrope-latin-600-normal.woff2` | 14,172 | `f7ac6258da20ab7541939b59851155753d1d24f1b30cbcb949077a3faa3d1593` | file |
| `manrope/files/manrope-latin-700-normal.woff` | 18,412 | `e5d35fda4759b0d63ebcc6cca0627d98d9208254ce851c85df29e4d12aeafb61` | file |
| `manrope/files/manrope-latin-700-normal.woff2` | 14,212 | `d2a12c85a831e4b5db341767d0347fa3d1361d22a1fcb3e361a16b6c90080f71` | file |
| `manrope/files/manrope-latin-ext-400-normal.woff` | 11,316 | `143798f65cc631e6af5a77f0d34a2597bbef1ff1b24b73f6e6b12c2a79ebeb14` | file |
| `manrope/files/manrope-latin-ext-400-normal.woff2` | 8,292 | `72c5354a6f814f3bd38dc3d8caee774f7557b301e69d8428e677b7b73d58d9ee` | file |
| `manrope/files/manrope-latin-ext-600-normal.woff` | 11,248 | `80ff78480448f4c2c0f586cb016928554b8cd84b2b95dec5e5f7579274f757a0` | file |
| `manrope/files/manrope-latin-ext-600-normal.woff2` | 8,304 | `ff679412842fc3b5ce2dfad626db5261a4e663dcfd1bf1209bdfc61c2b2f37e6` | file |
| `manrope/files/manrope-latin-ext-700-normal.woff` | 11,352 | `b707ffc6454e54831a69d6c7db32d427b4a2bb914153c1f850fc4f888be7c35f` | file |
| `manrope/files/manrope-latin-ext-700-normal.woff2` | 8,276 | `dc7c46d7eb269cc90650d7f70cf49aafa39a98444e6882cc84096acbc156bfcd` | file |
| `manrope/files/manrope-vietnamese-400-normal.woff` | 6,108 | `1d4631ba5036c35a61c5e342f06d4ffffab85ac0e800fda9e0ceff8ef19aebea` | file |
| `manrope/files/manrope-vietnamese-400-normal.woff2` | 4,464 | `dcb0ae6367203b04f930051188cbe02e8096c42db99d5ab6b77f16287fb4fa1b` | file |
| `manrope/files/manrope-vietnamese-600-normal.woff` | 6,140 | `628a1c849748530c6f7c02c18bdd3191bc19264e20ad2308a8a954605cdb620b` | file |
| `manrope/files/manrope-vietnamese-600-normal.woff2` | 4,468 | `bce46331a74572cd723ddb8200a11c00e71370fad490f045564989527469aa3d` | file |
| `manrope/files/manrope-vietnamese-700-normal.woff` | 6,364 | `19bc9ab84376bb2f88eb858d4293c75dad965c70df7755d0a7f03d10080174b2` | file |
| `manrope/files/manrope-vietnamese-700-normal.woff2` | 4,552 | `36c3f8e0a1c59e1bc2fd2a9cabab5b478b488882beebb534e4bd1a8360bf845b` | file |
| `dm-mono/files/dm-mono-latin-400-normal.woff` | 11,212 | `1736dbec4c2da8403e7cf80523dbe77b00bff5fe9b3c0f2a953032ad5d84869a` | file |
| `dm-mono/files/dm-mono-latin-400-normal.woff2` | 14,820 | `e1896b13b2b1bb112fac2f9571bd6c40e118746e77a4511edbf43fbb41bf3e1e` | file |
| `dm-mono/files/dm-mono-latin-ext-400-normal.woff` | 7,500 | `5357dcba4e325c781acf79d15fd21f740f4abb7ca3f0fad88af774bd94a74e78` | file |
| `dm-mono/files/dm-mono-latin-ext-400-normal.woff2` | 9,552 | `a52e19ebe0398c9c0f8fa28a0c5e9a6bc324f35d9f0881c9aa407d10af447175` | file |
