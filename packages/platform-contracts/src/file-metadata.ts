/**
 * @nzila/platform-contracts — File Metadata Contracts
 *
 * Standardized file/document metadata scoped to org_scope.
 */
import { z } from 'zod'

// ── File Metadata ───────────────────────────────────────────────────────────

export const fileMetadataSchema = z.object({
  /** Unique file ID. */
  id: z.string().uuid(),
  /** Org scope owner. */
  orgId: z.string().min(1),
  /** Original file name. */
  fileName: z.string().min(1),
  /** MIME type. */
  mimeType: z.string().min(1),
  /** File size in bytes. */
  sizeBytes: z.number().int().nonnegative(),
  /** Storage path or blob key. */
  storagePath: z.string().min(1),
  /** Upload timestamp. */
  uploadedAt: z.string().datetime(),
  /** Uploader user ID. */
  uploadedBy: z.string().min(1),
  /** Source module. */
  moduleId: z.string().optional(),
  /** File category. */
  category: z.string().optional(),
  /** SHA-256 hash for integrity verification. */
  contentHash: z.string().optional(),
  /** Access level. */
  accessLevel: z.enum(['private', 'org', 'public']).default('org'),
  /** Arbitrary metadata. */
  metadata: z.record(z.unknown()).optional(),
})

export type FileMetadata = z.infer<typeof fileMetadataSchema>
