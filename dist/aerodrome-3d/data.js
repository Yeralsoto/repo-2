// THE AERODROME — one geometry model for every drawing of it: her civil engineering thesis (Universidad
// Cooperativa de Colombia, 2022). The 2D plan, the voxel world, the aircraft's route and the labels all read
// this file, so the plan and the model can never drift apart.
//
// Local frame, in metres: x runs along the runway (+x toward threshold 13C, the top of Figure 19), z runs
// across it (the parallel taxiway lies on −z), y is up. Lengths are the thesis's design tables (pp.18–28).
// Its only plan of the final layout (Fig. 19, p.38) is not to scale along its length, so the sheet is used
// for how the parts connect and for where the rapid exits sit: measured on it, each exit leaves the runway
// 27.7% of the way from its far end and meets the taxiway at 12.4% — over the tabled 190 m separation that
// is the tabled 30° exit angle (Table 8, p.28). Nothing here is invented beyond that reading; the things the
// thesis does not design (an apron, a terminal layout, shoulders, lighting) are simply not built.

export const RUNWAY = { half: 2102.22 / 2, width: 45 };                     // declared distances, Table 7 p.24 · width, Table 3 p.20
export const STRIP = { beyond: 60, width: 150 };                             // Table 5, p.22
export const RESA = { length: 240, width: 90 };                              // Table 6, p.23
export const TAXI = { offset: 190, width: 15, bend: 69.24, hold: 90 };       // Tables 8–9, pp.25–27
export const EXIT = { runwayAt: RUNWAY.half - 0.277 * 2102.22, taxiwayAt: RUNWAY.half - 0.124 * 2102.22 };
export const XH = RUNWAY.half - 30;                                          // the end taxiways meet the runway just inside each end (Fig. 19)
export const EXTENT = { x0: -1450, x1: 1450, z0: -345, z1: 165 };
export const TYPE = { GROUND: 0, STRIP: 1, RESA: 2, RUNWAY: 3, TAXI: 4, PAD: 5, EXIT: 6 };

// ---------------------------------------------------------------- polylines
function seg(out, a, b, step = 10) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  for (let i = out.length ? 1 : 0; i <= n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
}
function arc(out, c, r, a0, a1, n = 18) {
  for (let i = out.length ? 1 : 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
}
function bez(out, p0, p1, p2, p3, n = 40) {
  for (let i = out.length ? 1 : 0; i <= n; i++) {
    const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
}
export function offsetLine(P, off) {
  return P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    return [p[0] - (tz / L) * off, p[1] + (tx / L) * off];
  });
}

// the end taxiway at +x, its 69.24 m bend, the full parallel taxiway, the bend and end taxiway at −x
export const LOOP = (() => {
  const P = [], hw = RUNWAY.width / 2, o = TAXI.offset, r = TAXI.bend;
  seg(P, [XH, -hw], [XH, -o + r]);
  arc(P, [XH - r, -o + r], r, 0, -Math.PI / 2);
  seg(P, [XH - r, -o], [-(XH - r), -o], 20);
  arc(P, [-(XH - r), -o + r], r, -Math.PI / 2, -Math.PI);
  seg(P, [-XH, -o + r], [-XH, -hw]);
  return P;
})();
// the two rapid exits: long reverse curves from the runway centreline onto the taxiway (Fig. 10, p.27)
export const EXITS = [1, -1].map((s) => {
  const P = [], xr = s * EXIT.runwayAt, xt = s * EXIT.taxiwayAt, k = (xt - xr) * 0.5;
  bez(P, [xr, 0], [xr + k, 0], [xt - k, -TAXI.offset], [xt, -TAXI.offset], 48);
  return P;
});
// the 90° taxiway at mid-runway (Table 9, p.27)
export const CONNECTOR = [[0, -RUNWAY.width / 2], [0, -TAXI.offset + TAXI.width / 2]];
// a holding bay outboard of each end, for two A321s at once (Fig. 8, p.25)
export const PADS = [1, -1].map((s) => [[s * (XH + 7.5), -TAXI.offset], [s * (XH - 130), -TAXI.offset - 7.5], [s * (XH - 55), -262], [s * (XH + 7.5), -262]]);

function nearest(P, x, z) {
  let best = Infinity, bestS = 0, acc = 0;
  for (let i = 1; i < P.length; i++) {
    const ax = P[i - 1][0], az = P[i - 1][1], dx = P[i][0] - ax, dz = P[i][1] - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2) || 1;
    let t = L2 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t - x, pz = az + dz * t - z, d = px * px + pz * pz;
    if (d < best) { best = d; bestS = acc + t * L; }
    acc += L;
  }
  return { d: Math.sqrt(best), s: bestS };
}
function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- the voxel world
export function classify(x, z) {
  const hw = RUNWAY.width / 2, tw = TAXI.width / 2, ax = Math.abs(x);
  if (ax <= RUNWAY.half && Math.abs(z) <= hw) return TYPE.RUNWAY;
  if (z < -hw && z > -TAXI.offset - tw - 1 && ax <= XH + tw + 1) {
    if (nearest(LOOP, x, z).d <= tw) return TYPE.TAXI;
    if (z >= -TAXI.offset + tw) {   // the connector flares toward 45 m where it meets the runway and the taxiway (Fig. 9)
      const d = Math.min(-hw - z, z + TAXI.offset - tw);
      if (ax <= tw + 15 * Math.max(0, 1 - d / 50)) return TYPE.TAXI;
    }
    for (const E of EXITS) {
      const n = nearest(E, x, z);
      if (n.d <= tw + 10 * Math.max(0, 1 - n.s / 90)) return TYPE.EXIT;
    }
  }
  for (const pad of PADS) if (inPoly(x, z, pad)) return TYPE.PAD;
  const beyond = ax - RUNWAY.half;
  if (beyond > STRIP.beyond && beyond <= STRIP.beyond + RESA.length && Math.abs(z) <= RESA.width / 2) return TYPE.RESA;
  if (beyond <= STRIP.beyond && Math.abs(z) <= STRIP.width / 2) return TYPE.STRIP;
  return TYPE.GROUND;
}
// every cell of the grid, classified — one normalized source for the whole model
export function voxelize(cell) {
  const out = [];
  for (let x = Math.ceil(EXTENT.x0 / cell) * cell; x <= EXTENT.x1; x += cell) {
    for (let z = Math.ceil(EXTENT.z0 / cell) * cell; z <= EXTENT.z1; z += cell) out.push({ x, z, t: classify(x, z) });
  }
  return out;
}

// ---------------------------------------------------------------- markings (thin top blocks)
const FONT = { 1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 3: ['XXX', '..X', '.XX', '..X', 'XXX'], C: ['XXX', 'X..', 'X..', 'X..', 'XXX'] };
function designator(text, end) {   // 13C at +x, read by an aircraft landing toward −x; 31C at −x
  const px = 3, cols = text.length * 4 - 1, out = [];
  [...text].forEach((ch, gi) => FONT[ch].forEach((row, r) => [...row].forEach((c, k) => {
    if (c !== 'X') return;
    const along = RUNWAY.half - 66 + r * px, across = (cols / 2 - (gi * 4 + k) - 0.5) * px;
    out.push({ x: end * along, z: end * across, w: px * 0.92, d: px * 0.92, lane: 'rw', f: 0.5 + 0.1 * r });
  })));
  return out;
}
function dashes(P, step, len, width, lane) {
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = cum[cum.length - 1], out = [];
  let j = 1;
  for (let d = step / 2; d < total; d += step) {
    while (j < cum.length - 1 && cum[j] < d) j++;
    const a = P[j - 1], b = P[j], t = (d - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    out.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, w: len, d: width, ry: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), lane, f: d / total });
  }
  return out;
}
export function markings() {
  const H = RUNWAY.half, out = [];
  for (let x = -H + 110; x <= H - 110; x += 50) out.push({ x, z: 0, w: 30, d: 1.2, lane: 'rw', f: (H - x) / (2 * H) });   // centreline
  for (const s of [1, -1]) {
    for (let k = 0; k < 6; k++) for (const side of [1, -1]) out.push({ x: s * (H - 21), z: side * (2.7 + k * 3.6), w: 30, d: 1.8, lane: 'rw', f: 0.1 * k });   // threshold stripes
    out.push({ x: s * XH, z: -TAXI.hold, w: 15, d: 1.2, lane: 'tw', f: 0.9 }, { x: s * XH, z: -TAXI.hold - 2.6, w: 15, d: 0.6, lane: 'tw', f: 0.9 });   // holding position
  }
  out.push(...designator('13C', 1), ...designator('31C', -1));
  out.push(...dashes(LOOP, 14, 7, 0.7, 'tw'), ...EXITS.flatMap((E) => dashes(E, 14, 7, 0.7, 'tw')), ...dashes(CONNECTOR, 14, 7, 0.7, 'tw'));
  return out;
}

// ---------------------------------------------------------------- restrained context
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function treeSpots(count) {
  const R = rng(4127), out = [];
  for (let i = 0; i < count * 8 && out.length < count; i++) {
    const x = EXTENT.x0 + 30 + R() * (EXTENT.x1 - EXTENT.x0 - 60), z = EXTENT.z0 + 20 + R() * (EXTENT.z1 - EXTENT.z0 - 40);
    const ax = Math.abs(x);
    if (Math.abs(z) < 110 && ax < RUNWAY.half + 340) continue;               // the strip and the safety areas stay clear
    if (z < 0 && z > -300 && ax < XH + 90) continue;                          // the taxiway system and its bays
    out.push({ x, z, s: 0.8 + R() * 0.55 });
  }
  return out;
}
export const VEHICLE = { x: XH - 170, z: -292, ry: 0.35 };

// ---------------------------------------------------------------- the aircraft's route (explicit, from the geometry)
export function route() {
  const P = [];
  bez(P, [XH - 40, -228], [XH - 8, -228], [XH, -222], [XH, -196], 24);     // out of the holding bay onto the end taxiway
  seg(P, [XH, -196], [XH, -TAXI.hold], 4);
  const holdAt = P.length - 1;
  seg(P, [XH, -TAXI.hold], [XH, -46], 4);
  const turnAt = P.length - 1;
  bez(P, [XH, -46], [XH, -14], [XH - 20, 0], [XH - 56, 0], 28);              // onto the centreline, facing along 31C
  const lineupAt = P.length - 1;
  seg(P, [XH - 56, 0], [-RUNWAY.half - 2200, 0], 6);                          // the runway, and the air beyond it
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { pts: P, cum, total: cum[cum.length - 1], hold: cum[holdAt], turn: cum[turnAt], lineup: cum[lineupAt] };
}

// ---------------------------------------------------------------- the 2D plan, drawn from the same geometry
export function planElements() {
  const H = RUNWAY.half, hw = RUNWAY.width / 2, tw = TAXI.width / 2;
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
  const close = (p) => [...p, p[0]];
  return [
    { id: 'centre', pts: [[-H, 0], [H, 0]], draw: [0.085, 0.135], fade: [0.525, 0.55], cls: 'cl' },
    { id: 'runway', pts: rect(-H, -hw, H, hw), draw: [0.14, 0.19], fade: [0.44, 0.47] },
    { id: 'strip', pts: rect(-H - STRIP.beyond, -STRIP.width / 2, H + STRIP.beyond, STRIP.width / 2), draw: [0.185, 0.215], fade: [0.40, 0.44], cls: 'faint' },
    { id: 'resa-a', pts: rect(H + STRIP.beyond, -RESA.width / 2, H + STRIP.beyond + RESA.length, RESA.width / 2), draw: [0.2, 0.225], fade: [0.4, 0.44], cls: 'faint' },
    { id: 'resa-b', pts: rect(-H - STRIP.beyond - RESA.length, -RESA.width / 2, -H - STRIP.beyond, RESA.width / 2), draw: [0.2, 0.225], fade: [0.4, 0.44], cls: 'faint' },
    { id: 'taxi-a', pts: offsetLine(LOOP, tw), draw: [0.22, 0.27], fade: [0.47, 0.5] },
    { id: 'taxi-b', pts: offsetLine(LOOP, -tw), draw: [0.22, 0.27], fade: [0.47, 0.5] },
    { id: 'conn-a', pts: [[-tw, -hw], [-tw, -TAXI.offset + tw]], draw: [0.245, 0.27], fade: [0.47, 0.5] },
    { id: 'conn-b', pts: [[tw, -hw], [tw, -TAXI.offset + tw]], draw: [0.245, 0.27], fade: [0.47, 0.5] },
    ...EXITS.flatMap((E, i) => [
      { id: `exit-${i}a`, pts: offsetLine(E, tw), draw: [0.26, 0.3], fade: [0.5, 0.52] },
      { id: `exit-${i}b`, pts: offsetLine(E, -tw), draw: [0.26, 0.3], fade: [0.5, 0.52] },
    ]),
    ...PADS.map((p, i) => ({ id: `pad-${i}`, pts: close(p), draw: [0.275, 0.3], fade: [0.5, 0.52] })),
    ...[1, -1].map((s) => ({ id: `hold-${s}`, pts: [[s * XH - tw, -TAXI.hold], [s * XH + tw, -TAXI.hold]], draw: [0.285, 0.3], fade: [0.51, 0.53] })),
  ];
}

// ---------------------------------------------------------------- beside El Dorado, in Bogotá (context — schematic)
// Her ask (2026-09): show where it was meant to be. The thesis places the annex past El Dorado's northwest end,
// across the Río Bogotá, parallel to its runways and between their lines — hence 13C (Ilustración 1, p.14; "only
// 4 km" from the base airport, Annex B p.46). El Dorado's two runways, 3,800 m × 45 m at 2,548 m, are from the
// thesis's own copy of the AIP (Annex C, p.50). How far apart they lie — about 1,395 m between centrelines, the
// northeast one beginning 1,323 m further southeast — is from their published runway-end coordinates
// (OurAirports). The river's course, the fields, the city and the Cerros Orientales are drawn schematically, to
// read the place, never to measure it. +x points 307° true and +z 37°: east is (−0.799, 0.602), north (0.602, 0.799).
const EAST = [-0.799, 0.602], NORTH = [0.602, 0.799];
const toLocal = (E, N) => [E * EAST[0] + N * NORTH[0], E * EAST[1] + N * NORTH[1]];
const toEN = (x, z) => [x * EAST[0] + z * EAST[1], x * NORTH[0] + z * NORTH[1]];

export const ELDORADO = (() => {
  const x0 = -RUNWAY.half - 600, z0 = -280;
  const runways = [{ x0, z: z0 }, { x0: x0 - 1323, z: z0 + 1395 }].map((r) => ({ x0: r.x0, x1: r.x0 - 3800, z: r.z }));
  return { runways, length: 3800, width: 45, elevation: 2548, centre: [x0 - 2320, z0 + 700] };
})();
export const RIVER = [[-760, 2400], [-1000, 1300], [-1330, 640], [-1490, 60], [-1500, -600], [-1620, -1300], [-1950, -2050], [-2450, -2850], [-2900, -3700], [-3300, -4800]];
export const CERROS = { E: 18200, N0: -9000, N1: 12000 };
export const PLACES = {
  annex: { x: 0, y: 40, z: 0 },
  eldorado: { x: ELDORADO.centre[0], y: 160, z: ELDORADO.centre[1] },
  river: { x: -1620, y: 30, z: -1300 },
  bogota: (() => { const [x, z] = toLocal(9000, 800); return { x, y: 120, z }; })(),
  cerros: (() => { const [x, z] = toLocal(CERROS.E + 900, 1500); return { x, y: 720, z }; })(),
};

// every block of the context: { kind, x, z, w, d, h (from the ground), ry?, f (build order 0–1), v (variant 0–1) }
export function bogota({ pitch = 140, field = 260 } = {}) {
  const R = rng(2548), out = [];
  const [rA, rB] = ELDORADO.runways, [cx, cz] = ELDORADO.centre;
  const inAirport = (x, z) => x > rB.x1 - 300 && x < rA.x0 + 300 && z > rA.z - 500 && z < rB.z + 500;
  const inAnnex = (x, z) => x > EXTENT.x0 - 60 && x < EXTENT.x1 + 60 && z > EXTENT.z0 - 60 && z < EXTENT.z1 + 60;
  const urban = (E, N) => E < CERROS.E - 1500 && N > -9000 && N < 10000 && (E > 1932 || (N < -1596 && E > -868));   // from Ilustración 1: fields west, city east and south
  const toRiver = (x, z) => nearest(RIVER, x, z).d;

  // El Dorado: two runways of 30 × 15 m blocks with their centreline dashes and strips; an apron, a terminal, a tower
  for (const r of ELDORADO.runways) {
    for (let x = r.x0 - 15; x > r.x1; x -= 30) for (const dz of [-15, 0, 15]) out.push({ kind: 'eld-rw', x, z: r.z + dz, w: 30, d: 15, h: 1.05, f: (r.x0 - x) / 3800, v: 0 });
    for (let x = r.x0 - 90; x > r.x1 + 60; x -= 60) out.push({ kind: 'eld-mark', x, z: r.z, w: 30, d: 2, h: 1.2, f: (r.x0 - x) / 3800, v: 0 });
    for (let x = r.x0 + 30; x > r.x1 - 60; x -= 60) for (const dz of [-120, -60, 60, 120]) out.push({ kind: 'eld-strip', x, z: r.z + dz, w: 60, d: 60, h: 0.5, f: (r.x0 - x) / 3800, v: 0 });
  }
  for (let x = cx - 540; x <= cx + 540; x += 60) for (let z = cz + 60; z <= cz + 360; z += 60) out.push({ kind: 'eld-apron', x, z, w: 60, d: 60, h: 0.85, f: R(), v: 0 });
  for (let x = cx - 330; x <= cx + 330; x += 60) for (const z of [cz + 420, cz + 480]) out.push({ kind: 'eld-term', x, z, w: 60, d: 60, h: 18 + Math.floor(R() * 3) * 4, f: R(), v: 0 });
  out.push({ kind: 'eld-tower', x: cx + 420, z: cz + 150, w: 18, d: 18, h: 70, f: 1, v: 0 });

  // the Río Bogotá, between the annex and El Dorado
  const total = RIVER.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - RIVER[i][0], p[1] - RIVER[i][1]), 0);
  let acc = 0;
  for (let i = 1; i < RIVER.length; i++) {
    const [ax, az] = RIVER[i - 1], [bx, bz] = RIVER[i], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(-(bz - az), bx - ax);
    for (let s = 0; s < L; s += 40) out.push({ kind: 'river', x: ax + ((bx - ax) * s) / L, z: az + ((bz - az) * s) / L, w: 46, d: 80, h: 0.45, ry, f: (acc + s) / total, v: 0 });
    acc += L;
  }

  // the Sabana's fields, west of the river
  for (let x = -4000; x <= 5200; x += field) for (let z = -4200; z <= 4200; z += field) {
    const [E, N] = toEN(x, z);
    if (urban(E, N) || inAirport(x, z) || inAnnex(x, z) || toRiver(x, z) < 100) continue;
    out.push({ kind: 'field', x, z, w: field - 12, d: field - 12, h: 0.35 + 0.1 * Math.floor(R() * 3), f: Math.min(1, Math.hypot(x, z) / 6000), v: R() });
  }

  // the city, on its compass grid of calles and carreras
  const ryE = Math.atan2(-EAST[1], EAST[0]);
  for (let E = -900; E < CERROS.E - 1500; E += pitch) for (let N = -9000; N < 10000; N += pitch) {
    if (!urban(E, N)) continue;
    const [x, z] = toLocal(E, N);
    if (inAirport(x, z) || inAnnex(x, z) || toRiver(x, z) < 140) continue;
    const r = R();
    if (r < 0.12) continue;   // parks and open blocks
    const s = pitch * (0.55 + 0.25 * R());
    out.push({ kind: 'city', x, z, w: s, d: s * (0.7 + 0.3 * R()), h: r > 0.97 ? 40 + R() * 50 : 6 + Math.floor(R() * 5) * 4, ry: ryE,
               f: Math.min(1, Math.hypot(x - cx, z - cz) / 18000), v: R() });
  }

  // the Cerros Orientales, stepping up to the east
  const ryN = Math.atan2(-NORTH[1], NORTH[0]);
  for (let N = CERROS.N0; N < CERROS.N1; N += 500) {
    const wob = Math.sin(N / 2300) * 500 + Math.sin(N / 900) * 180;
    for (let k = 0; k < 6; k++) {
      const [x, z] = toLocal(CERROS.E + wob + 400 * k, N);
      out.push({ kind: 'hill', x, z, w: 520, d: 3200 - 480 * k, h: 90 + 105 * k + R() * 40, ry: ryN, f: Math.min(1, k / 6 + R() * 0.1), v: k / 6 });
    }
  }
  return out;
}
