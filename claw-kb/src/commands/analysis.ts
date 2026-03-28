import { parseArgs } from 'node:util';
import { getDb } from '../db.ts';
import { success, error, print } from '../output.ts';
import { check, required } from '../validators.ts';

export function handleCrossref(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { 'article-id': { type: 'string' } },
    strict: false,
  });

  try { check(required(values['article-id'], 'article-id')); } catch (e: any) { return print(error('crossref', e.code, e.message)); }

  const db = getDb();
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(Number(values['article-id'])) as any;
  if (!article) return print(error('crossref', 'NOT_FOUND', `Article ${values['article-id']} not found`));

  // Parse article tags
  let articleTags: string[] = [];
  if (article.tags) {
    try { articleTags = JSON.parse(article.tags); } catch { /* empty */ }
  }
  if (article.category) articleTags.push(article.category);

  // Find publications with overlapping topics
  const pubs = db.prepare('SELECT * FROM publications WHERE topics IS NOT NULL').all() as any[];
  const related = pubs.filter(pub => {
    try {
      const topics = JSON.parse(pub.topics) as string[];
      return topics.some(t => articleTags.includes(t));
    } catch { return false; }
  });

  print(success('crossref', { article, related_publications: related }));
}

export function handleGaps(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { days: { type: 'string', default: '30' } },
    strict: false,
  });

  const days = Number(values.days);
  const db = getDb();

  // Get article categories from last N days
  const articles = db.prepare(`
    SELECT category, COUNT(*) as articles_count FROM articles
    WHERE category IS NOT NULL AND ingested_at >= datetime('now', '-' || ? || ' days')
    GROUP BY category
  `).all(days) as any[];

  // Get published topics from last N days
  const pubs = db.prepare(`
    SELECT topics FROM publications
    WHERE topics IS NOT NULL AND published_at >= datetime('now', '-' || ? || ' days')
  `).all(days) as any[];

  const publishedTopics = new Set<string>();
  for (const pub of pubs) {
    try {
      const topics = JSON.parse(pub.topics) as string[];
      topics.forEach(t => publishedTopics.add(t));
    } catch { /* skip */ }
  }

  // Find gaps: categories with articles but no matching publication
  const gaps = articles.map((a: any) => ({
    category: a.category,
    articles_count: a.articles_count,
    has_publication: publishedTopics.has(a.category),
  })).filter(g => !g.has_publication);

  print(success('gaps', gaps, gaps.length));
}

export function handleDigest(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      since: { type: 'string' },
      priority: { type: 'string' },
    },
    strict: false,
  });

  const since = values.since || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const db = getDb();

  let sql = `SELECT a.*, s.priority as source_priority FROM articles a
    JOIN sources s ON a.source_id = s.id WHERE a.ingested_at >= ?`;
  const params: any[] = [since];

  if (values.priority) { sql += ' AND s.priority = ?'; params.push(values.priority); }

  const articles = db.prepare(sql).all(...params) as any[];

  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const a of articles) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    if (a.category) byCategory[a.category] = (byCategory[a.category] || 0) + 1;
  }

  const topArticles = [...articles]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5)
    .map(a => ({ id: a.id, title: a.title, relevance: a.relevance, status: a.status, url: a.url }));

  print(success('digest', {
    period: { since, to: 'now' },
    total: articles.length,
    by_status: byStatus,
    by_category: byCategory,
    top_articles: topArticles,
  }));
}
