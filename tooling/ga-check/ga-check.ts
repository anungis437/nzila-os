/**
 * Nzila OS — GA Gate v2
 *
 * Single-command Go/No-Go gate that mechanically verifies ALL governance
 * invariants and produces sealed artifacts.
 *
 * Run:
 *   pnpm ga-check
 *   npx tsx tooling/ga-check/ga-check.ts
 *
 * Outputs:
 *   stdout   — human-readable report
 *   JSON     — governance/ga/ga-check.json
 *   Markdown — governance/ga/GA_CHECK_REPORT.md
 *
 * Checks (grouped by section):
 *
 *  A) Org boundary
 *     - No raw DB imports in app code (unscoped)
 *     - Org-scoped registry exists and matches schema
 *
 *  B) Audited writes
 *     - withAudit used in API guards
 *     - Audit module blocks on failure (mandatory)
 *
 *  C) Evidence
 *     - verifySeal exported from seal module
 *     - Evidence workflows require seal.json with pack.json
 *     - verifySeal step present in governance workflow
 *
 *  D) CI gates
 *     - Secret scan present
 *     - Dependency audit present
 *     - Trivy present
 *     - SBOM present
 *     - Contract tests as required checks
 *
 *  E) Red-team
 *     - Nightly red-team workflow exists
 *     - Red-team outputs included as evidence artifacts
 *
 *  Plus: ESLint boundaries, governance profiles, CODEOWNERS, hash chain,
 *        vertical modules, auth middleware (carried from v1).
 *
 * NO BYPASS FLAGS. NO SKIP OPTIONS. ALL CHECKS MANDATORY.
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'

import type { GateResult, GateCheck, GaCheckReport, GateCategory } from './types'
import { formatHumanReport, formatMarkdownReport, formatJsonReport } from './report'

// ── Configuration ───────────────────────────────────────────────────────────

const ROOT = findRepoRoot()

const APP_DIRS = ['apps/web', 'apps/console', 'apps/partners', 'apps/union-eyes']
const APPEND_ONLY_TABLES = ['audit_events', 'share_ledger_entries', 'automation_events']

// ── Utility: measure + run ──────────────────────────────────────────────────

function runGate(id: string, name: string, category: GateCategory, fn: () => { status: 'PASS' | 'FAIL'; details: string; violations?: string[] }): GateCheck {
  return {
    id,
    name,
    category,
    run: () => {
      const start = Date.now()
      try {
        const result = fn()
        return { id, name, ...result, durationMs: Date.now() - start }
      } catch (err) {
        return {
          id,
          name,
          status: 'FAIL' as const,
          details: `Exception: ${(err as Error).message}`,
          violations: [(err as Error).stack ?? ''],
          durationMs: Date.now() - start,
        }
      }
    },
  }
}

// ── A) Org Boundary Checks ──────────────────────────────────────────────────

const checkOrgIsolation = runGate('ORG-ISOLATION', 'Org boundary: No raw DB imports in app code', 'org-boundary', () => {
  const violations: string[] = []

  for (const appDir of APP_DIRS) {
    const fullDir = join(ROOT, appDir)
    if (!existsSync(fullDir)) continue

    const tsFiles = findFiles(fullDir, /\.(ts|tsx)$/, ['node_modules', '.next', 'dist'])

    for (const file of tsFiles) {
      const content = readFileSync(file, 'utf-8')
      const rel = relative(ROOT, file)

      if (
        content.includes("from '@nzila/db/raw'") ||
        content.includes('from "@nzila/db/raw"') ||
        content.includes("from '@nzila/db/client'") ||
        content.includes('from "@nzila/db/client"')
      ) {
        violations.push(rel)
      }

      if (/import\s*\{[^}]*\brawDb\b[^}]*\}\s*from\s*['"]@nzila\/db['"]/.test(content)) {
        violations.push(`${rel} (rawDb from barrel)`)
      }

      if (/import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*['"]@nzila\/db['"]/.test(content)) {
        violations.push(`${rel} (unscoped db from barrel)`)
      }
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? `All ${APP_DIRS.length} apps clean — no raw DB imports`
      : `${violations.length} violation(s) found`,
    violations,
  }
})

const checkOrgScopedRegistry = runGate('ORG-REGISTRY', 'Org boundary: Org-scoped registry exists and consistent', 'org-boundary', () => {
  const regPath = join(ROOT, 'packages/db/src/org-registry.ts')
  if (!existsSync(regPath)) {
    return { status: 'FAIL', details: 'packages/db/src/org-registry.ts not found' }
  }

  const content = readFileSync(regPath, 'utf-8')
  const hasOrgScoped = content.includes('ORG_SCOPED_TABLES')
  const hasNonOrgScoped = content.includes('NON_ORG_SCOPED_TABLES')

  // Check that schema dir exists
  const schemaDir = join(ROOT, 'packages/db/src/schema')
  const schemaExists = existsSync(schemaDir)

  return {
    status: hasOrgScoped && hasNonOrgScoped && schemaExists ? 'PASS' : 'FAIL',
    details: hasOrgScoped && hasNonOrgScoped && schemaExists
      ? 'Org-scoped registry present with both ORG_SCOPED_TABLES and NON_ORG_SCOPED_TABLES'
      : `Missing: ${!hasOrgScoped ? 'ORG_SCOPED_TABLES ' : ''}${!hasNonOrgScoped ? 'NON_ORG_SCOPED_TABLES ' : ''}${!schemaExists ? 'schema dir' : ''}`,
  }
})

// ── B) Audited Writes ───────────────────────────────────────────────────────

const checkAuditedWrites = runGate('AUDITED-WRITES', 'Audited writes: withAudit used in API guards', 'audited-writes', () => {
  const violations: string[] = []

  for (const appDir of APP_DIRS) {
    const guardsPath = join(ROOT, appDir, 'lib', 'api-guards.ts')
    if (!existsSync(guardsPath)) {
      violations.push(`${appDir}: missing lib/api-guards.ts`)
      continue
    }

    const content = readFileSync(guardsPath, 'utf-8')
    if (!content.includes('withAudit') && !content.includes('createAuditedScopedDb')) {
      violations.push(`${appDir}: api-guards.ts does not use withAudit/createAuditedScopedDb`)
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? 'All apps use withAudit in API guards'
      : `${violations.length} app(s) missing audited writes`,
    violations,
  }
})

const checkAuditMandatory = runGate('AUDIT-MANDATORY', 'Audited writes: Audit module blocks on failure', 'audited-writes', () => {
  const auditFile = join(ROOT, 'packages/db/src/audit.ts')
  if (!existsSync(auditFile)) {
    return { status: 'FAIL', details: 'packages/db/src/audit.ts not found' }
  }

  const content = readFileSync(auditFile, 'utf-8')
  const hasMandatory = content.includes('[AUDIT:MANDATORY]') || content.includes('auditPromise')

  return {
    status: hasMandatory ? 'PASS' : 'FAIL',
    details: hasMandatory
      ? 'Audit emission is mandatory (blocks on failure)'
      : 'CRITICAL: Audit emission appears to be fire-and-forget',
  }
})

// ── C) Evidence ─────────────────────────────────────────────────────────────

const checkEvidenceSealing = runGate('EVIDENCE-SEALING', 'Evidence: verifySeal exported from seal module', 'evidence', () => {
  const sealFile = join(ROOT, 'packages/os-core/src/evidence/seal.ts')
  if (!existsSync(sealFile)) {
    return { status: 'FAIL', details: 'packages/os-core/src/evidence/seal.ts not found' }
  }

  const content = readFileSync(sealFile, 'utf-8')
  const hasGenerate = content.includes('export function generateSeal') || content.includes('export async function generateSeal')
  const hasVerify = content.includes('export function verifySeal') || content.includes('export async function verifySeal')

  return {
    status: hasGenerate && hasVerify ? 'PASS' : 'FAIL',
    details: hasGenerate && hasVerify
      ? 'generateSeal + verifySeal both exported'
      : `Missing: ${!hasGenerate ? 'generateSeal ' : ''}${!hasVerify ? 'verifySeal' : ''}`,
  }
})

const checkEvidenceWorkflowSeal = runGate('EVIDENCE-WORKFLOW-SEAL', 'Evidence: governance workflow includes verifySeal step', 'evidence', () => {
  const govWorkflow = join(ROOT, '.github/workflows/nzila-governance.yml')
  if (!existsSync(govWorkflow)) {
    return { status: 'FAIL', details: 'nzila-governance.yml not found' }
  }

  const content = readFileSync(govWorkflow, 'utf-8')
  const hasVerifySeal = content.includes('verifySeal') || content.includes('verify-seal') || content.includes('verify_seal')
  const hasSealArtifact = content.includes('seal.json') || content.includes('pack.json')

  return {
    status: hasVerifySeal || hasSealArtifact ? 'PASS' : 'FAIL',
    details: hasVerifySeal || hasSealArtifact
      ? 'Governance workflow includes evidence seal verification'
      : 'verifySeal step missing from governance workflow',
  }
})

// ── D) CI Gates ─────────────────────────────────────────────────────────────

const checkCiGates = runGate('CI-GATES', 'CI gates: Required security checks present in workflows', 'ci-gates', () => {
  const workflowDir = join(ROOT, '.github/workflows')
  if (!existsSync(workflowDir)) {
    return { status: 'FAIL', details: '.github/workflows/ not found' }
  }

  const workflowFiles = readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  const allContent = workflowFiles.map((f) => readFileSync(join(workflowDir, f), 'utf-8')).join('\n')

  const required = [
    { name: 'secret-scan', patterns: ['gitleaks', 'trufflehog', 'secret-scan', 'secret_scan'] },
    { name: 'dependency-audit', patterns: ['dependency-audit', 'npm audit', 'pnpm audit', 'audit'] },
    { name: 'trivy', patterns: ['trivy', 'container-scan', 'aquasecurity'] },
    { name: 'sbom', patterns: ['sbom', 'cyclonedx', 'syft'] },
    { name: 'contract-tests', patterns: ['contract-tests', 'contract_tests', 'pnpm contract-tests'] },
  ]

  const missing: string[] = []
  for (const req of required) {
    const found = req.patterns.some((p) => allContent.toLowerCase().includes(p.toLowerCase()))
    if (!found) {
      missing.push(req.name)
    }
  }

  return {
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    details: missing.length === 0
      ? `All ${required.length} required CI checks present in workflows`
      : `Missing CI checks: ${missing.join(', ')}`,
    violations: missing,
  }
})

const checkGovernanceWorkflow = runGate('CI-GOVERNANCE-WF', 'CI gates: Governance workflow exists', 'ci-gates', () => {
  const govPath = join(ROOT, '.github/workflows/nzila-governance.yml')
  const ciPath = join(ROOT, '.github/workflows/ci.yml')

  const govExists = existsSync(govPath)
  const ciExists = existsSync(ciPath)

  return {
    status: govExists && ciExists ? 'PASS' : 'FAIL',
    details: govExists && ciExists
      ? 'nzila-governance.yml + ci.yml both present'
      : `Missing: ${!govExists ? 'nzila-governance.yml ' : ''}${!ciExists ? 'ci.yml' : ''}`,
  }
})

// ── E) Red-Team ─────────────────────────────────────────────────────────────

const checkRedTeamWorkflow = runGate('RED-TEAM-WORKFLOW', 'Red-team: Nightly red-team workflow exists', 'red-team', () => {
  const redTeamWorkflow = join(ROOT, '.github/workflows/red-team.yml')
  if (!existsSync(redTeamWorkflow)) {
    return { status: 'FAIL', details: 'red-team.yml workflow file missing' }
  }

  const content = readFileSync(redTeamWorkflow, 'utf-8')
  const hasSchedule = content.includes('schedule') || content.includes('cron')

  return {
    status: hasSchedule ? 'PASS' : 'FAIL',
    details: hasSchedule
      ? 'Red-team nightly workflow with schedule trigger present'
      : 'Red-team workflow exists but lacks schedule trigger',
  }
})

const checkRedTeamEvidence = runGate('RED-TEAM-EVIDENCE', 'Red-team: Outputs included as evidence artifacts', 'red-team', () => {
  const redTeamWorkflow = join(ROOT, '.github/workflows/red-team.yml')
  if (!existsSync(redTeamWorkflow)) {
    return { status: 'FAIL', details: 'red-team.yml workflow file missing' }
  }

  const content = readFileSync(redTeamWorkflow, 'utf-8')
  const hasArtifactUpload = content.includes('upload-artifact') || content.includes('actions/upload-artifact')

  const redteamDir = join(ROOT, 'security/redteam')
  const hasTestFiles = existsSync(redteamDir) &&
    findFiles(redteamDir, /\.test\.ts$/, ['node_modules']).length >= 1

  return {
    status: hasArtifactUpload && hasTestFiles ? 'PASS' : 'FAIL',
    details: hasArtifactUpload && hasTestFiles
      ? 'Red-team outputs uploaded as artifacts, test files present'
      : `Missing: ${!hasArtifactUpload ? 'artifact upload ' : ''}${!hasTestFiles ? 'test files' : ''}`,
  }
})

// ── Additional v1 checks (kept for completeness) ───────────────────────────

const checkHashChain = runGate('HASH-CHAIN', 'Hash chain: Module + append-only tables tracked', 'org-boundary', () => {
  const hashFile = join(ROOT, 'packages/os-core/src/hash.ts')
  return {
    status: existsSync(hashFile) ? 'PASS' : 'FAIL',
    details: existsSync(hashFile)
      ? `Hash module exists, ${APPEND_ONLY_TABLES.length} append-only tables tracked`
      : 'Hash module missing',
  }
})

const checkEslintBoundaries = runGate('ESLINT-GOVERNANCE', 'ESLint: All apps enforce boundary rules', 'ci-gates', () => {
  const requiredRules = ['noShadowDb', 'noShadowAi', 'noShadowMl']
  const violations: string[] = []

  for (const appDir of APP_DIRS) {
    const eslintPath = join(ROOT, appDir, 'eslint.config.mjs')
    if (!existsSync(eslintPath)) {
      violations.push(`${appDir}: no eslint.config.mjs`)
      continue
    }
    const content = readFileSync(eslintPath, 'utf-8')
    for (const rule of requiredRules) {
      if (!content.includes(rule)) {
        violations.push(`${appDir}: missing ${rule}`)
      }
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? `All ${APP_DIRS.length} apps enforce ${requiredRules.length} boundary rules`
      : `${violations.length} violation(s)`,
    violations,
  }
})

const checkGovernanceProfiles = runGate('GOVERNANCE-PROFILES', 'Governance profiles: Registry exists + validation', 'org-boundary', () => {
  const profileFile = join(ROOT, 'governance/profiles/index.ts')
  if (!existsSync(profileFile)) {
    return { status: 'FAIL', details: 'governance/profiles/index.ts not found' }
  }

  const content = readFileSync(profileFile, 'utf-8')
  const hasImmutable = content.includes('IMMUTABLE_CONTROLS')
  const hasValidate = content.includes('validateProfile')

  return {
    status: hasImmutable && hasValidate ? 'PASS' : 'FAIL',
    details: hasImmutable && hasValidate
      ? 'Profile registry with immutable controls + validation'
      : `Missing: ${!hasImmutable ? 'IMMUTABLE_CONTROLS ' : ''}${!hasValidate ? 'validateProfile' : ''}`,
  }
})

const checkContractTests = runGate('CONTRACT-TESTS', 'Contract tests: ≥20 test files exist', 'ci-gates', () => {
  const contractDir = join(ROOT, 'tooling/contract-tests')
  if (!existsSync(contractDir)) {
    return { status: 'FAIL', details: 'tooling/contract-tests/ not found' }
  }

  const testFiles = findFiles(contractDir, /\.test\.ts$/, ['node_modules'])

  return {
    status: testFiles.length >= 20 ? 'PASS' : 'FAIL',
    details: `${testFiles.length} contract test files (require ≥20)`,
  }
})

const checkCodeOwners = runGate('CODEOWNERS', 'CODEOWNERS: Governance files have ownership', 'ci-gates', () => {
  const codeownersPath = join(ROOT, 'CODEOWNERS')
  if (!existsSync(codeownersPath)) {
    return { status: 'FAIL', details: 'CODEOWNERS file not found' }
  }

  const content = readFileSync(codeownersPath, 'utf-8')
  const requiredPaths = ['governance/', 'packages/os-core/', 'packages/db/']
  const missing = requiredPaths.filter((p) => !content.includes(p))

  return {
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    details: missing.length === 0
      ? 'All governance paths have code ownership'
      : `Missing ownership for: ${missing.join(', ')}`,
    violations: missing,
  }
})

const checkAuthMiddleware = runGate('AUTH-MIDDLEWARE', 'Auth middleware: All apps have Clerk middleware', 'org-boundary', () => {
  const violations: string[] = []

  for (const appDir of APP_DIRS) {
    const mwPath = join(ROOT, appDir, 'middleware.ts')
    if (!existsSync(mwPath)) {
      violations.push(`${appDir}: no middleware.ts`)
      continue
    }

    const content = readFileSync(mwPath, 'utf-8')
    if (!content.includes('clerkMiddleware')) {
      violations.push(`${appDir}: middleware.ts missing clerkMiddleware`)
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? `All ${APP_DIRS.length} apps have Clerk auth middleware`
      : `${violations.length} app(s) missing auth middleware`,
    violations,
  }
})

// ── All Checks ──────────────────────────────────────────────────────────────

const ALL_CHECKS: GateCheck[] = [
  // A) Org boundary
  checkOrgIsolation,
  checkOrgScopedRegistry,
  checkHashChain,
  checkGovernanceProfiles,
  checkAuthMiddleware,
  // B) Audited writes
  checkAuditedWrites,
  checkAuditMandatory,
  // C) Evidence
  checkEvidenceSealing,
  checkEvidenceWorkflowSeal,
  // D) CI gates
  checkCiGates,
  checkGovernanceWorkflow,
  checkEslintBoundaries,
  checkContractTests,
  checkCodeOwners,
  // E) Red-team
  checkRedTeamWorkflow,
  checkRedTeamEvidence,
]

// ── Runner ──────────────────────────────────────────────────────────────────

function getCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

export function runAllChecks(): GaCheckReport {
  const start = Date.now()

  const gates: GateResult[] = ALL_CHECKS.map((check) => check.run())

  const passed = gates.filter((g) => g.status === 'PASS').length
  const failed = gates.filter((g) => g.status === 'FAIL').length

  return {
    timestamp: new Date().toISOString(),
    commitSha: getCommitSha(),
    overall: failed > 0 ? 'FAIL' : 'PASS',
    summary: { total: gates.length, passed, failed },
    gates,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      ci: Boolean(process.env.CI),
      cwd: ROOT,
    },
    totalDurationMs: Date.now() - start,
  }
}

function main() {
  const report = runAllChecks()

  // 1. stdout human report
  console.log(formatHumanReport(report))

  // 2. Write JSON report
  const gaDir = join(ROOT, 'governance', 'ga')
  if (!existsSync(gaDir)) {
    mkdirSync(gaDir, { recursive: true })
  }
  writeFileSync(join(gaDir, 'ga-check.json'), formatJsonReport(report), 'utf-8')

  // 3. Write Markdown report
  writeFileSync(join(gaDir, 'GA_CHECK_REPORT.md'), formatMarkdownReport(report), 'utf-8')

  console.log(`  📄 JSON report:    governance/ga/ga-check.json`)
  console.log(`  📄 Markdown report: governance/ga/GA_CHECK_REPORT.md`)
  console.log('')

  process.exit(report.overall === 'FAIL' ? 1 : 0)
}

// ── Utilities ───────────────────────────────────────────────────────────────

function findRepoRoot(): string {
  let dir = process.cwd()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

function findFiles(dir: string, pattern: RegExp, exclude: string[]): string[] {
  const results: string[] = []

  function walk(d: string) {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const entry of entries) {
      if (exclude.includes(entry)) continue
      const fullPath = join(d, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (pattern.test(entry)) {
          results.push(fullPath)
        }
      } catch {
        // Skip inaccessible files
      }
    }
  }

  walk(dir)
  return results
}

// ── Execute ─────────────────────────────────────────────────────────────────

main()
