import { getDb } from './index.js';

export function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function getSetting(key, defaultValue = null) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, String(value));
  return { key, value: String(value) };
}

export function setSettings(updates) {
  const results = {};
  for (const [key, value] of Object.entries(updates)) {
    results[key] = setSetting(key, value);
  }
  return results;
}

export function getCrawlSettings() {
  return {
    delayMs: parseInt(getSetting('crawl_delay_ms', '2000'), 10),
    concurrency: parseInt(getSetting('crawl_concurrency', '2'), 10),
    timeoutMs: parseInt(getSetting('crawl_timeout_ms', '30000'), 10),
    storageStatePath: getSetting('browser_storage_state_path', '').trim(),
  };
}
