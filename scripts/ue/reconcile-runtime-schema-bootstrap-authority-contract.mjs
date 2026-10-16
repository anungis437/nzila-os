import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const script = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(script), '..', '..')
const base = 'docs/union-eyes/reality-remediation/'
const outputName = 'PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT'
const helper = path.join(root, 'scripts', 'ue', 'read-django-bootstrap-contract.py')
const absolute = (file) => path.resolve(root, ...file.split('/'))
const hash = (value) => createHash('sha256').update(value).digest('hex')
const digest = (value) => hash(JSON.stringify(value))
const id = (kind, key) => `UE-1B3CA1D-${kind}-${hash(key).slice(0, 16)}`
const unique = (values) => [...new Set(values)].sort()
const counts = (rows, key) =>
  rows.reduce((result, row) => {
    result[row[key]] = (result[row[key]] ?? 0) + 1
    return result
  }, {})
const names = {
  A1: 'PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE',
  CA: 'PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT',
  B3B: 'PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION',
  B3A: 'PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS',
}
const hashes = {
  A1: '1174c864e09fc68f42dca882bb26b6e82cdf4cd3dc58411bd8136e32e317d28d',
  CA: 'bf6a6e2c1f73f3d56b035b3b1705f298d34d7ff738095eefff8249c6bd6144d0',
  B3B: 'd65dea976c169acb795c71e5c3491d6478d4dbe0859e9b3b17c6be4691c7f84b',
  B3A: '5755b17e89fbb81b3afb1b6fda4e18ba107153cd52680bad21041e466c13a883',
}
const inputs = Object.fromEntries(
  Object.entries(names).map(([key, name]) => {
    const bytes = readFileSync(absolute(`${base}${name}.json`))
    assert.equal(hash(bytes), hashes[key], `FAIL_EVIDENCE_DRIFT: ${key}`)
    return [key, JSON.parse(bytes)]
  }),
)
const { A1: a1, CA: ca, B3B: b, B3A: a } = inputs
assert.deepEqual(a1.summary, {
  ...a1.summary,
  TOTAL_FROZEN_MIGRATIONS: 23,
  TOTAL_PREREQUISITE_IDENTITIES: 945,
  PREREQUISITES_SATISFIED_WITHIN_FROZEN_SEQUENCE: 134,
  POSTGRES_CORE_ONLY_PREREQUISITES: 4,
  PREREQUISITES_REQUIRING_PRE_MIGRATION_BOOTSTRAP: 807,
  DYNAMIC_OR_GRANT_BINDING_IDENTITIES: 118,
})
const inventory = new Map(a1.metadata.SOURCE_INVENTORY.map((record) => [record.FILE, record]))
const rereads = new Map()
function citedSource(file) {
  assert.ok(inventory.has(file), `New discovery prohibited: ${file}`)
  if (rereads.has(file)) return rereads.get(file).text
  const bytes = readFileSync(absolute(file))
  assert.equal(hash(bytes), inventory.get(file).SHA256, `FAIL_EVIDENCE_DRIFT: ${file}`)
  const record = { FILE: file, SHA256: hash(bytes), text: bytes.toString('utf8') }
  rereads.set(file, record)
  return record.text
}
const settingsFile = 'apps/union-eyes/backend/config/settings.py'
const bootstrapFile = 'tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs'
const financialConfig = 'apps/union-eyes/services/financial-service/drizzle.config.ts'
const scopedConfig = 'apps/union-eyes/drizzle.config.ts'
const sourcePayload = [
  { FILE: settingsFile, TEXT: citedSource(settingsFile) },
  ...a1.backendMigrationDependencyRegistry.map((record) => ({
    FILE: record.SOURCE_FILE,
    TEXT: citedSource(record.SOURCE_FILE),
  })),
]
const python = spawnSync('python', [helper], {
  input: JSON.stringify(sourcePayload),
  encoding: 'utf8',
  timeout: 30000,
  maxBuffer: 24 * 1024 * 1024,
})
if (python.error) throw python.error
assert.equal(python.status, 0, `Syntax-only Django reader failed: ${python.stderr}`)
const parsedSources = JSON.parse(python.stdout)
const settings = parsedSources[0]
const pythonMigrations = parsedSources.slice(1)
const bootstrap = citedSource(bootstrapFile)
const finance = citedSource(financialConfig)
const scoped = citedSource(scopedConfig)
assert.match(bootstrap, /applyCiBaselineIfNeeded\(client, scopedEntries.length\)/)
assert.ok(
  bootstrap.indexOf('const migrateSummary = await applyScopedMigrations(client)') <
    bootstrap.indexOf('const platformSummary = await applyPlatformMigrations(client)'),
)
assert.match(finance, /schema:\s*['"]\.\/src\/db\/schema.ts['"]/)
assert.match(finance, /process.env.DATABASE_URL/)
assert.match(scoped, /process.env.DATABASE_URL/)
assert.ok(Array.isArray(settings.INSTALLED_APPS))
assert.deepEqual(Object.keys(settings.DATABASE_IDENTITY_FIELD_BINDINGS).sort(), [
  'ENGINE',
  'HOST',
  'NAME',
  'PORT',
])
assert.equal(settings.CREDENTIAL_EXPRESSIONS_SERIALIZED, false)

const candidateMap = new Map(
  a1.creationSourceCandidates.map((candidate) => [candidate.CANDIDATE_ID, candidate]),
)
const frozenNodeByFile = new Map(a1.frozenMigrationManifest.map((record) => [record.FILE, record]))
const authorityById = new Map(
  a1.bootstrapAuthorityRegistry.map((record) => [record.BOOTSTRAP_ID, record]),
)
const sourceAuthority = (key) => {
  const match = a1.bootstrapAuthorityRegistry.find((record) => record.COMMAND_OR_SCRIPT === key)
  assert.ok(match, `Missing accepted authority ${key}`)
  return match.BOOTSTRAP_ID
}
const djangoAuthority = sourceAuthority('apps/union-eyes/backend/manage.py migrate --noinput')
const bootstrapAuthority = sourceAuthority(bootstrapFile)
const snapshotAuthority = sourceAuthority('tooling/scripts/restore-union-eyes-snapshot.mjs')
const cleanroomAuthority = sourceAuthority(
  'tooling/scripts/run-union-eyes-schema-lineage-cleanroom.mjs',
)

function djangoPlan() {
  const byKey = new Map(
    pythonMigrations.map((record) => {
      const parts = record.FILE.split('/')
      return [`${parts.at(-3)}::${parts.at(-1).replace(/\.py$/, '')}`, record]
    }),
  )
  const models = new Map()
  for (const candidate of a1.creationSourceCandidates.filter(
    (candidate) => candidate.SOURCE_KIND === 'DJANGO_MIGRATION',
  ))
    models.set(
      `${candidate.SOURCE_FILE.split('/').at(-3)}::${candidate.DJANGO_MODEL.toLowerCase()}`,
      candidate.PHYSICAL_OBJECT,
    )
  const dependencyRegister = []
  const plan = []
  const visited = new Set()
  const visiting = new Set()
  function visit(key) {
    if (visited.has(key)) return
    assert.ok(!visiting.has(key), `Accepted Django dependency cycle: ${key}`)
    visiting.add(key)
    const record = byKey.get(key)
    assert.ok(record)
    for (const dependency of record.DEPENDENCIES) {
      const target =
        dependency.KIND === 'LITERAL' ? `${dependency.APP}::${dependency.MIGRATION}` : null
      if (target && byKey.has(target)) visit(target)
    }
    visiting.delete(key)
    visited.add(key)
    plan.push(record)
  }
  for (const key of [...byKey.keys()].sort()) visit(key)
  const ordered = plan.map((record, index) => {
    const parts = record.FILE.split('/')
    const app = parts.at(-3)
    const migration = parts.at(-1).replace(/\.py$/, '')
    const declared = record.DEPENDENCIES.map((dependency, position) => {
      const target = `${dependency.APP}::${dependency.MIGRATION}`
      const result = {
        DJANGO_DEPENDENCY_ID: id('DJANGO-DEPENDENCY', `${record.FILE}:${position}`),
        CONSUMER: `${app}::${migration}`,
        ...dependency,
        RESOLUTION:
          dependency.KIND === 'LITERAL' && byKey.has(target)
            ? 'RESOLVED_LOCAL_MIGRATION_SOURCE'
            : 'SOURCE_CEILING',
        REQUIRED_EVIDENCE:
          dependency.KIND === 'DYNAMIC'
            ? 'Accepted configuration must bind dynamic app/model target, then pin its migration source; no runtime default is assumed.'
            : byKey.has(target)
              ? null
              : 'Referenced framework/external migration source/version was not included in accepted A1 evidence.',
      }
      dependencyRegister.push(result)
      return result
    })
    const physical = []
    const stateOnly = []
    for (const operation of record.OPERATIONS) {
      const model =
        operation.MODEL_NAME ?? (operation.OPERATION === 'CreateModel' ? operation.NAME : null)
      const object =
        typeof model === 'string' ? (models.get(`${app}::${model.toLowerCase()}`) ?? null) : null
      const result = {
        ...operation,
        PHYSICAL_OBJECT: object,
        OBJECT_BINDING: object
          ? 'A1_DECLARED_MODEL_TABLE'
          : 'SOURCE_CEILING_OR_NOT_A_MODEL_OPERATION',
      }
      if (operation.STATE_ONLY) stateOnly.push(result)
      else physical.push(result)
    }
    const raw = physical.filter((operation) =>
      ['RunSQL', 'RunPython', 'SOURCE_CEILING'].includes(operation.OPERATION),
    )
    const foreignKeys = unique(
      physical.flatMap((operation) => operation.FOREIGN_KEY_TARGETS ?? []),
    ).map((target) => {
      const parts = target.toLowerCase().split('.')
      const key =
        parts.length === 2 ? `${parts[0]}::${parts[1]}` : `${app}::${target.toLowerCase()}`
      const table = models.get(key) ?? null
      return {
        MODEL_TARGET: target,
        PHYSICAL_OBJECT: table,
        RESOLUTION: table ? 'A1_DECLARED_MODEL_TABLE' : 'SOURCE_CEILING_MODEL_TARGET_NOT_BOUND',
      }
    })
    return {
      DJANGO_MIGRATION_ID: id('DJANGO-MIGRATION', record.FILE),
      APP: app,
      MIGRATION: migration,
      SOURCE_FILE: record.FILE,
      SOURCE_SHA256: inventory.get(record.FILE).SHA256,
      DECLARED_DEPENDENCIES: declared.filter((dependency) => dependency.KIND === 'LITERAL'),
      DYNAMIC_DEPENDENCIES: declared.filter((dependency) => dependency.KIND === 'DYNAMIC'),
      PHYSICAL_OBJECTS_CREATED: unique(
        physical
          .filter((operation) => operation.OPERATION === 'CreateModel')
          .map((operation) => operation.PHYSICAL_OBJECT)
          .filter(Boolean),
      ),
      PHYSICAL_OBJECTS_ALTERED: unique(
        physical
          .filter(
            (operation) =>
              !['CreateModel', 'RunSQL', 'RunPython', 'SOURCE_CEILING'].includes(
                operation.OPERATION,
              ),
          )
          .map((operation) => operation.PHYSICAL_OBJECT)
          .filter(Boolean),
      ),
      REQUIRED_PRIOR_OBJECTS: unique([
        ...physical
          .filter((operation) => operation.OPERATION !== 'CreateModel')
          .map((operation) => operation.PHYSICAL_OBJECT)
          .filter(Boolean),
        ...foreignKeys.map((target) => target.PHYSICAL_OBJECT).filter(Boolean),
      ]),
      RELATIONAL_MODEL_DEPENDENCIES: foreignKeys,
      PHYSICAL_OPERATIONS: physical,
      STATE_ONLY_OPERATIONS: stateOnly,
      RAW_OR_DYNAMIC_OPERATION_CEILINGS: raw,
      PHYSICAL_OPERATION_BINDING_COMPLETE:
        raw.length || foreignKeys.some((target) => target.PHYSICAL_OBJECT === null)
          ? 'NO'
          : 'DECLARED_MODEL_OPERATIONS_ONLY',
      DATABASE_SCOPE: 'union-eyes',
      INSTALLED_APP_IN_ACCEPTED_SETTINGS: settings.INSTALLED_APPS.includes(app) ? 'YES' : 'NO',
      ORDER_INDEX: null,
      PROPOSED_LOCAL_TOPOLOGICAL_ORDER_INDEX: index,
      PLAN_STATUS: 'SOURCE_SUPPORTED_CANDIDATE_NOT_ACCEPTED_EXECUTION_PLAN',
      RUN_BEFORE: record.RUN_BEFORE,
      REPLACES: record.REPLACES,
      EXTERNAL_INSTALLED_APP_MIGRATION_CLOSURE: 'SOURCE_CEILING_VERSION_AND_GRAPH_NOT_PINNED',
    }
  })
  const localApps = new Set(ordered.map((record) => record.APP))
  const externalApps = settings.INSTALLED_APPS.filter((app) => !localApps.has(app))
  const closureCeilings = [
    ...dependencyRegister
      .filter((dependency) => dependency.RESOLUTION === 'SOURCE_CEILING')
      .map((dependency) => ({
        SOURCE_CEILING_ID: id('DJANGO-CEILING', dependency.DJANGO_DEPENDENCY_ID),
        CLASS: 'DECLARED_DEPENDENCY_SOURCE_NOT_CLOSED',
        DEPENDENCY_ID: dependency.DJANGO_DEPENDENCY_ID,
      })),
    ...externalApps.map((app) => ({
      SOURCE_CEILING_ID: id('DJANGO-CEILING', `external:${app}`),
      CLASS: 'INSTALLED_APP_MIGRATION_SET_NOT_PINNED_OR_NOT_ESTABLISHED_EMPTY',
      APP: app,
      REQUIRED_EVIDENCE:
        'Accepted package/app migration graph or evidence that the app has no migrations; no new search or implicit framework version.',
    })),
    ...ordered
      .filter(
        (record) =>
          record.RAW_OR_DYNAMIC_OPERATION_CEILINGS.length ||
          record.RELATIONAL_MODEL_DEPENDENCIES.some((target) => target.PHYSICAL_OBJECT === null),
      )
      .map((record) => ({
        SOURCE_CEILING_ID: id('DJANGO-CEILING', record.DJANGO_MIGRATION_ID),
        CLASS: 'RAW_OR_GENERATED_OPERATION_BINDING',
        DJANGO_MIGRATION_ID: record.DJANGO_MIGRATION_ID,
        REQUIRED_EVIDENCE:
          'Source-backed physical operation/prior-object binding; parsing an expression does not execute or render Django SQL.',
      })),
  ]
  return {
    PLAN_ACCEPTED: 'NO',
    EXECUTED: 'NO',
    MIGRATIONS: ordered,
    DEPENDENCY_REGISTER: dependencyRegister,
    CONFIGURATION: settings,
    EXTERNAL_OR_NON_MIGRATION_APP_OBLIGATIONS: externalApps,
    SOURCE_CEILINGS: closureCeilings,
    SUMMARY: {
      DJANGO_MIGRATIONS_IN_PLAN: ordered.length,
      DJANGO_LITERAL_DEPENDENCIES: dependencyRegister.filter((record) => record.KIND === 'LITERAL')
        .length,
      DJANGO_DYNAMIC_DEPENDENCIES: dependencyRegister.filter((record) => record.KIND === 'DYNAMIC')
        .length,
      DJANGO_DECLARED_DEPENDENCIES_RESOLVED: dependencyRegister.filter(
        (record) => record.RESOLUTION === 'RESOLVED_LOCAL_MIGRATION_SOURCE',
      ).length,
      DJANGO_DECLARED_DEPENDENCY_SOURCE_CEILINGS: dependencyRegister.filter(
        (record) => record.RESOLUTION === 'SOURCE_CEILING',
      ).length,
      DJANGO_DEPENDENCY_SOURCE_CEILINGS: closureCeilings.length,
      UNACCOUNTED_DJANGO_DEPENDENCIES: 0,
    },
    LIMITATION:
      'Exact already-inventoried local dependency sources are accounted. Proposed topological order is not an accepted full Django migration plan; framework/app graphs, raw SQL/generators and physical database binding remain unclosed.',
  }
}
const plan = djangoPlan()
const binding = {
  SAME_PHYSICAL_DATABASE: 'SOURCE_CEILING',
  DJANGO_CONFIGURATION_SOURCE: settingsFile,
  DJANGO_TARGET_VARIABLES: ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'],
  DJANGO_DEFAULT_IDENTITY: { HOST: 'localhost', PORT: '5432', DATABASE: 'nzila_union_eyes' },
  UE_SCOPED_CONFIGURATION_SOURCE: scopedConfig,
  UE_BOOTSTRAP_SOURCE: bootstrapFile,
  UE_SCOPED_TARGET_VARIABLE: 'DATABASE_URL',
  CONFIGURATION_TARGET_COMPOSITION:
    'No accepted wrapper binds the five Django PG* values to the scoped DATABASE_URL identity.',
  ESTABLISHED_DOCTRINE:
    'Django operational schema precedes UE security/scoped migration consumers.',
  ROLE_AND_CREDENTIAL_BINDING: 'SOURCE_CEILING_NO_CREDENTIALS_READ_OR_SERIALIZED',
  REQUIRED_EVIDENCE:
    'Accepted local-only binding manifest/wrapper that pins endpoint, database, schema/search_path and migration roles consistently; no inference from product or relation names.',
}
const financial = {
  DATABASE_SCOPE: 'financial-service',
  PHYSICAL_SCOPE_MERGED_WITH_UE: 'NO',
  DECLARATION_AUTHORITY_SOURCE: financialConfig,
  SCHEMA_DECLARATION_SOURCE: 'apps/union-eyes/services/financial-service/src/db/schema.ts',
  TARGET_VARIABLE: 'DATABASE_URL',
  MIGRATION_OUTPUT: './drizzle',
  SCHEMA_DECLARATION_EXECUTION_AUTHORITY: 'DRIZZLE_CONFIG_DECLARATION_ONLY',
  FROZEN_FINANCIAL_MIGRATION: a1.frozenMigrationManifest.find(
    (record) => record.DATABASE_SCOPE === 'financial-service',
  ),
  FROZEN_FINANCIAL_MIGRATION_EXECUTABLE_DDL: 'NO',
  CANONICAL_FINANCIAL_SCHEMA_MATERIALIZATION_AUTHORITY: 'SOURCE_CEILING_NOT_ESTABLISHED',
  SOURCE_OBJECT_DENOMINATOR: 131,
  REQUIRED_EVIDENCE:
    'An already-authorized content-digested executable materialization lineage or canonical snapshot for this separate scope. The config selects a schema declaration but its frozen SQL is comment-only; generation/uncommenting would exceed this mission.',
}
const snapshot = {
  PINNED_CANONICAL_SNAPSHOT: 'NO',
  SNAPSHOT_ID: null,
  SNAPSHOT_SOURCE: null,
  SNAPSHOT_SHA256: null,
  SCHEMA_VERSION: null,
  MIGRATION_LEVEL: null,
  DATABASE_SCOPE: 'union-eyes',
  CREATED_FROM_AUTHORITY: null,
  EXPECTED_OBJECT_DIGEST: null,
  EXPECTED_POLICY_DIGEST: null,
  PROVENANCE: null,
  SOURCE_INTERFACE_AUTHORITY: snapshotAuthority,
  MISSING_FIELDS_ARE_BLOCKERS_NOT_DEFAULTS: 'YES',
}
const ordering = new Map()
for (const prerequisite of a1.prerequisiteRegistry) {
  const providers = prerequisite.CANDIDATE_SOURCE_IDS.map((key) => candidateMap.get(key)).filter(
    (candidate) =>
      candidate.SOURCE_FILE.includes('/migrations-platform/') &&
      frozenNodeByFile.has(candidate.SOURCE_FILE),
  )
  const djangoProviders = prerequisite.CANDIDATE_SOURCE_IDS.map((key) =>
    candidateMap.get(key),
  ).filter(
    (candidate) =>
      candidate.SOURCE_KIND === 'DJANGO_MIGRATION' && candidate.CREATES_OBJECT === 'YES',
  )
  for (const consumer of prerequisite.CONSUMERS)
    for (const provider of providers) {
      const consumerNode = frozenNodeByFile.get(consumer.MIGRATION_FILE)
      const providerNode = frozenNodeByFile.get(provider.SOURCE_FILE)
      if (providerNode.FROZEN_POSITION <= consumerNode.FROZEN_POSITION) continue
      const key = `${consumer.MIGRATION_FILE}|${prerequisite.PREREQUISITE_ID}|${provider.SOURCE_FILE}`
      ordering.set(key, {
        ORDERING_CONFLICT_ID: id('ORDERING', key),
        CONSUMER_MIGRATION: consumer.MIGRATION_FILE,
        REQUIRED_PREREQUISITE: prerequisite.PREREQUISITE_ID,
        PHYSICAL_PREREQUISITE_IDENTITY: prerequisite.IDENTITY,
        CURRENT_FROZEN_PROVIDER: provider.SOURCE_FILE,
        CURRENT_PROVIDER_POSITION: providerNode.FROZEN_POSITION,
        CURRENT_CONSUMER_POSITION: consumerNode.FROZEN_POSITION,
        PROVIDER_CANDIDATE_IDS: prerequisite.CANDIDATE_SOURCE_IDS.filter(
          (candidateId) => candidateMap.get(candidateId).SOURCE_FILE === provider.SOURCE_FILE,
        ),
        CANONICAL_PRE_BOOTSTRAP_PROVIDER: null,
        DECLARED_DJANGO_PROVIDER_CANDIDATES: djangoProviders.map(
          (candidate) => candidate.CANDIDATE_ID,
        ),
        RESOLUTION_CLASS: 'SOURCE_CEILING',
        WHY_NOT_ALREADY_CREATED: djangoProviders.length
          ? 'Django declaration provides a candidate, but the full plan, physical target and exact column/type state at this consumer are not established.'
          : 'No accepted canonical pre-bootstrap provider or pinned baseline established. Later frozen provider alone cannot satisfy earlier consumer.',
        FROZEN_ORDER_CHANGED: 'NO',
      })
    }
}
const orderingRegister = [...ordering.values()].sort((x, y) =>
  x.ORDERING_CONFLICT_ID.localeCompare(y.ORDERING_CONFLICT_ID),
)
const opaqueInputs = a1.prerequisiteRegistry.filter((record) => record.KIND === 'SOURCE_BINDING')
assert.equal(opaqueInputs.length, 118)
const opaque = opaqueInputs.map((record) => ({
  DYNAMIC_BINDING_ID: id('DYNAMIC', record.PREREQUISITE_ID),
  A1_PREREQUISITE_ID: record.PREREQUISITE_ID,
  A1_SOURCE_CEILING_ID: record.SOURCE_CEILING_ID,
  DATABASE_SCOPE: record.DATABASE_SCOPE,
  INPUT_IDENTITY: record.IDENTITY,
  BOOTSTRAP_RELEVANT: 'YES',
  CONTRACT_HANDLING: 'SOURCE_CEILING',
  A1_CONSUMERS: record.CONSUMERS,
  REASON: record.CONSUMERS.some(
    (consumer) =>
      consumer.REASON ===
      'COMMENT_ONLY_INTROSPECTION_FILE_DOES_NOT_MATERIALIZE_FROZEN_DATABASE_SCOPE',
  )
    ? 'Separate financial-scope materializer is absent; intact comment-only SQL cannot close this binding.'
    : record.CONSUMERS.some((consumer) => consumer.REASON.includes('ALL_OBJECTS_IN_SCHEMA'))
      ? 'Grant/default-ACL execution sets require the accepted prior schema and role state; neither is pinned.'
      : record.CONSUMERS.some((consumer) => consumer.REASON.includes('INDEX_EXPRESSION'))
        ? 'Index expression/operator/column binding requires accepted bootstrap relation/type state.'
        : 'Conditional helper/dynamic SQL or semantic-closure obligation still depends on missing authority, exact prerequisites or target binding. A policy expansion does not establish complete schema materialization.',
  REQUIRED_EVIDENCE:
    'Governed exact per-scope inputs and binding/conditional execution contract. No SQL rewrite, blanket not-required exemption or runtime-success assumption.',
}))

const prerequisiteDispositions = [
  'SATISFIED_BY_POSTGRES_CORE',
  'SATISFIED_BY_DJANGO_BOOTSTRAP',
  'SATISFIED_BY_PLATFORM_BASELINE',
  'SATISFIED_BY_PRIOR_FROZEN_MIGRATION',
  'SATISFIED_BY_PINNED_SNAPSHOT',
  'FINANCIAL_SCOPE_AUTHORITY',
  'NOT_REQUIRED_AT_EXECUTION',
  'SOURCE_CEILING',
  'AUTHORITY_CONFLICT',
]
const prerequisiteContractMapping = a1.prerequisiteRegistry.map((record) => {
  const core = record.CONSUMERS.every(
    (consumer) => consumer.RESOLUTION === 'POSTGRES_CORE_PREREQUISITE',
  )
  const prior = record.SATISFIED_ONLY_WITHIN_FROZEN_SEQUENCE && !core
  const disposition = core
    ? 'SATISFIED_BY_POSTGRES_CORE'
    : prior
      ? 'SATISFIED_BY_PRIOR_FROZEN_MIGRATION'
      : record.AUTHORITY_CONFLICT_ID
        ? 'AUTHORITY_CONFLICT'
        : 'SOURCE_CEILING'
  return {
    PREREQUISITE_ID: record.PREREQUISITE_ID,
    A1_IDENTITY: record.IDENTITY,
    DATABASE_SCOPE: record.DATABASE_SCOPE,
    DISPOSITION: disposition,
    SOURCE_AUTHORITY_CLASS: record.AUTHORITY_CLASS,
    SOURCE_CANDIDATE_IDS: record.CANDIDATE_SOURCE_IDS,
    FIRST_CONSUMING_MIGRATION: record.FIRST_CONSUMING_MIGRATION,
    A1_SOURCE_CEILING_ID: record.SOURCE_CEILING_ID ?? null,
    BOOTSTRAP_CRITICAL_SOURCE_CEILING: disposition === 'SOURCE_CEILING' ? 'YES' : 'NO',
    ORDERING_RECORD_IDS: orderingRegister
      .filter((row) => row.REQUIRED_PREREQUISITE === record.PREREQUISITE_ID)
      .map((row) => row.ORDERING_CONFLICT_ID),
    OPAQUE_BINDING_ID:
      opaque.find((row) => row.A1_PREREQUISITE_ID === record.PREREQUISITE_ID)?.DYNAMIC_BINDING_ID ??
      null,
    CONTRACT_REASON: core
      ? 'Accepted PostgreSQL core identity; no invented schema source.'
      : prior
        ? 'A1 establishes earlier frozen declaration; prospective authority coverage only, not successful runtime execution.'
        : record.DATABASE_SCOPE === 'financial-service'
          ? financial.REQUIRED_EVIDENCE
          : record.KIND === 'SOURCE_BINDING'
            ? 'Exact opaque/semantic bootstrap binding has no accepted closure; see linked 118-item register.'
            : 'A creation candidate/owner does not establish coherent same-database pre-consumer materialization. Django plan, role/type/function/column state, baseline and ordering remain explicit adoption blockers.',
    RUNTIME_PRESENCE_PROVEN: 'NO',
  }
})
const mappingCounts = {
  ...Object.fromEntries(prerequisiteDispositions.map((key) => [key, 0])),
  ...counts(prerequisiteContractMapping, 'DISPOSITION'),
}
const rejectionReasons = new Set([
  'PHYSICAL_DB_BINDING_UNPROVEN',
  'INCOMPLETE_DJANGO_DEPENDENCY_PLAN',
  'MIGRATION_ORDER_CONFLICT',
  'PREREQUISITE_NOT_MATERIALIZED',
  'SNAPSHOT_NOT_PINNED',
  'SNAPSHOT_PROVENANCE_UNESTABLISHED',
  'COMMENT_ONLY_MIGRATION_NOT_MATERIALIZER',
  'HISTORICAL_LINEAGE_NOT_ACTIVE',
  'SHIMS_OR_SQL_REWRITES_REQUIRED',
  'MISSING_ROLE_TYPE_FUNCTION_PREREQUISITES',
  'DYNAMIC_BINDING_NOT_GOVERNED',
  'OTHER_EXPLICIT',
])
const commonRoles = {
  DJANGO_ROLE:
    'Canonical operational schema authority, including organizations; must materialize before security consumers.',
  DRIZZLE_ROLE:
    'Scoped cache/runtime/security migrations, never generated substitute operational DDL.',
  PLATFORM_MIGRATION_ROLE:
    'Post-freeze PLATFORM_SQL source ownership; frozen position preserved, missing prior baselines must be proven.',
  FINANCIAL_SERVICE_ROLE:
    'Separate scope; declared Drizzle config is not an executable clean-schema lineage.',
}
const candidateSpecifications = [
  {
    key: 'A',
    STRATEGY: 'DJANGO_FIRST_THEN_SCOPED_PLATFORM_MIGRATIONS',
    SOURCE_AUTHORITIES: [djangoAuthority, bootstrapAuthority],
    EXECUTION_SEQUENCE: [
      'Pin extensions and migration-role prerequisites',
      'Bind Django PG* and scoped DATABASE_URL to one accepted isolated UE physical database',
      'Execute accepted complete Django migration plan',
      'Materialize source-proven baseline prerequisites for earlier frozen consumers',
      'Apply exact scoped/platform manifest without reordering',
      'Materialize financial scope using its own accepted executable lineage',
    ],
    SNAPSHOT_ROLE:
      'Not required by Django-first doctrine; cannot silently substitute an unpinned baseline.',
    CONTRACT_GAPS: [
      'PHYSICAL_DB_BINDING_UNPROVEN',
      'INCOMPLETE_DJANGO_DEPENDENCY_PLAN',
      'PREREQUISITE_NOT_MATERIALIZED',
      'MISSING_ROLE_TYPE_FUNCTION_PREREQUISITES',
      'DYNAMIC_BINDING_NOT_GOVERNED',
      'COMMENT_ONLY_MIGRATION_NOT_MATERIALIZER',
    ],
  },
  {
    key: 'B',
    STRATEGY: 'PINNED_CANONICAL_SNAPSHOT_THEN_FORWARD_MIGRATIONS',
    SOURCE_AUTHORITIES: [snapshotAuthority, bootstrapAuthority],
    EXECUTION_SEQUENCE: [
      'Supply provenance/version/content-digested canonical snapshot per scope',
      'Restore to explicitly bound empty databases',
      'Establish exact already-applied levels and prospective forward-only manifests',
      'Apply only source-backed forward migrations; reconcile exact-23 replay requirement separately',
    ],
    SNAPSHOT_ROLE: 'Primary baseline, but no accepted snapshot fields or content available.',
    CONTRACT_GAPS: [
      'SNAPSHOT_NOT_PINNED',
      'SNAPSHOT_PROVENANCE_UNESTABLISHED',
      'PHYSICAL_DB_BINDING_UNPROVEN',
      'COMMENT_ONLY_MIGRATION_NOT_MATERIALIZER',
      'DYNAMIC_BINDING_NOT_GOVERNED',
      'OTHER_EXPLICIT',
    ],
    EXPLICIT_OTHER_GAP:
      'Existing snapshot path stamps scoped hashes rather than executes their DDL. That cannot simultaneously prove exact execution of all 23 frozen files.',
  },
  {
    key: 'C',
    STRATEGY: 'EXISTING_REPOSITORY_BOOTSTRAP_ORCHESTRATOR',
    SOURCE_AUTHORITIES: [bootstrapAuthority, snapshotAuthority],
    EXECUTION_SEQUENCE: [
      'Extensions',
      'Optional snapshot and scoped hash baseline',
      'Conditional QA/CI baseline',
      'Scoped journal',
      'Platform journal',
      'Bootstrap attestation',
    ],
    SNAPSHOT_ROLE:
      'Optional operator-configured input; mandatory in specified non-local governed environments.',
    CONTRACT_GAPS: [
      'PHYSICAL_DB_BINDING_UNPROVEN',
      'INCOMPLETE_DJANGO_DEPENDENCY_PLAN',
      'PREREQUISITE_NOT_MATERIALIZED',
      'DYNAMIC_BINDING_NOT_GOVERNED',
      'SNAPSHOT_NOT_PINNED',
      'COMMENT_ONLY_MIGRATION_NOT_MATERIALIZER',
      'OTHER_EXPLICIT',
    ],
    EXPLICIT_OTHER_GAP:
      'Actual main does not invoke Django migrate; conditional QA baseline and snapshot stamping do not supply accepted full prerequisite coverage. No bootstrap script changed.',
  },
  {
    key: 'D',
    STRATEGY: 'OTHER_ALREADY_EVIDENCED_CANONICAL_PATH',
    SOURCE_AUTHORITIES: [cleanroomAuthority],
    EXECUTION_SEQUENCE: [
      'Existing cleanroom: Django, foundation shims, rewritten/reordered historical creation, platform, scoped',
    ],
    SNAPSHOT_ROLE: 'No accepted faithful snapshot supplied.',
    CONTRACT_GAPS: [
      'SHIMS_OR_SQL_REWRITES_REQUIRED',
      'HISTORICAL_LINEAGE_NOT_ACTIVE',
      'PREREQUISITE_NOT_MATERIALIZED',
      'PHYSICAL_DB_BINDING_UNPROVEN',
      'COMMENT_ONLY_MIGRATION_NOT_MATERIALIZER',
    ],
    EXPLICIT_OTHER_GAP:
      'Tooling-behavior candidate only, disqualified as faithful authority. No separately authorized governance promotion exists.',
  },
]
const bootstrapCandidates = candidateSpecifications.map(({ key, ...record }) => ({
  BOOTSTRAP_CANDIDATE_ID: id('CANDIDATE', key),
  ...record,
  DATABASE_SCOPES: ['union-eyes', 'financial-service'],
  INITIAL_STATE_REQUIRED: 'Zero user schema state in separate isolated disposable databases',
  ...commonRoles,
  '23_FROZEN_MIGRATION_RELATION': {
    INPUT_MANIFEST_DIGEST: digest(a.metadata.MIGRATION_MANIFEST),
    ORDER_CHANGED: 'NO',
    FILES_CHANGED: 'NO',
    EXECUTION: 'NOT_AUTHORIZED',
  },
  '945_PREREQUISITE_COVERAGE': mappingCounts,
  OPAQUE_BINDING_HANDLING:
    '118 exact A1 records retained as bootstrap-critical source ceilings; no generic dismissal.',
  DETERMINISM:
    'Not established: complete content-digested inputs, scope/role bindings, ordering and fail-fast reset contract are adoption prerequisites.',
  CLEAN_DATABASE_SUPPORTED: 'SOURCE_CEILING',
  CONTRACT_ADOPTABLE: 'NO',
  COVERAGE_MAPPING_IDS: prerequisiteContractMapping.map((row) => row.PREREQUISITE_ID),
}))
const failurePolicy = {
  FAIL_FAST_ON_MISSING_PREREQUISITE: 'YES',
  ALLOW_MISSING_OBJECT_TOLERANCE: 'NO',
  ALLOW_TEST_ONLY_SCHEMA_SHIMS: 'NO',
  ALLOW_RUNTIME_SQL_REWRITES: 'NO',
  ALLOW_UNPINNED_SNAPSHOT: 'NO',
  STATUS: 'REQUIRED_ADOPTION_CONSTRAINT_NOT_EVIDENCE_OF_AN_ADOPTED_OR_EXECUTED_CONTRACT',
}
const remainingRequirements = [
  { REQUIREMENT: 'Explicit physical binding', EVIDENCE: binding.REQUIRED_EVIDENCE },
  {
    REQUIREMENT: 'Accepted complete Django migration plan',
    EVIDENCE:
      'Pin installed app/framework migration graphs and resolve raw/generated physical operation dependencies; proposed local topological order alone is insufficient.',
  },
  {
    REQUIREMENT: 'Source-backed earlier-consumer baseline',
    EVIDENCE:
      'Close each ordering register dependency without changing frozen SQL order; Django candidates must include exact required column/type state.',
  },
  {
    REQUIREMENT: 'Roles/extensions/functions/types prerequisites',
    EVIDENCE:
      'Pin role owner/security identity and exact extension/type/function prerequisites to each scope and sequence step. Declared command or helper signature alone is not materialization.',
  },
  { REQUIREMENT: 'Financial-scope materializer', EVIDENCE: financial.REQUIRED_EVIDENCE },
  {
    REQUIREMENT: 'Snapshot identity, if selected',
    EVIDENCE:
      'Supply all snapshot provenance/version/level/object/policy digest fields and reconcile scoped hash baselining versus exact frozen replay.',
  },
  {
    REQUIREMENT: 'Govern all 118 opaque obligations',
    EVIDENCE:
      'Bind dynamic/conditional targets, ACL execution sets and semantic closure to accepted preceding schema/role inputs; no weak exemption.',
  },
]
const result = {
  metadata: {
    PHASE: 'PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT',
    METHOD: 'FROZEN_EVIDENCE_GOVERNANCE_RECONCILIATION_NO_NEW_CENSUS',
    FROZEN_INPUT_SHA256: hashes,
    A1_GRAPH_DIGEST: digest(a1.migrationDependencyGraph),
    A1_PREREQUISITE_REGISTRY_DIGEST: digest(a1.prerequisiteRegistry),
    A1_OPAQUE_INPUT_DIGEST: digest(opaqueInputs),
    ANALYZER_SHA256: hash(readFileSync(script)),
    DJANGO_AST_READER_SHA256: hash(readFileSync(helper)),
    BOUNDED_REREADS: [...rereads.values()].map(({ text, ...record }) => record),
    PYTHON_SOURCE_EXECUTED_OR_IMPORTED: 'NO',
    NEW_DISCOVERY: 'NO',
  },
  frozenMigrationManifest: a1.frozenMigrationManifest,
  bootstrapCandidates,
  djangoMigrationPlan: plan,
  physicalDatabaseBinding: binding,
  scopedPlatformOrderingReconciliation: orderingRegister,
  financialScopeAuthority: financial,
  snapshotAuthority: snapshot,
  opaqueBindingReconciliation: opaque,
  prerequisiteContractMapping,
  contractSelection: {
    OUTCOME: 'CANONICAL_BOOTSTRAP_CONTRACT_SOURCE_CEILING',
    SELECTED_BOOTSTRAP_CANDIDATE_ID: null,
    CANONICAL_BOOTSTRAP_SEQUENCE: [],
    PROSPECTIVE_CANONICAL_CONTRACT_FILES_CREATED: 'NO',
    PRIMARY_DOCTRINE: 'DJANGO_FIRST_THEN_SCOPED_PLATFORM_MIGRATIONS',
    DOCTRINE_COMPLETENESS: 'NOT_ESTABLISHED',
    ORGANIZATIONS_OPERATIONAL_SCHEMA_OWNER: 'DJANGO',
    ORGANIZATIONS_SOURCE: 'apps/union-eyes/backend/auth_core/migrations/0001_initial.py',
    REPOSITORY_GOVERNED_BOOTSTRAP_CONTRACT: 'NOT_ESTABLISHED',
    REMAINING_REQUIREMENTS: remainingRequirements,
    FAILURE_POLICY_REQUIRED_FOR_ADOPTION: failurePolicy,
  },
  catalogQuarantine: {
    ...a1.catalogQuarantine,
    LOCAL_CATALOG_RESOLVED: 9,
    LOCAL_CATALOG_MISMATCH: 603,
    LOCAL_CATALOG_UNRESOLVED: 28,
    USED_AS_B3B_PROOF: 'NO',
    USED_AS_PRODUCTION_PROOF: 'NO',
  },
  carryForward: a1.carryForward,
  summary: {
    BOOTSTRAP_CANDIDATES: bootstrapCandidates.length,
    ADOPTABLE_CANDIDATES: 0,
    DJANGO_DEPENDENCY_CLOSURE: plan.SUMMARY,
    ORDERING_DEPENDENCIES_RECONCILED: orderingRegister.length,
    ORDERING_RESOLUTION_COUNTS: counts(orderingRegister, 'RESOLUTION_CLASS'),
    OPAQUE_BINDINGS_INPUT: 118,
    OPAQUE_BINDINGS_RESOLVED: 0,
    OPAQUE_BINDINGS_EXPLICIT_RUNTIME: 0,
    OPAQUE_BINDINGS_NOT_BOOTSTRAP_RELEVANT: 0,
    OPAQUE_BINDINGS_SOURCE_CEILING: opaque.length,
    OPAQUE_BINDINGS_SUM: opaque.length,
    PREREQUISITES_INPUT: 945,
    PREREQUISITE_DISPOSITION_COUNTS: mappingCounts,
    PREREQUISITES_SUM: prerequisiteContractMapping.length,
    UNACCOUNTED: 0,
    BOOTSTRAP_CRITICAL_SOURCE_CEILINGS: prerequisiteContractMapping.filter(
      (row) => row.BOOTSTRAP_CRITICAL_SOURCE_CEILING === 'YES',
    ).length,
    AUTHORITY_CONFLICTS: a1.authorityConflicts.length,
    CANONICAL_CONTRACT_DECISION: 'CANONICAL_BOOTSTRAP_CONTRACT_SOURCE_CEILING',
  },
  validation: {
    A1_GRAPH_UNCHANGED: 'YES',
    A1_PREREQUISITE_IDENTITIES_PRESERVED: 945,
    FROZEN_MIGRATION_FILES_CHANGED: 'NO',
    OPAQUE_BINDINGS_EXACT_ONCE: 118,
    ORGANIZATIONS_OWNER: 'DJANGO',
    FINANCIAL_COMMENT_ONLY_FILE_USED_AS_MATERIALIZER: 'NO',
    HISTORICAL_OR_SHIM_CLEANROOM_PROMOTED: 'NO',
    MIGRATIONS_CHANGED: 0,
    SCHEMA_CHANGED: 0,
    RLS_POLICIES_CHANGED: 0,
    BOOTSTRAP_SCRIPTS_CHANGED: 0,
    NEW_DATABASE_ACCESS: 0,
    TENANT_ISOLATION_TESTS_EXECUTED: 0,
    BOUNDED_SOURCE_AST_READER_NO_IMPORT_OR_EXECUTION: 'YES',
  },
  phaseStatus: {
    PHASE_1B_3C_A1D_GATE: 'SOURCE_CEILING',
    PHASE_1B_3C_A1D: 'SOURCE_CEILING_ACCEPTED',
    CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT: 'NOT_ESTABLISHED',
    PHASE_1B_3C_A1R: 'NOT_AUTHORIZED',
    PHASE_1B_3C_A1R_STARTED: 'NO',
    PHASE_1B_3C_A2: 'NOT_AUTHORIZED',
    PHASE_1B_3C_A2_STARTED: 'NO',
    PHASE_1B_3C_B: 'NOT_AUTHORIZED',
    PHASE_1B_3C_B_STARTED: 'NO',
    PHASE_1B_3B: 'SOURCE_CEILING_ACCEPTED',
    PHASE_1B_3C_A: 'FAIL',
    PHASE_1B_3C_A1: 'SOURCE_CEILING_ACCEPTED',
    STATIC_RLS_POLICY_MODEL: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    B3C_RUNTIME_PROOF_ITEMS: 3124,
    READY_FOR_RUNTIME_PROOF: 0,
    PRODUCTION_SCHEMA_PROVEN: 'NO',
    TENANT_ISOLATION_RUNTIME_PROVEN: 'NO',
    PRODUCT_READY: 'NO',
  },
}

function validate() {
  const exactIds = (rows, field, expected) => {
    const set = new Set(rows.map((row) => row[field]))
    assert.equal(set.size, rows.length, `Duplicate ${field}`)
    assert.equal(set.size, expected)
    assert.ok(!set.has(undefined))
    return set
  }
  assert.deepEqual(
    exactIds(prerequisiteContractMapping, 'PREREQUISITE_ID', 945),
    new Set(a1.prerequisiteRegistry.map((record) => record.PREREQUISITE_ID)),
  )
  assert.deepEqual(
    exactIds(opaque, 'A1_PREREQUISITE_ID', 118),
    new Set(opaqueInputs.map((record) => record.PREREQUISITE_ID)),
  )
  exactIds(opaque, 'DYNAMIC_BINDING_ID', 118)
  for (const candidate of bootstrapCandidates) {
    for (const gap of candidate.CONTRACT_GAPS) assert.ok(rejectionReasons.has(gap))
    for (const authority of candidate.SOURCE_AUTHORITIES) assert.ok(authorityById.has(authority))
    assert.equal(candidate.COVERAGE_MAPPING_IDS.length, 945)
    assert.equal(candidate.CONTRACT_ADOPTABLE, 'NO')
  }
  assert.equal(mappingCounts.SATISFIED_BY_PRIOR_FROZEN_MIGRATION, 134)
  assert.equal(mappingCounts.SATISFIED_BY_POSTGRES_CORE, 4)
  assert.equal(mappingCounts.SOURCE_CEILING, 807)
  assert.equal(
    Object.values(mappingCounts).reduce((sum, count) => sum + count, 0),
    945,
  )
  assert.deepEqual(result.frozenMigrationManifest, a1.frozenMigrationManifest)
  assert.equal(digest(a1.migrationDependencyGraph), result.metadata.A1_GRAPH_DIGEST)
  assert.equal(
    plan.SUMMARY.DJANGO_LITERAL_DEPENDENCIES + plan.SUMMARY.DJANGO_DYNAMIC_DEPENDENCIES,
    plan.DEPENDENCY_REGISTER.length,
  )
  assert.equal(
    plan.SUMMARY.DJANGO_DECLARED_DEPENDENCIES_RESOLVED +
      plan.SUMMARY.DJANGO_DECLARED_DEPENDENCY_SOURCE_CEILINGS,
    plan.DEPENDENCY_REGISTER.length,
  )
  for (const row of orderingRegister) {
    assert.ok(row.CURRENT_CONSUMER_POSITION < row.CURRENT_PROVIDER_POSITION)
    assert.equal(row.RESOLUTION_CLASS, 'SOURCE_CEILING')
  }
  for (const entry of a.metadata.MIGRATION_MANIFEST) {
    const prior = inventory.get(entry.FILE)
    assert.equal(prior.SHA256, entry.SHA256)
    assert.equal(
      hash(readFileSync(absolute(entry.FILE))),
      entry.SHA256,
      `FAIL_EVIDENCE_DRIFT: ${entry.FILE}`,
    )
  }
  for (const [key, name] of Object.entries(names))
    assert.equal(hash(readFileSync(absolute(`${base}${name}.json`))), hashes[key])
  for (const record of rereads.values())
    assert.equal(
      hash(readFileSync(absolute(record.FILE))),
      record.SHA256,
      `FAIL_EVIDENCE_DRIFT: ${record.FILE}`,
    )
  assert.equal(ca.summary.CATALOG_PARENT_RESOLUTION.RESOLVED_BY_LOCAL_CATALOG, 9)
  assert.equal(result.catalogQuarantine.USED_AS_B3B_PROOF, 'NO')
  assert.equal(result.contractSelection.CANONICAL_BOOTSTRAP_SEQUENCE.length, 0)
}
validate()
function markdown() {
  return `# Phase 1B.3C-A1D — runtime schema bootstrap authority contract decision

## Decision

\`CANONICAL_BOOTSTRAP_CONTRACT_SOURCE_CEILING\`.
\`PHASE_1B_3C_A1D_GATE = SOURCE_CEILING\`.
No candidate meets the adoption standard; **no canonical contract file is published**.
This is governance reconciliation of frozen A1 evidence, not a new migration census.

## Candidate bootstrap contracts

${bootstrapCandidates
  .map(
    (candidate) => `### ${candidate.STRATEGY}

- Candidate ID: \`${candidate.BOOTSTRAP_CANDIDATE_ID}\`.
- Initial state: ${candidate.INITIAL_STATE_REQUIRED}.
- Sequence is **evaluated only, not adopted or executable**:
${candidate.EXECUTION_SEQUENCE.map((step, index) => `  ${index + 1}. ${step}`).join('\n')}
- Gaps: ${candidate.CONTRACT_GAPS.map((gap) => `\`${gap}\``).join(', ')}.
${candidate.EXPLICIT_OTHER_GAP ? `- Explicit gap: ${candidate.EXPLICIT_OTHER_GAP}.\n` : ''}
`,
  )
  .join('\n')}

All candidates retain the same exact **945** prerequisite coverage map and **118** opaque
obligations. Shared ownership does not establish one physical database. No fifth architecture
or modified frozen manifest was invented to make a candidate pass.

## Django dependency closure

The syntax-only reader parses only the **${plan.SUMMARY.DJANGO_MIGRATIONS_IN_PLAN}** already-inventoried local
migration files. It does not import Django, execute source, render migration SQL or connect to a DB.
Every declared dependency has an exact register entry. State-only operations are kept separate
from physical operations, including the organizations state reconciliation.

| Measure | Count |
|---|---:|
| Local migrations in candidate plan | ${plan.SUMMARY.DJANGO_MIGRATIONS_IN_PLAN} |
| Literal declared dependencies | ${plan.SUMMARY.DJANGO_LITERAL_DEPENDENCIES} |
| Dynamic declared dependencies | ${plan.SUMMARY.DJANGO_DYNAMIC_DEPENDENCIES} |
| Resolved local declared dependencies | ${plan.SUMMARY.DJANGO_DECLARED_DEPENDENCIES_RESOLVED} |
| Unresolved declared dependency sources | ${plan.SUMMARY.DJANGO_DECLARED_DEPENDENCY_SOURCE_CEILINGS} |
| Total external-app/raw-operation closure ceilings | ${plan.SUMMARY.DJANGO_DEPENDENCY_SOURCE_CEILINGS} |
| Unaccounted declared dependencies | 0 |

Exact local topological order is **proposed**, with accepted \`ORDER_INDEX = null\`; no accepted
complete execution plan exists. Configured framework/third-party/non-migration apps need pinned
migration graphs or proof of an empty migration set. Raw SQL/generator physical dependencies
remain explicit rather than being mislabeled as fully resolved model operations.
See [JSON plan and ledgers](./PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT.json).

## Physical database binding

\`SAME_PHYSICAL_DATABASE = SOURCE_CEILING\`.
Django selects PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD; scoped/bootstrap tooling selects
DATABASE_URL. Accepted configuration does not bind their exact identity, schema/search path
and roles together. No credential values were read or serialized.

**Django remains the operational owner of organizations.** Local Django-first doctrine is
supported, but this does not prove all prerequisites or composition with security SQL.

## Scoped/platform ordering

**${orderingRegister.length}** unique consumer/prerequisite/later-platform-provider records
are reconciled as **SOURCE_CEILING**. Declared Django provider candidates are retained where
present, but not labeled \`ALREADY_CREATED_BY_DJANGO\` without complete plan/physical/column binding.
The exact frozen manifest order is unchanged.

## Financial-scope authority

Financial scope remains separate. Its accepted Drizzle configuration selects
\`src/db/schema.ts\` and the \`drizzle\` output directory. This identifies declaration tooling,
not a canonical executable from-zero materializer.
The frozen SQL is **COMMENT_ONLY_INTROSPECTION_SQL**; execution success is not schema
materialization of its **131** source objects. No generation/uncommenting or scope merging occurred.

## Snapshot and failure contract

\`PINNED_CANONICAL_SNAPSHOT = NO\`. Snapshot identity/content hash, version, migration level,
source authority/provenance and expected object/policy digests are absent—not silently defaulted.
The existing snapshot path baselines scoped hashes, so exact execution of the 23-file set
requires a separate accepted contract reconciliation.

Any adopted faithful contract must fail fast: no missing-object tolerance, test-only shims,
runtime SQL rewrites or unpinned snapshots. Those are required adoption constraints, not
evidence that this mission has adopted a contract. Tolerant cleanroom/historical paths are
not promoted.

## 118 opaque-binding reconciliation

| Disposition | Count |
|---|---:|
| Resolved by accepted authority | 0 |
| Explicit runtime binding | 0 |
| Not bootstrap relevant | 0 |
| Source ceiling | 118 |
| **Total** | **118** |

Every exact A1 ID and consumer is preserved. No blanket runtime-only exemption is invented.

## 945 prerequisite contract mapping

| Disposition | Count |
|---|---:|
${Object.entries(mappingCounts)
  .map(([key, count]) => `| ${key} | ${count} |`)
  .join('\n')}
| **Total** | **945** |

**Unaccounted: 0. Bootstrap-critical source ceilings: 807. Authority conflicts: 0.**
Prior declaration coverage remains prospective source evidence, not runtime success.

## Exact remaining evidence requirements

${remainingRequirements.map((row) => `- **${row.REQUIREMENT}**: ${row.EVIDENCE}`).join('\n')}

## Quarantine, preservation and gate

Failed C-A catalog authority remains \`PREFLIGHT_PARTIAL_SCHEMA_OBSERVATION_ONLY\`:
**9 / 603 / 28**, unchanged, never B3B or production proof.
All four frozen predecessor artifacts, A1 graph/945 IDs, 23 migration hashes, 118 opaque IDs,
612 objects, 1,490 policies and 3,124 runtime items remain unchanged.

\`\`\`text
PHASE_1B_3C_A1D_GATE = SOURCE_CEILING
PHASE_1B_3C_A1D = SOURCE_CEILING_ACCEPTED
CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT = NOT_ESTABLISHED
PHASE_1B_3C_A1R = NOT_AUTHORIZED
PHASE_1B_3C_A1R_STARTED = NO
PHASE_1B_3C_A2 = NOT_AUTHORIZED
PHASE_1B_3C_B = NOT_AUTHORIZED
READY_FOR_RUNTIME_PROOF = 0
PRODUCTION_SCHEMA_PROVEN = NO
TENANT_ISOLATION_RUNTIME_PROVEN = NO
PRODUCT_READY = NO
\`\`\`

## Validation

Prerequisite/opaque exact-once ledgers, dependency accounting, graph preservation and candidate
rejection enum assertions are built in. No database access, bootstrap/migration/schema/policy
change, snapshot restore, tenant test or later phase execution is part of this reconciler.
Prerequisites are installed Node/pnpm repository dependencies and Python 3 standard-library AST.
No Django dependency installation is needed.

\`\`\`powershell
python scripts\\ue\\read-django-bootstrap-contract.py --self-test
node --check scripts\\ue\\reconcile-runtime-schema-bootstrap-authority-contract.mjs
node scripts\\ue\\reconcile-runtime-schema-bootstrap-authority-contract.mjs --self-test
node scripts\\ue\\reconcile-runtime-schema-bootstrap-authority-contract.mjs
node scripts\\ue\\reconcile-runtime-schema-bootstrap-authority-contract.mjs --check
pnpm exec prettier --check scripts\\ue\\reconcile-runtime-schema-bootstrap-authority-contract.mjs docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT.md
pnpm validate:docs
\`\`\`
`
}
const args = process.argv.slice(2)
assert.ok(
  args.length <= 1 && args.every((arg) => ['--self-test', '--check'].includes(arg)),
  'Only static generation, --check or --self-test is allowed; no database/runtime execution mode.',
)
if (args.includes('--self-test')) {
  const readerTest = spawnSync('python', [helper, '--self-test'], {
    encoding: 'utf8',
    timeout: 30000,
  })
  if (readerTest.error) throw readerTest.error
  assert.equal(readerTest.status, 0, readerTest.stderr)
  assert.equal(binding.SAME_PHYSICAL_DATABASE, 'SOURCE_CEILING')
  assert.equal(financial.FROZEN_FINANCIAL_MIGRATION_EXECUTABLE_DDL, 'NO')
  assert.equal(result.phaseStatus.PHASE_1B_3C_A1R_STARTED, 'NO')
  assert.equal(plan.PLAN_ACCEPTED, 'NO')
  console.log(readerTest.stdout.trim())
  console.log(
    'PASS: four frozen inputs, 945/118 exact-once ledgers, dependency accounting, source-only contract rejection and authorization boundaries.',
  )
} else {
  const config = await resolveConfig(script)
  for (const [file, content] of [
    [
      `${base}${outputName}.json`,
      await format(JSON.stringify(result), { ...config, parser: 'json' }),
    ],
    [`${base}${outputName}.md`, await format(markdown(), { ...config, parser: 'markdown' })],
  ]) {
    if (args.includes('--check'))
      assert.equal(readFileSync(absolute(file), 'utf8'), content, `Stale ${file}`)
    else writeFileSync(absolute(file), content)
  }
  validate()
  console.log(
    JSON.stringify({ GATE: result.phaseStatus.PHASE_1B_3C_A1D_GATE, ...result.summary }, null, 2),
  )
}
