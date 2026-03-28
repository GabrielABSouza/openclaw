import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db.ts';
import { success, error, print } from '../output.ts';
import { check, required, validPriority, validJsonArray, validJson } from '../validators.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const STATE_PATH = join(__dirname, '..', '.scout-state.json');

interface ScoutState {
  sources: { name: string; url: string; type: string }[];
  current_index: number;
  priority: string;
  stats: { added: number; skipped: number; scored: number; errors: number; sources_checked: number };
  started_at: string;
}

function loadState(): ScoutState | null {
  if (!existsSync(STATE_PATH)) return null;
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
}

function saveState(state: ScoutState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function clearState(): void {
  if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH);
}

export function handleScout(action: string, argv: string[]): void {
  switch (action) {
    case 'start': return scoutStart(argv);
    case 'feed': return scoutFeed(argv);
    case 'score': return scoutScore(argv);
    case 'skip': return scoutSkip();
    case 'status': return scoutStatus();
    case 'reset': return scoutReset();
    default: print(error('scout', 'UNKNOWN_COMMAND', `Unknown action: ${action}. Available: start, feed, score, skip, status, reset`));
  }
}

/**
 * scout start --priority P0
 * Initializes scout run: gets enabled sources with URLs, saves state, returns first source to fetch.
 */
function scoutStart(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { priority: { type: 'string' } },
    strict: false,
  });

  if (values.priority) {
    try { check(validPriority(values.priority)); } catch (e: any) { return print(error('scout start', e.code, e.message)); }
  }

  // Clear any previous state
  clearState();

  const db = getDb();
  let sql = 'SELECT name, url, type FROM sources WHERE enabled = 1 AND url IS NOT NULL';
  const params: any[] = [];
  if (values.priority) { sql += ' AND priority = ?'; params.push(values.priority); }
  sql += ' ORDER BY priority, name';

  const sources = db.prepare(sql).all(...params) as { name: string; url: string; type: string }[];

  if (sources.length === 0) {
    return print(success('scout start', {
      done: true,
      message: 'No enabled sources with URLs found for the given priority.',
      next_action: 'Report to user: no sources to check.',
    }));
  }

  const state: ScoutState = {
    sources,
    current_index: 0,
    priority: values.priority || 'all',
    stats: { added: 0, skipped: 0, scored: 0, errors: 0, sources_checked: 0 },
    started_at: new Date().toISOString(),
  };
  saveState(state);

  const first = sources[0];
  print(success('scout start', {
    done: false,
    total_sources: sources.length,
    current: { index: 0, name: first.name, url: first.url, type: first.type },
    next_action: `Use web_fetch on ${first.url} — then extract items (title + url pairs) and call: claw-kb scout feed --source "${first.name}" --items '[{"title":"...","url":"..."}]'`,
  }));
}

/**
 * scout feed --source "name" --items '[{"title":"...", "url":"..."}]'
 * Receives extracted items from web_fetch. Checks existence, adds new articles. Returns items for scoring.
 */
function scoutFeed(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string' },
      items: { type: 'string' },
    },
    strict: false,
  });

  try {
    check(required(values.source, 'source'));
    check(required(values.items, 'items'));
    check(validJsonArray(values.items!, 'items'));
  } catch (e: any) {
    return print(error('scout feed', e.code, e.message));
  }

  const state = loadState();
  if (!state) return print(error('scout feed', 'NOT_FOUND', 'No active scout run. Call "scout start" first.'));

  const db = getDb();
  const src = db.prepare('SELECT id FROM sources WHERE name = ?').get(values.source) as any;
  if (!src) return print(error('scout feed', 'NOT_FOUND', `Source "${values.source}" not found`));

  const items = JSON.parse(values.items!) as { title: string; url: string }[];
  const newItems: { id: number; title: string; url: string }[] = [];
  let skipped = 0;

  for (const item of items) {
    if (!item.url || !item.title) continue;

    const existing = db.prepare('SELECT id FROM articles WHERE url = ?').get(item.url) as any;
    if (existing) {
      skipped++;
      continue;
    }

    try {
      const info = db.prepare(`
        INSERT INTO articles (source_id, url, title, content_type, category)
        VALUES (?, ?, ?, 'article', 'ai')
      `).run(src.id, item.url, item.title);
      newItems.push({ id: info.lastInsertRowid as number, title: item.title, url: item.url });
    } catch {
      skipped++;
    }
  }

  state.stats.added += newItems.length;
  state.stats.skipped += skipped;
  saveState(state);

  if (newItems.length === 0) {
    // No new items — skip to next source
    return advanceSource(state, `No new articles from "${values.source}" (${skipped} already existed).`);
  }

  // Build scoring instruction
  const itemList = newItems.map(i => `{id:${i.id}, title:"${i.title.substring(0, 60)}"}`).join(', ');

  print(success('scout feed', {
    done: false,
    source: values.source,
    new_articles: newItems.length,
    skipped,
    items_to_score: newItems,
    next_action: `Score these ${newItems.length} articles using the scoring criteria. For each: relevance 0-10, summary (1 sentence), tags (JSON array), status (skipped if 0-4, ingested if 5-6, cataloged if 7+). Then call: claw-kb scout score --items '[{"id":N,"relevance":N,"summary":"...","tags":"[\\"tag1\\"]","status":"..."}]'`,
  }));
}

/**
 * scout score --items '[{"id":N,"relevance":N,"summary":"...","tags":"[...]","status":"..."}]'
 * Updates articles with scores, marks source as checked, advances to next source.
 */
function scoutScore(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { items: { type: 'string' } },
    strict: false,
  });

  try {
    check(required(values.items, 'items'));
    check(validJsonArray(values.items!, 'items'));
  } catch (e: any) {
    return print(error('scout score', e.code, e.message));
  }

  const state = loadState();
  if (!state) return print(error('scout score', 'NOT_FOUND', 'No active scout run. Call "scout start" first.'));

  const db = getDb();
  const items = JSON.parse(values.items!) as {
    id: number; relevance: number; summary?: string; tags?: string;
    status?: string; breakdown?: string;
  }[];

  let scored = 0;
  for (const item of items) {
    const sets: string[] = [];
    const params: any[] = [];

    if (item.relevance !== undefined) { sets.push('relevance = ?'); params.push(item.relevance); }
    if (item.summary) { sets.push('summary = ?'); params.push(item.summary); }
    if (item.tags) { sets.push('tags = ?'); params.push(item.tags); }
    if (item.status) { sets.push('status = ?'); params.push(item.status); }
    if (item.breakdown) { sets.push('relevance_breakdown = ?'); params.push(item.breakdown); }

    if (sets.length > 0) {
      params.push(item.id);
      db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      scored++;
    }
  }

  state.stats.scored += scored;

  // Mark current source as checked
  const currentSource = state.sources[state.current_index];
  if (currentSource) {
    db.prepare("UPDATE sources SET last_checked_at = datetime('now') WHERE name = ?").run(currentSource.name);
    state.stats.sources_checked++;
  }

  saveState(state);
  return advanceSource(state, `Scored ${scored} articles from "${currentSource?.name}".`);
}

/**
 * scout skip — skip current source (e.g. web_fetch failed) and move to next
 */
function scoutSkip(): void {
  const state = loadState();
  if (!state) return print(error('scout skip', 'NOT_FOUND', 'No active scout run.'));

  const currentSource = state.sources[state.current_index];
  state.stats.errors++;
  saveState(state);
  return advanceSource(state, `Skipped "${currentSource?.name}" due to error.`);
}

/**
 * Advance to next source or finish
 */
function advanceSource(state: ScoutState, message: string): void {
  state.current_index++;
  saveState(state);

  if (state.current_index >= state.sources.length) {
    // All done — generate report
    const db = getDb();
    const cataloged = db.prepare(
      "SELECT COUNT(*) as count FROM articles WHERE status = 'cataloged' AND ingested_at >= ?"
    ).get(state.started_at) as any;

    clearState();

    print(success('scout done', {
      done: true,
      message,
      report: {
        sources_checked: state.stats.sources_checked,
        articles_added: state.stats.added,
        articles_skipped: state.stats.skipped,
        articles_scored: state.stats.scored,
        articles_cataloged: cataloged?.count || 0,
        errors: state.stats.errors,
      },
      next_action: 'Report these results to the user. The scout run is complete.',
    }));
    return;
  }

  const next = state.sources[state.current_index];
  print(success('scout next', {
    done: false,
    message,
    remaining: state.sources.length - state.current_index,
    current: { index: state.current_index, name: next.name, url: next.url, type: next.type },
    next_action: `Use web_fetch on ${next.url} — then extract items (title + url pairs) and call: claw-kb scout feed --source "${next.name}" --items '[{"title":"...","url":"..."}]'`,
  }));
}

/**
 * scout status — check current state
 */
function scoutStatus(): void {
  const state = loadState();
  if (!state) return print(success('scout status', { active: false, message: 'No active scout run.' }));

  print(success('scout status', {
    active: true,
    priority: state.priority,
    progress: `${state.current_index}/${state.sources.length}`,
    current_source: state.sources[state.current_index]?.name || 'done',
    stats: state.stats,
    started_at: state.started_at,
  }));
}

/**
 * scout reset — clear state without reporting
 */
function scoutReset(): void {
  clearState();
  print(success('scout reset', { message: 'Scout state cleared.' }));
}
