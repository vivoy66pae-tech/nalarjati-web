import { Router } from 'express';

const router = Router();

/**
 * GET /api/news/read?url=...
 * Fetches the original article, extracts main content, returns cleaned text.
 */
router.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; nalarjati-bot/1.0; +https://nalarjati.dev)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return res.status(502).json({ error: `upstream ${resp.status}` });
    }

    const html = await resp.text();
    const content = extractArticle(html);

    res.json({
      url,
      title: extractTitle(html),
      content,
      word_count: content.split(/\s+/).filter(Boolean).length,
    });
  } catch (err) {
    res.status(502).json({ error: err.name === 'AbortError' ? 'timeout' : err.message });
  }
});

/* ===================== EXTRACTION ===================== */

function extractTitle(html) {
  // og:title first, then <title>, then <h1>
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]);
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (t) return decodeEntities(t[1].trim());
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return decodeEntities(stripTags(h1[1]).trim());
  return '';
}

function extractArticle(html) {
  // Step 1: Remove elements we don't want
  let cleaned = html
    // Remove scripts, styles, noscript
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove nav, header, footer, aside, form
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    // Remove common ad/social/sidebar classes
    .replace(/<div[^>]*class=["'][^"']*(?:social|share|related|sidebar|widget|comment|disqus|newsletter|subscribe|popup|modal|overlay|cookie|consent|breadcrumb|pagination|tag-|category-)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    // Remove SVG icons
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    // Remove picture/source (keep img)
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')
    .replace(/<source[^>]*>/gi, '');

  // Step 2: Try to find <article> or <main> or role="article"
  let articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!articleMatch) {
    articleMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  }
  if (!articleMatch) {
    articleMatch = cleaned.match(/<div[^>]*role=["']article["'][^>]*>([\s\S]*?)<\/div>/i);
  }

  let raw = articleMatch ? articleMatch[1] : cleaned;

  // Step 3: If still too big (>100KB), try to find the content div
  // Look for div with "content" or "article" or "post" in class/id
  if (raw.length > 100000) {
    const contentDiv = raw.match(
      /<div[^>]*(?:class|id)=["'][^"']*(?:content|article-body|post-body|entry-content|story-body|article-content|news-content|detail-content|isi-berita|artikel)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    if (contentDiv) raw = contentDiv[1];
  }

  // Step 4: Extract paragraphs
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(raw)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text.length > 30) { // Skip very short paragraphs (likely nav/buttons)
      paragraphs.push(text);
    }
  }

  // Step 5: If we got good paragraphs, return them
  if (paragraphs.length >= 2) {
    return paragraphs.join('\n\n');
  }

  // Step 6: Fallback — strip all tags and clean up
  const fallback = stripTags(raw)
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  // Split into sentences and re-paragraph (every ~3 sentences)
  if (fallback.length > 200) {
    const sentences = fallback.match(/[^.!?]+[.!?]+\s*/g) || [fallback];
    const result = [];
    for (let i = 0; i < sentences.length; i += 3) {
      result.push(sentences.slice(i, i + 3).join('').trim());
    }
    return result.join('\n\n');
  }

  return fallback;
}

/* ===================== UTILS ===================== */

function stripTags(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .trim();
}

export default router;
