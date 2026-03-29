import { describe, it, expect } from 'vitest';
import {
  validateFile,
  buildAttachmentPath,
  ALLOWED_CONTENT_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_CASE_TOTAL_SIZE,
  __blobManagerInternals,
} from '../blob-manager';

describe('blob-manager', () => {
  describe('validateFile', () => {
    it('accepts valid PDF upload', () => {
      const result = validateFile('report.pdf', 'application/pdf', 1024);
      expect(result.valid).toBe(true);
    });

    it('rejects blocked extension (.exe)', () => {
      const result = validateFile('virus.exe', 'application/octet-stream', 1024);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('blocked');
    });

    it('rejects unsupported extension (.mp4)', () => {
      const result = validateFile('video.mp4', 'video/mp4', 1024);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    it('rejects unsupported content type', () => {
      const result = validateFile('file.pdf', 'video/mp4', 1024);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Content type');
    });

    it('rejects file exceeding MAX_FILE_SIZE', () => {
      const result = validateFile('huge.pdf', 'application/pdf', MAX_FILE_SIZE + 1);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
    });

    it('rejects upload exceeding MAX_CASE_TOTAL_SIZE', () => {
      const result = validateFile('report.pdf', 'application/pdf', 1024, MAX_CASE_TOTAL_SIZE);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('case attachment limit');
    });

    it('accepts file within case total limit', () => {
      const result = validateFile('small.pdf', 'application/pdf', 1024, 0);
      expect(result.valid).toBe(true);
    });
  });

  describe('buildAttachmentPath', () => {
    it('returns org-scoped path with UUID and sanitized filename', () => {
      const path = buildAttachmentPath('org1', 'case1', 'my report.pdf');
      expect(path).toMatch(/^org1\/cases\/case1\/attachments\/[a-f0-9-]+-my report\.pdf$/);
    });

    it('sanitizes dangerous characters in filename', () => {
      const path = buildAttachmentPath('org1', 'case1', 'file/name\\bad:chars.pdf');
      expect(path).not.toContain('/name');
      expect(path).not.toContain('\\');
      expect(path).toContain('.pdf');
    });
  });

  describe('constants', () => {
    it('ALLOWED_CONTENT_TYPES includes PDF', () => {
      expect(ALLOWED_CONTENT_TYPES.has('application/pdf')).toBe(true);
    });

    it('ALLOWED_EXTENSIONS includes .docx', () => {
      expect(ALLOWED_EXTENSIONS.has('.docx')).toBe(true);
    });

    it('MAX_FILE_SIZE is 10 MB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('MAX_CASE_TOTAL_SIZE is 50 MB', () => {
      expect(MAX_CASE_TOTAL_SIZE).toBe(50 * 1024 * 1024);
    });
  });

  describe('internal helpers', () => {
    it('getExtension returns empty string when filename has no dot', () => {
      expect(__blobManagerInternals.getExtension('README')).toBe('');
    });

    it('formatBytes returns bytes for values under 1KB', () => {
      expect(__blobManagerInternals.formatBytes(512)).toBe('512 B');
    });

    it('formatBytes returns KB for values under 1MB', () => {
      expect(__blobManagerInternals.formatBytes(2048)).toBe('2.0 KB');
    });
  });
});
