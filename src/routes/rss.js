import { Router } from 'express';
import { getAllPosts, renderMarkdown } from '../markdown.js';
import { config } from '../config.js';

const router = Router();
const base = () => config.siteUrl.replace(/\/$/, '');

router.get('/feed.xml', (req, res) => {
  const posts = getAllPosts();
  const lastBuild = (posts[0]?.date ? new Date(posts[0].date) : new Date()).toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>nalarjati.dev</title>
<link>${base()}</link>
<description>AI, infrastructure, and web engineering notes.</description>
<language>en</language>
<lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
<atom:link href="${base()}/feed.xml" rel="self" type="application/rss+xml"/>
${posts.slice(0, 20).map((p) => `<item>
<title>${escape(p.title)}</title>
<link>${base()}/blog/${p.slug}</link>
<guid>${base()}/blog/${p.slug}</guid>
<pubDate>${new Date(p.date || Date.now()).toUTCString()}</pubDate>
<description>${escape(p.excerpt)}</description>
</item>`).join('\n')}
</channel>
</rss>`;

  res.set('Content-Type', 'application/rss+xml');
  res.send(xml);
});

function escape(s = '') {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default router;
