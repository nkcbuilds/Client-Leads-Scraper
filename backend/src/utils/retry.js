import { logger } from './logger.js';

export function isRetryableError(err) {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status;
  return (
    status === 429 ||
    status === 503 ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('net::err') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up')
  );
}

export async function withRetry(fn, {
  maxAttempts = 3,
  baseDelayMs = 1000,
  maxDelayMs = 8000,
  label = 'operation',
} = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const retryable = isRetryableError(err);
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      logger.warn(`${label} failed, retrying`, {
        attempt,
        maxAttempts,
        delayMs: delay,
        error: err.message?.slice(0, 120),
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}