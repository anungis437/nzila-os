import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  canonical: false,
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
  requireEntitlement: vi.fn(),
  withRLSContext: vi.fn(),
  buildEvidencePackage: vi.fn(),
  buildEvidenceZip: vi.fn(),
  buildEvidencePdf: vi.fn(),
  auditCaseExport: vi.fn(),
  recordUnionEyesEvidenceExport: vi.fn(),
  db: { select: vi.fn(), execute: vi.fn() },
}));

const mockQuery = {
  from: vi.fn(() => mockQuery),
  where: vi.fn(() => mockQuery),
  limit: vi.fn(() => Promise.resolve([{ claimId: 'case-1' }])),
  orderBy: vi.fn(() => Promise.resolve([{ id: 'row-1' }])),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser, getUserRoleInOrganization: m.getUserRoleInOrganization }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/evidence-export', () => ({
  buildEvidencePackage: m.buildEvidencePackage,
  buildEvidenceZip: m.buildEvidenceZip,
  buildEvidencePdf: m.buildEvidencePdf,
}));
vi.mock('@/lib/audit-logger', () => ({auditLog:vi.fn().mockResolvedValue(undefined),AuditEventType:{AUTH_FAILED:'AUTH_FAILED'},AuditSeverity:{HIGH:'HIGH'}}));
vi.mock('@/lib/audited-case-mutations', () => ({ auditCaseExport: m.auditCaseExport }));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesEvidenceExport: m.recordUnionEyesEvidenceExport }));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({currentStateContextEnabled:()=>m.canonical}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({
  claims: { claimId: 'claimId' },
  claimUpdates: { claimId: 'claimId', createdAt: 'createdAt' },
  auditLogs: { resourceType: 'resourceType', resourceId: 'resourceId', createdAt: 'createdAt' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(), and: vi.fn(), desc: vi.fn() };
});


vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  findReadableCase: vi.fn(async () => { const rows = await m.db.select().from({}).where({}).limit(1); return rows[0] ?? null }),
}));

async function loadRoute() {
  return import('../cases/[caseId]/export/route');
}

describe('cases/[caseId]/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.canonical = false;
    m.auth.mockResolvedValue({ userId: 'user-1' });
    m.getOrganizationIdForUser.mockResolvedValue('org-1');
    m.getUserRoleInOrganization.mockResolvedValue('officer');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => fn(m.db));
    m.buildEvidencePackage.mockReturnValue({
      pack: { caseId: 'case-1' },
      manifest: { version: 1 },
      verification: { hash: 'abc' },
    });
    m.buildEvidenceZip.mockResolvedValue(Uint8Array.from([1, 2, 3]));
    m.buildEvidencePdf.mockResolvedValue(Uint8Array.from([4, 5, 6]));
    m.auditCaseExport.mockResolvedValue(undefined);
    m.recordUnionEyesEvidenceExport.mockReturnValue(Promise.resolve(undefined));
    m.db.select.mockReturnValue(mockQuery);
  });

  it('returns 401 when the user is not authenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: '' });

    const response = await GET(new Request('http://localhost/api/cases/case-1/export'), { params: Promise.resolve({ caseId: 'case-1' }) });

    expect(response.status).toBe(401);
  });

  it('returns 404 when the case is missing', async () => {
    const { GET } = await loadRoute();
    m.withRLSContext.mockImplementationOnce(async (fn: any) => fn(m.db));
    const emptyQuery: any = {
      from: vi.fn(() => emptyQuery),
      where: vi.fn(() => emptyQuery),
      limit: vi.fn(() => Promise.resolve([])),
      orderBy: vi.fn(() => Promise.resolve([])),
    };
    m.db.select.mockReturnValueOnce(emptyQuery);

    const response = await GET(new Request('http://localhost/api/cases/case-1/export'), { params: Promise.resolve({ caseId: 'case-1' }) });

    expect(response.status).toBe(404);
  });

  it('returns 400 for an unsupported format', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/cases/case-1/export?format=csv'), { params: Promise.resolve({ caseId: 'case-1' }) });

    expect(response.status).toBe(400);
  });

  it('returns the evidence envelope when requested', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/cases/case-1/export?envelope=true'), { params: Promise.resolve({ caseId: 'case-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ manifest: { version: 1 }, pack: { caseId: 'case-1' }, verification: { hash: 'abc' } });
    expect(m.auditCaseExport).toHaveBeenCalledWith(expect.objectContaining({ format: 'json' }));
  });

  it('returns zip exports when requested', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/cases/case-1/export?format=zip'), { params: Promise.resolve({ caseId: 'case-1' }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(m.buildEvidenceZip).toHaveBeenCalled();
  });
  it('denies member export before reading any case or audit data', async () => {
    const { GET } = await loadRoute();
    m.getUserRoleInOrganization.mockResolvedValueOnce('member');
    const response = await GET(new Request('http://localhost/api/cases/case-1/export'), { params: Promise.resolve({caseId:'case-1'}) });
    expect(response.status).toBe(403);
    expect(m.db.select).not.toHaveBeenCalled();
    expect(m.buildEvidencePackage).not.toHaveBeenCalled();
  });
  it('reads canonical audit evidence through the bound transaction without querying legacy audit storage', async () => {
    const { GET } = await loadRoute();
    m.canonical = true;
    const canonicalRecord = {auditId:'proof',contentHash:'hash',previousHash:'predecessor',details:{narRecord:{id:'nar'}}};
    m.db.execute.mockResolvedValueOnce([canonicalRecord]);
    const response = await GET(new Request('http://localhost/api/cases/case-1/export'), {params:Promise.resolve({caseId:'case-1'})});
    expect(response.status).toBe(200);
    expect(m.db.select).toHaveBeenCalledTimes(3);
    expect(m.db.execute).toHaveBeenCalledTimes(1);
    expect(m.buildEvidencePackage).toHaveBeenCalledWith(expect.objectContaining({auditTrail:[canonicalRecord],organizationId:'org-1',caseId:'case-1'}));
  });

});
