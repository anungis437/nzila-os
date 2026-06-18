import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  findDocument: vi.fn(),
  findCaseDocument: vi.fn(),
  updateSet: vi.fn(),
  logApiAuditEvent: vi.fn(),
  getDocumentMutabilityBlockReason: vi.fn(),
  updatedQueue: [] as unknown[][],
}));

vi.mock('@/lib/api/with-api', () => ({
  withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
}));

vi.mock('@/lib/api/errors', () => {
  const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });
  return {
    ApiError: {
      badRequest: (message: string) => makeError(400, message),
      notFound: (_entity: string, id: string) => makeError(404, `Not found: ${id}`),
      forbidden: (message: string) => makeError(403, message),
      conflict: (message: string) => makeError(409, message),
      notImplemented: (message: string) => makeError(501, message),
    },
  };
});

vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/services/document-retention-guard', () => ({
  getDocumentMutabilityBlockReason: m.getDocumentMutabilityBlockReason,
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      documents: { findFirst: m.findDocument },
      caseDocuments: { findFirst: m.findCaseDocument },
    },
    update: vi.fn(() => ({
      set: vi.fn((value: unknown) => {
        m.updateSet(value);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => (m.updatedQueue.shift() ?? []) as unknown[]),
          })),
        };
      }),
    })),
  },
}));

async function loadRoute() {
  return import('../documents/[id]/route');
}

describe('documents/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.updatedQueue = [];
    m.getDocumentMutabilityBlockReason.mockReturnValue(null);
    process.env.LEGACY_DOCUMENT_API_ENABLED = 'true';
  });

  it('GET returns document and logs audit event', async () => {
    vi.resetModules();
    const { GET } = await loadRoute();
    m.findDocument.mockResolvedValueOnce({
      id: 'doc_1',
      name: 'memo.pdf',
      organizationId: 'org_1',
      deletedAt: null,
      isConfidential: false,
      accessLevel: 'member',
    });

    const result = await GET({
      request: new NextRequest('http://localhost/api/documents/doc_1'),
      organizationId: 'org_1',
      userId: 'user_1',
      user: { role: 'member' },
    } as any);

    expect(result.data).toMatchObject({ id: 'doc_1', name: 'memo.pdf' });
    expect(m.logApiAuditEvent).toHaveBeenCalled();
  });

  it('GET denies access to restricted document for low-role users', async () => {
    vi.resetModules();
    const { GET } = await loadRoute();
    m.findDocument.mockResolvedValueOnce({
      id: 'doc_2',
      organizationId: 'org_1',
      deletedAt: null,
      isConfidential: true,
      accessLevel: 'restricted',
      name: 'secret.pdf',
    });

    await expect(
      GET({
        request: new NextRequest('http://localhost/api/documents/doc_2'),
        organizationId: 'org_1',
        userId: 'user_1',
        user: { role: 'member' },
      } as any),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('PATCH rejects immutable documents', async () => {
    vi.resetModules();
    const { PATCH } = await loadRoute();
    m.findDocument.mockResolvedValueOnce({ id: 'doc_3', organizationId: 'org_1', deletedAt: null, metadata: {} });
    m.getDocumentMutabilityBlockReason.mockReturnValueOnce('linked evidence');

    await expect(
      PATCH({
        request: new NextRequest('http://localhost/api/documents/doc_3', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'updated' }),
        }),
        organizationId: 'org_1',
      } as any),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('PATCH updates mutable documents and strips protected fields', async () => {
    vi.resetModules();
    const { PATCH } = await loadRoute();
    m.findDocument.mockResolvedValueOnce({ id: 'doc_4', organizationId: 'org_1', deletedAt: null, metadata: {} });
    m.updatedQueue.push([{ id: 'doc_4', name: 'new-name.pdf' }]);

    const result = await PATCH({
      request: new NextRequest('http://localhost/api/documents/doc_4', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'ignore', organizationId: 'ignore', name: 'new-name.pdf' }),
      }),
      organizationId: 'org_1',
    } as any);

    expect(result.data).toMatchObject({ id: 'doc_4', name: 'new-name.pdf' });
    const payload = m.updateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.id).toBeUndefined();
    expect(payload.organizationId).toBeUndefined();
  });

  it('DELETE blocks immutable evidence-linked documents', async () => {
    vi.resetModules();
    const { DELETE } = await loadRoute();
    m.findDocument.mockResolvedValueOnce({ id: 'doc_5', organizationId: 'org_1', deletedAt: null, metadata: {} });
    m.findCaseDocument.mockResolvedValueOnce({ id: 'cd_1', isImmutable: true });

    await expect(
      DELETE({
        request: new NextRequest('http://localhost/api/documents/doc_5', { method: 'DELETE' }),
        organizationId: 'org_1',
      } as any),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('DELETE soft-deletes mutable documents', async () => {
    vi.resetModules();
    const { DELETE } = await loadRoute();
    m.findDocument.mockResolvedValueOnce({ id: 'doc_6', organizationId: 'org_1', deletedAt: null, metadata: {} });
    m.findCaseDocument.mockResolvedValueOnce(null);

    const result = await DELETE({
      request: new NextRequest('http://localhost/api/documents/doc_6', { method: 'DELETE' }),
      organizationId: 'org_1',
    } as any);

    expect(result).toMatchObject({ success: true });
  });
});
