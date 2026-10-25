/**
 * Steward Recommendation API
 *
 * POST /api/grievances/[id]/recommend-steward — Get ranked steward recommendations
 */

import { withOrganizationAuth } from "@/lib/organization-middleware";
import { withRLSContext } from '@/lib/db/with-rls-context';
import { requireKernelCaseAction } from '@/lib/cases/case-authorization';
import { ApiError } from '@/lib/api/errors';
import { recommendSteward } from "@/lib/services/steward-assignment";
import { auditDataMutation } from "@/lib/audit-logger";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

export const POST = withOrganizationAuth(async (_request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    // Recommending who should take a case is part of assigning it: it needs the kernel's assignment authority.
    const caseId = params.id;
    await withRLSContext({ organizationId }, (tx) => requireKernelCaseAction(tx, { userId, organizationId }, caseId, 'case:assign'));

    const candidates = await recommendSteward(organizationId, params.id);

    await auditDataMutation({
      userId,
      organizationId,
      resource: "steward_recommendations",
      action: "create",
      resourceId: params.id,
      newState: { recommended: candidates.slice(0, 3).map((c) => c.stewardId) },
    });

    return standardSuccessResponse(candidates);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'FORBIDDEN') {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "The authority kernel did not authorize this recommendation.");
    }
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to recommend steward");
  }
});
