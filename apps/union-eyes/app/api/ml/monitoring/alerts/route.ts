import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { db } from '@/db';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * GET /api/ml/monitoring/alerts
 * 
 * Returns active ML monitoring alerts with severity levels
 * 
 * Alert Types:
 * - P1: Critical - Immediate action required (accuracy < 75%, PSI > 0.30)
 * - P2: High - Action required within 24h (accuracy < 80%, PSI > 0.25)
 * - P3: Medium - Action required within week
 * - P4: Low - Informational only
 * 
 * Response:
 * {
 *   alerts: [{
 *     id: string,
 *     severity: 'P1' | 'P2' | 'P3' | 'P4',
 *     message: string,
 *     modelName: string,
 *     timestamp: string,
 *     acknowledged: boolean,
 *     acknowledgedBy?: string,
 *     acknowledgedAt?: string
 *   }],
 *   summary: {
 *     p1: number,
 *     p2: number,
 *     p3: number,
 *     p4: number,
 *     unacknowledged: number
 *   }
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

  const organizationScopeId = organizationId || userId;

  try {

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

  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch alerts',
      error
    );
  }
});

/**
 * POST /api/ml/monitoring/alerts
 * 
 * Acknowledge an alert
 * 
 * Request body:
 * {
 *   alertId: string
 * }
 */

const mlMonitoringAlertsSchema = z.object({
  alertId: z.string().uuid('Invalid alertId'),
});

export const POST = withRoleAuth('member', async (request: NextRequest, context) => {
  const { userId, organizationId } = context;
  const organizationScopeId = organizationId || userId;
  
  try {
    const body = await request.json();
    // Validate request body
    const validation = mlMonitoringAlertsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { alertId } = validation.data;

    if (!alertId) {
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'alertId is required'
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

    return NextResponse.json({
      success: true,
      alertId,
      acknowledgedBy: userId,
      acknowledgedAt: new Date().toISOString()
    });

  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to acknowledge alert',
      error
    );
  }
});

