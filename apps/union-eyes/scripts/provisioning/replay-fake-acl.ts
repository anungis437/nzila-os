import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
export type FakeAclKind = 'SCHEMA' | 'TABLE' | 'SEQUENCE'
export interface FakeAclGrant {
  grantor: string
  grantee: string
  privilege: string
  grantable: boolean
}
export interface FakeAclObject {
  schema: string
  name: string
  kind: FakeAclKind
  owner: string
  grants: FakeAclGrant[]
}
export interface FakeDefaultAcl {
  schema: string
  owner: string
  kind: 'TABLE' | 'SEQUENCE'
  grants: FakeAclGrant[]
}
export interface FakeAclState {
  objects: FakeAclObject[]
  defaults: FakeDefaultAcl[]
}
export interface FakeAclExecution {
  actor: string
  searchPath: readonly string[]
  schemas: readonly string[]
  roles: readonly string[]
}
export function applyFakeAclSource(source: string, state: FakeAclState, context: FakeAclExecution) {
  const tokens = sqlTokens(source)
  let index = 0
  const fail = (code = 'FAKE_ACL_SOURCE_UNSUPPORTED'): never => {
    throw new ProvisioningError(code)
  }
  const take = (word: string) => {
    const token = tokens[index]
    if (token?.kind === 'WORD' && token.value.toUpperCase() === word) {
      index++
      return true
    }
    return false
  }
  const need = (word: string) => {
    if (!take(word)) fail()
  }
  const symbol = (value: string) => {
    if (tokens[index++]?.value !== value) fail()
  }
  const id = () => {
    const token = tokens[index++]
    if (!token || !['WORD', 'IDENTIFIER'].includes(token.kind)) return fail()
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  const list = (upper = false) => {
    const result = [upper ? id().toUpperCase() : id()]
    while (tokens[index]?.value === ',') {
      symbol(',')
      result.push(upper ? id().toUpperCase() : id())
    }
    if (new Set(result).size !== result.length) fail()
    return result
  }
  let defaults = false,
    schema: string | null = null,
    name: string | null = null,
    all = false
  if (take('ALTER')) {
    defaults = true
    need('DEFAULT')
    need('PRIVILEGES')
    need('IN')
    need('SCHEMA')
    schema = id()
  }
  const action = id().toUpperCase()
  if (!['GRANT', 'REVOKE'].includes(action) || (defaults && action !== 'REVOKE')) fail()
  const privileges = list(true)
  need('ON')
  let kind: FakeAclKind
  if (defaults || take('ALL')) {
    all = true
    const target = id().toUpperCase()
    if (!['TABLES', 'SEQUENCES'].includes(target)) return fail()
    kind = target === 'TABLES' ? 'TABLE' : 'SEQUENCE'
    if (!defaults) {
      need('IN')
      need('SCHEMA')
      schema = id()
    }
  } else if (take('SCHEMA')) {
    kind = 'SCHEMA'
    schema = id()
    name = schema
  } else {
    need('TABLE')
    kind = 'TABLE'
    name = id()
    if (tokens[index]?.value === '.') {
      symbol('.')
      schema = name
      name = id()
    } else
      schema =
        context.searchPath.find((path) =>
          state.objects.some(
            (object) => object.schema === path && object.name === name && object.kind === 'TABLE',
          ),
        ) ?? null
  }
  need(action === 'GRANT' ? 'TO' : 'FROM')
  const roles = list()
  symbol(';')
  if (index !== tokens.length) fail()
  if (!schema || !context.schemas.includes(schema)) fail('FAKE_ACL_NAMESPACE_REQUIRED')
  if (
    !context.actor ||
    !context.roles.includes(context.actor) ||
    roles.some((role) => role !== 'public' && !context.roles.includes(role))
  )
    fail('FAKE_ACL_ROLE_REQUIRED')
  const allowed =
    kind === 'SCHEMA'
      ? ['USAGE', 'CREATE']
      : kind === 'SEQUENCE'
        ? ['USAGE', 'SELECT', 'UPDATE']
        : ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
  if (
    privileges.some(
      (privilege) =>
        !allowed.includes(privilege) &&
        !(action === 'REVOKE' && privileges.length === 1 && privilege === 'ALL'),
    )
  )
    fail()
  const changed = structuredClone(state)
  const apply = (grants: FakeAclGrant[]) => {
    if (action === 'REVOKE') {
      // Other grantors' grants are not revoked by the acting owner.
      return grants.filter(
        (grant) =>
          grant.grantor !== context.actor ||
          !roles.includes(grant.grantee) ||
          !(privileges.includes('ALL') || privileges.includes(grant.privilege)),
      )
    }
    for (const role of roles)
      for (const privilege of privileges)
        if (
          !grants.some(
            (grant) =>
              grant.grantor === context.actor &&
              grant.grantee === role &&
              grant.privilege === privilege,
          )
        )
          grants.push({ grantor: context.actor, grantee: role, privilege, grantable: false })
    return grants
  }
  if (defaults) {
    if (kind === 'SCHEMA') fail()
    const entry = changed.defaults.find(
      (entry) => entry.schema === schema && entry.owner === context.actor && entry.kind === kind,
    )
    if (entry) entry.grants = apply(entry.grants)
  } else {
    const objects = changed.objects.filter(
      (object) => object.schema === schema && object.kind === kind && (all || object.name === name),
    )
    if (!all && objects.length !== 1) fail('FAKE_ACL_TARGET_REQUIRED')
    if (objects.some((object) => object.owner !== context.actor)) fail('FAKE_ACL_OWNER_REQUIRED')
    for (const object of objects) object.grants = apply(object.grants)
  }
  state.objects = changed.objects
  state.defaults = changed.defaults
}
