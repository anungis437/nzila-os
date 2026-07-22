import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createProofSignature } from '@/lib/staging-proof/deadline-engine-auth';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    execute: mocks.execute,
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock('@/lib/deadline-engine', () => ({
  scheduleGrievanceDeadlineReminders: vi.fn(),
  cancelGrievanceDeadlineReminders: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

async function loadRoute() {
  return import('../staging-proof/deadline-engine/scenario/route');
}

const secret = 'deadline-proof-test-secret';
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

describe('deadline-engine staging proof route boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TARGET_ENVIRONMENT = 'staging';
    process.env.STAGING_PROOFS_ENABLED = 'true';
    process.env.UNION_EYES_RUNTIME_ID = 'union-eyes-staging';
    process.env.STAGING_PROOF_SECRET = secret;
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
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('conceals invalid proof signatures without claiming a nonce', async () => {
    const { POST } = await loadRoute();
    const response = await POST(request({ scenario: 'schedule-basic' }, {
      'x-staging-proof-signature': '0'.repeat(64),
    }));

    expect(response.status).toBe(404);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('rejects a replayed nonce before any lifecycle service runs', async () => {
    const { POST } = await loadRoute();
    mocks.execute.mockResolvedValueOnce([]);

    const response = await POST(request({ scenario: 'schedule-basic' }));

    expect(response.status).toBe(404);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('rejects caller-controlled synthetic inputs', async () => {
    const { POST } = await loadRoute();
    const response = await POST(request({
      scenario: 'schedule-basic',
      organizationId: 'customer-organization',
    }));

    expect(response.status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
