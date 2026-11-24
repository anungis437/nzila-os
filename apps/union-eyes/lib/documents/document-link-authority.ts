import { and, eq } from 'drizzle-orm';
import { grievances } from '@/db/schema/domains/claims/grievances';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { isCaseDocumentLinkType, isDocumentLinkWellFormed } from './case-link';

/** Resolve a stored link's case meaning before an organization-level document
 * rule is applied. Legacy non-case labels sometimes name an actual grievance;
 * that spelling must not remove the grievance's authority boundary. */
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
  return caseRow?.id ?? null;
}
