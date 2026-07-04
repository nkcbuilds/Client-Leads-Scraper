import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSetting } from '../db/settings.js';
import { logger } from '../utils/logger.js';
import { throttleGemini, parseRetryAfterMs } from './rateLimiter.js';

function resolveApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    return getSetting('gemini_api_key') || null;
  } catch {
    return null;
  }
}

function getClient() {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODELS = ['gemini-2.5-flash-lite'];

function getModelCandidates() {
  const preferred = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const extraFallbacks = (process.env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fallbacks = extraFallbacks.length > 0 ? extraFallbacks : FALLBACK_MODELS;
  if (process.env.GEMINI_FALLBACK_MODELS === '') {
    return [preferred];
  }
  return [preferred, ...fallbacks.filter((m) => m !== preferred)];
}

function retryDelayMs(attempt) {
  return Math.min(1000 * 2 ** attempt, 8000);
}

async function generateWithFallback(prompt) {
  const genAI = getClient();
  const candidates = getModelCandidates();
  let lastError = null;
  const maxRetries = 3;

  for (const modelName of candidates) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await throttleGemini();
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const retryable = err.status === 503 || err.status === 429;
        if (retryable && attempt < maxRetries - 1) {
          const retryAfter = parseRetryAfterMs(err);
          const wait = retryAfter || retryDelayMs(attempt);
          logger.warn('Gemini transient error, retrying', {
            model: modelName,
            status: err.status,
            attempt: attempt + 1,
            waitMs: wait,
          });
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (err.status === 429) {
          logger.warn('Gemini rate limited, stopping fallbacks', { model: modelName });
          throw err;
        }
        logger.warn('Gemini model failed, trying fallback', {
          model: modelName,
          status: err.status,
          error: err.message?.slice(0, 120),
        });
        break;
      }
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }
    throw new SyntaxError(`No JSON object in response: ${cleaned.slice(0, 120)}`);
  }
}

async function generateJsonWithFallback(prompt) {
  const strictSuffix =
    '\n\nIMPORTANT: Reply with ONLY a single valid JSON object. No markdown, no code fences, no explanation.';
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const fullPrompt = attempt === 0 ? prompt : `${prompt}${strictSuffix}`;
    try {
      const text = await generateWithFallback(fullPrompt);
      return parseJsonResponse(text);
    } catch (err) {
      lastError = err;
      if (err instanceof SyntaxError && attempt < 2) {
        logger.warn('Gemini returned invalid JSON, retrying', {
          attempt: attempt + 1,
          preview: err.message?.slice(0, 80),
        });
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Failed to get valid JSON from Gemini');
}

export async function classifyWithGemini(url, textSnippet, sampleLinks) {
  const linkSample = sampleLinks.map((l) => l.url).join('\n');

  const prompt = `Classify this legal/professional web page into exactly one type.

URL: ${url}

Page text sample:
${textSnippet}

Sample links on page:
${linkSample}

Return JSON only:
{
  "type": "profile_directory" | "list_page" | "article" | "search_results" | "unknown",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

  return generateJsonWithFallback(prompt);
}

export async function extractPeopleWithGemini(text, sourceUrl) {
  const prompt = `Extract all legal professionals (lawyers, attorneys, partners, counsel, in-house lawyers) mentioned on this page.

Source URL: ${sourceUrl}

Page text:
${text}

Return JSON only:
{
  "people": [
    {
      "name": "Full Name",
      "title": "Job title or role",
      "company": "Firm or company name",
      "company_domain": "company.com or null",
      "award_name": "Award name if mentioned or null",
      "award_year": "Year if mentioned or null",
      "bio": "Short bio snippet or null",
      "confidence": 0.0-1.0
    }
  ]
}

Rules:
- Only include real people with names, not companies or publications
- Require a name and at least one of title or company
- Use null for unknown fields
- confidence reflects how certain you are this is a real professional record`;

  const parsed = await generateJsonWithFallback(prompt);
  return parsed.people || [];
}

export function isGeminiConfigured() {
  return !!resolveApiKey();
}