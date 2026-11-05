/**
 * Independent route-source reader for Gate 0C.4. It reads the route files directly and recomputes, per operation, the
 * handler wrapper and the role floor. It shares no code with the Gate 0C.3 builder and does not read any Gate 0C.3
 * register, so a Gate 0C.3 mistake cannot be repeated by it.
 */

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
export const FACTORY_DEFAULT_READ_ROLE = 'member'
export const FACTORY_DEFAULT_WRITE_ROLE = 'steward'
export const FACTORY_DEFAULT_ORG_SCOPED = true

const ROLE_ALIASES = { admin: 'administrator', administrator: 'administrator' }
const normalizeRole = (role) => ROLE_ALIASES[role] ?? role

/**
 * Floor classes. A member floor is reachable by any authenticated organization member. CUSTOM_CHECK is an authenticated
 * wrapper whose handler body names a role or credential check the wrapper itself does not state, so the wrapper alone
 * does not establish the floor.
 */
export const FLOOR = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  ANY_AUTHENTICATED: 'ANY_AUTHENTICATED',
  ROLE_RESTRICTED: 'ROLE_RESTRICTED',
  CUSTOM_CHECK: 'CUSTOM_CHECK',
  UNDETERMINED: 'UNDETERMINED',
}

const floorOfRole = (role) => (role === 'member' || role === 'user' ? FLOOR.ANY_AUTHENTICATED : FLOOR.ROLE_RESTRICTED)
const BODY_CHECK = /\b(role|roles|hasRole|requireRole|isPlatform|platform_lead|platformRole|CRON_SECRET|x-cron|signature|webhook|secret)\b/i

/** Returns the argument text of the call whose opening parenthesis is at `open`, balanced and string-aware. */
function callArgumentsAt(text, open) {
  let depth = 0
  let quote = null
  for (let index = open; index < text.length; index += 1) {
    const char = text[index]
    if (quote) {
      if (char === '\\') index += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') quote = char
    else if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) return text.slice(open + 1, index)
    }
  }
  return text.slice(open + 1)
}

const stringProperty = (args, name) => {
  const match = new RegExp(`\\b${name}\\s*:\\s*['"\`]([A-Za-z0-9_]+)['"\`]`).exec(args)
  return match ? match[1] : null
}
const booleanProperty = (args, name) => {
  const match = new RegExp(`\\b${name}\\s*:\\s*(true|false)\\b`).exec(args)
  return match ? match[1] === 'true' : null
}

function bindingOf(args, methods, objectName) {
  return {
    methods,
    objectName,
    table: (/\btable\s*:\s*([A-Za-z0-9_]+)/.exec(args) ?? [])[1] ?? null,
    readRole: stringProperty(args, 'readRole') ?? FACTORY_DEFAULT_READ_ROLE,
    writeRole: stringProperty(args, 'writeRole') ?? FACTORY_DEFAULT_WRITE_ROLE,
    orgScoped: booleanProperty(args, 'orgScoped') ?? FACTORY_DEFAULT_ORG_SCOPED,
    ownerColumn: stringProperty(args, 'ownerColumn'),
    itemRoute: booleanProperty(args, 'itemRoute') ?? false,
    hasBeforeCreate: /\bbeforeCreate\b/.test(args),
    hasBlockedPatchFields: /\bblockedPatchFields\b/.test(args),
  }
}

/** Parses every crudRoutes({...}) call, bound by destructuring or to a named object. */
export function crudBindings(text) {
  const bindings = []
  for (const match of text.matchAll(/(?:export\s+)?const\s*\{([^}]*)\}\s*=\s*crudRoutes\s*\(/g)) {
    const args = callArgumentsAt(text, match.index + match[0].length - 1)
    const methods = match[1]
      .split(',')
      .map((part) => part.trim().split(/\s*:\s*/).pop())
      .filter((name) => HTTP_METHODS.includes(name))
    bindings.push(bindingOf(args, methods, null))
  }
  for (const match of text.matchAll(/(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*crudRoutes\s*\(/g)) {
    bindings.push(bindingOf(callArgumentsAt(text, match.index + match[0].length - 1), [], match[1]))
  }
  return bindings
}

const withApiDeclaration = (args) => {
  const minRole = stringProperty(args, 'minRole')
  if (minRole) return { wrapper: 'withApi', role: normalizeRole(minRole), floor: floorOfRole(normalizeRole(minRole)) }
  if (booleanProperty(args, 'cron')) return { wrapper: 'withApi', role: 'cron', floor: FLOOR.ROLE_RESTRICTED }
  if (/\broles\s*:/.test(args)) return { wrapper: 'withApi', role: 'role-list', floor: FLOOR.ROLE_RESTRICTED }
  if (booleanProperty(args, 'required') === false) return { wrapper: 'withApi', role: null, floor: FLOOR.UNAUTHENTICATED }
  if (/\bauth\s*:/.test(args)) return { wrapper: 'withApi', role: null, floor: FLOOR.ANY_AUTHENTICATED }
  return { wrapper: 'withApi', role: null, floor: FLOOR.UNDETERMINED }
}

const roleOfFirstArgument = (args) => (/^\s*['"`]([A-Za-z0-9_]+)['"`]/.exec(args) ?? [])[1] ?? null

function wrapperDeclaration(name, args, text) {
  if (name === 'withApi') return withApiDeclaration(args)
  if (name === 'withRoleAuth' || name === 'withEnhancedRoleAuth') {
    const role = roleOfFirstArgument(args)
    return role ? { wrapper: name, role: normalizeRole(role), floor: floorOfRole(normalizeRole(role)) } : { wrapper: name, role: null, floor: FLOOR.UNDETERMINED }
  }
  if (name === 'withAdminAuth') return { wrapper: name, role: 'administrator', floor: FLOOR.ROLE_RESTRICTED }
  if (name === 'withApiAuth' || name === 'withOrganizationAuth') {
    return { wrapper: name, role: null, floor: BODY_CHECK.test(text) ? FLOOR.CUSTOM_CHECK : FLOOR.ANY_AUTHENTICATED }
  }
  return { wrapper: name, role: null, floor: FLOOR.UNDETERMINED }
}

/** The declaration of one exported handler, following one level of local aliasing. */
function declarationOf(text, method, bindings, depth = 0) {
  if (depth > 3) return null
  const binding = bindings.find((entry) => entry.methods.includes(method))
  if (binding) return crudDeclaration(binding, method)
  const assigned = new RegExp(`(?:export\\s+)?const\\s+${method}\\s*=\\s*`, 'g')
  for (const match of text.matchAll(assigned)) {
    const start = match.index + match[0].length
    const rest = text.slice(start)
    const member = /^([A-Za-z0-9_]+)\.([A-Z]+)\b/.exec(rest)
    if (member) {
      const bound = bindings.find((entry) => entry.objectName === member[1])
      if (bound) return crudDeclaration(bound, member[2])
    }
    const call = /^([A-Za-z0-9_]+)\s*\(/.exec(rest)
    if (call && call[1] !== 'async') return wrapperDeclaration(call[1], callArgumentsAt(text, start + call[0].length - 1), text)
    const alias = /^([A-Za-z0-9_]+)\s*[;\n]/.exec(rest)
    if (alias && alias[1] !== method) return aliasDeclaration(text, alias[1], bindings, depth + 1)
    const inner = innerWrapper(handlerBody(text, start), text)
    if (inner) return inner
  }
  const renamed = new RegExp(`export\\s*\\{[^}]*\\b([A-Za-z0-9_]+)\\s+as\\s+${method}\\b`).exec(text)
  if (renamed) return aliasDeclaration(text, renamed[1], bindings, depth + 1)
  const declared = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`).exec(text)
  if (declared) return innerWrapper(handlerBody(text, declared.index), text) ?? { wrapper: 'FUNCTION_DECLARATION', role: null, floor: FLOOR.UNDETERMINED }
  return null
}

/** The text of one exported handler: from its start to the next exported declaration. */
function handlerBody(text, start) {
  const next = text.slice(start + 1).search(/\nexport\s/)
  return next < 0 ? text.slice(start) : text.slice(start, start + 1 + next)
}

/** The first auth wrapper called inside a handler body, for handlers that wrap their work in the guard themselves. */
function innerWrapper(body, text) {
  const match = /\b(withRoleAuth|withAdminAuth|withApiAuth|withOrganizationAuth|withEnhancedRoleAuth)\s*\(/.exec(body)
  if (!match) return null
  return wrapperDeclaration(match[1], callArgumentsAt(body, match.index + match[0].length - 1), text)
}

function aliasDeclaration(text, name, bindings, depth) {
  const match = new RegExp(`const\\s+${name}\\s*=\\s*([A-Za-z0-9_]+)\\s*\\(`).exec(text)
  if (!match) return null
  return wrapperDeclaration(match[1], callArgumentsAt(text, match.index + match[0].length - 1), text)
}

function crudDeclaration(binding, method) {
  const role = method === 'GET' || method === 'HEAD' ? binding.readRole : binding.writeRole
  return {
    wrapper: 'crudRoutes',
    role: normalizeRole(role),
    floor: floorOfRole(role),
    factory: { table: binding.table, orgScoped: binding.orgScoped, ownerColumn: binding.ownerColumn, itemRoute: binding.itemRoute, hasBeforeCreate: binding.hasBeforeCreate, hasBlockedPatchFields: binding.hasBlockedPatchFields },
  }
}

/** Relative imports of the form `import { GET as X } from '../a/route'`, used to follow one level of delegation. */
export function delegates(text) {
  const out = {}
  for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
    for (const part of match[1].split(',')) {
      const [name, alias] = part.trim().split(/\s+as\s+/)
      if (HTTP_METHODS.includes(name)) out[alias ?? name] = { method: name, path: match[2] }
    }
  }
  return out
}

/** Recomputes the handler wrapper and role floor of every operation in one route file. */
export function analyseRouteFile(text) {
  const bindings = crudBindings(text)
  const methods = {}
  for (const method of HTTP_METHODS) {
    const declared = declarationOf(text, method, bindings)
    if (declared) methods[method] = declared
  }
  return { methods, bindings, delegates: delegates(text) }
}

const CANONICAL_FLOOR_WORDS = new Map([
  ['organization administrator', 'administrator'],
  ['administrator', 'administrator'],
  ['steward', 'steward'],
  ['member', 'member'],
  ['staff', 'staff'],
  ['officer role floor', 'officer'],
  ['officer', 'officer'],
])

/** Reads a stated floor such as "steward" or "organization administrator" as one role name, or null when it names several or none. */
export function roleNamedByFloor(floor) {
  return CANONICAL_FLOOR_WORDS.get(String(floor).toLowerCase().trim()) ?? null
}

/** True when `text` has a tenant-predicate token. Used only to contest an "absent predicate" claim, never to prove containment. */
export const TENANT_TOKENS = /\b(organizationId|organization_id|orgId|tenantId|tenant_id|withRLSContext|withOrgOwnedContext|withOrganizationAuth)\b/
