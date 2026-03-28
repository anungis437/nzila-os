/**
 * Precedent Document Service — Unit Tests
 *
 * Tests:
 *   - uploadPrecedentDocument calls putBlob
 *   - deletePrecedentDocument calls deleteBlob
 *   - validatePrecedentDocument rejects oversized files
 *   - validatePrecedentDocument accepts valid files
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockPutBlob, mockDeleteBlob } = vi.hoisted(() => ({
  mockPutBlob: vi.fn(),
  mockDeleteBlob: vi.fn(),
}));

vi.mock('@/lib/blob-client', () => ({
  putBlob: mockPutBlob,
  deleteBlob: mockDeleteBlob,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  uploadPrecedentDocument,
  deletePrecedentDocument,
  validatePrecedentDocument,
} from '../precedent-document-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('precedent-document-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPutBlob.mockResolvedValue({
      url: 'https://blob.test/file.pdf',
      pathname: 'precedents/org1/prec1/file.pdf',
      contentType: 'application/pdf',
    });
    mockDeleteBlob.mockResolvedValue(undefined);
  });

  it('uploadPrecedentDocument calls putBlob with correct path', async () => {
    const file = Buffer.from('pdf-content');
    const result = await uploadPrecedentDocument(file, {
      precedentId: 'prec-1',
      organizationId: 'org-1',
      filename: 'decision.pdf',
      contentType: 'application/pdf',
    });

    expect(mockPutBlob).toHaveBeenCalledWith(
      'precedents/org-1/prec-1/decision.pdf',
      file,
      { contentType: 'application/pdf', addRandomSuffix: false }
    );
    expect(result.url).toBe('https://blob.test/file.pdf');
  });

  it('deletePrecedentDocument calls deleteBlob', async () => {
    await deletePrecedentDocument('https://blob.test/file.pdf');
    expect(mockDeleteBlob).toHaveBeenCalledWith('https://blob.test/file.pdf');
  });

  it('validatePrecedentDocument rejects oversized files', () => {
    const result = validatePrecedentDocument(
      60 * 1024 * 1024, // 60MB
      'application/pdf'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('50MB');
  });

  it('validatePrecedentDocument accepts valid files', () => {
    const result = validatePrecedentDocument(
      1024 * 1024, // 1MB
      'application/pdf'
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
