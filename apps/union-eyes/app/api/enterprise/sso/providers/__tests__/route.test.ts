import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn((message: string) => ({ apiError: true, status: 400, message })),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  encryptSecret: vi.fn(async (plaintext: string) => `encrypted(${plaintext})`),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: m.badRequest } }));
vi.mock('@/db/schema/sso-scim-schema', () => ({
  ssoProviders: { id: 'sp.id', organizationId: 'sp.organizationId' },
}));
vi.mock('drizzle-orm', () => ({ eq: m.eq }));
vi.mock('@/lib/encryption', () => ({ encryptSecret: m.encryptSecret }));
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
    m.from.mockReturnValue({ where: m.where });
    m.values.mockReturnValue({ returning: m.returning });
    await loadRoute();
  });

  it('GET requires at least member role and reads org-scoped', async () => {
    expect(capturedGetOpts?.auth).toMatchObject({ required: true, minRole: 'member' });

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
    await capturedPostHandler!({ request, organizationId: 'org-real', userId: 'admin-user' });

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
    await capturedPostHandler!({ request, organizationId: 'org-real', userId: 'admin-user' });

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
    await capturedPostHandler!({ request, organizationId: 'org-real', userId: 'admin-user' });

    expect(m.encryptSecret).not.toHaveBeenCalled();
  });
});
