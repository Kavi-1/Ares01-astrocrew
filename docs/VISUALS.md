# ARES-01 Visuals, Assets and Audio

How the game looks and sounds, and how 3D assets get into it. Gameplay rules live in [GAMEPLAY.md](GAMEPLAY.md); rover numbers and sources in [NASA_ENGINEERING.md](NASA_ENGINEERING.md); setup and controls in [README.md](../README.md).

*Replaces the Mars Operations Visual Specification, the Asset Generation Plan and the visual sections of the old design guide (in git history at commit `c20aa4d`). Where those disagreed, the value used by the current code wins, and the choice is noted.*

## 1. Ground rules

| Rule | Decision |
| --- | --- |
| Look | Stylized realism: Mars-sunset palette, faceted low-poly rocks, dark HUD panels, cyan science markers, orange accents. Not photorealism |
| Rover | Perseverance-class with MMRTG power only. No solar panels anywhere |
| Units and axes | 1 Three.js unit = 1 metre. +Y up, **rover front = −Z** (matches the code), +X = rover right |
| Procedural first | Terrain, rocks, sky, dust and beacons are built in code. They never load files, so the game always runs |
| Imported models | Blender `.glb` files are allowed for the rover, props, crew and rooms (section 7). Every model needs a code-built fallback |
| Branding | No NASA logo, patches or NASA-attributed quotes in the game or on the rover. A small `ARES-01` plate is fine. Do not import the reference images in `design-references/`; they are art direction only |
| Number tags | Art dimensions are tagged DOC (NASA source), SEC (secondary source) or EST (visual estimate). EST values never appear in the UI as specifications |
| Tuning | Every art value lives in `src/ops/visual/config/visualConfig.ts` |
| Visual version | The improved scene is behind `?visual=v2`. **Open decision:** make it the default and remove the old path |

## 2. UI style

Taken from the eight reference images: dark navy/charcoal glass panels with thin cyan or orange borders, uppercase wide-tracked orange eyebrow labels, large white headings, one orange primary button per screen, teal checks for completed steps, green for positive changes, amber warnings, red failures.

- **One progress stepper on every screen**: Briefing → Engineering → Launch → Mars → Report.
- **Fonts:** Manrope for text, one monospace font for numbers. Load them; the CSS currently names Manrope without loading it.
- **Minimum text size 12 px** so the game is readable on a projector.
- **One set of colour tokens** shared by all screens. The CSS currently has two (`styles.css` and `nasa-flow.css`); merge them.
- **Resource bars** (mass, power, data, budget) go green → amber (under 10 percent margin) → red (failed check), matching the margin rules in GAMEPLAY.md.
- **Every number keeps its tag** (DOC, CALC, ASSUMED) as a badge or tooltip.

## 3. Rover

### 3.1 Proportions

| Part | Value | Tag |
| --- | --- | --- |
| Wheel diameter / width | 0.525 m / 0.2 m | DOC / EST |
| Grousers per wheel | 48 | DOC |
| Mast camera height | about 2.0 m above ground | DOC |
| Mastcam-Z stereo separation | 0.242 m | DOC |
| Overall size (L × W × H) | about 2.9 × 2.7 × 2.2 m | SEC |
| Track width / wheelbase | 2.32 m / 2.3 m | EST |
| Body (warm electronics box) | about 1.9 × 1.15 × 0.62 m | EST |
| Ground clearance / arm length | about 0.6 m / about 2.1 m | SEC |

The rover reads wide and low: big wheels, body raised on a visible rocker-bogie linkage.

### 3.2 Parts and instrument mounts

```
Rover root (position and heading from driving)
└─ Body (pitch and roll from terrain)
   ├─ Chassis, deck, differential bar
   ├─ Rocker L/R → front wheel (steers) and middle wheel; Bogie L/R → rear wheel (steers)
   ├─ Mast → Mastcam-Z pair, SuperCam aperture, Navcam pair, MEDA booms
   ├─ Arm (stowed in front) → turret with PIXL and SHERLOC
   ├─ MMRTG (aft, finned cylinder, always shown)
   ├─ Antennas: hexagonal high-gain paddle, UHF stub, low-gain stub
   └─ RIMFAX (rear underside); MOXIE is internal (panel glow while running)
```

Selected instruments show their mesh; unselected ones show a grey empty mount. Only the four corner wheels steer.

### 3.3 Materials

| Part | Colour | Metalness | Roughness |
| --- | --- | --- | --- |
| Chassis paint | #D8D6D0 | 0.1 | 0.55 |
| Suspension and mast (dark anodised) | #3A3D42 | 0.8 | 0.5 |
| Wheels (aluminium) | #B9BDC2 | 0.9 | 0.45 |
| MMRTG fins | #2B2D31 | 0.7 | 0.6 |
| Thermal blanket accent | #C98A2B | 0.4 | 0.35 |
| Lens glass | #0B1118 | 0.0 | 0.05 |

An environment map generated from the sky makes metals reflect the sky instead of looking black.

### 3.4 Motion

- **Suspension:** sample terrain height under each wheel; body pitch is the average of the left and right rocker angles, roll comes from left versus right contacts; smooth with damping so rocks feel weighty, not jittery. Clamp displayed tilt to 35 degrees.
- **Wheels** spin by distance travelled ÷ wheel radius; corner wheels steer, and point-turn when stationary.
- **Speed honesty:** the real rover drives at about 4.2 cm/s (DOC). The game is faster for playability (`speedScale` 107), so the HUD should say "simulation time × N".
- **Wear:** chassis and wheels tint slightly toward sand colour as distance grows (cap 25 percent).
- **Budget:** at most 40,000 triangles, 25 draw calls and 8 materials.

## 4. Terrain and world

- **One height function** (`src/game/terrain.ts`, `heightAt`) drives the mesh, wheel contact, rock placement, slope checks and camera clearance. What you see is what you drive on.
- **Size:** 420 m square, 288 segments (current code).
- **No height feature smaller than 2.5 m** in the function: fine detail goes in textures and rocks, otherwise the ground shimmers.
- **Slope limit:** **open decision.** The code blocks driving above 24 degrees (newer NASA driving update); GAMEPLAY.md uses 30 degrees (older NASA page). Pick one.
- **Palette:** sand light #D08A57, sand mid #B8603A, sand dark #8A3F25, basalt #4A3328, pink dust #D9A68A, rock light #A8825F, rock dark #5E4636.
- **Rocks:** 6 seeded, faceted variants (angular boulder, cobble, slab, layered, pebble, cluster), instanced, sunk 10 to 35 percent into the ground, colour-varied per instance, none within 6 m of the start. Only larger rocks are colliders.
- **Horizon:** layered ridge bands fading into haze; one landmark visible from the start.
- **Science targets:** layered outcrop (banded slabs), cyan double ring on the ground and an 18 m soft cyan beacon column visible through fog.
- **Tracks and dust:** 800 instanced track marks every 0.25 m; wheel dust above 0.3 m/s.
- **Landing site (not built):** flat pad, scorch decal, small lander prop, spawn point.

## 5. Atmosphere and lighting

- **Sun:** #FFE3C4, intensity about 2.6, elevation 38 degrees by default (12 to 18 degrees for cinematic moments and the report). Shadow map 2048 (1024 on Low), following the rover and snapped to texel size so edges do not shimmer.
- **Fill light:** sky #D9B79A, ground #5A2E1E, intensity about 0.55.
- **Sky:** gradient dome, horizon #D8A07A to zenith dusty mauve-grey, small sun disc with a faint blue halo (a real Martian sunset look).
- **Fog:** colour equals the horizon colour; density 0.0012 clear, 0.004 hazy or dust storm.
- **Dust storm (not built):** fog up, sun down 30 percent, sky toward tan over 3 seconds.
- **Tone mapping:** ACES filmic, sRGB output. Optional post effects: light bloom, slight desaturation, vignette, film grain. No ambient occlusion.

| Quality | Shadows | Rock instances | Post effects | Pixel ratio cap |
| --- | --- | --- | --- | --- |
| Low | 1024 | 800 | none | 1.0 |
| Medium (default) | 2048 | 2000 | bloom, grade, vignette | 1.5 |
| High | 2048 | 3500 | all | 2.0 |

## 6. Camera

| Setting | Value |
| --- | --- |
| Field of view | 42 degrees (47 in the intro) |
| Distance | 9.5 m default, 4.5 to 28 m zoom |
| Elevation | 24 degrees default, 6 to 65 degrees |
| Ground clearance | at least 0.8 m above the terrain |

- Show the rover, the ground ahead and the horizon in one frame.
- Frame-rate-independent smoothing; never roll the camera.
- While driving, the camera eases back behind the rover 2.5 s after the player stops dragging; after 20 s idle it slowly orbits.
- Near a science target, frame both rover and target.
- Controls are listed once, in the [README](../README.md#controls-on-mars).

## 7. Importing Blender models

### 7.1 Export rules (all models)

- **File → Export → glTF 2.0, glTF Binary (`.glb`)**, +Y Up on, transforms applied, no cameras or lights.
- **1 unit = 1 metre**; origin at the bottom centre (ground contact).
- **Principled BSDF materials only**; bake anything more complex into textures. Colour textures sRGB, data textures linear.
- Animations as named actions (`idle`, `talk`, `wave`, `celebrate`) pushed to the NLA editor.
- **Licences:** only CC0 or CC-BY (credit the author) for downloaded assets; record each in a credits list.

| Asset type | Triangles | Textures | File size |
| --- | --- | --- | --- |
| Rover | ≤ 40,000 | none, or one 1024 atlas | ≤ 2 MB |
| Crew character | ≤ 20,000 | ≤ 2048 | ≤ 5 MB |
| Room | ≤ 100,000 | ≤ 2048 | ≤ 15 MB |
| Prop | ≤ 20,000 | ≤ 1024 | ≤ 3 MB |

Whole scene on screen: at most about 400,000 triangles.

### 7.2 Loading rules

- Files go in `public/models/` (`rover.glb`, `crew/<name>.glb`, `env/<name>.glb`), listed in one manifest file with position, rotation and scale.
- Three.js `GLTFLoader` (already included with `three`) loads them; `AnimationMixer` plays animations.
- **Fail soft:** if a file is missing, broken or slow, log one clear message and keep the code-built fallback. One bad export must never break the game.
- Dispose geometry, materials and textures when swapping or leaving a scene.

### 7.3 Rover model contract

The following is the preferred contract for future rover exports, each pivot with identity rotation in the rest pose. The current supplied GLB uses its original names; `src/models/roverModel.ts` adapts those names and creates wheel pivots at runtime:

```
ARES01_Root
├─ Chassis
│  ├─ Mast_Pan ─ Mast_Tilt ─ Camera_Head (Mastcam_L, Mastcam_R, SuperCam, Anchor_Camera)
│  ├─ HGA_Pan ─ HGA_Tilt ─ HGA_Dish
│  ├─ Arm_J1_Yaw ─ Arm_J2_Pitch ─ Arm_J3_Elbow ─ Arm_J4_Wrist ─ Turret (PIXL, SHERLOC)
│  ├─ Rocker_L ─ Steer_FL ─ Wheel_FL, Wheel_ML; Bogie_L ─ Steer_RL ─ Wheel_RL
│  ├─ Rocker_R ─ Steer_FR ─ Wheel_FR, Wheel_MR; Bogie_R ─ Steer_RR ─ Wheel_RR
│  ├─ MMRTG, MEDA, RIMFAX
└─ Anchor_Chase
```

Wheels spin about local X; steering and mast pan rotate about local Y. Instrument nodes are named by instrument so they can be shown or hidden from the loadout.

### 7.4 Terrain rule

**Do not replace the ground with a Blender mesh.** The code-built terrain drives physics and checks. Blender is for decoration only: far cliffs, a lander, large rocks. A prop the rover can reach must be snapped to `heightAt` and given a collision radius.

## 8. Crew characters and rooms

- **Six crew characters**, one per teammate, each playing one seat from GAMEPLAY.md section 7. Used at crew pick (S1), briefing (S2), go/no-go (S4), station advice and the report (S8). Animations: idle, talk, gesture.
- **Open decision: VRM or plain `.glb`.** VRM (GAMEPLAY.md section 12) gives face expressions and lip sync but needs the Blender VRM add-on and the `@pixiv/three-vrm` library. Plain `.glb` is simpler. Decide before anyone exports.
- **Rooms:** start with one mission control room reused for crew pick, briefing, go/no-go and debrief. A hangar or workshop is optional. The engineering screen can swap its Mars background for the workshop.
- Characters and rooms are new scenes; they replace nothing that exists.

## 9. Audio (not built)

Synthesized with WebAudio, no audio files: wind ambience, motor hum scaled by speed, scan beeps, uplink chirp, success chime, countdown tones. Mute toggle.

## 10. Visual acceptance checks

| Check | Pass condition |
| --- | --- |
| Frame rate | 55 fps or more on a mid-range laptop at Medium; at least 30 fps on Low |
| Draw calls and triangles | At most 250 draw calls and 400,000 triangles in the main view |
| Ground | No shimmering pattern while driving at any zoom |
| Wheels | Each wheel within 2 cm of the terrain; smooth body pitch and roll |
| Camera | Never below ground clearance or through terrain |
| Instruments | Only selected instrument meshes appear; others show empty mounts |
| Rocks | None floating; none inside the 6 m start clearing |
| Seed | Same seed gives identical terrain, rocks and targets |
| Readability | Ground, rocks and rover separable in greyscale; HUD readable over every background |
| Quality switch | Low/Medium/High at runtime without crash or memory growth |


## 11. Supplied model integration

- **Rover:** `public/models/rover.glb` replaces the procedural visual in briefing, engineering, and surface operations once loaded. The source is in metres with +Y up and front +Z; the adapter rotates it to the game's −Z forward direction and aligns its bottom to the ground. Physics, terrain, collision limits, and energy calculations remain in the existing simulation.
- **Wheels:** the export combines six wheels by material in `Wheels_objs`. The adapter partitions those triangles into six wheels while preserving UVs/materials, centers each axle, and drives rolling and corner steering from the simulation. Suspension links retain their authored shape; they are not individually articulated.
- **Instruments:** named exterior nodes respond to Mastcam-Z, SuperCam, PIXL, SHERLOC (WATSON), and RIMFAX selection. MOXIE is internal; MEDA has no independently identifiable assembly in this export. These selections still affect the engineering model. Shared navigation cameras, power hardware, and antennas remain visible.
- **Crew:** briefing offers a crew-selection view, with six portrait cards and one selected 3D preview. Names/default seats are editable in `src/data/crew.ts`. The choice is saved with the campaign and appears in engineering advice and debrief; event advice is attributed to the relevant specialist. This implements presentation and hints, not the planned bot proposal/order system.
- **Poses:** the crew files are rigged but contain no animation clips. The preview retains the authored pose, including rigid uniform pieces. Idle/talk/gesture animations require compatible animated exports; do not animate body bones alone and leave rigid clothing behind.
- **Loading:** only the selected character model is loaded. The roster, hints and report use local PNG portraits rendered from the GLBs (about 480 KB combined). Downloaded GLB bytes are cached for up to three assets; each mounted viewer owns and disposes its geometries, materials, textures and renderer. Late loads are disposed after navigation. The procedural rover remains usable on loading failure; character failure has a retry and never blocks continuing.
- **Portrait refresh:** start Vite, then run `npm run assets:portraits`. Set `MODEL_PREVIEW_URL` if the preview uses a different port. Install a test browser with `npx playwright install chromium`, or set `CHROMIUM_PATH` to an existing executable.
- **Verification:** `npm run test:models` runs the asset/browser regressions using a temporary server on port 5176; `npm run test:engineering` covers equations, outcomes, campaign resets and saved crew selection.
