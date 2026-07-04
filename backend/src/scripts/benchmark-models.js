import '../utils/env.js';
import { initDb, closeDb } from '../db/index.js';
import { createJob, getJobById } from '../db/jobs.js';
import { getEnrichedPeopleByJob } from '../db/contacts.js';
import { getScrapeLogsByJob } from '../db/scrapeLog.js';
import { closeBrowser } from '../crawler/browser.js';
import { enqueueJob } from '../queue/jobQueue.js';
import { isGarbageName } from '../llm/validator.js';
import { logger } from '../utils/logger.js';

const TEST_URL = process.argv[2] || 'https://www.lw.com/en/people';

const MODELS = [
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    expectedDailyLimit: 500,
  },
  {
    id: 'gemma-4-31b-it',
    label: 'Gemma 4 31B IT',
    expectedDailyLimit: null,
  },
];

async function waitForJob(jobId, maxWait = 600000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const job = getJobById(jobId);
    if (!['pending', 'running'].includes(job.status)) return job;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Job ${jobId} timed out after ${maxWait}ms`);
}

function scoreRecordQuality(people) {
  let valid = 0;
  let garbage = 0;
  let withTitle = 0;
  let withCompany = 0;
  let withEmail = 0;
  let totalConf = 0;

  for (const p of people) {
    if (isGarbageName(p.name)) {
      garbage++;
      continue;
    }
    valid++;
    if (p.title) withTitle++;
    if (p.company) withCompany++;
    if (p.email) withEmail++;
    totalConf += p.overall_confidence || p.llm_confidence || 0;
  }

  return {
    total: people.length,
    valid,
    garbage,
    withTitle,
    withCompany,
    withEmail,
    avgConfidence: valid > 0 ? totalConf / valid : 0,
    sampleNames: people.filter((p) => !isGarbageName(p.name)).slice(0, 5).map((p) => p.name),
  };
}

function analyzeLogs(logs) {
  return {
    success: logs.filter((l) => l.status === 'success').length,
    blocked: logs.filter((l) => l.status === 'blocked').length,
    failed: logs.filter((l) => l.status === 'failed').length,
    classified: logs.find((l) => l.status === 'classified')?.page_type || null,
  };
}

async function runBenchmark(model) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BENCHMARK: ${model.label} (${model.id})`);
  console.log(`${'='.repeat(60)}\n`);

  process.env.GEMINI_MODEL = model.id;
  process.env.GEMINI_FALLBACK_MODELS = '';

  const t0 = Date.now();
  const job = createJob({ url: TEST_URL, label: `Benchmark: ${model.label}` });

  console.log(`Job #${job.id} created — starting full pipeline...`);

  await enqueueJob(job);
  const completed = await waitForJob(job.id);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const people = getEnrichedPeopleByJob(job.id);
  const logs = getScrapeLogsByJob(job.id);
  const quality = scoreRecordQuality(people);
  const logStats = analyzeLogs(logs);

  const result = {
    model: model.id,
    label: model.label,
    jobId: job.id,
    elapsedSec: parseFloat(elapsed),
    status: completed.status,
    pagesScraped: completed.pages_scraped,
    recordsFound: completed.records_found,
    errorMessage: completed.error_message,
    quality,
    logStats,
  };

  console.log('\n--- Results ---');
  console.log(JSON.stringify(result, null, 2));

  return result;
}

function pickWinner(a, b) {
  const score = (r) => {
    let s = 0;
    s += r.quality.valid * 10;
    s -= r.quality.garbage * 20;
    s += r.quality.withEmail * 2;
    s += r.quality.avgConfidence * 5;
    if (r.status === 'done') s += 10;
    if (r.status === 'done_with_warnings') s += 5;
    if (r.recordsFound === 0) s -= 50;
    s -= r.elapsedSec * 0.01;
    return s;
  };

  const sa = score(a);
  const sb = score(b);
  return { winner: sa >= sb ? a : b, scoreA: sa, scoreB: sb };
}

async function main() {
  console.log('\n############################################');
  console.log('#  LegalReach Model Benchmark');
  console.log(`#  URL: ${TEST_URL}`);
  console.log('############################################\n');

  initDb();

  const results = [];
  for (const model of MODELS) {
    try {
      const result = await runBenchmark(model);
      results.push(result);
    } catch (err) {
      console.error(`\nBENCHMARK FAILED for ${model.label}:`, err.message);
      results.push({
        model: model.id,
        label: model.label,
        error: err.message,
        quality: { valid: 0, garbage: 0, total: 0 },
        recordsFound: 0,
        elapsedSec: 0,
        status: 'failed',
      });
    }
  }

  await closeBrowser();
  closeDb();

  console.log('\n############################################');
  console.log('#  COMPARISON SUMMARY');
  console.log('############################################\n');

  for (const r of results) {
    console.log(`${r.label} (${r.model})`);
    console.log(`  Status: ${r.status} | Time: ${r.elapsedSec}s | Pages: ${r.pagesScraped ?? '?'}`);
    console.log(`  Records: ${r.recordsFound ?? 0} (${r.quality?.valid ?? 0} valid, ${r.quality?.garbage ?? 0} garbage)`);
    console.log(`  Avg confidence: ${((r.quality?.avgConfidence ?? 0) * 100).toFixed(0)}%`);
    if (r.quality?.sampleNames?.length) {
      console.log(`  Sample: ${r.quality.sampleNames.join(', ')}`);
    }
    if (r.errorMessage) console.log(`  Warning: ${r.errorMessage}`);
    console.log('');
  }

  if (results.length === 2 && !results[0].error && !results[1].error) {
    const { winner, scoreA, scoreB } = pickWinner(results[0], results[1]);
    console.log(`WINNER: ${winner.label} (scores: ${results[0].label}=${scoreA.toFixed(1)}, ${results[1].label}=${scoreB.toFixed(1)})`);
  }

  console.log('\n############################################\n');
}

main().catch(async (err) => {
  console.error('Benchmark crashed:', err);
  await closeBrowser().catch(() => {});
  closeDb();
  process.exit(1);
});