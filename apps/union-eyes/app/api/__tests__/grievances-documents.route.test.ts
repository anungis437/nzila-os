import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  getEffectiveCaseAccess: vi.fn(),
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  trackPilotEvent: vi.fn(),
  buildUnionEvidencePack: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  tx: { insert: vi.fn() },
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/db/db', () => ({ db: m.db }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../grievances/[id]/documents/route');
}

const GRIEVANCE = '22222222-2222-4222-8222-222222222222';
const payload = {
  fileUrl: 'https://example.com/doc.pdf',
  title: 'Evidence Document',
  filename: 'evidence.pdf',
  mimeType: 'application/pdf',
  documentType: 'evidence',
  privacyLabel: 'team_confidential',
};
const upload = (body: unknown = payload) => new Request(`http://localhost/api/grievances/${GRIEVANCE}/documents`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const grievanceRow = (createdBy = 'u1') => vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: GRIEVANCE, organizationId: 'org_1', createdBy }]) })) }));

describe('grievances/[id]/documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.params = { id: GRIEVANCE };
    m.db.select = grievanceRow();
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, canUploadDocuments: true });
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: any) => fn(m.tx));
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue({});
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.tx.insert = vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'd1', privacyLabel: 'team_confidential', documentType: 'evidence' }]) })) }));
  });

  it('declares what it asks of the wrapper: a member, the case-suite entitlement and a tenant transaction', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Attach a document to a grievance');
    expect(config?.auth).toEqual({ required: true, minRole: 'member' });
    expect(config?.entitlement).toBe('grievance_case_suite');
    expect(config?.rlsOrgContext).toBe(true);
  });

  it('returns 403 below the member role and 400 for a grievance id that is not a uuid, reading nothing', async () => {
    const { POST } = await loadRoute();
    caller.role = 'guest';
    expect((await POST(upload())).status).toBe(403);
    caller.role = 'member';
    caller.params = { id: 'g1' };
    expect((await POST(upload())).status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('returns 400 for missing required fields and for a body that is not JSON', async () => {
    const { POST } = await loadRoute();
    expect((await POST(upload({ title: 'Document' }))).status).toBe(400);
    const notJson = new Request(`http://localhost/api/grievances/${GRIEVANCE}/documents`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' });
    expect((await POST(notJson)).status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('returns 400 for a file address that is not a web address, and stores nothing', async () => {
    const { POST } = await loadRoute();
    for (const fileUrl of ['javascript:alert(document.cookie)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'ftp://example.com/doc.pdf', 'not a url']) {
      expect((await POST(upload({ ...payload, fileUrl }))).status, fileUrl).toBe(400);
    }
    expect(m.db.select).not.toHaveBeenCalled();
    expect(m.tx.insert).not.toHaveBeenCalled();
    expect((await POST(upload({ ...payload, fileUrl: 'HTTP://storage.example.com/a/doc.pdf' }))).status).toBe(200);
  });

  it('returns 404 when the grievance is not in the caller organization', async () => {
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    const { POST } = await loadRoute();
    expect((await POST(upload())).status).toBe(404);
    expect(m.tx.insert).not.toHaveBeenCalled();
  });

  it('returns 403 for a user without a case relationship or upload grant and stores nothing', async () => {
    m.db.select = grievanceRow('someone-else');
    m.getEffectiveCaseAccess.mockResolvedValueOnce({ canViewCase: false, isPrimaryOwner: false, canUploadDocuments: false });
    const { POST } = await loadRoute();
    expect((await POST(upload())).status).toBe(403);
    expect(m.tx.insert).not.toHaveBeenCalled();
  });

  it('stores the document in the organization transaction and audits inside the same transaction', async () => {
    const { POST } = await loadRoute();
    const response = await POST(upload());
    expect(response.status).toBe(200);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.tx.insert).toHaveBeenCalled();
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      action: 'grievance.document_upload', organizationId: 'org_1', userId: 'u1', resourceId: 'd1',
    }));
  });

  it('fails the upload when the audit record cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValue(new Error('audit write failed'));
    const { POST } = await loadRoute();
    const response = await POST(upload());
    expect(response.status).toBe(500);
  });
});
