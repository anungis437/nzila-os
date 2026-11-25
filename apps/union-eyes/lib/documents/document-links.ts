import { and, eq } from 'drizzle-orm';
import { documentLinks } from '@/db/schema/documents-schema';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { isDocumentLinkWellFormed } from './case-link';

export interface DocumentLinkFact {
  linkedEntityType: string | null;
  linkedEntityId: string | null;
}

/** A document that names nothing is organization-level; it is judged once, with no link. */
export const UNLINKED_DOCUMENT: ReadonlyArray<DocumentLinkFact> = [{ linkedEntityType: null, linkedEntityId: null }];

/**
 * Every link a document holds, in one fixed order. A document can be attached to several cases; a decision made on whichever
 * row a join returned first would depend on physical row order, so consumers read all links and decide on all of them.
 */
export async function readDocumentLinks(tx: RLSTx, organizationId: string, documentId: string): Promise<ReadonlyArray<DocumentLinkFact>> {
  const rows = await tx
    .select({ linkedEntityType: documentLinks.linkedEntityType, linkedEntityId: documentLinks.linkedEntityId })
    .from(documentLinks)
    .where(and(eq(documentLinks.documentId, documentId), eq(documentLinks.organizationId, organizationId)))
    .orderBy(documentLinks.linkedEntityType, documentLinks.linkedEntityId);
  return rows.length > 0 ? rows : UNLINKED_DOCUMENT;
}

/** An unknown stored link type, or an identifier that is not a clean value, refuses the whole document. */
export const allDocumentLinksWellFormed = (links: ReadonlyArray<DocumentLinkFact>): boolean =>
  links.every((link) => isDocumentLinkWellFormed(link.linkedEntityType, link.linkedEntityId));
