/**
 * Phase 0C.1 §9/§11 — process + port + readiness lifecycle primitives.
 *
 * NEVER uses `taskkill /IM node.exe` or `pkill node`. Only signals PIDs we
 * ourselves spawned and recorded to `.e2e-lifecycle/pid.json`.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, createWriteStream } from 'node:fs'
import net from 'node:net'
import path from 'node:path'

// ---------- paths -------------------------------------------------------------

function resolveAppRoot(): string {
  // scripts/lifecycle/process.ts → apps/union-eyes
  return path.resolve(__dirname, '..', '..')
}

function lifecycleDir(): string {
  const dir = path.join(resolveAppRoot(), '.e2e-lifecycle')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function pidFile(): string {
  return path.join(lifecycleDir(), 'pid.json')
}

function ownedByFile(): string {
  return path.join(lifecycleDir(), 'owned-by.txt')
}

// ---------- port allocator ---------------------------------------------------

export interface PortStatus {
  port: number
  free: boolean
  reason?: string
}

/**
 * Check whether a TCP port is available on 127.0.0.1.
 */
export async function isPortFree(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const srv = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        srv.close(() => resolve(true))
      })
    srv.listen(port, '127.0.0.1')
  })
}

export interface AllocatePortOptions {
  preferred?: number
  autoAssign?: boolean
  maxAttempts?: number
}

/**
 * Attempts to reserve the preferred port (default 3002). If it is not free
 * and `autoAssign` is true, walks forward until a free port is found.
 * Otherwise returns { free: false } with a diagnostic reason.
 */
export async function allocatePort(options: AllocatePortOptions = {}): Promise<PortStatus> {
  const preferred = options.preferred ?? 3002
  const autoAssign = options.autoAssign ?? false
  const maxAttempts = options.maxAttempts ?? 20

  if (await isPortFree(preferred)) return { port: preferred, free: true }
  if (!autoAssign) {
    return { port: preferred, free: false, reason: `port ${preferred} in use` }
  }
  for (let i = 1; i <= maxAttempts; i++) {
    const candidate = preferred + i
    if (await isPortFree(candidate)) return { port: candidate, free: true }
  }
  return { port: preferred, free: false, reason: `no free port in [${preferred}..${preferred + maxAttempts}]` }
}

/**
 * Verify the port is free — used post-cleanup.
 */
export async function verifyPortRelease(port: number): Promise<PortStatus> {
  const free = await isPortFree(port)
  return free ? { port, free: true } : { port, free: false, reason: `port ${port} still in use after cleanup` }
}

// ---------- PID tracking -----------------------------------------------------

interface PidRecord {
  pid: number
  port: number
  startedAt: string
  command: string
  runId: string
}

function readPidRecord(): PidRecord | null {
  const file = pidFile()
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as PidRecord
  } catch {
    return null
  }
}

function writePidRecord(rec: PidRecord): void {
  writeFileSync(pidFile(), JSON.stringify(rec, null, 2), 'utf8')
}

function clearPidRecord(): void {
  const file = pidFile()
  if (existsSync(file)) rmSync(file, { force: true })
  const owned = ownedByFile()
  if (existsSync(owned)) rmSync(owned, { force: true })
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Signal the tracked PID and — on Windows — its entire process tree.
 *
 * Rationale: on win32, `spawn(cmd, args, { shell: true })` produces a
 * `cmd.exe`/`pnpm.cmd` wrapper whose PID is the one we record; the actual
 * `next` (Node) grandchild is a distinct process. POSIX process-group
 * signalling is unavailable on Windows, so `process.kill(pid)` only
 * terminates the wrapper, orphaning the underlying dev server. Using
 * `taskkill /PID <pid> /T /F` (Terminate + Force) walks the win32 job-object
 * tree and kills every descendant. This *never* uses `/IM node.exe` or
 * anything else that could hit an unrelated node process — only our own
 * recorded PID and its descendants.
 *
 * On POSIX, falls back to `process.kill(pid, signal)`.
 */
function killTracked(pid: number, signal: NodeJS.Signals): boolean {
  if (process.platform !== 'win32') {
    try {
      process.kill(pid, signal)
      return true
    } catch {
      return false
    }
  }
  // Windows: use taskkill for the entire tree. /F ("force") is required for
  // SIGKILL; for a graceful stop we still use /F because Windows console apps
  // do not honour SIGTERM the same way — but /T ensures no orphan children.
  // We keep SIGTERM vs SIGKILL semantics in the caller by choosing whether to
  // await between the two calls.
  const res = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  return res.status === 0
}

// ---------- server boot / stop ----------------------------------------------

export interface BootServerOptions {
  runId: string
  port: number
  cwd: string
  env: Record<string, string>
  command: string
  args: string[]
  logFile?: string
}

export interface BootServerResult {
  pid: number
  port: number
  logPath: string
}

/**
 * Spawn the Next.js dev server and record its PID. Refuses if the pid file
 * already tracks a live owned process.
 */
export function bootServer(options: BootServerOptions): BootServerResult {
  const existing = readPidRecord()
  if (existing && processIsAlive(existing.pid)) {
    throw new Error(
      `E2E server already tracked as PID ${existing.pid} on port ${existing.port} (runId=${existing.runId}). ` +
        `Refusing to double-boot. Call stopServer() first.`,
    )
  }
  if (existing && !processIsAlive(existing.pid)) {
    // Stale — clean it silently
    clearPidRecord()
  }

  const logPath =
    options.logFile ?? path.join(lifecycleDir(), 'runs', options.runId, 'server.log')
  mkdirSync(path.dirname(logPath), { recursive: true })
  const logStream = createWriteStream(logPath, { flags: 'a' })

  const child: ChildProcess = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: { ...options.env, PORT: String(options.port) } as unknown as NodeJS.ProcessEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    detached: false,
  })

  if (!child.pid) {
    logStream.end()
    throw new Error(`Failed to spawn '${options.command} ${options.args.join(' ')}'`)
  }

  child.stdout?.pipe(logStream)
  child.stderr?.pipe(logStream)

  const record: PidRecord = {
    pid: child.pid,
    port: options.port,
    startedAt: new Date().toISOString(),
    command: `${options.command} ${options.args.join(' ')}`,
    runId: options.runId,
  }
  writePidRecord(record)
  writeFileSync(ownedByFile(), `phase0c1-e2e-${options.runId}\n`, 'utf8')

  // Detach the child's stdio streams from our reference so the parent can exit
  child.unref()

  return { pid: child.pid, port: options.port, logPath }
}

export interface StopServerOptions {
  gracefulTimeoutMs?: number
}

export interface StopServerResult {
  stopped: boolean
  method: 'sigterm' | 'sigkill' | 'already-dead' | 'no-record'
  pid?: number
}

/**
 * Stop the tracked server: SIGTERM → wait up to gracefulTimeoutMs → SIGKILL.
 */
export async function stopServer(options: StopServerOptions = {}): Promise<StopServerResult> {
  const rec = readPidRecord()
  if (!rec) return { stopped: true, method: 'no-record' }
  const timeout = options.gracefulTimeoutMs ?? 10_000

  if (!processIsAlive(rec.pid)) {
    clearPidRecord()
    return { stopped: true, method: 'already-dead', pid: rec.pid }
  }

  try {
    if (process.platform === 'win32') {
      // Windows: taskkill /T /F terminates the tree in one call. It is
      // "hard" (comparable to SIGKILL); we still call it here to give the
      // caller the opportunity to short-circuit before the extra wait +
      // second attempt below, preserving the sigterm/sigkill result shape.
      killTracked(rec.pid, 'SIGTERM')
    } else {
      process.kill(rec.pid, 'SIGTERM')
    }
  } catch {
    /* already gone */
  }

  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (!processIsAlive(rec.pid)) {
      clearPidRecord()
      return { stopped: true, method: 'sigterm', pid: rec.pid }
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  try {
    if (process.platform === 'win32') {
      killTracked(rec.pid, 'SIGKILL')
    } else {
      process.kill(rec.pid, 'SIGKILL')
    }
  } catch {
    /* already gone */
  }
  await new Promise((r) => setTimeout(r, 300))
  const stillAlive = processIsAlive(rec.pid)
  clearPidRecord()
  return {
    stopped: !stillAlive,
    method: 'sigkill',
    pid: rec.pid,
  }
}

// ---------- readiness poll ---------------------------------------------------

export interface PollReadinessOptions {
  url: string
  timeoutMs?: number
  intervalMs?: number
}

export interface PollReadinessResult {
  ready: boolean
  attempts: number
  lastStatus?: number
  lastBody?: unknown
  elapsedMs: number
}

/**
 * Polls a URL until it returns HTTP 200 or the timeout elapses.
 * Used for `/api/health/readiness`.
 */
export async function pollReadiness(options: PollReadinessOptions): Promise<PollReadinessResult> {
  const timeout = options.timeoutMs ?? 120_000
  const interval = options.intervalMs ?? 1_000
  const start = Date.now()
  let attempts = 0
  let lastStatus: number | undefined
  let lastBody: unknown

  while (Date.now() - start < timeout) {
    attempts++
    try {
      const res = await fetch(options.url, { method: 'GET' })
      lastStatus = res.status
      try {
        lastBody = await res.json()
      } catch {
        lastBody = undefined
      }
      if (res.status === 200) {
        return { ready: true, attempts, lastStatus, lastBody, elapsedMs: Date.now() - start }
      }
    } catch (err) {
      lastBody = err instanceof Error ? err.message : String(err)
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  return { ready: false, attempts, lastStatus, lastBody, elapsedMs: Date.now() - start }
}

// ---------- preflight --------------------------------------------------------

export interface PreflightResult {
  ok: boolean
  checks: Array<{ id: string; ok: boolean; detail?: string }>
}

/**
 * Verifies runtime pre-conditions without side effects.
 */
export async function preflight(preferredPort = 3002): Promise<PreflightResult> {
  const checks: PreflightResult['checks'] = []

  // Node version
  const nodeMajor = Number(process.versions.node.split('.')[0])
  checks.push({
    id: 'node.version',
    ok: nodeMajor >= 20,
    detail: `node=${process.versions.node}`,
  })

  // Port free (soft — the allocator will handle auto-assign)
  const portFree = await isPortFree(preferredPort)
  checks.push({
    id: 'port.free',
    ok: portFree,
    detail: portFree ? `port ${preferredPort} available` : `port ${preferredPort} busy`,
  })

  // pid.json absent OR points to dead PID
  const rec = readPidRecord()
  if (!rec) {
    checks.push({ id: 'pid.clean', ok: true, detail: 'no prior pid.json' })
  } else if (!processIsAlive(rec.pid)) {
    checks.push({ id: 'pid.clean', ok: true, detail: `stale pid.json (pid ${rec.pid} dead) — will be cleared` })
    clearPidRecord()
  } else {
    checks.push({
      id: 'pid.clean',
      ok: false,
      detail: `pid.json tracks live pid ${rec.pid} on port ${rec.port} — call stopServer()`,
    })
  }

  return { ok: checks.every((c) => c.ok), checks }
}

// ---------- test-only helpers ------------------------------------------------

export const _internal = {
  readPidRecord,
  writePidRecord,
  clearPidRecord,
  processIsAlive,
  pidFile,
  lifecycleDir,
}
