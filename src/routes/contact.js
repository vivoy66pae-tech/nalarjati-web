import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import db, { hashIp } from '../db.js';
import { sendEmail } from '../email.js';
import { config } from '../config.js';

const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions, slow down.' },
});

router.post('/', limiter, async (req, res) => {
  const { name, email, subject, message, hp } = req.body || {};

  // Honeypot — bots fill this
  if (hp) return res.json({ ok: true });

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'name, email, message required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid email' });
  }
  if (String(message).length > 5000) {
    return res.status(400).json({ ok: false, error: 'message too long' });
  }

  const ip = (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || '';
  const ua = (req.headers['user-agent'] || '').slice(0, 256);

  const result = db.prepare(`
    INSERT INTO contact_submissions (name, email, subject, message, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(String(name).slice(0, 200), String(email).slice(0, 200), String(subject || '').slice(0, 200), String(message).slice(0, 5000), ip, ua);

  const id = result.lastInsertRowid;

  let emailResult = { sent: false, reason: 'skipped' };
  try {
    emailResult = await sendEmail({
      subject: `[contact #${id}] ${subject || 'New inquiry'}`,
      text: `From: ${name} <${email}>\nSubject: ${subject || '(none)'}\n\n${message}\n\n--\nIP: ${ip}\nUA: ${ua}\nView: ${config.siteUrl}/admin`,
      html: `<p><b>From:</b> ${escape(name)} &lt;${escape(email)}&gt;</p>
<p><b>Subject:</b> ${escape(subject || '(none)')}</p>
<hr>
<p>${escape(message).replace(/\n/g, '<br>')}</p>
<hr>
<small>IP: ${escape(ip)}<br>UA: ${escape(ua)}<br>View in admin: <a href="${config.siteUrl}/admin">${config.siteUrl}/admin</a></small>`,
      replyTo: email,
    });
    db.prepare('UPDATE contact_submissions SET emailed = ?, email_error = ? WHERE id = ?')
      .run(emailResult.sent ? 1 : 0, emailResult.reason || null, id);
  } catch (err) {
    db.prepare('UPDATE contact_submissions SET email_error = ? WHERE id = ?').run(err.message, id);
  }

  res.json({ ok: true, id, emailed: emailResult.sent });
});

function escape(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default router;
