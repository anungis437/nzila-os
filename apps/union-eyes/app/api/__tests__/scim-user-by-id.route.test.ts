import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createScimDatabase, type ScimDatabase } from '@/lib/scim/__tests__/scim-pglite';

// The SCIM single-user routes, run against the REAL platform 0059 migration on PGlite: the routes' actual statements, the real data layer and the real
// event log, with the identity provider's token check and the audit chain replaced by their contracts. What the same routes do against the combined
// schema as the real roles, under concurrency, is proved in db/__tests__/scim-provisioning.postgres.test.ts.

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  auth: null as unknown,
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
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, resetIn: 60 })) }));
vi.mock('@/lib/scim/scim-token', () => ({ authenticateScimRequest: vi.fn(async () => m.auth) }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.system, withRLSContext: m.tenant }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

const ORG = randomUUID();
const ID = randomUUID();
let database: ScimDatabase;
let CONFIG: string;
const ctx = (id: string = ID, organizationId: string = ORG) => ({ params: { organizationId, id } });
const url = (id: string = ID) => `http://localhost/api/scim/v2/${ORG}/Users/${id}`;
const authOk = (syncUsers = true) => ({ ok: true, organizationId: ORG, configurationId: CONFIG, syncUsers });

const loadItem = () => import('../scim/v2/[organizationId]/Users/[id]/route');
const loadConfig = () => import('../scim/v2/[organizationId]/ServiceProviderConfig/route');

const row = async (id: string = ID) => (await database.pg.query<Record<string, any>>('SELECT * FROM scim_provisioned_users WHERE id = $1', [id])).rows[0];
const events = async (id: string = ID) =>
  (await database.pg.query<Record<string, any>>('SELECT event_type, operation, status_code FROM scim_events_log WHERE resource_id = $1 ORDER BY created_at, id', [id])).rows.map((r) => `${r.event_type} ${r.operation} ${r.status_code}`);
const auditActions = () => m.persistAtomicAudit.mock.calls.map((call) => (call[1] as { action: string }).action);
const person = async (over: { id?: string; userName?: string; externalId?: string | null; name?: string | null; email?: string | null; status?: string; by?: string | null; org?: string; config?: string } = {}) => {
  const id = over.id ?? ID;
  const status = over.status ?? 'pending';
  const userName = over.userName ?? 'jane@example.test';
  await database.pg.query(
    `INSERT INTO scim_provisioned_users (id, organization_id, config_id, user_name, user_name_key, external_id, display_name, email, status, deprovisioned_at, deprovisioned_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, over.org ?? ORG, over.config ?? CONFIG, userName, userName.toLowerCase(), over.externalId === undefined ? 'idp-1' : over.externalId, over.name === undefined ? 'Jane Doe' : over.name, over.email === undefined ? 'jane@example.test' : over.email, status, status === 'pending' ? null : new Date().toISOString(), status === 'pending' ? null : (over.by ?? 'scim')],
  );
  return id;
};

const bodyOf = async (response: Response) => (await response.json()) as Record<string, any>;
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

const PATCH_OP = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
const patchRequest = (Operations: unknown[], id: string = ID) =>
  new NextRequest(url(id), { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8' }, body: JSON.stringify({ schemas: [PATCH_OP], Operations }) });
const putRequest = (body: unknown) => new NextRequest(url(), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const deleteRequest = (id: string = ID) => new NextRequest(url(id), { method: 'DELETE' });

beforeAll(async () => {
  database = await createScimDatabase();
  m.database = database;
});
afterAll(async () => {
  await database.pg.close();
});

describe('scim user routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await database.reset();
    CONFIG = await database.configuration(ORG);
    m.auth = authOk();
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.system.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => database.db.transaction(async (tx) => fn(tx)));
    m.withApi.mockImplementation((cfg: any, handler: (c: any) => Promise<any>) => async (request: NextRequest, c: any = ctx()) => {
      const machine = await cfg.auth.machine(request, c.params);
      return handler({ ...c, request, machine });
    });
  });

  describe('GET', () => {
    it('returns one person this stream provisioned', async () => {
      const { GET } = await loadItem();
      await person();
      const response = await GET(new NextRequest(url()), ctx());
      expect(response.status).toBe(200);
      expect(await bodyOf(response)).toMatchObject({ id: ID, userName: 'jane@example.test', externalId: 'idp-1', active: false });
    });

    it('answers 404 for a person who is not there, and for an id that cannot name one without asking the database', async () => {
      const { GET } = await loadItem();
      await expectScimError(GET(new NextRequest(url()), ctx()), 404, { detail: 'not found' });
      m.system.mockClear();
      for (const bad of ['not-a-uuid', '1', '../x', `${ID}'--`]) await expectScimError(GET(new NextRequest(url('x')), ctx(bad)), 404);
      expect(m.system).not.toHaveBeenCalled();
    });

    it('does not find a removed person, a person of another organization, or a person provisioned by another configuration of this one only by id', async () => {
      const { GET } = await loadItem();
      const otherOrg = randomUUID();
      const otherConfig = await database.configuration(otherOrg);
      const theirs = await person({ id: randomUUID(), userName: 'theirs@example.test', org: otherOrg, config: otherConfig });
      await expectScimError(GET(new NextRequest(url(theirs)), ctx(theirs)), 404);
      await person();
      await database.pg.query('UPDATE scim_provisioned_users SET deleted_at = now() WHERE id = $1', [ID]);
      await expectScimError(GET(new NextRequest(url()), ctx()), 404);
    });

    it('refuses another organization, whatever the path names, before the database is asked', async () => {
      const { GET } = await loadItem();
      await expect(GET(new NextRequest(url()), ctx(ID, randomUUID()))).rejects.toMatchObject({ status: 404 });
      expect(m.system).not.toHaveBeenCalled();
    });
  });

  describe('PATCH', () => {
    it('deprovisions on active false (Entra spells it as a string) by the organization\u2019s configured action, audits it and logs one event', async () => {
      const { PATCH } = await loadItem();
      await person();
      const response = await PATCH(patchRequest([{ op: 'Replace', path: 'active', value: 'False' }]), ctx());
      expect(response.status).toBe(200);
      expect(await bodyOf(response)).toMatchObject({ id: ID, active: false });
      // The caller names no action: it is read from the configuration.
      expect(await row()).toMatchObject({ status: 'suspended', deprovisioned_action: 'suspend', deprovisioned_by: 'scim', deprovisioned_via: 'patch', deleted_at: null });
      expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: ORG,
          userId: `system:scim:${CONFIG}`,
          action: 'scim.user.deprovision',
          resourceType: 'scim_provisioned_users',
          resourceId: ID,
          details: { action: 'suspend', from: 'pending', via: 'patch' },
        }),
      );
      expect(await events()).toEqual(['user.deleted PATCH 200']);
    });

    it('does nothing, and audits and logs nothing, for a person who is already deprovisioned', async () => {
      const { PATCH } = await loadItem();
      await person({ status: 'suspended' });
      const response = await PATCH(patchRequest([{ op: 'replace', value: { active: false } }]), ctx());
      expect(response.status).toBe(200);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
      expect(await events()).toEqual([]);
    });

    it('restores a person this stream deprovisioned, and audits the restoration', async () => {
      const { PATCH } = await loadItem();
      await person({ status: 'suspended' });
      const response = await PATCH(patchRequest([{ op: 'replace', path: 'active', value: true }]), ctx());
      expect(response.status).toBe(200);
      expect(await row()).toMatchObject({ status: 'pending', deprovisioned_at: null, deprovisioned_by: null });
      expect((await row()).reactivated_at).not.toBeNull();
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'scim.user.reactivate', details: { from: 'suspended', to: 'pending', via: 'patch' } }));
      expect(await events()).toEqual(['user.updated PATCH 200']);
    });

    it('refuses to restore a person the organization itself suspended, and writes, audits and logs nothing', async () => {
      const { PATCH } = await loadItem();
      await person({ status: 'suspended', by: 'organization' });
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: true }]), ctx()), 409, { detail: 'suspended by the organization' });
      expect(await row()).toMatchObject({ status: 'suspended', deprovisioned_by: 'organization' });
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
      expect(await events()).toEqual([]);
    });

    it('updates the identity provider\u2019s attributes, keeps the other half of the name, and audits the fields and not their values', async () => {
      const { PATCH } = await loadItem();
      await person();
      await PATCH(
        patchRequest([
          { op: 'replace', path: 'name.givenName', value: 'Janet' },
          { op: 'replace', path: 'emails[type eq "work"].value', value: 'janet@example.test' },
          { op: 'replace', path: 'externalId', value: 'idp-2' },
        ]),
        ctx(),
      );
      expect(await row()).toMatchObject({ display_name: 'Janet Doe', email: 'janet@example.test', external_id: 'idp-2', status: 'pending' });
      const audit = m.persistAtomicAudit.mock.calls.map((c) => c[1]);
      expect(audit).toEqual([expect.objectContaining({ action: 'scim.user.update', details: { fields: ['name', 'email', 'externalId'], via: 'patch' } })]);
      expect(JSON.stringify(audit)).not.toContain('Janet');
      expect(JSON.stringify(audit)).not.toContain('janet@example.test');
      expect(await events()).toEqual(['user.updated PATCH 200']);
    });

    it('applies the attribute change before the deprovision, in one request', async () => {
      const { PATCH } = await loadItem();
      await person();
      await database.pg.query(`UPDATE scim_configurations SET deprovision_action = 'archive' WHERE id = $1`, [CONFIG]);
      await PATCH(patchRequest([{ op: 'replace', value: { active: false, name: { givenName: 'Janet' } } }]), ctx());
      expect(await row()).toMatchObject({ display_name: 'Janet Doe', status: 'inactive', deprovisioned_action: 'archive' });
      expect(auditActions()).toEqual(['scim.user.update', 'scim.user.deprovision']);
      expect(await events()).toEqual(['user.updated PATCH 200', 'user.deleted PATCH 200']);
    });

    it('answers a taken externalId as a uniqueness conflict, and a userName change as immutable', async () => {
      const { PATCH } = await loadItem();
      await person();
      await person({ id: randomUUID(), userName: 'taker@example.test', externalId: 'taken' });
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'externalId', value: 'taken' }]), ctx()), 409, { scimType: 'uniqueness', detail: 'externalId' });
      expect((await row()).external_id).toBe('idp-1');
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'userName', value: 'someone.else@example.test' }]), ctx()), 400, { scimType: 'mutability' });
      // The same userName in another case is not a change.
      expect((await PATCH(patchRequest([{ op: 'replace', path: 'userName', value: 'JANE@example.test' }]), ctx())).status).toBe(200);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('refuses a body it cannot read, and an attribute it does not change, without asking the database', async () => {
      const { PATCH } = await loadItem();
      await person();
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'roles', value: 'admin' }]), ctx()), 400, { scimType: 'invalidPath' });
      await expectScimError(PATCH(new NextRequest(url(), { method: 'PATCH', body: 'not json' }), ctx()), 400, { scimType: 'invalidSyntax' });
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: true }], 'nope'), ctx('nope')), 404);
      expect(m.system).not.toHaveBeenCalled();
    });

    it('answers 404 for a person who is not there, and 403 when user sync is off or the configuration is no longer live', async () => {
      const { PATCH } = await loadItem();
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx()), 404);
      await person();
      m.auth = authOk(false);
      m.system.mockClear();
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx()), 403);
      expect(m.system).not.toHaveBeenCalled();
      m.auth = authOk();
      await database.pg.query('UPDATE scim_configurations SET revoked_at = now() WHERE id = $1', [CONFIG]);
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx()), 403);
      expect(await row()).toMatchObject({ status: 'pending' });
    });

    it('fails the whole change when its audit cannot be written, rather than reporting it done, and leaves nothing behind', async () => {
      const { PATCH } = await loadItem();
      await person();
      m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
      await expect(PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx())).rejects.toThrow('audit unavailable');
      expect(await row()).toMatchObject({ status: 'pending', deprovisioned_at: null });
      expect(await events()).toEqual([]);
    });
  });

  describe('PUT', () => {
    it('updates the stated attributes, deprovisions on active false, and refuses a different userName', async () => {
      const { PUT } = await loadItem();
      await person();
      await database.pg.query(`UPDATE scim_configurations SET deprovision_action = 'delete' WHERE id = $1`, [CONFIG]);
      const response = await PUT(putRequest({ userName: 'jane@example.test', active: false }), ctx());
      expect(response.status).toBe(200);
      expect(await row()).toMatchObject({ status: 'revoked', deprovisioned_action: 'delete', deprovisioned_via: 'put' });
      expect((await row()).deleted_at).not.toBeNull();
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ details: { action: 'delete', from: 'pending', via: 'put' } }));
      expect(await events()).toEqual(['user.deleted PUT 200']);
    });

    it('refuses a different userName, a body without a userName, and a role', async () => {
      const { PUT } = await loadItem();
      await person();
      await expectScimError(PUT(putRequest({ userName: 'other@example.test' }), ctx()), 400, { scimType: 'mutability' });
      await expectScimError(PUT(putRequest({ active: false }), ctx()), 400, { scimType: 'invalidValue' });
      await expectScimError(PUT(putRequest({ userName: 'jane@example.test', roles: [{ value: 'admin' }] }), ctx()), 400, { scimType: 'invalidValue' });
      expect(await row()).toMatchObject({ status: 'pending' });
    });
  });

  describe('DELETE', () => {
    it('deprovisions by the organization\u2019s configured action, answers 204, audits it and logs one event', async () => {
      const { DELETE } = await loadItem();
      await person();
      await database.pg.query(`UPDATE scim_configurations SET deprovision_action = 'delete' WHERE id = $1`, [CONFIG]);
      const response = await DELETE(deleteRequest(), ctx());
      expect(response.status).toBe(204);
      expect(await row()).toMatchObject({ status: 'revoked', deprovisioned_action: 'delete', deprovisioned_via: 'delete' });
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'scim.user.deprovision', details: { action: 'delete', via: 'delete' } }));
      expect(await events()).toEqual(['user.deleted DELETE 204']);
    });

    it('answers 204 and audits nothing for a person who is already deprovisioned, 404 for one who is not there', async () => {
      const { DELETE } = await loadItem();
      await person({ status: 'suspended' });
      expect((await DELETE(deleteRequest(), ctx())).status).toBe(204);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
      await expectScimError(DELETE(deleteRequest(randomUUID()), ctx(randomUUID())), 404);
    });

    it('refuses without user sync and for an id that names no member, before the database is asked', async () => {
      const { DELETE } = await loadItem();
      m.auth = authOk(false);
      await expectScimError(DELETE(deleteRequest(), ctx()), 403);
      m.auth = authOk();
      await expectScimError(DELETE(deleteRequest('x'), ctx('x')), 404);
      expect(m.system).not.toHaveBeenCalled();
    });
  });

  it('opens no tenant context for any operation, which a session-less caller cannot have', async () => {
    const { GET, PATCH, DELETE } = await loadItem();
    await person();
    await GET(new NextRequest(url()), ctx());
    await PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx());
    await DELETE(deleteRequest(), ctx());
    expect(m.system).toHaveBeenCalledTimes(3);
    expect(m.tenant).not.toHaveBeenCalled();
  });

  describe('ServiceProviderConfig', () => {
    it('states what the service supports, to a caller with the token, and only to one', async () => {
      const { GET } = await loadConfig();
      const response = await GET(new NextRequest(`http://localhost/api/scim/v2/${ORG}/ServiceProviderConfig`), { params: { organizationId: ORG } });
      expect(response.status).toBe(200);
      expect(await bodyOf(response)).toMatchObject({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        patch: { supported: true },
        bulk: { supported: false },
        filter: { supported: true, maxResults: 100 },
        sort: { supported: false },
        etag: { supported: false },
        changePassword: { supported: false },
      });
      m.auth = { ok: false, status: 401, reason: 'invalid_token' };
      await expect(GET(new NextRequest(`http://localhost/api/scim/v2/${ORG}/ServiceProviderConfig`), { params: { organizationId: ORG } })).rejects.toMatchObject({ status: 401 });
    });
  });
});
