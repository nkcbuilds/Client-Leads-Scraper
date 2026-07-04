import './utils/env.js';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { initDb, closeDb } from './db/index.js';
import { setSetting } from './db/settings.js';
import { closeBrowser } from './crawler/browser.js';
import { logger } from './utils/logger.js';
import jobsRouter from './api/jobs.js';
import peopleRouter from './api/people.js';
import settingsRouter from './api/settings.js';
import exportRouter from './api/export.js';
import healthRouter from './api/health.js';

function createApp() {
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

  return app;
}

let serverInstance = null;
let shutdownHandlersRegistered = false;

export async function stopServer() {
  logger.info('Shutting down...');
  if (serverInstance) {
    await new Promise((resolve, reject) => {
      serverInstance.close((err) => (err ? reject(err) : resolve()));
    });
    serverInstance = null;
  }
  await closeBrowser();
  closeDb();
}

function registerShutdownHandlers() {
  if (shutdownHandlersRegistered) return;
  shutdownHandlersRegistered = true;

  const handleSignal = async () => {
    await stopServer();
    process.exit(0);
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
}

export async function startServer({ port = process.env.PORT || 3001 } = {}) {
  if (serverInstance) return serverInstance;

  initDb();

  if (process.env.GEMINI_API_KEY) {
    setSetting('gemini_api_key', process.env.GEMINI_API_KEY);
  }

  const app = createApp();
  serverInstance = await new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info(`LegalReach backend running on http://localhost:${port}`);
      resolve(server);
    });
  });

  registerShutdownHandlers();
  return serverInstance;
}

const entryHref = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (import.meta.url === entryHref) {
  startServer().catch(async (err) => {
    logger.error('Failed to start backend server', { error: err.message });
    await stopServer().catch(() => {});
    process.exit(1);
  });
}
