import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { frozenStatements } from '../../../../scripts/ue/close-w5a-replay-graph'
import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import { catalogQueries, type CatalogReader } from './platform-baseline-promotion'
import { createCatalogQueries } from './replay-create-inspection'
import { genRandomUuidQuery, parentKeyQueries } from './parent-key-supplement'
import { rlsPrimitiveQueries } from './replay-rls-primitives'
import { backfillQueries } from './replay-backfill-inspection'
import { tableDefinition } from '../../../../scripts/ue/w5bc-boundary-semantics'
import { structuralQueries } from './replay-structural-effects'
import { literalPolicyQueries } from './replay-literal-policy'
import { functionCatalogQueries } from './replay-function-inspection'
import {
  applyFakeFunctionSource,
  type FakeFunctionContext,
  type FakeFunctionRow,
} from './replay-fake-functions'
import { originalRelationQueries, type OriginalConstraintCatalog } from './replay-original-relation'
import { proceduralQueries, memberDocumentsAggregateQuery } from './replay-procedural-inspection'
import { positionAuthorityQueries } from './replay-position-authority'
import {
  interpretFakeHelperCall,
  type FakeHelperEnvironment,
  type FakeHelperNativeType,
} from './replay-fake-helper-program'
import { declarativeQueries } from './replay-declarative-boundary'
import { nullableColumnQueries } from './replay-nullable-column-boundary'
import { aclQueries } from './replay-acl-inspection'
import {
  applyFakeAclSource,
  type FakeAclState,
  type FakeAclKind,
  type FakeAclGrant,
} from './replay-fake-acl'
import { parseFakeCheckSource } from './replay-fake-check'
import { applyFakeRetrofitSource } from './replay-fake-retrofit'
import { applyFakeGuardSource, fakeGuardIlike } from './replay-fake-guard'
import { applyFakeDefaultSource } from './replay-fake-defaults'
import {
  applyFakeMemberDocumentSource,
  fakeMemberDocumentGroups,
} from './replay-fake-member-documents'
import { helperCatalogQueries } from './replay-policy-helper-inspection'
import {
  fakeNativeBuiltin,
  fakeNativeEquality,
  fakeNativeOverloads,
  fakeNativeTypeIo,
} from './replay-fake-native'

export interface FakeReplayColumn {
  name: string
  type_schema: string
  type_name: string
  type_kind: string
  postgres_type: string
  not_null: boolean
  identity: string
  generated: string
  default_expression: string | null
  collation_default: boolean
  acl: null
}
export interface FakeReplayTable {
  schema: string
  name: string
  kind: string
  standalone: boolean
  enabled: boolean
  forced: boolean
  rowCountVisible: boolean
  columns: FakeReplayColumn[]
  rows: Record<string, string | boolean | null>[]
  policies: string[]
  primaryKey: string[]
  uniqueConstraints?: { name: string | null; columns: string[] }[]
  checkConstraints?: ReturnType<typeof parseFakeCheckSource>[]
  owner?: string
}
interface FakeCatalogState {
  schemas: string[]
  enums: { schema: string; name: string; members: string[] }[]
  tables: FakeReplayTable[]
  receipts: [string, unknown][]
  indexes: FakeReplayIndex[]
  foreignKeys: FakeReplayForeignKey[]
  roles: string[]
  policies: FakeReplayPolicy[]
  functions: FakeFunctionRow[]
  functionContext: FakeFunctionContext | null
  database: string | null
  databaseOwner: string | null
  databaseGrants: FakeAclGrant[]
  triggers: {
    schema: string
    table: string
    name: string
    function_schema: string
    function_name: string
  }[]
  schemaPermissions: { schema: string; role: string; usage: boolean; create: boolean }[]
  eventTriggers: { name: string; enabled: string }[]
  acl: FakeAclState
}
export interface FakeReplayPolicy {
  schema: string
  table: string
  name: string
  name_matches: boolean
  command: string
  permissive: boolean
  roles: string[]
  using_expression: string | null
  check_expression: string | null
  references?: { schema: string; table: string; column: string }[]
}
export interface FakeReplayForeignKey {
  schema: string
  table: string
  name: string
  kind: string
  columns: string[]
  parent_schema: string
  parent_name: string
  parent_columns: string[]
  delete_action: string
  update_action: string
  match: string
  validated: boolean
  deferrable: boolean
  deferred: boolean
  local: boolean
  inherited: number
}
export interface FakeReplayIndex {
  schema: string
  name: string
  table_schema: string
  table_name: string
  kind: string
  method: string
  unique: boolean
  valid: boolean
  ready: boolean
  live: boolean
  primary: boolean
  exclusion: boolean
  nulls_not_distinct: boolean
  predicate: string | null
  expressions: string | null
  key_count: number
  total_count: number
  columns: string[]
  options: number[]
  key_definitions: string[]
  opclasses_default: boolean
  collations_default: boolean
}
export interface FakeNativeStatementObservation {
  unitHash: string
  ordinal: number
  source: string
  sourceHash: string
  byteRange: readonly [number, number]
  beforeDigest: string
  afterDigest: string
  before: CatalogReader
  after: CatalogReader
}
const nativeTypes: Record<string, { name: string; display: string }> = {
  uuid: { name: 'uuid', display: 'uuid' },
  text: { name: 'text', display: 'text' },
  boolean: { name: 'bool', display: 'boolean' },
  bool: { name: 'bool', display: 'boolean' },
  integer: { name: 'int4', display: 'integer' },
  int4: { name: 'int4', display: 'integer' },
  bigint: { name: 'int8', display: 'bigint' },
  int8: { name: 'int8', display: 'bigint' },
  jsonb: { name: 'jsonb', display: 'jsonb' },
  json: { name: 'json', display: 'json' },
  date: { name: 'date', display: 'date' },
  numeric: { name: 'numeric', display: 'numeric' },
  time: { name: 'time', display: 'time without time zone' },
  'time without time zone': { name: 'time', display: 'time without time zone' },
  timestamptz: { name: 'timestamptz', display: 'timestamp with time zone' },
  'timestamp with time zone': { name: 'timestamptz', display: 'timestamp with time zone' },
  'timestamp without time zone': { name: 'timestamp', display: 'timestamp without time zone' },
  timestamp: { name: 'timestamp', display: 'timestamp without time zone' },
  'text[]': { name: '_text', display: 'text[]' },
  'uuid[]': { name: '_uuid', display: 'uuid[]' },
}
export function parseFakeSourceColumn(
  field: { name: string; definition: string },
  enums: FakeCatalogState['enums'],
): { column: FakeReplayColumn; primary: boolean } {
  const tokens = sqlTokens(field.definition)
  if (tokens.length < 2) throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
  const markers = tokens.flatMap((token, index) =>
    token.kind === 'WORD' &&
    ['DEFAULT', 'PRIMARY', 'NOT', 'REFERENCES', 'UNIQUE', 'GENERATED', 'COLLATE'].includes(
      token.value.toUpperCase(),
    )
      ? [index]
      : [],
  )
  const typeEnd = markers.length ? tokens[markers[0]].start : field.definition.length
  const declaration = field.definition.slice(tokens[0].end, typeEnd).trim().replace(/\s+/g, ' ')
  let typeSchema = 'pg_catalog',
    typeKind = 'b',
    display: string,
    typeName: string
  const builtin = nativeTypes[declaration.toLowerCase()]
  const sized = /^(varchar|character varying|numeric)\s*\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\)$/i.exec(
    declaration,
  )
  if (builtin) {
    typeName = builtin.name
    display = builtin.display
  } else if (sized) {
    if ((sized[1].toLowerCase() === 'numeric') !== (sized[3] !== undefined))
      throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
    typeName = sized[1].toLowerCase() === 'numeric' ? 'numeric' : 'varchar'
    display =
      typeName === 'numeric' ? `numeric(${sized[2]},${sized[3]})` : `character varying(${sized[2]})`
  } else {
    const cursor = new SourceCursor(`${declaration};`),
      named = cursor.relation()
    cursor.end()
    const namedType = enums.find(
      (entry) => entry.schema === named.schema && entry.name === named.name,
    )
    if (!namedType)
      throw new ProvisioningError(`FAKE_NAMED_TYPE_REQUIRED:${named.schema}.${named.name}`)
    typeName = named.name
    typeSchema = named.schema
    typeKind = 'e'
    display = named.schema === 'public' ? named.name : `${named.schema}.${named.name}`
  }
  let primary = false,
    notNull = false,
    defaultExpression: string | null = null
  let index = markers[0] ?? tokens.length
  while (index < tokens.length) {
    const token = tokens[index++]
    if (token.kind !== 'WORD') throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
    if (token.value.toUpperCase() === 'PRIMARY') {
      if (tokens[index++]?.value.toUpperCase() !== 'KEY' || primary)
        throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
      primary = true
      notNull = true
    } else if (token.value.toUpperCase() === 'NOT') {
      if (tokens[index++]?.value.toUpperCase() !== 'NULL')
        throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
      notNull = true
    } else if (token.value.toUpperCase() === 'DEFAULT') {
      if (defaultExpression !== null || !tokens[index])
        throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
      const start = tokens[index].start
      let end = field.definition.length,
        depth = 0
      while (index < tokens.length) {
        const current = tokens[index]
        if (
          depth === 0 &&
          current.kind === 'WORD' &&
          ['NOT', 'PRIMARY', 'UNIQUE', 'REFERENCES'].includes(current.value.toUpperCase())
        ) {
          end = current.start
          break
        }
        if (current.kind === 'SYMBOL' && current.value === '(') depth++
        if (current.kind === 'SYMBOL' && current.value === ')') depth--
        index++
      }
      defaultExpression = field.definition.slice(start, end).trim()
      if (
        depth !== 0 ||
        !/^(?:gen_random_uuid\(\)|now\(\)|true|false|-?\d+(?:\.\d+)?|'(?:[^']|'')*'(?:\s*::\s*(?:jsonb|text))?)$/i.test(
          defaultExpression,
        )
      )
        throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
    } else throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
  }
  return {
    primary,
    column: {
      name: field.name,
      type_schema: typeSchema,
      type_name: typeName,
      type_kind: typeKind,
      postgres_type: display,
      not_null: notNull,
      identity: '',
      generated: '',
      default_expression: defaultExpression,
      collation_default: true,
      acl: null,
    },
  }
}
class SourceCursor {
  readonly tokens: ReturnType<typeof sqlTokens>
  index = 0
  constructor(source: string) {
    this.tokens = sqlTokens(source)
  }
  static validatePolicyExpression(
    source: string,
    table: FakeReplayTable,
    related?: (schema: string | null, name: string) => FakeReplayTable,
    helper = false,
    enumMembers?: (schema: string, name: string) => readonly string[] | null,
    recordColumn?: (table: FakeReplayTable, column: FakeReplayColumn) => void,
  ) {
    const cursor = new SourceCursor(source)
    const fail = () => {
      throw new ProvisioningError('FAKE_POLICY_EXPRESSION_UNSUPPORTED')
    }
    const scopes = new Map<string, FakeReplayTable>([[table.name, table]])
    const primary = (): string => {
      let type: string
      if (cursor.tokens[cursor.index]?.value === '(') {
        cursor.symbol('(')
        type = expression()
        cursor.symbol(')')
      } else if (helper && cursor.take('EXISTS')) {
        cursor.symbol('(')
        cursor.need('SELECT')
        if (cursor.tokens[cursor.index++]?.value !== '1') return fail()
        cursor.need('FROM')
        if (!related) return fail()
        const aliases: string[] = []
        const bind = () => {
          let schema: string | null = null,
            name = cursor.id()
          if (cursor.tokens[cursor.index]?.value === '.') {
            cursor.symbol('.')
            schema = name
            name = cursor.id()
          }
          const relation = related(schema, name),
            hasAs = cursor.take('AS')
          const next = cursor.tokens[cursor.index]?.value.toUpperCase()
          const alias =
            hasAs || !['WHERE', 'JOIN', 'INNER', 'ON'].includes(next ?? '') ? cursor.id() : name
          if (scopes.has(alias)) return fail()
          scopes.set(alias, relation)
          aliases.push(alias)
        }
        bind()
        while (
          cursor.tokens[cursor.index]?.value.toUpperCase() === 'JOIN' ||
          cursor.tokens[cursor.index]?.value.toUpperCase() === 'INNER'
        ) {
          cursor.take('INNER')
          cursor.need('JOIN')
          bind()
          cursor.need('ON')
          if (expression() !== 'bool') return fail()
        }
        cursor.need('WHERE')
        if (expression() !== 'bool') return fail()
        cursor.symbol(')')
        for (const alias of aliases) scopes.delete(alias)
        type = 'bool'
      } else if (cursor.take('TRUE') || cursor.take('FALSE')) type = 'bool'
      else if (cursor.tokens[cursor.index]?.kind === 'STRING') {
        cursor.index++
        type = 'text'
      } else {
        let name = cursor.id(),
          qualifier: string | null = null,
          relation = table
        if (cursor.tokens[cursor.index]?.value === '.') {
          qualifier = name
          if (qualifier !== 'pg_catalog' && (!helper || !scopes.has(qualifier))) return fail()
          cursor.symbol('.')
          name = cursor.id()
          if (qualifier !== 'pg_catalog') relation = scopes.get(qualifier)!
        }
        if (cursor.tokens[cursor.index]?.value === '(') {
          if (name !== 'current_setting' || (qualifier !== null && qualifier !== 'pg_catalog'))
            return fail()
          cursor.symbol('(')
          if (primary() !== 'text') return fail()
          cursor.symbol(',')
          if (!cursor.take('TRUE') && !cursor.take('FALSE')) return fail()
          cursor.symbol(')')
          type = 'text'
        } else {
          if (qualifier === 'pg_catalog' || (qualifier !== null && !helper)) return fail()
          const column = relation.columns.find((column) => column.name === name)
          if (!column) throw new ProvisioningError('FAKE_COLUMN_REQUIRED')
          recordColumn?.(relation, column)
          if (
            helper &&
            column.type_kind === 'e' &&
            enumMembers?.(column.type_schema, column.type_name)
          )
            type = `enum:${column.type_schema}.${column.type_name}`
          else {
            if (column.type_schema !== 'pg_catalog' || column.type_kind !== 'b') return fail()
            type = column.type_name === 'varchar' ? 'text' : column.type_name
          }
        }
      }
      while (cursor.tokens[cursor.index]?.value === ':') {
        cursor.symbol(':')
        cursor.symbol(':')
        let cast = cursor.id()
        if (cast === 'pg_catalog' && cursor.tokens[cursor.index]?.value === '.') {
          cursor.symbol('.')
          cast = cursor.id()
        }
        let array = false
        if (helper && cursor.tokens[cursor.index]?.value === '[') {
          cursor.symbol('[')
          cursor.symbol(']')
          array = true
        }
        if (
          cast === 'text' &&
          !array &&
          (['text', 'uuid'].includes(type) || (helper && ['int4', 'int8'].includes(type)))
        )
          type = 'text'
        else if (helper && cast === 'uuid' && type === 'text') type = array ? '_uuid' : 'uuid'
        else return fail()
      }
      return type
    }
    const comparison = (): string => {
      const leftStart = cursor.index,
        leftLiteral = cursor.tokens[cursor.index]
      const left = primary()
      if (cursor.tokens[cursor.index]?.value === '=') {
        cursor.symbol('=')
        let right: string
        const rightStart = cursor.index,
          rightLiteral = cursor.tokens[cursor.index]
        if (helper && cursor.take('ANY')) {
          cursor.symbol('(')
          const array = primary()
          cursor.symbol(')')
          if (array !== '_uuid') return fail()
          right = 'uuid'
        } else right = primary()
        if (helper && (left.startsWith('enum:') || right.startsWith('enum:'))) {
          const enumType = left.startsWith('enum:') ? left : right
          const literal = left.startsWith('enum:') ? rightLiteral : leftLiteral
          const start = left.startsWith('enum:') ? rightStart : leftStart
          const otherType = left.startsWith('enum:') ? right : left
          const identity = enumType.slice(5).split('.')
          if (
            left !== right &&
            (otherType !== 'text' ||
              literal?.kind !== 'STRING' ||
              cursor.tokens[start + 1]?.value === ':' ||
              !enumMembers?.(identity[0], identity[1])?.includes(literal.value))
          )
            return fail()
        } else if (left !== right || !['text', 'uuid', 'bool'].includes(left)) return fail()
        return 'bool'
      }
      if (cursor.take('IS')) {
        const not = cursor.take('NOT')
        if (!not && !helper) return fail()
        cursor.need('NULL')
        return 'bool'
      }
      return left
    }
    const and = (): string => {
      const type = comparison()
      while (cursor.take('AND')) if (type !== 'bool' || comparison() !== 'bool') return fail()
      return type
    }
    const expression = (): string => {
      const type = and()
      while (helper && cursor.take('OR')) if (type !== 'bool' || and() !== 'bool') return fail()
      return type
    }
    if (expression() !== 'bool' || cursor.index !== cursor.tokens.length) fail()
  }
  take(word: string) {
    const token = this.tokens[this.index]
    if (token?.kind === 'WORD' && token.value.toUpperCase() === word) {
      this.index++
      return true
    }
    return false
  }
  need(word: string) {
    if (!this.take(word)) throw new ProvisioningError('FAKE_SOURCE_TRANSITION_UNSUPPORTED')
  }
  symbol(value: string) {
    const token = this.tokens[this.index++]
    if (token?.kind !== 'SYMBOL' || token.value !== value)
      throw new ProvisioningError('FAKE_SOURCE_TRANSITION_UNSUPPORTED')
  }
  id() {
    const token = this.tokens[this.index++]
    if (token?.kind !== 'WORD' && token?.kind !== 'IDENTIFIER')
      throw new ProvisioningError('FAKE_SOURCE_TRANSITION_UNSUPPORTED')
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  relation() {
    let schema = 'public',
      name = this.id()
    if (this.tokens[this.index]?.value === '.') {
      this.symbol('.')
      schema = name
      name = this.id()
    }
    return { schema, name }
  }
  end() {
    this.symbol(';')
    if (this.index !== this.tokens.length)
      throw new ProvisioningError('FAKE_SOURCE_TRANSITION_UNSUPPORTED')
  }
  columns() {
    this.symbol('(')
    const result = [this.id()]
    while (this.tokens[this.index]?.value === ',') {
      this.symbol(',')
      result.push(this.id())
    }
    this.symbol(')')
    return result
  }
}
const textBackfills = [
  {
    column: 'name',
    source:
      "UPDATE documents SET name = COALESCE(NULLIF(name, ''), NULLIF(title, ''), NULLIF(filename, ''), 'document') WHERE name IS NULL;",
  },
  {
    column: 'file_url',
    source:
      "UPDATE documents SET file_url = COALESCE(NULLIF(file_url, ''), 'phase-g://placeholder/' || id::text) WHERE file_url IS NULL;",
  },
  {
    column: 'uploaded_by',
    source:
      "UPDATE documents SET uploaded_by = COALESCE(NULLIF(uploaded_by, ''), 'phase-g-seed') WHERE uploaded_by IS NULL;",
  },
] as const
const tokenDigest = (source: string) =>
  replayDigest(
    sqlTokens(source).map((token) => ({
      kind: token.kind,
      value: token.kind === 'WORD' ? token.value.toLowerCase() : token.value,
    })),
  )
/** Independent state transitions, not compiler-produced expected readings or unit-completion flags. */
export class FakeReplayCatalog implements CatalogReader {
  private static observedRead = 0
  private state: FakeCatalogState
  private nativeUnitBusy = false
  readonly trace: string[] = []
  constructor(initial: {
    schemas: string[]
    tables?: FakeReplayTable[]
    enums?: FakeCatalogState['enums']
    roles?: string[]
    functions?: FakeFunctionRow[]
    functionContext?: FakeFunctionContext
    database?: string
    schemaPermissions?: FakeCatalogState['schemaPermissions']
    eventTriggers?: FakeCatalogState['eventTriggers']
    acl?: FakeAclState
  }) {
    this.state = {
      schemas: [...new Set(initial.schemas)],
      tables: structuredClone(initial.tables ?? []),
      enums: structuredClone(initial.enums ?? []),
      receipts: [],
      indexes: [],
      foreignKeys: [],
      roles: [...new Set(initial.roles ?? [])],
      policies: [],
      functions: structuredClone(initial.functions ?? []),
      functionContext: structuredClone(initial.functionContext ?? null),
      database: initial.database ?? null,
      databaseOwner: initial.database ? (initial.functionContext?.actor ?? null) : null,
      databaseGrants: [],
      triggers: [],
      schemaPermissions: structuredClone(initial.schemaPermissions ?? []),
      eventTriggers: structuredClone(initial.eventTriggers ?? []),
      acl: structuredClone(initial.acl ?? { objects: [], defaults: [] }),
    }
  }
  digest() {
    return replayDigest(this.state)
  }
  physicalDigest() {
    const { receipts: _receipts, ...physical } = this.state
    return replayDigest(physical)
  }
  snapshot(): CatalogReader {
    return this.fork()
  }
  fork(): FakeReplayCatalog {
    const copy = new FakeReplayCatalog({ schemas: [] })
    copy.state = structuredClone(this.state)
    return copy
  }
  inspectTable(schema: string, name: string): FakeReplayTable | null {
    return structuredClone(
      this.state.tables.find((table) => table.schema === schema && table.name === name) ?? null,
    )
  }
  inspectFunctions(schema: string, name: string): FakeFunctionRow[] {
    return structuredClone(
      this.state.functions.filter((row) => row.schema === schema && row.name === name),
    )
  }
  replaceFunction(row: FakeFunctionRow) {
    const at = this.state.functions.findIndex(
      (entry) =>
        entry.schema === row.schema &&
        entry.name === row.name &&
        replayDigest(entry.argument_types) === replayDigest(row.argument_types),
    )
    if (at < 0) throw new ProvisioningError('FAKE_FUNCTION_REQUIRED')
    this.state.functions[at] = structuredClone(row)
  }
  replaceTable(table: FakeReplayTable) {
    const index = this.state.tables.findIndex(
      (entry) => entry.schema === table.schema && entry.name === table.name,
    )
    if (index < 0) throw new ProvisioningError('FAKE_TABLE_REQUIRED')
    this.state.tables[index] = structuredClone(table)
  }
  inspectIndex(schema: string, name: string): FakeReplayIndex | null {
    return structuredClone(
      this.state.indexes.find((index) => index.schema === schema && index.name === name) ?? null,
    )
  }
  replaceIndex(index: FakeReplayIndex) {
    const at = this.state.indexes.findIndex(
      (entry) => entry.schema === index.schema && entry.name === index.name,
    )
    if (at < 0) throw new ProvisioningError('FAKE_INDEX_REQUIRED')
    this.state.indexes[at] = structuredClone(index)
  }
  inspectForeignKey(schema: string, table: string, name: string): FakeReplayForeignKey | null {
    return structuredClone(
      this.state.foreignKeys.find(
        (fk) => fk.schema === schema && fk.table === table && fk.name === name,
      ) ?? null,
    )
  }
  replaceForeignKey(fk: FakeReplayForeignKey) {
    const at = this.state.foreignKeys.findIndex(
      (entry) => entry.schema === fk.schema && entry.table === fk.table && entry.name === fk.name,
    )
    if (at < 0) throw new ProvisioningError('FAKE_FOREIGN_KEY_REQUIRED')
    this.state.foreignKeys[at] = structuredClone(fk)
  }
  inspectPolicy(schema: string, table: string, name: string): FakeReplayPolicy | null {
    return structuredClone(
      this.state.policies.find(
        (policy) => policy.schema === schema && policy.table === table && policy.name === name,
      ) ?? null,
    )
  }
  replacePolicy(policy: FakeReplayPolicy) {
    const at = this.state.policies.findIndex(
      (entry) =>
        entry.schema === policy.schema &&
        entry.table === policy.table &&
        entry.name === policy.name,
    )
    if (at < 0) throw new ProvisioningError('FAKE_POLICY_REQUIRED')
    this.state.policies[at] = structuredClone(policy)
  }
  readReceipt(id: string) {
    return structuredClone(this.state.receipts.find(([key]) => key === id)?.[1] ?? null)
  }
  tableInventory(): FakeReplayTable[] {
    return structuredClone(this.state.tables)
  }
  enumInventory() {
    return structuredClone(this.state.enums)
  }
  stageReceipt(id: string, receipt: unknown) {
    this.state.receipts = this.state.receipts.filter(([key]) => key !== id)
    this.state.receipts.push([id, structuredClone(receipt)])
  }
  async transaction<T>(
    work: (catalog: FakeReplayCatalog) => Promise<T>,
    failCommit = false,
  ): Promise<T> {
    const before = structuredClone(this.state)
    this.trace.push('FAKE_BEGIN')
    try {
      const result = await work(this)
      if (failCommit) throw new ProvisioningError('FAKE_COMMIT_FAILED')
      this.trace.push('FAKE_COMMIT')
      return result
    } catch (error) {
      this.state = before
      this.trace.push('FAKE_ROLLBACK')
      throw error
    }
  }
  private table(schema: string, name: string) {
    const table = this.state.tables.find((table) => table.schema === schema && table.name === name)
    if (!table) throw new ProvisioningError(`FAKE_TABLE_REQUIRED:${schema}.${name}`)
    if (table.kind !== 'r' || !table.standalone)
      throw new ProvisioningError('FAKE_TABLE_SHAPE_UNSUPPORTED')
    return table
  }
  private assertUniqueRows(table: FakeReplayTable, columns: string[]) {
    const keys = new Set<string>()
    for (const row of table.rows) {
      if (columns.some((column) => !Object.hasOwn(row, column)))
        throw new ProvisioningError('FAKE_ROW_COLUMN_REQUIRED')
      if (columns.some((column) => row[column] === null)) continue
      const values = columns.map((name) => {
        const column = table.columns.find((entry) => entry.name === name)
        const value = row[name]
        if (!column) throw new ProvisioningError('FAKE_UNIQUE_COLUMN_REQUIRED')
        if (
          column.type_schema === 'pg_catalog' &&
          ['text', 'varchar'].includes(column.type_name) &&
          typeof value === 'string'
        )
          return value
        if (
          column.type_schema === 'pg_catalog' &&
          column.type_name === 'uuid' &&
          typeof value === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
        )
          return value.toLowerCase()
        if (
          column.type_schema === 'pg_catalog' &&
          column.type_name === 'bool' &&
          typeof value === 'boolean'
        )
          return value
        if (
          column.type_kind === 'e' &&
          typeof value === 'string' &&
          this.state.enums.some(
            (type) =>
              type.schema === column.type_schema &&
              type.name === column.type_name &&
              type.members.includes(value),
          )
        )
          return value
        throw new ProvisioningError('FAKE_POPULATED_UNIQUE_INDEX_UNSUPPORTED')
      })
      const key = replayDigest(values)
      if (keys.has(key)) throw new ProvisioningError('FAKE_UNIQUE_EXISTING_ROW_VIOLATION')
      keys.add(key)
    }
  }
  /** One whole frozen unit is atomic, including an unsupported trailing statement. No SQL engine is used. */
  async applyFrozenUnit(source: string, hash: string) {
    await this.transitionFrozenUnit(source, hash)
  }
  async applyObservedFrozenUnit(
    source: string,
    hash: string,
    observe: (statement: FakeNativeStatementObservation) => Promise<void>,
  ) {
    await this.transitionFrozenUnit(source, hash, observe)
  }
  private async transitionFrozenUnit(
    source: string,
    hash: string,
    observe?: (statement: FakeNativeStatementObservation) => Promise<void>,
  ) {
    if (replayHash(source) !== hash) throw new ProvisioningError('FAKE_FROZEN_SOURCE_DRIFT')
    if (this.nativeUnitBusy) throw new ProvisioningError('FAKE_NATIVE_UNIT_BUSY')
    const before = structuredClone(this.state)
    this.nativeUnitBusy = true
    try {
      for (const [index, statement] of frozenStatements(source).entries()) {
        const predecessor = observe ? this.snapshot() : null
        const beforeDigest = observe ? this.digest() : null
        this.transition(statement.TEXT)
        if (observe && predecessor && beforeDigest) {
          const successor = this.snapshot()
          const afterDigest = this.digest()
          const reader = (catalog: CatalogReader): CatalogReader =>
            Object.freeze({
              query: (sql: string, parameters: string[]) => catalog.query(sql, parameters),
            })
          await observe(
            Object.freeze({
              unitHash: hash,
              ordinal: index + 1,
              source: statement.TEXT,
              sourceHash: statement.SHA256,
              byteRange: Object.freeze([
                Buffer.byteLength(source.slice(0, statement.START)),
                Buffer.byteLength(source.slice(0, statement.END)),
              ] as [number, number]),
              beforeDigest,
              afterDigest,
              before: reader(predecessor),
              after: reader(successor),
            }),
          )
          if (this.digest() !== afterDigest)
            throw new ProvisioningError('FAKE_NATIVE_OBSERVATION_MUTATION_DENIED')
        }
      }
      this.trace.push(`FAKE_UNIT_TRANSITION:${hash}`)
    } catch (error) {
      this.state = before
      throw error
    } finally {
      this.nativeUnitBusy = false
    }
  }
  private transition(source: string, helperExpression = false) {
    const cursor = new SourceCursor(source)
    if (
      ['GRANT', 'REVOKE', 'ALTER DEFAULT'].some(
        (prefix) =>
          cursor.tokens
            .slice(0, prefix.split(' ').length)
            .map((token) => token.value.toUpperCase())
            .join(' ') === prefix,
      )
    ) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
      applyFakeAclSource(source, this.state.acl, {
        actor: context.actor,
        searchPath: context.searchPath,
        schemas: this.state.schemas,
        roles: this.state.roles,
      })
      return
    }
    if (
      cursor.tokens[0]?.value.toUpperCase() === 'SELECT' &&
      ['WORD', 'IDENTIFIER'].includes(cursor.tokens[1]?.kind ?? '')
    ) {
      this.transitionHelper(source, cursor)
      return
    }
    const head = cursor.tokens
      .slice(0, 4)
      .map((token) => token.value.toUpperCase())
      .join(' ')
    if (head === 'CREATE OR REPLACE FUNCTION' || head.startsWith('DROP FUNCTION IF EXISTS')) {
      const context = this.state.functionContext
      if (
        !context ||
        !this.state.roles.includes(context.actor) ||
        !this.state.schemas.includes(context.creationSchema) ||
        !context.searchPath.includes('pg_catalog') ||
        new Set(context.searchPath).size !== context.searchPath.length ||
        context.defaultAcl.some(
          (entry) =>
            !this.state.roles.includes(entry.grantor) ||
            (entry.grantee !== 'PUBLIC' && !this.state.roles.includes(entry.grantee)),
        ) ||
        new Set(context.defaultAcl.map(replayDigest)).size !== context.defaultAcl.length
      )
        throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
      const changed = applyFakeFunctionSource(
        source,
        context,
        this.state.functions,
        (name) => this.nativeTypeVisibleSchema(name) === 'pg_catalog',
      )
      if (changed && !this.state.schemas.includes(changed.schema))
        throw new ProvisioningError('FAKE_NAMESPACE_REQUIRED')
      return
    }
    if (cursor.take('DO')) {
      if (
        cursor.tokens.some(
          (token, index) =>
            token.value.toUpperCase() === 'UPDATE' &&
            cursor.tokens[index + 1]?.value.toLowerCase() === 'member_documents',
        )
      ) {
        const context = this.state.functionContext
        if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
        applyFakeMemberDocumentSource(source, {
          publicTable: (name) =>
            this.state.tables.find((table) => table.schema === 'public' && table.name === name) ??
            null,
          resolveTable: (name) => {
            const schema = context.searchPath.find((schema) =>
              this.state.tables.some((table) => table.schema === schema && table.name === name),
            )
            if (schema !== 'public')
              throw new ProvisioningError('FAKE_BACKFILL_SOURCE_RESOLUTION_UNSUPPORTED')
            const table = this.table(schema, name)
            if (table.owner !== context.actor)
              throw new ProvisioningError('FAKE_BACKFILL_OWNER_REQUIRED')
            return table
          },
          execute: (statement) => this.transition(statement),
          validateUpdate: (table, organization) => {
            if (
              (table.checkConstraints ?? []).length ||
              this.state.triggers.some(
                (trigger) => trigger.schema === table.schema && trigger.table === table.name,
              ) ||
              table.primaryKey.includes('organization_id') ||
              (table.uniqueConstraints ?? []).some((key) =>
                key.columns.includes('organization_id'),
              ) ||
              this.state.indexes.some(
                (index) =>
                  index.table_schema === table.schema &&
                  index.table_name === table.name &&
                  index.unique &&
                  index.columns.includes('organization_id'),
              )
            )
              throw new ProvisioningError('FAKE_BACKFILL_EXTERNAL_UPDATE_SEMANTICS_REQUIRED')
            for (const key of this.state.foreignKeys.filter(
              (key) =>
                key.schema === table.schema &&
                key.table === table.name &&
                key.columns.includes('organization_id'),
            )) {
              if (key.columns.length !== 1 || key.parent_columns.length !== 1)
                throw new ProvisioningError('FAKE_BACKFILL_COMPOUND_UPDATE_CONSTRAINT_UNSUPPORTED')
              if (
                !this.table(key.parent_schema, key.parent_name).rows.some(
                  (row) => row[key.parent_columns[0]] === organization,
                )
              )
                throw new ProvisioningError('FAKE_FOREIGN_KEY_EXISTING_ROW_VIOLATION')
            }
          },
        })
        return
      }
      if (
        cursor.tokens.some(
          (token, index) =>
            token.value.toUpperCase() === 'SET' &&
            cursor.tokens[index + 1]?.value.toUpperCase() === 'DEFAULT',
        )
      ) {
        const context = this.state.functionContext
        if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
        applyFakeDefaultSource(source, {
          actor: context.actor,
          publicTable: (name) =>
            this.state.tables.find((table) => table.schema === 'public' && table.name === name) ??
            null,
          resolveTable: (name) => {
            const schema = context.searchPath.find((schema) =>
              this.state.tables.some((table) => table.schema === schema && table.name === name),
            )
            if (!schema) throw new ProvisioningError('FAKE_DEFAULT_UNCAUGHT_UNDEFINED_TABLE')
            return this.table(schema, name)
          },
          nativeGenerator: () => {
            this.assertDefaultGeneratorResolution()
          },
          enumMembers: (schema, name) =>
            this.state.enums.find((type) => type.schema === schema && type.name === name)
              ?.members ?? null,
          updateCategory: (table) => {
            this.assertBackfillVisibility(table)
            if (table.rows.some((row) => !Object.hasOwn(row, 'member_category')))
              throw new ProvisioningError('FAKE_ROW_COLUMN_REQUIRED')
            const nulls = table.rows.filter((row) => row.member_category === null)
            if (
              nulls.length &&
              ((table.checkConstraints ?? []).length ||
                this.state.foreignKeys.some(
                  (fk) =>
                    fk.schema === table.schema &&
                    fk.table === table.name &&
                    fk.columns.includes('member_category'),
                ) ||
                this.state.triggers.some(
                  (trigger) => trigger.schema === table.schema && trigger.table === table.name,
                ) ||
                table.primaryKey.includes('member_category') ||
                (table.uniqueConstraints ?? []).some((key) =>
                  key.columns.includes('member_category'),
                ) ||
                this.state.indexes.some(
                  (index) =>
                    index.table_schema === table.schema &&
                    index.table_name === table.name &&
                    index.unique &&
                    index.columns.includes('member_category'),
                ))
            )
              throw new ProvisioningError('FAKE_DEFAULT_UPDATE_EXTERNAL_SEMANTICS_REQUIRED')
            for (const row of nulls) row.member_category = 'full_member'
          },
        })
        return
      }
      if (cursor.tokens[1]?.value.toUpperCase() === 'DECLARE') {
        if (!this.state.functionContext)
          throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
        applyFakeGuardSource(source, {
          publicTable: (name) =>
            this.state.tables.find((table) => table.schema === 'public' && table.name === name) ??
            null,
          policies: this.state.policies,
        })
        return
      }
      if (
        cursor.tokens.some(
          (token, index) =>
            token.value.toUpperCase() === 'CREATE' &&
            cursor.tokens[index + 1]?.value.toUpperCase() === 'POLICY',
        )
      ) {
        cursor.need('BEGIN')
        cursor.need('IF')
        cursor.need('TO_REGCLASS')
        cursor.symbol('(')
        const guard = cursor.tokens[cursor.index++]
        if (guard?.kind !== 'STRING' || !/^public\.[a-z_][a-z0-9_]*$/.test(guard.value))
          throw new ProvisioningError('FAKE_GUARDED_POLICY_SOURCE_UNSUPPORTED')
        const name = guard.value.slice('public.'.length)
        cursor.symbol(')')
        cursor.need('IS')
        cursor.need('NULL')
        cursor.need('THEN')
        cursor.need('RAISE')
        cursor.need('NOTICE')
        if (cursor.tokens[cursor.index++]?.kind !== 'STRING')
          throw new ProvisioningError('FAKE_GUARDED_POLICY_SOURCE_UNSUPPORTED')
        cursor.symbol(';')
        cursor.need('RETURN')
        cursor.symbol(';')
        cursor.need('END')
        cursor.need('IF')
        cursor.symbol(';')
        const start = cursor.tokens[cursor.index]?.start
        const end =
          cursor.tokens.at(-2)?.value === ';' ? cursor.tokens.at(-3) : cursor.tokens.at(-2)
        if (
          start === undefined ||
          end?.value.toUpperCase() !== 'END' ||
          cursor.tokens.at(-1)?.value !== ';'
        )
          throw new ProvisioningError('FAKE_GUARDED_POLICY_SOURCE_UNSUPPORTED')
        const statements = frozenStatements(source.slice(start, end.start))
        if (!statements.length)
          throw new ProvisioningError('FAKE_GUARDED_POLICY_SOURCE_UNSUPPORTED')
        for (const statement of statements) {
          const tokens = sqlTokens(statement.TEXT),
            head = tokens
              .slice(0, 2)
              .map((token) => token.value.toUpperCase())
              .join(' ')
          if (!['ALTER TABLE', 'DROP POLICY', 'CREATE POLICY'].includes(head))
            throw new ProvisioningError('FAKE_GUARDED_POLICY_SOURCE_UNSUPPORTED')
          const target =
            head === 'ALTER TABLE'
              ? tokens[2]
              : tokens[tokens.findIndex((token) => token.value.toUpperCase() === 'ON') + 1]
          if (!target || target.value !== name || !['WORD', 'IDENTIFIER'].includes(target.kind))
            throw new ProvisioningError('FAKE_GUARDED_POLICY_SOURCE_UNSUPPORTED')
        }
        if (!this.state.tables.some((table) => table.schema === 'public' && table.name === name))
          return
        const context = this.state.functionContext
        if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
        const schema = context.searchPath.find((schema) =>
          this.state.tables.some((table) => table.schema === schema && table.name === name),
        )
        if (schema !== 'public')
          throw new ProvisioningError('FAKE_GUARDED_POLICY_SEARCH_PATH_UNSUPPORTED')
        if (this.table(schema, name).owner !== context.actor)
          throw new ProvisioningError('FAKE_GUARDED_POLICY_OWNER_REQUIRED')
        for (const statement of statements) this.transition(statement.TEXT, true)
        return
      }
      if (cursor.tokens[2]?.value.toUpperCase() === 'EXECUTE') {
        cursor.need('BEGIN')
        cursor.need('EXECUTE')
        cursor.need('FORMAT')
        cursor.symbol('(')
        const format = cursor.tokens[cursor.index++]
        if (
          format?.kind !== 'STRING' ||
          format.value !== 'GRANT CONNECT ON DATABASE %I TO union_eyes_runtime, union_eyes_system'
        )
          throw new ProvisioningError('FAKE_CONNECT_SOURCE_UNSUPPORTED')
        cursor.symbol(',')
        cursor.need('CURRENT_DATABASE')
        cursor.symbol('(')
        cursor.symbol(')')
        cursor.symbol(')')
        cursor.symbol(';')
        cursor.need('END')
        cursor.end()
        const context = this.state.functionContext
        if (!context || !this.state.database || context.actor !== this.state.databaseOwner)
          throw new ProvisioningError('FAKE_CONNECT_DATABASE_OWNER_REQUIRED')
        const roles = ['union_eyes_runtime', 'union_eyes_system']
        if (roles.some((role) => !this.state.roles.includes(role)))
          throw new ProvisioningError('FAKE_ACL_ROLE_REQUIRED')
        for (const role of roles)
          if (
            !this.state.databaseGrants.some(
              (grant) =>
                grant.grantor === context.actor &&
                grant.grantee === role &&
                grant.privilege === 'CONNECT',
            )
          )
            this.state.databaseGrants.push({
              grantor: context.actor,
              grantee: role,
              privilege: 'CONNECT',
              grantable: false,
            })
        return
      }
      if (
        cursor.tokens.some(
          (token, index) =>
            token.value.toUpperCase() === 'CREATE' &&
            cursor.tokens[index + 1]?.value.toUpperCase() === 'TRIGGER',
        )
      ) {
        cursor.need('BEGIN')
        cursor.need('IF')
        cursor.need('TO_REGCLASS')
        cursor.symbol('(')
        const guard = cursor.tokens[cursor.index++]
        if (guard?.kind !== 'STRING' || !/^[a-z_][a-z0-9_]*$/.test(guard.value))
          throw new ProvisioningError('FAKE_TRIGGER_SOURCE_UNSUPPORTED')
        cursor.symbol(')')
        cursor.need('IS')
        cursor.need('NOT')
        cursor.need('NULL')
        cursor.need('THEN')
        cursor.need('DROP')
        cursor.need('TRIGGER')
        cursor.need('IF')
        cursor.need('EXISTS')
        const name = cursor.id()
        cursor.need('ON')
        if (cursor.id() !== guard.value)
          throw new ProvisioningError('FAKE_TRIGGER_SOURCE_UNSUPPORTED')
        cursor.symbol(';')
        cursor.need('CREATE')
        cursor.need('TRIGGER')
        if (cursor.id() !== name) throw new ProvisioningError('FAKE_TRIGGER_SOURCE_UNSUPPORTED')
        cursor.need('BEFORE')
        cursor.need('INSERT')
        cursor.need('OR')
        cursor.need('UPDATE')
        cursor.need('ON')
        if (cursor.id() !== guard.value)
          throw new ProvisioningError('FAKE_TRIGGER_SOURCE_UNSUPPORTED')
        cursor.need('FOR')
        cursor.need('EACH')
        cursor.need('ROW')
        cursor.need('EXECUTE')
        cursor.need('FUNCTION')
        const functionName = cursor.id()
        cursor.symbol('(')
        cursor.symbol(')')
        cursor.symbol(';')
        cursor.need('END')
        cursor.need('IF')
        cursor.symbol(';')
        cursor.need('END')
        cursor.end()
        const context = this.state.functionContext
        if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
        const schema = context.searchPath.find((schema) =>
          this.state.tables.some((table) => table.schema === schema && table.name === guard.value),
        )
        if (!schema) return
        if (this.table(schema, guard.value).owner !== context.actor)
          throw new ProvisioningError('FAKE_TRIGGER_TABLE_OWNER_REQUIRED')
        const functionSchema = context.searchPath.find((schema) =>
          this.state.functions.some(
            (fn) => fn.schema === schema && fn.name === functionName && fn.argument_count === 0,
          ),
        )
        const functions = this.state.functions.filter(
          (fn) =>
            fn.schema === functionSchema && fn.name === functionName && fn.argument_count === 0,
        )
        const fn = functions[0]
        if (
          functions.length !== 1 ||
          !fn ||
          fn.kind !== 'f' ||
          fn.return_schema !== 'pg_catalog' ||
          fn.return_name !== 'trigger' ||
          fn.returns_set ||
          !fn.acl.some(
            (grant) =>
              grant.privilege === 'EXECUTE' &&
              (grant.grantee === context.actor || grant.grantee === 'PUBLIC'),
          )
        )
          throw new ProvisioningError('FAKE_TRIGGER_FUNCTION_REQUIRED')
        this.state.triggers = this.state.triggers.filter(
          (trigger) =>
            !(trigger.schema === schema && trigger.table === guard.value && trigger.name === name),
        )
        this.state.triggers.push({
          schema,
          table: guard.value,
          name,
          function_schema: fn.schema,
          function_name: fn.name,
        })
        const oid = this.sourceObjectOid('trigger', schema, `${guard.value}.${name}`)
        for (const candidate of this.state.functions)
          candidate.dependents = candidate.dependents.filter(
            (dependency) => !(dependency.class_id === '2620' && dependency.object_id === oid),
          )
        fn.dependents.push({ class_id: '2620', object_id: oid, sub_id: 0, kind: 'n' })
        return
      }
      if (
        cursor.tokens.some(
          (token, index) =>
            token.value.toUpperCase() === 'ADD' &&
            cursor.tokens[index + 1]?.value.toUpperCase() === 'COLUMN',
        )
      ) {
        const context = this.state.functionContext
        if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
        applyFakeRetrofitSource(source, {
          publicTable: (name) =>
            this.state.tables.find((table) => table.schema === 'public' && table.name === name) ??
            null,
          resolveTable: (name) => {
            const schema = context.searchPath.find((schema) =>
              this.state.tables.some((table) => table.schema === schema && table.name === name),
            )
            if (!schema) throw new ProvisioningError('FAKE_TABLE_REQUIRED')
            return this.table(schema, name)
          },
          execute: (statement) => this.transition(statement),
        })
        return
      }
      cursor.need('BEGIN')
      cursor.need('CREATE')
      cursor.need('TYPE')
      const identity = cursor.relation()
      cursor.need('AS')
      cursor.need('ENUM')
      cursor.symbol('(')
      const members: string[] = []
      do {
        if (members.length) cursor.symbol(',')
        const token = cursor.tokens[cursor.index++]
        if (token?.kind !== 'STRING')
          throw new ProvisioningError('FAKE_SOURCE_TRANSITION_UNSUPPORTED')
        members.push(token.value)
      } while (cursor.tokens[cursor.index]?.value === ',')
      cursor.symbol(')')
      cursor.symbol(';')
      cursor.need('EXCEPTION')
      cursor.need('WHEN')
      cursor.need('DUPLICATE_OBJECT')
      cursor.need('THEN')
      cursor.need('NULL')
      cursor.symbol(';')
      cursor.need('END')
      cursor.end()
      if (!this.state.schemas.includes(identity.schema))
        throw new ProvisioningError('FAKE_NAMESPACE_REQUIRED')
      if (
        !this.state.enums.some(
          (entry) => entry.schema === identity.schema && entry.name === identity.name,
        )
      )
        this.state.enums.push({ ...identity, members })
      return
    }
    if (cursor.take('CREATE')) {
      if (cursor.take('TYPE')) {
        const identity = cursor.relation()
        cursor.need('AS')
        cursor.need('ENUM')
        cursor.symbol('(')
        const members: string[] = []
        do {
          if (members.length) cursor.symbol(',')
          const token = cursor.tokens[cursor.index++]
          if (token?.kind !== 'STRING') throw new ProvisioningError('FAKE_ENUM_SOURCE_UNSUPPORTED')
          members.push(token.value)
        } while (cursor.tokens[cursor.index]?.value === ',')
        cursor.symbol(')')
        cursor.end()
        if (!this.state.schemas.includes(identity.schema))
          throw new ProvisioningError('FAKE_NAMESPACE_REQUIRED')
        if (
          new Set(members).size !== members.length ||
          members.some((member) => Buffer.byteLength(member) > 63)
        )
          throw new ProvisioningError('FAKE_ENUM_SOURCE_UNSUPPORTED')
        if (
          this.state.enums.some(
            (entry) => entry.schema === identity.schema && entry.name === identity.name,
          )
        )
          throw new ProvisioningError('FAKE_DUPLICATE_TYPE')
        this.state.enums.push({ ...identity, members })
        return
      }
      if (cursor.take('POLICY')) {
        const policyName = cursor.id()
        cursor.need('ON')
        const identity = cursor.relation()
        cursor.need('FOR')
        const command = cursor.id().toUpperCase(),
          commands: Record<string, string> = {
            SELECT: 'r',
            INSERT: 'a',
            UPDATE: 'w',
            DELETE: 'd',
            ALL: '*',
          }
        if (!commands[command]) throw new ProvisioningError('FAKE_POLICY_SOURCE_UNSUPPORTED')
        cursor.need('TO')
        const roles = [cursor.id()]
        while (cursor.tokens[cursor.index]?.value === ',') {
          cursor.symbol(',')
          roles.push(cursor.id())
        }
        if (roles.some((role) => role !== 'public' && !this.state.roles.includes(role)))
          throw new ProvisioningError('FAKE_ROLE_REQUIRED')
        const expression = () => {
          const opening = cursor.tokens[cursor.index]
          cursor.symbol('(')
          let depth = 1,
            closing: number | null = null
          while (cursor.index < cursor.tokens.length && depth > 0) {
            const token = cursor.tokens[cursor.index++]
            if (token.kind === 'SYMBOL' && token.value === '(') depth++
            if (token.kind === 'SYMBOL' && token.value === ')') {
              depth--
              if (depth === 0) closing = token.start
            }
          }
          if (!opening || closing === null)
            throw new ProvisioningError('FAKE_POLICY_SOURCE_UNSUPPORTED')
          return source.slice(opening.end, closing).trim()
        }
        let using: string | null = null,
          check: string | null = null
        if (cursor.take('USING')) using = expression()
        if (cursor.take('WITH')) {
          cursor.need('CHECK')
          check = expression()
        }
        cursor.end()
        const table = this.table(identity.schema, identity.name)
        const related = (schema: string | null, name: string) => {
          if (schema !== null) return this.table(schema, name)
          const path = this.state.functionContext?.searchPath
          if (!path) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
          const selected = path.find((schema) =>
            this.state.tables.some((table) => table.schema === schema && table.name === name),
          )
          if (!selected) throw new ProvisioningError('FAKE_TABLE_REQUIRED')
          return this.table(selected, name)
        }
        const enumMembers = (schema: string, name: string) =>
          this.state.enums.find((type) => type.schema === schema && type.name === name)?.members ??
          null
        const references = new Map<string, { schema: string; table: string; column: string }>()
        const recordColumn = (table: FakeReplayTable, column: FakeReplayColumn) => {
          const reference = { schema: table.schema, table: table.name, column: column.name }
          references.set(replayDigest(reference), reference)
        }
        if (using !== null)
          SourceCursor.validatePolicyExpression(
            using,
            table,
            related,
            helperExpression,
            enumMembers,
            recordColumn,
          )
        if (check !== null)
          SourceCursor.validatePolicyExpression(
            check,
            table,
            related,
            helperExpression,
            enumMembers,
            recordColumn,
          )
        if (table.policies.includes(policyName))
          throw new ProvisioningError('FAKE_DUPLICATE_POLICY')
        table.policies.push(policyName)
        this.state.policies.push({
          schema: identity.schema,
          table: identity.name,
          name: policyName,
          name_matches: true,
          command: commands[command],
          permissive: true,
          roles: roles.sort(),
          using_expression: using,
          check_expression: check,
          references: [...references.values()],
        })
        return
      }
      const unique = cursor.take('UNIQUE')
      if (cursor.take('INDEX')) {
        const guarded = cursor.take('IF')
        if (guarded) {
          cursor.need('NOT')
          cursor.need('EXISTS')
        }
        const first = cursor.id()
        let explicitSchema: string | null = null,
          indexName = first
        if (cursor.tokens[cursor.index]?.value === '.') {
          cursor.symbol('.')
          explicitSchema = first
          indexName = cursor.id()
        }
        cursor.need('ON')
        const target = cursor.relation(),
          schema = explicitSchema ?? target.schema
        if (schema !== target.schema) throw new ProvisioningError('FAKE_INDEX_NAMESPACE_MISMATCH')
        let method = 'btree'
        if (cursor.take('USING')) method = cursor.id()
        if (!['btree', 'gin', 'gist', 'hash', 'brin', 'spgist'].includes(method))
          throw new ProvisioningError('FAKE_INDEX_METHOD_UNSUPPORTED')
        const columns = cursor.columns()
        let predicate: string | null = null
        if (cursor.take('WHERE')) {
          const start = cursor.tokens[cursor.index]?.start,
            end = cursor.tokens.at(-1)?.start
          if (start === undefined || end === undefined)
            throw new ProvisioningError('FAKE_INDEX_PREDICATE_UNSUPPORTED')
          predicate = source.slice(start, end).trim()
          if (!/^(?:["\w]+\s+IS\s+NOT\s+NULL|["\w]+\s*=\s*(?:true|false))$/i.test(predicate))
            throw new ProvisioningError('FAKE_INDEX_PREDICATE_UNSUPPORTED')
          cursor.index = cursor.tokens.length - 1
        }
        cursor.end()
        const existing =
          this.state.indexes.some((index) => index.schema === schema && index.name === indexName) ||
          this.state.tables.some((table) => table.schema === schema && table.name === indexName)
        if (existing) {
          if (!guarded) throw new ProvisioningError('FAKE_DUPLICATE_INDEX')
          return
        }
        const table = this.table(target.schema, target.name)
        for (const name of columns)
          if (!table.columns.some((column) => column.name === name))
            throw new ProvisioningError('FAKE_COLUMN_REQUIRED')
        if (unique && table.rows.length > 0) {
          if (predicate !== null)
            throw new ProvisioningError('FAKE_POPULATED_UNIQUE_INDEX_UNSUPPORTED')
          this.assertUniqueRows(table, columns)
        }
        this.state.indexes.push({
          schema,
          name: indexName,
          table_schema: target.schema,
          table_name: target.name,
          kind: 'i',
          method,
          unique,
          valid: true,
          ready: true,
          live: true,
          primary: false,
          exclusion: false,
          nulls_not_distinct: false,
          predicate,
          expressions: null,
          key_count: columns.length,
          total_count: columns.length,
          columns,
          options: columns.map(() => 0),
          key_definitions: columns.map((name) => `"${name.replaceAll('"', '""')}"`),
          opclasses_default: true,
          collations_default: true,
        })
        return
      }
      if (unique) throw new ProvisioningError('FAKE_SOURCE_TRANSITION_UNSUPPORTED')
      if (cursor.take('TABLE')) {
        const definition = tableDefinition(source)
        if (!definition) throw new ProvisioningError('FAKE_TABLE_CONSTRAINT_SOURCE_UNSUPPORTED')
        const uniqueConstraints = definition.constraints.flatMap((text) => {
          const declaration = new SourceCursor(`${text};`)
          let name: string | null = null
          if (declaration.take('CONSTRAINT')) name = declaration.id()
          if (declaration.take('CHECK')) return []
          declaration.need('UNIQUE')
          const columns = declaration.columns()
          declaration.end()
          return [{ name, columns }]
        })
        const guarded = cursor.take('IF')
        if (guarded) {
          cursor.need('NOT')
          cursor.need('EXISTS')
        }
        const identity = cursor.relation()
        if (!this.state.schemas.includes(identity.schema))
          throw new ProvisioningError('FAKE_NAMESPACE_REQUIRED')
        const foreignDeclarations: { column: string; source: string }[] = []
        const columns = definition.fields.map((incoming) => {
          const raw = sqlTokens(incoming.definition)
          const reference = raw.find(
            (token) => token.kind === 'WORD' && token.value.toUpperCase() === 'REFERENCES',
          )
          if (reference)
            foreignDeclarations.push({
              column: incoming.name,
              source: incoming.definition.slice(reference.start),
            })
          const field = reference
            ? { ...incoming, definition: incoming.definition.slice(0, reference.start).trim() }
            : incoming
          const tokens = sqlTokens(field.definition)
          const unique = tokens.findIndex(
            (token) => token.kind === 'WORD' && token.value.toUpperCase() === 'UNIQUE',
          )
          if (unique < 0) return parseFakeSourceColumn(field, this.state.enums)
          if (unique !== tokens.length - 1)
            throw new ProvisioningError('FAKE_TABLE_CONSTRAINT_SOURCE_UNSUPPORTED')
          uniqueConstraints.push({ name: null, columns: [field.name] })
          return parseFakeSourceColumn(
            { ...field, definition: field.definition.slice(0, tokens[unique].start).trim() },
            this.state.enums,
          )
        })
        const existing = this.state.tables.some(
          (table) => table.schema === identity.schema && table.name === identity.name,
        )
        if (existing) {
          if (!guarded) throw new ProvisioningError('FAKE_DUPLICATE_TABLE')
          return
        }
        const checkConstraints = definition.constraints
          .filter((text) =>
            sqlTokens(text).some(
              (token) => token.kind === 'WORD' && token.value.toUpperCase() === 'CHECK',
            ),
          )
          .map((text) =>
            parseFakeCheckSource(
              text,
              columns.map((entry) => entry.column),
              (schema, name) =>
                this.state.enums.find((type) => type.schema === schema && type.name === name)
                  ?.members ?? null,
            ),
          )
        if (columns.filter((entry) => entry.primary).length > 1)
          throw new ProvisioningError('FAKE_TABLE_CONSTRAINT_SOURCE_UNSUPPORTED')
        if (
          uniqueConstraints.some((key) =>
            key.columns.some((name) => !columns.some((entry) => entry.column.name === name)),
          )
        )
          throw new ProvisioningError('FAKE_PRIMARY_COLUMN_UNSUPPORTED')
        this.state.tables.push({
          ...identity,
          kind: 'r',
          standalone: true,
          enabled: false,
          forced: false,
          rowCountVisible: true,
          columns: columns.map((entry) => entry.column),
          rows: [],
          policies: [],
          primaryKey: columns.filter((entry) => entry.primary).map((entry) => entry.column.name),
          ...(uniqueConstraints.length ? { uniqueConstraints } : {}),
          ...(checkConstraints.length ? { checkConstraints } : {}),
          ...(this.state.functionContext ? { owner: this.state.functionContext.actor } : {}),
        })
        if (this.state.functionContext)
          this.recordAclObject(
            identity.schema,
            identity.name,
            'TABLE',
            this.state.functionContext.actor,
          )
        const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
        for (const declaration of foreignDeclarations)
          this.transition(
            `ALTER TABLE ${quote(identity.schema)}.${quote(identity.name)} ADD CONSTRAINT ${quote(`${identity.name}_${declaration.column}_fkey`)} FOREIGN KEY (${quote(declaration.column)}) ${declaration.source};`,
          )
        return
      }
      cursor.need('SCHEMA')
      const guarded = cursor.take('IF')
      if (guarded) {
        cursor.need('NOT')
        cursor.need('EXISTS')
      }
      const name = cursor.id()
      cursor.end()
      if (this.state.schemas.includes(name)) {
        if (!guarded) throw new ProvisioningError('FAKE_DUPLICATE_SCHEMA')
      } else {
        this.state.schemas.push(name)
        if (this.state.functionContext)
          this.recordAclObject(name, name, 'SCHEMA', this.state.functionContext.actor)
      }
      return
    }
    if (cursor.take('ALTER')) {
      cursor.need('TABLE')
      const { schema, name } = cursor.relation()
      const commandStart = cursor.tokens[cursor.index]?.start
      if (commandStart === undefined) throw new ProvisioningError('FAKE_ALTER_COMMAND_REQUIRED')
      const clauses: string[] = []
      let clauseStart = commandStart,
        depth = 0
      for (const token of cursor.tokens.slice(cursor.index)) {
        if (token.kind !== 'SYMBOL') continue
        if (token.value === '(' || token.value === '[') depth++
        if (token.value === ')' || token.value === ']') depth--
        if (depth < 0) throw new ProvisioningError('FAKE_ALTER_SOURCE_UNSUPPORTED')
        if (depth === 0 && (token.value === ',' || token.value === ';')) {
          clauses.push(source.slice(clauseStart, token.start).trim())
          clauseStart = token.end
        }
      }
      if (depth !== 0 || clauses.some((clause) => !clause))
        throw new ProvisioningError('FAKE_ALTER_SOURCE_UNSUPPORTED')
      if (clauses.length > 1) {
        const prefix = source.slice(0, commandStart)
        for (const clause of clauses) this.transition(`${prefix}${clause};`)
        return
      }
      if (cursor.take('ADD')) {
        const namedConstraint = cursor.take('CONSTRAINT') ? cursor.id() : null
        if (cursor.take('UNIQUE')) {
          const columns = cursor.columns()
          cursor.end()
          const table = this.table(schema, name)
          const constraint = namedConstraint ?? `${name}_${columns.join('_')}_key`
          if (
            columns.length === 0 ||
            new Set(columns).size !== columns.length ||
            columns.some((column) => !table.columns.some((entry) => entry.name === column))
          )
            throw new ProvisioningError('FAKE_UNIQUE_COLUMN_REQUIRED')
          if (Buffer.byteLength(constraint) > 63)
            throw new ProvisioningError('FAKE_UNIQUE_NAME_ALLOCATION_UNSUPPORTED')
          if (
            table.uniqueConstraints?.some((entry) => entry.name === constraint) ||
            this.state.foreignKeys.some(
              (entry) =>
                entry.schema === schema && entry.table === name && entry.name === constraint,
            )
          )
            throw new ProvisioningError('FAKE_DUPLICATE_CONSTRAINT')
          const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`
          this.transition(
            `CREATE UNIQUE INDEX ${quote(schema)}.${quote(constraint)} ON ${quote(schema)}.${quote(name)} (${columns.map(quote).join(', ')});`,
          )
          table.uniqueConstraints ??= []
          table.uniqueConstraints.push({ name: constraint, columns })
          return
        }
        if (namedConstraint !== null) {
          const constraint = namedConstraint
          cursor.need('FOREIGN')
          cursor.need('KEY')
          const columns = cursor.columns()
          cursor.need('REFERENCES')
          const parent = cursor.relation(),
            parentColumns = cursor.columns()
          let deleteAction = 'a',
            updateAction = 'a'
          const assigned = new Set<string>()
          while (cursor.take('ON')) {
            const kind = cursor.id().toUpperCase()
            if (!['DELETE', 'UPDATE'].includes(kind) || assigned.has(kind))
              throw new ProvisioningError('FAKE_FOREIGN_KEY_SOURCE_UNSUPPORTED')
            assigned.add(kind)
            let action: string
            if (cursor.take('CASCADE')) action = 'c'
            else if (cursor.take('RESTRICT')) action = 'r'
            else if (cursor.take('NO')) {
              cursor.need('ACTION')
              action = 'a'
            } else {
              cursor.need('SET')
              if (cursor.take('NULL')) action = 'n'
              else {
                cursor.need('DEFAULT')
                action = 'd'
              }
            }
            if (kind === 'DELETE') deleteAction = action
            else updateAction = action
          }
          cursor.end()
          if (columns.length !== parentColumns.length)
            throw new ProvisioningError('FAKE_FOREIGN_KEY_SOURCE_UNSUPPORTED')
          const childTable = this.table(schema, name),
            parentTable = this.table(parent.schema, parent.name)
          if (
            this.state.foreignKeys.some(
              (fk) => fk.schema === schema && fk.table === name && fk.name === constraint,
            )
          )
            throw new ProvisioningError('FAKE_DUPLICATE_FOREIGN_KEY')
          if (
            replayDigest(parentTable.primaryKey) !== replayDigest(parentColumns) &&
            !this.state.indexes.some(
              (index) =>
                index.table_schema === parent.schema &&
                index.table_name === parent.name &&
                index.unique &&
                index.valid &&
                index.ready &&
                index.live &&
                index.predicate === null &&
                replayDigest(index.columns) === replayDigest(parentColumns),
            )
          )
            throw new ProvisioningError('FAKE_FOREIGN_KEY_PARENT_UNIQUE_REQUIRED')
          for (const [at, column] of columns.entries()) {
            const child = childTable.columns.find((entry) => entry.name === column),
              target = parentTable.columns.find((entry) => entry.name === parentColumns[at])
            if (!child || !target) throw new ProvisioningError('FAKE_COLUMN_REQUIRED')
            if (
              child.type_schema !== 'pg_catalog' ||
              target.type_schema !== 'pg_catalog' ||
              child.type_name !== target.type_name ||
              !['uuid', 'text', 'varchar', 'int4', 'int8', 'bool'].includes(child.type_name)
            )
              throw new ProvisioningError('FAKE_FOREIGN_KEY_EQUALITY_UNSUPPORTED')
          }
          for (const row of childTable.rows) {
            if (columns.some((column) => !Object.hasOwn(row, column)))
              throw new ProvisioningError('FAKE_ROW_COLUMN_REQUIRED')
            if (columns.some((column) => row[column] === null)) continue
            if (
              !parentTable.rows.some((parentRow) =>
                parentColumns.every((column, at) => parentRow[column] === row[columns[at]]),
              )
            )
              throw new ProvisioningError('FAKE_FOREIGN_KEY_EXISTING_ROW_VIOLATION')
          }
          this.state.foreignKeys.push({
            schema,
            table: name,
            name: constraint,
            kind: 'f',
            columns,
            parent_schema: parent.schema,
            parent_name: parent.name,
            parent_columns: parentColumns,
            delete_action: deleteAction,
            update_action: updateAction,
            match: 's',
            validated: true,
            deferrable: false,
            deferred: false,
            local: true,
            inherited: 0,
          })
          return
        }
        cursor.need('COLUMN')
        const guarded = cursor.take('IF')
        if (guarded) {
          cursor.need('NOT')
          cursor.need('EXISTS')
        }
        const token = cursor.tokens[cursor.index]
        if (!token) throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
        const columnName = cursor.id()
        const terminal = cursor.tokens.at(-1)
        if (terminal?.kind !== 'SYMBOL' || terminal.value !== ';')
          throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
        const reference = cursor.tokens.find(
          (token, index) =>
            index >= cursor.index &&
            token.kind === 'WORD' &&
            token.value.toUpperCase() === 'REFERENCES',
        )
        const parsed = parseFakeSourceColumn(
          {
            name: columnName,
            definition: source.slice(token.start, reference?.start ?? terminal.start),
          },
          this.state.enums,
        )
        const table = this.table(schema, name)
        if (table.columns.some((column) => column.name === columnName)) {
          if (!guarded) throw new ProvisioningError('FAKE_DUPLICATE_COLUMN')
          return
        }
        if (parsed.primary && (table.primaryKey.length !== 0 || table.rows.length !== 0))
          throw new ProvisioningError('FAKE_ADDED_PRIMARY_KEY_PRECONDITION_UNSUPPORTED')
        const expression = parsed.column.default_expression
        let value: string | boolean | null = null
        if (expression !== null) {
          if (expression.toLowerCase() === 'true' || expression.toLowerCase() === 'false')
            value = expression.toLowerCase() === 'true'
          else if (/^'(?:[^']|'')*'(?:\s*::\s*(?:jsonb|text))?$/.test(expression)) {
            value = sqlTokens(expression)[0].value
          } else if (table.rows.length !== 0)
            throw new ProvisioningError('FAKE_POPULATED_DYNAMIC_DEFAULT_UNSUPPORTED')
        }
        if (parsed.column.not_null && value === null && table.rows.length !== 0)
          throw new ProvisioningError('FAKE_NONNULL_COLUMN_EXISTING_ROWS')
        table.columns.push(parsed.column)
        if (parsed.primary) table.primaryKey = [columnName]
        for (const row of table.rows) row[columnName] = value
        if (reference) {
          const keyName = `${name}_${columnName}_fkey`
          if (Buffer.byteLength(keyName) > 63)
            throw new ProvisioningError('FAKE_FOREIGN_KEY_NAME_ALLOCATION_UNSUPPORTED')
          this.transition(
            `ALTER TABLE "${schema}"."${name}" ADD CONSTRAINT "${keyName}" FOREIGN KEY ("${columnName}") ${source.slice(reference.start, terminal.start)};`,
          )
        }
        return
      }
      if (cursor.take('ALTER')) {
        cursor.need('COLUMN')
        const columnName = cursor.id()
        cursor.need('SET')
        cursor.need('DEFAULT')
        const token = cursor.tokens[cursor.index++]
        if (token?.kind !== 'WORD' || !['TRUE', 'FALSE'].includes(token.value.toUpperCase()))
          throw new ProvisioningError('FAKE_COLUMN_SOURCE_UNSUPPORTED')
        cursor.end()
        const column = this.table(schema, name).columns.find((column) => column.name === columnName)
        if (!column) throw new ProvisioningError('FAKE_COLUMN_REQUIRED')
        if (column.type_schema !== 'pg_catalog' || column.type_name !== 'bool')
          throw new ProvisioningError('FAKE_COLUMN_DEFAULT_TYPE_MISMATCH')
        column.default_expression = token.value.toLowerCase()
        return
      }
      let field: 'enabled' | 'forced', value: boolean
      if (cursor.take('ENABLE')) {
        field = 'enabled'
        value = true
      } else if (cursor.take('DISABLE')) {
        field = 'enabled'
        value = false
      } else if (cursor.take('NO')) {
        cursor.need('FORCE')
        field = 'forced'
        value = false
      } else {
        cursor.need('FORCE')
        field = 'forced'
        value = true
      }
      cursor.need('ROW')
      cursor.need('LEVEL')
      cursor.need('SECURITY')
      cursor.end()
      this.table(schema, name)[field] = value
      return
    }
    if (cursor.take('DROP')) {
      cursor.need('POLICY')
      const guarded = cursor.take('IF')
      if (guarded) cursor.need('EXISTS')
      const policy = cursor.id()
      cursor.need('ON')
      const { schema, name } = cursor.relation()
      cursor.end()
      const table = this.table(schema, name)
      if (!guarded && !table.policies.includes(policy))
        throw new ProvisioningError('FAKE_POLICY_REQUIRED')
      table.policies = table.policies.filter((name) => name !== policy)
      this.state.policies = this.state.policies.filter(
        (entry) => entry.schema !== schema || entry.table !== name || entry.name !== policy,
      )
      return
    }
    if (cursor.take('UPDATE')) {
      const digest = tokenDigest(source)
      if (
        digest ===
        tokenDigest(
          'UPDATE organization_members SET exempt_from_per_capita = false WHERE exempt_from_per_capita IS NULL;',
        )
      ) {
        const table = this.table('public', 'organization_members')
        this.assertBackfillVisibility(table)
        for (const row of table.rows)
          if (row.exempt_from_per_capita === null) row.exempt_from_per_capita = false
        return
      }
      const recipe = textBackfills.find((recipe) => tokenDigest(recipe.source) === digest)
      if (!recipe) throw new ProvisioningError('FAKE_SOURCE_TRANSITION_UNSUPPORTED')
      const table = this.table('public', 'documents')
      this.assertBackfillVisibility(table)
      const nonempty = (value: string | boolean | null | undefined) => {
        if (typeof value !== 'string' && value !== null)
          throw new ProvisioningError('FAKE_ROW_TYPE_INVALID')
        return value === '' ? null : value
      }
      for (const row of table.rows) {
        if (row[recipe.column] !== null) continue
        if (recipe.column === 'name')
          row.name =
            nonempty(row.name) ?? nonempty(row.title) ?? nonempty(row.filename) ?? 'document'
        else if (recipe.column === 'uploaded_by')
          row.uploaded_by = nonempty(row.uploaded_by) ?? 'phase-g-seed'
        else {
          if (
            typeof row.id !== 'string' ||
            !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id)
          )
            throw new ProvisioningError('FAKE_ROW_UUID_REQUIRED')
          row.file_url = nonempty(row.file_url) ?? `phase-g://placeholder/${row.id.toLowerCase()}`
        }
      }
      return
    }
    throw new ProvisioningError('FAKE_SOURCE_TRANSITION_UNSUPPORTED')
  }
  private transitionHelper(source: string, cursor: SourceCursor) {
    const context = this.state.functionContext
    if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
    cursor.need('SELECT')
    let schema: string | null = null,
      name = cursor.id()
    if (cursor.tokens[cursor.index]?.value === '.') {
      cursor.symbol('.')
      schema = name
      name = cursor.id()
    }
    cursor.symbol('(')
    const argumentTypes: FakeHelperNativeType[] = []
    while (cursor.tokens[cursor.index]?.value !== ')') {
      if (argumentTypes.length) cursor.symbol(',')
      const token = cursor.tokens[cursor.index++]
      if (token?.kind === 'STRING')
        argumentTypes.push({ schema: 'pg_catalog', name: 'text', kind: 'b' })
      else if (token?.kind === 'WORD' && ['TRUE', 'FALSE'].includes(token.value.toUpperCase()))
        argumentTypes.push({ schema: 'pg_catalog', name: 'bool', kind: 'b' })
      else throw new ProvisioningError('FAKE_HELPER_CALL_UNSUPPORTED')
    }
    cursor.symbol(')')
    cursor.end()
    const candidates = this.state.functions.filter(
      (fn) =>
        fn.name === name &&
        (schema !== null ? fn.schema === schema : context.searchPath.includes(fn.schema)) &&
        argumentTypes.length <= fn.argument_count &&
        argumentTypes.length >= fn.argument_count - fn.default_count &&
        argumentTypes.every(
          (type, index) => replayDigest(type) === replayDigest(fn.argument_types[index]),
        ),
    )
    const visibleSchema =
      schema ?? context.searchPath.find((path) => candidates.some((fn) => fn.schema === path))
    const visible = candidates.filter((fn) => fn.schema === visibleSchema)
    if (visible.length !== 1)
      throw new ProvisioningError('FAKE_HELPER_FUNCTION_RESOLUTION_AMBIGUOUS')
    const fn = visible[0]
    const environment: FakeHelperEnvironment = {
      sourceHash: replayHash(source),
      actor: context.actor,
      executionRoles: [context.actor],
      searchPath: context.searchPath,
      creationSchema: context.creationSchema,
      relation: (schema, name) => {
        const table = this.state.tables.find(
          (table) => table.schema === schema && table.name === name,
        )
        if (!table) return null
        if (table.kind !== 'r' || !table.standalone)
          throw new ProvisioningError('FAKE_TABLE_SHAPE_UNSUPPORTED')
        return {
          schema,
          name,
          columns: Object.fromEntries(
            table.columns.map((column) => [
              column.name,
              {
                schema: column.type_schema,
                name: column.type_name,
                kind: column.type_kind,
                ...(column.type_kind === 'e'
                  ? {
                      enumLabels: this.state.enums.find(
                        (type) =>
                          type.schema === column.type_schema && type.name === column.type_name,
                      )?.members,
                    }
                  : {}),
              },
            ]),
          ),
        }
      },
      resolveFunction: (called, types, path) =>
        called === name &&
        path.includes(fn.schema) &&
        replayDigest(types) === replayDigest(fn.argument_types)
          ? { schema: fn.schema, name: fn.name }
          : null,
      resolveNative: (called, kind, path) => {
        for (const schema of path) {
          if (
            kind === 'function' &&
            this.state.functions.some((fn) => fn.schema === schema && fn.name === called)
          )
            return { schema, name: called }
          if (
            kind === 'type' &&
            this.state.enums.some((type) => type.schema === schema && type.name === called)
          )
            return { schema, name: called }
          const nativeNames = {
            function: ['current_setting', 'format', 'to_regclass'],
            type: ['text', 'varchar', 'bool', 'uuid', '_uuid', 'int4', 'int8', 'regclass'],
            operator: ['='],
          }
          if (schema === 'pg_catalog' && nativeNames[kind].includes(called))
            return { schema, name: called }
        }
        return null
      },
      roleExists: (role) => this.state.roles.includes(role),
      canAlterRelation: (identity, actor) =>
        this.state.tables.find(
          (table) => table.schema === identity.schema && table.name === identity.name,
        )?.owner === actor,
    }
    const program = interpretFakeHelperCall(source, fn, environment)
    for (const emission of program.emissions) {
      if (emission.actor !== context.actor)
        throw new ProvisioningError('FAKE_HELPER_INVOKER_CHANGED')
      const tokens = sqlTokens(emission.sql),
        target = emission.target
      const references = tokens.flatMap((token, index) => {
        if (token.kind !== 'WORD' || token.value.toUpperCase() !== 'FROM') return []
        const name = tokens[index + 1]
        if (
          !name ||
          !['WORD', 'IDENTIFIER'].includes(name.kind) ||
          tokens[index + 2]?.value === '.'
        )
          throw new ProvisioningError('FAKE_HELPER_EMITTED_REFERENCE_UNSUPPORTED')
        const schema = context.searchPath.find((schema) =>
          this.state.tables.some((table) => table.schema === schema && table.name === name.value),
        )
        if (!schema) throw new ProvisioningError('FAKE_HELPER_EMITTED_REFERENCE_REQUIRED')
        return [{ schema, name: name.value }]
      })
      if (replayDigest(references) !== replayDigest(emission.references))
        throw new ProvisioningError('FAKE_HELPER_EMITTED_REFERENCE_BINDING_INVALID')
      const on = tokens.findIndex(
        (token) => token.kind === 'WORD' && token.value.toUpperCase() === 'ON',
      )
      const targetIndex =
        emission.action === 'ENABLE_RLS' || emission.action === 'FORCE_RLS' ? 2 : on + 1
      const token = tokens[targetIndex]
      if (!token || !['WORD', 'IDENTIFIER'].includes(token.kind) || token.value !== target.name)
        throw new ProvisioningError('FAKE_HELPER_EMITTED_TARGET_BINDING_INVALID')
      const qualified = `"${target.schema.replaceAll('"', '""')}"."${target.name.replaceAll('"', '""')}"`
      this.transition(
        emission.sql.slice(0, token.start) + qualified + emission.sql.slice(token.end) + ';',
        true,
      )
    }
  }
  private assertBackfillVisibility(table: FakeReplayTable) {
    if (!table.rowCountVisible) throw new ProvisioningError('FAKE_COMPLETE_ROW_VISIBILITY_REQUIRED')
  }
  private nativeTypeVisibleSchema(name: string): string | null {
    const path = this.state.functionContext?.searchPath ?? ['pg_catalog']
    return (
      path.find(
        (schema) =>
          (schema === 'pg_catalog' && this.nativeType(schema, name) !== null) ||
          this.state.enums.some((type) => type.schema === schema && type.name === name),
      ) ?? null
    )
  }
  private nativeType(schema: string, name: string) {
    const native: Record<string, number> = {
      uuid: 2950,
      text: 25,
      varchar: 1043,
      numeric: 1700,
      bool: 16,
      int4: 23,
      int8: 20,
      int2: 21,
      float4: 700,
      float8: 701,
      bytea: 17,
      inet: 869,
      tsvector: 3614,
      jsonb: 3802,
      json: 114,
      date: 1082,
      time: 1083,
      timestamptz: 1184,
      timestamp: 1114,
      _text: 1009,
      _uuid: 2951,
      _varchar: 1015,
      _int2: 1005,
      _int4: 1007,
      _int8: 1016,
      _numeric: 1231,
      _float4: 1021,
      _float8: 1022,
      _bool: 1000,
      _bytea: 1001,
      _inet: 1041,
      _json: 199,
      _jsonb: 3807,
      _date: 1182,
      _time: 1183,
      _timestamp: 1115,
      _timestamptz: 1185,
      void: 2278,
      trigger: 2279,
    }
    if (schema === 'pg_catalog' && native[name])
      return {
        oid: String(native[name]),
        kind: 'b',
        collation: ['text', 'varchar', '_text', '_varchar'].includes(name) ? '100' : '0',
        element_schema: name.startsWith('_') ? 'pg_catalog' : null,
        element_name: name.startsWith('_') ? name.slice(1) : null,
        members: null,
      }
    const index = this.state.enums.findIndex((type) => type.schema === schema && type.name === name)
    return index < 0
      ? null
      : {
          oid: String(40000 + index),
          kind: 'e',
          collation: '0',
          element_schema: null,
          element_name: null,
          members: structuredClone(this.state.enums[index].members),
        }
  }
  private originalColumns(table: FakeReplayTable) {
    return table.columns.map((column) => {
      const type = this.nativeType(column.type_schema, column.type_name)
      if (!type)
        throw new ProvisioningError(
          `FAKE_PHYSICAL_TYPE_REQUIRED:${table.schema}.${table.name}.${column.name}:${column.type_schema}.${column.type_name}`,
        )
      const varchar = /^character varying\((\d+)\)(?:\[\])*$/.exec(column.postgres_type)
      const numeric = /^numeric\((\d+),(\d+)\)(?:\[\])*$/.exec(column.postgres_type)
      const typmod = varchar
        ? Number(varchar[1]) + 4
        : numeric
          ? Number(numeric[1]) * 65536 + Number(numeric[2]) + 4
          : -1
      return { ...structuredClone(column), type_oid: type.oid, typmod, collation: type.collation }
    })
  }
  private defaultColumn(table: FakeReplayTable, name: string) {
    const column = this.originalColumns(table).find((column) => column.name === name)
    if (!column) return null
    const io = Object.entries(fakeNativeTypeIo).find(([name]) => name === column.type_name)?.[1]
    const input =
      column.type_kind === 'e'
        ? 'enum_in'
        : (io?.input ?? (column.type_name === 'bool' ? 'boolin' : null))
    if (!input) throw new ProvisioningError('FAKE_DEFAULT_NATIVE_INPUT_REQUIRED')
    const expression = column.default_expression
    const random =
      expression !== null &&
      sqlTokens(expression).some(
        (token) => token.kind === 'WORD' && token.value === 'gen_random_uuid',
      )
    if (
      random &&
      !['gen_random_uuid()', `(gen_random_uuid())::${column.postgres_type}`].includes(expression!)
    )
      throw new ProvisioningError('FAKE_DEFAULT_EXPRESSION_UNSUPPORTED')
    if (
      expression !== null &&
      !random &&
      !/^(?:true|false|null|'(?:[^']|'')*'(?:\s*::\s*[\w."]+)?)$/i.test(expression)
    )
      throw new ProvisioningError('FAKE_DEFAULT_EXPRESSION_UNSUPPORTED')
    const functions = random ? ['3432'] : []
    if (random && column.type_name === 'varchar' && column.typmod !== -1)
      functions.push(
        this.sourceObjectOid('native-function', 'pg_catalog', 'varchar(varchar,int4,bool)'),
      )
    return {
      name: column.name,
      type_oid: column.type_oid,
      typmod: column.typmod,
      type_name: column.type_name,
      type_schema: column.type_schema,
      type_kind: column.type_kind,
      category:
        column.type_kind === 'e'
          ? 'E'
          : ['text', 'varchar'].includes(column.type_name)
            ? 'S'
            : column.type_name === 'bool'
              ? 'B'
              : 'U',
      base_oid: '0',
      postgres_type: column.postgres_type,
      not_null: column.not_null,
      identity: column.identity,
      generated: column.generated,
      input_schema: 'pg_catalog',
      input_name: input,
      input_language: 'internal',
      input_source: input,
      labels: structuredClone(
        this.state.enums.find(
          (type) => type.schema === column.type_schema && type.name === column.type_name,
        )?.members ?? [],
      ),
      default_expression: expression,
      default_functions: functions.sort(),
      function_dependencies: [],
      type_dependencies: column.type_kind === 'e' && expression !== null ? [column.type_oid] : [],
    }
  }
  private assertDefaultGeneratorResolution() {
    const context = this.state.functionContext
    if (
      !context ||
      context.searchPath[0] !== 'pg_catalog' ||
      this.state.functions.some(
        (fn) => fn.name === 'gen_random_uuid' && context.searchPath.includes(fn.schema),
      )
    )
      throw new ProvisioningError('FAKE_DEFAULT_NATIVE_GENERATOR_REQUIRED')
  }
  private originalPrimary(
    table: FakeReplayTable,
    kind: 'p' | 'u' = 'p',
    name: string | null = null,
    keyPosition = 0,
  ): OriginalConstraintCatalog[] {
    if (!table.primaryKey.length) return []
    const columns = this.originalColumns({
        ...table,
        columns: table.columns.filter((column) => table.primaryKey.includes(column.name)),
      }),
      keys = table.primaryKey.map((name) => {
        const column = columns.find((column) => column.name === name)
        if (!column) throw new ProvisioningError('FAKE_PRIMARY_COLUMN_UNSUPPORTED')
        const opclasses: Record<string, string> = {
          uuid: 'uuid_ops',
          text: 'text_ops',
          varchar: 'text_ops',
          int4: 'int4_ops',
          int8: 'int8_ops',
          bool: 'bool_ops',
          numeric: 'numeric_ops',
          date: 'date_ops',
          timestamp: 'timestamp_ops',
          timestamptz: 'timestamptz_ops',
        }
        const enumKey = table.columns.some(
          (entry) =>
            entry.name === name &&
            entry.type_kind === 'e' &&
            this.state.enums.some(
              (type) => type.schema === entry.type_schema && type.name === entry.type_name,
            ),
        )
        const family =
          column.type_schema === 'pg_catalog'
            ? opclasses[column.type_name]
            : enumKey
              ? 'enum_ops'
              : null
        if (!family) throw new ProvisioningError('FAKE_PRIMARY_COLUMN_UNSUPPORTED')
        return {
          name,
          option: 0,
          collation: column.collation,
          opclass_schema: 'pg_catalog',
          opclass: family,
          family_schema: 'pg_catalog',
          family: ['int4', 'int8'].includes(column.type_name)
            ? 'integer_ops'
            : ['timestamp', 'timestamptz'].includes(column.type_name)
              ? 'datetime_ops'
              : family,
        }
      })
    return [
      {
        name:
          name ??
          (kind === 'p' ? `${table.name}_pkey` : `${table.name}_${table.primaryKey.join('_')}_key`),
        kind,
        validated: true,
        deferrable: false,
        deferred: false,
        index_oid: String(
          50000 +
            this.state.tables.findIndex(
              (entry) => entry.schema === table.schema && entry.name === table.name,
            ) *
              100 +
            keyPosition,
        ),
        local: true,
        inherited: 0,
        no_inherit: true,
        definition: `${kind === 'p' ? 'PRIMARY KEY' : 'UNIQUE'} (${table.primaryKey.map((name) => `"${name.replaceAll('"', '""')}"`).join(', ')})`,
        columns: [...table.primaryKey],
        parent_schema: null,
        parent_name: null,
        parent_columns: [],
        delete_action: ' ',
        update_action: ' ',
        match_type: ' ',
        backing: {
          unique: true,
          valid: true,
          ready: true,
          live: true,
          primary: kind === 'p',
          exclusion: false,
          immediate: true,
          key_count: keys.length,
          total_count: keys.length,
          nulls_not_distinct: false,
          predicate: null,
          expressions: null,
          method: 'btree',
          keys,
        },
        operators: null,
        non_native_dependencies: [],
      },
    ]
  }
  private originalKeys(table: FakeReplayTable): OriginalConstraintCatalog[] {
    return [
      ...this.originalPrimary(table),
      ...(table.uniqueConstraints ?? []).flatMap((key, index) =>
        this.originalPrimary({ ...table, primaryKey: key.columns }, 'u', key.name, index + 1),
      ),
    ]
  }
  private nativeEquality(name: string) {
    const functions: Record<string, string> = {
      uuid: 'uuid_eq',
      text: 'texteq',
      int4: 'int4eq',
      int8: 'int8eq',
      numeric: 'numeric_eq',
      timestamp: 'timestamp_eq',
      timestamptz: 'timestamptz_eq',
      anyenum: 'enum_eq',
    }
    const functionName = functions[name]
    if (!functionName) throw new ProvisioningError('FAKE_NATIVE_OPERATOR_UNSUPPORTED')
    return {
      schema: 'pg_catalog',
      name: '=',
      function_schema: 'pg_catalog',
      function_name: functionName,
      function_language: 'internal',
      result_schema: 'pg_catalog',
      result_type: 'bool',
      left_schema: 'pg_catalog',
      left_type: name,
      right_schema: 'pg_catalog',
      right_type: name,
    }
  }
  private originalConstraints(table: FakeReplayTable): OriginalConstraintCatalog[] {
    const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
    const fks = this.state.foreignKeys.filter(
      (fk) => fk.schema === table.schema && fk.table === table.name,
    )
    return [
      ...this.originalKeys(table),
      ...(table.checkConstraints ?? []).map((check, index) => ({
        name: check.name ?? `${table.name}_check${index ? index : ''}`,
        kind: 'c',
        validated: true,
        deferrable: false,
        deferred: false,
        index_oid: '0',
        local: true,
        inherited: 0,
        no_inherit: false,
        definition: `CHECK (${check.expression})`,
        columns: [...check.columns],
        parent_schema: null,
        parent_name: null,
        parent_columns: [],
        delete_action: ' ',
        update_action: ' ',
        match_type: ' ',
        backing: null,
        operators: null,
        non_native_dependencies: [],
      })),
      ...fks.map((fk) => {
        const parent = this.table(fk.parent_schema, fk.parent_name)
        const key = this.originalKeys(parent).find(
          (key) => replayDigest(key.columns) === replayDigest(fk.parent_columns),
        )
        if (!key) throw new ProvisioningError('FAKE_FOREIGN_PARENT_UNIQUENESS_REQUIRED')
        const operators = fk.columns.map((name) => {
          const column = table.columns.find((column) => column.name === name)
          if (!column || column.type_schema !== 'pg_catalog')
            throw new ProvisioningError('FAKE_FOREIGN_COLUMN_TYPE_UNSUPPORTED')
          return this.nativeEquality(column.type_name === 'varchar' ? 'text' : column.type_name)
        })
        const actions: Record<string, string> = {
          a: 'NO ACTION',
          c: 'CASCADE',
          r: 'RESTRICT',
          n: 'SET NULL',
          d: 'SET DEFAULT',
        }
        return {
          name: fk.name,
          kind: fk.kind,
          validated: fk.validated,
          deferrable: fk.deferrable,
          deferred: fk.deferred,
          index_oid: key.index_oid,
          local: fk.local,
          inherited: fk.inherited,
          no_inherit: true,
          definition: `FOREIGN KEY (${fk.columns.map(quote).join(', ')}) REFERENCES ${quote(fk.parent_schema)}.${quote(fk.parent_name)}(${fk.parent_columns.map(quote).join(', ')}) ON DELETE ${actions[fk.delete_action]} ON UPDATE ${actions[fk.update_action]}`,
          columns: [...fk.columns],
          parent_schema: fk.parent_schema,
          parent_name: fk.parent_name,
          parent_columns: [...fk.parent_columns],
          delete_action: fk.delete_action,
          update_action: fk.update_action,
          match_type: fk.match,
          backing: structuredClone(key.backing),
          operators: [...operators, ...operators, ...operators],
          non_native_dependencies: [],
        }
      }),
    ]
  }
  private recordAclObject(schema: string, name: string, kind: FakeAclKind, owner: string) {
    const privileges =
      kind === 'SCHEMA'
        ? ['CREATE', 'USAGE']
        : kind === 'SEQUENCE'
          ? ['SELECT', 'UPDATE', 'USAGE']
          : [
              'SELECT',
              'INSERT',
              'UPDATE',
              'DELETE',
              'TRUNCATE',
              'REFERENCES',
              'TRIGGER',
              'MAINTAIN',
            ]
    this.state.acl.objects.push({
      schema,
      name,
      kind,
      owner,
      grants: privileges
        .map((privilege) => ({
          grantor: owner,
          grantee: owner,
          privilege,
          grantable: false,
        }))
        .concat(
          kind === 'SCHEMA'
            ? []
            : structuredClone(
                this.state.acl.defaults.find(
                  (entry) =>
                    entry.schema === schema && entry.owner === owner && entry.kind === kind,
                )?.grants ?? [],
              ),
        ),
    })
  }
  private sourceObjectOid(kind: string, schema: string, name: string) {
    return String(100000 + Number.parseInt(replayDigest([kind, schema, name]).slice(0, 7), 16))
  }
  private helperCatalog(sql: string, parameters: string[]): unknown[] {
    const context = this.state.functionContext
    if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
    const [first, second] = parameters
    const visible = (schema: string, name: string) =>
      context.searchPath.find((path) =>
        this.state.tables.some((table) => table.schema === path && table.name === name),
      ) === schema
    const nativeVisible = (name: string) =>
      context.searchPath.includes('pg_catalog') &&
      !this.state.functions.some(
        (fn) =>
          fn.name === name &&
          context.searchPath.includes(fn.schema) &&
          context.searchPath.indexOf(fn.schema) < context.searchPath.indexOf('pg_catalog'),
      )
    if (sql === helperCatalogQueries.context)
      return [{ role: context.actor, search_path: [...context.searchPath] }]
    if (sql === helperCatalogQueries.relation) {
      const table = this.state.tables.find(
        (table) => table.schema === first && table.name === second,
      )
      return table
        ? [
            {
              oid: this.sourceObjectOid('table', first, second),
              schema: first,
              name: second,
              kind: table.kind,
              enabled: table.enabled,
              forced: table.forced,
              visible: visible(first, second),
              inheritance: table.standalone ? 0 : 1,
            },
          ]
        : []
    }
    if (sql === helperCatalogQueries.column) {
      const table = this.state.tables.find(
        (table) => this.sourceObjectOid('table', table.schema, table.name) === first,
      )
      const column = table?.columns.find((column) => column.name === second)
      if (!table || !column) return []
      const io = Object.entries(fakeNativeTypeIo).find(([name]) => name === column.type_name)?.[1]
      if (column.type_schema !== 'pg_catalog' || column.type_kind !== 'b' || !io)
        throw new ProvisioningError('FAKE_HELPER_NATIVE_COLUMN_TYPE_UNSUPPORTED')
      return [
        {
          name: column.name,
          schema: column.type_schema,
          type: column.type_name,
          kind: column.type_kind,
          oid: io.oid,
          element: column.type_name === '_uuid' ? '2950' : '0',
          relation: first,
          input_body: io.input,
          output_body: io.output,
          input_oid: io.inputOid,
          output_oid: io.outputOid,
          number: table.columns.indexOf(column) + 1,
          collation: column.collation_default
            ? ['text', 'varchar'].includes(column.type_name)
              ? '100'
              : '0'
            : '999',
        },
      ]
    }
    if (sql === helperCatalogQueries.functionResolution) {
      return this.state.functions
        .filter((fn) => fn.name === first)
        .map((fn) => ({
          oid: this.sourceObjectOid('function', fn.schema, fn.name),
          schema: fn.schema,
          name: fn.name,
          visible:
            context.searchPath.find((path) =>
              this.state.functions.some(
                (candidate) =>
                  candidate.schema === path &&
                  candidate.name === fn.name &&
                  replayDigest(candidate.argument_types) === replayDigest(fn.argument_types),
              ),
            ) === fn.schema,
          argument_oids: fn.argument_types
            .map((type) => {
              const row = this.nativeType(type.schema, type.name)
              if (!row) throw new ProvisioningError('FAKE_FUNCTION_ARGUMENT_TYPE_REQUIRED')
              return row.oid
            })
            .join(' '),
        }))
    }
    if (sql === helperCatalogQueries.builtin) {
      const row = fakeNativeBuiltin(first, nativeVisible(first.split('(')[0]))
      return row ? [row] : []
    }
    if (sql === helperCatalogQueries.overloads) {
      return [
        ...fakeNativeOverloads(first).filter(() => nativeVisible(first)),
        ...this.state.functions
          .filter((fn) => fn.name === first && context.searchPath.includes(fn.schema))
          .map((fn) => ({
            oid: this.sourceObjectOid('function', fn.schema, fn.name),
            schema: fn.schema,
            name: fn.name,
            argument_oids: fn.argument_types
              .map((type) => {
                const row = this.nativeType(type.schema, type.name)
                if (!row) throw new ProvisioningError('FAKE_FUNCTION_ARGUMENT_TYPE_REQUIRED')
                return row.oid
              })
              .join(' '),
            variadic: '0',
          })),
      ]
    }
    if (sql === helperCatalogQueries.operator) {
      const row = fakeNativeEquality(first, context.searchPath.includes('pg_catalog'))
      return row ? [row] : []
    }
    if (sql === helperCatalogQueries.cast) {
      if ((first === '1043' && second === '25') || (first === '25' && second === '1043'))
        return [{ method: 'b', context: 'i', function: '0' }]
      const known = new Set<string>(Object.values(fakeNativeTypeIo).map((type) => type.oid))
      if (!known.has(first) || !known.has(second))
        throw new ProvisioningError('FAKE_NATIVE_CAST_UNSUPPORTED')
      return []
    }
    if (sql === helperCatalogQueries.dependencies) {
      const table = this.state.tables.find(
        (table) => this.sourceObjectOid('table', table.schema, table.name) === first,
      )
      const policy =
        table &&
        this.state.policies.find(
          (policy) =>
            policy.schema === table.schema && policy.table === table.name && policy.name === second,
        )
      if (!policy) return []
      if (!policy.references)
        throw new ProvisioningError('FAKE_POLICY_DEPENDENCY_METADATA_REQUIRED')
      return [
        { catalog: 'pg_class', oid: first, subid: 0, kind: 'a' },
        ...policy.references.map((reference) => {
          const relation = this.table(reference.schema, reference.table)
          const index = relation.columns.findIndex((column) => column.name === reference.column)
          if (index < 0) throw new ProvisioningError('FAKE_COLUMN_REQUIRED')
          return {
            catalog: 'pg_class',
            oid: this.sourceObjectOid('table', reference.schema, reference.table),
            subid: index + 1,
            kind: 'n',
          }
        }),
      ]
    }
    throw new ProvisioningError('FAKE_HELPER_CATALOG_QUERY_UNSUPPORTED')
  }
  async query(sql: string, parameters: string[]): Promise<unknown[]> {
    const [schema, name] = parameters
    if (sql === aclQueries.actor) {
      if (!this.state.functionContext) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
      return [{ actor: this.state.functionContext.actor }]
    }
    if (sql === aclQueries.role) return this.state.roles.includes(schema) ? [{ name: schema }] : []
    if (sql === aclQueries.schema)
      return this.state.schemas.includes(schema) ? [{ name: schema }] : []
    if (sql === aclQueries.objects)
      return this.state.acl.objects
        .filter((object) => object.schema === schema && object.kind === name)
        .map((object) => ({ schema: object.schema, name: object.name, kind: object.kind }))
        .sort((a, b) => a.name.localeCompare(b.name))
    if (sql === aclQueries.table) {
      const table = this.state.tables.find(
        (table) => table.schema === schema && table.name === name,
      )
      const sequence = this.state.acl.objects.find(
        (object) => object.schema === schema && object.name === name && object.kind === 'SEQUENCE',
      )
      if (table && sequence) throw new ProvisioningError('FAKE_ACL_RELATION_IDENTITY_COLLISION')
      if (sequence) return [{ name: sequence.name, kind: 'S' }]
      return table ? [{ name: table.name, kind: table.kind }] : []
    }
    if (sql === aclQueries.tableAcl || sql === aclQueries.schemaAcl) {
      const objects = this.state.acl.objects.filter(
        (object) =>
          object.schema === schema &&
          object.name === (sql === aclQueries.schemaAcl ? schema : name) &&
          (sql === aclQueries.schemaAcl
            ? object.kind === 'SCHEMA'
            : ['TABLE', 'SEQUENCE'].includes(object.kind)),
      )
      if (objects.length !== 1) throw new ProvisioningError('FAKE_ACL_OBJECT_METADATA_REQUIRED')
      const object = objects[0]
      return structuredClone(object.grants).sort((a, b) =>
        replayDigest(a).localeCompare(replayDigest(b)),
      )
    }
    if (sql === aclQueries.defaultAcl) {
      const kind = parameters[2] === 'r' ? 'TABLE' : parameters[2] === 'S' ? 'SEQUENCE' : null
      if (!kind) throw new ProvisioningError('FAKE_ACL_DEFAULT_KIND_UNSUPPORTED')
      return structuredClone(
        this.state.acl.defaults.find(
          (entry) => entry.schema === schema && entry.owner === name && entry.kind === kind,
        )?.grants ?? [],
      )
    }
    if (sql === nullableColumnQueries.target) {
      const table = this.state.tables.find(
        (table) => table.schema === schema && table.name === name,
      )
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
      return table
        ? [
            {
              kind: table.kind,
              standalone: table.standalone,
              visible:
                context.searchPath.find((schema) =>
                  this.state.tables.some((table) => table.schema === schema && table.name === name),
                ) === schema,
              alterable: table.owner === context.actor,
            },
          ]
        : []
    }
    if (Object.values(helperCatalogQueries).includes(sql))
      return this.helperCatalog(sql, parameters)
    if (sql === declarativeQueries.creationSchema) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
      return [{ creation_schema: context.creationSchema }]
    }
    if (sql === declarativeQueries.schemaPrivilege) {
      const row = this.state.schemaPermissions.find(
        (row) => row.role === schema && row.schema === name,
      )
      const grants =
        this.state.acl.objects.find((object) => object.kind === 'SCHEMA' && object.name === name)
          ?.grants ?? []
      return [
        {
          usage:
            row?.usage ??
            grants.some((grant) => grant.grantee === schema && grant.privilege === 'USAGE'),
          create:
            row?.create ??
            grants.some((grant) => grant.grantee === schema && grant.privilege === 'CREATE'),
        },
      ]
    }
    if (sql === declarativeQueries.resolvedType) {
      const display = schema
        .replace(/\(\d+(?:,\d+)?\)/g, '')
        .trim()
        .toLowerCase()
      const native =
        display === 'character varying' || display === 'varchar'
          ? 'varchar'
          : nativeTypes[display]?.name
      if (native) {
        const visible = this.nativeTypeVisibleSchema(native)
        const type = visible === null ? null : this.nativeType(visible, native)
        return type ? [{ schema: visible, name: native, oid: type.oid }] : []
      }
      const tokens = sqlTokens(schema)
      if (tokens.length !== 1 && !(tokens.length === 3 && tokens[1].value === '.'))
        throw new ProvisioningError('FAKE_TYPE_RESOLUTION_UNSUPPORTED')
      const name = tokens.at(-1)!.value
      const namespace = tokens.length === 3 ? tokens[0].value : this.nativeTypeVisibleSchema(name)
      const type = namespace === null ? null : this.nativeType(namespace, name)
      return type ? [{ schema: namespace, name, oid: type.oid }] : []
    }
    if (sql === declarativeQueries.eventTriggers)
      return structuredClone(this.state.eventTriggers.filter((trigger) => trigger.enabled !== 'D'))
    if (sql === positionAuthorityQueries.snapshot) {
      if (!this.state.functionContext || !this.state.database)
        throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      return [
        {
          snapshot: '1:1:',
          observed_at: `fake-observation-${++FakeReplayCatalog.observedRead}`,
          backend: '1',
        },
      ]
    }
    if (sql === positionAuthorityQueries.creation) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      const explicitPath = context.searchPath.filter((schema) =>
        this.state.schemas.includes(schema),
      )
      if (explicitPath[0] !== context.creationSchema)
        throw new ProvisioningError('FAKE_POSITION_CREATION_PATH_DRIFT')
      return [{ schema: context.creationSchema, explicit_path: explicitPath }]
    }
    if (sql === positionAuthorityQueries.schemas) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      return [...this.state.schemas].sort().map((name) => {
        const permissions = this.state.schemaPermissions.find(
          (permission) => permission.role === context.actor && permission.schema === name,
        )
        return {
          name,
          usable: permissions?.usage === true,
          creatable: permissions?.create === true,
        }
      })
    }
    if (sql === positionAuthorityQueries.actor) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      return this.state.roles.includes(context.actor)
        ? [{ name: context.actor, superuser: false, bypass_rls: false }]
        : []
    }
    if (sql === positionAuthorityQueries.ownerUsage) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      return this.state.roles.includes(schema)
        ? [{ name: schema, usable: schema === context.actor }]
        : []
    }
    if (sql === positionAuthorityQueries.inventory) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      const visible = (schema: string, name: string) =>
        context.searchPath.find((namespace) =>
          this.state.tables.some((table) => table.schema === namespace && table.name === name),
        ) === schema
      return this.state.tables
        .filter((table) => ['r', 'p', 'v', 'm', 'f', 'S'].includes(table.kind))
        .map((table) => {
          if (!table.owner) throw new ProvisioningError('FAKE_POSITION_TABLE_OWNER_REQUIRED')
          return {
            schema: table.schema,
            name: table.name,
            kind: table.kind,
            owner: table.owner,
            enabled: table.enabled,
            forced: table.forced,
            owner_usage: table.owner === context.actor,
            selectable:
              table.owner === context.actor ||
              this.state.acl.objects.some(
                (object) =>
                  object.schema === table.schema &&
                  object.name === table.name &&
                  object.grants.some(
                    (grant) =>
                      ['PUBLIC', context.actor].includes(grant.grantee) &&
                      grant.privilege === 'SELECT',
                  ),
              ),
            visible: visible(table.schema, table.name),
          }
        })
        .sort((a, b) => `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`))
    }
    if (sql === positionAuthorityQueries.functionDefaults) {
      const context = this.state.functionContext
      if (!context || schema !== context.actor || name !== context.creationSchema)
        throw new ProvisioningError('FAKE_POSITION_FUNCTION_DEFAULT_CONTEXT_REQUIRED')
      return structuredClone(context.defaultAcl)
    }
    if (sql === positionAuthorityQueries.schemaGrantor) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      const object = this.state.acl.objects.find(
        (object) => object.kind === 'SCHEMA' && object.schema === schema,
      )
      return object?.owner === context.actor ? [{ grantor: object.owner }] : []
    }
    if (sql === positionAuthorityQueries.databaseGrantor) {
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      return schema === this.state.database && this.state.databaseOwner === context.actor
        ? [{ grantor: this.state.databaseOwner }]
        : []
    }
    if (sql === positionAuthorityQueries.foreignKeys)
      return this.state.foreignKeys
        .filter((key) => key.schema === schema && key.table === name)
        .map((key) => ({
          ...structuredClone(key),
          oid: String(
            60000 +
              Number.parseInt(replayHash(`${key.schema}.${key.table}.${key.name}`).slice(0, 7), 16),
          ),
          child_schema: key.schema,
          child_name: key.table,
        }))
    if (sql === proceduralQueries.identity) {
      const context = this.state.functionContext
      if (!context || !this.state.database)
        throw new ProvisioningError('FAKE_POSITION_IDENTITY_REQUIRED')
      return [
        {
          actor: context.actor,
          database: this.state.database,
          search_path: [...context.searchPath],
        },
      ]
    }
    if (sql === proceduralQueries.databaseAcl)
      return schema === this.state.database
        ? this.state.databaseGrants.map((grant) => ({
            database: schema,
            ...structuredClone(grant),
          }))
        : []
    if (sql === proceduralQueries.policies) {
      const commands: Record<string, string> = {
        '*': 'ALL',
        r: 'SELECT',
        a: 'INSERT',
        w: 'UPDATE',
        d: 'DELETE',
      }
      return this.state.policies
        .map((policy) => {
          const command = commands[policy.command]
          if (!command) throw new ProvisioningError('FAKE_GUARD_POLICY_COMMAND_UNSUPPORTED')
          return {
            schemaname: policy.schema,
            tablename: policy.table,
            policyname: policy.name,
            cmd: command,
            roles: [...policy.roles],
            qual: policy.using_expression,
            source_prohibited:
              policy.using_expression === null
                ? null
                : fakeGuardIlike(policy.using_expression, '%IS NULL%') === true &&
                  fakeGuardIlike(policy.using_expression, '%current_org_id%') === true,
          }
        })
        .sort((a, b) =>
          `${a.schemaname}.${a.tablename}.${a.policyname}`.localeCompare(
            `${b.schemaname}.${b.tablename}.${b.policyname}`,
          ),
        )
    }
    if (sql === proceduralQueries.trigger) {
      const trigger = this.state.triggers.find(
        (trigger) =>
          trigger.schema === schema && trigger.table === name && trigger.name === parameters[2],
      )
      return trigger
        ? [
            {
              name: trigger.name,
              type: 23,
              enabled: 'O',
              internal: false,
              arguments: 0,
              argument_bytes: '\\x',
              constraint_oid: '0',
              deferrable: false,
              deferred: false,
              qualification: null,
              old_table: null,
              new_table: null,
              function_schema: trigger.function_schema,
              function_name: trigger.function_name,
            },
          ]
        : []
    }
    if (sql === proceduralQueries.defaultColumn) {
      const table = this.state.tables.find(
        (table) => table.schema === schema && table.name === name,
      )
      const column = table ? this.defaultColumn(table, parameters[2]) : null
      return column ? [column] : []
    }
    if (sql === proceduralQueries.defaultGenerator) {
      this.assertDefaultGeneratorResolution()
      return [
        {
          oid: '3432',
          schema: 'pg_catalog',
          name: 'gen_random_uuid',
          language: 'internal',
          source: 'gen_random_uuid',
          binary: null,
          arguments: 0,
          kind: 'f',
          volatility: 'v',
          set_returning: false,
          security_definer: false,
          configuration: null,
          result: 'uuid',
          result_schema: 'pg_catalog',
          executable: true,
          extension: null,
        },
      ]
    }
    if (sql === proceduralQueries.defaultGeneratorCandidates) {
      this.assertDefaultGeneratorResolution()
      return [{ oid: '3432', schema: 'pg_catalog', arguments: 0, defaults: 0, variadic: '0' }]
    }
    if (sql === proceduralQueries.uuidAssignmentCast) {
      if (
        !this.state.tables.some((table) =>
          table.columns.some(
            (column) => this.nativeType(column.type_schema, column.type_name)?.oid === schema,
          ),
        )
      )
        throw new ProvisioningError('FAKE_DEFAULT_CAST_TYPE_REQUIRED')
      return []
    }
    if (sql === proceduralQueries.nativeTypmod) {
      if (schema !== 'varchar' || name !== '1043')
        throw new ProvisioningError('FAKE_DEFAULT_TYPEMOD_UNSUPPORTED')
      return [
        {
          oid: this.sourceObjectOid('native-function', 'pg_catalog', 'varchar(varchar,int4,bool)'),
          name: 'varchar',
          source: 'varchar',
          language: 'internal',
        },
      ]
    }
    if (sql === proceduralQueries.defaultPrivileges) {
      const table = this.state.tables.find(
        (table) => table.schema === schema && table.name === name,
      )
      const context = this.state.functionContext
      if (!context) throw new ProvisioningError('FAKE_FUNCTION_CONTEXT_REQUIRED')
      if (!table) return []
      const column = table.columns.some((column) => column.name === parameters[2]),
        owner = table.owner === context.actor
      return [
        {
          can_alter: owner,
          can_select: column && table.rowCountVisible,
          can_update: column && owner,
          constraints: this.originalConstraints(table)
            .filter((constraint) => ['c', 'f', 'x'].includes(constraint.kind))
            .map((constraint) => constraint.definition),
          triggers: this.state.triggers
            .filter((trigger) => trigger.schema === schema && trigger.table === name)
            .map((trigger) => `CREATE TRIGGER ${trigger.name}`),
          rules: [],
        },
      ]
    }
    const categoryCount =
      /^SELECT member_category::text AS value,count\(\*\)::text AS total FROM "([a-z_][a-z0-9_]*)"\."organization_members" GROUP BY member_category ORDER BY member_category NULLS FIRST$/.exec(
        sql,
      )
    if (categoryCount) {
      const table = this.table(categoryCount[1], 'organization_members')
      this.assertBackfillVisibility(table)
      const counts = new Map<string | null, number>()
      for (const row of table.rows) {
        if (
          !Object.hasOwn(row, 'member_category') ||
          (typeof row.member_category !== 'string' && row.member_category !== null)
        )
          throw new ProvisioningError('FAKE_ROW_COLUMN_REQUIRED')
        counts.set(row.member_category, (counts.get(row.member_category) ?? 0) + 1)
      }
      return [...counts]
        .map(([value, total]) => ({ value, total: String(total) }))
        .sort((a, b) =>
          a.value === null ? -1 : b.value === null ? 1 : a.value.localeCompare(b.value),
        )
    }
    if (sql === memberDocumentsAggregateQuery('public', 'public')) {
      const observed = fakeMemberDocumentGroups(
        this.table('public', 'member_documents'),
        this.table('public', 'organization_members'),
      )
      return [
        {
          null_rows: String(observed.nullRows.length),
          zero_match_groups: String(observed.zero),
          multi_match_groups: String(observed.multiple),
        },
      ]
    }
    if (sql === originalRelationQueries.type) {
      const type = this.nativeType(schema, name)
      return type ? [type] : []
    }
    if (sql === originalRelationQueries.operator) {
      const base = this.nativeEquality(name)
      if (schema === '=') return [base]
      const functionName =
        schema === '<>' && name === 'anyenum'
          ? 'enum_ne'
          : schema === '>' && ['timestamp', 'timestamptz'].includes(name)
            ? `${name}_gt`
            : null
      if (!functionName) throw new ProvisioningError('FAKE_NATIVE_OPERATOR_UNSUPPORTED')
      return [{ ...base, name: schema, function_name: functionName }]
    }
    if (sql === createCatalogQueries.namespace || sql === functionCatalogQueries.namespace)
      return this.state.schemas.includes(schema) ? [{ name: schema }] : []
    if (sql === functionCatalogQueries.owner)
      return this.state.roles.includes(schema) ? [{ name: schema }] : []
    if (sql === functionCatalogQueries.type) {
      const kind = ['void', 'trigger'].includes(name)
        ? 'p'
        : Object.values(nativeTypes).some((type) => type.name === name)
          ? 'b'
          : null
      return schema === 'pg_catalog' && kind
        ? [{ schema, name, kind, visible: this.nativeTypeVisibleSchema(name) === schema }]
        : []
    }
    if (sql === functionCatalogQueries.language)
      return ['sql', 'plpgsql'].includes(schema) && this.state.roles.includes(name)
        ? [{ name: schema, trusted: true, owner_usage: true }]
        : []
    if (sql === functionCatalogQueries.functions) return this.inspectFunctions(schema, name)
    if (sql === catalogQueries.type) {
      const type = this.state.enums.find((entry) => entry.schema === schema && entry.name === name)
      if (type) return [{ kind: 'e', members: structuredClone(type.members) }]
      return (schema === 'pg_catalog' &&
        Object.values(nativeTypes).some((type) => type.name === name)) ||
        (schema === 'pg_catalog' && ['numeric', 'varchar'].includes(name))
        ? [{ kind: 'b' }]
        : []
    }
    if (sql === genRandomUuidQuery || sql === createCatalogQueries.deployedRandom)
      return [{ schema: 'pg_catalog', origin: 'POSTGRES_BUILTIN', executable: true }]
    if (sql === createCatalogQueries.clock)
      return [
        {
          schema: 'pg_catalog',
          name: 'now',
          language: 'internal',
          result: 'timestamptz',
          executable: true,
        },
      ]
    if (sql === backfillQueries.builtins)
      return [{ text_equality: true, text_concat: true, uuid_output: true }]
    if (sql === literalPolicyQueries.role)
      return this.state.roles.includes(schema) ? [{ name: schema }] : []
    if (sql === literalPolicyQueries.setting)
      return [
        {
          schema: 'pg_catalog',
          name: 'current_setting',
          language: 'internal',
          result: 'text',
          volatility: 's',
          executable: true,
          text_operator_builtin: true,
        },
      ]
    if (sql === literalPolicyQueries.uuidOutput) return [{ builtin: true }]
    if (sql === literalPolicyQueries.policy) {
      const policy = this.state.policies.find(
        (policy) =>
          policy.schema === schema && policy.table === name && policy.name === parameters[2],
      )
      return policy ? [structuredClone(policy)] : []
    }
    const table = this.state.tables.find((entry) => entry.schema === schema && entry.name === name)
    if (sql === catalogQueries.relation) return table ? [{ kind: table.kind }] : []
    if (sql === originalRelationQueries.columns) return table ? this.originalColumns(table) : []
    if (sql === originalRelationQueries.constraints)
      return table ? this.originalConstraints(table) : []
    if (sql === parentKeyQueries.relation)
      return table ? [{ kind: table.kind, standalone: table.standalone }] : []
    if (sql === parentKeyQueries.columns || sql === catalogQueries.columns)
      return structuredClone(table?.columns ?? [])
    if (sql === catalogQueries.unique)
      return table
        ? this.originalKeys(table)
            .filter((key) => key.kind === 'u')
            .map((key) => ({
              name: key.name,
              columns: [...key.columns],
              deferrable: key.deferrable,
              initially_deferred: key.deferred,
              validated: key.validated,
              index_valid: key.backing!.valid,
              index_ready: key.backing!.ready,
              index_live: key.backing!.live,
              nulls_not_distinct: key.backing!.nulls_not_distinct,
            }))
        : []
    if (sql === parentKeyQueries.metadata) {
      if (!table) return []
      const id = table.columns.find((column) => column.name === 'id')
      return [
        {
          function_available: true,
          resolved_function_schema: 'pg_catalog',
          resolved_function_provenance: 'POSTGRES_BUILTIN',
          row_count_visible: table.rowCountVisible,
          collation: id ? (id.collation_default ? 0 : 1) : null,
          acl: id?.acl ?? null,
          foreign_keys: this.state.foreignKeys
            .filter(
              (key) => key.schema === schema && key.table === name && key.columns.includes('id'),
            )
            .map((key) => key.name),
          other_unique:
            (table.uniqueConstraints ?? []).some((key) => key.columns.includes('id')) ||
            this.state.indexes.some(
              (index) =>
                index.table_schema === schema &&
                index.table_name === name &&
                index.unique &&
                !index.primary &&
                index.columns.includes('id'),
            ),
          default_function_schema: null,
          default_function_provenance: null,
        },
      ]
    }
    const parentCount = /^SELECT count\(\*\)::text AS count FROM "public"\."([a-z_]+)"$/.exec(sql)
    if (parentCount) {
      const target = this.table('public', parentCount[1])
      this.assertBackfillVisibility(target)
      return [{ count: String(target.rows.length) }]
    }
    if (sql === createCatalogQueries.columns) return structuredClone(table?.columns ?? [])
    if (sql === proceduralQueries.visibleColumn)
      return table?.columns.some((column) => column.name === parameters[2])
        ? [{ name: parameters[2] }]
        : []
    if (sql === parentKeyQueries.primary)
      return table?.primaryKey.length
        ? [
            {
              columns: structuredClone(table.primaryKey),
              validated: true,
              deferrable: false,
              valid: true,
              ready: true,
              live: true,
            },
          ]
        : []
    if (sql === structuralQueries.index) {
      const index = this.state.indexes.find(
        (index) => index.schema === schema && index.name === name,
      )
      if (index) return [structuredClone(index)]
      return table ? [{ kind: table.kind }] : []
    }
    if (sql === structuralQueries.foreignKey) {
      const fk = this.state.foreignKeys.find(
        (fk) => fk.schema === schema && fk.table === name && fk.name === parameters[2],
      )
      return fk ? [structuredClone(fk)] : []
    }
    if (sql === rlsPrimitiveQueries.table)
      return table
        ? [
            {
              kind: table.kind,
              standalone: table.standalone,
              enabled: table.enabled,
              forced: table.forced,
            },
          ]
        : []
    if (sql === rlsPrimitiveQueries.policy)
      return table?.policies.includes(parameters[2])
        ? [{ name: parameters[2], name_matches: true }]
        : []
    if (sql === backfillQueries.visibility)
      return table ? [{ row_count_visible: table.rowCountVisible }] : []
    const proceduralCount =
      /^SELECT count\(\*\)::text AS total FROM "([a-z_][a-z0-9_]*)"\."([a-z_][a-z0-9_]*)"$/.exec(
        sql,
      )
    if (proceduralCount) {
      const target = this.table(proceduralCount[1], proceduralCount[2])
      this.assertBackfillVisibility(target)
      return [{ total: String(target.rows.length) }]
    }
    const count =
      /^SELECT count\(\*\)::text AS qualifying_rows FROM "public"\."(documents|organization_members)" WHERE "(name|file_url|uploaded_by|exempt_from_per_capita)" IS NULL$/.exec(
        sql,
      )
    if (count) {
      const target = this.table('public', count[1])
      this.assertBackfillVisibility(target)
      if (!target.columns.some((column) => column.name === count[2]))
        throw new ProvisioningError('FAKE_COLUMN_REQUIRED')
      if (target.rows.some((row) => !Object.hasOwn(row, count[2])))
        throw new ProvisioningError('FAKE_ROW_COLUMN_REQUIRED')
      return [
        { qualifying_rows: String(target.rows.filter((row) => row[count[2]] === null).length) },
      ]
    }
    throw new ProvisioningError(`FAKE_CATALOG_QUERY_UNSUPPORTED:${replayHash(sql)}`)
  }
}
