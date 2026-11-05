import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { organizations } from '@/db/schema-organizations'
import { mlPredictions, modelMetadata, mlPredictionFeedback } from '@/db/schema/domains/ml/predictions'
import { createTableDatabase } from './support/pglite-tables'

// Replaces the earlier mock-only test of this route (disclosed). The route now records each outcome as its own append-only row; the
// earlier version rewrote model_metadata.parameters, which the runtime role may not UPDATE. These tests run the real statements.
const state = vi.hoisted(() => ({ db: null as unknown, config: null as unknown }))
vi.mock('@/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables')
  return { db: lateBoundDb(state) }
})
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: (...a: unknown[]) => audit(...a) }))
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: async () => null }))
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { GRIEVANCE_TRIAGE: 'g' } }))
vi.mock('@nzila/policies', () => ({ enforceAISafety: () => undefined }))
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: async () => undefined }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod')
  const err = (status: number) => (msg: string) => Object.assign(new Error(msg), { status })
  return {
    z,
    RATE_LIMITS: { ML_PREDICTIONS: {} },
    withApi: (cfg: unknown, handler: (c: unknown) => Promise<unknown>) => {
      state.config = cfg
      return (c: unknown) => handler(c)
    },
    ApiError: { badRequest: err(400), notFound: err(404), conflict: err(409) },
  }
})

const audit = vi.fn(async () => undefined)
const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const P2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const P_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
let pg: PGlite

const prediction = (id: string, org: string, value: string, version = 'sla-risk-v1') =>
  pg.query(`INSERT INTO ml_predictions (id, organization_id, prediction_type, prediction_date, predicted_value, model_version) VALUES ($1::uuid, $2::uuid, 'sla_breach_risk', now(), $3, $4)`, [id, org, value, version])
const call = async (method: 'POST' | 'GET', ctx: Record<string, unknown>) => {
  const route = await import('../ml/predictions/sla-breach-risk/feedback/route')
  return (route[method] as unknown as (c: unknown) => Promise<unknown>)({ organizationId: ORG_A, userId: 'u1', body: {}, query: {}, ...ctx })
}

beforeAll(async () => {
  const created = await createTableDatabase(
    [organizations, mlPredictions, modelMetadata, mlPredictionFeedback],
    // The generated DDL carries columns only; the unique index is the one platform migration 0047 creates.
    ['CREATE UNIQUE INDEX ml_prediction_feedback_prediction_uq ON ml_prediction_feedback (prediction_id)'],
  )
  pg = created.pg
  state.db = created.db
})
afterAll(async () => { await pg.close() })
beforeEach(async () => {
  audit.mockClear()
  await pg.exec('TRUNCATE ml_prediction_feedback, ml_predictions, model_metadata, organizations CASCADE')
  for (const [id, slug] of [[ORG_A, 'a'], [ORG_B, 'b']]) {
    await pg.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path) VALUES ($1, $2, $2, 'local', ARRAY[]::uuid[])`, [id, slug])
    await pg.query(`INSERT INTO model_metadata (organization_id, model_type, version) VALUES ($1, 'sla_breach_risk', 'sla-risk-v1')`, [id])
  }
  await prediction(P1, ORG_A, '0.8')
  await prediction(P2, ORG_A, '0.2')
  await prediction(P_B, ORG_B, '0.5')
})

describe('SLA prediction feedback', () => {
  it('records the outcome as its own row, leaves model_metadata untouched and audits the new row', async () => {
    const before = (await pg.query<{ parameters: unknown; accuracy: string | null }>(`SELECT parameters, accuracy FROM model_metadata WHERE organization_id = $1`, [ORG_A])).rows[0]
    const result = (await call('POST', { body: { predictionId: P1, actualBreach: true, comment: 'late' } })) as { metrics: { observations: number; meanAbsoluteError: number }; retrainRecommended: boolean }
    expect(result.metrics).toMatchObject({ observations: 1, meanAbsoluteError: 0.2 })
    expect(result.retrainRecommended).toBe(false)
    const rows = (await pg.query<{ abs_error: string; comment: string }>(`SELECT abs_error, comment FROM ml_prediction_feedback`)).rows
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].abs_error)).toBeCloseTo(0.2)
    expect((await pg.query(`SELECT parameters, accuracy FROM model_metadata WHERE organization_id = $1`, [ORG_A])).rows[0]).toEqual(before)
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ml.sla_breach.feedback', resourceType: 'ml_prediction_feedback' }))
  })

  it('computes the statistics from the recorded rows', async () => {
    await call('POST', { body: { predictionId: P1, actualBreach: true } })
    const second = (await call('POST', { body: { predictionId: P2, actualBreach: true } })) as { metrics: { observations: number; meanAbsoluteError: number } }
    expect(second.metrics.observations).toBe(2)
    expect(second.metrics.meanAbsoluteError).toBeCloseTo(0.5)
    const summary = (await call('GET', { query: {} })) as { feedbackStats: { observations: number }; retrainSignal: { consumedBy: null } }
    expect(summary.feedbackStats.observations).toBe(2)
    expect(summary.retrainSignal.consumedBy).toBeNull()
  })

  it('refuses a second outcome for one prediction and counts nothing twice', async () => {
    await call('POST', { body: { predictionId: P1, actualBreach: true } })
    await expect(call('POST', { body: { predictionId: P1, actualBreach: false } })).rejects.toMatchObject({ status: 409 })
    expect((await pg.query(`SELECT count(*)::int AS n FROM ml_prediction_feedback`)).rows[0]).toMatchObject({ n: 1 })
  })

  it('does not find another organization\'s prediction, an unknown model version or a version the prediction did not record', async () => {
    await expect(call('POST', { body: { predictionId: P_B, actualBreach: true } })).rejects.toMatchObject({ status: 404 })
    await expect(call('POST', { body: { predictionId: P1, actualBreach: true, modelVersion: 'other' } })).rejects.toMatchObject({ status: 404 })
    await pg.query(`INSERT INTO model_metadata (organization_id, model_type, version) VALUES ($1, 'sla_breach_risk', 'v2')`, [ORG_A])
    await expect(call('POST', { body: { predictionId: P1, actualBreach: true, modelVersion: 'v2' } })).rejects.toMatchObject({ status: 409 })
    expect((await pg.query(`SELECT count(*)::int AS n FROM ml_prediction_feedback`)).rows[0]).toMatchObject({ n: 0 })
  })

  it('refuses a request with no organization', async () => {
    await expect(call('POST', { organizationId: null, body: { predictionId: P1, actualBreach: true } })).rejects.toMatchObject({ status: 400 })
  })

  it('reads the summary at the steward floor', async () => {
    const route = await import('../ml/predictions/sla-breach-risk/feedback/route')
    void route
    expect((state.config as { auth: { minRole: string } }).auth.minRole).toBe('steward')
  })
})
