/**
 * Clause Comparison API Route
 * POST /api/clauses/compare - Compare multiple clauses
 * GET /api/clauses/compare - List saved comparisons
 */

import { NextResponse } from "next/server";
import { 
  compareClausesInOrganization,
  saveClauseComparisonAudited
} from "@/lib/services/clause-audited-service";
import { z } from "zod";
import { withRoleAuth, type BaseAuthContext } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const clausesCompareSchema = z.object({
  clauseIds: z.array(z.string().uuid('Invalid clauseId')),
  analysisType: z.enum(['all', 'similarities', 'differences', 'best_practices']).optional().default("all"),
  save: z.boolean().optional().default(false),
  comparisonName: z.string().optional(),
  organizationId: z.string().uuid('Invalid organizationId').optional(),
});

export const POST = withRoleAuth('member', async (request, context: BaseAuthContext) => {
    const { userId, organizationId: contextOrganizationId } = context;
    if (!userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
    }
    if (!contextOrganizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'No active organization');
    }

  try {
      const body = await request.json();
    // Validate request body
    const validation = clausesCompareSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { clauseIds, analysisType = "all", save = false, comparisonName, organizationId } = validation.data;
  if (organizationId && organizationId !== contextOrganizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }


      if (!clauseIds || !Array.isArray(clauseIds) || clauseIds.length < 2) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'At least 2 clause IDs are required for comparison'
    );
      }

      if (clauseIds.length > 10) {
        return NextResponse.json(
          { error: "Maximum 10 clauses can be compared at once" },
          { status: 400 }
        );
      }

      // Perform comparison over the caller's organization only; a clause elsewhere is not found
      const result = await compareClausesInOrganization(contextOrganizationId, {
        clauseIds,
        analysisType
      });

      if (!result) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Clause not found');
      }

      // Optionally save the comparison
      if (save) {
        if (!comparisonName) {
          return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'comparisonName is required to save comparison'
    );
        }

        const clauseType = result.clauses[0]?.clauseType || "other";

        const savedComparison = await saveClauseComparisonAudited(
          { organizationId: contextOrganizationId, userId },
          {
            comparisonName,
            clauseType,
            clauseIds,
            analysisResults: {
              similarities: result.similarities,
              differences: result.differences,
              bestPractices: result.bestPractices,
              recommendations: result.recommendations
            },
          },
        );

        return NextResponse.json({ 
          ...result,
          savedComparison
        });
      }

      return NextResponse.json(result);
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});
