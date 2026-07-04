/**
 * Browser stealth helpers inspired by undetected-chromedriver patterns:
 * strip automation flags, normalize navigator fingerprint, human-like delays.
 */

export const STEALTH_INIT_SCRIPT = `
(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  if (!window.chrome) {
    window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
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

  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 8,
  });

  Object.defineProperty(navigator, 'deviceMemory', {
    get: () => 8,
  });

  Object.defineProperty(navigator, 'platform', {
    get: () => 'Win32',
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

/** Playwright uses the real browser TLS stack when channel=chrome (Chrome-native fingerprint). */
export function describeTlsMode({ useSystemChrome, tlsMode }) {
  if (tlsMode === 'chromium-bundled') {
    return {
      mode: 'chromium-bundled',
      fingerprint: 'playwright-chromium',
      note: 'Bundled Chromium TLS fingerprint; easier for bot systems to flag.',
    };
  }
  if (useSystemChrome) {
    return {
      mode: 'chrome-native',
      fingerprint: 'google-chrome',
      note: 'System Chrome provides a native Chrome TLS/JA3 fingerprint (uTLS-equivalent for browser traffic).',
    };
  }
  return {
    mode: 'chromium-bundled',
    fingerprint: 'playwright-chromium',
    note: 'System Chrome disabled; using bundled Chromium.',
  };
}

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

export async function waitForChallengeResolution(page, maxWaitMs = 30000, { onWait } = {}) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const title = await page.title();
    const html = await page.content();
    if (!isCloudflareChallenge(title, html)) {
      return true;
    }
    if (onWait) {
      await onWait();
    }
    await page.waitForTimeout(1500);
  }
  return false;
}