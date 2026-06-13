#!/usr/bin/env node
// Standalone script to refresh news feeds. Run by systemd timer.
import 'dotenv/config';
import { fetchAllSources, getStats } from '../src/rss.js';

const start = Date.now();
console.log('[news-refresh] starting', new Date().toISOString());
try {
  const result = await fetchAllSources();
  const ok = result.results.filter((r) => r.ok).length;
  const err = result.results.length - ok;
  const totalItems = result.results.reduce((s, r) => s + (r.count || 0), 0);
  const stats = getStats();
  console.log(`[news-refresh] done in ${Date.now() - start}ms — ${ok} ok, ${err} error, ${totalItems} new/updated items`);
  console.log(`[news-refresh] db state: ${stats.items.total} items, ${stats.sources.enabled}/${stats.sources.total} sources active`);
  if (err > 0) {
    console.warn('[news-refresh] errors:');
    result.results.filter((r) => !r.ok).forEach((r) => console.warn(`  - ${r.source}: ${r.error}`));
  }
} catch (err) {
  console.error('[news-refresh] fatal:', err);
  process.exit(1);
}
