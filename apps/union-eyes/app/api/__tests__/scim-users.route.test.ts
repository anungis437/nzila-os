import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createScimDatabase, type ScimDatabase } from '@/lib/scim/__tests__/scim-pglite';

// The SCIM users collection route, run against the REAL platform 0059 migration on PGlite: the route's actual statements, the real data layer and the
// real event log, with the identity provider's token check and the audit chain replaced by their contracts. What the same route does against the combined
// schema as the real roles, under concurrency, is proved in db/__tests__/scim-provisioning.postgres.test.ts.

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  auth: null as unknown,
  limit: null as unknown,
  database: null as unknown,
  system: vi.fn(),
  tenant: vi.fn(() => { throw new Error('a SCIM route has no session, so it never opens a tenant context'); }),
}));

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
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.system, withRLSContext: m.tenant }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

async function loadRoute() {
  return import('../scim/v2/[organizationId]/Users/route');
}

const ORG = randomUUID();
let database: ScimDatabase;
let config: string;
// An identity provider has no signed-in user: the route receives only the request and the path parameters.
const ctx = { params: { organizationId: ORG } };

const provision = (body: unknown) =>
  new NextRequest(`http://localhost/api/scim/v2/${ORG}/Users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  });
const listUrl = (query = '') => new NextRequest(`http://localhost/api/scim/v2/${ORG}/Users${query}`);

const rows = async () => (await database.pg.query<Record<string, any>>('SELECT * FROM scim_provisioned_users ORDER BY created_at, id')).rows;
// Insertion order is what an administrator reads: ctid breaks a tie between events written within one clock tick.
const events = async () => (await database.pg.query<Record<string, any>>('SELECT * FROM scim_events_log ORDER BY created_at, ctid')).rows;
// Each person gets its own, strictly increasing creation time: the list pages by (created_at, id), and rows written in one clock tick would tie.
const seed = async (count: number, prefix = 'person') => {
  for (let i = 1; i <= count; i += 1) {
    await database.pg.query(
      `INSERT INTO scim_provisioned_users (organization_id, config_id, user_name, user_name_key, display_name, email, created_at) VALUES ($1, $2, $3, $3, $4, $3, $5::timestamptz)`,
      [ORG, config, `${prefix}${i}@example.test`, `Person ${i}`, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()],
    );
  }
};

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

beforeAll(async () => {
  database = await createScimDatabase();
  m.database = database;
});
afterAll(async () => {
  await database.pg.close();
});

describe('scim users route', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await database.reset();
    config = await database.configuration(ORG);
    m.auth = { ok: true, organizationId: ORG, configurationId: config, syncUsers: true };
    m.limit = { allowed: true, resetIn: 60 };
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.system.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => database.db.transaction(async (tx) => fn(tx)));

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

  it('GET returns the SCIM list response with pagination, the live total, and the person\u2019s own attributes', async () => {
    const { GET } = await loadRoute();
    await seed(3);

    const response = await GET(listUrl('?startIndex=1&count=2'), ctx);
    const result = await bodyOf(response);

    // The body is the SCIM list response itself, not wrapped in the framework's envelope.
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/scim+json');
    expect(result.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:ListResponse']);
    expect(result).toMatchObject({ totalResults: 3, itemsPerPage: 2, startIndex: 1 });
    expect(result.Resources[0]).toMatchObject({ userName: 'person1@example.test', active: false, name: { formatted: 'Person 1' } });
  });

  it('GET refuses to list another organization\u2019s users, whatever the path names', async () => {
    const { GET } = await loadRoute();

    await expect(GET(new NextRequest('http://localhost/api/scim/v2/other/Users'), { params: { organizationId: 'other' } })).rejects.toMatchObject({ status: 404 });
    expect(m.system).not.toHaveBeenCalled();
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
    await expect(GET(listUrl(), ctx)).rejects.toMatchObject({ status });
    await expect(POST(provision({ userName: 'jane@example.test' }), ctx)).rejects.toMatchObject({ status });
    expect(m.system).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it('answers 429 before any token lookup when the client is over its limit, and refuses when the limiter is unavailable', async () => {
    const { GET } = await loadRoute();
    m.limit = { allowed: false, resetIn: 30 };
    await expect(GET(listUrl(), ctx)).rejects.toMatchObject({ status: 429 });
    m.limit = new Error('redis down');
    await expect(GET(listUrl(), ctx)).rejects.toMatchObject({ status: 502 });
    expect(m.system).not.toHaveBeenCalled();
  });

  it('POST refuses provisioning when user sync is switched off for the organization', async () => {
    const { POST } = await loadRoute();
    m.auth = { ok: true, organizationId: ORG, configurationId: config, syncUsers: false };
    await expectScimError(POST(provision({ userName: 'jane@example.test' }), ctx), 403, { detail: 'not enabled' });
    expect(m.system).not.toHaveBeenCalled();
  });

  it('POST throws bad request when userName is missing', async () => {
    const { POST } = await loadRoute();

    await expectScimError(POST(provision({ name: { givenName: 'No', familyName: 'User' } }), ctx), 400, { scimType: 'invalidValue', detail: 'userName' });
  });

  it('POST provisions a pending person, answers the SCIM resource, audits and logs the event on the same transaction, and invents nothing', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      provision({
        userName: 'jane@example.test',
        externalId: 'idp-1',
        name: { givenName: 'Jane', familyName: 'Doe' },
        emails: [{ value: 'jane@example.test', primary: true }],
      }),
      ctx,
    );

    expect(response.status).toBe(201);
    const created = await bodyOf(response);
    expect(created).toMatchObject({ userName: 'jane@example.test', externalId: 'idp-1', active: false, name: { formatted: 'Jane Doe' }, emails: [{ value: 'jane@example.test' }] });
    expect(await rows()).toMatchObject([{ id: created.id, organization_id: ORG, config_id: config, status: 'pending', external_id: 'idp-1', display_name: 'Jane Doe', email: 'jane@example.test', deleted_at: null }]);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG,
        userId: `system:scim:${config}`,
        action: 'scim.user.provision',
        resourceType: 'scim_provisioned_users',
        resourceId: created.id,
        details: { provisionedUserName: 'jane@example.test', externalId: 'idp-1', outcome: 'created' },
      }),
    );
    expect(await events()).toMatchObject([
      { config_id: config, organization_id: ORG, event_type: 'user.created', resource_type: 'User', resource_id: created.id, operation: 'POST', request_path: `/api/scim/v2/${ORG}/Users`, status: 'success', status_code: 201, authenticated_as: `scim:${config}`, ip_address: '203.0.113.7', request_body: null, response_body: null },
    ]);
  });

  it('POST stores no name and no e-mail address that the identity provider did not send', async () => {
    const { POST } = await loadRoute();
    const created = await bodyOf(await POST(provision({ userName: 'bare@example.test' }), ctx));
    expect(created).toMatchObject({ userName: 'bare@example.test', name: { formatted: '' }, emails: [] });
    expect(await rows()).toMatchObject([{ display_name: null, email: null, external_id: null }]);
  });

  it('POST refuses to provision into another organization', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST(provision({ userName: 'jane@example.test' }), { params: { organizationId: 'other' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.system).not.toHaveBeenCalled();
  });

  it.each([
    ['the user already exists', { userName: 'JANE@example.test' }, 'userName'],
    ['another person already has the externalId', { userName: 'other@example.test', externalId: 'idp-1' }, 'externalId'],
  ])('POST answers a conflict and writes no audit and no event when %s', async (_label, body, word) => {
    const { POST } = await loadRoute();
    await POST(provision({ userName: 'jane@example.test', externalId: 'idp-1' }), ctx);
    m.persistAtomicAudit.mockClear();
    const eventsBefore = (await events()).length;

    await expectScimError(POST(provision(body), ctx), 409, { scimType: 'uniqueness', detail: word });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect((await events()).length).toBe(eventsBefore);
    expect(await rows()).toHaveLength(1);
  });

  it('POST fails the provisioning when its audit cannot be written, and leaves nothing behind', async () => {
    const { POST } = await loadRoute();
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(POST(provision({ userName: 'jane@example.test' }), ctx)).rejects.toThrow('audit unavailable');
    expect(await rows()).toEqual([]);
    expect(await events()).toEqual([]);
  });

  // DEF-0B11-IDS-SCIM-LIST-INCLUDES-REMOVED-MEMBERS-AS-ACTIVE-AND-READS-THE-WHOLE-ROSTER-BEFORE-PAGING
  it('GET pages in SQL from the requested start index, reports the live total, and leaves out a removed person', async () => {
    const { GET } = await loadRoute();
    await seed(25);
    await database.pg.query(`UPDATE scim_provisioned_users SET deleted_at = now() WHERE user_name_key = 'person25@example.test'`);
    const result = await bodyOf(await GET(listUrl('?startIndex=21&count=10'), ctx));
    expect(result).toMatchObject({ totalResults: 24, startIndex: 21, itemsPerPage: 4 });
    expect(result.Resources.map((r: { userName: string }) => r.userName)).toEqual(['person21@example.test', 'person22@example.test', 'person23@example.test', 'person24@example.test']);
  });

  it('GET with count=0 reads only the total, and a count that is not a number reads as zero', async () => {
    const { GET } = await loadRoute();
    await seed(5);
    expect(await bodyOf(await GET(listUrl('?count=0'), ctx))).toMatchObject({ totalResults: 5, itemsPerPage: 0, Resources: [] });
    expect(await bodyOf(await GET(listUrl('?count=abc'), ctx))).toMatchObject({ totalResults: 5, itemsPerPage: 0, Resources: [] });
    expect(await bodyOf(await GET(listUrl('?startIndex=-3&count=2'), ctx))).toMatchObject({ startIndex: 1, itemsPerPage: 2 });
  });

  // DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID-AND-ACTIVATES-WITHOUT-ACCEPTANCE
  it('POST asks for a person and nothing else: a role or status in the body changes nothing, so naming a user cannot activate or promote it', async () => {
    const { POST } = await loadRoute();
    await POST(provision({ userName: 'jane@example.test', externalId: 'idp-1', role: 'admin', status: 'active', active: true }), ctx);
    expect(await rows()).toMatchObject([{ status: 'pending', deprovisioned_at: null }]);
    expect(Object.keys((await rows())[0])).not.toContain('role');
  });

  it('POST provisions a removed person again and audits that as a re-provisioning', async () => {
    const { POST } = await loadRoute();
    await seed(1, 'jane');
    await database.pg.query(`UPDATE scim_provisioned_users SET deleted_at = now(), status = 'revoked', deprovisioned_at = now(), deprovisioned_by = 'scim', deprovisioned_action = 'delete'`);
    const response = await POST(provision({ userName: 'jane1@example.test' }), ctx);
    expect(response.status).toBe(201);
    expect(await bodyOf(response)).toMatchObject({ active: false });
    expect(await rows()).toMatchObject([{ status: 'pending', deleted_at: null, deprovisioned_at: null }]);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'scim.user.reprovision', details: expect.objectContaining({ outcome: 'reprovisioned' }) }));
  });

  it('answers a configuration the database no longer finds live with a refusal, and audits nothing', async () => {
    const { GET, POST } = await loadRoute();
    // The token was valid a moment ago; the configuration is revoked before the operation runs.
    await database.pg.query('UPDATE scim_configurations SET revoked_at = now() WHERE id = $1', [config]);
    await expectScimError(POST(provision({ userName: 'jane@example.test' }), ctx), 403);
    await expectScimError(GET(listUrl(), ctx), 403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it('runs in the system context for every operation and never opens a tenant context, which a session-less caller cannot have', async () => {
    const { GET, POST } = await loadRoute();
    await GET(listUrl(), ctx);
    await POST(provision({ userName: 'jane@example.test' }), ctx);
    expect(m.system).toHaveBeenCalledTimes(2);
    expect(m.tenant).not.toHaveBeenCalled();
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
    ['too many e-mails', { userName: 'a', emails: Array.from({ length: 11 }, () => ({ value: 'a@example.test' })) }],
  ])('POST answers 400, writing and auditing nothing, for %s', async (_label, body) => {
    const { POST } = await loadRoute();
    await expectScimError(POST(provision(body), ctx), 400, { scimType: 'invalidValue' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.system).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it('POST answers 400 for a body that is not JSON', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest(`http://localhost/api/scim/v2/${ORG}/Users`, { method: 'POST', body: 'not json' });
    await expectScimError(POST(request, ctx), 400, { scimType: 'invalidValue' });
  });

  it('GET looks one person up by userName or externalId, which is how an identity provider asks whether a person already exists', async () => {
    const { GET } = await loadRoute();
    await POST_ONE('Jane@Example.test', 'idp-1');

    const found = await bodyOf(await GET(listUrl('?filter=' + encodeURIComponent('userName eq "JANE@example.test"')), ctx));
    expect(found).toMatchObject({ totalResults: 1, startIndex: 1, itemsPerPage: 1, Resources: [{ userName: 'Jane@Example.test', externalId: 'idp-1' }] });
    const byExternal = await bodyOf(await GET(listUrl('?filter=' + encodeURIComponent('externalId eq "idp-1"')), ctx));
    expect(byExternal.Resources).toHaveLength(1);

    const none = await bodyOf(await GET(listUrl('?filter=' + encodeURIComponent('externalId eq "idp-404"')), ctx));
    expect(none).toMatchObject({ totalResults: 0, Resources: [] });
  });

  it('GET refuses a filter it does not support instead of running it as if it matched nobody, so no duplicate is provisioned', async () => {
    const { GET } = await loadRoute();
    for (const filter of ['emails.value co "example"', 'userName sw "j"', 'userName eq "a" or userName eq "b"', 'active eq true']) {
      await expectScimError(GET(listUrl('?filter=' + encodeURIComponent(filter)), ctx), 400, { scimType: 'invalidFilter' });
    }
    expect(m.system).not.toHaveBeenCalled();
  });

  it('gives each person its location when the public address of the application is configured', async () => {
    const { GET } = await loadRoute();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test/';
    try {
      await seed(1);
      const list = await bodyOf(await GET(listUrl(), ctx));
      expect(list.Resources[0].meta.location).toBe(`https://app.example.test/api/scim/v2/${ORG}/Users/${list.Resources[0].id}`);
    } finally {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  async function POST_ONE(userName: string, externalId: string) {
    const { POST } = await loadRoute();
    return POST(provision({ userName, externalId }), ctx);
  }
});
