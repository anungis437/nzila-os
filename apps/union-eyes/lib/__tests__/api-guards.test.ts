import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockCreateAuditedScopedDb: vi.fn(),
  mockCreateScopedDb: vi.fn(),
  mockCreateRequestContext: vi.fn(),
  mockRunWithContext: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.mockAuth,
}));

vi.mock('@nzila/db', () => ({
  withAudit: vi.fn(),
  createAuditedScopedDb: mocks.mockCreateAuditedScopedDb,
  createScopedDb: mocks.mockCreateScopedDb,
}));

vi.mock('@nzila/os-core', () => ({
  createRequestContext: mocks.mockCreateRequestContext,
  runWithContext: mocks.mockRunWithContext,
}));

import { authenticateUser, getAuditedDb, getReadOnlyDb, withRequestContext } from '../api-guards';

describe('api-guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateUser', () => {
    it('returns ok:true with userId when authenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: 'user-123' });
      const result = await authenticateUser();
      expect(result).toEqual({ ok: true, userId: 'user-123' });
    });

    it('returns ok:false with 401 response when unauthenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      const result = await authenticateUser();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.response.status).toBe(401);
      }
    });
  });

  describe('getAuditedDb', () => {
    it('returns audited db when authenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: 'user-123' });
      const fakeDb = { query: vi.fn() };
      mocks.mockCreateAuditedScopedDb.mockReturnValue(fakeDb);

      const result = await getAuditedDb('org-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.db).toBe(fakeDb);
        expect(result.userId).toBe('user-123');
      }
    });

    it('returns 401 when unauthenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      const result = await getAuditedDb('org-1');
      expect(result.ok).toBe(false);
    });
  });

  describe('getReadOnlyDb', () => {
    it('creates a scoped db for the org', () => {
      const fakeDb = { select: vi.fn() };
      mocks.mockCreateScopedDb.mockReturnValue(fakeDb);

      const db = getReadOnlyDb('org-1');
      expect(db).toBe(fakeDb);
      expect(mocks.mockCreateScopedDb).toHaveBeenCalledWith({ orgId: 'org-1' });
    });
  });

  describe('withRequestContext', () => {
    it('creates context and runs function', async () => {
      const ctx = { traceId: 'abc' };
      mocks.mockCreateRequestContext.mockReturnValue(ctx);
      mocks.mockRunWithContext.mockImplementation((_ctx: unknown, fn: () => unknown) => fn());

      const req = new Request('http://localhost/api/test');
      const result = await withRequestContext(req, async () => 'result');

      expect(mocks.mockCreateRequestContext).toHaveBeenCalledWith(req);
      expect(result).toBe('result');
    });
  });
});
