import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { buildSupplement } from '../../../../scripts/ue/implement-w5bpk-parent-key-supplement'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { replayDigest } from './post-w4p-replay'
import { supplementPlanDigest } from './parent-key-supplement'
import type { ReplayPositionPin } from './replay-position-authority'
import {
  createFakeSourceIncomingCatalog,
  createFakeSourceReplayPredecessor,
  createFakeCanonicalW4pReplayPredecessor,
  inspectFakeSourceW4pCompatibility,
  promoteFakeSourceIncomingCatalog,
} from './replay-fake-source-fixture'
import { buildFakeNativeGraphReference } from './replay-fake-graph-reference'

const wheelhouse = process.env.UE_FAKE_DJANGO_WHEELHOUSE
const { frozen, sourceBytes } = loadFrozenReplay()
const supplement = buildSupplement().plan.SPECIFICATION
const plan = compileReplayUnitPlan(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  supplementPlanDigest(supplement),
)
const pin: ReplayPositionPin = {
  database: 'fake_operational',
  searchPath: ['public', 'pg_catalog'],
  execution: {
    scope: 'UE_OPERATIONAL',
    actorClass: 'MIGRATION_ADMIN',
    actorPrincipal: 'fake_admin',
    targetDigest: replayDigest('source-bound-fake-target'),
    w4pPlanDigest: plan.specification.w4pPlanDigest,
    w4pVerificationDigest: replayDigest('source-bound-fake-w4p'),
    supplementPlanDigest: plan.specification.supplementPlanDigest,
    supplementVerificationDigest: replayDigest('source-bound-fake-keys'),
    exclusiveExecutionReference: 'fake-native-source-only',
  },
}

it('rejects nonoperational source-fixture pins before loading incoming authority', async () => {
  await expect(
    createFakeSourceIncomingCatalog(
      plan,
      { ...pin, execution: { ...pin.execution, scope: 'FINANCIAL_SERVICE' } },
      process.cwd(),
      'not-a-wheelhouse',
    ),
  ).rejects.toThrow('FAKE_SOURCE_FIXTURE_OPERATIONAL_SCOPE_REQUIRED')
})

describe.skipIf(!wheelhouse)(
  'offline source contradictions and conditional graph acceptance; requires hash-locked wheelhouse',
  () => {
    it('inventories all canonical predecessor incompatibilities without repairing source state', async () => {
      if (!wheelhouse) throw new Error('UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
      const incoming = await createFakeSourceIncomingCatalog(plan, pin, process.cwd(), wheelhouse)
      const before = incoming.catalog.digest()
      const census = await inspectFakeSourceW4pCompatibility(incoming)
      expect(incoming.catalog.digest()).toBe(before)
      expect(incoming.helperTargets).toBe(320)
      expect(incoming.sourceProducedIncomingTargets).toBe(215)
      expect(incoming.boundaryProducedTargets).toBe(105)
      expect(incoming.unresolvedTargets).toEqual([])
      expect(census.records).toHaveLength(162)
      expect(census.executionAuthorized).toBe(false)
      expect(
        census.records.reduce<Record<string, number>>((counts, record) => {
          counts[record.inspection.STATE] = (counts[record.inspection.STATE] ?? 0) + 1
          return counts
        }, {}),
      ).toEqual({
        ABSENT: 114,
        PRESENT_MATCHING: 37,
        PRECONDITION_MISSING: 7,
        PRESENT_DRIFTED: 4,
      })
      expect(
        census.denied
          .filter((record) => record.inspection.STATE === 'PRESENT_DRIFTED')
          .map((record) => record.name)
          .sort(),
      ).toEqual(['claims', 'grievances', 'organization_members', 'security_events'])
      expect(
        census.denied
          .filter((record) => record.inspection.STATE === 'PRECONDITION_MISSING')
          .map((record) => record.name)
          .sort(),
      ).toEqual([
        'cms_pages',
        'donation_campaigns',
        'integration_configs',
        'ml_predictions',
        'model_metadata',
        'social_accounts',
        'votes',
      ])
      const membership = census.denied.find((record) => record.name === 'organization_members')
      expect(membership?.payloadId).toBe('UE-W4FR4-PAYLOAD-09ef3aefb86ca556')
      expect(membership?.sqlHash).toBe(
        '86320b5ed5efccf878808112837aa2df58b7a46e151b5faf5c104f71f210d578',
      )
      expect(membership?.inspection.REASONS).toEqual([
        'organization_id:TYPE_DRIFT',
        'MATERIALIZED_UNIQUE_DRIFT:unique_org_membership',
      ])
      expect(
        membership?.actualRelation?.columns.find((column) => column.name === 'organization_id'),
      ).toMatchObject({ postgresType: 'uuid', notNull: true, defaultExpression: null })
      expect(membership?.actualRelation?.uniqueConstraints).toEqual([])
      expect(membership?.sourceOrigins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            migration: 'auth_core::0001_initial',
            sha256: 'ab91029c78c5d7ae6736a4da8ecf3b5fe13e3f0e046607b5d52cc60f05083f1a',
          }),
        ]),
      )
      expect(await inspectFakeSourceW4pCompatibility(incoming)).toEqual(census)
      expect(incoming.catalog.digest()).toBe(before)
      await expect(promoteFakeSourceIncomingCatalog(incoming)).rejects.toThrow(
        'FAKE_SOURCE_FIXTURE_PAYLOAD_DENIED:UE-W4FR4-PAYLOAD-09ef3aefb86ca556:organization_id:TYPE_DRIFT,MATERIALIZED_UNIQUE_DRIFT:unique_org_membership',
      )
      expect(incoming.catalog.digest()).toBe(before)
      expect(incoming.catalog.physicalDigest()).toBe(census.physicalDigest)
      expect(incoming.catalog.trace.at(-1)).toBe('FAKE_ROLLBACK')
    }, 240000)

    it('denies the actual Django-to-W4P predecessor contradiction without issuing replay proof', async () => {
      if (!wheelhouse) throw new Error('UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
      await expect(
        createFakeSourceReplayPredecessor(plan, pin, process.cwd(), wheelhouse),
      ).rejects.toThrow(
        'FAKE_SOURCE_FIXTURE_PAYLOAD_DENIED:UE-W4FR4-PAYLOAD-09ef3aefb86ca556:organization_id:TYPE_DRIFT,MATERIALIZED_UNIQUE_DRIFT:unique_org_membership',
      )
    }, 240000)

    it('qualifies all106/762 conditional on the canonical W4P input, not Django reachability', async () => {
      if (!wheelhouse) throw new Error('UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
      const predecessor = await createFakeCanonicalW4pReplayPredecessor(
        plan,
        pin,
        process.cwd(),
        wheelhouse,
      )
      expect(predecessor.inputModel).toBe('ASSUMED_VERIFIED_CANONICAL_W4P')
      expect(predecessor.djangoToW4pProven).toBe(false)
      for (const key of supplement.definitions)
        await predecessor.catalog.applyFrozenUnit(key.sql, key.sqlDigest)
      const reference = await buildFakeNativeGraphReference(plan, pin, predecessor.catalog)
      expect(reference.unitIds).toHaveLength(106)
      expect(reference.sourcePositionVerificationDigests).toHaveLength(762)
      expect(reference.executionAuthorized).toBe(false)
    }, 240000)

    it('denies the frozen uncast canonical text-to-UUID backfill and leaves no certified reference', async () => {
      if (!wheelhouse) throw new Error('UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
      const predecessor = await createFakeCanonicalW4pReplayPredecessor(
        plan,
        pin,
        process.cwd(),
        wheelhouse,
      )
      for (const key of supplement.definitions)
        await predecessor.catalog.applyFrozenUnit(key.sql, key.sqlDigest)
      const before = predecessor.catalog.digest()
      await expect(buildFakeNativeGraphReference(plan, pin, predecessor.catalog)).rejects.toThrow(
        'FAKE_BACKFILL_NATIVE_ASSIGNMENT_TYPE_MISMATCH:pg_catalog.text->pg_catalog.uuid',
      )
      expect(predecessor.catalog.digest()).toBe(before)
      expect(predecessor.executionAuthorized).toBe(false)
      expect(predecessor.djangoToW4pProven).toBe(false)
    }, 240000)
  },
)
