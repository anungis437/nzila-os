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
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.verifyWebhook.mockReturnValue({
      type: 'email.delivered',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'provider_1', to: ['u@example.com'] },
    });
  });

  it('returns 500 when webhook configuration is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const { POST } = await loadRoute();

    const response = await POST(webhookRequest('{}'));

    expect(response.status).toBe(500);
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

  it('returns received true when log row does not exist', async () => {
    const { POST } = await loadRoute();
    m.queueSelect([]);

    const response = await POST(webhookRequest('{}', {
      'svix-id': 'id1',
      'svix-timestamp': 'ts1',
      'svix-signature': 'sig1',
    }));

    expect(response.status).toBe(200);
    expect(m.logger.warn).toHaveBeenCalled();
  });

  it('processes click events and updates campaign stats', async () => {
    const { POST } = await loadRoute();
    m.verifyWebhook.mockReturnValueOnce({
      type: 'email.clicked',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'provider_2', to: ['u@example.com'] },
    });
    m.queueSelect(
      [{
        id: 'msg_1',
        campaignId: 'camp_1',
        organizationId: 'org_1',
        recipientId: 'user_2',
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
        status: 'sent',
        errorMessage: null,
      }],
      [{ stats: { sent: 10 } }],
    );

    const response = await POST(webhookRequest('{}', {
      'svix-id': 'id1',
      'svix-timestamp': 'ts1',
      'svix-signature': 'sig1',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ received: true, eventType: 'email.clicked' });
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('marks suppressed email events as unsubscribed', async () => {
    const { POST } = await loadRoute();
    m.verifyWebhook.mockReturnValueOnce({
      type: 'email.suppressed',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'provider_3', to: ['u@example.com'] },
    });
    m.queueSelect(
      [{
        id: 'msg_2',
        campaignId: 'camp_2',
        organizationId: 'org_2',
        recipientId: 'user_3',
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
        status: 'sent',
        errorMessage: null,
      }],
      [{ stats: { sent: 4 } }],
    );

    const response = await POST(webhookRequest('{}', {
      'svix-id': 'id2',
      'svix-timestamp': 'ts2',
      'svix-signature': 'sig2',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ received: true, eventType: 'email.suppressed' });
    expect(mockDb.update).toHaveBeenCalledTimes(3);
  });

  it('stores failed delivery reasons on the message log', async () => {
    const { POST } = await loadRoute();
    m.verifyWebhook.mockReturnValueOnce({
      type: 'email.failed',
      created_at: '2026-01-01T00:00:00.000Z',
      data: { email_id: 'provider_4', to: ['u@example.com'], failed: { reason: 'bounce_loop' } },
    });
    m.queueSelect(
      [{
        id: 'msg_3',
        campaignId: 'camp_3',
        organizationId: 'org_3',
        recipientId: 'user_4',
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        bouncedAt: null,
        status: 'sent',
        errorMessage: null,
      }],
      [{ stats: { sent: 9 } }],
    );

    const response = await POST(webhookRequest('{}', {
      'svix-id': 'id3',
      'svix-timestamp': 'ts3',
      'svix-signature': 'sig3',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ received: true, eventType: 'email.failed' });
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });
});
