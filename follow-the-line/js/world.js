// The land before anyone draws on it, and the parts of it that stay: voxel terrain (with its
// earthwork and colour changes baked into attributes), pines, the public road, distant farms,
// the smooth "real" terrain the model dissolves into, sky and sun.
import * as THREE from 'three';
import { life, MODE, C } from './shaders.js';
import { T, WORK } from './config.js';
import { pointInPoly, distToPolyline, rowPolygons, PUBLIC, rng, sub, dot, BULB_ROW } from './layout.js';
import { box, merge, paint, lerpT, stagger, NEVER, IN_ALWAYS, instanced, trs } from './kit.js';
import { growthClearTime } from './growth.js';

export const GRADE = 0.5;
const Q = 0.25;
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const quant = (h) => Math.round(h / Q) * Q;
const col = (hex) => new THREE.Color(hex);
const mixc = (a, b, t) => col(a).lerp(col(b), t);
export const CORE = { X0: -290, X1: 290, Z0: -310, Z1: 250 };
export const SITE_CENTER = [6, -42];

export const FARMS = [[-640, 380], [-470, -540], [700, 430], [820, -300], [520, 700], [-930, 40], [260, -760]];

// ---------- regions ----------
export function regions(L) {
  const rp = rowPolygons(L);
  const withBox = (poly) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { poly, x0, x1, z0, z1 };
  };
  const hit = (b, p) => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.z0 && p[1] <= b.z1 && pointInPoly(p, b.poly);
  const row = [rp.strip, rp.bulb, ...rp.flares].map(withBox);
  const lots = L.lots.map((l) => ({ ...withBox(l.poly), lot: l }));
  const pond = withBox(L.pond), wet = withBox(L.wetland), parcel = withBox(L.PARCEL);
  const inRow = (p) => row.some((b) => hit(b, p));
  return {
    inRow,
    nearRow: (p, d) => inRow(p) || [[d, 0], [-d, 0], [0, d], [0, -d]].some((o) => inRow([p[0] + o[0], p[1] + o[1]])),
    lotAt: (p) => { for (const b of lots) if (hit(b, p)) return b.lot; return null; },
    inPond: (p) => hit(pond, p),
    inWet: (p) => hit(wet, p),
    inParcel: (p) => hit(parcel, p),
    inPublic: (p) => Math.abs(p[1] - PUBLIC.z(p[0])) <= PUBLIC.half,
    station: (p) => (Math.hypot(p[0] - L.C[0], p[1] - L.C[1]) < BULB_ROW + 3 ? L.S : L.spine.nearest(p).s),
  };
}

// ---------- heights ----------
export function rawHeight(L, reg) {
  return (x, z) => {
    let h = 0.95 + 0.75 * Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.009 - 0.4) +
      0.45 * Math.sin(x * 0.027 - z * 0.019 + 2.1) + 0.22 * Math.sin(x * 0.063 + z * 0.047 + 0.5);
    const r = Math.hypot(x - SITE_CENTER[0], z - SITE_CENTER[1]);
    h += smooth(260, 750, r) * (2.6 * Math.sin(x * 0.0061 + 0.7) * Math.cos(z * 0.0053 + 1.1) + 1.4);
    if (Math.abs(x) < 400 && Math.abs(z) < 400) {
      const pw = pointInPoly([x, z], L.wetland) ? 0 : distToPolyline([x, z], L.wetland, true);
      h -= 1.2 * (1 - smooth(0, 45, pw));
      const pp = reg.inPond([x, z]) ? 0 : distToPolyline([x, z], L.pond, true);
      h -= 0.7 * (1 - smooth(0, 35, pp));
    }
    const dz = Math.abs(z - PUBLIC.z(x));
    return h + (GRADE - h) * (1 - smooth(16, 40, dz));
  };
}

function field(x, z) {
  let f = 0;
  for (const [fx, fz] of FARMS) f = Math.max(f, 1 - smooth(90, 230, Math.hypot(x - fx, z - fz)));
  return f;
}

// ---------- terrain ----------
export function buildTerrain(L, reg, tier) {
  const raw = rawHeight(L, reg);
  const cell = tier.cell;
  const { X0, X1, Z0, Z1 } = CORE;
  const nx = Math.round((X1 - X0) / cell), nz = Math.round((Z1 - Z0) / cell);
  const N = nx * nz;
  const kind = new Uint8Array(N);          // 0 raw · 1 ROW · 2 lot yard · 3 lot woodland · 4 pond · 5 wetland · 6 public road
  const lotId = new Int16Array(N).fill(-1);
  const hR = new Float32Array(N), hD = new Float32Array(N), sta = new Float32Array(N);
  const R = rng(99);
  const S = L.S;

  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = X0 + (i + 0.5) * cell, z = Z0 + (j + 0.5) * cell, p = [x, z];
    hR[k] = raw(x, z);
    let kd = 0;
    if (reg.inPublic(p)) kd = 6;
    else if (reg.inPond(p)) kd = 4;
    else if (reg.inRow(p)) { kd = 1; sta[k] = reg.station(p); }
    else {
      const lot = reg.lotAt(p);
      if (lot) {
        lotId[k] = lot.id;
        const v = dot(sub(p, lot.frame.M), lot.frame.V);
        // the yard runs well past the house; only the back of the lot keeps its woods
        kd = lot.house && v > lot.house.vc + 24 ? 3 : 2;
      } else if (reg.inWet(p)) kd = 5;
    }
    kind[k] = kd;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, kd = kind[k];
    let h = hR[k];
    if (kd === 1 || kd === 2 || kd === 6) h = GRADE;
    else if (kd === 4) h = -1.75;
    else if (kd === 3) h = hR[k];
    else {
      // cells beside graded ground are feathered halfway so the pad does not read as a cliff
      let near = false;
      for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = kind[jj * nx + ii];
        if (kk === 1 || kk === 2 || kk === 4) { near = true; break; }
      }
      if (near) h = (hR[k] + GRADE) / 2;
    }
    hD[k] = h;
  }

  // Attributes
  const matrices = [], colors = [];
  const aH = new Float32Array(N * 4), aC2 = new Float32Array(N * 3), aC3 = new Float32Array(N * 3), aTc = new Float32Array(N * 4), aLife = new Float32Array(N * 4);
  const finalColor = new Array(N);
  const realMid = (T.real[0] + T.real[1]) / 2;
  const gap = Math.max(0.06, cell * 0.018);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = X0 + (i + 0.5) * cell, z = Z0 + (j + 0.5) * cell, kd = kind[k];
    const n = 0.5 + 0.5 * Math.sin(x * 0.05 + 0.3) * Math.cos(z * 0.043 - 0.8), jit = R();
    let c1 = mixc(C.straw, C.understory, Math.min(1, n * 0.8 + jit * 0.35));
    if (kd === 5) c1 = mixc(0x6E7B55, 0x5E6C4C, jit);
    if (kd === 6) c1 = mixc(C.grass, C.lawnDeep, jit * 0.5);
    let c2 = c1.clone(), c3 = c1.clone();
    let tH = NEVER, tC2 = NEVER, tC3 = NEVER;
    if (kd === 1) {
      const f = sta[k] / S;
      c2 = mixc(C.clay, C.clayDark, jit);
      c3 = mixc(C.swale, C.grass, jit * 0.6);
      tH = stagger(T.excavation, f, 0.25);
      tC2 = stagger(T.clearing, f, 0.2);
      tC3 = stagger(T.lotLines, f, 0.4);
    } else if (kd === 2) {
      const f = lotId[k] / (L.lots.length - 1);
      c2 = mixc(C.sand, C.sandDark, jit * 0.6);
      // neighbouring lawns are mown and kept a little differently, so each lot reads as its own
      c3 = lotId[k] % 2 ? mixc(0x8C9C5D, 0x839557, jit * 0.4) : mixc(0x74874E, 0x6C7F49, jit * 0.4);
      tH = stagger(T.lotClearing, f, 0.3);
      tC2 = tH;
      tC3 = stagger(T.lawn || T.landscaping, f, 0.35);   // lawns can come before planting
    } else if (kd === 4) {
      c2 = mixc(C.clayDark, C.clay, jit * 0.4);
      c3 = c2;
      tH = [T.drainage[0], lerpT(T.drainage, 0.6)];
      tC2 = [T.drainage[0], lerpT(T.drainage, 0.3)];
    } else if (hD[k] !== hR[k]) {
      tH = [T.clearing[1], T.excavation[1]];
    }
    matrices.push(trs(x, 0, z, 0, cell - gap, 1, cell - gap));
    colors.push(c1);
    aH.set([quant(hR[k]), quant(hD[k]), tH[0], tH[1]], k * 4);
    aC2.set([c2.r, c2.g, c2.b], k * 3);
    aC3.set([c3.r, c3.g, c3.b], k * 3);
    aTc.set([tC2[0], tC2[1], tC3[0], tC3[1]], k * 4);
    aLife.set([...IN_ALWAYS, realMid, T.real[1]], k * 4);
    finalColor[k] = kd === 1 ? c3 : kd === 2 ? c3 : kd === 4 ? c2 : c1;
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  geo.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 4));
  geo.setAttribute('aC2', new THREE.InstancedBufferAttribute(aC2, 3));
  geo.setAttribute('aC3', new THREE.InstancedBufferAttribute(aC3, 3));
  geo.setAttribute('aTc', new THREE.InstancedBufferAttribute(aTc, 4));
  geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(aLife, 4));
  const mat = life(new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0 }), MODE.TERRAIN, { edge: 0.05, edgeK: 0.92, base: -5 });
  const voxels = instanced(geo, mat, matrices, { colors });
  voxels.receiveShadow = true;

  // Smooth terrain for the real phase: the same heights and final colours, averaged at corners.
  const plane = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  plane.rotateX(-Math.PI / 2);
  plane.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = plane.attributes.position, pc = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const i = Math.round((pos.getX(v) - X0) / cell), j = Math.round((pos.getZ(v) - Z0) / cell);
    let h = 0, c = new THREE.Color(0, 0, 0), w = 0, dev = false;
    for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const k = jj * nx + ii;
      h += hD[k]; c.add(finalColor[k]); w++;
      if (kind[k] === 1 || kind[k] === 2 || kind[k] === 6) dev = true;
    }
    h /= w || 1; c.multiplyScalar(1 / (w || 1));
    pos.setY(v, dev ? Math.min(h, GRADE) - 0.03 : h - 0.14);
    pc.set([c.r, c.g, c.b], v * 3);
  }
  plane.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  plane.computeVertexNormals();
  const realMat = life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), MODE.DISSOLVE);
  const real = new THREE.Mesh(setLifeAll(plane, [T.real[0], realMid, ...NEVER]), realMat);
  real.receiveShadow = true;

  const at = (x, z) => {
    const i = Math.floor((x - X0) / cell), j = Math.floor((z - Z0) / cell);
    if (i < 0 || j < 0 || i >= nx || j >= nz) { const h = quant(raw(x, z)); return { raw: h, dev: h, kind: 0 }; }
    const k = j * nx + i;
    return { raw: quant(hR[k]), dev: quant(hD[k]), kind: kind[k] };
  };
  return { voxels, real, at, raw };
}

function setLifeAll(geo, t) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a.set(t, i * 4);
  geo.setAttribute('aLife', new THREE.BufferAttribute(a, 4));
  return geo;
}

// The wider country: coarser blocks out to the horizon, then a plain ground under the fog.
export function buildRing(L, reg, tier, raw) {
  const { X0, X1, Z0, Z1 } = CORE;
  const cell = tier.ring, Rr = tier.ringR;
  const matrices = [], colors = [], hs = [];
  const R = rng(5);
  for (let x = -Rr; x < Rr; x += cell) for (let z = -Rr; z < Rr; z += cell) {
    const cx = x + cell / 2, cz = z + cell / 2;
    if (cx > X0 - cell / 2 && cx < X1 + cell / 2 && cz > Z0 - cell / 2 && cz < Z1 + cell / 2) continue;
    if (Math.hypot(cx - SITE_CENTER[0], cz - SITE_CENTER[1]) > Rr) continue;
    const f = field(cx, cz), jit = R();
    let c = mixc(C.straw, C.understory, 0.35 + jit * 0.5);
    if (f > 0.35) c = mixc(0xC4B98E, 0xB3AC7E, jit);
    if (Math.abs(cz - PUBLIC.z(cx)) < 16) c = mixc(C.grass, C.lawnDeep, jit * 0.5);
    matrices.push(trs(cx, 0, cz, 0, cell - 0.25, 1, cell - 0.25));
    colors.push(c);
    // where the wider community already stands, the blocks settle below its pads and roads
    const standing = growthClearTime(cx, cz);
    hs.push(quant(raw(cx, cz)) - (standing !== null && standing < 0 ? 1.25 : 0));
  }
  const n = matrices.length;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const aH = new Float32Array(n * 4), aC = new Float32Array(n * 3), aTc = new Float32Array(n * 4), aLife = new Float32Array(n * 4);
  const realMid = (T.real[0] + T.real[1]) / 2;
  for (let i = 0; i < n; i++) {
    aH.set([hs[i], hs[i], ...NEVER], i * 4);
    aC.set([colors[i].r, colors[i].g, colors[i].b], i * 3);
    aTc.set([...NEVER, ...NEVER], i * 4);
    aLife.set([...IN_ALWAYS, realMid, T.real[1]], i * 4);
  }
  geo.setAttribute('aH', new THREE.InstancedBufferAttribute(aH, 4));
  geo.setAttribute('aC2', new THREE.InstancedBufferAttribute(aC, 3));
  geo.setAttribute('aC3', new THREE.InstancedBufferAttribute(aC, 3));
  geo.setAttribute('aTc', new THREE.InstancedBufferAttribute(aTc, 4));
  geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(aLife, 4));
  const mat = life(new THREE.MeshStandardMaterial({ roughness: 1 }), MODE.TERRAIN, { edge: 0.03, base: -8 });
  const voxels = instanced(geo, mat, matrices, { colors });
  voxels.receiveShadow = true;

  // the real ground reaches far enough for the regional pull-back
  const size = Math.max(Rr * 2 + 600, 3800), seg = tier.name === 'low' ? 80 : 150;
  const plane = new THREE.PlaneGeometry(size, size, seg, seg);
  plane.rotateX(-Math.PI / 2);
  plane.translate(SITE_CENTER[0], 0, SITE_CENTER[1]);
  const pos = plane.attributes.position, pc = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), z = pos.getZ(v), jit = R();
    // under the detailed site the wide ground sinks away, so it can never rise through the
    // finished lawns, driveways and road
    const underSite = x > X0 && x < X1 && z > Z0 && z < Z1;
    pos.setY(v, underSite ? -4 : raw(x, z) - 0.5);
    const f = field(x, z);
    let c = mixc(C.straw, C.understory, 0.45 + jit * 0.2);
    if (f > 0.35) c = mixc(0xC4B98E, 0xB3AC7E, jit);
    pc.set([c.r, c.g, c.b], v * 3);
  }
  plane.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  plane.computeVertexNormals();
  // On The Work the wide ground is there from the first pull-back (the market comes first)
  const ringLife = WORK ? [...IN_ALWAYS, ...NEVER] : [T.real[0], realMid, ...NEVER];
  const real = new THREE.Mesh(setLifeAll(plane, ringLife), life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), MODE.DISSOLVE));
  real.receiveShadow = true;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xB9AF88, roughness: 1 }));
  ground.position.set(SITE_CENTER[0], -2.5, SITE_CENTER[1]);
  return { voxels, real, ground };
}

// ---------- trees ----------
function voxelPine() {
  return merge([
    box(0.6, 9.2, 0.6, 0, 0, 0, C.trunk),
    box(4.8, 2.2, 4.8, 0, 8.4, 0, C.pine),
    box(3.8, 2.0, 3.8, 0.2, 10.4, -0.1, C.pineDark),
    box(2.6, 1.8, 2.6, -0.1, 12.2, 0.15, C.pine),
    box(1.3, 1.4, 1.3, 0, 13.9, 0, C.pineLight),
  ]);
}
function voxelOak() {
  return merge([
    box(0.7, 3.4, 0.7, 0, 0, 0, C.trunk),
    box(6.4, 2.4, 5.6, 0, 3.2, 0, 0x55663F),
    box(4.4, 1.8, 4.8, 0.4, 5.4, -0.3, 0x5E6E45),
    box(2.6, 1.2, 2.6, -0.6, 7.0, 0.4, 0x687749),
  ]);
}
function realPine() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.2, 0.34, 11, 6); trunk.translate(0, 5.5, 0); parts.push(paint(trunk, C.trunk));
  [[3.2, 4.4, 9.8, C.pineDark], [2.6, 3.8, 11.6, C.pine], [1.7, 3.2, 13.4, C.pineLight]].forEach(([r, h, y, c]) => {
    const g = new THREE.ConeGeometry(r, h, 8); g.translate(0, y, 0); parts.push(paint(g, c));
  });
  return merge(parts);
}
function realOak() {
  const trunk = new THREE.CylinderGeometry(0.28, 0.42, 4.2, 6); trunk.translate(0, 2.1, 0);
  const crown = new THREE.IcosahedronGeometry(3.4, 1); crown.scale(1.05, 0.72, 1); crown.translate(0, 5.6, 0);
  const crown2 = new THREE.IcosahedronGeometry(2.3, 1); crown2.scale(1, 0.8, 1); crown2.translate(1.2, 6.8, -0.6);
  return merge([paint(trunk, C.trunk), paint(crown, 0x566842), paint(crown2, 0x617047)]);
}

export function buildTrees(L, reg, tier, terrain) {
  const R = rng(1234);
  const { X0, X1, Z0, Z1 } = CORE;
  const area = (X1 - X0) * (Z1 - Z0);
  const sp = Math.sqrt((area * 0.58) / tier.trees);
  const sets = { pineCleared: [], pineKept: [], oakCleared: [], oakKept: [] };
  const drives = L.lots.filter((l) => l.drive);
  const nearBuilt = (p) => {
    for (const l of L.lots) {
      if (l.house) for (const r of l.house.footprint) if (pointInPoly(p, r) || distToPolyline(p, r, true) < 7) return true;
      if (l.drive && distToPolyline(p, [l.drive.apron[0], ...l.drive.path], false) < 5) return true;
    }
    return false;
  };
  for (let x = X0; x < X1; x += sp) for (let z = Z0; z < Z1; z += sp) {
    const p = [x + (R() - 0.5) * sp * 0.9, z + (R() - 0.5) * sp * 0.9];
    // pine flatwoods: mostly closed stands, with a few open glades
    let dens = 0.72 + 0.32 * Math.sin(p[0] * 0.013 + 0.5) * Math.cos(p[1] * 0.011 - 1.2) + 0.12 * Math.sin(p[0] * 0.04 + p[1] * 0.03);
    // thin out toward the edge of the detailed area so the woods do not end in a straight line
    const edge = Math.min(p[0] - X0, X1 - p[0], p[1] - Z0, Z1 - p[1]);
    dens *= 0.4 + 0.6 * smooth(0, 110, edge);
    if (R() > dens) continue;
    if (Math.abs(p[1] - PUBLIC.z(p[0])) < 20) continue;
    if (reg.inPond(p) || distToPolyline(p, L.pond, true) < 3) continue;
    const wet = reg.inWet(p);
    const oak = R() < (wet ? 0.55 : 0.14);
    const s = 0.78 + R() * 0.45;
    const ry = R() * Math.PI * 2;
    const ground = terrain.at(p[0], p[1]);
    let life = null;
    if (reg.nearRow(p, 3.5)) {
      life = [...IN_ALWAYS, ...stagger(T.clearing, reg.station(p) / L.S, 0.22)];
    } else if (distToPolyline(p, L.pond, true) < 8) {
      life = [...IN_ALWAYS, T.drainage[0], lerpT(T.drainage, 0.25)];
    } else {
      const lot = reg.lotAt(p);
      const f = lot ? lot.id / (L.lots.length - 1) : 0;
      if (lot) {
        const v = dot(sub(p, lot.frame.M), lot.frame.V);
        const keep = lot.house && v > lot.house.vc + 24 && !nearBuilt(p) && R() < 0.7;
        if (!keep) life = [...IN_ALWAYS, ...stagger(T.lotClearing, f, 0.3)];
      } else if (nearBuilt(p)) {
        life = [...IN_ALWAYS, ...stagger(T.lotClearing, 0.5, 0.3)];
      }
    }
    const y = Math.min(ground.raw, ground.dev);
    const entry = { m: trs(p[0], y, p[1], ry, s, s, s), c: new THREE.Color().setScalar(0.88 + R() * 0.22), life, p };
    if (life) sets[oak ? 'oakCleared' : 'pineCleared'].push(entry);
    else sets[oak ? 'oakKept' : 'pineKept'].push(entry);
  }
  // the wider woods
  const ringKept = { pine: [], oak: [] };
  for (let i = 0; i < tier.ringTrees * 3 && ringKept.pine.length + ringKept.oak.length < tier.ringTrees; i++) {
    // most of the wider woods sit close to the site, thinning with distance
    const a = R() * Math.PI * 2, r = 290 + Math.pow(R(), 2.2) * (tier.ringR - 310);
    const p = [SITE_CENTER[0] + Math.cos(a) * r, SITE_CENTER[1] + Math.sin(a) * r];
    if (p[0] > X0 && p[0] < X1 && p[1] > Z0 && p[1] < Z1) continue;
    if (Math.abs(p[1] - PUBLIC.z(p[0])) < 24 || field(p[0], p[1]) > 0.3) continue;
    const s = 0.8 + R() * 0.5, oak = R() < 0.18;
    const y = quantRaw(terrain.raw, p) - 0.5;
    const gOut = growthClearTime(p[0], p[1]);
    if (gOut !== null && gOut < 0) continue;          // already built on
    ringKept[oak ? 'oak' : 'pine'].push({ m: trs(p[0], y, p[1], R() * 6.28, s, s, s), c: new THREE.Color().setScalar(0.85 + R() * 0.25), out: gOut });
  }
  sets.pineKept.push(...ringKept.pine);
  sets.oakKept.push(...ringKept.oak);
  // far woods, seen only once the model has become real and the camera pulls back over the region
  const far = { pine: [], oak: [] };
  for (let i = 0; i < tier.farTrees * 3 && far.pine.length + far.oak.length < tier.farTrees; i++) {
    const a = R() * Math.PI * 2, r = tier.ringR + R() * (1750 - tier.ringR);
    const p = [SITE_CENTER[0] + Math.cos(a) * r, SITE_CENTER[1] + Math.sin(a) * r];
    if (Math.abs(p[1] - PUBLIC.z(p[0])) < 30 || field(p[0], p[1]) > 0.3) continue;
    const s = 0.85 + R() * 0.5, oak = R() < 0.2;
    const fOut = growthClearTime(p[0], p[1]);
    if (fOut !== null && fOut < 0) continue;
    far[oak ? 'oak' : 'pine'].push({ m: trs(p[0], terrain.raw(p[0], p[1]) - 0.5, p[1], R() * 6.28, s, s, s), c: new THREE.Color().setScalar(0.85 + R() * 0.25), out: fOut });
  }

  const realMid = (T.real[0] + T.real[1]) / 2;
  const group = new THREE.Group();
  const mk = (geoFn, list, mode, lifeFn, cast = true) => {
    if (!list.length) return;
    const geo = geoFn();
    const arr = new Float32Array(list.length * 4);
    list.forEach((e, i) => arr.set(lifeFn(e), i * 4));
    geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
    const mat = life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), mode, { edge: mode === MODE.DISSOLVE && geoFn !== realPine && geoFn !== realOak ? 0.06 : 0 });
    const mesh = instanced(geo, mat, list.map((e) => e.m), { colors: list.map((e) => e.c) });
    if (cast && tier.shadow) { mesh.castShadow = true; mesh.customDepthMaterial = life(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), mode); }
    group.add(mesh);
  };
  mk(voxelPine, sets.pineCleared, MODE.POP, (e) => e.life);
  mk(voxelOak, sets.oakCleared, MODE.POP, (e) => e.life);
  mk(voxelPine, sets.pineKept, MODE.DISSOLVE, () => [...IN_ALWAYS, realMid, T.real[1]]);
  mk(voxelOak, sets.oakKept, MODE.DISSOLVE, () => [...IN_ALWAYS, realMid, T.real[1]]);
  // real trees stay until growth needs their ground
  const realLife = (e) => [T.real[0], realMid, ...(e.out != null ? [e.out, e.out + 0.006] : NEVER)];
  mk(realPine, sets.pineKept, MODE.DISSOLVE, realLife);
  mk(realOak, sets.oakKept, MODE.DISSOLVE, realLife);
  const farLife = (e) => (WORK ? [...IN_ALWAYS, ...(e.out != null ? [e.out, e.out + 0.006] : NEVER)] : realLife(e));
  mk(realPine, far.pine, MODE.DISSOLVE, farLife, false);
  mk(realOak, far.oak, MODE.DISSOLVE, farLife, false);
  group.userData.kept = [...sets.pineKept, ...sets.oakKept].map((e) => e.p).filter(Boolean);
  return group;
}
function quantRaw(raw, p) { return quant(raw(p[0], p[1])); }

// ---------- the public road, poles, and farms in the distance ----------
export function buildPublicRoad(tier) {
  const parts = [];
  const ang = Math.atan2(-PUBLIC.T[1], PUBLIC.T[0]);
  for (let x = -1400; x < 1400; x += 200) {
    const cx = x + 100, cz = PUBLIC.z(cx);
    parts.push(box(201, 0.22, PUBLIC.pave * 2, cx, GRADE, cz, C.asphaltOld, ang));
    // pale edge lines
    for (const side of [-1, 1]) {
      const ex = cx + PUBLIC.N[0] * side * (PUBLIC.pave - 0.35), ez = cz + PUBLIC.N[1] * side * (PUBLIC.pave - 0.35);
      parts.push(box(201, 0.03, 0.14, ex, GRADE + 0.22, ez, 0xD9D1BF, ang));
    }
  }
  for (let x = -1400; x < 1400; x += 12) {
    parts.push(box(3.2, 0.03, 0.14, x, GRADE + 0.22, PUBLIC.z(x), 0xC7B27A, ang));
  }
  const poles = [];
  const wires = [];
  for (let x = -1400; x <= 1400; x += 55) {
    const px = x + PUBLIC.N[0] * 12.5, pz = PUBLIC.z(x) + PUBLIC.N[1] * 12.5;
    poles.push(box(0.3, 9.6, 0.3, px, GRADE, pz, 0x6B5A48), box(2.4, 0.16, 0.18, px, GRADE + 8.9, pz, 0x6B5A48, ang));
    if (x > -1400) {
      const qx = px - 55, qz = PUBLIC.z(x - 55) + PUBLIC.N[1] * 12.5;
      wires.push(qx, GRADE + 9.0, qz, px, GRADE + 9.0, pz);
    }
  }
  const road = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  road.receiveShadow = true;
  const poleMesh = new THREE.Mesh(merge(poles), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  poleMesh.castShadow = !!tier.shadow;
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  const wireMesh = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x5b5a52, transparent: true, opacity: 0.45 }));
  const g = new THREE.Group();
  g.add(road, poleMesh, wireMesh);
  return g;
}

export function buildFarms(raw) {
  const parts = [];
  const R = rng(77);
  for (const [fx, fz] of FARMS) {
    const y = quant(raw(fx, fz)), ry = R() * Math.PI;
    const put = (g, dx, dz) => { g.rotateY(ry); g.translate(fx + dx * Math.cos(ry) + dz * Math.sin(ry), y, fz - dx * Math.sin(ry) + dz * Math.cos(ry)); parts.push(g); };
    put(box(14, 3.4, 9, 0, 0, 0, 0xE3DCCB), 0, 0);
    put(gable(15, 9.8, 2.6, 0x6A6A62, 3.4), 0, 0);
    put(box(16, 6.5, 26, 0, 0, 0, 0x94705A), 34, 8);
    put(gable(17, 27, 4, 0x77756D, 6.5), 34, 8);
    const silo = new THREE.CylinderGeometry(2.6, 2.6, 13, 10); silo.translate(0, 6.5, 0); paint(silo, 0xCFC8BA);
    put(silo, 48, -10);
  }
  const m = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
  return m;
}

// A gable roof prism: ridge along x, sitting on y = base.
export function gable(w, d, h, color, base = 0) {
  const x = w / 2, z = d / 2;
  const v = [
    -x, 0, -z, x, 0, -z, x, h, 0, -x, 0, -z, x, h, 0, -x, h, 0,
    x, 0, z, -x, 0, z, -x, h, 0, x, 0, z, -x, h, 0, x, h, 0,
    -x, 0, z, -x, 0, -z, -x, h, 0,
    x, 0, -z, x, 0, z, x, h, 0,
  ];
  // wind every triangle counter-clockwise seen from outside
  for (let i = 0; i < v.length; i += 9) for (let k = 0; k < 3; k++) { const t = v[i + 3 + k]; v[i + 3 + k] = v[i + 6 + k]; v[i + 6 + k] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  g.translate(0, base, 0);
  return paint(g, color);
}

// ---------- sky, fog, sun ----------
export function buildAtmosphere(scene, tier) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0xEFE9DD) }, horizon: { value: new THREE.Color(0xE7E0D1) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 top;\nuniform vec3 horizon;\nvarying vec3 vP;\nvoid main(){\n  float h = normalize(vP).y;\n  gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 0.5, h)), 1.0);\n  #include <colorspace_fragment>\n}',
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog(0xE7E0D1, 700, 2600);

  const hemi = new THREE.HemisphereLight(0xF4EFE5, 0x8E8768, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFF1DE, 2.1);
  sun.target.position.set(SITE_CENTER[0], 0, SITE_CENTER[1]);
  scene.add(sun, sun.target);
  if (tier.shadow) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(tier.shadow, tier.shadow);
    const s = sun.shadow.camera;
    s.left = -330; s.right = 330; s.top = 330; s.bottom = -330; s.near = 10; s.far = 1600;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.35;
  }
  const maquette = { top: col(0xEFE9DD), horizon: col(0xE7E0D1), sun: col(0xFFF1DE), hemi: 1.25, sunI: 2.1, dir: new THREE.Vector3(-0.52, 0.72, 0.46) };
  const realistic = { top: col(0xC7D2D1), horizon: col(0xEBDDC6), sun: col(0xFFE2BC), hemi: 0.95, sunI: 2.6, dir: new THREE.Vector3(-0.66, 0.5, 0.56) };
  const tmp = new THREE.Vector3();
  function update(p, focus) {
    const k = smooth(T.real[0], T.real[1], p) * (1 - smooth(T.deconstruct.scene[0], T.deconstruct.scene[1], p));
    sky.material.uniforms.top.value.copy(maquette.top).lerp(realistic.top, k);
    sky.material.uniforms.horizon.value.copy(maquette.horizon).lerp(realistic.horizon, k);
    scene.fog.color.copy(sky.material.uniforms.horizon.value);
    sun.color.copy(maquette.sun).lerp(realistic.sun, k);
    sun.intensity = maquette.sunI + (realistic.sunI - maquette.sunI) * k;
    hemi.intensity = maquette.hemi + (realistic.hemi - maquette.hemi) * k;
    tmp.copy(maquette.dir).lerp(realistic.dir, k).normalize();
    // the shadow frustum follows what the camera is looking at, so close-ups keep crisp shadows
    const fx = focus ? focus.x : SITE_CENTER[0], fz = focus ? focus.z : SITE_CENTER[1];
    sun.target.position.set(fx, 0, fz);
    sun.position.set(fx + tmp.x * 700, tmp.y * 700, fz + tmp.z * 700);
    if (tier.shadow && focus) {
      const r = focus.radius;
      const s = sun.shadow.camera;
      if (Math.abs(s.right - r) > 1) { s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.updateProjectionMatrix(); }
    }
  }
  return { update, sun, hemi, sky };
}
