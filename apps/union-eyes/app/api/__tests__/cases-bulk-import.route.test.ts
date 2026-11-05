import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  requireEntitlement: vi.fn(),
  requireCaseFilingCapacity: vi.fn(),
  withRLSContext: vi.fn(),
  createClaim: vi.fn(),
  persistAtomicAudit: vi.fn(),
  logger: { error: vi.fn(), info: vi.fn() },
  existingQueue: [] as unknown[][],
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  requireCaseFilingCapacity: m.requireCaseFilingCapacity,
}));
vi.mock('@/db/queries/claims-queries', () => ({ createClaim: m.createClaim }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') };
});

async function loadRoute() {
  return import('../cases/bulk-import/route');
}

describe('cases/bulk-import route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.existingQueue = [];
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.requireEntitlement.mockResolvedValue(undefined);
    m.requireCaseFilingCapacity.mockResolvedValue(undefined);
    m.createClaim.mockResolvedValue({ claimId: 'c1', claimNumber: 'CLM-1' });
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => (m.existingQueue.shift() ?? []) as unknown[]),
            })),
          })),
        })),
      };
      return fn(tx);
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new Request('http://localhost/api/cases/bulk-import', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cases: [] }),
    }));
    expect(response.status).toBe(401);
  });

  it('returns 403 and imports nothing when the canonical membership lacks bulk filing capacity', async () => {
    const { POST } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.requireCaseFilingCapacity.mockRejectedValueOnce(ApiError.forbidden());

    const response = await POST(new Request('http://localhost/api/cases/bulk-import', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cases: [{ memberId: 'm1', caseType: 'discipline', title: 'A title', description: 'Long enough desc', incidentDate: '2026-01-01' }] }),
    }));

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('FORBIDDEN');
    expect(m.requireCaseFilingCapacity).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', organizationId: 'org_1' }, 'bulk');
    expect(m.createClaim).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid json body', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new Request('http://localhost/api/cases/bulk-import', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad-json',
    }));
    expect(response.status).toBe(400);
  });

  it('imports created and duplicate records with summary', async () => {
    const { POST } = await loadRoute();
    m.existingQueue.push([{ claimId: 'dup1', claimNumber: 'CLM-DUP' }], []);

    const response = await POST(new Request('http://localhost/api/cases/bulk-import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cases: [
          { memberId: 'm1', caseType: 'discipline', title: 'First title', description: 'Long enough desc', incidentDate: '2026-01-01', externalSourceId: 'ext-1' },
          { memberId: 'm2', caseType: 'harassment', title: 'Second title', description: 'Long enough desc', incidentDate: '2026-01-02' },
        ],
      }),
    }));

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.summary.created).toBe(1);
    expect(json.summary.duplicates).toBe(1);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'case.bulk_import_row',
      resourceType: 'claims',
      resourceId: 'c1',
      organizationId: 'org_1',
      userId: 'u1',
    }));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'case.bulk_import',
      resourceType: 'claims',
      organizationId: 'org_1',
      userId: 'u1',
      details: expect.objectContaining({ event: 'BULK_IMPORT', created: 1, duplicates: 1, errors: 0 }),
    }));
  });

  it('withholds the import summary when the batch audit write fails', async () => {
    const { POST } = await loadRoute();
    m.existingQueue.push([]);
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action?: string }) => {
      if (entry.action === 'case.bulk_import') throw new Error('audit failed');
    });

    const response = await POST(new Request('http://localhost/api/cases/bulk-import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cases: [
          { memberId: 'm1', caseType: 'discipline', title: 'First title', description: 'Long enough desc', incidentDate: '2026-01-01' },
        ],
      }),
    }));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('INTERNAL_ERROR');
  });

  it('records a row as an error when its claim audit write fails', async () => {
    const { POST } = await loadRoute();
    m.existingQueue.push([]);
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action?: string }) => {
      if (entry.action === 'case.bulk_import_row') throw new Error('row audit failed');
    });

    const response = await POST(new Request('http://localhost/api/cases/bulk-import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cases: [
          { memberId: 'm1', caseType: 'discipline', title: 'First title', description: 'Long enough desc', incidentDate: '2026-01-01' },
        ],
      }),
    }));

    expect(response.status).toBe(207);
    const json = await response.json();
    expect(json.summary).toMatchObject({ created: 0, errors: 1 });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'case.bulk_import',
      details: expect.objectContaining({ created: 0, errors: 1 }),
    }));
  });

  it('returns 207 when all records error', async () => {
    const { POST } = await loadRoute();
    m.existingQueue.push([], []);
    m.createClaim.mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom2'));

    const response = await POST(new Request('http://localhost/api/cases/bulk-import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cases: [
          { memberId: 'm1', caseType: 'discipline', title: 'First title', description: 'Long enough desc', incidentDate: '2026-01-01' },
          { memberId: 'm2', caseType: 'harassment', title: 'Second title', description: 'Long enough desc', incidentDate: '2026-01-02' },
        ],
      }),
    }));

    expect(response.status).toBe(207);
    const json = await response.json();
    expect(json.summary.errors).toBe(2);
  });
});
