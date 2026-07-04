import '../utils/env.js';
import { initDb, closeDb } from '../db/index.js';
import { createJob } from '../db/jobs.js';
import { closeBrowser } from '../crawler/browser.js';
import { enqueueJob } from '../queue/jobQueue.js';
import { getJobById } from '../db/jobs.js';
import { getScrapeLogsByJob } from '../db/scrapeLog.js';
import { getPeopleByJob } from '../db/people.js';
import { logger } from '../utils/logger.js';

const TEST_URL = process.argv[2] || 'https://example.com';

async function waitForJob(jobId, maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const job = getJobById(jobId);
    if (job.status !== 'pending' && job.status !== 'running') {
      return job;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Job timed out');
}

async function main() {
  logger.info('Starting end-to-end scrape test', { url: TEST_URL });

  initDb();

  const job = createJob({ url: TEST_URL, label: 'E2E test' });
  logger.info('Job created', { jobId: job.id });

  await enqueueJob(job);
  const completed = await waitForJob(job.id);
  const logs = getScrapeLogsByJob(job.id);
  const people = getPeopleByJob(job.id);

  console.log('\n--- Test Results ---');
  console.log('Job:', JSON.stringify(completed, null, 2));
  console.log('Logs:', JSON.stringify(logs, null, 2));
  console.log('People:', JSON.stringify(people, null, 2));

  await closeBrowser();
  closeDb();

  if (completed.status === 'done' || completed.status === 'done_with_warnings') {
    logger.info('E2E test PASSED', { records: people.length });
    process.exit(0);
  } else {
    logger.error('E2E test FAILED', { status: completed.status });
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error('Test script error', { error: err.message });
  process.exit(1);
});