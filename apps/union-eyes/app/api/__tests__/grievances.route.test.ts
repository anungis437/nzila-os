import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  hasCaseFilingCapacity: vi.fn(),
  batch:vi.fn(),
  withRLSContext: vi.fn(),
  dbInsertReturning: vi.fn(),
  dbInsertValues: vi.fn(),
  dbSelectWhere: vi.fn(),
  persistAtomicAudit: vi.fn(),
  auditLog: vi.fn(),
  emitCapeAuditEvent: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  trackPilotEvent: vi.fn(),
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
vi.mock('@/lib/authority/store/route-adapter',()=>({decideCaseCapabilitiesBatch:m.batch,kernelCaseRelationshipScope:vi.fn()}));
vi.mock('@/lib/triage/designations',()=>({liveDesignationExists:vi.fn()}));
vi.mock('@/lib/cases/case-authorization', () => ({ hasCaseFilingCapacity: m.hasCaseFilingCapacity }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/audit-logger', () => ({
  AuditEventType: {
    AUTHORITY_VIOLATION: 'AUTHORITY_VIOLATION',
    CASE_CREATED: 'CASE_CREATED',
    INTAKE_SUBMITTED: 'INTAKE_SUBMITTED',
    CASE_PRIORITY_SET: 'CASE_PRIORITY_SET',
  },
  auditLog: m.auditLog,
}));
vi.mock('@/lib/audit/cape-audit-events', () => ({
  CAPE_AUDIT_EVENTS: { GRIEVANCE_SUBMITTED: 'GRIEVANCE_SUBMITTED' },
  emitCapeAuditEvent: m.emitCapeAuditEvent,
}));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

async function loadRoute() {
  return import('../grievances/route');
}

describe('grievances route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.hasCaseFilingCapacity.mockResolvedValue(true);
    m.batch.mockImplementation(async(_tx,input)=>new Map(input.caseIds.map((id:string)=>[id,{'case:read':{effect:'allow',scope:{visibility:'internal'}}}])));
    m.withRLSContext.mockImplementation(async (a: unknown, b?: unknown) => {
      const fn = (typeof a === 'function' ? a : b) as (tx?: unknown) => Promise<unknown>;
      return fn(mockDb);
    });
    m.dbInsertReturning.mockResolvedValue([{ id: 'grv_1', grievanceNumber: 'GRV-1', priority: 'medium' }]);
    m.dbSelectWhere.mockResolvedValue([{ id: 'grv_1', status: 'filed' }]);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.emitCapeAuditEvent.mockResolvedValue(undefined);
    m.trackPilotEvent.mockResolvedValue(undefined);
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

  it('POST blocks official case creation without handler filing capacity and writes nothing', async () => {
    const { POST } = await loadRoute();
    m.hasCaseFilingCapacity.mockResolvedValueOnce(false);

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
    expect(m.hasCaseFilingCapacity).toHaveBeenCalledWith({ userId: 'user_1', organizationId: 'org_1' }, 'handler');
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'AUTHORITY_VIOLATION', action: 'create_official_case' }));
    expect(m.dbInsertReturning).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
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
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({ action: 'grievance.submit_intake', organizationId: 'org_1', userId: 'user_1', resourceId: 'grv_1' }));
  });

  it('refuses intake creation when an active identity has no member filing capacity',async()=>{
    const {POST}=await loadRoute();
    m.hasCaseFilingCapacity.mockResolvedValueOnce(false);
    const response=await POST(new NextRequest('http://localhost/api/grievances',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'individual',title:'Synthetic intake',description:'Synthetic platform-only capacity refusal'})}),{organizationId:'org_1',userId:'platform-only'});
    expect(response.status).toBe(403);
    expect(m.hasCaseFilingCapacity).toHaveBeenCalledWith({organizationId:'org_1',userId:'platform-only'},'member');
    expect(m.dbInsertValues).not.toHaveBeenCalled();
  });

  it('binds the represented intake member to authentication rather than submitted contact or identity fields', async () => {
    const {POST}=await loadRoute();
    const actor='33333333-3333-4333-8333-333333333333';
    const response=await POST(new NextRequest('http://localhost/api/grievances',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'individual',title:'Synthetic intake',description:'Synthetic represented member regression',grievantId:'44444444-4444-4444-8444-444444444444',grievantEmail:'different-owned-fixture@resend.dev'})}),{organizationId:'org_1',userId:actor});
    expect(response.status).toBe(200);
    expect(m.dbInsertValues.mock.calls[0][0]).toMatchObject({createdBy:actor,representedMemberUserId:actor});
  });

  it('POST fails when the in-transaction audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/grievances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'individual', title: 'Unsafe workplace condition', description: 'Detailed incident description with enough length.' }),
      }),
      { organizationId: 'org_1', userId: 'user_1' },
    );
    expect(response.status).toBe(500);
    expect(m.trackPilotEvent).not.toHaveBeenCalled();
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
    expect(m.hasCaseFilingCapacity).toHaveBeenCalledWith({ userId: 'user_1', organizationId: 'org_1' }, 'handler');
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockDb, expect.objectContaining({ action: 'grievance.create_official_case' }));
    expect(m.trackPilotEvent).toHaveBeenCalledTimes(2);
  });

  it('GET returns forbidden without handler filing capacity and reads nothing', async () => {
    const { GET } = await loadRoute();
    m.hasCaseFilingCapacity.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/grievances'), {
      organizationId: 'org_1',
      userId: 'user_1',
    });

    expect(response.status).toBe(403);
    expect(m.hasCaseFilingCapacity).toHaveBeenCalledWith({ userId: 'user_1', organizationId: 'org_1' }, 'handler');
    expect(m.withRLSContext).not.toHaveBeenCalled();
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

  it('GET labels related matters as case records and unassigned intakes as triage metadata only', async () => {
    const { GET } = await loadRoute();
    m.dbSelectWhere
      .mockResolvedValueOnce([{ id: 'owned_1', status: 'filed', description: 'full narrative' }])
      .mockResolvedValueOnce([
        { id: 'owned_1', grievanceNumber: 'GRV-1', type: 'discipline', status: 'draft', priority: 'low', createdAt: new Date() },
        { id: 'intake_2', grievanceNumber: 'GRV-2', type: 'other', status: 'draft', priority: 'low', createdAt: new Date() },
      ]);

    const response = await GET(new NextRequest('http://localhost/api/grievances'), {
      organizationId: 'org_1',
      userId: 'chief_steward_1',
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0]).toMatchObject({ id: 'owned_1', accessScope: 'case', description: 'full narrative' });
    expect(payload.data[1]).toMatchObject({ id: 'intake_2', accessScope: 'intake_triage' });
    expect(payload.data[1]).not.toHaveProperty('description');
    expect(payload.data[1]).not.toHaveProperty('grievantName');
    expect(payload.data[1]).not.toHaveProperty('grievantEmail');
  });
  it('GET does not promote an authored/cached candidate after the live kernel refuses it',async()=>{
    const {GET}=await loadRoute();m.dbSelectWhere.mockResolvedValueOnce([{id:'recused-author',createdBy:'user_1',background:'private strategy'}]).mockResolvedValueOnce([]);
    m.batch.mockResolvedValue(new Map([['recused-author',{'case:read':{effect:'deny',scope:{}}}]]));
    const response=await GET(new NextRequest('http://localhost/api/grievances'),{organizationId:'org_1',userId:'user_1'});
    expect((await response.json()).data).toEqual([]);
    expect(m.batch).toHaveBeenCalledWith(mockDb,{userId:'user_1',organizationId:'org_1',caseIds:['recused-author']});
  });
  it('GET confines a subject-only result to member fields despite a staff title',async()=>{
    const {GET}=await loadRoute();m.dbSelectWhere.mockResolvedValueOnce([{id:'own-submission',description:'My submission',background:'staff strategy',legalCosts:123}]).mockResolvedValueOnce([]);
    m.batch.mockResolvedValue(new Map([['own-submission',{'case:read':{effect:'allow',scope:{visibility:'member_visible'}}}]]));
    const response=await GET(new NextRequest('http://localhost/api/grievances'),{organizationId:'org_1',userId:'user_1'});
    const row=(await response.json()).data[0];expect(row).toMatchObject({id:'own-submission',description:'My submission',accessScope:'member_visible'});
    expect(row).not.toHaveProperty('background');expect(row).not.toHaveProperty('legalCosts');
  });

});
