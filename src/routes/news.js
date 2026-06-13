import { Router } from 'express';
import { listItems, listSources, getStats, fetchAllSources } from '../rss.js';
import { basicAuth } from '../auth.js';

const router = Router();

// Public: list news items
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  const result = listItems({
    limit,
    offset,
    source: req.query.source,
    category: req.query.category,
    language: req.query.language,
    search: req.query.q,
  });
  res.json(result);
});

// Public: list sources
router.get('/sources', (req, res) => {
  res.json({ sources: listSources() });
});

// Public: stats
router.get('/stats', (req, res) => {
  res.json(getStats());
});

// Admin: trigger refresh
router.post('/refresh', basicAuth, async (req, res) => {
  try {
    const result = await fetchAllSources();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
