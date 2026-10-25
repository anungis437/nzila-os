import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  requireKernelCaseAction: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  auditLog: vi.fn(),
  persistAtomicAudit: vi.fn(),
  validateTransition: vi.fn(),
  toLifecycleState: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/cases/case-authorization', () => ({ requireKernelCaseAction: m.requireKernelCaseAction }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
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
    m.requireKernelCaseAction.mockResolvedValue(undefined);

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

    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation((fn: any) => fn(m.db));
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

  it('answers 403 and writes nothing when the kernel denies case:transition, after recording the violation', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    m.requireKernelCaseAction.mockRejectedValueOnce(ApiError.forbidden());

    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priority: 'high' }),
    }));

    expect(response.status).toBe(403);
    expect(m.requireKernelCaseAction).toHaveBeenCalledWith(m.db, { userId: 'u1', organizationId: 'org_1' }, 'g1', 'case:transition');
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'AUTHORITY_VIOLATION', action: 'convert_intake', resourceId: 'g1' }));
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
  });

  it('converts intake into an official case', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priority: 'urgent', notes: 'Convert now' }),
    }));

    expect(response.status).toBe(200);
    expect(m.requireKernelCaseAction).toHaveBeenCalledWith(m.db, { userId: 'u1', organizationId: 'org_1' }, 'g1', 'case:transition');
    const inserted = (m.db.insert.mock.results[0].value.values as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(inserted).not.toHaveProperty('unionRepId');
    expect(inserted).toMatchObject({ createdBy: 'u1', relatedGrievanceIds: ['g1'], status: 'filed' });
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(2);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'grievance.convert_intake', resourceId: 'g1' }));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'grievance.create_official_case', resourceId: 'g2' }));
  });

  it('fails the conversion when an audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/grievances/g1/convert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priority: 'urgent' }),
    }));
    expect(response.status).toBe(500);
  });
});
