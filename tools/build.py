#!/usr/bin/env python3
"""Builds every page of yeraldinsoto.com from the copy in this file.

    python3 tools/build.py

Every string is written twice, English then Spanish, so no page can be half
translated. Output is plain static HTML: /index.html and /<page>/index.html,
plus sitemap.xml. Edit words here, never in the generated HTML.
"""
import html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from journal import ENTRIES
from story import HOOK, INTRO, STORY

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://yeraldinsoto.com/"

# Cache-busting: a short hash of the stylesheets and script, so a returning browser never runs
# yesterday's motion.js against today's pages. It changes only when those files change.
import hashlib
import math
def _asset_version():
    h = hashlib.sha1()
    for rel in ("css/tokens.css", "css/base.css", "css/components.css", "css/motion.css", "js/motion.js"):
        with open(os.path.join(ROOT, rel), "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:10]
V = _asset_version()

# The film (follow-the-line/) is ES modules importing each other by relative path, and a browser
# caches each one on its own — after an edit it once ran a stale growth.js against a fresh
# config.js. FV hashes every module and line.css; stamp_film() writes it into the film's importmap
# so each "./js/x.js" resolves to "./js/x.js?v=FV", and the modules only ever update together.
import json, re
FILM = os.path.join(ROOT, "follow-the-line")
FILM_MODULES = sorted(n for n in os.listdir(os.path.join(FILM, "js")) if n.endswith(".js"))
def _film_version():
    h = hashlib.sha1()
    for rel in [f"js/{n}" for n in FILM_MODULES] + ["line.css"]:
        h.update(rel.encode())
        with open(os.path.join(FILM, rel), "rb") as f:
            h.update(f.read())
    return h.hexdigest()[:10]
FV = _film_version()

def stamp_film():
    out = os.path.join(FILM, "index.html")
    src = open(out, encoding="utf-8").read()
    m = re.search(r'<script type="importmap">\s*(\{.*?\})\s*</script>', src, re.S)
    if not m:
        sys.exit("follow-the-line/index.html: importmap not found")
    imports = {k: v for k, v in json.loads(m.group(1))["imports"].items() if not k.startswith("./js/")}
    imports.update({f"./js/{n}": f"./js/{n}?v={FV}" for n in FILM_MODULES})
    new = src[:m.start(1)] + json.dumps({"imports": imports}, indent=2) + src[m.end(1):]
    for pat, rep in ((r'src="js/main\.js(?:\?v=\w+)?"', f'src="js/main.js?v={FV}"'),
                     (r'href="line\.css(?:\?v=\w+)?"', f'href="line.css?v={FV}"'),
                     (r'href="\.\./css/tokens\.css(?:\?v=\w+)?"', f'href="../css/tokens.css?v={V}"')):
        new, n = re.subn(pat, rep, new)
        if n != 1:
            sys.exit(f"follow-the-line/index.html: expected one match for {pat}, found {n}")
    if new != src:
        open(out, "w", encoding="utf-8").write(new)
    print("stamped follow-the-line/index.html", FV)
LINKEDIN = "https://www.linkedin.com/in/yeraldin-soto-c-619761235/"
EMAIL = "yeraldinsotocastro@gmail.com"

# ---------------------------------------------------------------- helpers
CUR = ' aria-current="page"'
PRINTSID = ' id="prints-t"'
def A(s): return html.escape(s, quote=True)
def H(s): return html.escape(s, quote=False).replace("′", '<span class="pr">′</span>')

def tx(tag, en, es, cls="", extra=""):
    """A translatable element. Uses data-es-html only where markup differs."""
    c = f' class="{cls}"' if cls else ""
    en, es = en.replace("′ N", "′\u00a0N"), es.replace("′ N", "′\u00a0N")   # 6°15′ N never breaks
    if "′" in en + es:
        return f'<{tag}{c}{extra} data-es-html="{A(H(es))}">{H(en)}</{tag}>'
    return f'<{tag}{c}{extra} data-es="{A(es)}">{html.escape(en, quote=False)}</{tag}>'

def hook(en, es):
    stop = '<span class="stop">.</span>'
    return (f'<h1 class="hook" data-reveal data-es-html="{A(H(es[:-1]) + stop)}">'
            f'{H(en[:-1])}{stop}</h1>')

def label(facts, name=None, reveal=True):
    n = tx("span", *name, cls="name") if name else ""
    r = " data-reveal" if reveal else ""
    return f'<div class="label"{r}><span class="wipe"></span>{n}{tx("span", *facts, cls="caps facts")}</div>'

def img(src, alt, cls=""):
    return (f'<img src="{src}" alt="{A(alt[0])}" data-es-alt="{A(alt[1])}" '
            f'loading="lazy" decoding="async"{f" class={cls}" if cls else ""}>')

def frame(ratio, image=None, cls=""):
    if not image:
        return f'<div class="frame {ratio} empty {cls}" aria-hidden="true"></div>'
    return f'<div class="frame {ratio} {cls}">{image}</div>'

def prose(lines):
    return "".join(tx("p", en, es, cls="prose", extra=" data-reveal") for en, es in lines)

# ---------------------------------------------------------------- marks
FLOWER_BRAND = ('<path d="M60 90 C40 76 26 52 26 22 C45 35 58 62 60 90 Z"/>'
    '<path d="M60 90 C80 76 94 52 94 22 C75 35 62 62 60 90 Z"/>'
    '<path d="M42 46 L60 86"/><path d="M78 46 L60 86"/><path d="M60 86 L60 190"/>')
FLOWER_7 = ["M60 90 C40 76 26 52 26 22 C45 35 58 62 60 90 Z", "M60 90 C80 76 94 52 94 22 C75 35 62 62 60 90 Z",
    "M36 40 C40 66 50 84 60 90", "M84 40 C80 66 70 84 60 90", "M60 90 C61 124 59 158 60 192",
    "M60 124 C74 114 88 112 97 104 C90 122 75 131 60 124 Z", "M60 150 C46 140 32 138 23 130 C30 148 45 157 60 150 Z"]
COLIBRI = ["M4 36 L32 42", "M32 42 C40 33 54 31 66 36 C76 40 82 48 84 58", "M33 46 C40 55 52 60 64 58 C74 57 81 56 84 58",
    "M54 36 C58 20 68 8 82 3 C82 20 73 32 60 38", "M62 40 C72 27 86 18 101 15 C96 32 83 43 69 46",
    "M84 58 C93 65 100 74 106 85 C96 81 88 72 83 62", "M40 41 L40.5 41"]
def paths(ds): return "".join(f'<path pathLength="1" d="{d}"/>' for d in ds)

GUIDE = ('<svg class="guide" viewBox="0 0 120 88" fill="none" stroke="currentColor" stroke-width="1.5" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + "".join(f'<path d="{d}"/>' for d in COLIBRI) + '</svg>')

def colibri(cls="mark"):
    return (f'<svg class="{cls} draw rise" viewBox="0 0 120 88" fill="none" stroke="currentColor" stroke-width="1.25" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths(COLIBRI)}</svg>')

def flower_mark(cls="flower"):
    return (f'<svg class="{cls} draw" viewBox="0 0 120 200" fill="none" stroke="currentColor" stroke-width="3" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths(FLOWER_7)}</svg>')

def seal():
    return ('<svg class="seal draw" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true"><circle pathLength="1" cx="100" cy="100" r="90" stroke-width="1.2" opacity=".5"/>'
            '<g transform="translate(100 104) scale(0.62) translate(-60 -104)" stroke-width="1.9" class="draw in-group">'
            + paths(FLOWER_7) + '</g></svg>')

def horizon():
    ticks = "".join(f'<path class="tick" style="--i:{i}" pathLength="1" d="M{24 + i * 48} 40 L{24 + i * 48} 48"/>' for i in range(20))
    return ('<div class="wrap horizon draw"><svg viewBox="0 0 1000 120" preserveAspectRatio="none" fill="none" stroke="currentColor" '
            'stroke-width="1" aria-hidden="true">'
            '<path class="road" pathLength="1" vector-effect="non-scaling-stroke" d="M0 48 L1000 48"/>'
            + ticks.replace('d=', 'vector-effect="non-scaling-stroke" d=') +
            ''.join(f'<path class="lot" pathLength="1" vector-effect="non-scaling-stroke" d="M{x} 48 L{x} 120"/>' for x in (250, 550, 800))
            + '</svg></div>')

# ---------------------------------------------------------------- pages
PAGES = [  # slug, index numeral, (name en, es), (index facts en, es)
    # the reading order (her brief, 2026-09): enter the world, who she is, what she does, how she
    # reasons, what she keeps developing, the thoughts behind it, what she notices, an early project.
    # The Path was folded into About; path/ now only redirects there.
    ("", "I", ("Front", "Portada"), ("Yeraldin Soto · 2026", "Yeraldin Soto · 2026")),
    ("about", "II", ("About", "Sobre mí"), ("My story · 9 chapters", "Mi historia · 9 capítulos")),
    ("work", "III", ("The Work", "El trabajo"), ("Scout Land Group · 4 steps", "Scout Land Group · 4 pasos")),
    ("mind", "IV", ("Inside My Mind", "Dentro de mi mente"), ("6 drawers · How I reason", "6 cajones · Cómo razono")),
    ("practice", "V", ("The Practice", "La práctica"), ("Underwriting, markets, structure · 10 studies", "Análisis, mercados, estructura · 10 estudios")),
    ("journal", "VI", ("The Journal", "El diario"), ("19 entries · 2025–2026", "19 entradas · 2025–2026")),
    ("days", "VII", ("The Days", "Los días"), ("19 prints · 2025–2026", "19 copias · 2025–2026")),
    ("aerodrome", "VIII", ("The Aerodrome", "El aeródromo"), ("My thesis, block by block · 2022", "Mi tesis, bloque a bloque · 2022")),
]
NAME = {s: n for s, _, n, _ in PAGES}

def href(R, slug): return (R + slug + "/") if slug else (R or "./")

def next_link(R, slug, center=False):
    en, es = NAME[slug] if slug else ("Back to the beginning", "Volver al inicio")
    return (f'<a class="next" data-page href="{href(R, slug)}">{tx("span", "Next", "Siguiente", cls="caps")}'
            f'{tx("span", en, es, cls="nname")}<span class="wipe"></span></a>')

def rest(R, line, nxt, center=False, extra="", cls=""):
    c = (" center" if center else "") + (" " + cls if cls else "")
    link = next_link(R, nxt) if nxt is not None else ""
    return f'<section class="beat rest{c}"><div class="wrap">{extra}{tx("p", *line, cls="restline", extra=" data-reveal")}{link}</div></section>'

def turn(line, extra=""):
    return f'<section class="beat turn"><div class="wrap">{tx("p", *line, cls="turnline", extra=" data-reveal data-guide")}{extra}</div></section>'

def threshold(h, media, lab, wide=False):
    w = " wide" if wide else ""
    return (f'<section class="beat threshold"><div class="wrap"><div class="th{w}"><div>{hook(*h)}{label(lab)}</div>'
            f'<div data-reveal data-late>{media}</div></div></div></section>')

def detail(lines, media, lab_facts, lab_name, wide=False, cls=""):
    w = " wide" if wide else ""
    return (f'<section class="beat detail {cls}"><div class="wrap"><div class="d{w}"><div>{prose(lines)}</div>'
            f'<figure class="d-media" data-reveal data-late>{media}{label(lab_facts, lab_name, reveal=False)}</figure>'
            f'</div></div></section>')

# her ask (2026-09-14): a quiet ownership note and an invitation, in the footer only — never on the narrative
# pages. It claims only her original material ("unless otherwise credited": the thesis co-authors, proverbs and
# quotations, fonts, libraries). The address is the site's one EMAIL.
def owner_note():
    return (f'<div class="owner">'
            f'{tx("p", "© 2026 Yeraldin Soto", "© 2026 Yeraldin Soto", cls="owner-c")}'
            f'{tx("p", "Original copy, photography, illustrations, concepts and custom site content belong to Yeraldin Soto unless otherwise credited. Please do not reuse them without permission.", "Los textos, fotografías, ilustraciones, conceptos y el contenido propio del sitio pertenecen a Yeraldin Soto, salvo que se indique otro crédito. Por favor, no los reutilices sin permiso.", cls="owner-t")}'
            f'<p class="owner-ask">{tx("span", "Interested in creating a digital experience with this level of storytelling and interaction?", "¿Te interesa crear una experiencia digital con este nivel de narrativa e interacción?")} '
            f'<a href="mailto:{EMAIL}">{tx("span", "Email me for further inquiries.", "Escríbeme para más información.")}</a></p>'
            f'</div>')

def page(slug, title, desc, body, jsonld=""):
    depth = slug.count("/") + 1 if slug else 0   # journal entries live one level deeper: journal/<entry>/
    R = "../" * depth
    url = BASE + (slug + "/" if slug else "")
    top = slug.split("/")[0]
    idx = "".join(
        f'<a data-page href="{href(R, s)}"{CUR if s == top else ""}>'
        f'<span class="caps num">{num}</span>{tx("span", *n, cls="iname")}{tx("span", *f, cls="caps ifacts")}</a>'
        for s, num, n, f in PAGES)
    fnav = "".join(f'<a data-page href="{href(R, s)}">{tx("span", *n)}</a>' for s, _, n, _ in PAGES[1:])
    quick = "".join(f'<li><a data-page class="lnk caps" href="{href(R, s)}">{tx("span", *NAME[s])}</a></li>' for s in ("work", "days", "mind", "about"))
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{tx("title", *title)}
<meta name="description" content="{A(desc[0])}" data-es-content="{A(desc[1])}">
<meta name="author" content="Yeraldin Soto">
<meta name="theme-color" content="#1E4638">
<!-- generated by tools/build.py — edit the words there, not here -->
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{url}">
<link rel="alternate" hreflang="es" href="{url}?lang=es">
<link rel="alternate" hreflang="x-default" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Yeraldin Soto">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{A(title[0])}" data-es-content="{A(title[1])}">
<meta property="og:description" content="{A(desc[0])}" data-es-content="{A(desc[1])}">
<meta property="og:image" content="{BASE}assets/share.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{A(title[0])}" data-es-content="{A(title[1])}">
<meta name="twitter:description" content="{A(desc[0])}" data-es-content="{A(desc[1])}">
<meta name="twitter:image" content="{BASE}assets/share.jpg">
<link rel="icon" href="{R}assets/favicon.svg" type="image/svg+xml">
{jsonld}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400&display=swap">
<link rel="stylesheet" href="{R}css/tokens.css?v={V}">
<link rel="stylesheet" href="{R}css/base.css?v={V}">
<link rel="stylesheet" href="{R}css/components.css?v={V}">
<link rel="stylesheet" href="{R}css/motion.css?v={V}">
</head>
<body class="world">

<nav class="topbar">
  <div class="bar">
    <a data-page href="{href(R, "")}" class="brand">
      <svg width="15" height="25" viewBox="0 0 120 200" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{FLOWER_BRAND}</svg>
      <span>Yeraldin</span>
    </a>
    <ul class="quick">{quick}</ul>
    <div class="tools">
      <div class="lang caps" role="group" aria-label="Language" data-es-aria="Idioma">
        <button type="button" class="lang-b on" data-lang="en" aria-pressed="true">EN</button>
        <span class="sep" aria-hidden="true">·</span>
        <button type="button" class="lang-b" data-lang="es" aria-pressed="false">ES</button>
      </div>
      <button type="button" class="menub caps" aria-expanded="false" aria-controls="index"
              data-open-en="Index" data-open-es="Índice" data-close-en="Close" data-close-es="Cerrar"><span class="bars" aria-hidden="true"><i></i><i></i></span>Index</button>
    </div>
  </div>
</nav>

<div class="index world" id="index">
  <div class="wrap">
    {tx("p", "Index", "Índice", cls="caps ilabel")}
    <nav class="ilist" aria-label="Pages" data-es-aria="Páginas">{idx}</nav>
    <div class="ifoot">
      <a class="caps" href="{LINKEDIN}" rel="me noopener" target="_blank">LinkedIn</a>
      <a class="mail" href="mailto:{EMAIL}">{EMAIL}</a>
      {tx("span", "Yeraldin Soto · UTC−5", "Yeraldin Soto · UTC−5", cls="caps fine")}
    </div>
  </div>
</div>

<main>
{body}
</main>

<footer>
  <div class="wrap inner">
    <div class="mk">Yeraldin</div>
    {tx("p", "Words, drawings and photographs by Yeraldin Soto", "Palabras, dibujos y fotografías por Yeraldin Soto", cls="byline")}
    <nav class="fnav caps" aria-label="Pages" data-es-aria="Páginas">{fnav}</nav>
    <div class="flinks">
      <a class="li" href="{LINKEDIN}" rel="me noopener" target="_blank">LinkedIn</a>
      <a class="mail" href="mailto:{EMAIL}">{EMAIL}</a>
    </div>
    {owner_note()}
  </div>
</footer>

<script src="{R}js/motion.js?v={V}"></script>
</body>
</html>
"""


# ================================================================ HOME — below the hero, on Papel
def meet():
    p = lambda en, es, cls="": tx("p", en, es, cls=cls, extra=" data-reveal")
    # her iteration (2026-09-14): the scholarship is the reason for Bilbao; the aerodrome is mentioned, never taught
    # here (it lives on The Aerodrome), with the small paper airplane as a margin note. data-ix ties each part to the
    # name beside it in the index.
    mplane = ('<svg class="mplane" viewBox="0 0 420 80" fill="none" aria-hidden="true" focusable="false">'
              '<path class="mp-route" pathLength="1" d="M6 64C96 70 170 12 260 22S380 40 408 26"/>'
              f'<g class="mp-plane">{PAPER_PLANE}</g></svg>')
    bio_html = (
        '<div class="bio-part" data-ix="0">'
        + p("I’m Yeraldin Soto, a civil engineer. I lead development and underwriting at Scout Land Group.",
            "Soy Yeraldin Soto, ingeniera civil. Lidero desarrollo y análisis en Scout Land Group.")
        + '</div><div class="bio-part" data-ix="1">'
        + p("An international engineering scholarship took me to Bilbao for a year, to the University of the Basque Country.",
            "Una beca internacional de ingeniería me llevó a Bilbao por un año, a la Universidad del País Vasco.")
        + p("Engineering first. Then a culture, a language, and the English classes I also taught.",
            "Primero la ingeniería. Después una cultura, un idioma y las clases de inglés que también di.")
        + '</div><div class="bio-part bio-thesis" data-ix="2">' + mplane
        + p("Around that time, three of us started asking a question that made more than a few people in engineering wonder whether we could actually pull it off.",
            "Por esa época, tres de nosotros empezamos a hacernos una pregunta que hizo dudar a más de uno en ingeniería de si de verdad podríamos lograrlo.")
        + p("We wanted to design an aerodrome. Not a diagram of one.", "Queríamos diseñar un aeródromo. No el diagrama de uno.")
        + '<p class="bio-stack" data-reveal>' + "".join(tx("span", en, es) for en, es in [
            ("The runway.", "La pista."), ("The aircraft.", "El avión."), ("The pavement.", "El pavimento."),
            ("The drainage.", "El drenaje."), ("The movement around it.", "El movimiento a su alrededor.")]) + '</p>'
        + p("It became my civil engineering thesis.", "Se convirtió en mi tesis de ingeniería civil.")
        + p("It was probably one of the most debated projects in our cohort. It was also the one that kept surprising us.",
            "Probablemente fue uno de los proyectos más debatidos de nuestra promoción. También fue el que no dejaba de sorprendernos.")
        + '</div><div class="bio-part">'
        + p("Outside the work I press flowers, learn languages slowly, and take the long way out of the city.",
            "Fuera del trabajo prenso flores, aprendo idiomas despacio y salgo de la ciudad por el camino largo.")
        + p("I am learning to invest, and I love it: the market, and the potential I see in Colombia.",
            "Estoy aprendiendo a invertir, y me encanta: el mercado, y el potencial que veo en Colombia.")
        + p("And I will always say yes to a first coffee with someone new.", "Y siempre diré que sí a un primer café con alguien nuevo.")
        + '</div>')
    facts = [
        (("Scout Land Group", "Scout Land Group"), ("Development & underwriting · 2026", "Desarrollo y análisis · 2026")),
        (("University of the Basque Country", "Universidad del País Vasco"), ("Scholarship · Bilbao · 1 year", "Beca · Bilbao · 1 año")),
        (("The aerodrome", "El aeródromo"), ("Thesis · Domestic flights · 2020–2022", "Tesis · Vuelos nacionales · 2020–2022")),
    ]
    stop = '<span class="stop">.</span>'
    en, es = "I read land for a living. I photograph the rest.", "Leo la tierra para vivir. Lo demás, lo fotografío."
    more = next_link("", "about").replace(">Next<", ">More<").replace('data-es="Siguiente"', 'data-es="Más"')
    h = f'<h2 class="hook" data-reveal data-guide data-es-html="{A(H(es[:-1]) + stop)}">{H(en[:-1])}{stop}</h2>'
    return (f'<section class="beat paper meet" id="about-me"><div class="wrap">'
            f'{tx("div", "About me · 2026", "Sobre mí · 2026", cls="caps", extra=" data-reveal")}'
            f'<div class="m"><div>{h}<div class="bio">{bio_html}</div>'
            f'{more}</div>'
            f'<div class="facts-list">{"".join(label(fa, na) for na, fa in facts)}</div></div>'
            f'</div></section>')

PEEK = ["valley-dusk", "rome-colosseum-night", "salento-window", "pompeii-cat", "dubai-gulls", "jardin-botanico-orchids", "procida-harbour"]

def peek():
    byfile = {f[0]: f for f in FRAMES}
    items = ""
    for i, key in enumerate(PEEK):
        file, kind, code, place, month, num, *_rest, alt = byfile[key]
        country = "Türkiye" if code == "TÜRKIYE" else code.title()
        items += (f'<figure class="peek-item" data-reveal>{frame("r45", img("assets/photos/" + file + ".jpg", alt).replace(" draggable", ""))}'
                  f'{label((f"{country} · {month[0]}", f"{country} · {month[1]}"), place, reveal=False)}</figure>')
    n = len(FRAMES)
    end = (f'<a class="peek-end" data-page href="days/">{tx("span", f"All {n} frames", f"Los {n} fotogramas", cls="caps")}'
           f'{tx("span", "See the whole album", "Ver el álbum completo", cls="nname")}<span class="wipe"></span></a>')
    return (f'<section class="beat paper peek"><div class="wrap peek-head" data-reveal>'
            f'{tx("h2", "A few of my days", "Algunos de mis días", extra=" data-guide")}'
            f'{tx("span", f"A sneak peek · {len(PEEK)} of {n}", f"Un adelanto · {len(PEEK)} de {n}", cls="caps")}</div>'
            f'<div class="peek-row" tabindex="0" role="region" aria-label="A sneak peek of my photographs" data-es-aria="Un adelanto de mis fotografías">{items}{end}</div>'
            f'<div class="wrap">{tx("p", "Scroll sideways", "Desliza hacia el lado", cls="caps peek-hint")}</div></section>')

# ================================================================ HOME
def home():
    R = ""
    figure = ('<svg class="figure draw" viewBox="0 0 200 220" fill="none" stroke="currentColor" stroke-width="1.7" '
              'stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="A botanical specimen that becomes a land plat and then a building" '
              'data-es-aria="Un espécimen botánico que se convierte en un plano de tierra y luego en un edificio">'
              + paths(["M100 108 C76 92 60 64 62 28 C82 44 98 72 100 108", "M100 108 C124 92 140 64 138 28 C118 44 102 72 100 108",
                       "M72 52 C80 74 88 92 100 108", "M128 52 C120 74 112 92 100 108", "M100 110 C101 136 99 162 100 188",
                       "M100 150 C84 140 66 138 54 130 C62 150 80 160 100 150", "M100 128 C116 120 132 118 144 112 C136 130 118 138 100 128"])
              + '</svg>')
    survey = ('<svg class="survey draw" viewBox="0 0 200 220" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" '
              'stroke-linejoin="round" aria-hidden="true">'
              + paths(["M44 196 L44 218", "M156 196 L156 218", "M44 212 L156 212", "M52 207 L44 212 L52 217",
                       "M148 207 L156 212 L148 217", "M182 48 L182 16", "M176 26 L182 14 L188 26"]) + '</svg>')
    # vision: from land, to a dream, to a home — the orange full stop lands on the last line
    phrases = [
        ("Some people see dirt. I see what it is waiting to become.", "Algunos ven tierra. Yo veo lo que está esperando ser."),
        ("Vision is seeing the house while you are still standing in the field.", "Tener visión es ver la casa desde el campo vacío."),
        ("I draw the lines first. Roads, lots, water. A dream needs a map.", "Primero dibujo las líneas. Vías, lotes, agua. Un sueño necesita un mapa."),
        ("From land, to a plan, to someone’s dream.", "De la tierra, a un plano, al sueño de alguien."),
        ("Yesterday’s dirt is tomorrow’s dream house.", "La tierra de ayer es la casa soñada de mañana."),
    ]
    stop = '<span class="stop">.</span>'
    ph = ""
    last = len(phrases) - 1
    for i, (en, es) in enumerate(phrases):
        on = ' class="on"' if i == 0 else ""
        if i == last:
            ph += f'<p{on} data-es-html="{A(H(es[:-1]) + stop)}">{H(en[:-1])}{stop}</p>'
        else:
            ph += tx("p", en, es, cls="on" if i == 0 else "")
    st = "".join(tx("span", en, es, cls="on" if i == 0 else "") for i, (en, es) in enumerate(
        [("Yeraldin Soto · Land development · 2026", "Yeraldin Soto · Desarrollo de tierra · 2026"),
         ("Vision · 7 strokes", "Visión · 7 trazos"), ("Land · 7 strokes", "Tierra · 7 trazos"), ("Home · 7 strokes", "Hogar · 7 trazos")]))
    portrait = img("assets/portrait.jpg", ("Yeraldin Soto at her work table, a land plat and an orchid in front of her, botanical plates behind",
                                           "Yeraldin Soto en su mesa de trabajo, con un plano de tierra y una orquídea delante y láminas botánicas detrás"))
    portrait = portrait.replace(' loading="lazy"', ' loading="eager" fetchpriority="high"')
    body = (
        f'<header class="hero" id="top"><div class="stage">'
        f'<div class="field">{portrait}</div>'
        f'<div class="wrap inner"><div class="say">'
        f'<div class="specimen">{figure}{survey}</div>'
        f'<h1 class="wordmark">Yeraldin</h1><div class="hr"></div>'
        f'<div class="phrases">{ph}</div><div class="states caps">{st}</div>'
        f'</div></div></div></header>'
        + GUIDE
        + meet()
        + peek()
        + turn(("I have only ever drawn one line.", "Nunca he dibujado más que una línea."))
        + rest(R, ("The rest is in the drawers.", "Lo demás está en los cajones."), "work", center=True, extra=flower_mark(), cls="paper")
    )
    ld = """<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Yeraldin Soto",
  "url": "https://yeraldinsoto.com/",
  "image": "https://yeraldinsoto.com/assets/share.jpg",
  "jobTitle": "Director of Developments and Underwriting",
  "description": "Land development strategist and civil engineer at Scout Land Group.",
  "worksFor": { "@type": "Organization", "name": "Scout Land Group" },
  "alumniOf": [ { "@type": "CollegeOrUniversity", "name": "Universidad Cooperativa de Colombia" },
                { "@type": "CollegeOrUniversity", "name": "University of the Basque Country", "alternateName": "Universidad del País Vasco",
                "address": { "@type": "PostalAddress", "addressLocality": "Bilbao", "addressCountry": "ES" } } ],
  "email": "yeraldinsotocastro@gmail.com",
  "sameAs": [ "https://www.linkedin.com/in/yeraldin-soto-c-619761235/" ],
  "knowsLanguage": ["es", "en"],
  "knowsAbout": ["Land development", "Civil engineering", "Aerodrome design", "Land use planning"]
}
</script>"""
    return page("", ("Yeraldin Soto — Land Development Strategist", "Yeraldin Soto — Estratega de desarrollo de tierra"),
                ("Yeraldin Soto is a land development strategist and civil engineer at Scout Land Group. Land, drawings, photographs and a journal.",
                 "Yeraldin Soto es estratega de desarrollo de tierra e ingeniera civil en Scout Land Group. Tierra, dibujos, fotografías y un diario."),
                body, ld)

# ================================================================ THE WORK
# One piece of land is the spine of the page. The words are cues: each arrives a little before
# the film answers it, and never explains it while it happens. Positions are on the story's
# scroll, 0 → 1, and must stay in step with follow-the-line/js/config.js (WORK_T, the pictures).
#   group: (still-frame p for reduced motion, the group leaves at, css class, [(en, es, arrives at)])
WORK_STORY = [
    (0.012, 0.038, "open", [
        ("Before I underwrite the land, I underwrite the market.", "Antes de analizar la tierra, analizo el mercado.", 0.000),
        ("Where we look changes what becomes possible.", "Dónde miramos cambia lo que se vuelve posible.", 0.024)]),
    (0.080, 0.084, "", [
        ("Growth leaves evidence.", "El crecimiento deja evidencia.", 0.042),
        ("Not every market deserves the next question.", "No todo mercado merece la siguiente pregunta.", 0.062)]),
    (0.108, 0.113, "", [
        ("Then one piece of land asks for an answer.", "Entonces un terreno pide una respuesta.", 0.088)]),
    (0.158, 0.163, "", [
        ("Acreage is only the first number.", "El área es solo el primer número.", 0.117),
        ("The usable land is what survives the questions.", "La tierra útil es la que sobrevive a las preguntas.", 0.140)]),
    (0.192, 0.198, "", [
        ("The drawing still has to survive the rules.", "El dibujo todavía tiene que sobrevivir a las normas.", 0.167)]),
    (0.236, 0.238, "", [
        ("The first layout proves it can fit.", "El primer loteo demuestra que cabe.", 0.202),
        ("The next one has to make sense.", "El siguiente tiene que tener sentido.", 0.220)]),
    (0.290, 0.298, "", [
        ("Most deals work before the assumptions move.", "Casi todos los negocios funcionan antes de que se muevan los supuestos.", 0.242),
        ("I want to know what survives after they do.", "Quiero saber qué sobrevive cuando se mueven.", 0.278)]),
    (0.330, 0.338, "", [
        ("Nearby does not always mean comparable.", "Cerca no siempre significa comparable.", 0.302),
        ("The wrong comp can make a bad deal look reasonable.", "El comparable equivocado puede hacer que un mal negocio parezca razonable.", 0.320)]),
    # (the pass and the structure cycle were removed with their scenes — her ask, 2026-09-14)
    # (the partnership beat was removed with its diagram — her ask: no beat where nothing happens)
    (0.460, 0.463, "", [
        ("The analysis still has to become a conversation.", "El análisis todavía tiene que volverse una conversación.", 0.418),
        ("Someone has to carry the thesis across the table.", "Alguien tiene que llevar la tesis al otro lado de la mesa.", 0.442)]),
    (0.498, 0.505, "", [
        ("An executed contract is permission to look closer.", "Un contrato firmado es permiso para mirar más de cerca.", 0.467)]),
    # (the title and utility beats were removed with their diagrams; the survey staking plays without words)
    (0.562, 0.568, "", [
        ("The idea gets more precise as the risk gets smaller.", "La idea se vuelve más precisa a medida que el riesgo se achica.", 0.510),
        ("Entitlements are rarely a straight line.", "Los permisos rara vez son una línea recta.", 0.540)]),
    (0.630, 0.638, "", [
        ("The project is never one project.", "El proyecto nunca es un solo proyecto.", 0.602),
        ("It is several timelines sharing the same piece of land.", "Son varios cronogramas compartiendo el mismo terreno.", 0.616)]),
    (0.700, 0.718, "", [
        ("Eventually, every assumption becomes a scope.", "Tarde o temprano, cada supuesto se vuelve un alcance.", 0.642),
        ("Every scope becomes time and cost.", "Cada alcance se vuelve tiempo y costo.", 0.660),
        ("The plan matters most when reality changes it.", "El plan importa más cuando la realidad lo cambia.", 0.690)]),
    (0.740, 0.743, "", [
        ("Raw land becomes inventory when the lots are ready for the buyer’s vision.", "La tierra en bruto se vuelve inventario cuando los lotes están listos para la visión del comprador.", 0.722),
        ("We do not build the homes. We leave a builder-ready lot for the people who will.", "No construimos las casas. Dejamos un lote listo para quienes las van a construir.", 0.731)]),
    (0.780, 0.783, "", [
        ("The project is not complete because the road is finished.", "El proyecto no está terminado porque la vía se terminó.", 0.747),
        ("It is complete when the market takes it from us.", "Está terminado cuando el mercado nos lo toma.", 0.764)]),
    (0.814, 0.818, "", [
        ("The finished deal goes back into the next one.", "El negocio terminado vuelve al siguiente.", 0.787),
        ("Reality gets a vote.", "La realidad también vota.", 0.804)]),
    (0.846, 0.848, "", [
        ("The parcel was never the whole job.", "El terreno nunca fue todo el trabajo.", 0.822)]),
    (0.882, 0.884, "words", [
        ("Market.", "Mercado.", 0.852), ("Underwriting.", "Análisis.", 0.856), ("Structure.", "Estructura.", 0.860),
        ("Entitlements.", "Permisos.", 0.864), ("Development.", "Desarrollo.", 0.868), ("People.", "Personas.", 0.872),
        ("Execution.", "Ejecución.", 0.876), ("Capital.", "Capital.", 0.880)]),
    (0.900, 0.904, "open", [
        ("I work across the space between the first question and the finished lot.", "Trabajo en todo el espacio entre la primera pregunta y el lote terminado.", 0.888)]),
    (0.916, 0.920, "end", [
        ("It is easier to show you.", "Es más fácil mostrártelo.", 0.907)]),
    (1.000, 1.100, "proof", []),
]

# her ask: the keep-scrolling tab gives a reason to keep going — what is about to happen, one line per stretch
def more_next(items):
    return '<span class="ws-more-next">' + "".join(tx("span", en, es, extra=f' data-from="{round(f, 4)}"') for f, en, es in items) + '</span>'
WORK_NEXT = [   # from = how many story groups have been reached
    (0, "Up next · the land gets its first lines", "A continuación · el terreno recibe sus primeras líneas"),
    (3, "Up next · the numbers try to break it", "A continuación · los números intentan romperlo"),
    (6, "Up next · the deal goes under contract", "A continuación · el negocio se firma"),
    (8, "Up next · the approvals, one by one", "A continuación · los permisos, uno por uno"),
    (10, "Up next · the lots get ready for someone else’s vision", "A continuación · los lotes quedan listos para la visión de otro"),
    (13, "Almost there · what happens after the lots sell", "Ya casi · lo que pasa después de vender los lotes"),
    (17, "The last line is next", "La última línea es lo siguiente"),
]
def aero_m(v):
    # her ask (2026-09-14): the drawing starts with the first scroll. The title and the first lines (0–.30) are
    # compressed to 0–.10; the build and the flight take the room; El Dorado and the ending are unchanged.
    if v <= 0.085: return v * (0.012 / 0.085)
    if v <= 0.30: return 0.012 + (v - 0.085) * (0.088 / 0.215)
    if v <= 0.785: return 0.10 + (v - 0.30) * (0.554 / 0.485)
    return 0.821 + (v - 0.785) * (0.179 / 0.215)

AERO_NEXT = [   # from = the aerodrome's scroll value (aerodrome-3d/main.js)
    (0, "Up next · the drawing becomes blocks", "A continuación · el dibujo se vuelve bloques"),
    (aero_m(0.30), "Up next · an A321 rolls out", "A continuación · sale un A321"),
    (aero_m(0.528), "Up next · it takes off", "A continuación · despega"),
    (aero_m(0.744), "Up next · where it was meant to be", "A continuación · dónde iba a estar"),
    (0.80, "Up next · the thesis behind it", "A continuación · la tesis detrás"),
    (0.87, "Almost there · the last line", "Ya casi · la última línea"),
]

def ws_line(en, es, at, out, tag="p", end=False):
    attrs = f' data-at="{at:.3f}" data-out="{out:.3f}"'
    if end:   # the one Arcilla full stop on the page
        stop = '<span class="stop">.</span>'
        return f'<{tag} class="ws-line"{attrs} data-es-html="{A(H(es[:-1]) + stop)}">{H(en[:-1])}{stop}</{tag}>'
    return tx(tag, en, es, cls="ws-line", extra=attrs)

def work():
    R = "../"
    # WORK_STORY is authored on the story scale (0–0.92); the film squeezes the story into 0–0.80 and
    # gives the last fifth to the wordless ending (follow-the-line/js/config.js SQUEEZE) — same here
    # the removed pass/structure stretch (0.340–0.418) is cut out, as in config.js CUT (her ask, 2026-09-14)
    sq = lambda v: (v if v <= 0.340 else max(0.340, v - 0.078)) * (0.72 / 0.842) if v <= 0.921 else v
    groups = []
    for gi, (still, out, cls, lines) in enumerate(WORK_STORY):
        items = "".join(ws_line(en, es, sq(at), sq(out), tag="h1" if gi == 0 and li == 0 else "p", end=(cls == "end"))
                        for li, (en, es, at) in enumerate(lines))
        c = f" {cls}" if cls else ""
        groups.append(f'<li class="ws-group{c}" data-p="{sq(still):.3f}">{items}</li>')
    steps = (f'<nav class="ws-steps" hidden aria-label="Stages" data-es-aria="Etapas">'
             f'<button type="button" data-step="prev">{tx("span", "Previous", "Anterior")}</button>'
             f'<span class="ws-count caps" aria-live="polite">1 / {len(WORK_STORY)}</span>'
             f'<button type="button" data-step="next">{tx("span", "Next", "Siguiente")}</button></nav>')
    body = (
        f'<section class="ws">'
        f'<div class="ws-track"><div class="ws-stage">'
        f'<iframe class="ws-film" src="{R}follow-the-line/?embed&amp;story=work&amp;v={FV}" title="Follow the Line" tabindex="-1" aria-hidden="true"></iframe>'
        f'<div class="ws-scrim" aria-hidden="true"></div>'
        f'<div class="ws-cover" data-from="0.010" data-to="0.020" aria-hidden="true"></div>'
        f'<ol class="ws-cues">{"".join(groups)}</ol>'
        # her ask: tell the reader there is more below until the film finishes
        f'<div class="ws-more" aria-hidden="true">{more_next(WORK_NEXT)}<span class="ws-more-line"><i></i></span>'
        f'{tx("span", "Keep scrolling", "Sigue bajando", cls="caps")}</div>'
        f'{steps}'
        f'</div></div></section>'
    )
    return page("work", ("The Work — Yeraldin Soto", "El trabajo — Yeraldin Soto"),
                ("One piece of land, from the first question about a market to a finished lot and what the sale teaches the next deal.",
                 "Un terreno, desde la primera pregunta sobre un mercado hasta un lote terminado y lo que la venta le enseña al siguiente negocio."), body)

# ================================================================ THE PRACTICE
# What she deliberately keeps learning because it widens how she sees and decides (her master brief).
# Lighter than Inside My Mind; never a hobbies page or a skills matrix. Six practices, each words first,
# then one drawing that plays once as it arrives (js/motion.js practice()). The market drawing is a way
# of asking, never a chart of any real prices; the code shown is read from js/motion.js at build time.
def js_line(prefix):
    for l in open(os.path.join(ROOT, "js", "motion.js"), encoding="utf-8").read().splitlines():
        if l.strip().startswith(prefix):
            return l.strip()
    raise SystemExit(f"js_line: '{prefix}' is not in js/motion.js — code on the site is never retyped by hand")

def pfig(svg, seq, cap=None):
    c = tx("figcaption", *cap, cls="caps pcap") if cap else ""
    return f'<figure class="mfig pfig" data-seq="{seq}">{svg}{c}</figure>'

def fig_translate():
    return ('<svg class="mfig-svg" viewBox="0 0 640 250" role="img" '
            'aria-label="The Spanish word sobremesa; its literal pieces, over and table, are crossed out; then what it means: the long talk that stays at the table after the meal." '
            'data-es-aria="La palabra sobremesa; sus partes literales, sobre y mesa, quedan tachadas; luego lo que significa: la conversación que se queda en la mesa después de comer.">'
            '<text class="pword" x="40" y="86" lang="es">sobremesa</text>'
            + tx("text", "over · table", "sobre · mesa", cls="gl gloss", extra=' x="42" y="132"')
            + '<path class="strike" pathLength="1" d="M38 127H236"/>'
            + tx("text", "the long talk that stays", "la conversación que se queda", cls="gl mean", extra=' x="42" y="190"')
            + tx("text", "at the table after the meal", "en la mesa después de comer", cls="gl mean", extra=' x="42" y="214"')
            + '</svg>')

def fig_section():
    return ('<svg class="mfig-svg" viewBox="0 0 640 340" role="img" '
            'aria-label="A building section drawn in the order it is built: ground and footings, then columns, slab and roof, then a line of light through the window." '
            'data-es-aria="Un corte de edificio dibujado en el orden en que se construye: suelo y zapatas, luego columnas, losa y cubierta, y después una línea de luz por la ventana.">'
            '<path class="ground" d="M40 290H600"/>'
            '<path class="found" pathLength="1" d="M160 290V310H220V290M420 290V310H480V290"/>'
            '<path class="frame" pathLength="1" d="M190 290V120M450 290V120"/>'
            '<path class="frame" pathLength="1" d="M150 200H490"/>'
            '<path class="frame" pathLength="1" d="M140 120H500L470 90H170Z"/>'
            '<path class="window" pathLength="1" d="M300 200V158H372V200"/>'
            '<path class="light" pathLength="1" d="M574 40L336 180L262 290"/>'
            + svg_label("light", "luz", 574, 30, "middle", "gl small lightl")
            + svg_label("proportion", "proporción", 320, 334, "middle", "gl small propl")
            + '</svg>')

def fig_tower():
    # her ask (2026-09-14): the Burj Khalifa — the building she loves — as a line study that rises out of the sand as the
    # reader scrolls: the dunes first, then the piles and the core, then the setbacks climbing, then the spire.
    cx, base, top, tip = 180, 604, 214, 30
    tiers, hw0, hw1 = 16, 100, 15
    level = lambda i: base - (base - top) * (i / tiers) ** 0.95
    width = lambda i: hw0 + (hw1 - hw0) * (i / tiers) ** 1.25
    L = R = hw0
    lp, rp, wl, wr, floors = [(cx - L, base)], [(cx + R, base)], [], [], ""
    for i in range(tiers):
        y0, y1 = level(i), level(i + 1)
        y = y0 - 11
        while y > y1 + 3:
            floors += f'<path style="--i:{i}" d="M{cx - L + 2:.1f} {y:.1f}H{cx + R - 2:.1f}"/>'
            y -= 11
        wl.append(f'M{cx - L * 0.45:.1f} {y0:.1f}V{y1:.1f}'); wr.append(f'M{cx + R * 0.45:.1f} {y0:.1f}V{y1:.1f}')
        lp.append((cx - L, y1)); rp.append((cx + R, y1))
        # the three wings step back in turn as it climbs: in elevation the left and the right edge take turns
        if i % 2 == 0: L = width(i + 1)
        else: R = width(i + 1)
        lp.append((cx - L, y1)); rp.append((cx + R, y1))
    s = min(L, R)
    edge = lambda pts: "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    rings = "".join(f'<path d="M{cx - s * (1 - k) - 1.5:.1f} {top - (top - tip) * k:.1f}H{cx + s * (1 - k) + 1.5:.1f}"/>' for k in (0.18, 0.36, 0.54))
    piles = "".join(f'<path d="M{x} {base + 2}V{base + 26}"/>' for x in range(96, 270, 22))
    return ('<svg class="mfig-svg tower-svg" viewBox="0 0 360 660" role="img" '
            'aria-label="The Burj Khalifa drawn rising from the sand: dunes, then its foundation and core, then its setbacks climbing, then its spire." '
            'data-es-aria="El Burj Khalifa dibujado saliendo de la arena: dunas, luego su cimentación y su núcleo, luego sus retrocesos subiendo, luego su aguja.">'
            '<g class="sand"><path d="M0 612C60 600 118 626 188 610S300 594 360 612"/><path d="M0 634C70 622 150 648 232 630S326 622 360 632"/>'
            '<path d="M24 652C90 644 150 660 222 648S318 642 350 650"/></g>'
            f'<g class="found">{piles}<path pathLength="1" d="M70 604H290"/></g>'
            f'<path class="cl" pathLength="1" d="M{cx} {base}V{tip}"/>'
            f'<g class="floors">{floors}</g>'
            f'<g class="mulls"><path class="grid" d="{"".join(wl)}"/><path class="grid" d="{"".join(wr)}"/></g>'
            f'<path class="edge" style="--i:0" pathLength="1" d="{edge(lp)}"/><path class="edge" style="--i:1" pathLength="1" d="{edge(rp)}"/>'
            f'<g class="spire-g"><path class="spire" pathLength="1" d="M{cx - s} {top}L{cx - 2} {tip + 60}L{cx} {tip}L{cx + 2} {tip + 60}L{cx + s} {top}"/>{rings}</g>'
            '</svg>')

UW_LENSES = [("Market", "Mercado"), ("Product", "Producto"), ("Land · asset", "Tierra · activo"), ("Cost", "Costo"), ("Operations", "Operación"),
             ("Capital", "Capital"), ("Structure", "Estructura"), ("Time", "Tiempo"), ("Exit", "Salida")]
UW_QUESTIONS = [
    (("Market", "Mercado"), [("Who buys this?", "¿Quién compra esto?"), ("What is absorbing? What is slowing?", "¿Qué se está absorbiendo? ¿Qué se está frenando?")]),
    (("Product", "Producto"), [("What exactly are we creating?", "¿Qué estamos creando exactamente?")]),
    (("Land · asset", "Tierra · activo"), [("What do we actually control?", "¿Qué controlamos de verdad?")]),
    (("Cost", "Costo"), [("What does it take to make the project real?", "¿Qué hace falta para que el proyecto sea real?")]),
    (("Operations", "Operación"), [("If it already exists, how does it perform?", "Si ya existe, ¿cómo se desempeña?")]),
    (("Capital", "Capital"), [("How is it financed?", "¿Cómo se financia?")]),
    (("Structure", "Estructura"), [("Who carries which risk?", "¿Quién carga cada riesgo?")]),
    (("Time", "Tiempo"), [("How long does capital stay exposed?", "¿Cuánto tiempo queda expuesto el capital?")]),
    (("Exit", "Salida"), [("Who buys it from us?", "¿Quién nos lo compra?")]),
]

def fig_underwrite():
    cx, cy = 320, 214
    g = ""
    for k, (en, es) in enumerate(UW_LENSES):
        a = math.radians(-90 + k * 40)
        c, s = math.cos(a), math.sin(a)
        x0, y0, x1, y1 = cx + 52 * c, cy + 52 * s, cx + 140 * c, cy + 140 * s
        anchor = "middle" if abs(c) < 0.3 else ("start" if c > 0 else "end")
        lx = x1 + (0 if anchor == "middle" else (12 if anchor == "start" else -12))
        ly = y1 + (-12 if s < -0.5 else (22 if s > 0.5 else 4))
        g += (f'<g class="ulens" style="--i:{k}"><path class="uspoke" pathLength="1" d="M{x0:.1f} {y0:.1f}L{x1:.1f} {y1:.1f}"/>'
              f'<circle cx="{x1:.1f}" cy="{y1:.1f}" r="4"/>{svg_label(en, es, lx, ly, anchor, "gl small ulab")}</g>')
    return ('<svg class="mfig-svg" viewBox="0 0 640 430" role="img" '
            'aria-label="One project in the middle; around it the questions that have to hold for it to work: market, product, land or asset, cost, operations, capital, structure, time and exit." '
            'data-es-aria="Un proyecto en el centro; a su alrededor las preguntas que tienen que sostenerse para que funcione: mercado, producto, tierra o activo, costo, operación, capital, estructura, tiempo y salida.">'
            f'<g class="uprop"><rect x="290" y="194" width="60" height="46"/><path d="M282 198L320 168L358 198"/><path d="M312 240V222H328V240"/></g>'
            f'{g}</svg>')

BUILDING_LENSES = [
    ("l1", ("Physical", "Físico"), ("roof · MEP · units", "cubierta · MEP · unidades"), ("common areas · deferred maintenance", "zonas comunes · mantenimiento diferido")),
    ("l2", ("Operating", "Operativo"), ("rent · vacancy · maintenance", "renta · vacancia · mantenimiento"), ("vendors · turnover", "proveedores · rotación")),
    ("l3", ("Financial", "Financiero"), ("revenue · expenses · NOI", "ingresos · gastos · NOI"), ("capex · return · valuation", "capex · retorno · valoración")),
    ("l3", ("Human", "Humano"), ("resident experience", "experiencia del residente"), ("management · service", "administración · servicio")),
]

def fig_building():
    wins = ""
    vacant = {(1, 3), (3, 1)}
    for f in range(4):
        y = 128 + f * 62
        for j in range(5):
            x = 66 + j * 44
            if f == 3 and j == 2:
                continue   # the entrance
            cls = "win vac" if (f, j) in vacant else "win"
            wins += f'<rect class="{cls}" x="{x}" y="{y}" width="24" height="30"/>'
    # her note (2026-09-14): no words on the building. The drawing stays clear; the four readings arrive beside it as text
    # that reflows (two columns, one on the narrowest phones), one reading per stage.
    lenses = '<dl class="blenses">' + "".join(
        f'<div class="blens {stage}">{tx("dt", *name, cls="caps")}{tx("dd", *a)}{tx("dd", *b)}</div>'
        for stage, name, a, b in BUILDING_LENSES) + '</dl>'
    return ('<svg class="mfig-svg bsvg" viewBox="20 76 310 312" role="img" '
            'aria-label="One apartment building, read four ways: physical (roof, MEP, units, common areas), operating (rent, vacancy, turnover), financial (revenue, expenses, NOI, capex) and human (the resident, management, service)." '
            'data-es-aria="Un edificio de apartamentos leído de cuatro maneras: físico (cubierta, MEP, unidades, zonas comunes), operativo (renta, vacancia, rotación), financiero (ingresos, gastos, NOI, capex) y humano (el residente, la administración, el servicio).">'
            '<path class="bground" d="M30 364H310"/><path class="bshell" d="M50 364V110H290V364"/>'
            '<path class="bfloor" d="M50 172H290M50 234H290M50 296H290"/>'
            f'{wins}<rect class="bdoor" x="154" y="316" width="32" height="48"/>'
            '<path class="phys" d="M78 110V94H122V110M196 110V88H238V110"/><path class="phys mep" d="M276 364V92"/>'
            '<g class="noi"><rect x="306" y="250" width="10" height="114"/><rect class="noi-e" x="306" y="300" width="10" height="64"/></g>'
            '<circle class="resident" cx="170" cy="376" r="5"/>'
            f'</svg>{lenses}')

def fig_reason():
    steps = [("the story", "la historia"), ("data", "datos"), ("comparison", "comparación"), ("probabilities", "probabilidades"), ("risk", "riesgo"), ("decision", "decisión")]
    pts = []
    for i in range(0, 57):
        x = 40 + i * 10
        amp = 34 * max(0.0, 1 - (x - 40) / 470) ** 1.4
        pts.append(f"{x} {150 + amp * math.sin(i * 0.9):.1f}")
    nodes = ""
    for k, (en, es) in enumerate(steps):
        x = 60 + k * 104
        up = k % 2 == 0
        nodes += (f'<g class="rnode{" rdec" if k == 5 else ""}" style="--i:{k}"><circle cx="{x}" cy="150" r="{7 if k == 5 else 5}"/>'
                  f'{svg_label(en, es, x, 118 if up else 192, "middle", "gl small")}</g>')
    return ('<svg class="mfig-svg" viewBox="0 0 640 260" role="img" '
            'aria-label="A market story drawn as a restless line that straightens as it passes through data, comparison, probabilities and risk, and ends in a decision." '
            'data-es-aria="La historia de un mercado dibujada como una línea inquieta que se endereza al pasar por datos, comparación, probabilidades y riesgo, y termina en una decisión.">'
            f'<path class="rstory" pathLength="1" d="M{"L".join(pts)}"/>{nodes}</svg>')

def fig_context():
    ticks = "".join(f'<path d="M{80 + k * 52} 276V284"/>' for k in range(11))
    return ('<svg class="mfig-svg" viewBox="0 0 640 320" role="img" '
            'aria-label="One price on its own; then its historical range; then a growth line with a band of risk around it; then time along the bottom. The same number means something different each time." '
            'data-es-aria="Un precio solo; luego su rango histórico; luego una línea de crecimiento con una franja de riesgo; luego el tiempo abajo. El mismo número significa algo distinto cada vez.">'
            '<rect class="crange" x="60" y="140" width="540" height="70"/>'
            + svg_label("historical range", "rango histórico", 70, 158, "start", "gl small clab1")
            + '<path class="crisk" d="M60 206C220 196 400 160 600 114L600 150C400 196 220 232 60 244Z"/>'
            '<path class="cgrowth" d="M60 226C220 214 400 178 600 132"/>'
            + svg_label("growth · risk", "crecimiento · riesgo", 596, 104, "end", "gl small clab2")
            + f'<g class="ctime"><path d="M60 280H600"/>{ticks}' + svg_label("time", "tiempo", 600, 304, "end", "gl small") + '</g>'
            '<circle class="cprice" cx="462" cy="126" r="7"/>'
            + svg_label("a price", "un precio", 448, 130, "end", "gl small cpl")
            + '</svg>')

FIN_QUESTIONS = [
    ("What changed?", "¿Qué cambió?"), ("What is priced in?", "¿Qué ya está en el precio?"), ("What is the base rate?", "¿Cuál es la tasa base?"),
    ("What does history say?", "¿Qué dice la historia?"), ("What assumption explains the current price?", "¿Qué supuesto explica el precio actual?"),
    ("What would make the thesis wrong?", "¿Qué haría que la tesis estuviera equivocada?"), ("Where is capital moving?", "¿Hacia dónde se mueve el capital?"),
    ("How does regulation change the opportunity?", "¿Cómo cambia la regulación la oportunidad?"), ("How does infrastructure affect value?", "¿Cómo afecta la infraestructura al valor?"),
    ("How do population, income and migration change demand?", "¿Cómo cambian la demanda la población, el ingreso y la migración?"),
]

def fig_reading():
    # the same page twice. The first pass catches one line; the second catches what was already there.
    def page(x0, marks, cls, base):
        out = ""
        for k in range(9):
            y = 52 + k * 21
            w = 214 if k not in (3, 8) else 150          # a paragraph does not end flush
            out += f'<path class="rdline" style="--i:{k + base}" d="M{x0} {y}H{x0 + w}"/>'
            if k in marks:
                out += f'<path class="rdmark {cls}" style="--i:{marks.index(k)}" pathLength="1" d="M{x0} {y}H{x0 + w - 16}"/>'
        return out
    return ('<svg class="mfig-svg" viewBox="0 0 640 280" role="img" '
            'aria-label="The same page of text drawn twice as rows of rules. On the first, one row is marked in brass. On the second, the same row and three others are marked." '
            'data-es-aria="La misma página de texto dibujada dos veces como filas de reglas. En la primera, una fila está marcada en latón. En la segunda, esa misma fila y otras tres.">'
            + page(60, [4], "first", 0) + page(360, [1, 4, 5, 7], "second", 9)
            + tx("text", "first reading", "primera lectura", cls="gl small", extra=' x="60" y="268" text-anchor="start"')
            + tx("text", "again", "otra vez", cls="gl small", extra=' x="360" y="268" text-anchor="start"')
            + '</svg>')

def fig_writing():
    # the same thought three times, each pass shorter than the one before. What the prose on this site is trying to do.
    first = "".join(f'<path d="M60 {y}H{w}"/>' for y, w in ((54, 580), (84, 580), (114, 486)))
    again = "".join(f'<path class="strike" pathLength="1" d="M60 {y}H{w}"/>' for y, w in ((168, 470), (198, 356)))
    return ('<svg class="mfig-svg" viewBox="0 0 640 300" role="img" '
            'aria-label="The same thought written three times. First as three long rules. Then, in clay, as two shorter ones. Last, in brass, as a single short rule." '
            'data-es-aria="El mismo pensamiento escrito tres veces. Primero como tres reglas largas. Luego, en arcilla, como dos más cortas. Al final, en latón, como una sola regla corta.">'
            + f'<g class="gloss">{first}</g>{again}'
            + '<path class="mean" d="M60 252H274"/>'
            + tx("text", "what was left", "lo que quedó", cls="gl small mean", extra=' x="60" y="286" text-anchor="start"')
            + '</svg>')

def psection(i, kicker, lines, figure, idea=None, extra=""):
    room = " hondo" if i % 2 else ""
    return (f'<section class="beat practice-s{room}"><div class="wrap pgrid">'
            f'<div class="ptext">{tx("p", *kicker, cls="caps pkicker", extra=" data-reveal")}{mlines(lines)}{extra}</div>'
            f'<div class="pvis">{figure}{mlines(idea, "mlines midea") if idea else ""}</div></div></section>')

def practice():
    # her iteration (2026-09-14): what she keeps training because it changes how she sees — studies, not cards.
    # Nothing here retells The Work or About: underwriting as the economic system under a property, a building
    # read four ways, markets, statistics, structure, languages, drawing, building tools.
    R = "../"
    uwq = ('<dl class="uwq" data-reveal>' + "".join(
        f'<div>{tx("dt", *name, cls="caps")}' + "".join(tx("dd", en, es) for en, es in qs) + '</div>' for name, qs in UW_QUESTIONS) + '</dl>')
    finance_extra = (
        '<ol class="pquestions" data-reveal>' + "".join(tx("li", en, es) for en, es in FIN_QUESTIONS) + '</ol>'
        + mlines([("I am increasingly interested in investing across different markets: Colombia first, and the growth markets of South America around it.",
                   "Cada vez me interesa más invertir en distintos mercados: primero Colombia, y los mercados en crecimiento de Suramérica a su alrededor."),
                  ("I read them the way I read a county before a project: population, income, migration, infrastructure, regulation, the currency, and what the price already assumes.",
                   "Los leo como leo un condado antes de un proyecto: población, ingreso, migración, infraestructura, regulación, la moneda y lo que el precio ya supone."),
                  ("I am not a fund manager. I learn a market by studying it, and by taking part in it.", "No soy gestora de fondos. Aprendo un mercado estudiándolo, y participando en él.")],
                 "mlines psouth"))
    code = (f'<figure class="pcode" data-reveal><pre class="code"><code>{html.escape(js_line("var TIMING = { draw:"))}</code></pre>'
            f'{tx("figcaption", "js/motion.js · the paper airplane on About", "js/motion.js · el avión de papel en Sobre mí", cls="caps codesrc")}</figure>')
    sections = (
        psection(0, ("Underwriting", "Análisis de inversiones"),
                 [("I do not only underwrite land.", "No solo analizo tierra."),
                  ("I underwrite what has to become true for a project to work.", "Analizo lo que tiene que volverse cierto para que un proyecto funcione."),
                  [("Land.", "Tierra."), ("Subdivisions.", "Subdivisiones."), ("Multifamily.", "Multifamiliares."), ("Development projects.", "Proyectos de desarrollo."),
                   ("Capital improvements.", "Mejoras de capital."), ("Existing assets.", "Activos existentes."), ("Ground-up.", "Desde cero."), ("Value-add.", "Valor agregado.")]],
                 pfig(fig_underwrite(), "600,1400,1400"),
                 [("Different asset. Same question.", "Otro activo. La misma pregunta."), ("What survives after the assumptions move?", "¿Qué sobrevive cuando los supuestos se mueven?")],
                 extra=uwq)
        + psection(1, ("Multifamily", "Multifamiliar"),
                   [("Managing buildings taught me to read one four ways.", "Administrar edificios me enseñó a leer uno de cuatro maneras."),
                    [("Physical.", "Físico."), ("Operating.", "Operativo."), ("Financial.", "Financiero."), ("Human.", "Humano.")]],
                   pfig(fig_building(), "600,1500,1500"),
                   [("A building is never only a building.", "Un edificio nunca es solo un edificio.")])
        + psection(2, ("Finance and investing", "Finanzas e inversión"),
                   [("I like markets for the same reason I like land.", "Me gustan los mercados por la misma razón que me gusta la tierra."),
                    ("They punish stories that do not survive the numbers.", "Castigan las historias que no sobreviven a los números.")],
                   pfig(fig_reason(), "600,1500,1300", ("A way of reasoning — not a chart of any real market", "Una forma de razonar — no la gráfica de ningún mercado real")),
                   [("I study markets, and I take part in them.", "Estudio los mercados, y participo en ellos.")],
                   extra=finance_extra)
        + psection(3, ("Statistical thinking", "Pensamiento estadístico"),
                   [[("Distributions.", "Distribuciones."), ("Base rates.", "Tasas base."), ("Historical ranges.", "Rangos históricos."), ("Probability.", "Probabilidad."), ("Absorption.", "Absorción.")],
                    ("Numbers help me test whether the story I am telling myself survives reality.", "Los números me ayudan a probar si la historia que me cuento sobrevive a la realidad.")],
                   pfig(fig_context(), "700,1500,1500", ("A drawing of context — no real prices", "Un dibujo del contexto — ningún precio real")),
                   [("A number becomes useful when I know what it is being compared with.", "Un número se vuelve útil cuando sé con qué se está comparando.")])
        + psection(4, ("Architecture and construction", "Arquitectura y construcción"),
                   [[("Materials.", "Materiales."), ("Sections.", "Cortes."), ("Joints.", "Juntas."), ("The order things were built in.", "El orden en que se construyeron las cosas.")],
                    ("Construction eventually makes every idea answer to reality.", "La construcción tarde o temprano hace que toda idea le responda a la realidad.")],
                   pfig(fig_section(), "700,1100,1300"),
                   [("Structure is where imagination begins negotiating with gravity.", "La estructura es donde la imaginación empieza a negociar con la gravedad.")])
        + psection(5, ("Languages", "Idiomas"),
                   [("I learn languages to reach a culture, not a vocabulary.", "Aprendo idiomas para llegar a una cultura, no a un vocabulario."),
                    [("What people say directly.", "Lo que la gente dice de frente."), ("What they soften.", "Lo que suaviza."),
                     ("The joke that does not survive translation.", "El chiste que no sobrevive a la traducción."),
                     ("The song that opens once the words do.", "La canción que se abre cuando se abren las palabras.")]],
                   pfig(fig_translate(), "700,1200,1100"),
                   [("A culture changes when it stops arriving through translation.", "Una cultura cambia cuando deja de llegar a través de la traducción.")])
        + psection(6, ("Drawing", "Dibujo"),
                   [("I draw to look.", "Dibujo para mirar."),
                    [("A stem does not bend where memory expects it to.", "Un tallo no se dobla donde la memoria espera."),
                     ("A leaf is rarely symmetrical.", "Una hoja casi nunca es simétrica."),
                     ("An orchid root goes where it wants.", "Una raíz de orquídea va a donde quiere.")]],
                   f'<div class="pmark">{flower_mark()}</div>',
                   [("Drawing punishes assumptions.", "Dibujar castiga los supuestos.")])
        + psection(7, ("Code and systems", "Código y sistemas"),
                   [("If I can describe the system clearly enough, I increasingly want to build it.", "Si puedo describir el sistema con suficiente claridad, cada vez más quiero construirlo."),
                    [("A scheduled check.", "Una revisión programada."), ("A small tool that moves information.", "Una pequeña herramienta que mueve información."),
                     ("The way a paper airplane turns a chapter on this site.", "La forma en que un avión de papel pasa un capítulo en este sitio.")]],
                   code,
                   [("How I use AI to build it lives in Inside My Mind.", "Cómo uso la IA para construirlo vive en Dentro de mi mente.")])
        + psection(8, ("Reading", "Lectura"),
                   [("I read slowly, and I read the same pages more than once.", "Leo despacio, y releo las mismas páginas más de una vez."),
                    [("Kenkō.", "Kenkō."), ("Krogerus.", "Krogerus."), ("A county ordinance.", "Una norma del condado."),
                     ("A title commitment.", "Un compromiso de título.")],
                    ("The ordinance and the essay ask for the same attention.", "La norma y el ensayo piden la misma atención.")],
                   pfig(fig_reading(), "600,1300,1400"),
                   [("A book I finish quickly is usually one I did not need.", "Un libro que termino rápido casi siempre es uno que no necesitaba.")])
        + psection(9, ("Writing", "Escritura"),
                   [("I write to find out whether I understood it.", "Escribo para averiguar si lo entendí."),
                    ("A sentence that will not come out straight is usually a thought that has not finished.",
                     "Una frase que no sale derecha casi siempre es un pensamiento que no ha terminado."),
                    [("A memo.", "Un memo."), ("An entry.", "Una entrada."), ("A note I never send.", "Una nota que nunca envío.")]],
                   pfig(fig_writing(), "600,1300,1400"),
                   [("Everything here is a notebook. I am in no hurry to call it anything else.",
                     "Todo esto es un cuaderno. No tengo prisa por llamarlo de otra manera.")])
    )
    tower = (f'<figure class="mfig pfig tower" data-seq="300,1300,1500">{fig_tower()}'
             + label(("Study · Dubai · 828 m", "Estudio · Dubái · 828 m"), ("Burj Khalifa", "Burj Khalifa"), reveal=False)
             + tx("p", "It stands on land that was desert. The land did not change; someone saw what it could hold.",
                  "Se levanta sobre una tierra que era desierto. La tierra no cambió; alguien vio lo que podía sostener.", cls="tower-line")
             + '</figure>')
    opening = (f'<section class="beat threshold"><div class="wrap"><div class="th"><div>'
               f'{hook("Some things I learn because they are useful.", "Algunas cosas las aprendo porque son útiles.")}'
               f'{tx("p", "Others become useful later.", "Otras se vuelven útiles después.", cls="plater", extra=" data-reveal data-late")}'
               f'{label(("The Practice · 10 studies · 2026", "La práctica · 10 estudios · 2026"))}</div>'
               f'<div>{tower}</div>'
               f'</div></div></section>')
    body = (
        opening + sections
        + turn(("Everything I practise is an outline around something that won’t hold still.", "Todo lo que practico es un contorno alrededor de algo que no se queda quieto."), colibri())
        + rest(R, ("I learn languages badly, and then less badly.", "Aprendo idiomas mal, y luego menos mal."), "journal")
    )
    return page("practice", ("The Practice — Yeraldin Soto", "La práctica — Yeraldin Soto"),
                ("What I keep training because it changes how I see: underwriting, buildings, markets, statistics, structure, languages, drawing, code, reading and writing.",
                 "Lo que sigo entrenando porque cambia cómo veo: análisis de inversiones, edificios, mercados, estadística, estructura, idiomas, dibujo, código, lectura y escritura."), body)

# ================================================================ THE JOURNAL
# Situations and thoughts before they become frameworks (her master brief). Entries live in tools/journal.py
# (EN + ES), newest first; the list is here and each entry has its own page at journal/<slug>/.
# ---------------------------------------------------------------- the Journal's drawings
# Her iteration (2026-09-14): every entry asks what drawing would help someone understand the idea — never a stock
# image. Each drawing plays once in stages (st1 … stN groups revealed by s1 … sN, js/motion.js practice()) and holds.
# Drawings of ideas, not records: no real parcels, prices or parties.
def svgopen(w, h, en, es):
    return (f'<svg class="mfig-svg" viewBox="0 0 {w} {h}" role="img" aria-label="{A(en)}" data-es-aria="{A(es)}">')

def lab(en, es, x, y, anchor="middle", cls="gl small"):
    return svg_label(en, es, x, y, anchor, cls)

def legend(k, shape, en, es, x, y):
    sw = (f'<rect class="{shape}" x="{x}" y="{y - 9}" width="24" height="10"/>' if shape.startswith("f")
          else f'<path class="{shape}" d="M{x} {y - 4}h24"/>')
    return f'<g class="st{k}">{sw}{lab(en, es, x + 34, y, "start")}</g>'

def vis_subdivision():
    # her note (2026-09-14): one parcel on an existing road. What remains is laid out the way a subdivision really is —
    # lots fronting the existing road, and a new road with a cul-de-sac so every other lot has road frontage too.
    # The names of the stages are captions under the drawing (JCAPS), one at a time, never a legend inside it.
    parcel = "M70 330L92 120L290 66L520 84L590 150L580 330Z"
    lots = "".join(f'<path class="ln lot" d="{d}"/>' for d in [
        "M156 330V276H318", "M212 330V276", "M268 330V276",            # lots on the existing road, west of the new road
        "M342 276H500V330", "M395 330V276", "M448 330V276",            # and east of it
        "M318 241H224V206", "M224 276V206H300",                        # lots on the new road
        "M342 241H436V206", "M436 276V206H360",
        "M224 206L262 130L330 100L398 130L436 206",                    # the pie-shaped lots around the cul-de-sac
        "M306 170L262 130", "M330 154V100", "M354 170L398 130"])
    return (svgopen(640, 400, "One irregular parcel on an existing road. Setbacks, steep topography, a utility easement, drainage and a creek with its floodplain each take part of it away. In what remains: lots facing the existing road, and a new road ending in a cul-de-sac with lots on both sides, so every lot has road frontage.",
                    "Un terreno irregular sobre una vía existente. Los retiros, la topografía empinada, una servidumbre de servicios, el drenaje y una quebrada con su zona inundable le quitan una parte cada uno. En lo que queda: lotes frente a la vía existente y una vía nueva que termina en un cul-de-sac con lotes a ambos lados, para que cada lote tenga frente a una vía.")
            + f'<g class="st1"><path class="fv" d="{parcel}"/><path class="ln dr" pathLength="1" d="{parcel}"/></g>'
            + '<g class="st2"><path class="road" d="M24 350H616"/><path class="la dr thick" pathLength="1" d="M70 330H580"/>'
            + lab("existing road", "vía existente", 600, 384, "end") + '</g>'
            + '<g class="st3"><g class="zone"><path class="la dash" d="M88 318L106 134L292 82L512 98L570 156L566 318Z"/></g></g>'
            + '<g class="st4"><g class="zone"><path class="fa" d="M440 80L520 84L590 150L586 200L452 170Z"/>'
              '<path class="lt" d="M430 96C480 110 540 130 588 170"/><path class="lt" d="M444 132C500 144 548 164 586 190"/></g></g>'
            + '<g class="st5"><g class="zone"><path class="fa" d="M96 146L288 90L292 104L98 162Z"/></g></g>'
            + '<g class="st6"><g class="zone"><path class="fa" d="M506 250C536 236 572 246 580 270V330H520C504 300 494 270 506 250Z"/></g></g>'
            + '<g class="st7"><g class="zone"><path class="fc" d="M70 330L80 222C110 244 134 286 150 330Z"/><path class="lc" d="M82 226C110 254 128 292 140 346"/></g></g>'
            + '<g class="st8"><path class="roadf" d="M318 346V204A26 26 0 1 1 342 204V346Z"/>'
              '<path class="la dr thick" pathLength="1" d="M318 330V204A26 26 0 1 1 342 204V330"/>'
            + f'{lots}</g></svg>')

JCAPS = {   # the stage names of a Journal drawing, shown under it one at a time as the stages arrive
    "a-subdivision-begins-as-one-shape": [
        ("One parcel. One shape.", "Un terreno. Una sola forma."),
        ("It has frontage on an existing road.", "Tiene frente sobre una vía existente."),
        ("Setbacks pull the edges in.", "Los retiros recogen los bordes."),
        ("Too steep to build.", "Demasiado empinado para construir."),
        ("A utility easement crosses it.", "La cruza una servidumbre de servicios."),
        ("The water needs somewhere to go.", "El agua necesita a dónde ir."),
        ("A creek, and its floodplain.", "Una quebrada, y su zona inundable."),
        ("What remains is the project: lots on the existing road, and a new road with a cul-de-sac so every lot has road frontage.",
         "Lo que queda es el proyecto: lotes sobre la vía existente, y una vía nueva con cul-de-sac para que cada lote tenga frente a una vía."),
    ],
}

def vis_jv():
    C = (320, 190)
    P = {"landowner": ((320, 52), ("landowner", "propietario"), (320, 30, "middle")),
         "capital": ((456, 146), ("capital", "capital"), (472, 150, "start")),
         "operator": ((404, 306), ("operator · developer", "operador · desarrollador"), (420, 330, "start")),
         "contractors": ((236, 306), ("contractors", "contratistas"), (220, 330, "end")),
         "exit": ((184, 146), ("buyer · exit", "comprador · salida"), (168, 150, "end"))}
    def flow(a, b, cls, bend):
        (x1, y1), (x2, y2) = (C if a == "p" else P[a][0]), (C if b == "p" else P[b][0])
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1
        sx, sy, ex, ey = x1 + dx / L * 30, y1 + dy / L * 30, x2 - dx / L * 30, y2 - dy / L * 30
        mx, my = (sx + ex) / 2 - dy / L * bend, (sy + ey) / 2 + dx / L * bend
        return f'<path class="{cls}" d="M{sx:.0f} {sy:.0f}Q{mx:.0f} {my:.0f} {ex:.0f} {ey:.0f}"/><circle class="{"dotc" if "lc" in cls else "dot"}" cx="{ex:.0f}" cy="{ey:.0f}" r="2.5"/>', (mx, my)
    flows = [("landowner", "p", "ln", 0), ("p", "landowner", "la", 22), ("capital", "p", "la", 0), ("p", "capital", "lc dash", 22),
             ("operator", "p", "lt dash", 0), ("p", "operator", "lc dash", 22), ("contractors", "p", "lt dash", 0), ("p", "contractors", "ln", 22),
             ("exit", "p", "la", 0), ("p", "exit", "ln", 22)]
    paths, qs = "", ""
    for k, (a, b, cls, bend) in enumerate(flows):
        pth, (mx, my) = flow(a, b, cls, bend)
        paths += pth
        if bend == 0:
            qs += lab("?", "?", mx + 10, my - 6, "middle", "gl acc")
    nodes = "".join(f'<circle class="dot" cx="{x}" cy="{y}" r="6"/>{lab(en, es, lx, ly, an)}' for (x, y), (en, es), (lx, ly, an) in P.values())
    leg = "".join(legend(2, shape, en, es, x, 372) for shape, en, es, x in
                  [("la", "cash · upside", "dinero · ganancia", 40), ("ln", "land · product", "tierra · producto", 214), ("lt dash", "work", "trabajo", 392), ("lc dash", "risk", "riesgo", 492)])
    return (svgopen(640, 390, "One project in the middle; a landowner, capital, an operator, contractors and a buyer around it. Cash, land, work, risk and upside move along different lines between them, and each line carries a question.",
                    "Un proyecto en el centro; alrededor, un propietario, el capital, un operador, contratistas y un comprador. El dinero, la tierra, el trabajo, el riesgo y la ganancia se mueven por líneas distintas entre ellos, y cada línea lleva una pregunta.")
            + f'<g class="st1"><rect class="ln" x="285" y="165" width="70" height="50"/>{lab("project", "proyecto", 320, 194)}{nodes}</g>'
            + f'<g class="st2">{paths}</g>{leg}'
            + f'<g class="st3">{qs}<circle class="la" cx="320" cy="190" r="48"/>{lab("who controls what?", "¿quién controla qué?", 96, 240, "middle", "gl small acc")}</g>'
            + '</svg>')

def vis_novation():
    return (svgopen(640, 320, "An original party linked to a contract and a seller. A new party enters and a new line draws to the contract; the original line fades, and around the contract appear consent, responsibility, economics and risk.",
                    "Una parte original unida a un contrato y a un vendedor. Entra una parte nueva y se dibuja una línea nueva hacia el contrato; la línea original se desvanece y alrededor del contrato aparecen consentimiento, responsabilidad, economía y riesgo.")
            + '<g class="st1">'
              '<g class="fadeout"><path class="ln" d="M128 96Q220 110 280 150"/><circle class="dot" cx="120" cy="90" r="8"/>' + lab("original party", "parte original", 120, 70) + '</g>'
              '<path class="ln" d="M512 96Q420 110 360 150"/><circle class="dot" cx="520" cy="90" r="8"/>' + lab("seller", "vendedor", 520, 70)
            + '<rect class="ln" x="280" y="140" width="80" height="56"/><path class="lt" d="M292 156H348M292 168H348M292 180H332"/>' + lab("contract", "contrato", 320, 126) + '</g>'
            + '<g class="st2"><path class="la dr" pathLength="1" d="M128 264Q220 240 280 190"/><circle class="dota" cx="120" cy="270" r="8"/>' + lab("new party", "parte nueva", 120, 298) + '</g>'
            + '<g class="st3"><rect class="lt" x="287" y="147" width="80" height="56"/>'
            + lab("consent · responsibility", "consentimiento · responsabilidad", 470, 236, "middle", "gl small acc")
            + lab("economics · risk", "economía · riesgo", 470, 256, "middle", "gl small acc") + '</g>'
            + '</svg>')

def vis_waterfall():
    bars = [(60, 60, 220, "fa", "la", ("exit value", "valor de salida")), (170, 60, 70, "fc", "lc", ("build", "construcción")),
            (280, 130, 50, "fc", "lc", ("infrastructure", "infraestructura")), (390, 180, 30, "fc", "lc", ("risk · time", "riesgo · tiempo")),
            (500, 210, 70, "fa", "la", ("basis", "base de costo"))]
    def bar(x, y, h, f, l, name):
        return f'<rect class="{f}" x="{x}" y="{y}" width="70" height="{h}"/><rect class="{l}" x="{x}" y="{y}" width="70" height="{h}"/>' + lab(*name, x + 35, 302)
    return (svgopen(640, 320, "Start from what a finished lot is worth; take away the cost to build, the infrastructure, and risk and time; what is left is the most the land can carry — the ceiling.",
                    "Empezar por lo que vale un lote terminado; restar el costo de construir, la infraestructura, y el riesgo y el tiempo; lo que queda es lo máximo que puede soportar la tierra: el techo.")
            + '<path class="lt" d="M40 280H600"/>'
            + f'<g class="st1">{bar(*bars[0])}</g>'
            + '<g class="st2">' + "".join(bar(*b) for b in bars[1:4]) + '<path class="lt dash" d="M130 60H170M240 130H280M350 180H390M460 210H500"/></g>'
            + f'<g class="st3">{bar(*bars[4])}<path class="la dash" d="M40 210H610"/>' + lab("the ceiling", "el techo", 606, 200, "end", "gl small acc") + '</g>'
            + '</svg>')

def vis_title():
    lots = "".join(f'<path class="lt" d="M{x} 60V270"/>' for x in range(160, 561, 80)[:-1]) + '<path class="lt" d="M80 165H560"/>'
    return (svgopen(640, 340, "A parcel with a plan of lots. An easement crosses it, the access is blocked and a restriction covers a corner; the usable plan shrinks to what is left.",
                    "Un terreno con un plan de lotes. Lo cruza una servidumbre, el acceso queda bloqueado y una restricción cubre una esquina; el plan utilizable se reduce a lo que queda.")
            + f'<g class="st1"><path class="ln" d="M80 60H560V270H80Z"/>{lots}<path class="road" d="M60 292H580"/>' + lab("the plan", "el plan", 100, 330, "start") + '</g>'
            + '<g class="st2"><rect class="fc" x="300" y="60" width="40" height="210"/>' + lab("easement", "servidumbre", 320, 48)
            + '<path class="lc" d="M430 282L450 302M450 282L430 302"/>' + lab("access", "acceso", 440, 330)
            + '<rect class="fc" x="80" y="60" width="120" height="80"/>' + lab("restriction", "restricción", 140, 48) + '</g>'
            + '<g class="st3"><path class="la dr thick" pathLength="1" d="M200 140H300V270H200ZM340 60H560V270H340Z"/>' + lab("the usable plan", "el plan utilizable", 450, 170, "middle", "gl small acc") + '</g>'
            + '</svg>')

def vis_frame():
    boxes = [(210, ("what is", "qué es"), ("interesting", "lo interesante")), (340, ("why it", "por qué"), ("matters", "importa")), (470, ("what", "qué pasa"), ("happens next", "después"))]
    b = "".join(f'<g class="bx" style="--i:{k}"><rect class="ln" x="{x}" y="80" width="116" height="60"/>{lab(*l1, x + 58, 106)}{lab(*l2, x + 58, 122)}</g>'
                for k, (x, l1, l2) in enumerate(boxes))
    return (svgopen(640, 200, "A spoken line stops; in the pause three frames appear — what is interesting, why it matters, what happens next — and then the line continues.",
                    "Una frase hablada se detiene; en la pausa aparecen tres marcos — qué es lo interesante, por qué importa, qué pasa después — y luego la frase continúa.")
            + '<g class="st1"><path class="ln dr" pathLength="1" d="M30 110H196"/></g>'
            + f'<g class="st2">{b}' + lab("the silence, still deciding", "el silencio, todavía decidiendo", 400, 54, "middle", "gl small acc") + '</g>'
            + '<g class="st3"><path class="la dr" pathLength="1" d="M592 110H630"/></g>'
            + '</svg>')

def vis_fell():
    # two short lines per node so neighbours never collide
    top = [(60, 160, (("the deal", "el negocio"), None), -18), (200, 110, (("zoning", "zonificación"), ("assumed", "supuesta")), -30),
           (340, 110, (("infrastructure", "infraestructura"), ("assumed", "supuesta")), -30), (480, 110, (("timing", "tiempos"), ("unnamed", "sin nombrar")), -30)]
    low = [(200, 230, (("zoning", "zonificación"), ("validated", "validada"))), (340, 230, (("infrastructure", "infraestructura"), ("checked", "revisada"))),
           (480, 230, (("timing", "tiempos"), ("named", "nombrados")))]
    def two(nm, x, y):
        return lab(*nm[0], x, y) + (lab(*nm[1], x, y + 14, "middle", "gl small acc2") if nm[1] else "")
    return (svgopen(640, 300, "The path the deal took: zoning assumed, infrastructure assumed, timing unnamed, and it fell through. Beneath it, the path not taken; the first assumption is circled — what to check first next time.",
                    "El camino que tomó el negocio: zonificación supuesta, infraestructura supuesta, tiempos sin nombrar, y se cayó. Debajo, el camino no tomado; el primer supuesto queda en un círculo: lo que revisaría primero la próxima vez.")
            + '<g class="st1"><path class="ln dr" pathLength="1" d="M60 160L200 110L340 110L480 110L600 160"/>'
            + "".join(f'<circle class="dot" cx="{x}" cy="{y}" r="5"/>{two(nm, x, y + dy)}' for x, y, nm, dy in top)
            + '<circle class="dotc" cx="600" cy="160" r="7"/>' + lab("fell through", "se cayó", 600, 186) + '</g>'
            + '<g class="st2"><path class="lt dash" d="M60 160L200 230L340 230L480 230L600 230"/>'
            + "".join(f'<circle class="dot" cx="{x}" cy="{y}" r="4"/>{two(nm, x, y + 24)}' for x, y, nm in low)
            + lab("maybe only early", "quizás solo era temprano", 632, 258, "end") + '</g>'
            + '<g class="st3"><circle class="la" cx="200" cy="110" r="16"/>' + lab("check this first next time", "revisar esto primero la próxima vez", 200, 46, "middle", "gl small acc") + '</g>'
            + '</svg>')

def vis_handoff():
    return (svgopen(640, 230, "Two versions of one message. The softened one wanders and arrives faint, with a question. The concrete one arrives whole.",
                    "Dos versiones de un mismo mensaje. La suavizada se desvía y llega débil, con una pregunta. La concreta llega completa.")
            + '<g class="st1"><circle class="dot" cx="70" cy="80" r="6"/><circle class="dot" cx="70" cy="170" r="6"/>'
            + lab("softened", "suavizado", 70, 58, "start") + lab("concrete", "concreto", 70, 148, "start")
            + '<circle class="ln" cx="570" cy="80" r="7"/><circle class="ln" cx="570" cy="170" r="7"/></g>'
            + '<g class="st2"><path class="lt dash" d="M82 80C200 50 300 110 420 76S520 90 556 80"/>' + lab("?", "?", 600, 86, "middle", "gl acc") + '</g>'
            + '<g class="st3"><path class="la dr thick" pathLength="1" d="M82 170H556"/><circle class="dota" cx="570" cy="170" r="7"/></g>'
            + '</svg>')

def vis_pressure():
    xs = range(200, 441, 48)
    people = "".join(f'<circle class="ln" cx="{x}" cy="150" r="7"/>' for x in xs)
    called = "".join(f'<circle class="dota" cx="{x}" cy="150" r="7"/><path class="la" d="M{x} 160V200"/>' for x in (248, 344, 440))
    return (svgopen(640, 300, "Six people in the middle; deadlines, incomplete information and decisions that cannot wait press in from every side. Some wait for certainty; others make the call with what they have.",
                    "Seis personas en el centro; plazos, información incompleta y decisiones que no pueden esperar presionan desde todos lados. Algunas esperan certezas; otras deciden con lo que tienen.")
            + f'<g class="st1">{people}</g>'
            + '<g class="st2"><path class="lc" d="M40 70L182 140M40 230L182 160M600 70L458 140M600 230L458 160"/>'
            + lab("deadlines", "plazos", 40, 56, "start") + lab("incomplete information", "información incompleta", 600, 56, "end")
            + lab("decisions that cannot wait", "decisiones que no esperan", 40, 252, "start") + lab("no certainty", "sin certezas", 600, 252, "end") + '</g>'
            + f'<g class="st3">{called}' + lab("made the call", "decidieron", 344, 222, "middle", "gl small acc") + lab("waited for certainty", "esperaron certezas", 320, 118) + '</g>'
            + '</svg>')

def vis_twobars():
    def group(x0, salary, name):
        out = "".join(f'<rect class="fv" x="{x0 + k * 44}" y="130" width="30" height="120"/><rect class="ln" x="{x0 + k * 44}" y="130" width="30" height="120"/>' for k in range(3))
        return out, f'<rect class="fa" x="{x0 + 132}" y="{250 - salary}" width="30" height="{salary}"/><rect class="la" x="{x0 + 132}" y="{250 - salary}" width="30" height="{salary}"/>'
    a1, a2 = group(90, 90, "a")
    b1, b2 = group(370, 190, "b")
    return (svgopen(640, 300, "Two engineers: the same degree, the same years, the same technical skill — equal bars. Their salaries are not. The difference is how clearly the value is shown.",
                    "Dos ingenieros: el mismo título, los mismos años, la misma habilidad técnica — barras iguales. Sus salarios no. La diferencia es qué tan claramente se muestra el valor.")
            + '<path class="lt" d="M60 250H600"/>'
            + f'<g class="st1">{a1}{b1}' + lab("engineer", "ingeniero", 175, 274) + lab("engineer", "ingeniero", 455, 274)
            + lab("degree · years · skill", "título · años · habilidad", 320, 30, "middle") + '</g>'
            + f'<g class="st2">{a2}{b2}' + lab("salary", "salario", 320, 50, "middle", "gl small acc") + '</g>'
            + '<g class="st3"><path class="la dash" d="M254 160H534"/>' + lab("how clearly the value is shown", "qué tan claro se muestra el valor", 394, 150, "middle", "gl small acc") + '</g>'
            + '</svg>')

def vis_plat():
    lots = "".join(f'<path class="ln" d="M{x} 80V262"/>' for x in range(160, 481, 80))
    tags = [(160, 120, 160, 52, ("lot lines · the surveyor", "linderos · el topógrafo")), (440, 80, 470, 32, ("utilities · the provider", "servicios · la empresa")),
            (300, 250, 300, 318, ("drainage · the engineer", "drenaje · el ingeniero")), (520, 286, 540, 318, ("access · the county", "acceso · el condado")),
            (110, 292, 96, 318, ("the street · families not here yet", "la calle · familias que aún no llegan"))]
    t2 = "".join(f'<circle class="dota" cx="{x}" cy="{y}" r="4"/>' for x, y, *_ in tags)
    t3 = "".join(f'<path class="lt" d="M{x} {y}L{lx} {ly + (8 if ly < y else -12)}"/>{lab(*nm, lx, ly, "middle", "gl small")}' for x, y, lx, ly, nm in tags)
    return (svgopen(640, 330, "A simple plat: a street and a row of lots. Every line on it belongs to someone who had to defend it — the surveyor, the utility provider, the engineer, the county, and families who have not arrived yet.",
                    "Un plano sencillo: una calle y una fila de lotes. Cada línea pertenece a alguien que tuvo que defenderla: el topógrafo, la empresa de servicios, el ingeniero, el condado y las familias que todavía no llegan.")
            + f'<g class="st1"><path class="ln" d="M80 80H560V262H80Z"/>{lots}<path class="road" d="M40 288H600"/><path class="la" d="M80 252C200 232 300 264 560 242"/></g>'
            + f'<g class="st2">{t2}</g><g class="st3">{t3}</g></svg>')

def vis_line():
    ticks = "".join(f'<path class="lt" style="--i:{k}" d="M{x} 70V90"/>' for k, x in enumerate(range(80, 520, 44)))
    return (svgopen(640, 150, "A line that keeps going, marked again and again, and then stops at one still point.",
                    "Una línea que sigue y sigue, marcada una y otra vez, y que luego se detiene en un punto quieto.")
            + '<g class="st1"><path class="ln dr" pathLength="1" d="M40 80C160 60 260 100 360 80S520 70 560 80"/></g>'
            + f'<g class="st2">{ticks}</g>'
            + '<g class="st3"><circle class="dota" cx="584" cy="80" r="6"/>' + lab("still", "quieta", 584, 56, "middle", "gl small acc") + '</g></svg>')

# slug → (drawing, stage pauses, after which story item it sits); a photograph where a photograph means more
# ---------------------------------------------------------------- drawings for the entries added from her LinkedIn writing
# Same rule as the others: a drawing of the idea, never a record. No real parcels, prices or parties. One clay
# element per drawing — it is the punctuation, not the palette.
def vis_lag():
    # demand peaks; what the demand asked for arrives years later, on its own curve. The gap between the peaks is the lag.
    return (svgopen(640, 400, "Two curves on separate baselines. Demand rises, peaks early and settles. What got built rises later and peaks well to the right of it. A clay line measures the distance between the two peaks: the lag. Houses stand at the right, finished.",
                    "Dos curvas sobre líneas base distintas. La demanda sube, hace pico temprano y se asienta. Lo que se construyó sube después y hace pico mucho más a la derecha. Una línea de arcilla mide la distancia entre los dos picos: el rezago. A la derecha quedan casas terminadas.")
            + '<g class="st1"><path class="lt" d="M60 180H600"/>'
              '<path class="ln dr" pathLength="1" d="M70 174C120 168 180 120 256 62C332 104 420 146 598 160"/>'
            + lab("demand", "demanda", 256, 46) + '</g>'
            + '<g class="st2"><path class="lt" d="M60 330H600"/>'
              '<path class="la dr" pathLength="1" d="M70 326C160 320 280 300 406 238C500 258 540 274 598 292"/>'
            + lab("what got built", "lo que se construyó", 406, 222) + '</g>'
            + '<g class="st3"><path class="lt dash" d="M256 70V352"/><path class="lt dash" d="M406 246V352"/>'
              '<path class="lc dr" pathLength="1" d="M256 352H406"/>'
              '<circle class="dotc" cx="256" cy="352" r="2.5"/><circle class="dotc" cx="406" cy="352" r="2.5"/>'
            + lab("the lag", "el rezago", 331, 374, "middle", "gl small acc") + '</g></svg>')

def vis_counter():
    # the same acreage before and after: a question, then an answer with a number in it. The counter is where it changes.
    left, right = "M60 96L172 74L212 206L80 220Z", "M470 96L582 74L622 206L490 220Z"
    lots = "".join(f'<path class="lc" d="{d}"/>' for d in ("M508 90V214", "M544 83V211", "M580 76V208"))
    return (svgopen(640, 300, "The same parcel drawn twice. On the left it is an empty outline: a question. In the middle a counter, with a document on it. On the right the identical outline, now divided by clay lot lines: an answer with a number in it.",
                    "El mismo terreno dibujado dos veces. A la izquierda es un contorno vacío: una pregunta. En el medio, un mostrador con un documento encima. A la derecha, el mismo contorno, ahora dividido por linderos de arcilla: una respuesta con un número adentro.")
            + f'<g class="st1"><path class="fv" d="{left}"/><path class="ln dr" pathLength="1" d="{left}"/>'
            + lab("acreage", "terreno", 136, 250) + lab("a question", "una pregunta", 136, 268) + '</g>'
            + '<g class="st2"><path class="lt dash" d="M226 150H286"/><path class="lt dash" d="M396 150H456"/>'
              '<path class="fv" d="M300 148h70v46h-70Z"/><path class="ln dr" pathLength="1" d="M300 148h70v46h-70Z"/>'
              '<path class="la thick dr" pathLength="1" d="M252 218H420"/>'
            + lab("the counter", "el mostrador", 336, 244) + '</g>'
            + f'<g class="st3"><path class="fv" d="{right}"/><path class="ln dr" pathLength="1" d="{right}"/>{lots}'
            + lab("this many lots", "tantos lotes", 546, 250, "middle", "gl small acc") + lab("an answer", "una respuesta", 546, 268) + '</g></svg>')

def vis_dayone():
    # the timeline runs one way; the question that decides it runs the other.
    marks = [(70, ("day one", "día uno"), "start"), (246, ("diligence", "diligencia"), "middle"),
             (422, ("entitlement", "aprobación"), "middle"), (598, ("the exit", "la salida"), "end")]
    ticks = "".join(f'<path class="ln" d="M{x} 164V180"/><circle class="dot" cx="{x}" cy="172" r="2.5"/>' for x, _, _ in marks)
    names = "".join(lab(en, es, 60 if a == "start" else (608 if a == "end" else x), 204 if k % 2 == 0 else 230, a)
                    for k, (x, (en, es), a) in enumerate(marks))
    return (svgopen(640, 300, "A timeline with five marks: day one, diligence, entitlement, horizontal, the exit. A clay line arcs back from the exit to day one, carrying the buyer's question the wrong way along the timeline. A second mark sits early, at diligence: the contractor.",
                    "Una línea de tiempo con cinco marcas: día uno, diligencia, aprobación, obra, la salida. Una línea de arcilla se devuelve en arco desde la salida hasta el día uno, llevando la pregunta del comprador al revés sobre la línea de tiempo. Una segunda marca queda temprano, en la diligencia: el contratista.")
            + f'<g class="st1"><path class="la dr thick" pathLength="1" d="M70 172H598"/>{ticks}{names}</g>'
            + '<g class="st2"><path class="lc dr" pathLength="1" d="M598 150C520 58 180 58 74 144"/>'
              '<circle class="dotc" cx="74" cy="144" r="3"/>'
            + lab("would I take this down?", "¿yo lo compraría?", 336, 52, "middle", "gl small acc") + '</g>'
            + '<g class="st3"><path class="ln dr" pathLength="1" d="M246 164V126"/><circle class="dot" cx="246" cy="126" r="2.5"/>'
            + lab("the contractor, here", "el contratista, aquí", 246, 112) + '</g></svg>')

def vis_compound():
    # one line keeps its number. The other costs something first, then does what the first one cannot.
    return (svgopen(640, 300, "Two lines across five years. One rises in a straight, shallow line and is labelled saved. The other, in clay, dips below its own start before curving upward past the first and climbing away. A dashed bracket marks the dip.",
                    "Dos líneas a lo largo de cinco años. Una sube en línea recta y poco inclinada, rotulada ahorrado. La otra, en arcilla, baja por debajo de su propio inicio antes de curvarse hacia arriba, pasar a la primera y seguir subiendo. Un corchete punteado marca la bajada.")
            + '<g class="st1"><path class="lt" d="M60 270H600"/>'
              '<path class="ln dr" pathLength="1" d="M70 236L598 190"/>'
            + lab("five years", "cinco años", 450, 292) + lab("saved", "ahorrado", 598, 180, "end") + '</g>'
            + '<g class="st2"><path class="lc dr" pathLength="1" d="M70 244C104 256 134 258 176 250C270 230 380 160 598 62"/>'
            + lab("what I can do", "lo que soy capaz de hacer", 598, 52, "end", "gl small acc") + '</g>'
            + '<g class="st3"><path class="lt dash" d="M100 266V252"/><path class="lt dash" d="M192 266V246"/>'
              '<path class="lt dash" d="M100 266H192"/>'
            + lab("this part cost money", "esta parte costó dinero", 146, 288) + '</g></svg>')

def vis_energy():
    # the energy went outward for years. The points it was aimed at had not moved, because they were not going anywhere.
    C = (320, 156)
    pts = [(320, 52), (446, 104), (424, 244), (216, 244), (194, 104)]
    import math as _m
    spokes = ""

    for x, y in pts:
        dx, dy = x - C[0], y - C[1]
        L = _m.hypot(dx, dy) or 1
        sx, sy = C[0] + dx / L * 26, C[1] + dy / L * 26
        ex, ey = x - dx / L * 12, y - dy / L * 12
        spokes += f'<path class="ln dr" pathLength="1" d="M{sx:.0f} {sy:.0f}L{ex:.0f} {ey:.0f}"/><circle class="dot" cx="{x}" cy="{y}" r="3"/>'
    rests = ""
    for x, y in pts:                       # outward along the spoke, so the rule never crosses the line that reaches it
        dx, dy = x - C[0], y - C[1]
        L = _m.hypot(dx, dy) or 1
        rx, ry = x + dx / L * 15, y + dy / L * 15
        rests += f'<path class="la" d="M{rx - 15:.0f} {ry:.0f}h30"/>' 
    return (svgopen(640, 300, "A centre point with five lines running outward to five other points. Under each outer point a short brass rule: they have not moved. A short clay line curves back into the centre.",
                    "Un punto central con cinco líneas que salen hacia otros cinco puntos. Bajo cada punto exterior, una regla corta de latón: no se han movido. Una línea corta de arcilla vuelve en curva hacia el centro.")
            + f'<g class="st1">{spokes}' + lab("the energy going out", "la energía saliendo", 320, 286) + '</g>'
            + f'<g class="st2">{rests}' + lab("they were already fine", "ya estaban bien", 320, 24) + '</g>'
            + '<g class="st3"><path class="lc dr" pathLength="1" d="M386 196C352 208 318 196 316 172"/>'
              f'<circle class="dotc" cx="{C[0]}" cy="{C[1]}" r="3.5"/>'
            + lab("back", "de vuelta", 400, 214, "start", "gl small acc") + '</g></svg>')

def vis_sides():
    # the same problem, twice. What changes is not the problem.
    def solid(cx):
        return (f'M{cx - 60} 150L{cx - 30} 104L{cx + 30} 104L{cx + 60} 150L{cx + 30} 196L{cx - 30} 196Z')
    low = lambda cx: f'M{cx - 60} 150L{cx + 60} 150L{cx + 30} 196L{cx - 30} 196Z'
    up = lambda cx: f'M{cx - 60} 150L{cx - 30} 104L{cx + 30} 104L{cx + 60} 150Z'
    return (svgopen(640, 300, "The same six-sided solid drawn twice. On the left one dashed sight line reaches it from below and a single face is shaded. On the right three sight lines reach it from below, from the left and from above, and three faces are shaded, one of them clay.",
                    "El mismo sólido de seis lados dibujado dos veces. A la izquierda, una línea de visión punteada llega desde abajo y una sola cara queda sombreada. A la derecha, tres líneas de visión llegan desde abajo, desde la izquierda y desde arriba, y tres caras quedan sombreadas, una de ellas de arcilla.")
            + f'<g class="st1"><path class="ln dr" pathLength="1" d="{solid(180)}"/><path class="ln dr" pathLength="1" d="{solid(462)}"/>'
            + lab("the same problem", "el mismo problema", 320, 254) + '</g>'
            + f'<g class="st2"><path class="fv" d="{low(180)}"/><path class="lt dash" d="M180 268V202"/>'
            + lab("depleted", "agotada", 180, 288) + '</g>'
            + f'<g class="st3"><path class="fv" d="{low(462)}"/><path class="fv" d="{up(462)}"/>'
              f'<path class="fc" d="M{462 + 60} 150L{462 + 30} 104L{462 + 30} 196Z"/>'
              '<path class="lt dash" d="M462 268V202"/><path class="lt dash" d="M336 128H396"/><path class="lt dash" d="M572 74L528 112"/>'
            + lab("rested", "descansada", 462, 288, "middle", "gl small acc") + '</g></svg>')

JVISUALS = {
    "on-learning-to-sit-still": (vis_line, "400,900,900", 0),
    "a-subdivision-begins-as-one-shape": (vis_subdivision, "500,1000,1000,1000,1000,1000,1000,1200", 1),
    "a-joint-venture-is-not-one-deal": (vis_jv, "500,1200,1300", 2),
    "a-contract-can-change-hands": (vis_novation, "500,1300,1300", 1),
    "the-deal-that-should-not-work": (vis_waterfall, "500,1200,1200", 2),
    "assumptions-cost-six-figures": (vis_title, "500,1300,1300", 3),
    "silence-is-thinking-space": (vis_frame, "500,1200,1200", 2),
    "the-deal-that-fell-through": (vis_fell, "500,1300,1300", 1),
    "specific-beats-polite": (vis_handoff, "500,1100,1100", 1),
    "made-of-concrete": (vis_pressure, "500,1200,1200", 1),
    "two-engineers-same-degree": (vis_twobars, "500,1200,1200", 0),
    "you-just-divide-up-land": (vis_plat, "500,1100,1300", 2),
    "demand-three-years-ago": (vis_lag, "500,1200,1300", 3),
    "the-right-to-build-is-made-at-a-counter": (vis_counter, "500,1200,1300", 2),
    "the-buyers-seat-on-day-one": (vis_dayone, "500,1300,1200", 1),
    "saving-and-standing-still": (vis_compound, "500,1200,1200", 4),
    "not-everyone-wants-to-be-lifted": (vis_energy, "500,1200,1200", 2),
    "the-body-goes-first": (vis_sides, "500,1200,1300", 3),
}
JPHOTOS = {"notes-on-land": ("assets/photos/turkiye-open-land.jpg", ("Open green land with a fence line and a hill of trees beyond", "Tierra verde abierta con una cerca y una colina de árboles al fondo"),
                             ("Open land", "Tierra abierta"), ("Türkiye · November 2025", "Türkiye · noviembre 2025"), 0)}

def jmargin(m):
    if not m:
        return ""
    src = tx("span", *m[1], cls="caps") if len(m) > 1 else ""
    return f'<aside class="jmargin" data-reveal data-late>{tx("p", *m[0])}{src}</aside>'

def jitems(items):
    out = ""
    for it in items:
        if isinstance(it, dict):
            rows = ""
            for q in it["q"]:
                if len(q) == 4:
                    rows += f'<div>{tx("dt", q[0], q[1], cls="caps")}{tx("dd", q[2], q[3])}</div>'
                else:
                    rows += f'<div>{tx("dd", q[0], q[1])}</div>'
            out += f'<dl class="jq" data-reveal>{rows}</dl>'
        elif isinstance(it, list):
            out += '<p class="stack" data-reveal>' + "".join(tx("span", en, es) for en, es in it) + '</p>'
        else:
            out += tx("p", *it, extra=" data-reveal")
    return out

def jvisual(slug, R, thumb=False):
    if slug in JVISUALS:
        fn, seq, at = JVISUALS[slug]
        if thumb:
            return f'<span class="jthumb jfig" aria-hidden="true">{fn()}</span>'
        caps = ('<ol class="jcaps">' + "".join(tx("li", en, es, cls=f"c{k + 1}") for k, (en, es) in enumerate(JCAPS[slug])) + '</ol>'
                if slug in JCAPS else "")
        return f'<figure class="mfig pfig jfig" data-seq="{seq}">{fn()}{caps}</figure>', at
    if slug in JPHOTOS:
        src, alt, name, facts, at = JPHOTOS[slug]
        if thumb:
            return f'<span class="jthumb photo" aria-hidden="true"><img src="{R}{src}" alt="" loading="lazy" decoding="async"></span>'
        return f'<figure class="jphoto" data-reveal>{frame("r32", img(R + src, alt))}{label(facts, name, reveal=False)}</figure>', at
    return ("", -1) if not thumb else ""

def journal():
    R = "../"
    items = "".join(
        f'<li class="jentry" data-reveal><a data-page href="{R}journal/{e["slug"]}/"><span class="jtext">{tx("div", *e["date"], cls="caps")}'
        f'{tx("h2", *e["title"], cls="jtitle")}{tx("p", *e["story"][0], cls="jexcerpt")}</span>{jvisual(e["slug"], R, thumb=True)}</a></li>'
        for e in ENTRIES)
    n = len(ENTRIES)
    body = (
        threshold(("I have never been good at stopping.", "Nunca he sabido detenerme."),
                  frame("r45", img(R + "assets/photos/looking-up.jpg", ("Looking up through an iron gate into the trees", "Mirando hacia arriba a través de una reja de hierro, entre los árboles"))),
                  (f"The Journal · {n} entries", f"El diario · {n} entradas"))
        + f'<section class="beat detail"><div class="wrap"><ol class="jlist">{items}</ol></div></section>'
        + turn(("Writing is the same line, only slower.", "Escribir es la misma línea, solo que más lenta."), colibri("mark small"))
        + rest(R, ("The next page is still blank.", "La próxima página sigue en blanco."), "days", center=True)
    )
    return page("journal", ("The Journal — Yeraldin Soto", "El diario — Yeraldin Soto"),
                ("Situations, observations and single ideas from land, deals and work — each with a drawing that helps explain it.",
                 "Situaciones, observaciones e ideas sueltas sobre la tierra, los negocios y el trabajo — cada una con un dibujo que ayuda a explicarla."), body)

def journal_entry(i):
    e, R = ENTRIES[i], "../../"
    newer = ENTRIES[i - 1] if i > 0 else None
    older = ENTRIES[i + 1] if i + 1 < len(ENTRIES) else None
    nav = ""
    if older:
        nav += f'<a data-page class="older" href="{R}journal/{older["slug"]}/">{tx("span", "Older", "Anterior", cls="caps")}{tx("span", *older["title"], cls="jn")}</a>'
    if newer:
        nav += f'<a data-page class="newer" href="{R}journal/{newer["slug"]}/">{tx("span", "Newer", "Más reciente", cls="caps")}{tx("span", *newer["title"], cls="jn")}</a>'
    fig, at = jvisual(e["slug"], R)
    story = e["story"]
    body_html = jitems(story[:at + 1]) + fig + jitems(story[at + 1:]) if at >= 0 else jitems(story)
    body = (f'<section class="beat"><div class="wrap">'
            f'<a class="jback caps" data-page href="{R}journal/">{tx("span", "The Journal", "El diario")}</a>'
            f'<div class="jpage"><article><header class="jhead">{tx("div", *e["date"], cls="caps")}{tx("h1", *e["title"])}</header>'
            f'<div class="jbody">{body_html}</div></article>{jmargin(e.get("margin"))}</div>'
            f'<nav class="jnav" aria-label="More entries" data-es-aria="Más entradas">{nav}</nav></div></section>')
    t = e["title"]
    return page(f'journal/{e["slug"]}', (f"{t[0]} — The Journal — Yeraldin Soto", f"{t[1]} — El diario — Yeraldin Soto"), story[0], body)

# ================================================================ THE DAYS — the prints
# file, kind (p portrait · l landscape · v video), code, place, month, number,
# saying, its language, source, translation EN, translation ES ("" = same language), alt
SAY = {"es": ("Spanish saying", "Dicho popular"), "it": ("Italian saying", "Dicho italiano"),
       "tr": ("Turkish saying", "Dicho turco"), "ar-Latn": ("Arabic saying", "Dicho árabe")}
FRAMES = [
 ("valley-dusk", "p", "COLOMBIA", ("Above the valley", "Sobre el valle"), ("August 2026", "agosto 2026"), ("", ""),
  "Poco a poco se anda lejos.", "es", "Little by little, one goes far.", "",
  ("A valley at dusk from above, the city lights coming on", "Un valle al atardecer desde lo alto, con las luces de la ciudad encendiéndose")),
 ("terrace-breakfast", "p", "COLOMBIA", ("Antioquia", "Antioquia"), ("August 2026", "agosto 2026"), ("", ""),
  "Al que madruga, Dios le ayuda.", "es", "God helps the one who rises early.", "",
  ("Breakfast on a terrace, a dog’s nose at the edge of the table", "Desayuno en una terraza, con la nariz de un perro al borde de la mesa")),
 ("antioquia-waterfall", "p", "COLOMBIA", ("Antioquia", "Antioquia"), ("August 2026", "agosto 2026"), ("6°05′ N", "6°05′ N"),
  "Agua que no has de beber, déjala correr.", "es", "Water you will not drink, let it run.", "",
  ("A waterfall through the forest under a moving sky", "Una cascada entre el bosque bajo un cielo en movimiento")),
 ("jardin-botanico-orchids", "p", "COLOMBIA", ("Jardín Botánico", "Jardín Botánico"), ("August 2026", "agosto 2026"), ("", ""),
  "El que siembra, recoge.", "es", "Whoever sows, gathers.", "",
  ("Magenta orchids at a botanical garden", "Orquídeas magenta en un jardín botánico")),
 ("barranquero", "p", "COLOMBIA", ("Antioquia", "Antioquia"), ("July 2026", "julio 2026"), ("", ""),
  "Más vale pájaro en mano que cien volando.", "es", "One bird in the hand is worth a hundred flying.", "",
  ("A barranquero on a mossy branch", "Un barranquero en una rama con musgo")),
 ("salento-window", "p", "COLOMBIA", ("Salento", "Salento"), ("June 2026", "junio 2026"), ("4°38′ N", "4°38′ N"),
  "Cuando una puerta se cierra, otra se abre.", "es", "When one door closes, another opens.", "",
  ("A square window full of palms and hills", "Una ventana cuadrada llena de palmas y montañas")),
 ("salento-church", "l", "COLOMBIA", ("Salento", "Salento"), ("June 2026", "junio 2026"), ("4°38′ N", "4°38′ N"),
  "A mal tiempo, buena cara.", "es", "In bad weather, a good face.", "",
  ("A church tower between palms, beside a white colonial wall", "La torre de una iglesia entre palmas, junto a un muro colonial blanco")),
 ("bucaramanga-night", "p", "COLOMBIA", ("Bucaramanga", "Bucaramanga"), ("December 2025", "diciembre 2025"), ("7°07′ N", "7°07′ N"),
  "No hay mal que por bien no venga.", "es", "There is no bad that does not bring some good.", "",
  ("Trees lit from below on a street at night", "Árboles iluminados desde abajo en una calle de noche")),
 ("bay-of-naples", "v", "ITALIA", ("Bay of Naples", "Bahía de Nápoles"), ("May 2026", "mayo 2026"), ("40°51′ N", "40°51′ N"),
  "Vedi Napoli e poi muori.", "it", "See Naples, and then die.", "Ve Nápoles y después muere.",
  ("A short film from the Bay of Naples", "Un corto de la bahía de Nápoles")),
 ("ischia-castello-sunset", "l", "ITALIA", ("Ischia", "Ischia"), ("May 2026", "mayo 2026"), ("40°44′ N", "40°44′ N"),
  "Dopo la pioggia viene il sereno.", "it", "After the rain comes the clear sky.", "Después de la lluvia llega el cielo despejado.",
  ("Castello Aragonese in silhouette as the sea turns gold", "El Castello Aragonese a contraluz mientras el mar se vuelve dorado")),
 ("procida-harbour", "l", "ITALIA", ("Procida", "Procida"), ("May 2026", "mayo 2026"), ("40°46′ N", "40°46′ N"),
  "Chi trova un amico trova un tesoro.", "it", "Whoever finds a friend finds a treasure.", "Quien encuentra un amigo encuentra un tesoro.",
  ("Pastel harbour houses with orange flowers in front", "Casas pastel del puerto con flores naranjas delante")),
 ("pompeii-cat", "p", "ITALIA", ("Pompeii", "Pompeya"), ("May 2026", "mayo 2026"), ("40°45′ N", "40°45′ N"),
  "Il dolce far niente.", "it", "The sweetness of doing nothing.", "La dulzura de no hacer nada.",
  ("A black cat asleep on stone", "Un gato negro dormido sobre la piedra")),
 ("rome-colosseum-night", "p", "ITALIA", ("Rome", "Roma"), ("May 2026", "mayo 2026"), ("41°53′ N", "41°53′ N"),
  "Roma non fu fatta in un giorno.", "it", "Rome was not built in a day.", "Roma no se hizo en un día.",
  ("The Colosseum lit at night", "El Coliseo iluminado de noche")),
 ("rome-flower-cafe", "p", "ITALIA", ("Rome", "Roma"), ("May 2026", "mayo 2026"), ("41°54′ N", "41°54′ N"),
  "Chi va piano va sano e va lontano.", "it", "Who goes slowly goes safely, and goes far.", "Quien va despacio va seguro y llega lejos.",
  ("A café terrace covered in flowers at night", "Una terraza de café cubierta de flores, de noche")),
 ("vatican-ceiling", "p", "ITALIA", ("Vatican City", "Ciudad del Vaticano"), ("May 2026", "mayo 2026"), ("41°54′ N", "41°54′ N"),
  "Il tempo è galantuomo.", "it", "Time is a gentleman. In the end, it sets things right.", "El tiempo es un caballero. Al final, pone las cosas en su sitio.",
  ("A painted and gilded ceiling", "Un techo pintado y dorado")),
 ("istanbul-bosphorus", "p", "TÜRKIYE", ("Istanbul", "Estambul"), ("November 2025", "noviembre 2025"), ("41°08′ N", "41°08′ N"),
  "Damlaya damlaya göl olur.", "tr", "Drop by drop, a lake is made.", "Gota a gota se forma un lago.",
  ("Cloud over the Bosphorus, two boats on the water", "Nubes sobre el Bósforo, dos barcos en el agua")),
 ("dubai-beach-dusk", "p", "DUBAI", ("Dubai", "Dubái"), ("November 2025", "noviembre 2025"), ("25°12′ N", "25°12′ N"),
  "Al-jār qabl ad-dār.", "ar-Latn", "The neighbour before the house.", "El vecino antes que la casa.",
  ("Palms on a dark beach at dusk", "Palmeras en una playa oscura al anochecer")),
 ("dubai-gulls", "p", "DUBAI", ("Dubai", "Dubái"), ("November 2025", "noviembre 2025"), ("25°12′ N", "25°12′ N"),
  "Ar-rafīq qabl at-tarīq.", "ar-Latn", "The companion before the road.", "El compañero antes que el camino.",
  ("Gulls on rope posts at sunset", "Gaviotas sobre postes de cuerda al atardecer")),
 ("dubai-coral-flower", "p", "DUBAI", ("Dubai", "Dubái"), ("November 2025", "noviembre 2025"), ("25°12′ N", "25°12′ N"),
  "As-sabr miftāh al-faraj.", "ar-Latn", "Patience is the key to relief.", "La paciencia es la llave del alivio.",
  ("A coral flower among striped leaves", "Una flor coral entre hojas rayadas")),
]

# ---------------------------------------------------------------- the prints
# The Days is not a grid or a strip (her brief): a photograph arrives as paper, develops, and — only
# where real footage exists — the memory inside it moves once (js/motion.js, prints()). Text first:
# each set is led by one small observation of hers, or, where she has none, by the saying of its first
# photograph. The other prints carry their sayings under their labels. Only pretty photographs.
DAY_SETS = [
    (("The coffee was still warm. Nothing needed anything from me yet.", "El café todavía estaba caliente. Nada necesitaba nada de mí todavía."),
     ["terrace-breakfast", "valley-dusk"]),
    (("A new root. I almost missed it.", "Una raíz nueva. Casi no la veo."),
     ["jardin-botanico-orchids", "barranquero", "antioquia-waterfall"]),
    (None, ["salento-window", "salento-church"]),
    (None, ["bucaramanga-night"]),
    (("We had nowhere else to be for an hour.", "No teníamos que estar en ningún otro lugar durante una hora."),
     ["bay-of-naples", "procida-harbour"]),
    (("The light stayed longer than we did.", "La luz se quedó más tiempo que nosotros."),
     ["ischia-castello-sunset", "pompeii-cat"]),
    (None, ["rome-colosseum-night", "rome-flower-cafe", "vatican-ceiling"]),
    (None, ["istanbul-bosphorus"]),
    (None, ["dubai-beach-dusk", "dubai-gulls", "dubai-coral-flower"]),
]
FRAME_BY = {f[0]: f for f in FRAMES}
PRINT_TILT = ["-2.2deg", "1.6deg", "-1deg"]   # never more than a few degrees, never random

def saying_html(f):
    _, _, _, _, _, _, saying, lng, tr_en, tr_es, _ = f
    return (f'{tx("span", *SAY[lng], cls="caps src")}<q class="say" lang="{lng}">{html.escape(saying)}</q>'
            f'{tx("span", tr_en, tr_es, cls="tr")}')

def day_print(f, j, R, with_saying):
    file, kind, code, place, month, num, saying, lng, tr_en, tr_es, alt = f
    P = R + "assets/photos/"
    dev = f' class="dev" alt="{A(alt[0])}" data-es-alt="{A(alt[1])}" loading="lazy" decoding="async" draggable="false"'
    if kind == "v":
        # the poster develops as a photograph; the real footage inside it plays once, then rests on its last frame
        media = (f'<img src="{P}{file}-poster.jpg"{dev}>'
                 f'<video class="memory" muted playsinline preload="none" data-src="{P}{file}-montage.mp4" aria-hidden="true" tabindex="-1"></video>')
        sound = '<button type="button" class="sound caps" aria-pressed="false" data-es="Sonido">Sound</button>'
    else:
        media = f'<img src="{P}{file}.jpg"{dev}>'
        sound = ""
    country = "Türkiye" if code == "TÜRKIYE" else code.title()
    facts = tuple(" · ".join(x for x in (country, month[k], num[k]) if x) for k in (0, 1))
    return (f'<figure class="print {kind}" data-state="idle" style="--rot:{PRINT_TILT[j % 3]}">'
            f'<button type="button" class="paper" aria-label="Open the photograph: {A(place[0])}" data-es-aria="Abrir la fotografía: {A(place[1])}">'
            f'<span class="pic">{media}</span></button>'
            f'<figcaption><span class="wipe"></span>{tx("span", *place, cls="name")}{tx("span", *facts, cls="caps facts")}'
            f'{saying_html(f) if with_saying else ""}{sound}</figcaption></figure>')

# the instant camera each set's Polaroids come out of (her ask) — a line drawing, the slot at y 98
# (js/motion.js reads that); no brand stripe, no logo
CAMERA = ('<svg class="cam" viewBox="0 0 160 120" fill="none" stroke="currentColor" stroke-width="1.4" '
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
          '<path class="body" d="M10 34 H150 V106 H10 Z"/><path d="M22 34 L32 18 H128 L138 34"/>'
          '<circle cx="80" cy="66" r="22"/><circle cx="80" cy="66" r="11"/>'
          '<path d="M110 42 H136 V54 H110 Z"/><path d="M24 42 H48 V50 H24 Z"/><path d="M34 98 H126"/></svg>')

def day_set(i, lead, names, R):
    fs = [FRAME_BY[n] for n in names]
    words = tx("p", *lead, cls="dline") if lead else saying_html(fs[0])
    prints = "".join(day_print(f, j, R, with_saying=bool(lead) or j > 0) for j, f in enumerate(fs))
    return (f'<div class="dset n{len(fs)}{" flip" if i % 2 else ""}" data-set>'
            f'<div class="dlead" data-reveal>{words}</div><div class="dprints">{CAMERA}{prints}</div></div>')

def days():
    R = "../"
    sets = "".join(day_set(i, lead, names, R) for i, (lead, names) in enumerate(DAY_SETS))
    prints = (f'<section class="prints" aria-labelledby="prints-t"><div class="wrap">'
              f'{tx("h2", f"The days · {len(FRAMES)} prints", f"Los días · {len(FRAMES)} copias", cls="caps", extra=PRINTSID)}'
              f'{sets}</div>'
              f'<dialog class="viewer" aria-label="Photograph" data-es-aria="Fotografía">'
              f'<button type="button" class="vclose caps" data-es="Cerrar">Close</button>'
              f'<div class="vmedia"></div><div class="vcap"></div></dialog></section>')
    body = (
        threshold(("A photograph, a place, and what the place says.", "Una fotografía, un lugar y lo que ese lugar dice."),
                  frame("r45", img(R + "assets/photos/quindio-colibri.jpg", ("A hummingbird at an orange feeder", "Un colibrí en un bebedero naranja"))),
                  ("Colibrí · Quindío · June 2026", "Colibrí · Quindío · junio 2026"))
        + prints
        + turn(("A photograph is a line drawn with light.", "Una fotografía es una línea dibujada con luz."))
        + rest(R, ("Not every day gets a picture.", "No todos los días tienen foto."), "aerodrome", center=True)
    )
    return page("days", ("The Days — Yeraldin Soto", "Los días — Yeraldin Soto"),
                ("Prints of ordinary days in Colombia, Italy, Istanbul and Dubai: each develops as it arrives, with a saying from the place it was taken.",
                 "Copias de días comunes en Colombia, Italia, Estambul y Dubái: cada una se revela al llegar, con un dicho del lugar donde fue tomada."), body)

# ================================================================ THE AERODROME
# A block-built model of her thesis (aerodrome-3d/, three.js from the CDN). Every number shown is from the
# thesis tables; the geometry lives once, in aerodrome-3d/data.js. AV stamps the modules like FV does the film.
AERO = os.path.join(ROOT, "aerodrome-3d")
AERO_MODULES = sorted(n for n in os.listdir(AERO) if n.endswith(".js"))
def _aero_version():
    h = hashlib.sha1()
    for n in AERO_MODULES:
        with open(os.path.join(AERO, n), "rb") as f:
            h.update(n.encode() + f.read())
    return h.hexdigest()[:10]
AV = _aero_version()
THESIS_PDF = "assets/docs/aerodrome-thesis-soto-cetina-mondragon.pdf"
THESIS_MB = os.path.getsize(os.path.join(ROOT, THESIS_PDF)) / 1e6

AERO_STATES = [("PARKED", "Parked", "Estacionado"), ("TAXIING", "Taxiing", "Rodando"), ("HOLDING", "Holding short", "En espera"),
               ("TURNING", "Turning onto the runway", "Entrando a la pista"), ("LINED_UP", "Lined up", "Alineado"),
               ("ACCELERATING", "Accelerating", "Acelerando"), ("ROTATING", "Rotating", "Rotando"), ("AIRBORNE", "Airborne", "En el aire")]

def aero_note(name, facts, at):
    return f'<div class="aero-item aero-panel aero-note" data-at="{at}">{label(facts, name, reveal=False)}</div>'

def aero_at(a, b):
    """A moment of the first score, placed on today's track (M in aerodrome-3d/main.js — keep the two identical)."""
    return f"{aero_m(a):.4f},{aero_m(b):.4f}"

# the names on the map while the camera looks east over Bogotá (positions live in aerodrome-3d/data.js PLACES)
AERO_GEO = [("annex", "Annex · 13C–31C", "Anexo · 13C–31C"), ("river", "Río Bogotá", "Río Bogotá"),
            ("eldorado", "El Dorado", "El Dorado"), ("bogota", "Bogotá", "Bogotá"), ("cerros", "Cerros Orientales", "Cerros Orientales")]

# ---------------------------------------------------------------- the technical sheet (her ask: a technical chart)
# Every value from the thesis, cited by table and page (extracted and checked 2026-09-13).
SHEET = [
    (("Design aircraft", "Avión de diseño"), ("Airbus A321-200 · 35.8 m span · 83,000 kg", "Airbus A321-200 · 35,8 m de envergadura · 83.000 kg"), "pp.17–20"),
    (("Reference code", "Clave de referencia"), ("4C", "4C"), "p.19"),
    (("Runway 13C–31C", "Pista 13C–31C"), ("2,102.22 m × 45 m", "2.102,22 m × 45 m"), "Tables 3, 7 · pp.20–24"),
    (("Declared distances", "Distancias declaradas"), ("TORA, ASDA, LDA 2,102.22 m · TODA 2,402.22 m", "TORA, ASDA, LDA 2.102,22 m · TODA 2.402,22 m"), "Table 7 · p.24"),
    (("Runway strip", "Franja de pista"), ("150 m wide · 60 m beyond each end", "150 m de ancho · 60 m más allá de cada extremo"), "Table 5 · p.22"),
    (("RESA", "RESA"), ("240 m × 90 m", "240 m × 90 m"), "Table 6 · p.23"),
    (("Clearway · stopway", "Zona libre · zona de parada"), ("300 m × 150 m · 341 m × 45 m", "300 m × 150 m · 341 m × 45 m"), "Table 6 · p.23"),
    (("Parallel taxiway", "Calle de rodaje paralela"), ("15 m wide · 190 m from the runway centreline · holding point at 90 m", "15 m de ancho · a 190 m del eje de pista · punto de espera a 90 m"), "Table 8 · pp.25–26"),
    (("Holding bay", "Apartadero de espera"), ("61 m long · curve radius 69.24 m", "61 m de largo · radio de curva 69,24 m"), "Table 8 · p.26"),
    (("Rapid exits", "Salidas rápidas"), ("2 · 30° · radius 550 m · exit speed 96.3 km/h", "2 · 30° · radio 550 m · velocidad de salida 96,3 km/h"), "Table 8 · p.28"),
    (("Design conditions", "Condiciones de diseño"), ("2,548 m elevation · reference temperature 20 °C", "2.548 m de elevación · temperatura de referencia 20 °C"), "Table 4 · p.21"),
    (("Cross slopes", "Pendientes transversales"), ("Runway 1.1% · strip 1.5%", "Pista 1,1 % · franja 1,5 %"), "Table 14 · p.34"),
]
def src_pair(s): return (s, re.sub(r"\b(pp?)\.(\d)", r"\1. \2", s.replace("Tables", "Tablas").replace("Table", "Tabla")))

def pave_svg():
    layers = [(16, 50, 'fill="currentColor" fill-opacity=".9"', ("HMA surface", "Capa de rodadura HMA"), ("102 mm", "102 mm")),
              (50, 92, 'fill="currentColor" fill-opacity=".42"', ("Stabilised base, HMA", "Base estabilizada HMA"), ("127 mm", "127 mm")),
              (92, 222, 'fill="url(#pv-agg)"', ("P-209 crushed aggregate", "Agregado triturado P-209"), ("1,530 mm", "1.530 mm")),
              (222, 290, 'fill="url(#pv-sub)"', ("Subgrade", "Subrasante"), ("CBR 1.22%", "CBR 1,22 %"))]
    out = ('<svg class="pave" viewBox="0 0 420 300" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><defs>'
           '<pattern id="pv-agg" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="currentColor" stroke="none"/><circle cx="8" cy="7.5" r="1" fill="currentColor" stroke="none"/></pattern>'
           '<pattern id="pv-sub" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 V8" stroke="currentColor" stroke-width=".8"/></pattern></defs>')
    for i, (y0, y1, fill, name, val) in enumerate(layers):
        out += f'<rect x="12" y="{y0}" width="158" height="{y1 - y0}" {fill} stroke="none"/>'
        if i < 3:
            out += f'<rect x="12" y="{y0}" width="158" height="{y1 - y0}"/>'
        mid = (y0 + y1) / 2
        out += f'<path d="M170 {mid:.0f} H186"/>' + svg_label(*name, 194, mid - 3, cls="pn") + svg_label(*val, 194, mid + 15, cls="pv")
    out += '<path d="M12 222 V290 M170 222 V290"/>'
    # the aggregate is far deeper than drawn: a break says so
    out += '<path d="M8 146 L40 140 L72 150 L104 140 L136 150 L174 142 V160 L136 168 L104 158 L72 168 L40 158 L8 164 Z" fill="#F5EFE4"/>'
    return out + '</svg>'

def lengths_svg():
    k = 380 / 4000
    ticks = "".join(f'<path d="M{20 + km * 1000 * k:.1f} 146 V152"/>' + svg_label(f"{km}" + (" km" if km == 4 else ""), f"{km}" + (" km" if km == 4 else ""), 20 + km * 1000 * k, 168, anchor="middle", cls="pv")
                    for km in range(5))
    return ('<svg class="lengths" viewBox="0 0 420 176" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">'
            + svg_label("El Dorado · 2 runways × 3,800 m", "El Dorado · 2 pistas × 3.800 m", 20, 26, cls="pn")
            + f'<rect x="20" y="36" width="{3800 * k:.1f}" height="9" fill="currentColor" stroke="none"/><rect x="20" y="50" width="{3800 * k:.1f}" height="9" fill="currentColor" stroke="none"/>'
            + svg_label("The annex · 13C–31C · 2,102 m", "El anexo · 13C–31C · 2.102 m", 20, 92, cls="pn")
            + f'<rect x="20.5" y="102.5" width="{2102.22 * k:.1f}" height="9"/>'
            + '<path d="M20 146 H400"/>' + ticks + '</svg>')

def aero_sheet():
    rows = "".join(f'<div class="srow">{tx("dt", *lab, cls="caps")}<dd>{tx("span", *val, cls="sv")}{tx("span", *src_pair(src), cls="caps ssrc")}</dd></div>'
                   for lab, val, src in SHEET)
    pave = (f'<figure class="sfig" data-reveal>{pave_svg()}'
            + label(("Flexible · FAARFIELD 2.0 · 20-year design · Table 12, p.32", "Flexible · FAARFIELD 2.0 · diseño a 20 años · Tabla 12, p. 32"), ("Pavement section", "Sección del pavimento"), reveal=False)
            + '</figure>')
    lengths = (f'<figure class="sfig" data-reveal>{lengths_svg()}'
               + label(("Annex C, p.50 · Table 7, p.24", "Anexo C, p. 50 · Tabla 7, p. 24"), ("Runway lengths", "Longitudes de pista"), reveal=False)
               + '</figure>')
    return (f'<section class="beat paper aero-sheet"><div class="wrap">'
            + tx("div", f"Technical sheet · {len(SHEET)} parameters", f"Ficha técnica · {len(SHEET)} parámetros", cls="caps kicker", extra=" data-reveal")
            + tx("h2", "The numbers the drawing was built on.", "Los números sobre los que se construyó el dibujo.", cls="sheet-h", extra=" data-reveal")
            + f'<div class="sheet-grid"><dl class="sheet" data-reveal>{rows}</dl><div class="sheet-figs">{pave}{lengths}</div></div>'
            + tx("p", "Every value is from the thesis, cited by table and page. The annex sits beside El Dorado as the thesis’s site figure shows it (Ilustración 1, p.14); the spacing of El Dorado’s runways comes from their published coordinates; the city, river and hills around them are schematic.",
                 "Cada valor viene de la tesis, citado por tabla y página. El anexo está junto a El Dorado como lo muestra la figura del sitio de la tesis (Ilustración 1, p. 14); la separación de las pistas de El Dorado viene de sus coordenadas publicadas; la ciudad, el río y los cerros alrededor son esquemáticos.", cls="sheet-note")
            + '</div></section>')

def aerodrome():
    R = "../"
    en, es = "Before land, I designed somewhere to land.", "Antes de la tierra, diseñé un lugar donde aterrizar."
    stop = '<span class="stop">.</span>'
    first = f'<div class="aero-item aero-panel" data-at="{aero_at(0, .20)}"><h1 class="aero-line" data-es-html="{A(H(es[:-1]) + stop)}">{H(en[:-1])}{stop}</h1></div>'
    states = "".join(tx("span", e, s, cls="aero-state caps", extra=f' data-s="{k}"') for k, e, s in AERO_STATES)
    mb_en, mb_es = f"{THESIS_MB:.1f}", f"{THESIS_MB:.1f}".replace(".", ",")
    ident = (
        f'<div class="aero-item aero-panel aero-id" data-at="{aero_at(.80, .885)}">'
        + tx("p", "Civil engineering thesis · 2022", "Tesis de ingeniería civil · 2022", cls="caps aero-kicker")
        + tx("p", "An annex aerodrome for domestic flights", "Un aeródromo anexo para vuelos nacionales", cls="aero-idname")
        + '<p class="aero-authors">Diego Fernando Cetina Guzmán · Germán David Mondragón Montoya · Yeraldin Soto Castro</p>'
        + tx("p", "Begun at the University of the Basque Country; finished and presented at Universidad Cooperativa de Colombia.",
             "Empezada en la Universidad del País Vasco; terminada y sustentada en la Universidad Cooperativa de Colombia.", cls="aero-where")
        + f'<a class="aero-read" href="{R}{THESIS_PDF}" target="_blank" rel="noopener">{tx("span", "Read the thesis", "Leer la tesis")}'
        + tx("span", f"PDF · {mb_en} MB · CC BY-NC-ND", f"PDF · {mb_es} MB · CC BY-NC-ND", cls="caps")
        + '</a></div>')
    geo = "".join(f'<span class="aero-geo" data-geo="{k}">{tx("span", en, es, cls="caps")}</span>' for k, en, es in AERO_GEO)
    text = (
        geo
        + first
        + f'<div class="aero-item aero-panel" data-at="{aero_at(.20, .30)}">{tx("p", "An annex aerodrome for domestic flights, so El Dorado could keep its runways for the world.", "Un aeródromo anexo para vuelos nacionales, para que El Dorado guardara sus pistas para el mundo.", cls="aero-line")}</div>'
        + aero_note(("Runway 13C–31C", "Pista 13C–31C"), ("2,100 m × 45 m", "2.100 m × 45 m"), aero_at(.405, .455))
        + aero_note(("Parallel taxiway", "Calle de rodaje paralela"), ("15 m wide · 190 m from the runway", "15 m de ancho · a 190 m de la pista"), aero_at(.46, .505))
        + aero_note(("Two rapid exits, two holding bays", "Dos salidas rápidas, dos apartaderos"), ("Exits at 30° · bays for 2 × A321", "Salidas a 30° · apartaderos para 2 × A321"), aero_at(.51, .545))
        + f'<div class="aero-item aero-panel" data-at="{aero_at(.545, .585)}">{tx("p", "It was designed around one aircraft.", "Fue diseñado alrededor de un solo avión.", cls="aero-line")}</div>'
        + f'<div class="aero-item aero-panel aero-note aero-flight" data-flight>{label(("Reference code 4-C", "Clave de referencia 4-C"), ("Design aircraft · Airbus A321", "Avión de diseño · Airbus A321"), reveal=False)}<div class="aero-states">{states}</div></div>'
        + aero_note(("Aeropuerto Internacional El Dorado", "Aeropuerto Internacional El Dorado"), ("Bogotá · 2,548 m · 2 runways × 3,800 m", "Bogotá · 2.548 m · 2 pistas × 3.800 m"), ".672,.74")
        + f'<div class="aero-item aero-panel" data-at=".745,.815">{tx("p", "Beside El Dorado, across the Río Bogotá: a runway for domestic flights.", "Junto a El Dorado, al otro lado del río Bogotá: una pista para vuelos nacionales.", cls="aero-line")}</div>'
        + ident
        + f'<div class="aero-item aero-last" data-last>{tx("p", "Some lines stay with you.", "Algunas líneas se quedan contigo.", cls="aero-line")}'
        # her ask: say it was made by her, as the Work film does
        + tx("p", "Designed and programmed by Yeraldin Soto", "Diseñado y programado por Yeraldin Soto", cls="caps aero-credit") + '</div>'
    )
    imports = {"three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
               "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}
    imports.update({f"{R}aerodrome-3d/{n}": f"{R}aerodrome-3d/{n}?v={AV}" for n in AERO_MODULES})
    body = (
        '<section class="aero" data-aero aria-label="The aerodrome, built from the thesis" data-es-aria="El aeródromo, construido desde la tesis">'
        '<div class="aero-track"><div class="aero-stage">'
        '<div class="aero-view" aria-hidden="true"><div class="aero-canvas"></div><div class="aero-veil"></div>'
        f'<svg class="aero-plan" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><g class="aero-lines"></g><g class="aero-plane">{PAPER_PLANE}</g></svg></div>'
        f'<div class="aero-text">{text}</div>'
        # her ask: the same "keep scrolling" tab as The Work, filling as the story goes, gone before the ending
        f'<div class="ws-more aero-more" aria-hidden="true">{more_next(AERO_NEXT)}<span class="ws-more-line"><i></i></span>'
        f'{tx("span", "Keep scrolling", "Sigue bajando", cls="caps")}</div>'
        '</div></div></section>'
        + f'<script type="importmap">{json.dumps({"imports": imports})}</script>'
        + f'<script type="module" src="{R}aerodrome-3d/main.js?v={AV}"></script>'
        + aero_sheet()
        + rest(R, ("Aircraft land into the wind.", "Los aviones aterrizan contra el viento."), "", center=True)
    )
    return page("aerodrome", ("The Aerodrome — Yeraldin Soto", "El aeródromo — Yeraldin Soto"),
                ("My civil engineering thesis: an aerodrome for domestic flights, so the main airport could serve international flights alone. Begun in Bilbao at the University of the Basque Country; presented at Universidad Cooperativa de Colombia.",
                 "Mi tesis de ingeniería civil: un aeródromo para vuelos nacionales, para que el aeropuerto principal atendiera solo vuelos internacionales. Empezada en Bilbao en la Universidad del País Vasco; sustentada en la Universidad Cooperativa de Colombia."), body)

# ================================================================ INSIDE MY MIND
# How she reasons, shown as situations first (her master brief): a system that comes apart into its
# parts as the reader scrolls, six plan-cabinet drawers — a scene, one drawing that answers it, the idea
# underneath, a question to keep — and the same system again at the end, now readable. The material is
# her own writing (her LinkedIn posts), rewritten for the site; nothing is pasted.
def svg_label(en, es, x, y, anchor="start", cls="gl"):
    return tx("text", en, es, cls=cls, extra=f' x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}"')

LABEL_AT = {"above": (0, -13, "middle"), "below": (0, 22, "middle"), "left": (-11, 4, "end"), "right": (11, 4, "start")}

def graph_svg(cls, w, h, nodes, edges, sag, aria, key=None):
    """nodes: (id, en, es, (ax, ay) tangled, (bx, by) resolved, label side). Rendered resolved; js/motion.js
    moves it from tangled to resolved and bends each edge by `sag` as it relaxes."""
    idx = {n[0]: i for i, n in enumerate(nodes)}
    def curve(p, q):
        mx, my, dx, dy = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, q[0] - p[0], q[1] - p[1]
        L = math.hypot(dx, dy) or 1
        return f"M{p[0]:.1f} {p[1]:.1f}Q{mx - dy / L * sag:.1f} {my + dx / L * sag:.1f} {q[0]:.1f} {q[1]:.1f}"
    es_ = "".join(f'<path class="ge" data-i="{idx[a]}" data-j="{idx[b]}" d="{curve(nodes[idx[a]][4], nodes[idx[b]][4])}"/>' for a, b in edges)
    ns = ""
    for nid, en, es, (ax, ay), (bx, by), side in nodes:
        lx, ly, anchor = LABEL_AT[side]
        ring = '<circle class="kring" r="15"/>' if nid == key else ""
        ns += (f'<g class="gnode" transform="translate({bx} {by})" data-ax="{ax}" data-ay="{ay}" data-bx="{bx}" data-by="{by}">'
               f'{ring}<circle r="4.5"/>{svg_label(en, es, lx, ly, anchor)}</g>')
    return (f'<svg class="{cls}" viewBox="0 0 {w} {h}" data-sag="{sag}" role="img" aria-label="{A(aria[0])}" data-es-aria="{A(aria[1])}">'
            f'{es_}{ns}</svg>')

SYSTEM_NODES = [
    ("facts", "facts", "hechos", (382, 204), (120, 110), "above"),
    ("assumptions", "assumptions", "supuestos", (436, 246), (313, 110), "above"),
    ("people", "people", "personas", (352, 262), (487, 110), "above"),
    ("timing", "timing", "tiempos", (458, 188), (680, 110), "above"),
    ("constraints", "constraints", "restricciones", (402, 280), (120, 330), "below"),
    ("communication", "communication", "comunicación", (334, 212), (313, 330), "below"),
    ("risk", "risk", "riesgo", (422, 168), (487, 330), "below"),
    ("decision", "decision", "decisión", (372, 238), (680, 330), "below"),
]
SYSTEM_EDGES = [("facts", "assumptions"), ("assumptions", "risk"), ("assumptions", "communication"), ("people", "communication"),
                ("people", "timing"), ("timing", "constraints"), ("constraints", "risk"), ("risk", "decision"),
                ("communication", "decision"), ("facts", "decision"), ("people", "decision"), ("timing", "risk"), ("facts", "constraints")]
SYSTEM_ARIA = ("One problem drawn as a system: facts, assumptions, people, timing, constraints, communication, risk and a decision, all connected.",
               "Un problema dibujado como sistema: hechos, supuestos, personas, tiempos, restricciones, comunicación, riesgo y una decisión, todos conectados.")

def fig_leverage():
    nodes = [
        ("symptom", "symptom", "síntoma", (320, 122), (320, 52), "above"),
        ("process", "process", "proceso", (262, 184), (124, 170), "left"),
        ("ownership", "ownership", "responsable", (320, 196), (320, 208), "below"),
        ("information", "information", "información", (378, 184), (516, 170), "right"),
        ("constraint", "constraint", "restricción", (320, 262), (320, 332), "below"),
    ]
    edges = [("symptom", "process"), ("symptom", "information"), ("symptom", "ownership"), ("process", "ownership"),
             ("information", "ownership"), ("ownership", "constraint"), ("process", "constraint"), ("information", "constraint")]
    return graph_svg("mfig-svg mfig-graph", 640, 380, nodes, edges, 16,
                     ("A tight network of symptom, process, ownership, information and constraint; once ownership changes, the whole network relaxes.",
                      "Una red tensa de síntoma, proceso, responsable, información y restricción; cuando cambia el responsable, toda la red se relaja."),
                     key="ownership")

def fig_pause():
    return ('<svg class="mfig-svg" viewBox="0 0 640 300" role="img" aria-label="A message arrives and a reaction spikes at once; a pause opens a question before a calm response." '
            'data-es-aria="Llega un mensaje y la reacción se dispara de inmediato; una pausa abre una pregunta antes de una respuesta tranquila.">'
            '<path class="base" d="M40 170H600"/><path d="M180 158V182"/>'
            + svg_label("the message", "el mensaje", 180, 207, "middle", "gl small")
            + '<path class="spike" pathLength="1" d="M184 170C204 170 206 64 236 52"/>'
            '<path class="gap" pathLength="1" d="M184 124H440"/>'
            + svg_label("a question", "una pregunta", 312, 110, "middle", "gl small gapl")
            + '<g class="resp"><path d="M440 158V182"/>' + svg_label("the response", "la respuesta", 440, 207, "middle", "gl small") + '</g>'
            '<path class="calm" pathLength="1" d="M444 170C474 146 512 146 544 170"/></svg>')

def fig_authority():
    cx, cy = 320, 190
    far = near = frames = people = probs = ""
    for k, deg in enumerate((-90, -30, 30, 90, 150, 210)):
        a = math.radians(deg)
        px, py, qx, qy = cx + 128 * math.cos(a), cy + 128 * math.sin(a), cx + 170 * math.cos(a), cy + 170 * math.sin(a)
        mx, my = (px + qx) / 2, (py + qy) / 2
        far += f'<path class="far" style="--i:{k}" pathLength="1" d="M{px:.1f} {py:.1f}L{cx} {cy}"/>'
        near += f'<path class="near" style="--i:{k}" pathLength="1" d="M{px:.1f} {py:.1f}L{qx:.1f} {qy:.1f}"/>'
        frames += f'<rect class="frame-b" style="--i:{k}" x="{mx - 36:.1f}" y="{my - 20:.1f}" width="72" height="40" transform="rotate({deg} {mx:.1f} {my:.1f})"/>'
        people += f'<circle class="person" cx="{px:.1f}" cy="{py:.1f}" r="5"/>'
        probs += f'<circle class="problem" cx="{qx:.1f}" cy="{qy:.1f}" r="3.5"/>'
    queue = "".join(f'<circle class="q" style="--i:{k}" cx="{285 + k * 14}" cy="226" r="3"/>' for k in range(6))
    hub = f'<g class="hub"><circle cx="{cx}" cy="{cy}" r="12"/>{svg_label("one decision-maker", "una sola persona decide", cx, cy - 22, "middle", "gl small")}</g>'
    return ('<svg class="mfig-svg" viewBox="0 0 640 380" role="img" aria-label="Every decision line runs to one person and waits in a queue; then authority moves to the people closest to each problem, inside clear boundaries." '
            'data-es-aria="Cada decisión va a una sola persona y espera en fila; luego la autoridad pasa a quienes están más cerca de cada problema, dentro de límites claros.">'
            f'{far}{frames}{near}{queue}{hub}{people}{probs}</svg>')

def fig_travel():
    ds = [("legal", "legal", (100, 78), (236, 118), "end"), ("engineering", "ingeniería", (540, 78), (404, 118), "start"),
          ("underwriting", "análisis", (90, 190), (222, 190), "end"), ("construction", "construcción", (556, 190), (418, 236), "start"),
          ("brokerage", "corretaje", (100, 306), (236, 262), "end"), ("survey", "topografía", (540, 306), (404, 262), "start")]
    discs = ""
    for k, (en, es, (x, y), (px, py), anchor) in enumerate(ds):
        lx = x - 10 if anchor == "end" else x + 10
        discs += (f'<g class="disc" style="--i:{k}"><path class="link" d="M{x} {y}L{px} {py}"/><circle cx="{x}" cy="{y}" r="4"/>'
                  f'<circle class="lit" cx="{px}" cy="{py}" r="5"/>{svg_label(en, es, lx, y + 4, anchor, "gl small")}</g>')
    return ('<svg class="mfig-svg" viewBox="0 0 640 380" role="img" aria-label="One parcel in the middle, six disciplines around it each seeing one part; a missing piece travels from legal to the gap and completes the drawing." '
            'data-es-aria="Un terreno en el centro y seis disciplinas alrededor, cada una viendo una parte; una pieza que faltaba viaja desde lo legal hasta el hueco y completa el dibujo.">'
            '<path class="parcel" d="M220 110H420V160M420 210V270H220Z"/><path class="lots" d="M270 110V270M320 110V270M370 110V270"/>'
            f'{discs}<path class="missing" pathLength="1" d="M420 160V210"/>'
            '<rect class="packet" x="95" y="73" width="10" height="10" style="--tx:320px;--ty:107px"/></svg>')

def fig_orbit():
    cx, cy = 320, 238
    tasks = [("follow-ups", "seguimientos"), ("formatting", "formato"), ("scheduled checks", "revisiones programadas"), ("recurring research", "investigación recurrente"),
             ("moving data", "mover datos"), ("routine summaries", "resúmenes de rutina"), ("repeated prompts", "instrucciones repetidas"), ("routing information", "enrutar información")]
    kept = [("judgment", "criterio"), ("risk", "riesgo"), ("negotiation", "negociación"), ("relationships", "relaciones"), ("deal structure", "estructura"), ("decisions", "decisiones")]
    g = ""
    for k, (en, es) in enumerate(tasks):
        a = math.radians(-90 + k * 45)
        c, s = math.cos(a), math.sin(a)
        x, y = cx + 148 * c, cy + 148 * s
        anchor = "middle" if abs(c) < 0.3 else ("start" if c > 0 else "end")
        lx = 0 if anchor == "middle" else (10 if anchor == "start" else -10)
        ly = -12 if s < -0.3 else (21 if s > 0.3 else 4)
        g += (f'<g class="task" style="--i:{k};--dx:{70 * c:.1f}px;--dy:{70 * s:.1f}px"><g transform="translate({x:.1f} {y:.1f})">'
              f'<circle r="4"/>{svg_label(en, es, lx, ly, anchor, "gl small")}</g></g>')
    inner = ""
    for k, (en, es) in enumerate(kept):
        a = math.radians(-90 + k * 60)
        inner += f'<g class="kept" style="--i:{k}">{svg_label(en, es, cx + 62 * math.cos(a), cy + 62 * math.sin(a) + 4, "middle", "gl small")}</g>'
    return ('<svg class="mfig-svg" viewBox="0 0 640 476" role="img" aria-label="Repetitive tasks circle a person, then move out one by one into automated loops; judgment, risk, negotiation, relationships, deal structure and decisions stay close." '
            'data-es-aria="Tareas repetitivas giran alrededor de una persona y luego salen una a una hacia ciclos automáticos; el criterio, el riesgo, la negociación, las relaciones, la estructura y las decisiones se quedan cerca.">'
            f'<circle class="loops" cx="{cx}" cy="{cy}" r="218"/><circle class="orbit" cx="{cx}" cy="{cy}" r="148"/><circle class="core" cx="{cx}" cy="{cy}" r="96"/>'
            f'{g}{inner}</svg>')

def fig_hold():
    conds = [("timing", "momento"), ("energy", "energía"), ("emotion", "emoción"), ("information", "información"), ("reversibility", "reversibilidad"), ("urgency", "urgencia")]
    # the six conditions alternate above and below the line, so no name runs into its neighbour (her typography audit)
    ticks = "".join(f'<g class="cond" style="--i:{k}"><path d="M{150 + k * 76} {150 if k % 2 == 0 else 186}V{166 if k % 2 == 0 else 202}"/>'
                    f'{svg_label(en, es, 150 + k * 76, 136 if k % 2 == 0 else 224, "middle", "gl small")}</g>'
                    for k, (en, es) in enumerate(conds))
    return ('<svg class="mfig-svg" viewBox="0 0 640 320" role="img" aria-label="A decision waits on a line until timing, energy, emotion, information, reversibility and urgency are clear; urgent and uncomfortable separate." '
            'data-es-aria="Una decisión espera sobre una línea hasta que el momento, la energía, la emoción, la información, la reversibilidad y la urgencia están claros; urgente e incómodo se separan.">'
            f'<path class="base" d="M60 176H590"/>{ticks}<circle class="dmark" cx="100" cy="176" r="7"/>'
            + tx("text", "urgent", "urgente", cls="gl word w1", extra=' x="320" y="264" text-anchor="middle"')
            + tx("text", "uncomfortable", "incómodo", cls="gl word w2", extra=' x="320" y="264" text-anchor="middle"')
            + '</svg>')

def mfig(svg, seq):
    return f'<figure class="mfig" data-seq="{seq}">{svg}</figure>'

def mlines(items, cls="mlines"):
    return f'<div class="{cls}">{story_items(items)}</div>'

def mprompt(q):
    return tx("p", *q, cls="mprompt", extra=" data-reveal")

def mpart(head, inner):
    return f'<div class="mpart">{tx("p", *head, cls="caps mpart-h", extra=" data-reveal")}{inner}</div>'

def mdrawer(num, title, teaser, inner):
    return (f'<details class="mdrawer"><summary class="mfront"><span class="caps mnum">{num}</span>'
            f'<span class="mfront-t">{tx("span", *title, cls="mtitle")}{tx("span", *teaser, cls="mteaser")}</span>'
            f'<span class="mpull" aria-hidden="true"></span></summary><div class="mbody">{inner}</div></details>')

def fig_pipeline():
    # system leverage: a task done by hand, done again, written down as a skill, put on a schedule, running as a
    # system — and the person leaves the repetitive step for the decision (her iteration, 2026-09-14)
    st = [("a manual task", "una tarea manual", 62), ("done again", "hecha otra vez", 191), ("a skill", "una habilidad", 320),
          ("a schedule", "un horario", 449), ("a system", "un sistema", 578)]
    nodes = "".join(f'<g class="pst{" late" if k >= 2 else ""}" style="--i:{k}"><rect x="{x - 40}" y="150" width="80" height="44"/>{svg_label(en, es, x, 220, "middle", "gl small")}</g>'
                    for k, (en, es, x) in enumerate(st))
    links = "".join(f'<path class="plink" style="--i:{k}" pathLength="1" d="M{st[k][2] + 40} 172H{st[k + 1][2] - 40}"/>' for k in range(4))
    return ('<svg class="mfig-svg" viewBox="0 0 640 250" role="img" '
            'aria-label="A person tied to a manual task and to the same task done again; it becomes a skill, a schedule and a system that runs on its own, and the person moves up to the decision." '
            'data-es-aria="Una persona atada a una tarea manual y a la misma tarea hecha otra vez; se vuelve una habilidad, un horario y un sistema que corre solo, y la persona sube a la decisión.">'
            f'{links}{nodes}'
            '<path class="ploop" pathLength="1" d="M429 150C429 118 469 118 469 150"/>'
            '<g class="ptethers"><path d="M62 88L62 150"/><path d="M68 86L191 150"/></g>'
            '<g class="pdec">' + svg_label("the decision", "la decisión", 320, 34, "middle", "gl small") + '</g>'
            '<circle class="pdot" cx="62" cy="80" r="8"/></svg>')

def real_code(want=None):
    # a real fragment of this site, read from js/motion.js at build time — never retyped, never invented
    src = [l.strip() for l in open(os.path.join(ROOT, "js", "motion.js"), encoding="utf-8").read().splitlines()]
    want = want or ["var T = { eject:", "if (p.dataset.state === 'entering'", "if (p.dataset.state === 'blank'", "if (d < 1)", "var k = clamp01((vh * 0.92 - anchor)"]
    picked = []
    for w in want:
        line = next((l for l in src if l.startswith(w)), None)
        if line is None:
            raise SystemExit(f"real_code: '{w}' is not in js/motion.js — code on the site is never retyped by hand")
        picked.append(line)
    return picked[0] + "\n…\n" + "\n".join(picked[1:])

AI_CHAIN = [("Idea", "Idea"), ("Behaviour", "Comportamiento"), ("Logic", "Lógica"), ("Code", "Código"), ("Experience", "Experiencia")]
AI_EXAMPLES = [
    {"num": "01", "name": ("The Days", "Los días"),
     "idea": [("The photograph should arrive blank.", "La fotografía debería llegar en blanco."), ("Then develop.", "Luego revelarse."),
              ("Then the memory inside it should move.", "Luego el recuerdo dentro de ella debería moverse."), ("The paper should not.", "El papel no.")],
     "behaviour": [("Object · a physical print", "Objeto · una copia física"), ("State 01 · blank", "Estado 01 · en blanco"),
                   ("State 02 · developing", "Estado 02 · revelándose"), ("State 03 · developed", "Estado 03 · revelada"),
                   ("State 04 · playing the memory", "Estado 04 · el recuerdo en movimiento"), ("State 05 · still", "Estado 05 · quieta")],
     "code": None, "src": ("js/motion.js · prints()", "js/motion.js · prints()")},
    {"num": "02", "name": ("The paper airplane on About", "El avión de papel en Sobre mí"),
     "idea": [("The airplane waits at Colombia.", "El avión espera en Colombia."), ("The next route appears first.", "La siguiente ruta aparece primero."),
              ("Then it flies.", "Luego vuela."), ("Then it stops completely.", "Luego se detiene por completo.")],
     "behaviour": [("Milestone · where it waits", "Hito · donde espera"), ("Route · drawn before it moves", "Ruta · se dibuja antes de moverse"),
                   ("Motion · along the arc, nose first", "Movimiento · por el arco, la nariz primero"), ("Arrival · the nose levels", "Llegada · la nariz se nivela"),
                   ("Still · until the next chapter", "Quieto · hasta el siguiente capítulo")],
     "code": ["var TIMING = { draw:", "if (fwd) leg.style.strokeDashoffset = (1 -", "var e = easeInOut(clamp01((t - flyAt)", "put(p.x, p.y, nose", "st.busy = false;"],
     "src": ("js/motion.js · the About timeline", "js/motion.js · la línea de tiempo de Sobre mí")},
]

def ai_example(ex, experience):
    chain = '<ol class="aichain" data-reveal>' + "".join(tx("li", en, es, cls="caps") for en, es in AI_CHAIN) + '</ol>'
    idea = '<p class="hand">' + "".join(tx("span", en, es, cls="hand-l") for en, es in ex["idea"]) + '</p>'
    beh = '<ol class="list">' + "".join(tx("li", en, es) for en, es in ex["behaviour"]) + '</ol>'
    code = (f'<pre class="code"><code>{html.escape(real_code(ex["code"]))}</code></pre>' + tx("span", *ex["src"], cls="caps codesrc"))
    return (f'<div class="aiex">'
            f'<div class="aiex-head" data-reveal><span class="caps mnum">{ex["num"]}</span>{tx("h3", *ex["name"], cls="aiex-t")}</div>{chain}'
            f'<div class="spec">'
            f'<div data-reveal>{tx("h4", "The idea, as I said it", "La idea, como la dije", cls="caps")}{idea}</div>'
            f'<div data-reveal>{tx("h4", "Behaviour", "Comportamiento", cls="caps")}{beh}</div>'
            f'<div data-reveal class="spec-code">{tx("h4", "Code", "Código", cls="caps")}{code}</div>'
            f'</div>{experience}</div>')

AI_PRACTICE = [
    (("Before AI", "Antes de la IA"), [("What do I think?", "¿Qué pienso?"), ("What do I know?", "¿Qué sé?"), ("What am I assuming?", "¿Qué estoy suponiendo?"), ("What would change my mind?", "¿Qué me haría cambiar de opinión?")]),
    (("With AI", "Con la IA"), [("Challenge my reasoning.", "Cuestiona mi razonamiento."), ("Argue against my conclusion.", "Argumenta contra mi conclusión."), ("Which assumption have I failed to defend?", "¿Qué supuesto no he defendido?"), ("What question have I not asked?", "¿Qué pregunta no he hecho?")]),
    (("After AI", "Después de la IA"), [("Close the output.", "Cierro la respuesta."), ("Reconstruct the reasoning myself.", "Reconstruyo el razonamiento yo misma."), ("Can I explain the conclusion?", "¿Puedo explicar la conclusión?"), ("Can I defend it?", "¿Puedo defenderla?")]),
]

def mind_ai(R):
    # BUILD WITH AI (her iteration, 2026-09-14): two related kinds of leverage — system leverage removes the work
    # that should not be done twice; creative leverage turns an image in her head into behaviour code can follow,
    # shown with two real pieces of this site. Then the boundary.
    demo = FRAME_BY["jardin-botanico-orchids"]
    days_live = (f'<div class="prints mdemo"><div class="dset n1" data-set>'
                 f'<div class="dlead" data-reveal>{tx("p", "Experience · running", "Experiencia · funcionando", cls="caps")}</div>'
                 f'<div class="dprints">{CAMERA}{day_print(demo, 0, R, with_saying=False)}</div></div></div>')
    plane_live = (f'<p class="aiex-go" data-reveal>{tx("span", "Experience", "Experiencia", cls="caps")}'
                  f'<a class="lnk" data-page href="{R}about/">{tx("span", "It flies on About", "Vuela en Sobre mí")}</a></p>')
    notes = "".join(f'<div data-reveal>{tx("h3", *head, cls="caps")}<ol>' + "".join(tx("li", en, es) for en, es in qs) + '</ol></div>'
                    for head, qs in AI_PRACTICE)
    tools = [("Claude skills", "Habilidades de Claude"), ("Scheduled tasks", "Tareas programadas"), ("Automations", "Automatizaciones"),
             ("Repeatable workflows", "Flujos repetibles"), ("Research processes", "Procesos de investigación"), ("Internal systems", "Sistemas internos"), ("Coding tools", "Herramientas de código")]
    return (
        mpart(("System leverage", "Palanca de sistema"),
              mlines([("I started with the boring things.", "Empecé por lo aburrido.")])
              + '<div class="mgap" aria-hidden="true"></div>'
              + mlines([("The things I should not have been doing twice.", "Las cosas que no debería estar haciendo dos veces.")])
              + mfig(fig_pipeline(), "700,1500,1700")
              + '<ul class="mwords" data-reveal>' + "".join(tx("li", en, es, cls="caps") for en, es in tools) + '</ul>'
              + mlines([("So more of my attention goes to deal judgment, risk, negotiation, people, structure and strategy.",
                         "Para que más de mi atención vaya al criterio del negocio, el riesgo, la negociación, las personas, la estructura y la estrategia.")])
              + mlines([("The work disappeared.", "El trabajo desapareció.")], "mlines midea")
              + '<div class="mgap" aria-hidden="true"></div>'
              + mlines([("The decision stayed.", "La decisión se quedó.")], "mlines midea"))
        + mpart(("Creative leverage", "Palanca creativa"),
                mlines([("I did not know how to code everything I could imagine.", "No sabía programar todo lo que podía imaginar.")])
                + '<div class="mgap" aria-hidden="true"></div>'
                + mlines([("But I knew exactly how I wanted it to behave.", "Pero sabía exactamente cómo quería que se comportara.")], "mlines midea")
                + mlines([("I built this site with Claude Code and JavaScript.", "Construí este sitio con Claude Code y JavaScript."),
                          ("Not because I wanted to become a software engineer.", "No porque quisiera volverme ingeniera de software."),
                          ("Because I wanted an idea to behave exactly the way I imagined it.", "Sino porque quería que una idea se comportara exactamente como la imaginé.")])
                + ai_example(AI_EXAMPLES[0], days_live)
                + ai_example(AI_EXAMPLES[1], plane_live)
                + mlines([("The harder part was rarely asking for code. It was describing the idea well enough to make the code understand it.",
                           "Lo difícil casi nunca fue pedir código. Fue describir la idea lo bastante bien para que el código la entendiera."),
                          ("I learned enough of the language to become harder to misunderstand.", "Aprendí lo suficiente del lenguaje para que fuera más difícil malentenderme.")])
                + mlines([("The code can be generated. The judgment still has to be mine.", "El código se puede generar. El criterio todavía tiene que ser mío.")], "mlines midea"))
        + mpart(("The boundary", "El límite"),
                mlines([("I want AI doing more of my work.", "Quiero que la IA haga más de mi trabajo.")], "mlines midea")
                + '<div class="mgap" aria-hidden="true"></div>'
                + mlines([("I do not want it doing more of my thinking.", "No quiero que haga más de mi pensamiento.")], "mlines midea")
                + f'<div class="mnotes">{notes}</div>'
                + mprompt(("If I cannot explain why, I have not learned it.", "Si no puedo explicar por qué, no lo he aprendido.")))
    )

def mind():
    R = "../"
    drawers = (
        mdrawer("01", ("Look closer", "Mirar más de cerca"), ("A small problem, six months later.", "Un problema pequeño, seis meses después."),
                mlines([("A cash-flow gap everyone could see coming.", "Una brecha de caja que todos veían venir."),
                        [("“We’ll circle back.”", "“Lo retomamos.”"), ("“It’s not urgent.”", "“No es urgente.”")],
                        ("Six months later it was not a gap anymore. It was the whole conversation.", "Seis meses después ya no era una brecha. Era toda la conversación.")])
                + mfig(fig_leverage(), "650,1000,900")
                + mlines([("A large problem is rarely one problem.", "Un problema grande casi nunca es un solo problema."),
                          ("I look for the piece holding the others in place.", "Busco la pieza que sostiene a las demás.")], "mlines midea")
                + mprompt(("What is this problem resting on?", "¿Sobre qué descansa este problema?")))
        + mdrawer("02", ("Wait before reacting", "Esperar antes de reaccionar"), ("Prepared for the meeting.", "Preparada para la reunión."),
                  mlines([("I can walk into a county engineering meeting and anticipate every objection.", "Puedo entrar a una reunión de ingeniería del condado y anticipar cada objeción."),
                          [("Underwriting reviews.", "Revisiones de análisis."), ("Contractor calls.", "Llamadas con contratistas."), ("Stakeholder conversations.", "Conversaciones con socios.")],
                          ("Then a single message arrives, and I want to answer before I have thought.", "Luego llega un solo mensaje y quiero responder antes de haber pensado.")])
                  + mfig(fig_pause(), "650,1300,1300")
                  + mlines([("I trained for the meeting. Not the message.", "Me entrené para la reunión. No para el mensaje.")], "mlines midea")
                  + '<div class="mgap" aria-hidden="true"></div>'
                  + mprompt(("Is this the emotion of the moment, or the reality of it?", "¿Es la emoción del momento, o la realidad de él?")))
        + mdrawer("03", ("Move authority closer", "Acercar la autoridad"), ("I saw it first. I waited.", "Lo vi primero. Esperé."),
                  mlines([("Managing properties, I often saw problems before the people who could decide.", "Administrando propiedades, muchas veces veía los problemas antes que quienes podían decidir."),
                          [("I would bring them up.", "Los planteaba."), ("Someone else would decide.", "Alguien más decidía."), ("I would wait.", "Yo esperaba.")],
                          ("By the time the answer came back, the problem had grown.", "Para cuando llegaba la respuesta, el problema había crecido.")])
                  + mfig(fig_authority(), "650,1700,1300")
                  + mlines([("The people closest to the work see it first.", "Quienes están más cerca del trabajo lo ven primero."),
                            ("Without authority, what they see just waits.", "Sin autoridad, lo que ven simplemente espera.")], "mlines midea")
                  + '<ul class="mwords" data-reveal>' + "".join(tx("li", en, es, cls="caps") for en, es in
                        [("Context", "Contexto"), ("Clear boundaries", "Límites claros"), ("Ownership", "Responsabilidad"), ("Authority", "Autoridad")]) + '</ul>'
                  + mlines([("Not unlimited freedom. A clear frame to act inside.", "No es libertad ilimitada. Es un marco claro dentro del cual actuar.")])
                  + mprompt(("Who is closest to this problem, and can they act on it?", "¿Quién está más cerca de este problema, y puede actuar sobre él?")))
        + mdrawer("04", ("Make information travel", "Hacer que la información viaje"), ("Never wrong on paper.", "Nunca estuvo mal en el papel."),
                  mlines([("A deal that was never wrong on paper can still fall apart in execution.", "Un negocio que nunca estuvo mal en el papel todavía puede caerse en la ejecución."),
                          [("The attorney catches what the engineer missed.", "La abogada ve lo que el ingeniero pasó por alto."),
                           ("The underwriter flags a zoning inconsistency the broker did not know to look for.", "El analista señala una inconsistencia de zonificación que el corredor no sabía buscar.")]])
                  + mfig(fig_travel(), "650,1100,1300")
                  + mlines([("No one person owns the whole truth.", "Nadie es dueño de toda la verdad.")], "mlines midea")
                  + '<div class="mgap" aria-hidden="true"></div>'
                  + mlines([("The information still has to travel.", "La información igual tiene que viajar.")], "mlines midea")
                  + '<div class="mnotes two" data-reveal>' + tx("h3", "Working notes", "Notas de trabajo", cls="caps")
                  + '<ol>' + "".join(tx("li", en, es) for en, es in [("What is happening?", "¿Qué está pasando?"), ("Why does it matter?", "¿Por qué importa?"),
                                                                     ("What needs to happen next?", "¿Qué tiene que pasar ahora?")]) + '</ol></div>'
                  + mprompt(("Who needs to know this before it becomes expensive?", "¿Quién necesita saber esto antes de que salga caro?")))
        + mdrawer("05", ("Build with AI", "Construir con IA"), ("More of my work. Not more of my thinking.", "Más de mi trabajo. No más de mi pensamiento."), mind_ai(R))
        + mdrawer("06", ("Protect the decision", "Proteger la decisión"), ("End of the day, tired.", "Al final del día, cansada."),
                  mlines([("End of the day. Tired. A decision that could wait until morning.", "Final del día. Cansada. Una decisión que podía esperar a la mañana."),
                          ("I used to make it anyway, just to get it off my plate.", "Antes la tomaba igual, solo para quitármela de encima."),
                          ("It was not a decision. It was relief.", "No era una decisión. Era alivio.")])
                  + mfig(fig_hold(), "650,2300,1500")
                  + mlines([("Not every decision deserves an answer today.", "No toda decisión merece una respuesta hoy.")], "mlines midea")
                  + mlines([("Urgent is not the same as uncomfortable.", "Urgente no es lo mismo que incómodo.")])
                  + mprompt(("Is this urgent, or only uncomfortable?", "¿Esto es urgente, o solo incómodo?")))
    )
    body = (
        f'<section class="beat mind-open"><div class="wrap">'
        f'{tx("div", "Inside my mind · 6 drawers", "Dentro de mi mente · 6 cajones", cls="caps kicker")}'
        f'{hook("The first problem is rarely the problem.", "El primer problema casi nunca es el problema.")}'
        f'<div class="msys-track"><div class="msys-stage">{graph_svg("msys", 800, 440, SYSTEM_NODES, SYSTEM_EDGES, 14, SYSTEM_ARIA)}</div></div>'
        f'</div></section>'
        + f'<section class="beat mind-drawers"><div class="wrap">{drawers}</div></section>'
        + f'<section class="beat turn mind-close"><div class="wrap">{graph_svg("msys resolve", 800, 440, SYSTEM_NODES, SYSTEM_EDGES, 14, SYSTEM_ARIA)}'
        f'{tx("p", "Complexity gets quieter when you know where to look.", "La complejidad se aquieta cuando sabes dónde mirar.", cls="turnline", extra=" data-reveal")}</div></section>'
        + rest(R, ("The drawer stays open.", "El cajón se queda abierto."), "practice", center=True)
    )
    return page("mind", ("Inside My Mind — Yeraldin Soto", "Dentro de mi mente — Yeraldin Soto"),
                ("How I reason: problems beneath problems, waiting before reacting, moving authority closer, making information travel, building with AI, and protecting a decision.",
                 "Cómo razono: problemas debajo de problemas, esperar antes de reaccionar, acercar la autoridad, hacer que la información viaje, construir con IA y proteger una decisión."), body)

# ================================================================ ABOUT
# one photograph for each chapter of her story — it slides in beside the words
STORY_PICS = [
    ("assets/photos/throwback-madrid-fountain.jpg", ("Spain", "España"), ("Madrid · 2020", "Madrid · 2020"),
     ("Yeraldin at a Baroque stone fountain in Madrid, 2020", "Yeraldin junto a una fuente barroca de piedra en Madrid, 2020")),
    # Miami — her own photographs of where she worked (two, stacked). She asked for the place, no date.
    [("assets/photos/miami-trolley.jpg", ("Downtown", "Downtown"), ("Miami · USA", "Miami · EE. UU."),
      ("An orange and green trolley under glass towers", "Un tranvía naranja y verde bajo torres de vidrio")),
     ("assets/photos/miami-sculpture-lobby.jpg", ("A lobby", "Un lobby"), ("Miami · USA", "Miami · EE. UU."),
      ("A dark bronze sculpture on stacked stone in front of a glass lobby", "Una escultura de bronce oscuro sobre piedras apiladas frente a un lobby de vidrio"))],
    # Then land arrived: the open land in Türkiye she chose for the feeling. (Her ask, 2026-09-14: the subdivision map is
    # removed from the site entirely — not blurred.)
    ("assets/photos/turkiye-open-land.jpg", ("Open land", "Tierra abierta"), ("Türkiye · November 2025", "Türkiye · noviembre 2025"),
     ("Open green land with a fence line and a hill of trees beyond", "Tierra verde abierta con una cerca y una colina de árboles al fondo")),
    ("assets/photos/valley-dusk.jpg", ("Above the valley", "Sobre el valle"), ("Colombia · August 2026", "Colombia · agosto 2026"),
     ("A valley at dusk from above, the city lights coming on", "Un valle al atardecer desde lo alto, con las luces de la ciudad encendiéndose")),
    ("assets/photos/rome-colosseum-night.jpg", ("Rome", "Roma"), ("Italia · May 2026", "Italia · mayo 2026"),
     ("The Colosseum lit at night", "El Coliseo iluminado de noche")),
    ("assets/photos/vatican-ceiling.jpg", ("Vatican City", "Ciudad del Vaticano"), ("Italia · May 2026", "Italia · mayo 2026"),
     ("A painted and gilded ceiling", "Un techo pintado y dorado")),
    ("assets/photos/istanbul-bosphorus.jpg", ("Istanbul", "Estambul"), ("Türkiye · November 2025", "Türkiye · noviembre 2025"),
     ("Cloud over the Bosphorus, two boats on the water", "Nubes sobre el Bósforo, dos barcos en el agua")),
    # 08 Drawing — her ask (2026-09-14): not a photograph of an orchid; a sketch, drawn as the chapter scrolls
    {"sketch": True, "name": ("A study", "Un estudio"), "facts": ("One stem · 3 leaves · 2026", "Un tallo · 3 hojas · 2026")},
    ("assets/photos/quindio-colibri.jpg", ("Colibrí", "Colibrí"), ("Quindío · June 2026", "Quindío · junio 2026"),
     ("A hummingbird at an orange feeder", "Un colibrí en un bebedero naranja")),
]

def sketch_svg():
    # a botanical study in pencil line: a faint axis and proportion ticks (look first), the stem that does not bend where
    # memory expects it to, three leaves that are not symmetrical, then the flower and a little shading
    return ('<svg class="sketch-svg" viewBox="0 0 240 300" role="img" aria-label="A pencil study of a stem: a faint axis, the bending stem, three uneven leaves, then the flower and a little shading." '
            'data-es-aria="Un estudio a lápiz de un tallo: un eje tenue, el tallo que se curva, tres hojas desiguales, luego la flor y un poco de sombra.">'
            '<g class="st1 guide-l"><path pathLength="1" d="M120 292V18"/><path pathLength="1" d="M108 230H132M108 160H132M108 96H132"/></g>'
            '<g class="st1"><path pathLength="1" d="M120 290C118 240 128 200 116 150C108 118 124 90 132 60"/></g>'
            '<g class="st2"><path pathLength="1" d="M118 232C92 224 72 208 62 186C86 188 106 204 118 232"/>'
            '<path pathLength="1" d="M122 188C146 178 168 162 182 138C156 144 136 162 122 188"/>'
            '<path pathLength="1" d="M114 134C96 126 84 112 80 94C98 98 110 112 114 134"/></g>'
            '<g class="st3"><path pathLength="1" d="M132 60C120 40 124 20 140 14C146 30 142 48 132 60"/>'
            '<path pathLength="1" d="M132 60C150 50 170 52 180 64C166 72 148 72 132 60"/>'
            '<path pathLength="1" d="M132 60C116 58 100 64 94 78C110 80 124 74 132 60"/>'
            '<path pathLength="1" d="M132 60C136 74 132 86 124 92"/>'
            '<path class="shade" pathLength="1" d="M72 196L80 190M78 202L88 195M150 160L158 152M156 166L166 158M88 108L94 102"/></g>'
            '</svg>')

def story_pic(i, R):
    entry = STORY_PICS[i]
    if isinstance(entry, dict):   # a drawing instead of a photograph, driven by the scroll like every staged drawing
        return (f'<div class="ch-fig ch-sketch" data-reveal><figure class="ch-one mfig pfig sketch" data-seq="0,0,0">{sketch_svg()}'
                f'{label(entry["facts"], entry["name"], reveal=False)}</figure></div>')
    pics = entry if isinstance(entry, list) else [entry]
    figs = "".join(f'<figure class="ch-one">{frame("r45", img(R + src, alt))}{label(facts, name, reveal=False)}</figure>'
                   for src, name, facts, alt in pics)
    return f'<div class="ch-fig{" ch-pair" if len(pics) > 1 else ""}" data-reveal>{figs}</div>'

def story_items(items):
    out = ""
    for it in items:
        if isinstance(it, list):
            out += '<p class="stack" data-reveal>' + "".join(tx("span", en, es) for en, es in it) + '</p>'
        elif len(it) == 3:
            out += tx("p", it[1], it[2], cls="pull", extra=" data-reveal")
        else:
            out += tx("p", *it, extra=" data-reveal")
    return out

def story_html(R):
    out = ""
    for i, (ten, tes, items) in enumerate(STORY):
        flip = " flip" if i % 2 == 0 else ""
        out += (f'<div class="chapter{flip}"><div class="dhead" data-reveal><span class="chnum">{i + 1:02d}</span>{tx("h2", ten, tes)}</div>'
                f'<div class="lines">{story_items(items)}</div>{story_pic(i, R)}</div>')
    return out

# How she got here, under her photograph — only facts from her own story, in her order.
TIMELINE = [
    ("01", ("Colombia", "Colombia"), ("Civil engineering · Universidad Cooperativa de Colombia", "Ingeniería civil · Universidad Cooperativa de Colombia")),
    # Bilbao exists because of engineering (her correction): the scholarship first, the thesis it began
    ("02", ("España · Bilbao", "España · Bilbao"), ("International engineering scholarship · 1 year · University of the Basque Country", "Beca internacional de ingeniería · 1 año · Universidad del País Vasco")),
    ("03", ("USA · Utah", "EE. UU. · Utah"), ("A summer abroad", "Un verano en el extranjero")),
    # both working chapters became leadership chapters — shown as progression, not a label
    ("04", ("USA · Miami", "EE. UU. · Miami"), ("Property manager’s assistant · project management · then managing the company", "Asistente de administración de propiedades · gestión de proyectos · luego dirigiendo la empresa")),
    ("05", ("USA · Texas", "EE. UU. · Texas"), ("Scout Land Group · project manager and underwriter · now Director of Developments and Underwriting", "Scout Land Group · gerente de proyectos y analista · hoy directora de desarrollos y análisis")),
]

# her paper airplane — one pen line: the dart, and the fold down its middle (nose pointing +x)
PAPER_PLANE = '<path d="M11 0 L-10 -7 L-5 0 L-10 7 Z M11 0 L-5 0"/>'

def timeline():
    steps = "".join(
        f'<li class="tl-step"><span class="tl-dot" aria-hidden="true"></span>'
        f'<span class="caps tl-num">{n}</span>{tx("span", *place, cls="tl-place")}{tx("span", *what, cls="tl-what")}</li>'
        for n, place, what in TIMELINE)
    return (f'<div class="tl-flight"><div class="tl-scroll">'
            f'<svg class="tl-route" aria-hidden="true" focusable="false"><g class="tl-legs"></g>'
            f'<path class="tl-future" pathLength="1"/><g class="tl-plane">{PAPER_PLANE}</g></svg>'
            f'<ol class="tl" aria-label="How I got here" data-es-aria="Cómo llegué hasta aquí">{steps}</ol></div></div>')

def about():
    R = "../"
    me = ('<div class="me-frame">'
          + img(R + "assets/photos/about-me.jpg", ("Yeraldin Soto smiling in warm window light, orchids beside her",
                                                   "Yeraldin Soto sonriendo con la luz cálida de una ventana, con orquídeas a su lado")).replace(' loading="lazy"', ' loading="eager"')
          + '</div>')
    contact = (f'<div class="contact" data-reveal><a class="big" href="{LINKEDIN}" rel="me noopener" target="_blank">LinkedIn</a>'
               f'<a class="mail" href="mailto:{EMAIL}">{EMAIL}</a>'
               f'{tx("span", "Yeraldin Soto · UTC−5", "Yeraldin Soto · UTC−5", cls="caps")}</div>')
    gratitude = "".join(tx("p", en, es, cls="prose", extra=" data-reveal") for en, es in [
        ("I practise being thankful the way I practise anything else: every day, on purpose.", "Practico la gratitud como practico cualquier otra cosa: todos los días, a propósito."),
        ("A first coffee. Light on an orchid. A road out of the city. None of it had to happen.", "Un primer café. La luz sobre una orquídea. Una vía que sale de la ciudad. Nada de eso tenía que pasar."),
        ("I try to notice it while it is still happening.", "Intento notarlo mientras todavía está pasando."),
    ])
    coffee = (f'<figure class="grat-fig" data-reveal data-late>'
              + frame("r45", img(R + "assets/photos/terrace-breakfast.jpg", ("Breakfast on a terrace, a dog’s nose at the edge of the table", "Desayuno en una terraza, con la nariz de un perro al borde de la mesa")))
              + label(("Antioquia · August 2026", "Antioquia · agosto 2026"), ("A first coffee", "Un primer café"), reveal=False) + '</figure>')
    body = (
        f'<section class="beat compact me-section"><div class="wrap">'
        f'<div class="me">'
        f'<div class="me-photo" data-reveal>{me}</div>'
        f'<div class="me-text">'
        f'{tx("div", "About me · Yeraldin Soto", "Sobre mí · Yeraldin Soto", cls="caps kicker", extra=" data-reveal")}'
        f'{hook(*HOOK)}'
        f'<div class="intro-lines">{story_items(INTRO[:2])}</div>'
        f'</div></div>'
        f'{timeline()}'
        f'<div class="scroll-cue" aria-hidden="true">{tx("span", "Scroll", "Desliza", cls="caps")}<i></i></div>'
        f'</div></section>'
        + f'<section class="beat turn compact"><div class="wrap grat">'
          f'<div>{tx("p", "I believe life is a little magic, if you pay attention.", "Creo que la vida tiene algo de magia, si uno presta atención.", cls="turnline", extra=" data-reveal")}'
          f'<div class="gratitude">{gratitude}</div></div>{coffee}</div></section>'
        + f'<section class="beat paper story"><div class="wrap">{tx("div", "My story · 9 chapters", "Mi historia · 9 capítulos", cls="caps kicker", extra=" data-reveal")}<div class="story-intro">{story_items(INTRO[2:])}</div>{story_html(R)}</div></section>'
        + f'<section class="beat rest compact"><div class="wrap">{tx("p", "I like a first coffee more than a first email.", "Me gusta más un primer café que un primer correo.", cls="restline", extra=" data-reveal")}{contact}{next_link(R, "work")}</div></section>'
    )
    return page("about", ("About — Yeraldin Soto", "Sobre mí — Yeraldin Soto"),
                ("Yeraldin Soto: civil engineer, land developer, and endlessly curious — about construction, systems, art, languages, money and plants. Her story.",
                 "Yeraldin Soto: ingeniera civil, desarrolladora de tierra y curiosa sin remedio — por la construcción, los sistemas, el arte, los idiomas, el dinero y las plantas. Su historia."), body)

# ================================================================ write
BUILDERS = {"": home, "about": about, "work": work, "mind": mind, "practice": practice, "journal": journal,
            "days": days, "aerodrome": aerodrome}

def path_redirect():
    # The Path was folded into About (her brief, 2026-09): old links still land somewhere true
    return ('<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>About — Yeraldin Soto</title>'
            f'<meta name="robots" content="noindex"><link rel="canonical" href="{BASE}about/">'
            '<meta http-equiv="refresh" content="0; url=../about/"></head>'
            '<body><p><a href="../about/">About — Yeraldin Soto</a></p></body></html>\n')

if __name__ == "__main__":
    stamp_film()
    for slug, fn in BUILDERS.items():
        out = os.path.join(ROOT, slug, "index.html") if slug else os.path.join(ROOT, "index.html")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8").write(fn())
        print("wrote", os.path.relpath(out, ROOT))
    for i, e in enumerate(ENTRIES):   # the Journal: one page per entry
        out = os.path.join(ROOT, "journal", e["slug"], "index.html")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8").write(journal_entry(i))
    print("wrote", len(ENTRIES), "journal entries")
    os.makedirs(os.path.join(ROOT, "path"), exist_ok=True)
    open(os.path.join(ROOT, "path", "index.html"), "w", encoding="utf-8").write(path_redirect())
    print("wrote path/index.html (redirect)")
    urls = "".join(
        f'  <url><loc>{BASE}{s + "/" if s else ""}</loc>'
        f'<xhtml:link rel="alternate" hreflang="en" href="{BASE}{s + "/" if s else ""}"/>'
        f'<xhtml:link rel="alternate" hreflang="es" href="{BASE}{s + "/" if s else ""}?lang=es"/></url>\n'
        for s in list(BUILDERS) + [f"journal/{e['slug']}" for e in ENTRIES])
    open(os.path.join(ROOT, "sitemap.xml"), "w").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + urls + '</urlset>\n')
    print("wrote sitemap.xml")
