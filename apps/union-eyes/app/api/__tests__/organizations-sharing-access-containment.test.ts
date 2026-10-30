import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  orgAccess: vi.fn(),
  rls: vi.fn(),
  audit: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  mutationPredicate: null as unknown,
  rows: [] as Record<string, unknown>[],
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.orgAccess,
  isAdministrativeRole: (role?: string) => role === 'admin',
  UUID_PATTERN: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
}));
vi.mock('@/db/schema', () => ({
  organizationSharingSettings: { id: 'sharing_record_id', organizationId: 'sharing_org_id' },
  crossOrgAccessLog: {
    id: 'id', userOrganizationId: 'userOrg', resourceType: 'resourceType',
    resourceId: 'resourceId', accessType: 'accessType', accessGrantedVia: 'grant',
    createdAt: 'createdAt', resourceOrganizationId: 'resourceOrg',
    ipAddress: 'ipAddress', userAgent: 'userAgent', metadata: 'metadata', userId: 'userId',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => ({ a, b }),
  and: (...predicates: unknown[]) => ({ predicates }),
  desc: (a: unknown) => ({ desc: a }),
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.rls }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));

const params = { params: Promise.resolve({ id: ORG_ID }) };
const url = 'http://localhost/api/organizations/' + ORG_ID;

beforeEach(() => {
  vi.clearAllMocks();
  m.rows = [];
  m.mutationPredicate = null;
  m.auth.mockResolvedValue({ userId: 'caller' });
  m.orgAccess.mockResolvedValue({ platform: false, direct: new Map([[ORG_ID, 'admin']]), descendants: new Set() });
  m.audit.mockResolvedValue(undefined);

  const orderChain = {
    limit: (_limit: number) => ({
      offset: async (_offset: number) => m.rows,
    }),
  };
  const whereChain = {
    limit: (_limit: number) => ({
      for: async (_mode: string) => m.rows,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(m.rows).then(resolve),
    }),
    orderBy: (_value: unknown) => orderChain,
  };
  m.select.mockReturnValue({ from: () => ({ where: () => whereChain }) });
  m.update.mockReturnValue({
    set: (_value: unknown) => ({
      where: (predicate: unknown) => ({
        returning: async () => { m.mutationPredicate = predicate; return [{ id: 'sharing-record-1', organizationId: ORG_ID }]; },
      }),
    }),
  });
  m.rls.mockImplementation(async (_ctx: unknown, callback: (tx: unknown) => Promise<unknown>) =>
    callback({ select: m.select, update: m.update }),
  );
});

describe('organization sharing settings — policy containment', () => {
  it('denies platform-wide and parent-only authorities before a DB call', async () => {
    const { GET, PATCH } = await import('../organizations/[id]/sharing-settings/route');
    for (const access of [
      { platform: true, direct: new Map(), descendants: new Set() },
      { platform: false, direct: new Map(), descendants: new Set([ORG_ID]) },
    ]) {
      m.orgAccess.mockResolvedValueOnce(access);
      const res = await GET(new NextRequest(url + '/sharing-settings'), params);
      expect(res.status).toBe(403);
    }
    m.orgAccess.mockResolvedValueOnce({ platform: true, direct: new Map(), descendants: new Set() });
    const patch = await PATCH(new NextRequest(url + '/sharing-settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allowFederationSharing: false }),
    }), params);
    expect(patch.status).toBe(403);
    expect(m.rls).not.toHaveBeenCalled();
  });

  it('GET returns fail-closed defaults from the real sharing-settings table', async () => {
    const { GET } = await import('../organizations/[id]/sharing-settings/route');
    const res = await GET(new NextRequest(url + '/sharing-settings'), params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.allowFederationSharing).toBe(false);
    expect(body.data.requireAnonymization).toBe(true);
    expect(body.data.sharingApprovalRequired).toBe(true);
    expect(m.rls).toHaveBeenCalledWith({ organizationId: ORG_ID }, expect.any(Function));
  });

  it('rejects unratified sharing enablement, identity fields and arbitrary organization PATCH', async () => {
    const { PATCH } = await import('../organizations/[id]/sharing-settings/route');
    for (const payload of [
      { allowFederationSharing: true },
      { requireAnonymization: false },
      { autoSharePrecedents: true },
      { settings: { creditBalance: 9999 } },
      { status: 'archived' },
      { organizationId: '22222222-2222-4222-8222-222222222222' },
    ]) {
      const res = await PATCH(new NextRequest(url + '/sharing-settings', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }), params);
      expect(res.status).toBe(400);
    }
    expect(m.update).not.toHaveBeenCalled();
  });

  it('fails closed on missing or duplicate historical sharing settings rows', async () => {
    const { PATCH } = await import('../organizations/[id]/sharing-settings/route');
    for (const rows of [[], [{ id: 'a' }, { id: 'b' }]]) {
      m.rows = rows;
      const res = await PATCH(new NextRequest(url + '/sharing-settings', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ allowFederationSharing: false }),
      }), params);
      expect(res.status).toBe(409);
    }
    expect(m.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('refuses an increase to any existing shared-resource cap', async () => {
    const { PATCH } = await import('../organizations/[id]/sharing-settings/route');
    m.rows = [{ id: 'sharing-record-1', maxSharedClauses: 5, maxSharedPrecedents: 8 }];
    for (const payload of [{ maxSharedClauses: 6 }, { maxSharedPrecedents: 9 }]) {
      const res = await PATCH(new NextRequest(url + '/sharing-settings', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }), params);
      expect(res.status).toBe(409);
    }
    expect(m.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('permits a lower cap under the direct administrator and retains the tenant predicate', async () => {
    const { PATCH } = await import('../organizations/[id]/sharing-settings/route');
    m.rows = [{ id: 'sharing-record-1', maxSharedClauses: 5, maxSharedPrecedents: 8 }];
    const res = await PATCH(new NextRequest(url + '/sharing-settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maxSharedClauses: 4, maxSharedPrecedents: 7 }),
    }), params);
    expect(res.status).toBe(200);
    expect(JSON.stringify(m.mutationPredicate)).toContain(ORG_ID);
    expect(m.audit).toHaveBeenCalledTimes(1);
  });

  it('restrictive settings persist under own tenant with mandatory atomic audit', async () => {
    const { PATCH } = await import('../organizations/[id]/sharing-settings/route');
    m.rows = [{ id: 'sharing-record-1' }];
    const res = await PATCH(new NextRequest(url + '/sharing-settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allowFederationSharing: false, requireAnonymization: true }),
    }), params);
    expect(res.status).toBe(200);
    expect(m.update).toHaveBeenCalled();
    expect(JSON.stringify(m.mutationPredicate)).toContain('sharing_record_id');
    expect(JSON.stringify(m.mutationPredicate)).toContain('sharing_org_id');
    expect(JSON.stringify(m.mutationPredicate)).toContain(ORG_ID);
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'caller', organizationId: ORG_ID, action: 'organization.sharing_settings_restrict',
    }));
  });
});

describe('cross-organization access log — owner-only and read-only', () => {
  it('does not disclose access history to an ordinary member or platform title', async () => {
    const { GET } = await import('../organizations/[id]/access-logs/route');
    m.orgAccess.mockResolvedValue({ platform: false, direct: new Map([[ORG_ID, 'member']]), descendants: new Set() });
    const res = await GET(new NextRequest(url + '/access-logs'), params);
    expect(res.status).toBe(403);
    expect(m.select).not.toHaveBeenCalled();
  });

  it('reads only resource-owner events and excludes IP, user agent and unbounded metadata', async () => {
    const { GET, ...exports } = await import('../organizations/[id]/access-logs/route');
    expect('PATCH' in exports).toBe(false);
    expect('DELETE' in exports).toBe(false);
    m.rows = [{ id: 'event-1', resourceType: 'clause', accessType: 'view' }];
    const res = await GET(new NextRequest(url + '/access-logs?limit=10000&page=1'), params);
    expect(res.status).toBe(200);
    expect((await res.json()).limit).toBe(100);
    const projection = m.select.mock.calls[0][0];
    expect(Object.keys(projection)).not.toContain('ipAddress');
    expect(Object.keys(projection)).not.toContain('userAgent');
    expect(Object.keys(projection)).not.toContain('metadata');
    expect(Object.keys(projection)).not.toContain('userId');
    expect(m.rls).toHaveBeenCalledWith({ organizationId: ORG_ID }, expect.any(Function));
  });
});
