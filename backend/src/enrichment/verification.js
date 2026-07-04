import dns from 'dns/promises';

const mxCache = new Map();

async function resolveMx(domain) {
  if (!domain) return false;
  if (mxCache.has(domain)) return mxCache.get(domain);

  try {
    const records = await dns.resolveMx(domain);
    const result = Array.isArray(records) && records.length > 0;
    mxCache.set(domain, result);
    return result;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

export async function verifyEnrichment({ domain, email, linkedin }) {
  const verifiedDomain = domain?.domain || (email?.email ? email.email.split('@')[1] : null);
  const hasMx = await resolveMx(verifiedDomain);

  const nextDomain = {
    ...domain,
    mx_verified: hasMx,
  };

  let nextEmail = { ...email };
  if (email?.email) {
    if (email.status === 'found_public' && hasMx) {
      nextEmail = { ...nextEmail, status: 'verified_mx', source: `${email.source || 'page_text'}+mx` };
    } else if (email.status === 'guessed' && hasMx) {
      nextEmail = { ...nextEmail, status: 'guessed_mx', source: `${email.source || 'pattern'}+mx` };
    }
  }

  return {
    domain: nextDomain,
    email: nextEmail,
    linkedin,
  };
}
