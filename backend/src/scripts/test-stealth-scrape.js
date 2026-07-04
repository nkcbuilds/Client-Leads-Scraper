import '../utils/env.js';
import { scrapePage } from '../crawler/scraper.js';
import { closeBrowser, getBrowserLaunchMode } from '../crawler/browser.js';

const url = process.argv[2] || 'https://www.lw.com/en/people';

async function main() {
  console.log(`Stealth scrape test: ${url}`);
  console.log(`Browser mode: ${getBrowserLaunchMode() || 'not launched yet'}`);

  const result = await scrapePage(url, { timeoutMs: 60000, scroll: false });

  console.log('\n--- Result ---');
  console.log(JSON.stringify({
    success: result.success,
    blocked: result.blocked,
    blockReason: result.blockReason,
    method: result.method,
    title: result.title,
    textLength: result.textLength,
    statusCode: result.statusCode,
    error: result.error,
    sample: result.text?.slice(0, 200),
  }, null, 2));

  await closeBrowser();
  process.exit(result.success ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await closeBrowser().catch(() => {});
  process.exit(1);
});