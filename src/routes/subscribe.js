import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db, { hashIp } from '../db.js';
import { sendEmail } from '../email.js';
import { config } from '../config.js';

const router = Router();
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many signup attempts.' },
});

router.post('/', limiter, async (req, res) => {
  const { email, name, hp } = req.body || {};
  if (hp) return res.json({ ok: true });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid email' });
  }

  const ip = (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || '';
  const ua = (req.headers['user-agent'] || '').slice(0, 256);

  try {
    db.prepare(`
      INSERT INTO subscribers (email, name, source, ip) VALUES (?, ?, ?, ?)
    `).run(String(email).toLowerCase().slice(0, 200), String(name || '').slice(0, 100), req.headers.referer || '', ip);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.json({ ok: true, already: true });
    }
    return res.status(500).json({ ok: false, error: 'server error' });
  }

  // Welcome email to subscriber + notify admin
  await sendEmail({
    subject: `New newsletter subscriber: ${email}`,
    text: `${email}${name ? ' (' + name + ')' : ''}\nSource: ${req.headers.referer || 'direct'}\nIP: ${ip}`,
  });

  await sendEmail({
    subject: `Welcome to nalarjati.dev`,
    text: `Hi${name ? ' ' + name : ''},\n\nThanks for subscribing. New posts ship to this address — no spam, unsubscribe anytime.\n\n— nalarjati.dev`,
    replyTo: undefined,
  });

  res.json({ ok: true });
});

export default router;
