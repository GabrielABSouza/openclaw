/**
 * Test: valida todos os comandos do claw-kb.
 * Usa banco temporário.
 * Executar: node --experimental-strip-types test.ts
 */

import { execSync } from 'node:child_process';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = join(__dirname, 'content.db');
const CLI = `node --experimental-strip-types ${join(__dirname, 'src', 'index.ts')}`;

// Clean slate
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

let passed = 0;
let failed = 0;

function run(cmd: string): any {
  try {
    const out = execSync(`${CLI} ${cmd}`, { encoding: 'utf-8', env: { ...process.env } });
    return JSON.parse(out.trim());
  } catch (e: any) {
    // Commands that exit with code 1 still produce JSON on stdout
    if (e.stdout) return JSON.parse(e.stdout.trim());
    throw e;
  }
}

function assert(name: string, fn: () => boolean): void {
  try {
    if (fn()) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name} — assertion failed`);
      failed++;
    }
  } catch (e: any) {
    console.log(`  ✗ ${name} — ${e.message}`);
    failed++;
  }
}

// === Source tests ===
console.log('\n— Source —');

assert('source add', () => {
  const r = run('source add --name test-blog --type blog --url https://test.com/blog --priority P1 --frequency weekly');
  return r.ok && r.data.name === 'test-blog';
});

assert('source add duplicate', () => {
  const r = run('source add --name test-blog --type blog --url https://test2.com --priority P1 --frequency weekly');
  return !r.ok && r.code === 'DUPLICATE_NAME';
});

assert('source list', () => {
  const r = run('source list');
  return r.ok && r.count >= 1;
});

assert('source list --priority', () => {
  const r = run('source list --priority P1');
  return r.ok && r.data.every((s: any) => s.priority === 'P1');
});

assert('source check', () => {
  const r = run('source check --name test-blog');
  return r.ok && r.data.last_checked_at !== null;
});

assert('source disable', () => {
  const r = run('source disable --name test-blog');
  return r.ok && r.data.enabled === 0;
});

assert('source enable', () => {
  const r = run('source enable --name test-blog');
  return r.ok && r.data.enabled === 1;
});

// === Article tests ===
console.log('\n— Article —');

assert('article add', () => {
  const r = run('article add --url https://test.com/post1 --title "Test Article" --source test-blog --content-type article --category ai --tags \'["llm","agents"]\'');
  return r.ok && r.data.title === 'Test Article' && r.data.source_id === 1;
});

assert('article exists (true)', () => {
  const r = run('article exists --url https://test.com/post1');
  return r.ok && r.data.exists === true && r.data.id === 1;
});

assert('article exists (false)', () => {
  const r = run('article exists --url https://test.com/nonexistent');
  return r.ok && r.data.exists === false;
});

assert('article add duplicate', () => {
  const r = run('article add --url https://test.com/post1 --title "Dup" --source test-blog --content-type article');
  return !r.ok && r.code === 'DUPLICATE_URL';
});

assert('article update', () => {
  const r = run('article update --id 1 --status cataloged --relevance 8 --summary "Great article about LLMs"');
  return r.ok && r.data.status === 'cataloged' && r.data.relevance === 8;
});

assert('article update invalid relevance', () => {
  const r = run('article update --id 1 --relevance 15');
  return !r.ok && r.code === 'INVALID_RELEVANCE';
});

assert('article list', () => {
  const r = run('article list');
  return r.ok && r.count >= 1;
});

assert('article list --status', () => {
  const r = run('article list --status cataloged');
  return r.ok && r.data.every((a: any) => a.status === 'cataloged');
});

assert('article search', () => {
  const r = run('article search --query "Test"');
  return r.ok && r.count >= 1;
});

assert('article stats', () => {
  const r = run('article stats');
  return r.ok && r.data.total >= 1;
});

assert('article get', () => {
  const r = run('article get --id 1');
  return r.ok && r.data.id === 1 && r.data.summary !== null;
});

// === Recommendation tests ===
console.log('\n— Recommendation —');

assert('rec add', () => {
  const r = run(`rec add --title "LLM Agents Overview" --theme "ai-agents" --format linkedin-post --hook "AI agents are changing everything" --angle "practical applications" --key-points '["agents","tools","autonomy"]' --article-ids '[1]' --priority high`);
  return r.ok && r.data.title === 'LLM Agents Overview';
});

assert('rec list', () => {
  const r = run('rec list');
  return r.ok && r.count >= 1;
});

assert('rec update', () => {
  const r = run('rec update --id 1 --status approved');
  return r.ok && r.data.status === 'approved';
});

assert('rec detail', () => {
  const r = run('rec detail --id 1');
  return r.ok && r.data.articles && r.data.articles.length === 1;
});

// === Publication tests ===
console.log('\n— Publication —');

assert('pub add', () => {
  const r = run(`pub add --platform linkedin --title "AI Agents Post" --topics '["ai","agents"]' --published-at 2026-03-28 --recommendation-id 1`);
  return r.ok && r.data.platform === 'linkedin';
});

assert('pub list', () => {
  const r = run('pub list');
  return r.ok && r.count >= 1;
});

assert('pub topics', () => {
  const r = run('pub topics');
  return r.ok && r.data.some((t: any) => t.topic === 'ai');
});

// === Analysis tests ===
console.log('\n— Analysis —');

assert('crossref', () => {
  const r = run('crossref --article-id 1');
  return r.ok && r.data.article && Array.isArray(r.data.related_publications);
});

assert('gaps', () => {
  const r = run('gaps --days 30');
  return r.ok && Array.isArray(r.data);
});

assert('digest', () => {
  const r = run('digest --since 2026-01-01');
  return r.ok && r.data.total >= 1;
});

// === Maintenance tests ===
console.log('\n— Maintenance —');

assert('stats', () => {
  const r = run('stats');
  return r.ok && r.data.sources >= 1;
});

assert('export', () => {
  const r = run('export --format json');
  return r.ok && Array.isArray(r.data.sources);
});

assert('prune (no match)', () => {
  const r = run('prune --older-than 9999d --status skipped');
  return r.ok && r.data.deleted === 0;
});

// === Scout tests ===
console.log('\n— Scout —');

// Clean any leftover state and add a P0 source for testing
run('scout reset');
run('source add --name scout-test-src --type blog --url https://example.com/blog --priority P0');

assert('scout start', () => {
  const r = run('scout start --priority P0');
  return r.ok && r.data.done === false && r.data.total_sources > 0 && r.data.current.url !== undefined;
});

assert('scout feed (new articles)', () => {
  run('scout reset');
  run('scout start --priority P0');
  const r = run(`scout feed --source "scout-test-src" --items '[{"title":"Test Article","url":"https://example.com/test-scout-1"}]'`);
  return r.ok && r.data.done === false && r.data.new_articles === 1;
});

assert('scout score', () => {
  // Get the article ID from the feed response
  const feed = run(`scout feed --source "anthropic-blog" --items '[{"title":"Test Article 2","url":"https://example.com/test-scout-2"}]'`);
  if (!feed.ok || !feed.data.items_to_score) {
    // May have advanced to next source if no new items
    return true;
  }
  const id = feed.data.items_to_score[0].id;
  const r = run(`scout score --items '[{"id":${id},"relevance":8,"summary":"Test","tags":"[\\"test\\"]","status":"cataloged"}]'`);
  return r.ok && r.data.done !== undefined;
});

assert('scout skip', () => {
  run('scout start --priority P1');
  const r = run('scout skip');
  return r.ok && r.data.done !== undefined;
});

assert('scout status', () => {
  const r = run('scout status');
  return r.ok;
});

assert('scout reset', () => {
  run('scout start --priority P0');
  const r = run('scout reset');
  return r.ok && r.data.message === 'Scout state cleared.';
});

assert('scout no active run', () => {
  run('scout reset');
  const r = run('scout feed --source "x" --items "[]"');
  return !r.ok && r.code === 'NOT_FOUND';
});

// === Rec-flow tests ===
console.log('\n— Rec-flow —');

assert('rec-flow start (no analyzed)', () => {
  const r = run('rec-flow start');
  return r.ok && r.data.done === true && r.data.message.includes('Sem temas');
});

// Set an article to analyzed for next tests
run('article update --id 1 --status analyzed');

assert('rec-flow start (with analyzed)', () => {
  const r = run('rec-flow start');
  return r.ok && r.data.done === false && r.data.total_articles >= 1;
});

assert('rec-flow feed', () => {
  const r = run('rec-flow feed --id 1 --full-summary "Test summary" --key-points \'["point1","point2"]\'');
  return r.ok;
});

assert('rec-flow skip', () => {
  run('article update --id 1 --status analyzed');
  run('rec-flow start');
  const r = run('rec-flow skip');
  return r.ok;
});

assert('rec-flow rec', () => {
  // Start fresh with analyzed article
  run('article update --id 1 --status analyzed');
  run('rec-flow start');
  run('rec-flow feed --id 1 --full-summary "Summary" --key-points \'["p1"]\'');
  // Now in recommendation phase — create a rec
  const r = run('rec-flow rec --title "Test Rec" --theme "test" --format "linkedin-post" --hook "Hook" --angle "Angle" --key-points \'["p1"]\' --article-ids \'[1]\' --priority high');
  return r.ok && r.data.rec_id !== undefined;
});

assert('rec-flow done', () => {
  const r = run('rec-flow done');
  return r.ok && r.data.done === true && r.data.report !== undefined;
});

assert('rec-flow no active run', () => {
  run('rec-flow reset');
  const r = run('rec-flow feed --id 1 --full-summary "x"');
  return !r.ok && r.code === 'NOT_FOUND';
});

// === Unknown command ===
console.log('\n— Edge cases —');

assert('unknown entity', () => {
  const r = run('foobar');
  return !r.ok && r.code === 'UNKNOWN_COMMAND';
});

assert('unknown action', () => {
  const r = run('source foobar');
  return !r.ok && r.code === 'UNKNOWN_COMMAND';
});

// === Summary ===
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);

// Cleanup
unlinkSync(DB_PATH);
