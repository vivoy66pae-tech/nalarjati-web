import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { config } from './config.js';

marked.setOptions({ gfm: true, breaks: false });

const blogDir = config.paths.content + 'blog';

function listMarkdown(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => join(dir, f))
      .filter((p) => statSync(p).isFile());
  } catch {
    return [];
  }
}

export function getAllPosts() {
  const files = listMarkdown(blogDir);
  const posts = files.map((file) => {
    const raw = readFileSync(file, 'utf8');
    const { data, content } = matter(raw);
    const slug = data.slug || basename(file, '.md');
    return {
      slug,
      title: data.title || slug,
      date: data.date || '',
      excerpt: data.excerpt || content.slice(0, 160).replace(/\s+/g, ' ').trim(),
      tags: data.tags || [],
      author: data.author || 'nalarjati.dev',
      draft: Boolean(data.draft),
      content,
    };
  });
  return posts
    .filter((p) => !p.draft)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function getPostBySlug(slug) {
  return getAllPosts().find((p) => p.slug === slug) || null;
}

export function renderMarkdown(md) {
  return marked.parse(md);
}
