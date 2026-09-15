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
    },
    requireUser: vi.fn(),
    authorizeExternalMatterAccess: vi.fn(),
    authorizeExternalDocumentAccess: vi.fn(),
    generateSasUrl: vi.fn(),
  };
});

vi.mock('@/db/db', () => ({ db: mocks.db }));
vi.mock('@/lib/api-auth-guard', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/services/external-resource-authorization-service', () => ({
  authorizeExternalMatterAccess: mocks.authorizeExternalMatterAccess,
  authorizeExternalDocumentAccess: mocks.authorizeExternalDocumentAccess,
}));
vi.mock('@/lib/blob-client', () => ({ generateSasUrl: mocks.generateSasUrl }));

describe('external resource routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue.length = 0;
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
  });

  it('returns an external-safe grievance detail projection for an exact grant', async () => {
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
      description: 'Internal narrative must not leak',
      grievantEmail: 'private@example.test',
    }]);

    const response = await GET(
      new Request('https://example.test/api/external/grievances/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?organizationId=99999999-9999-9999-9999-999999999999'),
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', title: 'External appeal' });
    expect(body.data.description).toBeUndefined();
    expect(body.data.grievantEmail).toBeUndefined();
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
});

