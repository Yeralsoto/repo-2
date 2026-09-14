// The wider community, arriving gradually once the first place is lived in:
// a crossroad, a few homes on the public road, a small school, a rec field, a corner shop,
// a second small neighbourhood — then, farther out, possibility again: a boundary, a future
// road, homesites, a utility extension, and the first tiles of a new road.
// Everything connects to the public road; nothing here is dense. It stays rural Northwest Florida.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { life, MODE, C, setLife } from './shaders.js';
import { T, SITES } from './config.js';
import { PUBLIC, rng, distToSeg } from './layout.js';
import { GRADE, gable } from './world.js';
import { box, merge, paint, ribbon, stagger, lerpT, NEVER } from './kit.js';
import { carGeoPainted } from './life.js';

// Where growth clears the woods, and when. world.js asks this when it plants the wider woods.
export function growthClearTime(x, z) {
  const G = T.growth, S = SITES;
  const inRect = (r, pad = 12) => Math.abs(x - r.c[0]) < r.w / 2 + pad && Math.abs(z - r.c[1]) < r.d / 2 + pad;
  if (Math.abs(x - S.crossroadX) < 16) return lerpT(G.crossroad, Math.min(0.8, Math.abs(z - PUBLIC.z(S.crossroadX)) / 1700));
  if (inRect(S.school)) return G.school.pad[0];
  if (inRect(S.park)) return G.park[0];
  if (inRect(S.retail)) return G.retail[0];
  if (inRect(S.sub2)) return G.subdivision2[0];
  for (const h of S.rural) {
    if (Math.hypot(x - h[0], z - h[1]) < 28) return G.ruralHomes[0];
    if (Math.abs(x - h[0] - 4) < 6 && z > PUBLIC.z(x) && z < h[1]) return G.ruralHomes[0];
  }
  if (distToSeg([x, z], S.next.road[0], S.next.road[1]) < 10) return T.expansion.infra[0];
  if (G.subdivision3 && inRect(S.sub3)) return G.subdivision3[0];
  if (G.subdivision4 && inRect(S.sub4)) return G.subdivision4[0];
  if (G.subdivision5 && inRect(S.sub5)) return G.subdivision5[0];
  if (G.subdivision6 && inRect(S.sub6)) return G.subdivision6[0];
  const E = T.expansion;
  if (E.farInfra) {
    for (const f of S.far) {
      const dz = (z - PUBLIC.z(x)) * f.side;
      if (Math.abs(x - f.x) < 10 && dz > 0 && dz < 100) return E.farInfra[0];
    }
  }
  return null;
}

export function buildGrowth(raw, tier) {
  const group = new THREE.Group();
  const R = rng(515);
  const G = T.growth, S = SITES, E = T.expansion;
  const gy = (x, z) => raw(x, z) - 0.5;
  const drops = [], fades = [], net = [];
  const put = (list, geo, t) => list.push({ geo, t: t.length === 2 ? [...t, ...NEVER] : t });
  const block = (list, w, h, d, x, z, color, t, ry = 0, y = null) =>
    put(list, box(w, h + 1.5, d, x, (y ?? gy(x, z)) - 1.5, z, color, ry), t);
  const road = (list, a, b, width, color, range, o = {}) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L0 = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L0 / (o.step || 24)));
    const ang = Math.atan2(-dz, dx);
    for (let i = 0; i < n; i++) {
      const cx = a[0] + (dx * (i + 0.5)) / n, cz = a[1] + (dz * (i + 0.5)) / n;
      block(list, L0 / n + 0.3, o.thick || 0.28, width, cx, cz, color, stagger(range, i / n, o.dur ?? 0.2), ang, o.y ?? gy(cx, cz) + 0.35);
    }
  };
  const house = (list, x, z, ry, fam, t, y = null) => {
    const wall = fam ? C.wallSand : C.wallWhite, roofC = fam ? C.roofSlate : C.roofBronze;
    const g = merge([
      box(14, 4.7, 10, 0, -1.5, 0, wall),
      gable(15, 11, 2.8, roofC, 3.2),
      box(8, 1.3, 0.12, -2, 1.0, -5.06, C.glass),
      box(5.4, 2.3, 0.12, 4, 0, -5.06, 0xDDD6C8),
      box(1.0, 2.1, 0.12, -5.8, 0, -5.06, 0x6F5846),
    ]);
    g.rotateY(ry);
    g.translate(x, y ?? gy(x, z), z);
    put(list, g, t);
  };
  const car = (x, z, ry, color, t, y = null) => {
    const g = carGeoPainted(color);
    g.rotateY(ry);
    g.translate(x, (y ?? gy(x, z)) + 0.3, z);
    put(fades, g, t);
  };
  const tree = (x, z, s, t) => {
    const trunk = new THREE.CylinderGeometry(0.14, 0.2, 2.8, 6); trunk.translate(0, 1.4, 0);
    const crown = new THREE.IcosahedronGeometry(1.8, 1); crown.translate(0, 3.6, 0);
    const g = merge([paint(trunk, C.trunk), paint(crown, 0x66784A)]);
    g.scale(s, s, s);
    g.translate(x, gy(x, z), z);
    put(fades, g, t);
  };
  const rect = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2], [cx - w / 2, cz - d / 2]];

  // ---------- a crossroad: the county road that makes the corridor a place ----------
  {
    const X = S.crossroadX, I = PUBLIC.z(X);
    road(drops, [X, I + PUBLIC.pave + 0.5], [X, 1700], 7.4, C.asphaltOld, G.crossroad, { step: 40 });
    road(drops, [X, I - PUBLIC.pave - 0.5], [X, -1700], 7.4, C.asphaltOld, G.crossroad, { step: 40 });
    net.push({ pts: [[X, -1700], [X, 1700]], w: 2.2 });
  }

  // ---------- a few homes on the public road, each with its own drive ----------
  S.rural.forEach((h, i) => {
    const t = stagger(G.ruralHomes, i / (S.rural.length - 1), 0.4);
    const dx = h[0] + 4, from = [dx, PUBLIC.z(dx) + PUBLIC.pave], to = [dx, h[1] - 5.6];
    road(drops, from, to, 3.8, C.concrete, [t[0], lerpT(t, 0.5)], { step: 6, thick: 0.15 });
    house(drops, h[0], h[1], 0, i % 2, [lerpT(t, 0.4), t[1]]);
    if (i % 2 === 0) car(dx, h[1] - 11, Math.PI / 2, 0x8C958F, [t[1], t[1] + 0.004]);
    net.push({ pts: [from, to], w: 1 });
  });

  // ---------- a small school: pad → access road → building → parking → field ----------
  {
    const sc = S.school, [sx, sz] = sc.c, y = gy(sx, sz), top = y + 0.25, H = G.school;
    block(drops, sc.w, 0.25, sc.d, sx, sz, 0xCDBE9A, H.pad, 0, y);
    const ax = sx - 70, aisle = sz - sc.d / 2 + 22;
    const a0 = [ax, PUBLIC.z(ax) + PUBLIC.pave], a1 = [ax, aisle], a2 = [sx - 18, aisle];
    road(drops, a0, a1, 7, C.asphalt, [H.access[0], lerpT(H.access, 0.7)], { step: 12, y: top });
    road(drops, a1, a2, 7, C.asphalt, [lerpT(H.access, 0.6), H.access[1]], { step: 12, y: top });
    const bt = (f) => stagger(H.building, f, 0.35);
    block(drops, 86, 7.5, 14, sx + 15, sz - 28, 0xD9CFBC, bt(0), 0, top);
    block(drops, 14, 7.5, 44, sx + 51, sz + 1, 0xD9CFBC, bt(0.2), 0, top);
    block(drops, 34, 10, 26, sx - 18, sz + 12, 0xCBBBA2, bt(0.4), 0, top);
    block(drops, 87, 0.5, 15, sx + 15, sz - 28, 0x77756D, bt(0.6), 0, top + 7.5);
    block(drops, 15, 0.5, 45, sx + 51, sz + 1, 0x77756D, bt(0.65), 0, top + 7.5);
    block(drops, 35, 0.5, 27, sx - 18, sz + 12, 0x6E6D66, bt(0.7), 0, top + 10);
    block(fades, 80, 1.4, 0.2, sx + 15, sz - 35.1, C.glass, bt(0.8), 0, top + 3.1);
    block(drops, 12, 0.35, 5, sx - 6, sz - 37.5, C.trim, bt(0.85), 0, top + 3.4);
    block(drops, 72, 0.12, 34, sx - 55, sz - 55, C.asphalt, H.parking, 0, top);
    for (let i = 0; i < 12; i++) block(fades, 0.25, 0.03, 5, sx - 86 + i * 6, sz - 62, 0xE6E0D2, stagger(H.parking, 0.5, 0.3), 0, top + 0.13);
    for (let i = 0; i < 7; i++) car(sx - 86 + (i * 2 + (i > 3 ? 3 : 0)) * 6 + 3, sz - 62, Math.PI / 2, [0xD9D4CA, 0x8C958F, 0x5D6B72, 0xB8A48A][i % 4], [H.parking[1], H.parking[1] + 0.005], top);
    block(drops, 104, 0.1, 58, sx + 40, sz + 55, 0x7E9656, H.field, 0, top);
    const oval = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2, st = Math.cos(a) > 0 ? 25 : -25;
      oval.push([sx + 40 + st + Math.cos(a) * 21, sz + 55 + Math.sin(a) * 21]);
    }
    const track = ribbon(oval, 1.3, top + 0.14);
    put(fades, paint(stripGeo(track), 0xE3D9C6), stagger(H.field, 0.6, 0.4));
    for (const dx of [-6, 86]) block(drops, 0.2, 2.4, 7, sx + 40 - 46 + dx, sz + 55, C.trim, stagger(H.field, 0.8, 0.2), 0, top);
    for (let i = 0; i < 9; i++) tree(sx - sc.w / 2 + 12 + i * 23, sz + sc.d / 2 - 6, 0.9 + R() * 0.3, stagger(H.field, i / 9, 0.3));
    net.push({ pts: [a0, a1, a2], w: 1.6 }, { pts: rect(sx, sz, sc.w, sc.d), w: 1.2 }, { pts: rect(sx + 40, sz + 55, 104, 58), w: 0.9 });
  }

  // ---------- a recreation field ----------
  {
    const pk = S.park, [px, pz] = pk.c, y = gy(px, pz), top = y + 0.2;
    block(drops, pk.w, 0.2, pk.d, px, pz, 0x7F9559, G.park, 0, y);
    block(drops, 26, 0.06, 26, px + 18, pz + 16, C.clay, stagger(G.park, 0.4, 0.3), Math.PI / 4, top);
    block(drops, 30, 0.1, 18, px - 38, pz - 38, C.asphalt, stagger(G.park, 0.2, 0.3), 0, top);
    for (const [dx, dz] of [[-2, -2], [6, -2], [-2, 4], [6, 4]]) block(drops, 0.25, 2.8, 0.25, px - 40 + dx, pz + 30 + dz, C.trim, stagger(G.park, 0.6, 0.2), 0, top);
    block(drops, 11, 0.3, 9, px - 36, pz + 31, C.roofSlate, stagger(G.park, 0.7, 0.2), 0, top + 2.8);
    const d0 = [px - 38, PUBLIC.z(px - 38) + PUBLIC.pave], d1 = [px - 38, pz - 47];
    road(drops, d0, d1, 5.5, C.asphalt, stagger(G.park, 0, 0.35), { step: 12 });
    for (let i = 0; i < 6; i++) tree(px + pk.w / 2 - 6, pz - pk.d / 2 + 10 + i * 18, 0.85 + R() * 0.3, stagger(G.park, 0.5 + i * 0.07, 0.3));
    net.push({ pts: [d0, d1], w: 1.2 }, { pts: rect(px, pz, pk.w, pk.d), w: 1 });
  }

  // ---------- a corner shop at the crossroad ----------
  {
    const rt = S.retail, [rx, rz] = rt.c, y = gy(rx, rz), top = y + 0.2;
    block(drops, rt.w, 0.2, rt.d, rx, rz, 0xB8B0A0, G.retail, 0, y);
    block(drops, 60, 6, 18, rx + 20, rz + 22, 0xD4C6AE, stagger(G.retail, 0.3, 0.35), 0, top);
    block(drops, 61, 0.5, 19, rx + 20, rz + 22, 0x6E6D66, stagger(G.retail, 0.45, 0.3), 0, top + 6);
    block(fades, 56, 2.2, 0.2, rx + 20, rz + 12.9, C.glass, stagger(G.retail, 0.55, 0.3), 0, top + 0.6);
    block(drops, 70, 0.1, 30, rx - 8, rz - 16, C.asphalt, stagger(G.retail, 0.2, 0.35), 0, top);
    for (const [dx, dz] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) block(drops, 0.4, 4.6, 0.4, rx - 30 + dx, rz - 20 + dz, C.trim, stagger(G.retail, 0.6, 0.2), 0, top);
    block(drops, 20, 0.5, 14, rx - 30, rz - 20, 0xE6E0D2, stagger(G.retail, 0.7, 0.2), 0, top + 4.6);
    for (let i = 0; i < 5; i++) car(rx - 30 + i * 9, rz - 6, Math.PI / 2, [0xA9ADA7, 0x6E6258, 0xD9D4CA, 0x5D6B72, 0xB8A48A][i], [G.retail[1], G.retail[1] + 0.005], top);
    const a0 = [S.crossroadX + 3.7, rz - 16], a1 = [rx - rt.w / 2, rz - 16];
    road(drops, a0, a1, 7, C.asphalt, stagger(G.retail, 0, 0.3), { step: 6 });
    net.push({ pts: [a0, a1], w: 1.2 }, { pts: rect(rx, rz, rt.w, rt.d), w: 1 });
  }

  // ---------- a second small neighbourhood farther down the road (and, on The Work, two more) ----------
  const subdivision = (s2, g) => {
    const X = s2.x;
    const dir = s2.dir || -1, zStart = PUBLIC.z(X) + dir * (PUBLIC.pave + 0.5);   // -1: street runs north
    road(drops, [X, zStart], [X, s2.bulbZ], 7.2, C.asphalt, [g[0], lerpT(g, 0.3)], { step: 8 });
    const disc = new THREE.CylinderGeometry(14, 14, 1.8, 28);
    disc.translate(X, gy(X, s2.bulbZ) + 0.35 - 0.9 + 0.28, s2.bulbZ);
    put(drops, paint(disc, C.asphalt), [lerpT(g, 0.28), lerpT(g, 0.34)]);
    net.push({ pts: [[X, PUBLIC.z(X)], [X, s2.bulbZ]], w: 1.6 });
    let k = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < s2.lots; i++, k++) {
        const z0 = s2.top + dir * i * 30, z1 = z0 + dir * 30, zc = (z0 + z1) / 2;
        const f = k / (2 * s2.lots - 1);
        const hx = X + side * 26;
        const d0 = [X + side * 3.6, zc - dir * 4], d1 = [X + side * 20.6, zc - dir * 4];
        road(drops, d0, d1, 4, C.concrete, stagger([lerpT(g, 0.3), lerpT(g, 0.6)], f, 0.2), { step: 4, thick: 0.15 });
        house(drops, hx, zc, side * Math.PI / 2, (k + 1) % 2, stagger([lerpT(g, 0.5), g[1]], f, 0.2));
        if (k % 3 !== 1) car(X + side * 15, zc - dir * 4, 0, [0xD9D4CA, 0x8C958F, 0x5D6B72][k % 3], [g[1], g[1] + 0.004]);
        net.push({ pts: [d0, d1], w: 0.8 }, { pts: [[X + side * 9, z0], [X + side * 51, z0], [X + side * 51, z1], [X + side * 9, z1], [X + side * 9, z0]], w: 0.8 });
      }
    }
  };
  subdivision(S.sub2, G.subdivision2);
  if (G.subdivision3) subdivision(S.sub3, G.subdivision3);
  if (G.subdivision4) subdivision(S.sub4, G.subdivision4);
  if (G.subdivision5) subdivision(S.sub5, G.subdivision5);
  if (G.subdivision6) subdivision(S.sub6, G.subdivision6);

  // ---------- possibility again: a boundary, a future road, homesites, a utility extension ----------
  const drawn = { graphite: [], laton: [] };
  {
    const lineY = (p) => gy(p[0], p[1]) + 0.9;
    // on The Work the drawing gives way when the site is built as a subdivision
    const out = E.out || T.network.othersOut;
    const nx = S.next;
    drawn.graphite.push({ geo: ribbon(nx.poly, 2.4, lineY, { closed: true }), t: [...stagger(E.lines, 0, 0.45), ...out] });
    const fr = [...nx.road, ...nx.roadMore.slice(1)];
    drawn.graphite.push({ geo: ribbon(fr, 2, lineY, { dash: [10, 7] }), t: [...stagger(E.lines, 0.3, 0.45), ...out] });
    const util = [];
    for (let x = -180; x >= -720; x -= 10) util.push([x, PUBLIC.z(x) - 11]);
    drawn.laton.push({ geo: ribbon(util, 1.4, lineY, { dash: [6, 5] }), t: [...stagger(E.lines, 0.15, 0.45), ...out] });
    for (let k = 0; k < 5; k++) {
      for (const side of [-1, 1]) {
        const z = 104 - k * 38, x0 = -484 + side * 11, x1 = -484 + side * 40;
        drawn.graphite.push({ geo: ribbon([[x0, z - 17], [x1, z - 17], [x1, z + 17], [x0, z + 17]], 1, lineY, { closed: true }), t: [...stagger(E.lines, 0.55 + k * 0.08, 0.25), ...out] });
      }
    }
    net.push({ pts: [...nx.poly, nx.poly[0]], w: 1.4 }, { pts: fr, w: 1.4 });
    // the first voxel tiles of the new road, and its stakes
    const a = [nx.road[0][0], PUBLIC.z(nx.road[0][0]) - PUBLIC.pave - 0.5], b = nx.road[1];
    road(drops, a, b, 9, C.clay, E.infra, { step: 4, thick: 0.14, dur: 0.1 });
    for (let i = 0; i <= 6; i++) {
      const z = a[1] + ((b[1] - a[1]) * i) / 6;
      for (const side of [-1, 1]) block(drops, 0.45, 3.2, 0.45, a[0] + side * 7, z, C.framing, stagger(E.infra, i / 6, 0.2));
    }
  }

  // ---------- The Work's last image: farther out, more land being drawn into subdivisions ----------
  if (E.farLines) {
    const lineY = (p) => gy(p[0], p[1]) + 0.9;
    S.far.forEach((site, si) => {
      const x = site.x, sd = site.side, lag = si * 0.25;
      const edge = PUBLIC.z(x) + sd * (PUBLIC.pave + 0.5), zA = edge + sd * 22, zB = edge + sd * 300;
      const tl = (f, d = 0.45) => [...stagger(E.farLines, Math.min(1, lag + f * 0.75), d), ...NEVER];
      const poly = [[x - 150, zA], [x + 150, zA], [x + 150, zB], [x - 150, zB]];
      drawn.graphite.push({ geo: ribbon(poly, 2.4, lineY, { closed: true }), t: tl(0) });
      drawn.graphite.push({ geo: ribbon([[x, edge], [x, zB - sd * 40]], 2, lineY, { dash: [10, 7] }), t: tl(0.25) });
      for (let k = 0; k < 4; k++) {
        for (const s of [-1, 1]) {
          const z = zA + sd * (30 + k * 52), x0 = x + s * 11, x1 = x + s * 52;
          drawn.graphite.push({ geo: ribbon([[x0, z], [x1, z], [x1, z + sd * 46], [x0, z + sd * 46]], 1, lineY, { closed: true }), t: tl(0.45 + k * 0.1, 0.25) });
        }
      }
      const util = [];
      for (let dx = -150; dx <= 150; dx += 10) util.push([x + dx, PUBLIC.z(x + dx) + sd * 11]);
      drawn.laton.push({ geo: ribbon(util, 1.4, lineY, { dash: [6, 5] }), t: tl(0.15) });
      const b = [x, edge + sd * 92];
      road(drops, [x, edge], b, 9, C.clay, stagger(E.farInfra, lag, 0.6), { step: 4, thick: 0.14, dur: 0.1 });
      for (let i = 0; i <= 4; i++) {
        const z = edge + ((b[1] - edge) * i) / 4;
        for (const side of [-1, 1]) block(drops, 0.45, 3.2, 0.45, x + side * 7, z, C.framing, stagger(E.farInfra, Math.min(1, lag + i / 8), 0.2));
      }
      net.push({ pts: [...poly, poly[0]], w: 1.4 });
    });
  }

  // ---------- meshes ----------
  const mergeTimed = (list) => mergeGeometries(list.map(({ geo, t }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    return setLife(g, t);
  }));
  const dropMesh = new THREE.Mesh(mergeTimed(drops), life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }), MODE.DROP, { drop: 6, edge: 0.04, edgeK: 0.9 }));
  const fadeMesh = new THREE.Mesh(mergeTimed(fades), life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), MODE.DISSOLVE));
  for (const m of [dropMesh, fadeMesh]) { m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
  const lineMat = (color) => life(new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), MODE.DRAW);
  for (const [key, color] of [['graphite', C.graphite], ['laton', C.laton]]) {
    const m = new THREE.Mesh(mergeGeometries(drawn[key].map(({ geo, t }) => setLife(geo, t))), lineMat(color));
    m.renderOrder = 5;
    m.frustumCulled = false;
    group.add(m);
  }

  // ---------- traffic on the public road and the crossroad, placed by scroll ----------
  const movers = [];
  const TR = T.move.traffic;
  const kT = (p) => Math.min(1, Math.max(0, (p - TR[0]) / (TR[1] - TR[0])));
  const mover = (geo, fn) => {
    setLife(geo, [TR[0], TR[0] + 0.004, ...NEVER]);
    const m = new THREE.Mesh(geo, life(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), MODE.POP));
    m.frustumCulled = false;
    group.add(m);
    movers.push({ m, fn });
  };
  const angE = Math.atan2(-PUBLIC.T[1], PUBLIC.T[0]), angW = Math.atan2(PUBLIC.T[1], -PUBLIC.T[0]);
  const east = (x0, v) => (p) => { const x = x0 + 2700 * v * kT(p); return [x, GRADE + 0.22, PUBLIC.z(x) + 1.9, angE]; };
  const west = (x0, v) => (p) => { const x = x0 - 2700 * v * kT(p); return [x, GRADE + 0.22, PUBLIC.z(x) - 1.9, angW]; };
  const south = (z0, v) => (p) => { const z = z0 + 3000 * v * kT(p); return [S.crossroadX - 1.9, gy(S.crossroadX, z) + 0.63, z, -Math.PI / 2]; };
  mover(carGeoPainted(0x8C958F), east(-1500, 0.95));
  mover(carGeoPainted(0xD9D4CA), east(-420, 0.7));
  mover(carGeoPainted(0x5D6B72), west(1500, 0.9));
  mover(busGeo(), west(700, 0.55));
  mover(carGeoPainted(0xB8A48A), west(2300, 1.0));
  mover(carGeoPainted(0x6E6258), south(-1500, 0.9));

  function update(p) {
    for (const { m, fn } of movers) {
      const [x, y, z, ry] = fn(p);
      m.position.set(x, y, z);
      m.rotation.y = ry;
    }
  }
  return { group, net, update };
}

function stripGeo(g) {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('aS');
  return n;
}

function busGeo() {
  return merge([
    box(10.5, 2.5, 2.4, 0, 0.45, 0, 0xC2A35E),
    box(9.6, 0.8, 2.46, -0.2, 1.7, 0, 0x55606A),
    box(0.8, 0.9, 0.3, 3.5, 0, 1.1, 0x4A4640), box(0.8, 0.9, 0.3, -3.5, 0, 1.1, 0x4A4640),
    box(0.8, 0.9, 0.3, 3.5, 0, -1.1, 0x4A4640), box(0.8, 0.9, 0.3, -3.5, 0, -1.1, 0x4A4640),
  ]);
}
