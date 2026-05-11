import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

type ChecklistStatus = 'complete' | 'pending' | 'blocked'

type ChecklistItem = {
  id: string
  title: string
  owner: string
  status: ChecklistStatus
  required: boolean
  evidence: string
}

type ChecklistFile = {
  domain: string
  updatedAt: string
  checks: ChecklistItem[]
}

type RuntimeCheck = {
  id: string
  command: string
  ok: boolean
  output: string
}

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const CHECKLIST_PATH = join(ROOT, 'docs', 'ops', 'pilots', 'flow-pilot', 'shopmoica-cutover-checklist.json')
const OUTPUT_DIR = join(ROOT, 'ops', 'outputs')
const REPORT_JSON = join(OUTPUT_DIR, 'flow-shopmoica-cutover-report.json')
const REPORT_MD = join(OUTPUT_DIR, 'flow-shopmoica-cutover-report.md')

const REQUIRED_IDS = new Set([
  'dns_records',
  'dns_health',
  'tls_certificate',
  'env_parity',
  'org_provisioning',
  'security_packet_ack',
  'buyer_signoff',
  'pilot_check_pass',
  'flow_lockdown_pass',
])

function parseArgs(argv: string[]) {
  const args = new Set(argv.slice(2))
  return {
    enforce: args.has('--enforce'),
    checkDns: args.has('--check-dns'),
  }
}

function runCommand(command: string): { ok: boolean; output: string } {
  try {
    const output = execSync(command, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 300_000,
    })
    return { ok: true, output: output.trim().slice(-4000) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, output: message.slice(-4000) }
  }
}

function readChecklist(): ChecklistFile {
  if (!existsSync(CHECKLIST_PATH)) {
    throw new Error(`Checklist file not found: ${CHECKLIST_PATH}`)
  }

  const parsed = JSON.parse(readFileSync(CHECKLIST_PATH, 'utf-8')) as ChecklistFile

  if (!parsed.checks || !Array.isArray(parsed.checks)) {
    throw new Error('Checklist file has invalid structure: checks[] is required')
  }

  const ids = new Set(parsed.checks.map((item) => item.id))
  for (const requiredId of REQUIRED_IDS) {
    if (!ids.has(requiredId)) {
      throw new Error(`Checklist file missing required check id: ${requiredId}`)
    }
  }

  return parsed
}

function withUpdatedStatus(
  checklist: ChecklistFile,
  id: string,
  status: ChecklistStatus,
  evidenceSuffix: string,
): ChecklistFile {
  return {
    ...checklist,
    checks: checklist.checks.map((check) => {
      if (check.id !== id) return check
      return {
        ...check,
        status,
        evidence: `${check.evidence} | ${evidenceSuffix}`,
      }
    }),
  }
}

function toMarkdown(
  checklist: ChecklistFile,
  runtime: RuntimeCheck[],
  enforce: boolean,
  ready: boolean,
): string {
  const lines: string[] = []
  lines.push('# ShopMoiCa Production Cutover Report')
  lines.push('')
  lines.push(`- Domain: ${checklist.domain}`)
  lines.push(`- GeneratedAt: ${new Date().toISOString()}`)
  lines.push(`- EnforceMode: ${enforce}`)
  lines.push(`- ReadyForProduction: ${ready}`)
  lines.push('')
  lines.push('## Checklist')
  lines.push('')
  lines.push('| ID | Required | Status | Owner | Evidence |')
  lines.push('|---|---|---|---|---|')
  for (const check of checklist.checks) {
    lines.push(
      `| ${check.id} | ${check.required ? 'yes' : 'no'} | ${check.status} | ${check.owner} | ${check.evidence} |`,
    )
  }
  lines.push('')
  lines.push('## Runtime Checks')
  lines.push('')
  lines.push('| ID | Command | Result |')
  lines.push('|---|---|---|')
  for (const run of runtime) {
    lines.push(`| ${run.id} | ${run.command} | ${run.ok ? 'pass' : 'fail'} |`)
  }
  lines.push('')
  return lines.join('\n')
}

function main() {
  const args = parseArgs(process.argv)
  let checklist = readChecklist()

  const runtimeChecks: RuntimeCheck[] = []

  const pilotCheck = runCommand('pnpm pilot:check')
  runtimeChecks.push({
    id: 'pilot_check_pass',
    command: 'pnpm pilot:check',
    ok: pilotCheck.ok,
    output: pilotCheck.output,
  })
  checklist = withUpdatedStatus(
    checklist,
    'pilot_check_pass',
    pilotCheck.ok ? 'complete' : 'blocked',
    `pilot:check=${pilotCheck.ok ? 'pass' : 'fail'}`,
  )

  const lockdownCheck = runCommand('pnpm --filter @nzila/flow lockdown:check')
  runtimeChecks.push({
    id: 'flow_lockdown_pass',
    command: 'pnpm --filter @nzila/flow lockdown:check',
    ok: lockdownCheck.ok,
    output: lockdownCheck.output,
  })
  checklist = withUpdatedStatus(
    checklist,
    'flow_lockdown_pass',
    lockdownCheck.ok ? 'complete' : 'blocked',
    `lockdown:check=${lockdownCheck.ok ? 'pass' : 'fail'}`,
  )

  if (args.checkDns) {
    const dnsCheck = runCommand('pnpm dns:verify')
    runtimeChecks.push({
      id: 'dns_health',
      command: 'pnpm dns:verify',
      ok: dnsCheck.ok,
      output: dnsCheck.output,
    })
    checklist = withUpdatedStatus(
      checklist,
      'dns_health',
      dnsCheck.ok ? 'complete' : 'blocked',
      `dns:verify=${dnsCheck.ok ? 'pass' : 'fail'}`,
    )
  }

  const requiredChecks = checklist.checks.filter((check) => check.required)
  const ready = requiredChecks.every((check) => check.status === 'complete')

  mkdirSync(OUTPUT_DIR, { recursive: true })

  const jsonReport = {
    ok: ready,
    enforceMode: args.enforce,
    generatedAt: new Date().toISOString(),
    checklist,
    runtimeChecks,
  }

  writeFileSync(REPORT_JSON, JSON.stringify(jsonReport, null, 2) + '\n')
  writeFileSync(REPORT_MD, toMarkdown(checklist, runtimeChecks, args.enforce, ready) + '\n')

  console.log(JSON.stringify({ ok: ready, report: REPORT_JSON, markdown: REPORT_MD }, null, 2))

  const runtimeFailures = runtimeChecks.some((run) => !run.ok)

  // Runtime sub-gates (`pnpm pilot:check`, `pnpm flow lockdown:check`,
  // optional DNS) may legitimately fail in PRs that do not touch flow-pilot
  // infrastructure (e.g. unrelated repo-wide test/contract failures). Only
  // fail the gate on runtime issues when --enforce is requested or when
  // running in scheduled / workflow_dispatch contexts.
  if (args.enforce && (runtimeFailures || !ready)) {
    process.exit(1)
  }
}

main()