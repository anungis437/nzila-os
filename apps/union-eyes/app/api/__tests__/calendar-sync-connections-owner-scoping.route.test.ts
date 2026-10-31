import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const m = vi.hoisted(() => ({
  withApi: vi.fn((_options: unknown, handler: unknown) => handler),
  select: vi.fn(), from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  delete: vi.fn(), returning: vi.fn(), persistAtomicAudit: vi.fn(),
  withRLSContext: vi.fn(),
  revoke: vi.fn(),
  eq: vi.fn((column: unknown, value: unknown) => ({ op: 'eq', column, value })),
  and: vi.fn((...predicates: unknown[]) => ({ op: 'and', predicates })),
  desc: vi.fn((column: unknown) => ({ op: 'desc', column })),
}));

const columns = {
  id: 'connection.id', organizationId: 'connection.organizationId', userId: 'connection.userId',
  provider: 'connection.provider', providerAccountId: 'connection.providerAccountId',
  providerEmail: 'connection.providerEmail', syncEnabled: 'connection.syncEnabled',
  syncDirection: 'connection.syncDirection', lastSyncAt: 'connection.lastSyncAt',
  nextSyncAt: 'connection.nextSyncAt', syncStatus: 'connection.syncStatus',
  isActive: 'connection.isActive', createdAt: 'connection.createdAt',
  syncPastDays: 'connection.syncPastDays', syncFutureDays: 'connection.syncFutureDays',
  syncOnlyFreeTime: 'connection.syncOnlyFreeTime',
  accessToken: 'connection.accessToken', refreshToken: 'connection.refreshToken',
  tokenExpiresAt: 'connection.tokenExpiresAt',
};

vi.mock('@/db/schema', () => ({ externalCalendarConnections: columns }));
vi.mock('@/db/db', () => ({
  db: { select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; } },
}));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and, desc: m.desc }));
vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    notFound: (message: string) => Object.assign(new Error(message), { status: 404 }),
    conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
  },
  z,
  zUUID: z.string().uuid(),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (...args: unknown[]) => m.withRLSContext(...args),
}));
vi.mock('@/lib/external-calendar-sync/provider-revocation', () => ({ revokeProviderGrant: (...args: unknown[]) => m.revoke(...args) }));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: (...args: unknown[]) => m.persistAtomicAudit(...args),
}));

const ID = '2b30c6d7-2222-4222-8222-aaaaaaaaaaaa';
const actor = { organizationId: 'org-1', userId: 'user-1' };
// The framework is mocked to invoke its handler with a context object, not an HTTP Request.
const invoke = <T>(handler: unknown, ctx: unknown): Promise<T> =>
  (handler as (context: unknown) => Promise<T>)(ctx);
const scoped = (value: unknown) => {
  const expression = JSON.stringify(value);
  expect(expression).toContain('connection.organizationId');
  expect(expression).toContain('org-1');
  expect(expression).toContain('connection.userId');
  expect(expression).toContain('user-1');
};
const noCredentials = (projection: Record<string, unknown>) => {
  expect(projection).not.toHaveProperty('accessToken');
  expect(projection).not.toHaveProperty('refreshToken');
  expect(projection).not.toHaveProperty('tokenExpiresAt');
};

describe('calendar connection owner and credential boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    m.from.mockReturnValue({ where: m.where });
    m.where.mockReturnValue({ orderBy: m.orderBy, limit: m.limit, returning: m.returning });
    m.orderBy.mockReturnValue({ limit: m.limit });
    m.limit.mockResolvedValue([{ id: ID, provider: 'google' }]);
    m.returning.mockResolvedValue([{ id: ID }]);
    m.delete.mockReturnValue({ where: m.where });
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ delete: m.delete, select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; } }));
    m.revoke.mockResolvedValue('not_supported');
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('lists only the caller own connections and never selects OAuth secrets', async () => {
    const { GET } = await import('@/app/api/calendar-sync/connections/route');
    const result = await invoke<{ connections: unknown[] }>(GET, actor);
    expect(result.connections).toHaveLength(1);
    noCredentials(m.select.mock.calls[0][0]);
    scoped(m.where.mock.calls[0][0]);
  });

  it('direct POST starts OAuth without creating a connection or accepting tokens', async () => {
    const { POST } = await import('@/app/api/calendar-sync/connections/route');
    const config = m.withApi.mock.calls.find(([options]) => options.openapi?.summary === 'Start provider-authorized calendar connection')?.[0];
    expect(config).toBeDefined();
    expect(config.body.safeParse({ provider: 'google', accessToken: 'forged' }).success).toBe(false);
    expect(config.body.safeParse({ provider: 'google', refreshToken: 'forged' }).success).toBe(false);
    const result = await invoke<{ connectUrl: string; connectionCreated: boolean }>(POST, { ...actor, body: { provider: 'google' } });
    expect(result).toEqual({ connectUrl: '/api/calendar-sync/google/auth', connectionCreated: false });
    expect(m.select).not.toHaveBeenCalled();
  });

  it('item GET enforces organization and user predicates and omits all credentials', async () => {
    const { GET } = await import('@/app/api/calendar-sync/connections/[id]/route');
    const result = await invoke<{ data: { id: string } }>(GET, { ...actor, params: { id: ID } });
    expect(result.data.id).toBe(ID);
    noCredentials(m.select.mock.calls[0][0]);
    scoped(m.where.mock.calls[0][0]);
  });

  it('item PATCH schema excludes credential mutation', async () => {
    await import('@/app/api/calendar-sync/connections/[id]/route');
    const config = m.withApi.mock.calls.find(([options]) => options.openapi?.summary === 'Edit own non-secret calendar sync settings')?.[0];
    expect(config).toBeDefined();
    expect(config.body.safeParse({ accessToken: 'forged' }).success).toBe(false);
    expect(config.body.safeParse({ refreshToken: 'forged' }).success).toBe(false);
    expect(config.body.safeParse({ syncEnabled: true }).success).toBe(true);
  });

  // DEF-0B3-CALENDAR-DISCONNECT-ADMIN-FLOOR-NO-REVOKE
  it('DELETE is scoped to the caller, asks the provider to revoke, audits what it did and deletes the local credentials', async () => {
    m.limit.mockResolvedValue([{ provider: 'google', accessToken: 'enc-a', refreshToken: 'enc-r' }]);
    m.revoke.mockResolvedValue('revoked');
    const { DELETE } = await import('@/app/api/calendar-sync/connections/[id]/route');
    const result = await invoke<Record<string, unknown>>(DELETE, { ...actor, params: { id: ID } });
    expect(result).toEqual({ deleted: true, id: ID, providerRevocation: 'revoked', providerRevocationVerified: true });
    expect(m.revoke).toHaveBeenCalledWith('google', expect.objectContaining({ refreshToken: 'enc-r' }));
    expect(m.withRLSContext).toHaveBeenCalledWith(actor, expect.any(Function));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      organizationId: 'org-1', userId: 'user-1', action: 'calendar.connection.delete',
      resourceId: ID, details: expect.objectContaining({ providerRevocation: 'revoked', localCredentialsDeleted: true }),
    }));
  });

  it('DELETE still removes the local credentials, and says so, when the provider cannot revoke', async () => {
    m.limit.mockResolvedValue([{ provider: 'microsoft', accessToken: 'enc-a', refreshToken: null }]);
    m.revoke.mockResolvedValue('not_supported');
    const { DELETE } = await import('@/app/api/calendar-sync/connections/[id]/route');
    const result = await invoke<Record<string, unknown>>(DELETE, { ...actor, params: { id: ID } });
    expect(result).toMatchObject({ deleted: true, providerRevocation: 'not_supported', providerRevocationVerified: false });
  });

  it('DELETE of a connection the caller does not own is not found and revokes nothing', async () => {
    m.limit.mockResolvedValue([]);
    const { DELETE } = await import('@/app/api/calendar-sync/connections/[id]/route');
    await expect(invoke(DELETE, { ...actor, params: { id: ID } })).rejects.toMatchObject({ status: 404 });
    expect(m.revoke).not.toHaveBeenCalled();
  });
});
