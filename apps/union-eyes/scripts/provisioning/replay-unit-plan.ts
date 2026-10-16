import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayText, type FrozenReplay } from './post-w4p-replay'
import { compileReplayComponents, exactReplaySource } from './replay-effect-registry'
import type { ReplayEffectComponent } from './replay-effect-registry'
import type { JsonRecord } from './post-w4p-replay'
import { noEffectContract } from './replay-enum-inspection'
import { transactionInventory } from '../../../../scripts/ue/w5bc-boundary-semantics'
import {
  validateExecutionSpecification,
  type ReplayExecutionSpecification,
} from './post-w4p-execution'

export function originalBoundaryContractDigest(
  node: JsonRecord,
  sql: string,
  effects: readonly ReplayEffectComponent[],
) {
  return replayDigest({
    unitId: replayText(node.REPLAY_UNIT_ID),
    scope: replayText(node.DATABASE_SCOPE),
    sourceHash: node.SOURCE_SHA256,
    orderedEffects: effects.map((effect) => ({
      id: effect.effectId,
      ordinal: effect.ordinal,
      sourceHash: effect.sourceHash,
      byteRange: effect.byteRange,
      kind: effect.compiled.kind,
      contractDigest: effect.compiled.contract.contractDigest,
    })),
    transaction: transactionInventory(sql),
  })
}

/** Real source contracts, not synthetic control-flow contracts. No runtime authorization is issued here. */
export function compileReplayUnitPlan(
  frozen: FrozenReplay,
  sourceBytes: Record<string, string>,
  ledgerBytes: string,
  supplementPlanDigest: string,
) {
  if (!/^[a-f0-9]{64}$/.test(supplementPlanDigest))
    throw new ProvisioningError('REPLAY_UNIT_PLAN_SUPPLEMENT_DIGEST_REQUIRED')
  const components = compileReplayComponents(frozen, sourceBytes, ledgerBytes)
  const boundaries = frozen.nodes
    .filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT')
    .map((node) => {
      const id = replayText(node.REPLAY_UNIT_ID)
      const sql = exactReplaySource(frozen, sourceBytes, node)
      const effects = components.effects.filter((effect) => effect.boundaryId === id)
      const transaction = transactionInventory(sql)
      if (node.DATABASE_SCOPE === 'FINANCIAL_SERVICE') {
        if (effects.length !== 0) throw new ProvisioningError('REPLAY_FINANCIAL_EFFECTS_NOT_EMPTY')
        return {
          unitId: id,
          scope: replayText(node.DATABASE_SCOPE),
          effects,
          transaction,
          contractDigest: noEffectContract(sql, replayText(node.EXACT_UNIT_SHA256)),
        }
      }
      if (effects.length === 0)
        throw new ProvisioningError('REPLAY_OPERATIONAL_BOUNDARY_EFFECTS_REQUIRED')
      return {
        unitId: id,
        scope: replayText(node.DATABASE_SCOPE),
        effects,
        transaction,
        contractDigest: originalBoundaryContractDigest(node, sql, effects),
      }
    })
  if (
    boundaries.length !== 23 ||
    boundaries.filter((boundary) => boundary.scope === 'FINANCIAL_SERVICE').length !== 1
  )
    throw new ProvisioningError('REPLAY_UNIT_PLAN_BOUNDARY_COVERAGE_INVALID')
  const contracts = new Map([
    ...components.creates.map((entry) => [entry.unitId, entry.contract.contractDigest] as const),
    ...components.wrappers.map((entry) => [entry.unitId, entry.contract.contractDigest] as const),
    ...boundaries.map((entry) => [entry.unitId, entry.contractDigest] as const),
  ])
  if (contracts.size !== 107)
    throw new ProvisioningError('REPLAY_UNIT_PLAN_CONTRACT_COVERAGE_INVALID')
  const specification: ReplayExecutionSpecification = {
    frozen,
    graphDigest: replayDigest(frozen.input.graph),
    topologyDigest: replayDigest(frozen.input.topology),
    w4pPlanDigest: replayText(frozen.input.promotionPlan.PLAN_DIGEST),
    supplementPlanDigest,
    units: frozen.order.map((ordered) => {
      const node = frozen.nodes.find((node) => node.REPLAY_UNIT_ID === ordered.REPLAY_UNIT_ID)
      if (!node) throw new ProvisioningError('REPLAY_UNIT_PLAN_NODE_MISSING')
      const id = replayText(node.REPLAY_UNIT_ID),
        contractDigest = contracts.get(id)
      if (!contractDigest) throw new ProvisioningError('REPLAY_UNIT_PLAN_CONTRACT_MISSING')
      return {
        node,
        sql: exactReplaySource(frozen, sourceBytes, node),
        contractDigest,
        predecessors: frozen.edges
          .filter((edge) => edge.TO === id)
          .map((edge) => replayText(edge.FROM)),
        transactionClass: 'TRANSACTION_COMPATIBLE',
      }
    }),
  }
  validateExecutionSpecification(specification)
  return {
    specification,
    components,
    boundaries,
    sourceContracts: 107 as const,
    originalTransactionAssignments: 23 as const,
    wholeUnitEligibility: 'NOT_ESTABLISHED' as const,
    executionAuthorized: false as const,
  }
}
