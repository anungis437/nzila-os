import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  audit: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
  tx: { select: vi.fn(), update: vi.fn() },
  current: { id: 's1', status: 'draft' } as { id: string; status: string } | null,
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ votingSessions: { id: 'id', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/elections/sessions/[id]/route');
}

const request = { url: 'http://localhost/api/governance/elections/sessions/s1' };
const ctx = { organizationId: 'org-1', userId: 'u1', request };

describe('governance/elections/sessions/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.current = { id: 's1', status: 'draft' };
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(m.tx));
    m.audit.mockResolvedValue(undefined);
    m.db.select.mockReturnValue({ from: () => ({ where: async () => (m.current ? [m.current] : []) }) });
    m.tx.select.mockReturnValue({ from: () => ({ where: async () => (m.current ? [m.current] : []) }) });
    m.tx.update.mockImplementation(() => ({
      set: (v: Record<string, unknown>) => ({ where: () => ({ returning: async () => [{ ...m.current, ...v }] }) }),
    }));
  });

  it('returns a session by id', async () => {
    const { GET } = await loadRoute();
    await expect(GET(ctx)).resolves.toEqual({ id: 's1', status: 'draft' });
  });

  it('opens a draft session and audits the transition on the same transaction', async () => {
    const { PATCH } = await loadRoute();
    const result = await PATCH({ ...ctx, body: { status: 'active' } });

    expect(result).toMatchObject({ status: 'active' });
    expect(m.audit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ action: 'voting_session.update', details: expect.objectContaining({ from: 'draft', to: 'active' }) }),
    );
  });

  it.each([
    ['active', { title: 'New title' }, 'TERMS_LOCKED'],
    ['closed', { status: 'active' }, 'ILLEGAL_TRANSITION'],
    ['cancelled', { status: 'active' }, 'ILLEGAL_TRANSITION'],
  ])('refuses to change a %s session with %j (%s) and writes nothing', async (status, body, code) => {
    m.current = { id: 's1', status };
    const { PATCH } = await loadRoute();

    await expect(PATCH({ ...ctx, body })).rejects.toMatchObject({ details: { code } });
    expect(m.tx.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('cancels a draft or open session and audits it', async () => {
    m.current = { id: 's1', status: 'active' };
    const { DELETE } = await loadRoute();
    await expect(DELETE(ctx)).resolves.toMatchObject({ status: 'cancelled' });
    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'voting_session.cancel', details: { from: 'active' } }));
  });

  it('cannot cancel a closed election: that would rewrite a completed result', async () => {
    m.current = { id: 's1', status: 'closed' };
    const { DELETE } = await loadRoute();
    await expect(DELETE(ctx)).rejects.toMatchObject({ details: { code: 'ILLEGAL_TRANSITION' } });
    expect(m.tx.update).not.toHaveBeenCalled();
  });

  it('is a 404 with no write or audit for a session outside the organization', async () => {
    m.current = null;
    const { PATCH, DELETE } = await loadRoute();
    await expect(PATCH({ ...ctx, body: { title: 'x' } })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(DELETE(ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('rejects every operation without an organization context (no cross-union access)', async () => {
    const { GET, PATCH, DELETE } = await loadRoute();
    const noOrg = { request, organizationId: null };
    await expect(GET(noOrg)).rejects.toThrow('Organization context required');
    await expect(PATCH({ ...noOrg, body: { status: 'active' } })).rejects.toThrow('Organization context required');
    await expect(DELETE(noOrg)).rejects.toThrow('Organization context required');
    expect(m.tx.update).not.toHaveBeenCalled();
  });
});
