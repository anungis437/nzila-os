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
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, cpSync, statSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import {
  loadGovernedE2EEnv,
  applyEnvToProcess,
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

/**
 * Phase 0C.2 §BR-6 — parse `PLAYWRIGHT_PROJECTS` env var into a normalised
 * list of project names.
 *
 * Accepts comma- and/or whitespace-separated entries. Empty/undefined
 * input yields `[]` (interpreted downstream as "run all wired projects").
 * Exported for the regression guard at
 * `apps/union-eyes/tests/lifecycle-project-filter.test.ts` — kept pure so it
 * can be tested without spawning children.
 */
export function parseProjectFilter(raw: string | undefined | null): string[] {
  if (raw === undefined || raw === null) return []
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
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
    // Phase 0C.2 §11 — apply loaded env to process.env so spawned children
    // (bootstrap, seed, next dev, playwright) inherit QA_TEST_ENV=true,
    // AUTH_SECRET, NODE_ENV=test, etc. Without this call, the QA baseline
    // SQL is silently skipped and organization_members never gets created,
    // aborting step 6. See phase-0c2-baseline-run-1.md for the diagnostic.
    applyEnvToProcess(env)
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
        // Phase 0C.2 §11 — Emit lastBody diagnostic so operators can see
        // which readiness check(s) failed without needing to re-hit the
        // endpoint manually. Keep bounded (2 KB) to avoid noisy logs.
        let bodyStr = ''
        try {
          bodyStr = JSON.stringify(readiness.lastBody)
          if (bodyStr.length > 2048) bodyStr = `${bodyStr.slice(0, 2048)}…<truncated>`
        } catch {
          bodyStr = '<unserializable>'
        }
        throw new Error(
          `readiness did not go green within 120s (attempts=${readiness.attempts}, lastStatus=${readiness.lastStatus ?? 'none'}, lastBody=${bodyStr})`,
        )
      }
      // Phase 0C.2 §5 — Handshake gate. Readiness only proves that SOME server
      // returned 200 at the readiness path; the handshake proves that the
      // server we're about to test is the one WE just booted (matching runId).
      // If a stale dev server were squatting on this port, its runId would
      // differ (or the endpoint would 404) and the orchestrator aborts before
      // any test runs.
      // Phase 0C.2 §BR-8 Batch F — Handshake timeout bumped from 5s (§5 default)
      // to 30s because the /api/health/managed-server route can cold-compile in
      // Next.js dev when first requested. Readiness already gates on server-up;
      // this is only the runId verification. 30s matches readiness retry budget.
      const handshake = await verifyManagedServer({
        baseUrl: `http://localhost:${port}`,
        expectedRunId: alloc!.runId,
        timeoutMs: 30_000,
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

    // Step 9 — Generate auth states (Phase 0C.2 §7 — orchestrated wiring)
    //
    // Hardening notes:
    //   - The generator CLI reads NZILA_AUTH_STATE_BASE_URL first; we set it
    //     explicitly to the runtime port so we do not depend on inherited
    //     NEXT_PUBLIC_APP_URL (which may be a stale dotenv value if the
    //     preferred port was taken and step 3 auto-assigned a different one).
    //   - We set NZILA_AUTH_STATE_DIR explicitly for the same reason (the
    //     generator's default is derived from __dirname, which is correct
    //     but relying on the default hides the contract).
    //   - We propagate the managed-server flag + runId so that any inner
    //     probe issued by the generator against /api/health/managed-server
    //     would agree with the orchestrator on the runId.
    //   - We cap spawnSync with a 90s timeout — the generator's own per-
    //     request timeout is 20s and it must complete 5 personas × 2 calls,
    //     so 90s is a safe ceiling before we consider it hung.
    //   - After exit=0, we verify playwright/.auth/summary.json actually
    //     lists allOk=true with a result entry per canonical persona. This
    //     catches a generator that silently regresses to partial success.
    const AUTH_STATE_DIR = path.join(APP_ROOT, 'playwright', '.auth')
    const AUTH_STATE_SUMMARY = path.join(AUTH_STATE_DIR, 'summary.json')
    const AUTH_STATE_TIMEOUT_MS = 90_000
    const AUTH_STATE_EXPECTED_ROLES = ['member', 'steward', 'staff', 'executive', 'admin'] as const

    await withStep(steps, 9, 'generate-auth-states', async () => {
      const authEnv: NodeJS.ProcessEnv = {
        ...process.env,
        NZILA_AUTH_STATE_BASE_URL: `http://localhost:${port}`,
        NZILA_AUTH_STATE_DIR: AUTH_STATE_DIR,
        // Kept for backward compatibility with any external tooling that
        // reads this variable — the generator CLI itself ignores it.
        UE_TEST_BASE_URL: `http://localhost:${port}`,
        UE_TEST_USER_PASSWORD: process.env.UE_TEST_USER_PASSWORD ?? 'ue-qa-test-password-!23',
        // Managed-server context — informational for the generator, but keeps
        // the whole run under a single runId if it ever adds handshake probes.
        [MANAGED_SERVER_ENV_VAR]: 'true',
        [MANAGED_SERVER_RUN_ID_ENV_VAR]: alloc!.runId,
      }
      const res = spawnSync(
        'pnpm',
        ['exec', 'tsx', 'scripts/lifecycle/generate-auth-states.ts'],
        {
          cwd: APP_ROOT,
          env: authEnv,
          stdio: 'inherit',
          shell: process.platform === 'win32',
          timeout: AUTH_STATE_TIMEOUT_MS,
          killSignal: 'SIGKILL',
        },
      )
      if (res.signal === 'SIGKILL' || (res.error && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT')) {
        throw new Error(`generate-auth-states timed out after ${AUTH_STATE_TIMEOUT_MS}ms`)
      }
      if (res.status !== 0) {
        throw new Error(`generate-auth-states exited with code ${res.status}`)
      }

      // Post-exit verification — read summary.json, refuse partial success.
      if (!existsSync(AUTH_STATE_SUMMARY)) {
        throw new Error(`generate-auth-states exited 0 but summary.json missing at ${AUTH_STATE_SUMMARY}`)
      }
      let parsed: {
        allOk?: boolean
        results?: Array<{ role?: string; ok?: boolean; storageStatePath?: string; error?: string }>
      }
      try {
        parsed = JSON.parse(readFileSync(AUTH_STATE_SUMMARY, 'utf8')) as typeof parsed
      } catch (err) {
        throw new Error(`generate-auth-states summary.json unparseable: ${err instanceof Error ? err.message : err}`)
      }
      if (parsed.allOk !== true) {
        const failing = (parsed.results ?? [])
          .filter((r) => r.ok !== true)
          .map((r) => `${r.role ?? '<unknown>'}=${r.error ?? 'no-error'}`)
          .join(', ')
        throw new Error(
          `generate-auth-states reported allOk=${String(parsed.allOk)} — failing: ${failing || '<none listed>'}`,
        )
      }
      const gotRoles = new Set((parsed.results ?? []).filter((r) => r.ok === true).map((r) => r.role))
      const missing = AUTH_STATE_EXPECTED_ROLES.filter((r) => !gotRoles.has(r))
      if (missing.length > 0) {
        throw new Error(
          `generate-auth-states missing storageState for role(s): ${missing.join(',')}`,
        )
      }
      // Also verify each storageStatePath file actually exists on disk.
      for (const r of parsed.results ?? []) {
        if (r.ok && r.storageStatePath && !existsSync(r.storageStatePath)) {
          throw new Error(
            `generate-auth-states reported ok=true for '${r.role}' but file missing at ${r.storageStatePath}`,
          )
        }
      }
      return {
        detail: `roles=${AUTH_STATE_EXPECTED_ROLES.length} allOk=true dir=${path.relative(APP_ROOT, AUTH_STATE_DIR)}`,
      }
    })

    // Step 10 — Playwright
    await withStep(steps, 10, 'playwright', () => {
      const pwEnv: NodeJS.ProcessEnv = {
        ...process.env,
        // Phase 0C.2 §11 (fix e) — Playwright's tests/e2e/e2e-env.ts asserts
        // DATABASE_URL is present. Steps 8/9 wire alloc.url into their own
        // pwEnv, but step 10 previously relied on process.env — which does
        // NOT contain DATABASE_URL because applyEnvToProcess ran before
        // allocate-db assigned alloc.url. Pass the disposable-DB URL
        // explicitly so tests hit the SAME database the seed populated.
        DATABASE_URL: alloc!.url,
        // Phase 0C.2 §11 (fix f) — html reporter's default behaviour opens the
        // HTML report on failure and BLOCKS the process ("Serving HTML report
        // at http://localhost:9323. Press Ctrl+C to quit."). In the governed
        // lifecycle that hangs the orchestrator after step 10 so cleanup
        // (stop-server / drop-db / verify-port-release) never runs. Set the
        // official opt-out env var so playwright exits immediately after
        // producing the report on disk.
        PW_TEST_HTML_REPORT_OPEN: 'never',
        UE_TEST_BASE_URL: `http://localhost:${port}`,
        PLAYWRIGHT_PORT: String(port),
        // Phase 0C.2 §5 — tells playwright.config.ts NOT to spawn its own
        // webServer AND lets any downstream code that cares consult the
        // managed-server flag / runId.
        [MANAGED_SERVER_ENV_VAR]: 'true',
        [MANAGED_SERVER_RUN_ID_ENV_VAR]: alloc!.runId,
      }
      // Phase 0C.2 §BR-6 — Optional project filter for targeted batches.
      // Set PLAYWRIGHT_PROJECTS to a comma- or whitespace-separated list of
      // project names from PLAYWRIGHT_PROJECT_MANIFEST (see playwright.config.ts)
      // to scope this run to specific projects, e.g.:
      //   PLAYWRIGHT_PROJECTS=setup,public pnpm --filter @nzila/union-eyes e2e:governed
      //   PLAYWRIGHT_PROJECTS='setup admin' ...
      // When set, the runner injects `--project <name>` arguments for each entry
      // (Playwright accepts repeated --project flags, ANDed by union). When
      // absent or empty, all wired projects run (existing behaviour).
      // This is the primary mechanism for §BR-6 targeted batches A-F and the
      // §BR-8 per-project independent-validation acceptance checks. NO baseline
      // is rewritten — the governed lifecycle still owns preflight, DB alloc,
      // seed, server boot, auth-state generation, artifact copy, and teardown.
      const projectFilter = parseProjectFilter(process.env.PLAYWRIGHT_PROJECTS)
      const playwrightArgs = ['exec', 'playwright', 'test']
      for (const projectName of projectFilter) {
        playwrightArgs.push('--project', projectName)
      }
      if (projectFilter.length > 0) {
        log(`  playwright project filter: ${projectFilter.join(', ')}`)
      }
      const res = spawnSync(
        'pnpm',
        playwrightArgs,
        {
          cwd: APP_ROOT,
          env: pwEnv,
          stdio: 'inherit',
          shell: process.platform === 'win32',
        },
      )
      playwrightExit = typeof res.status === 'number' ? res.status : 1
      const filterSummary =
        projectFilter.length > 0 ? ` projects=[${projectFilter.join(',')}]` : ''
      return {
        detail: `exitCode=${playwrightExit}${filterSummary}`,
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
    // Step 12 — Stop server (always attempted).
    //
    // Phase 0C.2 §11 (fix c) — Previously gated on `if (boot)`, but `boot`
    // is only assigned when withStep RETURNS a value. If readiness fails,
    // withStep throws BEFORE the return, so `boot` stays null even though
    // bootServer() already spawned a child and wrote pid.json. That
    // orphaned the Next.js process on port 3002 across runs, producing
    // EADDRINUSE on the next attempt.
    //
    // Fix: always call stopServer(). It internally reads pid.json and
    // returns { method: 'no-record' } as a no-op when no server is
    // tracked, so calling it unconditionally is safe.
    try {
      const stop = await stopServer({ gracefulTimeoutMs: 10_000 })
      const outcome = stop.method === 'no-record' ? 'skipped' : 'ok'
      steps.push({ step: 12, id: 'stop-server', outcome, detail: `method=${stop.method}`, elapsedMs: 0 })
      log(`${outcome === 'ok' ? '✔' : '⚠'} step 12: stop-server (${stop.method})`)
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

// Phase 0C.2 §BR-6 — guard the top-level invocation so that importing this
// module (e.g. the `parseProjectFilter` regression guard at
// `apps/union-eyes/tests/lifecycle-project-filter.test.ts`) does NOT trigger
// the orchestrator. tsx compiles this file to CommonJS at runtime, so
// `require.main === module` is the reliable check. Under vitest, `require`
// exists in the CJS-emitted output and points at the test worker's main
// module, so this branch is skipped during unit tests.
if (require.main === module) {
  main().catch((err) => {
    // Defensive — main() has its own try/finally, but if something escaped:
    // eslint-disable-next-line no-console
    console.error('[e2e:governed] fatal (unhandled):', err)
    process.exit(3)
  })
}
