// RSS aggregator: fetch from multiple feeds, parse, dedupe, store in SQLite
import { readFileSync } from 'node:fs';
import db from './db.js';
import { config } from './config.js';

const SOURCES_FILE = config.paths.data + 'news_sources.json';
const FETCH_TIMEOUT_MS = 15000;
const MAX_ITEMS_PER_FEED = 25;

let sources = null;
function loadSources() {
  if (sources) return sources;
  try {
    sources = JSON.parse(readFileSync(SOURCES_FILE, 'utf8'));
  } catch (err) {
    console.error(`[news] failed to read sources: ${err.message}`);
    sources = [];
  }
  return sources;
}

// Sync sources from JSON file into DB (idempotent)
export function syncSources() {
  const list = loadSources();
  const upsert = db.prepare(`
    INSERT INTO news_sources (slug, name, url, category, language, enabled)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(slug) DO UPDATE SET
      name=excluded.name, url=excluded.url, category=excluded.category, language=excluded.language
  `);
  for (const s of list) {
    upsert.run(s.slug, s.name, s.url, s.category, s.language || 'id');
  }
  // Disable sources that were removed from JSON
  const slugs = list.map((s) => s.slug);
  if (slugs.length) {
    db.prepare(`UPDATE news_sources SET enabled = 0 WHERE slug NOT IN (${slugs.map(() => '?').join(',')})`).run(...slugs);
  }
}

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripCdata(s) {
  // Strip CDATA wrappers FIRST (before HTML tag stripping, since the CDATA opener looks like a tag)
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripHtml(html) {
  if (!html) return '';
  return decodeEntities(stripCdata(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractImage(item) {
  // Try multiple RSS image patterns
  if (item.enclosure?.['@_url'] || item.enclosure?.url) {
    return item.enclosure['@_url'] || item.enclosure.url;
  }
  if (item['media:content']?.['@_url'] || item['media:content']?.[0]?.['@_url']) {
    return item['media:content']['@_url'] || item['media:content'][0]['@_url'];
  }
  if (item['media:thumbnail']?.['@_url'] || item['media:thumbnail']?.[0]?.['@_url']) {
    return item['media:thumbnail']['@_url'] || item['media:thumbnail'][0]['@_url'];
  }
  // Try parsing from content HTML
  const content = item['content:encoded'] || item['content'] || item.description || '';
  const m = String(content).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'nalarjati-news-aggregator/1.0 (+https://nalarjati.dev)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

// Minimal RSS/Atom parser — handles the common fields we need without a heavy dep
function parseFeed(xml) {
  // RSS 2.0
  const channelMatch = xml.match(/<channel[\s>]([\s\S]*?)<\/channel>/i);
  if (channelMatch) {
    const channel = channelMatch[1];
    const items = [];
    const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRe.exec(channel)) !== null) {
      const raw = m[1];
      const get = (tag) => {
        const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(raw);
        return r ? stripHtml(r[1]) : '';
      };
      const guid = get('guid') || get('link') || get('title');
      const link = get('link');
      if (!guid || !link) continue;
      items.push({
        guid,
        title: get('title'),
        link,
        summary: (get('description') || '').slice(0, 500),
        author: get('author') || get('dc:creator'),
        published_at: get('pubDate') ? new Date(get('pubDate')).toISOString() : null,
        image_url: extractImage({ 'content:encoded': raw, description: raw }),
      });
      if (items.length >= MAX_ITEMS_PER_FEED) break;
    }
    return { kind: 'rss', items };
  }
  // Atom
  const feedMatch = xml.match(/<feed[\s>]([\s\S]*?)<\/feed>/i);
  if (feedMatch) {
    const items = [];
    const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    let m;
    while ((m = entryRe.exec(feedMatch[1])) !== null) {
      const raw = m[1];
      const get = (tag) => {
        const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(raw);
        return r ? stripHtml(r[1]) : '';
      };
      // Atom <link href="..."/>
      const linkMatch = /<link[^>]+href=["']([^"']+)["']/i.exec(raw);
      const link = linkMatch ? linkMatch[1] : '';
      const guid = get('id') || link;
      if (!guid || !link) continue;
      items.push({
        guid,
        title: get('title'),
        link,
        summary: (get('summary') || get('content') || '').slice(0, 500),
        author: get('author').replace(/.*<name>(.*)<\/name>.*/i, '$1') || '',
        published_at: get('published') || get('updated') ? new Date(get('published') || get('updated')).toISOString() : null,
        image_url: null,
      });
      if (items.length >= MAX_ITEMS_PER_FEED) break;
    }
    return { kind: 'atom', items };
  }
  return { kind: 'unknown', items: [] };
}

async function fetchOneSource(source) {
  try {
    const xml = await fetchWithTimeout(source.url);
    const parsed = parseFeed(xml);
    const insert = db.prepare(`
      INSERT INTO news_items (source_id, guid, title, link, summary, author, image_url, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, guid) DO UPDATE SET
        title=excluded.title, link=excluded.link, summary=excluded.summary,
        author=excluded.author, image_url=excluded.image_url, published_at=excluded.published_at
    `);
    let inserted = 0;
    let skipped = 0;
    for (const it of parsed.items) {
      if (!it.title || !it.link) { skipped++; continue; }
      try {
        const info = insert.run(source.id, it.guid.slice(0, 500), it.title.slice(0, 500), it.link.slice(0, 1000),
          it.summary || null, it.author || null, it.image_url, it.published_at);
        if (info.changes > 0) {
          inserted++;
        } else {
          // ON CONFLICT happened, no actual row inserted/updated
          if (process.env.DEBUG_NEWS) console.log(`[news] dup: ${source.slug} ${it.guid.slice(0, 40)}`);
        }
      } catch (err) {
        console.warn(`[news] insert failed for ${source.slug}: ${err.message}`, { guid: it.guid, title: it.title?.slice(0, 50) });
      }
    }
    db.prepare('UPDATE news_sources SET last_fetched_at = datetime(\'now\'), last_status = ?, last_error = NULL WHERE id = ?')
      .run(`ok:${parsed.items.length}:ins:${inserted}:sk:${skipped}`, source.id);
    return { source: source.slug, ok: true, count: inserted };
  } catch (err) {
    db.prepare('UPDATE news_sources SET last_fetched_at = datetime(\'now\'), last_status = ?, last_error = ? WHERE id = ?')
      .run('error', err.message.slice(0, 200), source.id);
    return { source: source.slug, ok: false, error: err.message };
  }
}

export async function fetchAllSources() {
  syncSources();
  const sources = db.prepare('SELECT * FROM news_sources WHERE enabled = 1').all();
  const results = [];
  // Sequential with small concurrency to be polite
  for (const source of sources) {
    const r = await fetchOneSource(source);
    results.push(r);
  }
  // Trim: keep only the most recent N items per source (avoids blowing up the DB and removes stale dupes)
  // Keep more for low-frequency sources (blogs), less for high-frequency ones (news wires)
  const KEEP_PER_SOURCE = 100;
  db.prepare(`
    DELETE FROM news_items WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY COALESCE(published_at, fetched_at) DESC) AS rn
        FROM news_items WHERE pinned = 0
      ) WHERE rn > ?
    )
  `).run(KEEP_PER_SOURCE);
  return { fetched: results.length, results, sources_total: sources.length };
}

export function listItems({ limit = 50, offset = 0, source, category, language, search } = {}) {
  const where = ['n.hidden = 0'];
  const params = [];
  if (source) { where.push('s.slug = ?'); params.push(source); }
  if (category) { where.push('s.category = ?'); params.push(category); }
  if (language) { where.push('s.language = ?'); params.push(language); }
  if (search) { where.push('(n.title LIKE ? OR n.summary LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

  const rows = db.prepare(`
    SELECT n.id, n.title, n.link, n.summary, n.author, n.image_url, n.published_at, n.fetched_at,
           s.slug AS source_slug, s.name AS source_name, s.category AS source_category, s.language AS source_language
    FROM news_items n
    JOIN news_sources s ON s.id = n.source_id
    WHERE ${where.join(' AND ')}
    ORDER BY n.published_at DESC NULLS LAST, n.fetched_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const countRow = db.prepare(`
    SELECT COUNT(*) AS total FROM news_items n JOIN news_sources s ON s.id = n.source_id
    WHERE ${where.join(' AND ')}
  `).get(...params);

  return { items: rows, total: countRow.total, limit, offset };
}

export function listSources() {
  syncSources();
  return db.prepare(`
    SELECT s.id, s.slug, s.name, s.url, s.category, s.language, s.enabled, s.last_fetched_at, s.last_status, s.last_error,
      (SELECT COUNT(*) FROM news_items WHERE source_id = s.id) AS item_count
    FROM news_sources s
    ORDER BY s.category, s.name
  `).all();
}

export function getStats() {
  return {
    sources: db.prepare('SELECT COUNT(*) AS total, SUM(enabled) AS enabled FROM news_sources').get(),
    items: db.prepare('SELECT COUNT(*) AS total, MAX(fetched_at) AS last_fetch FROM news_items').get(),
  };
}
