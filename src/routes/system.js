import { Router } from 'express';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, '..', '..', 'scripts', 'system_info.py');
const PYTHON = process.env.SYSTEM_PYTHON || '/usr/bin/python3';
const CACHE_MS = 1500;        // cache to keep it cheap; frontend polls every 3s
const TIMEOUT_MS = 4000;      // hard ceiling for the python spawn

const cache = { ts: 0, data: null };
const router = Router();

function fetchStats() {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON,
      [SCRIPT],
      { timeout: TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(err.message + (stderr ? ` :: ${stderr.toString()}` : '')));
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error('bad json from python: ' + e.message));
        }
      }
    );
  });
}

router.get('/', async (req, res) => {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_MS) {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ...cache.data, cached: true, cache_age_ms: now - cache.ts });
  }
  try {
    const data = await fetchStats();
    cache.ts = now;
    cache.data = data;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...data, cached: false });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
