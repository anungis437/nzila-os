import { createHash } from 'node:crypto'
import { ProvisioningError } from './governed-provisioning'

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type JsonRecord = { [key: string]: Json }
export type ReplayInspectionState =
  | 'REPLAY_REQUIRED'
  | 'ALREADY_COMPLETE'
  | 'DRIFTED'
  | 'PARTIAL_OR_AMBIGUOUS'
  | 'PRECONDITION_MISSING'
export type ReplayUnitClass =
  | 'EXACT_CREATE_STATEMENT'
  | 'ENUM_DO_WRAPPER'
  | 'ORIGINAL_POSITION_MIGRATION_BOUNDARY'

const folder = 'docs/union-eyes/reality-remediation/'
export const replayInputFiles = {
  w5a: folder + 'PHASE_1B_3C_A1I_W5A_REPLAY_ORDERING_GRAPH.json',
  graph: folder + 'UE_W5_POST_W4P_REPLAY_GRAPH.json',
  topology: folder + 'UE_W5_REPLAY_TOPOLOGICAL_PLAN.json',
  w4p: folder + 'PHASE_1B_3C_A1I_W4P_PLATFORM_BASELINE_PROMOTION.json',
  promotionPlan: folder + 'UE_W4_PLATFORM_BASELINE_PROMOTION_PLAN.json',
  promotionImplementation: folder + 'UE_W4_PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION.json',
  late: folder + 'UE_W4_LATE_PRODUCER_COMPATIBILITY_CLASSIFICATION.json',
  downstream: folder + 'UE_POST_W4P_COMPATIBILITY_OBLIGATIONS.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const replayInputCommitments: Record<string, string> = {
  [replayInputFiles.w5a]: '5682f325a266b2f3fcccd1f735198bd06e6e623c96b8ea263d42122d339cc585',
  [replayInputFiles.graph]: '0e26428a255d91c8aeb8d8ae1e5cd95683ef437730908f35e7af911d4cb3bd30',
  [replayInputFiles.topology]: 'b896029e9f2eba4665956dbb3e36e1633183581f2e82f075eb424ac3305afcce',
  [replayInputFiles.w4p]: '9405b0b03e3966816605199a04244e7ffe41af6c2d03af31f25e7c2836d9bbfb',
  [replayInputFiles.promotionPlan]:
    'f58319b792dc62cf6ac06bcf8be070ca6020084f41e468add7d64217aba0b4d5',
  [replayInputFiles.promotionImplementation]:
    '6f651aaa3f76a82192c5050e2400498d4f66a58c0aa0af2639770ccf52183c49',
  [replayInputFiles.late]: 'fc98ce059a4e4d26caadecb7ed9a686db81d324e8e597477f55064d74b76ed98',
  [replayInputFiles.downstream]: '2e10f3e40761c6b93bca473b263c262c2222f7b3a875e41ab268fa1b4448e043',
  [replayInputFiles.producer]: 'b2db0a4924188facc243965b0de11cd921200ce8dda811c543263abdd84dc3aa',
  [replayInputFiles.canonical]: '5e105985d6b99fbdb118b87454543f92e0053ae1b574c3dfe6417f9bbbc81e2d',
}
export const replayHash = (bytes: string) => createHash('sha256').update(bytes).digest('hex')
export const replayDigest = (value: unknown) => replayHash(JSON.stringify(value))
function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new ProvisioningError(code)
}
export function replayObject(value: Json | undefined): JsonRecord {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'REPLAY_OBJECT_REQUIRED',
  )
  return value
}
export function replayRecords(value: Json | undefined): JsonRecord[] {
  requireCondition(Array.isArray(value), 'REPLAY_RECORD_ARRAY_REQUIRED')
  return value.map(replayObject)
}
export function replayStrings(value: Json | undefined): string[] {
  requireCondition(
    Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
    'REPLAY_STRING_ARRAY_REQUIRED',
  )
  return value
}
export function replayText(value: Json | undefined): string {
  requireCondition(typeof value === 'string', 'REPLAY_STRING_REQUIRED')
  return value
}
export function replayNumber(value: Json | undefined): number {
  requireCondition(
    typeof value === 'number' && Number.isSafeInteger(value),
    'REPLAY_SAFE_INTEGER_REQUIRED',
  )
  return value
}
export function replayClass(node: JsonRecord): ReplayUnitClass {
  switch (node.REPLAY_UNIT_CLASS) {
    case 'FROZEN_STATEMENT_UNIT':
      return 'EXACT_CREATE_STATEMENT'
    case 'FROZEN_WRAPPER_UNIT':
      return 'ENUM_DO_WRAPPER'
    case 'FROZEN_MIGRATION_UNIT':
      return 'ORIGINAL_POSITION_MIGRATION_BOUNDARY'
    default:
      throw new ProvisioningError('UNSUPPORTED_FROZEN_REPLAY_CLASS')
  }
}
export interface FrozenReplay {
  input: Record<string, JsonRecord>
  nodes: JsonRecord[]
  edges: JsonRecord[]
  order: JsonRecord[]
  register: JsonRecord
  byteCommitments: Record<string, string>
}
export function validateReplayTopology(
  nodes: JsonRecord[],
  edges: JsonRecord[],
  order: JsonRecord[],
) {
  requireCondition(
    nodes.length === 107 && edges.length === 231 && order.length === 107,
    'FROZEN_REPLAY_DENOMINATOR_DRIFT',
  )
  const ids = new Set(nodes.map((node) => replayText(node.REPLAY_UNIT_ID)))
  requireCondition(ids.size === 107, 'DUPLICATE_FROZEN_REPLAY_UNIT')
  const positions = new Map(
    order.map((node, index) => {
      requireCondition(
        node.REQUIRED_REPLAY_POSITION === index + 1,
        'FROZEN_TOPOLOGICAL_POSITION_DRIFT',
      )
      return [replayText(node.REPLAY_UNIT_ID), index]
    }),
  )
  requireCondition(
    positions.size === 107 && [...ids].every((id) => positions.has(id)),
    'FROZEN_PLAN_NODE_LOSS_OR_DUPLICATION',
  )
  requireCondition(
    new Set(edges.map((edge) => replayText(edge.EDGE_ID))).size === 231,
    'DUPLICATE_FROZEN_REPLAY_EDGE',
  )
  for (const edge of edges) {
    const from = replayText(edge.FROM),
      to = replayText(edge.TO)
    requireCondition(ids.has(from) && ids.has(to), 'FROZEN_REPLAY_ENDPOINT_MISSING')
    const fromPosition = positions.get(from),
      toPosition = positions.get(to)
    requireCondition(
      fromPosition !== undefined && toPosition !== undefined && fromPosition < toPosition,
      'FROZEN_REPLAY_CYCLE_OR_ORDER_DRIFT',
    )
    requireCondition(
      nodes.find((node) => node.REPLAY_UNIT_ID === from)?.DATABASE_SCOPE ===
        nodes.find((node) => node.REPLAY_UNIT_ID === to)?.DATABASE_SCOPE,
      'CROSS_SCOPE_REPLAY_EDGE',
    )
  }
}
export function validateFrozenReplay(
  inputBytes: Record<string, string>,
  sourceBytes: Record<string, string>,
): FrozenReplay {
  const input = Object.fromEntries(
    Object.entries(replayInputFiles).map(([name, file]) => {
      requireCondition(
        typeof inputBytes[file] === 'string' &&
          replayHash(inputBytes[file]) === replayInputCommitments[file],
        `FROZEN_REPLAY_INPUT_DRIFT:${file}`,
      )
      return [name, replayObject(JSON.parse(inputBytes[file]))]
    }),
  )
  const report = input.w5a,
    graph = input.graph,
    topology = input.topology
  requireCondition(
    replayObject(report.phaseStatus).PHASE_1B_3C_A1I_W5A_GATE === 'PASS',
    'W5A_PASS_REQUIRED',
  )
  requireCondition(input.canonical.CONTRACT_VERSION === '1.3.3', 'FROZEN_CANONICAL_VERSION_DRIFT')
  const commitments = replayObject(report.determinismDigests)
  const nodes = replayRecords(graph.nodes),
    edges = replayRecords(graph.edges),
    order = replayRecords(topology.ORDER)
  const register = replayObject(graph.downstreamRegister)
  requireCondition(
    replayDigest(graph) === commitments.REPLAY_GRAPH_SHA256,
    'FROZEN_GRAPH_DIGEST_DRIFT',
  )
  requireCondition(
    replayDigest(topology) === commitments.TOPOLOGICAL_PLAN_SHA256,
    'FROZEN_TOPOLOGICAL_DIGEST_DRIFT',
  )
  requireCondition(
    replayDigest(nodes) === commitments.REPLAY_UNIT_REGISTRY_SHA256,
    'FROZEN_UNIT_REGISTRY_DIGEST_DRIFT',
  )
  requireCondition(
    replayDigest(register.BOUND_ORDERING_HANDOFFS) === commitments.ORDERING_EDGE_REGISTRY_SHA256,
    'FROZEN_HANDOFF_REGISTRY_DIGEST_DRIFT',
  )
  validateReplayTopology(nodes, edges, order)
  const late = replayRecords(register.BOUND_REPLAY_RECORDS)
  const handoffs = replayRecords(register.BOUND_ORDERING_HANDOFFS)
  requireCondition(late.length === 127 && handoffs.length === 86, 'REPLAY_MECHANIC_OR_HANDOFF_LOSS')
  requireCondition(
    replayDigest(late.map((record) => record.ORIGINAL_RECORD)) === replayDigest(input.late.records),
    'COMPATIBILITY_MECHANIC_DRIFT',
  )
  requireCondition(
    replayDigest(handoffs.map((record) => record.SOURCE_EVIDENCE)) ===
      replayDigest(input.producer.w5OrderingHandoff),
    'ORDERING_HANDOFF_DRIFT',
  )
  requireCondition(
    replayDigest(
      replayRecords(input.downstream.SET_A_POST_W4P_REPLAY).map((record) => record.ORIGINAL_RECORD),
    ) === replayDigest(input.late.records),
    'DOWNSTREAM_REPLAY_REGISTER_DRIFT',
  )
  requireCondition(
    replayDigest(
      replayRecords(input.downstream.SET_B_POST_W4P_ORDERING).map(
        (record) => record.ORIGINAL_HANDOFF,
      ),
    ) === replayDigest(input.producer.w5OrderingHandoff),
    'DOWNSTREAM_ORDERING_REGISTER_DRIFT',
  )
  requireCondition(
    replayRecords(register.DEFERRED_CONSTRAINT_HANDOFFS).length === 7 &&
      replayRecords(register.UNRESOLVED_OPERAND_BINDINGS).length === 9,
    'DOWNSTREAM_RESIDUAL_LOSS',
  )
  requireCondition(
    replayDigest({
      constraints: register.DEFERRED_CONSTRAINT_HANDOFFS,
      operands: register.UNRESOLVED_OPERAND_BINDINGS,
    }) === commitments.DOWNSTREAM_RESIDUAL_REGISTER_SHA256,
    'DOWNSTREAM_RESIDUAL_DIGEST_DRIFT',
  )
  const manifest = replayRecords(input.canonical.frozenMigrationManifest)
  requireCondition(manifest.length === 23, 'FROZEN_MANIFEST_DENOMINATOR_DRIFT')
  const byteCommitments = { ...replayInputCommitments }
  for (const entry of manifest) {
    const file = replayText(entry.FILE),
      hash = replayText(entry.SHA256)
    requireCondition(
      typeof sourceBytes[file] === 'string' && replayHash(sourceBytes[file]) === hash,
      `FROZEN_REPLAY_SOURCE_DRIFT:${file}`,
    )
    byteCommitments[file] = hash
  }
  const counts = {
    EXACT_CREATE_STATEMENT: 0,
    ENUM_DO_WRAPPER: 0,
    ORIGINAL_POSITION_MIGRATION_BOUNDARY: 0,
  }
  for (const node of nodes) {
    counts[replayClass(node)]++
    const file = replayText(node.SOURCE_FILE)
    const entry = manifest.find((entry) => entry.FILE === file)
    requireCondition(
      entry &&
        entry.MIGRATION_NODE_ID === node.FROZEN_MIGRATION_ID &&
        entry.SHA256 === node.SOURCE_SHA256 &&
        entry.FROZEN_POSITION === node.HISTORICAL_POSITION,
      'FROZEN_UNIT_MANIFEST_BINDING_DRIFT',
    )
    requireCondition(node.EXECUTION_ALLOWED === 'NO', 'FROZEN_EXECUTION_AUTHORITY_DRIFT')
    const scope = file.includes('/financial-service/') ? 'FINANCIAL_SERVICE' : 'UE_OPERATIONAL'
    requireCondition(node.DATABASE_SCOPE === scope, 'FROZEN_UNIT_DATABASE_SCOPE_DRIFT')
    if (replayClass(node) === 'ORIGINAL_POSITION_MIGRATION_BOUNDARY') {
      requireCondition(node.EXACT_UNIT_SHA256 === entry.SHA256, 'FROZEN_BOUNDARY_CONTENT_DRIFT')
    } else {
      const bound = late.filter((record) => record.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID)
      requireCondition(
        bound.length > 0 &&
          replayDigest(bound.map((record) => record.COMPATIBILITY_OBLIGATION_ID)) ===
            replayDigest(node.COMPATIBILITY_OBLIGATION_IDS),
        'FROZEN_COMPATIBILITY_UNIT_LINK_DRIFT',
      )
      for (const record of bound) {
        const range = record.SOURCE_RANGE
        requireCondition(Array.isArray(range) && range.length === 2, 'FROZEN_UNIT_RANGE_REQUIRED')
        const start = replayNumber(range[0]),
          end = replayNumber(range[1])
        requireCondition(
          start >= 0 && end > start && end <= sourceBytes[file].length,
          'FROZEN_UNIT_RANGE_INVALID',
        )
        requireCondition(
          replayHash(sourceBytes[file].slice(start, end)) === node.EXACT_UNIT_SHA256 &&
            record.EXACT_UNIT_SHA256 === node.EXACT_UNIT_SHA256,
          'FROZEN_UNIT_CONTENT_DRIFT',
        )
      }
    }
  }
  requireCondition(
    counts.EXACT_CREATE_STATEMENT === 43 &&
      counts.ENUM_DO_WRAPPER === 41 &&
      counts.ORIGINAL_POSITION_MIGRATION_BOUNDARY === 23,
    'FROZEN_UNIT_CLASS_DENOMINATOR_DRIFT',
  )
  for (const handoff of handoffs) {
    const edge = edges.find((edge) => edge.EDGE_ID === handoff.EDGE_ID)
    requireCondition(
      edge &&
        edge.FROM === handoff.FROM_REPLAY_UNIT_ID &&
        edge.TO === handoff.TO_REPLAY_UNIT_ID &&
        edge.SOURCE_RECORD_ID === handoff.ORDERING_RECORD_ID,
      'FROZEN_HANDOFF_EDGE_LINK_LOSS',
    )
  }
  return { input, nodes, edges, order, register, byteCommitments }
}
export interface ReplayBlocker {
  REPLAY_UNIT_ID: string
  SOURCE_FILE: string
  UNIT_CLASS: ReplayUnitClass
  ERROR_CLASS:
    | 'COMPLETE_BOUNDARY_POSTCONDITION_SPECIFICATION_MISSING'
    | 'TRANSACTION_COMPATIBILITY_EVIDENCE_MISSING'
  MISSING_FACTS: string[]
  RECORDED_EVIDENCE: Json
}
export function replayTransactionCompatibility(node: JsonRecord) {
  return replayClass(node) === 'ORIGINAL_POSITION_MIGRATION_BOUNDARY'
    ? 'TRANSACTION_COMPATIBILITY_UNPROVEN'
    : 'TRANSACTION_COMPATIBLE'
}
export function implementationBlockers(frozen: FrozenReplay): ReplayBlocker[] {
  const blockers: ReplayBlocker[] = []
  for (const node of frozen.nodes) {
    const common = {
      REPLAY_UNIT_ID: replayText(node.REPLAY_UNIT_ID),
      SOURCE_FILE: replayText(node.SOURCE_FILE),
      UNIT_CLASS: replayClass(node),
    }
    if (common.UNIT_CLASS === 'ORIGINAL_POSITION_MIGRATION_BOUNDARY')
      blockers.push({
        ...common,
        ERROR_CLASS: 'COMPLETE_BOUNDARY_POSTCONDITION_SPECIFICATION_MISSING',
        MISSING_FACTS: [
          'An exact accepted exhaustive postcondition set for the complete original-position unit,including every non-CREATE/postcreate operation.',
          'Read-only inspection predicates and exact expected values/comparators for those postconditions,including later-evolution state where relevant.',
          'Deterministic absent/complete/drifted/partial discrimination;object presence or an adapter-supplied completion boolean is not sufficient.',
        ],
        RECORDED_EVIDENCE: node.POSTCONDITIONS ?? null,
      })
    if (replayTransactionCompatibility(node) === 'TRANSACTION_COMPATIBILITY_UNPROVEN')
      blockers.push({
        ...common,
        ERROR_CLASS: 'TRANSACTION_COMPATIBILITY_EVIDENCE_MISSING',
        MISSING_FACTS: [
          'An evidence-backed TRANSACTION_COMPATIBLE or TRANSACTION_BOUNDARY_REQUIRED assignment for this exact immutable unit.',
          'A scope-isolated rollback boundary consistent with any internal transaction/control or transaction-prohibited operations;source hashes alone do not establish transaction semantics.',
        ],
        RECORDED_EVIDENCE: {
          SOURCE_SHA256: node.SOURCE_SHA256 ?? null,
          EXACT_UNIT_SHA256: node.EXACT_UNIT_SHA256 ?? null,
          TRANSACTION_CLASSIFICATION_IN_W5A: 'NOT_RECORDED',
        },
      })
  }
  return blockers
}
export interface BlockedUnitInspection {
  REPLAY_UNIT_ID: string
  STATE: ReplayInspectionState
  PLANNED_ACTION: 'FAIL_CLOSED'
  ERROR_CLASSES: string[]
}
export function inspectBlockedReplay(
  frozen: FrozenReplay,
  w4pVerification: 'NOT_PROVIDED' | 'UNVERIFIED_ASSERTION' = 'NOT_PROVIDED',
): BlockedUnitInspection[] {
  return frozen.order.map((node) => ({
    REPLAY_UNIT_ID: replayText(node.REPLAY_UNIT_ID),
    STATE: 'PRECONDITION_MISSING',
    PLANNED_ACTION: 'FAIL_CLOSED',
    ERROR_CLASSES: [
      w4pVerification === 'NOT_PROVIDED'
        ? 'W4P_BASELINE_VERIFICATION_REQUIRED'
        : 'W4P_COMPLETION_ASSERTION_IS_NOT_VERIFICATION',
      'W5B_INSPECTION_AND_TRANSACTION_IMPLEMENTATION_BLOCKED',
    ],
  }))
}
export function denyReplayExecution(): never {
  throw new ProvisioningError('W5B_IMPLEMENTATION_BLOCKED_EXECUTION_NOT_AUTHORIZED')
}
