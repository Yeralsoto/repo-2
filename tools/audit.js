/* Typography audit — a review tool, never loaded by the site. In the browser console (or the preview):
     var s = document.createElement('script'); s.src = '/tools/audit.js'; document.head.appendChild(s);
   then  __audit()  → { overlaps, overflow, tiny, hscroll }.
   It measures every visible line of text (Range client rects, so wrapped lines count one by one), after
   forcing reveal states on, and reports: text lines from different elements that intersect; text that
   leaves the viewport horizontally (outside an intentional sideways scroller); meaningful text below
   12px (16px for body copy on phones is checked separately); and page-level horizontal scroll. */
(function () {
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
  window.__audit = function (opt) {
    opt = opt || {};
    var skip = opt.skip || 'script,style,noscript,.sr-only,nav.topbar,.index,.scroll-cue,.guide,title,desc,dialog:not([open])';
    document.querySelectorAll('[data-reveal]').forEach(function (e) { e.classList.add('in'); });
    var vw = document.documentElement.clientWidth, sy = window.scrollY, lines = [], tiny = {}, overflow = [];
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      var t = w.currentNode;
      if (!t.nodeValue.trim()) continue;
      var el = t.parentElement;
      if (!el || el.closest(skip) || !visible(el)) continue;
      var r = document.createRange(); r.selectNodeContents(t);
      var rects = [].slice.call(r.getClientRects()).filter(function (q) { return q.width > 1 && q.height > 1; });
      if (!rects.length) continue;
      var fs = parseFloat(getComputedStyle(el).fontSize);
      var svg = el.closest('svg');
      if (svg) {   // SVG text: its on-screen size is the user-unit size times the drawing's scale
        var m = svg.getScreenCTM && svg.getScreenCTM();
        if (m) fs = fs * Math.abs(m.a);
      }
      if (fs < (opt.min || 12)) { var k = name(el).split(' "')[0]; tiny[k] = Math.min(tiny[k] || 99, Math.round(fs * 10) / 10); }
      var sc = scroller(el);
      rects.forEach(function (q) {
        if (!sc && (q.right > vw + 1 || q.left < -1)) overflow.push(name(el) + ' [' + Math.round(q.left) + '→' + Math.round(q.right) + ']');
        lines.push({ el: el, x0: q.left, x1: q.right, y0: q.top + sy, y1: q.bottom + sy });
      });
    }
    var overlaps = [], seen = {};
    lines.sort(function (a, b) { return a.y0 - b.y0; });
    for (var i = 0; i < lines.length; i++) {
      var a = lines[i];
      for (var j = i + 1; j < lines.length && lines[j].y0 < a.y1; j++) {
        var b = lines[j];
        if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        var ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ix <= 2 || iy <= 2) continue;
        var small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
        if ((ix * iy) / small < 0.18) continue;
        var key = name(a.el) + ' ✕ ' + name(b.el);
        if (seen[key]) continue;
        seen[key] = 1;
        overlaps.push(key + ' @y' + Math.round(Math.max(a.y0, b.y0)));
      }
    }
    return { vw: vw, overlaps: overlaps.slice(0, opt.limit || 40), overflow: overflow.slice(0, 20), tiny: tiny,
             hscroll: document.documentElement.scrollWidth > vw + 1 ? document.documentElement.scrollWidth : false };
  };
})();
