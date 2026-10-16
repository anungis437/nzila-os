import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import { catalogQueries } from './platform-baseline-promotion'
import { genRandomUuidQuery, parentKeyQueries } from './parent-key-supplement'
import { tableDefinition } from '../../../../scripts/ue/w5bc-boundary-semantics'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { frozenStatements } from '../../../../scripts/ue/close-w5a-replay-graph'
import type {
  ReplayExecutionUnit,
  ReplayUnitHandler,
  ReplayUnitObservation,
} from './post-w4p-execution'
export interface NamedEnumAuthority {
  schema: string
  name: string
  members: string[]
  definitionDigest: string
}
function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
function jsonCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonCanonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, jsonCanonical(value)]),
    )
  return value
}
export type CreateDefault =
  | { kind: 'NONE' }
  | { kind: 'FUNCTION'; name: string }
  | { kind: 'BOOLEAN'; value: boolean }
  | { kind: 'NUMBER' | 'STRING'; value: string }
  | { kind: 'JSONB'; value: unknown }
  | { kind: 'UNSUPPORTED'; expression: string }
export function normalizeCreateDefault(
  expression: string | null,
  postgresType: string,
  genSchemas: string[] = ['pg_catalog'],
  typeSchema: string = 'pg_catalog',
): CreateDefault {
  if (expression === null) return { kind: 'NONE' }
  let value = expression.trim()
  if (/^\([^()]+\)$/.test(value)) value = value.slice(1, -1).trim()
  const tokens = sqlTokens(value)
  const casts = tokens.findIndex(
    (token, index) => token.value === ':' && tokens[index + 1]?.value === ':',
  )
  if (casts >= 0) {
    const castText = value
      .slice(tokens[casts + 1].end)
      .trim()
      .replace(/"/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([(),])\s*/g, '$1')
    const prefix = /^([a-z_][a-z0-9_]*)\./.exec(castText)
    if (prefix && prefix[1] !== typeSchema) return { kind: 'UNSUPPORTED', expression }
    const cast = prefix ? castText.slice(prefix[0].length) : castText
    const base = postgresType.replace(/^public\./, '').replace(/\([^)]*\)$/, '')
    if (cast !== postgresType && cast !== base) return { kind: 'UNSUPPORTED', expression }
    value = value.slice(0, tokens[casts].start).trim()
  }
  if (value === 'now()' || value === 'pg_catalog.now()')
    return { kind: 'FUNCTION', name: 'pg_catalog.now' }
  if (
    value === 'gen_random_uuid()' ||
    genSchemas.some(
      (schema) =>
        value === `${schema}.gen_random_uuid()` || value === `"${schema}".gen_random_uuid()`,
    )
  )
    return { kind: 'FUNCTION', name: 'canonical.gen_random_uuid' }
  if (value === 'true' || value === 'false') return { kind: 'BOOLEAN', value: value === 'true' }
  const literal = /^'(?:[^']|'')*'$/.test(value) ? value.slice(1, -1).replaceAll("''", "'") : null
  const number = literal ?? value
  if (
    /^(?:smallint|integer|bigint|numeric(?:\(\d+(?:,\d+)?\))?)$/.test(postgresType) &&
    /^[+-]?\d+$/.test(number)
  )
    return { kind: 'NUMBER', value: BigInt(number).toString() }
  if (literal !== null && postgresType === 'jsonb')
    return { kind: 'JSONB', value: jsonCanonical(JSON.parse(literal)) }
  if (literal !== null) return { kind: 'STRING', value: literal }
  return { kind: 'UNSUPPORTED', expression }
}
function typeDefinition(raw: string, enums: NamedEnumAuthority[]) {
  const source = raw
    .trim()
    .replace(/\s*([(),])\s*/g, '$1')
    .replace(/\s+/g, ' ')
  const primitive: Record<string, { name: string; display: string }> = {
    uuid: { name: 'uuid', display: 'uuid' },
    text: { name: 'text', display: 'text' },
    'text[]': { name: '_text', display: 'text[]' },
    jsonb: { name: 'jsonb', display: 'jsonb' },
    boolean: { name: 'bool', display: 'boolean' },
    integer: { name: 'int4', display: 'integer' },
    bigint: { name: 'int8', display: 'bigint' },
    date: { name: 'date', display: 'date' },
    time: { name: 'time', display: 'time without time zone' },
    timestamptz: { name: 'timestamptz', display: 'timestamp with time zone' },
    timestamp: { name: 'timestamp', display: 'timestamp without time zone' },
    'timestamp without time zone': { name: 'timestamp', display: 'timestamp without time zone' },
    'timestamp with time zone': { name: 'timestamptz', display: 'timestamp with time zone' },
    numeric: { name: 'numeric', display: 'numeric' },
  }
  if (primitive[source]) return { schema: 'pg_catalog', ...primitive[source], enum: null }
  if (/^varchar\(\d+\)$/.test(source))
    return {
      schema: 'pg_catalog',
      name: 'varchar',
      display: source.replace(/^varchar/, 'character varying'),
      enum: null,
    }
  if (/^numeric\(\d+,\d+\)$/.test(source))
    return { schema: 'pg_catalog', name: 'numeric', display: source, enum: null }
  const identifiers = sqlTokens(source)
  requireCondition(
    identifiers.length === 1 || (identifiers.length === 3 && identifiers[1].value === '.'),
    'REPLAY_CREATE_TYPE_GRAMMAR_UNSUPPORTED',
  )
  const nameToken = identifiers.at(-1)!
  requireCondition(
    nameToken.kind === 'WORD' || nameToken.kind === 'IDENTIFIER',
    'REPLAY_CREATE_TYPE_GRAMMAR_UNSUPPORTED',
  )
  const name = nameToken.kind === 'WORD' ? nameToken.value.toLowerCase() : nameToken.value
  const schemaToken = identifiers.length === 3 ? identifiers[0] : null
  const schema = schemaToken
    ? schemaToken.kind === 'WORD'
      ? schemaToken.value.toLowerCase()
      : schemaToken.value
    : 'public'
  const candidates = enums.filter(
    (authority) => authority.schema === schema && authority.name === name,
  )
  requireCondition(
    candidates.length > 0 &&
      candidates.every(
        (authority) =>
          replayDigest(authority.members) === replayDigest(candidates[0].members) &&
          /^[a-f0-9]{64}$/.test(authority.definitionDigest),
      ),
    'REPLAY_CREATE_NAMED_TYPE_AUTHORITY_REQUIRED',
  )
  return { schema, name, display: name, enum: candidates[0] }
}
export function compileColumnDefinition(
  field: { name: string; definition: string },
  namedEnums: NamedEnumAuthority[] = [],
) {
  const boundaries = [
    'PRIMARY',
    'DEFAULT',
    'NOT',
    'UNIQUE',
    'REFERENCES',
    'CHECK',
    'GENERATED',
    'COLLATE',
  ]
  const tokens = sqlTokens(field.definition)
  const identifier = tokens[0]
  requireCondition(
    identifier &&
      (identifier.kind === 'WORD' || identifier.kind === 'IDENTIFIER') &&
      (identifier.kind === 'WORD' ? identifier.value.toLowerCase() : identifier.value) ===
        field.name &&
      tokens.length > 1,
    'REPLAY_CREATE_COLUMN_GRAMMAR_UNSUPPORTED',
  )
  let end = tokens.findIndex(
    (token, index) =>
      index > 0 && token.kind === 'WORD' && boundaries.includes(token.value.toUpperCase()),
  )
  if (end < 0) end = tokens.length
  const type = typeDefinition(
    field.definition.slice(
      tokens[1].start,
      end === tokens.length ? field.definition.length : tokens[end].start,
    ),
    namedEnums,
  )
  let primary = false,
    notNull = false,
    defaultExpression: string | null = null
  while (end < tokens.length) {
    const current = tokens[end++]
    requireCondition(current.kind === 'WORD', 'REPLAY_CREATE_COLUMN_GRAMMAR_UNSUPPORTED')
    const next = (word: string) => {
      const token = tokens[end++]
      requireCondition(
        token?.kind === 'WORD' && token.value.toUpperCase() === word,
        'REPLAY_CREATE_COLUMN_GRAMMAR_UNSUPPORTED',
      )
    }
    if (current.value.toUpperCase() === 'PRIMARY') {
      next('KEY')
      primary = true
    } else if (current.value.toUpperCase() === 'NOT') {
      next('NULL')
      notNull = true
    } else if (current.value.toUpperCase() === 'DEFAULT') {
      const start = current.end
      while (
        end < tokens.length &&
        !(tokens[end].kind === 'WORD' && boundaries.includes(tokens[end].value.toUpperCase()))
      )
        end++
      defaultExpression = field.definition
        .slice(start, end === tokens.length ? field.definition.length : tokens[end].start)
        .trim()
    } else throw new ProvisioningError('REPLAY_CREATE_COLUMN_GRAMMAR_UNSUPPORTED')
  }
  const normalizedDefault = normalizeCreateDefault(
    defaultExpression,
    type.display,
    ['pg_catalog'],
    type.schema,
  )
  requireCondition(
    normalizedDefault.kind !== 'UNSUPPORTED',
    'REPLAY_CREATE_DEFAULT_GRAMMAR_UNSUPPORTED',
  )
  if (type.enum && normalizedDefault.kind === 'STRING')
    requireCondition(
      type.enum.members.includes(normalizedDefault.value),
      'REPLAY_CREATE_ENUM_DEFAULT_NOT_AUTHORIZED',
    )
  return {
    name: field.name,
    type,
    notNull: notNull || primary,
    primary,
    defaultExpression,
    normalizedDefault,
    sourceDefinitionHash: replayHash(field.definition),
  }
}
export function compileCreateStatement(
  sql: string,
  sourceHash: string,
  namedEnums: NamedEnumAuthority[] = [],
) {
  requireCondition(replayHash(sql) === sourceHash, 'REPLAY_CREATE_SOURCE_HASH_DRIFT')
  requireCondition(frozenStatements(sql).length === 1, 'REPLAY_CREATE_WHOLE_STATEMENT_REQUIRED')
  const definition = tableDefinition(sql)
  requireCondition(definition?.schema === 'public', 'REPLAY_CREATE_TABLE_GRAMMAR_UNSUPPORTED')
  const tokens = sqlTokens(sql)
  let depth = 0,
    closed = -1
  for (
    let index = tokens.findIndex((token) => token.value === '(');
    index < tokens.length;
    index++
  ) {
    const token = tokens[index]
    if (token.kind === 'SYMBOL' && token.value === '(') depth++
    if (token.kind === 'SYMBOL' && token.value === ')' && --depth === 0) {
      closed = index
      break
    }
  }
  requireCondition(
    closed === tokens.length - 2 && tokens.at(-1)?.value === ';',
    'REPLAY_CREATE_TABLE_GRAMMAR_UNSUPPORTED',
  )
  const columns = definition.fields.map((field) => compileColumnDefinition(field, namedEnums))
  const uniqueConstraints = definition.constraints.map((source) => {
    const tokens = sqlTokens(source)
    const identifier = (index: number) => {
      const token = tokens[index]
      requireCondition(
        token && (token.kind === 'WORD' || token.kind === 'IDENTIFIER'),
        'REPLAY_CREATE_UNIQUE_GRAMMAR_UNSUPPORTED',
      )
      return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
    }
    requireCondition(
      tokens[0]?.kind === 'WORD' &&
        tokens[0].value.toUpperCase() === 'CONSTRAINT' &&
        tokens[2]?.kind === 'WORD' &&
        tokens[2].value.toUpperCase() === 'UNIQUE' &&
        tokens[3]?.value === '(' &&
        tokens.at(-1)?.value === ')',
      'REPLAY_CREATE_UNIQUE_GRAMMAR_UNSUPPORTED',
    )
    const name = identifier(1),
      keys: string[] = []
    let index = 4
    while (index < tokens.length - 1) {
      keys.push(identifier(index++))
      if (index < tokens.length - 1)
        requireCondition(
          tokens[index++]?.value === ',' && index < tokens.length - 1,
          'REPLAY_CREATE_UNIQUE_GRAMMAR_UNSUPPORTED',
        )
    }
    requireCondition(
      keys.length > 0 &&
        index === tokens.length - 1 &&
        keys.every((key) => columns.some((column) => column.name === key)) &&
        new Set(keys).size === keys.length,
      'REPLAY_CREATE_UNIQUE_GRAMMAR_UNSUPPORTED',
    )
    return { name, columns: keys, sourceDefinitionHash: replayHash(source) }
  })
  const primaryKey = columns.filter((column) => column.primary).map((column) => column.name)
  requireCondition(primaryKey.length <= 1, 'REPLAY_CREATE_PRIMARY_KEY_GRAMMAR_UNSUPPORTED')
  const body = {
    schema: definition.schema,
    name: definition.name,
    guarded: definition.guarded,
    columns,
    primaryKey,
    uniqueConstraints,
    sourceHash,
    unitClass: 'EXACT_CREATE_STATEMENT',
  }
  return { ...body, contractDigest: replayDigest(body) }
}
export const createCatalogQueries = {
  namespace: 'SELECT nspname AS name FROM pg_catalog.pg_namespace WHERE nspname=$1',
  typePrerequisite: catalogQueries.type,
  deployedRandom: genRandomUuidQuery.replace(
    "to_regprocedure('gen_random_uuid()')",
    'to_regprocedure($1)',
  ),
  clock: `SELECT n.nspname AS schema,p.proname AS name,l.lanname AS language,t.typname AS result,pg_catalog.has_function_privilege(p.oid,'EXECUTE') AS executable FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang JOIN pg_catalog.pg_type t ON t.oid=p.prorettype WHERE p.oid=pg_catalog.to_regprocedure('now()') AND p.pronargs=0`,
  unique: `SELECT con.contype AS kind,con.convalidated AS validated,con.condeferrable AS deferrable,con.condeferred AS deferred,con.conislocal AS local,con.coninhcount AS inherited,
    i.indisunique AS unique,i.indisvalid AS valid,i.indisready AS ready,i.indislive AS live,i.indisprimary AS primary,i.indisexclusion AS exclusion,
    i.indnkeyatts AS key_count,i.indnatts AS total_count,
    COALESCE((pg_catalog.to_jsonb(i)->>'indnullsnotdistinct')::boolean,false) AS nulls_not_distinct,
    pg_catalog.pg_get_expr(i.indpred,i.indrelid) AS predicate,pg_catalog.pg_get_expr(i.indexprs,i.indrelid) AS expressions,
    (SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality) FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_catalog.pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.attnum) AS columns
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=con.conindid
    WHERE n.nspname=$1 AND c.relname=$2 AND con.conname=$3`,
  columns: `SELECT a.attname AS name,pg_catalog.format_type(a.atttypid,a.atttypmod) AS postgres_type,
    ns.nspname AS type_schema,t.typname AS type_name,t.typtype AS type_kind,
    a.attnotnull AS not_null,pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    a.attidentity AS identity,a.attgenerated AS generated,a.attcollation=t.typcollation AS collation_default,a.attacl::text AS acl
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_type t ON t.oid=a.atttypid JOIN pg_catalog.pg_namespace ns ON ns.oid=t.typnamespace
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,
}
const row = (value: unknown): Record<string, unknown> => {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'REPLAY_CREATE_CATALOG_ROW_INVALID',
  )
  return Object.fromEntries(Object.entries(value))
}
export function makeCreateReplayHandler(
  unit: ReplayExecutionUnit,
  namedEnums: NamedEnumAuthority[] = [],
): ReplayUnitHandler {
  requireCondition(
    unit.node.REPLAY_UNIT_CLASS === 'FROZEN_STATEMENT_UNIT',
    'REPLAY_CREATE_UNIT_CLASS_REQUIRED',
  )
  const contract = compileCreateStatement(
    unit.sql,
    replayText(unit.node.EXACT_UNIT_SHA256),
    namedEnums,
  )
  requireCondition(
    unit.contractDigest === contract.contractDigest,
    'REPLAY_CREATE_CONTRACT_BINDING_DRIFT',
  )
  const unitId = replayText(unit.node.REPLAY_UNIT_ID),
    scope = replayText(unit.node.DATABASE_SCOPE)
  const observation = (
    state: ReplayUnitObservation['state'],
    data: unknown,
  ): ReplayUnitObservation => ({
    state,
    ownedStateDigest: replayDigest({ relation: `${contract.schema}.${contract.name}`, data }),
    verificationDigest: replayDigest({ unitId, contract: contract.contractDigest, state, data }),
  })
  return {
    unitId,
    contractDigest: contract.contractDigest,
    async inspect(reader, context, current) {
      requireCondition(
        current.node.REPLAY_UNIT_ID === unitId &&
          current.node.DATABASE_SCOPE === scope &&
          current.contractDigest === contract.contractDigest &&
          replayHash(current.sql) === contract.sourceHash,
        'REPLAY_CREATE_CONTRACT_BINDING_DRIFT',
      )
      if (
        context.scope !== scope ||
        context.actorClass !== 'MIGRATION_ADMIN' ||
        !context.actorPrincipal ||
        !context.w4pVerificationDigest ||
        !context.supplementVerificationDigest
      )
        return observation('PRECONDITION_MISSING', { context: 'UNVERIFIED' })
      const parameters = [contract.schema, contract.name]
      const relations = await reader.query(parentKeyQueries.relation, parameters)
      requireCondition(relations.length <= 1, 'REPLAY_CREATE_CATALOG_CARDINALITY_INVALID')
      if (relations.length) {
        const relation = row(relations[0])
        requireCondition(
          typeof relation.kind === 'string' && typeof relation.standalone === 'boolean',
          'REPLAY_CREATE_CATALOG_ROW_INVALID',
        )
        if (relation.kind !== 'r' || !relation.standalone)
          return observation('DRIFTED', { relation })
      }
      const prerequisites: unknown[] = []
      const namespaces = await reader.query(createCatalogQueries.namespace, [contract.schema])
      requireCondition(namespaces.length <= 1, 'REPLAY_CREATE_CATALOG_CARDINALITY_INVALID')
      if (!namespaces.length) return observation('PRECONDITION_MISSING', { namespace: null })
      requireCondition(
        row(namespaces[0]).name === contract.schema,
        'REPLAY_CREATE_CATALOG_ROW_INVALID',
      )
      const random = await reader.query(genRandomUuidQuery, [])
      requireCondition(random.length <= 1, 'REPLAY_CREATE_CATALOG_CARDINALITY_INVALID')
      if (!random.length) return observation('PRECONDITION_MISSING', { defaultFunction: null })
      const functionInfo = row(random[0])
      requireCondition(
        typeof functionInfo.schema === 'string' &&
          typeof functionInfo.origin === 'string' &&
          typeof functionInfo.executable === 'boolean',
        'REPLAY_CREATE_CATALOG_ROW_INVALID',
      )
      if (
        !functionInfo.executable ||
        !['POSTGRES_BUILTIN', 'PGCRYPTO_EXTENSION'].includes(functionInfo.origin)
      )
        return observation('PRECONDITION_MISSING', { defaultFunction: functionInfo })
      if (
        contract.columns.some(
          (column) =>
            column.normalizedDefault.kind === 'FUNCTION' &&
            column.normalizedDefault.name === 'pg_catalog.now',
        )
      ) {
        const rows = await reader.query(createCatalogQueries.clock, [])
        requireCondition(rows.length <= 1, 'REPLAY_CREATE_CATALOG_CARDINALITY_INVALID')
        if (!rows.length) return observation('PRECONDITION_MISSING', { clock: null })
        const clock = row(rows[0])
        requireCondition(
          typeof clock.schema === 'string' &&
            typeof clock.name === 'string' &&
            typeof clock.language === 'string' &&
            typeof clock.result === 'string' &&
            typeof clock.executable === 'boolean',
          'REPLAY_CREATE_CATALOG_ROW_INVALID',
        )
        if (
          clock.schema !== 'pg_catalog' ||
          clock.name !== 'now' ||
          clock.language !== 'internal' ||
          clock.result !== 'timestamptz' ||
          !clock.executable
        )
          return observation('PRECONDITION_MISSING', { clock })
        prerequisites.push({ clock })
      }
      for (const type of new Map(
        contract.columns.map((column) => [
          `${column.type.schema}.${column.type.name}`,
          column.type,
        ]),
      ).values()) {
        const rows = await reader.query(createCatalogQueries.typePrerequisite, [
          type.schema,
          type.name,
        ])
        requireCondition(rows.length <= 1, 'REPLAY_CREATE_CATALOG_CARDINALITY_INVALID')
        if (!rows.length)
          return observation('PRECONDITION_MISSING', { type: `${type.schema}.${type.name}` })
        const actual = row(rows[0])
        requireCondition(typeof actual.kind === 'string', 'REPLAY_CREATE_CATALOG_ROW_INVALID')
        if (actual.kind !== (type.enum ? 'e' : 'b')) return observation('DRIFTED', { type, actual })
        if (type.enum) {
          requireCondition(
            Array.isArray(actual.members) &&
              actual.members.every((member) => typeof member === 'string'),
            'REPLAY_CREATE_CATALOG_ROW_INVALID',
          )
          if (replayDigest(actual.members) !== replayDigest(type.enum.members))
            return observation('DRIFTED', { type, actual })
        }
        prerequisites.push({
          type: `${type.schema}.${type.name}`,
          kind: actual.kind,
          members: actual.members ?? null,
        })
      }
      if (!relations.length)
        return observation('REPLAY_REQUIRED', { relation: null, prerequisites })
      const columns = (await reader.query(createCatalogQueries.columns, parameters)).map(row)
      const primary = (await reader.query(parentKeyQueries.primary, parameters)).map(row)
      requireCondition(primary.length <= 1, 'REPLAY_CREATE_CATALOG_CARDINALITY_INVALID')
      if (columns.length !== contract.columns.length)
        return observation('DRIFTED', { columns, primary })
      for (const [index, expected] of contract.columns.entries()) {
        const actual = columns[index]
        requireCondition(
          typeof actual.name === 'string' &&
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
          'REPLAY_CREATE_CATALOG_ROW_INVALID',
        )
        const display = actual.postgres_type
          .replace(/"/g, '')
          .replace(/^public\./, '')
          .replace(/\s*([(),])\s*/g, '$1')
        let genSchemas = [functionInfo.schema]
        if (
          expected.normalizedDefault.kind === 'FUNCTION' &&
          expected.normalizedDefault.name === 'canonical.gen_random_uuid'
        ) {
          const expression =
            typeof actual.default_expression === 'string' ? actual.default_expression.trim() : ''
          if (!/^(?:(?:[a-z_][a-z0-9_]*|"[^"]+")\.)?gen_random_uuid\(\)$/.test(expression))
            return observation('DRIFTED', { columns, primary })
          const functions = await reader.query(createCatalogQueries.deployedRandom, [expression])
          requireCondition(functions.length <= 1, 'REPLAY_CREATE_CATALOG_CARDINALITY_INVALID')
          if (!functions.length)
            return observation('DRIFTED', { columns, primary, defaultFunction: null })
          const info = row(functions[0])
          requireCondition(
            typeof info.schema === 'string' &&
              typeof info.origin === 'string' &&
              typeof info.executable === 'boolean',
            'REPLAY_CREATE_CATALOG_ROW_INVALID',
          )
          if (!info.executable || !['POSTGRES_BUILTIN', 'PGCRYPTO_EXTENSION'].includes(info.origin))
            return observation('DRIFTED', { columns, primary, defaultFunction: info })
          genSchemas = [info.schema]
        }
        if (
          actual.name !== expected.name ||
          actual.type_schema !== expected.type.schema ||
          actual.type_name !== expected.type.name ||
          display !== expected.type.display ||
          actual.not_null !== expected.notNull ||
          actual.identity !== '' ||
          actual.generated !== '' ||
          !actual.collation_default ||
          actual.acl !== null ||
          replayDigest(
            normalizeCreateDefault(
              actual.default_expression,
              expected.type.display,
              genSchemas,
              expected.type.schema,
            ),
          ) !== replayDigest(expected.normalizedDefault)
        )
          return observation('DRIFTED', { columns, primary })
      }
      const key = primary[0]
      if (contract.primaryKey.length) {
        if (
          !key ||
          replayDigest(key.columns) !== replayDigest(contract.primaryKey) ||
          key.validated !== true ||
          key.deferrable !== false ||
          key.valid !== true ||
          key.ready !== true ||
          key.live !== true
        )
          return observation('DRIFTED', { columns, primary })
      } else if (key) return observation('DRIFTED', { columns, primary })
      const uniques: unknown[] = []
      for (const expected of contract.uniqueConstraints) {
        const rows = await reader.query(createCatalogQueries.unique, [...parameters, expected.name])
        requireCondition(rows.length <= 1, 'REPLAY_CREATE_CATALOG_CARDINALITY_INVALID')
        if (!rows.length) return observation('DRIFTED', { columns, primary, unique: null })
        const actual = row(rows[0])
        requireCondition(
          typeof actual.kind === 'string' &&
            Array.isArray(actual.columns) &&
            actual.columns.every((column) => typeof column === 'string') &&
            [
              'validated',
              'deferrable',
              'deferred',
              'local',
              'unique',
              'valid',
              'ready',
              'live',
              'primary',
              'exclusion',
              'nulls_not_distinct',
            ].every((key) => typeof actual[key] === 'boolean') &&
            typeof actual.inherited === 'number' &&
            typeof actual.key_count === 'number' &&
            typeof actual.total_count === 'number' &&
            (actual.predicate === null || typeof actual.predicate === 'string') &&
            (actual.expressions === null || typeof actual.expressions === 'string'),
          'REPLAY_CREATE_CATALOG_ROW_INVALID',
        )
        if (
          actual.kind !== 'u' ||
          replayDigest(actual.columns) !== replayDigest(expected.columns) ||
          !actual.validated ||
          actual.deferrable ||
          actual.deferred ||
          !actual.local ||
          actual.inherited !== 0 ||
          !actual.unique ||
          !actual.valid ||
          !actual.ready ||
          !actual.live ||
          actual.primary ||
          actual.exclusion ||
          actual.nulls_not_distinct ||
          actual.predicate !== null ||
          actual.expressions !== null ||
          actual.key_count !== expected.columns.length ||
          actual.total_count !== expected.columns.length
        )
          return observation('DRIFTED', { columns, primary, unique: actual })
        uniques.push(actual)
      }
      return observation('ALREADY_COMPLETE', { columns, primary, prerequisites, uniques })
    },
  }
}
