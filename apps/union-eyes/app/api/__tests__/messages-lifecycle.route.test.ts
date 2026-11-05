import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Route contract for the conversation lifecycle, legal hold, retention policy, read and detail routes: authentication,
// the role floor each route declares, body validation, and how every service outcome becomes an HTTP answer. The service
// behaviour itself (authority, atomic audit, rollback, revocation) is proven on PostgreSQL in
// lib/messaging/thread-lifecycle.pglite.test.ts; here the services are doubles.
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getCurrentUser: vi.fn(),
  getUserRole: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  requireEntitlement: vi.fn(),
  withRLSContext: vi.fn(),
  changeThreadLifecycle: vi.fn(),
  setLegalHold: vi.fn(),
  adoptRetentionPolicy: vi.fn(),
  liveRetentionPolicy: vi.fn(),
  readRetentionPolicy: vi.fn(),
  markThreadRead: vi.fn(),
  getThreadDetail: vi.fn(),
  listTriageQueue: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/api-auth-guard', async (original) => ({ ...(await original<typeof import('@/lib/api-auth-guard')>()), getCurrentUser: m.getCurrentUser }));
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: m.getUserRole }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser, getUserRoleInOrganization: m.getUserRoleInOrganization }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn().mockResolvedValue(undefined), AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }));
vi.mock('@/lib/messaging/thread-lifecycle', async (original) => ({
  ...(await original<typeof import('@/lib/messaging/thread-lifecycle')>()),
  changeThreadLifecycle: m.changeThreadLifecycle,
  setLegalHold: m.setLegalHold,
  adoptRetentionPolicy: m.adoptRetentionPolicy,
  liveRetentionPolicy: m.liveRetentionPolicy,
  readRetentionPolicy: m.readRetentionPolicy,
}));
vi.mock('@/lib/messaging/thread-read-state', () => ({ markThreadRead: m.markThreadRead, getThreadDetail: m.getThreadDetail }));
vi.mock('@/lib/messaging/thread-assignment', () => ({ listTriageQueue: m.listTriageQueue }));

const THREAD = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ threadId: THREAD }) };
const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost/api/messages/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function readJson(response: Response) {
  return (await response.json()) as Record<string, any>;
}

describe('messages lifecycle routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'user-1' });
    // withApi resolves the caller through getCurrentUser and the role floor through the stored role; both follow the one role set per test.
    m.getCurrentUser.mockImplementation(async () => {
      const { userId } = await m.auth();
      return userId ? { id: userId, organizationId: '11111111-1111-4111-8111-aaaaaaaaaaaa', role: await m.getUserRoleInOrganization() } : null;
    });
    m.getUserRole.mockImplementation(async () => m.getUserRoleInOrganization());
    m.getOrganizationIdForUser.mockResolvedValue('11111111-1111-4111-8111-aaaaaaaaaaaa');
    m.getUserRoleInOrganization.mockResolvedValue('member');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
  });

  describe('POST threads/[threadId]/lifecycle', () => {
    const load = async () => (await import('../messages/threads/[threadId]/lifecycle/route')).POST;

    it('requires authentication', async () => {
      m.auth.mockResolvedValueOnce({ userId: null });
      expect((await (await load())(post(`threads/${THREAD}/lifecycle`, { action: 'close' }), ctx)).status).toBe(401);
      expect(m.changeThreadLifecycle).not.toHaveBeenCalled();
    });

    it.each([{ action: 'delete' }, { action: 'reopen' }, {}])('rejects %j before any service call', async (body) => {
      const response = await (await load())(post(`threads/${THREAD}/lifecycle`, body), ctx);
      expect(response.status).toBe(400);
      expect(m.changeThreadLifecycle).not.toHaveBeenCalled();
    });

    it('closes and archives through the service with the caller as actor, answering 200', async () => {
      m.changeThreadLifecycle.mockResolvedValueOnce({ kind: 'ok', action: 'close' });
      const response = await (await load())(post(`threads/${THREAD}/lifecycle`, { action: 'close' }), ctx);
      expect(response.status).toBe(200);
      expect((await readJson(response)).data).toEqual({ action: 'close' });
      expect(m.changeThreadLifecycle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'user-1', role: 'member' }), THREAD, 'close');
    });

    it('answers 404 for a conversation the caller cannot read, and 409 with the conflict code otherwise', async () => {
      m.changeThreadLifecycle.mockResolvedValueOnce({ kind: 'not_found' });
      expect((await (await load())(post(`threads/${THREAD}/lifecycle`, { action: 'close' }), ctx)).status).toBe(404);
      m.changeThreadLifecycle.mockResolvedValueOnce({ kind: 'conflict', code: 'NOT_CLOSED' });
      const conflict = await (await load())(post(`threads/${THREAD}/lifecycle`, { action: 'archive' }), ctx);
      expect(conflict.status).toBe(409);
      expect((await readJson(conflict)).error.code).toBe('NOT_CLOSED');
    });

    it('lets a service failure (for example a failed audit write) surface as an error, never as success', async () => {
      m.changeThreadLifecycle.mockRejectedValueOnce(new Error('audit write failed'));
      expect((await (await load())(post(`threads/${THREAD}/lifecycle`, { action: 'close' }), ctx)).status).toBeGreaterThanOrEqual(500);
    });
  });

  describe('POST threads/[threadId]/legal-hold', () => {
    const load = async () => (await import('../messages/threads/[threadId]/legal-hold/route')).POST;

    it('has no role floor; a denied decision is forbidden for every role', async () => {
      for (const role of ['member', 'steward', 'admin']) {
        m.getUserRoleInOrganization.mockResolvedValue(role);
        m.setLegalHold.mockResolvedValueOnce({ kind: 'forbidden' });
        const response = await (await load())(post(`threads/${THREAD}/legal-hold`, { action: 'place', reference: 'MATTER-1' }), ctx);
        expect(response.status).toBe(403);
      }
      expect(m.setLegalHold).toHaveBeenCalledTimes(3);
    });

    it('requires a reference and a known action', async () => {
      m.getUserRoleInOrganization.mockResolvedValue('admin');
      for (const body of [{ action: 'place' }, { action: 'place', reference: '   ' }, { action: 'delete', reference: 'x' }]) {
        expect((await (await load())(post(`threads/${THREAD}/legal-hold`, body), ctx)).status).toBe(400);
      }
      expect(m.setLegalHold).not.toHaveBeenCalled();
    });

    it('maps every outcome: ok, not found, forbidden and conflicts', async () => {
      m.getUserRoleInOrganization.mockResolvedValue('admin');
      const call = async () => (await load())(post(`threads/${THREAD}/legal-hold`, { action: 'place', reference: 'MATTER-1' }), ctx);
      m.setLegalHold.mockResolvedValueOnce({ kind: 'ok', held: true });
      const ok = await call();
      expect(ok.status).toBe(200);
      expect((await readJson(ok)).data).toEqual({ held: true });
      m.setLegalHold.mockResolvedValueOnce({ kind: 'not_found' });
      expect((await call()).status).toBe(404);
      m.setLegalHold.mockResolvedValueOnce({ kind: 'forbidden' });
      expect((await call()).status).toBe(403);
      m.setLegalHold.mockResolvedValueOnce({ kind: 'conflict', code: 'ALREADY_HELD' });
      const conflict = await call();
      expect(conflict.status).toBe(409);
      expect((await readJson(conflict)).error.code).toBe('ALREADY_HELD');
    });
  });

  describe('retention-policy', () => {
    const load = async () => import('../messages/retention-policy/route');
    const policyBody = { retentionDays: 365, policyReference: 'Policy 1', authorityReference: 'Resolution 9' };

    it('has no role floor; a denied decision is forbidden for read and write', async () => {
      m.getUserRoleInOrganization.mockResolvedValue('admin');
      m.readRetentionPolicy.mockResolvedValueOnce({ kind: 'forbidden' });
      m.adoptRetentionPolicy.mockResolvedValueOnce({ kind: 'forbidden' });
      const { GET, POST } = await load();
      expect((await GET(new NextRequest('http://localhost/api/messages/retention-policy'), { params: Promise.resolve({}) })).status).toBe(403);
      expect((await POST(post('retention-policy', policyBody), { params: Promise.resolve({}) })).status).toBe(403);
      expect(m.readRetentionPolicy).toHaveBeenCalled();
      expect(m.adoptRetentionPolicy).toHaveBeenCalled();
    });

    it('reports honestly that no policy is adopted', async () => {
      m.getUserRoleInOrganization.mockResolvedValue('admin');
      m.readRetentionPolicy.mockResolvedValueOnce({ kind: 'ok', policy: null });
      const { GET } = await load();
      const response = await GET(new NextRequest('http://localhost/api/messages/retention-policy'), { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
      expect(await readJson(response)).toMatchObject({ data: { adopted: false, policy: null } });
    });

    it('rejects an invalid period and records a valid adoption with 201', async () => {
      m.getUserRoleInOrganization.mockResolvedValue('admin');
      const { POST } = await load();
      for (const retentionDays of [0, -5, 1.5, 36501, '30']) {
        expect((await POST(post('retention-policy', { ...policyBody, retentionDays }), { params: Promise.resolve({}) })).status).toBe(400);
      }
      expect((await POST(post('retention-policy', { ...policyBody, authorityReference: '' }), { params: Promise.resolve({}) })).status).toBe(400);
      expect(m.adoptRetentionPolicy).not.toHaveBeenCalled();
      m.adoptRetentionPolicy.mockResolvedValueOnce({ kind: 'ok', policy: { id: 'p1', retentionDays: 365 } });
      const response = await POST(post('retention-policy', policyBody), { params: Promise.resolve({}) });
      expect(response.status).toBe(201);
      expect(m.adoptRetentionPolicy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ role: 'admin' }), policyBody);
    });
  });

  describe('POST threads/[threadId]/read', () => {
    const load = async () => (await import('../messages/threads/[threadId]/read/route')).POST;

    it('answers 200 with whether the marker moved, and 404 when the conversation is not the caller\'s', async () => {
      m.markThreadRead.mockResolvedValueOnce({ kind: 'ok', changed: true });
      const ok = await (await load())(post(`threads/${THREAD}/read`, {}), ctx);
      expect(ok.status).toBe(200);
      expect((await readJson(ok)).data).toEqual({ changed: true });
      m.markThreadRead.mockResolvedValueOnce({ kind: 'not_found' });
      expect((await (await load())(post(`threads/${THREAD}/read`, {}), ctx)).status).toBe(404);
    });
  });

  describe('GET threads/[threadId]', () => {
    const load = async () => (await import('../messages/threads/[threadId]/route')).GET;
    const get = () => new NextRequest(`http://localhost/api/messages/threads/${THREAD}`);

    it('returns the detail the service allows, and 404 for an unreadable conversation', async () => {
      m.getThreadDetail.mockResolvedValueOnce({ id: THREAD, subject: 'S', viewerRole: 'member', retention: { audience: 'member', state: 'policy_not_adopted' } });
      const ok = await (await load())(get(), ctx);
      expect(ok.status).toBe(200);
      expect((await readJson(ok)).data.thread.retention).toEqual({ audience: 'member', state: 'policy_not_adopted' });
      m.getThreadDetail.mockResolvedValueOnce(null);
      expect((await (await load())(get(), ctx)).status).toBe(404);
    });
  });

  describe('GET queue', () => {
    const load = async () => (await import('../messages/queue/route')).GET;

    it('answers 404, as for a missing route, when the caller holds no live designation', async () => {
      m.getUserRoleInOrganization.mockResolvedValue('steward');
      m.listTriageQueue.mockResolvedValueOnce(null);
      expect((await (await load())(new NextRequest('http://localhost/api/messages/queue'), { params: Promise.resolve({}) })).status).toBe(404);
      m.listTriageQueue.mockResolvedValueOnce([{ id: THREAD, subject: 'S', category: null, priority: 'normal', createdAt: '2026-10-20T00:00:00.000Z' }]);
      const ok = await (await load())(new NextRequest('http://localhost/api/messages/queue'), { params: Promise.resolve({}) });
      expect(ok.status).toBe(200);
      expect(JSON.stringify(await readJson(ok))).not.toMatch(/memberId|staffId|content|body/);
    });

    it('is closed below steward', async () => {
      m.getUserRoleInOrganization.mockResolvedValue('member');
      expect((await (await load())(new NextRequest('http://localhost/api/messages/queue'), { params: Promise.resolve({}) })).status).toBe(403);
      expect(m.listTriageQueue).not.toHaveBeenCalled();
    });
  });
});
