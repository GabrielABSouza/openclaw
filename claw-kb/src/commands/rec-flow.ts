import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db.ts';
import { success, error, print } from '../output.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const STATE_PATH = join(__dirname, '..', '.rec-flow-state.json');

interface RecFlowState {
  articles: { id: number; url: string; title: string; source_name: string; tags: string | null }[];
  current_index: number;
  stats: { read: number; skipped: number; recs_created: number };
  started_at: string;
}

function loadState(): RecFlowState | null {
  if (!existsSync(STATE_PATH)) return null;
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
}

function saveState(state: RecFlowState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function clearState(): void {
  if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH);
}

export function handleRecFlow(action: string, argv: string[]): void {
  switch (action) {
    case 'start': return recFlowStart(argv);
    case 'feed': return recFlowFeed(argv);
    case 'skip': return recFlowSkip();
    case 'rec': return recFlowRec(argv);
    case 'done': return recFlowDone();
    case 'status': return recFlowStatus();
    case 'reset': return recFlowReset();
    default: print(error('rec-flow', 'UNKNOWN_COMMAND', `Unknown action: ${action}. Available: start, feed, skip, rec, done, status, reset`));
  }
}

/**
 * rec-flow start [--limit N]
 * Lists analyzed articles and returns first one to web_fetch.
 */
function recFlowStart(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: { limit: { type: 'string', default: '10' } },
    strict: false,
  });

  clearState();

  const db = getDb();
  const articles = db.prepare(`
    SELECT a.id, a.url, a.title, a.tags, s.name as source_name
    FROM articles a JOIN sources s ON a.source_id = s.id
    WHERE a.status = 'analyzed'
    ORDER BY a.relevance DESC
    LIMIT ?
  `).all(Number(values.limit)) as RecFlowState['articles'];

  if (articles.length === 0) {
    return print(success('rec-flow start', {
      done: true,
      message: 'Sem temas selecionados pelo advisor.',
      next_action: 'Informar ao usuario: sem artigos analisados para recomendar.',
    }));
  }

  const state: RecFlowState = {
    articles,
    current_index: 0,
    stats: { read: 0, skipped: 0, recs_created: 0 },
    started_at: new Date().toISOString(),
  };
  saveState(state);

  const first = articles[0];
  print(success('rec-flow start', {
    done: false,
    total_articles: articles.length,
    current: { index: 0, id: first.id, url: first.url, title: first.title, source: first.source_name },
    next_action: `Use web_fetch on ${first.url} — read the full article, then extract: full summary, key points (JSON array), quotes with data, tools/repos mentioned. Call: claw-kb rec-flow feed --id ${first.id} --full-summary "..." --key-points '[...]' --quotes '[...]'`,
  }));
}

/**
 * rec-flow feed --id N --full-summary "..." --key-points '[...]' [--quotes '[...]'] [--has-tool 1 --tool-name "..." --tool-repo "..."]
 * Saves article reading data and advances to next article or recommendation phase.
 */
function recFlowFeed(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      id: { type: 'string' },
      'full-summary': { type: 'string' },
      'key-points': { type: 'string' },
      quotes: { type: 'string' },
      'has-tool': { type: 'string' },
      'tool-name': { type: 'string' },
      'tool-repo': { type: 'string' },
    },
    strict: false,
  });

  if (!values.id || !values['full-summary']) {
    return print(error('rec-flow feed', 'MISSING_REQUIRED', 'id and full-summary are required'));
  }

  const state = loadState();
  if (!state) return print(error('rec-flow feed', 'NOT_FOUND', 'No active rec-flow. Call "rec-flow start" first.'));

  const db = getDb();
  const id = Number(values.id);

  // Update article
  const sets = ['status = ?', 'full_summary = ?'];
  const params: any[] = ['recommended', values['full-summary']];

  if (values['key-points']) { sets.push('key_points = ?'); params.push(values['key-points']); }
  if (values['has-tool']) {
    sets.push('has_tool = ?');
    params.push(Number(values['has-tool']));
    if (values['tool-name']) { sets.push('tool_name = ?'); params.push(values['tool-name']); }
    if (values['tool-repo']) { sets.push('tool_repo = ?'); params.push(values['tool-repo']); }
  }

  params.push(id);
  db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  state.stats.read++;
  state.current_index++;
  saveState(state);

  return advanceArticle(state, `Article ${id} processed.`);
}

/**
 * rec-flow skip — skip current article (web_fetch failed)
 */
function recFlowSkip(): void {
  const state = loadState();
  if (!state) return print(error('rec-flow skip', 'NOT_FOUND', 'No active rec-flow.'));

  state.stats.skipped++;
  state.current_index++;
  saveState(state);

  return advanceArticle(state, `Skipped article (web_fetch failed).`);
}

/**
 * Advance to next article or enter recommendation phase
 */
function advanceArticle(state: RecFlowState, message: string): void {
  if (state.current_index >= state.articles.length) {
    // All articles read — enter recommendation phase
    const db = getDb();
    const readArticles = db.prepare(`
      SELECT id, title, tags, full_summary, key_points, has_tool, tool_name
      FROM articles WHERE status = 'recommended' AND full_summary IS NOT NULL
      ORDER BY relevance DESC
    `).all() as any[];

    saveState(state);

    print(success('rec-flow articles-done', {
      done: false,
      message,
      phase: 'recommendation',
      articles_read: readArticles.map(a => ({
        id: a.id,
        title: a.title,
        tags: a.tags,
        summary_preview: (a.full_summary || '').substring(0, 100),
        has_tool: a.has_tool,
      })),
      next_action: `All articles read (${state.stats.read} read, ${state.stats.skipped} skipped). Now group by theme and generate recommendations. For each theme, call: claw-kb rec-flow rec --title "..." --theme "..." --format "..." --hook "..." --angle "..." --key-points '[...]' --quotes '[...]' --article-ids '[...]' --priority "..."`,
    }));
    return;
  }

  const next = state.articles[state.current_index];
  saveState(state);

  print(success('rec-flow next', {
    done: false,
    message,
    remaining: state.articles.length - state.current_index,
    current: { index: state.current_index, id: next.id, url: next.url, title: next.title, source: next.source_name },
    next_action: `Use web_fetch on ${next.url} — read the full article, extract: full summary, key points, quotes, tools. Call: claw-kb rec-flow feed --id ${next.id} --full-summary "..." --key-points '[...]' --quotes '[...]'`,
  }));
}

/**
 * rec-flow rec — save a recommendation
 */
function recFlowRec(argv: string[]): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      title: { type: 'string' },
      theme: { type: 'string' },
      format: { type: 'string' },
      hook: { type: 'string' },
      angle: { type: 'string' },
      'key-points': { type: 'string' },
      quotes: { type: 'string' },
      'article-ids': { type: 'string' },
      priority: { type: 'string', default: 'medium' },
      'related-projects': { type: 'string' },
      'cross-ref': { type: 'string' },
    },
    strict: false,
  });

  for (const field of ['title', 'theme', 'format', 'hook', 'angle', 'key-points', 'article-ids']) {
    if (!values[field as keyof typeof values]) {
      return print(error('rec-flow rec', 'MISSING_REQUIRED', `${field} is required`));
    }
  }

  const state = loadState();
  if (!state) return print(error('rec-flow rec', 'NOT_FOUND', 'No active rec-flow.'));

  const db = getDb();
  const info = db.prepare(`
    INSERT INTO recommendations (title, theme, format, hook, angle, key_points, quotes, article_ids, priority, related_projects, cross_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    values.title, values.theme, values.format, values.hook, values.angle,
    values['key-points'], values.quotes || null, values['article-ids'],
    values.priority, values['related-projects'] || null, values['cross-ref'] || null,
  );

  state.stats.recs_created++;
  saveState(state);

  // Check if we should finish (max 3 recs)
  if (state.stats.recs_created >= 3) {
    return finishRecFlow(state, `Recommendation "${values.title}" saved. Maximum 3 reached.`);
  }

  print(success('rec-flow rec', {
    done: false,
    message: `Recommendation "${values.title}" saved (${state.stats.recs_created}/3).`,
    rec_id: info.lastInsertRowid,
    next_action: `Continue grouping themes and generating recommendations (${3 - state.stats.recs_created} remaining). Call rec-flow rec for next theme, or call: claw-kb rec-flow done`,
  }));
}

/**
 * Finish the rec-flow and generate report
 */
function finishRecFlow(state: RecFlowState, message: string): void {
  const db = getDb();
  const recs = db.prepare(`
    SELECT id, title, format, priority, theme
    FROM recommendations
    WHERE created_at >= ?
    ORDER BY id
  `).all(state.started_at) as any[];

  clearState();

  print(success('rec-flow done', {
    done: true,
    message,
    report: {
      articles_read: state.stats.read,
      articles_skipped: state.stats.skipped,
      recommendations_created: state.stats.recs_created,
      recommendations: recs.map(r => ({
        id: r.id,
        title: r.title,
        format: r.format,
        priority: r.priority,
        theme: r.theme,
      })),
    },
    next_action: 'Send recommendations to user in Telegram format, then generate NotebookLM text if applicable.',
  }));
}

function recFlowDone(): void {
  const state = loadState();
  if (!state) return print(error('rec-flow done', 'NOT_FOUND', 'No active rec-flow.'));
  return finishRecFlow(state, 'Rec-flow finished by user.');
}

function recFlowStatus(): void {
  const state = loadState();
  if (!state) return print(success('rec-flow status', { active: false, message: 'No active rec-flow.' }));

  print(success('rec-flow status', {
    active: true,
    progress: `${state.current_index}/${state.articles.length}`,
    current_article: state.articles[state.current_index]?.title || 'recommendation phase',
    stats: state.stats,
  }));
}

function recFlowReset(): void {
  clearState();
  print(success('rec-flow reset', { message: 'Rec-flow state cleared.' }));
}
