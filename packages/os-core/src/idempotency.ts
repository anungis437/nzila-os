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
  /**
   * Fencing token identifying the worker that currently holds the reservation.
   * Present only while `status === IDEMPOTENCY_RESERVED_STATUS`; cleared on
   * completion. `finalize`/`release` are conditional on this token so a worker
   * whose lease was reclaimed cannot clobber the new owner's state.
   */
  reservationOwner?: string | null
  /**
   * Unix ms lease deadline for an in-flight reservation. After this instant the
   * reservation is *stale* and may be atomically reclaimed by another worker
   * (crash recovery). Present only while reserved.
   */
  leaseExpiresAt?: number | null
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

// ── Atomic Acquisition (concurrency-safe first-writer election + crash recovery)
//
// The `check → mutate → set` flow (checkIdempotency + cache.set) is safe under
// SEQUENTIAL replays but NOT under CONCURRENT ones: two requests that arrive at
// nearly the same time both observe a cache miss and both run the mutation.
// `AtomicIdempotencyCache.acquire()` closes that window by atomically reserving
// the key so exactly one caller performs the mutation.
//
// A reservation is a LEASE, not just an in-progress sentinel: it carries an
// unguessable owner token and a finite lease deadline. If the holder crashes
// (or is terminated) after acquiring but before `finalize`/`release`, the lease
// expires and another worker atomically RECLAIMS it — the key is never orphaned
// in `in_progress` forever. Fencing on the owner token prevents a crashed/slow
// worker from finalizing after its lease was reclaimed.

/**
 * Sentinel status used for an in-flight reservation row. Real responses always
 * carry an HTTP status (>= 100), so status 0 unambiguously marks "reserved but
 * not yet completed".
 */
export const IDEMPOTENCY_RESERVED_STATUS = 0

/**
 * Lease duration for an in-flight reservation (ms). SAGE mutations are short
 * (a few DB writes + one audit append), so 30s is comfortably longer than a
 * healthy execution yet finite, so a crashed holder is reclaimed promptly.
 * A holder that legitimately exceeds this is assumed dead — the conservative
 * sizing bounds (does not eliminate) the rare double-execution window.
 */
export const IDEMPOTENCY_LEASE_MS = 30_000

/** Outcome of an atomic acquisition attempt for an idempotency key. */
export type IdempotencyAcquisition =
  /**
   * This caller won the race (fresh reservation or reclaimed a stale lease) —
   * it must run the mutation, then `finalize` with the returned `owner` token.
   */
  | { outcome: 'acquired'; owner: string }
  /** A row exists with the same key but a DIFFERENT payload — a conflict. */
  | { outcome: 'mismatch' }
  /** Another caller holds an ACTIVE lease; the result is not ready yet. */
  | { outcome: 'in_progress' }
  /** A completed response already exists — replay it. */
  | { outcome: 'replay'; entry: CachedIdempotencyEntry }

/** Result of a fenced `finalize`. */
export type IdempotencyFinalizeResult =
  | { ok: true }
  /** The reservation was reclaimed by another worker — our write was rejected. */
  | { ok: false; reason: 'ownership_lost' }

/**
 * An idempotency cache that supports ATOMIC first-writer acquisition with a
 * leased reservation (crash recovery) and fencing-token-guarded completion.
 *
 * `acquire` is atomic: given the same key, exactly one concurrent caller
 * receives `{ outcome: 'acquired', owner }`. The winner runs the mutation and
 * calls `finalize(key, owner, entry)`; on failure it calls `release(key, owner)`.
 * Both are conditional on `owner`, so a worker whose lease expired and was
 * reclaimed cannot overwrite/delete the new owner's reservation.
 */
export interface AtomicIdempotencyCache extends IdempotencyCache {
  acquire(key: string, payloadHash: string, ttlMs?: number): Promise<IdempotencyAcquisition>
  finalize(
    key: string,
    owner: string,
    entry: CachedIdempotencyEntry,
    ttlMs?: number,
  ): Promise<IdempotencyFinalizeResult>
  release(key: string, owner: string): Promise<void>
}

/** Raised when the same idempotency key is reused with a different payload. */
export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_PAYLOAD_MISMATCH'
  constructor(message = 'Idempotency-Key was used with a different payload') {
    super(message)
    this.name = 'IdempotencyConflictError'
  }
}

/** Raised when a concurrent holder of the key does not complete within the wait budget. */
export class IdempotencyInProgressError extends Error {
  readonly code = 'IDEMPOTENCY_IN_PROGRESS'
  constructor(
    message = 'A concurrent request with this Idempotency-Key is still in progress',
  ) {
    super(message)
    this.name = 'IdempotencyInProgressError'
  }
}

function isReserved(entry: CachedIdempotencyEntry): boolean {
  return entry.status === IDEMPOTENCY_RESERVED_STATUS
}

/** Mint an unguessable, per-acquisition fencing token. */
function mintReservationOwner(): string {
  return `res_${createHash('sha256')
    .update(`${Date.now()}:${Math.random()}:${process.hrtime.bigint()}`)
    .digest('hex')
    .slice(0, 32)}`
}

// ── In-Memory Cache Implementation ────────────────────────────────────────

export class InMemoryIdempotencyCache implements AtomicIdempotencyCache {
  private readonly store = new Map<string, CachedIdempotencyEntry>()
  private readonly maxSize: number
  private readonly leaseMs: number
  /** Injectable clock (ms) — lets tests advance time to expire a lease. */
  private readonly now: () => number

  constructor(
    maxSize = 50_000,
    options: { leaseMs?: number; now?: () => number } = {},
  ) {
    this.maxSize = maxSize
    this.leaseMs = options.leaseMs ?? IDEMPOTENCY_LEASE_MS
    this.now = options.now ?? (() => Date.now())
  }

  async get(key: string): Promise<CachedIdempotencyEntry | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    // Expire stale COMPLETED entries by TTL. Reserved entries are governed by the
    // lease (handled in `acquire`), so they are returned as-is here — the caller
    // (poll loop) distinguishes them via `status`.
    if (!isReserved(entry) && this.now() - entry.createdAt > DEFAULT_TTL_MS) {
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

  /**
   * Atomically reserve a key (fresh or by reclaiming a stale lease). The
   * read-and-write below runs synchronously (no `await` between the `get` and
   * the `set`), so within a single Node event loop it is a critical section: of
   * two concurrent callers, exactly one wins the reservation.
   *
   * Crash recovery: a reserved entry whose lease deadline has passed is *stale*
   * and is reclaimed — but only for the SAME payload hash (a different payload
   * on the same key is always a conflict).
   */
  async acquire(key: string, payloadHash: string): Promise<IdempotencyAcquisition> {
    const now = this.now()
    const existing = this.store.get(key)

    if (existing) {
      if (isReserved(existing)) {
        // Active lease → someone else is running the mutation right now.
        if ((existing.leaseExpiresAt ?? 0) >= now) return { outcome: 'in_progress' }
        // Stale lease (holder crashed): reclaim, but never across payloads.
        if (existing.payloadHash !== payloadHash) return { outcome: 'mismatch' }
        const owner = mintReservationOwner()
        this.store.set(key, {
          ...existing,
          reservationOwner: owner,
          leaseExpiresAt: now + this.leaseMs,
          createdAt: now,
        })
        return { outcome: 'acquired', owner }
      }
      // Completed entry (within TTL) → replay or conflict.
      if (now - existing.createdAt <= DEFAULT_TTL_MS) {
        if (existing.payloadHash !== payloadHash) return { outcome: 'mismatch' }
        return { outcome: 'replay', entry: existing }
      }
      // Expired completed entry → fall through to a fresh reservation.
    }

    const owner = mintReservationOwner()
    this.store.set(key, {
      payloadHash,
      status: IDEMPOTENCY_RESERVED_STATUS,
      body: '',
      headers: {},
      createdAt: now,
      reservationOwner: owner,
      leaseExpiresAt: now + this.leaseMs,
    })
    return { outcome: 'acquired', owner }
  }

  /**
   * Overwrite the reservation with the completed response — but only if we still
   * own the reservation (fencing). If our lease was reclaimed, the write is
   * rejected so we cannot clobber the new owner's state.
   */
  async finalize(
    key: string,
    owner: string,
    entry: CachedIdempotencyEntry,
  ): Promise<IdempotencyFinalizeResult> {
    const existing = this.store.get(key)
    if (!existing || !isReserved(existing) || existing.reservationOwner !== owner) {
      return { ok: false, reason: 'ownership_lost' }
    }
    this.store.set(key, { ...entry, reservationOwner: null, leaseExpiresAt: null })
    return { ok: true }
  }

  /** Drop a still-reserved key we own so a failed mutation is not cached. */
  async release(key: string, owner: string): Promise<void> {
    const entry = this.store.get(key)
    if (entry && isReserved(entry) && entry.reservationOwner === owner) {
      this.store.delete(key)
    }
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
export class PostgresIdempotencyCache implements AtomicIdempotencyCache {
  private readonly ttlMs: number
  private readonly leaseMs: number

  constructor(ttlMs = DEFAULT_TTL_MS, options: { leaseMs?: number } = {}) {
    this.ttlMs = ttlMs
    this.leaseMs = options.leaseMs ?? IDEMPOTENCY_LEASE_MS
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
      reservationOwner: row.reservationOwner ?? null,
      leaseExpiresAt: row.status === IDEMPOTENCY_RESERVED_STATUS
        ? new Date(row.expiresAt).getTime()
        : null,
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

  /**
   * Atomic first-writer acquisition with crash-recovery reclaim.
   *
   * While a reservation is in flight the row's `expires_at` column doubles as
   * the LEASE deadline (a short lease); on completion it is reset to the cache
   * TTL. Steps:
   *   1. `INSERT ... ON CONFLICT (cache_key) DO NOTHING RETURNING` — atomic; the
   *      single inserter is the winner (fresh reservation).
   *   2. Read the existing row. Completed + same payload → replay; completed +
   *      different payload → conflict.
   *   3. Reserved + active lease (`expires_at >= now`) → in_progress.
   *   4. Reserved + STALE lease (`expires_at < now`) + same payload → atomic
   *      compare-and-set reclaim (one UPDATE guarded by status, payload, and the
   *      expiry predicate — never select-then-unconditional-update).
   */
  async acquire(
    key: string,
    payloadHash: string,
    ttlMs?: number,
  ): Promise<IdempotencyAcquisition> {
    const { db, idempotencyCache } = await this.getDb()
    const { and, eq, lt } = await import('drizzle-orm')
    const owner = mintReservationOwner()
    const leaseExpiresAt = new Date(Date.now() + this.leaseMs)

    const inserted = await db
      .insert(idempotencyCache)
      .values({
        cacheKey: key,
        payloadHash,
        status: IDEMPOTENCY_RESERVED_STATUS,
        body: '',
        headers: {},
        reservationOwner: owner,
        createdAt: new Date(),
        expiresAt: leaseExpiresAt,
      })
      .onConflictDoNothing({ target: idempotencyCache.cacheKey })
      .returning({ cacheKey: idempotencyCache.cacheKey })

    if (inserted.length > 0) return { outcome: 'acquired', owner }

    // A row already exists. Read it WITHOUT the expiry filter so we can inspect a
    // stale reservation (which `get` would hide).
    const rows = await db
      .select()
      .from(idempotencyCache)
      .where(eq(idempotencyCache.cacheKey, key))
      .limit(1)
    const row = rows[0]
    if (!row) return { outcome: 'in_progress' } // raced with a cleanup delete → retry

    if (row.status !== IDEMPOTENCY_RESERVED_STATUS) {
      if (row.payloadHash !== payloadHash) return { outcome: 'mismatch' }
      return {
        outcome: 'replay',
        entry: {
          payloadHash: row.payloadHash,
          status: row.status,
          body: row.body,
          headers: (row.headers ?? {}) as Record<string, string>,
          createdAt: new Date(row.createdAt).getTime(),
        },
      }
    }

    // Reserved: active lease → in_progress.
    if (new Date(row.expiresAt).getTime() >= Date.now()) return { outcome: 'in_progress' }
    // Stale lease + different payload → conflict (never reclaim across payloads).
    if (row.payloadHash !== payloadHash) return { outcome: 'mismatch' }

    // Stale lease + same payload → ATOMIC reclaim. The predicate (status +
    // payload + expires_at < now) makes this a compare-and-set: only one racing
    // reclaimer matches the row; the loser gets zero rows.
    const reclaimed = await db
      .update(idempotencyCache)
      .set({
        reservationOwner: owner,
        expiresAt: new Date(Date.now() + this.leaseMs),
        createdAt: new Date(),
      })
      .where(
        and(
          eq(idempotencyCache.cacheKey, key),
          eq(idempotencyCache.status, IDEMPOTENCY_RESERVED_STATUS),
          eq(idempotencyCache.payloadHash, payloadHash),
          lt(idempotencyCache.expiresAt, new Date()),
        ),
      )
      .returning({ cacheKey: idempotencyCache.cacheKey })

    if (reclaimed.length > 0) return { outcome: 'acquired', owner }
    // Another worker reclaimed first.
    return { outcome: 'in_progress' }
  }

  /**
   * Overwrite the reservation row with the completed response — FENCED on the
   * owner token. If our lease was reclaimed (a different owner now holds the
   * row), the UPDATE matches zero rows and we report `ownership_lost` instead of
   * clobbering the new owner's state.
   */
  async finalize(
    key: string,
    owner: string,
    entry: CachedIdempotencyEntry,
    ttlMs?: number,
  ): Promise<IdempotencyFinalizeResult> {
    const { db, idempotencyCache } = await this.getDb()
    const { and, eq } = await import('drizzle-orm')
    const expiresAt = new Date(Date.now() + (ttlMs ?? this.ttlMs))

    const updated = await db
      .update(idempotencyCache)
      .set({
        payloadHash: entry.payloadHash,
        status: entry.status,
        body: entry.body,
        headers: entry.headers,
        reservationOwner: null,
        createdAt: new Date(entry.createdAt),
        expiresAt,
      })
      .where(
        and(
          eq(idempotencyCache.cacheKey, key),
          eq(idempotencyCache.status, IDEMPOTENCY_RESERVED_STATUS),
          eq(idempotencyCache.reservationOwner, owner),
        ),
      )
      .returning({ cacheKey: idempotencyCache.cacheKey })

    return updated.length > 0 ? { ok: true } : { ok: false, reason: 'ownership_lost' }
  }

  /**
   * Delete a still-reserved row we own so a failed mutation does not block
   * retries — FENCED on the owner token so we cannot delete a reclaimed row.
   */
  async release(key: string, owner: string): Promise<void> {
    const { db, idempotencyCache } = await this.getDb()
    const { and, eq } = await import('drizzle-orm')

    await db
      .delete(idempotencyCache)
      .where(
        and(
          eq(idempotencyCache.cacheKey, key),
          eq(idempotencyCache.status, IDEMPOTENCY_RESERVED_STATUS),
          eq(idempotencyCache.reservationOwner, owner),
        ),
      )
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

// ── Atomic Mutation Runner ────────────────────────────────────────────────

function idempotencyDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RunIdempotentMutationOptions<T> {
  /** A cache that supports atomic acquisition. */
  cache: AtomicIdempotencyCache
  /** Fully-composed cache key (already includes org/route/actor/idempotencyKey scope). */
  cacheKey: string
  /** SHA-256 of the canonical request payload. */
  payloadHash: string
  /** HTTP status to record for a successful mutation (must be >= 100). */
  status: number
  /** The mutation to run exactly once for the winning caller. */
  run: () => Promise<T>
  /** Optional TTL override for the cached entry. */
  ttlMs?: number
  /** Serialize the result for durable storage (default JSON.stringify). */
  serialize?: (value: T) => string
  /** Deserialize a replayed result (default JSON.parse). */
  deserialize?: (body: string) => T
  /** Max time to wait for a concurrent holder to finish (default 5000ms). */
  waitMs?: number
  /** Poll interval while waiting for a concurrent holder (default 25ms). */
  pollMs?: number
}

export interface IdempotentMutationResult<T> {
  /** The mutation result (freshly computed or replayed). */
  response: T
  /** True when the result was replayed from a prior completed request. */
  replayed: boolean
}

/**
 * Run a mutation under ATOMIC idempotency with crash recovery.
 *
 * Guarantees under concurrency (same key + same payload):
 *   - exactly one caller runs `run()` (atomic acquisition / stale-lease reclaim),
 *   - concurrent callers wait for and receive the completed result (replayed),
 *   - a same-key/different-payload caller gets `IdempotencyConflictError`,
 *   - a failed `run()` releases the reservation (no permanently-cached failure),
 *   - a crashed holder's stale lease is reclaimed by a later retry (no orphaned
 *     `in_progress`); a fenced `finalize` from the crashed holder is rejected,
 *   - a successful `run()` is durably recorded for future replays.
 */
export async function runIdempotentMutation<T>(
  opts: RunIdempotentMutationOptions<T>,
): Promise<IdempotentMutationResult<T>> {
  const { cache, cacheKey, payloadHash, status, run, ttlMs } = opts
  const serialize = opts.serialize ?? ((value: T) => JSON.stringify(value))
  const deserialize = opts.deserialize ?? ((body: string) => JSON.parse(body) as T)
  const waitMs = opts.waitMs ?? 5_000
  const pollMs = opts.pollMs ?? 25
  const deadline = Date.now() + waitMs

  for (;;) {
    // Overall deadline bounds every path (including reclaim/ownership-loss loops).
    if (Date.now() >= deadline) throw new IdempotencyInProgressError()

    const acquisition = await cache.acquire(cacheKey, payloadHash, ttlMs)

    if (acquisition.outcome === 'acquired') {
      const owner = acquisition.owner
      let value: T
      try {
        value = await run()
      } catch (error) {
        // Release OUR reservation so the failure is not cached and a retry can run.
        await cache.release(cacheKey, owner)
        throw error
      }
      const finalized = await cache.finalize(
        cacheKey,
        owner,
        {
          payloadHash,
          status,
          body: serialize(value),
          headers: {},
          createdAt: Date.now(),
        },
        ttlMs,
      )
      if (finalized.ok) return { response: value, replayed: false }
      // ownership_lost: our lease expired and another worker reclaimed the key.
      // Our result is NOT authoritative — discard it and fall back to reading the
      // owner's result (replay) or waiting. (Side effects may have run twice;
      // that window is bounded by the lease being >> a healthy mutation.)
      await idempotencyDelay(pollMs)
      continue
    }

    if (acquisition.outcome === 'mismatch') {
      throw new IdempotencyConflictError()
    }

    if (acquisition.outcome === 'replay') {
      return { response: deserialize(acquisition.entry.body), replayed: true }
    }

    // in_progress — a concurrent holder is running the mutation. Wait for it to
    // finalize (replay) or for its lease to lapse (loop → reclaim).
    await idempotencyDelay(pollMs)
    const entry = await cache.get(cacheKey)
    if (entry && entry.status !== IDEMPOTENCY_RESERVED_STATUS) {
      if (entry.payloadHash !== payloadHash) throw new IdempotencyConflictError()
      return { response: deserialize(entry.body), replayed: true }
    }
    // entry is null (released/stale) or still reserved → loop and re-acquire/wait.
  }
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
