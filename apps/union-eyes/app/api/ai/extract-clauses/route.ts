/**
 * AI Clause Extraction API Route
 * 
 * POST /api/ai/extract-clauses
 * Extract clauses from CBA PDFs using AI
 */

import { NextResponse } from 'next/server';
import { extractClausesFromPDF, batchExtractClauses } from '@/lib/services/ai/clause-extraction-service';
import { z } from "zod";
import { withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
  import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
  import { AI_FEATURES } from '@/lib/services/feature-flags';
  import { enforceAISafety } from '@nzila/policies';

const aiExtractClausesSchema = z.object({
  pdfUrl: z.string().url('Invalid URL'),
  cbaId: z.string().uuid('Invalid cbaId'),
  organizationId: z.string().uuid('Invalid organizationId'),
  autoSave: z.boolean().default(true).optional(),
  batch: z.boolean().default(false).optional(),
  cbas: z.array(z.any()).default([]).optional(),
});

export const POST = withRoleAuth('member', async (request, context) => {
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

    // CRITICAL: Check subscription entitlement for AI extract-clauses
    const entitlement = await checkEntitlement(context.organizationId as string, 'ai_extract_clauses');
    if (!entitlement.allowed) {
      return NextResponse.json(
        { 
          error: entitlement.reason,
          upgradeUrl: entitlement.upgradeUrl,
          feature: 'ai_extract_clauses'
        },
        { status: 403 }
      );
    }

      // OWASP AI: Feature flag + AI safety gate
      const blocked = await guardAiFeature(AI_FEATURES.AI_EXTRACT_CLAUSES, { userId: context.userId, organizationId: context.organizationId });
      if (blocked) return blocked;
      enforceAISafety({ origin: 'extract-clauses', action: 'POST', organizationId: context.organizationId, userId: context.userId, userRole: 'member', dataClass: 'internal' });

    try {
      const body = await request.json();
      // Validate request body
      const validation = aiExtractClausesSchema.safeParse(body);
      if (!validation.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid request data',
          validation.error.errors
        );
      }
      
      const { pdfUrl, cbaId, organizationId, autoSave = true, batch = false, cbas = [] } = validation.data;
      // DUPLICATE REMOVED (Phase 2): Multi-line destructuring of body
      // const {
      // pdfUrl,
      // cbaId,
      // organizationId,
      // autoSave = true,
      // batch = false,
      // cbas = [],
      // } = body;
      if (organizationId && organizationId !== context.organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Forbidden'
        );
      }


      // Batch extraction
      if (batch && cbas.length > 0) {
        const results = await batchExtractClauses(cbas, {
          autoSave,
          concurrency: 3,
        });

        const resultsArray = Array.from(results.entries()).map(([cbaId, result]) => ({
          cbaId,
          ...result,
        }));

        return NextResponse.json({
          success: true,
          batch: true,
          results: resultsArray,
          totalCBAs: cbas.length,
          successfulExtractions: resultsArray.filter(r => r.success).length,
        });
      }

      // Single extraction
      if (!pdfUrl || !cbaId || !organizationId) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Missing required fields: pdfUrl, cbaId, organizationId'
        );
      }

      const result = await extractClausesFromPDF(pdfUrl, cbaId, {
        organizationId,
        autoSave,
      });

      return NextResponse.json({
        success: result.success,
        totalClauses: result.totalClauses,
        processingTime: result.processingTime,
        clauses: result.clauses,
        errors: result.errors,
      });
    } catch (error) {
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to extract clauses',
        error
      );
    }
});
