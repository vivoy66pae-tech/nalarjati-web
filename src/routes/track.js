import { Router } from 'express';
import db, { hashIp } from '../db.js';
import { config } from '../config.js';

const router = Router();

// Lightweight tracking — fire-and-forget. Don't block UX.
router.post('/', (req, res) => {
  if (!config.analytics.enabled) return res.json({ ok: true });
  const { path: p, ref } = req.body || {};
  if (!p || typeof p !== 'string' || p.length > 256) return res.status(400).end();
  const ip = (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || '';
  const ua = (req.headers['user-agent'] || '').slice(0, 256);
  const country = (req.headers['cf-ipcountry'] || req.headers['x-country'] || '').slice(0, 8) || null;
  db.prepare('INSERT INTO pageviews (path, referrer, country, user_agent, ip_hash) VALUES (?, ?, ?, ?, ?)')
    .run(p.slice(0, 256), (ref || '').slice(0, 256), country, ua, hashIp(ip));
  res.json({ ok: true });
});

export default router;
