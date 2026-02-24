/**
 * AI Semantic Search API Route
 * 
 * POST /api/ai/semantic-search
 * Search clauses and precedents using semantic similarity
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  semanticClauseSearch,
  semanticPrecedentSearch,
  unifiedSemanticSearch,
  findSimilarClauses,
} from '@/lib/services/ai/vector-search-service';
import { z } from "zod";
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

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
export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
    const _user = { id: context.userId, organizationId: context.organizationId };

    // CRITICAL: Rate limit AI calls (expensive OpenAI API)
    const rateLimitResult = await checkRateLimit(
      `ai-completion:${context.userId}`,
      RATE_LIMITS.AI_COMPLETION
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for AI operations. Please try again later.' },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      );
    }

    // CRITICAL: Check subscription entitlement for AI semantic-search
    const entitlement = await checkEntitlement(context.organizationId as string, 'ai_semantic_search');
    if (!entitlement.allowed) {
      return NextResponse.json(
        { 
          error: entitlement.reason,
          upgradeUrl: entitlement.upgradeUrl,
          feature: 'ai_semantic_search'
        },
        { status: 403 }
      );
    }

    try {
      const body = await request.json();
      
      // Validate request body
      const validation = semanticSearchSchema.safeParse(body);
      if (!validation.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid semantic search request',
          validation.error.errors
        );
      }

      const {
        query,
        searchType,
        clauseId,
        limit,
        threshold,
        filters,
        hybridSearch,
      } = validation.data;

      let results;

      switch (searchType) {
        case 'clauses':
          results = await semanticClauseSearch(query!, {
            limit,
            threshold,
            filters,
            hybridSearch,
          });
          return NextResponse.json({
            searchType: 'clauses',
            query,
            results,
            count: results.length,
          });

        case 'precedents':
          results = await semanticPrecedentSearch(query!, {
            limit,
            threshold,
            issueType: filters.issueType as string | undefined,
            jurisdiction: filters.jurisdiction as string | undefined,
          });
          return NextResponse.json({
            searchType: 'precedents',
            query,
            results,
            count: results.length,
          });

        case 'unified':
          results = await unifiedSemanticSearch(query!, {
            includeClauses: true,
            includePrecedents: true,
            limit,
            threshold,
          });
          return NextResponse.json({
            searchType: 'unified',
            query,
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
            sameTypeOnly: Boolean(filters.sameTypeOnly),
          });
          return NextResponse.json({
            searchType: 'similar',
            clauseId,
            results,
            count: results.length,
          });

        default:
          return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid searchType. Use: clauses, precedents, unified, or similar'
    );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Semantic search failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
});

export const GET = withRoleAuth('member', async (_request: NextRequest, _context: BaseAuthContext) => {
  try {
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
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Status check failed',
      error
    );
  }
});

