import './utils/env.js';
import express from 'express';
import cors from 'cors';
import { initDb, closeDb } from './db/index.js';
import { setSetting } from './db/settings.js';
import { closeBrowser } from './crawler/browser.js';
import { logger } from './utils/logger.js';
import jobsRouter from './api/jobs.js';
import peopleRouter from './api/people.js';
import settingsRouter from './api/settings.js';
import exportRouter from './api/export.js';
import healthRouter from './api/health.js';

const PORT = process.env.PORT || 3001;

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/jobs', exportRouter);
app.use('/api/people', peopleRouter);
app.use('/api/settings', settingsRouter);

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

async function shutdown() {
  logger.info('Shutting down...');
  await closeBrowser();
  closeDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

initDb();

if (process.env.GEMINI_API_KEY) {
  setSetting('gemini_api_key', process.env.GEMINI_API_KEY);
}

app.listen(PORT, () => {
  logger.info(`LegalReach backend running on http://localhost:${PORT}`);
});