import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  quoteIdentifier,
  rejectSecretFields,
  validateBindings,
  specifications,
  type BindingPacket,
  type BootstrapContract,
  type TargetContract,
  type TargetDescriptor,
} from '../../apps/union-eyes/scripts/provisioning/governed-provisioning'

export const root = fileURLToPath(new URL('../../', import.meta.url))
const folder = 'docs/union-eyes/reality-remediation/'
export const inputFiles = {
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  target: folder + 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json',
  roles: folder + 'UE_ROLE_EXTENSION_PROVISIONING_CONTRACT.json',
  w1: folder + 'PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json',
  w1n: folder + 'PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json',
  w2: folder + 'PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json',
  w3e: folder + 'PHASE_1B_3C_A1I_W3E_DELEGATION_MEMBERSHIP_ALIGNMENT.json',
  lineage: folder + 'PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE.json',
}
export const outputFiles = {
  contract: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  markdown: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.md',
  report: folder + 'PHASE_1B_3C_A1I_W4_PRECONSUMER_PHYSICAL_PRODUCERS.json',
  reportMarkdown: folder + 'PHASE_1B_3C_A1I_W4_PRECONSUMER_PHYSICAL_PRODUCERS.md',
}
export const read = (file: string) => readFileSync(path.join(root, ...file.split('/')), 'utf8')
export const sha = (value: string) => createHash('sha256').update(value).digest('hex')
export const digest = (value: unknown): string => sha(JSON.stringify(value))
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sorted(v)]),
    )
  return value
}
export const w1Digest = (value: unknown) => sha(JSON.stringify(sorted(value)))
const id = (kind: string, value: string) => `UE-W4-${kind}-${sha(value).slice(0, 16)}`
const producerId = (migration: string) => id('DJANGO-PRODUCER', migration)

interface Operation {
  OPERATION_CLASS: string
  LINE: number
  PHYSICAL_DB_EFFECT: string
  STATE_EFFECT: string
  PARENT_OPERATION: string | null
}
interface Migration {
  MIGRATION_ID: string
  APP_LABEL: string
  MIGRATION_NAME: string
  SOURCE_CLASS: string
  SOURCE_FILE: string
  FILE_SHA256: string
  DISTRIBUTION_NAME: string | null
  DISTRIBUTION_VERSION: string | null
  OPERATIONS: Operation[]
}
interface Obligation {
  OBLIGATION_ID: string
  PREREQUISITE_ID?: string
  PHYSICAL_IDENTITY?: string
  DATABASE_SCOPE?: string
  PREREQUISITE_KIND?: string
  CREATION_AUTHORITY?: string
  DJANGO_AUTHORITY_CANDIDATE_IDS?: string[]
  SOURCE_CANDIDATE_IDS?: string[]
  REQUIRED_BEFORE_CONSUMER_IDS?: string[]
  SECONDARY_DECISION_DEPENDENCIES: string[]
  WORKSTREAM_IDS: string[]
  ORDERING_RECORD_ID?: string
  PREREQUISITE?: string
  LINKED_PREREQUISITE_OBLIGATION_ID?: string
  CONSUMER?: string
  LATER_PROVIDER?: string
  OPAQUE_BINDING_ID?: string
  INPUT_IDENTITY?: string
}
interface Decision {
  DECISION_ID: string
  SUBJECT: string
  STATUS: string
  REQUIRED_DECISION_RECORD: string
  AFFECTED_PREREQUISITE_IDS: string[]
}
interface Canonical extends BootstrapContract {
  remediationWorkstreams: {
    WORKSTREAM_ID: string
    INPUT_OBLIGATION_IDS: string[]
    INPUT_DECISION_IDS: string[]
  }[]
  prerequisiteObligations: Obligation[]
  additionalContractObligations: Obligation[]
  orderingObligations: Obligation[]
  opaqueBindingObligations: Obligation[]
  governanceDecisionObligations: (Decision & { DECISION_ID: string; STATUS: string })[]
  djangoExecutionContract: {
    PACKAGE_LOCK_DIGEST: string
    MIGRATION_GRAPH_DIGEST: string
    MIGRATION_PLAN_DIGEST: string
    CONFIGURED_APP_IDS: string[]
    DJANGO_SETTINGS_MODULE: string
  }
  frozenMigrationManifest: unknown[]
  phaseStatus: Record<string, unknown>
  ORGANIZATIONS_OPERATIONAL_SCHEMA_OWNER: string
}
interface W1 {
  metadata: { SETTINGS_SHA256: string }
  configuredApps: { APP_ID: string }[]
  lockedDistributions: { DISTRIBUTION: string; VERSION: string; ARTIFACT_SHA256: string }[]
  migrationNodes: Migration[]
  migrationEdges: {
    EDGE_ID: string
    FROM_MIGRATION: string
    TO_MIGRATION: string
    RESOLUTION: string
    REPLACEMENT_IS_LINEAGE_NOT_EXECUTION_DEPENDENCY: boolean
  }[]
  canonicalMigrationPlan: { MIGRATION_ID: string; ORDER_INDEX: number; FILE_SHA256: string }[]
  migrationSources: { APP_LABEL: string; PACKAGE_SOURCE_DIGEST: string }[]
  rawOperationRegistry: {
    RAW_OPERATION_ID: string
    MIGRATION_ID: string
    OPERATION_CLASS: string
    LINE: number
    FUTURE_WORKSTREAM: string
    SOURCE_REFERENCE: { FILE: string; FILE_SHA256: string; LINE: number }
  }[]
  packageAuthority: { TARGET: unknown }
  swappableConfiguration: unknown
  digests: {
    DJANGO_PACKAGE_LOCK_DIGEST: string
    DJANGO_MIGRATION_GRAPH_DIGEST: string
    DJANGO_MIGRATION_PLAN_DIGEST: string
  }
  validation: { DJANGO_VERSION_LOCKED: string; INPUT_CONFIGURED_APPS: number }
}
interface W1N {
  NORMALIZED_OBLIGATION_MODEL: {
    OBLIGATIONS: { OBLIGATION_ID: string; CREATION_AUTHORITY?: string }[]
    DJANGO_PHYSICAL_OBLIGATIONS: number
    RAW_OPERATION_OWNERSHIP: {
      OBLIGATION_ID: string
      MIGRATION_ID: string
      RAW_OPERATION_OWNERS: { RAW_OPERATION_ID: string; FUTURE_WORKSTREAM: string }[]
    }[]
  }
}
interface Candidate {
  CANDIDATE_ID: string
  SOURCE_FILE: string
  PHYSICAL_OBJECT: string
  COLUMN_NAMES: string[]
  CREATES_OBJECT: string
  SOURCE_EVIDENCE: { FILE: string; FILE_SHA256: string; LINE: number }
}
interface Lineage {
  creationSourceCandidates: Candidate[]
  frozenMigrationManifest: unknown[]
}
export interface W4Target extends TargetContract {
  databaseActors: (TargetContract['databaseActors'][number] & { SCHEMA_IDS: string[] })[]
  databaseScopes: unknown[]
}
export interface Inputs {
  canonical: Canonical
  target: W4Target
  roles: {
    extensionSpecifications: { EXTENSION: string }[]
    VECTOR_EXTENSION_DISPOSITION: string
    phaseStatus: Record<string, unknown>
  }
  w1: W1
  w1n: W1N
  w2: { phaseStatus: Record<string, unknown> }
  w3e: {
    phaseStatus: Record<string, unknown>
    VERSION_1_3_SHA256: string
    vectorConsumerReconciliation: unknown[]
  }
  lineage: Lineage
}
export function loadInputs(): Inputs {
  return {
    canonical: JSON.parse(read(inputFiles.canonical)),
    target: JSON.parse(read(inputFiles.target)),
    roles: JSON.parse(read(inputFiles.roles)),
    w1: JSON.parse(read(inputFiles.w1)),
    w1n: JSON.parse(read(inputFiles.w1n)),
    w2: JSON.parse(read(inputFiles.w2)),
    w3e: JSON.parse(read(inputFiles.w3e)),
    lineage: JSON.parse(read(inputFiles.lineage)),
  }
}
export function exactIds(actual: (string | undefined)[], expected: (string | undefined)[]): void {
  assert(
    actual.every((value) => typeof value === 'string'),
    'Missing identity',
  )
  assert.equal(new Set(actual).size, actual.length, 'Duplicate identity')
  assert.deepEqual(actual, expected, 'Identity universe drift')
}
export function validateGraph(
  nodes: { PRODUCER_ID: string; REQUIRES_PRODUCER_IDS: string[] }[],
): string[] {
  const byId = new Map(nodes.map((n) => [n.PRODUCER_ID, n]))
  assert.equal(byId.size, nodes.length, 'DUPLICATE_PRODUCER_IDS')
  const done = new Set<string>()
  const visiting = new Set<string>()
  const order: string[] = []
  function visit(nodeId: string) {
    assert(byId.has(nodeId), 'UNRESOLVED_PRODUCER_REFERENCE')
    assert(!visiting.has(nodeId), 'PRODUCER_GRAPH_CYCLE')
    if (done.has(nodeId)) return
    visiting.add(nodeId)
    for (const dependency of byId.get(nodeId)!.REQUIRES_PRODUCER_IDS) visit(dependency)
    visiting.delete(nodeId)
    done.add(nodeId)
    order.push(nodeId)
  }
  for (const node of nodes) visit(node.PRODUCER_ID)
  return order
}
export function validateAuthorities(
  rows: { PHYSICAL_IDENTITY: string; CREATE_AUTHORITY: string }[],
) {
  const authorities = new Map<string, string>()
  for (const row of rows) {
    const previous = authorities.get(row.PHYSICAL_IDENTITY)
    assert(!previous || previous === row.CREATE_AUTHORITY, 'MULTIPLE_CREATION_AUTHORITIES')
    authorities.set(row.PHYSICAL_IDENTITY, row.CREATE_AUTHORITY)
  }
}
export function validateSql(sql: string) {
  assert(/^\s*SELECT\b/i.test(sql), 'W4_ONLY_READ_ONLY_VERIFICATION_SQL_SUPPORTED')
  assert(
    !/\b(CREATE|ALTER|DROP|TRUNCATE|DELETE|INSERT|UPDATE|GRANT|REVOKE)\b/i.test(sql),
    'UNSAFE_W4_SQL',
  )
  assert(!/;\s*\S/.test(sql), 'MULTIPLE_SQL_STATEMENTS')
}
export function postcondition(obligation: Obligation) {
  assert(obligation.PHYSICAL_IDENTITY && obligation.PREREQUISITE_KIND, 'PHYSICAL_IDENTITY_REQUIRED')
  const parts = obligation.PHYSICAL_IDENTITY.split('::')[2].split('.')
  assert.equal(parts[0], 'public', 'UNEXPECTED_SCHEMA')
  const [schema, relation, column] = parts
  quoteIdentifier(relation)
  if (column) quoteIdentifier(column)
  const sql =
    obligation.PREREQUISITE_KIND === 'COLUMN'
      ? 'SELECT n.nspname AS schema_name, c.relname AS relation_name, a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type, a.attnotnull AS not_null, pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expression, r.rolname AS owner FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid = a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace JOIN pg_catalog.pg_roles r ON r.oid = c.relowner LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum WHERE n.nspname = $1 AND c.relname = $2 AND a.attname = $3 AND a.attnum > 0 AND NOT a.attisdropped;'
      : "SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind, r.rolname AS owner FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace JOIN pg_catalog.pg_roles r ON r.oid = c.relowner WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind IN ('r', 'p');"
  assert(
    ['RELATION', 'COLUMN'].includes(obligation.PREREQUISITE_KIND),
    'POSTCONDITION_KIND_UNSUPPORTED',
  )
  validateSql(sql)
  return {
    POSTCONDITION_ID: id('POSTCONDITION', obligation.OBLIGATION_ID),
    OBLIGATION_ID: obligation.OBLIGATION_ID,
    PHYSICAL_IDENTITY: obligation.PHYSICAL_IDENTITY,
    DATABASE_SCOPE_ID: 'UE_OPERATIONAL',
    SQL: sql,
    PARAMETER_VALUES: column ? [schema, relation, column] : [schema, relation],
    EXPECTED_ROWS: 1,
    OWNER_CLASS: 'MIGRATION_ADMIN',
    EXPECTED_TYPE_NULLABILITY_DEFAULT:
      'Locked Django migration state is authority; W9 must compare catalog values with that exact state, not infer types from existence',
    EXPECTED_RUNTIME_PROOF: 'YES',
    EXISTING_STATE: [
      'ABSENT_EXPECTED_ON_FRESH_BOOTSTRAP',
      'PRESENT_MATCHING',
      'PRESENT_DRIFTED_FAIL_UNLESS_EXACT_CANONICAL_MIGRATION_TRANSITION',
    ],
    RUNTIME_VERIFY_OWNER: 'W9',
    RUNTIME_PROVEN: 'NO',
  }
}
export interface DjangoExecutionInput {
  target: TargetDescriptor
  bindings: BindingPacket
  settingsModule: string
  settingsFileSha256: string
  dependencyLockDigest: string
  graphDigest: string
  planDigest: string
  configuredAppIds: string[]
  packageEnvironmentIdentity: unknown
  swappableConfigurationIdentity: string
  authorizationRole: string
  loginPrincipal: string
}
export function prepareDjangoExecution(packet: DjangoExecutionInput, inputs: Inputs) {
  rejectSecretFields(packet)
  exactIds(Object.keys(packet).sort(), [
    'authorizationRole',
    'bindings',
    'configuredAppIds',
    'dependencyLockDigest',
    'graphDigest',
    'loginPrincipal',
    'packageEnvironmentIdentity',
    'planDigest',
    'settingsFileSha256',
    'settingsModule',
    'swappableConfigurationIdentity',
    'target',
  ])
  assert.equal(packet.settingsModule, 'config.settings', 'FAIL_CONTRACT_DRIFT_SETTINGS_MODULE')
  assert.equal(
    packet.settingsFileSha256,
    inputs.w1.metadata.SETTINGS_SHA256,
    'FAIL_CONTRACT_DRIFT_SETTINGS_BYTES',
  )
  assert.equal(
    packet.dependencyLockDigest,
    inputs.w1.digests.DJANGO_PACKAGE_LOCK_DIGEST,
    'FAIL_CONTRACT_DRIFT_LOCK',
  )
  assert.equal(
    packet.graphDigest,
    inputs.w1.digests.DJANGO_MIGRATION_GRAPH_DIGEST,
    'FAIL_CONTRACT_DRIFT_GRAPH',
  )
  assert.equal(
    packet.planDigest,
    inputs.w1.digests.DJANGO_MIGRATION_PLAN_DIGEST,
    'FAIL_CONTRACT_DRIFT_PLAN',
  )
  exactIds(
    packet.configuredAppIds,
    inputs.w1.configuredApps.map((a) => a.APP_ID),
  )
  assert.equal(
    digest(packet.packageEnvironmentIdentity),
    digest(inputs.w1.packageAuthority.TARGET),
    'FAIL_CONTRACT_DRIFT_PACKAGE_ENVIRONMENT',
  )
  assert.equal(
    packet.swappableConfigurationIdentity,
    digest(inputs.w1.swappableConfiguration),
    'FAIL_CONTRACT_DRIFT_SWAPPABLE_IDENTITY',
  )
  validateBindings(
    packet.bindings,
    inputs.target,
    specifications(inputs.canonical, inputs.target).roles,
  )
  const actor = inputs.target.databaseActors.find((a) => a.ACTOR_PURPOSE === 'DJANGO_MIGRATION')
  assert(actor, 'DJANGO_ACTOR_MISSING')
  const provision = packet.bindings.targets.find((t) => t.DATABASE_SCOPE_ID === 'UE_OPERATIONAL')
  assert(provision, 'OPERATIONAL_TARGET_MISSING')
  const expected = {
    ...provision,
    DATABASE_ACTOR_ID: actor.DATABASE_ACTOR_ID,
    ROLE_CLASS: actor.ROLE_CLASS,
    SEARCH_PATH_CONTRACT_ID: actor.SEARCH_PATH_CONTRACT_ID,
  }
  const search = inputs.target.searchPathContracts.find(
    (p) => p.SEARCH_PATH_CONTRACT_ID === actor.SEARCH_PATH_CONTRACT_ID,
  )
  assert(search, 'DJANGO_PATH_MISSING')
  expected.SEARCH_PATH = search.SEARCH_PATH
  assert.deepEqual(packet.target, expected, 'FAIL_CONTRACT_DRIFT_DJANGO_TARGET_PATH')
  assert.equal(actor.DATABASE_SCOPE_ID, 'UE_OPERATIONAL', 'FINANCIAL_SCOPE_FORBIDDEN')
  assert.equal(actor.ROLE_CLASS, 'MIGRATION_ADMIN', 'DJANGO_MIGRATION_AUTHORITY_REQUIRED')
  assert.equal(
    packet.authorizationRole,
    packet.bindings.principals.MIGRATION_ADMIN,
    'FAIL_CONTRACT_DRIFT_AUTHORIZATION',
  )
  assert.equal(
    packet.loginPrincipal,
    packet.bindings.loginPrincipals.MIGRATION_ADMIN,
    'FAIL_CONTRACT_DRIFT_LOGIN',
  )
  return {
    PRODUCER_CLASS: 'DJANGO_MIGRATION_PRODUCER',
    EXECUTION_KIND: 'DJANGO_BOOTSTRAP_PRODUCER',
    TARGET: packet.target,
    AUTHORIZATION_ROLE: packet.authorizationRole,
    LOGIN_PRINCIPAL: packet.loginPrincipal,
    SETTINGS_MODULE: packet.settingsModule,
    REQUIRED_PACKAGE_ENVIRONMENT: packet.packageEnvironmentIdentity,
    ARGV: ['manage.py', 'migrate', '--noinput', '--settings=config.settings'],
    MIGRATION_PLAN_IDENTITY: packet.planDigest,
    ONE_INVOCATION_FOR_COMPLETE_GRAPH: 'YES; never invoke migrate once per plan row',
    EXECUTION: 'NO',
    STANDALONE_APPLY: 'BLOCKED',
    FUTURE_EXECUTION_OWNER:
      'W8; separately authorized authenticated execution adapter and package/settings/source-byte attestation required',
  }
}

export function buildProducerContract(inputs: Inputs) {
  const { canonical: c, w1, w1n, target, lineage } = inputs
  assert.equal(c.CONTRACT_VERSION, '1.3', 'FROZEN_CANONICAL_VERSION_DRIFT')
  for (const gate of [
    'PHASE_1B_3C_A1I_W1_GATE',
    'PHASE_1B_3C_A1I_W2_GATE',
    'PHASE_1B_3C_A1I_W3_GATE',
  ])
    assert.equal(c.phaseStatus[gate], 'PASS')
  assert.equal(c.ORGANIZATIONS_OPERATIONAL_SCHEMA_OWNER, 'DJANGO')
  assert.equal(inputs.w3e.phaseStatus.PHASE_1B_3C_A1I_W3E_GATE, 'PASS')
  assert.equal(w1.validation.DJANGO_VERSION_LOCKED, '5.2.18')
  assert.equal(w1.lockedDistributions.length, 87)
  assert.equal(w1.configuredApps.length, 25)
  exactIds(
    w1.configuredApps.map((app) => app.APP_ID),
    c.djangoExecutionContract.CONFIGURED_APP_IDS,
  )
  assert.equal(w1.migrationNodes.length, 82)
  assert.equal(c.prerequisiteObligations.length, 803)
  assert.equal(c.opaqueBindingObligations.length, 118)
  assert.equal(c.orderingObligations.length, 86)
  assert.equal(c.frozenMigrationManifest.length, 23)
  assert.equal(
    w1Digest({ NODES: w1.migrationNodes, EDGES: w1.migrationEdges }),
    w1.digests.DJANGO_MIGRATION_GRAPH_DIGEST,
    'W1_GRAPH_DIGEST_DRIFT',
  )
  assert.equal(
    w1Digest(w1.canonicalMigrationPlan),
    w1.digests.DJANGO_MIGRATION_PLAN_DIGEST,
    'W1_PLAN_DIGEST_DRIFT',
  )
  assert.equal(c.djangoExecutionContract.PACKAGE_LOCK_DIGEST, w1.digests.DJANGO_PACKAGE_LOCK_DIGEST)
  assert.equal(
    c.djangoExecutionContract.MIGRATION_GRAPH_DIGEST,
    w1.digests.DJANGO_MIGRATION_GRAPH_DIGEST,
  )
  assert.equal(
    c.djangoExecutionContract.MIGRATION_PLAN_DIGEST,
    w1.digests.DJANGO_MIGRATION_PLAN_DIGEST,
  )
  assert.equal(inputs.roles.VECTOR_EXTENSION_DISPOSITION, 'OPTIONAL_GUARDED_NOT_BASELINE_REQUIRED')
  assert.equal(inputs.w3e.vectorConsumerReconciliation.length, 22)
  assert.deepEqual(c.extensionDoctrine.MANDATORY_EXTENSIONS, [
    'uuid-ossp',
    'pgcrypto',
    'pg_trgm',
    'btree_gin',
  ])
  const work = c.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W4')
  assert(work, 'W4_WORKSTREAM_MISSING')
  const all = [
    ...c.prerequisiteObligations,
    ...c.opaqueBindingObligations,
    ...c.orderingObligations,
    ...c.additionalContractObligations,
  ]
  const exact = work.INPUT_OBLIGATION_IDS.map((obligationId) => {
    const rows = all.filter((o) => o.OBLIGATION_ID === obligationId)
    assert.equal(rows.length, 1, 'W4_OBLIGATION_REFERENCE_DRIFT')
    return rows[0]
  })
  exactIds(
    exact.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
  )
  const django = exact.filter((o) => o.CREATION_AUTHORITY === 'DJANGO')
  assert.equal(django.length, 372)
  assert.equal(w1n.NORMALIZED_OBLIGATION_MODEL.DJANGO_PHYSICAL_OBLIGATIONS, 372)
  exactIds(
    django.map((o) => o.OBLIGATION_ID),
    w1n.NORMALIZED_OBLIGATION_MODEL.OBLIGATIONS.filter(
      (o) => o.CREATION_AUTHORITY === 'DJANGO',
    ).map((o) => o.OBLIGATION_ID),
  )
  const actor = target.databaseActors.find((a) => a.ACTOR_PURPOSE === 'DJANGO_MIGRATION')
  assert(actor, 'DJANGO_ACTOR_MISSING')
  const targetBinding = {
    DATABASE_SCOPE_ID: actor.DATABASE_SCOPE_ID,
    DATABASE_ACTOR_ID: actor.DATABASE_ACTOR_ID,
    TARGET_ID: actor.TARGET_ID,
    SEARCH_PATH_CONTRACT_ID: actor.SEARCH_PATH_CONTRACT_ID,
  }
  assert.equal(targetBinding.DATABASE_SCOPE_ID, 'UE_OPERATIONAL')
  const pathContract = target.searchPathContracts.find(
    (p) => p.SEARCH_PATH_CONTRACT_ID === actor.SEARCH_PATH_CONTRACT_ID,
  )
  assert.deepEqual(pathContract?.SEARCH_PATH, ['public', 'pg_catalog'])
  const prerequisites = {
    REQUIRED_ROLE_CLASS: 'MIGRATION_ADMIN',
    REQUIRED_EXTENSION_IDS: c.extensionDoctrine.MANDATORY_EXTENSIONS.map((extension) => ({
      EXTENSION: extension,
      STATE: 'W3_RUNTIME_PRECONDITION_NOT_PROVEN',
    })),
    REQUIRED_DELEGATION_BINDING:
      'MIGRATION_ADMIN_LOGIN_PRINCIPAL -> MIGRATION_ADMIN_PRINCIPAL; exact membership, no ADMIN OPTION',
    REQUIRED_PRIVILEGE_BOUNDARY:
      'W3 effective PUBLIC/TEMP/public-schema/default EXECUTE/ownership doctrine; catalog preflight under authenticated W8 adapter',
    W3_RUNTIME_APPLIED: 'NO',
  }
  const candidates = new Map(lineage.creationSourceCandidates.map((a) => [a.CANDIDATE_ID, a]))
  const positions = new Map(w1.canonicalMigrationPlan.map((p) => [p.MIGRATION_ID, p.ORDER_INDEX]))
  const mappings = django.map((o) => {
    assert(o.PHYSICAL_IDENTITY, 'DJANGO_IDENTITY_MISSING')
    const name = o.PHYSICAL_IDENTITY.split('::')[2]
    const relation = name.split('.').slice(0, 2).join('.')
    const column = o.PREREQUISITE_KIND === 'COLUMN' ? name.split('.')[2] : null
    const matches = (o.DJANGO_AUTHORITY_CANDIDATE_IDS ?? [])
      .map((candidateId) => candidates.get(candidateId))
      .filter((candidate): candidate is Candidate => !!candidate)
      .filter(
        (candidate) =>
          candidate.CREATES_OBJECT === 'YES' &&
          candidate.PHYSICAL_OBJECT === relation &&
          (!column || candidate.COLUMN_NAMES.includes(column)),
      )
      .flatMap((candidate) =>
        w1.migrationNodes
          .filter(
            (node) =>
              node.SOURCE_FILE === candidate.SOURCE_FILE &&
              node.FILE_SHA256 === candidate.SOURCE_EVIDENCE.FILE_SHA256,
          )
          .flatMap((node) =>
            node.OPERATIONS.filter(
              (operation) =>
                operation.LINE === candidate.SOURCE_EVIDENCE.LINE &&
                operation.PHYSICAL_DB_EFFECT === 'YES',
            ).map((operation) => ({ candidate, node, operation })),
          ),
      )
    assert.equal(
      matches.length,
      1,
      `AMBIGUOUS_OR_MISSING_EXACT_DJANGO_PRODUCER: ${o.OBLIGATION_ID}`,
    )
    const { candidate, node, operation } = matches[0]
    const order = positions.get(node.MIGRATION_ID)
    assert.notEqual(order, undefined, 'MIGRATION_NOT_IN_PLAN')
    const external = node.SOURCE_CLASS !== 'LOCAL'
    const packageSource = w1.migrationSources.find((s) => s.APP_LABEL === node.APP_LABEL)
    if (external) {
      assert(
        node.DISTRIBUTION_NAME && node.DISTRIBUTION_VERSION && packageSource?.PACKAGE_SOURCE_DIGEST,
        'EXTERNAL_PACKAGE_IDENTITY_MISSING',
      )
    }
    return {
      OBLIGATION_ID: o.OBLIGATION_ID,
      PREREQUISITE_ID: o.PREREQUISITE_ID,
      PHYSICAL_IDENTITY: o.PHYSICAL_IDENTITY,
      ...targetBinding,
      W4_PRODUCER_ID: producerId(node.MIGRATION_ID),
      PRODUCER_CLASS: external
        ? 'EXTERNAL_PACKAGE_MIGRATION_PRODUCER'
        : 'DJANGO_MIGRATION_PRODUCER',
      DJANGO_PRODUCER_MIGRATION_ID: node.MIGRATION_ID,
      PRODUCER_OPERATION_ID: id(
        'OPERATION',
        `${node.MIGRATION_ID}:${operation.LINE}:${operation.OPERATION_CLASS}:${operation.PARENT_OPERATION ?? ''}`,
      ),
      PRODUCER_OPERATION_CLASS: operation.OPERATION_CLASS,
      PRODUCER_SOURCE_FILE: node.SOURCE_FILE,
      PRODUCER_FILE_SHA256: node.FILE_SHA256,
      PRODUCER_SOURCE_LINE: operation.LINE,
      MIGRATION_PLAN_ORDER_INDEX: order,
      LINEAGE_CANDIDATE_ID: candidate.CANDIDATE_ID,
      COLUMN_MEMBERSHIP_EVIDENCE: column ? candidate.COLUMN_NAMES : null,
      DISTRIBUTION_NAME: node.DISTRIBUTION_NAME,
      LOCKED_VERSION: node.DISTRIBUTION_VERSION,
      PACKAGE_SOURCE_DIGEST: external ? packageSource!.PACKAGE_SOURCE_DIGEST : null,
      EXPECTED_POSTCONDITION: postcondition(o),
      RUNTIME_VERIFY_OWNER: 'W9',
      W4_IMPLEMENTATION_COMPLETE: 'YES; exact producer definition/linkage only',
      RUNTIME_PROVEN: 'NO',
    }
  })
  const decisions = work.INPUT_DECISION_IDS.map((decisionId) => {
    const rows = c.governanceDecisionObligations.filter((d) => d.DECISION_ID === decisionId)
    assert.equal(rows.length, 1, 'W4_DECISION_REFERENCE_DRIFT')
    const decision = rows[0]
    assert.equal(
      decision.STATUS,
      'HUMAN_DECISION_REQUIRED',
      'W4_OWNER_DECISION_STATE_CHANGED_REQUIRES_EXPLICIT_NEW_NORMALIZATION',
    )
    return {
      DECISION_ID: decisionId,
      DECISION: decision.SUBJECT,
      REQUIRED_DECISION_RECORD: decision.REQUIRED_DECISION_RECORD,
      AFFECTED_PREREQUISITE_IDS: decision.AFFECTED_PREREQUISITE_IDS,
      APPROVED: 'NO',
      IMPLEMENTED_IN_W4: 'NO',
      DOWNSTREAM_EFFECT:
        'Exact ownership/definition approval required before producer DDL, W4 PASS or invocation; unchanged human decision, not blanket W4 authorization',
    }
  })
  const blocked = exact
    .filter((o) => o.CREATION_AUTHORITY && o.CREATION_AUTHORITY !== 'DJANGO')
    .map((o) => {
      assert.equal(o.DATABASE_SCOPE, 'union-eyes', 'FINANCIAL_MATERIALIZATION_FORBIDDEN')
      const blockers = decisions.filter((d) =>
        d.AFFECTED_PREREQUISITE_IDS.includes(o.PREREQUISITE_ID!),
      )
      assert.equal(blockers.length, 1, 'EXACT_OWNER_DECISION_REQUIRED')
      return {
        PRODUCER_ID: id('GOVERNANCE-PRODUCER', o.OBLIGATION_ID),
        OBLIGATION_IDS: [o.OBLIGATION_ID],
        PREREQUISITE_ID: o.PREREQUISITE_ID,
        PHYSICAL_IDENTITIES: [o.PHYSICAL_IDENTITY],
        PRODUCER_CLASS: 'GOVERNANCE_DECISION_REQUIRED',
        PROSPECTIVE_AUTHORITY: o.CREATION_AUTHORITY,
        ...targetBinding,
        ROLE_CLASS: 'MIGRATION_ADMIN',
        DEPENDENCIES: [],
        DEPENDENCIES_ESTABLISHED: 'NO; canonical definition/owner not yet approved',
        BLOCKING_DECISION_IDS: blockers.map((d) => d.DECISION_ID),
        OBJECT_KIND: o.PREREQUISITE_KIND,
        SOURCE_CANDIDATE_IDS: o.SOURCE_CANDIDATE_IDS,
        SOURCE_CANDIDATES_ARE_APPROVED_PRODUCERS: 'NO',
        MUTATING_OPERATIONS: [],
        POSTCONDITION_VERIFY_QUERIES: [],
        POSTCONDITION_MODEL:
          'PENDING_EXACT_DEFINITION_SIGNATURE_SECURITY_OWNER_DECISION; no guessed types/function bodies',
        EXPECTED_BEFORE_CONSUMERS: o.REQUIRED_BEFORE_CONSUMER_IDS,
        W4_IMPLEMENTATION_COMPLETE: 'NO',
        EXECUTION_ALLOWED: 'NO',
        REQUIRED_W3_PRECONDITIONS: prerequisites,
        RUNTIME_PROVEN: 'NO',
      }
    })
  assert.equal(blocked.length, decisions.length)
  const registry = w1.canonicalMigrationPlan.map((step) => {
    const node = w1.migrationNodes.find((n) => n.MIGRATION_ID === step.MIGRATION_ID)
    assert(node && node.FILE_SHA256 === step.FILE_SHA256, 'PLAN_NODE_SOURCE_DRIFT')
    const packageSource = w1.migrationSources.find((source) => source.APP_LABEL === node.APP_LABEL)
    if (node.SOURCE_CLASS !== 'LOCAL') {
      const lockedPackage = w1.lockedDistributions.find(
        (pkg) => pkg.DISTRIBUTION === node.DISTRIBUTION_NAME,
      )
      assert(lockedPackage && packageSource, 'LOCKED_EXTERNAL_PACKAGE_MISSING')
      assert.equal(
        lockedPackage.VERSION,
        node.DISTRIBUTION_VERSION,
        'EXTERNAL_PACKAGE_VERSION_DRIFT',
      )
      assert.equal(
        lockedPackage.ARTIFACT_SHA256,
        packageSource.PACKAGE_SOURCE_DIGEST,
        'EXTERNAL_PACKAGE_SOURCE_DRIFT',
      )
    }
    return {
      PRODUCER_ID: producerId(node.MIGRATION_ID),
      PRODUCER_CLASS:
        node.SOURCE_CLASS === 'LOCAL'
          ? 'DJANGO_MIGRATION_PRODUCER'
          : 'EXTERNAL_PACKAGE_MIGRATION_PRODUCER',
      MIGRATION_ID: node.MIGRATION_ID,
      ...targetBinding,
      ORDER_INDEX: step.ORDER_INDEX,
      SOURCE_FILE: node.SOURCE_FILE,
      SOURCE_FILE_SHA256: node.FILE_SHA256,
      DISTRIBUTION_NAME: node.DISTRIBUTION_NAME,
      LOCKED_VERSION: node.DISTRIBUTION_VERSION,
      PACKAGE_SOURCE_DIGEST:
        node.SOURCE_CLASS === 'LOCAL' ? null : packageSource?.PACKAGE_SOURCE_DIGEST,
      OPERATIONS: node.OPERATIONS.map((operation) => ({
        ...operation,
        PRODUCER_OPERATION_ID: id(
          'OPERATION',
          `${node.MIGRATION_ID}:${operation.LINE}:${operation.OPERATION_CLASS}:${operation.PARENT_OPERATION ?? ''}`,
        ),
      })),
      INPUT_OBLIGATION_IDS: mappings
        .filter((m) => m.DJANGO_PRODUCER_MIGRATION_ID === node.MIGRATION_ID)
        .map((m) => m.OBLIGATION_ID),
      EXPECTED_OUTPUT_IDENTITIES: mappings
        .filter((m) => m.DJANGO_PRODUCER_MIGRATION_ID === node.MIGRATION_ID)
        .map((m) => m.PHYSICAL_IDENTITY),
      REQUIRES_PRODUCER_IDS: [
        ...new Set(
          w1.migrationEdges
            .filter(
              (e) =>
                e.FROM_MIGRATION === node.MIGRATION_ID &&
                !e.REPLACEMENT_IS_LINEAGE_NOT_EXECUTION_DEPENDENCY,
            )
            .map((edge) => {
              assert.equal(edge.RESOLUTION, 'RESOLVED', 'MIGRATION_EDGE_NOT_RESOLVED')
              return producerId(edge.TO_MIGRATION)
            }),
        ),
      ],
      REQUIRED_W3_PRECONDITIONS: prerequisites,
      EXECUTION_DESCRIPTOR: {
        EXECUTION_KIND: 'PART_OF_SINGLE_CANONICAL_DJANGO_BOOTSTRAP_INVOCATION',
        SETTINGS_MODULE: 'config.settings',
        SETTINGS_FILE_SHA256: w1.metadata.SETTINGS_SHA256,
        LOCK_DIGEST: w1.digests.DJANGO_PACKAGE_LOCK_DIGEST,
        GRAPH_DIGEST: w1.digests.DJANGO_MIGRATION_GRAPH_DIGEST,
        PLAN_DIGEST: w1.digests.DJANGO_MIGRATION_PLAN_DIGEST,
        CONFIGURED_APP_IDS: w1.configuredApps.map((a) => a.APP_ID),
        PACKAGE_ENVIRONMENT: w1.packageAuthority.TARGET,
        SWAPPABLE_IDENTITY: digest(w1.swappableConfiguration),
        FUTURE_ADAPTER: 'scripts/ue/w4-physical-producers.ts::prepareDjangoExecution',
        EXECUTION: 'NO',
        INVOKE_SEPARATELY_PER_NODE: 'NO',
        STANDALONE_APPLY: 'BLOCKED',
      },
      AVAILABLE_AFTER_PRODUCER_STEP: step.ORDER_INDEX,
      FIRST_VALID_CONSUMER_POSITION:
        'After complete canonical Django graph and approved platform baseline; exact frozen compatibility belongs to W5',
      RUNTIME_PROVEN: 'NO',
    }
  })
  validateGraph(registry)
  const indexById = new Map(registry.map((r) => [r.PRODUCER_ID, r.ORDER_INDEX]))
  for (const row of registry)
    for (const dep of row.REQUIRES_PRODUCER_IDS)
      assert(indexById.get(dep)! < row.ORDER_INDEX, 'MIGRATION_PLAN_NOT_TOPOLOGICAL')
  const rawRegistry = w1.rawOperationRegistry.map((raw) => {
    const node = w1.migrationNodes.find((n) => n.MIGRATION_ID === raw.MIGRATION_ID)
    assert(
      node &&
        node.FILE_SHA256 === raw.SOURCE_REFERENCE.FILE_SHA256 &&
        node.SOURCE_FILE === raw.SOURCE_REFERENCE.FILE,
      'RAW_SOURCE_DRIFT',
    )
    const ops = node.OPERATIONS.filter(
      (o) => o.LINE === raw.LINE && o.OPERATION_CLASS === raw.OPERATION_CLASS,
    )
    assert.equal(ops.length, 1, 'RAW_OPERATION_LINKAGE_DRIFT')
    const ownership = w1n.NORMALIZED_OBLIGATION_MODEL.RAW_OPERATION_OWNERSHIP.find(
      (o) => o.MIGRATION_ID === raw.MIGRATION_ID,
    )
    const wrapper = ownership?.RAW_OPERATION_OWNERS.some(
      (o) => o.RAW_OPERATION_ID === raw.RAW_OPERATION_ID && o.FUTURE_WORKSTREAM === 'W4',
    )
    return {
      ...raw,
      W4_PRODUCER_ID: producerId(raw.MIGRATION_ID),
      PRODUCER_CLASS: 'DJANGO_RAW_OPERATION_WRAPPER',
      W4_RESPONSIBILITY:
        'Preserve exact original migration execution wrapper, state/physical order and target binding; no raw code rewrite or standalone raw SQL execution',
      W1N_WRAPPER_RESPONSIBILITY: wrapper
        ? 'YES'
        : 'NO; W6 semantic operation retained inside full original graph',
      SEMANTIC_OWNER: 'W6',
      PHYSICAL_EFFECT_CLASS: ops[0].PHYSICAL_DB_EFFECT,
      STATE_EFFECT_CLASS: ops[0].STATE_EFFECT,
      FUTURE_EXECUTION_PATH:
        'Original locked Django migration graph; execute original migration once, never extracted RunSQL/RunPython',
      ...targetBinding,
      W6_STARTED: 'NO',
      EXECUTION: 'NO',
      RUNTIME_PROVEN: 'NO',
    }
  })
  assert.equal(rawRegistry.filter((r) => r.W1N_WRAPPER_RESPONSIBILITY === 'YES').length, 4)
  const authority = [
    ...mappings.map((m) => ({
      PHYSICAL_IDENTITY: m.PHYSICAL_IDENTITY,
      CREATE_AUTHORITY: `DJANGO:${m.PRODUCER_OPERATION_ID}`,
      W4_PRODUCER_ID: m.W4_PRODUCER_ID,
      CREATION_DEFINITION_ESTABLISHED: 'YES',
      ALTERATION_AUTHORITIES: [],
      ALTERATION_AUTHORITY_CEILING:
        'No per-object raw alteration authority inferred; original migration graph remains intact and W6 semantic binding is required',
    })),
    ...blocked.map((b) => ({
      PHYSICAL_IDENTITY: b.PHYSICAL_IDENTITIES[0]!,
      CREATE_AUTHORITY: `GOVERNANCE_PENDING:${b.BLOCKING_DECISION_IDS[0]}`,
      W4_PRODUCER_ID: b.PRODUCER_ID,
      CREATION_DEFINITION_ESTABLISHED: 'NO',
      ALTERATION_AUTHORITIES: [],
      ALTERATION_AUTHORITY_CEILING:
        'Definition/owner pending; later provider is not a competing creation approval',
    })),
  ]
  validateAuthorities(authority)
  const touched = new Map<string | undefined, { id: string; implemented: boolean }>([
    ...mappings.map(
      (m) => [m.PREREQUISITE_ID, { id: m.W4_PRODUCER_ID, implemented: true }] as const,
    ),
    ...blocked.map((b) => [b.PREREQUISITE_ID, { id: b.PRODUCER_ID, implemented: false }] as const),
  ])
  const orderingHandoff = c.orderingObligations.map((o) => {
    const p = touched.get(o.PREREQUISITE)
    assert(p, 'ORDERING_PREREQUISITE_NOT_IN_W4')
    return {
      ORDERING_RECORD_ID: o.ORDERING_RECORD_ID,
      ORDERING_OBLIGATION_ID: o.OBLIGATION_ID,
      W4_PRODUCER_ID: p.id,
      PREREQUISITE_ID: o.PREREQUISITE,
      PHYSICAL_IDENTITY: o.PHYSICAL_IDENTITY,
      CONSUMER: o.CONSUMER,
      LATER_PROVIDER: o.LATER_PROVIDER,
      PRODUCER_AVAILABLE_BEFORE_CONSUMER: p.implemented ? 'REQUIRES_W5_ADJUDICATION' : 'NO',
      PRODUCER_EVIDENCE: p.implemented
        ? 'Exact W1 node/operation/lineage linkage; frozen CREATE/ALTER compatibility is not decided'
        : 'Exact ownership decision and producer definition pending',
      ORDERING_CLOSED: 'NO',
      W5_STARTED: 'NO',
    }
  })
  const opaqueHandoff = c.opaqueBindingObligations.map((o) => {
    const p = touched.get(o.PREREQUISITE_ID)
    return {
      OPAQUE_BINDING_ID: o.OPAQUE_BINDING_ID,
      W4_INTERSECTION: p ? 'YES' : 'NO',
      W4_PHYSICAL_PRODUCER_ID: p?.id ?? null,
      PHYSICAL_OBJECT_IDENTITY: o.INPUT_IDENTITY,
      W6_SEMANTIC_BINDING_REQUIRED: 'YES',
      W6_STARTED: 'NO',
      BINDING_RESOLVED_BY_W4: 'NO',
    }
  })
  const obligationLinkage = exact.map((o) => {
    const mapped = mappings.find((m) => m.OBLIGATION_ID === o.OBLIGATION_ID)
    const pending = blocked.find((b) => b.OBLIGATION_IDS.includes(o.OBLIGATION_ID))
    const handoff = orderingHandoff.find((h) => h.ORDERING_OBLIGATION_ID === o.OBLIGATION_ID)
    assert(mapped || pending || handoff, 'UNACCOUNTED_W4_OBLIGATION')
    return {
      OBLIGATION_ID: o.OBLIGATION_ID,
      W4_PRODUCER_ID: mapped?.W4_PRODUCER_ID ?? pending?.PRODUCER_ID ?? handoff!.W4_PRODUCER_ID,
      W4_IMPLEMENTATION_COMPLETE: pending
        ? 'NO'
        : 'YES; producer linkage or ordering handoff only, not W5 closure',
      COMPLETION_CLASS: mapped
        ? 'EXACT_DJANGO_PRODUCER_DEFINITION_MAPPED'
        : pending
          ? 'GOVERNANCE_DECISION_REQUIRED'
          : 'W5_ORDERING_HANDOFF_ONLY',
      BLOCKING_DECISION_IDS: pending?.BLOCKING_DECISION_IDS ?? [],
      DOWNSTREAM_RUNTIME_PENDING: 'YES',
      RUNTIME_PROVEN: 'NO',
    }
  })
  exactIds(
    obligationLinkage.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
  )
  exactIds(
    decisions.map((d) => d.DECISION_ID),
    work.INPUT_DECISION_IDS,
  )
  exactIds(
    orderingHandoff.map((o) => o.ORDERING_RECORD_ID),
    c.orderingObligations.map((o) => o.ORDERING_RECORD_ID),
  )
  exactIds(
    opaqueHandoff.map((o) => o.OPAQUE_BINDING_ID),
    c.opaqueBindingObligations.map((o) => o.OPAQUE_BINDING_ID),
  )
  const producerGraph = {
    NODES: registry.map((r) => ({
      PRODUCER_ID: r.PRODUCER_ID,
      REQUIRES_PRODUCER_IDS: r.REQUIRES_PRODUCER_IDS,
    })),
    GOVERNANCE_BLOCKED_NODES: blocked.map((b) => ({
      PRODUCER_ID: b.PRODUCER_ID,
      BLOCKING_DECISION_IDS: b.BLOCKING_DECISION_IDS,
    })),
    KNOWN_DJANGO_GRAPH_COMPLETE: 'YES',
    FULL_W4_GRAPH_COMPLETE: 'NO; 310 canonical producer definitions/dependencies not approved',
    DUPLICATE_PRODUCER_IDS: 0,
    UNRESOLVED_KNOWN_PRODUCER_REFERENCES: 0,
    KNOWN_PRODUCER_GRAPH_CYCLES: 0,
    MACRO_ORDER: [
      'W3_PROVISIONING',
      'FULL_CANONICAL_DJANGO_GRAPH',
      'APPROVED_PLATFORM_BASELINE',
      'FROZEN_SCOPED_SECURITY_MIGRATIONS',
    ],
    PLATFORM_BEFORE_DJANGO_EXCEPTION_APPROVED:
      'NO; report to W5/governance rather than silently violate macro order',
  }
  const plan = registry.map((r) => ({
    ORDER_INDEX: r.ORDER_INDEX,
    PRODUCER_ID: r.PRODUCER_ID,
    PRODUCER_CLASS: r.PRODUCER_CLASS,
    ...targetBinding,
    ACTOR_ID: actor.DATABASE_ACTOR_ID,
    INPUT_OBLIGATION_IDS: r.INPUT_OBLIGATION_IDS,
    REQUIRES_PRODUCER_IDS: r.REQUIRES_PRODUCER_IDS,
    EXPECTED_OUTPUT_IDENTITIES: r.EXPECTED_OUTPUT_IDENTITIES,
    EXECUTION_DESCRIPTOR: r.EXECUTION_DESCRIPTOR,
  }))
  return {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4',
      CONTRACT_VERSION: '1.3',
      METHOD:
        'Only fixed artifacts; exact candidate source/hash/operation-line linkage, no source discovery or Django import',
      W4_INPUT_OBLIGATION_IDS: work.INPUT_OBLIGATION_IDS,
      W4_INPUT_DECISION_IDS: work.INPUT_DECISION_IDS,
    },
    producerAuthorities: {
      ORGANIZATIONS_OPERATIONAL_SCHEMA_OWNER: 'DJANGO',
      DJANGO_DOMAIN_OBJECTS: 'Exact locked migration graph only; no substitute SQL',
      PLATFORM_BASELINE:
        'No currently approved exact platform ownership/definitions: all 41 explicitly conditional',
      FINANCIAL_SERVICE_PHYSICAL_MATERIALIZATION_OWNER: 'W7',
      W3_ROLE_EXTENSION_OWNERSHIP: 'Preconditions only; no W4 role/extension SQL',
      FROZEN_SECURITY_MANIFEST:
        'Consumers, unchanged bytes/order; W5 adjudicates any earlier frozen declaration handoff',
    },
    djangoProducerRegistry: mappings,
    djangoExecutionRegistry: registry,
    platformProducerRegistry: blocked,
    rawOperationProducerRegistry: rawRegistry,
    producerDependencyGraph: producerGraph,
    canonicalProducerPlan: plan,
    blockedProducerPlanEntries: blocked,
    physicalIdentityAuthority: authority,
    w3Preconditions: prerequisites,
    w2TargetBindings: [targetBinding],
    postconditionDescriptors: mappings.map((m) => m.EXPECTED_POSTCONDITION),
    blockedPostconditionDescriptors: blocked.map((b) => ({
      PRODUCER_ID: b.PRODUCER_ID,
      PHYSICAL_IDENTITIES: b.PHYSICAL_IDENTITIES,
      EXPECTED_RUNTIME_PROOF: 'YES; exact definition/owner not yet approved',
      BLOCKING_DECISION_IDS: b.BLOCKING_DECISION_IDS,
      RUNTIME_PROVEN: 'NO',
    })),
    w5OrderingHandoff: orderingHandoff,
    w6OpaqueBindingHandoff: opaqueHandoff,
    governanceDecisions: decisions,
    obligationLinkage,
    downstreamImplementationPacket: [
      {
        OWNER: 'HUMAN_W4_GOVERNANCE',
        DECISION_IDS: work.INPUT_DECISION_IDS,
        REQUIRED:
          'Approve exact 269 relation/column and 41 type/function owner/definitions. No blanket authority; no unsafe function SECURITY DEFINER without trusted path/body/ACL evidence.',
      },
      {
        OWNER: 'W5',
        REQUIRED:
          'Reconcile exact86 ordering records against producer steps and unchanged later providers; no W5 decision made here',
        STARTED: 'NO',
      },
      {
        OWNER: 'W6',
        REQUIRED:
          'All118 opaque semantic bindings and raw semantics remain W6; four W4 state/physical wrappers preserve original execution',
        STARTED: 'NO',
      },
      { OWNER: 'W7', REQUIRED: 'Financial materializer excluded', STARTED: 'NO' },
      {
        OWNER: 'W8',
        REQUIRED:
          'Only after separately authorized execution: supply explicit measured package/lock/settings/app/target/principal/path identities, authenticated one-client execution and full original Django graph; no ambient config',
        STARTED: 'NO',
      },
      {
        OWNER: 'W9',
        REQUIRED:
          'Catalog pre/postconditions and exact schema/owner/type/default/nullability proofs against locked producer definitions; descriptors are expected, never observed state',
        STARTED: 'NO',
      },
    ],
    digests: {
      PRODUCER_REGISTRY: digest([mappings, registry, blocked, rawRegistry]),
      PLAN: digest(plan),
      POSTCONDITIONS: digest(mappings.map((m) => m.EXPECTED_POSTCONDITION)),
      DEPENDENCY_GRAPH: digest(producerGraph),
      CREATION_AUTHORITY: digest(authority),
      ORDERING_HANDOFF: digest(orderingHandoff),
      OPAQUE_HANDOFF: digest(opaqueHandoff),
    },
    validation: {
      W4_INPUT_OBLIGATIONS: exact.length,
      W4_INPUT_DECISIONS: decisions.length,
      DJANGO_PHYSICAL_OBLIGATIONS_INPUT: 372,
      MAPPED_TO_EXACT_DJANGO_PRODUCER: mappings.filter(
        (m) => m.PRODUCER_CLASS === 'DJANGO_MIGRATION_PRODUCER',
      ).length,
      MAPPED_TO_EXTERNAL_DJANGO_PRODUCER: mappings.filter(
        (m) => m.PRODUCER_CLASS === 'EXTERNAL_PACKAGE_MIGRATION_PRODUCER',
      ).length,
      MAPPED_TO_RAW_OPERATION_PRODUCER: 0,
      DJANGO_BLOCKED_BY_GOVERNANCE_DECISION: 0,
      DJANGO_SUM: mappings.length,
      RELATION_COLUMN_OWNER_DECISIONS_PENDING: blocked.filter(
        (b) => b.PROSPECTIVE_AUTHORITY === 'GOVERNANCE_DECISION_REQUIRED',
      ).length,
      TYPE_FUNCTION_OWNER_DECISIONS_PENDING: blocked.filter(
        (b) => b.PROSPECTIVE_AUTHORITY === 'PLATFORM_BASELINE_SUBJECT_TO_EXPLICIT_OWNERSHIP',
      ).length,
      DECISIONS_APPROVED: 0,
      W4_PRODUCERS_BLOCKED_BY_GOVERNANCE_DECISION: blocked.length,
      PLATFORM_MUTATING_SQL_STATEMENTS: 0,
      GENERATED_SUBSTITUTE_DJANGO_DDL: 0,
      RAW_OPERATIONS_PRESERVED: rawRegistry.length,
      W1N_W4_WRAPPERS: 4,
      KNOWN_DJANGO_NODES: registry.length,
      DUPLICATE_PRODUCER_IDS: 0,
      KNOWN_GRAPH_CYCLES: 0,
      UNRESOLVED_KNOWN_GRAPH_REFERENCES: 0,
      MULTIPLE_CREATION_AUTHORITIES: 0,
      AUTHORITIES_AWAITING_APPROVAL: blocked.length,
      W5_HANDOFF_RECORDS: orderingHandoff.length,
      W6_HANDOFF_CENSUS: opaqueHandoff.length,
      W6_W4_INTERSECTIONS: opaqueHandoff.filter((h) => h.W4_INTERSECTION === 'YES').length,
      ALL_DIGESTS_MATCH: 'REQUIRED_TWO_RUN_GENERATOR_ASSERTION',
      W4_ALL_PRODUCER_IMPLEMENTATIONS_COMPLETE: 'NO; exact310 governance blockers',
      STANDALONE_APPLY: 'BLOCKED',
      SOURCE_RESCAN: 'NO',
    },
    phaseStatus: {
      PHASE_1B_3C_A1I_W4_GATE: 'BLOCKED',
      PHASE_1B_3C_A1I_W4: 'BLOCKED',
      W1: 'PASS',
      W2: 'PASS',
      W3: 'PASS',
      W3E: 'PASS',
      CANONICAL_BOOTSTRAP_CONTRACT_VERSION: '1.3',
      CONTRACT_1_4_CREATED: 'NO',
      W4_STARTED: 'YES; offline producer descriptors only',
      DJANGO_PHYSICAL_PRODUCER_MODEL: '372_EXACT_DEFINITIONS_MAPPED_NOT_EXECUTED',
      PRECONSUMER_PLATFORM_PRODUCER_MODEL: '310_EXACT_GOVERNANCE_DECISIONS_PENDING',
      RAW_OPERATION_PRODUCER_MODEL:
        'WRAPPERS_REPRESENTED_ORIGINAL_EXECUTION_PRESERVED_NOT_EXECUTED',
      POSTCONDITION_VERIFICATION_MODEL:
        'DJANGO_EXPECTATIONS_DEFINED_PLATFORM_DEFINITIONS_PENDING_NOT_EXECUTED',
      W5: 'NOT_AUTHORIZED_BY_W4',
      W5_STARTED: 'NO',
      W6_W10_STARTED: 'NO',
      DATABASE_ROLES_PROVISIONED: 'NO',
      EXTENSIONS_RUNTIME_PROVEN: 'NO',
      ROLE_MEMBERSHIPS_APPLIED: 'NO',
      LOGIN_PRINCIPALS_BOUND: 'NO',
      SECRETS_ACCESSED: 'NO',
      DJANGO_SCHEMA_MATERIALIZED: 'NO',
      PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
      PHYSICAL_PRODUCERS_EXECUTED: 'NO',
      DATABASE_RUNTIME_CONFIGURATION_APPLIED: 'NO',
      BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
      FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
      PRODUCTION_SCHEMA_PROVEN: 'NO',
      RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
      TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    },
  }
}
