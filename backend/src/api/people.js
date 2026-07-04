import { Router } from 'express';
import { getPeopleByJob, getAllPeople } from '../db/people.js';
import { getEnrichedPeopleByJob } from '../db/contacts.js';
import { getJobById } from '../db/jobs.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const { job_id, min_confidence } = req.query;
    const people = getAllPeople({
      jobId: job_id ? parseInt(job_id, 10) : undefined,
      minConfidence: min_confidence ? parseFloat(min_confidence) : undefined,
    });
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch people' });
  }
});

router.get('/job/:jobId', (req, res) => {
  try {
    const job = getJobById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const enriched = req.query.enriched === 'true';
    const people = enriched
      ? getEnrichedPeopleByJob(req.params.jobId)
      : getPeopleByJob(req.params.jobId);
    res.json(people);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch people for job' });
  }
});

export default router;