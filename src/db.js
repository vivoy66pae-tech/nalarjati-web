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

  CREATE TABLE IF NOT EXISTS news_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL,
    language TEXT DEFAULT 'id',
    enabled INTEGER DEFAULT 1,
    last_fetched_at TEXT,
    last_status TEXT,
    last_error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS news_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    guid TEXT NOT NULL,
    title TEXT NOT NULL,
    link TEXT NOT NULL,
    summary TEXT,
    author TEXT,
    image_url TEXT,
    published_at TEXT,
    fetched_at TEXT DEFAULT (datetime('now')),
    pinned INTEGER DEFAULT 0,
    hidden INTEGER DEFAULT 0,
    UNIQUE(source_id, guid),
    FOREIGN KEY (source_id) REFERENCES news_sources(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_news_published ON news_items(published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_news_source ON news_items(source_id);
  CREATE INDEX IF NOT EXISTS idx_news_hidden ON news_items(hidden);
`);

export default db;

// Helper: hash IP for privacy (no raw IP storage)
import { createHash } from 'node:crypto';
export const hashIp = (ip) => createHash('sha256').update(ip + (process.env.IP_SALT || 'nalarjati-default-salt')).digest('hex').slice(0, 16);
