import { ProvisioningError } from './governed-provisioning'
import { replayDigest } from './post-w4p-replay'
import { Cursor, compileAddedColumn, inspectAddedColumn } from './replay-structural-effects'
import { createCatalogQueries, normalizeCreateDefault } from './replay-create-inspection'
import { parentKeyQueries } from './parent-key-supplement'
import type { CatalogReader } from './platform-baseline-promotion'
function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
export function compileDefaultEffect(source: string, sourceHash: string) {
  const cursor = new Cursor(source, sourceHash)
  cursor.word('ALTER')
  cursor.word('TABLE')
  const relation = cursor.relation()
  if (cursor.tokens[cursor.index]?.value.toUpperCase() === 'ADD') {
    const column = compileAddedColumn(source, sourceHash, true)
    requireCondition(
      column.column.normalizedDefault.kind !== 'NONE',
      'REPLAY_DEFAULT_DECLARATION_REQUIRED',
    )
    const body = { action: 'ADD_DEFAULT_COLUMN' as const, column, sourceHash }
    return { ...body, contractDigest: replayDigest(body) }
  }
  cursor.word('ALTER')
  cursor.word('COLUMN')
  const name = cursor.identifier()
  cursor.word('SET')
  cursor.word('DEFAULT')
  const token = cursor.tokens[cursor.index],
    value = cursor.identifier()
  requireCondition(
    token?.kind === 'WORD' && ['true', 'false'].includes(value),
    'REPLAY_DEFAULT_GRAMMAR_UNSUPPORTED',
  )
  cursor.finish()
  const body = {
    action: 'SET_BOOLEAN_DEFAULT' as const,
    schema: relation.schema,
    table: relation.name,
    name,
    value: value === 'true',
    sourceHash,
  }
  return { ...body, contractDigest: replayDigest(body) }
}
function row(value: unknown): Record<string, unknown> {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'REPLAY_DEFAULT_CATALOG_ROW_INVALID',
  )
  return Object.fromEntries(Object.entries(value))
}
export async function inspectDefaultEffect(
  reader: CatalogReader,
  spec: ReturnType<typeof compileDefaultEffect>,
) {
  const observe = (
    definition: 'EXACT' | 'ABSENT' | 'DRIFTED' | 'PRECONDITION_MISSING',
    data: unknown,
  ) => ({
    definition,
    stateDigest: replayDigest({ contractDigest: spec.contractDigest, definition, data }),
  })
  if (spec.action === 'ADD_DEFAULT_COLUMN') {
    const result = await inspectAddedColumn(reader, spec.column)
    return observe(result.definition, { columnStateDigest: result.stateDigest })
  }
  const tables = await reader.query(parentKeyQueries.relation, [spec.schema, spec.table])
  requireCondition(tables.length <= 1, 'REPLAY_DEFAULT_CATALOG_CARDINALITY_INVALID')
  if (!tables.length) return observe('PRECONDITION_MISSING', { table: null })
  const table = row(tables[0])
  requireCondition(
    typeof table.kind === 'string' && typeof table.standalone === 'boolean',
    'REPLAY_DEFAULT_CATALOG_ROW_INVALID',
  )
  if (table.kind !== 'r' || !table.standalone) return observe('DRIFTED', { table })
  const columns = (await reader.query(createCatalogQueries.columns, [spec.schema, spec.table]))
    .map(row)
    .filter((entry) => entry.name === spec.name)
  requireCondition(columns.length <= 1, 'REPLAY_DEFAULT_CATALOG_CARDINALITY_INVALID')
  if (!columns.length) return observe('PRECONDITION_MISSING', { column: spec.name })
  const column = columns[0]
  requireCondition(
    typeof column.type_schema === 'string' &&
      typeof column.type_name === 'string' &&
      typeof column.type_kind === 'string' &&
      (column.default_expression === null || typeof column.default_expression === 'string') &&
      typeof column.identity === 'string' &&
      typeof column.generated === 'string',
    'REPLAY_DEFAULT_CATALOG_ROW_INVALID',
  )
  if (
    column.type_schema !== 'pg_catalog' ||
    column.type_name !== 'bool' ||
    column.type_kind !== 'b' ||
    column.identity !== '' ||
    column.generated !== ''
  )
    return observe('DRIFTED', { column })
  const expected = { kind: 'BOOLEAN', value: spec.value }
  const actual = normalizeCreateDefault(column.default_expression, 'boolean', [], 'pg_catalog')
  return observe(replayDigest(expected) === replayDigest(actual) ? 'EXACT' : 'ABSENT', {
    name: spec.name,
    actual,
  })
}
