#!/usr/bin/env tsx
/**
 * Phase 0C.2 §11 — Readiness authoritative endpoints proof.
 *
 * Proves that when Union Eyes is booted against a bootstrap-only + seeded
 * disposable DB, the authoritative health/readiness endpoints return the
 * expected contract:
 *
 *   1. `/api/health/liveness` → HTTP 200, `{status:'ok', uptime:number}`
 *   2. `/api/health`          → HTTP 200, `{ok:true, status:'healthy'|'degraded',
 *                                             checks.process.status='ok',
 *                                             checks.database.status='ok',
 *                                             checks.auth.status='ok', ...}`
 *   3. `/api/auth_core/health` → HTTP 200, same shape as `/api/health`
 *
 * Uses the governed lifecycle primitives (`allocatePort`, `bootServer`,
 * `pollReadiness`, `stopServer`, `verifyPortRelease`) so no unowned `node` /
 * `next` processes are ever signalled.
 *
 * Invoked manually via:
 *   pnpm exec tsx apps/union-eyes/scripts/lifecycle/prove-phase-0c2-readiness-endpoints.ts
 *
 * Writes evidence to
 * `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-readiness-endpoints-proof.md`.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { allocateDatabase, dropDatabase } from './allocate-db'
import {
  allocatePort,
  bootServer,
  pollReadiness,
  stopServer,
  verifyPortRelease,
} from './process'

const APP_ROOT = path.resolve(__dirname, '..', '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')
const REPORT_PATH = path.resolve(
  REPO_ROOT,
  'reports',
  'audits',
  'cupe-national-phase-0',
  'phase-0c',
  'phase-0c2-readiness-endpoints-proof.md',
)

const REQUIRED_ENV = [
  'AUTH_SECRET',
  'VOTING_SECRET',
  'DJANGO_SECRET_KEY',
  'NEXTAUTH_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXTAUTH_URL',
] as const

function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k] || process.env[k]!.length === 0)
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}. ` +
        `Export the standard Phase 0C.2 proof env block before running.`,
    )
  }
}

function runSeed(dbUrl: string): { exitCode: number; durationSec: number; stderrTail: string } {
  const started = Date.now()
  const res = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'tsx', 'scripts/seed-test-env.ts'],
    {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
        QA_TEST_ENV: 'true',
        UE_TEST_USER_PASSWORD: process.env.UE_TEST_USER_PASSWORD ?? 'NzilaQa!2026',
      },
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  )
  const durationSec = (Date.now() - started) / 1000
  const stderrTail = (res.stderr ?? '').split('\n').slice(-20).join('\n')
  return { exitCode: res.status ?? -1, durationSec, stderrTail }
}

interface FetchResult {
  status: number
  bodyText: string
  parsed: unknown
  error?: string
}

async function fetchJson(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } })
    const bodyText = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(bodyText)
    } catch {
      parsed = null
    }
    return { status: res.status, bodyText, parsed }
  } catch (err) {
    return {
      status: 0,
      bodyText: '',
      parsed: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function ensureReportDir(): void {
  const dir = path.dirname(REPORT_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

interface HealthCheckShape {
  status?: string
  ok?: boolean
  app?: string
  environment?: string
  version?: string
  timestamp?: string
  checks?: Record<string, { status?: string; critical?: boolean }>
}

function isHealthResponse(x: unknown): x is HealthCheckShape {
  return typeof x === 'object' && x !== null
}

async function main(): Promise<void> {
  ensureReportDir()

  const lines: string[] = []
  const log = (s: string) => {
    lines.push(s)
    process.stdout.write(s + '\n')
  }

  log(`# Phase 0C.2 §11 — Readiness Authoritative Endpoints Proof`)
  log('')
  log(`**Generated:** ${new Date().toISOString()}`)
  log(`**Harness:** \`apps/union-eyes/scripts/lifecycle/prove-phase-0c2-readiness-endpoints.ts\``)
  log('')
  log('---')
  log('')

  let alloc: Awaited<ReturnType<typeof allocateDatabase>> | null = null
  let serverStarted = false
  let port = 0
  let verdict: 'PASS' | 'FAIL' = 'PASS'
  const failures: string[] = []

  try {
    assertRequiredEnv()

    log('## Step 1 — Allocate free port')
    log('')
    const portStatus = await allocatePort({ preferred: 3011, autoAssign: true, maxAttempts: 30 })
    if (!portStatus.free) throw new Error(`Port allocation failed: ${portStatus.reason}`)
    port = portStatus.port
    log(`- port: \`${port}\``)
    log('')

    log('## Step 2 — Allocate disposable DB (compliant bootstrap)')
    log('')
    alloc = await allocateDatabase({})
    log(`- dbName: \`${alloc.dbName}\``)
    log(`- runId: \`${alloc.runId}\``)
    log('')

    log('## Step 3 — Seed test fixtures')
    log('')
    const seed = runSeed(alloc.url)
    log(`- exit code: \`${seed.exitCode}\``)
    log(`- duration: \`${seed.durationSec.toFixed(2)}s\``)
    if (seed.exitCode !== 0) {
      log('')
      log('```')
      log(seed.stderrTail)
      log('```')
      failures.push(`seed exited with code ${seed.exitCode}`)
      verdict = 'FAIL'
      throw new Error('seed failed — cannot boot server')
    }
    log('')

    log('## Step 4 — Boot Next.js dev server (owned + PID-tracked)')
    log('')
    const bootEnv: Record<string, string> = {
      ...(process.env as Record<string, string>),
      DATABASE_URL: alloc.url,
      PORT: String(port),
      NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
      NEXTAUTH_URL: `http://localhost:${port}`,
      QA_TEST_ENV: 'true',
      NODE_ENV: 'test',
      NZILA_MODE: process.env.NZILA_MODE ?? 'test',
    }
    const boot = bootServer({
      runId: alloc.runId,
      port,
      cwd: APP_ROOT,
      env: bootEnv,
      command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      args: ['exec', 'next', 'dev', '--webpack', '--port', String(port)],
    })
    serverStarted = true
    log(`- pid: \`${boot.pid}\``)
    log(`- log: \`${path.relative(REPO_ROOT, boot.logPath).replace(/\\/g, '/')}\``)
    log('')

    log('## Step 5 — Poll `/api/health/liveness` until 200 (timeout 180s)')
    log('')
    const livenessUrl = `http://localhost:${port}/api/health/liveness`
    const readiness = await pollReadiness({
      url: livenessUrl,
      timeoutMs: 180_000,
      intervalMs: 1_000,
    })
    log(`- ready: \`${readiness.ready}\``)
    log(`- attempts: \`${readiness.attempts}\``)
    log(`- elapsedMs: \`${readiness.elapsedMs}\``)
    log(`- lastStatus: \`${readiness.lastStatus ?? 'n/a'}\``)
    if (!readiness.ready) {
      failures.push(
        `server did not respond 200 on ${livenessUrl} within 180s ` +
          `(last status=${readiness.lastStatus ?? 'n/a'})`,
      )
      verdict = 'FAIL'
      throw new Error('server did not become live')
    }
    log('')

    log('## Step 6 — GET `/api/health/liveness` — assert shape')
    log('')
    const liveness = await fetchJson(livenessUrl)
    log(`- status: \`${liveness.status}\``)
    log('- body:')
    log('  ```json')
    log('  ' + liveness.bodyText.slice(0, 400))
    log('  ```')
    if (liveness.status !== 200) {
      failures.push(`liveness status ${liveness.status}`)
      verdict = 'FAIL'
    } else {
      const b = liveness.parsed as { status?: string; uptime?: number }
      if (!b || b.status !== 'ok') {
        failures.push(`liveness body.status !== 'ok' (got ${JSON.stringify(b?.status)})`)
        verdict = 'FAIL'
      }
      if (!b || typeof b.uptime !== 'number' || b.uptime < 0) {
        failures.push(`liveness body.uptime missing or invalid`)
        verdict = 'FAIL'
      }
    }
    log('')

    log('## Step 7 — GET `/api/health` — assert canonical contract')
    log('')
    const healthUrl = `http://localhost:${port}/api/health`
    const health = await fetchJson(healthUrl)
    log(`- status: \`${health.status}\``)
    log('- body:')
    log('  ```json')
    log('  ' + health.bodyText.slice(0, 1200))
    log('  ```')
    if (health.status !== 200) {
      failures.push(`/api/health status ${health.status} (expected 200)`)
      verdict = 'FAIL'
    }
    if (isHealthResponse(health.parsed)) {
      const h = health.parsed
      if (h.ok !== true) {
        failures.push(`/api/health body.ok !== true (got ${JSON.stringify(h.ok)})`)
        verdict = 'FAIL'
      }
      if (h.status !== 'healthy' && h.status !== 'degraded') {
        failures.push(
          `/api/health body.status expected 'healthy'|'degraded', got ${JSON.stringify(h.status)}`,
        )
        verdict = 'FAIL'
      }
      const requiredChecks: Array<[string, boolean]> = [
        ['process', true], // must be 'ok'
        ['database', true], // must be 'ok'
        ['auth', true],    // must be 'ok' (AUTH_SECRET present)
      ]
      log('')
      log('| Check | Actual | Expected | OK? |')
      log('|---|---|---|:---:|')
      for (const [name, mustBeOk] of requiredChecks) {
        const actual = h.checks?.[name]?.status ?? '<missing>'
        const ok = mustBeOk ? actual === 'ok' : actual === 'ok' || actual === 'degraded'
        if (!ok) {
          failures.push(`/api/health check '${name}' expected ok, got ${actual}`)
          verdict = 'FAIL'
        }
        log(`| ${name} | \`${actual}\` | \`ok\` | ${ok ? '✅' : '❌'} |`)
      }
      log('')
      const stringFields: Array<keyof HealthCheckShape> = ['app', 'environment', 'version', 'timestamp']
      for (const k of stringFields) {
        if (typeof h[k] !== 'string' || (h[k] as string).length === 0) {
          failures.push(`/api/health missing string field '${String(k)}'`)
          verdict = 'FAIL'
        }
      }
      if (h.app !== 'union-eyes') {
        failures.push(`/api/health body.app expected 'union-eyes', got ${JSON.stringify(h.app)}`)
        verdict = 'FAIL'
      }
    } else {
      failures.push(`/api/health body is not JSON`)
      verdict = 'FAIL'
    }
    log('')

    log('## Step 8 — GET `/api/auth_core/health` — assert proxies to canonical')
    log('')
    const authCoreUrl = `http://localhost:${port}/api/auth_core/health`
    const authCore = await fetchJson(authCoreUrl)
    log(`- status: \`${authCore.status}\``)
    log('- body:')
    log('  ```json')
    log('  ' + authCore.bodyText.slice(0, 800))
    log('  ```')
    if (authCore.status !== 200) {
      failures.push(`/api/auth_core/health status ${authCore.status} (expected 200)`)
      verdict = 'FAIL'
    }
    if (isHealthResponse(authCore.parsed)) {
      const h = authCore.parsed
      if (h.ok !== true) {
        failures.push(`/api/auth_core/health body.ok !== true`)
        verdict = 'FAIL'
      }
      if (h.app !== 'union-eyes') {
        failures.push(
          `/api/auth_core/health body.app expected 'union-eyes' (proxy), got ${JSON.stringify(h.app)}`,
        )
        verdict = 'FAIL'
      }
    } else {
      failures.push(`/api/auth_core/health body is not JSON`)
      verdict = 'FAIL'
    }
    log('')

    log('## Step 9 — Stop server (governed SIGTERM → SIGKILL)')
    log('')
    const stop = await stopServer({ gracefulTimeoutMs: 15_000 })
    serverStarted = false
    log(`- stopped: \`${stop.stopped}\``)
    log(`- method: \`${stop.method}\``)
    log(`- pid: \`${stop.pid ?? 'n/a'}\``)
    if (!stop.stopped) {
      failures.push(`stopServer reported not stopped`)
      verdict = 'FAIL'
    }
    log('')

    log('## Step 10 — Verify port release')
    log('')
    const release = await verifyPortRelease(port)
    log(`- port ${port} free: \`${release.free}\``)
    if (!release.free) {
      failures.push(`port ${port} not released: ${release.reason}`)
      verdict = 'FAIL'
    }
    log('')

    log('## Step 11 — Drop disposable DB')
    log('')
    const drop = await dropDatabase(alloc)
    alloc = null
    log(`- drop: \`${JSON.stringify(drop)}\``)
    log('')
  } catch (err) {
    verdict = 'FAIL'
    const msg = err instanceof Error ? err.message : String(err)
    failures.push(`exception: ${msg}`)
    log(`\n**Exception:** ${msg}\n`)
  } finally {
    if (serverStarted) {
      try {
        await stopServer({ gracefulTimeoutMs: 10_000 })
      } catch { /* ignore */ }
    }
    if (alloc) {
      try {
        await dropDatabase(alloc)
      } catch { /* ignore */ }
    }
  }

  log('---')
  log('')
  log('## Verdict')
  log('')
  if (verdict === 'PASS') {
    log('**✅ PASS** — Phase 0C.2 §11 readiness authoritative endpoints proof.')
    log('')
    log('The Union Eyes Next.js server, when booted against a bootstrap-only + seeded ' +
      'disposable DB, responds to `/api/health/liveness`, `/api/health`, and ' +
      '`/api/auth_core/health` on the authoritative contract: HTTP 200, `ok=true`, ' +
      'process/database/auth checks all `ok`, `app="union-eyes"`, and all required ' +
      'metadata fields present.')
  } else {
    log('**❌ FAIL** — Phase 0C.2 §11 readiness authoritative endpoints proof.')
    log('')
    log('Failures:')
    for (const f of failures) log(`- ${f}`)
  }
  log('')

  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8')
  process.stdout.write(`[phase-0c2-readiness-endpoints-proof] wrote ${REPORT_PATH}\n`)
  process.exit(verdict === 'PASS' ? 0 : 2)
}

main().catch((err) => {
  process.stderr.write(
    `[phase-0c2-readiness-endpoints-proof] fatal: ${err instanceof Error ? err.stack : String(err)}\n`,
  )
  process.exit(3)
})
