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

function resolveDatabaseUrl(): string | undefined {
  // Priority 1: Use existing environment variable
  if (process.env.DATABASE_URL) {
    console.log('[ue:qa:gate] DATABASE_URL already set in environment')
    return process.env.DATABASE_URL
  }

  // Priority 2: Load from .env file (root workspace)
  const dotEnvPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(dotEnvPath)) {
    const content = fs.readFileSync(dotEnvPath, 'utf8')
    const match = content.match(/^DATABASE_URL=(.+)$/m)
    if (match?.[1]) {
      const url = match[1].trim()
      console.log('[ue:qa:gate] Loaded DATABASE_URL from .env')
      return url
    }
  }

  console.warn('[ue:qa:gate] DATABASE_URL not found in environment or .env')
  return undefined
}

function runStep(name: string, command: string, args: string[], stepEnv: StepEnv = {}): GateStep {
  console.log(`\n[ue:qa:gate] ${name}`)
  const databaseUrl = resolveDatabaseUrl()

  const childEnv = {
    ...process.env,
    ...stepEnv,
  }

  if (databaseUrl) {
    childEnv.DATABASE_URL = databaseUrl
    console.log('[ue:qa:gate] Passing DATABASE_URL to child process')
  } else {
    console.warn('[ue:qa:gate] WARNING: DATABASE_URL not available for child process')
  }

  const cmdLine = [command, ...args.map(shellQuote)].join(' ')

  try {
    execSync(cmdLine, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: childEnv,
      shell: true,
    })

    console.log(`[ue:qa:gate] ${name} exited with code 0`)
    return {
      name,
      command,
      args,
      passed: true,
      exitCode: 0,
    }
  } catch (error) {
    const exitCode = (error as { status?: number }).status ?? 1
    console.log(`[ue:qa:gate] ${name} exited with code ${exitCode}`)

    return {
      name,
      command,
      args,
      passed: false,
      exitCode,
    }
  }
}

function main(): void {
  const steps: GateStep[] = []
  const cmd = pnpmCmd()

  steps.push(runStep('Seed deterministic UE test environment', cmd, ['ue:seed:test-env']))
  steps.push(runStep('Run UE API QA suite', cmd, ['ue:qa:api']))
  steps.push(runStep('Run UE E2E QA suite', cmd, ['ue:qa:e2e'], { PLAYWRIGHT_HTML_OPEN: 'never' }))
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
    '--enforce',
  ])
  steps.push(report)

  const finalFailures = [...failures, ...(report.passed ? [] : [`${report.name} (exit ${report.exitCode})`])]

  if (finalFailures.length > 0) {
    console.error('\n[ue:qa:gate] NO-GO')
    for (const failure of finalFailures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('\n[ue:qa:gate] GO')
}

main()
