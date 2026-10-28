import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
  audit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }) },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(m.db) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/schema-organizations', () => ({ organizations: {} }));
vi.mock('@/db/schema', () => ({ organizationMembers: {} }));

async function loadRoute() {
  return import('../settings/organization/route');
}

describe('settings/organization route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((config: any, handler: any) => async (ctx: any) => handler(ctx));
    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          { id: 'org_1', name: 'Test Org', shortName: 'TO', memberCount: 100, settings: { theme: 'dark' } },
        ]),
      })),
    }));
    m.audit.mockResolvedValue(undefined);
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
  });

  it('returns organization settings', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });
    expect(result.organization).toBeDefined();
    expect(result.organization?.id).toBe('org_1');
  });

  it('returns empty settings when org not found', async () => {
    const { GET } = await loadRoute();
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    const result = await GET({ organizationId: 'missing' });
    expect(result.organization).toBeNull();
  });

  it('updates organization settings', async () => {
    const { PUT } = await loadRoute();
    const result = await PUT({
      organizationId: 'org_1',
      userId: 'u1',
      body: { name: 'Updated Org', settings: { timezone: 'America/Toronto', showBranding: true } },
    });
    expect(result.updated).toBe(true);
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'organization.settings_update', userId: 'u1' }));
  });

  const put = (settings: unknown) => loadRoute().then(({ PUT }) => PUT({ organizationId: 'org_1', userId: 'u1', body: { settings } }));

  it.each([
    ['perCapitaRate', 0.01],
    ['remittanceDay', 28],
    ['credits', 1_000_000],
    ['nextCreditRenewal', '2099-01-01'],
    ['twilioPhoneNumber', '+15550100'],
  ])('refuses to let an administrator write the authority key %s, saves nothing and audits nothing', async (key, value) => {
    await expect(put({ timezone: 'America/Toronto', [key]: value })).rejects.toMatchObject({ status: 400, message: expect.stringContaining(key) });
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('refuses an unknown key and never echoes the rejected value', async () => {
    const attempt = put({ arbitraryKey: 'SECRET-VALUE-123' });
    await expect(attempt).rejects.toMatchObject({ status: 400 });
    await expect(attempt).rejects.not.toThrow(/SECRET-VALUE-123/);
    expect(m.db.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ sessionTimeout: 0 }],
    [{ sessionTimeout: 'forever' }],
    [{ requireMFA: 'yes' }],
    [{ webhookUrl: 'http://insecure.example/hook' }],
    [{ webhookUrl: 'javascript:alert(1)' }],
    [{ primaryColor: 'red; background:url(x)' }],
    [{ defaultRole: 'system_admin' }],
    [{ billingCycle: 'free-forever' }],
  ])('refuses an invalid value for %j', async (settings) => {
    await expect(put(settings)).rejects.toMatchObject({ status: 400 });
    expect(m.db.update).not.toHaveBeenCalled();
  });

  it('records the before and after of every written setting in the audit row', async () => {
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ settings: { timezone: 'UTC', credits: 5 } }]) })) }));
    const result = await put({ timezone: 'America/Toronto', sessionTimeout: 60 });
    expect(result.updated).toBe(true);
    expect(m.audit).toHaveBeenCalledWith(
      m.db,
      expect.objectContaining({
        details: expect.objectContaining({
          settingsBefore: { timezone: 'UTC', sessionTimeout: null },
          settingsAfter: { timezone: 'America/Toronto', sessionTimeout: 60 },
        }),
      }),
    );
  });
});
