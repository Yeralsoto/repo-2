// THE AERODROME — her thesis, rebuilt from its own numbers, one block at a time.
//
// One scroll value p (0–1 through .aero-track) drives everything except the aircraft: the plan draws
// itself on Verde Hondo, the camera tilts from plan to model, blocks rise under the lines (terrain →
// runway → taxiways → exits → markings → context) and the lines let go. Then the A321 plays ONCE on its
// own clock — explicit states, never restarted, never tied to scroll pixels — and the camera follows it
// only while the reader stays in its stretch. The camera then pulls out and turns east: the fields, the
// Río Bogotá, El Dorado, the city and the Cerros Orientales build around the annex (schematic context,
// see data.js). The ending sinks the world back to linework, keeps one centreline, and the paper airplane
// from About flies along it once.
//
// Blocks animate in the shader (voxel.js), so a frame is one uniform. The loop runs only while something
// is still moving and the section is on screen; then it stops and the page is still.
import * as THREE from 'three';
import { RUNWAY, XH, EXTENT, TYPE, classify, voxelize, markings, treeSpots, VEHICLE, route, planElements, bogota, PLACES } from './data.js';
import { U, blockMaterial, blockDepth, blockMesh } from './voxel.js';
import { aircraftGeometry } from './aircraft.js';

const root = document.querySelector('[data-aero]');
// if the model cannot start, the text comes back instead of a blank waiting page (the page's inline script set .wait)
if (root) { try { boot(); } catch (e) { root.classList.remove('wait'); throw e; } }

function boot() {
  const q = new URLSearchParams(location.search);
  const reduced = q.has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 720px)').matches;
  const track = root.querySelector('.aero-track'), view = root.querySelector('.aero-view');
  const holder = root.querySelector('.aero-canvas'), veil = root.querySelector('.aero-veil');
  const plan = root.querySelector('.aero-plan'), linesG = plan.querySelector('.aero-lines'), planeG = plan.querySelector('.aero-plane');

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { root.classList.remove('wait'); return; }
  if (!renderer.getContext()) { root.classList.remove('wait'); return; }
  root.classList.add(reduced ? 'still' : 'live');

  // ---------------------------------------------------------------- the score
  // First written for a 1500svh track; El Dorado added 300svh after the flight. M keeps every earlier moment
  // at the same scroll distance (0–.785 → 0–.654) and the ending after it (.785–1 → .821–1). build.py mirrors it.
  // Her ask (2026-09-14): the drawing starts with the first scroll — the title and first lines (0–.30) now take 0–.10.
  const M = (v) => (v <= 0.085 ? v * (0.012 / 0.085) : v <= 0.30 ? 0.012 + (v - 0.085) * (0.088 / 0.215)
    : v <= 0.785 ? 0.10 + (v - 0.30) * (0.554 / 0.485) : 0.821 + (v - 0.785) * (0.179 / 0.215));
  const W2 = (w) => [M(w[0]), M(w[1])];
  const PH = {
    build: { terrain: W2([0.30, 0.40]), strip: W2([0.36, 0.42]), runway: W2([0.38, 0.45]), taxi: W2([0.43, 0.49]), exits: W2([0.47, 0.51]), pads: W2([0.46, 0.50]), marks: W2([0.50, 0.535]), context: W2([0.42, 0.48]) },
    veil: { out: W2([0.30, 0.37]), back: W2([0.935, 0.965]) },
    flight: [M(0.565), 0.66],
    city: { field: [0.625, 0.665], river: [0.64, 0.67], eldorado: [0.655, 0.70], city: [0.665, 0.735], hill: [0.70, 0.75], labels: [0.672, 0.815] },
    end: { context: W2([0.885, 0.905]), city: W2([0.885, 0.915]), simp: W2([0.885, 0.93]), terrain: W2([0.905, 0.945]), taxi: W2([0.92, 0.95]), runway: W2([0.935, 0.962]), marks: W2([0.90, 0.925]) },
    lines: { back: W2([0.925, 0.95]), out: W2([0.962, 0.976]) },
    plane: M(0.976),
  };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const kR = (p, w) => clamp01((p - w[0]) / (w[1] - w[0]));
  const ss = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const DEG = Math.PI / 180;
  const life = (w, f) => { const sp = w[1] - w[0], s = w[0] + sp * 0.72 * f; return [s, s + sp * 0.28]; };
  function hash(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise(x, z) {   // value noise on a 140 m lattice
    const gx = x / 140, gz = z / 140, ix = Math.floor(gx), iz = Math.floor(gz), fx = ss(gx - ix), fz = ss(gz - iz);
    return lerp(lerp(hash(ix, iz), hash(ix + 1, iz), fx), lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), fx), fz);
  }

  // ---------------------------------------------------------------- renderer, light, ground
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  holder.appendChild(renderer.domElement);

  const SKY = 0xDDE0D5;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 4000, 16000);
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 90000);
  scene.add(new THREE.HemisphereLight(0xF2F0E6, 0x4E5B45, 1.25));
  const sun = new THREE.DirectionalLight(0xFFF4E2, 2.2);
  sun.position.set(-700, 1500, 950);
  if (!mobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -1700, right: 1700, top: 1700, bottom: -1700, near: 10, far: 5000 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
  }
  scene.add(sun, sun.target);

  const BASE = new THREE.Color(0x6B7F62), baseMat = new THREE.MeshLambertMaterial({ color: BASE.clone() });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(160000, 160000), baseMat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.35;
  base.receiveShadow = !mobile;
  scene.add(base);

  // ---------------------------------------------------------------- the voxel world, from data.js
  const H = RUNWAY.half, cell = mobile ? 10 : 5;
  const TOP = { [TYPE.RUNWAY]: 0.7, [TYPE.TAXI]: 0.55, [TYPE.EXIT]: 0.55, [TYPE.PAD]: 0.5, [TYPE.STRIP]: 0.15, [TYPE.RESA]: 0.1 };
  function groundTop(x, z) {   // 1 m steps out in the country; graded flat around the field
    const dx = Math.max(0, Math.abs(x) - (H + 300)), dz = Math.max(0, z - 90, -290 - z);
    return Math.floor(noise(x, z) * 3 * Math.min(1, Math.max(dx, dz) / 50));
  }
  const GROUND = [0x6F8466, 0x687E60, 0x76896A, 0x71865F], STRIPC = [0x8C9A74, 0x89976F], RESAC = [0xA89A7A, 0xA39574];
  const PAVE = { [TYPE.RUNWAY]: [0x4B4A45, 0x4E4D47], [TYPE.TAXI]: [0x5E5C55, 0x5B5952], [TYPE.EXIT]: [0x5E5C55, 0x5B5952], [TYPE.PAD]: [0x62605A, 0x605E57] };
  const pick = (arr, x, z) => arr[Math.floor(hash(x * 7 + 3, z * 13 + 1) * arr.length)];

  const world = [];
  for (const { x, z, t } of voxelize(cell)) {
    const sec = hash(Math.floor(x / 60), Math.floor(z / 60));
    if (t === TYPE.GROUND || t === TYPE.STRIP || t === TYPE.RESA) {
      const top = t === TYPE.GROUND ? groundTop(x, z) : TOP[t];
      const f = 0.8 * Math.min(1, Math.hypot(x / 1450, z / 345) / 1.2) + 0.2 * sec;
      const win = t === TYPE.GROUND ? PH.build.terrain : PH.build.strip;
      const color = t === TYPE.GROUND ? pick(GROUND, x, z) : t === TYPE.STRIP ? pick(STRIPC, x, z) : pick(RESAC, x, z);
      world.push({ x, y: -3, z, w: cell, h: top + 3, d: cell, color, life: [...life(win, f), ...life(PH.end.terrain, 1 - f)] });
    } else {
      let win, out, f;
      if (t === TYPE.RUNWAY) { win = PH.build.runway; out = PH.end.runway; f = 0.9 * (H - x) / (2 * H) + 0.1 * sec; }
      else if (t === TYPE.EXIT) { win = PH.build.exits; out = PH.end.taxi; f = 0.5 + 0.5 * Math.min(1, -z / 190); }
      else if (t === TYPE.PAD) { win = PH.build.pads; out = PH.end.taxi; f = sec; }
      else { win = PH.build.taxi; out = PH.end.taxi; f = 0.85 * clamp01((XH - x) / (2 * XH)) + 0.15 * sec; }
      world.push({ x, y: -3, z, w: cell, h: TOP[t] + 3, d: cell, color: pick(PAVE[t], x, z), life: [...life(win, f), ...life(out, f)] });
    }
  }
  const shadowOpts = { rise: 7, sink: 7 };
  scene.add(blockMesh(world, blockMaterial(shadowOpts), mobile ? null : blockDepth(shadowOpts)));

  const marks = markings().map((m) => ({
    x: m.x, y: m.lane === 'rw' ? TOP[TYPE.RUNWAY] : TOP[TYPE.TAXI], z: m.z, w: m.w, h: 0.14, d: m.d, ry: m.ry,
    color: m.lane === 'rw' ? 0xE6E1D3 : 0xC9AC78, life: [...life(PH.build.marks, m.f), ...life(PH.end.marks, m.f)],
  }));
  const markMesh = blockMesh(marks, blockMaterial({ rise: 1.2, sink: 1.2, edgeK: 1 }), null);
  markMesh.receiveShadow = !mobile;
  scene.add(markMesh);

  const ctx = [], TRUNK = 0x5A4A3A, LEAF = [0x3F5E45, 0x46664A, 0x3A5840];
  for (const s of treeSpots(mobile ? 70 : 160)) {
    const x = Math.round(s.x / cell) * cell, z = Math.round(s.z / cell) * cell, gy = groundTop(x, z), k = s.s, r = hash(x, z);
    const li = [...life(PH.build.context, r), ...life(PH.end.context, r)];
    ctx.push({ x, y: gy, z, w: 1.5 * k, h: 4 * k, d: 1.5 * k, color: TRUNK, life: li });
    ctx.push({ x, y: gy + 3 * k, z, w: 7.5 * k, h: 4.5 * k, d: 7.5 * k, color: pick(LEAF, x, z), life: li });
    ctx.push({ x, y: gy + 7.5 * k, z, w: 4.5 * k, h: 3 * k, d: 4.5 * k, color: pick(LEAF, z, x), life: li });
  }
  {   // one service vehicle beside the bay
    const { x, z, ry } = VEHICLE, c = Math.cos(ry), s = Math.sin(ry), li = [...life(PH.build.context, 0.9), ...life(PH.end.context, 0.2)];
    const at = (u) => [x + u * c, z - u * s];
    const [bx, bz] = at(-1), [cx, cz] = at(3.2), [w1x, w1z] = at(-2.6), [w2x, w2z] = at(2.6);
    ctx.push({ x: bx, y: 0.7, z: bz, w: 6, h: 2.4, d: 2.6, ry, color: 0xC9AC78, life: li });
    ctx.push({ x: cx, y: 0.7, z: cz, w: 2.2, h: 2.8, d: 2.6, ry, color: 0xECE7DC, life: li });
    ctx.push({ x: w1x, y: 0, z: w1z, w: 1.2, h: 0.8, d: 2.8, ry, color: 0x57524B, life: li });
    ctx.push({ x: w2x, y: 0, z: w2z, w: 1.2, h: 0.8, d: 2.8, ry, color: 0x57524B, life: li });
  }
  const ctxOpts = { rise: 12, sink: 12 };
  scene.add(blockMesh(ctx, blockMaterial(ctxOpts), mobile ? null : blockDepth(ctxOpts)));

  // El Dorado, the river, the Sabana, the city and the hills — coarser blocks, no shadows, one draw call
  const CITYC = {
    field: [0x7C8F63, 0x6E8458, 0x8A9868, 0x9C9A6C, 0x61774F], city: [0x9A6E57, 0xA47A60, 0x8E6552, 0xB4AC9C],
    hill: [0x3F5A45, 0x46634B, 0x4E6C52, 0x587558, 0x62805F, 0x6C8A66], river: [0x5F7F7C],
    'eld-rw': [0x4B4A45], 'eld-mark': [0xE6E1D3], 'eld-strip': [0x8C9A74], 'eld-apron': [0x77746B], 'eld-term': [0xD8D2C4], 'eld-tower': [0xECE7DC],
  };
  const around = bogota(mobile ? { pitch: 260, field: 400 } : { pitch: 140, field: 260 }).map((b) => {
    const arr = CITYC[b.kind], win = PH.city[b.kind] || PH.city.eldorado, f = clamp01(b.f);
    return { x: b.x, y: -0.35, z: b.z, w: b.w, h: b.h, d: b.d, ry: b.ry, color: arr[Math.floor(b.v * arr.length) % arr.length], life: [...life(win, f), ...life(PH.end.city, f)] };
  });
  scene.add(blockMesh(around, blockMaterial({ rise: 80, sink: 80, edgeW: 0.04 }), null));

  const aircraft = new THREE.Mesh(aircraftGeometry(1.5), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 }));
  aircraft.castShadow = !mobile;
  aircraft.visible = false;
  scene.add(aircraft);

  // ---------------------------------------------------------------- the route and the one playback
  const RT = route();
  function along(s) {
    const c = RT.cum, P = RT.pts;
    s = Math.max(0, Math.min(RT.total, s));
    let lo = 1, hi = c.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < s) lo = m + 1; else hi = m; }
    const a = P[lo - 1], b = P[lo], t = (s - c[lo - 1]) / ((c[lo] - c[lo - 1]) || 1);
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, h: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  const FT = { park: 0.9, taxi: 2.6, hold: 1.1, turn: 2.0, lined: 0.8, roll: 5.2, rotate: 1.2, air: 3.4 };
  const ROT = 1300, ACC = (2 * ROT) / (FT.roll * FT.roll), VR = ACC * FT.roll, CLIMB = Math.tan(0.19);
  function flightAt(T) {
    if (T < FT.park) return { state: 'PARKED', s: 0, alt: 0, pitch: 0, k: T / FT.park };
    T -= FT.park;
    if (T < FT.taxi) return { state: 'TAXIING', s: RT.hold * ss(T / FT.taxi), alt: 0, pitch: 0 };
    T -= FT.taxi;
    if (T < FT.hold) return { state: 'HOLDING', s: RT.hold, alt: 0, pitch: 0 };
    T -= FT.hold;
    if (T < FT.turn) return { state: 'TURNING', s: lerp(RT.hold, RT.lineup, ss(T / FT.turn)), alt: 0, pitch: 0 };
    T -= FT.turn;
    if (T < FT.lined) return { state: 'LINED_UP', s: RT.lineup, alt: 0, pitch: 0 };
    T -= FT.lined;
    if (T < FT.roll) return { state: 'ACCELERATING', s: RT.lineup + 0.5 * ACC * T * T, alt: 0, pitch: 0, k: T / FT.roll };
    T -= FT.roll;
    const s0 = RT.lineup + ROT;
    if (T < FT.rotate) {
      const k = T / FT.rotate;
      return { state: 'ROTATING', s: s0 + VR * T, alt: 6 * Math.pow(clamp01((k - 0.55) / 0.45), 2), pitch: 0.2 * ss(k) };
    }
    T -= FT.rotate;
    if (T < FT.air) return { state: 'AIRBORNE', s: s0 + VR * (FT.rotate + T), alt: 6 + VR * CLIMB * T, pitch: 0.2 };
    return { state: 'EXITED', s: RT.total, alt: 600, pitch: 0.2 };
  }
  const fl = { t0: -1, done: false, state: reduced ? 'LINED_UP' : 'PARKED' };
  const EARLY = { PARKED: 1, TAXIING: 1, HOLDING: 1, TURNING: 1, LINED_UP: 1, ACCELERATING: 1, ROTATING: 1, AIRBORNE: 1 };
  function paveTop(x, z) { const t = classify(x, z); return TOP[t] ?? 0.55; }
  function poseAircraft(f, rise) {
    const a = along(f.s);
    aircraft.position.set(a.x, paveTop(a.x, a.z) + f.alt - rise, a.z);
    aircraft.rotation.set(0, -a.h, f.pitch, 'YZX');
    return a;
  }

  // ---------------------------------------------------------------- camera
  const az0 = mobile ? 0 : 90;
  const AZW = -37 - az0;   // over the fields looking east: the annex, El Dorado, Bogotá, then the Cerros Orientales
  let W = 1, Hpx = 1, F = 3000;
  // [p, target x, target z, azimuth (from az0), elevation, distance (× F, or metres when flagged)]
  const KEYS = [
    [0, 0, -95, 0, 89.4, 1],
    [M(0.30), 0, -95, 0, 89.4, 1],
    [M(0.40), 120, -90, 18, 62, 0.8],
    [M(0.50), 0, -90, 30, 42, 0.62],
    [M(0.565), XH - 200, -120, 40, 34, 0.35],
    [0.654, 0, -90, 25, 38, 0.7],
    [0.705, -2600, 500, AZW + 20, 22, 9000, 1],
    [0.775, -3200, 700, AZW, 18, 12000, 1],
    [0.821, 0, -90, 25, 38, 0.7],
    [M(0.885), 0, -90, 15, 50, 0.85],
    [M(0.935), 0, -95, 0, 80, 0.95],
    [1, 0, -95, 0, 89.4, 1],
  ];
  const keyD = (k) => (k[6] ? k[5] * (mobile ? 1.8 : 1) : k[5] * F);
  function scrollView(p) {
    if (reduced) return { x: 0, y: 0, z: -90, az: az0 + 22, el: 36, d: 0.95 * F };   // the whole finished field, at rest
    let i = 1;
    while (i < KEYS.length - 1 && KEYS[i][0] < p) i++;
    const a = KEYS[i - 1], b = KEYS[i], t = ss(clamp01((p - a[0]) / ((b[0] - a[0]) || 1)));
    return { x: lerp(a[1], b[1], t), y: 0, z: lerp(a[2], b[2], t), az: az0 + lerp(a[3], b[3], t), el: lerp(a[4], b[4], t), d: lerp(keyD(a), keyD(b), t) };
  }
  function flightView(f) {   // an offset from the aircraft, and how to look at it
    const near = mobile ? 1.45 : 1;
    switch (f.state) {
      case 'PARKED': case 'TAXIING': case 'HOLDING': return { ox: 0, oy: 0, az: az0 + 38, el: 26, d: 160 * near };
      case 'TURNING': return { ox: -20, oy: 0, az: az0 + 52, el: 22, d: 170 * near };
      case 'LINED_UP': return { ox: -60, oy: 0, az: az0 + 62, el: 16, d: 180 * near };
      case 'ACCELERATING': return { ox: -120 - 200 * f.k, oy: 0, az: az0 + 40, el: 14, d: (180 + 520 * Math.pow(f.k, 1.5)) * near };
      case 'ROTATING': return { ox: -300, oy: 0, az: az0 + 30, el: 12, d: 700 * near };
      default: return { ox: -500, oy: -0.4 * f.alt, az: az0 + 22, el: 14, d: 1100 * near };
    }
  }
  let fv = null, fw = 0;
  function place(v) {
    const a = v.az * DEG, e = v.el * DEG;
    camera.position.set(v.x + v.d * Math.cos(e) * Math.cos(a), v.y + v.d * Math.sin(e), v.z + v.d * Math.cos(e) * Math.sin(a));
    camera.lookAt(v.x, v.y, v.z);
    const near = Math.max(1, Math.min(v.d * 0.05, 800));   // depth precision follows the distance: no flicker between fields and ground at 12 km
    if (Math.abs(camera.near - near) > 0.5) { camera.near = near; camera.updateProjectionMatrix(); }
    scene.fog.near = v.d * 1.3;
    scene.fog.far = v.d * 5;
  }

  // ---------------------------------------------------------------- the plan, projected from the same geometry
  const NS = 'http://www.w3.org/2000/svg';
  const PL = planElements().map((e) => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('pathLength', '1');
    if (e.cls) el.setAttribute('class', e.cls);
    linesG.appendChild(el);
    return { ...e, draw: W2(e.draw), fade: W2(e.fade), el, shown: false };
  });
  const v3 = new THREE.Vector3();
  const proj = (x, z) => { v3.set(x, 0.8, z).project(camera); return [(v3.x + 1) * 0.5 * W, (1 - v3.y) * 0.5 * Hpx]; };
  const INK_LIGHT = new THREE.Color(0xF5EFE4), INK_DEEP = new THREE.Color(0x16352A), ink = new THREE.Color();
  function drawPlan(p, veilO) {
    ink.copy(INK_DEEP).lerp(INK_LIGHT, veilO);
    plan.style.color = '#' + ink.getHexString();
    const back = kR(p, PH.lines.back), out = kR(p, PH.lines.out), ending = p >= PH.end.context[0];
    for (const e of PL) {
      let a, dash;
      if (reduced) { a = 0.4; dash = 1; }
      else if (!ending) { const d = kR(p, e.draw); a = d > 0 ? 1 - kR(p, e.fade) : 0; dash = d; }
      else { a = back * (e.cls === 'cl' ? 1 : 1 - out); dash = back; }
      if (e.cls === 'faint') a *= 0.5;
      if (a <= 0.001) { if (e.shown) { e.el.style.opacity = 0; e.shown = false; } continue; }
      e.shown = true;
      e.el.setAttribute('d', 'M' + e.pts.map((pt) => proj(pt[0], pt[1]).map((n) => n.toFixed(1)).join(' ')).join('L'));
      e.el.style.opacity = a.toFixed(3);
      e.el.style.strokeDashoffset = (1 - dash).toFixed(4);
    }
  }

  // ---------------------------------------------------------------- the paper airplane, once
  const PLANE_T = 3200;
  const pl = { t0: -1, done: false };
  function drawPaperPlane(p, now) {
    if (reduced || p < PH.lines.out[0]) { planeG.style.opacity = 0; return false; }
    if (p >= PH.plane && pl.t0 < 0 && !pl.done) pl.t0 = now;
    if (pl.t0 < 0 && !pl.done) { planeG.style.opacity = 0; return false; }
    const u = pl.done ? 1 : clamp01((now - pl.t0) / PLANE_T);
    if (u >= 1 && !pl.done) { pl.done = true; pl.t0 = -1; }
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const [x0, y0] = proj(H * 0.92, 0), [x1, y1] = proj(-H * 0.92, 0);
    const x = lerp(x0, x1, e), y = lerp(y0, y1, e) - Math.sin(Math.PI * e) * 10;
    const ang = Math.atan2(y1 - y0, x1 - x0) / DEG;
    planeG.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${mobile ? 1.5 : 1.9})`);
    planeG.style.opacity = Math.min(1, u * 8).toFixed(2);
    return !pl.done;
  }

  // ---------------------------------------------------------------- words, and the names on the map
  const items = [...root.querySelectorAll('[data-at]')].map((el) => ({ el, w: el.dataset.at.split(',').map(Number) }));
  const flightNote = root.querySelector('[data-flight]'), lastLine = root.querySelector('[data-last]');
  const stateEls = [...root.querySelectorAll('[data-s]')];
  const more = root.querySelector('.aero-more');
  const nexts = more ? [...more.querySelectorAll('[data-from]')] : [];
  const geos = [...root.querySelectorAll('[data-geo]')].map((el) => ({ el, at: PLACES[el.dataset.geo] })).filter((g) => g.at);
  function words(p) {
    for (const it of items) it.el.classList.toggle('on', p >= it.w[0] && p < it.w[1]);
    const flying = fl.t0 >= 0 && !fl.done && EARLY[fl.state] && p >= M(0.545) && p < PH.flight[1];
    if (flightNote) flightNote.classList.toggle('on', !!flying);
    for (const el of stateEls) el.classList.toggle('on', el.dataset.s === fl.state);
    if (lastLine) lastLine.classList.toggle('on', pl.done && p >= PH.plane);
    const mapOn = !reduced && p >= PH.city.labels[0] && p < PH.city.labels[1];
    for (const g of geos) {
      let vis = false;
      if (mapOn) {
        v3.set(g.at.x, g.at.y, g.at.z).project(camera);
        vis = v3.z < 1 && Math.abs(v3.x) < 0.92 && v3.y > -0.7 && v3.y < 0.82;
        if (vis) g.el.style.transform = `translate(${((v3.x + 1) * 0.5 * W).toFixed(1)}px, ${((1 - v3.y) * 0.5 * Hpx).toFixed(1)}px)`;
      }
      g.el.classList.toggle('on', vis);
    }
  }

  // ---------------------------------------------------------------- one frame
  function progress() {
    if (reduced) return 0.85;
    const r = track.getBoundingClientRect(), span = r.height - window.innerHeight;
    return span > 0 ? clamp01(-r.top / span) : 0;
  }
  let pPrev = -1, last = 0;
  function update(now, dt) {
    const p = progress();
    let busy = false;

    // the aircraft: one playback, started by arrival, finished on its own clock
    if (!reduced && fl.t0 < 0 && !fl.done) {
      if (p >= PH.flight[0] && p < PH.flight[1]) fl.t0 = now;
      else if (p >= PH.flight[1]) fl.done = true;   // the reader went past: it is simply gone
    }
    let f;
    if (reduced) f = { state: 'LINED_UP', s: RT.lineup, alt: 0, pitch: 0 };
    else if (fl.t0 >= 0 && !fl.done) {
      f = flightAt((now - fl.t0) / 1000);
      if (f.state === 'EXITED') fl.done = true; else busy = true;
    } else f = fl.done ? { state: 'EXITED', s: RT.total, alt: 600, pitch: 0 } : { state: 'PARKED', s: 0, alt: 0, pitch: 0 };
    fl.state = f.state;
    const rise = 6 * Math.pow(1 - kR(p, W2([0.49, 0.52])), 3);
    aircraft.visible = f.state !== 'EXITED' && p > M(0.49) && (reduced || p < PH.end.context[0]);
    const a = poseAircraft(f, rise);

    // the camera: scroll keys, and the aircraft's view blended in while it plays in its stretch
    const sv = scrollView(p);
    const want = fl.t0 >= 0 && !fl.done && p >= PH.flight[0] - 0.02 && p < PH.flight[1] ? 1 : 0;
    if (fw !== want) { fw = want ? Math.min(1, fw + dt / 1.1) : Math.max(0, fw - dt / 1.1); busy = true; }
    let v = sv;
    if (fw > 0) {
      const target = flightView(f);
      if (!fv) fv = { ...target };
      const k = 1 - Math.exp(-dt * 2.2);
      for (const key of ['ox', 'oy', 'az', 'el', 'd']) {
        fv[key] = lerp(fv[key], target[key], k);
        if (Math.abs(fv[key] - target[key]) > 0.05) busy = true;
      }
      const c = Math.cos(a.h), s = Math.sin(a.h);   // the offset is along the aircraft's heading
      const fx = a.x + fv.ox * -c, fz = a.z + fv.ox * -s, t = ss(fw);
      v = { x: lerp(sv.x, fx, t), y: lerp(sv.y, aircraft.position.y + fv.oy, t), z: lerp(sv.z, fz, t), az: lerp(sv.az, fv.az, t), el: lerp(sv.el, fv.el, t), d: lerp(sv.d, fv.d, t) };
    } else fv = null;
    place(v);
    camera.updateMatrixWorld();

    const veilO = clamp01(1 - kR(p, PH.veil.out) + kR(p, PH.veil.back));
    veil.style.opacity = reduced ? 0 : veilO.toFixed(3);
    U.uP.value = p;
    U.uSimp.value = kR(p, PH.end.simp);
    baseMat.color.copy(BASE).lerp(new THREE.Color().setScalar(BASE.r * 0.3 + BASE.g * 0.59 + BASE.b * 0.11), U.uSimp.value);

    drawPlan(p, reduced ? 0 : veilO);
    if (drawPaperPlane(p, now)) busy = true;
    words(p);
    if (more) { more.style.setProperty('--p', (p / PH.lines.out[0]).toFixed(3)); more.classList.toggle('done', reduced || p >= PH.lines.out[0]); }
    { let cur = null; for (const n of nexts) if (+n.dataset.from <= p) cur = n; for (const n of nexts) n.classList.toggle('on', n === cur); }
    if (veilO < 0.999 && (busy || p !== pPrev || fw > 0 || dt === 0)) renderer.render(scene, camera);
    pPrev = p;
    return busy;
  }

  // ---------------------------------------------------------------- the loop runs only while needed
  let running = false, onScreen = true;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const busy = update(now, dt);
    if (busy && onScreen) requestAnimationFrame(frame);
    else running = false;
  }
  function kick() {
    if (running || !onScreen) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function size() {
    W = view.clientWidth || window.innerWidth;
    Hpx = view.clientHeight || window.innerHeight;
    renderer.setSize(W, Hpx);
    camera.aspect = W / Hpx;
    camera.updateProjectionMatrix();
    plan.setAttribute('viewBox', `0 0 ${W} ${Hpx}`);
    const t = Math.tan((camera.fov * DEG) / 2), asp = W / Hpx, alongX = 1250, across = 215;
    F = 1.08 * (az0 === 90 ? Math.max(alongX / (t * asp), across / t) : Math.max(alongX / t, across / (t * asp)));
    pPrev = -1;
    update(performance.now(), 0);
    kick();
  }
  window.addEventListener('resize', size);
  if (!reduced) window.addEventListener('scroll', kick, { passive: true });
  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    if (onScreen) kick();
  }, { rootMargin: '200px 0px' }).observe(track);
  size();

  // review: ?check exposes a synchronous frame (the preview pane throttles rAF) and a way to set the flight clock
  if (q.has('check')) {
    window.__aero = {
      frame: () => { pPrev = -1; update(performance.now(), 1 / 60); return { p: progress(), state: fl.state, fw, plane: pl.done }; },
      fly: (sec) => { fl.done = false; fl.t0 = performance.now() - sec * 1000; fw = 1; fv = null; },
      plane: (ms) => { pl.done = false; pl.t0 = performance.now() - ms; },
    };
    if (q.has('fly')) window.__aero.fly(parseFloat(q.get('fly')) || 0);
    if (q.has('plane')) window.__aero.plane(parseFloat(q.get('plane')) || 0);
  }
  // review: ?p=0.45 scrolls straight to that moment
  if (!reduced && q.has('p')) {
    const r = track.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r.top + clamp01(parseFloat(q.get('p')) || 0) * (r.height - window.innerHeight));
  }
}
