import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import {
  implementationBlockers,
  inspectBlockedReplay,
  replayClass,
  replayDigest,
  replayHash,
  replayInputCommitments,
  replayInputFiles,
  replayObject,
  replayRecords,
  replayText,
  replayTransactionCompatibility,
  validateFrozenReplay,
} from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'
import { read, root } from './w4-physical-producers'
import { buildBoundaryClosure, payloadFile, payloadHash } from './w5bc-boundary-semantics'

const folder = 'docs/union-eyes/reality-remediation/'
export const outputs = {
  plan: folder + 'UE_W5_REPLAY_IMPLEMENTATION_PLAN.json',
  planMarkdown: folder + 'UE_W5_REPLAY_IMPLEMENTATION_PLAN.md',
  registry: folder + 'UE_W5_REPLAY_IMPLEMENTATION_REGISTRY.json',
  registryMarkdown: folder + 'UE_W5_REPLAY_IMPLEMENTATION_REGISTRY.md',
  report: folder + 'PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.json',
  reportMarkdown: folder + 'PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.md',
  effects: folder + 'UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
  effectsMarkdown: folder + 'UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.md',
  closure: folder + 'UE_W5_ORIGINAL_BOUNDARY_CLOSURE.json',
  closureMarkdown: folder + 'UE_W5_ORIGINAL_BOUNDARY_CLOSURE.md',
}
export const entrypoint = 'apps/union-eyes/scripts/provisioning/post-w4p-replay.ts'
export const boundaryWitnesses = [
  {
    SOURCE_FILE: 'apps/union-eyes/db/migrations-cache/0000_outstanding_viper.sql',
    SOURCE_LINES: [111, 127],
    REQUIRED_SOURCE_FRAGMENT:
      'ALTER TABLE "icra_anonymized_metrics" ADD CONSTRAINT "icra_anonymized_metrics_benchmark_group_id_icra_benchmark_groups_id_fk"',
    MISSING_COMPLETION_FACTS:
      'Relation existence or matching CREATE fields does not verify the later FOREIGN KEY and index effects. The whole boundary requires constraint actions/validation and index definitions/state,with original-position/later-evolution comparators;the accepted graph records none of those predicates.',
  },
  {
    SOURCE_FILE: 'apps/union-eyes/db/migrations-platform/0005_organization_members_deleted_at.sql',
    SOURCE_LINES: [45, 78],
    REQUIRED_SOURCE_FRAGMENT:
      'UPDATE organization_members SET exempt_from_per_capita = false WHERE exempt_from_per_capita IS NULL;',
    MISSING_COMPLETION_FACTS:
      'Complete state includes defaults and a data backfill,not column presence. The id-default wrapper accepts undefined_function/datatype_mismatch outcomes;completion must distinguish accepted exception branches from a missing post-create effect without changing that behavior. Frozen W5A has no exhaustive branch/data comparator specification.',
  },
  {
    SOURCE_FILE: 'apps/union-eyes/db/migrations-cache/0009_baseline_runtime_role_grants.sql',
    SOURCE_LINES: [21, 30],
    REQUIRED_SOURCE_FRAGMENT:
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM union_eyes_runtime, union_eyes_system;',
    MISSING_COMPLETION_FACTS:
      'Completion depends on schema/table/sequence grants,grantor-specific default privileges,and current_database CONNECT. It cannot be inferred from target relation presence or W4P schema verification. Scope/actor/grantor-bound exhaustive expected privilege predicates are missing.',
  },
]
export function loadFrozenReplay() {
  const inputBytes = Object.fromEntries(
    Object.values(replayInputFiles).map((file) => {
      const bytes = read(file)
      assert.equal(replayHash(bytes), replayInputCommitments[file], `W5B_FIXED_INPUT_DRIFT:${file}`)
      return [file, bytes]
    }),
  )
  const canonical = replayObject(JSON.parse(inputBytes[replayInputFiles.canonical]))
  const sourceBytes = Object.fromEntries(
    replayRecords(canonical.frozenMigrationManifest).map((entry) => {
      const file = replayText(entry.FILE)
      return [file, read(file)]
    }),
  )
  return { frozen: validateFrozenReplay(inputBytes, sourceBytes), inputBytes, sourceBytes }
}
function buildPreviousAssessment() {
  const { frozen, sourceBytes } = loadFrozenReplay()
  const concreteBoundaryEvidence = boundaryWitnesses.map((witness) => {
    const node = frozen.nodes.find(
      (entry) =>
        entry.SOURCE_FILE === witness.SOURCE_FILE &&
        replayClass(entry) === 'ORIGINAL_POSITION_MIGRATION_BOUNDARY',
    )
    assert(node, `W5B_BOUNDARY_WITNESS_NOT_IN_FROZEN_GRAPH:${witness.SOURCE_FILE}`)
    const source = sourceBytes[witness.SOURCE_FILE]
    const excerpt = source
      .split('\n')
      .slice(witness.SOURCE_LINES[0] - 1, witness.SOURCE_LINES[1])
      .join('\n')
    assert(
      excerpt.includes(witness.REQUIRED_SOURCE_FRAGMENT),
      `W5B_BOUNDARY_WITNESS_DRIFT:${witness.SOURCE_FILE}`,
    )
    return {
      ...witness,
      REPLAY_UNIT_ID: node.REPLAY_UNIT_ID,
      SOURCE_SHA256: node.SOURCE_SHA256,
      UNIT_CONTENT_DIGEST: node.EXACT_UNIT_SHA256,
      EXCERPT_SHA256: replayHash(excerpt),
      INSPECTOR_OR_COMPARATOR_IMPLEMENTED: 'NO',
      SQL_EXECUTED: 0,
    }
  })
  const blockers = implementationBlockers(frozen)
  assert.equal(
    blockers.filter(
      (blocker) => blocker.ERROR_CLASS === 'COMPLETE_BOUNDARY_POSTCONDITION_SPECIFICATION_MISSING',
    ).length,
    23,
  )
  assert.equal(
    blockers.filter(
      (blocker) => blocker.ERROR_CLASS === 'TRANSACTION_COMPATIBILITY_EVIDENCE_MISSING',
    ).length,
    23,
  )
  const graphDigests = replayObject(frozen.input.w5a.determinismDigests)
  const inspections = inspectBlockedReplay(frozen)
  const mechanics = replayRecords(frozen.register.BOUND_REPLAY_RECORDS)
  const handoffs = replayRecords(frozen.register.BOUND_ORDERING_HANDOFFS)
  const registry = frozen.order.map((node) => {
    const unitId = replayText(node.REPLAY_UNIT_ID)
    return {
      REPLAY_UNIT_ID: unitId,
      UNIT_CLASS: replayClass(node),
      IMPLEMENTATION_HANDLER: 'NOT_IMPLEMENTED',
      INSPECTION_HANDLER:
        'NOT_IMPLEMENTED;inspectBlockedReplay validates only missing implementation/W4P preconditions,not catalog state',
      VERIFICATION_HANDLER: 'NOT_IMPLEMENTED',
      DATABASE_SCOPE: node.DATABASE_SCOPE,
      PLAN_POSITION: node.REQUIRED_REPLAY_POSITION,
      PREDECESSOR_UNIT_IDS: [
        ...new Set(
          frozen.edges.filter((edge) => edge.TO === unitId).map((edge) => replayText(edge.FROM)),
        ),
      ],
      SOURCE_FILE: node.SOURCE_FILE,
      SOURCE_SHA256: node.SOURCE_SHA256,
      FROZEN_MIGRATION_ID: node.FROZEN_MIGRATION_ID,
      FROZEN_POSITION: node.HISTORICAL_POSITION,
      UNIT_CONTENT_DIGEST: node.EXACT_UNIT_SHA256,
      COMPATIBILITY_RECORD_IDS: node.COMPATIBILITY_OBLIGATION_IDS,
      ORDERING_HANDOFF_IDS: handoffs
        .filter(
          (handoff) =>
            handoff.FROM_REPLAY_UNIT_ID === unitId || handoff.TO_REPLAY_UNIT_ID === unitId,
        )
        .map((handoff) => handoff.ORDERING_RECORD_ID),
      TRANSACTION_COMPATIBILITY: replayTransactionCompatibility(node),
      TRANSACTION_EVIDENCE:
        replayClass(node) === 'ORIGINAL_POSITION_MIGRATION_BOUNDARY'
          ? 'No accepted whole-boundary transaction semantics;source hash alone is insufficient.'
          : 'Accepted W5A unit classification proves one standalone CREATE TABLE or one DO wrapper containing only CREATE TYPE and duplicate-object handling;these exact DDL units are transaction-compatible,no source-semantic re-extraction.',
      EXECUTION_STATUS: 'NOT_IMPLEMENTED_BLOCKED',
      EXECUTION_ALLOWED: 'NO',
      MUTATING_OPERATIONS: [],
      BLOCKER_CLASSES: [
        ...new Set(
          blockers
            .filter((blocker) => blocker.REPLAY_UNIT_ID === unitId)
            .map((blocker) => blocker.ERROR_CLASS),
        ),
      ],
      WRAPPER_ATOMICITY: 'PRESERVED_IN_FROZEN_SOURCE;no source extraction or mutation',
    }
  })
  const scopes = ['UE_OPERATIONAL', 'FINANCIAL_SERVICE'].map((scope) => ({
    DATABASE_SCOPE: scope,
    UNIT_ORDER: registry
      .filter((entry) => entry.DATABASE_SCOPE === scope)
      .map((entry) => entry.REPLAY_UNIT_ID),
    UNIT_TOTAL: registry.filter((entry) => entry.DATABASE_SCOPE === scope).length,
    TRANSACTION_MODEL: 'BLOCKED;no evidence-backed transaction boundary assignments',
    EXECUTION_ALLOWED: 'NO',
  }))
  const planBody = {
    GRAPH_DIGEST: graphDigests.REPLAY_GRAPH_SHA256,
    TOPOLOGICAL_PLAN_DIGEST: graphDigests.TOPOLOGICAL_PLAN_SHA256,
    DATABASE_SCOPE: 'SCOPE_SEPARATED_STATIC_METADATA_ONLY',
    W4P_VERIFICATION_REFERENCE: null,
    W4P_BASELINE_VERIFIED: 'REQUIRED_NOT_PROVIDED',
    UNIT_TOTAL: 107,
    UNIT_ORDER: frozen.order.map((node) => node.REPLAY_UNIT_ID),
    PER_UNIT_INSPECTION_STATE: inspections,
    PER_UNIT_PLANNED_ACTION: inspections.map((inspection) => ({
      REPLAY_UNIT_ID: inspection.REPLAY_UNIT_ID,
      ACTION: inspection.PLANNED_ACTION,
    })),
    EDGE_SATISFACTION: frozen.edges.map((edge) => ({
      EDGE_ID: edge.EDGE_ID,
      FROM: edge.FROM,
      TO: edge.TO,
      STATE: 'NOT_VERIFIED_NO_REPLAY_ELIGIBILITY',
    })),
    DEFERRED_DOWNSTREAM_REGISTER_DIGEST: graphDigests.DOWNSTREAM_RESIDUAL_REGISTER_SHA256,
    SCOPE_EXECUTIONS: scopes,
    PLAN_STATE: 'FAIL_CLOSED',
    EXECUTION_ALLOWED: 'NO',
    MUTATING_OPERATIONS: [],
    BLOCKERS: blockers,
  }
  const plan = { REPLAY_PLAN_DIGEST: replayDigest(planBody), ...planBody }
  const summary = {
    REPLAY_UNITS_REGISTERED: 107,
    EXACT_CREATE_STATEMENT_UNITS_REGISTERED: 43,
    ENUM_WRAPPER_UNITS_REGISTERED: 41,
    ORIGINAL_POSITION_BOUNDARIES_REGISTERED: 23,
    IMPLEMENTED_REPLAY_UNITS: 0,
    EXACT_CREATE_STATEMENT_HANDLERS: 0,
    ENUM_WRAPPER_HANDLERS: 0,
    ORIGINAL_POSITION_BOUNDARY_HANDLERS: 0,
    COMPATIBILITY_RECORDS_PRESERVED: 127,
    COMPATIBILITY_RECORD_IMPLEMENTATION_COVERAGE: 0,
    ORDERING_HANDOFFS_PRESERVED_AND_BOUND: 86,
    ORDERING_HANDOFF_IMPLEMENTATION_COVERAGE: 0,
    PROVENANCE_EDGE_RECORDS_PRESERVED: 231,
    MISSING_PLAN_NODES: 0,
    DUPLICATE_PLAN_NODES: 0,
    FROZEN_MIGRATION_HASH_DRIFT: 0,
    FROZEN_MIGRATIONS_REWRITTEN: 0,
    W5A_GRAPH_RECOMPUTED_SEMANTICALLY: 'NO',
    W5A_EDGE_DIRECTION_CHANGED: 'NO',
    W5A_REPLAY_UNIT_GROUPING_CHANGED: 'NO',
    COMPLETE_BOUNDARY_INSPECTION_SPECIFICATIONS_MISSING: 23,
    TRANSACTION_COMPATIBLE_CREATE_UNITS: 84,
    UNPROVEN_TRANSACTION_ASSIGNMENTS: 23,
    REPLAY_NOOP_PROVEN: 'NO',
    DEFERRED_CONSTRAINT_HANDOFFS: 7,
    UNRESOLVED_OPERAND_BINDINGS: 9,
    DEFERRED_CONSTRAINTS_EXECUTED_BY_W5B: 0,
    PRODUCERS_ACTIVATED: 0,
  }
  const registryPacket = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W5B',
      IMPLEMENTATION_ENTRYPOINT: entrypoint,
      IMPLEMENTATION_STATUS: 'PREFLIGHT_ONLY_REPLAY_BLOCKED',
      EXECUTION_ALLOWED: 'NO',
    },
    summary,
    REGISTRY: registry,
    PRESERVED_COMPATIBILITY_MECHANICS: mechanics,
    PRESERVED_ORDERING_HANDOFFS: handoffs,
    PRESERVED_EDGE_RECORDS: frozen.edges,
    DEFERRED_CONSTRAINT_HANDOFFS: frozen.register.DEFERRED_CONSTRAINT_HANDOFFS,
    UNRESOLVED_OPERAND_BINDINGS: frozen.register.UNRESOLVED_OPERAND_BINDINGS,
  }
  const w4pEngine = replayText(replayObject(frozen.input.w4p.metadata).ENTRYPOINT)
  const w4pEngineHash = replayText(replayObject(frozen.input.w4p.metadata).ENTRYPOINT_SHA256)
  assert.equal(replayHash(read(w4pEngine)), w4pEngineHash)
  const report = {
    metadata: registryPacket.metadata,
    summary,
    phaseStatus: {
      PHASE_1B_3C_A1I_W5B_GATE: 'BLOCKED',
      PHASE_1B_3C_A1I_W5B: 'BLOCKED',
      POST_W4P_REPLAY_IMPLEMENTATION: 'INCOMPLETE_BLOCKED',
      W5: 'IN_PROGRESS',
      W5_RUNTIME_EXECUTION: 'NOT_AUTHORIZED',
      W6: 'NOT_AUTHORIZED',
      CANONICAL_CONTRACT_VERSION: '1.3.3',
      CONTRACT_1_3_4: 'NOT_PUBLISHED_W5B_PASS_REQUIRED',
    },
    architecture: {
      IMPLEMENTED: [
        'Ten fixed input byte commitments and four frozen graph/plan/registry digests',
        '107-node/231-edge topology and107-node exact plan validation',
        '23 whole-source hashes and84 already-bound range hashes',
        '127 original mechanics and86 exact handoff/edge links retained',
        'Per-scope static unit ordering and unverified-edge status',
        'Fail-closed implementation/W4P preflight;execution denial before any adapter access',
      ],
      NOT_IMPLEMENTED: [
        'Complete per-unit catalog inspection and postcondition comparators',
        'Replay eligibility and per-node postcondition re-read',
        'Future apply/rollback orchestration',
        'Authenticated target/actor/W4P verification and exclusive-adapter integration',
        '107-unit replay-noop proof',
        'Future production unit/run receipts',
      ],
      REUSE_PATTERN:
        'ProvisioningError from governed-provisioning;W4P exclusive-transaction/authorization pattern inspected but not weakened or replaced with an unverified inspector callback.',
      REQUIRED_FUTURE_AUTHORIZATION_BINDINGS: [
        'PLAN_DIGEST',
        'GRAPH_DIGEST',
        'TARGET_DATABASE_SCOPE',
        'ACTOR_CLASS',
        'FROZEN_MANIFEST_DIGEST',
        'W4P_VERIFICATION_DIGEST',
      ],
      DEFAULT_WITHOUT_EXCLUSIVE_ADAPTER: 'DENY',
      EXCLUSIVE_EXECUTION_RESIDUAL:
        'Future authenticated exclusive rollback-on-rejection adapter remains required;no advisory-lock protocol invented.',
      INSPECTION_STATE_MODEL: [
        'REPLAY_REQUIRED',
        'ALREADY_COMPLETE',
        'DRIFTED',
        'PARTIAL_OR_AMBIGUOUS',
        'PRECONDITION_MISSING',
      ],
      CURRENT_PRECONDITION_INSPECTION:
        'PRECONDITION_MISSING for all107 units;no catalog completion inferred and no claims of full state-model implementation.',
      TRANSACTION_MODEL:
        'Not established;scope separation retained,no cross-database transaction,rollback tests cannot truthfully prove a missing implementation.',
    },
    blockers,
    blockerEvidence: {
      BOUNDARY_POSTCONDITION_LOCATION: `${replayInputFiles.graph}:nodes[PHASE=ORIGINAL_FROZEN_REPLAY].POSTCONDITIONS`,
      POSTCONDITION_PROBLEM:
        'The accepted value is a preservation obligation,not an exhaustive catalog/data/security invariant specification for the whole boundary. Source identity/digest proves byte preservation,not runtime completion.',
      ACCEPTED_PRODUCER_DESCRIPTOR_SCOPE:
        'Existing postconditionDescriptors concern Django-produced prerequisite identities;they are not full postcreate inspectors for the23 frozen replay boundaries.',
      ALLOWED_SOURCE_READ_CEILING:
        'Frozen source bytes verified against existing commitments. Three exact original-boundary excerpts corroborate actual missing completion predicates;no new CREATE units,SQL payloads,topology or evidence-free transaction assignments are extracted.',
      CONCRETE_ORIGINAL_BOUNDARY_EVIDENCE: concreteBoundaryEvidence,
      TRANSACTION_EVIDENCE_LOCATION: `${replayInputFiles.graph}:nodes;accepted standalone CREATE/enum-only wrapper classification supports84 transaction-compatible units;23 whole migration boundaries lack transaction evidence`,
      NOT_BLOCKERS: [
        'Seven deliberately deferred constraints',
        'Nine unresolved downstream operand producers',
        'Missing concrete exclusive adapter by itself;a future interface could represent it once the actual unit verification/transaction deficiencies are resolved',
      ],
    },
    resumption: {
      DATE: '2026-10-12',
      REPOSITORY_HEAD: '1c337567635bb86ea0df7831557d8d2d22df1e6f',
      WORKTREE: 'SHARED_DIRTY;unrelated changes preserved',
      DISCOVERED_PRIOR_W5B_STATE: 'BLOCKED_PREFLIGHT_ONLY;not AUTHORIZED_NOT_STARTED',
      PRIOR_W5B_REPORT_SHA256: 'e858fb782859c073056ee65f1d533f7fbbfb03f26c92fdaa9e1ec34dcdc2028b',
      PRIOR_W5B_PLAN_FILE_SHA256:
        '4bc83d8e477675edfd58168bed62d5c954aaa0fb0026f08b25ef9fd053a80e74',
      PRIOR_W5B_REGISTRY_FILE_SHA256:
        'fc9d568da61ece98357f4f246ae442abcdea5595866a812e7b527b65032e3b00',
      FROZEN_W5A_W4P_SOURCE_DRIFT: 0,
      PRIOR_W5B_CHECK: 'PASS_PERSISTED_BYTES_AND_TWO_GENERATIONS',
      G3_TERMINAL_CHECK: 'PASS_LOCAL_ONLY;CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE',
      G3_REOPENED: 'NO',
      G3_CAUSALITY_LIMIT:
        'Current fixed UE commitments match their pre-G3 authority;no changed W5A/W4P/source bytes were observed. Shared-worktree file attribution is not inferred from git status.',
      IMPLEMENTATION_DECISION:
        'Retain fail-closed BLOCKED;exact original-boundary completion and transaction specifications are actual implementation deficiencies. Do not replace them with adapter-supplied booleans or manufacture a107-noop proof.',
    },
    determinismDigests: {
      W5B_PLAN_DIGEST: plan.REPLAY_PLAN_DIGEST,
      W5B_REGISTRY_DIGEST: replayDigest(registryPacket),
      W5A_COMMITMENTS_UNCHANGED: graphDigests,
    },
    preservation: {
      BYTE_COMMITMENTS: { ...frozen.byteCommitments, [w4pEngine]: w4pEngineHash },
      UPSTREAM_BYTES_CHANGED: 0,
      W4P_PLAN_DIGEST: frozen.input.promotionPlan.PLAN_DIGEST,
      W4_DEFINITIONS: replayObject(frozen.input.w4p.summary).DEFINITIONS,
      W4_PAYLOADS: replayObject(frozen.input.w4p.summary).PAYLOADS,
      NAMED_TYPES: replayObject(frozen.input.w4p.summary).TYPE_PAYLOADS,
      CONTEXTUAL_TYPE_REFERENCES: replayObject(
        replayObject(frozen.input.canonical.platformBaselineCanonicalDefinitionAuthoring).summary,
      ).TOTAL_CANONICAL_TYPE_REFERENCES,
      CANONICAL_CONTRACT_VERSION: '1.3.3',
      PRODUCER_IMPLEMENTATION_METADATA_CHANGED: 'NO;no complete implementation to advertise',
    },
    versionAmendment: {
      VERSION_1_3_3_SHA256: replayInputCommitments[replayInputFiles.canonical],
      VERSION_1_3_4_SHA256: null,
      PRIOR_JSON_INVERSE_PATCHES: null,
      AMENDMENT_PUBLISHED: 'NO',
      RECONSTRUCTION_1_3_4_TO_1_0: 'NOT_APPLICABLE_1_3_4_NOT_PUBLISHED',
    },
    validation: {
      FROZEN_INPUT_AND_SOURCE_INTEGRITY: 'PASS',
      GRAPH_AND_RANGE_BINDING: 'PASS',
      EXACT107_REGISTRATION: 'PASS_NOT_IMPLEMENTATION_COVERAGE',
      EXACT127_86_231_PRESERVATION: 'PASS',
      REPLAY_HANDLER_IMPLEMENTATION_TESTS: 'NOT_RUN_NO_IMPLEMENTED_REPLAY_HANDLERS',
      REPLAY_NOOP_AND_ROLLBACK_PROOF: 'NOT_ESTABLISHED',
      HISTORICAL_PRE_RESUMPTION_VALIDATION: [
        {
          COMMAND: String.raw`pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\provisioning\post-w4p-replay.test.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts`,
          RESULT: 'PASS_FINAL_NARROWED_ASSESSMENT',
          TESTS_PASSED: 387,
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\provisioning\post-w4p-replay.test.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts scripts\ue\close-w5a-replay-graph.test.ts apps\union-eyes\scripts\provisioning\platform-baseline-promotion.test.ts scripts\ue\implement-w4p-platform-promotion.test.ts`,
          RESULT: 'PASS',
          TESTS_PASSED: 1897,
          EARLIER_W5B_PREFLIGHT_TESTS: 471,
          NOTE: 'Earlier assessment included107 transaction-evidence gaps;subsequent final387-case run narrows those gaps to23 boundaries. Only the unchanged531 W5A+895 W4P tests from this combined run count toward current distinct coverage.',
          W5A_TESTS: 531,
          W4P_TESTS: 895,
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config scripts\ue\w4p-predecessor.vitest.config.ts scripts\ue\normalize-w4pg-promotion-gate.test.ts scripts\ue\bind-w4lb-supplemental-operands.test.ts scripts\ue\classify-w4lc-compatibility.test.ts scripts\ue\author-w4fr4-final-baseline.test.ts`,
          RESULT: 'PASS',
          TESTS_PASSED: 1154,
        },
        {
          COMMAND: String.raw`pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node apps\union-eyes\scripts\provisioning\post-w4p-replay.ts apps\union-eyes\scripts\provisioning\post-w4p-replay.test.ts scripts\ue\implement-w5b-post-w4p-replay.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts`,
          RESULT: 'PASS',
        },
        {
          COMMAND: String.raw`pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 apps\union-eyes\scripts\provisioning\post-w4p-replay.ts apps\union-eyes\scripts\provisioning\post-w4p-replay.test.ts scripts\ue\implement-w5b-post-w4p-replay.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts`,
          RESULT: 'PASS_EXIT_0',
          NOTE: 'Existing Next pages-directory diagnostic printed.',
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\implement-w5b-post-w4p-replay.ts --plan --self-test`,
          RESULT: 'PASS_TWO_GENERATIONS_IDENTICAL',
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\implement-w5b-post-w4p-replay.ts --check --self-test`,
          RESULT: 'PASS_PERSISTED_ARTIFACT_BYTES_AND_UPSTREAM_COMMITMENTS',
        },
        {
          COMMAND: `pnpm exec prettier --check apps\\union-eyes\\scripts\\provisioning\\post-w4p-replay.ts apps\\union-eyes\\scripts\\provisioning\\post-w4p-replay.test.ts scripts\\ue\\implement-w5b-post-w4p-replay.ts scripts\\ue\\implement-w5b-post-w4p-replay.test.ts ${Object.values(
            outputs,
          )
            .map((file) => file.replaceAll('/', '\\'))
            .join(' ')}`,
          RESULT: 'PASS',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS',
          FILES_SCANNED: 2638,
          ERRORS: 0,
          EXISTING_WARNINGS: 1215,
        },
      ],
      HISTORICAL_DISTINCT_TESTS_PASSED: 2967,
      RESUMPTION_LOCAL_VALIDATION: [
        {
          COMMAND: String.raw`pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\provisioning\post-w4p-replay.test.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts scripts\ue\close-w5a-replay-graph.test.ts apps\union-eyes\scripts\provisioning\platform-baseline-promotion.test.ts scripts\ue\implement-w4p-platform-promotion.test.ts`,
          RESULT: 'PASS',
          FILES_PASSED: 5,
          TESTS_PASSED: 1817,
          W5B_TESTS: 391,
          W5A_TESTS: 531,
          W4P_TESTS: 895,
          NEW_RESUMPTION_EVIDENCE_TESTS: 4,
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config scripts\ue\w4p-predecessor.vitest.config.ts scripts\ue\normalize-w4pg-promotion-gate.test.ts scripts\ue\bind-w4lb-supplemental-operands.test.ts scripts\ue\classify-w4lc-compatibility.test.ts scripts\ue\author-w4fr4-final-baseline.test.ts`,
          RESULT: 'PASS',
          FILES_PASSED: 4,
          TESTS_PASSED: 1154,
        },
        {
          COMMAND: String.raw`pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node apps\union-eyes\scripts\provisioning\post-w4p-replay.ts apps\union-eyes\scripts\provisioning\post-w4p-replay.test.ts scripts\ue\implement-w5b-post-w4p-replay.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts`,
          RESULT: 'PASS',
        },
        {
          COMMAND: String.raw`pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 apps\union-eyes\scripts\provisioning\post-w4p-replay.ts apps\union-eyes\scripts\provisioning\post-w4p-replay.test.ts scripts\ue\implement-w5b-post-w4p-replay.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts`,
          RESULT: 'PASS_EXIT_0',
          NOTE: 'Existing Next pages-directory diagnostic;no lint failures.',
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\implement-w5b-post-w4p-replay.ts --plan --self-test`,
          RESULT: 'PASS_TWO_GENERATIONS_IDENTICAL',
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\implement-w5b-post-w4p-replay.ts --check --self-test`,
          RESULT: 'PASS_PERSISTED_ARTIFACT_BYTES_AND_UPSTREAM_COMMITMENTS',
        },
        {
          COMMAND: `pnpm exec prettier --check apps\\union-eyes\\scripts\\provisioning\\post-w4p-replay.ts apps\\union-eyes\\scripts\\provisioning\\post-w4p-replay.test.ts scripts\\ue\\implement-w5b-post-w4p-replay.ts scripts\\ue\\implement-w5b-post-w4p-replay.test.ts ${Object.values(
            outputs,
          )
            .map((file) => file.replaceAll('/', '\\'))
            .join(' ')}`,
          RESULT: 'PASS',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS',
          FILES_SCANNED: 2638,
          ERRORS: 0,
          EXISTING_WARNINGS: 1215,
        },
      ],
      DISTINCT_RESUMPTION_TESTS_PASSED: 2971,
      INDEPENDENT_RAW_BYTE_AND_PERSISTED_JSON_VERIFICATION:
        'PASS;34 commitments,exact107-unit order/127 mechanics/86 handoffs/231 edges/7 deferred/9 operands,46 explicit missing-fact entries,84 transaction-compatible CREATE units,zero implemented replay handlers,no1.3.4',
      EVIDENCE_CEILING:
        'Static preflight/denial and frozen-predecessor preservation only;not full replay inspection,rollback or107-unit replay-noop proof.',
    },
    proofBoundaries: {
      DATABASE_CONNECTIONS: 0,
      SQL_EXECUTED: 0,
      W4P_EXECUTED: 'NO',
      FROZEN_MIGRATIONS_EXECUTED: 0,
      COMPATIBILITY_MECHANICS_EXECUTED: 0,
      W5_REPLAY_EXECUTED: 'NO',
      DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
      PRODUCERS_ACTIVATED: 0,
      BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
      FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
      RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
      TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    },
  }
  return { plan, registryPacket, report }
}
export function buildImplementation() {
  const previous = buildPreviousAssessment()
  const { frozen, sourceBytes } = loadFrozenReplay()
  const boundaryModel = buildBoundaryClosure(frozen, sourceBytes, read(payloadFile))
  const blockers = boundaryModel.closure.IRREDUCIBLE_BLOCKERS.map((entry) => ({
    REPLAY_UNIT_ID: entry.BOUNDARY_ID,
    SOURCE_FILE: entry.SOURCE_PATH,
    UNIT_CLASS: 'ORIGINAL_POSITION_MIGRATION_BOUNDARY',
    ERROR_CLASS: 'FROZEN_POLICY_PARENT_KEY_NOT_PRODUCED',
    EXACT_EFFECT_ID: entry.EFFECT_ID,
    MISSING_FACTS: [
      `${entry.PHYSICAL_IDENTITY}.${entry.MISSING_COLUMNS.join(',')}:absent in fresh mandatory W4P parent definition`,
      entry.WHY_NO_SAFE_REPLAY_ELIGIBILITY_EXISTS,
      entry.NEW_AUTHORITY_OR_RUNTIME_PROOF_REQUIRED,
    ],
    RECORDED_EVIDENCE: entry,
  }))
  const summary = {
    ...previous.report.summary,
    UNPROVEN_TRANSACTION_ASSIGNMENTS: 0,
    ORIGINAL_BOUNDARY_TRANSACTION_ASSIGNMENTS_PROVEN: 23,
    ORIGINAL_BOUNDARIES_ACCOUNTED: 23,
    EXECUTABLE_EFFECTS_ACCOUNTED: boundaryModel.ledger.EFFECT_COUNT,
    UNACCOUNTED_EXECUTABLE_EFFECTS: 0,
    IRREDUCIBLE_BOUNDARY_COUNT: boundaryModel.closure.IRREDUCIBLE_BOUNDARY_COUNT,
    IRREDUCIBLE_EFFECT_COUNT: boundaryModel.closure.IRREDUCIBLE_EFFECT_COUNT,
    IMPLEMENTED_COMPLETION_COMPARATORS: 0,
    COMPARATOR_CEILING: '762 source-bound evidence plans,not762 implemented comparators',
  }
  const registryPacket = {
    ...previous.registryPacket,
    metadata: { ...previous.registryPacket.metadata, PHASE: 'PHASE_1B_3C_A1I_W5B_C' },
    summary,
    REGISTRY: previous.registryPacket.REGISTRY.map((entry) => ({
      ...entry,
      TRANSACTION_COMPATIBILITY: 'TRANSACTION_COMPATIBLE',
      TRANSACTION_EVIDENCE:
        'Whole frozen source inventoried:transactional PostgreSQL DDL/ACL/DML,indivisible PL/pgSQL blocks,source-bound helper calls;no internal transaction control or sequence-state mutation. Runtime event triggers/extension behavior is not proven.',
      COMPLETION_COMPARATORS:
        boundaryModel.ledger.BOUNDARIES.find(
          (boundary) => boundary.BOUNDARY_ID === entry.REPLAY_UNIT_ID,
        )?.EFFECTS.map((effect) => ({
          EFFECT_ID: effect.EFFECT_ID,
          COMPARATOR: effect.COMPARATOR,
        })) ?? [],
      RECEIPT_REQUIREMENT:
        'For non-monotonic or successor-superseded state,a source/graph/plan/scope/W4P/predecessor/result/postverification-bound verified receipt is required;no historical inference.',
      BLOCKER_CLASSES: blockers.some((blocker) => blocker.REPLAY_UNIT_ID === entry.REPLAY_UNIT_ID)
        ? ['FROZEN_POLICY_PARENT_KEY_NOT_PRODUCED']
        : [],
    })),
  }
  const { REPLAY_PLAN_DIGEST: _priorDigest, ...priorPlan } = previous.plan
  assert.equal(_priorDigest, replayDigest(priorPlan), 'PRIOR_W5B_PLAN_DIGEST_INVALID')
  const planBody = {
    ...priorPlan,
    SCOPE_EXECUTIONS: previous.plan.SCOPE_EXECUTIONS.map((scope) => ({
      ...scope,
      TRANSACTION_MODEL:
        'Source-native transaction-compatible units;future apply denied,rollback unimplemented',
    })),
    BLOCKERS: blockers,
    ORIGINAL_BOUNDARY_LEDGER_DIGEST: replayDigest(boundaryModel.ledger),
    ORIGINAL_BOUNDARY_CLOSURE_DIGEST: replayDigest(boundaryModel.closure),
    FINAL_STATIC_CEILING: boundaryModel.closure.FINAL_STATIC_W5B_CEILING,
  }
  const plan = { REPLAY_PLAN_DIGEST: replayDigest(planBody), ...planBody }
  const report = {
    ...previous.report,
    metadata: registryPacket.metadata,
    summary,
    blockers,
    priorStaticAssessment: {
      ACCEPTED_W5B_REPORT_FILE_SHA256:
        '127b392ab6b32d8654284cdc848efeae388b7ba76bce6421c0a0d2f638b54803',
      ACCEPTED_W5B_PLAN_FILE_SHA256:
        '4bc83d8e477675edfd58168bed62d5c954aaa0fb0026f08b25ef9fd053a80e74',
      ACCEPTED_W5B_REGISTRY_FILE_SHA256:
        'fc9d568da61ece98357f4f246ae442abcdea5595866a812e7b527b65032e3b00',
      HISTORICAL_SUMMARY: previous.report.summary,
      HISTORICAL_BLOCKERS: previous.report.blockers,
      HISTORICAL_BLOCKER_EVIDENCE: previous.report.blockerEvidence,
      HISTORICAL_VALIDATION: previous.report.validation,
      DISPOSITION:
        'BLOCKED_FROZEN;missing-annotation assessment superseded by exact W5BC source-level counterexample,not a runtime finding',
    },
    blockerEvidence: {
      ...previous.report.blockerEvidence,
      HISTORICAL_ONLY: 'Three-excerpt assessment is prior evidence,not the final blocker basis',
      FINAL_BLOCKER_BASIS:
        'One indivisible original RLS boundary;12 exact helper calls require10 parent.id columns not produced by the closed executable source universe. None of these keys is one of the9 downstream operands.',
      GUARDED_CREATE_COLLISION_HYPOTHESIS:
        'REJECTED_NO_EXECUTABLE_W4P_CREATE_OVERLAP;not a finding',
    },
    finalStaticClosure: boundaryModel.closure,
    architecture: {
      ...previous.report.architecture,
      TRANSACTION_MODEL:
        '23/23 whole-boundary source-native transaction assignments established;future apply/rollback remains unimplemented. External runtime event triggers/extension effects require future qualification.',
      TERMINAL_BLOCKER: 'FROZEN_POLICY_PARENT_KEY_NOT_PRODUCED',
      NEXT_GENERIC_DISCOVERY_PHASE: 'PROHIBITED',
    },
    preservation: {
      ...previous.report.preservation,
      BYTE_COMMITMENTS: {
        ...previous.report.preservation.BYTE_COMMITMENTS,
        [payloadFile]: payloadHash,
      },
    },
    determinismDigests: {
      ...previous.report.determinismDigests,
      W5B_PLAN_DIGEST: plan.REPLAY_PLAN_DIGEST,
      W5B_REGISTRY_DIGEST: replayDigest(registryPacket),
      W5BC_LEDGER_DIGEST: replayDigest(boundaryModel.ledger),
      W5BC_CLOSURE_DIGEST: replayDigest(boundaryModel.closure),
    },
    validation: {
      CURRENT_VALIDATION: 'PASS_CURRENT_W5BC_WITH_RECORDED_PREDECESSOR_TIMEOUT',
      DISTINCT_TESTS_PASSED: 3794,
      DISTINCT_TESTS_REQUESTED: 3795,
      CURRENT_W5BC_W5B_TESTS_PASSED: 999,
      PREDECESSOR_TEST_TIMEOUTS_REMAINING: 1,
      COMMAND_RESULTS: [
        {
          COMMAND: String.raw`pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\provisioning\original-boundary-inspection.test.ts scripts\ue\w5bc-boundary-semantics.test.ts apps\union-eyes\scripts\provisioning\post-w4p-replay.test.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts scripts\ue\close-w5a-replay-graph.test.ts apps\union-eyes\scripts\provisioning\platform-baseline-promotion.test.ts scripts\ue\implement-w4p-platform-promotion.test.ts`,
          RESULT: '2639_PASSED_2_GENERATION_TEST_TIMEOUTS;no assertion failures',
          TESTS: 2641,
          NOTE: 'W5B generation timeout recovered in the final999-test serial run. Unchanged W4P generation test exceeded its120s limit in combined and serial runs;equivalent authoritative two-generation/persisted-byte checker passed without a runner time budget.',
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts scripts\ue\implement-w4p-platform-promotion.test.ts --maxWorkers 1 --no-file-parallelism --testNamePattern 'persists only ten|generates exact deterministic artifact'`,
          RESULT: 'W5B_PASS;UNCHANGED_W4P_GENERATION_TIMEOUT_120S',
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\provisioning\original-boundary-inspection.test.ts scripts\ue\w5bc-boundary-semantics.test.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts --maxWorkers 1 --no-file-parallelism`,
          RESULT: 'PASS',
          FILES: 3,
          TESTS_PASSED: 999,
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config scripts\ue\w4p-predecessor.vitest.config.ts scripts\ue\normalize-w4pg-promotion-gate.test.ts scripts\ue\bind-w4lb-supplemental-operands.test.ts scripts\ue\classify-w4lc-compatibility.test.ts scripts\ue\author-w4fr4-final-baseline.test.ts`,
          RESULT: '1153_PASSED_1_W4FR4_GENERATION_TIMEOUT;recovered by exact serial selector below',
        },
        {
          COMMAND: String.raw`pnpm exec vitest run --config scripts\ue\w4p-predecessor.vitest.config.ts scripts\ue\author-w4fr4-final-baseline.test.ts --maxWorkers 1 --no-file-parallelism --testNamePattern 'is exactly deterministic at model and generated artifact levels'`,
          RESULT: 'PASS',
          TESTS_PASSED: 1,
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\implement-w4p-platform-promotion.ts --self-test --check`,
          RESULT: 'PASS_TWO_GENERATION_EXACT_BYTES_PERSISTED_HASHES_AND_1_3_2_INVERSE',
          NOTE: 'Read-only existing checker;no writer or timeout increase. This does not relabel the separate timed-out Vitest case as passed.',
        },
        {
          COMMAND: String.raw`pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node apps\union-eyes\scripts\provisioning\original-boundary-inspection.ts apps\union-eyes\scripts\provisioning\original-boundary-inspection.test.ts scripts\ue\w5bc-boundary-semantics.ts scripts\ue\w5bc-boundary-semantics.test.ts scripts\ue\implement-w5b-post-w4p-replay.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts`,
          RESULT: 'PASS_AFTER_FIXING_EXCESS_PROPERTY_TEST_TYPING',
        },
        {
          COMMAND: String.raw`pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 apps\union-eyes\scripts\provisioning\original-boundary-inspection.ts apps\union-eyes\scripts\provisioning\original-boundary-inspection.test.ts scripts\ue\w5bc-boundary-semantics.ts scripts\ue\w5bc-boundary-semantics.test.ts scripts\ue\implement-w5b-post-w4p-replay.ts scripts\ue\implement-w5b-post-w4p-replay.test.ts`,
          RESULT: 'PASS_EXIT_0;existing Next pages-directory diagnostic',
        },
        {
          COMMAND: `pnpm exec prettier --check apps\\union-eyes\\scripts\\provisioning\\original-boundary-inspection.ts apps\\union-eyes\\scripts\\provisioning\\original-boundary-inspection.test.ts scripts\\ue\\w5bc-boundary-semantics.ts scripts\\ue\\w5bc-boundary-semantics.test.ts scripts\\ue\\implement-w5b-post-w4p-replay.ts scripts\\ue\\implement-w5b-post-w4p-replay.test.ts ${Object.values(
            outputs,
          )
            .map((file) => file.replaceAll('/', '\\'))
            .join(' ')}`,
          RESULT: 'PASS',
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\implement-w5b-post-w4p-replay.ts --plan --self-test`,
          RESULT: 'PASS_TEN_OUTPUTS_TWO_GENERATION_BYTES_IDENTICAL',
        },
        {
          COMMAND: String.raw`pnpm exec tsx scripts\ue\implement-w5b-post-w4p-replay.ts --check --self-test`,
          RESULT: 'PASS_PERSISTED_BYTES_AND_35_UPSTREAM_COMMITMENTS',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS',
          FILES_SCANNED: 2640,
          ERRORS: 0,
          EXISTING_WARNINGS: 1215,
        },
        {
          COMMAND: String.raw`node infrastructure\landing-zone\g3-terminal-closure.mjs --check`,
          RESULT: 'PASS_CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE;AZURE_CALLS_0',
        },
      ],
      HISTORICAL_VALIDATION: previous.report.validation,
      REPLAY_NOOP: 'NOT_ESTABLISHED_0_OF_107_HANDLERS',
      FAKE_ROLLBACK: 'NOT_IMPLEMENTED_NOT_PROVEN',
      EVIDENCE_CEILING:
        'Source accounting,exact irreducible counterexample and offline fail-closed behavior;not runtime PostgreSQL proof',
    },
  }
  return { plan, registryPacket, report, boundaryModel }
}
async function generateCorePackets() {
  const model = buildImplementation()
  const config = await resolveConfig(path.join(root, 'package.json'))
  const json = (value: unknown) => format(JSON.stringify(value), { ...config, parser: 'json' })
  const markdown = (value: string) => format(value, { ...config, parser: 'markdown' })
  const boundaries = model.report.priorStaticAssessment.HISTORICAL_BLOCKERS.filter(
    (blocker) => blocker.ERROR_CLASS === 'COMPLETE_BOUNDARY_POSTCONDITION_SPECIFICATION_MISSING',
  )
    .map(
      (blocker) =>
        `| ${blocker.REPLAY_UNIT_ID} | ${blocker.SOURCE_FILE} | Complete accepted non-CREATE/postcreate invariant set,read-only predicates and exact expected values absent |`,
    )
    .join('\n')
  const table = model.registryPacket.REGISTRY.map(
    (entry) =>
      `| ${entry.REPLAY_UNIT_ID} | ${entry.UNIT_CLASS} | ${entry.DATABASE_SCOPE} | ${entry.PLAN_POSITION} | ${entry.EXECUTION_STATUS} | ${entry.TRANSACTION_COMPATIBILITY} |`,
  ).join('\n')
  const summary = `# W5B state-aware replay implementation - BLOCKED

## Architecture and implementation coverage

Implemented only the canonical provisioning preflight:ten fixed inputs,frozen graph/plan/registry integrity,107-unit topology,231 edges,23 source hashes,84 exact range hashes,127 mechanic and86 handoff preservation,scope-separated static plans,and explicit execution denial.

**107 units registered;0/107 full replay handlers implemented.**43 statement/41 enum-wrapper/23 original-boundary class mappings preserved;functional handler coverage is0/43,0/41,0/23.127/127 mechanics and86/86 handoffs preserved,not implemented. No success-shaped adapter-supplied inspector and no fake all-complete snapshot used as a replay-noop proof.

## Exact blocking units and missing facts

All23 original-position boundaries have only a generic preservation obligation in W5A POSTCONDITIONS. They lack an exhaustive accepted invariant set plus deterministic read-only comparators for full non-CREATE/postcreate completion. Existing Django prerequisite descriptors do not fill that gap. Name presence cannot distinguish ALREADY_COMPLETE from PARTIAL_OR_AMBIGUOUS.

| Exact boundary unit ID | Frozen file | Missing inspection facts |
|---|---|---|
${boundaries}

**84 CREATE units are TRANSACTION_COMPATIBLE:**the accepted W5A classification proves standalone CREATE TABLE or enum-only DO/exception behavior. **23 whole-boundary transaction assignments remain unproven.**Their complete transaction/control semantics are not recorded in the fixed input. Exact unit IDs/classes/source hashes and per-unit missing facts are untruncated in [the JSON phase report](./PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.json) and [the registry](./UE_W5_REPLAY_IMPLEMENTATION_REGISTRY.md). Frozen sources remain byte-bound;three bounded excerpts corroborate missing completion facts without extracting new units or recomputing topology.

## Resumption evidence

HEAD \`${model.report.resumption.REPOSITORY_HEAD}\`;shared dirty worktree preserved.
The pre-existing W5B packet was already **BLOCKED_PREFLIGHT_ONLY**,not an unstarted implementation.
Its persisted-byte/two-generation check passed before this update;all34 upstream commitments still match.
G3 terminal closure remains closed and unchanged;no cloud calls or G3 engineering.

Concrete source-bound completion deficiencies,not the7 deferred constraints or9 residual operands:
- Frozen0000 includes post-CREATE foreign keys and indexes. Matching relations cannot establish their completion.
- Frozen platform0005 includes conditional id defaults,accepted exception branches,and data backfills. Column existence cannot distinguish complete from partial original-boundary effects.
- Frozen0009 grants existing-object privileges,retracts grantor-specific default privileges,and grants CONNECT on the current database. W4P schema verification does not prove these security effects.

Exact unit IDs,source/excerpt digests,line locations and missing comparator facts are recorded in the JSON report.
These excerpts corroborate missing implementation specifications;they do not add units,semantically recompute the W5A graph,or authorize SQL.

## State,atomicity,future apply and authorization

The required five-state model remains the design requirement,not a completed inspector. Current offline preflight reports PRECONDITION_MISSING/FAIL_CLOSED for107/107 units. A W4P completion assertion is rejected as unverified. No unit is replay-eligible merely because of topology or an object-presence claim.
41 enum wrapper ranges stay byte-identical and indivisible;23 original boundaries keep complete original source bytes. No CREATE extraction/rewrite,wrapper remainder loss,duplicate swallowing,or generic idempotency path.
Future apply/rollback orchestration is **not implemented**,because exact postcondition/transaction facts are missing. No replay adapter is invoked. Operational106 nodes and financial1 node remain separate;no cross-scope transaction.
Future authorization must bind plan,graph,scope,actor,manifest and W4P verification digests. Concrete authenticated exclusive-execution adapter remains a residual;default without it is DENY. Its absence is not itself the blocker.

## Downstream preservation

7 deferred handoffs stay DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION with unresolved positions.9 operands remain UNRESOLVED_DOWNSTREAM. They are neither resolved nor blockers to this implementation assessment. No deferred constraint enters the107-node graph.

## Determinism and validation

Blocked plan digest:\`${model.report.determinismDigests.W5B_PLAN_DIGEST}\`.
Registry digest:\`${model.report.determinismDigests.W5B_REGISTRY_DIGEST}\`.
All five W5A commitments remain unchanged.34 byte commitments:ten inputs,23 frozen files,W4P engine. Completed validation evidence is recorded in the JSON phase report;integrity/denial tests are not unit-inspector,replay-noop or rollback proofs.

Resumption validation: **2971 tests passed** across9 files (391 W5B,531 W5A,895 W4P,1154 historical-reconstruction tests),including4 new source-bound resumption tests. TypeScript,scoped ESLint,formatting,two-generation determinism,persisted-byte \`--check\` and \`pnpm validate:docs\` passed. Documentation:2638 files,0 errors,1215 existing warnings. Prior2967-test evidence is labelled historical separately;neither count proves implemented full-unit inspection,rollback or replay-noop.

## Gate,contract and runtime boundaries

W5B=BLOCKED;POST_W4P_REPLAY_IMPLEMENTATION=INCOMPLETE_BLOCKED;W5=IN_PROGRESS (blocked at W5B,not PASS);W5_RUNTIME_EXECUTION=NOT_AUTHORIZED;W6=NOT_AUTHORIZED.
CANONICAL_CONTRACT_VERSION=1.3.3 unchanged.1.3.4 was not published:publication and the new inverse chain require W5B PASS. Producer metadata was not changed to advertise a complete implementation. No1.4.
DATABASE_CONNECTIONS=0;SQL_EXECUTED=0;W4P_EXECUTED=NO;FROZEN_MIGRATIONS_EXECUTED=0;COMPATIBILITY_MECHANICS_EXECUTED=0;W5_REPLAY_EXECUTED=NO;DEFERRED_CONSTRAINTS_MATERIALIZED=NO;PRODUCERS_ACTIVATED=0;BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;FAITHFUL_SCHEMA_REPLAY_PROVEN=NO;RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN=NO;TENANT_ISOLATION_RUNTIME_PROVEN=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
`
  return {
    [outputs.plan]: await json(model.plan),
    [outputs.registry]: await json(model.registryPacket),
    [outputs.report]: await json(model.report),
    [outputs.reportMarkdown]: await markdown(summary),
    [outputs.registryMarkdown]: await markdown(
      `${summary}\n\n## Exact107-unit implementation registry\n\nRegistered identities are not implemented replay handlers. All fields and predecessor/mechanic/handoff links are preserved in [the JSON registry](./UE_W5_REPLAY_IMPLEMENTATION_REGISTRY.json).\n\n| Unit ID | Exact handler class | Scope | Frozen plan position | Implementation status | Transaction evidence |\n|---|---|---|---|---|---|\n${table}\n`,
    ),
    [outputs.planMarkdown]: await markdown(
      `# W5B blocked implementation plan\n\nPLAN_STATE=FAIL_CLOSED;EXECUTION_ALLOWED=NO;107 registered units in exact W5A order. No production run receipt,SQL replay payload or mutation authority.\n\nPlan digest:\`${model.plan.REPLAY_PLAN_DIGEST}\`.\nW5A graph digest:\`${model.plan.GRAPH_DIGEST}\`.\nW5A topological digest:\`${model.plan.TOPOLOGICAL_PLAN_DIGEST}\`.\n\n| Unit ID | Class | Scope | Frozen plan position | Status | Transaction evidence |\n|---|---|---|---|---|---|\n${table}\n\nEvery per-unit inspection is PRECONDITION_MISSING;every action is FAIL_CLOSED;every edge remains NOT_VERIFIED_NO_REPLAY_ELIGIBILITY. Separate scope executions contain106 UE_OPERATIONAL nodes and1 FINANCIAL_SERVICE node. Exact blockers and required missing facts appear in [the phase report](./PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.md).7 deferred constraints and9 unresolved operands remain outside these units.\n`,
    ),
  }
}
export async function generate() {
  const packets = await generateCorePackets()
  const model = buildImplementation()
  const config = await resolveConfig(path.join(root, 'package.json'))
  const json = (value: unknown) => format(JSON.stringify(value), { ...config, parser: 'json' })
  const markdown = (value: string) => format(value, { ...config, parser: 'markdown' })
  const { ledger, closure } = model.boundaryModel
  const closureTable = closure.ROWS.map(
    (row) =>
      `| ${row.BOUNDARY_ID} | ${row.SOURCE} | ${row.EFFECT_COUNT} | ${row.COMPARATOR_COUNT} | ${row.TRANSACTION_CLASS} | ${row.STATUS} |`,
  ).join('\n')
  const counterexamples = closure.IRREDUCIBLE_BLOCKERS.map(
    (entry) =>
      `| ${entry.EFFECT_ID} | ${entry.TARGET_RELATION} | ${entry.PHYSICAL_IDENTITY}.id | ${entry.W4P_PAYLOAD_ID} |`,
  ).join('\n')
  const summary = `# W5B-C final static closure - BLOCKED

## Effect accounting and byte preservation

All23 frozen original-position sources ingested and parsed in order using the accepted W5A statement lexer.
**${ledger.EFFECT_COUNT} executable statements/indivisible blocks accounted;0 unaccounted executable effects.**
UTF-8 zero-based half-open ranges own every source byte,including non-executable comments and trailing trivia.
The financial-service introspection file is wholly block-commented:**0 executable effects**. Its design DDL is not activated or treated as an executable producer.
Exact source text,digest,ordinal,scope,field/constraint definitions,helper bodies/literal arguments,evidence plans and ownership partitions are in [the effect ledger](./UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json).
No source rewrite,node decomposition,edge direction,handoff semantics or topological order changed.

## Completion and transaction closure

${ledger.EFFECT_COUNT} source-bound future read-only comparator plans cover complete definitions,DDL/security/data effects and source branch/exception outcomes,not object names alone.
These are **plans,not implemented full comparators**. No success-shaped inspection callback is claimed.
Receipt bindings cover boundary,source,graph,plan,scope,W4P,predecessor state,execution result and immediate postverification.
Non-monotonic/backfill/branch state without a valid receipt remains PARTIAL_OR_AMBIGUOUS. Immediate verification precedes successors;receipts do not waive current unsuperseded definition drift.
23/23 boundary transaction assignments are source-native TRANSACTION_COMPATIBLE;0 source transaction gaps. Function invocations bind exact frozen helper bodies;procedural wrappers remain indivisible.
This is not a live PostgreSQL rollback proof. Future unknown event triggers,extension or called-function side effects must be qualified before transaction execution.

## Exact irreducible source prerequisite

**1 original boundary /12 exact effects /10 distinct parent keys**:
\`UE-W5A-MIGRATION-c1a4ed09468e3478\` in [0014_lineage_restoration_rls_closure.sql](../../../apps/union-eyes/db/migrations-cache/0014_lineage_restoration_rls_closure.sql).
Its calls to the frozen \`ue_create_parent_owned_rls_policy_v2\` bind policies containing \`parent.id\`.
Mandatory W4P can create these parents with only an organization column. Neither those payloads nor any executable statement in the23 bound sources produces the required parent IDs.
The earlier guarded-CREATE collision hypothesis was tested and **rejected**;it is not a finding.

| Exact effect | Target relation | Required absent parent key | Exact accepted W4P producer |
|---|---|---|---|
${counterexamples}

A catalog comparator can detect missing parent columns. The blocker is **safe replay eligibility and verifiable completed policy state**,not missing annotations:the immutable helper cannot construct its policy against that parent shape.
A verified W4P receipt,topological position,fake all-complete catalog or boundary receipt cannot invent the key.
These parent IDs are **not any of the9 unresolved downstream operands**;the7 deferred constraints are not blockers.
Required new authority:an explicitly approved exact parent-key producer/definition/order before this RLS boundary,or separately authorized proof of compatible existing parent keys. No type,uniqueness,default,producer,source or graph change is inferred here.
This counterexample is relative to the accepted closed source universe and fresh compliant W4P state;it does not assert every legacy database lacks those columns.
No further generic discovery phase is authorized.

## Final23-row closure table

IMPLEMENTABLE means source-representability,not completed replay handlers. Full inspectors/verifiers were not implemented after the irreducible whole-graph counterexample was established.
Every row's observability,receipt dependencies,inspection/verifier status and exact blocking IDs are untruncated in [the closure JSON](./UE_W5_ORIGINAL_BOUNDARY_CLOSURE.json).

| Boundary ID | Source | Effects | Comparator plans | Source transaction class | Status |
|---|---|---:|---:|---|---|
${closureTable}

##107-unit implementation and proof ceiling

107 registered units:43 exact CREATE,41 enum wrappers,23 original boundaries.
**Replay handlers0/107;full inspectors0/107;full verifiers0/107.**
Replay-noop:NOT_ESTABLISHED. Fake fresh replay:denied for the exact missing-parent-key counterexample. Fake rollback:NOT_IMPLEMENTED_NOT_PROVEN. Offline denial is not a rollback proof.
Five-state model remains exact. Verified W4P,all incoming predecessors,scope/source/digest integrity and future human authorization remain mandatory.
Concrete exclusive-execution adapter remains ABSENT;current future apply=DENY. No advisory-lock or receipt table invented.
106 operational units and1 financial unit remain scope-separated;no cross-database atomicity claim.

## Preservation and validation

107 nodes /231 provenance edges /127 compatibility records /86 repeated handoffs preserved.
35 upstream byte commitments match:ten frozen inputs,23 sources,W4P engine and the accepted inactive W4P payload file.
7 deferred constraints remain outside W5 replay;9 operands remain unresolved downstream. Canonical1.3.3 and its inverse reconstruction chain are unchanged.
Historical W5B findings/test counts remain separately labelled in the JSON phase report,with accepted pre-W5BC packet hashes.
Current validation:\`${model.report.validation.CURRENT_VALIDATION}\`. Measured command results are recorded in the JSON phase report;no integrity test count substitutes for runtime proof.
G3 terminal closure remains CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE;no G3 engineering or Azure calls.

## Exact successor state and proof boundaries

\`\`\`text
PHASE_1B_3C_A1I_W5B = BLOCKED
POST_W4P_REPLAY_IMPLEMENTATION = INCOMPLETE_BLOCKED
W5 = IN_PROGRESS
W5_RUNTIME_EXECUTION = NOT_AUTHORIZED
W6 = NOT_AUTHORIZED
CANONICAL_CONTRACT_VERSION = 1.3.3
DATABASE_CONNECTIONS = 0
SQL_EXECUTED = 0
W4P_EXECUTED = NO
FROZEN_MIGRATIONS_EXECUTED = 0
W5_EXECUTED = NO
DEFERRED_CONSTRAINTS_MATERIALIZED = NO
READY_FOR_RUNTIME_PROOF = 0
PRODUCT_READY = NO
\`\`\`
`
  return {
    ...packets,
    [outputs.reportMarkdown]: await markdown(summary),
    [outputs.planMarkdown]: await markdown(summary),
    [outputs.registryMarkdown]: await markdown(
      `${summary}\n\n## Frozen107-unit registry\n\n| Unit | Class | Scope | Position | Status |\n|---|---|---|---:|---|\n${model.registryPacket.REGISTRY.map((entry) => `| ${entry.REPLAY_UNIT_ID} | ${entry.UNIT_CLASS} | ${entry.DATABASE_SCOPE} | ${entry.PLAN_POSITION} | ${entry.EXECUTION_STATUS} |`).join('\n')}\n`,
    ),
    [outputs.effects]: await json(ledger),
    [outputs.effectsMarkdown]: await markdown(
      `${summary}\n\n## Source effect inventory\n\n| Effect ID | UTF8 bytes | Class | Comparator plan | Window |\n|---|---|---|---|---|\n${ledger.BOUNDARIES.flatMap((boundary) => boundary.EFFECTS.map((effect) => `| ${effect.EFFECT_ID} | ${effect.SOURCE_BYTE_RANGE.join('..')} | ${effect.EFFECT_CLASS} | ${effect.COMPARATOR.CLASS} | ${effect.COMPARATOR.VERIFICATION_WINDOW} |`)).join('\n')}\n`,
    ),
    [outputs.closure]: await json(closure),
    [outputs.closureMarkdown]: await markdown(summary),
  }
}
export async function main(args: string[]) {
  assert(
    args.length && args.every((arg) => ['--plan', '--check', '--self-test'].includes(arg)),
    'UNAUTHORIZED_W5B_FLAG',
  )
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W5B')
    console.log('PASS W5B two-generation blocked evidence bytes identical')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `W5B_ARTIFACT_DRIFT:${file}`)
    console.log(
      'PASS W5B persisted evidence and fixed-input/source integrity;replay implementation remains BLOCKED',
    )
  } else if (args.includes('--plan')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, file), bytes)
    console.log(
      'W5B blocked evidence persisted;no source/contract amendments,no connection or SQL execution',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
