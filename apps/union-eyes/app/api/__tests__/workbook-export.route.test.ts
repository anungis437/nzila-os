import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { issueWorkbookCapability } from '@/lib/workbook/workbook-capability';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  generateWorkbookPdf: vi.fn(),
  auditClaimedWorkbookWrite: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  selectQueue: [] as unknown[][],
}));

const WB = '11111111-1111-4111-8111-111111111111';

// Shared select chain: consumed both by the authority ownership lookup (via the
// system-context `tx`) and by the route's tier read (via the boundary `tx`).
// Queue order per request: [ownership row, tier row].
const mockDb = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    };
    return chain;
  }),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: m.auth,
}));
// Disclosed adaptation (B102): a same-organization peer needs a steward role; the role check is a seam here.
vi.mock('@/lib/api-auth-guard', () => ({ hasRoleInOrganization: vi.fn(async () => true) }));
vi.mock('@/lib/workbook-pdf/generateWorkbookPdf', () => ({
  generateWorkbookPdf: m.generateWorkbookPdf,
}));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
}));
vi.mock('@/lib/workbook/claimed-write-audit', () => ({ auditClaimedWorkbookWrite: m.auditClaimedWorkbookWrite }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
// Pass-through RLS context helpers so the real authority boundary runs against
// the mocked db/auth. withSystemContext supplies the mock db as its `tx`, and the
// claimant's user-context transaction is the active tenant handle.
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (cb: any) => cb(mockDb),
  withExplicitUserContext: (_userId: string, cb: any) => cb(),
}));
vi.mock('@/db/tenant-context-storage', () => ({ getActiveTenantDb: () => mockDb }));

async function loadRoute() {
  return import('../workbook/[id]/export/route');
}

const exportUrl = `http://localhost/api/workbook/${WB}/export`;
const exportParams = { params: Promise.resolve({ id: WB }) };

// An unclaimed workbook's only credential is its capability; the row carries the hash and expiry the authority checks.
const unclaimedRow = (capability: ReturnType<typeof issueWorkbookCapability>) => ({
  id: WB,
  claimedByUserId: null,
  claimedOrgId: null,
  capabilityTokenHash: capability.tokenHash,
  capabilityTokenExpiresAt: capability.expiresAt,
});

describe('workbook/[id]/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.generateWorkbookPdf.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.auditClaimedWorkbookWrite.mockResolvedValue(undefined);
  });

  it('returns 401 when unauthenticated (claimed workbook)', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).toBe(401);
  });

  it('returns 404 when workbook does not exist', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).toBe(404);
  });

  it('answers a malformed workbook identifier as an absent workbook, without resolving authority or reaching SQL', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), { params: Promise.resolve({ id: 'w1' }) });

    expect(response.status).toBe(404);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(m.auth).not.toHaveBeenCalled();
  });

  it('returns 403 to the holder of the capability of a workbook that is not claimed, before any PDF work', async () => {
    const { GET } = await loadRoute();
    const capability = issueWorkbookCapability();
    m.selectQueue.push([unclaimedRow(capability)]);

    const response = await GET(new NextRequest(exportUrl, { headers: { authorization: `Bearer ${capability.token}` } }), exportParams);

    expect(response.status).toBe(403);
    // Unclaimed export is rejected before any PDF work.
    expect(m.generateWorkbookPdf).not.toHaveBeenCalled();
  });

  it('answers an unclaimed workbook as not found without its capability, or with the wrong one, so it does not say which workbooks exist', async () => {
    const { GET } = await loadRoute();
    const capability = issueWorkbookCapability();
    for (const headers of [{}, { authorization: `Bearer ${issueWorkbookCapability().token}` }]) {
      m.selectQueue.push([unclaimedRow(capability)]);
      const response = await GET(new NextRequest(exportUrl, { headers }), exportParams);
      expect(response.status).toBe(404);
    }
    expect(m.generateWorkbookPdf).not.toHaveBeenCalled();
  });

  it('returns 403 when requester is outside owner organization', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
    m.auth.mockResolvedValueOnce({ userId: 'requester_1' });
    m.getOrganizationIdForUser.mockResolvedValueOnce('org_requester');

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).toBe(403);
  });

  it('returns 402 when workbook tier is not eligible for export', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
    m.selectQueue.push([{ reportTierId: 'basic_preview' }]);

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).toBe(402);
  });

  it('returns 404 when PDF generator returns no buffer', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
    m.selectQueue.push([{ reportTierId: 'workbook_self_guided' }]);
    m.generateWorkbookPdf.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).toBe(404);
  });

  it('returns 503 when PDF generation throws', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
    m.selectQueue.push([{ reportTierId: 'workbook_self_guided' }]);
    m.generateWorkbookPdf.mockRejectedValueOnce(new Error('render failed'));

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).toBe(503);
    expect(m.logger.error).toHaveBeenCalled();
  });

  it('returns PDF attachment on success (claimant), rendered and recorded on the transaction the access boundary opened', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
    m.selectQueue.push([{ reportTierId: 'workbook_self_guided' }]);

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain(`governance-entropy-workbook-${WB}.pdf`);
    expect(m.generateWorkbookPdf).toHaveBeenCalledWith(mockDb, { workbookId: WB });
    // DEF-0B12-WBK-EXPORT-STREAMS-THE-IDENTITY-LINKED-CARRIER-REGISTER-WITH-NO-AUDIT-RECORD
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'claimant', actorUserId: 'user_1', tx: mockDb }),
      expect.objectContaining({ action: 'workbook.export', resourceType: 'workbooks', resourceId: WB }),
    );
  });

  it('does not return the PDF when the export cannot be audited', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
    m.selectQueue.push([{ reportTierId: 'workbook_self_guided' }]);
    m.auditClaimedWorkbookWrite.mockRejectedValueOnce(new Error('audit down'));

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).not.toBe(200);
    expect(response.headers.get('content-type')).not.toBe('application/pdf');
  });

  it('records no export when the tier is not eligible', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'user_1', claimedOrgId: 'org_1' }]);
    m.selectQueue.push([{ reportTierId: 'free' }]);

    await GET(new NextRequest(exportUrl), exportParams);

    expect(m.auditClaimedWorkbookWrite).not.toHaveBeenCalled();
  });

  it('allows a same-organization peer to export', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: WB, claimedByUserId: 'owner_1', claimedOrgId: 'org_shared' }]);
    m.selectQueue.push([{ reportTierId: 'workbook_self_guided' }]);
    m.auth.mockResolvedValueOnce({ userId: 'peer_1' });
    m.getOrganizationIdForUser.mockResolvedValueOnce('org_shared');

    const response = await GET(new NextRequest(exportUrl), exportParams);

    expect(response.status).toBe(200);
  });
});
