/**
 * Suggest Clauses API
 *
 * POST /api/grievances/[id]/suggest-clauses — Find relevant CBA clauses for a grievance
 */

import { z } from "zod";
import { db } from "@/db/db";
import { grievances } from "@/db/schema/domains/claims/grievances";
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from "@/lib/db/with-rls-context";
import { persistAtomicAudit } from "@/lib/audit/atomic-audit";
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
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { productionGrievanceCondition } from '@/lib/pilot/demo-provenance';

// The body is optional: no body suggests clauses for the grievance's own description, a description searches with that text, a clauseId links that clause.
const bodySchema = z.object({
  clauseId: z.guid().optional(),
  description: z.string().trim().min(1).max(4000).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    // The grievance and the clauses are read through the ambient handle, so the handler runs in the caller's organization transaction.
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'Suggest or link collective-agreement clauses for a grievance' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    const grievanceId = params.id;
    if (!grievanceId || !zUUID.safeParse(grievanceId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid grievance ID");
    }

    // Fetch grievance
    const [grievance] = await db
      .select()
      .from(grievances)
      .where(
        and(
          eq(grievances.id, grievanceId),
          eq(grievances.organizationId, organizationId),
          productionGrievanceCondition(),
        ),
      );

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, "Grievance not found");
    }

    // Seniority does not open a case: the matter's content feeds this analysis, so a case relationship is required.
    const relationship = await getEffectiveCaseAccess({ organizationId, grievanceId, userId });
    if (grievance.createdBy !== userId && !relationship.canViewCase) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, "You do not have access to this grievance");
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})) ?? {});
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, "Invalid input", parsed.error.flatten());
    }
    const clauseId = parsed.data.clauseId;

    // If clauseId provided, link it
    if (clauseId) {
      if (!relationship.isPrimaryOwner && !relationship.canDraftActions) {
        return standardErrorResponse(ErrorCode.FORBIDDEN, "You do not have permission to change this case");
      }
      // The CBA link and its audit record commit together.
      const result = await withRLSContext({ organizationId }, async (tx) => {
        const linked = await linkClauseToGrievance(grievanceId, clauseId, organizationId, tx);
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'grievance.link_clause',
          resourceType: 'grievances',
          resourceId: grievanceId,
          details: { clauseId },
        });
        return linked;
      });

      return standardSuccessResponse(result);
    }

    // Otherwise, suggest relevant clauses: for the text the person typed, else for the grievance's own description
    const suggestions = await findRelevantClauses(
      organizationId,
      parsed.data.description ?? grievance.description,
    );

    return standardSuccessResponse(suggestions);
  },
);
