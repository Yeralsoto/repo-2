// Geometry kit: painted boxes, merging, drawn ribbons, timing helpers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

export function paint(geo, color) {
  _c.set(color);
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

// A box sitting on y (its base), centred on x/z, optionally turned about Y.
export function box(w, h, d, x = 0, y = 0, z = 0, color = 0xffffff, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return paint(g, color);
}

export function merge(geos) {
  const clean = geos.filter(Boolean).map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    if (!n.attributes.color) paint(n, 0xffffff);
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  });
  return clean.length ? mergeGeometries(clean) : null;
}

// Place a merged geometry in world space with rotation about Y.
export function placed(geo, x, y, z, ry) {
  const g = geo.clone();
  g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

// A flat drawn line on the ground. aS runs 0 → 1 along it so the shader can draw it progressively.
// opts: closed, dash [on, off] in metres, y (number or fn(p) → y)
export function ribbon(pts, width, y = 0, opts = {}) {
  const P = opts.closed ? [...pts, pts[0]] : pts.slice();
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const pieces = [];
  if (opts.dash) {
    const [on, off] = opts.dash;
    for (let d = 0; d < total; d += on + off) pieces.push(sub(P, cum, d, Math.min(total, d + on)));
  } else pieces.push({ pts: P, s: cum });
  const pos = [], nor = [], uv = [], aS = [], idx = [];
  const hw = width / 2;
  for (const piece of pieces) {
    const Q = piece.pts, S = piece.s, base = pos.length / 3;
    for (let i = 0; i < Q.length; i++) {
      const prev = Q[i - 1] || (opts.closed && !opts.dash ? Q[Q.length - 2] : null);
      const next = Q[i + 1] || (opts.closed && !opts.dash ? Q[1] : null);
      const n1 = prev ? perp(prev, Q[i]) : null, n2 = next ? perp(Q[i], next) : null;
      let n = n1 && n2 ? normalize([n1[0] + n2[0], n1[1] + n2[1]]) : (n1 || n2);
      const miter = n1 && n2 ? Math.min(2.5, 1 / Math.max(0.4, n[0] * n2[0] + n[1] * n2[1])) : 1;
      const yy = typeof y === 'function' ? y(Q[i]) : y;
      pos.push(Q[i][0] + n[0] * hw * miter, yy, Q[i][1] + n[1] * hw * miter, Q[i][0] - n[0] * hw * miter, yy, Q[i][1] - n[1] * hw * miter);
      nor.push(0, 1, 0, 0, 1, 0);
      uv.push(S[i] / total, 0, S[i] / total, 1);
      aS.push(S[i] / total, S[i] / total);
      if (i < Q.length - 1) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setIndex(idx);
  return g;
}
function perp(a, b) { const t = normalize([b[0] - a[0], b[1] - a[1]]); return [-t[1], t[0]]; }
function normalize(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
function sub(P, cum, d0, d1) {
  const at = (d) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    return { p: [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t], i };
  };
  const A = at(d0), B = at(d1);
  const pts = [A.p], s = [d0];
  for (let i = A.i; i < B.i; i++) { pts.push(P[i]); s.push(cum[i]); }
  pts.push(B.p); s.push(d1);
  return { pts, s };
}

// Resample a polyline by arc length (returns points and the distance of each).
export function resample(pts, step) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1], out = [];
  let j = 1;
  for (let d = 0; d <= total + 1e-6; d += step) {
    while (j < cum.length - 1 && cum[j] < d) j++;
    const t = (d - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    const a = pts[j - 1], b = pts[j];
    out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d, ang: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) });
  }
  return { out, total };
}

// Timing helpers.
export const lerpT = (r, f) => r[0] + (r[1] - r[0]) * f;
// Stagger inside a range: item f (0..1) starts at f·(1−dur) and lasts dur of the range.
export function stagger(r, f, dur = 0.3) {
  const a = lerpT(r, f * (1 - dur));
  return [a, a + (r[1] - r[0]) * dur];
}
export const NEVER = [2, 2.01];
export const IN_ALWAYS = [-1, -0.99];

export function instanced(geo, material, matrices, extra = {}) {
  const m = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
  m.instanceMatrix.needsUpdate = true;
  if (extra.colors) { extra.colors.forEach((c, i) => m.setColorAt(i, c)); m.instanceColor.needsUpdate = true; }
  m.frustumCulled = false;
  return m;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
export function trs(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  _q.setFromAxisAngle(_y, ry);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
