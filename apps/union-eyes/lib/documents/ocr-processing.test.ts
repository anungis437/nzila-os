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

  it('reads the bytes and the organization prefix before choosing a processor', async () => {
    mocks.downloadBuffer.mockResolvedValueOnce(Buffer.from('%PDF-1.4\ntext'));
    mocks.processPDFOCR.mockResolvedValueOnce({ fullText: 'pdf text', pages: [{ confidence: 90 }] });
    mocks.findFirst.mockResolvedValueOnce({ ...document, mimeType: 'image/png', fileType: 'png' });
    const pdf = await processDocumentOCR('d1', 'org-1');
    expect(pdf.text).toBe('pdf text');
    expect(mocks.processPDFOCR).toHaveBeenCalledOnce();
    expect(mocks.processImageOCR).not.toHaveBeenCalled();

    mocks.downloadBuffer.mockResolvedValueOnce(Buffer.from('PK\u0003\u0004zip'));
    mocks.findFirst.mockResolvedValueOnce({ ...document, mimeType: 'image/png', fileType: 'png' });
    await expect(processDocumentOCR('d1', 'org-1')).rejects.toThrow('OCR_UNSUPPORTED');

    mocks.downloadBuffer.mockResolvedValueOnce(Buffer.from('plain words'));
    mocks.findFirst.mockResolvedValueOnce({ ...document, mimeType: 'application/pdf', fileType: 'pdf' });
    const text = await processDocumentOCR('d1', 'org-1');
    expect(text.text).toBe('plain words');
    expect(text.metadata.truncated).toBe(false);
    expect(mocks.processPDFOCR).toHaveBeenCalledOnce();

    mocks.findFirst.mockResolvedValueOnce({
      ...document,
      metadata: { blobKey: 'documents/org-2/secret.png' },
    });
    await expect(processDocumentOCR('d1', 'org-1')).rejects.toThrow('Document blob path missing');
    await expect(processDocumentOCR('d1')).rejects.toThrow('Document blob path missing');
    expect(mocks.downloadBuffer).toHaveBeenCalledTimes(3);
  });
});
