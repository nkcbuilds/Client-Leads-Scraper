import { scrapePage, buildManualPageResult } from './scraper.js';
import { extractLinks, findProfileLinks, findPaginationLink, findLeadDetailLinks, dedupeUrls } from './links.js';
import { classifyPage, PAGE_TYPES } from '../classifier/classifier.js';
import { extractPeopleFromPage } from '../llm/extractor.js';
import { deduplicatePeople } from '../dedup/deduplicator.js';
import { enrichPeople } from '../enrichment/index.js';
import { addScrapeLog } from '../db/scrapeLog.js';
import { incrementJobPages, updateJobStatus } from '../db/jobs.js';
import { createPeople, countPeopleByJob } from '../db/people.js';
import { createContacts } from '../db/contacts.js';
import { getCrawlSettings } from '../db/settings.js';
import { getScrapeLogsByJob } from '../db/scrapeLog.js';
import { getJobById } from '../db/jobs.js';
import { buildJobSummary } from '../utils/jobSummary.js';
import { logger } from '../utils/logger.js';
import { randomDelayMs } from './stealth.js';

const MAX_PROFILE_PAGES = 25;
const MAX_PAGINATION_PAGES = 10;
const MIN_SEED_RECORDS_TO_SKIP_PROFILES = 5;
const MIN_SEED_RECORDS_TO_SKIP_DETAIL_PAGES = 5;

async function delay() {
  const { delayMinMs, delayMaxMs, delayMs } = getCrawlSettings();
  const waitMs = randomDelayMs(delayMinMs, delayMaxMs) || delayMs;
  await new Promise((r) => setTimeout(r, waitMs));
}

function logPageResult(jobId, url, result, pageType) {
  if (result.blocked) {
    addScrapeLog({
      jobId,
      url,
      status: 'blocked',
      pageType,
      message: result.blockReason,
      contentLength: 0,
    });
    return 'blocked';
  }

  if (!result.success) {
    addScrapeLog({
      jobId,
      url,
      status: 'failed',
      pageType,
      message: result.error,
      contentLength: result.textLength || 0,
    });
    return 'failed';
  }

  addScrapeLog({
    jobId,
    url,
    status: 'success',
    pageType,
    message: `Captured ${result.textLength} chars`,
    contentLength: result.textLength,
  });
  incrementJobPages(jobId);
  return 'success';
}

async function extractFromPage(result, warnings, pageType = null) {
  const { people, warnings: extractWarnings, method } = await extractPeopleFromPage(
    result.text,
    result.url,
    { pageType },
  );
  warnings.push(...extractWarnings);
  return { people, method };
}

export async function buildCrawlPlan(classification, seedUrl, links) {
  const urls = [seedUrl];

  switch (classification.type) {
    case PAGE_TYPES.PROFILE_DIRECTORY: {
      const profiles = classification.profileLinks || findProfileLinks(links, seedUrl);
      urls.push(...dedupeUrls(profiles).slice(0, MAX_PROFILE_PAGES));
      break;
    }
    case PAGE_TYPES.LIST_PAGE:
    case PAGE_TYPES.SEARCH_RESULTS: {
      const nextUrl = findPaginationLink(links, seedUrl);
      if (nextUrl) urls.push(nextUrl);
      break;
    }
    default:
      break;
  }

  return dedupeUrls(urls);
}

async function saveEnrichedRecords(jobId, allPeople, pageTextMap, warnings) {
  const { unique, reviewQueue, removed } = deduplicatePeople(allPeople);

  if (removed > 0) {
    logger.info('Deduplication removed duplicates', { jobId, removed });
    warnings.push(`Merged ${removed} duplicate record(s)`);
  }
  if (reviewQueue.length > 0) {
    warnings.push(`${reviewQueue.length} record(s) flagged for review`);
  }

  const saved = createPeople(jobId, unique);
  const enriched = await enrichPeople(saved, pageTextMap);
  createContacts(enriched);

  logger.info('Records saved and enriched', {
    jobId,
    people: saved.length,
    contacts: enriched.length,
  });

  return saved.length;
}

export async function processJob(job) {
  const { timeoutMs } = getCrawlSettings();
  const warnings = [];
  const allPeople = [];
  const pageTextMap = {};
  let blockedCount = 0;
  let failedCount = 0;

  logger.info('Starting crawl pipeline', { jobId: job.id, url: job.url });

  const seedResult = job.input_mode === 'manual'
    ? buildManualPageResult(job.url, { manualHtml: job.manual_html, manualText: job.manual_text })
    : await scrapePage(job.url, { timeoutMs });
  let useScroll = false;
  const seedStatus = logPageResult(job.id, job.url, seedResult, null);

  if (seedStatus === 'blocked') {
    updateJobStatus(job.id, 'blocked', { error_message: `Blocked: ${seedResult.blockReason}` });
    return;
  }
  if (seedStatus === 'failed') {
    updateJobStatus(job.id, 'failed', { error_message: seedResult.error });
    return;
  }

  pageTextMap[seedResult.url] = seedResult.text;

  const resolvedSeedUrl = seedResult.url || job.url;
  const links = extractLinks(seedResult.html, resolvedSeedUrl);
  const classification = await classifyPage(resolvedSeedUrl, seedResult.html, seedResult.text, links);

  logger.info('Page classified', {
    jobId: job.id,
    type: classification.type,
    confidence: classification.confidence,
    method: classification.method,
  });

  addScrapeLog({
    jobId: job.id,
    url: resolvedSeedUrl,
    status: 'classified',
    pageType: classification.type,
    message: classification.reason,
    contentLength: seedResult.textLength,
  });

  useScroll = classification.type === PAGE_TYPES.PROFILE_DIRECTORY;

  let urlsToCrawl = await buildCrawlPlan(classification, resolvedSeedUrl, links);

  if (useScroll) {
    logger.info('Re-scraping directory with scroll for lazy-loaded listings', { jobId: job.id });
    const scrolled = await scrapePage(resolvedSeedUrl, { timeoutMs, scroll: true });
    if (scrolled.success) {
      pageTextMap[scrolled.url] = scrolled.text;
      const scrolledBaseUrl = scrolled.url || resolvedSeedUrl;
      const scrolledLinks = extractLinks(scrolled.html, scrolledBaseUrl);
      urlsToCrawl = await buildCrawlPlan(classification, scrolledBaseUrl, scrolledLinks);
      Object.assign(seedResult, scrolled);
    }
  }

  const seedExtract = await extractFromPage(seedResult, warnings, classification.type);
  allPeople.push(...seedExtract.people);
  if (seedExtract.people.length > 0) {
    logger.info('People extracted from seed', { jobId: job.id, count: seedExtract.people.length, method: seedExtract.method });
  }

  let remainingUrls = urlsToCrawl.filter((u) => u !== resolvedSeedUrl);

  if (
    classification.type === PAGE_TYPES.LIST_PAGE &&
    allPeople.length < MIN_SEED_RECORDS_TO_SKIP_DETAIL_PAGES
  ) {
      const detailLinks = findLeadDetailLinks(links, resolvedSeedUrl)
      .filter((url) => url !== resolvedSeedUrl)
      .slice(0, MAX_PAGINATION_PAGES);
    if (detailLinks.length > 0) {
      logger.info('Adding lead-rich detail pages for shallow list result', {
        jobId: job.id,
        seedRecords: allPeople.length,
        detailLinks: detailLinks.length,
      });
      remainingUrls = dedupeUrls([...detailLinks, ...remainingUrls]);
    }
  }

  if (
    classification.type === PAGE_TYPES.PROFILE_DIRECTORY &&
    allPeople.length >= MIN_SEED_RECORDS_TO_SKIP_PROFILES
  ) {
    logger.info('Seed page yielded enough records, skipping individual profile visits', {
      jobId: job.id,
      seedRecords: allPeople.length,
      skippedProfiles: remainingUrls.length,
    });
    warnings.push(`Skipped ${remainingUrls.length} profile page(s) — listing page already yielded ${allPeople.length} records`);
    remainingUrls = [];
  }

  for (const url of remainingUrls) {
    await delay();
    const result = await scrapePage(url, { timeoutMs, scroll: useScroll });
    const status = logPageResult(job.id, url, result, classification.type);

    if (status === 'blocked') {
      blockedCount++;
      continue;
    }
    if (status === 'failed') {
      failedCount++;
      continue;
    }

    pageTextMap[result.url] = result.text;
    const extracted = await extractFromPage(result, warnings, classification.type);
    allPeople.push(...extracted.people);

    if (
      classification.type === PAGE_TYPES.LIST_PAGE ||
      classification.type === PAGE_TYPES.SEARCH_RESULTS
    ) {
      const pageLinks = extractLinks(result.html, url);
      const nextUrl = findPaginationLink(pageLinks, url);
      if (nextUrl && !urlsToCrawl.includes(nextUrl) && urlsToCrawl.length < MAX_PAGINATION_PAGES) {
        urlsToCrawl.push(nextUrl);
      }
    }
  }

  let recordCount = 0;
  if (allPeople.length > 0) {
    recordCount = await saveEnrichedRecords(job.id, allPeople, pageTextMap, warnings);
  }

  let finalStatus = 'done';
  if (blockedCount > 0 || failedCount > 0 || warnings.length > 0) {
    finalStatus = 'done_with_warnings';
  }
  if (recordCount === 0) {
    finalStatus = 'done_with_warnings';
    if (warnings.length === 0) warnings.push('No people records extracted');
  }

  const errorParts = [];
  if (blockedCount > 0) errorParts.push(`${blockedCount} page(s) blocked`);
  if (failedCount > 0) errorParts.push(`${failedCount} page(s) failed`);
  if (warnings.length > 0) {
    errorParts.push(warnings.slice(0, 3).join('; '));
  }

  updateJobStatus(job.id, finalStatus, {
    records_found: recordCount || countPeopleByJob(job.id),
    error_message: errorParts.length > 0 ? errorParts.join('; ') : null,
  });

  const finalJob = getJobById(job.id);
  const summary = buildJobSummary(finalJob, getScrapeLogsByJob(job.id));

  logger.info('Pipeline completed', {
    jobId: job.id,
    status: finalStatus,
    pagesScraped: urlsToCrawl.length,
    recordsFound: recordCount,
    extractedRaw: allPeople.length,
    pageType: summary.page_type,
    issues: summary.issues,
  });
}
