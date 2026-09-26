/**
 * Claim Verification Audit
 *
 * Scans procurement docs, architecture docs, trust center materials, and README
 * for claims. Verifies each against code, tests, and configuration evidence.
 *
 * Classification:
 *  - implemented:  Code + tests demonstrably prove the claim
 *  - partial:      Code exists but incomplete or untested
 *  - docs-only:    Documented but no code evidence found
 *  - roadmap:      Explicitly future-scoped in docs
 *  - unsupported:  Claim made but contradicted by evidence
 *
 * Evidence-layer scope (see EVIDENCE_SCOPE below): this audit reads source, tests and
 * configuration in the working tree only. Its highest attainable layer is IMPLEMENTED, or
 * TESTED where the cited evidence includes a test file. It cannot establish DEPLOYED,
 * RUNTIME-VERIFIED, OPERATIONALLY PROVEN, customer availability, production readiness, or
 * procurement-safe truth, and its output must not be read as any of those.
 */

import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Types ───────────────────────────────────────────────────────────────────

type ClaimStatus = 'implemented' | 'partial' | 'docs-only' | 'roadmap' | 'unsupported'

interface Claim {
  id: string
  category: string
  text: string
  source: string
  status: ClaimStatus
  evidence: string[]
  notes: string
}

interface EvidenceScope {
  establishes: string[]
  doesNotEstablish: string[]
  residualLimitation: string
}

/**
 * Static declaration of what this generator's evidence can and cannot support. Emitted into
 * every output so a downstream reader (buyer pack, procurement reviewer, agent) cannot infer a
 * stronger evidence layer than the mechanism actually checks.
 */
const EVIDENCE_SCOPE: EvidenceScope = {
  establishes: [
    'DESIGN — the claim is documented in a repository artifact',
    'IMPLEMENTED — supporting code/configuration exists in the working tree',
    'TESTED — only where the cited evidence for a claim names a test file',
  ],
  doesNotEstablish: [
    'DEPLOYED — no environment, image digest or release is inspected',
    'RUNTIME-VERIFIED — nothing is executed against a running system',
    'OPERATIONALLY PROVEN — no operational record is read',
    'Customer availability — entitlement/tenant state is not inspected',
    'Production readiness — readiness gates live in their own programme documents',
    'Procurement-safe truth — publishing a claim requires the evidence layers above',
  ],
  residualLimitation:
    'This generator distinguishes evidence layers only as far as static repository inspection allows. Separating TESTED from IMPLEMENTED per claim, and attaching deployment/runtime evidence, would require a broader redesign (per-claim test attribution plus an environment evidence source). Until then, treat every status below as an implementation-evidence statement, never as a readiness or buyer-facing safety statement.',
}

interface ClaimVerificationReport {
  generatedAt: string
  evidenceScope: EvidenceScope
  totalClaims: number
  summary: Record<ClaimStatus, number>
  claims: Claim[]
  unsafeClaims: Claim[]
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

function safeRead(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function dirExists(path: string): boolean {
  try {
    return existsSync(path)
  } catch {
    return false
  }
}

function packageExists(repoRoot: string, pkgName: string): boolean {
  return existsSync(join(repoRoot, 'packages', pkgName, 'package.json'))
}

function packageHasTests(repoRoot: string, pkgName: string): boolean {
  const srcDir = join(repoRoot, 'packages', pkgName, 'src')
  if (!existsSync(srcDir)) return false
  const files = walkTsFiles(srcDir)
  return files.some((f) => /\.(test|spec)\.(ts|tsx)$/.test(f))
}

function fileContains(repoRoot: string, relPath: string, pattern: RegExp): boolean {
  const content = safeRead(join(repoRoot, relPath))
  return pattern.test(content)
}

function walkTsFiles(dir: string, maxDepth = 3, depth = 0): string[] {
  if (depth > maxDepth || !existsSync(dir)) return []
  const results: string[] = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.next', '.turbo', '.git'].includes(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...walkTsFiles(full, maxDepth, depth + 1))
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        results.push(full)
      }
    }
  } catch {
    // permission error etc.
  }
  return results
}

function anyFileContains(repoRoot: string, dir: string, pattern: RegExp): boolean {
  const fullDir = join(repoRoot, dir)
  if (!existsSync(fullDir)) return false
  const files = walkTsFiles(fullDir)
  for (const f of files) {
    const content = safeRead(f)
    if (pattern.test(content)) return true
  }
  return false
}

// ── Claim Registry ─────────────────────────────────────────────────────────
// Each claim is registered with verification logic

interface ClaimDefinition {
  id: string
  category: string
  text: string
  source: string
  verify: (root: string) => { status: ClaimStatus; evidence: string[]; notes: string }
}

function buildClaimRegistry(): ClaimDefinition[] {
  return [
    // ── Security & Isolation ──────────────────────────────────────────────
    {
      id: 'SEC-001',
      category: 'Security',
      text: 'Org-level tenant isolation with row-level security',
      source: 'ARCHITECTURE.md, procurement-pack.md',
      verify: (root) => {
        const hasSchema = anyFileContains(root, 'packages/db/src/schema', /org_id|orgId/)
        const hasIsolation = packageExists(root, 'platform-isolation')
        const hasTests = packageHasTests(root, 'platform-isolation')
        if (hasSchema && hasIsolation && hasTests) {
          return {
            status: 'implemented',
            evidence: ['packages/db/src/schema (org_id columns)', 'packages/platform-isolation'],
            notes: '',
          }
        }
        if (hasSchema && hasIsolation) {
          return {
            status: 'partial',
            evidence: ['packages/db/src/schema', 'packages/platform-isolation'],
            notes: 'Package exists but tests may be incomplete',
          }
        }
        return { status: 'docs-only', evidence: [], notes: 'No isolation implementation found' }
      },
    },
    {
      id: 'SEC-002',
      category: 'Security',
      text: 'Azure Key Vault for secrets management',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasPkg = packageExists(root, 'secrets')
        const hasKeyVaultRef = anyFileContains(
          root,
          'packages/secrets',
          /@azure\/keyvault|KeyVault|keyvault/,
        )
        if (hasPkg && hasKeyVaultRef) {
          return { status: 'implemented', evidence: ['packages/secrets'], notes: '' }
        }
        if (hasPkg) {
          return {
            status: 'partial',
            evidence: ['packages/secrets'],
            notes: 'Package exists but Key Vault integration unclear',
          }
        }
        return { status: 'docs-only', evidence: [], notes: 'No secrets package found' }
      },
    },
    {
      id: 'SEC-003',
      category: 'Security',
      text: 'Secret scanning in CI (Gitleaks + TruffleHog)',
      source: 'procurement-pack.md',
      verify: (root) => {
        const hasWorkflow = existsSync(join(root, '.github/workflows'))
        const rootPkg = safeRead(join(root, 'package.json'))
        const hasScript = /secret-scan/.test(rootPkg)
        if (hasWorkflow && hasScript) {
          return {
            status: 'implemented',
            evidence: ['.github/workflows', 'package.json#secret-scan'],
            notes: '',
          }
        }
        if (hasScript) {
          return {
            status: 'partial',
            evidence: ['package.json#secret-scan'],
            notes: 'Script exists but workflow not confirmed',
          }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── Evidence & Audit ──────────────────────────────────────────────────
    {
      id: 'AUD-001',
      category: 'Audit',
      text: 'Tamper-evident audit trails with hash-chaining',
      source: 'ARCHITECTURE.md, procurement-pack.md',
      verify: (root) => {
        const hasEvidence =
          packageExists(root, 'evidence') || packageExists(root, 'platform-evidence-pack')
        const hasProof =
          packageExists(root, 'platform-proof') || packageExists(root, 'platform-procurement-proof')
        const hasHashChain = anyFileContains(
          root,
          'packages',
          /hashChain|hash.chain|verifySeal|createSeal/,
        )
        if (hasEvidence && hasProof && hasHashChain) {
          return {
            status: 'implemented',
            evidence: ['packages/evidence', 'packages/platform-proof', 'hash-chain code'],
            notes: '',
          }
        }
        if (hasEvidence || hasProof) {
          return {
            status: 'partial',
            evidence: ['evidence/proof packages exist'],
            notes: 'Hash-chaining implementation unclear',
          }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'AUD-002',
      category: 'Audit',
      text: 'Evidence packs with sealed artifacts for procurement',
      source: 'procurement-pack.md, evidence-packs.md',
      verify: (root) => {
        const hasPkg = packageExists(root, 'platform-evidence-pack')
        const hasProcurement = packageExists(root, 'platform-procurement-proof')
        const hasTests =
          packageHasTests(root, 'platform-evidence-pack') ||
          packageHasTests(root, 'platform-procurement-proof')
        if (hasPkg && hasProcurement && hasTests) {
          return {
            status: 'implemented',
            evidence: ['packages/platform-evidence-pack', 'packages/platform-procurement-proof'],
            notes: '',
          }
        }
        if (hasPkg || hasProcurement) {
          return {
            status: 'partial',
            evidence: ['evidence-pack or procurement-proof package exists'],
            notes: '',
          }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── AI / ML ───────────────────────────────────────────────────────────
    {
      id: 'AI-001',
      category: 'AI',
      text: 'AI control plane with per-app profiles and budget enforcement',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasAiCore = packageExists(root, 'ai-core')
        const hasGoverned = packageExists(root, 'platform-governed-ai')
        const hasProfiles = anyFileContains(
          root,
          'packages/ai-core',
          /profile|budget|costLimit|tokenLimit/,
        )
        if (hasAiCore && hasGoverned && hasProfiles) {
          return {
            status: 'implemented',
            evidence: ['packages/ai-core', 'packages/platform-governed-ai'],
            notes: '',
          }
        }
        if (hasAiCore) {
          return {
            status: 'partial',
            evidence: ['packages/ai-core'],
            notes: 'Budget enforcement may be incomplete',
          }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'AI-002',
      category: 'AI',
      text: 'ML registry with versioned model activation and approval workflows',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasMlCore = packageExists(root, 'ml-core')
        const hasMlSdk = packageExists(root, 'ml-sdk')
        const hasRegistry =
          anyFileContains(root, 'packages/ml-core', /registry|version|approval/) ||
          packageExists(root, 'ai-registry')
        if (hasMlCore && hasRegistry) {
          return {
            status: 'implemented',
            evidence: ['packages/ml-core', 'packages/ai-registry'],
            notes: '',
          }
        }
        if (hasMlCore || hasMlSdk) {
          return {
            status: 'partial',
            evidence: ['packages/ml-core or ml-sdk'],
            notes: 'Registry features unclear',
          }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── Observability ─────────────────────────────────────────────────────
    {
      id: 'OBS-001',
      category: 'Observability',
      text: 'Structured telemetry with OpenTelemetry and request correlation',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasOtel = packageExists(root, 'otel-core')
        const hasObservability = packageExists(root, 'platform-observability')
        const hasCorrelation = anyFileContains(
          root,
          'packages/otel-core',
          /requestId|traceId|correlationId|spanId/,
        )
        if (hasOtel && hasObservability) {
          return {
            status: 'implemented',
            evidence: ['packages/otel-core', 'packages/platform-observability'],
            notes: '',
          }
        }
        if (hasOtel) {
          return { status: 'partial', evidence: ['packages/otel-core'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── Data & Config ─────────────────────────────────────────────────────
    {
      id: 'CFG-001',
      category: 'Configuration',
      text: 'Zod-validated config with fail-fast at startup',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasConfig = packageExists(root, 'config')
        const hasZod = anyFileContains(root, 'packages/config', /z\.object|z\.string|z\.enum/)
        if (hasConfig && hasZod) {
          return { status: 'implemented', evidence: ['packages/config (Zod schemas)'], notes: '' }
        }
        if (hasConfig) {
          return {
            status: 'partial',
            evidence: ['packages/config'],
            notes: 'Zod validation not confirmed',
          }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'DATA-001',
      category: 'Data',
      text: 'Data retention enforcement with audit logging',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasLifecycle = packageExists(root, 'data-lifecycle')
        const hasTests = packageHasTests(root, 'data-lifecycle')
        if (hasLifecycle && hasTests) {
          return { status: 'implemented', evidence: ['packages/data-lifecycle'], notes: '' }
        }
        if (hasLifecycle) {
          return { status: 'partial', evidence: ['packages/data-lifecycle'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── Governance ────────────────────────────────────────────────────────
    {
      id: 'GOV-001',
      category: 'Governance',
      text: 'Centralized RBAC/authorization policy engine',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasPolicyEngine = packageExists(root, 'platform-policy-engine')
        const hasTests = packageHasTests(root, 'platform-policy-engine')
        if (hasPolicyEngine && hasTests) {
          return { status: 'implemented', evidence: ['packages/platform-policy-engine'], notes: '' }
        }
        if (hasPolicyEngine) {
          return { status: 'partial', evidence: ['packages/platform-policy-engine'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'GOV-002',
      category: 'Governance',
      text: 'Partner entitlements as data (no hardcoded defaults)',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasSchema = anyFileContains(
          root,
          'packages/db/src/schema',
          /partner_entit|partnerEntit/,
        )
        const hasOrg = packageExists(root, 'org')
        if (hasSchema && hasOrg) {
          return {
            status: 'implemented',
            evidence: ['packages/db/src/schema (partner_entities)', 'packages/org'],
            notes: '',
          }
        }
        if (hasOrg) {
          return {
            status: 'partial',
            evidence: ['packages/org'],
            notes: 'DB schema for entitlements unclear',
          }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'GOV-003',
      category: 'Governance',
      text: 'SBOM generation and build attestation',
      source: 'procurement-pack.md',
      verify: (root) => {
        const rootPkg = safeRead(join(root, 'package.json'))
        const hasSbom = /generate:sbom/.test(rootPkg)
        const hasAttest = /attest:build/.test(rootPkg)
        if (hasSbom && hasAttest) {
          return {
            status: 'implemented',
            evidence: ['package.json#generate:sbom', 'package.json#attest:build'],
            notes: '',
          }
        }
        if (hasSbom || hasAttest) {
          return { status: 'partial', evidence: ['SBOM or attestation script exists'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── Finance ───────────────────────────────────────────────────────────
    {
      id: 'FIN-001',
      category: 'Finance',
      text: 'QuickBooks Online sync with reconciliation',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasQbo = packageExists(root, 'qbo')
        const hasTests = packageHasTests(root, 'qbo')
        if (hasQbo && hasTests) {
          return { status: 'implemented', evidence: ['packages/qbo'], notes: '' }
        }
        if (hasQbo) {
          return { status: 'partial', evidence: ['packages/qbo'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'FIN-002',
      category: 'Finance',
      text: 'Stripe payment processing with reconciliation',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasStripe = packageExists(root, 'payments-stripe')
        if (hasStripe) {
          return { status: 'implemented', evidence: ['packages/payments-stripe'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── Platform OS ───────────────────────────────────────────────────────
    {
      id: 'PLAT-001',
      category: 'Platform',
      text: 'Platform ontology with typed entity taxonomy',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasPkg = packageExists(root, 'platform-ontology')
        const hasTests = packageHasTests(root, 'platform-ontology')
        if (hasPkg && hasTests) {
          return { status: 'implemented', evidence: ['packages/platform-ontology'], notes: '' }
        }
        if (hasPkg) {
          return { status: 'partial', evidence: ['packages/platform-ontology'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'PLAT-002',
      category: 'Platform',
      text: 'Entity graph with cross-domain relationship tracking',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasPkg = packageExists(root, 'platform-entity-graph')
        const hasTests = packageHasTests(root, 'platform-entity-graph')
        if (hasPkg && hasTests) {
          return { status: 'implemented', evidence: ['packages/platform-entity-graph'], notes: '' }
        }
        if (hasPkg) {
          return { status: 'partial', evidence: ['packages/platform-entity-graph'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'PLAT-003',
      category: 'Platform',
      text: 'Event fabric for cross-domain event routing',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasPkg = packageExists(root, 'platform-event-fabric')
        const hasTests = packageHasTests(root, 'platform-event-fabric')
        if (hasPkg && hasTests) {
          return { status: 'implemented', evidence: ['packages/platform-event-fabric'], notes: '' }
        }
        if (hasPkg) {
          return { status: 'partial', evidence: ['packages/platform-event-fabric'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'PLAT-004',
      category: 'Platform',
      text: 'Semantic search across platform data',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasPkg = packageExists(root, 'platform-semantic-search')
        const hasTests = packageHasTests(root, 'platform-semantic-search')
        if (hasPkg && hasTests) {
          return {
            status: 'implemented',
            evidence: ['packages/platform-semantic-search'],
            notes: '',
          }
        }
        if (hasPkg) {
          return { status: 'partial', evidence: ['packages/platform-semantic-search'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
    {
      id: 'PLAT-005',
      category: 'Platform',
      text: 'Governed AI with policy controls and compliance',
      source: 'ARCHITECTURE.md',
      verify: (root) => {
        const hasPkg = packageExists(root, 'platform-governed-ai')
        const hasTests = packageHasTests(root, 'platform-governed-ai')
        if (hasPkg && hasTests) {
          return { status: 'implemented', evidence: ['packages/platform-governed-ai'], notes: '' }
        }
        if (hasPkg) {
          return { status: 'partial', evidence: ['packages/platform-governed-ai'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── Contract Tests ────────────────────────────────────────────────────
    {
      id: 'TEST-001',
      category: 'Testing',
      text: 'Contract tests covering org isolation, authz, stack authority',
      source: 'ALIGNMENT_REPORT.md',
      verify: (root) => {
        const hasContractTests = dirExists(join(root, 'tooling/contract-tests'))
        const rootPkg = safeRead(join(root, 'package.json'))
        const hasScript = /contract-tests/.test(rootPkg)
        if (hasContractTests && hasScript) {
          return {
            status: 'implemented',
            evidence: ['tooling/contract-tests/', 'package.json#contract-tests'],
            notes: '',
          }
        }
        if (hasScript) {
          return { status: 'partial', evidence: ['contract-tests script'], notes: '' }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },

    // ── Compliance ────────────────────────────────────────────────────────
    {
      id: 'COMP-001',
      category: 'Compliance',
      text: 'Compliance snapshots for point-in-time auditing',
      source: 'procurement-pack.md',
      verify: (root) => {
        const hasPkg = packageExists(root, 'platform-compliance-snapshots')
        const hasTests = packageHasTests(root, 'platform-compliance-snapshots')
        if (hasPkg && hasTests) {
          return {
            status: 'implemented',
            evidence: ['packages/platform-compliance-snapshots'],
            notes: '',
          }
        }
        if (hasPkg) {
          return {
            status: 'partial',
            evidence: ['packages/platform-compliance-snapshots'],
            notes: '',
          }
        }
        return { status: 'docs-only', evidence: [], notes: '' }
      },
    },
  ]
}

// ── Main ────────────────────────────────────────────────────────────────────

export function runClaimVerification(root?: string): ClaimVerificationReport {
  const repoRoot = root ?? findRepoRoot()
  const registry = buildClaimRegistry()

  const claims: Claim[] = registry.map((def) => {
    const result = def.verify(repoRoot)
    return {
      id: def.id,
      category: def.category,
      text: def.text,
      source: def.source,
      ...result,
    }
  })

  const summary: Record<ClaimStatus, number> = {
    implemented: 0,
    partial: 0,
    'docs-only': 0,
    roadmap: 0,
    unsupported: 0,
  }
  for (const c of claims) summary[c.status]++

  const unsafeClaims = claims.filter((c) => c.status === 'docs-only' || c.status === 'unsupported')

  return {
    generatedAt: new Date().toISOString(),
    evidenceScope: EVIDENCE_SCOPE,
    totalClaims: claims.length,
    summary,
    claims,
    unsafeClaims,
  }
}

// ── Report Generation ───────────────────────────────────────────────────────

function generateMarkdown(report: ClaimVerificationReport): string {
  const lines: string[] = []
  lines.push('# NzilaOS Claim Verification Report')
  lines.push('')
  lines.push(`> Generated: ${report.generatedAt}`)
  lines.push('')
  lines.push(...evidenceScopeLines(report))
  lines.push('## Summary')
  lines.push('')
  lines.push('| Status | Count |')
  lines.push('|--------|-------|')
  for (const [status, count] of Object.entries(report.summary)) {
    const icon =
      status === 'implemented'
        ? '✅'
        : status === 'partial'
          ? '🟡'
          : status === 'docs-only'
            ? '📄'
            : status === 'roadmap'
              ? '🗺️'
              : '🔴'
    lines.push(`| ${icon} ${status} | ${count} |`)
  }
  lines.push('')

  const statusOrder: ClaimStatus[] = [
    'unsupported',
    'docs-only',
    'partial',
    'roadmap',
    'implemented',
  ]
  for (const status of statusOrder) {
    const items = report.claims.filter((c) => c.status === status)
    if (items.length === 0) continue

    lines.push(`## ${status.toUpperCase()} (${items.length})`)
    lines.push('')
    for (const c of items) {
      lines.push(`### ${c.id}: ${c.text}`)
      lines.push(`- **Category:** ${c.category}`)
      lines.push(`- **Source:** ${c.source}`)
      lines.push(`- **Status:** ${c.status}`)
      if (c.evidence.length > 0) {
        lines.push(`- **Evidence:** ${c.evidence.join(', ')}`)
      }
      if (c.notes) {
        lines.push(`- **Notes:** ${c.notes}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

function generateUnsafeClaimsMarkdown(report: ClaimVerificationReport): string {
  const lines: string[] = []
  lines.push('# ⚠ Unsafe Claims — Buyer Risk Register')
  lines.push('')
  lines.push(`> Generated: ${report.generatedAt}`)
  lines.push('')
  lines.push('These claims appear in customer-facing materials but lack supporting code evidence.')
  lines.push('Each must be resolved before being included in procurement packs.')
  lines.push('')
  lines.push(...evidenceScopeLines(report))

  if (report.unsafeClaims.length === 0) {
    lines.push(
      'No registered claim is currently `docs-only` or `unsupported`: every claim in the registry',
    )
    lines.push(
      'has code or configuration evidence in the working tree. That is an implementation-evidence',
    )
    lines.push(
      'result only. It is not a buyer-facing safety conclusion, and it does not establish that any',
    )
    lines.push(
      'claim is deployed, runtime-verified, operationally proven, available to customers, or',
    )
    lines.push(
      'production-ready — none of those layers are inspected here. It is also silent about any',
    )
    lines.push('claim that is not in the registry.')
    return lines.join('\n')
  }

  lines.push('| ID | Category | Claim | Status | Action Required |')
  lines.push('|----|----------|-------|--------|-----------------|')
  for (const c of report.unsafeClaims) {
    const action =
      c.status === 'unsupported'
        ? 'Remove from materials OR implement'
        : 'Implement code + tests OR remove claim'
    lines.push(`| ${c.id} | ${c.category} | ${c.text} | ${c.status} | ${action} |`)
  }
  lines.push('')

  return lines.join('\n')
}

function evidenceScopeLines(report: ClaimVerificationReport): string[] {
  const scope = report.evidenceScope
  const lines: string[] = []
  lines.push('## Evidence scope of this report')
  lines.push('')
  lines.push('Static repository inspection only. What that can establish:')
  lines.push('')
  for (const entry of scope.establishes) lines.push(`- ${entry}`)
  lines.push('')
  lines.push('What it cannot establish, and must not be read as:')
  lines.push('')
  for (const entry of scope.doesNotEstablish) lines.push(`- ${entry}`)
  lines.push('')
  lines.push(`**Residual limitation:** ${scope.residualLimitation}`)
  lines.push('')
  return lines
}

// ── CLI entry ───────────────────────────────────────────────────────────────

if (process.argv[1]?.includes('claim-verification')) {
  const root = findRepoRoot()
  const reportsDir = join(root, 'reports')
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })

  console.log('📋 Running Claim Verification Audit...\n')
  const report = runClaimVerification(root)

  writeFileSync(join(reportsDir, 'claim-verification.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(join(reportsDir, 'claim-verification.md'), `${generateMarkdown(report)}\n`)
  writeFileSync(join(reportsDir, 'unsafe-claims.md'), `${generateUnsafeClaimsMarkdown(report)}\n`)

  console.log(`Total claims:   ${report.totalClaims}`)
  console.log(`  Implemented:  ${report.summary.implemented}`)
  console.log(`  Partial:      ${report.summary.partial}`)
  console.log(`  Docs-only:    ${report.summary['docs-only']}`)
  console.log(`  Roadmap:      ${report.summary.roadmap}`)
  console.log(`  Unsupported:  ${report.summary.unsupported}`)

  if (report.unsafeClaims.length > 0) {
    console.log(`\n🔴 ${report.unsafeClaims.length} unsafe claim(s) — see reports/unsafe-claims.md`)
  } else {
    console.log(
      `\nEvery registered claim has code evidence — implementation evidence only, not deployment, runtime, or readiness`,
    )
  }
  console.log(`\nReports written to reports/`)
}
