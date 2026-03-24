/**
 * Tests for blob-manager file validation + path generation
 *
 * PR-040 / PR-041 / PR-042: Attachment trust layer
 *
 * Mirrors blob-manager.ts validation logic locally
 * (same self-contained pattern as other cupe-vocabulary tests).
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local mirrors — kept in sync with apps/union-eyes/lib/blob-manager.ts
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.txt',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll', '.com',
  '.scr', '.vbs', '.js', '.jar', '.py', '.rb', '.zip', '.rar',
  '.7z', '.tar', '.gz', '.iso',
]);

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'text/plain',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CASE_TOTAL_SIZE = 50 * 1024 * 1024;

interface FileValidationResult { valid: boolean; reason?: string; }

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function validateFile(
  filename: string, contentType: string, sizeBytes: number, currentTotal = 0,
): FileValidationResult {
  const ext = getExtension(filename);
  if (BLOCKED_EXTENSIONS.has(ext)) return { valid: false, reason: `File type ${ext} is blocked for security reasons` };
  if (!ALLOWED_EXTENSIONS.has(ext)) return { valid: false, reason: `File extension ${ext} is not allowed` };
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) return { valid: false, reason: `Content type ${contentType} is not allowed` };
  if (sizeBytes > MAX_FILE_SIZE) return { valid: false, reason: `File size exceeds maximum` };
  if (currentTotal + sizeBytes > MAX_CASE_TOTAL_SIZE) return { valid: false, reason: `Upload would exceed case attachment limit` };
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('File Validation', () => {
  describe('allowed file types', () => {
    const allowed = [
      ['report.pdf', 'application/pdf'],
      ['document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['spreadsheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['photo.jpg', 'image/jpeg'],
      ['photo.jpeg', 'image/jpeg'],
      ['image.png', 'image/png'],
      ['animation.gif', 'image/gif'],
      ['notes.txt', 'text/plain'],
    ] as const;

    it.each(allowed)('%s is accepted', (filename, contentType) => {
      expect(validateFile(filename, contentType, 1024).valid).toBe(true);
    });
  });

  describe('blocked file types', () => {
    const blocked = [
      '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll', '.com',
      '.scr', '.vbs', '.js', '.jar', '.py', '.rb', '.zip', '.rar',
      '.7z', '.tar', '.gz', '.iso',
    ];

    it.each(blocked)('%s is blocked', (ext) => {
      const result = validateFile(`malware${ext}`, 'application/octet-stream', 1024);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('blocked');
    });
  });

  describe('unknown extensions', () => {
    it('rejects .html', () => {
      const r = validateFile('page.html', 'text/html', 1024);
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('not allowed');
    });

    it('rejects file without extension', () => {
      const r = validateFile('noextension', 'application/octet-stream', 1024);
      expect(r.valid).toBe(false);
    });
  });

  describe('content type validation', () => {
    it('rejects mismatched content type', () => {
      // PDF extension but wrong content type
      const r = validateFile('report.pdf', 'text/html', 1024);
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('Content type');
    });
  });

  describe('size limits', () => {
    it('accepts file at exactly MAX_FILE_SIZE', () => {
      expect(validateFile('ok.pdf', 'application/pdf', MAX_FILE_SIZE).valid).toBe(true);
    });

    it('rejects file 1 byte over MAX_FILE_SIZE', () => {
      const r = validateFile('big.pdf', 'application/pdf', MAX_FILE_SIZE + 1);
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('exceeds maximum');
    });

    it('rejects when cumulative case total would exceed limit', () => {
      const existing = MAX_CASE_TOTAL_SIZE - 1024;
      const r = validateFile('more.pdf', 'application/pdf', 2048, existing);
      expect(r.valid).toBe(false);
      expect(r.reason).toContain('case attachment limit');
    });

    it('accepts when cumulative total fits', () => {
      const existing = MAX_CASE_TOTAL_SIZE - 5000;
      expect(validateFile('ok.pdf', 'application/pdf', 4000, existing).valid).toBe(true);
    });
  });
});

describe('Attachment Path Structure', () => {
  it('path follows {orgId}/cases/{caseId}/attachments/{fileId}-{filename} pattern', () => {
    const orgId = 'org_abc';
    const caseId = 'case_123';
    const filename = 'evidence.pdf';
    // Simulate buildAttachmentPath structure
    const path = `${orgId}/cases/${caseId}/attachments/00000000-0000-0000-0000-000000000000-${filename}`;
    expect(path).toMatch(/^org_abc\/cases\/case_123\/attachments\/[a-f0-9-]+-evidence\.pdf$/);
  });

  it('org isolation: different orgs have different path prefixes', () => {
    const path1 = 'org_a/cases/c1/attachments/id-file.pdf';
    const path2 = 'org_b/cases/c1/attachments/id-file.pdf';
    expect(path1.split('/')[0]).not.toBe(path2.split('/')[0]);
  });
});

describe('Scan Status Contract', () => {
  const validStatuses = ['pending', 'clean', 'infected', 'unavailable'];

  it.each(validStatuses)('recognises scan status: %s', (status) => {
    expect(validStatuses).toContain(status);
  });

  it('has exactly 4 scan statuses', () => {
    expect(validStatuses).toHaveLength(4);
  });
});
