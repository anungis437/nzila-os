const { test } = require('node:test');
const assert = require('node:assert/strict');
const { safeFailureSummary, fetchWithReadResetRetry } = require('./ue-staging-request-safety.cjs');

test('omits the credential-bearing Playwright call log from persisted failures', () => {
  const error = new Error('apiRequestContext.fetch: socket hang up\nCall log:\n - cookie: owned-test-session-cookie\n - authorization: Bearer owned-test-token');
  const result = safeFailureSummary(error);
  assert.equal(result.message, 'apiRequestContext.fetch: socket hang up');
  assert.equal(result.requestDetailsOmitted, true);
  assert(!JSON.stringify(result).includes('owned-test-'));
});

test('removes URL credentials, queries, fragments and inline credential fields', () => {
  const result = safeFailureSummary(new Error('Navigation failed at https://owned:password@example.invalid/callback?code=owned-code#owned-fragment'));
  assert.equal(result.message, 'Navigation failed at https://example.invalid/callback');
  assert.equal(safeFailureSummary(new Error('Cookie: owned-session')).message, 'Cookie=[redacted]');
  assert.equal(safeFailureSummary(new Error('Authorization: Bearer owned-token')).message, 'Authorization=[redacted]');
});

test('retries a read connection reset with the same context and records a safe observation', async () => {
  const observations = []; let calls = 0;
  const response = { status: () => 403 };
  const context = { fetch: async () => {
    if (++calls === 1) throw new Error('apiRequestContext.fetch: socket hang up\n - cookie: owned-secret');
    return response;
  } };
  assert.equal(await fetchWithReadResetRetry(context, 'https://example.invalid/api/private', { method: 'GET' }, x => observations.push(x)), response);
  assert.equal(calls, 2); assert.equal(observations.length, 1);
  assert.equal(observations[0].retry, 1);
  assert(!JSON.stringify(observations).includes('owned-secret'));
});

test('bounds reset retries and never replays writes', async () => {
  for (const [method, expected] of [['GET', 3], ['HEAD', 3], ['POST', 1], ['PATCH', 1], ['DELETE', 1]]) {
    let calls = 0;
    await assert.rejects(fetchWithReadResetRetry({ fetch: async () => { calls++; throw Object.assign(new Error('reset'), { code: 'ECONNRESET' }); } }, 'https://example.invalid/api/case', { method }), /reset/);
    assert.equal(calls, expected, method);
  }
});

test('does not retry HTTP denial/error responses or unrelated network failures', async () => {
  for (const status of [401, 403, 404, 500, 503]) {
    let calls = 0; const response = { status: () => status };
    assert.equal(await fetchWithReadResetRetry({ fetch: async () => { calls++; return response; } }, 'https://example.invalid/api/private', { method: 'GET' }), response);
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(fetchWithReadResetRetry({ fetch: async () => { calls++; throw new Error('Timeout 30000ms exceeded'); } }, 'https://example.invalid/api/private', { method: 'GET' }), /Timeout/);
  assert.equal(calls, 1);
});
