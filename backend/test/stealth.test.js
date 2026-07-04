import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  randomDelayMs,
  getOrigin,
  getHostname,
  isCloudflareChallenge,
} from '../src/crawler/stealth.js';
import { getStoragePathForHost } from '../src/crawler/session.js';

test('randomDelayMs stays within configured bounds', () => {
  for (let i = 0; i < 20; i++) {
    const value = randomDelayMs(1500, 3500);
    assert.ok(value >= 1500 && value <= 3500);
  }
});

test('getOrigin and getHostname parse URLs', () => {
  assert.equal(getOrigin('https://www.chambers.com/legal-guide'), 'https://www.chambers.com');
  assert.equal(getHostname('https://www.chambers.com/legal-guide'), 'www.chambers.com');
});

test('isCloudflareChallenge detects challenge pages', () => {
  assert.equal(isCloudflareChallenge('Just a moment...', '<html></html>'), true);
  assert.equal(isCloudflareChallenge('Lawyers', '<html><body>content</body></html>'), false);
});

test('getStoragePathForHost sanitizes hostnames', () => {
  const path = getStoragePathForHost('www.chambers.com');
  assert.ok(path.endsWith('www.chambers.com.json'));
});