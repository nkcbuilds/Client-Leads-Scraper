import * as cheerio from 'cheerio';
import { findProfileLinks, findPaginationLink } from '../crawler/links.js';
import { classifyWithGemini } from '../llm/gemini.js';
import { getSetting } from '../db/settings.js';

export const PAGE_TYPES = {
  PROFILE_DIRECTORY: 'profile_directory',
  LIST_PAGE: 'list_page',
  ARTICLE: 'article',
  SEARCH_RESULTS: 'search_results',
  UNKNOWN: 'unknown',
};

const DIRECTORY_URL_PATTERNS = [
  /\/people\/?$/i,
  /\/people\//i,
  /\/professionals\/?$/i,
  /\/professionals\//i,
  /\/attorneys\/?$/i,
  /\/lawyers\/?$/i,
  /\/our-team\/?$/i,
  /\/team\/?$/i,
];

export function classifyPageHeuristic(url, html, text, links) {
  const urlLower = url.toLowerCase();
  const textLower = (text || '').toLowerCase();
  const profileLinks = findProfileLinks(links, url);
  const hasPagination = !!findPaginationLink(links, url);
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header').remove();
  const contentHtml = $('main, article, body').first().html() || html;
  const contentListItems = (contentHtml.match(/<li/gi) || []).length;
  const articleText = $('article, main').text().replace(/\s+/g, ' ').trim();
  const proseWordCount = (articleText || text).split(/\s+/).filter(Boolean).length;
  const hasArticleTag = $('article').length > 0;
  const hasByline = /(^|\s)(by|contributor)\s+[A-Z][a-z]+/.test(text);

  if (DIRECTORY_URL_PATTERNS.some((p) => p.test(url))) {
    return {
      type: PAGE_TYPES.PROFILE_DIRECTORY,
      confidence: 0.9,
      reason: 'URL path indicates a people/professionals directory',
      profileLinks: profileLinks.slice(0, 50),
    };
  }

  if (urlLower.includes('search') || urlLower.includes('?q=') || urlLower.includes('query=')) {
    return { type: PAGE_TYPES.SEARCH_RESULTS, confidence: 0.75, reason: 'URL suggests search results' };
  }

  if (profileLinks.length >= 5) {
    return {
      type: PAGE_TYPES.PROFILE_DIRECTORY,
      confidence: 0.85,
      reason: `Found ${profileLinks.length} profile-like links`,
      profileLinks: profileLinks.slice(0, 50),
    };
  }

  const hasTable = contentHtml.includes('<table') && (contentHtml.match(/<tr/gi) || []).length > 3;
  const hasAwardKeywords = /award|ranking|recognized|honoree|winner|leading|best lawyers/i.test(textLower);
  const hasListStructure = contentListItems > 15;

  if (
    (hasArticleTag || hasByline || /article|commentary|editorial|analysis/i.test(text)) &&
    proseWordCount > 250 &&
    profileLinks.length < 5
  ) {
    return { type: PAGE_TYPES.ARTICLE, confidence: 0.82, reason: 'Long-form article content with prose signals' };
  }

  if ((hasTable || hasListStructure) && (hasAwardKeywords || hasPagination)) {
    return {
      type: PAGE_TYPES.LIST_PAGE,
      confidence: 0.78,
      reason: 'List/table structure with award or pagination signals',
      hasPagination,
    };
  }

  if (text.length > 2000 && profileLinks.length < 3) {
    const articleSignals = /article|commentary|editorial|analysis|by\s+[A-Z][a-z]+/i.test(text);
    if (articleSignals || text.split(' ').length > 400) {
      return { type: PAGE_TYPES.ARTICLE, confidence: 0.7, reason: 'Long-form prose content' };
    }
  }

  if (profileLinks.length >= 2) {
    return {
      type: PAGE_TYPES.PROFILE_DIRECTORY,
      confidence: 0.6,
      reason: `Found ${profileLinks.length} profile-like links`,
      profileLinks: profileLinks.slice(0, 50),
    };
  }

  if (hasPagination || hasListStructure) {
    return { type: PAGE_TYPES.LIST_PAGE, confidence: 0.55, reason: 'List structure detected', hasPagination };
  }

  return { type: PAGE_TYPES.UNKNOWN, confidence: 0.3, reason: 'No strong signals' };
}

export async function classifyPage(url, html, text, links) {
  const heuristic = classifyPageHeuristic(url, html, text, links);

  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    try {
      apiKey = getSetting('gemini_api_key');
    } catch {
      apiKey = null;
    }
  }
  if (!apiKey || heuristic.confidence >= 0.85) {
    return { ...heuristic, method: 'heuristic' };
  }

  try {
    const snippet = text.slice(0, 3000);
    const llmResult = await classifyWithGemini(url, snippet, links.slice(0, 20));
    return { ...llmResult, method: 'gemini', heuristicFallback: heuristic };
  } catch {
    return { ...heuristic, method: 'heuristic_fallback' };
  }
}
