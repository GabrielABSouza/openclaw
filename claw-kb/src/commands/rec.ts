import { parseArgs } from 'node:util';
import { getDb } from '../db.ts';
import { success, error, print } from '../output.ts';
import { check, required, validRecFormat, validRecStatus, validRecPriority, validJsonArray } from '../validators.ts';

export function handleRec(action: string, argv: string[]): void {
  switch (action) {
    case 'add': return recAdd(argv);
    case 'list': return recList(argv);
    case 'update': return recUpdate(argv);
    case 'detail': return recDetail(argv);
    default: print(error('rec', 'UNKNOWN_COMMAND', `Unknown action: ${action}. Available: add, list, update, detail`));
  }
}

function recAdd(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      title: { type: 'string' },
      theme: { type: 'string' },
      format: { type: 'string' },
      hook: { type: 'string' },
      angle: { type: 'string' },
      'key-points': { type: 'string' },
      'article-ids': { type: 'string' },
      quotes: { type: 'string' },
      priority: { type: 'string', default: 'medium' },
      'related-projects': { type: 'string' },
      'cross-ref': { type: 'string' },
      'target-audience': { type: 'string' },
    },
    strict: false,
  });

  try {
    check(required(values.title, 'title'));
    check(required(values.theme, 'theme'));
    check(required(values.format, 'format'));
    check(required(values.hook, 'hook'));
    check(required(values.angle, 'angle'));
    check(required(values['key-points'], 'key-points'));
    check(required(values['article-ids'], 'article-ids'));
    check(validRecFormat(values.format));
    check(validRecPriority(values.priority));
    check(validJsonArray(values['key-points'], 'key-points'));
    check(validJsonArray(values['article-ids'], 'article-ids'));
    if (values.quotes) check(validJsonArray(values.quotes, 'quotes'));
    if (values['related-projects']) check(validJsonArray(values['related-projects'], 'related-projects'));
  } catch (e: any) {
    return print(error('rec add', e.code, e.message));
  }

  const db = getDb();

  // Verify article IDs exist
  const articleIds = JSON.parse(values['article-ids']!) as number[];
  for (const aid of articleIds) {
    const exists = db.prepare('SELECT id FROM articles WHERE id = ?').get(aid);
    if (!exists) return print(error('rec add', 'NOT_FOUND', `Article ${aid} not found`));
  }

  const stmt = db.prepare(`
    INSERT INTO recommendations (article_ids, theme, title, format, hook, angle, key_points, quotes, target_audience, related_projects, cross_ref, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    values['article-ids'], values.theme, values.title, values.format,
    values.hook, values.angle, values['key-points'],
    values.quotes ?? null, values['target-audience'] ?? null,
    values['related-projects'] ?? null, values['cross-ref'] ?? null,
    values.priority,
  );
  const row = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(info.lastInsertRowid);
  print(success('rec add', row));
}

function recList(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      status: { type: 'string' },
      priority: { type: 'string' },
      since: { type: 'string' },
    },
    strict: false,
  });

  const db = getDb();
  let sql = 'SELECT id, title, theme, format, priority, status, created_at FROM recommendations WHERE 1=1';
  const params: any[] = [];

  if (values.status) { sql += ' AND status = ?'; params.push(values.status); }
  if (values.priority) { sql += ' AND priority = ?'; params.push(values.priority); }
  if (values.since) { sql += ' AND created_at >= ?'; params.push(values.since); }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  print(success('rec list', rows, rows.length));
}

function recUpdate(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      id: { type: 'string' },
      status: { type: 'string' },
    },
    strict: false,
  });

  try {
    check(required(values.id, 'id'));
    check(required(values.status, 'status'));
    check(validRecStatus(values.status));
  } catch (e: any) {
    return print(error('rec update', e.code, e.message));
  }

  const db = getDb();
  const id = Number(values.id);
  const info = db.prepare('UPDATE recommendations SET status = ? WHERE id = ?').run(values.status, id);
  if (info.changes === 0) return print(error('rec update', 'NOT_FOUND', `Recommendation ${id} not found`));

  const row = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(id);
  print(success('rec update', row));
}

function recDetail(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { id: { type: 'string' } },
    strict: false,
  });

  try { check(required(values.id, 'id')); } catch (e: any) { return print(error('rec detail', e.code, e.message)); }

  const db = getDb();
  const rec = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(Number(values.id)) as any;
  if (!rec) return print(error('rec detail', 'NOT_FOUND', `Recommendation ${values.id} not found`));

  // Expand articles
  const articleIds = JSON.parse(rec.article_ids) as number[];
  const articles = articleIds
    .map(id => db.prepare('SELECT * FROM articles WHERE id = ?').get(id))
    .filter(Boolean);

  print(success('rec detail', { ...rec, articles }));
}
