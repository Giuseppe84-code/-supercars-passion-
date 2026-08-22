// Downloads fonts and photography at build time so the repository stays text-only.
// Once this project lives in a git repo, commit public/ and drop this step.
import { mkdir, writeFile } from 'node:fs/promises';

const COMMONS = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
const UA_BOT = 'SupercarsPassion/1.0 (site build)';
const UA_WEB =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const IMAGES = [
  ['bolide.jpg',  '2024 Bugatti Bolide 3.jpg', 1600],
  ['ford-gt.jpg', "Ford Chip Ganassi Racing's Ford GT GTE at the 2019 Petit Le Mans.jpg", 1000],
  ['huayra.jpg',  'Pagani Huayra BC Roadster, BAS 24, Brussels (P1170491-RR).jpg', 1000],
];

const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1' +
  '&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Build-time downloads are the fragile part of this step, so each one gets
// several attempts with backoff before it is allowed to fail the build.
async function grab(url, ua, attempts = 4) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45000);
      const res = await fetch(url, { headers: { 'User-Agent': ua }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      last = err;
      console.warn(`  attempt ${i}/${attempts} failed (${err.message}) ${url}`);
      if (i < attempts) await sleep(i * 2000);
    }
  }
  throw new Error(`${last.message} after ${attempts} attempts: ${url}`);
}

async function images() {
  await mkdir('public/img', { recursive: true });
  for (const [name, file, width] of IMAGES) {
    const res = await grab(`${COMMONS}${encodeURIComponent(file)}?width=${width}`, UA_BOT);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(`public/img/${name}`, buf);
    console.log(`  img/${name}  ${Math.round(buf.length / 1024)} KB`);
  }
}

async function fonts() {
  await mkdir('public/fonts', { recursive: true });
  const css = await (await grab(FONT_CSS, UA_WEB)).text();
  const faces = [];

  for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    if (!block.includes('U+0000-00FF')) continue;           // latin subset only
    const url = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    if (!url) continue;
    const family = block.match(/font-family:\s*'([^']+)'/)[1];
    const weight = block.match(/font-weight:\s*([^;]+);/)[1].trim().replace(/\s+/g, '-');
    const name = `${family.replace(/\s+/g, '-').toLowerCase()}-${weight}.woff2`;

    const buf = Buffer.from(await (await grab(url, UA_WEB)).arrayBuffer());
    await writeFile(`public/fonts/${name}`, buf);
    faces.push(block.replace(url, `/fonts/${name}`));
  }

  await writeFile('src/styles/fonts.css', faces.join('\n') + '\n');
  console.log(`  ${faces.length} font files`);
}

console.log('[prefetch] assets');
// Sequential rather than parallel: gentler on both origins, and a failure
// points at one clear culprit instead of two tangled stack traces.
await images();
await fonts();
console.log('[prefetch] done');
