import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  runStewardshipCartography: vi.fn(() => ({ density: { index: 0 } })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  selectQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
  deleteQueue: [] as unknown[][],
}));

const mockDb = {
  select: vi.fn(() => {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
      limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
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
vi.mock('@/lib/workbook/engines/stewardshipCartography', () => ({
  runStewardshipCartography: m.runStewardshipCartography,
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn() }));
// Pass-through RLS context helpers so the real authority boundary runs; the
// ownership lookup is fed the mock db as its system-context `tx`.
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (cb: any) => cb(mockDb),
  withExplicitUserContext: (_userId: string, cb: any) => cb(),
}));

function req(body?: unknown) {
  return new NextRequest('http://localhost/api/workbook/w1/memory-holders', {
    method: body === undefined ? 'GET' : 'POST',
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
    m.runStewardshipCartography.mockReturnValue({ density: { index: 0 } });
  });

  describe('GET', () => {
    it('serves an unclaimed workbook via the bearer id (preclaim)', async () => {
      const { GET } = await loadListRoute();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);
      m.selectQueue.push([]); // holders

      const response = await GET(req(), { params: Promise.resolve({ id: 'w1' }) });

      expect(response.status).toBe(200);
      expect(m.auth).not.toHaveBeenCalled();
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
    });
  });
});
