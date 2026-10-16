import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { parseDocument } from 'yaml'
import {
  parseOperationalSource,
  selfTest as parserSelfTest,
} from './read-operational-bootstrap-sources.mjs'

const script = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(script), '..', '..')
const base = 'docs/union-eyes/reality-remediation/'
const output = 'PHASE_1B_3C_A1E_OPERATIONAL_BOOTSTRAP_BINDING_CLOSURE'
const absolute = (file) => path.resolve(root, ...file.split('/'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const digest = (value) => hash(JSON.stringify(value))
const id = (kind, key) => `UE-1B3CA1E-${kind}-${hash(key).slice(0, 16)}`
const unique = (values) => [...new Set(values)].sort()
const count = (rows, key, values) =>
  Object.fromEntries(
    values.map((value) => [value, rows.filter((row) => row[key] === value).length]),
  )
const names = {
  A1: 'PHASE_1B_3C_A1_CANONICAL_SCHEMA_BOOTSTRAP_LINEAGE',
  A1D: 'PHASE_1B_3C_A1D_RUNTIME_SCHEMA_BOOTSTRAP_AUTHORITY_CONTRACT',
  CA: 'PHASE_1B_3C_A_RUNTIME_PROOF_PREFLIGHT',
  B3B: 'PHASE_1B_3B_STATIC_RLS_POLICY_CORRECTNESS_RECONCILIATION',
  B3A: 'PHASE_1B_3A_RLS_TENANT_ISOLATION_SURFACE_CENSUS',
}
const hashes = {
  A1: '1174c864e09fc68f42dca882bb26b6e82cdf4cd3dc58411bd8136e32e317d28d',
  A1D: '84a357fa94bb5a951016c7b58ad975bfe3e92c43bd0bf81c2ed8bc2a44052dfe',
  CA: 'bf6a6e2c1f73f3d56b035b3b1705f298d34d7ff738095eefff8249c6bd6144d0',
  B3B: 'd65dea976c169acb795c71e5c3491d6478d4dbe0859e9b3b17c6be4691c7f84b',
  B3A: '5755b17e89fbb81b3afb1b6fda4e18ba107153cd52680bad21041e466c13a883',
}
function readPredecessors() {
  return Object.fromEntries(
    Object.entries(names).map(([key, name]) => {
      const bytes = readFileSync(absolute(`${base}${name}.json`))
      assert.equal(hash(bytes), hashes[key], `FAIL_EVIDENCE_DRIFT: ${key}`)
      return [key, JSON.parse(bytes)]
    }),
  )
}
const { A1: a1, A1D: a1d } = readPredecessors()
const prerequisiteById = new Map(a1.prerequisiteRegistry.map((row) => [row.PREREQUISITE_ID, row]))
const priorCeilings = a1d.prerequisiteContractMapping.filter(
  (row) => row.DISPOSITION === 'SOURCE_CEILING',
)
assert.equal(prerequisiteById.size, 945, 'FAIL_EVIDENCE_DRIFT: prerequisites')
assert.equal(priorCeilings.length, 807, 'FAIL_EVIDENCE_DRIFT: ceilings')
assert.equal(a1d.opaqueBindingReconciliation.length, 118, 'FAIL_EVIDENCE_DRIFT: opaque')
assert.equal(a1d.scopedPlatformOrderingReconciliation.length, 86, 'FAIL_EVIDENCE_DRIFT: ordering')
assert.equal(a1d.djangoMigrationPlan.MIGRATIONS.length, 29, 'FAIL_EVIDENCE_DRIFT: Django')
assert.equal(a1d.djangoMigrationPlan.DEPENDENCY_REGISTER.length, 26, 'FAIL_EVIDENCE_DRIFT: edges')
assert.equal(a1.frozenMigrationManifest.length, 23, 'FAIL_EVIDENCE_DRIFT: manifest')
for (const row of a1.frozenMigrationManifest)
  assert.equal(
    hash(readFileSync(absolute(row.FILE))),
    row.SHA256,
    `FAIL_EVIDENCE_DRIFT: ${row.FILE}`,
  )

const backend = 'apps/union-eyes/backend'
const finance = 'apps/union-eyes/services/financial-service'
const workflowFile = '.github/workflows/deploy-union-eyes.yml'
const freshFile = 'apps/union-eyes/scripts/schema-authority/fresh-build.ts'
const provisionFile = 'apps/union-eyes/scripts/provision-runtime-db-roles.ts'
const bootstrapFile = 'tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs'
const scopedFile = 'tooling/scripts/lib/union-eyes-scoped-migrations.mjs'
const platformFile = 'tooling/scripts/lib/union-eyes-platform-migrations.mjs'
const icraFile = 'tooling/scripts/apply-icra-capability-rollout.mjs'
const sources = new Map()
function source(file, reason) {
  assert.ok(
    !/(^|\/)\.env(?:$|\.)/.test(file) || /\.env\.(example|template)$/.test(file),
    'Actual environment files prohibited',
  )
  assert.ok(
    !/node_modules|live-inventory|capture-inventory/.test(file),
    'Unauthorized evidence source',
  )
  if (!sources.has(file)) {
    const bytes = readFileSync(absolute(file))
    sources.set(file, {
      FILE: file,
      SHA256: hash(bytes),
      AUTHORIZED_SCOPE_REASON: reason,
      text: bytes.toString('utf8'),
    })
  }
  return sources.get(file).text
}
const entrypoints = [
  'package.json',
  'turbo.json',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.automation.yml',
  'apps/union-eyes/package.json',
  'apps/union-eyes/drizzle.config.ts',
  `${backend}/requirements.txt`,
  `${backend}/Dockerfile`,
  `${backend}/docker-compose.yml`,
  `${backend}/manage.py`,
  `${backend}/config/settings.py`,
  `${backend}/config/settings/base.py`,
  `${backend}/config/wsgi.py`,
  `${backend}/config/asgi.py`,
  `${backend}/config/celery.py`,
  `${backend}/.env.example`,
  `${backend}/.env.template`,
  `${finance}/package.json`,
  `${finance}/.env.example`,
  `${finance}/drizzle.config.ts`,
  `${finance}/src/index.ts`,
  `${finance}/src/db/index.ts`,
  `${finance}/run-migrations.ts`,
  `${finance}/add-missing-tables.ts`,
  `${finance}/add-missing-tables.sql`,
  `${finance}/add-gate13-job-cancellation-tables.ts`,
  `${finance}/add-gate13-job-cancellation-tables.sql`,
  `${finance}/migrate-strike-funds.ts`,
  `${finance}/add-is-active-column.sql`,
  `${finance}/drizzle/meta/_journal.json`,
  bootstrapFile,
  scopedFile,
  platformFile,
  icraFile,
  provisionFile,
  freshFile,
  'apps/union-eyes/scripts/align-org-schema.ts',
  'apps/union-eyes/scripts/apply-rls-foundation-migration.ts',
  'apps/union-eyes/scripts/apply-authority-enforcement-migration.ts',
  'apps/union-eyes/scripts/apply-round58-grant-order-fix.ts',
  'apps/union-eyes/scripts/apply-round59-rls-geometry-gap-closure.ts',
  'apps/union-eyes/scripts/apply-round59-congress-memberships-grant-fix.ts',
  'apps/union-eyes/scripts/apply-congress-memberships-multi-party-rls-fix.ts',
  'apps/union-eyes/scripts/p4-authority-state.ts',
  'tooling/scripts/restore-union-eyes-snapshot.mjs',
  'tooling/scripts/run-union-eyes-drizzle-migrate.mjs',
  'tooling/scripts/apply-union-eyes-scoped-migrations-existing-env.mjs',
  'tooling/sql/union-eyes-qa-baseline.sql',
  'packages/db/package.json',
  'packages/db/drizzle.config.ts',
  'infrastructure/bicep/main.bicep',
  'infrastructure/bicep/modules/postgres.bicep',
  'infrastructure/bicep/modules/container-apps.bicep',
  'infrastructure/bicep/parameters/staging.bicepparam',
  'infrastructure/bicep/parameters/prod.bicepparam',
  'infrastructure/bicep/parameters/prod-global.bicepparam',
  'infrastructure/landing-zone/runtime.bicep',
  'infrastructure/landing-zone/foundation.bicep',
  'infrastructure/landing-zone/landing-zone.bicep',
  'infrastructure/gitops/README.md',
  'infrastructure/gitops/environments/ue-demo-cupe4373.yml',
  'infrastructure/gitops/environments/ue-pilot-cupe.yml',
  'ops/runbooks/ue-pilot.md',
  'ops/runbooks/ue-pilot-cupe.md',
  'docs/nzila-residual-closure/r1-pilot-django-sidecar-binding-closure.md',
  'docs/nzila-residual-closure/r1-pilot-django-sidecar-binding-log.md',
  'docs/categories/platform-and-operations/architecture/orm-governance/orm-authority-governance.md',
  'docs/categories/platform-and-operations/architecture/orm-governance/environment-bootstrap-strategy.md',
  'docs/categories/platform-and-operations/architecture/orm-governance/fresh-database-bootstrap-reference-implementation.md',
  'docs/categories/platform-and-operations/architecture/orm-governance/migration-execution-governance.md',
]
for (const file of entrypoints)
  source(
    file,
    'Explicit operational/configuration entrypoint or directly referenced bootstrap dependency',
  )
for (const name of readdirSync(absolute('.github/workflows'))
  .filter((name) => /\.ya?ml$/.test(name))
  .sort())
  source(
    `.github/workflows/${name}`,
    'CI/CD operational scope; relevance determined from syntax, no application traversal',
  )
for (const migration of a1d.djangoMigrationPlan.MIGRATIONS) {
  const app = migration.SOURCE_FILE.split('/').at(-3)
  for (const suffix of ['apps.py', '__init__.py', 'migrations/__init__.py']) {
    const file = `${backend}/${app}/${suffix}`
    if (existsSync(absolute(file))) source(file, 'Configured local Django app/module binding')
  }
}
const observations = [...sources.values()].map((row) => ({
  ...parseOperationalSource(row.FILE, row.text),
  SHA256: row.SHA256,
}))
const observationByFile = new Map(observations.map((row) => [row.FILE, row]))
function cite(file, marker) {
  const text = source(file, 'Direct operational binding evidence')
  const index = text.indexOf(marker)
  assert.ok(index >= 0, `Source marker absent: ${file}; no authority fallback`)
  return {
    FILE: file,
    LINE: text.slice(0, index).split('\n').length,
    SHA256: sources.get(file).SHA256,
  }
}
const pythonFiles = [...sources.keys()].filter(
  (file) => /\.py$/.test(file) && !file.includes('/migrations/'),
)
const python = spawnSync('python', [absolute('scripts/ue/read-operational-django-config.py')], {
  input: JSON.stringify(pythonFiles.map((FILE) => ({ FILE, TEXT: sources.get(FILE).text }))),
  encoding: 'utf8',
  timeout: 30000,
  maxBuffer: 8 * 1024 * 1024,
})
if (python.error) throw python.error
assert.equal(python.status, 0, 'Syntax-only Django configuration parser failed')
const configurations = JSON.parse(python.stdout)
const settings = configurations.find((row) => row.FILE === `${backend}/config/settings.py`)
const manage = configurations.find((row) => row.FILE === `${backend}/manage.py`)
assert.equal(settings.INSTALLED_APPS_LITERAL, true)
assert.deepEqual(settings.INSTALLED_APPS, a1d.djangoMigrationPlan.CONFIGURATION.INSTALLED_APPS)
assert.deepEqual(manage.SETTINGS_MODULE_DEFAULTS, ['config.settings'])
assert.deepEqual(settings.DYNAMIC_CONFIG_ASSIGNMENTS, [])
const settingsSelection = {
  DEFAULT: 'config.settings',
  MODULE_SOURCE: `${backend}/config/settings.py`,
  NESTED_BASE_SOURCE: `${backend}/config/settings/base.py`,
  NESTED_SETTINGS_PACKAGE_INIT_PRESENT: existsSync(
    absolute(`${backend}/config/settings/__init__.py`),
  ),
  NESTED_BASE_SELECTED_BY_DEFAULT: 'NO',
  OVERRIDE_VARIABLE: 'DJANGO_SETTINGS_MODULE',
  MIGRATION_MODULES: settings.MIGRATION_MODULES ?? null,
  AUTH_USER_MODEL: settings.AUTH_USER_MODEL ?? null,
  DEFAULT_OR_EXTERNAL_MODEL_RUNTIME_NOT_INVENTED: 'YES',
  CONFIGURATIONS: configurations,
}
assert.equal(settingsSelection.NESTED_SETTINGS_PACKAGE_INIT_PRESENT, false)

const workflow = parseDocument(source(workflowFile)).toJS()
const djangoJob = workflow.jobs['apply-django-migrations']
const scopedJob = workflow.jobs['apply-icra-capability-migration']
const runText = (job) => job.steps.map((step) => step.run ?? '').join('\n')
const djangoRun = runText(djangoJob)
const scopedRun = runText(scopedJob)
assert.equal(djangoJob.environment, scopedJob.environment)
assert.ok(djangoJob.if !== false && scopedJob.if !== false)
assert.ok(!/^\$\{\{\s*false\s*\}\}$/.test(djangoJob.if ?? ''))
assert.ok(!/^\$\{\{\s*false\s*\}\}$/.test(scopedJob.if ?? ''))
for (const text of [djangoRun, scopedRun]) {
  assert.match(text, /KEY_VAULT_NAME="\$\{\{ needs\.plan\.outputs\.key_vault_name \}\}"/)
  assert.match(text, /SECRET_NAME="union-eyes-migration-admin-database-url"/)
  assert.match(
    text,
    /az keyvault secret show --vault-name "\$KEY_VAULT_NAME" --name "\$SECRET_NAME" --query value/,
  )
}
assert.match(djangoRun, /ADMIN_PGHOST="\$\{UE_ADMIN_HOSTPORT%%:\*\}"/)
assert.match(djangoRun, /ADMIN_PGDATABASE="\$\{UE_ADMIN_DBANDQUERY%%\\\?\*\}"/)
assert.match(djangoRun, /-e PGDATABASE="\$ADMIN_PGDATABASE"/)
assert.match(djangoRun, /python manage\.py migrate --noinput/)
assert.match(scopedRun, /export RLS_MIGRATION_ADMIN_DATABASE_URL="\$ADMIN_URL"/)
assert.match(source(icraFile), /process\.env\.RLS_MIGRATION_ADMIN_DATABASE_URL/)
assert.match(source(icraFile), /new pg\.Client\(\{ connectionString: adminUrl \}\)/)
assert.match(source(freshFile), /PGDATABASE: dbName/)
assert.match(source(freshFile), /new pg\.Client\(pgConfig\(conn, dbName\)\)/)
assert.match(source(freshFile), /runDjangoMigrate\(conn, dbName, false\)/)
assert.match(source(freshFile), /applyExtensionsAndScoped\(conn, dbName\)/)
const sharedKey = 'deploy-union-eyes.plan.key_vault_name::union-eyes-migration-admin-database-url'
const bindingRecords = [
  {
    BINDING_ID: id('BINDING', 'workflow-django'),
    PROCESS_OR_SERVICE: 'apply-django-migrations',
    CONFIG_SOURCE: [
      cite(workflowFile, '  apply-django-migrations:'),
      cite(`${backend}/manage.py`, 'DJANGO_SETTINGS_MODULE'),
    ],
    DATABASE_URL_VARIABLE: 'MIGRATION_ADMIN_URL',
    HOST_VARIABLE: 'PGHOST <- ADMIN_PGHOST',
    PORT_VARIABLE: 'PGPORT <- ADMIN_PGPORT',
    DATABASE_NAME_VARIABLE: 'PGDATABASE <- ADMIN_PGDATABASE',
    SCHEMA_SEARCH_PATH: 'SOURCE_CEILING: server/default role search_path not pinned',
    MIGRATION_COMMAND:
      'python manage.py migrate --noinput [demo: --fake-initial]; python manage.py migrate --check',
    DATABASE_SCOPE: 'union-eyes',
    SHARED_BINDING_KEY: sharedKey,
  },
  {
    BINDING_ID: id('BINDING', 'workflow-scoped'),
    PROCESS_OR_SERVICE: 'apply-icra-capability-migration',
    CONFIG_SOURCE: [
      cite(workflowFile, '  apply-icra-capability-migration:'),
      cite(icraFile, 'process.env.RLS_MIGRATION_ADMIN_DATABASE_URL'),
    ],
    DATABASE_URL_VARIABLE: 'RLS_MIGRATION_ADMIN_DATABASE_URL <- ADMIN_URL',
    HOST_VARIABLE: 'URL host component',
    PORT_VARIABLE: 'URL port component',
    DATABASE_NAME_VARIABLE: 'URL database component',
    SCHEMA_SEARCH_PATH: 'SOURCE_CEILING: URL/session search_path not pinned',
    MIGRATION_COMMAND: 'pnpm --filter @nzila/union-eyes run icra:capability-rollout:check / :apply',
    DATABASE_SCOPE: 'union-eyes',
    SHARED_BINDING_KEY: sharedKey,
    FROZEN_MANIFEST_COVERAGE:
      'TARGETED_0005_ONLY; preceding journal entries required, not complete 23-file replay',
  },
  ...['django', 'scoped'].map((process) => ({
    BINDING_ID: id('BINDING', `fresh-${process}`),
    PROCESS_OR_SERVICE: `fresh-build:${process}`,
    CONFIG_SOURCE: [
      cite(
        freshFile,
        process === 'django' ? 'PGDATABASE: dbName' : 'new pg.Client(pgConfig(conn, dbName))',
      ),
    ],
    DATABASE_URL_VARIABLE: null,
    HOST_VARIABLE: 'conn.host <- PGHOST',
    PORT_VARIABLE: 'conn.port <- PGPORT',
    DATABASE_NAME_VARIABLE: 'dbName <- UE_SCHEMA_CONTRACT_DB_NAME or guarded generated name',
    SCHEMA_SEARCH_PATH: 'SOURCE_CEILING: role/default search_path not pinned',
    MIGRATION_COMMAND:
      process === 'django' ? 'python manage.py migrate --noinput' : 'shared.applyScopedMigrations',
    DATABASE_SCOPE: 'union-eyes-disposable',
    SHARED_BINDING_KEY: 'fresh-build::conn+dbName',
    FROZEN_MANIFEST_COVERAGE: 'No financial or platform migration execution in this harness',
  })),
  {
    BINDING_ID: id('BINDING', 'bootstrap'),
    PROCESS_OR_SERVICE: 'db:bootstrap',
    CONFIG_SOURCE: [cite(bootstrapFile, 'const databaseUrl = process.env.DATABASE_URL')],
    DATABASE_URL_VARIABLE: 'DATABASE_URL',
    HOST_VARIABLE: 'URL host component',
    PORT_VARIABLE: 'URL port component',
    DATABASE_NAME_VARIABLE: 'URL database component',
    SCHEMA_SEARCH_PATH: 'SOURCE_CEILING: ambient role/session',
    MIGRATION_COMMAND: 'node tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs',
    DATABASE_SCOPE: 'union-eyes',
    SHARED_BINDING_KEY: 'bootstrap::single-client',
    FULL_DJANGO_TARGET_COMPOSITION: 'NO: orchestrator does not execute Django',
  },
  {
    BINDING_ID: id('BINDING', 'financial'),
    PROCESS_OR_SERVICE: 'financial-service',
    CONFIG_SOURCE: [cite(`${finance}/src/db/index.ts`, 'process.env.DATABASE_URL')],
    DATABASE_URL_VARIABLE: 'DATABASE_URL',
    HOST_VARIABLE: 'URL host component',
    PORT_VARIABLE: 'URL port component',
    DATABASE_NAME_VARIABLE: 'URL database component',
    SCHEMA_SEARCH_PATH: 'SOURCE_CEILING',
    MIGRATION_COMMAND:
      'Manual partial run-migrations.ts; package startup has no schema materializer',
    DATABASE_SCOPE: 'financial-service',
    SHARED_BINDING_KEY: null,
  },
]
const physicalBinding = {
  DJANGO_SCOPED_PHYSICAL_DB_BINDING: 'ESTABLISHED_SAME_TARGET',
  ESTABLISHED_SCOPE:
    'Existing deployment Django and targeted scoped job share the same plan-selected vault and fixed secret reference; fresh-build composes one conn/dbName',
  SECRET_VALUES_COMPARED_OR_ACCESSED: 'NO',
  PROVES_FULL_FROZEN_REPLAY_BINDING: 'NO',
  PROVES_RUNTIME_DEPLOYED_TARGET: 'NO',
  ALL_ENVIRONMENTS_OR_SERVICES_MERGED: 'NO',
  FULL_CANONICAL_SCOPE_ROLE_SEARCH_PATH_BINDING: 'SOURCE_CEILING',
  EVIDENCE: bindingRecords.slice(0, 4).flatMap((row) => row.CONFIG_SOURCE),
  DEPLOYMENT_RUNTIME_TRANSLATION: {
    EVIDENCE: cite(workflowFile, 'DB_URL_SECRET=$(echo "$FRONTEND_ENV_JSON"'),
    BINDING:
      'Frontend DATABASE_URL secret reference is translated to Django runtime PG*; discrete PG* fallback exists',
    MIGRATION_ADMIN_VERSUS_RUNTIME_SECRET_TARGET_EQUALITY:
      'SOURCE_CEILING: separate secret references, no value comparison',
  },
}
const topology = [
  {
    SERVICE_ID: 'deployment-django-migration-job',
    SERVICE_KIND: 'CI_EPHEMERAL_CONTAINER',
    DJANGO_BACKEND: 'YES',
    NEXT_APP: 'NO',
    FINANCIAL_SERVICE: 'NO',
    MIGRATION_RUNNER: 'YES',
    DATABASE_BINDING_IDS: [bindingRecords[0].BINDING_ID],
    START_COMMAND: 'digest-pinned backend image',
    MIGRATION_COMMAND: bindingRecords[0].MIGRATION_COMMAND,
    MIGRATION_TIMING: 'SEPARATE_JOB',
    DEPLOYMENT_SOURCE: workflowFile,
    EXECUTED: 'NO',
  },
  {
    SERVICE_ID: 'deployment-scoped-0005-job',
    SERVICE_KIND: 'CI_JOB',
    DJANGO_BACKEND: 'NO',
    NEXT_APP: 'NO',
    FINANCIAL_SERVICE: 'NO',
    MIGRATION_RUNNER: 'YES',
    DATABASE_BINDING_IDS: [bindingRecords[1].BINDING_ID],
    START_COMMAND: 'pnpm scoped capability rollout',
    MIGRATION_COMMAND: bindingRecords[1].MIGRATION_COMMAND,
    MIGRATION_TIMING: 'SEPARATE_JOB',
    DEPLOYMENT_SOURCE: workflowFile,
    EXECUTED: 'NO',
  },
  {
    SERVICE_ID: 'django-runtime-sidecar',
    SERVICE_KIND: 'CONTAINER_APP_SIDECAR',
    DJANGO_BACKEND: 'YES',
    NEXT_APP: 'NO',
    FINANCIAL_SERVICE: 'NO',
    MIGRATION_RUNNER: 'NO',
    DATABASE_BINDING_IDS: [],
    START_COMMAND: 'gunicorn config.wsgi:application',
    MIGRATION_COMMAND: null,
    MIGRATION_TIMING: 'SEPARATE_JOB',
    DEPLOYMENT_SOURCE: `${backend}/Dockerfile`,
    RUNTIME_TARGET_EVIDENCE: physicalBinding.DEPLOYMENT_RUNTIME_TRANSLATION.EVIDENCE,
  },
  {
    SERVICE_ID: 'next-runtime',
    SERVICE_KIND: 'CONTAINER_APP',
    DJANGO_BACKEND: 'NO',
    NEXT_APP: 'YES',
    FINANCIAL_SERVICE: 'NO',
    MIGRATION_RUNNER: 'NO',
    DATABASE_BINDING_IDS: [],
    START_COMMAND: 'Next standalone server',
    MIGRATION_COMMAND: null,
    MIGRATION_TIMING: 'SEPARATE_JOB',
    DEPLOYMENT_SOURCE: workflowFile,
  },
  {
    SERVICE_ID: 'financial-runtime',
    SERVICE_KIND: 'PACKAGE_PROCESS',
    DJANGO_BACKEND: 'NO',
    NEXT_APP: 'NO',
    FINANCIAL_SERVICE: 'YES',
    MIGRATION_RUNNER: 'NO',
    DATABASE_BINDING_IDS: [bindingRecords[5].BINDING_ID],
    START_COMMAND: 'node dist/index.js',
    MIGRATION_COMMAND: null,
    MIGRATION_TIMING: 'MANUAL_ONLY',
    DEPLOYMENT_SOURCE: `${finance}/package.json`,
    DEPLOYMENT_JOB_BINDING: 'NOT_ESTABLISHED',
  },
]
for (const process of [
  {
    ID: 'disposable-fresh-build',
    SOURCE: freshFile,
    COMMAND: 'pnpm --filter @nzila/union-eyes schema:contract:fresh-build',
    DJANGO: 'YES',
    FINANCIAL: 'NO',
    BINDINGS: bindingRecords.slice(2, 4).map((row) => row.BINDING_ID),
  },
  {
    ID: 'standalone-ue-bootstrap',
    SOURCE: bootstrapFile,
    COMMAND: bindingRecords[4].MIGRATION_COMMAND,
    DJANGO: 'NO',
    FINANCIAL: 'NO',
    BINDINGS: [bindingRecords[4].BINDING_ID],
  },
  {
    ID: 'manual-role-provisioner',
    SOURCE: provisionFile,
    COMMAND: 'pnpm --filter @nzila/union-eyes db:provision-roles',
    DJANGO: 'NO',
    FINANCIAL: 'NO',
    BINDINGS: [],
  },
  {
    ID: 'manual-financial-migration-runner',
    SOURCE: `${finance}/run-migrations.ts`,
    COMMAND: 'tsx run-migrations.ts',
    DJANGO: 'NO',
    FINANCIAL: 'YES',
    BINDINGS: [bindingRecords[5].BINDING_ID],
  },
])
  topology.push({
    SERVICE_ID: process.ID,
    SERVICE_KIND: 'MANUAL_OPERATIONAL_RUNNER',
    DJANGO_BACKEND: process.DJANGO,
    NEXT_APP: 'NO',
    FINANCIAL_SERVICE: process.FINANCIAL,
    MIGRATION_RUNNER: 'YES',
    DATABASE_BINDING_IDS: process.BINDINGS,
    START_COMMAND: process.COMMAND,
    MIGRATION_COMMAND: process.COMMAND,
    MIGRATION_TIMING: 'MANUAL_ONLY',
    DEPLOYMENT_SOURCE: process.SOURCE,
    EXECUTED: 'NO',
  })
for (const observation of observations.filter((row) => row.FILE !== workflowFile)) {
  for (const job of observation.JOBS.filter(
    (row) => row.DJANGO_MIGRATE || row.SCOPED_ROLLOUT || row.SECURITY_MIGRATION_COMMAND,
  ))
    topology.push({
      SERVICE_ID: `${observation.FILE}::${job.NAME}`,
      SERVICE_KIND: 'CI_JOB',
      DJANGO_BACKEND: job.DJANGO_MIGRATE ? 'YES' : 'NO',
      NEXT_APP: 'NO',
      FINANCIAL_SERVICE: 'NO',
      MIGRATION_RUNNER: 'YES',
      DATABASE_BINDING_IDS: [],
      START_COMMAND: 'See source job, command values not serialized',
      MIGRATION_COMMAND: job.DJANGO_MIGRATE ? 'manage.py migrate' : 'scoped migration rollout',
      MIGRATION_TIMING: 'SEPARATE_JOB',
      DEPLOYMENT_SOURCE: observation.FILE,
      JOB_CONDITION: job.JOB_CONDITION,
      DISABLED_LITERAL_FALSE: job.DISABLED_LITERAL_FALSE,
      BINDING_STATUS: 'SOURCE_CEILING: not promoted to complete frozen replay',
      EXECUTED: 'NO',
    })
}
for (const observation of observations.filter((row) => row.SERVICES.length)) {
  for (const service of observation.SERVICES.filter(
    (row) =>
      /union-eyes|backend|^web$|^frontend$|celery/.test(`${row.NAME} ${row.BUILD_CONTEXT}`) &&
      (observation.FILE === `${backend}/docker-compose.yml` || row.NAME === 'union-eyes'),
  )) {
    topology.push({
      SERVICE_ID: `${observation.FILE}::${service.NAME}`,
      SERVICE_KIND: 'COMPOSE_SERVICE',
      DJANGO_BACKEND:
        /web|celery/.test(service.NAME) && observation.FILE.startsWith(backend) ? 'YES' : 'NO',
      NEXT_APP: /frontend|union-eyes/.test(service.NAME) ? 'YES' : 'NO',
      FINANCIAL_SERVICE: 'NO',
      MIGRATION_RUNNER: 'NO',
      DATABASE_BINDING_IDS: [],
      START_COMMAND: service.START_COMMAND,
      MIGRATION_COMMAND: null,
      MIGRATION_TIMING: 'MANUAL_ONLY',
      DEPLOYMENT_SOURCE: observation.FILE,
      ENVIRONMENT_KEYS: service.ENVIRONMENT_KEYS,
      BINDING_CEILING: 'Compose DATABASE_URL does not alone compose default Django PG* settings',
    })
  }
}

const packageMap = {
  rest_framework: 'djangorestframework',
  corsheaders: 'django-cors-headers',
  django_filters: 'django-filter',
  django_celery_beat: 'django-celery-beat',
  django_celery_results: 'django-celery-results',
}
const requirements = observationByFile.get(`${backend}/requirements.txt`).PACKAGE_REQUIREMENTS
const configuredApps = settings.INSTALLED_APPS.map((app) => {
  const local = a1d.djangoMigrationPlan.MIGRATIONS.filter((row) => row.APP === app)
  const framework = app.startsWith('django.contrib.')
  const packageName = framework ? 'Django' : (packageMap[app] ?? null)
  const disabled =
    settings.MIGRATION_MODULES &&
    Object.hasOwn(settings.MIGRATION_MODULES, app) &&
    settings.MIGRATION_MODULES[app] === null
  const sourceClass = disabled
    ? 'MIGRATIONS_DISABLED'
    : local.length
      ? 'LOCAL_REPOSITORY'
      : framework
        ? 'DJANGO_FRAMEWORK'
        : packageName
          ? 'THIRD_PARTY_PACKAGE'
          : 'SOURCE_CEILING'
  return {
    DJANGO_CONFIGURED_APP_ID: id('DJANGO-APP', app),
    APP: app,
    APP_SOURCE: local.length ? `${backend}/${app}/apps.py` : (packageName ?? `${backend}/${app}`),
    MIGRATION_SOURCE_CLASS: sourceClass,
    DEPENDENCY_ROLE:
      'Configured by default operational settings; do not infer migrationless packages from names',
    LOCAL_MIGRATION_IDS: local.map((row) => row.DJANGO_MIGRATION_ID),
    PACKAGE: packageName,
    NO_MIGRATIONS_PROOF: disabled ? 'Explicit MIGRATION_MODULES null' : 'NOT_INFERRED',
  }
})
const externalDependencies = configuredApps
  .filter((row) => row.PACKAGE)
  .map((app) => {
    const requirement = requirements.find(
      (row) => row.PACKAGE.toLowerCase() === app.PACKAGE.toLowerCase(),
    )
    assert.ok(requirement, `Configured package missing dependency declaration: ${app.PACKAGE}`)
    return {
      EXTERNAL_MIGRATION_DEPENDENCY_ID: id('EXTERNAL-MIGRATION', app.APP),
      DJANGO_CONFIGURED_APP_ID: app.DJANGO_CONFIGURED_APP_ID,
      PACKAGE: app.PACKAGE,
      PACKAGE_VERSION_SOURCE: cite(
        `${backend}/requirements.txt`,
        `${requirement.PACKAGE}${requirement.VERSION_CONSTRAINT}`,
      ),
      VERSION_CONSTRAINT: requirement.VERSION_CONSTRAINT,
      MIGRATION_AUTHORITY:
        app.MIGRATION_SOURCE_CLASS === 'DJANGO_FRAMEWORK'
          ? 'FRAMEWORK_PACKAGE'
          : 'THIRD_PARTY_PACKAGE',
      PINNED_VERSION: requirement.EXACT_VERSION_PINNED ? 'YES' : 'NO',
      REQUIRED_BEFORE_LOCAL_MIGRATION_IDS: [],
      CONFIGURED_IN_ALL_LOCAL_MIGRATION_INVOCATIONS: 'YES',
      LOCAL_LITERAL_DEPENDENCY_EDGE_TO_THIS_PACKAGE: 'NONE_IN_FROZEN_26',
      RESOLUTION:
        'SOURCE_CEILING: no exact package graph, migrationless proof, or recorded swappable model plan',
      VENDORED_OR_EXECUTED: 'NO',
    }
  })
const django = {
  COMPLETE_DJANGO_MIGRATION_PLAN: 'SOURCE_CEILING',
  SETTINGS_SELECTION: settingsSelection,
  CONFIGURED_APPS: configuredApps,
  EXTERNAL_MIGRATION_DEPENDENCIES: externalDependencies,
  LOCAL_MIGRATIONS: a1d.djangoMigrationPlan.MIGRATIONS,
  LITERAL_DEPENDENCY_EDGES: a1d.djangoMigrationPlan.DEPENDENCY_REGISTER,
  A1D_BROADER_CLOSURE_CEILINGS: a1d.djangoMigrationPlan.SOURCE_CEILINGS,
  SUMMARY: {
    DJANGO_CONFIGURED_APPS: configuredApps.length,
    LOCAL_APPS: configuredApps.filter((row) => row.MIGRATION_SOURCE_CLASS === 'LOCAL_REPOSITORY')
      .length,
    FRAMEWORK_APPS: configuredApps.filter(
      (row) => row.MIGRATION_SOURCE_CLASS === 'DJANGO_FRAMEWORK',
    ).length,
    THIRD_PARTY_APPS: configuredApps.filter(
      (row) => row.MIGRATION_SOURCE_CLASS === 'THIRD_PARTY_PACKAGE',
    ).length,
    MIGRATIONS_DISABLED_APPS: configuredApps.filter(
      (row) => row.MIGRATION_SOURCE_CLASS === 'MIGRATIONS_DISABLED',
    ).length,
    SOURCE_CEILING_APPS: configuredApps.filter(
      (row) => row.MIGRATION_SOURCE_CLASS === 'SOURCE_CEILING',
    ).length,
    DJANGO_LOCAL_MIGRATIONS: 29,
    DJANGO_LITERAL_DEPENDENCY_EDGES: 26,
    DJANGO_BROADER_CLOSURE_CEILINGS_REMAIN: a1d.djangoMigrationPlan.SOURCE_CEILINGS.length,
  },
  PACKAGE_GRAPH_LIMITATION:
    'Requirements constrain rather than pin package versions. No package migration code imported, executed or reproduced. The configured apps namespace has no accepted migration/module authority; raw/generated operations remain unclosed.',
}
django.SUM = Object.entries(django.SUMMARY)
  .filter(([key]) =>
    /^(LOCAL_APPS|FRAMEWORK_APPS|THIRD_PARTY_APPS|MIGRATIONS_DISABLED_APPS|SOURCE_CEILING_APPS)$/.test(
      key,
    ),
  )
  .reduce((sum, [, value]) => sum + value, 0)
const financialRunner = observationByFile.get(`${finance}/run-migrations.ts`)
assert.equal(financialRunner.STATIC_ARRAYS.migrations.length, 3)
const financialManifest = financialRunner.STATIC_ARRAYS.migrations.map((name, index) => {
  const FILE = `${backend.replace('/backend', '')}/database/migrations/${name}`
  const present = existsSync(absolute(FILE))
  return {
    FILE,
    ORDER_INDEX: index,
    PRESENT: present ? 'YES' : 'NO',
    SHA256: present ? hash(readFileSync(absolute(FILE))) : null,
  }
})
assert.ok(
  financialManifest.every((row) => row.PRESENT === 'NO'),
  'Referenced financial materializer changed; reevaluation required',
)
const financial = {
  FINANCIAL_SCHEMA_AUTHORITY: 'SOURCE_CEILING',
  FROZEN_FINANCIAL_MIGRATION_IS_COMMENT_ONLY: 'YES',
  FINANCIAL_DATABASE_SCOPE: 'financial-service',
  UE_DATABASE_SCOPE_MERGED: 'NO',
  FINANCIAL_SCHEMA_AUTHORITY_SOURCE: null,
  FINANCIAL_MIGRATION_COMMAND: null,
  FINANCIAL_MIGRATION_MANIFEST: financialManifest,
  FINANCIAL_BOOTSTRAP_ORDER: [],
  OPERATIONAL_CANDIDATE_COMMAND: 'Manual: tsx run-migrations.ts',
  CANDIDATE_EVIDENCE: [
    cite(`${finance}/run-migrations.ts`, 'const migrationsDir'),
    cite(`${finance}/package.json`, '"start"'),
  ],
  FAILURE_POLICY:
    'Runner skips absent files and converts per-file failures to false; cannot supply fail-fast bootstrap authority',
  PARTIAL_AD_HOC_SOURCES: [
    'add-missing-tables.sql',
    'add-gate13-job-cancellation-tables.sql',
    'add-is-active-column.sql',
    'migrate-strike-funds.ts',
  ].map((file) => ({
    FILE: `${finance}/${file}`,
    SHA256: sources.get(`${finance}/${file}`).SHA256,
    CANONICAL_FULL_SCOPE_AUTHORITY: 'NO',
    REASON:
      'Partial repair/addition, no governed complete fresh-schema sequence or required target binding',
  })),
  SOURCE_OBJECT_DENOMINATOR: a1d.financialScopeAuthority.SOURCE_OBJECT_DENOMINATOR,
  FROZEN_SQL_PROMOTED: 'NO',
  REQUIRED_EVIDENCE:
    'Governed executable full-scope manifest with byte hashes, order, role/target/search_path contract and fail-fast behavior; not generation, uncommenting or repair in this phase',
}

const extensions =
  prerequisiteById.size &&
  a1.prerequisiteRegistry
    .filter((row) => row.KIND === 'EXTENSION')
    .map((row) => {
      const required = observationByFile.get(scopedFile).STATIC_ARRAYS.REQUIRED_EXTENSIONS
      assert.ok(required.includes(row.PHYSICAL_NAME))
      const optional = row.PHYSICAL_NAME === 'vector'
      if (optional)
        assert.match(source(scopedFile), /OPTIONAL_EXTENSIONS = new Set\(\['vector'\]\)/)
      return {
        EXTENSION_ID: row.PREREQUISITE_ID,
        EXTENSION: row.PHYSICAL_NAME,
        INSTALL_AUTHORITY:
          'Shared scoped executor, invoked by bootstrap before scoped/platform files',
        INSTALL_COMMAND_OR_MIGRATION:
          'ensureExtensions(client): CREATE EXTENSION IF NOT EXISTS <explicit required extension>',
        DATABASE_SCOPE: row.DATABASE_SCOPE,
        REQUIRED_BEFORE_MIGRATION_IDS: unique(
          row.CONSUMERS.map((consumer) => consumer.MIGRATION_NODE_ID),
        ),
        AVAILABILITY_ASSUMPTION: optional
          ? 'Optional installation failure tolerated; guarded downstream use for every consumer not established'
          : 'Server supports extension and installer has privilege; failure aborts bootstrap; runtime availability unproven',
        DISPOSITION: optional ? 'SOURCE_CEILING' : 'CANONICAL_BOOTSTRAP_INSTALL',
        EVIDENCE: [
          cite(scopedFile, 'export const REQUIRED_EXTENSIONS'),
          cite(scopedFile, 'export async function ensureExtensions'),
          cite(bootstrapFile, 'await ensureExtensions(client)'),
        ],
        DETERMINISTIC_PRODUCER_BINDING:
          'Same bootstrap client, explicit array, before all frozen UE scoped/platform consumers',
        RUNTIME_INSTALLED: 'NOT_PROVEN',
      }
    })
const roles = a1.prerequisiteRegistry
  .filter((row) => row.KIND === 'ROLE')
  .map((row) => ({
    PREREQUISITE_ID: row.PREREQUISITE_ID,
    ROLE: row.PHYSICAL_NAME,
    DATABASE_SCOPE: row.DATABASE_SCOPE,
    DISPOSITION: 'RUNTIME_MANUAL_PREREQUISITE',
    CREATION_AUTHORITY_FOUND: 'YES',
    CREATION_AUTHORITY: provisionFile,
    COMMAND: 'pnpm --filter @nzila/union-eyes db:provision-roles',
    TARGET_VARIABLE: 'PROVISION_ADMIN_DATABASE_URL',
    EVIDENCE: [
      cite(provisionFile, 'CREATE ROLE ${role.roleName}'),
      cite(freshFile, 'Missing runtime role(s)'),
    ],
    PRECONSUMER_TARGET_AND_SEQUENCE_ESTABLISHED: 'NO',
    ROLE_CREATED_OR_RUNTIME_ATTRIBUTES_QUERIED: 'NO',
    REASON:
      'Explicit role creator exists, but separate manual target/provisioning is not composed into the full frozen bootstrap sequence; harness checks preexistence rather than creates roles',
  }))
for (const role of roles)
  assert.ok(
    source(provisionFile).includes(`roleName: '${role.ROLE}'`),
    `Role creator binding not established: ${role.ROLE}`,
  )
const typeFunctions = a1.prerequisiteRegistry
  .filter(
    (row) =>
      ['TYPE', 'FUNCTION'].includes(row.KIND) &&
      priorCeilings.some((prior) => prior.PREREQUISITE_ID === row.PREREQUISITE_ID),
  )
  .map((row) => ({
    PREREQUISITE_ID: row.PREREQUISITE_ID,
    KIND: row.KIND,
    PHYSICAL_IDENTITY: row.PHYSICAL_NAME,
    DATABASE_SCOPE: row.DATABASE_SCOPE,
    DISPOSITION: 'SOURCE_CEILING',
    A1_SOURCE_CANDIDATE_IDS: row.CANDIDATE_SOURCE_IDS,
    OPERATIONAL_PRODUCER_CANDIDATES: observations.flatMap((observation) =>
      observation.SQL_PRODUCER_SYMBOLS.filter((symbol) => symbol.NAME === row.PHYSICAL_NAME).map(
        (symbol) => ({
          FILE: observation.FILE,
          SHA256: observation.SHA256,
          ...symbol,
        }),
      ),
    ),
    REASON:
      'No full-scope target-bound, preconsumer operational producer authority established. Literal/schema/history/helper signatures are not accepted materialization.',
  }))
const ordering = a1d.scopedPlatformOrderingReconciliation.map((row) => ({
  ORDERING_RECORD_ID: row.ORDERING_CONFLICT_ID,
  CURRENT_CONSUMER: row.CONSUMER_MIGRATION,
  LATER_PROVIDER: row.CURRENT_FROZEN_PROVIDER,
  PREREQUISITE_ID: row.REQUIRED_PREREQUISITE,
  PRECONSUMER_PROVIDER_FOUND: 'NO',
  PRECONSUMER_PROVIDER_CLASS: 'NONE',
  DECLARED_DJANGO_CANDIDATES: row.DECLARED_DJANGO_PROVIDER_CANDIDATES,
  FINAL_DISPOSITION: 'SOURCE_CEILING',
  OPERATIONAL_SOURCE_EVIDENCE: [
    cite(freshFile, 'runDjangoMigrate(conn, dbName, false)'),
    cite(bootstrapFile, 'const platformSummary'),
  ],
  REASON:
    'Django-first harness exists, but full configured graph and exact required physical/column/type state do not close this dependency; existing-environment targeted jobs are not a preconsumer clean-schema baseline',
  FROZEN_ORDER_CHANGED: 'NO',
}))
const opaque = a1d.opaqueBindingReconciliation.map((row) => ({
  OPAQUE_BINDING_ID: row.DYNAMIC_BINDING_ID,
  A1_PREREQUISITE_ID: row.A1_PREREQUISITE_ID,
  CONSUMER_IDS: unique(row.A1_CONSUMERS.map((consumer) => consumer.MIGRATION_NODE_ID)),
  A1_CONSUMERS: row.A1_CONSUMERS,
  INPUT_IDENTITY: row.INPUT_IDENTITY,
  BINDING_CLASS: row.INPUT_IDENTITY.split(':').at(-1),
  DATABASE_SCOPE: row.DATABASE_SCOPE,
  OPERATIONAL_SOURCE_EVIDENCE:
    row.DATABASE_SCOPE === 'financial-service'
      ? financial.CANDIDATE_EVIDENCE
      : [
          cite(scopedFile, 'export async function applyScopedMigrations'),
          cite(bootstrapFile, 'const migrateSummary'),
        ],
  FINAL_HANDLING: 'SOURCE_CEILING',
  EXACT_NEXT_EVIDENCE_REQUIRED: row.REQUIRED_EVIDENCE,
  REASON: `Consumer-preserving ${row.INPUT_IDENTITY} obligation: operational client/role wiring does not pin dynamic target sets, ACL scopes, conditional execution or semantic materialization`,
}))
const extensionById = new Map(extensions.map((row) => [row.EXTENSION_ID, row]))
const reconciliation = priorCeilings.map((prior) => {
  const prerequisite = prerequisiteById.get(prior.PREREQUISITE_ID)
  const extension = extensionById.get(prior.PREREQUISITE_ID)
  const resolved = extension?.DISPOSITION === 'CANONICAL_BOOTSTRAP_INSTALL'
  return {
    PREREQUISITE_ID: prior.PREREQUISITE_ID,
    A1_IDENTITY: prior.A1_IDENTITY,
    DATABASE_SCOPE: prior.DATABASE_SCOPE,
    KIND: prerequisite.KIND,
    A1D_DISPOSITION: prior.DISPOSITION,
    FINAL_DISPOSITION: resolved ? 'RESOLVED_BY_PLATFORM_BASELINE' : 'SOURCE_CEILING_REMAINS',
    RESOLUTION_SCOPE: resolved
      ? 'Static install authority and same-client ordering only; installed runtime state not proven'
      : 'Full preconsumer bootstrap authority remains unestablished',
    OPERATIONAL_SOURCE_EVIDENCE: resolved ? extension.EVIDENCE : [],
    SOURCE_CANDIDATE_IDS: prior.SOURCE_CANDIDATE_IDS,
    CONSUMER_IDS: unique(prerequisite.CONSUMERS.map((consumer) => consumer.MIGRATION_NODE_ID)),
    ORDERING_RECORD_IDS: ordering
      .filter((row) => row.PREREQUISITE_ID === prior.PREREQUISITE_ID)
      .map((row) => row.ORDERING_RECORD_ID),
    OPAQUE_BINDING_IDS: opaque
      .filter((row) => row.A1_PREREQUISITE_ID === prior.PREREQUISITE_ID)
      .map((row) => row.OPAQUE_BINDING_ID),
    REASON: resolved
      ? 'Explicit mandatory extension installer runs before every frozen UE consumer on one bootstrap client'
      : prerequisite.KIND === 'SOURCE_BINDING'
        ? 'Exact opaque binding obligation is still ungoverned'
        : prior.DATABASE_SCOPE === 'financial-service'
          ? 'Financial runner references absent files and lacks a complete fail-fast scope manifest'
          : prerequisite.KIND === 'ROLE'
            ? 'Creator exists, but target-bound provisioning order is not part of full frozen replay'
            : 'No complete configured Django graph or authoritative preconsumer operational baseline closes this exact identity',
    RUNTIME_PRESENCE_PROVEN: 'NO',
  }
})
const reconciliationById = new Map(reconciliation.map((row) => [row.PREREQUISITE_ID, row]))
const finalPrerequisites = a1d.prerequisiteContractMapping.map((prior) => ({
  PREREQUISITE_ID: prior.PREREQUISITE_ID,
  A1_IDENTITY: prior.A1_IDENTITY,
  A1D_DISPOSITION: prior.DISPOSITION,
  FINAL_DISPOSITION:
    reconciliationById.get(prior.PREREQUISITE_ID)?.FINAL_DISPOSITION ??
    (prior.DISPOSITION === 'SATISFIED_BY_POSTGRES_CORE'
      ? 'POSTGRES_CORE'
      : 'PRIOR_FROZEN_DECLARATIONS'),
  A1E_RECONCILIATION_ID: reconciliationById.has(prior.PREREQUISITE_ID)
    ? prior.PREREQUISITE_ID
    : null,
  FROZEN_DECLARATION_NOT_RUNTIME_PROOF: 'YES',
  RUNTIME_PRESENCE_PROVEN: 'NO',
}))
const remaining = reconciliation
  .filter((row) => row.FINAL_DISPOSITION === 'SOURCE_CEILING_REMAINS')
  .map((row) => ({
    REMAINING_EVIDENCE_ID: id('REMAINING', row.PREREQUISITE_ID),
    CATEGORY:
      row.KIND === 'ROLE' || row.KIND === 'EXTENSION'
        ? 'RUNTIME_ENVIRONMENT_EVIDENCE_REQUIRED'
        : row.KIND === 'SOURCE_BINDING'
          ? 'GOVERNANCE_DECISION_REQUIRED'
          : 'MISSING_REPOSITORY_AUTHORITY',
    AFFECTED_PREREQUISITE_IDS: [row.PREREQUISITE_ID],
    AFFECTED_OPAQUE_BINDING_IDS: row.OPAQUE_BINDING_IDS,
    AFFECTED_ORDERING_RECORD_IDS: row.ORDERING_RECORD_IDS,
    WHY_REPOSITORY_STATIC_EVIDENCE_IS_EXHAUSTED: row.REASON,
    EXACT_NEXT_EVIDENCE_REQUIRED: row.OPAQUE_BINDING_IDS.length
      ? opaque.find((binding) => binding.OPAQUE_BINDING_ID === row.OPAQUE_BINDING_IDS[0])
          .EXACT_NEXT_EVIDENCE_REQUIRED
      : row.KIND === 'ROLE'
        ? 'Approved provisioning contract binds PROVISION_ADMIN_DATABASE_URL to the replay cluster and precedes every consumer; controlled role-attribute evidence, not a runtime query in A1E'
        : row.KIND === 'EXTENSION'
          ? 'Approved vector availability and guarded-use contract covering each consumer; controlled package/server evidence without tolerating indispensable missing prerequisites'
          : `Governed executable preconsumer authority for ${row.A1_IDENTITY}, including exact physical identity/state, scope/role/search_path, ordered byte-digested producer and prerequisite graph; source declarations alone do not suffice`,
  }))
for (const external of externalDependencies)
  remaining.push({
    REMAINING_EVIDENCE_ID: id('REMAINING', external.EXTERNAL_MIGRATION_DEPENDENCY_ID),
    CATEGORY: 'EXTERNAL_PACKAGE_RUNTIME_EVIDENCE_REQUIRED',
    AFFECTED_PREREQUISITE_IDS: reconciliation
      .filter(
        (row) =>
          row.DATABASE_SCOPE === 'union-eyes' &&
          row.KIND !== 'SOURCE_BINDING' &&
          row.FINAL_DISPOSITION === 'SOURCE_CEILING_REMAINS',
      )
      .map((row) => row.PREREQUISITE_ID),
    AFFECTED_OPAQUE_BINDING_IDS: [],
    AFFECTED_ORDERING_RECORD_IDS: [],
    DJANGO_CONFIGURED_APP_ID: external.DJANGO_CONFIGURED_APP_ID,
    WHY_REPOSITORY_STATIC_EVIDENCE_IS_EXHAUSTED: `${external.PACKAGE} is range-constrained, not version-pinned; package migration graph is not repository evidence`,
    EXACT_NEXT_EVIDENCE_REQUIRED:
      'Governed exact package version/digest and syntax or controlled package migration plan including contributed dependencies, swappable models and explicit migrationless app proof',
  })
for (const gap of a1d.djangoMigrationPlan.SOURCE_CEILINGS.filter((row) => row.DJANGO_MIGRATION_ID))
  remaining.push({
    REMAINING_EVIDENCE_ID: id('REMAINING', gap.SOURCE_CEILING_ID),
    CATEGORY: 'MISSING_REPOSITORY_AUTHORITY',
    AFFECTED_PREREQUISITE_IDS: [],
    AFFECTED_OPAQUE_BINDING_IDS: [],
    AFFECTED_ORDERING_RECORD_IDS: [],
    A1D_DJANGO_SOURCE_CEILING_ID: gap.SOURCE_CEILING_ID,
    DJANGO_MIGRATION_ID: gap.DJANGO_MIGRATION_ID,
    WHY_REPOSITORY_STATIC_EVIDENCE_IS_EXHAUSTED:
      'Operational migrate command does not close raw/generated physical operation dependencies',
    EXACT_NEXT_EVIDENCE_REQUIRED: gap.REQUIRED_EVIDENCE,
  })
for (const app of configuredApps.filter((row) => row.MIGRATION_SOURCE_CLASS === 'SOURCE_CEILING'))
  remaining.push({
    REMAINING_EVIDENCE_ID: id('REMAINING', app.DJANGO_CONFIGURED_APP_ID),
    CATEGORY: 'MISSING_REPOSITORY_AUTHORITY',
    DJANGO_CONFIGURED_APP_ID: app.DJANGO_CONFIGURED_APP_ID,
    AFFECTED_PREREQUISITE_IDS: [],
    AFFECTED_OPAQUE_BINDING_IDS: [],
    AFFECTED_ORDERING_RECORD_IDS: [],
    WHY_REPOSITORY_STATIC_EVIDENCE_IS_EXHAUSTED:
      'Configured namespace has no accepted migration or explicit migrations-disabled authority',
    EXACT_NEXT_EVIDENCE_REQUIRED:
      'Approved app/module and migration binding for the configured apps namespace, or explicit governed migrationless proof; raw models alone are not a migration authority',
  })
remaining.push({
  REMAINING_EVIDENCE_ID: id('REMAINING', 'governance-binding'),
  CATEGORY: 'GOVERNANCE_DECISION_REQUIRED',
  AFFECTED_PREREQUISITE_IDS: [],
  AFFECTED_OPAQUE_BINDING_IDS: [],
  AFFECTED_ORDERING_RECORD_IDS: [],
  WHY_REPOSITORY_STATIC_EVIDENCE_IS_EXHAUSTED:
    'Targeted existing-environment deployment and disposable harness do not define one clean-database contract for all 23 frozen files/scopes; search_path and role bindings remain implicit',
  EXACT_NEXT_EVIDENCE_REQUIRED:
    'Approved full-scope binding/sequence manifest, initial database state, role/search_path/extension contract and financial authority; snapshot provenance/version/object/policy digests if snapshot strategy selected. No additional generic repository source pass.',
})
const candidates = a1d.bootstrapCandidates.map((candidate) => ({
  BOOTSTRAP_CANDIDATE_ID: candidate.BOOTSTRAP_CANDIDATE_ID,
  STRATEGY: candidate.STRATEGY,
  A1D_DECISION: candidate.CONTRACT_ADOPTABLE,
  A1E_NEW_EVIDENCE: {
    PHYSICAL_TARGET_COMPOSITION: physicalBinding.EVIDENCE,
    CONFIGURED_DJANGO_APP_GRAPH: configuredApps.map((row) => row.DJANGO_CONFIGURED_APP_ID),
    MANDATORY_EXTENSION_PRODUCER_IDS: extensions
      .filter((row) => row.DISPOSITION === 'CANONICAL_BOOTSTRAP_INSTALL')
      .map((row) => row.EXTENSION_ID),
    FINANCIAL_RUNNER: financial.CANDIDATE_EVIDENCE,
  },
  REMAINING_GAPS: unique([
    ...candidate.CONTRACT_GAPS,
    'FULL_FROZEN_SCOPE_ROLE_SEARCH_PATH_BINDING_NOT_ESTABLISHED',
  ]).filter((gap) => gap !== 'PHYSICAL_DB_BINDING_UNPROVEN'),
  CONTRACT_ADOPTABLE: 'NO',
  REASON:
    'Same-target operational composition is narrower than a complete frozen bootstrap contract; indispensable authority ceilings remain',
}))
const opaqueValues = [
  'RESOLVED_TO_PHYSICAL_TARGET',
  'RESOLVED_TO_RUNTIME_BINDING_CONTRACT',
  'NOT_BOOTSTRAP_RELEVANT',
  'SOURCE_CEILING',
]
const ceilingValues = [
  'RESOLVED_BY_DJANGO_OPERATIONAL_PLAN',
  'RESOLVED_BY_FRAMEWORK_OR_THIRD_PARTY_MIGRATION',
  'RESOLVED_BY_PLATFORM_BASELINE',
  'RESOLVED_BY_DEPLOYMENT_BOOTSTRAP',
  'RESOLVED_BY_FINANCIAL_AUTHORITY',
  'RESOLVED_BY_RUNTIME_BINDING_CONTRACT',
  'NOT_BOOTSTRAP_RELEVANT',
  'SOURCE_CEILING_REMAINS',
]
const summary = {
  PHYSICAL_DB_BINDING: physicalBinding.DJANGO_SCOPED_PHYSICAL_DB_BINDING,
  DJANGO: django.SUMMARY,
  FINANCIAL_SCHEMA_AUTHORITY: financial.FINANCIAL_SCHEMA_AUTHORITY,
  FROZEN_MIGRATION_NODES: 23,
  ORDERING_RECORDS_INPUT: ordering.length,
  ORDERING_DISPOSITIONS: count(ordering, 'FINAL_DISPOSITION', [
    'PRECONSUMER_PREREQUISITE_ESTABLISHED',
    'TRUE_ORDERING_CONFLICT',
    'SOURCE_CEILING',
  ]),
  OPAQUE_BINDINGS_INPUT: opaque.length,
  OPAQUE_DISPOSITIONS: count(opaque, 'FINAL_HANDLING', opaqueValues),
  OPAQUE_SUM: opaque.length,
  PREREQUISITE_SOURCE_CEILINGS_INPUT: reconciliation.length,
  PREREQUISITE_CEILING_DISPOSITIONS: count(reconciliation, 'FINAL_DISPOSITION', ceilingValues),
  PREREQUISITE_CEILINGS_SUM: reconciliation.length,
  FINAL_PREREQUISITE_DISPOSITIONS: finalPrerequisites.length,
  FINAL_COUNTS: count(finalPrerequisites, 'FINAL_DISPOSITION', [
    'POSTGRES_CORE',
    'PRIOR_FROZEN_DECLARATIONS',
    ...ceilingValues,
  ]),
  UNIQUE_PREREQUISITE_IDS: new Set(finalPrerequisites.map((row) => row.PREREQUISITE_ID)).size,
  UNACCOUNTED: 0,
  AUTHORITY_CONFLICTS: 0,
  BOOTSTRAP_CRITICAL_SOURCE_CEILINGS: reconciliation.filter(
    (row) => row.FINAL_DISPOSITION === 'SOURCE_CEILING_REMAINS',
  ).length,
  CANDIDATES_REEVALUATED: candidates.length,
  ADOPTABLE_CANDIDATES: 0,
}
const result = {
  metadata: {
    PHASE: 'PHASE_1B_3C_A1E',
    METHOD:
      'Final bounded syntax/configuration-only operational evidence pass; no application traversal',
    FROZEN_INPUT_SHA256: hashes,
    A1_PREREQUISITE_GRAPH_DIGEST: digest(a1.migrationDependencyGraph),
    A1D_PREREQUISITE_MAPPING_DIGEST: digest(a1d.prerequisiteContractMapping),
    ANALYZER_SHA256: hash(readFileSync(script)),
    OPERATIONAL_PARSER_SHA256: hash(
      readFileSync(absolute('scripts/ue/read-operational-bootstrap-sources.mjs')),
    ),
    DJANGO_CONFIG_PARSER_SHA256: hash(
      readFileSync(absolute('scripts/ue/read-operational-django-config.py')),
    ),
    SOURCE_INVENTORY: [...sources.values()]
      .map(({ text, ...row }) => row)
      .sort((left, right) => left.FILE.localeCompare(right.FILE)),
    DIRECTORY_METADATA_EVIDENCE: [
      {
        PATH: `${backend}/config/settings/__init__.py`,
        PRESENT: 'NO',
        PURPOSE: 'Default module selection, not nested template settings',
      },
      ...financialManifest.map((row) => ({
        PATH: row.FILE,
        PRESENT: row.PRESENT,
        PURPOSE: 'Directly referenced financial runner input',
      })),
      ...['poetry.lock', 'uv.lock', 'requirements.lock'].map((name) => ({
        PATH: `${backend}/${name}`,
        PRESENT: existsSync(absolute(`${backend}/${name}`)) ? 'YES' : 'NO',
        PURPOSE:
          'Python package version-pinning evidence; present locks require explicit evaluation',
      })),
    ],
    ACTUAL_ENV_FILES_READ: 'NO',
    SECRET_STORES_ACCESSED: 'NO',
    CREDENTIAL_VALUES_SERIALIZED: 'NO',
    SOURCE_SCOPE_COMPLETE_FOR_THIS_AUTHORIZED_PASS: 'YES',
    SCOPE_EXCLUSIONS: [
      'Product routes/business services not followed from runtime entrypoint imports',
      'No external package migration source copied/imported/executed',
      'Historical/test shims not promoted',
      'No actual environment or secret stores',
    ],
  },
  operationalSourceObservations: observations,
  physicalDatabaseBinding: physicalBinding,
  PHYSICAL_DB_BINDING_RECORDS: bindingRecords,
  deploymentTopology: topology,
  djangoOperationalGraph: django,
  financialScopeAuthority: financial,
  roleAuthority: roles,
  extensionAuthority: extensions,
  typeFunctionAuthority: typeFunctions,
  orderingReconciliation: ordering,
  opaqueBindingReconciliation: opaque,
  sourceCeilingPrerequisiteReconciliation: reconciliation,
  finalPrerequisiteModel: finalPrerequisites,
  bootstrapCandidateReevaluation: candidates,
  remainingEvidenceRegister: remaining,
  frozenMigrationManifest: a1.frozenMigrationManifest,
  catalogQuarantine: a1d.catalogQuarantine,
  carryForward: a1d.carryForward,
  summary,
  phaseStatus: {
    ...a1d.phaseStatus,
    PHASE_1B_3C_A1E_GATE: 'SOURCE_CEILING',
    PHASE_1B_3C_A1E: 'SOURCE_CEILING_ACCEPTED',
    BOOTSTRAP_OPERATIONAL_EVIDENCE: 'CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS',
    NO_FURTHER_BOOTSTRAP_STATIC_SOURCE_PASS: 'YES',
    RECOMMENDED_BOOTSTRAP_CANDIDATE_ID: null,
    CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT: 'NOT_ESTABLISHED',
    PHASE_1B_3C_A1G_GOVERNANCE_ADOPTION: 'NOT_AUTHORIZED',
    PHASE_1B_3C_A1G_STARTED: 'NO',
  },
  validation: {
    FROZEN_PREDECESSORS_UNCHANGED: 'YES',
    FROZEN_MIGRATION_HASHES_UNCHANGED: 'YES',
    EXACT_ONCE_945_807_118_86_ACCOUNTING: 'YES',
    DJANGO_29_RECORDS_AND_26_EDGES_PRESERVED: 'YES',
    FINANCIAL_COMMENT_ONLY_MIGRATION_PROMOTED: 'NO',
    CLEANROOM_PROMOTED: 'NO',
    DATABASE_ACCESSED: 'NO',
    MIGRATIONS_EXECUTED: 'NO',
    SCHEMA_CHANGED: 'NO',
    POLICIES_CHANGED: 'NO',
    SECRET_VALUES_EXPOSED: 'NO',
    TENANT_ISOLATION_TESTS_EXECUTED: 'NO',
    CANONICAL_CONTRACT_CREATED: 'NO',
    GOVERNANCE_ADOPTION_STARTED: 'NO',
    DETERMINISTIC_GENERATION_SUPPORTED: 'YES',
    EXTERNAL_VALIDATION_RESULTS:
      'Parser self-tests, syntax, --check, scoped formatting and docs audit must be run separately; not inferred from report generation',
  },
}
function validate(report) {
  const exact = (actual, expected) => {
    assert.equal(actual.length, expected.length)
    assert.equal(new Set(actual).size, actual.length)
    assert.deepEqual(new Set(actual), new Set(expected))
  }
  exact(
    report.finalPrerequisiteModel.map((row) => row.PREREQUISITE_ID),
    a1.prerequisiteRegistry.map((row) => row.PREREQUISITE_ID),
  )
  exact(
    report.sourceCeilingPrerequisiteReconciliation.map((row) => row.PREREQUISITE_ID),
    priorCeilings.map((row) => row.PREREQUISITE_ID),
  )
  exact(
    report.opaqueBindingReconciliation.map((row) => row.OPAQUE_BINDING_ID),
    a1d.opaqueBindingReconciliation.map((row) => row.DYNAMIC_BINDING_ID),
  )
  exact(
    report.orderingReconciliation.map((row) => row.ORDERING_RECORD_ID),
    a1d.scopedPlatformOrderingReconciliation.map((row) => row.ORDERING_CONFLICT_ID),
  )
  exact(
    report.bootstrapCandidateReevaluation.map((row) => row.BOOTSTRAP_CANDIDATE_ID),
    a1d.bootstrapCandidates.map((row) => row.BOOTSTRAP_CANDIDATE_ID),
  )
  assert.deepEqual(
    report.djangoOperationalGraph.LOCAL_MIGRATIONS,
    a1d.djangoMigrationPlan.MIGRATIONS,
  )
  assert.deepEqual(
    report.djangoOperationalGraph.LITERAL_DEPENDENCY_EDGES,
    a1d.djangoMigrationPlan.DEPENDENCY_REGISTER,
  )
  assert.deepEqual(report.frozenMigrationManifest, a1.frozenMigrationManifest)
  for (const row of report.opaqueBindingReconciliation)
    assert.deepEqual(
      row.A1_CONSUMERS,
      a1d.opaqueBindingReconciliation.find(
        (prior) => prior.DYNAMIC_BINDING_ID === row.OPAQUE_BINDING_ID,
      ).A1_CONSUMERS,
    )
  for (const row of report.finalPrerequisiteModel) {
    const prior = a1d.prerequisiteContractMapping.find(
      (entry) => entry.PREREQUISITE_ID === row.PREREQUISITE_ID,
    )
    assert.equal(row.A1D_DISPOSITION, prior.DISPOSITION)
    assert.equal(row.A1_IDENTITY, prior.A1_IDENTITY)
    assert.equal(row.RUNTIME_PRESENCE_PROVEN, 'NO')
  }
  assert.equal(report.djangoOperationalGraph.SUM, settings.INSTALLED_APPS.length)
  assert.equal(
    Object.values(report.summary.OPAQUE_DISPOSITIONS).reduce((sum, value) => sum + value, 0),
    118,
  )
  assert.equal(
    Object.values(report.summary.PREREQUISITE_CEILING_DISPOSITIONS).reduce(
      (sum, value) => sum + value,
      0,
    ),
    807,
  )
  assert.equal(
    Object.values(report.summary.FINAL_COUNTS).reduce((sum, value) => sum + value, 0),
    945,
  )
  assert.equal(report.summary.FINAL_COUNTS.POSTGRES_CORE, 4)
  assert.equal(report.summary.FINAL_COUNTS.PRIOR_FROZEN_DECLARATIONS, 134)
  const covered = (key) => new Set(report.remainingEvidenceRegister.flatMap((row) => row[key]))
  for (const row of report.sourceCeilingPrerequisiteReconciliation.filter(
    (row) => row.FINAL_DISPOSITION === 'SOURCE_CEILING_REMAINS',
  ))
    assert.ok(covered('AFFECTED_PREREQUISITE_IDS').has(row.PREREQUISITE_ID))
  for (const row of report.opaqueBindingReconciliation)
    assert.ok(covered('AFFECTED_OPAQUE_BINDING_IDS').has(row.OPAQUE_BINDING_ID))
  for (const row of report.orderingReconciliation)
    assert.ok(covered('AFFECTED_ORDERING_RECORD_IDS').has(row.ORDERING_RECORD_ID))
  for (const row of report.sourceCeilingPrerequisiteReconciliation.filter(
    (row) => row.FINAL_DISPOSITION !== 'SOURCE_CEILING_REMAINS',
  )) {
    assert.equal(row.KIND, 'EXTENSION')
    assert.equal(row.FINAL_DISPOSITION, 'RESOLVED_BY_PLATFORM_BASELINE')
    assert.ok(row.OPERATIONAL_SOURCE_EVIDENCE.length)
    assert.equal(row.RUNTIME_PRESENCE_PROVEN, 'NO')
  }
  for (const row of sources.values())
    assert.equal(
      hash(readFileSync(absolute(row.FILE))),
      row.SHA256,
      `FAIL_EVIDENCE_DRIFT: ${row.FILE}`,
    )
  for (const row of report.frozenMigrationManifest)
    assert.equal(
      hash(readFileSync(absolute(row.FILE))),
      row.SHA256,
      `FAIL_EVIDENCE_DRIFT: ${row.FILE}`,
    )
  assert.deepEqual(report.catalogQuarantine, a1d.catalogQuarantine)
  assert.deepEqual(report.carryForward, a1d.carryForward)
  assert.equal(report.phaseStatus.PHASE_1B_3C_A1E_GATE, 'SOURCE_CEILING')
  assert.equal(report.phaseStatus.NO_FURTHER_BOOTSTRAP_STATIC_SOURCE_PASS, 'YES')
  for (const key of [
    'PHASE_1B_3C_A1G_STARTED',
    'PHASE_1B_3C_A1R_STARTED',
    'PHASE_1B_3C_A2_STARTED',
    'PHASE_1B_3C_B_STARTED',
  ])
    assert.equal(report.phaseStatus[key], 'NO')
  readPredecessors()
}
function markdown(report) {
  return `# Phase 1B.3C-A1E - Operational bootstrap binding closure

## Gate and authorization

\`PHASE_1B_3C_A1E_GATE = SOURCE_CEILING\`.
\`PHASE_1B_3C_A1E = SOURCE_CEILING_ACCEPTED\`.
\`BOOTSTRAP_OPERATIONAL_EVIDENCE = CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS\`.
\`NO_FURTHER_BOOTSTRAP_STATIC_SOURCE_PASS = YES\`.

Canonical bootstrap contract remains **NOT_ESTABLISHED**. No candidate is recommended for adoption. A1G, A1R, A2 and B3C-B remain **NOT_AUTHORIZED**, unstarted. B3B remains SOURCE_CEILING_ACCEPTED; static RLS model CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS; runtime packet 3,124, readiness 0, production schema/tenant isolation/product readiness unproven. No database, migration, schema, policy, deployment, environment or application changes.

## Physical binding and topology

**ESTABLISHED_SAME_TARGET**, narrowly for the deployment Django migration job and targeted scoped rollout: both select the same plan-selected Key Vault and fixed migration-admin secret reference. No values are compared or accessed. The disposable fresh-build also explicitly composes one conn/dbName into Django PG* and the scoped PostgreSQL client.

This is **not** full 23-file clean replay, deployed runtime target equality, financial scope binding, or role/search_path authority. The deployment uses an existing-environment targeted scoped 0005 job; the Django migration job is separate and gates deployment. Django runtime starts Gunicorn without migrate. Frontend runtime URL-to-Django PG* translation exists, with fallback discrete wiring; migration-admin versus runtime target equality remains unproven.

The fresh-build's executable order is Django then extensions/scoped, despite its comment advertising extensions first; it omits platform and financial migration execution and requires preexisting runtime roles. It is binding evidence, not an adoptable complete sequence.

## Complete Django operational graph

${report.djangoOperationalGraph.SUMMARY.DJANGO_CONFIGURED_APPS} configured apps = ${report.djangoOperationalGraph.SUMMARY.LOCAL_APPS} local + ${report.djangoOperationalGraph.SUMMARY.FRAMEWORK_APPS} framework + ${report.djangoOperationalGraph.SUMMARY.THIRD_PARTY_APPS} third-party + ${report.djangoOperationalGraph.SUMMARY.MIGRATIONS_DISABLED_APPS} explicitly migrations-disabled + ${report.djangoOperationalGraph.SUMMARY.SOURCE_CEILING_APPS} source-ceiling app.

Default manage.py/wsgi/asgi wiring selects config.settings.py, not the nested template base.py (no settings package initializer). All 29 local records and 26 literal edges are retained without execution. Requirements are ranges, not exact package pins; no contributed migration graph or migrationless package proof is invented. The configured apps namespace and four raw/generated-operation obligations remain unclosed. **COMPLETE_DJANGO_MIGRATION_PLAN = SOURCE_CEILING**; all 16 predecessor broader closure obligations remain.

## Financial materialization authority

**SOURCE_CEILING**. Package start/dev instantiate the service, not a schema materializer. Manual run-migrations.ts references three absent files under database/migrations and skips absent/erroring inputs. Partial add/repair scripts do not supply full-scope canonical authority. Frozen financial SQL remains comment-only and is not promoted. Scope is not merged with UE.

## Role, extension, type and function authority

The two runtime roles have an explicit standalone creator, but provisioning target/order is not composed into the full frozen bootstrap. Their disposition is RUNTIME_MANUAL_PREREQUISITE, not proof of deployed creation.

Four mandatory extensions (uuid-ossp, pgcrypto, pg_trgm, btree_gin) have explicit fail-fast, same-client installation before all frozen UE consumers through the bootstrap/shared executor. Their **static installer authority** is resolved by platform baseline; server availability, privilege and actual installation still need controlled environment proof. Vector is optional in the installer but downstream guarded use is not established, so remains SOURCE_CEILING.

All ${report.typeFunctionAuthority.length} currently ceilinged type/function identities retain their candidate evidence and explicit operational-authority ceilings. Historical, declaration, test-only and partial producers are not promoted.

## Exact reconciliation

- Ordering: **86 = 0 preconsumer prerequisites established + 0 proven true ordering conflicts + 86 source ceilings**. Frozen order unchanged; lack of a baseline is not proof of impossibility.
- Opaque: **118 = 0 physical-target resolved + 0 runtime-contract resolved + 0 not relevant + 118 source ceilings**. Exact predecessor IDs and consumers preserved.
- Prior prerequisite ceilings: **807 = 4 platform-baseline installer authorities resolved + 803 source ceilings remain**. All six other resolution/exemption classes are zero.
- Final model: **945 = 4 PostgreSQL core + 134 prior-frozen declarations + 4 platform-baseline resolutions + 803 remaining ceilings**. Unique IDs 945; unaccounted 0; authority conflicts 0. Static declarations/installer authority are not runtime presence proof.

## Four-candidate reevaluation

${report.bootstrapCandidateReevaluation.map((row) => `- **${row.STRATEGY}**: NOT ADOPTABLE. Same-target binding evidence added, but complete configured graph, exact preconsumer baseline, financial authority and opaque obligations remain. Snapshot strategy additionally lacks pinned provenance/replay compatibility; cleanroom remains disqualified.`).join('\n')}

## Remaining governance/runtime evidence packet

The JSON [exact ledgers](${output}.json) contain one entry per residual prerequisite and preserve every opaque/ordering linkage, plus external-package and raw-operation gaps. Categories are GOVERNANCE_DECISION_REQUIRED, RUNTIME_ENVIRONMENT_EVIDENCE_REQUIRED, EXTERNAL_PACKAGE_RUNTIME_EVIDENCE_REQUIRED and MISSING_REPOSITORY_AUTHORITY.

Required next evidence: approved full-scope target/role/search_path/sequence and initial-state contract; exact external package migration graphs and swappable/migrationless-app proof; raw/generated physical dependencies; authoritative preconsumer object/column/type baseline; complete fail-fast financial manifest; controlled role/extension environment evidence; each of the 118 dynamic/ACL/semantic target contracts. If snapshot strategy is selected, pin provenance/version/migration level and object/policy digests and reconcile baselining with exact frozen replay.

**No further generic static bootstrap source pass is authorized.** This packet identifies prerequisites, not permission to execute them or adopt a contract.

## Source scope and validation

${report.metadata.SOURCE_INVENTORY.length} byte-digested operational/configuration sources; actual environment files, secret values/stores and product/business dependencies excluded. CI/CD YAML, package scripts, container topology, settings, requirements, IaC, runbooks and directly referenced bootstrap files inspected as syntax only.

Validation commands (run separately; generation does not assert external audit success):

\`\`\`powershell
python scripts\\ue\\read-operational-django-config.py --self-test
node scripts\\ue\\read-operational-bootstrap-sources.mjs --self-test
node --check scripts\\ue\\reconcile-operational-bootstrap-bindings.mjs
node scripts\\ue\\reconcile-operational-bootstrap-bindings.mjs --self-test
node scripts\\ue\\reconcile-operational-bootstrap-bindings.mjs
node scripts\\ue\\reconcile-operational-bootstrap-bindings.mjs --check
pnpm exec prettier --check scripts\\ue\\reconcile-operational-bootstrap-bindings.mjs scripts\\ue\\read-operational-bootstrap-sources.mjs docs\\union-eyes\\reality-remediation\\${output}.json docs\\union-eyes\\reality-remediation\\${output}.md
pnpm validate:docs
\`\`\`

Five predecessor hashes, 23 migration hashes, prerequisite graph, exact 945/807/118/86 IDs, Django 29/26 records and quarantined C-A evidence are preserved. No canonical contract, replay mode, governance adoption, tenant-isolation tests or PR.
`
}
validate(result)
const args = process.argv.slice(2)
assert.ok(
  args.length <= 1 && (!args.length || ['--check', '--self-test'].includes(args[0])),
  'Only generation, --check or --self-test is allowed',
)
if (args[0] === '--self-test') {
  parserSelfTest()
  const pythonTest = spawnSync(
    'python',
    [absolute('scripts/ue/read-operational-django-config.py'), '--self-test'],
    { encoding: 'utf8', timeout: 30000 },
  )
  if (pythonTest.error) throw pythonTest.error
  assert.equal(pythonTest.status, 0, 'Django syntax parser self-test failed')
  const duplicate = structuredClone(result)
  duplicate.finalPrerequisiteModel[1] = duplicate.finalPrerequisiteModel[0]
  assert.throws(() => validate(duplicate))
  const lostOpaque = structuredClone(result)
  lostOpaque.opaqueBindingReconciliation.pop()
  assert.throws(() => validate(lostOpaque))
  console.log(
    'PASS: five frozen inputs; exact 945/807/118/86 accounting; 29/26 Django preservation; no evidence loss; authority-only resolution and authorization boundaries.',
  )
} else {
  const config = await resolveConfig(script)
  const json = await format(JSON.stringify(result), { ...config, parser: 'json' })
  const md = await format(markdown(result), { ...config, parser: 'markdown' })
  for (const [extension, content] of [
    ['json', json],
    ['md', md],
  ]) {
    const file = absolute(`${base}${output}.${extension}`)
    if (args[0] === '--check')
      assert.equal(readFileSync(file, 'utf8'), content, `Generated ${extension} drift`)
    else writeFileSync(file, content)
  }
  console.log(
    JSON.stringify({ GATE: result.phaseStatus.PHASE_1B_3C_A1E_GATE, ...summary }, null, 2),
  )
}
