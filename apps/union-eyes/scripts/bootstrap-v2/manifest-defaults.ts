import { loadModule, parseSync } from 'libpg-query'
import { createRequire } from 'node:module'
import path from 'node:path'
import { is, SQL } from 'drizzle-orm'
import { getTableConfig, PgDialect, PgTable, type PgColumn } from 'drizzle-orm/pg-core'
import type pg from 'pg'
import { producerBytes } from './manifest-trace'
import {
  root,
  type SourceTable,
  type V2Plan,
} from './source'

export interface DefaultExpectation {
  table: string
  column: string
  generator: 'UUID4' | 'AUDIT_NOW' | 'DECLARED_DEFAULT'
  expression?: string
  literalType?: 'jsonb' | 'numeric' | 'text[]'
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalJson(entry)]),
    )
  return value
}

export function normalizeDefaultExpression(expression: string, literalType?: 'jsonb' | 'numeric' | 'text[]') {
  let value = expression.trim().replace(/^pg_catalog\./, '')
  if (/^\([^()]*\)$/.test(value)) value = value.slice(1, -1).trim()
  if (/^'(?:[^']|'')*'::[\w". \d()[\],]+$/.test(value))
    value = value.slice(0, value.lastIndexOf('::'))
  if (['CURRENT_TIMESTAMP', 'now()', 'transaction_timestamp()'].includes(value))
    return 'CURRENT_TIMESTAMP'
  if (literalType === 'jsonb' && /^'(?:[^']|'')*'$/.test(value))
    return JSON.stringify(canonicalJson(JSON.parse(value.slice(1, -1).replaceAll("''", "'"))))
  if (literalType === 'numeric') {
    let numeric = value.replace(/::numeric(?:\(\d+(?:,\s*\d+)?\))?$/i, '').trim()
    if (/^\([^()]*\)$/.test(numeric)) numeric = numeric.slice(1, -1).trim()
    if (/^'(?:[^']|'')*'$/.test(numeric)) numeric = numeric.slice(1, -1)
    const match = numeric.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
    if (match) {
      let coefficient = `${match[2]}${match[3] ?? ''}`.replace(/^0+/, '')
      if (!coefficient) return '0'
      const zeros = coefficient.length - coefficient.replace(/0+$/, '').length
      coefficient = coefficient.slice(0, coefficient.length - zeros)
      const exponent = BigInt(match[4] ?? '0') - BigInt(match[3]?.length ?? 0) + BigInt(zeros)
      return `${match[1] === '-' ? '-' : ''}${coefficient}e${exponent}`
    }
  }
  return value
}

export function renderDeclaredDefault(column: PgColumn): string | undefined {
  const value = column.default
  if (is(value, SQL)) {
    const rendered = new PgDialect().sqlToQuery(value)
    return rendered.params.length ? undefined : rendered.sql
  }
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (column.dataType === 'json' || column.dataType === 'array') {
    const literal: unknown = column.mapToDriverValue(value)
    if (typeof literal !== 'string')
      throw new Error(`UE_V2_DECLARED_DEFAULT_DRIVER_LITERAL_REQUIRED:${column.name}`)
    return `'${literal.replaceAll("'", "''")}'::${column.getSQLType()}`
  }
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`
  return undefined
}

export function callerDefaultDeclarationSelected(
  table: SourceTable,
  source: string,
  schema?: string,
  selectedCallerSource?: string,
) {
  // Operational classification alone does not select every duplicate barrel
  // declaration. Only the exact source admitted by the executable plan counts.
  return (schema && schema !== 'public' ? table.source : selectedCallerSource ?? table.source) === source
}

export function selectedDefaultDeclarationSources(plan: Pick<V2Plan,'tables'|'decisions'>):Map<string,string> {
  const schemaSource=(source:string)=>/^apps\/union-eyes\/db\/(?:schema\/.+|schema-[^/]+)\.ts$/.test(source) || /^packages\/db\/src\/schema\/.+\.ts$/.test(source)
  const selected=new Map(plan.tables.filter(table=>schemaSource(table.source)).map(table=>[table.name,table.source]))
  for(const decision of plan.decisions)if(decision.disposition==='PROSPECTIVE_CANONICAL' && typeof decision.relation==='string' && typeof decision.source==='string' && schemaSource(decision.source))
    selected.set(decision.relation,decision.source)
  return selected
}

/** PostgreSQL grammar preserves operators, literals, casts and function names;
 * only parser byte offsets differ between source SQL and catalog deparsing. */
export async function defaultExpressionComparator():Promise<(left:string,right:string,literalType?:DefaultExpectation['literalType'])=>boolean> {
  await loadModule()
  const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
    ? Object.fromEntries(Object.entries(value).filter(([key])=>!['location','stmt_location','stmt_len'].includes(key)).map(([key,item])=>[key,canonical(item)])) : value
  return (left,right,literalType)=>{
    try {
      const l=parseSync('SELECT '+left),r=parseSync('SELECT '+right)
      if(literalType==='text[]')for(const parsed of [l,r]){
        const value=parsed.stmts[0]?.stmt?.SelectStmt?.targetList?.[0]?.ResTarget?.val
        const array=value?.A_ArrayExpr
        if(array)array.elements=array.elements.map((element:Record<string,unknown>)=>{
          const cast=element.TypeCast as {arg?:{A_Const?:{sval?:{sval?:unknown}}};typeName?:{names?:{String?:{sval?:string}}[];arrayBounds?:unknown[];typmods?:unknown[]}}|undefined
          const names=cast?.typeName?.names?.map(name=>name.String?.sval)
          if(cast?.arg?.A_Const?.sval && typeof cast.arg.A_Const.sval.sval==='string' &&
            (JSON.stringify(names)===JSON.stringify(['text']) || JSON.stringify(names)===JSON.stringify(['pg_catalog','text'])) &&
            !cast.typeName?.arrayBounds?.length && !cast.typeName?.typmods?.length)return cast.arg
          return element
        })
      }
      if(l.stmts.length!==1 || r.stmts.length!==1)return false
      return JSON.stringify(canonical(l))===JSON.stringify(canonical(r))
    } catch {return false}
  }
}

export function currentModelDefaultExpectations(plan: V2Plan): DefaultExpectation[] {
  return plan.currentModels.models.flatMap((model) =>
    model.columns.flatMap((column) =>
      column.defaultKind === 'UUID4' || column.defaultKind === 'AUDIT_NOW'
        ? [{ table: model.table, column: column.name, generator: column.defaultKind }]
        : [],
    ),
  )
}

export function compareDeclaredDefaults(
  expected: DefaultExpectation[],
  actual: { table: string; column: string; expression: string | null }[],
  equivalent: (left:string,right:string,literalType?:DefaultExpectation['literalType'])=>boolean = () => false,
) {
  const mismatches: string[] = []
  for (const entry of expected) {
    const native = actual.find(
      (column) => column.table === entry.table && column.column === entry.column,
    )
    const expression = native?.expression?.trim().replace(/^pg_catalog\./, '')
    if (!expression || /^(?:\(*NULL\)*)(?:::.*)?$/i.test(expression)) {
      mismatches.push(`DECLARED_SERVER_DEFAULT_MISSING:${entry.table}.${entry.column}`)
      continue
    }
    if (
      (entry.generator === 'UUID4' && expression !== 'gen_random_uuid()') ||
      (entry.generator === 'AUDIT_NOW' &&
        !['CURRENT_TIMESTAMP', 'now()', 'transaction_timestamp()'].includes(expression))
    )
      mismatches.push(`CURRENT_MODEL_SERVER_GENERATOR_MISMATCH:${entry.table}.${entry.column}`)
    if (
      entry.generator === 'DECLARED_DEFAULT' &&
      (!entry.expression ||
        normalizeDefaultExpression(expression, entry.literalType) !==
          normalizeDefaultExpression(entry.expression, entry.literalType) &&
          !equivalent(expression, entry.expression, entry.literalType))
    )
      mismatches.push(`DECLARED_SERVER_DEFAULT_EXPRESSION_MISMATCH:${entry.table}.${entry.column}`)
  }
  return mismatches
}

export async function verifyDeclaredDefaults(client: pg.Client, plan: V2Plan) {
  const expected = currentModelDefaultExpectations(plan)
  const mismatches: string[] = []
  const load = createRequire(import.meta.url)
  const excludedCallerDeclarations: { source: string; table: string; reason: string }[] = []
  const selectedSources=selectedDefaultDeclarationSources(plan)
  for (const source of [...new Set(selectedSources.values())].sort()) {
    if (!plan.sourceCommitments[source]) {
      mismatches.push(`DECLARED_DEFAULT_SOURCE_NOT_BOUND:${source}`)
      continue
    }
    if (producerBytes(source) !== plan.sourceCommitments[source]) {
      mismatches.push(`DECLARED_DEFAULT_SOURCE_CHANGED_SINCE_PLAN:${source}`)
      continue
    }
    const declarations: Record<string, unknown> = load(path.join(root, ...source.split('/')))
    for (const value of Object.values(declarations)) {
      if (!is(value, PgTable)) continue
      const config = getTableConfig(value)
      const table =
        config.schema && config.schema !== 'public'
          ? `${config.schema}.${config.name}`
          : config.name
      const managed = plan.tables.find((entry) => entry.name === table)
      if (!managed) continue
      const selected = callerDefaultDeclarationSelected(managed, source, config.schema, selectedSources.get(table))
      if (!selected) {
        excludedCallerDeclarations.push({
          source,
          table,
          reason:
            config.schema && config.schema !== 'public'
              ? 'Duplicate auth declaration is not canonical authority.'
              : `Caller overlay is not selected:${managed.authority?.classification ?? 'UNOWNED_CURRENT_SOURCE'}`,
        })
        continue
      }
      for (const column of config.columns)
        if (
          column.default !== undefined &&
          managed.columns.some((entry) => entry.name === column.name) &&
          !expected.some((entry) => entry.table === table && entry.column === column.name)
        ) {
          expected.push({
            table,
            column: column.name,
            generator: 'DECLARED_DEFAULT',
            expression: renderDeclaredDefault(column),
            ...(column.getSQLType() === 'text[]'
              ? { literalType: 'text[]' as const }
              : column.getSQLType() === 'jsonb'
              ? { literalType: 'jsonb' as const }
              : column.getSQLType().startsWith('numeric')
                ? { literalType: 'numeric' as const }
                : {}),
          })
        }
    }
    if (producerBytes(source) !== plan.sourceCommitments[source])
      mismatches.push(`DECLARED_DEFAULT_SOURCE_CHANGED_DURING_INSPECTION:${source}`)
  }
  const result = await client.query<{ table: string; column: string; expression: string | null }>(`
    SELECT CASE WHEN n.nspname='public' THEN c.relname ELSE n.nspname||'.'||c.relname END AS table,
      a.attname AS column,pg_get_expr(d.adbin,d.adrelid) AS expression
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname IN ('public','user_management') AND a.attnum>0 AND NOT a.attisdropped
  `)
  mismatches.push(...compareDeclaredDefaults(expected, result.rows, await defaultExpressionComparator()))
  return {
    status: mismatches.length ? 'FAIL' : 'PASS_DECLARED_SERVER_DEFAULTS',
    checkedDefaults: expected.length,
    expectations: expected,
    mismatches,
    excludedCallerDeclarations,
    limitation:
      'SQL expressions are compared conservatively without evaluating them; unrenderable or unequal expressions fail. Actual default-dependent INSERT compatibility probes remain separate qualification.',
  }
}
