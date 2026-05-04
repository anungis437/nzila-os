#!/usr/bin/env tsx
/**
 * check-health.ts
 *
 * Generates health probes from deployment inventory policy plus
 * health-config.json overrides, performs HTTP GET checks, and writes
 * reports/runtime/health-latest.json.
 *
 * Endpoint URLs may contain `${VAR:-default}` placeholders that are resolved
 * against process.env at runtime.
 *
 * Exit 0 = all endpoints responded with expected HTTP status
 * Exit 1 = one or more failures (script continues checking all before exiting)
 *
 * When running locally without live endpoints, pass HEALTH_LOCAL_SKIP=true
 * to emit an all-unknown bootstrap record without making network requests.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { promises as dns } from 'node:dns'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..', '..').replace(/\\/g, '/')

const CONFIG_PATH = join(__dirname, 'health-config.json')
const INVENTORY_PATH = join(ROOT, 'governance', 'release', 'deployment-inventory.json')
const OUTPUT_DIR = join(ROOT, 'reports', 'runtime')
const OUTPUT_FILE = join(OUTPUT_DIR, 'health-latest.json')

type EnvironmentName = 'staging' | 'production'

interface EndpointConfig {
  name: string
  url: string
  path: string
  expectedStatus: number | number[]
  timeoutMs: number
  environment?: EnvironmentName | 'unknown'
  source?: 'inventory' | 'config'
  policyCritical?: boolean
}

interface HealthConfig {
  endpoints: EndpointConfig[]
}

type InventoryRouting = {
  staging?: string
  production?: string
  stagingFallback?: string
  productionFallback?: string
  healthPath?: string
  readyPath?: string
}

type InventoryApp = {
  routing?: InventoryRouting
  stagingDnsStatus?: string
  stagingDeployed?: boolean
  productionDeployed?: boolean
}

type InventoryTopology = {
  strategy?: string
  production?: {
    sharedWithStaging?: boolean
  }
}

type DeploymentInventory = {
  apps: Record<string, InventoryApp>
  topology?: InventoryTopology
}

type ResolveOutput = {
  approvedApps: string[]
}

type FailureType =
  | 'none'
  | 'dns'
  | 'timeout'
  | 'tls'
  | 'http_4xx'
  | 'http_5xx'
  | 'http_unexpected'
  | 'network'

interface EndpointResult {
  name: string
  environment: EnvironmentName | 'shared' | 'unknown'
  source: 'inventory' | 'config'
  policyCritical: boolean
  url: string
  resolvedUrl: string
  checkedAt: string
  responseTimeMs: number | null
  httpStatus: number | null
  bodyHash: string | null
  failureType: FailureType
  severity: 'none' | 'warn' | 'blocker'
  gateImpact: 'none' | 'advisory' | 'blocking'
  status: 'pass' | 'fail' | 'unknown'
  bootstrapEvidence: boolean
  error?: string
}

interface HealthSnapshot {
  generatedAt: string
  topologyStrategy: string
  overallStatus: 'pass' | 'fail' | 'unknown'
  blockingFindings: string[]
  advisoryFindings: string[]
  bootstrapEvidence: boolean
  endpoints: EndpointResult[]
}

function aliasLogicalApp(logicalApp: string): string {
  if (logicalApp === 'faircase') return 'abr'
  return logicalApp
}

function normalizeRoute(route: string | undefined): string | null {
  if (!route) return null
  const trimmed = route.trim()
  if (!trimmed || trimmed === 'n/a' || trimmed === 'blocked' || trimmed === 'pilot-only') return null
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) return trimmed
  return null
}

function runJsonCommand(command: string, args: string[]): unknown {
  try {
    return JSON.parse(execFileSync(command, args, { encoding: 'utf8', timeout: 30_000 }))
  } catch (firstErr) {
    if (process.platform !== 'win32') throw firstErr
    const quoted = [command, ...args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))].join(' ')
    const output = execFileSync('cmd.exe', ['/d', '/s', '/c', quoted], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    return JSON.parse(output)
  }
}

function resolveApprovedApps(env: EnvironmentName): string[] {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const output = runJsonCommand(pnpm, ['tsx', 'scripts/release/resolve-deploy-apps.ts', '--env', env, '--apps', 'all']) as ResolveOutput
  return Array.isArray(output.approvedApps) ? output.approvedApps : []
}

function loadInventory(): DeploymentInventory {
  if (!existsSync(INVENTORY_PATH)) {
    throw new Error(`Missing inventory: ${INVENTORY_PATH}`)
  }
  return JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as DeploymentInventory
}

function isLiveStagingDnsStatus(status: string | undefined): boolean {
  const normalized = (status ?? '').trim().toLowerCase()
  return ['active', 'resolved', 'wired', 'healthy', 'live'].includes(normalized)
}

function canonicalStagingPolicyCritical(app: InventoryApp, env: EnvironmentName): boolean {
  return env === 'staging' && isLiveStagingDnsStatus(app.stagingDnsStatus)
}

export function buildInventoryEndpointsForApproved(
  inventory: DeploymentInventory,
  approvedAppsByEnv: Record<EnvironmentName, string[]>,
): EndpointConfig[] {
  const endpoints: EndpointConfig[] = []
  const seen = new Set<string>()

  const envs: EnvironmentName[] = ['staging', 'production']
  for (const env of envs) {
    const approvedApps = approvedAppsByEnv[env] ?? []
    for (const appName of approvedApps) {
      const app = inventory.apps[appName]
      // Skip apps that are not deployed in the target environment
      if (env === 'staging' && app?.stagingDeployed === false) continue
      if (env === 'production' && app?.productionDeployed === false) continue
      const canonicalRoute = normalizeRoute(app?.routing?.[env])
      const fallbackKey = env === 'staging' ? 'stagingFallback' : 'productionFallback'
      const fallbackRoute = normalizeRoute(app?.routing?.[fallbackKey])

      const routes: Array<{ route: string; usedFallback: boolean }> = []
      if (canonicalRoute) {
        routes.push({ route: canonicalRoute, usedFallback: false })
      }
      if (fallbackRoute && fallbackRoute !== canonicalRoute) {
        routes.push({ route: fallbackRoute, usedFallback: true })
      }
      if (routes.length === 0) continue

      const healthPath = app?.routing?.healthPath ?? '/api/health'
      const readyPath = app?.routing?.readyPath
      const appAlias = aliasLogicalApp(appName)

      for (const target of routes) {
        const baseName = `${env}:${appAlias}${target.usedFallback ? ':fallback' : ''}`
        const policyCritical = target.usedFallback
          ? false
          : env === 'production' || canonicalStagingPolicyCritical(app, env)
        const rootUrl = target.route.replace(/\/$/, '')

        const rootKey = `${env}|${rootUrl}|/`
        if (!seen.has(rootKey)) {
          endpoints.push({
            name: `${baseName}:root`,
            url: rootUrl,
            path: '/',
            expectedStatus: [200, 204],
            timeoutMs: 15_000,
            environment: env,
            source: 'inventory',
            policyCritical,
          })
          seen.add(rootKey)
        }

        const normalizedHealthPath = healthPath.startsWith('/') ? healthPath : `/${healthPath}`
        const healthKey = `${env}|${rootUrl}|${normalizedHealthPath}`
        if (!seen.has(healthKey)) {
          endpoints.push({
            name: `${baseName}:health`,
            url: rootUrl,
            path: normalizedHealthPath,
            expectedStatus: [200, 204],
            timeoutMs: 15_000,
            environment: env,
            source: 'inventory',
            policyCritical,
          })
          seen.add(healthKey)
        }

        if (readyPath) {
          const normalizedReadyPath = readyPath.startsWith('/') ? readyPath : `/${readyPath}`
          const readyKey = `${env}|${rootUrl}|${normalizedReadyPath}`
          if (!seen.has(readyKey)) {
            endpoints.push({
              name: `${baseName}:ready`,
              url: rootUrl,
              path: normalizedReadyPath,
              expectedStatus: [200, 204],
              timeoutMs: 15_000,
              environment: env,
              source: 'inventory',
              policyCritical,
            })
            seen.add(readyKey)
          }
        }
      }
    }
  }

  return endpoints
}

function buildInventoryEndpoints(inventory: DeploymentInventory): EndpointConfig[] {
  const approvedAppsByEnv: Record<EnvironmentName, string[]> = {
    staging: resolveApprovedApps('staging'),
    production: resolveApprovedApps('production'),
  }
  return buildInventoryEndpointsForApproved(inventory, approvedAppsByEnv)
}

/** Resolve ${VAR:-default} placeholders from process.env */
function resolvePlaceholders(url: string): string {
  return url.replace(/\$\{([^}:]+)(?::-([^}]*))?\}/g, (_, key: string, fallback: string) => {
    return process.env[key] ?? fallback ?? ''
  })
}

function classifyFailureType(errorMessage: string | undefined, statusCode: number | null): FailureType {
  if (statusCode !== null) {
    if (statusCode >= 400 && statusCode < 500) return 'http_4xx'
    if (statusCode >= 500) return 'http_5xx'
    return 'http_unexpected'
  }

  const message = (errorMessage ?? '').toLowerCase()
  if (message.includes('eai_again') || message.includes('enotfound') || message.includes('dns')) return 'dns'
  if (message.includes('timed out') || message.includes('timeout') || message.includes('aborted')) return 'timeout'
  if (message.includes('tls') || message.includes('certificate') || message.includes('ssl')) return 'tls'
  if (!message) return 'network'
  return 'network'
}

async function dnsResolves(endpointUrl: string): Promise<boolean> {
  try {
    const host = new URL(endpointUrl).hostname
    const records = await dns.lookup(host, { all: true })
    return records.length > 0
  } catch {
    return false
  }
}

async function checkEndpoint(
  cfg: EndpointConfig,
  skipNetwork: boolean,
): Promise<EndpointResult> {
  const resolvedBase = resolvePlaceholders(cfg.url)
  const resolvedUrl = resolvedBase.replace(/\/$/, '') + cfg.path
  const checkedAt = new Date().toISOString()
  const environment = cfg.environment ?? 'unknown'
  const source = cfg.source ?? 'config'
  const policyCritical = cfg.policyCritical === true

  if (skipNetwork) {
    return {
      name: cfg.name,
      environment,
      source,
      policyCritical,
      url: cfg.url,
      resolvedUrl,
      checkedAt,
      responseTimeMs: null,
      httpStatus: null,
      bodyHash: null,
      failureType: 'none',
      severity: 'none',
      gateImpact: 'none',
      status: 'unknown',
      bootstrapEvidence: true,
    }
  }

  const hostResolvable = await dnsResolves(resolvedUrl)
  if (!hostResolvable) {
    const msg = 'DNS lookup failed'
    console.log(`  ✗ ${cfg.name}: ERROR — ${msg}`)
    return {
      name: cfg.name,
      environment,
      source,
      policyCritical,
      url: cfg.url,
      resolvedUrl,
      checkedAt,
      responseTimeMs: null,
      httpStatus: null,
      bodyHash: null,
      failureType: 'dns',
      severity: policyCritical ? 'blocker' : 'warn',
      gateImpact: policyCritical ? 'blocking' : 'advisory',
      status: 'fail',
      bootstrapEvidence: false,
      error: msg,
    }
  }

  const start = Date.now()

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)

    const resp = await fetch(resolvedUrl, {
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timer)

    const responseTimeMs = Date.now() - start
    const bodyText = await resp.text()
    const bodyHash = createHash('sha256')
      .update(bodyText)
      .digest('hex')
      .slice(0, 16)
    const httpStatus = resp.status
    const expectedStatuses = Array.isArray(cfg.expectedStatus)
      ? cfg.expectedStatus
      : [cfg.expectedStatus]
    const status = expectedStatuses.includes(httpStatus) ? 'pass' : 'fail'
    const failureType = status === 'pass' ? 'none' : classifyFailureType(undefined, httpStatus)
    const severity: EndpointResult['severity'] =
      status === 'pass' ? 'none' : policyCritical ? 'blocker' : 'warn'
    const gateImpact: EndpointResult['gateImpact'] =
      status === 'pass' ? 'none' : policyCritical ? 'blocking' : 'advisory'

    console.log(
      `  ${status === 'pass' ? '✓' : '✗'} ${cfg.name}: HTTP ${httpStatus} in ${responseTimeMs}ms`,
    )

    return {
      name: cfg.name,
      environment,
      source,
      policyCritical,
      url: cfg.url,
      resolvedUrl,
      checkedAt,
      responseTimeMs,
      httpStatus,
      bodyHash,
      failureType,
      severity,
      gateImpact,
      status,
      bootstrapEvidence: false,
    }
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    const failureType = classifyFailureType(msg, null)
    const severity: EndpointResult['severity'] = policyCritical ? 'blocker' : 'warn'
    const gateImpact: EndpointResult['gateImpact'] = policyCritical ? 'blocking' : 'advisory'
    console.log(`  ✗ ${cfg.name}: ERROR — ${msg.slice(0, 100)}`)

    return {
      name: cfg.name,
      environment,
      source,
      policyCritical,
      url: cfg.url,
      resolvedUrl,
      checkedAt,
      responseTimeMs,
      httpStatus: null,
      bodyHash: null,
      failureType,
      severity,
      gateImpact,
      status: 'fail',
      bootstrapEvidence: false,
      error: msg.slice(0, 300),
    }
  }
}

async function main(): Promise<void> {
  const skipNetwork = process.env.HEALTH_LOCAL_SKIP === 'true'

  console.log(`[check-health] mode=${skipNetwork ? 'local/bootstrap' : 'live'}`)

  const inventory = loadInventory()
  const inventoryEndpoints = buildInventoryEndpoints(inventory)

  let configEndpoints: EndpointConfig[] = []
  if (existsSync(CONFIG_PATH)) {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(raw) as HealthConfig
    configEndpoints = (config.endpoints ?? []).map((endpoint) => ({
      ...endpoint,
      source: endpoint.source ?? 'config',
      environment: endpoint.environment ?? 'unknown',
      policyCritical: endpoint.policyCritical ?? false,
    }))
  }

  const endpoints = [...inventoryEndpoints, ...configEndpoints]

  if (endpoints.length === 0) {
    console.error('[check-health] No health endpoints were generated from inventory/config')
    process.exit(1)
  }

  const results: EndpointResult[] = []
  for (const ep of endpoints) {
    results.push(await checkEndpoint(ep, skipNetwork))
  }

  const failCount = results.filter((r) => r.status === 'fail').length
  const blockingFindings = results
    .filter((r) => r.gateImpact === 'blocking' && r.status === 'fail')
    .map((r) => `[${r.environment}] ${r.name} failed (${r.failureType}${r.httpStatus ? `, HTTP ${r.httpStatus}` : ''})`)
  const advisoryFindings = results
    .filter((r) => r.gateImpact === 'advisory' && r.status === 'fail')
    .map((r) => `[${r.environment}] ${r.name} failed (${r.failureType}${r.httpStatus ? `, HTTP ${r.httpStatus}` : ''})`)

  const overallStatus: 'pass' | 'fail' | 'unknown' = skipNetwork
    ? 'unknown'
    : failCount > 0
      ? 'fail'
      : 'pass'

  const snapshot: HealthSnapshot = {
    generatedAt: new Date().toISOString(),
    topologyStrategy: inventory.topology?.strategy ?? 'unspecified',
    overallStatus,
    blockingFindings,
    advisoryFindings,
    bootstrapEvidence: skipNetwork,
    endpoints: results,
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8')

  console.log(`[check-health] Written: ${OUTPUT_FILE}`)
  console.log(
    `  overall=${overallStatus} (${results.length} endpoints, ${failCount} failures, ${blockingFindings.length} blocking)`,
  )

  const failOnAdvisory = process.env.HEALTH_FAIL_ON_ADVISORY === 'true'
  const shouldFail = !skipNetwork && (blockingFindings.length > 0 || (failOnAdvisory && advisoryFindings.length > 0))
  process.exit(shouldFail ? 1 : 0)
}

const isMain =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(process.argv[1]).href === import.meta.url

if (isMain) {
  main().catch((err: unknown) => {
    console.error('[check-health] Fatal error:', err)
    process.exit(1)
  })
}
