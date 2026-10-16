import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { loadFrozenReplay } from './implement-w5b-post-w4p-replay'
import {
  buildSupplement,
  historicalW5bcHashes,
  outputs as pkOutputs,
} from './implement-w5bpk-parent-key-supplement'
import { read, root } from './w4-physical-producers'
import { loadSpecification } from './implement-w4p-platform-promotion'
import {
  replayDigest,
  replayHash,
  replayObject,
} from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'
import { compileReplayUnitPlan } from '../../apps/union-eyes/scripts/provisioning/replay-unit-plan'
import { supplementPlanDigest } from '../../apps/union-eyes/scripts/provisioning/parent-key-supplement'
import {
  createFakeSourceIncomingCatalog,
  inspectFakeSourceW4pCompatibility,
} from '../../apps/union-eyes/scripts/provisioning/replay-fake-source-fixture'
import {
  applyFakeProspectiveMembershipOverlay,
  buildProspectiveMembershipAuthority,
  membershipPayloadId,
  promoteFakeProspectiveW4p,
} from '../../apps/union-eyes/scripts/provisioning/replay-fake-w5-compatibility'
import { ProvisioningError } from '../../apps/union-eyes/scripts/provisioning/governed-provisioning'
import {
  inspectPayload,
  readCatalog,
} from '../../apps/union-eyes/scripts/provisioning/platform-baseline-promotion'
import type { ReplayPositionPin } from '../../apps/union-eyes/scripts/provisioning/replay-position-authority'

const folder = 'docs/union-eyes/reality-remediation/'
// The six same-named W5B-C packets remain at their immutable historical paths.
const successor = folder + 'w5-compat/'
export const outputs = {
  authority: folder + 'UE_W5_W4P_COMPATIBILITY_SUPERSESSION.json',
  authorityMarkdown: folder + 'UE_W5_W4P_COMPATIBILITY_SUPERSESSION.md',
  census: folder + 'UE_W5_W4P_COMPATIBILITY_CENSUS.json',
  censusMarkdown: folder + 'UE_W5_W4P_COMPATIBILITY_CENSUS.md',
  plan: successor + 'UE_W5_REPLAY_IMPLEMENTATION_PLAN.json',
  planMarkdown: successor + 'UE_W5_REPLAY_IMPLEMENTATION_PLAN.md',
  registry: successor + 'UE_W5_REPLAY_IMPLEMENTATION_REGISTRY.json',
  registryMarkdown: successor + 'UE_W5_REPLAY_IMPLEMENTATION_REGISTRY.md',
  report: successor + 'PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.json',
  reportMarkdown: successor + 'PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.md',
}

export async function buildCompatibility(wheelhouse: string) {
  assert(wheelhouse, 'UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
  const { frozen, inputBytes, sourceBytes } = loadFrozenReplay()
  const supplement = buildSupplement().plan.SPECIFICATION
  const plan = compileReplayUnitPlan(
    frozen,
    sourceBytes,
    read(folder + 'UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
    supplementPlanDigest(supplement),
  )
  const pin: ReplayPositionPin = {
    database: 'fake_w5_compat',
    searchPath: ['public', 'pg_catalog'],
    execution: {
      scope: 'UE_OPERATIONAL',
      actorClass: 'MIGRATION_ADMIN',
      actorPrincipal: 'fake_admin',
      targetDigest: replayDigest('offline-w5-compat-target'),
      w4pPlanDigest: plan.specification.w4pPlanDigest,
      w4pVerificationDigest: replayDigest('NOT_VERIFIED_W4P'),
      supplementPlanDigest: plan.specification.supplementPlanDigest,
      supplementVerificationDigest: replayDigest('NOT_APPLIED_SUPPLEMENT'),
      exclusiveExecutionReference: 'offline-only-no-runtime-authorization',
    },
  }
  const incoming = await createFakeSourceIncomingCatalog(plan, pin, root, wheelhouse)
  const sourceDigest = replayDigest(incoming.baseline)
  const before = await inspectFakeSourceW4pCompatibility(incoming)
  const { specification } = await loadSpecification()
  const authority = buildProspectiveMembershipAuthority(incoming.baseline, specification)
  await applyFakeProspectiveMembershipOverlay(incoming.catalog, authority)
  assert.equal(replayDigest(incoming.baseline), sourceDigest, 'SOURCE_BASELINE_CONTAMINATED')
  const native = await readCatalog(incoming.catalog, specification)
  const records = before.records.map((record) => {
    const historicalInvariant = specification.invariants.find(
      (entry) => entry.payload.PAYLOAD_ID === record.payloadId,
    )
    assert(historicalInvariant, 'EXACT_PAYLOAD_REQUIRED')
    const invariant =
      record.payloadId === membershipPayloadId
        ? authority.prospectiveInvariant
        : historicalInvariant
    const inspection = inspectPayload(invariant, native)
    const missing = inspection.REASONS.filter((reason) =>
      reason.startsWith('MATERIALIZED_CONSTRAINT_OPERAND_MISSING:'),
    ).map((reason) => reason.slice('MATERIALIZED_CONSTRAINT_OPERAND_MISSING:'.length))
    const producers = missing.map((column) => ({
      column,
      w4pPayloadIds: specification.invariants
        .filter(
          (entry) =>
            entry.schema === invariant.schema &&
            entry.name === invariant.name &&
            entry.columns.some((field) => field.name === column),
        )
        .map((entry) => entry.payload.PAYLOAD_ID),
      supplementProducer: supplement.definitions.some(
        (entry) => entry.relation === invariant.name && column === 'id',
      ),
    }))
    const classification =
      record.payloadId === membershipPayloadId
        ? 'DERIVED_FROM_THE_SAME_ORGANIZATION_ID_CONTRADICTION'
        : inspection.STATE === 'PRESENT_DRIFTED'
          ? 'INDEPENDENT_TRUE_CONTRADICTION'
          : inspection.STATE === 'PRECONDITION_MISSING'
            ? producers.length && producers.every((entry) => entry.w4pPayloadIds.length > 0)
              ? 'CLOSED_BY_EXISTING_W4P_ORDER'
              : producers.length && producers.every((entry) => entry.supplementProducer)
                ? 'CLOSED_BY_PARENT_KEY_SUPPLEMENT'
                : 'REAL_UNRESOLVED_PRECONDITION'
            : 'EXPECTED_SOURCE_VS_PROSPECTIVE_DIFFERENCE'
    return {
      ...record,
      historicalSql: historicalInvariant.payload.SQL,
      requiredExistingColumns: historicalInvariant.requiredExistingColumns,
      beforeOverlayInspection: record.inspection,
      inspection,
      actualRelation:
        native.relations.find(
          (entry) => entry.schema === invariant.schema && entry.name === invariant.name,
        ) ?? null,
      superseded: record.payloadId === membershipPayloadId,
      classification,
      prerequisiteProducers: producers,
      reason:
        classification === 'INDEPENDENT_TRUE_CONTRADICTION'
          ? 'Existing source-produced organization_id is nullable but the unchanged W4P payload requires NOT NULL. ADD COLUMN cannot reconcile an existing column. Tightening this unrelated table nullability is not a necessary consequence of UUID membership type or membership uniqueness; this charter does not authorize it.'
          : classification === 'REAL_UNRESOLVED_PRECONDITION'
            ? 'An existing source-produced parent lacks required unique-constraint operands. No unchanged W4P payload or ten-key definition produces all missing operands. The historical declaration used by the assumed canonical fixture is not a Django-first producer.'
            : 'No additional supersession authorized.',
    }
  })
  const residuals = records.filter((record) =>
    ['INDEPENDENT_TRUE_CONTRADICTION', 'REAL_UNRESOLVED_PRECONDITION'].includes(
      record.classification,
    ),
  )
  assert.deepEqual(
    residuals
      .filter((entry) => entry.classification === 'INDEPENDENT_TRUE_CONTRADICTION')
      .map((entry) => entry.name)
      .sort(),
    ['claims', 'grievances', 'security_events'],
    'TERMINAL_RESIDUAL_CHANGED_REQUIRES_EXACT_ADJUDICATION',
  )
  const prePromotion = incoming.catalog.digest()
  let promotionDenial: string | null = null
  try {
    await promoteFakeProspectiveW4p(incoming.catalog, authority)
  } catch (error: unknown) {
    if (
      !(error instanceof ProvisioningError) ||
      !error.message.startsWith('W5_COMPAT_W4P_INDEPENDENT_DENIAL:')
    )
      throw error
    promotionDenial = error.message
  }
  assert(promotionDenial, 'W4P_DENIAL_REQUIRED_FOR_TERMINAL_DISPOSITION')
  assert.equal(incoming.catalog.digest(), prePromotion, 'W4P_DENIAL_FAILED_TO_ROLL_BACK')
  const counts = (entries: typeof before.records) =>
    entries.reduce<Record<string, number>>((result, record) => {
      result[record.inspection.STATE] = (result[record.inspection.STATE] ?? 0) + 1
      return result
    }, {})
  const effect = plan.components.effects.find(
    (entry) => entry.effectId === 'UE-W5A-MIGRATION-d264f77905daf432:E048',
  )
  assert(effect, 'FROZEN_E048_REQUIRED')
  assert.equal(
    effect.sourceHash,
    '32f8b632fb11db40437bd9d9f063e30a7ff54fe7ecdeb938736697e685d6775b',
  )
  const preservation = {
    ...Object.fromEntries(
      Object.entries(inputBytes).map(([file, bytes]) => [file, replayHash(bytes)]),
    ),
    ...Object.fromEntries(
      Object.entries(sourceBytes).map(([file, bytes]) => [file, replayHash(bytes)]),
    ),
    ...Object.fromEntries(
      Object.keys(historicalW5bcHashes).map((name) => [
        folder + name,
        replayHash(read(folder + name)),
      ]),
    ),
    ...Object.fromEntries(Object.values(pkOutputs).map((file) => [file, replayHash(read(file))])),
  }
  const g3File = 'infrastructure/landing-zone/g3-readiness-evidence/G3_TERMINAL_DISPOSITION.json'
  const g3Bytes = read(g3File)
  assert.equal(
    replayObject(JSON.parse(g3Bytes)).MISSION_DISPOSITION,
    'CLOSED_NO_GO_CURRENT_PROOF_ARCHITECTURE',
    'G3_TERMINAL_CLOSURE_REQUIRED',
  )
  preservation[g3File] = replayHash(g3Bytes)
  const result = {
    PHASE: 'PHASE_1B_3C_A1I_W5B_COMPAT',
    LINEAGE: authority.lineage,
    PHASE_1B_3C_A1I_W5B: 'BLOCKED_TERMINAL_STATIC',
    W5: 'BLOCKED_TERMINAL_STATIC',
    W6: 'NOT_AUTHORIZED',
    CANONICAL_CONTRACT_VERSION: '1.3.3',
    AUTHORIZED_SUPERSESSIONS: 1,
    UUID_MEMBERSHIP_OVERLAY: 'OFFLINE_COMPONENT_VERIFIED_NOT_EXECUTED_LIVE',
    MEMBERSHIP_UNIQUENESS: 'OFFLINE_COMPONENT_VERIFIED_NOT_EXECUTED_LIVE',
    W4P_COMPLETION: 'DENIED_INDEPENDENT_RESIDUALS',
    W4P_ATOMIC_DENIAL: promotionDenial,
    W4P_PARTIAL_PROMOTION_ROLLED_BACK: true,
    SOURCE_BASELINE_DIGEST: sourceDigest,
    SOURCE_BASELINE_UNCHANGED: true,
    SOURCE_BASELINE_CEILINGS: incoming.baseline.unsupported,
    SOURCE_BASELINE_IS_FULL_DJANGO_GRAPH_PROOF: false,
    CENSUS_BEFORE_OVERLAY: counts(before.records),
    CENSUS_AFTER_MEMBERSHIP_OVERLAY_BEFORE_REMAINING_W4P: counts(records),
    PAYLOADS_ACCOUNTED: records.length,
    EXECUTION_AFFECTING_DRIFT: records.filter(
      (entry) => entry.inspection.STATE === 'PRESENT_DRIFTED',
    ).length,
    UNRESOLVED_PRECONDITIONS: residuals.filter(
      (entry) => entry.classification === 'REAL_UNRESOLVED_PRECONDITION',
    ).length,
    E048: {
      EFFECT_ID: effect.effectId,
      SOURCE_FILE: frozen.nodes.find((node) => node.REPLAY_UNIT_ID === effect.boundaryId)
        ?.SOURCE_FILE,
      SOURCE_SHA256: effect.sourceHash,
      SOURCE_BYTES_CHANGED: false,
      ASSIGNMENT_TYPES_AFTER_MEMBERSHIP_OVERLAY: 'pg_catalog.uuid -> pg_catalog.uuid',
      ISOLATED_NATIVE_ASSIGNMENT: 'TYPE_COMPATIBLE_NOT_FULL_BOUNDARY_PROOF',
      CANONICAL_W4P_GUARDED_FK:
        'NOT_PROVEN; existing UUID member_documents column causes guarded ADD COLUMN to skip its inline FK',
      FULL_BOUNDARY_POSTCONDITION: 'NOT_PROVEN',
    },
    QUALIFICATION: {
      OPERATIONAL_VERIFIED: 0,
      OPERATIONAL_REQUIRED: 106,
      TOTAL_VERIFIED_IN_THIS_CHARTER: 0,
      TOTAL_REQUIRED: 107,
      FINANCIAL_PREDECESSOR_PROOF: 'PRESERVED_NO_EFFECT_COMPONENT; not a full107certificate',
      ORIGINAL_BOUNDARIES_VERIFIED: 0,
      ORIGINAL_BOUNDARIES_REQUIRED: 23,
      EFFECTS_VERIFIED_IN_FULL_GRAPH: 0,
      EFFECTS_REQUIRED: 762,
      HANDLERS_QUALIFIED: 0,
      INSPECTORS_QUALIFIED: 0,
      VERIFIERS_QUALIFIED: 0,
      COMPONENT_CONTRACTS_COMPILED: 107,
      FRESH_REPLAY: 'NOT_RUN_W4P_PRECONDITION_DENIED',
      REPLAY_NOOP: 'NOT_PROVEN',
      FULL_GRAPH_ROLLBACK: 'NOT_PROVEN',
      SUCCESSOR_EXECUTED: false,
      REPLAY_RECEIPT_PUBLISHED: false,
    },
    FROZEN_DENOMINATORS: {
      NODES: frozen.nodes.length,
      EDGES: frozen.edges.length,
      COMPATIBILITY_RECORDS: 127,
      HANDOFF_RECORDS: 86,
      DEFERRED_CONSTRAINTS: 7,
      UNRESOLVED_DOWNSTREAM_OPERANDS: 9,
    },
    RESIDUALS: residuals,
    PRESERVATION_SHA256: preservation,
    PROOF_BOUNDARIES: {
      DATABASE_CONNECTIONS: 0,
      SQL_EXECUTED_AGAINST_DATABASE: 0,
      LIVE_EXECUTION: 0,
      W4P_EXECUTED_LIVE: 'NO',
      COMPATIBILITY_OVERLAY_EXECUTED_LIVE: 'NO',
      PARENT_KEY_SUPPLEMENT_EXECUTED_LIVE: 'NO',
      W5_EXECUTED_LIVE: 'NO',
      PRODUCTION_MUTATIONS: 0,
      G3_REOPENED: 'NO',
      MERGE: 'NO',
      PR: 'NO',
      DEPLOY: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    },
    HISTORICAL_PACKETS:
      'PRESERVED_AT_ORIGINAL_PATHS; prospective successor packets live in w5-compat',
    FURTHER_STATIC_REMEDIATION: 'EXHAUSTED; no new charter requested or invented',
  }
  return {
    authority,
    result,
    census: {
      lineage: authority.lineage,
      before: before.records,
      afterMembershipOverlay: records,
      stage: 'SOURCE_BASELINE_PLUS_MEMBERSHIP_OVERLAY_NOT_COMPLETED_W4P',
      executionAuthorized: false,
    },
    registry: frozen.order.map((node) => ({
      REPLAY_UNIT_ID: node.REPLAY_UNIT_ID,
      SOURCE_FILE: node.SOURCE_FILE,
      SOURCE_SHA256: node.SOURCE_SHA256,
      EXACT_UNIT_SHA256: node.EXACT_UNIT_SHA256,
      DATABASE_SCOPE: node.DATABASE_SCOPE,
      PLAN_POSITION: node.REQUIRED_REPLAY_POSITION,
      STATUS: 'NOT_QUALIFIED_TERMINAL_W4P_PREREQUISITE_DENIED',
      EXECUTION_ALLOWED: 'NO',
    })),
  }
}

export async function generateCompatibility(wheelhouse: string) {
  const model = await buildCompatibility(wheelhouse)
  const config = (await resolveConfig(path.join(root, '.prettierrc'))) ?? {}
  const json = (value: unknown) =>
    format(JSON.stringify(value, null, 2), { ...config, parser: 'json' })
  const rows = model.result.RESIDUALS.map(
    (entry) =>
      `| ${entry.payloadId} | ${entry.name} | ${entry.classification} | ${entry.inspection.REASONS.join(', ')} |`,
  ).join('\n')
  const summary = `# W5B-COMPAT prospective terminal static disposition

W5 = **BLOCKED_TERMINAL_STATIC**. W6 = **NOT_AUTHORIZED**. Canonical contract remains **1.3.3**.
This is the final authorized offline compatibility charter, not a runtime or product proof.

## Compatibility supersession accounting

Exactly one historical payload is prospectively superseded: ${model.authority.historicalPayloadId}.
Historical SQL SHA256: \`${model.authority.historicalPayloadHash}\`.
Lineage: \`${model.authority.lineage}\`. Historical W4P and frozen W5 bytes are unchanged.
The UUID-backed Django FK is retained with its source-native NO ACTION update/delete,
DEFERRABLE INITIALLY DEFERRED semantics. The prospective unique invariant is
\`unique_org_membership (organization_id, user_id)\`; legacy duplicates, nulls, invalid UUIDs and
orphan FK values deny without deduplication or conversion. No source baseline answer is changed.

## 162-payload census and exact independent residuals

Before overlay: ${JSON.stringify(model.result.CENSUS_BEFORE_OVERLAY)}.
After the authorized membership overlay, before remaining W4P:
${JSON.stringify(model.result.CENSUS_AFTER_MEMBERSHIP_OVERLAY_BEFORE_REMAINING_W4P)}.
ABSENT is normal pre-W4P absence, not drift. The three independent nullability contradictions
are not authorized by the UUID/membership decision. Unchanged ADD COLUMN payloads cannot tighten
already-existing nullable columns. All seven missing-operand preconditions are individually bound
to exact payload bytes, source provenance and producer searches in the census; no assumed historical
CREATE context is promoted into Django-first producer authority.

| Payload | Relation | Classification | Exact denial |
| --- | --- | --- | --- |
${rows}

## E048 exact-byte disposition

Effect \`${model.result.E048.EFFECT_ID}\`, SHA256
\`${model.result.E048.SOURCE_SHA256}\`, is preserved without a cast or rewrite.
UUID to UUID assignment is type-compatible in the isolated native model. It is not a full
boundary postcondition or operational graph certificate. The canonical member-document column
also causes its guarded ADD COLUMN to skip inline FK creation; no FK is synthesized.

## Qualification, fresh/noop and rollback

No coherent Django-first W4P prerequisite was produced, so no W5 graph successor was attempted.
Operational qualification: **0/106 in this charter**; total: **0/107 in this charter**;
original boundaries: **0/23**; graph effects: **0/762**. Existing financial/component proofs remain
historical predecessor evidence, not full qualification. Full fresh replay, canonical noop,
whole-graph rollback, commit/receipt restoration are **NOT_PROVEN**.
The authorized overlay has independently tested uniqueness, FK guards and atomic component
rollback; that does not qualify any W5 boundary.

## Preservation and prospective successor location

The immutable same-named W5B-C packets remain at their original paths.
The six authoritative prospective plan/registry/gate packets are in
[w5-compat](w5-compat/PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.md).
The [supersession authority](UE_W5_W4P_COMPATIBILITY_SUPERSESSION.json) and
[full census](UE_W5_W4P_COMPATIBILITY_CENSUS.json) bind source origins, payload SQL and hashes.
All frozen inputs, 23 original migration boundaries, W5B-C packets, six W5B-PK assets and
G3 terminal disposition hashes are recorded. Nodes107/edges231/compatibility127/handoffs86;
seven deferred constraints and nine downstream operands remain untouched.

## Validation and proof boundaries

Deterministic source-bound generation supports \`--plan --self-test\` and \`--check --self-test\`.
Native overlay tests and predecessor suites must be reported with their actual runner results;
generated metadata is not a test success attestation. No excluded or skipped full qualification
is represented as PASS. No 1.3.4 or inverse reconstruction is issued.
DATABASE_CONNECTIONS=0; SQL_EXECUTED_AGAINST_DATABASE=0; LIVE_EXECUTION=0;
PRODUCTION_MUTATIONS=0; G3_REOPENED=NO; MERGE=NO; PR=NO; DEPLOY=NO.
W4P/overlay/supplement/W5 live execution remains unauthorized.
READY_FOR_RUNTIME_PROOF=0; PRODUCT_READY=NO.
Static W5 remediation is exhausted. No W5B-COMPAT-2 or further charter is requested.
`
  const markdown = await format(summary, { ...config, parser: 'markdown' })
  const successorMarkdown = await format(
    summary
      .replaceAll(
        '(w5-compat/PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.md)',
        '(PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.md)',
      )
      .replaceAll('(UE_W5_W4P_', '(../UE_W5_W4P_'),
    { ...config, parser: 'markdown' },
  )
  return {
    [outputs.authority]: await json(model.authority),
    [outputs.authorityMarkdown]: markdown,
    [outputs.census]: await json(model.census),
    [outputs.censusMarkdown]: markdown,
    [outputs.plan]: await json({
      ...model.result,
      ORDER: [
        'SOURCE_BASELINE',
        'AUTHORIZED_MEMBERSHIP_OVERLAY',
        'W4P_COMPLETION_DENIED',
        'STOP_NO_SUPPLEMENT_OR_W5_EXECUTION',
      ],
    }),
    [outputs.planMarkdown]: successorMarkdown,
    [outputs.registry]: await json({ ...model.result, REGISTRY: model.registry }),
    [outputs.registryMarkdown]: successorMarkdown,
    [outputs.report]: await json(model.result),
    [outputs.reportMarkdown]: successorMarkdown,
  }
}

export async function main(args: string[]) {
  assert(
    args.length &&
      args.every((arg) => ['--plan', '--check', '--self-test'].includes(arg)) &&
      !(args.includes('--plan') && args.includes('--check')),
    'UNAUTHORIZED_W5_COMPAT_FLAG',
  )
  const wheelhouse = process.env.UE_FAKE_DJANGO_WHEELHOUSE
  assert(wheelhouse, 'UE_FAKE_DJANGO_WHEELHOUSE_REQUIRED')
  const first = await generateCompatibility(wheelhouse)
  if (args.includes('--self-test'))
    assert.deepEqual(first, await generateCompatibility(wheelhouse), 'W5_COMPAT_NONDETERMINISTIC')
  for (const [file, bytes] of Object.entries(first)) {
    if (args.includes('--check'))
      assert.equal(read(file), bytes, `W5_COMPAT_ARTIFACT_DRIFT:${file}`)
    else if (args.includes('--plan')) {
      const target = path.join(root, ...file.split('/'))
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, bytes)
    }
  }
  console.log(
    'W5=BLOCKED_TERMINAL_STATIC; 162payloads accounted; offline only; no1.3.4; W6=NOT_AUTHORIZED',
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
