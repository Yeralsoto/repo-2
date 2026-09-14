// The last line. When the land has gone quiet, the survey line is handed from WebGL to one SVG
// path at exactly the same screen position. It leaves the site and becomes, one at a time,
// an elevation, a stem, a wireframe, a workflow, a glyph — and settles under the last sentence.
import { T, WORK } from './config.js';

const N = 280;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function seg(a, b, n = 10) { return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]); }
function poly(...pts) { const out = []; for (let i = 0; i < pts.length - 1; i++) out.push(...seg(pts[i], pts[i + 1]).slice(i ? 1 : 0)); return out; }
function quad(a, c, b, n = 18) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });
}
const chain = (...parts) => parts.flat();

const FIGURES = [
  // architectural elevation, one continuous pen
  chain(
    poly([0.02, 0.88], [0.98, 0.88], [0.84, 0.88], [0.84, 0.46], [0.93, 0.46], [0.5, 0.12], [0.07, 0.46], [0.16, 0.46], [0.16, 0.88]),
    poly([0.16, 0.88], [0.43, 0.88], [0.43, 0.62], [0.57, 0.62], [0.57, 0.88]),
    poly([0.57, 0.88], [0.66, 0.88], [0.66, 0.56], [0.78, 0.56], [0.78, 0.72], [0.66, 0.72]),
    poly([0.66, 0.72], [0.34, 0.72], [0.34, 0.56], [0.22, 0.56], [0.22, 0.72], [0.34, 0.72]),
  ),
  // botanical stem
  chain(
    quad([0.5, 0.98], [0.44, 0.55], [0.53, 0.08]),
    quad([0.53, 0.08], [0.61, 0.02], [0.56, 0.13]),
    quad([0.56, 0.13], [0.52, 0.3], [0.49, 0.42]),
    quad([0.49, 0.42], [0.72, 0.28], [0.87, 0.46]),
    quad([0.87, 0.46], [0.7, 0.53], [0.49, 0.46]),
    quad([0.49, 0.46], [0.47, 0.55], [0.47, 0.62]),
    quad([0.47, 0.62], [0.24, 0.49], [0.12, 0.64]),
    quad([0.12, 0.64], [0.28, 0.73], [0.47, 0.66]),
    quad([0.47, 0.66], [0.47, 0.82], [0.5, 0.98]),
  ),
  // interface wireframe
  poly([0.06, 0.12], [0.94, 0.12], [0.94, 0.88], [0.06, 0.88], [0.06, 0.12], [0.06, 0.24], [0.94, 0.24],
    [0.94, 0.3], [0.54, 0.3], [0.54, 0.8], [0.88, 0.8], [0.88, 0.3],
    [0.46, 0.3], [0.12, 0.3], [0.12, 0.46], [0.46, 0.46], [0.46, 0.3],
    [0.46, 0.56], [0.12, 0.56], [0.12, 0.62], [0.38, 0.62], [0.38, 0.68], [0.12, 0.68], [0.12, 0.8], [0.3, 0.8], [0.3, 0.74], [0.12, 0.74]),
  // workflow diagram
  poly([0.26, 0.5], [0.26, 0.42], [0.04, 0.42], [0.04, 0.58], [0.26, 0.58], [0.26, 0.5],
    [0.39, 0.5], [0.36, 0.47], [0.39, 0.5], [0.36, 0.53], [0.39, 0.5],
    [0.39, 0.42], [0.61, 0.42], [0.61, 0.5], [0.74, 0.5], [0.71, 0.47], [0.74, 0.5], [0.71, 0.53], [0.74, 0.5],
    [0.74, 0.42], [0.96, 0.42], [0.96, 0.58], [0.74, 0.58], [0.74, 0.5], [0.61, 0.5], [0.61, 0.58], [0.39, 0.58], [0.39, 0.5],
    [0.5, 0.58], [0.5, 0.76], [0.15, 0.76], [0.15, 0.6], [0.12, 0.64], [0.15, 0.6], [0.18, 0.64]),
  // a fragment of language: ñ
  chain(
    poly([0.3, 0.92], [0.3, 0.46]),
    quad([0.3, 0.46], [0.33, 0.38], [0.5, 0.39]),
    quad([0.5, 0.39], [0.68, 0.4], [0.68, 0.58]),
    poly([0.68, 0.58], [0.68, 0.92]),
    quad([0.68, 0.92], [0.92, 0.6], [0.73, 0.27]),
    quad([0.73, 0.27], [0.62, 0.17], [0.5, 0.25]),
    quad([0.5, 0.25], [0.38, 0.33], [0.27, 0.22]),
  ),
];

function resample(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1, out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    while (j < cum.length - 1 && cum[j] < d) j++;
    const t = (d - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t]);
  }
  return out;
}

export function createOverlay(svg, path, finalText, stage, parcel3D, road3D) {
  const figures = FIGURES.map((f) => resample(f, N));
  // The botanical figure is her own mark (brand kit, primary), sampled into one continuous pen line:
  // stem up, both petals, their veins, then the two leaves.
  {
    const MARK = [
      'M60 192 C59 158 61 124 60 90',
      'M60 90 C40 76 26 52 26 22 C45 35 58 62 60 90 Z',
      'M60 90 C80 76 94 52 94 22 C75 35 62 62 60 90 Z',
      'M84 40 C80 66 70 84 60 90',
      'M36 40 C40 66 50 84 60 90',
      'M60 124 C74 114 88 112 97 104 C90 122 75 131 60 124 Z',
      'M60 150 C46 140 32 138 23 130 C30 148 45 157 60 150 Z',
    ];
    const ns = 'http://www.w3.org/2000/svg';
    const pts = [];
    for (const d of MARK) {
      const el = document.createElementNS(ns, 'path');
      el.setAttribute('d', d);
      svg.appendChild(el);
      const total = el.getTotalLength(), n = Math.max(12, Math.round(total / 2));
      for (let i = 0; i <= n; i++) {
        const q = el.getPointAtLength((total * i) / n);
        pts.push([(q.x - 60) / 200 + 0.5, q.y / 200]);
      }
      el.remove();
    }
    if (pts.length > 2) figures[1] = resample(pts, N);
  }
  const signPaths = [...stage.querySelectorAll('.ftl-sign-mark path')];
  let W = 1, H = 1;
  const tmp = parcel3D.map((v) => v.clone());
  const tmpRoad = road3D.map((v) => v.clone());
  const toScreen = (src, dst) => dst.map((v, i) => {
    v.copy(src[i]).project(dst === tmp ? camRef.c : camRef.c);
    return [(v.x + 1) * 0.5 * W, (1 - v.y) * 0.5 * H];
  });
  const camRef = { c: null };

  function resize(w, h) { W = w; H = h; svg.setAttribute('viewBox', `0 0 ${w} ${h}`); }
  function frameBox() {
    const narrow = W < 720;
    const s = Math.min(W, H) * (narrow ? 0.6 : 0.4);
    return { s, cx: narrow ? W * 0.5 : W * 0.64, cy: narrow ? H * 0.36 : H * 0.45 };
  }
  const placeFig = (fig) => { const { s, cx, cy } = frameBox(); return fig.map(([x, y]) => [cx + (x - 0.5) * s, cy + (y - 0.5) * s]); };

  function update(p, camera) {
    const f0 = T.figures[0];
    const vis = smooth(f0 - 0.012, f0, p);
    svg.style.opacity = vis;
    if (vis <= 0) return;
    // the dominant road line and the parcel, projected exactly where their 3D lines are drawn
    camRef.c = camera;
    // The Work goes straight from the one line to the words: no figures in between
    const shapes = [resample(toScreen(road3D, tmpRoad), N)];
    if (!WORK) {
      shapes.push(resample(toScreen(parcel3D, tmp), N));
      for (const fig of figures) shapes.push(placeFig(fig));
    }
    const r = finalText.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const y = r.bottom - sr.top + 14;
    shapes.push(resample([[r.left - sr.left, y], [r.right - sr.left, y]], N));

    // morph windows on u (0..1 across the last stretch of scroll); each figure holds before the next
    const u = Math.max(0, (p - f0) / (1 - f0));
    // road → parcel → elevation → stem → wireframe → workflow → glyph → the line under the words
    const marks = WORK ? [0.08, 0.42] : [0.06, 0.17, 0.21, 0.32, 0.36, 0.47, 0.51, 0.61, 0.65, 0.75, 0.79, 0.87, 0.9, 0.98];
    let a = 0, b = 0, k = 0;
    for (let i = 0; i < shapes.length - 1; i++) {
      const m0 = marks[i * 2], m1 = marks[i * 2 + 1];
      if (u < m0) { a = i; b = i; k = 0; break; }
      if (u <= m1) { a = i; b = i + 1; k = smooth(m0, m1, u); break; }
      a = i + 1; b = i + 1; k = 0;
    }
    const A = shapes[a], B = shapes[b];
    let d = '';
    for (let i = 0; i < N; i++) {
      const x = A[i][0] + (B[i][0] - A[i][0]) * k, yy = A[i][1] + (B[i][1] - A[i][1]) * k;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1);
    }
    path.setAttribute('d', d);
    // as the line settles under the words, her mark draws itself above them — the flower signs
    signPaths.forEach((el, i) => {
      const m0 = WORK ? 0.46 + i * 0.02 : 0.88 + i * 0.012, m1 = WORK ? 0.52 + i * 0.02 : 0.91 + i * 0.012;
      el.style.strokeDashoffset = (1 - smooth(m0, m1, u)).toFixed(3);
    });
  }
  return { resize, update };
}
