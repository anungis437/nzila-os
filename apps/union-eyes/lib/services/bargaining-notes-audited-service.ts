/**
 * Bargaining-note creation. The note is stored for the caller's organization only, an agreement it references must
 * belong to that organization, and the record is committed with its audit entry in the same transaction.
 */
import { and, eq } from 'drizzle-orm';
import { bargainingNotes, collectiveAgreements } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export type BargainingNote = typeof bargainingNotes.$inferSelect;
export type BargainingNoteInput = Omit<
  typeof bargainingNotes.$inferInsert,
  'id' | 'organizationId' | 'createdBy' | 'lastModifiedBy' | 'createdAt' | 'updatedAt' | 'embedding' | 'keyInsights' | 'attachments'
>;

export class ForeignAgreementError extends Error {
  constructor() {
    super('The referenced agreement was not found in this organization.');
    this.name = 'ForeignAgreementError';
  }
}

export async function createBargainingNoteAudited(
  scope: { organizationId: string; userId: string },
  data: BargainingNoteInput,
): Promise<BargainingNote> {
  return withRLSContext({ organizationId: scope.organizationId }, async (tx) => {
    if (data.cbaId) {
      const [agreement] = await tx
        .select({ id: collectiveAgreements.id })
        .from(collectiveAgreements)
        .where(and(eq(collectiveAgreements.id, data.cbaId), eq(collectiveAgreements.organizationId, scope.organizationId)))
        .limit(1);
      if (!agreement) throw new ForeignAgreementError();
    }

    const [note] = await tx
      .insert(bargainingNotes)
      .values({
        ...data,
        organizationId: scope.organizationId,
        createdBy: scope.userId,
        lastModifiedBy: scope.userId,
      })
      .returning();

    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'bargaining_note.create',
      resourceType: 'bargaining_notes',
      resourceId: note.id,
      details: { cbaId: data.cbaId ?? null, sessionType: data.sessionType, confidentialityLevel: note.confidentialityLevel },
    });
    return note;
  });
}
