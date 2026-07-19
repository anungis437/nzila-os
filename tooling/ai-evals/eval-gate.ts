/**
 * Nzila OS — AI Eval Gate Configuration
 *
 * Defines pass/fail thresholds for the AI evaluation harness.
 * These thresholds are enforced as merge gates via CI.
 *
 * The eval harness (run-evals.ts) produces a report.json.
 * This script validates that report against thresholds and exits non-zero
 * if any threshold is violated.
 *
 * Usage in CI:
 *   npx tsx tooling/ai-evals/eval-gate.ts tooling/ai-evals/report.json
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Threshold Config ──────────────────────────────────────────────────────

export interface EvalThresholds {
  /** Minimum overall pass rate (0-100). Default: 90% */
  minPassRate: number
  /** Maximum allowed refusal rate (0-100). Default: 5% */
  maxRefusalRate: number
  /** Maximum average latency in ms. Default: 5000ms */
  maxAvgLatencyMs: number
  /** Maximum total cost per eval run in USD. Default: $10 */
  maxTotalCostUsd: number
  /** Minimum pass rate per app (overrides when specified) */
  perApp?: Record<string, { minPassRate?: number }>
}

/**
 * Default thresholds — fallback when no eval.config.json is present.
 * Prefer editing `tooling/ai-evals/eval.config.json` so non-engineers can
 * tune CI gates without touching source. These defaults must be met
 * before any release.
 */
export const DEFAULT_THRESHOLDS: EvalThresholds = {
  minPassRate: 90,
  maxRefusalRate: 5,
  maxAvgLatencyMs: 5000,
  maxTotalCostUsd: 10,
  perApp: {
    console: { minPassRate: 95 },
    // union-eyes handles regulated member data and legal guidance — high bar required
    'union-eyes': { minPassRate: 95 },
    // memora not yet deployed — threshold preserved for when it ships
    memora: { minPassRate: 90 },
  },
}

/** Default config file location, relative to this file. */
export const DEFAULT_CONFIG_PATH = path.join(__dirname, 'eval.config.json')

/**
 * Load thresholds from a JSON config file, merging on top of DEFAULT_THRESHOLDS.
 * Returns DEFAULT_THRESHOLDS if the file is missing. Throws on invalid JSON
 * or malformed structure so CI fails loudly rather than silently using defaults.
 */
export function loadThresholds(
  configPath: string = DEFAULT_CONFIG_PATH,
): EvalThresholds {
  if (!fs.existsSync(configPath)) {
    return DEFAULT_THRESHOLDS
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch (err) {
    throw new Error(
      `Failed to parse eval config at ${configPath}: ${(err as Error).message}`,
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Eval config at ${configPath} must be a JSON object`)
  }

  const cfg = parsed as Partial<EvalThresholds> & Record<string, unknown>
  return {
    minPassRate: cfg.minPassRate ?? DEFAULT_THRESHOLDS.minPassRate,
    maxRefusalRate: cfg.maxRefusalRate ?? DEFAULT_THRESHOLDS.maxRefusalRate,
    maxAvgLatencyMs: cfg.maxAvgLatencyMs ?? DEFAULT_THRESHOLDS.maxAvgLatencyMs,
    maxTotalCostUsd: cfg.maxTotalCostUsd ?? DEFAULT_THRESHOLDS.maxTotalCostUsd,
    perApp: cfg.perApp ?? DEFAULT_THRESHOLDS.perApp,
  }
}

// ── Report types (mirrors run-evals.ts) ───────────────────────────────────

interface EvalReport {
  timestamp: string
  baseUrl: string
  totalTests: number
  passed: number
  failed: number
  refused: number
  avgLatencyMs: number
  totalCostUsd: number
  results: Array<{
    id: string
    promptKey: string
    passed: boolean
    failures: string[]
    latencyMs: number
    tokensIn?: number
    tokensOut?: number
    costUsd?: number
    error?: string
  }>
}

// ── Gate check ────────────────────────────────────────────────────────────

export interface GateResult {
  passed: boolean
  violations: string[]
  metrics: {
    passRate: number
    refusalRate: number
    avgLatencyMs: number
    totalCostUsd: number
    totalTests: number
  }
}

export function checkEvalGate(
  report: EvalReport,
  thresholds: EvalThresholds = DEFAULT_THRESHOLDS,
): GateResult {
  const violations: string[] = []

  // Overall pass rate
  const passRate = report.totalTests > 0
    ? (report.passed / report.totalTests) * 100
    : 0
  if (passRate < thresholds.minPassRate) {
    violations.push(
      `Pass rate ${passRate.toFixed(1)}% < minimum ${thresholds.minPassRate}%`,
    )
  }

  // Refusal rate
  const refusalRate = report.totalTests > 0
    ? (report.refused / report.totalTests) * 100
    : 0
  if (refusalRate > thresholds.maxRefusalRate) {
    violations.push(
      `Refusal rate ${refusalRate.toFixed(1)}% > maximum ${thresholds.maxRefusalRate}%`,
    )
  }

  // Latency
  if (report.avgLatencyMs > thresholds.maxAvgLatencyMs) {
    violations.push(
      `Average latency ${report.avgLatencyMs}ms > maximum ${thresholds.maxAvgLatencyMs}ms`,
    )
  }

  // Cost
  if (report.totalCostUsd > thresholds.maxTotalCostUsd) {
    violations.push(
      `Total cost $${report.totalCostUsd.toFixed(4)} > maximum $${thresholds.maxTotalCostUsd}`,
    )
  }

  // Per-app pass rates
  if (thresholds.perApp) {
    // Group results by app (extracted from test ID prefix)
    const byApp = new Map<string, { passed: number; total: number }>()
    for (const r of report.results) {
      // Test IDs follow pattern "appName-xxx" or "appName/xxx"
      const appKey = r.id.split(/[-/]/)[0]
      const entry = byApp.get(appKey) ?? { passed: 0, total: 0 }
      entry.total++
      if (r.passed) entry.passed++
      byApp.set(appKey, entry)
    }

    for (const [app, appThreshold] of Object.entries(thresholds.perApp)) {
      const stats = byApp.get(app)
      if (stats && appThreshold.minPassRate !== undefined) {
        const appPassRate = (stats.passed / stats.total) * 100
        if (appPassRate < appThreshold.minPassRate) {
          violations.push(
            `[${app}] Pass rate ${appPassRate.toFixed(1)}% < minimum ${appThreshold.minPassRate}%`,
          )
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    metrics: {
      passRate,
      refusalRate,
      avgLatencyMs: report.avgLatencyMs,
      totalCostUsd: report.totalCostUsd,
      totalTests: report.totalTests,
    },
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────

async function main() {
  // Parse CLI: <report.json> [--config <path>]
  const argv = process.argv.slice(2)
  let reportPath: string | undefined
  let configPath: string = DEFAULT_CONFIG_PATH
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config' && argv[i + 1]) {
      configPath = path.resolve(argv[++i])
    } else if (!reportPath) {
      reportPath = argv[i]
    }
  }

  if (!reportPath) {
    console.error('Usage: eval-gate.ts <report.json> [--config <path>]')
    process.exit(1)
  }

  const fullPath = path.resolve(reportPath)
  if (!fs.existsSync(fullPath)) {
    console.error(`Report file not found: ${fullPath}`)
    process.exit(1)
  }

  const configExists = fs.existsSync(configPath)
  const thresholds = loadThresholds(configPath)
  if (!configExists) {
    console.log('ℹ️  No eval.config.json found — using DEFAULT_THRESHOLDS')
  } else {
    console.log(`📋 Loaded thresholds from ${path.relative(process.cwd(), configPath)}`)
  }

  const report: EvalReport = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
  const result = checkEvalGate(report, thresholds)

  console.log('\n🔒 AI Eval Gate Check')
  console.log(`   Pass rate:    ${result.metrics.passRate.toFixed(1)}%`)
  console.log(`   Refusal rate: ${result.metrics.refusalRate.toFixed(1)}%`)
  console.log(`   Avg latency:  ${result.metrics.avgLatencyMs}ms`)
  console.log(`   Total cost:   $${result.metrics.totalCostUsd.toFixed(4)}`)
  console.log(`   Total tests:  ${result.metrics.totalTests}`)

  if (result.passed) {
    console.log('\n✅ All eval thresholds met — gate PASSED\n')
    process.exit(0)
  } else {
    console.error('\n❌ Eval gate FAILED:')
    result.violations.forEach((v) => console.error(`   • ${v}`))
    console.error('')
    process.exit(1)
  }
}

if (process.argv[1]?.includes('eval-gate')) {
  main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
  })
}
