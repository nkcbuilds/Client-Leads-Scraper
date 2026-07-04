const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;

export function findPhonesInText(text) {
  if (!text) return [];
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches.map((p) => p.trim()))].filter((p) => {
    const digits = p.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  });
}

export function findPhoneForPerson(pageText) {
  const phones = findPhonesInText(pageText);
  if (phones.length > 0) {
    return { phone: phones[0], source: 'page_text' };
  }
  return { phone: null, source: null };
}