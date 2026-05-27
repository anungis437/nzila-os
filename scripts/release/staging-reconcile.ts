/**
 * staging-reconcile.ts
 *
 * Phase 7/9 — "Clean Slate" Orchestration.
 *
 * Reads drift signal files (version drift, env drift, smoke) and produces a
 * concrete reconcile plan: which apps need redeployment, which have env gaps,
 * and the exact `az containerapp update` commands to run.
 *
 * By default this is a DRY RUN — it prints the reconcile plan and writes
 * the plan JSON to ops/reconcile/. Pass --execute to actually apply.
 * Pass --run-smoke to execute a smoke check after reconciliation.
 *
 * Usage:
 *   pnpm exec tsx scripts/release/staging-reconcile.ts --env staging             # dry run — show plan
 *   pnpm exec tsx scripts/release/staging-reconcile.ts --env staging --execute   # apply commands (requires az login)
 *   pnpm exec tsx scripts/release/staging-reconcile.ts --env staging --run-smoke # dry run + post-smoke check
 *
 * Output:
 *   ops/reconcile/staging-reconcile-plan-<timestamp>.json
 *   ops/reconcile/staging-reconcile-plan-latest.json
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const OPS = path.join(ROOT, 'ops')
const ACR = 'nzilacanadaacr.azurecr.io'

// Module-level path constants — never derived from user input
const VERSION_DRIFT_PATH = path.join(OPS, 'drift', 'version-drift-staging-latest.json')
const ENV_DRIFT_PATH = path.join(OPS, 'drift', 'env-drift-staging-latest.json')
const SMOKE_LATEST_PATH = path.join(OPS, 'smoke', 'smoke-staging-latest.json')
const RECONCILE_DIR = path.join(OPS, 'reconcile')
const STAGING_DOMAIN = 'jollydune-88c1e97f.canadacentral.azurecontainerapps.io'

// ── Types ─────────────────────────────────────────────────────────────────────
type AppAction =
  | 'redeploy'   // stale image — needs image update
  | 'fix-env'    // env gap — needs set-env-vars update
  | 'redeploy+env' // both
  | 'ok'         // nothing to do
  | 'investigate' // unreachable / error state — can't auto-fix

type ReconcileStep = {
  app: string
  action: AppAction
  reason: string[]
  commands: string[]
  riskLevel: 'safe' | 'caution' | 'manual'
}

type ReconcilePlan = {
  timestamp: string
  environment: string
  headSha: string
  totalApps: number
  stepsRequired: number
  steps: ReconcileStep[]
  dryRun: boolean
  summary: {
    appsNeedingRedeploy: string[]
    appsWithEnvGaps: string[]
    appsInvestigateRequired: string[]
    appsOk: string[]
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function readSmokeLatest(): Record<string, unknown> | null {
  if (!fs.existsSync(SMOKE_LATEST_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(SMOKE_LATEST_PATH, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function getHeadSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return child_process.execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim()
  } catch {
    return 'unknown'
  }
}

function flagExists(name: string): boolean {
  return process.argv.includes(name)
}

function runCmd(cmd: string, dryRun: boolean): { ok: boolean; output: string } {
  if (dryRun) return { ok: true, output: '[dry-run]' }
  try {
    const out = child_process.execSync(cmd, { encoding: 'utf8', timeout: 60_000 })
    return { ok: true, output: out.trim() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, output: msg }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = !flagExists('--execute')
  const runSmoke = flagExists('--run-smoke')
  const env = 'staging'
  const rg = `nzila-canada-${env}-rg`

  const headSha = getHeadSha()

  console.log(`\nStaging Reconcile Plan — ${env.toUpperCase()}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (pass --execute to apply)' : 'EXECUTE'}`)
  console.log(`HEAD SHA: ${headSha}`)
  console.log(`Resource Group: ${rg}\n`)

  // ── Load drift signals ─────────────────────────────────────────────────────
  type VersionDriftReport = {
    apps: Array<{
      app: string
      driftState: string
      deployedSha?: string
      headSha?: string
      httpStatus?: number
      url?: string
    }>
  }
  type EnvDriftReport = {
    apps: Array<{
      app: string
      hasBlockingGaps: boolean
      missingRequired: string[]
      deprecatedPresent: string[]
    }>
  }

  const versionDrift: VersionDriftReport | null = fs.existsSync(VERSION_DRIFT_PATH)
    ? (() => { try { return JSON.parse(fs.readFileSync(VERSION_DRIFT_PATH, 'utf8')) as VersionDriftReport } catch { return null } })()
    : null
  const envDrift: EnvDriftReport | null = fs.existsSync(ENV_DRIFT_PATH)
    ? (() => { try { return JSON.parse(fs.readFileSync(ENV_DRIFT_PATH, 'utf8')) as EnvDriftReport } catch { return null } })()
    : null
  const smokeReport = readSmokeLatest()

  if (!versionDrift) {
    console.warn('⚠  No version drift report found. Run: pnpm exec tsx scripts/release/drift-version.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr')
  }
  if (!envDrift) {
    console.warn('⚠  No env drift report found. Run: pnpm exec tsx scripts/release/drift-env.ts --env staging')
  }

  // ── Build per-app action map ───────────────────────────────────────────────
  const versionByApp = new Map<string, string>(
    (versionDrift?.apps ?? []).map((a) => [a.app, a.driftState] as [string, string]),
  )
  const envByApp = new Map<string, { hasGaps: boolean; missing: string[] }>(
    (envDrift?.apps ?? []).map((a) => [
      a.app,
      { hasGaps: a.hasBlockingGaps, missing: a.missingRequired },
    ]),
  )

  const allApps = [
    ...new Set([
      ...(versionDrift?.apps ?? []).map((a) => a.app),
      ...(envDrift?.apps ?? []).map((a) => a.app),
    ]),
  ]

  if (allApps.length === 0) {
    // Fallback: use canonical app list
    allApps.push('web', 'console', 'partners', 'union-eyes', 'cfo', 'flow', 'abr')
  }

  const steps: ReconcileStep[] = []
  const appsNeedingRedeploy: string[] = []
  const appsWithEnvGaps: string[] = []
  const appsInvestigateRequired: string[] = []
  const appsOk: string[] = []

  for (const app of allApps) {
    const vState = versionByApp.get(app) ?? 'unknown'
    const envState = envByApp.get(app) ?? { hasGaps: false, missing: [] }

    const needsRedeploy = ['stale', 'unknown_sha', 'not_found'].includes(vState)
    const needsInvestigate = ['server_error', 'unreachable', 'unroutable'].includes(vState)
    const hasEnvGaps = envState.hasGaps

    const reason: string[] = []
    const commands: string[] = []
    let action: AppAction = 'ok'
    let riskLevel: 'safe' | 'caution' | 'manual' = 'safe'

    if (needsInvestigate) {
      action = 'investigate'
      riskLevel = 'manual'
      reason.push(`Version check returned: ${vState} — manual inspection required`)
      reason.push(`Check logs: az containerapp logs show -n nzila-os-${app} -g ${rg} --tail 50`)
      commands.push(`# Manual step: check Container App logs`)
      commands.push(`az containerapp logs show --name nzila-os-${app} --resource-group ${rg} --tail 50`)
      appsInvestigateRequired.push(app)
    } else if (needsRedeploy && hasEnvGaps) {
      action = 'redeploy+env'
      riskLevel = 'caution'
      reason.push(`Version drift: ${vState}`)
      reason.push(`Missing env vars: ${envState.missing.join(', ')}`)
      commands.push(
        `az containerapp update --name nzila-os-${app} --resource-group ${rg} --image ${ACR}/nzila/${app}:${headSha} --set-env-vars NODE_ENV=production NEXT_PUBLIC_APP_ENV=staging`,
      )
      if (envState.missing.length > 0) {
        commands.push(
          `# NOTE: These vars must be set as secrets first: ${envState.missing.join(', ')}`,
        )
        commands.push(
          `# Run: az containerapp secret set --name nzila-os-${app} --resource-group ${rg} --secrets ...`,
        )
      }
      appsNeedingRedeploy.push(app)
      appsWithEnvGaps.push(app)
    } else if (needsRedeploy) {
      action = 'redeploy'
      reason.push(`Version drift: ${vState}`)
      commands.push(
        `az containerapp update --name nzila-os-${app} --resource-group ${rg} --image ${ACR}/nzila/${app}:${headSha} --set-env-vars NODE_ENV=production NEXT_PUBLIC_APP_ENV=staging`,
      )
      appsNeedingRedeploy.push(app)
    } else if (hasEnvGaps) {
      action = 'fix-env'
      riskLevel = 'caution'
      reason.push(`Missing required env vars: ${envState.missing.join(', ')}`)
      commands.push(
        `# Set missing secrets first, then:`,
        `az containerapp update --name nzila-os-${app} --resource-group ${rg} --set-env-vars NODE_ENV=production NEXT_PUBLIC_APP_ENV=staging`,
      )
      appsWithEnvGaps.push(app)
    } else {
      reason.push(`Drift state: ${vState} — no action required`)
      appsOk.push(app)
    }

    steps.push({ app, action, reason, commands, riskLevel })
  }

  // ── Print plan ─────────────────────────────────────────────────────────────
  console.log('Reconcile Plan:')
  for (const step of steps) {
    const icon =
      step.action === 'ok' ? '✓'
        : step.action === 'investigate' ? '?'
        : step.riskLevel === 'caution' ? '⚠'
        : '↻'
    console.log(`\n  ${icon}  ${step.app.padEnd(18)} [${step.action}]`)
    for (const r of step.reason) console.log(`       ${r}`)
    if (step.commands.length > 0 && step.action !== 'ok') {
      console.log(`     Commands:`)
      for (const cmd of step.commands) console.log(`       ${cmd}`)
    }
  }

  console.log(`\n${'─'.repeat(70)}`)
  console.log(`Summary:`)
  console.log(`  Apps needing redeploy: ${appsNeedingRedeploy.join(', ') || 'none'}`)
  console.log(`  Apps with env gaps:    ${appsWithEnvGaps.join(', ') || 'none'}`)
  console.log(`  Apps to investigate:   ${appsInvestigateRequired.join(', ') || 'none'}`)
  console.log(`  Apps OK:               ${appsOk.join(', ') || 'none'}`)
  console.log(`  Total actions needed:  ${steps.filter((s) => s.action !== 'ok').length}`)

  // ── Execute ────────────────────────────────────────────────────────────────
  if (!dryRun) {
    console.log(`\n${'─'.repeat(70)}`)
    console.log('Executing reconcile steps...\n')

    for (const step of steps) {
      if (step.action === 'ok') continue
      if (step.riskLevel === 'manual') {
        console.log(`  ⚠  ${step.app}: manual intervention required — skipping auto-execution`)
        continue
      }

      for (const cmd of step.commands) {
        if (cmd.startsWith('#') || cmd.startsWith('az containerapp secret')) {
          console.log(`  ⬜  ${step.app}: ${cmd}`)
          continue
        }
        console.log(`  → ${cmd}`)
        const result = runCmd(cmd, false)
        if (result.ok) {
          console.log(`     ✓ succeeded`)
        } else {
          console.error(`     ✗ FAILED: ${result.output}`)
        }
      }
    }
  }

  // ── Post-smoke ─────────────────────────────────────────────────────────────
  if (runSmoke && !dryRun) {
    console.log(`\nRunning post-reconcile smoke check...`)
    const smokeScript = path.join(ROOT, 'scripts', 'release', 'run-smoke.ts')
    const result = runCmd(
      `npx tsx "${smokeScript}" --env ${env}`,
      false,
    )
    console.log(result.output)
  }

  // ── Write plan ─────────────────────────────────────────────────────────────
  const plan: ReconcilePlan = {
    timestamp: new Date().toISOString(),
    environment: env,
    headSha,
    totalApps: allApps.length,
    stepsRequired: steps.filter((s) => s.action !== 'ok').length,
    steps,
    dryRun,
    summary: {
      appsNeedingRedeploy,
      appsWithEnvGaps,
      appsInvestigateRequired,
      appsOk,
    },
  }

  const outDir = path.join(OPS, 'reconcile')
  fs.mkdirSync(outDir, { recursive: true })
  const timestampedPath = path.join(outDir, `staging-reconcile-plan-${Date.now()}.json`)
  const latestPath = path.join(outDir, 'staging-reconcile-plan-latest.json')
  fs.writeFileSync(timestampedPath, JSON.stringify(plan, null, 2), 'utf8')
  fs.writeFileSync(latestPath, JSON.stringify(plan, null, 2), 'utf8')

  console.log(`\nPlan written: ${path.relative(ROOT, timestampedPath)}`)
  console.log(`Latest:       ${path.relative(ROOT, latestPath)}`)

  if (dryRun && (appsNeedingRedeploy.length > 0 || appsWithEnvGaps.length > 0)) {
    console.log(
      `\nTo execute: pnpm exec tsx scripts/release/staging-reconcile.ts --env staging --execute`,
    )
    console.log(`Or trigger: gh workflow run gitops-deploy.yml`)
  }

  const stageOk =
    appsNeedingRedeploy.length === 0 &&
    appsWithEnvGaps.length === 0 &&
    appsInvestigateRequired.length === 0

  if (!stageOk) process.exit(dryRun ? 0 : 1) // dry run always exits 0
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
