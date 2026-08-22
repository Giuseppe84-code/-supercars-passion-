# Supercars Passion

Editorial site covering hypercars, coachbuilt one-offs and endurance racing.
Live at **[supercarspassion.com](https://supercarspassion.com)**.

Built as a static site: 109 articles, no database, no server to maintain.

## What it does

The homepage runs a **hybrid model**. The wide column holds original writing.
The narrow column — *The Wire* — aggregates headlines from four motoring feeds,
filtered down to what actually belongs on a hypercar site, and links out to the
original publisher. Readers can tell the two apart at a glance, and so can search
engines.

## Stack

| | |
|---|---|
| Framework | Astro 7 (static output) |
| Content | Markdown with frontmatter, drafts supported |
| Feeds | `fast-xml-parser` over RSS, resolved at build time |
| Hosting | Netlify |
| Fonts | Fraunces, IBM Plex Sans/Mono — self-hosted |

## Structure

```
src/
  articles/      one Markdown file per story
  components/    Wire.astro — feed fetching and rendering
  layouts/       Base.astro — SEO head, canonical, JSON-LD
  lib/
    posts.js     article loading, draft filtering
    wire.js      feed fetch, topic filter, dedupe
  pages/         index, archive, articles/[slug], rss.xml
public/
  img/           article imagery
  fonts/         self-hosted woff2
```

## Running it

```bash
npm install
npm run dev      # local server
npm run build    # static output to dist/
npm run assets   # re-fetch fonts and Wikimedia imagery (optional)
```

## Notes on a few decisions

**Canonical URLs follow the environment.** `astro.config.mjs` reads `SITE_URL`,
falling back to whatever Netlify is serving. A canonical tag never points at a
domain that isn't live — the bug that kept the previous WordPress version out of
Google's index.

**A dead feed cannot break a deploy.** Each feed fetch is wrapped and logged; a
failure drops that source and the build continues.

**Assets are committed, not fetched at build time.** An earlier version
downloaded fonts and images during the build and broke when Wikimedia
rate-limited the build servers. External downloads now live in `npm run assets`,
run deliberately, never in the deploy path.

**Drafts never ship.** `draft: true` in frontmatter keeps an article out of the
routes, the sitemap and the feed.
