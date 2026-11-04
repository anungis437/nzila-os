import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createProofSignature } from '@/lib/staging-proof/deadline-engine-auth';

// The deadline-engine staging proof is retired (see the route): it authenticates exactly as it did, answers 501 to an authorized caller, and touches nothing.

async function loadRoute() {
  return import('../staging-proof/deadline-engine/scenario/route');
}

const secret = '7c41e0a95d2b83f6190ae4c7b58d3f2a6e1d09b47c5a8f23';
const nonce = 'proof_nonce_01234567890123456789';

function request(body: unknown, overrides: Record<string, string> = {}) {
  const timestamp = new Date().toISOString();
  return new NextRequest('http://localhost/api/staging-proof/deadline-engine/scenario', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-staging-proof-timestamp': timestamp,
      'x-staging-proof-nonce': nonce,
      'x-staging-proof-signature': createProofSignature(secret, timestamp, nonce, 'schedule-basic'),
      ...overrides,
    },
    body: JSON.stringify(body),
  });
}

function malformedRequest() {
  return new NextRequest('http://localhost/api/staging-proof/deadline-engine/scenario', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
}

describe('deadline-engine staging proof route (retired)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = 'staging';
    process.env.TARGET_ENVIRONMENT = 'staging';
    process.env.STAGING_PROOFS_ENABLED = 'true';
    process.env.UNION_EYES_RUNTIME_ID = 'union-eyes-staging';
    process.env.STAGING_PROOF_SECRET = secret;
  });

  it('answers 501, and says why, to a caller authorized for staging with a valid signature', async () => {
    const { POST } = await loadRoute();

    const response = await POST(request({ scenario: 'schedule-basic' }));

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({ error: 'not_implemented', reason: expect.stringContaining('retired') });
  });

  it.each([
    ['pilot', 'union-eyes-pilot'],
    ['production', 'union-eyes-production'],
    ['unknown runtime', 'unknown'],
  ])('conceals the route outside authorized staging (%s)', async (_name, runtimeId) => {
    const { POST } = await loadRoute();
    process.env.UNION_EYES_RUNTIME_ID = runtimeId;

    const response = await POST(request({ scenario: 'schedule-basic' }));

    expect(response.status).toBe(404);
  });

  it.each([
    ['built for production', () => { process.env.NEXT_PUBLIC_APP_ENV = 'production'; }],
    ['build environment unset', () => { delete process.env.NEXT_PUBLIC_APP_ENV; }],
    ['missing target environment', () => { delete process.env.TARGET_ENVIRONMENT; }],
    ['disabled proof switch', () => { process.env.STAGING_PROOFS_ENABLED = 'false'; }],
    ['missing runtime identity', () => { delete process.env.UNION_EYES_RUNTIME_ID; }],
    ['missing proof secret', () => { delete process.env.STAGING_PROOF_SECRET; }],
  ])('conceals misconfigured proof infrastructure (%s)', async (_name, configure) => {
    const { POST } = await loadRoute();
    configure();

    const response = await POST(request({ scenario: 'schedule-basic' }));

    expect(response.status).toBe(404);
  });

  it('conceals invalid proof signatures', async () => {
    const { POST } = await loadRoute();

    const response = await POST(request({ scenario: 'schedule-basic' }, { 'x-staging-proof-signature': '0'.repeat(64) }));

    expect(response.status).toBe(404);
  });

  it('conceals a signature made for another scenario', async () => {
    const { POST } = await loadRoute();

    const response = await POST(request({ scenario: 'reschedule' }));

    expect(response.status).toBe(404);
  });

  it.each([
    'x-staging-proof-timestamp',
    'x-staging-proof-nonce',
    'x-staging-proof-signature',
  ])('conceals requests missing %s', async (header) => {
    const { POST } = await loadRoute();
    const signed = request({ scenario: 'schedule-basic' });
    const headers = new Headers(signed.headers);
    headers.delete(header);

    const response = await POST(new NextRequest(signed.url, { method: 'POST', headers, body: JSON.stringify({ scenario: 'schedule-basic' }) }));

    expect(response.status).toBe(404);
  });

  it('rejects caller-controlled synthetic inputs', async () => {
    const { POST } = await loadRoute();

    const response = await POST(request({ scenario: 'schedule-basic', organizationId: 'customer-organization' }));

    expect(response.status).toBe(400);
  });

  it('rejects malformed JSON and unsupported scenarios before proof authorization', async () => {
    const { POST } = await loadRoute();

    expect((await POST(malformedRequest())).status).toBe(400);
    expect((await POST(request({ scenario: 'worker-claim' }))).status).toBe(400);
  });
});
