#!/usr/bin/env tsx
/**
 * Phase 0C.1 §4 — Governed E2E orchestrator.
 *
 * Implements the 15-step sequence documented in
 * reports/audits/cupe-national-phase-0/phase-0c/phase-0c-lifecycle-design.md §5.
 *
 * Sequence (fail-closed):
 *   1.  Preflight (node version / port / stale PID)
 *   2.  Allocate disposable database
 *   3.  Allocate port (default 3002, honours PLAYWRIGHT_PORT/E2E_PORT)
 *   4.  Migrations (applied by allocateDatabase — reported here)
 *   5.  Django migrations (skipped for Next.js-only lifecycle; recorded)
 *   6.  Verify Phase 0B contract (organization_members table probe)
 *   7.  Seed fixtures  (scripts/seed-test-env.ts against disposable DB)
 *   8.  Boot Next.js  (pnpm exec next dev --webpack --port <port>)
 *       + poll /api/health/readiness until 200 (120 s timeout)
 *       + Phase 0C.2 §5 managed-server handshake (runId echo verification)
 *   9.  Generate auth states (scripts/lifecycle/generate-auth-states.ts)
 *   10. Execute Playwright
 *   11. Copy artifacts to run-artifacts/{runId}/
 *   12. Stop server (SIGTERM → SIGKILL)
 *   13. Drop disposable DB (unless E2E_PRESERVE_DB=true)
 *   14. Verify port release
 *   15. Exit with Playwright exit code
 *
 * Non-negotiables (from design spec):
 *   - NEVER touches the developer DB (nzila_automation).
 *   - NEVER kills processes it did not spawn.
 *   - NEVER runs against a production URL (guarded in env/allocate-db).
 *   - Every step's outcome is captured in a per-run summary JSON.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, copyFileSync, cpSync, statSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import {
  loadGovernedE2EEnv,
  redactUrl,
} from './env'
import { allocateDatabase, dropDatabase } from './allocate-db'
import {
  bootServer,
  stopServer,
  pollReadiness,
  preflight,
  allocatePort,
  verifyPortRelease,
} from './process'
import {
  MANAGED_SERVER_ENV_VAR,
  MANAGED_SERVER_RUN_ID_ENV_VAR,
  verifyManagedServer,
} from './managed-server-handshake'

// ─── Types ──────────────────────────────────────────────────────────────────

type StepOutcome = 'ok' | 'skipped' | 'failed'

interface StepRecord {
  step: number
  id: string
  outcome: StepOutcome
  detail?: string
  elapsedMs: number
}

interface RunSummary {
  runId: string
  startedAt: string
  finishedAt: string
  totalElapsedMs: number
  status: 'green' | 'red' | 'aborted'
  playwrightExitCode: number | null
  dbUrl: string
  port: number
  runDir: string
  artifactDir: string
  steps: StepRecord[]
}

// ─── Small utilities ─────────────────────────────────────────────────────────

const APP_ROOT = path.resolve(__dirname, '..', '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')

function tsIsoCompact(d: Date): string {
  return d.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
}

function log(msg: string): void {
  // Stable prefix so operators can grep run-log lines out of interleaved output.
  process.stdout.write(`[e2e:governed] ${msg}\n`)
}

async function withStep<T>(
  steps: StepRecord[],
  step: number,
  id: string,
  fn: () => Promise<{ detail?: string; skipped?: boolean; value?: T }> | { detail?: string; skipped?: boolean; value?: T },
): Promise<T | undefined> {
  const start = performance.now()
  log(`▶ step ${step}: ${id}`)
  try {
    const result = await fn()
    const elapsed = Math.round(performance.now() - start)
    steps.push({
      step,
      id,
      outcome: result?.skipped ? 'skipped' : 'ok',
      detail: result?.detail,
      elapsedMs: elapsed,
    })
    log(`✔ step ${step}: ${id} (${elapsed} ms)${result?.detail ? ` — ${result.detail}` : ''}`)
    return result?.value as T | undefined
  } catch (err) {
    const elapsed = Math.round(performance.now() - start)
    const detail = err instanceof Error ? err.message : String(err)
    steps.push({ step, id, outcome: 'failed', detail, elapsedMs: elapsed })
    log(`✘ step ${step}: ${id} FAILED (${elapsed} ms) — ${detail}`)
    throw err
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const runStart = performance.now()
  const startedAt = new Date()
  const runId = `${tsIsoCompact(startedAt)}_${Math.random().toString(16).slice(2, 8)}`
  const steps: StepRecord[] = []

  // Governed env load — refuses prod URLs, applies deterministic defaults.
  let env: import('./env').GovernedE2EEnv
  try {
    env = loadGovernedE2EEnv({ appRoot: APP_ROOT })
    log(`env loaded (adminUrl=${redactUrl(env.E2E_DB_ADMIN_URL)})`)
  } catch (err) {
    log(`fatal: env load failed — ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }

  let alloc: Awaited<ReturnType<typeof allocateDatabase>> | null = null
  let boot: Awaited<ReturnType<typeof bootServer>> | null = null
  let playwrightExit: number | null = null
  let status: RunSummary['status'] = 'red'
  let port = 0
  let runDir = ''
  let artifactDir = ''

  try {
    // Step 1 — Preflight
    const preferredPort = Number(process.env.PLAYWRIGHT_PORT ?? process.env.E2E_PORT ?? 3002)
    await withStep(steps, 1, 'preflight', async () => {
      const p = await preflight(preferredPort)
      const failures = p.checks.filter((c) => !c.ok)
      if (failures.length > 0) {
        throw new Error(
          `preflight failed: ${failures.map((c) => `${c.id}=${c.detail ?? 'fail'}`).join('; ')}`,
        )
      }
      return { detail: `node=${process.version}, port=${preferredPort} free` }
    })

    // Step 2 — Allocate disposable DB
    alloc = await withStep(steps, 2, 'allocate-db', async () => {
      const a = await allocateDatabase({
        adminUrl: env.E2E_DB_ADMIN_URL,
        prefix: 'ue_e2e',
        repoRoot: REPO_ROOT,
      })
      runDir = a.runDir
      return { detail: `db=${a.dbName} runId=${a.runId}`, value: a }
    }) as Awaited<ReturnType<typeof allocateDatabase>>

    if (!alloc) throw new Error('allocateDatabase returned undefined')

    // Step 3 — Allocate port (already validated free in preflight, but reserve now)
    port = (await withStep(steps, 3, 'allocate-port', async () => {
      const p = await allocatePort({ preferred: preferredPort, autoAssign: true })
      if (!p.free) throw new Error(p.reason ?? `port ${p.port} unavailable`)
      return { detail: `port=${p.port} (preferred=${preferredPort})`, value: p.port }
    })) as number

    // Step 4 — Platform migrations (already applied inside allocateDatabase)
    await withStep(steps, 4, 'migrations.platform', async () => ({
      detail: 'applied during allocate-db (drizzle bootstrap)',
    }))

    // Step 5 — Django migrations (Next.js-only lifecycle → skipped, tracked)
    await withStep(steps, 5, 'migrations.django', async () => ({
      skipped: true,
      detail: 'Django not required for Phase 0C.1 baseline; see readiness §6 #6',
    }))

    // Step 6 — Verify Phase 0B contract (organization_members table via readiness later);
    // here we do a lightweight probe now to fail fast before we boot the server.
    await withStep(steps, 6, 'verify-phase0b-contract', async () => {
      const { Client } = await import('pg')
      const client = new Client({ connectionString: alloc!.url })
      await client.connect()
      try {
        const r = await client.query(
          `SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='organization_members' LIMIT 1`,
        )
        if (r.rowCount === 0) throw new Error('organization_members table missing after migrations')
        return { detail: 'organization_members present' }
      } finally {
        await client.end()
      }
    })

    // Step 7 — Seed
    await withStep(steps, 7, 'seed', () => {
      const seedEnv: NodeJS.ProcessEnv = {
        ...process.env,
        DATABASE_URL: alloc!.url,
        QA_TEST_ENV: 'true',
        // Force a stable password for auth-state generator (§9) unless caller set one.
        UE_TEST_USER_PASSWORD: process.env.UE_TEST_USER_PASSWORD ?? 'ue-qa-test-password-!23',
      }
      const seedResult = spawnSync(
        'pnpm',
        ['exec', 'tsx', 'scripts/seed-test-env.ts'],
        {
          cwd: APP_ROOT,
          env: seedEnv,
          stdio: 'inherit',
          shell: process.platform === 'win32',
        },
      )
      if (seedResult.status !== 0) {
        throw new Error(`seed exited with code ${seedResult.status}`)
      }
      return { detail: 'seed-test-env applied to disposable DB' }
    })

    // Step 8 — Boot server + poll readiness + managed-server handshake (§5)
    boot = await withStep(steps, 8, 'boot-server', async () => {
      const merged: NodeJS.ProcessEnv = {
        ...process.env,
        ...env,
        DATABASE_URL: alloc!.url,
        NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
        PORT: String(port),
        NODE_ENV: 'test',
        // Phase 0C.2 §5 — Managed-server handshake. These MUST be present in
        // the server's env so that /api/health/managed-server responds with
        // the exact runId we later verify from the orchestrator side.
        [MANAGED_SERVER_ENV_VAR]: 'true',
        [MANAGED_SERVER_RUN_ID_ENV_VAR]: alloc!.runId,
      }
      // BootServerOptions.env requires Record<string,string>; strip undefined values.
      const serverEnv: Record<string, string> = {}
      for (const [k, v] of Object.entries(merged)) if (v !== undefined) serverEnv[k] = String(v)
      const b = bootServer({
        runId: alloc!.runId,
        port,
        cwd: APP_ROOT,
        env: serverEnv,
        command: 'pnpm',
        args: ['exec', 'next', 'dev', '--webpack', '--port', String(port)],
      })
      const readinessUrl = `http://localhost:${port}/api/health/readiness`
      const readiness = await pollReadiness({
        url: readinessUrl,
        timeoutMs: 120_000,
        intervalMs: 1_000,
      })
      if (!readiness.ready) {
        throw new Error(
          `readiness did not go green within 120s (attempts=${readiness.attempts}, lastStatus=${readiness.lastStatus ?? 'none'})`,
        )
      }
      // Phase 0C.2 §5 — Handshake gate. Readiness only proves that SOME server
      // returned 200 at the readiness path; the handshake proves that the
      // server we're about to test is the one WE just booted (matching runId).
      // If a stale dev server were squatting on this port, its runId would
      // differ (or the endpoint would 404) and the orchestrator aborts before
      // any test runs.
      const handshake = await verifyManagedServer({
        baseUrl: `http://localhost:${port}`,
        expectedRunId: alloc!.runId,
      })
      if (!handshake.ok) {
        throw new Error(
          `managed-server handshake failed: reason=${handshake.reason} error=${handshake.error} actualRunId=${handshake.actualRunId ?? 'none'} actualApp=${handshake.actualApp ?? 'none'}`,
        )
      }
      return {
        detail: `pid=${b.pid} port=${port} readyAfter=${readiness.elapsedMs}ms handshakeRunId=${handshake.actualRunId}`,
        value: b,
      }
    }) as Awaited<ReturnType<typeof bootServer>>

    if (!boot) throw new Error('bootServer returned undefined')

    // Step 9 — Generate auth states
    await withStep(steps, 9, 'generate-auth-states', () => {
      const authEnv: NodeJS.ProcessEnv = {
        ...process.env,
        UE_TEST_BASE_URL: `http://localhost:${port}`,
        UE_TEST_USER_PASSWORD: process.env.UE_TEST_USER_PASSWORD ?? 'ue-qa-test-password-!23',
      }
      const res = spawnSync(
        'pnpm',
        ['exec', 'tsx', 'scripts/lifecycle/generate-auth-states.ts'],
        {
          cwd: APP_ROOT,
          env: authEnv,
          stdio: 'inherit',
          shell: process.platform === 'win32',
        },
      )
      if (res.status !== 0) {
        throw new Error(`generate-auth-states exited with code ${res.status}`)
      }
      return { detail: 'storageState per role written to playwright/.auth/' }
    })

    // Step 10 — Playwright
    await withStep(steps, 10, 'playwright', () => {
      const pwEnv: NodeJS.ProcessEnv = {
        ...process.env,
        UE_TEST_BASE_URL: `http://localhost:${port}`,
        PLAYWRIGHT_PORT: String(port),
        // Phase 0C.2 §5 — tells playwright.config.ts NOT to spawn its own
        // webServer AND lets any downstream code that cares consult the
        // managed-server flag / runId.
        [MANAGED_SERVER_ENV_VAR]: 'true',
        [MANAGED_SERVER_RUN_ID_ENV_VAR]: alloc!.runId,
      }
      const res = spawnSync(
        'pnpm',
        ['exec', 'playwright', 'test'],
        {
          cwd: APP_ROOT,
          env: pwEnv,
          stdio: 'inherit',
          shell: process.platform === 'win32',
        },
      )
      playwrightExit = typeof res.status === 'number' ? res.status : 1
      return {
        detail: `exitCode=${playwrightExit}`,
        // Non-zero exit is captured but NOT thrown — cleanup steps must still run.
      }
    })

    // Step 11 — Copy artifacts
    await withStep(steps, 11, 'collect-artifacts', () => {
      artifactDir = path.join(
        REPO_ROOT,
        'reports',
        'audits',
        'cupe-national-phase-0',
        'phase-0c',
        'run-artifacts',
        alloc!.runId,
      )
      mkdirSync(artifactDir, { recursive: true })
      const candidates = [
        { src: path.join(APP_ROOT, 'playwright-report'), dst: path.join(artifactDir, 'playwright-report') },
        { src: path.join(APP_ROOT, 'test-results'), dst: path.join(artifactDir, 'test-results') },
        { src: path.join(alloc!.runDir, 'server.log'), dst: path.join(artifactDir, 'server.log') },
      ]
      const copied: string[] = []
      for (const c of candidates) {
        if (!existsSync(c.src)) continue
        try {
          const stat = statSync(c.src)
          if (stat.isDirectory()) cpSync(c.src, c.dst, { recursive: true })
          else copyFileSync(c.src, c.dst)
          copied.push(path.basename(c.src))
        } catch (err) {
          log(`  (artifact copy warning for ${c.src}: ${err instanceof Error ? err.message : err})`)
        }
      }
      return { detail: `artifacts=${copied.join(',') || 'none'}` }
    })

    status = playwrightExit === 0 ? 'green' : 'red'
  } catch (err) {
    status = 'aborted'
    log(`ABORT — ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    // Step 12 — Stop server (always attempted)
    if (boot) {
      try {
        const stop = await stopServer({ gracefulTimeoutMs: 10_000 })
        steps.push({ step: 12, id: 'stop-server', outcome: 'ok', detail: `method=${stop.method}`, elapsedMs: 0 })
        log(`✔ step 12: stop-server (${stop.method})`)
      } catch (err) {
        steps.push({
          step: 12,
          id: 'stop-server',
          outcome: 'failed',
          detail: err instanceof Error ? err.message : String(err),
          elapsedMs: 0,
        })
        log(`✘ step 12: stop-server FAILED — ${err instanceof Error ? err.message : err}`)
      }
    } else {
      steps.push({ step: 12, id: 'stop-server', outcome: 'skipped', detail: 'server never booted', elapsedMs: 0 })
    }

    // Step 13 — Drop DB (unless preserved)
    if (alloc) {
      const preserve = process.env.E2E_PRESERVE_DB === 'true'
      if (preserve) {
        steps.push({
          step: 13,
          id: 'drop-db',
          outcome: 'skipped',
          detail: `E2E_PRESERVE_DB=true → kept ${alloc.dbName}`,
          elapsedMs: 0,
        })
        log(`⚠ step 13: drop-db skipped — DB preserved: ${alloc.dbName}`)
      } else {
        try {
          await dropDatabase(alloc, {
            adminUrl: env.E2E_DB_ADMIN_URL,
            repoRoot: REPO_ROOT,
          })
          steps.push({ step: 13, id: 'drop-db', outcome: 'ok', detail: alloc.dbName, elapsedMs: 0 })
          log(`✔ step 13: drop-db ${alloc.dbName}`)
        } catch (err) {
          steps.push({
            step: 13,
            id: 'drop-db',
            outcome: 'failed',
            detail: err instanceof Error ? err.message : String(err),
            elapsedMs: 0,
          })
          log(`✘ step 13: drop-db FAILED — ${err instanceof Error ? err.message : err}`)
        }
      }
    } else {
      steps.push({ step: 13, id: 'drop-db', outcome: 'skipped', detail: 'DB never allocated', elapsedMs: 0 })
    }

    // Step 14 — Verify port release
    if (port > 0) {
      try {
        const portStatus = await verifyPortRelease(port)
        steps.push({
          step: 14,
          id: 'verify-port-release',
          outcome: portStatus.free ? 'ok' : 'failed',
          detail: portStatus.free
            ? `port ${port} released`
            : (portStatus.reason ?? `port ${port} still held`),
          elapsedMs: 0,
        })
        log(`${portStatus.free ? '✔' : '✘'} step 14: verify-port-release port=${port}`)
      } catch (err) {
        steps.push({
          step: 14,
          id: 'verify-port-release',
          outcome: 'failed',
          detail: err instanceof Error ? err.message : String(err),
          elapsedMs: 0,
        })
      }
    } else {
      steps.push({ step: 14, id: 'verify-port-release', outcome: 'skipped', detail: 'port never allocated', elapsedMs: 0 })
    }

    // Write run summary
    const totalElapsedMs = Math.round(performance.now() - runStart)
    const summary: RunSummary = {
      runId: alloc?.runId ?? runId,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      totalElapsedMs,
      status,
      playwrightExitCode: playwrightExit,
      dbUrl: alloc ? redactUrl(alloc.url) : '',
      port,
      runDir,
      artifactDir,
      steps,
    }
    const summaryDest = artifactDir
      ? path.join(artifactDir, 'run-summary.json')
      : runDir
        ? path.join(runDir, 'run-summary.json')
        : path.join(APP_ROOT, '.e2e-lifecycle', 'runs', summary.runId, 'run-summary.json')
    mkdirSync(path.dirname(summaryDest), { recursive: true })
    writeFileSync(summaryDest, JSON.stringify(summary, null, 2), 'utf-8')
    log(`summary written → ${summaryDest}`)

    // Step 15 — Exit with Playwright exit code (or 2 if the run aborted before Playwright ran)
    if (status === 'aborted') process.exit(2)
    process.exit(playwrightExit ?? 1)
  }
}

main().catch((err) => {
  // Defensive — main() has its own try/finally, but if something escaped:
  // eslint-disable-next-line no-console
  console.error('[e2e:governed] fatal (unhandled):', err)
  process.exit(3)
})
