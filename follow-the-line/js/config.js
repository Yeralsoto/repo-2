// The film, as one table. Every value is a position on the normalised scroll, 0 → 1.
// Order matters and is deliberate: road before driveways, driveways before homes,
// and each line of copy lands a little before the picture that answers it.
//
// Two stories share the engine:
//   film  — /follow-the-line/, the standalone piece with its own nine lines of copy
//   work  — /work/ (?story=work), where the page holds the copy and this file holds the pictures.
//           Its cue positions live in tools/build.py (WORK_STORY) — keep the two tables in step.

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const WORK = params.get('story') === 'work';

export const SCROLL_VH = 3200;   // standalone film length in viewport heights

export const COPY = [
  { at: 0.000, out: 0.044, text: 'What can this land become?' },
  { at: 0.050, out: 0.090, text: 'Before the road, there is only possibility.' },
  { at: 0.095, out: 0.176, text: 'Then someone draws a line.' },
  { at: 0.182, out: 0.268, text: 'Every line changes the answer.' },
  { at: 0.275, out: 0.410, text: 'An idea becomes a sequence.' },
  { at: 0.418, out: 0.548, text: 'A place is more than its parcels.' },
  { at: 0.715, out: 0.756, text: 'Eventually, the drawing disappears.' },
  { at: 0.762, out: 0.905, text: 'People simply call it home.' },
  { at: 0.918, out: 1.100, text: 'I tend to follow the line.' },
];

// Reduced motion: one still frame per line of copy (copy is chosen by index, not by position).
export const STAGES = [0.03, 0.075, 0.172, 0.262, 0.405, 0.705, 0.748, 0.845, 1.0];

const NEV = [2, 2.01];
const NEVER4 = [2, 2.01, 2, 2.01];
const ALW = [-1, -0.99];

// ---------------------------------------------------------------- the standalone film
const FILM = {
  stakes: [0.105, 0.135],
  boundary: [0.128, 0.180],
  constraints: [0.190, 0.222],
  access: [0.210, 0.242],
  buildable: [0.232, 0.262],
  layersOut: [0.272, 0.292],
  centerStakes: [0.280, 0.296],
  clearing: [0.290, 0.318],
  excavation: [0.310, 0.332],
  subgrade: [0.326, 0.346],
  aggregate: [0.342, 0.362],
  drainage: [0.358, 0.382],
  culverts: [0.378, 0.390],
  utilities: [0.386, 0.408],
  surface: [0.404, 0.428],
  stakesOut: [0.420, 0.432],
  lotClearing: [0.428, 0.448],
  lotLines: [0.446, 0.468],
  lotLegible: [0.462, 0.480],
  driveways: [0.476, 0.514],
  firstHomes: [0.512, 0.534],
  hero: {
    foundation: [0.550, 0.562], framing: [0.560, 0.584], roofStructure: [0.582, 0.597], walls: [0.595, 0.610],
    roof: [0.606, 0.617], windows: [0.614, 0.627], lift: [0.626, 0.633, 0.645, 0.653], interior: [0.630, 0.644], finish: [0.652, 0.668],
  },
  homesRest: [0.668, 0.706],
  landscaping: [0.688, 0.718],
  drawingOut: [0.722, 0.746],
  real: [0.734, 0.776],
  life: [0.772, 0.800],
  move: { carOut: [0.786, 0.850], carIn: [0.800, 0.862], traffic: [0.792, 0.946], bikes: [0.786, 0.884], walk: [0.780, 0.884] },
  growth: {
    crossroad: [0.846, 0.868],
    ruralHomes: [0.850, 0.872],
    school: { pad: [0.852, 0.860], access: [0.858, 0.867], building: [0.865, 0.879], parking: [0.875, 0.885], field: [0.881, 0.893] },
    park: [0.877, 0.893],
    subdivision2: [0.858, 0.888],
    retail: [0.880, 0.897],
  },
  expansion: { lines: [0.890, 0.912], infra: [0.898, 0.918] },
  network: { veil: [0.926, 0.944], lines: [0.929, 0.946], othersOut: [0.947, 0.955], dominantOut: [0.962, 0.968] },
  handoff: [0.953, 0.959],
  figures: [0.955, 1.0],
};
FILM.lotProof = FILM.network.lines;
FILM.deconstruct = { homes: NEV, framing: NEVER4, footprint: NEVER4, lots: FILM.network.othersOut, plat: FILM.network.othersOut, scene: FILM.network.veil };

// ---------------------------------------------------------------- The Work
// Two parts. THE STORY is authored below on its original 0–0.92 scale (the cue positions in
// tools/build.py use the same numbers) and squeezed into 0–0.72, so it reads faster. Every line of
// copy changes the land itself — evidence of growth, the parcel, constraints, the plat on the ground,
// phases, stakes, clearing, the road, finished lots, the first homes — while the approval path (the
// subdivision's own road, js/story.js) lights one milestone at a time; when the plat is recorded the camera
// comes down to one builder-ready lot, and homes follow only once the lots sell. THE ENDING (0.72–1) has no
// words: the street lives, the region keeps growing into new subdivisions, every
// scattered part of the work falls into its place on one chronology, the network freezes, and its one
// line becomes her mark, "I tend to follow the line." and her name.
//
// Stage map, story scale:
//   market .000–.090 · opportunity .085–.115 · feasibility .115–.165 · rules .165–.200 · plat .200–.240
//   underwriting .240–.300 · comps .300–.340 · pass .340–.370 · structure .370–.405 · partner .405–.430
//   closer .430–.465 · diligence .465–.490 · title .490–.525 · survey/civil .525–.570 · utilities .570–.600
//   timelines .600–.640 · execution .640–.720 · finished lots .720–.745 · market .745–.785
//   feedback .785–.820 · the wider market .820–.850 · the words .850–.920
// her ask (2026-09-14): the pass and the structure cycle are gone, and the story stretch they held (CUT) is
// taken out of the timeline, so nothing waits on an empty land. tools/build.py mirrors CUT and SQUEEZE.
export const STORY_END = 0.92, CUT = [0.340, 0.418], SQUEEZE = 0.72 / (STORY_END - (CUT[1] - CUT[0]));
const cut = (x) => (x <= CUT[0] ? x : Math.max(CUT[0], x - (CUT[1] - CUT[0])));
export const onStory = (x) => cut(x) * SQUEEZE;   // a story-scale moment → the Work film's scroll value (camera.js)
const sq = (v, key) => {
  if (key === 'k') return v;                                       // veil strengths are not positions
  if (typeof v === 'number') return v >= 0 && v <= STORY_END + 0.001 ? cut(v) * SQUEEZE : v;
  if (Array.isArray(v)) return v.map((x) => sq(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sq(x, k)]));
  return v;
};

const WORK_STORY_T = sq({
  // the evidence of growth arrives while the market is being read
  growth: {
    crossroad: ALW,
    ruralHomes: [0.040, 0.052],
    school: { pad: [0.042, 0.046], access: [0.045, 0.050], building: [0.048, 0.056], parking: [0.054, 0.058], field: [0.056, 0.062] },
    park: [0.048, 0.058], retail: [0.050, 0.060],
    subdivision2: [0.044, 0.066],
  },
  // one parcel, then what survives the questions: constraints, access, the buildable envelope
  boundary: [0.092, 0.108],
  constraints: [0.124, 0.146],
  // (no floating access or buildable sheets on The Work — she read them as a frame over the drawing)
  access: NEV,
  buildable: NEV,
  layersOut: [0.200, 0.208],
  // the plan lands on the ground as soon as it makes sense: lot lines and corner pins
  lotLines: [0.236, 0.250],
  // diligence walks the boundary; civil stakes the centreline and makes the frontage exact
  stakes: [0.468, 0.478],
  // …and where the utility beat was, the survey crews stake the centreline, with no words
  centerStakes: [0.572, 0.596],
  lotLegible: [0.540, 0.552],
  // several timelines on one piece of land: the clearing starts while they are planned
  clearing: [0.606, 0.636],
  // execution: earthwork → drainage → road base → utilities → culverts → driveways → final road → homesites
  excavation: [0.648, 0.660],
  subgrade: [0.658, 0.668],
  aggregate: [0.666, 0.674],
  drainage: [0.672, 0.684],
  utilities: [0.682, 0.694],
  culverts: [0.690, 0.696],
  driveways: [0.694, 0.704],
  surface: [0.702, 0.712],
  stakesOut: [0.708, 0.714],
  lotClearing: [0.710, 0.718],
  lawn: [0.716, 0.724],
  // the plat is recorded and the lots are finished: the camera comes down to one builder-ready lot — the
  // cleared pad, water and electric stubs, corner pins, the driveway culvert and apron, the finished road and a
  // for-sale stake (build.js readyLot). Her company never builds the homes (her correction, 2026-09-14): only
  // once the market takes the lots do the buyers' builders put houses up, lot by lot
  firstHomes: [0.778, 0.788],
  homesRest: [0.784, 0.806],
  // the next deal: a boundary, a future road, homesites — possibility again
  expansion: { lines: [0.826, 0.846], infra: [0.838, 0.850] },
  // the layers of judgment drawn over the land (js/story.js); four values = in-start, in-end, out-start, out-end
  story: {
    // milestones on the approval path, then it hands the land back to the region
    path: [0.108, 0.165, 0.238, 0.298, 0.463, 0.523, 0.568, 0.638, 0.743, 0.783],
    pathOut: [0.840, 0.850],
    signals: [0.046, 0.060, 0.084, 0.090],
    spotlight: [0.066, 0.082, 0.086, 0.092],
    opportunity: [0.096, 0.108, 0.110, 0.114],
    usable: [0.120, 0.126, 0.160, 0.165],
    usableSteps: [0.128, 0.133, 0.143, 0.148, 0.153],
    rulesNotes: [0.168, 0.178, 0.192, 0.198],
    layoutA: [0.176, 0.184], fail: [0.184, 0.188], layoutAOut: [0.189, 0.194],
    route: [0.186, 0.196, 0.196, 0.200],
    layoutB: [0.204, 0.214], morph: [0.222, 0.234], legible: [0.232, 0.238],
    aggressive: [0.246, 0.250, 0.253, 0.256],
    conservative: [0.254, 0.258, 0.260, 0.263],
    stress: [0.266, 0.274],
    respond: [0.272, 0.280, 0.286, 0.292],
    planOut: [0.294, 0.300],
    comps: [0.306, 0.316, 0.334, 0.340], compDiff: [0.316, 0.326], compFade: [0.326, 0.334],
    // (the pass and the structure cycle were removed — her ask, 2026-09-14; their stretch is CUT above)
    pass: NEVER4,
    structure: NEVER4, structureWords: NEV,
    closer: [0.418, 0.428, 0.460, 0.466], closerCollapse: [0.434, 0.446], closerAcross: [0.446, 0.458],
    // diligence is the boundary survey on the land (no diagram); the title and utility beats are gone
    civil: [0.512, 0.528, 0.564, 0.570], review: [0.540, 0.556], reviewChange: [0.548, 0.556],
    // entitlements in hand: the road base and the utilities start on the land (no failed shape — her ask)
    groundwork: [0.548, 0.562], groundworkNotes: [0.550, 0.553, 0.564, 0.570],
    // the builder-ready lot, named piece by piece in its close-up; then the buyer's builder, once lots sell
    ready: [0.733, 0.737, 0.752, 0.757], builders: [0.778, 0.781, 0.786, 0.790],
    lanes: [0.604, 0.618, 0.634, 0.640], laneDeps: [0.620, 0.632],
    schedule: [0.646, 0.654, 0.712, 0.718], problem: [0.676, 0.682], adjust: [0.684, 0.694],
    markets: [0.758, 0.764, 0.784, 0.790], contract: [0.764, 0.776], sold: [0.770, 0.784],
    feedback: [0.790, 0.796, 0.814, 0.820], outcomes: [0.796, 0.802], adjustModel: [0.806, 0.814],
    // Papel sheets over the model while a drawing or a diagram is on it — kept light so the land
    // is always seen changing underneath
    veils: [
      { w: [0.118, 0.126, 0.160, 0.165], k: 0.30 },
      { w: [0.165, 0.170, 0.294, 0.300], k: 0.45 },
      { w: [0.300, 0.306, 0.334, 0.340], k: 0.25 },
      { w: [0.414, 0.422, 0.460, 0.468], k: 0.55 },
      { w: [0.506, 0.512, 0.564, 0.570], k: 0.40 },
      { w: [0.598, 0.606, 0.634, 0.642], k: 0.50 },
      { w: [0.758, 0.764, 0.784, 0.790], k: 0.25 },
      { w: [0.784, 0.790, 0.816, 0.822], k: 0.45 },
      { w: [0.850, 0.856, 0.880, 0.886], k: 0.38 },
      { w: [0.886, 0.892, 0.914, 0.920], k: 0.45 },
    ],
  },
});

// the ending, on the final scale: the street the buyers' builders finished, life, the drive
// out to the public road, and then the region — the next site becomes a subdivision, another one
// starts beside the first comparable, and farther out new boundaries and roads are being drawn
const WORK_T = {
  ...WORK_STORY_T,
  landscaping: [0.724, 0.738],
  drawingOut: [0.728, 0.736],
  real: [0.730, 0.744],
  life: [0.738, 0.750],
  move: { carOut: [0.746, 0.772], carIn: [0.752, 0.778], traffic: [0.015, 1.0], bikes: [0.742, 0.786], walk: [0.740, 0.786] },
  growth: {
    ...WORK_STORY_T.growth,
    subdivision3: [0.780, 0.798], subdivision4: [0.786, 0.804], subdivision5: [0.792, 0.810], subdivision6: [0.798, 0.816],
  },
  expansion: { ...WORK_STORY_T.expansion, out: [0.776, 0.782], farLines: [0.804, 0.822], farInfra: [0.812, 0.830] },
  // the many parts, scattered, then ordered on one chronology (js/story.js) — and the film's own ending,
  // which on The Work settles on Verde (main.js: .ftl-green)
  network: { veil: [0.868, 0.884], lines: [0.870, 0.888], othersOut: [0.896, 0.904], dominantOut: [0.920, 0.926] },
  handoff: [0.910, 0.916],
  figures: [0.913, 1.0],
  story: {
    ...WORK_STORY_T.story,
    organize: { scatter: [0.832, 0.848], gather: [0.850, 0.872], out: [0.876, 0.886] },
    veils: [...WORK_STORY_T.story.veils, { w: [0.828, 0.840, 0.876, 0.888], k: 0.86 }],
  },
};
WORK_T.fixtures = [WORK_T.surface[1], WORK_T.surface[1] + 0.006];
WORK_T.lotProof = WORK_T.network.lines;
WORK_T.deconstruct = { homes: NEV, framing: NEVER4, footprint: NEVER4, lots: WORK_T.network.othersOut, plat: WORK_T.network.othersOut, scene: WORK_T.network.veil };

export const T = WORK ? WORK_T : FILM;

// Where the wider community sits. Fictional; kept rural and small.
export const SITES = {
  crossroadX: 640,
  school: { c: [330, 375], w: 210, d: 170 },
  park: { c: [-340, 335], w: 120, d: 110 },
  retail: { c: [712, 215], w: 110, d: 80 },
  sub2: { c: [1010, -15], w: 130, d: 270, x: 1010, top: 80, lots: 5, bulbZ: -110 },
  // The Work's ending: the next site becomes a subdivision, and another starts beside the first comparable
  sub3: { c: [-484, 10], w: 130, d: 300, x: -484, top: 110, lots: 6, bulbZ: -112 },
  sub4: { c: [1290, -20], w: 130, d: 260, x: 1290, top: 72, lots: 5, bulbZ: -118 },
  // and two south of the public road (dir 1: the street runs south)
  sub5: { c: [900, 262], w: 130, d: 290, x: 900, top: 152, lots: 6, bulbZ: 372, dir: 1 },
  sub6: { c: [-880, 290], w: 130, d: 280, x: -880, top: 214, lots: 5, bulbZ: 390, dir: 1 },
  rural: [[-575, 212], [-500, 218], [-425, 206], [-350, 213]],
  next: {
    poly: [[-690, 125], [-270, 132], [-250, -40], [-330, -190], [-560, -230], [-700, -120]],
    road: [[-480, 152], [-484, 30]],
    roadMore: [[-484, 30], [-470, -60], [-430, -140]],
  },
  // a property that was looked at and passed on (south of the public road)
  passed: [[-720, 252], [-468, 246], [-452, 430], [-702, 440]],
  // farther out, new boundaries and roads being drawn: side -1 north of the public road, 1 south
  far: [{ x: 1600, side: -1 }, { x: -1120, side: 1 }],
};

export function tier() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const narrow = matchMedia('(max-width: 760px)').matches;
  const lowMem = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  if (narrow || (coarse && lowMem)) {
    return { name: 'low', cell: 6, ring: 30, ringR: 700, trees: 1400, ringTrees: 900, farTrees: 450, shadow: 1024, dprMax: 1.5, framing: 0.5, life: 0.6 };
  }
  if (coarse || lowMem) {
    return { name: 'mid', cell: 5, ring: 22, ringR: 800, trees: 2600, ringTrees: 2200, farTrees: 900, shadow: 1536, dprMax: 1.75, framing: 0.75, life: 0.8 };
  }
  return { name: 'high', cell: 4, ring: 16, ringR: 900, trees: 4200, ringTrees: 4200, farTrees: 1700, shadow: 2048, dprMax: 2, framing: 1, life: 1 };
}
