import { chromium } from 'playwright';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { getCrawlSettings } from '../db/settings.js';

let browser = null;

export async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    logger.info('Playwright browser launched');
  }
  return browser;
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    logger.info('Playwright browser closed');
  }
}

export async function createPage(timeoutMs = 30000) {
  const b = await getBrowser();
  const { storageStatePath } = getCrawlSettings();
  const contextOptions = {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  };

  if (storageStatePath && fs.existsSync(storageStatePath)) {
    contextOptions.storageState = storageStatePath;
  }

  const context = await b.newContext({
    ...contextOptions,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  return { page, context };
}
