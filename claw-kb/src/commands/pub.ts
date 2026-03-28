import { parseArgs } from 'node:util';
import { getDb } from '../db.ts';
import { success, error, print } from '../output.ts';
import { check, required, validPlatform, validDate, validJsonArray } from '../validators.ts';

export function handlePub(action: string, argv: string[]): void {
  switch (action) {
    case 'add': return pubAdd(argv);
    case 'list': return pubList(argv);
    case 'topics': return pubTopics();
    default: print(error('pub', 'UNKNOWN_COMMAND', `Unknown action: ${action}. Available: add, list, topics`));
  }
}

function pubAdd(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      platform: { type: 'string' },
      title: { type: 'string' },
      topics: { type: 'string' },
      'published-at': { type: 'string' },
      url: { type: 'string' },
      'recommendation-id': { type: 'string' },
    },
    strict: false,
  });

  try {
    check(required(values.platform, 'platform'));
    check(required(values.title, 'title'));
    check(required(values.topics, 'topics'));
    check(required(values['published-at'], 'published-at'));
    check(validPlatform(values.platform));
    check(validDate(values['published-at']));
    check(validJsonArray(values.topics, 'topics'));
  } catch (e: any) {
    return print(error('pub add', e.code, e.message));
  }

  const db = getDb();

  if (values['recommendation-id']) {
    const rec = db.prepare('SELECT id FROM recommendations WHERE id = ?').get(Number(values['recommendation-id']));
    if (!rec) return print(error('pub add', 'NOT_FOUND', `Recommendation ${values['recommendation-id']} not found`));
  }

  const stmt = db.prepare(`
    INSERT INTO publications (platform, title, url, topics, published_at, recommendation_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    values.platform, values.title, values.url ?? null,
    values.topics, values['published-at'],
    values['recommendation-id'] ? Number(values['recommendation-id']) : null,
  );
  const row = db.prepare('SELECT * FROM publications WHERE id = ?').get(info.lastInsertRowid);
  print(success('pub add', row));
}

function pubList(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      platform: { type: 'string' },
      since: { type: 'string' },
    },
    strict: false,
  });

  const db = getDb();
  let sql = 'SELECT * FROM publications WHERE 1=1';
  const params: any[] = [];

  if (values.platform) { sql += ' AND platform = ?'; params.push(values.platform); }
  if (values.since) { sql += ' AND published_at >= ?'; params.push(values.since); }

  sql += ' ORDER BY published_at DESC';
  const rows = db.prepare(sql).all(...params);
  print(success('pub list', rows, rows.length));
}

function pubTopics(): void {
  const db = getDb();
  const rows = db.prepare('SELECT topics FROM publications WHERE topics IS NOT NULL').all() as any[];

  const counts: Record<string, number> = {};
  for (const row of rows) {
    try {
      const topics = JSON.parse(row.topics) as string[];
      for (const t of topics) {
        counts[t] = (counts[t] || 0) + 1;
      }
    } catch { /* skip malformed */ }
  }

  const result = Object.entries(counts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  print(success('pub topics', result, result.length));
}
