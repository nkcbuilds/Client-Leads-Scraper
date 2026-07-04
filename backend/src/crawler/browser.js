import { chromium } from 'playwright';
import { logger } from '../utils/logger.js';
import { getCrawlSettings } from '../db/settings.js';
import { STEALTH_INIT_SCRIPT, getHostname } from './stealth.js';
import { loadStorageStateIfExists, saveStorageState } from './session.js';

let browser = null;
let browserLaunchMode = null;
const domainSessions = new Map();

function buildLaunchOptions() {
  const { headless, useSystemChrome } = getCrawlSettings();
  const args = [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--window-size=1920,1080',
  ];

  const options = {
    headless,
    args,
  };

  if (useSystemChrome) {
    options.channel = 'chrome';
  }

  return options;
}

async function launchBrowser() {
  const options = buildLaunchOptions();

  try {
    browser = await chromium.launch(options);
    browserLaunchMode = options.channel ? 'chrome' : 'chromium';
    logger.info('Playwright browser launched', { mode: browserLaunchMode, headless: options.headless });
    return browser;
  } catch (err) {
    if (options.channel) {
      logger.warn('System Chrome unavailable, falling back to bundled Chromium', {
        error: err.message?.slice(0, 120),
      });
      browser = await chromium.launch({ headless: options.headless, args: options.args });
      browserLaunchMode = 'chromium-fallback';
      logger.info('Playwright browser launched', { mode: browserLaunchMode, headless: options.headless });
      return browser;
    }
    throw err;
  }
}

export async function getBrowser() {
  if (!browser) {
    await launchBrowser();
  }
  return browser;
}

export function getBrowserLaunchMode() {
  return browserLaunchMode;
}

async function applyStealth(context) {
  const { stealthEnabled } = getCrawlSettings();
  if (!stealthEnabled) return;
  await context.addInitScript(STEALTH_INIT_SCRIPT);
}

function buildContextOptions(hostname) {
  const { storageStatePath } = getCrawlSettings();
  const persistedPath = loadStorageStateIfExists(hostname);
  const storageState = persistedPath || (storageStatePath || null);

  const contextOptions = {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  };

  if (storageState) {
    contextOptions.storageState = storageState;
  }

  return contextOptions;
}

export async function getDomainSession(url, timeoutMs = 30000) {
  const hostname = getHostname(url);
  if (!hostname) {
    throw new Error(`Invalid URL for browser session: ${url}`);
  }

  const existing = domainSessions.get(hostname);
  if (existing) {
    existing.lastUsed = Date.now();
    existing.page.setDefaultTimeout(timeoutMs);
    return existing;
  }

  const b = await getBrowser();
  const context = await b.newContext(buildContextOptions(hostname));
  await applyStealth(context);

  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  const session = {
    hostname,
    context,
    page,
    warmed: false,
    lastUsed: Date.now(),
  };

  domainSessions.set(hostname, session);
  logger.info('Browser session created for domain', { hostname, reused: false });
  return session;
}

export async function resetDomainSession(hostname) {
  const existing = domainSessions.get(hostname);
  if (existing) {
    try {
      await existing.context.close();
    } catch {
      // ignore close errors
    }
    domainSessions.delete(hostname);
    logger.info('Browser session reset for domain', { hostname });
  }
}

export async function persistDomainSession(hostname) {
  const session = domainSessions.get(hostname);
  if (!session) return null;
  const saved = await saveStorageState(session.context, hostname);
  if (saved) {
    logger.info('Browser session persisted', { hostname, path: saved });
  }
  return saved;
}

export async function closeBrowser() {
  for (const [hostname, session] of domainSessions.entries()) {
    try {
      await persistDomainSession(hostname);
      await session.context.close();
    } catch {
      // best effort
    }
  }
  domainSessions.clear();

  if (browser) {
    await browser.close();
    browser = null;
    browserLaunchMode = null;
    logger.info('Playwright browser closed');
  }
}

/** @deprecated Use getDomainSession for Cloudflare-aware scraping */
export async function createPage(timeoutMs = 30000) {
  const b = await getBrowser();
  const context = await b.newContext(buildContextOptions(null));
  await applyStealth(context);
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  return { page, context };
}