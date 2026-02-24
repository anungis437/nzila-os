import { NextResponse } from 'next/server';
/**
 * POST /api/clauses/compare
 * Migrated to withApi() framework
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
 
 
 
import { compareClauses, saveClauseComparison } from '@/lib/services/clause-service';

const clausesCompareSchema = z.object({
  clauseIds: z.array(z.string().uuid()),
  analysisType: z.enum(["all", "similarities", "differences", "best_practices"]).default("all"),
  save: z.boolean().optional().default(false),
  comparisonName: z.string().optional(),
  organizationId: z.string().uuid('Invalid organizationId'),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: clausesCompareSchema,
    openapi: {
      tags: ['Clauses'],
      summary: 'POST compare',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId, organizationId, user: _user, body, query: _query }) => {

          // Validate request body
        // DUPLICATE REMOVED (Phase 2): Multi-line destructuring of body
        // const { 
        // clauseIds, 
        // analysisType = "all",
        // save = false,
        // comparisonName,
        // organizationId
        // } = body;
      if (body.organizationId && body.organizationId !== organizationId) {
        throw ApiError.forbidden('Forbidden'
        );
      }
          if (!body.clauseIds || !Array.isArray(body.clauseIds) || body.clauseIds.length < 2) {
            throw ApiError.internal('At least 2 clause IDs are required for comparison'
        );
          }
          if (body.clauseIds.length > 10) {
            throw ApiError.badRequest('Maximum 10 clauses can be compared at once');
          }
          // Perform comparison
          const result = await compareClauses({
            clauseIds: body.clauseIds,
            analysisType: body.analysisType,
          });
          // Optionally save the comparison
          if (body.save) {
            if (!body.comparisonName || !organizationId) {
              throw ApiError.internal('comparisonName and organizationId are required to save comparison'
        );
            }
            const clauseType = result.clauses[0]?.clauseType || "other";
            const savedComparison = await saveClauseComparison(
              body.comparisonName,
              clauseType,
              body.clauseIds,
              organizationId, userId!,
              {
                similarities: result.similarities,
                differences: result.differences,
                bestPractices: result.bestPractices,
                recommendations: result.recommendations
              }
            );
            return NextResponse.json({ 
              ...result,
              savedComparison
            });
          }
          return { ...result };
  },
);
