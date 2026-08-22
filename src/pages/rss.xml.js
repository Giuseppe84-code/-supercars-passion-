import rss from '@astrojs/rss';

export async function GET(context) {
  const { getPosts } = await import('../lib/posts.js');

  const items = getPosts().map((p) => ({
    title: p.title,
    description: p.lede,
    pubDate: new Date(p.published),
    link: `/articles/${p.slug}/`,
  }));

  return rss({
    title: 'Supercars Passion',
    description: 'Hypercars, coachbuilt one-offs and endurance racing.',
    site: context.site,
    items,
  });
}
