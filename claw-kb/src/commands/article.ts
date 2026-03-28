import { parseArgs } from 'node:util';
import { getDb } from '../db.ts';
import { success, error, print } from '../output.ts';
import {
  check, required, validContentType, validArticleStatus, validRelevance,
  validJsonArray, validJson, validDate, validCategory,
} from '../validators.ts';

export function handleArticle(action: string, argv: string[]): void {
  switch (action) {
    case 'add': return articleAdd(argv);
    case 'exists': return articleExists(argv);
    case 'update': return articleUpdate(argv);
    case 'list': return articleList(argv);
    case 'search': return articleSearch(argv);
    case 'stats': return articleStats();
    case 'get': return articleGet(argv);
    default: print(error('article', 'UNKNOWN_COMMAND', `Unknown action: ${action}. Available: add, exists, update, list, search, stats, get`));
  }
}

function articleAdd(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: 'string' },
      title: { type: 'string' },
      source: { type: 'string' },
      'content-type': { type: 'string' },
      category: { type: 'string' },
      tags: { type: 'string' },
      'published-at': { type: 'string' },
    },
    strict: false,
  });

  try {
    check(required(values.url, 'url'));
    check(required(values.title, 'title'));
    check(required(values.source, 'source'));
    check(required(values['content-type'], 'content-type'));
    check(validContentType(values['content-type']));
    if (values.category) check(validCategory(values.category));
    if (values.tags) check(validJsonArray(values.tags, 'tags'));
    if (values['published-at']) check(validDate(values['published-at']));
  } catch (e: any) {
    return print(error('article add', e.code, e.message));
  }

  const db = getDb();

  const src = db.prepare('SELECT id FROM sources WHERE name = ?').get(values.source) as any;
  if (!src) return print(error('article add', 'NOT_FOUND', `Source "${values.source}" not found`));

  const existing = db.prepare('SELECT id FROM articles WHERE url = ?').get(values.url);
  if (existing) return print(error('article add', 'DUPLICATE_URL', `Article with URL "${values.url}" already exists`));

  const stmt = db.prepare(`
    INSERT INTO articles (source_id, url, title, content_type, category, tags, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    src.id, values.url, values.title, values['content-type'],
    values.category ?? null, values.tags ?? null, values['published-at'] ?? null,
  );
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(info.lastInsertRowid);
  print(success('article add', row));
}

function articleExists(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { url: { type: 'string' } },
    strict: false,
  });

  try { check(required(values.url, 'url')); } catch (e: any) { return print(error('article exists', e.code, e.message)); }

  const db = getDb();
  const row = db.prepare('SELECT id FROM articles WHERE url = ?').get(values.url) as any;
  print(success('article exists', { exists: !!row, id: row?.id ?? null }));
}

function articleUpdate(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      id: { type: 'string' },
      status: { type: 'string' },
      summary: { type: 'string' },
      'full-summary': { type: 'string' },
      'key-points': { type: 'string' },
      relevance: { type: 'string' },
      'relevance-breakdown': { type: 'string' },
      'has-tool': { type: 'string' },
      'tool-name': { type: 'string' },
      'tool-repo': { type: 'string' },
      category: { type: 'string' },
      tags: { type: 'string' },
    },
    strict: false,
  });

  try {
    check(required(values.id, 'id'));
    if (values.status) check(validArticleStatus(values.status));
    if (values.relevance) check(validRelevance(values.relevance));
    if (values['relevance-breakdown']) check(validJson(values['relevance-breakdown'], 'relevance-breakdown'));
    if (values['key-points']) check(validJsonArray(values['key-points'], 'key-points'));
    if (values.tags) check(validJsonArray(values.tags, 'tags'));
    if (values.category) check(validCategory(values.category));
  } catch (e: any) {
    return print(error('article update', e.code, e.message));
  }

  const db = getDb();
  const id = Number(values.id);
  const existing = db.prepare('SELECT id FROM articles WHERE id = ?').get(id);
  if (!existing) return print(error('article update', 'NOT_FOUND', `Article ${id} not found`));

  const sets: string[] = [];
  const params: any[] = [];
  const fieldMap: Record<string, string> = {
    status: 'status', summary: 'summary', 'full-summary': 'full_summary',
    'key-points': 'key_points', relevance: 'relevance', 'relevance-breakdown': 'relevance_breakdown',
    'has-tool': 'has_tool', 'tool-name': 'tool_name', 'tool-repo': 'tool_repo',
    category: 'category', tags: 'tags',
  };

  for (const [flag, col] of Object.entries(fieldMap)) {
    const val = values[flag as keyof typeof values];
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      params.push(flag === 'has-tool' ? Number(val) : flag === 'relevance' ? Number(val) : val);
    }
  }

  if (sets.length === 0) return print(error('article update', 'MISSING_REQUIRED', 'No fields to update'));

  params.push(id);
  db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
  print(success('article update', row));
}

function articleList(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      status: { type: 'string' },
      category: { type: 'string' },
      since: { type: 'string' },
      'min-relevance': { type: 'string' },
      limit: { type: 'string', default: '20' },
    },
    strict: false,
  });

  const db = getDb();
  let sql = `SELECT id, source_id, url, title, content_type, category, tags, summary,
    relevance, has_tool, tool_name, status, ingested_at, published_at FROM articles WHERE 1=1`;
  const params: any[] = [];

  if (values.status) { sql += ' AND status = ?'; params.push(values.status); }
  if (values.category) { sql += ' AND category = ?'; params.push(values.category); }
  if (values.since) { sql += ' AND ingested_at >= ?'; params.push(values.since); }
  if (values['min-relevance']) { sql += ' AND relevance >= ?'; params.push(Number(values['min-relevance'])); }

  sql += ' ORDER BY ingested_at DESC LIMIT ?';
  params.push(Number(values.limit));

  const rows = db.prepare(sql).all(...params);
  print(success('article list', rows, rows.length));
}

function articleSearch(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { query: { type: 'string' }, limit: { type: 'string', default: '20' } },
    strict: false,
  });

  try { check(required(values.query, 'query')); } catch (e: any) { return print(error('article search', e.code, e.message)); }

  const db = getDb();
  const pattern = `%${values.query}%`;
  const rows = db.prepare(`
    SELECT id, source_id, url, title, content_type, category, summary, relevance, status, ingested_at
    FROM articles WHERE title LIKE ? OR summary LIKE ?
    ORDER BY relevance DESC LIMIT ?
  `).all(pattern, pattern, Number(values.limit));
  print(success('article search', rows, rows.length));
}

function articleStats(): void {
  const db = getDb();
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM articles GROUP BY status').all();
  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM articles WHERE category IS NOT NULL GROUP BY category').all();
  const bySource = db.prepare(`
    SELECT s.name, COUNT(a.id) as count FROM articles a
    JOIN sources s ON a.source_id = s.id GROUP BY s.name ORDER BY count DESC
  `).all();
  const total = (db.prepare('SELECT COUNT(*) as count FROM articles').get() as any).count;

  print(success('article stats', { total, by_status: byStatus, by_category: byCategory, by_source: bySource }));
}

function articleGet(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { id: { type: 'string' } },
    strict: false,
  });

  try { check(required(values.id, 'id')); } catch (e: any) { return print(error('article get', e.code, e.message)); }

  const db = getDb();
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(Number(values.id));
  if (!row) return print(error('article get', 'NOT_FOUND', `Article ${values.id} not found`));
  print(success('article get', row));
}
