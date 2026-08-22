// Single source of truth for article loading. Drafts never reach production.
const modules = import.meta.glob('../articles/*.md', { eager: true });

export function getPosts({ includeDrafts = false } = {}) {
  return Object.entries(modules)
    .map(([path, mod]) => ({
      slug: path.split('/').pop().replace('.md', ''),
      mod,
      ...mod.frontmatter,
    }))
    .filter((p) => includeDrafts || p.draft !== true)
    .sort((a, b) => new Date(b.published) - new Date(a.published));
}
