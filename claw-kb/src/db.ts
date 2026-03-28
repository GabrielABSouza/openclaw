import Database from 'better-sqlite3';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DB_PATH = join(__dirname, '..', 'content.db');

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('rss','blog','youtube','newsletter')),
  url TEXT,
  priority TEXT NOT NULL DEFAULT 'P1' CHECK(priority IN ('P0','P1','P2')),
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency IN ('daily','3x-week','weekly')),
  enabled INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK(content_type IN ('article','video','paper','post','newsletter-issue')),
  category TEXT,
  tags TEXT,
  summary TEXT,
  full_summary TEXT,
  key_points TEXT,
  relevance INTEGER DEFAULT 0,
  relevance_breakdown TEXT,
  has_tool INTEGER NOT NULL DEFAULT 0,
  tool_name TEXT,
  tool_repo TEXT,
  status TEXT NOT NULL DEFAULT 'ingested' CHECK(status IN ('ingested','cataloged','analyzed','recommended','used','skipped')),
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_ids TEXT NOT NULL,
  theme TEXT NOT NULL,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('linkedin-post','twitter-thread','article','newsletter','video-short')),
  hook TEXT NOT NULL,
  angle TEXT NOT NULL,
  key_points TEXT NOT NULL,
  quotes TEXT,
  target_audience TEXT,
  related_projects TEXT,
  cross_ref TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high','medium','low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','published','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL CHECK(platform IN ('linkedin','twitter','newsletter','blog','youtube')),
  title TEXT NOT NULL,
  url TEXT,
  topics TEXT,
  published_at TEXT NOT NULL,
  recommendation_id INTEGER REFERENCES recommendations(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_relevance ON articles(relevance);
CREATE INDEX IF NOT EXISTS idx_articles_ingested ON articles(ingested_at);
CREATE INDEX IF NOT EXISTS idx_recs_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_pubs_platform ON publications(platform);
`;

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number;

  if (version < 1) {
    db.exec(SCHEMA_V1);
    db.pragma('user_version = 1');
  }
}
