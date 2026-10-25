import { describe, expect, it } from 'vitest';
import {
  assessUpload,
  interpretOcr,
  isDiscardableBlobPath,
  readCanonicalIntake,
  readCreatedDocument,
  repositoryIntakePayload,
  transcriptSaveUnavailable,
} from './ocr-intake';

const DOC = '11111111-1111-4111-8111-111111111111';

describe('ocr intake contract', () => {
  it('rejects empty, oversized, and unsupported files before upload', () => {
    expect(assessUpload({ name: '', size: 10, type: 'application/pdf' }).ok).toBe(false);
    expect(assessUpload({ name: 'a.pdf', size: 0, type: 'application/pdf' })).toEqual({ ok: false, reason: 'empty' });
    expect(assessUpload({ name: 'a.pdf', size: 50 * 1024 * 1024 + 1, type: 'application/pdf' })).toEqual({
      ok: false,
      reason: 'oversize',
    });
    expect(assessUpload({ name: 'a.exe', size: 4, type: 'application/x-msdownload' })).toEqual({
      ok: false,
      reason: 'unsupported',
    });
    expect(assessUpload({ name: 'a.pdf', size: 4, type: 'application/pdf' })).toEqual({ ok: true });
  });

  it('discards only an organization-prefixed blob path', () => {
    expect(isDiscardableBlobPath('documents/org-1/file.pdf', 'org-1')).toBe(true);
    expect(isDiscardableBlobPath('documents/org-2/file.pdf', 'org-1')).toBe(false);
    expect(isDiscardableBlobPath('documents/org-1/../org-2/file.pdf', 'org-1')).toBe(false);
    expect(isDiscardableBlobPath('https://storage.example/documents/org-1/file.pdf', 'org-1')).toBe(false);
    expect(isDiscardableBlobPath('/documents/org-1/file.pdf', 'org-1')).toBe(false);
    expect(isDiscardableBlobPath('documents/org-1/', 'org-1')).toBe(false);
  });

  it('separates blob intake, the canonical row, and untrusted OCR text', () => {
    const intake = {
      blobPath: 'documents/org-1/file.pdf',
      checksum: 'abc',
      size: 4,
      mimeType: 'application/pdf',
      filename: 'file.pdf',
    };
    expect(readCanonicalIntake(intake)).toEqual(intake);
    expect(readCanonicalIntake({ ...intake, fileUrl: 'https://storage.example/file.pdf' })).toBeNull();
    expect(readCanonicalIntake({ id: DOC, fileUrl: 'https://storage.example/file.pdf' })).toBeNull();
    expect(repositoryIntakePayload(intake, 'privileged')).toEqual({
      title: 'file.pdf',
      filename: 'file.pdf',
      blobPath: intake.blobPath,
      documentType: 'ocr_upload',
      mimeType: 'application/pdf',
      privacyLabel: 'privileged',
      fileSize: 4,
    });
    expect(readCreatedDocument({
      data: {
        id: DOC,
        title: 'file.pdf',
        documentType: 'ocr_upload',
        privacyLabel: 'privileged',
        fileUrl: 'https://storage.example/file.pdf',
        contentText: 'secret',
      },
    })).toEqual({
      id: DOC,
      title: 'file.pdf',
      documentType: 'ocr_upload',
      privacyLabel: 'privileged',
    });
    expect(interpretOcr(200, { data: { text: 'draft', persisted: false, authoritative: false } })).toEqual({
      kind: 'review',
      text: 'draft',
    });
    expect(interpretOcr(200, { data: { text: 'draft', authoritative: true } })).toEqual({ kind: 'failed' });
    expect(interpretOcr(200, { data: { text: 'draft', blobPath: 'documents/org-1/file.pdf' } })).toEqual({ kind: 'failed' });
    expect(interpretOcr(501, {})).toEqual({ kind: 'unavailable' });
    expect(transcriptSaveUnavailable()).toEqual({ accepted: false, reason: 'ocr-transcript-persistence' });
  });
});
