import assert from 'node:assert/strict'
import { readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { loadFrozenReplay } from './implement-w5b-post-w4p-replay'
import { read, root } from './w4-physical-producers'
import {
  replayDigest,
  replayHash,
  replayObject,
  replayRecords,
  replayText,
  type Json,
} from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'

const folder = 'docs/union-eyes/reality-remediation/'
const reportFile = folder + 'w5-compat/PHASE_1B_3C_A1I_W5B_REPLAY_IMPLEMENTATION.json'
const censusFile = folder + 'UE_W5_W4P_COMPATIBILITY_CENSUS.json'
const validationFile = folder + 'UE_W5_W4P_COMPATIBILITY_LOCAL_VALIDATION.json'
export const outputs = {
  disposition: folder + 'UE_W5_TERMINAL_STATIC_DISPOSITION.json',
  markdown: folder + 'UE_W5_TERMINAL_STATIC_DISPOSITION.md',
  preservation: folder + 'UE_W5_TERMINAL_STATIC_PRESERVATION.json',
}
const state = {
  UNION_EYES_W5_STATIC_REMEDIATION: 'CLOSED_BLOCKED_TERMINAL_STATIC',
  PHASE_1B_3C_A1I_W5B: 'BLOCKED_TERMINAL_STATIC',
  W5: 'BLOCKED_TERMINAL_STATIC',
  W5_RUNTIME_EXECUTION: 'NOT_AUTHORIZED',
  W6: 'NOT_AUTHORIZED',
  CANONICAL_CONTRACT_VERSION: '1.3.3',
  STATIC_W5_REMEDIATION: 'EXHAUSTED',
  W5_REOPEN_REQUIRES: 'NEW_HUMAN_ARCHITECTURE_CHARTER',
  COMMAND: 'RELEASED_TO_NORMAL_NZILA_OS_DELIVERY_OPERATIONS',
}
const membership = {
  PROSPECTIVE_W4P_W5_MEMBERSHIP_COMPATIBILITY: 'COMPLETE_NOT_EXECUTED',
  ORGANIZATION_IDENTIFIER_TYPE: 'UUID',
  'organization_members.organization_id': 'UUID NOT NULL',
  'member_documents.organization_id': 'UUID',
  unique_org_membership: 'UNIQUE (organization_id, user_id)',
  E048_BYTES_CHANGED: 'NO',
  E048_UUID_TO_UUID_STATIC_COMPATIBILITY: 'PASS',
}
const ceilings = {
  FULL_W4P_COMPATIBILITY: 'NOT_PROVEN',
  OPERATIONAL_W5_NODES: '0 / 106',
  TOTAL_W5_NODES: '0 / 107',
  ORIGINAL_BOUNDARIES: '0 / 23',
  BOUNDARY_EFFECTS: '0 / 762',
  FRESH_REPLAY: 'NOT_RUN',
  REPLAY_NOOP: 'NOT_PROVEN',
  WHOLE_GRAPH_ROLLBACK: 'NOT_PROVEN',
}
const boundaries = {
  DATABASE_CONNECTIONS: 0,
  DATABASE_SQL_EXECUTED: 0,
  LIVE_W4P_EXECUTION: 'NO',
  LIVE_COMPATIBILITY_OVERLAY_EXECUTION: 'NO',
  LIVE_PARENT_KEY_SUPPLEMENT_EXECUTION: 'NO',
  LIVE_W5_EXECUTION: 'NO',
  PRODUCTION_MUTATIONS: 0,
  PR_CREATED: 'NO',
  MERGED: 'NO',
  DEPLOYED: 'NO',
  W6_STARTED: 'NO',
  G3_REOPENED: 'NO',
}
const census = {
  TOTAL_W4P_PAYLOADS: 162,
  ABSENT: 114,
  MATCHING: 38,
  DRIFTED: 3,
  MISSING_PRECONDITIONS: 7,
  THIS_IS_NOT_A_VERIFIED_W4P_CATALOG: true,
}
const validation = {
  REPLAY_TESTS_PASS: 7277,
  HISTORICAL_CANONICAL_TEXT_ACCEPTANCE: 'FAIL_EXPECTED_PRESERVED_CONTRADICTION',
  W5_GOVERNANCE_TESTS_PASS: 211,
  W4_PREDECESSOR_TESTS_PASS: 1104,
  W4FR4_TESTS_PASS: 237,
  G3_TERMINAL_TESTS_PASS: 116,
  SKIPPED_TESTS_IN_FINAL_RECORDED_RUNS: 0,
  STRICT_TYPES: 'PASS',
  ZERO_WARNING_LINT: 'PASS',
  FORMATTING: 'PASS',
  DETERMINISTIC_GENERATION: 'PASS',
  DOCUMENTATION_VALIDATION: 'PASS',
  BASIS: 'PRESERVED_RECORDED_RUNS_NOT_NEW_FULL_QUALIFICATION',
}
const missingNames = [
  'integration_configs',
  'social_accounts',
  'votes',
  'ml_predictions',
  'cms_pages',
  'model_metadata',
  'donation_campaigns',
]
const contradictionIds = {
  claims: '77c77645b1c15c95',
  grievances: 'c60ebc8408c112e2',
  security_events: 'a3706a0a965fa035',
}
const jsonInput = (file: string) => replayObject(JSON.parse(read(file)))

export function buildTerminalClosure() {
  const report = jsonInput(reportFile)
  const priorValidation = jsonInput(validationFile)
  const fullCensus = jsonInput(censusFile)
  const { frozen, sourceBytes } = loadFrozenReplay()
  assert.equal(report.W5, state.W5)
  assert.equal(report.CANONICAL_CONTRACT_VERSION, state.CANONICAL_CONTRACT_VERSION)
  assert.deepEqual(report.CENSUS_AFTER_MEMBERSHIP_OVERLAY_BEFORE_REMAINING_W4P, {
    ABSENT: 114,
    PRESENT_MATCHING: 38,
    PRESENT_DRIFTED: 3,
    PRECONDITION_MISSING: 7,
  })
  const records = replayRecords(fullCensus.afterMembershipOverlay)
  assert.equal(records.length, 162)
  const residuals = replayRecords(report.RESIDUALS)
  const contradictions = Object.entries(contradictionIds).map(([name, suffix]) => {
    const entry = residuals.find((record) => record.name === name)
    assert(entry, `TERMINAL_CONTRADICTION_MISSING:${name}`)
    assert.equal(entry.payloadId, 'UE-W4FR4-PAYLOAD-' + suffix)
    assert.equal(entry.classification, 'INDEPENDENT_TRUE_CONTRADICTION')
    assert.deepEqual(replayObject(entry.inspection).REASONS, ['organization_id:NULLABILITY_DRIFT'])
    const actual = replayRecords(replayObject(entry.actualRelation).columns).find(
      (column) => column.name === 'organization_id',
    )
    const expected = replayRecords(entry.expectedColumns).find(
      (column) => column.name === 'organization_id',
    )
    assert.equal(actual?.postgresType, 'uuid')
    assert.equal(actual?.notNull, false)
    assert.equal(expected?.postgresType, 'uuid')
    assert.equal(expected?.notNull, true)
    return {
      relation: name,
      source: 'nullable UUID',
      W4P: 'UUID NOT NULL',
      payloadSuffix: suffix,
      payloadId: entry.payloadId,
      payloadSha256: entry.sqlHash,
      sourceOrigins: entry.sourceOrigins,
    }
  })
  assert.equal(
    residuals.filter((entry) => entry.classification === 'INDEPENDENT_TRUE_CONTRADICTION').length,
    3,
  )
  const operands = residuals.filter(
    (entry) => entry.classification === 'REAL_UNRESOLVED_PRECONDITION',
  )
  assert.deepEqual(operands.map((entry) => replayText(entry.name)).sort(), [...missingNames].sort())
  assert.equal(
    report.W4P_ATOMIC_DENIAL,
    'W5_COMPAT_W4P_INDEPENDENT_DENIAL:UE-W4FR4-PAYLOAD-116714fb92f94f71:MATERIALIZED_CONSTRAINT_OPERAND_MISSING:slug',
  )
  assert.equal(report.W4P_PARTIAL_PROMOTION_ROLLED_BACK, true)
  const recordedRuns = replayRecords(priorValidation.RESULTS)
  for (const count of [7277, 211, 1104, 237, 116]) {
    const run = recordedRuns.find((entry) => entry.PASSED === count)
    assert(run, `RECORDED_VALIDATION_COUNT_MISSING:${count}`)
    assert.equal(run.SKIPPED ?? 0, 0)
  }
  const failed = recordedRuns.find((entry) => entry.PASSED === 7277)
  assert.equal(failed?.FAILED, 1)
  assert.equal(
    failed?.EXACT_FAILURE,
    'FAKE_BACKFILL_NATIVE_ASSIGNMENT_TYPE_MISMATCH:pg_catalog.text->pg_catalog.uuid',
  )
  const historicalTest =
    'apps/union-eyes/scripts/provisioning/replay-fake-full-qualification.test.ts'
  const testBytes = read(historicalTest)
  assert(testBytes.includes("it('qualifies all106/762 conditional"))
  assert(
    !testBytes.includes("it.skip('qualifies all106") &&
      !testBytes.includes("it.fails('qualifies all106"),
  )
  const bound = replayObject(report.PRESERVATION_SHA256)
  for (const [file, hash] of Object.entries(bound))
    assert.equal(replayHash(read(file)), hash, `TERMINAL_PREDECESSOR_HASH_DRIFT:${file}`)
  for (const [file, hash] of Object.entries(replayObject(priorValidation.VALIDATED_SOURCE_SHA256)))
    assert.equal(replayHash(read(file)), hash, `TERMINAL_VALIDATED_SOURCE_DRIFT:${file}`)
  const preserved = { ...bound }
  const bind = (file: string) => {
    preserved[file] = replayHash(read(file))
  }
  for (const name of readdirSync(path.join(root, ...folder.split('/'))).sort()) {
    if (
      /\.(json|md)$/.test(name) &&
      /W4|W5/.test(name) &&
      !name.startsWith('UE_W5_TERMINAL_STATIC_')
    )
      bind(folder + name)
  }
  for (const name of readdirSync(path.join(root, ...folder.split('/'), 'w5-compat')).sort())
    if (/\.(json|md)$/.test(name)) bind(folder + 'w5-compat/' + name)
  const g3Folder = 'infrastructure/landing-zone/g3-readiness-evidence/'
  for (const name of readdirSync(path.join(root, ...g3Folder.split('/'))).sort())
    if (/^G3_TERMINAL_.*\.(json|md)$/.test(name)) bind(g3Folder + name)
  for (const file of Object.keys(replayObject(priorValidation.VALIDATED_SOURCE_SHA256))) bind(file)
  bind(historicalTest)
  assert.equal(Object.keys(sourceBytes).length, 23)
  const ledger = jsonInput(folder + 'UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json')
  const e048 = replayRecords(ledger.BOUNDARIES)
    .flatMap((boundary) => replayRecords(boundary.EFFECTS))
    .find((entry) => entry.EFFECT_ID === 'UE-W5A-MIGRATION-d264f77905daf432:E048')
  assert(e048, 'E048_LEDGER_EFFECT_REQUIRED')
  const e048Report = replayObject(report.E048)
  const source = sourceBytes[replayText(e048Report.SOURCE_FILE)]
  assert(source?.includes('SET organization_id = om.organization_id'))
  assert.equal(
    e048Report.SOURCE_SHA256,
    '32f8b632fb11db40437bd9d9f063e30a7ff54fe7ecdeb938736697e685d6775b',
  )
  assert(Array.isArray(e048.SOURCE_BYTE_RANGE) && e048.SOURCE_BYTE_RANGE.length === 2)
  const [start, end] = e048.SOURCE_BYTE_RANGE
  assert(typeof start === 'number' && typeof end === 'number')
  const exactEffect = Buffer.from(source, 'utf8').subarray(start, end).toString('utf8')
  assert.equal(replayHash(exactEffect), e048Report.SOURCE_SHA256)
  assert.equal(exactEffect, replayObject(e048.COMPARATOR).EXACT_SOURCE_SEMANTICS)
  const keyAuthority = jsonInput(folder + 'UE_W5_PARENT_KEY_AUTHORITY.json')
  const supplement = jsonInput(folder + 'UE_W5_PRE_REPLAY_PARENT_KEY_SUPPLEMENT.json')
  assert.equal(supplement.AUTHORIZED_IDENTITIES, 10)
  assert.equal(replayRecords(keyAuthority.RECORDS).length, 10)
  const disposition = {
    SCHEMA_VERSION: '1.0',
    ...state,
    DISPOSITION_KIND: 'SUCCESSFUL_GOVERNANCE_CLOSURE_OF_UNSUCCESSFUL_W5_QUALIFICATION',
    ACCEPTED_BY_HUMAN: true,
    ACCEPTANCE_DATE: '2026-10-13',
    SCOPE: 'W5_STATIC_BOOTSTRAP_REPLAY_QUALIFICATION_ONLY',
    PRODUCT_APPLICATION_ASSURANCE_FAILED: false,
    MEMBERSHIP_DECISION: membership,
    BLOCKERS: {
      THESE_BLOCKERS: 'OUTSIDE_AUTHORIZED_MEMBERSHIP_COMPATIBILITY_CHARTER',
      INDEPENDENT_CONTRADICTIONS: contradictions,
      UNRESOLVED_OPERAND_SETS: operands.map((entry) => ({
        relation: entry.name,
        payloadId: entry.payloadId,
        payloadSha256: entry.sqlHash,
        reasons: replayObject(entry.inspection).REASONS,
      })),
    },
    W4P_CENSUS: census,
    FIRST_PROSPECTIVE_PROMOTION_DENIAL: {
      payload: '116714fb92f94f71',
      missingPrerequisite: 'cms_pages.slug',
      rollback: 'PASS',
    },
    QUALIFICATION_CEILING: ceilings,
    RECORDED_VALIDATION: validation,
    PROOF_BOUNDARIES: boundaries,
    FROZEN_DENOMINATORS: report.FROZEN_DENOMINATORS,
    E048: {
      ...e048Report,
      SOURCE_SHA256: replayText(e048Report.SOURCE_SHA256),
      FULL_FROZEN_SOURCE_SHA256: replayHash(source),
      LEDGER_EFFECT_PRESENT: true,
      EXACT_SOURCE_BYTE_RANGE: e048.SOURCE_BYTE_RANGE,
    },
    GRAPH_DIGEST: replayDigest(frozen.nodes),
    EDGES_DIGEST: replayDigest(frozen.edges),
    PRESERVATION_MANIFEST: outputs.preservation,
    PRESERVATION_DIGEST: replayDigest(preserved),
    REOPENING_RULE:
      'New human architecture mission must address broader nullable-ID semantics and missing producer ownership; not a continuation of W5B or another compatibility iteration.',
    GOVERNANCE_INDEX: 'docs/union-eyes/PHASE_1_AUTHORITATIVE_INDEXES.md',
  }
  validateTerminalDisposition(disposition)
  return {
    disposition,
    preservation: { SCHEMA_VERSION: '1.0', SHA256: preserved, DIGEST: replayDigest(preserved) },
  }
}

export function validateTerminalDisposition(value: Json | undefined) {
  const model = replayObject(value)
  assert.equal(model.SCHEMA_VERSION, '1.0')
  for (const [key, expected] of Object.entries(state)) assert.equal(model[key], expected, key)
  assert.equal(
    model.DISPOSITION_KIND,
    'SUCCESSFUL_GOVERNANCE_CLOSURE_OF_UNSUCCESSFUL_W5_QUALIFICATION',
  )
  assert.equal(model.ACCEPTED_BY_HUMAN, true)
  assert.equal(model.PRODUCT_APPLICATION_ASSURANCE_FAILED, false)
  assert.deepEqual(model.MEMBERSHIP_DECISION, membership)
  assert.deepEqual(model.QUALIFICATION_CEILING, ceilings)
  assert.deepEqual(model.PROOF_BOUNDARIES, boundaries)
  assert.deepEqual(model.W4P_CENSUS, census)
  assert.deepEqual(model.RECORDED_VALIDATION, validation)
  const blockers = replayObject(model.BLOCKERS)
  assert.equal(blockers.THESE_BLOCKERS, 'OUTSIDE_AUTHORIZED_MEMBERSHIP_COMPATIBILITY_CHARTER')
  assert.deepEqual(
    replayRecords(blockers.INDEPENDENT_CONTRADICTIONS)
      .map((entry) => entry.relation)
      .sort(),
    Object.keys(contradictionIds).sort(),
  )
  assert.deepEqual(
    replayRecords(blockers.UNRESOLVED_OPERAND_SETS)
      .map((entry) => entry.relation)
      .sort(),
    [...missingNames].sort(),
  )
  for (const entry of replayRecords(blockers.INDEPENDENT_CONTRADICTIONS)) {
    const name = replayText(entry.relation)
    const suffix = Object.entries(contradictionIds).find(([relation]) => relation === name)?.[1]
    assert.equal(entry.source, 'nullable UUID')
    assert.equal(entry.W4P, 'UUID NOT NULL')
    assert.equal(entry.payloadSuffix, suffix)
    assert.equal(entry.payloadId, 'UE-W4FR4-PAYLOAD-' + suffix)
  }
  assert.deepEqual(model.FIRST_PROSPECTIVE_PROMOTION_DENIAL, {
    payload: '116714fb92f94f71',
    missingPrerequisite: 'cms_pages.slug',
    rollback: 'PASS',
  })
  assert.deepEqual(model.FROZEN_DENOMINATORS, {
    NODES: 107,
    EDGES: 231,
    COMPATIBILITY_RECORDS: 127,
    HANDOFF_RECORDS: 86,
    DEFERRED_CONSTRAINTS: 7,
    UNRESOLVED_DOWNSTREAM_OPERANDS: 9,
  })
}

export async function generateTerminalClosure() {
  const model = buildTerminalClosure()
  const config = (await resolveConfig(path.join(root, '.prettierrc'))) ?? {}
  const json = (value: unknown) =>
    format(JSON.stringify(value, null, 2), { ...config, parser: 'json' })
  const markdown = `# Union Eyes W5 terminal static governance closure

**UNION_EYES_W5_STATIC_REMEDIATION = CLOSED_BLOCKED_TERMINAL_STATIC**

Human accepted the terminal conclusion on 2026-10-13. This is a successful governance closure
of an unsuccessful W5 qualification, not a paused task and not W5 PASS.
COMMAND is released to normal Nzila OS delivery operations. No further W5 engineering or W6 starts.

## Authoritative state

PHASE_1B_3C_A1I_W5B=BLOCKED_TERMINAL_STATIC; W5=BLOCKED_TERMINAL_STATIC;
W5_RUNTIME_EXECUTION=NOT_AUTHORIZED; W6=NOT_AUTHORIZED; CANONICAL_CONTRACT_VERSION=1.3.3;
STATIC_W5_REMEDIATION=EXHAUSTED.

## Preserved prospective membership decision

PROSPECTIVE_W4P_W5_MEMBERSHIP_COMPATIBILITY=COMPLETE_NOT_EXECUTED.
Organization identifiers are UUID. organization_members.organization_id is UUID NOT NULL with
the authenticated source FK semantics; member_documents.organization_id is UUID.
unique_org_membership=UNIQUE(organization_id,user_id).
E048_BYTES_CHANGED=NO; E048_UUID_TO_UUID_STATIC_COMPATIBILITY=PASS.
This isolated static compatibility proof is not full boundary or runtime qualification.

## Exact terminal blockers

| Relation | Source | W4P | Payload suffix |
| --- | --- | --- | --- |
| claims | nullable UUID | UUID NOT NULL | 77c77645b1c15c95 |
| grievances | nullable UUID | UUID NOT NULL | c60ebc8408c112e2 |
| security_events | nullable UUID | UUID NOT NULL | a3706a0a965fa035 |

Exactly seven unresolved operand sets: integration_configs, social_accounts, votes,
ml_predictions, cms_pages, model_metadata, donation_campaigns.
These blockers are OUTSIDE_AUTHORIZED_MEMBERSHIP_COMPATIBILITY_CHARTER; no repair or supersession.

## Census and proof ceiling

162 payloads: ABSENT114, MATCHING38, DRIFTED3, MISSING_PRECONDITIONS7.
THIS_IS_NOT_A_VERIFIED_W4P_CATALOG.
First prospective denial: payload116714fb92f94f71, missing cms_pages.slug; rollback=PASS.
Operational W5=0/106; total W5=0/107; boundaries=0/23; effects=0/762.
FRESH_REPLAY=NOT_RUN; REPLAY_NOOP=NOT_PROVEN; WHOLE_GRAPH_ROLLBACK=NOT_PROVEN.
Component evidence cannot replace whole-system proof.

## Recorded validation and immutable evidence

Replay7277passed; historical canonical-text acceptance=FAIL_EXPECTED_PRESERVED_CONTRADICTION.
This label describes the accepted historical failure, not an expected-failure runner conversion.
W5 governance211passed; W4 predecessors1104passed; W4FR4 237passed; G3 terminal116passed;
skipped tests in final recorded runs=0. Strict types, zero-warning lint, formatting,
deterministic generation and documentation validation passed in those recorded runs.
The [validation ledger](UE_W5_W4P_COMPATIBILITY_LOCAL_VALIDATION.json) retains exact commands.
The [preservation manifest](UE_W5_TERMINAL_STATIC_PRESERVATION.json) binds historical W4/W4FR4/W4P,
W5A/W5B/W5B-C/W5B-PK, compatibility supersession, ten-key assets, all23frozen source files,
the unchanged active failing test and G3 terminal closure.
127compatibility records,86handoffs,231edges,7deferred constraints and9downstream operands stay unchanged.
No historical packet is rewritten.

## Boundaries, reopening and scope

DATABASE_CONNECTIONS=0; DATABASE_SQL_EXECUTED=0; PRODUCTION_MUTATIONS=0.
LIVE_W4P_EXECUTION=NO; LIVE_COMPATIBILITY_OVERLAY_EXECUTION=NO;
LIVE_PARENT_KEY_SUPPLEMENT_EXECUTION=NO; LIVE_W5_EXECUTION=NO.
PR_CREATED=NO; MERGED=NO; DEPLOYED=NO; W6_STARTED=NO; G3_REOPENED=NO.
W5_REOPEN_REQUIRES=NEW_HUMAN_ARCHITECTURE_CHARTER: a new architecture mission addressing the
broader nullable-ID semantics and missing producer ownership, not another W5B compatibility iteration.
This disposition applies only to the W5 static bootstrap/replay qualification program;
it does not mark the Union Eyes product, application or assurance failed.
`
  return {
    [outputs.disposition]: await json(model.disposition),
    [outputs.preservation]: await json(model.preservation),
    [outputs.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
  }
}

export async function main(args: string[]) {
  assert(args.length && args.every((arg) => ['--write', '--check', '--self-test'].includes(arg)))
  assert(!(args.includes('--write') && args.includes('--check')))
  const first = await generateTerminalClosure()
  if (args.includes('--self-test')) assert.deepEqual(first, await generateTerminalClosure())
  for (const [file, bytes] of Object.entries(first)) {
    if (args.includes('--check'))
      assert.equal(read(file), bytes, `W5_TERMINAL_ARTIFACT_DRIFT:${file}`)
    else if (args.includes('--write')) writeFileSync(path.join(root, ...file.split('/')), bytes)
  }
  console.log(
    'W5 governance closure verified; CLOSED_BLOCKED_TERMINAL_STATIC; no runtime or engineering',
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
