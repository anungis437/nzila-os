/**
 * PATCH /api/exit-interviews/verified-dependencies/[id] — Review (verify/reject), re-verify or revoke dependency evidence
 *
 * Verifying an external citation, or re-verifying one, requires externalAttestation: the reviewer's own written
 * statement of how they checked the cited source (recorded under their identity). 'reverify' brings a verified record
 * that has become stale (renamed/re-classified node, changed alias, changed document, legacy fingerprint, missing
 * attestation) current again by re-attesting it against the graph and evidence as they stand now.
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
  reverifyVerifiedDependency,
  revokeVerifiedDependency,
  VerifiedDependencyInputError,
} from '@/lib/knowledge-transfer/propagation/verified-dependency-store';

export const dynamic = 'force-dynamic';

/** Senior enough to review or revoke dependency evidence - the same floor as governance reclassification approval. */
const VERIFIED_DEPENDENCY_REVIEWER_MIN_ROLE = 'national_officer';

const PatchSchema = z.object({
  action: z.enum(['verify', 'reject', 'revoke', 'reverify']),
  reviewNotes: z.string().max(1000).optional(),
  externalAttestation: z.string().trim().min(1).max(2000).optional(),
}).strict();

/** A correctable request (bad evidence, missing attestation) is 400; a node that no longer resolves, or resolves
 *  ambiguously, is a state conflict the reviewer must fix first (409). */
function toApiError(error: unknown): never {
  if (error instanceof VerifiedDependencyInputError) {
    if (error.code === 'node_not_current' || error.code === 'node_reference_ambiguous') throw ApiError.conflict(error.message, { code: error.code });
    throw ApiError.badRequest(error.message, { code: error.code });
  }
  throw error;
}

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'union_knowledge_suite',
    body: PatchSchema,
    openapi: {
      tags: ['Knowledge Transfer'],
      summary: 'Review or revoke dependency evidence',
      description: 'Verifies or rejects a pending submission, re-verifies a stale verified record, or revokes a verified record. Requires national_officer+ and a reviewer distinct from the submitter; verifying an external citation requires externalAttestation.',
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

    const attestation = body.externalAttestation ? { attestation: body.externalAttestation } : undefined;
    if (body.action === 'reverify') {
      const reverified = await reverifyVerifiedDependency(organizationId!, params.id, userId!, body.reviewNotes, attestation).catch(toApiError);
      if (!reverified) {
        throw ApiError.conflict('This record is not a stale verified record, was changed concurrently, or the reviewer must be a different identity than the submitter; reload and retry');
      }
      return { data: reverified };
    }

    const decision = body.action === 'verify' ? 'verified' : 'rejected';
    const reviewed = await reviewVerifiedDependency(organizationId!, params.id, decision, userId!, body.reviewNotes, attestation).catch(toApiError);
    if (!reviewed) {
      throw ApiError.conflict('This record is no longer pending review, has already been decided, or the reviewer must be a different identity than the submitter');
    }
    return { data: reviewed };
  },
);
