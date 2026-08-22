// Proposes a Wikimedia Commons photograph for each article that has none.
//
//   node scripts/find-images.mjs --dry-run     show which articles and queries
//   node scripts/find-images.mjs --limit 20    search the first 20 of them
//
// The set of articles is read from the frontmatter, never hardcoded: an
// article gains `image:` and leaves this list on its own. Queries are derived
// from the title, which suits pieces about one car and suits a buying guide
// badly -- so scripts/image-queries.json overrides any of them, and mapping a
// slug to null drops an article that has no photographable subject.
//
// Writes scripts/image-proposals.json for a human to approve. Author and
// licence come from the Commons API rather than inference, because a CC
// attribution naming the wrong photographer is worse than no photograph.
//
// Run where the network reaches Commons. The build stays offline; approved
// images are committed like the ones already in public/img.
import { readFileSync, existsSync } from 'node:fs';
import { writeFile, readdir } from 'node:fs/promises';

const UA = 'SupercarsPassion/1.0 (https://supercarspassion.com; editorial image research)';
const ARTICLES = 'src/articles';
const OVERRIDES = 'scripts/image-queries.json';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => (h ? h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '');
const field = (src, name) =>
  src.match(new RegExp(`^${name}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1] ?? '';

// "Bugatti Tourbillon: The 1,800 HP Hypercar…" -> "Bugatti Tourbillon".
// The subject is what comes before the editorial flourish.
const queryFromTitle = (title) =>
  title.split(/\s*[:—(]|\s+[-–]\s+/)[0].replace(/\s+/g, ' ').trim();

async function articlesNeedingImages() {
  const overrides = existsSync(OVERRIDES)
    ? JSON.parse(readFileSync(OVERRIDES, 'utf8'))
    : {};

  const files = (await readdir(ARTICLES)).filter((f) => f.endsWith('.md')).sort();
  const out = [];

  for (const f of files) {
    const slug = f.replace(/\.md$/, '');
    const src = readFileSync(`${ARTICLES}/${f}`, 'utf8');
    if (/^image:/m.test(src)) continue;              // already illustrated

    if (slug in overrides) {
      if (overrides[slug] === null) continue;        // deliberately skipped
      out.push({ slug, query: overrides[slug], source: 'override' });
    } else {
      out.push({ slug, query: queryFromTitle(field(src, 'title')), source: 'title' });
    }
  }
  return out;
}

// Commons throttles automated agents hard -- this repository already hit a 429
// fetching its first three photographs -- so every call gets retries.
async function search(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
    gsrsearch: `${query} filetype:bitmap`,
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1600',
  });

  let last;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pages = Object.values((await res.json())?.query?.pages ?? {});

      const all = pages.flatMap((p) => {
        const info = p.imageinfo?.[0];
        if (!info) return [];
        const m = info.extmetadata ?? {};
        return [{
          file: p.title.replace(/^File:/, ''),
          width: info.width, height: info.height,
          author: strip(m.Artist?.value),
          license: strip(m.LicenseShortName?.value),
          description: strip(m.ImageDescription?.value).slice(0, 180),
          pageUrl: info.descriptionurl, previewUrl: info.thumburl,
        }];
      });

      // Licence is the one filter that never relaxes.
      const usable = all.filter((c) => /^(CC|CC0|Public domain)/i.test(c.license || ''));

      // Shape and size are preferences: rank rather than exclude, so a search
      // returns something reviewable instead of nothing.
      const score = (c) => (c.width > c.height ? 2 : 0) + (c.width >= 1600 ? 1 : 0);
      usable.sort((a, b) => score(b) - score(a) || b.width - a.width);

      return { candidates: usable.slice(0, 3), rejected: all.length - usable.length };
    } catch (err) {
      last = err;
      console.warn(`    attempt ${i}/3 failed (${err.message})`);
      if (i < 3) await sleep(i * 2000);
    }
  }
  throw last;
}

const wanted = (await articlesNeedingImages()).slice(0, limit);

if (!wanted.length) {
  console.log('[find-images] every article already has an image. Nothing to do.');
  process.exit(0);
}

if (dryRun) {
  console.log(`[find-images] ${wanted.length} article(s) without an image:\n`);
  for (const w of wanted) console.log(`  ${w.query.padEnd(46)} <- ${w.slug}${w.source === 'override' ? '  [override]' : ''}`);
  console.log(`\nEdit ${OVERRIDES} to correct any query, or map a slug to null to skip it.`);
  process.exit(0);
}

const proposals = [];
console.log(`[find-images] searching Commons for ${wanted.length} article(s)\n`);

for (const { slug, query } of wanted) {
  process.stdout.write(`  ${query} ... `);
  try {
    const { candidates, rejected } = await search(query);
    console.log(candidates.length ? `${candidates.length} candidate(s)` : `NONE (${rejected} rejected on licence)`);
    proposals.push({ slug, query, candidates });
  } catch (err) {
    console.log(`FAILED (${err.message})`);
    proposals.push({ slug, query, candidates: [], error: String(err.message) });
  }
  await sleep(700); // deliberate pacing; Commons is a donated resource
}

await writeFile('scripts/image-proposals.json', JSON.stringify(proposals, null, 2) + '\n');
console.log(`\n[find-images] ${proposals.filter((p) => p.candidates.length).length}/${wanted.length} articles have candidates`);
console.log('[find-images] wrote scripts/image-proposals.json');
