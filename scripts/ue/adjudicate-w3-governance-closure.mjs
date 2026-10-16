import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = fileURLToPath(new URL('../../', import.meta.url))
const folder = 'docs/union-eyes/reality-remediation/'
const inputs = {
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  database: folder + 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json',
  provisioning: folder + 'UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.json',
  w3: folder + 'PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING.json',
  w3Markdown: folder + 'PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING.md',
  w1: folder + 'PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json',
  w1n: folder + 'PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json',
  w2: folder + 'PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json',
}
const outputs = {
  json: folder + 'PHASE_1B_3C_A1I_W3D_GOVERNANCE_DECISION_COMPATIBILITY.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W3D_GOVERNANCE_DECISION_COMPATIBILITY.md',
}
const absolute = (name) => path.join(root, ...name.split('/'))
const read = (name) => readFileSync(absolute(name), 'utf8')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const digest = (value) => sha(JSON.stringify(value))
const roleDecision = 'UE-1B3CA1G-DECISION-4e0fdb9b7d80bdb5'
const vectorDecision = 'UE-1B3CA1G-DECISION-7e108c57ea428e21'
const sectionNames = [
  'authority',
  'roleSpecifications',
  'extensionSpecifications',
  'targetValidation',
  'privilegeContract',
  'planTemplates',
  'modes',
  'opaqueRoleBindingPacket',
  'w2DriftReconciliation',
  'downstreamImplementationPacket',
  'validation',
]

function exact(actual, expected) {
  assert.equal(new Set(actual).size, actual.length)
  assert.deepEqual(actual, expected)
}

function checkCompatibility(provisioning, delegation) {
  const conflicts = []
  if (delegation.LOGIN_PRINCIPAL_MAY_ASSUME_ITS_AUTHORIZATION_ROLE === 'YES') {
    const roles = provisioning.roleSpecifications.filter(
      (r) => r.ROLE_MEMBERSHIP_EXPECTATION === 'NO_MEMBERSHIPS_IN_EITHER_DIRECTION',
    )
    if (roles.length) {
      conflicts.push({
        CONFLICT_ID: 'UE-W3D-CONFLICT-AUTHORIZED-DELEGATION-VS-ZERO-MEMBERSHIPS',
        DECISION_ID: roleDecision,
        ROLE_CLASSES: roles.map((r) => r.ROLE_CLASS),
        ACCEPTED_IMPLEMENTATION_EXPECTATION: 'NO_MEMBERSHIPS_IN_EITHER_DIRECTION',
        APPROVED_GOVERNANCE_EXPECTATION:
          'Separate external login principal may assume exactly its governed NOLOGIN authorization role',
        VERIFICATION_EVIDENCE: provisioning.planTemplates.map((t) => ({
          DATABASE_SCOPE_ID: t.DATABASE_SCOPE_ID,
          ROLE_MEMBERSHIP_QUERY: t.VERIFY_SQL.find((q) => q.ID === 'ROLE-MEMBERSHIPS'),
        })),
        WHY_METADATA_ONLY_IS_INSUFFICIENT:
          'A login principal delegated to an authorization role is a member of that role. The accepted descriptor contract rejects memberRoles in addition to memberships; its recorded query includes either direction. Passing an empty memberRoles projection would hide actual catalog state and is not an honest alignment.',
        PROVISIONING_PHASE_SEPARATION:
          'Zero memberships can be valid before W8 login delegation. It is not a post-delegation verification contract. Existing artifacts do not explicitly establish a distinct pre-delegation verifier boundary plus governed post-delegation verifier.',
        REQUIRED_BOUNDED_AUTHORIZATION: [
          'Permit an explicit lifecycle boundary: W3 verifier is pre-delegation only and W8 must implement a separate exact post-delegation verifier before runtime acceptance',
          'Or permit a scoped verifier/spec/test change allowing only the explicitly bound direct login-to-authorization membership, with no admin option, cross-scope/runtime-to-migration/nested delegation',
        ],
        IMPLEMENTATION_CHANGED_BY_W3D: 'NO',
      })
    }
  }
  return conflicts
}

async function build() {
  const bytes = Object.fromEntries(Object.entries(inputs).map(([key, file]) => [key, read(file)]))
  const c = JSON.parse(bytes.canonical)
  const p = JSON.parse(bytes.provisioning)
  const w3 = JSON.parse(bytes.w3)
  const db = JSON.parse(bytes.database)
  const w1 = JSON.parse(bytes.w1)
  const w1n = JSON.parse(bytes.w1n)
  const w2 = JSON.parse(bytes.w2)
  assert.equal(c.CONTRACT_VERSION, '1.2')
  assert.equal(c.phaseStatus.PHASE_1B_3C_A1I_W1_GATE, 'PASS')
  assert.equal(c.phaseStatus.PHASE_1B_3C_A1I_W2_GATE, 'PASS')
  assert.equal(w3.phaseStatus.PHASE_1B_3C_A1I_W3_GATE, 'BLOCKED')
  const work = c.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W3')
  assert(work)
  exact(
    p.obligationLinkage.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
  )
  exact(
    p.governanceDecisions.map((d) => d.DECISION_ID),
    work.INPUT_DECISION_IDS,
  )
  assert.equal(work.INPUT_OBLIGATION_IDS.length, 11)
  assert.equal(p.obligationLinkage.filter((o) => o.IMPLEMENTED_BY_W3 === 'YES').length, 4)
  assert.equal(p.opaqueRoleBindingPacket.length, 4)
  assert.equal(p.w2DriftReconciliation.length, 9)
  assert.equal(p.roleSpecifications.length, 5)
  assert.equal(p.planTemplates.length, 2)
  assert.deepEqual(
    p.extensionSpecifications.map((e) => e.EXTENSION),
    ['uuid-ossp', 'pgcrypto', 'pg_trgm', 'btree_gin'],
  )
  for (const template of p.planTemplates) {
    assert.equal(template.SQL_SHA256, digest(template.OPERATIONS.map((o) => [o.ID, o.SQL])))
    assert.equal(template.TEMPLATE_SHA256, digest([template.OPERATIONS, template.VERIFY_SQL]))
  }
  const delegation = {
    ROLE_IDENTITY_MODEL: 'EXTERNAL_LOGIN_PRINCIPAL_BOUND_TO_CANONICAL_NOLOGIN_AUTHORIZATION_ROLE',
    EXTERNAL_PRINCIPAL_BINDINGS: p.roleSpecifications.map((r) => ({
      ROLE_CLASS: r.ROLE_CLASS,
      DATABASE_SCOPE_ID: r.DATABASE_SCOPE_ID,
      EXTERNAL_PRINCIPAL_BINDING: r.PRINCIPAL_BINDING,
      EXISTING_FROZEN_AUTHORIZATION_NAME_CONSTRAINT: r.FROZEN_REQUIRED_NAME,
    })),
    EXTERNAL_PRINCIPAL_BINDING_REQUIRED: 'YES',
    HARDCODED_DEFAULT_PRINCIPAL: 'NO',
    AMBIENT_CURRENT_USER_FALLBACK: 'NO',
    INFERRED_PRINCIPAL_NAME: 'NO',
    CANONICAL_AUTHORIZATION_ROLES_LOGIN: 'NOLOGIN',
    CANONICAL_AUTHORIZATION_ROLE_PASSWORD: 'NONE',
    CANONICAL_AUTHORIZATION_ROLE_SECRET_ROTATION: 'NOT_APPLICABLE',
    LOGIN_PRINCIPAL_CREATION: 'OUTSIDE_W3',
    LOGIN_PRINCIPAL_BINDING: 'REQUIRED_BEFORE_RUNTIME_EXECUTION',
    LOGIN_PRINCIPAL_SECRET_STORAGE: 'EXTERNAL_SECRET_AUTHORITY',
    LOGIN_PRINCIPAL_SECRET_ROTATION: 'EXTERNAL_SECRET_DEPLOYMENT_AUTHORITY',
    LOGIN_PRINCIPAL_MAY_ASSUME_ITS_AUTHORIZATION_ROLE: 'YES',
    CROSS_SCOPE_ROLE_MEMBERSHIP: 'PROHIBITED',
    RUNTIME_TO_MIGRATION_ROLE_MEMBERSHIP: 'PROHIBITED',
    ADMIN_OPTION: 'NO',
    ROLE_ADMINISTRATION: 'NO',
    NESTED_DELEGATION: 'NO',
    ROTATION_AUTHORITY: 'GOVERNED_SECRET_MANAGEMENT_AND_DEPLOYMENT_AUTHORITY',
    REPOSITORY_SECRET_ROTATION_AUTHORITY: 'NO',
    DATABASE_AUTHORIZATION_ROLE_ROTATION_AUTHORITY: 'NO',
    LOGIN_BINDING_IMPLEMENTATION_OWNER: 'W8',
    ROLE_OWNERSHIP: p.roleSpecifications.map((r) => ({
      ROLE_CLASS: r.ROLE_CLASS,
      MAY_OWN_DOMAIN_TABLES: r.MAY_OWN_DOMAIN_TABLES,
      MAY_OWN_PLATFORM_HELPERS: r.MAY_OWN_PLATFORM_HELPERS,
      MAY_OWN_FINANCIAL_TABLES: r.MAY_OWN_FINANCIAL_TABLES,
      ACTIVATION: r.ROLE_CLASS.includes('MIGRATION')
        ? 'BOUNDED_BOOTSTRAP_OR_MIGRATION_EXECUTION_ONLY'
        : 'CORRESPONDING_RUNTIME_CLASS_ONLY',
      OWNERSHIP_RUNTIME_PROVEN: 'NO',
    })),
    PRIVILEGED_ATTRIBUTES: {
      SUPERUSER: 'NO',
      BYPASSRLS: 'NO',
      CREATEDB: 'NO',
      CREATEROLE: 'NO',
      REPLICATION: 'NO',
    },
  }
  const vector = c.prerequisiteObligations.find(
    (o) => o.PHYSICAL_IDENTITY === 'union-eyes::EXTENSION::vector',
  )
  assert(vector)
  const explicitMandatory =
    c.extensionDoctrine.MANDATORY_EXTENSIONS.includes('vector') ||
    p.extensionSpecifications.some((e) => e.EXTENSION === 'vector' && e.MANDATORY)
  const consumers = vector.REQUIRED_BEFORE_CONSUMER_IDS.map((id) => ({
    CONSUMER_ID: id,
    OBLIGATION_ID: vector.OBLIGATION_ID,
    DECISION_ID: vectorDecision,
    DISPOSITION: explicitMandatory
      ? 'EXPLICIT_VECTOR_REQUIREMENT_ALREADY_PRESENT'
      : 'CURRENTLY_NOT_AUTHORIZED_TO_REQUIRE_VECTOR',
    GOVERNANCE_GUARDED_NON_REQUIREMENT_ACCEPTED: explicitMandatory ? 'NO' : 'YES',
    SOURCE_SEMANTICS_OR_REPLAY_PROVEN: 'NO',
    FUTURE_VECTOR_DEPENDENCY:
      'FAIL_CONTRACT_DRIFT unless explicit consumer/prerequisite/amendment/provisioning/availability sequence approved',
    EVIDENCE:
      'Version 1.2 vector prerequisite permits approved guarded non-requirement OR mandatory fail-fast installation; vector excluded from exact four mandatory extensions. No source rescan.',
  }))
  exact(
    consumers.map((r) => r.CONSUMER_ID),
    vector.REQUIRED_BEFORE_CONSUMER_IDS,
  )
  const conflicts = checkCompatibility(p, delegation)
  assert.equal(conflicts.length, 1)
  const decisions = [
    {
      DECISION_ID: roleDecision,
      DECISION_STATUS: 'APPROVED_BY_W3D_MAINTAINER_INSTRUCTION',
      APPROVED: 'YES',
      CONTRACT_VALUE: delegation,
      IMPLEMENTATION_COMPATIBILITY:
        'NO; existing zero-membership verifier conflicts with authorized login delegation',
      INTEGRATED_IN_CANONICAL_CONTRACT: 'NO; compatibility STOP, no silent version 1.2 mutation',
    },
    {
      DECISION_ID: vectorDecision,
      DECISION_STATUS: explicitMandatory
        ? 'REJECTED_GOVERNANCE_CONTRADICTION'
        : 'APPROVED_BY_W3D_MAINTAINER_INSTRUCTION',
      APPROVED: explicitMandatory ? 'NO' : 'YES',
      VECTOR_EXTENSION_DISPOSITION: 'OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED',
      VECTOR_IN_CANONICAL_BASELINE: 'NO',
      VECTOR_MANDATORY_INSTALLATION: 'NO',
      VECTOR_AUTOMATIC_INSTALLATION: 'NO',
      VECTOR_SILENT_AVAILABILITY_ASSUMPTION: 'NO',
      CONSUMER_RECONCILIATION: consumers,
      INTEGRATED_IN_CANONICAL_CONTRACT: 'NO; compatibility STOP prevents full 1.3 publication',
    },
  ]
  exact(
    decisions.map((d) => d.DECISION_ID),
    work.INPUT_DECISION_IDS,
  )
  const obligationModel = p.obligationLinkage.map((o) => ({
    OBLIGATION_ID: o.OBLIGATION_ID,
    PRIOR_IMPLEMENTED_BY_W3: o.IMPLEMENTED_BY_W3,
    W3_CONTRACT_COMPONENT_COMPLETE:
      o.IMPLEMENTED_BY_W3 === 'YES' || o.OBLIGATION_ID === vector.OBLIGATION_ID
        ? 'YES'
        : 'NO; role/delegation verification compatibility pending',
    CLASSIFICATION:
      o.IMPLEMENTED_BY_W3 === 'YES'
        ? 'IMPLEMENTED_BY_W3'
        : p.opaqueRoleBindingPacket.some((b) => b.OBLIGATION_ID === o.OBLIGATION_ID)
          ? 'DOWNSTREAM_OBJECT_ACL_IMPLEMENTATION_W6'
          : o.OBLIGATION_ID === vector.OBLIGATION_ID
            ? 'RUNTIME_PROOF_LATER'
            : 'RUNTIME_BINDING_W8',
    DOWNSTREAM_OWNER: p.opaqueRoleBindingPacket.some((b) => b.OBLIGATION_ID === o.OBLIGATION_ID)
      ? 'W6'
      : 'W8/W9',
    DOWNSTREAM_IMPLEMENTATION_PENDING: 'YES',
    RUNTIME_PROVEN: 'NO',
    NORMALIZATION_APPLIED: 'NO; compatibility STOP, prior linkage preserved',
  }))
  const preservation = Object.fromEntries(
    Object.entries(inputs).map(([key, file]) => [
      file,
      {
        BEFORE_SHA256: sha(bytes[key]),
        AFTER_SHA256: sha(read(file)),
        CHANGED: 'NO',
      },
    ]),
  )
  for (const entry of Object.values(preservation))
    assert.equal(entry.BEFORE_SHA256, entry.AFTER_SHA256)
  const sectionProof = Object.fromEntries(
    sectionNames.map((key) => [
      key,
      {
        BEFORE_SHA256: digest(p[key]),
        AFTER_SHA256: digest(JSON.parse(read(inputs.provisioning))[key]),
        CHANGED: 'NO',
      },
    ]),
  )
  for (const entry of Object.values(sectionProof))
    assert.equal(entry.BEFORE_SHA256, entry.AFTER_SHA256)
  const report = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W3D',
      METHOD:
        'Fixed artifact-only decision compatibility adjudication; no source rescan or provisioning edits',
    },
    governanceDecisions: decisions,
    compatibilityConflicts: conflicts,
    vectorConsumerReconciliation: consumers,
    normalizedObligationProposal: obligationModel,
    preservation,
    w3SectionPreservation: sectionProof,
    implementationCodeHashReferences: p.authority.IMPLEMENTATION_SHA256,
    IMPLEMENTATION_CODE_READ_OR_EDITED:
      'NO; existing hash references preserved; only existing tests/type/lint may read source during validation',
    CHANGE_FLAGS: Object.fromEntries(
      [
        'PROVISIONER_CODE_CHANGED',
        'ROLE_SQL_CHANGED',
        'EXTENSION_SQL_CHANGED',
        'VERIFY_SQL_CHANGED',
        'TARGET_VALIDATION_CHANGED',
        'PRIVILEGE_BOUNDARY_CHANGED',
        'W3_IMPLEMENTATION_DIGEST_CHANGED',
      ].map((k) => [k, 'NO']),
    ),
    priorVersionChain: {
      VERSION_1_SHA256: w1n.PRIOR_CONTRACT_SHA256,
      VERSION_1_1_SHA256: w2.VERSION_1_1_SHA256,
      VERSION_1_2_SHA256: sha(bytes.canonical),
      VERSION_1_3_CREATED: 'NO',
    },
    validation: {
      OBLIGATIONS: 11,
      DECISIONS: 2,
      DECISIONS_APPROVED_AS_INTENT: decisions.filter((d) => d.APPROVED === 'YES').length,
      INSTALLER_MECHANISMS_PRESERVED: 4,
      OPAQUE_ROLE_BINDINGS_PRESERVED: 4,
      W2_DRIFT_RECORDS_PRESERVED: 9,
      PLAN_TEMPLATES_PRESERVED: 2,
      VECTOR_CONSUMERS: consumers.length,
      VECTOR_EXPLICIT_MANDATORY_CONTRADICTION: explicitMandatory ? 'YES' : 'NO',
      IMPLEMENTATION_GOVERNANCE_COMPATIBILITY:
        'FAIL; authorized role membership contradicts accepted no-memberships descriptor contract',
      W1_DISTRIBUTIONS: w1.lockedDistributions.length,
      W1_DJANGO: w1.validation.DJANGO_VERSION_LOCKED,
      W2_ACTORS: db.databaseActors.length,
      W2_SCOPES: db.databaseScopes.length,
      W2_PATHS: db.searchPathContracts.length,
      PREREQUISITES: c.prerequisiteObligations.length,
      OPAQUE: c.opaqueBindingObligations.length,
      ORDERING: c.orderingObligations.length,
      FROZEN_MANIFEST: c.frozenMigrationManifest.length,
      NO_RUNTIME_OR_CONFIGURATION_ACTION: true,
    },
    phaseStatus: {
      PHASE_1B_3C_A1I_W3D_GATE: explicitMandatory
        ? 'FAIL_GOVERNANCE_CONTRADICTION'
        : 'BLOCKED_IMPLEMENTATION_GOVERNANCE_CONFLICT',
      PHASE_1B_3C_A1I_W3_GATE: 'BLOCKED',
      CANONICAL_CONTRACT_VERSION: '1.2',
      W1: 'PASS',
      W2: 'PASS',
      W4: 'NOT_AUTHORIZED_BY_W3D',
      W4_STARTED: 'NO',
      W5_W10_STARTED: 'NO',
      A1R_STARTED: 'NO',
      A2_STARTED: 'NO',
      B3C_B_STARTED: 'NO',
      DATABASE_ROLES_PROVISIONED: 'NO',
      LOGIN_PRINCIPALS_BOUND: 'NO',
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
    },
  }
  if (existsSync(absolute(outputs.json))) {
    assert.deepEqual(
      JSON.parse(read(outputs.json)).preservation,
      preservation,
      'Accepted artifact changed after compatibility capture',
    )
  }
  const config = await resolveConfig(absolute(outputs.json))
  const markdown = `# W3D — governance decision compatibility adjudication

## Gate: BLOCKED_IMPLEMENTATION_GOVERNANCE_CONFLICT

The explicit W3D maintainer instruction approves the role identity/delegation intent and guarded vector non-requirement. They are recorded in the [decision packet](PHASE_1B_3C_A1I_W3D_GOVERNANCE_DECISION_COMPATIBILITY.json), but **not integrated into canonical 1.2** because the unchanged accepted verifier contract conflicts with authorized delegation. W3 remains BLOCKED; no 1.3/PASS/W4 authorization is fabricated.

## Two authorized decisions

- \`${roleDecision}\`: externally bound LOGIN principal may assume exactly its scope-local NOLOGIN authorization role; no passwords/rotation on authorization roles, no cross-scope/runtime-to-migration/nested/admin-option delegation, no privileged attributes. Existing five principal binding keys and frozen authorization-name constraints are preserved. Runtime owns no domain/helper/financial objects; migration authorization owns only legitimate scope-local producer objects. LOGIN principal creation, credentials, rotation and bounded migration activation belong to external secret/deployment authority and W8, not W3.
- \`${vectorDecision}\`: OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED. Exactly ${consumers.length} recorded consumers receive one artifact-backed CURRENTLY_NOT_AUTHORIZED_TO_REQUIRE_VECTOR classification; no explicit mandatory vector declaration appears in the permitted extension/prerequisite linkage. This is governance non-requirement, **not source/replay semantic proof**. Any future vector-dependent consumer fails contract drift until an explicit consumer/prerequisite/amendment/provisioning/availability sequence is approved. The four mandatory extensions remain unchanged.

## Concrete compatibility conflict

All five accepted [W3 role specifications](UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.json) require **NO_MEMBERSHIPS_IN_EITHER_DIRECTION**; the privilege contract likewise says NONE_IN_EITHER_DIRECTION. Both preserved SQL templates query pg_auth_members for roles appearing as either granted role or member role. The W3 snapshot/verifier contract rejects memberRoles as well as memberships.

Authorizing LOGIN_PRINCIPAL → authorization role necessarily creates a member of that authorization role. That legitimate member conflicts with the unchanged W3 descriptor contract. Hiding it by returning an empty catalog projection is not valid verification. Zero memberships may be a correct **pre-delegation** provisioner check, but no distinct pre-delegation/post-delegation verifier lifecycle is established in the accepted artifacts.

Bounded next authorization needed: explicitly limit the W3 verifier to the pre-delegation phase and require a separate exact W8 post-delegation verifier, **or** authorize a scoped verifier/spec/test change for only the governed direct login delegation. This mission forbids reimplementation, so neither change was made. Publishing 1.3/PASS while the mechanism's recorded membership expectation contradicts the decision would be false completion.

## Eleven-obligation model and preservation

All 11 IDs are retained exactly once in the JSON proposal. The four implemented installer mechanisms remain implemented. Seven dependency records retain their W6 object-ACL / W8 binding / later proof duties; role-dependent completion is not promoted while compatibility is unresolved. All four opaque packets, nine drift links and two SQL/verify templates remain unchanged.

Whole-file before/after hashes cover canonical 1.2, W1/W1N/W2, database contract and W3 JSON/Markdown. Section hashes preserve role/extension specifications, target validation, privilege/mode contracts, templates, opaque/drift/downstream packets and historical validation. Accepted provisioning/test code hashes remain referenced unchanged; no source rescan or code edit occurs. Required change flags are all NO.

## Version and proof boundary

Canonical version remains **1.2**, SHA256 \`${sha(bytes.canonical)}\`. Its version 1/1.1 reconstruction chain is retained, not replaced. No 1.3 amendment is written while compatibility is blocked. The 803/118/86 universes, 23 frozen manifest hashes and W1/W2 namespace models are preserved.

W3D is blocked on implementation/governance compatibility, **not a missing human decision**. W3 remains BLOCKED; W4 is not authorized and not started. Roles, LOGIN bindings, credentials, extensions, grants, schema/RLS/deployment changes and runtime proof remain NO; READY_FOR_RUNTIME_PROOF = 0. No later workstream or PR was started.

## Validation

Artifact-only deterministic generator/check and synthetic compatibility/exact-ID tests:

\`\`\`powershell
node --check scripts\\ue\\adjudicate-w3-governance-closure.mjs
node scripts\\ue\\adjudicate-w3-governance-closure.mjs --self-test --check
\`\`\`

Existing 39 W3 tests, scoped types/ESLint, formatting, docs and independent preservation/version-chain/consumer/ID checks are run at closeout. Passing unchanged offline tests is preservation evidence, not proof the new delegation decision is compatible.
`
  return {
    [outputs.json]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
  }
}

async function main() {
  const args = process.argv.slice(2)
  assert(args.every((arg) => ['--self-test', '--check'].includes(arg)))
  if (JSON.parse(read(inputs.canonical)).CONTRACT_VERSION === '1.3') {
    assert(
      args.length > 0,
      'W3D is historical after W3E; use --self-test --check, not regeneration',
    )
    const closure = JSON.parse(
      read(folder + 'PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.json'),
    )
    for (const file of [outputs.json, outputs.markdown])
      assert.equal(sha(read(file)), closure.preservation[file].BEFORE_SHA256)
    const historical = JSON.parse(read(outputs.json))
    assert.equal(
      historical.phaseStatus.PHASE_1B_3C_A1I_W3D_GATE,
      'BLOCKED_IMPLEMENTATION_GOVERNANCE_CONFLICT',
    )
    exact(
      historical.vectorConsumerReconciliation.map((r) => r.CONSUMER_ID),
      closure.vectorConsumerReconciliation.map((r) => r.CONSUMER_ID),
    )
    assert.equal(closure.phaseStatus.PHASE_1B_3C_A1I_W3E_GATE, 'PASS')
    assert.equal(sha(read(inputs.canonical)), closure.VERSION_1_3_SHA256)
    console.log(
      'PASS: W3D historical blocked evidence remains unchanged; superseded by W3E exact delegation closure, canonical 1.3',
    )
    return
  }
  const first = await build()
  assert.deepEqual(first, await build())
  if (args.includes('--self-test')) {
    const p = JSON.parse(read(inputs.provisioning))
    assert.equal(
      checkCompatibility(p, { LOGIN_PRINCIPAL_MAY_ASSUME_ITS_AUTHORIZATION_ROLE: 'YES' }).length,
      1,
    )
    assert.equal(
      checkCompatibility(p, { LOGIN_PRINCIPAL_MAY_ASSUME_ITS_AUTHORIZATION_ROLE: 'NO' }).length,
      0,
    )
    assert.throws(() => exact(['duplicate', 'duplicate'], ['a', 'b']))
    console.log(
      'PASS: artifact-only compatibility detects zero-membership/delegation conflict; exact IDs preserved',
    )
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(first))
      assert.equal(read(file), bytes, `Stale W3D report: ${file}`)
    console.log(
      'PASS: deterministic compatibility report and frozen artifact preservation; W3D remains blocked',
    )
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(first)) writeFileSync(absolute(file), bytes)
    console.log(
      'W3D decision intent recorded; compatibility STOP; canonical 1.2 and W3 implementation untouched',
    )
  }
}

await main()
