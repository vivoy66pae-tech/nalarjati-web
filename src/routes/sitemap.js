import { Router } from 'express';
import { getAllPosts } from '../markdown.js';
import { readFileSync } from 'node:fs';
import { config } from '../config.js';

const router = Router();

function loadPortfolio() {
  try { return JSON.parse(readFileSync(config.paths.content + 'portfolio.json', 'utf8')); } catch { return []; }
}

router.get('/sitemap.xml', (req, res) => {
  const base = config.siteUrl.replace(/\/$/, '');
  const posts = getAllPosts();
  const projects = loadPortfolio();
  const staticPages = ['', '/#services', '/#process', '/#stack', '/#contact', '/blog', '/berita', '/pialadunia/', '/portfolio', '/horor'];
  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    ...staticPages.map((p) => ({ loc: base + p, lastmod: today, priority: p === '' ? '1.0' : '0.7' })),
    ...posts.map((p) => ({ loc: `${base}/blog/${p.slug}`, lastmod: String(p.date || '').slice(0, 10) || today, priority: '0.8' })),
    ...projects.map((p) => ({ loc: `${base}/portfolio/${p.slug}`, lastmod: String(p.updated || '').slice(0, 10) || today, priority: '0.7' })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

router.get('/robots.txt', (req, res) => {
  const base = config.siteUrl.replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`);
});

export default router;
