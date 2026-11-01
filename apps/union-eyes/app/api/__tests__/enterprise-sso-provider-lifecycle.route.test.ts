import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  existing: [] as Array<Record<string, unknown>>,
  updateReturn: [] as Array<Record<string, unknown>>,
  deleteReturn: [] as Array<Record<string, unknown>>,
  setValues: [] as Array<Record<string, unknown>>,
  audit: vi.fn(),
  encrypt: vi.fn(async (value: string) => `enc:${value}`),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    notFound: (message: string) => Object.assign(new Error(`${message} not found`), { status: 404 }),
    conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
  },
}));
vi.mock('@/lib/api/errors', () => ({ ApiError: { badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }) } }));
vi.mock('@/db/schema/sso-scim-schema', () => ({ ssoProviders: { id: 'id', organizationId: 'organizationId', name: 'name', providerType: 'providerType', enabled: 'enabled', oidcClientSecret: 'oidcClientSecret' } }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn() }));
vi.mock('@/lib/encryption', () => ({ encryptSecret: m.encrypt }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@nzila/db/auth-storage-authority', () => ({ AUTH_TENANT_ASSIGNABLE_ROLES: ['member', 'steward', 'admin'] }));
vi.mock('@/lib/db/unique-violation', () => ({ isUniqueViolation: () => false }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => m.existing }) }) }),
      update: () => ({ set: (values: Record<string, unknown>) => { m.setValues.push(values); return { where: () => ({ returning: async () => m.updateReturn }) }; } }),
      delete: () => ({ where: () => ({ returning: async () => m.deleteReturn }) }),
    }),
}));

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = (body: unknown, over: Record<string, unknown> = {}) => ({ params: { id: ID }, organizationId: 'org-1', userId: 'admin-1', body, ...over });
const route = async () => import('../enterprise/sso/providers/[id]/route');

const oidc = { id: ID, name: 'Okta', providerType: 'oidc', enabled: false, oidcIssuer: 'https://idp.example.com', oidcClientId: 'client', oidcClientSecret: 'enc:old' };

describe('enterprise/sso/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.existing = [{ ...oidc }];
    m.updateReturn = [{ id: ID, enabled: true }];
    m.deleteReturn = [{ id: ID, name: 'Okta', providerType: 'oidc', enabled: false }];
    m.setValues.length = 0;
    m.audit.mockResolvedValue(undefined);
  });

  it('refuses to turn a provider on while nothing reads it at sign-in, records the attempt, and changes nothing', async () => {
    const { PATCH } = await route();
    await expect(PATCH(ctx({ enabled: true }) as never)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('auth.sso.federated_sign_in is not available'),
    });
    expect(m.setValues).toHaveLength(0);
    expect(m.audit).toHaveBeenCalledTimes(1);
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'sso.provider.activate_blocked',
        resourceId: ID,
        details: { blockedOperation: 'auth.sso.federated_sign_in', capability: 'UE-SSO-SIGN-IN', requested: ['enabled'] },
      }),
      'failure',
    );
  });

  it('refuses auto-provisioning for the same reason, and names everything that was asked for', async () => {
    const { PATCH } = await route();
    await expect(PATCH(ctx({ autoProvision: true }) as never)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('autoProvision cannot be turned on') });
    await expect(PATCH(ctx({ enabled: true, autoProvision: true }) as never)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('enabled and autoProvision cannot be turned on') });
    expect(m.setValues).toHaveLength(0);
  });

  it('still turns a provider off, and says that this changes no sign-in', async () => {
    m.existing = [{ ...oidc, enabled: true }];
    m.updateReturn = [{ id: ID, enabled: false }];
    const { PATCH } = await route();
    const result = (await PATCH(ctx({ enabled: false }) as never)) as { changed: string[]; effect: { inEffect: boolean } };
    expect(result.changed).toEqual(['enabled']);
    expect(result.effect.inEffect).toBe(false);
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'sso.provider.update', details: { fields: ['enabled'], enabled: false, inEffect: false } }));
  });

  it('refuses to leave a provider that is already enabled incomplete for its type', async () => {
    m.existing = [{ ...oidc, enabled: true, oidcIssuer: null }];
    const { PATCH } = await route();
    await expect(PATCH(ctx({ name: 'Okta renamed' }) as never)).rejects.toMatchObject({ status: 400 });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('encrypts a rotated secret, stores only the ciphertext and audits a rotation without the value', async () => {
    const { PATCH } = await route();
    await PATCH(ctx({ oidcClientSecret: 'new-secret-value' }) as never);
    expect(m.setValues[0].oidcClientSecret).toBe('enc:new-secret-value');
    const entry = m.audit.mock.calls[0][1] as { action: string; details: unknown };
    expect(entry.action).toBe('sso.provider.rotate_secret');
    expect(JSON.stringify(entry.details)).not.toContain('new-secret-value');
  });

  it('refuses fields that are not changeable, a role mapping to a platform role and an empty change', async () => {
    const { PATCH } = await route();
    await expect(PATCH(ctx({ organizationId: 'other' }) as never)).rejects.toMatchObject({ status: 400 });
    await expect(PATCH(ctx({ roleMapping: { Admins: 'platform_lead' } }) as never)).rejects.toMatchObject({ status: 400 });
    await expect(PATCH(ctx({}) as never)).rejects.toMatchObject({ status: 400 });
  });

  it('answers not found for a provider of another organization or a malformed id', async () => {
    const { PATCH, DELETE } = await route();
    m.existing = [];
    await expect(PATCH(ctx({ enabled: false }) as never)).rejects.toMatchObject({ status: 404 });
    await expect(PATCH(ctx({ enabled: false }, { params: { id: 'nope' } }) as never)).rejects.toMatchObject({ status: 404 });
    m.deleteReturn = [];
    await expect(DELETE(ctx(undefined) as never)).rejects.toMatchObject({ status: 404 });
  });

  it('deletes a provider, records the removal, and says that this changes no sign-in', async () => {
    const { DELETE } = await route();
    expect(await DELETE(ctx(undefined) as never)).toMatchObject({ id: ID, deleted: true, effect: { inEffect: false, blockedOperation: { operation: 'auth.sso.federated_sign_in' } } });
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'sso.provider.delete', details: { name: 'Okta', providerType: 'oidc', wasEnabled: false } }));
  });
});
