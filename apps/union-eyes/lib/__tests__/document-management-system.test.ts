import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockPutBlob: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockResolvedValue([]),
      }),
    }),
    insert: mocks.mockInsert.mockReturnValue({
      values: mocks.mockValues.mockReturnValue({
        returning: mocks.mockReturning.mockResolvedValue([{ id: 'doc-1' }]),
      }),
    }),
    update: mocks.mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  grievanceDocuments: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
  desc: vi.fn((a: unknown) => a),
  isNull: vi.fn((a: unknown) => a),
  or: vi.fn((...a: unknown[]) => a),
  sql: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/blob-client', () => ({
  putBlob: mocks.mockPutBlob.mockResolvedValue({
    url: 'https://blob.test/file.pdf',
    pathname: 'file.pdf',
    sha256: 'abc',
    sizeBytes: 1024,
  }),
}));

vi.mock('@/lib/services/signature-providers', () => ({
  DocuSignProvider: class {
    sendForSignature = vi.fn();
    getSignatureStatus = vi.fn();
  },
}));

vi.mock('@/lib/services/ocr-service', () => ({
  processImageOCR: vi.fn().mockResolvedValue('ocr text'),
  processPDFOCR: vi.fn().mockResolvedValue('pdf text'),
}));

describe('document-management-system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploadDocument uploads file and creates record', async () => {
    const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' });
    const { uploadDocument } = await import('../document-management-system');
    const result = await uploadDocument('claim1', 'org1', file, 'evidence', 'user1');

    expect(result.success).toBe(true);
    expect(result.documentId).toBe('doc-1');
    expect(mocks.mockPutBlob).toHaveBeenCalled();
    expect(mocks.mockInsert).toHaveBeenCalled();
  });

  it('uploadDocument returns error on failure', async () => {
    mocks.mockPutBlob.mockRejectedValue(new Error('Blob error'));
    const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' });

    const { uploadDocument } = await import('../document-management-system');
    const result = await uploadDocument('claim1', 'org1', file, 'evidence', 'user1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Blob error');
  });

  it('exports type definitions', async () => {
    const mod = await import('../document-management-system');
    expect(typeof mod.uploadDocument).toBe('function');
  });
});
