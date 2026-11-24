import { and, eq } from 'drizzle-orm';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { claims } from '@/db/schema/claims-schema';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { isCaseDocumentLinkType, isDocumentLinkWellFormed } from './case-link';

/** Resolve a stored link's case meaning before an organization-level document
 * rule is applied. Legacy non-case labels sometimes name an actual grievance
 * or claim; that spelling must not remove the case's authority boundary. */
export async function resolveDocumentCaseId(
  tx: Pick<RLSTx, 'select'>,
  input: { organizationId: string; linkedEntityType?: string | null; linkedEntityId?: string | null },
): Promise<string | null> {
  if (!isDocumentLinkWellFormed(input.linkedEntityType, input.linkedEntityId))
    throw new Error('DOCUMENT_LINK_INVALID');
  if (!input.linkedEntityId) return null;
  if (isCaseDocumentLinkType(input.linkedEntityType)) return input.linkedEntityId;
  const [caseRow] = await tx.select({ id: grievances.id }).from(grievances)
    .where(and(eq(grievances.organizationId, input.organizationId), eq(grievances.id, input.linkedEntityId)))
    .limit(1);
  if (caseRow) return caseRow.id;
  const [claimRow] = await tx.select({ id: claims.claimId }).from(claims)
    .where(and(eq(claims.organizationId, input.organizationId), eq(claims.claimId, input.linkedEntityId)))
    .limit(1);
  return claimRow?.id ?? null;
}
