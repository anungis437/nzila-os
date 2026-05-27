/**
 * drift-version.ts
 *
 * Compares the deployed git SHA on each staging app's /version endpoint against
 * the current repo HEAD, producing a per-app drift report with scores.
 *
 * Usage:
 *   pnpm exec tsx scripts/release/drift-version.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr
 *   pnpm tsx scripts/release/drift-version.ts [--env staging] [--apps web,console,...] [--timeout-ms 10000]
 *
 * Output:
 *   ops/drift/version-drift-<env>-latest.json
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')

type Inventory = {
  apps: Record<string, {
    routing?: {
      staging?: string
      production?: string
      healthPath?: string
      versionPath?: string
    }
    owners?: string[]
    tier?: string
    releaseStatus?: string
  }>
}

type VersionPayload = {
  app?: string
  gitSha?: string
  buildTimestamp?: string
  artifactId?: string
  releaseId?: string
  environment?: string
  appVersion?: string
  timestamp?: string
}

type DriftState =
  | 'current'       // deployed SHA matches HEAD
  | 'stale'         // deployed SHA differs from HEAD
  | 'unknown_sha'   // app responded but gitSha is "local" or "unknown"
  | 'unreachable'   // endpoint did not respond
  | 'not_found'     // 404 — version endpoint missing
  | 'server_error'  // 5xx
  | 'unroutable'    // no staging host in inventory

type AppVersionResult = {
  app: string
  host: string
  driftState: DriftState
  deployedSha?: string
  headSha: string
  shaMatch: boolean
  deployedEnvironment?: string
  deployedBuildTimestamp?: string
  deployedArtifactId?: string
  httpStatus?: number
  durationMs: number
  error?: string
  owner: string[]
  tier: string
}

function parseArg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1]
  }
  if (fallback !== undefined) return fallback
  throw new Error(`Missing required argument: ${name}`)
}

function getHeadSha(): string {
  try {
    return child_process.execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return process.env.GITHUB_SHA ?? 'unknown'
  }
}

function getHeadShortSha(headSha: string): string {
  return headSha === 'unknown' ? 'unknown' : headSha.slice(0, 8)
}

async function fetchVersion(url: string, timeoutMs: number): Promise<{ status: number; body: unknown; durationMs: number; error?: string }> {
  const started = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { Accept: 'application/json' },
    })

    const durationMs = Date.now() - started
    let body: unknown = null

    try {
      body = await response.json()
    } catch {
      body = null
    }

    return { status: response.status, body, durationMs }
  } catch (error) {
    return {
      status: 0,
      body: null,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function classifyDrift(
  httpStatus: number,
  body: unknown,
  headSha: string,
  error?: string,
): { driftState: DriftState; deployedSha?: string; shaMatch: boolean } {
  if (error || httpStatus === 0) {
    return { driftState: 'unreachable', shaMatch: false }
  }
  if (httpStatus === 404) {
    return { driftState: 'not_found', shaMatch: false }
  }
  if (httpStatus >= 500) {
    return { driftState: 'server_error', shaMatch: false }
  }
  if (httpStatus !== 200) {
    return { driftState: 'unreachable', shaMatch: false }
  }

  const payload = body as VersionPayload | null
  if (!payload || typeof payload !== 'object') {
    return { driftState: 'unreachable', shaMatch: false }
  }

  const deployedSha = payload.gitSha?.trim() ?? ''

  if (!deployedSha || deployedSha === 'local' || deployedSha === 'unknown') {
    return { driftState: 'unknown_sha', deployedSha, shaMatch: false }
  }

  // Compare: both could be full SHA or short SHA — normalize to 8 chars if lengths differ
  const normalizedDeployed = deployedSha.length > 8 ? deployedSha : deployedSha
  const normalizedHead = headSha.length > 8 ? headSha : headSha

  // Full SHA equality
  if (normalizedDeployed === normalizedHead) {
    return { driftState: 'current', deployedSha, shaMatch: true }
  }

  // Prefix match: deployed short SHA matches head prefix or vice versa
  const shorter = normalizedDeployed.length < normalizedHead.length ? normalizedDeployed : normalizedHead
  const longer = normalizedDeployed.length >= normalizedHead.length ? normalizedDeployed : normalizedHead
  if (longer.startsWith(shorter)) {
    return { driftState: 'current', deployedSha, shaMatch: true }
  }

  return { driftState: 'stale', deployedSha, shaMatch: false }
}

async function main() {
  const env = parseArg('--env', 'staging')
  const appsArg = parseArg('--apps', 'web,console,partners,union-eyes,cfo,flow,abr')
  const requestedApps = appsArg.split(',').map((a) => a.trim()).filter(Boolean)
  const timeoutMs = Number(parseArg('--timeout-ms', '10000'))

  const headSha = getHeadSha()
  const headShortSha = getHeadShortSha(headSha)

  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as Inventory

  console.log(`\nVersion Drift Audit — ${env.toUpperCase()}`)
  console.log(`Repo HEAD:  ${headSha}`)
  console.log(`Short SHA:  ${headShortSha}`)
  console.log(`Apps:       ${requestedApps.join(', ')}\n`)

  const results: AppVersionResult[] = []

  for (const app of requestedApps) {
    const cfg = inventory.apps[app]

    if (!cfg) {
      results.push({
        app,
        host: 'n/a',
        driftState: 'unroutable',
        headSha,
        shaMatch: false,
        durationMs: 0,
        error: 'app not found in deployment-inventory.json',
        owner: [],
        tier: 'unknown',
      })
      continue
    }

    const host = env === 'production' ? cfg.routing?.production : cfg.routing?.staging

    if (!host || host === 'n/a' || host === 'blocked' || host === 'pilot-only') {
      results.push({
        app,
        host: host ?? 'n/a',
        driftState: 'unroutable',
        headSha,
        shaMatch: false,
        durationMs: 0,
        error: `no routable host for ${env}`,
        owner: cfg.owners ?? [],
        tier: cfg.tier ?? 'unknown',
      })
      continue
    }

    const versionPath = cfg.routing?.versionPath ?? '/api/version'
    const url = `${host}${versionPath}`

    process.stdout.write(`  ${app.padEnd(18)} → ${url} ... `)
    const { status, body, durationMs, error } = await fetchVersion(url, timeoutMs)

    const { driftState, deployedSha, shaMatch } = classifyDrift(status, body, headSha, error)

    const payload = body as VersionPayload | null

    const icon = driftState === 'current' ? '✓' : driftState === 'unknown_sha' ? '?' : '✗'
    const shaDisplay = deployedSha ? deployedSha.slice(0, 8) : '-------'
    const stateLabel = driftState.toUpperCase().padEnd(12)

    console.log(`${icon}  [${stateLabel}]  deployed=${shaDisplay}  head=${headShortSha}  (${durationMs}ms)`)

    results.push({
      app,
      host,
      driftState,
      deployedSha,
      headSha,
      shaMatch,
      deployedEnvironment: payload?.environment,
      deployedBuildTimestamp: payload?.buildTimestamp,
      deployedArtifactId: payload?.artifactId,
      httpStatus: status,
      durationMs,
      error,
      owner: cfg.owners ?? [],
      tier: cfg.tier ?? 'unknown',
    })
  }

  // Compute scores
  const total = results.length
  const current = results.filter((r) => r.driftState === 'current').length
  const stale = results.filter((r) => r.driftState === 'stale').length
  const unknownSha = results.filter((r) => r.driftState === 'unknown_sha').length
  const unreachable = results.filter((r) => ['unreachable', 'not_found', 'server_error', 'unroutable'].includes(r.driftState)).length

  const driftScore = total > 0 ? Math.round((current / total) * 100) : 0
  const stalenessScore = total > 0 ? Math.round(((total - stale) / total) * 100) : 100

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Drift Score:     ${driftScore}%  (${current}/${total} apps current)`)
  console.log(`Staleness Score: ${stalenessScore}%  (${stale} stale, ${unknownSha} unknown SHA, ${unreachable} unreachable)`)

  if (stale > 0) {
    console.log(`\nStale apps requiring redeployment:`)
    results.filter((r) => r.driftState === 'stale').forEach((r) => {
      console.log(`  → ${r.app}  (deployed: ${r.deployedSha?.slice(0, 8) ?? '?'}  head: ${headShortSha})`)
    })
  }

  if (unreachable > 0) {
    console.log(`\nUnreachable / missing version route:`)
    results.filter((r) => ['unreachable', 'not_found', 'server_error', 'unroutable'].includes(r.driftState)).forEach((r) => {
      console.log(`  → ${r.app}  [${r.driftState}]  ${r.error ?? ''}`)
    })
  }

  const report = {
    timestamp: new Date().toISOString(),
    environment: env,
    headSha,
    headShortSha,
    appsChecked: total,
    current,
    stale,
    unknownSha,
    unreachable,
    driftScore,
    stalenessScore,
    results,
  }

  const outDir = path.join(ROOT, 'ops', 'drift')
  fs.mkdirSync(outDir, { recursive: true })
  const timestampedPath = path.join(outDir, `version-drift-${env}-${Date.now()}.json`)
  const latestPath = path.join(outDir, `version-drift-${env}-latest.json`)
  fs.writeFileSync(timestampedPath, JSON.stringify(report, null, 2), 'utf8')
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(`\nReport written: ${path.relative(ROOT, timestampedPath)}`)
  console.log(`Latest updated: ${path.relative(ROOT, latestPath)}`)

  if (driftScore < 100) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
