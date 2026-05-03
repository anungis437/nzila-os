#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

type AgentStageName =
  | 'repo-analyst'
  | 'implementation'
  | 'qa'
  | 'security-governance'
  | 'docs-release'
  | 'qa-gate-authority'

type StageDefinition = {
  name: AgentStageName
  description: string
  commands: string[]
}

type CommandResult = {
  command: string
  exitCode: number
  durationMs: number
  passed: boolean
}

type StageResult = {
  name: AgentStageName
  description: string
  results: CommandResult[]
  passed: boolean
}

type RunnerPhase = 'analyze' | 'implement' | 'qa' | 'validate' | 'full-run'

type RunnerReport = {
  generatedAt: string
  phase: RunnerPhase
  deterministicOrder: AgentStageName[]
  changedFiles: string[]
  summaryOfChanges: string
  stages: StageResult[]
  validationCommandsRun: string[]
  validationResults: Array<{ command: string; exitCode: number; passed: boolean }>
  remainingGaps: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  decision: 'GO' | 'NO-GO'
}

const ROOT = process.cwd()
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'ai-dev-agent')
const REPORT_PATH = path.join(ARTIFACT_DIR, 'latest-report.json')
const REPORT_MD_PATH = path.join(ARTIFACT_DIR, 'latest-report.md')

function pnpmCommand(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

function parsePhase(): RunnerPhase {
  const prefixed = process.argv.find((arg) => arg.startsWith('--phase='))
  const value = prefixed?.slice('--phase='.length) as RunnerPhase | undefined

  if (!value) {
    return 'full-run'
  }

  const valid: RunnerPhase[] = ['analyze', 'implement', 'qa', 'validate', 'full-run']
  if (!valid.includes(value)) {
    throw new Error(`Invalid --phase value: ${value}. Expected one of: ${valid.join(', ')}`)
  }

  return value
}

function runCommand(command: string): CommandResult {
  const start = Date.now()
  const exec = spawnSync(command, {
    cwd: ROOT,
    env: resolveCommandEnv(command),
    shell: true,
    encoding: 'utf8',
  })

  if (exec.stdout) {
    process.stdout.write(exec.stdout)
  }
  if (exec.stderr) {
    process.stderr.write(exec.stderr)
  }

  const exitCode = exec.status ?? 1
  return {
    command,
    exitCode,
    durationMs: Date.now() - start,
    passed: exitCode === 0,
  }
}

function parseEnvContent(content: string): Record<string, string> {
  const entries: Record<string, string> = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const separatorIndex = normalized.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = normalized.slice(0, separatorIndex).trim()
    if (!key) {
      continue
    }

    let value = normalized.slice(separatorIndex + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    entries[key] = value
  }

  return entries
}

function requiresDatabaseEnv(command: string): boolean {
  return (
    command.includes('nar:chain:verify') ||
    command.includes('intelligence:pipeline-health') ||
    command.includes('validate:claims') ||
    command.includes('ue:qa:gate')
  )
}

function buildEnvWithDatabaseUrl(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const envFromFile: Record<string, string> = {}

  const envPath = path.resolve(ROOT, '.env')
  if (existsSync(envPath)) {
    Object.assign(envFromFile, parseEnvContent(readFileSync(envPath, 'utf8')))
  }

  const envLocalPath = path.resolve(ROOT, '.env.local')
  if (existsSync(envLocalPath)) {
    Object.assign(envFromFile, parseEnvContent(readFileSync(envLocalPath, 'utf8')))
  }

  const databaseUrl = envFromFile.DATABASE_URL
  if (!env.DATABASE_URL && databaseUrl) {
    env.DATABASE_URL = databaseUrl
  }

  return env
}

function resolveCommandEnv(command: string): NodeJS.ProcessEnv {
  if (!requiresDatabaseEnv(command)) {
    return process.env
  }

  return buildEnvWithDatabaseUrl()
}

function runStage(stage: StageDefinition): StageResult {
  console.log(`\n[ai-agent-runner] Stage: ${stage.name}`)
  console.log(`[ai-agent-runner] ${stage.description}`)

  const results: CommandResult[] = []

  for (const command of stage.commands) {
    console.log(`\n[ai-agent-runner] Running: ${command}`)
    const result = runCommand(command)
    results.push(result)

    if (!result.passed) {
      console.error(`[ai-agent-runner] Command failed (${result.exitCode}): ${command}`)
      return {
        name: stage.name,
        description: stage.description,
        results,
        passed: false,
      }
    }
  }

  return {
    name: stage.name,
    description: stage.description,
    results,
    passed: true,
  }
}

function getChangedFiles(): string[] {
  const status = spawnSync('git status --porcelain', {
    cwd: ROOT,
    env: process.env,
    shell: true,
    encoding: 'utf8',
  })

  if (!status.stdout) {
    return []
  }

  return status.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
}

function inferRemainingGaps(stages: StageResult[]): string[] {
  const failed = stages.find((stage) => !stage.passed)
  if (!failed) {
    return []
  }

  const failedCommand = failed.results.find((item) => !item.passed)
  if (!failedCommand) {
    return [`Stage failed without a command failure record: ${failed.name}`]
  }

  const gaps: string[] = [`Failed command: ${failedCommand.command}`]

  if (failedCommand.command.includes('ue:qa:gate')) {
    gaps.push('Resolve UE QA gate blockers (RBAC gaps, decision/NAR expectation gaps, containment failures, or pipeline failures).')
  }
  if (failedCommand.command.includes('decision:coverage:strict')) {
    gaps.push('Resolve missing strict decision coverage or proofRequired enforcement failures.')
  }
  if (failedCommand.command.includes('nar:chain:verify')) {
    gaps.push('Resolve NAR integrity chain failures before proceeding.')
  }
  if (failedCommand.command.includes('validate:claims')) {
    gaps.push('Resolve cross-org isolation or claim verification failures.')
  }
  if (failedCommand.command.includes('sre:alerts:dry-run')) {
    gaps.push('Resolve alert routing critical/ownerless state before GO.')
  }

  return gaps
}

function inferRiskLevel(stages: StageResult[]): RunnerReport['riskLevel'] {
  const firstFailedStage = stages.find((stage) => !stage.passed)
  if (!firstFailedStage) {
    return 'low'
  }

  if (firstFailedStage.name === 'security-governance' || firstFailedStage.name === 'qa-gate-authority') {
    return 'critical'
  }
  if (firstFailedStage.name === 'qa') {
    return 'high'
  }
  return 'medium'
}

function flattenCommands(stages: StageResult[]): string[] {
  return stages.flatMap((stage) => stage.results.map((result) => result.command))
}

function selectStages(phase: RunnerPhase): StageDefinition[] {
  const cmd = pnpmCommand()

  const repoAnalyst: StageDefinition = {
    name: 'repo-analyst',
    description: 'Read-only analysis against existing governance and decision coverage contracts.',
    commands: [`${cmd} governance:check`, `${cmd} decision:coverage:strict`],
  }

  const implementation: StageDefinition = {
    name: 'implementation',
    description: 'Implementation hygiene checks for scoped changes.',
    commands: [`${cmd} typecheck`, `${cmd} lint`],
  }

  const qa: StageDefinition = {
    name: 'qa',
    description: 'Deterministic fast suite and QA evidence generation.',
    commands: [`${cmd} test:fast`],
  }

  const securityGovernance: StageDefinition = {
    name: 'security-governance',
    description: 'RBAC, org isolation, decision/NAR, and pipeline integrity enforcement.',
    commands: [
      `${cmd} governance:check`,
      `${cmd} decision:coverage:strict`,
      `${cmd} intelligence:pipeline-health`,
      `${cmd} nar:chain:verify`,
      `${cmd} validate:claims`,
      `${cmd} sre:alerts:dry-run`,
    ],
  }

  const docsRelease: StageDefinition = {
    name: 'docs-release',
    description: 'Documentation coherence for release and audit readiness.',
    commands: [`${cmd} validate:docs`],
  }

  const qaGateAuthority: StageDefinition = {
    name: 'qa-gate-authority',
    description: 'Final authority gate; GO/NO-GO decision source.',
    commands: [`${cmd} ue:qa:gate -- --target ux`],
  }

  if (phase === 'analyze') return [repoAnalyst]
  if (phase === 'implement') return [implementation]
  if (phase === 'qa') return [qa, qaGateAuthority]
  if (phase === 'validate') {
    return [
      implementation,
      {
        ...securityGovernance,
        commands: [
          `${cmd} typecheck`,
          `${cmd} lint`,
          `${cmd} test:fast`,
          `${cmd} governance:check`,
          `${cmd} decision:coverage:strict`,
          `${cmd} ue:qa:gate -- --target ux`,
          `${cmd} intelligence:pipeline-health`,
          `${cmd} nar:chain:verify`,
          `${cmd} validate:claims`,
          `${cmd} sre:alerts:dry-run`,
        ],
      },
    ]
  }

  return [repoAnalyst, implementation, qa, securityGovernance, docsRelease, qaGateAuthority]
}

function toMarkdown(report: RunnerReport): string {
  const stageLines = report.stages
    .map((stage) => {
      const status = stage.passed ? 'PASS' : 'FAIL'
      const commands = stage.results
        .map((result) => `  - ${result.command} => ${result.passed ? 'PASS' : `FAIL (${result.exitCode})`}`)
        .join('\n')
      return `- ${stage.name} (${status})\n${commands}`
    })
    .join('\n')

  return [
    '# Nzila AI Agent Runner Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Phase: ${report.phase}`,
    `- Decision: ${report.decision}`,
    `- Risk Level: ${report.riskLevel}`,
    '',
    '## Stages',
    stageLines,
    '',
    '## Changed Files',
    ...(report.changedFiles.length > 0 ? report.changedFiles.map((file) => `- ${file}`) : ['- none']),
    '',
    '## Remaining Gaps',
    ...(report.remainingGaps.length > 0 ? report.remainingGaps.map((gap) => `- ${gap}`) : ['- none']),
    '',
  ].join('\n')
}

function main(): void {
  const phase = parsePhase()
  const stages = selectStages(phase)
  const stageResults: StageResult[] = []

  for (const stage of stages) {
    const result = runStage(stage)
    stageResults.push(result)

    if (!result.passed) {
      break
    }
  }

  const allPassed = stageResults.every((stage) => stage.passed)
  const report: RunnerReport = {
    generatedAt: new Date().toISOString(),
    phase,
    deterministicOrder: stages.map((stage) => stage.name),
    changedFiles: getChangedFiles(),
    summaryOfChanges: allPassed
      ? 'Pipeline completed without blocking failures.'
      : 'Pipeline stopped on first failure by fail-fast policy.',
    stages: stageResults,
    validationCommandsRun: flattenCommands(stageResults),
    validationResults: stageResults.flatMap((stage) =>
      stage.results.map((result) => ({
        command: result.command,
        exitCode: result.exitCode,
        passed: result.passed,
      })),
    ),
    remainingGaps: inferRemainingGaps(stageResults),
    riskLevel: inferRiskLevel(stageResults),
    decision: allPassed ? 'GO' : 'NO-GO',
  }

  mkdirSync(ARTIFACT_DIR, { recursive: true })
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  writeFileSync(REPORT_MD_PATH, toMarkdown(report))

  console.log('\n[ai-agent-runner] Report written:')
  console.log(`- ${path.relative(ROOT, REPORT_PATH)}`)
  console.log(`- ${path.relative(ROOT, REPORT_MD_PATH)}`)
  console.log(`[ai-agent-runner] Final decision: ${report.decision}`)

  if (!allPassed) {
    process.exit(1)
  }
}

main()
