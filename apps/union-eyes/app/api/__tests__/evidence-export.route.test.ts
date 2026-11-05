import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const m = vi.hoisted(() => ({
  context: { userId: 'actor-1', organizationId: '11111111-1111-1111-1111-111111111111', role: 'officer' },
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  ApiError: {
    forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
  },
  withApi: m.withApi,
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));

vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: m.persistAtomicAudit,
}));

async function route() {
  vi.resetModules();
  return (await import('../evidence/export/route')).GET;
}

function request(orgId?: string) {
  const url = new URL('http://localhost/api/evidence/export');
  if (orgId) url.searchParams.set('orgId', orgId);
  return new NextRequest(url);
}

describe('DEF-0B7 evidence export: no invented attestations, identity spoofing or unaudited reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.context = { userId: 'actor-1', organizationId: '11111111-1111-1111-1111-111111111111', role: 'officer' };
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (_scope, fn) => fn({ transaction: 'tenant-bound' }));
    // A focused wrapper double: verifies the declared role/org contract and
    // supplies the actor. Production role enforcement belongs to withApi.
    m.withApi.mockImplementation((options, handler) => async (req: NextRequest) => {
      if (!m.context.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (!options.requireOrg || options.auth?.minRole !== 'officer') {
        throw new Error('Evidence export must use officer role and required organization');
      }
      if (m.context.role !== 'officer' && m.context.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      try {
        return await handler({
          request: req,
          organizationId: m.context.organizationId,
          userId: m.context.userId,
        });
      } catch (error) {
        return NextResponse.json({ error: 'Unavailable' }, { status: (error as { status?: number }).status ?? 500 });
      }
    });
  });

  it('refuses to claim evidence exists; logs the scoped attempt and returns no fake policy, SBOM or isolation claims', async () => {
    const GET = await route();
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body).toMatchObject({
      org_id: m.context.organizationId,
      verified: false,
      status: 'not_attested',
      error: 'VERIFIED_EVIDENCE_UNAVAILABLE',
      sbom: { status: 'not_attested', artifact: null },
      policy_checks: { status: 'not_attested', results: null },
      org_isolation: { status: 'not_attested', results: null },
      build: { status: 'not_attested', commit: null, timestamp: null },
    });
    expect(JSON.stringify(body)).not.toMatch(/"enforced"|"denied"|"available":true/);
    expect(m.withRLSContext).toHaveBeenCalledWith(
      { organizationId: m.context.organizationId, userId: m.context.userId },
      expect.any(Function),
    );
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      { transaction: 'tenant-bound' },
      expect.objectContaining({
        organizationId: m.context.organizationId,
        userId: m.context.userId,
        action: 'evidence.export.unavailable',
      }),
    );
  });

  it('rejects another organization ID without issuing or auditing an export', async () => {
    const GET = await route();
    const response = await GET(request('22222222-2222-2222-2222-222222222222'));
    expect(response.status).toBe(403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('does not accept guest/member/steward role titles', async () => {
    for (const role of ['guest', 'member', 'steward', 'unknown']) {
      m.context.role = role;
      const GET = await route();
      const response = await GET(request());
      expect(response.status).toBe(403);
    }
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('rejects anonymous callers without issuing an evidence export', async () => {
    m.context.userId = '';
    const GET = await route();
    expect((await GET(request())).status).toBe(401);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('fails closed if the durable audit transaction cannot commit', async () => {
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit database unavailable'));
    const GET = await route();
    const response = await GET(request(m.context.organizationId));
    expect(response.status).toBe(500);
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
  });
});
