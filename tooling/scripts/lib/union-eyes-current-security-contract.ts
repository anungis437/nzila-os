import { createHash } from 'node:crypto'
import { parseSql, type ParseNode } from '../../../apps/union-eyes/scripts/lib/sql-census/parse'

export interface CurrentFunctionDescriptor {
  schema: string
  name: string
  signature: string
  owner: string
  bodyDigest: string
  language: string
  volatility: string
  definer: boolean
  strict: boolean
  leakproof: boolean
  returns: string
  returnsSet: boolean
  argumentNames: string[] | null
  argumentModes: string[] | null
  allArgumentTypes: string[]
  defaultCount: number
  defaults: string | null
  config: string[] | null
  executeAcl: { role: string; grantable: boolean }[]
}
export interface CurrentColumnGrant {
  schema: string
  table: string
  role: string
  privilege: string
  columns: string[]
  grantable: boolean
}
export interface CurrentTableGrant {
  schema: string; table: string; role: string; privileges: string[]
}

const aliases: Record<string, string> = {
  bool: 'boolean', int2: 'smallint', int4: 'integer', int8: 'bigint', float4: 'real', float8: 'double precision',
  varchar: 'character varying', bpchar: 'character',
  timestamptz: 'timestamp with time zone', timestamp: 'timestamp without time zone',
}
const strings = (nodes: ParseNode[] = []) => nodes.map(node => String(node.String.sval))
const typeName = (node: ParseNode): string => {
  const parts = strings(node.names)
  if (parts[0] === 'pg_catalog') parts.shift()
  const name = parts.join('.')
  return (aliases[name] ?? name) + (node.arrayBounds?.length ? '[]' : '')
}
const identity = (object: ParseNode) => {
  const parts = strings(object.objname)
  if (parts.length !== 2) throw new Error('Current function must declare its schema')
  return `${parts.join('.')}(${(object.objargs ?? []).map((node: ParseNode) => typeName(node.TypeName)).join(',')})`
}
const roleName = (role: ParseNode) => role.roletype === 'ROLESPEC_PUBLIC' ? 'PUBLIC' : role.rolename
const inputMode = (mode: string) => ['FUNC_PARAM_DEFAULT', 'FUNC_PARAM_IN', 'FUNC_PARAM_INOUT'].includes(mode)
const modes: Record<string, string> = { FUNC_PARAM_DEFAULT: 'i', FUNC_PARAM_IN: 'i', FUNC_PARAM_OUT: 'o', FUNC_PARAM_INOUT: 'b', FUNC_PARAM_TABLE: 't' }

/**
 * Project the actual reviewed compiler SQL, never the live catalog, into the
 * existing admission contract. PostgreSQL's parser supplies identities and ACL
 * targets, so a same-name overload or a different body is not an exception.
 */
export async function projectCurrentCompilerSecurity(programs: readonly string[], initialOwner = 'ue_v2_owner', options: { immutableReferenceOnly?: boolean } = {}) {
  const functions = new Map<string, CurrentFunctionDescriptor>()
  const columns = new Map<string, CurrentColumnGrant>()
  const tables = new Map<string, CurrentTableGrant>()
  for (const sql of programs) {
    const parsed = await parseSql(sql)
    if (!parsed.ok) throw new Error('Current security compiler SQL must parse')
    for (const node of parsed.statements) {
      if (node.CreateFunctionStmt) {
        const fn = node.CreateFunctionStmt, names = strings(fn.funcname)
        if (options.immutableReferenceOnly && names.length === 1) names.unshift('public')
        if (names.length !== 2 || (fn.replace && !options.immutableReferenceOnly)) throw new Error('Current function creation must be qualified and additive')
        const parameters: ParseNode[] = (fn.parameters ?? []).map((item: ParseNode) => item.FunctionParameter)
        if (parameters.some(item => !modes[item.mode])) throw new Error('Unsupported current function argument mode')
        const signature = `${names.join('.')}(${parameters.filter(item => inputMode(item.mode)).map(item => typeName(item.argType)).join(',')})`
        if (functions.has(signature) && !options.immutableReferenceOnly) throw new Error(`Duplicate current function producer: ${signature}`)
        const declarations: ParseNode[] = (fn.options ?? []).map((item: ParseNode) => item.DefElem)
        const option = (name: string) => declarations.find(item => item.defname === name)?.arg
        const body = option('as')?.List?.items
        if (body?.length !== 1 || typeof body[0].String?.sval !== 'string') throw new Error('Exact current function body required')
        const settings = declarations.filter(item => item.defname === 'set').map(item => item.arg.VariableSetStmt)
        if ((!options.immutableReferenceOnly || settings.length) && (settings.length !== 1 || settings[0].name !== 'search_path' || settings[0].kind !== 'VAR_SET_VALUE'))
          throw new Error(`Pinned current function search path required: ${signature}`)
        const path: string[] = settings[0]?.args.map((item: ParseNode) => item.A_Const?.sval?.sval) ?? []
        if ((!path.length && !options.immutableReferenceOnly) || path.some(item => typeof item !== 'string')) throw new Error('Literal current function search path required')
        const defaults = parameters.filter(item => item.defexpr)
        if (defaults.some(item => item.defexpr.A_Const?.isnull !== true))
          throw new Error(`Current function default requires explicit admission: ${signature}`)
        const argumentModes = parameters.map(item => modes[item.mode])
        functions.set(signature, {
          schema: names[0], name: names[1], signature, owner: initialOwner,
          bodyDigest: createHash('sha256').update(body[0].String.sval).digest('hex'),
          language: option('language')?.String?.sval,
          volatility: (option('volatility')?.String?.sval ?? 'volatile')[0],
          definer: option('security')?.Boolean?.boolval === true,
          strict: option('strict')?.Boolean?.boolval === true,
          leakproof: option('leakproof')?.Boolean?.boolval === true,
          returns: typeName(fn.returnType), returnsSet: fn.returnType.setof === true,
          argumentNames: parameters.some(item => item.name) ? parameters.map(item => item.name ?? '') : null,
          argumentModes: argumentModes.some(mode => mode !== 'i') ? argumentModes : null,
          allArgumentTypes: parameters.map(item => typeName(item.argType)),
          defaultCount: defaults.length,
          defaults: defaults.length ? defaults.map(item => `NULL::${typeName(item.argType)}`).join(', ') : null,
          config: path.length ? ['search_path=' + path.join(', ')] : null,
          executeAcl: [{ role: initialOwner, grantable: false }, { role: 'PUBLIC', grantable: false }],
        })
      } else if (node.AlterOwnerStmt?.objectType === 'OBJECT_FUNCTION') {
        const statement = node.AlterOwnerStmt, key = identity(statement.object.ObjectWithArgs), fn = functions.get(key)
        if (!fn) throw new Error(`Current function ownership has no producer: ${key}`)
        const next = roleName(statement.newowner)
        if (typeof next !== 'string' || next === 'PUBLIC') throw new Error('Exact current function owner required')
        fn.executeAcl = fn.executeAcl.map(grant => ({ ...grant, role: grant.role === fn.owner ? next : grant.role }))
        fn.owner = next
      } else if (node.GrantStmt) {
        const grant = node.GrantStmt
        if (grant.grant_option) throw new Error('Current application security must not delegate grant options')
        if (grant.objtype === 'OBJECT_FUNCTION') {
          const roles: string[] = (grant.grantees ?? []).map((item: ParseNode) => roleName(item.RoleSpec))
          for (const object of grant.objects ?? []) {
            const key = identity(object.ObjectWithArgs), fn = functions.get(key)
            if (!fn) {
              if (grant.is_grant) throw new Error(`Function grant has no current producer: ${key}`)
              continue
            }
            if (grant.privileges?.some((item: ParseNode) => item.AccessPriv.priv_name !== 'execute'))
              throw new Error('Unexpected current function privilege')
            fn.executeAcl = fn.executeAcl.filter(item => !roles.includes(item.role))
            if (grant.is_grant) fn.executeAcl.push(...roles.map(role => ({ role, grantable: false })))
          }
        } else if (grant.objtype === 'OBJECT_TABLE' && !options.immutableReferenceOnly) {
          for (const object of grant.objects ?? []) {
            const relation = object.RangeVar
            if (!relation) continue
            for (const access of grant.privileges ?? []) {
              const privilege = access.AccessPriv
              if (!privilege.cols?.length) {
                if (!relation.schemaname) throw new Error('Current table grant must declare its schema')
                for (const target of grant.grantees ?? []) {
                  const role = roleName(target.RoleSpec), atom = String(privilege.priv_name).toUpperCase()
                  const key = `${relation.schemaname}.${relation.relname}:${role}`
                  const current = tables.get(key) ?? { schema: relation.schemaname, table: relation.relname, role, privileges: [] }
                  current.privileges = grant.is_grant ? [...new Set([...current.privileges, atom])] : current.privileges.filter(value => value !== atom)
                  tables.set(key, current)
                }
                continue
              }
              if (!relation.schemaname) throw new Error('Current column grant must declare its schema')
              for (const target of grant.grantees ?? []) {
                const role = roleName(target.RoleSpec), atom = String(privilege.priv_name).toUpperCase()
                const key = `${relation.schemaname}.${relation.relname}:${role}:${atom}`
                const current = columns.get(key) ?? { schema: relation.schemaname, table: relation.relname, role, privilege: atom, columns: [], grantable: false }
                const names = strings(privilege.cols)
                current.columns = grant.is_grant ? [...new Set([...current.columns, ...names])] : current.columns.filter(name => !names.includes(name))
                columns.set(key, current)
              }
            }
            if (!grant.privileges?.length) {
              if (grant.is_grant) throw new Error('Unbounded current table grant is not admitted')
              for (const target of grant.grantees ?? []) tables.delete(`${relation.schemaname}.${relation.relname}:${roleName(target.RoleSpec)}`)
            }
          }
        }
      }
    }
  }
  return {
    functions: [...functions.values()].map(fn => ({ ...fn, executeAcl: fn.executeAcl.sort((a, b) => a.role.localeCompare(b.role)) })).sort((a, b) => a.signature.localeCompare(b.signature)),
    columnGrants: [...columns.values()].filter(grant => grant.columns.length).map(grant => ({ ...grant, columns: grant.columns.sort() })).sort((a, b) => `${a.schema}.${a.table}:${a.role}:${a.privilege}`.localeCompare(`${b.schema}.${b.table}:${b.role}:${b.privilege}`)),
    tableGrants: [...tables.values()].filter(grant => grant.privileges.length).map(grant => ({ ...grant, privileges: grant.privileges.sort() })).sort((a, b) => `${a.schema}.${a.table}:${a.role}`.localeCompare(`${b.schema}.${b.table}:${b.role}`)),
  }
}
