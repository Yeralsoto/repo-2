// Evidence of life, kept small and secondary: planting, mailboxes, porch lights, parked cars,
// bicycles, a few people — and the network in use. One car leaves its garage and drives the whole
// chain: driveway → internal road → entrance → public road. Another comes home the opposite way.
// Positions come from the plan, and movement is tied to scroll, never to a clock.
import * as THREE from 'three';
import { life, lifeDepth, MODE, setLife } from './shaders.js';
import { T } from './config.js';
import { rng, add, sub, mul, norm, len, pointInPoly, distToPolyline, PUBLIC, PAVE_HALF, BULB_PAVE, BULB_ISLAND } from './layout.js';
import { GRADE } from './world.js';
import { box, merge, paint, resample, stagger, instanced, trs, NEVER } from './kit.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (t) => t * t * (3 - 2 * t);

export function buildLife(L, reg, tier, houses, site) {
  const group = new THREE.Group();
  const R = rng(808);
  const out = T.deconstruct.homes;
  const f = (lot) => lot.id / (L.lots.length - 1);
  const land = (lot, dur = 0.35) => (lot.id === L.hero ? stagger(T.hero.finish, R(), 0.5) : stagger(T.landscaping, f(lot), dur));
  const lived = (lot) => stagger(T.life, f(lot), 0.3);
  const toW = (h, lx, lz) => [h.pos[0] + lx * Math.cos(h.rotY) + lz * Math.sin(h.rotY), h.pos[1] - lx * Math.sin(h.rotY) + lz * Math.cos(h.rotY)];
  const pools = {};
  const push = (key, m, c, t) => (pools[key] ||= []).push({ m, c, t });
  const clearOfDrive = (p, lot, pad) => distToPolyline(p, [lot.drive.apron[0], ...lot.drive.path]) > lot.drive.width / 2 + pad;
  const scale = tier.life;
  const OUT_LOT = 5, IN_LOT = 8;     // the two homes whose cars are on the move

  for (const lot of L.lots) {
    const h = lot.house;
    if (!h || !lot.drive) continue;
    const main = h.rects.find((r) => r.kind === 'main');
    const porch = h.rects.find((r) => r.kind === 'porch');
    const garage = h.rects.find((r) => r.kind === 'garage');
    const gx = (garage.x[0] + garage.x[1]) / 2;

    // shrubs along the front of the house
    const n = Math.max(3, Math.round((main.x[1] - main.x[0]) / 2.2));
    for (let i = 0; i < n; i++) {
      const lx = main.x[0] + 0.8 + ((main.x[1] - main.x[0] - 1.6) * i) / (n - 1);
      if (porch && lx > porch.x[0] - 0.6 && lx < porch.x[1] + 0.6) continue;
      const p = toW(h, lx, main.z[0] - 1.1);
      if (!clearOfDrive(p, lot, 0.6)) continue;
      const s = 0.7 + R() * 0.5;
      push('shrub', trs(p[0], GRADE, p[1], R() * 6.28, s, s * 0.85, s), new THREE.Color(0x5B6E45).offsetHSL(0, 0, (R() - 0.5) * 0.08), [...land(lot), ...out]);
    }
    // a garden bed at the end of the house away from the garage
    if (R() < 0.75) {
      const lx = gx > 0 ? main.x[0] + 1.9 : main.x[1] - 1.9;
      const p = toW(h, lx, main.z[0] - 2.8);
      if (clearOfDrive(p, lot, 1.5) && pointInPoly(p, lot.poly)) {
        push('bed', trs(p[0], GRADE, p[1], h.rotY, 3.2, 0.26, 1.15), new THREE.Color(0x6B5744), [...land(lot), ...out]);
        for (let k = 0; k < 5; k++) {
          const q = toW(h, lx - 1.2 + k * 0.6, main.z[0] - 2.8 + (R() - 0.5) * 0.5);
          const bloom = R() < 0.35;
          push('plant', trs(q[0], GRADE + 0.26, q[1], R() * 6.28, 0.42, 0.35 + R() * 0.45, 0.42), new THREE.Color(bloom ? 0xC99478 : 0x6E8450).offsetHSL(0, 0, (R() - 0.5) * 0.06), [...land(lot), ...out]);
        }
      }
    }
    // young trees in the front yard — kept off the driveway, the house and the lot line
    const want = lot.id % 3 === 0 ? 2 : 1;
    const frontV = h.vc + main.z[0];
    for (let k = 0, placed = 0; k < 40 && placed < want && frontV > 9; k++) {
      const p = lot.toWorld((R() - 0.5) * 24, 3.5 + R() * (frontV - 7));
      if (!pointInPoly(p, lot.poly) || distToPolyline(p, lot.poly, true) < 2.5) continue;
      if (!clearOfDrive(p, lot, 3)) continue;
      if (h.footprint.some((r) => pointInPoly(p, r) || distToPolyline(p, r, true) < 4)) continue;
      const s = 0.55 + R() * 0.35;
      push('youngTree', trs(p[0], GRADE, p[1], R() * 6.28, s, s, s), new THREE.Color().setScalar(0.9 + R() * 0.2), [...land(lot, 0.3), ...out]);
      placed++;
    }
    // mailbox in the right-of-way, beside the apron
    const [P, F] = lot.drive.apron;
    const dir = norm(sub(F, P)), side = [-dir[1], dir[0]];
    const mb = add(add(P, mul(dir, len(sub(F, P)) * 0.45)), mul(side, 3.7));
    push('mailbox', trs(mb[0], GRADE, mb[1], Math.atan2(-dir[1], dir[0]), 1, 1, 1), new THREE.Color(1, 1, 1), [...lived(lot), ...out]);
    // porch light
    const pl = houses.porchLights.find((q) => q.lot === lot);
    if (pl) push('light', trs(pl.p[0], pl.y, pl.p[1], h.rotY, 1, 1, 1), new THREE.Color(1, 1, 1), [...lived(lot), ...out]);
    // parked cars in most driveways (not the two whose cars are driving)
    if (lot.id % 3 !== 2 && lot.id !== OUT_LOT && lot.id !== IN_LOT && R() < 0.4 + 0.6 * scale) {
      const { out: rs } = resample([P, ...lot.drive.path], 1);
      const at = rs[Math.max(0, rs.length - 6)];
      const palette = [0xD9D4CA, 0x8C958F, 0x5D6B72, 0xB8A48A, 0x6E6258, 0xA9ADA7];
      push('car', trs(at.p[0], GRADE + 0.12, at.p[1], at.ang + (R() < 0.5 ? Math.PI : 0), 1, 1, 1), new THREE.Color(palette[lot.id % palette.length]), [...lived(lot), ...out]);
    }
    // bicycles leaning by two garages
    if (lot.id === 4 || lot.id === 15) {
      const sgn = gx >= 0 ? 1 : -1;
      const p = toW(h, gx + sgn * ((garage.x[1] - garage.x[0]) / 2 + 0.9), garage.z[0] + 1.4);
      push('bike', trs(p[0], GRADE + 0.02, p[1], h.rotY + Math.PI / 2, 1, 1, 1), new THREE.Color(1, 1, 1), [...lived(lot), ...out]);
    }
  }

  // the island in the turnaround and the entrance
  push('youngTree', trs(L.C[0], GRADE + 0.3, L.C[1], 0.4, 0.95, 0.95, 0.95), new THREE.Color(1, 1, 1), [...stagger(T.landscaping, 1, 0.3), ...out]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, p = [L.C[0] + Math.cos(a) * 3.8, L.C[1] + Math.sin(a) * 3.8];
    push('shrub', trs(p[0], GRADE + 0.3, p[1], a, 0.8, 0.7, 0.8), new THREE.Color(0x5E7147), [...stagger(T.landscaping, 1, 0.3), ...out]);
  }
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const q = L.spine.at(site.sStart + 4 + k * 3), p = add(q.p, mul(q.n, sgn * 12.5));
      push('shrub', trs(p[0], GRADE, p[1], R() * 6, 1.1, 0.8, 1.1), new THREE.Color(0x56693F), [...stagger(T.landscaping, 0, 0.3), ...out]);
    }
  }

  const geos = {
    shrub: () => { const g = new THREE.IcosahedronGeometry(1, 0); g.translate(0, 0.7, 0); return paint(g, 0xffffff); },
    bed: () => box(1, 1, 1, 0, 0, 0, 0xffffff),
    plant: () => box(1, 1, 1, 0, 0, 0, 0xffffff),
    youngTree: () => {
      const trunk = new THREE.CylinderGeometry(0.12, 0.18, 2.6, 6); trunk.translate(0, 1.3, 0);
      const c1 = new THREE.IcosahedronGeometry(1.6, 1); c1.translate(0, 3.2, 0);
      const c2 = new THREE.IcosahedronGeometry(1.05, 1); c2.translate(0.4, 4.1, -0.2);
      return merge([paint(trunk, 0x6E5642), paint(c1, 0x687A48), paint(c2, 0x758553)]);
    },
    mailbox: () => merge([box(0.12, 1.1, 0.12, 0, 0, 0, 0x5B4E42), box(0.5, 0.34, 0.28, 0, 1.05, 0, 0x56615A)]),
    light: () => new THREE.BoxGeometry(0.24, 0.24, 0.24),
    car: carGeo,
    bike: bikeGeo,
  };
  for (const [key, list] of Object.entries(pools)) {
    const geo = geos[key]();
    const arr = new Float32Array(list.length * 4);
    list.forEach((s, i) => arr.set(s.t, i * 4));
    geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(arr, 4));
    const mat = key === 'light'
      ? life(new THREE.MeshBasicMaterial({ color: 0xFFDFA8, toneMapped: false }), MODE.POP)
      : life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: key === 'shrub' }), MODE.POP);
    const m = instanced(geo, mat, list.map((s) => s.m), { colors: list.map((s) => s.c) });
    if (tier.shadow && (key === 'youngTree' || key === 'car')) { m.castShadow = true; m.customDepthMaterial = lifeDepth(MODE.POP); }
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------- the network in use ----------
  // Surface height along a route: public road, internal pavement, apron, driveway.
  const yAt = (p) => {
    if (Math.abs(p[1] - PUBLIC.z(p[0])) <= PUBLIC.pave + 0.4) return GRADE + 0.22;
    if (reg.inRow(p)) {
      const inBulb = Math.hypot(p[0] - L.C[0], p[1] - L.C[1]) <= BULB_PAVE + 0.3;
      return inBulb || len(sub(p, L.spine.nearest(p).p)) <= PAVE_HALF + 0.4 ? GRADE + 0.31 : GRADE + 0.2;
    }
    return GRADE + 0.12;
  };
  const e0 = L.spine.at(0).p;
  const movers = [];
  const mover = (geo, t, fn) => {
    setLife(geo, t);
    const m = new THREE.Mesh(geo, life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), MODE.POP));
    if (tier.shadow) { m.castShadow = true; m.customDepthMaterial = lifeDepth(MODE.POP); }
    m.frustumCulled = false;
    group.add(m);
    movers.push({ m, fn });
  };

  // a car leaving home: garage → driveway → southbound lane → right turn → west on the public road
  const lotA = L.lots.find((l) => l.id === OUT_LOT && l.drive);
  if (lotA) {
    const PA = lotA.drive.apron[0], qA = L.spine.nearest(PA);
    const drive = [...lotA.drive.path.slice().reverse(), PA, L.spine.off(qA.s - 5, -1.8)];
    const internal = [L.spine.off(qA.s - 5, -1.8)];
    for (let s = qA.s - 9; s > site.sStart - 1; s -= 4) internal.push(L.spine.off(s, -1.8));
    internal.push([e0[0] - 6, PUBLIC.z(e0[0] - 6) - 1.9]);
    const pub = [[e0[0] - 6, PUBLIC.z(e0[0] - 6) - 1.9]];
    for (let x = e0[0] - 22; x >= e0[0] - 420; x -= 16) pub.push([x, PUBLIC.z(x) - 1.9]);
    const route = chain([[drive, 0.24], [internal, 0.46], [pub, 0.3]], yAt);
    const [a, b] = T.move.carOut;
    mover(carGeoPainted(0x7D8B86), [T.life[0], T.life[0] + 0.01, b + 0.002, b + 0.008], (p) => route(ease(clamp01((p - a) / (b - a)))));
  }
  // a car coming home: east on the public road → left into the entrance → northbound → its driveway
  const lotB = L.lots.find((l) => l.id === IN_LOT && l.drive);
  if (lotB) {
    const PB = lotB.drive.apron[0], qB = L.spine.nearest(PB);
    const pub = [];
    for (let x = e0[0] - 380; x <= e0[0] - 12; x += 16) pub.push([x, PUBLIC.z(x) + 1.9]);
    const internal = [pub[pub.length - 1]];
    for (let s = site.sStart - 1; s < qB.s + 3; s += 4) internal.push(L.spine.off(s, 1.8));
    const drive = [internal[internal.length - 1], PB, ...lotB.drive.path.slice(0, -4)];
    const route = chain([[pub, 0.3], [internal, 0.46], [drive, 0.24]], yAt);
    const [a, b] = T.move.carIn;
    mover(carGeoPainted(0xB8A48A), [a, a + 0.004, ...NEVER], (p) => route(ease(clamp01((p - a) / (b - a)))));
  }
  // two bicycles moving through the neighbourhood
  {
    const [a, b] = T.move.bikes;
    const k = (p) => ease(clamp01((p - a) / (b - a)));
    const rider = () => merge([bikeGeo(), personGeoRiding(0x5E6B63)]);
    mover(rider(), [a, a + 0.004, ...NEVER], (p) => {
      const s = L.S - 30 - (L.S - 90) * k(p), q = L.spine.at(s), pt = add(q.p, mul(q.n, -2.9));
      return [pt[0], GRADE + 0.31, pt[1], Math.atan2(q.t[1], -q.t[0])];
    });
    const r = (BULB_ISLAND + BULB_PAVE) / 2 + 2;
    mover(merge([bikeGeo(), personGeoRiding(0x8A6F5C)]), [a + 0.01, a + 0.014, ...NEVER], (p) => {
      const ang = 0.4 + Math.PI * 1.3 * k(p);
      return [L.C[0] + Math.cos(ang) * r, GRADE + 0.31, L.C[1] + Math.sin(ang) * r, Math.atan2(-Math.cos(ang), -Math.sin(ang))];
    });
  }
  // someone walking the shoulder, someone on a porch, someone at a mailbox
  {
    const [a, b] = T.move.walk;
    mover(personGeo(0x7F6A58), [a, a + 0.006, ...NEVER], (p) => {
      const q = L.spine.at(70 + 70 * clamp01((p - a) / (b - a))), pt = add(q.p, mul(q.n, -4.6));
      return [pt[0], GRADE + 0.2, pt[1], Math.atan2(-q.t[1], q.t[0])];
    });
  }
  const standers = [];
  const porchLot = L.lots.find((l) => l.id === 6 && l.house) || L.lots.find((l) => l.house && l.id !== L.hero);
  if (porchLot) {
    const h = porchLot.house, pr = h.rects.find((r) => r.kind === 'porch');
    standers.push([toW(h, (pr.x[0] + pr.x[1]) / 2 - 1, pr.z[0] - 0.9), 0xA38D76, h.rotY]);
  }
  const mailLot = L.lots.find((l) => l.id === 9 && l.drive);
  if (mailLot) {
    const [P, F] = mailLot.drive.apron, dir = norm(sub(F, P)), side = [-dir[1], dir[0]];
    standers.push([add(add(P, mul(dir, len(sub(F, P)) * 0.45)), mul(side, 4.6)), 0x5F6E7A, Math.atan2(-dir[1], dir[0])]);
  }
  for (const [p, col, ry] of standers) mover(personGeo(col), [T.life[0] + 0.004, T.life[0] + 0.014, ...out], () => [p[0], GRADE, p[1], ry]);

  function update(p) {
    for (const { m, fn } of movers) {
      const [x, y, z, ry] = fn(p);
      m.position.set(x, y, z);
      m.rotation.y = ry;
    }
  }
  return { group, update };
}

// A route in weighted parts: each part gets its share of the time, so a short driveway is not
// over in a blink while the long public road takes the rest.
function chain(parts, yAt) {
  const routes = parts.map(([pts, w]) => ({ r: makeRoute(pts, yAt), w }));
  const W = routes.reduce((s, x) => s + x.w, 0);
  return (k) => {
    let acc = 0;
    for (let i = 0; i < routes.length; i++) {
      const w = routes[i].w / W;
      if (k <= acc + w || i === routes.length - 1) return routes[i].r.at(((k - acc) / w) * routes[i].r.total);
      acc += w;
    }
    return routes[routes.length - 1].r.at(0);
  };
}
function chaikin(pts, it = 3) {
  let P = pts;
  for (let k = 0; k < it; k++) {
    const Q = [P[0]];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    Q.push(P[P.length - 1]);
    P = Q;
  }
  return P;
}
function makeRoute(pts, yAt) {
  const P = chaikin(pts, 3);
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const ys = P.map(yAt);
  const total = cum[cum.length - 1] || 1;
  function at(d) {
    d = Math.min(total, Math.max(0, d));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const t = (d - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
    const a = P[lo], b = P[hi];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    return [a[0] + dx * t, ys[lo] + (ys[hi] - ys[lo]) * t, a[1] + dz * t, Math.atan2(-dz, dx)];
  }
  return { at, total };
}

export function carGeo() {
  return merge([
    box(4.4, 0.72, 1.8, 0, 0.26, 0, 0xffffff),
    box(2.3, 0.6, 1.62, -0.25, 0.98, 0, 0xffffff),
    box(2.1, 0.46, 1.66, -0.25, 1.04, 0, 0x6B7479),
    box(0.62, 0.56, 0.24, 1.35, 0, 0.84, 0x4A4640), box(0.62, 0.56, 0.24, -1.35, 0, 0.84, 0x4A4640),
    box(0.62, 0.56, 0.24, 1.35, 0, -0.84, 0x4A4640), box(0.62, 0.56, 0.24, -1.35, 0, -0.84, 0x4A4640),
  ]);
}
export function carGeoPainted(color) {
  const g = carGeo();
  const c = new THREE.Color(color), col = g.attributes.color;
  for (let i = 0; i < col.count; i++) {
    const white = col.getX(i) > 0.9;
    if (white) col.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}
function bikeGeo() {
  const parts = [];
  for (const x of [-0.52, 0.52]) {
    const w = new THREE.TorusGeometry(0.33, 0.035, 5, 14); w.translate(x, 0.34, 0);
    parts.push(paint(w, 0x3F4B45));
  }
  return merge([...parts, box(1.0, 0.05, 0.05, 0, 0.55, 0, 0x3F4B45), box(0.05, 0.4, 0.05, -0.15, 0.55, 0, 0x3F4B45), box(0.05, 0.35, 0.05, 0.45, 0.6, 0, 0x3F4B45)]);
}
function personGeo(cloth) {
  const body = new THREE.CapsuleGeometry(0.21, 0.95, 2, 6); body.translate(0, 0.7, 0);
  const head = new THREE.SphereGeometry(0.12, 8, 6); head.translate(0, 1.52, 0);
  return merge([paint(body, cloth), paint(head, 0xB9A48E)]);
}
function personGeoRiding(cloth) {
  const body = new THREE.CapsuleGeometry(0.2, 0.62, 2, 6); body.rotateZ(-0.35); body.translate(0.05, 1.12, 0);
  const head = new THREE.SphereGeometry(0.12, 8, 6); head.translate(0.28, 1.62, 0);
  return merge([paint(body, cloth), paint(head, 0xB9A48E)]);
}
