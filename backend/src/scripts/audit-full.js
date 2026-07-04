import '../utils/env.js';
import { initDb, closeDb, getDb } from '../db/index.js';
import { createJob, getJobById } from '../db/jobs.js';
import { getEnrichedPeopleByJob } from '../db/contacts.js';
import { getScrapeLogsByJob } from '../db/scrapeLog.js';
import { closeBrowser } from '../crawler/browser.js';
import { enqueueJob } from '../queue/jobQueue.js';
import { buildJobSummary } from '../utils/jobSummary.js';
import { isGeminiConfigured } from '../llm/gemini.js';
import { exportToCsv } from '../exporters/csv.js';
import { logger } from '../utils/logger.js';

const TEST_SITES = [
  { url: 'https://www.lw.com/en/people', label: 'Audit: Latham directory', type: 'profile_directory', minRecords: 5 },
  { url: 'https://www.davispolk.com/en/people', label: 'Audit: Davis Polk directory', type: 'profile_directory', minRecords: 3 },
  { url: 'https://chambers.com/legal-guide/europe-2025', label: 'Audit: Chambers guide', type: 'list_page', minRecords: 0 },
  { url: 'https://example.com', label: 'Audit: Example.com edge', type: 'edge', minRecords: 0 },
];

const findings = [];
const passes = [];

function finding(severity, area, message, detail = null) {
  findings.push({ severity, area, message, detail });
}

function pass(area, message) {
  passes.push({ area, message });
}

async function waitForJob(jobId, maxWait = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const job = getJobById(jobId);
    if (!['pending', 'running'].includes(job.status)) return job;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Job ${jobId} timed out`);
}

async function auditDatabase() {
  const db = getDb();
  const tables = ['jobs', 'people', 'contacts', 'scrape_log', 'settings'];
  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
    pass('database', `Table ${table} accessible (${row.c} rows)`);
  }

  const orphanContacts = db.prepare(`
    SELECT COUNT(*) as c FROM contacts c
    LEFT JOIN people p ON p.id = c.person_id WHERE p.id IS NULL
  `).get();
  if (orphanContacts.c > 0) {
    finding('HIGH', 'database', `${orphanContacts.c} orphan contact records without people`);
  } else {
    pass('database', 'No orphan contacts');
  }
}

async function auditApiLocal(baseUrl = 'http://localhost:3001') {
  const endpoints = [
    '/api/health',
    '/api/jobs',
    '/api/settings',
    '/api/people',
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`);
      if (!res.ok) {
        finding('HIGH', 'api', `${ep} returned ${res.status}`);
      } else {
        pass('api', `${ep} → ${res.status}`);
      }
    } catch (err) {
      finding('MEDIUM', 'api', `${ep} unreachable (server may be off)`, err.message);
    }
  }
}

async function runLiveJob(site) {
  console.log(`\n--- Live scrape: ${site.url} ---`);
  const job = createJob({ url: site.url, label: site.label });
  const t0 = Date.now();

  await enqueueJob(job);
  const completed = await waitForJob(job.id);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const people = getEnrichedPeopleByJob(job.id);
  const logs = getScrapeLogsByJob(job.id);
  const summary = buildJobSummary(completed, logs);

  console.log(`  Status: ${completed.status} | Records: ${people.length} | Pages: ${completed.pages_scraped} | ${elapsed}s`);

  if (!['done', 'done_with_warnings', 'blocked', 'failed'].includes(completed.status)) {
    finding('HIGH', 'pipeline', `Unexpected status "${completed.status}" for ${site.url}`);
  }

  if (site.minRecords > 0 && people.length < site.minRecords) {
    finding('HIGH', 'extraction', `Expected >=${site.minRecords} records from ${site.url}, got ${people.length}`, summary.issues);
  } else if (site.minRecords > 0) {
    pass('extraction', `${site.url}: ${people.length} records (>=${site.minRecords})`);
  }

  const noEmail = people.filter((p) => !p.email);
  const noDomain = people.filter((p) => !p.company_domain);
  const guessed = people.filter((p) => p.email_status === 'guessed');
  const noLabel = people.filter((p) => !p.confidence_label);

  if (people.length > 0) {
    if (noEmail.length > people.length * 0.5) {
      finding('MEDIUM', 'enrichment', `${noEmail.length}/${people.length} records missing email on ${site.url}`);
    }
    if (noDomain.length > 0) {
      finding('LOW', 'enrichment', `${noDomain.length}/${people.length} records missing domain on ${site.url}`);
    }
    if (guessed.length > 0) {
      finding('INFO', 'enrichment', `${guessed.length} guessed emails on ${site.url} (mark clearly in exports)`);
    }
    if (noLabel.length > 0) {
      finding('HIGH', 'enrichment', `${noLabel.length} records missing confidence_label`);
    }

    const invalidNames = people.filter((p) => !p.name || p.name.length < 2);
    if (invalidNames.length > 0) {
      finding('HIGH', 'data-quality', `${invalidNames.length} records with invalid names`);
    }

    const noTitleOrCompany = people.filter((p) => !p.title && !p.company);
    if (noTitleOrCompany.length > 0) {
      finding('MEDIUM', 'data-quality', `${noTitleOrCompany.length} records missing both title and company`);
    }

    try {
      exportToCsv(people);
      pass('export', `CSV generation OK for job ${job.id}`);
    } catch (err) {
      finding('HIGH', 'export', `CSV failed for job ${job.id}`, err.message);
    }
  }

  const blocked = logs.filter((l) => l.status === 'blocked');
  if (blocked.length > 0) {
    finding('MEDIUM', 'crawler', `${blocked.length} blocked page(s) on ${site.url}`, blocked.map((b) => b.url));
  }

  const skippedProfiles = summary.issues?.some((issue) => issue.includes('Skipped') && issue.includes('profile'));
  if (site.type === 'profile_directory' && completed.pages_scraped <= 1 && people.length > 0 && !skippedProfiles) {
    finding('MEDIUM', 'crawler', `Profile directory ${site.url} only scraped 1 page but found ${people.length} records — profile pages not followed`);
  }

  if (completed.status === 'failed') {
    finding('HIGH', 'pipeline', `Job failed for ${site.url}`, completed.error_message);
  }

  return { job: completed, people, summary, logs };
}

async function main() {
  console.log('\n========================================');
  console.log('  LegalReach FULL AUDIT');
  console.log('========================================\n');

  initDb();

  if (!isGeminiConfigured()) {
    finding('CRITICAL', 'config', 'GEMINI_API_KEY not configured — extraction will use weak fallback');
  } else {
    pass('config', `Gemini configured (model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`);
  }

  await auditDatabase();
  await auditApiLocal();

  const results = [];
  for (const site of TEST_SITES) {
    try {
      const result = await runLiveJob(site);
      results.push({ site, ...result });
    } catch (err) {
      finding('CRITICAL', 'pipeline', `Live job crashed for ${site.url}`, err.message);
    }
  }

  await closeBrowser();
  closeDb();

  console.log('\n========================================');
  console.log('  AUDIT REPORT');
  console.log('========================================\n');

  console.log(`PASSES: ${passes.length}`);
  passes.forEach((p) => console.log(`  [OK] ${p.area}: ${p.message}`));

  console.log(`\nFINDINGS: ${findings.length}`);
  const bySeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  for (const sev of bySeverity) {
    const items = findings.filter((f) => f.severity === sev);
    if (items.length === 0) continue;
    console.log(`\n  ${sev} (${items.length}):`);
    items.forEach((f) => {
      console.log(`    [${f.area}] ${f.message}`);
      if (f.detail) console.log(`      → ${typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)}`);
    });
  }

  const critical = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH').length;
  console.log(`\n========================================`);
  console.log(critical > 0 ? `  AUDIT COMPLETE — ${critical} critical/high issues` : '  AUDIT COMPLETE — no critical issues');
  console.log('========================================\n');

  process.exit(critical > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Audit crashed:', err);
  await closeBrowser().catch(() => {});
  closeDb();
  process.exit(1);
});
