// Everything that is drawn or built on the land, in the order it really happens:
// survey → parcel line → underwriting layers → road (stakes, clearing, excavation, subgrade,
// aggregate, drainage, culverts, utilities, surface) → lots → frontage → driveways.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { life, MODE, C, setLife } from './shaders.js';
import { T, WORK } from './config.js';
import {
  PUBLIC, ROW_HALF, PAVE_HALF, SWALE_OFF, BULB_ROW, BULB_PAVE, BULB_ISLAND,
  rng, add, sub, mul, norm, len, dot, pointInPoly, rowPolygons,
} from './layout.js';
import { GRADE } from './world.js';
import { box, merge, paint, ribbon, resample, lerpT, stagger, NEVER, IN_ALWAYS, instanced, trs } from './kit.js';
import { homeTimes } from './houses.js';

// One builder-ready lot, as places on the land: what her company leaves for the buyer's builder.
// build.js builds it on every lot (The Work), camera.js frames the featured one, story.js names its parts.
export function readyLot(L, lot) {
  const { U, V, rotY } = lot.frame;
  const mid = lot.front[Math.floor(lot.front.length / 2)];
  const toW = (u, v) => add(mid, add(mul(U, u), mul(V, v)));
  const F = lot.drive ? lot.drive.apron[1] : mid;
  const sd = dot(sub(F, mid), U) >= 0 ? -1 : 1;           // stubs and stake stand away from the driveway
  let pad = null;
  if (lot.house) {
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const r of lot.house.footprint) for (const p of r) {
      const d = sub(p, mid), u = dot(d, U), v = dot(d, V);
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    pad = { c: toW((u0 + u1) / 2, (v0 + v1) / 2), w: u1 - u0 + 5, d: v1 - v0 + 5 };
  }
  let culvert = null;
  if (lot.drive && lot.side !== 'C') {
    const [P, Fp] = lot.drive.apron;
    culvert = add(P, mul(norm(sub(Fp, P)), SWALE_OFF - (PAVE_HALF - 0.8)));
  }
  const road = L.spine.at(L.spine.nearest(mid).s).p;
  return { lot, mid, rotY, pad, culvert, road, pin: lot.front[0], water: toW(sd * 4, 2.4), power: toW(sd * 8, 2.4), sign: toW(sd * 10, 3.4) };
}

const PAVE_TOP = GRADE + 0.31;

export function buildSite(L, reg, tier, terrain) {
  const group = new THREE.Group();
  const R = rng(4242);
  const S = L.S;
  const fS = (s) => Math.max(0, Math.min(1, s / S));
  const lotF = (lot) => lot.id / (L.lots.length - 1);
  const realMid = (T.real[0] + T.real[1]) / 2;
  const OUT_REAL = [realMid, T.real[1]];
  const jc = (hex, k = 0.035) => new THREE.Color(hex).offsetHSL(0, 0, (R() - 0.5) * k);
  // The Work: when each lot's home arrives (after it sells) — the driveway past the apron and the lot's stake follow it
  const homeT = WORK ? homeTimes(L) : null;

  // Height for drawn lines: on graded ground just above the grade, elsewhere above the local blocks.
  const lineY = (p, afterGrading) => {
    const a = terrain.at(p[0], p[1]);
    if (afterGrading && (a.kind === 1 || a.kind === 2 || a.kind === 6)) return GRADE + 0.14;
    let m = -Infinity;
    for (const dx of [-4, 0, 4]) for (const dz of [-4, 0, 4]) {
      const b = terrain.at(p[0] + dx, p[1] + dz);
      m = Math.max(m, afterGrading ? b.dev : Math.max(b.raw, b.dev));
    }
    return m + 0.3;
  };
  const dense = (pts, closed, step = 3) => {
    const P = closed ? [...pts, pts[0]] : pts;
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], n = Math.max(1, Math.ceil(len(sub(b, a)) / step));
      for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    out.push(P[P.length - 1]);
    return out;
  };

  // ---------- drawn lines ----------
  // Drafting lines are a drawing laid over the model, like trace over a maquette: they are not
  // hidden by canopy or blocks, so the line reads the moment it is drawn.
  const lineMat = (color, opacity = 1) => life(new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, depthWrite: false, depthTest: false, transparent: true, opacity, toneMapped: false,
  }), MODE.DRAW);
  const lines = (items, color, opacity, order = 2) => {
    const geos = items.map(({ geo, t }) => setLife(geo, t));
    const mesh = new THREE.Mesh(mergeGeometries(geos), lineMat(color, opacity));
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const sheetMat = (color, opacity) => life(new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }), MODE.DROP, { drop: 16 });
  const shapeGeo = (poly, y) => {
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    return g;
  };

  // parcel boundary — first drawing, and the proof / final survey line later
  const parcelPts = dense(L.PARCEL, true, 4);
  const parcelY = (p) => lineY(p, false);
  lines([{ geo: ribbon(parcelPts, 1.6, parcelY), t: [...T.boundary, ...T.drawingOut] }], C.graphite, 1, 3);
  const proofInk = WORK ? C.papel : C.graphite;   // the freeze is Papel on Verde on The Work
  lines([{ geo: ribbon(parcelPts, 1.6, parcelY), t: [...T.lotProof, ...T.network.othersOut] }], proofInk, 1, 61);
  const parcel3D = parcelPts.map((p) => new THREE.Vector3(p[0], parcelY(p), p[1]));

  // ---------- survey stakes ----------
  const stakeGeo = merge([box(0.4, 3.4, 0.4, 0, 0, 0, 0xC9A57C), box(1.1, 0.55, 0.08, 0.55, 2.7, 0, C.arcilla)]);
  const stakes = [];
  L.PARCEL.forEach((p, i) => {
    const a = terrain.at(p[0], p[1]);
    stakes.push({ m: trs(p[0], Math.max(a.raw, a.dev), p[1], R() * 6.28), t: [...stagger(T.stakes, i / (L.PARCEL.length - 1), 0.25), ...T.drawingOut] });
  });
  for (let s = 20; s < S; s += 20) {
    const q = L.spine.at(s);
    for (const side of [-1, 1]) {
      const p = add(q.p, mul(q.n, side * ROW_HALF));
      const a = terrain.at(p[0], p[1]);
      stakes.push({ m: trs(p[0], Math.max(a.raw, a.dev), p[1], R() * 6.28, 0.75, 0.75, 0.75), t: [...stagger(T.centerStakes, fS(s), 0.25), ...T.stakesOut] });
    }
  }
  const pins = new Map();
  for (const lot of L.lots) {
    for (const p of [lot.front[0], lot.front[lot.front.length - 1]]) {
      const key = p.map((v) => Math.round(v)).join(',');
      if (!pins.has(key)) pins.set(key, { p, f: lotF(lot) });
    }
  }
  for (const { p, f } of pins.values()) stakes.push({ m: trs(p[0], GRADE, p[1], R() * 6.28, 0.6, 0.6, 0.6), t: [...stagger(T.lotLines, f, 0.25), ...T.drawingOut] });
  {
    const g = stakeGeo.clone();
    const arr = new Float32Array(stakes.length * 4);
    stakes.forEach((s, i) => arr.set(s.t, i * 4));
    g.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
    const m = instanced(g, life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), MODE.POP), stakes.map((s) => s.m));
    group.add(m);
  }

  // ---------- underwriting layers, stacked like sheets of trace ----------
  const layer = (range, y, build) => {
    const span = range[1] - range[0];
    const sheetT = [range[0], range[0] + span * 0.4, ...T.layersOut];
    const lineT = [range[0] + span * 0.35, range[1], ...T.layersOut];
    build({ y, sheetT, lineT });
  };
  // 1 — constraints: wetland and its buffer, the natural low ground, where water goes
  layer(T.constraints, 7, ({ y, sheetT, lineT }) => {
    const sheets = [setLife(shapeGeo(L.wetland, y), sheetT)];
    const lowArea = L.pond.map((p) => add(p, mul(sub(p, centroidOf(L.pond)), 0.55)));
    sheets.push(setLife(shapeGeo(lowArea, y + 0.05), sheetT));
    group.add(orderMesh(new THREE.Mesh(mergeGeometries(sheets.map(stripToLife)), sheetMat(0x6F8E86, 0.34)), 1));
    const hatch = hatchLines(L.wetland, 9).map((seg) => ({ geo: ribbon(seg, 0.5, y + 0.1), t: lineT }));
    hatch.push({ geo: ribbon(offsetPoly(L.wetland, 15), 0.55, y + 0.1, { closed: true, dash: [6, 4] }), t: lineT });
    lines(hatch, 0x4C6B64, 1);
    const flows = [
      [[-70, -170], [-30, -90], [5, 10], [30, 80]],
      [[96, -150], [76, -50], [60, 36], [50, 86]],
      [[-120, 30], [-60, 64], [-4, 92], [16, 102]],
      [[130, 40], [100, 70], [80, 96]],
    ];
    const flowItems = [];
    for (const f of flows) {
      const smoothF = catmull(f);
      flowItems.push({ geo: ribbon(smoothF, 0.7, y + 0.12, { dash: [5, 3.5] }), t: lineT });
      const e = smoothF[smoothF.length - 1], d = norm(sub(e, smoothF[smoothF.length - 3]));
      const nrm = [-d[1], d[0]];
      flowItems.push({ geo: ribbon([add(e, add(mul(d, -5), mul(nrm, 3.2))), e, add(e, add(mul(d, -5), mul(nrm, -3.2)))], 0.7, y + 0.12), t: lineT });
    }
    lines(flowItems, 0x4C6B64, 1);
  });
  // 2 — access and utilities: frontage on the public road, the entrance, sight lines, existing service
  layer(T.access, 13, ({ y, sheetT, lineT }) => {
    const e = L.entrance;
    const band = [];
    for (let x = -176; x <= 166; x += 6) band.push([x, PUBLIC.z(x) - PUBLIC.half]);
    const bandPoly = [...band, ...band.slice().reverse().map(([x, z]) => [x, z - 22])];
    group.add(orderMesh(new THREE.Mesh(stripToLife(setLife(shapeGeo(bandPoly, y), sheetT)), sheetMat(0xE9E2D3, 0.42)), 1));
    const items = [];
    items.push({ geo: ribbon(band, 1.8, y + 0.1), t: lineT });                        // frontage on the public road
    const circle = Array.from({ length: 40 }, (_, i) => [e[0] + Math.cos((i / 40) * 6.283) * 10, e[1] + Math.sin((i / 40) * 6.283) * 10]);
    items.push({ geo: ribbon(circle, 0.7, y + 0.12, { closed: true }), t: lineT });
    lines(items, C.arcilla, 1, 4);
    const grey = [];
    for (const dir of [-1, 1]) {
      const a = [e[0], PUBLIC.z(e[0]) - 2], b = [e[0] + dir * 150, PUBLIC.z(e[0] + dir * 150) - 2];
      grey.push({ geo: ribbon([a, b], 0.55, y + 0.1, { dash: [4, 3] }), t: lineT });  // sight distance
    }
    const center = [];
    for (let s = 0; s <= S; s += 3) center.push(L.spine.at(s).p);
    grey.push({ geo: ribbon(center, 0.8, y + 0.1, { dash: [8, 5] }), t: lineT });     // proposed alignment
    lines(grey, C.graphite, 1, 3);
    const util = [];
    const pole = [], water = [];
    for (let x = -176; x <= 166; x += 8) { pole.push([x, PUBLIC.z(x) + 12.5]); water.push([x, PUBLIC.z(x) - 10.5]); }
    util.push({ geo: ribbon(pole, 0.55, y + 0.1, { dash: [3, 2] }), t: lineT });
    lines(util, C.laton, 1, 3);
    lines([{ geo: ribbon(water, 0.55, y + 0.1, { dash: [3, 2] }), t: lineT }], C.pipeWater, 1, 3);
  });
  // 3 — the buildable envelope: setbacks off the parcel, the road and the wetland
  layer(T.buildable, 19, ({ y, sheetT, lineT }) => {
    // parcel inset 12 m, then cut by the road setback (south) and the wetland buffer (west)
    let wetEast = -Infinity;
    for (const p of L.wetland) wetEast = Math.max(wetEast, p[0]);
    const roadSetback = PUBLIC.z(0) - PUBLIC.half - 22;
    let env2 = clipHalf(offsetPoly(L.PARCEL, -12), (p) => roadSetback - p[1]);
    env2 = clipHalf(env2, (p) => p[0] - (wetEast + 15));
    group.add(orderMesh(new THREE.Mesh(stripToLife(setLife(shapeGeo(env2, y), sheetT)), sheetMat(C.papel, 0.26)), 1));
    lines([{ geo: ribbon(env2, 0.7, y + 0.1, { closed: true, dash: [7, 4] }), t: lineT }], C.graphite, 1, 3);
  });

  // ---------- the internal road ----------
  const slabs = [];
  const addSlab = (x, y, z, ry, sx, sy, sz, color, tIn, tOut = OUT_REAL) => slabs.push({ m: trs(x, y, z, ry, sx, sy, sz), c: color, t: [...tIn, ...tOut] });
  let sStart = 0;
  for (let s = 0; s < 40; s += 0.5) { const p = L.spine.at(s).p; if (p[1] < PUBLIC.z(p[0]) - PUBLIC.pave - 0.3) { sStart = s; break; } }
  const sStop = S - BULB_ISLAND - 0.5;
  const LAYERS = [
    { w: 2 * PAVE_HALF + 2.4, y: GRADE, h: 0.12, color: C.clay, range: T.subgrade },
    { w: 2 * PAVE_HALF + 1.2, y: GRADE + 0.12, h: 0.1, color: C.aggregate, range: T.aggregate },
    { w: 2 * PAVE_HALF, y: GRADE + 0.22, h: 0.09, color: C.asphalt, range: T.surface },
  ];
  const TILE = 4;
  for (const ly of LAYERS) {
    for (let s = sStart; s < sStop - 0.01; s += TILE) {
      const l = Math.min(TILE, sStop - s), q = L.spine.at(s + l / 2);
      addSlab(q.p[0], ly.y, q.p[1], Math.atan2(-q.t[1], q.t[0]), l + 0.12, ly.h, ly.w, jc(ly.color), stagger(ly.range, fS(s), 0.12));
    }
    // the turnaround, laid in rings around the island
    const rOut = BULB_PAVE + (ly.w - 2 * PAVE_HALF) / 2, rIn = BULB_ISLAND;
    const rows = Math.max(1, Math.round((rOut - rIn) / 2.8)), rw = (rOut - rIn) / rows;
    for (let k = 0; k < rows; k++) {
      const r = rIn + rw * (k + 0.5), n = Math.max(10, Math.ceil((2 * Math.PI * r) / 3.8));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        addSlab(L.C[0] + Math.cos(a) * r, ly.y, L.C[1] + Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a)),
          (2 * Math.PI * r) / n + 0.1, ly.h, rw + 0.06, jc(ly.color), stagger(ly.range, 0.9 + 0.1 * (i / n), 0.12));
      }
    }
  }
  // entrance flare onto the public road
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const q = L.spine.at(sStart + k * 2.2);
      const off = PAVE_HALF + (3 - k) * 1.1;
      const p = add(q.p, mul(q.n, side * (off - (3 - k) * 0.55)));
      addSlab(p[0], GRADE + 0.22, p[1], Math.atan2(-q.t[1], q.t[0]), 2.3, 0.09, (3 - k) * 1.1 + 0.2, jc(C.asphalt), stagger(T.surface, 0, 0.12));
    }
  }
  // swales in the right-of-way, both sides, and the outfall ditch to the pond
  const sEnd = L.sEnd;
  for (let s = sStart + 4; s < sEnd; s += TILE) {
    const q = L.spine.at(s + 2);
    for (const side of [-1, 1]) {
      const p = add(q.p, mul(q.n, side * SWALE_OFF));
      addSlab(p[0], GRADE - 0.02, p[1], Math.atan2(-q.t[1], q.t[0]), TILE + 0.1, 0.07, 2.1, jc(C.swale), stagger(T.drainage, fS(s) * 0.7, 0.15), NEVER);
    }
  }
  const outA = L.spine.off(sStart + 14, SWALE_OFF);
  const pondEdge = L.pond.reduce((best, p) => (len(sub(p, outA)) < len(sub(best, outA)) ? p : best), L.pond[0]);
  const ditch = resample([outA, add(lerpPt(outA, pondEdge, 0.5), [0, -4]), pondEdge], 2.2).out;
  ditch.forEach((o, i) => addSlab(o.p[0], GRADE - 0.04, o.p[1], o.ang, 2.4, 0.07, 1.9, jc(0x6C7C55), stagger(T.drainage, 0.7 + 0.3 * (i / ditch.length), 0.1), NEVER));

  // driveways, one by one: apron from the pavement edge, across the frontage, up to the garage
  const culverts = [];
  const drivePaths = [];
  for (const lot of L.lots) {
    if (!lot.drive) continue;
    const [d0, d1] = stagger(T.driveways, lotF(lot), 0.12);
    const [P, F] = lot.drive.apron;
    const full = [P, ...lot.drive.path];
    const { out, total } = resample(full, 1.6);
    const apronLen = len(sub(F, P));
    const ht = homeT && homeT.get(lot.id);
    out.forEach((o) => {
      const t0 = d0 + (d1 - d0) * (o.d / total) * 0.8;
      const inApron = o.d < apronLen;
      const k = Math.min(1, o.d / apronLen);
      const w = inApron ? 6.6 + (lot.drive.width - 6.6) * k : lot.drive.width;
      const h = inApron ? 0.3 - 0.18 * k : 0.12;
      // The Work: the builder-ready lot has its apron; the drive up to a garage is laid by the buyer's builder
      if (!inApron && ht) {
        const tb = ht[0] + (ht[1] - ht[0]) * 0.35 * ((o.d - apronLen) / Math.max(1, total - apronLen));
        addSlab(o.p[0], GRADE, o.p[1], o.ang, 1.72, h, w, jc(C.concrete, 0.025), [tb, tb + (ht[1] - ht[0]) * 0.1]);
      } else addSlab(o.p[0], GRADE, o.p[1], o.ang, 1.72, h, w, jc(C.concrete, 0.025), [t0, t0 + (d1 - d0) * 0.2]);
    });
    drivePaths.push({ lot, full, d0, d1 });
    if (lot.side !== 'C') {
      const dir = norm(sub(F, P));
      const c = add(P, mul(dir, SWALE_OFF - (PAVE_HALF - 0.8)));
      // pipe axis runs with the road, i.e. across the apron
      culverts.push({ p: c, ang: Math.atan2(-dir[0], -dir[1]), len: 8.2, t: [d0, d0 + (d1 - d0) * 0.15] });
    }
  }
  // the entrance culvert under the public road's swale
  {
    const e = L.entrance;
    const c = [e[0], PUBLIC.z(e[0]) - 10.5];
    culverts.push({ p: c, ang: Math.atan2(-PUBLIC.T[1], PUBLIC.T[0]), len: 13, t: T.culverts, entrance: true });
  }
  // public road swales, existing, broken where the entrance crosses
  for (let x = -300; x <= 300; x += 4) {
    if (Math.abs(x - L.entrance[0]) < 7) continue;
    for (const side of [-1, 1]) {
      const z = PUBLIC.z(x) + side * 10.5;
      addSlab(x, GRADE - 0.02, z, Math.atan2(-PUBLIC.T[1], PUBLIC.T[0]), 4.1, 0.07, 2.4, jc(C.swale), IN_ALWAYS, NEVER);
    }
  }

  {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const arr = new Float32Array(slabs.length * 4);
    slabs.forEach((s, i) => arr.set(s.t, i * 4));
    g.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
    const m = instanced(g, life(new THREE.MeshStandardMaterial({ roughness: 0.92 }), MODE.DROP, { drop: 2.4, edge: 0.05 }), slabs.map((s) => s.m), { colors: slabs.map((s) => s.c) });
    m.receiveShadow = true;
    group.add(m);
  }

  // culverts: a pipe with a headwall at each end
  {
    const parts = [];
    const pipe = new THREE.CylinderGeometry(0.42, 0.42, 1, 12); pipe.rotateZ(Math.PI / 2);
    const items = [];
    for (const cv of culverts) {
      const ang = cv.entrance ? cv.ang : cv.ang;
      items.push({ m: trs(cv.p[0], GRADE + 0.1, cv.p[1], ang, cv.len, 1, 1), c: new THREE.Color(0xB8B1A3), t: [...cv.t, ...NEVER] });
      for (const e of [-1, 1]) {
        const ex = cv.p[0] + Math.cos(ang) * e * cv.len / 2, ez = cv.p[1] - Math.sin(ang) * e * cv.len / 2;
        items.push({ m: trs(ex, GRADE - 0.2, ez, ang, 0.35, 1.2, 2.2), c: new THREE.Color(0xC9C2B3), t: [...cv.t, ...NEVER], box: true });
      }
    }
    const pipeItems = items.filter((i) => !i.box), wallItems = items.filter((i) => i.box);
    const mk = (geo, list) => {
      const arr = new Float32Array(list.length * 4);
      list.forEach((s, i) => arr.set(s.t, i * 4));
      geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
      group.add(instanced(geo, life(new THREE.MeshStandardMaterial({ roughness: 0.7 }), MODE.POP), list.map((s) => s.m), { colors: list.map((s) => s.c) }));
    };
    mk(pipe, pipeItems);
    const wb = new THREE.BoxGeometry(1, 1, 1); wb.translate(0, 0.5, 0);
    mk(wb, wallItems);
    void parts;
  }

  // ---------- pond ----------
  {
    const water = new THREE.Mesh(setLife(shapeGeo(L.pond, -0.45), [lerpT(T.drainage, 0.5), T.drainage[1], ...NEVER]),
      life(new THREE.MeshStandardMaterial({ color: C.water, roughness: 0.18, metalness: 0.05 }), MODE.DROP, { drop: -1.2 }));
    water.receiveShadow = true;
    group.add(water);
    const rim = resample([...L.pond, L.pond[0]], 2.6).out;
    const rip = rim.map((o, i) => ({ m: trs(o.p[0], -0.1, o.p[1], o.ang + (R() - 0.5) * 0.4, 1.6 + R() * 0.8, 0.7, 1.1 + R() * 0.6), c: jc(0x9D978A, 0.06), t: [...stagger(T.drainage, i / rim.length, 0.2), ...NEVER] }));
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    const arr = new Float32Array(rip.length * 4);
    rip.forEach((s, i) => arr.set(s.t, i * 4));
    g.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
    group.add(instanced(g, life(new THREE.MeshStandardMaterial({ roughness: 0.95 }), MODE.POP, { edge: 0.12 }), rip.map((s) => s.m), { colors: rip.map((s) => s.c) }));
  }

  // ---------- utilities: open trench, pipes, laterals to every lot, then covered ----------
  {
    // covered once the road is surfaced (on The Work the lot lines are drawn long before)
    const covered = WORK ? [T.surface[1], T.surface[1] + 0.006] : [T.surface[1], T.lotLines[0]];
    const pipes = [];
    const mains = [{ off: 8.1, color: C.pipeWater }, { off: -8.1, color: C.pipePower }];
    const trench = [];
    for (const mn of mains) {
      const pts = [];
      for (let s = sStart; s < sEnd; s += 6) {
        const q = L.spine.at(s + 3), p = add(q.p, mul(q.n, mn.off));
        pipes.push({ m: trs(p[0], GRADE + 0.18, p[1], Math.atan2(-q.t[1], q.t[0]), 6.05, 1, 1), c: new THREE.Color(mn.color), t: [...stagger(T.utilities, fS(s), 0.15), ...covered] });
        pts.push(L.spine.off(s, mn.off));
      }
      pts.push(L.spine.off(sEnd, mn.off));
      trench.push({ geo: ribbon(pts, 1.7, GRADE + 0.06), t: [T.utilities[0], T.utilities[1], ...covered] });
    }
    // laterals from the water main to each lot's frontage (west lots cross under the road)
    const mainEnd = L.spine.off(sEnd, 8.1);
    for (const lot of L.lots) {
      const mid = lot.front[Math.floor(lot.front.length / 2)];
      const tgt = add(mid, mul(lot.frame.V, 1.5));
      const from = lot.side === 'C' ? mainEnd : L.spine.off(L.spine.nearest(mid).s, 8.1);
      const d = sub(tgt, from), l = len(d), c = lerpPt(from, tgt, 0.5);
      pipes.push({ m: trs(c[0], GRADE + 0.14, c[1], Math.atan2(-d[1], d[0]), l, 0.55, 0.55), c: new THREE.Color(C.pipeWater), t: [...stagger(T.utilities, 0.55 + 0.45 * lotF(lot), 0.2), ...covered] });
    }
    lines(trench, 0x6F5C49, 1, 1);
    const g = new THREE.CylinderGeometry(0.32, 0.32, 1, 8); g.rotateZ(Math.PI / 2);
    const arr = new Float32Array(pipes.length * 4);
    pipes.forEach((s, i) => arr.set(s.t, i * 4));
    g.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
    group.add(instanced(g, life(new THREE.MeshStandardMaterial({ roughness: 0.55 }), MODE.DROP, { drop: 2 }), pipes.map((s) => s.m), { colors: pipes.map((s) => s.c) }));

    // what stays above ground: hydrants on the water side, pad transformers on the power side
    const fixtures = [];
    for (const s of [sStart + 40, S * 0.5, sEnd - 10]) {
      const p = L.spine.off(s, 8.4);
      fixtures.push({ m: trs(p[0], GRADE, p[1], 0, 0.55, 1.0, 0.55), c: new THREE.Color(0xB9A36E), t: [...stagger(T.fixtures || T.lotLines, fS(s), 0.2), ...NEVER] });
    }
    L.lots.filter((l) => l.side === 'W' && l.id % 2 === 0).forEach((lot) => {
      const p = L.spine.off(lot.s0, -8.3);
      fixtures.push({ m: trs(p[0], GRADE, p[1], 0, 1.3, 1.1, 1.1), c: new THREE.Color(0x7E8A7A), t: [...stagger(T.fixtures || T.lotLines, lotF(lot), 0.2), ...NEVER] });
    });
    const fg = new THREE.BoxGeometry(1, 1, 1); fg.translate(0, 0.5, 0);
    const fa = new Float32Array(fixtures.length * 4);
    fixtures.forEach((s, i) => fa.set(s.t, i * 4));
    fg.setAttribute('aLife', new THREE.InstancedBufferAttribute(fa, 4));
    group.add(instanced(fg, life(new THREE.MeshStandardMaterial({ roughness: 0.7 }), MODE.POP, { edge: 0.12 }), fixtures.map((s) => s.m), { colors: fixtures.map((s) => s.c) }));
  }

  // ---------- The Work: builder-ready lots — what her company leaves for the buyer's builder ----------
  // a cleared pad where the house can go, a water riser with its meter box and an electric pedestal at the
  // frontage, and a for-sale stake facing the road that comes down when the lot sells (the pad goes under the
  // home when the buyer's builder starts). Corner pins, the apron and culvert and the finished road already stand.
  if (WORK) {
    const items = [];
    const soil = new THREE.Color(C.clay);
    for (const lot of L.lots) {
      const rl = readyLot(L, lot), f = lotF(lot), ht = homeT.get(lot.id);
      const tf = stagger(T.fixtures, f, 0.3);
      if (rl.pad) items.push({ m: trs(rl.pad.c[0], GRADE - 0.02, rl.pad.c[1], rl.rotY, rl.pad.w, 0.2, rl.pad.d), c: soil, t: [...stagger(T.lotClearing, f, 0.3), ...(ht ? [ht[0], ht[0] + 0.003] : NEVER)] });
      // (drawn a little larger than life, like everything in this model, so they read from the close-up)
      items.push({ m: trs(rl.water[0], GRADE, rl.water[1], rl.rotY, 0.5, 1.7, 0.5), c: new THREE.Color(C.pipeWater), t: [...tf, ...NEVER] });
      items.push({ m: trs(rl.water[0], GRADE, rl.water[1], rl.rotY, 1.3, 0.5, 1.0), c: new THREE.Color(0x9A9386), t: [...tf, ...NEVER] });
      items.push({ m: trs(rl.power[0], GRADE, rl.power[1], rl.rotY, 1.0, 1.6, 0.8), c: new THREE.Color(C.pipePower), t: [...tf, ...NEVER] });
      const sold = ht ? [ht[0] - 0.004, ht[0]] : NEVER;
      items.push({ m: trs(rl.sign[0], GRADE, rl.sign[1], rl.rotY, 0.3, 3.0, 0.3), c: new THREE.Color(0xC9A57C), t: [...tf, ...sold] });
      items.push({ m: trs(rl.sign[0], GRADE + 1.6, rl.sign[1], rl.rotY, 2.8, 1.5, 0.16), c: new THREE.Color(0xF5EFE4), t: [...tf, ...sold] });
      items.push({ m: trs(rl.sign[0], GRADE + 2.75, rl.sign[1], rl.rotY, 2.8, 0.28, 0.2), c: new THREE.Color(0x8F7546), t: [...tf, ...sold] });
    }
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    const arr = new Float32Array(items.length * 4);
    items.forEach((s, i) => arr.set(s.t, i * 4));
    g.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
    group.add(instanced(g, life(new THREE.MeshStandardMaterial({ roughness: 0.85 }), MODE.POP, { edge: 0.1 }), items.map((s) => s.m), { colors: items.map((s) => s.c) }));
  }

  // centreline, dashed, while the road is being staked and built
  {
    const pts = [];
    for (let s = 0; s <= S; s += 3) pts.push(L.spine.at(s).p);
    lines([{ geo: ribbon(pts, 0.7, (p) => lineY(p, false) + 0.2, { dash: [6, 4] }), t: [...T.centerStakes, T.surface[0], T.surface[1]] }], C.graphite, 1, 3);
  }

  // ---------- lots, frontage, right-of-way: drawn, then later redrawn as proof ----------
  const rp = rowPolygons(L);
  const rowEdges = [
    L.spine.offsetLine(sStart, sEnd, -ROW_HALF, 2),
    L.spine.offsetLine(sStart, sEnd, ROW_HALF, 2),
    Array.from({ length: 97 }, (_, i) => [L.C[0] + Math.cos((i / 96) * 6.2832) * BULB_ROW, L.C[1] + Math.sin((i / 96) * 6.2832) * BULB_ROW]),
  ];
  void rp;
  const yLot = () => GRADE + 0.16;
  const rowLines = (t) => rowEdges.map((pts) => ({ geo: ribbon(pts, 0.55, yLot), t }));
  lines(rowLines(WORK ? [T.lotLines[0], T.lotLines[1], ...T.drawingOut] : [T.lotClearing[0], T.lotLines[0], ...T.drawingOut]), C.graphite, 1, 3);
  lines(rowLines([...T.lotProof, ...T.deconstruct.plat]), proofInk, 0.9, 61);
  const lotLines = (tFn) => L.lots.map((lot) => ({ geo: ribbon(lot.poly, 0.55, yLot, { closed: true }), t: tFn(lot) }));
  lines(lotLines((lot) => [...stagger(T.lotLines, lotF(lot), 0.3), ...T.drawingOut]), C.graphite, 1, 3);
  lines(lotLines(() => [...T.lotProof, ...T.deconstruct.lots]), proofInk, 0.9, 61);
  const fronts = (tFn) => L.lots.map((lot) => ({ geo: ribbon(lot.front, 1.3, GRADE + 0.2), t: tFn(lot) }));
  // frontage: Arcilla in the film; on The Work, Latón ticks — Arcilla stays rare there
  lines(fronts((lot) => [...stagger(T.lotLegible, lotF(lot), 0.3), ...T.drawingOut]), WORK ? C.laton : C.arcilla, 1, 4);
  // footprints, only during the deconstruction
  const fp = [];
  for (const lot of L.lots) if (lot.house) for (const r of lot.house.footprint) fp.push({ geo: ribbon(r, 0.4, GRADE + 0.22, { closed: true }), t: T.deconstruct.footprint });
  lines(fp, C.graphite, 1, 4);

  // ---------- the real road the tiles dissolve into ----------
  {
    const parts = [];
    const center = [];
    for (let s = sStart; s <= sStop; s += 2) center.push(L.spine.at(s).p);
    parts.push(solidRibbon(center, 2 * PAVE_HALF, PAVE_TOP, GRADE, C.asphalt));
    parts.push(ringSolid(L.C, BULB_ISLAND, BULB_PAVE, PAVE_TOP, GRADE, C.asphalt));
    for (const d of drivePaths) {
      const { out } = resample(d.full, 1.2);
      parts.push(solidRibbon(out.map((o) => o.p), d.lot.drive.width, GRADE + 0.12, GRADE - 0.02, 0xD9D2C4));
      parts.push(solidRibbon([d.full[0], d.lot.drive.apron[1]], 6.2, GRADE + 0.2, GRADE - 0.02, 0xD4CDBE));
    }
    for (const side of [-1, 1]) parts.push(solidRibbon(L.spine.offsetLine(sStart + 4, sEnd, side * SWALE_OFF, 3), 2.1, GRADE + 0.02, GRADE - 0.05, C.swale));
    const g = merge(parts);
    setLife(g, [T.real[0], realMid, ...NEVER]);
    const m = new THREE.Mesh(g, life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), MODE.DISSOLVE));
    m.receiveShadow = true;
    group.add(m);
  }

  return { group, parcel3D, sStart };
}

// ---------- helpers ----------
function orderMesh(m, o) { m.renderOrder = o; m.frustumCulled = false; return m; }
function stripToLife(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aLife'].includes(k)) g.deleteAttribute(k);
  return g.index ? g : g;
}
function lerpPt(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function centroidOf(poly) { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; }

function catmull(ctrl, per = 10) {
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < per; k++) {
    const t = k / per, t2 = t * t, t3 = t2 * t;
    out.push([0, 1].map((d) => 0.5 * (2 * P[i][d] + (-P[i - 1][d] + P[i + 1][d]) * t + (2 * P[i - 1][d] - 5 * P[i][d] + 4 * P[i + 1][d] - P[i + 2][d]) * t2 + (-P[i - 1][d] + 3 * P[i][d] - 3 * P[i + 1][d] + P[i + 2][d]) * t3)));
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

// Offset a simple polygon by d (positive = outward). Mitre joins, capped.
export function offsetPoly(poly, d) {
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += (poly[j][0] - poly[i][0]) * (poly[j][1] + poly[i][1]);
  const sign = area > 0 ? 1 : -1;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + poly.length) % poly.length], b = poly[(i + 1) % poly.length];
    const t1 = norm(sub(p, a)), t2 = norm(sub(b, p));
    const n1 = [t1[1] * sign, -t1[0] * sign], n2 = [t2[1] * sign, -t2[0] * sign];
    const n = norm(add(n1, n2));
    const k = Math.min(3, 1 / Math.max(0.3, dot(n, n1)));
    return add(p, mul(n, d * k));
  });
}

// Sutherland–Hodgman against one half-plane: keeps the side where f(p) ≥ 0.
export function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

function hatchLines(poly, spacing) {
  const segs = [];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let c = x0 - (z1 - z0); c < x1; c += spacing) {
    let run = [];
    for (let t = 0; t <= z1 - z0 + (x1 - x0); t += 1.5) {
      const p = [c + t, z0 + t];
      if (pointInPoly(p, poly)) run.push(p);
      else if (run.length) { if (run.length > 2) segs.push([run[0], run[run.length - 1]]); run = []; }
    }
    if (run.length > 2) segs.push([run[0], run[run.length - 1]]);
  }
  return segs;
}

// A strip with thickness: a top surface following the path and vertical sides down to yBot.
function solidRibbon(pts, width, yTop, yBot, color) {
  const top = ribbon(pts, width, yTop);
  const pos = top.attributes.position;
  const sides = [];
  const n = pos.count / 2;
  for (const edge of [0, 1]) {
    const v = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2 + edge, b = (i + 1) * 2 + edge;
      const ax = pos.getX(a), az = pos.getZ(a), bx = pos.getX(b), bz = pos.getZ(b);
      v.push(ax, yTop, az, bx, yTop, bz, bx, yBot, bz, ax, yTop, az, bx, yBot, bz, ax, yBot, az);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    sides.push(paint(g, color));
  }
  const t = new THREE.BufferGeometry();
  t.setAttribute('position', pos.clone());
  t.setAttribute('normal', top.attributes.normal.clone());
  t.setAttribute('uv', top.attributes.uv.clone());
  t.setIndex(top.index.clone());
  paint(t, color);
  return merge([t, ...sides]);
}
function ringSolid(c, r0, r1, yTop, yBot, color) {
  const ring = new THREE.RingGeometry(r0, r1, 64, 1);
  ring.rotateX(-Math.PI / 2);
  ring.translate(c[0], yTop, c[1]);
  const wall = new THREE.CylinderGeometry(r1, r1, yTop - yBot, 64, 1, true);
  wall.translate(c[0], (yTop + yBot) / 2, c[1]);
  const island = new THREE.CylinderGeometry(r0, r0, yTop - yBot + 0.2, 48, 1, false);
  island.translate(c[0], (yTop + yBot) / 2 + 0.1, c[1]);
  return merge([paint(ring, color), paint(wall, color), paint(island, 0x7F9058)]);
}
