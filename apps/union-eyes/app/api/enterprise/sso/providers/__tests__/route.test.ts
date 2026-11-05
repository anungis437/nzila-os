import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn((message: string) => ({ apiError: true, status: 400, message })),
  conflict: vi.fn((message: string, details?: unknown) => ({ apiError: true, status: 409, message, details })),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  encryptSecret: vi.fn(async (plaintext: string) => `encrypted(${plaintext})`),
  audit: vi.fn(),
  tx: {} as Record<string, unknown>,
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: m.badRequest, conflict: m.conflict } }));
vi.mock('@/db/schema/sso-scim-schema', () => ({
  ssoProviders: { id: 'sp.id', organizationId: 'sp.organizationId' },
}));
vi.mock('drizzle-orm', () => ({ eq: m.eq }));
vi.mock('@/lib/encryption', () => ({ encryptSecret: m.encryptSecret }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  // The route calls withRLSContext(fn); the activation guard calls withRLSContext(context, fn). Both reach the same transaction handle.
  withRLSContext: async (a: unknown, b?: (tx: unknown) => Promise<unknown>) => ((typeof a === 'function' ? a : b) as (tx: unknown) => Promise<unknown>)(m.tx),
}));
vi.mock('@nzila/db/auth-storage-authority', () => ({ AUTH_TENANT_ASSIGNABLE_ROLES: ['member', 'steward', 'chief_steward', 'admin'] }));
vi.mock('@/db/db', () => ({
  db: {
    select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; },
    insert: (...args: unknown[]) => { m.insert(...args); return { values: m.values }; },
  },
}));

async function loadRoute() {
  return import('../route');
}

describe('enterprise/sso/providers route (round 53 — credential redaction on create + org/role scoping)', () => {
  let capturedGetHandler: ((ctx: unknown) => unknown) | undefined;
  let capturedPostHandler: ((ctx: unknown) => unknown) | undefined;
  let capturedGetOpts: Record<string, unknown> | undefined;
  let capturedPostOpts: Record<string, unknown> | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    let call = 0;
    m.withApi.mockImplementation((opts: Record<string, unknown>, handler: (ctx: unknown) => unknown) => {
      call += 1;
      if (call === 1) { capturedGetOpts = opts; capturedGetHandler = handler; }
      else { capturedPostOpts = opts; capturedPostHandler = handler; }
      return handler;
    });
    m.audit.mockResolvedValue(undefined);
    m.tx.insert = (...args: unknown[]) => { m.insert(...args); return { values: m.values }; };
    m.from.mockReturnValue({ where: m.where });
    m.values.mockReturnValue({ returning: m.returning });
    await loadRoute();
  });

  it('GET requires at least admin role and reads org-scoped', async () => {
    expect(capturedGetOpts?.auth).toMatchObject({ required: true, minRole: 'admin' });

    m.where.mockResolvedValue([
      { id: 'sp1', name: 'Okta', samlCertificate: 'CERT-DATA', oidcClientSecret: null },
    ]);

    const result = await capturedGetHandler!({ organizationId: 'org-real' }) as Array<Record<string, unknown>>;

    expect(m.eq).toHaveBeenCalledWith('sp.organizationId', 'org-real');
    expect(result[0].samlCertificate).toBe(true);
    expect(result[0].oidcClientSecret).toBe(null);
    expect(result[0]).not.toHaveProperty('name', undefined);
  });

  it('GET never leaks raw certificate/secret values', async () => {
    m.where.mockResolvedValue([
      { id: 'sp1', samlCertificate: 'SECRET-CERT-BYTES', oidcClientSecret: 'super-secret-value' },
    ]);

    const result = await capturedGetHandler!({ organizationId: 'org-real' }) as Array<Record<string, unknown>>;

    expect(JSON.stringify(result)).not.toContain('SECRET-CERT-BYTES');
    expect(JSON.stringify(result)).not.toContain('super-secret-value');
  });

  it('POST requires admin role', () => {
    expect(capturedPostOpts?.auth).toMatchObject({ required: true, minRole: 'admin' });
  });

  // F06 R5: nothing reads a provider at sign-in, so a provider cannot be created already enabled or auto-provisioning. The attempt is
  // recorded as the specific blocked operation, in its own record, and nothing is stored.
  it.each([{ enabled: true }, { autoProvision: true }, { enabled: true, autoProvision: true }])('POST refuses to create a provider with %j and records the blocked operation', async (flags) => {
    const body = { name: 'New IdP', providerType: 'oidc', attributeMapping: { email: 'email' }, ...flags };

    let refused: { status?: number; message?: string; details?: { blockedOperation?: { operation: string } } } | undefined;
    try { await capturedPostHandler!({ body, organizationId: 'org-real', userId: 'admin-user' }); } catch (error) { refused = error as typeof refused; }

    expect(refused?.status).toBe(409);
    expect(refused?.message).toContain('auth.sso.federated_sign_in');
    expect(refused?.message).toContain('the institution approves this identity provider');
    expect(refused?.details?.blockedOperation?.operation).toBe('auth.sso.federated_sign_in');
    expect(m.audit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({
        action: 'sso.provider.activate_blocked',
        organizationId: 'org-real',
        userId: 'admin-user',
        details: expect.objectContaining({ blockedOperation: 'auth.sso.federated_sign_in', capability: 'UE-SSO-SIGN-IN', requested: Object.keys(flags) }),
      }),
      'failure',
    );
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.encryptSecret).not.toHaveBeenCalled();
  });

  it('POST still stores a staged provider (disabled, not auto-provisioning) and says it is not in effect, with what each requirement needs', async () => {
    m.returning.mockResolvedValue([{ id: 'sp-new', organizationId: 'org-real', enabled: false }]);

    const result = await capturedPostHandler!({
      body: { name: 'New IdP', providerType: 'oidc', attributeMapping: { email: 'email' }, enabled: false, autoProvision: false },
      organizationId: 'org-real',
      userId: 'admin-user',
    }) as { effect: { inEffect: boolean; blockedOperation: { operation: string } } };

    expect(result.effect).toMatchObject({ inEffect: false, blockedOperation: { operation: 'auth.sso.federated_sign_in' } });
    expect(m.insert).toHaveBeenCalledOnce();
    expect(m.audit).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'sso.provider.activate_blocked' }), 'failure');
  });

  it('GET reports per provider what stands between its configuration and sign-in, from the stored row', async () => {
    m.where.mockResolvedValue([
      { id: 'sp1', providerType: 'oidc', oidcIssuer: 'https://idp.example.test', oidcClientId: 'c', oidcClientSecret: 'enc', oidcAuthorizationEndpoint: 'a', oidcTokenEndpoint: 't', samlCertificate: null },
    ]);

    const [provider] = await capturedGetHandler!({ organizationId: 'org-real' }) as Array<{ readiness: { ready: boolean; requirements: Array<{ code: string; met: boolean }> } }>;

    expect(provider.readiness.ready).toBe(false);
    expect(provider.readiness.requirements.find((r) => r.code === 'configuration_complete')?.met).toBe(true);
    expect(provider.readiness.requirements.find((r) => r.code === 'provider_approved_by_institution')?.met).toBe(false);
    expect(JSON.stringify(provider)).not.toContain('"enc"');
  });

  it('POST create response redacts raw credential material (round 53 fix — previously echoed in the clear)', async () => {
    m.returning.mockResolvedValue([
      {
        id: 'sp-new',
        organizationId: 'org-real',
        name: 'New IdP',
        samlCertificate: 'RAW-CERT-BYTES',
        oidcClientSecret: 'raw-oidc-secret',
      },
    ]);

    const request = { json: async () => ({ name: 'New IdP', providerType: 'oidc', attributeMapping: { email: 'email' } }) };
    const result = await capturedPostHandler!({
      request,
      body: await request.json(),
      organizationId: 'org-real',
      userId: 'admin-user',
    }) as Record<string, unknown>;

    expect(result.samlCertificate).toBe(true);
    expect(result.oidcClientSecret).toBe(true);
    expect(JSON.stringify(result)).not.toContain('RAW-CERT-BYTES');
    expect(JSON.stringify(result)).not.toContain('raw-oidc-secret');
  });

  it('POST forces organizationId/createdBy from context, not client body', async () => {
    m.returning.mockResolvedValue([{ id: 'sp-new', organizationId: 'org-real', createdBy: 'admin-user' }]);

    const request = {
      json: async () => ({
        name: 'New IdP',
        providerType: 'oidc',
        attributeMapping: { email: 'email' },
        organizationId: 'attacker-org',
        createdBy: 'attacker-user',
      }),
    };
    await capturedPostHandler!({ request, body: await request.json(), organizationId: 'org-real', userId: 'admin-user' });

    expect(m.values).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-real', createdBy: 'admin-user' }),
    );
  });

  it('POST encrypts oidcClientSecret before persisting (Round 59B — credential-storage-hygiene fix)', async () => {
    m.returning.mockResolvedValue([{ id: 'sp-new', organizationId: 'org-real' }]);

    const request = {
      json: async () => ({
        name: 'New IdP',
        providerType: 'oidc',
        attributeMapping: { email: 'email' },
        oidcClientSecret: 'raw-oidc-secret',
      }),
    };
    await capturedPostHandler!({ request, body: await request.json(), organizationId: 'org-real', userId: 'admin-user' });

    expect(m.encryptSecret).toHaveBeenCalledWith('raw-oidc-secret');
    expect(m.values).toHaveBeenCalledWith(
      expect.objectContaining({ oidcClientSecret: 'encrypted(raw-oidc-secret)' }),
    );
    const insertedArgs = m.values.mock.calls[0][0];
    expect(insertedArgs.oidcClientSecret).not.toBe('raw-oidc-secret');
  });

  it('POST does not call encryptSecret when oidcClientSecret is omitted', async () => {
    m.returning.mockResolvedValue([{ id: 'sp-new', organizationId: 'org-real' }]);

    const request = {
      json: async () => ({
        name: 'New IdP',
        providerType: 'saml',
        attributeMapping: { email: 'email' },
      }),
    };
    await capturedPostHandler!({ request, body: await request.json(), organizationId: 'org-real', userId: 'admin-user' });

    expect(m.encryptSecret).not.toHaveBeenCalled();
  });

  it('POST uses the framework-parsed body without consuming the request again', async () => {
    const request = new Request('http://127.0.0.1/api/enterprise/sso/providers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New IdP',
        providerType: 'oidc',
        attributeMapping: { email: 'email' },
      }),
    });
    const body = await request.json();
    m.returning.mockResolvedValue([{ id: 'sp-new', organizationId: 'org-real' }]);
    await capturedPostHandler!({ request, body, organizationId: 'org-real', userId: 'admin-user' });
    expect(request.bodyUsed).toBe(true);
    expect(m.insert).toHaveBeenCalledOnce();
  });

  it('POST does not write if credential encryption refuses its authority', async () => {
    m.encryptSecret.mockRejectedValueOnce(new Error('Production key authority unavailable'));
    await expect(capturedPostHandler!({
      body: {
        name: 'New IdP',
        providerType: 'oidc',
        attributeMapping: { email: 'email' },
        oidcClientSecret: 'owned-synthetic-credential-only',
      },
      organizationId: 'org-real',
      userId: 'admin-user',
    })).rejects.toThrow('Production key authority unavailable');
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('POST refuses a role mapping to any role a tenant administrator cannot assign, and writes nothing', async () => {
    for (const role of ['owner', 'platform_admin', 'system_admin', 'clc_executive', 42]) {
      await expect(capturedPostHandler!({
        body: { name: 'IdP', providerType: 'oidc', attributeMapping: { email: 'email' }, roleMapping: { 'idp-admins': role } },
        organizationId: 'org-real',
        userId: 'admin-user',
      })).rejects.toMatchObject({ status: 400 });
    }
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('POST accepts an assignable role mapping and audits the creation on the same transaction', async () => {
    m.returning.mockResolvedValue([{ id: 'sp-new', organizationId: 'org-real' }]);
    await capturedPostHandler!({
      body: { name: 'IdP', providerType: 'oidc', attributeMapping: { email: 'email' }, roleMapping: { 'idp-stewards': 'steward' } },
      organizationId: 'org-real',
      userId: 'admin-user',
    });
    expect(m.audit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: 'org-real', userId: 'admin-user', action: 'sso.provider.create', resourceId: 'sp-new' }),
    );
  });

  it('POST does not report success when the audit write fails', async () => {
    m.returning.mockResolvedValue([{ id: 'sp-new', organizationId: 'org-real' }]);
    m.audit.mockRejectedValueOnce(new Error('audit down'));
    await expect(capturedPostHandler!({
      body: { name: 'IdP', providerType: 'oidc', attributeMapping: { email: 'email' } },
      organizationId: 'org-real',
      userId: 'admin-user',
    })).rejects.toThrow('audit down');
  });

  it('POST rejects an absent parsed body without writing', async () => {
    await expect(capturedPostHandler!({
      organizationId: 'org-real',
      userId: 'admin-user',
    })).rejects.toMatchObject({ status: 400 });
    expect(m.insert).not.toHaveBeenCalled();
  });
});
