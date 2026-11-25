const { test } = require('node:test');
const assert = require('node:assert/strict');
const { safeFailureSummary, fetchWithReadResetRetry } = require('./ue-staging-request-safety.cjs');
const { parseDocumentLeaseUrl, DOCUMENT_DOWNLOAD_LEASE_MS } = require('./ue-staging-document-lease.cjs');

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

const leaseExpected = { origin: 'https://staging.example.invalid', organizationId: 'org-a', userId: 'actor-a', documentId: 'document-a' };
const leaseNow = 1800000000000;
function leaseUrl(changes = {}) {
  const payload = { version: 1, organizationId: leaseExpected.organizationId, userId: leaseExpected.userId,
    documentId: leaseExpected.documentId, versionId: null, fingerprint: 'a'.repeat(64),
    issuedAt: leaseNow, expiresAt: leaseNow + DOCUMENT_DOWNLOAD_LEASE_MS, ...changes };
  return '/api/documents/document-a/content?lease=v1.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + Buffer.alloc(32, 1).toString('base64url');
}

test('accepts only the same-origin actor-bound one-hour app lease contract', () => {
  const parsed = parseDocumentLeaseUrl(leaseUrl(), leaseExpected, { now: leaseNow });
  assert.equal(parsed.url.href, leaseExpected.origin + leaseUrl());
  assert.equal(parsed.expiresAtMs, leaseNow + DOCUMENT_DOWNLOAD_LEASE_MS);
  assert.equal(parsed.payload.versionId, null);
  assert.equal(parseDocumentLeaseUrl(leaseUrl({ versionId: 'version-2' }), leaseExpected, { now: leaseNow }).payload.versionId, 'version-2');
  assert.equal(parseDocumentLeaseUrl(parsed.url.href, leaseExpected, { now: leaseNow, allowAbsolute: true }).url.href, parsed.url.href);
});

test('refuses blob/SAS, foreign-origin, path, credential, query and normalized alternatives without disclosing the URL', () => {
  const original = leaseUrl();
  for (const value of [
    'https://storage.example.invalid/container/blob?sig=opaque-owned-secret',
    leaseExpected.origin + original,
    '//other.example.invalid' + original,
    original.replace('/document-a/', '/document-b/'), original + '&extra=1', original + '#fragment',
    original + '&lease=duplicate-owned-secret', original.replace('?lease=v1.', '?lease=v1%2E'),
    '/api/other/../documents/document-a/content' + original.slice(original.indexOf('?')),
  ]) {
    assert.throws(() => parseDocumentLeaseUrl(value, leaseExpected, { now: leaseNow }), error =>
      error.message === 'DOCUMENT_LEASE_URL_CONTRACT_REFUSED' && !error.message.includes('opaque-owned-secret'));
  }
  assert.throws(() => parseDocumentLeaseUrl('https://owned:secret@staging.example.invalid' + original, leaseExpected, { now: leaseNow, allowAbsolute: true }));
});

test('refuses altered binding, payload shape, version, fingerprint, bounds and renewed expiry', () => {
  for (const changes of [
    { organizationId: 'org-b' }, { userId: 'actor-b' }, { documentId: 'document-b' }, { version: 2 },
    { versionId: 'unsafe/path' }, { versionId: 12 }, { fingerprint: 'invalid' }, { issuedAt: leaseNow + 1 },
    { expiresAt: leaseNow + DOCUMENT_DOWNLOAD_LEASE_MS + 1 }, { extra: 'not-permitted' },
  ]) assert.throws(() => parseDocumentLeaseUrl(leaseUrl(changes), leaseExpected, { now: leaseNow }));
  const url = leaseUrl();
  assert.throws(() => parseDocumentLeaseUrl(url.replace(/.$/, '='), leaseExpected, { now: leaseNow }));
  assert.throws(() => parseDocumentLeaseUrl(url.replace('?lease=v1.', '?lease=v2.'), leaseExpected, { now: leaseNow }));
  assert.throws(() => parseDocumentLeaseUrl('/api/' + 'a'.repeat(9000), leaseExpected, { now: leaseNow }));
});

test('retains the original expiry exactly, requiring an explicit expired-proof inspection', () => {
  const original = leaseUrl();
  assert.throws(() => parseDocumentLeaseUrl(original, leaseExpected, { now: leaseNow + DOCUMENT_DOWNLOAD_LEASE_MS }));
  const expired = parseDocumentLeaseUrl(original, leaseExpected, { now: leaseNow + DOCUMENT_DOWNLOAD_LEASE_MS + 4000, allowExpired: true });
  assert.equal(expired.url.href, leaseExpected.origin + original);
  assert.equal(expired.expiresAtMs, leaseNow + DOCUMENT_DOWNLOAD_LEASE_MS);
});
