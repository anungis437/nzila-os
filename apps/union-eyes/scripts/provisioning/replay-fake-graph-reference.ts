import { ProvisioningError } from './governed-provisioning'
import type { CatalogReader } from './platform-baseline-promotion'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import {
  executionPlanDigest,
  verifyUnitReceipt,
  type ReplayExecutionClient,
  type ReplayExecutionContext,
  type ReplayExclusiveAdapter,
  type ReplayInspectionWitness,
  type ReplayUnitHandler,
  type ReplayUnitObservation,
  type ReplayUnitReceipt,
} from './post-w4p-execution'
import type { compileReplayUnitPlan } from './replay-unit-plan'
import { makeCreateReplayHandler } from './replay-create-inspection'
import { makeEnumReplayHandler, makeNoEffectReplayHandler } from './replay-enum-inspection'
import {
  positionAuthorityQueries,
  type ReplayPositionPin,
  type ReplayPositionRead,
} from './replay-position-authority'
import { proceduralQueries } from './replay-procedural-inspection'
import { ReplayPositionSession } from './replay-position-session'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { qualifyFakeOriginalBoundary } from './replay-fake-boundary-execution'
import { authenticatedTemporalReceipt } from './replay-temporal-ownership'

type UnitPlan = ReturnType<typeof compileReplayUnitPlan>
type Unit = UnitPlan['specification']['units'][number]
interface UnitFrames {
  unit: Unit
  replayed: boolean
  sourceReads: ReplayPositionRead[]
  before: string
  after: string
  final: string
}
interface ReferenceDetails {
  plan: UnitPlan
  pin: ReplayPositionPin
  units: UnitFrames[]
}
export interface FakeNativeGraphReference {
  scope: ReplayExecutionContext['scope']
  planDigest: string
  baselineStateDigest: string
  unitIds: readonly string[]
  sourcePositionVerificationDigests: readonly string[]
  referenceDigest: string
  executionAuthorized: false
}
const references = new WeakMap<FakeNativeGraphReference, ReferenceDetails>()
const clients = new WeakMap<
  CatalogReader,
  {
    reference: FakeNativeGraphReference
    catalog: FakeReplayCatalog
  }
>()
function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new ProvisioningError(`FAKE_NATIVE_REFERENCE_${code}`)
}
function semanticReads(reads: readonly ReplayPositionRead[]) {
  return reads.map((read) =>
    read.sql === positionAuthorityQueries.snapshot
      ? {
          ...read,
          rows: read.rows.map((row) => {
            requireCondition(
              row && typeof row === 'object' && 'backend' in row && typeof row.backend === 'string',
              'SNAPSHOT_BACKEND_REQUIRED',
            )
            return { backend: row.backend }
          }),
        }
      : structuredClone(read),
  )
}
function observation(
  unit: Unit,
  state: ReplayUnitObservation['state'],
  physicalStateDigest: string,
): ReplayUnitObservation {
  const body = {
    unitId: unit.node.REPLAY_UNIT_ID,
    sourceHash: replayHash(unit.sql),
    contractDigest: unit.contractDigest,
    physicalStateDigest,
  }
  return {
    state,
    ownedStateDigest: replayDigest(body),
    verificationDigest: replayDigest({ body, state }),
  }
}

/** Qualifies a separate native fork; it never treats a caller completion flag as a source observation. */
export async function buildFakeNativeGraphReference(
  incomingPlan: UnitPlan,
  incomingPin: ReplayPositionPin,
  baseline: FakeReplayCatalog,
): Promise<FakeNativeGraphReference> {
  const plan = structuredClone(incomingPlan),
    pin = structuredClone(incomingPin)
  const session = new ReplayPositionSession(plan, pin)
  const catalog = baseline.fork()
  const baselineStateDigest = catalog.physicalDigest()
  requireCondition(
    replayDigest(await catalog.query(proceduralQueries.identity, [])) ===
      replayDigest([
        {
          actor: pin.execution.actorPrincipal,
          database: pin.database,
          search_path: pin.searchPath,
        },
      ]),
    'BASELINE_IDENTITY_DRIFT',
  )
  const scoped = plan.specification.units.filter(
    (unit) => unit.node.DATABASE_SCOPE === pin.execution.scope,
  )
  const frames: UnitFrames[] = []
  for (const unit of scoped) {
    const before = catalog.physicalDigest()
    const reads: ReplayPositionRead[] = [
      {
        sql: proceduralQueries.identity,
        parameters: [],
        rows: [],
      },
    ]
    let replayed: boolean
    if (
      unit.node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT' &&
      pin.execution.scope === 'UE_OPERATIONAL'
    ) {
      await qualifyFakeOriginalBoundary(catalog, session, plan, unit)
      const positions = session
        .verifiedPositions()
        .filter((position) => position.boundaryId === unit.node.REPLAY_UNIT_ID)
      for (const position of positions)
        reads.push(
          ...position.authorityReads,
          ...position.finalAuthorityReads,
          ...position.inspectionReads,
        )
      replayed = true
    } else {
      const handler =
        unit.node.REPLAY_UNIT_CLASS === 'FROZEN_STATEMENT_UNIT'
          ? makeCreateReplayHandler(unit, plan.components.enums)
          : unit.node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT'
            ? makeEnumReplayHandler(unit)
            : makeNoEffectReplayHandler(unit)
      const recording: CatalogReader = {
        async query(sql, parameters) {
          const rows = await catalog.query(sql, parameters)
          reads.push(structuredClone({ sql, parameters, rows }))
          return rows
        },
      }
      const precondition = await handler.inspect(recording, pin.execution, unit, null)
      requireCondition(
        ['REPLAY_REQUIRED', 'ALREADY_COMPLETE'].includes(precondition.state),
        `PRIMITIVE_PRECONDITION_DENIED:${unit.node.REPLAY_UNIT_ID}:${precondition.state}`,
      )
      replayed = precondition.state === 'REPLAY_REQUIRED'
      if (replayed) await catalog.applyFrozenUnit(unit.sql, replayHash(unit.sql))
      const after = await handler.inspect(recording, pin.execution, unit, null)
      requireCondition(after.state === 'ALREADY_COMPLETE', 'PRIMITIVE_POSTCONDITION_DENIED')
    }
    frames.push({
      unit: structuredClone(unit),
      replayed,
      sourceReads: semanticReads(reads),
      before,
      after: catalog.physicalDigest(),
      final: '',
    })
  }
  requireCondition(
    scoped.length === (pin.execution.scope === 'UE_OPERATIONAL' ? 106 : 1) &&
      session.nextEffectId === null &&
      session.verifiedPositions().length === (pin.execution.scope === 'UE_OPERATIONAL' ? 762 : 0),
    'SOURCE_COVERAGE_INCOMPLETE',
  )
  for (const frame of frames) frame.final = catalog.physicalDigest()
  const body = {
    scope: pin.execution.scope,
    planDigest: executionPlanDigest(plan.specification),
    baselineStateDigest,
    unitIds: Object.freeze(scoped.map((unit) => replayText(unit.node.REPLAY_UNIT_ID))),
    sourcePositionVerificationDigests: Object.freeze(
      session.verifiedPositions().map((position) =>
        replayDigest({
          effectId: position.effectId,
          sourceHash: position.sourceHash,
          boundaryId: position.boundaryId,
          ordinal: position.ordinal,
          position: position.position,
          observation: position.observation,
          authoritySemanticReadSetDigest: position.authoritySemanticReadSetDigest,
          inspectionReadSetDigest: position.inspectionReadSetDigest,
        }),
      ),
    ),
    framesDigest: replayDigest(frames),
    executionAuthorized: false as const,
  }
  const reference = Object.freeze({
    scope: body.scope,
    planDigest: body.planDigest,
    baselineStateDigest,
    unitIds: body.unitIds,
    sourcePositionVerificationDigests: body.sourcePositionVerificationDigests,
    executionAuthorized: body.executionAuthorized,
    referenceDigest: replayDigest(body),
  })
  references.set(reference, { plan, pin, units: frames })
  return reference
}

function details(reference: FakeNativeGraphReference) {
  const value = references.get(reference)
  requireCondition(value, 'AUTHENTIC_REFERENCE_REQUIRED')
  return value
}
function matchingReceipt(
  receipt: ReplayUnitReceipt,
  frame: UnitFrames,
  reference: ReferenceDetails,
) {
  if (
    !verifyUnitReceipt(receipt, frame.unit, reference.plan.specification, reference.pin.execution)
  )
    return false
  return [frame.after, frame.final].some((reads) => {
    const expected = observation(frame.unit, 'ALREADY_COMPLETE', reads)
    return (
      receipt.OWNED_STATE_DIGEST === expected.ownedStateDigest &&
      receipt.POSTCONDITION_VERIFICATION_DIGEST === expected.verificationDigest
    )
  })
}
function canonicalHistory(reference: ReferenceDetails, witness: ReplayInspectionWitness) {
  if (witness.historicalReceipts.size !== reference.units.length) return false
  for (const frame of reference.units) {
    const id = replayText(frame.unit.node.REPLAY_UNIT_ID)
    const receipt = witness.historicalReceipts.get(id)
    if (!receipt || !matchingReceipt(receipt, frame, reference)) return false
  }
  return true
}
export function makeFakeNativeReferenceHandlers(
  reference: FakeNativeGraphReference,
): ReplayUnitHandler[] {
  const value = details(reference)
  return value.units.map((frame) => ({
    unitId: replayText(frame.unit.node.REPLAY_UNIT_ID),
    contractDigest: frame.unit.contractDigest,
    async inspect(client, context, unit, receipt, witness) {
      const native = clients.get(client)
      requireCondition(native?.reference === reference, 'NATIVE_ADAPTER_REQUIRED')
      requireCondition(
        replayDigest(context) === replayDigest(value.pin.execution) &&
          replayDigest(unit) === replayDigest(frame.unit) &&
          witness &&
          witness.planDigest === reference.planDigest &&
          witness.position ===
            value.plan.specification.units.indexOf(
              value.plan.specification.units.find(
                (candidate) => candidate.node.REPLAY_UNIT_ID === unit.node.REPLAY_UNIT_ID,
              )!,
            ) +
              1,
        'INSPECTION_BINDING_INVALID',
      )
      authenticatedTemporalReceipt(
        replayText(unit.node.REPLAY_UNIT_ID),
        value.plan.specification,
        context,
        witness,
      )
      if (receipt) requireCondition(matchingReceipt(receipt, frame, value), 'OWNED_RECEIPT_DRIFT')
      const physical = native.catalog.physicalDigest()
      const history = canonicalHistory(value, witness)
      if (witness.phase === 'FINAL_SCOPE') {
        requireCondition(
          witness.verifiedReceipts.size === value.units.length &&
            value.units.every((candidate) => {
              const verified = witness.verifiedReceipts.get(
                replayText(candidate.unit.node.REPLAY_UNIT_ID),
              )
              return verified && matchingReceipt(verified, candidate, value)
            }),
          'FINAL_RECEIPT_COVERAGE_INCOMPLETE',
        )
        return observation(
          unit,
          physical === frame.final ? 'ALREADY_COMPLETE' : 'DRIFTED',
          physical,
        )
      }
      if (history)
        return observation(
          unit,
          physical === frame.final ? 'ALREADY_COMPLETE' : 'DRIFTED',
          physical,
        )
      if (receipt) return observation(unit, 'PARTIAL_OR_AMBIGUOUS', physical)
      const expected = witness.phase === 'POST_SEND' ? frame.after : frame.before
      if (physical !== expected) return observation(unit, 'DRIFTED', physical)
      return observation(
        unit,
        witness.phase === 'POST_SEND' || !frame.replayed ? 'ALREADY_COMPLETE' : 'REPLAY_REQUIRED',
        physical,
      )
    },
  }))
}

function isReceipt(value: unknown): value is ReplayUnitReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const textKeys = [
    'UNIT_ID',
    'SOURCE_SHA256',
    'UNIT_CONTENT_SHA256',
    'UNIT_CONTRACT_DIGEST',
    'PLAN_DIGEST',
    'GRAPH_DIGEST',
    'TOPOLOGY_DIGEST',
    'TARGET_SCOPE',
    'TARGET_DIGEST',
    'ACTOR_CLASS',
    'ACTOR_PRINCIPAL',
    'W4P_VERIFICATION_DIGEST',
    'SUPPLEMENT_VERIFICATION_DIGEST',
    'OWNED_STATE_DIGEST',
    'POSTCONDITION_VERIFICATION_DIGEST',
    'EXCLUSIVE_EXECUTION_REFERENCE',
    'RECEIPT_DIGEST',
  ]
  return (
    textKeys.every((key) => key in value && typeof Reflect.get(value, key) === 'string') &&
    'ACTION' in value &&
    typeof value.ACTION === 'string' &&
    ['REPLAYED', 'NOOP'].includes(value.ACTION) &&
    'PREDECESSOR_RECEIPT_DIGESTS' in value &&
    Array.isArray(value.PREDECESSOR_RECEIPT_DIGESTS) &&
    value.PREDECESSOR_RECEIPT_DIGESTS.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        typeof item.UNIT_ID === 'string' &&
        typeof item.DIGEST === 'string',
    )
  )
}
export function makeFakeNativeReferenceAdapter(
  catalog: FakeReplayCatalog,
  reference: FakeNativeGraphReference,
  failCommit = false,
): ReplayExclusiveAdapter {
  const value = details(reference)
  return {
    async withExclusiveTransaction(work) {
      const session = new ReplayPositionSession(value.plan, value.pin)
      let executing = 0
      return catalog.transaction(async () => {
        const client: ReplayExecutionClient = {
          query: (sql, parameters) => catalog.query(sql, parameters),
          async context() {
            return structuredClone(value.pin.execution)
          },
          async readReceipt(id) {
            const receipt = catalog.readReceipt(id)
            if (receipt === null) return null
            requireCondition(isReceipt(receipt), 'STORED_RECEIPT_INVALID')
            return receipt
          },
          async stageReceipt(receipt) {
            requireCondition(
              value.units.some((frame) => frame.unit.node.REPLAY_UNIT_ID === receipt.UNIT_ID),
              'STAGED_RECEIPT_UNIT_UNKNOWN',
            )
            catalog.stageReceipt(receipt.UNIT_ID, receipt)
          },
          async execute(sql) {
            while (executing < value.units.length && !value.units[executing].replayed) executing++
            const frame = value.units[executing++]
            requireCondition(frame && sql === frame.unit.sql, 'WHOLE_UNIT_SEND_ORDER_DRIFT')
            if (frame.unit.node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT')
              await qualifyFakeOriginalBoundary(catalog, session, value.plan, frame.unit)
            else await catalog.applyFrozenUnit(sql, replayHash(sql))
          },
        }
        clients.set(client, { reference, catalog })
        try {
          return await work(client)
        } finally {
          clients.delete(client)
        }
      }, failCommit)
    },
  }
}
