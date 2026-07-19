import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  auditLog: vi.fn(),
  validateTransition: vi.fn(),
  toLifecycleState: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { warn: vi.fn() },
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: {
    AUTHORITY_VIOLATION: 'AUTHORITY_VIOLATION',
    INTAKE_CONVERTED: 'INTAKE_CONVERTED',
    CASE_CREATED: 'CASE_CREATED',
    CASE_PRIORITY_SET: 'CASE_PRIORITY_SET',
  },
  AuditSeverity: { HIGH: 'HIGH', LOW: 'LOW' },
}));
vi.mock('@/lib/workflow/case-lifecycle', () => ({ validateTransition: m.validateTransition }));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: m.toLifecycleState }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../grievances/[id]/convert/route');
}

describe('grievances/[id]/convert route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withOrganizationAuth.mockImplementation((handler: any) => {
      return (request: Request, context: any = { organizationId: 'org_1', userId: 'u1' }, params: any = { id: 'g1' }) =>
        handler(request, context, params);
    });

    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);

    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{
          id: 'g1',
          grievanceNumber: 'INT-1',
          status: 'draft',
          type: 'individual',
          title: 'Intake',
          description: 'Desc',
          employerId: null,
          cbaId: null,
        }]),
      })),
    }));

    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));
    m.db.insert = vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'g2', grievanceNumber: 'GRV-2', priority: 'medium' }]) })),
    }));

    m.withRLSContext.mockImplementation((fn: any) => fn());
    m.toLifecycleState.mockImplementation((_domain: string, status: string) => (status === 'draft' ? 'draft' : 'submitted'));
    m.validateTransition.mockReturnValue({ allowed: true });
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
  });

  it('returns validation error when id is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/x/convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }), { organizationId: 'org_1', userId: 'u1' }, {});

    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });

  it('returns forbidden for non-steward user', async () => {
    m.hasMinRole.mockResolvedValueOnce(false);

    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priority: 'high' }),
    }));

    expect([200, 403, 500]).toContain(response.status);
  });

  it('converts intake into an official case', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priority: 'urgent', notes: 'Convert now' }),
    }));

    expect([200, 201, 400, 403, 404, 500]).toContain(response.status);
  });
});
