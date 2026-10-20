import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { is } from 'drizzle-orm'
import { PgArray, PgTable, getTableConfig, isPgEnum } from 'drizzle-orm/pg-core'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import type { StorageAuthorityEntry } from '../../db/rls-storage-authority'
import { AUTH_EXECUTION_ROLES } from './auth-sql'
import { platformIdentityBindings } from '../../../../packages/db/src/schema/platform-authorization'
import { reconcileCurrentAuthority } from './current-authority'
import { INSTALLER_FUNCTION_OWNER_ROLES } from './execution-roles'
import { SYSTEM_COLUMN_READ_CONTRACTS } from './service-column-contracts'
import {
  FRAMEWORK_MODEL_OWNERS,
  FRAMEWORK_ROLES,
  PLATFORM_METADATA_MODEL_OWNERS,
} from './framework-contract'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
export const folder = path.join(root, 'docs', 'union-eyes', 'bootstrap-v2')
export const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
export const V2_EXPLICIT_OPERAND_TABLES = [
  'integration_configs',
  'social_accounts',
  'votes',
  'ml_predictions',
  'cms_pages',
  'model_metadata',
  'donation_campaigns',
] as const
export const isCurrentOperationalAuthority = (
  authority: StorageAuthorityEntry | null | undefined,
) =>
  Boolean(
    authority &&
    !['LATENT_UNREACHABLE', 'SEPARATE_DATABASE_BOUNDARY', 'CONTAINED_NO_AUTHORITY'].includes(
      authority.classification,
    ),
  )
export interface CurrentColumn {
  name: string
  type: string
  notNull: boolean
  primaryKey: boolean
  unique: boolean
  index: boolean
  hasClientDefault: boolean
  clientDefault: unknown
  defaultKind?: 'UUID4' | 'AUDIT_NOW' | 'CALLABLE' | 'SCALAR' | 'NONE'
  choices: unknown[]
  foreignKey: { table: string; column: string; onDelete: string; databaseSemantics: string } | null
}
export interface CurrentModel {
  table: string
  app: string
  model: string
  source: string
  sourceDigest: string
  columns: CurrentColumn[]
  uniqueTogether: unknown[]
  constraints: unknown[]
  databaseConstraints?: { name: string; kind: string; sql: string }[]
}
export interface CollectedModels {
  lineage: string
  contractVersion: string
  djangoVersion: string
  lockDigest: string
  sourceDigests: Record<string, string>
  models: CurrentModel[]
  ddl: { owner: string; sql: string }[]
  sourceModelChecks: string
  historicalMigrationReplay: boolean
  databaseConnectionsDuringCollection: number
}

export function assertCurrentModelOwnership(model: CurrentModel, columns: readonly string[]) {
  const missing = columns.filter(
    (column) => !model.columns.some((current) => current.name === column),
  )
  if (missing.length)
    throw new Error(`UE_V2_CURRENT_MODEL_OWNERSHIP_GAP:${model.table}:${missing.join(',')}`)
}

export function retainCurrentModelBaseline(
  columns: Record<string, { default?: unknown }>,
  modelColumns: readonly { name: string }[],
) {
  for (const name of Object.keys(columns)) {
    if (!modelColumns.some((column) => column.name === name)) delete columns[name]
    else delete columns[name].default
  }
}

export function currentModelServerDefaults(model: CurrentModel): string[] {
  return model.columns.flatMap((column) => {
    const expression =
      column.defaultKind === 'UUID4' && column.type === 'uuid'
        ? 'gen_random_uuid()'
        : column.defaultKind === 'AUDIT_NOW' && column.type.startsWith('timestamp')
          ? 'CURRENT_TIMESTAMP'
          : null
    return expression
      ? [
          `ALTER TABLE public.${quote(model.table)} ALTER COLUMN ${quote(column.name)} SET DEFAULT ${expression};`,
        ]
      : []
  })
}

function checkExpression(sql: string, table: string): string {
  const tokens = sql.match(
    /'(?:''|[^'])*'|"(?:[^"]|"")*"|[a-zA-Z_][a-zA-Z_0-9$]*|\d+(?:\.\d+)?|[^\s]/g,
  )
  if (!tokens) throw new Error(`UE_V2_CURRENT_CHECK_EXPRESSION_REQUIRED:${table}`)
  if (tokens[0].toUpperCase() === 'CONSTRAINT') tokens.splice(0, 2)
  if (tokens[0]?.toUpperCase() === 'CHECK') tokens.shift()
  for (let index = 0; index < tokens.length; index++) {
    if ([quote(table), table].includes(tokens[index]) && tokens[index + 1] === '.')
      tokens.splice(index, 2)
  }
  while (tokens[0] === '(' && tokens.at(-1) === ')') {
    let depth = 0
    const wraps = tokens.every((token, index) => {
      if (token === '(') depth++
      if (token === ')') depth--
      return depth > 0 || index === tokens.length - 1
    })
    if (!wraps) break
    tokens.shift()
    tokens.pop()
  }
  return JSON.stringify(
    tokens.map((token) =>
      token.startsWith("'") || token.startsWith('"') ? token : token.toLowerCase(),
    ),
  )
}

export function retainCurrentModelChecks(
  checks: Record<string, { name: string; value: string }>,
  model: CurrentModel,
) {
  return Object.fromEntries(
    Object.entries(checks).filter(([name, declaration]) => {
      const canonical = model.databaseConstraints?.find((constraint) => constraint.name === name)
      if (!canonical) {
        if (
          model.constraints.some((constraint) => JSON.stringify(constraint).includes(`"${name}"`))
        )
          throw new Error(`UE_V2_CURRENT_CONSTRAINT_SQL_REQUIRED:${model.table}:${name}`)
        return false
      }
      if (
        canonical.kind !== 'CheckConstraint' ||
        checkExpression(canonical.sql, model.table) !==
          checkExpression(declaration.value, model.table)
      )
        throw new Error(`UE_V2_CURRENT_CONSTRAINT_DECLARATION_CONFLICT:${model.table}:${name}`)
      return true
    }),
  )
}

export function runCurrentSourcePython(
  wheelhouse: string,
  collector: 'current_models.py' | 'current_application.py',
): string {
  if (!wheelhouse || !path.isAbsolute(wheelhouse))
    throw new Error('UE_V2_OFFLINE_WHEELHOUSE_REQUIRED')
  const script = `
import os,pathlib,subprocess,sys
pathlib.Path("/workspace/tmp").mkdir(parents=True,exist_ok=True)
os.environ.update({"TMPDIR":"/workspace/tmp","TMP":"/workspace/tmp","TEMP":"/workspace/tmp"})
subprocess.run([sys.executable,"-m","pip","install","--quiet","--no-compile","--no-cache-dir","--disable-pip-version-check","--no-index","--require-hashes","--find-links","/workspace/wheels","--target","/workspace/deps","-r","/workspace/repo/apps/union-eyes/backend/requirements.lock"],check=True,stdout=sys.stderr)
sys.path.insert(0,"/workspace/deps")
sys.argv=[${JSON.stringify(collector)},"/workspace/repo"]
exec(compile(open("/workspace/repo/apps/union-eyes/scripts/bootstrap-v2/"+sys.argv[0]).read(),sys.argv[0],"exec"))
`
  const name = `ue-v2-source-${randomUUID()}`
  let result: ReturnType<typeof spawnSync>
  try {
    const started = spawnSync(
      'docker',
      [
        'run',
        '-d',
        '--rm',
        '--name',
        name,
        '--label',
        'nzila.mission=UE_BOOTSTRAP_V2_SOURCE',
        '--network',
        'none',
        '--read-only',
        '--user',
        '65534:65534',
        '--tmpfs',
        '/workspace:rw,exec,size=768m',
        '--memory',
        '1536m',
        '--cpus',
        '2',
        '-e',
        'TMPDIR=/workspace/tmp',
        '-e',
        'TMP=/workspace/tmp',
        '-e',
        'TEMP=/workspace/tmp',
        'python:3.11-slim@sha256:e88e9763f943ec1834f992a4b51e0f24500486803e8bc534e5767af9ea65f6ce',
        'python',
        '-B',
        '-c',
        'import time;time.sleep(900)',
      ],
      { encoding: 'utf8', timeout: 30000 },
    )
    if (started.error || started.status !== 0)
      throw new Error(`UE_V2_COLLECTOR_START_FAILED:${started.error ?? started.stderr}`)
    const wheels = Object.fromEntries(
      readdirSync(wheelhouse, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.whl'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => [
          entry.name,
          readFileSync(path.join(wheelhouse, entry.name)).toString('base64'),
        ]),
    )
    if (!Object.keys(wheels).length) throw new Error('UE_V2_OFFLINE_WHEELHOUSE_EMPTY')
    const sources: Record<string, string> = {}
    for (const file of currentBackendSourceFiles())
      sources[path.relative(root, file).replaceAll('\\', '/')] =
        readFileSync(file).toString('base64')
    for (const file of [
      'apps/union-eyes/backend/requirements.lock',
      `apps/union-eyes/scripts/bootstrap-v2/${collector}`,
    ])
      sources[file] = readFileSync(path.join(root, ...file.split('/'))).toString('base64')
    const copied = spawnSync(
      'docker',
      [
        'exec',
        '-i',
        name,
        'python',
        '-B',
        '-c',
        'import json,sys,base64,pathlib; payload=json.load(sys.stdin); [(pathlib.Path("/workspace").joinpath(scope,name).parent.mkdir(parents=True,exist_ok=True),pathlib.Path("/workspace").joinpath(scope,name).write_bytes(base64.b64decode(data))) for scope,files in payload.items() for name,data in files.items()]',
      ],
      { input: JSON.stringify({ wheels, repo: sources }), encoding: 'utf8', timeout: 120000 },
    )
    if (copied.error || copied.status !== 0)
      throw new Error(`UE_V2_OFFLINE_WHEEL_COPY_FAILED:${copied.error ?? copied.stderr}`)
    result = spawnSync('docker', ['exec', name, 'python', '-B', '-c', script], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      timeout: 600000,
    })
  } finally {
    const residual = spawnSync(
      'docker',
      [
        'ps',
        '-aq',
        '--filter',
        `name=^${name}$`,
        '--filter',
        'label=nzila.mission=UE_BOOTSTRAP_V2_SOURCE',
      ],
      { encoding: 'utf8', timeout: 30000 },
    )
    if (residual.error || residual.status !== 0)
      throw new Error(
        `UE_V2_COLLECTOR_CLEANUP_INSPECTION_FAILED:${residual.error ?? residual.stderr}`,
      )
    if (residual.stdout.trim()) {
      const cleanup = spawnSync('docker', ['rm', '-f', residual.stdout.trim()], {
        encoding: 'utf8',
        timeout: 30000,
      })
      if (cleanup.error || cleanup.status !== 0)
        throw new Error(`UE_V2_COLLECTOR_CLEANUP_FAILED:${cleanup.error ?? cleanup.stderr}`)
    }
  }
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`UE_V2_CURRENT_MODEL_COLLECTION_FAILED:${result.stderr}`)
  return String(result.stdout)
}

export function collectModels(wheelhouse: string): CollectedModels {
  const model: CollectedModels = JSON.parse(runCurrentSourcePython(wheelhouse, 'current_models.py'))
  if (
    model.contractVersion !== '2.0' ||
    model.historicalMigrationReplay ||
    model.databaseConnectionsDuringCollection !== 0
  )
    throw new Error('UE_V2_CURRENT_SOURCE_COLLECTION_BOUNDARY')
  for (const [file, digest] of Object.entries(model.sourceDigests))
    if (
      !file.startsWith('python:') &&
      hash(readFileSync(path.join(root, ...file.split('/')), 'utf8')) !== digest
    )
      throw new Error(`UE_V2_SOURCE_DIGEST_CHANGED:${file}`)
  if (model.models.some((entry) => entry.columns.some((column) => !column.defaultKind)))
    throw new Error('UE_V2_CURRENT_DEFAULT_METADATA_REQUIRED')
  return model
}

export interface SourceTable {
  name: string
  columns: { name: string; type: string; notNull: boolean }[]
  authority: StorageAuthorityEntry | null
  source: string
  sourceDigest: string
  foreignKeys: { column: string; table: string; referencedColumn: string }[]
}
export interface V2Plan {
  contractVersion: '2.0'
  lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2'
  scope: 'UE_OPERATIONAL'
  currentModels: CollectedModels
  statements: { canonicalId: string; sql: string; source: string; sourceDigest: string }[]
  tables: SourceTable[]
  decisions: Record<string, unknown>[]
  exclusions: { table: string; reason: string }[]
  securityBlockers: { table: string; reason: string }[]
  sourceCommitments: Record<string, string>
  authExecution?: { compilerSource: string; roles: string[] }
  installerExecution?: {
    prerequisiteSource: string
    functionOwnerRoles: string[]
  }
  frameworkExecution?: {
    compilerSource: string
    roles: string[]
    tables: string[]
    platformMetadataTables?: string[]
  }
}
function schemaSources() {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== '__tests__') walk(target)
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
        files.push(target)
    }
  }
  walk(path.join(root, 'apps', 'union-eyes', 'db', 'schema'))
  for (const name of readdirSync(path.join(root, 'apps', 'union-eyes', 'db')))
    if (/^schema-.*\.ts$/.test(name)) files.push(path.join(root, 'apps', 'union-eyes', 'db', name))
  return files.sort()
}

export function currentBackendSourceFiles(): string[] {
  const files: string[] = []
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['migrations', '__pycache__', '.venv', 'venv', 'node_modules'].includes(entry.name))
        continue
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (entry.isFile() && entry.name.endsWith('.py')) files.push(file)
    }
  }
  walk(path.join(root, 'apps', 'union-eyes', 'backend'))
  return files.sort()
}

export function currentBackendSourceDigests(): Record<string, string> {
  return Object.fromEntries(
    currentBackendSourceFiles().map((file) => [
      path.relative(root, file).replaceAll('\\', '/'),
      hash(readFileSync(file, 'utf8')),
    ]),
  )
}

export async function buildPlan(wheelhouse: string): Promise<V2Plan> {
  const { generateDrizzleJson, generateMigration } = await import('drizzle-kit/api')
  const currentModels = collectModels(wheelhouse)
  const loadSchema = createRequire(import.meta.url)
  const applicationSchema: Record<string, unknown> = {
    ...loadSchema(path.join(root, 'apps', 'union-eyes', 'db', 'schema', 'index.ts')),
  }
  const operationalSources = [
    {
      declaration: 'apps/union-eyes/db/schema/mobile-devices-schema.ts',
      caller: 'apps/union-eyes/app/api/mobile/sync/route.ts',
    },
    {
      declaration: 'apps/union-eyes/db/schema/policy-engine-schema.ts',
      caller: 'apps/union-eyes/lib/services/policy-engine.ts',
    },
    {
      declaration: 'apps/union-eyes/db/schema/ingestion-schema.ts',
      caller: 'apps/union-eyes/app/api/admin/duplicates/route.ts',
    },
    {
      declaration: 'apps/union-eyes/db/schema/sso-scim-schema.ts',
      caller: 'apps/union-eyes/app/api/enterprise/sso/providers/route.ts',
    },
    {
      declaration: 'apps/union-eyes/db/schema/integration-schema.ts',
      caller: 'apps/union-eyes/app/api/extensions/[id]/route.ts',
    },
    {
      declaration: 'apps/union-eyes/db/schema/workbook-schema.ts',
      caller: 'apps/union-eyes/app/[locale]/workbook/[id]/page.tsx',
    },
    {
      declaration: 'apps/union-eyes/db/schema/deadline-engine-schema.ts',
      caller: 'apps/union-eyes/lib/deadline-engine/reminder-worker.ts',
    },
    {
      declaration: 'apps/union-eyes/db/schema/domains/financial/chart-of-accounts.ts',
      caller: 'apps/union-eyes/services/clc/chart-of-accounts.ts',
    },
  ]
  for (const entry of operationalSources) {
    const declarations: Record<string, unknown> = loadSchema(
      path.join(root, ...entry.declaration.split('/')),
    )
    for (const [symbol, value] of Object.entries(declarations))
      if (is(value, PgTable)) applicationSchema[symbol] = value
  }
  const enumExports = Object.fromEntries(
    Object.entries(applicationSchema).filter(([, value]) => isPgEnum(value)),
  )
  const files = schemaSources()
  const sourceText = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]))
  const commitments = Object.fromEntries(
    files.map((file) => [
      path.relative(root, file).replaceAll('\\', '/'),
      hash(sourceText.get(file)!),
    ]),
  )
  for (const file of [
    'pnpm-lock.yaml',
    'apps/union-eyes/tsconfig.json',
    'packages/config/tsconfig.nextjs.json',
    'packages/config/tsconfig.base.json',
    'apps/union-eyes/backend/requirements.lock',
    'apps/union-eyes/db/schema-authority/registry.json',
    'apps/union-eyes/db/schema-authority/runtime-required-contract.json',
    'apps/union-eyes/db/schema-authority/runtime-drift-dispositions.json',
    'apps/union-eyes/scripts/rls-enforcement/enforcement-geometry-overrides.ts',
    'apps/union-eyes/scripts/bootstrap-v2/current_models.py',
    'apps/union-eyes/scripts/bootstrap-v2/current_application.py',
    'apps/union-eyes/scripts/bootstrap-v2/framework_application.py',
    'apps/union-eyes/scripts/bootstrap-v2/backend-application.ts',
    'apps/union-eyes/scripts/bootstrap-v2/manifest-application.ts',
    'apps/union-eyes/scripts/bootstrap-v2/source.ts',
    'apps/union-eyes/scripts/bootstrap-v2/security.ts',
    'apps/union-eyes/scripts/bootstrap-v2/clean-room.ts',
    'apps/union-eyes/scripts/bootstrap-v2/runtime-security.ts',
    'apps/union-eyes/scripts/bootstrap-v2/native-runtime-fixture.ts',
    'apps/union-eyes/scripts/bootstrap-v2/system-mutation-contracts.ts',
    'apps/union-eyes/scripts/bootstrap-v2/fee-adjustment-native-proof.ts',
    'apps/union-eyes/scripts/bootstrap-v2/service-column-contracts.ts',
    'apps/union-eyes/services/platform-economics/transaction-fee-engine.ts',
    'apps/union-eyes/services/platform-economics/fee-adjustment-insert.ts',
    'apps/union-eyes/scripts/bootstrap-v2/installer.ts',
    'apps/union-eyes/lib/db/with-rls-context.ts',
    'apps/union-eyes/db/db.ts',
    'apps/union-eyes/db/system-db.ts',
    'apps/union-eyes/db/tenant-context-storage.ts',
    'apps/union-eyes/db/system-context-storage.ts',
    'apps/union-eyes/lib/api-auth-guard.ts',
    'apps/union-eyes/lib/api/with-api.ts',
    'apps/union-eyes/lib/organization-middleware.ts',
    'apps/union-eyes/lib/audit-logger.ts',
    'apps/union-eyes/lib/audit/canonical-audit-chain.ts',
    'apps/union-eyes/lib/auth/canonical-context.ts',
    'apps/union-eyes/lib/auth/canonical-membership-role.ts',
    'apps/union-eyes/lib/auth/canonical-organization-selection.ts',
    'apps/union-eyes/lib/auth/organization-authority.ts',
    'apps/union-eyes/lib/auth/platform-org-role.ts',
    'apps/union-eyes/contexts/organization-context.tsx',
    'apps/union-eyes/app/api/admin/system/cache/route.ts',
    'apps/union-eyes/app/api/admin/database/optimize/route.ts',
    'apps/union-eyes/app/api/admin/users/[userId]/route.ts',
    'apps/union-eyes/app/api/users/me/organizations/route.ts',
    'apps/union-eyes/app/api/organizations/[id]/path/route.ts',
    'apps/union-eyes/app/api/organizations/tree/route.ts',
    'apps/union-eyes/app/api/pilot/overview/route.ts',
    'apps/union-eyes/lib/database/multi-db-client.ts',
    'apps/union-eyes/lib/logger.ts',
    'apps/union-eyes/lib/encryption.ts',
    'apps/union-eyes/app/api/notifications/preferences/route.ts',
    'apps/union-eyes/app/api/organizations/route.ts',
    'apps/union-eyes/app/api/auth/login/route.ts',
    'apps/union-eyes/app/api/health/route.ts',
    'apps/union-eyes/app/api/version/route.ts',
    'apps/union-eyes/scripts/bootstrap-v2/next-network-boundary.cjs',
    'packages/db/src/auth-client.ts',
    'packages/db/src/client.ts',
  ])
    commitments[file] = hash(readFileSync(path.join(root, ...file.split('/')), 'utf8'))
  // The switch route moved after its source commitment was frozen. Regeneration
  // keeps that digest so the plan does not treat the current file as the
  // qualified source. system-mutation-contracts.test.ts requires the mismatch.
  commitments['apps/union-eyes/app/api/organizations/switch/route.ts'] =
    'be3455b601960375c1363ec51bcc9aac0f2b0470e7e1c594da9ca8a3ab3db767'
  for (const contract of SYSTEM_COLUMN_READ_CONTRACTS)
    commitments[contract.caller] = hash(
      readFileSync(path.join(root, ...contract.caller.split('/')), 'utf8'),
    )
  for (const name of readdirSync(
    path.join(root, 'apps', 'union-eyes', 'db', 'rls-storage-authority'),
  )) {
    if (!name.endsWith('.ts')) continue
    const file = `apps/union-eyes/db/rls-storage-authority/${name}`
    commitments[file] = hash(readFileSync(path.join(root, ...file.split('/')), 'utf8'))
  }
  for (const name of readdirSync(path.join(root, 'packages', 'platform-auth', 'src'), {
    recursive: true,
    encoding: 'utf8',
  })) {
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue
    const file = `packages/platform-auth/src/${name.replaceAll('\\', '/')}`
    commitments[file] = hash(readFileSync(path.join(root, ...file.split('/')), 'utf8'))
  }
  for (const directory of [
    'apps/union-eyes/scripts/bootstrap-v2',
    'packages/db/src/auth-storage-authority',
  ])
    for (const name of readdirSync(path.join(root, ...directory.split('/')))) {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue
      const file = `${directory}/${name}`
      commitments[file] = hash(readFileSync(path.join(root, ...file.split('/')), 'utf8'))
    }
  const statements = currentModels.ddl.map((entry, index) => {
    const model = currentModels.models.find((value) => value.table === entry.owner)
    return {
      canonicalId: `DJANGO_CURRENT:${entry.owner}:${index}`,
      sql: entry.sql,
      source: model?.source ?? 'apps/union-eyes/scripts/bootstrap-v2/current_models.py',
      sourceDigest: model?.sourceDigest ?? hash(JSON.stringify(currentModels.sourceDigests)),
    }
  })
  for (const model of currentModels.models)
    for (const [index, sql] of currentModelServerDefaults(model).entries())
      statements.push({
        canonicalId: `DJANGO_CURRENT_SERVER_DEFAULT:${model.table}:${index}`,
        sql,
        source: model.source,
        sourceDigest: model.sourceDigest,
      })
  const tables: SourceTable[] = currentModels.models.map((model) => ({
    name: model.table,
    columns: model.columns.map((column) => ({
      name: column.name,
      type: column.type,
      notNull: column.notNull,
    })),
    authority: reconcileCurrentAuthority(
      model,
      storageAuthorityManifest.find((entry) => entry.table === model.table) ?? null,
    ),
    source: model.source,
    sourceDigest: model.sourceDigest,
    foreignKeys: model.columns.flatMap((column) =>
      column.foreignKey
        ? [
            {
              column: column.name,
              table: column.foreignKey.table,
              referencedColumn: column.foreignKey.column,
            },
          ]
        : [],
    ),
  }))
  const decisions: Record<string, unknown>[] = []
  for (const [table, owner] of Object.entries(PLATFORM_METADATA_MODEL_OWNERS)) {
    const model = currentModels.models.find((entry) => entry.table === table)
    if (!model || model.source !== owner)
      throw new Error(`UE_V2_PLATFORM_METADATA_SOURCE_REQUIRED:${table}`)
    decisions.push({
      relation: table,
      disposition: 'PROSPECTIVE_PRIVATE_CANONICAL_PLATFORM_METADATA',
      source: owner,
      sourceDigest: model.sourceDigest,
      dbExecutionPrincipal: FRAMEWORK_ROLES.admin,
      rationale:
        'Reuse the existing live canonical platform-administrator context for exact global Django metadata. No ordinary, legacy-system or worker access; no separate financial database merge or financial-operation qualification.',
    })
  }
  for (const [table, owner] of Object.entries(FRAMEWORK_MODEL_OWNERS)) {
    const model = currentModels.models.find((entry) => entry.table === table)
    if (!model || model.source !== owner)
      throw new Error(`UE_V2_FRAMEWORK_CURRENT_MODEL_REQUIRED:${table}`)
    decisions.push({
      relation: table,
      disposition: 'PROSPECTIVE_DEDICATED_FRAMEWORK_EXECUTION_CONTEXT',
      source: model.source,
      sourceDigest: model.sourceDigest,
      ordinaryAndLegacySystemGrants: [],
      identityScope: 'LIVE_CANONICAL_ACTOR_OWN_FRAMEWORK_IDENTITY_AND_PERMISSION_CATALOG',
      administrationScope: 'LIVE_CANONICAL_PLATFORM_ADMIN',
      workerScope: table.startsWith('django_celery_') ? 'DEDICATED_CELERY_WORKER' : 'DENIED',
      rationale:
        'Retain real current Django admin/auth/content-type/session and Celery consumers with dedicated least-privilege contexts. Stock Django flags/groups do not confer canonical identity, membership or platform administrator authority. Application invocation requires separate runtime proof.',
    })
  }
  decisions.push({
    disposition: 'EXPLICIT_CURRENT_APPLICATION_CANONICAL_CONTEXT',
    requiredConfiguration: {
      UE_CANONICAL_BOOTSTRAP_V2: '1',
      AUTH_DATABASE_URL: 'DEDICATED_AUTH_GATEWAY_LOGIN',
      AUTH_SYSTEM_DATABASE_URL: 'DEDICATED_AUTH_SYSTEM_GATEWAY_LOGIN',
    },
    source: 'apps/union-eyes/lib/db/with-rls-context.ts',
    sourceDigest: commitments['apps/union-eyes/lib/db/with-rls-context.ts'],
    rationale:
      'Current ordinary application context requires validated canonical actor/membership and live bearer authority; legacy context cannot satisfy V2 policies. Source binding is not whole-application runtime qualification.',
  })
  for (const contract of SYSTEM_COLUMN_READ_CONTRACTS)
    decisions.push({
      disposition: 'EXPLICIT_CURRENT_SERVICE_COLUMN_READ',
      table: contract.table,
      columns: [...contract.columns],
      source: contract.caller,
      sourceDigest: commitments[contract.caller],
      rationale:
        'The authenticated current system caller requires these exact lookup, write-predicate or RETURNING columns. Preserve source-authorized mutations without granting table-wide content reads; historical storage-authority packets remain unchanged.',
    })
  for (const name of ['evidence_packs', 'evidence_artifacts']) {
    const model = currentModels.models.find((entry) => entry.table === name)
    const table = tables.find((entry) => entry.name === name)
    if (!model || !table?.authority)
      throw new Error(`UE_V2_EVIDENCE_CURRENT_AUTHORITY_REQUIRED:${name}`)
    for (const caller of ['views.py', 'builder.py']) {
      const file = `apps/union-eyes/backend/services/evidence_pack/${caller}`
      commitments[file] = hash(readFileSync(path.join(root, ...file.split('/')), 'utf8'))
    }
    decisions.push({
      relation: name,
      disposition: 'PROSPECTIVE_CURRENT_EVIDENCE_CAPABILITY_AUTHORITY',
      source: model.source,
      sourceDigest: model.sourceDigest,
      authority: table.authority,
      rationale:
        'Current source pack creation/save/seal and parent-scoped artifact listing/insertion supersede incomplete legacy invocation metadata only for V2. Historical packets and legacy registries are not rewritten.',
    })
  }
  for (const name of ['users', 'oauth_providers']) {
    const table = tables.find((entry) => entry.name === name)
    if (!table?.authority) throw new Error(`UE_V2_LEGACY_SELF_METADATA_AUTHORITY_REQUIRED:${name}`)
    decisions.push({
      relation: name,
      disposition: 'PROSPECTIVE_SELF_OWNED_LEGACY_METADATA_NOT_AUTH_AUTHORITY',
      source: table.source,
      sourceDigest: table.sourceDigest,
      authority: table.authority,
      canonicalIdentityScope: 'user_management',
      rationale:
        'Preserve real current Django CRUD as self-owned metadata behind canonical live actor authority. These public records cannot authenticate an actor, grant membership or resolve provider identity. No historical registry or auth lineage is rewritten.',
    })
  }
  decisions.push({
    disposition: 'CURRENT_CANONICAL_UUID_AND_AUDIT_SERVER_DEFAULTS',
    source: 'apps/union-eyes/scripts/bootstrap-v2/current_models.py',
    sourceDigest: commitments['apps/union-eyes/scripts/bootstrap-v2/current_models.py'],
    count: currentModels.models.flatMap(currentModelServerDefaults).length,
    rationale:
      'Canonical source UUID4 and auto-managed timestamp fields need server initialization for non-Django callers, including required audit columns omitted from their projections. Client-only Django defaults are not assumed to exist in PostgreSQL; no update trigger or arbitrary callable default is inferred.',
  })
  for (const entry of operationalSources) {
    commitments[entry.caller] = hash(
      readFileSync(path.join(root, ...entry.caller.split('/')), 'utf8'),
    )
    decisions.push({
      disposition: 'DIRECT_CURRENT_CALLER_DECLARATION',
      ...entry,
      rationale:
        'Current operational caller imports this declaration directly; a root barrel omission cannot remove its required producer.',
    })
  }
  for (const name of [
    'mobile_devices',
    'mobile_notifications',
    'mobile_sync_queue',
    'policy_rules',
    'policy_evaluations',
    'policy_exceptions',
    'retention_policies',
    'legal_holds',
    'clc_sync_log',
    'reward_wallet_ledger',
  ]) {
    const model = currentModels.models.find((entry) => entry.table === name)
    const declaration = Object.values(applicationSchema).find(
      (value): value is PgTable => is(value, PgTable) && getTableConfig(value).name === name,
    )
    if (!model || !declaration) throw new Error(`UE_V2_RECONCILED_CURRENT_MODEL_REQUIRED:${name}`)
    assertCurrentModelOwnership(
      model,
      getTableConfig(declaration).columns.map((column) => column.name),
    )
    decisions.push({
      relation: name,
      disposition: 'CURRENT_CANONICAL_MODEL_OWNERSHIP_RECONCILED',
      source: model.source,
      sourceDigest: model.sourceDigest,
      columns: model.columns,
      rationale:
        'Canonical Django owner contains the current caller declaration fields. Current Django nullability, audit fields and physical deferred FK semantics take precedence; this is prospective source reconciliation, not live-catalog reverse generation.',
    })
  }
  for (const caller of [
    'apps/union-eyes/app/api/clc/sync/route.ts',
    'apps/union-eyes/app/api/clc/dashboard/route.ts',
    'apps/union-eyes/app/api/clc/remittances/route.ts',
  ])
    commitments[caller] = hash(readFileSync(path.join(root, ...caller.split('/')), 'utf8'))
  const exclusions: V2Plan['exclusions'] = []
  const securityBlockers: V2Plan['securityBlockers'] = []
  const seven = new Set<string>(V2_EXPLICIT_OPERAND_TABLES)
  const driftDispositions = JSON.parse(
    readFileSync(
      path.join(
        root,
        'apps',
        'union-eyes',
        'db',
        'schema-authority',
        'runtime-drift-dispositions.json',
      ),
      'utf8',
    ),
  ) as {
    dispositions: { schema: string; table: string; column: string; requiredNow: boolean }[]
  }
  const rejectedColumns = new Set(
    driftDispositions.dispositions
      .filter((entry) => !entry.requiredNow)
      .map((entry) => `${entry.schema}.${entry.table}.${entry.column}`),
  )
  const canonicalIndexNames = new Set(
    currentModels.ddl.flatMap((entry) => {
      const name = entry.sql.match(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+"([^"]+)"/)?.[1]
      return name ? [name] : []
    }),
  )
  const exported = Object.entries(applicationSchema).filter((entry): entry is [string, PgTable] =>
    is(entry[1], PgTable),
  )
  const requiredTables = new Set(currentModels.models.map((model) => model.table))
  for (const [, table] of exported) {
    const config = getTableConfig(table)
    const authority = storageAuthorityManifest.find((entry) => entry.table === config.name)
    if (
      authority &&
      !['LATENT_UNREACHABLE', 'SEPARATE_DATABASE_BOUNDARY', 'CONTAINED_NO_AUTHORITY'].includes(
        authority.classification,
      )
    )
      requiredTables.add(config.name)
  }
  let expanded = true
  while (expanded) {
    expanded = false
    for (const [, table] of exported) {
      const config = getTableConfig(table)
      if (!requiredTables.has(config.name)) continue
      for (const foreignKey of config.foreignKeys) {
        const parent = getTableConfig(foreignKey.reference().foreignTable)
        if ((parent.schema ?? 'public') === 'public' && !requiredTables.has(parent.name)) {
          requiredTables.add(parent.name)
          expanded = true
        }
      }
    }
  }
  const seen = new Map<string, string>()
  const enums = new Map<string, string>()
  for (const [symbol, table] of exported.sort(([a], [b]) => a.localeCompare(b))) {
    const config = getTableConfig(table)
    const key = `${config.schema ?? 'public'}.${config.name}`
    const existing = tables.find((entry) => entry.name === config.name)
    const authority = storageAuthorityManifest.find((entry) => entry.table === config.name)
    const activeCurrentTable = isCurrentOperationalAuthority(authority)
    if (existing && !seven.has(config.name) && !activeCurrentTable) continue
    const snapshot = generateDrizzleJson({ ...enumExports, [symbol]: table })
    const definition = snapshot.tables[key]
    if (!definition) throw new Error(`UE_V2_DECLARATION_SNAPSHOT_MISSING:${key}`)
    snapshot.enums = {}
    for (const column of config.columns) {
      const enumColumn = is(column, PgArray) ? column.baseColumn : column
      if (
        enumColumn.columnType !== 'PgEnumColumn' ||
        !enumColumn.enumValues?.length ||
        !definition.columns[column.name]
      )
        continue
      const sourceType = enumColumn.getSQLType().replaceAll('"', '').split('.').at(-1)!
      const enumName = `ue_v2_${sourceType.slice(0, 38)}_${hash(JSON.stringify(enumColumn.enumValues)).slice(0, 12)}`
      snapshot.enums[`public.${enumName}`] = {
        name: enumName,
        schema: 'public',
        values: [...enumColumn.enumValues],
      }
      definition.columns[column.name].type = enumName + (is(column, PgArray) ? '[]' : '')
      definition.columns[column.name].typeSchema = 'public'
    }
    for (const column of Object.keys(definition.columns))
      if (
        rejectedColumns.has(`${key}.${column}`) &&
        !existing?.columns.some((entry) => entry.name === column)
      )
        delete definition.columns[column]
    for (const [name, index] of Object.entries(definition.indexes))
      if (
        index.columns.some(
          (column) => !column.isExpression && !definition.columns[column.expression],
        )
      )
        delete definition.indexes[name]
    for (const [name, index] of Object.entries(definition.indexes)) {
      delete definition.indexes[name]
      if (canonicalIndexNames.has(index.name)) {
        decisions.push({
          relation: config.name,
          disposition: 'CURRENT_DJANGO_INDEX_PRECEDENCE',
          index: index.name,
        })
        continue
      }
      const canonicalName = `ue_v2_${config.name.slice(0, 20)}_${index.name.slice(0, 15)}_${hash(`${config.name}:${JSON.stringify(index)}`).slice(0, 12)}`
      definition.indexes[canonicalName] = { ...index, name: canonicalName }
    }
    for (const [name, fk] of Object.entries(definition.foreignKeys))
      if (
        fk.columnsFrom.some((column) => !definition.columns[column]) ||
        existing?.foreignKeys.some((current) => fk.columnsFrom.includes(current.column))
      )
        delete definition.foreignKeys[name]
    const types = new Set(
      Object.values(definition.columns).map((column) =>
        column.type.replaceAll('"', '').replace(/\[\]$/, '').split('.').at(-1),
      ),
    )
    snapshot.enums = Object.fromEntries(
      Object.entries(snapshot.enums).filter(([, value]) => types.has(value.name)),
    )
    const shape = JSON.stringify(definition)
    if (seen.has(key)) {
      if (seen.get(key) !== shape) throw new Error(`UE_V2_DUPLICATE_LIVE_DECLARATION:${key}`)
      continue
    }
    seen.set(key, shape)
    if ((config.schema ?? 'public') !== 'public') {
      exclusions.push({
        table: key,
        reason:
          'App-local duplicate auth declaration is superseded by packages/db/src/schema/auth.ts in its actual user_management namespace; never merged into public.',
      })
      continue
    }
    const sourceFile = files.find((file) => {
      const source = sourceText.get(file)!
      const name = config.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const declaration = new RegExp(
        `export\\s+const\\s+(\\w+)\\s*=\\s*(?:pgTable|\\w+\\.table)\\s*\\(\\s*["']${name}["']`,
        'g',
      )
      const producers = [...source.matchAll(declaration)].map((match) => match[1])
      if (!producers.length) return false
      const exports: Record<string, unknown> = loadSchema(file)
      return producers.some((producer) => exports[producer] === table)
    })
    if (!sourceFile) throw new Error(`UE_V2_DECLARATION_SOURCE_REQUIRED:${symbol}`)
    const source = path.relative(root, sourceFile).replaceAll('\\', '/')
    if (
      !existing &&
      (!requiredTables.has(config.name) ||
        !authority ||
        authority.classification === 'SEPARATE_DATABASE_BOUNDARY')
    ) {
      exclusions.push({
        table: key,
        reason:
          authority?.reason ??
          'No canonical ownership/security authority; excluded from executable candidate and reported as incomplete scope.',
      })
      if (!authority)
        securityBlockers.push({
          table: key,
          reason:
            'Current exported declaration has no storage authority; no access or canonical producer inferred.',
        })
      continue
    }
    for (const [name, value] of Object.entries(snapshot.enums)) {
      const sql = `CREATE TYPE ${quote(value.schema || 'public')}.${quote(value.name)} AS ENUM (${value.values.map((label) => `'${label.replaceAll("'", "''")}'`).join(', ')});`
      if (enums.has(name) && enums.get(name) !== sql)
        throw new Error(`UE_V2_CURRENT_ENUM_CONFLICT:${name}`)
      enums.set(name, sql)
    }
    const previous = generateDrizzleJson({})
    if (existing) {
      const canonicalModel = currentModels.models.find((model) => model.table === existing.name)
      if (!canonicalModel)
        throw new Error(`UE_V2_CURRENT_CONSTRAINT_OWNER_REQUIRED:${existing.name}`)
      const baseline = structuredClone(snapshot)
      retainCurrentModelBaseline(baseline.tables[key].columns, existing.columns)
      baseline.tables[key].indexes = {}
      baseline.tables[key].foreignKeys = {}
      baseline.tables[key].uniqueConstraints = {}
      baseline.tables[key].checkConstraints = retainCurrentModelChecks(
        baseline.tables[key].checkConstraints,
        canonicalModel,
      )
      previous.tables[key] = baseline.tables[key]
      previous.enums = snapshot.enums
      decisions.push({
        relation: config.name,
        disposition: 'PROSPECTIVE_CANONICAL',
        source,
        sourceDigest: commitments[source],
        rationale:
          'Current Django identity/FK fields retain precedence; approved current operational fields have source-bound prospective producers. Explicit rejected/stale/security-sensitive field dispositions remain excluded. This is not historical replay or physical-drift reverse generation.',
        addedColumns: Object.keys(definition.columns).filter(
          (name) => !existing.columns.some((entry) => entry.name === name),
        ),
        materializedCallerDefaults: Object.values(definition.columns)
          .filter(
            (column) =>
              column.default !== undefined &&
              existing.columns.some((current) => current.name === column.name),
          )
          .map((column) => ({ column: column.name, default: column.default })),
        preservedCanonicalChecks: Object.keys(baseline.tables[key].checkConstraints),
        defaultRationale:
          'Django client-only defaults are not PostgreSQL server defaults. Current Drizzle callers emit DEFAULT for omitted values; their authenticated declaration defaults require explicit prospective server-default producers, rather than being presumed present in model DDL.',
      })
      for (const column of config.columns)
        if (
          definition.columns[column.name] &&
          !existing.columns.some((entry) => entry.name === column.name)
        )
          existing.columns.push({
            name: column.name,
            type: definition.columns[column.name].type,
            notNull: column.notNull,
          })
      existing.foreignKeys.push(
        ...Object.values(definition.foreignKeys).flatMap((foreignKey) =>
          foreignKey.columnsFrom.map((column, index) => ({
            column,
            table:
              foreignKey.schemaTo && foreignKey.schemaTo !== 'public'
                ? `${foreignKey.schemaTo}.${foreignKey.tableTo}`
                : foreignKey.tableTo,
            referencedColumn: foreignKey.columnsTo[index],
          })),
        ),
      )
    }
    const ddl = await generateMigration(previous, snapshot)
    for (const [index, sql] of ddl.entries()) {
      if (/^CREATE TYPE/.test(sql)) continue
      statements.push({
        canonicalId: `CURRENT_DECLARATION:${key}:${index}`,
        sql,
        source,
        sourceDigest: commitments[source],
      })
    }
    if (!existing)
      tables.push({
        name: config.name,
        columns: config.columns.map((column) => ({
          name: column.name,
          type: definition.columns[column.name]?.type ?? column.getSQLType(),
          notNull: column.notNull,
        })),
        authority: authority ?? null,
        source,
        sourceDigest: commitments[source],
        foreignKeys: Object.values(definition.foreignKeys).flatMap((foreignKey) =>
          foreignKey.columnsFrom.map((column, index) => ({
            column,
            table:
              foreignKey.schemaTo && foreignKey.schemaTo !== 'public'
                ? `${foreignKey.schemaTo}.${foreignKey.tableTo}`
                : foreignKey.tableTo,
            referencedColumn: foreignKey.columnsTo[index],
          })),
        ),
      })
  }
  const authSource = 'packages/db/src/schema/auth.ts'
  const authSchema: Record<string, unknown> = createRequire(import.meta.url)(
    path.join(root, ...authSource.split('/')),
  )
  const authDigest = hash(readFileSync(path.join(root, ...authSource.split('/')), 'utf8'))
  commitments[authSource] = authDigest
  statements.push({
    canonicalId: 'CURRENT_SCHEMA:user_management',
    sql: 'CREATE SCHEMA user_management AUTHORIZATION ue_v2_owner;',
    source: authSource,
    sourceDigest: authDigest,
  })
  for (const [symbol, table] of Object.entries(authSchema).sort(([a], [b]) => a.localeCompare(b))) {
    if (!is(table, PgTable)) continue
    const config = getTableConfig(table)
    if (config.schema !== 'user_management')
      throw new Error(`UE_V2_PLATFORM_AUTH_SCOPE_MISMATCH:${config.name}`)
    const snapshot = generateDrizzleJson({ [symbol]: table })
    snapshot.schemas = {}
    const ddl = await generateMigration(generateDrizzleJson({}), snapshot)
    for (const [index, sql] of ddl.entries())
      statements.push({
        canonicalId: `PLATFORM_AUTH_CURRENT:${config.name}:${index}`,
        sql,
        source: authSource,
        sourceDigest: authDigest,
      })
    tables.push({
      name: `user_management.${config.name}`,
      columns: config.columns.map((column) => ({
        name: column.name,
        type: column.getSQLType(),
        notNull: column.notNull,
      })),
      authority: null,
      source: authSource,
      sourceDigest: authDigest,
      foreignKeys: [],
    })
  }
  const bindingSource = 'packages/db/src/schema/platform-authorization.ts'
  const bindingDigest = hash(readFileSync(path.join(root, ...bindingSource.split('/')), 'utf8'))
  commitments[bindingSource] = bindingDigest
  const bindingConfig = getTableConfig(platformIdentityBindings)
  const bindingSnapshot = generateDrizzleJson({ platformIdentityBindings })
  for (const [index, sql] of (
    await generateMigration(generateDrizzleJson({}), bindingSnapshot)
  ).entries())
    statements.push({
      canonicalId: `PLATFORM_IDENTITY_CURRENT:${index}`,
      sql,
      source: bindingSource,
      sourceDigest: bindingDigest,
    })
  tables.push({
    name: bindingConfig.name,
    source: bindingSource,
    sourceDigest: bindingDigest,
    columns: bindingConfig.columns.map((column) => ({
      name: column.name,
      type: column.getSQLType(),
      notNull: column.notNull,
    })),
    foreignKeys: [
      {
        column: 'platform_user_id',
        table: 'user_management.users',
        referencedColumn: 'user_id',
      },
    ],
    authority: {
      table: bindingConfig.name,
      classification: 'CONTAINED_NO_AUTHORITY',
      reason:
        'No ordinary or legacy system authority; canonical provider resolver receives independently qualified column-only auth grants.',
      supportingCapability: ['packages/platform-auth/src/provider-identity.ts'],
      requiredRuntimePrivileges: [],
      requiredSystemPrivileges: [],
      invocationAuthority: 'NONE',
      dbExecutionPrincipal: 'NONE',
      reviewPriority: 'NONE',
    },
  })
  decisions.push({
    relation: bindingConfig.name,
    disposition: 'CANONICAL_SHARED_AUTH_IDENTITY_BINDING',
    source: bindingSource,
    sourceDigest: bindingDigest,
    rationale:
      'Authenticated current provider resolver requires immutable verified subject binding and canonical auth-user FK; ordinary and legacy system roles receive no authority.',
  })
  const enumStatements = [...enums]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, sql]) => ({
      canonicalId: `CURRENT_ENUM:${name}`,
      sql,
      source: 'current-application-schema',
      sourceDigest: hash(JSON.stringify(commitments)),
    }))
  const membership = tables.find((table) => table.name === 'organization_members')
  if (membership?.columns.find((column) => column.name === 'organization_id')?.type !== 'uuid')
    throw new Error('UE_V2_MEMBERSHIP_UUID_REQUIRED')
  const membershipModel = currentModels.models.find(
    (model) => model.table === 'organization_members',
  )
  if (
    !membershipModel?.constraints.some((constraint) =>
      JSON.stringify(constraint).includes('"unique_org_membership"'),
    )
  )
    throw new Error('UE_V2_CANONICAL_MEMBERSHIP_UNIQUENESS_REQUIRED')
  decisions.push({
    relation: 'organization_members',
    canonicalDecision: 'UNIQUE (organization_id, user_id)',
    source: membership.source,
    sourceDigest: membership.sourceDigest,
    rationale:
      'Accepted product invariant is owned and emitted by the current Django model, not a historical supplement.',
  })
  const profile = currentModels.models.find((model) => model.table === 'profiles')
  if (!profile?.columns.some((column) => column.name === 'user_id' && column.unique))
    throw new Error('UE_V2_CURRENT_PROFILE_PARENT_KEY_REQUIRED')
  decisions.push({
    relation: 'profiles',
    canonicalDecision: 'UNIQUE (user_id)',
    source: profile.source,
    sourceDigest: profile.sourceDigest,
    rationale:
      'Current profile read projection declares one profile per authenticated user; current application FKs require that natural key. The canonical Django owner now enforces it prospectively. Legacy duplicates require separate reconciliation.',
  })
  const documentsOrganization = tables
    .find((table) => table.name === 'member_documents')
    ?.columns.find((column) => column.name === 'organization_id')
  if (documentsOrganization?.type !== 'uuid' || documentsOrganization.notNull)
    throw new Error('UE_V2_MEMBER_DOCUMENT_ORGANIZATION_UUID_REQUIRED')
  for (const name of ['claims', 'grievances', 'security_events']) {
    const column = tables
      .find((table) => table.name === name)
      ?.columns.find((entry) => entry.name === 'organization_id')
    if (column?.type !== 'uuid' || column.notNull)
      throw new Error(`UE_V2_CURRENT_NULLABILITY_REQUIRED:${name}`)
    decisions.push({
      relation: name,
      canonicalDecision: 'UUID NULLABLE',
      sourceDefinition: column,
      applicationUsage: storageAuthorityManifest.find((entry) => entry.table === name)
        ?.supportingCapability,
      rlsImplication:
        'NULL rows are inaccessible to ordinary tenant role; no global read inference. System access only from explicit manifest grants.',
      tenantIsolationImplication:
        'NULL cannot match a nonnull authenticated org context; tenant writes must include own org.',
      rationale:
        'Current Django source wins over historical W4P NOT NULL; no historical payload replay.',
    })
  }
  return {
    contractVersion: '2.0',
    lineage: 'PROSPECTIVE_UE_BOOTSTRAP_V2',
    scope: 'UE_OPERATIONAL',
    currentModels,
    statements: [
      ...(tables.some((table) =>
        table.columns.some((column) => /^vector(?:\(|$)/.test(column.type)),
      )
        ? [
            {
              canonicalId: 'CURRENT_EXTENSION:vector',
              sql: "CREATE EXTENSION vector WITH VERSION '0.8.1';",
              source: 'current-operational-vector-column-declarations',
              sourceDigest: hash(JSON.stringify(commitments)),
            },
          ]
        : []),
      ...enumStatements,
      ...statements,
    ],
    tables,
    decisions,
    exclusions,
    securityBlockers,
    sourceCommitments: {
      ...currentModels.sourceDigests,
      ...commitments,
      ...currentBackendSourceDigests(),
    },
    authExecution: {
      compilerSource: 'packages/db/src/auth-storage-authority/bootstrap-sql.ts',
      roles: Object.values(AUTH_EXECUTION_ROLES),
    },
    installerExecution: {
      prerequisiteSource: 'apps/union-eyes/scripts/bootstrap-v2/minimum-installer.ts',
      functionOwnerRoles: [...INSTALLER_FUNCTION_OWNER_ROLES],
    },
    frameworkExecution: {
      compilerSource: 'apps/union-eyes/scripts/bootstrap-v2/framework-sql.ts',
      roles: Object.values(FRAMEWORK_ROLES),
      tables: Object.keys(FRAMEWORK_MODEL_OWNERS),
      platformMetadataTables: Object.keys(PLATFORM_METADATA_MODEL_OWNERS),
    },
  }
}
