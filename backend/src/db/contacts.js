import { getDb } from './index.js';

export function createContact(contact) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO contacts (
      person_id, email, email_status, email_source, email_pattern,
      phone, phone_source, linkedin_url, linkedin_source,
      company_domain, domain_source, overall_confidence, confidence_label
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    contact.person_id,
    contact.email,
    contact.email_status,
    contact.email_source,
    contact.email_pattern,
    contact.phone,
    contact.phone_source,
    contact.linkedin_url,
    contact.linkedin_source,
    contact.company_domain,
    contact.domain_source,
    contact.overall_confidence,
    contact.confidence_label,
  );

  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
}

export function createContacts(contacts) {
  return contacts.map((c) => createContact(c));
}

export function getContactByPersonId(personId) {
  const db = getDb();
  return db.prepare('SELECT * FROM contacts WHERE person_id = ?').get(personId);
}

export function getContactsByJob(jobId) {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, p.name, p.title, p.company, p.job_id
    FROM contacts c
    JOIN people p ON p.id = c.person_id
    WHERE p.job_id = ?
    ORDER BY c.overall_confidence DESC
  `).all(jobId);
}

export function getEnrichedPeopleByJob(jobId) {
  const db = getDb();
  return db.prepare(`
    SELECT p.*, c.email, c.email_status, c.phone, c.linkedin_url,
           c.company_domain, c.overall_confidence, c.confidence_label
    FROM people p
    LEFT JOIN contacts c ON c.person_id = p.id
    WHERE p.job_id = ?
    ORDER BY c.overall_confidence DESC, p.llm_confidence DESC
  `).all(jobId);
}