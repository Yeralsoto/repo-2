// FOLLOW THE LINE — the plan.
// Pure geometry, no three.js, so the planning logic can be validated on its own.
// Units are metres. x runs east, z runs south (three.js ground plane).
//
// Hierarchy, and the order everything is derived in:
//   PUBLIC ROAD → ENTRANCE → INTERNAL ROAD (curved spine + cul-de-sac)
//   → LOT FRONTAGE → LOT → HOME (fitted inside the lot) → DRIVEWAY (frontage → garage)
// Lots are cut perpendicular to the road from its right-of-way edge, so frontage is a
// property of how a lot is made, not something checked afterwards. validate.js checks anyway.

export const ROW_HALF = 9;        // internal right-of-way, 18 m
export const PAVE_HALF = 3.6;     // 7.2 m pavement
export const SWALE_OFF = 6.3;     // roadside swale centre, inside the ROW
export const BULB_ROW = 21;       // cul-de-sac right-of-way radius
export const BULB_PAVE = 15;      // cul-de-sac pavement radius
export const BULB_ISLAND = 6;     // planted island in the middle of the turnaround
export const PUB = { half: 15, pave: 3.8, z0: 152, slope: -0.035 };
export const SETBACK = { front: 10, side: 3, rear: 8 };

export const pubZ = (x) => PUB.z0 + PUB.slope * x;
const PUB_T = norm([1, PUB.slope]);
const PUB_N = [-PUB_T[1], PUB_T[0]];          // points south (+z)

// ---------- small vector kit ----------
export function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
export function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
export function mul(a, k) { return [a[0] * k, a[1] * k]; }
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
export function len(a) { return Math.hypot(a[0], a[1]); }
export function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l]; }
export function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distToSeg(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return len(sub(p, add(a, mul(ab, t))));
}
export function distToPolyline(p, pts, closed = false) {
  let d = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) d = Math.min(d, distToSeg(p, pts[i], pts[(i + 1) % pts.length]));
  return d;
}
export function polyArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a / 2);
}
export function centroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

// ---------- the land ----------
// Irregular outer parcel. Its south line is the public road's right-of-way edge.
function pubNorthEdge(x) { const c = [x, pubZ(x)]; return sub(c, mul(PUB_N, PUB.half)); }
const PARCEL = [
  pubNorthEdge(-168), [-176, 60], [-171, -40], [-150, -150], [-112, -238],
  [-40, -266], [48, -262], [118, -226], [152, -146], [146, -60],
  [164, 22], [160, 88], pubNorthEdge(158),
];

// Centerline control points: in from the public road, a gentle drift east, then the bulb.
const SPINE_CTRL = [
  [-20, pubZ(-20) + 20], [-20, pubZ(-20)], [-18, 104], [-9, 52], [7, 0],
  [22, -52], [29, -100], [25, -140], [21, -170],
];

function catmullRom(ctrl, per = 120) {
  const out = [];
  for (let i = 1; i < ctrl.length - 2; i++) {
    const [p0, p1, p2, p3] = [ctrl[i - 1], ctrl[i], ctrl[i + 1], ctrl[i + 2]];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t +
        (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 2]);
  return out;
}

function makeSpine(ctrlPts) {
  const dense = catmullRom(ctrlPts);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + len(sub(dense[i], dense[i - 1])));
  const S = cum[cum.length - 1];
  const pts = [];
  let j = 0;
  for (let s = 0; s <= S + 1e-6; s += 1) {
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    pts.push(lerp2(dense[j], dense[j + 1], Math.min(1, t)));
  }
  const samples = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = norm(sub(b, a));
    return { p, t, n: [-t[1], t[0]], s: i };       // n = right-hand normal (east when heading north)
  });
  const length = samples.length - 1;
  function at(s) {
    const c = Math.max(0, Math.min(length, s)), i = Math.min(length - 1, Math.floor(c)), f = c - i;
    const A = samples[i], B = samples[i + 1];
    const t = norm(lerp2(A.t, B.t, f));
    return { p: lerp2(A.p, B.p, f), t, n: [-t[1], t[0]], s: c };
  }
  const off = (s, d) => { const q = at(s); return add(q.p, mul(q.n, d)); };
  function offsetLine(s0, s1, d, step = 2) {
    const out = [];
    const n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / step));
    for (let k = 0; k <= n; k++) out.push(off(s0 + ((s1 - s0) * k) / n, d));
    return out;
  }
  function nearest(p) {
    let best = 0, bd = Infinity;
    for (const q of samples) { const d = len(sub(q.p, p)); if (d < bd) { bd = d; best = q.s; } }
    return at(best);
  }
  return { samples, length, at, off, offsetLine, nearest };
}

// ---------- house footprints ----------
// House-local coords: x along frontage (garage at +x before mirroring), z inward; front at -z.
export const VARIANTS = [
  { // A — long ranch, projecting garage, gable
    key: 'A', roof: 'gable',
    vols: [
      { kind: 'main', x: [-8.5, 2.3], z: [-4.2, 6.2], h: 3.1 },
      { kind: 'garage', x: [2.3, 8.5], z: [-6.0, 1.6], h: 2.8 },
    ],
    porch: { x: [-6.4, -0.6], z: [-6.2, -4.2] },
  },
  { // B — L-shape, flush garage wing, hip
    key: 'B', roof: 'hip',
    vols: [
      { kind: 'main', x: [-8.8, 1.0], z: [-5.0, 7.0], h: 3.2 },
      { kind: 'garage', x: [1.0, 8.2], z: [-5.0, 2.2], h: 2.8 },
    ],
    porch: { x: [-6.8, -1.6], z: [-6.9, -5.0] },
  },
  { // C — two volumes and a glazed link, low-slope roofs
    key: 'C', roof: 'shed',
    vols: [
      { kind: 'main', x: [-7.4, 0.2], z: [-5.8, 7.2], h: 3.6 },
      { kind: 'link', x: [0.2, 2.2], z: [-2.8, 3.4], h: 2.9 },
      { kind: 'garage', x: [2.2, 8.2], z: [-6.2, 0.6], h: 2.9 },
    ],
    porch: { x: [-6.2, -1.2], z: [-7.6, -5.8] },
  },
];

function variantRects(v, mirror) {
  const m = (x) => (mirror ? [-x[1], -x[0]] : x);
  const rects = v.vols.map((o) => ({ ...o, x: m(o.x) }));
  rects.push({ kind: 'porch', x: m(v.porch.x), z: v.porch.z, h: 0 });
  return rects;
}
function bounds(rects) {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const r of rects) { b.x0 = Math.min(b.x0, r.x[0]); b.x1 = Math.max(b.x1, r.x[1]); b.z0 = Math.min(b.z0, r.z[0]); b.z1 = Math.max(b.z1, r.z[1]); }
  return b;
}

// ---------- build the plan ----------
// opts.ctrl   another road alignment (the Work page sketches layouts that fail or can be improved)
// opts.sketch lots only — no house or driveway fitting
export function buildLayout(opts = {}) {
  const R = rng(20260912);
  const spine = makeSpine(opts.ctrl || SPINE_CTRL);
  const S = spine.length;
  const sBulb = S;                                   // bulb centre = end of spine
  const C = spine.at(sBulb).p;
  const back = mul(spine.at(sBulb).t, -1), nEnd = spine.at(sBulb).n;
  const sEnd = sBulb - Math.sqrt(BULB_ROW * BULB_ROW - ROW_HALF * ROW_HALF);

  // Where the internal ROW leaves the public ROW: first station whose ROW edges are both north of it.
  let sGate = 0;
  for (let s = 0; s < 60; s += 0.5) {
    const L = spine.off(s, -ROW_HALF), Rr = spine.off(s, ROW_HALF);
    if (L[1] < pubNorthEdge(L[0])[1] && Rr[1] < pubNorthEdge(Rr[0])[1]) { sGate = s; break; }
  }

  const insideParcel = (p, margin) => pointInPoly(p, PARCEL) && distToPolyline(p, PARCEL, true) >= margin;

  // --- spine lots, cut perpendicular to the road ---
  const lots = [];
  function spineSide(side, sStart, count, widthJitter, depthBase) {
    const raw = Array.from({ length: count }, () => 1 + (R() - 0.5) * widthJitter);
    const sum = raw.reduce((a, b) => a + b, 0);
    const span = sEnd - sStart;
    let s = sStart;
    const made = [];
    raw.forEach((w, i) => {
      const s0 = s, s1 = i === count - 1 ? sEnd : s + (w / sum) * span;
      s = s1;
      let depth = depthBase + (R() - 0.5) * 10;
      const ok = (d) => spine.offsetLine(s0, s1, side * (ROW_HALF + d), 4).every((p) => insideParcel(p, 8));
      while (!ok(depth) && depth > 34) depth -= 1;
      const front = spine.offsetLine(s0, s1, side * ROW_HALF, 2);
      const rear = spine.offsetLine(s1, s0, side * (ROW_HALF + depth), 2);
      made.push({ side: side > 0 ? 'E' : 'W', idx: i, s0, s1, depth, front, poly: [...front, ...rear] });
    });
    return made;
  }
  const east = spineSide(1, 92, 6, 0.22, 52);
  const west = spineSide(-1, 58, 7, 0.22, 50);

  // --- cul-de-sac pie lots; the first and last share their side line with the spine lots ---
  const frameBulb = (p) => { const d = sub(p, C); return [dot(d, back), dot(d, nEnd)]; };
  const atAngle = (phi, r) => add(C, add(mul(back, r * Math.cos(phi)), mul(nEnd, r * Math.sin(phi))));
  const eLast = east[east.length - 1], wLast = west[west.length - 1];
  const eStart = spine.off(sEnd, ROW_HALF), eRear = spine.off(sEnd, ROW_HALF + eLast.depth);
  const wStart = spine.off(sEnd, -ROW_HALF), wRear = spine.off(sEnd, -(ROW_HALF + wLast.depth));
  const phiE = Math.atan2(frameBulb(eStart)[1], frameBulb(eStart)[0]);
  const phiW = Math.atan2(frameBulb(wStart)[1], frameBulb(wStart)[0]) + Math.PI * 2;
  // The end wedges start from a side line parallel to the road normal, so they need a wider
  // angle than the middle wedges or they become slivers.
  const PIES = 5, WEIGHTS = [1.8, 1, 1, 1, 1.8];
  const wSum = WEIGHTS.reduce((a, b) => a + b, 0);
  const cuts = [phiE];
  WEIGHTS.forEach((w) => cuts.push(cuts[cuts.length - 1] + ((phiW - phiE) * w) / wSum));
  const arc = (a0, a1, r, step = 0.09) => {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
    return Array.from({ length: n + 1 }, (_, k) => atAngle(a0 + ((a1 - a0) * k) / n, r));
  };
  const pies = [];
  for (let k = 0; k < PIES; k++) {
    const a0 = cuts[k], a1 = cuts[k + 1];
    let depth = 46 + (R() - 0.5) * 8;
    const rearOk = (d) => arc(a0, a1, BULB_ROW + d, 0.05).every((p) => insideParcel(p, 8));
    while (!rearOk(depth) && depth > 30) depth -= 1;
    const front = arc(a0, a1, BULB_ROW);
    front[0] = k === 0 ? eStart : front[0];
    front[front.length - 1] = k === PIES - 1 ? wStart : front[front.length - 1];
    let poly;
    if (k === 0) poly = [...front, atAngle(a1, BULB_ROW + depth), eRear];
    else if (k === PIES - 1) poly = [...front, wRear, atAngle(a0, BULB_ROW + depth)];
    else poly = [...front, ...arc(a1, a0, BULB_ROW + depth, 0.05)];
    pies.push({ side: 'C', idx: k, s0: sBulb, s1: sBulb, depth, front, poly, phi: [a0, a1] });
  }

  // Order of construction: along the road from the entrance, then around the bulb.
  const ordered = [
    ...[...east, ...west].sort((a, b) => a.s0 - b.s0),
    ...pies,
  ];
  // key = side + position on that side: the same lot across different road alignments
  ordered.forEach((l, i) => { l.id = i; l.key = l.side + l.idx; l.area = polyArea(l.poly); lots.push(l); });

  // --- frames, homes, driveways ---
  const variantOrder = [0, 1, 2, 1, 0, 2, 0, 2, 1, 2, 1, 0, 1, 0, 2, 0, 1, 2];
  for (const lot of lots) {
    const A = lot.front[0], B = lot.front[lot.front.length - 1];
    const M = lerp2(A, B, 0.5);
    // The lot's axis is the mean of its two side lines, so a house faces the way the lot runs
    // (on a straight road this is the road normal; on an end wedge it follows the wedge, not the arc chord).
    const nf = lot.front.length;
    const sideA = norm(sub(lot.poly[lot.poly.length - 1], A));
    const sideB = norm(sub(lot.poly[nf], B));
    let V = norm(add(sideA, sideB));
    const U = [V[1], -V[0]];                              // so three's rotation maps local x→U, z→V
    lot.frame = { M, U, V, rotY: Math.atan2(-U[1], U[0]) };
    const toW = (u, v) => add(M, add(mul(U, u), mul(V, v)));
    lot.toWorld = toW;
    if (opts.sketch) continue;

    const frontLen = len(sub(B, A));
    const mirror = R() < 0.5;
    const uPref = (R() - 0.5) * Math.min(6, Math.max(0, frontLen - 26));
    const vExtra = R() * 5;
    // Preferred variant first; if it cannot sit inside this lot with its setbacks, try the others.
    const pref = variantOrder[lot.id % variantOrder.length];
    // Footprint grown by the side and rear setbacks must sit inside the lot; its front must clear the ROW.
    const fits = (rects, uc, vc) => {
      const g = SETBACK.side;
      for (const r of rects) {
        const xs = [r.x[0] - g, (r.x[0] + r.x[1]) / 2, r.x[1] + g], zs = [r.z[0] - g, (r.z[0] + r.z[1]) / 2, r.z[1] + SETBACK.rear];
        for (const x of xs) for (const z of zs) if (!pointInPoly(toW(uc + x, vc + z), lot.poly)) return false;
      }
      for (const r of rects) for (const x of r.x) for (const z of r.z) {
        if (distToPolyline(toW(uc + x, vc + z), lot.front) < SETBACK.front + (r.kind === 'porch' ? -1.5 : 0)) return false;
      }
      return true;
    };
    const SHIFTS = [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6, 7.5, -7.5, 9, -9, 10.5, -10.5, 12, -12];
    const drift = (R() - 0.5) * Math.min(7, Math.max(0, frontLen - 18));
    const frontV = (u) => {                                  // v of the front line at lateral position u
      let best = null;
      for (let i = 0; i < lot.front.length - 1; i++) {
        const a = lot.front[i], b = lot.front[i + 1];
        const ua = dot(sub(a, M), U), ub = dot(sub(b, M), U);
        if ((u - ua) * (u - ub) <= 0 && ua !== ub) {
          const t = (u - ua) / (ub - ua);
          const va = dot(sub(a, M), V), vb = dot(sub(b, M), V);
          best = va + (vb - va) * t;
        }
      }
      return best;
    };
    // Driveway: from the frontage straight in, easing sideways to the garage door.
    const tryDrive = (rc, uc, vc) => {
      const garage = rc.find((r) => r.kind === 'garage');
      const gx = (garage.x[0] + garage.x[1]) / 2, gw = garage.x[1] - garage.x[0];
      const uG = uc + gx, vG = vc + garage.z[0] - 0.6;
      const width = gw > 6.5 ? 5.4 : 4.2;
      for (const d of [drift, drift * 0.5, 0]) {
        const uF = uG + d, vF = frontV(uF);
        if (vF === null) continue;
        const path = [];
        const N = 18;
        for (let k = 0; k <= N; k++) {
          const t = k / N, e = t * t * (3 - 2 * t);   // leaves the road square to the frontage, arrives square to the garage
          path.push(toW(uF + (uG - uF) * e, vF + (vG - vF) * t));
        }
        // the first sample sits on the frontage line itself; test from just inside it
        if (sampleStrip(path.slice(1), width / 2 + 0.6).every((p) => pointInPoly(p, lot.poly))) {
          return { path, width, uF, vF, pad: { u: uG, v: vG, w: gw - 0.4 } };
        }
      }
      return null;
    };
    // Setback, variant, mirror and position are searched together: a spot counts only when the
    // house fits with its setbacks AND its own driveway runs from the frontage to the garage inside the lot.
    let found = null;
    search: for (const extra of [vExtra, 0]) {
      for (const vi of [pref, (pref + 2) % 3, (pref + 1) % 3]) {
        for (const mir of [mirror, !mirror]) {
          const rc = variantRects(VARIANTS[vi], mir), bb = bounds(rc);
          for (let v = SETBACK.front - bb.z0 + extra; v < lot.depth; v += 0.5) {
            for (const du of SHIFTS) {
              const uc = uPref + du;
              if (!fits(rc, uc, v)) continue;
              const dr = tryDrive(rc, uc, v);
              if (dr) { found = { variant: VARIANTS[vi], rects: rc, mir, uc, vc: v, drive: dr }; break search; }
            }
          }
        }
      }
    }
    if (!found) { lot.house = null; lot.drive = null; continue; }
    const { variant, rects, uc, vc, drive } = found;
    lot.house = {
      variant: variant.key, roof: variant.roof, mirror: found.mir, rects,
      uc, vc, pos: toW(uc, vc), rotY: lot.frame.rotY,
      family: (lot.id * 7 + 3) % 2, tint: R(),
      footprint: rects.map((r) => [toW(uc + r.x[0], vc + r.z[0]), toW(uc + r.x[1], vc + r.z[0]), toW(uc + r.x[1], vc + r.z[1]), toW(uc + r.x[0], vc + r.z[1])]),
    };
    // Apron: from the property line out across the ROW shoulder to the pavement edge.
    const F = drive.path[0];
    let P;
    if (lot.side === 'C') {
      P = add(C, mul(norm(sub(F, C)), BULB_PAVE - 0.8));
    } else {
      const q = spine.nearest(F);
      const side = lot.side === 'E' ? 1 : -1;
      P = add(q.p, mul(q.n, side * (PAVE_HALF - 0.8)));   // laps onto the pavement edge
    }
    drive.apron = [P, F];
    lot.drive = drive;
  }

  // --- drainage: roadside swales feed an outfall ditch into the pond by the entrance ---
  const pond = blob([44, 104], 34, 19, 0.28, 18, rng(7));
  const wetland = [[-168, 120], [-150, 70], [-146, 10], [-132, -60], [-138, -130], [-156, -150], [-171, -40], [-176, 60]];

  // Hero homesite: an east-side lot in the middle of the spine (seen from the road side).
  const hero = east[3].id;

  return {
    PARCEL, spine, S, sGate, sEnd, sBulb, C, back, nEnd,
    lots, pond, wetland, hero,
    entrance: spine.at(sGate).p,
    pubNorthEdge, PUB_T, PUB_N,
  };
}

function blob(c, rx, rz, wob, n, R) {
  const phase = R() * 6;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wob * 0.5 * Math.sin(a * 3 + phase) + wob * 0.3 * Math.sin(a * 5 + phase * 2);
    return [c[0] + Math.cos(a) * rx * k, c[1] + Math.sin(a) * rz * k];
  });
}

export function sampleStrip(path, half) {
  const out = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    const t = norm(sub(b, a)), n = [-t[1], t[0]];
    out.push(add(path[i], mul(n, half)), add(path[i], mul(n, -half)));
  }
  return out;
}

// Right-of-way as polygons (for drawing and rasterising): spine strip, bulb, curb returns.
export function rowPolygons(L) {
  const { spine } = L;
  const left = spine.offsetLine(0, L.sBulb, -ROW_HALF, 2);
  const right = spine.offsetLine(0, L.sBulb, ROW_HALF, 2);
  const strip = [...right, ...left.reverse()];
  const bulb = Array.from({ length: 128 }, (_, i) => {
    const a = (i / 128) * Math.PI * 2;
    return [L.C[0] + Math.cos(a) * BULB_ROW, L.C[1] + Math.sin(a) * BULB_ROW];
  });
  // Curb returns: small flares where the entrance meets the public road.
  const g = L.sGate;
  const flares = [-1, 1].map((side) => {
    const a = spine.off(g + 8, side * ROW_HALF);
    const b = spine.off(g - 2, side * (ROW_HALF + 8));
    const c = spine.off(g - 2, side * ROW_HALF);
    return [a, b, c];
  });
  return { strip, bulb, flares };
}
export function pavementPolygons(L) {
  const { spine } = L;
  const left = spine.offsetLine(0, L.sBulb, -PAVE_HALF, 2);
  const right = spine.offsetLine(0, L.sBulb, PAVE_HALF, 2);
  const bulb = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return [L.C[0] + Math.cos(a) * BULB_PAVE, L.C[1] + Math.sin(a) * BULB_PAVE];
  });
  return { strip: [...right, ...left.reverse()], bulb };
}
export const PUBLIC = { half: PUB.half, pave: PUB.pave, z: pubZ, N: PUB_N, T: PUB_T };
