/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 7: regression proof for the organizations creation-path fix.
 *
 * Previously, POST /api/organizations correctly gated creation behind
 * requireSystemAdmin(), but then executed the parent lookup AND the actual
 * INSERT through withRLSContext() (the ordinary tenant runtime connection).
 * Under 0108's organizations RLS policy
 * (`ue_create_direct_org_rls_policy('organizations', 'id', FALSE)` — INSERT
 * ... WITH CHECK (id = current_org_id)), a genuinely new organization's
 * freshly-generated id can never equal the caller's own current_org_id, so
 * that INSERT could never legitimately succeed under enforced RLS. Fixed:
 * the parent lookup and the INSERT now both run inside withSystemContext(),
 * with requireSystemAdmin() remaining the sole authorization decision,
 * evaluated BEFORE any DB access — withSystemContext is only the execution
 * mechanism, never treated as authorization itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireSystemAdmin: vi.fn(),
  auth: vi.fn(),
  withRLSContext: vi.fn(),
  withSystemContext: vi.fn(),
  insertReturning: vi.fn(),
  selectWhere: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  auth: m.auth,
  requireSystemAdmin: m.requireSystemAdmin,
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
  withSystemContext: m.withSystemContext,
}));

vi.mock('@/db/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: m.selectWhere }) }),
    insert: () => ({ values: () => ({ returning: m.insertReturning }) }),
  },
}));

vi.mock('@/db/schema', () => ({ organizations: {} }));
vi.mock('@/lib/utils/hierarchy-validation', () => ({ MAX_HIERARCHY_DEPTH: 10 }));

describe('POST /api/organizations — creation authority + execution boundary (PR #752 round 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withSystemContext.mockImplementation(async (fn: (tx?: unknown) => unknown) => fn({}));
    m.withRLSContext.mockImplementation(async (fn: (tx?: unknown) => unknown) => fn({}));
    m.selectWhere.mockResolvedValue([{ hierarchyPath: [], hierarchyLevel: 0 }]);
    m.insertReturning.mockResolvedValue([{ id: 'new-org-id' }]);
  });

  it('rejects a non-system-admin caller BEFORE any SYSTEM context or DB access is ever entered', async () => {
    m.auth.mockResolvedValue({ userId: 'user-1' });
    m.requireSystemAdmin.mockRejectedValue(new Error('System administrator privileges required'));

    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Rogue Org', type: 'union' }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(403);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.insertReturning).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated caller before requireSystemAdmin is even evaluated', async () => {
    m.auth.mockResolvedValue({ userId: null });

    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Rogue Org', type: 'union' }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(401);
    expect(m.requireSystemAdmin).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('a system-admin caller creates the organization entirely under withSystemContext — no delegated tenant-runtime provisioning path exists', async () => {
    m.auth.mockResolvedValue({ userId: 'sysadmin-1' });
    m.requireSystemAdmin.mockResolvedValue(undefined);

    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Local 123', type: 'local' }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(201);
    // requireSystemAdmin runs (and must resolve) before withSystemContext is ever invoked.
    expect(m.requireSystemAdmin).toHaveBeenCalled();
    expect(m.withSystemContext).toHaveBeenCalled();
    expect(m.insertReturning).toHaveBeenCalled();
    // The INSERT must never execute through the tenant-runtime connection —
    // a tenant cannot create an arbitrary org through ordinary runtime.
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('the parent-organization lookup during creation also executes under withSystemContext, not tenant runtime', async () => {
    m.auth.mockResolvedValue({ userId: 'sysadmin-1' });
    m.requireSystemAdmin.mockResolvedValue(undefined);

    const { POST } = await import('../route');
    const req = new Request('http://localhost/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Local 456', type: 'local', parent_id: 'parent-org-id' }),
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(201);
    expect(m.selectWhere).toHaveBeenCalled();
    // Both the parent lookup and the insert run inside withSystemContext —
    // called at least twice (lookup + insert), never via withRLSContext.
    expect(m.withSystemContext.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });
});

describe('GET /api/organizations — unchanged tenant-scoped read path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withSystemContext.mockImplementation(async (fn: (tx?: unknown) => unknown) => fn({}));
    m.withRLSContext.mockImplementation(async (fn: (tx?: unknown) => unknown) => fn({}));
    m.selectWhere.mockResolvedValue([]);
  });

  it('GET still executes through withRLSContext (tenant runtime), never withSystemContext — creation authority does not leak into the read path', async () => {
    m.auth.mockResolvedValue({ userId: 'member-1' });

    const { GET } = await import('../route');
    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/organizations');
    await GET(req);

    expect(m.withRLSContext).toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });
});
