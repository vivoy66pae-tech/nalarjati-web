import { Router } from 'express';
import { basicAuth } from '../auth.js';
import db from '../db.js';

const router = Router();

router.use(basicAuth);

router.get('/stats', (req, res) => {
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM pageviews) AS total_views,
      (SELECT COUNT(DISTINCT ip_hash) FROM pageviews) AS unique_visitors,
      (SELECT COUNT(*) FROM pageviews WHERE date(created_at) = date('now')) AS views_today,
      (SELECT COUNT(DISTINCT ip_hash) FROM pageviews WHERE date(created_at) = date('now')) AS visitors_today,
      (SELECT COUNT(*) FROM pageviews WHERE date(created_at) >= date('now', '-7 days')) AS views_7d,
      (SELECT COUNT(*) FROM contact_submissions) AS contact_total,
      (SELECT COUNT(*) FROM contact_submissions WHERE date(created_at) = date('now')) AS contact_today,
      (SELECT COUNT(*) FROM subscribers WHERE unsubscribed_at IS NULL) AS subscribers_total
  `).get();

  const last7 = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS views, COUNT(DISTINCT ip_hash) AS visitors
    FROM pageviews WHERE date(created_at) >= date('now', '-6 days')
    GROUP BY day ORDER BY day
  `).all();

  const topPaths = db.prepare(`
    SELECT path, COUNT(*) AS views FROM pageviews
    WHERE date(created_at) >= date('now', '-30 days')
    GROUP BY path ORDER BY views DESC LIMIT 10
  `).all();

  const topReferrers = db.prepare(`
    SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS ref, COUNT(*) AS views
    FROM pageviews WHERE date(created_at) >= date('now', '-30 days') AND referrer IS NOT NULL
    GROUP BY ref ORDER BY views DESC LIMIT 10
  `).all();

  res.json({ totals, last7, topPaths, topReferrers });
});

router.get('/contacts', (req, res) => {
  const rows = db.prepare('SELECT id, name, email, subject, message, emailed, created_at FROM contact_submissions ORDER BY id DESC LIMIT 100').all();
  res.json({ contacts: rows });
});

router.get('/subscribers', (req, res) => {
  const rows = db.prepare('SELECT id, email, name, source, confirmed, unsubscribed_at, created_at FROM subscribers ORDER BY id DESC LIMIT 1000').all();
  res.json({ subscribers: rows });
});

router.get('/subscribers.csv', (req, res) => {
  const rows = db.prepare("SELECT email, name, source, created_at FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY id DESC").all();
  const csv = ['email,name,source,subscribed_at', ...rows.map((r) =>
    [r.email, r.name, r.source, r.created_at].map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
  )].join('\n');
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="subscribers.csv"');
  res.send(csv);
});

export default router;
