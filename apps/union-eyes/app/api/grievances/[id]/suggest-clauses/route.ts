/**
 * Suggest Clauses API
 *
 * POST /api/grievances/[id]/suggest-clauses — Find relevant CBA clauses for a grievance
 */

import { z } from "zod";
import { db } from "@/db/db";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { withOrganizationAuth } from "@/lib/organization-middleware";
import { hasMinRole } from "@/lib/api-auth-guard";
import { auditDataMutation } from "@/lib/audit-logger";
import {
  findRelevantClauses,
  linkClauseToGrievance,
} from "@/lib/services/clause-intelligence";
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from "@/lib/api/standardized-responses";
import { eq, and } from "drizzle-orm";
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

const _linkSchema = z.object({
  clauseId: z.string().uuid(),
}).optional();

export const POST = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  try {
    if (!params?.id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Missing ID");
    const canAccess = await hasMinRole("steward");
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "Requires steward role or above");
    }

    // Fetch grievance
    const [grievance] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, params.id),
          eq(grievances.organizationId, organizationId),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }

    const body = await request.json().catch(() => ({}));

    // If clauseId provided, link it
    if (body?.clauseId) {
      const result = await linkClauseToGrievance(params.id, body.clauseId);

      await auditDataMutation({
        userId,
        organizationId,
        resource: "clause_link",
        action: "create",
        resourceId: params.id,
        newState: result,
      });

      return standardSuccessResponse(result);
    }

    // Otherwise, suggest relevant clauses
    const suggestions = await findRelevantClauses(
      organizationId,
      grievance.description,
    );

    return standardSuccessResponse(suggestions);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, "Failed to suggest clauses");
  }
});
