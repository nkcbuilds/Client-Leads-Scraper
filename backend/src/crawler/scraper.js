import * as cheerio from 'cheerio';
import { createPage } from './browser.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

const BLOCK_INDICATORS = [
  'cf-browser-verification',
  'Attention Required',
  'Just a moment...',
  'Access denied',
  '403 Forbidden',
  'Please verify you are a human',
];

export function detectBlockedPage(html, title) {
  const combined = `${title || ''} ${html || ''}`.toLowerCase();

  const $ = cheerio.load(html || '');
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const mainText = $('main, article').text().replace(/\s+/g, ' ').trim();
  const hasChallengeScript = combined.includes('challenge-platform');
  const hasVisibleContent = bodyText.length > 500 || mainText.length > 200;

  for (const indicator of BLOCK_INDICATORS) {
    if (combined.includes(indicator.toLowerCase())) {
      return indicator;
    }
  }

  // Some sites include Cloudflare's challenge script on otherwise readable pages.
  // Treat it as a block only when there is little or no visible content.
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

async function waitForContent(page, { scroll = false, timeoutMs = 30000 } = {}) {
  await page.waitForTimeout(2000);

  if (scroll) {
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
    await page.waitForTimeout(2500);
  }

  try {
    await page.waitForSelector('a[href], table, article, main', { timeout: Math.min(timeoutMs, 10000) });
  } catch {
    // continue with best-effort content
  }
}

export async function scrapePage(url, { timeoutMs = 30000, maxRetries = 3, scroll = false } = {}) {
  let page = null;
  let context = null;

  try {
    ({ page, context } = await createPage(timeoutMs));

    logger.info('Navigating to URL', { url });
    const response = await withRetry(
      () => page.goto(url, { waitUntil: scroll ? 'networkidle' : 'domcontentloaded', timeout: timeoutMs }),
      { maxAttempts: maxRetries, label: `scrape ${url}` },
    );

    await waitForContent(page, { scroll, timeoutMs });

    const html = await page.content();
    const pageTitle = await page.title();
    const statusCode = response ? response.status() : null;

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
    };
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
  } finally {
    if (context) {
      await context.close();
    }
  }
}
