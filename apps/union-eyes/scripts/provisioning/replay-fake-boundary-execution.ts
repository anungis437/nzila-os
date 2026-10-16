import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import type { compileReplayUnitPlan } from './replay-unit-plan'
import { originalBoundaryContractDigest } from './replay-unit-plan'
import type { ReplayExecutionUnit } from './post-w4p-execution'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { ReplayPositionSession } from './replay-position-session'

/** Native fake qualification only; these observations do not authorize a production adapter. */
export async function qualifyFakeOriginalBoundary(
  catalog: FakeReplayCatalog,
  session: ReplayPositionSession,
  plan: ReturnType<typeof compileReplayUnitPlan>,
  incoming: ReplayExecutionUnit,
  failCommit = false,
) {
  const unit = structuredClone(incoming)
  const id = replayText(unit.node.REPLAY_UNIT_ID)
  const canonical = plan.specification.units.find(
    (candidate) => candidate.node.REPLAY_UNIT_ID === id,
  )
  const effects = plan.components.effects.filter((effect) => effect.boundaryId === id)
  if (
    !canonical ||
    replayDigest(canonical) !== replayDigest(unit) ||
    unit.node.REPLAY_UNIT_CLASS !== 'FROZEN_MIGRATION_UNIT' ||
    unit.node.DATABASE_SCOPE !== 'UE_OPERATIONAL' ||
    effects.length === 0 ||
    unit.node.EXACT_UNIT_SHA256 !== replayHash(unit.sql) ||
    unit.contractDigest !== originalBoundaryContractDigest(unit.node, unit.sql, effects) ||
    effects.some(
      (effect, index) =>
        effect.ordinal !== index + 1 ||
        effect.boundaryHash !== replayHash(unit.sql) ||
        effect.sourceHash !== replayHash(effect.source) ||
        Buffer.from(unit.sql)
          .subarray(...effect.byteRange)
          .toString('utf8') !== effect.source,
    )
  )
    throw new ProvisioningError('FAKE_BOUNDARY_EXECUTION_SOURCE_BINDING_INVALID')
  let index = 0
  await session.atomicBoundary(id, (beforeCommit) =>
    catalog.transaction(async () => {
      await catalog.applyObservedFrozenUnit(unit.sql, replayHash(unit.sql), async (position) => {
        const effect = effects[index++]
        if (
          !effect ||
          position.unitHash !== effect.boundaryHash ||
          position.ordinal !== effect.ordinal ||
          position.source !== effect.source ||
          position.sourceHash !== effect.sourceHash ||
          replayDigest(position.byteRange) !== replayDigest(effect.byteRange)
        )
          throw new ProvisioningError('FAKE_BOUNDARY_EXECUTION_POSITION_BINDING_INVALID')
        await session.capture(effect.effectId, position.before)
        await session.verify(effect.effectId, position.after)
      })
      beforeCommit()
    }, failCommit),
  )
  const positions = session.verifiedPositions().filter((position) => position.boundaryId === id)
  const body = {
    unitId: id,
    sourceHash: replayHash(unit.sql),
    contractDigest: unit.contractDigest,
    positionVerificationDigests: positions.map((position) => position.verificationDigest),
    qualification: 'INDEPENDENT_FAKE_NATIVE_POSITIONS' as const,
    wholeByteSends: 1 as const,
    executionAuthorized: false as const,
  }
  return Object.freeze({ ...body, qualificationDigest: replayDigest(body) })
}
