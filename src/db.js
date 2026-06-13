import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.paths.data + 'x'), { recursive: true });

const db = new Database(config.paths.data + 'nalarjati.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema migration — idempotent
db.exec(`
  CREATE TABLE IF NOT EXISTS contact_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    emailed INTEGER DEFAULT 0,
    email_error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    source TEXT,
    ip TEXT,
    confirmed INTEGER DEFAULT 0,
    unsubscribed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pageviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    referrer TEXT,
    country TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pageviews_created ON pageviews(created_at);
  CREATE INDEX IF NOT EXISTS idx_pageviews_path ON pageviews(path);
  CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_submissions(created_at);
  CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
`);

export default db;

// Helper: hash IP for privacy (no raw IP storage)
import { createHash } from 'node:crypto';
export const hashIp = (ip) => createHash('sha256').update(ip + (process.env.IP_SALT || 'nalarjati-default-salt')).digest('hex').slice(0, 16);
