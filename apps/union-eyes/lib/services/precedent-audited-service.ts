/**
 * Creation of an arbitration precedent. The precedent library is shared across tenants, but each decision is owned by the
 * organization that supplied it (source_organization_id), so the audit record is attributed to that organization and
 * commits with the insert in the same transaction.
 */
import { and, eq } from 'drizzle-orm';
import { arbitrationDecisions } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export type PrecedentInput = Omit<
  typeof arbitrationDecisions.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'embedding' | 'citationCount' | 'viewCount' | 'isPublic' | 'accessRestrictions' | 'importedFrom' | 'sourceOrganizationId'
>;

export async function createPrecedentAudited(
  scope: { organizationId: string; userId: string },
  data: PrecedentInput,
) {
  // A content manager may create a draft, not self-publish a shared decision. No review/owner-provenance
  // workflow is yet implemented for this shared table. Explicitly override its public-by-default schema.
  return withRLSContext({ organizationId: scope.organizationId, userId: scope.userId }, async (tx) => {
    const [precedent] = await tx.insert(arbitrationDecisions).values({
      ...data,
      isPublic: false,
      accessRestrictions: 'pending_review',
      // The decision is owned by the organization that supplies it (platform 0051); no other organization can change or delete it.
      sourceOrganizationId: scope.organizationId,
      // The supplying user stays on the row too, so a reviewer can see who typed it.
      importedFrom: `typed:${scope.organizationId}:${scope.userId}`.slice(0, 200),
    }).returning();
    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'precedent.create',
      resourceType: 'arbitration_decisions',
      resourceId: precedent.id,
      details: {
        caseNumber: precedent.caseNumber,
        tribunal: precedent.tribunal,
        publicationStatus: 'pending_review',
        sourceOrganizationId: scope.organizationId,
      },
    });
    return precedent;
  });
}

export type PrecedentReviewOutcome = 'share' | 'reject' | 'revoke';

export type PrecedentReviewResult =
  | { ok: true; precedent: typeof arbitrationDecisions.$inferSelect; publicationStatus: 'shared' | 'review_rejected' | 'sharing_revoked' }
  | { ok: false; kind: 'not_found' | 'not_pending' | 'self_review' | 'attestation_required' };

/** The user who typed the decision, from the provenance createPrecedentAudited records (typed:<organization>:<user>). */
export function precedentSubmitter(importedFrom: string | null | undefined): string | null {
  const match = /^typed:[0-9a-fA-F-]{36}:(.+)$/.exec(importedFrom ?? '');
  return match ? match[1] : null;
}

/**
 * Moves a typed decision out of pending_review: shared into the library (is_public, no restriction) or rejected (kept private, marked
 * review_rejected). The caller's reviewer authority is decided before this is called (lib/services/precedent-review-authority.ts). Runs in the
 * owning organization's tenant transaction; the reviewer must not be the person who typed it; sharing needs the reviewer's attestation that the text
 * is redacted and that consent or public status allows publication; the transition is conditional on the row still being pending, and its audit
 * record (the review provenance: who, when, what was attested) commits with it.
 */
export async function reviewPrecedentAudited(
  scope: { organizationId: string; userId: string },
  input: { id: string; outcome: PrecedentReviewOutcome; redactionConfirmed: boolean; consentConfirmed: boolean; notes?: string },
): Promise<PrecedentReviewResult> {
  if (input.outcome === 'share' && !(input.redactionConfirmed && input.consentConfirmed)) return { ok: false, kind: 'attestation_required' };
  return withRLSContext({ organizationId: scope.organizationId, userId: scope.userId }, async (tx) => {
    const [row] = await tx
      .select()
      .from(arbitrationDecisions)
      .where(and(eq(arbitrationDecisions.id, input.id), eq(arbitrationDecisions.sourceOrganizationId, scope.organizationId)))
      .limit(1);
    if (!row) return { ok: false as const, kind: 'not_found' as const };
    const revoking = input.outcome === 'revoke';
    if (revoking ? (!row.isPublic || Boolean(row.accessRestrictions)) : row.accessRestrictions !== 'pending_review') {
      return { ok: false as const, kind: 'not_pending' as const };
    }
    const submitter = precedentSubmitter(row.importedFrom);
    // A decision whose submitter is not on record cannot show its reviewer is someone else: refused, like a self-review.
    if (!submitter || submitter === scope.userId) return { ok: false as const, kind: 'self_review' as const };

    const shared = input.outcome === 'share';
    const publicationStatus = revoking ? 'sharing_revoked' : shared ? 'shared' : 'review_rejected';
    const [updated] = await tx
      .update(arbitrationDecisions)
      .set(shared
        ? { isPublic: true, accessRestrictions: null, updatedAt: new Date() }
        : { isPublic: false, accessRestrictions: revoking ? 'sharing_revoked' : 'review_rejected', updatedAt: new Date() })
      .where(and(
        eq(arbitrationDecisions.id, input.id),
        eq(arbitrationDecisions.sourceOrganizationId, scope.organizationId),
        revoking ? eq(arbitrationDecisions.isPublic, true) : eq(arbitrationDecisions.accessRestrictions, 'pending_review'),
      ))
      .returning();
    if (!updated) return { ok: false as const, kind: 'not_pending' as const };
    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: revoking ? 'precedent.review.revoked' : shared ? 'precedent.review.shared' : 'precedent.review.rejected',
      resourceType: 'arbitration_decisions',
      resourceId: updated.id,
      details: {
        caseNumber: updated.caseNumber,
        submittedBy: submitter,
        reviewedBy: scope.userId,
        redactionConfirmed: input.redactionConfirmed,
        consentConfirmed: input.consentConfirmed,
        notes: input.notes ?? null,
        sourceOrganizationId: scope.organizationId,
      },
    });
    return { ok: true as const, precedent: updated, publicationStatus };
  });
}
