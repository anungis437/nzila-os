import { beforeAll, describe, expect, it } from 'vitest'
import { buildCompatibility, generateCompatibility, outputs } from './implement-w5-compatibility'
import { read } from './w4-physical-producers'
import { replayHash } from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'

const wheelhouse = process.env.UE_FAKE_DJANGO_WHEELHOUSE
let model: Awaited<ReturnType<typeof buildCompatibility>>

describe.skipIf(!wheelhouse)('final authorized compatibility charter; no runtime authority', () => {
  beforeAll(async () => {
    if (!wheelhouse) throw new Error('UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
    model = await buildCompatibility(wheelhouse)
  }, 240000)

  it('supersedes exactly one payload without changing source or historical packets', () => {
    expect(model.result.AUTHORIZED_SUPERSESSIONS).toBe(1)
    expect(model.result.SOURCE_BASELINE_UNCHANGED).toBe(true)
    expect(model.result.W4P_ATOMIC_DENIAL).toMatch(/^W5_COMPAT_W4P_INDEPENDENT_DENIAL:/)
    expect(model.result.W4P_PARTIAL_PROMOTION_ROLLED_BACK).toBe(true)
    expect(model.census.afterMembershipOverlay.filter((entry) => entry.superseded)).toHaveLength(1)
    for (const [file, digest] of Object.entries(model.result.PRESERVATION_SHA256))
      expect(replayHash(read(file))).toBe(digest)
    expect(model.authority.sourceForeignKey).toMatchObject({
      delete_action: 'a',
      update_action: 'a',
      deferrable: true,
      deferred: true,
    })
  })

  it('accounts for all162 and refuses unauthorized tightening of three independent source columns', () => {
    expect(model.census.before).toHaveLength(162)
    expect(model.census.afterMembershipOverlay).toHaveLength(162)
    expect(model.result.CENSUS_BEFORE_OVERLAY).toEqual({
      ABSENT: 114,
      PRESENT_MATCHING: 37,
      PRESENT_DRIFTED: 4,
      PRECONDITION_MISSING: 7,
    })
    expect(model.result.CENSUS_AFTER_MEMBERSHIP_OVERLAY_BEFORE_REMAINING_W4P).toEqual({
      ABSENT: 114,
      PRESENT_MATCHING: 38,
      PRESENT_DRIFTED: 3,
      PRECONDITION_MISSING: 7,
    })
    const drift = model.result.RESIDUALS.filter(
      (entry) => entry.classification === 'INDEPENDENT_TRUE_CONTRADICTION',
    )
    expect(drift.map((entry) => entry.name).sort()).toEqual([
      'claims',
      'grievances',
      'security_events',
    ])
    for (const entry of drift) {
      expect(entry.inspection.REASONS).toEqual(['organization_id:NULLABILITY_DRIFT'])
      expect(
        entry.expectedColumns.find((column) => column.name === 'organization_id'),
      ).toMatchObject({ postgresType: 'uuid', notNull: true })
      expect(
        entry.actualRelation?.columns.find((column) => column.name === 'organization_id'),
      ).toMatchObject({ postgresType: 'uuid', notNull: false })
      expect(entry.reason).toContain('not a necessary consequence')
      expect(entry.sourceOrigins.length).toBeGreaterThan(0)
      expect(replayHash(entry.historicalSql)).toBe(entry.sqlHash)
    }
  })

  it('classifies all seven missing operands and does not turn historical fixture context into a producer', () => {
    const missing = model.result.RESIDUALS.filter(
      (entry) => entry.classification === 'REAL_UNRESOLVED_PRECONDITION',
    )
    expect(missing.map((entry) => entry.name).sort()).toEqual([
      'cms_pages',
      'donation_campaigns',
      'integration_configs',
      'ml_predictions',
      'model_metadata',
      'social_accounts',
      'votes',
    ])
    for (const entry of missing) {
      expect(entry.prerequisiteProducers.length).toBeGreaterThan(0)
      expect(
        entry.prerequisiteProducers.every(
          (producer) => producer.w4pPayloadIds.length === 0 && !producer.supplementProducer,
        ),
      ).toBe(true)
    }
  })

  it('issues the required terminal gate rather than another charter or successor PASS', () => {
    expect(model.result.W5).toBe('BLOCKED_TERMINAL_STATIC')
    expect(model.result.PHASE_1B_3C_A1I_W5B).toBe('BLOCKED_TERMINAL_STATIC')
    expect(model.result.W6).toBe('NOT_AUTHORIZED')
    expect(model.result.CANONICAL_CONTRACT_VERSION).toBe('1.3.3')
    expect(model.result.QUALIFICATION).toMatchObject({
      OPERATIONAL_VERIFIED: 0,
      TOTAL_VERIFIED_IN_THIS_CHARTER: 0,
      FRESH_REPLAY: 'NOT_RUN_W4P_PRECONDITION_DENIED',
      REPLAY_NOOP: 'NOT_PROVEN',
      FULL_GRAPH_ROLLBACK: 'NOT_PROVEN',
      REPLAY_RECEIPT_PUBLISHED: false,
      SUCCESSOR_EXECUTED: false,
    })
    expect(model.result.E048.SOURCE_BYTES_CHANGED).toBe(false)
    expect(model.result.E048.SOURCE_FILE).toBeTruthy()
    expect(model.result.FROZEN_DENOMINATORS).toEqual({
      NODES: 107,
      EDGES: 231,
      COMPATIBILITY_RECORDS: 127,
      HANDOFF_RECORDS: 86,
      DEFERRED_CONSTRAINTS: 7,
      UNRESOLVED_DOWNSTREAM_OPERANDS: 9,
    })
    expect(model.result.PROOF_BOUNDARIES).toMatchObject({
      DATABASE_CONNECTIONS: 0,
      SQL_EXECUTED_AGAINST_DATABASE: 0,
      LIVE_EXECUTION: 0,
      G3_REOPENED: 'NO',
      MERGE: 'NO',
      PR: 'NO',
      DEPLOY: 'NO',
    })
  })

  it('generates deterministically and checks all ten persisted prospective outputs', async () => {
    if (!wheelhouse) throw new Error('UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
    const first = await generateCompatibility(wheelhouse)
    expect(Object.keys(first).sort()).toEqual(Object.values(outputs).sort())
    expect(await generateCompatibility(wheelhouse)).toEqual(first)
    for (const [file, bytes] of Object.entries(first)) expect(read(file)).toBe(bytes)
  }, 240000)
})
