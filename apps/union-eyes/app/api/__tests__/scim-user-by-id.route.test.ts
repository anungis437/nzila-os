import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  auth: null as unknown,
  calls: [] as Array<{ text: string; values: unknown[] }>,
  results: [] as unknown[],
}));

// The routes reach the database only through the SCIM functions of cache migration 0049; each call is recorded with its text and parameters, and
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
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, resetIn: 60 })) }));
vi.mock('@/lib/scim/scim-token', () => ({ authenticateScimRequest: vi.fn(async () => m.auth) }));
const contexts = vi.hoisted(() => ({
  system: vi.fn(),
  tenant: vi.fn(() => { throw new Error('a SCIM route has no session, so it never opens a tenant context'); }),
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: contexts.system, withRLSContext: contexts.tenant }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('drizzle-orm', () => ({ sql: Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }), {}) }));

const ORG = '22222222-2222-4222-8222-222222222222';
const CONFIG = '33333333-3333-4333-8333-333333333333';
const ID = '11111111-1111-4111-8111-111111111111';
const ctx = (id: string = ID, organizationId: string = ORG) => ({ params: { organizationId, id } });
const SCIM_OK = { ok: true, organizationId: ORG, configurationId: CONFIG, syncUsers: true };
const url = (id: string = ID) => `http://localhost/api/scim/v2/${ORG}/Users/${id}`;

const loadItem = () => import('../scim/v2/[organizationId]/Users/[id]/route');
const loadConfig = () => import('../scim/v2/[organizationId]/ServiceProviderConfig/route');

const columns = (over: Record<string, unknown> = {}) => ({
  o_id: ID,
  o_user_id: `scim:${ORG}:jane@example.com`,
  o_name: 'Jane Doe',
  o_email: 'jane@example.com',
  o_status: 'pending',
  o_joined_at: null,
  o_created_at: '2026-01-01T00:00:00.000Z',
  o_updated_at: '2026-01-01T00:00:00.000Z',
  o_metadata: { scim: { userName: 'jane@example.com', externalId: 'idp-1', link: 'unlinked' } },
  ...over,
});
const found = (over: Record<string, unknown> = {}) => [columns(over)];
const updated = (outcome: string, over: Record<string, unknown> = {}) => [{ o_outcome: outcome, ...columns(over) }];
const deprovisioned = (outcome: string, action: string | null, over: Record<string, unknown> = {}) => [{ o_outcome: outcome, o_action: action, ...columns(over) }];
const gone = (key: 'o_outcome' | 'o_action' = 'o_outcome') => [{ o_outcome: 'not_found', o_action: null, ...columns({ o_id: null, o_user_id: null, o_status: null }), [key]: key === 'o_outcome' ? 'not_found' : null }];

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
  new NextRequest(url(id), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schemas: [PATCH_OP], Operations }) });
const putRequest = (body: unknown) => new NextRequest(url(), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('scim user routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.calls = [];
    m.results = [];
    m.auth = SCIM_OK;
    m.persistAtomicAudit.mockResolvedValue(undefined);
    contexts.system.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));
    m.withApi.mockImplementation((cfg: any, handler: (c: any) => Promise<any>) => async (request: NextRequest, c: any = ctx()) => {
      const machine = await cfg.auth.machine(request, c.params);
      return handler({ ...c, request, machine });
    });
  });

  describe('GET', () => {
    it('returns one person this stream provisioned', async () => {
      const { GET } = await loadItem();
      m.results = [found()];
      const response = await GET(new NextRequest(url()), ctx());
      expect(response.status).toBe(200);
      expect(await bodyOf(response)).toMatchObject({ id: ID, userName: 'jane@example.com', externalId: 'idp-1', active: false });
      expect(m.calls[0].text).toContain('ue_scim_get_member');
      expect(m.calls[0].values).toEqual([CONFIG, ORG, ID]);
    });

    it('answers 404 for a person who is not there, and for an id that cannot name one without asking the database', async () => {
      const { GET } = await loadItem();
      m.results = [[]];
      await expectScimError(GET(new NextRequest(url()), ctx()), 404, { detail: 'not found' });
      m.calls = [];
      for (const bad of ['not-a-uuid', '1', '../x', `${ID}'--`]) await expectScimError(GET(new NextRequest(url('x')), ctx(bad)), 404);
      expect(m.calls).toHaveLength(0);
    });

    it('refuses another organization, whatever the path names, before the database is asked', async () => {
      const { GET } = await loadItem();
      await expect(GET(new NextRequest(url()), ctx(ID, '44444444-4444-4444-8444-444444444444'))).rejects.toMatchObject({ status: 404 });
      expect(mockTx.execute).not.toHaveBeenCalled();
    });
  });

  describe('PATCH', () => {
    it('deprovisions on active false (Entra spells it as a string) by the organization\u2019s configured action, and audits it', async () => {
      const { PATCH } = await loadItem();
      m.results = [found(), deprovisioned('deprovisioned', 'suspend', { o_status: 'suspended' })];
      const response = await PATCH(patchRequest([{ op: 'Replace', path: 'active', value: 'False' }]), ctx());
      expect(response.status).toBe(200);
      expect(await bodyOf(response)).toMatchObject({ id: ID, active: false });
      expect(m.calls.map((c) => c.text.match(/ue_scim_\w+/)?.[0])).toEqual(['ue_scim_get_member', 'ue_scim_deprovision_member']);
      // The caller names no action: the database reads it from the configuration.
      expect(m.calls[1].values).toEqual([CONFIG, ORG, ID, 'patch']);
      expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          organizationId: ORG,
          userId: `system:scim:${CONFIG}`,
          action: 'scim.user.deprovision',
          resourceId: ID,
          details: { action: 'suspend', from: 'pending', via: 'patch' },
        }),
      );
    });

    it('does nothing, and audits nothing, for a person who is already deprovisioned', async () => {
      const { PATCH } = await loadItem();
      m.results = [found({ o_status: 'suspended' }), deprovisioned('unchanged', 'suspend', { o_status: 'suspended' })];
      const response = await PATCH(patchRequest([{ op: 'replace', value: { active: false } }]), ctx());
      expect(response.status).toBe(200);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('restores a person this stream deprovisioned, and audits the restoration', async () => {
      const { PATCH } = await loadItem();
      m.results = [found({ o_status: 'suspended' }), updated('updated', { o_status: 'pending' })];
      const response = await PATCH(patchRequest([{ op: 'replace', path: 'active', value: true }]), ctx());
      expect(response.status).toBe(200);
      expect(m.calls[1].text).toContain('ue_scim_update_member');
      // name, email, externalId, clear-externalId, reactivate
      expect(m.calls[1].values).toEqual([CONFIG, ORG, ID, null, null, null, false, true]);
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockTx, expect.objectContaining({ action: 'scim.user.reactivate', details: { from: 'suspended', to: 'pending', via: 'patch' } }));
    });

    it('refuses to restore a person the organization itself suspended, and writes and audits nothing', async () => {
      const { PATCH } = await loadItem();
      m.results = [found({ o_status: 'suspended' }), updated('held', { o_status: 'suspended' })];
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: true }]), ctx()), 409, { detail: 'suspended by the organization' });
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('updates the identity provider\u2019s attributes, keeps the other half of the name, and audits the fields and not their values', async () => {
      const { PATCH } = await loadItem();
      m.results = [found(), updated('updated', { o_name: 'Janet Doe', o_email: 'janet@example.com' })];
      await PATCH(
        patchRequest([
          { op: 'replace', path: 'name.givenName', value: 'Janet' },
          { op: 'replace', path: 'emails[type eq "work"].value', value: 'janet@example.com' },
          { op: 'replace', path: 'externalId', value: 'idp-2' },
        ]),
        ctx(),
      );
      expect(m.calls[1].values).toEqual([CONFIG, ORG, ID, 'Janet Doe', 'janet@example.com', 'idp-2', false, false]);
      const audit = m.persistAtomicAudit.mock.calls.map((c) => c[1]);
      expect(audit).toEqual([expect.objectContaining({ action: 'scim.user.update', details: { fields: ['name', 'email', 'externalId'], via: 'patch' } })]);
      expect(JSON.stringify(audit)).not.toContain('Janet');
      expect(JSON.stringify(audit)).not.toContain('janet@example.com');
    });

    it('applies the attribute change before the deprovision, in one request', async () => {
      const { PATCH } = await loadItem();
      m.results = [found(), updated('updated', { o_name: 'Janet Doe' }), deprovisioned('deprovisioned', 'archive', { o_status: 'inactive', o_name: 'Janet Doe' })];
      await PATCH(patchRequest([{ op: 'replace', value: { active: false, name: { givenName: 'Janet' } } }]), ctx());
      expect(m.calls.map((c) => c.text.match(/ue_scim_\w+/)?.[0])).toEqual(['ue_scim_get_member', 'ue_scim_update_member', 'ue_scim_deprovision_member']);
      expect(m.persistAtomicAudit.mock.calls.map((c) => (c[1] as { action: string }).action)).toEqual(['scim.user.update', 'scim.user.deprovision']);
    });

    it('answers a taken externalId as a uniqueness conflict, and a userName change as immutable', async () => {
      const { PATCH } = await loadItem();
      m.results = [found(), updated('external_id_conflict', { o_id: null, o_user_id: null, o_status: null })];
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'externalId', value: 'taken' }]), ctx()), 409, { scimType: 'uniqueness', detail: 'externalId' });
      m.calls = [];
      m.results = [found()];
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'userName', value: 'someone.else@example.com' }]), ctx()), 400, { scimType: 'mutability' });
      expect(m.calls.map((c) => c.text.match(/ue_scim_\w+/)?.[0])).toEqual(['ue_scim_get_member']);
      m.results = [found()];
      expect((await PATCH(patchRequest([{ op: 'replace', path: 'userName', value: 'JANE@example.com' }]), ctx())).status).toBe(200);
    });

    it('refuses a body it cannot read, and an attribute it does not change, without asking the database', async () => {
      const { PATCH } = await loadItem();
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'roles', value: 'admin' }]), ctx()), 400, { scimType: 'invalidPath' });
      await expectScimError(PATCH(new NextRequest(url(), { method: 'PATCH', body: 'not json' }), ctx()), 400, { scimType: 'invalidSyntax' });
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: true }], 'nope'), ctx('nope')), 404);
      expect(mockTx.execute).not.toHaveBeenCalled();
    });

    it('answers 404 for a person who is not there, and 403 when user sync is off or the configuration is no longer live', async () => {
      const { PATCH } = await loadItem();
      m.results = [[]];
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx()), 404);
      m.auth = { ...SCIM_OK, syncUsers: false };
      m.calls = [];
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx()), 403);
      expect(m.calls).toHaveLength(0);
      m.auth = SCIM_OK;
      m.results = [Object.assign(new Error('Failed query'), { cause: { code: '42501' } })];
      await expectScimError(PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx()), 403);
    });

    it('fails the whole change when its audit cannot be written, rather than reporting it done', async () => {
      const { PATCH } = await loadItem();
      m.results = [found(), deprovisioned('deprovisioned', 'suspend', { o_status: 'suspended' })];
      m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
      await expect(PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx())).rejects.toThrow('audit unavailable');
    });
  });

  describe('PUT', () => {
    it('updates the stated attributes, deprovisions on active false, and refuses a different userName', async () => {
      const { PUT } = await loadItem();
      m.results = [found(), deprovisioned('deprovisioned', 'delete', { o_status: 'revoked' })];
      const response = await PUT(putRequest({ userName: 'jane@example.com', active: false }), ctx());
      expect(response.status).toBe(200);
      expect(m.calls[1].values).toEqual([CONFIG, ORG, ID, 'put']);
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockTx, expect.objectContaining({ details: { action: 'delete', from: 'pending', via: 'put' } }));
      m.results = [found()];
      await expectScimError(PUT(putRequest({ userName: 'other@example.com' }), ctx()), 400, { scimType: 'mutability' });
      await expectScimError(PUT(putRequest({ active: false }), ctx()), 400, { scimType: 'invalidValue' });
      await expectScimError(PUT(putRequest({ userName: 'jane@example.com', roles: [{ value: 'admin' }] }), ctx()), 400, { scimType: 'invalidValue' });
    });
  });

  describe('DELETE', () => {
    it('deprovisions by the organization\u2019s configured action, answers 204, and audits it', async () => {
      const { DELETE } = await loadItem();
      m.results = [deprovisioned('deprovisioned', 'delete', { o_status: 'revoked' })];
      const response = await DELETE(new NextRequest(url(), { method: 'DELETE' }), ctx());
      expect(response.status).toBe(204);
      expect(m.calls[0].text).toContain('ue_scim_deprovision_member');
      expect(m.calls[0].values).toEqual([CONFIG, ORG, ID, 'delete']);
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockTx, expect.objectContaining({ action: 'scim.user.deprovision', details: { action: 'delete', via: 'delete' } }));
    });

    it('answers 204 and audits nothing for a person who is already deprovisioned, 404 for one who is not there', async () => {
      const { DELETE } = await loadItem();
      m.results = [deprovisioned('unchanged', 'suspend', { o_status: 'suspended' })];
      expect((await DELETE(new NextRequest(url(), { method: 'DELETE' }), ctx())).status).toBe(204);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
      m.results = [gone()];
      await expectScimError(DELETE(new NextRequest(url(), { method: 'DELETE' }), ctx()), 404);
    });

    it('refuses without user sync and for an id that names no member, before the database is asked', async () => {
      const { DELETE } = await loadItem();
      m.auth = { ...SCIM_OK, syncUsers: false };
      await expectScimError(DELETE(new NextRequest(url(), { method: 'DELETE' }), ctx()), 403);
      m.auth = SCIM_OK;
      await expectScimError(DELETE(new NextRequest(url('x'), { method: 'DELETE' }), ctx('x')), 404);
      expect(mockTx.execute).not.toHaveBeenCalled();
    });
  });

  it('opens no tenant context for any operation, which a session-less caller cannot have', async () => {
    const { GET, PATCH, DELETE } = await loadItem();
    m.results = [found(), found(), deprovisioned('unchanged', 'suspend'), deprovisioned('unchanged', 'suspend')];
    await GET(new NextRequest(url()), ctx());
    await PATCH(patchRequest([{ op: 'replace', path: 'active', value: false }]), ctx());
    await DELETE(new NextRequest(url(), { method: 'DELETE' }), ctx());
    expect(contexts.system).toHaveBeenCalledTimes(3);
    expect(contexts.tenant).not.toHaveBeenCalled();
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
