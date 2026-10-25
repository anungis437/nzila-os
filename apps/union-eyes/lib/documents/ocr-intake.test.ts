import { describe, expect, it } from 'vitest';
import {
  assessUpload,
  interpretOcr,
  readCanonicalIntake,
  readCreatedDocument,
  repositoryIntakePayload,
  interpretTranscriptSave,
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

  it('separates blob intake, the canonical row, and untrusted OCR text', () => {
    const intake = {
      intakeId: DOC,
      checksum: 'abc',
      size: 4,
      mimeType: 'application/pdf',
      filename: 'file.pdf',
      expiresAt: '2026-01-01T00:30:00.000Z',
    };
    expect(readCanonicalIntake({ success: true, data: intake })).toEqual(intake);
    expect(readCanonicalIntake(intake)).toEqual(intake);
    // A response that carries a storage path or URL is not an intake receipt.
    expect(readCanonicalIntake({ data: { ...intake, blobPath: 'documents/org-1/file.pdf' } })).toBeNull();
    expect(readCanonicalIntake({ data: { ...intake, storageKey: 'documents/org-1/intake/x/y' } })).toBeNull();
    expect(readCanonicalIntake({ data: { ...intake, fileUrl: 'https://storage.example/file.pdf' } })).toBeNull();
    expect(readCanonicalIntake({ data: { ...intake, intakeId: 'not-a-uuid' } })).toBeNull();
    // The create request names the intake and never repeats facts the server already recorded.
    expect(repositoryIntakePayload(intake, 'privileged')).toEqual({
      title: 'file.pdf',
      filename: 'file.pdf',
      intakeId: DOC,
      documentType: 'ocr_upload',
      privacyLabel: 'privileged',
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
      revisionNo: null,
    });
    expect(interpretOcr(200, { data: { text: 'draft', authoritative: true } })).toEqual({ kind: 'failed' });
    expect(interpretOcr(200, { data: { text: 'draft', blobPath: 'documents/org-1/file.pdf' } })).toEqual({ kind: 'failed' });
    expect(interpretOcr(501, {})).toEqual({ kind: 'unavailable' });
    expect(interpretOcr(200, { data: { text: 'draft', revisionNo: 1 } })).toEqual({ kind: 'review', text: 'draft', revisionNo: 1 });
    expect(interpretTranscriptSave(200, { data: { revision: { revisionNo: 2 } } })).toEqual({ kind: 'saved', revisionNo: 2 });
    expect(interpretTranscriptSave(200, { data: {} })).toEqual({ kind: 'failed' });
    expect(interpretTranscriptSave(409, {})).toEqual({ kind: 'stale' });
    expect(interpretTranscriptSave(403, {})).toEqual({ kind: 'denied' });
    expect(interpretTranscriptSave(503, {})).toEqual({ kind: 'failed' });
  });
});
