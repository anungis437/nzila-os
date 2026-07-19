#!/usr/bin/env node
/**
 * Transactional production promotion with automated rollback evidence.
 *
 * Usage:
 *   pnpm tsx scripts/deploy-transactional.ts \
 *     --manifest staging-artifacts/artifact-manifest.json \
 *     --resource-group <rg>
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'

type DeployTarget = {
  containerAppName: string
  image: string
  healthUrl?: string
  healthPath?: string
  expectedBodyContains?: string
}

type TargetState = {
  appName: string
  previousImage: string
  previousRevision: string | null
  newImage: string
}

type HealthCheckResult = {
  appName: string
  url: string
  attempts: number
  ok: boolean
  statusCode?: number
  lastError?: string
}

type ParsedArgs = {
  manifest: string
  resourceGroup: string
  healthAttempts: number
  healthDelayMs: number
  healthTimeoutMs: number
  evidenceOut: string
  fallbackTargetsJson?: string
  requireDigestPinned: boolean
}

// BR-5 defense-in-depth: a production deploy target must reference an immutable
// image digest, never a mutable tag. This mirrors the workflow-level gate so the
// promotion script is fail-closed even if invoked directly.
const DIGEST_PINNED_RE = /@sha256:[0-9a-f]{64}$/

function parseArgs(argv: string[]): ParsedArgs {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    args[key] = value
    i += 1
  }

  const resourceGroup = args['resource-group'] ?? process.env.AZURE_RESOURCE_GROUP
  if (!resourceGroup) {
    throw new Error('Missing --resource-group (or AZURE_RESOURCE_GROUP env var)')
  }

  // Require immutable digest pinning when explicitly requested, or by default
  // whenever the target resource group is a production group. Opt-out is only
  // possible by passing --require-digest-pinned false for a non-production group.
  const requireFlag = args['require-digest-pinned']
  const isProdGroup = /(^|[-_])prod($|[-_])/i.test(resourceGroup)
  const requireDigestPinned = requireFlag !== undefined ? requireFlag === 'true' : isProdGroup

  return {
    manifest: resolve(args.manifest ?? 'staging-artifacts/artifact-manifest.json'),
    resourceGroup,
    healthAttempts: Number(args['health-attempts'] ?? 8),
    healthDelayMs: Number(args['health-delay-ms'] ?? 5000),
    healthTimeoutMs: Number(args['health-timeout-ms'] ?? 15000),
    evidenceOut: resolve(args['evidence-out'] ?? `ops/deploy-evidence/production-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    fallbackTargetsJson: args['fallback-targets-json'] ?? process.env.PRODUCTION_DEPLOY_TARGETS_JSON,
    requireDigestPinned,
  }
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function runJsonCommand(command: string): unknown {
  const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return JSON.parse(output)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function parseManifestTargets(manifestPath: string, fallbackTargetsJson?: string, requireDigestPinned = false): DeployTarget[] {
  const manifestRaw = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestRaw) as { deployTargets?: unknown[]; apps?: unknown[] }
  const rawTargets = Array.isArray(manifest.deployTargets)
    ? manifest.deployTargets
    : Array.isArray(manifest.apps)
      ? manifest.apps
      : []

  const sourceTargets = rawTargets.length > 0
    ? rawTargets
    : fallbackTargetsJson
      ? JSON.parse(fallbackTargetsJson)
      : []

  ensure(Array.isArray(sourceTargets) && sourceTargets.length > 0, 'No deploy targets found in artifact manifest and no fallback targets provided')

  const targets: DeployTarget[] = []
  for (const raw of sourceTargets as Record<string, unknown>[]) {
    const appName = String(raw.containerAppName ?? raw.app ?? raw.name ?? '').trim()
    const image = String(raw.image ?? raw.imageRef ?? raw.digest ?? '').trim()
    ensure(appName.length > 0, `Deploy target missing containerAppName/app/name: ${JSON.stringify(raw)}`)
    ensure(image.length > 0, `Deploy target ${appName} missing image/imageRef/digest`)
    ensure(
      !requireDigestPinned || DIGEST_PINNED_RE.test(image),
      `BR-5: deploy target ${appName} image '${image}' is not pinned to an immutable @sha256 digest. ` +
        `A mutable tag is not accepted for production promotion. Provide an @sha256-pinned image reference.`,
    )

    targets.push({
      containerAppName: appName,
      image,
      healthUrl: raw.healthUrl ? String(raw.healthUrl) : undefined,
      healthPath: raw.healthPath ? String(raw.healthPath) : undefined,
      expectedBodyContains: raw.expectedBodyContains ? String(raw.expectedBodyContains) : undefined,
    })
  }

  return targets
}

function captureCurrentState(target: DeployTarget, resourceGroup: string): TargetState {
  const details = runJsonCommand(`az containerapp show --name "${target.containerAppName}" --resource-group "${resourceGroup}" --output json`)
  const previousImage = details?.properties?.template?.containers?.[0]?.image
  ensure(previousImage, `Unable to resolve current image for ${target.containerAppName}`)

  const previousRevision: string | null = details?.properties?.latestReadyRevisionName ?? null
  return {
    appName: target.containerAppName,
    previousImage: String(previousImage),
    previousRevision,
    newImage: target.image,
  }
}

async function runHealthCheck(target: DeployTarget, args: ParsedArgs, resourceGroup: string): Promise<HealthCheckResult> {
  const defaultHealthPath = target.healthPath ?? '/api/health'
  let url = target.healthUrl

  if (!url) {
    const app = runJsonCommand(`az containerapp show --name "${target.containerAppName}" --resource-group "${resourceGroup}" --output json`)
    const fqdn = app?.properties?.configuration?.ingress?.fqdn
    ensure(fqdn, `No ingress FQDN found for ${target.containerAppName}; provide healthUrl in deploy target`)
    url = `https://${fqdn}${defaultHealthPath}`
  }

  let lastError = ''
  let statusCode: number | undefined
  for (let attempt = 1; attempt <= args.healthAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), args.healthTimeoutMs)

    try {
      const response = await fetch(url, { signal: controller.signal })
      statusCode = response.status
      const body = await response.text()
      const hasExpectedBody = !target.expectedBodyContains || body.includes(target.expectedBodyContains)

      if (response.ok && hasExpectedBody) {
        return {
          appName: target.containerAppName,
          url,
          attempts: attempt,
          ok: true,
          statusCode,
        }
      }

      lastError = `HTTP ${response.status}${hasExpectedBody ? '' : ` (missing expected body marker: ${target.expectedBodyContains})`}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    } finally {
      clearTimeout(timeout)
    }

    if (attempt < args.healthAttempts) {
      await sleep(args.healthDelayMs)
    }
  }

  return {
    appName: target.containerAppName,
    url,
    attempts: args.healthAttempts,
    ok: false,
    statusCode,
    lastError,
  }
}

function rollback(updatedStates: TargetState[], resourceGroup: string): void {
  for (const state of [...updatedStates].reverse()) {
    console.log(`Rolling back ${state.appName} -> ${state.previousImage}`)
    execSync(
      `az containerapp update --name "${state.appName}" --resource-group "${resourceGroup}" --image "${state.previousImage}" --output none`,
      { stdio: 'inherit' },
    )
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const targets = parseManifestTargets(args.manifest, args.fallbackTargetsJson, args.requireDigestPinned)

  const evidence: Record<string, unknown> = {
    mode: 'transactional-production-promotion',
    startedAt: new Date().toISOString(),
    manifest: args.manifest,
    resourceGroup: args.resourceGroup,
    targetCount: targets.length,
    targets,
    capturedState: [] as TargetState[],
    healthChecks: [] as HealthCheckResult[],
    rollbackPerformed: false,
    status: 'in_progress',
  }

  const updatedStates: TargetState[] = []

  try {
    for (const target of targets) {
      const previous = captureCurrentState(target, args.resourceGroup)
      ;(evidence.capturedState as TargetState[]).push(previous)

      console.log(`Promoting ${target.containerAppName} -> ${target.image}`)
      execSync(
        `az containerapp update --name "${target.containerAppName}" --resource-group "${args.resourceGroup}" --image "${target.image}" --output none`,
        { stdio: 'inherit' },
      )

      updatedStates.push(previous)

      const healthResult = await runHealthCheck(target, args, args.resourceGroup)
      ;(evidence.healthChecks as HealthCheckResult[]).push(healthResult)
      if (!healthResult.ok) {
        throw new Error(`Health check failed for ${target.containerAppName}: ${healthResult.lastError ?? 'unknown error'}`)
      }
    }

    evidence.status = 'success'
  } catch (error) {
    evidence.status = 'failed'
    evidence.error = error instanceof Error ? error.message : String(error)

    if (updatedStates.length > 0) {
      rollback(updatedStates, args.resourceGroup)
      evidence.rollbackPerformed = true
    }

    throw error
  } finally {
    evidence.completedAt = new Date().toISOString()
    mkdirSync(dirname(args.evidenceOut), { recursive: true })
    writeFileSync(args.evidenceOut, JSON.stringify(evidence, null, 2), 'utf8')
    console.log(`Deployment evidence written to ${args.evidenceOut}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
