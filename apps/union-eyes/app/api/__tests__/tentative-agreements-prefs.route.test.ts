import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ queue: [] as unknown[], audit: vi.fn(), values: vi.fn(), set: vi.fn() }));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'limit', 'insert', 'update', 'returning', 'delete']) c[m] = () => c;
  c.values = (...a: unknown[]) => {
    h.values(...a);
    return c;
  };
  c.set = (...a: unknown[]) => {
    h.set(...a);
    return c;
  };
  c.then = (resolve: (v: unknown) => void) => resolve(h.queue.shift());
  return c;
}
const tx = chain();

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    notFound: (resource: string) => Object.assign(new Error(`${resource} not found`), { status: 404 }),
    conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
  },
}));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({
  tentativeAgreements: new Proxy({}, { get: (_t, p) => `ta.${String(p)}` }),
  negotiations: new Proxy({}, { get: (_t, p) => `neg.${String(p)}` }),
  memberJurisdictionPreferences: new Proxy({}, { get: (_t, p) => `mjp.${String(p)}` }),
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
  desc: (a: unknown) => a,
  sql: Object.assign((..._a: unknown[]) => 'sql', {}),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_s: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }));

const valid = {
  negotiationId: '11111111-1111-4111-8111-111111111111',
  agreementNumber: 'TA-1',
  title: 'Wages',
  clauseCategory: 'wages',
  agreedLanguage: 'Rates rise 3%',
};

beforeEach(() => {
  h.queue.length = 0;
  h.audit.mockReset().mockResolvedValue(undefined);
  h.values.mockReset();
  h.set.mockReset();
});

describe('bargaining/tentative-agreements POST', () => {
  it('creates the agreement under a negotiation of the caller\'s organization and audits on the same transaction', async () => {
    const { POST } = await import('../bargaining/tentative-agreements/route');
    h.queue.push([{ id: valid.negotiationId }], [{ id: 'ta1', agreementNumber: 'TA-1' }]);
    const result = await POST({ body: valid, organizationId: 'org-1', userId: 'u1' });
    expect(result).toEqual({ data: { id: 'ta1', agreementNumber: 'TA-1' } });
    expect(h.audit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org-1', userId: 'u1', action: 'bargaining.tentative_agreement.create', resourceId: 'ta1' }),
    );
  });

  it('never takes ratification, costing approval or sign-off from the body', async () => {
    const { POST } = await import('../bargaining/tentative-agreements/route');
    h.queue.push([{ id: valid.negotiationId }], [{ id: 'ta1' }]);
    await POST({
      body: { ...valid, ratified: true, costingApproved: true, unionSignedBy: 'x', employerSignedDate: '2025-01-01', createdBy: 'evil', id: 'forced' },
      organizationId: 'org-1',
      userId: 'u1',
    });
    const written = h.values.mock.calls[0][0];
    for (const forbidden of ['ratified', 'costingApproved', 'unionSignedBy', 'employerSignedDate', 'id']) {
      expect(written).not.toHaveProperty(forbidden);
    }
    expect(written).toMatchObject({ createdBy: 'u1', lastModifiedBy: 'u1' });
  });

  it('a negotiation of another organization is 404 and nothing is written or audited', async () => {
    const { POST } = await import('../bargaining/tentative-agreements/route');
    h.queue.push([]);
    await expect(POST({ body: valid, organizationId: 'org-1', userId: 'u1' })).rejects.toMatchObject({ status: 404 });
    expect(h.values).not.toHaveBeenCalled();
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('does not keep an agreement whose audit record cannot be written', async () => {
    const { POST } = await import('../bargaining/tentative-agreements/route');
    h.queue.push([{ id: valid.negotiationId }], [{ id: 'ta1' }]);
    h.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(POST({ body: valid, organizationId: 'org-1', userId: 'u1' })).rejects.toThrow('audit down');
  });
});

describe('precedents/jurisdiction-preferences PUT', () => {
  it('creates the caller\'s own preferences with an audit record on the same transaction', async () => {
    const { PUT } = await import('../precedents/jurisdiction-preferences/route');
    h.queue.push([], [{ id: 'p1' }]);
    const result = await PUT({ body: { preferredJurisdictions: ['ON'] }, organizationId: 'org-1', userId: 'u1' });
    expect(result).toMatchObject({ id: 'p1', isConfigured: true });
    expect(h.values).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', organizationId: 'org-1' }));
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'precedent.jurisdiction_preferences.create', userId: 'u1' }));
  });

  it('updates only the caller\'s own row and audits it', async () => {
    const { PUT } = await import('../precedents/jurisdiction-preferences/route');
    h.queue.push([{ id: 'p1' }], [{ id: 'p1' }]);
    await PUT({ body: { autoApply: false }, organizationId: 'org-1', userId: 'u1' });
    expect(h.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'precedent.jurisdiction_preferences.update', resourceId: 'p1' }));
  });

  it('rejects an unknown jurisdiction before writing, and a missing organization', async () => {
    const { PUT } = await import('../precedents/jurisdiction-preferences/route');
    await expect(PUT({ body: { preferredJurisdictions: ['ZZ'] }, organizationId: 'org-1', userId: 'u1' })).rejects.toMatchObject({ status: 400 });
    await expect(PUT({ body: {}, organizationId: null, userId: 'u1' })).rejects.toMatchObject({ status: 400 });
    expect(h.audit).not.toHaveBeenCalled();
  });
});
