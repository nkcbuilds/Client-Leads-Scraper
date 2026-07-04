import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { SCHEMA_SQL, DEFAULT_SETTINGS } from './schema.js';
import { logger } from '../utils/logger.js';

const DB_PATH = process.env.DB_PATH || './data/legalreach.db';

let db = null;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  runMigrations();

  seedDefaultSettings();
  logger.info('Database initialized', { path: DB_PATH });
  return db;
}

function hasColumn(table, column) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some((entry) => entry.name === column);
}

function runMigrations() {
  const migrations = [
    {
      table: 'jobs',
      column: 'input_mode',
      sql: `ALTER TABLE jobs ADD COLUMN input_mode TEXT NOT NULL DEFAULT 'live'`,
    },
    {
      table: 'jobs',
      column: 'manual_text',
      sql: `ALTER TABLE jobs ADD COLUMN manual_text TEXT`,
    },
    {
      table: 'jobs',
      column: 'manual_html',
      sql: `ALTER TABLE jobs ADD COLUMN manual_html TEXT`,
    },
  ];

  for (const migration of migrations) {
    if (!hasColumn(migration.table, migration.column)) {
      db.exec(migration.sql);
    }
  }
}

function seedDefaultSettings() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  const seed = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      insert.run(key, value);
    }
  });

  seed();
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
