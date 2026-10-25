/**
 * Creation of an arbitration precedent. The precedent library is shared across tenants (it has no organization
 * column), so the audit record is attributed to the organization the platform administrator is acting in, and the
 * record commits with the insert in the same transaction.
 */
import { arbitrationDecisions } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export type PrecedentInput = Omit<
  typeof arbitrationDecisions.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'embedding' | 'citationCount' | 'viewCount' | 'isPublic' | 'accessRestrictions' | 'importedFrom'
>;

export async function createPrecedentAudited(
  scope: { organizationId: string; userId: string },
  data: PrecedentInput,
) {
  return withRLSContext({ organizationId: scope.organizationId }, async (tx) => {
    const [precedent] = await tx.insert(arbitrationDecisions).values(data).returning();
    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'precedent.create',
      resourceType: 'arbitration_decisions',
      resourceId: precedent.id,
      details: { caseNumber: precedent.caseNumber, tribunal: precedent.tribunal },
    });
    return precedent;
  });
}
