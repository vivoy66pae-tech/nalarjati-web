import { Router } from 'express';

const router = Router();

// Dynamic SVG OG image — no external deps, no headless browser
router.get('/', (req, res) => {
  const title = (req.query.title || 'nalarjati.dev').toString().slice(0, 100);
  const subtitle = (req.query.subtitle || 'Engineering intelligent systems').toString().slice(0, 120);
  const accent1 = '#8b5cf6';
  const accent2 = '#06b6d4';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0a0f"/>
      <stop offset="1" stop-color="#16161f"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent1}"/>
      <stop offset="1" stop-color="${accent2}"/>
    </linearGradient>
    <radialGradient id="orb" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${accent1}" stop-opacity="0.4"/>
      <stop offset="1" stop-color="${accent1}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="950" cy="120" r="220" fill="url(#orb)"/>
  <g transform="translate(80, 200)">
    <rect width="56" height="56" rx="12" fill="url(#accent)"/>
    <text x="28" y="42" text-anchor="middle" font-family="Inter, sans-serif" font-size="36" font-weight="800" fill="white">n</text>
    <text x="78" y="42" font-family="Inter, sans-serif" font-size="28" font-weight="700" fill="#e8e8f0">nalarjati<tspan fill="#6a6a7a">.dev</tspan></text>
  </g>
  <text x="80" y="370" font-family="Inter, sans-serif" font-size="64" font-weight="700" fill="white" letter-spacing="-1.5">${escapeXml(title)}</text>
  <text x="80" y="430" font-family="Inter, sans-serif" font-size="28" font-weight="400" fill="#a0a0b0">${escapeXml(subtitle)}</text>
  <line x1="80" y1="500" x2="200" y2="500" stroke="url(#accent)" stroke-width="4"/>
  <text x="80" y="560" font-family="Inter, sans-serif" font-size="20" font-weight="500" fill="#6a6a7a">nalarjati.dev</text>
</svg>`;

  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(svg);
});

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default router;
