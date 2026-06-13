import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { config } from '../config.js';

const router = Router();
const dataFile = config.paths.content + 'portfolio.json';

function load() {
  try {
    return JSON.parse(readFileSync(dataFile, 'utf8'));
  } catch {
    return [];
  }
}

router.get('/', (req, res) => {
  res.json({ projects: load() });
});

router.get('/:slug', (req, res) => {
  const p = load().find((x) => x.slug === req.params.slug);
  if (!p) return res.status(404).json({ error: 'not found' });
  res.json(p);
});

export default router;
