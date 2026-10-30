/**
 * API rate-limit guard for the edge proxy.
 *
 * The earlier proxy limiter keyed its bucket on a request header the CLIENT supplies (`x-org-id`) and sat behind an early
 * return for mutations without an Idempotency-Key, so it was bypassed by omitting a header and could be pointed at another
 * tenant's bucket by forging one (found by the runtime acceptance suite, R-31). This guard keys every bucket on something the
 * caller cannot choose:
 *
 *   - session scope: a hash of the credential presented (session cookie or bearer token). Another caller cannot reach this
 *     bucket without holding the credential, and a caller with no credential has only the IP bucket.
 *   - ip scope: the client address, at a higher ceiling, so rotating or forging credentials cannot multiply the allowance.
 *
 * Both must pass. The distributed (Redis) limiter is authoritative. When it is unavailable (not configured, down, circuit
 * open) the SAME limits are enforced from per-process memory and the decision is marked `degraded`: an outage never turns a
 * write limit into no limit, and a single transient Redis event never rejects traffic by itself.
 */
import { checkRateLimit as checkMemory } from '@nzila/os-core/rateLimit'
import { classifyRoute, type RouteGroup } from '@nzila/os-core/orgRateLimit'
import { checkRateLimit as checkShared } from '@/lib/rate-limiter'

export type LimitScope = 'session' | 'ip'

export interface GroupLimit {
  max: number
  windowMs: number
}

export const API_GROUP_LIMITS: Readonly<Record<RouteGroup, GroupLimit>> = {
  auth: { max: 30, windowMs: 60_000 },
  mutations: { max: 60, windowMs: 60_000 },
  exports: { max: 10, windowMs: 60_000 },
  integrations: { max: 100, windowMs: 60_000 },
  // Reads carry a generous ceiling: pages fan out many reads, and the control here is against floods, not browsing.
  general: { max: 600, windowMs: 60_000 },
}

/** The address bucket is a ceiling over every credential a caller could present from one place. */
export const IP_CEILING_MULTIPLIER = 5

/**
 * Disposable production-build QA has a high-volume synthetic session matrix
 * sharing the same loopback address. Keep the exact production limits for
 * every non-local request; do not disable the two-bucket limiter in QA.
 */
export const DISPOSABLE_QA_LIMIT_MULTIPLIER = 100;

export function isDisposableQaRateProfile(input: {
  environment?: string;
  qaTestEnv?: string;
  syntheticSession?: string;
  hostname: string;
  hostHeader: string | null;
  forwardedHost: string | null;
}): boolean {
  if (input.environment !== 'local' || input.qaTestEnv !== 'true' || input.syntheticSession !== 'true') return false;
  const host = input.hostname.toLowerCase();
  if (host !== '127.0.0.1' && host !== 'localhost') return false;
  const presented = (input.hostHeader ?? '').split(':')[0].toLowerCase();
  if (presented !== host) return false;
  const forwarded = input.forwardedHost?.split(',')[0].trim().split(':')[0].toLowerCase();
  return !forwarded || forwarded === host;
}


export interface ApiLimitInput {
  pathname: string
  method: string
  /** The credential presented (session cookie value or Authorization header); never logged or stored as-is. */
  credential: string | null
  ip: string
}

export interface ApiLimitDecision {
  allowed: boolean
  group: RouteGroup
  /** The scope that rejected the request, or the tightest scope when allowed. */
  scope: LimitScope
  limit: number
  remaining: number
  resetIn: number
  /** `degraded` when any bucket was enforced from process memory because the shared store was unavailable. */
  mode: 'shared' | 'degraded'
}

export interface GuardDeps {
  shared: typeof checkShared
  memory: typeof checkMemory
  /** Called when a decision is degraded, so the condition is recorded. */
  onDegraded?: (info: { group: RouteGroup; scope: LimitScope }) => void
  /** Only granted by the Edge proxy's strict local synthetic QA identity gate. */
  profile?: 'standard' | 'disposable-qa'
}

const defaultDeps: GuardDeps = { shared: checkShared, memory: checkMemory }

/** Non-cryptographic 53-bit hash. The credential is the secret; the bucket name must not expose or store it. */
export function bucketId(value: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

async function checkBucket(
  scope: LimitScope,
  key: string,
  group: RouteGroup,
  limit: GroupLimit,
  deps: GuardDeps,
): Promise<{ allowed: boolean; limit: number; remaining: number; resetIn: number; degraded: boolean }> {
  const windowSeconds = Math.max(1, Math.ceil(limit.windowMs / 1000))
  try {
    const result = await deps.shared(`${scope}:${key}`, { limit: limit.max, window: windowSeconds, identifier: `api-${group}`, failOpen: false })
    // The shared limiter answers `error` when it could not consult Redis. That is not a verdict on the caller.
    if (!result.error) return { allowed: result.allowed, limit: result.limit, remaining: result.remaining, resetIn: result.resetIn, degraded: false }
  } catch {
    // fall through to the same limit, enforced from memory
  }
  const local = deps.memory(`api:${group}:${scope}:${key}`, { max: limit.max, windowMs: limit.windowMs })
  deps.onDegraded?.({ group, scope })
  return { allowed: local.allowed, limit: limit.max, remaining: local.remaining, resetIn: Math.max(1, Math.ceil((local.resetAt - Date.now()) / 1000)), degraded: true }
}

export async function decideApiLimit(input: ApiLimitInput, deps: GuardDeps = defaultDeps): Promise<ApiLimitDecision> {
  const group = classifyRoute(input.pathname, input.method)
  const standard = API_GROUP_LIMITS[group];
  const base: GroupLimit = deps.profile === 'disposable-qa' && group !== 'auth'
    ? { ...standard, max: standard.max * DISPOSABLE_QA_LIMIT_MULTIPLIER }
    : standard;
  const credential = input.credential && input.credential.length <= 4096 ? input.credential : null

  const checks: Array<{ scope: LimitScope; key: string; limit: GroupLimit }> = []
  if (credential) checks.push({ scope: 'session', key: bucketId(credential), limit: base })
  checks.push({ scope: 'ip', key: bucketId(input.ip || 'unknown'), limit: { max: base.max * IP_CEILING_MULTIPLIER, windowMs: base.windowMs } })

  let tightest: ApiLimitDecision | null = null
  let degraded = false
  for (const check of checks) {
    const outcome = await checkBucket(check.scope, check.key, group, check.limit, deps)
    degraded = degraded || outcome.degraded
    const decision: ApiLimitDecision = {
      allowed: outcome.allowed,
      group,
      scope: check.scope,
      limit: outcome.limit,
      remaining: outcome.remaining,
      resetIn: outcome.resetIn,
      mode: degraded ? 'degraded' : 'shared',
    }
    if (!outcome.allowed) return decision
    if (!tightest || decision.remaining < tightest.remaining) tightest = decision
  }
  return { ...(tightest as ApiLimitDecision), mode: degraded ? 'degraded' : 'shared' }
}

/** Paths the guard leaves to their own control: probes, signed provider callbacks, the cron secret, and the auth limiter. */
export function isGuardExempt(pathname: string, method: string): boolean {
  if (method === 'OPTIONS') return true
  return (
    pathname === '/api/health' ||
    pathname.startsWith('/api/health/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/cron/') ||
    pathname === '/api/auth' ||
    pathname.startsWith('/api/auth/')
  )
}

/** The credential the caller presented, as an opaque string; null when there is none. */
export function presentedCredential(headers: { get(name: string): string | null }): string | null {
  const cookie = headers.get('cookie') ?? ''
  const session = cookie.match(/(?:^|;\s*)nzila_session=([^;]+)/)?.[1]
  if (session) return `cookie:${session}`
  const authorization = headers.get('authorization')
  return authorization ? `auth:${authorization}` : null
}

let lastDegradedLog = 0
/** Records degraded operation at most once a minute per process. */
export function logDegradedOnce(log: (message: string, context: Record<string, unknown>) => void, info: { group: RouteGroup; scope: LimitScope }): void {
  const now = Date.now()
  if (now - lastDegradedLog < 60_000) return
  lastDegradedLog = now
  log('API rate limiting is degraded: the shared store is unavailable, limits are enforced per process', { group: info.group, scope: info.scope })
}
