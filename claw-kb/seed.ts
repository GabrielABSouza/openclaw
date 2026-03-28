/**
 * Seed: popula fontes iniciais no banco.
 * Personalize o array `sources` abaixo com suas fontes de interesse.
 * Executar: node --experimental-strip-types seed.ts
 */

import { getDb } from './src/db.ts';

const db = getDb();

// Adicione suas fontes aqui. Exemplos:
//
// Tipos suportados: rss, blog, newsletter, youtube
// Prioridades: P0 (diario), P1 (3x/semana), P2 (semanal)
//
// { name: 'anthropic-blog', type: 'blog', url: 'https://www.anthropic.com/news', priority: 'P0', frequency: 'daily' },
// { name: 'openai-blog', type: 'rss', url: 'https://openai.com/blog/rss.xml', priority: 'P0', frequency: 'daily' },
// { name: 'hacker-news', type: 'rss', url: 'https://news.ycombinator.com/rss', priority: 'P1', frequency: '3x-week' },
// { name: 'minha-newsletter', type: 'newsletter', url: null, priority: 'P2', frequency: 'weekly' },

const sources: Array<{ name: string; type: string; url: string | null; priority: string; frequency: string }> = [
  // P0 — daily

  // P1 — 3x-week

  // P2 — weekly
];

if (sources.length === 0) {
  console.log(JSON.stringify({ ok: true, command: 'seed', data: { total: 0, added: 0, message: 'Nenhuma fonte configurada. Edite seed.ts ou use o CLI: claw-kb source add --name "..." --type rss --url "..." --priority P0 --frequency daily' } }));
  process.exit(0);
}

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
