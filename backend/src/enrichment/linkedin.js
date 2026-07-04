const LINKEDIN_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/gi;

export function findLinkedInInText(text) {
  if (!text) return null;
  const match = text.match(LINKEDIN_REGEX);
  return match ? match[0].replace(/\/$/, '') : null;
}

export function buildLinkedInSearchUrl(name, company) {
  const query = encodeURIComponent(`${name} ${company || ''}`.trim());
  return `https://www.linkedin.com/search/results/people/?keywords=${query}`;
}

export function findLinkedInForPerson(person, pageText) {
  const direct = findLinkedInInText(pageText);
  if (direct) {
    return { url: direct, source: 'page_text' };
  }

  return { url: null, source: null };
}
