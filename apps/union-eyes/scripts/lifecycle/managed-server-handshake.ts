/**
 * Phase 0C.2 §5 — Managed-server handshake.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose
 * ─────────────────────────────────────────────────────────────────────────────
 * Playwright can either boot its own Next.js dev server (standalone mode) or
 * attach to a server that the governed lifecycle orchestrator (`run.ts`) has
 * already booted (managed mode).
 *
 * If Playwright is misconfigured — e.g. it silently spawns a second dev server
 * on the wrong port, or attaches to a stale/orphaned dev server left running
 * from a previous run or an unrelated terminal — the entire test result is
 * meaningless: the tests will run against the wrong DB, the wrong seed, and
 * possibly the wrong branch. This has burned us before.
 *
 * This module enforces a positive, fail-closed handshake:
 *
 *   1. The orchestrator sets `NZILA_E2E_MANAGED_SERVER=true` and
 *      `NZILA_E2E_RUN_ID=<runId>` in BOTH the server env and the Playwright
 *      env.
 *
 *   2. The server exposes `/api/health/managed-server` which echoes the
 *      `NZILA_E2E_RUN_ID` value it was booted with (only when the managed
 *      flag is on — otherwise 404, i.e. the endpoint does not exist in
 *      production).
 *
 *   3. Before Playwright starts, the orchestrator calls
 *      `verifyManagedServer({ baseUrl, expectedRunId })`. If the response
 *      body does not contain the exact matching run-ID (and the exact app
 *      name), the run is aborted BEFORE any test executes.
 *
 *   4. `playwright.config.ts` refuses to spawn its own `webServer` when
 *      `NZILA_E2E_MANAGED_SERVER=true`, forcing attachment to the managed
 *      instance.
 *
 * All helpers in this file are pure (no `process.env` reads, no I/O outside
 * the injected `fetch`) so §5 tests can exercise every failure mode without
 * booting a real server.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Environment variable contract ──────────────────────────────────────────

/** Env var that flips managed-server mode on. Must be the literal string `"true"`. */
export const MANAGED_SERVER_ENV_VAR = 'NZILA_E2E_MANAGED_SERVER'

/** Env var carrying the lifecycle-run-ID that both server and orchestrator must agree on. */
export const MANAGED_SERVER_RUN_ID_ENV_VAR = 'NZILA_E2E_RUN_ID'

/** Well-known HTTP path on the Union-Eyes Next.js server. */
export const MANAGED_SERVER_ENDPOINT_PATH = '/api/health/managed-server'

/** Loopback host allow-list — mirrors auth-service.ts §4 hardening. */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
])

/** Only the current app is a legitimate target for our managed handshake. */
export const EXPECTED_APP_NAME = 'union-eyes'

// ─── Pure predicates ─────────────────────────────────────────────────────────

export interface ManagedServerModeEnv {
  [MANAGED_SERVER_ENV_VAR]?: string | undefined
}

/**
 * Returns true iff the managed-server env var is EXACTLY the string `"true"`.
 * Any other value (including truthy-looking strings like `"1"`, `"TRUE"`,
 * `"yes"`) is treated as "not managed" — fail-closed.
 */
export function isManagedServerMode(env: ManagedServerModeEnv): boolean {
  return env[MANAGED_SERVER_ENV_VAR] === 'true'
}

function tryHostname(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname
  } catch {
    return null
  }
}

/** Returns true iff `url` parses cleanly AND its hostname is on the loopback allow-list. */
export function isLoopbackUrl(url: string): boolean {
  const host = tryHostname(url)
  if (host === null) return false
  return LOOPBACK_HOSTS.has(host)
}

// ─── Handshake payload contract ──────────────────────────────────────────────

/** Body shape that `/api/health/managed-server` MUST return with 200. */
export interface ManagedServerHandshakePayload {
  app: string
  managedServer: true
  runId: string
  pid: number
  uptimeSec: number
}

/**
 * Loose runtime type-guard — accepts unknown JSON and checks the fields we
 * actually rely on. We do NOT accept partial payloads: every required field
 * must be present and have the correct primitive type.
 */
export function isManagedServerHandshakePayload(
  value: unknown,
): value is ManagedServerHandshakePayload {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.app === 'string' &&
    v.managedServer === true &&
    typeof v.runId === 'string' &&
    v.runId.length > 0 &&
    typeof v.pid === 'number' &&
    typeof v.uptimeSec === 'number'
  )
}

// ─── verifyManagedServer ─────────────────────────────────────────────────────

export interface VerifyManagedServerOptions {
  /** Absolute base URL of the running server (must be loopback). */
  baseUrl: string
  /** The run-ID the orchestrator expects to see echoed back. Must be non-empty. */
  expectedRunId: string
  /** Injected fetch (default: global `fetch`). Kept injectable so tests never touch the network. */
  fetch?: typeof globalThis.fetch
  /** Per-request timeout in ms (default: 5_000). */
  timeoutMs?: number
}

export interface VerifyManagedServerResult {
  ok: boolean
  /** Populated on success and on run-ID mismatch. */
  actualRunId?: string
  /** Populated on success and on app-name mismatch. */
  actualApp?: string
  /** HTTP status returned by the endpoint (undefined if fetch itself failed). */
  status?: number
  /** Machine-parseable failure reason. */
  reason?:
    | 'non-loopback-base-url'
    | 'empty-expected-run-id'
    | 'fetch-failed'
    | 'timeout'
    | 'non-200-status'
    | 'non-json-body'
    | 'bad-payload-shape'
    | 'app-mismatch'
    | 'run-id-mismatch'
  /** Human-readable explanation intended for orchestrator logs / evidence JSON. */
  error?: string
}

/**
 * Fail-closed handshake: unless every check passes, returns `{ ok: false }`
 * with a machine-parseable reason.
 *
 * IMPORTANT: this helper NEVER retries. The caller is responsible for its
 * own retry loop if it wants one. That keeps the failure semantics obvious
 * and prevents accidental "eventually consistent" bypasses.
 */
export async function verifyManagedServer(
  options: VerifyManagedServerOptions,
): Promise<VerifyManagedServerResult> {
  const { baseUrl, expectedRunId } = options
  const fetchImpl = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 5_000

  // Gate 1 — baseUrl must be loopback. Prevents pointing the handshake
  // (and therefore the whole run) at a production hostname.
  if (!isLoopbackUrl(baseUrl)) {
    return {
      ok: false,
      reason: 'non-loopback-base-url',
      error: `refusing to handshake against non-loopback baseUrl (host is not on the allow-list)`,
    }
  }

  // Gate 2 — expectedRunId must be non-empty. An empty expected run-ID would
  // cause any server response to match, defeating the point of the handshake.
  if (typeof expectedRunId !== 'string' || expectedRunId.length === 0) {
    return {
      ok: false,
      reason: 'empty-expected-run-id',
      error: 'expectedRunId must be a non-empty string',
    }
  }

  const url = new URL(MANAGED_SERVER_ENDPOINT_PATH, baseUrl).toString()

  // Fetch with timeout.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetchImpl(url, { method: 'GET', signal: controller.signal })
  } catch (err) {
    clearTimeout(timer)
    const aborted =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError')
    return {
      ok: false,
      reason: aborted ? 'timeout' : 'fetch-failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
  clearTimeout(timer)

  if (res.status !== 200) {
    return {
      ok: false,
      status: res.status,
      reason: 'non-200-status',
      error: `expected status 200, got ${res.status}`,
    }
  }

  let body: unknown
  try {
    body = await res.json()
  } catch (err) {
    return {
      ok: false,
      status: res.status,
      reason: 'non-json-body',
      error: err instanceof Error ? err.message : String(err),
    }
  }

  if (!isManagedServerHandshakePayload(body)) {
    return {
      ok: false,
      status: res.status,
      reason: 'bad-payload-shape',
      error: 'response body is missing one or more required fields (app, managedServer, runId, pid, uptimeSec)',
    }
  }

  if (body.app !== EXPECTED_APP_NAME) {
    return {
      ok: false,
      status: res.status,
      actualApp: body.app,
      actualRunId: body.runId,
      reason: 'app-mismatch',
      error: `server identifies as app="${body.app}" but handshake expects "${EXPECTED_APP_NAME}"`,
    }
  }

  if (body.runId !== expectedRunId) {
    return {
      ok: false,
      status: res.status,
      actualApp: body.app,
      actualRunId: body.runId,
      reason: 'run-id-mismatch',
      error: `run-ID mismatch: server reports "${body.runId}", orchestrator expects "${expectedRunId}"`,
    }
  }

  return {
    ok: true,
    status: res.status,
    actualApp: body.app,
    actualRunId: body.runId,
  }
}
