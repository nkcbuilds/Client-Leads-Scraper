import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, isRetryableError } from '../src/utils/retry.js';

test('isRetryableError detects timeout messages', () => {
  assert.equal(isRetryableError(new Error('Navigation timeout exceeded')), true);
  assert.equal(isRetryableError(new Error('invalid selector')), false);
});

test('withRetry succeeds after transient failures', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls < 3) throw Object.assign(new Error('timeout'), { status: 503 });
    return 'ok';
  }, { maxAttempts: 3, baseDelayMs: 10 });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});