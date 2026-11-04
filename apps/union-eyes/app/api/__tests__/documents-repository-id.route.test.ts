import { beforeEach, describe, expect, it, vi } from 'vitest';
import { caller, declared, resetCaller } from './support/with-api-stub';

const DOCUMENT = '11111111-1111-4111-8111-111111111111';
const CASE = '22222222-2222-4222-8222-222222222222';

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  isDocumentVisibleByPolicy: vi.fn(),
  normalizeDocumentTitle: vi.fn(),
  toGovernanceLabel: vi.fn(),
  getEffectiveCaseAccess: vi.fn(),
  getDocumentMutabilityBlockReason: vi.fn(),
  persistAtomicAudit: vi.fn(),
  loadUploaderNames: vi.fn(),
  selectQueue: [] as unknown[][],
  updateReturningQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    // A bounded read can also be locked (`.for('update')`); both resolve to the same rows.
    limit: vi.fn(() => Object.assign(Promise.resolve(rows), { for: vi.fn(async () => rows) })),
    orderBy: vi.fn(async () => rows),
  };
  return chain;
}

// The transaction the route is handed: every statement it makes goes through it.
const mockTx: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => (m.updateReturningQueue.shift() ?? []) as unknown[]),
      })),
    })),
  })),
};

// The ambient handle must never be reached by this route: a statement on it would run outside the organization's transaction.
const ambient = new Proxy({}, { get: () => { throw new Error('the ambient database handle was used'); } });
vi.mock('@/db/db', () => ({ db: ambient }));
vi.mock('@/db', () => ({ db: ambient }));
vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (a: any, b?: any) => {
    const fn = typeof a === 'function' ? a : b;
    return fn(mockTx);
  },
  withSystemContext: async (fn: any) => fn({}),
}));

vi.mock('@/lib/services/document-governance-service', () => ({
  isDocumentVisibleByPolicy: m.isDocumentVisibleByPolicy,
  normalizeDocumentTitle: m.normalizeDocumentTitle,
  toGovernanceLabel: m.toGovernanceLabel,
}));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: m.getEffectiveCaseAccess }));
vi.mock('@/lib/services/document-retention-guard', () => ({ getDocumentMutabilityBlockReason: m.getDocumentMutabilityBlockReason }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/documents/uploader-names', () => ({ loadUploaderNames: m.loadUploaderNames }));
vi.mock('@/db/schema/documents-schema', () => ({
  documents: { id: 'id', title: 'title', filename: 'filename', name: 'name', fileUrl: 'fileUrl', documentType: 'documentType', privacyLabel: 'privacyLabel', uploadedBy: 'uploadedBy', createdAt: 'createdAt', updatedAt: 'updatedAt', organizationId: 'organizationId', metadata: 'metadata', deletedAt: 'deletedAt' },
  documentAccessGrants: { id: 'id', organizationId: 'organizationId', documentId: 'documentId', userId: 'userId', status: 'status', canView: 'canView', revokedAt: 'revokedAt', expiresAt: 'expiresAt' },
  documentLinks: { documentId: 'documentId', linkedEntityType: 'linkedEntityType', linkedEntityId: 'linkedEntityId' },
  documentVersions: { organizationId: 'organizationId', documentId: 'documentId', versionNo: 'versionNo' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), desc: vi.fn(() => 'desc'), eq: vi.fn(() => 'eq'), sql: vi.fn((s: any) => s) };
});

async function loadRoute() {
  return import('../documents/repository/[id]/route');
}

const get = (id: string) => new Request(`http://localhost/api/documents/repository/${id}`);
const patch = (id: string, body: unknown) => new Request(`http://localhost/api/documents/repository/${id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const params = (id: string) => ({ params: { id } });

describe('documents/repository/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'steward';
    m.selectQueue = [];
    m.updateReturningQueue = [];
    m.hasMinRole.mockResolvedValue(true);
    m.isDocumentVisibleByPolicy.mockReturnValue(true);
    m.normalizeDocumentTitle.mockReturnValue('Doc');
    m.toGovernanceLabel.mockReturnValue('public_internal');
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: true, canViewCase: true, canViewPrivateDocuments: true });
    m.getDocumentMutabilityBlockReason.mockReturnValue(null);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.loadUploaderNames.mockResolvedValue({});
  });

  it('declares a member floor for the read, a steward floor for the label change, and the case-suite entitlement', async () => {
    await loadRoute();
    expect(declared.map((options) => options.auth?.minRole)).toEqual(['member', 'steward']);
    expect(declared.map((options) => options.entitlement)).toEqual(['grievance_case_suite', 'grievance_case_suite']);
  });

  it('GET returns 403 when the member floor is not met', async () => {
    const { GET } = await loadRoute();
    caller.role = 'guest';

    const response = await GET(get(DOCUMENT), params(DOCUMENT));
    expect(response.status).toBe(403);
    expect(mockTx.select).not.toHaveBeenCalled();
  });

  it('GET answers a malformed document id as a bad request, not a database error', async () => {
    const { GET } = await loadRoute();

    const response = await GET(get('d1'), params('d1'));
    expect(response.status).toBe(400);
    expect(mockTx.select).not.toHaveBeenCalled();
  });

  it('GET returns 404 when document does not exist', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(get(DOCUMENT), params(DOCUMENT));
    expect(response.status).toBe(404);
  });

  it('GET returns visible document with versions', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ id: DOCUMENT, privacyLabel: 'public_internal', linkedEntityType: null, linkedEntityId: null, title: 'Doc' }],
      [],
      [{ id: 'v1', versionNo: 2 }],
    );

    const response = await GET(get(DOCUMENT), params(DOCUMENT));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.versions).toHaveLength(1);
  });

  it('GET names the uploader of the document and of each version for a representative', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ id: DOCUMENT, privacyLabel: 'public_internal', linkedEntityType: null, linkedEntityId: null, title: 'Doc', uploadedBy: 'u-doc' }],
      [],
      [{ id: 'v2', versionNo: 2, uploadedBy: 'u-v2' }, { id: 'v1', versionNo: 1, uploadedBy: 'u-gone' }],
    );
    m.loadUploaderNames.mockResolvedValue({ 'u-doc': 'Alice Steward', 'u-v2': 'Bob Officer' });

    const json = await (await GET(get(DOCUMENT), params(DOCUMENT))).json();

    expect(m.loadUploaderNames).toHaveBeenCalledWith('org_1', ['u-doc', 'u-v2', 'u-gone']);
    expect(json.data).toMatchObject({ uploadedBy: 'u-doc', uploadedByName: 'Alice Steward' });
    // Someone who is no longer a member has no name to show; the id is not offered in its place.
    expect(json.data.versions).toMatchObject([
      { versionNo: 2, uploadedBy: 'u-v2', uploadedByName: 'Bob Officer' },
      { versionNo: 1, uploadedBy: 'u-gone', uploadedByName: null },
    ]);
  });

  it('GET shows a member neither the uploader id nor a name, on the document or on its versions', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValue(false);
    m.selectQueue.push(
      [{ id: DOCUMENT, privacyLabel: 'public_internal', linkedEntityType: null, linkedEntityId: null, title: 'Doc', uploadedBy: 'u-doc' }],
      [],
      [{ id: 'v1', versionNo: 1, uploadedBy: 'u-v1' }],
    );

    const json = await (await GET(get(DOCUMENT), params(DOCUMENT))).json();

    expect(m.loadUploaderNames).not.toHaveBeenCalled();
    expect(json.data).not.toHaveProperty('uploadedBy');
    expect(json.data).not.toHaveProperty('uploadedByName');
    expect(json.data.versions[0]).not.toHaveProperty('uploadedBy');
    expect(json.data.versions[0]).not.toHaveProperty('uploadedByName');
  });

  it('GET decides a case-linked document with the case kernel, for the caller of the organization', async () => {
    const { GET } = await loadRoute();
    caller.userId = 'u7';
    m.selectQueue.push(
      [{ id: DOCUMENT, privacyLabel: 'public_internal', linkedEntityType: 'grievance', linkedEntityId: CASE, title: 'Doc' }],
      [],
      [],
    );

    const response = await GET(get(DOCUMENT), params(DOCUMENT));
    expect(response.status).toBe(200);
    expect(m.getEffectiveCaseAccess).toHaveBeenCalledWith({ organizationId: 'org_1', grievanceId: CASE, userId: 'u7' });
  });

  it('GET returns 403 when the classification policy does not let the caller see the document', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: DOCUMENT, privacyLabel: 'privileged', linkedEntityType: null, linkedEntityId: null, title: 'Doc' }], []);
    m.isDocumentVisibleByPolicy.mockReturnValue(false);

    const response = await GET(get(DOCUMENT), params(DOCUMENT));
    expect(response.status).toBe(403);
  });

  it('PATCH returns 403 below the steward floor', async () => {
    const { PATCH } = await loadRoute();
    caller.role = 'member';

    const response = await PATCH(patch(DOCUMENT, { privacyLabel: 'team_confidential' }), params(DOCUMENT));
    expect(response.status).toBe(403);
    expect(mockTx.select).not.toHaveBeenCalled();
  });

  it('PATCH answers a malformed document id as a bad request', async () => {
    const { PATCH } = await loadRoute();

    const response = await PATCH(patch('d1', { privacyLabel: 'team_confidential' }), params('d1'));
    expect(response.status).toBe(400);
    expect(mockTx.select).not.toHaveBeenCalled();
  });

  it('PATCH returns 400 for invalid payload', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(patch(DOCUMENT, { privacyLabel: 'invalid' }), params(DOCUMENT));

    expect(response.status).toBe(400);
  });

  it('PATCH returns 404 when the document is not in the organization', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([]);

    const response = await PATCH(patch(DOCUMENT, { privacyLabel: 'team_confidential' }), params(DOCUMENT));

    expect(response.status).toBe(404);
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('PATCH returns 403 when the caller is not the primary owner of the linked case', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: DOCUMENT, privacyLabel: 'public_internal', metadata: {}, linkedEntityType: 'grievance', linkedEntityId: CASE }]);
    m.getEffectiveCaseAccess.mockResolvedValue({ isPrimaryOwner: false, canViewCase: true, canViewPrivateDocuments: false });

    const response = await PATCH(patch(DOCUMENT, { privacyLabel: 'team_confidential' }), params(DOCUMENT));

    expect(response.status).toBe(403);
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('PATCH returns 409 when retention guard blocks update', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: DOCUMENT, privacyLabel: 'public_internal', metadata: {}, linkedEntityType: null, linkedEntityId: null }]);
    m.getDocumentMutabilityBlockReason.mockReturnValueOnce('legal_hold');

    const response = await PATCH(patch(DOCUMENT, { privacyLabel: 'team_confidential' }), params(DOCUMENT));

    expect(response.status).toBe(409);
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('PATCH updates label and returns the updated document, audited in the same transaction', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: DOCUMENT, privacyLabel: 'public_internal', metadata: {}, linkedEntityType: 'grievance', linkedEntityId: CASE }]);
    m.updateReturningQueue.push([{ id: DOCUMENT, privacyLabel: 'team_confidential' }]);

    const response = await PATCH(patch(DOCUMENT, { privacyLabel: 'team_confidential' }), params(DOCUMENT));

    expect(response.status).toBe(200);
    // The response data is the updated document itself (not a one-element list).
    expect((await response.json()).data).toMatchObject({ id: DOCUMENT, privacyLabel: 'team_confidential' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockTx, expect.objectContaining({ action: 'document.label_change', organizationId: 'org_1', userId: 'u1', resourceId: DOCUMENT }));
  });

  it('PATCH fails when the in-transaction audit record cannot be written', async () => {
    const { PATCH } = await loadRoute();
    m.selectQueue.push([{ id: DOCUMENT, privacyLabel: 'public_internal', metadata: {}, linkedEntityType: null, linkedEntityId: null }]);
    m.updateReturningQueue.push([{ id: DOCUMENT, privacyLabel: 'team_confidential' }]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit write failed'));

    const response = await PATCH(patch(DOCUMENT, { privacyLabel: 'team_confidential' }), params(DOCUMENT));

    expect(response.status).toBe(500);
  });
});
