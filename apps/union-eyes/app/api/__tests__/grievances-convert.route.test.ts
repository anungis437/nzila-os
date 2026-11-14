import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
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

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
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

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/convert/route');
}

const INTAKE = '22222222-2222-4222-8222-222222222222';

function convertRequest(body: unknown) {
  return new Request(`http://localhost/api/grievances/${INTAKE}/convert`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('grievances/[id]/convert route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.params = { id: INTAKE };

    m.requireKernelCaseAction.mockResolvedValue(undefined);

    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [{
          id: INTAKE,
          grievanceNumber: 'INT-1',
          status: 'draft',
          type: 'individual',
          title: 'Intake',
          description: 'Desc',
          employerId: null,
          cbaId: null,
          createdBy: '33333333-3333-4333-8333-333333333333',
          grievantId: '44444444-4444-4444-8444-444444444444',
          isConfidential: true,
          hasLegalImplications: true,
        }]),
      })),
    }));

    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: INTAKE }]) })) })) }));
    m.db.insert = vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'g2', grievanceNumber: 'GRV-2', priority: 'medium' }]) })),
    }));

    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation((_context: unknown, fn: any) => fn(m.db));
    m.toLifecycleState.mockImplementation((_domain: string, status: string) => (status === 'draft' ? 'draft' : 'submitted'));
    m.validateTransition.mockReturnValue({ allowed: true });
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
  });

  it('declares what it asks of the wrapper: membership, the case-suite entitlement and a tenant transaction (the kernel decides who may convert)', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Convert an intake into an official case');
    expect(config?.auth).toEqual({ required: true });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('answers 400 for an intake id that is not a uuid, without touching the database', async () => {
    caller.params = { id: 'x' };
    const { POST } = await loadRoute();
    const response = await POST(convertRequest({}));
    expect(response.status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('answers 400 for an invalid priority', async () => {
    const { POST } = await loadRoute();
    const response = await POST(convertRequest({ priority: 'whenever' }));
    expect(response.status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('answers 404 for an intake of another organization (nothing found in the caller organization)', async () => {
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    const { POST } = await loadRoute();
    const response = await POST(convertRequest({}));
    expect(response.status).toBe(404);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('answers 403 and writes nothing when the kernel denies case:transition, after recording the violation', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    m.requireKernelCaseAction.mockRejectedValueOnce(ApiError.forbidden());

    const { POST } = await loadRoute();
    const response = await POST(convertRequest({ priority: 'high' }));

    expect(response.status).toBe(403);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.requireKernelCaseAction).toHaveBeenCalledWith(m.db, { userId: 'u1', organizationId: 'org_1' }, INTAKE, 'case:transition');
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'AUTHORITY_VIOLATION', action: 'convert_intake', resourceId: INTAKE }));
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
  });

  it('converts intake into an official case', async () => {
    const { POST } = await loadRoute();
    const response = await POST(convertRequest({ priority: 'urgent', notes: 'Convert now' }));

    expect(response.status).toBe(200);
    expect(m.requireKernelCaseAction).toHaveBeenCalledWith(m.db, { userId: 'u1', organizationId: 'org_1' }, INTAKE, 'case:transition');
    const inserted = (m.db.insert.mock.results[0].value.values as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(inserted).not.toHaveProperty('unionRepId');
    expect(inserted).toMatchObject({ createdBy: 'u1', relatedGrievanceIds: [INTAKE], status: 'filed', organizationId: 'org_1' });
    expect(inserted.grievantId).toBe('44444444-4444-4444-8444-444444444444');
    expect(inserted).toMatchObject({isConfidential:true,hasLegalImplications:true});
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(2);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'grievance.convert_intake', resourceId: INTAKE }));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'grievance.create_official_case', resourceId: 'g2' }));
  });

  it('answers 409 and creates no case when a concurrent conversion already moved the intake', async () => {
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })) }));
    const { POST } = await loadRoute();
    const response = await POST(convertRequest({}));
    expect(response.status).toBe(409);
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('fails the conversion when an audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await loadRoute();
    const response = await POST(convertRequest({ priority: 'urgent' }));
    expect(response.status).toBe(500);
  });
});
