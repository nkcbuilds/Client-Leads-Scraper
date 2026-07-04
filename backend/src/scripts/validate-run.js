import '../utils/env.js';
import { initDb, closeDb } from '../db/index.js';
import { createJob, getJobById } from '../db/jobs.js';
import { getEnrichedPeopleByJob } from '../db/contacts.js';
import { getScrapeLogsByJob } from '../db/scrapeLog.js';
import { closeBrowser } from '../crawler/browser.js';
import { enqueueJob } from '../queue/jobQueue.js';
import { isGeminiConfigured } from '../llm/gemini.js';
import { logger } from '../utils/logger.js';

const TEST_URL = process.argv[2] || 'https://www.lw.com/en/people';

async function waitForJob(jobId, maxWait = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const job = getJobById(jobId);
    if (!['pending', 'running'].includes(job.status)) return job;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Job ${jobId} timed out after ${maxWait}ms`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  PASS: ${message}`);
}

async function main() {
  console.log('\n=== LegalReach Validation Run ===\n');

  initDb();

  assert(isGeminiConfigured(), 'Gemini API key is configured');
  assert(!!process.env.GEMINI_MODEL || true, `Gemini model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash (default)'}`);

  console.log(`\nTest URL: ${TEST_URL}\n`);

  const job = createJob({ url: TEST_URL, label: 'Validation run' });
  console.log(`Created job #${job.id}`);

  await enqueueJob(job);
  const completed = await waitForJob(job.id);
  const logs = getScrapeLogsByJob(job.id);
  const people = getEnrichedPeopleByJob(job.id);

  console.log('\n--- Job Result ---');
  console.log(JSON.stringify(completed, null, 2));

  console.log('\n--- Scrape Logs ---');
  console.log(`  ${logs.length} log entries`);
  logs.forEach((l) => console.log(`  [${l.status}] ${l.page_type || '-'} — ${l.message}`));

  console.log('\n--- Extracted People ---');
  console.log(`  ${people.length} records`);
  people.slice(0, 5).forEach((p) => {
    console.log(`  • ${p.name} | ${p.title || '-'} | ${p.company || '-'} | conf=${p.llm_confidence}`);
  });
  if (people.length > 5) console.log(`  ... and ${people.length - 5} more`);

  console.log('\n--- Assertions ---');

  assert(
    ['done', 'done_with_warnings'].includes(completed.status),
    `Job finished with status "${completed.status}"`,
  );
  assert(completed.pages_scraped >= 1, `Scraped at least 1 page (got ${completed.pages_scraped})`);
  assert(logs.some((l) => l.status === 'success'), 'At least one successful page scrape');
  assert(logs.some((l) => l.status === 'classified'), 'Page was classified');
  assert(people.length >= 1, `Extracted at least 1 person (got ${people.length})`);

  const withName = people.filter((p) => p.name && p.name.length > 2);
  assert(withName.length === people.length, 'All records have valid names');

  const withTitleOrCompany = people.filter((p) => p.title || p.company);
  assert(withTitleOrCompany.length >= 1, 'At least one record has title or company');

  const avgConf = people.reduce((s, p) => s + (p.llm_confidence || 0), 0) / people.length;
  assert(avgConf >= 0.3, `Average confidence >= 0.3 (got ${avgConf.toFixed(2)})`);

  const withDomain = people.filter((p) => p.company_domain);
  console.log(`  INFO: Company domains found: ${withDomain.length}/${people.length}`);

  const withPublicEmail = people.filter((p) => p.email && p.email_status === 'found_public');
  console.log(`  INFO: Public emails found: ${withPublicEmail.length}/${people.length}`);

  const withLinkedIn = people.filter((p) => p.linkedin_url);
  console.log(`  INFO: Direct LinkedIn URLs found: ${withLinkedIn.length}/${people.length}`);

  const withConfidenceLabel = people.filter((p) => p.confidence_label);
  assert(withConfidenceLabel.length === people.length, 'All records have enrichment confidence labels');

  await closeBrowser();
  closeDb();

  console.log('\n=== VALIDATION PASSED ===\n');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n=== VALIDATION FAILED ===');
  console.error(err.message);
  await closeBrowser().catch(() => {});
  closeDb();
  process.exit(1);
});
