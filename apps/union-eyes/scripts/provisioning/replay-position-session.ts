import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import type { CatalogReader } from './platform-baseline-promotion'
import { compileReplayUnitPlan } from './replay-unit-plan'
import {
  captureReplayPositionPredecessor,
  deriveReplayEffectPositionAuthority,
  type ReplayPositionPin,
  type ReplayPositionSnapshot,
  type ReplayPositionDependencies,
  type ReplayPositionRead,
  positionAuthorityQueries,
} from './replay-position-authority'
import {
  inspectReplayEffect,
  type ReplayEffectObservation,
  type ReplayEffectPositionAuthority,
} from './replay-effect-inspection'
import type { ReplayEffectComponent } from './replay-effect-registry'
import { validateExecutionSpecification } from './post-w4p-execution'

type UnitPlan = ReturnType<typeof compileReplayUnitPlan>
export interface ReplayPositionVerification {
  effectId: string
  sourceHash: string
  boundaryId: string
  ordinal: number
  position: number
  observation: ReplayEffectObservation
  predecessorDigest: string | null
  authorityReadSetDigest: string | null
  authorityReads: readonly ReplayPositionRead[]
  finalAuthorityReadSetDigest: string
  finalAuthorityReads: readonly ReplayPositionRead[]
  authoritySemanticReadSetDigest: string
  inspectionReadSetDigest: string
  inspectionReads: readonly ReplayPositionRead[]
  predecessorVerificationDigest: string | null
  verificationDigest: string
}
interface PendingPosition {
  effect: ReplayEffectComponent
  predecessor: ReplayPositionSnapshot
}
function immutable<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value)) immutable(nested)
    Object.freeze(value)
  }
  return value
}
function semanticAuthorityReads(reads: readonly ReplayPositionRead[]) {
  return reads.map((read) =>
    read.sql !== positionAuthorityQueries.snapshot
      ? read
      : {
          ...read,
          rows: read.rows.map((value) => {
            if (
              value === null ||
              typeof value !== 'object' ||
              !('backend' in value) ||
              typeof value.backend !== 'string'
            )
              throw new ProvisioningError('REPLAY_POSITION_SESSION_SNAPSHOT_BACKEND_REQUIRED')
            return { backend: value.backend }
          }),
        },
  )
}
/** Ordered read-only integration. Observations are not execution receipts or whole-unit eligibility. */
export class ReplayPositionSession {
  private readonly plan: UnitPlan
  private readonly pin: ReplayPositionPin
  private readonly ordered: ReplayEffectComponent[]
  private readonly predecessors = new Map<string, ReplayPositionSnapshot>()
  private readonly observations: ReplayPositionVerification[] = []
  private pending: PendingPosition | null = null
  private busy = false
  private stagedFrom: number | null = null
  private boundarySealed = false
  constructor(plan: UnitPlan, pin: ReplayPositionPin) {
    this.plan = structuredClone(plan)
    this.pin = structuredClone(pin)
    const expected = this.plan.specification
    validateExecutionSpecification(expected)
    if (
      pin.execution.w4pPlanDigest !== expected.w4pPlanDigest ||
      pin.execution.supplementPlanDigest !== expected.supplementPlanDigest ||
      pin.execution.actorClass !== 'MIGRATION_ADMIN' ||
      !pin.execution.actorPrincipal ||
      !pin.execution.exclusiveExecutionReference ||
      !/^[a-f0-9]{64}$/.test(pin.execution.targetDigest) ||
      !/^[a-f0-9]{64}$/.test(pin.execution.w4pVerificationDigest) ||
      !/^[a-f0-9]{64}$/.test(pin.execution.supplementVerificationDigest) ||
      !pin.database ||
      !Array.isArray(pin.searchPath) ||
      pin.searchPath.length === 0 ||
      pin.searchPath.some((schema) => typeof schema !== 'string' || !schema) ||
      new Set(pin.searchPath).size !== pin.searchPath.length
    )
      throw new ProvisioningError('REPLAY_POSITION_SESSION_BASELINE_PIN_REQUIRED')
    const units = expected.units.filter((unit) => unit.node.DATABASE_SCOPE === pin.execution.scope)
    if (units.length === 0) throw new ProvisioningError('REPLAY_POSITION_SESSION_SCOPE_INVALID')
    const originals = new Set(
      expected.units
        .filter((unit) => unit.node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT')
        .map((unit) => unit.node.REPLAY_UNIT_ID),
    )
    const effects = this.plan.components.effects
    if (
      effects.length !== 762 ||
      new Set(effects.map((effect) => effect.effectId)).size !== 762 ||
      this.plan.components.creates.length !== 43 ||
      this.plan.components.wrappers.length !== 41 ||
      this.plan.boundaries.length !== 23 ||
      effects.some(
        (effect) =>
          !originals.has(effect.boundaryId) ||
          effect.sourceHash !== replayHash(effect.source) ||
          effect.effectId !== `${effect.boundaryId}:E${String(effect.ordinal).padStart(3, '0')}`,
      )
    )
      throw new ProvisioningError('REPLAY_POSITION_SESSION_EFFECT_COVERAGE_INVALID')
    this.ordered = units.flatMap((unit) =>
      this.plan.components.effects.filter(
        (effect) => effect.boundaryId === unit.node.REPLAY_UNIT_ID,
      ),
    )
    if (new Set(this.ordered.map((effect) => effect.effectId)).size !== this.ordered.length)
      throw new ProvisioningError('REPLAY_POSITION_SESSION_EFFECT_COVERAGE_INVALID')
  }
  get nextEffectId(): string | null {
    return this.ordered[this.observations.length]?.effectId ?? null
  }
  async atomicBoundary<T>(
    unitId: string,
    work: (beforeCommit: () => void) => Promise<T>,
  ): Promise<T> {
    if (this.stagedFrom !== null || this.busy || this.pending)
      throw new ProvisioningError('REPLAY_POSITION_SESSION_BOUNDARY_ALREADY_PENDING')
    const effects = this.ordered.filter((effect) => effect.boundaryId === unitId)
    if (
      effects.length === 0 ||
      effects[0].effectId !== this.nextEffectId ||
      effects[0].ordinal !== 1
    )
      throw new ProvisioningError('REPLAY_POSITION_SESSION_BOUNDARY_ORDER_DRIFT')
    const start = this.observations.length
    const predecessors = new Map(this.predecessors)
    this.stagedFrom = start
    this.boundarySealed = false
    const beforeCommit = () => {
      if (
        this.boundarySealed ||
        this.pending ||
        this.busy ||
        this.observations.length !== start + effects.length ||
        this.observations
          .slice(start)
          .some((observation, index) => observation.effectId !== effects[index].effectId)
      )
        throw new ProvisioningError('REPLAY_POSITION_SESSION_BOUNDARY_COVERAGE_INCOMPLETE')
      this.boundarySealed = true
    }
    try {
      const result = await work(beforeCommit)
      if (!this.boundarySealed)
        throw new ProvisioningError('REPLAY_POSITION_SESSION_BOUNDARY_COMMIT_VALIDATION_REQUIRED')
      return result
    } catch (error) {
      this.observations.splice(start)
      this.predecessors.clear()
      for (const [id, predecessor] of predecessors) this.predecessors.set(id, predecessor)
      this.pending = null
      throw error
    } finally {
      this.stagedFrom = null
      this.boundarySealed = false
    }
  }
  private dependencies(effect: ReplayEffectComponent): ReplayPositionDependencies | undefined {
    if (
      effect.compiled.kind !== 'PROCEDURAL' ||
      effect.compiled.contract.geometry.kind !== 'TRIGGER'
    )
      return undefined
    const name = effect.compiled.contract.geometry.functionName
    const earlier = this.ordered
      .slice(0, this.observations.length)
      .filter(
        (candidate) =>
          candidate.boundaryId === effect.boundaryId &&
          candidate.ordinal < effect.ordinal &&
          candidate.compiled.kind === 'FUNCTION' &&
          candidate.compiled.contract.name === name &&
          candidate.compiled.contract.action === 'CREATE_OR_REPLACE',
      )
    const selected = earlier.at(-1)
    if (!selected)
      throw new ProvisioningError('REPLAY_POSITION_SESSION_TRIGGER_SOURCE_PREDECESSOR_REQUIRED')
    const predecessor = this.predecessors.get(selected.effectId)
    if (!predecessor)
      throw new ProvisioningError('REPLAY_POSITION_SESSION_TRIGGER_CAPTURE_REQUIRED')
    return { triggerFunction: { effect: selected, predecessor } }
  }
  async capture(effectId: string, reader: CatalogReader) {
    if (this.boundarySealed) throw new ProvisioningError('REPLAY_POSITION_SESSION_BOUNDARY_SEALED')
    if (this.busy || this.pending)
      throw new ProvisioningError('REPLAY_POSITION_SESSION_POSITION_ALREADY_PENDING')
    const effect = this.ordered[this.observations.length]
    if (!effect || effect.effectId !== effectId)
      throw new ProvisioningError('REPLAY_POSITION_SESSION_ORDER_DRIFT')
    this.busy = true
    try {
      const predecessor = await captureReplayPositionPredecessor(
        reader,
        this.pin,
        effect,
        this.dependencies(effect),
      )
      this.pending = { effect, predecessor }
      return Object.freeze({
        effectId,
        sourceHash: effect.sourceHash,
        predecessorDigest: predecessor?.snapshotDigest ?? null,
      })
    } finally {
      this.busy = false
    }
  }
  async verify(effectId: string, reader: CatalogReader): Promise<ReplayPositionVerification> {
    if (this.busy) throw new ProvisioningError('REPLAY_POSITION_SESSION_CONCURRENT_ACCESS_DENIED')
    const pending = this.pending
    if (!pending || pending.effect.effectId !== effectId)
      throw new ProvisioningError('REPLAY_POSITION_SESSION_CAPTURE_REQUIRED')
    this.busy = true
    try {
      const derived = await deriveReplayEffectPositionAuthority(
        reader,
        this.pin,
        pending.effect,
        pending.predecessor,
      )
      const authority: ReplayEffectPositionAuthority = derived.authority
      const authorityReadSetDigest = derived.readSetDigest
      const authoritySemanticReadSetDigest = replayDigest(semanticAuthorityReads(derived.reads))
      const inspectionReads: ReplayPositionRead[] = []
      const recordingReader: CatalogReader = {
        async query(sql, parameters) {
          const rows = await reader.query(sql, parameters)
          inspectionReads.push(immutable(structuredClone({ sql, parameters, rows })))
          return rows
        },
      }
      const observation = await inspectReplayEffect(recordingReader, pending.effect, authority)
      if (observation.definition !== 'EXACT')
        throw new ProvisioningError(
          `REPLAY_POSITION_SESSION_POSTCONDITION_DENIED:${effectId}:${observation.definition}`,
        )
      const finalAuthority = await deriveReplayEffectPositionAuthority(
        reader,
        this.pin,
        pending.effect,
        pending.predecessor,
      )
      if (
        replayDigest(semanticAuthorityReads(finalAuthority.reads)) !==
        authoritySemanticReadSetDigest
      )
        throw new ProvisioningError('REPLAY_POSITION_SESSION_AUTHORITY_CHANGED_DURING_INSPECTION')
      const body = {
        effectId,
        sourceHash: pending.effect.sourceHash,
        boundaryId: pending.effect.boundaryId,
        ordinal: pending.effect.ordinal,
        position:
          this.plan.specification.units.findIndex(
            (unit) => unit.node.REPLAY_UNIT_ID === pending.effect.boundaryId,
          ) + 1,
        observation,
        predecessorDigest: pending.predecessor?.snapshotDigest ?? null,
        authorityReadSetDigest,
        authorityReads: immutable(structuredClone(derived.reads)),
        finalAuthorityReadSetDigest: finalAuthority.readSetDigest,
        finalAuthorityReads: immutable(structuredClone(finalAuthority.reads)),
        authoritySemanticReadSetDigest,
        inspectionReadSetDigest: replayDigest(inspectionReads),
        inspectionReads: immutable(inspectionReads),
        predecessorVerificationDigest: this.observations.at(-1)?.verificationDigest ?? null,
      }
      const verified = Object.freeze({
        ...body,
        observation: Object.freeze({ ...observation }),
        verificationDigest: replayDigest(body),
      })
      this.predecessors.set(effectId, pending.predecessor)
      this.observations.push(verified)
      this.pending = null
      return verified
    } finally {
      this.busy = false
    }
  }
  verifiedPositions(): readonly ReplayPositionVerification[] {
    return Object.freeze(this.observations.slice(0, this.stagedFrom ?? this.observations.length))
  }
}
