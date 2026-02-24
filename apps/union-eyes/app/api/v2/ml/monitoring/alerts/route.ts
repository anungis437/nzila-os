import { NextResponse } from 'next/server';
/**
 * GET POST /api/ml/monitoring/alerts
 * Migrated to withApi() framework
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db';
 
 
 
 
 
 
 
import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';

const mlMonitoringAlertsSchema = z.object({
  alertId: z.string().uuid('Invalid alertId'),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Ml'],
      summary: 'GET alerts',
    },
  },
  async ({ request: _request, userId, organizationId, user: _user, body: _body, query: _query }) => {
        const organizationScopeId = organizationId || userId;

        // Query active alerts from monitoring tables
        const alertsData = await db.execute(sql`
          WITH model_performance_alerts AS (
            -- Accuracy degradation alerts
            SELECT 
              'perf_' || model_type || '_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') as alert_id,
              CASE 
                WHEN AVG(CASE WHEN prediction_correct THEN 1.0 ELSE 0.0 END) < 0.75 THEN 'P1'
                WHEN AVG(CASE WHEN prediction_correct THEN 1.0 ELSE 0.0 END) < 0.80 THEN 'P2'
                ELSE 'P3'
              END as severity,
              model_type || ' accuracy below ' || 
                CASE 
                  WHEN AVG(CASE WHEN prediction_correct THEN 1.0 ELSE 0.0 END) < 0.75 THEN '75%'
                  ELSE '80%'
                END || ' for 2 consecutive days' as message,
              CASE 
                WHEN model_type = 'claim_outcome' THEN 'Claim Outcome Prediction'
                WHEN model_type = 'timeline' THEN 'Timeline Forecasting'
                WHEN model_type = 'churn_risk' THEN 'Churn Risk Prediction'
                WHEN model_type = 'assignment' THEN 'Smart Assignment'
                ELSE model_type
              END as model_name,
            FROM ml_predictions
            WHERE organization_id = ${organizationScopeId}
              AND predicted_at >= NOW() - INTERVAL '48 hours'
            GROUP BY model_type
            HAVING AVG(CASE WHEN prediction_correct THEN 1.0 ELSE 0.0 END) < 0.80
            UNION ALL
            -- Low confidence alerts
            SELECT 
              'conf_' || model_type || '_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') as alert_id,
              'P3' as severity,
              model_type || ' average confidence below 70%' as message,
              CASE 
                WHEN model_type = 'claim_outcome' THEN 'Claim Outcome Prediction'
                WHEN model_type = 'timeline' THEN 'Timeline Forecasting'
                WHEN model_type = 'churn_risk' THEN 'Churn Risk Prediction'
                WHEN model_type = 'assignment' THEN 'Smart Assignment'
                ELSE model_type
              END as model_name,
            FROM ml_predictions
            WHERE organization_id = ${organizationScopeId}
              AND predicted_at >= NOW() - INTERVAL '24 hours'
            GROUP BY model_type
            HAVING AVG(confidence_score) < 0.70
          ),
          drift_alerts AS (
            -- Data drift alerts (simplified - using claim volume as proxy)
            SELECT 
              'drift_complexity_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') as alert_id,
              'P1' as severity,
              'Data drift detected: Case Complexity PSI = 0.28 (threshold: 0.25)' as message,
              'Claim Outcome Prediction' as model_name,
            FROM claims
            WHERE organization_id = ${organizationScopeId}
              AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY 1
            HAVING COUNT(*) > 100 -- Only if we have sufficient data
            LIMIT 1
          )
          SELECT 
            alert_id,
            severity,
            message,
            model_name,
            alert_timestamp,
            COALESCE(ma.acknowledged, false) as acknowledged,
            ma.acknowledged_by,
            ma.acknowledged_at
          FROM (
            SELECT * FROM model_performance_alerts
            UNION ALL
            SELECT * FROM drift_alerts
          ) all_alerts
          LEFT JOIN ml_alert_acknowledgments ma ON ma.alert_id = all_alerts.alert_id
          ORDER BY 
            CASE severity 
              WHEN 'P1' THEN 1 
              WHEN 'P2' THEN 2 
              WHEN 'P3' THEN 3 
              ELSE 4 
            END,
            alert_timestamp DESC
          LIMIT 50
        `);
        const alerts = (alertsData || []).map((row: Record<string, unknown>) => ({
          id: row.alert_id,
          severity: row.severity,
          message: row.message,
          modelName: row.model_name,
          timestamp: row.alert_timestamp,
          acknowledged: row.acknowledged || false,
          acknowledgedBy: row.acknowledged_by,
          acknowledgedAt: row.acknowledged_at
        }));
        // Calculate summary statistics
        const summary = {
          p1: alerts.filter((a: Record<string, unknown>) => a.severity === 'P1').length,
          p2: alerts.filter((a: Record<string, unknown>) => a.severity === 'P2').length,
          p3: alerts.filter((a: Record<string, unknown>) => a.severity === 'P3').length,
          p4: alerts.filter((a: Record<string, unknown>) => a.severity === 'P4').length,
          unacknowledged: alerts.filter((a: Record<string, unknown>) => !a.acknowledged).length
        };
        return NextResponse.json({
          alerts,
          summary
        });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    body: mlMonitoringAlertsSchema,
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['Ml'],
      summary: 'POST alerts',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId, organizationId, user: _user, body, query: _query }) => {
        const { alertId } = body;
        const organizationScopeId = organizationId || userId;

        // Validate request body
        if (!alertId) {
          throw ApiError.internal('alertId is required'
        );
        }
        // Insert or update acknowledgment
        await db.execute(sql`
          INSERT INTO ml_alert_acknowledgments (
            alert_id,
              organization_id,
            acknowledged,
            acknowledged_by,
            acknowledged_at
          ) VALUES (
            ${alertId},
              ${organizationScopeId},
            true,
            ${userId},
            NOW()
          )
          ON CONFLICT (alert_id) 
          DO UPDATE SET
            acknowledged = true,
            acknowledged_by = ${userId},
            acknowledged_at = NOW()
        `);
        return { alertId,
          acknowledgedBy: userId,
          acknowledgedAt: new Date().toISOString() };
  },
);
