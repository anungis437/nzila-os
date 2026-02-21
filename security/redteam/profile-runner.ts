/**
 * Red-Team Profile Runner
 *
 * Runs red-team test scenarios filtered by governance profile.
 * Outputs a structured JSON report with scenario list, PASS/FAIL,
 * environment metadata, and commit SHA.
 *
 * Usage:
 *   npx tsx security/redteam/profile-runner.ts                    # all profiles
 *   npx tsx security/redteam/profile-runner.ts --profile core     # core scenarios only
 *   npx tsx security/redteam/profile-runner.ts --profile abr-insights
 *   npx tsx security/redteam/profile-runner.ts --seed 123         # override RNG seed
 *   npx tsx security/redteam/profile-runner.ts --json             # JSON output only
 *
 * Profiles:
 *   core          — RED-TEAM-001 through RED-TEAM-018 (adversarial + breach-harness)
 *   abr-insights  — RED-TEAM-ABR-001 through RED-TEAM-ABR-003
 *   all           — every profile (default)
 */
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  getRunEnvironment,
  getDefaultSeed,
  stableJsonStringify,
  type RunEnvironment,
} from './deterministic'

// ── Types ───────────────────────────────────────────────────────────────────

interface ScenarioResult {
  id: string
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  durationMs: number
}

interface ProfileReport {
  profile: string
  seed: number
  overallStatus: 'PASS' | 'FAIL'
  environment: RunEnvironment
  scenarios: ScenarioResult[]
  totalScenarios: number
  passed: number
  failed: number
  durationMs: number
}

// ── Profile Definitions ─────────────────────────────────────────────────────

const PROFILES: Record<string, { files: string[]; description: string }> = {
  core: {
    files: ['adversarial.test.ts', 'breach-harness-extended.test.ts'],
    description: 'NzilaOS core governance controls (RED-TEAM-001 through RED-TEAM-018)',
  },
  'abr-insights': {
    files: ['abr-adversarial.test.ts'],
    description: 'ABR Insights confidential reporting controls (RED-TEAM-ABR-001 through RED-TEAM-ABR-003)',
  },
}

// ── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(argv: string[]): { profile: string; seed: number; jsonOnly: boolean } {
  let profile = 'all'
  let seed = getDefaultSeed()
  let jsonOnly = false

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) {
      profile = argv[++i]!
    } else if (argv[i] === '--seed' && argv[i + 1]) {
      seed = parseInt(argv[++i]!, 10)
    } else if (argv[i] === '--json') {
      jsonOnly = true
    }
  }

  return { profile, seed, jsonOnly }
}

// ── Runner ──────────────────────────────────────────────────────────────────

function runProfile(profileName: string, files: string[], seed: number): ProfileReport {
  const env = getRunEnvironment()
  const scenarios: ScenarioResult[] = []
  const startTime = Date.now()

  const fileArgs = files.map((f) => join(__dirname, f)).join(' ')
  const cmd = `npx vitest run ${fileArgs} --reporter=json --no-color`

  let rawOutput = ''
  let exitCode = 0

  try {
    rawOutput = execSync(cmd, {
      encoding: 'utf-8',
      cwd: __dirname,
      env: { ...process.env, REDTEAM_SEED: String(seed) },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
    })
  } catch (err: any) {
    exitCode = err.status ?? 1
    rawOutput = err.stdout ?? ''
  }

  // Parse vitest JSON output
  try {
    // Vitest JSON output may be preceded by console output; find last { ... }
    const jsonStart = rawOutput.lastIndexOf('{"numTotalTestSuites"')
    if (jsonStart >= 0) {
      const json = JSON.parse(rawOutput.slice(jsonStart))
      for (const suite of json.testResults ?? []) {
        for (const t of suite.assertionResults ?? []) {
          const id = t.ancestorTitles?.[0]?.match(/RED-TEAM-(?:ABR-)?\d+/)?.[0] ?? 'UNKNOWN'
          scenarios.push({
            id,
            name: t.fullName ?? t.title ?? 'unnamed',
            status: t.status === 'passed' ? 'PASS' : 'FAIL',
            durationMs: Math.round(t.duration ?? 0),
          })
        }
      }
    }
  } catch {
    // If JSON parsing fails, mark everything as failed
    scenarios.push({
      id: 'PARSE-ERROR',
      name: `Failed to parse vitest output for ${profileName}`,
      status: 'FAIL',
      durationMs: 0,
    })
  }

  const passed = scenarios.filter((s) => s.status === 'PASS').length
  const failed = scenarios.filter((s) => s.status === 'FAIL').length

  return {
    profile: profileName,
    seed,
    overallStatus: failed > 0 || exitCode !== 0 ? 'FAIL' : 'PASS',
    environment: env,
    scenarios,
    totalScenarios: scenarios.length,
    passed,
    failed,
    durationMs: Date.now() - startTime,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const { profile, seed, jsonOnly } = parseArgs(process.argv)

  const profilesToRun =
    profile === 'all'
      ? Object.entries(PROFILES)
      : [[profile, PROFILES[profile]] as const].filter(([, v]) => v)

  if (profilesToRun.length === 0) {
    console.error(`Unknown profile: ${profile}`)
    console.error(`Available: ${Object.keys(PROFILES).join(', ')}, all`)
    process.exit(1)
  }

  const reports: ProfileReport[] = []

  for (const [name, def] of profilesToRun) {
    if (!jsonOnly) {
      console.log(`\n🔴 Running red-team profile: ${name as string}`)
      console.log(`   ${(def as any).description}`)
      console.log(`   Seed: ${seed}\n`)
    }
    const report = runProfile(name as string, (def as any).files, seed)
    reports.push(report)
  }

  // Write combined report
  const outputDir = join(__dirname, '..', '..', 'security', 'redteam')
  mkdirSync(outputDir, { recursive: true })

  const combinedReport = {
    generatedAt: new Date().toISOString(),
    seed,
    profiles: reports,
    overallStatus: reports.every((r) => r.overallStatus === 'PASS') ? 'PASS' : 'FAIL',
    totalScenarios: reports.reduce((acc, r) => acc + r.totalScenarios, 0),
    totalPassed: reports.reduce((acc, r) => acc + r.passed, 0),
    totalFailed: reports.reduce((acc, r) => acc + r.failed, 0),
  }

  const reportPath = join(outputDir, 'profile-report.json')
  writeFileSync(reportPath, stableJsonStringify(combinedReport), 'utf-8')

  if (jsonOnly) {
    console.log(stableJsonStringify(combinedReport))
  } else {
    // Human-readable summary
    console.log('\n' + '═'.repeat(60))
    console.log('  RED-TEAM PROFILE REPORT')
    console.log('═'.repeat(60))

    for (const r of reports) {
      const icon = r.overallStatus === 'PASS' ? '✅' : '❌'
      console.log(`\n${icon} ${r.profile} — ${r.overallStatus} (${r.passed}/${r.totalScenarios})`)
      for (const s of r.scenarios) {
        const si = s.status === 'PASS' ? '  ✓' : '  ✗'
        console.log(`${si} [${s.id}] ${s.name} (${s.durationMs}ms)`)
      }
    }

    console.log('\n' + '─'.repeat(60))
    console.log(`  Overall: ${combinedReport.overallStatus}`)
    console.log(`  Scenarios: ${combinedReport.totalPassed}/${combinedReport.totalScenarios} passed`)
    console.log(`  Seed: ${seed}`)
    console.log(`  Report: ${reportPath}`)
    console.log('─'.repeat(60) + '\n')
  }

  if (combinedReport.overallStatus === 'FAIL') {
    process.exit(1)
  }
}

main()
