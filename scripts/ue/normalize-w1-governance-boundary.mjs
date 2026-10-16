import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'

const root = fileURLToPath(new URL('../../', import.meta.url))
const folder = 'docs/union-eyes/reality-remediation/'
const names = {
  contract: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  specification: folder + 'PHASE_1B_3C_A1G_BOOTSTRAP_REMEDIATION_SPECIFICATION.md',
  w1: folder + 'PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.md',
  lock: 'apps/union-eyes/backend/requirements.lock',
  lockMetadata: 'apps/union-eyes/backend/requirements.lock.metadata.json',
  report: folder + 'PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json',
  reportMarkdown: folder + 'PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.md',
}
const absolute = (name) => path.join(root, ...name.split('/'))
const read = (name) => readFileSync(absolute(name), 'utf8')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const digest = (value) => sha(JSON.stringify(value))
const clone = (value) => structuredClone(value)
const prettierOptions = await resolveConfig(absolute(names.contract))
const json = (value) => format(JSON.stringify(value), { ...prettierOptions, parser: 'json' })
const lockSha = '310eb938f4f7c25b6f93323031981ede60a0d2ef2d68e017a5c9ced33e326fe6'
const graphSha = '73690369f0985a6d3fe33e1d72c66da9d864c0c590590c1628f75c33278e79f1'
const planSha = '447da85fbb379c41d4684ea6dda994c3dad7c98b6bce08d475d01d4bb9bd10e2'
const phase = 'PHASE_1B_3C_A1I_W1N'
const amendment = 'W1_COMPLETION_BOUNDARY_NORMALIZATION'
const technicalFields = [
  'metadata',
  'packageAuthority',
  'declaredDependencies',
  'lockedDistributions',
  'configuredApps',
  'migrationSources',
  'distributionMigrationSources',
  'migrationNodes',
  'migrationEdges',
  'rawOperationRegistry',
  'frozenSecurityManifest',
  'canonicalMigrationPlan',
  'swappableConfiguration',
  'dependencyConflicts',
  'digests',
  'validation',
  'reproducibility',
]
const completionGate = [
  'Exact hash-pinned dependency lock and Django 5.2.18 approved',
  'Exact external migration-contributor versions; all 25 configured apps reconciled',
  '29 local migrations and 26 literal local edges preserved',
  'Complete migration graph: zero unknown references, duplicate identities or cycles',
  'Deterministic canonical migration plan approved',
  'Raw operations inventoried, source/dependency signals preserved and downstream-owned',
  'W1-scoped package/migration/Python compatibility decision approved',
  'Physical schema materialization and native runtime validation are downstream duties, not W1 completion criteria',
]
const boundaries = {
  BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
  DJANGO_SCHEMA_MATERIALIZED: 'NO',
  FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
  PRODUCTION_SCHEMA_PROVEN: 'NO',
  RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
  TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
  READY_FOR_RUNTIME_PROOF: 0,
  PRODUCT_READY: 'NO',
  DEPLOYED_RUNTIME_ALIGNMENT_PROVEN: 'NO',
  NATIVE_RUNTIME_IMPORT_VALIDATION_PROVEN: 'NO',
  DATABASE_RUNTIME_PROVEN: 'NO',
  W1_RESOLUTION_REFERENCE_PATCH_IS_DEPLOYED_RUNTIME_PROOF: 'NO',
  PRODUCTION_PYTHON_PATCH_ALIGNMENT_PROVEN: 'NO',
}
const approval = {
  CANONICAL_UE_BACKEND_DEPENDENCY_LOCK: names.lock,
  CANONICAL_UE_BACKEND_LOCK_SHA256: lockSha,
  CANONICAL_DJANGO_VERSION: '5.2.18',
  CANONICAL_DJANGO_MIGRATION_GRAPH_SHA256: graphSha,
  CANONICAL_DJANGO_MIGRATION_PLAN_SHA256: planSha,
  CANONICAL_BOOTSTRAP_PYTHON_FAMILY: 'CPython 3.11',
  CANONICAL_BOOTSTRAP_PYTHON_ABI: 'cp311',
  CANONICAL_BOOTSTRAP_PLATFORM: 'Linux x86_64',
  W1_RESOLUTION_REFERENCE_PATCH: '3.11.14',
  W1_PACKAGE_IDENTITY_APPROVED: 'YES',
  W1_MIGRATION_GRAPH_IDENTITY_APPROVED: 'YES',
  W1_MIGRATION_PLAN_IDENTITY_APPROVED: 'YES',
  W1_BOOTSTRAP_PYTHON_COMPATIBILITY_TARGET_APPROVED: 'YES',
  NATIVE_LOCK_RUNTIME_VALIDATION: 'REQUIRED_BEFORE_FAITHFUL_REPLAY',
  NATIVE_LOCK_RUNTIME_VALIDATION_OWNER: 'W8',
  NATIVE_LOCK_RUNTIME_PROOF_OWNER: 'W9',
  DEPLOYMENT_RUNTIME_ALIGNMENT_OWNER: 'W8',
  DEPLOYMENT_RUNTIME_ALIGNMENT_PROOF_OWNER: 'W9',
  ...boundaries,
}

function rawValue(text, key) {
  const token = `"${key}":`
  const start = text.indexOf(token)
  assert(start >= 0, `Missing preserved field ${key}`)
  let pos = start + token.length
  while (/\s/.test(text[pos])) pos++
  const begin = pos
  assert(['[', '{'].includes(text[pos]), `${key} must be structured JSON`)
  let depth = 0
  let quoted = false
  let escaped = false
  for (; pos < text.length; pos++) {
    const char = text[pos]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '[' || char === '{') depth++
    else if (char === ']' || char === '}') {
      depth--
      if (depth === 0) return text.slice(begin, pos + 1)
    }
  }
  throw new Error(`Unterminated preserved field ${key}`)
}

function inverse(before, after, location = []) {
  if (digest(before) === digest(after)) return []
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    Array.isArray(before) === Array.isArray(after) &&
    (!Array.isArray(before) || before.length === after.length)
  ) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => {
      const exists = Object.hasOwn(before, key)
      if (!exists || !Object.hasOwn(after, key)) {
        return [
          { PATH: [...location, key], EXISTED: exists, ...(exists ? { VALUE: before[key] } : {}) },
        ]
      }
      return inverse(before[key], after[key], [...location, key])
    })
  }
  return [{ PATH: location, EXISTED: true, VALUE: before }]
}

function restore(value, patches) {
  const result = clone(value)
  for (const patch of patches) {
    const parent = patch.PATH.slice(0, -1).reduce((node, key) => node[key], result)
    const key = patch.PATH.at(-1)
    if (patch.EXISTED) parent[key] = clone(patch.VALUE)
    else delete parent[key]
  }
  return result
}

function exactIds(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label} count`)
  assert.equal(new Set(actual).size, actual.length, `${label} duplicates`)
  assert.deepEqual(new Set(actual), new Set(expected), `${label} IDs`)
}

function validateInput(contract, w1, lock) {
  assert.equal(contract.CONTRACT_VERSION, 1)
  assert.equal(sha(lock), lockSha)
  assert.equal(w1.digests.DJANGO_PACKAGE_LOCK_DIGEST, lockSha)
  assert.equal(w1.digests.DJANGO_MIGRATION_GRAPH_DIGEST, graphSha)
  assert.equal(w1.digests.DJANGO_MIGRATION_PLAN_DIGEST, planSha)
  assert.equal(w1.lockedDistributions.length, 87)
  assert.equal(w1.declaredDependencies.length, 27)
  assert.equal(w1.lockedDistributions.filter((p) => p.DIRECT).length, 27)
  assert.equal(w1.lockedDistributions.filter((p) => !p.DIRECT).length, 60)
  assert.equal(w1.lockedDistributions.find((p) => p.DISTRIBUTION === 'django')?.VERSION, '5.2.18')
  assert.equal(w1.validation.DJANGO_VERSION_LOCKED, '5.2.18')
  assert.equal(w1.configuredApps.length, 25)
  assert.equal(w1.migrationNodes.length, 82)
  assert.equal(w1.migrationNodes.filter((n) => n.SOURCE_CLASS === 'LOCAL').length, 29)
  assert.equal(w1.rawOperationRegistry.length, 16)
  const nodes = new Map(w1.migrationNodes.map((n) => [n.MIGRATION_ID, n]))
  assert.equal(nodes.size, 82)
  const order = new Map(w1.canonicalMigrationPlan.map((n) => [n.MIGRATION_ID, n.ORDER_INDEX]))
  exactIds([...order.keys()], [...nodes.keys()], 'Canonical plan')
  for (const edge of w1.migrationEdges) {
    assert.equal(edge.RESOLUTION, 'RESOLVED')
    assert(nodes.has(edge.FROM_MIGRATION) && nodes.has(edge.TO_MIGRATION))
    if (edge.EDGE_CLASS !== 'REPLACEMENT')
      assert(order.get(edge.TO_MIGRATION) < order.get(edge.FROM_MIGRATION))
  }
  assert.equal(w1.migrationEdges.filter((e) => e.EDGE_CLASS === 'DEPENDENCY').length, 81)
  assert.equal(w1.migrationEdges.filter((e) => e.EDGE_CLASS === 'SWAPPABLE_DEPENDENCY').length, 1)
  assert.equal(
    w1.migrationEdges.filter(
      (e) =>
        e.EDGE_CLASS === 'DEPENDENCY' && nodes.get(e.SOURCE_MIGRATION).SOURCE_CLASS === 'LOCAL',
    ).length,
    26,
  )
  for (const key of [
    'UNKNOWN_MIGRATION_REFERENCES',
    'DUPLICATE_MIGRATION_IDENTITIES',
    'GRAPH_CYCLES',
  ]) {
    assert.equal(w1.validation[key], 0)
  }
  assert.equal(contract.frozenMigrationManifest.length, 23)
  assert.deepEqual(w1.frozenSecurityManifest, contract.frozenMigrationManifest)
  for (const [records, key, universe, count] of [
    [contract.prerequisiteObligations, 'PREREQUISITE_ID', 'PREREQUISITES', 803],
    [contract.opaqueBindingObligations, 'OPAQUE_BINDING_ID', 'OPAQUE', 118],
    [contract.orderingObligations, 'ORDERING_RECORD_ID', 'ORDERING', 86],
  ]) {
    assert.equal(records.length, count)
    exactIds(
      records.map((r) => r[key]),
      w1.metadata.FROZEN_OBLIGATION_IDS[universe],
      universe,
    )
  }
  const work = contract.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W1')
  exactIds(
    w1.governanceObligationLinkage.OBLIGATIONS.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
    'W1 obligations',
  )
  exactIds(
    w1.governanceObligationLinkage.DECISIONS.map((o) => o.DECISION_ID),
    work.INPUT_DECISION_IDS,
    'W1 decisions',
  )
  assert.equal(work.INPUT_OBLIGATION_IDS.length, 400)
  assert.equal(work.INPUT_DECISION_IDS.length, 1)
  assert.equal(
    w1.governanceObligationLinkage.OBLIGATIONS.filter((o) => o.IMPLEMENTED_BY_W1 === 'YES').length,
    24,
  )
  assert(w1.governanceObligationLinkage.OBLIGATIONS.every((o) => o.RUNTIME_PROVEN === 'NO'))
  assert.equal(w1.phaseStatus.PHASE_1B_3C_A1I_W1_GATE, 'BLOCKED')
  assert.equal(w1.reproducibility.ALL_DIGESTS_MATCH, 'YES')
}

function normalize(contractInput, w1Input, priorContractSha) {
  const contract = clone(contractInput)
  const w1 = clone(w1Input)
  const physical = new Map(contract.prerequisiteObligations.map((o) => [o.OBLIGATION_ID, o]))
  const additional = new Map(
    contract.additionalContractObligations.map((o) => [o.OBLIGATION_ID, o]),
  )
  const work = contract.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W1')
  const localByLegacyId = new Map(
    w1.migrationNodes
      .filter((n) => n.SOURCE_CLASS === 'LOCAL')
      .map((n) => [`UE-1B3CA1D-DJANGO-MIGRATION-${sha(n.SOURCE_FILE).slice(0, 16)}`, n]),
  )
  exactIds(
    [...localByLegacyId.keys()],
    contract.djangoExecutionContract.FROZEN_LOCAL_MIGRATION_RECORD_IDS,
    'Legacy local migrations',
  )
  const rawOwnership = []
  const models = w1.governanceObligationLinkage.OBLIGATIONS.map((link) => {
    const prerequisite = physical.get(link.OBLIGATION_ID)
    const obligation = prerequisite ?? additional.get(link.OBLIGATION_ID)
    assert(obligation, `Missing contract obligation ${link.OBLIGATION_ID}`)
    let owner
    let evidence
    let relatedRaw = []
    if (prerequisite) {
      assert.equal(prerequisite.PRIMARY_DISPOSITION, 'DJANGO_BOOTSTRAP_OBLIGATION')
      assert.equal(prerequisite.CREATION_AUTHORITY, 'DJANGO')
      assert.equal(prerequisite.IMPLEMENTED, 'NO')
      owner = prerequisite.PRIMARY_OWNER_WORKSTREAM
      assert.equal(
        owner,
        'W4',
        'Only the frozen explicit earlier Django producer assignment is supported',
      )
      evidence =
        'Existing explicit W4 Django-owned producer assignment retained, not platform ownership; W8 composes the approved Django-first graph; W9 supplies runtime proof. Identity/plan approval is not a per-object coverage assertion.'
    } else if (link.IMPLEMENTED_BY_W1 === 'YES') {
      owner = 'W1'
      evidence =
        'Prior implemented dependency/package/migration identity obligation preserved; no physical database action is applicable to its W1 deliverable.'
    } else {
      const node = localByLegacyId.get(obligation.SUBJECT)
      assert(node, `No recorded migration binding for ${obligation.OBLIGATION_ID}`)
      relatedRaw = w1.rawOperationRegistry.filter((r) => r.MIGRATION_ID === node.MIGRATION_ID)
      assert(relatedRaw.length > 0)
      const owners = new Set(relatedRaw.map((r) => r.FUTURE_WORKSTREAM))
      assert([...owners].every((o) => ['W4', 'W5', 'W6', 'W8', 'GOVERNANCE_DECISION'].includes(o)))
      // Generated/raw semantic dependencies stay with their recorded W6 lane;
      // state/physical wrappers retain their separate recorded W4 responsibilities.
      owner = owners.has('W6') ? 'W6' : [...owners][0]
      assert(owners.size === 1 || (owners.size === 2 && owners.has('W4') && owners.has('W6')))
      evidence =
        'Existing raw registry FUTURE_WORKSTREAM mapping preserved per operation; primary owner closes raw/generated semantics, W4 retains state/physical wrapper duties, W8 composes and W9 proves replay.'
      rawOwnership.push({
        OBLIGATION_ID: link.OBLIGATION_ID,
        LEGACY_MIGRATION_ID: obligation.SUBJECT,
        MIGRATION_ID: node.MIGRATION_ID,
        PHYSICAL_IMPLEMENTATION_OWNER: owner,
        RAW_OPERATION_OWNERS: relatedRaw.map((r) => ({
          RAW_OPERATION_ID: r.RAW_OPERATION_ID,
          OPERATION_CLASS: r.OPERATION_CLASS,
          SOURCE_REFERENCE: r.SOURCE_REFERENCE,
          FUTURE_WORKSTREAM: r.FUTURE_WORKSTREAM,
        })),
        PHYSICALLY_IMPLEMENTED: 'NO',
        RUNTIME_PROVEN: 'NO',
      })
    }
    const model = {
      OBLIGATION_ID: link.OBLIGATION_ID,
      IDENTITY_OR_PLAN_ESTABLISHED_BY_W1: 'YES',
      W1_COMPLETION_CLASS:
        owner === 'W1' ? 'W1_COMPLETION_OBLIGATION' : 'DOWNSTREAM_DEPENDENT_OBLIGATION',
      PHYSICAL_IMPLEMENTATION_OWNER: owner,
      RUNTIME_PROOF_OWNER: 'W9',
      PHYSICALLY_IMPLEMENTED: 'NO',
      PHYSICAL_IMPLEMENTATION_APPLICABILITY:
        owner === 'W1' ? 'NOT_APPLICABLE_TO_IDENTITY_DELIVERABLE' : 'DOWNSTREAM',
      RUNTIME_PROVEN: 'NO',
      IMPLEMENTED_BY_W1: link.IMPLEMENTED_BY_W1,
      W1_RESPONSIBILITY_EVIDENCE: evidence,
      ...(prerequisite ? { COMPOSITION_OWNER: 'W8', CREATION_AUTHORITY: 'DJANGO' } : {}),
      ...(relatedRaw.length
        ? { RAW_OPERATION_IDS: relatedRaw.map((r) => r.RAW_OPERATION_ID) }
        : {}),
    }
    Object.assign(link, model)
    Object.assign(obligation, model)
    if (owner === 'W1') obligation.STATUS = 'W1_IDENTITY_IMPLEMENTED'
    return model
  })
  assert.equal(
    models.filter((o) => o.W1_COMPLETION_CLASS === 'W1_COMPLETION_OBLIGATION').length,
    24,
  )
  assert.equal(models.filter((o) => o.COMPOSITION_OWNER === 'W8').length, 372)
  assert.equal(rawOwnership.length, 4)
  const modelById = new Map(models.map((o) => [o.OBLIGATION_ID, o]))
  for (const record of contract.fullPrerequisiteGovernance) {
    const model = modelById.get(record.LINKED_PREREQUISITE_OBLIGATION_ID)
    if (model)
      Object.assign(record, {
        IDENTITY_OR_PLAN_ESTABLISHED_BY_W1: model.IDENTITY_OR_PLAN_ESTABLISHED_BY_W1,
        PHYSICAL_IMPLEMENTATION_OWNER: model.PHYSICAL_IMPLEMENTATION_OWNER,
        COMPOSITION_OWNER: 'W8',
        RUNTIME_PROOF_OWNER: 'W9',
        PHYSICALLY_IMPLEMENTED: 'NO',
        RUNTIME_PROVEN: 'NO',
      })
  }
  for (const link of w1.governanceObligationLinkage.DECISIONS) {
    const decision = contract.governanceDecisionObligations.find(
      (d) => d.DECISION_ID === link.DECISION_ID,
    )
    assert(decision)
    Object.assign(decision, {
      STATUS: 'APPROVED',
      EXECUTION_BLOCKED_UNTIL_RECORDED: 'NO',
      DECISION_ASSUMED: 'NO',
      APPROVAL_AUTHORITY:
        'Explicit maintainer W1N mission; dependency identity only, not deployment/runtime alignment',
      APPROVED_IDENTITY: approval,
      APPROVAL_RECORD: names.report,
    })
    Object.assign(link, {
      IMPLEMENTED_BY_W1: 'YES',
      IMPLEMENTATION_EVIDENCE:
        'Explicit W1N maintainer approval of package/graph/plan and CPython 3.11/cp311/Linux compatibility target; deployed patch alignment and native validation remain W8/W9 duties',
      RUNTIME_PROVEN: 'NO',
    })
  }
  const boundary = {
    W1_LINKED_OBLIGATIONS: 400,
    W1_COMPLETION_OBLIGATIONS: 24,
    W1_DOWNSTREAM_DEPENDENT_OBLIGATIONS: 376,
    SUM: 400,
    OBLIGATION_IDS_LOST: 0,
    OBLIGATION_IDS_DUPLICATED: 0,
    W1_IMPLEMENTED_OBLIGATIONS_FROM_PRIOR_RUN: 24,
    DJANGO_PHYSICAL_OBLIGATIONS: 372,
    RAW_GENERATED_DOWNSTREAM_OBLIGATIONS: 4,
    DOWNSTREAM_OBLIGATIONS_BLOCK_W1: 'NO',
    IDENTITY_APPROVAL_IS_PHYSICAL_OR_RUNTIME_PROOF: 'NO',
    OBLIGATIONS: models,
    RAW_OPERATION_OWNERSHIP: rawOwnership,
    COMPLETION_GATE: completionGate,
  }
  contract.CONTRACT_VERSION = '1.1'
  contract.amendment = {
    AMENDMENT: amendment,
    PHASE: phase,
    PRIOR_CONTRACT_VERSION: 1,
    PRIOR_CONTRACT_SHA256: priorContractSha,
    PRIOR_CONTRACT_REFERENCE: `${names.report}#PRIOR_GOVERNANCE_PATCHES.CONTRACT`,
    PRIOR_VERSION_RECONSTRUCTION:
      'Apply the recorded inverse patches in memory to reconstruct version 1; --check verifies its exact original SHA256',
    HISTORICAL_A1G_METADATA_SUMMARY_VALIDATION:
      'Retained unchanged as version 1 adoption evidence; current W1N state is in amendment/w1ObligationBoundary/phaseStatus',
    APPROVED_IDENTITY: approval,
  }
  contract.w1ObligationBoundary = boundary
  Object.assign(contract.djangoExecutionContract, {
    PACKAGE_LOCK_DIGEST: lockSha,
    MIGRATION_PLAN_DIGEST: planSha,
    MIGRATION_GRAPH_DIGEST: graphSha,
    W1_APPROVED_DEPENDENCY_IDENTITY: approval,
    EXPECTED_SCHEMA_DIGEST_OWNER: 'W8',
    EXPECTED_SCHEMA_DIGEST_REQUIRED_FOR_W1: 'NO',
  })
  work.COMPLETION_GATE = completionGate
  work.OUTPUT_ARTIFACTS = [
    'Exact dependency lock',
    'Complete migration graph digest',
    'Canonical migration-plan digest',
  ]
  work.DOWNSTREAM_OUTPUT_OBLIGATIONS = [
    'Expected operational schema digest: W8 before faithful replay; runtime proof W9',
  ]
  work.COMPLETION_OBLIGATION_IDS = models
    .filter((o) => o.PHYSICAL_IMPLEMENTATION_OWNER === 'W1')
    .map((o) => o.OBLIGATION_ID)
  work.DOWNSTREAM_DEPENDENT_OBLIGATION_IDS = models
    .filter((o) => o.PHYSICAL_IMPLEMENTATION_OWNER !== 'W1')
    .map((o) => o.OBLIGATION_ID)
  work.INPUT_OBLIGATION_SEMANTICS =
    'Referenced obligations, not all physically implemented by W1; exact 400 IDs retained'
  work.COMPLETION_STATUS = 'PASS'
  work.STARTED = 'YES'
  work.AUTHORIZATION_STATE = 'W1_IDENTITY_IMPLEMENTATION_COMPLETE'
  work.VALIDATION = [...work.VALIDATION.slice(0, 1), ...completionGate, work.VALIDATION.at(-1)]
  const w2 = contract.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W2')
  w2.AUTHORIZATION_STATE = 'AUTHORIZED_NOT_STARTED'
  assert.equal(w2.STARTED, 'NO')
  const w8 = contract.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W8')
  w8.DOWNSTREAM_W1_REQUIREMENTS = {
    DJANGO_PHYSICAL_COMPOSITION_OBLIGATION_IDS: models
      .filter((o) => o.COMPOSITION_OWNER === 'W8')
      .map((o) => o.OBLIGATION_ID),
    EXPECTED_SCHEMA_DIGEST: 'REQUIRED_BEFORE_FAITHFUL_REPLAY',
    NATIVE_LOCK_RUNTIME_VALIDATION: 'REQUIRED_BEFORE_FAITHFUL_REPLAY',
    DEPLOYMENT_RUNTIME_ALIGNMENT: 'REQUIRED_BEFORE_FAITHFUL_REPLAY',
    STARTED_BY_W1N: 'NO',
  }
  w1.governanceNormalization = {
    PHASE: phase,
    CONTRACT_VERSION: '1.1',
    APPROVED_IDENTITY: approval,
    ...boundary,
    HISTORICAL_VALIDATION_AND_CONFLICTS:
      'Preserved byte-for-byte from W1; prior 376 pending is downstream physical/raw work, not the current W1 completion count',
    CONFLICT_RESOLUTIONS: w1.dependencyConflicts.map((c) => ({
      DEPENDENCY_CONFLICT_ID: c.DEPENDENCY_CONFLICT_ID,
      RESOLUTION: 'CLOSED_BY_EXPLICIT_W1N_COMPLETION_BOUNDARY_AMENDMENT',
      RESOLUTION_RECORD: names.report,
      PHYSICAL_OR_RUNTIME_OBLIGATIONS_WAIVED: 'NO',
    })),
  }
  const states = {
    PHASE_1B_3C_A1I_W1N_GATE: 'PASS',
    PHASE_1B_3C_A1I_W1_GATE: 'PASS',
    PHASE_1B_3C_A1I_W1: 'PASS',
    EXACT_DJANGO_DEPENDENCY_LOCK: 'ESTABLISHED',
    COMPLETE_DJANGO_MIGRATION_GRAPH: 'ESTABLISHED',
    CANONICAL_DJANGO_MIGRATION_PLAN: 'ESTABLISHED',
    W1_IMPLEMENTATION_COMPLETE: 'YES',
    W2: 'AUTHORIZED_NOT_STARTED',
    PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH_CONTRACT: 'AUTHORIZED_NOT_STARTED',
    W2_STARTED: 'NO',
    ...boundaries,
  }
  Object.assign(w1.phaseStatus, states)
  Object.assign(contract.phaseStatus, states, {
    PHASE_1B_3C_A1I_STARTED: 'YES',
    PHASE_1B_3C_A1I_BOOTSTRAP_CONTRACT_IMPLEMENTATION:
      'W1_IDENTITY_COMPLETE_DOWNSTREAM_IMPLEMENTATION_PENDING',
  })
  for (const previous of contractInput.remediationWorkstreams) {
    const current = contract.remediationWorkstreams.find(
      (w) => w.WORKSTREAM_ID === previous.WORKSTREAM_ID,
    )
    assert.deepEqual(current.DEPENDS_ON, previous.DEPENDS_ON)
    assert.deepEqual(current.INPUT_OBLIGATION_IDS, previous.INPUT_OBLIGATION_IDS)
    assert.deepEqual(current.INPUT_DECISION_IDS, previous.INPUT_DECISION_IDS)
    if (!['W1', 'W2'].includes(current.WORKSTREAM_ID)) assert.equal(current.STARTED, 'NO')
  }
  return { contract, w1, boundary }
}

function replaceOnce(text, before, after) {
  assert.equal(
    text.split(before).length,
    2,
    `Expected one documentation anchor: ${before.slice(0, 80)}`,
  )
  return text.replace(before, after)
}

function documents(specification, markdown) {
  specification = replaceOnce(specification, 'version: 1\n', 'version: 1.1\n')
  specification = replaceOnce(
    specification,
    'It does not implement W1-W10.',
    'Version 1.1 records W1 dependency-identity completion under the explicit W1N amendment; it does not implement physical bootstrap or W2-W10.',
  )
  specification = replaceOnce(
    specification,
    '- **CON-003**: A1I implementation is authorized but not started. W9/W10 require separate runtime authorization; A1R/A2/B3C-B are not authorized.',
    '- **CON-003**: W1 dependency identity is implemented and approved; W2 is AUTHORIZED_NOT_STARTED. No W2-W10 execution occurs in W1N. W9/W10 require separate runtime authorization; A1R/A2/B3C-B are not authorized.',
  )
  specification = replaceOnce(
    specification,
    '### Implementation Phase 1\n',
    `### Implementation Phase 1\n\nVersion 1.1 amendment: **W1_COMPLETION_BOUNDARY_NORMALIZATION**. All 400 W1-linked IDs remain referenced: 24 W1 identity-completion obligations and 376 downstream-dependent obligations. All 24 previously implemented W1 obligations remain implemented. The 372 physical obligations retain their existing explicit **W4 Django-owned producer** assignment (not platform-owned domain DDL), with W8 composition and W9 runtime proof. Four raw/generated obligations retain per-operation W4/W6 mappings from the accepted raw registry. Native locked-runtime validation, deployment alignment and expected schema digest are W8 requirements before faithful replay; W9 supplies runtime proof.\n\nThe approved target is CPython 3.11 / cp311 / Linux x86_64 with resolution reference patch 3.11.14, not proof of the deployed Python patch. See [W1N amendment and preservation proof](PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.md). The original version 1 contract digest and exact inverse reconstruction record are retained there. The unchanged canonical-contract Markdown is the historical A1G doctrine view; the amended JSON and this version 1.1 specification govern the current W1 boundary.\n`,
  )
  const line = specification.split('\n').find((row) => row.startsWith('| TASK-001 |'))
  assert(line)
  specification = replaceOnce(
    specification,
    line,
    '| TASK-001 | Preserve all 400 referenced INPUT_OBLIGATION_IDS and the approved INPUT_DECISION_IDS. W1 completion covers only exact package/Django/external contributor identity, 25 configured apps, 29 local migrations/26 literal edges, closed 82-node graph, deterministic plan and raw-operation inventory/downstream ownership. Physical schema materialization and expected operational schema digest are downstream duties, not W1 gates. No package/configuration changes in W1N. | Yes (dependency identity only) | 2026-10-10 |',
  )
  const w2Line = specification.split('\n').find((row) => row.startsWith('| TASK-002 |'))
  assert(w2Line)
  specification = replaceOnce(
    specification,
    w2Line,
    replaceOnce(
      w2Line,
      'Authorization: A1I_AUTHORIZED_NOT_STARTED; no execution in A1G.',
      'Authorization: AUTHORIZED_NOT_STARTED under W1N; W2 not started.',
    ),
  )
  markdown = replaceOnce(
    markdown,
    '## Gate: BLOCKED',
    '## Gate: PASS — W1 dependency identity only',
  )
  markdown = replaceOnce(
    markdown,
    "Package/graph identity is implemented locally; W1's full completion condition is not met. Locking cannot implement the full physical prerequisite obligations assigned to W1, and their exact ownership/materialization/raw-dependency evidence remains pending. No obligation is promoted merely from a deterministic graph.",
    'The explicit W1N maintainer amendment approves the unchanged package/graph/plan identity and separates W1 completion from downstream physical/runtime work. W1 is PASS; bootstrap implementation and runtime proof remain NO. The original BLOCKED gate and its governance-boundary conflict are preserved in the W1N inverse history, historical validation and unchanged dependencyConflicts register.',
  )
  markdown = replaceOnce(
    markdown,
    '## W1 linkage and exact decision packet',
    '## Normalized W1 linkage and approved identity',
  )
  markdown = replaceOnce(
    markdown,
    'All contract W1 obligation and decision IDs are represented exactly once. Implemented linkage: 24; pending: 376. The 372 full physical Django materialization obligations remain NO; dependency identity is only a sub-obligation. Raw dependencies are inventoried but not materialized or semantically proven.',
    'All 400 W1-linked obligation IDs remain represented exactly once: 24 W1 completion obligations and 376 downstream-dependent obligations. The prior 24 implemented obligations are unchanged. All 372 Django physical obligations have identity/plan established but remain physically unimplemented and runtime-unproven; their existing explicit W4 Django producer assignment is retained, W8 composes and W9 proves. Four raw/generated obligations are downstream-owned using the unchanged raw registry, with per-operation W4/W6 duties preserved.',
  )
  markdown = replaceOnce(
    markdown,
    'Required next decision: approve a narrowly defined W1 dependency-lock/graph completion-boundary amendment for physical and raw obligations, retaining their W4/materialization/runtime evidence requirements. Approve the exact candidate runtime/package/config identity; do not mark physical prerequisites implemented, mutate the frozen contract silently, or claim runtime proof. Any blocked exact graph references must additionally be resolved from package/config authority.',
    'Decision approved by the explicit W1N mission: exact lock, graph, plan and CPython 3.11/cp311/Linux x86_64 compatibility target. Reference patch 3.11.14 is not deployed runtime proof. Contract version 1.1 records W1_COMPLETION_BOUNDARY_NORMALIZATION and the original version 1 digest. Native locked-runtime validation, deployment alignment and expected schema digest remain W8 requirements before faithful replay, with W9 proof. See [W1N preservation and exact ownership report](PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.md).',
  )
  markdown = replaceOnce(
    markdown,
    'Governance contract and predecessor hashes and all 23 frozen migration hashes remain unchanged.',
    'The preceding W1 run preserved governance/predecessor hashes and all 23 frozen migration hashes. W1N explicitly amends prospective contract governance only; all accepted W1 technical JSON fields and lock bytes remain unchanged. Frozen manifest hashes are compared within the permitted artifacts, not rescanned from source.',
  )
  markdown = replaceOnce(
    markdown,
    '## Reproduction commands',
    '## Historical W1 reproduction commands — not executed or authorized by W1N',
  )
  markdown = replaceOnce(
    markdown,
    'W1 = BLOCKED; W2 = NOT_AUTHORIZED and not started.',
    'W1 = PASS (dependency identity only); W1N = PASS; W2 = AUTHORIZED_NOT_STARTED and not started.',
  )
  return { specification, markdown }
}

function reportMarkdown(report) {
  const raw = report.NORMALIZED_OBLIGATION_MODEL.RAW_OPERATION_OWNERSHIP.map(
    (o) =>
      `| ${o.OBLIGATION_ID} | ${o.MIGRATION_ID} | ${o.PHYSICAL_IMPLEMENTATION_OWNER} | ${[...new Set(o.RAW_OPERATION_OWNERS.map((r) => r.FUTURE_WORKSTREAM))].join(', ')} |`,
  ).join('\n')
  return `# W1N — governance-boundary normalization\n\n## Gate: PASS — dependency identity only\n\n[Contract JSON](UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json) version **1.1** explicitly records **${amendment}**. Prior version 1 SHA256: \`${report.PRIOR_CONTRACT_SHA256}\`. The [machine-readable report](PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json) retains exact inverse governance patches; the generator reconstructs and checks the original contract/W1 bytes in memory. Original A1G metadata, summary and validation remain historical adoption evidence, not current completion counts.\n\n## Preservation\n\nAll accepted W1 technical fields, including validation and dependencyConflicts, are byte-for-byte unchanged. Lock and lock metadata bytes are unchanged. The report records before/after SHA256 for each preserved JSON value and semantic SHA256; no package resolution, index access, download, install, source rescan, database/migration/runtime operation or configuration/schema/RLS/deployment change occurs in W1N. The unchanged 23-file hash manifest is compared within fixed artifacts; source files are not opened.\n\n87 distributions = 27 direct + 60 transitive; Django 5.2.18; 25 apps; 82 migrations = 29 local + 53 external; 81 dependency edges + one swappable edge; 26 local literal edges; 16 raw records; zero unknown references, duplicate identities or cycles. The 803/118/86 governance universes, consumer/provider references, Django-first doctrine, organizations authority, distinct financial scope and W1-W10 dependency ordering are preserved.\n\n## Approved identity\n\n- Lock: [requirements.lock](../../../apps/union-eyes/backend/requirements.lock), SHA256 \`${lockSha}\`.\n- Migration graph SHA256: \`${graphSha}\`.\n- Canonical plan SHA256: \`${planSha}\`.\n- Bootstrap compatibility: CPython 3.11 / cp311 / Linux x86_64; resolution reference patch **3.11.14**.\n- Package, migration graph, migration plan and bootstrap Python compatibility target: **APPROVED** by the explicit W1N maintainer mission.\n- Deployed Python patch alignment, native imports and database runtime: **not proven**.\n\n## Normalized 400-obligation model\n\n| Class | Count | W1 identity/plan | Physical implementation | Runtime proof |\n|---|---:|---|---|---|\n| W1 completion | 24 | YES; prior implementation preserved | NO; not applicable to identity deliverables | NO |\n| Django physical downstream | 372 | YES; not per-object coverage proof | NO; existing explicit W4 Django producer assignment | NO; W9 |\n| Raw/generated downstream | 4 | YES; inventory and owners established | NO; existing W4/W6 raw mapping | NO; W9 |\n| Total | 400 | Exact IDs retained, none lost/duplicated | No physical obligation upgraded | No runtime upgrade |\n\nThe 372 obligations already have an explicit earlier W4 implementation owner in version 1. That allowed exception is retained as **Django-owned production**, never platform-owned domain DDL. W8 composes the governed Django-first replay and W9 proves it. No object is claimed materialized. The four raw/generated primary owners follow recorded raw semantic duties; every state/physical wrapper's separate FUTURE_WORKSTREAM is preserved below and in the exact JSON mapping.\n\n| Obligation ID | Migration | Primary downstream owner | Recorded operation owners |\n|---|---|---|---|\n${raw}\n\nThe unchanged historical governance-boundary conflict is closed by the explicit amendment in governanceNormalization.CONFLICT_RESOLUTIONS, not deleted or relabeled as a resolver failure. All W1 decision IDs are retained and approved for dependency identity only.\n\n## Downstream validation and proof boundaries\n\nNative locked-runtime validation, deployment-image/runtime alignment and expected operational schema digest are **W8 requirements before faithful replay**; W9 supplies runtime proof. No native runtime validation was performed or retroactively required for W1 completion.\n\nBOOTSTRAP_IMPLEMENTATION_COMPLETE = NO; DJANGO_SCHEMA_MATERIALIZED = NO; FAITHFUL_SCHEMA_REPLAY_PROVEN = NO; PRODUCTION_SCHEMA_PROVEN = NO; RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN = NO; TENANT_ISOLATION_RUNTIME_PROVEN = NO; READY_FOR_RUNTIME_PROOF = 0; PRODUCT_READY = NO.\n\nW1N = PASS; W1 = PASS; W1_IMPLEMENTATION_COMPLETE = YES **only for dependency identity**. W2 database target/search-path contract = AUTHORIZED_NOT_STARTED; W2_STARTED = NO. W3-W10, A1R, A2 and B3C-B are not started. W9/W10 continue to require separate runtime authorization.\n\n## Reproduction and validation\n\nOnly fixed accepted artifacts are inputs. No predecessor or application source is scanned. The check restores the original governance in memory, validates its historical digests, regenerates twice and compares every output and every preserved technical value. Run:\n\n\`\`\`powershell\nnode --check scripts\\ue\\normalize-w1-governance-boundary.mjs\nnode scripts\\ue\\normalize-w1-governance-boundary.mjs --self-test\nnode scripts\\ue\\normalize-w1-governance-boundary.mjs --check\npnpm validate:docs\n\`\`\`\n\nScoped Prettier and independent preservation/exact-ID assertions are run at closeout. This report's validation concerns normalization only; unchanged W1 validation describes the accepted preceding technical run.\n`
}

async function build(inputs) {
  const contractInput = JSON.parse(inputs.contract)
  const w1Input = JSON.parse(inputs.w1)
  validateInput(contractInput, w1Input, inputs.lock)
  const { contract, w1, boundary } = normalize(contractInput, w1Input, sha(inputs.contract))
  const contractText = await json(contract)
  const w1Text = await json(w1)
  const preservation = Object.fromEntries(
    technicalFields.map((key) => {
      const before = rawValue(inputs.w1, key)
      const after = rawValue(w1Text, key)
      assert.equal(after, before, `Technical bytes changed: ${key}`)
      return [
        key,
        {
          BEFORE_SHA256: sha(before),
          AFTER_SHA256: sha(after),
          SEMANTIC_SHA256: digest(w1[key]),
          CHANGED: 'NO',
        },
      ]
    }),
  )
  for (const key of [
    'CONTRACT_DOCTRINE',
    'layers',
    'ORGANIZATIONS_AUTHORITY',
    'ORGANIZATIONS_OPERATIONAL_SCHEMA_OWNER',
    'FINANCIAL_DATABASE_SCOPE',
    'financialMaterializerSpecification',
    'opaqueBindingObligations',
    'orderingObligations',
    'frozenMigrationManifest',
    'predecessorEvidence',
    'metadata',
    'summary',
    'validation',
  ]) {
    assert.deepEqual(contract[key], contractInput[key], `Forbidden contract change: ${key}`)
  }
  const report = {
    PHASE: phase,
    AMENDMENT: amendment,
    CONTRACT_VERSION: '1.1',
    PRIOR_CONTRACT_SHA256: sha(inputs.contract),
    PRIOR_W1_JSON_SHA256: sha(inputs.w1),
    PRIOR_SPECIFICATION_SHA256: sha(inputs.specification),
    PRIOR_W1_MARKDOWN_SHA256: sha(inputs.markdown),
    PRIOR_GOVERNANCE_PATCHES: {
      CONTRACT: inverse(contractInput, contract),
      W1: inverse(w1Input, w1),
    },
    PRIOR_MARKDOWN: { SPECIFICATION: inputs.specification, W1: inputs.markdown },
    PRESERVATION: {
      FILES: {
        [names.lock]: {
          BEFORE_SHA256: sha(inputs.lock),
          AFTER_SHA256: sha(read(names.lock)),
          CHANGED: 'NO',
        },
        [names.lockMetadata]: {
          BEFORE_SHA256: sha(inputs.lockMetadata),
          AFTER_SHA256: sha(read(names.lockMetadata)),
          CHANGED: 'NO',
        },
      },
      W1_TECHNICAL_FIELDS: preservation,
      DEPENDENCY_LOCK_CHANGED: 'NO',
      PACKAGE_IDENTITY_CHANGED: 'NO',
      CONFIGURED_APP_MODEL_CHANGED: 'NO',
      MIGRATION_GRAPH_CHANGED: 'NO',
      MIGRATION_PLAN_CHANGED: 'NO',
      RAW_OPERATION_EVIDENCE_CHANGED: 'NO',
      GOVERNANCE_UNIVERSES: {
        PREREQUISITES: {
          COUNT: 803,
          BEFORE_SHA256: digest(
            contractInput.prerequisiteObligations.map((o) => o.PREREQUISITE_ID),
          ),
          AFTER_SHA256: digest(contract.prerequisiteObligations.map((o) => o.PREREQUISITE_ID)),
        },
        OPAQUE: {
          COUNT: 118,
          BEFORE_SHA256: digest(contractInput.opaqueBindingObligations),
          AFTER_SHA256: digest(contract.opaqueBindingObligations),
        },
        ORDERING: {
          COUNT: 86,
          BEFORE_SHA256: digest(contractInput.orderingObligations),
          AFTER_SHA256: digest(contract.orderingObligations),
        },
        FROZEN_MANIFEST: {
          COUNT: 23,
          BEFORE_SHA256: digest(contractInput.frozenMigrationManifest),
          AFTER_SHA256: digest(contract.frozenMigrationManifest),
          SOURCE_RESCAN: 'NO',
        },
      },
      WORKSTREAM_ORDERING_BEFORE_SHA256: digest(
        contractInput.remediationWorkstreams.map((w) => [w.WORKSTREAM_ID, w.DEPENDS_ON]),
      ),
      WORKSTREAM_ORDERING_AFTER_SHA256: digest(
        contract.remediationWorkstreams.map((w) => [w.WORKSTREAM_ID, w.DEPENDS_ON]),
      ),
    },
    APPROVED_IDENTITY: approval,
    NORMALIZED_OBLIGATION_MODEL: boundary,
    HISTORICAL_W1_METADATA_VALIDATION_CONFLICTS_RETAINED:
      'YES; historical frozen input hashes refer to version 1, not amended contract bytes',
    IO_BOUNDARY: {
      INPUTS: Object.values(names).slice(0, 6),
      PACKAGE_RESOLUTION: 'NO',
      PACKAGE_INDEX_ACCESS: 'NO',
      PACKAGE_DOWNLOAD: 'NO',
      PACKAGE_INSTALLATION: 'NO',
      SOURCE_RESCAN: 'NO',
      DATABASE_ACCESS: 'NO',
      MIGRATION_EXECUTION: 'NO',
      NATIVE_RUNTIME_EXECUTION: 'NO',
      CONFIGURATION_CHANGE: 'NO',
      SCHEMA_RLS_DEPLOYMENT_CHANGE: 'NO',
    },
    phaseStatus: w1.phaseStatus,
  }
  for (const file of Object.values(report.PRESERVATION.FILES))
    assert.equal(file.BEFORE_SHA256, file.AFTER_SHA256)
  const docs = documents(inputs.specification, inputs.markdown)
  return {
    [names.contract]: contractText,
    [names.w1]: w1Text,
    [names.specification]: await format(docs.specification, {
      ...prettierOptions,
      parser: 'markdown',
    }),
    [names.markdown]: await format(docs.markdown, { ...prettierOptions, parser: 'markdown' }),
    [names.report]: await json(report),
    [names.reportMarkdown]: await format(reportMarkdown(report), {
      ...prettierOptions,
      parser: 'markdown',
    }),
  }
}

async function loadInputs() {
  const inputs = Object.fromEntries(
    ['contract', 'w1', 'specification', 'markdown', 'lock', 'lockMetadata'].map((key) => [
      key,
      read(names[key]),
    ]),
  )
  if (existsSync(absolute(names.report))) {
    const previous = JSON.parse(read(names.report))
    inputs.contract = await json(
      restore(JSON.parse(inputs.contract), previous.PRIOR_GOVERNANCE_PATCHES.CONTRACT),
    )
    inputs.w1 = await json(restore(JSON.parse(inputs.w1), previous.PRIOR_GOVERNANCE_PATCHES.W1))
    inputs.specification = previous.PRIOR_MARKDOWN.SPECIFICATION
    inputs.markdown = previous.PRIOR_MARKDOWN.W1
    for (const [key, expected] of [
      ['contract', previous.PRIOR_CONTRACT_SHA256],
      ['w1', previous.PRIOR_W1_JSON_SHA256],
      ['specification', previous.PRIOR_SPECIFICATION_SHA256],
      ['markdown', previous.PRIOR_W1_MARKDOWN_SHA256],
    ])
      assert.equal(sha(inputs[key]), expected, `Historical ${key} reconstruction changed`)
    for (const key of ['lock', 'lockMetadata'])
      assert.equal(sha(inputs[key]), previous.PRESERVATION.FILES[names[key]].BEFORE_SHA256)
  }
  return inputs
}

async function main() {
  const args = process.argv.slice(2)
  assert(
    args.every((arg) => ['--check', '--self-test'].includes(arg)),
    'Unknown argument',
  )
  const inputs = await loadInputs()
  const first = await build(inputs)
  assert.deepEqual(first, await build(inputs), 'Nondeterministic normalization')
  if (args.includes('--self-test')) {
    const before = { preserved: [1], changed: { state: 'NO' } }
    const after = { preserved: [1], changed: { state: 'YES', owner: 'W8' }, added: '1.1' }
    assert.deepEqual(restore(after, inverse(before, after)), before)
    assert.equal(
      rawValue('{"a":[{"s":"escaped\\\\\\" ]"}],"b":{}}', 'a'),
      '[{"s":"escaped\\\\\\" ]"}]',
    )
    assert.throws(() => exactIds(['a', 'a'], ['a', 'b'], 'Synthetic'))
    const altered = {
      ...inputs,
      w1: inputs.w1.replace(
        '"DJANGO_VERSION_LOCKED": "5.2.18"',
        '"DJANGO_VERSION_LOCKED": "5.2.17"',
      ),
    }
    await assert.rejects(build(altered))
    console.log(
      'PASS: inverse history, JSON-byte preservation, duplicate rejection and altered evidence rejection',
    )
  }
  if (args.includes('--check')) {
    for (const [name, text] of Object.entries(first))
      assert.equal(read(name), text, `Stale normalization output: ${name}`)
    console.log(
      'PASS: deterministic W1N check; exact historical reconstruction and preserved technical bytes',
    )
  } else if (!args.includes('--self-test')) {
    for (const [name, text] of Object.entries(first)) writeFileSync(absolute(name), text)
    console.log(
      'PASS: W1N version 1.1 normalization; 24 W1 completion + 376 downstream obligations; W2 authorized, not started',
    )
  }
}

await main()
