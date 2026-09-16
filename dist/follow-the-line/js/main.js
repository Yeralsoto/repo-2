// FOLLOW THE LINE — boot, scroll, render.
// All state derives from one number: p, the scroll through the section, from 0 to 1.
import * as THREE from 'three';
import { buildLayout } from './layout.js';
import { SCROLL_VH, COPY, STAGES, T, WORK, tier as getTier } from './config.js';
import { U } from './shaders.js';
import { regions, buildTerrain, buildRing, buildTrees, buildPublicRoad, buildFarms, buildAtmosphere } from './world.js';
import { buildSite } from './build.js';
import { buildHouses } from './houses.js';
import { buildLife } from './life.js';
import { makeCamera } from './camera.js';
import { createOverlay } from './overlay.js';
import { buildGrowth } from './growth.js';
import { buildNetwork } from './network.js';
import { createStory } from './story.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const section = document.getElementById('ftl');
// A reload starts the story from the land, not from wherever the reader left the scroll.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (section) boot();

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

function boot() {
  const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
  // ?reduced previews the reduced-motion version without changing the system setting
  // an embedded film takes its still frames from the host page, never from its own buttons
  const reduced = (reduceQuery.matches || new URLSearchParams(location.search).has('reduced')) &&
    !document.documentElement.classList.contains('ftl-embed');
  reduceQuery.addEventListener?.('change', () => location.reload());
  if (!webgl()) { section.classList.add('ftl-static'); return; }
  // Embedded in a page (The Work): that page's scroll drives the film, so this one does not scroll.
  const embed = document.documentElement.classList.contains('ftl-embed');
  section.style.setProperty('--ftl-len', reduced || embed ? 100 : SCROLL_VH);
  section.classList.add('ftl-live');
  section.classList.toggle('ftl-reduced', reduced);
  // Let the first line of copy paint before the land is built. A timer, not an animation frame:
  // a page opened in a background tab still builds, and is ready when the reader arrives.
  setTimeout(() => init(reduced), 60);
}

function init(reduced) {
  const stage = section.querySelector('.ftl-stage');
  const items = [...section.querySelectorAll('.ftl-copy li')];
  const holder = stage.querySelector('.ftl-canvas');
  const veil = stage.querySelector('.ftl-veil');
  const svg = stage.querySelector('.ftl-draw');
  const bar = stage.querySelector('.ftl-progress span');
  const tier = getTier();
  const built0 = performance.now();
  const L = buildLayout();

  if (new URLSearchParams(location.search).has('check')) {
    import('./validate.js').then(({ validate }) => {
      const r = validate(L);
      window.__ftlCheck = r;
      console.info('[follow-the-line] plan', r.ok ? 'PASS' : 'FAIL', r.checks.map((c) => `${c[1] ? '✓' : '✗'} ${c[0]} ${c[2]}`).join('\n'));
    });
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: tier.name !== 'low', powerPreference: 'high-performance' });
  } catch {
    section.classList.remove('ftl-live');
    section.classList.add('ftl-static');
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !!tier.shadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const dprMax = Math.min(window.devicePixelRatio || 1, tier.dprMax);
  let dpr = dprMax;
  renderer.setPixelRatio(dpr);
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 12000);
  const reg = regions(L);
  const terrain = buildTerrain(L, reg, tier);
  const ring = buildRing(L, reg, tier, terrain.raw);
  scene.add(terrain.voxels, terrain.real, ring.voxels, ring.real, ring.ground);
  scene.add(buildTrees(L, reg, tier, terrain));
  scene.add(buildPublicRoad(tier), buildFarms(terrain.raw));
  const site = buildSite(L, reg, tier, terrain);
  scene.add(site.group);
  const houses = buildHouses(L, tier);
  scene.add(houses.group);
  const lived = buildLife(L, reg, tier, houses, site);
  scene.add(lived.group);
  const growth = buildGrowth(terrain.raw, tier);
  scene.add(growth.group);
  const network = buildNetwork(L, growth, terrain.raw);
  scene.add(network.group);
  const atmo = buildAtmosphere(scene, tier);
  const cam = makeCamera(L, houses);
  const overlay = createOverlay(svg, svg.querySelector('path'), items[items.length - 1].querySelector('p'), stage, site.parcel3D, network.dominant3D);
  const story = WORK ? createStory(stage, L) : null;
  // The Work ends like the film: her mark draws, the last line settles, and her name signs it
  const lastLine = items[items.length - 1].querySelector('p');
  // her closing line for The Work: the chaos of the whole story, given one line
  const CLOSING = { en: 'I take the chaos and turn it into a line', es: 'Tomo el caos y lo convierto en una línea' };
  // and her signature under it: this piece was designed and programmed by her (her ask)
  const CREDIT = { en: 'Designed and programmed by Yeraldin Soto', es: 'Diseñado y programado por Yeraldin Soto' };
  let creditEl = null;
  if (WORK) {
    lastLine.innerHTML = CLOSING.en + '<span class="stop">.</span>';
    document.documentElement.classList.add('ftl-work');
    creditEl = document.createElement('span');
    creditEl.className = 'ftl-name';
    creditEl.textContent = CREDIT.en;
    items[items.length - 1].appendChild(creditEl);
  }

  let W = 1, H = 1, dirty = true;
  // The Work on a wide screen, inside its page: the page's sticky bar covers the top of the film, its words sit
  // bottom left and its keep-scrolling tab bottom right. The page is the same origin, so the film reads where
  // they are (as they sit once the stage is pinned under the bar) and camera.js keeps the land in the room left.
  let host = null;
  const measureHost = () => {
    host = null;
    dirty = true;
    if (!WORK || window.parent === window) return;
    try {
      const doc = window.parent.document, fe = window.frameElement;
      const stage = fe && fe.closest('.ws-stage'), nav = doc.querySelector('nav.topbar');
      if (!stage || !nav) return;
      const st = stage.getBoundingClientRect(), more = stage.querySelector('.ws-more');
      let wordsRight = 0;
      for (const g of stage.querySelectorAll('.ws-group:not(.end):not(.proof)')) {
        const r = g.getBoundingClientRect();
        if (r.width) wordsRight = Math.max(wordsRight, r.right - st.left);
      }
      const mr = more ? more.getBoundingClientRect() : null;
      host = { top: nav.getBoundingClientRect().height, wordsRight, moreTop: mr && mr.height ? mr.top - st.top : st.height, end: null };
      // the page's closing line sits centred across the film for its beat
      const endLine = stage.querySelector('.ws-group.end .ws-line');
      if (endLine) {
        const r = endLine.getBoundingClientRect();
        // (a line waiting for its beat is drawn 16px lower: .ws-line's translateY in the page's CSS)
        const drop = endLine.classList.contains('on') ? 0 : parseFloat(window.parent.getComputedStyle(endLine).transform.split(',')[5]) || 0;
        if (r.height) host.end = { t: r.top - st.top - drop, at: +endLine.dataset.at, out: +endLine.dataset.out };
      }
    } catch { host = null; }
  };
  try { window.parent.document.fonts?.ready.then(measureHost); } catch { /* not embedded in a same-origin page */ }
  const resize = () => {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    overlay.resize(W, H);
    if (story) story.resize(W, H);
    measureHost();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) dirty = true; }).observe(section);

  // ---------- reduced motion: still frames with previous / next ----------
  let stageIndex = 0;
  if (reduced) {
    const nav = stage.querySelector('.ftl-steps');
    nav.hidden = false;
    const prev = nav.querySelector('[data-step="prev"]'), next = nav.querySelector('[data-step="next"]'), count = nav.querySelector('.ftl-count');
    const go = (i) => {
      stageIndex = Math.max(0, Math.min(STAGES.length - 1, i));
      count.textContent = `${stageIndex + 1} / ${STAGES.length}`;
      prev.disabled = stageIndex === 0;
      next.disabled = stageIndex === STAGES.length - 1;
      dirty = true;
    };
    prev.addEventListener('click', () => go(stageIndex - 1));
    next.addEventListener('click', () => go(stageIndex + 1));
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(stageIndex + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(stageIndex - 1); }
    });
    go(0);
  }

  // Embedded: progress arrives from the host page, same origin only.
  const embed = document.documentElement.classList.contains('ftl-embed');
  let embedP = 0, embedStill = false, lastLang = 'en';
  if (embed) {
    addEventListener('message', (e) => {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'ftl:p') return;
      embedP = Math.min(1, Math.max(0, +e.data.p || 0));
      embedStill = !!e.data.still;                 // host page is in reduced motion: jump, don't glide
      if (story && e.data.lang) {
        story.setLang(e.data.lang);
        lastLine.innerHTML = (e.data.lang === 'es' ? CLOSING.es : CLOSING.en) + '<span class="stop">.</span>';
        if (creditEl) creditEl.textContent = e.data.lang === 'es' ? CREDIT.es : CREDIT.en;
        // the page's words change width with the language
        if (e.data.lang !== lastLang) { lastLang = e.data.lang; measureHost(); }
      }
      dirty = true;
    });
  }

  // ?p=0.42 pins the film to one frame (for review and screenshots); scroll is ignored.
  const pinned = new URLSearchParams(location.search).get('p');
  const pinnedP = pinned === null ? null : Math.min(1, Math.max(0, parseFloat(pinned) || 0));
  let reviewP = null;
  const targetP = () => {
    if (reviewP !== null) return reviewP;
    if (pinnedP !== null) return pinnedP;
    if (reduced) return STAGES[stageIndex];
    if (embed) return embedP;
    const r = section.getBoundingClientRect();
    const run = section.offsetHeight - window.innerHeight;
    return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
  };

  function paintCopy(p) {
    items.forEach((el, i) => {
      let a;
      if (reduced) a = i === stageIndex ? 1 : 0;
      else {
        // on The Work the page holds the copy; the film keeps only its last line, for the ending
        const c = WORK ? (i === items.length - 1 ? { at: 0.93, out: 1.1 } : { at: 2, out: 2.1 }) : COPY[i];
        const inn = c.at <= 0 ? 1 : smooth(c.at, c.at + 0.012, p);
        a = inn * (1 - smooth(c.out - 0.01, c.out, p));
      }
      el.style.opacity = a.toFixed(3);
      if (!reduced) el.style.transform = `translate3d(0, ${((1 - a) * 10).toFixed(1)}px, 0)`;
      el.classList.toggle('is-on', a > 0.5);
    });
  }

  function render(p) {
    U.uP.value = p;
    const focus = cam.update(camera, p, W / H, H, host);
    atmo.update(p, focus);
    scene.fog.near = Math.max(600, focus.dist * 1.2);
    scene.fog.far = Math.max(2400, focus.dist * 4.2);
    lived.update(p);
    growth.update(p);
    network.update(p);
    renderer.render(scene, camera);
    paintCopy(p);
    // the page veil only covers the canvas once the SVG holds the line
    const storyVeil = story ? story.update(p, camera, W, H) : 0;
    veil.style.opacity = Math.max(smooth(T.handoff[0], T.handoff[1], p), storyVeil).toFixed(3);
    // The Work ends on the brand's green: once the SVG holds the line, the veil is Verde and the
    // drawing, the words and her name turn to Papel (line.css .ftl-green)
    if (WORK) {
      const green = p >= T.figures[0] - 0.012;   // as soon as the SVG line appears
      veil.style.background = green ? '#1E4638' : '';
      document.documentElement.classList.toggle('ftl-green', green);
    }
    overlay.update(p, camera);
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
  }

  // Compile every program up front so the first scroll does not stutter.
  for (const probe of [0, T.boundary[1], T.surface[1], T.hero ? T.hero.walls[1] : T.firstHomes[1], T.real[1], T.growth.retail[1], T.network.lines[1]]) { U.uP.value = probe; renderer.compile(scene, camera); }

  let pS = targetP(), last = performance.now(), lastRender = 0, acc = 0, frames = 0;
  render(pS);
  section.classList.add('ftl-ready');
  console.info(`[follow-the-line] ${tier.name} tier, built in ${Math.round(performance.now() - built0)} ms`);
  // tell the host page the film can take its scroll position now (it may have been sent too early)
  if (embed && window.parent !== window) window.parent.postMessage({ type: 'ftl:ready' }, location.origin);

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible) return;
    const tp = targetP();
    const next = reduced || embedStill ? tp : pS + (tp - pS) * (1 - Math.exp(-dt * 6.5));
    if (!dirty && Math.abs(next - pS) < 2e-6) return;
    pS = Math.abs(tp - next) < 2e-5 ? tp : next;
    dirty = false;
    render(pS);
    // adaptive resolution: step down when frames are slow, back up when there is headroom
    if (now - lastRender < 80) { acc += now - lastRender; frames++; }
    lastRender = now;
    if (frames >= 45) {
      const avg = acc / frames;
      if (avg > 26 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
      else if (avg < 14 && dpr < dprMax) { dpr = Math.min(dprMax, dpr + 0.25); renderer.setPixelRatio(dpr); resize(); }
      acc = 0; frames = 0;
    }
  }
  requestAnimationFrame(frame);
  // debugging handle: current progress and a way to jump to one
  window.__ftl = {
    L, scene, camera, renderer,
    get p() { return pS; },
    // review only: the page layout the wide-screen fit reads (set to null to see the film unfitted)
    get host() { return host; },
    set host(h) { host = h; dirty = true; },
    // review only: paint one frame synchronously (the preview throttles animation frames)
    renderAt: (p) => { reviewP = pS = Math.min(1, Math.max(0, p)); render(pS); },
    setP: (p) => { window.scrollTo(0, section.offsetTop + p * (section.offsetHeight - window.innerHeight)); },
  };
}
