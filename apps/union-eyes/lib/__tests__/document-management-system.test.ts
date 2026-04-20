/**
 * Document Management System — Unit Tests
 *
 * Covers uploadDocument, uploadDocumentVersion, getDocumentVersions,
 * restoreDocumentVersion, searchDocuments, requestESignature,
 * markDocumentSigned, getSignatureStatus, applyRetentionPolicy,
 * archiveDocument, getGrievanceDocuments, updateDocumentOCR.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ── hoisted ────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockInsertReturning: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockDeleteWhere: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockPutBlob: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mocks.mockInsertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mocks.mockUpdateWhere,
      })),
    })),
    delete: vi.fn(() => ({
      where: mocks.mockDeleteWhere,
    })),
    query: {
      grievanceDocuments: {
        findFirst: mocks.mockFindFirst,
        findMany: mocks.mockFindMany,
      },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  grievanceDocuments: {
    id: 'id',
    organizationId: 'organizationId',
    claimId: 'claimId',
    parentDocumentId: 'parentDocumentId',
    version: 'version',
    isLatestVersion: 'isLatestVersion',
    documentType: 'documentType',
    documentName: 'documentName',
    uploadedBy: 'uploadedBy',
    uploadedAt: 'uploadedAt',
    archivedAt: 'archivedAt',
    signatureStatus: 'signatureStatus',
    requiresSignature: 'requiresSignature',
  },
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
  putBlob: mocks.mockPutBlob,
}));

vi.mock('@/lib/services/signature-providers', () => ({
  DocuSignProvider: class {
    createEnvelope = vi.fn(async () => ({ id: 'env-1', status: 'sent', documentUrl: 'https://test.com/doc' }));
  },
}));

vi.mock('@/lib/services/ocr-service', () => ({
  processImageOCR: vi.fn(async () => ({ text: 'ocr text from image' })),
  processPDFOCR: vi.fn(async () => ({ fullText: 'ocr text from pdf' })),
}));

vi.mock('@/lib/services/notification-service', () => ({
  NotificationService: class {
    send = vi.fn(async () => {});
  },
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  uploadDocument,
  uploadDocumentVersion,
  getDocumentVersions,
  restoreDocumentVersion,
  searchDocuments,
  requestESignature,
  markDocumentSigned,
  getSignatureStatus,
  applyRetentionPolicy,
  archiveDocument,
  getGrievanceDocuments,
  updateDocumentOCR,
} from '../document-management-system';

/* ── helpers ────────────────────────────────────────────────────────── */

const baseDoc = {
  id: 'doc-1',
  claimId: 'claim-1',
  organizationId: 'org-1',
  documentName: 'evidence.pdf',
  documentType: 'evidence',
  filePath: 'https://nzilacanadastore.blob.core.windows.net/docs/evidence.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  version: 1,
  parentDocumentId: null,
  isLatestVersion: true,
  versionStatus: 'draft',
  description: 'Key evidence document',
  tags: ['evidence', 'photos'],
  ocrText: 'scanned text about grievance procedures',
  requiresSignature: false,
  signatureStatus: null,
  signedBy: null,
  signedAt: null,
  signatureData: null,
  archivedAt: null,
  uploadedBy: 'user-1',
  uploadedAt: new Date('2025-01-01'),
};

/* ── tests ──────────────────────────────────────────────────────────── */

describe('document-management-system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockPutBlob.mockResolvedValue({
      url: 'https://blob.test/file.pdf',
      pathname: 'file.pdf',
    });
    mocks.mockInsertReturning.mockResolvedValue([{ id: 'doc-1' }]);
    mocks.mockUpdateWhere.mockResolvedValue(undefined);
    mocks.mockDeleteWhere.mockResolvedValue(undefined);
    mocks.mockFindFirst.mockResolvedValue(baseDoc);
    mocks.mockFindMany.mockResolvedValue([baseDoc]);
    // stub global fetch for OCR + DocuSign
    vi.stubGlobal('fetch', mocks.mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      headers: { get: () => 'application/pdf' },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── uploadDocument ────────────────────────────────────────────────
  describe('uploadDocument', () => {
    it('uploads file and creates record', async () => {
      const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' });
      const r = await uploadDocument('claim-1', 'org-1', file, 'evidence', 'user-1');
      expect(r.success).toBe(true);
      expect(r.documentId).toBe('doc-1');
      expect(mocks.mockPutBlob).toHaveBeenCalled();
    });

    it('handles blob upload error', async () => {
      mocks.mockPutBlob.mockRejectedValueOnce(new Error('Blob error'));
      const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' });
      const r = await uploadDocument('claim-1', 'org-1', file, 'evidence', 'user-1');
      expect(r.success).toBe(false);
      expect(r.error).toBe('Blob error');
    });

    it('passes options to insert', async () => {
      const file = new File(['hello'], 'doc.txt', { type: 'text/plain' });
      const r = await uploadDocument('claim-1', 'org-1', file, 'evidence', 'user-1', {
        isConfidential: true,
        accessLevel: 'restricted',
        tags: ['sensitive'],
      });
      expect(r.success).toBe(true);
    });
  });

  // ── uploadDocumentVersion ─────────────────────────────────────────
  describe('uploadDocumentVersion', () => {
    it('creates new version', async () => {
      mocks.mockFindFirst
        .mockResolvedValueOnce(baseDoc) // parent lookup
        .mockResolvedValueOnce({ version: 2 }); // latest version lookup
      mocks.mockInsertReturning.mockResolvedValueOnce([{ id: 'doc-2' }]);
      const file = new File(['updated'], 'test-v2.pdf', { type: 'application/pdf' });
      const r = await uploadDocumentVersion('doc-1', 'org-1', file, 'user-1', 'Added page 2');
      expect(r.success).toBe(true);
      expect(r.documentId).toBe('doc-2');
    });

    it('returns error when parent not found', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(null);
      const file = new File(['x'], 'test.pdf', { type: 'application/pdf' });
      const r = await uploadDocumentVersion('missing', 'org-1', file, 'user-1');
      expect(r.success).toBe(false);
      expect(r.error).toContain('not found');
    });
  });

  // ── getDocumentVersions ───────────────────────────────────────────
  describe('getDocumentVersions', () => {
    it('returns version history', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(baseDoc);
      mocks.mockFindMany.mockResolvedValueOnce([
        { ...baseDoc, version: 2, id: 'doc-2' },
        { ...baseDoc, version: 1 },
      ]);
      const versions = await getDocumentVersions('doc-1', 'org-1');
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(2);
    });

    it('returns empty when document not found', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(null);
      expect(await getDocumentVersions('missing', 'org-1')).toEqual([]);
    });
  });

  // ── restoreDocumentVersion ────────────────────────────────────────
  describe('restoreDocumentVersion', () => {
    it('restores version as latest', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(baseDoc);
      const r = await restoreDocumentVersion('doc-1', 'org-1', 'user-1');
      expect(r.success).toBe(true);
    });

    it('returns error if version not found', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(null);
      const r = await restoreDocumentVersion('missing', 'org-1', 'user-1');
      expect(r.success).toBe(false);
      expect(r.error).toContain('not found');
    });
  });

  // ── searchDocuments ───────────────────────────────────────────────
  describe('searchDocuments', () => {
    it('returns results ranked by relevance', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([
        { ...baseDoc, documentName: 'grievance evidence' },
        { ...baseDoc, id: 'doc-2', documentName: 'schedule.xlsx', ocrText: null, description: null, tags: [] },
      ]);
      const results = await searchDocuments('org-1', 'grievance');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].matchedFields).toContain('name');
    });

    it('filters by claimId', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([baseDoc]);
      const results = await searchDocuments('org-1', 'evidence', { claimId: 'claim-1' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty on error', async () => {
      mocks.mockFindMany.mockRejectedValueOnce(new Error('fail'));
      expect(await searchDocuments('org-1', 'test')).toEqual([]);
    });

    it('matches in OCR text', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([baseDoc]);
      const results = await searchDocuments('org-1', 'grievance procedures');
      expect(results.length).toBe(1);
      expect(results[0].matchedFields).toContain('content');
    });

    it('applies date filters', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([baseDoc]);
      const results = await searchDocuments('org-1', 'evidence', {
        dateFrom: new Date('2026-01-01'),
      });
      expect(results).toEqual([]);
    });

    it('applies tag filters', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([baseDoc]);
      const results = await searchDocuments('org-1', 'evidence', {
        tags: ['nonexistent'],
      });
      expect(results).toEqual([]);
    });
  });

  // ── requestESignature ─────────────────────────────────────────────
  describe('requestESignature', () => {
    it('returns error if document not found', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(null);
      const r = await requestESignature({
        documentId: 'missing',
        signerUserId: 'u-1',
        signerEmail: 'a@b.com',
        signerName: 'Alice',
        provider: 'internal',
      });
      expect(r.success).toBe(false);
      expect(r.error).toContain('not found');
    });

    it('returns error if document does not require signature', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ ...baseDoc, requiresSignature: false });
      const r = await requestESignature({
        documentId: 'doc-1',
        signerUserId: 'u-1',
        signerEmail: 'a@b.com',
        signerName: 'Alice',
        provider: 'internal',
      });
      expect(r.success).toBe(false);
      expect(r.error).toContain('not configured');
    });

    it('sends internal signature request', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ ...baseDoc, requiresSignature: true });
      const r = await requestESignature({
        documentId: 'doc-1',
        signerUserId: 'u-1',
        signerEmail: 'a@b.com',
        signerName: 'Alice',
        provider: 'internal',
      });
      expect(r.success).toBe(true);
      expect(r.signatureRequestId).toContain('sig_');
    });
  });

  // ── markDocumentSigned ────────────────────────────────────────────
  describe('markDocumentSigned', () => {
    it('marks document as signed', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(baseDoc);
      const r = await markDocumentSigned('doc-1', 'org-1', 'user-1');
      expect(r.success).toBe(true);
    });

    it('returns error if not found', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(null);
      const r = await markDocumentSigned('missing', 'org-1', 'user-1');
      expect(r.success).toBe(false);
    });
  });

  // ── getSignatureStatus ────────────────────────────────────────────
  describe('getSignatureStatus', () => {
    it('returns status for signable document', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({
        ...baseDoc,
        requiresSignature: true,
        signatureStatus: 'pending',
        signatureData: { provider: 'internal', timestamp: '2025-01-01' },
      });
      const status = await getSignatureStatus('doc-1', 'org-1');
      expect(status).not.toBeNull();
      expect(status!.status).toBe('pending');
    });

    it('returns null for non-signable document', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce({ ...baseDoc, requiresSignature: false });
      expect(await getSignatureStatus('doc-1', 'org-1')).toBeNull();
    });

    it('returns null when not found', async () => {
      mocks.mockFindFirst.mockResolvedValueOnce(null);
      expect(await getSignatureStatus('missing', 'org-1')).toBeNull();
    });
  });

  // ── applyRetentionPolicy ──────────────────────────────────────────
  describe('applyRetentionPolicy', () => {
    it('archives old documents', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([
        { ...baseDoc, archivedAt: null },
      ]);
      const r = await applyRetentionPolicy('org-1', {
        documentType: 'evidence',
        retentionDays: 30,
        autoArchive: true,
        autoDelete: false,
      });
      expect(r.archivedCount).toBe(1);
      expect(r.deletedCount).toBe(0);
    });

    it('deletes already-archived documents', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([
        { ...baseDoc, archivedAt: new Date('2024-01-01') },
      ]);
      const r = await applyRetentionPolicy('org-1', {
        documentType: 'evidence',
        retentionDays: 30,
        autoArchive: false,
        autoDelete: true,
      });
      expect(r.archivedCount).toBe(0);
      expect(r.deletedCount).toBe(1);
    });

    it('returns zeros on error', async () => {
      mocks.mockFindMany.mockRejectedValueOnce(new Error('fail'));
      const r = await applyRetentionPolicy('org-1', {
        documentType: 'x',
        retentionDays: 1,
        autoArchive: true,
        autoDelete: true,
      });
      expect(r).toEqual({ archivedCount: 0, deletedCount: 0 });
    });
  });

  // ── archiveDocument ───────────────────────────────────────────────
  describe('archiveDocument', () => {
    it('archives successfully', async () => {
      const r = await archiveDocument('doc-1', 'org-1');
      expect(r.success).toBe(true);
    });

    it('handles error', async () => {
      mocks.mockUpdateWhere.mockRejectedValueOnce(new Error('fail'));
      const r = await archiveDocument('doc-1', 'org-1');
      expect(r.success).toBe(false);
    });
  });

  // ── getGrievanceDocuments ─────────────────────────────────────────
  describe('getGrievanceDocuments', () => {
    it('returns documents for claim', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([baseDoc]);
      const docs = await getGrievanceDocuments('claim-1', 'org-1');
      expect(docs).toHaveLength(1);
    });

    it('applies latestOnly filter', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([baseDoc]);
      const docs = await getGrievanceDocuments('claim-1', 'org-1', { latestOnly: true });
      expect(docs).toHaveLength(1);
    });

    it('applies documentType filter', async () => {
      mocks.mockFindMany.mockResolvedValueOnce([]);
      const docs = await getGrievanceDocuments('claim-1', 'org-1', { documentType: 'contract' });
      expect(docs).toEqual([]);
    });

    it('returns empty on error', async () => {
      mocks.mockFindMany.mockRejectedValueOnce(new Error('fail'));
      expect(await getGrievanceDocuments('c-1', 'org-1')).toEqual([]);
    });
  });

  // ── updateDocumentOCR ─────────────────────────────────────────────
  describe('updateDocumentOCR', () => {
    it('updates OCR text', async () => {
      const r = await updateDocumentOCR('doc-1', 'extracted text');
      expect(r.success).toBe(true);
    });

    it('handles error', async () => {
      mocks.mockUpdateWhere.mockRejectedValueOnce(new Error('fail'));
      const r = await updateDocumentOCR('doc-1', 'text');
      expect(r.success).toBe(false);
    });
  });
});
