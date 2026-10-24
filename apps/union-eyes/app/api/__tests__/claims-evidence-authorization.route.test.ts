import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  actor: vi.fn(),
  findReadableCase: vi.fn(),
  caseHistoryVisibility: vi.fn(() => 'HISTORY_VISIBILITY'),
  withRLSContext: vi.fn(),
  queue: [] as unknown[][],
  audit: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.audit, AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' },
}));
vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  getCaseActor: m.actor,
  findReadableCase: m.findReadableCase,
  caseHistoryVisibility: m.caseHistoryVisibility,
}));

const claimRow = {
  claimId: 'c1', claimNumber: 'CLM-1', status: 'assigned', priority: 'high', claimType: 'grievance_pay',
  description: 'narrative', assignedTo: 'steward-1', attachments: [{ name: 'a.pdf' }],
};
const params = { params: Promise.resolve({ id: 'c1' }) };
const request = () => new NextRequest('http://localhost/api/claims/c1/evidence');

async function loadRoute() {
  return import('../claims/[id]/evidence/route');
}

describe('GET /api/claims/[id]/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.queue = [];
    m.actor.mockResolvedValue({ userId: 'steward-1', organizationId: 'org-1', role: 'steward' });
    m.findReadableCase.mockResolvedValue({ claimId: 'c1' });
    m.audit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(m.queue.shift() ?? []).then(resolve, reject),
      };
      return fn({ select: () => chain });
    });
  });

  it('denies a plain member before touching any record', async () => {
    m.actor.mockResolvedValue({ userId: 'member-1', organizationId: 'org-1', role: 'member' });
    const { GET } = await loadRoute();
    const response = await GET(request(), params);
    expect(response.status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'failure', organizationId: 'org-1' }));
  });

  it('returns 404 for a case the actor cannot read instead of falling back to an unscoped lookup', async () => {
    m.findReadableCase.mockResolvedValue(null);
    const { GET } = await loadRoute();
    const response = await GET(request(), params);
    expect(response.status).toBe(404);
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: 'org-1' }), 'c1');
  });

  it('uses the visibility-filtered history and exposes only the authorized case', async () => {
    m.queue = [
      [claimRow],
      [{ updateId: 'u1', updateType: 'status_change', message: 'moved', createdBy: 'steward-1', isInternal: false, visibilityScope: 'member', metadata: {}, createdAt: 'x' }],
      [],
    ];
    const { GET } = await loadRoute();
    const response = await GET(request(), params);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(m.caseHistoryVisibility).toHaveBeenCalledWith(expect.objectContaining({ role: 'steward' }));
    expect(body.claim.claimId).toBe('c1');
    expect(body.events).toHaveLength(1);
    expect(body.audit_log).toHaveLength(1);
    expect(body.defensibility_pack).toBeNull();
  });
});
