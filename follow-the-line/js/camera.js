// One continuous camera, described as keyframes on the scroll and interpolated with monotone
// cubics (no overshoot, so the camera never dips through the ground between two keys).
// Opening aerial ~38° → survey rising → near-plan → down to one homesite → wide aerial → back to
// a framing that echoes the opening, so the reader recognises the same land.
import * as THREE from 'three';
import { SITE_CENTER, GRADE } from './world.js';
import { WORK, onStory, T } from './config.js';
import { PUBLIC, BULB_ROW } from './layout.js';
import { COMP_AT } from './story.js';
import { readyLot } from './build.js';

const D2R = Math.PI / 180;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const win4 = (w, p) => smooth(w[0], w[1], p) * (1 - smooth(w[2], w[3], p));
const lerp = (a, b, t) => a + (b - a) * t;

// Phone portrait on The Work: the site's bar covers the top ~64px and the page's words the lower ~40%, so
// the land (and whatever is drawn on it) is fitted into the band between — 72px from the top to 58% of the
// height, 12px from the sides. The picture is only scaled and moved in two dimensions (zoom and a view
// offset), so the perspective, and every word anchored to the land, stays exactly as authored.
const v3 = new THREE.Vector3(), vv = new THREE.Vector3();
function fitOf(camera, pts, W, H, top, box) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, depth = Infinity;
  for (const q of pts) {
    // how far in front of the camera the nearest point is: the caller fades a set out continuously before
    // any of its points could reach the camera, so a set never drops out of the blend all at once
    vv.set(q[0], GRADE, q[1]).applyMatrix4(camera.matrixWorldInverse);
    depth = Math.min(depth, -vv.z);
    if (-vv.z < camera.near * 2) return null;
    v3.set(q[0], GRADE, q[1]).project(camera);
    const x = (v3.x + 1) * 0.5 * W, y = (1 - v3.y) * 0.5 * H;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  // (box: the room on a wide screen, as [left, top, right, bottom]; phones keep the band below)
  const m = 8, [L, Tp, R, B] = box || [12 + m, top + m, W - 12 - m, H * 0.58 - m];
  const s = Math.min(1, (R - L) / Math.max(1, x1 - x0), (B - Tp) / Math.max(1, y1 - y0));
  return { s, depth, box: [x0, y0, x1, y1], band: [L, Tp, R, B] };
}
// the smallest move that brings a scaled box inside the band
function shiftOf(f, s, W, H) {
  const [x0, y0, x1, y1] = f.box, [L, Tp, R, B] = f.band;
  const X0 = W / 2 + (x0 - W / 2) * s, X1 = W / 2 + (x1 - W / 2) * s, Y0 = H / 2 + (y0 - H / 2) * s, Y1 = H / 2 + (y1 - H / 2) * s;
  return [Math.max(0, L - X0) + Math.min(0, R - X1), Math.max(0, Tp - Y0) + Math.min(0, B - Y1)];
}

function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export function makeCamera(L, houses) {
  const lot = L.lots[L.hero];
  const [hx, hz] = houses.hero.pos;
  // The Work: the close-up is a builder-ready lot, aimed between its pad and the finished road in front of it
  const RL = readyLot(L, lot), rc = RL.pad ? RL.pad.c : RL.mid;
  const rx = (rc[0] + RL.road[0]) / 2, rz = (rc[1] + RL.road[1]) / 2;
  const V = lot.frame.V, U = lot.frame.U;
  // looking at the featured lot from its road side, swung toward the south so it is lit from the front
  // (the standalone film builds its hero home there; The Work shows it as a builder-ready lot)
  const heroAz = (deg) => {
    const dirs = [deg, -deg].map((s) => {
      const a = s * D2R;
      return [-V[0] * Math.cos(a) + U[0] * Math.sin(a), -V[1] * Math.cos(a) + U[1] * Math.sin(a)];
    });
    const d = dirs[0][1] >= dirs[1][1] ? dirs[0] : dirs[1];
    return Math.atan2(d[0], d[1]) / D2R;
  };
  const st = L.spine.at(L.S * 0.52).p;
  const SC = SITE_CENTER;
  // The Work: the market first, then one geography, one parcel, the thinking over it, execution,
  // the market again — authored on the story scale and squeezed like config.js — and then, with no
  // words, the home, the street, and the region growing into new subdivisions.
  const storyKeys = [
    [0.000, 230, 110, 0, -12, 50, 2000],       // the market, wider than any parcel
    [0.030, 230, 110, 0, -12, 50, 1950],
    [0.060, 150, 70, 0, -13, 52, 1500],        // narrowing toward one geography
    [0.085, 40, 10, 0, -15, 52, 900],
    [0.100, 8, -30, 0, -16, 50, 640],          // one piece of land
    [0.112, 8, -30, 0, -12, 58, 600],
    [0.124, 0, -30, 0, 0, 72, 640],            // near-plan for feasibility, rules, layouts, scenarios
    [0.296, 0, -30, 0, 0, 72, 640],
    [0.312, 80, 40, 0, -8, 58, 1400],          // comps across the market
    [0.334, 80, 40, 0, -8, 58, 1400],
    // (the pass and the structure cycle were removed with their stretch — config.js CUT)
    [0.462, 0, -30, 0, -6, 64, 720],
    [0.476, 0, -30, 0, -4, 68, 620],           // diligence
    [0.500, 0, -30, 0, -2, 70, 600],           // the boundary walked
    [0.530, 0, -30, 0, 0, 72, 640],            // survey and civil
    [0.570, 0, -30, 0, 0, 72, 640],
    [0.584, 4, -36, 0, -4, 64, 560],           // the centreline staked, lower and closer
    [0.600, 8, -46, 0, -4, 60, 540],
    [0.640, 8, -46, 0, -4, 58, 560],
    [0.660, 2, -20, 0, 5, 62, 480],            // execution
    [0.712, 8, -48, 0, 2, 60, 480],
    [0.722, 8, -44, 0, -10, 50, 520],          // finished inventory, the plat recorded
    [0.732, rx, rz, 0, heroAz(22), 50, 150],   // down to one builder-ready lot: pad, stubs, pins, apron, the finished road
    [0.746, rx, rz, 0, heroAz(30), 47, 132],
    [0.756, rx, rz, 0, heroAz(36), 45, 124],
    [0.766, 8, -40, 0, -8, 62, 580],           // to market, the builders follow
    [0.790, 8, -40, 0, -8, 62, 520],
    [0.822, -120, 90, 0, -12, 52, 1300],       // the next deal
    [0.850, 230, 110, 0, -12, 50, 1950],
    [0.918, 230, 110, 0, -12, 50, 1950],
  ].map(([p, ...rest]) => [onStory(p), ...rest]);
  const workKeys = [
    ...storyKeys,
    [0.730, 8, -46, 0, 6, 52, 520],            // the street, finished and lived in
    [0.744, st[0], st[1], 1.5, -38, 20, 150],  // life on the street
    [0.758, -6, 40, 0, -18, 42, 380],          // a car reaches the public road
    [0.772, 10, 0, 0, -14, 55, 700],
    [0.788, -360, 60, 0, -12, 52, 1000],       // the next site becomes a subdivision
    [0.814, 200, 130, 0, -9, 56, 2200],        // the region: subdivisions on both sides, new lines farther out
    [0.866, 200, 130, 0, -9, 56, 2200],        // every part of the work finds its place
    [0.892, 120, 20, 0, -14, 52, 1450],        // the network; one line leads back
    [0.910, SC[0], SC[1], 0, -20, 38, 600],    // the first place, framed as at the start
    [1.000, SC[0], SC[1], 0, -20, 38, 600],
  ];
  //            p      tx      tz     ty    az            el   dist
  const keys = WORK ? workKeys : [
    [0.000, SC[0], SC[1], 0, -20, 38, 600],
    [0.090, SC[0], SC[1], 0, -13, 41, 575],
    [0.180, 8, -40, 0, -5, 57, 545],
    [0.265, 8, -40, 0, 0, 70, 520],
    [0.345, 2, -20, 0, 5, 64, 470],
    [0.430, 8, -48, 0, 2, 61, 470],
    [0.505, 8, -44, 0, -6, 56, 440],
    [0.548, hx, hz, 2.5, heroAz(32), 36, 80],
    [0.600, hx, hz, 2.5, heroAz(44), 34, 68],
    [0.655, hx, hz, 2.5, heroAz(56), 32, 64],
    [0.705, 8, -46, 0, 6, 52, 520],
    [0.748, 2, -30, 0, -8, 44, 380],
    [0.796, st[0], st[1], 1.5, -38, 20, 150],   // life on the street
    [0.822, -6, 40, 0, -18, 42, 380],           // toward the entrance: a car reaches the public road
    [0.845, 10, 0, 0, -14, 55, 700],            // the whole place: home, driveway, road, entrance, public road
    [0.878, 170, 110, 0, -12, 52, 1300],        // pulling back: the region begins to grow
    [0.912, 210, 60, 0, -10, 56, 1950],         // land, line, infrastructure, home, community — at once
    [0.926, 210, 60, 0, -10, 56, 1950],         // freeze
    [0.946, 120, 20, 0, -14, 52, 1450],         // the network; one line leads back
    [0.958, SC[0], SC[1], 0, -20, 38, 600],     // the first place, framed as at the start
    [1.000, SC[0], SC[1], 0, -20, 38, 600],
  ];
  // keep azimuth continuous
  for (let i = 1; i < keys.length; i++) {
    while (keys[i][4] - keys[i - 1][4] > 180) keys[i][4] -= 360;
    while (keys[i][4] - keys[i - 1][4] < -180) keys[i][4] += 360;
  }
  const xs = keys.map((k) => k[0]);
  const ch = [1, 2, 3, 4, 5].map((c) => monotone(xs, keys.map((k) => k[c])));
  const logD = monotone(xs, keys.map((k) => Math.log(k[6])));

  // what must stay whole on a phone: the parcel with the frontage and neighbours in front of it, or, while
  // the comps are read, every comp and the subject
  const LAND = [...L.PARCEL, [-110, PUBLIC.z(-110) + 30], [60, PUBLIC.z(60) + 30]];
  const COMPS = [...COMP_AT, SITE_CENTER];
  const S = WORK ? T.story : null;
  // the builder-ready lot close-up: then the lot and the finished road in front of it are what stays whole
  const HERO = [onStory(0.722), onStory(0.732), onStory(0.756), onStory(0.766)];
  const LOTFIT = [...L.lots[L.hero].poly, RL.road, [2 * RL.road[0] - RL.mid[0], 2 * RL.road[1] - RL.mid[1]]];
  // while a milestone row or the scenario words ride the top of the band, the land keeps that strip clear
  const ROOM = S ? [S.rulesNotes[0], S.rulesNotes[0] + 0.006, S.planOut[0], S.planOut[1]] : null;

  // Wide screens inside /work/ (her ask, 2026-09-16): the whole subdivision — parcel, every lot, the road and the
  // cul-de-sac — stays in the room the page leaves: under its bar, right of its words, above its keep-scrolling
  // tab. The room does not follow the words from beat to beat, so the land never jumps when a line changes.
  const WHOLE = [
    ...LAND, ...L.lots.flatMap((l) => l.poly),
    ...Array.from({ length: 32 }, (_, i) => [L.C[0] + Math.cos((i / 32) * 6.2832) * BULB_ROW, L.C[1] + Math.sin((i / 32) * 6.2832) * BULB_ROW]),
    ...Array.from({ length: 40 }, (_, i) => L.spine.at((L.S * i) / 39).p),
  ];
  function wideFit(camera, p, aspect, H, dist, host) {
    camera.updateMatrixWorld();
    const W = aspect * H, m = 16;
    const box = [Math.max(12, host.wordsRight) + m, host.top + m, W - 12 - m, Math.min(H - 12, host.moreTop) - m];
    // while the page's centred closing line is up ("It is easier to show you."), the room ends above it
    if (host.end) {
      const e = host.end, ke = win4([e.at - 0.008, e.at, e.out, e.out + 0.008], p);
      box[3] = lerp(box[3], Math.min(box[3], e.t - m), ke);
    }
    if (box[2] - box[0] < 80 || box[3] - box[1] < 80) return;
    // the whole subdivision until the camera is down on the one ready lot; that lot in its close-up
    const kl = (1 - smooth(150, 230, dist)) * win4([HERO[0] - 0.01, HERO[0], HERO[3], HERO[3] + 0.01], p);
    const kland = (1 - kl) * smooth(150, 260, dist);
    const sets = [[WHOLE, kland], [LOTFIT, kl]]
      .filter((e) => e[1] > 0.001)
      .map(([pts, k]) => { const f = fitOf(camera, pts, W, H, 0, box); return f ? { f, k: k * smooth(dist * 0.25, dist * 0.5, f.depth) } : null; })
      .filter((e) => e && e.k > 0.0005);
    if (!sets.length) return;
    const s = 1 + sets.reduce((acc, e) => acc + (e.f.s - 1) * e.k, 0);
    let dx = 0, dy = 0;
    for (const e of sets) { const d = shiftOf(e.f, s, W, H); dx += d[0] * e.k; dy += d[1] * e.k; }
    camera.zoom = s;
    camera.setViewOffset(W, H, -dx, -dy, W, H);
    camera.updateProjectionMatrix();
  }

  function portraitFit(camera, p, aspect, H, dist, host) {
    camera.zoom = 1;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (!WORK || !H) return;
    if (aspect >= 1) { if (host) wideFit(camera, p, aspect, H, dist, host); return; }
    const w = 1 - smooth(0.722, 0.73, p);
    if (w < 0.001) return;
    camera.updateMatrixWorld();
    const W = aspect * H;
    const top = 72 + 72 * Math.max(win4(ROOM, p), win4(S.civil, p));
    // the lot takes over from the land by how close the camera is, so a parcel seen from right above the lot
    // (huge on the screen, half behind the camera) never pulls on the picture
    const kc = win4([S.comps[0] - 0.006, S.comps[0], S.comps[3], S.comps[3] + 0.006], p);
    // the land is fitted at plan distances, the lot only once the camera is down on it; during the short swoop
    // between the two the camera is left exactly as authored, so nothing fights the descent
    const kl = (1 - smooth(180, 300, dist)) * win4([HERO[0] - 0.01, HERO[0], HERO[3], HERO[3] + 0.01], p);
    const kland = smooth(420, 640, dist);
    // what must stay whole, blended: the land, the comps while they are read, the ready lot in its close-up
    // weights add up to at most 1 and are never renormalised: whatever weight is missing simply means "no
    // correction", so every weight changing smoothly keeps the picture moving smoothly
    const sets = [[LAND, top, (1 - kc) * kland], [COMPS, 72, kc], [LOTFIT, 72, kl]]
      .filter((e) => e[2] > 0.001)
      .map(([pts, t0, k]) => { const f = fitOf(camera, pts, W, H, t0); return f ? { f, k: k * smooth(dist * 0.25, dist * 0.5, f.depth) } : null; })
      .filter((e) => e && e.k > 0.0005);
    if (!sets.length) return;
    const s = lerp(1, 1 + sets.reduce((m, e) => m + (e.f.s - 1) * e.k, 0), w);
    let dx = 0, dy = 0;
    for (const e of sets) { const d = shiftOf(e.f, s, W, H); dx += d[0] * e.k; dy += d[1] * e.k; }
    dx *= w; dy *= w;
    camera.zoom = s;
    camera.setViewOffset(W, H, -dx, -dy, W, H);
    camera.updateProjectionMatrix();
  }

  function update(camera, p, aspect, H, host) {
    const tx = ch[0](p), tz = ch[1](p), ty = ch[2](p), az = ch[3](p) * D2R, el = ch[4](p) * D2R;
    let dist = Math.exp(logD(p));
    // narrow screens: wide shots step back so the whole community stays in frame; close-ups stay close
    let lx = tx, lz = tz;
    if (aspect < 1.25) {
      const wide = smooth(100, 320, dist);
      // the regional shots step back further still, so the subdivisions on either side stay in frame
      const region = smooth(1300, 1900, dist);
      dist *= (1 + (1.25 / aspect - 1) * 0.72 * wide) * (1 + (1.25 / aspect - 1) * 0.9 * region);
      // portrait: aim a little nearer the camera so the land rides above the copy at the bottom
      const back = dist * 0.16 * smooth(1.1, 0.5, aspect) * wide;
      lx += Math.sin(az) * back;
      lz += Math.cos(az) * back;
    }
    camera.position.set(lx + dist * Math.cos(el) * Math.sin(az), ty + dist * Math.sin(el), lz + dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(lx, ty, lz);
    camera.near = Math.max(0.5, dist * 0.02);
    camera.far = 12000;
    portraitFit(camera, p, aspect, H, dist, host);
    return { x: tx, z: tz, dist, radius: Math.min(340, Math.max(55, dist * 0.62)) };
  }
  return { update };
}
