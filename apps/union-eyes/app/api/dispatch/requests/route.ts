/**
 * Dispatch Requests API
 *
 * POST /api/dispatch/requests — Create a dispatch request (union_staff+)
 */

import { z } from "zod";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
import { createDispatchRequest } from "@/lib/services/dispatch-engine";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";

const requestSchema = z.object({
  employerId: z.string().uuid(),
  jobTitle: z.string().min(2).max(255),
  requiredSkills: z.array(z.string()).optional(),
  requestedWorkers: z.number().int().min(1).default(1),
  requestedDate: z.string().datetime().optional(),
});

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context;

  try {
    const canCreate = await hasMinRole("steward");
    if (!canCreate) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires steward role or above");
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }

    // The request and its audit record commit together.
    const row = await withRLSContext({ organizationId }, async (tx) => {
      const created = await createDispatchRequest(
        {
          orgId: organizationId,
          employerId: parsed.data.employerId,
          jobTitle: parsed.data.jobTitle,
          requiredSkills: parsed.data.requiredSkills ?? [],
          requestedWorkers: parsed.data.requestedWorkers,
          requestedDate: parsed.data.requestedDate
            ? new Date(parsed.data.requestedDate)
            : new Date(),
        },
        tx,
      );
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: "dispatch.request_create",
        resourceType: "dispatch_requests",
        resourceId: created.id,
        details: { employerId: created.employerId, jobTitle: created.jobTitle, requestedWorkers: created.requestedWorkers },
      });
      return created;
    });

    return standardSuccessResponse(row);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to create dispatch request");
  }
});
