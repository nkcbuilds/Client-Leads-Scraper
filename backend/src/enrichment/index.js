import { inferDomain } from './domain.js';
import { findEmailForPerson } from './email.js';
import { findLinkedInForPerson } from './linkedin.js';
import { findPhoneForPerson } from './phone.js';
import { scoreEnrichment } from './scorer.js';
import { verifyEnrichment } from './verification.js';

export async function enrichPerson(person, pageText = '') {
  const domain = inferDomain(person, person.source_url, pageText);
  const email = findEmailForPerson(person, pageText, domain);
  const linkedin = findLinkedInForPerson(person, pageText);
  const phone = findPhoneForPerson(pageText);
  const verified = await verifyEnrichment({ domain, email, linkedin });
  const scoring = scoreEnrichment({
    email: verified.email.email,
    emailStatus: verified.email.status,
    domain: verified.domain,
    linkedin: verified.linkedin,
    phone,
    llmConfidence: person.llm_confidence,
  });

  return {
    person_id: person.id,
    email: verified.email.email,
    email_status: verified.email.status,
    email_source: verified.email.source,
    email_pattern: verified.email.pattern,
    phone: phone.phone,
    phone_source: phone.source,
    linkedin_url: verified.linkedin.url,
    linkedin_source: verified.linkedin.source,
    company_domain: verified.domain.domain,
    domain_source: verified.domain.mx_verified ? `${verified.domain.source || 'unknown'}+mx` : verified.domain.source,
    overall_confidence: scoring.overall_confidence,
    confidence_label: scoring.confidence_label,
  };
}

export async function enrichPeople(people, pageTextMap = {}) {
  return Promise.all(people.map(async (person) => {
    const text = pageTextMap[person.source_url] || person.raw_snippet || person.bio || '';
    return enrichPerson(person, text);
  }));
}
