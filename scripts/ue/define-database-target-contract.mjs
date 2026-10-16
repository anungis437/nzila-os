import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { isIP } from 'node:net'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = fileURLToPath(new URL('../../', import.meta.url))
const folder = 'docs/union-eyes/reality-remediation/'
const files = {
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
  w1n: folder + 'PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json',
  w1: folder + 'PHASE_1B_3C_A1I_W1_DJANGO_DEPENDENCY_MIGRATION_LOCK.json',
  a1e: folder + 'PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE.json',
  lock: 'apps/union-eyes/backend/requirements.lock',
  lockMetadata: 'apps/union-eyes/backend/requirements.lock.metadata.json',
  contract: folder + 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json',
  contractMarkdown: folder + 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.md',
  report: folder + 'PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json',
  reportMarkdown: folder + 'PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.md',
}
const absolute = (name) => path.join(root, ...name.split('/'))
const read = (name) => readFileSync(absolute(name), 'utf8')
const sha = (value) => createHash('sha256').update(value).digest('hex')
const digest = (value) => sha(JSON.stringify(value))
const config = await resolveConfig(absolute(files.canonical))
const formatted = (value) => format(JSON.stringify(value), { ...config, parser: 'json' })
const phase = 'PHASE_1B_3C_A1I_W2'
const amendment = 'DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT'
const scopeIds = ['UE_OPERATIONAL', 'FINANCIAL_SERVICE']
const approvedHashes = {
  LOCK: '310eb938f4f7c25b6f93323031981ede60a0d2ef2d68e017a5c9ced33e326fe6',
  GRAPH: '73690369f0985a6d3fe33e1d72c66da9d864c0c590590c1628f75c33278e79f1',
  PLAN: '447da85fbb379c41d4684ea6dda994c3dad7c98b6bce08d475d01d4bb9bd10e2',
}
const proofBoundaries = {
  DATABASE_RUNTIME_CONFIGURATION_APPLIED: 'NO',
  DATABASE_RUNTIME_CONFIGURATION_PROVEN: 'NO',
  DATABASE_ROLES_PROVISIONED: 'NO',
  EXTENSIONS_RUNTIME_PROVEN: 'NO',
  DJANGO_SCHEMA_MATERIALIZED: 'NO',
  BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
  FAITHFUL_SCHEMA_REPLAY_PROVEN: 'NO',
  PRODUCTION_SCHEMA_PROVEN: 'NO',
  RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN: 'NO',
  TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
  DEPLOYED_RUNTIME_TARGET_EQUALITY_PROVEN: 'NO',
  READY_FOR_RUNTIME_PROOF: 0,
  PRODUCT_READY: 'NO',
}
const phaseStatus = {
  PHASE_1B_3C_A1I_W2_GATE: 'PASS',
  PHASE_1B_3C_A1I_W2: 'PASS',
  PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH_CONTRACT: 'PASS',
  DATABASE_TARGET_CONTRACT: 'ESTABLISHED',
  DATABASE_SCOPE_CONTRACT: 'ESTABLISHED',
  SCHEMA_AUTHORITY_CONTRACT: 'ESTABLISHED',
  SEARCH_PATH_CONTRACT: 'ESTABLISHED',
  QUALIFICATION_DOCTRINE: 'ESTABLISHED',
  W2_IMPLEMENTATION_COMPLETE: 'YES',
  BOOTSTRAP_CONTRACT_VERSION: '1.2',
  W1: 'PASS',
  W1N: 'PASS',
  W2: 'PASS',
  W2_STARTED: 'YES',
  W3: 'AUTHORIZED_NOT_STARTED',
  PHASE_1B_3C_A1I_W3_ROLE_EXTENSION_PROVISIONING: 'AUTHORIZED_NOT_STARTED',
  W3_STARTED: 'NO',
  W4_W10_STARTED: 'NO',
  A1R_STARTED: 'NO',
  A2_STARTED: 'NO',
  B3C_B_STARTED: 'NO',
  ...proofBoundaries,
}
const actorDefinitions = [
  [
    'DJANGO_MIGRATION',
    'DJANGO_MIGRATION',
    'UE_OPERATIONAL',
    'MIGRATION_ADMIN',
    'DJANGO_MIGRATION',
    'W8',
  ],
  [
    'SCOPED_SECURITY_MIGRATION',
    'UE_SCOPED_MIGRATION',
    'UE_OPERATIONAL',
    'MIGRATION_ADMIN',
    'UE_SCOPED_SECURITY_MIGRATION',
    'W8',
  ],
  [
    'PROVISIONING',
    'UE_PLATFORM_BASELINE',
    'UE_OPERATIONAL',
    'MIGRATION_ADMIN',
    'UE_PROVISIONING',
    'W3',
  ],
  [
    'PRECONSUMER_BASELINE',
    'UE_PLATFORM_BASELINE',
    'UE_OPERATIONAL',
    'MIGRATION_ADMIN',
    'UE_PLATFORM_BASELINE',
    'W4',
  ],
  [
    'APPLICATION_RUNTIME',
    'UE_RUNTIME',
    'UE_OPERATIONAL',
    'APPLICATION_RUNTIME',
    'UE_APPLICATION_RUNTIME',
    'W8',
  ],
  [
    'SYSTEM_RUNTIME',
    'UE_SYSTEM_RUNTIME',
    'UE_OPERATIONAL',
    'SYSTEM_OR_INTERNAL_RUNTIME',
    'UE_SYSTEM_RUNTIME',
    'W8',
  ],
  [
    'FINANCIAL_PROVISIONING',
    'FINANCIAL_MIGRATION',
    'FINANCIAL_SERVICE',
    'FINANCIAL_MIGRATION',
    'FINANCIAL_PROVISIONING',
    'W3',
  ],
  [
    'FINANCIAL_MIGRATION',
    'FINANCIAL_MIGRATION',
    'FINANCIAL_SERVICE',
    'FINANCIAL_MIGRATION',
    'FINANCIAL_MIGRATION',
    'W7',
  ],
  [
    'FINANCIAL_RUNTIME',
    'FINANCIAL_RUNTIME',
    'FINANCIAL_SERVICE',
    'FINANCIAL_RUNTIME',
    'FINANCIAL_RUNTIME',
    'W7',
  ],
]
const scopeSchema = (scope) => `${scope}_PUBLIC`
const actorId = (name) => `UE-W2-ACTOR-${name}`
const searchId = (name) => `UE-W2-PATH-${name}`

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
      const existed = Object.hasOwn(before, key)
      if (!existed || !Object.hasOwn(after, key))
        return [
          {
            PATH: [...location, key],
            EXISTED: existed,
            ...(existed ? { VALUE: before[key] } : {}),
          },
        ]
      return inverse(before[key], after[key], [...location, key])
    })
  }
  return [{ PATH: location, EXISTED: true, VALUE: before }]
}

function restore(current, patches) {
  const original = structuredClone(current)
  for (const patch of patches) {
    const parent = patch.PATH.slice(0, -1).reduce((object, key) => object[key], original)
    if (patch.EXISTED) parent[patch.PATH.at(-1)] = structuredClone(patch.VALUE)
    else delete parent[patch.PATH.at(-1)]
  }
  return original
}

function exact(actual, expected, description) {
  assert.equal(actual.length, expected.length, `${description}: count`)
  assert.equal(new Set(actual).size, actual.length, `${description}: duplicates`)
  assert.deepEqual(new Set(actual), new Set(expected), `${description}: IDs`)
}

function validateFrozen(inputs) {
  const c = JSON.parse(inputs.canonical)
  const w1 = JSON.parse(inputs.w1)
  const n = JSON.parse(inputs.w1n)
  const e = JSON.parse(inputs.a1e)
  assert.equal(c.CONTRACT_VERSION, '1.1')
  assert.equal(c.phaseStatus.PHASE_1B_3C_A1I_W1_GATE, 'PASS')
  assert.equal(w1.phaseStatus.PHASE_1B_3C_A1I_W1_GATE, 'PASS')
  assert.equal(n.phaseStatus.PHASE_1B_3C_A1I_W1N_GATE, 'PASS')
  assert.equal(c.amendment.PRIOR_CONTRACT_SHA256, n.PRIOR_CONTRACT_SHA256)
  assert.equal(
    n.PRIOR_CONTRACT_SHA256,
    '0fed10ff33f8ac7ee4886d89e50143097f9e42928ee1efc77ec1fedce5eb3983',
  )
  assert.equal(sha(inputs.lock), approvedHashes.LOCK)
  assert.equal(w1.digests.DJANGO_PACKAGE_LOCK_DIGEST, approvedHashes.LOCK)
  assert.equal(w1.digests.DJANGO_MIGRATION_GRAPH_DIGEST, approvedHashes.GRAPH)
  assert.equal(w1.digests.DJANGO_MIGRATION_PLAN_DIGEST, approvedHashes.PLAN)
  assert.equal(w1.lockedDistributions.length, 87)
  assert.equal(w1.lockedDistributions.filter((p) => p.DIRECT).length, 27)
  assert.equal(w1.lockedDistributions.filter((p) => !p.DIRECT).length, 60)
  assert.equal(w1.lockedDistributions.find((p) => p.DISTRIBUTION === 'django').VERSION, '5.2.18')
  assert.equal(w1.configuredApps.length, 25)
  assert.equal(w1.migrationNodes.length, 82)
  assert.equal(w1.migrationNodes.filter((m) => m.SOURCE_CLASS === 'LOCAL').length, 29)
  assert.equal(w1.migrationEdges.filter((m) => m.EDGE_CLASS === 'DEPENDENCY').length, 81)
  assert.equal(w1.migrationEdges.filter((m) => m.EDGE_CLASS === 'SWAPPABLE_DEPENDENCY').length, 1)
  assert.equal(w1.validation.LOCAL_LITERAL_EDGES_PRESERVED, 26)
  assert.equal(w1.rawOperationRegistry.length, 16)
  assert.equal(
    e.physicalDatabaseBinding.DJANGO_SCOPED_PHYSICAL_DB_BINDING,
    'ESTABLISHED_SAME_TARGET',
  )
  assert.equal(sha(inputs.a1e), '8a8aed72458720fe6ebaff1eec1227ec3c816d4f44747bc7b509c4736401e8f5')
  assert.equal(c.FINANCIAL_DATABASE_SCOPE, 'DISTINCT')
  assert.deepEqual(c.frozenMigrationManifest, w1.frozenSecurityManifest)
  assert.deepEqual(c.frozenMigrationManifest, e.frozenMigrationManifest)
  for (const [records, key, universe, count] of [
    [c.prerequisiteObligations, 'PREREQUISITE_ID', 'PREREQUISITES', 803],
    [c.opaqueBindingObligations, 'OPAQUE_BINDING_ID', 'OPAQUE', 118],
    [c.orderingObligations, 'ORDERING_RECORD_ID', 'ORDERING', 86],
  ]) {
    assert.equal(records.length, count)
    exact(
      records.map((r) => r[key]),
      w1.metadata.FROZEN_OBLIGATION_IDS[universe],
      universe,
    )
  }
  assert.equal(c.frozenMigrationManifest.length, 23)
  const work = c.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W2')
  assert.equal(work.INPUT_OBLIGATION_IDS.length, 1)
  assert.equal(work.INPUT_DECISION_IDS.length, 2)
  const obligations = c.additionalContractObligations.filter((o) =>
    work.INPUT_OBLIGATION_IDS.includes(o.OBLIGATION_ID),
  )
  const decisions = c.governanceDecisionObligations.filter((d) =>
    work.INPUT_DECISION_IDS.includes(d.DECISION_ID),
  )
  exact(
    obligations.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
    'W2 obligations',
  )
  exact(
    decisions.map((d) => d.DECISION_ID),
    work.INPUT_DECISION_IDS,
    'W2 decisions',
  )
  return { c, w1, n, e, work, obligations, decisions }
}

function makeScopes(e) {
  return scopeIds.map((scope) => {
    const operational = scope === 'UE_OPERATIONAL'
    const prefix = operational ? 'UE_OPERATIONAL' : 'FINANCIAL_SERVICE'
    return {
      DATABASE_SCOPE_ID: scope,
      LEGACY_DATABASE_SCOPE: operational ? 'union-eyes' : 'financial-service',
      PURPOSE: operational
        ? 'Django-owned operational domain plus governed platform/security consumers'
        : 'Distinct financial-service database; never operational domain fallback',
      PHYSICAL_TARGET_CLASS: 'POSTGRESQL_EXPLICIT_ENVIRONMENT_SELECTED_DATABASE',
      TARGET_CONFIGURATION_CONTRACT: {
        TARGET_ID: `UE-W2-TARGET-${scope}`,
        ENVIRONMENT_ID_SOURCE: 'UE_DATABASE_TARGET_ENVIRONMENT',
        HOST_SOURCE: `${prefix}_PGHOST`,
        PORT_SOURCE: `${prefix}_PGPORT`,
        DATABASE_NAME_SOURCE: `${prefix}_PGDATABASE`,
        BINDING_MODE:
          'REQUIRED_SCOPE_SPECIFIC_NON_SECRET_DESCRIPTOR_PLUS_SEPARATE_CREDENTIAL_REFERENCE',
        MATERIALIZED_DESCRIPTOR_REQUIRED_BEFORE_CONNECTION: 'YES',
        DESCRIPTOR_FIELDS: ['ENVIRONMENT_ID', 'HOST', 'PORT', 'DATABASE_NAME'],
        MISSING_EMPTY_OR_AMBIENT_DEFAULT: 'FAIL_FAST',
        URL_AND_DISCRETE_COMPONENTS_DISAGREE: 'FAIL_FAST',
        CREDENTIAL_TARGET_MUST_MATCH_DESCRIPTOR: 'YES',
        HOST_EQUIVALENCE:
          'Lowercase DNS name with one terminal dot removed; no DNS lookup, alias inference or IP equivalence',
        DATABASE_NAME_EQUIVALENCE:
          'Exact case-sensitive decoded database name; no default database',
        PORT_EQUIVALENCE: 'Explicit integer 1..65535; no default port',
        ENVIRONMENT_EQUIVALENCE:
          'Exact environment ID selected once and propagated to every actor; no cross-environment fallback',
        SAME_PHYSICAL_DATABASE_KEY: ['NORMALIZED_HOST', 'PORT', 'DATABASE_NAME'],
        SSL_CONFIGURATION_REQUIRED:
          'Explicit verified transport configuration per selected environment; W8 applies; no URL override can change target/path',
        CONNECTION_STRING_SERIALIZATION: 'FORBIDDEN',
        KNOWN_PHYSICAL_ENDPOINT_LITERAL:
          'NOT_READ_OR_CLAIMED; this is an exact mandatory reference/binding contract, not a live endpoint attestation',
        DEPLOYMENT_SELECTOR_REFERENCE: operational
          ? 'needs.plan.outputs.key_vault_name'
          : 'FINANCIAL_SERVICE_CREDENTIAL_REFERENCE_SET (prospective scope-specific selector)',
        DEPLOYED_TARGET_RUNTIME_PROVEN: 'NO',
      },
      DATABASE_NAME_SOURCE: `${prefix}_PGDATABASE`,
      HOST_SOURCE: `${prefix}_PGHOST`,
      PORT_SOURCE: `${prefix}_PGPORT`,
      ADMIN_CREDENTIAL_REFERENCE_CLASS: operational
        ? 'UE_OPERATIONAL_MIGRATION_ADMIN_REFERENCE'
        : 'FINANCIAL_SERVICE_MIGRATION_REFERENCE',
      RUNTIME_CREDENTIAL_REFERENCE_CLASS: operational
        ? 'UE_OPERATIONAL_APPLICATION_OR_SYSTEM_REFERENCE'
        : 'FINANCIAL_SERVICE_RUNTIME_REFERENCE',
      SCHEMA_CONTRACT: [scopeSchema(scope), `${scope}_PG_CATALOG`],
      SEARCH_PATH_CONTRACT: actorDefinitions
        .filter((a) => a[2] === scope)
        .map((a) => searchId(a[4])),
      SOURCE_CONFIGURATION_ALIGNED: 'PARTIAL',
      CONTRACT_DEFINED: 'YES',
      RUNTIME_PROVEN: 'NO',
      DISTINCT_FROM_SCOPE_ID: operational ? 'FINANCIAL_SERVICE' : 'UE_OPERATIONAL',
      SAME_DATABASE_DIFFERENT_SCHEMA_COUNTS_AS_DISTINCT_SCOPE: 'NO',
      SAME_SERVER_DIFFERENT_DATABASE_ALLOWED: 'YES; exact database key must differ',
      EVIDENCE_REFERENCES: operational
        ? e.physicalDatabaseBinding.EVIDENCE
        : e.PHYSICAL_DB_BINDING_RECORDS.find((b) => b.PROCESS_OR_SERVICE === 'financial-service')
            .CONFIG_SOURCE,
    }
  })
}

function makeSchemas() {
  return scopeIds.flatMap((scope) => [
    {
      SCHEMA_ID: scopeSchema(scope),
      DATABASE_SCOPE_ID: scope,
      SCHEMA_NAME: 'public',
      OWNER_CLASS:
        scope === 'UE_OPERATIONAL'
          ? 'GOVERNED_DDL_OWNER_FOR_DJANGO_AND_APPROVED_PLATFORM_OBJECTS'
          : 'GOVERNED_FINANCIAL_DDL_OWNER',
      OWNER_PRINCIPAL_ASSIGNED_BY: 'W3',
      PURPOSE:
        scope === 'UE_OPERATIONAL'
          ? 'Canonical existing operational namespace, compatible with frozen public/unqualified identities'
          : 'Prospectively approved financial namespace within its own distinct physical database; not inherited from UE defaults',
      PUBLIC_SCHEMA_ROLE:
        scope === 'UE_OPERATIONAL' ? 'CANONICAL_OPERATIONAL_SCHEMA' : 'CANONICAL_FINANCIAL_SCHEMA',
      DOMAIN_OBJECTS_ALLOWED: scope === 'UE_OPERATIONAL' ? 'YES' : 'NO',
      PLATFORM_OBJECTS_ALLOWED: scope === 'UE_OPERATIONAL' ? 'YES' : 'NO',
      SECURITY_HELPERS_ALLOWED: 'YES',
      FINANCIAL_OBJECTS_ALLOWED: scope === 'FINANCIAL_SERVICE' ? 'YES' : 'NO',
      PUBLIC_OR_RUNTIME_CREATE_ALLOWED: 'NO',
      TRUST_PRECONDITION:
        'W3 must enforce no PUBLIC/application/system CREATE and no untrusted/transitively writable schema; W4/W7 inventory producer collisions before privileged lookup',
      DJANGO_DOMAIN_CREATION_AUTHORITY:
        scope === 'UE_OPERATIONAL'
          ? 'DJANGO; organizations stays Django-owned; no platform DDL surrogate'
          : 'NOT_APPLICABLE',
      PHYSICALLY_CREATED_OR_OWNERSHIP_APPLIED: 'NO',
    },
    {
      SCHEMA_ID: `${scope}_PG_CATALOG`,
      DATABASE_SCOPE_ID: scope,
      SCHEMA_NAME: 'pg_catalog',
      OWNER_CLASS: 'POSTGRESQL_SYSTEM',
      PURPOSE: 'Built-in lookup only; never application/financial/bootstrap object creation',
      DOMAIN_OBJECTS_ALLOWED: 'NO',
      PLATFORM_OBJECTS_ALLOWED: 'NO',
      SECURITY_HELPERS_ALLOWED: 'NO',
      FINANCIAL_OBJECTS_ALLOWED: 'NO',
      BOOTSTRAP_WRITES_ALLOWED: 'NO',
    },
  ])
}

function makePaths() {
  return actorDefinitions.map(([name, , scope, role, purpose]) => {
    const provisioning = name.endsWith('PROVISIONING')
    const migration =
      !provisioning && (role === 'MIGRATION_ADMIN' || role === 'FINANCIAL_MIGRATION')
    const ordered = provisioning
      ? ['pg_catalog']
      : migration
        ? ['public', 'pg_catalog']
        : ['pg_catalog', 'public']
    return {
      SEARCH_PATH_CONTRACT_ID: searchId(purpose),
      DATABASE_SCOPE_ID: scope,
      ACTOR_ID: actorId(name),
      ROLE_CLASS: role,
      SEARCH_PATH: ordered,
      SEARCH_PATH_SOURCE: 'GOVERNED_PROSPECTIVE_CONTRACT',
      APPLICATION_REQUIREMENT:
        'EXPLICIT_CONNECTION_CONFIGURATION; fixed on every new/reused pool connection before any SQL; wrong/ambient/URL-overridden path fails fast',
      ROLE_AND_DATABASE_DEFAULTS_SUFFICIENT: 'NO',
      PG_CATALOG_HANDLING: 'EXPLICIT_IN_SEARCH_PATH',
      PG_TEMP_HANDLING: 'NOT_EXPLICITLY_ALLOWED',
      TEMP_PRIVILEGE_ALLOWED: 'NO',
      TEMP_IMPLICIT_LOOKUP_CAVEAT:
        'Omitting pg_temp does not suppress PostgreSQL implicit temporary relation/type lookup; W3 must deny effective TEMP including PUBLIC/inherited privileges; W8 rejects unexpected temporary namespace. Qualify privileged references regardless.',
      SCHEMA_IDS: ordered.map((s) => (s === 'public' ? scopeSchema(scope) : `${scope}_PG_CATALOG`)),
      CREATION_NAMESPACE: migration ? 'public' : 'NO_UNQUALIFIED_DDL_ALLOWED',
      REASON: provisioning
        ? 'Provisioning uses schema-qualified DDL only, with built-in lookup first and no domain search schema'
        : migration
          ? 'Django/frozen unqualified CREATE must target public, not pg_catalog; public is governed trusted-only. New privileged SQL remains qualified and built-in collision checks are required before legacy execution.'
          : 'Runtime places pg_catalog before governed public to prioritize built-ins; it cannot create objects. System privilege does not broaden search path.',
      PATH_DIFFERENCE_IS_PRIVILEGE_BROADENING: 'NO',
      APPLIED_OR_RUNTIME_PROVEN: 'NO',
    }
  })
}

function makeActors(e, scopes) {
  const existing = (process) =>
    e.PHYSICAL_DB_BINDING_RECORDS.find((b) => b.PROCESS_OR_SERVICE === process)
  const scoped = existing('apply-icra-capability-migration')
  const django = existing('apply-django-migrations')
  const financial = existing('financial-service')
  const implementation = {
    DJANGO_MIGRATION: {
      binding: django,
      exists: 'YES',
      env: [
        'MIGRATION_ADMIN_URL',
        'ADMIN_PGHOST',
        'ADMIN_PGPORT',
        'ADMIN_PGDATABASE',
        'PGHOST',
        'PGPORT',
        'PGDATABASE',
      ],
      secret: [django.SHARED_BINDING_KEY],
      evidence: django.CONFIG_SOURCE,
    },
    SCOPED_SECURITY_MIGRATION: {
      binding: scoped,
      exists: 'YES',
      env: ['RLS_MIGRATION_ADMIN_DATABASE_URL', 'ADMIN_DATABASE_URL'],
      secret: [scoped.SHARED_BINDING_KEY],
      evidence: scoped.CONFIG_SOURCE,
      coverage: 'Only targeted existing runner evidenced, not full frozen-manifest executor',
    },
    PROVISIONING: {
      exists: 'YES',
      env: ['PROVISION_ADMIN_DATABASE_URL', 'PROVISION_KEY_VAULT_NAME'],
      secret: ['UE_OPERATIONAL_PROVISION_ADMIN_CREDENTIAL_REFERENCE (prospective)'],
      evidence: e.roleAuthority.flatMap((r) => r.EVIDENCE),
      coverage:
        'Existing role creator only; complete governed role/extension provisioner pending W3',
    },
    PRECONSUMER_BASELINE: {
      exists: 'NO',
      env: ['UE_PLATFORM_BASELINE_ADMIN_DATABASE_URL'],
      secret: [django.SHARED_BINDING_KEY],
      evidence: [],
      coverage: 'Governed baseline executor not implemented',
    },
    APPLICATION_RUNTIME: {
      exists: 'YES',
      env: ['DATABASE_URL', 'RUNTIME_URL', 'PGHOST', 'PGPORT', 'PGDATABASE'],
      secret: ['UE_OPERATIONAL_APPLICATION_CREDENTIAL_REFERENCE (prospective normalized selector)'],
      evidence: [e.physicalDatabaseBinding.DEPLOYMENT_RUNTIME_TRANSLATION.EVIDENCE],
      coverage:
        'Next runtime and Django sidecar share one governed application target; existing runtime translation is not migration/runtime equality proof',
    },
    SYSTEM_RUNTIME: {
      exists: 'NO',
      env: ['SYSTEM_URL'],
      secret: ['UE_OPERATIONAL_SYSTEM_CREDENTIAL_REFERENCE (prospective normalized selector)'],
      evidence: [e.physicalDatabaseBinding.DEPLOYMENT_RUNTIME_TRANSLATION.EVIDENCE],
      coverage:
        'System URL name recorded in accepted workflow inventory, but that is not proof of a separately implemented system actor; exact system process/pool application remains W8 duty',
    },
    FINANCIAL_PROVISIONING: {
      exists: 'NO',
      env: ['FINANCIAL_PROVISION_ADMIN_DATABASE_URL'],
      secret: ['FINANCIAL_SERVICE_PROVISION_CREDENTIAL_REFERENCE (prospective)'],
      evidence: [],
      coverage: 'Separate financial provisioning target; no operational fallback',
    },
    FINANCIAL_MIGRATION: {
      exists: 'YES',
      env: ['DATABASE_URL', 'FINANCIAL_MIGRATION_DATABASE_URL'],
      secret: ['FINANCIAL_SERVICE_MIGRATION_CREDENTIAL_REFERENCE (prospective)'],
      evidence: e.financialScopeAuthority.CANDIDATE_EVIDENCE,
      coverage: 'Existing manual partial runner only; full canonical materializer not implemented',
    },
    FINANCIAL_RUNTIME: {
      binding: financial,
      exists: 'YES',
      env: ['DATABASE_URL', 'FINANCIAL_RUNTIME_DATABASE_URL'],
      secret: ['FINANCIAL_SERVICE_RUNTIME_CREDENTIAL_REFERENCE (prospective)'],
      evidence: financial.CONFIG_SOURCE,
    },
  }
  return actorDefinitions.map(([name, actorClass, scope, role, search, owner]) => {
    const current = implementation[name]
    assert(current)
    const target = scopes.find((s) => s.DATABASE_SCOPE_ID === scope)
    const descriptor = target.TARGET_CONFIGURATION_CONTRACT
    return {
      DATABASE_ACTOR_ID: actorId(name),
      ACTOR_CLASS: actorClass,
      ACTOR_PURPOSE: name,
      DATABASE_SCOPE_ID: scope,
      TARGET_ID: descriptor.TARGET_ID,
      TARGET_ENVIRONMENT_VARIABLES: [
        descriptor.ENVIRONMENT_ID_SOURCE,
        descriptor.HOST_SOURCE,
        descriptor.PORT_SOURCE,
        descriptor.DATABASE_NAME_SOURCE,
      ],
      TARGET_ENVIRONMENT_VARIABLE_STATUS:
        'PROSPECTIVE_REQUIRED_NAMES; no environment read or changed in W2',
      EXISTING_ENVIRONMENT_VARIABLE_NAMES: current.env,
      SECRET_REFERENCE_NAMES: current.secret,
      SECRET_REFERENCE_STATUS: current.binding?.SHARED_BINDING_KEY
        ? 'EXISTING_STATIC_REFERENCE_RETAINED'
        : 'PROSPECTIVE_NORMALIZED_REFERENCE_CLASS; physical secret resource mapping required by W3/W7/W8',
      DATABASE_NAME_BINDING: descriptor.DATABASE_NAME_SOURCE,
      HOST_BINDING: descriptor.HOST_SOURCE,
      PORT_BINDING: descriptor.PORT_SOURCE,
      ENVIRONMENT_BINDING: descriptor.ENVIRONMENT_ID_SOURCE,
      SEARCH_PATH_SOURCE: 'GOVERNED_PROSPECTIVE_CONTRACT',
      SEARCH_PATH_CONTRACT_ID: searchId(search),
      SCHEMA_IDS: target.SCHEMA_CONTRACT,
      ROLE_CLASS: role,
      PRINCIPAL_OR_GRANTS_ASSIGNED: 'NO; W3',
      IMPLEMENTATION_EXISTS: current.exists,
      IMPLEMENTATION_COVERAGE:
        current.coverage ??
        'Existing runner/runtime surface evidenced; canonical binding not yet applied',
      BINDING_IMPLEMENTED: 'NO',
      CONTRACT_DEFINED: 'YES',
      SOURCE_CONFIGURATION_ALIGNED: current.exists === 'YES' ? 'PARTIAL' : 'NO',
      RUNTIME_PROVEN: 'NO',
      IMPLEMENTATION_OWNER: owner,
      CREDENTIAL_ALIAS_RULE:
        'Existing URL/PG* names may be adapters only; decoded target and all connection options must be validated against this scope descriptor. No last-one-wins, ambient fallback, runtime admin reuse or financial/operational alias.',
      EVIDENCE_REFERENCES: current.evidence,
      FROZEN_BINDING_IDS: current.binding ? [current.binding.BINDING_ID] : [],
      CURRENT_SOURCE_SEARCH_PATH:
        current.binding?.SCHEMA_SEARCH_PATH ??
        'No actor-specific fixed path evidenced in frozen A1E',
    }
  })
}

export function validateDescriptors(contract, descriptors) {
  const byActor = new Map()
  const keys = new Map()
  for (const descriptor of descriptors) {
    const actor = contract.databaseActors.find(
      (a) => a.DATABASE_ACTOR_ID === descriptor.DATABASE_ACTOR_ID,
    )
    assert(actor, 'Unknown database actor')
    assert(!byActor.has(actor.DATABASE_ACTOR_ID), 'Duplicate database actor descriptor')
    assert.equal(descriptor.DATABASE_SCOPE_ID, actor.DATABASE_SCOPE_ID, 'Wrong database scope')
    assert.equal(descriptor.TARGET_ID, actor.TARGET_ID, 'Wrong target contract')
    assert.equal(descriptor.ROLE_CLASS, actor.ROLE_CLASS, 'Wrong role class')
    for (const key of ['ENVIRONMENT_ID', 'HOST', 'DATABASE_NAME']) {
      assert(
        typeof descriptor[key] === 'string' &&
          descriptor[key].length > 0 &&
          descriptor[key].trim() === descriptor[key],
        `Missing/ambient ${key}`,
      )
    }
    const host = descriptor.HOST.toLowerCase().replace(/\.$/, '')
    assert(
      isIP(host) > 0 ||
        (host.length <= 253 &&
          host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))),
      'Host must be explicit canonical DNS/IP text, not a URL or malformed name',
    )
    assert(!/[\u0000-\u001f\u007f]/.test(descriptor.DATABASE_NAME), 'Invalid database name')
    assert(
      Number.isInteger(descriptor.PORT) && descriptor.PORT >= 1 && descriptor.PORT <= 65535,
      'Missing/invalid explicit port',
    )
    const search = contract.searchPathContracts.find(
      (p) => p.SEARCH_PATH_CONTRACT_ID === actor.SEARCH_PATH_CONTRACT_ID,
    )
    assert.deepEqual(descriptor.SEARCH_PATH, search.SEARCH_PATH, 'Wrong/ambient search path')
    assert.equal(descriptor.TEMP_PRIVILEGE, 'DENIED', 'Implicit temporary lookup not bounded')
    const physicalKey = JSON.stringify([host, descriptor.PORT, descriptor.DATABASE_NAME])
    const tuple = JSON.stringify([
      descriptor.ENVIRONMENT_ID,
      host,
      descriptor.PORT,
      descriptor.DATABASE_NAME,
    ])
    const previous = keys.get(actor.DATABASE_SCOPE_ID)
    if (previous)
      assert.equal(tuple, previous.tuple, 'Same-scope actors target different database/environment')
    else keys.set(actor.DATABASE_SCOPE_ID, { tuple, physicalKey })
    byActor.set(actor.DATABASE_ACTOR_ID, descriptor)
  }
  exact(
    [...byActor.keys()],
    contract.databaseActors.map((a) => a.DATABASE_ACTOR_ID),
    'Actor descriptors',
  )
  assert.notEqual(
    keys.get('UE_OPERATIONAL').physicalKey,
    keys.get('FINANCIAL_SERVICE').physicalKey,
    'Financial and operational physical database collision',
  )
  const environments = new Set(descriptors.map((d) => d.ENVIRONMENT_ID))
  assert.equal(environments.size, 1, 'Cross-environment composition')
  return 'PASS'
}

function makeDrift(actors, paths, e) {
  const records = []
  for (const actor of actors) {
    const search = paths.find((p) => p.SEARCH_PATH_CONTRACT_ID === actor.SEARCH_PATH_CONTRACT_ID)
    records.push({
      W2_CONFIGURATION_DRIFT_ID: `UE-W2-DRIFT-${actor.ACTOR_PURPOSE}-PATH`,
      ACTOR_ID: actor.DATABASE_ACTOR_ID,
      GOVERNED_VALUE: {
        SEARCH_PATH: search.SEARCH_PATH,
        TARGET_DESCRIPTOR_REQUIRED: true,
        TEMP_PRIVILEGE: 'DENIED',
      },
      CURRENT_SOURCE_VALUE: {
        SEARCH_PATH: actor.CURRENT_SOURCE_SEARCH_PATH,
        IMPLEMENTATION_COVERAGE: actor.IMPLEMENTATION_COVERAGE,
        SCOPE_DESCRIPTOR: 'No complete canonical descriptor binding established in frozen A1E',
      },
      DRIFT_CLASS:
        actor.IMPLEMENTATION_EXISTS === 'NO'
          ? 'PROSPECTIVE_IMPLEMENTATION_GAP'
          : 'SOURCE_ALIGNMENT_CEILING',
      REMEDIATION_OWNER: actor.IMPLEMENTATION_OWNER,
      ADDITIONAL_OWNER: 'W3 effective CREATE/TEMP boundaries',
      BLOCKS_W2: 'NO',
      BLOCKS_FAITHFUL_REPLAY_UNTIL_ALIGNED: 'YES',
      EVIDENCE_REFERENCES: actor.EVIDENCE_REFERENCES,
    })
  }
  records.push({
    W2_CONFIGURATION_DRIFT_ID: 'UE-W2-DRIFT-MIGRATION-RUNTIME-TARGET-EQUALITY',
    ACTOR_ID: actorId('APPLICATION_RUNTIME'),
    GOVERNED_VALUE:
      'Admin, application and system credential targets equal the single explicit UE_OPERATIONAL descriptor, credentials/roles remain distinct',
    CURRENT_SOURCE_VALUE:
      e.physicalDatabaseBinding.DEPLOYMENT_RUNTIME_TRANSLATION
        .MIGRATION_ADMIN_VERSUS_RUNTIME_SECRET_TARGET_EQUALITY,
    DRIFT_CLASS: 'SOURCE_ALIGNMENT_CEILING',
    REMEDIATION_OWNER: 'W8',
    BLOCKS_W2: 'NO',
    BLOCKS_FAITHFUL_REPLAY_UNTIL_ALIGNED: 'YES',
    EVIDENCE_REFERENCES: [e.physicalDatabaseBinding.DEPLOYMENT_RUNTIME_TRANSLATION.EVIDENCE],
  })
  const legacy = e.PHYSICAL_DB_BINDING_RECORDS.find((b) => b.PROCESS_OR_SERVICE === 'db:bootstrap')
  records.push({
    W2_CONFIGURATION_DRIFT_ID: 'UE-W2-DRIFT-LEGACY-BOOTSTRAP-TARGET',
    ACTOR_ID: actorId('PRECONSUMER_BASELINE'),
    GOVERNED_VALUE:
      'Only governed Django-first composition with explicit UE_OPERATIONAL descriptor and fixed path may be canonical',
    CURRENT_SOURCE_VALUE: {
      LEGACY_BINDING_ID: legacy.BINDING_ID,
      DATABASE_URL_VARIABLE: legacy.DATABASE_URL_VARIABLE,
      SCHEMA_SEARCH_PATH: legacy.SCHEMA_SEARCH_PATH,
      FULL_DJANGO_TARGET_COMPOSITION: legacy.FULL_DJANGO_TARGET_COMPOSITION,
    },
    DRIFT_CLASS: 'NON_CANONICAL_EXISTING_CANDIDATE',
    REMEDIATION_OWNER: 'W8',
    BLOCKS_W2: 'NO',
    BLOCKS_FAITHFUL_REPLAY_UNTIL_ALIGNED: 'YES',
    EVIDENCE_REFERENCES: legacy.CONFIG_SOURCE,
  })
  records.push({
    W2_CONFIGURATION_DRIFT_ID: 'UE-W2-DRIFT-FINANCIAL-GENERIC-URL',
    ACTOR_ID: actorId('FINANCIAL_RUNTIME'),
    GOVERNED_VALUE:
      'Financial runtime and migrator use separate role/credential references matching FINANCIAL_SERVICE descriptor; never UE_DATABASE_URL fallback',
    CURRENT_SOURCE_VALUE:
      'Accepted financial runtime and manual migration surfaces both consume generic DATABASE_URL; no separate canonical financial target/reference set or search path established',
    DRIFT_CLASS: 'SOURCE_ALIGNMENT_CEILING',
    REMEDIATION_OWNER: 'W7',
    ADDITIONAL_OWNER: 'W8',
    BLOCKS_W2: 'NO',
    BLOCKS_FAITHFUL_REPLAY_UNTIL_ALIGNED: 'YES',
    EVIDENCE_REFERENCES: e.PHYSICAL_DB_BINDING_RECORDS.find(
      (b) => b.PROCESS_OR_SERVICE === 'financial-service',
    ).CONFIG_SOURCE,
  })
  return records
}

function makeDownstream(actors, work) {
  const objectives = {
    W3: 'Map separate role/credential classes to exact scope targets; provision governed schema ownership/CREATE/TEMP boundaries and mandatory extensions under fixed qualified provisioning paths. No principal/grant/extension is created by W2.',
    W4: 'Implement real Django-owned and approved preconsumer producers in operational public; preserve domain authority and frozen SQL. Validate collision-free trusted schema before legacy public-first DDL.',
    W6: 'Bind raw/opaque helper, policy and privileged semantic targets to exact scope/schema/function path; prohibit ambient and cross-scope resolution.',
    W7: 'Implement fail-fast full financial materializer and isolated migration/runtime credential adapters; financial public belongs to a distinct physical database.',
    W8: 'Compose descriptors into every connection/pool, reject ambient/conflicting URL/PG* options, verify same-operational/distinct-financial targets and effective paths/CREATE/TEMP boundaries before any replay. Apply runtime/secret/configuration alignment only in its authorized lane.',
  }
  return Object.entries(objectives).map(([owner, objective]) => {
    const selected = actors.filter((a) =>
      owner === 'W7'
        ? a.DATABASE_SCOPE_ID === 'FINANCIAL_SERVICE'
        : ['W4', 'W6'].includes(owner)
          ? a.DATABASE_SCOPE_ID === 'UE_OPERATIONAL'
          : true,
    )
    return {
      DOWNSTREAM_TASK_ID: `UE-W2-DOWNSTREAM-${owner}`,
      OWNER_WORKSTREAM: owner,
      REQUIREMENT: objective,
      ACTOR_IDS: selected.map((a) => a.DATABASE_ACTOR_ID),
      SCOPE_IDS: [...new Set(selected.map((a) => a.DATABASE_SCOPE_ID))],
      SCHEMA_IDS: [...new Set(selected.flatMap((a) => a.SCHEMA_IDS))],
      SEARCH_PATH_CONTRACT_IDS: [...new Set(selected.map((a) => a.SEARCH_PATH_CONTRACT_ID))],
      W2_OBLIGATION_IDS: work.INPUT_OBLIGATION_IDS,
      W2_DECISION_IDS: work.INPUT_DECISION_IDS,
      IMPLEMENTED_OR_STARTED_BY_W2: 'NO',
      FAILURE_BEHAVIOR: 'FAIL_FAST_BEFORE_FIRST_BOOTSTRAP_CONSUMER',
      VERIFICATION_OWNER: 'W8 preflight; W9 separately authorized runtime proof',
    }
  })
}

function structuralRisks() {
  return [
    [
      'UNTRUSTED_PRECEDENCE',
      'An untrusted/writable public schema before trusted built-ins could alter lookup in legacy migrations',
      'W3',
      'No PUBLIC/runtime/system CREATE, including inherited paths; W4 validates governed producer inventory. Runtime uses pg_catalog first.',
    ],
    [
      'PUBLIC_BEFORE_CATALOG_DDL',
      'Django/frozen unqualified CREATE requires public first; that ordering cannot alone prove built-in helper lookup integrity',
      'W4',
      'New privileged references are schema-qualified; legacy producers require known public helper inventory/collision checks before execution, otherwise fail.',
    ],
    [
      'UNQUALIFIED_PRIVILEGED_HELPERS',
      'Caller/search-path inheritance or overloaded helper names could make privileged resolution ambiguous',
      'W6',
      'Explicit function-specific trusted path and schema-qualified helper/table/type references; no caller ambient path.',
    ],
    [
      'MIGRATION_TARGET_AMBIGUITY',
      'Separate URL/PG* adapters or role/database defaults can target a different endpoint/path despite a successful command',
      'W8',
      'Compare exact non-secret descriptor tuple and actual connection identity/path under later authorized validation; mismatch fails before consumer.',
    ],
    [
      'RUNTIME_TARGET_AMBIGUITY',
      'Admin/runtime secret references need not resolve to equal targets; generic financial URL can accidentally select operational database',
      'W8',
      'Separate credential classes; require same operational tuple, distinct financial tuple and fixed pool paths. No fallback.',
    ],
    [
      'IMPLICIT_TEMP_LOOKUP',
      'Omitted pg_temp can still precede explicit schemas for relation/type lookup when a temporary namespace exists',
      'W3',
      'Deny effective TEMP via PUBLIC and inherited roles; qualify privileged references; W8 checks no unexpected temp namespace before privileged execution. No automatic assumption from path omission.',
    ],
  ].map(([name, risk, owner, mitigation]) => ({
    STRUCTURAL_RISK_ID: `UE-W2-RISK-${name}`,
    STRUCTURAL_RISK: risk,
    REQUIRED_MITIGATION: mitigation,
    IMPLEMENTATION_OWNER: owner,
    RESIDUAL_STATE: 'REQUIRES_DOWNSTREAM_IMPLEMENTATION_AND_VERIFICATION',
    EXPLOITABILITY_ASSESSED_OR_CLAIMED: 'NO',
    BLOCKS_W2_CONTRACT: 'NO; concrete downstream controls specified, not claimed applied',
  }))
}

function validateReferences(contract, work) {
  const sets = {
    ACTOR_IDS: new Set(contract.databaseActors.map((a) => a.DATABASE_ACTOR_ID)),
    SCOPE_IDS: new Set(contract.databaseScopes.map((s) => s.DATABASE_SCOPE_ID)),
    SCHEMA_IDS: new Set(contract.schemas.map((s) => s.SCHEMA_ID)),
    SEARCH_PATH_CONTRACT_IDS: new Set(
      contract.searchPathContracts.map((s) => s.SEARCH_PATH_CONTRACT_ID),
    ),
    W2_OBLIGATION_IDS: new Set(work.INPUT_OBLIGATION_IDS),
    W2_DECISION_IDS: new Set(work.INPUT_DECISION_IDS),
  }
  for (const key of ['databaseActors', 'databaseScopes', 'schemas', 'searchPathContracts']) {
    const id = {
      databaseActors: 'DATABASE_ACTOR_ID',
      databaseScopes: 'DATABASE_SCOPE_ID',
      schemas: 'SCHEMA_ID',
      searchPathContracts: 'SEARCH_PATH_CONTRACT_ID',
    }[key]
    assert.equal(
      new Set(contract[key].map((r) => r[id])).size,
      contract[key].length,
      `Duplicate ${key}`,
    )
  }
  for (const task of contract.downstreamImplementationPacket) {
    for (const [key, set] of Object.entries(sets)) {
      assert(task[key].length > 0, `Missing ${key}`)
      assert(
        task[key].every((id) => set.has(id)),
        `Unknown downstream ${key}`,
      )
      assert.equal(new Set(task[key]).size, task[key].length)
    }
  }
  exact(
    contract.obligationLinkage.map((o) => o.OBLIGATION_ID),
    work.INPUT_OBLIGATION_IDS,
    'W2 linkage',
  )
  exact(
    contract.governanceDecisions.map((d) => d.DECISION_ID),
    work.INPUT_DECISION_IDS,
    'W2 decisions',
  )
  for (const actor of contract.databaseActors) {
    assert(sets.SCOPE_IDS.has(actor.DATABASE_SCOPE_ID))
    assert(sets.SEARCH_PATH_CONTRACT_IDS.has(actor.SEARCH_PATH_CONTRACT_ID))
    assert(actor.SCHEMA_IDS.every((id) => sets.SCHEMA_IDS.has(id)))
    const target = contract.databaseScopes.find(
      (s) => s.DATABASE_SCOPE_ID === actor.DATABASE_SCOPE_ID,
    )
    assert.equal(target.TARGET_CONFIGURATION_CONTRACT.TARGET_ID, actor.TARGET_ID)
    const search = contract.searchPathContracts.find(
      (s) => s.SEARCH_PATH_CONTRACT_ID === actor.SEARCH_PATH_CONTRACT_ID,
    )
    assert.equal(search.DATABASE_SCOPE_ID, actor.DATABASE_SCOPE_ID)
    assert.equal(search.ACTOR_ID, actor.DATABASE_ACTOR_ID)
    assert(!search.SEARCH_PATH.includes('$user') && !search.SEARCH_PATH.includes('pg_temp'))
    assert.equal(search.PG_CATALOG_HANDLING, 'EXPLICIT_IN_SEARCH_PATH')
    assert(
      search.SCHEMA_IDS.every((id) =>
        contract.schemas.some(
          (s) => s.SCHEMA_ID === id && s.DATABASE_SCOPE_ID === actor.DATABASE_SCOPE_ID,
        ),
      ),
    )
  }
  for (const row of contract.roleClassTargetMatrix) {
    assert(row.ACTOR_IDS.length > 0)
    assert(
      row.ACTOR_IDS.every((id) =>
        contract.databaseActors.some(
          (a) =>
            a.DATABASE_ACTOR_ID === id &&
            a.ROLE_CLASS === row.ROLE_CLASS &&
            a.DATABASE_SCOPE_ID === row.DATABASE_SCOPE_ID,
        ),
      ),
    )
    assert(
      row.SCHEMA_IDS.every((id) =>
        contract.schemas.some(
          (s) => s.SCHEMA_ID === id && s.DATABASE_SCOPE_ID === row.DATABASE_SCOPE_ID,
        ),
      ),
    )
    assert(
      row.SEARCH_PATH_CONTRACT_IDS.every((id) =>
        contract.searchPathContracts.some(
          (p) =>
            p.SEARCH_PATH_CONTRACT_ID === id &&
            p.ROLE_CLASS === row.ROLE_CLASS &&
            p.DATABASE_SCOPE_ID === row.DATABASE_SCOPE_ID,
        ),
      ),
    )
  }
  for (const drift of contract.configurationDrift) {
    assert(sets.ACTOR_IDS.has(drift.ACTOR_ID), 'Unknown drift actor')
    assert(['W3', 'W4', 'W6', 'W7', 'W8'].includes(drift.REMEDIATION_OWNER), 'Unknown drift owner')
  }
  assert(contract.governanceDecisions.every((d) => d.APPROVED === 'YES'))
  assert(contract.obligationLinkage.every((o) => o.IMPLEMENTED_BY_W2 === 'YES'))
  assert(contract.configurationDrift.every((d) => d.BLOCKS_W2 === 'NO'))
}

function syntheticTests(contract) {
  const descriptor = (actor) => ({
    DATABASE_ACTOR_ID: actor.DATABASE_ACTOR_ID,
    DATABASE_SCOPE_ID: actor.DATABASE_SCOPE_ID,
    TARGET_ID: actor.TARGET_ID,
    ROLE_CLASS: actor.ROLE_CLASS,
    ENVIRONMENT_ID: 'synthetic-offline-fixture',
    HOST: 'database.example.test',
    PORT: 5432,
    DATABASE_NAME:
      actor.DATABASE_SCOPE_ID === 'UE_OPERATIONAL' ? 'fixture_operational' : 'fixture_financial',
    SEARCH_PATH: contract.searchPathContracts.find(
      (p) => p.SEARCH_PATH_CONTRACT_ID === actor.SEARCH_PATH_CONTRACT_ID,
    ).SEARCH_PATH,
    TEMP_PRIVILEGE: 'DENIED',
  })
  const correct = contract.databaseActors.map(descriptor)
  assert.equal(validateDescriptors(contract, correct), 'PASS')
  const reject = (modify) => {
    const fixture = structuredClone(correct)
    modify(fixture)
    assert.throws(() => validateDescriptors(contract, fixture))
  }
  reject((r) => r.pop())
  reject((r) => r.push(r[0]))
  reject((r) => {
    r[0].DATABASE_SCOPE_ID = 'FINANCIAL_SERVICE'
  })
  reject((r) => {
    r[0].TARGET_ID = 'ambient'
  })
  reject((r) => {
    r[0].HOST = ''
  })
  reject((r) => {
    r[0].HOST = '.'
  })
  reject((r) => {
    r[0].HOST = 'malformed..host'
  })
  reject((r) => {
    r[0].PORT = undefined
  })
  reject((r) => {
    r[0].DATABASE_NAME = ''
  })
  reject((r) => {
    r[0].DATABASE_NAME = 'wrong_target'
  })
  reject((r) => {
    r[0].ROLE_CLASS = 'APPLICATION_RUNTIME'
  })
  reject((r) => {
    r[0].ENVIRONMENT_ID = 'another_environment'
  })
  reject((r) => {
    r[0].SEARCH_PATH = ['$user', 'public']
  })
  reject((r) => {
    r[0].SEARCH_PATH = ['public', 'pg_catalog', 'pg_temp']
  })
  reject((r) => {
    r[0].TEMP_PRIVILEGE = 'ALLOWED'
  })
  reject((r) => {
    for (const x of r) x.DATABASE_NAME = 'one_collapsed_database'
  })
  const normalizedHost = structuredClone(correct)
  normalizedHost[0].HOST = 'DATABASE.EXAMPLE.TEST.'
  assert.equal(validateDescriptors(contract, normalizedHost), 'PASS')
  return {
    POSITIVE: 2,
    NEGATIVE: 16,
    MODE: 'SYNTHETIC_NON_SECRET_DESCRIPTORS_ONLY; no environment, SQL or database IO',
  }
}

async function build(inputs) {
  const { c, w1, n, e, work, obligations, decisions } = validateFrozen(inputs)
  const scopes = makeScopes(e)
  const schemas = makeSchemas()
  const paths = makePaths()
  const actors = makeActors(e, scopes)
  const packet = makeDownstream(actors, work)
  const qualification = {
    DDL_OBJECT_REFERENCES: 'MIXED_EXPLICIT_RULE',
    EXISTING_FROZEN_MIGRATIONS: 'ALLOWED_UNDER_FIXED_GOVERNED_SEARCH_PATH',
    DJANGO_UNQUALIFIED_DB_TABLES: 'ALLOWED_UNDER_FIXED_GOVERNED_SEARCH_PATH',
    NEW_PRIVILEGED_BOOTSTRAP_SQL: 'REQUIRE_SCHEMA_QUALIFICATION',
    NEW_HELPER_TABLE_TYPE_FUNCTION_REFERENCES: 'REQUIRE_SCHEMA_QUALIFICATION',
    NEW_BUILTIN_PRIVILEGED_REFERENCES: 'REQUIRE_PG_CATALOG_QUALIFICATION',
    DJANGO_DEFAULT_DB_TABLE_SCHEMA: 'public in UE_OPERATIONAL only',
    FROZEN_SQL_REWRITTEN: 'NO',
    CROSS_SCOPE_RULES: {
      UE_OPERATIONAL_CODE_MAY_TARGET_FINANCIAL_SCOPE: 'NO',
      FINANCIAL_RUNTIME_MAY_TARGET_UE_OPERATIONAL_SCOPE: 'NO',
      BUSINESS_INTEGRATION: 'OUTSIDE_W2; requires separately approved later integration contract',
    },
  }
  const functions = {
    FUNCTION_SEARCH_PATH_MUST_BE_EXPLICIT: 'YES',
    APPLIES_TO: ['SECURITY_DEFINER', 'policy helper', 'trigger helper', 'privileged helper'],
    UE_FUNCTION_SEARCH_PATH: ['pg_catalog', 'public'],
    FINANCIAL_FUNCTION_SEARCH_PATH: ['pg_catalog', 'public'],
    SCOPE_ISOLATION: 'Each function path refers to public in its own database only',
    CALLER_AMBIENT_PATH_ALLOWED: 'NO',
    PG_TEMP_HANDLING: 'NOT_EXPLICITLY_ALLOWED',
    PRIVILEGED_RELATION_TYPE_HELPER_REFERENCES: 'REQUIRE_SCHEMA_QUALIFICATION',
    TRUST_PRECONDITIONS: [
      'No untrusted schema CREATE',
      'No effective TEMP via PUBLIC/inherited privileges',
      'Privileged references qualified; function owner/ACL decisions W3/W6',
    ],
    EXISTING_FROZEN_FUNCTION_DRIFT:
      'Do not rewrite frozen SQL. W6 must adjudicate actual fixed function paths/qualified dependencies; incompatibility fails before replay.',
    CREATED_OR_ALTERED: 'NO',
  }
  const governedDecisions = decisions.map((d) => ({
    DECISION_ID: d.DECISION_ID,
    SUBJECT: d.SUBJECT,
    DECISION: d.SUBJECT.includes('schema')
      ? {
          SCHEMAS: schemas,
          SEARCH_PATHS: paths.map((p) => ({
            ID: p.SEARCH_PATH_CONTRACT_ID,
            SCOPE: p.DATABASE_SCOPE_ID,
            PATH: p.SEARCH_PATH,
          })),
          QUALIFICATION: qualification,
          FUNCTION_PATHS: functions,
        }
      : {
          SCOPE_IDS: scopeIds,
          TARGET_DESCRIPTORS: scopes.map((s) => s.TARGET_CONFIGURATION_CONTRACT),
          SAME_OPERATIONAL_TARGET: 'YES',
          DISTINCT_FINANCIAL_TARGET: 'YES',
          CREDENTIAL_ROLES_DISTINCT: 'YES',
        },
    RATIONALE: d.SUBJECT.includes('schema')
      ? 'Retain frozen public/unqualified operational lineage; select financial public independently within a distinct database. Migration public-first is necessary for Django CREATE; runtime catalog-first limits lookup ambiguity. No cosmetic new schema.'
      : 'Accepted A1E establishes shared Django/scoped reference only; mandate one scope-specific descriptor for all operational actors and a physically different financial descriptor. No live hostname or credential equality is inferred.',
    EVIDENCE_REFERENCES: [files.canonical, files.a1e, files.w1, files.w1n],
    APPROVED: 'YES',
    APPROVAL_AUTHORITY:
      'Explicit W2 maintainer mission authorizes target/schema/search-path adjudication',
    IMPLEMENTATION_REQUIRED_BY: ['W3', 'W4', 'W6', 'W7', 'W8'],
    RUNTIME_CONFIGURATION_APPLIED: 'NO',
  }))
  const linkage = obligations.map((o) => ({
    OBLIGATION_ID: o.OBLIGATION_ID,
    W2_REQUIREMENT: o.REQUIRED_EVIDENCE,
    CONTRACT_VALUE: {
      SCOPE_IDS: scopeIds,
      ACTOR_IDS: actors.map((a) => a.DATABASE_ACTOR_ID),
      SCHEMA_IDS: schemas.map((s) => s.SCHEMA_ID),
      SEARCH_PATH_CONTRACT_IDS: paths.map((p) => p.SEARCH_PATH_CONTRACT_ID),
      ROLE_CLASSES: c.roleContract.map((r) => r.ROLE_CLASS),
      TARGET_MATCHING:
        'Exact environment/host/port/database descriptor; same UE scope, distinct financial physical database; no ambient fallback',
      SECRET_REFERENCE_MODEL:
        'Existing static migration-admin reference retained; runtime/financial/provisioning reference classes prospective, no values read',
    },
    IMPLEMENTED_BY_W2: 'YES',
    IMPLEMENTATION_EVIDENCE: [
      files.contract,
      'databaseScopes',
      'databaseActors',
      'schemas',
      'searchPathContracts',
      'qualificationDoctrine',
      'roleClassTargetMatrix',
      'governanceDecisions',
      'offline fail-fast descriptor tests',
    ],
    PHYSICAL_CHANGE_REQUIRED_LATER: 'YES',
    DOWNSTREAM_OWNER: ['W3', 'W4', 'W6', 'W7', 'W8'],
    CONTRACT_DEFINED: 'YES',
    SOURCE_CONFIGURATION_ALIGNED: 'PARTIAL',
    RUNTIME_PROVEN: 'NO',
  }))
  const roleMatrix = c.roleContract.map((r) => {
    const scope = r.DATABASE_SCOPE === 'union-eyes' ? 'UE_OPERATIONAL' : 'FINANCIAL_SERVICE'
    const selected = actors.filter((a) => a.ROLE_CLASS === r.ROLE_CLASS)
    return {
      ROLE_CLASS: r.ROLE_CLASS,
      DATABASE_SCOPE_ID: scope,
      TARGET_ID: scopes.find((s) => s.DATABASE_SCOPE_ID === scope).TARGET_CONFIGURATION_CONTRACT
        .TARGET_ID,
      ACTOR_IDS: selected.map((a) => a.DATABASE_ACTOR_ID),
      SCHEMA_IDS: [scopeSchema(scope), `${scope}_PG_CATALOG`],
      SEARCH_PATH_CONTRACT_IDS: selected.map((a) => a.SEARCH_PATH_CONTRACT_ID),
      PRINCIPAL_NAME_OR_GRANTS_ASSIGNED: 'NO; W3 only',
      ROLE_RUNTIME_OWNERSHIP_PROVEN: 'NO',
    }
  })
  const contract = {
    metadata: {
      PHASE: phase,
      METHOD:
        'Artifact-only authorized governance adjudication; no source rescan/environment/secret/SQL/runtime IO',
      FROZEN_INPUT_SHA256: Object.fromEntries(
        ['canonical', 'w1n', 'w1', 'a1e'].map((key) => [files[key], sha(inputs[key])]),
      ),
      W2_INPUT_OBLIGATION_IDS: work.INPUT_OBLIGATION_IDS,
      W2_INPUT_DECISION_IDS: work.INPUT_DECISION_IDS,
      SOURCE_CONFIGURATION_OBSERVATIONS:
        'Only frozen A1E; ceilings are alignment gaps, not current source exploitability or live target attestations',
    },
    CONTRACT_VERSION: 1,
    CANONICAL_BOOTSTRAP_CONTRACT_VERSION: '1.2',
    CONTRACT_STATUS: 'GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING',
    databaseScopes: scopes,
    databaseActors: actors,
    schemas,
    searchPathContracts: paths,
    namedSearchPaths: {
      UE_DEFAULT_SEARCH_PATH: ['pg_catalog', 'public'],
      DJANGO_MIGRATION_SEARCH_PATH: ['public', 'pg_catalog'],
      UE_PLATFORM_BASELINE_SEARCH_PATH: ['public', 'pg_catalog'],
      UE_SCOPED_SECURITY_MIGRATION_SEARCH_PATH: ['public', 'pg_catalog'],
      UE_APPLICATION_RUNTIME_SEARCH_PATH: ['pg_catalog', 'public'],
      UE_SYSTEM_RUNTIME_SEARCH_PATH: ['pg_catalog', 'public'],
      FINANCIAL_MIGRATION_SEARCH_PATH: ['public', 'pg_catalog'],
      FINANCIAL_RUNTIME_SEARCH_PATH: ['pg_catalog', 'public'],
      UE_PROVISIONING_SEARCH_PATH: ['pg_catalog'],
      FINANCIAL_PROVISIONING_SEARCH_PATH: ['pg_catalog'],
    },
    sameTargetAndScopeDoctrine: {
      UE_DJANGO_TARGET_SCOPE: 'UE_OPERATIONAL',
      UE_SCOPED_SECURITY_TARGET_SCOPE: 'UE_OPERATIONAL',
      DJANGO_AND_SCOPED_SECURITY_SAME_TARGET: 'YES',
      FINANCIAL_SERVICE_TARGET_SCOPE: 'FINANCIAL_SERVICE',
      FINANCIAL_SERVICE_IS_DISTINCT_FROM_UE_OPERATIONAL: 'YES',
      STATIC_REFERENCE_EQUALITY_EVIDENCE: e.physicalDatabaseBinding,
      DEPLOYED_RUNTIME_TARGET_EQUALITY_PROVEN: 'NO',
    },
    frozenBindingDisposition: e.PHYSICAL_DB_BINDING_RECORDS.map((b) => ({
      BINDING_ID: b.BINDING_ID,
      PROCESS_OR_SERVICE: b.PROCESS_OR_SERVICE,
      DATABASE_SCOPE_ID:
        b.DATABASE_SCOPE === 'financial-service' ? 'FINANCIAL_SERVICE' : 'UE_OPERATIONAL',
      ENVIRONMENT_CLASS:
        b.DATABASE_SCOPE === 'union-eyes-disposable'
          ? 'DISPOSABLE_INSTANCE_OF_OPERATIONAL_SCOPE'
          : 'ENVIRONMENT_SELECTED',
      CANONICAL_USE:
        b.PROCESS_OR_SERVICE === 'db:bootstrap'
          ? 'NOT_ADOPTED; lacks full Django target composition'
          : 'ADAPTER_ONLY; must obey exact governed descriptor/path before later replay',
      CURRENT_SCHEMA_SEARCH_PATH: b.SCHEMA_SEARCH_PATH,
      NEW_BINDING_APPLIED: 'NO',
    })),
    qualificationDoctrine: qualification,
    functionSearchPathDoctrine: functions,
    roleClassTargetMatrix: roleMatrix,
    governanceDecisions: governedDecisions,
    obligationLinkage: linkage,
    configurationDrift: makeDrift(actors, paths, e),
    structuralRiskFindings: structuralRisks(),
    downstreamImplementationPacket: packet,
    validation: {},
    phaseStatus,
  }
  validateReferences(contract, work)
  const tests = syntheticTests(contract)
  contract.validation = {
    EXACT_W2_INPUT_OBLIGATIONS: work.INPUT_OBLIGATION_IDS.length,
    W2_OBLIGATIONS_IMPLEMENTED_AS_CONTRACT: linkage.length,
    EXACT_W2_INPUT_DECISIONS: work.INPUT_DECISION_IDS.length,
    W2_DECISIONS_APPROVED: governedDecisions.length,
    OBLIGATION_IDS_LOST: 0,
    OBLIGATION_IDS_DUPLICATED: 0,
    DECISION_IDS_LOST: 0,
    DECISION_IDS_DUPLICATED: 0,
    ACTORS: actors.length,
    SCOPES: scopes.length,
    SCHEMAS: schemas.length,
    SEARCH_PATH_CONTRACTS: paths.length,
    ROLE_CLASSES: roleMatrix.length,
    DOWNSTREAM_REFERENCE_INTEGRITY: 'PASS',
    OFFLINE_DESCRIPTOR_TESTS: tests,
    SOURCE_CONFIGURATION_APPLIED: 'NO',
    PHYSICAL_TARGET_VALUES_ACCESSED: 'NO',
    NO_DATABASE_ACCESS: true,
    NO_MIGRATION_EXECUTION: true,
    NO_ROLE_CREATION: true,
    NO_EXTENSION_INSTALLATION: true,
    NO_SCHEMA_CREATION: true,
    NO_SECRET_VALUE_ACCESS: true,
    NO_DEPLOYMENT_CONFIGURATION_MUTATION: true,
    NO_RLS_CHANGE: true,
    W1_REOPENED: 'NO',
  }
  const canonical = structuredClone(c)
  canonical.CONTRACT_VERSION = '1.2'
  canonical.versionChain = [
    {
      VERSION: 1,
      SHA256: n.PRIOR_CONTRACT_SHA256,
      RECONSTRUCTION_REFERENCE: `${files.w1n}#PRIOR_GOVERNANCE_PATCHES.CONTRACT`,
    },
    {
      VERSION: '1.1',
      SHA256: sha(inputs.canonical),
      RECONSTRUCTION_REFERENCE: `${files.report}#PRIOR_CANONICAL_INVERSE_PATCHES`,
    },
  ]
  canonical.databaseTargetAmendment = {
    AMENDMENT: amendment,
    PHASE: phase,
    PRIOR_CONTRACT_VERSION: '1.1',
    VERSION_1_SHA256: n.PRIOR_CONTRACT_SHA256,
    VERSION_1_1_SHA256: sha(inputs.canonical),
    TARGET_NAMESPACE_CONTRACT: files.contract,
    TARGET_NAMESPACE_CONTRACT_SHA256: digest(contract),
    IMPLEMENTATION_MEANING:
      'W2 target/namespace contract defined; no runtime configuration applied',
    HISTORICAL_A1G_W1N_FIELDS:
      'Retained as historical frozen evidence; current version/amendment/phaseStatus govern W2',
  }
  canonical.searchPathContract = {
    ...canonical.searchPathContract,
    DATABASE_SCHEMA_NAMES: Object.fromEntries(scopeIds.map((s) => [s, ['public', 'pg_catalog']])),
    DEFAULT_SEARCH_PATH: contract.namedSearchPaths.UE_DEFAULT_SEARCH_PATH,
    MIGRATION_SEARCH_PATH: Object.fromEntries(
      paths
        .filter((p) => p.ROLE_CLASS.includes('MIGRATION'))
        .map((p) => [p.SEARCH_PATH_CONTRACT_ID, p.SEARCH_PATH]),
    ),
    RUNTIME_SEARCH_PATH: Object.fromEntries(
      paths
        .filter((p) => p.ROLE_CLASS.includes('RUNTIME'))
        .map((p) => [p.SEARCH_PATH_CONTRACT_ID, p.SEARCH_PATH]),
    ),
    FUNCTION_SEARCH_PATH_REQUIREMENTS: functions,
    BLOCK_EXECUTION_WHILE_UNDECIDED:
      'NO; decisions closed, downstream alignment still required before replay',
    CANONICAL_CONTRACT_REFERENCE: files.contract,
  }
  canonical.databaseScopeGovernance.EXACT_TARGET_VALUES = scopes.map((s) => ({
    DATABASE_SCOPE_ID: s.DATABASE_SCOPE_ID,
    TARGET_CONFIGURATION_CONTRACT: s.TARGET_CONFIGURATION_CONTRACT,
  }))
  canonical.databaseScopeGovernance.CANONICAL_TARGET_CONTRACT = files.contract
  canonical.databaseScopeGovernance.LIVE_TARGET_ATTESTATION = 'NO'
  for (const decision of governedDecisions) {
    Object.assign(
      canonical.governanceDecisionObligations.find((d) => d.DECISION_ID === decision.DECISION_ID),
      {
        STATUS: 'APPROVED',
        APPROVED_BY_W2: 'YES',
        APPROVAL_RECORD: files.contract,
        APPROVED_CONTRACT_VALUE: decision.DECISION,
        DECISION_ASSUMED: 'NO',
        EXECUTION_BLOCKED_UNTIL_RECORDED: 'NO',
        DOWNSTREAM_ALIGNMENT_REQUIRED_BEFORE_EXECUTION: 'YES',
      },
    )
  }
  for (const link of linkage) {
    Object.assign(
      canonical.additionalContractObligations.find((o) => o.OBLIGATION_ID === link.OBLIGATION_ID),
      {
        STATUS: 'W2_CONTRACT_DEFINED',
        IMPLEMENTED_BY_W2: 'YES',
        CONTRACT_DEFINED: 'YES',
        PHYSICAL_CONFIGURATION_APPLIED: 'NO',
        RUNTIME_PROVEN: 'NO',
        IMPLEMENTATION_EVIDENCE: files.contract,
        DOWNSTREAM_OWNER: link.DOWNSTREAM_OWNER,
      },
    )
  }
  Object.assign(
    canonical.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W2'),
    {
      STARTED: 'YES',
      COMPLETION_STATUS: 'PASS',
      AUTHORIZATION_STATE: 'W2_CONTRACT_IMPLEMENTATION_COMPLETE',
      OUTPUT_ARTIFACT_REFERENCES: [files.contract, files.report],
      COMPLETION_MEANS:
        'Target/schema/search-path contract and offline fail-fast tests only; runtime alignment unimplemented',
    },
  )
  canonical.remediationWorkstreams.find((w) => w.WORKSTREAM_ID === 'W3').AUTHORIZATION_STATE =
    'AUTHORIZED_NOT_STARTED'
  Object.assign(canonical.phaseStatus, phaseStatus, {
    PHASE_1B_3C_A1I_BOOTSTRAP_CONTRACT_IMPLEMENTATION:
      'W1_IDENTITY_AND_W2_TARGET_NAMESPACE_COMPLETE_DOWNSTREAM_IMPLEMENTATION_PENDING',
  })
  assert.deepEqual(canonical.w1ObligationBoundary, c.w1ObligationBoundary)
  assert.deepEqual(canonical.amendment, c.amendment)
  for (const key of [
    'prerequisiteObligations',
    'opaqueBindingObligations',
    'orderingObligations',
    'frozenMigrationManifest',
    'financialMaterializerSpecification',
    'roleContract',
    'layers',
    'djangoExecutionContract',
  ])
    assert.deepEqual(canonical[key], c[key])
  for (const previous of c.remediationWorkstreams) {
    const current = canonical.remediationWorkstreams.find(
      (w) => w.WORKSTREAM_ID === previous.WORKSTREAM_ID,
    )
    assert.deepEqual(current.DEPENDS_ON, previous.DEPENDS_ON)
    assert.deepEqual(current.INPUT_OBLIGATION_IDS, previous.INPUT_OBLIGATION_IDS)
    assert.deepEqual(current.INPUT_DECISION_IDS, previous.INPUT_DECISION_IDS)
    if (!['W1', 'W2'].includes(current.WORKSTREAM_ID)) assert.equal(current.STARTED, 'NO')
  }
  const preservation = {
    FROZEN_FILES: Object.fromEntries(
      ['w1', 'w1n', 'a1e', 'lock', 'lockMetadata'].map((key) => [
        files[key],
        { BEFORE_SHA256: sha(inputs[key]), AFTER_SHA256: sha(read(files[key])), CHANGED: 'NO' },
      ]),
    ),
    W1_DIGESTS: approvedHashes,
    W1_GATE: 'PASS',
    PREREQUISITE_IDS_SHA256: digest(c.prerequisiteObligations.map((o) => o.PREREQUISITE_ID)),
    OPAQUE_IDS_SHA256: digest(c.opaqueBindingObligations.map((o) => o.OPAQUE_BINDING_ID)),
    ORDERING_IDS_SHA256: digest(c.orderingObligations.map((o) => o.ORDERING_RECORD_ID)),
    FROZEN_23_MIGRATION_MANIFEST_SHA256: digest(c.frozenMigrationManifest),
    WORKSTREAM_DEPENDENCY_ORDERING_SHA256: digest(
      c.remediationWorkstreams.map((w) => [w.WORKSTREAM_ID, w.DEPENDS_ON]),
    ),
    FROZEN_SOURCE_HASH_VERIFICATION:
      'Accepted manifest hashes preserved exactly within artifacts; no source file access or rescan',
  }
  for (const item of Object.values(preservation.FROZEN_FILES))
    assert.equal(item.BEFORE_SHA256, item.AFTER_SHA256)
  const report = {
    metadata: {
      PHASE: phase,
      FROZEN_INPUT_SHA256: contract.metadata.FROZEN_INPUT_SHA256,
      METHOD: contract.metadata.METHOD,
    },
    CONTRACT_VERSION: '1.2',
    AMENDMENT: amendment,
    VERSION_1_SHA256: n.PRIOR_CONTRACT_SHA256,
    VERSION_1_1_SHA256: sha(inputs.canonical),
    PRIOR_CANONICAL_INVERSE_PATCHES: inverse(c, canonical),
    PRIOR_VERSION_RECONSTRUCTION:
      'Apply inverse patches in memory; --check proves exact version 1.1 bytes. Then use frozen W1N inverse patches for version 1.',
    databaseScopes: scopes,
    databaseActors: actors,
    schemas,
    searchPathContracts: paths,
    qualificationDoctrine: qualification,
    functionSearchPathDoctrine: functions,
    roleClassTargetMatrix: roleMatrix,
    governanceDecisions: governedDecisions,
    obligationLinkage: linkage,
    configurationDrift: contract.configurationDrift,
    structuralRiskFindings: contract.structuralRiskFindings,
    downstreamImplementationPacket: packet,
    preservation,
    validation: contract.validation,
    phaseStatus,
  }
  return {
    [files.canonical]: await formatted(canonical),
    [files.contract]: await formatted(contract),
    [files.report]: await formatted(report),
    [files.contractMarkdown]: await format(markdown(contract, false), {
      ...config,
      parser: 'markdown',
    }),
    [files.reportMarkdown]: await format(markdown(report, true), { ...config, parser: 'markdown' }),
  }
}

function markdown(value, report) {
  const targetRows = value.databaseScopes
    .map(
      (s) =>
        `| ${s.DATABASE_SCOPE_ID} | ${s.HOST_SOURCE} | ${s.PORT_SOURCE} | ${s.DATABASE_NAME_SOURCE} | public in its distinct database |`,
    )
    .join('\n')
  const actorRows = value.databaseActors
    .map((a) => {
      const p = value.searchPathContracts.find(
        (s) => s.SEARCH_PATH_CONTRACT_ID === a.SEARCH_PATH_CONTRACT_ID,
      )
      return `| ${a.ACTOR_PURPOSE} | ${a.DATABASE_SCOPE_ID} | ${a.ROLE_CLASS} | ${JSON.stringify(p.SEARCH_PATH)} | ${a.IMPLEMENTATION_EXISTS} / ${a.BINDING_IMPLEMENTED} |`
    })
    .join('\n')
  const driftRows = value.configurationDrift
    .map(
      (d) =>
        `| ${d.W2_CONFIGURATION_DRIFT_ID} | ${d.REMEDIATION_OWNER} | ${d.DRIFT_CLASS} | ${d.BLOCKS_W2} |`,
    )
    .join('\n')
  const decisionRows = value.governanceDecisions
    .map((d) => `| ${d.DECISION_ID} | ${d.SUBJECT} | ${d.APPROVED} |`)
    .join('\n')
  const taskRows = value.downstreamImplementationPacket
    .map((t) => `| ${t.OWNER_WORKSTREAM} | ${t.REQUIREMENT} |`)
    .join('\n')
  const reference = report
    ? 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json'
    : 'PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json'
  const title = report
    ? 'W2 — database target, schema and search-path adjudication'
    : 'UE database target, schema and search-path contract'
  return `# ${title}

## W2 gate: PASS — contract definition only

Status: **GOVERNANCE_ADOPTED_IMPLEMENTATION_PENDING**. Canonical bootstrap contract **1.2**, amendment **DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT**. [Exact machine-readable counterpart](${report ? 'PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json' : 'UE_DATABASE_TARGET_SCHEMA_SEARCH_PATH_CONTRACT.json'}) and [related contract/evidence](${reference}) retain exact references and version history. W1/W1N stay frozen PASS.

## Physical target and scope contract

| Scope | Required host name binding | Explicit port binding | Exact database-name binding | Namespace |
|---|---|---|---|---|
${targetRows}

Select UE_DATABASE_TARGET_ENVIRONMENT once. All actors consume the exact same environment and scope descriptor; missing/empty/default values, conflicting URL/PG* components, wrong scope or wrong role fail before connection. These are prospective mandatory **configuration names**, not fabricated hostnames or read secret values. The per-environment descriptor must be populated under the later authorized composition lane before connecting; no live physical endpoint is attested by W2.

Physical equality is normalized DNS host (lowercase, one terminal dot removed), explicit integer port and exact case-sensitive database name. No DNS/alias equivalence is assumed. Operational actors must match one tuple; financial actors must match a different physical tuple. Same server/different database is allowed; same database/different schema is **not** financial separation.

Django and scoped/security migrations use UE_OPERATIONAL, retaining the accepted shared plan-selected vault/migration-admin secret reference. Separate runtime and system reference classes must match that operational target later; their values were not compared. Financial migration/runtime/provisioning references are scope-specific prospective classes, never operational credential fallback. Credential/role identity is distinct from database equality. Existing URL/PG* names are compatibility adapters only, not alternative target authorities.

## Actor, role and search-path matrix

| Actor | Scope | Role class | Exact ordered path | Executable exists / canonical binding applied |
|---|---|---|---|---|
${actorRows}

All paths are **GOVERNED_PROSPECTIVE_CONTRACT**, to be explicitly set/validated per connection and pool reuse; role/database defaults alone are insufficient. UE default/application/system runtime path is \`["pg_catalog","public"]\`. Provisioning uses \`["pg_catalog"]\` with qualified DDL. Django, platform/frozen scoped DDL and financial migration use \`["public","pg_catalog"]\` so unqualified CREATE targets public, not pg_catalog. Runtime prioritizes built-ins and cannot create objects. System access does not broaden its namespace.

## Schema authority and qualification

Operational **public = CANONICAL_OPERATIONAL_SCHEMA**, preserving Django/frozen public identities. Domain objects (including organizations) remain Django-owned, not platform surrogates. Approved platform/security helpers can occupy the same governed namespace with explicit ownership and collision controls. Financial public is independently approved inside FINANCIAL_SERVICE, not inside UE_OPERATIONAL. pg_catalog is read/lookup-only system schema. No additional decorative platform/security/internal schema is invented or created.

W3 must restrict effective public CREATE to governed DDL owners (including inherited/PUBLIC privilege paths); runtime/system actors must not own protected domain objects. No principals or grants are chosen by W2.

- Existing frozen SQL and Django unqualified objects: **allowed only under the fixed governed migration path**; no frozen SQL rewritten.
- New privileged bootstrap DDL, helper/table/type references: **require schema qualification**. Built-ins in new privileged SQL use pg_catalog qualification.
- Elevated SECURITY DEFINER, policy, trigger and privileged functions: explicit trusted function-specific \`["pg_catalog","public"]\` in their own database; no ambient caller path. W6 adjudicates existing frozen function compatibility without rewriting it.
- pg_catalog is explicit for every actor. Migration/runtime order differs only for creation-versus-lookup requirements.
- pg_temp is **NOT_EXPLICITLY_ALLOWED**. Omission does **not** suppress implicit temporary relation/type lookup. W3 must deny effective TEMP including inherited/PUBLIC privileges; privileged references remain qualified, and W8 rejects unexpected temporary namespaces before privileged execution.
- Cross-scope operational/financial targeting is prohibited. Business integration requires a later separately approved contract.

## Exact W2 decisions and obligation accounting

| Decision ID | Subject | Approved |
|---|---|---|
${decisionRows}

Exact denominator: **${value.obligationLinkage.length} W2 input obligation; ${value.governanceDecisions.length} W2 input decisions**. All are closed as target/namespace contract work, with zero lost or duplicate IDs. Obligation \`${value.obligationLinkage[0].OBLIGATION_ID}\` is IMPLEMENTED_BY_W2 = YES, CONTRACT_DEFINED = YES, SOURCE_CONFIGURATION_ALIGNED = PARTIAL, RUNTIME_PROVEN = NO. All decisions are authorized W2 architecture adjudications, not product/business decisions.

## Configuration drift / alignment register

| Drift ID | Owner | Classification | Blocks W2 |
|---|---|---|---|
${driftRows}

The register records exact governed/current values and A1E references in JSON. Existing paths and complete descriptor mappings are unpinned or not implemented in accepted evidence; migration/runtime target equality and financial generic-URL separation remain alignment ceilings. No unsupported claim about current source values is made and no source is rescanned. These gaps block faithful replay until aligned, not internally coherent W2 contract definition.

Structural reasoning covers untrusted schema precedence, public-before-catalog legacy DDL, privileged helper resolution, admin/runtime target ambiguity and implicit temporary lookup. Concrete downstream controls are specified; **no exploitability or runtime security proof is claimed**.

## Downstream implementation packet

| Owner | Exact duty |
|---|---|
${taskRows}

Every task carries exact actor, scope, schema, path, W2 obligation and W2 decision IDs. All tasks remain unimplemented/not started by W2. W8 must apply and verify target/path/privilege boundaries before faithful replay; W9 remains a separately authorized runtime-proof lane.

## Version chain and preservation

Canonical JSON 1.2 retains the version 1 digest and exact version 1.1 digest/reference. [W2 JSON](PHASE_1B_3C_A1I_W2_DATABASE_TARGET_SEARCH_PATH.json) inverse patches reconstruct 1.1 byte-for-byte; frozen [W1N JSON](PHASE_1B_3C_A1I_W1N_GOVERNANCE_BOUNDARY_NORMALIZATION.json) reconstructs version 1. W1/W1N/A1E and lock/metadata whole-file hashes remain unchanged. The 87 distributions, Django 5.2.18, 25 apps, 82 migrations, 81 dependency/one swappable edges, 29 local migrations/26 local edges, 16 raw records, 803/118/86 universes and all 23 frozen manifest hashes remain intact. Frozen source hashes are preserved within artifacts; no source/database inspection occurs.

## Validation and proof boundaries

Syntax, deterministic generation/two-build equality, --check, scoped Prettier, docs audit and independent preservation/reference/ID/version-chain assertions are required at closeout. Offline synthetic descriptor tests reject wrong/ambient targets, paths, roles, temporary privileges, cross-scope collapse and missing/duplicate actors; they do not connect to PostgreSQL or inspect secrets.

\`\`\`powershell
node --check scripts\\ue\\define-database-target-contract.mjs
node scripts\\ue\\define-database-target-contract.mjs --self-test --check
pnpm validate:docs
\`\`\`

W2 = PASS; W2_IMPLEMENTATION_COMPLETE = YES **for contract definition only**. W3 = AUTHORIZED_NOT_STARTED; W3_STARTED = NO. W4-W10, A1R/A2/B3C-B remain not started.

DATABASE_RUNTIME_CONFIGURATION_APPLIED = NO; DATABASE_RUNTIME_CONFIGURATION_PROVEN = NO; DATABASE_ROLES_PROVISIONED = NO; EXTENSIONS_RUNTIME_PROVEN = NO; DJANGO_SCHEMA_MATERIALIZED = NO; BOOTSTRAP_IMPLEMENTATION_COMPLETE = NO; FAITHFUL_SCHEMA_REPLAY_PROVEN = NO; PRODUCTION_SCHEMA_PROVEN = NO; RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN = NO; TENANT_ISOLATION_RUNTIME_PROVEN = NO; READY_FOR_RUNTIME_PROOF = 0; PRODUCT_READY = NO.

No database/migration execution, schema/role/extension creation, environment/deployment/configuration mutation, secret access, RLS change, later workstream start or PR creation occurs here.
`
}

async function loadInputs() {
  const inputs = Object.fromEntries(
    ['canonical', 'w1n', 'w1', 'a1e', 'lock', 'lockMetadata'].map((key) => [key, read(files[key])]),
  )
  if (existsSync(absolute(files.report))) {
    const previous = JSON.parse(read(files.report))
    inputs.canonical = await formatted(
      restore(JSON.parse(inputs.canonical), previous.PRIOR_CANONICAL_INVERSE_PATCHES),
    )
    assert.equal(
      sha(inputs.canonical),
      previous.VERSION_1_1_SHA256,
      'Prior version 1.1 reconstruction drift',
    )
    for (const key of ['w1', 'w1n', 'a1e', 'lock', 'lockMetadata']) {
      assert.equal(
        sha(inputs[key]),
        previous.preservation.FROZEN_FILES[files[key]].BEFORE_SHA256,
        `Frozen ${key} drift`,
      )
    }
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
  assert.deepEqual(first, await build(inputs), 'Non-deterministic W2 outputs')
  if (args.includes('--self-test')) {
    const contract = JSON.parse(first[files.contract])
    const work = JSON.parse(inputs.canonical).remediationWorkstreams.find(
      (w) => w.WORKSTREAM_ID === 'W2',
    )
    syntheticTests(contract)
    const wrong = structuredClone(contract)
    wrong.downstreamImplementationPacket[0].ACTOR_IDS.push('unknown-actor')
    assert.throws(() => validateReferences(wrong, work))
    assert.throws(() => exact(['duplicate', 'duplicate'], ['a', 'b'], 'Synthetic'))
    const current = JSON.parse(first[files.canonical])
    const report = JSON.parse(first[files.report])
    assert.equal(
      await formatted(restore(current, report.PRIOR_CANONICAL_INVERSE_PATCHES)),
      inputs.canonical,
    )
    const priorVersionOne = restore(
      JSON.parse(inputs.canonical),
      JSON.parse(inputs.w1n).PRIOR_GOVERNANCE_PATCHES.CONTRACT,
    )
    assert.equal(sha(await formatted(priorVersionOne)), report.VERSION_1_SHA256)
    console.log(
      'PASS: W2 offline target/path/role negatives, downstream references, exact IDs and full 1 → 1.1 → 1.2 chain',
    )
  }
  if (args.includes('--check')) {
    for (const [name, text] of Object.entries(first))
      assert.equal(read(name), text, `Stale W2 output: ${name}`)
    console.log(
      'PASS: W2 deterministic --check; frozen W1/W1N/A1E/lock bytes preserved; no runtime IO',
    )
  } else if (!args.includes('--self-test')) {
    for (const [name, text] of Object.entries(first)) writeFileSync(absolute(name), text)
    console.log(
      'PASS: W2 contract defined, exact one obligation/two decisions closed; version 1.2; W3 authorized not started',
    )
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main()
