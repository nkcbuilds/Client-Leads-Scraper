export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  label TEXT,
  input_mode TEXT NOT NULL DEFAULT 'live',
  manual_text TEXT,
  manual_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  pages_scraped INTEGER NOT NULL DEFAULT 0,
  records_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  company TEXT,
  company_domain TEXT,
  source_site TEXT,
  source_url TEXT,
  award_name TEXT,
  award_year TEXT,
  bio TEXT,
  raw_snippet TEXT,
  llm_confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  email TEXT,
  email_status TEXT,
  email_source TEXT,
  email_pattern TEXT,
  phone TEXT,
  phone_source TEXT,
  linkedin_url TEXT,
  linkedin_source TEXT,
  company_domain TEXT,
  domain_source TEXT,
  overall_confidence REAL,
  confidence_label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scrape_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  page_type TEXT,
  message TEXT,
  content_length INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_people_job_id ON people(job_id);
CREATE INDEX IF NOT EXISTS idx_contacts_person_id ON contacts(person_id);
CREATE INDEX IF NOT EXISTS idx_scrape_log_job_id ON scrape_log(job_id);
`;

export const DEFAULT_SETTINGS = {
  crawl_delay_ms: '2000',
  crawl_concurrency: '2',
  crawl_timeout_ms: '30000',
  gemini_api_key: '',
  browser_storage_state_path: '',
  output_path: './output',
};
