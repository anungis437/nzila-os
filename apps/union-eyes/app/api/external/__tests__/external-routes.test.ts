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
    authorizeExternalMatterAccess: vi.fn(),
    authorizeExternalDocumentAccess: vi.fn(),
    generateSasUrl: vi.fn(),
    resolveStoredBlob: vi.fn(),
  };
});

vi.mock('@/db/db', () => ({ db: mocks.db }));
vi.mock('@/lib/api-auth-guard', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mocks.withRLSContext,
  withExplicitUserContext: mocks.withExplicitUserContext,
}));
vi.mock('@/lib/services/external-resource-authorization-service', () => ({
  authorizeExternalMatterAccess: mocks.authorizeExternalMatterAccess,
  authorizeExternalDocumentAccess: mocks.authorizeExternalDocumentAccess,
}));
vi.mock('@/lib/blob-client', () => ({ generateSasUrl: mocks.generateSasUrl }));
vi.mock('@/lib/services/document-blob-integrity-service', () => ({ resolveStoredBlob: mocks.resolveStoredBlob }));

describe('external resource routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
    mocks.withRLSContext.mockImplementation(async (_context: unknown, operation: () => Promise<unknown>) => operation());
    mocks.withExplicitUserContext.mockImplementation(async (_userId: string, operation: () => Promise<unknown>) => operation());
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
    expect(mocks.authorizeExternalMatterAccess).toHaveBeenCalledWith(expect.objectContaining({
      matterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    }));
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
    expect(mocks.authorizeExternalMatterAccess).toHaveBeenCalledWith(expect.objectContaining({
      matterId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    }));
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

  it('populates the live document org id compatibility column for external uploads', async () => {
    const insertedDocument = {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      title: 'Specialist upload',
      name: 'Specialist upload',
    };
    const valuesByTable: unknown[] = [];
    const tx = {
      insert: vi.fn(() => ({
        values: vi.fn((values: unknown) => {
          valuesByTable.push(values);
          return { returning: vi.fn(async () => [insertedDocument]) };
        }),
      })),
    };
    mocks.db.insert.mockImplementation(tx.insert);

    const { POST } = await import('@/app/api/external/grievances/[id]/documents/upload/route');
    const response = await POST(
      new Request('https://example.test/api/external/grievances/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/documents/upload?organizationId=99999999-9999-9999-9999-999999999999', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Specialist upload',
          filename: 'specialist-upload.pdf',
          blobPath: 'documents/99999999-9999-9999-9999-999999999999/external-upload.pdf',
          documentType: 'evidence',
          mimeType: 'application/pdf',
          fileSize: 1234,
        }),
      }),
      { params: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } },
    );

    expect(response.status).toBe(201);
    expect(mocks.withExplicitUserContext).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      expect.any(Function),
      '99999999-9999-9999-9999-999999999999',
    );
    expect(valuesByTable[0]).toMatchObject({
      organizationId: '99999999-9999-9999-9999-999999999999',
      orgId: '99999999-9999-9999-9999-999999999999',
      category: 'other',
      blobContainer: 'union-eyes',
      blobPath: 'documents/99999999-9999-9999-9999-999999999999/external-upload.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1234,
      sha256: '0'.repeat(64),
      uploadedBy: '11111111-1111-1111-1111-111111111111',
    });
  });
});
