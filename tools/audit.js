/* Typography audit — a review tool, never loaded by the site. In the browser console (or the preview):
     var s = document.createElement('script'); s.src = '/tools/audit.js'; document.head.appendChild(s);
   then  __audit()  → { overlaps, crowded, overflow, tiny, hscroll }
   and   await __occlusion()  → text covered by something drawn on top of it (a photo, a print, a panel).
   Transitions and animations are frozen first, so nothing is measured half-faded. It measures every visible line
   of text (Range client rects, so wrapped lines count one by one): lines from different elements that intersect;
   drawing labels closer than 6px to each other (crowded); text that leaves the viewport horizontally outside an
   intentional sideways scroller; text under 12px (SVG labels at their on-screen size); page-level sideways scroll. */
(function () {
  function freeze() {
    if (!document.getElementById('audit-still')) {
      var st = document.createElement('style');
      st.id = 'audit-still';
      st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
      document.head.appendChild(st);
    }
    // the site scrolls smoothly; a measuring pass must jump, or it measures a page that has not moved yet
    document.documentElement.style.scrollBehavior = 'auto';
    void document.body.offsetHeight;
  }
  function visible(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  }
  function scroller(el) {
    for (var e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      var ox = getComputedStyle(e).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return e;
    }
    return null;
  }
  function name(el) {
    var c = (el.getAttribute('class') || '').toString().trim().split(/\s+/).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (c ? '.' + c : '') + ' "' + (el.textContent || '').trim().slice(0, 34) + '"';
  }
  var SKIP = 'script,style,noscript,.sr-only,nav.topbar,.index,.scroll-cue,.guide,title,desc,dialog:not([open])';
  function textLines(skip, onlyViewport) {
    var out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      var t = w.currentNode;
      if (!t.nodeValue.trim()) continue;
      var el = t.parentElement;
      if (!el || el.closest(skip) || !visible(el)) continue;
      var r = document.createRange(); r.selectNodeContents(t);
      [].slice.call(r.getClientRects()).forEach(function (q) {
        if (q.width <= 1 || q.height <= 1) return;
        if (onlyViewport && (q.bottom < 0 || q.top > window.innerHeight)) return;
        out.push({ el: el, q: q });
      });
    }
    return out;
  }
  window.__audit = function (opt) {
    opt = opt || {};
    freeze();
    document.querySelectorAll('[data-reveal]').forEach(function (e) { e.classList.add('in'); });
    var vw = document.documentElement.clientWidth, sy = window.scrollY, lines = [], tiny = {}, overflow = [];
    textLines(opt.skip || SKIP, false).forEach(function (o) {
      var el = o.el, q = o.q, fs = parseFloat(getComputedStyle(el).fontSize), svg = el.closest('svg');
      if (svg && svg.getScreenCTM && svg.getScreenCTM()) fs = fs * Math.abs(svg.getScreenCTM().a);
      if (fs < (opt.min || 12)) { var k = name(el).split(' "')[0]; tiny[k] = Math.min(tiny[k] || 99, Math.round(fs * 10) / 10); }
      if (!scroller(el) && (q.right > vw + 1 || q.left < -1)) overflow.push(name(el) + ' [' + Math.round(q.left) + '→' + Math.round(q.right) + ']');
      lines.push({ el: el, svg: !!svg, x0: q.left, x1: q.right, y0: q.top + sy, y1: q.bottom + sy });
    });
    var overlaps = [], crowded = [], seen = {};
    lines.sort(function (a, b) { return a.y0 - b.y0; });
    for (var i = 0; i < lines.length; i++) {
      var a = lines[i];
      for (var j = i + 1; j < lines.length && lines[j].y0 < a.y1 + 2; j++) {
        var b = lines[j];
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        var ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        var key = name(a.el) + ' ✕ ' + name(b.el);
        if (seen[key]) continue;
        if (ix > 2 && iy > 2) {
          var small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
          if ((ix * iy) / small >= 0.18) { seen[key] = 1; overlaps.push(key + ' @y' + Math.round(Math.max(a.y0, b.y0))); continue; }
        }
        // two labels in the same drawing, on the same line, with almost no air between them
        if (a.svg && b.svg && iy > 4 && ix > -6) { seen[key] = 1; crowded.push(key + ' @y' + Math.round(Math.max(a.y0, b.y0))); }
      }
    }
    return { vw: vw, overlaps: overlaps.slice(0, opt.limit || 40), crowded: crowded.slice(0, 30), overflow: overflow.slice(0, 20), tiny: tiny,
             hscroll: document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth : false };
  };
  // walks the page a screen at a time and asks the browser what is really on top at the centre of each line of text
  window.__occlusion = async function (opt) {
    opt = opt || {};
    freeze();
    document.querySelectorAll('[data-reveal]').forEach(function (e) { e.classList.add('in'); });
    var frame = function () { return new Promise(function (r) { setTimeout(r, 60); }); };   // a timer, not rAF: previews throttle frames
    var nav = document.querySelector('nav.topbar'), navH = nav ? nav.getBoundingClientRect().height : 0;
    var ignore = 'nav.topbar, .ws-more, .scroll-cue, .guide, .index';
    var covered = [], seen = {}, H = document.documentElement.scrollHeight, step = Math.round(window.innerHeight * 0.7);
    for (var y = 0; y < H; y += step) {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      if (Math.abs(window.scrollY - Math.min(y, H - window.innerHeight)) > 4) { await frame(); }
      await frame();
      textLines(opt.skip || SKIP, true).forEach(function (o) {
        var el = o.q, cx = (el.left + el.right) / 2, cy = (el.top + el.bottom) / 2;
        if (cy < navH + 4 || cy > window.innerHeight - 2 || cx < 1 || cx > window.innerWidth - 1) return;
        if (getComputedStyle(o.el).pointerEvents === 'none') return;   // text that is deliberately not hit-testable (overlays)
        // the first thing actually painted above this point decides; transparent wrappers are looked through
        var stack = document.elementsFromPoint(cx, cy), hit = null;
        for (var k = 0; k < stack.length; k++) {
          var h = stack[k];
          if (h === o.el || o.el.contains(h) || h.contains(o.el)) { hit = h; break; }
          var cs = getComputedStyle(h);
          var painted = /^(IMG|VIDEO|CANVAS|svg|BUTTON)$/.test(h.tagName) || cs.backgroundImage !== 'none' ||
            (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
          if (painted) { hit = h; break; }
        }
        if (!hit || hit.closest(ignore)) return;
        if (hit === o.el || o.el.contains(hit) || hit.contains(o.el)) return;
        var key = name(o.el) + ' under ' + name(hit);
        if (seen[key]) return;
        seen[key] = 1;
        covered.push(key);
      });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return covered.slice(0, 40);
  };
})();
