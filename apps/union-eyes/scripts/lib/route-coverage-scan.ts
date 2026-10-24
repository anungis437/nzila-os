import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

/**
 * Route-coverage scan (UE-CONV-K-008). Reads every app/api route file and records, from its source text, how the
 * route authenticates, what bounds its data access, whether its writes are audited atomically and whether it is
 * decided by the authority kernel. It is a textual classification, not a proof: it exists so that no route is
 * unaccounted for and so that the unguarded and unaudited counts can only shrink.
 */
export type RouteGuard =
  | 'CRUD_FACTORY' | 'WITH_API' | 'WITH_API_PUBLIC' | 'ROLE_AUTH' | 'ADMIN_AUTH' | 'ORG_AUTH' | 'SESSION_AUTH' | 'CRON_SECRET'
  | 'WEBHOOK_SIGNATURE' | 'PLATFORM_AUTH_HANDLER' | 'CAPABILITY_TOKEN' | 'RETIRED' | 'DELEGATED' | 'NONE'
export type RouteAudit = 'ATOMIC' | 'ATOMIC_SERVICE' | 'CRUD_ATOMIC' | 'BEST_EFFORT' | 'NONE' | 'READ_ONLY'
export type RouteData = 'TENANT_TX' | 'SYSTEM_CONTEXT' | 'CRUD_TENANT_TX' | 'AMBIENT_DB' | 'NONE'

export interface RouteEntry {
  route: string
  methods: string[]
  mutating: boolean
  guard: RouteGuard
  kernel: boolean
  data: RouteData
  audit: RouteAudit
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else if (entry.name === 'route.ts') out.push(path)
  }
  return out
}

function methodsOf(source: string): string[] {
  const found = new Set<string>()
  for (const m of METHODS) {
    if (new RegExp(`export\\s+(?:async\\s+function|const|let|function)\\s+${m}\\b`).test(source)) found.add(m)
  }
  for (const block of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of block[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && (METHODS as readonly string[]).includes(name)) found.add(name)
    }
  }
  return [...found].sort()
}

function guardOf(source: string): RouteGuard {
  if (/retired-financial-route/.test(source)) return 'RETIRED'
  if (/@nzila\/platform-auth\/[\w/-]*handlers/.test(source)) return 'PLATFORM_AUTH_HANDLER'
  if (/crudRoutes\(/.test(source)) return 'CRUD_FACTORY'
  if (/withAdminAuth/.test(source)) return 'ADMIN_AUTH'
  if (/withRoleAuth|withEnhancedRoleAuth|withSecureAPI|withMinRole|withApiAuth/.test(source)) return 'ROLE_AUTH'
  if (/withOrganizationAuth|withOrganizationMiddleware|withExternalResourceAuth|external-resource-middleware/.test(source)) return 'ORG_AUTH'
  if (/withApi\(/.test(source)) return /required:\s*false/.test(source) ? 'WITH_API_PUBLIC' : 'WITH_API'
  if (/CRON_SECRET|verifyCronAuth|cronAuth/i.test(source)) return 'CRON_SECRET'
  if (/verify\w*(Webhook|Signature)|constructEvent|svix|x-signature|stripe-signature/i.test(source)) return 'WEBHOOK_SIGNATURE'
  if (/requireUser|requireApiAuth|getCurrentUser|\bauth\(\)|requireCaseAction|requirePermission|requireAuth/.test(source)) return 'SESSION_AUTH'
  if (/withClaimedWorkbookAccess|assessment-capability|verifyCapability/.test(source)) return 'CAPABILITY_TOKEN'
  if (/^\s*export\s*(\*|\{[^}]*\})\s*from\s*['"]\.{1,2}\//m.test(source) || /\bimport\s*\{[^}]*\bas\s+Delegate\w+[^}]*\}\s*from\s*['"]\.{1,2}\//.test(source)) return 'DELEGATED'
  return 'NONE'
}

function dataOf(source: string, guard: RouteGuard): RouteData {
  if (guard === 'CRUD_FACTORY') return 'CRUD_TENANT_TX'
  if (/withSystemContext|withSystemRLSContext|withPlatformAdminRLSContext/.test(source)) return 'SYSTEM_CONTEXT'
  if (/withRLSContext|rlsOrgContext:\s*true/.test(source)) return 'TENANT_TX'
  if (/from\s+['"]@\/db\/db['"]|\bdb\./.test(source)) return 'AMBIENT_DB'
  return 'NONE'
}

const ATOMIC_AUDIT = /persistAtomicAudit|appendMandatoryAudit/

/** First-party modules the route imports (the `@/` alias and relative paths), resolved to files that exist. */
function localImports(root: string, file: string, source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(/from\s*['"]((?:@\/|\.{1,2}\/)[^'"]+)['"]/g)) {
    const spec = m[1]
    const base = spec.startsWith('@/') ? join(root, spec.slice(2)) : join(dirname(file), spec)
    for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
      if (existsSync(candidate) && !candidate.includes(`${sep}app${sep}api${sep}`)) { out.push(candidate); break }
    }
  }
  return out
}

function auditOf(source: string, guard: RouteGuard, mutating: boolean, imports: string[]): RouteAudit {
  if (!mutating) return 'READ_ONLY'
  if (guard === 'CRUD_FACTORY') return 'CRUD_ATOMIC'
  if (ATOMIC_AUDIT.test(source)) return 'ATOMIC'
  if (imports.some((f) => ATOMIC_AUDIT.test(readFileSync(f, 'utf8')))) return 'ATOMIC_SERVICE'
  if (/auditLog|auditDataMutation|auditSecurityEvent|logAuditEvent|recordAudit/.test(source)) return 'BEST_EFFORT'
  return 'NONE'
}

export function scanRoutes(root: string): RouteEntry[] {
  const api = join(root, 'app', 'api')
  const entries = walk(api)
    .map((file) => {
      const source = readFileSync(file, 'utf8')
      const methods = methodsOf(source)
      const mutating = methods.some((m) => MUTATING.has(m))
      const guard = guardOf(source)
      return {
        route: relative(api, file).split(sep).join('/'),
        methods,
        mutating,
        guard,
        kernel: /lib\/authority|case-access-service|authority\/store\/route-adapter/.test(source),
        data: dataOf(source, guard),
        audit: auditOf(source, guard, mutating, localImports(root, file, source)),
      }
    })
    .sort((a, b) => a.route.localeCompare(b.route))
  // A route that only re-exports another route is governed by, and counted as, its target.
  const byFile = new Map(entries.map((e) => [e.route, e]))
  for (const e of entries) {
    if (e.guard !== 'DELEGATED') continue
    const source = readFileSync(join(api, e.route), 'utf8')
    const spec = source.match(/(?:\bas\s+Delegate\w+[^}]*\}|export\s*(?:\*|\{[^}]*\}))\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/)?.[1]
    const target = spec && byFile.get(relative(api, join(api, e.route, '..', spec + '.ts')).split(sep).join('/'))
    if (target) { e.kernel = target.kernel; e.data = target.data; e.audit = target.audit }
  }
  return entries
}

/** Domains whose records are cases, documents or messages: their routes belong on the authority kernel. */
export const KERNEL_DOMAINS = /^(cases|claims|grievances|documents|messages|investigations|external\/grievances)\//

/** A mutating route with no route-level atomic audit (a service it calls may still audit; this is the evidence gap). */
export const auditGap = (e: RouteEntry) =>
  e.mutating && (e.audit === 'NONE' || e.audit === 'BEST_EFFORT') && !['RETIRED', 'PLATFORM_AUTH_HANDLER'].includes(e.guard)

export const kernelPending = (e: RouteEntry) => e.mutating && KERNEL_DOMAINS.test(e.route) && !e.kernel && e.guard !== 'RETIRED'

export function summarize(entries: RouteEntry[]) {
  const tally = <K extends string>(pick: (e: RouteEntry) => K, only: (e: RouteEntry) => boolean = () => true) => {
    const out: Record<string, number> = {}
    for (const e of entries.filter(only)) out[pick(e)] = (out[pick(e)] ?? 0) + 1
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
  }
  return {
    routes: entries.length,
    mutating: entries.filter((e) => e.mutating).length,
    kernel: entries.filter((e) => e.kernel).length,
    byGuard: tally((e) => e.guard),
    mutatingByGuard: tally((e) => e.guard, (e) => e.mutating),
    mutatingByAudit: tally((e) => e.audit, (e) => e.mutating),
    mutatingByData: tally((e) => e.data, (e) => e.mutating),
  }
}
