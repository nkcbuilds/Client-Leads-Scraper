import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyPageHeuristic, PAGE_TYPES } from '../src/classifier/classifier.js';
import { extractLinks } from '../src/crawler/links.js';
import { extractTextContent } from '../src/crawler/scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('classifies profile directory from URL and links', () => {
  const html = fixture('profile-directory.html');
  const url = 'https://www.lw.com/en/people';
  const { text } = extractTextContent(html);
  const links = extractLinks(html, url);
  const result = classifyPageHeuristic(url, html, text, links);

  assert.equal(result.type, PAGE_TYPES.PROFILE_DIRECTORY);
  assert.ok(result.confidence >= 0.8);
});

test('classifies award list page', () => {
  const html = fixture('list-page.html');
  const url = 'https://example.com/awards/2024';
  const { text } = extractTextContent(html);
  const links = extractLinks(html, url);
  const result = classifyPageHeuristic(url, html, text, links);

  assert.equal(result.type, PAGE_TYPES.LIST_PAGE);
});

test('classifies long-form article pages ahead of nav-heavy list heuristics', () => {
  const html = `
    <html>
      <body>
        <header><ul><li>News</li><li>Rankings</li><li>Awards</li></ul></header>
        <article>
          <h1>Attorney Client Privilege In India</h1>
          <p>By Jane Doe</p>
          <p>${'This is a long-form legal analysis discussing counsel privilege, in-house lawyers, and court reasoning. '.repeat(50)}</p>
        </article>
      </body>
    </html>
  `;
  const url = 'https://example.com/articles/privilege';
  const { text } = extractTextContent(html);
  const links = extractLinks(html, url);
  const result = classifyPageHeuristic(url, html, text, links);

  assert.equal(result.type, PAGE_TYPES.ARTICLE);
});
