import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildManualPageResult, detectBlockedPage, extractTextContent } from '../src/crawler/scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blocked = fs.readFileSync(path.join(__dirname, 'fixtures', 'blocked-page.html'), 'utf8');

test('detectBlockedPage identifies Cloudflare challenge', () => {
  const reason = detectBlockedPage(blocked, 'Just a moment...');
  assert.ok(reason);
});

test('detectBlockedPage does not false-positive on readable pages with challenge script', () => {
  const html = `
    <html>
      <head><title>Fortune India Legal Awards</title></head>
      <body>
        <main>
          <article>
            <h1>Fortune India Legal Excellence Awards & Lists 2025</h1>
            <p>This page contains a full event description, legal professionals, award coverage, and enough visible text to be a readable article page for extraction.</p>
            <p>Additional article copy continues here with meaningful content about general counsel, law firms, and legal excellence in India.</p>
            <p>More article text to ensure the visible-content threshold is exceeded for the blocked-page detector.</p>
          </article>
        </main>
        <script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>
      </body>
    </html>
  `;
  const reason = detectBlockedPage(html, 'Fortune India Legal Awards');
  assert.equal(reason, null);
});

test('extractTextContent strips scripts and nav', () => {
  const html = '<html><head><title>Test</title></head><body><nav>Menu</nav><p>Hello world content here for testing extraction pipeline with enough text.</p></body></html>';
  const { text, textLength } = extractTextContent(html);
  assert.ok(!text.includes('Menu'));
  assert.ok(textLength > 50);
});

test('buildManualPageResult supports pasted text imports', () => {
  const result = buildManualPageResult('https://example.com', {
    manualText: 'Jane Doe, Partner at Acme LLP, was recognized in the 2025 awards program for legal excellence.',
  });
  assert.equal(result.success, true);
  assert.ok(result.text.includes('Jane Doe'));
});
