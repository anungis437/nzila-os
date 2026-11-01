import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { db } from '@/db';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
  import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
  import { AI_FEATURES } from '@/lib/services/feature-flags';
  import { enforceAISafety } from '@nzila/policies';
/**
 * GET /api/ml/monitoring/metrics
 * 
 * Returns real-time model performance metrics across all AI models:
 * - Claim Outcome Prediction
 * - Timeline Forecasting
 * - Churn Risk Prediction
 * - Smart Assignment
 * - Legal Precedent Search
 * 
 * Response:
 * {
 *   models: [{
 *     modelName: string,
 *     accuracy: number,      // 0-1 scale
 *     precision: number,     // 0-1 scale
 *     recall: number,        // 0-1 scale
 *     f1Score: number,       // 0-1 scale
 *     predictions24h: number,
 *     avgConfidence: number, // 0-1 scale
 *     lastUpdated: string,
 *     status: 'healthy' | 'warning' | 'critical',
 *     trend: 'up' | 'down' | 'stable'
 *   }],
 *   timestamp: string
 * }
 */
export const GET = withRoleAuth('member', async (request: NextRequest, context) => {
  const { userId, organizationId } = context;

  // Rate limit monitoring reads
  const rateLimitResult = await checkRateLimit(
    `ml-predictions:${userId}`,
    RATE_LIMITS.ML_PREDICTIONS
  );

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded for ML operations. Please try again later.' },
      { 
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult)
      }
    );
  }

    // OWASP AI: Org presence check + feature flag + AI safety gate
    if (!organizationId) {
      return NextResponse.json({ error: 'No active organization' }, { status: 400 });
    }
    const blocked = await guardAiFeature(AI_FEATURES.ML_MONITORING, { userId, organizationId });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'ml-monitoring-metrics', action: 'GET', organizationId, userId, userRole: 'member', dataClass: 'internal' });

  try {
      const organizationScopeId = organizationId;

    // Model metadata and predictions are organization-scoped. The schema stores
    // forecast values and model accuracy, not evaluated precision/recall/F1 or
    // ground-truth prediction correctness. Never fabricate those measurements.
    const modelMetrics = await db.execute(sql`
      SELECT
        mm.model_type AS model_name,
        mm.accuracy,
        mm.trained_at AS last_evaluated_at,
        (SELECT count(*)::int FROM ml_predictions mp
         WHERE mp.organization_id = mm.organization_id
           AND mp.prediction_type = mm.model_type
           AND mp.created_at >= now() - interval '24 hours') AS predictions_24h,
        (SELECT avg(mp.confidence)::numeric FROM ml_predictions mp
         WHERE mp.organization_id = mm.organization_id
           AND mp.prediction_type = mm.model_type
           AND mp.created_at >= now() - interval '24 hours') AS avg_confidence
      FROM model_metadata mm
      WHERE mm.organization_id = ${organizationScopeId}::uuid
      ORDER BY mm.model_type, mm.trained_at DESC
    `);

    const models = Array.from(modelMetrics as Iterable<Record<string, unknown>>).map(row => ({
      modelName: row.model_name,
      accuracy: row.accuracy == null ? null : Number(row.accuracy),
      precision: null,
      recall: null,
      f1Score: null,
      predictions24h: Number(row.predictions_24h ?? 0),
      avgConfidence: row.avg_confidence == null ? null : Number(row.avg_confidence),
      lastUpdated: row.last_evaluated_at ?? null,
      status: 'not_evaluated' as const,
      trend: 'unknown' as const,
    }));

    return NextResponse.json({
      models,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch model metrics',
      error
    );
  }
});

