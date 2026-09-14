# Backlinks — what's done, and what only you can do

**The link, always in this exact form:**

    https://yeraldinsoto.com/

https, no `www`, with the trailing slash. That is what `rel=canonical` declares, and
mixing forms splits the credit between two addresses that search engines treat as
different pages. For the Spanish version: `https://yeraldinsoto.com/?lang=es`

---

## Done — the groundwork

A backlink only pays off if the page it lands on is legible to a crawler and looks
right when it is shared. That part is built:

| | |
|---|---|
| Canonical URL | one address, declared |
| `hreflang` | `en`, `es`, `x-default` — the two languages tied together, not competing |
| Title + description | distinct per language, swapped live with the toggle |
| Open Graph + Twitter | with a 1200×630 card (`assets/share.jpg`) |
| JSON-LD `Person` | name, role, location, languages, what you know about |
| `sitemap.xml`, `robots.txt` | at the site root |
| Internal links | index overlay + footer links to every section |

---

## Yours to do — the links you already own

These are the legitimate, highest-value backlinks available to you, and every one is a
profile you control. They do two jobs: they pass real signal, and they let Google
connect the profiles to the site as the same person.

### 1. LinkedIn — the most valuable one

Your profile: https://www.linkedin.com/in/yeraldin-soto-c-619761235/
It is already in the site's structured data (`sameAs`) and linked from the footer and the index.
What's left is the other direction — the link from LinkedIn back to the site:

- **Contact info → Website.** Add `https://yeraldinsoto.com/`, labelled *Personal*.
- **About**, last line:

  > Selected work and field notes: https://yeraldinsoto.com/

- **Featured** → Add a link. Title: *Yeraldin Soto — land development*. It shows the
  share card.

### 2. Instagram

Bio link. If you use a link-in-bio tool, put the real domain first in the list — some
of those tools mark their outbound links `nofollow`, which passes no credit, so the
profile's own website field matters more than the aggregator.

### 3. Scout Land Group

Your work email is `@scoutlandgroup.com`, so there is very likely a team or bio page
there. A link from a real company site in the same industry is worth more than any
number of directory listings. Ask for:

  > Yeraldin Soto — land development strategist and civil engineer.
  > [yeraldinsoto.com](https://yeraldinsoto.com/)

### 4. Email signature

Your address: yeraldinsotocastro@gmail.com — it is already on the site (footer, index, structured data).

Not a ranking signal — nothing crawls your email — but it is how the people who matter
most actually find the site. Worth more than most of the list.

    Yeraldin Soto · Land development and underwriting
    yeraldinsoto.com · Medellín, Colombia

### 5. Anywhere else you already appear

Conference or panel bios · industry association profiles · podcast or interview show
notes · university or alumni listings · any press mention. Each one is a link you can
usually just ask to have added, and asking costs nothing.

---

## After you add them: one edit here

The `sameAs` field tells Google your profiles and this site are one person. LinkedIn is
already in it. When another profile is live — Instagram, a Scout Land Group bio — add its
real URL to the same list in the JSON-LD block of `index.html`:

```json
  "sameAs": [
    "https://www.linkedin.com/in/yeraldin-soto-c-619761235/",
    "https://www.instagram.com/YOUR-HANDLE/"
  ],
```

Only list profiles that are actually yours and actually live.

---

## Do not buy backlinks

Paid link packages, "1,000 backlinks for $50", private blog networks, comment and forum
spam — these are the thing Google's link-spam policy is written to catch, and the result
is a penalty on a site with your own name on it. For a personal brand the downside is
not worth any upside. Slow and real beats fast and bought, every time.

---

## Checking it worked

1. **Google Search Console** — verify the domain, submit `sitemap.xml`. This is also
   where you see which links Google has actually found.
2. `site:yeraldinsoto.com` in Google — confirms it is indexed at all.
3. **Rich Results Test** — paste the URL, confirm the `Person` block is read.
4. **LinkedIn Post Inspector** and **Facebook Sharing Debugger** — paste the URL to see
   the share card, and to force a re-scrape if you change it later.

Indexing takes days to weeks. Links take longer. Nothing here is instant.
