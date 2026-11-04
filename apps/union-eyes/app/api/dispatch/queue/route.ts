/**
 * Dispatch Queue API
 *
 * GET /api/dispatch/queue — List the dispatch requests of the org that still need workers (open and partially filled)
 */

import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { listDispatchQueue } from "@/lib/services/dispatch-engine";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";

export const GET = withOrganizationAuth(async (_request, context) => {
  const { organizationId } = context;

  try {
    const canAccess = await hasMinRole("steward");
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires steward role or above");
    }

    const queue = await listDispatchQueue(organizationId);
    return standardSuccessResponse(queue);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to list dispatch queue");
  }
});
