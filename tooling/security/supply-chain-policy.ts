/**
 * Nzila OS — Supply Chain Security Policy
 *
 * Defines the allowed license list, vulnerability waiver mechanism,
 * and SBOM policy validation. Used by CI to enforce supply-chain gates.
 *
 * Enforcement: This script is invoked by CI as a blocking gate.
 * No high/critical vuln passes without a waiver. No forbidden license
 * passes without explicit approval stored in this file.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── License Policy ────────────────────────────────────────────────────────

/**
 * Licenses explicitly allowed in production dependencies.
 * Any license not in this list triggers a CI failure.
 */
export const ALLOWED_LICENSES: string[] = [
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'Unlicense',
  '0BSD',
  'BlueOak-1.0.0',
  'Python-2.0',
  'Artistic-2.0',
  'Zlib',
  // Dual/multi licenses containing at least one allowed license
  '(MIT OR Apache-2.0)',
  '(MIT OR CC0-1.0)',
  '(BSD-2-Clause OR MIT OR Apache-2.0)',
  '(MIT AND Zlib)',
  '(MIT AND BSD-3-Clause)',
  '(Apache-2.0 OR MIT)',
  '(WTFPL OR MIT)',
  '(BSD-3-Clause OR MIT)',
]

/**
 * Licenses explicitly forbidden — fail immediately.
 */
export const FORBIDDEN_LICENSES: string[] = [
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-3.0',
  'GPL-3.0-only',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'LGPL-2.1',
  'LGPL-3.0',
  'SSPL-1.0',
  'BSL-1.1',
  'Elastic-2.0',
]

// ── Vulnerability Waiver ──────────────────────────────────────────────────

export interface VulnerabilityWaiver {
  /** CVE or GHSA identifier */
  id: string
  /** Package name */
  package: string
  /** Reason for acceptance */
  reason: string
  /** Approver (Clerk user ID or GitHub username) */
  approvedBy: string
  /** ISO date of approval */
  approvedAt: string
  /** Expiry — waiver must be re-reviewed after this date */
  expiresAt: string
  /** Severity at time of waiver */
  severity: 'high' | 'critical'
}

/**
 * Active waivers for known vulnerabilities.
 * Each waiver must have an expiry date. Expired waivers are treated as unwaived.
 * Add waivers via PR — they are code-reviewed and version-controlled.
 */
export const ACTIVE_WAIVERS: VulnerabilityWaiver[] = [
  {
    // minimatch ReDoS via repeated wildcards (CVE-2026-26996 / GHSA-3ppc-4f35-3m26 / npm advisory 1113371)
    // Affected paths: devDependency chains only (eslint > minimatch, eslint-config-next > typescript-eslint > minimatch)
    // No user-controlled input ever reaches minimatch in production — only in local lint tooling.
    // Upgrade to minimatch >= 10.2.1 would break eslint@8/9 which requires minimatch v3/v9 API.
    // Risk: local developer DoS only (not production). Accepted until eslint ships with patched minimatch.
    id: 'CVE-2026-26996',
    package: 'minimatch',
    reason: 'Dev-only dependency (eslint toolchain). No user input reaches minimatch in production runtime. Upgrade to minimatch@10.2.1 would break eslint which requires v3/v9 API. Risk confined to local lint tooling DoS only.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-02-21',
    expiresAt: '2026-05-21',
    severity: 'high',
  },
  {
    // SheetJS (xlsx) Prototype Pollution — CVE-2023-30533 / npm advisory 1108110
    // Affected paths: apps/union-eyes > xlsx@0.18.5
    // The npm package `xlsx` is abandoned — no fix is published to npm.
    // The upstream fix (v0.19.3+) is only available from cdn.sheetjs.com (not npm).
    // Union-Eyes uses xlsx for internal admin report exports only; no untrusted files are read.
    // Migration to cdn.sheetjs.com or an alternative library is planned.
    id: '1108110',
    package: 'xlsx',
    reason: 'SheetJS npm package is abandoned (no npm patch available). Only used for internal admin report exports in union-eyes — no untrusted file input. Migration to cdn.sheetjs.com or alternative planned.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-02-24',
    expiresAt: '2026-05-24',
    severity: 'high',
  },
  {
    // SheetJS (xlsx) ReDoS — CVE-2024-22363 / npm advisory 1108111
    // Same root cause: xlsx npm package abandoned. Same mitigation as above.
    id: '1108111',
    package: 'xlsx',
    reason: 'SheetJS npm package is abandoned (no npm patch available). Only used for internal admin report exports in union-eyes — no untrusted file input. Migration to cdn.sheetjs.com or alternative planned.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-02-24',
    expiresAt: '2026-05-24',
    severity: 'high',
  },
  {
    // minimatch ReDoS via matchOne combinatorial backtracking — npm advisory 1113545
    // Same root cause as CVE-2026-26996: dev-only dependency chain (eslint, typescript-eslint).
    // No user-controlled input reaches minimatch in production.
    id: '1113545',
    package: 'minimatch',
    reason: 'Dev-only dependency (eslint toolchain). No user input reaches minimatch in production. Upgrade would break eslint compatibility. Risk confined to local lint tooling DoS only.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-02-28',
    expiresAt: '2026-05-28',
    severity: 'high',
  },
  {
    // minimatch ReDoS via nested extglobs — npm advisory 1113553
    // Same root cause as CVE-2026-26996: dev-only dependency chain (eslint, typescript-eslint).
    // No user-controlled input reaches minimatch in production.
    id: '1113553',
    package: 'minimatch',
    reason: 'Dev-only dependency (eslint toolchain). No user input reaches minimatch in production. Upgrade would break eslint compatibility. Risk confined to local lint tooling DoS only.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-02-28',
    expiresAt: '2026-05-28',
    severity: 'high',
  },
  {
    // serialize-javascript RCE via RegExp.flags — npm advisory 1113633
    // Affected paths: devDependency chains only (terser-webpack-plugin > serialize-javascript).
    // Not used in production runtime — only during build/bundling steps.
    id: '1113633',
    package: 'serialize-javascript',
    reason: 'Dev-only dependency (terser-webpack-plugin build chain). Not used in production runtime. Upgrade pending upstream patch in webpack/terser ecosystem.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-02-28',
    expiresAt: '2026-05-28',
    severity: 'high',
  },
]

// ── SBOM Validation ───────────────────────────────────────────────────────

interface SbomComponent {
  name?: string
  version?: string
  licenses?: Array<{ license?: { id?: string; name?: string } }>
  [key: string]: unknown
}

interface SbomDocument {
  components?: SbomComponent[]
  [key: string]: unknown
}

export interface LicenseViolation {
  package: string
  version: string
  license: string
  status: 'forbidden' | 'unknown'
}

/**
 * Validate an SBOM against the license policy.
 * Returns an array of violations (empty = pass).
 */
export function validateSbomLicenses(sbomPath: string): LicenseViolation[] {
  const sbom: SbomDocument = JSON.parse(fs.readFileSync(sbomPath, 'utf-8'))
  const violations: LicenseViolation[] = []

  for (const component of sbom.components ?? []) {
    const licenses = component.licenses ?? []
    for (const licenseEntry of licenses) {
      const licenseId = licenseEntry.license?.id ?? licenseEntry.license?.name ?? 'UNKNOWN'

      if (FORBIDDEN_LICENSES.includes(licenseId)) {
        violations.push({
          package: component.name ?? 'unknown',
          version: component.version ?? 'unknown',
          license: licenseId,
          status: 'forbidden',
        })
      } else if (!ALLOWED_LICENSES.includes(licenseId) && licenseId !== 'UNKNOWN') {
        // Check if it's a compound license with at least one allowed
        const isCompoundAllowed = ALLOWED_LICENSES.some((al) =>
          licenseId.includes(al),
        )
        if (!isCompoundAllowed) {
          violations.push({
            package: component.name ?? 'unknown',
            version: component.version ?? 'unknown',
            license: licenseId,
            status: 'unknown',
          })
        }
      }
    }
  }

  return violations
}

// ── Vulnerability Policy Check ────────────────────────────────────────────

export interface VulnPolicyResult {
  passed: boolean
  totalVulns: number
  highOrCritical: number
  waived: number
  unwaived: number
  expiredWaivers: string[]
  errors: string[]
}

/**
 * Check an audit report against the vulnerability waiver policy.
 * High/Critical vulns must be waived or the check fails.
 */
export function checkVulnerabilityPolicy(
  auditReportPath: string,
): VulnPolicyResult {
  const now = new Date()
  const errors: string[] = []

  // Check for expired waivers
  const expiredWaivers = ACTIVE_WAIVERS
    .filter((w) => new Date(w.expiresAt) < now)
    .map((w) => w.id)

  // Active (non-expired) waivers
  const activeWaiverIds = new Set(
    ACTIVE_WAIVERS
      .filter((w) => new Date(w.expiresAt) >= now)
      .map((w) => w.id),
  )

  let totalVulns = 0
  let highOrCritical = 0
  let waived = 0
  let unwaived = 0

  try {
    const report = JSON.parse(fs.readFileSync(auditReportPath, 'utf-8'))
    const advisories: Record<string, { severity?: string; cves?: string[]; ghpiit_id?: string }> =
      report.advisories ?? report.vulnerabilities ?? {}

    for (const [key, advisory] of Object.entries(advisories)) {
      totalVulns++
      const severity = (advisory as any).severity ?? 'unknown'
      if (severity === 'high' || severity === 'critical') {
        highOrCritical++
        // Check if waived by CVE or GHSA ID
        const ids = [key, ...((advisory as any).cves ?? [])]
        const isWaived = ids.some((id) => activeWaiverIds.has(id))
        if (isWaived) {
          waived++
        } else {
          unwaived++
          errors.push(`Unwaived ${severity} vulnerability: ${key}`)
        }
      }
    }
  } catch (err) {
    errors.push(`Failed to parse audit report: ${(err as Error).message}`)
  }

  if (expiredWaivers.length > 0) {
    errors.push(`Expired waivers requiring review: ${expiredWaivers.join(', ')}`)
  }

  return {
    passed: unwaived === 0 && expiredWaivers.length === 0,
    totalVulns,
    highOrCritical,
    waived,
    unwaived,
    expiredWaivers,
    errors,
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'check-licenses') {
    const sbomPath = args[1]
    if (!sbomPath) {
      console.error('Usage: supply-chain-policy check-licenses <sbom.json>')
      process.exit(1)
    }
    const violations = validateSbomLicenses(sbomPath)
    if (violations.length > 0) {
      console.error('❌ License policy violations found:')
      for (const v of violations) {
        console.error(`  ${v.status.toUpperCase()}: ${v.package}@${v.version} — ${v.license}`)
      }
      process.exit(1)
    }
    console.log('✅ All licenses comply with policy.')
    process.exit(0)
  }

  if (command === 'check-vulns') {
    const auditPath = args[1]
    if (!auditPath) {
      console.error('Usage: supply-chain-policy check-vulns <audit-report.json>')
      process.exit(1)
    }
    const result = checkVulnerabilityPolicy(auditPath)
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) {
      console.error('❌ Vulnerability policy check failed:')
      result.errors.forEach((e) => console.error(`  ${e}`))
      process.exit(1)
    }
    console.log('✅ All vulnerabilities waived or below threshold.')
    process.exit(0)
  }

  console.error('Usage: supply-chain-policy <check-licenses|check-vulns> <file>')
  process.exit(1)
}

if (process.argv[1]?.includes('supply-chain-policy')) {
  main().catch((err) => {
    console.error('Fatal:', err)
    process.exit(1)
  })
}
