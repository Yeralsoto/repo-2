// Homes. Three footprints (from layout.js), gable / hip / low-slope roofs, two facade families,
// small material shifts. Every home sits where layout.js proved it fits inside its own lot.
// The standalone film builds one homesite in the open, layer by layer. The Work never does: her company
// leaves builder-ready lots (her correction, 2026-09-14), so there every home arrives only after its lot
// sells — the buyer's builder's work, lot by lot.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { life, lifeDepth, MODE, C, setLife, setLift } from './shaders.js';
import { T, WORK } from './config.js';
import { rng } from './layout.js';
import { GRADE, gable } from './world.js';
import { box, merge, paint, stagger, NEVER, IN_ALWAYS } from './kit.js';

const PLINTH = 0.45;

export function buildHouses(L, tier) {
  const group = new THREE.Group();
  const R = rng(3131);
  const times = homeTimes(L);
  const edges = [];
  const porchLights = [];
  let hero = null;

  const mat = life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), MODE.DROP, { drop: 11 });
  const depth = lifeDepth(MODE.DROP, { drop: 11 });

  for (const lot of L.lots) {
    const h = lot.house;
    if (!h) continue;
    const spec = houseSpec(h, R);
    const toWorld = ([lx, ly, lz]) => new THREE.Vector3(
      h.pos[0] + lx * Math.cos(h.rotY) + lz * Math.sin(h.rotY), GRADE + ly, h.pos[1] - lx * Math.sin(h.rotY) + lz * Math.cos(h.rotY));
    if (spec.porchLight) { const w = toWorld(spec.porchLight); porchLights.push({ lot, p: [w.x, w.z], y: w.y }); }

    const shell = merge([...spec.walls.map((g) => g.clone()), ...spec.roof.map((g) => g.clone())]);
    const eg = new THREE.EdgesGeometry(shell, 28);
    eg.rotateY(h.rotY);
    eg.translate(h.pos[0], GRADE, h.pos[1]);
    edges.push(eg.attributes.position.array);

    if (lot.id === L.hero && !WORK) {
      hero = buildHero(lot, spec, tier);
      group.add(hero.group);
      continue;
    }
    const t = [...times.get(lot.id), ...T.deconstruct.homes];
    const geo = merge([...spec.slab, ...spec.walls, ...spec.fascia, ...spec.roof, ...spec.glass, ...spec.trim]);
    setLife(geo, t);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(h.pos[0], GRADE, h.pos[1]);
    mesh.rotation.y = h.rotY;
    mesh.castShadow = !!tier.shadow;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = depth;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // framing, as drawn edges, for the deconstruction
  let total = 0;
  for (const a of edges) total += a.length;
  const all = new Float32Array(total);
  let o = 0;
  for (const a of edges) { all.set(a, o); o += a.length; }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(all, 3));
  setLife(lg, T.deconstruct.framing);
  const lines = new THREE.LineSegments(lg, life(new THREE.LineBasicMaterial({ color: C.graphite, toneMapped: false }), MODE.DISSOLVE));
  lines.frustumCulled = false;
  group.add(lines);

  // on The Work there is no hero construction; the featured lot is still the one the camera visits
  const site = L.lots[L.hero];
  return { group, hero: hero || { lot: site, pos: site.house ? site.house.pos : site.frame.M, rotY: site.frame.rotY }, porchLights };
}

// When each home arrives: three first, then the rest of the street. On The Work the featured lot sells first,
// so its buyer's builder is among the first three (build.js takes its for-sale stake down just before).
export function homeTimes(L) {
  const built = L.lots.filter((l) => l.house).map((l) => l.id);
  const order = WORK ? [L.hero, ...built.filter((id) => id !== L.hero)] : built.filter((id) => id !== L.hero);
  const first = order.slice(0, 3), rest = order.slice(3);
  const times = new Map();
  for (const [list, win, dur] of [[first, T.firstHomes, 0.4], [rest, T.homesRest, 0.14]]) {
    list.forEach((id, i) => times.set(id, stagger(win, list.length > 1 ? i / (list.length - 1) : 0, dur)));
  }
  return times;
}

// ---------- one home, as parts in house-local coordinates (x along frontage, front at −z) ----------
function mixHex(a, b, t) { return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex(); }

function houseSpec(h, R) {
  const fam = h.family;
  const wall = fam === 0 ? mixHex(C.wallWhite, 0xE2D9C7, h.tint * 0.7) : mixHex(C.wallSand, C.wallClay, h.tint);
  const roofC = fam === 0 ? (h.tint > 0.5 ? C.roofBronze : C.roofGreen) : mixHex(C.roofSlate, 0x5F625D, h.tint);
  const trimC = fam === 0 ? C.trim : 0xEDE6D8;
  const doorC = fam === 0 ? 0x6F5846 : 0x4E5A52;
  const garageC = fam === 0 ? 0xDDD6C8 : 0x8C7156;
  const vols = h.rects.filter((r) => r.kind !== 'porch');
  const porch = h.rects.find((r) => r.kind === 'porch');
  const main = vols.find((v) => v.kind === 'main');
  const S = { slab: [], walls: [], panels: [], fascia: [], roof: [], glass: [], trim: [], roofs: [], vols, main, porch, wall, roofC };

  for (const v of vols) {
    const w = v.x[1] - v.x[0], d = v.z[1] - v.z[0], cx = (v.x[0] + v.x[1]) / 2, cz = (v.z[0] + v.z[1]) / 2, hh = v.h;
    S.slab.push(box(w + 0.5, PLINTH, d + 0.5, cx, 0, cz, C.slab));
    S.walls.push(box(w, hh, d, cx, PLINTH, cz, wall));
    const t = 0.22;
    S.panels.push(
      box(w, hh, t, cx, PLINTH, v.z[0] + t / 2, wall), box(t, hh, d - 2 * t, v.x[1] - t / 2, PLINTH, cz, wall),
      box(w, hh, t, cx, PLINTH, v.z[1] - t / 2, wall), box(t, hh, d - 2 * t, v.x[0] + t / 2, PLINTH, cz, wall));
    const top = PLINTH + hh;
    S.fascia.push(box(w + 0.7, 0.22, d + 0.7, cx, top, cz, trimC));
    const rt = top + 0.22;
    const kind = v.kind === 'link' ? 'flat' : h.roof;
    const rh = Math.min(w, d) * (kind === 'hip' ? 0.3 : 0.34);
    if (kind === 'gable') {
      const g = d > w ? gable(d + 0.9, w + 0.9, rh, roofC) : gable(w + 0.9, d + 0.9, rh, roofC);
      if (d > w) g.rotateY(Math.PI / 2);
      g.translate(cx, rt, cz);
      S.roof.push(g);
    } else if (kind === 'hip') {
      const g = hipRoof(w + 0.9, d + 0.9, rh, roofC);
      g.translate(cx, rt, cz);
      S.roof.push(g);
    } else if (kind === 'shed') {
      const g = box(w + 0.9, 0.32, d + 0.9, 0, 0, 0, roofC);
      g.translate(0, -0.16, 0);
      g.rotateX(v.kind === 'garage' ? -0.1 : 0.1);
      g.translate(cx, rt + 0.55, cz);
      S.roof.push(g, box(w, 0.55, d, cx, rt, cz, wall));
    } else {
      S.roof.push(box(w + 0.4, 0.3, d + 0.4, cx, rt, cz, roofC));
    }
    S.roofs.push({ kind, w, d, cx, cz, rt, rh, vkind: v.kind });
    if (fam === 0 && kind === 'gable' && v.kind === 'main') S.roof.push(box(0.9, rh + 1.2, 0.9, v.x[0] + 1.7, rt - 0.3, cz + d * 0.2, 0xB3A08A));

    const adj = (x) => vols.some((q) => q !== v && (Math.abs(q.x[0] - x) < 0.01 || Math.abs(q.x[1] - x) < 0.01));
    const gy = PLINTH + 0.95;
    if (v.kind === 'garage') {
      S.trim.push(box(w - 1.5, 2.3, 0.14, cx, PLINTH, v.z[0] - 0.05, garageC));
      if (!adj(v.x[0])) S.glass.push(box(0.14, 1.1, 1.2, v.x[0] - 0.05, gy + 0.2, cz + 1, C.glass));
      if (!adj(v.x[1])) S.glass.push(box(0.14, 1.1, 1.2, v.x[1] + 0.05, gy + 0.2, cz + 1, C.glass));
    } else if (v.kind === 'link') {
      S.glass.push(box(w - 0.3, hh - 0.6, 0.12, cx, PLINTH + 0.3, v.z[0] - 0.05, C.glass), box(w - 0.3, hh - 0.6, 0.12, cx, PLINTH + 0.3, v.z[1] + 0.05, C.glass));
    } else {
      const doorX = porch ? (porch.x[0] + porch.x[1]) / 2 : cx;
      const n = Math.max(2, Math.floor(w / 2.7));
      for (let i = 0; i < n; i++) {
        const x = v.x[0] + (w * (i + 0.5)) / n;
        if (Math.abs(x - doorX) > 1.3) S.glass.push(box(1.3, 1.5, 0.14, x, gy, v.z[0] - 0.05, C.glass));
        S.glass.push(box(1.3, 1.5, 0.14, x, gy, v.z[1] + 0.05, C.glass));
      }
      const m = Math.max(1, Math.floor(d / 3.4));
      for (let i = 0; i < m; i++) {
        const z = v.z[0] + (d * (i + 0.5)) / m;
        if (!adj(v.x[0])) S.glass.push(box(0.14, 1.5, 1.3, v.x[0] - 0.05, gy, z, C.glass));
        if (!adj(v.x[1])) S.glass.push(box(0.14, 1.5, 1.3, v.x[1] + 0.05, gy, z, C.glass));
      }
      S.trim.push(box(1.05, 2.2, 0.14, doorX, PLINTH, v.z[0] - 0.06, doorC));
    }
  }
  if (porch) {
    const pw = porch.x[1] - porch.x[0], pd = porch.z[1] - porch.z[0], pcx = (porch.x[0] + porch.x[1]) / 2, pcz = (porch.z[0] + porch.z[1]) / 2;
    S.trim.push(box(pw, 0.32, pd, pcx, 0, pcz, C.slab));
    for (const x of [porch.x[0] + 0.2, porch.x[1] - 0.2]) S.trim.push(box(0.2, 2.75, 0.2, x, 0.32, porch.z[0] + 0.2, trimC));
    S.trim.push(box(pw + 0.5, 0.2, pd + 0.4, pcx, 3.05, pcz - 0.1, roofC));
    S.porchLight = [pcx + 0.9, PLINTH + 2.3, main.z[0] - 0.25];
  }
  return S;
}

function hipRoof(w, d, h, color) {
  const swap = d > w;
  const W = swap ? d : w, D = swap ? w : d, x = W / 2, z = D / 2, r = Math.max(0, x - z);
  const A = [-x, 0, -z], B = [x, 0, -z], Cc = [x, 0, z], Dd = [-x, 0, z], R1 = [-r, h, 0], R2 = [r, h, 0];
  const v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  tri(A, R2, B); tri(A, R1, R2);
  tri(Cc, R1, Dd); tri(Cc, R2, R1);
  tri(Dd, R1, A);
  tri(B, R2, Cc);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  if (swap) g.rotateY(Math.PI / 2);
  return paint(g, color);
}

// ---------- the hero homesite, assembled (the standalone film only — The Work never builds a home) ----------
function mergeTimed(items) {
  const geos = items.map(({ geo, t }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    return setLife(g, t);
  });
  return mergeGeometries(geos);
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function mtx(x, y, z, rx, ry, rz, sx, sy, sz) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

function buildHero(lot, S, tier) {
  const h = lot.house;
  const H = T.hero;
  const out = T.deconstruct.homes;
  const g = new THREE.Group();
  g.position.set(h.pos[0], GRADE, h.pos[1]);
  g.rotation.y = h.rotY;

  const solid = (geo, mode, opts, lift) => {
    if (lift) setLift(geo, H.lift);
    const m = new THREE.Mesh(geo, life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }), mode, opts));
    m.castShadow = !!tier.shadow;
    m.receiveShadow = true;
    m.customDepthMaterial = lifeDepth(mode, opts);
    m.frustumCulled = false;
    g.add(m);
    return m;
  };

  // foundation
  solid(mergeTimed(S.slab.map((geo, i) => ({ geo, t: [...stagger(H.foundation, i / Math.max(1, S.slab.length - 1), 0.5), ...out] }))), MODE.DROP, { drop: 3 });

  // wall framing: studs sweep round each volume, then the plates
  const sp = 0.61 / tier.framing;
  const studs = [], plates = [];
  for (const v of S.vols) {
    const cx = (v.x[0] + v.x[1]) / 2, cz = (v.z[0] + v.z[1]) / 2;
    const corners = [[v.x[0] + 0.11, v.z[0] + 0.11], [v.x[1] - 0.11, v.z[0] + 0.11], [v.x[1] - 0.11, v.z[1] - 0.11], [v.x[0] + 0.11, v.z[1] - 0.11]];
    for (let e = 0; e < 4; e++) {
      const a = corners[e], b = corners[(e + 1) % 4];
      const Lx = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      const n = Math.max(2, Math.round(Lx / sp));
      for (let k = 0; k < n; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / n, z = a[1] + ((b[1] - a[1]) * k) / n;
        studs.push({ m: mtx(x, PLINTH, z, 0, ang, 0, 0.14, v.h - 0.2, 0.1), key: Math.atan2(z - cz, x - cx) + e * 0.001 });
      }
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      plates.push(mtx(mx, PLINTH + 0.02, mz, 0, ang, 0, Lx, 0.1, 0.16), mtx(mx, PLINTH + v.h - 0.18, mz, 0, ang, 0, Lx, 0.1, 0.16));
    }
  }
  studs.sort((a, b) => a.key - b.key);
  const timberMat = (lift) => {
    const opts = { drop: 3 };
    if (lift) opts.lift = 4.5;
    return life(new THREE.MeshStandardMaterial({ color: C.framing, roughness: 0.85 }), MODE.DROP, opts);
  };
  const unitBase = new THREE.BoxGeometry(1, 1, 1); unitBase.translate(0, 0.5, 0);
  {
    const list = [...studs.map((s, i) => ({ m: s.m, t: [...stagger([H.framing[0], H.framing[0] + (H.framing[1] - H.framing[0]) * 0.8], i / studs.length, 0.08), T.real[0], T.real[1]] })),
      ...plates.map((m, i) => ({ m, t: [...stagger([H.framing[0] + (H.framing[1] - H.framing[0]) * 0.55, H.framing[1]], i / plates.length, 0.2), T.real[0], T.real[1]] }))];
    const geo = unitBase.clone();
    const arr = new Float32Array(list.length * 4);
    list.forEach((s, i) => arr.set(s.t, i * 4));
    geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
    const im = new THREE.InstancedMesh(geo, timberMat(false), list.length);
    list.forEach((s, i) => im.setMatrixAt(i, s.m));
    im.castShadow = !!tier.shadow;
    im.customDepthMaterial = lifeDepth(MODE.DROP, { drop: 3 });
    im.frustumCulled = false;
    g.add(im);
  }

  // roof structure: rafters in pairs, a ridge beam; it lifts with the roof to show the rooms
  {
    const rafters = [];
    const step = 0.8 / tier.framing;
    for (const r of S.roofs) {
      if (r.kind === 'flat') continue;
      if (r.kind === 'shed') {
        const tilt = r.vkind === 'garage' ? -0.1 : 0.1;
        for (let x = r.cx - r.w / 2 + 0.2; x <= r.cx + r.w / 2 - 0.2; x += step) rafters.push(mtx(x, r.rt + 0.35, r.cz, tilt, 0, 0, 0.1, 0.22, r.d + 0.6));
        continue;
      }
      const alongX = r.w >= r.d;
      const span = (alongX ? r.d : r.w) + 0.9, half = span / 2, lenR = Math.hypot(half, r.rh), th = Math.atan2(r.rh, half);
      const run = alongX ? r.w : r.d;
      for (let k = -run / 2 + 0.2; k <= run / 2 - 0.2; k += step) {
        if (alongX) {
          rafters.push(mtx(r.cx + k, r.rt + r.rh / 2, r.cz - half / 2, -th, 0, 0, 0.1, 0.2, lenR));
          rafters.push(mtx(r.cx + k, r.rt + r.rh / 2, r.cz + half / 2, th, 0, 0, 0.1, 0.2, lenR));
        } else {
          rafters.push(mtx(r.cx - half / 2, r.rt + r.rh / 2, r.cz + k, 0, 0, th, lenR, 0.2, 0.1));
          rafters.push(mtx(r.cx + half / 2, r.rt + r.rh / 2, r.cz + k, 0, 0, -th, lenR, 0.2, 0.1));
        }
      }
      rafters.push(alongX ? mtx(r.cx, r.rt + r.rh - 0.1, r.cz, 0, 0, 0, run, 0.22, 0.14) : mtx(r.cx, r.rt + r.rh - 0.1, r.cz, 0, 0, 0, 0.14, 0.22, run));
    }
    if (rafters.length) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const arr = new Float32Array(rafters.length * 4);
      rafters.forEach((_, i) => arr.set([...stagger(H.roofStructure, i / rafters.length, 0.1), T.real[0], T.real[1]], i * 4));
      geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
      setLift(geo, H.lift);
      const im = new THREE.InstancedMesh(geo, timberMat(true), rafters.length);
      rafters.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = !!tier.shadow;
      im.customDepthMaterial = lifeDepth(MODE.DROP, { drop: 3, lift: 4.5 });
      im.frustumCulled = false;
      g.add(im);
    }
  }

  // envelope: wall panels snap in one by one
  solid(mergeTimed(S.panels.map((geo, i) => ({ geo, t: [...stagger(H.walls, i / S.panels.length, 0.22), ...out] }))), MODE.DROP, { drop: 5 });
  // roof and fascia, lifted during the interior reveal
  solid(mergeTimed([...S.fascia, ...S.roof].map((geo, i, a) => ({ geo, t: [...stagger(H.roof, i / a.length, 0.4), ...out] }))), MODE.DROP, { drop: 6, lift: 4.5 }, true);
  // windows, doors, porch
  solid(mergeTimed([...S.glass, ...S.trim].map((geo, i, a) => ({ geo, t: [...stagger(H.windows, i / a.length, 0.2), ...out] }))), MODE.POP, {});
  // interior massing, seen from above while the roof hovers
  {
    const m = S.main, w = m.x[1] - m.x[0], d = m.z[1] - m.z[0], cx = (m.x[0] + m.x[1]) / 2, cz = (m.z[0] + m.z[1]) / 2;
    const items = [
      box(0.14, 2.5, d * 0.45, cx + w * 0.08, PLINTH, cz + d * 0.24, C.interior),
      box(w * 0.42, 2.5, 0.14, cx - w * 0.27, PLINTH, cz + d * 0.04, C.interior),
      box(2.4, 0.95, 1.0, cx - w * 0.24, PLINTH, cz - d * 0.2, 0xD6C8B0),
      box(2.3, 0.8, 0.95, cx + w * 0.26, PLINTH, cz - d * 0.24, 0x9AA38F),
      box(1.9, 0.6, 2.2, cx - w * 0.28, PLINTH, cz + d * 0.3, 0xEFE8DC),
      box(1.8, 0.78, 1.0, cx + w * 0.3, PLINTH, cz + d * 0.28, 0xB59B78),
      box(3.0, 0.04, 2.2, cx + w * 0.24, PLINTH, cz - d * 0.1, 0xC9B79A),
    ];
    solid(mergeTimed(items.map((geo, i) => ({ geo, t: [...stagger(H.interior, i / items.length, 0.3), T.real[0], T.real[1]] }))), MODE.DROP, { drop: 2.5 });
  }
  return { group: g, lot, pos: h.pos, rotY: h.rotY };
}
