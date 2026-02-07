import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "litreview.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Singleton connection
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    _db.pragma("busy_timeout = 5000");
    initSchema(_db);
    runMigrations(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      authors TEXT NOT NULL DEFAULT '[]',
      abstract TEXT NOT NULL DEFAULT '',
      year INTEGER,
      doi TEXT,
      arxiv_id TEXT,
      semantic_scholar_id TEXT,
      openalex_id TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      url TEXT,
      pdf_path TEXT,
      pdf_text TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collection_papers (
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      notes TEXT NOT NULL DEFAULT '',
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (collection_id, paper_id)
    );

    CREATE TABLE IF NOT EXISTS citations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      citing_paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      cited_paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'semantic_scholar',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(citing_paper_id, cited_paper_id)
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'nemotron-30b',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS syntheses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      synthesis TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'nemotron-30b',
      paper_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      category TEXT NOT NULL CHECK(category IN ('finding', 'method', 'gap', 'contribution', 'limitation', 'future_work')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
      target_id INTEGER NOT NULL,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      page INTEGER NOT NULL,
      highlight_text TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'yellow',
      position_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed_paper_id INTEGER REFERENCES papers(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      authors TEXT NOT NULL DEFAULT '[]',
      abstract TEXT NOT NULL DEFAULT '',
      year INTEGER,
      doi TEXT,
      arxiv_id TEXT,
      semantic_scholar_id TEXT,
      url TEXT,
      citation_count INTEGER,
      score REAL,
      source TEXT NOT NULL DEFAULT 'semantic_scholar',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Add relationship_type to citations if not exists
    -- SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS,
    -- so we handle this gracefully

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_annotations_paper ON annotations(paper_id);
    CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi);
    CREATE INDEX IF NOT EXISTS idx_papers_arxiv ON papers(arxiv_id);
    CREATE INDEX IF NOT EXISTS idx_papers_ss ON papers(semantic_scholar_id);
    CREATE INDEX IF NOT EXISTS idx_papers_oa ON papers(openalex_id);
    CREATE INDEX IF NOT EXISTS idx_citations_citing ON citations(citing_paper_id);
    CREATE INDEX IF NOT EXISTS idx_citations_cited ON citations(cited_paper_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_paper ON knowledge(paper_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);
}

function runMigrations(db: Database.Database) {
  // Add relationship_type column to citations if missing
  const citationCols = db.prepare("PRAGMA table_info(citations)").all() as { name: string }[];
  if (!citationCols.find((c) => c.name === "relationship_type")) {
    db.exec("ALTER TABLE citations ADD COLUMN relationship_type TEXT DEFAULT 'mentions'");
  }
  if (!citationCols.find((c) => c.name === "context_text")) {
    db.exec("ALTER TABLE citations ADD COLUMN context_text TEXT");
  }
}

export default getDb;
