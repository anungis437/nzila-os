/**
 * Nzila OS — AI Evaluation Harness
 *
 * Runs golden prompt tests against a staging deployment and outputs
 * a structured report. Tests schema validation, refusal rate, latency,
 * and cost estimates.
 *
 * Usage:
 *   npx tsx tooling/ai-evals/run-evals.ts --baseUrl http://localhost:3001 --token <clerk_token>
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Types ───────────────────────────────────────────────────────────────────

interface GoldenTest {
  id: string
  promptKey: string
  input: string
  variables?: Record<string, string>
  expectedChecks: {
    containsAny?: string[]
    containsAll?: string[]
    maxLength?: number
    isNotEmpty?: boolean
    isValidJson?: boolean
    schemaFields?: string[]
  }
}

interface TestResult {
  id: string
  promptKey: string
  passed: boolean
  failures: string[]
  latencyMs: number
  tokensIn?: number
  tokensOut?: number
  costUsd?: number
  error?: string
}

interface EvalReport {
  timestamp: string
  baseUrl: string
  totalTests: number
  passed: number
  failed: number
  refused: number
  avgLatencyMs: number
  totalCostUsd: number
  results: TestResult[]
}

// ── CLI Args ────────────────────────────────────────────────────────────────

function parseArgs(): { baseUrl: string; token: string; appKey?: string } {
  const args = process.argv.slice(2)
  let baseUrl = 'http://localhost:3001'
  let token = ''
  let appKey: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--baseUrl' && args[i + 1]) baseUrl = args[++i]
    if (args[i] === '--token' && args[i + 1]) token = args[++i]
    if (args[i] === '--appKey' && args[i + 1]) appKey = args[++i]
  }

  if (!token) {
    console.error('Usage: npx tsx run-evals.ts --baseUrl <url> --token <clerk_token> [--appKey <app>]')
    process.exit(1)
  }

  return { baseUrl, token, appKey }
}

// ── Load datasets ───────────────────────────────────────────────────────────

function loadDatasets(appKey?: string): { app: string; tests: GoldenTest[] }[] {
  const datasetsDir = path.join(__dirname, 'datasets')
  const apps = fs.readdirSync(datasetsDir).filter((d) =>
    fs.statSync(path.join(datasetsDir, d)).isDirectory(),
  )

  const filtered = appKey ? apps.filter((a) => a === appKey) : apps

  return filtered.map((app) => {
    const dir = path.join(datasetsDir, app)
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    const tests: GoldenTest[] = files.flatMap((f) => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8')
      return JSON.parse(content) as GoldenTest[]
    })
    return { app, tests }
  })
}

// ── Run checks ──────────────────────────────────────────────────────────────

function runChecks(content: string, checks: GoldenTest['expectedChecks']): string[] {
  const failures: string[] = []

  if (checks.isNotEmpty && (!content || content.trim().length === 0)) {
    failures.push('Response is empty')
  }

  if (checks.maxLength && content.length > checks.maxLength) {
    failures.push(`Response exceeds max length: ${content.length} > ${checks.maxLength}`)
  }

  if (checks.containsAny) {
    const found = checks.containsAny.some((kw) =>
      content.toLowerCase().includes(kw.toLowerCase()),
    )
    if (!found) {
      failures.push(`Response does not contain any of: ${checks.containsAny.join(', ')}`)
    }
  }

  if (checks.containsAll) {
    for (const kw of checks.containsAll) {
      if (!content.toLowerCase().includes(kw.toLowerCase())) {
        failures.push(`Response missing required keyword: ${kw}`)
      }
    }
  }

  if (checks.isValidJson) {
    try {
      const parsed = JSON.parse(content)
      if (checks.schemaFields) {
        for (const field of checks.schemaFields) {
          if (!(field in parsed)) {
            failures.push(`JSON missing required field: ${field}`)
          }
        }
      }
    } catch {
      failures.push('Response is not valid JSON')
    }
  }

  return failures
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { baseUrl, token, appKey } = parseArgs()
  const datasets = loadDatasets(appKey)

  console.log(`\n🔬 Nzila AI Eval Harness`)
  console.log(`   Base URL: ${baseUrl}`)
  console.log(`   Datasets: ${datasets.length} app(s)\n`)

  const allResults: TestResult[] = []
  let refused = 0

  for (const { app, tests } of datasets) {
    console.log(`── ${app} (${tests.length} tests) ──`)

    for (const test of tests) {
      const startTime = Date.now()
      let result: TestResult

      try {
        // Use a test entity ID and profile for evals
        const res = await fetch(`${baseUrl}/api/ai/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            entityId: process.env.EVAL_ENTITY_ID ?? '00000000-0000-0000-0000-000000000000',
            appKey: app,
            profileKey: 'default',
            promptKey: test.promptKey,
            input: test.input,
            variables: test.variables,
            dataClass: 'internal',
          }),
        })

        const latencyMs = Date.now() - startTime

        if (res.status === 429 || res.status === 403) {
          refused++
          result = {
            id: test.id,
            promptKey: test.promptKey,
            passed: false,
            failures: [`Refused: HTTP ${res.status}`],
            latencyMs,
            error: `HTTP ${res.status}`,
          }
        } else if (!res.ok) {
          const err = await res.text()
          result = {
            id: test.id,
            promptKey: test.promptKey,
            passed: false,
            failures: [`HTTP error: ${res.status}`],
            latencyMs,
            error: err,
          }
        } else {
          const body = await res.json()
          const failures = runChecks(body.content ?? '', test.expectedChecks)

          result = {
            id: test.id,
            promptKey: test.promptKey,
            passed: failures.length === 0,
            failures,
            latencyMs,
            tokensIn: body.tokensIn,
            tokensOut: body.tokensOut,
            costUsd: body.costUsd,
          }
        }
      } catch (err) {
        result = {
          id: test.id,
          promptKey: test.promptKey,
          passed: false,
          failures: [`Network error: ${err}`],
          latencyMs: Date.now() - startTime,
          error: String(err),
        }
      }

      const status = result.passed ? '✅' : '❌'
      console.log(`  ${status} ${test.id} (${result.latencyMs}ms)`)
      if (result.failures.length > 0) {
        result.failures.forEach((f) => console.log(`     ↳ ${f}`))
      }

      allResults.push(result)
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────

  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    baseUrl,
    totalTests: allResults.length,
    passed: allResults.filter((r) => r.passed).length,
    failed: allResults.filter((r) => !r.passed).length,
    refused,
    avgLatencyMs: Math.round(
      allResults.reduce((sum, r) => sum + r.latencyMs, 0) / allResults.length || 0,
    ),
    totalCostUsd: allResults.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
    results: allResults,
  }

  const reportPath = path.join(__dirname, 'report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(`\n── Summary ──`)
  console.log(`  Total:    ${report.totalTests}`)
  console.log(`  Passed:   ${report.passed}`)
  console.log(`  Failed:   ${report.failed}`)
  console.log(`  Refused:  ${report.refused}`)
  console.log(`  Avg Latency: ${report.avgLatencyMs}ms`)
  console.log(`  Total Cost:  $${report.totalCostUsd.toFixed(4)}`)
  console.log(`  Report:   ${reportPath}\n`)

  process.exit(report.failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Eval harness failed:', err)
  process.exit(1)
})
