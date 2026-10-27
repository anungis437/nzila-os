/**
 * Route-specific evidence provenance for Gate 0B.4 and later tranches.
 *
 * Earlier tranches checked only that a quoted line exists somewhere in the cited file. That check cannot tell a quote
 * in the HTTP method that is classified from a quote in a sibling method, a sibling route, or a helper the route does
 * not import. This module makes each evidence item name how it supports the claim and proves that relationship from
 * the source text:
 *
 *   ROUTE_HANDLER_DIRECT    The quote is inside the exact exported handler of the classified method in the route file.
 *   ROUTE_IMPORTED_HELPER   The route file imports `symbol`, uses it inside that method, and the quote is inside the
 *                           definition of that symbol in the imported module.
 *   SERVICE_IMPLEMENTATION  The cited file is reachable from the route file through imports, and the quote is in it
 *                           (inside the definition of `symbol` when one is named).
 *   SCHEMA_OR_POLICY        The cited file is a schema, migration or governance file. When `resolvesExport` is named,
 *                           the file must be the one the route's own import path resolves that export to.
 *   INFERENCE_UNVERIFIED    Not evidence. It is recorded apart from the evidence list and can never support a
 *                           material claim.
 *
 * A material claim (authentication, authorization, tenantScope, mutation, audit) must be supported by at least one
 * non-inference item, and authentication and authorization by the route handler or a helper the route imports.
 * A quote from an unrelated file, or a symbol quoted elsewhere in the code base, supports nothing.
 */
import { dirname, join, normalize, posix } from 'node:path'

export const PROVENANCES = ['ROUTE_HANDLER_DIRECT', 'ROUTE_IMPORTED_HELPER', 'SERVICE_IMPLEMENTATION', 'SCHEMA_OR_POLICY']
export const MATERIAL_CLAIMS = ['authentication', 'authorization', 'tenantScope', 'mutation', 'audit']
export const CLAIMS = [...MATERIAL_CLAIMS, 'behavior', 'dataOwnership', 'privacy', 'scope', 'implementation', 'defect']
export const ROUTE_NEAR_PROVENANCES = ['ROUTE_HANDLER_DIRECT', 'ROUTE_IMPORTED_HELPER']
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const APP = 'apps/union-eyes/'
const API = `${APP}app/api/`
const SCHEMA_PREFIXES = [`${APP}db/`, `${APP}lib/api/crud-governance.ts`, `${APP}lib/api/crud-low-role-guard.ts`]

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The text of a top-level declaration: from its start to the line before the next column-0 statement. */
function regionFrom(text, start) {
  const lines = text.slice(start).split('\n')
  let end = lines.length
  for (let i = 1; i < lines.length; i += 1) {
    if (/^(export|const|let|var|function|async|class|import|type|interface|enum)\b/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(0, end).join('\n')
}

/** The region that defines `symbol` as a top-level declaration (all overload signatures and the implementation), or null. */
export function definitionRegion(text, symbol) {
  const re = new RegExp(`^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function\\*?\\s+${escapeRe(symbol)}\\b|(?:const|let|var)\\s+${escapeRe(symbol)}\\b|class\\s+${escapeRe(symbol)}\\b|enum\\s+${escapeRe(symbol)}\\b)`, 'gm')
  const regions = []
  for (const match of text.matchAll(re)) regions.push(regionFrom(text, match.index))
  return regions.length === 0 ? null : regions.join('\n')
}

/** The region of one class method or object method named `name`, found by indentation, or null. */
/** A top-level definition, or `Owner.member` for a method of a class or an object defined at top level. */
export function symbolRegion(text, symbol) {
  const dot = symbol.indexOf('.')
  return dot < 0 ? definitionRegion(text, symbol) : memberRegion(text, symbol.slice(0, dot), symbol.slice(dot + 1))
}

export function memberRegion(text, owner, name) {
  const ownerRegion = definitionRegion(text, owner)
  if (!ownerRegion) return null
  const lines = ownerRegion.split('\n')
  const re = new RegExp(`^(\\s+)(?:(?:private|public|protected)\\s+)?(?:static\\s+)?(?:async\\s+)?${escapeRe(name)}\\s*[(<]`)
  for (let i = 0; i < lines.length; i += 1) {
    const match = re.exec(lines[i])
    if (!match) continue
    const indent = match[1].length
    let end = lines.length
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === '') continue
      const lead = lines[j].match(/^(\s*)/)[1].length
      if (lead < indent && /^\s*\S/.test(lines[j])) {
        end = j
        break
      }
      if (lead === indent && /^\s*\}[,;]?\s*$/.test(lines[j])) {
        end = j + 1
        break
      }
    }
    return lines.slice(i, end).join('\n')
  }
  return null
}

/**
 * The text a route file dedicates to one HTTP method. A handler declared as `export const GET = ...` or
 * `export async function GET` is its own region. A method that the file takes from `crudRoutes(...)` (destructured or
 * assigned from a handlers object) is the crudRoutes configuration call, because the factory builds every method from
 * that configuration. A method the file does not export has no region.
 */
export function handlerRegion(text, method) {
  const direct = new RegExp(`^export\\s+(?:async\\s+function\\s+${method}\\b|const\\s+${method}\\b)`, 'm').exec(text)
  if (direct) {
    const region = regionFrom(text, direct.index)
    const assigned = region.match(/=\s*(\w+)\.(GET|POST|PUT|PATCH|DELETE)\s*;?\s*$/)
    if (assigned) return crudCallRegion(text, assigned[1]) ? `${region}\n${crudCallRegion(text, assigned[1])}` : region
    return region
  }
  const destructured = new RegExp(`^const\\s*\\{([^}]*)\\}\\s*=\\s*crudRoutes\\(`, 'm')
  const match = destructured.exec(text)
  if (match && match[1].split(',').map((item) => item.trim().split(':')[0].trim()).includes(method)) {
    if (!exportedLater(text, method)) return null
    return regionFrom(text, match.index)
  }
  return null
}

function crudCallRegion(text, name) {
  const match = new RegExp(`^const\\s+${escapeRe(name)}\\s*=\\s*crudRoutes\\(`, 'm').exec(text)
  return match ? regionFrom(text, match.index) : null
}

function exportedLater(text, method) {
  return new RegExp(`^export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}`, 'm').test(text)
}

/** Parses static, re-export and dynamic import specifiers, with the names each one brings in. */
const importCache = new Map()

export function importsOf(text) {
  if (!importCache.has(text)) importCache.set(text, parseImports(text))
  return importCache.get(text)
}

function parseImports(text) {
  const out = []
  const staticRe = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g
  for (const match of text.matchAll(staticRe)) {
    if (match[1]) continue
    const clause = match[2]
    const names = []
    const named = clause.match(/\{([\s\S]*)\}/)
    if (named) {
      for (const part of named[1].split(',')) {
        const item = part.trim().replace(/^type\s+/, '')
        if (!item) continue
        const [imported, local] = item.split(/\s+as\s+/)
        names.push({ imported: imported.trim(), local: (local ?? imported).trim() })
      }
    }
    const rest = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim()
    if (rest && !rest.startsWith('*')) names.push({ imported: 'default', local: rest.split(/\s+/)[0] })
    out.push({ spec: match[3], names, dynamic: false })
  }
  for (const match of text.matchAll(/(?:await\s+)?import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ spec: match[1], names: [], dynamic: true })
  for (const match of text.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const names = match[1].split(',').map((part) => part.trim()).filter(Boolean).map((item) => {
      const [imported, local] = item.split(':').map((value) => value.trim())
      return { imported, local: local ?? imported }
    })
    out.push({ spec: match[2], names, dynamic: true })
  }
  for (const match of text.matchAll(/export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g)) out.push({ spec: match[1], names: [], dynamic: false, reexport: true })
  return out
}

export function resolveSpec(spec, fromFile, exists) {
  let base
  if (spec.startsWith('@/')) base = `${APP}${spec.slice(2)}`
  else if (spec.startsWith('.')) base = posix.normalize(join(dirname(fromFile), spec).split('\\').join('/'))
  else return null
  base = normalize(base).split('\\').join('/')
  for (const suffix of ['', '.ts', '.tsx', '.mjs', '/index.ts', '/index.tsx']) {
    const candidate = `${base}${suffix}`
    if (exists(candidate) && /\.(ts|tsx|mjs)$/.test(candidate)) return candidate
  }
  return null
}

/** Files reachable from `file` through imports, to `depth` hops. */
export function reachableFiles(file, readText, exists, depth = 4) {
  const seen = new Map([[file, 0]])
  let frontier = [file]
  for (let level = 1; level <= depth; level += 1) {
    const next = []
    for (const current of frontier) {
      if (!exists(current)) continue
      for (const item of importsOf(readText(current))) {
        const resolved = resolveSpec(item.spec, current, exists)
        if (resolved && !seen.has(resolved)) {
          seen.set(resolved, level)
          next.push(resolved)
        }
      }
    }
    frontier = next
  }
  return seen
}

/**
 * Finds the file that defines `symbol` when module `entry` is imported. Explicit named re-exports win over
 * `export *`. Returns the defining files so that an ambiguous export can be reported.
 */
export function resolveExportDefinitions(entry, symbol, readText, exists, seen = new Set()) {
  if (seen.has(entry) || !exists(entry)) return []
  seen.add(entry)
  const text = readText(entry).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/[^\n'"`]*$/gm, '')
  if (new RegExp(`^export\\s+(?:declare\\s+)?(?:async\\s+)?(?:const|function|class|enum|let)\\s+${escapeRe(symbol)}\\b`, 'm').test(text)) return [entry]
  for (const match of text.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = match[1].split(',').map((part) => part.trim().split(/\s+as\s+/).pop().trim())
    if (names.includes(symbol)) {
      const original = match[1].split(',').map((part) => part.trim()).find((part) => part.split(/\s+as\s+/).pop().trim() === symbol).split(/\s+as\s+/)[0].trim()
      const target = resolveSpec(match[2], entry, exists)
      if (target) return resolveExportDefinitions(target, original, readText, exists, seen)
    }
  }
  const found = []
  for (const match of text.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveSpec(match[1], entry, exists)
    if (target) found.push(...resolveExportDefinitions(target, symbol, readText, exists, seen))
  }
  return [...new Set(found)]
}

/** The imports of `routeFile` that bring `symbol` in, each with the module it came from. */
function importersOf(text, symbol) {
  return importsOf(text).filter((item) => item.names.some((name) => name.local === symbol || name.imported === symbol))
}

const wordIn = (text, word) => new RegExp(`(?<![\\w$])${escapeRe(word)}(?![\\w$])`).test(text)

/**
 * Problems with one evidence item. `ctx`: { route, method, exists, readText }.
 */
export function evidenceItemProblems(item, ctx, label) {
  const out = []
  const { route, method, exists, readText } = ctx
  const routeFile = `${API}${route}`
  if (!item || typeof item !== 'object') return [`${label} has a malformed evidence item`]
  if (!PROVENANCES.includes(item.provenance)) return [`${label} cites evidence without a valid provenance (${JSON.stringify(item.provenance)}): a quote is not evidence until its relationship to the route is stated`]
  if (!CLAIMS.includes(item.claim)) out.push(`${label} cites evidence for an unknown claim ${JSON.stringify(item.claim)}`)
  if (typeof item.ref !== 'string' || typeof item.quote !== 'string' || item.quote.length < 6) return [...out, `${label} has a malformed evidence item`]
  if (!exists(item.ref)) return [...out, `${label} cites a missing file ${item.ref}`]
  const text = readText(item.ref)
  if (!text.includes(item.quote)) return [...out, `${label} cites ${item.ref} but the quoted text is not in the file`]
  const where = `${label} evidence ${item.provenance} for ${item.claim} in ${item.ref}`

  if (item.provenance === 'ROUTE_HANDLER_DIRECT') {
    if (item.ref !== routeFile) out.push(`${where} is not the classified route file ${routeFile}; a sibling or collection route does not prove this route's behavior`)
    if (item.method !== method) out.push(`${where} is tagged for ${item.method} but the record is ${method}`)
    else if (item.ref === routeFile) {
      const region = handlerRegion(text, method)
      if (region === null) out.push(`${where}: the route file exports no ${method} handler`)
      else if (item.symbol === undefined) {
        if (!region.includes(item.quote)) out.push(`${where}: the quote is not inside the ${method} handler of the route; it may belong to another method or to module scope`)
      } else {
        const local = definitionRegion(text, item.symbol)
        if (local === null) out.push(`${where}: the route file has no module-scope declaration of ${item.symbol}`)
        else if (!local.includes(item.quote)) out.push(`${where}: the quote is not inside the declaration of ${item.symbol}`)
        if (!wordIn(region, item.symbol)) out.push(`${where}: the ${method} handler does not call ${item.symbol}; a helper another method calls proves nothing about this method`)
      }
    }
    return out
  }

  if (item.provenance === 'ROUTE_IMPORTED_HELPER') {
    if (item.method !== method) out.push(`${where} is tagged for ${item.method} but the record is ${method}`)
    if (!exists(routeFile)) return [...out, `${where}: the route file does not exist`]
    if (typeof item.symbol !== 'string' || item.symbol === '') return [...out, `${where} names no symbol`]
    const routeText = readText(routeFile)
    const importers = importersOf(routeText, item.symbol)
    if (importers.length === 0) return [...out, `${where}: the route file does not import ${item.symbol}`]
    const region = handlerRegion(routeText, method)
    const local = importers[0].names.find((name) => name.local === item.symbol || name.imported === item.symbol)
    if (region === null) out.push(`${where}: the route file exports no ${method} handler`)
    else if (!wordIn(region, local.local)) out.push(`${where}: ${local.local} is not used inside the ${method} handler`)
    const resolved = importers.map((entry) => resolveSpec(entry.spec, routeFile, exists)).filter(Boolean)
    const definitions = resolved.flatMap((entry) => resolveExportDefinitions(entry, local.imported, readText, exists))
    if (!resolved.includes(item.ref) && !definitions.includes(item.ref)) out.push(`${where}: ${item.ref} is neither the module the route imports ${item.symbol} from nor the file that defines it`)
    const definition = definitionRegion(text, item.symbol)
    if (definition === null) out.push(`${where}: ${item.ref} has no top-level definition of ${item.symbol} to read the quote against`)
    else if (!definition.includes(item.quote)) out.push(`${where}: the quote is not inside the definition of ${item.symbol}`)
    return out
  }

  if (item.provenance === 'SERVICE_IMPLEMENTATION') {
    if (!exists(routeFile)) return [...out, `${where}: the route file does not exist`]
    const reach = reachableFiles(routeFile, readText, exists, 4)
    if (!reach.has(item.ref) || item.ref === routeFile) out.push(`${where}: the file is not reachable from the route through imports; code the route does not run supports nothing about it`)
    if (item.symbol) {
      const definition = symbolRegion(text, item.symbol)
      if (definition === null) out.push(`${where}: ${item.ref} has no top-level definition of ${item.symbol}`)
      else if (!definition.includes(item.quote)) out.push(`${where}: the quote is not inside the definition of ${item.symbol}`)
    }
    return out
  }

  if (!SCHEMA_PREFIXES.some((prefix) => item.ref.startsWith(prefix)) && !/\/db\/|\.sql$/.test(item.ref)) out.push(`${where} is not a schema, migration or governance file`)
  if (item.resolvesExport) {
    if (!exists(routeFile)) return [...out, `${where}: the route file does not exist`]
    const reach = reachableFiles(routeFile, readText, exists, 3)
    const importerFiles = [...reach.keys()].filter((file) => importersOf(readText(file), item.resolvesExport).length > 0)
    if (importerFiles.length === 0) return [...out, `${where}: neither the route nor a file it reaches imports ${item.resolvesExport}`]
    const defs = new Set()
    for (const file of importerFiles) {
      for (const entry of importersOf(readText(file), item.resolvesExport)) {
        const spec = resolveSpec(entry.spec, file, exists)
        if (!spec) continue
        const imported = entry.names.find((name) => name.local === item.resolvesExport || name.imported === item.resolvesExport)?.imported ?? item.resolvesExport
        for (const def of resolveExportDefinitions(spec, imported, readText, exists)) defs.add(def)
      }
    }
    if (defs.size === 0) out.push(`${where}: ${item.resolvesExport} does not resolve to a definition through the route import path`)
    else if (defs.size > 1) out.push(`${where}: ${item.resolvesExport} resolves to more than one definition (${[...defs].join(', ')}); the schema claim is ambiguous`)
    else if (!defs.has(item.ref)) out.push(`${where}: the route import path resolves ${item.resolvesExport} to ${[...defs][0]}, not ${item.ref}`)
  }
  const tableName = item.resolvesExport ?? item.symbol
  if (tableName) {
    const definition = definitionRegion(text, tableName)
    if (definition === null) out.push(`${where}: ${item.ref} has no top-level definition of ${tableName}`)
    else if (!definition.includes(item.quote)) out.push(`${where}: the quote is not inside the definition of ${tableName}`)
  }
  if (item.absentColumns) {
    const definition = definitionRegion(text, item.resolvesExport ?? item.symbol ?? '')
    if (definition === null) out.push(`${where}: cannot locate the table definition to prove a column is absent`)
    else for (const column of item.absentColumns) if (new RegExp(`\\b${escapeRe(column)}\\b`, 'i').test(definition)) out.push(`${where}: the table definition contains ${column}`)
  }
  return out
}

/**
 * Problems with the provenance of a whole record: every item is valid, and each material claim has the support its
 * kind requires. `inferences` are held apart and may not touch a material claim.
 */
export function recordProvenanceProblems(record, { exists, readText }) {
  const label = `classification ${record.id}`
  const out = []
  const items = Array.isArray(record.evidence) ? record.evidence : []
  const ctx = { route: record.route, method: record.method, exists, readText }
  for (const item of items) out.push(...evidenceItemProblems(item, ctx, label))
  if (record.status === 'CLASSIFIED' || record.status === 'UNRESOLVED') {
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(record.method)
    const required = ['authentication', 'authorization', 'tenantScope', 'mutation']
    if (mutating || record.mutationAudit !== 'NOT_MUTATING') required.push('audit')
    for (const claim of required) {
      const support = items.filter((item) => item.claim === claim && PROVENANCES.includes(item.provenance))
      if (support.length === 0) out.push(`${label} makes the ${claim} claim without non-inference evidence`)
      else if (['authentication', 'authorization'].includes(claim) && !support.some((item) => ROUTE_NEAR_PROVENANCES.includes(item.provenance))) {
        out.push(`${label} supports its ${claim} claim only from outside the route handler and its imports`)
      }
    }
  }
  const inferences = record.inferences
  if (!Array.isArray(inferences)) out.push(`${label} must list its inferences, even when empty`)
  else {
    for (const inference of inferences) {
      if (typeof inference?.statement !== 'string' || inference.statement.length < 20) out.push(`${label} has a malformed inference`)
      else if (MATERIAL_CLAIMS.includes(inference.claim)) out.push(`${label} rests the ${inference.claim} claim on an inference; INFERENCE_UNVERIFIED cannot support a material claim`)
      else if (!CLAIMS.includes(inference.claim)) out.push(`${label} has an inference for an unknown claim`)
    }
  }
  return out
}
