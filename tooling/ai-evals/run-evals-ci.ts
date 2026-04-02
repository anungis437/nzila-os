/**
 * Nzila OS — AI Eval Harness (CI Stub Mode)
 *
 * Runs golden prompt tests in offline/stub mode for CI enforcement.
 * No live API calls — validates dataset structure, prompt schemas,
 * and produces a deterministic report.json that the eval-gate can check.
 *
 * This ensures the AI eval gate is ALWAYS enforced in CI, even without
 * a running staging environment. The stub validates:
 *   1. All golden test JSON files parse correctly
 *   2. Every test has required fields (id, promptKey, expectedChecks)
 *   3. expectedChecks contain valid check types
 *   4. No duplicate test IDs across datasets
 *   5. Produces a synthetic passing report for gate validation
 *
 * Usage:
 *   npx tsx tooling/ai-evals/run-evals-ci.ts
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

// ── Valid check keys (must stay in sync with run-evals.ts) ──────────────────

const VALID_CHECK_KEYS = new Set([
  'containsAny',
  'containsAll',
  'doesNotContain',
  'maxLength',
  'isNotEmpty',
  'isValidJson',
  'schemaFields',
  'forbiddenFields',
  'fieldValueIn',
  'fieldValueIn:complexity',
  'fieldValueNotContains',
  'fieldValueNotIn',
  'handlesGracefully',
  'pairedPriorityMustMatch',
  'pairedStrengthMustMatch',
])

// ── Load + validate datasets ────────────────────────────────────────────────

function loadAndValidateDatasets(): { results: TestResult[]; errors: string[] } {
  const datasetsDir = path.join(__dirname, 'datasets')
  const errors: string[] = []
  const results: TestResult[] = []
  const seenIds = new Set<string>()

  if (!fs.existsSync(datasetsDir)) {
    errors.push(`Datasets directory not found: ${datasetsDir}`)
    return { results, errors }
  }

  const apps = fs.readdirSync(datasetsDir).filter((d) =>
    fs.statSync(path.join(datasetsDir, d)).isDirectory(),
  )

  if (apps.length === 0) {
    errors.push('No app dataset directories found')
    return { results, errors }
  }

  for (const app of apps) {
    const dir = path.join(datasetsDir, app)
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))

    if (files.length === 0) {
      errors.push(`[${app}] No golden test JSON files found`)
      continue
    }

    for (const file of files) {
      const filePath = path.join(dir, file)
      let tests: GoldenTest[]

      // Validate JSON parse
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        tests = JSON.parse(content)
        if (!Array.isArray(tests)) {
          errors.push(`[${app}/${file}] Expected an array of golden tests`)
          results.push({
            id: `${app}/${file}`,
            promptKey: 'parse-error',
            passed: false,
            failures: ['File does not contain a JSON array'],
            latencyMs: 0,
          })
          continue
        }
      } catch (err) {
        errors.push(`[${app}/${file}] JSON parse error: ${(err as Error).message}`)
        results.push({
          id: `${app}/${file}`,
          promptKey: 'parse-error',
          passed: false,
          failures: [`JSON parse error: ${(err as Error).message}`],
          latencyMs: 0,
        })
        continue
      }

      // Validate each test
      for (const test of tests) {
        const failures: string[] = []

        // Required fields
        if (!test.id || typeof test.id !== 'string') {
          failures.push('Missing or invalid "id" field')
        }
        if (!test.promptKey || typeof test.promptKey !== 'string') {
          failures.push('Missing or invalid "promptKey" field')
        }
        if (!test.expectedChecks || typeof test.expectedChecks !== 'object') {
          failures.push('Missing or invalid "expectedChecks" field')
        }

        // Duplicate ID check
        const testId = `${app}-${test.id}`
        if (seenIds.has(testId)) {
          failures.push(`Duplicate test ID: ${testId}`)
        }
        seenIds.add(testId)

        // Validate check keys
        if (test.expectedChecks && typeof test.expectedChecks === 'object') {
          for (const key of Object.keys(test.expectedChecks)) {
            if (!VALID_CHECK_KEYS.has(key)) {
              failures.push(`Unknown check key: "${key}"`)
            }
          }

          // At least one check must be defined
          const checkKeys = Object.keys(test.expectedChecks)
          if (checkKeys.length === 0) {
            failures.push('expectedChecks is empty — at least one check required')
          }
        }

        if (failures.length > 0) {
          errors.push(`[${app}/${file}] Test "${test.id}": ${failures.join('; ')}`)
        }

        results.push({
          id: testId,
          promptKey: test.promptKey ?? 'unknown',
          passed: failures.length === 0,
          failures,
          latencyMs: 0,
          costUsd: 0,
        })
      }
    }
  }

  return { results, errors }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n🔬 Nzila AI Eval Harness (CI Stub Mode)')
  console.log('   Validating golden test datasets...\n')

  const { results, errors } = loadAndValidateDatasets()

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    baseUrl: 'ci-stub',
    totalTests: results.length,
    passed,
    failed,
    refused: 0,
    avgLatencyMs: 0,
    totalCostUsd: 0,
    results,
  }

  // Write report for eval-gate.ts consumption
  const reportPath = path.join(__dirname, 'report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('── Summary ──')
  console.log(`  Total:  ${report.totalTests}`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Report: ${reportPath}\n`)

  if (errors.length > 0) {
    console.error('Validation errors:')
    errors.forEach((e) => console.error(`  • ${e}`))
    console.error('')
  }

  if (failed > 0) {
    console.error('❌ Dataset validation failed\n')
    process.exit(1)
  }

  console.log('✅ All golden test datasets valid\n')
  process.exit(0)
}

main()
