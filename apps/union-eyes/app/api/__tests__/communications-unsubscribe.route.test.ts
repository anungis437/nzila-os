import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  logger: { warn: vi.fn() },
  selectQueue: [] as unknown[][],
  updateReturnQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => (m.updateReturnQueue.shift() ?? []) as unknown[]),
      })),
    })),
  })),
  insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/db/schema', () => ({
  campaigns: { id: 'id', organizationId: 'organizationId', stats: 'stats' },
  communicationPreferences: { id: 'id', organizationId: 'organizationId', userId: 'userId' },
  consentRecords: {},
  messageLog: { campaignId: 'campaignId', recipientId: 'recipientId', channelType: 'channelType', status: 'status' },
  newsletterListSubscribers: { profileId: 'profileId', status: 'status', listId: 'listId' },
  newsletterDistributionLists: { id: 'id', organizationId: 'organizationId' },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq'), ne: vi.fn(() => 'ne'), inArray: vi.fn(() => 'in') };
});

async function loadRoute() {
  return import('../communications/unsubscribe/[recipientId]/route');
}

function token(secret: string, payload: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe('communications/unsubscribe/[recipientId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateReturnQueue = [];
    // The unsubscribe writes run on the transaction handed to the callback; the mock db stands in for it.
    m.withSystemContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));
    delete process.env.COMMUNICATIONS_TRACKING_SECRET;
  });

  it('returns 401 for invalid tracking token', async () => {
    const { POST } = await loadRoute();
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';

    const response = await POST(new NextRequest('http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=bad'), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(401);
  });

  it('handles campaign-linked unsubscribe and returns html confirmation', async () => {
    const { POST } = await loadRoute();
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const t = token('secret', 'c1:r1:unsubscribe');

    m.selectQueue.push([{ id: 'c1', organizationId: 'org_1', stats: {} }], [{ id: 'p1' }]);
    m.updateReturnQueue.push([{ id: 'm1' }]);

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=${t}&locale=en-CA`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('renders the French confirmation copy when locale is fr-CA', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'c1:r1:unsubscribe');
    m.selectQueue.push([{ id: 'c1', organizationId: 'org_1', stats: {} }], []);

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?campaignId=c1&reason=manual&locale=fr-CA&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Désabonnement confirmé');
  });

  it('creates subscription records when no existing preference is found', async () => {
    const { POST } = await loadRoute();
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const t = token('secret', 'c2:r2:unsubscribe');

    m.selectQueue.push([{ id: 'c2', organizationId: 'org_2', stats: {} }], []);
    m.updateReturnQueue.push([{ id: 'm2' }]);

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r2?campaignId=c2&token=${t}&reason=manual`), {
      params: Promise.resolve({ recipientId: 'r2' }),
    });

    expect(response.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('refuses a legacy recipient-only token without an organization-bound campaign', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'r1:unsubscribe');

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?reason=manual&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(400);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('honours a separately signed global opt-out and records consent for each actual organization', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'r1:unsubscribe-all');
    m.selectQueue.push(
      [{ organizationId: 'org_1' }],
      [{ organizationId: 'org_2' }, { organizationId: 'org_1' }],
      [{ id: 'p1' }],
      [],
    );

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?scope=all&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(200);
    // two scans, then per organization its preference lookup and the list-subscription subquery (the shared revocation helper)
    expect(mockDb.select).toHaveBeenCalledTimes(6);
    expect(mockDb.insert).toHaveBeenCalledTimes(3); // org_1 consent, org_2 preference and consent
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
  });

  it('does not treat a legacy recipient token as an all-organizations capability', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'r1:unsubscribe');
    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?scope=all&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });
    expect(response.status).toBe(401);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('does not claim a successful global opt-out when no matching organization exists', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'r1:unsubscribe-all');
    m.selectQueue.push([], []);
    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?scope=all&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });
    expect(response.status).toBe(404);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('fails closed on global opt-out exceeding the bounded organization scan', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'r1:unsubscribe-all');
    m.selectQueue.push(Array.from({ length: 101 }, (_, i) => ({ organizationId: `org_${i}` })), []);
    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?scope=all&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });
    expect(response.status).toBe(404);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('refuses a signed campaign token for a missing campaign without recording consent or claiming success', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'missing:r1:unsubscribe');
    m.selectQueue.push([]);

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?campaignId=missing&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(404);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('changes preferences only within the signed campaign organization, without cross-tenant recipient discovery', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'c1:r1:unsubscribe');
    m.selectQueue.push([{ id: 'c1', organizationId: 'org_1', stats: {} }], []);
    m.updateReturnQueue.push([]);

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(200);
    expect(mockDb.select).toHaveBeenCalledTimes(3); // campaign, scoped preference, and the list-subscription subquery of the same organization only
    expect(mockDb.insert).toHaveBeenCalledTimes(2); // preference and scoped consent only
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
  });

  it('rejects ambiguous scope parameters before any database access', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'c1:r1:unsubscribe');
    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?campaignId=c1&scope=unknown&token=${t}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });
    expect(response.status).toBe(400);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('does not persist arbitrary query-string text as a consent reason', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const t = token('secret', 'c2:r2:unsubscribe');
    m.selectQueue.push([{ id: 'c2', organizationId: 'org_2', stats: {} }], []);
    m.updateReturnQueue.push([]);
    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r2?campaignId=c2&token=${t}&reason=${encodeURIComponent('email=private@example.org')}`), {
      params: Promise.resolve({ recipientId: 'r2' }),
    });
    expect(response.status).toBe(200);
    const preferenceInsert = mockDb.insert.mock.results[0].value.values;
    expect(preferenceInsert).toHaveBeenCalledWith(expect.objectContaining({ unsubscribeReason: 'unsubscribe_link' }));
    const consentInsert = mockDb.insert.mock.results[1].value.values;
    expect(consentInsert).toHaveBeenCalledWith(expect.objectContaining({ metadata: { reason: 'unsubscribe_link', campaignId: 'c2' } }));
  });

  it('fails closed without a configured secret: 401 and no mutation', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=whatever'), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(401);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('rejects a non-unsubscribe (open/click) token — action binding', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    // A valid OPEN-tracking token (payload has no `:unsubscribe` action suffix).
    const openToken = token('secret', 'c1:r1');

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=${openToken}`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(401);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('rejects a token bound to a different recipient', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    // Token was issued for recipient r1, but the request targets r2.
    const tokenForR1 = token('secret', 'c1:r1:unsubscribe');

    const response = await POST(new NextRequest(`http://localhost/api/communications/unsubscribe/r2?campaignId=c1&token=${tokenForR1}`), {
      params: Promise.resolve({ recipientId: 'r2' }),
    });

    expect(response.status).toBe(401);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('refuses colon-delimiter injection in a signed campaign or recipient identifier', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { GET, POST } = await loadRoute();
    const forgedRecipient = 'r1:other';
    const forgedCampaign = 'c1:other';
    const recipientToken = token('secret', `c1:${forgedRecipient}:unsubscribe`);
    const campaignToken = token('secret', `${forgedCampaign}:r1:unsubscribe`);
    const recipientContext = { params: Promise.resolve({ recipientId: forgedRecipient }) };
    const campaignContext = { params: Promise.resolve({ recipientId: 'r1' }) };

    const recipientResponse = await POST(new NextRequest(
      `http://localhost/api/communications/unsubscribe/r1%3Aother?campaignId=c1&token=${recipientToken}`,
      { method: 'POST' },
    ), recipientContext);
    const campaignResponse = await POST(new NextRequest(
      `http://localhost/api/communications/unsubscribe/r1?campaignId=c1%3Aother&token=${campaignToken}`,
      { method: 'POST' },
    ), campaignContext);
    const previewResponse = await GET(new NextRequest(
      `http://localhost/api/communications/unsubscribe/r1?campaignId=c1%3Aother&token=${campaignToken}`,
    ), campaignContext);

    expect(recipientResponse.status).toBe(400);
    expect(campaignResponse.status).toBe(400);
    expect(previewResponse.status).toBe(400);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('rejects duplicate authority parameters before checking a token or touching storage', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { GET, POST } = await loadRoute();
    const t = token('secret', 'c1:r1:unsubscribe');
    const ctx = { params: Promise.resolve({ recipientId: 'r1' }) };
    const duplicateCampaign = await POST(new NextRequest(
      `http://localhost/api/communications/unsubscribe/r1?campaignId=c1&campaignId=c2&token=${t}`,
      { method: 'POST' },
    ), ctx);
    const duplicateToken = await POST(new NextRequest(
      `http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=${t}&token=${t}`,
      { method: 'POST' },
    ), ctx);
    const duplicateScope = await GET(new NextRequest(
      `http://localhost/api/communications/unsubscribe/r1?scope=all&scope=all&token=${t}`,
    ), ctx);

    expect(duplicateCampaign.status).toBe(400);
    expect(duplicateToken.status).toBe(400);
    expect(duplicateScope.status).toBe(400);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('refuses oversized capability identifiers without database activity', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { POST } = await loadRoute();
    const recipientId = 'r'.repeat(257);
    const response = await POST(new NextRequest(
      `http://localhost/api/communications/unsubscribe/${recipientId}?campaignId=c1&token=invalid`,
      { method: 'POST' },
    ), { params: Promise.resolve({ recipientId }) });
    expect(response.status).toBe(400);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('GET is a scanner-safe confirmation only; POST is required to revoke consent', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { GET, POST } = await loadRoute();
    const t = token('secret', 'c1:r1:unsubscribe');
    const url = `http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=${t}`;
    const context = { params: Promise.resolve({ recipientId: 'r1' }) };
    const preview = await GET(new NextRequest(url), context);
    expect(preview.status).toBe(200);
    expect(await preview.text()).toContain('<form method="post">');
    expect(preview.headers.get('referrer-policy')).toBe('no-referrer');
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();

    m.selectQueue.push([{ id: 'c1', organizationId: 'org_1', stats: {} }], []);
    m.updateReturnQueue.push([]);
    const submitted = await POST(new NextRequest(url, { method: 'POST' }), context);
    expect(submitted.status).toBe(200);
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('does not render a confirmation form for a forged GET token', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=forged'),
      { params: Promise.resolve({ recipientId: 'r1' }) },
    );
    expect(response.status).toBe(401);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

});
