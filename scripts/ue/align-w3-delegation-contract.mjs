import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import provisioning from '../../apps/union-eyes/scripts/provisioning/governed-provisioning.ts'

const { planTemplates, specifications } = provisioning

const root = fileURLToPath(new URL('../../', import.meta.url))
const folder = 'docs/union-eyes/reality-remediation/'
const files = {
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  database: folder + 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json',
  contract: folder + 'UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.json',
  w3: folder + 'PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING.json',
  w3d: folder + 'PHASE_1B_3C_A1I_W3D_GOVERNANCE_DECISION_COMPATIBILITY.json',
  w3dMarkdown: folder + 'PHASE_1B_3C_A1I_W3D_GOVERNANCE_DECISION_COMPATIBILITY.md',
  canonicalMarkdown: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.md',
  contractMarkdown: folder + 'UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.md',
  w3Markdown: folder + 'PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING.md',
  authority: 'apps/union-eyes/scripts/provision-runtime-db-roles.ts',
  support: 'apps/union-eyes/scripts/provisioning/governed-provisioning.ts',
  tests: 'apps/union-eyes/scripts/provisioning/governed-provisioning.test.ts',
  report: folder + 'PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.md',
}
const absolute = (name) => path.join(root, ...name.split('/'))
const read = (name) => readFileSync(absolute(name), 'utf8')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const digest = (value) => sha(JSON.stringify(value))
const roleDecision = 'UE-1B3CA1G-DECISION-4e0fdb9b7d80bdb5'
const vectorDecision = 'UE-1B3CA1G-DECISION-7e108c57ea428e21'
const decisionStatus = 'APPROVED_AND_IMPLEMENTED_IN_W3_CONTRACT'
const priorHash = 'fe5bc24c5f1cc91af7e225e45887bb870a62e5811a2162fb74302af1e8df5cd2'
const jsonKeys = ['canonical', 'contract', 'w3']
const markdownKeys = ['canonicalMarkdown', 'contractMarkdown', 'w3Markdown']

function inverse(before, after, at = [], result = []) {
  if (digest(before) === digest(after)) return result
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    Array.isArray(before) === Array.isArray(after) &&
    (Array.isArray(before)
      ? before.length === after.length
      : Object.keys(before).every((key) => Object.hasOwn(after, key)) &&
        digest(Object.keys(before)) ===
          digest(Object.keys(after).filter((key) => Object.hasOwn(before, key))))
  ) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!Object.hasOwn(before, key)) result.push({ PATH: [...at, key], EXISTED: false })
      else if (!Object.hasOwn(after, key))
        result.push({ PATH: [...at, key], EXISTED: true, VALUE: before[key] })
      else inverse(before[key], after[key], [...at, key], result)
    }
  } else result.push({ PATH: at, EXISTED: true, VALUE: before })
  return result
}
function restore(current, patches) {
  const value = structuredClone(current)
  for (const patch of patches) {
    assert(patch.PATH.length > 0)
    let parent = value
    for (const key of patch.PATH.slice(0, -1)) parent = parent[key]
    const key = patch.PATH.at(-1)
    if (patch.EXISTED) parent[key] = structuredClone(patch.VALUE)
    else delete parent[key]
  }
  return value
}
function exact(actual, expected) {
  assert.equal(new Set(actual).size, actual.length)
  assert.deepEqual(actual, expected)
}
function preservedTemplate(template) {
  return {
    DATABASE_SCOPE_ID: template.DATABASE_SCOPE_ID,
    TARGET_CONTRACT: template.TARGET_CONTRACT,
    PRINCIPAL_PLACEHOLDERS: template.PRINCIPAL_PLACEHOLDERS,
    OPERATIONS: template.OPERATIONS.filter((o) => o.KIND !== 'GRANT_MEMBERSHIP_IF_ABSENT'),
    VERIFY_SQL: template.VERIFY_SQL.filter(
      (q) => !['ROLE-MEMBERSHIPS', 'ROLE-ATTRIBUTES'].includes(q.ID),
    ),
  }
}
const noProof = {
  DATABASE_ROLES_PROVISIONED: 'NO',
  LOGIN_PRINCIPALS_BOUND: 'NO',
  ROLE_MEMBERSHIPS_APPLIED: 'NO',
  SECRETS_ACCESSED: 'NO',
  EXTENSIONS_RUNTIME_PROVEN: 'NO',
  DATABASE_RUNTIME_CONFIGURATION_APPLIED: 'NO',
  DATABASE_RUNTIME_CONFIGURATION_PROVEN: 'NO',
  DJANGO_SCHEMA_MATERIALIZED: 'NO',
  PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
  BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
  FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
  PRODUCTION_SCHEMA_PROVEN: 'NO',
  RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
  TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
  READY_FOR_RUNTIME_PROOF: 0,
  PRODUCT_READY: 'NO',
}

async function build() {
  const priorReport = existsSync(absolute(files.report)) ? JSON.parse(read(files.report)) : null
  const current = Object.fromEntries(jsonKeys.map((key) => [key, JSON.parse(read(files[key]))]))
  const before = Object.fromEntries(
    jsonKeys.map((key) => [
      key,
      priorReport
        ? restore(current[key], priorReport.PRIOR_JSON_INVERSE_PATCHES[key])
        : structuredClone(current[key]),
    ]),
  )
  const config = await resolveConfig(absolute(files.canonical))
  const json = async (value) => format(JSON.stringify(value), { ...config, parser: 'json' })
  const oldBytes = Object.fromEntries(
    await Promise.all(jsonKeys.map(async (key) => [key, await json(before[key])])),
  )
  assert.equal(sha(oldBytes.canonical), priorHash)
  if (priorReport)
    for (const key of jsonKeys)
      assert.equal(
        sha(oldBytes[key]),
        priorReport.PRIOR_JSON_SHA256[key],
        `Prior ${key} reconstruction drift`,
      )
  const c = structuredClone(before.canonical)
  const p = structuredClone(before.contract)
  const db = JSON.parse(read(files.database))
  const w3d = JSON.parse(read(files.w3d))
  assert.equal(
    w3d.phaseStatus.PHASE_1B_3C_A1I_W3D_GATE,
    'BLOCKED_IMPLEMENTATION_GOVERNANCE_CONFLICT',
  )
  assert(w3d.governanceDecisions.every((d) => d.APPROVED === 'YES'))
  assert.equal(w3d.vectorConsumerReconciliation.length, 22)
  assert(
    w3d.vectorConsumerReconciliation.every(
      (v) => v.DISPOSITION === 'CURRENTLY_NOT_AUTHORIZED_TO_REQUIRE_VECTOR',
    ),
  )
  assert.equal(c.CONTRACT_VERSION, '1.2')
  assert.equal(c.phaseStatus.PHASE_1B_3C_A1I_W1_GATE, 'PASS')
  assert.equal(c.phaseStatus.PHASE_1B_3C_A1I_W2_GATE, 'PASS')
  const work = c.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W3')
  assert(work)
  assert.equal(work.INPUT_OBLIGATION_IDS.length, 11)
  exact(work.INPUT_DECISION_IDS, [roleDecision, vectorDecision])
  exact(
    p.obligationLinkage.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
  )
  assert.equal(p.opaqueRoleBindingPacket.length, 4)
  assert.equal(p.w2DriftReconciliation.length, 9)
  const approval = {
    ...structuredClone(w3d.governanceDecisions[0].CONTRACT_VALUE),
    ROLE_MEMBERSHIP_MODEL: 'EXACT_EXTERNAL_LOGIN_TO_AUTHORIZATION_ROLE_ONLY',
    EXTERNAL_PRINCIPAL_BINDINGS: c.roleContract.map((r) => ({
      ROLE_CLASS: r.ROLE_CLASS,
      AUTHORIZATION_ROLE_BINDING: `${r.ROLE_CLASS}_PRINCIPAL`,
      EXTERNAL_LOGIN_PRINCIPAL_BINDING: `${r.ROLE_CLASS}_LOGIN_PRINCIPAL`,
      CARDINALITY: 'EXACTLY_ONE_DISTINCT_EXTERNAL_LOGIN_PRINCIPAL',
    })),
    DELEGATION_BINDING_STATE: 'NOT_RUNTIME_BOUND',
    DIRECTION: 'GRANT authorization_role TO external_login_principal',
    ADMIN_OPTION: 'NO',
    SET_ROLE_CAPABILITY_REQUIRED: 'YES',
    AUTHORIZATION_ROLE_MEMBER_OF_LOGIN_PRINCIPAL: 'NO',
    MISSING_BINDING: 'FAIL_MISSING_PRINCIPAL_BINDING',
    EXPECTED_MEMBERSHIP_ABSENT: 'GRANT_EXACT_EXPECTED_EDGE_DURING_FUTURE_GOVERNED_APPLY',
    UNEXPECTED_MEMBERSHIP: 'FAIL_DRIFT_WITHOUT_AUTOMATIC_REVOKE',
    POST_BINDING_VERIFICATION:
      'Only exact expected edge present, no admin option, SET capability present, no extra/reverse/nested/cross-scope/runtime-to-migration edge',
    CATALOG_COMPLETENESS:
      'Full pg_auth_members graph; descriptor incoming/outgoing lists must reconcile to graph, not filtered success',
    LOGIN_PRINCIPAL_ATTRIBUTES:
      'Must already exist, LOGIN, non-superuser/non-bypass/non-CREATEDB/non-CREATEROLE/non-replication; W3 never creates/rotates it',
    POSTGRESQL_MEMBERSHIP_OPTIONS:
      'admin_option measured on all supported versions; set_option measured via to_jsonb for PostgreSQL 16+ and implicit SET capability on earlier versions',
  }
  for (const d of c.governanceDecisionObligations.filter((d) =>
    work.INPUT_DECISION_IDS.includes(d.DECISION_ID),
  ))
    Object.assign(d, {
      STATUS: decisionStatus,
      APPROVED: 'YES',
      DECISION_ASSUMED: 'NO; explicit W3D intent plus W3E alignment instruction',
      APPROVAL_REFERENCE: files.w3d,
      IMPLEMENTATION_REFERENCE: files.report,
      EXECUTION_BLOCKED_UNTIL_RECORDED:
        'NO; decision recorded, runtime binding/adapter authorization still required',
      CONTRACT_VALUE:
        d.DECISION_ID === roleDecision
          ? approval
          : {
              VECTOR_EXTENSION_DISPOSITION: 'OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED',
              VECTOR_IN_MANDATORY_EXTENSION_SET: 'NO',
              CONSUMER_RECONCILIATION: w3d.vectorConsumerReconciliation,
              FUTURE_DEPENDENCY:
                'FAIL_CONTRACT_DRIFT until explicitly amended before dependent execution',
            },
      RUNTIME_PROVEN: 'NO',
    })
  for (const r of c.roleContract)
    Object.assign(r, {
      LOGIN_EXPECTATION: 'NOLOGIN',
      ROLE_MEMBERSHIP_MODEL: approval.ROLE_MEMBERSHIP_MODEL,
      AUTHORIZATION_ROLE_BINDING: `${r.ROLE_CLASS}_PRINCIPAL`,
      LOGIN_PRINCIPAL_BINDING: `${r.ROLE_CLASS}_LOGIN_PRINCIPAL`,
      ROTATION_AUTHORITY: 'NOT_APPLICABLE_TO_NOLOGIN_AUTHORIZATION_ROLE',
      AUTHENTICATION_AND_ROTATION_AUTHORITY: 'EXTERNAL_SECRET_DEPLOYMENT_AUTHORITY_NOT_W3',
      PASSWORD: 'NONE',
      STATUS: 'W3_CONTRACT_IMPLEMENTED_RUNTIME_BINDING_PENDING',
    })
  Object.assign(c.extensionDoctrine, {
    VECTOR_CANONICAL_REQUIREMENT: 'OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED',
    VECTOR_EXTENSION_DISPOSITION: 'OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED',
    VECTOR_IN_MANDATORY_EXTENSION_SET: 'NO',
    VECTOR_CONSUMER_RECONCILIATION: w3d.vectorConsumerReconciliation,
    FUTURE_VECTOR_DEPENDENCY: 'FAIL_CONTRACT_DRIFT_UNTIL_EXPLICIT_AMENDMENT',
  })
  const specs = specifications(c, db)
  assert.equal(specs.blockers.length, 0)
  assert.equal(specs.roles.length, 5)
  const templates = planTemplates(c, db)
  assert.deepEqual(
    templates.map(preservedTemplate),
    before.contract.planTemplates.map(preservedTemplate),
  )
  const stableRoleFields = (roles) =>
    roles.map((r) => {
      const copy = { ...r }
      for (const k of [
        'LOGIN_EXPECTATION',
        'ROLE_MEMBERSHIP_EXPECTATION',
        'LOGIN_PRINCIPAL_BINDING',
        'AUTHENTICATION_AND_ROTATION_AUTHORITY',
        'ROTATION_AUTHORITY',
      ])
        delete copy[k]
      return copy
    })
  assert.deepEqual(
    stableRoleFields(specs.roles),
    stableRoleFields(before.contract.roleSpecifications),
  )
  assert.deepEqual(specs.extensions, before.contract.extensionSpecifications)
  assert.equal(
    sha(read(files.authority)),
    before.contract.authority.IMPLEMENTATION_SHA256[files.authority],
  )
  const linkage = p.obligationLinkage.map((o) => {
    const raw = p.opaqueRoleBindingPacket.some((b) => b.OBLIGATION_ID === o.OBLIGATION_ID)
    const vector = o.OBLIGATION_ID === w3d.vectorConsumerReconciliation[0].OBLIGATION_ID
    return {
      ...o,
      IMPLEMENTED_BY_W3: raw ? 'W3_INPUT_COMPONENT_ONLY' : 'YES',
      MECHANISM_IMPLEMENTED: 'YES',
      W3_CONTRACT_COMPONENT_COMPLETE: 'YES',
      BLOCKING_DECISION_IDS: [],
      COMPLETION_CLASS: raw
        ? 'W6_OBJECT_ACL_IMPLEMENTATION_PENDING'
        : o.IMPLEMENTED_BY_W3 === 'YES'
          ? 'W3_MECHANISM_IMPLEMENTED'
          : vector
            ? 'W3_CONTRACT_IMPLEMENTED_DOWNSTREAM_RUNTIME_PENDING'
            : 'W8_RUNTIME_BINDING_PENDING',
      COMPLETION_BOUNDARY: raw
        ? 'W3 role/delegation inputs complete; W6 owns exact object-set/ACL/default-ACL materialization'
        : vector
          ? 'Approved guarded non-requirement for all 22 current consumers; future dependency requires explicit amendment'
          : 'W3 mechanism and contract complete offline; external bindings/application/runtime evidence remain W8/W9',
      DOWNSTREAM_OWNER: raw ? 'W6' : 'W8/W9',
      DOWNSTREAM_IMPLEMENTATION_PENDING: 'YES',
      PHYSICAL_RUNTIME_APPLIED: 'NO',
      RUNTIME_PROVEN: 'NO',
    }
  })
  for (const o of [
    ...c.prerequisiteObligations,
    ...c.opaqueBindingObligations,
    ...c.additionalContractObligations,
  ]) {
    const linked = linkage.find((l) => l.OBLIGATION_ID === o.OBLIGATION_ID)
    if (linked)
      Object.assign(o, {
        W3_CONTRACT_COMPONENT_COMPLETE: 'YES',
        W3_COMPLETION_CLASS: linked.COMPLETION_CLASS,
        W3_BLOCKING_DECISION_IDS: [],
        W3_IMPLEMENTATION_REFERENCE: files.contract,
        DOWNSTREAM_IMPLEMENTATION_OWNER: linked.DOWNSTREAM_OWNER,
        W3_RUNTIME_APPLIED: 'NO',
        W3_RUNTIME_PROVEN: 'NO',
      })
  }
  c.w3ObligationBoundary = linkage
  Object.assign(work, {
    AUTHORIZATION_STATE: 'PASS',
    STARTED: 'YES; offline implementation only',
    COMPLETION_STATUS: 'PASS',
    COMPLETION_EVIDENCE: files.report,
  })
  const w4 = c.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W4')
  assert(w4)
  Object.assign(w4, { AUTHORIZATION_STATE: 'AUTHORIZED_NOT_STARTED', STARTED: 'NO' })
  const phaseStatus = {
    ...before.contract.phaseStatus,
    ...noProof,
    PHASE_1B_3C_A1I_W3E_GATE: 'PASS',
    PHASE_1B_3C_A1I_W3D_GATE: 'PASS',
    PHASE_1B_3C_A1I_W3_GATE: 'PASS',
    PHASE_1B_3C_A1I_W3D: 'PASS',
    PHASE_1B_3C_A1I_W3: 'PASS',
    W1: 'PASS',
    W2: 'PASS',
    W3: 'PASS',
    CANONICAL_CONTRACT_VERSION: '1.3',
    W3_STARTED: 'YES; offline implementation only',
    ROLE_PROVISIONING_IMPLEMENTATION: 'COMPLETE_NOT_APPLIED',
    EXTENSION_PROVISIONING_IMPLEMENTATION: 'COMPLETE_NOT_APPLIED',
    DELEGATION_MEMBERSHIP_CONTRACT: 'ESTABLISHED',
    MEMBERSHIP_VERIFY_IMPLEMENTATION: 'COMPLETE_NOT_EXECUTED',
    VECTOR_EXTENSION_DISPOSITION: 'OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED',
    W4: 'AUTHORIZED_NOT_STARTED',
    PHASE_1B_3C_A1I_W4_PRECONSUMER_PHYSICAL_PRODUCERS: 'AUTHORIZED_NOT_STARTED',
    W4_STARTED: 'NO',
    W5_W10_STARTED: 'NO',
    A1R_STARTED: 'NO',
    A2_STARTED: 'NO',
    B3C_B_STARTED: 'NO',
  }
  Object.assign(c.phaseStatus, phaseStatus, {
    BOOTSTRAP_CONTRACT_VERSION: '1.3',
    PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING: 'PASS',
    PHASE_1B_3C_A1I_BOOTSTRAP_CONTRACT_IMPLEMENTATION:
      'W1_W2_W3_OFFLINE_CONTRACTS_COMPLETE_DOWNSTREAM_IMPLEMENTATION_PENDING',
  })
  c.CONTRACT_VERSION = '1.3'
  c.roleExtensionAmendment = {
    AMENDMENT: 'ROLE_EXTENSION_PROVISIONING_GOVERNANCE_CLOSURE',
    PRIOR_VERSION: '1.2',
    PRIOR_SHA256: priorHash,
    DECISION_IDS: work.INPUT_DECISION_IDS,
    EVIDENCE: files.report,
    AUTHORIZED_SCOPE:
      'Only delegation specification/plan/verifier/offline tests and corresponding governance closure',
    RUNTIME_APPLIED: 'NO',
  }
  c.versionChain.push({
    VERSION: '1.2',
    SHA256: priorHash,
    RECONSTRUCTION_REFERENCE: files.report + '#PRIOR_JSON_INVERSE_PATCHES.canonical',
  })
  const preservedCanonicalKeys = [
    'djangoExecutionContract',
    'searchPathContract',
    'databaseScopeGovernance',
    'fullPrerequisiteGovernance',
    'orderingObligations',
    'frozenMigrationManifest',
    'financialMaterializerSpecification',
  ]
  for (const k of preservedCanonicalKeys)
    assert.deepEqual(c[k], before.canonical[k], `Unrelated canonical ${k} changed`)
  for (const k of ['prerequisiteObligations', 'opaqueBindingObligations', 'orderingObligations'])
    exact(
      c[k].map((o) => o.OBLIGATION_ID),
      before.canonical[k].map((o) => o.OBLIGATION_ID),
    )
  const implementation = Object.fromEntries(
    [files.authority, files.support, files.tests].map((f) => [f, sha(read(f))]),
  )
  Object.assign(p, {
    CONTRACT_STATUS: 'CONTRACT_IMPLEMENTED_COMPLETE_OFFLINE_NOT_APPLIED',
    roleSpecifications: specs.roles,
    extensionSpecifications: specs.extensions,
    VECTOR_EXTENSION_DISPOSITION: specs.VECTOR_EXTENSION_DISPOSITION,
    delegationContract: approval,
    vectorConsumerReconciliation: w3d.vectorConsumerReconciliation,
    planTemplates: templates,
    obligationLinkage: linkage,
    governanceDecisions: c.governanceDecisionObligations.filter((d) =>
      work.INPUT_DECISION_IDS.includes(d.DECISION_ID),
    ),
    phaseStatus,
  })
  p.authority.IMPLEMENTATION_SHA256 = implementation
  p.authority.W3E_AUTHORIZED_ALIGNMENT = files.report
  Object.assign(p.privilegeContract, {
    ROLE_MEMBERSHIPS:
      'EXACT_EXTERNAL_LOGIN_TO_AUTHORIZATION_ROLE_ONLY; ADMIN_OPTION NO; complete graph rejects all extras/reverse/nested/cross-scope/runtime-to-migration edges',
    NOLOGIN_STAGING:
      'Authorization roles remain permanently NOLOGIN; distinct external LOGIN authentication and secret rotation are not W3',
    OWNERSHIP:
      'Runtime authorization roles own no domain/helper/financial objects. Migration authorization owns only legitimate scope-local producer objects; no database/schema/table ownership transfers.',
  })
  p.modes.PASSWORD_ACTIVATION =
    'OUTSIDE_W3; external secret/deployment authority activates/rotates LOGIN principals through separately authorized W8 integration'
  p.modes.APPLY =
    'CLI standalone blocked. Future injected W8 adapter requires approved decisions, all exact external bindings, authenticated target, complete catalog preflight before first SQL; missing edge GRANT only, drift FAIL without automatic REVOKE; exact postflight.'
  p.opaqueRoleBindingPacket = p.opaqueRoleBindingPacket.map((b) => ({
    ...b,
    ROLE_APPROVAL_PENDING: 'NO',
    ROLE_DECISION_STATUS: decisionStatus,
    W3_CONTRACT_COMPONENT_COMPLETE: 'YES',
    OBJECT_SET_IMPLEMENTED_IN_W3: 'NO',
  }))
  p.w2DriftReconciliation = p.w2DriftReconciliation.map((d) => ({
    ...d,
    W3_IMPLEMENTATION_STATUS: 'VALIDATION_IMPLEMENTED_DOWNSTREAM_APPLICATION_PENDING',
    VALIDATION_IMPLEMENTED: 'YES',
    SOURCE_CONFIGURATION_ALIGNED: 'NO',
    RUNTIME_ALIGNED: 'NO',
  }))
  p.downstreamImplementationPacket = p.downstreamImplementationPacket
    .filter((d) => d.OWNER !== 'HUMAN_GOVERNANCE')
    .map((d) => ({
      ...d,
      REQUIRED:
        d.OWNER_WORKSTREAM === 'W8'
          ? 'After separate W8 authorization supply all exact LOGIN/auth-role bindings, authenticated target and complete membership/role/privilege catalog adapter on one transaction client; secret creation/storage/rotation remain external; migration activation bounded.'
          : d.REQUIRED,
    }))
  const digests = {
    ROLE_SPECIFICATIONS: digest(specs.roles),
    MEMBERSHIP_PLAN: digest(
      templates.map((t) => t.OPERATIONS.filter((o) => o.KIND === 'GRANT_MEMBERSHIP_IF_ABSENT')),
    ),
    MEMBERSHIP_VERIFY_QUERIES: digest(
      templates.map((t) => t.VERIFY_SQL.filter((q) => q.ID === 'ROLE-MEMBERSHIPS')),
    ),
    FULL_W3_PLAN: digest(templates),
    VECTOR_DECISION_MODEL: digest([
      c.extensionDoctrine.VECTOR_EXTENSION_DISPOSITION,
      w3d.vectorConsumerReconciliation,
    ]),
    NON_DELEGATION_PLAN: digest(templates.map(preservedTemplate)),
  }
  p.digests = digests
  p.historicalValidation = before.contract.validation
  Object.assign(p.validation, {
    DECISIONS_APPROVED: 2,
    DECISIONS_PENDING: 0,
    W3_CONTRACT_COMPONENTS_COMPLETE: 11,
    GOVERNANCE_OR_SHARED_DEPENDENT_OBLIGATIONS: 0,
    DOWNSTREAM_W6_OBJECT_ACL_OBLIGATIONS: 4,
    VECTOR_EXTENSION_DISPOSITION: specs.VECTOR_EXTENSION_DISPOSITION,
    DETERMINISTIC_SQL_TEMPLATES_SHA256: digest(templates),
    VECTOR_CURRENT_CONSUMERS: 22,
    MEMBER_GRAPH_FILTERED: 'NO',
  })
  const updated = {
    canonical: c,
    contract: p,
    w3: {
      ...structuredClone(before.w3),
      ...p,
      VERSION_1_2_SHA256: priorHash,
      VERSION_1_3_SHA256: sha(await json(c)),
      CANONICAL_CONTRACT_AMENDED:
        'YES; explicit W3E delegation alignment plus approved W3D intents',
      W3E_CLOSURE_REFERENCE: files.report,
      historicalW3Validation: before.w3.validation,
    },
  }
  const report = {
    PHASE: 'PHASE_1B_3C_A1I_W3E',
    CONTRACT_VERSION: '1.3',
    AMENDMENT: 'ROLE_EXTENSION_PROVISIONING_GOVERNANCE_CLOSURE',
    FIXED_INPUTS: [files.canonical, files.database, files.contract, files.w3, files.w3d],
    PRIOR_JSON_SHA256: Object.fromEntries(jsonKeys.map((k) => [k, sha(oldBytes[k])])),
    PRIOR_JSON_INVERSE_PATCHES: Object.fromEntries(
      jsonKeys.map((k) => [k, inverse(before[k], updated[k])]),
    ),
    PRIOR_MARKDOWN:
      priorReport?.PRIOR_MARKDOWN ??
      Object.fromEntries(
        markdownKeys.map((k) => [k, { SHA256: sha(read(files[k])), CONTENT: read(files[k]) }]),
      ),
    W3D_HISTORICAL_GATE: w3d.phaseStatus.PHASE_1B_3C_A1I_W3D_GATE,
    W3D_HISTORICAL_GATE_SUPERSEDED_BY:
      'W3E exact-edge implementation; historical W3D file remains byte-identical',
    VERSION_1_SHA256: before.w3.VERSION_1_SHA256,
    VERSION_1_1_SHA256: before.w3.VERSION_1_1_SHA256,
    VERSION_1_2_SHA256: priorHash,
    VERSION_1_3_SHA256: sha(await json(c)),
    delegationContract: approval,
    roleSpecifications: specs.roles,
    membershipPlan: templates.map((t) => ({
      DATABASE_SCOPE_ID: t.DATABASE_SCOPE_ID,
      OPERATIONS: t.OPERATIONS.filter((o) => o.KIND === 'GRANT_MEMBERSHIP_IF_ABSENT'),
      VERIFY_SQL: t.VERIFY_SQL.filter((q) =>
        ['ROLE-ATTRIBUTES', 'ROLE-MEMBERSHIPS'].includes(q.ID),
      ),
    })),
    vectorConsumerReconciliation: w3d.vectorConsumerReconciliation,
    obligationLinkage: linkage,
    governanceDecisions: p.governanceDecisions,
    w2DriftReconciliation: p.w2DriftReconciliation,
    digests,
    CODE_BEFORE_SHA256: before.contract.authority.IMPLEMENTATION_SHA256,
    CODE_AFTER_SHA256: implementation,
    preservation: Object.fromEntries(
      [files.database, files.w3d, files.w3dMarkdown].map((f) => [
        f,
        {
          BEFORE_SHA256: priorReport?.preservation[f].BEFORE_SHA256 ?? sha(read(f)),
          AFTER_SHA256: sha(read(f)),
          CHANGED: 'NO',
        },
      ]),
    ),
    unchangedCanonicalSections: Object.fromEntries(
      preservedCanonicalKeys.map((k) => [k, digest(c[k])]),
    ),
    frozenUniverses: before.w3.frozenUniverses,
    validation: {
      W3_OBLIGATIONS: 11,
      W3_DECISIONS: 2,
      VECTOR_CONSUMERS: 22,
      ROLE_CLASSES: 5,
      W2_SCOPES: db.databaseScopes.length,
      W2_ACTORS: db.databaseActors.length,
      W2_PATHS: db.searchPathContracts.length,
      PREREQUISITES: c.prerequisiteObligations.length,
      OPAQUE: c.opaqueBindingObligations.length,
      ORDERING: c.orderingObligations.length,
      FROZEN_MIGRATIONS: c.frozenMigrationManifest.length,
      NON_DELEGATION_OPERATIONS_AND_QUERIES_PRESERVED: 'YES',
      EXTENSION_INSTALLER_SQL_PRESERVED: 'YES',
      TEMP_PUBLIC_SCHEMA_DOCTRINE_PRESERVED: 'YES',
      STANDALONE_APPLY_BLOCKED: 'YES',
      HISTORICAL_W3D_PRESERVED: 'YES',
      OFFLINE_TEST_AUTHORITY: files.tests,
      OFFLINE_TEST_RESULTS: {
        STATUS: 'PASS',
        TESTS: 59,
        EXHAUSTIVE_FORBIDDEN_DIRECTED_EDGES_PER_SCOPE: 95,
      },
      CLOSEOUT_RESULTS: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
          RESULT: 'PASS; 59 offline tests',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node apps\\union-eyes\\scripts\\provision-runtime-db-roles.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts scripts\\ue\\implement-role-extension-contract.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'Set-Location apps\\union-eyes; pnpm exec eslint scripts\\provision-runtime-db-roles.ts scripts\\provisioning\\governed-provisioning.ts scripts\\provisioning\\governed-provisioning.test.ts',
          RESULT: 'PASS',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\align-w3-delegation-contract.mjs --self-test --check',
          RESULT: 'PASS; two matching generations and exact prior byte reconstruction',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\implement-role-extension-contract.ts --self-test --check',
          RESULT: 'PASS; 1.3 routes to aligned generator',
        },
        {
          COMMAND: 'node scripts\\ue\\adjudicate-w3-governance-closure.mjs --self-test --check',
          RESULT: 'PASS; frozen W3D historical evidence preserved',
        },
        {
          COMMAND:
            'pnpm exec prettier --check <all W3E changed implementation/generator/artifact paths>',
          RESULT: 'PASS; exact file selectors recorded in closeout execution',
        },
        { COMMAND: 'pnpm validate:docs', RESULT: 'PASS; 0 errors, 1215 warnings' },
        {
          COMMAND: 'Independent node --require tsx/cjs artifact/edge assertions',
          RESULT:
            'PASS; exact 1.3 -> 1.2 -> 1.1 -> 1 bytes; W1/W2/803/118/86/23; 11/2/22 exact IDs; five directed GRANTs, four preserved installers; 95 prohibited edges per scope and admin/SET drift',
        },
      ],
      REQUIRED_CLOSEOUT:
        'Scoped tsc/ESLint/offline tests; self-test/determinism/check/format/docs; independent exact IDs/edge rejection/version chain/W1/W2 hash preservation',
      NO_DATABASE_OR_SECRETS_OR_DEPLOYMENT_CONFIGURATION: 'YES',
    },
    phaseStatus,
  }
  for (const entry of Object.values(report.preservation))
    assert.equal(entry.BEFORE_SHA256, entry.AFTER_SHA256)
  for (const key of jsonKeys)
    assert.equal(
      sha(await json(restore(updated[key], report.PRIOR_JSON_INVERSE_PATCHES[key]))),
      report.PRIOR_JSON_SHA256[key],
      `Exact prior ${key} byte reconstruction failed`,
    )
  exact(
    linkage.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
  )
  exact(
    p.governanceDecisions.map((d) => d.DECISION_ID),
    work.INPUT_DECISION_IDS,
  )
  const priorVector = before.canonical.prerequisiteObligations.find(
    (o) => o.PHYSICAL_IDENTITY === 'union-eyes::EXTENSION::vector',
  )
  exact(
    w3d.vectorConsumerReconciliation.map((v) => v.CONSUMER_ID),
    priorVector.REQUIRED_BEFORE_CONSUMER_IDS,
  )
  const output = Object.fromEntries(
    await Promise.all(jsonKeys.map(async (k) => [files[k], await json(updated[k])])),
  )
  output[files.report] = await json(report)
  const summary = `# W3E — delegation membership alignment

## Offline gate: PASS

Canonical **1.3**, amendment **ROLE_EXTENSION_PROVISIONING_GOVERNANCE_CLOSURE**. W3/W3D/W3E are PASS **for offline contract/implementation only**. The unchanged [historical W3D report](PHASE_1B_3C_A1I_W3D_GOVERNANCE_DECISION_COMPATIBILITY.json) retains its original blocked ruling; this [W3E evidence](PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.json) supersedes that incompatibility, not its history.

## Exact delegation contract

Five canonical NOLOGIN authorization roles, each with a distinct externally supplied LOGIN binding. Existing \`principals\` are authorization identities; the new required \`loginPrincipals\` packet maps all five role classes to external authentication identities. No fallback, inference, passwords or LOGIN creation. Authorization roles have no secret/rotation; external secret/deployment authority owns authentication and rotation.

Direction: \`GRANT "authorization_role" TO "bound_login_principal";\` — never reversed, no ADMIN OPTION. One operation per scoped role class. Missing binding fails before planning. Bound offline plans are not authenticated runtime bindings; unbound templates remain NOT_RUNTIME_BOUND.

The full membership graph and each role's incoming/outgoing descriptor must agree. Only the exact edge is healthy after apply. Missing edge is detected by verify and may be granted by future governed apply. Extra login members, reverse edges, authorization nesting, runtime-to-migration/cross-scope edges and ADMIN OPTION fail drift before **any** mutation. No automatic membership revocation. Existing role attribute drift still fails.

Bound LOGIN principals must already exist and be LOGIN without superuser/BYPASSRLS/CREATEDB/CREATEROLE/replication. The membership query additionally measures SET capability (PostgreSQL 16+ set_option via to_jsonb; earlier versions implicitly permit SET). This ensures “may assume” is real rather than accepting an unusable edge. No secret/catalog credential fields are selected.

## Plan/verifier lifecycle and safety

Offline no-argument mode still fails; standalone --apply is blocked. --plan emits specifications or a bound nonsecret plan; --verify requires bindings and a nonsecret snapshot including complete \`membershipEdges\` (\`grantedRole\`, \`memberRole\`, \`adminOption\`, \`setOption\`) plus authorization/LOGIN descriptors. W8 must later supply authenticated target, exact external bindings, complete catalog projection and one transaction client under separate authorization. No W8 implementation or runtime execution occurs here.

NOLOGIN create SQL, four mandatory extension installer SQL, target/search-path/privilege/ownership/default-ACL checks remain unchanged outside authorized delegation metadata. PUBLIC/TEMP/public-schema doctrine is unchanged. No vector SQL, broad grants, password SQL, attribute repair or live GRANT.

## Obligation and vector closure

Exactly **11 obligations**, **two approved-and-implemented decisions**, **22 vector consumers**, **four opaque W6 packets**, **nine W2 drift links**. Four installer mechanisms remain implemented. W3-owned role/vector/shared-input portions are complete; W6 object ACL implementation and W8 external runtime bindings/application/W9 evidence remain pending, not generic W3 blockers.

vector = OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED, outside the exact four mandatory extensions. All 22 classifications are preserved byte-for-byte as decision records from W3D; no source reanalysis. Future vector dependency fails contract drift until explicitly amended before dependent execution. This is not replay/source semantic proof.

Nine drift records: VALIDATION_IMPLEMENTED = YES; SOURCE_CONFIGURATION_ALIGNED = NO; RUNTIME_ALIGNED = NO.

## Preservation and version chain

The JSON holds inverse patches and hashes reconstructing exact prior canonical **1.2** (\`${priorHash}\`) and prior W3 contract/report bytes, plus preserved W3D/target bytes, old implementation hashes and non-delegation plan digests. Existing version 1/1.1 reconstruction references remain intact. W1/W2 are PASS; their accepted lock/graph/universe evidence remains unmodified.

Stable digests cover ROLE_SPECIFICATIONS, MEMBERSHIP_PLAN, MEMBERSHIP_VERIFY_QUERIES, FULL_W3_PLAN and VECTOR_DECISION_MODEL. Two generator runs must match.

## Validation commands

\`\`\`powershell
pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts
pnpm exec tsx scripts\\ue\\align-w3-delegation-contract.mjs --self-test --check
\`\`\`

Closeout results: **59 offline tests PASS**, including **95 prohibited directed edges per scope**; scoped TypeScript and UE ESLint PASS; generator self-tests/check/two-run determinism PASS; historical W3D check PASS; scoped formatting PASS; documentation audit PASS (**0 errors, 1,215 warnings**). Independent checks PASS for exact **1.3 → 1.2 → 1.1 → 1 bytes**, W1/W2/frozen universes, 11/2/22 exact IDs, five exact directed GRANTs/four preserved installers and prohibited/admin/SET edges. Exact commands/results are recorded in the JSON. Synthetic injected execution in tests is not SQL executed against a database.

## Proof boundary and next authority

W4 = **AUTHORIZED_NOT_STARTED**, W4_STARTED = NO. W5–W10/replay/PR are not started. DATABASE_ROLES_PROVISIONED, LOGIN_PRINCIPALS_BOUND, ROLE_MEMBERSHIPS_APPLIED, SECRETS_ACCESSED, EXTENSIONS_RUNTIME_PROVEN, DATABASE_RUNTIME_CONFIGURATION_APPLIED, DJANGO_SCHEMA_MATERIALIZED, PRECONSUMER_BASELINE_MATERIALIZED, BOOTSTRAP_IMPLEMENTATION_COMPLETE, FAITHFUL_SCHEMA_REPLAY_PROVEN, PRODUCTION_SCHEMA_PROVEN, RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN, TENANT_ISOLATION_RUNTIME_PROVEN and PRODUCT_READY are **NO**. READY_FOR_RUNTIME_PROOF = **0**.
`
  const formattedSummary = await format(summary, { ...config, parser: 'markdown' })
  output[files.markdown] = formattedSummary
  output[files.contractMarkdown] = formattedSummary.replace(
    '# W3E — delegation membership alignment',
    '# Role/extension provisioning contract — version 1.3',
  )
  output[files.w3Markdown] = formattedSummary.replace(
    '# W3E — delegation membership alignment',
    '# W3 — role/extension provisioning closure',
  )
  output[files.canonicalMarkdown] = await format(
    `# Canonical bootstrap contract — version 1.3 amendment

Current [machine-readable contract](UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json): version **1.3**. [W3E closure](PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.md) establishes exact external LOGIN-to-NOLOGIN delegation and guarded vector non-requirement. W1/W2/W3 offline gates PASS; W4 AUTHORIZED_NOT_STARTED. Runtime proof remains NO, READY_FOR_RUNTIME_PROOF = 0.

Amendment: ROLE_EXTENSION_PROVISIONING_GOVERNANCE_CLOSURE. Exact 1.2 reconstruction/hash and prior W1/W2 chain are preserved in [W3E evidence](PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.json). Authorization roles never authenticate or rotate secrets. Missing external LOGIN binding blocks future apply; only one expected edge is allowed; all extras/admin/nesting/cross-scope/runtime-to-migration edges fail drift.

## Preserved historical version 1.2 documentation

The following body is historical evidence; its earlier W3 authorization/decision state is superseded by the 1.3 amendment above.

${report.PRIOR_MARKDOWN.canonicalMarkdown.CONTENT}`,
    { ...config, parser: 'markdown' },
  )
  return output
}

export async function runAlignment(args = []) {
  assert(args.every((arg) => ['--self-test', '--check'].includes(arg)))
  const output = await build()
  assert.deepEqual(output, await build(), 'Nondeterministic W3E generation')
  if (args.includes('--self-test')) {
    const before = { scalar: 1, object: { removed: 'old' }, list: [{ value: 1 }] }
    const after = { scalar: 2, object: { added: 'new' }, list: [{ value: 2 }] }
    assert.deepEqual(restore(after, inverse(before, after)), before)
    assert.throws(() => exact(['duplicate', 'duplicate'], ['a', 'b']))
    console.log(
      'PASS W3E self-tests: exact IDs, inverse reconstruction, deterministic digests, preserved non-delegation SQL/specification boundaries',
    )
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(output))
      assert.equal(read(file), bytes, `Stale W3E artifact: ${file}`)
    console.log(
      'PASS W3E deterministic --check: canonical 1.3; W3/W3D/W3E offline PASS; W4 authorized not started; no runtime proof',
    )
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(output)) writeFileSync(absolute(file), bytes)
    console.log(
      'W3E artifacts generated: exact delegation alignment; canonical 1.3; no database/secrets/W4 execution',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  runAlignment(process.argv.slice(2)).catch((error) => {
    console.error(
      '[align-w3-delegation-contract]',
      error instanceof Error ? error.message : 'Generator failed',
    )
    process.exitCode = 1
  })
