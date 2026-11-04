/**
 * Steward Recommendation API
 *
 * POST /api/grievances/[id]/recommend-steward — Get ranked steward recommendations
 */

import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { requireKernelCaseAction } from '@/lib/cases/case-authorization';
import { recommendSteward } from "@/lib/services/steward-assignment";
import { auditDataMutation } from "@/lib/audit-logger";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";

export const POST = withApi(
  {
    auth: { required: true },
    entitlement: 'grievance_case_suite',
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'Recommend stewards for a grievance' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    const caseId = params.id;
    if (!caseId || !zUUID.safeParse(caseId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid grievance ID");
    }

    let candidates;
    try {
      candidates = await withRLSContext({ organizationId }, async (tx) => {
        // Recommending who should take a case is part of assigning it: it needs the kernel's assignment authority.
        await requireKernelCaseAction(tx, { userId, organizationId }, caseId, 'case:assign');
        return recommendSteward(organizationId, caseId, tx);
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'FORBIDDEN') {
        return standardErrorResponse(ErrorCode.FORBIDDEN, "The authority kernel did not authorize this recommendation.");
      }
      throw error;
    }

    await auditDataMutation({
      userId,
      organizationId,
      resource: "steward_recommendations",
      action: "create",
      resourceId: caseId,
      newState: { recommended: candidates.slice(0, 3).map((c) => c.stewardId) },
    });

    return standardSuccessResponse(candidates);
  },
);
