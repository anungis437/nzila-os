/**
 * AI Semantic Search API Route
 * 
 * POST /api/ai/semantic-search
 * Search clauses and precedents using semantic similarity
 */

import { NextResponse } from 'next/server';
import {
  semanticClauseSearch,
  semanticPrecedentSearch,
  unifiedSemanticSearch,
  findSimilarClauses,
} from '@/lib/services/ai/vector-search-service';
import { z } from "zod";
import { withApi } from '@/lib/api/framework';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';
import { count, eq } from 'drizzle-orm';
import { cbaClause, clauseTypeEnum } from '@/db/schema/cba-clauses-schema';
import { arbitrationPrecedents } from '@/db/schema/arbitration-precedents-schema';
import { VectorSearchUnavailableError } from '@/lib/ai/vector-readiness';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';

const semanticSearchSchema = z.object({
  query: z.string().max(1000, 'Query too long').optional(),
  searchType: z.enum(['clauses', 'precedents', 'unified', 'similar']).default('unified'),
  clauseId: z.guid().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
  // The filters the searches read, typed: an organization in the filters is never honoured, and a clause type that is not one of the enum's values is
  // refused here instead of reaching the database as an invalid enum input.
  filters: z.object({
    clauseType: z.array(z.enum(clauseTypeEnum.enumValues)).max(20).optional(),
    jurisdiction: z.string().max(100).optional(),
    sector: z.string().max(100).optional(),
    issueType: z.string().max(100).optional(),
    sameTypeOnly: z.boolean().optional(),
  }).prefault({}),
  hybridSearch: z.object({
    enabled: z.boolean().default(false),
    keywordWeight: z.number().min(0).max(1).default(0.3),
  }).default({ enabled: false, keywordWeight: 0.3 }),
}).refine((data) => {
  if (data.searchType !== 'similar' && !data.query) return false;
  if (data.searchType === 'similar' && !data.clauseId) return false;
  return true;
}, { message: 'Query required for non-similar searches, clauseId required for similar searches' });

// Each search reads in the organization's own context inside the service, after the embedding call has returned, so no transaction waits on the provider
// and the route does not set `rlsOrgContext`. The entitlement is checked here, not by the wrapper, to keep its answer (with the upgrade address) as it was.
export const POST = withApi(
  {
    auth: { minRole: 'member' },
    body: semanticSearchSchema,
    registry: { audience: 'member', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Semantic search over clauses and precedents' },
  },
  async ({ user, userId, organizationId, body }) => {
    // CRITICAL: Rate limit AI calls (expensive OpenAI API)
    const rateLimitResult = await checkRateLimit(
      `ai-completion:${userId}`,
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
    const entitlement = await checkEntitlement(organizationId as string, 'ai_semantic_search');
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

    // OWASP AI: Feature flag + AI safety gate
    const blocked = await guardAiFeature(AI_FEATURES.AI_SEMANTIC_SEARCH, { userId: userId!, organizationId: organizationId! });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'semantic-search', action: 'POST', organizationId, userId, userRole: user?.role ?? 'member', dataClass: 'internal' });

    try {
      const {
        query,
        searchType,
        clauseId,
        limit,
        threshold,
        filters,
        hybridSearch,
      } = body;

      // Clauses are searched in the caller's organization only; an organization in the filters is never honoured
      const callerOrganizationId = organizationId as string;
      const scopedFilters = { ...filters, organizationId: callerOrganizationId };

      let results;

      switch (searchType) {
        case 'clauses':
          results = await semanticClauseSearch(query!, {
            limit,
            threshold,
            filters: scopedFilters,
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
            organizationId: callerOrganizationId,
            limit,
            threshold,
            issueType: filters.issueType,
            jurisdiction: filters.jurisdiction,
          });
          return NextResponse.json({
            searchType: 'precedents',
            query,
            results,
            count: results.length,
          });

        case 'unified':
          results = await unifiedSemanticSearch(query!, {
            organizationId: callerOrganizationId,
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
            organizationId: callerOrganizationId,
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
      // pgvector is optional: a database without the extension, or with text embedding columns, answers that semantic search is not available (501), not a 500.
      if (error instanceof VectorSearchUnavailableError) {
        return standardErrorResponse(ErrorCode.NOT_IMPLEMENTED, error.message);
      }
      return NextResponse.json(
        {
          error: 'Semantic search failed',
        },
        { status: 500 }
      );
    }
  },
);

// The counts are read in the organization's own context, as counts: the rows (and their embeddings) are not loaded to be counted.
export const GET = withApi(
  {
    auth: { minRole: 'member' },
    registry: { audience: 'member', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Semantic search index status of the organization' },
  },
  async ({ userId, organizationId }) => {
    const blocked = await guardAiFeature(AI_FEATURES.AI_SEMANTIC_SEARCH, { userId: userId!, organizationId: organizationId! });
    if (blocked) return blocked;
    try {
      const counts = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
        const [clauseCounts] = await tx
          .select({ total: count(), withEmbeddings: count(cbaClause.embedding) })
          .from(cbaClause)
          .where(eq(cbaClause.organizationId, organizationId!));
        const [precedentCounts] = await tx
          .select({ total: count() })
          .from(arbitrationPrecedents)
          .where(eq(arbitrationPrecedents.sourceOrganizationId, organizationId!));
        return { clauseTotal: clauseCounts?.total ?? 0, clauseWithEmbed: clauseCounts?.withEmbeddings ?? 0, precedentTotal: precedentCounts?.total ?? 0 };
      });

      return NextResponse.json({
        status: counts.clauseWithEmbed > 0 ? 'ready' : 'pending',
        clauses: {
          total: counts.clauseTotal,
          withEmbeddings: counts.clauseWithEmbed,
          percentage: counts.clauseTotal > 0 ? Math.round((counts.clauseWithEmbed / counts.clauseTotal) * 100) : 0,
        },
        precedents: {
          total: counts.precedentTotal,
          withEmbeddings: 0,
          percentage: 0,
        },
      });
    } catch (error) {
      logger.error('Semantic search status check failed', { error });
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Status check failed'
      );
    }
  },
);
