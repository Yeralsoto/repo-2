# Follow the Line

A scroll-scrubbed 3D film of one fictional piece of Northwest Florida land (after Jay, FL):
raw pine flatwoods → survey → underwriting layers → the road, built in order → lots, frontage,
driveways → one home assembled → a lived-in neighbourhood connected to the public road → the
region growing around it → a graphite network → one line that becomes an elevation, a stem, a
wireframe, a workflow, a ñ, and settles under *I tend to follow the line.*

No real parcel, no project, no labels, no signage.

## Run

Serve `repo 2/` over HTTP (ES modules):

    cd "repo 2" && python3 -m http.server 8743
    open http://localhost:8743/follow-the-line/

Review switches (all optional):

| URL | What it does |
|---|---|
| `?p=0.845` | pins the film to one frame, ignoring scroll |
| `?check` | runs the planning validator and logs PASS/FAIL to the console |
| `?reduced` | previews the reduced-motion version (still frames, Previous / Next) |
| `plan.html` | top-down plan with every lot, home and driveway, plus the validator report |

## Architecture

Plain ES modules and three.js r170 from jsDelivr, the same vanilla approach as the rest of the
site (this machine has no Node, and the site has no build step). Everything is procedural, so
there are no model files to download: about 170 KB of three.js plus about 120 KB of source.

    js/layout.js    the plan: curved spine, cul-de-sac, 18 lots cut from the right-of-way,
                    homes fitted with setbacks, a driveway per lot. Pure geometry, no three.js.
    js/validate.js  rasterises the plan at 0.5 m and checks every rule in the brief
    js/config.js    THE TIMELINE: every phase as a range on 0 → 1, the copy, the growth sites
    js/shaders.js   one uniform (uP) + per-instance timing attributes drive every animation
    js/world.js     voxel terrain with earthwork, pines, public road, farms, sky, sun
    js/build.js     survey, underwriting sheets, the road layer by layer, drainage,
                    utilities, lot lines, frontage, driveways, the real road
    js/houses.js    3 footprints × roof types × 2 facade families; the hero home in layers
    js/life.js      planting, mailboxes, porch lights, parked cars, and the network in use
    js/growth.js    crossroad, rural homes, school, rec field, shop, second neighbourhood,
                    the next site's lines and first road tiles, public-road traffic
    js/network.js   the freeze: veil, graphite network, the dominant line
    js/camera.js    one continuous camera: keyframes + monotone cubic interpolation
    js/overlay.js   the SVG line from road → parcel → figures → the line under the words
    js/main.js      scroll → p (damped), render on demand, adaptive DPR, reduced motion

**One number.** `p` is the scroll through the section. Terrain heights, colours, tree clearing,
road tiles, driveways, homes, cars, camera, copy, the veil and the SVG are all functions of `p`.
Nothing runs on a clock, so scrubbing backwards is exact and stopping freezes everything.

**Planning logic is proved, not styled.** Lots are cut perpendicular to the right-of-way, so
frontage is part of how a lot is made. Each home is searched into its lot with front, side and
rear setbacks. A spot is accepted only if that lot's own driveway also runs from its frontage to
the garage without leaving the lot. `validate.js` then checks the result on a raster:

- frontage of at least 15 m for every lot
- no overlaps and no landlocked lots
- every home inside its own lot, at least 3 m from its lot lines
- one driveway per lot, touching the pavement and its own frontage, ending at its garage
- no driveway on a neighbour or a home
- the whole road network connected to the public road

Current result: 18 / 18 lots pass (`plan.html`).

## Performance

Instancing throughout (terrain columns, trees, road tiles, studs, planting), merged geometry per
home, one shadowed sun whose frustum follows the camera's focus, render only when `p` changes,
DPR that steps down when frames are slow, a build of about 1–2 s. Three quality tiers
(`config.js → tier()`) scale block size, tree counts, shadow map, framing density and life
details; phones get the low tier.

## Accessibility

The copy is a semantic `<ol>` outside WebGL and reads in order without JS or WebGL.
`prefers-reduced-motion` (or `?reduced`) turns the film into nine still frames with Previous /
Next buttons and arrow keys. Focus rings are kept, touch targets are 44 px, and there is no
horizontal scroll.

## On The Work (`/work/`)

The Work page is this film told as her skillset, with no list of skills. The page holds the words and
the film holds the pictures:

- `tools/build.py → WORK_STORY` has 34 short cues (EN + ES), each with an arrival and departure on
  the story's 0 → 1 scroll, plus a still-frame position for reduced motion.
- `js/motion.js` (site) turns page scroll into p, toggles the cues (fade + 16 px rise, 720 ms), and
  posts `{p, lang, still}` into the iframe `follow-the-line/?embed&story=work`.
- `js/config.js → WORK_T` is the picture timeline for that story. The wider area (school, crossroad,
  shop, rec field, rural homes) exists from the start; construction is compressed; `T.story` holds
  the windows for the editorial layers.
- `js/story.js` draws those layers in the drafting language:
  - underwriting notes;
  - a road that ignores the land and fails;
  - the obvious straight layout rearranging, lot for lot, into the validated plan;
  - dependencies that resolve when the work they wait on is done;
  - roles gathering around the project;
  - a messy handoff loop that straightens and automates down to one judgment point;
  - a line drawing of a city climbing into mountains;
  - trace veils so lines read over the model.

Keep `WORK_STORY` and `WORK_T` in step: text arrives, then the picture answers.

## Toward production

- Author hero assets (the hero home, a pine family, a car) in Blender → GLB with Meshopt and KTX2,
  and swap them in where the procedural geometry is built.
- Bake ambient occlusion for the terrain and homes.
- Link the page from the site's index and nav (not done: `tools/build.py` generates those pages).
- Confirm the canonical domain before adding canonical / OG tags.
