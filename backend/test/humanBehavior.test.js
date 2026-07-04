import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMousePath } from '../src/crawler/humanBehavior.js';
import { describeTlsMode } from '../src/crawler/stealth.js';
import { extractClearanceCookies, hasClearanceCookies } from '../src/crawler/cookieReplay.js';

test('buildMousePath returns smooth multi-step coordinates', () => {
  const path = buildMousePath(100, 100, 500, 400, 20);
  assert.equal(path.length, 21);
  assert.equal(path[0].x, 100);
  assert.equal(path[0].y, 100);
  assert.ok(Math.abs(path.at(-1).x - 500) < 0.01);
  assert.ok(Math.abs(path.at(-1).y - 400) < 0.01);
});

test('describeTlsMode documents chrome-native fingerprinting', () => {
  const chrome = describeTlsMode({ useSystemChrome: true, tlsMode: 'chrome-native' });
  assert.equal(chrome.mode, 'chrome-native');
  assert.equal(chrome.fingerprint, 'google-chrome');
});

test('extractClearanceCookies finds Cloudflare clearance cookies', () => {
  const state = {
    cookies: [
      { name: 'cf_clearance', value: 'abc', domain: '.example.com' },
      { name: 'session', value: 'xyz', domain: '.example.com' },
    ],
  };
  assert.equal(hasClearanceCookies(state), true);
  assert.equal(extractClearanceCookies(state).length, 1);
});