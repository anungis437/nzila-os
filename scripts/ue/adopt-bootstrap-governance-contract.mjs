import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const script = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(script), '..', '..')
const base = 'docs/union-eyes/reality-remediation/'
const contractName = 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT'
const planName = 'PHASE_1B_3C_A1G_BOOTSTRAP_REMEDIATION_SPECIFICATION'
const absolute = (file) => path.resolve(root, ...file.split('/'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const digest = (value) => hash(JSON.stringify(value))
const id = (kind, key) => `UE-1B3CA1G-${kind}-${hash(key).slice(0, 16)}`
const unique = (values) => [...new Set(values)].sort()
const count = (rows, key, values) =>
  Object.fromEntries(
    values.map((value) => [value, rows.filter((row) => row[key] === value).length]),
  )
const names = {
  A1: 'PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE',
  A1D: 'PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT',
  A1E: 'PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE',
  CA: 'PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT',
  B3B: 'PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION',
  B3A: 'PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS',
}
const hashes = {
  A1: '1174c864e09fc68f42dca882bb26b6e82cdf4cd3dc58411bd8136e32e317d28d',
  A1D: '84a357fa94bb5a951016c7b58ad975bfe3e92c43bd0bf81c2ed8bc2a44052dfe',
  A1E: '8a8aed72458720fe6ebaff1eec1227ec3c816d4f44747bc7b509c4736401e8f5',
  CA: 'bf6a6e2c1f73f3d56b035b3b1705f298d34d7ff738095eefff8249c6bd6144d0',
  B3B: 'd65dea976c169acb795c71e5c3491d6478d4dbe0859e9b3b17c6be4691c7f84b',
  B3A: '5755b17e89fbb81b3afb1b6fda4e18ba107153cd52680bad21041e466c13a883',
}
const preservedBytes = new Map()
const inputs = Object.fromEntries(
  Object.entries(names).map(([key, name]) => {
    const file = `${base}${name}.json`
    const bytes = readFileSync(absolute(file))
    assert.equal(hash(bytes), hashes[key], `FAIL_EVIDENCE_DRIFT: ${key}`)
    preservedBytes.set(file, hash(bytes))
    const markdown = `${base}${name}.md`
    preservedBytes.set(markdown, hash(readFileSync(absolute(markdown))))
    return [key, JSON.parse(bytes)]
  }),
)
const { A1: a1, A1D: a1d, A1E: a1e } = inputs
const prior = a1e.sourceCeilingPrerequisiteReconciliation.filter(
  (row) => row.FINAL_DISPOSITION === 'SOURCE_CEILING_REMAINS',
)
assert.equal(prior.length, 803)
assert.equal(a1e.opaqueBindingReconciliation.length, 118)
assert.equal(a1e.orderingReconciliation.length, 86)
assert.equal(a1e.finalPrerequisiteModel.length, 945)
assert.equal(a1e.frozenMigrationManifest.length, 23)
assert.equal(a1e.phaseStatus.NO_FURTHER_BOOTSTRAP_STATIC_SOURCE_PASS, 'YES')
const prerequisiteById = new Map(a1.prerequisiteRegistry.map((row) => [row.PREREQUISITE_ID, row]))
const candidateById = new Map(a1.creationSourceCandidates.map((row) => [row.CANDIDATE_ID, row]))
const doctrine = 'DJANGO_FIRST_THEN_GOVERNED_PLATFORM_BASELINE_THEN_SCOPED_SECURITY_MIGRATIONS'
const state = 'IMPLEMENTATION_PENDING'
const primaryClasses = [
  'DJANGO_BOOTSTRAP_OBLIGATION',
  'EXTERNAL_DJANGO_PACKAGE_OBLIGATION',
  'PLATFORM_BASELINE_OBLIGATION',
  'ROLE_PROVISIONING_OBLIGATION',
  'EXTENSION_PROVISIONING_OBLIGATION',
  'TYPE_FUNCTION_BASELINE_OBLIGATION',
  'FINANCIAL_MATERIALIZATION_OBLIGATION',
  'RUNTIME_BINDING_OBLIGATION',
  'SEARCH_PATH_OR_SCHEMA_BINDING_OBLIGATION',
  'EXPLICIT_GOVERNANCE_DECISION_REQUIRED',
]
const bindingClasses = [
  'PHYSICAL_TARGET_BINDING',
  'RUNTIME_DATABASE_BINDING',
  'SCHEMA_BINDING',
  'ROLE_BINDING',
  'SEARCH_PATH_BINDING',
  'PACKAGE_OR_MIGRATION_BINDING',
  'OTHER_EXPLICIT',
]
const decisions = []
function decision(key, subject, evidenceRequired, affected = {}, workstream = 'W2') {
  const DECISION_ID = id('DECISION', key)
  assert.ok(
    !decisions.some((row) => row.DECISION_ID === DECISION_ID),
    'Duplicate decision declaration',
  )
  decisions.push({
    DECISION_ID,
    SUBJECT: subject,
    STATUS: 'HUMAN_DECISION_REQUIRED',
    OWNER_CLASS: 'HUMAN_ARCHITECTURE_OR_PLATFORM_MAINTAINER',
    REQUIRED_DECISION_RECORD: evidenceRequired,
    WORKSTREAM_ID: workstream,
    AFFECTED_PREREQUISITE_IDS: affected.prerequisites ?? [],
    AFFECTED_OPAQUE_BINDING_IDS: affected.opaque ?? [],
    AFFECTED_ORDERING_RECORD_IDS: affected.ordering ?? [],
    EXECUTION_BLOCKED_UNTIL_RECORDED: 'YES',
    DECISION_ASSUMED: 'NO',
  })
  return DECISION_ID
}
const targetDecision = decision(
  'target-contract',
  'Exact operational and distinct financial target contract',
  'Approve non-secret target identifiers, endpoint/database equivalence rules, secret-reference mapping, scope isolation, ownership and allowed migration/runtime identity classes; preserve UE same-scope and financial distinct-scope doctrines.',
)
const pathDecision = decision(
  'search-path',
  'Exact schema names and search paths',
  'Approve per-scope database schema names, ordered default/migration/runtime search paths and function-specific paths; prohibit implicit ambient lookup. Frozen public-qualified identities constrain compatibility but do not prove every runtime path.',
)
const roleDecision = decision(
  'role-authority',
  'Role identity, ownership and rotation authority',
  'Approve exact migration-admin, application/system runtime and distinct financial migration/runtime principal names; login/non-login provisioning, ownership, least-privilege grants and rotation authorities. Runtime roles must not own protected objects or bypass RLS.',
  {},
  'W3',
)
const vectorId = prior.find((row) => row.KIND === 'EXTENSION').PREREQUISITE_ID
const vectorDecision = decision(
  'vector-requirement',
  'Vector requirement and guarded-use decision',
  'Vector is excluded from the canonical mandatory extension set unless independently required. Decide each accepted consumer obligation explicitly: prove guarded non-requirement or add a governed mandatory fail-fast install step. Exclusion alone does not waive the frozen prerequisite.',
  { prerequisites: [vectorId] },
  'W3',
)
const djangoDecision = decision(
  'django-package-identity',
  'Exact Python/Django/package and configured app identity',
  'Approve exact Python runtime and all Django/migration-contributing package versions with deterministic lock digest; settings module, installed apps, migration modules, swappable model mapping and the unresolved configured apps namespace must be explicit. No range-only identity or silent app removal.',
  {},
  'W1',
)
const financialDecision = decision(
  'financial-authority',
  'Financial materializer schema authority',
  'Approve an exact financial authoritative schema source and full-scope executable manifest/entrypoint. Current declarations are candidate references only; comment-only SQL, partial repairs and missing-file-tolerant runner cannot be selected.',
  {},
  'W7',
)
const snapshotDecision = decision(
  'snapshot-use',
  'Conditional snapshot recovery/acceleration admission',
  'No primary snapshot-first architecture. Any future admitted snapshot requires identity/SHA256/schema version/migration level/provenance/schema and policy digests/forward compatibility; never substitutes for the governed schema authority or faithful replay.',
  {},
  'W8',
)

function djangoCandidates(row) {
  return row.SOURCE_CANDIDATE_IDS.map((key) => candidateById.get(key)).filter(
    (candidate) =>
      candidate?.SOURCE_KIND === 'DJANGO_MIGRATION' &&
      candidate.DATABASE_SCOPE === row.DATABASE_SCOPE,
  )
}
const opaqueObligations = a1e.opaqueBindingReconciliation.map((row) => {
  const requiredClass =
    row.DATABASE_SCOPE === 'financial-service'
      ? 'OTHER_EXPLICIT'
      : row.BINDING_CLASS === 'GRANT_SCOPE'
        ? 'ROLE_BINDING'
        : row.BINDING_CLASS === 'DYNAMIC_SQL'
          ? 'PHYSICAL_TARGET_BINDING'
          : 'PACKAGE_OR_MIGRATION_BINDING'
  assert.ok(bindingClasses.includes(requiredClass))
  const runtimeRequired =
    row.BINDING_CLASS === 'GRANT_SCOPE'
      ? 'Record actual principal attributes, exact ACL/default-ACL target set, positive and negative privilege effects and scope membership on the governed disposable target; no wildcard success assumption.'
      : row.BINDING_CLASS === 'DYNAMIC_SQL'
        ? 'Capture actual expanded physical identifiers, schema-qualified targets and every conditional branch outcome; reconcile to the approved target set before claiming the frozen consumer obligation satisfied.'
        : 'Record exact package/migration/semantic materialization input and its catalog effect for this consumer; absence of effects must have explicit contract justification, not command exit success.'
  return {
    OBLIGATION_ID: id('OPAQUE-OBLIGATION', row.OPAQUE_BINDING_ID),
    OPAQUE_BINDING_ID: row.OPAQUE_BINDING_ID,
    PREREQUISITE_ID: row.A1_PREREQUISITE_ID,
    INPUT_IDENTITY: row.INPUT_IDENTITY,
    DATABASE_SCOPE: row.DATABASE_SCOPE,
    CURRENT_CONSUMERS: row.CONSUMER_IDS,
    CURRENT_CONSUMER_REFERENCES: row.A1_CONSUMERS.map((consumer) => ({
      MIGRATION_NODE_ID: consumer.MIGRATION_NODE_ID,
      MIGRATION_FILE: consumer.MIGRATION_FILE,
      SOURCE_EVIDENCE: consumer.SOURCE_EVIDENCE,
      CONSUMPTION_REASON: consumer.REASON,
    })),
    BINDING_CLASS: row.BINDING_CLASS,
    REQUIRED_CONTRACT_CLASS: requiredClass,
    REMEDIATION_OWNER_SURFACE:
      row.DATABASE_SCOPE === 'financial-service'
        ? 'Distinct financial bootstrap contract and materializer manifest; frozen SQL unchanged'
        : row.BINDING_CLASS === 'GRANT_SCOPE'
          ? 'Governed role/ACL inventory and preconsumer baseline; frozen SQL unchanged'
          : 'Governed target/semantic binding registry and disposable verifier; frozen SQL unchanged',
    REQUIRED_IMPLEMENTATION_EVIDENCE: `Bind ${row.INPUT_IDENTITY} to an explicit per-scope input contract, permitted target set, owner, package/role/schema/search-path dependencies and fail-fast behavior. ${row.EXACT_NEXT_EVIDENCE_REQUIRED}`,
    REQUIRED_RUNTIME_EVIDENCE: runtimeRequired,
    WORKSTREAM_IDS:
      row.DATABASE_SCOPE === 'financial-service'
        ? ['W6', 'W7']
        : row.BINDING_CLASS === 'GRANT_SCOPE'
          ? ['W3', 'W6']
          : ['W6'],
    DECISION_DEPENDENCIES:
      row.DATABASE_SCOPE === 'financial-service'
        ? [financialDecision, targetDecision, pathDecision]
        : row.BINDING_CLASS === 'GRANT_SCOPE'
          ? [roleDecision, pathDecision]
          : [targetDecision, pathDecision, djangoDecision],
    STATUS: state,
    IMPLEMENTED: 'NO',
    RUNTIME_PROVEN: 'NO',
    WAIVED: 'NO',
  }
})
const opaqueByPrerequisite = new Map(opaqueObligations.map((row) => [row.PREREQUISITE_ID, row]))
const prerequisiteObligations = prior.map((row) => {
  const input = prerequisiteById.get(row.PREREQUISITE_ID)
  const django = djangoCandidates(row)
  let primary, owner, layers, streams, dependencies, requirement
  if (row.DATABASE_SCOPE === 'financial-service') {
    primary = 'FINANCIAL_MATERIALIZATION_OBLIGATION'
    owner = 'FINANCIAL_MATERIALIZER'
    layers = ['FINANCIAL_LAYER_1']
    streams = ['W7']
    dependencies = [financialDecision, targetDecision, pathDecision]
    requirement =
      'Implement the distinct full financial materializer and exact frozen semantic binding; comment-only frozen migration is retained as non-materializing history and never supplies creation authority.'
  } else if (row.KIND === 'ROLE') {
    primary = 'ROLE_PROVISIONING_OBLIGATION'
    owner = 'POSTGRES_PLATFORM'
    layers = ['LAYER_0']
    streams = ['W3']
    dependencies = [roleDecision, targetDecision]
    requirement =
      'Create/configure this exact required role on the governed operational cluster before any consumer; pin login, bypass, ownership, grants and rotation authority and verify fail-fast.'
  } else if (row.KIND === 'EXTENSION') {
    primary = 'EXTENSION_PROVISIONING_OBLIGATION'
    owner = 'POSTGRES_PLATFORM'
    layers = ['LAYER_0']
    streams = ['W3']
    dependencies = [vectorDecision]
    requirement =
      'Close the exact vector consumer requirement through approved guarded non-requirement evidence or mandatory fail-fast installation; no silent optional continuation or blanket exemption.'
  } else if (['TYPE', 'FUNCTION'].includes(row.KIND)) {
    primary = 'TYPE_FUNCTION_BASELINE_OBLIGATION'
    owner = 'PLATFORM_BASELINE_SUBJECT_TO_EXPLICIT_OWNERSHIP'
    layers = ['LAYER_2']
    streams = ['W4']
    const producerDecision = decision(
      `type-function:${row.PREREQUISITE_ID}`,
      `Producer authority and exact definition for ${row.A1_IDENTITY}`,
      'Approve the owner, exact enum/type definition or function signature/body/security attributes and trusted search path. Platform ownership must be explicit; domain-owned type authority must remain with its approved domain producer. Record content digest and preconsumer/later-provider compatibility without frozen SQL changes.',
      { prerequisites: [row.PREREQUISITE_ID], ordering: row.ORDERING_RECORD_IDS },
      'W4',
    )
    dependencies = [producerDecision, targetDecision, pathDecision]
    requirement =
      'Implement a schema-qualified, content-digested producer for this exact required type/function with approved platform ownership, definition/signature/body/security/search-path and preconsumer ordering. Domain-owned types cannot be reassigned merely to unblock execution.'
  } else if (row.KIND === 'SCHEMA') {
    primary = 'SEARCH_PATH_OR_SCHEMA_BINDING_OBLIGATION'
    owner = 'POSTGRES_PLATFORM'
    layers = ['LAYER_0']
    streams = ['W2']
    dependencies = [pathDecision]
    requirement =
      'Approve and implement exact schema ownership/search-path binding and verify name resolution before consumption.'
  } else if (row.KIND === 'SOURCE_BINDING') {
    primary = 'RUNTIME_BINDING_OBLIGATION'
    owner = 'GOVERNED_BINDING_REGISTRY'
    layers = ['LAYER_2', 'LAYER_4']
    streams = ['W6']
    dependencies = opaqueByPrerequisite.get(row.PREREQUISITE_ID).DECISION_DEPENDENCIES
    requirement = opaqueByPrerequisite.get(row.PREREQUISITE_ID).REQUIRED_IMPLEMENTATION_EVIDENCE
  } else if (django.length) {
    primary = 'DJANGO_BOOTSTRAP_OBLIGATION'
    owner = 'DJANGO'
    layers = ['LAYER_1']
    streams = ['W1', 'W4']
    dependencies = [djangoDecision, targetDecision, pathDecision]
    requirement =
      'Materialize the real Django-owned relation and exact required column/type state through the complete pinned graph; frozen candidate presence is ownership evidence, not proof that every required column or relation currently materializes.'
  } else {
    primary = 'EXPLICIT_GOVERNANCE_DECISION_REQUIRED'
    owner = 'GOVERNANCE_DECISION_REQUIRED'
    layers = ['LAYER_1_OR_LAYER_2_PENDING_OWNER_DECISION']
    streams = ['W4']
    const ownerDecision = decision(
      `owner:${row.PREREQUISITE_ID}`,
      `Preconsumer owner for ${row.A1_IDENTITY}`,
      'Approve Django domain ownership or explicitly platform-owned baseline authority for the exact physical relation/column. Require real schema definition, no synthetic domain substitute, and compatibility with later frozen CREATE/ALTER statements. If incompatible, halt and request a separate architecture/manifest decision; do not rewrite or reorder frozen SQL.',
      { prerequisites: [row.PREREQUISITE_ID], ordering: row.ORDERING_RECORD_IDS },
      'W4',
    )
    dependencies = [ownerDecision, targetDecision, pathDecision]
    requirement =
      'Record the exact owner/definition first; implement only under that approved authority. A platform layer may not recreate a Django-owned domain relation.'
  }
  assert.ok(primaryClasses.includes(primary))
  return {
    OBLIGATION_ID: id('PREREQUISITE-OBLIGATION', row.PREREQUISITE_ID),
    PREREQUISITE_ID: row.PREREQUISITE_ID,
    PHYSICAL_IDENTITY: row.A1_IDENTITY,
    DATABASE_SCOPE: row.DATABASE_SCOPE,
    PREREQUISITE_KIND: row.KIND,
    PRIMARY_DISPOSITION: primary,
    CREATION_AUTHORITY: owner,
    EXECUTION_STEP: layers,
    PRIMARY_OWNER_WORKSTREAM: streams.at(-1),
    WORKSTREAM_IDS: streams,
    SOURCE_CANDIDATE_IDS: row.SOURCE_CANDIDATE_IDS,
    DJANGO_AUTHORITY_CANDIDATE_IDS: django.map((candidate) => candidate.CANDIDATE_ID),
    REQUIRED_BEFORE_CONSUMER_IDS: row.CONSUMER_IDS,
    ORDERING_RECORD_IDS: row.ORDERING_RECORD_IDS,
    OPAQUE_BINDING_IDS: row.OPAQUE_BINDING_IDS,
    SECONDARY_DECISION_DEPENDENCIES: unique(dependencies),
    SECONDARY_CONTRACT_DEPENDENCIES: [
      'EXACT_DJANGO_DEPENDENCY_LOCK',
      'EXPLICIT_DATABASE_TARGET_CONTRACT',
      'EXPLICIT_ROLE_AND_SEARCH_PATH_CONTRACT',
    ],
    REQUIRED_IMPLEMENTATION_EVIDENCE: `${row.A1_IDENTITY}: ${requirement}`,
    FAILURE_BEHAVIOR: 'FAIL_FAST_BEFORE_FIRST_CONSUMER',
    VERIFICATION: `Schema-qualified preconsumer assertion for ${input.PHYSICAL_NAME}; preserve exact kind/column/type/signature/role attributes and scope. Check after bootstrap without mutation, then attach controlled runtime evidence to this ID.`,
    STATUS: state,
    IMPLEMENTED: 'NO',
    RUNTIME_PROVEN: 'NO',
    DISPOSITION_IS_RESOLUTION: 'NO',
  }
})
const obligationByPrerequisite = new Map(
  prerequisiteObligations.map((row) => [row.PREREQUISITE_ID, row]),
)
const fullPrerequisiteGovernance = a1e.finalPrerequisiteModel.map((row) => {
  const prospective = obligationByPrerequisite.get(row.PREREQUISITE_ID)
  const input = prerequisiteById.get(row.PREREQUISITE_ID)
  const inheritedAuthority =
    row.FINAL_DISPOSITION === 'POSTGRES_CORE'
      ? 'POSTGRES_CORE_DECLARATION_REQUIRES_RUNTIME_VERIFICATION'
      : row.FINAL_DISPOSITION === 'PRIOR_FROZEN_DECLARATIONS'
        ? 'ACCEPTED_PRIOR_FROZEN_PRODUCER_DECLARATION_REQUIRES_EXECUTION_VERIFICATION'
        : 'ACCEPTED_MANDATORY_EXTENSION_INSTALLER_AUTHORITY_REQUIRES_RUNTIME_VERIFICATION'
  return {
    PREREQUISITE_ID: row.PREREQUISITE_ID,
    PHYSICAL_IDENTITY: row.A1_IDENTITY,
    DATABASE_SCOPE: input.DATABASE_SCOPE,
    CREATION_AUTHORITY: prospective?.CREATION_AUTHORITY ?? inheritedAuthority,
    EXECUTION_STEP:
      prospective?.EXECUTION_STEP ??
      (row.FINAL_DISPOSITION === 'PRIOR_FROZEN_DECLARATIONS'
        ? ['UNCHANGED_FROZEN_PRODUCER_BEFORE_CONSUMER']
        : ['LAYER_0']),
    FAILURE_BEHAVIOR: 'FAIL_FAST_BEFORE_FIRST_CONSUMER',
    VERIFICATION:
      prospective?.VERIFICATION ??
      `Verify exact ${input.KIND} ${input.PHYSICAL_NAME} on the governed target and record the actual producer/extension/core version and consumer order; accepted declaration or installer authority is not runtime presence.`,
    LINKED_PREREQUISITE_OBLIGATION_ID: prospective?.OBLIGATION_ID ?? null,
    INHERITED_DECLARATION_CLASS: prospective ? null : row.FINAL_DISPOSITION,
    REQUIRED_BEFORE_CONSUMER_IDS: unique(
      input.CONSUMERS.map((consumer) => consumer.MIGRATION_NODE_ID),
    ),
    STATUS: prospective ? state : 'EXECUTION_VERIFICATION_PENDING',
    IMPLEMENTATION_OR_RUNTIME_RESOLUTION_IN_A1G: 'NO',
  }
})
const orderingObligations = a1e.orderingReconciliation.map((row) => {
  const obligation = obligationByPrerequisite.get(row.PREREQUISITE_ID)
  assert.ok(obligation)
  const owner =
    obligation.CREATION_AUTHORITY === 'DJANGO'
      ? 'DJANGO'
      : obligation.DATABASE_SCOPE === 'financial-service'
        ? 'FINANCIAL_MATERIALIZER'
        : obligation.PREREQUISITE_KIND === 'TYPE' || obligation.PREREQUISITE_KIND === 'FUNCTION'
          ? 'PLATFORM_BASELINE'
          : 'GOVERNANCE_DECISION_REQUIRED'
  return {
    OBLIGATION_ID: id('ORDERING-OBLIGATION', row.ORDERING_RECORD_ID),
    ORDERING_RECORD_ID: row.ORDERING_RECORD_ID,
    CONSUMER: row.CURRENT_CONSUMER,
    PREREQUISITE: row.PREREQUISITE_ID,
    PHYSICAL_IDENTITY: obligation.PHYSICAL_IDENTITY,
    LATER_PROVIDER: row.LATER_PROVIDER,
    CANONICAL_PRECONSUMER_OWNER: owner,
    LINKED_PREREQUISITE_OBLIGATION_ID: obligation.OBLIGATION_ID,
    SECONDARY_DECISION_DEPENDENCIES: obligation.SECONDARY_DECISION_DEPENDENCIES,
    REMEDIATION_REQUIRED: 'YES',
    REQUIRED_IMPLEMENTATION_EVIDENCE: `Establish ${obligation.PHYSICAL_IDENTITY} through its approved owner before ${row.CURRENT_CONSUMER}, preserving ${row.LATER_PROVIDER} and the frozen order/bytes.`,
    VERIFICATION_REQUIRED: 'YES',
    REQUIRED_VERIFICATION:
      'Assert exact required preconsumer state and execute the unchanged later provider without conflicting CREATE/ALTER or tolerated errors in an eventually authorized faithful replay. Incompatibility blocks completion and requires separate governance; do not silently rewrite, skip, baseline-as-executed or reorder frozen files.',
    WORKSTREAM_IDS: ['W4', 'W5'],
    STATUS: state,
    FROZEN_ORDER_CHANGED: 'NO',
    IMPLEMENTED: 'NO',
    RUNTIME_PROVEN: 'NO',
  }
})
const roleClasses = [
  'MIGRATION_ADMIN',
  'APPLICATION_RUNTIME',
  'SYSTEM_OR_INTERNAL_RUNTIME',
  'FINANCIAL_MIGRATION',
  'FINANCIAL_RUNTIME',
]
const roles = roleClasses.map((role) => {
  const runtime = [
    'APPLICATION_RUNTIME',
    'SYSTEM_OR_INTERNAL_RUNTIME',
    'FINANCIAL_RUNTIME',
  ].includes(role)
  return {
    ROLE_CLASS: role,
    DATABASE_SCOPE: role.startsWith('FINANCIAL') ? 'financial-service' : 'union-eyes',
    PRINCIPAL_NAME: 'EXPLICIT_GOVERNANCE_DECISION_REQUIRED',
    EVIDENCED_REQUIRED_PREREQUISITE_IDS:
      role === 'APPLICATION_RUNTIME'
        ? prior
            .filter(
              (row) =>
                row.KIND === 'ROLE' &&
                prerequisiteById.get(row.PREREQUISITE_ID).PHYSICAL_NAME === 'union_eyes_runtime',
            )
            .map((row) => row.PREREQUISITE_ID)
        : role === 'SYSTEM_OR_INTERNAL_RUNTIME'
          ? prior
              .filter(
                (row) =>
                  row.KIND === 'ROLE' &&
                  prerequisiteById.get(row.PREREQUISITE_ID).PHYSICAL_NAME === 'union_eyes_system',
              )
              .map((row) => row.PREREQUISITE_ID)
          : [],
    LOGIN_EXPECTATION:
      'Explicit authenticated connection identity; provision initially NOLOGIN until securely configured. Exact credential/login mechanism approved under role decision.',
    BYPASSRLS_EXPECTATION: runtime
      ? 'NO_BYPASSRLS_AND_NOT_SUPERUSER'
      : 'Explicit least-privilege migration authority decision; never application runtime identity',
    OWNERSHIP_EXPECTATION: runtime
      ? 'MUST_NOT_OWN_RLS_PROTECTED_DOMAIN_OBJECTS'
      : 'Explicit DDL ownership/delegation boundary, limited to governed scope; owner versus migrator separation must be recorded',
    GRANT_BOUNDARY: runtime
      ? 'Only enumerated per-scope tables/functions/schemas; system/internal access must be separately authorized, not blanket bypass'
      : 'Only approved schema materialization/provisioning operations; no reuse in runtime processes',
    CREATION_AUTHORITY:
      'Governed Layer 0 provisioning implementation, platform operator approved; no undocumented manual preexistence',
    ROTATION_AUTHORITY:
      'EXPLICIT_GOVERNANCE_DECISION_REQUIRED: approved platform identity/secret-management owner',
    DECISION_ID: roleDecision,
    WORKSTREAM_ID: 'W3',
    STATUS: state,
  }
})
const searchPath = {
  DATABASE_SCHEMA_NAMES: 'EXPLICIT_GOVERNANCE_DECISION_REQUIRED',
  DEFAULT_SEARCH_PATH: 'EXPLICIT_GOVERNANCE_DECISION_REQUIRED',
  MIGRATION_SEARCH_PATH: 'EXPLICIT_GOVERNANCE_DECISION_REQUIRED',
  RUNTIME_SEARCH_PATH: 'EXPLICIT_GOVERNANCE_DECISION_REQUIRED',
  FUNCTION_SEARCH_PATH_REQUIREMENTS:
    'Explicit approved path per helper/trigger/security-definer function; no inherited ambient caller path or untrusted writable schema',
  DATABASE_SCOPES: ['union-eyes', 'financial-service'],
  DECISION_ID: pathDecision,
  FROZEN_SCHEMA_COMPATIBILITY:
    'Existing qualified public identities must be accounted for; do not infer all database schemas/search paths from those names',
  BLOCK_EXECUTION_WHILE_UNDECIDED: 'YES',
  WORKSTREAM_ID: 'W2',
}
const layers = [
  {
    LAYER_ID: 'LAYER_0',
    NAME: 'POSTGRES_PLATFORM_PREREQUISITES',
    DEPENDS_ON: [],
    AUTHORITY: 'Governed platform provisioning; migration and runtime identities separated',
    RESPONSIBILITIES: [
      'Mandatory fail-fast extension installation',
      'Explicit database roles and ownership assumptions',
      'Approved schema/search-path and target contracts',
      'Login/non-login and least-privilege authority',
    ],
    EXIT_GATE:
      'Every platform prerequisite has an approved creation authority/execution step/scope/failure behavior/verification; no undocumented manual state',
  },
  {
    LAYER_ID: 'LAYER_1',
    NAME: 'DJANGO_OPERATIONAL_SCHEMA_MATERIALIZATION',
    DEPENDS_ON: ['LAYER_0'],
    AUTHORITY:
      'Complete pinned Django operational graph; organizations exclusively auth_core lineage',
    RESPONSIBILITIES: [
      'Pin Python/framework/third-party versions',
      'Resolve settings/apps/migration modules/swappable models',
      'Materialize real operational schema before security consumption',
    ],
    EXIT_GATE:
      'Complete graph/digests and actual expected schema assertions satisfied; no synthetic domain DDL',
  },
  {
    LAYER_ID: 'LAYER_2',
    NAME: 'UE_PRECONSUMER_PLATFORM_BASELINE',
    DEPENDS_ON: ['LAYER_1'],
    AUTHORITY:
      'Explicitly platform-owned prerequisite producers; unassigned ownership requires decision',
    RESPONSIBILITIES: [
      'Required platform types/functions/schemas/baseline relations',
      'Close ordering prerequisites without frozen reorder',
      'Govern opaque physical/role/package/search-path binding sets',
    ],
    FORBIDDEN: [
      'Recreate Django domain relations',
      'Synthetic organizations table',
      'Missing-object tolerance',
      'SQL rewrites or schema shims',
    ],
    EXIT_GATE:
      'All exact prerequisite and preconsumer binding assertions pass; later frozen provider compatibility established',
  },
  {
    LAYER_ID: 'LAYER_3',
    NAME: 'UE_FROZEN_SCOPED_SECURITY_MIGRATIONS',
    DEPENDS_ON: ['LAYER_2'],
    AUTHORITY: 'Accepted frozen manifest, unchanged scope-specific execution order/bytes/hashes',
    RESPONSIBILITIES: [
      'Execute only after prerequisite gates',
      'Record actual lineage digest; never treat baselined hashes as file execution',
    ],
    EXIT_GATE:
      'All governed scope-specific frozen files executed unchanged without tolerated errors; distinct financial scope handled separately',
  },
  {
    LAYER_ID: 'LAYER_4',
    NAME: 'POST_BOOTSTRAP_VERIFICATION',
    DEPENDS_ON: ['LAYER_3'],
    AUTHORITY:
      'Read-only verification against approved expected schema/role/policy/lineage digests',
    RESPONSIBILITIES: [
      'Objects/policies/RLS/roles/extensions/functions/types exist as specified',
      'Lineage digest matches',
      'No shims or tolerated missing prerequisites',
      'Attach exact obligation-linked evidence',
    ],
    EXIT_GATE:
      'Expected output shapes and digests satisfied, no mutation; proof scope remains disposable until separately authorized wider evidence',
  },
]
const djangoContract = {
  DJANGO_BOOTSTRAP_ENTRYPOINT:
    'Governed orchestrator invokes backend/manage.py using exact locked runtime; implementation pending',
  DJANGO_SETTINGS_MODULE:
    'config.settings; exact selected module bytes and override policy locked by W1',
  DATABASE_SCOPE: 'union-eyes',
  MIGRATION_COMMAND:
    'python manage.py migrate --noinput; python manage.py migrate --check under locked identity and explicit target contract',
  PACKAGE_LOCK_DIGEST: 'REQUIRED_FUTURE_ARTIFACT_NOT_YET_PRODUCED',
  MIGRATION_PLAN_DIGEST: 'REQUIRED_FUTURE_ARTIFACT_NOT_YET_PRODUCED',
  EXPECTED_SCHEMA_DIGEST: 'REQUIRED_FUTURE_ARTIFACT_NOT_YET_PRODUCED',
  EXACT_DJANGO_DEPENDENCY_LOCK_REQUIRED: 'YES',
  LOCK_FIELDS: [
    'Python runtime',
    'Django version',
    'All migration-contributing third-party packages',
    'Exact package versions and lock identity',
    'Settings module bytes',
    'INSTALLED_APPS',
    'MIGRATION_MODULES',
    'Swappable model resolution',
  ],
  FROZEN_LOCAL_MIGRATION_RECORD_IDS: a1e.djangoOperationalGraph.LOCAL_MIGRATIONS.map(
    (row) => row.DJANGO_MIGRATION_ID,
  ),
  FROZEN_LITERAL_DEPENDENCY_EDGE_IDS: a1e.djangoOperationalGraph.LITERAL_DEPENDENCY_EDGES.map(
    (row) => row.DJANGO_DEPENDENCY_ID,
  ),
  CONFIGURED_APP_IDS: a1e.djangoOperationalGraph.CONFIGURED_APPS.map(
    (row) => row.DJANGO_CONFIGURED_APP_ID,
  ),
  UNPINNED_RANGE_ACCEPTABLE: 'NO',
  SILENT_APP_OR_DEPENDENCY_EXCLUSION_ALLOWED: 'NO',
  EXECUTED: 'NO',
  WORKSTREAM_ID: 'W1',
  DECISION_ID: djangoDecision,
}
const financialSpec = {
  DATABASE_SCOPE: 'financial-service',
  UE_SCOPE_MERGED: 'NO',
  AUTHORITATIVE_SCHEMA_SOURCE: {
    STATUS: 'EXPLICIT_GOVERNANCE_DECISION_REQUIRED',
    DECISION_ID: financialDecision,
    REQUIREMENT:
      'Approve exact full financial schema identity, owner and byte-digested source; candidate declarations cannot authorize execution alone',
  },
  CANONICAL_MIGRATION_MANIFEST: {
    STATUS: 'IMPLEMENTATION_REQUIRED',
    REQUIREMENT:
      'Complete ordered executable fresh-schema producer manifest with file SHA256, prerequisites and full object/policy coverage; no partial repairs or missing-file tolerance',
  },
  FRESH_DATABASE_ENTRYPOINT: {
    STATUS: 'IMPLEMENTATION_REQUIRED',
    REQUIREMENT:
      'Distinct target-guarded entrypoint composed from financial Layer 0 prerequisites -> governed materializer -> unchanged financial frozen ledger file -> read-only verification',
  },
  FAIL_FAST_BEHAVIOR:
    'Missing input, unsupported prerequisite, schema/migration error, wrong scope or digest mismatch aborts before dependent execution',
  RESET_TEST_SUPPORT:
    'Only explicitly approved disposable target identities; deterministic named teardown; no staging/production/shared reset; verify reset and teardown evidence',
  SCHEMA_DIGEST: 'REQUIRED_FUTURE_EXPECTED_AND_OBSERVED_ARTIFACTS',
  MIGRATION_DIGEST: 'REQUIRED_FUTURE_CONTENT_MANIFEST_AND_EXECUTION_ARTIFACTS',
  VERIFICATION_COMMAND:
    'REQUIRED_FUTURE_READ_ONLY_VERIFIER_ENTRYPOINT; no existing runner selected or executed',
  CORRESPONDING_LAYERS: [
    {
      LAYER_ID: 'FINANCIAL_LAYER_0',
      RESPONSIBILITY: 'Distinct target/role/extension/schema prerequisites',
      DEPENDS_ON: [],
    },
    {
      LAYER_ID: 'FINANCIAL_LAYER_1',
      RESPONSIBILITY: 'Approved full financial materializer',
      DEPENDS_ON: ['FINANCIAL_LAYER_0'],
    },
    {
      LAYER_ID: 'FINANCIAL_LAYER_2',
      RESPONSIBILITY: 'Explicit non-domain prerequisite/binding baseline',
      DEPENDS_ON: ['FINANCIAL_LAYER_1'],
    },
    {
      LAYER_ID: 'FINANCIAL_LAYER_3',
      RESPONSIBILITY:
        'Retain and execute unchanged financial frozen manifest input as non-materializing file; never creation authority',
      DEPENDS_ON: ['FINANCIAL_LAYER_2'],
    },
    {
      LAYER_ID: 'FINANCIAL_LAYER_4',
      RESPONSIBILITY: 'Read-only full schema/policy/role/lineage verification',
      DEPENDS_ON: ['FINANCIAL_LAYER_3'],
    },
  ],
  NON_AUTHORITATIVE: [
    'Frozen comment-only financial migration',
    'Partial repair scripts',
    'Missing-file-tolerant migration runner',
  ],
  WORKSTREAM_ID: 'W7',
  IMPLEMENTED: 'NO',
  EXECUTED: 'NO',
}
const additionalObligations = [
  {
    OBLIGATION_ID: id('REQUIREMENT', 'target-binding'),
    PRIMARY_DISPOSITION: 'SEARCH_PATH_OR_SCHEMA_BINDING_OBLIGATION',
    SUBJECT: 'Explicit same operational target and distinct financial scope contract',
    WORKSTREAM_IDS: ['W2'],
    REQUIRED_EVIDENCE: decisions.find((row) => row.DECISION_ID === targetDecision)
      .REQUIRED_DECISION_RECORD,
    DECISION_DEPENDENCIES: [targetDecision, pathDecision],
    STATUS: state,
    COUNTED_IN_803: 'NO',
  },
  {
    OBLIGATION_ID: id('REQUIREMENT', 'exact-django-lock'),
    PRIMARY_DISPOSITION: 'EXTERNAL_DJANGO_PACKAGE_OBLIGATION',
    SUBJECT: 'Exact deterministic Python/Django/configured graph identity',
    WORKSTREAM_IDS: ['W1'],
    REQUIRED_EVIDENCE: decisions.find((row) => row.DECISION_ID === djangoDecision)
      .REQUIRED_DECISION_RECORD,
    DECISION_DEPENDENCIES: [djangoDecision],
    STATUS: state,
    COUNTED_IN_803: 'NO',
  },
  ...a1e.djangoOperationalGraph.EXTERNAL_MIGRATION_DEPENDENCIES.map((row) => ({
    OBLIGATION_ID: id('EXTERNAL-PACKAGE', row.EXTERNAL_MIGRATION_DEPENDENCY_ID),
    PRIMARY_DISPOSITION: 'EXTERNAL_DJANGO_PACKAGE_OBLIGATION',
    SUBJECT: row.PACKAGE,
    EXTERNAL_MIGRATION_DEPENDENCY_ID: row.EXTERNAL_MIGRATION_DEPENDENCY_ID,
    DJANGO_CONFIGURED_APP_ID: row.DJANGO_CONFIGURED_APP_ID,
    WORKSTREAM_IDS: ['W1'],
    REQUIRED_EVIDENCE:
      'Exact version/digest and complete contributed migration graph or explicit migrationless proof; resolve swappable dependencies without vendoring package code',
    DECISION_DEPENDENCIES: [djangoDecision],
    STATUS: state,
    COUNTED_IN_803: 'NO',
  })),
  ...a1e.djangoOperationalGraph.A1D_BROADER_CLOSURE_CEILINGS.map((row) => ({
    OBLIGATION_ID: id('DJANGO-PLAN', row.SOURCE_CEILING_ID),
    PRIMARY_DISPOSITION:
      row.APP && row.APP !== 'apps'
        ? 'EXTERNAL_DJANGO_PACKAGE_OBLIGATION'
        : 'DJANGO_BOOTSTRAP_OBLIGATION',
    PREDECESSOR_GAP_ID: row.SOURCE_CEILING_ID,
    SUBJECT: row.APP ?? row.DJANGO_MIGRATION_ID,
    WORKSTREAM_IDS: ['W1'],
    REQUIRED_EVIDENCE: row.REQUIRED_EVIDENCE,
    DECISION_DEPENDENCIES: [djangoDecision],
    STATUS: state,
    COUNTED_IN_803: 'NO',
  })),
  ...a1e.extensionAuthority
    .filter((row) => row.DISPOSITION === 'CANONICAL_BOOTSTRAP_INSTALL')
    .map((row) => ({
      OBLIGATION_ID: id('INSTALLER-VERIFICATION', row.EXTENSION_ID),
      PRIMARY_DISPOSITION: 'EXTENSION_PROVISIONING_OBLIGATION',
      PREREQUISITE_ID: row.EXTENSION_ID,
      SUBJECT: `${row.EXTENSION}: installer authority only accepted`,
      WORKSTREAM_IDS: ['W3'],
      REQUIRED_EVIDENCE:
        'Explicit install step remains fail-fast; verify server availability, install privilege and extension catalog/version on eventually authorized disposable target',
      DECISION_DEPENDENCIES: [targetDecision, roleDecision],
      STATUS: state,
      COUNTED_IN_803: 'NO',
    })),
]
const workstreamDefinitions = [
  [
    'W1',
    'Exact Django/package/migration lock',
    [],
    [
      'apps/union-eyes/backend/requirements.txt',
      'apps/union-eyes/backend dependency lock and exact runtime metadata',
      'Governed Django migration-plan/expected-schema artifacts',
    ],
    ['No silent app removal, invented external graph or range-only deterministic claim'],
    [
      'Accepted exact runtime/package lock digest; 25 configured apps dispositioned; 29 frozen local records/26 edges preserved; raw/swappable graph closed',
    ],
    [
      'Exact dependency lock',
      'Complete migration-plan digest',
      'Expected operational schema digest',
    ],
  ],
  [
    'W2',
    'Database target + schema/search-path contract',
    [],
    [
      'Governed operational/financial binding manifests',
      'Future target validation and settings/startup mapping',
    ],
    [
      'No actual secret values in artifacts; no change to same-operational/distinct-financial doctrine without explicit superseding decision',
    ],
    [
      'Target/schema/path decisions approved; every process/role/scope maps to explicit non-secret target contract; fail-fast wrong/ambient target tests',
    ],
    ['Approved binding manifest', 'Schema/search-path contract', 'Target-validation tests'],
  ],
  [
    'W3',
    'Role and extension provisioning contract implementation',
    ['W1', 'W2'],
    [
      'apps/union-eyes/scripts/provision-runtime-db-roles.ts',
      'Governed Layer 0 provisioning implementation and tests',
    ],
    [
      'No blanket grants, runtime bypass/ownership or undocumented manual preexistence; no silent vector waiver',
    ],
    [
      'Five role classes fully specified; exact role/extension producers and negative tests; mandatory install failure aborts; vector decision attached',
    ],
    ['Role/extension manifest', 'Provisioning implementation', 'Fail-fast/least-privilege tests'],
  ],
  [
    'W4',
    'Preconsumer platform baseline implementation',
    ['W1', 'W2', 'W3'],
    [
      'Approved Django-owned producer surface where required',
      'New governed platform-owned baseline implementation/manifest',
      'Ownership decision records',
    ],
    [
      'No synthetic domain relations, test organizations, shim generation or platform recreation of Django domain schema',
    ],
    [
      'Every W4-assigned prerequisite has approved ownership and a preconsumer producer; the full 803 register links remaining W3/W6/W7 requirements without claiming their completion; no pending owner decision permitted at execution; baseline compatible with later frozen providers',
    ],
    [
      'Preconsumer producer manifest',
      'Exact prerequisite coverage register',
      'Ownership approvals and baseline tests',
    ],
  ],
  [
    'W5',
    '86 ordering-obligation closure',
    ['W4'],
    [
      'Ordering-obligation verifier and compatibility tests',
      'Approved prerequisite baseline adjustments under W4 ownership',
    ],
    ['Do not reorder/rewrite/skip frozen migrations; no generic conflict waiver'],
    [
      'All 86 IDs closed with exact preconsumer state and later-provider compatibility assertions; no duplicate CREATE/tolerated ALTER conflict; unresolved compatibility blocks replay',
    ],
    ['86-entry closure evidence register', 'Preconsumer/later-provider compatibility tests'],
  ],
  [
    'W6',
    '118 opaque-binding implementation',
    ['W1', 'W2', 'W3', 'W4'],
    [
      'Governed target/ACL/semantic binding registry',
      'Read-only expansion and conditional-effect verification tests',
    ],
    ['No blanket not-relevant classification, SQL rewrite or silently waived binding'],
    [
      'All 118 IDs retain consumers and explicit contract class; exact target/ACL/semantic input and runtime-evidence requirements measurable',
    ],
    ['118-entry binding contract', 'Target expansion and ACL/conditional verification tests'],
  ],
  [
    'W7',
    'Financial materializer implementation',
    ['W2', 'W3'],
    [
      'apps/union-eyes/services/financial-service governed materializer, manifest and disposable tests',
      'Financial schema authority decision artifacts',
    ],
    [
      'Frozen financial file unchanged; no promotion of comment-only/repair/tolerant runners; no merged UE scope',
    ],
    [
      'Approved full schema authority; executable complete fail-fast manifest; guarded reset and read-only verifier; expected schema/migration digests',
    ],
    [
      'Canonical financial materializer',
      'Financial expected schema/migration digests',
      'Disposable reset/verification tests',
    ],
  ],
  [
    'W8',
    'Disposable faithful bootstrap orchestrator',
    ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
    [
      'Governed disposable-only orchestrator and tests',
      'Frozen-manifest integrity/lineage verifier',
    ],
    [
      'No production/staging/shared access, unpinned snapshots, historical replay, tolerated failures or canonically promoted cleanroom',
    ],
    [
      'Layers 0-4 and distinct financial sequence composed; full 945 requirements verified; scope-partitioned 23-file order/bytes/hashes preserved; no baselined-as-executed files',
    ],
    [
      'Disposable faithful orchestrator',
      'Prerequisite fail-fast preflight',
      'Full manifest/schema verification tests',
    ],
  ],
  [
    'W9',
    'Deterministic two-run faithful replay',
    ['W8'],
    [
      'Future authorized disposable evidence capture only',
      'Two-run schema/policy/role/lineage comparison reports',
    ],
    ['A1G does not authorize execution; no shared-system reset or production proof inference'],
    [
      'Separate replay authorization on file; two clean disposable runs of same locked inputs produce matching required digests/output shapes and verified teardown; no shims or tolerated errors',
    ],
    ['Two independent faithful replay evidence packets', 'Digest comparison and teardown proof'],
  ],
  [
    'W10',
    'B3C-A full preflight rerun',
    ['W9'],
    ['Future separately authorized B3C-A preflight evidence and adjudication artifacts'],
    [
      'No B3C-B runtime tenant tests or product/production proof claims; prior partial catalog quarantine preserved',
    ],
    [
      'Separate rerun authorization on file; full expected object/policy/RLS/role/type/function catalog and client/context obligations measured; gate adjudicated from full evidence, not command success',
    ],
    ['Full preflight rerun packet', 'B3C-A gate adjudication'],
  ],
]
const allInputObligations = [
  ...prerequisiteObligations,
  ...opaqueObligations,
  ...orderingObligations,
  ...additionalObligations,
]
const workstreams = workstreamDefinitions.map(
  ([WORKSTREAM_ID, OBJECTIVE, DEPENDS_ON, surfaces, forbidden, gates, artifacts]) => ({
    WORKSTREAM_ID,
    OBJECTIVE,
    DEPENDS_ON,
    AUTHORIZATION_STATE: ['W9', 'W10'].includes(WORKSTREAM_ID)
      ? 'SEPARATE_RUNTIME_AUTHORIZATION_REQUIRED'
      : 'A1I_AUTHORIZED_NOT_STARTED',
    STARTED: 'NO',
    AUTHORIZED_CHANGE_SURFACES: surfaces,
    FORBIDDEN_CHANGE_SURFACES: [
      ...forbidden,
      'All 23 accepted frozen migration files/order/hashes',
      'Production/staging/shared-system mutation without separate explicit authority',
    ],
    INPUT_OBLIGATION_IDS: allInputObligations
      .filter(
        (row) =>
          ['W8', 'W9', 'W10'].includes(WORKSTREAM_ID) || row.WORKSTREAM_IDS.includes(WORKSTREAM_ID),
      )
      .map((row) => row.OBLIGATION_ID),
    INPUT_DECISION_IDS: decisions
      .filter((row) => row.WORKSTREAM_ID === WORKSTREAM_ID)
      .map((row) => row.DECISION_ID),
    DEPENDENCY_OUTPUTS_REQUIRED: DEPENDS_ON.map(
      (stream) => `${stream}: accepted completion gate and output artifact digests`,
    ),
    OUTPUT_ARTIFACTS: artifacts,
    VALIDATION: [
      'Run smallest existing syntax/type/lint/unit checks for changed surfaces and assert exact mapped IDs/digests',
      ...gates,
      'Runtime execution requires its separate evidence/authorization lane; unit tests or static implementation do not prove faithful replay',
    ],
    COMPLETION_GATE: gates,
    COMPLETION_STATUS: 'NOT_STARTED',
    NEXT_WORKSTREAMS: workstreamDefinitions
      .filter((row) => row[2].includes(WORKSTREAM_ID))
      .map((row) => row[0]),
  }),
)
const phaseStatus = {
  PHASE_1B_3C_A1G_GATE: 'PASS',
  PHASE_1B_3C_A1G: 'PASS',
  CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT: 'GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING',
  NO_FURTHER_BOOTSTRAP_STATIC_SOURCE_PASS: 'YES',
  BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
  FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
  PHASE_1B_3C_A1I_BOOTSTRAP_CONTRACT_IMPLEMENTATION: 'AUTHORIZED_NOT_STARTED',
  PHASE_1B_3C_A1I_STARTED: 'NO',
  PHASE_1B_3C_A1R: 'NOT_AUTHORIZED',
  PHASE_1B_3C_A1R_STARTED: 'NO',
  PHASE_1B_3C_A2: 'NOT_AUTHORIZED',
  PHASE_1B_3C_A2_STARTED: 'NO',
  PHASE_1B_3C_B: 'NOT_AUTHORIZED',
  PHASE_1B_3C_B_STARTED: 'NO',
  READY_FOR_RUNTIME_PROOF: 0,
  PRODUCTION_SCHEMA_PROVEN: 'NO',
  PRODUCTION_DATABASE_BINDING_RUNTIME_PROVEN: 'NO',
  PRODUCTION_DATABASE_EQUALITY_RUNTIME_PROVEN: 'NO',
  DEPLOYED_DATABASE_IDENTITY_RUNTIME_PROVEN: 'NO',
  FAITHFUL_DISPOSABLE_SCHEMA_PROVEN: 'NO',
  RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
  TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
  PRODUCT_READY: 'NO',
  PHASE_1B_3B: 'SOURCE_CEILING_ACCEPTED',
  STATIC_RLS_POLICY_MODEL: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
  B3C_RUNTIME_PROOF_ITEMS: 3124,
}
const manifest = a1e.frozenMigrationManifest
const scopeCounts = Object.fromEntries(
  unique(manifest.map((row) => row.DATABASE_SCOPE)).map((scope) => [
    scope,
    manifest.filter((row) => row.DATABASE_SCOPE === scope).length,
  ]),
)
const contract = {
  metadata: {
    PHASE: 'PHASE_1B_3C_A1G',
    METHOD:
      'Prospective human-authorized governance adoption using frozen predecessor artifacts only; not source discovery or implementation',
    PREDECESSOR_JSON_SHA256: hashes,
    PREDECESSOR_ARTIFACT_SHA256: Object.fromEntries(preservedBytes),
    ANALYZER_SHA256: hash(readFileSync(script)),
    FROZEN_A1E_PREREQUISITE_INPUT_DIGEST: digest(prior),
    FROZEN_A1E_OPAQUE_INPUT_DIGEST: digest(a1e.opaqueBindingReconciliation),
    FROZEN_A1E_ORDERING_INPUT_DIGEST: digest(a1e.orderingReconciliation),
    SOURCE_RESCAN_PERFORMED: 'NO',
    ADDITIONAL_IO:
      'Only frozen artifacts and frozen migration byte hashes read; governance outputs written',
  },
  CONTRACT_VERSION: 1,
  CONTRACT_STATUS: 'GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING',
  CONTRACT_DOCTRINE: doctrine,
  CANONICAL_UE_OPERATIONAL_BOOTSTRAP_DOCTRINE: doctrine,
  OPERATIONAL_DATABASE_BINDING: 'DJANGO_AND_SCOPED_SAME_TARGET',
  UE_DJANGO_AND_SCOPED_SECURITY_DATABASE: 'SAME_OPERATIONAL_DATABASE_SCOPE',
  FINANCIAL_DATABASE_SCOPE: 'DISTINCT',
  FINANCIAL_SERVICE_DATABASE_SCOPE: 'DISTINCT_GOVERNED_DATABASE_SCOPE',
  FINANCIAL_SERVICE_REQUIRES_OWN_CANONICAL_MATERIALIZER: 'YES',
  ORGANIZATIONS_OPERATIONAL_SCHEMA_OWNER: 'DJANGO',
  ORGANIZATIONS_AUTHORITY:
    'auth_core migration lineage -> Organizations model -> physical organizations relation',
  ORGANIZATIONS_COMPETING_AUTHORITIES_FORBIDDEN: [
    'Historical SQL',
    'Audit SQL',
    'Test fixtures',
    'Drizzle declaration alone',
    'Cleanroom shims',
  ],
  FROZEN_SECURITY_MIGRATION_COUNT: 23,
  FROZEN_MANIFEST_SCOPE_PARTITION: scopeCounts,
  FROZEN_MANIFEST_SCOPE_RULE:
    'Count 23 preserves the accepted composite manifest: UE scoped/platform files execute on the operational scope in original relative order; the financial file remains in the distinct financial sequence, unchanged and non-materializing. Do not execute all 23 on a merged database.',
  ORDER_PRESERVED: 'YES',
  FILE_CONTENT_PRESERVED: 'YES',
  HASH_PRESERVED: 'YES',
  FAILURE_POLICY: 'FAIL_FAST',
  failureDoctrine: {
    FAIL_FAST_ON_MISSING_PREREQUISITE: 'YES',
    FAIL_FAST_ON_MIGRATION_ERROR: 'YES',
    ALLOW_MISSING_OBJECT_TOLERANCE: 'NO',
    ALLOW_SQL_REWRITE_DURING_BOOTSTRAP: 'NO',
    ALLOW_TEST_ONLY_SCHEMA_SHIMS: 'NO',
    ALLOW_UNPINNED_SNAPSHOT: 'NO',
    ALLOW_COMMENT_ONLY_FILE_AS_MATERIALIZER: 'NO',
    ALLOW_BASELINED_HASH_AS_EXECUTED_FILE_PROOF: 'NO',
    CONFLICT_WITH_LATER_FROZEN_PROVIDER:
      'HALT_AND_REQUIRE_SEPARATE_GOVERNANCE; no implicit manifest mutation',
  },
  layers,
  djangoExecutionContract: djangoContract,
  extensionDoctrine: {
    EXTENSION_INSTALLATION: 'EXPLICIT_BOOTSTRAP_STEP',
    EXTENSION_INSTALL_FAILURE: 'FAIL_FAST',
    MANDATORY_EXTENSION_IDS: a1e.extensionAuthority
      .filter((row) => row.DISPOSITION === 'CANONICAL_BOOTSTRAP_INSTALL')
      .map((row) => row.EXTENSION_ID),
    MANDATORY_EXTENSIONS: ['uuid-ossp', 'pgcrypto', 'pg_trgm', 'btree_gin'],
    A1E_INSTALLER_AUTHORITY_IS_RUNTIME_PRESENCE_PROOF: 'NO',
    VECTOR_CANONICAL_REQUIREMENT: 'EXCLUDED_UNLESS_INDEPENDENTLY_REQUIRED_BY_ACCEPTED_CONTRACT',
    VECTOR_PREREQUISITE_OBLIGATION_RETAINED: vectorId,
    VECTOR_DECISION_ID: vectorDecision,
  },
  roleContract: roles,
  searchPathContract: searchPath,
  databaseScopeGovernance: {
    OPERATIONAL_SCOPE: 'union-eyes',
    DJANGO_AND_SCOPED_SAME_SCOPE: 'YES',
    FINANCIAL_SCOPE: 'financial-service',
    DISTINCT_FROM_UE: 'YES',
    EXACT_TARGET_VALUES: 'EXPLICIT_GOVERNANCE_DECISION_REQUIRED',
    DECISION_ID: targetDecision,
    STATIC_BINDING_IS_RUNTIME_PROOF: 'NO',
    SECRET_VALUES_REQUIRED_IN_GOVERNANCE_ARTIFACT: 'NO',
  },
  financialMaterializerSpecification: financialSpec,
  snapshotDoctrine: {
    SNAPSHOT_ROLE: 'OPTIONAL_RECOVERY_OR_ACCELERATION_MECHANISM',
    PRIMARY_ARCHITECTURE: 'NO',
    REQUIRED_FIELDS: [
      'Identity',
      'SHA256',
      'Schema version',
      'Migration level',
      'Provenance',
      'Expected schema digest',
      'Expected policy digest',
      'Forward-migration compatibility',
    ],
    REPLACES_SCHEMA_AUTHORITY: 'NO',
    SELECTED: 'NO',
    DECISION_ID: snapshotDecision,
  },
  cleanroomDoctrine: {
    EXISTING_TOLERANT_CLEANROOM: 'NON_CANONICAL_DIAGNOSTIC_TOOL',
    FAITHFUL_BOOTSTRAP_EVIDENCE_ALLOWED: 'NO',
    REASONS: [
      'Shims',
      'SQL rewrites',
      'Missing-object tolerance',
      'Historical ordering deviations',
    ],
  },
  prerequisiteObligations,
  fullPrerequisiteGovernance,
  opaqueBindingObligations: opaqueObligations,
  orderingObligations,
  additionalContractObligations: additionalObligations,
  governanceDecisionObligations: decisions,
  remediationWorkstreams: workstreams,
  frozenMigrationManifest: manifest,
  predecessorEvidence: {
    PHASE_1B_3C_A1E: 'SOURCE_CEILING_ACCEPTED',
    A1E_PREREQUISITE_CEILINGS_REMAINING: 803,
    A1E_OPAQUE_BINDING_CEILINGS: 118,
    A1E_ORDERING_CEILINGS: 86,
    PHYSICAL_BINDING_SOURCE_RESULT: 'ESTABLISHED_SAME_TARGET',
    A1E_EVIDENCE_REWRITTEN: 'NO',
    DECLARATION_COUNTS: {
      POSTGRES_CORE: 4,
      PRIOR_FROZEN_DECLARATIONS: 134,
      INSTALLER_AUTHORITIES: 4,
    },
    CATALOG_QUARANTINE_DIGEST: digest(a1e.catalogQuarantine),
    CARRY_FORWARD_DIGEST: digest(a1e.carryForward),
  },
  summary: {
    PREREQUISITE_OBLIGATIONS_INPUT: prerequisiteObligations.length,
    PRIMARY_DISPOSITION_COUNTS: count(
      prerequisiteObligations,
      'PRIMARY_DISPOSITION',
      primaryClasses,
    ),
    PREREQUISITE_OBLIGATIONS_SUM: prerequisiteObligations.length,
    FULL_PREREQUISITE_GOVERNANCE_RECORDS: fullPrerequisiteGovernance.length,
    OPAQUE_BINDINGS_INPUT: opaqueObligations.length,
    GOVERNANCE_REMEDIATION_OBLIGATIONS: opaqueObligations.length,
    OPAQUE_CONTRACT_CLASS_COUNTS: count(
      opaqueObligations,
      'REQUIRED_CONTRACT_CLASS',
      bindingClasses,
    ),
    OPAQUE_SUM: opaqueObligations.length,
    ORDERING_OBLIGATIONS_INPUT: orderingObligations.length,
    ORDERING_SUM: orderingObligations.length,
    ORDERING_OWNER_COUNTS: count(orderingObligations, 'CANONICAL_PRECONSUMER_OWNER', [
      'DJANGO',
      'PLATFORM_BASELINE',
      'FINANCIAL_MATERIALIZER',
      'GOVERNANCE_DECISION_REQUIRED',
    ]),
    IMPLEMENTATION_OR_RUNTIME_OBLIGATIONS_RESOLVED: 0,
    UNACCOUNTED: 0,
    GENERIC_UNDISPOSITIONED_PROSPECTIVE_CEILINGS: 0,
    HUMAN_DECISIONS_PENDING: decisions.length,
    WORKSTREAMS: workstreams.length,
  },
  phaseStatus,
  validation: {
    EXACT_ONCE_803_118_86_IDS: 'YES',
    FROZEN_MANIFEST_HASHES_PRESERVED: 'YES',
    PREDECESSOR_JSON_AND_MARKDOWN_UNCHANGED: 'YES',
    SOURCE_RESCAN: 'NO',
    DATABASE_ACCESS: 'NO',
    MIGRATION_EXECUTION: 'NO',
    PACKAGE_CHANGED: 'NO',
    CONFIGURATION_CHANGED: 'NO',
    SCHEMA_OR_RLS_CHANGED: 'NO',
    PRODUCTION_STAGING_SHARED_SYSTEM_TOUCHED: 'NO',
    GOVERNANCE_ONLY_PASS_IS_IMPLEMENTATION_COMPLETION: 'NO',
    EXTERNAL_CHECK_RESULTS:
      'Syntax, deterministic check, scoped formatting and documentation audit are external validations, not inferred from generation',
  },
}
function exact(actual, expected) {
  assert.equal(actual.length, expected.length)
  assert.equal(new Set(actual).size, actual.length)
  assert.deepEqual(new Set(actual), new Set(expected))
}
function validate(report) {
  exact(
    report.prerequisiteObligations.map((row) => row.PREREQUISITE_ID),
    prior.map((row) => row.PREREQUISITE_ID),
  )
  exact(
    report.fullPrerequisiteGovernance.map((row) => row.PREREQUISITE_ID),
    a1e.finalPrerequisiteModel.map((row) => row.PREREQUISITE_ID),
  )
  exact(
    report.opaqueBindingObligations.map((row) => row.OPAQUE_BINDING_ID),
    a1e.opaqueBindingReconciliation.map((row) => row.OPAQUE_BINDING_ID),
  )
  exact(
    report.orderingObligations.map((row) => row.ORDERING_RECORD_ID),
    a1e.orderingReconciliation.map((row) => row.ORDERING_RECORD_ID),
  )
  assert.equal(report.prerequisiteObligations.length, 803)
  assert.equal(report.opaqueBindingObligations.length, 118)
  assert.equal(report.orderingObligations.length, 86)
  assert.equal(
    Object.values(report.summary.PRIMARY_DISPOSITION_COUNTS).reduce((sum, value) => sum + value, 0),
    803,
  )
  const declared = [
    ...report.prerequisiteObligations,
    ...report.opaqueBindingObligations,
    ...report.orderingObligations,
    ...report.additionalContractObligations,
  ]
  const ids = new Set(declared.map((row) => row.OBLIGATION_ID))
  assert.equal(ids.size, declared.length)
  const decisionIds = new Set(report.governanceDecisionObligations.map((row) => row.DECISION_ID))
  assert.equal(decisionIds.size, report.governanceDecisionObligations.length)
  for (const row of report.prerequisiteObligations) {
    assert.ok(primaryClasses.includes(row.PRIMARY_DISPOSITION))
    assert.equal(
      row.PHYSICAL_IDENTITY,
      prior.find((input) => input.PREREQUISITE_ID === row.PREREQUISITE_ID).A1_IDENTITY,
    )
    assert.equal(row.STATUS, state)
    assert.equal(row.IMPLEMENTED, 'NO')
    assert.equal(row.RUNTIME_PROVEN, 'NO')
    assert.ok(row.SECONDARY_DECISION_DEPENDENCIES.every((key) => decisionIds.has(key)))
    assert.ok(
      row.CREATION_AUTHORITY &&
        row.EXECUTION_STEP.length &&
        row.FAILURE_BEHAVIOR &&
        row.VERIFICATION,
    )
  }
  for (const row of report.fullPrerequisiteGovernance) {
    assert.ok(
      row.CREATION_AUTHORITY &&
        row.EXECUTION_STEP.length &&
        row.DATABASE_SCOPE &&
        row.FAILURE_BEHAVIOR &&
        row.VERIFICATION,
    )
    assert.equal(row.IMPLEMENTATION_OR_RUNTIME_RESOLUTION_IN_A1G, 'NO')
    if (row.LINKED_PREREQUISITE_OBLIGATION_ID)
      assert.ok(ids.has(row.LINKED_PREREQUISITE_OBLIGATION_ID))
  }
  for (const row of report.opaqueBindingObligations) {
    const input = a1e.opaqueBindingReconciliation.find(
      (entry) => entry.OPAQUE_BINDING_ID === row.OPAQUE_BINDING_ID,
    )
    assert.deepEqual(row.CURRENT_CONSUMERS, input.CONSUMER_IDS)
    assert.equal(row.PREREQUISITE_ID, input.A1_PREREQUISITE_ID)
    assert.equal(row.INPUT_IDENTITY, input.INPUT_IDENTITY)
    assert.ok(bindingClasses.includes(row.REQUIRED_CONTRACT_CLASS))
    assert.equal(row.WAIVED, 'NO')
    assert.ok(row.REQUIRED_IMPLEMENTATION_EVIDENCE && row.REQUIRED_RUNTIME_EVIDENCE)
  }
  for (const row of report.orderingObligations) {
    const input = a1e.orderingReconciliation.find(
      (entry) => entry.ORDERING_RECORD_ID === row.ORDERING_RECORD_ID,
    )
    assert.equal(row.CONSUMER, input.CURRENT_CONSUMER)
    assert.equal(row.PREREQUISITE, input.PREREQUISITE_ID)
    assert.equal(row.LATER_PROVIDER, input.LATER_PROVIDER)
    assert.equal(row.FROZEN_ORDER_CHANGED, 'NO')
    assert.ok(ids.has(row.LINKED_PREREQUISITE_OBLIGATION_ID))
  }
  const covered = new Set(report.remediationWorkstreams.flatMap((row) => row.INPUT_OBLIGATION_IDS))
  assert.deepEqual(covered, ids)
  const position = new Map(
    report.remediationWorkstreams.map((row, index) => [row.WORKSTREAM_ID, index]),
  )
  assert.equal(position.size, 10)
  for (const stream of report.remediationWorkstreams) {
    assert.ok(
      stream.DEPENDS_ON.every(
        (key) => position.has(key) && position.get(key) < position.get(stream.WORKSTREAM_ID),
      ),
    )
    assert.ok(stream.INPUT_OBLIGATION_IDS.every((key) => ids.has(key)))
    assert.ok(stream.INPUT_DECISION_IDS.every((key) => decisionIds.has(key)))
    assert.equal(stream.STARTED, 'NO')
    assert.equal(stream.COMPLETION_STATUS, 'NOT_STARTED')
    assert.deepEqual(
      stream.NEXT_WORKSTREAMS,
      report.remediationWorkstreams
        .filter((other) => other.DEPENDS_ON.includes(stream.WORKSTREAM_ID))
        .map((other) => other.WORKSTREAM_ID),
    )
  }
  assert.deepEqual(
    report.remediationWorkstreams.find((row) => row.WORKSTREAM_ID === 'W8').DEPENDS_ON,
    ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
  )
  assert.deepEqual(
    report.remediationWorkstreams.find((row) => row.WORKSTREAM_ID === 'W9').DEPENDS_ON,
    ['W8'],
  )
  assert.deepEqual(
    report.remediationWorkstreams.find((row) => row.WORKSTREAM_ID === 'W10').DEPENDS_ON,
    ['W9'],
  )
  assert.equal(report.CONTRACT_STATUS, 'GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING')
  function rejectGenericCeiling(value) {
    if (Array.isArray(value)) value.forEach(rejectGenericCeiling)
    else if (value && typeof value === 'object') Object.values(value).forEach(rejectGenericCeiling)
    else assert.notEqual(value, 'SOURCE_CEILING', 'Generic prospective ceiling without obligation')
  }
  rejectGenericCeiling(report)
  assert.equal(report.CONTRACT_DOCTRINE, doctrine)
  assert.equal(report.ORGANIZATIONS_OPERATIONAL_SCHEMA_OWNER, 'DJANGO')
  assert.equal(report.FINANCIAL_DATABASE_SCOPE, 'DISTINCT')
  assert.deepEqual(
    report.layers.map((row) => row.LAYER_ID),
    ['LAYER_0', 'LAYER_1', 'LAYER_2', 'LAYER_3', 'LAYER_4'],
  )
  assert.deepEqual(report.frozenMigrationManifest, a1e.frozenMigrationManifest)
  assert.equal(report.FROZEN_SECURITY_MIGRATION_COUNT, 23)
  assert.equal(report.financialMaterializerSpecification.IMPLEMENTED, 'NO')
  assert.equal(report.cleanroomDoctrine.FAITHFUL_BOOTSTRAP_EVIDENCE_ALLOWED, 'NO')
  assert.equal(report.phaseStatus.BOOTSTRAP_IMPLEMENTATION_COMPLETE, 'NO')
  for (const key of [
    'PHASE_1B_3C_A1I_STARTED',
    'PHASE_1B_3C_A1R_STARTED',
    'PHASE_1B_3C_A2_STARTED',
    'PHASE_1B_3C_B_STARTED',
  ])
    assert.equal(report.phaseStatus[key], 'NO')
  assert.equal(report.phaseStatus.READY_FOR_RUNTIME_PROOF, 0)
  for (const [file, sha] of preservedBytes)
    assert.equal(hash(readFileSync(absolute(file))), sha, `FAIL_EVIDENCE_DRIFT: ${file}`)
  for (const row of report.frozenMigrationManifest)
    assert.equal(
      hash(readFileSync(absolute(row.FILE))),
      row.SHA256,
      `FAIL_EVIDENCE_DRIFT: ${row.FILE}`,
    )
}
function markdown(report) {
  const counts = report.summary.PRIMARY_DISPOSITION_COUNTS
  return `# Union Eyes canonical runtime schema bootstrap contract

## Status and governance authority

**CONTRACT_VERSION = 1**  
**CONTRACT_STATUS = GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING**  
**PHASE_1B_3C_A1G_GATE = PASS**

This is the maintainer-authorized **prospective** architecture and remediation contract. It creates authority that frozen evidence did not establish. It does not declare implementation, schema materialization, faithful replay, staging/production identity, RLS correctness or product readiness proven. A1E remains SOURCE_CEILING_ACCEPTED with 803/118/86 evidence ceilings; its bytes and conclusions are unchanged.

**Doctrine:** \`${doctrine}\`.

Django owns operational domain materialization, including **auth_core -> Organizations model -> physical organizations relation**. Historical/audit SQL, fixtures, Drizzle declarations alone and cleanroom shims cannot compete for that authority. Django and scoped security share the **same intended operational database scope**. Financial service is a **distinct governed scope** requiring its own canonical materializer; no merge is authorized.

## Exact canonical layers

| Layer | Name | Required completion boundary |
|---|---|---|
${report.layers.map((row) => `| ${row.LAYER_ID} | ${row.NAME} | ${row.EXIT_GATE} |`).join('\n')}

Layer 2 contains only explicitly platform-owned prerequisite producers and must not recreate Django-owned domain relations. Missing owner authority is an explicit human-decision obligation, not permission to fabricate a baseline table.

## Database, roles and search paths

The same-target A1E deployment wiring supports intended scope architecture only. Exact non-secret target identities, per-process mappings and owner contracts require decision **${targetDecision}**. Production database equality and deployed identity runtime proof remain **NO**.

Required role classes: MIGRATION_ADMIN, APPLICATION_RUNTIME, SYSTEM_OR_INTERNAL_RUNTIME, FINANCIAL_MIGRATION and FINANCIAL_RUNTIME. Each must have explicit login/non-login expectation, bypass/ownership/grant boundary, creation and rotation authority. Runtime roles must be non-superuser/non-bypass and must not own RLS-protected domain objects. Exact names and migration ownership/delegation remain blocked on decision **${roleDecision}**; no values are invented and no roles are created.

Schema names, ordered default/migration/runtime search paths and function-specific paths require decision **${pathDecision}**. Frozen qualified public identities constrain compatibility but do not establish every runtime path. Ambient defaults are not a contract; execution is blocked until exact values and trusted lookup/security-definer boundaries are approved.

## Django and extension execution requirements

Future Django entrypoint: locked Python invokes backend/manage.py with config.settings, explicit operational target, \`migrate --noinput\` then \`migrate --check\`. Pin Python, Django, every migration-contributing package, settings module bytes, installed apps, migration modules and swappable-model resolution. Package lock, full plan and expected-schema digests must be produced; range-only declarations do not suffice. All 29 local migration IDs, 26 literal edge IDs and 25 configured app IDs are linked in the JSON.

Mandatory extensions are uuid-ossp, pgcrypto, pg_trgm and btree_gin. Installation is an **explicit fail-fast Layer 0 step**. A1E's four installer resolutions are not runtime presence evidence. Vector is outside the mandatory set unless independently required; decision **${vectorDecision}** must close its exact retained prerequisite without silent optional continuation or waiver.

## Frozen manifest and compatibility

**23 accepted composite files**, original order, bytes and hashes preserved. Scope partition: **${scopeCounts['union-eyes']} UE scoped/platform files and ${scopeCounts['financial-service']} financial file**. UE files execute in their original relative order after real prerequisites; financial retains its distinct corresponding sequence. The comment-only financial file remains unchanged and non-materializing; do not execute all 23 on a merged database or call them the full fresh-schema materializer.

All 86 later-provider records require real preconsumer state **and compatibility with the unchanged later provider**. If a preconsumer producer collides with later CREATE/ALTER semantics, halt for a separate architecture/manifest decision. This contract does not authorize frozen rewrites, reordering, skips or baselined hashes as file execution.

## Exact pending obligations

| Primary prerequisite disposition | Count |
|---|---:|
${Object.entries(counts)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n')}
| **SUM** | **803** |

All 803 IDs receive exactly one primary disposition, explicit creation/owner requirement, execution layer, scope, failure behavior and verification; secondary decisions/dependencies are linked separately. **None is resolved by this conversion.**

The complete 945-prerequisite governance model also retains all 142 previously classified core/prior-frozen/installer-authority identities with explicit execution and verification requirements. Those are not recounted among the 803 and are not promoted to runtime proof.

All **118 opaque IDs** retain consumers, contract class, owner surface and both implementation/runtime evidence requirements; zero waived. Contract-class counts: ${Object.entries(
    report.summary.OPAQUE_CONTRACT_CLASS_COUNTS,
  )
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')}.

All **86 ordering IDs** retain consumer/prerequisite/later provider and one prospective owner disposition. Current owner decisions: ${Object.entries(
    report.summary.ORDERING_OWNER_COUNTS,
  )
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')}. Ownership cannot be inferred merely from a later declaration.

The exact ledgers and per-workstream authorization packet are in [the JSON contract](${contractName}.json). External package/graph, installer verification and global target/path obligations are separately identified and explicitly **not counted in the 803**.

## Financial materializer specification

Financial scope is distinct. An explicit decision must approve the authoritative full schema source. Future implementation must produce a complete executable byte-digested ordered migration manifest; guarded fresh-database entrypoint; fail-fast missing-input/prerequisite/DDL/digest behavior; disposable-only reset/teardown tests; expected and observed schema/migration digests; and a read-only verification command.

Financial sequence: platform prerequisites -> real financial materializer -> non-domain baseline -> unchanged financial frozen input (not materializer) -> read-only verification. Comment-only frozen SQL, partial repairs and missing-file-tolerant runners are non-authoritative. Nothing is implemented or executed here.

## Failure, snapshot and cleanroom doctrines

Fail fast on missing prerequisites or migration errors. No missing-object tolerance, SQL rewrites, test-only schema shims, unpinned snapshots or comment-only materializers.

Snapshot role is **OPTIONAL_RECOVERY_OR_ACCELERATION_MECHANISM**, not primary architecture. Future use requires identity, SHA256, schema version, migration level, provenance, expected schema/policy digests and forward compatibility. It never replaces schema authority.

Existing tolerant cleanroom is a **NON_CANONICAL_DIAGNOSTIC_TOOL** and may never supply faithful-bootstrap evidence.

## W1-W10 remediation and authorization

| Workstream | Objective | Depends on | State |
|---|---|---|---|
${report.remediationWorkstreams.map((row) => `| ${row.WORKSTREAM_ID} | ${row.OBJECTIVE} | ${row.DEPENDS_ON.join(', ') || 'None'} | ${row.AUTHORIZATION_STATE} |`).join('\n')}

See [the implementation specification](${planName}.md) and machine-readable per-workstream change/forbidden surfaces, input obligation IDs, outputs, validation, completion gates and next workstreams in the JSON.

**A1I = AUTHORIZED_NOT_STARTED**. No workstream starts in A1G. W9 faithful execution and W10 full preflight rerun require separate authorization; A1R/A2/B3C-B remain NOT_AUTHORIZED. Implementation unit checks are not replay/runtime proof.

## Verification and preserved proof boundaries

Future Layer 4 is verification only: expected objects/policies/RLS/roles/extensions/functions/types, lineage digest, no shims and no tolerated missing prerequisites; no mutation to make assertions pass.

BOOTSTRAP_IMPLEMENTATION_COMPLETE, FAITHFUL_SCHEMA_REPLAY_PROVEN, PRODUCTION_SCHEMA_PROVEN, PRODUCTION_DATABASE_BINDING_RUNTIME_PROVEN, FAITHFUL_DISPOSABLE_SCHEMA_PROVEN, RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN, TENANT_ISOLATION_RUNTIME_PROVEN and PRODUCT_READY all remain **NO**. Runtime readiness remains **0**, B3C packet **3,124**, and partial C-A catalog evidence stays quarantined.

**NO_FURTHER_BOOTSTRAP_STATIC_SOURCE_PASS = YES.**

## Validation

Generation asserts exact 803/118/86 input IDs, consumer/provider linkage, unique primary dispositions, closed workstream dependencies and frozen predecessor/23-file byte hashes. Syntax, scoped formatting and docs checks are external validations, not assumed from generation:

\`\`\`powershell
node --check scripts\\ue\\adopt-bootstrap-governance-contract.mjs
node scripts\\ue\\adopt-bootstrap-governance-contract.mjs --self-test
node scripts\\ue\\adopt-bootstrap-governance-contract.mjs
node scripts\\ue\\adopt-bootstrap-governance-contract.mjs --check
pnpm exec prettier --check scripts\\ue\\adopt-bootstrap-governance-contract.mjs docs\\union-eyes\\reality-remediation\\${contractName}.json docs\\union-eyes\\reality-remediation\\${contractName}.md docs\\union-eyes\\reality-remediation\\${planName}.md docs\\union-eyes\\PHASE_1_AUTHORITATIVE_INDEXES.md
pnpm validate:docs
\`\`\`

No source rescan, database, migration, dependency/configuration/schema/RLS modification, production/staging/shared-system access or PR. Only governance artifacts and their deterministic emitter/index are changed.
`
}
function planMarkdown(report) {
  return `---
goal: Implement the prospectively governed Union Eyes bootstrap without promoting pending obligations to runtime proof
version: 1
date_created: 2026-10-10
owner: Union Eyes architecture and platform maintainers
status: Planned
tags: [architecture, governance, bootstrap]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This specification implements the [prospective canonical contract](${contractName}.md) only after A1G. Exact machine-readable input obligation IDs and gates are in [the JSON](${contractName}.json). It does not implement W1-W10. Mandatory human-decision records are explicit blocking tasks; agents may not invent their answers.

## 1. Requirements & Constraints

- **REQ-001**: Preserve exact 803 prerequisite, 118 opaque and 86 ordering IDs and all associated consumer/provider references.
- **REQ-002**: Implement layers 0-4 with real Django-owned operational schema, governed preconsumer platform baseline and unchanged frozen consumers.
- **REQ-003**: Use distinct financial scope and its approved full canonical materializer.
- **SEC-001**: Runtime identities are non-superuser/non-bypass and do not own protected domain objects; migration privileges are separated.
- **CON-001**: No frozen migration reorder/rewrite/skip, cleanroom shims, missing-object tolerance or baselined-as-executed evidence.
- **CON-002**: All undecided exact target, schema/search-path, package, owner and role values block dependent execution until human approval is recorded.
- **CON-003**: A1I implementation is authorized but not started. W9/W10 require separate runtime authorization; A1R/A2/B3C-B are not authorized.
- **GUD-001**: Use smallest existing checks covering future changed surfaces; do not infer runtime readiness from unit tests, static manifests or exit status.
- **PAT-001**: Every producer has exact identity, authority, execution step, scope, fail-fast behavior and verification.

## 2. Implementation Steps

${report.remediationWorkstreams
  .map(
    (stream, index) => `### Implementation Phase ${index + 1}

- **GOAL-${String(index + 1).padStart(3, '0')}**: ${stream.OBJECTIVE}; dependencies: ${stream.DEPENDS_ON.join(', ') || 'none'}.

| Task | Description | Completed | Date |
|---|---|---|---|
| TASK-${String(index + 1).padStart(3, '0')} | Process ${stream.WORKSTREAM_ID}'s exact INPUT_OBLIGATION_IDS and INPUT_DECISION_IDS in the JSON. Change only: ${stream.AUTHORIZED_CHANGE_SURFACES.join('; ')}. Produce: ${stream.OUTPUT_ARTIFACTS.join('; ')}. Gate: ${stream.COMPLETION_GATE.join('; ')}. Authorization: ${stream.AUTHORIZATION_STATE}; no execution in A1G. | No | Not started |
`,
  )
  .join('\n')}

## 3. Alternatives

- **ALT-001**: Snapshot-first is not selected; snapshots are optional recovery/acceleration only after provenance/version/digest/compatibility admission.
- **ALT-002**: Existing bootstrap orchestrator without a complete graph/target contract is not canonical merely because commands exist.
- **ALT-003**: Tolerant cleanroom is diagnostic only; shims, rewrites and historical deviations disqualify it from faithful bootstrap evidence.

## 4. Dependencies

- **DEP-001**: W1 and W2 are independently startable after A1I begins; W3 depends on W1/W2; W4 depends on W1/W2/W3.
- **DEP-002**: W5 depends on W4; W6 depends on W1/W2/W3/W4; W7 depends on W2/W3.
- **DEP-003**: W8 depends on all W1-W7; W9 on W8; W10 on W9. W9/W10 additionally require separate runtime authorization.
- **DEP-004**: Every decision dependency is a mandatory approved artifact, not a default or evidence resolution.

## 5. Files

- **FILE-001**: [Canonical contract JSON](${contractName}.json) is the authoritative machine-readable exact obligation, decision, change-surface and completion-gate packet.
- **FILE-002**: [Canonical contract Markdown](${contractName}.md) describes doctrine, layers and proof boundaries.
- **FILE-003**: Future code/lock/configuration surfaces are enumerated per workstream in the JSON; none is changed by this specification.
- **FILE-004**: All 23 accepted frozen file paths/hashes are carried unchanged in the JSON manifest and forbidden as implementation edit surfaces.

## 6. Testing

- **TEST-001**: Assert every 803/118/86 identity and linkage exactly once, no waiver, duplicate or dropped record.
- **TEST-002**: Verify deterministic package/plan/expected-schema/migration digests and exact non-secret per-scope target/role/path mapping.
- **TEST-003**: Fail-fast negative tests cover missing roles/extensions/objects/functions/types, wrong scope, unsupported mandatory extension, missing files and digest mismatches.
- **TEST-004**: Verify all 86 exact preconsumer states are compatible with unchanged later producers; stop rather than tolerate collisions.
- **TEST-005**: Verify all 118 physical/ACL/semantic input/target/conditional contracts and attach future runtime evidence separately.
- **TEST-006**: After separate W9 authorization, run two independent clean disposable faithful replays, compare exact required digests/output shapes and verify teardown. Then seek W10 authorization; no execution now.

## 7. Risks & Assumptions

- **RISK-001**: Preconsumer baseline may conflict with later frozen CREATE/ALTER. Halt for separate human governance; do not weaken the frozen manifest.
- **RISK-002**: Package graphs, runtime privileges or extension availability may differ from declarations; controlled evidence is mandatory before replay proof.
- **RISK-003**: Owner decisions for unassigned relations/columns must not turn platform baseline into synthetic domain DDL.
- **ASSUMPTION-001**: Maintainer authorization adopts doctrine prospectively, not implementation completion or historical evidence closure.
- **ASSUMPTION-002**: A1E remains unchanged with 803/118/86 evidence ceilings; no additional generic source discovery is authorized.

## 8. Related Specifications / Further Reading

- [Frozen A1E evidence](PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE.md)
- [Frozen A1D authority reconciliation](PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT.md)
- [Frozen A1 lineage](PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.md)
- [Prospective canonical contract](${contractName}.md)
`
}
function validatePlan(text) {
  for (const heading of [
    '# Introduction',
    '## 1. Requirements & Constraints',
    '## 2. Implementation Steps',
    '## 3. Alternatives',
    '## 4. Dependencies',
    '## 5. Files',
    '## 6. Testing',
    '## 7. Risks & Assumptions',
    '## 8. Related Specifications / Further Reading',
  ])
    assert.ok(text.includes(heading))
  const declarations = [
    ...[...text.matchAll(/^\| ((?:TASK|GOAL)-\d+) \|/gm)].map((match) => match[1]),
    ...[...text.matchAll(/^- \*\*([A-Z]+-\d+)\*\*:/gm)].map((match) => match[1]),
  ]
  assert.equal(
    new Set(declarations).size,
    declarations.length,
    'Duplicate plan identifier declaration',
  )
}
validate(contract)
const args = process.argv.slice(2)
assert.ok(
  args.length <= 1 && (!args.length || ['--check', '--self-test'].includes(args[0])),
  'Governance generation/check/self-test only; no implementation or execution mode',
)
if (args[0] === '--self-test') {
  validatePlan(planMarkdown(contract))
  const duplicate = structuredClone(contract)
  duplicate.prerequisiteObligations[1] = duplicate.prerequisiteObligations[0]
  assert.throws(() => validate(duplicate))
  const lost = structuredClone(contract)
  lost.opaqueBindingObligations.pop()
  assert.throws(() => validate(lost))
  const cycle = structuredClone(contract)
  cycle.remediationWorkstreams[0].DEPENDS_ON.push('W8')
  assert.throws(() => validate(cycle))
  const premature = structuredClone(contract)
  premature.phaseStatus.BOOTSTRAP_IMPLEMENTATION_COMPLETE = 'YES'
  assert.throws(() => validate(premature))
  console.log(
    'PASS: exact 803/118/86 IDs and linkage; pending-only obligations; workstream graph and plan uniqueness; frozen artifacts/23 hashes; no implementation authority overreach.',
  )
} else {
  const config = await resolveConfig(script)
  const files = [
    [`${contractName}.json`, await format(JSON.stringify(contract), { ...config, parser: 'json' })],
    [`${contractName}.md`, await format(markdown(contract), { ...config, parser: 'markdown' })],
    [`${planName}.md`, await format(planMarkdown(contract), { ...config, parser: 'markdown' })],
  ]
  validatePlan(files[2][1])
  for (const [name, content] of files) {
    const file = absolute(`${base}${name}`)
    if (args[0] === '--check')
      assert.equal(
        readFileSync(file, 'utf8'),
        content,
        `Generated governance artifact drift: ${name}`,
      )
    else writeFileSync(file, content)
  }
  console.log(
    JSON.stringify(
      { CONTRACT_STATUS: contract.CONTRACT_STATUS, ...contract.summary, ...phaseStatus },
      null,
      2,
    ),
  )
}
