/**
 * PATCH /api/exit-interviews/verified-dependencies/[id] — Review (verify/reject) or revoke dependency evidence
 *
 * Review and revocation are senior, distinct-reviewer actions - never the submitter, and never the same identity
 * twice. See lib/knowledge-transfer/propagation/verified-dependency-store.ts for the conditional-update semantics
 * that make a review or revoke exactly-once and race-safe (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-
 * INFERRED-FROM-TAG-CO-OCCURRENCE).
 *
 * Requires: national_officer+ (the same reviewer floor as governance reclassification approval), and never the
 * original submitter.
 * Entitlement: union_knowledge_suite
 */

import { z } from 'zod';
import { withApi, ApiError } from '@/lib/api/framework';
import { hasMinRole } from '@/lib/api-auth-guard';
import {
  reviewVerifiedDependency,
  revokeVerifiedDependency,
} from '@/lib/knowledge-transfer/propagation/verified-dependency-store';

export const dynamic = 'force-dynamic';

/** Senior enough to review or revoke dependency evidence - the same floor as governance reclassification approval. */
const VERIFIED_DEPENDENCY_REVIEWER_MIN_ROLE = 'national_officer';

const PatchSchema = z.object({
  action: z.enum(['verify', 'reject', 'revoke']),
  reviewNotes: z.string().max(1000).optional(),
}).strict();

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: PatchSchema,
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Review or revoke dependency evidence',
      description: 'Verifies, rejects a pending submission, or revokes a currently-verified record. Requires national_officer+ and a reviewer distinct from the submitter.',
    },
  },
  async ({ params, organizationId, userId, body }) => {
    if (!(await hasMinRole(VERIFIED_DEPENDENCY_REVIEWER_MIN_ROLE))) {
      throw ApiError.forbidden(`Reviewing dependency evidence requires at least ${VERIFIED_DEPENDENCY_REVIEWER_MIN_ROLE}`);
    }

    if (body.action === 'revoke') {
      const revoked = await revokeVerifiedDependency(organizationId!, params.id, userId!, body.reviewNotes);
      if (!revoked) throw ApiError.conflict('This record is not currently verified, or no longer exists; reload and retry');
      return { data: revoked };
    }

    const decision = body.action === 'verify' ? 'verified' : 'rejected';
    const reviewed = await reviewVerifiedDependency(organizationId!, params.id, decision, userId!, body.reviewNotes);
    if (!reviewed) {
      throw ApiError.conflict('This record is no longer pending review, has already been decided, or the reviewer must be a different identity than the submitter');
    }
    return { data: reviewed };
  },
);
