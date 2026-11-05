import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  upsertContact: vi.fn(),
  createDeal: vi.fn(),
  inserted: [] as Array<Record<string, unknown>>,
  open: 0,
  openedDuringCrm: [] as number[],
  contexts: 0,
  failInsert: false,
}));

const pilotApplicationsTable = { __table: 'pilot_applications' };

const tx = {
  insert: vi.fn((table: unknown) => {
    expect(table).toBe(pilotApplicationsTable);
    return {
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          if (m.failInsert) throw new Error('connection reset');
          m.inserted.push(values);
          return [{ id: 'app-1', ...values }];
        },
      }),
    };
  }),
};

// The intake row has no organization: it is written by the system role, and the ambient handle must never be used.
vi.mock('@/db', () => ({ db: new Proxy({}, { get() { throw new Error('ambient db used outside a context'); } }) }));
vi.mock('@/db/schema', () => ({ pilotApplications: pilotApplicationsTable }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (operation: (t: typeof tx) => Promise<unknown>) => {
    m.contexts += 1;
    m.open += 1;
    try {
      return await operation(tx);
    } finally {
      m.open -= 1;
    }
  }),
}));
vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: () => ({ GET: vi.fn() }) }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: vi.fn(async () => false) }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS_PER_IP: { PILOT_APPLY: { limit: 5, window: 3600, identifier: 'pilot-apply' } },
}));
vi.mock('@/lib/public-intake/guard', () => ({ clientAddress: () => '203.0.113.9' }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/services/crm-service', () => ({
  upsertContact: (...args: unknown[]) => { m.openedDuringCrm.push(m.open); return m.upsertContact(...args); },
  createDeal: (...args: unknown[]) => { m.openedDuringCrm.push(m.open); return m.createDeal(...args); },
}));

const valid = {
  organizationName: 'Local 42',
  contactName: 'Pat Organizer',
  contactEmail: 'pat@example.org',
  memberCount: 120,
  responses: { organizationId: '11111111-1111-4111-8111-111111111111', commercialState: 'approved', note: 'hello' },
  assessment: { score: 7, extra: 'dropped' },
};

const request = (body: string) =>
  new NextRequest('http://localhost/api/pilot/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body });

async function post(body: unknown) {
  const { POST } = await import('../apply/route');
  return POST(request(typeof body === 'string' ? body : JSON.stringify(body)));
}

describe('POST /api/pilot/apply (public intake)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.inserted = [];
    m.open = 0;
    m.openedDuringCrm = [];
    m.contexts = 0;
    m.failInsert = false;
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.upsertContact.mockResolvedValue('contact-1');
    m.createDeal.mockResolvedValue('deal-1');
  });

  it('writes the application as the system role in one transaction, and syncs the CRM only after it is closed', async () => {
    const response = await post(valid);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, id: 'app-1' });
    expect(m.contexts).toBe(1);
    expect(m.inserted).toHaveLength(1);
    expect(m.inserted[0]).toMatchObject({ organizationName: 'Local 42', contactEmail: 'pat@example.org', memberCount: 120, readinessScore: '7' });
    expect(m.openedDuringCrm).toEqual([0, 0]);
  });

  it('never stores a reserved key an anonymous applicant seeded in the free-form responses', async () => {
    await post(valid);

    const stored = m.inserted[0].responses as Record<string, unknown>;
    expect(stored).not.toHaveProperty('commercialState');
    expect(stored).toHaveProperty('note', 'hello');
  });

  it('answers 429 before reading the body or opening any transaction when the caller is rate limited', async () => {
    m.checkRateLimit.mockResolvedValue({ allowed: false });

    const response = await post(valid);

    expect(response.status).toBe(429);
    expect(m.contexts).toBe(0);
  });

  it('answers 400, before any transaction, for a body that is not a valid application', async () => {
    for (const body of ['not-json', {}, { ...valid, contactEmail: 'nope' }, { ...valid, organizationType: 'galaxy' }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(m.contexts).toBe(0);
    expect(m.inserted).toEqual([]);
  });

  it('answers 413, before any transaction, for a body over the limit', async () => {
    const response = await post({ ...valid, currentSystem: 'x'.repeat(70 * 1024) });

    expect(response.status).toBe(413);
    expect(m.contexts).toBe(0);
  });

  it('answers 500, not success, when the application cannot be stored, and does not sync the CRM', async () => {
    m.failInsert = true;

    const response = await post(valid);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to submit pilot application' });
    expect(m.upsertContact).not.toHaveBeenCalled();
  });
});
