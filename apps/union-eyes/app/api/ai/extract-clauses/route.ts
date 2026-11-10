/**
 * AI Clause Extraction API Route
 * 
 * POST /api/ai/extract-clauses
 * Extract clauses from CBA PDFs using AI
 */

import { NextResponse } from 'next/server';
import { extractClausesFromPDF, batchExtractClauses } from '@/lib/services/ai/clause-extraction-service';
import { z } from "zod";
import { withApi } from '@/lib/api/framework';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';
import { operationAuditResponse } from '@/lib/audit/operation-audit';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';

// Extraction stores clauses on an agreement and rewrites its text, so it is a steward-level action on the caller's own
// organization; the organization is never taken from the body.
const aiExtractClausesSchema = z.object({
  pdfUrl: z.string().url('Invalid URL').max(2048),
  cbaId: z.guid('Invalid cbaId'),
  organizationId: z.guid('Invalid organizationId').optional(),
  autoSave: z.boolean().optional(),
  batch: z.boolean().optional(),
  cbas: z
    .array(z.object({ id: z.guid('Invalid cba id'), documentUrl: z.string().url('Invalid URL').max(2048) }))
    .max(25)
    .optional(),
});

// The service reads and writes the agreement in the organization's own context (`withRLSContext`) and runs the provider outside it, so the route does not
// set `rlsOrgContext`. The entitlement is checked here, not by the wrapper, to keep its answer (with the upgrade address) as it was.
export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    body: aiExtractClausesSchema,
    registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Extract clauses from a CBA document with AI' },
  },
  async ({ user, userId, organizationId, body }) => {
    if (!organizationId || !userId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
    }

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

    // CRITICAL: Check subscription entitlement for AI extract-clauses
    const entitlement = await checkEntitlement(organizationId, 'ai_extract_clauses');
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
    const blocked = await guardAiFeature(AI_FEATURES.AI_EXTRACT_CLAUSES, { userId, organizationId });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'extract-clauses', action: 'POST', organizationId, userId, userRole: user?.role ?? 'steward', dataClass: 'confidential' });

    try {
      const { pdfUrl, cbaId, organizationId: requestedOrganizationId, autoSave = true, batch = false, cbas = [] } = body;
      if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Forbidden'
        );
      }

      // Batch extraction
      if (batch && cbas.length > 0) {
        const results = await batchExtractClauses(cbas, {
          organizationId,
          userId,
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
      const result = await extractClausesFromPDF(pdfUrl, cbaId, {
        organizationId,
        userId,
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
      const refused = operationAuditResponse(error);
      if (refused) return standardErrorResponse(ErrorCode.CONFLICT, refused.body.error.message);
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to extract clauses',
        error
      );
    }
  },
);
