const GARBAGE_NAME_PATTERNS = [
  /facet/i,
  /searchloading/i,
  /search/i,
  /loading/i,
  /expand/i,
  /clearexpand/i,
  /dropdown/i,
  /filter/i,
  /checkbox/i,
  /\(\d+\)/,
  /university\(\d+\)/i,
  /college of law\(\d+\)/i,
];

const GARBAGE_FIELD_PATTERNS = [
  /facet/i,
  /searchloading/i,
  /\(\d{2,}\)/,
  /automotive\(\d+\)/i,
  /aerospace/i,
];

export function normalizeName(name) {
  if (!name) return '';
  return name.replace(/\s+/g, ' ').trim();
}

export function isGarbageName(name) {
  const normalized = normalizeName(name);
  if (!normalized || normalized.length < 3) return true;
  if (GARBAGE_NAME_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  if (/^[A-Z]{6,}$/.test(normalized.replace(/\s/g, ''))) return true;
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length === 1 && normalized.length > 20) return true;
  if (parts.some((part) => part.length > 25)) return true;
  return false;
}

export function isGarbageField(value) {
  if (!value) return false;
  return GARBAGE_FIELD_PATTERNS.some((pattern) => pattern.test(String(value)));
}

export function splitName(fullName) {
  const parts = normalizeName(fullName).split(' ');
  if (parts.length < 2) {
    return { first_name: parts[0] || '', last_name: '' };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  };
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export function validatePerson(record) {
  const errors = [];

  if (!record.name || normalizeName(record.name).length < 2) {
    errors.push('Missing or invalid name');
  }

  if (isGarbageName(record.name)) {
    errors.push('Name looks like UI/page noise');
  }

  if (isGarbageField(record.title) || isGarbageField(record.company)) {
    errors.push('Title or company looks like UI/page noise');
  }

  if (!record.title && !record.company) {
    errors.push('Requires at least title or company');
  }

  if (record.confidence !== undefined && record.confidence < 0.35) {
    errors.push('Confidence too low');
  }

  return { valid: errors.length === 0, errors };
}

export function normalizePerson(record, sourceUrl, sourceSite) {
  const name = normalizeName(record.name);
  const { first_name, last_name } = splitName(name);
  const title = normalizeOptionalText(record.title);
  const company = normalizeOptionalText(record.company);
  const bio = normalizeOptionalText(record.bio);

  return {
    name,
    first_name,
    last_name,
    title,
    company,
    company_domain: normalizeOptionalText(record.company_domain),
    source_site: sourceSite,
    source_url: sourceUrl,
    award_name: normalizeOptionalText(record.award_name),
    award_year: normalizeOptionalText(record.award_year),
    bio,
    raw_snippet: bio || `${name} - ${title || ''} at ${company || ''}`.trim(),
    llm_confidence: record.confidence ?? 0.5,
  };
}

export function filterValidPeople(records, sourceUrl, sourceSite) {
  const valid = [];
  const seen = new Set();

  for (const record of records) {
    const { valid: isValid } = validatePerson(record);
    if (!isValid) continue;

    const normalized = normalizePerson(record, sourceUrl, sourceSite);
    const key = `${normalized.name.toLowerCase()}|${(normalized.company || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    valid.push(normalized);
  }

  return valid;
}
