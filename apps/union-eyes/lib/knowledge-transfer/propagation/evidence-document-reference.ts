/**
 * Evidence Document Reference — resolves a verified dependency's evidenceDocumentId against the real documents
 * table and binds the evidence to the document's EXACT content
 * (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE, Family 1 final correction).
 *
 *  - At SUBMISSION (resolveEvidenceDocumentForSubmission): the document must exist, belong to the same organization,
 *    be 'active', carry a content hash, and the SUBMITTER must be authorized to view it per the existing
 *    document-authorization-service policy engine. The content identity it returns is stored with the record.
 *  - At VERIFICATION the content identity is captured again (currentDocumentIntegrity), so the reviewer attests the
 *    content as it stands at that moment.
 *  - At every READ (loadEvidenceDocumentIntegrity, consumed by graph-evidence-service.ts's single evaluator): the
 *    document must still be active AND its content identity must equal the one recorded. A new version, a changed
 *    hash, an archive or a deletion makes the record stale. No per-reader authorization is evaluated: an analytics
 *    read is not a document access and must not leak document signals about an unrelated actor.
 *
 * Content identity: "version:<version_no>:<content_hash>" of the latest document_versions row when the document is
 * versioned, otherwise "sha256:<hash>" from documents.sha256 (or documents.checksum). A document with neither has no
 * content the system can bind, and is refused as evidence.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/db';
import { documents, documentVersions } from '@/db/schema/documents-schema';
import { authorizeDocumentsForActor } from '@/lib/services/document-authorization-service';

export type EvidenceDocumentResolution =
  | { status: 'resolved'; integrity: string }
  | { status: 'not_found' }
  | { status: 'not_authorized' }
  | { status: 'no_content_hash' };

export interface EvidenceDocumentState {
  active: boolean;
  /** Content identity right now, or null when the document has no content hash at all. */
  integrity: string | null;
}

function integrityOf(latestVersion: { versionNo: number; contentHash: string } | undefined, sha256: string | null, checksum: string | null): string | null {
  if (latestVersion && latestVersion.contentHash) return `version:${latestVersion.versionNo}:${latestVersion.contentHash}`;
  const hash = sha256 ?? checksum;
  return hash ? `sha256:${hash}` : null;
}

/** Content identity and active status for each id, in one pass (two queries regardless of how many ids). Ids not in
 *  this organization are simply absent from the result: to the evaluator, absent = no longer resolves. */
export async function loadEvidenceDocumentIntegrity(orgId: string, documentIds: readonly string[]): Promise<Map<string, EvidenceDocumentState>> {
  const result = new Map<string, EvidenceDocumentState>();
  if (documentIds.length === 0) return result;
  const ids = [...documentIds];
  const [docs, versions] = await Promise.all([
    db
      .select({ id: documents.id, status: documents.status, sha256: documents.sha256, checksum: documents.checksum })
      .from(documents)
      .where(and(eq(documents.organizationId, orgId), inArray(documents.id, ids))),
    db
      .select({ documentId: documentVersions.documentId, versionNo: documentVersions.versionNo, contentHash: documentVersions.contentHash })
      .from(documentVersions)
      .where(and(eq(documentVersions.organizationId, orgId), inArray(documentVersions.documentId, ids)))
      .orderBy(desc(documentVersions.versionNo)),
  ]);
  const latest = new Map<string, { versionNo: number; contentHash: string }>();
  for (const v of versions) if (!latest.has(v.documentId)) latest.set(v.documentId, { versionNo: v.versionNo, contentHash: v.contentHash });
  for (const doc of docs) {
    result.set(doc.id, { active: doc.status === 'active', integrity: integrityOf(latest.get(doc.id), doc.sha256, doc.checksum) });
  }
  return result;
}

/** The current content identity of one active document, or null if it is missing, inactive or has no hash. */
export async function currentDocumentIntegrity(orgId: string, documentId: string): Promise<string | null> {
  const state = (await loadEvidenceDocumentIntegrity(orgId, [documentId])).get(documentId);
  return state && state.active ? state.integrity : null;
}

async function loadActiveDocument(orgId: string, documentId: string) {
  const rows = await db
    .select({ id: documents.id, privacyLabel: documents.privacyLabel, status: documents.status })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)))
    .limit(1);
  const doc = rows[0];
  return doc && doc.status === 'active' ? doc : null;
}

/** Full check (existence + organization + active status + submitter authorization + content hash) - gate for new
 *  submissions. Returns the content identity to store with the record. */
export async function resolveEvidenceDocumentForSubmission(
  orgId: string,
  documentId: string,
  submittedBy: string,
): Promise<EvidenceDocumentResolution> {
  const doc = await loadActiveDocument(orgId, documentId);
  if (!doc) return { status: 'not_found' };
  const [result] = await authorizeDocumentsForActor({
    organizationId: orgId,
    actor: { userId: submittedBy },
    documents: [{ id: doc.id, privacyLabel: doc.privacyLabel, linkedEntityType: null, linkedEntityId: null }],
  });
  if (!result.allowed) return { status: 'not_authorized' };
  const integrity = await currentDocumentIntegrity(orgId, documentId);
  return integrity === null ? { status: 'no_content_hash' } : { status: 'resolved', integrity };
}
