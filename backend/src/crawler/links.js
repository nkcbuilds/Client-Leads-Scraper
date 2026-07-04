import * as cheerio from 'cheerio';

const PROFILE_PATH_PATTERNS = [
  /\/people\//i,
  /\/person\//i,
  /\/profile\//i,
  /\/profiles\//i,
  /\/attorney/i,
  /\/lawyer/i,
  /\/partner/i,
  /\/professional/i,
  /\/team\//i,
  /\/our-team\//i,
  /\/lawyers\//i,
  /\/attorneys\//i,
  /\/bio\//i,
  /\/member\//i,
  /\/en\/people\/[^/]+/i,
  /\/people\/[a-z0-9-]+/i,
];

const PROFILE_TEXT_PATTERNS = [
  /view\s+profile/i,
  /read\s+more/i,
  /learn\s+more/i,
];

const NON_PROFILE_PATH_PATTERNS = [
  /\/search(?:[/?#]|$)/i,
  /[?&](?:q|query|search)=/i,
];

const EXCLUDE_PATH_PATTERNS = [
  /\/contact/i,
  /\/about/i,
  /\/news/i,
  /\/blog/i,
  /\/careers/i,
  /\/privacy/i,
  /\/login/i,
  /\/signup/i,
  /\/terms/i,
  /\/advertising/i,
  /terms-of-use/i,
  /attorney-advertising/i,
  /disclaimer/i,
  /\/legal-notice/i,
  /\/cookie/i,
  /\.(pdf|jpg|png|gif|svg|css|js)$/i,
];

const NEXT_PAGE_PATTERNS = [
  /^(next|next page|older|more results)$/i,
  /^(»|›|→)$/i,
];

const DETAIL_LINK_PATTERNS = [
  /view\s+full\s+winners?/i,
  /award\s+winners?/i,
  /\bwinners?\b/i,
  /\bhonourees?\b/i,
  /\bpowerlist\b/i,
  /\bshortlist\b/i,
  /\bfinalists?\b/i,
];

const DETAIL_URL_PATTERNS = [
  /\/awards?\//i,
  /\/award-/i,
  /\/powerlist\//i,
  /\/winners?\//i,
  /\/honourees?\//i,
];

const DETAIL_EXCLUDE_TEXT_PATTERNS = [
  /\bnewsletter\b/i,
  /\bsubscribe\b/i,
  /\blogin\b/i,
  /\bsign in\b/i,
  /\bpodcast\b/i,
  /\brankings\b/i,
];

export function extractLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const links = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    try {
      const absolute = new URL(href, baseUrl).href;
      if (!absolute.startsWith('http')) return;
      if (seen.has(absolute)) return;
      seen.add(absolute);

      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const ariaLabel = $(el).attr('aria-label') || '';
      links.push({ url: absolute, text, ariaLabel });
    } catch {
      // skip invalid URLs
    }
  });

  return links;
}

export function isSameHost(url, baseUrl) {
  try {
    return new URL(url).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

export function findProfileLinks(links, baseUrl) {
  return links
    .filter((link) => isSameHost(link.url, baseUrl))
    .filter((link) => !EXCLUDE_PATH_PATTERNS.some((pattern) => pattern.test(link.url)))
    .filter((link) => !NON_PROFILE_PATH_PATTERNS.some((pattern) => pattern.test(link.url)))
    .filter((link) => {
      const pathMatch = PROFILE_PATH_PATTERNS.some((pattern) => pattern.test(link.url));
      const textMatch = PROFILE_TEXT_PATTERNS.some((pattern) => pattern.test(link.text));
      return pathMatch || textMatch;
    })
    .map((link) => link.url);
}

export function findPaginationLink(links, currentUrl) {
  const current = new URL(currentUrl);

  for (const link of links) {
    const combined = `${link.text} ${link.ariaLabel}`.replace(/\s+/g, ' ').trim();
    if (NEXT_PAGE_PATTERNS.some((pattern) => pattern.test(combined))) {
      if (link.url !== currentUrl) return link.url;
    }
  }

  const relNext = links.find((link) => link.ariaLabel?.toLowerCase() === 'next');
  if (relNext && relNext.url !== currentUrl) return relNext.url;

  const pageMatch = current.searchParams.get('page');
  const currentPage = pageMatch ? parseInt(pageMatch, 10) : 1;
  for (const link of links) {
    try {
      const url = new URL(link.url);
      const linkPage = url.searchParams.get('page');
      if (linkPage && parseInt(linkPage, 10) === currentPage + 1) {
        return link.url;
      }
    } catch {
      // skip
    }
  }

  return null;
}

export function findLeadDetailLinks(links, baseUrl) {
  return links
    .filter((link) => isSameHost(link.url, baseUrl))
    .filter((link) => !EXCLUDE_PATH_PATTERNS.some((pattern) => pattern.test(link.url)))
    .filter((link) => {
      const combined = `${link.text} ${link.ariaLabel}`.replace(/\s+/g, ' ').trim();

      if (DETAIL_EXCLUDE_TEXT_PATTERNS.some((pattern) => pattern.test(combined))) {
        return false;
      }

      return (
        DETAIL_LINK_PATTERNS.some((pattern) => pattern.test(combined)) ||
        DETAIL_URL_PATTERNS.some((pattern) => pattern.test(link.url))
      );
    })
    .map((link) => link.url);
}

export function dedupeUrls(urls) {
  return [...new Set(urls)];
}
