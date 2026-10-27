/**
 * Authoring layer for Gate 0B.4 facts. Every evidence item is produced by reading the source: the author states a
 * pattern, the helper finds the first matching line inside the region the provenance names, and refuses to build when
 * no line matches. A quote therefore cannot come from memory, from a sibling method, or from a file the route does
 * not reach. The validator re-proves each item independently from the written register.
 */
import {
  definitionRegion, handlerRegion, importsOf, resolveExportDefinitions, resolveSpec,
} from './ue-gate0b4-provenance.mjs'

export const APP = 'apps/union-eyes/'
export const API = `${APP}app/api/`
export const CRUD_FACTORY = `${APP}lib/api/crud-factory.ts`
export const CRUD_GOVERNANCE = `${APP}lib/api/crud-governance.ts`
export const LOW_ROLE = `${APP}lib/api/crud-low-role-guard.ts`

const matches = (line, pattern) => (pattern instanceof RegExp ? pattern.test(line) : line.includes(pattern))

function pickLine(region, pattern, where) {
  for (const line of region.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length >= 6 && matches(trimmed, pattern)) return trimmed
  }
  throw new Error(`no line matching ${pattern} in ${where}`)
}

/** Builds the evidence authoring helpers for one operation. `readText` and `exists` read the working tree. */
export function opAuthoring(id, readText, exists) {
  const [route, method] = id.split('|')
  const routeFile = `${API}${route}`
  const routeText = readText(routeFile)
  const region = handlerRegion(routeText, method)
  if (region === null) throw new Error(`${id} exports no ${method} handler`)

  const h = (claim, pattern) => ({ provenance: 'ROUTE_HANDLER_DIRECT', claim, method, ref: routeFile, quote: pickLine(region, pattern, `${id} handler`) })

  const imp = (claim, symbol, pattern) => {
    const importers = importsOf(routeText).filter((item) => item.names.some((name) => name.local === symbol || name.imported === symbol))
    if (importers.length === 0) throw new Error(`${id}: the route does not import ${symbol}`)
    const imported = importers[0].names.find((name) => name.local === symbol || name.imported === symbol).imported
    const modules = importers.map((entry) => resolveSpec(entry.spec, routeFile, exists)).filter(Boolean)
    const defining = modules.flatMap((entry) => resolveExportDefinitions(entry, imported, readText, exists))
    const ref = defining[0] ?? modules[0]
    if (!ref) throw new Error(`${id}: cannot resolve ${symbol}`)
    const definition = definitionRegion(readText(ref), symbol === 'default' ? imported : symbol) ?? definitionRegion(readText(ref), imported)
    if (!definition) throw new Error(`${id}: ${ref} has no definition of ${symbol}`)
    return { provenance: 'ROUTE_IMPORTED_HELPER', claim, method, ref, symbol, quote: pickLine(definition, pattern, `${ref} definition of ${symbol}`) }
  }

  const svc = (claim, file, pattern, symbol) => {
    const text = readText(file)
    const scope = symbol ? definitionRegion(text, symbol) : text
    if (scope === null) throw new Error(`${file} has no definition of ${symbol}`)
    return { provenance: 'SERVICE_IMPLEMENTATION', claim, ref: file, ...(symbol ? { symbol } : {}), quote: pickLine(scope, pattern, symbol ? `${file} ${symbol}` : file) }
  }

  const sch = (claim, file, pattern, options = {}) => {
    const text = readText(file)
    const table = options.resolvesExport ?? options.symbol
    const scope = table ? definitionRegion(text, table) : text
    if (scope === null) throw new Error(`${file} has no definition of ${table}`)
    return {
      provenance: 'SCHEMA_OR_POLICY', claim, ref: file, quote: pickLine(scope, pattern, `${file} ${table ?? ''}`),
      ...(options.resolvesExport ? { resolvesExport: options.resolvesExport } : {}),
      ...(options.symbol ? { symbol: options.symbol } : {}),
      ...(options.absentColumns ? { absentColumns: options.absentColumns } : {}),
    }
  }

  const grab = (pattern) => region.match(pattern)

  /** The file a route's import of `name` resolves to, taking the definition through any barrel. */
  const definedIn = (name) => {
    const importers = importsOf(routeText).filter((item) => item.names.some((entry) => entry.local === name || entry.imported === name))
    const imported = importers[0]?.names.find((entry) => entry.local === name || entry.imported === name)?.imported
    const modules = importers.map((entry) => resolveSpec(entry.spec, routeFile, exists)).filter(Boolean)
    const defs = [...new Set(modules.flatMap((entry) => resolveExportDefinitions(entry, imported, readText, exists)))]
    if (defs.length !== 1) throw new Error(`${id}: ${name} resolves to ${defs.length} definitions (${defs.join(', ')})`)
    return defs[0]
  }

  /** Schema evidence for a table the route imports, taken from the file its own import path resolves to. */
  const tbl = (claim, name, pattern, options = {}) => sch(claim, definedIn(name), pattern, { ...options, resolvesExport: name })
  const tableText = (name) => definitionRegion(readText(definedIn(name)), name)

  return { route, method, routeFile, region, h, imp, svc, sch, tbl, tableText, grab, definedIn }
}

export const NOT_ATOMIC = { field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'performAuditedOperation records intent and outcome around the effect; it is not committed with it.' }
export const GET_CORR = (audit) => ({ field: 'mutating', manifest: `mutating true, audit ${audit}`, actual: 'A GET reads state and writes nothing.' })
export const GET_WRITES = (audit) => ({ field: 'mutating', manifest: `read-only GET, audit ${audit}`, actual: 'This GET writes state, so the read-only classification is wrong.' })
export const COMPUTE_CORR = (audit) => ({ field: 'mutating', manifest: `mutating true, audit ${audit}`, actual: 'The POST returns a computed result and writes no row.' })

/**
 * Evidence for what a guard helper does, read from the helper the route imports. The route's own configuration of the
 * guard (its role argument) is separate evidence the fact module takes with `a.h`.
 */
export function guardEv(a, kind) {
  switch (kind) {
    case 'withRoleAuth':
      return [
        a.imp('authentication', 'withRoleAuth', 'user = await getCurrentUser()'),
        a.imp('authorization', 'withRoleAuth', 'const hasAccess = await hasRole(requiredRole)'),
        a.imp('tenantScope', 'withRoleAuth', 'authCtx.organizationId = await getOrganizationIdForUser(user.id)'),
      ]
    case 'withOrganizationAuth':
      return [
        a.imp('authentication', 'withOrganizationAuth', 'const baseUser = await requireUser()'),
        a.imp('authorization', 'withOrganizationAuth', /getCanonicalOrganizationContext\(\{/),
        a.imp('tenantScope', 'withOrganizationAuth', /organizationId: canonical\.organizationId/),
      ]
    case 'withApi':
      return [
        a.imp('authentication', 'withApi', 'const requireAuth = options.auth?.required !== false'),
        a.imp('authorization', 'withApi', 'const minRoleLevel = options.auth?.minRole'),
        a.imp('tenantScope', 'withApi', 'const requireOrg = options.requireOrg ?? requireAuth'),
      ]
    case 'withApiAuth':
      return [a.imp('authentication', 'withApiAuth', 'const requireAuth = options.requireAuth !== false && !isPublic')]
    case 'crud':
      return [
        a.imp('authentication', 'crudRoutes', 'auth: { required: true, minRole: readRole },'),
        a.imp('authorization', 'crudRoutes', a.method === 'GET' ? 'auth: { required: true, minRole: readRole },' : a.method === 'DELETE' ? "auth: { required: true, minRole: 'admin' }," : 'auth: { required: true, minRole: writeRole },'),
        a.imp('tenantScope', 'crudRoutes', 'conditions.push(eq(orgCol, organizationId));'),
      ]
    default:
      throw new Error(`unknown guard ${kind}`)
  }
}
