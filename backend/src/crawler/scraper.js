import * as cheerio from 'cheerio';
import {
  getDomainSession,
  resetDomainSession,
  persistDomainSession,
} from './browser.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { getCrawlSettings } from '../db/settings.js';
import {
  getOrigin,
  getHostname,
  isCloudflareChallenge,
  waitForChallengeResolution,
} from './stealth.js';
import { simulateHumanActivity, humanScroll } from './humanBehavior.js';

const BLOCK_INDICATORS = [
  'cf-browser-verification',
  'Attention Required',
  'Just a moment...',
  'Access denied',
  '403 Forbidden',
  'Please verify you are a human',
];

export function detectBlockedPage(html, title) {
  const $ = cheerio.load(html || '');
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const mainText = $('main, article').text().replace(/\s+/g, ' ').trim();
  const visibleText = `${title || ''} ${mainText} ${bodyText}`.toLowerCase();
  const rawHtml = `${title || ''} ${html || ''}`.toLowerCase();
  const hasChallengeScript = rawHtml.includes('challenge-platform');
  const hasVisibleContent = bodyText.length > 500 || mainText.length > 200;

  for (const indicator of BLOCK_INDICATORS) {
    if (visibleText.includes(indicator.toLowerCase()) && !hasVisibleContent) {
      return indicator;
    }
  }

  if (hasChallengeScript && !hasVisibleContent) {
    return 'challenge-platform';
  }

  return null;
}

export function extractTextContent(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').text().trim();
  return { text, title, textLength: text.length };
}

export function buildManualPageResult(url, { manualHtml = null, manualText = null } = {}) {
  if (manualHtml) {
    const { text, title, textLength } = extractTextContent(manualHtml);
    return {
      success: textLength >= 50,
      blocked: false,
      url,
      statusCode: null,
      title: title || 'Manual HTML import',
      html: manualHtml,
      text,
      textLength,
      error: textLength >= 50 ? null : 'Manual HTML content too short',
    };
  }

  const text = (manualText || '').replace(/\s+/g, ' ').trim();
  return {
    success: text.length >= 50,
    blocked: false,
    url,
    statusCode: null,
    title: 'Manual text import',
    html: `<html><body><main>${text}</main></body></html>`,
    text,
    textLength: text.length,
    error: text.length >= 50 ? null : 'Manual text content too short',
  };
}

async function fetchHtmlInBrowser(page, url) {
  return page.evaluate(async (targetUrl) => {
    const response = await fetch(targetUrl, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const html = await response.text();
    return {
      html,
      status: response.status,
      ok: response.ok,
      finalUrl: response.url,
    };
  }, url);
}

async function maybeSimulateHuman(page) {
  const { humanBehaviorEnabled } = getCrawlSettings();
  if (!humanBehaviorEnabled) return;
  await simulateHumanActivity(page, { intensity: 'medium' });
}

async function warmUpDomain(session, url, timeoutMs) {
  const { warmupEnabled, warmupWaitMs } = getCrawlSettings();
  if (!warmupEnabled || session.warmed) return;

  const origin = getOrigin(url);
  if (!origin) return;

  const warmupUrl = `${origin}/`;
  logger.info('Warming up domain session for Cloudflare', {
    hostname: session.hostname,
    warmupUrl,
  });

  try {
    await session.page.goto(warmupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });
    await maybeSimulateHuman(session.page);
    await session.page.waitForTimeout(warmupWaitMs);

    if (isCloudflareChallenge(await session.page.title(), await session.page.content())) {
      const passed = await waitForChallengeResolution(session.page, Math.max(timeoutMs, 30000), {
        onWait: () => maybeSimulateHuman(session.page),
      });
      if (!passed) {
        logger.warn('Cloudflare challenge may not have cleared during warm-up', {
          hostname: session.hostname,
        });
      }
    }

    session.warmed = true;
    await persistDomainSession(session.hostname);
  } catch (err) {
    logger.warn('Domain warm-up failed, continuing to target URL', {
      hostname: session.hostname,
      error: err.message?.slice(0, 120),
    });
  }
}

async function waitForContent(page, { scroll = false, timeoutMs = 30000 } = {}) {
  await page.waitForTimeout(2000);
  await maybeSimulateHuman(page);

  if (scroll) {
    const { humanBehaviorEnabled } = getCrawlSettings();
    if (humanBehaviorEnabled) {
      await humanScroll(page, { steps: 8, distance: 360 });
    } else {
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let total = 0;
          const step = 400;
          const timer = setInterval(() => {
            window.scrollBy(0, step);
            total += step;
            if (total >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 150);
        });
      });
    }
    await page.waitForTimeout(2500);
  }

  try {
    await page.waitForSelector('a[href], table, article, main', {
      timeout: Math.min(timeoutMs, 10000),
    });
  } catch {
    // continue with best-effort content
  }
}

function buildScrapeResult({ url, html, pageTitle, statusCode, method = 'navigation' }) {
  const blockReason = detectBlockedPage(html, pageTitle);
  if (blockReason) {
    return {
      success: false,
      blocked: true,
      url,
      statusCode,
      title: pageTitle,
      blockReason,
      html: null,
      text: null,
      textLength: 0,
      method,
    };
  }

  const { text, title, textLength } = extractTextContent(html);

  if (textLength < 100) {
    return {
      success: false,
      blocked: false,
      url,
      statusCode,
      title: pageTitle,
      error: 'Page content too short — may be empty or failed to render',
      html,
      text,
      textLength,
      method,
    };
  }

  return {
    success: true,
    blocked: false,
    url,
    statusCode,
    title: title || pageTitle,
    html,
    text,
    textLength,
    method,
  };
}

async function navigateAndCapture(session, url, { timeoutMs, scroll, maxRetries }) {
  const response = await withRetry(
    () =>
      session.page.goto(url, {
        waitUntil: scroll ? 'networkidle' : 'domcontentloaded',
        timeout: timeoutMs,
      }),
    { maxAttempts: maxRetries, label: `scrape ${url}` },
  );

  if (isCloudflareChallenge(await session.page.title(), await session.page.content())) {
    await waitForChallengeResolution(session.page, Math.max(timeoutMs, 30000), {
      onWait: () => maybeSimulateHuman(session.page),
    });
  }

  await waitForContent(session.page, { scroll, timeoutMs });

  const html = await session.page.content();
  const pageTitle = await session.page.title();
  const statusCode = response ? response.status() : null;
  const finalUrl = session.page.url();

  return buildScrapeResult({
    url: finalUrl || url,
    html,
    pageTitle,
    statusCode,
    method: 'navigation',
  });
}

async function fetchAndCapture(session, url) {
  logger.info('Attempting in-browser fetch fallback', { url, hostname: session.hostname });
  try {
    const fetched = await fetchHtmlInBrowser(session.page, url);
    const pageTitle = cheerio.load(fetched.html || '')('title').text().trim() || '';

    return buildScrapeResult({
      url: fetched.finalUrl || url,
      html: fetched.html,
      pageTitle,
      statusCode: fetched.status,
      method: 'in-browser-fetch',
    });
  } catch (err) {
    logger.warn('In-browser fetch fallback failed', {
      url,
      hostname: session.hostname,
      error: err.message?.slice(0, 160),
    });
    return null;
  }
}

async function scrapeWithSession(url, { timeoutMs, scroll, maxRetries, allowSessionReset }) {
  const hostname = getHostname(url);
  const session = await getDomainSession(url, timeoutMs);

  await warmUpDomain(session, url, timeoutMs);

  let result = await navigateAndCapture(session, url, { timeoutMs, scroll, maxRetries });

  if (result.blocked || (!result.success && result.textLength < 100)) {
    const fetchResult = await fetchAndCapture(session, url);
    if (fetchResult?.success) {
      result = fetchResult;
    }
  }

  if ((result.blocked || !result.success) && allowSessionReset) {
    logger.warn('Scrape blocked, resetting domain session and retrying', {
      url,
      hostname,
      blockReason: result.blockReason || result.error,
    });
    await resetDomainSession(hostname);
    const freshSession = await getDomainSession(url, timeoutMs);
    await warmUpDomain(freshSession, url, timeoutMs);
    result = await navigateAndCapture(freshSession, url, { timeoutMs, scroll, maxRetries });

    if (result.blocked || (!result.success && result.textLength < 100)) {
      const fetchResult = await fetchAndCapture(freshSession, url);
      if (fetchResult?.success) {
        result = fetchResult;
      }
    }
  }

  if (result.success) {
    await persistDomainSession(hostname);
  }

  return result;
}

export async function scrapePage(url, { timeoutMs = 30000, maxRetries = 3, scroll = false } = {}) {
  try {
    logger.info('Navigating to URL', { url });
    const result = await scrapeWithSession(url, {
      timeoutMs,
      scroll,
      maxRetries,
      allowSessionReset: true,
    });
    return result;
  } catch (err) {
    logger.error('Scrape failed', { url, error: err.message });
    return {
      success: false,
      blocked: false,
      url,
      error: err.message,
      html: null,
      text: null,
      textLength: 0,
    };
  }
}
