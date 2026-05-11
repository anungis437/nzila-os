/**
 * Claim Verification Engine
 *
 * Compares buyer-facing claims against actual codebase evidence.
 * Each claim is defined with:
 *   - source: where the claim appears
 *   - statement: the exact claim text
 *   - verifier: a function that checks the codebase
 *   - result: VERIFIED / PARTIALLY_VERIFIED / UNVERIFIED / OVERCLAIMED
 *
 * Output: reports/claim-verification.json + reports/claim-verification.md + reports/unsafe-claims.md
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..', '..')

// ────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────

type ClaimStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'OVERCLAIMED'

interface ClaimResult {
  id: string
  category: string
  source: string
  statement: string
  status: ClaimStatus
  evidence: string[]
  gaps: string[]
  recommendation: string
}

interface ClaimReport {
  timestamp: string
  totalClaims: number
  verified: number
  partiallyVerified: number
  unverified: number
  overclaimed: number
  verificationRate: number
  claims: ClaimResult[]
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function fileExists(rel: string): boolean {
  return existsSync(join(ROOT, rel))
}

function fileContains(rel: string, pattern: string | RegExp): boolean {
  const path = join(ROOT, rel)
  if (!existsSync(path)) return false
  const content = readFileSync(path, 'utf-8')
  if (typeof pattern === 'string') return content.includes(pattern)
  return pattern.test(content)
}

function grepRecursive(dir: string, pattern: RegExp, extensions: string[] = ['.ts', '.tsx']): string[] {
  const matches: string[] = []
  const fullDir = join(ROOT, dir)
  if (!existsSync(fullDir)) return matches

  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue
      const full = join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (extensions.some(e => entry.name.endsWith(e))) {
        const content = readFileSync(full, 'utf-8')
        if (pattern.test(content)) matches.push(full.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, ''))
      }
    }
  }
  walk(fullDir)
  return matches
}

function countTestFiles(): number {
  let count = 0
  function walk(dir: string) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) count++
    }
  }
  walk(join(ROOT, 'packages'))
  walk(join(ROOT, 'apps'))
  return count
}

function countDrizzleSchemas(): number {
  let count = 0
  const schemaDir = join(ROOT, 'packages', 'db', 'src', 'schema')
  if (!existsSync(schemaDir)) return 0
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const content = readFileSync(full, 'utf-8')
        const tableMatches = content.match(/pgTable\s*\(/g)
        if (tableMatches) count += tableMatches.length
      }
    }
  }
  walk(schemaDir)
  return count
}

function countPackages(): number {
  let count = 0
  for (const dir of ['packages', 'apps', 'tooling']) {
    const parent = join(ROOT, dir)
    if (!existsSync(parent)) continue
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (existsSync(join(parent, entry.name, 'package.json'))) count++
    }
  }
  return count
}

// ────────────────────────────────────────────────────────────────────
// Claim Registry
// ────────────────────────────────────────────────────────────────────

function buildClaims(): ClaimResult[] {
  const claims: ClaimResult[] = []
  let id = 0
  const nextId = () => `CLM-${String(++id).padStart(3, '0')}`

  // ── Security Claims ──

  // Claim: Hash-chained audit logs
  {
    const result = nextId()
    const schemaHasHash = fileContains('packages/db/src/schema/audit.ts', 'previousHash') ||
                          grepRecursive('packages/db/src/schema', /previousHash/).length > 0
    const hasVerifySeal = grepRecursive('packages', /verifySeal/).length > 0
    const hasTrigger = grepRecursive('packages/db', /hash.chain|immutab|prevent.*UPDATE.*DELETE/i).length > 0
    const evidence: string[] = []
    const gaps: string[] = []
    if (schemaHasHash) evidence.push('Schema has previousHash column')
    else gaps.push('No previousHash column found in audit schema')
    if (hasVerifySeal) evidence.push(`verifySeal found in ${grepRecursive('packages', /verifySeal/).length} file(s)`)
    else gaps.push('verifySeal function not found')
    if (hasTrigger) evidence.push('DB-level immutability triggers found')
    else gaps.push('No DB-level immutability triggers found in schema')

    const status: ClaimStatus = evidence.length >= 2 ? (gaps.length === 0 ? 'VERIFIED' : 'PARTIALLY_VERIFIED')
                                                     : (evidence.length > 0 ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED')
    claims.push({
      id: result, category: 'Security', source: 'content/public/security-overview.md',
      statement: 'Hash-chained audit entries (SHA-256), append-only, immutable',
      status, evidence, gaps,
      recommendation: gaps.length > 0 ? `Implement: ${gaps.join('; ')}` : 'Claim fully supported',
    })
  }

  // Claim: AES-256 at rest + TLS 1.3
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    // Check for infrastructure config or code enforcing encryption
    const hasEncryptionRef = grepRecursive('infrastructure', /AES|encrypt/i).length > 0 ||
                             grepRecursive('docs', /AES-256|at.rest/i).length > 0
    const hasTLSRef = grepRecursive('infrastructure', /TLS|tls.*1\.3/i).length > 0 ||
                      grepRecursive('docs', /TLS.*1\.3/i).length > 0
    if (hasEncryptionRef) evidence.push('AES-256 referenced in docs/infrastructure')
    else gaps.push('No code-level encryption enforcement found (Azure-managed — verify Azure config)')
    if (hasTLSRef) evidence.push('TLS 1.3 referenced')
    else gaps.push('TLS 1.3 not explicitly enforced in code (Azure-managed)')

    claims.push({
      id, category: 'Security', source: 'content/public/security-overview.md',
      statement: 'AES-256 at rest + TLS 1.3 in transit',
      status: evidence.length >= 1 ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED',
      evidence, gaps,
      recommendation: 'AES-256 and TLS 1.3 are Azure platform features. Document Azure config verification procedure.',
    })
  }

  // Claim: withAudit enforcement
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const withAuditFiles = grepRecursive('packages', /withAudit/)
    const withAuditApps = grepRecursive('apps', /withAudit/)
    if (withAuditFiles.length > 0) evidence.push(`withAudit used in ${withAuditFiles.length} package files`)
    if (withAuditApps.length > 0) evidence.push(`withAudit used in ${withAuditApps.length} app files`)
    else gaps.push('Not all apps verified to use withAudit')
    const hasEslintRule = grepRecursive('packages', /no-shadow-db|noShadowDb/i).length > 0
    if (hasEslintRule) evidence.push('ESLint governance rule no-shadow-db found')

    claims.push({
      id, category: 'Security', source: 'docs/architecture/AUDIT_ENFORCEMENT.md',
      statement: 'Audit logging is impossible to forget for CRUD operations',
      status: withAuditApps.length >= 3 ? 'VERIFIED' : 'PARTIALLY_VERIFIED',
      evidence, gaps,
      recommendation: gaps.length > 0 ? 'Verify all production apps use withAudit for mutations' : 'Claim supported',
    })
  }

  // Claim: 384+ contract tests
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const contractTestFiles = grepRecursive('packages', /contract|invariant/i, ['.test.ts'])
    const contractTestCount = contractTestFiles.length
    if (contractTestCount >= 20) evidence.push(`${contractTestCount} contract/invariant test files found`)
    else gaps.push(`Only ${contractTestCount} contract test files found (claim: 384+ tests)`)

    claims.push({
      id, category: 'Testing', source: 'docs/architecture/AUDIT_ENFORCEMENT.md',
      statement: '384 contract tests enforcing architectural invariants',
      status: contractTestCount >= 20 ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED',
      evidence, gaps,
      recommendation: 'Run contract-tests suite and count actual passing assertions to verify 384 claim',
    })
  }

  // Claim: 15 production-grade platforms across 10+ verticals
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const appCount = existsSync(join(ROOT, 'apps'))
      ? readdirSync(join(ROOT, 'apps'), { withFileTypes: true }).filter(d => d.isDirectory()).length
      : 0
    evidence.push(`${appCount} apps found in apps/ directory`)
    if (appCount >= 15) evidence.push('Count matches or exceeds claim')
    else gaps.push(`${appCount} apps found vs. "15 production-grade platforms" claimed`)

    // Check for actual production readiness markers
    const appsWithPages = readdirSync(join(ROOT, 'apps'), { withFileTypes: true })
      .filter(d => d.isDirectory())
      .filter(d => existsSync(join(ROOT, 'apps', d.name, 'app')) || existsSync(join(ROOT, 'apps', d.name, 'src')))
    evidence.push(`${appsWithPages.length} apps have app/ or src/ directories`)

    claims.push({
      id, category: 'Business', source: 'governance/business/README.md',
      statement: '15 production-grade platforms across 10+ verticals',
      status: appCount >= 15 ? 'PARTIALLY_VERIFIED' : 'OVERCLAIMED',
      evidence, gaps,
      recommendation: 'Verify each app has: routes, tests, CI builds, deployed endpoints. "Production-grade" requires evidence.',
    })
  }

  // Claim: $4M+ engineering investment
  {
    const id = nextId()
    claims.push({
      id, category: 'Business', source: 'governance/business/README.md',
      statement: '$4M+ engineering investment',
      status: 'UNVERIFIED',
      evidence: ['Marketing/financial claim — cannot be verified from codebase'],
      gaps: ['No financial records in repo to verify'],
      recommendation: 'This is a business claim. Mark as UNVERIFIABLE_FROM_CODE — requires external attestation.',
    })
  }

  // Claim: 12,000+ database entities
  {
    const id = nextId()
    const tableCount = countDrizzleSchemas()
    const evidence: string[] = [`${tableCount} pgTable() definitions found in DB schema`]
    const gaps: string[] = []
    if (tableCount < 200) {
      gaps.push(`Only ${tableCount} tables found — "12,000+ entities" likely refers to entity types/records, not tables`)
    }

    claims.push({
      id, category: 'Business', source: 'governance/business/README.md',
      statement: '12,000+ database entities',
      status: tableCount >= 100 ? 'PARTIALLY_VERIFIED' : 'OVERCLAIMED',
      evidence, gaps,
      recommendation: 'Clarify: "entities" = schema tables, or expected runtime records? If tables, count is likely overclaimed.',
    })
  }

  // Claim: Row-Level Security org isolation
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const hasOrgId = grepRecursive('packages/db/src/schema', /org_id/).length > 0
    const hasRLS = grepRecursive('packages/db', /row.level|rls|enable.*row/i).length > 0
    const hasScopedDb = grepRecursive('packages', /createScopedDb|scopedDb/i).length > 0
    if (hasOrgId) evidence.push('org_id columns found in schema')
    if (hasRLS) evidence.push('RLS references found')
    else gaps.push('No PostgreSQL RLS policy code found in DB package')
    if (hasScopedDb) evidence.push('createScopedDb wrapper found')
    else gaps.push('No createScopedDb wrapper found')

    claims.push({
      id, category: 'Security', source: 'content/public/security-overview.md',
      statement: 'Row-Level Security policies enforce cross-org data isolation',
      status: hasScopedDb || hasRLS ? (hasScopedDb && hasOrgId ? 'VERIFIED' : 'PARTIALLY_VERIFIED') : 'UNVERIFIED',
      evidence, gaps,
      recommendation: hasRLS ? 'Verify RLS policies applied via migration' : 'Add PostgreSQL RLS policies to enforce org isolation at DB level',
    })
  }

  // Claim: PII auto-redaction before AI calls
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const redactionFiles = grepRecursive('packages', /redact|pii|sanitize.*before.*ai/i)
    const aiCoreRedaction = grepRecursive('packages/ai-core', /redact|pii/i)
    const aiSdkRedaction = grepRecursive('packages/ai-sdk', /redact|pii/i)
    if (redactionFiles.length > 0) evidence.push(`PII/redaction references in ${redactionFiles.length} files`)
    if (aiCoreRedaction.length > 0) evidence.push('AI core has PII handling')
    if (aiSdkRedaction.length > 0) evidence.push('AI SDK has PII handling')
    if (redactionFiles.length === 0) gaps.push('No PII redaction code found in AI packages')

    claims.push({
      id, category: 'AI Safety', source: 'governance/ai/AI_DATA_GOVERNANCE.md',
      statement: 'PII auto-redaction before sending data to GPT-4',
      status: redactionFiles.length >= 2 ? 'VERIFIED' : (redactionFiles.length > 0 ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED'),
      evidence, gaps,
      recommendation: gaps.length > 0 ? 'Implement PII redaction layer in @nzila/ai-sdk pipeline' : 'Claim supported',
    })
  }

  // Claim: SOC 2 Type II, ISO 27001 certifications
  {
    const id = nextId()
    claims.push({
      id, category: 'Compliance', source: 'content/public/partner-integration.md',
      statement: 'SOC 2 Type II, ISO 27001 certifications (via Azure regions)',
      status: 'PARTIALLY_VERIFIED',
      evidence: ['Claims reference Azure/identity-provider certifications, which are vendor-provided'],
      gaps: ['Own SOC 2 not demonstrated — identity provider and Azure provide their own. Nzila inherits, not holds, these certs.'],
      recommendation: 'Distinguish between "our infrastructure provider has SOC 2" vs "we are SOC 2 certified". Add clarity.',
    })
  }

  // Claim: Ed25519 + SHA-256 procurement pack signing
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const hasEd25519 = grepRecursive('packages/platform-procurement-proof', /ed25519|Ed25519/).length > 0
    const hasSha256 = grepRecursive('packages/platform-procurement-proof', /sha.256|SHA256|sha256/i).length > 0
    const hasSignedZip = grepRecursive('packages/platform-procurement-proof', /zip|archiv/i).length > 0
    if (hasEd25519) evidence.push('Ed25519 signing found in procurement-proof')
    else gaps.push('Ed25519 not found in procurement-proof package')
    if (hasSha256) evidence.push('SHA-256 hashing found')
    if (hasSignedZip) evidence.push('ZIP/archive generation found')

    claims.push({
      id, category: 'Procurement', source: 'docs/procurement-pack.md',
      statement: 'Ed25519 + SHA-256 signed procurement packs',
      status: hasEd25519 && hasSha256 ? 'VERIFIED' : (evidence.length > 0 ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED'),
      evidence, gaps,
      recommendation: evidence.length >= 2 ? 'Claim supported' : 'Implement Ed25519 signing in procurement-proof package',
    })
  }

  // Claim: 3 deployment models (Managed, Sovereign, Hybrid)
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const hasDockerCompose = fileExists('docker-compose.yml')
    const hasDockerfile = fileExists('Dockerfile')
    const hasTerraform = grepRecursive('infrastructure', /terraform|\.tf$/i).length > 0 ||
                         grepRecursive('docs/deploy', /terraform|bicep/i).length > 0
    const hasBicep = grepRecursive('infrastructure', /\.bicep$/i).length > 0 ||
                     grepRecursive('docs/deploy', /bicep/i).length > 0
    if (hasDockerCompose) evidence.push('docker-compose.yml exists')
    if (hasDockerfile) evidence.push('Dockerfile exists')
    if (hasTerraform) evidence.push('Terraform references found')
    if (hasBicep) evidence.push('Bicep references found')
    if (!hasTerraform && !hasBicep) gaps.push('No IaC templates (Terraform/Bicep) for sovereign deployment')

    claims.push({
      id, category: 'Deployment', source: 'docs/deploy/profiles.md',
      statement: 'Three deployment models: Managed, Sovereign, Hybrid',
      status: hasDockerCompose && hasDockerfile ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED',
      evidence, gaps,
      recommendation: 'Sovereign model requires customer-runnable IaC. Verify Terraform/Bicep templates exist and are tested.',
    })
  }

  // Claim: Azure AI Content Safety filtering
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const hasContentSafety = grepRecursive('packages', /content.safety|contentSafety|azure.*content.*safety/i).length > 0
    const hasHateFilter = grepRecursive('packages', /hate.*speech|violence|self.harm|sexual.*content/i).length > 0
    if (hasContentSafety) evidence.push('Azure Content Safety references found')
    else gaps.push('No Azure Content Safety integration code found')
    if (hasHateFilter) evidence.push('Content category filtering references found')

    claims.push({
      id, category: 'AI Safety', source: 'governance/ai/AI_SAFETY_PROTOCOLS.md',
      statement: 'Azure AI Content Safety filters all GPT-4 inputs/outputs',
      status: hasContentSafety ? 'VERIFIED' : (hasHateFilter ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED'),
      evidence, gaps,
      recommendation: gaps.length > 0 ? 'Implement Azure Content Safety middleware in AI SDK pipeline' : 'Claim supported',
    })
  }

  // Claim: 200+ GPT-4 prompts
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    // Count prompt template files or prompt strings
    const promptFiles = grepRecursive('packages', /system.*prompt|systemPrompt|PROMPT|prompt.*template/i)
    evidence.push(`${promptFiles.length} files with prompt references found`)
    if (promptFiles.length < 50) gaps.push(`Only ${promptFiles.length} prompt-related files found — "200+ prompts" may be overclaimed`)

    claims.push({
      id, category: 'AI', source: 'governance/ai/AI_MODEL_MANAGEMENT.md',
      statement: '200+ GPT-4 prompts ($80K+ licensing value)',
      status: promptFiles.length >= 50 ? 'PARTIALLY_VERIFIED' : 'OVERCLAIMED',
      evidence, gaps,
      recommendation: 'Count distinct prompt templates. $80K licensing value is a business assertion, not code-verifiable.',
    })
  }

  // Claim: Data residency — region selection
  {
    const id = nextId()
    const evidence: string[] = []
    const gaps: string[] = []
    const hasRegionConfig = grepRecursive('packages', /data.*residen|region.*select|south.*africa.*north/i).length > 0
    const hasNoTransfer = grepRecursive('content', /cross.region.*data.*transfer.*not.*permitted/i).length > 0
    if (hasRegionConfig) evidence.push('Data residency / region references found in code')
    if (hasNoTransfer) evidence.push('Cross-region transfer prohibition documented')
    if (!hasRegionConfig) gaps.push('No runtime region selection mechanism found in code')

    claims.push({
      id, category: 'Sovereignty', source: 'content/public/partner-integration.md',
      statement: 'Cross-region data transfer is not permitted — data stays in home region',
      status: hasNoTransfer ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED',
      evidence, gaps,
      recommendation: 'Document how region isolation is enforced at infrastructure level (Azure Resource Groups per region)',
    })
  }

  return claims
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────

function main() {
  const claims = buildClaims()

  const verified = claims.filter(c => c.status === 'VERIFIED').length
  const partial = claims.filter(c => c.status === 'PARTIALLY_VERIFIED').length
  const unverified = claims.filter(c => c.status === 'UNVERIFIED').length
  const overclaimed = claims.filter(c => c.status === 'OVERCLAIMED').length

  const report: ClaimReport = {
    timestamp: new Date().toISOString(),
    totalClaims: claims.length,
    verified,
    partiallyVerified: partial,
    unverified,
    overclaimed,
    verificationRate: Math.round(((verified + partial * 0.5) / claims.length) * 100),
    claims,
  }

  const reportsDir = join(ROOT, 'reports')
  mkdirSync(reportsDir, { recursive: true })
  writeFileSync(join(reportsDir, 'claim-verification.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(reportsDir, 'claim-verification.md'), generateFullMd(report))
  writeFileSync(join(reportsDir, 'unsafe-claims.md'), generateUnsafeMd(report))

  // Console
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  CLAIM VERIFICATION REPORT`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Total claims:      ${report.totalClaims}`)
  console.log(`  Verified:          ${verified}`)
  console.log(`  Partially:         ${partial}`)
  console.log(`  Unverified:        ${unverified}`)
  console.log(`  Overclaimed:       ${overclaimed}`)
  console.log(`  Verification rate: ${report.verificationRate}%`)

  for (const c of claims) {
    const icon = c.status === 'VERIFIED' ? '✅' : c.status === 'PARTIALLY_VERIFIED' ? '⚠️' : c.status === 'OVERCLAIMED' ? '🔴' : '❌'
    console.log(`\n  ${icon} [${c.id}] ${c.statement}`)
    console.log(`     Source: ${c.source} | Status: ${c.status}`)
    if (c.gaps.length > 0) {
      for (const g of c.gaps) console.log(`     Gap: ${g}`)
    }
  }
  console.log(`\n  Reports: claim-verification.json, .md, unsafe-claims.md`)
  console.log(`${'═'.repeat(60)}\n`)
}

function generateFullMd(r: ClaimReport): string {
  const lines: string[] = []
  lines.push('# Claim Verification Report')
  lines.push('')
  lines.push(`**Generated:** ${r.timestamp}`)
  lines.push(`**Total claims:** ${r.totalClaims}`)
  lines.push(`**Verification rate:** ${r.verificationRate}%`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`| Status | Count |`)
  lines.push(`|--------|-------|`)
  lines.push(`| ✅ Verified | ${r.verified} |`)
  lines.push(`| ⚠️ Partially Verified | ${r.partiallyVerified} |`)
  lines.push(`| ❌ Unverified | ${r.unverified} |`)
  lines.push(`| 🔴 Overclaimed | ${r.overclaimed} |`)
  lines.push('')

  const byCategory = new Map<string, ClaimResult[]>()
  for (const c of r.claims) {
    if (!byCategory.has(c.category)) byCategory.set(c.category, [])
    byCategory.get(c.category)!.push(c)
  }

  for (const [cat, claims] of byCategory) {
    lines.push(`## ${cat}`)
    lines.push('')
    for (const c of claims) {
      const icon = c.status === 'VERIFIED' ? '✅' : c.status === 'PARTIALLY_VERIFIED' ? '⚠️' : c.status === 'OVERCLAIMED' ? '🔴' : '❌'
      lines.push(`### ${icon} ${c.id}: ${c.statement}`)
      lines.push('')
      lines.push(`**Source:** ${c.source}`)
      lines.push(`**Status:** ${c.status}`)
      lines.push('')
      if (c.evidence.length > 0) {
        lines.push('**Evidence:**')
        for (const e of c.evidence) lines.push(`- ${e}`)
        lines.push('')
      }
      if (c.gaps.length > 0) {
        lines.push('**Gaps:**')
        for (const g of c.gaps) lines.push(`- ${g}`)
        lines.push('')
      }
      lines.push(`**Recommendation:** ${c.recommendation}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function generateUnsafeMd(r: ClaimReport): string {
  const unsafe = r.claims.filter(c => c.status === 'OVERCLAIMED' || c.status === 'UNVERIFIED')
  const lines: string[] = []
  lines.push('# Unsafe Claims — Requires Immediate Attention')
  lines.push('')
  lines.push(`**Generated:** ${r.timestamp}`)
  lines.push(`**Unsafe claims:** ${unsafe.length} / ${r.totalClaims}`)
  lines.push('')
  lines.push('> These claims appear in buyer-facing materials but lack sufficient code evidence.')
  lines.push('> They must be either: (a) implemented, (b) reworded with accurate scope, or (c) removed.')
  lines.push('')

  if (unsafe.length === 0) {
    lines.push('No unsafe claims found. All buyer-facing claims have code evidence.')
    return lines.join('\n')
  }

  lines.push('| ID | Status | Claim | Source | Action |')
  lines.push('|----|--------|-------|--------|--------|')
  for (const c of unsafe) {
    const icon = c.status === 'OVERCLAIMED' ? '🔴' : '❌'
    lines.push(`| ${c.id} | ${icon} ${c.status} | ${c.statement} | ${c.source} | ${c.recommendation} |`)
  }
  lines.push('')

  lines.push('## Detail')
  lines.push('')
  for (const c of unsafe) {
    lines.push(`### ${c.id}: ${c.statement}`)
    lines.push('')
    lines.push(`**Source:** ${c.source}`)
    lines.push(`**Status:** ${c.status}`)
    lines.push('')
    if (c.evidence.length > 0) {
      lines.push('**What exists:**')
      for (const e of c.evidence) lines.push(`- ${e}`)
      lines.push('')
    }
    lines.push('**What\'s missing:**')
    for (const g of c.gaps) lines.push(`- ${g}`)
    lines.push('')
    lines.push(`**Recommended action:** ${c.recommendation}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

main()
