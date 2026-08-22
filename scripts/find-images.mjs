// Proposes a Wikimedia Commons photograph for each article that has none.
//
// Writes scripts/image-proposals.json for a human to approve. Nothing here
// touches the site: author and licence are read from the Commons API rather
// than guessed, because a CC attribution naming the wrong photographer is
// worse than publishing no photograph at all.
//
//   node scripts/find-images.mjs
//
// Run where the network reaches Commons. The build stays offline; approved
// images get committed like the three already in public/img.
import { writeFile } from 'node:fs/promises';

const UA = 'SupercarsPassion/1.0 (https://supercarspassion.com; editorial image research)';

const WANTED = [
  ['ferrari-f40-the-last-analog-supercar', 'Ferrari F40'],
  ['ferrari-f50-formula-1-for-the-road', 'Ferrari F50'],
  ['ferrari-enzo-when-formula-1-technology-became-a-road-car', 'Ferrari Enzo Ferrari car'],
  ['ferrari-laferrari-the-hypercar-that-redefined-ferrari-itself', 'LaFerrari'],
  ['porsche-carrera-gt', 'Porsche Carrera GT'],
  ['porsche-918-spyder-the-hybrid-hypercar-that-turned-traction-into-a-superpower', 'Porsche 918 Spyder'],
  ['porsche-911-gt3-rs-when-precision-becomes-performance', 'Porsche 911 GT3 RS'],
  ['porsche-911-gt2-rs-the-most-extreme-interpretation-of-the-911-philosophy', 'Porsche 911 GT2 RS'],
  ['lamborghini-miura', 'Lamborghini Miura'],
  ['lamborghini-veneno', 'Lamborghini Veneno'],
  ['lamborghini-sian', 'Lamborghini Sian'],
  ['lamborghini-revuelto', 'Lamborghini Revuelto'],
  ['mclaren-senna-in-the-name-of-ayrton', 'McLaren Senna car'],
  ['bugatti-divo-the-art-of-cornering-at-400-km-h', 'Bugatti Divo'],
  ['koenigsegg-jesko-absolut', 'Koenigsegg Jesko'],
  ['koenigsegg-gemera', 'Koenigsegg Gemera'],
  ['pagani-utopia', 'Pagani Utopia'],
  ['rimac-nevera-the-electric-hypercar-that-rewrote-the-physics-textbook', 'Rimac Nevera'],
  ['mercedes-amg-one-the-closest-thing-to-a-street-legal-formula-one-car', 'Mercedes-AMG One'],
  ['dodge-viper-when-excess-became-engineering', 'Dodge Viper'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => (h ? h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '');

// Commons throttles automated agents hard -- this repository already hit a 429
// fetching its three existing photographs -- so every call gets retries.
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

const proposals = [];
console.log(`[find-images] searching Commons for ${WANTED.length} articles\n`);

for (const [slug, query] of WANTED) {
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
console.log(`\n[find-images] ${proposals.filter((p) => p.candidates.length).length}/${WANTED.length} articles have candidates`);
console.log('[find-images] wrote scripts/image-proposals.json');
