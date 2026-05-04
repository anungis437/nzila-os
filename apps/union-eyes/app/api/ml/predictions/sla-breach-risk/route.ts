import { withApi, z, RATE_LIMITS, ApiError } from '@/lib/api/framework';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';
import { db } from '@/db';
import { mlPredictions, modelMetadata } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

const bodySchema = z.object({
  caseId: z.string().uuid(),
  features: z.object({
    hoursRemaining: z.number(),
    transitionCount: z.number().int().nonnegative(),
    hasPreviousBreaches: z.boolean(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    featureRefs: z.array(z.string().min(2)).min(1),
  }),
  modelVersion: z.string().min(1).optional(),
});

function computeSlaBreachProbability(input: z.infer<typeof bodySchema>['features']): number {
  const priorityWeight = input.priority === 'urgent' ? 0.25 : input.priority === 'high' ? 0.18 : input.priority === 'medium' ? 0.1 : 0.04;
  const timePressure = input.hoursRemaining <= 0 ? 0.45 : input.hoursRemaining < 12 ? 0.32 : input.hoursRemaining < 24 ? 0.2 : 0.08;
  const transitionPressure = Math.min(input.transitionCount * 0.03, 0.18);
  const historyWeight = input.hasPreviousBreaches ? 0.16 : 0;
  const score = Math.min(0.99, Math.max(0.01, priorityWeight + timePressure + transitionPressure + historyWeight));
  return Number(score.toFixed(4));
}

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    body: bodySchema,
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['AI'],
      summary: 'Predict SLA breach risk with model/version and feature references',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
      organizationId: organizationId!,
      userId: userId ?? '',
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'sla-breach-risk', action: 'POST', organizationId: organizationId!, userId: userId ?? '', userRole: 'steward', dataClass: 'confidential' });

    const selectedVersion = body.modelVersion ?? 'sla-risk-v1';
    const [existingModel] = await db
      .select()
      .from(modelMetadata)
      .where(
        and(
          eq(modelMetadata.organizationId, organizationId),
          eq(modelMetadata.modelType, 'sla_breach_risk'),
          eq(modelMetadata.version, selectedVersion),
        ),
      )
      .limit(1);

    const activeModel = existingModel
      ? existingModel
      : (
          await db
            .insert(modelMetadata)
            .values({
              organizationId,
              modelType: 'sla_breach_risk',
              version: selectedVersion,
              parameters: {
                featureSet: body.features.featureRefs,
                scoring: 'heuristic_v1',
              },
            })
            .returning()
        )[0];

    const score = computeSlaBreachProbability(body.features);
    const now = new Date();

    const [prediction] = await db
      .insert(mlPredictions)
      .values({
        organizationId,
        predictionType: 'sla_breach_risk',
        predictionDate: now,
        predictedValue: score.toString(),
        lowerBound: Math.max(0, score - 0.08).toFixed(4),
        upperBound: Math.min(1, score + 0.08).toFixed(4),
        confidence: '0.78',
        horizon: 72,
        granularity: 'case',
      })
      .returning();

    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.HIGH,
      userId: userId ?? undefined,
      organizationId,
      resource: 'ml_predictions',
      resourceId: prediction.id,
      action: 'sla_breach_prediction_logged',
      details: {
        caseId: body.caseId,
        modelVersion: activeModel.version,
        modelType: activeModel.modelType,
        featureRefs: body.features.featureRefs,
        score,
      },
    });

    return {
      predictionId: prediction.id,
      caseId: body.caseId,
      score,
      model: {
        type: activeModel.modelType,
        version: activeModel.version,
        trainedAt: activeModel.trainedAt,
      },
      featureRefs: body.features.featureRefs,
      confidence: 0.78,
    };
  },
);

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'grievance_case_suite',
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['AI'],
      summary: 'List latest SLA breach risk predictions',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const predictions = await db
      .select()
      .from(mlPredictions)
      .where(
        and(
          eq(mlPredictions.organizationId, organizationId),
          eq(mlPredictions.predictionType, 'sla_breach_risk'),
        ),
      )
      .orderBy(desc(mlPredictions.createdAt))
      .limit(25);

    return { predictions };
  },
);
