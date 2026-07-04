/**
 * Browser stealth helpers inspired by undetected-chromedriver patterns:
 * strip automation flags, normalize navigator fingerprint, human-like delays.
 */

export const STEALTH_INIT_SCRIPT = `
(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  if (!window.chrome) {
    window.chrome = { runtime: {} };
  }

  const originalQuery = window.navigator.permissions?.query;
  if (originalQuery) {
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
  }

  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });

  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
  });

  for (const key of Object.keys(window)) {
    if (key.startsWith('cdc_') || key.startsWith('$cdc_')) {
      try {
        delete window[key];
      } catch {
        // ignore read-only globals
      }
    }
  }
})();
`;

export function randomDelayMs(minMs, maxMs) {
  const min = Math.max(0, Number(minMs) || 0);
  const max = Math.max(min, Number(maxMs) || min);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isCloudflareChallenge(title, html) {
  const combined = `${title || ''} ${html || ''}`.toLowerCase();
  return (
    combined.includes('just a moment') ||
    combined.includes('cf-browser-verification') ||
    combined.includes('attention required') ||
    combined.includes('please verify you are a human')
  );
}

export async function waitForChallengeResolution(page, maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const title = await page.title();
    const html = await page.content();
    if (!isCloudflareChallenge(title, html)) {
      return true;
    }
    await page.waitForTimeout(1500);
  }
  return false;
}