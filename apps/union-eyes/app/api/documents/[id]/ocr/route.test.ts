import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  document: null as unknown,
  grant: null as unknown,
  selects: 0,
  process: vi.fn(),
  audit: vi.fn(async () => true),
  caseAccess: { isPrimaryOwner: false, canViewCase: false, canViewPrivateDocuments: false },
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (request: Request, context: unknown) => unknown) => handler,
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: vi.fn(async () => undefined),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: () => {
      const which = ++state.selects;
      const builder = {
        from: () => builder,
        leftJoin: () => builder,
        where: () => builder,
        limit: () => {
          const row = which === 1 ? state.document : state.grant;
          return Promise.resolve(row ? [row] : []);
        },
      };
      return builder;
    },
  },
}));

vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: async () => state.caseAccess,
}));

vi.mock('@/lib/services/document-service', () => ({
  processDocumentOCR: (...args: unknown[]) => state.process(...args),
}));

vi.mock('@/lib/audit/mandatory-audit', () => ({
  appendMandatoryAudit: (...args: unknown[]) => state.audit(...args),
}));

const { POST } = await import('./route');

const DOC = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';

function call(id = DOC, body?: unknown) {
  state.selects = 0;
  return POST(
    new Request(`https://example.test/api/documents/${id}/ocr`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
    { userId: 'steward-1', organizationId: ORG, params: { id } },
  );
}

describe('POST /api/documents/[id]/ocr', () => {
  beforeEach(() => {
    state.document = null;
    state.grant = null;
    state.selects = 0;
    state.caseAccess = { isPrimaryOwner: false, canViewCase: false, canViewPrivateDocuments: false };
    state.process.mockReset();
    state.process.mockResolvedValue({
      documentId: DOC,
      text: 'untrusted draft',
      confidence: 11,
      language: 'en',
      metadata: { blobPath: 'documents/secret/raw.pdf', provider: 'image-ocr' },
    });
    state.audit.mockReset();
    state.audit.mockResolvedValue(true);
  });

  it('rejects a forged id and a privileged document before processing', async () => {
    const forged = await call('doc-1');
    expect(forged.status).toBe(400);
    expect(state.process).not.toHaveBeenCalled();

    state.document = { id: DOC, privacyLabel: 'privileged', linkedEntityType: null, linkedEntityId: null };
    const privileged = await call();
    expect(privileged.status).toBe(403);
    expect(state.process).not.toHaveBeenCalled();
  });

  it('returns unpersisted text and strips storage metadata', async () => {
    state.document = { id: DOC, privacyLabel: 'team_confidential', linkedEntityType: null, linkedEntityId: null };
    const response = await call(DOC, { organizationId: 'foreign-org', text: 'injected transcript' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      documentId: DOC,
      text: 'untrusted draft',
      authoritative: false,
      persisted: false,
      reviewRequired: true,
    });
    expect(JSON.stringify(body)).not.toContain('documents/secret/raw.pdf');
    expect(JSON.stringify(body)).not.toContain('injected transcript');
    expect(state.process).toHaveBeenCalledWith(DOC, ORG, { persistExtractedText: false });
    expect(state.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'document.ocr.extract',
      organizationId: ORG,
      resourceId: DOC,
    }));
    const details = state.audit.mock.calls[0][1].details;
    expect(JSON.stringify(details)).not.toContain('untrusted draft');
  });

  it('hides processor, storage, and audit failures without returning text', async () => {
    state.document = { id: DOC, privacyLabel: 'team_confidential', linkedEntityType: null, linkedEntityId: null };
    state.process.mockRejectedValueOnce(new Error('OCR_UNSUPPORTED'));
    expect((await call()).status).toBe(501);

    state.process.mockRejectedValueOnce(new Error('Failed to process document OCR'));
    const provider = await call();
    expect(provider.status).toBe(502);
    expect(JSON.stringify(await provider.json())).not.toContain('untrusted draft');

    state.process.mockRejectedValueOnce(new Error('Document blob path missing'));
    expect((await call()).status).toBe(502);

    state.audit.mockRejectedValueOnce(new Error('audit down'));
    const audit = await call();
    expect(audit.status).toBe(503);
    expect(JSON.stringify(await audit.json())).not.toContain('untrusted draft');
  });
});
