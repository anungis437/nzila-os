import { ProvisioningError } from './governed-provisioning'
import { replayHash, replayDigest } from './post-w4p-replay'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import type { CatalogReader } from './platform-baseline-promotion'
import {
  compileColumnDefinition,
  createCatalogQueries,
  normalizeCreateDefault,
} from './replay-create-inspection'
import { parentKeyQueries } from './parent-key-supplement'
export interface StructuralObservation {
  definition: 'ABSENT' | 'EXACT' | 'DRIFTED' | 'PRECONDITION_MISSING'
  stateDigest: string
}
function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
export class Cursor {
  readonly tokens: ReturnType<typeof sqlTokens>
  index = 0
  constructor(
    readonly source: string,
    readonly sourceHash: string,
  ) {
    requireCondition(replayHash(source) === sourceHash, 'REPLAY_STRUCTURAL_SOURCE_HASH_DRIFT')
    this.tokens = sqlTokens(source)
  }
  optionalWord(value: string) {
    const token = this.tokens[this.index]
    if (token?.kind !== 'WORD' || token.value.toUpperCase() !== value) return false
    this.index++
    return true
  }
  word(value: string) {
    requireCondition(this.optionalWord(value), 'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED')
  }
  symbol(value: string) {
    const token = this.tokens[this.index++]
    requireCondition(
      token?.kind === 'SYMBOL' && token.value === value,
      'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED',
    )
  }
  identifier() {
    const token = this.tokens[this.index++]
    requireCondition(
      token && (token.kind === 'WORD' || token.kind === 'IDENTIFIER'),
      'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED',
    )
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  relation() {
    const first = this.identifier()
    if (this.tokens[this.index]?.value !== '.')
      return { schema: 'public', name: first, qualified: false }
    this.symbol('.')
    return { schema: first, name: this.identifier(), qualified: true }
  }
  columns() {
    this.symbol('(')
    const columns = [this.identifier()]
    while (this.tokens[this.index]?.value === ',') {
      this.symbol(',')
      columns.push(this.identifier())
    }
    this.symbol(')')
    return columns
  }
  finish() {
    this.symbol(';')
    requireCondition(this.index === this.tokens.length, 'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED')
  }
}
export function compileSchema(source: string, sourceHash: string) {
  const cursor = new Cursor(source, sourceHash)
  cursor.word('CREATE')
  cursor.word('SCHEMA')
  let guarded = false
  if (cursor.optionalWord('IF')) {
    cursor.word('NOT')
    cursor.word('EXISTS')
    guarded = true
  }
  const name = cursor.identifier()
  cursor.finish()
  const body = { name, guarded, sourceHash }
  return { ...body, contractDigest: replayDigest(body) }
}
export async function inspectSchema(reader: CatalogReader, spec: ReturnType<typeof compileSchema>) {
  const rows = await reader.query(createCatalogQueries.namespace, [spec.name])
  requireCondition(rows.length <= 1, 'REPLAY_STRUCTURAL_CATALOG_CARDINALITY_INVALID')
  if (!rows.length) return observation('ABSENT', spec, null)
  const row = data(rows[0])
  requireCondition(typeof row.name === 'string', 'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID')
  return observation(row.name === spec.name ? 'EXACT' : 'DRIFTED', spec, row)
}
export function compileAddedColumn(source: string, sourceHash: string, allowDefaults = false) {
  const cursor = new Cursor(source, sourceHash)
  cursor.word('ALTER')
  cursor.word('TABLE')
  const relation = cursor.relation()
  cursor.word('ADD')
  cursor.word('COLUMN')
  let guarded = false
  if (cursor.optionalWord('IF')) {
    cursor.word('NOT')
    cursor.word('EXISTS')
    guarded = true
  }
  const start = cursor.index,
    name = cursor.identifier()
  const terminal = cursor.tokens.at(-1)
  requireCondition(
    terminal?.kind === 'SYMBOL' && terminal.value === ';' && cursor.tokens[start],
    'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED',
  )
  const definition = source.slice(cursor.tokens[start].start, terminal.start).trim()
  const column = compileColumnDefinition({ name, definition })
  requireCondition(
    !column.primary &&
      (allowDefaults || column.normalizedDefault.kind === 'NONE') &&
      column.type.enum === null,
    'REPLAY_STRUCTURAL_ADDED_COLUMN_GRAMMAR_UNSUPPORTED',
  )
  cursor.index = cursor.tokens.length - 1
  cursor.finish()
  const body = { schema: relation.schema, table: relation.name, guarded, column, sourceHash }
  return { ...body, contractDigest: replayDigest(body) }
}
export async function inspectAddedColumn(
  reader: CatalogReader,
  spec: ReturnType<typeof compileAddedColumn>,
) {
  const parameters = [spec.schema, spec.table]
  const relations = await reader.query(parentKeyQueries.relation, parameters)
  requireCondition(relations.length <= 1, 'REPLAY_STRUCTURAL_CATALOG_CARDINALITY_INVALID')
  if (!relations.length) return observation('PRECONDITION_MISSING', spec, { relation: null })
  const relation = data(relations[0])
  requireCondition(
    typeof relation.kind === 'string' && typeof relation.standalone === 'boolean',
    'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID',
  )
  if (relation.kind !== 'r' || !relation.standalone)
    return observation('DRIFTED', spec, { relation })
  const types = await reader.query(createCatalogQueries.typePrerequisite, [
    spec.column.type.schema,
    spec.column.type.name,
  ])
  requireCondition(types.length <= 1, 'REPLAY_STRUCTURAL_CATALOG_CARDINALITY_INVALID')
  if (!types.length) return observation('PRECONDITION_MISSING', spec, { type: null })
  const type = data(types[0])
  requireCondition(typeof type.kind === 'string', 'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID')
  if (type.kind !== 'b') return observation('DRIFTED', spec, { type })
  if (spec.column.normalizedDefault.kind === 'FUNCTION') {
    requireCondition(
      spec.column.normalizedDefault.name === 'pg_catalog.now',
      'REPLAY_STRUCTURAL_DEFAULT_FUNCTION_NOT_SUPPORTED',
    )
    const clocks = await reader.query(createCatalogQueries.clock, [])
    requireCondition(clocks.length <= 1, 'REPLAY_STRUCTURAL_CATALOG_CARDINALITY_INVALID')
    if (!clocks.length) return observation('PRECONDITION_MISSING', spec, { clock: null })
    const clock = data(clocks[0])
    requireCondition(
      typeof clock.schema === 'string' &&
        typeof clock.name === 'string' &&
        typeof clock.language === 'string' &&
        typeof clock.result === 'string' &&
        typeof clock.executable === 'boolean',
      'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID',
    )
    if (
      clock.schema !== 'pg_catalog' ||
      clock.name !== 'now' ||
      clock.language !== 'internal' ||
      clock.result !== 'timestamptz' ||
      !clock.executable
    )
      return observation('PRECONDITION_MISSING', spec, { clock })
  }
  const columns = (await reader.query(createCatalogQueries.columns, parameters)).map(data)
  requireCondition(
    columns.every((column) => typeof column.name === 'string') &&
      new Set(columns.map((column) => column.name)).size === columns.length,
    'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID',
  )
  const actual = columns.find((column) => column.name === spec.column.name)
  if (!actual) return observation('ABSENT', spec, null)
  requireCondition(
    typeof actual.postgres_type === 'string' &&
      typeof actual.type_schema === 'string' &&
      typeof actual.type_name === 'string' &&
      typeof actual.type_kind === 'string' &&
      typeof actual.not_null === 'boolean' &&
      (actual.default_expression === null || typeof actual.default_expression === 'string') &&
      typeof actual.identity === 'string' &&
      typeof actual.generated === 'string' &&
      typeof actual.collation_default === 'boolean' &&
      (actual.acl === null || typeof actual.acl === 'string'),
    'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID',
  )
  const display = actual.postgres_type.replace(/"/g, '').replace(/\s*([(),])\s*/g, '$1')
  const expected = spec.column
  const exact =
    actual.type_schema === expected.type.schema &&
    actual.type_name === expected.type.name &&
    actual.type_kind === 'b' &&
    display === expected.type.display &&
    actual.not_null === expected.notNull &&
    actual.identity === '' &&
    actual.generated === '' &&
    actual.collation_default &&
    actual.acl === null &&
    replayDigest(
      normalizeCreateDefault(
        actual.default_expression,
        expected.type.display,
        [],
        expected.type.schema,
      ),
    ) === replayDigest(expected.normalizedDefault)
  return observation(exact ? 'EXACT' : 'DRIFTED', spec, actual)
}
export function compileForeignKey(source: string, sourceHash: string) {
  const cursor = new Cursor(source, sourceHash)
  cursor.word('ALTER')
  cursor.word('TABLE')
  const relation = cursor.relation()
  cursor.word('ADD')
  cursor.word('CONSTRAINT')
  const name = cursor.identifier()
  cursor.word('FOREIGN')
  cursor.word('KEY')
  const columns = cursor.columns()
  cursor.word('REFERENCES')
  const parent = cursor.relation(),
    parentColumns = cursor.columns()
  let deleteAction = 'a',
    updateAction = 'a'
  const action = () => {
    if (cursor.optionalWord('CASCADE')) return 'c'
    if (cursor.optionalWord('RESTRICT')) return 'r'
    if (cursor.optionalWord('NO')) {
      cursor.word('ACTION')
      return 'a'
    }
    cursor.word('SET')
    if (cursor.optionalWord('NULL')) return 'n'
    cursor.word('DEFAULT')
    return 'd'
  }
  const assigned = new Set<string>()
  while (cursor.optionalWord('ON')) {
    const kind = cursor.identifier().toUpperCase()
    requireCondition(
      ['DELETE', 'UPDATE'].includes(kind) && !assigned.has(kind),
      'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED',
    )
    assigned.add(kind)
    if (kind === 'DELETE') deleteAction = action()
    else updateAction = action()
  }
  cursor.finish()
  requireCondition(columns.length === parentColumns.length, 'REPLAY_STRUCTURAL_FK_ARITY_INVALID')
  const body = {
    schema: relation.schema,
    table: relation.name,
    name,
    columns,
    parentSchema: parent.schema,
    parent: parent.name,
    parentColumns,
    deleteAction,
    updateAction,
    sourceHash,
  }
  return { ...body, contractDigest: replayDigest(body) }
}
export function compileSimpleIndex(source: string, sourceHash: string) {
  const cursor = new Cursor(source, sourceHash)
  cursor.word('CREATE')
  const unique = cursor.optionalWord('UNIQUE')
  cursor.word('INDEX')
  let guarded = false
  if (cursor.optionalWord('IF')) {
    cursor.word('NOT')
    cursor.word('EXISTS')
    guarded = true
  }
  const index = cursor.relation()
  cursor.word('ON')
  const table = cursor.relation()
  let method = 'btree'
  if (cursor.optionalWord('USING')) method = cursor.identifier()
  const columns = cursor.columns()
  let predicate: ReturnType<typeof indexPredicate> = null
  if (cursor.optionalWord('WHERE')) {
    const start = cursor.index
    while (cursor.tokens[cursor.index]?.value !== ';' && cursor.index < cursor.tokens.length)
      cursor.index++
    predicate = indexPredicate(cursor.tokens.slice(start, cursor.index))
    requireCondition(predicate, 'REPLAY_STRUCTURAL_INDEX_PREDICATE_UNSUPPORTED')
  }
  cursor.finish()
  const schema = index.qualified ? index.schema : table.schema
  requireCondition(
    schema === table.schema && ['btree', 'gin', 'gist', 'hash', 'brin', 'spgist'].includes(method),
    'REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED',
  )
  const body = {
    schema,
    name: index.name,
    table: table.name,
    unique,
    guarded,
    method,
    columns,
    predicate,
    sourceHash,
  }
  return { ...body, contractDigest: replayDigest(body) }
}
function indexPredicate(input: ReturnType<typeof sqlTokens>) {
  let tokens = input
  while (tokens[0]?.value === '(' && tokens.at(-1)?.value === ')') {
    let depth = 0,
      encloses = true
    for (let index = 0; index < tokens.length - 1; index++) {
      if (tokens[index].value === '(') depth++
      if (tokens[index].value === ')') depth--
      if (depth === 0) {
        encloses = false
        break
      }
    }
    if (!encloses) break
    tokens = tokens.slice(1, -1)
  }
  const first = tokens[0]
  if (!first || !['WORD', 'IDENTIFIER'].includes(first.kind)) return null
  const column = first.kind === 'WORD' ? first.value.toLowerCase() : first.value
  const word = (index: number, value: string) =>
    tokens[index]?.kind === 'WORD' && tokens[index].value.toUpperCase() === value
  if (tokens.length === 4 && word(1, 'IS') && word(2, 'NOT') && word(3, 'NULL'))
    return { column, operation: 'IS_NOT_NULL' }
  if (
    tokens.length === 3 &&
    tokens[1].kind === 'SYMBOL' &&
    tokens[1].value === '=' &&
    (word(2, 'TRUE') || word(2, 'FALSE'))
  )
    return { column, operation: 'BOOLEAN_EQUALS', value: word(2, 'TRUE') }
  return null
}
export const structuralQueries = {
  foreignKey: `SELECT con.contype AS kind,con.convalidated AS validated,con.condeferrable AS deferrable,con.condeferred AS deferred,con.conislocal AS local,con.coninhcount AS inherited,
    con.confdeltype AS delete_action,con.confupdtype AS update_action,con.confmatchtype AS match,
    pn.nspname AS parent_schema,pc.relname AS parent_name,
    (SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality) FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_catalog.pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.attnum) AS columns,
    (SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality) FROM pg_catalog.unnest(con.confkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_catalog.pg_attribute a ON a.attrelid=con.confrelid AND a.attnum=k.attnum) AS parent_columns
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_class pc ON pc.oid=con.confrelid LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace
    WHERE n.nspname=$1 AND c.relname=$2 AND con.conname=$3`,
  index: `SELECT c.relkind AS kind,tn.nspname AS table_schema,t.relname AS table_name,am.amname AS method,
    i.indisunique AS unique,i.indisvalid AS valid,i.indisready AS ready,i.indislive AS live,i.indisprimary AS primary,i.indisexclusion AS exclusion,
    COALESCE((pg_catalog.to_jsonb(i)->>'indnullsnotdistinct')::boolean,false) AS nulls_not_distinct,
    pg_catalog.pg_get_expr(i.indpred,i.indrelid) AS predicate,pg_catalog.pg_get_expr(i.indexprs,i.indrelid) AS expressions,
    i.indnkeyatts AS key_count,i.indnatts AS total_count,
    (SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality) FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum WHERE k.ordinality<=i.indnkeyatts) AS columns,
    (SELECT pg_catalog.json_agg(k.option ORDER BY k.ordinality) FROM pg_catalog.unnest(i.indoption) WITH ORDINALITY k(option,ordinality)) AS options,
    (SELECT pg_catalog.json_agg(pg_catalog.pg_get_indexdef(c.oid,k.ordinality::integer,true) ORDER BY k.ordinality) FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality) WHERE k.ordinality<=i.indnkeyatts) AS key_definitions,
    (SELECT pg_catalog.bool_and(op.opcdefault) FROM pg_catalog.unnest(i.indclass) k(opoid) JOIN pg_catalog.pg_opclass op ON op.oid=k.opoid) AS opclasses_default,
    (SELECT pg_catalog.bool_and(k.collation=a.attcollation) FROM pg_catalog.unnest(i.indcollation) WITH ORDINALITY k(collation,ordinality) JOIN pg_catalog.unnest(i.indkey) WITH ORDINALITY key(attnum,ordinality) USING(ordinality) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.attnum) AS collations_default
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=c.oid
    LEFT JOIN pg_catalog.pg_class t ON t.oid=i.indrelid LEFT JOIN pg_catalog.pg_namespace tn ON tn.oid=t.relnamespace LEFT JOIN pg_catalog.pg_am am ON am.oid=c.relam
    WHERE n.nspname=$1 AND c.relname=$2`,
}
function data(value: unknown): Record<string, unknown> {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID',
  )
  return Object.fromEntries(Object.entries(value))
}
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')
function observation(
  definition: StructuralObservation['definition'],
  spec: unknown,
  row: unknown,
): StructuralObservation {
  return { definition, stateDigest: replayDigest({ spec, row, definition }) }
}
export async function inspectForeignKey(
  reader: CatalogReader,
  spec: ReturnType<typeof compileForeignKey>,
) {
  const rows = await reader.query(structuralQueries.foreignKey, [
    spec.schema,
    spec.table,
    spec.name,
  ])
  requireCondition(rows.length <= 1, 'REPLAY_STRUCTURAL_CATALOG_CARDINALITY_INVALID')
  if (!rows.length) return observation('ABSENT', spec, null)
  const row = data(rows[0])
  requireCondition(typeof row.kind === 'string', 'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID')
  if (row.kind !== 'f') return observation('DRIFTED', spec, row)
  requireCondition(
    typeof row.kind === 'string' &&
      strings(row.columns) &&
      strings(row.parent_columns) &&
      typeof row.parent_schema === 'string' &&
      typeof row.parent_name === 'string' &&
      typeof row.delete_action === 'string' &&
      typeof row.update_action === 'string' &&
      typeof row.match === 'string' &&
      typeof row.validated === 'boolean' &&
      typeof row.deferrable === 'boolean' &&
      typeof row.deferred === 'boolean' &&
      typeof row.local === 'boolean' &&
      typeof row.inherited === 'number',
    'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID',
  )
  const exact =
    row.kind === 'f' &&
    replayDigest(row.columns) === replayDigest(spec.columns) &&
    replayDigest(row.parent_columns) === replayDigest(spec.parentColumns) &&
    row.parent_schema === spec.parentSchema &&
    row.parent_name === spec.parent &&
    row.delete_action === spec.deleteAction &&
    row.update_action === spec.updateAction &&
    row.match === 's' &&
    row.validated &&
    !row.deferrable &&
    !row.deferred &&
    row.local &&
    row.inherited === 0
  return observation(exact ? 'EXACT' : 'DRIFTED', spec, row)
}
export async function inspectSimpleIndex(
  reader: CatalogReader,
  spec: ReturnType<typeof compileSimpleIndex>,
) {
  const rows = await reader.query(structuralQueries.index, [spec.schema, spec.name])
  requireCondition(rows.length <= 1, 'REPLAY_STRUCTURAL_CATALOG_CARDINALITY_INVALID')
  if (!rows.length) return observation('ABSENT', spec, null)
  const row = data(rows[0])
  requireCondition(typeof row.kind === 'string', 'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID')
  if (row.kind !== 'i') return observation('DRIFTED', spec, row)
  requireCondition(
    typeof row.kind === 'string' &&
      typeof row.table_schema === 'string' &&
      typeof row.table_name === 'string' &&
      typeof row.method === 'string' &&
      [
        'unique',
        'valid',
        'ready',
        'live',
        'primary',
        'exclusion',
        'nulls_not_distinct',
        'opclasses_default',
        'collations_default',
      ].every((key) => typeof row[key] === 'boolean') &&
      (row.predicate === null || typeof row.predicate === 'string') &&
      (row.expressions === null || typeof row.expressions === 'string') &&
      strings(row.columns) &&
      strings(row.key_definitions) &&
      Array.isArray(row.options) &&
      row.options.every((entry) => typeof entry === 'number') &&
      typeof row.key_count === 'number' &&
      typeof row.total_count === 'number',
    'REPLAY_STRUCTURAL_CATALOG_ROW_INVALID',
  )
  const predicate = row.predicate === null ? null : indexPredicate(sqlTokens(String(row.predicate)))
  const keyDefinitions = row.key_definitions
  const keysExact =
    keyDefinitions.length === spec.columns.length &&
    keyDefinitions.every((definition, index) => {
      const tokens = sqlTokens(definition),
        token = tokens[0]
      return (
        tokens.length === 1 &&
        ['WORD', 'IDENTIFIER'].includes(token.kind) &&
        (token.kind === 'WORD' ? token.value.toLowerCase() : token.value) === spec.columns[index]
      )
    })
  const exact =
    row.kind === 'i' &&
    row.table_schema === spec.schema &&
    row.table_name === spec.table &&
    row.method === spec.method &&
    row.unique === spec.unique &&
    row.valid &&
    row.ready &&
    row.live &&
    !row.primary &&
    !row.exclusion &&
    !row.nulls_not_distinct &&
    (row.predicate === null
      ? spec.predicate === null
      : predicate !== null && replayDigest(predicate) === replayDigest(spec.predicate)) &&
    row.expressions === null &&
    keysExact &&
    replayDigest(row.columns) === replayDigest(spec.columns) &&
    replayDigest(row.options) === replayDigest(spec.columns.map(() => 0)) &&
    row.opclasses_default &&
    row.collations_default &&
    row.key_count === spec.columns.length &&
    row.total_count === spec.columns.length
  return observation(exact ? 'EXACT' : 'DRIFTED', spec, row)
}
