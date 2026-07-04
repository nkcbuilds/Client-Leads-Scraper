import { Router } from 'express';
import { getQueueStats } from '../queue/jobQueue.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'legalreach-backend',
    timestamp: new Date().toISOString(),
    queue: getQueueStats(),
  });
});

export default router;