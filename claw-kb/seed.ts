/**
 * Seed: popula as 18 fontes iniciais definidas no plano.
 * Executar: node --experimental-strip-types seed.ts
 */

import { getDb } from './src/db.ts';

const db = getDb();

const sources = [
  // P0 — daily
  { name: 'anthropic-blog', type: 'blog', url: 'https://www.anthropic.com/news', priority: 'P0', frequency: 'daily' },
  { name: 'openai-blog', type: 'rss', url: 'https://openai.com/blog/rss.xml', priority: 'P0', frequency: 'daily' },
  { name: 'google-ai-blog', type: 'rss', url: 'https://blog.google/technology/ai/rss/', priority: 'P0', frequency: 'daily' },
  { name: 'huggingface-blog', type: 'blog', url: 'https://huggingface.co/blog', priority: 'P0', frequency: 'daily' },
  { name: 'techcrunch-ai', type: 'rss', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', priority: 'P0', frequency: 'daily' },

  // P1 — 3x-week
  { name: 'microsoft-ai-blog', type: 'blog', url: 'https://news.microsoft.com/source/topics/ai/', priority: 'P1', frequency: '3x-week' },
  { name: 'meta-ai-blog', type: 'blog', url: 'https://ai.meta.com/blog/', priority: 'P1', frequency: '3x-week' },
  { name: 'deepmind-blog', type: 'blog', url: 'https://deepmind.google/discover/blog/', priority: 'P1', frequency: '3x-week' },
  { name: 'mit-tech-review', type: 'rss', url: 'https://www.technologyreview.com/feed/', priority: 'P1', frequency: '3x-week' },
  { name: 'simon-willison', type: 'rss', url: 'https://simonwillison.net/atom/everything/', priority: 'P1', frequency: '3x-week' },

  // P2 — weekly
  { name: 'ai-news-newsletter', type: 'newsletter', url: null, priority: 'P2', frequency: 'weekly' },
  { name: 'the-batch-deeplearning', type: 'newsletter', url: 'https://www.deeplearning.ai/the-batch/', priority: 'P2', frequency: 'weekly' },
  { name: 'import-ai', type: 'rss', url: 'https://importai.substack.com/feed', priority: 'P2', frequency: 'weekly' },
  { name: 'ben-bens-bites', type: 'blog', url: 'https://bensbites.com/', priority: 'P2', frequency: 'weekly' },
  { name: 'towards-data-science', type: 'rss', url: 'https://towardsdatascience.com/feed', priority: 'P2', frequency: 'weekly' },
  { name: 'arxiv-cs-ai', type: 'rss', url: 'https://rss.arxiv.org/rss/cs.AI', priority: 'P2', frequency: 'weekly' },
];

const stmt = db.prepare(`
  INSERT OR IGNORE INTO sources (name, type, url, priority, frequency)
  VALUES (?, ?, ?, ?, ?)
`);

const insertAll = db.transaction(() => {
  let added = 0;
  for (const s of sources) {
    const info = stmt.run(s.name, s.type, s.url, s.priority, s.frequency);
    if (info.changes > 0) added++;
  }
  return added;
});

const added = insertAll();
console.log(JSON.stringify({ ok: true, command: 'seed', data: { total: sources.length, added } }));
