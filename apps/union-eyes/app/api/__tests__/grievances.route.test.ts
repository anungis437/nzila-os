import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  hasMinRole: vi.fn(),
  withRLSContext: vi.fn(),
  dbInsertReturning: vi.fn(),
  dbInsertValues: vi.fn(),
  dbSelectWhere: vi.fn(),
  auditDataMutation: vi.fn(),
  auditLog: vi.fn(),
  emitCapeAuditEvent: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  trackPilotEvent: vi.fn(),
  recordUsage: vi.fn(),
}));

const mockDb = {
  insert: vi.fn(() => ({
    values: (...args: any[]) => {
      m.dbInsertValues(...args);
      return {
        returning: m.dbInsertReturning,
      };
    },
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: m.dbSelectWhere,
        })),
      })),
    })),
  })),
};

vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn((handler: (req: NextRequest, ctx: any) => Promise<Response>) => (req: NextRequest, ctx: any) => handler(req, ctx)),
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/audit-logger', () => ({
  AuditEventType: {
    AUTHORITY_VIOLATION: 'AUTHORITY_VIOLATION',
    CASE_CREATED: 'CASE_CREATED',
    INTAKE_SUBMITTED: 'INTAKE_SUBMITTED',
    CASE_PRIORITY_SET: 'CASE_PRIORITY_SET',
  },
  auditDataMutation: m.auditDataMutation,
  auditLog: m.auditLog,
}));
vi.mock('@/lib/audit/cape-audit-events', () => ({
  CAPE_AUDIT_EVENTS: { GRIEVANCE_SUBMITTED: 'GRIEVANCE_SUBMITTED' },
  emitCapeAuditEvent: m.emitCapeAuditEvent,
}));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/services/platform-economics', () => ({ recordUsage: m.recordUsage }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

async function loadRoute() {
  return import('../grievances/route');
}

describe('grievances route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.dbInsertReturning.mockResolvedValue([{ id: 'grv_1', grievanceNumber: 'GRV-1', priority: 'medium' }]);
    m.dbSelectWhere.mockResolvedValue([{ id: 'grv_1', status: 'filed' }]);
    m.auditDataMutation.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.emitCapeAuditEvent.mockResolvedValue(undefined);
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.recordUsage.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockReturnValue(Promise.resolve(undefined));
  });

  it('POST returns validation error for bad input', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/grievances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x' }),
      }),
      { organizationId: 'org_1', userId: 'user_1' },
    );

    expect(response.status).toBe(400);
  });

  it('POST blocks official case creation for non-steward user', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(
      new NextRequest('http://localhost/api/grievances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'individual',
          title: 'Harassment concern',
          description: 'Long enough description for validation.',
          createOfficialCase: true,
        }),
      }),
      { organizationId: 'org_1', userId: 'user_1' },
    );

    expect(response.status).toBe(403);
  });

  it('POST creates intake successfully', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/grievances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'individual',
          title: 'Unsafe workplace condition',
          description: 'Detailed incident description with enough length.',
        }),
      }),
      { organizationId: 'org_1', userId: 'user_1' },
    );

    expect(response.status).toBe(200);
    expect(m.dbInsertReturning).toHaveBeenCalled();
  });

  it('POST creates an official case and records downstream events', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/grievances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'individual',
          title: 'Unsafe workplace condition',
          description: 'Detailed incident description with enough length.',
          createOfficialCase: true,
          priority: 'high',
        }),
      }),
      { organizationId: 'org_1', userId: 'user_1' },
    );

    expect(response.status).toBe(200);
    expect(m.hasMinRole).toHaveBeenCalledWith('steward');
    expect(m.auditLog).toHaveBeenCalled();
    expect(m.trackPilotEvent).toHaveBeenCalledTimes(2);
    expect(m.recordUsage).toHaveBeenCalled();
  });

  it('GET returns forbidden for non-steward users', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/grievances'), {
      organizationId: 'org_1',
      userId: 'user_1',
    });

    expect(response.status).toBe(403);
  });

  it('GET returns grievance list for steward users', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/grievances?status=active'), {
      organizationId: 'org_1',
      userId: 'user_1',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
  });

  it('GET returns grievance list with default status scope', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/grievances'), {
      organizationId: 'org_1',
      userId: 'user_1',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
  });
});
