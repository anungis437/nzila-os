import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

type GateStep = {
  name: string
  command: string
  args: string[]
  passed: boolean
  exitCode: number
}

type StepEnv = Record<string, string>
type StepMode = 'default' | 'ue-qa' | 'ue-e2e'

type GateTarget = 'ux' | 'pilot' | 'production'

function pnpmCmd(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value
  }

  return process.platform === 'win32'
    ? `"${value.replace(/"/g, '""')}"`
    : `'${value.replace(/'/g, `'\\''`)}'`
}

function parseTarget(): GateTarget {
  const explicit = process.argv.find((arg) => arg.startsWith('--target='))
  if (explicit) {
    const value = explicit.slice('--target='.length).toLowerCase()
    if (value === 'pilot' || value === 'production') return value
  }

  const flagIndex = process.argv.indexOf('--target')
  if (flagIndex >= 0) {
    const next = process.argv[flagIndex + 1]?.toLowerCase()
    if (next === 'pilot' || next === 'production') return next
  }

  return 'ux'
}

function resolveDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const dotEnvPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(dotEnvPath)) {
    const content = fs.readFileSync(dotEnvPath, 'utf8')
    const match = content.match(/^DATABASE_URL=(.+)$/m)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return undefined
}

function runStep(name: string, command: string, args: string[], stepEnv: StepEnv = {}, mode: StepMode = 'default'): GateStep {
  console.log(`\n[ue:qa:gate] ${name}`)
  const databaseUrl = resolveDatabaseUrl()

  const qaEnv = mode === 'ue-qa' || mode === 'ue-e2e'
    ? {
        QA_TEST_ENV: 'true',
        NODE_ENV: 'test',
      }
    : {}

  const e2eEnv = mode === 'ue-e2e'
    ? {
        AUTH_SECRET: 'test-auth-secret',
        VOTING_SECRET: 'test-voting-secret-0123456789abcdef',
        PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002',
        PLAYWRIGHT_TEST_AUTH: 'true',
        UE_E2E_RISK_BYPASS: 'true',
      }
    : {}

  const childEnv = {
    ...process.env,
    ...qaEnv,
    ...e2eEnv,
    ...stepEnv,
  }

  if (databaseUrl) {
    childEnv.DATABASE_URL = databaseUrl
  }

  const cmdLine = [command, ...args.map(shellQuote)].join(' ')

  try {
    execSync(cmdLine, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: childEnv,
      shell: true,
    })

    return {
      name,
      command,
      args,
      passed: true,
      exitCode: 0,
    }
  } catch (error) {
    const exitCode = (error as { status?: number }).status ?? 1

    return {
      name,
      command,
      args,
      passed: false,
      exitCode,
    }
  }
}

function ensureArtifacts(): string[] {
  const resolvedOutDir = path.join(process.cwd(), 'artifacts', 'ue-qa')
  const required = [
    path.join(resolvedOutDir, 'latest-results.json'),
    path.join(resolvedOutDir, 'qa-report.json'),
    path.join(resolvedOutDir, 'qa-report.md'),
    path.join(resolvedOutDir, 'readiness-summary.md'),
  ]

  return required.filter((filePath) => !fs.existsSync(filePath))
}

function main(): void {
  const target = parseTarget()
  const steps: GateStep[] = []
  const cmd = pnpmCmd()

  steps.push(runStep('Seed deterministic UE test environment', cmd, ['ue:seed:test-env'], {}, 'ue-qa'))
  steps.push(runStep('Run UE API QA suite', cmd, ['ue:qa:api'], {}, 'ue-qa'))
  steps.push(runStep('Run UE E2E QA suite', cmd, ['ue:qa:e2e'], { PLAYWRIGHT_HTML_OPEN: 'never' }, 'ue-e2e'))
  steps.push(runStep('Run control-plane pipeline dry-run', cmd, ['--filter', '@nzila/control-plane', 'job:aggregate-dry-run']))
  steps.push(runStep('Verify NAR chain job', cmd, ['--filter', '@nzila/control-plane', 'job:verify-nar-chain']))

  const failures = steps.filter((s) => !s.passed).map((s) => `${s.name} (exit ${s.exitCode})`)

  const outDir = path.join(process.cwd(), 'artifacts', 'ue-qa')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'latest-results.json')

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        target,
        steps,
        failures,
      },
      null,
      2,
    ),
  )

  const report = runStep('Generate and enforce UE QA report', cmd, [
    'ue:qa:report',
    '--',
    `--results=${outPath}`,
    `--target=${target}`,
    '--enforce',
  ], {}, 'ue-qa')
  steps.push(report)

  const finalFailures = [...failures, ...(report.passed ? [] : [`${report.name} (exit ${report.exitCode})`])]

  const missingArtifacts = ensureArtifacts()
  if (missingArtifacts.length > 0) {
    finalFailures.push(`Missing gate artifacts: ${missingArtifacts.join(', ')}`)
  }

  if (finalFailures.length > 0) {
    console.error(`\n[ue:qa:gate] NO_GO for target=${target}`)
    for (const failure of finalFailures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log(`\n[ue:qa:gate] PASS target=${target}`)
}

main()
