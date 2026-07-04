import PQueue from 'p-queue';
import { processJob } from '../crawler/pipeline.js';
import { updateJobStatus } from '../db/jobs.js';
import { addScrapeLog } from '../db/scrapeLog.js';
import { getCrawlSettings } from '../db/settings.js';
import { logger } from '../utils/logger.js';
import { randomDelayMs } from '../crawler/stealth.js';

let queue = null;

function getQueue() {
  if (!queue) {
    const { concurrency } = getCrawlSettings();
    queue = new PQueue({ concurrency });
  }
  return queue;
}

export async function enqueueJob(job) {
  const q = getQueue();
  const { delayMinMs, delayMaxMs, delayMs } = getCrawlSettings();

  return q.add(async () => {
    logger.info('Processing job', { jobId: job.id, url: job.url });
    updateJobStatus(job.id, 'running');

    try {
      const waitMs = randomDelayMs(delayMinMs, delayMaxMs) || delayMs;
      await new Promise((r) => setTimeout(r, waitMs));
      await processJob(job);
    } catch (err) {
      logger.error('Job processing error', { jobId: job.id, error: err.message });
      addScrapeLog({
        jobId: job.id,
        url: job.url,
        status: 'failed',
        message: err.message,
      });
      updateJobStatus(job.id, 'failed', { error_message: err.message });
    }
  });
}

export function getQueueStats() {
  const q = getQueue();
  return {
    pending: q.pending,
    size: q.size,
  };
}