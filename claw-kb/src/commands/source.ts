import { parseArgs } from 'node:util';
import { getDb } from '../db.ts';
import { success, error, print } from '../output.ts';
import { check, required, validPriority, validSourceType, validFrequency } from '../validators.ts';

export function handleSource(action: string, argv: string[]): void {
  switch (action) {
    case 'add': return sourceAdd(argv);
    case 'list': return sourceList(argv);
    case 'check': return sourceCheck(argv);
    case 'disable': return sourceToggle(argv, 0);
    case 'enable': return sourceToggle(argv, 1);
    default: print(error('source', 'UNKNOWN_COMMAND', `Unknown action: ${action}. Available: add, list, check, disable, enable`));
  }
}

function sourceAdd(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      name: { type: 'string' },
      type: { type: 'string' },
      url: { type: 'string' },
      priority: { type: 'string', default: 'P1' },
      frequency: { type: 'string', default: 'weekly' },
    },
    strict: false,
  });

  try {
    check(required(values.name, 'name'));
    check(required(values.type, 'type'));
    check(validSourceType(values.type));
    check(validPriority(values.priority));
    check(validFrequency(values.frequency));
  } catch (e: any) {
    return print(error('source add', e.code, e.message));
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM sources WHERE name = ?').get(values.name);
  if (existing) return print(error('source add', 'DUPLICATE_NAME', `Source "${values.name}" already exists`));

  const stmt = db.prepare(`
    INSERT INTO sources (name, type, url, priority, frequency)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(values.name, values.type, values.url ?? null, values.priority, values.frequency);
  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(info.lastInsertRowid);
  print(success('source add', row));
}

function sourceList(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      priority: { type: 'string' },
      enabled: { type: 'string' },
    },
    strict: false,
  });

  const db = getDb();
  let sql = 'SELECT * FROM sources WHERE 1=1';
  const params: any[] = [];

  if (values.priority) { sql += ' AND priority = ?'; params.push(values.priority); }
  if (values.enabled !== undefined) { sql += ' AND enabled = ?'; params.push(Number(values.enabled)); }

  sql += ' ORDER BY priority, name';
  const rows = db.prepare(sql).all(...params);
  print(success('source list', rows, rows.length));
}

function sourceCheck(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { name: { type: 'string' } },
    strict: false,
  });

  try { check(required(values.name, 'name')); } catch (e: any) { return print(error('source check', e.code, e.message)); }

  const db = getDb();
  const info = db.prepare("UPDATE sources SET last_checked_at = datetime('now') WHERE name = ?").run(values.name);
  if (info.changes === 0) return print(error('source check', 'NOT_FOUND', `Source "${values.name}" not found`));

  const row = db.prepare('SELECT name, last_checked_at FROM sources WHERE name = ?').get(values.name);
  print(success('source check', row));
}

function sourceToggle(argv: string[], enabled: number): void {
  const action = enabled ? 'enable' : 'disable';
  const { values } = parseArgs({
    args: argv,
    options: { name: { type: 'string' } },
    strict: false,
  });

  try { check(required(values.name, 'name')); } catch (e: any) { return print(error(`source ${action}`, e.code, e.message)); }

  const db = getDb();
  const info = db.prepare('UPDATE sources SET enabled = ? WHERE name = ?').run(enabled, values.name);
  if (info.changes === 0) return print(error(`source ${action}`, 'NOT_FOUND', `Source "${values.name}" not found`));

  const row = db.prepare('SELECT name, enabled FROM sources WHERE name = ?').get(values.name);
  print(success(`source ${action}`, row));
}
