import { NextResponse } from 'next/server';
/**
 * GET POST /api/ai/semantic-search
 * Migrated to withApi() framework
 */
import { semanticClauseSearch, semanticPrecedentSearch, unifiedSemanticSearch, findSimilarClauses } from '@/lib/services/ai/vector-search-service';

 
 
 
 
 
 
 
 
 
 
 
import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';

const semanticSearchSchema = z.object({
  query: z.string().max(1000, 'Query too long').optional(),
  searchType: z.enum(['clauses', 'precedents', 'unified', 'similar']).default('unified'),
  clauseId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
  filters: z.record(z.string(), z.unknown()).default({}),
  hybridSearch: z.object({
    enabled: z.boolean().default(false),
    keywordWeight: z.number().min(0).max(1).default(0.3),
  }).default({ enabled: false, keywordWeight: 0.3 }),
}).refine((data) => {
  if (data.searchType !== 'similar' && !data.query) return false;
  if (data.searchType === 'similar' && !data.clauseId) return false;
  return true;
}, { message: 'Query required for non-similar searches, clauseId required for similar searches' });

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Ai'],
      summary: 'GET semantic-search',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

          // This would query database to check how many clauses/precedents have embeddings
          // For now, return a placeholder response
          return NextResponse.json({
            status: 'ready',
            clauses: {
              total: 0,
              withEmbeddings: 0,
              percentage: 0,
            },
            precedents: {
              total: 0,
              withEmbeddings: 0,
              percentage: 0,
            },
          });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: semanticSearchSchema,
    rateLimit: RATE_LIMITS.AI_COMPLETION,
    openapi: {
      tags: ['Ai'],
      summary: 'POST semantic-search',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query }) => {

          // Validate request body
          const { searchType, query: searchQuery, limit, threshold, filters, hybridSearch, clauseId } = body;
          let results;
          switch (searchType) {
            case 'clauses':
              results = await semanticClauseSearch(searchQuery!, {
                limit,
                threshold,
                filters,
                hybridSearch,
              });
              return NextResponse.json({
                searchType: 'clauses',
                query: searchQuery,
                results,
                count: results.length,
              });
            case 'precedents':
              results = await semanticPrecedentSearch(searchQuery!, {
                limit,
                threshold,
                issueType: filters.issueType as string | undefined,
                jurisdiction: filters.jurisdiction as string | undefined,
              });
              return NextResponse.json({
                searchType: 'precedents',
                query: searchQuery,
                results,
                count: results.length,
              });
            case 'unified':
              results = await unifiedSemanticSearch(searchQuery!, {
                includeClauses: true,
                includePrecedents: true,
                limit,
                threshold,
              });
              return NextResponse.json({
                searchType: 'unified',
                query: searchQuery,
                clauses: results.clauses,
                precedents: results.precedents,
                combined: results.combined,
                counts: {
                  clauses: results.clauses.length,
                  precedents: results.precedents.length,
                  total: results.combined.length,
                },
              });
            case 'similar':
              results = await findSimilarClauses(clauseId!, {
                limit,
                threshold,
                sameTypeOnly: (filters.sameTypeOnly as boolean) || false,
              });
              return NextResponse.json({
                searchType: 'similar',
                clauseId,
                results,
                count: results.length,
              });
            default:
              throw ApiError.badRequest('Invalid searchType. Use: clauses, precedents, unified, or similar'
        );
          }
  },
);
