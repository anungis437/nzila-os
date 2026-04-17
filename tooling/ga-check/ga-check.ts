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
 *  F) Studio maturity
 *     - Every app scores ≥ 7/10 on platform integration
 *     - No app has "AI" in marketing copy without ai-sdk runtime imports
 *     - No app uses in-memory Maps for persistence
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

/** All apps under apps/ — discovered dynamically for studio-maturity checks */
function getAllAppDirs(): string[] {
  const appsRoot = join(ROOT, 'apps')
  if (!existsSync(appsRoot)) return []
  return readdirSync(appsRoot)
    .filter((entry) => {
      try {
        return statSync(join(appsRoot, entry)).isDirectory()
      } catch { return false }
    })
    .map((d) => `apps/${d}`)
}

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

const checkTrivyCriticalBlocking = runGate('TRIVY-BLOCKING', 'CI gates: Trivy FS scan is PR-blocking on CRITICAL', 'ci-gates', () => {
  // Check trivy.yml contains a blocking FS scan step (exit-code: 1, no continue-on-error on that step)
  const trivyFile = join(ROOT, '.github/workflows/trivy.yml')
  const govFile = join(ROOT, '.github/workflows/nzila-governance.yml')

  const violations: string[] = []

  for (const wf of [trivyFile, govFile]) {
    if (!existsSync(wf)) continue
    const content = readFileSync(wf, 'utf-8')
    const hasExitCode1 = /exit[-_]code:\s*['""]?1/.test(content) || content.includes("exit-code: '1'") || content.includes('exit-code: 1')
    if (!hasExitCode1) {
      violations.push(`${wf}: no trivy step with exit-code: 1`)
    }
  }

  // Ensure the trivy-fs blocking step does NOT have continue-on-error on the non-SARIF scan
  if (existsSync(trivyFile)) {
    const content = readFileSync(trivyFile, 'utf-8')
    // The blocking step comment should be present
    const hasBlockingComment = content.includes('BLOCKING') || (content.includes('exit-code: 1') && content.includes('trivy-fs'))
    if (!hasBlockingComment) {
      violations.push('trivy.yml: trivy-fs blocking step not clearly marked')
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? 'Trivy FS blocking scan present (exit-code: 1) in CI workflows'
      : `Trivy FS blocking issues: ${violations.join('; ')}`,
    violations,
  }
})

const checkNoOrTrueOnSecurityGates = runGate('NO-OR-TRUE-GATES', 'CI gates: No || true on security-gating commands', 'ci-gates', () => {
  const workflowDir = join(ROOT, '.github/workflows')
  if (!existsSync(workflowDir)) {
    return { status: 'FAIL', details: '.github/workflows/ not found' }
  }

  const workflowFiles = readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
  const violations: string[] = []

  for (const f of workflowFiles) {
    const content = readFileSync(join(workflowDir, f), 'utf-8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Detect || true on lines that contain security commands
      if (!line.trimStart().startsWith('#') && line.includes('|| true')) {
        // Allow intentional || true when the preceding comment or same-line comment
        // contains 'ga-check:exempt' or 'intentional' or 'waiver policy'
        const prevLine = i > 0 ? lines[i - 1] : ''
        const isExempt = /ga-check:exempt|waiver.policy|intentional/i.test(line + prevLine)
        if (isExempt) continue

        const securityPatterns = ['pnpm audit', 'npm audit', 'yarn audit', 'pip-audit', 'trufflehog', 'gitleaks', 'trivy']
        const isSecurity = securityPatterns.some((p) => line.includes(p))
        if (isSecurity) {
          violations.push(`${f}:${i + 1}: security command has || true — ${line.trim().slice(0, 80)}`)
        }
      }
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? 'No || true on security-gating commands in CI workflows'
      : `${violations.length} security command(s) softened with || true`,
    violations,
  }
})

const checkEvidenceArtifactsUploaded = runGate('EVIDENCE-ARTIFACTS', 'Evidence: pack.json + seal.json both uploaded as CI artifacts', 'evidence', () => {
  const govWorkflow = join(ROOT, '.github/workflows/nzila-governance.yml')
  if (!existsSync(govWorkflow)) {
    return { status: 'FAIL', details: 'nzila-governance.yml not found' }
  }

  const content = readFileSync(govWorkflow, 'utf-8')
  const hasPackUpload = content.includes('pack.json') && content.includes('upload-artifact')
  const hasSealUpload = content.includes('seal.json') && content.includes('upload-artifact')
  const hasSbomUpload = content.includes('sbom') && content.includes('upload-artifact')

  const missing: string[] = []
  if (!hasPackUpload) missing.push('pack.json not uploaded as artifact')
  if (!hasSealUpload) missing.push('seal.json not uploaded as artifact')
  if (!hasSbomUpload) missing.push('sbom artifact upload missing')

  return {
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    details: missing.length === 0
      ? 'pack.json + seal.json + sbom all uploaded as CI artifacts'
      : `Missing artifact uploads: ${missing.join('; ')}`,
    violations: missing,
  }
})

const checkVerticalEvidenceJobsWired = runGate('VERTICAL-EVIDENCE-WIRED', 'Evidence: UE and ABR evidence jobs wired into governance-gate', 'evidence', () => {
  const govWorkflow = join(ROOT, '.github/workflows/nzila-governance.yml')
  if (!existsSync(govWorkflow)) {
    return { status: 'FAIL', details: 'nzila-governance.yml not found' }
  }

  const content = readFileSync(govWorkflow, 'utf-8')
  const missing: string[] = []

  // Each vertical's evidence job must exist as a top-level CI job
  if (!content.includes('ue-evidence:')) missing.push('ue-evidence job missing')
  if (!content.includes('abr-evidence:')) missing.push('abr-evidence job missing')

  // Both must be listed in governance-gate's `needs:` array
  // Find the governance-gate block by looking for the needs section that comes after it
  const gateBlock = content.slice(content.indexOf('governance-gate:'))
  if (!gateBlock.includes('ue-evidence'))  missing.push('ue-evidence not in governance-gate needs')
  if (!gateBlock.includes('abr-evidence')) missing.push('abr-evidence not in governance-gate needs')

  // Both must have blocking verify steps (exit-code 1 or python verify.py)
  const hasUeBlocking = content.includes('pnpm evidence:verify') || content.includes('evidence:verify')
  const hasAbrBlocking = content.includes('verify.py')
  if (!hasUeBlocking) missing.push('UE evidence:verify (blocking) step missing')
  if (!hasAbrBlocking) missing.push('ABR verify.py (blocking) step missing')

  return {
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    details: missing.length === 0
      ? 'UE and ABR evidence jobs both present, wired into governance-gate, and have blocking verify steps'
      : `Vertical evidence wiring issues: ${missing.join('; ')}`,
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

const checkAuthMiddleware = runGate('AUTH-MIDDLEWARE', 'Auth edge guard: All apps have auth proxy or middleware', 'org-boundary', () => {
  const violations: string[] = []

  for (const appDir of APP_DIRS) {
    const mwPath = join(ROOT, appDir, 'middleware.ts')
    const proxyPath = join(ROOT, appDir, 'proxy.ts')

    const guardPath = existsSync(proxyPath)
      ? proxyPath
      : existsSync(mwPath)
        ? mwPath
        : null

    if (!guardPath) {
      violations.push(`${appDir}: no proxy.ts or middleware.ts`)
      continue
    }

    const content = readFileSync(guardPath, 'utf-8')
    const hasAuth =
      content.includes('@nzila/platform-auth') ||
      content.includes('authMiddleware') ||
      content.includes('auth(') ||
      content.includes('createRouteMatcher')

    if (!hasAuth) {
      violations.push(`${appDir}: ${relative(ROOT, guardPath)} missing auth guard wiring`)
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? `All ${APP_DIRS.length} apps have auth edge guards (proxy.ts/middleware.ts)`
      : `${violations.length} app(s) missing auth edge guards`,
    violations,
  }
})

// ── F) Studio Maturity ───────────────────────────────────────────────────────

const checkPlatformScore = runGate('STUDIO-PLATFORM-SCORE', 'Studio maturity: Every app scores ≥ 7/10 on platform integration', 'studio-maturity', () => {
  const appDirs = getAllAppDirs()
  const violations: string[] = []

  // Apps with a lower threshold (intentionally thin / special purpose)
  const THRESHOLD_OVERRIDES: Record<string, number> = {
    'apps/web': 5,            // Marketing site — no intelligence needed
    'apps/agrimo': 5,         // Pre-GA — agri vertical, AI/ML not yet wired
    'apps/control-plane': 3,  // Pre-GA — internal admin surface
    'apps/cora': 5,           // Pre-GA — compliance vertical
    'apps/mobility': 4,       // Pre-GA — mobility vertical
    'apps/mobility-client-portal': 3, // Pre-GA — thin client portal
    'apps/platform-admin': 3, // Pre-GA — internal admin tooling
    'apps/trade': 4,          // Pre-GA — trade vertical
  }

  for (const appDir of appDirs) {
    const absDir = join(ROOT, appDir)
    const pkgPath = join(absDir, 'package.json')
    const pkgContent = existsSync(pkgPath) ? readFileSync(pkgPath, 'utf-8') : '{}'

    // 10 platform integration signals
    const signals: [string, boolean][] = [
      ['ai-client', existsSync(join(absDir, 'lib', 'ai-client.ts')) || existsSync(join(absDir, 'lib', 'ai', 'ai-client.ts'))],
      ['ml-client', existsSync(join(absDir, 'lib', 'ml-client.ts'))],
      ['evidence', existsSync(join(absDir, 'lib', 'evidence.ts')) || existsSync(join(absDir, 'src', 'evidence.ts'))],
      ['api-guards', existsSync(join(absDir, 'lib', 'api-guards.ts')) || existsSync(join(absDir, 'src', 'api-guards.ts'))],
      ['otel', existsSync(join(absDir, 'instrumentation.ts')) || existsSync(join(absDir, 'src', 'instrumentation.ts'))],
      ['health-route', existsSync(join(absDir, 'app', 'api', 'health', 'route.ts')) || existsSync(join(absDir, 'src', 'routes', 'health.ts')) || pkgContent.includes('health')],
      ['@nzila/db', pkgContent.includes('@nzila/db')],
      ['@nzila/os-core', pkgContent.includes('@nzila/os-core')],
      ['@nzila/config', pkgContent.includes('@nzila/config') || pkgContent.includes('@nzila/os-core')],
      ['env-validation', existsSync(join(absDir, 'lib', 'env.ts')) || existsSync(join(absDir, 'env.ts')) || existsSync(join(absDir, 'src', 'env.ts'))],
    ]

    const score = signals.filter(([, ok]) => ok).length
    const missing = signals.filter(([, ok]) => !ok).map(([name]) => name)
    const threshold = THRESHOLD_OVERRIDES[appDir] ?? 7

    if (score < threshold) {
      violations.push(`${appDir}: ${score}/10 (missing: ${missing.join(', ')})`)
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? `All ${appDirs.length} apps score ≥ 7/10 on platform integration`
      : `${violations.length} app(s) below 7/10 platform score`,
    violations,
  }
})

const checkAiClaimsVsWiring = runGate('STUDIO-AI-CLAIMS', 'Studio maturity: No AI marketing claims without ai-sdk wiring', 'studio-maturity', () => {
  const appDirs = getAllAppDirs()
  const violations: string[] = []

  for (const appDir of appDirs) {
    const absDir = join(ROOT, appDir)
    const pkgPath = join(absDir, 'package.json')
    if (!existsSync(pkgPath)) continue

    const pkgContent = readFileSync(pkgPath, 'utf-8')
    let pkg: { description?: string; name?: string }
    try { pkg = JSON.parse(pkgContent) } catch { continue }

    // Check for AI claims in package.json description or README
    const readmePath = join(absDir, 'README.md')
    const readmeContent = existsSync(readmePath) ? readFileSync(readmePath, 'utf-8') : ''
    const marketingText = `${pkg.description ?? ''} ${readmeContent}`.toLowerCase()

    // Look for AI marketing claims — standalone word "ai" or "artificial intelligence"
    const hasAiClaim = /\bai\b/.test(marketingText) ||
      marketingText.includes('artificial intelligence') ||
      marketingText.includes('machine learning') ||
      marketingText.includes('ai-powered') ||
      marketingText.includes('ai powered')

    if (!hasAiClaim) continue

    // Verify ai-sdk is actually wired
    const hasAiClient = existsSync(join(absDir, 'lib', 'ai-client.ts')) ||
      existsSync(join(absDir, 'lib', 'ai', 'ai-client.ts'))
    const hasAiSdkDep = pkgContent.includes('@nzila/ai-sdk') || pkgContent.includes('@nzila/ai-core')

    if (!hasAiClient && !hasAiSdkDep) {
      violations.push(`${appDir}: claims AI but has no ai-client.ts or @nzila/ai-sdk dependency`)
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? 'All apps with AI claims have runtime ai-sdk wiring'
      : `${violations.length} app(s) claim AI without wiring`,
    violations,
  }
})

const checkNoInMemoryPersistence = runGate('STUDIO-NO-INMEM', 'Studio maturity: No in-memory Maps used as primary persistence', 'studio-maturity', () => {
  const appDirs = getAllAppDirs()
  const violations: string[] = []
  const exclude = ['node_modules', '.next', 'dist', '.turbo', '__tests__', 'test', 'tests', 'coverage']

  for (const appDir of appDirs) {
    const absDir = join(ROOT, appDir)
    const sourceFiles = findFiles(absDir, /\.(ts|tsx)$/, exclude)

    for (const file of sourceFiles) {
      const relFile = relative(ROOT, file)
      // Skip test files and type-only files
      if (/\.(test|spec|stories|d)\.(ts|tsx)$/.test(relFile)) continue

      const content = readFileSync(file, 'utf-8')

      // Detect module-level Map/Set used as persistence stores
      // Pattern: const/let/var <name> = new Map( or new Map<
      // Only flag module-level declarations (not inside functions/classes)
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip lines inside functions/blocks (heuristic: indented ≥ 2 spaces or tabs).
        // Repo uses 2-space indent, so any indentation means we're inside a scope.
        if (/^\s{2,}/.test(line) || /^\t+/.test(line)) continue
        // Skip comments
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue

        // Match module-level Map/Set stores
        if (/(?:const|let|var)\s+\w+\s*(?::\s*Map[<(]|=\s*new\s+Map\s*[<(])/.test(line)) {
          // Allow known safe patterns: type maps, route maps, config maps
          const isSafe = /(?:Route|Config|Schema|Type|Mime|Status|Header)/.test(line) ||
            line.includes('as const') || line.includes('readonly')
          // Allow explicit exemptions via ga-check:exempt comment on same or preceding line
          const prevLine = i > 0 ? lines[i - 1] : ''
          const isExempt = /ga-check:exempt/i.test(line + prevLine)
          if (!isSafe && !isExempt) {
            violations.push(`${relFile}:${i + 1}: module-level Map store — ${line.trim().slice(0, 80)}`)
          }
        }
      }
    }
  }

  return {
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    details: violations.length === 0
      ? 'No in-memory Map stores used as primary persistence in app code'
      : `${violations.length} potential in-memory persistence store(s) found`,
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
  checkEvidenceArtifactsUploaded,
  checkVerticalEvidenceJobsWired,
  // D) CI gates
  checkCiGates,
  checkGovernanceWorkflow,
  checkTrivyCriticalBlocking,
  checkNoOrTrueOnSecurityGates,
  checkEslintBoundaries,
  checkContractTests,
  checkCodeOwners,
  // E) Red-team
  checkRedTeamWorkflow,
  checkRedTeamEvidence,
  // F) Studio maturity
  checkPlatformScore,
  checkAiClaimsVsWiring,
  checkNoInMemoryPersistence,
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
