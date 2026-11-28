/**
 * Imported document content verification (MIG-05).
 *
 * An import records a document as a reference: a name, a location and, when the source declares one, the SHA-256 of its
 * bytes. That is never presented as verified content. Verification takes the bytes (fetched from approved storage by the
 * caller), computes their SHA-256 and compares it with the declared digest, once: digest_verified or digest_mismatch.
 * A document with no declared digest cannot be verified. No malware scanner is wired, so scan_state stays 'not_scanned'
 * and no imported document is available as verified content yet.
 */
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db/db';

export type DocumentVerificationState = 'reference_only' | 'digest_verified' | 'digest_mismatch';

export type DocumentVerificationOutcome =
  | { status: 'verified' | 'mismatch'; state: DocumentVerificationState; digest: string; byteSize: number }
  | { status: 'refused'; reason: 'NOT_AN_IMPORTED_DOCUMENT' | 'SOURCE_DIGEST_REQUIRED' | 'ALREADY_DECIDED'; state?: DocumentVerificationState };

export async function verifyImportedDocumentContent(input: {
  organizationId: string;
  documentId: string;
  bytes: Uint8Array;
  verifiedBy: string;
}): Promise<DocumentVerificationOutcome> {
  const digest = createHash('sha256').update(input.bytes).digest('hex');
  const updated = (await db.execute(sql`
    UPDATE ue_imported_document_evidence
    SET verification_state = CASE WHEN source_declared_digest = ${digest} THEN 'digest_verified' ELSE 'digest_mismatch' END,
        verified_digest = ${digest}, byte_size = ${input.bytes.byteLength}, verified_at = now(), verified_by = ${input.verifiedBy}
    WHERE organization_id = ${input.organizationId}::uuid AND document_id = ${input.documentId}::uuid
      AND verification_state = 'reference_only' AND source_declared_digest IS NOT NULL
    RETURNING verification_state
  `)) as unknown as Array<{ verification_state: DocumentVerificationState }>;
  if (updated[0]) {
    const state = updated[0].verification_state;
    return { status: state === 'digest_verified' ? 'verified' : 'mismatch', state, digest, byteSize: input.bytes.byteLength };
  }
  const [row] = (await db.execute(sql`
    SELECT verification_state, source_declared_digest FROM ue_imported_document_evidence
    WHERE organization_id = ${input.organizationId}::uuid AND document_id = ${input.documentId}::uuid
  `)) as unknown as Array<{ verification_state: DocumentVerificationState; source_declared_digest: string | null }>;
  if (!row) return { status: 'refused', reason: 'NOT_AN_IMPORTED_DOCUMENT' };
  if (!row.source_declared_digest) return { status: 'refused', reason: 'SOURCE_DIGEST_REQUIRED', state: row.verification_state };
  return { status: 'refused', reason: 'ALREADY_DECIDED', state: row.verification_state };
}

/** Available as verified content only when its bytes matched the declared digest and a scan found it clean. */
export async function isImportedDocumentContentAvailable(organizationId: string, documentId: string): Promise<boolean> {
  const [row] = (await db.execute(sql`
    SELECT verification_state = 'digest_verified' AND scan_state = 'clean' AS available FROM ue_imported_document_evidence
    WHERE organization_id = ${organizationId}::uuid AND document_id = ${documentId}::uuid
  `)) as unknown as Array<{ available: boolean }>;
  return row?.available === true;
}
