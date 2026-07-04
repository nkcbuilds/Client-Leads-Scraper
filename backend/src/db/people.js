import { getDb } from './index.js';

export function createPerson(jobId, person) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO people (
      job_id, name, first_name, last_name, title, company, company_domain,
      source_site, source_url, award_name, award_year, bio, raw_snippet, llm_confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    person.name,
    person.first_name,
    person.last_name,
    person.title,
    person.company,
    person.company_domain,
    person.source_site,
    person.source_url,
    person.award_name,
    person.award_year,
    person.bio,
    person.raw_snippet,
    person.llm_confidence,
  );

  return db.prepare('SELECT * FROM people WHERE id = ?').get(result.lastInsertRowid);
}

export function createPeople(jobId, people) {
  const created = [];
  for (const person of people) {
    created.push(createPerson(jobId, person));
  }
  return created;
}

export function getPeopleByJob(jobId) {
  const db = getDb();
  return db.prepare('SELECT * FROM people WHERE job_id = ? ORDER BY llm_confidence DESC').all(jobId);
}

export function getAllPeople({ jobId, minConfidence } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM people WHERE 1=1';
  const params = [];

  if (jobId) {
    sql += ' AND job_id = ?';
    params.push(jobId);
  }
  if (minConfidence !== undefined) {
    sql += ' AND llm_confidence >= ?';
    params.push(minConfidence);
  }

  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params);
}

export function countPeopleByJob(jobId) {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM people WHERE job_id = ?').get(jobId);
  return row.count;
}