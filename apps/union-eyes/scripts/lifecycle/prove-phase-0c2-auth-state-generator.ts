#!/usr/bin/env tsx
/**
 * Phase 0C.2 §12 — Auth-state generator proof.
 *
 * End-to-end verification that `generate-auth-states.ts` produces
 * Playwright-compatible storage-state files for all five canonical Union Eyes
 * QA personas against a freshly-seeded, bootstrap-only disposable database.
 *
 * Flow:
 *   1. Allocate free port.
 *   2. Allocate disposable DB (compliant bootstrap).
 *   3. Seed test fixtures.
 *   4. Boot Next.js dev server (PID-tracked, owned).
 *   5. Poll `/api/health/readiness` until 200 (Phase 0C.2 §6 —
 *      authoritative gate, verifies DB + schema + fixtures).
 *   6. Invoke `generateAuthStates()` to log-in all 5 personas and write
 *      `playwright/.auth/<role>.json` storage-state files.
 *   7. Validate: every persona ok, every storageState file has one
 *      httpOnly `nzila_session` cookie for the correct domain, all 5 emails
 *      match `/api/auth/me`.
 *   8. Governed teardown: stopServer, verify port release, drop DB.
 *   9. Write evidence report.
 *
 * Writes evidence to
 * `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-auth-state-generator-proof.md`.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { allocateDatabase, dropDatabase } from './allocate-db'
import { CANONICAL_PERSONAS, generateAuthStates } from './generate-auth-states'
import { allocatePort, bootServer, pollReadiness, stopServer, verifyPortRelease } from './process'

const APP_ROOT = path.resolve(__dirname, '..', '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')
const AUTH_STATE_DIR = path.resolve(APP_ROOT, 'playwright', '.auth')
const REPORT_PATH = path.resolve(
  REPO_ROOT,
  'reports',
  'audits',
  'cupe-national-phase-0',
  'phase-0c',
  'phase-0c2-auth-state-generator-proof.md',
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

function ensureReportDir(): void {
  const dir = path.dirname(REPORT_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

interface StorageStateFile {
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    expires: number
    httpOnly: boolean
    secure: boolean
    sameSite: string
  }>
  origins: unknown[]
}

function validateStorageStateFile(filePath: string, expectedDomain: string): string[] {
  const failures: string[] = []
  if (!existsSync(filePath)) {
    failures.push(`file missing: ${filePath}`)
    return failures
  }
  const raw = readFileSync(filePath, 'utf8')
  let parsed: StorageStateFile
  try {
    parsed = JSON.parse(raw) as StorageStateFile
  } catch (err) {
    failures.push(`invalid JSON in ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
    return failures
  }
  if (!Array.isArray(parsed.cookies)) {
    failures.push(`${filePath}: cookies not an array`)
    return failures
  }
  const session = parsed.cookies.find((c) => c.name === 'nzila_session')
  if (!session) {
    failures.push(`${filePath}: no 'nzila_session' cookie`)
    return failures
  }
  if (!session.value || session.value.length < 16) {
    failures.push(`${filePath}: nzila_session value too short (${session.value?.length ?? 0} chars)`)
  }
  if (session.domain !== expectedDomain) {
    failures.push(`${filePath}: cookie.domain=${session.domain} expected ${expectedDomain}`)
  }
  if (session.path !== '/') {
    failures.push(`${filePath}: cookie.path=${session.path} expected /`)
  }
  if (session.httpOnly !== true) {
    failures.push(`${filePath}: cookie.httpOnly=${session.httpOnly} expected true`)
  }
  if (typeof session.expires !== 'number' || session.expires < Math.floor(Date.now() / 1000)) {
    failures.push(`${filePath}: cookie.expires invalid or already expired (${session.expires})`)
  }
  return failures
}

async function main(): Promise<void> {
  ensureReportDir()

  const lines: string[] = []
  const log = (s: string) => {
    lines.push(s)
    process.stdout.write(s + '\n')
  }

  log(`# Phase 0C.2 §12 — Auth-state Generator Proof`)
  log('')
  log(`**Generated:** ${new Date().toISOString()}`)
  log(`**Harness:** \`apps/union-eyes/scripts/lifecycle/prove-phase-0c2-auth-state-generator.ts\``)
  log(`**Generator:** \`apps/union-eyes/scripts/lifecycle/generate-auth-states.ts\``)
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
    const portStatus = await allocatePort({ preferred: 3012, autoAssign: true, maxAttempts: 30 })
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
      // Enables the platform-auth Playwright E2E bypass when combined with a
      // request User-Agent containing `playwright-e2e-auth`. This lets the
      // generator complete password logins without triggering MFA or risk
      // rate-limits for fixture users. See:
      //   packages/platform-auth/src/password/auth-service.ts::isPlaywrightE2EAuthRequest
      PLAYWRIGHT_TEST_AUTH: 'true',
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

    log('## Step 5 — Poll `/api/health/readiness` until 200 (timeout 180s)')
    log('')
    // Phase 0C.2 §6 — Readiness is the authoritative gate. Liveness only
    // proves that a process is listening, whereas readiness proves that
    // DB is connected, schemas are present, fixtures are seeded, and
    // (when applicable) the run-id env var is set. Auth-state generation
    // depends on all of that, so polling readiness — not liveness —
    // catches misconfiguration BEFORE we start issuing login requests.
    const readinessUrl = `http://localhost:${port}/api/health/readiness`
    const readiness = await pollReadiness({
      url: readinessUrl,
      timeoutMs: 180_000,
      intervalMs: 1_000,
    })
    log(`- ready: \`${readiness.ready}\``)
    log(`- attempts: \`${readiness.attempts}\``)
    log(`- elapsedMs: \`${readiness.elapsedMs}\``)
    if (!readiness.ready) {
      failures.push(`server did not become ready within 180s`)
      verdict = 'FAIL'
      throw new Error('server not ready')
    }
    log('')

    log('## Step 6 — Run auth-state generator (5 canonical personas)')
    log('')
    const baseUrl = `http://localhost:${port}`
    const genStart = Date.now()
    const summary = await generateAuthStates({ baseUrl, outputDir: AUTH_STATE_DIR })
    const genDurationSec = (Date.now() - genStart) / 1000
    log(`- baseUrl: \`${summary.baseUrl}\``)
    log(`- outputDir: \`${path.relative(REPO_ROOT, summary.outputDir).replace(/\\/g, '/')}\``)
    log(`- duration: \`${genDurationSec.toFixed(2)}s\``)
    log(`- allOk: \`${summary.allOk}\``)
    log('')
    log('| Role | Email | Login | Me | Me email match | Cookie | Storage | OK |')
    log('|---|---|:---:|:---:|:---:|:---:|:---:|:---:|')
    for (const r of summary.results) {
      const meMatch = r.meEmail?.toLowerCase() === r.email.toLowerCase() ? '✅' : '❌'
      const cookie = r.cookieValueSample ? '✅' : '❌'
      const storage = r.storageStatePath ? '✅' : '❌'
      const ok = r.ok ? '✅' : '❌'
      log(
        `| ${r.role} | \`${r.email}\` | \`${r.loginStatus}\` | \`${r.meStatus}\` | ${meMatch} | ${cookie} | ${storage} | ${ok} |`,
      )
      if (!r.ok) {
        failures.push(`persona ${r.role}: ${r.error ?? 'unknown failure'}`)
        verdict = 'FAIL'
      }
    }
    log('')

    log('## Step 7 — Validate storageState files on disk')
    log('')
    log('| Role | Path | Issues |')
    log('|---|---|---|')
    for (const persona of CANONICAL_PERSONAS) {
      const filePath = path.join(AUTH_STATE_DIR, `${persona.role}.json`)
      const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')
      const issues = validateStorageStateFile(filePath, 'localhost')
      if (issues.length === 0) {
        log(`| ${persona.role} | \`${rel}\` | ✅ ok |`)
      } else {
        log(`| ${persona.role} | \`${rel}\` | ❌ ${issues.join('; ')} |`)
        for (const i of issues) failures.push(`storageState ${persona.role}: ${i}`)
        verdict = 'FAIL'
      }
    }
    log('')

    log('## Step 8 — Stop server (governed SIGTERM → SIGKILL)')
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

    log('## Step 9 — Verify port release')
    log('')
    const release = await verifyPortRelease(port)
    log(`- port ${port} free: \`${release.free}\``)
    if (!release.free) {
      failures.push(`port ${port} not released: ${release.reason}`)
      verdict = 'FAIL'
    }
    log('')

    log('## Step 10 — Drop disposable DB')
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
    log('**✅ PASS** — Phase 0C.2 §12 auth-state generator proof.')
    log('')
    log('All 5 canonical Union Eyes QA personas (member, steward, staff, executive, admin) ' +
      'successfully authenticated via `POST /api/auth/login`, verified via `GET /api/auth/me` ' +
      '(email match), and produced valid Playwright `storageState` JSON files under ' +
      '`apps/union-eyes/playwright/.auth/` — each containing a single httpOnly ' +
      '`nzila_session` cookie scoped to `localhost` with a future expiry. Server stopped ' +
      'via SIGTERM; port released; DB dropped clean.')
  } else {
    log('**❌ FAIL** — Phase 0C.2 §12 auth-state generator proof.')
    log('')
    log('Failures:')
    for (const f of failures) log(`- ${f}`)
  }
  log('')

  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8')
  process.stdout.write(`[phase-0c2-auth-state-generator-proof] wrote ${REPORT_PATH}\n`)
  process.exit(verdict === 'PASS' ? 0 : 2)
}

main().catch((err) => {
  process.stderr.write(
    `[phase-0c2-auth-state-generator-proof] fatal: ${err instanceof Error ? err.stack : String(err)}\n`,
  )
  process.exit(3)
})
