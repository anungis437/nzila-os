import { NextResponse } from 'next/server';
/**
 * POST /api/ai/extract-clauses
 * Migrated to withApi() framework
 */
import { extractClausesFromPDF, batchExtractClauses } from '@/lib/services/ai/clause-extraction-service';

 
 
 
 
import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';

const aiExtractClausesSchema = z.object({
  pdfUrl: z.string().url('Invalid URL'),
  cbaId: z.string().uuid('Invalid cbaId'),
  organizationId: z.string().uuid('Invalid organizationId'),
  autoSave: z.boolean().default(true).optional(),
  batch: z.boolean().default(false).optional(),
  cbas: z.array(z.any()).default([]).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: aiExtractClausesSchema,
    rateLimit: RATE_LIMITS.AI_COMPLETION,
    openapi: {
      tags: ['Ai'],
      summary: 'POST extract-clauses',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId, user: _user, body, query: _query }) => {

          // Validate request body
          // DUPLICATE REMOVED (Phase 2): Multi-line destructuring of body
          // const {
          // pdfUrl,
          // cbaId,
          // organizationId,
          // autoSave = true,
          // batch = false,
          // cbas = [],
          // } = body;
          if (body.organizationId && body.organizationId !== organizationId) {
            throw ApiError.forbidden('Forbidden'
            );
          }
          // Batch extraction
          if (body.batch && body.cbas && body.cbas.length > 0) {
            const results = await batchExtractClauses(body.cbas, {
              autoSave: body.autoSave,
              concurrency: 3,
            });
            const resultsArray = Array.from(results.entries()).map(([cbaId, result]) => ({
              cbaId,
              ...result,
            }));
            return { batch: true,
              results: resultsArray,
              totalCBAs: body.cbas!.length,
              successfulExtractions: resultsArray.filter(r => r.success).length, };
          }
          // Single extraction
          if (!body.pdfUrl || !body.cbaId || !body.organizationId) {
            throw ApiError.badRequest('Missing required fields: pdfUrl, cbaId, organizationId'
            );
          }
          const result = await extractClausesFromPDF(body.pdfUrl, body.cbaId, {
            organizationId: body.organizationId,
            autoSave: body.autoSave,
          });
          return NextResponse.json({
            success: result.success,
            totalClauses: result.totalClauses,
            processingTime: result.processingTime,
            clauses: result.clauses,
            errors: result.errors,
          });
  },
);
