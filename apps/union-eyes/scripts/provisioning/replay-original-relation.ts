/**
 * Offline W5B-PK original CREATE TABLE components, not whole-boundary eligibility.
 * The caller supplies exact frozen source and W4/wrapper-derived enum authority.
 * Later column/function/constraint evolution is deliberately not accepted here.
 * No SQL is executed by this module; inspection uses a caller-provided catalog reader.
 */
import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import { Cursor } from './replay-structural-effects'
import {
  compileColumnDefinition,
  createCatalogQueries,
  normalizeCreateDefault,
  type NamedEnumAuthority,
} from './replay-create-inspection'
import { parentKeyQueries, genRandomUuidQuery } from './parent-key-supplement'
import { tableDefinition } from '../../../../scripts/ue/w5bc-boundary-semantics'
import { frozenStatements } from '../../../../scripts/ue/close-w5a-replay-graph'
import type { CatalogReader } from './platform-baseline-promotion'

function requireCondition(
  value: unknown,
  code = 'ORIGINAL_RELATION_GRAMMAR_UNSUPPORTED',
): asserts value {
  if (!value) throw new ProvisioningError(code)
}
type Column = ReturnType<typeof compileColumnDefinition>
type Operand = { column: string } | { literal: string }
export type OriginalCheck =
  | { op: 'AND' | 'OR'; left: OriginalCheck; right: OriginalCheck }
  | { op: 'IS NULL' | 'IS NOT NULL'; operand: Operand }
  | { op: '>' | '<>'; left: Operand; right: Operand }
export interface OriginalConstraint {
  name: string | null
  kind: 'p' | 'u' | 'f' | 'c'
  columns: string[]
  check: OriginalCheck | null
  parent: { schema: string; name: string; columns: string[] } | null
  deleteAction: ReferentialAction
  updateAction?:ReferentialAction
}
export type ReferentialAction='NO ACTION'|'CASCADE'|'RESTRICT'|'SET NULL'|'SET DEFAULT'
function constraint(kind: OriginalConstraint['kind'], columns: string[]): OriginalConstraint {
  return { name: null, kind, columns, check: null, parent: null, deleteAction: 'NO ACTION' }
}
function checkExpression(cursor: Cursor, columns: Column[], catalog: boolean): OriginalCheck {
  const names = new Set<string>()
  const operand = (): Operand => {
    if (cursor.tokens[cursor.index]?.value === '(') {
      cursor.symbol('(')
      const result = operand()
      cursor.symbol(')')
      return result
    }
    const token = cursor.tokens[cursor.index]
    if (token?.kind === 'STRING') {
      cursor.index++
      return { literal: token.value }
    }
    const name = cursor.identifier()
    requireCondition(columns.some((column) => column.name === name))
    names.add(name)
    return { column: name }
  }
  const atom = (): OriginalCheck => {
    if (cursor.tokens[cursor.index]?.value === '(') {
      cursor.symbol('(')
      const expression = or()
      cursor.symbol(')')
      return expression
    }
    const left = operand()
    requireCondition('column' in left)
    const column = columns.find((entry) => entry.name === left.column)!
    if (cursor.optionalWord('IS')) {
      const not = cursor.optionalWord('NOT')
      cursor.word('NULL')
      return { op: not ? 'IS NOT NULL' : 'IS NULL', operand: left }
    }
    let op: '>' | '<>' = '>'
    if (cursor.tokens[cursor.index]?.value === '<') {
      cursor.symbol('<')
      cursor.symbol('>')
      op = '<>'
    } else cursor.symbol('>')
    const right = operand()
    if (cursor.tokens[cursor.index]?.value === ':') {
      requireCondition(catalog && 'literal' in right)
      cursor.symbol(':')
      cursor.symbol(':')
      const cast = cursor.relation()
      requireCondition(
        cast.name === column.type.name &&
          (cast.qualified ? cast.schema === column.type.schema : column.type.schema === 'public'),
      )
    }
    if ('literal' in right)
      requireCondition(op === '<>' && column.type.enum?.members.includes(right.literal))
    else
      requireCondition(
        op === '>' &&
          column.type.schema === 'pg_catalog' &&
          ['timestamp', 'timestamptz'].includes(column.type.name) &&
          columns.some(
            (entry) =>
              entry.name === right.column &&
              entry.type.schema === column.type.schema &&
              entry.type.name === column.type.name,
          ),
      )
    return { op, left, right }
  }
  const and = (): OriginalCheck => {
    let result = atom()
    while (cursor.optionalWord('AND')) result = { op: 'AND', left: result, right: atom() }
    return result
  }
  const or = (): OriginalCheck => {
    let result = and()
    while (cursor.optionalWord('OR')) result = { op: 'OR', left: result, right: and() }
    return result
  }
  const result = or()
  requireCondition(names.size > 0)
  return result
}
function foreign(cursor: Cursor, keys: string[]) {
  const result = constraint('f', keys)
  const relation = cursor.relation()
  result.parent = { schema: relation.schema, name: relation.name, columns: cursor.columns() }
  const seen=new Set<string>()
  while (cursor.optionalWord('ON')) {
    const direction=cursor.identifier().toUpperCase()
    requireCondition(['DELETE','UPDATE'].includes(direction)&&!seen.has(direction))
    seen.add(direction)
    let action:ReferentialAction
    if(cursor.optionalWord('CASCADE'))action='CASCADE'
    else if(cursor.optionalWord('RESTRICT'))action='RESTRICT'
    else if(cursor.optionalWord('SET')){
      if(cursor.optionalWord('NULL'))action='SET NULL'
      else{cursor.word('DEFAULT');action='SET DEFAULT'}
    }else{cursor.word('NO');cursor.word('ACTION');action='NO ACTION'}
    if(direction==='DELETE')result.deleteAction=action
    else if(action!=='NO ACTION')result.updateAction=action
  }
  requireCondition(result.parent.columns.length === keys.length)
  return result
}
function checkColumns(check: OriginalCheck): string[] {
  if (check.op === 'AND' || check.op === 'OR')
    return [...new Set([...checkColumns(check.left), ...checkColumns(check.right)])]
  if (check.op === 'IS NULL' || check.op === 'IS NOT NULL')
    return 'column' in check.operand ? [check.operand.column] : []
  if (check.op === '>' || check.op === '<>')
    return [
      ...new Set(
        [check.left, check.right].flatMap((operand) =>
          'column' in operand ? [operand.column] : [],
        ),
      ),
    ]
  return []
}
function parseConstraint(source: string, columns: Column[], catalog = false) {
  const cursor = new Cursor(`${source};`, replayHash(`${source};`))
  let name: string | null = null
  if (cursor.optionalWord('CONSTRAINT')) name = cursor.identifier()
  let result: OriginalConstraint
  if (cursor.optionalWord('UNIQUE')) result = constraint('u', cursor.columns())
  else if (cursor.optionalWord('PRIMARY')) {
    cursor.word('KEY')
    result = constraint('p', cursor.columns())
  } else if (cursor.optionalWord('FOREIGN')) {
    cursor.word('KEY')
    const keys = cursor.columns()
    cursor.word('REFERENCES')
    result = foreign(cursor, keys)
  } else {
    cursor.word('CHECK')
    result = constraint('c', [])
    result.check = checkExpression(cursor, columns, catalog)
    result.columns = checkColumns(result.check)
  }
  cursor.finish()
  result.name = name
  requireCondition(
    result.kind === 'c' ||
      (result.columns.length > 0 &&
        new Set(result.columns).size === result.columns.length &&
        result.columns.every((key) => columns.some((column) => column.name === key))),
  )
  return result
}
export function originalTypmod(column: Column) {
  const varchar = /^character varying\((\d+)\)$/.exec(column.type.display)
  if (varchar) return Number(varchar[1]) + 4
  const numeric = /^numeric\((\d+),(\d+)\)$/.exec(column.type.display)
  if (numeric) return (Number(numeric[1]) << 16) + Number(numeric[2]) + 4
  return -1
}
export function compileOriginalRelation(
  source: string,
  sourceHash: string,
  namedEnums: NamedEnumAuthority[] = [],
) {
  requireCondition(replayHash(source) === sourceHash, 'ORIGINAL_RELATION_SOURCE_HASH_DRIFT')
  requireCondition(
    frozenStatements(source).length === 1,
    'ORIGINAL_RELATION_SINGLE_STATEMENT_REQUIRED',
  )
  const cursor = new Cursor(source, sourceHash)
  cursor.word('CREATE')
  cursor.word('TABLE')
  const guarded = cursor.optionalWord('IF')
  if (guarded) {
    cursor.word('NOT')
    cursor.word('EXISTS')
  }
  const relation = cursor.relation()
  requireCondition(['public', 'user_management', 'audit_security'].includes(relation.schema))
  cursor.symbol('(')
  let depth = 1
  while (cursor.index < cursor.tokens.length && depth > 0) {
    const token = cursor.tokens[cursor.index++]
    if (token.kind === 'SYMBOL' && token.value === '(') depth++
    if (token.kind === 'SYMBOL' && token.value === ')') depth--
  }
  requireCondition(depth === 0)
  cursor.finish()
  const definition = tableDefinition(source)
  requireCondition(definition && definition.fields.length > 0)
  const constraints: OriginalConstraint[] = []
  const columns = definition.fields.map((field) => {
    const fieldCursor = new Cursor(`${field.definition};`, replayHash(`${field.definition};`))
    const kept: { start: number; end: number }[] = []
    while (fieldCursor.index < fieldCursor.tokens.length - 1) {
      if (fieldCursor.optionalWord('UNIQUE')) constraints.push(constraint('u', [field.name]))
      else if (fieldCursor.optionalWord('REFERENCES')) {
        constraints.push(foreign(fieldCursor, [field.name]))
      } else {
        const token = fieldCursor.tokens[fieldCursor.index++]
        kept.push({ start: token.start, end: token.end })
      }
    }
    fieldCursor.finish()
    // Retain literal/token spelling; no SQL execution or parser-to-source rewriting.
    const retained = kept
      .map((token, index) => {
        const prior = kept[index - 1]
        const gap = prior ? fieldCursor.source.slice(prior.end, token.start) : ''
        return (
          (prior ? (/^\s*$/.test(gap) ? gap : ' ') : '') +
          fieldCursor.source.slice(token.start, token.end)
        )
      })
      .join('')
    const column = compileColumnDefinition({ name: field.name, definition: retained }, namedEnums)
    return { ...column, sourceDefinitionHash: replayHash(field.definition) }
  })
  const primary = columns.filter((column) => column.primary)
  requireCondition(primary.length <= 1)
  if (primary.length)
    constraints.push(
      constraint(
        'p',
        primary.map((column) => column.name),
      ),
    )
  constraints.push(...definition.constraints.map((text) => parseConstraint(text, columns)))
  requireCondition(
    constraints.filter((entry) => entry.kind === 'p').length <= 1 &&
      new Set(constraints.filter((entry) => entry.name).map((entry) => entry.name)).size ===
        constraints.filter((entry) => entry.name).length,
  )
  const body = {
    schema: relation.schema,
    name: relation.name,
    guarded,
    sourceHash,
    columns,
    constraints,
    componentClass: 'ORIGINAL_CREATE_TABLE_COMPONENT' as const,
  }
  return { ...body, contractDigest: replayDigest(body) }
}
export type OriginalRelation = ReturnType<typeof compileOriginalRelation>

export const originalRelationQueries = {
  namespace: createCatalogQueries.namespace,
  relation: parentKeyQueries.relation,
  type: `SELECT t.oid::text AS oid,t.typtype AS kind,t.typcollation::text AS collation,
    en.nspname AS element_schema,e.typname AS element_name,
    (SELECT pg_catalog.json_agg(v.enumlabel ORDER BY v.enumsortorder) FROM pg_catalog.pg_enum v WHERE v.enumtypid=t.oid) AS members
    FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    LEFT JOIN pg_catalog.pg_type e ON e.oid=t.typelem LEFT JOIN pg_catalog.pg_namespace en ON en.oid=e.typnamespace
    WHERE n.nspname=$1 AND t.typname=$2`,
  columns: createCatalogQueries.columns.replace(
    'a.attname AS name,',
    'a.attname AS name,a.atttypid::text AS type_oid,a.atttypmod AS typmod,a.attcollation::text AS collation,',
  ),
  constraints: `SELECT con.conname AS name,con.contype AS kind,con.convalidated AS validated,
    con.conindid::text AS index_oid,
    con.condeferrable AS deferrable,con.condeferred AS deferred,con.conislocal AS local,
    con.coninhcount AS inherited,con.connoinherit AS no_inherit,
    pg_catalog.pg_get_constraintdef(con.oid,false) AS definition,
    COALESCE((SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality)
      FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY k(attnum,ordinality)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.attnum),'[]'::json) AS columns,
    pn.nspname AS parent_schema,pc.relname AS parent_name,
    COALESCE((SELECT pg_catalog.json_agg(a.attname ORDER BY k.ordinality)
      FROM pg_catalog.unnest(con.confkey) WITH ORDINALITY k(attnum,ordinality)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=con.confrelid AND a.attnum=k.attnum),'[]'::json) AS parent_columns,
    con.confdeltype AS delete_action,con.confupdtype AS update_action,con.confmatchtype AS match_type,
    CASE WHEN con.contype IN ('p','u','f') THEN pg_catalog.json_build_object(
      'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive,
      'primary',i.indisprimary,'exclusion',i.indisexclusion,'immediate',i.indimmediate,
      'key_count',i.indnkeyatts,'total_count',i.indnatts,
      'nulls_not_distinct',COALESCE((pg_catalog.to_jsonb(i)->>'indnullsnotdistinct')::boolean,false),
      'predicate',pg_catalog.pg_get_expr(i.indpred,i.indrelid),'expressions',pg_catalog.pg_get_expr(i.indexprs,i.indrelid),
      'method',am.amname,
      'keys',(SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
        'name',a.attname,'option',i.indoption[k.ordinality-1],
        'collation',i.indcollation[k.ordinality-1]::text,
        'opclass_schema',ns.nspname,'opclass',op.opcname,'family_schema',fs.nspname,'family',f.opfname)
        ORDER BY k.ordinality)
        FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality)
        JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
        JOIN pg_catalog.pg_opclass op ON op.oid=i.indclass[k.ordinality-1]
        JOIN pg_catalog.pg_namespace ns ON ns.oid=op.opcnamespace
        JOIN pg_catalog.pg_opfamily f ON f.oid=op.opcfamily JOIN pg_catalog.pg_namespace fs ON fs.oid=f.opfnamespace))
      ELSE NULL END AS backing,
    COALESCE((SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'class',dep.refclassid::pg_catalog.regclass::text,'schema',dn.nspname,'name',COALESCE(dp.proname,dop.oprname)))
      FROM pg_catalog.pg_depend dep
      LEFT JOIN pg_catalog.pg_proc dp ON dep.refclassid='pg_catalog.pg_proc'::pg_catalog.regclass AND dp.oid=dep.refobjid
      LEFT JOIN pg_catalog.pg_operator dop ON dep.refclassid='pg_catalog.pg_operator'::pg_catalog.regclass AND dop.oid=dep.refobjid
      JOIN pg_catalog.pg_namespace dn ON dn.oid=COALESCE(dp.pronamespace,dop.oprnamespace)
      WHERE dep.classid='pg_catalog.pg_constraint'::pg_catalog.regclass AND dep.objid=con.oid
        AND dn.nspname<>'pg_catalog'),'[]'::json) AS non_native_dependencies,
    CASE WHEN con.contype='f' THEN
      (SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
        'schema',ns.nspname,'name',o.oprname,'function_schema',fn.nspname,
        'function_name',p.proname,'function_language',pl.lanname,
        'result_schema',resn.nspname,'result_type',res.typname,
        'left_schema',ln.nspname,'left_type',lt.typname,'right_schema',rn.nspname,'right_type',rt.typname)
        ORDER BY k.ordinality)
       FROM pg_catalog.unnest(con.conpfeqop || con.conppeqop || con.conffeqop) WITH ORDINALITY k(oid,ordinality)
       JOIN pg_catalog.pg_operator o ON o.oid=k.oid JOIN pg_catalog.pg_namespace ns ON ns.oid=o.oprnamespace
       JOIN pg_catalog.pg_proc p ON p.oid=o.oprcode JOIN pg_catalog.pg_namespace fn ON fn.oid=p.pronamespace
       JOIN pg_catalog.pg_language pl ON pl.oid=p.prolang
       JOIN pg_catalog.pg_type res ON res.oid=o.oprresult JOIN pg_catalog.pg_namespace resn ON resn.oid=res.typnamespace
       JOIN pg_catalog.pg_type lt ON lt.oid=o.oprleft JOIN pg_catalog.pg_namespace ln ON ln.oid=lt.typnamespace
       JOIN pg_catalog.pg_type rt ON rt.oid=o.oprright JOIN pg_catalog.pg_namespace rn ON rn.oid=rt.typnamespace)
      ELSE NULL END AS operators
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_class pc ON pc.oid=con.confrelid LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace
    LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=con.conindid
    LEFT JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid LEFT JOIN pg_catalog.pg_am am ON am.oid=ic.relam
    WHERE n.nspname=$1 AND c.relname=$2 ORDER BY con.conname`,
  operator: `SELECT n.nspname AS schema,o.oprname AS name,fn.nspname AS function_schema,
    p.proname AS function_name,pl.lanname AS function_language,resn.nspname AS result_schema,res.typname AS result_type,
    ln.nspname AS left_schema,lt.typname AS left_type,rn.nspname AS right_schema,rt.typname AS right_type
    FROM pg_catalog.pg_operator o JOIN pg_catalog.pg_namespace n ON n.oid=o.oprnamespace
    JOIN pg_catalog.pg_proc p ON p.oid=o.oprcode JOIN pg_catalog.pg_namespace fn ON fn.oid=p.pronamespace
    JOIN pg_catalog.pg_language pl ON pl.oid=p.prolang
    JOIN pg_catalog.pg_type res ON res.oid=o.oprresult JOIN pg_catalog.pg_namespace resn ON resn.oid=res.typnamespace
    JOIN pg_catalog.pg_type lt ON lt.oid=o.oprleft JOIN pg_catalog.pg_namespace ln ON ln.oid=lt.typnamespace
    JOIN pg_catalog.pg_type rt ON rt.oid=o.oprright JOIN pg_catalog.pg_namespace rn ON rn.oid=rt.typnamespace
    WHERE n.nspname='pg_catalog' AND o.oprname=$1 AND ln.nspname='pg_catalog' AND lt.typname=$2
    AND rn.nspname='pg_catalog' AND rt.typname=$2`,
  random: genRandomUuidQuery,
  deployedRandom: createCatalogQueries.deployedRandom,
  clock: createCatalogQueries.clock,
}
export interface OriginalColumnCatalog {
  name: string
  type_oid: string
  typmod: number
  collation: string
  postgres_type: string
  type_schema: string
  type_name: string
  type_kind: string
  not_null: boolean
  default_expression: string | null
  identity: string
  generated: string
  collation_default: boolean
  acl: string | null
}
interface OperatorCatalog {
  schema: string
  name: string
  function_schema: string
  function_name: string
  function_language: string
  result_schema: string
  result_type: string
  left_schema: string
  left_type: string
  right_schema: string
  right_type: string
}
interface BackingCatalog {
  unique: boolean
  valid: boolean
  ready: boolean
  live: boolean
  primary: boolean
  exclusion: boolean
  immediate: boolean
  key_count: number
  total_count: number
  nulls_not_distinct: boolean
  predicate: string | null
  expressions: string | null
  method: string
  keys: {
    name: string
    option: number
    collation: string
    opclass_schema: string
    opclass: string
    family_schema: string
    family: string
  }[]
}
export interface OriginalConstraintCatalog {
  name: string
  index_oid: string
  kind: string
  validated: boolean
  deferrable: boolean
  deferred: boolean
  local: boolean
  inherited: number
  no_inherit: boolean
  definition: string
  columns: string[]
  parent_schema: string | null
  parent_name: string | null
  parent_columns: string[]
  delete_action: string
  update_action: string
  match_type: string
  backing: BackingCatalog | null
  operators: OperatorCatalog[] | null
  non_native_dependencies: { class: string; schema: string; name: string }[]
}
type Shape = Record<string, 'string' | 'number' | 'boolean' | 'nullable'>
function object(value: unknown): Record<string, unknown> {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'ORIGINAL_RELATION_CATALOG_MALFORMED',
  )
  return value as Record<string, unknown>
}
function shape(value: unknown, fields: Shape) {
  const result = object(value)
  for (const [key, type] of Object.entries(fields))
    requireCondition(
      type === 'nullable'
        ? result[key] === null || typeof result[key] === 'string'
        : typeof result[key] === type && (type !== 'number' || Number.isSafeInteger(result[key])),
      'ORIGINAL_RELATION_CATALOG_MALFORMED',
    )
  return result
}
function strings(value: unknown): asserts value is string[] {
  requireCondition(
    Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
    'ORIGINAL_RELATION_CATALOG_MALFORMED',
  )
}
function oid(value: unknown): asserts value is string {
  requireCondition(
    typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value),
    'ORIGINAL_RELATION_CATALOG_MALFORMED',
  )
}
function columnRows(rows: unknown[]): OriginalColumnCatalog[] {
  return rows.map((entry) => {
    const row = shape(entry, {
      name: 'string',
      type_oid: 'string',
      typmod: 'number',
      collation: 'string',
      postgres_type: 'string',
      type_schema: 'string',
      type_name: 'string',
      type_kind: 'string',
      not_null: 'boolean',
      default_expression: 'nullable',
      identity: 'string',
      generated: 'string',
      collation_default: 'boolean',
      acl: 'nullable',
    })
    oid(row.type_oid)
    oid(row.collation)
    requireCondition(row.type_oid !== '0', 'ORIGINAL_RELATION_CATALOG_MALFORMED')
    return row as unknown as OriginalColumnCatalog
  })
}
function operatorRow(value: unknown): OperatorCatalog {
  return shape(value, {
    schema: 'string',
    name: 'string',
    function_schema: 'string',
    function_name: 'string',
    function_language: 'string',
    result_schema: 'string',
    result_type: 'string',
    left_schema: 'string',
    left_type: 'string',
    right_schema: 'string',
    right_type: 'string',
  }) as unknown as OperatorCatalog
}
function constraintRows(rows: unknown[]): OriginalConstraintCatalog[] {
  return rows.map((entry) => {
    const row = shape(entry, {
      name: 'string',
      index_oid: 'string',
      kind: 'string',
      validated: 'boolean',
      deferrable: 'boolean',
      deferred: 'boolean',
      local: 'boolean',
      inherited: 'number',
      no_inherit: 'boolean',
      definition: 'string',
      parent_schema: 'nullable',
      parent_name: 'nullable',
      delete_action: 'string',
      update_action: 'string',
      match_type: 'string',
    })
    strings(row.columns)
    strings(row.parent_columns)
    oid(row.index_oid)
    requireCondition(
      Array.isArray(row.non_native_dependencies),
      'ORIGINAL_RELATION_CATALOG_MALFORMED',
    )
    row.non_native_dependencies.forEach((dependency) =>
      shape(dependency, { class: 'string', schema: 'string', name: 'string' }),
    )
    if (row.backing !== null) {
      const backing = shape(row.backing, {
        unique: 'boolean',
        valid: 'boolean',
        ready: 'boolean',
        live: 'boolean',
        primary: 'boolean',
        exclusion: 'boolean',
        immediate: 'boolean',
        key_count: 'number',
        total_count: 'number',
        nulls_not_distinct: 'boolean',
        predicate: 'nullable',
        expressions: 'nullable',
        method: 'string',
      })
      requireCondition(Array.isArray(backing.keys), 'ORIGINAL_RELATION_CATALOG_MALFORMED')
      backing.keys.forEach((key) => {
        const parsed = shape(key, {
          name: 'string',
          option: 'number',
          collation: 'string',
          opclass_schema: 'string',
          opclass: 'string',
          family_schema: 'string',
          family: 'string',
        })
        oid(parsed.collation)
      })
    }
    requireCondition(
      row.operators === null || Array.isArray(row.operators),
      'ORIGINAL_RELATION_CATALOG_MALFORMED',
    )
    if (Array.isArray(row.operators)) row.operators.forEach(operatorRow)
    return row as unknown as OriginalConstraintCatalog
  })
}
function operatorType(column: Column) {
  return column.type.enum ? 'anyenum' : column.type.name === 'varchar' ? 'text' : column.type.name
}
function nativeOperator(actual: OperatorCatalog, name: string, type: string) {
  const equality: Record<string, string> = {
    uuid: 'uuid_eq',
    text: 'texteq',
    int4: 'int4eq',
    int8: 'int8eq',
    numeric: 'numeric_eq',
    timestamp: 'timestamp_eq',
    timestamptz: 'timestamptz_eq',
    anyenum: 'enum_eq',
  }
  const functionName =
    name === '='
      ? equality[type]
      : name === '<>' && type === 'anyenum'
        ? 'enum_ne'
        : name === '>' && ['timestamp', 'timestamptz'].includes(type)
          ? `${type}_gt`
          : undefined
  return (
    actual.schema === 'pg_catalog' &&
    actual.function_schema === 'pg_catalog' &&
    actual.function_name === functionName &&
    actual.function_language === 'internal' &&
    actual.result_schema === 'pg_catalog' &&
    actual.result_type === 'bool' &&
    actual.name === name &&
    actual.left_schema === 'pg_catalog' &&
    actual.right_schema === 'pg_catalog' &&
    actual.left_type === type &&
    actual.right_type === type
  )
}
function backingMatches(actual: OriginalConstraintCatalog, columns: OriginalColumnCatalog[]) {
  const index = actual.backing
  const opclasses: Record<string, string> = {
    uuid: 'uuid_ops',
    varchar: 'text_ops',
    text: 'text_ops',
    int4: 'int4_ops',
    int8: 'int8_ops',
    numeric: 'numeric_ops',
    timestamp: 'timestamp_ops',
    timestamptz: 'timestamptz_ops',
  }
  return (
    actual.index_oid !== '0' &&
    !!index &&
    index.unique &&
    index.valid &&
    index.ready &&
    index.live &&
    index.primary === (actual.kind === 'p') &&
    !index.exclusion &&
    index.immediate &&
    !index.nulls_not_distinct &&
    index.predicate === null &&
    index.expressions === null &&
    index.method === 'btree' &&
    index.key_count === actual.columns.length &&
    index.total_count === actual.columns.length &&
    index.keys.length === actual.columns.length &&
    index.keys.every((key, at) => {
      const column = columns.find((entry) => entry.name === actual.columns[at])
      return (
        column &&
        key.name === column.name &&
        key.option === 0 &&
        key.collation === column.collation &&
        key.opclass_schema === 'pg_catalog' &&
        key.family_schema === 'pg_catalog' &&
        key.family ===
          (['int4', 'int8'].includes(column.type_name)
            ? 'integer_ops'
            : ['timestamp', 'timestamptz'].includes(column.type_name)
              ? 'datetime_ops'
              : column.type_kind === 'e'
                ? 'enum_ops'
                : opclasses[column.type_name]) &&
        key.opclass === (column.type_kind === 'e' ? 'enum_ops' : opclasses[column.type_name])
      )
    })
  )
}
function semantics(entry: OriginalConstraint) {
  const { name: _name, ...rest } = entry
  return { ...rest, columns: entry.kind === 'c' ? [...entry.columns].sort() : entry.columns,
    ...(entry.kind==='f'?{updateAction:entry.updateAction??'NO ACTION'}:{}) }
}
function constraintMatches(
  actual: OriginalConstraintCatalog,
  expected: OriginalConstraint,
  spec: OriginalRelation,
  columns: OriginalColumnCatalog[],
  parentKeys: Map<string, OriginalConstraintCatalog[]>,
) {
  if (expected.name !== null && actual.name !== expected.name) return false
  if (
    actual.kind !== expected.kind ||
    !actual.validated ||
    actual.deferrable ||
    actual.deferred ||
    !actual.local ||
    actual.inherited !== 0 ||
    actual.no_inherit !== (expected.kind !== 'c') ||
    actual.non_native_dependencies.length
  )
    return false
  let parsed: OriginalConstraint
  try {
    parsed = parseConstraint(actual.definition, spec.columns, true)
  } catch {
    return false
  }
  if (replayDigest(semantics(parsed)) !== replayDigest(semantics(expected))) return false
  if (
    replayDigest(expected.kind === 'c' ? [...actual.columns].sort() : actual.columns) !==
    replayDigest(expected.kind === 'c' ? [...expected.columns].sort() : expected.columns)
  )
    return false
  if (
    expected.kind !== 'f' &&
    (actual.parent_schema !== null ||
      actual.parent_name !== null ||
      actual.parent_columns.length ||
      actual.delete_action !== ' ' ||
      actual.update_action !== ' ' ||
      actual.match_type !== ' ')
  )
    return false
  if (expected.kind === 'p' || expected.kind === 'u')
    return backingMatches(actual, columns) && actual.operators === null
  if (expected.kind === 'f') {
    const parent = expected.parent!
    const actions:Record<ReferentialAction,string>={'NO ACTION':'a',CASCADE:'c',RESTRICT:'r','SET NULL':'n','SET DEFAULT':'d'}
    return (
      actual.backing !== null &&
      parentKeys
        .get(replayDigest(parent))
        ?.some(
          (key) =>
            key.index_oid === actual.index_oid &&
            replayDigest(key.backing) === replayDigest(actual.backing),
        ) &&
      actual.parent_schema === parent.schema &&
      actual.parent_name === parent.name &&
      replayDigest(actual.parent_columns) === replayDigest(parent.columns) &&
      actual.delete_action === actions[expected.deleteAction] &&
      actual.update_action === actions[expected.updateAction??'NO ACTION'] &&
      actual.match_type === 's' &&
      actual.operators?.length === expected.columns.length * 3 &&
      actual.operators.every((entry, index) =>
        nativeOperator(
          entry,
          '=',
          operatorType(
            spec.columns.find(
              (column) => column.name === expected.columns[index % expected.columns.length],
            )!,
          ),
        ),
      )
    )
  }
  return actual.backing === null && actual.index_oid === '0' && actual.operators === null
}
export interface OriginalRelationObservation {
  definition: 'ABSENT' | 'EXACT' | 'DRIFTED' | 'PRECONDITION_MISSING'
  componentClass: 'ORIGINAL_CREATE_TABLE_COMPONENT'
  stateDigest: string
}
export async function inspectOriginalRelation(
  reader: CatalogReader,
  spec: OriginalRelation,
): Promise<OriginalRelationObservation> {
  const { contractDigest, ...body } = spec
  requireCondition(contractDigest === replayDigest(body), 'ORIGINAL_RELATION_CONTRACT_DRIFT')
  const evidence: unknown[] = []
  const result = (
    definition: OriginalRelationObservation['definition'],
  ): OriginalRelationObservation => ({
    definition,
    componentClass: spec.componentClass,
    stateDigest: replayDigest({ contractDigest, definition, evidence }),
  })
  const one = async (query: string, parameters: string[]) => {
    const rows = await reader.query(query, parameters)
    requireCondition(
      Array.isArray(rows) && rows.length <= 1,
      'ORIGINAL_RELATION_CATALOG_CARDINALITY',
    )
    evidence.push({ query: replayHash(query), parameters, rows })
    return rows.length ? rows[0] : null
  }
  const namespaces = new Set([
    spec.schema,
    ...spec.columns.map((column) => column.type.schema),
    ...spec.constraints.flatMap((entry) => (entry.parent ? [entry.parent.schema] : [])),
  ])
  for (const name of namespaces) {
    const raw = await one(originalRelationQueries.namespace, [name])
    if (raw === null) return result('PRECONDITION_MISSING')
    if (shape(raw, { name: 'string' }).name !== name) return result('DRIFTED')
  }
  const types = new Map<string, { oid: string; collation: string }>()
  for (const column of spec.columns) {
    const key = `${column.type.schema}.${column.type.name}`
    if (types.has(key)) continue
    const raw = await one(originalRelationQueries.type, [column.type.schema, column.type.name])
    if (raw === null) return result('PRECONDITION_MISSING')
    const actual = shape(raw, {
      oid: 'string',
      kind: 'string',
      collation: 'string',
      element_schema: 'nullable',
      element_name: 'nullable',
    })
    oid(actual.oid)
    oid(actual.collation)
    requireCondition(actual.oid !== '0', 'ORIGINAL_RELATION_CATALOG_MALFORMED')
    if (actual.members !== null) strings(actual.members)
    if (
      actual.kind !== (column.type.enum ? 'e' : 'b') ||
      (column.type.enum
        ? replayDigest(actual.members) !== replayDigest(column.type.enum.members)
        : actual.members !== null) ||
      (column.type.name === '_text'
        ? actual.element_schema !== 'pg_catalog' || actual.element_name !== 'text'
        : actual.element_schema !== null || actual.element_name !== null)
    )
      return result('DRIFTED')
    types.set(key, { oid: actual.oid, collation: actual.collation })
  }
  let randomSchema = 'pg_catalog'
  const defaults = spec.columns.map((column) => column.normalizedDefault)
  if (
    defaults.some(
      (entry) => entry.kind === 'FUNCTION' && entry.name === 'canonical.gen_random_uuid',
    )
  ) {
    const raw = await one(originalRelationQueries.random, [])
    if (raw === null) return result('PRECONDITION_MISSING')
    const actual = shape(raw, { schema: 'string', origin: 'string', executable: 'boolean' })
    if (
      !actual.executable ||
      !['POSTGRES_BUILTIN', 'PGCRYPTO_EXTENSION'].includes(String(actual.origin))
    )
      return result('PRECONDITION_MISSING')
    randomSchema = String(actual.schema)
  }
  if (defaults.some((entry) => entry.kind === 'FUNCTION' && entry.name === 'pg_catalog.now')) {
    const raw = await one(originalRelationQueries.clock, [])
    if (raw === null) return result('PRECONDITION_MISSING')
    const actual = shape(raw, {
      schema: 'string',
      name: 'string',
      language: 'string',
      result: 'string',
      executable: 'boolean',
    })
    if (
      actual.schema !== 'pg_catalog' ||
      actual.name !== 'now' ||
      actual.language !== 'internal' ||
      actual.result !== 'timestamptz' ||
      !actual.executable
    )
      return result('PRECONDITION_MISSING')
  }
  const operators = new Map<string, [string, string]>()
  for (const entry of spec.constraints) {
    if (entry.kind !== 'c')
      for (const key of entry.columns) {
        const type = operatorType(spec.columns.find((column) => column.name === key)!)
        operators.set(`=:${type}`, ['=', type])
      }
    const walk = (check: OriginalCheck) => {
      if (check.op === 'AND' || check.op === 'OR') {
        walk(check.left)
        walk(check.right)
      } else if (check.op === '>' || check.op === '<>') {
        requireCondition('column' in check.left)
        const name = check.left.column
        const type = operatorType(spec.columns.find((column) => column.name === name)!)
        operators.set(`${check.op}:${type}`, [check.op, type])
      }
    }
    if (entry.check) walk(entry.check)
  }
  for (const [name, type] of operators.values()) {
    const raw = await one(originalRelationQueries.operator, [name, type])
    if (raw === null) return result('PRECONDITION_MISSING')
    if (!nativeOperator(operatorRow(raw), name, type)) return result('DRIFTED')
  }
  const parentKeys = new Map<string, OriginalConstraintCatalog[]>()
  for (const entry of spec.constraints.filter((constraint) => constraint.parent)) {
    const parent = entry.parent!
    const parameters = [parent.schema, parent.name]
    const raw = await one(originalRelationQueries.relation, parameters)
    if (raw === null) return result('PRECONDITION_MISSING')
    const relation = shape(raw, { kind: 'string', standalone: 'boolean' })
    if (relation.kind !== 'r' || !relation.standalone) return result('DRIFTED')
    const columns = columnRows(await reader.query(originalRelationQueries.columns, parameters))
    const keys = constraintRows(await reader.query(originalRelationQueries.constraints, parameters))
    evidence.push({ parent, columns, keys })
    if (
      !parent.columns.every((key, index) => {
        const column = columns.find((column) => column.name === key)
        const child = spec.columns.find((column) => column.name === entry.columns[index])!
        const type = types.get(`${child.type.schema}.${child.type.name}`)!
        return (
          column &&
          column.type_schema === child.type.schema &&
          column.type_name === child.type.name &&
          column.type_oid === type.oid &&
          column.typmod === originalTypmod(child) &&
          column.type_kind === (child.type.enum ? 'e' : 'b') &&
          column.postgres_type
            .replace(/"/g, '')
            .replace(/^public\./, '')
            .replace(/\s*([(),])\s*/g, '$1') === child.type.display &&
          column.collation === type.collation &&
          column.collation_default &&
          column.identity === '' &&
          column.generated === '' &&
          column.acl === null
        )
      })
    )
      return result('PRECONDITION_MISSING')
    const parentDefinitionColumns = parent.columns.map((name, index) => ({
      ...spec.columns.find((column) => column.name === entry.columns[index])!,
      name,
    }))
    const matchingKeys = keys.filter((key) => {
      let definition: OriginalConstraint
      try {
        definition = parseConstraint(key.definition, parentDefinitionColumns, true)
      } catch {
        return false
      }
      return (
        ['p', 'u'].includes(key.kind) &&
        definition.kind === key.kind &&
        replayDigest(definition.columns) === replayDigest(parent.columns) &&
        key.validated &&
        !key.deferrable &&
        !key.deferred &&
        key.local &&
        key.inherited === 0 &&
        key.no_inherit &&
        key.non_native_dependencies.length === 0 &&
        key.operators === null &&
        replayDigest(key.columns) === replayDigest(parent.columns) &&
        backingMatches(key, columns) &&
        (key.kind !== 'p' ||
          parent.columns.every((name) => columns.find((column) => column.name === name)?.not_null))
      )
    })
    if (!matchingKeys.length) return result('PRECONDITION_MISSING')
    parentKeys.set(replayDigest(parent), matchingKeys)
  }
  const parameters = [spec.schema, spec.name]
  const raw = await one(originalRelationQueries.relation, parameters)
  if (raw === null) return result('ABSENT')
  const relation = shape(raw, { kind: 'string', standalone: 'boolean' })
  if (relation.kind !== 'r' || !relation.standalone) return result('DRIFTED')
  const columns = columnRows(await reader.query(originalRelationQueries.columns, parameters))
  const constraints = constraintRows(
    await reader.query(originalRelationQueries.constraints, parameters),
  )
  evidence.push({ columns, constraints })
  if (
    columns.length !== spec.columns.length ||
    new Set(columns.map((column) => column.name)).size !== columns.length
  )
    return result('DRIFTED')
  for (const [index, expected] of spec.columns.entries()) {
    const actual = columns[index]
    const type = types.get(`${expected.type.schema}.${expected.type.name}`)!
    let genSchemas = [randomSchema]
    if (
      expected.normalizedDefault.kind === 'FUNCTION' &&
      expected.normalizedDefault.name === 'canonical.gen_random_uuid'
    ) {
      const expression = actual.default_expression ?? ''
      if (!/^(?:(?:[a-z_][a-z0-9_]*|"[^"]+")\.)?gen_random_uuid\(\)$/.test(expression.trim()))
        return result('DRIFTED')
      const raw = await one(originalRelationQueries.deployedRandom, [expression])
      if (raw === null) return result('DRIFTED')
      const info = shape(raw, { schema: 'string', origin: 'string', executable: 'boolean' })
      if (
        !info.executable ||
        !['POSTGRES_BUILTIN', 'PGCRYPTO_EXTENSION'].includes(String(info.origin))
      )
        return result('DRIFTED')
      genSchemas = [String(info.schema)]
    }
    if (
      actual.name !== expected.name ||
      actual.type_oid !== type.oid ||
      actual.typmod !== originalTypmod(expected) ||
      actual.collation !== type.collation ||
      actual.type_schema !== expected.type.schema ||
      actual.type_name !== expected.type.name ||
      actual.type_kind !== (expected.type.enum ? 'e' : 'b') ||
      actual.postgres_type
        .replace(/"/g, '')
        .replace(/^public\./, '')
        .replace(/\s*([(),])\s*/g, '$1') !== expected.type.display ||
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
      return result('DRIFTED')
  }
  if (
    constraints.length !== spec.constraints.length ||
    new Set(constraints.map((entry) => entry.name)).size !== constraints.length
  )
    return result('DRIFTED')
  const remaining = [...constraints]
  for (const expected of spec.constraints) {
    const index = remaining.findIndex((actual) =>
      constraintMatches(actual, expected, spec, columns, parentKeys),
    )
    if (index < 0) return result('DRIFTED')
    remaining.splice(index, 1)
  }
  return result('EXACT')
}
