# Yeraldin — Figma handoff

Everything here is vector and imports into Figma natively. Drag the `.svg` files
straight onto a canvas; each one arrives as editable strokes, not a picture.

Strokes are Tinta `#211C17`, matching the existing mark files. Recolour in Figma —
on Verde, every stroke becomes Papel `#F5EFE4` or Latón `#C9AC78`, never Arcilla.

## The specimen — the whole idea in three files

    specimen-flower.svg       the plant
    specimen-plat.svg         the land
    specimen-elevation.svg    the building

Seven strokes, three times over. Same commands, same point count, same order —
which is why the site can turn one into the next without ever replacing the line.
That constraint is the concept, so if you redraw one, redraw all three together.

    specimen-flower-measured.svg   the flower with its dimension line + north arrow
    survey-marks.svg               the measurement on its own
    specimen-sequence.svg          all three in a row, one artboard
    colibri.svg                    the guide

## Rebuilding the morph in Figma

`morph-01-flower` → `morph-05-elevation` are five exact keyframes of the sequence
the site plays, generated from the same interpolation.

1. Put each on its own frame, same size, same position.
2. Prototype: connect 01 → 02 → 03 → 04 → 05.
3. Animation: **Smart Animate**, Ease Out, ~600ms each.

Figma will tween the points because the shapes are structurally identical. Frames
02 and 04 look unresolved on their own — they are meant to be passed through, not
rested on.

## The rest of the page

Figma cannot read the HTML directly. Two options:

- **html.to.design** plugin — point it at `http://localhost:8139` with the server
  running. It captures a static snapshot, so the hero arrives mid-animation and the
  index overlay will not be in it. Open the index first if you want that screen.
- Rebuild by hand from `design-tokens.json` and the type rules below. For a brand
  this restrained that is usually faster and much cleaner.

## Type

Two families, never a third. Both are in the brand kit under `fonts/`, and both are
on Google Fonts.

    Cormorant Garamond Light 300   display, wordmark, specimen names
    Cormorant Garamond Light Italic  the voice line
    Jost Light 300                 body
    Jost Regular 400               tracked caps labels, letter-spacing 0.26em

Wordmark: Cormorant, uppercase, letter-spacing **0.30em**. Never tighten it, never
bold it, never add a tagline.

Sizes come from the scale in `design-tokens.json` (1.25 ratio, 12 → 61). No
arbitrary values.

## The one composition rule

Every image is followed by a hairline and a label — never by a paragraph:

    the thing
    ── a Latón hairline, 52px
    A name in Cormorant 20
    FACTS IN JOST 12 TRACKED · AND ALWAYS A NUMBER · 2026

That repetition is what makes the page recognisable with the logo off-screen, and
it is what makes a plat and an orchid read as one practice. Do not vary it.
