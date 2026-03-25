/**
 * Steward Recommendation API
 *
 * POST /api/grievances/[id]/recommend-steward — Get ranked steward recommendations
 */

import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
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
    const canRecommend = await hasMinRole("steward");
    if (!canRecommend) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires steward role or above");
    }

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
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to recommend steward");
  }
});
