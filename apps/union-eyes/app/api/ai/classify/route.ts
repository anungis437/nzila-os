/**
 * AI Auto-Classification API Route
 * 
 * POST /api/ai/classify
 * Classify clauses and generate metadata using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  classifyClause,
  generateClauseTags,
  detectCrossReferences,
  classifyPrecedent,
  enrichClauseMetadata,
  batchClassifyClauses,
} from '@/lib/services/ai/auto-classification-service';
import { z } from "zod";
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const aiClassifySchema = z.object({
  action: z.enum(['classify-clause', 'generate-tags', 'detect-refs', 'classify-precedent', 'enrich', 'batch-classify']).default('classify-clause'),
  content: z.string().max(50000, 'Content too long').optional(),
  context: z.record(z.string(), z.unknown()).default({}),
  clauses: z.array(z.any()).default([]),
  caseTitle: z.string().optional(),
  facts: z.string().optional(),
  reasoning: z.string().optional(),
  decision: z.string().optional(),
});
export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
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

    // CRITICAL: Check subscription entitlement for AI classify
    const entitlement = await checkEntitlement(context.organizationId!, 'ai_classify');
    if (!entitlement.allowed) {
      return NextResponse.json(
        { 
          error: entitlement.reason,
          upgradeUrl: entitlement.upgradeUrl,
          feature: 'ai_classify'
        },
        { status: 403 }
      );
    }

    try {
      const body = await request.json();
      
      // Validate request body
      const validation = aiClassifySchema.safeParse(body);
      if (!validation.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid classification request',
          validation.error.errors
        );
      }

      const {
        action,
        content,
        context: classificationContext,
        clauses,
        caseTitle,
        facts,
        reasoning,
        decision,
      } = validation.data;

      switch (action) {
        case 'classify-clause':
          if (!content) {
            return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Content is required'
    );
          }
          const classification = await classifyClause(content, classificationContext);
          return NextResponse.json({
            action: 'classify-clause',
            classification,
          });

        case 'generate-tags':
          if (!content) {
            return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Content is required'
    );
          }
          if (!classificationContext.clauseType) {
            return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'clauseType is required in context'
    );
          }
          const tags = await generateClauseTags(content, classificationContext.clauseType as Parameters<typeof generateClauseTags>[1]);
          return NextResponse.json({
            action: 'generate-tags',
            tags,
          });

        case 'detect-refs':
          if (!content) {
            return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Content is required'
    );
          }
          const crossReferences = await detectCrossReferences(content);
          return NextResponse.json({
            action: 'detect-refs',
            crossReferences,
          });

        case 'classify-precedent':
          if (!caseTitle || !facts || !reasoning || !decision) {
            return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'caseTitle, facts, reasoning, and decision are required'
    );
          }
          const precedentClass = await classifyPrecedent(caseTitle, facts, reasoning, decision);
          return NextResponse.json({
            action: 'classify-precedent',
            classification: precedentClass,
          });

        case 'enrich':
          if (!content) {
            return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Content is required'
    );
          }
          const enriched = await enrichClauseMetadata(content, classificationContext);
          return NextResponse.json({
            action: 'enrich',
            enrichment: enriched,
          });

        case 'batch-classify':
          if (!clauses || clauses.length === 0) {
            return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Clauses array is required and must not be empty'
    );
          }
          
          let completed = 0;
          const total = clauses.length;
          
          const batchResults = await batchClassifyClauses(clauses, {
            concurrency: 5,
            onProgress: (comp, _tot) => {
              completed = comp;
            },
          });

          const resultsArray = Array.from(batchResults.entries()).map(([id, result]) => ({
            id,
            ...result,
          }));

          return NextResponse.json({
            action: 'batch-classify',
            total,
            completed,
            results: resultsArray,
          });

        default:
          return NextResponse.json(
            {
              error: 'Invalid action. Use: classify-clause, generate-tags, detect-refs, classify-precedent, enrich, or batch-classify',
            },
            { status: 400 }
          );
      }
    } catch (error) {
return NextResponse.json(
        {
          error: 'Classification failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
});

