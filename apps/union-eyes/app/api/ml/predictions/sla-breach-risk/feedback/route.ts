import { withApi, z, RATE_LIMITS, ApiError } from '@/lib/api/framework';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';
import { and, desc, eq, sql } from 'drizzle-orm';
import { mlPredictions, modelMetadata, mlPredictionFeedback } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';
import { logger } from '@/lib/logger';
import { isUniqueViolation } from '@/lib/db/unique-violation';
import type { RLSTx } from '@/lib/db/with-rls-context';

const bodySchema = z.object({
  predictionId: z.guid(),
  // Omitted, it is the version the prediction recorded when it was made.
  modelVersion: z.string().min(1).optional(),
  actualBreach: z.boolean(),
  comment: z.string().max(1000).optional(),
  resolutionHours: z.number().nonnegative().optional(),
});

const querySchema = z.object({
  version: z.string().optional(),
});

/**
 * Outcome feedback for SLA breach predictions.
 *
 * Each outcome is its own append-only row (ml_prediction_feedback, one per prediction). The statistics are computed from those rows
 * when read; model_metadata is not rewritten (the runtime role may only select and insert it, so the earlier read-modify-write failed
 * under canonical bootstrap and rolled back its own audit record). The score is a fixed rule (see sla-breach-score), so the error
 * figures describe that rule; no process reads the retraining signal and none can retrain a rule that has no parameters.
 */
const MIN_OBSERVATIONS_FOR_SIGNAL = 30;
const ERROR_THRESHOLD = 0.25;

async function feedbackStats(tx: RLSTx, organizationId: string, version: string | null) {
  const [row] = await tx
    .select({ observations: sql<number>`count(*)::int`, meanAbsoluteError: sql<string | null>`avg(${mlPredictionFeedback.absError})` })
    .from(mlPredictionFeedback)
    .where(and(eq(mlPredictionFeedback.organizationId, organizationId), ...(version ? [eq(mlPredictionFeedback.modelVersion, version)] : [])));
  const observations = Number(row?.observations ?? 0);
  const meanAbsoluteError = observations > 0 ? Number(Number(row?.meanAbsoluteError ?? 0).toFixed(6)) : null;
  const qualityScore = meanAbsoluteError === null ? null : Number((1 - Math.min(meanAbsoluteError, 1)).toFixed(6));
  const retrainRecommended = meanAbsoluteError !== null && observations >= MIN_OBSERVATIONS_FOR_SIGNAL && meanAbsoluteError > ERROR_THRESHOLD;
  return { observations, meanAbsoluteError, qualityScore, retrainRecommended };
}

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    body: bodySchema,
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['AI'],
      summary: 'Record the outcome of an SLA prediction',
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

    // The outcome row and its audit record commit together; a prediction of another organization is simply not found.
    let result;
    try {
      result = await withRLSContext({ organizationId }, async (tx) => {
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

        // Feedback scores a model that exists, and a prediction can only be scored against the version it recorded.
        const version = body.modelVersion ?? prediction.modelVersion ?? 'sla-risk-v1';
        const [model] = await tx
          .select()
          .from(modelMetadata)
          .where(and(eq(modelMetadata.organizationId, organizationId), eq(modelMetadata.modelType, 'sla_breach_risk'), eq(modelMetadata.version, version)))
          .limit(1);
        if (!model) throw ApiError.notFound('Model version');
        if (prediction.modelVersion && prediction.modelVersion !== model.version) {
          throw ApiError.conflict('The prediction was made by a different model version');
        }

        const predicted = Number(prediction.predictedValue ?? 0);
        const absError = Math.abs(predicted - (body.actualBreach ? 1 : 0));
        const [stored] = await tx
          .insert(mlPredictionFeedback)
          .values({
            organizationId,
            predictionId: prediction.id,
            modelVersion: model.version,
            predictedValue: String(predicted),
            actualBreach: body.actualBreach,
            absError: String(absError),
            resolutionHours: body.resolutionHours === undefined ? null : String(body.resolutionHours),
            comment: body.comment ?? null,
            submittedBy: userId,
          })
          .returning();

        const stats = await feedbackStats(tx, organizationId, model.version);
        await persistAtomicAudit(tx, {
          organizationId,
          userId: userId ?? null,
          action: 'ml.sla_breach.feedback',
          resourceType: 'ml_prediction_feedback',
          resourceId: stored.id,
          details: { predictionId: prediction.id, modelVersion: model.version, absError, observations: stats.observations },
        });
        return { prediction, model, absError, stats };
      });
    } catch (error) {
      // The unique index on prediction_id settles two submissions for one prediction.
      if (isUniqueViolation(error)) throw ApiError.conflict('An outcome has already been recorded for this prediction');
      throw error;
    }
    const { prediction, model, absError, stats } = result;

    // Pilot tracking is usage telemetry, not a governed change: the feedback is committed, so a telemetry failure must not turn a
    // recorded result into an error response.
    await trackPilotEvent({
      userId: userId ?? 'system:ml-feedback',
      organizationId,
      sessionId: `ml-feedback:${prediction.id}`,
      eventType: 'feedback_submitted',
      metadata: { predictionId: prediction.id, modelVersion: model.version, absError, retrainRecommended: stats.retrainRecommended },
    }).catch((error) => logger.warn('sla feedback pilot event was not recorded', { error: String(error) }));

    return {
      predictionId: prediction.id,
      modelVersion: model.version,
      metrics: {
        observations: stats.observations,
        meanAbsoluteError: stats.meanAbsoluteError,
        qualityScore: stats.qualityScore,
      },
      retrainRecommended: stats.retrainRecommended,
    };
  },
);

export const GET = withApi(
  {
    // The error figures are the organization's own model quality, read at the steward floor like the predictions they score.
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    query: querySchema,
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['AI'],
      summary: 'Summary of the recorded outcomes of SLA predictions',
    },
  },
  async ({ organizationId, userId, query }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const blockedGet = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
      organizationId: organizationId!,
      userId: userId ?? '',
    });
    if (blockedGet) return blockedGet;

    enforceAISafety({ origin: 'sla-breach-risk-feedback', action: 'GET', organizationId: organizationId!, userId: userId ?? '', userRole: 'steward', dataClass: 'confidential' });

    return withRLSContext({ organizationId }, async (tx) => {
      const [model] = await tx
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

      const stats = await feedbackStats(tx, organizationId, model?.version ?? query.version ?? null);
      return {
        model: model ? { id: model.id, version: model.version } : null,
        feedbackStats: stats,
        // A figure to read, not a trigger: nothing consumes it and the scoring rule has no parameters to retrain.
        retrainSignal: {
          recommended: stats.retrainRecommended,
          threshold: ERROR_THRESHOLD,
          minObservations: MIN_OBSERVATIONS_FOR_SIGNAL,
          consumedBy: null,
        },
      };
    });
  },
);
