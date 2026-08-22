import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Canonical URLs follow the environment: the real domain once SITE_URL is set,
// otherwise whatever Vercel is actually serving. Never a domain that isn't live.
const site =
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321');

export default defineConfig({
  site,
  integrations: [sitemap()],
  build: { inlineStylesheets: 'auto' },
});
