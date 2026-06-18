/**
 * Foundation Demo \u2014 Case Priority Cognition (server wrapper, Gap 2)
 *
 * Server-only persistence around the pure scorer in
 * `lib/demo/cupe4373-cognition-core.ts`. Persists every result with full
 * provenance (`features_json`) and a versioned `ml_models` row.
 */

import 'server-only';
import { sql } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core/telemetry';

import { db } from '@/db/db';
import type { DemoCase } from '@/lib/demo/cupe4373-demo';

const log = createLogger('cupe4373-cognition');
import {
  PRIORITY_FEATURE_SPEC,
  PRIORITY_MODEL_ALGORITHM,
  PRIORITY_MODEL_KEY,
  PRIORITY_MODEL_VERSION,
  scoreCaseFeatures,
  type PriorityFeatures,
  type PriorityScore,
} from '@/lib/demo/cupe4373-cognition-core';

export {
  deriveCaseUuid,
  scoreCaseFeatures,
} from '@/lib/demo/cupe4373-cognition-core';
export type {
  PriorityFeatures,
  PriorityScore,
} from '@/lib/demo/cupe4373-cognition-core';

const FOUNDATION_ORG_ID =
  process.env.NZILA_FOUNDATION_ORG_ID ?? 'a4373000-0000-4000-8000-000000000001';
const FOUNDATION_ENTITY_ID =
  process.env.NZILA_FOUNDATION_ENTITY_ID ??
  'a4373000-0000-4000-8000-000000000010';

export type PersistedPriorityScore = PriorityScore & {
  scoreId: string;
  modelId: string;
  occurredAt: string;
  modelKey: string;
  modelVersion: number;
};

export async function ensurePriorityModel(): Promise<string | null> {
  try {
    await db.execute(sql`
      INSERT INTO ml_models (
        entity_id, model_key, algorithm, version, status,
        hyperparams_json, feature_spec_json, approved_by, approved_at,
        created_at, updated_at
      ) VALUES (
        ${FOUNDATION_ENTITY_ID}::uuid,
        ${PRIORITY_MODEL_KEY}::text,
        ${PRIORITY_MODEL_ALGORITHM}::text,
        ${PRIORITY_MODEL_VERSION},
        'active'::ml_model_status,
        ${'{}'}::jsonb,
        ${JSON.stringify(PRIORITY_FEATURE_SPEC)}::jsonb,
        ${'system:foundation-seed'}::text,
        now(),
        now(), now()
      )
      ON CONFLICT (entity_id, model_key, version) DO UPDATE
        SET status = 'active',
            feature_spec_json = EXCLUDED.feature_spec_json,
            updated_at = now();
    `);
    const rows = (await db.execute(sql`
      SELECT id::text AS id
        FROM ml_models
       WHERE entity_id = ${FOUNDATION_ENTITY_ID}::uuid
         AND model_key = ${PRIORITY_MODEL_KEY}::text
         AND version = ${PRIORITY_MODEL_VERSION}
       LIMIT 1;
    `)) as any as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  } catch (err) {
    log.warn('ensurePriorityModel failed', { error: err });
    return null;
  }
}

export async function recordPriorityScore(
  demoCase: DemoCase,
  caseUuid: string,
): Promise<PersistedPriorityScore | null> {
  const modelId = await ensurePriorityModel();
  if (!modelId) return null;

  const computed = scoreCaseFeatures(demoCase);
  const occurredAt = new Date().toISOString();

  const envelope = {
    schemaVersion: 1,
    provenance: {
      modelKey: PRIORITY_MODEL_KEY,
      modelVersion: PRIORITY_MODEL_VERSION,
      algorithm: PRIORITY_MODEL_ALGORITHM,
      computedAt: occurredAt,
      source: 'cupe4373-cognition.recordPriorityScore',
      orgId: FOUNDATION_ORG_ID,
    },
    features: computed.features,
  };

  try {
    await db.execute(sql`
      INSERT INTO ml_scores_ue_cases_priority (
        entity_id, case_id, occurred_at, score, predicted_priority,
        features_json, model_id
      ) VALUES (
        ${FOUNDATION_ENTITY_ID}::uuid,
        ${caseUuid}::uuid,
        ${occurredAt}::timestamptz,
        ${computed.score},
        ${computed.predictedPriority}::text,
        ${JSON.stringify(envelope)}::jsonb,
        ${modelId}::uuid
      )
      ON CONFLICT (entity_id, case_id, model_id) DO UPDATE
        SET score = EXCLUDED.score,
            predicted_priority = EXCLUDED.predicted_priority,
            features_json = EXCLUDED.features_json,
            occurred_at = EXCLUDED.occurred_at;
    `);
  } catch (err) {
    log.warn('recordPriorityScore failed', { error: err });
    return null;
  }

  const rows = (await db.execute(sql`
    SELECT id::text         AS id,
           occurred_at      AS occurred_at
      FROM ml_scores_ue_cases_priority
     WHERE entity_id = ${FOUNDATION_ENTITY_ID}::uuid
       AND case_id   = ${caseUuid}::uuid
       AND model_id  = ${modelId}::uuid
     LIMIT 1;
  `)) as any as Array<{ id: string; occurred_at: string | Date }>;

  return {
    ...computed,
    scoreId: rows[0]?.id ?? '',
    modelId,
    occurredAt:
      rows[0]?.occurred_at instanceof Date
        ? rows[0].occurred_at.toISOString()
        : (rows[0]?.occurred_at as string) ?? occurredAt,
    modelKey: PRIORITY_MODEL_KEY,
    modelVersion: PRIORITY_MODEL_VERSION,
  };
}

export async function getLatestPriorityScoreForCase(
  caseUuid: string,
): Promise<PersistedPriorityScore | null> {
  try {
    const rows = (await db.execute(sql`
      SELECT s.id::text             AS id,
             s.score                AS score,
             s.predicted_priority   AS predicted_priority,
             s.features_json        AS features_json,
             s.occurred_at          AS occurred_at,
             s.model_id::text       AS model_id,
             m.model_key            AS model_key,
             m.version              AS model_version
        FROM ml_scores_ue_cases_priority s
        JOIN ml_models m ON m.id = s.model_id
       WHERE s.entity_id = ${FOUNDATION_ENTITY_ID}::uuid
         AND s.case_id   = ${caseUuid}::uuid
       ORDER BY s.occurred_at DESC
       LIMIT 1;
    `)) as any as Array<{
      id: string;
      score: string | number;
      predicted_priority: 'p0' | 'p1' | 'p2' | 'p3';
      features_json: { features?: PriorityFeatures } & Record<string, unknown>;
      occurred_at: string | Date;
      model_id: string;
      model_key: string;
      model_version: number;
    }>;
    const r = rows[0];
    if (!r) return null;
    const features =
      (r.features_json?.features as PriorityFeatures | undefined) ??
      (r.features_json as any as PriorityFeatures);
    return {
      score: typeof r.score === 'string' ? Number(r.score) : r.score,
      predictedPriority: r.predicted_priority,
      features,
      scoreId: r.id,
      modelId: r.model_id,
      modelKey: r.model_key,
      modelVersion: r.model_version,
      occurredAt:
        r.occurred_at instanceof Date
          ? r.occurred_at.toISOString()
          : (r.occurred_at as string),
    };
  } catch (err) {
    log.warn('getLatestPriorityScoreForCase failed', { error: err });
    return null;
  }
}

/**
 * Returns the latest persisted score; if none exists, computes + persists
 * a fresh one. Used by the case detail page for lazy backfill.
 */
export async function getOrComputePriorityScoreForCase(
  demoCase: DemoCase,
  caseUuid: string,
): Promise<PersistedPriorityScore | null> {
  const existing = await getLatestPriorityScoreForCase(caseUuid);
  if (existing) return existing;
  return recordPriorityScore(demoCase, caseUuid);
}
