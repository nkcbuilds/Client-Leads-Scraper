export function cleanText(text) {
  if (!text) return '';

  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\|\s*\|/g, '|')
    .replace(/(Cookie|Privacy Policy|Terms of Use|Subscribe|Sign up|Log in)/gi, '')
    .trim();
}