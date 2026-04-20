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
      readyPath?: string
      versionPath?: string
    }
  }>
}

type EndpointProbeName = 'health' | 'ready' | 'version'

type FailureType =
  | 'none'
  | 'inventory'
  | 'unroutable'
  | 'dns'
  | 'connectivity'
  | 'timeout'
  | 'redirect'
  | 'auth'
  | 'not_found'
  | 'server_error'
  | 'http_error'
  | 'runtime'

type ProbeResult = {
  endpoint: EndpointProbeName
  url: string
  status: number
  ok: boolean
  attempts: number
  durationMs: number
  failureType: FailureType
  error?: string
}

type SmokeResult = {
  app: string
  host: string
  ok: boolean
  probes: ProbeResult[]
  failureSummary: FailureType[]
}

function classifyHttpFailure(status: number): FailureType {
  if (status >= 300 && status < 400) return 'redirect'
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'not_found'
  if (status >= 500) return 'server_error'
  if (status >= 400) return 'http_error'
  return 'none'
}

function classifyFetchError(error: unknown): FailureType {
  const message = error instanceof Error ? error.message : String(error)
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code ?? '') : ''
  const cause = error && typeof error === 'object' && 'cause' in error ? (error as { cause?: unknown }).cause : undefined
  const causeCode = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code ?? '') : ''
  const normalized = `${message} ${code} ${causeCode}`.toLowerCase()

  if (normalized.includes('abort') || normalized.includes('timeout') || normalized.includes('etimedout')) {
    return 'timeout'
  }
  if (normalized.includes('enotfound') || normalized.includes('dns')) {
    return 'dns'
  }
  if (
    normalized.includes('econnrefused')
    || normalized.includes('econnreset')
    || normalized.includes('socket')
    || normalized.includes('network')
    || normalized.includes('connect')
  ) {
    return 'connectivity'
  }
  return 'runtime'
}

function parseArg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1]
  }
  if (fallback !== undefined) {
    return fallback
  }
  throw new Error(`Missing argument ${name}`)
}

async function main() {
  const env = parseArg('--env', 'staging')
  const apps = parseArg('--apps', 'web').split(',').map((a) => a.trim()).filter(Boolean)
  const timeoutMs = Number(parseArg('--timeout-ms', '15000'))
  const retries = Number(parseArg('--retries', '2'))
  const retryDelayMs = Number(parseArg('--retry-delay-ms', '750'))

  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as Inventory

  async function probeEndpoint(
    endpoint: EndpointProbeName,
    url: string,
    expectedStatuses: number[],
  ): Promise<ProbeResult> {
    const started = Date.now()

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          redirect: 'manual',
        })

        const status = response.status
        const ok = expectedStatuses.includes(status)
        const failureType = ok ? 'none' : classifyHttpFailure(status)

        if (ok || !['server_error', 'timeout', 'connectivity', 'runtime'].includes(failureType) || attempt === retries) {
          return {
            endpoint,
            url,
            status,
            ok,
            attempts: attempt + 1,
            durationMs: Date.now() - started,
            failureType,
          }
        }
      } catch (error) {
        const failureType = classifyFetchError(error)
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (!['timeout', 'connectivity', 'runtime', 'dns'].includes(failureType) || attempt === retries) {
          return {
            endpoint,
            url,
            status: 0,
            ok: false,
            attempts: attempt + 1,
            durationMs: Date.now() - started,
            failureType,
            error: errorMessage,
          }
        }
      } finally {
        clearTimeout(timeout)
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)))
    }

    return {
      endpoint,
      url,
      status: 0,
      ok: false,
      attempts: retries + 1,
      durationMs: Date.now() - started,
      failureType: 'runtime',
      error: 'probe exhausted without terminal result',
    }
  }

  const results: SmokeResult[] = []
  for (const app of apps) {
    const cfg = inventory.apps[app]
    if (!cfg) {
      results.push({
        app,
        host: 'n/a',
        ok: false,
        probes: [{
          endpoint: 'health',
          url: 'n/a',
          status: 0,
          ok: false,
          attempts: 1,
          durationMs: 0,
          failureType: 'inventory',
          error: 'app missing from deployment inventory',
        }],
        failureSummary: ['inventory'],
      })
      continue
    }

    const host = env === 'production' ? cfg.routing?.production : cfg.routing?.staging
    if (!host || host === 'blocked' || host === 'pilot-only' || host === 'n/a') {
      results.push({
        app,
        host: host ?? 'n/a',
        ok: false,
        probes: [{
          endpoint: 'health',
          url: host ?? 'n/a',
          status: 0,
          ok: false,
          attempts: 1,
          durationMs: 0,
          failureType: 'unroutable',
          error: `no routable host for ${env}`,
        }],
        failureSummary: ['unroutable'],
      })
      continue
    }

    const healthUrl = `${host}${cfg.routing?.healthPath ?? '/api/health'}`
    const readyUrl = `${host}${cfg.routing?.readyPath ?? '/api/ready'}`
    const versionUrl = `${host}${cfg.routing?.versionPath ?? '/api/version'}`

    const probes = await Promise.all([
      probeEndpoint('health', healthUrl, [200]),
      probeEndpoint('ready', readyUrl, [200]),
      probeEndpoint('version', versionUrl, [200]),
    ])

    const failureSummary = Array.from(
      new Set(probes.filter((probe) => !probe.ok).map((probe) => probe.failureType)),
    )

    results.push({
      app,
      host,
      ok: probes.every((probe) => probe.ok),
      probes,
      failureSummary,
    })
  }

  const failed = results.filter((r) => !r.ok)
  const failureTally = failed
    .flatMap((entry) => entry.failureSummary)
    .reduce<Record<string, number>>((acc, failureType) => {
      acc[failureType] = (acc[failureType] ?? 0) + 1
      return acc
    }, {})

  const report = {
    timestamp: new Date().toISOString(),
    environment: env,
    appsChecked: apps.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failureTally,
    results,
  }

  fs.mkdirSync(path.join(ROOT, 'ops', 'smoke'), { recursive: true })
  const reportPath = path.join(ROOT, 'ops', 'smoke', `smoke-${env}-${Date.now()}.json`)
  const latestPath = path.join(ROOT, 'ops', 'smoke', `smoke-${env}-latest.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(JSON.stringify(report, null, 2))
  console.log(`Smoke report written: ${path.relative(ROOT, reportPath)}`)
  console.log(`Latest smoke report updated: ${path.relative(ROOT, latestPath)}`)

  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
