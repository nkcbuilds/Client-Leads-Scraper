import { Router } from 'express';
import { createJob, getJobById, getAllJobs } from '../db/jobs.js';
import { getScrapeLogsByJob } from '../db/scrapeLog.js';
import { getEnrichedPeopleByJob } from '../db/contacts.js';
import { enqueueJob } from '../queue/jobQueue.js';
import { buildJobSummary } from '../utils/jobSummary.js';
import { logger } from '../utils/logger.js';

const router = Router();

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

router.post('/', async (req, res) => {
  const { url, label, manual_text, manual_html } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'A valid http(s) URL is required' });
  }

  try {
    const input_mode = manual_html || manual_text ? 'manual' : 'live';
    const job = createJob({ url, label, input_mode, manual_text, manual_html });
    logger.info('Job created', { jobId: job.id, url });

    enqueueJob(job).catch((err) => {
      logger.error('Failed to enqueue job', { jobId: job.id, error: err.message });
    });

    res.status(201).json(job);
  } catch (err) {
    logger.error('Job creation failed', { error: err.message });
    res.status(500).json({ error: 'Failed to create job' });
  }
});

router.get('/', (req, res) => {
  try {
    const jobs = getAllJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const job = getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

router.get('/:id/summary', (req, res) => {
  try {
    const job = getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const logs = getScrapeLogsByJob(req.params.id);
    const people = getEnrichedPeopleByJob(req.params.id);
    const summary = buildJobSummary(job, logs);
    summary.sample_records = people.slice(0, 3).map((p) => ({
      name: p.name,
      title: p.title,
      company: p.company,
      confidence_label: p.confidence_label,
    }));
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to build job summary' });
  }
});

router.get('/:id/logs', (req, res) => {
  try {
    const job = getJobById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const logs = getScrapeLogsByJob(req.params.id);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scrape logs' });
  }
});

export default router;
