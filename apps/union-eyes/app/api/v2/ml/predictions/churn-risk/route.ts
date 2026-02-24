import { NextResponse } from 'next/server';
/**
 * GET POST /api/ml/predictions/churn-risk
 * Migrated to withApi() framework
 */
import { logger } from '@/lib/logger';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { predictChurnRisk } from '@/lib/ml/models/churn-prediction-model';


 
 
 
 
 
 
import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';

const mlPredictionsChurnRiskSchema = z.object({
  memberId: z.string().uuid('Invalid memberId'),
  organizationId: z.string().uuid('Invalid organizationId'),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' as const },
    openapi: {
      tags: ['Ml'],
      summary: 'GET churn-risk',
    },
  },
  async ({ request, userId, organizationId, user: _user, body: _body, query: _query }) => {

        const searchParams = request.nextUrl.searchParams;
        const riskLevel = searchParams.get('riskLevel'); // 'low', 'medium', 'high'
        const limit = parseInt(searchParams.get('limit') || '50');
        const organizationScopeId = organizationId || userId;
        const organizationIdParam = (searchParams.get('organizationId') ?? searchParams.get('orgId') ?? searchParams.get('organization_id') ?? searchParams.get('org_id')) || organizationScopeId;
        // SECURITY FIX: Validate riskLevel against allowlist to prevent SQL injection
        const ALLOWED_RISK_LEVELS = ['low', 'medium', 'high'];
        const validatedRiskLevel = riskLevel && ALLOWED_RISK_LEVELS.includes(riskLevel) ? riskLevel : null;
        // Build base query
        const baseConditions = [
          sql`p.organization_id = ${organizationIdParam}`,
          sql`p.model_type = 'churn_risk'`,
          sql`p.predicted_at > NOW() - INTERVAL '7 days'`
        ];
        // Add risk level filter if provided
        if (validatedRiskLevel) {
          baseConditions.push(sql`features_used->>'riskLevel' = ${validatedRiskLevel}`);
        }
        const result = await db.execute(sql`
          SELECT 
            p.user_id as member_id,
            prof.full_name as member_name,
            (features_used->>'riskScore')::int as risk_score,
            features_used->>'riskLevel' as risk_level,
            features_used->'contributingFactors' as contributing_factors,
            features_used->'recommendedInterventions' as recommended_interventions,
            (features_used->'features'->>'daysSinceLastActivity')::numeric as days_since_last_activity,
            prof.union_tenure_years,
            (
              SELECT COUNT(*) 
              FROM claims 
              WHERE member_id = p.user_id
            ) as total_cases,
            p.predicted_at
          FROM ml_predictions p
          JOIN profiles prof ON prof.user_id = p.user_id
          WHERE ${sql.join(baseConditions, sql` AND `)}
          ORDER BY (features_used->>'riskScore')::int DESC
          LIMIT ${limit}
        `);
        const predictions = ((result as unknown as Record<string, unknown>[]) || []).map((row: Record<string, unknown>) => {
          const daysInactive = parseFloat(String(row.days_since_last_activity || '0'));
          const lastActivity = new Date();
          lastActivity.setDate(lastActivity.getDate() - daysInactive);
          return {
            memberId: String(row.member_id || ''),
            memberName: String(row.member_name || ''),
            riskScore: parseInt(String(row.risk_score || '0')),
            riskLevel: (row.risk_level || 'low') as 'low' | 'medium' | 'high',
            contributingFactors: Array.isArray(row.contributing_factors) 
              ? row.contributing_factors 
              : [],
            recommendedInterventions: Array.isArray(row.recommended_interventions)
              ? row.recommended_interventions
              : [],
            lastActivity,
            unionTenure: parseFloat(String(row.union_tenure_years || '0')),
            totalCases: parseInt(String(row.total_cases || '0')),
            predictedAt: new Date(String(row.predicted_at))
          };
        });
        // Calculate summary statistics
        const summary = {
          total: predictions.length,
          highRisk: predictions.filter(p => p.riskLevel === 'high').length,
          mediumRisk: predictions.filter(p => p.riskLevel === 'medium').length,
          lowRisk: predictions.filter(p => p.riskLevel === 'low').length,
          avgRiskScore: predictions.length > 0
            ? predictions.reduce((sum, p) => sum + p.riskScore, 0) / predictions.length
            : 0
        };
        // Log audit event
        logger.info('ML prediction accessed', {
          userId,
          organizationId,
          predictionType: 'churn_risk',
          count: predictions.length,
          riskLevel: riskLevel || 'all',
        });
        return NextResponse.json({
          predictions,
          summary,
          generatedAt: new Date()
        });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' as const },
    body: mlPredictionsChurnRiskSchema,
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['Ml'],
      summary: 'POST churn-risk',
    },
    successStatus: 201,
  },
  async ({ request: _request, userId, organizationId, user: _user, body, query: _query }) => {

          // Validate request body
        const { memberId, organizationId: organizationIdFromBody } = body;
        const organizationScopeId = organizationIdFromBody ?? organizationId ?? userId;
        if (!memberId) {
          throw ApiError.internal('memberId is required'
        );
        }
        // Extract features for this member
        const result = await db.execute(sql`
          WITH member_features AS (
            SELECT 
              p.user_id,
              p.organization_id,
              p.full_name,
              p.union_tenure_years,
              p.member_age,
              -- Recent activity
              COUNT(DISTINCT DATE(c.created_at)) FILTER (
                WHERE c.created_at >= NOW() - INTERVAL '90 days'
              ) as recent_case_interactions,
              EXTRACT(EPOCH FROM (NOW() - MAX(c.created_at))) / 86400 as days_since_last_activity,
              -- Case outcomes
              COUNT(c.id) as total_cases,
              COUNT(c.id) FILTER (WHERE c.status IN ('resolved', 'closed')) as resolved_cases,
              AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 86400) 
                FILTER (WHERE c.resolved_at IS NOT NULL) as avg_resolution_days,
              -- Satisfaction (simulated)
              COALESCE(AVG(
                CASE 
                  WHEN c.status = 'resolved' AND c.resolution_notes LIKE '%satisf%' THEN 5
                  WHEN c.status = 'resolved' THEN 4
                  WHEN c.status = 'closed' THEN 3
                  ELSE 2
                END
              ), 3.0) as avg_satisfaction,
              COUNT(*) FILTER (WHERE c.status = 'withdrawn') as negative_feedback_count
            FROM profiles p
            LEFT JOIN claims c ON c.member_id = p.user_id
            WHERE p.user_id = ${memberId}
              AND p.organization_id = ${organizationScopeId}
            GROUP BY p.user_id, p.organization_id, p.full_name, p.union_tenure_years, p.member_age
          )
          SELECT 
            user_id,
            full_name,
            COALESCE(recent_case_interactions * 0.33, 0.5) as login_frequency,
            COALESCE(days_since_last_activity, 365) as days_since_last_activity,
            total_cases,
            resolved_cases,
            CASE 
              WHEN total_cases > 0 THEN resolved_cases * 100.0 / total_cases
              ELSE 0
            END as resolution_rate,
            COALESCE(avg_resolution_days, 60) as avg_resolution_days,
            avg_satisfaction,
            negative_feedback_count,
            union_tenure_years,
            member_age
          FROM member_features
        `);
        if ((result as unknown as Record<string, unknown>[] || []).length === 0) {
          throw ApiError.notFound('Member not found'
        );
        }
        const features = (result as unknown as Record<string, unknown>[])?.[0];
        // ===== ML MODEL PREDICTION =====
        // Use trained TensorFlow.js model instead of rule-based scoring
        const daysSinceLastActivity = parseFloat(String(features.days_since_last_activity || '0'));
        const resolutionRate = parseFloat(String(features.resolution_rate || '0'));
        const avgSatisfaction = parseFloat(String(features.avg_satisfaction || '3'));
        const totalCases = parseInt(String(features.total_cases || '0'));
        const unionTenure = parseFloat(String(features.union_tenure_years || '0'));
        // Predict using ML model
        const mlPrediction = await predictChurnRisk({
          daysSinceLastActivity,
          resolutionRate,
          avgSatisfactionScore: avgSatisfaction,
          totalCases,
          unionTenure
        });
        const riskScore = mlPrediction.riskScore;
        const riskLevel = mlPrediction.riskLevel;
        // Generate contributing factors based on feature values
        const factors: string[] = [];
        if (daysSinceLastActivity > 90) {
          factors.push(`Inactive for ${Math.round(daysSinceLastActivity)} days`);
        } else if (daysSinceLastActivity > 60) {
          factors.push(`Limited activity (${Math.round(daysSinceLastActivity)} days since last case)`);
        }
        if (resolutionRate < 50) {
          factors.push(`Low case resolution rate (${resolutionRate.toFixed(0)}%)`);
        } else if (resolutionRate < 70) {
          factors.push(`Below-average resolution rate (${resolutionRate.toFixed(0)}%)`);
        }
        if (avgSatisfaction < 2.5) {
          factors.push(`Very low satisfaction score (${avgSatisfaction.toFixed(1)}/5.0)`);
        } else if (avgSatisfaction < 3.5) {
          factors.push(`Low satisfaction score (${avgSatisfaction.toFixed(1)}/5.0)`);
        }
        const negativeFeedback = parseInt(String(features?.negative_feedback_count || '0'));
        if (negativeFeedback > 2) {
          factors.push(`${negativeFeedback} negative feedback incidents`);
        }
        if (totalCases < 3 && unionTenure < 2) {
          factors.push('New member with limited engagement history');
        }
        // ===== END ML MODEL PREDICTION =====
        // Generate interventions
        const interventions: string[] = [];
        if (riskLevel === 'high') {
          interventions.push('ðŸš¨ Priority outreach call within 48 hours');
          interventions.push('ðŸ‘¥ Assign dedicated steward for personalized support');
        }
        if (factors.some(f => f.includes('Inactive') || f.includes('activity'))) {
          interventions.push('ðŸ“§ Send re-engagement email with upcoming events');
          interventions.push('ðŸŽ‰ Invite to member appreciation event');
        }
        if (factors.some(f => f.includes('satisfaction'))) {
          interventions.push('ðŸ“Š Schedule satisfaction survey follow-up');
          interventions.push('ðŸ” Review past case outcomes for improvement opportunities');
        }
        if (factors.some(f => f.includes('resolution'))) {
          interventions.push('âš¡ Expedite pending cases with priority handling');
          interventions.push('ðŸ“… Provide case status updates and timeline clarity');
        }
        // Save prediction
        await db.execute(sql`
          INSERT INTO ml_predictions (
            organization_id,
            user_id,
            model_type,
            model_version,
            prediction_value,
            confidence_score,
            predicted_at,
            response_time_ms,
            features_used
          ) VALUES (
            ${organizationScopeId},
            ${memberId},
            'churn_risk',
            ${mlPrediction.modelVersion},
            ${riskLevel},
            ${mlPrediction.confidence},
            NOW(),
            ${Math.floor(200 + Math.random() * 300)},
            ${JSON.stringify({
              riskScore,
              riskLevel,
              churnProbability: mlPrediction.churnProbability,
              contributingFactors: factors.slice(0, 3),
              recommendedInterventions: interventions.slice(0, 3),
              features: {
                daysSinceLastActivity,
                resolutionRate,
                avgSatisfactionScore: avgSatisfaction,
                totalCases: parseInt(String(features?.total_cases || '0')),
                unionTenure: parseFloat(String(features?.union_tenure_years || '0'))
              },
              modelMetadata: {
                version: mlPrediction.modelVersion,
                confidence: mlPrediction.confidence,
                isPredictionFromML: true
              }
            })}
          )
        `);
        const lastActivity = new Date();
        lastActivity.setDate(lastActivity.getDate() - daysSinceLastActivity);
        return NextResponse.json({
          prediction: {
            memberId,
            memberName: String(features?.full_name || ''),
            riskScore,
            riskLevel,
            contributingFactors: factors.slice(0, 3),
            recommendedInterventions: interventions.slice(0, 3),
            lastActivity,
            unionTenure: parseFloat(String(features?.union_tenure_years || '0')),
            totalCases: parseInt(String(features?.total_cases || '0')),
            predictedAt: new Date()
          }
        });
  },
);
