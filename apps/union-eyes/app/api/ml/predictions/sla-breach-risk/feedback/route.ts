import { withApi, z, RATE_LIMITS, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { and, desc, eq } from 'drizzle-orm';
import { mlPredictions, modelMetadata } from '@/db/schema';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';

const bodySchema = z.object({
  predictionId: z.string().uuid(),
  modelVersion: z.string().min(1).default('sla-risk-v1'),
  actualBreach: z.boolean(),
  comment: z.string().max(1000).optional(),
  resolutionHours: z.number().nonnegative().optional(),
});

const querySchema = z.object({
  version: z.string().optional(),
});

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    body: bodySchema,
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['AI'],
      summary: 'Submit SLA prediction outcome feedback and update retrain signal',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const [prediction] = await db
      .select()
      .from(mlPredictions)
      .where(
        and(
          eq(mlPredictions.id, body.predictionId),
          eq(mlPredictions.organizationId, organizationId),
          eq(mlPredictions.predictionType, 'sla_breach_risk'),
        ),
      )
      .limit(1);

    if (!prediction) throw ApiError.notFound('Prediction not found');

    const [model] = await db
      .select()
      .from(modelMetadata)
      .where(
        and(
          eq(modelMetadata.organizationId, organizationId),
          eq(modelMetadata.modelType, 'sla_breach_risk'),
          eq(modelMetadata.version, body.modelVersion),
        ),
      )
      .limit(1);

    const activeModel = model
      ? model
      : (
          await db
            .insert(modelMetadata)
            .values({
              organizationId,
              modelType: 'sla_breach_risk',
              version: body.modelVersion,
              parameters: {},
            })
            .returning()
        )[0];

    const predicted = Number(prediction.predictedValue ?? 0);
    const actual = body.actualBreach ? 1 : 0;
    const absError = Math.abs(predicted - actual);

    const currentParams = (activeModel.parameters ?? {}) as Record<string, unknown>;
    const currentStats = (currentParams.feedbackStats ?? {}) as Record<string, unknown>;

    const previousObs = Number(currentStats.observations ?? 0);
    const previousMae = Number(currentStats.meanAbsoluteError ?? 0);

    const observations = previousObs + 1;
    const meanAbsoluteError = Number((((previousMae * previousObs) + absError) / observations).toFixed(6));
    const qualityScore = Number((1 - Math.min(meanAbsoluteError, 1)).toFixed(6));
    const retrainRecommended = observations >= 30 && meanAbsoluteError > 0.25;

    const feedbackEntry = {
      predictionId: prediction.id,
      predictionDate: prediction.predictionDate,
      predictedValue: prediction.predictedValue,
      actualBreach: body.actualBreach,
      absError,
      resolutionHours: body.resolutionHours,
      comment: body.comment,
      submittedAt: new Date().toISOString(),
      submittedBy: userId,
    };

    const previousQueue = Array.isArray(currentParams.trainingDataQueue)
      ? currentParams.trainingDataQueue
      : [];

    const trainingDataQueue = [...previousQueue, feedbackEntry].slice(-200);

    const [updatedModel] = await db
      .update(modelMetadata)
      .set({
        accuracy: qualityScore.toFixed(6),
        parameters: {
          ...currentParams,
          feedbackStats: {
            observations,
            meanAbsoluteError,
            qualityScore,
            retrainRecommended,
            lastUpdatedAt: new Date().toISOString(),
          },
          trainingDataQueue,
          retrainSignal: {
            recommended: retrainRecommended,
            reason: retrainRecommended
              ? 'mean_absolute_error_above_threshold'
              : 'within_threshold',
            threshold: 0.25,
            minObservations: 30,
          },
        },
      })
      .where(eq(modelMetadata.id, activeModel.id))
      .returning();

    await trackPilotEvent({
      userId: userId ?? 'system:ml-feedback',
      organizationId,
      sessionId: `ml-feedback:${prediction.id}`,
      eventType: 'feedback_submitted',
      metadata: {
        predictionId: prediction.id,
        modelVersion: updatedModel.version,
        absError,
        retrainRecommended,
      },
    });

    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: retrainRecommended ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      userId: userId ?? undefined,
      organizationId,
      resource: 'model_metadata',
      resourceId: updatedModel.id,
      action: 'sla_prediction_feedback_ingested',
      details: {
        predictionId: prediction.id,
        absError,
        observations,
        meanAbsoluteError,
        retrainRecommended,
      },
    });

    return {
      predictionId: prediction.id,
      modelVersion: updatedModel.version,
      metrics: {
        observations,
        meanAbsoluteError,
        qualityScore,
      },
      retrainRecommended,
    };
  },
);

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'grievance_case_suite',
    query: querySchema,
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['AI'],
      summary: 'Get SLA prediction feedback and retraining signal summary',
    },
  },
  async ({ organizationId, query }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const rows = await db
      .select()
      .from(modelMetadata)
      .where(
        and(
          eq(modelMetadata.organizationId, organizationId),
          eq(modelMetadata.modelType, 'sla_breach_risk'),
          ...(query.version ? [eq(modelMetadata.version, query.version)] : []),
        ),
      )
      .orderBy(desc(modelMetadata.trainedAt))
      .limit(1);

    const model = rows[0] ?? null;
    const params = (model?.parameters ?? {}) as Record<string, unknown>;

    return {
      model: model
        ? {
            id: model.id,
            version: model.version,
            accuracy: model.accuracy,
            trainedAt: model.trainedAt,
          }
        : null,
      feedbackStats: (params.feedbackStats ?? null),
      retrainSignal: (params.retrainSignal ?? null),
      queueSize: Array.isArray(params.trainingDataQueue) ? params.trainingDataQueue.length : 0,
    };
  },
);
