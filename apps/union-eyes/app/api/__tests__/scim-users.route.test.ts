import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  auth: null as unknown,
  limit: null as unknown,
  calls: [] as Array<{ text: string; values: unknown[] }>,
  results: [] as unknown[],
}));

// The route reaches the database only through the SCIM functions of cache migration 0049; each call is recorded with its text and parameters, and
// the next queued result answers it. What the functions do on a real database is proved in db/__tests__/scim-provisioning.postgres.test.ts.
const mockTx = {
  execute: vi.fn(async (query: { strings: readonly string[]; values: unknown[] }) => {
    m.calls.push({ text: query.strings.join('?'), values: query.values });
    const next = m.results.shift();
    if (next instanceof Error) throw next;
    return next ?? [];
  }),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
    unauthorized: (msg: string) => Object.assign(new Error(msg), { status: 401 }),
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    rateLimited: () => Object.assign(new Error('rate limited'), { status: 429 }),
    externalService: (_s: string, msg: string) => Object.assign(new Error(msg), { status: 502 }),
  },
}));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: vi.fn(async () => { if (m.limit instanceof Error) throw m.limit; return m.limit; }) }));
// The identity provider's bearer-token check is exercised in lib/scim/__tests__; here it is the route's contract with it that matters.
vi.mock('@/lib/scim/scim-token', () => ({ authenticateScimRequest: vi.fn(async () => m.auth) }));
const contexts = vi.hoisted(() => ({
  system: vi.fn(),
  tenant: vi.fn(() => { throw new Error('a SCIM route has no session, so it never opens a tenant context'); }),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: contexts.system,
  withRLSContext: contexts.tenant,
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }), {}),
}));

async function loadRoute() {
  return import('../scim/v2/[organizationId]/Users/route');
}

// An identity provider has no signed-in user: the route receives only the request and the path parameters.
const ctx = { params: { organizationId: 'org_1' } };
const SCIM_OK = { ok: true, organizationId: 'org_1', configurationId: 'cfg_1', syncUsers: true };

const provision = (body: unknown) =>
  new NextRequest('http://localhost/api/scim/v2/org_1/Users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const memberColumns = (over: Record<string, unknown> = {}) => ({
  o_id: 'm-new',
  o_user_id: 'scim:org_1:jane@example.com',
  o_name: 'Jane Doe',
  o_email: 'jane@example.com',
  o_status: 'pending',
  o_joined_at: null,
  o_created_at: '2026-01-01T00:00:00.000Z',
  o_updated_at: '2026-01-01T00:00:00.000Z',
  o_metadata: { scim: { userName: 'jane@example.com', externalId: 'idp-1', link: 'unlinked' } },
  ...over,
});
const provisioned = (outcome: string, over: Record<string, unknown> = {}) => [{ o_outcome: outcome, ...memberColumns(over) }];
const notLive = () => Object.assign(new Error('Failed query'), { cause: { code: '42501' } });

const bodyOf = async (response: Response) => (await response.json()) as Record<string, any>;
// A refusal inside the handler is a SCIM error (RFC 7644 section 3.12), not the framework's envelope: that is what an identity provider reads.
async function expectScimError(promise: Promise<Response>, status: number, expected: { scimType?: string; detail?: string } = {}) {
  const response = await promise;
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/scim+json');
  expect(await bodyOf(response)).toMatchObject({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: String(status),
    ...(expected.scimType ? { scimType: expected.scimType } : {}),
    ...(expected.detail ? { detail: expect.stringContaining(expected.detail) } : {}),
  });
}

describe('scim users route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.calls = [];
    m.results = [];
    m.auth = SCIM_OK;
    m.limit = { allowed: true, resetIn: 60 };
    m.persistAtomicAudit.mockResolvedValue(undefined);
    contexts.system.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

    // The framework runs the route's declared machine credential before its handler and hands the verified caller to it.
    m.withApi.mockImplementation(
      (cfg: any, handler: (ctx: any) => Promise<any>) =>
        async (request: NextRequest, c: any = ctx) => {
          const machine = await cfg.auth.machine(request, c.params);
          return handler({ ...c, request, machine });
        },
    );
  });

  it('declares the bearer token as its machine credential, not optional authentication', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/scim/v2/[organizationId]/Users/route.ts'), 'utf8');
    expect(source.match(/auth: \{ machine: scimCaller \}/g)).toHaveLength(2);
    expect(source).not.toMatch(/required\s*:\s*false/);
  });

  it('GET returns SCIM list response with pagination', async () => {
    const { GET } = await loadRoute();
    m.results = [[{ total: '1' }], [memberColumns({ o_id: 'm1', o_user_id: 'john@example.com', o_email: 'john@example.com', o_name: 'John Smith', o_status: 'active', o_metadata: null })]];

    const response = await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?startIndex=1&count=10'), ctx);
    const result = await bodyOf(response);

    // The body is the SCIM list response itself, not wrapped in the framework's envelope.
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/scim+json');
    expect(result.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:ListResponse']);
    expect(result.totalResults).toBe(1);
    expect(result.itemsPerPage).toBe(1);
    expect(result.Resources[0]).toMatchObject({ id: 'm1', userName: 'john@example.com', active: true });
  });

  it('GET refuses to list another organization\u2019s users, whatever the path names', async () => {
    const { GET } = await loadRoute();

    await expect(
      GET(new NextRequest('http://localhost/api/scim/v2/org_2/Users'), { ...ctx, params: { organizationId: 'org_2' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockTx.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['no token', { ok: false, status: 401, reason: 'missing_token' }, 401],
    ['an unknown token', { ok: false, status: 401, reason: 'invalid_token' }, 401],
    ['a revoked token', { ok: false, status: 401, reason: 'revoked' }, 401],
    ['an expired token', { ok: false, status: 401, reason: 'expired' }, 401],
    ['a disabled configuration', { ok: false, status: 403, reason: 'disabled' }, 403],
  ])('answers %s with %i and touches no data', async (_label, auth, status) => {
    const { GET, POST } = await loadRoute();
    m.auth = auth;
    await expect(GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users'), ctx)).rejects.toMatchObject({ status });
    await expect(POST(provision({ userName: 'jane@example.com' }), ctx)).rejects.toMatchObject({ status });
    expect(contexts.system).not.toHaveBeenCalled();
    expect(mockTx.execute).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('answers 429 before any token lookup when the client is over its limit, and refuses when the limiter is unavailable', async () => {
    const { GET } = await loadRoute();
    m.limit = { allowed: false, resetIn: 30 };
    await expect(GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users'), ctx)).rejects.toMatchObject({ status: 429 });
    m.limit = new Error('redis down');
    await expect(GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users'), ctx)).rejects.toMatchObject({ status: 502 });
    expect(mockTx.execute).not.toHaveBeenCalled();
  });

  it('POST refuses provisioning when user sync is switched off for the organization', async () => {
    const { POST } = await loadRoute();
    m.auth = { ...SCIM_OK, syncUsers: false };
    await expectScimError(POST(provision({ userName: 'jane@example.com' }), ctx), 403, { detail: 'not enabled' });
    expect(mockTx.execute).not.toHaveBeenCalled();
  });

  it('POST throws bad request when userName is missing', async () => {
    const { POST } = await loadRoute();

    await expectScimError(POST(provision({ name: { givenName: 'No', familyName: 'User' } }), ctx), 400, { scimType: 'invalidValue', detail: 'userName' });
  });

  it('POST provisions a user, maps to a SCIM payload and audits on the same transaction', async () => {
    const { POST } = await loadRoute();
    m.results = [provisioned('created')];

    const response = await POST(
      provision({
        userName: 'jane@example.com',
        externalId: 'idp-1',
        name: { givenName: 'Jane', familyName: 'Doe' },
        emails: [{ value: 'jane@example.com', primary: true }],
      }),
      ctx,
    );

    expect(response.status).toBe(201);
    expect(await bodyOf(response)).toMatchObject({ id: 'm-new', userName: 'jane@example.com', externalId: 'idp-1', active: false, name: { formatted: 'Jane Doe' } });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'system:scim:cfg_1',
        action: 'scim.user.provision',
        resourceId: 'm-new',
        details: { provisionedUserName: 'jane@example.com', externalId: 'idp-1', outcome: 'created' },
      }),
    );
  });

  it('POST refuses to provision into another organization', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST(provision({ userName: 'jane@example.com' }), { ...ctx, params: { organizationId: 'org_2' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(mockTx.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['the user already exists', 'exists', 'userName'],
    ['another person already has the externalId', 'external_id_conflict', 'externalId'],
  ])('POST answers a conflict and writes no audit when %s', async (_label, outcome, word) => {
    const { POST } = await loadRoute();
    m.results = [outcome === 'exists' ? provisioned('exists') : [{ o_outcome: outcome, ...memberColumns({ o_id: null, o_user_id: null, o_status: null }) }]];

    await expectScimError(POST(provision({ userName: 'jane@example.com', externalId: 'idp-1' }), ctx), 409, { scimType: 'uniqueness', detail: word });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST fails the provisioning when its audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.results = [provisioned('created')];
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(POST(provision({ userName: 'jane@example.com' }), ctx)).rejects.toThrow('audit unavailable');
  });

  // DEF-0B11-IDS-SCIM-LIST-INCLUDES-REMOVED-MEMBERS-AS-ACTIVE-AND-READS-THE-WHOLE-ROSTER-BEFORE-PAGING
  it('GET pages in SQL from the requested start index and reports the live total', async () => {
    const { GET } = await loadRoute();
    m.results = [[{ total: 37 }], [memberColumns({ o_id: 'm1', o_user_id: 'a', o_email: 'a@example.com', o_name: 'A B', o_status: 'active', o_metadata: null })]];
    const result = await bodyOf(await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?startIndex=21&count=10'), ctx));
    expect(m.calls[1].text).toContain('ue_scim_list_members');
    expect(m.calls[1].values).toEqual(['cfg_1', 'org_1', 20, 10]);
    expect(result.totalResults).toBe(37);
  });

  it('GET with count=0 reads only the total', async () => {
    const { GET } = await loadRoute();
    m.results = [[{ total: 5 }]];
    expect(await bodyOf(await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?count=0'), ctx))).toMatchObject({ totalResults: 5, itemsPerPage: 0, Resources: [] });
    expect(m.calls).toHaveLength(1);
  });

  // DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID-AND-ACTIVATES-WITHOUT-ACCEPTANCE
  it('POST asks for a person and nothing else: it passes no role and no status, so naming a user cannot activate it or raise its role', async () => {
    const { POST } = await loadRoute();
    m.results = [provisioned('created')];
    await POST(provision({ userName: 'jane@example.com', externalId: 'idp-1', role: 'admin', status: 'active' }), ctx);
    expect(m.calls[0].text).toContain('ue_scim_provision_member');
    expect(m.calls[0].values).toEqual(['cfg_1', 'org_1', 'jane@example.com', 'idp-1', 'jane@example.com', 'jane@example.com']);
  });

  it('POST provisions a removed member again and audits that as a re-provisioning', async () => {
    const { POST } = await loadRoute();
    m.results = [provisioned('reprovisioned')];
    const response = await POST(provision({ userName: 'jane@example.com' }), ctx);
    expect(response.status).toBe(201);
    expect(await bodyOf(response)).toMatchObject({ id: 'm-new', active: false });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockTx, expect.objectContaining({ action: 'scim.user.reprovision', details: expect.objectContaining({ outcome: 'reprovisioned' }) }));
  });

  it('answers a configuration the database no longer finds live with a refusal, and audits nothing', async () => {
    const { GET, POST } = await loadRoute();
    m.results = [notLive()];
    await expectScimError(POST(provision({ userName: 'jane@example.com' }), ctx), 403);
    m.results = [notLive()];
    await expectScimError(GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users'), ctx), 403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('runs in the system context for every operation and never opens a tenant context, which a session-less caller cannot have', async () => {
    const { GET, POST } = await loadRoute();
    m.results = [[{ total: 0 }], [], provisioned('created')];
    await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users'), ctx);
    await POST(provision({ userName: 'jane@example.com' }), ctx);
    expect(contexts.system).toHaveBeenCalledTimes(2);
    expect(contexts.tenant).not.toHaveBeenCalled();
  });

  // DEF-0B11-IDS-SCIM-PROVISION-BODY-IS-UNVALIDATED-AND-MALFORMED-INPUT-IS-A-500
  it.each([
    ['a non-string userName', { userName: 7 }],
    ['an empty userName', { userName: '   ' }],
    ['an oversized userName', { userName: 'x'.repeat(400) }],
    ['an empty externalId', { userName: 'a', externalId: '  ' }],
    ['an oversized externalId', { userName: 'a', externalId: 'e'.repeat(256) }],
    ['a non-string externalId', { userName: 'a', externalId: 12 }],
    ['a malformed e-mail', { userName: 'a', emails: [{ value: 'not-an-email' }] }],
    ['too many e-mails', { userName: 'a', emails: Array.from({ length: 11 }, () => ({ value: 'a@example.com' })) }],
  ])('POST answers 400, writing and auditing nothing, for %s', async (_label, body) => {
    const { POST } = await loadRoute();
    await expectScimError(POST(provision(body), ctx), 400, { scimType: 'invalidValue' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(mockTx.execute).not.toHaveBeenCalled();
  });

  it('POST answers 400 for a body that is not JSON', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost/api/scim/v2/org_1/Users', { method: 'POST', body: 'not json' });
    await expectScimError(POST(request, ctx), 400, { scimType: 'invalidValue' });
  });

  it('GET looks one person up by userName or externalId, which is how an identity provider asks whether a person already exists', async () => {
    const { GET } = await loadRoute();
    m.results = [[memberColumns()], []];

    const found = await bodyOf(await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?filter=' + encodeURIComponent('userName eq "Jane@Example.com"')), ctx));
    expect(m.calls[0].text).toContain('ue_scim_find_member');
    expect(m.calls[0].values).toEqual(['cfg_1', 'org_1', 'userName', 'Jane@Example.com']);
    expect(found).toMatchObject({ totalResults: 1, startIndex: 1, itemsPerPage: 1, Resources: [{ id: 'm-new', userName: 'jane@example.com' }] });

    const none = await bodyOf(await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?filter=' + encodeURIComponent('externalId eq "idp-404"')), ctx));
    expect(m.calls[1].values).toEqual(['cfg_1', 'org_1', 'externalId', 'idp-404']);
    expect(none).toMatchObject({ totalResults: 0, Resources: [] });
  });

  it('GET refuses a filter it does not support instead of running it as if it matched nobody, so no duplicate is provisioned', async () => {
    const { GET } = await loadRoute();
    for (const filter of ['emails.value co "example"', 'userName sw "j"', 'userName eq "a" or userName eq "b"', 'active eq true']) {
      await expectScimError(GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?filter=' + encodeURIComponent(filter)), ctx), 400, { scimType: 'invalidFilter' });
    }
    expect(mockTx.execute).not.toHaveBeenCalled();
  });

  it('gives each person its location when the public address of the application is configured', async () => {
    const { GET } = await loadRoute();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test/';
    try {
      m.results = [[{ total: 1 }], [memberColumns({ o_id: '11111111-1111-4111-8111-111111111111' })]];
      const list = await bodyOf(await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users'), ctx));
      expect(list.Resources[0].meta.location).toBe('https://app.example.test/api/scim/v2/org_1/Users/11111111-1111-4111-8111-111111111111');
    } finally {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });
});
