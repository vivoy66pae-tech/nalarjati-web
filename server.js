import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './src/config.js';
import { verifySmtp } from './src/email.js';

import contact from './src/routes/contact.js';
import subscribe from './src/routes/subscribe.js';
import track from './src/routes/track.js';
import posts from './src/routes/posts.js';
import portfolio from './src/routes/portfolio.js';
import og from './src/routes/og.js';
import admin from './src/routes/admin.js';
import sitemap from './src/routes/sitemap.js';
import rss from './src/routes/rss.js';
import news from './src/routes/news.js';
import newsReader from './src/routes/news-reader.js';
import system from './src/routes/system.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.use(compression());

// Body parsing — limited
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Security headers (in addition to nginx)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (req.path.startsWith('/admin')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// SEO endpoints
app.use('/', sitemap);
app.use('/', rss);

// OG image
app.use('/og', og);

// API
app.use('/api/contact', contact);
app.use('/api/subscribe', subscribe);
app.use('/api/track', track);
app.use('/api/posts', posts);
app.use('/api/portfolio', portfolio);
app.use('/api/news', news);
app.use('/api/news/read', newsReader);
app.use('/api/system', system);
app.use('/api/admin', admin);

// Health check
app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Static (landing page, admin, assets) — let SPA-style routes fall through
app.use(express.static(config.paths.public, {
  maxAge: '1h',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// SPA fallback: /blog/* and /portfolio/* and /berita/* serve the index.html (which loads content via API)
app.get(/^\/blog(\/.*)?$/, (req, res) => res.sendFile(join(config.paths.public, 'blog/index.html')));
app.get(/^\/portfolio(\/.*)?$/, (req, res) => res.sendFile(join(config.paths.public, 'portfolio/index.html')));
app.get(/^\/berita(\/.*)?$/, (req, res) => res.sendFile(join(config.paths.public, 'berita/index.html')));
app.get(/^\/news(\/.*)?$/, (req, res) => res.sendFile(join(config.paths.public, 'berita/index.html')));
app.get(/^\/horor(\/.*)?$/, (req, res) => res.sendFile(join(config.paths.public, 'horor/index.html')));
app.get(/^\/sistem(\/.*)?$/, (req, res) => res.sendFile(join(config.paths.public, 'sistem/index.html')));

// 404
app.use((req, res) => {
  res.status(404).sendFile(join(config.paths.public, '404.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`[nalarjati] listening on http://127.0.0.1:${config.port}`);
  console.log(`[nalarjati] env: ${config.nodeEnv}`);
  console.log(`[nalarjati] analytics: ${config.analytics.enabled ? 'on' : 'off'}`);
  verifySmtp().then((r) => {
    console.log(`[nalarjati] smtp: ${r.ok ? 'ok' : 'disabled (' + r.reason + ')'}`);
  });
});
