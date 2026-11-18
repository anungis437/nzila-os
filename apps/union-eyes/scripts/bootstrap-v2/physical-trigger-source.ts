/** Project current trigger programs without executing SQL or observing a DB.
 * Historical reference SQL is not an input to this current-source constructor. */
import { parseSql } from '../lib/sql-census/parse'
import type { PhysicalGuardContract, PhysicalTriggerDescriptor } from '../../db/auth/physical-guard-catalog'

type ObjectNode = Record<string, unknown>
const object = (value: unknown): ObjectNode | undefined => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as ObjectNode : undefined
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-z_][a-z0-9_]*$/.test(value)
const namespace = (value: unknown): value is 'public' | 'user_management' => value === 'public' || value === 'user_management'
const strings = (value: unknown): string[] => {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('Current trigger source string vector is invalid')
  return value.map(item => {
    const result = object(object(item)?.String)?.sval
    if (typeof result !== 'string') throw new Error('Current trigger source string is invalid')
    return result
  })
}
function uncastText(value: unknown): ObjectNode | undefined {
  let current = object(value)
  while (object(current?.TypeCast)) {
    const cast = object(current?.TypeCast)!
    const type = object(cast.typeName)
    const names = strings(type?.names)
    if (![['text'], ['pg_catalog','text']].some(allowed => JSON.stringify(names) === JSON.stringify(allowed))
      || (Array.isArray(type?.arrayBounds) && type.arrayBounds.length)
      || (Array.isArray(type?.typmods) && type.typmods.length))
      throw new Error('Current trigger condition supports only source textual equality')
    current = object(cast.arg)
  }
  return current
}
function condition(value: unknown): PhysicalTriggerDescriptor['condition'] {
  if (value === undefined) return null
  const expression = object(object(value)?.A_Expr)
  if (expression?.kind !== 'AEXPR_OP' || JSON.stringify(strings(expression.name)) !== '["="]')
    throw new Error('Unsupported current source trigger condition')
  const column = object(uncastText(expression.lexpr)?.ColumnRef)
  const path = strings(column?.fields)
  const literal = object(uncastText(expression.rexpr)?.A_Const)
  const text = object(literal?.sval)?.sval
  if (path.length !== 2 || !['new','old'].includes(path[0]) || !identifier(path[1])
    || typeof text !== 'string' || /[\\\u0000-\u001f]/.test(text) || text.length > 2000)
    throw new Error('Unsupported current source trigger equality operands')
  return { kind:'text-equality', row:path[0] as 'new' | 'old', column:path[1], value:text }
}

function triggerDescriptor(value: unknown, relationOwners: Readonly<Record<string,string>>, exclusive: boolean): PhysicalTriggerDescriptor {
  const trigger = object(value), relation = object(trigger?.relation)
  const schema = relation?.schemaname ?? 'public', table = relation?.relname
  const name = trigger?.trigname, functionPath = strings(trigger?.funcname)
  const functionSchema = functionPath.length === 1 ? 'public' : functionPath[0]
  const functionName = functionPath.at(-1)
  const qualified = `${schema}.${table}`
  const owner = Object.hasOwn(relationOwners, qualified) ? relationOwners[qualified] : undefined
  const timing = trigger?.timing ?? 0, events = trigger?.events
  const row = trigger?.row ?? false, isConstraint = trigger?.isconstraint ?? false
  const deferrable = trigger?.deferrable ?? false, deferred = trigger?.initdeferred ?? false
  const columns = strings(trigger?.columns), args = strings(trigger?.args)
  if (!namespace(schema) || !identifier(table) || !identifier(name) || !identifier(owner)
    || !namespace(functionSchema) || !identifier(functionName) || ![1,2].includes(functionPath.length)
    || ![0,2,64].includes(Number(timing)) || !Number.isInteger(events) || Number(events) <= 0
    || (Number(events) & ~60) !== 0 || typeof row !== 'boolean' || typeof isConstraint !== 'boolean'
    || typeof deferrable !== 'boolean' || typeof deferred !== 'boolean' || (deferred && !deferrable)
    || !columns.every(identifier) || new Set(columns).size !== columns.length
    || args.some(arg => arg.includes('\0')) || trigger?.constrrel !== undefined)
    throw new Error(`Current trigger source/declared relation ownership is invalid: ${qualified}|${name}`)
  let oldTable: string | null = null, newTable: string | null = null
  const transitions = trigger?.transitionRels ?? []
  if (!Array.isArray(transitions)) throw new Error('Current trigger transition source is invalid')
  for (const item of transitions) {
    const transition = object(object(item)?.TriggerTransition)
    if (!transition || transition.isTable !== true || !identifier(transition.name)
      || typeof (transition.isNew ?? false) !== 'boolean') throw new Error('Unsupported current trigger transition source')
    if (transition.isNew === true) {
      if (newTable !== null) throw new Error('Duplicate current trigger transition source')
      newTable = transition.name
    } else {
      if (oldTable !== null) throw new Error('Duplicate current trigger transition source')
      oldTable = transition.name
    }
  }
  return {
    schema, table_name:table, table_owner:owner, name, function_schema:functionSchema, function_name:functionName,
    tgtype:Number(events) | Number(timing) | (row ? 1 : 0), tgdeferrable:deferrable, tginitdeferred:deferred,
    args_hex:args.length ? Buffer.from(args.join('\0')+'\0','utf8').toString('hex') : '', exclusive,
    is_constraint:isConstraint, columns, old_table:oldTable, new_table:newTable, condition:condition(trigger?.whenClause),
  }
}

/** The ownership map is supplied by the canonical installation source and
 * qualified table census. It must never be built from observed owners. */
export async function projectSourcePhysicalTriggers(
  contracts: readonly PhysicalGuardContract[],
  currentSqlPrograms: readonly string[],
  relationOwners: Readonly<Record<string,string>>,
): Promise<PhysicalTriggerDescriptor[]> {
  if (!relationOwners || typeof relationOwners !== 'object') throw new Error('Current source relation ownership map is required')
  const byIdentity = new Map<string,PhysicalTriggerDescriptor>()
  const add = (spec: PhysicalTriggerDescriptor) => {
    const identity = `${spec.schema}.${spec.table_name}|${spec.name}`
    const existing = byIdentity.get(identity)
    if (existing && JSON.stringify({...existing,exclusive:false}) !== JSON.stringify({...spec,exclusive:false}))
      throw new Error(`Conflicting current source trigger declarations: ${identity}`)
    byIdentity.set(identity, {...spec, exclusive:spec.exclusive || existing?.exclusive === true})
  }
  for (const contract of contracts) for (const spec of contract.triggers) {
    const parsed = await parseSql(spec.definition)
    if (!parsed.ok || parsed.statements.length !== 1 || !parsed.statements[0].CreateTrigStmt)
      throw new Error(`Current physical contract trigger must parse: ${spec.name}`)
    const projected = triggerDescriptor(parsed.statements[0].CreateTrigStmt, relationOwners, contract.exclusiveTriggers === true)
    if (projected.schema !== 'public' || projected.table_name !== spec.table_name || projected.name !== spec.name
      || projected.function_schema !== 'public' || projected.function_name !== spec.function_name
      || projected.tgtype !== spec.tgtype || projected.tgdeferrable !== spec.tgdeferrable
      || projected.tginitdeferred !== spec.tginitdeferred || projected.args_hex !== spec.args_hex)
      throw new Error(`Current physical contract declaration metadata differs: ${spec.table_name}|${spec.name}`)
    add(projected)
  }
  for (const sql of currentSqlPrograms) {
    const parsed = await parseSql(sql)
    if (!parsed.ok) throw new Error('Current physical trigger SQL producer must parse')
    for (const [index,node] of parsed.statements.entries()) {
      if (node.CreateTrigStmt) add(triggerDescriptor(node.CreateTrigStmt, relationOwners, false))
      if (node.DoStmt && /\bCREATE\s+(?:CONSTRAINT\s+)?TRIGGER\b/i.test(parsed.texts[index]))
        throw new Error('Dynamic trigger DDL requires an explicit current source constructor')
    }
  }
  return [...byIdentity.values()].sort((a,b) => `${a.schema}.${a.table_name}|${a.name}`.localeCompare(`${b.schema}.${b.table_name}|${b.name}`))
}
