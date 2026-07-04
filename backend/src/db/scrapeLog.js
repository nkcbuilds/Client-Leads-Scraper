import { getDb } from './index.js';

export function addScrapeLog({ jobId, url, status, pageType, message, contentLength }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO scrape_log (job_id, url, status, page_type, message, content_length)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(jobId, url, status, pageType || null, message || null, contentLength || null);

  return db.prepare('SELECT * FROM scrape_log WHERE id = ?').get(result.lastInsertRowid);
}

export function getScrapeLogsByJob(jobId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM scrape_log WHERE job_id = ? ORDER BY created_at ASC
  `).all(jobId);
}