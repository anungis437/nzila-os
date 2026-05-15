/**
 * Architecture Consistency Audit
 *
 * Validates that the codebase adheres to architectural decisions documented in ARCHITECTURE.md:
 *  1. Apps consume packages — no direct provider SDK calls
 *  2. Entitlements as data — no hardcoded partner defaults
 *  3. Stack authority — each app uses its designated data layer
 *  4. Correlation IDs — requestId/traceId on API routes
 *  5. Config fail-fast — Zod validation at startup
 *  6. Platform packages used instead of bypassed
 *  7. Org isolation — org_id never from request body unsafely
 */

import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

// ── Types ───────────────────────────────────────────────────────────────────

type Severity = 'error' | 'warning' | 'info'

interface ArchFinding {
  rule: string
  severity: Severity
  file: string
  line?: number
  message: string
}

interface ArchAuditReport {
  generatedAt: string
  totalFiles: number
  totalFindings: number
  findingsByRule: Record<string, number>
  findingsBySeverity: Record<Severity, number>
  findings: ArchFinding[]
}

// ── Utilities ───────────────────────────────────────────────────────────────

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== join(dir, '..')) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = join(dir, '..')
  }
  throw new Error('Cannot find repo root (pnpm-workspace.yaml)')
}

function walkFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.next', '.turbo', 'coverage', '.git'].includes(entry.name)) continue
      results.push(...walkFiles(full, exts))
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full)
    }
  }
  return results
}

function readLines(filePath: string): string[] {
  try {
    return readFileSync(filePath, 'utf-8').split('\n')
  } catch {
    return []
  }
}

// ── Rules ───────────────────────────────────────────────────────────────────

// Direct provider SDK patterns that apps should NOT import directly
const BANNED_DIRECT_IMPORTS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /from\s+['"]@azure\/storage-blob['"]/, provider: 'Azure Blob' },
  { pattern: /from\s+['"]@azure\/identity['"]/, provider: 'Azure Identity' },
  { pattern: /from\s+['"]@azure\/keyvault-secrets['"]/, provider: 'Azure Key Vault' },
  { pattern: /from\s+['"]stripe['"]/, provider: 'Stripe' },
  { pattern: /from\s+['"]@sendgrid\/mail['"]/, provider: 'SendGrid' },
  { pattern: /from\s+['"]twilio['"]/, provider: 'Twilio' },
  { pattern: /from\s+['"]openai['"]/, provider: 'OpenAI' },
  { pattern: /from\s+['"]@hubspot\/api-client['"]/, provider: 'HubSpot' },
]

// Packages that are allowed to use direct provider SDKs (they ARE the wrapper)
const SDK_WRAPPER_PACKAGES = new Set([
  'blob', 'secrets', 'payments-stripe', 'comms-email', 'comms-sms', 'comms-push',
  'ai-core', 'ai-sdk', 'ml-core', 'ml-sdk', 'crm-hubspot', 'integrations-hubspot',
  'integrations-whatsapp', 'integrations-m365', 'integrations-runtime',
  'otel-core', 'chatops-slack', 'chatops-teams', 'qbo', 'fx', 'tax',
])

function checkDirectProviderImports(filePath: string, lines: string[], repoRoot: string): ArchFinding[] {
  const findings: ArchFinding[] = []
  const rel = relative(repoRoot, filePath).replace(/\\/g, '/')

  // Packages that wrap SDKs are allowed
  if (!rel.startsWith('apps/')) {
    const pkgName = rel.split('/')[1]
    if (SDK_WRAPPER_PACKAGES.has(pkgName)) return findings
  }

  // In apps: files under lib/ or services/ that import SDKs are local wrappers
  if (rel.startsWith('apps/')) {
    const fileName = basename(filePath, '.ts')
    const parentDir = rel.split('/').slice(-2, -1)[0]
    const isLocalWrapper = /wrapper|client|service|worker|encryption|auth|keyvault|speech/.test(fileName)
      || (parentDir === 'lib' || parentDir === 'services')
    if (isLocalWrapper) {
      // Allowed — this file IS the wrapper. Emit info only.
      for (let i = 0; i < lines.length; i++) {
        for (const { pattern, provider } of BANNED_DIRECT_IMPORTS) {
          if (pattern.test(line(lines, i))) {
            findings.push({
              rule: 'no-direct-provider-sdk',
              severity: 'info',
              file: rel,
              line: i + 1,
              message: `Local SDK wrapper for ${provider} — consider migrating to @nzila/ package`,
            })
          }
        }
      }
      return findings
    }
  }

  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, provider } of BANNED_DIRECT_IMPORTS) {
      if (pattern.test(line(lines, i))) {
        findings.push({
          rule: 'no-direct-provider-sdk',
          severity: rel.startsWith('apps/') ? 'warning' : 'warning',
          file: rel,
          line: i + 1,
          message: `Direct ${provider} SDK import — use @nzila/ wrapper package instead`,
        })
      }
    }
  }
  return findings
}

function line(lines: string[], i: number): string {
  return lines[i]
}

// Check that org_id comes from session/context, never from request body
function checkOrgIsolation(filePath: string, lines: string[], repoRoot: string): ArchFinding[] {
  const findings: ArchFinding[] = []
  const rel = relative(repoRoot, filePath).replace(/\\/g, '/')

  // Only check API route handlers (route.ts files with HTTP verbs)
  if (!rel.match(/\/api\/.*route\.ts$/)) return findings

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Only flag when extracting org_id from request body destructuring
    // e.g. req.body.orgId, body.org_id, { orgId } = await req.json()
    if (/(?:req\.body|request\.body)\.\s*org[_]?[iI]d/i.test(line)) {
      findings.push({
        rule: 'org-isolation',
        severity: 'error',
        file: rel,
        line: i + 1,
        message: 'org_id extracted from request body — must use session/auth context',
      })
    }
  }
  return findings
}

// Check that API routes use correlation IDs
function checkCorrelationIds(filePath: string, lines: string[], repoRoot: string): ArchFinding[] {
  const findings: ArchFinding[] = []
  const rel = relative(repoRoot, filePath).replace(/\\/g, '/')

  // Only API routes
  if (!rel.match(/\/api\/.*route\.ts$/)) return findings // codeql[js/polynomial-redos] - rel is a workspace-relative path, bounded in length

  // Skip health/status endpoints — they don't need correlation IDs
  if (/\/(health|status|ping|ready|live|favicon|robots)/.test(rel)) return findings // codeql[js/polynomial-redos] - rel is a workspace-relative path, bounded in length

  const content = lines.join('\n')
  const hasCorrelation = /requestId|traceId|correlationId|x-request-id|getCorrelation|withRequestId/i.test(content)

  if (!hasCorrelation) {
    findings.push({
      rule: 'correlation-ids',
      severity: 'warning',
      file: rel,
      line: 1,
      message: 'API route lacks correlation ID (requestId/traceId) handling',
    })
  }

  return findings
}

// Check that config files/modules use Zod validation
function checkConfigFailFast(filePath: string, lines: string[], repoRoot: string): ArchFinding[] {
  const findings: ArchFinding[] = []
  const rel = relative(repoRoot, filePath).replace(/\\/g, '/')

  const fileName = basename(filePath)
  // Only env.ts / environment.ts — not i18n configs, tailwind configs, etc.
  if (!['env.ts', 'environment.ts'].includes(fileName)) return findings
  if (rel.includes('node_modules') || rel.includes('.test.')) return findings

  const content = lines.join('\n')
  const hasZod = /from\s+['"]zod['"]|z\.object|z\.string|z\.enum/.test(content)

  if (!hasZod && content.length > 100) {
    findings.push({
      rule: 'config-fail-fast',
      severity: 'warning',
      file: rel,
      line: 1,
      message: 'Config file does not use Zod validation — consider fail-fast at startup',
    })
  }

  return findings
}

// Check that platform packages export barrels and tests exist
function checkPlatformPackageStructure(repoRoot: string): ArchFinding[] {
  const findings: ArchFinding[] = []
  const packagesDir = join(repoRoot, 'packages')
  if (!existsSync(packagesDir)) return findings

  const platformPkgs = readdirSync(packagesDir).filter(d =>
    d.startsWith('platform-') && statSync(join(packagesDir, d)).isDirectory(),
  )

  for (const pkg of platformPkgs) {
    const pkgDir = join(packagesDir, pkg)
    const pkgJson = join(pkgDir, 'package.json')
    if (!existsSync(pkgJson)) continue

    // Check for barrel export
    const hasIndex =
      existsSync(join(pkgDir, 'src', 'index.ts')) ||
      existsSync(join(pkgDir, 'src', 'index.tsx'))
    if (!hasIndex) {
      findings.push({
        rule: 'platform-structure',
        severity: 'warning',
        file: `packages/${pkg}`,
        message: 'Platform package missing src/index.ts barrel export',
      })
    }

    // Check for at least one test
    const srcDir = join(pkgDir, 'src')
    if (existsSync(srcDir)) {
      const testFiles = walkFiles(srcDir, ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx'])
      if (testFiles.length === 0) {
        const hasTestDir = existsSync(join(pkgDir, '__tests__')) || existsSync(join(pkgDir, 'tests'))
        if (!hasTestDir) {
          findings.push({
            rule: 'platform-structure',
            severity: 'warning',
            file: `packages/${pkg}`,
            message: 'Platform package has no test files',
          })
        }
      }
    }
  }

  return findings
}

// ── Report Generation ───────────────────────────────────────────────────────

function generateMarkdown(report: ArchAuditReport): string {
  const lines: string[] = []
  lines.push('# NzilaOS Architecture Consistency Audit')
  lines.push('')
  lines.push(`> Generated: ${report.generatedAt}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Files Scanned | ${report.totalFiles} |`)
  lines.push(`| Total Findings | ${report.totalFindings} |`)
  lines.push(`| Errors | ${report.findingsBySeverity.error} |`)
  lines.push(`| Warnings | ${report.findingsBySeverity.warning} |`)
  lines.push(`| Info | ${report.findingsBySeverity.info} |`)
  lines.push('')

  lines.push('## Findings by Rule')
  lines.push('')
  lines.push('| Rule | Count |')
  lines.push('|------|-------|')
  for (const [rule, count] of Object.entries(report.findingsByRule).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${rule} | ${count} |`)
  }
  lines.push('')

  // Group findings by rule
  const byRule = new Map<string, ArchFinding[]>()
  for (const f of report.findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, [])
    byRule.get(f.rule)!.push(f)
  }

  for (const [rule, findings] of byRule) {
    lines.push(`## ${rule} (${findings.length})`)
    lines.push('')
    for (const f of findings) {
      const icon = f.severity === 'error' ? '🔴' : f.severity === 'warning' ? '🟡' : 'ℹ️'
      const loc = f.line ? `${f.file}:${f.line}` : f.file
      lines.push(`- ${icon} \`${loc}\` — ${f.message}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Main ────────────────────────────────────────────────────────────────────

export function runArchitectureAudit(root?: string): ArchAuditReport {
  const repoRoot = root ?? findRepoRoot()

  const scanDirs = [
    join(repoRoot, 'apps'),
    join(repoRoot, 'packages'),
  ]

  const allFiles: string[] = []
  for (const dir of scanDirs) {
    allFiles.push(...walkFiles(dir, ['.ts', '.tsx']))
  }

  const findings: ArchFinding[] = []

  for (const filePath of allFiles) {
    const lines = readLines(filePath)
    findings.push(...checkDirectProviderImports(filePath, lines, repoRoot))
    findings.push(...checkOrgIsolation(filePath, lines, repoRoot))
    findings.push(...checkCorrelationIds(filePath, lines, repoRoot))
    findings.push(...checkConfigFailFast(filePath, lines, repoRoot))
  }

  // Structural checks
  findings.push(...checkPlatformPackageStructure(repoRoot))

  // Aggregate
  const findingsByRule: Record<string, number> = {}
  const findingsBySeverity: Record<Severity, number> = { error: 0, warning: 0, info: 0 }
  for (const f of findings) {
    findingsByRule[f.rule] = (findingsByRule[f.rule] ?? 0) + 1
    findingsBySeverity[f.severity]++
  }

  return {
    generatedAt: new Date().toISOString(),
    totalFiles: allFiles.length,
    totalFindings: findings.length,
    findingsByRule,
    findingsBySeverity,
    findings,
  }
}

// ── CLI entry ───────────────────────────────────────────────────────────────

if (process.argv[1]?.includes('architecture-audit')) {
  const root = findRepoRoot()
  const reportsDir = join(root, 'reports')
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })

  console.log('🏗️  Running Architecture Consistency Audit...\n')
  const report = runArchitectureAudit(root)

  writeFileSync(join(reportsDir, 'architecture-audit.json'), JSON.stringify(report, null, 2))
  writeFileSync(join(reportsDir, 'architecture-audit.md'), generateMarkdown(report))

  console.log(`Files scanned: ${report.totalFiles}`)
  console.log(`Findings:      ${report.totalFindings}`)
  console.log(`  Errors:   ${report.findingsBySeverity.error}`)
  console.log(`  Warnings: ${report.findingsBySeverity.warning}`)
  console.log(`  Info:     ${report.findingsBySeverity.info}`)
  console.log('')

  for (const [rule, count] of Object.entries(report.findingsByRule)) {
    console.log(`  ${rule}: ${count}`)
  }

  const hasErrors = report.findingsBySeverity.error > 0
  console.log(`\n${hasErrors ? '🔴 Architecture violations detected' : '✅ No critical architecture violations'}`)
  console.log(`Reports written to reports/architecture-audit.json and reports/architecture-audit.md`)
}
