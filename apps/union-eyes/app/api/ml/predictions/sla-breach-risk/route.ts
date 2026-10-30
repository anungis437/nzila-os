import { withApi, z, RATE_LIMITS, ApiError } from '@/lib/api/framework';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';
import { db } from '@/db';
import { claims, mlPredictions, modelMetadata } from '@/db/schema';
import { SLA_SCORING_METHOD, caseFacts, computeSlaBreachProbability } from '@/lib/ml/sla-breach-score';
import { and, desc, eq } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

const bodySchema = z.object({
  caseId: z.guid(),
  features: z.object({
    // The case's priority and time remaining are read from the case; values sent here are not used, and are accepted only so
    // existing callers keep working.
    hoursRemaining: z.number().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    transitionCount: z.number().int().nonnegative(),
    hasPreviousBreaches: z.boolean(),
    featureRefs: z.array(z.string().min(2)).min(1),
  }),
  modelVersion: z.string().min(1).optional(),
});

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
    const now = new Date();

    // The model record (when first used), the prediction and their audit record commit together
    const { activeModel, prediction, score, derived } = await withRLSContext({ organizationId }, async (tx) => {
      // The case must exist in this organization, and its priority and deadline decide the score.
      const [claim] = await tx
        .select({ status: claims.status, priority: claims.priority, updatedAt: claims.updatedAt, createdAt: claims.createdAt })
        .from(claims)
        .where(and(eq(claims.claimId, body.caseId), eq(claims.organizationId, organizationId)))
        .limit(1);
      if (!claim) throw ApiError.notFound('Case');
      const derived = caseFacts(claim, now);
      const score = computeSlaBreachProbability({
        ...derived,
        transitionCount: body.features.transitionCount,
        hasPreviousBreaches: body.features.hasPreviousBreaches,
      });

      const [existingModel] = await tx
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

      const model = existingModel
        ? existingModel
        : (
            await tx
              .insert(modelMetadata)
              .values({
                organizationId,
                modelType: 'sla_breach_risk',
                version: selectedVersion,
                parameters: {
                  featureSet: body.features.featureRefs,
                  scoring: SLA_SCORING_METHOD,
                },
              })
              .returning()
          )[0];

      const [stored] = await tx
        .insert(mlPredictions)
        .values({
          organizationId,
          predictionType: 'sla_breach_risk',
          predictionDate: now,
          predictedValue: score.toString(),
          // No calibration exists, so no interval and no confidence are recorded.
          lowerBound: null,
          upperBound: null,
          confidence: null,
          horizon: 72,
          granularity: 'case',
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId ?? null,
        action: 'ml.sla_breach.predict',
        resourceType: 'ml_predictions',
        resourceId: stored.id,
        details: {
          caseId: body.caseId,
          modelVersion: model.version,
          modelType: model.modelType,
          featureRefs: body.features.featureRefs,
          score,
          method: SLA_SCORING_METHOD,
          derivedFromCase: { priority: derived.priority, hoursRemaining: Number(derived.hoursRemaining.toFixed(2)) },
        },
      });

      return { activeModel: model, prediction: stored, score, derived };
    });

    return {
      predictionId: prediction.id,
      caseId: body.caseId,
      score,
      // A rule-based score, not a trained model: there is no training date, confidence or interval to report.
      method: SLA_SCORING_METHOD,
      model: {
        type: activeModel.modelType,
        version: activeModel.version,
      },
      inputs: {
        fromCase: { priority: derived.priority, hoursRemaining: Number(derived.hoursRemaining.toFixed(2)) },
        supplied: { transitionCount: body.features.transitionCount, hasPreviousBreaches: body.features.hasPreviousBreaches },
      },
      featureRefs: body.features.featureRefs,
      confidence: null,
    };
  },
);

export const GET = withApi(
  {
    // The list is the same model output the POST produces, so it is read at the same floor and behind the same gate and safety check.
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    rateLimit: RATE_LIMITS.ML_PREDICTIONS,
    openapi: {
      tags: ['AI'],
      summary: 'List latest SLA breach risk predictions',
    },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
      organizationId,
      userId: userId ?? '',
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'sla-breach-risk', action: 'GET', organizationId, userId: userId ?? '', userRole: 'steward', dataClass: 'confidential' });

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
