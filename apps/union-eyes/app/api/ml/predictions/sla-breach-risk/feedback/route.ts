import { withApi, z, RATE_LIMITS, ApiError } from '@/lib/api/framework';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';
import { db } from '@/db';
import { and, desc, eq } from 'drizzle-orm';
import { mlPredictions, modelMetadata } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
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

    const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
      organizationId: organizationId!,
      userId: userId ?? '',
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'sla-breach-risk-feedback', action: 'POST', organizationId: organizationId!, userId: userId ?? '', userRole: 'steward', dataClass: 'confidential' });

    // The prediction is read, the model's feedback statistics are updated and the audit record is written in one
    // transaction; a prediction of another organization is simply not found.
    const result = await withRLSContext({ organizationId }, async (tx) => {
      const [prediction] = await tx
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

      const [model] = await tx
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
            await tx
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

      const nextParameters = {
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
      };

      const [updatedModel] = await tx
        .update(modelMetadata)
        .set({ accuracy: qualityScore.toFixed(6), parameters: nextParameters })
        .where(and(eq(modelMetadata.id, activeModel.id), eq(modelMetadata.organizationId, organizationId)))
        .returning();

      if (!updatedModel) throw ApiError.notFound('Model not found');

      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId ?? null,
        action: 'ml.sla_breach.feedback',
        resourceType: 'model_metadata',
        resourceId: updatedModel.id,
        details: {
          predictionId: prediction.id,
          absError,
          observations,
          meanAbsoluteError,
          retrainRecommended,
        },
      });

      return { prediction, updatedModel, absError, observations, meanAbsoluteError, qualityScore, retrainRecommended };
    });
    const { prediction, updatedModel, absError, observations, meanAbsoluteError, qualityScore, retrainRecommended } = result;

    // Pilot tracking is usage telemetry, not a governed change
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
  async ({ organizationId, userId, query }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const blockedGet = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
      organizationId: organizationId!,
      userId: userId ?? '',
    });
    if (blockedGet) return blockedGet;

    enforceAISafety({ origin: 'sla-breach-risk-feedback', action: 'GET', organizationId: organizationId!, userId: userId ?? '', userRole: 'member', dataClass: 'confidential' });

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
