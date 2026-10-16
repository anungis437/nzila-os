import { ProvisioningError } from './governed-provisioning'
import { replayHash, replayDigest } from './post-w4p-replay'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { createCatalogQueries } from './replay-create-inspection'
import { parentKeyQueries } from './parent-key-supplement'
import type { CatalogReader } from './platform-baseline-promotion'
const recipes = [
  {
    table: 'organization_members',
    column: 'exempt_from_per_capita',
    dependencies: ['exempt_from_per_capita'],
    type: 'bool',
    sql: 'UPDATE organization_members SET exempt_from_per_capita = false WHERE exempt_from_per_capita IS NULL;',
  },
  {
    table: 'documents',
    column: 'name',
    dependencies: ['name', 'title', 'filename'],
    type: 'text',
    sql: "UPDATE documents SET name = COALESCE(NULLIF(name, ''), NULLIF(title, ''), NULLIF(filename, ''), 'document') WHERE name IS NULL;",
  },
  {
    table: 'documents',
    column: 'file_url',
    dependencies: ['file_url', 'id'],
    type: 'text',
    sql: "UPDATE documents SET file_url = COALESCE(NULLIF(file_url, ''), 'phase-g://placeholder/' || id::text) WHERE file_url IS NULL;",
  },
  {
    table: 'documents',
    column: 'uploaded_by',
    dependencies: ['uploaded_by'],
    type: 'text',
    sql: "UPDATE documents SET uploaded_by = COALESCE(NULLIF(uploaded_by, ''), 'phase-g-seed') WHERE uploaded_by IS NULL;",
  },
] as const
function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
const semanticTokens = (sql: string) =>
  sqlTokens(sql).map((token) => ({
    kind: token.kind,
    value: token.kind === 'WORD' ? token.value.toLowerCase() : token.value,
  }))
export function compileBackfill(source: string, sourceHash: string) {
  requireCondition(replayHash(source) === sourceHash, 'REPLAY_BACKFILL_SOURCE_HASH_DRIFT')
  const tokens = semanticTokens(source)
  const matches = recipes.filter(
    (recipe) => replayDigest(semanticTokens(recipe.sql)) === replayDigest(tokens),
  )
  requireCondition(matches.length === 1, 'REPLAY_BACKFILL_SOURCE_GRAMMAR_UNSUPPORTED')
  const { sql, ...recipe } = matches[0]
  const body = {
    ...recipe,
    sourceHash,
    assignmentSemanticsDigest: replayDigest(semanticTokens(sql)),
    schema: 'public',
  }
  return { ...body, contractDigest: replayDigest(body) }
}
export const backfillQueries = {
  builtins: `SELECT
    EXISTS(SELECT 1 FROM pg_catalog.pg_operator op JOIN pg_catalog.pg_namespace ns ON ns.oid=op.oprnamespace
      JOIN pg_catalog.pg_proc fn ON fn.oid=op.oprcode JOIN pg_catalog.pg_namespace fns ON fns.oid=fn.pronamespace
      JOIN pg_catalog.pg_language lang ON lang.oid=fn.prolang
      WHERE op.oid=pg_catalog.to_regoperator('=(text,text)') AND ns.nspname='pg_catalog' AND fns.nspname='pg_catalog'
        AND fn.proname='texteq' AND lang.lanname='internal' AND pg_catalog.has_function_privilege(fn.oid,'EXECUTE')) AS text_equality,
    EXISTS(SELECT 1 FROM pg_catalog.pg_operator op JOIN pg_catalog.pg_namespace ns ON ns.oid=op.oprnamespace
      JOIN pg_catalog.pg_proc fn ON fn.oid=op.oprcode JOIN pg_catalog.pg_namespace fns ON fns.oid=fn.pronamespace
      JOIN pg_catalog.pg_language lang ON lang.oid=fn.prolang
      WHERE op.oid=pg_catalog.to_regoperator('||(text,text)') AND ns.nspname='pg_catalog' AND fns.nspname='pg_catalog'
        AND fn.proname='textcat' AND lang.lanname='internal' AND pg_catalog.has_function_privilege(fn.oid,'EXECUTE')) AS text_concat,
    EXISTS(SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace ns ON ns.oid=t.typnamespace
      JOIN pg_catalog.pg_proc fn ON fn.oid=t.typoutput JOIN pg_catalog.pg_namespace fns ON fns.oid=fn.pronamespace
      JOIN pg_catalog.pg_language lang ON lang.oid=fn.prolang
      WHERE ns.nspname='pg_catalog' AND t.typname='uuid' AND fns.nspname='pg_catalog'
        AND fn.proname='uuid_out' AND lang.lanname='internal' AND pg_catalog.has_function_privilege(fn.oid,'EXECUTE')) AS uuid_output`,
  visibility: `SELECT (NOT c.relrowsecurity OR actor.rolsuper OR actor.rolbypassrls OR
    (pg_catalog.pg_has_role(c.relowner,'USAGE') AND NOT c.relforcerowsecurity)) AS row_count_visible
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_roles actor ON actor.rolname=current_user
    WHERE n.nspname=$1 AND c.relname=$2`,
}
export function backfillCountQuery(spec: ReturnType<typeof compileBackfill>) {
  return `SELECT count(*)::text AS qualifying_rows FROM "public"."${spec.table}" WHERE "${spec.column}" IS NULL`
}
function row(value: unknown): Record<string, unknown> {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'REPLAY_BACKFILL_CATALOG_ROW_INVALID',
  )
  return Object.fromEntries(Object.entries(value))
}
export async function inspectBackfill(
  reader: CatalogReader,
  spec: ReturnType<typeof compileBackfill>,
) {
  const observe = (
    definition: 'EXACT' | 'ABSENT' | 'DRIFTED' | 'PRECONDITION_MISSING',
    data: unknown,
  ) => ({
    definition,
    stateDigest: replayDigest({ contractDigest: spec.contractDigest, definition, data }),
  })
  const parameters = [spec.schema, spec.table],
    tables = await reader.query(parentKeyQueries.relation, parameters)
  requireCondition(tables.length <= 1, 'REPLAY_BACKFILL_CATALOG_CARDINALITY_INVALID')
  if (!tables.length) return observe('PRECONDITION_MISSING', { table: null })
  const table = row(tables[0])
  requireCondition(
    typeof table.kind === 'string' && typeof table.standalone === 'boolean',
    'REPLAY_BACKFILL_CATALOG_ROW_INVALID',
  )
  if (table.kind !== 'r' || !table.standalone) return observe('DRIFTED', { table })
  const columns = (await reader.query(createCatalogQueries.columns, parameters)).map(row)
  for (const name of spec.dependencies) {
    const matches = columns.filter((column) => column.name === name)
    requireCondition(matches.length <= 1, 'REPLAY_BACKFILL_CATALOG_CARDINALITY_INVALID')
    if (!matches.length) return observe('PRECONDITION_MISSING', { column: name })
    const column = matches[0]
    requireCondition(
      typeof column.type_schema === 'string' &&
        typeof column.type_name === 'string' &&
        typeof column.type_kind === 'string' &&
        typeof column.not_null === 'boolean' &&
        typeof column.identity === 'string' &&
        typeof column.generated === 'string',
      'REPLAY_BACKFILL_CATALOG_ROW_INVALID',
    )
    const type = name === 'id' ? 'uuid' : spec.type
    if (
      column.type_schema !== 'pg_catalog' ||
      column.type_name !== type ||
      column.type_kind !== 'b' ||
      column.identity !== '' ||
      column.generated !== '' ||
      (name === 'id' && !column.not_null)
    )
      return observe('DRIFTED', { column })
  }
  if (spec.type === 'text') {
    const dependencies = await reader.query(backfillQueries.builtins, [])
    requireCondition(dependencies.length === 1, 'REPLAY_BACKFILL_CATALOG_CARDINALITY_INVALID')
    const native = row(dependencies[0])
    requireCondition(
      ['text_equality', 'text_concat', 'uuid_output'].every(
        (name) => typeof native[name] === 'boolean',
      ),
      'REPLAY_BACKFILL_CATALOG_ROW_INVALID',
    )
    if (
      !native.text_equality ||
      (spec.column === 'file_url' && (!native.text_concat || !native.uuid_output))
    )
      return observe('PRECONDITION_MISSING', { native })
  }
  const visibility = await reader.query(backfillQueries.visibility, parameters)
  requireCondition(
    visibility.length === 1 && typeof row(visibility[0]).row_count_visible === 'boolean',
    'REPLAY_BACKFILL_CATALOG_ROW_INVALID',
  )
  if (!row(visibility[0]).row_count_visible)
    return observe('PRECONDITION_MISSING', { rowCountVisible: false })
  const counts = await reader.query(backfillCountQuery(spec), [])
  requireCondition(counts.length === 1, 'REPLAY_BACKFILL_CATALOG_CARDINALITY_INVALID')
  const count = row(counts[0]).qualifying_rows
  requireCondition(
    typeof count === 'string' && /^(0|[1-9]\d*)$/.test(count),
    'REPLAY_BACKFILL_COUNT_INVALID',
  )
  const remaining = BigInt(count)
  return observe(remaining === 0n ? 'EXACT' : 'ABSENT', { qualifyingRows: count })
}
