// THE WORK — the land story as judgment unfolding. The film (3D) is the physical place; these are
// the layers of thinking drawn over it, each only while its beat is on screen:
// market signals · one geography · the opportunity · usable land · the rules · layouts · scenarios ·
// comps · a pass · structure · a partner · the thesis across the table · diligence · title ·
// survey and review · utilities · timelines · a schedule meeting reality · lots going to market ·
// reality feeding the next underwriting. Everything is a function of p; nothing loops.
import * as THREE from 'three';
import { T, SITES } from './config.js';
import { buildLayout, pointInPoly, rowPolygons, PUBLIC, BULB_ROW, rng } from './layout.js';
import { GRADE, SITE_CENTER, FARMS } from './world.js';
import { offsetPoly, clipHalf } from './build.js';

const NS = 'http://www.w3.org/2000/svg';
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const win4 = (w, p) => smooth(w[0], w[1], p) * (1 - smooth(w[2], w[3], p));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPts = (A, B, t) => A.map((q, i) => [lerp(q[0], B[i][0], t), lerp(q[1], B[i][1], t)]);
const f1 = (n) => n.toFixed(1);

const WORDS = {
  en: {
    opp: ['frontage', 'access', 'neighbors', 'terrain', 'water'],
    usable: ['setback', 'wetland', 'drainage', 'frontage', 'road'],
    rules: ['frontage', 'road standard', 'setback', 'plat'],
    route: ['minor subdivision', 'major subdivision', 'plat', 'approval path'],
    scen: ['aggressive', 'conservative', 'balanced'],
    stress: ['longer road', 'utility extension', 'less usable land', 'softer lot value'],
    comps: ['better frontage', 'different municipality', 'water', 'different status', 'different location', 'different buyers'],
    pass: ['pass'],
    struct: ['seller', 'land', 'capital', 'partner', 'future lots'],
    structWords: ['owner financing', 'joint venture', 'partial releases', 'structured terms'],
    jv: ['land', 'capital', 'execution', 'return'],
    closer: ['maximum basis', 'critical assumptions', 'structure', 'risk', 'why it works'],
    dd: ['survey', 'title', 'access', 'utilities', 'soil', 'environmental', 'drainage', 'approvals'],
    title: ['utility easement', 'access easement', 'restriction', 'exception'],
    status: ['affects the plan', 'clear', 'needs cure', 'clear'],
    review: ['concept', 'submission', 'comment', 'revision', 'approval'],
    util: ['water', 'new route'],
    lanes: ['survey', 'civil', 'county', 'utility', 'contractor', 'title', 'acquisitions', 'dispositions', 'partner'],
    sched: ['utility delay'],
    fb: ['sales pace', 'site cost', 'lot price', 'schedule', 'demand'],
    fbRows: ['assumed', 'actual'],
    stage: ['stage 1 · at closing', 'stage 2 · month 12', 'stage 3 · month 24'],
    path: ['opportunity', 'feasible', 'concept plan', 'underwritten', 'under contract', 'diligence cleared', 'plat approved', 'permits issued', 'final plat recorded', 'lots sold'],
  },
  es: {
    opp: ['frente', 'acceso', 'vecinos', 'terreno', 'agua'],
    usable: ['retiro', 'humedal', 'drenaje', 'frente', 'vía'],
    rules: ['frente', 'norma vial', 'retiro', 'plano'],
    route: ['subdivisión menor', 'subdivisión mayor', 'plano', 'ruta de aprobación'],
    scen: ['agresivo', 'conservador', 'equilibrado'],
    stress: ['vía más larga', 'extensión de servicios', 'menos área útil', 'lotes que valen menos'],
    comps: ['mejor frente', 'otro municipio', 'agua', 'otro estado', 'otra ubicación', 'otros compradores'],
    pass: ['se descarta'],
    struct: ['vendedor', 'tierra', 'capital', 'socio', 'lotes futuros'],
    structWords: ['financiación del dueño', 'joint venture', 'liberaciones parciales', 'términos estructurados'],
    jv: ['tierra', 'capital', 'ejecución', 'retorno'],
    closer: ['base máxima', 'supuestos críticos', 'estructura', 'riesgo', 'por qué funciona'],
    dd: ['topografía', 'título', 'acceso', 'servicios', 'suelo', 'ambiental', 'drenaje', 'aprobaciones'],
    title: ['servidumbre de servicios', 'servidumbre de acceso', 'restricción', 'excepción'],
    status: ['afecta el plano', 'limpio', 'por subsanar', 'limpio'],
    review: ['concepto', 'radicación', 'comentario', 'revisión', 'aprobación'],
    util: ['agua', 'nueva ruta'],
    lanes: ['topografía', 'civil', 'condado', 'servicios', 'contratista', 'título', 'adquisiciones', 'ventas', 'socio'],
    sched: ['retraso de servicios'],
    fb: ['ritmo de ventas', 'costo de obra', 'precio del lote', 'cronograma', 'demanda'],
    fbRows: ['supuesto', 'real'],
    stage: ['etapa 1 · al cierre', 'etapa 2 · mes 12', 'etapa 3 · mes 24'],
    path: ['oportunidad', 'viable', 'plano conceptual', 'analizado', 'bajo contrato', 'diligencia cerrada', 'plano aprobado', 'permisos emitidos', 'plano final registrado', 'lotes vendidos'],
  },
};

// Two sketches cut by the same planner as the real plan: a road that ignores the land, and the
// obvious straight road. Same lots, same order, so the obvious one can rearrange into the real one.
const WRONG = (z) => [[-20, z + 20], [-20, z], [-40, 95], [-85, 20], [-125, -70], [-146, -118], [-155, -150]];
const STRAIGHT = (z) => [[-20, z + 20], [-20, z], [-20, 70], [-20, -20], [-20, -100], [-20, -148], [-20, -180]];

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function resample(pts, n, closed) {
  const P = closed ? [...pts, pts[0]] : pts;
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = cum[cum.length - 1] || 1, m = closed ? n : n - 1, out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (total * k) / m;
    while (j < cum.length - 1 && cum[j] < d) j++;
    const t = (d - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1);
    out.push([P[j - 1][0] + (P[j][0] - P[j - 1][0]) * t, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * t]);
  }
  return out;
}
const centroid = (poly) => { let x = 0, z = 0; for (const q of poly) { x += q[0]; z += q[1]; } return [x / poly.length, z / poly.length]; };
const edges = (c, off) => c.map((q, i) => {
  const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
  const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
  return [q[0] + (-tz / l) * off, q[1] + (tx / l) * off];
});
const circle = (c, r, n = 48) => Array.from({ length: n }, (_, i) => [c[0] + Math.cos((i / n) * 6.2832) * r, c[1] + Math.sin((i / n) * 6.2832) * r]);
// the parts of a straight segment that lie inside a polygon
function insideRuns(a, b, poly, n = 60) {
  const runs = [];
  let run = [];
  for (let i = 0; i <= n; i++) {
    const q = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n];
    if (pointInPoly(q, poly)) run.push(q);
    else if (run.length) { if (run.length > 1) runs.push(run); run = []; }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

export function createStory(stage, L) {
  const S = T.story;
  const svg = el('svg', { class: 'ftl-story', 'aria-hidden': 'true', focusable: 'false' });
  stage.appendChild(svg);
  const defs = el('defs', {}, svg);
  const field = el('radialGradient', { id: 'ftl-field' }, defs);
  el('stop', { offset: '0%', 'stop-color': '#ECE5D7', 'stop-opacity': '.9' }, field);
  el('stop', { offset: '60%', 'stop-color': '#ECE5D7', 'stop-opacity': '.62' }, field);
  el('stop', { offset: '100%', 'stop-color': '#ECE5D7', 'stop-opacity': '0' }, field);
  // her ask: every word on the land sits on a small Papel chip, so it reads over trees, lots and shade
  const chip = el('filter', { id: 'ftl-chip', x: '-0.1', y: '-0.34', width: '1.2', height: '1.68' }, defs);
  el('feFlood', { 'flood-color': '#F5EFE4', 'flood-opacity': '0.94', result: 'bg' }, chip);
  const merge = el('feMerge', {}, chip);
  el('feMergeNode', { in: 'bg' }, merge);
  el('feMergeNode', { in: 'SourceGraphic' }, merge);
  // and while a diagram is on the land, a soft Papel wash sits behind it so its lines stay readable
  const wash = el('rect', { class: 'ftl-wash', x: '0', y: '0', width: '100%', height: '100%', opacity: '0' }, svg);

  let W = 1, H = 1, cam = null, lang = 'en';
  const v = new THREE.Vector3();
  const P = (q, y = GRADE + 0.4) => { v.set(q[0], y, q[1]).project(cam); return [(v.x + 1) * 0.5 * W, (1 - v.y) * 0.5 * H]; };
  const dWorld = (pts, closed = false) => {
    let s = '';
    for (let i = 0; i < pts.length; i++) { const q = P(pts[i]); s += (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }
    return closed ? s + 'Z' : s;
  };
  const seg = (a, b) => `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`;
  const draw = (e, k) => { e.style.strokeDashoffset = (1 - Math.min(1, Math.max(0, k))).toFixed(3); };
  const show = (e, on) => { e.style.display = on ? '' : 'none'; };
  const opa = (e, k) => { e.style.opacity = Math.min(1, Math.max(0, k)).toFixed(3); };
  const drawPath = (parent, cls) => el('path', { class: cls, pathLength: '1', 'stroke-dasharray': '1', 'stroke-dashoffset': '1' }, parent);
  const plainPath = (parent, cls) => el('path', { class: cls }, parent);
  const circ = (parent, r, cls) => el('circle', { r: String(r), class: cls }, parent);
  const at = (e, q) => { e.setAttribute('cx', f1(q[0])); e.setAttribute('cy', f1(q[1])); };
  const put = (e, x, y) => { e.setAttribute('x', f1(x)); e.setAttribute('y', f1(y)); };
  const head = (x, y, ux, uy, s = 8) =>
    `M${f1(x - ux * s - uy * s * 0.5)} ${f1(y - uy * s + ux * s * 0.5)}L${f1(x)} ${f1(y)}L${f1(x - ux * s + uy * s * 0.5)} ${f1(y - uy * s - ux * s * 0.5)}`;
  const texts = [];
  const word = (parent, key, anchor = 'start', cls = '') => { const t = el('text', { 'text-anchor': anchor, class: cls }, parent); t.dataset.key = key; texts.push(t); return t; };
  const boxOf = (fw, fh, fy) => { const bw = Math.min(W * fw, 920), bh = Math.min(H * fh, 400); return { x: (W - bw) / 2, y: H * fy, w: bw, h: bh }; };
  // where a cycle sits: to the right of the parcel on wide frames, above it on narrow ones
  // (narrow: low enough that the top label clears the site's bar over the film)
  const ringOf = () => (W < 700 ? { cx: W * 0.5, cy: H * 0.31, r: Math.min(W, H) * 0.19 } : { cx: W * 0.74, cy: H * 0.32, r: Math.min(W, H) * 0.15 });
  const ringLabel = (t, cx, cy, r, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    t.setAttribute('text-anchor', Math.abs(c) < 0.3 ? 'middle' : c > 0 ? 'start' : 'end');
    put(t, cx + c * (r + 15), cy + s * (r + 15) + (s > 0.3 ? 11 : s < -0.3 ? -3 : 4));
  };

  const scenes = [];
  const scene = (win, build) => { const g = el('g', {}, svg); scenes.push({ win, g, fn: build(g) }); };

  // words anchored to places on the land, arriving one after another
  const noteSet = (g, grp, anchors, w) => {
    const items = anchors.map((anchor, i) => {
      const gg = el('g', {}, g);
      return { anchor, gg, dot: circ(gg, 2.4, 'dot'), lead: plainPath(gg, 'brass thin'), text: word(gg, `${grp}.${i}`) };
    });
    return (p) => {
      const step = (w[1] - w[0] - 0.006) / Math.max(1, items.length - 1);
      items.forEach((n, i) => {
        const k = smooth(w[0] + i * step, w[0] + i * step + 0.006, p) * (1 - smooth(w[2], w[3], p));
        const a = P(n.anchor);
        at(n.dot, a);
        n.lead.setAttribute('d', seg(a, [a[0] + 13, a[1] - 15]));
        put(n.text, a[0] + 16, a[1] - 20);
        opa(n.gg, k);
      });
    };
  };

  const heroLot = L.lots[L.hero];
  const z0 = PUBLIC.z(-20);

  // ---------- the approval path: the subdivision's own road, lit one milestone at a time ----------
  // It runs under every other layer from the opportunity to the sale, so each line of copy moves
  // the land one step closer to a subdivision. Only the newest milestone carries its name.
  scene([S.path[0] - 0.006, S.pathOut[1]], (g) => {
    const route = Array.from({ length: 61 }, (_, i) => L.spine.at((L.S * i) / 60).p);
    const cum = [0];
    for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    const total = cum[cum.length - 1];
    const upTo = (f) => {
      const d = f * total, out = [route[0]];
      for (let i = 1; i < route.length; i++) {
        if (cum[i] <= d) { out.push(route[i]); continue; }
        const t = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
        out.push([lerp(route[i - 1][0], route[i][0], t), lerp(route[i - 1][1], route[i][1], t)]);
        break;
      }
      return out;
    };
    const n = S.path.length;
    const ghost = el('path', { style: 'fill:none;stroke:#8F7546;stroke-width:1;stroke-dasharray:5 5' }, g);
    const lit = el('path', { style: 'fill:none;stroke:#8F7546;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round' }, g);
    const marks = S.path.map((_, i) => ({ c: circ(g, 3.6, 'node'), t: word(g, 'path.' + i, 'start', 'small'), at: upTo((i + 1) / n).pop() }));
    return (p) => {
      const out = 1 - smooth(S.pathOut[0], S.pathOut[1], p);
      const ks = S.path.map((m) => smooth(m - 0.004, m + 0.004, p));
      const frac = ks.reduce((a, b) => a + b, 0) / n;
      ghost.setAttribute('d', dWorld(route)); opa(ghost, smooth(S.path[0] - 0.006, S.path[0], p) * out * 0.7);
      lit.setAttribute('d', dWorld(upTo(Math.max(0.002, frac)))); opa(lit, out);
      marks.forEach((mk, i) => {
        const q = P(mk.at), k = ks[i], newer = i + 1 < n ? ks[i + 1] : 0;
        at(mk.c, q); mk.c.classList.toggle('done', k > 0.5); opa(mk.c, k * out);
        // the milestone name steps aside while the feedback rails are read across the same ground
        put(mk.t, q[0] + 10, q[1] + 4); opa(mk.t, k * (1 - newer) * (1 - win4(S.feedback, p)) * out);
      });
    };
  });

  // ---------- market signals, then one geography ----------
  scene([S.signals[0], S.spotlight[3]], (g) => {
    const spot = el('path', { class: 'spot', 'fill-rule': 'evenodd' }, g);
    const pub = [], cross = [];
    for (let x = -1500; x <= 1500; x += 30) pub.push([x, PUBLIC.z(x)]);
    for (let z = -1500; z <= 1500; z += 30) cross.push([SITES.crossroadX, z]);
    const roads = [plainPath(g, 'brass road'), plainPath(g, 'brass road')];
    const sig = [SITES.school.c, SITES.retail.c, SITES.park.c, [SITES.crossroadX, PUBLIC.z(SITES.crossroadX)], SITES.rural[1], SITES.rural[3], SITE_CENTER, FARMS[0], FARMS[2], FARMS[5]];
    const rings = sig.map(() => circ(g, 0, 'ring'));
    return (p) => {
      const kS = win4(S.signals, p);
      roads[0].setAttribute('d', dWorld(pub));
      roads[1].setAttribute('d', dWorld(cross));
      roads.forEach((r) => opa(r, kS * 0.85));
      const recede = smooth(S.spotlight[0], S.spotlight[1], p);
      rings.forEach((c, i) => {
        const k = smooth(S.signals[0] + i * 0.0012, S.signals[0] + i * 0.0012 + 0.006, p) * (1 - smooth(S.signals[2], S.signals[3], p));
        at(c, P(sig[i]));
        c.setAttribute('r', f1(4 + 11 * k));
        opa(c, k * (i >= 7 ? 1 - 0.8 * recede : 1));
      });
      const c = P(SITE_CENTER), r = lerp(Math.max(W, H) * 1.2, Math.min(W, H) * 0.32, recede);
      spot.setAttribute('d', `M0 0H${W}V${H}H0Z M${f1(c[0] + r)} ${f1(c[1])}A${f1(r)} ${f1(r * 0.7)} 0 1 0 ${f1(c[0] - r)} ${f1(c[1])}A${f1(r)} ${f1(r * 0.7)} 0 1 0 ${f1(c[0] + r)} ${f1(c[1])}Z`);
      opa(spot, win4(S.spotlight, p) * 0.6);
    };
  });

  // ---------- the opportunity ----------
  scene([S.opportunity[0], S.opportunity[3]], (g) =>
    noteSet(g, 'opp', [[60, PUBLIC.z(60) - 16], L.entrance, [-110, PUBLIC.z(-110) + 30], [70, -170], centroid(L.pond)], S.opportunity));

  // ---------- usable land: what survives the questions ----------
  scene([S.usable[0], S.usable[3]], (g) => {
    const wetEast = Math.max(...L.wetland.map((q) => q[0]));
    const P1 = offsetPoly(L.PARCEL, -10);
    const P2 = clipHalf(P1, (q) => q[0] - (wetEast + 15));
    const pondHole = offsetPoly(L.pond, 12);
    const P4 = clipHalf(P2, (q) => PUBLIC.z(q[0]) - PUBLIC.half - 18 - q[1]);
    const road = rowPolygons(L).strip;
    const states = [
      { outer: L.PARCEL }, { outer: P1 }, { outer: P2 }, { outer: P2, holes: [pondHole] },
      { outer: P4, holes: [pondHole] }, { outer: P4, holes: [pondHole, road] },
    ];
    const fills = states.map(() => el('path', { class: 'usable', 'fill-rule': 'evenodd' }, g));
    const labelAt = [[-60, -250], [wetEast + 10, -60], centroid(L.pond), [80, PUBLIC.z(80) - 26], L.spine.at(L.S * 0.5).p];
    const labels = labelAt.map((_, i) => word(g, 'usable.' + i));
    const starts = [S.usable[0], ...S.usableSteps];
    return (p) => {
      const out = 1 - smooth(S.usable[2], S.usable[3], p);
      states.forEach((st, i) => {
        const a = i === 0 ? smooth(S.usable[0], S.usable[1], p) : smooth(starts[i], starts[i] + 0.003, p);
        const b = i < states.length - 1 ? smooth(starts[i + 1], starts[i + 1] + 0.003, p) : 0;
        const k = a * (1 - b) * out;
        if (k > 0.001) {
          let d = dWorld(st.outer, true);
          for (const h of st.holes || []) d += dWorld(h, true);
          fills[i].setAttribute('d', d);
        }
        opa(fills[i], k);
      });
      labels.forEach((t, i) => {
        const s0 = starts[i + 1];
        const q = P(labelAt[i]);
        put(t, q[0], q[1]);
        opa(t, smooth(s0, s0 + 0.003, p) * (1 - smooth(s0 + 0.012, s0 + 0.016, p)) * out);
      });
    };
  });

  // ---------- the rules ----------
  scene([S.rulesNotes[0], S.rulesNotes[3]], (g) =>
    noteSet(g, 'rules', [[60, PUBLIC.z(60) - 16], L.spine.at(L.S * 0.4).p, [-140, -60], L.C], S.rulesNotes));

  scene([S.route[0], S.route[3]], (g) => {
    const nodes = [0, 1, 2, 3].map((i) => ({ c: circ(g, 4, 'node'), t: word(g, 'route.' + i, 'middle', 'dia') }));
    const links = [0, 1, 2].map(() => drawPath(g, 'ink thin'));
    const strike = drawPath(g, 'fail');
    return (p) => {
      const bw = Math.min(W * 0.5, 560), x0 = W - bw - W * 0.08, y = H * 0.17;
      const out = 1 - smooth(S.route[2], S.route[3], p), span = S.route[1] - S.route[0];
      nodes.forEach((n, i) => {
        const x = x0 + (bw * i) / 3, k = smooth(S.route[0] + i * span * 0.2, S.route[0] + i * span * 0.2 + span * 0.14, p);
        at(n.c, [x, y]); put(n.t, x, y + 22);
        opa(n.c, k * out); opa(n.t, k * out);
      });
      links.forEach((e, i) => {
        e.setAttribute('d', seg([x0 + (bw * i) / 3 + 8, y], [x0 + (bw * (i + 1)) / 3 - 8, y]));
        draw(e, smooth(S.route[0] + (i + 0.6) * span * 0.2, S.route[0] + (i + 0.6) * span * 0.2 + span * 0.14, p));
        opa(e, out);
      });
      // the first route does not hold
      const w = Math.min(120, bw / 3 - 10);
      strike.setAttribute('d', seg([x0 - w / 2, y + 18], [x0 + w / 2, y + 18]));
      draw(strike, smooth(S.route[0] + span * 0.3, S.route[0] + span * 0.45, p));
      opa(strike, out);
    };
  });

  // ---------- layouts ----------
  const LA = buildLayout({ ctrl: WRONG(z0), sketch: true });
  const LB = buildLayout({ ctrl: STRAIGHT(z0), sketch: true });
  const roadOf = (Lx) => Array.from({ length: 90 }, (_, i) => Lx.spine.at((Lx.S * i) / 89).p);
  const stub = (lot) => {
    const A = lot.front[0], B = lot.front[lot.front.length - 1], M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], V = lot.frame.V;
    return resample([M, [M[0] + V[0] * 10, M[1] + V[1] * 10]], 12, false);
  };
  const A = {
    road: roadOf(LA), C: LA.C,
    lots: LA.lots.map((l) => ({
      pts: resample(l.poly, 40, true),
      bad: l.poly.some((q) => pointInPoly(q, L.wetland) || pointInPoly(q, L.pond) || !pointInPoly(q, L.PARCEL)) ||
        L.pond.some((q) => pointInPoly(q, l.poly)) || L.wetland.some((q) => pointInPoly(q, l.poly)),
    })),
  };
  A.badRoad = A.road.filter((q) => pointInPoly(q, L.wetland) || !pointInPoly(q, L.PARCEL));
  if (!A.lots.some((l) => l.bad)) A.lots.slice(-3).forEach((l) => { l.bad = true; });
  const B = { road: roadOf(LB), C: LB.C, lots: {}, drives: {} };
  const Cc = { road: roadOf(L), C: L.C, lots: {}, drives: {} };
  for (const lot of LB.lots) { B.lots[lot.key] = resample(lot.poly, 40, true); B.drives[lot.key] = stub(lot); }
  for (const lot of L.lots) {
    Cc.lots[lot.key] = resample(lot.poly, 40, true);
    Cc.drives[lot.key] = lot.drive ? resample([lot.drive.apron[0], ...lot.drive.path], 12, false) : stub(lot);
  }
  const keys = L.lots.map((l) => l.key).filter((k) => B.lots[k]);
  const ticks = [];
  for (const lot of L.lots) {
    const V = lot.frame.V;
    for (const q of resample(lot.front, Math.max(3, Math.round(lot.front.length / 3)), false)) ticks.push([q, [q[0] + V[0] * 3, q[1] + V[1] * 3]]);
  }

  scene([S.layoutA[0], S.layoutAOut[1]], (g) => {
    const els = {
      l: drawPath(g, 'ink'), r: drawPath(g, 'ink'), c: plainPath(g, 'ink dash'), bulb: drawPath(g, 'ink'),
      lots: A.lots.map(() => drawPath(g, 'ink thin')), fails: A.lots.map((l) => (l.bad ? plainPath(g, 'fail') : null)), badRoad: plainPath(g, 'fail'),
    };
    return (p) => {
      const kA = smooth(S.layoutA[0], S.layoutA[1], p), kF = smooth(S.fail[0], S.fail[1], p);
      opa(g, 1 - smooth(S.layoutAOut[0], S.layoutAOut[1], p));
      els.l.setAttribute('d', dWorld(edges(A.road, 9))); draw(els.l, kA * 1.6);
      els.r.setAttribute('d', dWorld(edges(A.road, -9))); draw(els.r, kA * 1.6);
      els.c.setAttribute('d', dWorld(A.road)); opa(els.c, kA);
      els.bulb.setAttribute('d', dWorld(circle(A.C, BULB_ROW), true)); draw(els.bulb, kA * 1.6 - 0.6);
      A.lots.forEach((lot, i) => {
        els.lots[i].setAttribute('d', dWorld(lot.pts, true));
        draw(els.lots[i], (kA - 0.3 - i * 0.015) * 2.5);
        if (els.fails[i]) { els.fails[i].setAttribute('d', dWorld(lot.pts, true)); opa(els.fails[i], kF); }
      });
      if (A.badRoad.length > 1) { els.badRoad.setAttribute('d', dWorld(A.badRoad)); opa(els.badRoad, kF); }
    };
  });

  // the first layout, the better one, then the same plan under scenarios and a moved assumption
  scene([S.layoutB[0], S.planOut[1]], (g) => {
    const els = {
      l: drawPath(g, 'ink'), r: drawPath(g, 'ink'), c: plainPath(g, 'ink dash'), bulb: drawPath(g, 'ink'),
      lots: keys.map(() => drawPath(g, 'ink thin')), drives: keys.map(() => drawPath(g, 'ink')),
      ticks: plainPath(g, 'brass'), util: plainPath(g, 'brass dash'), drain: plainPath(g, 'brass dash'),
      split: plainPath(g, 'ink thin dash'), splitFail: plainPath(g, 'fail'), merged: plainPath(g, 'ink'),
      utilExt: drawPath(g, 'brass'), roadExt: drawPath(g, 'ink dash'), shrink: plainPath(g, 'fail thin'),
    };
    const scen = [0, 1, 2].map((i) => word(g, 'scen.' + i, 'middle', 'dia'));
    const stressW = [0, 1, 2, 3].map((i) => word(g, 'stress.' + i));
    // aggressive: every lot split in two; conservative: neighbours merged
    const splits = L.lots.filter((l) => l.side !== 'C').map((l) => {
      const f = l.front[Math.floor(l.front.length / 2)], rear = l.poly.slice(l.front.length);
      return [f, rear[Math.floor(rear.length / 2)]];
    });
    const merged = [];
    for (const side of ['E', 'W']) {
      const s = L.lots.filter((l) => l.side === side).sort((a, b) => a.idx - b.idx);
      for (let i = 0; i + 1 < s.length; i += 2) {
        const a = s[i], b = s[i + 1];
        merged.push([...a.front, ...b.front.slice(1), ...b.poly.slice(b.front.length), ...a.poly.slice(a.front.length)]);
      }
    }
    const usableTight = offsetPoly(clipHalf(offsetPoly(L.PARCEL, -18), (q) => q[0] - (Math.max(...L.wetland.map((w) => w[0])) + 22)), 0);
    const extFrom = [-20, PUBLIC.z(-20) - 11], extTo = [-640, PUBLIC.z(-640) - 11];
    const back = [L.C[0] + L.nEnd[0] * 0, L.C[1]];
    const roadExt = [L.C, [L.C[0] - L.back[0] * 70, L.C[1] - L.back[1] * 70]];
    void back;
    return (p) => {
      const kB = smooth(S.layoutB[0], S.layoutB[1], p), kM = smooth(S.morph[0], S.morph[1], p), kL = smooth(S.legible[0], S.legible[1], p);
      opa(g, 1 - smooth(S.planOut[0], S.planOut[1], p));
      const road = lerpPts(B.road, Cc.road, kM), bc = [lerp(B.C[0], Cc.C[0], kM), lerp(B.C[1], Cc.C[1], kM)];
      els.l.setAttribute('d', dWorld(edges(road, 9))); draw(els.l, kB * 1.6);
      els.r.setAttribute('d', dWorld(edges(road, -9))); draw(els.r, kB * 1.6);
      els.c.setAttribute('d', dWorld(road)); opa(els.c, kB);
      els.bulb.setAttribute('d', dWorld(circle(bc, BULB_ROW), true)); draw(els.bulb, kB * 1.6 - 0.6);
      // lot value softens under stress, then holds
      const soft = 1 - 0.5 * win4([S.stress[0], S.stress[1], S.respond[2], S.respond[3]], p);
      const cons = win4(S.conservative, p);
      keys.forEach((k, i) => {
        els.lots[i].setAttribute('d', dWorld(lerpPts(B.lots[k], Cc.lots[k], kM), true));
        draw(els.lots[i], (kB - 0.3 - i * 0.015) * 2.5);
        opa(els.lots[i], soft * (1 - 0.75 * cons));
        els.drives[i].setAttribute('d', dWorld(lerpPts(B.drives[k], Cc.drives[k], kM)));
        draw(els.drives[i], (kB - 0.6 - i * 0.01) * 4);
        opa(els.drives[i], soft * (1 - 0.75 * cons));
      });
      const legible = kL > 0.001;
      for (const e of [els.ticks, els.util, els.drain]) show(e, legible);
      if (legible) {
        let td = '';
        for (const [a, b] of ticks) td += seg(P(a), P(b));
        els.ticks.setAttribute('d', td);
        els.util.setAttribute('d', dWorld(edges(Cc.road, 8.1).slice(0, 80)) + dWorld(edges(Cc.road, -8.1).slice(0, 80)));
        els.drain.setAttribute('d', dWorld(L.pond, true) + dWorld(edges(Cc.road, 6.3).slice(4, 78)) + dWorld(edges(Cc.road, -6.3).slice(4, 78)));
        for (const e of [els.ticks, els.util, els.drain]) opa(e, kL * soft);
      }
      // scenarios
      const agg = win4(S.aggressive, p), bal = win4([S.conservative[2], S.conservative[3], S.stress[0], S.stress[0] + 0.003], p);
      const anyScen = agg + cons + bal + win4(S.respond, p) > 0.001;
      show(els.split, agg > 0.001); show(els.merged, cons > 0.001);
      if (agg > 0.001) { els.split.setAttribute('d', splits.map(([a, b]) => seg(P(a), P(b))).join('')); opa(els.split, agg); }
      if (cons > 0.001) { els.merged.setAttribute('d', merged.map((m) => dWorld(m, true)).join('')); opa(els.merged, cons); }
      const top = P([L.C[0], L.C[1] - 95]);
      scen.forEach((t, i) => { put(t, top[0], top[1]); opa(t, [agg, cons, bal][i]); });
      // a moved assumption, and what the scenarios do about it
      const kS = smooth(S.stress[0], S.stress[1], p), stressOut = 1 - smooth(S.respond[2], S.respond[3], p);
      const stressOn = kS > 0.001 && stressOut > 0.001;
      for (const e of [els.utilExt, els.roadExt, els.shrink, els.splitFail]) show(e, stressOn);
      if (stressOn) {
        els.utilExt.setAttribute('d', dWorld([extFrom, extTo])); draw(els.utilExt, kS * 1.4); opa(els.utilExt, stressOut);
        els.roadExt.setAttribute('d', dWorld(roadExt)); opa(els.roadExt, smooth(S.stress[0] + 0.002, S.stress[1], p) * stressOut);
        els.shrink.setAttribute('d', dWorld(usableTight, true)); opa(els.shrink, smooth(S.stress[0] + 0.004, S.stress[1], p) * stressOut * 0.8);
        const anchors = [roadExt[1], extTo, usableTight[Math.floor(usableTight.length * 0.3)], L.spine.at(L.S * 0.55).p];
        stressW.forEach((t, i) => {
          const q = P(anchors[i]);
          put(t, q[0] + 10, q[1] - 10);
          opa(t, smooth(S.stress[0] + i * 0.002, S.stress[0] + i * 0.002 + 0.003, p) * stressOut);
        });
        // the aggressive plan does not survive; the balanced one holds
        const fail = win4(S.respond, p);
        els.splitFail.setAttribute('d', splits.map(([a, b]) => seg(P(a), P(b))).join(''));
        opa(els.splitFail, fail * (1 - smooth(S.respond[1], S.respond[2], p) * 0.7));
      } else stressW.forEach((t) => opa(t, 0));
      void anyScen;
    };
  });

  // ---------- comps ----------
  scene([S.comps[0], S.comps[3]], (g) => {
    const comps = [
      { a: [150, PUBLIC.z(150) + 45], d: 0 }, { a: SITES.retail.c, d: 1 }, { a: [-250, 50], d: 2 },
      { a: SITES.sub2.c, d: 3 }, { a: FARMS[6], d: 4 }, { a: SITES.rural[0], d: 5 },
      { a: [320, -230], d: -1 }, { a: [-410, -90], d: -1 },
    ].map((c) => ({ ...c, ring: circ(g, 7, 'ring'), t: c.d >= 0 ? word(g, 'comps.' + c.d) : null, link: c.d < 0 ? drawPath(g, 'brass thin') : null }));
    const subject = circ(g, 5, 'node done');
    return (p) => {
      const out = 1 - smooth(S.comps[2], S.comps[3], p), kFade = smooth(S.compFade[0], S.compFade[1], p);
      const sc = P(SITE_CENTER);
      at(subject, sc); opa(subject, smooth(S.comps[0], S.comps[1], p) * out);
      comps.forEach((c, i) => {
        const q = P(c.a), kIn = smooth(S.comps[0] + i * 0.001, S.comps[0] + i * 0.001 + 0.006, p);
        at(c.ring, q);
        if (c.t) {
          put(c.t, q[0] + 12, q[1] - 10);
          opa(c.t, smooth(S.compDiff[0] + c.d * 0.0015, S.compDiff[0] + c.d * 0.0015 + 0.004, p) * (1 - kFade) * out);
          opa(c.ring, kIn * (1 - 0.85 * kFade) * out);
        } else {
          opa(c.ring, kIn * out);
          c.link.setAttribute('d', seg(q, sc)); draw(c.link, kFade); opa(c.link, out);
        }
      });
    };
  });

  // ---------- a pass ----------
  scene([S.pass[0], S.pass[3]], (g) => {
    const poly = drawPath(g, 'ink');
    const t = word(g, 'pass.0', 'middle', 'dia');
    return (p) => {
      const out = 1 - smooth(S.pass[2], S.pass[3], p);
      poly.setAttribute('d', dWorld(SITES.passed, true)); draw(poly, smooth(S.pass[0], S.pass[1], p)); opa(poly, out);
      const c = P(centroid(SITES.passed));
      put(t, c[0], c[1]); opa(t, smooth(S.pass[1], S.pass[1] + 0.004, p) * out);
    };
  });

  // ---------- structure: a cycle — seller, land, capital, partner, future lots, and back to the seller ----------
  // The parties arrive around the ring, the ring closes, and one pass goes around it while the terms
  // that make it possible change in the middle.
  scene([S.structure[0], S.structure[3]], (g) => {
    const n = 5, ang = (i) => -Math.PI / 2 + (i / n) * Math.PI * 2;
    const ring = el('circle', { class: 'ring thin' }, g);
    const arcs = Array.from({ length: n }, () => drawPath(g, 'ink thin'));
    const nodes = Array.from({ length: n }, (_, i) => ({ c: circ(g, 5, 'node'), t: word(g, 'struct.' + i, 'start', 'dia') }));
    const pulse = circ(g, 3.4, 'sold');
    const mid = [0, 1, 2, 3].map((i) => word(g, 'structWords.' + i, 'middle', 'small'));
    return (p) => {
      const { cx, cy, r } = ringOf(), out = 1 - smooth(S.structure[2], S.structure[3], p), span = S.structure[1] - S.structure[0];
      const pt = (a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      at(ring, [cx, cy]); ring.setAttribute('r', f1(r)); opa(ring, smooth(S.structure[0], S.structure[1], p) * out * 0.35);
      nodes.forEach((nd, i) => {
        const k = smooth(S.structure[0] + i * span * 0.12, S.structure[0] + i * span * 0.12 + span * 0.2, p);
        at(nd.c, pt(ang(i))); opa(nd.c, k * out);
        ringLabel(nd.t, cx, cy, r, ang(i)); opa(nd.t, k * out);
      });
      arcs.forEach((e, i) => {
        const s = pt(ang(i) + 0.09), t = pt(ang(i + 1) - 0.09), t0 = S.structure[0] + span * (0.35 + i * 0.1);
        e.setAttribute('d', `M${f1(s[0])} ${f1(s[1])}A${f1(r)} ${f1(r)} 0 0 1 ${f1(t[0])} ${f1(t[1])}`);
        draw(e, smooth(t0, t0 + span * 0.12, p)); opa(e, out);
      });
      const kP = smooth(S.structure[0] + span * 0.8, S.structure[3], p);
      at(pulse, pt(-Math.PI / 2 + kP * Math.PI * 2)); opa(pulse, (kP > 0 && kP < 1 ? 1 : 0) * out);
      const ws = S.structureWords, step = (ws[1] - ws[0]) / mid.length;
      mid.forEach((t, i) => {
        put(t, cx, cy + 4);
        const k = smooth(ws[0] + i * step, ws[0] + i * step + step * 0.3, p) *
          (i === mid.length - 1 ? 1 : 1 - smooth(ws[0] + (i + 1) * step, ws[0] + (i + 1) * step + step * 0.3, p));
        opa(t, k * out);
      });
    };
  });

  // (a partner: no diagram — her ask; the words carry it over the land)

  // ---------- the thesis, carried across the table ----------
  scene([S.closer[0], S.closer[3]], (g) => {
    const R = rng(33);
    const DET = Array.from({ length: 30 }, () => [R(), R(), 0.3 + R() * 0.7]);
    const bars = DET.map(() => plainPath(g, 'ink thin'));
    const five = [0, 1, 2, 3, 4].map((i) => ({ line: plainPath(g, 'ink'), t: word(g, 'closer.' + i, 'start', 'dia') }));
    const table = drawPath(g, 'brass');
    const stages = [0, 1, 2].map((i) => ({ line: plainPath(g, 'brass'), t: word(g, 'stage.' + i, 'start', 'small') }));
    return (p) => {
      // to the right of the parcel, clear of the approval path running up its road
      const b = W < 700 ? boxOf(0.9, 0.34, 0.1) : { x: W * 0.55, y: H * 0.12, w: Math.min(W * 0.4, 520), h: Math.min(H * 0.42, 380) };
      const out = 1 - smooth(S.closer[2], S.closer[3], p);
      const kIn = smooth(S.closer[0], S.closer[1], p), kC = smooth(S.closerCollapse[0], S.closerCollapse[1], p), kX = smooth(S.closerAcross[0], S.closerAcross[1], p);
      const midX = b.x + b.w * 0.5;
      table.setAttribute('d', seg([midX, b.y], [midX, b.y + b.h])); draw(table, kIn); opa(table, out * 0.8);
      DET.forEach((d, i) => {
        const x = b.x + d[0] * b.w * 0.42, y = b.y + d[1] * b.h, l = d[2] * b.w * 0.12;
        const ty = b.y + b.h * (0.14 + 0.18 * (i % 5));
        bars[i].setAttribute('d', `M${f1(lerp(x, b.x + b.w * 0.06, kC))} ${f1(lerp(y, ty, kC))}h${f1(lerp(l, b.w * 0.3, kC))}`);
        opa(bars[i], smooth(S.closer[0] + i * 0.0002, S.closer[0] + i * 0.0002 + 0.004, p) * (1 - kC) * out);
      });
      five.forEach((f, i) => {
        const y = b.y + b.h * (0.14 + 0.18 * i), x = lerp(b.x + b.w * 0.06, midX + b.w * 0.08, kX);
        f.line.setAttribute('d', `M${f1(x)} ${f1(y)}h${f1(b.w * 0.3)}`);
        put(f.t, x, y - 8);
        opa(f.line, kC * out); opa(f.t, kC * out);
      });
      // right below the thesis, the structure it carries: the land taken in stages
      stages.forEach((s, i) => {
        const k = smooth(S.closerAcross[0] + i * 0.002, S.closerAcross[1] + i * 0.002, p);
        const y = b.y + b.h + 20 + i * 30, xa = midX + b.w * 0.08 + i * b.w * 0.1;
        s.line.setAttribute('d', `M${f1(xa)} ${f1(y)}h${f1(b.w * 0.2 * k)}`);
        put(s.t, xa, y - 8); opa(s.line, out); opa(s.t, k * out);
      });
    };
  });

  // ---------- survey, civil, review ----------
  scene([S.civil[0], S.civil[3]], (g) => {
    const dims = plainPath(g, 'brass thin'), stations = plainPath(g, 'ink thin'), contours = plainPath(g, 'ink thin');
    const nodes = [0, 1, 2, 3, 4].map((i) => ({ c: circ(g, 4, 'node'), t: word(g, 'review.' + i, 'middle', 'dia') }));
    const links = [0, 1, 2, 3].map(() => drawPath(g, 'ink thin'));
    const loop = drawPath(g, 'brass');
    const pie = L.lots.find((l) => l.key === 'C2') || L.lots[L.lots.length - 1];
    const pieAfter = resample(pie.poly, 40, true);
    const pieBefore = pieAfter.map((q) => [L.C[0] + (q[0] - L.C[0]) * 0.86, L.C[1] + (q[1] - L.C[1]) * 0.86]);
    const pieEl = plainPath(g, 'fail');
    const dimSegs = [], stationSegs = [], contourRuns = [];
    for (const lot of L.lots.filter((l, i) => l.side !== 'C' && i % 2 === 0)) {
      const a = lot.front[0], b = lot.front[lot.front.length - 1], V = lot.frame.V;
      const a2 = [a[0] - V[0] * 4, a[1] - V[1] * 4], b2 = [b[0] - V[0] * 4, b[1] - V[1] * 4];
      dimSegs.push([a2, b2], [[a2[0] - V[0] * 1.5, a2[1] - V[1] * 1.5], [a2[0] + V[0] * 1.5, a2[1] + V[1] * 1.5]], [[b2[0] - V[0] * 1.5, b2[1] - V[1] * 1.5], [b2[0] + V[0] * 1.5, b2[1] + V[1] * 1.5]]);
    }
    for (let s = 10; s < L.S; s += 30) { const q = L.spine.at(s); stationSegs.push([[q.p[0] - q.n[0] * 5, q.p[1] - q.n[1] * 5], [q.p[0] + q.n[0] * 5, q.p[1] + q.n[1] * 5]]); }
    for (let c = 0; c < 6; c++) {
      const pts = [];
      for (let x = -180; x <= 170; x += 10) pts.push([x, -230 + c * 70 + 14 * Math.sin(x * 0.02 + c * 1.3)]);
      let run = [];
      for (const q of pts) { if (pointInPoly(q, L.PARCEL)) run.push(q); else if (run.length) { if (run.length > 1) contourRuns.push(run); run = []; } }
      if (run.length > 1) contourRuns.push(run);
    }
    return (p) => {
      const out = 1 - smooth(S.civil[2], S.civil[3], p), kT = smooth(S.civil[0], S.civil[1], p);
      dims.setAttribute('d', dimSegs.map(([a, b]) => seg(P(a), P(b))).join('')); opa(dims, kT * out);
      stations.setAttribute('d', stationSegs.map(([a, b]) => seg(P(a), P(b))).join('')); opa(stations, kT * out);
      contours.setAttribute('d', contourRuns.map((r) => dWorld(r)).join('')); opa(contours, kT * out * 0.45);
      // concept → submission → comment → revision → approval, with one loop back
      // the review cycle sits along the south edge of the frame, away from the plat it is reviewing
      // (narrow frames keep the bottom for the page's words, so the row rides the top edge, above the plat)
      const bw = Math.min(W * 0.52, 600), x0 = W - bw - W * 0.07, y = W < 700 ? H * 0.06 : H * 0.9, span = S.review[1] - S.review[0];
      const nx = (i) => x0 + (bw * i) / 4;
      nodes.forEach((n, i) => {
        const k = smooth(S.review[0] + i * span * 0.16, S.review[0] + i * span * 0.16 + span * 0.12, p);
        at(n.c, [nx(i), y]); put(n.t, nx(i), y + 22); opa(n.c, k * out); opa(n.t, k * out);
      });
      links.forEach((e, i) => {
        e.setAttribute('d', seg([nx(i) + 7, y], [nx(i + 1) - 7, y]));
        draw(e, smooth(S.review[0] + (i + 0.6) * span * 0.16, S.review[0] + (i + 0.6) * span * 0.16 + span * 0.12, p)); opa(e, out);
      });
      loop.setAttribute('d', `M${f1(nx(2))} ${f1(y - 8)}Q${f1((nx(1) + nx(2)) / 2)} ${f1(y - 44)} ${f1(nx(1))} ${f1(y - 8)}`);
      draw(loop, smooth(S.review[0] + span * 0.5, S.review[0] + span * 0.72, p)); opa(loop, out);
      // one plan changes after review
      const kc = smooth(S.reviewChange[0], S.reviewChange[1], p);
      pieEl.setAttribute('d', dWorld(lerpPts(pieBefore, pieAfter, kc), true));
      opa(pieEl, smooth(S.review[0] + span * 0.3, S.review[0] + span * 0.45, p) * out);
    };
  });

  // ---------- several timelines sharing one piece of land ----------
  scene([S.lanes[0], S.lanes[3]], (g) => {
    const SPAN = [[0.02, 0.3], [0.22, 0.55], [0.3, 0.62], [0.38, 0.7], [0.6, 0.95], [0.04, 0.34], [0, 0.18], [0.78, 1], [0.08, 0.9]];
    const DEPS = [[0, 1, 0.3, 0.34], [2, 4, 0.62, 0.64], [3, 4, 0.7, 0.72]];
    const lanes = SPAN.map((_, i) => ({ rule: plainPath(g, 'brass thin'), bar: drawPath(g, 'ink lane'), t: word(g, 'lanes.' + i, 'end', 'dia') }));
    const deps = DEPS.map(() => ({ arc: drawPath(g, 'brass'), hd: plainPath(g, 'brass') }));
    return (p) => {
      // the lanes stay in the upper half: the words keep the lower left
      const b = boxOf(0.8, 0.4, 0.12), out = 1 - smooth(S.lanes[2], S.lanes[3], p), n = SPAN.length;
      const lx = b.x + b.w * 0.2, lw = b.w * 0.78, step = (S.lanes[1] - S.lanes[0]) / n;
      const ly = (i) => b.y + ((i + 0.5) * b.h) / n;
      lanes.forEach((l, i) => {
        const k = smooth(S.lanes[0] + i * step, S.lanes[0] + i * step + step, p);
        l.rule.setAttribute('d', seg([lx, ly(i)], [lx + lw, ly(i)])); opa(l.rule, k * out * 0.35);
        l.bar.setAttribute('d', seg([lx + SPAN[i][0] * lw, ly(i)], [lx + SPAN[i][1] * lw, ly(i)])); draw(l.bar, k); opa(l.bar, out);
        put(l.t, lx - 14, ly(i) + 4); opa(l.t, k * out);
      });
      const dstep = (S.laneDeps[1] - S.laneDeps[0]) / deps.length;
      deps.forEach((d, i) => {
        const [fa, fb, xa, xb] = DEPS[i];
        const a = [lx + xa * lw, ly(fa)], c = [lx + xb * lw, ly(fb)], mx = (a[0] + c[0]) / 2 + 26;
        d.arc.setAttribute('d', `M${f1(a[0])} ${f1(a[1])}Q${f1(mx)} ${f1((a[1] + c[1]) / 2)} ${f1(c[0])} ${f1(c[1] - 5)}`);
        const k = smooth(S.laneDeps[0] + i * dstep, S.laneDeps[0] + i * dstep + dstep, p);
        draw(d.arc, k); opa(d.arc, out);
        d.hd.setAttribute('d', head(c[0], c[1] - 5, 0, 1, 6)); opa(d.hd, (k > 0.9 ? 1 : 0) * out);
      });
    };
  });

  // ---------- the schedule, when reality changes it ----------
  scene([S.schedule[0], S.schedule[3]], (g) => {
    const bg = el('ellipse', { fill: 'url(#ftl-field)' }, g);
    const PH = [T.clearing, T.excavation, T.utilities, T.surface, T.driveways];
    const BASE = [[0, 0.16], [0.16, 0.34], [0.34, 0.52], [0.52, 0.74], [0.74, 0.92]];
    const blocks = BASE.map(() => ({ box: plainPath(g, 'blk'), fill: plainPath(g, 'bar') }));
    const delay = plainPath(g, 'fail'), dt = word(g, 'sched.0', 'start', 'small');
    return (p) => {
      const bw = Math.min(W * 0.36, 400), x0 = W - bw - W * 0.05, y0 = H * 0.13, bh = 14;
      const out = 1 - smooth(S.schedule[2], S.schedule[3], p), kIn = smooth(S.schedule[0], S.schedule[1], p);
      const kP = smooth(S.problem[0], S.problem[1], p), kA = smooth(S.adjust[0], S.adjust[1], p);
      bg.setAttribute('cx', f1(x0 + bw / 2)); bg.setAttribute('cy', f1(y0 + 20)); bg.setAttribute('rx', f1(bw * 0.72)); bg.setAttribute('ry', '70');
      opa(bg, kIn * out);
      const span = BASE.map((b) => b.slice());
      span[2][1] += 0.12 * kP;                                      // utilities run long
      span[3] = [span[3][0] + 0.12 * kP, span[3][1] + 0.12 * kP];   // the road waits
      const dw = [span[4][0] + 0.12 * kP, span[4][1] + 0.12 * kP];
      span[4] = [lerp(dw[0], span[3][0] + 0.1, kA), lerp(dw[1], span[3][0] + 0.28, kA)];   // driveways move alongside
      blocks.forEach((b, i) => {
        const row = i === 4 ? kA : 0, y = y0 + row * (bh + 8);
        const xa = x0 + span[i][0] * bw * 0.92, xb = x0 + span[i][1] * bw * 0.92;
        b.box.setAttribute('d', `M${f1(xa)} ${f1(y)}H${f1(xb)}V${f1(y + bh)}H${f1(xa)}Z`);
        const done = smooth(PH[i][0], PH[i][1], p);
        b.fill.setAttribute('d', `M${f1(xa)} ${f1(y)}H${f1(xa + (xb - xa) * done)}V${f1(y + bh)}H${f1(xa)}Z`);
        opa(b.box, smooth(S.schedule[0] + i * 0.0015, S.schedule[0] + i * 0.0015 + 0.004, p) * out);
        opa(b.fill, out);
      });
      const ux = x0 + span[2][1] * bw * 0.92;
      delay.setAttribute('d', seg([ux, y0 - 4], [ux, y0 + bh + 4]));
      opa(delay, kP * out * (1 - 0.6 * kA));
      put(dt, x0 + span[2][0] * bw * 0.92, y0 - 10); opa(dt, kP * (1 - smooth(S.adjust[1], S.adjust[1] + 0.008, p)) * out);
    };
  });

  // ---------- lots reaching the market ----------
  scene([S.markets[0], S.markets[3]], (g) => {
    const R = rng(71);
    const lots = L.lots.filter((l) => l.drive).map((l) => ({ l, o: R() })).sort((a, b) => a.o - b.o);
    const marks = lots.map(({ l }, i) => {
      const f = l.front[Math.floor(l.front.length / 2)], V = l.frame.V;
      return { a: [f[0] + V[0] * 8, f[1] + V[1] * 8], ring: circ(g, 5, 'node'), dot: circ(g, 2.2, 'contract'), sold: circ(g, 5, 'sold'), willSell: i < Math.round(lots.length * 0.72) };
    });
    const buyers = [[[-900, PUBLIC.z(-900)], L.entrance], [[900, PUBLIC.z(900)], L.entrance], [[SITES.crossroadX, 500], L.entrance]].map((pts) => ({ pts, e: drawPath(g, 'brass thin') }));
    return (p) => {
      const out = 1 - smooth(S.markets[2], S.markets[3], p), kIn = smooth(S.markets[0], S.markets[1], p);
      const cs = (S.contract[1] - S.contract[0]) / marks.length, ss = (S.sold[1] - S.sold[0]) / marks.length;
      marks.forEach((m, i) => {
        const q = P(m.a);
        at(m.ring, q); at(m.dot, q); at(m.sold, q);
        opa(m.ring, kIn * out);
        const kc = smooth(S.contract[0] + i * cs, S.contract[0] + i * cs + cs * 2, p);
        const ks = m.willSell ? smooth(S.sold[0] + i * ss, S.sold[0] + i * ss + ss * 2, p) : 0;
        opa(m.dot, kc * (1 - ks) * out); opa(m.sold, ks * out);
      });
      buyers.forEach((b) => { b.e.setAttribute('d', dWorld(b.pts)); draw(b.e, smooth(S.markets[0], S.markets[1] + 0.006, p)); opa(b.e, out * 0.5); });
    };
  });

  // ---------- reality, back into the next underwriting ----------
  // what was assumed (top rail) against what happened (bottom rail); each measure is named once, above
  // its own column, and the ticks only drift a little so no two ever meet — then the model moves
  scene([S.feedback[0], S.feedback[3]], (g) => {
    const OFF = [0.05, 0.04, -0.035, 0.045, -0.03];
    const cols = OFF.map((_, i) => ({ top: plainPath(g, 'ink'), bot: plainPath(g, 'ink'), link: drawPath(g, 'brass thin'), t: word(g, 'fb.' + i, 'middle', 'dia') }));
    const rails = [plainPath(g, 'brass thin'), plainPath(g, 'brass thin')];
    const rows = [word(g, 'fbRows.0', 'end', 'small'), word(g, 'fbRows.1', 'end', 'small')];
    return (p) => {
      const narrow = W < 700, b = boxOf(narrow ? 0.78 : 0.6, 0.34, 0.14), out = 1 - smooth(S.feedback[2], S.feedback[3], p);
      const kIn = smooth(S.feedback[0], S.feedback[1], p), kO = smooth(S.outcomes[0], S.outcomes[1], p), kM = smooth(S.adjustModel[0], S.adjustModel[1], p);
      const ty = b.y + b.h * 0.34, by = b.y + b.h * 0.86;
      rails[0].setAttribute('d', seg([b.x, ty], [b.x + b.w, ty])); rails[1].setAttribute('d', seg([b.x, by], [b.x + b.w, by]));
      opa(rails[0], kIn * out * 0.5); opa(rails[1], kO * out * 0.5);
      put(rows[0], b.x - 10, ty + 4); opa(rows[0], kIn * out);
      put(rows[1], b.x - 10, by + 4); opa(rows[1], kO * out);
      cols.forEach((c, i) => {
        const cx = b.x + b.w * (0.1 + 0.2 * i), ax = cx + OFF[i] * b.w, tx = lerp(cx, ax, kM);
        c.top.setAttribute('d', seg([tx, ty - 9], [tx, ty + 9])); opa(c.top, kIn * out);
        c.bot.setAttribute('d', seg([ax, by - 9], [ax, by + 9])); opa(c.bot, kO * out);
        c.link.setAttribute('d', seg([tx, ty + 12], [ax, by - 12])); draw(c.link, kO); opa(c.link, out);
        put(c.t, cx, ty - 22 - (narrow && i % 2 ? 16 : 0)); opa(c.t, kIn * out);
      });
    };
  });

  // ---------- the ending: every part of the work, scattered, finding its place in the sequence ----------
  // All the ideas the story used arrive at once, unordered and askew; then each falls into its milestone
  // on one chronological line — opportunity to lots sold — and becomes a tick. The line is what remains,
  // and the film's own ending takes it from there.
  if (S.organize) scene([S.organize.scatter[0], S.organize.out[1]], (g) => {
    const O = S.organize, R = rng(909);
    const BY = [['opp'], ['usable'], ['rules', 'route'], ['scen', 'stress', 'comps'], ['structWords', 'jv', 'closer'],
      ['dd', 'title'], ['review'], ['util', 'lanes'], ['sched', 'status'], ['fb']];
    // her ask (2026-09-14): it read as chaos. Two words per milestone, each in its own cell of a loose grid —
    // unordered but never piled on each other — tilted only a little, then gathered onto the chronology.
    const frags = [];
    BY.forEach((grps, m) => {
      let j = 0;
      for (const grp of grps) {
        WORDS.en[grp].forEach((_, i) => {
          if (j >= 2) return;
          frags.push({ m, j: j++, t: word(g, `${grp}.${i}`, 'middle', 'small'), bar: plainPath(g, 'ink thin'),
            jx: R() - 0.5, jy: R() - 0.5, rot: (R() - 0.5) * 16, len: 14 + R() * 18, d: R() });
        });
      }
    });
    // shuffle the cells so neighbours on the chronology do not start as neighbours on the page
    const cells = frags.map((_, k) => k);
    for (let k = cells.length - 1; k > 0; k--) { const r = Math.floor(R() * (k + 1)); [cells[k], cells[r]] = [cells[r], cells[k]]; }
    frags.forEach((f, k) => { f.cell = cells[k]; });
    const line = drawPath(g, 'brass');
    const nodes = BY.map((_, m) => ({ c: circ(g, 4, 'node'), t: word(g, 'path.' + m, 'middle', 'small') }));
    return (p) => {
      const narrow = W < 760, kOut = 1 - smooth(O.out[0], O.out[1], p), gs = O.gather[1] - O.gather[0];
      // the chronology runs across a wide frame and down a narrow one
      const slot = (m) => (narrow ? [W * 0.22, H * (0.12 + 0.07 * m)] : [W * (0.08 + 0.84 * (m / 9)), H * 0.46]);
      line.setAttribute('d', seg(slot(0), slot(9))); draw(line, smooth(O.gather[0] + gs * 0.3, O.gather[1], p)); opa(line, kOut);
      nodes.forEach((n, m) => {
        const q = slot(m), k = smooth(O.gather[0] + gs * (0.35 + m * 0.05), O.gather[0] + gs * (0.5 + m * 0.05), p);
        at(n.c, q); n.c.classList.toggle('done', k > 0.6); opa(n.c, k * kOut);
        n.t.setAttribute('text-anchor', narrow ? 'start' : 'middle');
        if (narrow) put(n.t, q[0] + 18, q[1] + 4); else put(n.t, q[0], q[1] + (m % 2 ? -20 : 28));
        opa(n.t, k * kOut);
      });
      frags.forEach((f) => {
        const s0 = O.scatter[0] + f.d * (O.scatter[1] - O.scatter[0]) * 0.7;
        const kIn = smooth(s0, s0 + 0.004, p);
        const g0 = O.gather[0] + f.m * gs * 0.05 + f.d * gs * 0.08, kG = smooth(g0, g0 + gs * 0.45, p);
        const s = slot(f.m), off = (f.j - 0.5) * 6;
        const cols = narrow ? 2 : 5, rows = Math.ceil(frags.length / cols), col = f.cell % cols, row = Math.floor(f.cell / cols);
        const sx = 0.08 + (0.84 * (col + 0.5 + f.jx * 0.35)) / cols, sy = 0.14 + (0.62 * (row + 0.5 + f.jy * 0.3)) / rows;
        const x = lerp(sx * W, narrow ? s[0] : s[0] + off, kG), y = lerp(sy * H, narrow ? s[1] + off : s[1], kG);
        const rot = f.rot * (1 - kG);
        f.t.setAttribute('transform', `rotate(${f1(rot)} ${f1(x)} ${f1(y)})`);
        put(f.t, x, y - 8);
        opa(f.t, kIn * (1 - smooth(0.18, 0.5, kG)) * kOut);   // the words leave while still apart; only their ticks land on the line
        // each loose dash turns into a tick across the line
        const a = (rot * Math.PI) / 180;
        let ux = lerp(Math.cos(a), narrow ? 1 : 0, kG), uy = lerp(Math.sin(a), narrow ? 0 : 1, kG);
        const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
        const len = lerp(f.len, 12, kG), cy = y + 6 * (1 - kG);
        f.bar.setAttribute('d', seg([x - (ux * len) / 2, cy - (uy * len) / 2], [x + (ux * len) / 2, cy + (uy * len) / 2]));
        opa(f.bar, kIn * kOut);
      });
    };
  });

  function setLang(next) {
    lang = next === 'es' ? 'es' : 'en';
    for (const t of texts) { const [grp, i] = t.dataset.key.split('.'); t.textContent = WORDS[lang][grp][+i]; }
  }
  setLang('en');

  function resize(w, h) { W = w; H = h; svg.setAttribute('viewBox', `0 0 ${w} ${h}`); }

  function update(p, camera, w, h) {
    cam = camera; W = w; H = h;
    let backing = 0;
    scenes.forEach((s, i) => {
      const on = p >= s.win[0] && p <= s.win[1];
      show(s.g, on);
      if (on) s.fn(p);
      // the approval path runs under everything (scene 0); every other scene is a diagram that wants a backing
      if (i > 0 && on) backing = Math.max(backing, smooth(s.win[0], s.win[0] + 0.006, p) * (1 - smooth(s.win[1] - 0.006, s.win[1], p)));
    });
    opa(wash, backing * 0.42);
    let veil = 0;
    for (const t of S.veils) veil = Math.max(veil, win4(t.w, p) * t.k);
    return veil;
  }

  return { update, resize, setLang };
}
