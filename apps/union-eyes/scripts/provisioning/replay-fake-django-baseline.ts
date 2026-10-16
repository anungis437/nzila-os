import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import {
  FakeReplayCatalog,
  type FakeReplayForeignKey,
  type FakeReplayIndex,
  type FakeReplayTable,
} from './replay-fake-catalog'

/** AST-only physical subset; neither migration execution nor a live graph proof. */
export interface DjangoBaselineOrigin {
  migration: string
  file: string
  sha256: string
  line: number
}
export interface DjangoBaselineCeiling {
  migration: string
  file: string
  line: number
  operation: string
  reason: string
  tables: string[]
}
export interface SourceBoundDjangoBaseline {
  authority: {
    scope: 'OFFLINE_SOURCE_BOUND_PHYSICAL_SUBSET'
    lockSha256: string
    djangoWheelSha256: string
    backendSha256: string
    authenticatedWheels: 87
    authenticatedLocalSources: 29
    authenticatedExternalSources: 53
    fullDjangoGraphVerified: false
    sourceExecuted: false
    djangoInitialized: false
    emptyInitialTables: true
    implicitKeyIndexNamesModeled: false
  }
  tables: FakeReplayTable[]
  indexes: FakeReplayIndex[]
  foreignKeys: FakeReplayForeignKey[]
  /** Source-derived index/FK installation text, not production inspector IR. */
  catalogInstallSql: string[]
  unsupported: DjangoBaselineCeiling[]
  provenance: (DjangoBaselineOrigin & {
    supported: boolean
    table?: string
    column?: string
  })[]
  clientDefaults: {
    table: string
    column: string
    declaration: unknown
    origin: DjangoBaselineOrigin
  }[]
  sqlEffects: {
    source: string
    sha256: string
    origin: DjangoBaselineOrigin
    modeled: boolean
    rolledBack?: boolean
    branch?: 'FRESH_EMPTY_NO_LEGACY_COLUMN'
  }[]
  operationCount: number
}

const boundResults = new WeakMap<SourceBoundDjangoBaseline, string>()
const compiler = resolve(
  typeof __dirname === 'string' ? __dirname : import.meta.dirname,
  'compile-fake-django-baseline.py',
)
const djangoWheelHash = '92ed81d500be6408ecd704d7bd1366c534f30427bffcc63c5fefb129561aec7c'
const backendHash = 'd73b472e8d3f315b5e53f5a810e5e80d6a0310305fa668c7a0d0f345038aafa7'
function requireBaseline(condition: unknown, code: string): asserts condition {
  if (!condition) throw new ProvisioningError(code)
}

export function loadSourceBoundDjangoBaseline(request: {
  repositoryRoot: string
  wheelhouse: string
}): SourceBoundDjangoBaseline {
  requireBaseline(
    Object.keys(request).sort().join(',') === 'repositoryRoot,wheelhouse' &&
      typeof request.repositoryRoot === 'string' &&
      typeof request.wheelhouse === 'string',
    'FAKE_DJANGO_BASELINE_REQUEST_REQUIRED',
  )
  const result = spawnSync('python', [compiler], {
    input: JSON.stringify(request),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })
  if (result.error) throw result.error
  requireBaseline(result.status === 0, `FAKE_DJANGO_BASELINE_COMPILER:${result.stderr}`)
  // This boundary accepts output only from our local compiler, never caller IR.
  const baseline = JSON.parse(result.stdout) as SourceBoundDjangoBaseline
  requireBaseline(
    baseline.authority.scope === 'OFFLINE_SOURCE_BOUND_PHYSICAL_SUBSET' &&
      baseline.authority.djangoWheelSha256 === djangoWheelHash &&
      baseline.authority.backendSha256 === backendHash &&
      baseline.authority.authenticatedWheels === 87 &&
      baseline.authority.authenticatedLocalSources === 29 &&
      baseline.authority.authenticatedExternalSources === 53 &&
      baseline.authority.fullDjangoGraphVerified === false &&
      baseline.authority.sourceExecuted === false &&
      baseline.authority.djangoInitialized === false &&
      baseline.authority.emptyInitialTables === true &&
      baseline.authority.implicitKeyIndexNamesModeled === false,
    'FAKE_DJANGO_BASELINE_AUTHORITY_REQUIRED',
  )
  requireBaseline(
    new Set(baseline.tables.map((table) => `${table.schema}.${table.name}`)).size ===
      baseline.tables.length &&
      baseline.tables.every(
        (table) =>
          table.schema === 'public' &&
          table.kind === 'r' &&
          table.standalone &&
          !table.enabled &&
          !table.forced &&
          table.rows.length === 0 &&
          new Set(table.columns.map((column) => column.name)).size === table.columns.length &&
          [
            ...table.primaryKey,
            ...(table.uniqueConstraints ?? []).flatMap((key) => key.columns),
          ].every((name) => table.columns.some((column) => column.name === name)),
      ) &&
      baseline.sqlEffects.every((effect) => replayHash(effect.source) === effect.sha256),
    'FAKE_DJANGO_BASELINE_SHAPE_REQUIRED',
  )
  boundResults.set(baseline, replayDigest(baseline))
  return baseline
}

function authenticateResult(baseline: SourceBoundDjangoBaseline) {
  requireBaseline(
    boundResults.get(baseline) === replayDigest(baseline),
    'FAKE_DJANGO_BASELINE_SOURCE_BOUND_RESULT_REQUIRED',
  )
}

/** Select a table only if its declarations and effects have no physical ceiling.
 * External/custom migration ceilings stay visible, and never become full-graph proof.
 */
export function sourceBoundDjangoTable(
  baseline: SourceBoundDjangoBaseline,
  name: string,
): FakeReplayTable {
  authenticateResult(baseline)
  const table = baseline.tables.find((table) => table.name === name)
  requireBaseline(table, `FAKE_DJANGO_BASELINE_TABLE_REQUIRED:${name}`)
  const ceilings = baseline.unsupported.filter(
    (ceiling) =>
      ceiling.tables.includes(name) ||
      (ceiling.file.startsWith('apps/union-eyes/') && ceiling.tables.length === 0),
  )
  requireBaseline(
    ceilings.length === 0,
    `FAKE_DJANGO_BASELINE_TABLE_CEILING:${name}:${ceilings.map((c) => c.reason).join(',')}`,
  )
  return structuredClone(table)
}

/** Build native fake state for a qualified subset and all of its FK parents.
 * Explicit index/FK rows are installed from compiler-produced declarations.
 * Implicit key index *names* remain outside this subset; keys live on the tables.
 */
export async function createSourceBoundDjangoCatalog(
  baseline: SourceBoundDjangoBaseline,
  names: readonly string[],
  context: Omit<ConstructorParameters<typeof FakeReplayCatalog>[0], 'tables' | 'enums'>,
): Promise<FakeReplayCatalog> {
  authenticateResult(baseline)
  const selected = new Set(names)
  requireBaseline(selected.size === names.length, 'FAKE_DJANGO_DUPLICATE_TARGET')
  const tables = new Map<string, FakeReplayTable>()
  for (const name of selected) {
    tables.set(name, sourceBoundDjangoTable(baseline, name))
    for (const fk of baseline.foreignKeys.filter((fk) => fk.table === name))
      selected.add(fk.parent_name)
  }
  requireBaseline(
    context.schemas.includes('public') && context.schemas.includes('pg_catalog'),
    'FAKE_DJANGO_NATIVE_SCHEMAS_REQUIRED',
  )
  const catalog = new FakeReplayCatalog({ ...context, tables: [...tables.values()] })
  // The SQL order is indexes then FKs; filter by exact compiler-derived names.
  const wantedNames = new Set([
    ...baseline.indexes
      .filter((index) => selected.has(index.table_name))
      .map((index) => index.name),
    ...baseline.foreignKeys.filter((fk) => selected.has(fk.table)).map((fk) => fk.name),
  ])
  for (const sql of baseline.catalogInstallSql) {
    if ([...wantedNames].some((name) => sql.includes(`"${name.replaceAll('"', '""')}"`))) {
      // The existing fake DDL cursor does not accept deferred FKs or DESC keys.
      // Allocate the empty fake object, then install the independently compiled
      // native metadata (not inspector expectations). Nothing is sent to a DB.
      const allocationSql = sql
        .replace(' DEFERRABLE INITIALLY DEFERRED;', ';')
        .replaceAll('" DESC', '"')
        .replaceAll(' varchar_pattern_ops', '')
        .replaceAll(' text_pattern_ops', '')
      await catalog.applyFrozenUnit(allocationSql, replayHash(allocationSql))
    }
  }
  for (const index of baseline.indexes.filter((index) => selected.has(index.table_name)))
    catalog.replaceIndex(index)
  for (const fk of baseline.foreignKeys.filter((fk) => selected.has(fk.table)))
    catalog.replaceForeignKey(fk)
  return catalog
}
