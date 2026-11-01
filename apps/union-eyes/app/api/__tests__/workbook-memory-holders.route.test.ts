import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  persistAtomicAudit: vi.fn(),
  appendIntake: vi.fn(),
  runStewardshipCartography: vi.fn(() => ({ density: { index: 0 } })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  selectQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
  deleteQueue: [] as unknown[][],
  lockedWorkbook: null as null | { id: string; claimedByUserId: string | null; claimedOrgId: string | null },
  lockOverride: null as null | { id: string; claimedByUserId: string | null; claimedOrgId: string | null },
}));

const mockDb = {
  select: vi.fn(() => {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      for: vi.fn(async () => m.lockOverride ? [m.lockOverride] : m.lockedWorkbook ? [m.lockedWorkbook] : []),
      limit: vi.fn(async () => {
        const rows = (m.selectQueue.shift() ?? []) as unknown[];
        const first = rows[0] as Record<string, unknown> | undefined;
        if (first && Object.hasOwn(first, 'claimedByUserId')) {
          m.lockedWorkbook = { id: String(first.id), claimedByUserId: first.claimedByUserId as string | null, claimedOrgId: first.claimedOrgId as string | null };
        }
        return rows;
      }),
    };
    return chain;
  }),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => (m.insertQueue.shift() ?? [{ id: 'h1' }]) as unknown[]),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => (m.updateQueue.shift() ?? []) as unknown[]),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(async () => (m.deleteQueue.shift() ?? []) as unknown[]),
    })),
  })),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
// Disclosed adaptation (B102): a same-organization peer needs a steward role; the role check is a seam here.
vi.mock('@/lib/api-auth-guard', () => ({ hasRoleInOrganization: vi.fn(async () => true) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
// The pseudonymous audit store has its own native coverage; here only what each route asks it to record is observed.
vi.mock('@/lib/public-intake/intake-audit', () => ({ appendPublicIntakeAudit: m.appendIntake }));
vi.mock('@/lib/workbook/engines/stewardshipCartography', () => ({
  runStewardshipCartography: m.runStewardshipCartography,
}));
vi.mock('drizzle-orm', async (importOriginal) => ({ ...(await importOriginal<typeof import('drizzle-orm')>()), eq: vi.fn(), and: vi.fn() }));
// Pass-through RLS context helpers so the real authority boundary runs; the
// ownership lookup is fed the mock db as its system-context `tx`.
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (cb: any) => cb(mockDb),
  withExplicitUserContext: (_userId: string, cb: any) => cb(),
}));

// Disclosed adaptation (F06 R7): an unclaimed workbook is no longer reached by its identifier alone, so the predicate that decides whether a
// presented capability is the workbook's own is a seam here, and the requests below present 'cap-ok'. The real predicate (hash, expiry,
// constant-time comparison) is proven in lib/workbook/__tests__/workbook-capability.test.ts and access-control.test.ts; these tests prove
// the routes extract the presented capability and hand it to the boundary, and that without it nothing is read or written.
vi.mock('@/lib/workbook/workbook-capability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/workbook/workbook-capability')>()),
  workbookCapabilityHolds: (presented: string | null) => presented === 'cap-ok',
}));

function req(body?: unknown, capability: string | null = 'cap-ok') {
  return new NextRequest('http://localhost/api/workbook/w1/memory-holders', {
    method: body === undefined ? 'GET' : 'POST',
    ...(capability ? { headers: { authorization: `Bearer ${capability}` } } : {}),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function loadListRoute() {
  return import('../workbook/[id]/memory-holders/route');
}
async function loadItemRoute() {
  return import('../workbook/[id]/memory-holders/[holderId]/route');
}

describe('workbook memory-holders routes — claimed-workbook authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.insertQueue = [];
    m.updateQueue = [];
    m.deleteQueue = [];
    m.lockedWorkbook = null;
    m.lockOverride = null;
    m.runStewardshipCartography.mockReturnValue({ density: { index: 0 } });
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.appendIntake.mockReset().mockResolvedValue({ subjectRef: 'ref', contentHash: 'hash' });
  });

  describe('unclaimed workbook without its capability (F06 R7)', () => {
    const row = [{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]
    const params = { params: Promise.resolve({ id: 'w1' }) }

    it('answers a read as a workbook that is not there, reads nothing and records nothing', async () => {
      const { GET } = await loadListRoute()
      m.selectQueue.push(row)

      const response = await GET(req(undefined, null), params)

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Workbook not found' })
      expect(m.appendIntake).not.toHaveBeenCalled()
      expect(m.runStewardshipCartography).not.toHaveBeenCalled()
      expect(m.selectQueue).toHaveLength(0)
    })

    it('refuses a write made with the identifier and a wrong capability, and writes nothing', async () => {
      const { POST } = await loadListRoute()
      m.selectQueue.push(row)

      const response = await POST(req({ role: 'Treasurer', responsibility: 'Signs cheques' }, 'cap-wrong'), params)

      expect(response.status).toBe(404)
      expect(mockDb.insert).not.toHaveBeenCalled()
      expect(m.appendIntake).not.toHaveBeenCalled()
    })

    it('refuses a change and a removal the same way', async () => {
      const { PATCH, DELETE } = await loadItemRoute()
      const itemParams = { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) }
      const itemUrl = 'http://localhost/api/workbook/w1/memory-holders/h1'

      m.selectQueue.push(row)
      expect((await PATCH(new NextRequest(itemUrl, { method: 'PATCH', body: JSON.stringify({ role: 'x' }) }), itemParams)).status).toBe(404)
      m.selectQueue.push(row)
      expect((await DELETE(new NextRequest(itemUrl, { method: 'DELETE' }), itemParams)).status).toBe(404)
      expect(mockDb.update).not.toHaveBeenCalled()
      expect(mockDb.delete).not.toHaveBeenCalled()
    })
  })

  describe('GET', () => {
    it('refuses to return a misleading partial cartography for an oversized legacy workbook', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.selectQueue.push(Array.from({ length: 201 }, (_, i) => ({ id: `holder_${i}` })));
      const response = await GET(req(), { params: Promise.resolve({ id: 'w1' }) });
      expect(response.status).toBe(409);
      expect(m.runStewardshipCartography).not.toHaveBeenCalled();
    });
    it('serves an unclaimed workbook via the bearer id (preclaim)', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.selectQueue.push([]); // holders

      const response = await GET(req(), { params: Promise.resolve({ id: 'w1' }) });

      expect(response.status).toBe(200);
      expect(m.auth).not.toHaveBeenCalled();
      // F06 R3: the read of the people an unclaimed workbook names is recorded under the pseudonymous authority, before it is served,
      // with no organization, no actor and no consent invented, and never the workbook id as a value to record.
      expect(m.appendIntake).toHaveBeenCalledTimes(1);
      expect(m.appendIntake.mock.calls[0][1]).toMatchObject({ action: 'workbook.memory_holder.read', operation: 'read', subjectKind: 'unclaimed_workbook', subjectId: 'w1', resourceRef: null });
      expect(JSON.stringify(m.appendIntake.mock.calls[0][1])).not.toMatch(/organizationId|userId/);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
      expect(m.appendIntake.mock.invocationCallOrder[0]).toBeLessThan(m.runStewardshipCartography.mock.invocationCallOrder[0]);
    });

    it('does not read the people an unclaimed workbook names when the read cannot be recorded', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.selectQueue.push([{ id: 'holder_1' }]);
      m.appendIntake.mockRejectedValueOnce(new Error('audit store down'));

      const response = await GET(req(), { params: Promise.resolve({ id: 'w1' }) });

      expect(response.status).toBe(503);
      expect(m.runStewardshipCartography).not.toHaveBeenCalled();
      expect(JSON.stringify(await response.json())).not.toContain('holder_1');
    });

    it('records a claimed workbook read under the claiming organization and the acting person', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.selectQueue.push([]);
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });

      expect((await GET(req(), { params: Promise.resolve({ id: 'w1' }) })).status).toBe(200);

      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ organizationId: 'org_1', userId: 'user_1', action: 'workbook.memory_holder.read' }),
      );
      expect(m.appendIntake).not.toHaveBeenCalled();
    });

    it('serves the claimant', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.selectQueue.push([]);
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });

      const response = await GET(req(), { params: Promise.resolve({ id: 'w1' }) });

      expect(response.status).toBe(200);
    });

    it('rejects a cross-tenant caller with 403 and does not read child data', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: 'attacker_1' });
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_attacker');

      const response = await GET(req(), { params: Promise.resolve({ id: 'w1' }) });

      expect(response.status).toBe(403);
      // The cartography read (second select) never happened.
      expect(m.selectQueue.length).toBe(0);
    });

    it('returns 401 for a claimed workbook when unauthenticated', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: null });

      const response = await GET(req(), { params: Promise.resolve({ id: 'w1' }) });

      expect(response.status).toBe(401);
    });
  });

  describe('POST', () => {
    it('refuses a 201st holder under the workbook lock before any insert', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.selectQueue.push(Array.from({ length: 200 }, (_, i) => ({ id: `holder_${i}` })));
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });
      const response = await POST(req({ role: 'Treasurer', responsibility: 'Signs cheques' }), {
        params: Promise.resolve({ id: 'w1' }),
      });
      expect(response.status).toBe(409);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('rejects a workbook whose ownership changed while waiting for the row lock', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.lockOverride = { id: 'w1', claimedByUserId: 'another_user', claimedOrgId: 'org_1' };
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });
      const response = await POST(req({ role: 'Treasurer', responsibility: 'Signs cheques' }), {
        params: Promise.resolve({ id: 'w1' }),
      });
      expect(response.status).toBe(503);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('permits a holder when the workbook has fewer than 200 records', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.selectQueue.push(Array.from({ length: 199 }, (_, i) => ({ id: `holder_${i}` })));
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });
      const response = await POST(req({ role: 'Treasurer', responsibility: 'Signs cheques' }), {
        params: Promise.resolve({ id: 'w1' }),
      });
      expect(response.status).toBe(201);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });
    it('creates a memory holder for the claimant', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.selectQueue.push([]); // holders (loadCartography after insert)
      m.insertQueue.push([{ id: 'holder_new' }]);
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });

      const response = await POST(
        req({ role: 'Treasurer', responsibility: 'Signs cheques' }),
        { params: Promise.resolve({ id: 'w1' }) },
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.id).toBe('holder_new');
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          organizationId: 'org_1',
          userId: 'user_1',
          action: 'workbook.memory_holder.create',
          resourceId: 'holder_new',
        }),
      );
    });

    it('rolls back the insert path when the claimed-workbook audit fails', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.insertQueue.push([{ id: 'holder_new' }]);
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });
      m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));

      const response = await POST(
        req({ role: 'Treasurer', responsibility: 'Signs cheques' }),
        { params: Promise.resolve({ id: 'w1' }) },
      );

      expect(response.status).toBe(503);
    });

    it('refuses an identity-linked write that has no organization to attribute', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: null }]);
      m.insertQueue.push([{ id: 'holder_new' }]);
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });

      const response = await POST(
        req({ role: 'Treasurer', responsibility: 'Signs cheques' }),
        { params: Promise.resolve({ id: 'w1' }) },
      );

      expect(response.status).toBe(503);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('rejects invalid bodies with 422 before touching authorization', async () => {
      const { POST } = await loadListRoute();

      const response = await POST(req({ role: '' }), { params: Promise.resolve({ id: 'w1' }) });

      expect(response.status).toBe(422);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('rejects a cross-tenant caller with 403 and does not insert', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: 'attacker_1' });
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_attacker');

      const response = await POST(
        req({ role: 'Treasurer', responsibility: 'Signs cheques' }),
        { params: Promise.resolve({ id: 'w1' }) },
      );

      expect(response.status).toBe(403);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('PATCH / DELETE', () => {
    it('updates a holder for a same-organization peer', async () => {
      const { PATCH } = await loadItemRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_shared' }]);
      m.updateQueue.push([{ id: 'holder_1' }]);
      m.auth.mockResolvedValueOnce({ userId: 'peer_1' });
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_shared');

      const response = await PATCH(req({ role: 'Chair' }), {
        params: Promise.resolve({ id: 'w1', holderId: 'holder_1' }),
      });

      expect(response.status).toBe(200);
    });

    it('returns 404 when the holder to delete does not exist', async () => {
      const { DELETE } = await loadItemRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.deleteQueue.push([]); // no rows deleted
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });

      const response = await DELETE(
        new NextRequest('http://localhost/api/workbook/w1/memory-holders/holder_x', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: 'w1', holderId: 'holder_x' }) },
      );

      expect(response.status).toBe(404);
    });

    it('rejects a cross-tenant DELETE with 403 and does not delete', async () => {
      const { DELETE } = await loadItemRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: 'attacker_1' });
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_attacker');

      const response = await DELETE(
        new NextRequest('http://localhost/api/workbook/w1/memory-holders/holder_1', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: 'w1', holderId: 'holder_1' }) },
      );

      expect(response.status).toBe(403);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('an authorized capability for workbook A cannot mutate a child of workbook B', async () => {
      // The caller is a legitimate claimant of workbook A. They target a holder
      // that belongs to workbook B. The DELETE is constrained to
      // workbook_id = A, so B's holder never matches → 0 rows → 404. Authority
      // over A does NOT confer authority over B's children.
      const { DELETE } = await loadItemRoute();
      m.selectQueue.push([{ id: 'wA', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
      m.deleteQueue.push([]); // holder belongs to wB → no row matches WHERE workbook_id = wA
      m.auth.mockResolvedValueOnce({ userId: 'user_1' });

      const response = await DELETE(
        new NextRequest('http://localhost/api/workbook/wA/memory-holders/holder_from_wB', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: 'wA', holderId: 'holder_from_wB' }) },
      );

      expect(response.status).toBe(404);
      // The delete ran, but scoped to workbook A only.
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('notice to the named people (F06 R5)', () => {
    const itemParams = { params: Promise.resolve({ id: 'w1', holderId: 'holder_1' }) };
    const patch = (body: unknown) => new NextRequest('http://localhost/api/workbook/w1/memory-holders/holder_1', { method: 'PATCH', headers: { authorization: 'Bearer cap-ok' }, body: JSON.stringify(body) });
    const setCalls = () => mockDb.update.mock.results.flatMap((r) => (r.value as { set: ReturnType<typeof vi.fn> }).set.mock.calls.map((c) => c[0] as Record<string, unknown>));

    it('records a notice for a claimed workbook attributed to the acting person, with the time and channel', async () => {
      const { PATCH } = await loadItemRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_shared' }]);
      m.updateQueue.push([{ id: 'holder_1' }]);
      m.auth.mockResolvedValueOnce({ userId: 'peer_1' });
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_shared');

      const response = await PATCH(patch({ notice: { channel: 'in_person', reference: 'meeting 3' } }), itemParams);

      expect(response.status).toBe(200);
      expect(setCalls()[0]).toMatchObject({ noticeState: 'notified', notifiedBy: 'peer_1', noticeChannel: 'in_person', noticeReference: 'meeting 3' });
      expect(setCalls()[0].notifiedAt).toBeInstanceOf(Date);
      expect(setCalls()[0]).not.toHaveProperty('notice');
    });

    it('cannot record a notice for an unclaimed workbook, which has nobody to attribute it to, and names the blocked operation', async () => {
      const { PATCH } = await loadItemRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);

      const response = await PATCH(patch({ notice: { channel: 'email' } }), itemParams);
      const payload = await response.json();

      expect(response.status).toBe(409);
      expect(payload.error.code).toBe('NOTICE_REQUIRES_CLAIM');
      expect(payload.blockedOperation).toMatchObject({ operation: 'workbook.memory_holder.record_notice', policyApprovedBy: null });
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('refuses a name or note without a notice, as a blocked operation, when the policy conditions naming a person on one', async () => {
      const { HOLDER_NOTICE_POLICY } = await import('@/lib/workbook/holder-notice');
      HOLDER_NOTICE_POLICY.identifyingDetailsRequireNotice = true;
      try {
        const { PATCH } = await loadItemRoute();
        m.selectQueue.push([{ id: 'w1', claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
        m.auth.mockResolvedValueOnce({ userId: 'user_1' });

        const response = await PATCH(patch({ displayName: 'A Person' }), itemParams);

        expect(response.status).toBe(409);
        expect((await response.json()).blockedOperation).toMatchObject({ operation: 'workbook.memory_holder.write_identifying_detail' });
        expect(mockDb.update).not.toHaveBeenCalled();
      } finally {
        HOLDER_NOTICE_POLICY.identifyingDetailsRequireNotice = false;
      }
    });

    it('shows the reader how many of the named people have a recorded notice', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.selectQueue.push([
        { id: 'h1', role: 'A', displayName: 'N1', notes: null, noticeState: 'notified' },
        { id: 'h2', role: 'B', displayName: 'N2', notes: null, noticeState: 'not_recorded' },
      ]);

      const body = await (await GET(req(), { params: Promise.resolve({ id: 'w1' }) })).json();

      expect(body.notice).toEqual({ holders: 2, noticeRecorded: 1, noticeNotRecorded: 1 });
      expect(body.holders.map((h: { identifyingDetailWithheld: boolean }) => h.identifyingDetailWithheld)).toEqual([false, false]);
    });
  });

  describe('preclaim capability', () => {
    it('creates a memory holder under the pre-claim bearer (unclaimed workbook)', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.selectQueue.push([]); // holders (loadCartography after insert)
      m.insertQueue.push([{ id: 'holder_new' }]);

      const response = await POST(
        req({ role: 'Founder', responsibility: 'Holds the origin story' }),
        { params: Promise.resolve({ id: 'w1' }) },
      );

      expect(response.status).toBe(201);
      // No authenticated identity is required for the pre-claim bearer path.
      expect(m.auth).not.toHaveBeenCalled();
      // The insert ran under the pre-claim (system) context.
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      // F06 R3 (replaces "records nothing for a pre-claim workbook"): the mutation is recorded in the same transaction under the
      // pseudonymous authority, by field names and counts only: the role and responsibility typed by the visitor are not evidence.
      expect(m.appendIntake).toHaveBeenCalledTimes(1);
      expect(m.appendIntake.mock.calls[0][1]).toMatchObject({ action: 'workbook.memory_holder.create', operation: 'create', subjectKind: 'unclaimed_workbook', resourceRef: 'holder_new' });
      expect(JSON.stringify(m.appendIntake.mock.calls[0][1])).not.toMatch(/Founder|origin story/);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('does not keep an unclaimed workbook write that cannot be recorded', async () => {
      const { POST } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.selectQueue.push([]);
      m.insertQueue.push([{ id: 'holder_new' }]);
      m.appendIntake.mockRejectedValueOnce(new Error('audit store down'));

      const response = await POST(req({ role: 'Founder', responsibility: 'Holds the origin story' }), { params: Promise.resolve({ id: 'w1' }) });

      expect(response.status).toBe(503);
      expect(m.runStewardshipCartography).not.toHaveBeenCalled();
    });

    it('records an unclaimed update and delete by reference, with the fields changed and nothing typed', async () => {
      const { PATCH, DELETE } = await loadItemRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.updateQueue.push([{ id: 'h1' }]);
      await PATCH(
        new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', { method: 'PATCH', headers: { authorization: 'Bearer cap-ok' }, body: JSON.stringify({ displayName: 'A Real Name', notes: 'private note' }) }),
        { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) },
      );
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.deleteQueue.push([{ id: 'h1' }]);
      await DELETE(
        new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', { method: 'DELETE', headers: { authorization: 'Bearer cap-ok' } }),
        { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) },
      );

      const entries = m.appendIntake.mock.calls.map((call) => call[1]);
      expect(entries.map((e) => [e.operation, e.resourceRef])).toEqual([['update', 'h1'], ['delete', 'h1']]);
      expect(entries[0].details).toEqual({ fields: ['displayName', 'notes'] });
      expect(JSON.stringify(entries)).not.toMatch(/A Real Name|private note/);
    });
  });
});
