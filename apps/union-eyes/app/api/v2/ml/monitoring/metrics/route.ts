import { NextResponse } from 'next/server';
/**
 * GET /api/ml/monitoring/metrics
 * Migrated to withApi() framework
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db';
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Ml'],
      summary: 'GET metrics',
    },
  },
  async ({ request: _request, userId, organizationId, user: _user, body: _body, query: _query }) => {

        const organizationScopeId = organizationId || userId;
        // Query model performance metrics from analytics tables
        // Build on existing analytics_scheduled_reports and benchmark_data tables
        const modelMetrics = await db.execute(sql`
          WITH recent_predictions AS (
            -- Get predictions from last 24 hours across all models
            SELECT 
              'Claim Outcome Prediction' as model_name,
              COUNT(*) as predictions_count,
              AVG(CASE WHEN prediction_correct THEN 1.0 ELSE 0.0 END) as accuracy,
              AVG(confidence) as avg_confidence
            FROM ml_predictions
            WHERE organization_id = ${organizationScopeId}
              AND prediction_type = 'claim_outcome'
              AND predicted_at >= NOW() - INTERVAL '24 hours'
            UNION ALL
            SELECT 
              'Timeline Forecasting' as model_name,
              COUNT(*) as predictions_count,
              AVG(CASE WHEN prediction_correct THEN 1.0 ELSE 0.0 END) as accuracy,
              AVG(confidence) as avg_confidence
            FROM ml_predictions
            WHERE organization_id = ${organizationScopeId}
              AND prediction_type = 'timeline'
              AND predicted_at >= NOW() - INTERVAL '24 hours'
            UNION ALL
            SELECT 
              'Churn Risk Prediction' as model_name,
              COUNT(*) as predictions_count,
              AVG(CASE WHEN prediction_correct THEN 1.0 ELSE 0.0 END) as accuracy,
              AVG(confidence) as avg_confidence
            FROM ml_predictions
            WHERE organization_id = ${organizationScopeId}
              AND prediction_type = 'churn_risk'
              AND predicted_at >= NOW() - INTERVAL '24 hours'
            UNION ALL
            SELECT 
              'Smart Assignment' as model_name,
              COUNT(*) as predictions_count,
              AVG(CASE WHEN assignment_accepted THEN 1.0 ELSE 0.0 END) as accuracy,
              AVG(confidence) as avg_confidence
            FROM ml_predictions
            WHERE organization_id = ${organizationScopeId}
              AND prediction_type = 'assignment'
              AND predicted_at >= NOW() - INTERVAL '24 hours'
          )
          SELECT 
            rp.model_name,
            COALESCE(rp.accuracy, mm.baseline_accuracy) as accuracy,
            COALESCE(mm.precision, 0.80) as precision,
            COALESCE(mm.recall, 0.80) as recall,
            COALESCE(mm.f1_score, 0.80) as f1_score,
            COALESCE(rp.predictions_count, 0) as predictions_24h,
            COALESCE(rp.avg_confidence, mm.baseline_confidence) as avg_confidence,
            mm.last_evaluated_at,
            CASE 
              WHEN rp.accuracy >= 0.85 THEN 'healthy'
              WHEN rp.accuracy >= 0.75 THEN 'warning'
              ELSE 'critical'
            END as status,
            CASE
              WHEN rp.accuracy > mm.baseline_accuracy + 0.03 THEN 'up'
              WHEN rp.accuracy < mm.baseline_accuracy - 0.03 THEN 'down'
              ELSE 'stable'
            END as trend
          FROM recent_predictions rp
          LEFT JOIN model_metadata mm ON mm.model_name = rp.model_name
          ORDER BY rp.model_name
        `);
        // Transform database results into response format
        const models = ((modelMetrics as Array<Record<string, unknown>>) || []).map((row: Record<string, unknown>) => ({
          modelName: row.model_name,
          accuracy: parseFloat(String(row.accuracy ?? 0)),
          precision: parseFloat(String(row.precision ?? 0)),
          recall: parseFloat(String(row.recall ?? 0)),
          f1Score: parseFloat(String(row.f1_score ?? 0)),
          predictions24h: parseInt(String(row.predictions_24h ?? 0)),
          avgConfidence: parseFloat(String(row.avg_confidence ?? 0)),
          lastUpdated: row.last_evaluated_at || new Date().toISOString(),
          status: row.status || 'healthy',
          trend: row.trend || 'stable'
        }));
        return NextResponse.json({
          models,
          timestamp: new Date().toISOString()
        });
  },
);
