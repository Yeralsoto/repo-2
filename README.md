# yeraldinsoto.com

Personal site for Yeraldin Soto — land development. Nine pages, English and Spanish.

## Run it

    python3 -m http.server 8139

then open http://localhost:8139

## Change the words

Every word, in both languages, and every album frame lives in `tools/build.py`.
Edit it, then regenerate the pages:

    python3 tools/build.py

Never hand-edit the generated `index.html` files — the next build overwrites them.

## Stack

Static HTML, four CSS files, one JS file. No dependencies, no framework. Python 3 only
to regenerate pages. Fonts from Google Fonts.

## Before you change anything

Read `CLAUDE.md`. The colour, type and spacing systems are audited, and `css/tokens.css`
is read-only.

## Pages

    /            Home — the portrait, and the drawing that becomes land, then a house
    /work/       The Work          /days/       The Days — the film-strip album
    /practice/   The Practice      /aerodrome/  The Aerodrome — the El Dorado thesis
    /journal/    The Journal       /path/       The Path
    /mind/       Inside My Mind    /about/      About & contact

## Photographs

Only copy from `../photo-bank-web/`. The originals carry location data from her home.
