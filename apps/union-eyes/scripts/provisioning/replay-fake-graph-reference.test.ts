import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { replayDigest, replayHash, replayObject } from './post-w4p-replay'
import { executionPlanDigest, applyReplayScope } from './post-w4p-execution'
import type { ReplayPositionPin } from './replay-position-authority'
import { FakeReplayCatalog } from './replay-fake-catalog'
import {
  buildFakeNativeGraphReference,
  makeFakeNativeReferenceAdapter,
  makeFakeNativeReferenceHandlers,
} from './replay-fake-graph-reference'

const { frozen, sourceBytes } = loadFrozenReplay()
const plan = compileReplayUnitPlan(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  replayDigest('fake-reference-supplement'),
)
const pin: ReplayPositionPin = {
  database: 'fake_financial',
  searchPath: ['pg_catalog', 'public'],
  execution: {
    scope: 'FINANCIAL_SERVICE',
    actorClass: 'MIGRATION_ADMIN',
    actorPrincipal: 'fake_admin',
    targetDigest: replayDigest('fake-financial-target'),
    w4pPlanDigest: plan.specification.w4pPlanDigest,
    w4pVerificationDigest: replayDigest('fake-financial-w4p'),
    supplementPlanDigest: plan.specification.supplementPlanDigest,
    supplementVerificationDigest: replayDigest('fake-financial-keys'),
    exclusiveExecutionReference: 'fake-native-only',
  },
}
function catalog() {
  return new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: ['fake_admin'],
    database: pin.database,
    functionContext: {
      actor: 'fake_admin',
      creationSchema: 'public',
      searchPath: [...pin.searchPath],
      defaultAcl: [],
    },
  })
}
const authorization = {
  purpose: 'POST_W4P_REPLAY' as const,
  executionApproved: true as const,
  planDigest: executionPlanDigest(plan.specification),
  graphDigest: plan.specification.graphDigest,
  scope: pin.execution.scope,
  targetDigest: pin.execution.targetDigest,
  actorPrincipal: pin.execution.actorPrincipal,
  w4pVerificationDigest: pin.execution.w4pVerificationDigest,
  supplementVerificationDigest: pin.execution.supplementVerificationDigest,
}

describe('native reference qualification; financial no-effect scope only, not full107 proof', () => {
  it('qualifies source deterministically on an independent fork without mutating the input', async () => {
    const fake = catalog(),
      before = fake.digest()
    const first = await buildFakeNativeGraphReference(plan, pin, fake)
    const second = await buildFakeNativeGraphReference(plan, pin, fake)
    expect(first).toEqual(second)
    expect(first.unitIds).toHaveLength(1)
    expect(first.sourcePositionVerificationDigests).toEqual([])
    expect(first.executionAuthorized).toBe(false)
    expect(fake.digest()).toBe(before)
    expect(fake.trace).toEqual([])
  })

  it('does not accept fabricated reference objects or substitute live readers', async () => {
    const fake = catalog(),
      reference = await buildFakeNativeGraphReference(plan, pin, fake)
    expect(() => makeFakeNativeReferenceHandlers({ ...reference })).toThrow(
      'FAKE_NATIVE_REFERENCE_AUTHENTIC_REFERENCE_REQUIRED',
    )
    const handler = makeFakeNativeReferenceHandlers(reference)[0]
    const unit = plan.specification.units.find(
      (candidate) => candidate.node.REPLAY_UNIT_ID === handler.unitId,
    )!
    await expect(handler.inspect(fake, pin.execution, unit, null)).rejects.toThrow(
      'FAKE_NATIVE_REFERENCE_NATIVE_ADAPTER_REQUIRED',
    )
  })

  it('excludes execution receipts from physical state, not schema/roles/rows', () => {
    const fake = catalog(),
      digest = fake.physicalDigest()
    fake.stageReceipt('receipt', { marker: 'nonphysical' })
    expect(fake.physicalDigest()).toBe(digest)
    expect(fake.fork().physicalDigest()).toBe(digest)
    expect(fake.digest()).not.toBe(digest)
  })

  it('qualifies financial noop through the real runner with zero native sends', async () => {
    const fake = catalog(),
      reference = await buildFakeNativeGraphReference(plan, pin, fake)
    const handlers = makeFakeNativeReferenceHandlers(reference)
    const remaining = plan.specification.units
      .filter((unit) => unit.node.DATABASE_SCOPE !== pin.execution.scope)
      .map((unit) => ({
        unitId: String(unit.node.REPLAY_UNIT_ID),
        contractDigest: unit.contractDigest,
        async inspect(): Promise<never> {
          throw new Error('OTHER_SCOPE_MUST_NOT_RUN')
        },
      }))
    const receipt = await applyReplayScope(
      plan.specification,
      pin.execution,
      [...remaining, ...handlers],
      makeFakeNativeReferenceAdapter(fake, reference),
      authorization,
    )
    expect(receipt).toMatchObject({ REPLAYED: 0, NOOP: 1 })
    expect(fake.trace.filter((entry) => entry.startsWith('FAKE_UNIT_TRANSITION:'))).toEqual([])
    const again = await applyReplayScope(
      plan.specification,
      pin.execution,
      [...remaining, ...handlers],
      makeFakeNativeReferenceAdapter(fake, reference),
      authorization,
    )
    expect(again).toMatchObject({ REPLAYED: 0, NOOP: 1 })
    expect(fake.trace.filter((entry) => entry.startsWith('FAKE_UNIT_TRANSITION:'))).toEqual([])
  })

  it('restores native receipts on commit failure and returns no success result', async () => {
    const fake = catalog(),
      before = fake.digest()
    const reference = await buildFakeNativeGraphReference(plan, pin, fake)
    const handlers = makeFakeNativeReferenceHandlers(reference)
    const remaining = plan.specification.units
      .filter((unit) => unit.node.DATABASE_SCOPE !== pin.execution.scope)
      .map((unit) => ({
        unitId: String(unit.node.REPLAY_UNIT_ID),
        contractDigest: unit.contractDigest,
        async inspect(): Promise<never> {
          throw new Error('OTHER_SCOPE_MUST_NOT_RUN')
        },
      }))
    await expect(
      applyReplayScope(
        plan.specification,
        pin.execution,
        [...remaining, ...handlers],
        makeFakeNativeReferenceAdapter(fake, reference, true),
        authorization,
      ),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(fake.digest()).toBe(before)
    expect(fake.readReceipt(handlers[0].unitId)).toBeNull()
  })

  it('does not turn canonical receipts into permission to ignore physical drift', async () => {
    const fake = catalog(),
      reference = await buildFakeNativeGraphReference(plan, pin, fake)
    const handlers = makeFakeNativeReferenceHandlers(reference)
    const remaining = plan.specification.units
      .filter((unit) => unit.node.DATABASE_SCOPE !== pin.execution.scope)
      .map((unit) => ({
        unitId: String(unit.node.REPLAY_UNIT_ID),
        contractDigest: unit.contractDigest,
        async inspect(): Promise<never> {
          throw new Error('OTHER_SCOPE_MUST_NOT_RUN')
        },
      }))
    await applyReplayScope(
      plan.specification,
      pin.execution,
      [...remaining, ...handlers],
      makeFakeNativeReferenceAdapter(fake, reference),
      authorization,
    )
    const source = 'CREATE TABLE unauthorized_extra (id uuid PRIMARY KEY);'
    await fake.applyFrozenUnit(source, replayHash(source))
    const before = fake.digest()
    await expect(
      applyReplayScope(
        plan.specification,
        pin.execution,
        [...remaining, ...handlers],
        makeFakeNativeReferenceAdapter(fake, reference),
        authorization,
      ),
    ).rejects.toThrow('REPLAY_UNIT_DENIED')
    expect(fake.digest()).toBe(before)
  })

  it('rejects malformed receipt action types rather than coercing them', async () => {
    const fake = catalog(),
      reference = await buildFakeNativeGraphReference(plan, pin, fake)
    const handlers = makeFakeNativeReferenceHandlers(reference)
    const remaining = plan.specification.units
      .filter((unit) => unit.node.DATABASE_SCOPE !== pin.execution.scope)
      .map((unit) => ({
        unitId: String(unit.node.REPLAY_UNIT_ID),
        contractDigest: unit.contractDigest,
        async inspect(): Promise<never> {
          throw new Error('OTHER_SCOPE_MUST_NOT_RUN')
        },
      }))
    await applyReplayScope(
      plan.specification,
      pin.execution,
      [...remaining, ...handlers],
      makeFakeNativeReferenceAdapter(fake, reference),
      authorization,
    )
    const stored = replayObject(fake.readReceipt(handlers[0].unitId))
    fake.stageReceipt(handlers[0].unitId, { ...stored, ACTION: Object('NOOP') })
    const adapter = makeFakeNativeReferenceAdapter(fake, reference)
    await expect(
      adapter.withExclusiveTransaction((client) => client.readReceipt(handlers[0].unitId)),
    ).rejects.toThrow('FAKE_NATIVE_REFERENCE_STORED_RECEIPT_INVALID')
  })
})
