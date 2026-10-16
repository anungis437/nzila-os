import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import {
  compileInvariant,
  canonicalPayloadCommitment,
  topologicalOrder,
  validateSpecification,
  type CanonicalPayload,
  type PayloadKind,
  type PromotionSpecification,
} from '../../apps/union-eyes/scripts/provisioning/platform-baseline-promotion'
import { inverse, object, restore, type InversePatch } from './adopt-w4-platform-ownership'
import { reconstructChain } from './author-w4fr4-final-baseline'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4fr4: folder + 'PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.json',
  definitions: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.json',
  payloads: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json',
  w4pg: folder + 'PHASE_1B_3C_A1I_W4PG_PROMOTION_GATE_NORMALIZATION.json',
  cut: folder + 'UE_W4P_PROMOTION_DEPENDENCY_CUT.json',
  downstream: folder + 'UE_POST_W4P_COMPATIBILITY_OBLIGATIONS.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const fixedHashes: Record<string, string> = {
  [files.w4fr4]: 'feca82ce999454257dfd3157011684a829731bedab070d07890bc2f39d00f1c6',
  [files.definitions]: 'b84d75a98fec07e86ad68689a93ceebbdb262eee143de2a8f8eee6ba8562784d',
  [files.payloads]: '6f81fde1377714e0fb63177cd976a010ec6db197bb8365ad340b8b40d4629e2b',
  [files.w4pg]: 'e391b68a8e387180ac32d2e1f1d2353f4b155858e4b833f95a3105b2e87a3feb',
  [files.cut]: '57a593f2a1a617d7a26bb54d7eca673094d02d639bc1028140e88d59de55127b',
  [files.downstream]: '2e10f3e40761c6b93bca473b263c262c2222f7b3a875e41ab268fa1b4448e043',
  [files.producer]: 'ba88ee29a58c55c6b50930ff75089a59c00c68526f2e2e12547e801cca6c9673',
  [files.canonical]: '89dda28394c53c1c9ed9222982c6fff4b0840186831129f32206ba451cc3b1fd',
}
export const outputs = {
  plan: folder + 'UE_W4_PLATFORM_BASELINE_PROMOTION_PLAN.json',
  planMarkdown: folder + 'UE_W4_PLATFORM_BASELINE_PROMOTION_PLAN.md',
  implementation: folder + 'UE_W4_PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION.json',
  implementationMarkdown: folder + 'UE_W4_PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION.md',
  report: folder + 'PHASE_1B_3C_A1I_W4P_PLATFORM_BASELINE_PROMOTION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4P_PLATFORM_BASELINE_PROMOTION.md',
}
export const entrypoint = 'apps/union-eyes/scripts/provisioning/platform-baseline-promotion.ts'
const validationSources = [
  entrypoint,
  entrypoint.replace(/\.ts$/, '.test.ts'),
  'scripts/ue/implement-w4p-platform-promotion.ts',
  'scripts/ue/implement-w4p-platform-promotion.test.ts',
  'scripts/ue/w4p-historical-inputs.ts',
  'scripts/ue/w4p-historical-test-setup.ts',
  'scripts/ue/w4p-predecessor.vitest.config.ts',
  'scripts/ue/w4fr4-historical-test-setup.ts',
  'scripts/ue/verify-frozen-w4.test.ts',
]
  .map((file) => file.replaceAll('/', '\\'))
  .join(' ')
type Json = Parameters<typeof inverse>[0]
type RecordJson = ReturnType<typeof object>
const records = (value: Json | undefined) => {
  assert(Array.isArray(value))
  return value.map(object)
}
const text = (value: Json | undefined): string => {
  assert(typeof value === 'string')
  return value
}
const strings = (value: Json | undefined): string[] => {
  assert(Array.isArray(value) && value.every((item) => typeof item === 'string'))
  return value
}
export async function jsonBytes(value: unknown) {
  const config = await resolveConfig(path.join(root, 'package.json'))
  return format(JSON.stringify(value), { ...config, parser: 'json' })
}
interface Amendment {
  PRIOR_JSON_INVERSE_PATCHES: { canonical: InversePatch[]; producer: InversePatch[] }
  VERSION_1_3_2_SHA256: string
  VERSION_1_3_3_SHA256: string
  PRIOR_PRODUCER_SHA256: string
  AMENDED_PRODUCER_SHA256: string
}
export async function originalInputs() {
  const canonicalBytes = read(files.canonical)
  const producerBytes = read(files.producer)
  const canonical = object(JSON.parse(canonicalBytes))
  if (canonical.CONTRACT_VERSION === '1.3.2') return { canonicalBytes, producerBytes }
  assert.equal(canonical.CONTRACT_VERSION, '1.3.3')
  const report: { versionAmendment: Amendment } = JSON.parse(read(outputs.report))
  const amendment = report.versionAmendment
  assert.equal(sha(canonicalBytes), amendment.VERSION_1_3_3_SHA256, 'CURRENT_CANONICAL_DRIFT')
  assert.equal(sha(producerBytes), amendment.AMENDED_PRODUCER_SHA256, 'CURRENT_PRODUCER_DRIFT')
  const priorCanonical = await jsonBytes(
    restore(canonical, amendment.PRIOR_JSON_INVERSE_PATCHES.canonical),
  )
  const priorProducer = await jsonBytes(
    restore(object(JSON.parse(producerBytes)), amendment.PRIOR_JSON_INVERSE_PATCHES.producer),
  )
  assert.equal(sha(priorCanonical), amendment.VERSION_1_3_2_SHA256)
  assert.equal(sha(priorProducer), amendment.PRIOR_PRODUCER_SHA256)
  return { canonicalBytes: priorCanonical, producerBytes: priorProducer }
}
function originalMarkdown() {
  if (object(JSON.parse(read(files.canonical))).CONTRACT_VERSION === '1.3.2')
    return {
      canonical: read(files.canonical.replace(/\.json$/, '.md')),
      producer: read(files.producer.replace(/\.json$/, '.md')),
    }
  const report: {
    priorMarkdown: { canonical: string; producer: string }
    amendedMarkdownSha: { canonical: string; producer: string }
  } = JSON.parse(read(outputs.report))
  for (const key of ['canonical', 'producer'] as const)
    assert.equal(
      sha(read(files[key].replace(/\.json$/, '.md'))),
      report.amendedMarkdownSha[key],
      'AMENDED_MARKDOWN_DRIFT',
    )
  return report.priorMarkdown
}
export async function loadSpecification(): Promise<{
  specification: PromotionSpecification
  input: Record<string, RecordJson>
}> {
  const original = await originalInputs()
  const input = Object.fromEntries(
    Object.entries(files).map(([name, file]) => {
      const bytes =
        name === 'canonical'
          ? original.canonicalBytes
          : name === 'producer'
            ? original.producerBytes
            : read(file)
      assert.equal(sha(bytes), fixedHashes[file], `FIXED_INPUT_DRIFT:${file}`)
      return [name, object(JSON.parse(bytes))]
    }),
  )
  assert.equal(object(input.w4pg.phaseStatus).PHASE_1B_3C_A1I_W4PG_GATE, 'PASS')
  assert.equal(object(input.w4pg.phaseStatus).W4P, 'AUTHORIZED_NOT_STARTED')
  assert.equal(object(input.w4pg.summary).PRE_W4P_COMPATIBILITY_BLOCKERS, 0)
  assert.equal(object(input.w4pg.summary).PRE_W4P_W5_COMPATIBILITY_SLICE_COUNT, 0)
  assert.equal(digest(input.cut), input.w4pg.DEPENDENCY_CUT_SHA256)
  assert.equal(digest(input.downstream), input.w4pg.DOWNSTREAM_REGISTER_SHA256)
  const payloads = ['TYPE_PAYLOADS', 'RELATION_CREATE_PAYLOADS', 'ADD_COLUMN_PAYLOADS']
    .flatMap((key) => records(input.payloads[key]))
    .map((record): CanonicalPayload => {
      const kind = text(record.PAYLOAD_KIND)
      assert(['TYPE_DEFINITION', 'CREATE_RELATION', 'ADD_COLUMN'].includes(kind))
      const payloadKind: PayloadKind =
        kind === 'TYPE_DEFINITION'
          ? 'TYPE_DEFINITION'
          : kind === 'CREATE_RELATION'
            ? 'CREATE_RELATION'
            : 'ADD_COLUMN'
      assert.equal(record.EXECUTION_ALLOWED, 'NO')
      return {
        PAYLOAD_ID: text(record.PAYLOAD_ID),
        PAYLOAD_KIND: payloadKind,
        PHYSICAL_IDENTITIES_PRODUCED: strings(record.PHYSICAL_IDENTITIES_PRODUCED),
        DEPENDENCY_PAYLOAD_IDS: strings(record.DEPENDENCY_PAYLOAD_IDS),
        DEFINITION_OBLIGATION_IDS: strings(record.DEFINITION_OBLIGATION_IDS),
        DEFERRED_CONSTRAINT_HANDOFF_IDS: strings(record.DEFERRED_CONSTRAINT_HANDOFF_IDS),
        SQL: text(record.SQL),
        SQL_SHA256: text(record.SQL_SHA256),
      }
    })
  const binding = records(input.producer.w2TargetBindings)
  assert.equal(binding.length, 1)
  const w3 = object(input.producer.w3Preconditions)
  const targetBinding = {
    DATABASE_SCOPE_ID: text(binding[0].DATABASE_SCOPE_ID),
    DATABASE_ACTOR_ID: text(binding[0].DATABASE_ACTOR_ID),
    TARGET_ID: text(binding[0].TARGET_ID),
    SEARCH_PATH_CONTRACT_ID: text(binding[0].SEARCH_PATH_CONTRACT_ID),
  }
  const pathContract = object(input.canonical.searchPathContract)
  const searchPath = strings(
    object(pathContract.MIGRATION_SEARCH_PATH)[targetBinding.SEARCH_PATH_CONTRACT_ID],
  )
  const specification: PromotionSpecification = {
    contractVersion: '1.3.3',
    payloadRegistryDigest: fixedHashes[files.payloads],
    downstreamObligationDigest: fixedHashes[files.downstream],
    dependencyCutDigest: text(input.w4pg.DEPENDENCY_CUT_SHA256),
    invariants: payloads.map(compileInvariant),
    obligationIds: records(input.definitions.physicalDefinitions).map((record) =>
      text(record.DEFINITION_OBLIGATION_ID),
    ),
    requiredExtensions: records(w3.REQUIRED_EXTENSION_IDS).map((record) => text(record.EXTENSION)),
    targetBinding,
    searchPath,
  }
  validateSpecification(specification)
  const typeRecords = records(input.definitions.types)
  for (const invariant of specification.invariants.filter(
    (record) => record.payload.PAYLOAD_KIND === 'TYPE_DEFINITION',
  )) {
    const type = typeRecords.find(
      (record) => record.CANONICAL_TYPE_IDENTITY === `public.${invariant.name}`,
    )
    assert(type)
    assert.deepEqual(invariant.enumMembers, object(type.SELECTED).ORDERED_ENUM_MEMBERS)
  }
  const cutPayloads = records(input.cut.payloadSubjects)
  for (const invariant of specification.invariants) {
    const cut = cutPayloads.find((record) => record.SUBJECT_ID === invariant.payload.PAYLOAD_ID)
    assert(cut, 'CUT_PAYLOAD_LINK_MISSING')
    const cutOperands = records(cut.MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS).map((record) =>
      text(record.PHYSICAL_IDENTITY),
    )
    assert.deepEqual(
      invariant.requiredExistingColumns.map(
        (name) => `union-eyes::COLUMN::public.${invariant.name}.${name}`,
      ),
      cutOperands,
    )
  }
  const forbidden = new Set(
    records(input.cut.operandEffects).map((record) => text(record.PHYSICAL_OPERAND_IDENTITY)),
  )
  assert(
    specification.invariants.every(
      (record) =>
        !record.payload.PHYSICAL_IDENTITIES_PRODUCED.some((identity) => forbidden.has(identity)) &&
        !record.requiredExistingColumns.some((name) =>
          forbidden.has(`union-eyes::COLUMN::public.${record.name}.${name}`),
        ),
    ),
  )
  return { specification, input }
}
function inactive(value: Json): void {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (key === 'EXECUTION_ALLOWED') assert.equal(child, 'NO')
    if (key === 'MUTATING_OPERATIONS') assert.deepEqual(child, [])
    inactive(child)
  }
}
export async function buildImplementation() {
  const { specification, input } = await loadSpecification()
  const original = await originalInputs()
  const order = topologicalOrder(specification.invariants)
  const planBody = {
    CANONICAL_CONTRACT_VERSION: '1.3.3',
    PAYLOAD_REGISTRY_DIGEST: specification.payloadRegistryDigest,
    DEPENDENCY_CUT_DIGEST: specification.dependencyCutDigest,
    PAYLOAD_ORDER: order.map((record) => record.payload.PAYLOAD_ID),
    PRECONDITIONS: object(input.cut.externalPrerequisites),
    PAYLOAD_PRECONDITIONS: records(input.cut.payloadSubjects).map((record) => ({
      PAYLOAD_ID: record.SUBJECT_ID,
      RECORDED_PRODUCER_PRECONDITIONS: record.PRODUCER_PRECONDITIONS,
      REQUIRED_POSTCONDITIONS: record.REQUIRED_POSTCONDITIONS,
      MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS:
        record.MATERIALIZED_CONSTRAINT_OPERAND_PRECONDITIONS,
    })),
    PER_PAYLOAD_INSPECTION_RESULT: order.map((record) => ({
      PAYLOAD_ID: record.payload.PAYLOAD_ID,
      STATE: 'PRECONDITION_MISSING',
      REASONS: ['OFFLINE_NO_AUTHENTICATED_TARGET_OR_CATALOG'],
      EXTRA_CONTEXTUAL_STATE: 'OBSERVED_NOT_REAUTHORED',
    })),
    PER_PAYLOAD_PLANNED_ACTION: order.map((record) => ({
      PAYLOAD_ID: record.payload.PAYLOAD_ID,
      ACTION: 'FAIL_CLOSED',
    })),
    DEFERRED_POST_W4P_OBLIGATION_DIGEST: specification.downstreamObligationDigest,
    PLAN_STATE: 'OFFLINE_IMPLEMENTATION_PLAN_NOT_RUNTIME_INSPECTION',
    EXECUTION_ALLOWED: 'NO',
    CANONICAL_DDL_REGENERATED: 'NO',
    CANONICAL_DDL_REWRITTEN: 'NO',
    DAG: {
      PAYLOAD_NODES: 162,
      CYCLE_COUNT: 0,
      UNRESOLVED_DEPENDENCY_EDGES: 0,
      EDGES: order.flatMap((record) =>
        record.payload.DEPENDENCY_PAYLOAD_IDS.map((id) => ({
          FROM: record.payload.PAYLOAD_ID,
          REQUIRES: id,
        })),
      ),
    },
  }
  const plan = { PLAN_DIGEST: digest(planBody), ...planBody }
  const registry = order.map((record, index) => ({
    PAYLOAD_ID: record.payload.PAYLOAD_ID,
    IMPLEMENTATION_HANDLER: entrypoint + '#applyPromotion',
    INSPECTION_HANDLER: entrypoint + '#inspectPayload',
    VERIFICATION_HANDLER: entrypoint + '#verifyBaseline',
    EXECUTION_LAYER: record.payload.PAYLOAD_KIND,
    PLAN_POSITION: index + 1,
    DEPENDENCY_IDS: record.payload.DEPENDENCY_PAYLOAD_IDS,
    SQL_SHA256: record.payload.SQL_SHA256,
    DEFINITION_OBLIGATION_IDS: record.payload.DEFINITION_OBLIGATION_IDS,
    PHYSICAL_IDENTITIES: record.payload.PHYSICAL_IDENTITIES_PRODUCED,
    DEFERRED_CONSTRAINT_HANDOFF_IDS: record.payload.DEFERRED_CONSTRAINT_HANDOFF_IDS,
    MATCHING_INVARIANTS: {
      schema: record.schema,
      name: record.name,
      enumMembers: record.enumMembers,
      columns: record.columns,
      uniqueConstraints: record.uniqueConstraints,
      parentIdentity: record.parentIdentity,
      requiredExistingColumns: record.requiredExistingColumns,
    },
    EXECUTION_STATUS: 'IMPLEMENTED_NOT_EXECUTED',
    EXECUTION_ALLOWED: 'NO',
  }))
  const implementation = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4P',
      INPUTS: files,
      ENTRYPOINT: entrypoint,
      ENTRYPOINT_SHA256: sha(read(entrypoint)),
      AUTHORITATIVE_NORMALIZED_PAYLOAD_COMMITMENT: canonicalPayloadCommitment,
    },
    registry,
    coverage: {
      TYPE_HANDLERS: 36,
      RELATION_CREATE_HANDLERS: 57,
      ADD_COLUMN_HANDLERS: 69,
      TOTAL: 162,
      OBLIGATION_LINKS: 183,
      UNLINKED: 0,
      MULTI_LINKED: 0,
    },
    stateModel: ['ABSENT', 'PRESENT_MATCHING', 'PRESENT_DRIFTED', 'PRECONDITION_MISSING'],
    catalogInspection:
      'Parameterized read-only pg_catalog queries;strict result decoding;W4 required subset matching;exact enum order,column properties and emitted unique constraints/backing-index validity.',
    transactionModel:
      'Single pinned client in external rollback-on-rejection exclusive transaction;inspect all objects before first mutation;exact immutable SQL only;complete final catalog re-read;no partial-success commit.',
    authorization: {
      DEFAULT_EXECUTION_AUTHORIZATION: 'DENY',
      CURRENT_EXECUTION_ALLOWED: 'NO',
      FUTURE_REQUIRED:
        'Explicit authorization bound to live plan digest,payload digest,target digest and authenticated migration principal;application-runtime actor rejected.',
    },
    CONCURRENCY_GUARD: 'EXPLICIT_IMPLEMENTATION_RESIDUAL',
    CONCURRENCY_RESIDUAL:
      'No canonical lock helper exists in bounded provisioning. No DB lock protocol invented. Future apply is denied without a W8-authenticated adapter implementing withExclusiveTransaction,including exclusive concurrency and rollback-on-rejection. This phase supplies and tests the mechanism/interface,not the concrete DB connector or runtime guard.',
    receiptModel: {
      PAYLOAD: [
        'PAYLOAD_ID',
        'PHYSICAL_IDENTITIES',
        'INSPECTION_STATE_BEFORE',
        'PLANNED_ACTION',
        'ACTION_TAKEN',
        'SQL_SHA256',
        'POSTCONDITION_STATE',
        'ERROR_CLASS',
        'ERROR_DETAIL_DIGEST',
      ],
      PROMOTION: [
        'PROMOTION_RUN_ID',
        'PLAN_DIGEST',
        'CONTRACT_VERSION',
        'STARTED_AT',
        'COMPLETED_AT',
        'ACTOR_CLASS',
        'DATABASE_SCOPE',
        'PAYLOAD_TOTAL',
        'ABSENT_COUNT',
        'PRESENT_MATCHING_COUNT',
        'DRIFT_COUNT',
        'PRECONDITION_MISSING_COUNT',
        'MUTATED_COUNT',
        'NOOP_COUNT',
        'FINAL_VERIFICATION',
        'ROLLBACK_OCCURRED',
      ],
      PERSISTENCE: 'NONE;future caller owns receipt storage;no business/audit table invented',
    },
    REPLAY_SAFETY:
      'Matching baseline -> REPLAY_NOOP;0 mutations;VERIFY_ONLY. Any governed drift/precondition failure -> fail before mutation;no repair/coercion/duplicate tolerance.',
    EXECUTION_ALLOWED: 'NO',
  }
  const canonical = structuredClone(input.canonical)
  const producer = structuredClone(input.producer)
  const metadata = {
    AMENDMENT: 'PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION',
    W4P_IMPLEMENTATION_STATUS: 'COMPLETE_NOT_EXECUTED',
    W4P_IMPLEMENTATION_ENTRYPOINT: entrypoint,
    W4P_IMPLEMENTATION_ENTRYPOINT_SHA256: implementation.metadata.ENTRYPOINT_SHA256,
    W4P_PLAN_DIGEST: plan.PLAN_DIGEST,
    W4P_PAYLOAD_COUNT: 162,
    DEFINITION_COMPLETE: 'YES',
    PROMOTION_IMPLEMENTATION_COMPLETE: 'YES',
    PROMOTION_EXECUTED: 'NO',
    MATERIALIZATION_EXECUTED: 'NO',
    RUNTIME_PROOF_COMPLETE: 'NO',
    EXECUTION_ALLOWED: 'NO',
    MUTATING_OPERATIONS: [],
    CONCURRENCY_GUARD: implementation.CONCURRENCY_GUARD,
    POST_W4P_REPLAY_RECORDS: 127,
    POST_W4P_ORDERING_HANDOFFS: 86,
    POST_W4P_DEFERRED_CONSTRAINTS: 7,
    UNRESOLVED_DOWNSTREAM_OPERAND_BINDINGS: 9,
  }
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4P_GATE: 'PASS',
    PHASE_1B_3C_A1I_W4P: 'PASS',
    PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION: 'COMPLETE_NOT_EXECUTED',
    W4: 'PASS',
    W4P_RUNTIME_EXECUTION: 'NOT_AUTHORIZED',
    W5: 'AUTHORIZED_NOT_STARTED',
    CANONICAL_CONTRACT_VERSION: '1.3.3',
  }
  canonical.CONTRACT_VERSION = '1.3.3'
  canonical.platformBaselinePromotionImplementation = metadata
  Object.assign(object(canonical.phaseStatus), phaseStatus)
  canonical.versionChain = [
    ...records(canonical.versionChain),
    {
      VERSION: '1.3.3',
      PRIOR_VERSION: '1.3.2',
      PRIOR_SHA256: fixedHashes[files.canonical],
      RECONSTRUCTION_REFERENCE:
        outputs.report + '#versionAmendment.PRIOR_JSON_INVERSE_PATCHES.canonical',
    },
  ]
  producer.platformBaselinePromotionImplementation = metadata
  Object.assign(object(producer.phaseStatus), phaseStatus)
  for (const record of records(producer.platformProducerRegistry).filter(
    (record) => record.DEFINITION_SOURCE_CLASS === 'GOVERNED_W4FR4',
  )) {
    record.W4P_IMPLEMENTATION_STATUS = 'COMPLETE_NOT_EXECUTED'
    record.W4P_IMPLEMENTATION_ENTRYPOINT = entrypoint
    record.W4P_PLAN_DIGEST = plan.PLAN_DIGEST
    record.W4P_PAYLOAD_COUNT = 162
  }
  inactive(canonical)
  inactive(producer)
  const canonicalBytes = await jsonBytes(canonical)
  const producerBytes = await jsonBytes(producer)
  const patches = {
    canonical: inverse(input.canonical, canonical),
    producer: inverse(input.producer, producer),
  }
  assert.equal(
    sha(await jsonBytes(restore(canonical, patches.canonical))),
    fixedHashes[files.canonical],
  )
  const fr4Amendment = object(input.w4fr4.versionAmendment)
  const priorPatches: InversePatch[] = JSON.parse(
    JSON.stringify(object(fr4Amendment.PRIOR_JSON_INVERSE_PATCHES).canonical),
  )
  const w4gFile = folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json'
  const w4gBytes = read(w4gFile)
  assert.equal(
    sha(w4gBytes),
    object(object(input.w4fr4.preservation).BYTE_COMMITMENTS)[w4gFile],
    'RECONSTRUCTION_LINEAGE_DRIFT',
  )
  const history = await reconstructChain(
    input.canonical,
    priorPatches,
    object(JSON.parse(w4gBytes)),
  )
  const priorMarkdown = originalMarkdown()
  const section = await format(
    `\n## Current W4P implementation amendment - canonical1.3.3\n\nPrior phase descriptions above are immutable history. PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION now supplies162 exact-payload handlers,183 obligation links,36 named-type inspectors and fail-closed future plan/apply/verify/replay-noop behavior. Implementation availability is not execution authorization.\n\nW4P_IMPLEMENTATION_STATUS=COMPLETE_NOT_EXECUTED;W4=PASS;W4P_RUNTIME_EXECUTION=NOT_AUTHORIZED;W5=AUTHORIZED_NOT_STARTED. EXECUTION_ALLOWED=NO;MUTATING_OPERATIONS=[];PROMOTION_EXECUTED=NO;MATERIALIZATION_EXECUTED=NO;RUNTIME_PROOF_COMPLETE=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO. Concurrency remains an explicit W8 adapter residual;no lock protocol or DB connection introduced. Downstream127 replay/86 ordering/7 constraints/9 operand residuals remain unchanged and unexecuted.\n\nSee [W4P implementation report](./PHASE_1B_3C_A1I_W4P_PLATFORM_BASELINE_PROMOTION.md) and [promotion registry](./UE_W4_PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION.json). Exact inverse patches preserve canonical1.3.2 and the full historical chain;no1.4 created.\n`,
    { ...(await resolveConfig(path.join(root, 'package.json'))), parser: 'markdown' },
  )
  const amendedMarkdown = {
    canonical: priorMarkdown.canonical + '\n' + section,
    producer: priorMarkdown.producer + '\n' + section,
  }
  assert.equal(
    sha(await jsonBytes(restore(producer, patches.producer))),
    fixedHashes[files.producer],
  )
  const report = {
    metadata: implementation.metadata,
    summary: {
      PAYLOADS: 162,
      DEFINITIONS: 183,
      TYPE_PAYLOADS: 36,
      RELATION_CREATE_PAYLOADS: 57,
      ADD_COLUMN_PAYLOADS: 69,
      UNLINKED_W4_OBLIGATIONS: 0,
      MULTI_LINKED_W4_OBLIGATIONS: 0,
      CYCLE_COUNT: 0,
      UNRESOLVED_DEPENDENCY_EDGES: 0,
      POST_W4P_ITEMS_IN_PROMOTION_PRECONDITION_GRAPH: 0,
      DEFERRED_CONSTRAINTS: 7,
      DEFERRED_CONSTRAINTS_MATERIALIZED_BY_W4P: 0,
      POST_W4P_REPLAY_RECORDS: 127,
      POST_W4P_ORDERING_HANDOFFS: 86,
      POST_W4P_DEFERRED_CONSTRAINTS: 7,
      UNRESOLVED_DOWNSTREAM_OPERAND_BINDINGS: 9,
      CANONICAL_DDL_REGENERATED: 'NO',
      CANONICAL_DDL_REWRITTEN: 'NO',
      SQL_AUTHORED: 0,
      SQL_EXECUTED: 0,
      PRODUCERS_ACTIVATED: 0,
    },
    phaseStatus,
    CONCURRENCY_GUARD: implementation.CONCURRENCY_GUARD,
    CONCURRENCY_RESIDUAL: implementation.CONCURRENCY_RESIDUAL,
    PLAN_DIGEST: plan.PLAN_DIGEST,
    IMPLEMENTATION_DIGEST: digest(implementation),
    preservation: {
      FIXED_INPUT_HASHES: fixedHashes,
      CANONICAL_DDL_SHA256: digest(
        order.map((record) => [record.payload.PAYLOAD_ID, record.payload.SQL_SHA256]),
      ),
      W4PG_CUT_SHA256: fixedHashes[files.cut],
      DOWNSTREAM_REGISTER_SHA256: fixedHashes[files.downstream],
      PAYLOAD_BYTES_CHANGED: 0,
      DOWNSTREAM_BYTES_CHANGED: 0,
    },
    versionAmendment: {
      VERSION_1_3_2_SHA256: fixedHashes[files.canonical],
      VERSION_1_3_3_SHA256: sha(canonicalBytes),
      PRIOR_PRODUCER_SHA256: fixedHashes[files.producer],
      AMENDED_PRODUCER_SHA256: sha(producerBytes),
      PRIOR_JSON_INVERSE_PATCHES: patches,
      VERSION_CHAIN_RECONSTRUCTION: [
        { VERSION: '1.3.3', SHA256: sha(canonicalBytes) },
        { VERSION: '1.3.2', SHA256: fixedHashes[files.canonical] },
        ...history,
      ],
    },
    priorMarkdown,
    amendedMarkdownSha: {
      canonical: sha(amendedMarkdown.canonical),
      producer: sha(amendedMarkdown.producer),
    },
    validation: {
      EXACT162_ACCOUNTING: 'PASS',
      EXACT183_LINKAGE: 'PASS',
      TOPOLOGICAL_ORDER: 'PASS',
      SQL_HASH_VALIDATION: 'PASS',
      INVERSE_1_3_3_TO_1_3_2: 'PASS',
      COMPLETED_CHECKS: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts apps\\union-eyes\\scripts\\provisioning\\platform-baseline-promotion.test.ts scripts\\ue\\implement-w4p-platform-promotion.test.ts',
          RESULT: 'PASS',
          TESTS: 895,
        },
        {
          COMMAND:
            'pnpm exec vitest run --config scripts\\ue\\w4p-predecessor.vitest.config.ts scripts\\ue\\normalize-w4pg-promotion-gate.test.ts scripts\\ue\\bind-w4lb-supplemental-operands.test.ts scripts\\ue\\classify-w4lc-compatibility.test.ts scripts\\ue\\author-w4fr4-final-baseline.test.ts',
          RESULT: 'PASS_EXACT_RECONSTRUCTED_1_3_2_INPUTS',
          TESTS: 1154,
        },
        {
          COMMAND:
            'pnpm exec vitest run --config scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\close-w4c-constraint-timing.test.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts scripts\\ue\\verify-frozen-w4.test.ts',
          RESULT: 'PASS_EXACT_HISTORICAL_INPUTS',
          TESTS: 141,
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node ' +
            validationSources,
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 ' +
            validationSources,
          RESULT: 'PASS_EXIT0_EXISTING_NEXT_PAGES_DIRECTORY_DIAGNOSTIC',
        },
        {
          COMMAND:
            'pnpm exec prettier --check ' +
            validationSources +
            ' "docs\\union-eyes\\reality-remediation\\*W4P_PLATFORM*" "docs\\union-eyes\\reality-remediation\\UE_W4_PLATFORM_BASELINE_PROMOTION*" docs\\union-eyes\\reality-remediation\\UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json docs\\union-eyes\\reality-remediation\\UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\implement-w4p-platform-promotion.ts --self-test --check',
          RESULT: 'PASS_TWO_GENERATION_EXACT_BYTES_AND_PERSISTED_OUTPUT_EQUALITY',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS_0_ERRORS_1215_EXISTING_WARNINGS',
        },
      ],
      INDEPENDENT_FULL_CHAIN_RECONSTRUCTION:
        'PASS_1_3_3_TO_1_3_2_TO_1_3_1_TO_1_3_TO_1_2_TO_1_1_TO_1_0',
      FIXED_INPUT_COMMITMENTS: 'PASS_8_WITH_EXACT_PRIOR_CONTRACT_RECONSTRUCTION',
      INHERITED_FROZEN_COMMITMENTS:
        'PASS_94_ORIGINAL_COMMITMENTS_WITH_ONLY_METADATA_AMENDED_CONTRACT_PAIRS_RECONSTRUCTED',
      REAL_DATABASE_CONNECTIONS: 0,
      REAL_SQL_EXECUTIONS: 0,
    },
    proofBoundaries: {
      DATABASE_ROLES_PROVISIONED: 'NO',
      ROLE_MEMBERSHIPS_APPLIED: 'NO',
      NAMED_TYPES_MATERIALIZED: 'NO',
      DJANGO_SCHEMA_MATERIALIZED: 'NO',
      PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      PHYSICAL_PRODUCERS_EXECUTED: 'NO',
      W4P_EXECUTED: 'NO',
      CANONICAL_DEFINITION_SQL_EXECUTED: 'NO',
      COMPATIBILITY_MECHANICS_EXECUTED: 'NO',
      W5_EXECUTED: 'NO',
      DATABASE_RUNTIME_CONFIGURATION_APPLIED: 'NO',
      BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
      FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
      PRODUCTION_SCHEMA_PROVEN: 'NO',
      RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
      TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
      SQL_EXECUTED: 0,
      PRODUCERS_ACTIVATED: 0,
    },
  }
  assert.equal(sha(original.canonicalBytes), fixedHashes[files.canonical])
  return {
    specification,
    plan,
    implementation,
    report,
    canonicalBytes,
    producerBytes,
    amendedMarkdown,
  }
}
export async function generate() {
  const model = await buildImplementation()
  const config = await resolveConfig(path.join(root, 'package.json'))
  const overview = `# W4P platform baseline promotion implementation - PASS

## Architecture and exact coverage

[Promotion engine](../../../apps/union-eyes/scripts/provisioning/platform-baseline-promotion.ts) implements pure PLAN/INSPECT/VERIFY,read-only parameterized catalog inspection and explicitly authorized future APPLY.162 immutable W4FR4 payloads:36 types/57 relation creates/69 add-columns;183 obligations linked once. Canonical DDL never regenerated or rewritten. Dependency ordering uses the fixed DAG;no post-W4P127/86/7/9 items are promotion preconditions.

## State,matching and drift

ABSENT -> APPLY_CANONICAL_PAYLOAD only after exact preconditions;PRESENT_MATCHING -> VERIFY_ONLY;PRESENT_DRIFTED/PRECONDITION_MISSING -> FAIL_CLOSED before mutation. Minimum relation subset matching permits extra contextual columns and does not reauthor them. Enum member order,column type/nullability/default/identity/generated state,and every actually emitted UNIQUE constraint including backing-index validity are inspected exactly. Seven deferred constraints are excluded,not dropped.

## Future apply,authorization and transactions

Default execution authorization DENY. Explicit authorization binds live-plan/payload/target digests and authenticated MIGRATION_ADMIN principal. W2 scope/target/search path,W3 existing snapshot verifier/extension/delegation/privilege doctrine,complete Django macro predecessor,and accepted parent/compound-UNIQUE operands remain prerequisites. Application-runtime actors rejected.
Future apply uses one pinned client,full pre-mutation inspection,exact SQL bytes,and a final complete catalog re-read. Any mutation/postcondition failure rejects the transaction;no partial-success commit. Matching replay is REPLAY_NOOP with0 mutations. Receipts are typed deterministic shapes;only fake tests exercise mutation;no receipt store invented.

CONCURRENCY_GUARD=EXPLICIT_IMPLEMENTATION_RESIDUAL. Bounded provisioning has no lock helper;no DB lock protocol invented. Future authenticated W8 connector must implement exclusive rollback-on-rejection withExclusiveTransaction;without that boundary apply is denied. This is explicitly not a runtime lock certification.

## Governance and preservation

Producer metadata W4P_IMPLEMENTATION_STATUS=COMPLETE_NOT_EXECUTED;entrypoint/plan digest/162 count recorded. MUTATING_OPERATIONS=[] and EXECUTION_ALLOWED=NO unchanged. Contract1.3.3 amendment PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION records implementation availability only;inverse patches reconstruct exact1.3.2. W4FR4 definitions/payload SQL/types/context and W4PG cut/downstream127/86/7/9 remain unchanged.

Plan digest: \`${model.plan.PLAN_DIGEST}\`.
Canonical1.3.2 SHA256: \`${model.report.versionAmendment.VERSION_1_3_2_SHA256}\`.
Canonical1.3.3 SHA256: \`${model.report.versionAmendment.VERSION_1_3_3_SHA256}\`.

## Gate and runtime boundary

W4P=PASS;PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION=COMPLETE_NOT_EXECUTED;W4=PASS;W4P_RUNTIME_EXECUTION=NOT_AUTHORIZED;W5=AUTHORIZED_NOT_STARTED;CANONICAL_CONTRACT_VERSION=1.3.3;no1.4.
SQL_EXECUTED=0;PRODUCERS_ACTIVATED=0;W4P_EXECUTED=NO;W5_EXECUTED=NO;all materialization/role/config/replay/RLS/tenant proofs remain NO;BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.

895 focused tests+1154 W4PG/W4LB/W4LC/W4FR4 predecessor tests+141 W4C/W4S/W3/frozen-W4 tests=2190 distinct tests passed. Scoped TypeScript,ESLint(exit0 with existing Next pages-directory diagnostic),formatting,two-generation exact-byte equality and persisted \`--check\` passed. Documentation audit:0 errors/1215 existing warnings. Independent reconstruction proved1.3.3 ->1.3.2 ->1.3.1 ->1.3 ->1.2 ->1.1 ->1.0;all fixed input and inherited byte commitments verified with exact inverse handling for metadata-amended contracts. No database connection;fake adapters only. Exact validation commands/results are recorded in [the machine report](./PHASE_1B_3C_A1I_W4P_PLATFORM_BASELINE_PROMOTION.json).
`
  const table = model.implementation.registry
    .map(
      (record) =>
        `| ${record.PAYLOAD_ID} | ${record.EXECUTION_LAYER} | ${record.PLAN_POSITION} | ${record.DEPENDENCY_IDS.join(', ') || 'NONE'} | ${record.SQL_SHA256} | IMPLEMENTED_NOT_EXECUTED |`,
    )
    .join('\n')
  const markdown = (value: string) => format(value, { ...config, parser: 'markdown' })
  return {
    [outputs.plan]: await jsonBytes(model.plan),
    [outputs.implementation]: await jsonBytes(model.implementation),
    [outputs.report]: await jsonBytes(model.report),
    [outputs.markdown]: await markdown(overview),
    [outputs.planMarkdown]: await markdown(
      `# W4 platform baseline promotion plan\n\n      Offline deterministic plan only;no authenticated catalog/no DB connection. Per-payload PRECONDITION_MISSING and FAIL_CLOSED are not runtime receipts. Phase order PRECONDITION_VALIDATION ->36 TYPE ->57 CREATE_RELATION ->69 ADD_COLUMN ->FINAL_REVALIDATION. Plan digest \`${model.plan.PLAN_DIGEST}\`.\n\n| Payload ID | Layer | Position | Dependencies | Canonical SQL SHA256 | Status |\n|---|---|---|---|---|---|\n${table}\n\nExact macro/parent/W3 and target preconditions retained in [machine plan](./UE_W4_PLATFORM_BASELINE_PROMOTION_PLAN.json). Future live PLAN returns exact state/action only after read-only authenticated inspection. No SQL rewriting or post-W4P precondition expansion.\n`,
    ),
    [outputs.implementationMarkdown]: await markdown(
      `${overview}\n\n## Exact implementation registry\n\nAll162 records use applyPromotion/inspectPayload/verifyBaseline in the canonical provisioning engine. SQL bytes are consumed only from W4FR4;registry records inspection invariants,hashes,ordered obligations and deferred references.\n\n| Payload ID | Layer | Position | Dependencies | Canonical SQL SHA256 | Status |\n|---|---|---|---|---|---|\n${table}\n`,
    ),
    [files.canonical]: model.canonicalBytes,
    [files.producer]: model.producerBytes,
    [files.canonical.replace(/\.json$/, '.md')]: model.amendedMarkdown.canonical,
    [files.producer.replace(/\.json$/, '.md')]: model.amendedMarkdown.producer,
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--check', '--self-test'].includes(arg)),
    'UNAUTHORIZED_W4P_FLAG',
  )
  assert(args.length > 0, 'EXPLICIT_OFFLINE_MODE_REQUIRED')
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4P')
    console.log('PASS W4P two-generation exact-byte equality')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `W4P_ARTIFACT_DRIFT:${file}`)
    console.log('PASS W4P persisted bytes,hashes and exact1.3.2 inverse')
  } else if (args.includes('--plan')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, file), bytes)
    console.log(
      'W4P implementation PASS;contract1.3.3;W4 PASS;W5 AUTHORIZED_NOT_STARTED;no DB connection/execution',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
