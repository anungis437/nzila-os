import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  actor: vi.fn(),
  withRLSContext: vi.fn(),
  putBlob: vi.fn(),
  deleteBlob: vi.fn(),
  persistAtomicAudit: vi.fn(),
  isMalwareScanError: vi.fn(),
  executeQueue: [] as unknown[][],
  findReadableCase: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({
  withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
}));
vi.mock('@/lib/api/errors', () => {
  const makeError = (status: number, message: string, details?: unknown) => Object.assign(new Error(message), { status, details });
  return {
    ApiError: {
      badRequest: (message: string, details?: unknown) => makeError(400, message, details),
      notFound: (_entity: string, id?: string) => makeError(404, id ? `Not found: ${id}` : 'Not found'),
      unauthorized: () => makeError(401, 'Unauthorized'),
      forbidden: () => makeError(403, 'Forbidden'),
      externalService: (_svc: string, message: string) => makeError(503, message),
    },
  };
});
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/blob-client', () => ({ putBlob: m.putBlob, deleteBlob: m.deleteBlob }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/security/clamav', () => ({ isMalwareScanError: m.isMalwareScanError }));

vi.mock('@/lib/cases/case-authorization', async original => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  getCaseActor: m.actor, caseReadScope: vi.fn(() => undefined), findReadableCase: m.findReadableCase,
}));
vi.mock('@/lib/audit-logger', () => ({auditLog:vi.fn().mockResolvedValue(undefined),AuditEventType:{AUTH_FAILED:'AUTH_FAILED'},AuditSeverity:{HIGH:'HIGH'}}));

async function loadRoute() {
  return import('../cases/[caseId]/evidence/route');
}

describe('cases/[caseId]/evidence route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.actor.mockResolvedValue({userId:'user_1',organizationId:'org_1',role:'admin'});
    m.executeQueue = [];
    m.findReadableCase.mockResolvedValue({ claimId: 'claim_1', visibility: 'internal' });
    m.putBlob.mockResolvedValue({
      url: 'https://blob/evidence.pdf',
      pathname: 'cases/claim_1/evidence.pdf',
      malwareScan: { status: 'clean', scannedAt: new Date().toISOString(), engine: 'clamav' },
    });
    m.deleteBlob.mockResolvedValue(undefined);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.isMalwareScanError.mockReturnValue(false);

    m.withRLSContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
      };
      return fn(tx);
    });
  });

  it('GET lists normalized attachments for a case', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([
      { claimId: 'claim_1', claimNumber: 'CLM-1', attachments: [{ url: 'https://x', fileName: 'a.pdf' }] },
    ]);

    const result = await GET({ params: { caseId: 'CLM-1' }, organizationId: 'org_1', userId: 'user_1' } as any);
    expect(result).toHaveLength(1);
  });

  it('POST rejects request without file', async () => {
    const { POST } = await loadRoute();
    m.executeQueue.push([{ claimId: 'claim_1', claimNumber: 'CLM-1', attachments: [] }]);
    const form = new FormData();

    await expect(
      POST({
        params: { caseId: 'CLM-1' },
        organizationId: 'org_1',
        userId: 'user_1',
        request: new NextRequest('http://localhost/api/cases/CLM-1/evidence', { method: 'POST', body: form }),
      } as any),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('POST uploads file and appends attachment metadata', async () => {
    const { POST } = await loadRoute();
    m.executeQueue.push(
      [{ claimId: 'claim_1', claimNumber: 'CLM-1', attachments: [] }],
      [],
    );

    const form = new FormData();
    form.append('file', new File(['hello'], 'evidence.txt', { type: 'text/plain' }));

    const result = await POST({
      params: { caseId: 'CLM-1' },
      organizationId: 'org_1',
      userId: 'user_1',
      request: new NextRequest('http://localhost/api/cases/CLM-1/evidence', { method: 'POST', body: form }),
    } as any);

    expect(result.attachment.fileName).toBe('evidence.txt');
    expect(m.putBlob).toHaveBeenCalled();
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'case.attachment_uploaded', organizationId: 'org_1', userId: 'user_1' }));
  });

  it('DELETE removes matching attachment and returns deleted true', async () => {
    const { DELETE } = await loadRoute();
    m.executeQueue.push(
      [{
        claimId: 'claim_1',
        claimNumber: 'CLM-1',
        attachments: [{ url: 'https://blob/evidence.pdf', pathname: 'cases/claim_1/evidence.pdf', fileName: 'evidence.pdf' }],
      }],
      [],
    );

    const result = await DELETE({
      params: { caseId: 'CLM-1' },
      organizationId: 'org_1',
      userId: 'user_1',
      request: new NextRequest('http://localhost/api/cases/CLM-1/evidence?fileUrl=https://blob/evidence.pdf', { method: 'DELETE' }),
    } as any);

    expect(result).toMatchObject({ deleted: true });
    expect(m.deleteBlob).toHaveBeenCalled();
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'case.attachment_deleted' }));
  });

  it('DELETE keeps the stored object when the audit record cannot be written', async () => {
    const { DELETE } = await loadRoute();
    m.executeQueue.push(
      [{ claimId: 'claim_1', claimNumber: 'CLM-1', attachments: [{ url: 'https://blob/evidence.pdf', pathname: 'cases/claim_1/evidence.pdf', fileName: 'evidence.pdf' }] }],
      [],
    );
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit write failed'));
    await expect(DELETE({
      params: { caseId: 'CLM-1' },
      organizationId: 'org_1',
      userId: 'user_1',
      request: new NextRequest('http://localhost/api/cases/CLM-1/evidence?fileUrl=https://blob/evidence.pdf', { method: 'DELETE' }),
    } as any)).rejects.toThrow('audit write failed');
    expect(m.deleteBlob).not.toHaveBeenCalled();
  });

  it('DELETE blocks evidence removal when the case is under legal hold', async () => {
    const { DELETE } = await loadRoute();
    m.executeQueue.push([{
      claimId: 'claim_1',
      claimNumber: 'CLM-1',
      metadata: { legalHold: { active: true, matterId: 'liuna-sensitive-matter' } },
      attachments: [{ url: 'https://blob/evidence.pdf', pathname: 'cases/claim_1/evidence.pdf', fileName: 'evidence.pdf' }],
    }]);

    await expect(
      DELETE({
        params: { caseId: 'CLM-1' },
        organizationId: 'org_1',
        userId: 'user_1',
        request: new NextRequest('http://localhost/api/cases/CLM-1/evidence?fileUrl=https://blob/evidence.pdf', { method: 'DELETE' }),
      } as any),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Document is under legal hold',
    });

    expect(m.deleteBlob).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('DELETE blocks evidence removal when the attachment is retained', async () => {
    const { DELETE } = await loadRoute();
    m.executeQueue.push([{
      claimId: 'claim_1',
      claimNumber: 'CLM-1',
      attachments: [{
        url: 'https://blob/evidence.pdf',
        pathname: 'cases/claim_1/evidence.pdf',
        fileName: 'evidence.pdf',
        metadata: { retention: { until: '2099-01-01T00:00:00.000Z' } },
      }],
    }]);

    await expect(
      DELETE({
        params: { caseId: 'CLM-1' },
        organizationId: 'org_1',
        userId: 'user_1',
        request: new NextRequest('http://localhost/api/cases/CLM-1/evidence?fileUrl=https://blob/evidence.pdf', { method: 'DELETE' }),
      } as any),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Document is retained until 2099-01-01T00:00:00.000Z',
    });

    expect(m.deleteBlob).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
  it('denies a member evidence deletion on the kernel decision before touching storage or case data', async () => {
    const { DELETE } = await loadRoute();
    const { ApiError } = await import('@/lib/api/errors');
    m.findReadableCase.mockRejectedValueOnce(ApiError.forbidden());
    await expect(DELETE({params:{caseId:'claim_1'},organizationId:'org_1',userId:'user_1',request:new NextRequest('http://localhost/api/cases/claim_1/evidence?fileUrl=https://x')} as any)).rejects.toMatchObject({status:403});
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'user_1' }), 'claim_1', false, 'case:modify_document');
    expect(m.deleteBlob).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.executeQueue).toEqual([]);
  });

  it('answers 404 when the caller cannot read the case at all', async () => {
    const { GET } = await loadRoute();
    m.findReadableCase.mockResolvedValueOnce(null);
    await expect(GET({ params: { caseId: 'CLM-1' }, organizationId: 'org_1', userId: 'user_1' } as any)).rejects.toMatchObject({ status: 404 });
    expect(m.findReadableCase).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'CLM-1', false, 'case:read_internal');
  });

});
