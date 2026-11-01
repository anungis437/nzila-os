import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/schema', () => ({ memberJurisdictionPreferences: { userId: 'userId', organizationId: 'organizationId', id: 'id' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../precedents/jurisdiction-preferences/route');
}

describe('precedents/jurisdiction-preferences route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRLSContext.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.db));
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) } as any);
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'pref_1', preferredJurisdictions: ['ON'] }]) })) })) });
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'pref_1', preferredJurisdictions: ['QC'] }]) })) })) } as any);
  });

  it('returns default preferences when none exist', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1', userId: 'u1' });

    expect(result.isConfigured).toBe(false);
  });

  it('creates preferences', async () => {
    const { PUT } = await loadRoute();
    const result = await PUT({
      body: { preferredJurisdictions: ['ON'], preferredLevels: ['provincial'], includeNational: true, autoApply: true },
      userId: 'u1',
      organizationId: 'org_1',
    });

    expect(result.isConfigured).toBe(true);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    // The audit row is written on the same transaction handle as the insert.
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'u1',
        action: 'precedent.jurisdiction_preferences.create',
        resourceId: 'pref_1',
      }),
    );
  });

  it('updates an existing preference row scoped to the caller user and organization, and audits it', async () => {
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'pref_1' }]) })) })),
    } as any);
    const { PUT } = await loadRoute();
    const result = await PUT({ body: { preferredJurisdictions: ['QC'] }, userId: 'u1', organizationId: 'org_1' });

    expect(result.isConfigured).toBe(true);
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('userId', 'u1');
    expect(eq).toHaveBeenCalledWith('organizationId', 'org_1');
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({ action: 'precedent.jurisdiction_preferences.update', resourceId: 'pref_1' }),
    );
  });

  it('rejects an invalid jurisdiction and a missing organization without writing or auditing', async () => {
    const { PUT } = await loadRoute();

    await expect(
      PUT({ body: { preferredJurisdictions: ['ZZ'] }, userId: 'u1', organizationId: 'org_1' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      PUT({ body: { preferredJurisdictions: ['ON'] }, userId: 'u1', organizationId: undefined }),
    ).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});
