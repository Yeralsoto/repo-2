// One continuous camera, described as keyframes on the scroll and interpolated with monotone
// cubics (no overshoot, so the camera never dips through the ground between two keys).
// Opening aerial ~38° → survey rising → near-plan → down to one homesite → wide aerial → back to
// a framing that echoes the opening, so the reader recognises the same land.
import { SITE_CENTER } from './world.js';
import { WORK, onStory } from './config.js';

const D2R = Math.PI / 180;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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
  const V = lot.frame.V, U = lot.frame.U;
  // looking at the hero home from its road side, swung toward the south so it is lit from the front
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
    [0.732, hx, hz, 2.5, heroAz(32), 36, 82],  // and one home is built in the open, right there
    [0.746, hx, hz, 2.5, heroAz(44), 34, 68],
    [0.756, hx, hz, 2.5, heroAz(56), 32, 64],
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

  function update(camera, p, aspect) {
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
    camera.updateProjectionMatrix();
    return { x: tx, z: tz, dist, radius: Math.min(340, Math.max(55, dist * 0.62)) };
  }
  return { update };
}
