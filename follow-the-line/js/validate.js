// The land-planning test. Rasterises the plan at 0.5 m and checks every lot against the brief:
// frontage, landlocking, home inside its own lot with setbacks, one driveway that stays in its
// own lot (or the right-of-way) and connects pavement to garage without touching anything else.
import { pointInPoly, distToPolyline, rowPolygons, pavementPolygons, sampleStrip, SETBACK, PUBLIC } from './layout.js';

const CELL = 0.5;

export function validate(L) {
  const X0 = -200, X1 = 200, Z0 = -280, Z1 = 175;
  const W = Math.ceil((X1 - X0) / CELL), H = Math.ceil((Z1 - Z0) / CELL);
  const idx = (i, j) => j * W + i;
  const cx = (i) => X0 + (i + 0.5) * CELL, cz = (j) => Z0 + (j + 0.5) * CELL;

  const lotOf = new Int16Array(W * H).fill(-1);
  const lotCount = new Uint8Array(W * H);
  const row = new Uint8Array(W * H);     // 1 = internal ROW, 2 = public ROW
  const pave = new Uint8Array(W * H);
  const home = new Int16Array(W * H).fill(-1);
  const drive = new Int16Array(W * H).fill(-1);
  const pond = new Uint8Array(W * H);

  function fill(poly, fn) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const i0 = Math.max(0, Math.floor((x0 - X0) / CELL)), i1 = Math.min(W - 1, Math.ceil((x1 - X0) / CELL));
    const j0 = Math.max(0, Math.floor((z0 - Z0) / CELL)), j1 = Math.min(H - 1, Math.ceil((z1 - Z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (pointInPoly([cx(i), cz(j)], poly)) fn(idx(i, j));
  }

  L.lots.forEach((lot) => fill(lot.poly, (k) => { lotCount[k]++; lotOf[k] = lot.id; }));
  const rp = rowPolygons(L);
  [rp.strip, rp.bulb, ...rp.flares].forEach((p) => fill(p, (k) => { row[k] = 1; }));
  // public road ROW: a band around z = pubZ(x)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = cx(i), z = cz(j);
    if (Math.abs(z - PUBLIC.z(x)) * PUBLIC.N[1] <= PUBLIC.half) row[idx(i, j)] = row[idx(i, j)] || 2;
  }
  const pp = pavementPolygons(L);
  [pp.strip, pp.bulb].forEach((p) => fill(p, (k) => { pave[k] = 1; }));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (Math.abs(cz(j) - PUBLIC.z(cx(i))) <= PUBLIC.pave) pave[idx(i, j)] = 1;
  }
  fill(L.pond, (k) => { pond[k] = 1; });
  L.lots.forEach((lot) => {
    if (lot.house) lot.house.footprint.forEach((r) => fill(r, (k) => { home[k] = lot.id; }));
    if (lot.drive) {
      const strip = stripPolys(lot.drive.path, lot.drive.width / 2);
      strip.forEach((p) => fill(p, (k) => { drive[k] = lot.id; }));
      stripPolys(lot.drive.apron, 2.4).forEach((p) => fill(p, (k) => { if (drive[k] === -1) drive[k] = lot.id; }));
    }
  });

  const checks = [];
  const perLot = [];
  let overlapCells = 0, lotInRow = 0, lotInPond = 0;
  for (let k = 0; k < W * H; k++) {
    if (lotCount[k] > 1) overlapCells++;
    if (lotOf[k] >= 0 && row[k]) lotInRow++;
    if (lotOf[k] >= 0 && pond[k]) lotInPond++;
  }

  // connectivity of the road network from the public road
  const reach = new Uint8Array(W * H);
  const stack = [];
  for (let k = 0; k < W * H; k++) if (row[k] === 2) { reach[k] = 1; stack.push(k); }
  while (stack.length) {
    const k = stack.pop(), i = k % W, j = (k - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nk = idx(ni, nj);
      if (!reach[nk] && row[nk]) { reach[nk] = 1; stack.push(nk); }
    }
  }

  for (const lot of L.lots) {
    const r = { id: lot.id, side: lot.side, area: Math.round(lot.area), fails: [] };
    // frontage: lot cells 4-adjacent to reachable ROW cells
    let front = 0, lotCells = 0, homeOut = 0, homeCells = 0, driveBad = 0, driveOther = 0, driveOnHome = 0, driveCells = 0;
    let driveTouchesPave = false, driveTouchesFrontage = false;
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = idx(i, j);
      if (lotOf[k] === lot.id) {
        lotCells++;
        if (reach[idx(i + 1, j)] || reach[idx(i - 1, j)] || reach[idx(i, j + 1)] || reach[idx(i, j - 1)]) front++;
      }
      if (home[k] === lot.id) { homeCells++; if (lotOf[k] !== lot.id || lotCount[k] > 1) homeOut++; }
      if (drive[k] === lot.id) {
        driveCells++;
        const inOwn = lotOf[k] === lot.id, inRow = row[k] > 0;
        if (!inOwn && !inRow) driveBad++;
        if (lotOf[k] >= 0 && lotOf[k] !== lot.id) driveOther++;
        if (home[k] >= 0 && home[k] !== lot.id) driveOnHome++;
        if (home[k] === lot.id) driveOnHome++;
        if (pave[k]) driveTouchesPave = true;
        if (inOwn && (row[idx(i + 1, j)] || row[idx(i - 1, j)] || row[idx(i, j + 1)] || row[idx(i, j - 1)])) driveTouchesFrontage = true;
      }
    }
    // Frontage length is measured on the true front line; the raster only proves it touches the
    // reachable road (a 0.5 m grid undercounts curved edges).
    let frontLine = 0;
    for (let i = 1; i < lot.front.length; i++) frontLine += Math.hypot(lot.front[i][0] - lot.front[i - 1][0], lot.front[i][1] - lot.front[i - 1][1]);
    r.touch = +(front * CELL).toFixed(1);
    r.frontage = +frontLine.toFixed(1);
    if (r.frontage < 15) r.fails.push(`frontage ${r.frontage} m`);
    if (r.touch < 5) r.fails.push(`frontage does not touch the road (${r.touch} m)`);
    if (!lot.house) r.fails.push('no home fits');
    if (!lot.drive) r.fails.push('no driveway');
    if (homeOut) r.fails.push(`home outside lot (${homeOut} cells)`);
    if (lot.house) {
      // setbacks, measured analytically
      let minFront = Infinity, minEdge = Infinity;
      for (const rect of lot.house.footprint) for (const p of rect) {
        minFront = Math.min(minFront, distToPolyline(p, lot.front));
        minEdge = Math.min(minEdge, distToPolyline(p, lot.poly, true));
      }
      r.frontSetback = +minFront.toFixed(1);
      r.edgeSetback = +minEdge.toFixed(1);
      if (minEdge < SETBACK.side - 0.01) r.fails.push(`home ${r.edgeSetback} m from lot line`);
      if (minFront < SETBACK.front - 1.6) r.fails.push(`front setback ${r.frontSetback} m`);
      let homeInPond = 0, homeInRow = 0;
      for (let k = 0; k < W * H; k++) if (home[k] === lot.id) { if (pond[k]) homeInPond++; if (row[k]) homeInRow++; }
      if (homeInPond || homeInRow) r.fails.push('home overlaps drainage/road');
    }
    if (lot.drive) {
      if (driveBad) r.fails.push(`driveway leaves lot+ROW (${driveBad})`);
      if (driveOther) r.fails.push(`driveway crosses another lot (${driveOther})`);
      if (driveOnHome > 2) r.fails.push(`driveway crosses a home (${driveOnHome})`);
      if (!driveTouchesPave) r.fails.push('driveway does not reach pavement');
      if (!driveTouchesFrontage) r.fails.push('driveway does not cross own frontage');
      // continuity: the garage end must be within 1 m of the house front
      const end = lot.drive.path[lot.drive.path.length - 1];
      const dHome = Math.min(...lot.house.footprint.map((rc) => distToPolyline(end, rc, true)));
      r.garageGap = +dHome.toFixed(2);
      if (dHome > 1.2) r.fails.push(`driveway stops ${r.garageGap} m short of garage`);
      // continuity along the path
      let gap = 0;
      for (let i = 1; i < lot.drive.path.length; i++) gap = Math.max(gap, Math.hypot(lot.drive.path[i][0] - lot.drive.path[i - 1][0], lot.drive.path[i][1] - lot.drive.path[i - 1][1]));
      if (gap > 5) r.fails.push('driveway has a gap');
      r.driveLen = +pathLen(lot.drive.path).toFixed(1);
      r.cells = driveCells;
    }
    if (!pointsInside(lot.poly, L.PARCEL)) r.fails.push('lot leaves parcel');
    perLot.push(r);
  }

  const failing = perLot.filter((r) => r.fails.length);
  checks.push(['lots', L.lots.length >= 16 && L.lots.length <= 20, `${L.lots.length} lots`]);
  checks.push(['every lot touches the road (frontage ≥ 15 m)', perLot.every((r) => r.frontage >= 15), `min ${Math.min(...perLot.map((r) => r.frontage))} m`]);
  checks.push(['no landlocked lots', perLot.every((r) => r.frontage > 0), '']);
  checks.push(['lots do not overlap', overlapCells < 40, `${overlapCells} shared edge cells`]);
  checks.push(['lots stay out of the right-of-way', lotInRow < 60, `${lotInRow} edge cells`]);
  checks.push(['lots stay out of the pond', lotInPond === 0, '']);
  checks.push(['every home inside its lot', perLot.every((r) => !r.fails.some((f) => f.startsWith('home'))), '']);
  checks.push(['every lot has one driveway', L.lots.every((l) => l.drive), '']);
  checks.push(['every driveway connects pavement → frontage → garage', perLot.every((r) => !r.fails.some((f) => f.includes('pavement') || f.includes('frontage') || f.includes('short') || f.includes('gap'))), '']);
  checks.push(['no driveway crosses a neighbour or a home', perLot.every((r) => !r.fails.some((f) => f.includes('crosses'))), '']);
  checks.push(['road network reaches every lot', perLot.every((r) => r.frontage > 0), '']);
  checks.push(['all lots inside the parcel', perLot.every((r) => !r.fails.includes('lot leaves parcel')), '']);
  return { ok: failing.length === 0 && checks.every((c) => c[1]), checks, perLot, failing };
}

function stripPolys(path, half) {
  const s = sampleStrip(path, half), out = [];
  for (let i = 0; i + 3 < s.length; i += 2) out.push([s[i], s[i + 2], s[i + 3], s[i + 1]]);
  return out;
}
function pathLen(p) { let d = 0; for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return d; }
function pointsInside(poly, outer) { return poly.every((p) => pointInPoly(p, outer)); }
