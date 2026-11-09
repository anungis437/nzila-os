/**
 * Evidence Document Reference — resolves a verified dependency's evidenceDocumentId against the real documents
 * table (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE, Family 1 exit).
 *
 * A 'document' evidence reference must name an ACTUAL, CURRENT, AUTHORIZED record - not an arbitrary free-text
 * string a submitter typed and a reviewer clicked past. Two distinct checks, reusing the existing document/
 * authority primitives rather than inventing a parallel permission model:
 *  - At SUBMISSION time (resolveEvidenceDocumentForSubmission): the document must exist, belong to the same
 *    organization, be 'active' (not archived/deleted), and the SUBMITTER must be authorized to view it per the
 *    existing document-authorization-service policy engine (case access, explicit grants, privacy label).
 *  - At every READ (documentCurrentlyResolves, used by graph-evidence-service.ts's currentness check): only
 *    existence/organization/active-status is re-checked, not the original submitter's or every reader's
 *    authorization - an analytics read is not a document access and must not leak document existence/authorization
 *    signals about an unrelated actor; confirming the referenced record is still real and current is what "an
 *    evidence reference resolves" means at that layer.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { documents } from '@/db/schema/documents-schema';
import { authorizeDocumentsForActor } from '@/lib/services/document-authorization-service';

export type EvidenceDocumentResolution = 'resolved' | 'not_found' | 'not_authorized';

async function loadActiveDocument(orgId: string, documentId: string) {
  const rows = await db
    .select({ id: documents.id, privacyLabel: documents.privacyLabel, status: documents.status })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organizationId, orgId)))
    .limit(1);
  const doc = rows[0];
  return doc && doc.status === 'active' ? doc : null;
}

/** Full check (existence + organization + active status + submitter authorization) - gate for new submissions. */
export async function resolveEvidenceDocumentForSubmission(
  orgId: string,
  documentId: string,
  submittedBy: string,
): Promise<EvidenceDocumentResolution> {
  const doc = await loadActiveDocument(orgId, documentId);
  if (!doc) return 'not_found';
  const [result] = await authorizeDocumentsForActor({
    organizationId: orgId,
    actor: { userId: submittedBy },
    documents: [{ id: doc.id, privacyLabel: doc.privacyLabel, linkedEntityType: null, linkedEntityId: null }],
  });
  return result.allowed ? 'resolved' : 'not_authorized';
}

/** System-level currentness only (no per-actor authorization) - used at bulk read time for every verified record. */
export async function documentCurrentlyResolves(orgId: string, documentId: string): Promise<boolean> {
  return (await loadActiveDocument(orgId, documentId)) !== null;
}
