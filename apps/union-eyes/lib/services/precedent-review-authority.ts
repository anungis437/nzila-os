/**
 * Who may review a typed arbitration decision and move it from pending_review into the shared precedent library
 * (DEF-0B11-PRP-PRECEDENT-POST-PUBLISHES-INTO-THE-SHARED-LIBRARY-WITH-NO-REVIEW-PROVENANCE-OR-OWNING-ORGANIZATION).
 *
 * Sharing a decision publishes it to every organization (cache 0041: is_public with no access restriction), so the reviewer confirms that the text is
 * redacted and that the parties' consent or the decision's public status allows it. Who holds that power is an institutional decision that has not been
 * made: a role title (content manager, administrator, platform staff) is not authority to publish one organization's material to all of them, and the
 * authority kernel (lib/authority/*) has no resource type or mandate for it. Until it is decided and built, no one holds it: this answers denied for
 * every caller, and the review route refuses (fail closed). The rest of the workflow (attestation, a reviewer other than the submitter, the transition
 * under a row condition, the audit record in the same transaction) is in place behind this check.
 */
export interface PrecedentReviewerAuthority {
  allowed: boolean
  reason: 'reviewer_authority_not_designated' | 'allowed'
}

export async function resolvePrecedentReviewerAuthority(_scope: { organizationId: string; userId: string }): Promise<PrecedentReviewerAuthority> {
  return { allowed: false, reason: 'reviewer_authority_not_designated' }
}
