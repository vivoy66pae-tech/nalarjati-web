import nodemailer from 'nodemailer';
import { config, isSmtpEnabled } from './config.js';

let transporter = null;

function getTransporter() {
  if (!isSmtpEnabled()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
  return transporter;
}

export async function sendEmail({ subject, text, html, replyTo }) {
  if (!isSmtpEnabled()) {
    console.log(`[email:disabled] would send: ${subject}`);
    return { sent: false, reason: 'smtp_not_configured' };
  }
  const t = getTransporter();
  try {
    const info = await t.sendMail({
      from: config.smtp.from,
      to: config.smtp.to,
      replyTo,
      subject,
      text,
      html,
    });
    console.log(`[email:sent] ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[email:error] ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

export async function verifySmtp() {
  if (!isSmtpEnabled()) return { ok: false, reason: 'not_configured' };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
