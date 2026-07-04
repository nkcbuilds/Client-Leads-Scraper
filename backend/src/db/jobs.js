import { getDb } from './index.js';

export function createJob({ url, label, input_mode = 'live', manual_text = null, manual_html = null }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO jobs (url, label, input_mode, manual_text, manual_html, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `);
  const result = stmt.run(url, label || null, input_mode, manual_text, manual_html);
  return getJobById(result.lastInsertRowid);
}

export function getJobById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
}

export function getAllJobs() {
  const db = getDb();
  return db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
}

export function updateJobStatus(id, status, extra = {}) {
  const db = getDb();
  const fields = ['status = ?', "updated_at = datetime('now')"];
  const values = [status];

  if (extra.pages_scraped !== undefined) {
    fields.push('pages_scraped = ?');
    values.push(extra.pages_scraped);
  }
  if (extra.records_found !== undefined) {
    fields.push('records_found = ?');
    values.push(extra.records_found);
  }
  if (extra.error_message !== undefined) {
    fields.push('error_message = ?');
    values.push(extra.error_message);
  }
  if (status === 'done' || status === 'done_with_warnings' || status === 'failed' || status === 'blocked') {
    fields.push("completed_at = datetime('now')");
  }

  values.push(id);
  db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getJobById(id);
}

export function incrementJobPages(id) {
  const db = getDb();
  db.prepare(`
    UPDATE jobs
    SET pages_scraped = pages_scraped + 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
  return getJobById(id);
}
