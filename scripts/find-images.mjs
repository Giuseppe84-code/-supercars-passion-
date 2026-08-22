// Proposes a Wikimedia Commons photograph for each article that has none.
//
// Nothing here writes to the site. It queries Commons, reads the licensing
// metadata straight from the API, and drops the candidates in
// scripts/image-proposals.json for a human to approve. Credits taken from
// extmetadata rather than guessed, because a CC attribution that names the
// wrong photographer is worse than no photograph at all.
//
//   node scripts/find-images.mjs
//
// Run it where the network reaches commons.wikimedia.org. The site build
// itself stays offline: approved images are committed, never fetched at
// deploy time.
import { writeFile } from 'node:fs/promises';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'SupercarsPassion/1.0 (https://supercarspassion.com; editorial image research)';

// article slug -> what to search Commons for
const WANTED = [
  ['ferrari-f40-the-last-analog-supercar',                                         'Ferrari F40'],
  ['ferrari-f50-formula-1-for-the-road',                                           'Ferrari F50'],
  ['ferrari-enzo-when-formula-1-technology-became-a-road-car',                     'Ferrari Enzo Ferrari car'],
  ['ferrari-laferrari-the-hypercar-that-redefined-ferrari-itself',                 'LaFerrari'],
  ['porsche-carrera-gt',                                                           'Porsche Carrera GT'],
  ['porsche-918-spyder-the-hybrid-hypercar-that-turned-traction-into-a-superpower','Porsche 918 Spyder'],
  ['porsche-911-gt3-rs-when-precision-becomes-performance',                        'Porsche 911 GT3 RS'],
  ['porsche-911-gt2-rs-the-most-extreme-interpretation-of-the-911-philosophy',     'Porsche 911 GT2 RS'],
  ['lamborghini-miura',                                                            'Lamborghini Miura'],
  ['lamborghini-veneno',                                                           'Lamborghini Veneno'],
  ['lamborghini-sian',                                                             'Lamborghini Sian'],
  ['lamborghini-revuelto',                                                         'Lamborghini Revuelto'],
  ['mclaren-senna-in-the-name-of-ayrton',                                          'McLaren Senna car'],
  ['bugatti-divo-the-art-of-cornering-at-400-km-h',                                'Bugatti Divo'],
  ['koenigsegg-jesko-absolut',                                                     'Koenigsegg Jesko'],
  ['koenigsegg-gemera',                                                            'Koenigsegg Gemera'],
  ['pagani-utopia',                                                                'Pagani Utopia'],
  ['rimac-nevera-the-electric-hypercar-that-rewrote-the-physics-textbook',         'Rimac Nevera'],
  ['mercedes-amg-one-the-closest-thing-to-a-street-legal-formula-one-car',         'Mercedes-AMG One'],
  ['dodge-viper-when-excess-became-engineering',                                   'Dodge Viper'],
];

const CANDIDATES_PER_ARTICLE = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Commons rate-limits build agents hard, so every call gets its own retries.
async function api(params, attempts = 4) {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json' })}`;
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      last = err;
      console.warn(`    attempt ${i}/${attempts} failed (${err.message})`);
      if (i < attempts) await sleep(i * 2000);
    }
  }
  throw new Error(`${last.message} after ${attempts} attempts`);
}

const strip = (html) =>
  html ? html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

async function search(query) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1600',
  });

  const pages = Object.values(data?.query?.pages ?? {});
  const all = pages
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      const meta = info.extmetadata ?? {};
      return {
        file: p.title.replace(/^File:/, ''),
        width: info.width,
        height: info.height,
        landscape: info.width > info.height,
        author: strip(meta.Artist?.value),
        license: strip(meta.LicenseShortName?.value),
        description: strip(meta.ImageDescription?.value).slice(0, 180),
        pageUrl: info.descriptionurl,
        previewUrl: info.thumburl,
      };
    })
    .filter(Boolean);

  // Licence is never relaxed: anything not clearly CC or public domain cannot
  // be republished here, however good the photograph is.
  const usable = all.filter((c) => /^(CC|CC0|Public domain)/i.test(c.license || ''));

  // Shape and size are preferences, not rules. Try the ideal first, then widen
  // rather than reporting nothing and sending a human to search by hand.
  const tiers = [
    ['ideal',    (c) => c.landscape && c.width >= 1600],
    ['ok',       (c) => c.landscape && c.width >= 1000],
    ['any-size', (c) => c.landscape],
    ['portrait', () => true],
  ];

  for (const [tier, test] of tiers) {
    const hits = usable.filter(test);
    if (hits.length) {
      return {
        tier,
        candidates: hits.slice(0, CANDIDATES_PER_ARTICLE),
        rejectedForLicence: all.length - usable.length,
      };
    }
  }
  return { tier: 'none', candidates: [], rejectedForLicence: all.length - usable.length };
}

const proposals = [];
console.log(`[find-images] searching Commons for ${WANTED.length} articles\n`);

for (const [slug, query] of WANTED) {
  process.stdout.write(`  ${query} … `);
  try {
    const { tier, candidates, rejectedForLicence } = await search(query);
    console.log(
      candidates.length
        ? `${candidates.length} candidate(s) [${tier}]`
        : `NONE (${rejectedForLicence} rejected on licence)`
    );
    proposals.push({ slug, query, tier, candidates });
  } catch (err) {
    console.log(`FAILED (${err.message})`);
    proposals.push({ slug, query, tier: 'error', candidates: [], error: err.message });
  }
  await sleep(700); // deliberate pacing; Commons is a donated resource
}

await writeFile('scripts/image-proposals.json', JSON.stringify(proposals, null, 2) + '\n');

const found = proposals.filter((p) => p.candidates.length).length;
console.log(`\n[find-images] ${found}/${WANTED.length} articles have candidates`);
console.log('[find-images] wrote scripts/image-proposals.json');
