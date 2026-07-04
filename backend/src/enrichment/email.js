const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const COMMON_PATTERNS = [
  (f, l, d) => `${f}.${l}@${d}`,
  (f, l, d) => `${f}${l}@${d}`,
  (f, l, d) => `${f[0]}${l}@${d}`,
  (f, l, d) => `${f}@${d}`,
  (f, l, d) => `${l}@${d}`,
];

export function findEmailsInText(text) {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

export function findEmailForPerson(person, pageText, domain) {
  const emails = findEmailsInText(pageText);
  const nameParts = (person.name || '').toLowerCase().split(' ');
  const first = (person.first_name || nameParts[0] || '').toLowerCase().replace(/[^a-z]/g, '');
  const last = (person.last_name || nameParts.slice(1).join(' ') || '').toLowerCase().replace(/[^a-z]/g, '');

  for (const email of emails) {
    const local = email.split('@')[0].toLowerCase();
    if (!first || !last || first.length < 2 || last.length < 2) continue;

    const candidates = [
      `${first}.${last}`,
      `${first}${last}`,
      `${first[0]}${last}`,
      `${first}.${last[0]}`,
      `${first}_${last}`,
    ];

    if (candidates.some((c) => local === c || local.startsWith(c + '.') || local.startsWith(c + '_'))) {
      return { email, status: 'found_public', source: 'page_text', pattern: null };
    }
  }

  if (!domain || !['extracted', 'page_text', 'source_site_matched'].includes(domain.source)) {
    return { email: null, status: null, source: null, pattern: null };
  }

  const domainName = domain.domain;
  for (const build of COMMON_PATTERNS) {
    if (!first || !last) continue;
    const candidate = build(first, last, domainName);
    return {
      email: candidate,
      status: 'guessed',
      source: 'pattern',
      pattern: candidate,
    };
  }

  return { email: null, status: null, source: null, pattern: null };
}
