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
export type RouteAudit = 'COMPUTE_ONLY' | 'EXEMPT_UNATTRIBUTABLE' | 'EXEMPT_BALLOT_SECRECY' | 'ATOMIC' | 'ATOMIC_SERVICE' | 'NO_WRITES_FOUND' | 'CRUD_ATOMIC' | 'BEST_EFFORT' | 'NONE' | 'READ_ONLY'
export type RouteData = 'TENANT_TX' | 'SYSTEM_CONTEXT' | 'CRUD_TENANT_TX' | 'AMBIENT_DB' | 'NONE'

export interface RouteEntry {
  route: string
  methods: string[]
  mutating: boolean
  guard: RouteGuard
  kernel: boolean
  /** A governed policy that is not the kernel (the kernel has no resource of this kind), with its own proofs. */
  subordinate: 'THREAD_POLICY' | 'EXTERNAL_AUTHORITY' | null
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
  if (/retiredHandler\(/.test(source)) return 'RETIRED'
  if (/capabilityNotImplementedResponse\(/.test(source) && !/\.(insert|update|delete)\(|persistAtomicAudit/.test(source)) return 'RETIRED'
  if (/notImplemented\(/.test(source) && !/\.(insert|update|delete)\(|persistAtomicAudit/.test(source)) return 'RETIRED'
  if (/@nzila\/platform-auth\/[\w/-]*handlers/.test(source)) return 'PLATFORM_AUTH_HANDLER'
  if (/crudRoutes\(/.test(source)) return 'CRUD_FACTORY'
  if (/withAdminAuth|withSystemAdminAuth/.test(source)) return 'ADMIN_AUTH'
  if (/withRoleAuth|withEnhancedRoleAuth|withSecureAPI|withMinRole|withApiAuth/.test(source)) return 'ROLE_AUTH'
  if (/withOrganizationAuth|withOrganizationMiddleware|withExternalResourceAuth|external-resource-middleware/.test(source)) return 'ORG_AUTH'
  if (/withApi\(/.test(source)) return /required:\s*false/.test(source) ? 'WITH_API_PUBLIC' : 'WITH_API'
  if (/CRON_SECRET|verifyCronAuth|cronAuth/i.test(source)) return 'CRON_SECRET'
  if (/verify\w*(Webhook|Signature)|constructEvent|svix|x-signature|stripe-signature/i.test(source)) return 'WEBHOOK_SIGNATURE'
  if (/requireUser|requireApiAuth|getCurrentUser|\bauth\(\)|getCaseActor\(|requireCaseAction|requirePermission|requireAuth/.test(source)) return 'SESSION_AUTH'
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

/**
 * Ballot-casting routes carry no per-ballot choice audit on purpose (G12): a row with the member and a choice, or a
 * member and a receipt that points at a choice, would let a reader link a voter to a selection. Acceptance, eligibility,
 * proxy authorization and recount are audited by lib/voting/ballot-process-audit.ts without that pair. The manifest test
 * pins this list: the route file itself must not call persistAtomicAudit.
 */
export const BALLOT_SECRECY_EXEMPT_ROUTES = ['voting/sessions/[id]/vote/route.ts', 'governance/elections/sessions/[id]/vote/route.ts']

/**
 * POST routes that compute and return a result and write nothing (a quote, a validation, a summary, a preview). They are
 * mutating by HTTP method only. Each names the first-party modules that do the computing; the manifest test verifies
 * the route's own source and those modules contain no write and no database client, so a route cannot stay on this
 * list after it starts persisting.
 */
export const COMPUTE_ONLY_ROUTES: Record<string, string[]> = {
  'billing/validate/route.ts': ['lib/services/transfer-pricing-service.ts'],
  'finance/pricing/quote/route.ts': ['services/platform-economics/pricing-calculator.ts'],
  'finance/pricing/compare/route.ts': ['services/platform-economics/pricing-calculator.ts'],
  'dues/arrears/calculate/route.ts': [],
  'dues/calculate/route.ts': [],
  'admin/billing-cycles/preview/route.ts': [],
}

/**
 * Routes that read, search, classify, summarise or validate and answer over POST (a body too large or too sensitive for a
 * query string). They are mutating by HTTP method only. The shared plumbing they reach (the auth guard, the audit logger,
 * the RLS context) writes its own records, so a transitive write scan cannot prove them read-only; instead each route is
 * pinned here after review, and route-coverage-manifest.test.ts verifies the route's own source holds no write and
 * imports no function whose name says it changes state.
 */
export const READ_ONLY_POST_ROUTES = [
  'ai/classify/route.ts', 'ai/mamba/route.ts', 'ai/match-precedents/route.ts', 'ai/pension/plans/[id]/trustee-summary/route.ts',
  'ai/search/route.ts', 'ai/semantic-search/route.ts', 'ai/summarize/route.ts', 'carbon/validate/route.ts',
  'calendar-sync/connections/route.ts',
  'clause-library/search/route.ts', 'cognition/precedents/route.ts', 'compliance/validate/route.ts', 'emergency/pipeda/route.ts',
  'exit-interviews/graph-query/route.ts', 'exit-interviews/mitigation-comparison/route.ts', 'exit-interviews/scenarios/route.ts',
  'exit-interviews/search/route.ts', 'exit-interviews/simulation/route.ts', 'labour-standards/[jurisdiction]/compliance-check/route.ts',
  'members/segments/preview/route.ts', 'ml/query/route.ts', 'precedents/search/route.ts', 'profile/roles/route.ts', 'reports/execute/route.ts',
  'social-media/analytics/route.ts', 'v2/[...path]/route.ts', 'voice/transcribe/route.ts', 'voice/upload/route.ts',
  'voting/verify/route.ts', 'workspace/telemetry/route.ts',
]

/**
 * Writes that cannot be attributed to an authenticated actor and organization, so an organization-keyed audit row cannot
 * be written for them: public pseudonymous intake, capability-token assessment flows, anonymous product telemetry, and
 * cron-secret platform jobs. Each is bounded by a control the route must be shown to carry (the manifest test checks it),
 * so the exemption is a statement about what the route is bounded by, not a gap in attention.
 */
export const UNATTRIBUTABLE_WRITE_ROUTES: Record<string, { why: string; control: RegExp }> = {
  'icra/start/route.ts': { why: 'Public pseudonymous assessment intake; no actor, no tenant.', control: /guardPublicIntake|rateLimit\(/ },
  'icra/submit/route.ts': { why: 'Public assessment submission by capability; no actor, no tenant.', control: /guardPublicIntake|rateLimit\(|assessment-capability/ },
  'icra/[assessmentId]/answer/route.ts': { why: 'Answer to a pseudonymous assessment, authorised by its capability token.', control: /assessment-capability|rateLimit\(/ },
  'icra/[assessmentId]/submit/route.ts': { why: 'Submission of a pseudonymous assessment, authorised by its capability token.', control: /assessment-capability|rateLimit\(/ },
  'icra/[assessmentId]/capability/exchange/route.ts': { why: 'Exchanges a capability for a cookie; writes nothing audit-relevant.', control: /assessment-capability|rateLimit\(/ },
  'icra/checkout/route.ts': { why: 'Creates a payment-provider session for a pseudonymous assessment; no actor.', control: /assessment-capability|guardPublicIntake|rateLimit\(/ },
  'icra/email-results/route.ts': { why: 'Emails results of a pseudonymous assessment to its holder; no actor.', control: /assessment-capability|guardPublicIntake|rateLimit\(/ },
  'icra/telemetry/route.ts': { why: 'Anonymous product telemetry.', control: /rateLimit\(/ },
  'workbook/start/route.ts': { why: 'Public pseudonymous workbook intake; the id is a bearer reference until claimed (the claim is audited).', control: /guardPublicIntake/ },
  'pilot/events/route.ts': { why: 'Pilot usage telemetry stamped from the session; an audit row per usage event would flood the audit log.', control: /withRoleAuth|withApiAuth/ },
  'location/track/route.ts': { why: 'Per-ping location telemetry of a consenting member; consent, geofence and disable changes are audited.', control: /withApiAuth/ },
  'cron/external-data-sync/route.ts': { why: 'Platform-wide reference data refresh; no acting organization.', control: /cron:\s*true/ },
  'cron/location-retention/route.ts': { why: 'Platform-wide 24-hour retention sweep over user-scoped location rows; no acting organization. Its evidence row (location_deletion_log) commits in the same system transaction, so a failed evidence write keeps the data for the next run.', control: /cron:\s*true/ },
  'whop/create-checkout/route.ts': { why: 'Creates a payment-provider checkout session for the signed-in user, who may hold no organization yet; nothing is stored here.', control: /requireUser/ },
  'organizations/switch/route.ts': { why: 'Session rotation is owned and audited by platform-auth; the legacy branch only validates membership and stores nothing.', control: /auth\(\)/ },
  'cron/sla-watchdog/route.ts': { why: 'Emits deadline events and metrics only; no acting organization.', control: /cron:\s*true|CRON_SECRET|verifyCronAuth|cronAuth/i },
}

const ATOMIC_AUDIT = /persistAtomicAudit|appendMandatoryAudit/

/**
 * Platform-auth services whose audit record is part of the operation (a failed write fails and rolls back the change).
 * Each entry names the source that must carry that guarantee; route-coverage-manifest.test.ts verifies it.
 */
export const AUTH_MANDATORY_AUDIT_SERVICES: Record<string, { file: string; proof: RegExp }> = {
  createInvite: { file: 'invites/service.ts', proof: /\},\s*true\)\s*\n\s*\n\s*return \{ success: true, inviteId/ },
  updateOrgAuthPolicy: { file: 'policy/admin.ts', proof: /await withAuthSavepoint\(async \(\) => db\.insert\(authAuditLog\)[\s\S]*?org_policy_updated/ },
  disableMfa: { file: 'mfa/service.ts', proof: /mfa_disabled[\s\S]*?\}, db, true\)/ },
  enrollMfa: { file: 'mfa/service.ts', proof: /await logEvent\('mfa_enroll_started', \{ userId: input\.userId \}, db, true\)/ },
  verifyEnrollment: { file: 'mfa/service.ts', proof: /await logEvent\('mfa_enrolled', \{ userId: input\.userId \}, db, true\)/ },
}
/**
 * Case-assignment mutators that go through the authority store, whose relationship writes record their audit row on the
 * same executor (mutations.ts: insertRelationship / revokeRelationship call auditAuthorityMutation). Verified by test.
 */
export const KERNEL_AUDITED_CALLS = ['assignCase', 'reassignCase', 'revokeCaseAssignment', 'grantCaseAccessGuarded', 'revokeCaseAccessGuarded', 'assignPrimaryRepresentative']
const KERNEL_AUDITED_CALL = new RegExp(`\\b(${KERNEL_AUDITED_CALLS.join('|')})\\(`)
const AUTH_AUDITED_CALL = new RegExp(`\\b(${Object.keys(AUTH_MANDATORY_AUDIT_SERVICES).join('|')})\\(`)

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

/** Statements that change stored state: ORM writes and raw SQL writes. */
const WRITE_TOKEN = /\.(insert|update|delete)\(|\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|TRUNCATE)\b|putBlob\(|deleteBlob\(|\.transaction\(/i

/** The route's first-party modules to a bounded depth (the route's own imports, then theirs). */
function reachable(root: string, file: string, source: string, depth: number, seen = new Set<string>()): string[] {
  const out: string[] = []
  for (const f of localImports(root, file, source)) {
    if (seen.has(f)) continue
    seen.add(f)
    out.push(f)
    if (depth > 1) out.push(...reachable(root, f, readFileSync(f, 'utf8'), depth - 1, seen))
  }
  return out
}

function auditOf(route: string, source: string, guard: RouteGuard, mutating: boolean, imports: string[]): RouteAudit {
  if (!mutating) return 'READ_ONLY'
  if (BALLOT_SECRECY_EXEMPT_ROUTES.includes(route)) return 'EXEMPT_BALLOT_SECRECY'
  if (route in COMPUTE_ONLY_ROUTES || READ_ONLY_POST_ROUTES.includes(route)) return 'COMPUTE_ONLY'
  if (route in UNATTRIBUTABLE_WRITE_ROUTES) return 'EXEMPT_UNATTRIBUTABLE'
  // The legacy event item API delegates PATCH/DELETE to the canonical handler, whose tenant-locked
  // transaction commits its mutation and mandatory audit together. This is a narrow, pinned alias:
  // the manifest ratchet checks both the delegate and the canonical audited implementation.
  if (route === 'events/[id]/route.ts' &&
      /from ['"]@\/app\/api\/calendar\/events\/\[id\]\/route['"]/.test(source) &&
      /canonicalPATCH\(request/.test(source) && /canonicalDELETE\(request/.test(source)) {
    return 'ATOMIC_SERVICE'
  }
  if (guard === 'CRUD_FACTORY') return 'CRUD_ATOMIC'
  if (ATOMIC_AUDIT.test(source)) return 'ATOMIC'
  if (imports.some((f) => ATOMIC_AUDIT.test(readFileSync(f, 'utf8')))) return 'ATOMIC_SERVICE'
  if (AUTH_AUDITED_CALL.test(source) || KERNEL_AUDITED_CALL.test(source)) return 'ATOMIC_SERVICE'
  // A mutating method whose handler and everything it reaches contain no write is read-only in effect.
  if (!WRITE_TOKEN.test(source) && !imports.some((f) => WRITE_TOKEN.test(readFileSync(f, 'utf8')))) return 'NO_WRITES_FOUND'
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
        kernel: /lib\/authority|case-access-service|lib\/documents\/(?:download-issuance|ocr-authority|intake-lifecycle)|authority\/store\/route-adapter|findReadableCase\(|requireCaseFilingCapacity\(|hasCaseFilingCapacity\(|requireKernelCaseAction\(/.test(source),
        subordinate: (/lib\/messaging\/thread-(access|assignment|lifecycle|read-state)/.test(source)
          ? 'THREAD_POLICY'
          : /withExternalMatterResourceAuth/.test(source)
            ? 'EXTERNAL_AUTHORITY'
            : null) as RouteEntry['subordinate'],
        data: dataOf(source, guard),
        audit: auditOf(relative(api, file).split(sep).join('/'), source, guard, mutating, reachable(root, file, source, 3)),
      }
    })
    .sort((a, b) => a.route.localeCompare(b.route))
  // A route that only re-exports another route is governed by, and counted as, its target.
  const byFile = new Map(entries.map((e) => [e.route, e]))
  for (const e of entries) {
    if (e.guard !== 'DELEGATED') continue
    const source = readFileSync(join(api, e.route), 'utf8')
    const spec = source.match(/(?:\bas\s+Delegate\w+[^}]*\}|export\s*(?:\*|\{[^}]*\}))\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/)?.[1]
    const target = spec ? byFile.get(relative(api, join(api, e.route, '..', spec + '.ts')).split(sep).join('/')) : undefined
    if (target && target.guard === 'RETIRED') e.guard = 'RETIRED'
    if (target) { e.kernel = target.kernel; e.subordinate = target.subordinate; e.data = target.data; e.audit = target.audit }
  }
  return entries
}

/** Domains whose records are cases, documents or messages: their routes belong on the authority kernel. */
export const KERNEL_DOMAINS = /^(cases|claims|grievances|documents|messages|investigations|external\/grievances)\//

/** A mutating route with no route-level atomic audit (a service it calls may still audit; this is the evidence gap). */
export const auditGap = (e: RouteEntry) =>
  e.mutating && (e.audit === 'NONE' || e.audit === 'BEST_EFFORT') && !['RETIRED', 'PLATFORM_AUTH_HANDLER'].includes(e.guard)

export const kernelPending = (e: RouteEntry) =>
  e.mutating && KERNEL_DOMAINS.test(e.route) && !e.kernel && e.guard !== 'RETIRED' && e.subordinate === null

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
