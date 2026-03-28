import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { getDb } from '../db.ts';
import { success, error, print } from '../output.ts';
import { check, required, validArticleStatus } from '../validators.ts';

export function handleStats(): void {
  const db = getDb();
  const sources = (db.prepare('SELECT COUNT(*) as count FROM sources').get() as any).count;
  const articlesTotal = (db.prepare('SELECT COUNT(*) as count FROM articles').get() as any).count;
  const articlesByStatus = db.prepare('SELECT status, COUNT(*) as count FROM articles GROUP BY status').all();
  const recsPending = (db.prepare("SELECT COUNT(*) as count FROM recommendations WHERE status = 'pending'").get() as any).count;
  const recsTotal = (db.prepare('SELECT COUNT(*) as count FROM recommendations').get() as any).count;
  const publications = (db.prepare('SELECT COUNT(*) as count FROM publications').get() as any).count;
  const lastCheck = db.prepare('SELECT MAX(last_checked_at) as last FROM sources').get() as any;

  print(success('stats', {
    sources,
    articles: { total: articlesTotal, by_status: articlesByStatus },
    recommendations: { total: recsTotal, pending: recsPending },
    publications,
    last_source_check: lastCheck?.last ?? null,
  }));
}

export function handlePrune(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      'older-than': { type: 'string' },
      status: { type: 'string' },
    },
    strict: false,
  });

  try {
    check(required(values['older-than'], 'older-than'));
    check(required(values.status, 'status'));
    check(validArticleStatus(values.status));
  } catch (e: any) {
    return print(error('prune', e.code, e.message));
  }

  // Parse duration like "90d" → 90 days
  const match = values['older-than']!.match(/^(\d+)d$/);
  if (!match) return print(error('prune', 'INVALID_DATE', 'older-than must be in format Nd (e.g., 90d)'));

  const days = Number(match[1]);
  const db = getDb();
  const info = db.prepare(`
    DELETE FROM articles WHERE status = ? AND ingested_at < datetime('now', '-' || ? || ' days')
  `).run(values.status, days);

  print(success('prune', { deleted: info.changes }));
}

export function handleExport(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { format: { type: 'string', default: 'json' } },
    strict: false,
  });

  if (values.format !== 'json') return print(error('export', 'INVALID_FORMAT', 'Only json format is supported'));

  const db = getDb();
  const data = {
    exported_at: new Date().toISOString(),
    sources: db.prepare('SELECT * FROM sources').all(),
    articles: db.prepare('SELECT * FROM articles').all(),
    recommendations: db.prepare('SELECT * FROM recommendations').all(),
    publications: db.prepare('SELECT * FROM publications').all(),
  };

  print(success('export', data));
}

export function handleImport(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { file: { type: 'string' } },
    strict: false,
  });

  try { check(required(values.file, 'file')); } catch (e: any) { return print(error('import', e.code, e.message)); }

  let data: any;
  try {
    data = JSON.parse(readFileSync(values.file!, 'utf-8'));
  } catch (e: any) {
    return print(error('import', 'INVALID_JSON', `Failed to read/parse file: ${e.message}`));
  }

  const db = getDb();
  const counts = { sources: 0, articles: 0, recommendations: 0, publications: 0, skipped: 0 };

  const importAll = db.transaction(() => {
    if (data.sources) {
      const stmt = db.prepare('INSERT OR IGNORE INTO sources (name, type, url, priority, frequency, enabled) VALUES (?, ?, ?, ?, ?, ?)');
      for (const s of data.sources) {
        const info = stmt.run(s.name, s.type, s.url, s.priority, s.frequency, s.enabled ?? 1);
        if (info.changes > 0) counts.sources++; else counts.skipped++;
      }
    }

    if (data.articles) {
      const stmt = db.prepare('INSERT OR IGNORE INTO articles (source_id, url, title, content_type, category, tags, summary, full_summary, key_points, relevance, relevance_breakdown, has_tool, tool_name, tool_repo, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const a of data.articles) {
        const info = stmt.run(a.source_id, a.url, a.title, a.content_type, a.category, a.tags, a.summary, a.full_summary, a.key_points, a.relevance, a.relevance_breakdown, a.has_tool, a.tool_name, a.tool_repo, a.status, a.published_at);
        if (info.changes > 0) counts.articles++; else counts.skipped++;
      }
    }

    if (data.recommendations) {
      const stmt = db.prepare('INSERT INTO recommendations (article_ids, theme, title, format, hook, angle, key_points, quotes, target_audience, related_projects, cross_ref, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const r of data.recommendations) {
        stmt.run(r.article_ids, r.theme, r.title, r.format, r.hook, r.angle, r.key_points, r.quotes, r.target_audience, r.related_projects, r.cross_ref, r.priority, r.status);
        counts.recommendations++;
      }
    }

    if (data.publications) {
      const stmt = db.prepare('INSERT INTO publications (platform, title, url, topics, published_at, recommendation_id) VALUES (?, ?, ?, ?, ?, ?)');
      for (const p of data.publications) {
        stmt.run(p.platform, p.title, p.url, p.topics, p.published_at, p.recommendation_id);
        counts.publications++;
      }
    }
  });

  try {
    importAll();
    print(success('import', { imported: counts }));
  } catch (e: any) {
    print(error('import', 'DB_ERROR', e.message));
  }
}
