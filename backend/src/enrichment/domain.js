export function extractDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const URL_REGEX = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:\/|$)/gi;
const GENERIC_COMPANY_WORDS = new Set([
  'law',
  'legal',
  'partners',
  'partner',
  'group',
  'company',
  'co',
  'counsel',
  'associates',
  'associate',
  'firms',
  'firm',
]);

function normalizeCompanyKey(company) {
  return (company || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(llp|llc|ltd|inc|plc|pc|pa|law firm|lawyers|attorneys)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCompanyTokens(company) {
  return normalizeCompanyKey(company)
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .filter((word) => !GENERIC_COMPANY_WORDS.has(word));
}

function getCompanyInitials(company) {
  return getCompanyTokens(company)
    .map((word) => word[0])
    .join('');
}

function extractPageDomains(text) {
  if (!text) return [];

  const domains = new Set();
  let match;

  while ((match = EMAIL_REGEX.exec(text)) !== null) {
    domains.add(match[1].toLowerCase());
  }

  while ((match = URL_REGEX.exec(text)) !== null) {
    domains.add(match[1].toLowerCase().replace(/^www\./, ''));
  }

  return [...domains];
}

function domainStem(domain) {
  return (domain || '')
    .replace(/^www\./, '')
    .split('.')
    .slice(0, -1)
    .join('.')
    .replace(/[^a-z0-9]/g, '');
}

function matchesCompany(domain, company) {
  const stem = domainStem(domain);
  if (!stem) return false;

  const companyKey = normalizeCompanyKey(company).replace(/\s+/g, '');
  const tokens = getCompanyTokens(company);
  const initials = getCompanyInitials(company);
  const genericStem = GENERIC_COMPANY_WORDS.has(stem);

  if (!companyKey) return false;
  if (tokens.some((token) => token.length >= 4 && stem.includes(token))) return true;
  if (initials.length >= 2 && stem === initials.toLowerCase()) return true;
  if (!genericStem && stem.length >= 4 && (companyKey.includes(stem) || stem.includes(companyKey.slice(0, Math.min(companyKey.length, 8))))) {
    return true;
  }

  return false;
}

export function inferDomain(person, sourceUrl, pageText = '') {
  if (person.company_domain) return { domain: person.company_domain, source: 'extracted' };

  const sourceDomain = extractDomainFromUrl(sourceUrl);
  const pageDomains = extractPageDomains(pageText);

  for (const candidate of pageDomains) {
    if (matchesCompany(candidate, person.company)) {
      return { domain: candidate, source: 'page_text' };
    }
  }

  if (sourceDomain && matchesCompany(sourceDomain, person.company)) {
    return { domain: sourceDomain, source: 'source_site_matched' };
  }

  return { domain: null, source: null };
}
