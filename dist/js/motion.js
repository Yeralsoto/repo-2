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
  // review only (?check): every scroll-driven update, callable at once — preview panes throttle animation frames
  var ticks = [];
  if (/[?&]check\b/.test(location.search)) window.__ticks = function () { ticks.forEach(function (t) { t(); }); };

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

  /* ABOUT — the paper airplane. Her note (2026-09-16): the page must never stop her scrolling. The flight is
     driven by the scroll, on every device: as the timeline crosses the screen — about one scroll gesture — the
     plane flies every leg in order, each destination coming into focus as it lands. Nothing takes over the
     wheel; scrolling back flies it back; a jump lands on the right finished state. Reduced motion: the whole
     route is drawn and the plane waits at the last milestone. After the last milestone the route continues
     faintly and dissolves: no destination, no label. */
  (function () {
    var flight = document.querySelector('.tl-flight');
    if (!flight) return;
    var box = flight.querySelector('.tl-scroll'), tl = box.querySelector('.tl'), svg = box.querySelector('.tl-route');
    var legsG = svg.querySelector('.tl-legs'), future = svg.querySelector('.tl-future'), plane = svg.querySelector('.tl-plane');
    var steps = [].slice.call(tl.querySelectorAll('.tl-step')), n = steps.length;
    var more = flight.querySelector('.tl-more'), nexts = more ? [].slice.call(more.querySelectorAll('[data-i]')) : [];
    var legs = [], pts = [], last = -1;
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
      var end = pts[n - 1];
      future.setAttribute('d', 'M' + end[0] + ' ' + y + 'q70 -30 160 -22');
      last = -1;
    }
    function put(x, y, deg) { plane.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + (y - 10).toFixed(1) + ') rotate(' + deg.toFixed(1) + ')'); }
    function follow(x) {   // a phone's strip keeps the plane in view
      if (box.scrollWidth <= box.clientWidth + 2) return;
      box.scrollLeft = Math.max(0, x - box.clientWidth * 0.5);
    }
    // focus: the destination is primary, where she came from stays legible, what follows stays quiet
    function focus(c) { steps.forEach(function (s, k) { s.classList.toggle('cur', k === c); s.classList.toggle('past', k < c); }); }

    // pos runs 0 … n-1 across the legs, then a little further for the dissolving line past today
    var TAIL = 0.8;
    function render(pos) {
      if (Math.abs(pos - last) < 0.0005) return;
      last = pos;
      var legPos = Math.min(pos, n - 1), i = Math.min(n - 2, Math.floor(legPos)), f = legPos - i;
      if (legPos >= n - 1) { i = n - 2; f = 1; }
      // each leg: its line draws first (information), then the plane flies it and levels as it lands
      var draw = easeOut(clamp01(f / 0.35)), fly = easeInOut(clamp01((f - 0.2) / 0.75));
      legs.forEach(function (l, k) { l.style.strokeDashoffset = k < i ? '0' : k > i ? '1' : (1 - draw).toFixed(3); });
      var L = legs[i].getTotalLength(), d = L * fly, p = legs[i].getPointAtLength(d);
      var a = legs[i].getPointAtLength(Math.max(0, d - 1.5)), b = legs[i].getPointAtLength(Math.min(L, d + 1.5));
      var nose = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      var level = fly <= 0 || fly >= 1 ? 1 : clamp01(Math.min(fly, 1 - fly) < 0.12 ? 1 - Math.min(fly, 1 - fly) / 0.12 : 0);
      put(p.x, p.y, nose * (1 - level));
      follow(p.x);
      var c = fly >= 0.85 ? i + 1 : i;
      focus(c);
      // the line under the timeline fills with the flight and names what is next (her ask: keep them scrolling)
      if (more) {
        more.style.setProperty('--p', clamp01(pos / (n - 1)).toFixed(3));
        nexts.forEach(function (x, k) { x.classList.toggle('on', k === Math.min(nexts.length - 1, c)); });
      }
      // past today: the route goes on a little, faintly, and dissolves
      var t = clamp01((pos - (n - 1)) / TAIL);
      future.style.strokeDashoffset = (1 - easeOut(clamp01(t / 0.5))).toFixed(3);
      future.style.opacity = t <= 0 ? '0' : (0.7 * (1 - clamp01((t - 0.45) / 0.55))).toFixed(3);
    }
    // the scroll that carries it: from the timeline entering the lower part of the screen to reaching its upper part
    function progress() {
      var r = box.getBoundingClientRect(), vh = window.innerHeight;
      var k = clamp01((vh * 0.9 - r.top) / (vh * 0.6));
      return k * (n - 1 + TAIL);
    }

    geometry();
    flight.classList.add('armed');
    if (reduce) {   // everything drawn, the plane at today
      render(n - 1);
      future.style.opacity = '0';
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { geometry(); render(n - 1); future.style.opacity = '0'; });
      return;
    }
    var queued = false;
    function tick() { queued = false; render(progress()); }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(tick); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', function () { geometry(); queue(); });
    // text first: the route is laid over the milestones as they actually wrap — again once fonts load and whenever the strip resizes
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { geometry(); tick(); });
    if ('ResizeObserver' in window) new ResizeObserver(function () { geometry(); queue(); }).observe(tl);
    ticks.push(tick);
    tick();
  })();

  /* ABOUT ME (Home) — a margin note comes alive: as the aerodrome lines scroll up, a small paper airplane
     draws its short curve and crosses above them, settling by the time they are read. Driven by the scroll
     (her ask: nothing makes the reader stop), never backwards. Never a second aerodrome. */
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
    var reached = 0, queued = false, easeOut = function (x) { return 1 - Math.pow(1 - x, 3); };
    function tick() {
      queued = false;
      var r = note.getBoundingClientRect(), vh = window.innerHeight;
      var k = clamp01((vh * 0.92 - r.top) / (vh * 0.45));   // from entering the screen to the upper half of it
      if (k <= reached) return;
      reached = k;
      route.style.strokeDashoffset = (1 - easeOut(clamp01(k / 0.45))).toFixed(3);
      var m = clamp01((k - 0.2) / 0.75), e = m < 0.5 ? 4 * m * m * m : 1 - Math.pow(-2 * m + 2, 3) / 2;
      craft.style.opacity = Math.min(1, m * 6).toFixed(2);
      at(e, 1 - easeOut(clamp01((k - 0.9) / 0.1)));
      if (k >= 1) note.classList.add('done');
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(tick); } }, { passive: true });
    ticks.push(tick);
    tick();
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
     Every print is a small state machine with one table of stages:
       idle → entering → blank → developing → developed → (playing → settling) → still
     Her ask (2026-09): like a Polaroid. A line-drawn instant camera sits above the prints. Each print is pushed
     out of its slot, blank; it is carried to its place with a small swing, and develops on the way — dark green
     chemistry lifting into the photograph. Her ask (2026-09-14): nothing makes the reader stop, so the arrival is
     driven by the scroll — one print after another as the set rises, finished while the reader keeps going, never
     backwards. Only a print with real footage then moves, once, inside the still paper, and settles on its last frame.
     Only one moving memory plays at a time; footage loads near the screen and pauses off it.
     Reduced motion: every print already developed; no camera; footage only in the viewer, on request. */
  function prints() {
    var room = document.querySelector('.prints');
    if (!room) return;
    var sets = [].slice.call(room.querySelectorAll('[data-set]'));
    var all = [].slice.call(room.querySelectorAll('.print'));
    var viewer = room.querySelector('.viewer');
    var T = { eject: 820, pause: 140, move: 880, develop: 900, settle: 380 };   // the arrival's own units; the scroll moves through them
    var sm = function (a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    var easeInOut = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var playing = null;

    function state(p, s) { p.dataset.state = s; }
    // her rule: a photograph never covers words. Prints may overlap each other; a caption that would sit under another
    // print is moved clear of it — or, when that print comes after it, the print moves down. Measured on the resting
    // layout (offsets, widened for each print's tilt), never on screen positions, so a print still flying out of the
    // camera can't mislead it. Again on resize, after fonts load, when a language changes and when a drawer opens.
    function clearWords(box) {
      if (box.offsetParent === null) return;   // inside a closed drawer: measured when it opens
      var ps = [].slice.call(box.querySelectorAll('.print'));
      ps.forEach(function (p) { p.style.marginTop = ''; p.querySelector('figcaption').style.marginTop = ''; });
      var rest = function (el, fig) {
        var x = fig.offsetLeft + el.offsetLeft, y = fig.offsetTop + el.offsetTop;
        var tilt = Math.abs(parseFloat(getComputedStyle(fig).getPropertyValue('--rot')) || 0) * Math.PI / 180;
        var grow = (el.offsetWidth * Math.sin(tilt)) / 2 + 4;
        return { x0: x - grow, x1: x + el.offsetWidth + grow, y0: y - grow, y1: y + el.offsetHeight + grow };
      };
      for (var pass = 0; pass < 8; pass++) {
        var moved = false;
        ps.forEach(function (p) {
          var cap = p.querySelector('figcaption');
          ps.forEach(function (q) {
            if (q === p) return;
            var c = rest(cap, p), r = rest(q.querySelector('.paper'), q), pad = 16;
            if (r.x0 < c.x1 + pad && r.x1 > c.x0 - pad && r.y0 < c.y1 + pad && r.y1 > c.y0 - pad) {
              if (r.y0 > c.y0) q.style.marginTop = (parseFloat(getComputedStyle(q).marginTop) + (c.y1 + pad - r.y0)).toFixed(1) + 'px';
              else cap.style.marginTop = (parseFloat(getComputedStyle(cap).marginTop) + (r.y1 + pad - c.y0)).toFixed(1) + 'px';
              moved = true;
            }
          });
        });
        if (!moved) break;
      }
    }
    function clearAll() { [].forEach.call(room.querySelectorAll('.dprints'), clearWords); }
    clearAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(clearAll);
    window.addEventListener('resize', clearAll);
    document.addEventListener('toggle', clearAll, true);
    onLang.push(clearAll);
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

    // one print at t along its arrival — t comes from the scroll, so the reader never waits for it
    var DEV0 = T.eject + T.pause + T.move * 0.45, TOTAL = DEV0 + T.develop;   // it develops while it is carried
    function frameAt(p, t) {
      var paper = p.querySelector('.paper');
      if (!p._geo) {
        p._geo = geo(p); paper.style.transition = 'none';
        var img = p.querySelector('.dev'); if (img.decode) img.decode().catch(function () {});
      }
      var d = clamp01((t - DEV0) / T.develop);
      place(p, t); develop(p, d);
      if (/^(playing|settling|still)$/.test(p.dataset.state || '')) return;
      var s = t <= 0 ? 'idle' : t < T.eject ? 'entering' : d <= 0 ? 'blank' : d < 1 ? 'developing' : 'developed';
      if (p.dataset.state === 'entering' && t >= T.eject) state(p, 'blank');
      if (p.dataset.state === 'blank' && d > 0) state(p, 'developing');
      if (d < 1) { if (p.dataset.state !== s) state(p, s); return; }
      if (p.dataset.state === 'developing' || p.dataset.state !== 'developed') state(p, 'developed');
      if (t < TOTAL) return;
      settle(p);
      var v = p.querySelector('video.memory');
      if (v && !p.classList.contains('played')) { play(p, v, null); return; }
      state(p, 'still');
    }
    // the scroll drives every set: prints in a row leave the camera one after another as the set rises; a phone's
    // stack follows each print's own place on the page. Finished by the upper part of the screen, never backwards.
    var queued = false;
    function tick() {
      queued = false;
      var vh = window.innerHeight;
      sets.forEach(function (set) {
        if (set._done) return;
        var box = set.querySelector('.dprints');
        if (!box || box.offsetParent === null) return;   // a closed drawer
        var ps = [].slice.call(box.querySelectorAll('.print')), top = box.getBoundingClientRect().top, all = true;
        ps.forEach(function (p, i) {
          var anchor = Math.max(top + i * vh * 0.16, top + p.offsetTop + p.querySelector('.paper').offsetTop);
          var k = clamp01((vh * 0.92 - anchor) / (vh * 0.38));
          if (k > (p._k || 0)) { p._k = k; frameAt(p, k * TOTAL); }
          if ((p._k || 0) < 1) all = false;
        });
        if ((ps[0]._k || 0) > 0) set.classList.add('live');
        if (all) { set.classList.add('shot'); set._done = true; }   // the last print is out: the camera leaves
      });
    }
    function queueTick() { if (!queued) { queued = true; requestAnimationFrame(tick); } }

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

    if (reduce) { all.forEach(rest); return; }
    room.classList.add('armed');
    all.forEach(function (p) { develop(p, 0); });
    clearAll();   // the camera's room above the prints has just been added
    window.addEventListener('scroll', queueTick, { passive: true });
    window.addEventListener('resize', function () { all.forEach(function (p) { if ((p._k || 0) < 1) p._geo = null; }); queueTick(); });
    document.addEventListener('toggle', queueTick, true);
    ticks.push(tick);
    tick();

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
     its names arrive as the parts separate. A drawer's drawing is driven by the scroll once its drawer is
     open (practice() below, stage by stage, never backwards). The closing system resolves as it scrolls
     into view — its names waiting until the parts have separated — and goes quiet.
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
    // a drawer drawing that is a graph relaxes during its last stage (driven in practice())
    [].forEach.call(document.querySelectorAll('figure.mfig .mfig-graph'), function (g) { var f = g.closest('figure'); f._graph = graph(g); f._graph(0); });
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
    ticks.push(onScroll);
    onScroll();

    if (drawClose) {
      drawClose(0);
      close.style.setProperty('--k', '0');   // its names wait until the parts have separated, so they never sit on each other
      var closed = 0, cq = false;
      var closeTick = function () {
        cq = false;
        var r = close.getBoundingClientRect(), vh = window.innerHeight;
        var k = clamp01((vh * 0.95 - r.top) / (vh * 0.6));   // resolved by the time it reaches the upper third
        if (k <= closed) return;
        closed = k;
        var e = k * k * (3 - 2 * k);
        drawClose(e);
        close.style.setProperty('--k', sm(0.6, 1, e).toFixed(3));
        if (k >= 1) close.classList.add('quiet');
      };
      window.addEventListener('scroll', function () { if (!cq) { cq = true; requestAnimationFrame(closeTick); } }, { passive: true });
      ticks.push(closeTick);
      closeTick();
    }
  }
  mind();

  /* ================= STAGED DRAWINGS (The Practice, Inside My Mind, The Journal) =================
     Her ask (2026-09-14): nothing makes the reader stop and wait. A drawing is driven by the scroll: it begins as
     it enters the screen, each stage (s1 … sN, as many as its data-seq lists) arrives as the reader keeps going,
     and it is complete by the time it reaches the upper part of the screen. It never runs backwards — a stage
     that has arrived stays — and a graph relaxes through the last stage. Reduced motion: every drawing at its end. */
  function practice() {
    var figs = [].slice.call(document.querySelectorAll('figure.mfig'));
    if (!figs.length) return;
    var stagesOf = function (f) { return (f.dataset.seq || '0,0,0').split(',').length; };
    if (reduce) {
      figs.forEach(function (f) { f.classList.add('armed'); for (var k = 1; k <= stagesOf(f); k++) f.classList.add('s' + k); if (f._graph) f._graph(1); });
      return;
    }
    figs.forEach(function (f) { f.classList.add('armed'); f._k = 0; });
    var queued = false;
    function tick() {
      queued = false;
      var vh = window.innerHeight;
      figs.forEach(function (f) {
        if (f._k >= 1) return;
        var r = f.getBoundingClientRect();
        if (!r.height) return;   // inside a closed drawer
        // below the fold: from entering the screen to its upper part. Already on screen at the top of the page (the
        // Burj Khalifa rising from the sand): the reader's own first scroll builds it.
        var pageTop = r.top + window.scrollY, startY = Math.max(0, pageTop - vh * 0.95);
        // a drawing with many stages can ask for more room (data-span), so each one is actually seen
        var span = (startY > 0 ? vh * 0.6 : vh * 0.5) * (parseFloat(f.dataset.span) || 1);
        var k = clamp01((window.scrollY - startY) / span);
        if (k <= f._k) return;
        f._k = k;
        var n = stagesOf(f), s = Math.min(n, Math.ceil(k * n));
        for (var i = 1; i <= s; i++) f.classList.add('s' + i);
        if (f._graph) f._graph(clamp01(k * n - (n - 1)));
      });
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(tick); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    document.addEventListener('toggle', queue, true);   // a drawer has opened
    ticks.push(tick);
    tick();
  }
  practice();

  /* ================= DRAWING LABELS ON SMALL SCREENS =================
     Her ask (2026-09-14): the names belong on the drawings — never moved into a list. When a drawing is too narrow for
     its labels, each label is set large enough to read (13px on screen) and kept inside the drawing; labels that would
     touch take turns. They are grouped into waves of names that never touch each other, and as the reader scrolls past
     the drawing the waves arrive one after another — one set of names leaves as the next appears — ending on the
     fullest wave. Wider screens keep the drawings exactly as designed. Re-measured on resize, after fonts load and when
     a drawer opens; the waves themselves follow the scroll. */
  function labelWaves() {
    var svgs = [].slice.call(document.querySelectorAll('svg.mfig-svg, svg.msys, figure.sfig svg'));
    var items = svgs.map(function (svg) {
      var labels = [].slice.call(svg.querySelectorAll('text.gl, text.pn, text.pv'));
      return labels.length && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? { svg: svg, labels: labels, order: null, cur: -1 } : null;
    }).filter(Boolean);
    if (!items.length) return;
    function place(it) {
      it.labels.forEach(function (t) { t.style.fontSize = ''; t.style.letterSpacing = ''; t.removeAttribute('transform'); t.classList.remove('wave-off'); });
      it.order = null; it.cur = -1; it.svg.classList.remove('waved');
      var w = it.svg.getBoundingClientRect().width, vb = it.svg.viewBox.baseVal;
      if (!w) return;   // inside a closed drawer
      var scale = w / vb.width;
      var fs = Math.min.apply(null, it.labels.map(function (t) { return parseFloat(getComputedStyle(t).fontSize) || 99; }));
      if (fs * scale >= (window.innerWidth < 1024 ? 12 : 10)) return;   // readable as designed
      var size = 13 / scale, pad = 8 / scale, gap = 10 / scale;
      it.labels.forEach(function (t) { t.style.fontSize = size.toFixed(1) + 'px'; t.style.letterSpacing = '0.1em'; });
      // each label's box where the drawing ends up: graphs at their resolved positions, groups at their translations
      var boxes = it.labels.map(function (t) {
        var bb = t.getBBox(), dx = 0, dy = 0;
        for (var e = t.parentNode; e && e !== it.svg; e = e.parentNode) {
          if (e.classList && e.classList.contains('gnode')) { dx += +e.dataset.bx || 0; dy += +e.dataset.by || 0; continue; }
          var m = e.getAttribute && (e.getAttribute('transform') || '').match(/translate\(\s*([-\d.]+)[ ,]+([-\d.]+)/);
          if (m) { dx += +m[1]; dy += +m[2]; }
        }
        var box = { x0: bb.x + dx, x1: bb.x + bb.width + dx, y0: bb.y + dy, y1: bb.y + bb.height + dy }, shift = 0;
        if (box.x0 < vb.x + pad) shift = vb.x + pad - box.x0;
        else if (box.x1 > vb.x + vb.width - pad) shift = vb.x + vb.width - pad - box.x1;
        if (shift) { t.setAttribute('transform', 'translate(' + shift.toFixed(1) + ' 0)'); box.x0 += shift; box.x1 += shift; }
        return box;
      });
      var waves = [];
      boxes.forEach(function (bx, i) {
        for (var k = 0; k < waves.length; k++) {
          var clear = waves[k].every(function (j) { var c = boxes[j]; return bx.x1 + gap < c.x0 || c.x1 + gap < bx.x0 || bx.y1 + gap < c.y0 || c.y1 + gap < bx.y0; });
          if (clear) { waves[k].push(i); return; }
        }
        waves.push([i]);
      });
      if (waves.length < 2) return;
      it.order = waves.sort(function (x, y) { return x.length - y.length; });   // the fullest wave arrives last and stays
      it.svg.classList.add('waved');
    }
    function show(it) {
      if (!it.order) return;
      var vh = window.innerHeight, k, track = it.svg.closest('.msys-track');
      if (track) {   // the opening system is held on screen while its track scrolls: its names take turns after the parts separate
        var tr = track.getBoundingClientRect();
        k = clamp01(((vh * 0.3 - tr.top) / Math.max(1, track.offsetHeight - vh * 0.75) - 0.55) / 0.4);
      } else {
        var r = it.svg.getBoundingClientRect();
        k = clamp01((vh * 0.9 - r.top) / Math.max(1, vh * 0.55 + r.height * 0.35));
      }
      var n = it.order.length, cur = Math.min(n - 1, Math.floor(k * n));
      if (cur === it.cur) return;
      it.cur = cur;
      it.labels.forEach(function (t, i) { t.classList.toggle('wave-off', it.order[cur].indexOf(i) < 0); });
    }
    function placeAll() { items.forEach(place); showAll(); }
    function showAll() { items.forEach(show); }
    var q1 = false, q2 = false;
    window.addEventListener('scroll', function () { if (!q1) { q1 = true; requestAnimationFrame(function () { q1 = false; showAll(); }); } }, { passive: true });
    window.addEventListener('resize', function () { if (!q2) { q2 = true; requestAnimationFrame(function () { q2 = false; placeAll(); }); } });
    document.addEventListener('toggle', function () { requestAnimationFrame(placeAll); }, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeAll);
    onLang.push(placeAll);
    ticks.push(showAll);
    placeAll();
  }
  labelWaves();

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
  // her note (2026-09-14): on a phone the stage seemed to struggle to follow the scroll. A stage moved by script always
  // runs a frame behind a touch scroll, so on touch screens the browser holds it instead (position: sticky, CSS)
  // and the script only turns the scroll into the drawing.
  var pinned = false;
  function measurePin() { pinned = !!(stage && getComputedStyle(stage).position === 'sticky'); }
  measurePin();

  function lightList(list, n) { list.forEach(function (el, i) { el.classList.toggle('on', i === n); }); }
  function morphTick() {
    if (!morph) return;
    var travel = morph.offsetHeight - window.innerHeight;
    var top = -morph.getBoundingClientRect().top;
    var p;
    if (pinned) p = travel > 4 ? clamp01(top / travel) : 0;
    else {
      var ride = travel > 4 ? Math.max(0, Math.min(top * RIDE, travel)) : 0;
      stage.style.setProperty('--ride', ride.toFixed(1) + 'px');
      p = travel > 4 ? clamp01(top * RIDE / travel) : 0;
    }
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
  window.addEventListener('resize', function () { lastT = -1; measurePin(); tick(); }, { passive: true });
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
