import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import {
  planTemplates,
  specifications,
  type BootstrapContract,
  type TargetContract,
} from '../../apps/union-eyes/scripts/provisioning/governed-provisioning'

interface Obligation {
  OBLIGATION_ID: string
  PREREQUISITE_ID?: string
  PHYSICAL_IDENTITY?: string
  SUBJECT?: string
  WORKSTREAM_IDS: string[]
  CURRENT_CONSUMER_REFERENCES?: unknown[]
  REQUIRED_IMPLEMENTATION_EVIDENCE?: string
}
interface Canonical extends BootstrapContract {
  remediationWorkstreams: {
    WORKSTREAM_ID: string
    INPUT_OBLIGATION_IDS: string[]
    INPUT_DECISION_IDS: string[]
  }[]
  prerequisiteObligations: Obligation[]
  additionalContractObligations: Obligation[]
  opaqueBindingObligations: Obligation[]
  orderingObligations: unknown[]
  frozenMigrationManifest: unknown[]
  versionChain: unknown[]
  phaseStatus: Record<string, unknown>
}
interface DatabaseContract extends TargetContract {
  databaseScopes: unknown[]
  schemas: unknown[]
  configurationDrift: {
    W2_CONFIGURATION_DRIFT_ID: string
    ACTOR_ID: string
    REMEDIATION_OWNER: string
    ADDITIONAL_OWNER?: string
  }[]
  downstreamImplementationPacket: {
    OWNER_WORKSTREAM: string
    ACTOR_IDS: string[]
    SCOPE_IDS: string[]
    SCHEMA_IDS: string[]
    SEARCH_PATH_CONTRACT_IDS: string[]
    W2_OBLIGATION_IDS: string[]
    W2_DECISION_IDS: string[]
  }[]
}
const root = fileURLToPath(new URL('../../', import.meta.url))
const folder = 'docs/union-eyes/reality-remediation/'
const files = {
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  database: folder + 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json',
  w2: folder + 'PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json',
  w1: folder + 'PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json',
  w1n: folder + 'PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json',
  lock: 'apps/union-eyes/backend/requirements.lock',
  lockMetadata: 'apps/union-eyes/backend/requirements.lock.metadata.json',
  authority: 'apps/union-eyes/scripts/provision-runtime-db-roles.ts',
  support: 'apps/union-eyes/scripts/provisioning/governed-provisioning.ts',
  tests: 'apps/union-eyes/scripts/provisioning/governed-provisioning.test.ts',
  contract: folder + 'UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.json',
  contractMarkdown: folder + 'UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.md',
  report: folder + 'PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING.json',
  reportMarkdown: folder + 'PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING.md',
}
const absolute = (name: string) => path.join(root, ...name.split('/'))
const read = (name: string) => readFileSync(absolute(name), 'utf8')
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const digest = (value: unknown) => sha(JSON.stringify(value))
const phase = 'PHASE_1B_3C_A1I_W3'
const roleDecision = 'UE-1B3CA1G-DECISION-4e0fdb9b7d80bdb5'
const vectorDecision = 'UE-1B3CA1G-DECISION-7e108c57ea428e21'
const inputKeys = ['canonical', 'database', 'w2', 'w1', 'w1n', 'lock', 'lockMetadata'] as const

async function build() {
  const bytes = Object.fromEntries(inputKeys.map((key) => [key, read(files[key])]))
  const c: Canonical = JSON.parse(bytes.canonical)
  const db: DatabaseContract = JSON.parse(bytes.database)
  const w1 = JSON.parse(bytes.w1)
  const w2 = JSON.parse(bytes.w2)
  const w1n = JSON.parse(bytes.w1n)
  assert.equal(c.CONTRACT_VERSION, '1.2')
  assert.equal(c.phaseStatus.PHASE_1B_3C_A1I_W1_GATE, 'PASS')
  assert.equal(c.phaseStatus.PHASE_1B_3C_A1I_W2_GATE, 'PASS')
  assert.equal(w1.phaseStatus.PHASE_1B_3C_A1I_W1_GATE, 'PASS')
  assert.equal(w2.phaseStatus.PHASE_1B_3C_A1I_W2_GATE, 'PASS')
  assert.equal(sha(bytes.lock), '310eb938f4f7c25b6f93323031981ede60a0d2ef2d68e017a5c9ced33e326fe6')
  assert.equal(
    w1.digests.DJANGO_MIGRATION_GRAPH_DIGEST,
    '73690369f0985a6d3fe33e1d72c66da9d864c0c590590c1628f75c33278e79f1',
  )
  assert.equal(
    w1.digests.DJANGO_MIGRATION_PLAN_DIGEST,
    '447da85fbb379c41d4684ea6dda994c3dad7c98b6bce08d475d01d4bb9bd10e2',
  )
  assert.equal(db.databaseScopes.length, 2)
  assert.equal(db.databaseActors.length, 9)
  assert.equal(db.searchPathContracts.length, 9)
  const work = c.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W3')
  assert(work)
  assert.equal(work.INPUT_OBLIGATION_IDS.length, 11)
  assert.equal(work.INPUT_DECISION_IDS.length, 2)
  assert.deepEqual(work.INPUT_DECISION_IDS, [roleDecision, vectorDecision])
  const specs = specifications(c, db)
  assert.deepEqual(specs.blockers, [roleDecision, vectorDecision])
  const registry = [
    ...c.prerequisiteObligations,
    ...c.opaqueBindingObligations,
    ...c.additionalContractObligations,
  ]
  const exactObligations = work.INPUT_OBLIGATION_IDS.map((id) => {
    const found = registry.filter((o) => o.OBLIGATION_ID === id)
    assert.equal(found.length, 1)
    return found[0]
  })
  const opaque = exactObligations.filter((o) => o.CURRENT_CONSUMER_REFERENCES)
  assert.equal(opaque.length, 4)
  const opaquePacket = opaque.map((o) => ({
    OBLIGATION_ID: o.OBLIGATION_ID,
    W3_ROLE_CLASS_BINDINGS: specs.roles
      .filter((r) => r.DATABASE_SCOPE_ID === 'UE_OPERATIONAL')
      .map((r) => ({ ROLE_CLASS: r.ROLE_CLASS, EXTERNAL_PRINCIPAL_BINDING: r.PRINCIPAL_BINDING })),
    W2_TARGET_SCOPE: 'UE_OPERATIONAL',
    W2_SCHEMA_IDS: ['UE_OPERATIONAL_PUBLIC', 'UE_OPERATIONAL_PG_CATALOG'],
    INPUT_CONSUMER_REFERENCES: o.CURRENT_CONSUMER_REFERENCES,
    PERMITTED_TARGET_SET:
      'Only later exact W4/W6 materialized object/ACL inventory in UE_OPERATIONAL.public; no wildcard object grants or empty-list success',
    DEFAULT_PRIVILEGE_OWNER:
      'W3 no PUBLIC future function EXECUTE; W4/W6 realize exact grants after materialization',
    EXPECTED_OBJECT_TARGETS_REQUIRED_BEFORE_CONSUMER:
      'YES; W4/W6 must supply exact nonempty object identities, owners, ACLs/default ACLs and positive/negative assertions',
    OBJECT_SET_IMPLEMENTED_IN_W3: 'NO',
    W3_ROLE_INPUT_MECHANISM_IMPLEMENTED: 'YES',
    ROLE_APPROVAL_PENDING: roleDecision,
    DOWNSTREAM_OWNER: 'W6',
    RUNTIME_PROVEN: 'NO',
  }))
  const linkage = exactObligations.map((o) => {
    const vector = o.PHYSICAL_IDENTITY?.includes('::EXTENSION::vector')
    const role = o.PHYSICAL_IDENTITY?.includes('::ROLE::')
    const raw = !!o.CURRENT_CONSUMER_REFERENCES
    const implemented = !(vector || role || raw)
    return {
      OBLIGATION_ID: o.OBLIGATION_ID,
      IMPLEMENTED_BY_W3: implemented ? 'YES' : 'NO',
      MECHANISM_IMPLEMENTED: vector
        ? 'GUARD_ONLY; no approved vector install/non-requirement'
        : 'YES',
      IMPLEMENTATION_EVIDENCE: vector
        ? [files.contract, vectorDecision]
        : [files.authority, files.support, files.tests, files.contract],
      PHYSICAL_RUNTIME_APPLIED: 'NO',
      RUNTIME_PROVEN: 'NO',
      COMPLETION_BOUNDARY: vector
        ? 'Human guarded consumer/mandatory-install decision required'
        : role
          ? 'Create/verify mechanism implemented; exact principal/login/ownership/rotation decision remains unapproved'
          : raw
            ? 'W3 input/privilege descriptors implemented; exact object/ACL target expansion explicitly shared with W6; role decision still unapproved'
            : 'Mandatory extension installer/availability/schema/platform-version verification mechanism implemented; live proof remains W8/W9',
      BLOCKING_DECISION_IDS: vector ? [vectorDecision] : role || raw ? [roleDecision] : [],
      DOWNSTREAM_OWNER: raw ? 'W6' : 'W8/W9 runtime execution/proof',
    }
  })
  assert.equal(new Set(linkage.map((o) => o.OBLIGATION_ID)).size, 11)
  const decisions = work.INPUT_DECISION_IDS.map((id) => ({
    DECISION_ID: id,
    DECISION:
      id === vectorDecision
        ? 'GOVERNANCE_DECISION_REQUIRED: each accepted vector consumer must receive approved guarded non-requirement evidence or an approved mandatory fail-fast installation requirement'
        : 'GOVERNANCE_DECISION_REQUIRED: external principal bindings, NOLOGIN staging, no memberships, producer/owner delegation and rotation authority proposals require explicit maintainer approval',
    APPROVED: 'NO',
    IMPLEMENTED_IN_PROVISIONING_CONTRACT: 'GUARD_AND_PROPOSAL_ONLY',
    RUNTIME_PROVEN: 'NO',
    WHY_NOT_ASSUMED:
      id === vectorDecision
        ? 'Version 1.2 explicitly excludes vector from mandatory set unless independently required; no approved requirement decision exists'
        : 'Version 1.2 defers principal and rotation authority. Two frozen runtime name constraints are retained, not promoted into approval of all five classes.',
  }))
  const privilegeContract = {
    TEMP_ALLOWED: 'NO for all five role classes',
    PUBLIC_DATABASE_PRIVILEGES: {
      CONNECT: 'REVOKE; grant scoped named roles only',
      TEMP: 'REVOKE',
      CREATE: 'REVOKE',
    },
    PUBLIC_SCHEMA_PRIVILEGES: {
      USAGE: 'REVOKE PUBLIC; grant scoped named roles only',
      CREATE: 'REVOKE PUBLIC; grant only governed producer class after approval',
    },
    NAMED_RUNTIME_SCHEMA_CREATE: 'DENIED',
    ROLE_MEMBERSHIPS:
      'NONE_IN_EITHER_DIRECTION; effective inherited privileges must also be measured',
    PUBLIC_FUNCTION_EXECUTE:
      'Revoke global AND public-schema default EXECUTE for future approved producers; no hypothetical object grants',
    DEFAULT_PRIVILEGES:
      'W3 manages default PUBLIC EXECUTE restriction only; W4/W6/W7 materialize exact object grants after creation',
    EXISTING_OBJECT_FUNCTION_ACLS:
      'Inventory/closure remains W4/W6/W7; no ALL FUNCTIONS or ALL TABLES broad grant/revoke in W3',
    OWNERSHIP:
      'No database/schema/table ownership transfers; runtime ownership forbidden. Producer object authority is proposal pending exact approval.',
    NOLOGIN_STAGING:
      'Roles are created NOLOGIN; credential activation/rotation is separately approved W8 composition, not silent password handling',
    PASSWORDS:
      'No password generation/read/log/SQL/persistence in W3; future credential adapter consumes values at execution only, not artifacts',
    OPERATOR:
      'Separate external operator prerequisite with install/role/default-privilege authority; no implicit role escalation or runtime reuse',
    SCHEMA_PREEXISTENCE:
      'public must exist with approved nonruntime owner; this provisioner creates no schema',
    IDENTITY_VS_PATH:
      'No ALTER ROLE default search_path: migration/provisioning share a role class but different W2 paths. W8 sets/validates per actor connection.',
  }
  const drift = db.configurationDrift
    .filter((d) => d.REMEDIATION_OWNER === 'W3' || d.ADDITIONAL_OWNER?.includes('W3'))
    .map((d) => ({
      W2_CONFIGURATION_DRIFT_ID: d.W2_CONFIGURATION_DRIFT_ID,
      ACTOR_ID: d.ACTOR_ID,
      W3_IMPLEMENTATION_STATUS: 'MECHANISM_IMPLEMENTED_APPROVAL_AND_APPLICATION_PENDING',
      REMEDIATION_IMPLEMENTED_IN_CODE: 'YES',
      SOURCE_CONFIGURATION_CHANGED: 'NO',
      RUNTIME_ALIGNED: 'NO',
      FUTURE_RUNTIME_VERIFICATION:
        'W8 snapshot/catalog adapter must measure fixed path, effective TEMP/CREATE/ownership/memberships/PUBLIC/default ACLs. W9 proves authorized replay; no runtime success inferred.',
      REMAINING_PRIMARY_OWNER: d.REMEDIATION_OWNER,
    }))
  assert.equal(drift.length, 9)
  const templates = planTemplates(c, db)
  const phaseStatus = {
    PHASE_1B_3C_A1I_W3_GATE: 'BLOCKED',
    PHASE_1B_3C_A1I_W3: 'BLOCKED',
    ROLE_PROVISIONING_IMPLEMENTATION: 'MECHANISM_IMPLEMENTED_GOVERNANCE_PENDING_NOT_APPLIED',
    EXTENSION_PROVISIONING_IMPLEMENTATION:
      'FOUR_MANDATORY_MECHANISMS_IMPLEMENTED_VECTOR_DECISION_PENDING_NOT_APPLIED',
    PROVISIONING_VERIFY_IMPLEMENTATION:
      'OFFLINE_DESCRIPTOR_AND_QUERY_IMPLEMENTED_W8_CATALOG_ADAPTER_REQUIRED_NOT_EXECUTED',
    TEMP_PRIVILEGE_CONTRACT: 'PROPOSED_IMPLEMENTED_NOT_APPLIED',
    PUBLIC_SCHEMA_PRIVILEGE_CONTRACT: 'PROPOSED_IMPLEMENTED_NOT_APPLIED',
    CANONICAL_BOOTSTRAP_CONTRACT_VERSION: '1.2',
    VERSION_1_3_CREATED: 'NO; full W3 gate did not pass',
    W1: 'PASS',
    W2: 'PASS',
    W3_STARTED: 'YES; implementation only',
    W4: 'NOT_AUTHORIZED_BY_W3',
    W4_STARTED: 'NO',
    W5_W10_STARTED: 'NO',
    A1R_STARTED: 'NO',
    A2_STARTED: 'NO',
    B3C_B_STARTED: 'NO',
    DATABASE_ROLES_PROVISIONED: 'NO',
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
  const preservation = Object.fromEntries(
    inputKeys.map((key) => [
      files[key],
      { BEFORE_SHA256: sha(bytes[key]), AFTER_SHA256: sha(read(files[key])), CHANGED: 'NO' },
    ]),
  )
  for (const record of Object.values(preservation))
    assert.equal(record.BEFORE_SHA256, record.AFTER_SHA256)
  if (existsSync(absolute(files.report))) {
    const previous = JSON.parse(read(files.report))
    assert.deepEqual(
      previous.preservation,
      preservation,
      'Frozen input changed after first W3 capture',
    )
  }
  const authority = {
    EXISTING_PROVISIONING_AUTHORITIES: [files.authority],
    SELECTED_CANONICAL_IMPLEMENTATION_SURFACE: files.authority,
    SUPPORT_MODULE: files.support,
    PACKAGE_ENTRYPOINTS: ['db:provision-roles', 'rls:provision-roles'],
    PRIOR_BEHAVIOR:
      'Two hardcoded LOGIN runtime roles, auto-normalized existing attrs, automatic password rotation/Key Vault publishing and CONNECT grants',
    INTENTIONAL_BEHAVIOR_CHANGE:
      'No-argument invocations explicitly fail rather than suggesting provisioning success. --plan never connects. Existing role mismatch fails; no secret/vault access. --apply refuses pending approval/W8 runtime adapter. This replaces the unsafe governance-coupled behavior, not a competing authority.',
    LIVE_ADAPTER_IMPLEMENTED:
      'NO; explicit W8 downstream integration requirement. This lane implements structured SQL and injected single-client transaction apply/verify, not a network connection.',
    IMPLEMENTATION_SHA256: Object.fromEntries(
      [files.authority, files.support, files.tests].map((name) => [name, sha(read(name))]),
    ),
  }
  const validation = {
    W3_INPUT_OBLIGATIONS: 11,
    W3_INPUT_DECISIONS: 2,
    IMPLEMENTED_OBLIGATIONS: linkage.filter((o) => o.IMPLEMENTED_BY_W3 === 'YES').length,
    GOVERNANCE_OR_SHARED_DEPENDENT_OBLIGATIONS: linkage.filter((o) => o.IMPLEMENTED_BY_W3 === 'NO')
      .length,
    OBLIGATION_IDS_LOST: 0,
    OBLIGATION_IDS_DUPLICATED: 0,
    DECISIONS_APPROVED: 0,
    DECISIONS_PENDING: 2,
    ROLE_CLASSES: 5,
    MANDATORY_EXTENSIONS: 4,
    VECTOR_EXTENSION_DISPOSITION: 'GOVERNANCE_DECISION_REQUIRED',
    TWO_SCOPE_PLAN_TEMPLATES: templates.length,
    W3_W2_DRIFT_LINKS: drift.length,
    DETERMINISTIC_SQL_TEMPLATES_SHA256: digest(templates),
    TEST_AUTHORITY: files.tests,
    NO_DATABASE_CONNECTION: true,
    NO_SQL_EXECUTION: true,
    NO_SECRET_ACCESS: true,
    NO_DEPLOYMENT_CONFIGURATION_MUTATION: true,
    NO_ROLE_EXTENSION_SCHEMA_GRANT_OR_RLS_RUNTIME_MUTATION: true,
  }
  const contract = {
    metadata: {
      PHASE: phase,
      METHOD:
        'Frozen artifact plus selected provisioning-source implementation; offline descriptors/tests only',
      FROZEN_INPUT_SHA256: Object.fromEntries(
        inputKeys.map((key) => [files[key], sha(bytes[key])]),
      ),
      W3_INPUT_OBLIGATION_IDS: work.INPUT_OBLIGATION_IDS,
      W3_INPUT_DECISION_IDS: work.INPUT_DECISION_IDS,
    },
    CONTRACT_STATUS: 'IMPLEMENTATION_DRAFT_GOVERNANCE_BLOCKED_NOT_APPLIED',
    authority,
    roleSpecifications: specs.roles,
    extensionSpecifications: specs.extensions,
    VECTOR_EXTENSION_DISPOSITION: specs.VECTOR_EXTENSION_DISPOSITION,
    targetValidation: {
      SOURCE: files.database,
      REQUIRED_SCOPES: ['UE_OPERATIONAL', 'FINANCIAL_SERVICE'],
      REQUIRED_FIELDS: [
        'TARGET_ID',
        'DATABASE_SCOPE_ID',
        'DATABASE_ACTOR_ID',
        'HOST_BINDING',
        'PORT_BINDING',
        'DATABASE_NAME_BINDING',
        'ROLE_CLASS',
        'SEARCH_PATH_CONTRACT_ID',
        'ENVIRONMENT_ID',
        'HOST',
        'PORT',
        'DATABASE_NAME',
        'SEARCH_PATH',
      ],
      REJECTIONS: [
        'Missing/duplicate scope',
        'Wrong actor/target/binding/path/role',
        'Ambient/default target',
        'Unknown URL/PG* overrides',
        'Cross-scope physical target collision',
        'Cross-environment',
        'Missing/injected/reserved principal',
        'Principal alias/cross-scope collision',
        'Credential/secret-bearing descriptor',
      ],
      PRE_SQL_IDENTITY_CHECK:
        'Exact target descriptor plus current_database/current_user/current_role/fixed path/no temp namespace; one injected transaction client; W8 must supply authenticated descriptor/catalog adapter',
    },
    privilegeContract,
    planTemplates: templates,
    modes: {
      PLAN: 'Offline unbound specifications or bound deterministic SQL plan; no client/environment/secret access',
      APPLY:
        'CLI refuses; exported executePlan requires zero governance blockers, untampered plan and W8 single-client transaction adapter. Preflight all role/extension descriptors before first SQL; abort/rollback on any failure; postflight exact privileges.',
      VERIFY:
        'CLI --verify --bindings FILE --scope SCOPE --snapshot FILE is offline. Exported verify path uses same snapshot/catalog contract and issues no mutation; live adapter belongs to W8.',
      PASSWORD_ACTIVATION:
        'Not implemented or executed; blocked pending principal/login/rotation approval and later W8 credential composition',
    },
    opaqueRoleBindingPacket: opaquePacket,
    governanceDecisions: decisions,
    obligationLinkage: linkage,
    w2DriftReconciliation: drift,
    downstreamImplementationPacket: [
      {
        OWNER: 'HUMAN_GOVERNANCE',
        DECISION_IDS: [roleDecision, vectorDecision],
        REQUIRED:
          'Approve exact principal/rotation/login/ownership rules and vector per-consumer disposition; never infer closure from four mandatory installs',
      },
      ...db.downstreamImplementationPacket
        .filter((p) => ['W3', 'W4', 'W6', 'W7', 'W8'].includes(p.OWNER_WORKSTREAM))
        .map((p) => ({
          ...p,
          W3_OBLIGATION_IDS: work.INPUT_OBLIGATION_IDS,
          W3_DECISION_IDS: work.INPUT_DECISION_IDS,
          W3_MECHANISM: files.authority,
          STARTED_BY_THIS_PACKET: 'NO',
          REQUIRED:
            p.OWNER_WORKSTREAM === 'W8'
              ? 'After separate authority and decision closure, implement authenticated catalog/single-client transaction adapter, approved operator authority, real external principal target bindings, credential activation and all non-secret effective snapshots before replay'
              : 'Consume scoped role/extension/privilege inputs only after approvals; exact object grants/ACL inventory remains owned by physical/binding/materializer lanes',
        })),
    ],
    preservation,
    validation,
    phaseStatus,
  }
  const report = {
    ...contract,
    VERSION_1_SHA256: w1n.PRIOR_CONTRACT_SHA256,
    VERSION_1_1_SHA256: w2.VERSION_1_1_SHA256,
    VERSION_1_2_SHA256: sha(bytes.canonical),
    PRIOR_VERSION_CHAIN: c.versionChain,
    CANONICAL_CONTRACT_AMENDED: 'NO; W3 blocked, version 1.3 requires full PASS',
    frozenUniverses: {
      PREREQUISITES: {
        COUNT: c.prerequisiteObligations.length,
        SHA256: digest(c.prerequisiteObligations),
      },
      OPAQUE: {
        COUNT: c.opaqueBindingObligations.length,
        SHA256: digest(c.opaqueBindingObligations),
      },
      ORDERING: { COUNT: c.orderingObligations.length, SHA256: digest(c.orderingObligations) },
      FROZEN_SECURITY_MANIFEST: {
        COUNT: c.frozenMigrationManifest.length,
        SHA256: digest(c.frozenMigrationManifest),
      },
      W2_ACTOR_SCHEMA_SCOPE_PATH_SHA256: digest([
        db.databaseScopes,
        db.databaseActors,
        db.schemas,
        db.searchPathContracts,
      ]),
    },
  }
  const prettier = await resolveConfig(absolute(files.contract))
  return {
    [files.contract]: await format(JSON.stringify(contract), { ...prettier, parser: 'json' }),
    [files.report]: await format(JSON.stringify(report), { ...prettier, parser: 'json' }),
    [files.contractMarkdown]: await format(
      markdown(
        false,
        linkage,
        specs.roles.map((r) => r.ROLE_CLASS),
      ),
      { ...prettier, parser: 'markdown' },
    ),
    [files.reportMarkdown]: await format(
      markdown(
        true,
        linkage,
        specs.roles.map((r) => r.ROLE_CLASS),
      ),
      { ...prettier, parser: 'markdown' },
    ),
  }
}
function markdown(
  report: boolean,
  linkage: { OBLIGATION_ID: string; IMPLEMENTED_BY_W3: string; COMPLETION_BOUNDARY: string }[],
  roles: string[],
) {
  return `# ${report ? 'W3 — role/extension provisioning implementation report' : 'Role/extension provisioning contract draft'}

## Gate: BLOCKED — genuine governance decisions remain

Canonical contract remains **1.2**, byte-for-byte unchanged. Version 1.3 and W4 authorization are **not** created. W1/W2 remain frozen PASS. [Exact contract](UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.json) and [exact W3 report](PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING.json) record preserved inputs, SQL digests and every obligation/decision ID.

## Selected authority and CLI boundary

Selected existing authority: [provision-runtime-db-roles.ts](../../../apps/union-eyes/scripts/provision-runtime-db-roles.ts), with one [support module](../../../apps/union-eyes/scripts/provisioning/governed-provisioning.ts) and [offline tests](../../../apps/union-eyes/scripts/provisioning/governed-provisioning.test.ts). Both existing package entrypoints still select this surface. No competing provisioner or Key Vault authority is introduced.

Intentional safety change: no-argument invocations explicitly fail; --plan is offline. Existing automatic role-attribute normalization, password rotation and Key Vault publishing are removed from this governed entrypoint; attribute/membership drift fails rather than being overwritten. --apply refuses pending governance and missing W8 integration. Credential activation is a later explicitly approved operation, not a hidden fallback. Existing deployments cannot treat the old no-argument command as successful applied provisioning.

Five classes: ${roles.join(', ')}. All stage NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, NOINHERIT, with no role memberships. These are guarded proposals pending the exact role/login/owner/rotation decision. Names require external bindings; the two frozen runtime names are compatibility constraints only, not approval of all principal identities. Ordinary/system/financial runtime own no schema/domain/helper/financial objects. Approved migration producers alone may create their governed domain/platform or financial objects; they are never permanent runtime identities.

## Target, privilege and extension contract

Plans require exactly one UE_OPERATIONAL descriptor and one distinct FINANCIAL_SERVICE descriptor, with W2 actor/target/scope/role/path/host/port/database binding identities, explicit environment and physical host/port/database. Missing/ambient/conflicting URL/PG* fields and cross-scope/cross-environment aliases fail offline before SQL. Provisioning path is fixed pg_catalog; no role default path replaces W2 per-actor paths.

PUBLIC CONNECT/TEMP/database CREATE and public USAGE/CREATE are explicitly restricted; named scoped roles receive CONNECT/USAGE, and approved producers alone receive public CREATE. Effective privileges, role memberships in both directions, database/schema ownership and grant options must be verified, not merely direct named ACLs. Runtime TEMP/CREATE and ownership are denied.

Both global and schema-local future-function default PUBLIC EXECUTE are revoked for approved creators; per-object grants/ACL/default-ACL realization remains W4/W6/W7 after materialization. No ALL PRIVILEGES, hypothetical object grant or table ownership transfer is generated. Existing function ACL/role-binding object sets remain exact downstream duties, not blanket grants.

Mandatory extensions remain exactly **uuid-ossp, pgcrypto, pg_trgm, btree_gin**, operational scope only; none is invented for financial scope. Installation targets public explicitly, before consumers, on the same transaction client. PLATFORM_PROVIDED_VERSION means compare the selected platform default/control metadata and installed version/schema; wrong schema/version, absent availability or incompatible schema support fails. Existing extensions are never relocated or silently upgraded. No runtime version/presence is claimed.

**vector = GOVERNANCE_DECISION_REQUIRED**, not mandatory/optional-waived. Decision \`${vectorDecision}\` is still HUMAN_DECISION_REQUIRED in 1.2; each accepted consumer needs explicit guarded non-requirement evidence or approved mandatory installation. Decision \`${roleDecision}\` still requires exact principal/login/ownership/rotation authority. Neither is invented.

## Deterministic plan and verify mechanism

JSON contains two nonexecutable SQL templates and SHA256 digests. Placeholder principals/databases are required external binding slots, never production identities. Bound plans quote strict identifiers and parameterize catalog value queries. Absence creates/installs; matching descriptors accept; existing role/extension drift aborts before mutation. Install failures propagate; transaction adapter must rollback. Postflight verifies effective PUBLIC/named privileges, defaults, memberships, ownership and exact extension state.

No database library is imported or client created. W8 must implement the authenticated catalog adapter, validate connected target identity, provide one transaction client and approve operator/credential activation before runtime use. Exported apply/verify mechanics use an injected adapter; CLI verify compares a non-secret offline descriptor snapshot and explicitly does not claim runtime proof.

\`\`\`powershell
pnpm --filter @nzila/union-eyes db:provision-roles --plan
pnpm --filter @nzila/union-eyes db:provision-roles --plan --scope UE_OPERATIONAL --bindings <non-secret-bindings.json>
pnpm --filter @nzila/union-eyes db:provision-roles --verify --scope UE_OPERATIONAL --bindings <non-secret-bindings.json> --snapshot <non-secret-snapshot.json>
pnpm exec tsx scripts\\ue\\implement-role-extension-contract.ts --check
\`\`\`

## Exact W3 obligation accounting

| Obligation ID | Implemented by W3 | Boundary |
|---|---|---|
${linkage.map((o) => `| ${o.OBLIGATION_ID} | ${o.IMPLEMENTED_BY_W3} | ${o.COMPLETION_BOUNDARY} |`).join('\n')}

Exact denominator: **11 obligations, two decisions**, none lost or duplicated. Four installer verification mechanisms are implemented; seven role/vector/shared-ACL obligations remain explicitly dependent. Four opaque input bindings preserve consumer references and the W3 role input mechanism, but exact object target/default ACL expansion is shared with W6 and is not falsely closed. All PHYSICAL_RUNTIME_APPLIED and RUNTIME_PROVEN values remain NO.

Nine W2 drift records owned or co-owned by W3 link to this implementation; SOURCE_CONFIGURATION_CHANGED = NO and RUNTIME_ALIGNED = NO. The W3 primary provisioning and financial provisioning records and all effective TEMP/CREATE co-owner records are carried forward. The W8/W9 adapter must measure them before faithful replay.

## Preservation, validation and authorization

Whole-file preservation records cover canonical 1.2, W2 contract/report, W1/W1N and lock/metadata. The complete 1/1.1/1.2 reconstruction references remain; 803/118/86 universes, 23 frozen manifest hashes and all W2 actor/scope/schema/path identities remain unchanged. No W1/W2 reopening. Canonical contract is not amended while W3 remains blocked.

Offline positive/negative tests cover target/scope/principal binding, matching/drifted roles, absent/unavailable/drifted extensions, PUBLIC inherited privileges, TEMP/CREATE/ownership/default ACLs, identifier injection, secret redaction, transaction failure and read-only verify. Run scoped type checks, deterministic generator/check, formatting, docs and independent preservation/exact-ID assertions at closeout.

No PostgreSQL connection/SQL execution, role/extension/schema creation, grant/revoke execution, default-privilege application, secret access, deployment configuration/migration/RLS change or PR creation occurred. DATABASE_ROLES_PROVISIONED = NO; EXTENSIONS_RUNTIME_PROVEN = NO; DATABASE_RUNTIME_CONFIGURATION_APPLIED/PROVEN = NO; DJANGO_SCHEMA_MATERIALIZED = NO; PRECONSUMER_BASELINE_MATERIALIZED = NO; BOOTSTRAP_IMPLEMENTATION_COMPLETE = NO; FAITHFUL_SCHEMA_REPLAY_PROVEN = NO; PRODUCTION_SCHEMA_PROVEN = NO; RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN = NO; TENANT_ISOLATION_RUNTIME_PROVEN = NO; READY_FOR_RUNTIME_PROOF = 0; PRODUCT_READY = NO.

**W3 = BLOCKED; W4 not authorized by W3 and not started.** W5-W10, A1R/A2/B3C-B are not started.
`
}
async function main() {
  const args = process.argv.slice(2)
  assert(args.every((a) => a === '--check' || a === '--self-test'))
  if (JSON.parse(read(files.canonical)).CONTRACT_VERSION === '1.3') {
    const { runAlignment } = await import('./align-w3-delegation-contract.mjs')
    await runAlignment(args)
    return
  }
  const outputs = await build()
  assert.deepEqual(outputs, await build(), 'Nondeterministic W3 outputs')
  if (args.includes('--check')) {
    for (const [name, text] of Object.entries(outputs))
      assert.equal(read(name), text, `Stale W3 output: ${name}`)
    console.log(
      'PASS: deterministic W3 check; frozen 1.2/W1/W2 preserved; gate BLOCKED by exact two governance decisions',
    )
  } else if (!args.includes('--self-test')) {
    for (const [name, text] of Object.entries(outputs)) writeFileSync(absolute(name), text)
    console.log(
      'W3 artifacts generated: mechanism not applied; exact 11 obligations/two pending decisions; BLOCKED; no 1.3/W4 authorization',
    )
  }
  if (args.includes('--self-test'))
    console.log(
      'PASS: exact frozen IDs, extension universe, two deterministic templates and pending-decision guards',
    )
}
main().catch((error: unknown) => {
  console.error(
    '[implement-role-extension-contract]',
    error instanceof Error ? error.message : 'Generator failed',
  )
  process.exitCode = 1
})
