/**
 * AI Auto-Classification API Route
 * 
 * POST /api/ai/classify
 * Classify clauses and generate metadata using AI
 */

import { NextResponse } from 'next/server';
import {
  classifyClause,
  generateClauseTags,
  detectCrossReferences,
  classifyPrecedent,
  enrichClauseMetadata,
  batchClassifyClauses,
} from '@/lib/services/ai/auto-classification-service';
import { z } from "zod";
import { withApi } from '@/lib/api/framework';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const aiClassifySchema = z.object({
  action: z.enum(['classify-clause', 'generate-tags', 'detect-refs', 'classify-precedent', 'enrich', 'batch-classify']).default('classify-clause'),
  content: z.string().max(50000, 'Content too long').optional(),
  context: z.record(z.string(), z.unknown()).prefault({}),
  // One provider call is made per clause: the batch is bounded, and each clause is the shape the classifier reads.
  clauses: z.array(z.object({
    id: z.string().min(1).max(200),
    content: z.string().min(1).max(20_000),
    title: z.string().max(500).optional(),
    clauseNumber: z.string().max(100).optional(),
  })).max(100).default([]),
  caseTitle: z.string().max(500).optional(),
  facts: z.string().max(50_000).optional(),
  reasoning: z.string().max(50_000).optional(),
  decision: z.string().max(50_000).optional(),
});

// The classifiers read nothing from the database: the route has no tenant statement and sets no `rlsOrgContext`. The entitlement is checked here, not by the
// wrapper, to keep its answer (with the upgrade address) as it was; `requireOrg: false` keeps the answer for a caller with no organization (403, below).
export const POST = withApi(
  {
    auth: { minRole: 'member' },
    requireOrg: false,
    body: aiClassifySchema,
    registry: { audience: 'member', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Classify clauses and precedents with AI' },
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

    // CRITICAL: Check subscription entitlement for AI classify
    if (!organizationId) return NextResponse.json({ error: 'Organization context required' }, { status: 403 });
    const entitlement = await checkEntitlement(organizationId, 'ai_classify');
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

    const blocked = await guardAiFeature(AI_FEATURES.AI_EXTRACT_CLAUSES, { userId: userId!, organizationId });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'extract-clauses', action: 'POST', organizationId, userId, userRole: user?.role ?? 'member', dataClass: 'internal' });

    try {
      const {
        action,
        content,
        context: classificationContext,
        clauses,
        caseTitle,
        facts,
        reasoning,
        decision,
      } = body;

      return await performAuditedOperation({
        organizationId,
        userId: userId!,
        action: 'ai.classification.' + action,
        resourceType: 'ai_invocations',
      }, async () => {
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
      });
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return NextResponse.json(refused.body, { status: refused.status });
      return NextResponse.json(
        {
          error: 'Classification failed',
        },
        { status: 500 }
      );
    }
  },
);
