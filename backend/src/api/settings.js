import { Router } from 'express';
import { getAllSettings, setSettings } from '../db/settings.js';

const router = Router();

const ALLOWED_KEYS = [
  'crawl_delay_ms',
  'crawl_delay_min_ms',
  'crawl_delay_max_ms',
  'crawl_concurrency',
  'crawl_timeout_ms',
  'gemini_api_key',
  'browser_storage_state_path',
  'browser_storage_state_dir',
  'browser_stealth',
  'browser_use_system_chrome',
  'browser_headless',
  'browser_warmup',
  'browser_warmup_wait_ms',
  'output_path',
];

router.get('/', (req, res) => {
  try {
    const settings = getAllSettings();
    if (settings.gemini_api_key) {
      settings.gemini_api_key = '***configured***';
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', (req, res) => {
  try {
    const updates = {};
    for (const key of ALLOWED_KEYS) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    setSettings(updates);
    const settings = getAllSettings();
    if (settings.gemini_api_key) {
      settings.gemini_api_key = '***configured***';
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
