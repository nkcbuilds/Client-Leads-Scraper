let lastCallAt = 0;
const MIN_INTERVAL_MS = parseInt(process.env.GEMINI_MIN_INTERVAL_MS || '3000', 10);

export async function throttleGemini() {
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastCallAt = Date.now();
}

export function parseRetryAfterMs(error) {
  const match = error?.message?.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000);
  return null;
}