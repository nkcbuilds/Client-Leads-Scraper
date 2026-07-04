import { getDb } from './index.js';

export function getAllSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function getSetting(key, defaultValue = null) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
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

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw !== undefined && raw !== '') return parseInt(raw, 10);
  return fallback;
}

function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

export function getCrawlSettings() {
  const delayMin = parseInt(
    getSetting('crawl_delay_min_ms', String(envInt('CRAWL_DELAY_MIN_MS', 1500))),
    10,
  );
  const delayMax = parseInt(
    getSetting('crawl_delay_max_ms', String(envInt('CRAWL_DELAY_MAX_MS', 3500))),
    10,
  );
  const legacyDelay = parseInt(getSetting('crawl_delay_ms', String(envInt('CRAWL_DELAY_MS', 2000))), 10);

  return {
    delayMs: legacyDelay,
    delayMinMs: Math.min(delayMin, delayMax),
    delayMaxMs: Math.max(delayMin, delayMax),
    concurrency: parseInt(getSetting('crawl_concurrency', String(envInt('CRAWL_CONCURRENCY', 2))), 10),
    timeoutMs: parseInt(getSetting('crawl_timeout_ms', String(envInt('CRAWL_TIMEOUT_MS', 30000))), 10),
    storageStatePath: getSetting('browser_storage_state_path', '').trim(),
    storageStateDir:
      getSetting('browser_storage_state_dir', process.env.BROWSER_STORAGE_STATE_DIR || './data/browser-sessions').trim(),
    stealthEnabled: getSetting('browser_stealth', String(envBool('BROWSER_STEALTH', true))) !== 'false',
    useSystemChrome: getSetting('browser_use_system_chrome', String(envBool('BROWSER_USE_SYSTEM_CHROME', true))) !== 'false',
    headless: getSetting('browser_headless', String(envBool('BROWSER_HEADLESS', true))) !== 'false',
    warmupEnabled: getSetting('browser_warmup', String(envBool('BROWSER_WARMUP', true))) !== 'false',
    warmupWaitMs: parseInt(
      getSetting('browser_warmup_wait_ms', String(envInt('BROWSER_WARMUP_WAIT_MS', 8000))),
      10,
    ),
  };
}
