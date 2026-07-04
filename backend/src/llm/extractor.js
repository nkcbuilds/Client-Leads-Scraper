import { cleanText } from './cleaner.js';
import { chunkText } from './chunker.js';
import { extractPeopleWithGemini, isGeminiConfigured } from './gemini.js';
import { filterValidPeople } from './validator.js';
import { logger } from '../utils/logger.js';

function extractSourceSite(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function fallbackExtract(text, sourceUrl) {
  const sourceSite = extractSourceSite(sourceUrl);
  const people = [];

  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),?\s+(Partner|Associate|Counsel|Attorney|Lawyer|Director|General Counsel)\s+(?:at|of)\s+([^.,\n]+)/g,
    /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+),?\s+([A-Z][^,]{5,40}),\s+([A-Z][^.,\n]{3,60})/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      people.push({
        name: match[1].trim(),
        title: match[2].trim(),
        company: match[3].trim(),
        confidence: 0.35,
      });
    }
  }

  return filterValidPeople(people, sourceUrl, sourceSite);
}

export async function extractPeopleFromPage(text, sourceUrl, { pageType } = {}) {
  const cleaned = cleanText(text);
  if (cleaned.length < 50) {
    return { people: [], warnings: ['Page text too short for extraction'] };
  }

  const sourceSite = extractSourceSite(sourceUrl);
  const chunks = chunkText(cleaned);
  const allRecords = [];
  const warnings = [];

  const allowFallback = pageType !== 'profile_directory';

  if (!isGeminiConfigured()) {
    if (!allowFallback) {
      warnings.push('GEMINI_API_KEY not configured — pattern fallback disabled for directory pages');
      return { people: [], warnings, method: 'none' };
    }
    warnings.push('GEMINI_API_KEY not configured — using basic pattern fallback');
    const fallback = fallbackExtract(cleaned, sourceUrl);
    return { people: fallback, warnings, method: 'fallback' };
  }

  let rateLimited = false;

  for (const chunk of chunks) {
    try {
      const extracted = await extractPeopleWithGemini(chunk, sourceUrl);
      allRecords.push(...extracted);
    } catch (err) {
      logger.warn('Chunk extraction failed', { sourceUrl, error: err.message });
      if (err.status === 429) {
        rateLimited = true;
        warnings.push(
          allowFallback
            ? 'Gemini rate limit hit — using pattern fallback for this page'
            : 'Gemini rate limit hit — extraction paused (fallback disabled for directory pages)',
        );
        break;
      }
      warnings.push(`Extraction error: ${err.message?.slice(0, 200)}`);
    }
  }

  if (rateLimited && allRecords.length === 0) {
    if (allowFallback) {
      const fallback = fallbackExtract(cleaned, sourceUrl);
      return { people: fallback, warnings, method: 'fallback_rate_limited' };
    }
    return { people: [], warnings, method: 'rate_limited' };
  }

  const valid = filterValidPeople(allRecords, sourceUrl, sourceSite);
  return { people: valid, warnings, method: 'gemini' };
}