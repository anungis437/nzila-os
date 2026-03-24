/**
 * Blob Manager — Org-scoped case attachment storage
 *
 * PR-040: Scoped Storage + Signed Access
 *
 * Enforces:
 * - Org-isolated storage paths: {orgId}/cases/{caseId}/attachments/{fileId}-{filename}
 * - File type whitelist (PDF, DOCX, XLSX, JPG, PNG, GIF, TXT)
 * - Size limits: 10 MB per file, 50 MB per case
 */

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
]);

export const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.txt',
]);

/** 10 MB per file */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 50 MB cumulative per case */
export const MAX_CASE_TOTAL_SIZE = 50 * 1024 * 1024;

/** Dangerous extensions that must always be rejected */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.dll', '.com',
  '.scr', '.vbs', '.js', '.jar', '.py', '.rb', '.zip', '.rar',
  '.7z', '.tar', '.gz', '.iso',
]);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a file before upload.
 */
export function validateFile(
  filename: string,
  contentType: string,
  sizeBytes: number,
  currentCaseTotalBytes: number = 0,
): FileValidationResult {
  // Extension check
  const ext = getExtension(filename);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `File type ${ext} is blocked for security reasons` };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `File extension ${ext} is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}` };
  }

  // Content type check
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return { valid: false, reason: `Content type ${contentType} is not allowed` };
  }

  // Size checks
  if (sizeBytes > MAX_FILE_SIZE) {
    return { valid: false, reason: `File size ${formatBytes(sizeBytes)} exceeds maximum ${formatBytes(MAX_FILE_SIZE)}` };
  }
  if (currentCaseTotalBytes + sizeBytes > MAX_CASE_TOTAL_SIZE) {
    return { valid: false, reason: `Upload would exceed case attachment limit of ${formatBytes(MAX_CASE_TOTAL_SIZE)}` };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Build the org-scoped blob path for a case attachment.
 */
export function buildAttachmentPath(
  orgId: string,
  caseId: string,
  filename: string,
): string {
  const fileId = crypto.randomUUID();
  const sanitized = sanitizeFilename(filename);
  return `${orgId}/cases/${caseId}/attachments/${fileId}-${sanitized}`;
}

/**
 * Quick filename sanitize — remove path separators and null bytes.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|\x00]/g, '_');
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
