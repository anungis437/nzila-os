import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  return {
    state,
    verifyWebhook: vi.fn(),
    withSystemContext: vi.fn(),
    persistAtomicAudit: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    resetQueues: () => {
      state.selectQueue = [];
    },
    createSelectChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  })),
};

vi.mock('resend', () => ({
  Resend: class MockResend {
    webhooks = {
      verify: m.verifyWebhook,
    };
    constructor(_apiKey: string) {}
  },
}));
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

async function loadRoute() {
  return import('../communications/webhooks/resend/route');
}

function webhookRequest(body: string, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/communications/webhooks/resend', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      ...(headers ?? {}),
    },
  });
}

describe('communications/webhooks/resend route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    process.env.RESEND_API_KEY = 'key_1';
    process.env.RESEND_WEBHOOK_SECRET = 'secret_1';
    m.withSystemContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.verifyWebhook.mockReturnValue({
      type: 'email.delivered',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'provider_1', to: ['u@example.com'] },
    });
  });

  it('returns 503 when webhook configuration is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const { POST } = await loadRoute();

    const response = await POST(webhookRequest('{}'));

    expect(response.status).toBe(503);
  });

  it('returns 400 when svix headers are missing', async () => {
    const { POST } = await loadRoute();

    const response = await POST(webhookRequest('{}'));

    expect(response.status).toBe(400);
  });

  it('returns 401 when signature verification fails', async () => {
    const { POST } = await loadRoute();
    m.verifyWebhook.mockImplementationOnce(() => {
      throw new Error('invalid signature');
    });

    const response = await POST(webhookRequest('{}', {
      'svix-id': 'id1',
      'svix-timestamp': 'ts1',
      'svix-signature': 'sig1',
    }));

    expect(response.status).toBe(401);
  });

  it('ignores non-email webhook events', async () => {
    const { POST } = await loadRoute();
    m.verifyWebhook.mockReturnValueOnce({ type: 'audience.created', data: {} });

    const response = await POST(webhookRequest('{}', {
      'svix-id': 'id1',
      'svix-timestamp': 'ts1',
      'svix-signature': 'sig1',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ received: true, ignored: true });
  });

  // Event handling (ordering, redelivery, suppression, unmatched and ambiguous ids, rollback) is exercised against a real SQL engine in
  // communications-webhooks-resend.pglite.test.ts; this file keeps the configuration, signature and event-type gates.
});
