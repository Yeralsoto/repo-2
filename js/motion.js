/* MOTION — progressive enhancement only.
   Without JS every page is whole: English, the flower drawn, every print of
   The Days simply there. See CLAUDE.md. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var each = function (sel, fn, scope) { [].forEach.call((scope || document).querySelectorAll(sel), fn); };
  var onLang = [];   // modules that own a label register here

  /* ================= REVEAL ================= */
  var watch = document.querySelectorAll('[data-reveal],.draw,.horizon,.rise,.portrait');
  if (reduce || !('IntersectionObserver' in window)) {
    [].forEach.call(watch, function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) {
        if (r.isIntersecting) { r.target.classList.add('in'); io.unobserve(r.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .15 });
    [].forEach.call(watch, function (e) { io.observe(e); });
  }

  /* ABOUT — the paper airplane (her iteration, 2026-09-14): milestones are chapters, not a scrub.
     The current milestone is in focus and the plane is completely still. One intentional scroll gesture
     turns one chapter: the destination comes into focus, its leg draws, the plane flies it quickly
     (≈1.2 s in all), lands, levels, and is still again. Scrolling back flies back. While the timeline
     sits in the middle of the screen, wheel gestures turn chapters instead of moving the page; at either
     end the page scrolls on. Trackpads send long bursts of wheel events, so: an accumulated threshold,
     a lock while flying, a short cooldown, and a quiet gap before the next gesture counts — one swipe,
     one chapter. Jumps (scrollbar, links, reloading lower down) resolve straight to the right finished
     state; nothing replays. Phones: no hijacking — in view, the chapters turn by themselves, one at a
     time, and the page stays scrollable. Reduced motion: the route appears and the plane relocates. After
     the last milestone the route continues faintly and dissolves: no destination, no label. */
  (function () {
    var flight = document.querySelector('.tl-flight');
    if (!flight) return;
    var box = flight.querySelector('.tl-scroll'), tl = box.querySelector('.tl'), svg = box.querySelector('.tl-route');
    var legsG = svg.querySelector('.tl-legs'), future = svg.querySelector('.tl-future'), plane = svg.querySelector('.tl-plane');
    var steps = [].slice.call(tl.querySelectorAll('.tl-step')), n = steps.length;
    var TIMING = { draw: 320, pause: 60, flyMin: 520, flyMax: 720, settle: 100, cool: 260 };   // ms: focus + draw → pause → fly → level
    var st = { active: 0, busy: false, rest: 0, acc: 0, lastWheel: 0, needGap: false, coolUntil: 0 };
    var legs = [], pts = [];
    var easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
    var easeInOut = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    for (var i = 0; i < n - 1; i++) {
      var leg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      leg.setAttribute('class', 'tl-leg'); leg.setAttribute('pathLength', '1');
      legsG.appendChild(leg); legs.push(leg);
    }
    // the route is laid over the milestone ticks: a low arc for every leg, a short unfinished line past today
    function geometry() {
      var y = tl.offsetTop + 5;
      pts = steps.map(function (s) { return [tl.offsetLeft + s.offsetLeft, y]; });
      svg.setAttribute('width', tl.offsetLeft + tl.scrollWidth);
      svg.setAttribute('height', y + 10);
      legs.forEach(function (l, k) {
        var a = pts[k], b = pts[k + 1], lift = Math.min(30, (b[0] - a[0]) * 0.18);
        l.setAttribute('d', 'M' + a[0] + ' ' + y + 'Q' + (a[0] + b[0]) / 2 + ' ' + (y - lift * 2) + ' ' + b[0] + ' ' + y);
      });
      var last = pts[n - 1];
      future.setAttribute('d', 'M' + last[0] + ' ' + y + 'q70 -30 160 -22');
    }
    function put(x, y, deg) { plane.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + (y - 10).toFixed(1) + ') rotate(' + deg.toFixed(1) + ')'); }
    function follow(x) {   // a phone's strip keeps the plane in view
      if (x < box.scrollLeft + 40 || x > box.scrollLeft + box.clientWidth - 60) box.scrollLeft = Math.max(0, x - box.clientWidth * 0.5);
    }
    // focus: the destination is primary, where she came from stays legible, what follows stays quiet
    function focus(i) { steps.forEach(function (s, k) { s.classList.toggle('cur', k === i); s.classList.toggle('past', k < i); }); }
    function settleAt(i) {
      st.active = i;
      focus(i);
      legs.forEach(function (l, k) { l.style.strokeDashoffset = k < i ? '0' : '1'; });
      if (i < n - 1) { future.style.opacity = '0'; future.style.strokeDashoffset = '1'; }
      plane.style.opacity = '';
      put(pts[i][0], pts[i][1], st.rest);
      follow(pts[i][0]);
    }
    function dissolveFuture(instant) {
      if (instant) { future.style.strokeDashoffset = '0'; future.style.opacity = '0'; return; }
      var t0 = performance.now();
      (function f(now) {
        if (st.active !== n - 1 || st.busy) return;
        var t = now - t0;
        future.style.strokeDashoffset = (1 - easeOut(clamp01(t / 900))).toFixed(3);
        future.style.opacity = (0.7 * (1 - easeOut(clamp01((t - 700) / 1800)))).toFixed(3);
        if (t < 2500) requestAnimationFrame(f);
      })(t0);
    }
    // one chapter: from the active milestone to an adjacent one
    function go(to) {
      var from = st.active, fwd = to > from, leg = legs[fwd ? from : to], L = leg.getTotalLength(), T = TIMING;
      var fly = Math.round(Math.min(T.flyMax, T.flyMin + L * 0.5)), flyAt = fwd ? T.draw + T.pause : 80, end = flyAt + fly + T.settle;
      var t0 = performance.now(), rest = fwd ? 0 : 180;
      st.busy = true;
      focus(to);
      if (from === n - 1) { future.style.opacity = '0'; future.style.strokeDashoffset = '1'; }
      (function frame(now) {
        var t = now - t0;
        if (reduce) {   // the route appears; the plane relocates
          if (fwd) leg.style.strokeDashoffset = '0'; else leg.style.strokeDashoffset = '1';
          var k = clamp01(t / 360);
          plane.style.opacity = (k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2).toFixed(2);
          if (k >= 0.5) put(pts[to][0], pts[to][1], 0);
          if (k < 1) { requestAnimationFrame(frame); return; }
        } else {
          if (fwd) leg.style.strokeDashoffset = (1 - easeOut(clamp01(t / T.draw))).toFixed(3);   // information first, then movement
          if (t >= flyAt) {
            var e = easeInOut(clamp01((t - flyAt) / fly)), d = fwd ? L * e : L * (1 - e), p = leg.getPointAtLength(d);
            var a = leg.getPointAtLength(Math.max(0, d - 1.5)), b = leg.getPointAtLength(Math.min(L, d + 1.5));
            var nose = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + (fwd ? 0 : 180);
            put(p.x, p.y, nose + (rest - nose) * easeOut(clamp01((t - flyAt - fly) / T.settle)));   // on landing, the nose levels
            if (!fwd) leg.style.strokeDashoffset = (1 - d / L).toFixed(3);                          // flying back, the leg folds away behind it
            follow(p.x);
          }
          if (t < end) { requestAnimationFrame(frame); return; }
        }
        st.busy = false;
        st.rest = reduce ? 0 : rest;
        settleAt(to);
        if (to === n - 1) dissolveFuture(false);
        st.coolUntil = performance.now() + T.cool;
        st.needGap = true;
      })(t0);
    }

    geometry();
    if (!('IntersectionObserver' in window)) { settleAt(n - 1); future.style.strokeDashoffset = '0'; future.style.opacity = '0.35'; return; }
    flight.classList.add('armed');
    settleAt(0);
    // text first: the route is laid over the milestones as they actually wrap — again once fonts load and whenever the strip resizes
    var relayout = function () { geometry(); if (!st.busy) settleAt(st.active); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(tl);

    // jumps resolve to the finished state that belongs there
    function resolve() {
      if (st.busy) return;
      var r = box.getBoundingClientRect(), vh = window.innerHeight;
      if (r.bottom < 0 && st.active !== n - 1) { st.rest = 0; settleAt(n - 1); dissolveFuture(true); }
      else if (r.top > vh && st.active !== 0) { st.rest = 0; settleAt(0); }
    }
    var queued = false;
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; resolve(); }); } }, { passive: true });
    window.addEventListener('resize', function () { geometry(); if (!st.busy) settleAt(st.active); });
    resolve();

    var desktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var wide = function () { return desktop && window.innerWidth > 820; };
    {
      // phones, touch and narrow windows: no hijacking; in view, the chapters turn by themselves, one at a time
      var inView = false;
      var chain = function () {
        if (wide() || !inView || st.busy || st.active >= n - 1) return;
        go(st.active + 1);
        var wait = function () { if (st.busy) { requestAnimationFrame(wait); return; } var t0 = performance.now(); (function h(now) { if (now - t0 < 650) { requestAnimationFrame(h); return; } chain(); })(t0); };
        requestAnimationFrame(wait);
      };
      new IntersectionObserver(function (rows) { inView = rows[0].isIntersecting; if (inView) chain(); }, { threshold: 0.6 }).observe(box);
    }
    if (desktop) {
      var engaged = function () {
        var r = box.getBoundingClientRect(), vh = window.innerHeight;
        return window.innerWidth > 820 && r.top >= vh * 0.06 && r.bottom <= vh * 0.96;
      };
      window.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.ctrlKey || !engaged()) { st.acc = 0; return; }
        var now = performance.now(), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, gap = now - st.lastWheel;
        st.lastWheel = now;
        if (st.busy || now < st.coolUntil) { e.preventDefault(); st.acc = 0; return; }
        if (st.needGap) {   // the tail of the gesture that turned the last chapter
          if (gap < 140) { e.preventDefault(); return; }
          st.needGap = false;
        }
        var to = st.active + (dy > 0 ? 1 : -1);
        if (to < 0 || to > n - 1) { st.acc = 0; return; }   // at either end the page scrolls on
        e.preventDefault();
        if (gap > 220 || (st.acc && (st.acc > 0) !== (dy > 0))) st.acc = 0;
        st.acc += dy;
        if (Math.abs(st.acc) < 48) return;   // tiny movements never launch the plane
        st.acc = 0;
        go(to);
      }, { passive: false });
    }
  })();

  /* ABOUT ME (Home) — a margin note comes alive once: when the aerodrome lines arrive, a small paper
     airplane enters along one short curve, crosses above them and settles. Never a second aerodrome. */
  (function () {
    var note = document.querySelector('.mplane');
    if (!note) return;
    var route = note.querySelector('.mp-route'), craft = note.querySelector('.mp-plane'), L = route.getTotalLength();
    function at(k, rot) {
      var d = L * k, p = route.getPointAtLength(d), a = route.getPointAtLength(Math.max(0, d - 1)), b = route.getPointAtLength(Math.min(L, d + 1));
      var nose = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      craft.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') rotate(' + (nose * rot).toFixed(1) + ')');
    }
    if (reduce || !('IntersectionObserver' in window)) { route.style.strokeDashoffset = '0'; at(1, 0); note.classList.add('done'); return; }
    note.classList.add('armed');
    at(0, 1);
    var io = new IntersectionObserver(function (rows) {
      if (!rows[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now(), easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
      (function f(now) {
        var t = now - t0, draw = clamp01(t / 420), k = clamp01((t - 300) / 1100);
        route.style.strokeDashoffset = (1 - easeOut(draw)).toFixed(3);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        craft.style.opacity = Math.min(1, k * 6).toFixed(2);
        at(e, 1 - easeOut(clamp01((t - 1400) / 260)));
        if (t < 1700) { requestAnimationFrame(f); return; }
        note.classList.add('done');
      })(t0);
    }, { threshold: 0.6 });
    io.observe(note);
  })();

  /* ABOUT — a quiet scroll cue under the first composition: it appears once the page has settled, its
     line extends once, and it leaves for good when the reader starts scrolling. */
  (function () {
    var cue = document.querySelector('.scroll-cue');
    if (!cue || window.scrollY > 40) return;
    // on narrow screens a fixed cue would sit on the words beneath the photograph: it rests under the photo instead
    var photo = document.querySelector('.me-photo');
    if (photo && window.matchMedia('(max-width: 820px)').matches) { photo.appendChild(cue); cue.classList.add('inline'); }
    var t0 = performance.now();
    (function f(now) { if (now - t0 < 1100) { requestAnimationFrame(f); return; } if (window.scrollY <= 40) cue.classList.add('on'); })(t0);
    function off() { if (window.scrollY > 40) { cue.classList.remove('on'); cue.classList.add('gone'); window.removeEventListener('scroll', off); } }
    window.addEventListener('scroll', off, { passive: true });
  })();

  /* ABOUT ME (Home) — the three-name index beside the lines leans in, slightly, while its story is read */
  (function () {
    var list = document.querySelector('.meet .facts-list');
    if (!list || !('IntersectionObserver' in window)) return;
    var labels = [].slice.call(list.querySelectorAll('.label')), parts = [].slice.call(document.querySelectorAll('.meet [data-ix]'));
    if (!parts.length) return;
    list.classList.add('armed');
    var seen = {};
    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) { seen[r.target.dataset.ix] = r.isIntersecting; });
      var cur = -1;
      parts.forEach(function (p) { if (seen[p.dataset.ix]) cur = +p.dataset.ix; });
      labels.forEach(function (l, k) { l.classList.toggle('cur', k === cur); });
    }, { rootMargin: '-35% 0px -35% 0px' });
    parts.forEach(function (p) { io.observe(p); });
  })();

  var nav = document.querySelector('nav.topbar');
  var onNav = function () { nav && nav.classList.toggle('scrolled', window.scrollY > 24); };
  onNav(); window.addEventListener('scroll', onNav, { passive: true });

  /* ================= LANGUAGE =================
     English ships in the markup; Spanish rides in data attributes.
       data-es        textContent       data-es-html   innerHTML
       data-es-aria   aria-label        data-es-alt    alt
       data-es-content  <meta content>
     One switch moves the whole page and its head. The choice lives in the
     URL (?lang=es) and is carried to every internal link, never in storage. */
  var lang = 'en';

  function swap(sel, read, write) {
    each(sel, function (el) {
      var k = '__en' + sel;
      if (el[k] === undefined) el[k] = read(el);
      write(el, lang === 'es' ? el.getAttribute(sel.slice(1, -1)) : el[k]);
    });
  }

  function applyLang(next) {
    lang = next === 'es' ? 'es' : 'en';
    root.setAttribute('lang', lang);
    swap('[data-es-html]', function (e) { return e.innerHTML; }, function (e, v) { e.innerHTML = v; });
    swap('[data-es]', function (e) { return e.textContent; }, function (e, v) { e.textContent = v; });
    swap('[data-es-aria]', function (e) { return e.getAttribute('aria-label') || ''; }, function (e, v) { e.setAttribute('aria-label', v); });
    swap('[data-es-alt]', function (e) { return e.getAttribute('alt') || ''; }, function (e, v) { e.setAttribute('alt', v); });
    swap('[data-es-content]', function (e) { return e.getAttribute('content') || ''; }, function (e, v) { e.setAttribute('content', v); });

    each('.lang-b', function (b) {
      var on = b.dataset.lang === lang;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var q = lang === 'es' ? '?lang=es' : '';
    each('meta[property="og:locale"]', function (m) { m.setAttribute('content', lang === 'es' ? 'es_CO' : 'en_US'); });
    each('link[rel="canonical"],meta[property="og:url"]', function (el) {
      var attr = el.tagName === 'LINK' ? 'href' : 'content';
      if (!el.dataset.base) el.dataset.base = el.getAttribute(attr);
      el.setAttribute(attr, el.dataset.base + q);
    });
    each('a[data-page]', function (a) {
      if (!a.dataset.base) a.dataset.base = a.getAttribute('href');
      a.setAttribute('href', a.dataset.base + q);
    });
    onLang.forEach(function (fn) { fn(); });

    var url = new URL(location.href);
    if (lang === 'en') url.searchParams.delete('lang'); else url.searchParams.set('lang', 'es');
    history.replaceState(null, '', url);
  }

  /* a button whose label depends on its state and the language */
  function stateLabel(btn, state) {
    var k = state + (lang === 'es' ? 'Es' : 'En');
    var node = btn.childNodes[btn.childNodes.length - 1];
    if (btn.dataset[k] !== undefined) node.nodeValue = btn.dataset[k];
  }

  /* ================= THE INDEX ================= */
  var menub = document.querySelector('.menub');
  var panel = document.getElementById('index');
  var openNow = false;
  function setIndex(open, returnFocus) {
    openNow = open;
    panel.classList.toggle('on', open);
    menub.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('held', open);
    stateLabel(menub, open ? 'close' : 'open');
    if (open) { var f = panel.querySelector('a'); if (f) f.focus(); }
    else if (returnFocus) menub.focus();
  }
  if (menub && panel) {
    menub.addEventListener('click', function () { setIndex(!openNow, true); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setIndex(false, false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openNow) setIndex(false, true); });
    onLang.push(function () { stateLabel(menub, openNow ? 'close' : 'open'); });
  }
  each('.lang-b', function (b) { b.addEventListener('click', function () { applyLang(b.dataset.lang); }); });

  /* ================= THE DAYS — prints =================
     Every print is a small state machine with one timing table:
       idle → entering → blank → developing → developed → (playing → settling) → still
     Her ask (2026-09): like a Polaroid. The set's words arrive first, and a line-drawn instant camera
     sits above the prints. Each print is pushed out of its slot, blank; it is carried to its place with
     a small swing, and develops quickly on the way — dark green chemistry lifting into the photograph
     in under a second. It holds. Only a print with real footage then moves, once, inside the still
     paper, and settles on its last frame. Then the camera gives the next print.
     Only one moving memory plays at a time; footage loads near the screen and pauses off it.
     Reduced motion: every print already developed; no camera; footage only in the viewer, on request. */
  function prints() {
    var room = document.querySelector('.prints');
    if (!room) return;
    var sets = [].slice.call(room.querySelectorAll('[data-set]'));
    var all = [].slice.call(room.querySelectorAll('.print'));
    var viewer = room.querySelector('.viewer');
    var T = { lead: 480, eject: 820, pause: 140, move: 880, develop: 900, hold: 520, settle: 380 };   // ms
    var sm = function (a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    var easeInOut = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var playing = null;

    function state(p, s) { p.dataset.state = s; }
    // where this print rests, and where it leaves the camera — both in the set's own coordinates
    function geo(p) {
      var paper = p.querySelector('.paper'), box = p.parentNode, cam = box.querySelector('.cam');
      var rot = parseFloat(getComputedStyle(p).getPropertyValue('--rot')) || 0;
      var w = paper.offsetWidth, h = paper.offsetHeight;
      var cx = p.offsetLeft + paper.offsetLeft + w / 2, cy = p.offsetTop + paper.offsetTop + h / 2;
      var cr = cam && cam.getBoundingClientRect();
      if (!cr || cr.bottom < 0 || cr.width === 0) {   // no camera on screen (a long phone stack): it simply drops in
        return { sx: cx, sy: cy - h * 0.2, s: 0.86, w: w, h: h, cx: cx, cy: cy, rot: rot, swing: rot > 0 ? 5 : -5, lift: 16, noClip: true };
      }
      var br = box.getBoundingClientRect();
      return { sx: cr.left - br.left + cr.width / 2, sy: cr.top - br.top + cr.height * (98 / 120), s: Math.min(1, (cr.width * (88 / 160)) / w),
               w: w, h: h, cx: cx, cy: cy, rot: rot, swing: rot > 0 ? 7 : -7, lift: 30 };
    }
    // t: ms since this print began. Out of the slot, then carried to its place.
    function place(p, t) {
      var g = p._geo, paper = p.querySelector('.paper'), cap = p.querySelector('figcaption');
      var e = sm(0, 1, t / T.eject), m = easeInOut(clamp01((t - T.eject - T.pause) / T.move));
      if (cap) cap.style.opacity = sm(T.eject + T.pause + T.move * 0.6, T.eject + T.pause + T.move + 320, t).toFixed(3);
      if (m >= 1) { paper.style.transform = ''; paper.style.clipPath = ''; return; }
      var hs = g.h * g.s;
      var ty0 = g.noClip ? g.sy - g.cy : g.sy - hs + e * hs + hs / 2 - g.cy;   // the scaled print's centre, e of it out of the slot
      var tx = (g.sx - g.cx) * (1 - m), ty = ty0 * (1 - m) - Math.sin(Math.PI * m) * g.lift;
      var s = g.s + (1 - g.s) * m, r = -g.rot * (1 - m) + Math.sin(Math.PI * m) * g.swing;
      paper.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) rotate(' + r.toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
      paper.style.clipPath = g.noClip ? '' : (e < 1 ? 'inset(' + ((1 - e) * 100).toFixed(2) + '% 0 0 0)' : '');
      p.style.opacity = g.noClip ? Math.min(1, t / 240).toFixed(3) : '';
    }
    // d: how far the Polaroid has developed (0–1) — deep green lifting into the photograph
    function develop(p, d) {
      var img = p.querySelector('.dev'), pic = p.querySelector('.pic');
      var light = sm(0, 0.75, d), colour = sm(0.3, 1, d);
      img.style.opacity = d >= 1 ? '' : sm(0, 0.6, d).toFixed(3);
      img.style.filter = d >= 1 ? '' : 'brightness(' + (0.45 + 0.55 * light).toFixed(3) + ') saturate(' + (0.25 + 0.65 * colour).toFixed(3) + ') contrast(' + (0.7 + 0.28 * light).toFixed(3) + ')';
      pic.style.setProperty('--g', (0.18 + 0.2 * (1 - d)).toFixed(3));
    }
    function settle(p) {
      var paper = p.querySelector('.paper'), cap = p.querySelector('figcaption');
      paper.style.transform = ''; paper.style.clipPath = ''; paper.style.transition = ''; p.style.opacity = '';
      if (cap) cap.style.opacity = '';
    }
    function rest(p) { develop(p, 1); settle(p); state(p, 'still'); }

    function play(p, v, done) {
      if (!v.getAttribute('src')) v.src = v.dataset.src;
      if (playing && playing !== v) playing.pause();
      playing = v;
      state(p, 'playing');
      var finish = function () {
        v.removeEventListener('ended', finish);
        if (playing === v) playing = null;
        state(p, 'settling');
        var t0 = performance.now();
        (function f(now) {
          if (now - t0 < T.settle) { requestAnimationFrame(f); return; }
          p.classList.add('played'); state(p, 'still'); if (done) done();
        })(t0);
      };
      v.addEventListener('ended', finish);
      var go = v.play();
      if (go && go.catch) go.catch(finish);   // if the browser refuses to play, it simply stays a photograph
    }

    function run(p, delay, done) {
      var img = p.querySelector('.dev'), v = p.querySelector('video.memory'), paper = p.querySelector('.paper');
      var start = function () {
        var t0 = performance.now() + delay, dev0 = T.eject + T.pause + T.move * 0.45;   // it develops while it is carried
        (function frame(now) {
          var t = now - t0;
          if (t < 0) { requestAnimationFrame(frame); return; }
          if (p.dataset.state === 'idle') { p._geo = geo(p); paper.style.transition = 'none'; state(p, 'entering'); }
          var d = clamp01((t - dev0) / T.develop);
          place(p, t); develop(p, d);
          if (p.dataset.state === 'entering' && t >= T.eject) state(p, 'blank');
          if (p.dataset.state === 'blank' && d > 0) state(p, 'developing');
          if (d < 1) { requestAnimationFrame(frame); return; }
          if (p.dataset.state === 'developing') state(p, 'developed');
          if (t < dev0 + T.develop + T.hold) { requestAnimationFrame(frame); return; }
          settle(p);
          if (v) { play(p, v, done); return; }
          state(p, 'still'); if (done) done();
        })(performance.now());
      };
      // wait for the photograph itself, so it never develops out of an empty frame
      if (img.decode) img.decode().then(start, start); else start();
    }
    function runSet(el) {
      var list = [].slice.call(el.querySelectorAll('.print')), i = 0;
      el.classList.add('live');
      (function next() {
        if (i < list.length) run(list[i++], i === 1 ? T.lead : 160, next);
        else el.classList.add('shot');   // the last print is out: the camera leaves
      })();
    }

    // the viewer: the photograph alone; footage gets its own controls here
    function open(p) {
      var media = viewer.querySelector('.vmedia'), cap = viewer.querySelector('.vcap');
      var img = p.querySelector('.dev'), v = p.querySelector('video.memory');
      media.innerHTML = ''; cap.innerHTML = '';
      if (v) {
        var nv = document.createElement('video');
        nv.src = v.dataset.src; nv.poster = img.currentSrc || img.src; nv.controls = true; nv.playsInline = true; nv.muted = true;
        if (playing) playing.pause();
        media.appendChild(nv);
      } else {
        var ni = new Image(); ni.src = img.currentSrc || img.src; ni.alt = img.alt; media.appendChild(ni);
      }
      var fc = p.querySelector('figcaption').cloneNode(true);
      each('button', function (b) { b.remove(); }, fc);
      cap.appendChild(fc);
      if (viewer.showModal) viewer.showModal(); else viewer.setAttribute('open', '');
    }
    function close() {
      var nv = viewer.querySelector('video'); if (nv) nv.pause();
      if (viewer.close) viewer.close(); else viewer.removeAttribute('open');
    }
    if (viewer) {
      viewer.querySelector('.vclose').addEventListener('click', close);
      viewer.addEventListener('click', function (e) { if (e.target === viewer) close(); });
    }
    room.addEventListener('click', function (e) {
      var s = e.target.closest('.sound');
      if (s) {   // sound is always the reader's choice; asking for it plays the memory again, once
        var v = s.closest('.print').querySelector('video.memory');
        if (!v.getAttribute('src')) v.src = v.dataset.src;
        v.muted = !v.muted;
        s.setAttribute('aria-pressed', v.muted ? 'false' : 'true');
        if (!v.muted && (v.paused || v.ended)) { if (v.ended) v.currentTime = 0; if (playing && playing !== v) playing.pause(); playing = v; v.play().catch(function () {}); }
        return;
      }
      var paper = e.target.closest('.paper');
      if (paper && viewer) open(paper.closest('.print'));
    });

    if (reduce || !('IntersectionObserver' in window)) { all.forEach(rest); return; }
    room.classList.add('armed');
    all.forEach(function (p) { develop(p, 0); });

    var arrive = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) { if (r.isIntersecting) { arrive.unobserve(r.target); runSet(r.target); } });
    }, { rootMargin: '0px 0px -20% 0px', threshold: 0.25 });
    sets.forEach(function (s) { arrive.observe(s); });

    // footage: loaded only near the screen, paused whenever it leaves it
    [].forEach.call(room.querySelectorAll('video.memory'), function (v) {
      var p = v.closest('.print');
      new IntersectionObserver(function (rows) {
        var r = rows[0];
        if (r.isIntersecting) {
          if (!v.getAttribute('src')) { v.preload = 'metadata'; v.src = v.dataset.src; }
          if (p.dataset.state === 'playing' && v.paused && !v.ended) v.play().catch(function () {});
        } else if (!v.paused) v.pause();
      }, { rootMargin: '600px 0px 600px 0px' }).observe(p);
    });
  }
  prints();

  /* ================= INSIDE MY MIND =================
     The opening system comes apart into its parts as the reader scrolls — its shape follows the scroll,
     its names arrive as the parts separate. Each drawer's drawing plays once, the first time its drawer
     opens and the drawing is on screen: the words first, then the drawing, stage by stage (armed → s1 →
     s2 → s3), and then it holds. The closing system resolves once when it arrives, and goes quiet.
     Reduced motion: every drawing at its end. */
  function mind() {
    var opening = document.querySelector('.mind-open');
    if (!opening) return;
    var sm = function (a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    // a graph drawn between its tangled and resolved positions; edges bend as it relaxes
    function graph(svg) {
      var sag = +svg.dataset.sag || 10;
      var nodes = [].slice.call(svg.querySelectorAll('.gnode')).map(function (g) {
        return { g: g, a: [+g.dataset.ax, +g.dataset.ay], b: [+g.dataset.bx, +g.dataset.by] };
      });
      var edges = [].slice.call(svg.querySelectorAll('.ge')).map(function (e) { return { e: e, i: +e.dataset.i, j: +e.dataset.j }; });
      return function (k) {
        var pts = nodes.map(function (n) {
          var x = n.a[0] + (n.b[0] - n.a[0]) * k, y = n.a[1] + (n.b[1] - n.a[1]) * k;
          n.g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
          return [x, y];
        });
        edges.forEach(function (ed) {
          var p = pts[ed.i], q = pts[ed.j], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, s = sag * k;
          ed.e.setAttribute('d', 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'Q' + ((p[0] + q[0]) / 2 - dy / L * s).toFixed(1) + ' ' +
            ((p[1] + q[1]) / 2 + dx / L * s).toFixed(1) + ' ' + q[0].toFixed(1) + ' ' + q[1].toFixed(1));
        });
      };
    }
    function after(ms, fn) { var t0 = performance.now(); (function f(now) { if (now - t0 < ms) { requestAnimationFrame(f); return; } fn(); })(t0); }
    function tween(ms, fn, done) {
      var t0 = performance.now();
      (function f(now) { var k = clamp01((now - t0) / ms); fn(k * k * (3 - 2 * k)); if (k < 1) requestAnimationFrame(f); else if (done) done(); })(t0);
    }
    var sys = opening.querySelector('.msys'), drawSys = graph(sys), track = opening.querySelector('.msys-track');
    var close = document.querySelector('.mind-close .msys'), drawClose = close && graph(close);
    var figs = [].slice.call(document.querySelectorAll('.mfig'));

    if (reduce || !('IntersectionObserver' in window)) {
      drawSys(1); sys.style.setProperty('--k', '1');
      if (drawClose) { drawClose(1); close.classList.add('quiet'); }
      figs.forEach(function (f) { f.classList.add('armed', 's1', 's2', 's3'); });
      return;
    }

    var queued = false;
    function onScroll() {
      queued = false;
      var r = track.getBoundingClientRect(), vh = window.innerHeight;
      var k = sm(0.08, 0.82, clamp01((vh * 0.3 - r.top) / Math.max(1, track.offsetHeight - vh * 0.75)));
      drawSys(k);
      sys.style.setProperty('--k', sm(0.6, 1, k).toFixed(3));
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    if (drawClose) {
      drawClose(0);
      close.style.setProperty('--k', '0');   // its names wait until the parts have separated, so they never sit on each other
      var seen = new IntersectionObserver(function (rows) {
        if (!rows[0].isIntersecting) return;
        seen.disconnect();
        tween(2400, function (k) { drawClose(k); close.style.setProperty('--k', sm(0.6, 1, k).toFixed(3)); }, function () { close.classList.add('quiet'); });
      }, { threshold: 0.45 });
      seen.observe(close);
    }

    function play(fig) {
      var steps = (fig.dataset.seq || '650,1400,1400').split(',').map(Number);
      var g = fig.querySelector('.mfig-graph'), draw = g && graph(g);
      if (draw) draw(0);
      fig.classList.add('armed');
      var io = new IntersectionObserver(function (rows) {
        if (!rows[0].isIntersecting) return;
        io.disconnect();
        after(steps[0], function () {
          fig.classList.add('s1');
          after(steps[1], function () {
            fig.classList.add('s2');
            after(steps[2], function () {
              fig.classList.add('s3');
              if (draw) tween(1400, draw);
            });
          });
        });
      }, { threshold: 0.45 });
      io.observe(fig);
    }
    [].forEach.call(document.querySelectorAll('.mdrawer'), function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open || d.dataset.played) return;
        d.dataset.played = '1';
        [].forEach.call(d.querySelectorAll('.mfig'), play);
      });
    });
  }
  mind();

  /* ================= THE PRACTICE =================
     Each drawing waits until its words have been read and it is on screen, then plays once
     (armed → s1 → s2 → s3) on a requestAnimationFrame clock, and holds. Reduced motion: at its end. */
  function practice() {
    var figs = [].slice.call(document.querySelectorAll('.pfig'));
    if (!figs.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      figs.forEach(function (f) { var n = (f.dataset.seq || '0,0,0').split(',').length; f.classList.add('armed'); for (var k = 1; k <= n; k++) f.classList.add('s' + k); });
      return;
    }
    function after(ms, fn) { var t0 = performance.now(); (function f(now) { if (now - t0 < ms) { requestAnimationFrame(f); return; } fn(); })(t0); }
    figs.forEach(function (fig) {
      var steps = (fig.dataset.seq || '700,1300,1300').split(',').map(Number);   // one pause per stage: s1, s2, s3 … (a subdivision has eight)
      fig.classList.add('armed');
      var io = new IntersectionObserver(function (rows) {
        if (!rows[0].isIntersecting) return;
        io.disconnect();
        (function next(k) { if (k < steps.length) after(steps[k], function () { fig.classList.add('s' + (k + 1)); next(k + 1); }); })(0);
      }, { threshold: 0.4 });
      io.observe(fig);
    });
  }
  practice();

  /* ================= DRAWING LABELS ON NARROW SCREENS =================
     Her typography rule: text is never shrunk to fit a drawing. A line drawing scales with its column, so on a
     phone its labels can fall under 12px or run into each other. When that would happen the drawing keeps its
     lines and its labels move into a key beneath it — in the drawing's own order, arriving with the stage they
     belong to. Measured, never guessed: re-checked whenever a drawing's width changes and once fonts load. */
  function figureKeys() {
    var svgs = [].slice.call(document.querySelectorAll('svg.mfig-svg, svg.msys, figure.sfig svg'));
    if (!svgs.length) return;
    var LABEL = 'text.gl, text.pn, text.pv';
    var items = svgs.map(function (svg) {
      var labels = [].slice.call(svg.querySelectorAll(LABEL));
      if (!labels.length || !svg.viewBox || !svg.viewBox.baseVal || !svg.viewBox.baseVal.width) return null;
      var key = document.createElement('ol'), seen = {};
      key.className = 'figkey'; key.hidden = true; key.setAttribute('aria-hidden', 'true');
      labels.forEach(function (t) {
        var words = (t.textContent || '').trim();
        if (words.length < 3 || seen[words]) return;
        seen[words] = 1;
        var li = document.createElement('li'), g = t.closest('g[class]'), m = null;
        for (var e = t.parentNode; e && e !== svg && !m; e = e.parentNode) m = (e.getAttribute && (e.getAttribute('class') || '').match(/(?:^|\s)st(\d)(?:\s|$)/));
        if (m) li.setAttribute('data-st', m[1]);
        li.textContent = words;
        ['es', 'esHtml'].forEach(function (k) { if (t.dataset[k]) li.dataset[k] = t.dataset[k]; });
        key.appendChild(li);
      });
      // the key reads in the drawing's own order: its stages first, then anything unstaged, as drawn
      [].slice.call(key.children).map(function (li, i) { return { li: li, st: +(li.getAttribute('data-st') || 99), i: i }; })
        .sort(function (x, y) { return x.st - y.st || x.i - y.i; }).forEach(function (o) { key.appendChild(o.li); });
      svg.parentNode.insertBefore(key, svg.nextSibling);
      return { svg: svg, key: key, labels: labels };
    }).filter(Boolean);
    function measure() {
      items.forEach(function (it) {
        var w = it.svg.getBoundingClientRect().width, vb = it.svg.viewBox.baseVal.width;
        var fs = Math.min.apply(null, it.labels.map(function (t) { return parseFloat(getComputedStyle(t).fontSize) || 99; }));   // the smallest label decides
        var px = fs * (w / vb);
        // phones and tablets: never under 12px. Wider screens keep the drawings as designed unless a label would fall under 9px
        var keyed = w > 0 && px < (window.innerWidth < 1024 ? 12 : 10);   // tablets in portrait count as small screens
        it.svg.classList.toggle('keyed', keyed);
        it.key.hidden = !keyed;
      });
    }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(measure); items.forEach(function (it) { ro.observe(it.svg); }); }
    else window.addEventListener('resize', measure);
  }
  figureKeys();

  applyLang(new URL(location.href).searchParams.get('lang') === 'es' ? 'es' : 'en');

  /* Everything below is motion for its own sake. Reduced motion stops here. */
  if (reduce) return;

  /* ================= PHOTOGRAPHS BREATHE =================
     Scale 1.00 → 1.04 across one viewport of scroll. Photographs only. */
  var pics = [].slice.call(document.querySelectorAll('.frame img'));
  function breathe() {
    var h = window.innerHeight;
    pics.forEach(function (img) {
      var r = img.parentNode.getBoundingClientRect();
      if (r.bottom < 0 || r.top > h) return;
      img.style.transform = 'scale(' + (1 + .04 * clamp01((h - r.top) / (h + r.height))).toFixed(4) + ')';
    });
  }

  /* ================= HOME — THE SPECIMEN =================
     The same seven strokes, three times over: the plant, the land, the
     building. Identical command signatures in every state, so the figure is
     interpolated number by number — the line is never replaced, only
     re-measured. A phrase lands for each part of the drawing. */
  var STATES = {
    flower: [
      'M100 108 C76 92 60 64 62 28 C82 44 98 72 100 108',
      'M100 108 C124 92 140 64 138 28 C118 44 102 72 100 108',
      'M72 52 C80 74 88 92 100 108',
      'M128 52 C120 74 112 92 100 108',
      'M100 110 C101 136 99 162 100 188',
      'M100 150 C84 140 66 138 54 130 C62 150 80 160 100 150',
      'M100 128 C116 120 132 118 144 112 C136 130 118 138 100 128'],
    plat: [
      'M44 158 C44 140 44 122 45 105 C45 88 46 70 46 52',
      'M156 150 C156 132 155 115 155 97 C155 79 154 61 154 44',
      'M80 50 C84 86 86 122 88 156',
      'M122 46 C120 82 118 118 116 152',
      'M44 158 C81 155 118 152 156 150',
      'M54 104 C74 114 98 116 118 108 C132 102 144 94 152 84',
      'M46 52 C64 50 82 49 100 48 C118 47 136 45 154 44'],
    elevation: [
      'M44 160 C44 146 44 131 44 116 C63 103 81 91 100 78',
      'M156 160 C156 146 156 131 156 116 C137 103 119 91 100 78',
      'M70 116 C70 131 70 146 70 160',
      'M130 116 C130 131 130 146 130 160',
      'M24 160 C68 160 112 160 176 160',
      'M86 160 C86 142 86 129 100 129 C114 129 114 142 114 160',
      'M44 116 C63 116 81 116 100 116 C119 116 137 116 156 116']
  };
  function parse(d) { return { tpl: d.split(/-?\d*\.?\d+/), nums: (d.match(/-?\d*\.?\d+/g) || []).map(Number) }; }
  var P = {}; for (var k in STATES) P[k] = STATES[k].map(parse);
  var ORDER = [0, 0, 2, 2, 5, 3, 1], SPAN = 0.62;   // outline, interior, stem last
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  function pathT(i, t) { return smooth(clamp01((t - ORDER[i] * ((1 - SPAN) / 5)) / SPAN)); }
  function build(A, B, t) {
    var out = '';
    for (var i = 0; i < A.tpl.length; i++) {
      out += A.tpl[i];
      if (i < A.nums.length) out += (A.nums[i] + (B.nums[i] - A.nums[i]) * t).toFixed(2);
    }
    return out;
  }

  var morph = document.querySelector('.hero');
  var paths = morph ? [].slice.call(morph.querySelectorAll('.figure path')) : [];
  var phrases = morph ? [].slice.call(morph.querySelectorAll('.phrases p')) : [];
  var states = morph ? [].slice.call(morph.querySelectorAll('.states span')) : [];
  var stage = morph && morph.querySelector('.stage');
  var specimen = morph && morph.querySelector('.specimen');
  var RIDE = 0.72;               // the stage travels down at 72% of the scroll: it goes with the reader
  var HOLD = 0.10, END = 0.82;   // a breath on the flower; the house lands just before the stage does
  var lastT = -1, heroT = 0, heroOut = false;

  function lightList(list, n) { list.forEach(function (el, i) { el.classList.toggle('on', i === n); }); }
  function morphTick() {
    if (!morph) return;
    var travel = morph.offsetHeight - window.innerHeight;
    var top = -morph.getBoundingClientRect().top;
    var ride = travel > 4 ? Math.max(0, Math.min(top * RIDE, travel)) : 0;
    stage.style.setProperty('--ride', ride.toFixed(1) + 'px');
    var p = travel > 4 ? clamp01(top * RIDE / travel) : 0;
    var t = clamp01((p - HOLD) / (END - HOLD));
    heroT = t; heroOut = morph.getBoundingClientRect().bottom < window.innerHeight * 0.55;
    stage.style.setProperty('--survey', String(1 - clamp01((p - 0.06) / 0.1)));
    // 0 her and the flower · 1 vision · 2 the land · 3 the house rising · 4 the house
    var n = p < HOLD ? 0 : t < 0.25 ? 1 : t < 0.62 ? 2 : t < 1 ? 3 : 4;
    lightList(phrases, n);
    lightList(states, n === 0 ? 0 : t < 0.25 ? 1 : t < 0.75 ? 2 : 3);
    if (Math.abs(t - lastT) < 0.002) return;
    lastT = t;
    var A, B, u;
    if (t < 0.5) { A = P.flower; B = P.plat; u = t / 0.5; }
    else { A = P.plat; B = P.elevation; u = (t - 0.5) / 0.5; }
    for (var i = 0; i < paths.length; i++) paths[i].setAttribute('d', build(A[i], B[i], pathT(i, u)));
  }

  /* ================= THE GUIDE =================
     The colibrí flies beside the drawing while it changes, then leads the eye
     to the next heading marked data-guide. Eased toward its target each frame,
     and still once it arrives: it only moves because the reader moved. */
  var guide = document.querySelector('.guide');
  var targets = [].slice.call(document.querySelectorAll('[data-guide]'));
  var gx = null, gy = 0, gv = 0, graf = null, guideReady = false;
  function aim() {
    var h = window.innerHeight;
    if (morph && specimen && !heroOut) {
      var r = specimen.getBoundingClientRect();
      return { x: r.right + 12 + heroT * 48, y: r.top + r.height * (0.02 + 0.5 * heroT), vis: 1, paper: false };
    }
    var best = null, bd = Infinity;
    targets.forEach(function (el) {
      var q = el.getBoundingClientRect();
      if (q.bottom < 0 || q.top > h) return;
      var d = Math.abs(q.top - h * 0.35);
      if (d < bd) { bd = d; best = { q: q, el: el }; }
    });
    if (!best) return { x: gx || 0, y: gy, vis: 0, paper: false };
    var w = guide.getBoundingClientRect().width;
    return { x: Math.min(best.q.left + Math.min(best.q.width, 380) + 12, window.innerWidth - w - 12),
             y: best.q.top - w * 0.6, vis: 1, paper: !!best.el.closest('.paper') };
  }
  function guideTick() {
    graf = null;
    var a = aim();
    if (gx === null) { gx = a.x; gy = a.y; }
    var dx = a.x - gx, dy = a.y - gy, want = guideReady ? a.vis : 0;
    gx += dx * 0.07; gy += dy * 0.07; gv += (want - gv) * 0.08;
    var tilt = Math.max(-16, Math.min(16, dy * 0.06));
    guide.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0) rotate(' + tilt.toFixed(1) + 'deg)';
    guide.style.opacity = (gv * 0.9).toFixed(3);
    guide.classList.toggle('on-paper', a.paper);
    if (Math.abs(dx) + Math.abs(dy) > 0.5 || Math.abs(want - gv) > 0.01) graf = requestAnimationFrame(guideTick);
  }
  function kickGuide() { if (guide && !graf) graf = requestAnimationFrame(guideTick); }
  if (guide) setTimeout(function () { guideReady = true; kickGuide(); }, 1500);   // after the flower has drawn

  var ticking = false;
  function tick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; morphTick(); breathe(); kickGuide(); });
  }
  tick();
  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', function () { lastT = -1; tick(); }, { passive: true });
})();

// THE WORK — one piece of land as the spine of the page. The scroll through .ws-track is the
// story's timeline (0 → 1): each cue knows when it arrives (data-at) and leaves (data-out), and the
// same number is posted into the film, which draws what answers it. Reduced motion: no long track,
// still stages with Previous / Next, and the film jumps instead of gliding.
(function () {
  var ws = document.querySelector('.ws');
  if (!ws) return;
  var track = ws.querySelector('.ws-track'), frame = ws.querySelector('.ws-film'), cover = ws.querySelector('.ws-cover');
  var groups = [].slice.call(ws.querySelectorAll('.ws-group'));
  var lines = [].slice.call(ws.querySelectorAll('.ws-line'));
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var more = ws.querySelector('.ws-more');   // "keep scrolling": the stepped version has its own buttons
  var scrim = ws.querySelector('.ws-scrim');
  var nexts = more ? [].slice.call(more.querySelectorAll('[data-from]')) : [];   // what is about to happen (her ask)
  if (more && still) more.style.display = 'none';
  var p = 0, last = -1, queued = false, stage = 0;
  var c0 = +cover.dataset.from, c1 = +cover.dataset.to;
  function clamp01(x) { return Math.min(1, Math.max(0, x)); }
  function lang() { return (document.documentElement.getAttribute('lang') || 'en').indexOf('es') === 0 ? 'es' : 'en'; }
  function post(force) {
    if (!frame || !frame.contentWindow) return;
    if (!force && Math.abs(p - last) < 1e-4) return;
    last = p;
    frame.contentWindow.postMessage({ type: 'ftl:p', p: p, lang: lang(), still: still }, window.location.origin);
  }
  function paint() {
    if (still) {
      groups.forEach(function (g, i) {
        [].forEach.call(g.querySelectorAll('.ws-line'), function (el) { el.classList.toggle('on', i === stage); });
      });
    } else {
      lines.forEach(function (el) { el.classList.toggle('on', p >= +el.dataset.at && p < +el.dataset.out); });
    }
    var t = clamp01((p - c0) / (c1 - c0));
    cover.style.opacity = (1 - t * t * (3 - 2 * t)).toFixed(3);
    // the reading shade has no words to hold up once the film turns green
    if (scrim) { var s = clamp01((p - 0.88) / 0.03); scrim.style.opacity = (1 - s * s * (3 - 2 * s)).toFixed(3); }
    if (more && !still) {
      more.style.setProperty('--p', Math.min(1, p / 0.9).toFixed(3));
      more.classList.toggle('done', p > 0.9);   // it leaves as the film settles into its last line
      var passed = 0, cur = null;
      groups.forEach(function (g) { if (+g.dataset.p <= p) passed++; });
      nexts.forEach(function (n) { if (+n.dataset.from <= passed) cur = n; });
      nexts.forEach(function (n) { n.classList.toggle('on', n === cur); });
    }
  }
  function measure() {
    var r = track.getBoundingClientRect(), run = track.offsetHeight - window.innerHeight;
    p = run > 0 ? clamp01(-r.top / run) : 0;
  }
  function tick() { queued = false; measure(); paint(); post(false); }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(tick); } }
  if (still) {
    var nav = ws.querySelector('.ws-steps');
    var prev = nav.querySelector('[data-step="prev"]'), next = nav.querySelector('[data-step="next"]'), count = nav.querySelector('.ws-count');
    var go = function (i) {
      stage = Math.max(0, Math.min(groups.length - 1, i));
      p = +groups[stage].dataset.p;
      count.textContent = (stage + 1) + ' / ' + groups.length;
      prev.disabled = stage === 0;
      next.disabled = stage === groups.length - 1;
      paint();
      post(true);
    };
    nav.hidden = false;
    prev.addEventListener('click', function () { go(stage - 1); });
    next.addEventListener('click', function () { go(stage + 1); });
    go(0);
  } else {
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', function () { last = -1; queue(); }, { passive: true });
    tick();
  }
  frame.addEventListener('load', function () { post(true); });
  // the film says when it has finished building, so a reader who is not scrolling still sees the right frame
  window.addEventListener('message', function (e) {
    if (e.origin === window.location.origin && e.source === frame.contentWindow && e.data && e.data.type === 'ftl:ready') post(true);
  });
  new MutationObserver(function () { post(true); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
