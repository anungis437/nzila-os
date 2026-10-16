import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'

export interface FakeFunctionAcl {
  grantor: string
  grantee: string
  privilege: 'EXECUTE'
  grantable: boolean
}
export interface FakeFunctionContext {
  actor: string
  creationSchema: string
  searchPath: string[]
  defaultAcl: FakeFunctionAcl[]
}
type NativeIdentity = { schema: string; name: string; kind: string }
export interface FakeFunctionRow {
  schema: string
  name: string
  kind: string
  argument_types: NativeIdentity[]
  argument_names: string[] | null
  argument_modes: null
  all_argument_types: null
  argument_count: number
  variadic: string
  default_count: number
  defaults: string | null
  return_schema: string
  return_name: string
  return_kind: string
  returns_set: boolean
  language: string
  security_definer: boolean
  volatility: string
  strict: boolean
  parallel: string
  leakproof: boolean
  config: null
  body: string
  binary: null
  cost: number
  rows: number
  support: string
  transforms: null
  sql_body_absent: boolean
  owner: string
  acl: FakeFunctionAcl[]
  dependents: { class_id: string; object_id: string; sub_id: number; kind: string }[]
}
const fail = () => {
  throw new ProvisioningError('FAKE_FUNCTION_SOURCE_UNSUPPORTED')
}
function identity(name: string, argument: boolean): NativeIdentity {
  const native: Record<string, string> = argument
    ? { text: 'text', boolean: 'bool' }
    : { boolean: 'bool', void: 'void', trigger: 'trigger' }
  const resolved = native[name.toLowerCase()]
  if (!resolved) return fail()
  return {
    schema: 'pg_catalog',
    name: resolved,
    kind: ['void', 'trigger'].includes(resolved) ? 'p' : 'b',
  }
}
/** Source interpreter stores opaque prosrc; it does not execute SQL/PLpgSQL bodies. */
export function applyFakeFunctionSource(
  source: string,
  context: FakeFunctionContext,
  functions: FakeFunctionRow[],
  nativeVisible: (name: string) => boolean,
) {
  const tokens = sqlTokens(source)
  let at = 0
  const word = (value: string) =>
    tokens[at]?.kind === 'WORD' && tokens[at].value.toUpperCase() === value
  const take = (value: string) => {
    if (!word(value)) return false
    at++
    return true
  }
  const need = (value: string) => {
    if (!take(value)) fail()
  }
  const symbol = (value: string) => {
    if (tokens[at++]?.value !== value) fail()
  }
  const id = () => {
    const token = tokens[at++]
    if (!token || !['WORD', 'IDENTIFIER'].includes(token.kind)) return fail()
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  const drop = take('DROP')
  if (drop) {
    need('FUNCTION')
    need('IF')
    need('EXISTS')
  } else {
    need('CREATE')
    need('OR')
    need('REPLACE')
    need('FUNCTION')
  }
  let schema: string | null = null,
    name = id()
  if (tokens[at]?.value === '.') {
    symbol('.')
    schema = name
    name = id()
  }
  symbol('(')
  const arguments_: NativeIdentity[] = [],
    names: string[] = [],
    defaults: string[] = []
  let defaultSeen = false
  if (tokens[at]?.value !== ')') {
    do {
      if (arguments_.length) symbol(',')
      if (!drop) names.push(id())
      const type = identity(id(), true)
      if (!nativeVisible(type.name))
        throw new ProvisioningError('FAKE_FUNCTION_NATIVE_TYPE_SHADOWED')
      arguments_.push(type)
      if (!drop && take('DEFAULT')) {
        const value = tokens[at++]
        if (type.name === 'text' && value?.kind === 'STRING')
          defaults.push(`'${value.value.replaceAll("'", "''")}'::text`)
        else if (
          type.name === 'bool' &&
          value?.kind === 'WORD' &&
          ['TRUE', 'FALSE'].includes(value.value.toUpperCase())
        )
          defaults.push(value.value.toLowerCase())
        else fail()
        defaultSeen = true
      } else if (defaultSeen) fail()
    } while (tokens[at]?.value === ',')
  }
  symbol(')')
  if (!drop && new Set(names).size !== names.length) fail()
  const matches = (row: FakeFunctionRow) =>
    row.name === name &&
    row.argument_types.length === arguments_.length &&
    row.argument_types.every(
      (type, index) =>
        type.schema === arguments_[index].schema &&
        type.name === arguments_[index].name &&
        type.kind === arguments_[index].kind,
    )
  if (drop) {
    symbol(';')
    if (at !== tokens.length) fail()
    if (schema === null)
      schema =
        context.searchPath.find((path) =>
          functions.some((row) => row.schema === path && matches(row)),
        ) ?? null
    const previous = functions.find((row) => row.schema === schema && matches(row))
    if (previous?.dependents.length)
      throw new ProvisioningError('FAKE_FUNCTION_RESTRICT_DEPENDENCY')
    if (previous && previous.owner !== context.actor)
      throw new ProvisioningError('FAKE_FUNCTION_OWNER_REQUIRED')
    if (previous) functions.splice(functions.indexOf(previous), 1)
    return
  }
  need('RETURNS')
  const result = identity(id(), false)
  if (!nativeVisible(result.name)) throw new ProvisioningError('FAKE_FUNCTION_NATIVE_TYPE_SHADOWED')
  let language: string | null = null,
    body: string | null = null,
    stable = false
  while (tokens[at]?.value !== ';') {
    if (take('LANGUAGE')) {
      if (language !== null) fail()
      language = id()
      if (!['sql', 'plpgsql'].includes(language)) fail()
    } else if (take('STABLE')) {
      if (stable) fail()
      stable = true
    } else if (take('AS')) {
      if (body !== null) fail()
      const opening = /^\s*(\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$)/.exec(source.slice(tokens[at - 1].end))
      if (!opening) return fail()
      const start = tokens[at - 1].end + opening[0].length,
        end = source.indexOf(opening[1], start)
      if (end < 0) return fail()
      body = source.slice(start, end)
      while (tokens[at] && tokens[at].start < end + opening[1].length) at++
    } else fail()
  }
  symbol(';')
  if (at !== tokens.length || body === null || !body.trim() || language === null) return fail()
  schema ??= context.creationSchema
  const previous = functions.find((row) => row.schema === schema && matches(row))
  if (previous) {
    if (previous.owner !== context.actor)
      throw new ProvisioningError('FAKE_FUNCTION_OWNER_REQUIRED')
    if (
      previous.return_schema !== result.schema ||
      previous.return_name !== result.name ||
      previous.return_kind !== result.kind
    )
      throw new ProvisioningError('FAKE_FUNCTION_RETURN_CHANGE_DENIED')
    if (
      previous.argument_names &&
      previous.argument_names.some((value, index) => value !== names[index])
    )
      throw new ProvisioningError('FAKE_FUNCTION_ARGUMENT_RENAME_DENIED')
  }
  const row: FakeFunctionRow = {
    schema,
    name,
    kind: 'f',
    argument_types: arguments_,
    argument_names: names.length ? names : null,
    argument_modes: null,
    all_argument_types: null,
    argument_count: arguments_.length,
    variadic: '0',
    default_count: defaults.length,
    defaults: defaults.length ? defaults.join(', ') : null,
    return_schema: result.schema,
    return_name: result.name,
    return_kind: result.kind,
    returns_set: false,
    language,
    security_definer: false,
    volatility: stable ? 's' : 'v',
    strict: false,
    parallel: 'u',
    leakproof: false,
    config: null,
    body,
    binary: null,
    cost: 100,
    rows: 0,
    support: '0',
    transforms: null,
    sql_body_absent: true,
    owner: previous?.owner ?? context.actor,
    acl: structuredClone(previous?.acl ?? context.defaultAcl),
    dependents: structuredClone(previous?.dependents ?? []),
  }
  if (previous) functions[functions.indexOf(previous)] = row
  else functions.push(row)
  return row
}
