function normalizeKey(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name) {
  return normalizeKey(name);
}

function normalizeCompany(company) {
  return normalizeKey(company)
    .replace(/\b(llp|llc|ltd|inc|plc|pc|pa)\b/g, '')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(na, nb) / maxLen;
}

function pickStronger(existing, candidate, field) {
  const e = existing[field];
  const c = candidate[field];
  if (!e) return c;
  if (!c) return e;
  if (field === 'llm_confidence') return c > e ? c : e;
  return String(c).length > String(e).length ? c : e;
}

function mergeRecords(existing, candidate) {
  const fields = [
    'name', 'first_name', 'last_name', 'title', 'company', 'company_domain',
    'award_name', 'award_year', 'bio', 'raw_snippet', 'llm_confidence',
  ];

  const merged = { ...existing };
  for (const field of fields) {
    merged[field] = pickStronger(existing, candidate, field);
  }

  merged.source_url = [existing.source_url, candidate.source_url]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' | ');

  merged.source_site = [existing.source_site, candidate.source_site]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' | ');

  merged._mergedFrom = (existing._mergedFrom || 1) + 1;
  return merged;
}

export function deduplicatePeople(people, { fuzzyThreshold = 0.85 } = {}) {
  const unique = [];
  const reviewQueue = [];

  for (const person of people) {
    let merged = false;

    for (let i = 0; i < unique.length; i++) {
      const existing = unique[i];
      const nameA = normalizeName(person.name);
      const nameB = normalizeName(existing.name);
      const companyA = normalizeCompany(person.company);
      const companyB = normalizeCompany(existing.company);
      const domainA = person.company_domain || '';
      const domainB = existing.company_domain || '';

      const exactMatch =
        nameA === nameB &&
        (companyA === companyB || (domainA && domainA === domainB));

      const fuzzyMatch =
        nameSimilarity(person.name, existing.name) >= fuzzyThreshold &&
        (companyA === companyB || (domainA && domainA === domainB));

      if (exactMatch || fuzzyMatch) {
        unique[i] = mergeRecords(existing, person);
        merged = true;
        break;
      }

      const similarity = nameSimilarity(person.name, existing.name);
      if (similarity >= 0.7 && similarity < fuzzyThreshold && companyA === companyB) {
        reviewQueue.push({ person, similarTo: existing.name, similarity });
      }
    }

    if (!merged) {
      unique.push({ ...person });
    }
  }

  return { unique, reviewQueue, removed: people.length - unique.length };
}