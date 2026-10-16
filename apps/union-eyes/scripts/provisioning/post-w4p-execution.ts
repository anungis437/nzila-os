import { ProvisioningError } from './governed-provisioning'
import { type CatalogReader } from './platform-baseline-promotion'
import {
  replayDigest,
  replayHash,
  replayText,
  replayObject,
  replayInputCommitments,
  validateReplayTopology,
  type FrozenReplay,
  type JsonRecord,
  type ReplayInspectionState,
} from './post-w4p-replay'

export interface ReplayExecutionUnit {
  node: JsonRecord
  sql: string
  predecessors: string[]
  contractDigest: string
  transactionClass: 'TRANSACTION_COMPATIBLE' | 'TRANSACTION_BOUNDARY_REQUIRED'
}
export interface ReplayExecutionSpecification {
  frozen: FrozenReplay
  graphDigest: string
  topologyDigest: string
  w4pPlanDigest: string
  supplementPlanDigest: string
  units: ReplayExecutionUnit[]
}
export interface ReplayExecutionContext {
  scope: 'UE_OPERATIONAL' | 'FINANCIAL_SERVICE'
  actorClass: 'MIGRATION_ADMIN'
  actorPrincipal: string
  targetDigest: string
  w4pPlanDigest: string
  w4pVerificationDigest: string
  supplementPlanDigest: string
  supplementVerificationDigest: string
  exclusiveExecutionReference: string
}
export interface ReplayExecutionAuthorization {
  purpose: 'POST_W4P_REPLAY'
  executionApproved: true
  planDigest: string
  graphDigest: string
  scope: string
  targetDigest: string
  actorPrincipal: string
  w4pVerificationDigest: string
  supplementVerificationDigest: string
}
export interface ReplayUnitReceipt {
  UNIT_ID: string
  SOURCE_SHA256: string
  UNIT_CONTENT_SHA256: string
  UNIT_CONTRACT_DIGEST: string
  PLAN_DIGEST: string
  GRAPH_DIGEST: string
  TOPOLOGY_DIGEST: string
  TARGET_SCOPE: string
  TARGET_DIGEST: string
  ACTOR_CLASS: string
  ACTOR_PRINCIPAL: string
  W4P_VERIFICATION_DIGEST: string
  SUPPLEMENT_VERIFICATION_DIGEST: string
  PREDECESSOR_RECEIPT_DIGESTS: { UNIT_ID: string; DIGEST: string }[]
  OWNED_STATE_DIGEST: string
  POSTCONDITION_VERIFICATION_DIGEST: string
  ACTION: 'REPLAYED' | 'NOOP'
  EXCLUSIVE_EXECUTION_REFERENCE: string
  RECEIPT_DIGEST: string
}
export interface ReplayExecutionClient extends CatalogReader {
  context(): Promise<ReplayExecutionContext>
  readReceipt(unitId: string): Promise<ReplayUnitReceipt | null>
  stageReceipt(receipt: ReplayUnitReceipt): Promise<void>
  execute(sql: string): Promise<void>
}
export interface ReplayExclusiveAdapter {
  withExclusiveTransaction<T>(work: (client: ReplayExecutionClient) => Promise<T>): Promise<T>
}
export interface ReplayUnitObservation {
  state: ReplayInspectionState
  ownedStateDigest: string
  verificationDigest: string
}
export interface ReplayUnitHandler {
  unitId: string
  contractDigest: string
  inspect(
    client: CatalogReader,
    context: ReplayExecutionContext,
    unit: ReplayExecutionUnit,
    receipt: ReplayUnitReceipt | null,
    witness?: ReplayInspectionWitness,
  ): Promise<ReplayUnitObservation>
}
export interface ReplayInspectionWitness {
  phase: 'BEFORE' | 'PRE_SEND' | 'POST_SEND' | 'FINAL_SCOPE'
  position: number
  planDigest: string
  historicalReceipts: ReadonlyMap<string, ReplayUnitReceipt>
  verifiedReceipts: ReadonlyMap<string, ReplayUnitReceipt>
}
function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new ProvisioningError(code)
}
const digest = (value: string) => /^[a-f0-9]{64}$/.test(value)
const frozenGraphDigest = 'b700d55469c27bed84d98aa4281fb800486a4f776e4d88d753031d28446b21b2'
const frozenTopologyDigest = 'e5c5a60e8f37ee6c43617d44ca73d2f541d28777f3d0609863e0aad6dd87a989'
export function validateExecutionSpecification(specification: ReplayExecutionSpecification) {
  const { frozen } = specification
  validateReplayTopology(frozen.nodes, frozen.edges, frozen.order)
  requireCondition(
    replayDigest(frozen.nodes) === replayDigest(frozen.input.graph.nodes) &&
      replayDigest(frozen.edges) === replayDigest(frozen.input.graph.edges) &&
      replayDigest(frozen.order) === replayDigest(frozen.input.topology.ORDER) &&
      replayDigest(frozen.register) === replayDigest(frozen.input.graph.downstreamRegister) &&
      Object.entries(replayInputCommitments).every(
        ([file, hash]) => frozen.byteCommitments[file] === hash,
      ),
    'REPLAY_EXECUTION_FROZEN_VIEW_DRIFT',
  )
  const commitments = replayObject(frozen.input.w5a.determinismDigests)
  requireCondition(
    specification.graphDigest === replayDigest(frozen.input.graph) &&
      specification.topologyDigest === replayDigest(frozen.input.topology) &&
      specification.graphDigest === commitments.REPLAY_GRAPH_SHA256 &&
      specification.topologyDigest === commitments.TOPOLOGICAL_PLAN_SHA256 &&
      specification.graphDigest === frozenGraphDigest &&
      specification.topologyDigest === frozenTopologyDigest &&
      specification.w4pPlanDigest === frozen.input.promotionPlan.PLAN_DIGEST &&
      digest(specification.supplementPlanDigest),
    'REPLAY_EXECUTION_FROZEN_AUTHORITY_DRIFT',
  )
  requireCondition(specification.units.length === 107, 'REPLAY_EXACT_UNIT_COVERAGE_REQUIRED')
  for (const [index, unit] of specification.units.entries()) {
    const id = replayText(unit.node.REPLAY_UNIT_ID)
    const original = frozen.nodes.find((node) => node.REPLAY_UNIT_ID === id)
    requireCondition(
      original &&
        replayDigest(original) === replayDigest(unit.node) &&
        frozen.order[index].REPLAY_UNIT_ID === id,
      'REPLAY_EXECUTION_UNIT_ORDER_DRIFT',
    )
    requireCondition(
      replayHash(unit.sql) === unit.node.EXACT_UNIT_SHA256,
      'REPLAY_UNIT_SOURCE_BYTES_DRIFT',
    )
    requireCondition(
      replayDigest(unit.predecessors) ===
        replayDigest(frozen.edges.filter((edge) => edge.TO === id).map((edge) => edge.FROM)),
      'REPLAY_PREDECESSOR_PROVENANCE_DRIFT',
    )
    requireCondition(digest(unit.contractDigest), 'REPLAY_UNIT_CONTRACT_REQUIRED')
    requireCondition(
      unit.transactionClass === 'TRANSACTION_COMPATIBLE',
      'REPLAY_SEPARATE_TRANSACTION_STRATEGY_REQUIRED',
    )
  }
}
export function executionPlanDigest(specification: ReplayExecutionSpecification) {
  validateExecutionSpecification(specification)
  return replayDigest({
    graph: specification.graphDigest,
    topology: specification.topologyDigest,
    w4p: specification.w4pPlanDigest,
    supplement: specification.supplementPlanDigest,
    units: specification.units,
  })
}
export function verifyUnitReceipt(
  receipt: ReplayUnitReceipt,
  unit: ReplayExecutionUnit,
  specification: ReplayExecutionSpecification,
  context: ReplayExecutionContext,
) {
  const { RECEIPT_DIGEST, ...body } = receipt
  return (
    RECEIPT_DIGEST === replayDigest(body) &&
    receipt.UNIT_ID === unit.node.REPLAY_UNIT_ID &&
    receipt.SOURCE_SHA256 === unit.node.SOURCE_SHA256 &&
    receipt.UNIT_CONTENT_SHA256 === unit.node.EXACT_UNIT_SHA256 &&
    receipt.UNIT_CONTRACT_DIGEST === unit.contractDigest &&
    receipt.PLAN_DIGEST === executionPlanDigest(specification) &&
    receipt.GRAPH_DIGEST === specification.graphDigest &&
    receipt.TOPOLOGY_DIGEST === specification.topologyDigest &&
    receipt.TARGET_SCOPE === context.scope &&
    receipt.TARGET_SCOPE === unit.node.DATABASE_SCOPE &&
    receipt.TARGET_DIGEST === context.targetDigest &&
    receipt.ACTOR_CLASS === context.actorClass &&
    receipt.ACTOR_PRINCIPAL === context.actorPrincipal &&
    receipt.W4P_VERIFICATION_DIGEST === context.w4pVerificationDigest &&
    receipt.SUPPLEMENT_VERIFICATION_DIGEST === context.supplementVerificationDigest &&
    typeof receipt.EXCLUSIVE_EXECUTION_REFERENCE === 'string' &&
    receipt.EXCLUSIVE_EXECUTION_REFERENCE.trim().length > 0 &&
    digest(receipt.OWNED_STATE_DIGEST) &&
    digest(receipt.POSTCONDITION_VERIFICATION_DIGEST) &&
    (receipt.ACTION === 'REPLAYED' || receipt.ACTION === 'NOOP') &&
    Array.isArray(receipt.PREDECESSOR_RECEIPT_DIGESTS) &&
    receipt.PREDECESSOR_RECEIPT_DIGESTS.every(
      (entry) => entry && typeof entry.UNIT_ID === 'string' && typeof entry.DIGEST === 'string',
    ) &&
    replayDigest(receipt.PREDECESSOR_RECEIPT_DIGESTS.map((entry) => entry.UNIT_ID)) ===
      replayDigest(unit.predecessors) &&
    receipt.PREDECESSOR_RECEIPT_DIGESTS.every((entry) => digest(entry.DIGEST))
  )
}
export async function applyReplayScope(
  specification: ReplayExecutionSpecification,
  expectedContext: ReplayExecutionContext,
  handlers: ReplayUnitHandler[],
  adapter: ReplayExclusiveAdapter | undefined,
  authorization: ReplayExecutionAuthorization | undefined,
) {
  requireCondition(
    ['UE_OPERATIONAL', 'FINANCIAL_SERVICE'].includes(expectedContext.scope),
    'REPLAY_DATABASE_SCOPE_INVALID',
  )
  const planDigest = executionPlanDigest(specification)
  requireCondition(
    handlers.length === 107 &&
      new Set(handlers.map((handler) => handler.unitId)).size === 107 &&
      specification.units.every((unit) =>
        handlers.some((handler) => handler.unitId === unit.node.REPLAY_UNIT_ID),
      ),
    'REPLAY_EXACT_HANDLER_COVERAGE_REQUIRED',
  )
  requireCondition(
    handlers.every((handler) =>
      specification.units.some(
        (unit) =>
          unit.node.REPLAY_UNIT_ID === handler.unitId &&
          unit.contractDigest === handler.contractDigest,
      ),
    ),
    'REPLAY_HANDLER_CONTRACT_DRIFT',
  )
  requireCondition(authorization?.executionApproved, 'REPLAY_EXECUTION_NOT_AUTHORIZED')
  requireCondition(
    authorization.purpose === 'POST_W4P_REPLAY' &&
      authorization.planDigest === planDigest &&
      authorization.graphDigest === specification.graphDigest &&
      authorization.scope === expectedContext.scope &&
      authorization.targetDigest === expectedContext.targetDigest &&
      authorization.actorPrincipal === expectedContext.actorPrincipal &&
      authorization.w4pVerificationDigest === expectedContext.w4pVerificationDigest &&
      authorization.supplementVerificationDigest === expectedContext.supplementVerificationDigest,
    'REPLAY_AUTHORIZATION_BINDING_MISMATCH',
  )
  requireCondition(
    adapter && expectedContext.exclusiveExecutionReference,
    'REPLAY_EXCLUSIVE_ADAPTER_REQUIRED',
  )
  return adapter.withExclusiveTransaction(async (client) => {
    const context = await client.context()
    requireCondition(
      replayDigest(context) === replayDigest(expectedContext),
      'REPLAY_PINNED_CONTEXT_DRIFT',
    )
    requireCondition(
      context.actorClass === 'MIGRATION_ADMIN' &&
        !!context.actorPrincipal &&
        digest(context.targetDigest) &&
        digest(context.w4pVerificationDigest) &&
        digest(context.supplementVerificationDigest) &&
        context.w4pPlanDigest === specification.w4pPlanDigest &&
        context.supplementPlanDigest === specification.supplementPlanDigest,
      'REPLAY_BASELINE_AND_SUPPLEMENT_VERIFICATION_REQUIRED',
    )
    const scopeUnits = specification.units.filter(
      (unit) => unit.node.DATABASE_SCOPE === context.scope,
    )
    const historical = new Map<string, ReplayUnitReceipt>()
    for (const unit of scopeUnits) {
      const id = replayText(unit.node.REPLAY_UNIT_ID)
      const stored = await client.readReceipt(id)
      if (stored) {
        requireCondition(
          verifyUnitReceipt(stored, unit, specification, context),
          'REPLAY_STORED_RECEIPT_BINDING_INVALID',
        )
        historical.set(id, stored)
      }
    }
    for (const stored of historical.values())
      requireCondition(
        stored.PREDECESSOR_RECEIPT_DIGESTS.every(
          (predecessor) =>
            historical.get(predecessor.UNIT_ID)?.RECEIPT_DIGEST === predecessor.DIGEST,
        ),
        'REPLAY_STORED_PREDECESSOR_RECEIPT_INVALID',
      )
    const completed = new Map<string, ReplayUnitReceipt>()
    const receipts: ReplayUnitReceipt[] = []
    let replayed = 0,
      noop = 0
    const witness = (
      phase: ReplayInspectionWitness['phase'],
      unit: ReplayExecutionUnit,
    ): ReplayInspectionWitness => ({
      phase,
      position: specification.units.indexOf(unit) + 1,
      planDigest,
      historicalReceipts: new Map(historical),
      verifiedReceipts: new Map(completed),
    })
    for (const unit of scopeUnits) {
      const unitId = replayText(unit.node.REPLAY_UNIT_ID)
      const predecessorDigests = unit.predecessors.map((id) => {
        const receipt = completed.get(id)
        requireCondition(receipt, 'REPLAY_PREDECESSOR_NOT_VERIFIED')
        return { UNIT_ID: id, DIGEST: receipt.RECEIPT_DIGEST }
      })
      const handler = handlers.find((handler) => handler.unitId === unitId)!
      const stored = historical.get(unitId) ?? null
      const before = await handler.inspect(client, context, unit, stored, witness('BEFORE', unit))
      requireCondition(
        digest(before.ownedStateDigest) && digest(before.verificationDigest),
        'REPLAY_INSPECTION_PROOF_DIGEST_REQUIRED',
      )
      requireCondition(
        before.state === 'REPLAY_REQUIRED' || before.state === 'ALREADY_COMPLETE',
        `REPLAY_UNIT_DENIED:${unitId}:${before.state}`,
      )
      requireCondition(
        !stored || before.state === 'ALREADY_COMPLETE',
        `REPLAY_RECEIPTED_EFFECT_MISSING:${unitId}`,
      )
      const action = before.state === 'ALREADY_COMPLETE' ? 'NOOP' : 'REPLAYED'
      if (action === 'REPLAYED') {
        const immediate = await handler.inspect(
          client,
          context,
          unit,
          stored,
          witness('PRE_SEND', unit),
        )
        requireCondition(
          immediate.state === 'REPLAY_REQUIRED' && replayDigest(immediate) === replayDigest(before),
          'REPLAY_PRE_SEND_STATE_DRIFT',
        )
        await client.execute(unit.sql)
        replayed++
      } else noop++
      const after = await handler.inspect(client, context, unit, stored, witness('POST_SEND', unit))
      requireCondition(
        after.state === 'ALREADY_COMPLETE' &&
          digest(after.ownedStateDigest) &&
          digest(after.verificationDigest),
        'REPLAY_IMMEDIATE_POSTCONDITION_FAILED',
      )
      requireCondition(
        action !== 'NOOP' || after.ownedStateDigest === before.ownedStateDigest,
        'REPLAY_NOOP_OWNED_STATE_DRIFT',
      )
      const body: Omit<ReplayUnitReceipt, 'RECEIPT_DIGEST'> = {
        UNIT_ID: unitId,
        SOURCE_SHA256: replayText(unit.node.SOURCE_SHA256),
        UNIT_CONTENT_SHA256: replayText(unit.node.EXACT_UNIT_SHA256),
        UNIT_CONTRACT_DIGEST: unit.contractDigest,
        PLAN_DIGEST: planDigest,
        GRAPH_DIGEST: specification.graphDigest,
        TOPOLOGY_DIGEST: specification.topologyDigest,
        TARGET_SCOPE: context.scope,
        TARGET_DIGEST: context.targetDigest,
        ACTOR_CLASS: context.actorClass,
        ACTOR_PRINCIPAL: context.actorPrincipal,
        W4P_VERIFICATION_DIGEST: context.w4pVerificationDigest,
        SUPPLEMENT_VERIFICATION_DIGEST: context.supplementVerificationDigest,
        PREDECESSOR_RECEIPT_DIGESTS: predecessorDigests,
        OWNED_STATE_DIGEST: after.ownedStateDigest,
        POSTCONDITION_VERIFICATION_DIGEST: after.verificationDigest,
        ACTION: action,
        EXCLUSIVE_EXECUTION_REFERENCE: context.exclusiveExecutionReference,
      }
      const receipt: ReplayUnitReceipt = { ...body, RECEIPT_DIGEST: replayDigest(body) }
      await client.stageReceipt(receipt)
      completed.set(unitId, receipt)
      receipts.push(receipt)
    }
    const finalVerifications: {
      UNIT_ID: string
      OWNED_STATE_DIGEST: string
      POSTCONDITION_VERIFICATION_DIGEST: string
    }[] = []
    for (const unit of scopeUnits) {
      const id = replayText(unit.node.REPLAY_UNIT_ID)
      const receipt = completed.get(id)!
      const handler = handlers.find((handler) => handler.unitId === id)!
      const final = await handler.inspect(
        client,
        context,
        unit,
        receipt,
        witness('FINAL_SCOPE', unit),
      )
      requireCondition(
        final.state === 'ALREADY_COMPLETE' &&
          digest(final.ownedStateDigest) &&
          digest(final.verificationDigest),
        `REPLAY_FINAL_SCOPE_VERIFICATION_FAILED:${id}`,
      )
      finalVerifications.push({
        UNIT_ID: id,
        OWNED_STATE_DIGEST: final.ownedStateDigest,
        POSTCONDITION_VERIFICATION_DIGEST: final.verificationDigest,
      })
    }
    const body = {
      SCOPE: context.scope,
      TARGET_DIGEST: context.targetDigest,
      PLAN_DIGEST: planDigest,
      GRAPH_DIGEST: specification.graphDigest,
      TOPOLOGY_DIGEST: specification.topologyDigest,
      REPLAYED: replayed,
      NOOP: noop,
      UNIT_RECEIPTS: receipts,
      FINAL_UNIT_VERIFICATIONS: finalVerifications,
    }
    return { ...body, RECEIPT_DIGEST: replayDigest(body) }
  })
}
