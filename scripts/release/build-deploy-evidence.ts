/**
 * build-deploy-evidence.ts
 *
 * Phase 10 — Deployment Evidence Pack
 *
 * Generates an append-only deployment evidence record after each staging deploy.
 * Includes: deployed apps, artifact IDs, git SHAs, timestamps, smoke results,
 * failing apps, drift delta vs prior deploy, and promotion readiness verdict.
 *
 * Usage:
 *   pnpm exec tsx scripts/release/build-deploy-evidence.ts --env staging
 *   tsx scripts/release/build-deploy-evidence.ts [--env staging]
 *
 * Output:
 *   ops/evidence/deploy-evidence-<timestamp>.json   (new record each run)
 *   ops/evidence/deploy-evidence-ledger.json         (append-only ledger)
 *   ops/evidence/deploy-evidence-latest.json         (latest snapshot)
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const OPS = path.join(ROOT, 'ops')

// Module-level path constants — never derived from user input
const DRIFT_DIR = path.join(OPS, 'drift')
const SMOKE_DIR = path.join(OPS, 'smoke')
const EVIDENCE_DIR = path.join(OPS, 'evidence')
const LEDGER_PATH = path.join(EVIDENCE_DIR, 'deploy-evidence-ledger.json')
const VERSION_DRIFT_LATEST = path.join(DRIFT_DIR, 'version-drift-staging-latest.json')
const ENV_DRIFT_LATEST = path.join(DRIFT_DIR, 'env-drift-staging-latest.json')
const SMOKE_LATEST = path.join(SMOKE_DIR, 'smoke-staging-latest.json')

// ── Types ─────────────────────────────────────────────────────────────────────
type EvidenceRecord = {
  evidenceId: string
  timestamp: string
  environment: string
  gitSha: string
  gitRef: string
  deployedApps: AppEvidenceEntry[]
  smokeResult: SmokeResult | null
  driftDelta: DriftDelta | null
  promotionVerdict: 'ready' | 'not-ready' | 'partial' | 'unknown'
  promotionBlockers: string[]
  overallHealthScore: number
  overallDriftScore: number
}

type AppEvidenceEntry = {
  app: string
  image: string
  imageTag: string
  artifactId: string
  versionDriftState: string
  envDriftScore: number
  hasEnvGaps: boolean
  smokeTriad: {
    health: number | null
    ready: number | null
    version: number | null
  }
}

type SmokeResult = {
  totalApps: number
  healthyApps: number
  failedApps: string[]
  healthScore: number
}

type DriftDelta = {
  previousSha: string | null
  previousTimestamp: string | null
  appsImproved: string[]
  appsRegressed: string[]
  netDelta: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getHeadSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return child_process.execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 5000 }).trim()
  } catch {
    return 'unknown'
  }
}

function getGitRef(): string {
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME
  try {
    return child_process
      .execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', timeout: 5000 })
      .trim()
  } catch {
    return 'unknown'
  }
}

// (No generic readJson helper needed — all reads are inlined with module-level path constants.)

function parseArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name)
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]
  return fallback
}

function generateEvidenceId(sha: string, ts: number): string {
  return `ev-${sha.slice(0, 8)}-${ts}`
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const env = parseArg('--env', 'staging')

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })

  const headSha = getHeadSha()
  const gitRef = getGitRef()
  const now = Date.now()
  const evidenceId = generateEvidenceId(headSha, now)

  console.log(`\nBuilding Deployment Evidence Pack`)
  console.log(`  Evidence ID: ${evidenceId}`)
  console.log(`  Git SHA:     ${headSha}`)
  console.log(`  Ref:         ${gitRef}`)
  console.log(`  Environment: ${env}\n`)

  // ── Load drift signals ─────────────────────────────────────────────────────
  type VersionDriftReport = {
    results: Array<{
      app: string
      driftState: string
      deployedSha?: string
      httpStatus?: number
    }>
    driftScore: number
  }
  type EnvDriftReport = {
    apps: Array<{
      app: string
      envDriftScore: number
      hasBlockingGaps: boolean
      missingRequired: string[]
    }>
    overallEnvDriftScore: number
  }
  type SmokeReport = {
    results?: Array<{
      app: string
      ok: boolean
      probes?: Array<{ endpoint: string; status: number; ok: boolean }>
    }>
    appsChecked?: number
    passed?: number
    failed?: number
  }

  const versionDrift: VersionDriftReport | null = (() => {
    if (!fs.existsSync(VERSION_DRIFT_LATEST)) return null
    try { return JSON.parse(fs.readFileSync(VERSION_DRIFT_LATEST, 'utf8')) as VersionDriftReport } catch { return null }
  })()
  const envDrift: EnvDriftReport | null = (() => {
    if (!fs.existsSync(ENV_DRIFT_LATEST)) return null
    try { return JSON.parse(fs.readFileSync(ENV_DRIFT_LATEST, 'utf8')) as EnvDriftReport } catch { return null }
  })()
  const smokeRaw: SmokeReport | null = (() => {
    if (!fs.existsSync(SMOKE_LATEST)) return null
    try { return JSON.parse(fs.readFileSync(SMOKE_LATEST, 'utf8')) as SmokeReport } catch { return null }
  })()

  // ── Prior ledger for delta ─────────────────────────────────────────────────
  const ledger: { entries: EvidenceRecord[] } = (() => {
    if (!fs.existsSync(LEDGER_PATH)) return { entries: [] }
    try { return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')) as { entries: EvidenceRecord[] } } catch { return { entries: [] } }
  })()
  const prevEntry = ledger.entries.at(-1) ?? null

  // ── Build per-app entries ──────────────────────────────────────────────────
  const ACR = 'nzilacanadaacr.azurecr.io'
  const allApps = [
    ...new Set([
      ...(versionDrift?.results ?? []).map((a) => a.app),
      ...(envDrift?.apps ?? []).map((a) => a.app),
    ]),
  ]
  if (allApps.length === 0) {
    allApps.push('web', 'console', 'partners', 'union-eyes', 'cfo', 'flow', 'abr')
  }

  const vByApp = new Map(
    (versionDrift?.results ?? []).map((a) => [a.app, a]),
  )
  const eByApp = new Map(
    (envDrift?.apps ?? []).map((a) => [a.app, a]),
  )
  const smokeByApp = new Map(
    (smokeRaw?.results ?? []).map((r) => [r.app, r]),
  )

  const deployedApps: AppEvidenceEntry[] = allApps.map((app) => {
    const v = vByApp.get(app)
    const e = eByApp.get(app)
    const s = smokeByApp.get(app)

    const healthProbe = s?.probes?.find((p) => p.endpoint === 'health')
    const readyProbe = s?.probes?.find((p) => p.endpoint === 'ready')
    const versionProbe = s?.probes?.find((p) => p.endpoint === 'version')

    return {
      app,
      image: `${ACR}/nzila/${app}:${headSha}`,
      imageTag: headSha,
      artifactId: `${headSha}-${app}`,
      versionDriftState: v?.driftState ?? 'unknown',
      envDriftScore: e?.envDriftScore ?? 0,
      hasEnvGaps: e?.hasBlockingGaps ?? false,
      smokeTriad: {
        health: healthProbe?.status ?? null,
        ready: readyProbe?.status ?? null,
        version: versionProbe?.status ?? null,
      },
    }
  })

  // ── Smoke result ───────────────────────────────────────────────────────────
  const smokeResult: SmokeResult | null = smokeRaw
    ? {
        totalApps: allApps.length,
        healthyApps: allApps.filter((app) => {
          const v = vByApp.get(app)
          return v?.driftState === 'current'
        }).length,
        failedApps: (smokeRaw.results ?? []).filter((r) => !r.ok).map((r) => r.app),
        healthScore:
          smokeRaw.appsChecked && smokeRaw.appsChecked > 0
            ? Math.round(((smokeRaw.passed ?? 0) / smokeRaw.appsChecked) * 100)
            : 0,
      }
    : null

  // ── Drift delta ─────────────────────────────────────────────────────────────
  let driftDelta: DriftDelta | null = null
  if (prevEntry) {
    const prevByApp = new Map(prevEntry.deployedApps.map((a) => [a.app, a]))
    const improved: string[] = []
    const regressed: string[] = []

    for (const app of allApps) {
      const prev = prevByApp.get(app)
      const curr = deployedApps.find((d) => d.app === app)
      if (!prev || !curr) continue

      const prevOk =
        prev.versionDriftState === 'current' && !prev.hasEnvGaps
      const currOk =
        curr.versionDriftState === 'current' && !curr.hasEnvGaps

      if (!prevOk && currOk) improved.push(app)
      if (prevOk && !currOk) regressed.push(app)
    }

    driftDelta = {
      previousSha: prevEntry.gitSha,
      previousTimestamp: prevEntry.timestamp,
      appsImproved: improved,
      appsRegressed: regressed,
      netDelta: improved.length - regressed.length,
    }
  }

  // ── Promotion verdict ──────────────────────────────────────────────────────
  const promotionBlockers: string[] = []
  const appsWithGaps = deployedApps.filter((a) => a.hasEnvGaps)
  const appsStale = deployedApps.filter(
    (a) => !['current', 'ok'].includes(a.versionDriftState),
  )
  const appsUnhealthy = deployedApps.filter((a) => a.smokeTriad.health !== 200)

  if (appsStale.length > 0)
    promotionBlockers.push(
      `${appsStale.length} app(s) stale: ${appsStale.map((a) => a.app).join(', ')}`,
    )
  if (appsWithGaps.length > 0)
    promotionBlockers.push(
      `${appsWithGaps.length} app(s) have env gaps: ${appsWithGaps.map((a) => a.app).join(', ')}`,
    )
  if (appsUnhealthy.length > 0)
    promotionBlockers.push(
      `${appsUnhealthy.length} app(s) unhealthy: ${appsUnhealthy.map((a) => a.app).join(', ')}`,
    )

  const promotionVerdict: EvidenceRecord['promotionVerdict'] =
    promotionBlockers.length === 0
      ? 'ready'
      : appsStale.length === allApps.length
        ? 'not-ready'
        : 'partial'

  const overallHealthScore =
    allApps.length > 0
      ? Math.round(
          (deployedApps.filter((a) => a.smokeTriad.health === 200).length / allApps.length) * 100,
        )
      : 0
  const overallDriftScore = versionDrift?.driftScore ?? 0

  const record: EvidenceRecord = {
    evidenceId,
    timestamp: new Date().toISOString(),
    environment: env,
    gitSha: headSha,
    gitRef,
    deployedApps,
    smokeResult,
    driftDelta,
    promotionVerdict,
    promotionBlockers,
    overallHealthScore,
    overallDriftScore,
  }

  // ── Print verdict ───────────────────────────────────────────────────────────
  const verdictIcon =
    promotionVerdict === 'ready'
      ? '✅'
      : promotionVerdict === 'partial'
        ? '⚠️'
        : '❌'

  console.log(`Evidence Summary:`)
  console.log(`  ${verdictIcon} Promotion verdict: ${promotionVerdict.toUpperCase()}`)
  console.log(`  Health score: ${overallHealthScore}%`)
  console.log(`  Version drift score: ${overallDriftScore}%`)
  if (promotionBlockers.length > 0) {
    console.log(`\nBlockers:`)
    for (const b of promotionBlockers) console.log(`  • ${b}`)
  }
  if (driftDelta) {
    console.log(`\nDrift delta vs ${driftDelta.previousSha?.slice(0, 8)}:`)
    console.log(
      `  Improved: ${driftDelta.appsImproved.join(', ') || 'none'}   Regressed: ${driftDelta.appsRegressed.join(', ') || 'none'}`,
    )
  }

  // ── Write evidence files ───────────────────────────────────────────────────
  const tsPath = path.join(EVIDENCE_DIR, `deploy-evidence-${now}.json`)
  const latestPath = path.join(EVIDENCE_DIR, 'deploy-evidence-latest.json')

  fs.writeFileSync(tsPath, JSON.stringify(record, null, 2), 'utf8')
  fs.writeFileSync(latestPath, JSON.stringify(record, null, 2), 'utf8')

  // Append to ledger (append-only)
  ledger.entries.push(record)
  // Keep at most 50 entries to avoid unbounded growth
  if (ledger.entries.length > 50) ledger.entries = ledger.entries.slice(-50)
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf8')

  console.log(`\nEvidence written:`)
  console.log(`  Record:  ${path.relative(ROOT, tsPath)}`)
  console.log(`  Latest:  ${path.relative(ROOT, latestPath)}`)
  console.log(`  Ledger:  ${path.relative(ROOT, LEDGER_PATH)} (${ledger.entries.length} entries)`)

  if (promotionVerdict === 'not-ready') process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
