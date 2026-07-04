import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractLinks, findLeadDetailLinks, findProfileLinks, findPaginationLink } from '../src/crawler/links.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'profile-directory.html'), 'utf8');
const baseUrl = 'https://www.lw.com/en/people';

test('findProfileLinks extracts people URLs', () => {
  const links = extractLinks(html, baseUrl);
  const profiles = findProfileLinks(links, baseUrl);
  assert.ok(profiles.length >= 5);
  assert.ok(profiles.every((u) => u.includes('/people/')));
});

test('findProfileLinks excludes terms-of-use pages', () => {
  const badHtml = '<a href="/en/attorney-advertising-terms-of-use">Terms</a><a href="/en/people/jane">Jane</a>';
  const links = extractLinks(badHtml, baseUrl);
  const profiles = findProfileLinks(links, baseUrl);
  assert.ok(!profiles.some((u) => u.includes('terms-of-use')));
});

test('findProfileLinks excludes search-style URLs that are not profiles', () => {
  const badHtml = '<a href="/lawyer/search">Lawyer Search</a><a href="/en/people/jane">Jane</a>';
  const links = extractLinks(badHtml, baseUrl);
  const profiles = findProfileLinks(links, baseUrl);
  assert.ok(!profiles.some((u) => u.includes('/search')));
  assert.ok(profiles.some((u) => u.includes('/en/people/jane')));
});

test('findPaginationLink detects next page', () => {
  const links = extractLinks(html, baseUrl);
  const next = findPaginationLink(links, baseUrl);
  assert.ok(next.includes('page=2'));
});

test('findPaginationLink ignores unrelated nav like "The Next 500"', () => {
  const navHtml = `
    <a href="/rankings/the-next-500">The Next 500</a>
    <a href="/awards/2024?page=2" rel="next">Next page</a>
  `;
  const links = extractLinks(navHtml, 'https://example.com/awards/2024');
  const next = findPaginationLink(links, 'https://example.com/awards/2024');
  assert.equal(next, 'https://example.com/awards/2024?page=2');
});

test('findLeadDetailLinks finds award winners pages', () => {
  const awardHtml = `
    <a href="/legal-era-tv/awards/legal-era-indian-legal-awards-2025-959671">View Full Winners 2025 click here</a>
    <a href="/newsletter">Newsletter</a>
  `;
  const links = extractLinks(awardHtml, 'https://www.legaleraonline.com/legal-era-awards-indian-legal-awards-2025-2026');
  const details = findLeadDetailLinks(links, 'https://www.legaleraonline.com/legal-era-awards-indian-legal-awards-2025-2026');
  assert.deepEqual(details, ['https://www.legaleraonline.com/legal-era-tv/awards/legal-era-indian-legal-awards-2025-959671']);
});
