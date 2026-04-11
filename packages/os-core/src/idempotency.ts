/**
 * @nzila/os-core — Universal Idempotency Enforcement
 *
 * Middleware-compatible helpers that enforce `Idempotency-Key` header on
 * all external mutation routes (POST, PUT, PATCH, DELETE) under `/api`.
 *
 * Behaviour:
 *   - Missing `Idempotency-Key` → 400 in pilot/prod (warn in dev)
 *   - Replay with identical payload → returns cached response
 *   - Replay with different payload → 409 Conflict
 *
 * The cache key is `(orgId + route + idempotencyKey)` to ensure
 * org-scoped isolation.
 *
 * Three implementations are provided:
 *   - `InMemoryIdempotencyCache`   — single-process / tests
 *   - `PostgresIdempotencyCache`   — multi-instance production (uses @nzila/db)
 *   - Port interface `IdempotencyCache` — swap in any implementation
 *
 * @module @nzila/os-core/idempotency
 */
import { createHash } from 'node:crypto'

// ── Constants ─────────────────────────────────────────────────────────────

export const IDEMPOTENCY_HEADER = 'idempotency-key'

/** HTTP methods that are considered mutations */
export const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Default TTL for cached idempotency entries (48 hours) */
const DEFAULT_TTL_MS = 48 * 60 * 60 * 1_000

// ── Types ─────────────────────────────────────────────────────────────────

export interface CachedIdempotencyEntry {
  /** SHA-256 hash of the request body */
  payloadHash: string
  /** Cached response status code */
  status: number
  /** Cached response body (serialised JSON) */
  body: string
  /** Cached response headers */
  headers: Record<string, string>
  /** Unix ms when the entry was created */
  createdAt: number
}

/** Port interface — implement against Redis / Postgres for multi-instance deployments */
export interface IdempotencyCache {
  get(key: string): Promise<CachedIdempotencyEntry | null>
  set(key: string, entry: CachedIdempotencyEntry, ttlMs?: number): Promise<void>
}

export interface IdempotencyResult {
  /** Whether this request should proceed (no cached hit) */
  proceed: boolean
  /** If not proceeding — the cached response to return */
  cachedResponse?: { status: number; body: string; headers: Record<string, string> }
  /** If the request is rejected — the error response */
  error?: { status: number; body: Record<string, unknown> }
  /** The composite cache key (for storing the result after handler execution) */
  cacheKey?: string
  /** The payload hash (for storing after handler execution) */
  payloadHash?: string
}

// ── In-Memory Cache Implementation ────────────────────────────────────────

export class InMemoryIdempotencyCache implements IdempotencyCache {
  private readonly store = new Map<string, CachedIdempotencyEntry>()
  private readonly maxSize: number

  constructor(maxSize = 50_000) {
    this.maxSize = maxSize
  }

  async get(key: string): Promise<CachedIdempotencyEntry | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    // Expire stale entries
    if (Date.now() - entry.createdAt > DEFAULT_TTL_MS) {
      this.store.delete(key)
      return null
    }
    return entry
  }

  async set(key: string, entry: CachedIdempotencyEntry): Promise<void> {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
    this.store.set(key, entry)
  }

  get size(): number {
    return this.store.size
  }
}

// ── Postgres Cache Implementation ─────────────────────────────────────────

/**
 * Postgres-backed idempotency cache for multi-instance production deployments.
 *
 * Uses `@nzila/db` schema + drizzle ORM. Entries auto-expire via `expires_at`
 * column — a scheduled cleanup query (`DELETE WHERE expires_at < now()`)
 * should run periodically (e.g. daily cron).
 *
 * Concurrency-safe: uses `ON CONFLICT (cache_key) DO NOTHING` to prevent
 * race conditions on duplicate inserts.
 */
export class PostgresIdempotencyCache implements IdempotencyCache {
  private readonly ttlMs: number

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  private async getDb() {
    // Dynamic import to avoid pulling in @nzila/db at module-load time
    // (edge runtimes / middleware may not have DB access)
    const { db } = await import('@nzila/db/client')
    const { idempotencyCache } = await import('@nzila/db/schema')
    return { db, idempotencyCache }
  }

  async get(key: string): Promise<CachedIdempotencyEntry | null> {
    const { db, idempotencyCache } = await this.getDb()
    const { eq, gt, and } = await import('drizzle-orm')

    const rows = await db
      .select()
      .from(idempotencyCache)
      .where(
        and(
          eq(idempotencyCache.cacheKey, key),
          gt(idempotencyCache.expiresAt, new Date()),
        ),
      )
      .limit(1)

    if (rows.length === 0) return null

    const row = rows[0]!
    return {
      payloadHash: row.payloadHash,
      status: row.status,
      body: row.body,
      headers: (row.headers ?? {}) as Record<string, string>,
      createdAt: new Date(row.createdAt).getTime(),
    }
  }

  async set(key: string, entry: CachedIdempotencyEntry, ttlMs?: number): Promise<void> {
    const { db, idempotencyCache } = await this.getDb()

    const expiresAt = new Date(Date.now() + (ttlMs ?? this.ttlMs))

    await db
      .insert(idempotencyCache)
      .values({
        cacheKey: key,
        payloadHash: entry.payloadHash,
        status: entry.status,
        body: entry.body,
        headers: entry.headers,
        createdAt: new Date(entry.createdAt),
        expiresAt,
      })
      .onConflictDoNothing({ target: idempotencyCache.cacheKey })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Hash a request body for payload-mismatch detection */
export function hashPayload(body: string): string {
  return createHash('sha256').update(body).digest('hex')
}

/** Build the composite cache key: orgId + route + idempotencyKey */
export function buildCacheKey(orgId: string, route: string, idempotencyKey: string): string {
  return `idempotency:${orgId}:${route}:${idempotencyKey}`
}

// ── Core Enforcement Logic ────────────────────────────────────────────────

export interface IdempotencyCheckOptions {
  /** HTTP method (GET, POST, etc.) */
  method: string
  /** Request pathname (e.g. /api/orgs/123/invoices) */
  pathname: string
  /** The value of the Idempotency-Key header (may be undefined) */
  idempotencyKey: string | undefined | null
  /** Org ID from the auth context (required for scoping) */
  orgId: string
  /** Raw request body (stringified JSON) */
  body: string
  /** The idempotency cache instance */
  cache: IdempotencyCache
  /** Whether enforcement is strict (fail-closed). True in pilot/prod. */
  strict: boolean
}

/**
 * Check idempotency for a mutation request.
 *
 * Call this before executing the handler. If `result.proceed === false`,
 * return the cached/error response instead of executing the handler.
 *
 * After handler execution, call `cache.set()` with the generated `cacheKey`
 * and `payloadHash` to store the response for future replays.
 */
export async function checkIdempotency(opts: IdempotencyCheckOptions): Promise<IdempotencyResult> {
  const { method, pathname, idempotencyKey, orgId, body, cache, strict } = opts

  // Only enforce on mutation methods under /api
  if (!MUTATION_METHODS.has(method.toUpperCase())) {
    return { proceed: true }
  }
  if (!pathname.startsWith('/api')) {
    return { proceed: true }
  }

  // Missing Idempotency-Key
  if (!idempotencyKey) {
    if (strict) {
      return {
        proceed: false,
        error: {
          status: 400,
          body: {
            error: 'Missing Idempotency-Key header',
            message:
              'All mutation requests (POST, PUT, PATCH, DELETE) under /api must include an Idempotency-Key header.',
            code: 'IDEMPOTENCY_KEY_REQUIRED',
          },
        },
      }
    }
    // In dev/staging — warn but allow
    return { proceed: true }
  }

  const cacheKey = buildCacheKey(orgId, pathname, idempotencyKey)
  const payloadHash = hashPayload(body)

  // Check for existing entry
  const existing = await cache.get(cacheKey)
  if (existing) {
    // Payload mismatch — different body for the same idempotency key
    if (existing.payloadHash !== payloadHash) {
      return {
        proceed: false,
        error: {
          status: 409,
          body: {
            error: 'Idempotency-Key payload mismatch',
            message:
              'A request with this Idempotency-Key was already processed with a different payload.',
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          },
        },
      }
    }

    // Replay — return cached response
    return {
      proceed: false,
      cachedResponse: {
        status: existing.status,
        body: existing.body,
        headers: {
          ...existing.headers,
          'x-idempotency-replayed': 'true',
        },
      },
    }
  }

  // No cached entry — proceed with execution
  return {
    proceed: true,
    cacheKey,
    payloadHash,
  }
}

/** Environments where idempotency is strictly enforced (fail-closed). */
const STRICT_NZILA_ENVS = new Set(['pilot', 'prod'])

/**
 * Determine if the current environment is strict (pilot/prod).
 *
 * Priority: `NZILA_ENV` (the platform's own env discriminator) takes
 * precedence.  Falls back to `NODE_ENV === 'production'` so existing
 * deploy pipelines that only set NODE_ENV still behave fail-closed.
 */
export function isStrictEnvironment(): boolean {
  const nzilaEnv = process.env.NZILA_ENV?.toLowerCase()
  if (nzilaEnv) return STRICT_NZILA_ENVS.has(nzilaEnv)
  return process.env.NODE_ENV === 'production'
}

// ── Singleton Cache ───────────────────────────────────────────────────────

let _globalCache: IdempotencyCache | null = null

/**
 * Return (or create) the module-level singleton idempotency cache.
 *
 * - In strict environments (pilot / prod) with DATABASE_URL set → Postgres
 * - Otherwise → InMemory (dev / test)
 */
export function getGlobalIdempotencyCache(): IdempotencyCache {
  if (!_globalCache) {
    if (isStrictEnvironment() && process.env.DATABASE_URL) {
      _globalCache = new PostgresIdempotencyCache()
    } else {
      _globalCache = new InMemoryIdempotencyCache()
    }
  }
  return _globalCache
}

// ── High-Level Helpers ────────────────────────────────────────────────────

/**
 * Convenience wrapper around `checkIdempotency`.
 * Extracts the key from request headers and runs the full check.
 */
export async function requireIdempotencyKey(
  ctx: { orgId: string },
  req: {
    method: string
    pathname: string
    headers: Record<string, string | null | undefined>
    body: string
  },
  cache?: IdempotencyCache,
): Promise<IdempotencyResult> {
  return checkIdempotency({
    method: req.method,
    pathname: req.pathname,
    idempotencyKey:
      req.headers[IDEMPOTENCY_HEADER] ??
      req.headers['Idempotency-Key'] ??
      undefined,
    orgId: ctx.orgId,
    body: req.body,
    cache: cache ?? getGlobalIdempotencyCache(),
    strict: isStrictEnvironment(),
  })
}

/**
 * Store a handler response in the idempotency cache for future replays.
 * Call after successful handler execution.
 */
export async function recordIdempotentResponse(
  cacheKey: string,
  payloadHash: string,
  status: number,
  body: string,
  headers: Record<string, string> = {},
  cache?: IdempotencyCache,
): Promise<void> {
  const store = cache ?? getGlobalIdempotencyCache()
  await store.set(cacheKey, {
    payloadHash,
    status,
    body,
    headers,
    createdAt: Date.now(),
  })
}

/**
 * Attempt to resolve a cached idempotent replay.
 * Alias for `requireIdempotencyKey` — provided for semantic clarity.
 */
export async function resolveIdempotentReplay(
  ctx: { orgId: string },
  req: {
    method: string
    pathname: string
    headers: Record<string, string | null | undefined>
    body: string
  },
  cache?: IdempotencyCache,
): Promise<IdempotencyResult> {
  return requireIdempotencyKey(ctx, req, cache)
}

// ── Edge-Compatible Helpers (for Next.js middleware) ──────────────────────

/** Pathname patterns exempt from idempotency enforcement. */
export const IDEMPOTENCY_EXEMPT_PATTERNS = [
  /^\/api\/webhooks\b/,
  /^\/api\/health\b/,
  /^\/api\/cron\b/,
]

/** True when `method` is a mutation verb AND `pathname` starts with /api. */
export function isMutationApiRoute(method: string, pathname: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase()) && pathname.startsWith('/api')
}

/** True when `pathname` matches a known exempt pattern (webhooks, health, cron). */
export function isIdempotencyExempt(pathname: string): boolean {
  return IDEMPOTENCY_EXEMPT_PATTERNS.some((p) => p.test(pathname))
}

// ── Cleanup ───────────────────────────────────────────────────────────────

/**
 * Delete expired rows from the Postgres idempotency cache.
 *
 * Should be called from a scheduled cron job (e.g. daily).
 * Returns the number of rows deleted.
 */
export async function cleanupExpiredIdempotencyEntries(): Promise<number> {
  const { db } = await import('@nzila/db/client')
  const { idempotencyCache } = await import('@nzila/db/schema')
  const { lt, sql } = await import('drizzle-orm')

  const result = await db
    .delete(idempotencyCache)
    .where(lt(idempotencyCache.expiresAt, new Date()))
    .returning({ id: idempotencyCache.id })

  return result.length
}
