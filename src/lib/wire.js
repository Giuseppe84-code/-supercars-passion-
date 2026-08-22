import { XMLParser } from 'fast-xml-parser';

const FEEDS = [
  { source: 'Carscoops',      url: 'https://www.carscoops.com/feed/' },
  { source: 'Motor1',         url: 'https://www.motor1.com/rss/news/all/' },
  { source: 'Speedcafe',      url: 'https://speedcafe.com/feed/' },
  { source: 'DailySportscar', url: 'https://www.dailysportscar.com/feed/' },
];

// The Wire is not a general car feed. Only what belongs on this site gets through.
const TOPICS = [
  'hypercar','coachbuilt','one-off','bespoke','restomod',
  'bugatti','koenigsegg','pagani','ferrari','lamborghini','mclaren','aston martin',
  'rimac','czinger','gordon murray','zenvo','hennessey','de tomaso','singer',
  'porsche 911 gt','porsche gt3','porsche gt2','carrera gt','valkyrie','revuelto',
  'le mans','lmdh','lmh','wec','endurance','imsa','daytona 24','sebring',
  'monterey','pebble beach','the quail','concours','goodwood',
  'v12','w16','v10','naturally aspirated',
];

// Speedcafe covers the Australian Supercars series too. Only its endurance
// coverage belongs here, so it is held to a narrower set of terms.
const ENDURANCE = ['le mans','lmdh','lmh','wec','imsa','daytona','sebring','hypercar'];

// Things that trip the keyword net but are not this site's subject.
const EXCLUDE = ['v8 supercars','supercars championship','repco','bathurst 1000',
  'podcast:','supercars driver','supercars team','supercars round'];

const ENTITIES = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' };

function decode(s = '') {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function onTopic(title, source) {
  const t = title.toLowerCase();
  if (EXCLUDE.some((k) => t.includes(k))) return false;
  const list = source === 'Speedcafe' ? ENDURANCE : TOPICS;
  return list.some((k) => t.includes(k));
}

function clean(s = '') {
  return decode(String(s).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

async function readFeed({ source, url }) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'SupercarsPassionBot/1.0 (+https://supercarspassion.com)' },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const items = parser.parse(await res.text())?.rss?.channel?.item ?? [];
    return (Array.isArray(items) ? items : [items])
      .map((i) => ({
        title: clean(i.title),
        link: typeof i.link === 'string' ? i.link : i.link?.['#text'] ?? '',
        date: new Date(i.pubDate ?? i['dc:date'] ?? Date.now()),
        source,
      }))
      .filter((i) => i.title && i.link);
  } catch (err) {
    // A dead feed must never take the build down. Log it and move on.
    console.warn(`[wire] ${source} unavailable: ${err.message}`);
    return [];
  }
}

export async function getWire(limit = 12) {
  const batches = await Promise.all(FEEDS.map(readFeed));
  const seen = new Set();

  return batches
    .flat()
    .filter((i) => onTopic(i.title, i.source))
    .filter((i) => {
      const key = i.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date - a.date)
    .slice(0, limit);
}

export function ago(date, now = Date.now()) {
  const mins = Math.max(1, Math.round((now - date.getTime()) / 60000));
  if (mins < 60) return mins + 'm';
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + 'h';
  return Math.round(hrs / 24) + 'd';
}
