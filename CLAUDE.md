# Yeraldin — build brief

This is Yeraldin Soto's personal site. Land development, and a life documented slowly.
Medellín, Colombia.

The design system is finished and **audited**. Your job is to build on it, not redesign it.
Read this whole file before changing anything.

---

## The concept, in one line

**The drawn line describing the natural world.**

A botanical plate, an architectural elevation and a land plat are the same gesture — a measured
drawing. She does the third professionally and the first two for pleasure. Every design decision
traces back to this. If a change does not, it is wrong even if it looks nice.

Register: Antioquian old money. European heritage transplanted into tropical botany — dark wood
and French windows, leather books and lime-washed walls, a patio garden behaving like a jungle.
**Old money is defined by omission.** No gold, no marble, nothing shiny, no visible logo repeated
as a pattern, and never the word "luxury".

---

## Non-negotiable rules

### Colour
Every value in `css/tokens.css` was measured with the WCAG relative-luminance formula.
**Do not introduce a colour that is not in that file.** If you must, compute its contrast first
and record the ratio in a comment.

- `--verde` is a **surface only**. It never sets type, in either theme.
- Text on Verde is always `--on-verde` (#F5EFE4), fixed in both themes.
- `--arcilla` never touches `--verde` (2.28:1). Use `--laton-on-verde` or `--on-verde`.
- `--arcilla` is for display 25px and above, and non-text. Anything smaller uses
  `--arcilla-text`.
- Accent covers under 10% of any surface. In practice about 2%.

Verified ratios (light theme, on `--papel`): ink 14.76 · n-500 6.78 · n-400 5.06 ·
arcilla-text 5.03 · arcilla 4.05 · laton 3.82 · rule-strong 3.29.

### Type
Two families. **Never add a third.**
- Cormorant Garamond 300/400 — display, wordmark, specimen names
- Jost 300/400/500 — body and tracked uppercase labels

Sizes come from the scale in tokens (`--t-12` … `--t-61`, 1.25 ratio). No arbitrary px.
`clamp()` is allowed only between two scale steps. Body measure stays 60–75 characters.

### Spacing
`--s-4` … `--s-96`. No arbitrary gaps. Desktop section padding is `--s-96` minimum.

### Motion
The signature is **the mark drawing itself** — `pathLength="1"` plus `stroke-dashoffset`,
staggered per path. It is the concept made literal, so keep it.

Everything else is **opacity and transform only**, 150–420ms, `--ease-out`.
`js/motion.js` is progressive enhancement: it adds `.js` to `<html>`, and only then do
pre-reveal states apply. **Without JS the page must be fully visible and readable.** Never
invert that.

`prefers-reduced-motion` resolves every animation to its final state. Test it.

### Accessibility
- Focus ring is never removed. 2px `--arcilla`, 3px offset; `--laton-on-verde` on green.
- Touch targets ≥44px.
- No horizontal scroll at 390px.

---

## The signature composition rule

**Every image is followed by a hairline and a label — never by a paragraph.**

The thing, a Latón rule (`.wipe`), its name in Cormorant 20, its facts in Jost 12 tracked, and
**always a number**: an altitude, a distance, an acreage, a date.

    Orquídea
    SANTA ELENA · 2 600 M
    SEPTEMBER 2026

That repetition is what makes a page recognisable with the logo off-screen, and it is the link
between her photographs and her plats. Do not vary it.

---

## Structure

    tools/build.py      THE SOURCE. Every word on the site, in English and Spanish,
                        and the album frames. Edit here, then: python3 tools/build.py
    index.html          Home (Front)              ┐
    about/ work/ mind/ practice/ journal/         │ generated — never hand-edit
    days/ aerodrome/  (index.html)                ┘
    path/index.html     generated redirect to about/ — The Path was folded into About (2026-09)
    sitemap.xml         generated with the pages
    css/tokens.css      audited design tokens — treat as read-only
    css/base.css        reset, document, utilities
    css/components.css  world, nav, index, beats, label, morph, reel, drawers, footer
    css/motion.css      drawings, reveals, reduced motion
    js/motion.js        reveal, language, index, album, morph, photographs breathing
    assets/             marks, portrait.jpg, plat.jpg, share.jpg
    assets/photos/      web copies (1400px, Exif/GPS stripped) + the Naples video
    content/            the journal entry in markdown
    figma/              editable SVGs + tokens for design work
    index.previous.html the first Papel homepage, kept for its copy
    ../site-v1-backup/  the one-page Verde site as it was before the rebuild

**Photographs:** only ever copy from `../photo-bank-web/` (already stripped). Her originals
carry a GPS point at her home. After any `sips` resize, strip APP1 again — sips writes Exif.

## Every page is a Verde world, in four beats

**She loves the green: Verde is the ground of every page** (`<body class="world">`), and the
dark of the brand is Verde Hondo — **never black**. Turn sections, the album, the index and
the footer sit on `--verde-deep`; two deep rooms never touch. The orange she likes is the
dark-theme Arcilla (#D08A64 / #DB9873), the only oranges that pass on green — base #AF5F3E
never goes on green. Ratios are in the WORLD and REEL comments.

Threshold (a hook of twelve words or fewer, its full stop the one orange element), Detail
(prose lines, then the image a beat later, then its label), Turn (Verde Hondo, one line),
Rest (one line and a quiet link to the next page). Empty photo frames stay in place in
Verde Hondo until her photograph exists — never stock, never invented.

    Home        THE HERO (green): portrait + morph + phrases · then PAPER (her ask): about me
                + sneak peek, a sideways row of 7 album photos · Verde Hondo line · Papel rest

`.paper` sections use fixed light values in both themes, with Verde Hondo text — never
Tinta, never black. Ratios in the PAPER comment. The Santa Elena beat was dropped from
Home until she has that photograph.
    The Work    empty land frame · plat.jpg · the Horizon divider · fence line
    The Practice  terracotta orchids · pressed flower (empty) · colibrí
    The Journal   iron gate · the one entry · small colibrí
    The Days      colibrí photo · THE ALBUM (film strip) · light line
    The Aerodrome a block-built 3D model of her thesis (aerodrome-3d/, see below)
    Inside My Mind  a system that comes apart · six plan-cabinet drawers · the system resolved
    About         her photo · the paper-airplane timeline · her story · LinkedIn and email

The flower mark signs (Home, Work, Aerodrome, About); the colibrí moves (Practice, Journal,
Days, Mind). Every page footer says **by Yeraldin Soto** — she asked for it.

**The menu (her master brief, 2026-09):** I Front · II About · III The Work · IV Inside My Mind ·
V The Practice · VI The Journal · VII The Days · VIII The Aerodrome (`PAGES` in build.py; next
links follow it; The Work has none). The Path is gone; `path/` only redirects to About.
**Untouchable:** the Front (home(), meet(), peek(), the hero/guide/morph code) and The Work (work(),
the Work controller in motion.js, follow-the-line/) — technical fixes only, reported first.

## Home — the animation lives with her photograph, and nothing pins

She was explicit twice: the animation is *with the photo*, and attention must never stall.
The hero (`.hero`, 180svh under `.js` with motion welcome) does **not** stick. Its stage
rides down with the reader at `RIDE` = 72% of the scroll (`--ride`), so her portrait and the
drawing travel together while the seven strokes become the plat, then the house, and a
phrase lands for each part. The stage lands at the foot of the hero and the Papel "About
me" section arrives immediately; a 12svh fade softens green into Papel.

    her + flower  Some people see dirt. I see what it is waiting to become.
    vision        Vision is seeing the house while you are still standing in the field.
    → land        I draw the lines first. Roads, lots, water. A dream needs a map.
    → house       From land, to a plan, to someone’s dream.
    held          Yesterday’s dirt is tomorrow’s dream house.   (her line; orange full stop)

**The portrait is shown in its own colour** — no desaturation, no green wash — feathered
into the green on every edge by a mask. On narrow screens it sits at the top, full colour,
fading downward behind the text.

**The guide.** The colibrí (`.guide`, home only) flies beside the drawing while it changes,
then leads the eye to each heading marked `data-guide` (the About me hook, A few of my days,
every Turn line). Latón Claro on green, Latón on Papel. Eased, never looping; hidden under
reduced motion.

Every path keeps an identical command signature in all three `STATES`, so the figure is
interpolated number by number — edit the three states together or not at all.

## The Work, About, Inside My Mind

- **The Work** tells what she does in four steps (underwriting and feasibility, subdivision
  design, acquisition to build-ready, systems and teams), condensed from her own bio.
- **About** opens with `assets/photos/about-me.jpg` (her photo, feathered), her background
  beside the Madrid 2020 photo, a Turn on the magic of life and gratitude beside "a first
  coffee", then **her story in full** on Papel: ten chapters from `tools/story.py` (EN + ES,
  her words — edit, don't rewrite). Each chapter carries one photograph from `STORY_PICS`
  that stays beside its lines while they are read (sticky inside the chapter).

## Facts she corrected — never regress these

- **Education:** civil engineering degree from **Universidad Cooperativa de Colombia**. She
  won an **international engineering scholarship** for **one year at the University of the Basque
  Country** (Spanish: Universidad del País Vasco), Bilbao, and **began her thesis there**; it was
  **finished and presented at Universidad Cooperativa de Colombia (2022)**: an annex aerodrome for
  domestic flights beside El Dorado. Co-authors: Diego Fernando Cetina Guzmán and Germán David
  Mondragón Montoya — credit them. She holds the licence to share the thesis PDF.
- **Bilbao exists because of engineering** (her correction): the scholarship first, the thesis it
  began, then language and culture; teaching English is something she *also* did there. Never frame
  Bilbao as an English-teaching or travel chapter.
- **Career, in her words (`tools/story.py`):** the Bilbao scholarship, customer support,
  a grocery store in Utah (summer abroad), property management at **JMK** in **Miami** (almost two
  years: property manager's assistant → project management — construction, capital
  improvements, MEP, plumbing, HVAC, multifamily assets and investors → managing the company), then **Scout Land Group** in **Texas** — project manager and underwriter, now
  **Director of Developments and Underwriting** (her exact title). Both chapters became
  leadership chapters — shown as progression, never as a loud label.
- **The About timeline speaks in countries** (her ask, 2026-09-13): Colombia → España · Bilbao →
  USA · Utah → USA · Miami → USA · Texas. Five steps; the grid in `components.css` is `repeat(5…)`.
  A line-drawn paper airplane (`PAPER_PLANE` in build.py) flies one leg per milestone reached —
  milestone-triggered, never tied to scroll pixels; the route continues faintly past Texas and
  dissolves. The same airplane returns at the end of The Aerodrome.
- **Her subdivision map** (Scout chapter) is published only with the neighbours' names blurred
  (her choice); never publish `subdivision.PNG` itself.
- **The Miami story photos are labelled "Miami · USA", no date** — she wants them to show the place
  she worked. A deliberate exception to "always a number".
- **She wants to read international**, not boxed in by nationality. Framing copy doesn't
  lead with Colombia, Bogotá or El Dorado; JSON-LD pins no country. Her own story keeps its
  words as she wrote them.
- **Never mention Medellín** anywhere on the site — not in copy, labels, coordinates
  (6°15′ N), altitudes (1,495 m), alt text, meta, JSON-LD or photo filenames. Colombia and
  Antioquia are fine.
- **Inside My Mind** (her master brief, 2026-09) shows *how* she reasons, situations first: "The first
  problem is rarely the problem." (a system that comes apart on scroll), six drawers — 01 Look closer,
  02 Wait before reacting, 03 Move authority closer, 04 Make information travel, 05 Build with AI
  (repetition → an idea specified → this site → the boundary), 06 Protect the decision — each a scene,
  one drawing that plays once, the idea, a question; and "Complexity gets quieter when you know where to
  look." The stories come from her LinkedIn posts, rewritten, never pasted. The code shown in drawer 05
  is read from `js/motion.js` at build time (`real_code()`) — never retyped. Her old drawers moved:
  investing → The Practice, land notes and the Kenkō quote → The Journal, the empty dreams dropped.

## Iteration 2026-09-14 — refine, don't redesign

Her rule: preserve typography, spacing, hierarchy, the hummingbird, the editorial layout, Home and The Work.
Anti-duplication: About = trajectory (mentions the aerodrome, never teaches it) · The Work = what she does ·
Inside My Mind = how she thinks · The Practice = what she keeps studying · The Journal = one idea per entry ·
The Days = memory only · The Aerodrome owns the thesis experience. Recurring motifs yes, repeated paragraphs no.

- **Home about-me (`meet()`)**: international engineering scholarship first; the aerodrome summary (three of us,
  "Not a diagram of one", runway/aircraft/pavement/drainage/movement, "one of the most debated projects in our
  cohort" — her recollection, not an institutional claim) with a small paper airplane that crosses once (`.mplane`);
  the three-name index leans in while its part is read (`data-ix`).
- **About timeline**: milestone chapters, not a scrub. `TIMING` in motion.js; wheel accumulator + lock + cooldown +
  quiet gap on wide fine-pointer screens (one gesture = one chapter, backwards too); jumps resolve to the finished
  state; phones/narrow windows turn chapters automatically while in view; reduced motion relocates. A quiet
  `.scroll-cue` under the first composition, gone once scrolling starts.
- **Inside My Mind 05**: System leverage (pipeline drawing) and Creative leverage (two real examples — The Days and
  the About airplane — idea → behaviour → code read from motion.js by `real_code(want)` → experience), then the boundary.
- **The Practice**: 8 studies — underwriting (questions around one project), multifamily read four ways, finance and
  investing (never a fund manager), statistics (context changes a number), architecture, languages, drawing, code. The
  opening orchid photo is replaced by an original line-drawn tower that grows like a plant (`fig_tower`).
- **The Journal**: `JVISUALS` in build.py gives every entry a drawing that carries its idea (subdivision constraints in
  8 stages, JV incentives, novation, exit-first waterfall, title constraints, decision path…), small and still in the
  list. New concept entries (subdivision, JV, novation) are dated "Notes · 2026", never invented dates; legal topics
  carry a "not legal advice" margin. `practice()` in motion.js now plays any number of stages.

## Responsive typography (her audit, 2026-09-14)

Text is not a fixed graphic: it wraps, grows, loads late and responds to accessibility settings. Layouts and
animations adapt to it, never the reverse. Zero accidental text overlap is the rule; never hide one with overflow.

- **Audit tool:** `tools/audit.js` (review only, never loaded by the site). In the preview, inject it and run
  `__audit()`: it measures every visible line of text and reports overlaps, text leaving the viewport, text
  under 12px (SVG labels at their on-screen size) and page-level horizontal scroll. Run it at 320, 375, 768 and
  1280 after any layout or copy change; force stages on for drawings (`armed s1…s8`) and open the Mind drawers.
- **Drawing labels:** `figureKeys()` in motion.js. When a drawing's labels would render under 12px below 1024px wide
  (under 10px wider; the smallest label decides), the drawing keeps its lines and its labels move into a numbered key beneath it
  (`.figkey`), in stage order, arriving with their stage, with their Spanish. Re-measured on resize and after
  `document.fonts.ready`. Applies to `svg.mfig-svg`, `svg.msys` and the technical-sheet figures.
- **Text-dependent geometry:** the About timeline route is re-laid after fonts load and whenever the strip resizes
  (ResizeObserver). The About scroll cue rests under the photo on narrow screens instead of floating over words.
- **A photograph never covers words (her rule, 2026-09-14):** prints on The Days may overlap each other, never a
  caption. `clearWords()` in motion.js `prints()` measures the real layout and moves a caption clear of any other
  print (or moves that print down), on load, resize, fonts ready, language change and when a set finishes. Only a
  print's paper and caption take the pointer, so an empty print box never sits over another caption.
  `await __occlusion()` in tools/audit.js scrolls the page and reports any text with something painted on top of
  it — run it with the audit. Transitions are frozen and scrolling jumps while it measures.
- **Drawing labels never crowd:** the audit's `crowded` list flags two labels in one drawing with under 6px between
  them (e.g. the six conditions in Protect the decision now alternate above and below the line).
- **Safe areas:** `viewport-fit=cover`; `.wrap` and the bar pad with `max(20/30px, env(safe-area-inset-*))`.
- **Narrow bars:** below 380px the wordmark, language switch and index button tighten their tracking to keep one
  line; tracked capitals loosen less below 420px. Code blocks stay 13px and wrap inside their own box.

## The Days — prints

**Her master brief (2026-09) replaced the rolling film strip.** A physical print arrives, develops,
and — only where real footage exists — the memory inside it moves once. Never a grid, carousel or
masonry gallery; never AI-animated stills; only pretty photographs (not the subdivision map, not
her headshot).

Prints are grouped in `DAY_SETS` (build.py): each set is led by one small observation of hers or,
where she has none, by the saying of its first photograph. Text first; a pause; then — her ask,
like a Polaroid — a line-drawn instant camera (`CAMERA`) pushes each print out of its slot blank; it is
carried to its place with a small swing and develops quickly on the way (deep green lifting into the
photograph, ~0.9 s), holds as a photograph, and — for the Naples montage only — plays
once inside the still paper and rests on its last frame. The next print leaves from behind the one
before. One timing table and an explicit state machine in `js/motion.js` `prints()`:
idle → entering → blank → developing → developed → (playing → settling) → still. One moving memory
at a time; footage loads near the screen and pauses off it. Hover lifts ~5px and straightens (no
scale, no shadow); click opens a `<dialog>` viewer. Phone: an ordinary vertical stack. Reduced
motion: every print developed; footage only in the viewer.

Each print keeps the label (place, country · month · a number) and a saying **from the culture where
it was taken**, in its own language, with its translation beneath in the reader's language. When
the saying is already Spanish, the Spanish translation is empty and hides itself.
Arabic sayings are transliterated (al-jār qabl ad-dār): neither brand typeface has Arabic
glyphs, and a fallback would be a third family.

Frames live in `FRAMES` in `tools/build.py`. Use well-known traditional proverbs only —
no attributed modern quotations (copyright), nothing invented.
Open item: confirm the woman who appears in one Naples frame is happy to be on the site.

## The Aerodrome — voxel model

Her master brief (2026-09): a true block-built 3D experience, faithful to the thesis. `aerodrome-3d/`
(three.js 0.170 from jsDelivr, stamped by `AV` in build.py like the film's `FV`):

    data.js      THE geometry — every number from the thesis tables (pp.18–28), Fig. 19 p.38 for layout.
                 The plan lines, the voxels, the aircraft route and the notes all read it. Never invent
                 an apron, terminal, shoulders or lighting — the thesis did not design them.
    voxel.js     instanced blocks; rise/sink per block in the shader (aLife), edge darkening, no outlines
    aircraft.js  a neutral A321 built from 1.5 m blocks, no livery
    main.js      the score (PH), camera keys, the flight state machine, plan projection, paper airplane

Scroll through a 1500svh track: plan draws on Verde Hondo → camera tilts → terrain, runway, taxiways,
exits, markings, context rise → the A321 plays ONCE on its own clock (PARKED → TAXIING → HOLDING →
TURNING → LINED_UP → ACCELERATING → ROTATING → AIRBORNE → EXITED), the camera following only while the
reader stays in its stretch → thesis identity (co-authors, both universities, the PDF) → the world sinks
to linework → one centreline → the About paper airplane flies it once → "Some lines stay with you."
The render loop runs only while something moves and the section is on screen. Mobile: 10 m blocks, no
shadows, DPR 1.25, runway vertical. Reduced motion: the finished field with the aircraft lined up, the
words beneath. No JS/WebGL: the words in order. Review: `?check&p=.6&fly=3`, `?reduced`.

**El Dorado and Bogotá (her ask, 2026-09-13).** After the flight the track (now 1800svh; `M()` in main.js
and `aero_at()` in build.py keep the earlier moments at the same scroll distance) pulls out and turns east:
the Sabana's fields, the Río Bogotá, El Dorado's two 3,800 m runways, the city on its compass grid and the
Cerros Orientales build in coarse blocks around the annex, with five map names. Placement follows the
thesis's Ilustración 1 (p.14); El Dorado's runway spacing is from published coordinates; the rest is
schematic and the page says so. On the Aerodrome page El Dorado and Bogotá are named — her request, an
exception to the international framing rule. Below the scroll: a **technical sheet** on Papel (12 thesis
parameters cited by table and page, a pavement-section drawing, a runway-length chart).

## Language

Every page ships in English and carries its Spanish alongside, so it is complete with JS off.

    data-es          textContent        data-es-html     innerHTML (used where ′ needs its span)
    data-es-aria     aria-label         data-es-alt      img alt
    data-es-content  meta content       data-open-en/es, data-pause-en/es  stateful buttons

`build.py`'s `tx()` writes these for you — never write a string without both halves. The
choice lives in the URL (`?lang=es`) and `applyLang()` appends it to every `a[data-page]`,
so the language carries from page to page with no storage. Album clones carry the same
attributes, so they switch with the rest.

## The index

A folio index of all nine pages: numeral, name, facts. Closed state is `visibility:hidden`,
never `hidden` or a rAF-added class. Escape and the button return focus. All bar rules are
scoped to `nav.topbar` — the index list is itself a `<nav>`.

## Search and sharing

Canonical `https://yeraldinsoto.com/<page>/`, Spanish declared by `hreflang` at `?lang=es`.
`applyLang()` moves the title, description, OG/Twitter text, `og:locale`, `og:url` and the
canonical. JSON-LD `Person` is on Home only: Scout Land Group, Universidad del País Vasco,
her Gmail, LinkedIn in `sameAs`. Share card `assets/share.jpg`. Backlinks live on other
people's sites; do not add anything that manufactures them.

## What is still hers to give

Santa Elena orchid (Home), open land at a road's edge (Work), pressed flower (Practice),
her desk (Path), books, dreams and more notes (Mind), the
full journal entry, consent for the Naples video, and where `unplaced-clouds-trees.jpg` was.

## What not to do

- Do not add a CSS framework. This is ~18KB of CSS rules (24KB with the comments,
  which are load-bearing here) and it should stay in that range.
- Do not add a second accent colour, a gradient, a drop shadow, or a border radius above 2px.
- Do not centre body text longer than two lines.
- Do not replace the placeholder copy with lorem ipsum. Write real sentences or leave hers.
- Do not animate anything on a timer or a loop. One-shot sequences run on requestAnimationFrame
  clocks, finish, and stay still.
