export const CONFIDENCE_LABELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNVERIFIED: 'UNVERIFIED',
};

export function scoreEnrichment({ email, emailStatus, domain, linkedin, phone, llmConfidence }) {
  let score = llmConfidence || 0.5;
  const signals = [];
  let evidenceCount = 0;

  if (domain?.source === 'extracted' || domain?.source === 'page_text' || domain?.source === 'source_site_matched') {
    score += 0.1;
    signals.push('domain');
    evidenceCount++;
  }

  if (emailStatus === 'found_public' || emailStatus === 'verified_mx') {
    score += 0.25;
    signals.push('email_verified');
    evidenceCount++;
  } else if (emailStatus === 'guessed_mx') {
    score += 0.05;
    signals.push('email_guess_mx');
    evidenceCount++;
  } else if (emailStatus === 'guessed') {
    score -= 0.15;
    signals.push('email_guessed');
  }

  if (linkedin?.source === 'page_text') {
    score += 0.15;
    signals.push('linkedin_direct');
    evidenceCount++;
  }

  if (phone?.phone) {
    score += 0.05;
    signals.push('phone');
    evidenceCount++;
  }

  if (evidenceCount === 0) {
    score = Math.min(score, 0.45);
  } else if (evidenceCount === 1 && emailStatus !== 'found_public' && emailStatus !== 'verified_mx') {
    score = Math.min(score, 0.65);
  }

  score = Math.max(0, Math.min(1, score));

  let label = CONFIDENCE_LABELS.UNVERIFIED;
  if (score >= 0.75 && (emailStatus === 'found_public' || emailStatus === 'verified_mx')) label = CONFIDENCE_LABELS.HIGH;
  else if (score >= 0.6 && evidenceCount >= 2) label = CONFIDENCE_LABELS.MEDIUM;
  else if (score >= 0.4) label = CONFIDENCE_LABELS.LOW;

  return { overall_confidence: Math.round(score * 100) / 100, confidence_label: label, signals };
}
