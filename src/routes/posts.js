import { Router } from 'express';
import { getAllPosts, getPostBySlug, renderMarkdown } from '../markdown.js';

const router = Router();

router.get('/', (req, res) => {
  const posts = getAllPosts().map(({ content, ...rest }) => rest);
  res.json({ posts });
});

router.get('/:slug', (req, res) => {
  const post = getPostBySlug(req.params.slug);
  if (!post) return res.status(404).json({ error: 'not found' });
  res.json({
    ...post,
    html: renderMarkdown(post.content),
  });
});

export default router;
