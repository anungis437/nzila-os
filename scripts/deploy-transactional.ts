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
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

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
const DIGEST_PINNED_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*@sha256:[0-9a-f]{64}$/i
const CONTAINER_APP_NAME_RE = /^[a-z](?!.*--)[a-z0-9-]{0,30}[a-z0-9]$/

export function parseArgs(argv: string[]): ParsedArgs {
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
  if (requireFlag !== undefined && requireFlag !== 'true' && requireFlag !== 'false') {
    throw new Error('Invalid --require-digest-pinned flag; expected true or false')
  }
  if (isProdGroup && requireFlag === 'false') {
    throw new Error('BR-5: production digest pinning cannot be disabled')
  }
  const requireDigestPinned = isProdGroup || requireFlag === 'true'

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

function runJsonCommand(args: string[]): unknown {
  // Manifest-controlled names and images must never enter a shell command.
  const output = execFileSync('az', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return JSON.parse(output)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

export function parseManifestTargets(manifestPath: string, fallbackTargetsJson?: string, requireDigestPinned = false): DeployTarget[] {
  const manifestRaw = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestRaw) as { deployTargets?: unknown[]; apps?: unknown[] }
  const rawTargets = Array.isArray(manifest.deployTargets)
    ? manifest.deployTargets
    : Array.isArray(manifest.apps)
      ? manifest.apps
      : []

  const sourceTargets = rawTargets.length > 0
    ? rawTargets
    : !requireDigestPinned && fallbackTargetsJson
      ? JSON.parse(fallbackTargetsJson)
      : []

  ensure(Array.isArray(sourceTargets) && sourceTargets.length > 0, 'No deploy targets found in artifact manifest and no fallback targets provided')

  const targets: DeployTarget[] = []
  const seen = new Set<string>()
  for (const raw of sourceTargets as Record<string, unknown>[]) {
    ensure(raw && typeof raw === 'object' && !Array.isArray(raw), 'Malformed deploy target')
    const names = [raw.containerAppName, raw.app, raw.name].filter(v => v !== null && v !== undefined)
    const images = [raw.image, raw.imageRef, raw.digest].filter(v => v !== null && v !== undefined)
    ensure(names.length > 0 && names.every(v => typeof v === 'string') &&
      new Set(names).size === 1, 'Missing or conflicting deployment target identities')
    ensure(images.length > 0 && images.every(v => typeof v === 'string') &&
      new Set(images).size === 1, 'Missing or conflicting deployment image references')
    const appName = names[0] as string
    const image = images[0] as string
    ensure(CONTAINER_APP_NAME_RE.test(appName), 'Noncanonical Azure Container App destination')
    ensure(!seen.has(appName), 'Duplicate Azure Container App destination')
    seen.add(appName)
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

/**
 * The public ingress health endpoint can still serve an older, healthy revision.
 * Bind promotion to Azure's actual latest READY revision and the signed image
 * before using the HTTP health check as supplementary evidence.
 */
export function assertPromotedRevision(
  target: DeployTarget,
  previous: TargetState,
  details: unknown,
): string {
  const properties = (details as {
    properties?: {
      template?: { containers?: Array<{ image?: unknown }> }
      latestRevisionName?: unknown
      latestReadyRevisionName?: unknown
    }
  } | null)?.properties
  const deployedImage = properties?.template?.containers?.[0]?.image
  const latestRevision = properties?.latestRevisionName
  const latestReadyRevision = properties?.latestReadyRevisionName

  ensure(deployedImage === target.image,
    `Production image mismatch for ${target.containerAppName}; refusing to claim promotion`)
  ensure(typeof latestRevision === 'string' && latestRevision.length > 0,
    `Missing latest Azure revision for ${target.containerAppName}`)
  ensure(typeof latestReadyRevision === 'string' && latestReadyRevision.length > 0,
    `Missing ready Azure revision for ${target.containerAppName}`)
  ensure(latestReadyRevision === latestRevision,
    `Latest Azure revision is not ready for ${target.containerAppName}`)
  if (previous.previousImage !== target.image) {
    ensure(latestReadyRevision !== previous.previousRevision,
      `Azure still reports the previous revision for ${target.containerAppName}`)
  }
  return latestReadyRevision
}

function captureCurrentState(target: DeployTarget, resourceGroup: string): TargetState {
  const details = runJsonCommand(['containerapp', 'show', '--name', target.containerAppName,
    '--resource-group', resourceGroup, '--output', 'json'])
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

/**
 * A signed manifest's healthUrl is not independent proof of a deployed app:
 * an arbitrary external endpoint could return 200 while Azure serves a broken
 * revision. Resolve the URL from Azure's own ingress identity and reject any
 * caller-supplied URL that does not match it exactly.
 */
export function resolveAzureHealthUrl(target: DeployTarget, details: unknown): string {
  const fqdn = (details as {
    properties?: { configuration?: { ingress?: { fqdn?: unknown } } }
  } | null)?.properties?.configuration?.ingress?.fqdn
  ensure(typeof fqdn === 'string' &&
    /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(fqdn) &&
    !fqdn.includes('..') && fqdn.includes('.'),
    `No canonical Azure ingress FQDN for ${target.containerAppName}`)
  const healthPath = target.healthPath ?? '/api/health'
  ensure(/^\/(?!\/)[^\s?#\\]*$/.test(healthPath),
    `Invalid health path for ${target.containerAppName}`)
  const canonicalUrl = new URL(`https://${fqdn}${healthPath}`)
  ensure(canonicalUrl.hostname.toLowerCase() === fqdn.toLowerCase() &&
    canonicalUrl.pathname === healthPath,
    `Noncanonical Azure health path for ${target.containerAppName}`)
  if (target.healthUrl !== undefined) {
    ensure(target.healthUrl === canonicalUrl.href,
      `Health URL does not match Azure ingress for ${target.containerAppName}`)
  }
  return canonicalUrl.href
}

async function runHealthCheck(target: DeployTarget, args: ParsedArgs, resourceGroup: string): Promise<HealthCheckResult> {
  const app = runJsonCommand(['containerapp', 'show', '--name', target.containerAppName,
    '--resource-group', resourceGroup, '--output', 'json'])
  const url = resolveAzureHealthUrl(target, app)

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
    execFileSync('az', ['containerapp', 'update', '--name', state.appName,
      '--resource-group', resourceGroup, '--image', state.previousImage, '--output', 'none'],
      { stdio: 'inherit' })
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
    readyRevisions: [] as Array<{ appName: string; image: string; revision: string }>,
    rollbackAttempted: false,
    rollbackPerformed: false,
    status: 'in_progress',
  }

  const updatedStates: TargetState[] = []

  try {
    for (const target of targets) {
      const previous = captureCurrentState(target, args.resourceGroup)
      ;(evidence.capturedState as TargetState[]).push(previous)

      console.log(`Promoting ${target.containerAppName} -> ${target.image}`)
      // The Azure API may apply the image even when the CLI exits nonzero.
      // Record the rollback candidate before attempting the remote mutation.
      updatedStates.push(previous)
      execFileSync('az', ['containerapp', 'update', '--name', target.containerAppName,
        '--resource-group', args.resourceGroup, '--image', target.image, '--output', 'none'],
        { stdio: 'inherit' })

      const deployed = runJsonCommand(['containerapp', 'show', '--name', target.containerAppName,
        '--resource-group', args.resourceGroup, '--output', 'json'])
      const readyRevision = assertPromotedRevision(target, previous, deployed)
      ;(evidence.readyRevisions as Array<{ appName: string; image: string; revision: string }>).push({
        appName: target.containerAppName,
        image: target.image,
        revision: readyRevision,
      })

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
      evidence.rollbackAttempted = true
      try {
        rollback(updatedStates, args.resourceGroup)
        evidence.rollbackPerformed = true
      } catch (rollbackError) {
        // Do not hide the original deployment failure or claim rollback success.
        evidence.rollbackError = rollbackError instanceof Error
          ? rollbackError.message : String(rollbackError)
      }
    }

    throw error
  } finally {
    evidence.completedAt = new Date().toISOString()
    mkdirSync(dirname(args.evidenceOut), { recursive: true })
    writeFileSync(args.evidenceOut, JSON.stringify(evidence, null, 2), 'utf8')
    console.log(`Deployment evidence written to ${args.evidenceOut}`)
  }
}

// Importing this module for contract tests must never start a deployment.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
