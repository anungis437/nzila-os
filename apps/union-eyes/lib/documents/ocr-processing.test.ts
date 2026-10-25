import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  downloadBuffer: vi.fn(),
  processImageOCR: vi.fn(),
  processPDFOCR: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: { documents: { findFirst: mocks.findFirst } },
    update: mocks.update,
  },
}));

vi.mock('@/lib/blob-client', () => ({
  downloadBuffer: mocks.downloadBuffer,
}));

vi.mock('@/lib/services/ocr-service', () => ({
  processImageOCR: mocks.processImageOCR,
  processPDFOCR: mocks.processPDFOCR,
}));

import { processDocumentOCR } from '@/lib/services/document-service';

const document = {
  id: 'd1',
  organizationId: 'org-1',
  deletedAt: null,
  mimeType: 'image/png',
  fileType: 'png',
  fileUrl: 'https://stored.example/secret.png',
  metadata: { blobKey: 'documents/org-1/secret.png' },
};

describe('processDocumentOCR persistence boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(document);
    mocks.downloadBuffer.mockResolvedValue(Buffer.from('bytes'));
    mocks.processImageOCR.mockResolvedValue({ text: 'untrusted draft', confidence: 80 });
    mocks.update.mockReturnValue({ set: () => ({ where: async () => [] }) });
  });

  it('returns extracted text without writing it onto the document', async () => {
    const result = await processDocumentOCR('d1', 'org-1');
    expect(result.text).toBe('untrusted draft');
    expect(result.metadata).not.toHaveProperty('blobPath');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not report success for an unsupported file', async () => {
    mocks.findFirst.mockResolvedValue({ ...document, mimeType: 'application/zip', fileType: 'zip' });
    await expect(processDocumentOCR('d1', 'org-1')).rejects.toThrow('OCR_UNSUPPORTED');
    expect(mocks.processImageOCR).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('keeps the published fallback when the processor throws a non-error', async () => {
    mocks.processImageOCR.mockImplementationOnce(() => {
      throw 'bad-ocr';
    });
    await expect(processDocumentOCR('d1', 'org-1')).rejects.toThrow('Failed to process document OCR');
  });
});
