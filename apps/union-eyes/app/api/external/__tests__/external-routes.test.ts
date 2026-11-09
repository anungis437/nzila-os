import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const selectQueue: any[][] = [];
  const query: any = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(async () => selectQueue.shift() ?? []),
    limit: vi.fn(async () => selectQueue.shift() ?? []),
  };

  return {
    selectQueue,
    db: {
      select: vi.fn(() => query),
      insert: vi.fn(),
    },
    requireUser: vi.fn(),
    withRLSContext: vi.fn(),
    withExplicitUserContext: vi.fn(),
    withPrincipalOnlyContext: vi.fn(),
    holdsExternalAuthority: vi.fn(),
    authorizeExternalMatterAccess: vi.fn(),
    authorizeExternalDocumentAccess: vi.fn(),
    generateSasUrl: vi.fn(),
    resolveStoredBlob: vi.fn(),
    audit: vi.fn(),
    checkIntake: vi.fn(),
    bindIntake: vi.fn(),
    openIntake: vi.fn(),
    IntakeConflictError: class IntakeConflictError extends Error {},
  };
});

vi.mock('@/db/db', () => ({ db: mocks.db }));
vi.mock('@/lib/api-auth-guard', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mocks.withRLSContext,
  withExplicitUserContext: mocks.withExplicitUserContext,
  withPrincipalOnlyContext: mocks.withPrincipalOnlyContext,
}));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => false }));
vi.mock('@/lib/services/external-resource-authorization-service', () => ({
  authorizeExternalMatterAccess: mocks.authorizeExternalMatterAccess,
  authorizeExternalDocumentAccess: mocks.authorizeExternalDocumentAccess,
  holdsExternalAuthority: mocks.holdsExternalAuthority,
}));
vi.mock('@/lib/blob-client', () => ({ generateSasUrl: mocks.generateSasUrl, readBlobBounded: vi.fn(), BlobTooLargeError: class extends Error {} }));
vi.mock('@/lib/services/document-blob-integrity-service', () => ({ resolveStoredBlob: mocks.resolveStoredBlob }));
vi.mock('@/lib/documents/intake-lifecycle', () => ({
  checkIntakeForAcceptance: mocks.checkIntake,
  openIntake: mocks.openIntake,
  bindIntakeInTx: mocks.bindIntake,
  IntakeConflictError: mocks.IntakeConflictError,
}));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: async () => ({ allowed: true }), RATE_LIMITS: { DOCUMENT_UPLOAD: {} }, createRateLimitHeaders: () => ({}) }));
vi.mock('@/lib/security/clamav', () => ({ isMalwareScanError: () => false }));
vi.mock('@/lib/documents/intake-storage', () => ({ blobIntakeStorage: { name: 'intake-storage' } }));

describe('external resource routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.audit.mockReset().mockResolvedValue(undefined);
    mocks.withRLSContext.mockImplementation(async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation(mocks.db));
    mocks.withExplicitUserContext.mockImplementation(async (_userId: string, operation: () => Promise<unknown>) => operation());
    mocks.withPrincipalOnlyContext.mockImplementation(async (operation: (tx: unknown) => Promise<unknown>) => operation('principal-tx'));
    mocks.holdsExternalAuthority.mockResolvedValue(true);
    mocks.requireUser.mockResolvedValue({ userId: '11111111-1111-1111-1111-111111111111', organizationId: '22222222-2222-2222-2222-222222222222' });
    mocks.authorizeExternalMatterAccess.mockResolvedValue({
      allowed: true,
      reason: 'allowed',
      authorityId: '33333333-3333-3333-3333-333333333333',
      matterGrantId: '44444444-4444-4444-4444-444444444444',
    });
    mocks.authorizeExternalDocumentAccess.mockResolvedValue({
      allowed: true,
      reason: 'allowed',
      authorityId: '33333333-3333-3333-3333-333333333333',
      matterGrantId: '44444444-4444-4444-4444-444444444444',
      documentGrantId: '55555555-5555-5555-5555-555555555555',
    });
    mocks.generateSasUrl.mockResolvedValue('https://storage.example/doc.pdf?sig=1');
    mocks.resolveStoredBlob.mockResolvedValue({
      blobPath: 'documents/99999999-9999-9999-9999-999999999999/external-upload.pdf',
      fileUrl: 'https://storage.example/doc.pdf?sig=1',
      contentHash: '0'.repeat(64),
    });
  });

  // DEF-0B8-FED-EXTERNAL-ORGANIZATION-FROM-QUERY-OPENS-TENANT-CONTEXT-AND-AUDIT-BEFORE-GRANT
  it('refuses a caller who holds no authority in the named organization without opening its tenant transaction or writing its audit', async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');
    mocks.holdsExternalAuthority.mockResolvedValueOnce(false);

    const response = await GET(
      new Request('https://example.test/api/external/grievances/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?organizationId=99999999-9999-9999-9999-999999999999'),
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    );

    expect(response.status).toBe(403);
    expect(mocks.withPrincipalOnlyContext).toHaveBeenCalledTimes(1);
    expect(mocks.holdsExternalAuthority).toHaveBeenCalledWith('principal-tx', {
      actorUserId: '11111111-1111-1111-1111-111111111111',
      organizationId: '99999999-9999-9999-9999-999999999999',
      matterType: 'grievance',
      matterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
    expect(mocks.authorizeExternalMatterAccess).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('asks the authority question before the organization transaction is opened', async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');
    const order: string[] = [];
    mocks.holdsExternalAuthority.mockImplementationOnce(async () => (order.push('precheck'), true));
    mocks.withRLSContext.mockImplementation(async (_c: unknown, op: (tx: unknown) => Promise<unknown>) => (order.push('tenant'), op(mocks.db)));
    mocks.selectQueue.push([]);

    await GET(
      new Request('https://example.test/api/external/grievances/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?organizationId=99999999-9999-9999-9999-999999999999'),
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    );

    expect(order[0]).toBe('precheck');
    expect(order).toContain('tenant');
  });

  it('returns an external-safe grievance detail projection for an exact grant', async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');
    const internalSentinels = [
      'INTERNAL_SECRET_SENTINEL_DESCRIPTION',
      'INTERNAL_SECRET_SENTINEL_BACKGROUND',
      'INTERNAL_SECRET_SENTINEL_DESIRED_OUTCOME',
      'INTERNAL_SECRET_SENTINEL_GRIEVANT_EMAIL',
      'INTERNAL_SECRET_SENTINEL_UNION_REP',
      'INTERNAL_SECRET_SENTINEL_EMPLOYER_REP',
      'INTERNAL_SECRET_SENTINEL_TIMELINE',
      'INTERNAL_SECRET_SENTINEL_ATTACHMENT',
      'INTERNAL_SECRET_SENTINEL_CREATED_BY',
      'INTERNAL_SECRET_SENTINEL_UPDATED_BY',
    ];
    mocks.selectQueue.push([{
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      grievanceNumber: 'GRV-1',
      title: 'External appeal',
      type: 'individual',
      status: 'filed',
      priority: 'medium',
      step: 'step_1',
      filedDate: new Date('2026-01-01T00:00:00.000Z'),
      responseDeadline: null,
      employerName: 'Employer',
      workplaceName: 'Site A',
      cbaArticle: '12',
      cbaSection: '4',
      summary: null,
      description: internalSentinels[0],
      background: internalSentinels[1],
      desiredOutcome: internalSentinels[2],
      grievantEmail: internalSentinels[3],
      unionRepId: internalSentinels[4],
      employerRepId: internalSentinels[5],
      timeline: [{ date: '2026-01-02', action: 'internal', actor: 'staff', notes: internalSentinels[6] }],
      attachments: [{ id: 'doc-1', name: internalSentinels[7], url: 'https://internal.example/doc', type: 'pdf', uploadedAt: '2026-01-03' }],
      createdBy: internalSentinels[8],
      lastUpdatedBy: internalSentinels[9],
    }]);

    const response = await GET(
      new Request('https://example.test/api/external/grievances/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?organizationId=99999999-9999-9999-9999-999999999999'),
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title: 'External appeal' });
    expect(body.data.summary).toBeNull();
    expect(body.data.description).toBeUndefined();
    expect(body.data.grievantEmail).toBeUndefined();
    const serialized = JSON.stringify(body);
    for (const sentinel of internalSentinels) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it('resolves the dynamic grievance id from the Next route context shape', async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');
    mocks.selectQueue.push([{
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      grievanceNumber: 'GRV-1',
      title: 'External appeal',
      type: 'individual',
      status: 'filed',
      priority: 'medium',
      step: 'step_1',
      filedDate: new Date('2026-01-01T00:00:00.000Z'),
      responseDeadline: null,
      employerName: 'Employer',
      workplaceName: 'Site A',
      cbaArticle: '12',
      cbaSection: '4',
      summary: null,
    }]);

    const response = await GET(
      new Request('https://example.test/api/external/grievances/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?organizationId=99999999-9999-9999-9999-999999999999'),
      { params: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } },
    );

    expect(response.status).toBe(200);
    expect(mocks.authorizeExternalMatterAccess).toHaveBeenCalledWith(mocks.db, expect.objectContaining({
      matterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    }), { recordAllowed: false });
  });

  it('resolves the dynamic grievance id from a promised params object', async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');
    mocks.selectQueue.push([{
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      grievanceNumber: 'GRV-1',
      title: 'External appeal',
      type: 'individual',
      status: 'filed',
      priority: 'medium',
      step: 'step_1',
      filedDate: new Date('2026-01-01T00:00:00.000Z'),
      responseDeadline: null,
      employerName: 'Employer',
      workplaceName: 'Site A',
      cbaArticle: '12',
      cbaSection: '4',
      summary: null,
    }]);

    const response = await GET(
      new Request('https://example.test/api/external/grievances/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?organizationId=99999999-9999-9999-9999-999999999999'),
      Promise.resolve({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    );

    expect(response.status).toBe(200);
    expect(mocks.authorizeExternalMatterAccess).toHaveBeenCalledWith(mocks.db, expect.objectContaining({
      matterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    }), { recordAllowed: false });
  });

  it('denies exact matter routes when a revoked or otherwise invalid authority is reported', async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');
    mocks.authorizeExternalMatterAccess.mockResolvedValueOnce({
      allowed: false,
      reason: 'authority_invalid',
      authorityId: '33333333-3333-3333-3333-333333333333',
    });

    const response = await GET(
      new Request('https://example.test/api/external/grievances/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?organizationId=99999999-9999-9999-9999-999999999999'),
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    );

    expect(response.status).toBe(403);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it('denies wrong-scope document requests before document rows are returned', async () => {
    const { GET } = await import('@/app/api/external/documents/[id]/route');
    mocks.authorizeExternalMatterAccess.mockResolvedValueOnce({
      allowed: false,
      reason: 'matter_grant_missing',
    });

    const response = await GET(
      new Request('https://example.test/api/external/documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?organizationId=99999999-9999-9999-9999-999999999999&matterId=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb&matterType=grievance'),
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    );

    expect(response.status).toBe(403);
    expect(mocks.authorizeExternalDocumentAccess).not.toHaveBeenCalled();
  });

  it('fails closed when the matter grant is valid but the document grant is missing', async () => {
    const { GET } = await import('@/app/api/external/documents/[id]/route');
    mocks.authorizeExternalDocumentAccess.mockResolvedValueOnce({
      allowed: false,
      reason: 'document_grant_missing',
      authorityId: '33333333-3333-3333-3333-333333333333',
      matterGrantId: '44444444-4444-4444-4444-444444444444',
    });

    const response = await GET(
      new Request('https://example.test/api/external/documents/00700000-0000-4000-8000-000000000052?organizationId=00700000-0000-4000-8000-000000000001&matterId=00700000-0000-4000-8000-000000000021&matterType=grievance'),
      { id: '00700000-0000-4000-8000-000000000052' },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it('denies external document downloads when the document grant lacks download permission', async () => {
    const { GET } = await import('@/app/api/external/documents/[id]/download/route');
    mocks.authorizeExternalDocumentAccess.mockResolvedValueOnce({
      allowed: false,
      reason: 'permission_missing',
      authorityId: '33333333-3333-3333-3333-333333333333',
      matterGrantId: '44444444-4444-4444-4444-444444444444',
      documentGrantId: '55555555-5555-5555-5555-555555555555',
    });

    const response = await GET(
      new Request('https://example.test/api/external/documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/download?organizationId=99999999-9999-9999-9999-999999999999&matterId=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb&matterType=grievance'),
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    );

    expect(response.status).toBe(403);
    expect(mocks.generateSasUrl).not.toHaveBeenCalled();
  });

  const uploadActor = '11111111-1111-1111-1111-111111111111';
  const uploadMatter = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const uploadOrg = '99999999-9999-9999-9999-999999999999';

  function seedMatterGrant(over: Record<string, unknown> = {}) {
    mocks.selectQueue.push([{
      id: '44444444-4444-4444-4444-444444444444',
      authorityId: '33333333-3333-3333-3333-333333333333',
      organizationId: uploadOrg,
      userId: uploadActor,
      representativeOrganizationId: '22222222-2222-2222-2222-222222222222',
      matterType: 'grievance',
      matterId: uploadMatter,
      status: 'active',
      revokedAt: null,
      expiresAt: null,
      canUploadDocuments: true,
      canViewDocuments: true,
      canDownloadDocuments: false,
      grantedBy: 'union-issuer',
      ...over,
    }]);
  }

  async function postUpload(body: Record<string, unknown>) {
    const { POST } = await import('@/app/api/external/grievances/[id]/documents/upload/route');
    return POST(
      new Request(`https://example.test/api/external/grievances/${uploadMatter}/documents/upload?organizationId=${uploadOrg}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      { params: { id: uploadMatter } },
    );
  }

  const INTAKE = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const intakeKey = `documents/${uploadOrg}/intake/${INTAKE}/0011223344556677`;
  const uploadBody = {
    intakeId: INTAKE,
    title: 'Specialist upload',
    documentType: 'evidence',
  };
  const openIntake = (over: Record<string, unknown> = {}) => mocks.checkIntake.mockResolvedValue({
    ok: true,
    replay: false,
    intake: {
      id: INTAKE, storageKey: intakeKey, contentHash: 'a'.repeat(64), mimeType: 'application/pdf', sizeBytes: 1234,
      originalFilename: 'specialist-upload.pdf', principalUserId: uploadActor, matterType: 'grievance', matterId: uploadMatter, ...over,
    },
  });
  const captureInserts = () => {
    const valuesByTable: unknown[] = [];
    mocks.db.insert.mockImplementation(vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        valuesByTable.push(values);
        const result: any = Promise.resolve(undefined);
        result.returning = vi.fn(async () => [{ id: valuesByTable.length === 2 ? 'version-1' : 'dddddddd-dddd-dddd-dddd-dddddddddddd', title: 'Specialist upload', name: 'Specialist upload' }]);
        return result;
      }),
    })));
    return valuesByTable;
  };

  it('creates the document from the intake the representative opened for this grievance, with the server\'s record of the file', async () => {
    const valuesByTable = captureInserts();
    seedMatterGrant();
    openIntake();
    mocks.bindIntake.mockResolvedValue(undefined);

    const response = await postUpload(uploadBody);

    expect(response.status).toBe(201);
    expect(mocks.checkIntake).toHaveBeenCalledWith(
      { organizationId: uploadOrg, userId: uploadActor, intakeId: INTAKE, operation: 'create_document', matter: { type: 'grievance', id: uploadMatter } },
      { name: 'intake-storage' },
    );
    // The write runs in the organization's own transaction, opened after the authorization decision's transaction closed.
    expect(mocks.withRLSContext).toHaveBeenCalledWith({ organizationId: uploadOrg }, expect.any(Function));
    expect(mocks.withExplicitUserContext).not.toHaveBeenCalled();
    expect(valuesByTable[0]).toMatchObject({
      organizationId: uploadOrg,
      orgId: uploadOrg,
      category: 'other',
      blobContainer: 'union-eyes',
      blobPath: intakeKey,
      contentType: 'application/pdf',
      sizeBytes: 1234,
      sha256: 'a'.repeat(64),
      filename: 'specialist-upload.pdf',
      uploadedBy: uploadActor,
      privacyLabel: 'case_restricted',
    });
    expect(valuesByTable[1]).toMatchObject({ storageKey: intakeKey, contentHash: 'a'.repeat(64), versionNo: 1 });
    expect(mocks.bindIntake).toHaveBeenCalledWith(mocks.db, {
      organizationId: uploadOrg, userId: uploadActor, intakeId: INTAKE, documentId: 'dddddddd-dddd-dddd-dddd-dddddddddddd', versionId: 'version-1',
    });
    expect(valuesByTable[3]).toMatchObject({
      grantedBy: 'union-issuer',
      canView: true,
      canDownload: false,
      canShare: false,
      userId: uploadActor,
      matterGrantId: '44444444-4444-4444-4444-444444444444',
    });
  });

  // DEF-0B8-FED-EXTERNAL-UPLOAD-ATTACHES-ANY-ORGANIZATION-BLOB-TO-GRIEVANCE
  it('no longer accepts a storage path or URL: an object the representative did not upload through an intake cannot be named', async () => {
    const response = await postUpload({ ...uploadBody, blobPath: `documents/${uploadOrg}/someone-elses-file.pdf` });
    expect(response.status).toBe(400);
    const withoutIntake = await postUpload({ title: 'x', documentType: 'evidence', fileUrl: 'https://storage.example/doc.pdf' });
    expect(withoutIntake.status).toBe(400);
    expect(mocks.checkIntake).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('answers another principal\'s intake (or one that does not exist) as not found, and inserts nothing', async () => {
    seedMatterGrant();
    mocks.checkIntake.mockResolvedValue({ ok: false, kind: 'not_found' });
    const response = await postUpload(uploadBody);
    expect(response.status).toBe(404);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('refuses an intake opened for a different matter, an expired one or one whose object changed, and inserts nothing', async () => {
    seedMatterGrant();
    for (const kind of ['operation_mismatch', 'expired', 'object_changed', 'not_open']) {
      mocks.checkIntake.mockResolvedValueOnce({ ok: false, kind });
      const response = await postUpload(uploadBody);
      expect(response.status, kind).toBe(409);
    }
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('refuses an intake that was already used', async () => {
    seedMatterGrant();
    mocks.checkIntake.mockResolvedValue({ ok: true, replay: true, intake: { id: INTAKE } });
    const response = await postUpload(uploadBody);
    expect(response.status).toBe(409);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('answers 409 when the intake is taken in the meantime (the document write is undone with it)', async () => {
    captureInserts();
    seedMatterGrant();
    openIntake();
    mocks.bindIntake.mockRejectedValue(new mocks.IntakeConflictError('taken'));
    const response = await postUpload(uploadBody);
    expect(response.status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalledWith(mocks.db, expect.objectContaining({ action: 'document.external_upload' }));
  });

  it('rejects a privilege label before any external upload insert', async () => {
    const response = await postUpload({ ...uploadBody, privacyLabel: 'privileged' });
    expect(response.status).toBe(400);
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it('refuses an external upload when the representative issued the matter grant', async () => {
    seedMatterGrant({ grantedBy: uploadActor });
    openIntake();
    const response = await postUpload(uploadBody);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: 'Forbidden' });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
});

describe('external resource middleware: a read and its record are one transaction (F06 A5)', () => {
  const GRIEVANCE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORGANIZATION = '99999999-9999-9999-9999-999999999999';
  const read = async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');
    return GET(new Request(`https://example.test/api/external/grievances/${GRIEVANCE}?organizationId=${ORGANIZATION}`), { id: GRIEVANCE });
  };
  const row = { id: GRIEVANCE, grievanceNumber: 'GRV-1', title: 'T', type: 'individual', status: 'filed', priority: 'medium', step: 'step_1', filedDate: new Date('2026-01-01T00:00:00.000Z') };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.audit.mockReset().mockResolvedValue(undefined);
    mocks.withRLSContext.mockImplementation(async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation(mocks.db));
    mocks.requireUser.mockResolvedValue({ userId: '11111111-1111-1111-1111-111111111111', organizationId: '22222222-2222-2222-2222-222222222222' });
    mocks.authorizeExternalMatterAccess.mockResolvedValue({ allowed: true, reason: 'allowed', authorityId: 'auth-1', matterGrantId: 'grant-1' });
  });

  it('records the read, with the decision it rested on, on the same transaction as the read', async () => {
    mocks.selectQueue.push([row]);

    const response = await read();

    expect(response.status).toBe(200);
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    expect(mocks.audit).toHaveBeenCalledWith(
      mocks.db,
      expect.objectContaining({
        organizationId: ORGANIZATION,
        userId: '11111111-1111-1111-1111-111111111111',
        action: 'external.resource.read',
        resourceId: expect.any(String),
        details: expect.objectContaining({ reason: 'allowed', authorityId: 'auth-1', matterGrantId: 'grant-1', method: 'GET', status: 200, routeResourceId: GRIEVANCE }),
      }),
    );
  });

  it('does not write a separate allowed-decision row for a read: the decision is folded into the read record', async () => {
    mocks.selectQueue.push([row]);
    await read();
    expect(mocks.authorizeExternalMatterAccess).toHaveBeenCalledWith(mocks.db, expect.anything(), { recordAllowed: false });
  });

  it('releases nothing when the read cannot be recorded', async () => {
    mocks.selectQueue.push([row]);
    mocks.audit.mockRejectedValueOnce(new Error('audit down'));

    const response = await read();

    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain('GRV-1');
  });

  it('records no read when the grant is refused, and still lets the decision service record the refusal', async () => {
    mocks.authorizeExternalMatterAccess.mockResolvedValue({ allowed: false, reason: 'no_matter_grant', authorityId: 'auth-1' });

    const response = await read();

    expect(response.status).toBe(403);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('records no read for a response that is not a successful read', async () => {
    mocks.selectQueue.push([]);

    const response = await read();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('answers a malformed organization or matter identifier as a bad request, before any database work', async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');

    const badOrganization = await GET(new Request('https://example.test/api/external/grievances/x?organizationId=not-a-uuid'), { id: GRIEVANCE });
    const badMatter = await GET(new Request(`https://example.test/api/external/grievances/x?organizationId=${ORGANIZATION}`), { id: 'not-a-uuid' });

    expect(badOrganization.status).toBe(400);
    expect(badMatter.status).toBe(400);
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
    expect(mocks.authorizeExternalMatterAccess).not.toHaveBeenCalled();
  });

  it('refuses a request that names no organization as forbidden, like any request without a grant, before any database work', async () => {
    const { GET } = await import('@/app/api/external/grievances/[id]/route');

    const response = await GET(new Request('https://example.test/api/external/grievances/x'), { id: GRIEVANCE });

    expect(response.status).toBe(403);
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
    expect(mocks.authorizeExternalMatterAccess).not.toHaveBeenCalled();
  });

  it('answers a matter type outside the enumeration as a bad request', async () => {
    const { GET } = await import('@/app/api/external/documents/[id]/route');

    const response = await GET(
      new Request(`https://example.test/api/external/documents/${GRIEVANCE}?organizationId=${ORGANIZATION}&matterId=${GRIEVANCE}&matterType=not-a-matter-type`),
      { id: GRIEVANCE },
    );

    expect(response.status).toBe(400);
    expect(mocks.withRLSContext).not.toHaveBeenCalled();
  });
});

// DEF-0B8-FED-EXTERNAL-UPLOAD-ATTACHES-ANY-ORGANIZATION-BLOB-TO-GRIEVANCE
describe('external grievance intake', () => {
  const GRIEVANCE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ORGANIZATION = '99999999-9999-9999-9999-999999999999';
  const ACTOR = '11111111-1111-1111-1111-111111111111';
  const postFile = async (file?: File) => {
    const { POST } = await import('@/app/api/external/grievances/[id]/documents/intakes/route');
    const form = new FormData();
    if (file) form.set('file', file);
    return POST(
      new Request(`https://example.test/api/external/grievances/${GRIEVANCE}/documents/intakes?organizationId=${ORGANIZATION}`, { method: 'POST', body: form }),
      { params: { id: GRIEVANCE } },
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withRLSContext.mockImplementation(async (_c: unknown, op: (tx: unknown) => Promise<unknown>) => op(mocks.db));
    mocks.withPrincipalOnlyContext.mockImplementation(async (op: (tx: unknown) => Promise<unknown>) => op('principal-tx'));
    mocks.holdsExternalAuthority.mockResolvedValue(true);
    mocks.requireUser.mockResolvedValue({ userId: ACTOR, organizationId: '22222222-2222-2222-2222-222222222222' });
    mocks.authorizeExternalMatterAccess.mockResolvedValue({ allowed: true, reason: 'allowed', authorityId: 'auth-1', matterGrantId: 'grant-1' });
    mocks.openIntake.mockResolvedValue({ ok: true, intake: { intakeId: 'intake-1', checksum: 'a'.repeat(64) } });
  });

  it('opens an intake bound to the representative, the organization and this grievance', async () => {
    const response = await postFile(new File(['%PDF-1.7\n'], 'a.pdf', { type: 'application/pdf' }));
    expect(response.status).toBe(201);
    expect(mocks.authorizeExternalMatterAccess).toHaveBeenCalledWith(mocks.db, expect.objectContaining({ requiredPermission: 'upload_documents' }), expect.anything());
    expect(mocks.openIntake).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORGANIZATION, userId: ACTOR, operation: 'create_document', matter: { type: 'grievance', id: GRIEVANCE } }),
      { name: 'intake-storage' },
    );
    expect(JSON.stringify(await response.json())).not.toContain('documents/');
  });

  it('opens nothing without upload permission on the matter', async () => {
    mocks.authorizeExternalMatterAccess.mockResolvedValue({ allowed: false, reason: 'permission_missing', authorityId: 'auth-1', matterGrantId: 'grant-1' });
    const response = await postFile(new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' }));
    expect(response.status).toBe(403);
    expect(mocks.openIntake).not.toHaveBeenCalled();
  });

  it('refuses a missing file and a file type that is not allowed', async () => {
    expect((await postFile()).status).toBe(400);
    expect((await postFile(new File([new Uint8Array([1])], 'a.exe', { type: 'application/x-msdownload' }))).status).toBe(400);
    expect(mocks.openIntake).not.toHaveBeenCalled();
  });
});
