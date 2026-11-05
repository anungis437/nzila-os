/**
 * Recomputes the content hash of a signature document from its stored file, so a signature is given on what was sent.
 *
 * The hash stored when the request was created is only evidence if something later compares it with the file. This does, at signing.
 * A stored file that does not match is refused. A file that cannot be located as this organization's own storage (a provider-held or
 * older document) cannot be checked, and that is recorded as unverified rather than passed as verified.
 */
import { createHash } from 'node:crypto'
import { verifiedLegacyBlobPath } from '@/lib/services/document-blob-integrity-service'
import { readBlobBounded } from '@/lib/blob-client'

export const SIGNATURE_FILE_MAX_BYTES = 50 * 1024 * 1024

export type FileHashCheck =
  | { status: 'verified'; sha256: string }
  | { status: 'mismatch'; expected: string; actual: string }
  | { status: 'unverified'; reason: 'no_stored_hash' | 'not_own_storage' | 'unreadable' | 'too_large' }

export async function verifySignatureDocumentFile(document: {
  organizationId: string
  fileUrl: string | null
  fileHash: string | null
}): Promise<FileHashCheck> {
  if (!document.fileHash) return { status: 'unverified', reason: 'no_stored_hash' }
  const blobPath = verifiedLegacyBlobPath(document.fileUrl, document.organizationId)
  if (!blobPath) return { status: 'unverified', reason: 'not_own_storage' }
  let bytes: Buffer
  try {
    bytes = await readBlobBounded(blobPath, SIGNATURE_FILE_MAX_BYTES)
  } catch (error) {
    return { status: 'unverified', reason: (error as { name?: string })?.name === 'BlobTooLargeError' ? 'too_large' : 'unreadable' }
  }
  const actual = createHash('sha256').update(bytes).digest('hex')
  return actual === document.fileHash.toLowerCase() ? { status: 'verified', sha256: actual } : { status: 'mismatch', expected: document.fileHash, actual }
}
