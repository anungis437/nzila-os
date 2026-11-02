#!/usr/bin/env node
/**
 * Transactional production promotion with automated rollback evidence.
 *
 * Usage:
 *   pnpm tsx scripts/deploy-transactional.ts \
 *     --manifest staging-artifacts/artifact-manifest.json \
 *     --resource-group <rg>
 */

import { mkdirSync, writeFileSync, openSync, closeSync, fstatSync, readSync, linkSync, unlinkSync, constants } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
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
  expectedManifestSha256?: string
}

// BR-5 defense-in-depth: a production deploy target must reference an immutable
// image digest, never a mutable tag. This mirrors the workflow-level gate so the
// promotion script is fail-closed even if invoked directly.
const PRODUCTION_IMAGE_RE = /^nzilacanadaacr\.azurecr\.io\/nzila\/[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?@sha256:[0-9a-f]{64}$/
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
  const expectedManifestSha256 = args['expected-manifest-sha256']
  // An immutable digest alone is not enough: production must consume the
  // EXACT filtered manifest that passed signed-target/OCI receipt verification.
  if (requireDigestPinned && !/^[0-9a-f]{64}$/.test(expectedManifestSha256 ?? '')) {
    throw new Error('P0 #1038: production requires a verified manifest SHA-256 handoff')
  }
  if (expectedManifestSha256 !== undefined && !/^[0-9a-f]{64}$/.test(expectedManifestSha256)) {
    throw new Error('Invalid expected manifest SHA-256')
  }

  // Unbounded or non-finite retries can exhaust the production approval
  // window and runner resources without ever producing health evidence.
  // Bound the entire worst-case per-target probe budget, not just each timer.
  const healthAttempts = Number(args['health-attempts'] ?? 8)
  const healthDelayMs = Number(args['health-delay-ms'] ?? 5000)
  const healthTimeoutMs = Number(args['health-timeout-ms'] ?? 15000)
  if (!Number.isSafeInteger(healthAttempts) || healthAttempts < 1 || healthAttempts > 20 ||
      !Number.isSafeInteger(healthDelayMs) || healthDelayMs < 0 || healthDelayMs > 30_000 ||
      !Number.isSafeInteger(healthTimeoutMs) || healthTimeoutMs < 1000 || healthTimeoutMs > 60_000 ||
      healthAttempts * healthTimeoutMs + (healthAttempts - 1) * healthDelayMs > 180_000) {
    throw new Error('P0 #1038: health probe retry/time budget invalid')
  }

  return {
    manifest: resolve(args.manifest ?? 'staging-artifacts/artifact-manifest.json'),
    resourceGroup,
    healthAttempts,
    healthDelayMs,
    healthTimeoutMs,
    evidenceOut: resolve(args['evidence-out'] ?? `ops/deploy-evidence/production-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    fallbackTargetsJson: args['fallback-targets-json'] ?? process.env.PRODUCTION_DEPLOY_TARGETS_JSON,
    requireDigestPinned,
    expectedManifestSha256,
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

/** A health response must be from the resolved Azure ingress, not a redirect
 * or an unbounded response from a compromised application. */
export async function inspectHealthResponse(response: Response, expectedMarker?: string): Promise<boolean> {
  if (!response.ok || response.redirected || response.status < 200 || response.status >= 300) return false
  if (expectedMarker === undefined) return true
  if (expectedMarker.length < 1 || expectedMarker.length > 256 || !response.body) return false
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > 65_536) return false
      chunks.push(value)
    }
    return Buffer.concat(chunks).toString('utf8').includes(expectedMarker)
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

/**
 * Read the selected deployment manifest from one opened descriptor. Refuse
 * symlinks, special files, oversized input and mutation during the read.
 * A prior verifier cannot protect a later pathname-based, unbounded re-read.
 */
function readBoundedDeployManifest(path: string): Buffer {
  let fd: number | undefined
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    const before = fstatSync(fd, { bigint: true })
    if (!before.isFile() || before.size < 2n || before.size > 2_097_152n) {
      throw new Error('Invalid deployment manifest size or file type')
    }
    const expected = Number(before.size)
    const bytes = Buffer.allocUnsafe(expected + 1)
    let length = 0
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null)
      if (count === 0) break
      length += count
    }
    const after = fstatSync(fd, { bigint: true })
    if (length !== expected || after.size !== before.size ||
        after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs ||
        after.ino !== before.ino || after.dev !== before.dev) {
      throw new Error('Deployment manifest changed during bounded read')
    }
    return bytes.subarray(0, length)
  } catch {
    throw new Error('P0 #1038: deployment manifest unavailable, unsafe or mutated')
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

export function parseManifestTargets(
  manifestPath: string, fallbackTargetsJson?: string, requireDigestPinned = false,
  expectedManifestSha256?: string,
): DeployTarget[] {
  const manifestRaw = readBoundedDeployManifest(manifestPath)
  if (requireDigestPinned && !/^[0-9a-f]{64}$/.test(expectedManifestSha256 ?? '')) {
    throw new Error('P0 #1038: production manifest verification receipt missing')
  }
  if (expectedManifestSha256 !== undefined &&
      createHash('sha256').update(manifestRaw).digest('hex') !== expectedManifestSha256) {
    throw new Error('P0 #1038: deployment manifest differs from verified selection')
  }
  const manifest = JSON.parse(manifestRaw.toString('utf8')) as { deployTargets?: unknown[]; apps?: unknown[] }
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

  ensure(Array.isArray(sourceTargets) && sourceTargets.length > 0 && sourceTargets.length <= 32,
    'Deployment manifest must contain 1–32 targets; no fallback is permitted for production')

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
      !requireDigestPinned || PRODUCTION_IMAGE_RE.test(image),
      `P0 #1038: deploy target ${appName} must use a canonical nzilacanadaacr.azurecr.io/nzila/ image @sha256 digest.`,
    )

    ensure(raw.expectedBodyContains === undefined ||
      (typeof raw.expectedBodyContains === 'string' &&
        raw.expectedBodyContains.length >= 1 && raw.expectedBodyContains.length <= 256),
      'Health marker must be a bounded literal string')
    targets.push({
      containerAppName: appName,
      image,
      healthUrl: raw.healthUrl ? String(raw.healthUrl) : undefined,
      healthPath: raw.healthPath ? String(raw.healthPath) : undefined,
      expectedBodyContains: raw.expectedBodyContains as string | undefined,
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
    !fqdn.includes('..') && fqdn.toLowerCase().endsWith('.azurecontainerapps.io'),
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
      // A redirect must not certify a different, unrelated healthy service.
      const response = await fetch(url, { signal: controller.signal, redirect: 'manual', cache: 'no-store' })
      statusCode = response.status
      const hasExpectedBody = await inspectHealthResponse(response, target.expectedBodyContains)

      if (hasExpectedBody) {
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

/**
 * Publish deployment evidence atomically on the runner, without replacing an
 * earlier receipt. A failed write must be visible to the deployment rollback
 * path; a partially written success file must never be treated as proof.
 * This is atomic runner publication, not independently durable evidence retention.
 */
export function persistDeploymentEvidence(path: string, evidence: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = path + '.' + randomBytes(16).toString('hex') + '.tmp'
  try {
    writeFileSync(temporary, JSON.stringify(evidence, null, 2) + '\n',
      { encoding: 'utf8', flag: 'wx', mode: 0o600, flush: true })
    // Atomic no-clobber publication: link fails if the destination already
    // exists (including a symlink), and never exposes a partial JSON receipt.
    linkSync(temporary, path)
  } finally {
    try { unlinkSync(temporary) } catch { /* no partial temp receipt is authoritative */ }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const targets = parseManifestTargets(args.manifest, args.fallbackTargetsJson, args.requireDigestPinned, args.expectedManifestSha256)

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
    evidence.completedAt = new Date().toISOString()
    // A successful remote mutation is not a certified success if its
    // evidence cannot be published. Treat persistence failure as rollback.
    persistDeploymentEvidence(args.evidenceOut, evidence)
    return
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

    evidence.completedAt = new Date().toISOString()
    try {
      persistDeploymentEvidence(args.evidenceOut, evidence)
    } catch (receiptError) {
      // The original deployment failure still propagates. Never fabricate
      // a successful rollback or evidence receipt when storage is unavailable.
      console.error('P0 #1038: failed deployment evidence unavailable: ' +
        (receiptError instanceof Error ? receiptError.message : String(receiptError)))
    }
    throw error
  }
}

// Importing this module for contract tests must never start a deployment.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
