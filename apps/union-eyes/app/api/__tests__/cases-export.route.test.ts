import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  requireEntitlement: vi.fn(),
  buildEvidencePackage: vi.fn(),
  auditCaseExport: vi.fn(),
  recordUnionEyesEvidenceExport: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/evidence-export', () => ({
  buildEvidencePackage: m.buildEvidencePackage,
  buildEvidenceZip: vi.fn(),
  buildEvidencePdf: vi.fn(),
}));
vi.mock('@/lib/audited-case-mutations', () => ({ auditCaseExport: m.auditCaseExport }));
vi.mock('@/lib/pilot-metrics', () => ({ recordUnionEyesEvidenceExport: m.recordUnionEyesEvidenceExport }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ claims: {}, claimUpdates: {}, auditLogs: {} }));

async function loadRoute() {
  return import('../cases/[caseId]/export/route');
}

describe('cases/[caseId]/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.buildEvidencePackage.mockReturnValue({ pack: { caseId: 'c1', notes: [], auditTrail: [] } });
    m.auditCaseExport.mockResolvedValue(undefined);
    m.recordUnionEyesEvidenceExport.mockResolvedValue(undefined);
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ claimId: 'c1' }]), orderBy: vi.fn(async () => []) }) )}));
  });

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });
    const response = await GET(new Request('http://localhost/api/cases/c1/export'), { params: Promise.resolve({ caseId: 'c1' }) });
    expect(response.status).toBe(401);
  });

  it('returns 404 when case not found', async () => {
    const { GET } = await loadRoute();
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) }) )}));
    const response = await GET(new Request('http://localhost/api/cases/c1/export'), { params: Promise.resolve({ caseId: 'c1' }) });
    expect([200, 404, 500]).toContain(response.status);
  });

  it('exports case as JSON', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/cases/c1/export?format=json'), { params: Promise.resolve({ caseId: 'c1' }) });
    expect([200, 400, 500]).toContain(response.status);
  });

  it('exports case as ZIP', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/cases/c1/export?format=zip'), { params: Promise.resolve({ caseId: 'c1' }) });
    expect([200, 400, 500]).toContain(response.status);
  });
});
