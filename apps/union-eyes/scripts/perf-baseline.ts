/**
 * UnionEyes — Performance Baseline Benchmark Script
 *
 * Usage:
 *   pnpm -C apps/union-eyes perf:baseline
 *   # or with a custom base URL:
 *   UE_BASE_URL=https://staging.unioneyes.app pnpm -C apps/union-eyes perf:baseline
 *
 * Requires: a running UE instance (staging or local dev)
 *
 * Outputs:
 *   - Console table with p50 / p95 / p99 per endpoint
 *   - scripts/perf-results.json (commit to track baseline drift)
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = process.env.UE_BASE_URL ?? 'http://localhost:3002'
const WARMUP_ROUNDS = 5
const SAMPLE_ROUNDS = 30
const TIMEOUT_MS = 10_000

interface EndpointDef {
  name: string
  method: 'GET' | 'POST'
  path: string
  body?: unknown
  threshold_p95_ms: number
}

const ENDPOINTS: EndpointDef[] = [
  { name: 'health', method: 'GET', path: '/api/health', threshold_p95_ms: 300 },
  { name: 'metrics-operational', method: 'GET', path: '/api/metrics/operational', threshold_p95_ms: 1000 },
  { name: 'governance-telemetry', method: 'GET', path: '/api/governance/telemetry', threshold_p95_ms: 1500 },
  { name: 'evidence-export', method: 'GET', path: '/api/evidence/export', threshold_p95_ms: 3000 },
  { name: 'workbench-assigned', method: 'GET', path: '/api/workbench/assigned', threshold_p95_ms: 1000 },
  { name: 'search', method: 'GET', path: '/api/search?q=grievance', threshold_p95_ms: 1000 },
]

interface SampleResult {
  durationMs: number
  status: number
  ok: boolean
}

interface EndpointStats {
  name: string
  path: string
  samples: number
  p50: number
  p95: number
  p99: number
  min: number
  max: number
  errorRate: number
  threshold_p95_ms: number
  pass: boolean
}

async function measureOnce(endpoint: EndpointDef): Promise<SampleResult> {
  const url = `${BASE_URL}${endpoint.path}`
  const start = performance.now()
  try {
    const res = await fetch(url, {
      method: endpoint.method,
      ...(endpoint.body ? { body: JSON.stringify(endpoint.body), headers: { 'content-type': 'application/json' } } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return { durationMs: performance.now() - start, status: res.status, ok: res.ok || res.status === 401 || res.status === 403 }
  } catch {
    return { durationMs: TIMEOUT_MS, status: 0, ok: false }
  }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return Math.round(sorted[Math.max(0, idx)])
}

async function benchmarkEndpoint(endpoint: EndpointDef): Promise<EndpointStats> {
  // Warm-up
  for (let i = 0; i < WARMUP_ROUNDS; i++) {
    await measureOnce(endpoint)
  }

  const results: SampleResult[] = []
  for (let i = 0; i < SAMPLE_ROUNDS; i++) {
    results.push(await measureOnce(endpoint))
  }

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b)
  const errors = results.filter((r) => !r.ok).length

  const p50 = percentile(durations, 50)
  const p95 = percentile(durations, 95)
  const p99 = percentile(durations, 99)

  return {
    name: endpoint.name,
    path: endpoint.path,
    samples: SAMPLE_ROUNDS,
    p50,
    p95,
    p99,
    min: Math.round(durations[0]),
    max: Math.round(durations[durations.length - 1]),
    errorRate: errors / SAMPLE_ROUNDS,
    threshold_p95_ms: endpoint.threshold_p95_ms,
    pass: p95 <= endpoint.threshold_p95_ms,
  }
}

async function main(): Promise<void> {
  console.log(`\n🔬 UE Performance Baseline — ${BASE_URL}`)
  console.log(`   Warmup: ${WARMUP_ROUNDS} rounds | Samples: ${SAMPLE_ROUNDS} rounds per endpoint\n`)

  const stats: EndpointStats[] = []
  let anyFail = false

  for (const endpoint of ENDPOINTS) {
    process.stdout.write(`  Benchmarking ${endpoint.name}...`)
    const result = await benchmarkEndpoint(endpoint)
    stats.push(result)
    const icon = result.pass ? '✅' : '❌'
    const errPct = (result.errorRate * 100).toFixed(0)
    console.log(
      ` ${icon} p50=${result.p50}ms p95=${result.p95}ms p99=${result.p99}ms err=${errPct}% (threshold ${result.threshold_p95_ms}ms)`,
    )
    if (!result.pass) anyFail = true
  }

  // Write JSON results
  const outputPath = join(import.meta.dirname, 'perf-results.json')
  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    warmupRounds: WARMUP_ROUNDS,
    sampleRounds: SAMPLE_ROUNDS,
    results: stats,
    pass: !anyFail,
  }
  writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`\n  Results written to ${outputPath}`)

  if (anyFail) {
    console.error('\n❌ One or more endpoints exceeded p95 threshold. See above.')
    process.exit(1)
  } else {
    console.log('\n✅ All endpoints within p95 thresholds.')
  }
}

main().catch((err: unknown) => {
  console.error('Perf baseline script failed:', err)
  process.exit(1)
})
