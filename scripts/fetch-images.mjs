// Downloads one Creative Commons photograph per article from Wikimedia Commons.
//
//   node fetch-images.mjs
//
// Standalone on purpose. The repository's build servers cannot reach Commons --
// that is what broke deploys before the assets were versioned -- and neither can
// the agent environment, so this runs on a normal machine with the job list
// baked in rather than read from src/articles. It needs no repository checkout,
// no npm install and no arguments.
//
// It writes:
//   foto/<slug>.jpg      the chosen photograph, ~1600px wide
//   foto/proposte.json   every candidate with author and licence, for wiring up
//   foto/scegli.html     a contact sheet: open it in a browser to check the pick
//
// Attribution comes from the Commons API, never from inference: a CC credit
// naming the wrong photographer is worse than shipping no photograph at all.
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'SupercarsPassion/1.0 (https://supercarspassion.com; editorial image research)';
const OUT = 'foto';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (h) => (h ? h.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const JOBS = [["858","McLaren 600LT"],["aston-martin-history","Aston Martin DB5"],["aston-martin-valhalla-1064bhp-and-the-most-advanced-road-car-gaydon-has-ever-built","Aston Martin Valhalla"],["aston-martin-valkyrie-when-a-road-car-is-designed-like-an-f1-prototype","Aston Martin Valkyrie"],["beyond-godzilla-the-other-titans-of-the-jdm-golden-age","Toyota Supra A80"],["bugatti-chiron-super-sport-300","Bugatti Chiron Super Sport"],["bugatti-history","Bugatti Type 57"],["bugatti-tourbillon","Bugatti Tourbillon"],["buying-guide-how-to-import-an-original-skyline-from-japan-without-getting-burned","Nissan Skyline GT-R R32"],["chevrolet-corvette-americas-enduring-performance-icon","Chevrolet Corvette C8"],["dallara-stradale","Dallara Stradale"],["electric-hypercars-rimac-and-the-end-of-combustion-supremacy","Rimac Nevera"],["ferrari-488-pista-when-ferrari-turned-a-supercar-into-a-weapon","Ferrari 488 Pista"],["ferrari-amalfi-spider","Ferrari Amalfi Spider"],["ferrari-f80","Ferrari F80"],["ferrari-hc25-a-one-off-v8-roadster-that-bridges-two-eras","Ferrari HC25"],["ferrari-history","Ferrari F40"],["ferrari-p80-c-the-last-true-one-off","Ferrari P80/C"],["ferrari-sf90-stradale-when-hybrid-becomes-hypercar","Ferrari SF90 Stradale"],["ferrari-sf90-xx-stradale","Ferrari SF90 XX Stradale"],["ferrari-the-story-of-a-man-a-machine-and-a-myth","Enzo Ferrari"],["ferrari-vs-lamborghini-the-origin-of-a-myth","Lamborghini Miura"],["first-track-day-guide","Circuit de Spa-Francorchamps"],["ford-gt-the-full-story-from-the-gt40-mission-to-todays-track-only-mk-iv","Ford GT40"],["gordon-murray-t-50-the-fan-car-that-brought-manuals-back-to-heaven","Gordon Murray T.50"],["how-f1-technology-migrates-into-road-hypercars","Mercedes-Benz F1 W11"],["hypercars-vs-supercars-what-truly-defines-the-difference","Bugatti Veyron"],["import-sports-car-guide","car carrier ship RoRo"],["is-the-future-electric-rumors-and-truths-about-the-nissan-r36-gt-r","Nissan GT-R R35"],["jdm-vs-muscle-cars-two-worlds-one-addiction","Ford Mustang Mach 1"],["kimera-k39-an-f40-inspired-italian-hypercar-with-a-koenigsegg-heart","Kimera K39"],["koenigsegg-ccgt-a-tribute-to-the-le-mans-dream-that-never-raced","Koenigsegg CCGT"],["koenigsegg-how-one-man-reinvented-the-hypercar-industry","Koenigsegg Agera"],["laferrari-aperta","LaFerrari Aperta"],["lamborghini-aventador-svj-when-brutality-learned-discipline","Lamborghini Aventador SVJ"],["lamborghini-fenomeno-roadster-just-15-open-top-v12-hybrids-from-santagata","Lamborghini Fenomeno Roadster"],["lamborghini-history","Lamborghini Countach"],["lamborghini-huracan-performante-the-day-lamborghini-learned-to-think-in-air","Lamborghini Huracán Performante"],["lamborghini-temerario-the-10000rpm-hybrid-v8-that-replaced-the-huracan","Lamborghini Temerario"],["lotus-evija-the-carved-by-air-electric-hypercar-that-made-2000-horsepower-feel-like-a-design-problem","Lotus Evija"],["mclaren-history","McLaren F1"],["mclaren-mcl-hy-gtr-the-non-hybrid-730bhp-track-car-for-35-lucky-owners","McLaren MCL-HY GTR"],["mclaren-mcl-hy-woking-returns-to-le-mans-with-a-707bhp-hybrid-hypercar","McLaren MCL-HY"],["mclaren-p1-the-hybrid-hypercar-that-turned-instant-torque-active-aero-into-a-new-definition-of-fast","McLaren P1"],["mclaren-speedtail-2019-the-hyper-gt-that-chased-250-mph-with-science-not-spoilers","McLaren Speedtail"],["mclaren-w1","McLaren W1"],["most-expensive-supercar-crashes","Lamborghini Huracán"],["new-hypercars-2026","Koenigsegg Jesko"],["nissan-gt-r-nismo-and-the-skyline-family-from-the-first-prince-skyline-to-the-last-r34-godzilla","Nissan Skyline GT-R R34"],["nissan-skyline-history","Nissan Skyline 2000GT-R"],["pagani-and-koenigsegg-the-artisans-who-challenged-the-giants","Pagani Huayra"],["paul-walkers-legacy-how-cinema-made-the-skyline-immortal","Nissan Skyline GT-R R33"],["pininfarina-battista-when-silence-became-the-new-power","Pininfarina Battista"],["police-supercars","police Lamborghini"],["porsche-911-turbo-s-hybrid-2026","Porsche 911 Turbo S T-Hybrid"],["porsche-911-turbo-the-quiet-master-of-speed","Porsche 911 Turbo"],["porsche-911-vs-bmw-m4","BMW M4"],["porsche-carrera-gt-the-v10-manual-carbon-fiber-icon-that-still-feels-unreal","Porsche Carrera GT"],["porsche-history","Porsche 356"],["porsche-mission-x-the-electric-hypercar-aiming-to-become-the-new-918","Porsche Mission X"],["rb26dett-anatomy-of-the-engine-that-built-a-legend","Nissan RB26DETT engine"],["stage-1-vs-stage-2-tune","turbocharger"],["supercar-daily-driver-dream-or-reality","Porsche 911 Carrera"],["supercar-ownership-costs","Ferrari 458 Italia"],["supercars-as-investments-which-models-to-buy-today","Porsche 959"],["the-5-most-underrated-supercars-in-history","Honda NSX"],["the-5-rarest-gt-r-variants-youll-probably-never-see-in-real-life","Nissan Skyline GT-R V-Spec"],["the-500-km-h-club-bugatti-vs-hennessey-vs-ssc","Hennessey Venom F5"],["the-aerodynamics-of-a-pagani-beauty-driven-by-physics","Pagani Zonda"],["the-battle-of-giants-nissan-gt-r-vs-porsche-911-turbo","Nissan GT-R Nismo"],["the-era-of-electric-hypercars-rimac-vs-lotus","Rimac Concept One"],["the-evolution-of-supercars-from-classic-icons-to-future-innovations","Lamborghini Diablo"],["the-hypercar-holy-trinity-10-years-later","Porsche 918 Spyder"],["underrated-sports-cars","Mazda RX-7"],["wec-bmw-standings-2026","BMW M Hybrid V8"],["why-hypercars-are-becoming-alternative-investment-assets","Ferrari LaFerrari"],["why-modern-supercars-are-no-longer-just-about-speed","McLaren 720S"],["why-modern-supercars-feel-more-like-luxury-tech-than-raw-machines","Ferrari Roma"],["why-the-bugatti-chiron-is-closer-to-aerospace-than-to-automotive-engineering","Bugatti Chiron"],["why-the-nurburgring-is-every-automakers-obsession","Nürburgring Nordschleife"]];

// Commons throttles automated agents hard -- this project already hit a 429 on
// its third image -- so every request retries with a widening gap, and the pace
// between articles is deliberate. Commons is a donated resource.
async function withRetries(label, fn) {
  let last;
  for (let i = 1; i <= 3; i++) {
    try { return await fn(); }
    catch (err) { last = err; console.warn(`      ${label} attempt ${i}/3: ${err.message}`); if (i < 3) await sleep(i * 2500); }
  }
  throw last;
}

async function search(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
    gsrsearch: `${query} filetype:bitmap`,
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1600',
  });

  return withRetries('search', async () => {
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
        description: strip(m.ImageDescription?.value).slice(0, 200),
        pageUrl: info.descriptionurl, previewUrl: info.thumburl,
      }];
    });

    // Licence is the one filter that never relaxes.
    const usable = all.filter((c) => /^(CC|CC0|Public domain)/i.test(c.license || ''));
    // Shape and size are preferences: rank rather than exclude, so a search
    // returns something reviewable instead of nothing.
    const score = (c) => (c.width > c.height ? 2 : 0) + (c.width >= 1600 ? 1 : 0);
    usable.sort((a, b) => score(b) - score(a) || b.width - a.width);
    return usable.slice(0, 3);
  });
}

async function download(url, dest) {
  return withRetries('download', async () => {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  });
}

await mkdir(OUT, { recursive: true });
console.log(`\nCerco e scarico ${JOBS.length} fotografie da Wikimedia Commons.`);
console.log('Ci vogliono circa 5 minuti. Puoi lasciarlo lavorare.\n');

const results = [];
let ok = 0, empty = 0, failed = 0;

for (const [i, [slug, query]] of JOBS.entries()) {
  const n = String(i + 1).padStart(2, ' ');
  process.stdout.write(`  ${n}/${JOBS.length}  ${query.padEnd(42).slice(0, 42)} `);

  let candidates = [];
  try {
    candidates = await search(query);
  } catch (err) {
    console.log(`RICERCA FALLITA (${err.message})`);
    results.push({ slug, query, candidates: [], file: null, error: String(err.message) });
    failed++;
    await sleep(900);
    continue;
  }

  if (!candidates.length) {
    console.log('nessuna foto con licenza libera');
    results.push({ slug, query, candidates: [], file: null });
    empty++;
    await sleep(900);
    continue;
  }

  const pick = candidates[0];
  const ext = (pick.previewUrl.match(/\.(jpe?g|png)$/i)?.[1] ?? 'jpg').toLowerCase();
  const name = `${slug}.${ext === 'jpeg' ? 'jpg' : ext}`;

  try {
    await download(pick.previewUrl, `${OUT}/${name}`);
    console.log(`ok  (${pick.width}x${pick.height}, ${pick.license})`);
    results.push({ slug, query, candidates, file: name });
    ok++;
  } catch (err) {
    console.log(`SCARICO FALLITO (${err.message})`);
    results.push({ slug, query, candidates, file: null, error: String(err.message) });
    failed++;
  }

  await sleep(900);
}

await writeFile(`${OUT}/proposte.json`, JSON.stringify(results, null, 2) + '\n');

// The contact sheet loads the downloaded file for the pick and remote thumbnails
// for the alternates, so the page shows what was actually saved to disk.
const cards = results.map((r, i) => {
  const alts = r.candidates.slice(1).map((c) => `
        <a class="alt" href="${esc(c.pageUrl)}" target="_blank" rel="noopener">
          <img src="${esc(c.previewUrl)}" alt="" loading="lazy" />
        </a>`).join('');

  const shot = r.file
    ? `<img class="hero" src="${esc(r.file)}" alt="" loading="lazy" />`
    : `<div class="hero none">nessuna foto</div>`;

  const c = r.candidates[0];
  return `
    <article class="card${r.file ? '' : ' bad'}">
      <div class="num">${i + 1}</div>
      ${shot}
      <div class="meta">
        <b>${esc(r.query)}</b>
        <span class="slug">${esc(r.slug)}</span>
        ${c ? `<span class="lic">${esc(c.license)} — ${esc(c.author) || 'autore non indicato'}</span>` : '<span class="lic">—</span>'}
        ${alts ? `<div class="alts">alternative:${alts}</div>` : ''}
      </div>
    </article>`;
}).join('');

await writeFile(`${OUT}/scegli.html`, `<!doctype html>
<html lang="it"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Foto proposte — Supercars Passion</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0A1317;color:#E9E3D6;font:15px/1.5 system-ui,sans-serif}
  header{padding:1.5rem;border-bottom:1px solid #233A43}
  h1{margin:0 0 .4rem;font-size:1.3rem}
  header p{margin:0;color:#7C8C90}
  main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem;padding:1.5rem}
  .card{border:1px solid #233A43;background:#0e1d24;position:relative}
  .card.bad{border-color:#7a3030}
  .num{position:absolute;left:0;top:0;z-index:2;background:#C08B3E;color:#0A1317;font-weight:700;padding:.2rem .55rem}
  .hero{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}
  .hero.none{display:grid;place-items:center;color:#7C8C90;background:#122630}
  .meta{padding:.7rem .8rem .8rem;display:grid;gap:.25rem}
  .slug{color:#7C8C90;font-size:.78rem;word-break:break-all}
  .lic{color:#C08B3E;font-size:.78rem}
  .alts{margin-top:.5rem;display:flex;gap:.4rem;align-items:center;color:#7C8C90;font-size:.75rem}
  .alt img{width:64px;height:44px;object-fit:cover;border:1px solid #233A43}
</style></head>
<body>
<header>
  <h1>${ok} foto scaricate su ${JOBS.length}</h1>
  <p>Scorri e segnati i <b>numeri</b> di quelle sbagliate. Le miniature piccole sono le alternative disponibili.</p>
</header>
<main>${cards}</main>
</body></html>
`);

console.log(`\n─────────────────────────────────────────────`);
console.log(`  scaricate:            ${ok}`);
console.log(`  senza licenza libera: ${empty}`);
console.log(`  errori:               ${failed}`);
console.log(`─────────────────────────────────────────────`);
console.log(`\nOra apri questo file nel browser per controllarle:`);
console.log(`  ${process.cwd()}/${OUT}/scegli.html\n`);
console.log(`Poi crea lo zip da mandare, con questo comando:`);
console.log(`  zip -r foto.zip ${OUT}\n`);
