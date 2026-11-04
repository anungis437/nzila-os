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
import * as child_process from 'node:child_process'

const ROOT = path.resolve(__dirname, '..', '..')

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function canonicalPath(value: string): string {
  const normalized = normalizePath(value)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isWithinBase(candidate: string, base: string): boolean {
  const candidateCanonical = canonicalPath(candidate)
  const baseCanonical = canonicalPath(base)
  return candidateCanonical === baseCanonical || candidateCanonical.startsWith(`${baseCanonical}/`)
}

function safeJoinUnder(base: string, ...parts: string[]): string | null {
  if (parts.some((part) => part.includes('\0') || /(^|[\\/])\.\.([\\/]|$)/.test(part))) return null
  const candidate = normalizePath([base, ...parts].join('/'))
  return isWithinBase(candidate, base) ? candidate : null
}

function safeResolveUnderRoot(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    if (isWithinBase(filePath, ROOT)) return normalizePath(filePath)
    throw new Error(`Unsafe absolute path outside repository root: ${filePath}`)
  }
  const safePath = safeJoinUnder(ROOT, filePath)
  if (!safePath) throw new Error(`Unsafe path outside repository root: ${filePath}`)
  return safePath
}

function readUtf8(filePath: string): string {
  return child_process.execFileSync(
    process.execPath,
    ['-e', 'const fs=require("node:fs");process.stdout.write(fs.readFileSync(process.argv[1],"utf8"));', filePath],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  )
}

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
  /** Approver (platform user ID or GitHub username) */
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
    // node-forge RSA PKCS#1 v1.5 signature verification (npm advisory 1240912). No patched version published.
    // Path: apps/union-eyes > firebase-admin > node-forge. Review by 2026-11-04.
    id: '1240912',
    package: 'node-forge',
    reason: 'No patched version exists upstream. Transitive via firebase-admin; app does not verify untrusted RSA PKCS#1 v1.5 signatures with node-forge. Re-review when upstream fix ships.',
    approvedBy: 'Aubert Nungisa',
    approvedAt: '2026-10-04',
    expiresAt: '2026-11-04',
    severity: 'high',
  },
  {
    // braces stack-exhaustion DoS (npm advisory 1240992). No patched version published.
    // Path: @changesets/cli > @changesets/config > micromatch > braces (dev tooling only).
    id: '1240992',
    package: 'braces',
    reason: 'No patched version exists upstream. Dev-only changesets tooling; never shipped in a runtime and no untrusted input reaches it.',
    approvedBy: 'Aubert Nungisa',
    approvedAt: '2026-10-04',
    expiresAt: '2026-11-04',
    severity: 'high',
  },
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
    approvedAt: '2026-08-26',
    expiresAt: '2026-11-26',
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
    approvedAt: '2026-08-26',
    expiresAt: '2026-11-26',
    severity: 'high',
  },
  {
    // SheetJS (xlsx) ReDoS — CVE-2024-22363 / npm advisory 1108111
    // Same root cause: xlsx npm package abandoned. Same mitigation as above.
    id: '1108111',
    package: 'xlsx',
    reason: 'SheetJS npm package is abandoned (no npm patch available). Only used for internal admin report exports in union-eyes — no untrusted file input. Migration to cdn.sheetjs.com or alternative planned.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-08-26',
    expiresAt: '2026-11-26',
    severity: 'high',
  },


  // NOTE: protobufjs waivers (1116756, 1116757) removed 2026-07-19 —
  // pnpm overrides on @grpc/proto-loader>protobufjs, google-gax>protobufjs,
  // @google-cloud/firestore>protobufjs, @opentelemetry/otlp-transformer>protobufjs,
  // and proto3-json-serializer>protobufjs now pin protobufjs>=8.4.1, which patches
  // both GHSA-26hc-5v75-x5xw and GHSA-3xgq-45jh-7f2r. The advisories no longer
  // appear in `pnpm audit --json`, so keeping expired waivers would cause the
  // waiver-integrity check to fail (expired without re-review).
  {
    // Axios NO_PROXY bypass — npm advisory 1117576
    // Affected paths: transitive dependency in dev/build tooling (multiple packages depend on axios).
    // Production apps do not make outbound requests through user-controlled proxy configurations.
    // The NO_PROXY bypass only affects environments where proxy env vars are user-controlled.
    // Upgrade to axios >= 1.8.2 is the fix; pending dependency tree audit.
    id: '1117576',
    package: 'axios',
    reason: 'NO_PROXY bypass. Transitive dep in build/dev tooling. Production apps do not expose user-controlled proxy settings. Upgrade to axios@1.8.2+ pending dep tree audit.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-08-26',
    expiresAt: '2026-11-26',
    severity: 'high',
  },
  {
    // Axios prototype pollution (read-side) — npm advisory 1117578
    // Same root package (axios < 1.8.2). Prototype pollution via crafted response object.
    // Mitigated by: (1) server-to-server only (no untrusted response bodies in user-controlled paths),
    // (2) no untrusted JSON deserialized without schema validation.
    id: '1117578',
    package: 'axios',
    reason: 'Prototype pollution read-side. Transitive dep in dev/build tooling and internal service-to-service calls. No untrusted response bodies from user-controlled sources. Upgrade to axios@1.8.2+ pending dep tree audit.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-08-26',
    expiresAt: '2026-11-26',
    severity: 'high',
  },
  {
    // Axios prototype pollution (response tampering) — npm advisory 1117591
    // Same root package (axios < 1.8.2). Response object prototype pollution.
    // Same mitigations as 1117578.
    id: '1117591',
    package: 'axios',
    reason: 'Prototype pollution response tampering. Same root cause as 1117578. Transitive dep; no untrusted response bodies from user-controlled sources. Upgrade to axios@1.8.2+ pending dep tree audit.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-08-26',
    expiresAt: '2026-11-26',
    severity: 'high',
  },
  {
    // Axios header injection — npm advisory 1117593
    // Same root package (axios < 1.8.2). CRLF header injection via crafted header values.
    // Mitigated by: all header values are application-controlled (not user-supplied).
    // No user-controlled strings are passed as HTTP header values in our axios usage.
    id: '1117593',
    package: 'axios',
    reason: 'Header injection via CRLF. Transitive dep; no user-controlled strings passed as HTTP header values in axios calls. Application-controlled headers only. Upgrade to axios@1.8.2+ pending dep tree audit.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-08-26',
    expiresAt: '2026-11-26',
    severity: 'high',
  },



  // NOTE: Expired 2026-09-18 waivers removed 2026-09-23 after remediation review:
  //   - 1113686 (minimatch) — override pins minimatch>=10.2.3; advisory no longer in audit
  //   - 1113984 (immutable@3 via swagger-ui) — override pins immutable>=5.1.8; advisory no longer in audit
  //   - 1117930–1117980 (next) — pnpm override resolves next@16.3.4; old advisory IDs absent from audit
  //   - 1117941–1117943 (otel) — auto-instrumentations-node>=0.75.0 / sdk-node@0.217+; absent from audit
  // Fresh high finding 1239030 (adm-zip) remediated by override adm-zip>=0.6.1 (also clears 1193734).

  // npm advisory feed rollover (2026-08-01): new IDs for previously triaged dependency families.
  // Approved as a temporary bridge while dependency upgrades are prepared.
  ...[
    { id: '1123898', pkg: 'brace-expansion' },
    { id: '1130591', pkg: 'brace-expansion' },
    { id: '1123911', pkg: 'js-yaml' },
    { id: '1123912', pkg: 'js-yaml' },
    { id: '1123940', pkg: 'tar', severity: 'critical' as const },
    { id: '1123941', pkg: 'tar' },
    { id: '1123943', pkg: 'socket.io' },
    { id: '1123944', pkg: 'shell-quote' },
    { id: '1123967', pkg: 'axios' },
    { id: '1124007', pkg: 'immutable' },
    { id: '1124017', pkg: 'immutable' },
    { id: '1124064', pkg: 'fast-uri' },
    { id: '1130178', pkg: 'fast-uri' },
    { id: '1124066', pkg: 'sharp' },
    { id: '1124170', pkg: 'next' },
    { id: '1124171', pkg: 'next' },
    { id: '1124184', pkg: 'next' },
    { id: '1124192', pkg: 'next' },
    { id: '1124242', pkg: 'next-auth', severity: 'critical' as const },
    { id: '1124244', pkg: 'next-auth' },
    { id: '1124246', pkg: 'next-auth', severity: 'critical' as const },
    { id: '1124273', pkg: 'find-my-way' },
    { id: '1124288', pkg: 'postcss' },
  ].map(({ id, pkg, severity }) => ({
    id,
    package: pkg,
    reason: 'Temporary advisory-ID rollover waiver (2026-08-01). Risk previously triaged for this dependency family; tracked for remediation in the next dependency upgrade sweep.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-08-01',
    expiresAt: '2026-10-31',
    severity: severity ?? ('high' as const),
  })),
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
  const resolvedSbomPath = safeResolveUnderRoot(sbomPath)
  const sbom: SbomDocument = JSON.parse(readUtf8(resolvedSbomPath))
  const violations: LicenseViolation[] = []

  if (!Array.isArray(sbom.components)) {
    throw new Error('SBOM missing components array')
  }
  // An empty inventory is not evidence that the dependency graph was scanned.
  // Refuse an empty CycloneDX document rather than declaring all licenses safe.
  if (sbom.components.length === 0) {
    throw new Error('SBOM contains no components to validate')
  }

  for (const component of sbom.components) {
    if (!component || typeof component !== 'object' || Array.isArray(component) ||
        typeof component.name !== 'string' || !component.name.trim() ||
        typeof component.version !== 'string' || !component.version.trim()) {
      throw new Error('SBOM contains a component without canonical name and version')
    }
    if (!Array.isArray(component.licenses)) {
      throw new Error(`SBOM component ${component.name} has no licenses array`)
    }
    const licenses = component.licenses
    if (licenses.length === 0) {
      violations.push({ package: component.name, version: component.version, license: 'UNKNOWN', status: 'unknown' })
      continue
    }
    for (const licenseEntry of licenses) {
      if (!licenseEntry || typeof licenseEntry !== 'object' || Array.isArray(licenseEntry)) {
        throw new Error(`Malformed license entry for ${component.name}`)
      }
      // CycloneDX license identifiers and names must not contradict each other.
      // Prefer rejecting ambiguous evidence over silently authorizing an allowed id.
      const license = licenseEntry.license
      if (license !== undefined && (!license || typeof license !== 'object' || Array.isArray(license))) {
        throw new Error(`Malformed license identity for ${component.name}`)
      }
      if (license && ((license.id !== undefined && typeof license.id !== 'string') ||
          (license.name !== undefined && typeof license.name !== 'string') ||
          (license.id !== undefined && license.name !== undefined && license.id !== license.name && (ALLOWED_LICENSES.includes(license.name) || FORBIDDEN_LICENSES.includes(license.name))))) {
        throw new Error(`Conflicting or malformed license identity for ${component.name}`)
      }
      const licenseId = license?.id ?? license?.name ?? 'UNKNOWN'

      if (FORBIDDEN_LICENSES.includes(licenseId)) {
        violations.push({
          package: component.name ?? 'unknown',
          version: component.version ?? 'unknown',
          license: licenseId,
          status: 'forbidden',
        })
      } else if (!ALLOWED_LICENSES.includes(licenseId)) {
        // License expressions must match an explicitly reviewed allowlist entry.
        // Substring matching can authorize forbidden or fabricated expressions
        // merely because they contain an allowed identifier such as "MIT".
        violations.push({
          package: component.name ?? 'unknown',
          version: component.version ?? 'unknown',
          license: licenseId,
          status: 'unknown',
        })
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
  now: Date = new Date(),
): VulnPolicyResult {
  const errors: string[] = []

  // Waivers expire at the END of their recorded UTC calendar day. No invalid
  // date, duplicate record, expired exception, or ambiguous approval is valid.
  const activeWaivers = new Map<string, VulnerabilityWaiver>()
  const expiredWaivers: string[] = []
  const seenIds = new Set<string>()
  for (const waiver of ACTIVE_WAIVERS) {
    const endOfDay = /^\d{4}-\d{2}-\d{2}$/.test(waiver.expiresAt)
      ? new Date(`${waiver.expiresAt}T23:59:59.999Z`) : new Date(Number.NaN)
    if (!Number.isFinite(endOfDay.valueOf())) {
      errors.push(`Malformed expiry on waiver ${waiver.id}`)
      continue
    }
    if (!waiver.id || !waiver.package || !waiver.approvedBy?.trim() || !waiver.reason?.trim() || seenIds.has(waiver.id) ||
        !['high', 'critical'].includes(waiver.severity) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(waiver.approvedAt) ||
        !Number.isFinite(new Date(`${waiver.approvedAt}T00:00:00.000Z`).valueOf()) ||
        new Date(`${waiver.approvedAt}T00:00:00.000Z`) > now ||
        new Date(`${waiver.approvedAt}T00:00:00.000Z`) > endOfDay) {
      errors.push(`Invalid or duplicate waiver record: ${waiver.id || 'missing-id'}`)
      continue
    }
    seenIds.add(waiver.id)
    if (endOfDay < now) expiredWaivers.push(waiver.id)
    else activeWaivers.set(waiver.id, waiver)
  }

  let totalVulns = 0
  let highOrCritical = 0
  let waived = 0
  let unwaived = 0

  try {
    const resolvedAuditReportPath = safeResolveUnderRoot(auditReportPath)
    const report: unknown = JSON.parse(readUtf8(resolvedAuditReportPath))
    if (!report || typeof report !== 'object' || Array.isArray(report)) {
      throw new Error('Audit report must be an object')
    }
    const root = report as Record<string, unknown>
    const metadata = root.metadata
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error('Audit report missing completion metadata')
    }
    const details = metadata as Record<string, unknown>
    const summary = details.vulnerabilities
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
      throw new Error('Audit report missing vulnerability summary')
    }
    // A forged empty report must not pass by omitting the collector's
    // completion evidence. Only the audited bulk-collector schema is accepted.
    if (details.source !== 'npm-bulk-advisories' ||
        details.status !== 'complete' ||
        details.lockfile !== 'pnpm-lock.yaml') {
      throw new Error('Audit report lacks supported collector provenance or completion')
    }
    if (!Number.isSafeInteger(details.totalDependencies) ||
        (details.totalDependencies as number) <= 0) {
      throw new Error('Audit report has no verified dependency inventory')
    }
    // The collector emits one canonical advisory map. Conflicting alternative
    // maps must not be used to conceal findings by precedence/fallback.
    if (Object.prototype.hasOwnProperty.call(root, 'vulnerabilities')) {
      throw new Error('Unexpected alternate vulnerabilities collection in bulk audit report')
    }
    const value = root.advisories
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Audit report has no valid advisories/vulnerabilities collection')
    }

    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`Malformed advisory record: ${key}`)
      }
      const advisory = raw as Record<string, unknown>
      // Bind the advisory map key to its declared identity. A mismatched ID
      // must never inherit a waiver belonging to a different finding.
      if (advisory.id !== undefined && (typeof advisory.id !== 'string' || advisory.id !== key)) {
        throw new Error(`Advisory identity mismatch: ${key}`)
      }
      const severity = advisory.severity
      if (!['info', 'low', 'moderate', 'high', 'critical'].includes(String(severity))) {
        throw new Error(`Unknown severity for advisory: ${key}`)
      }
      // Validate secondary identifiers at EVERY severity, including low/info.
      // Otherwise malformed scanner evidence can be hidden in below-threshold entries.
      // Never silently discard malformed secondary identifiers: doing so can
      // conceal inconsistent scanner evidence or accidentally authorize a waiver.
      if (advisory.cves !== undefined &&
          (!Array.isArray(advisory.cves) ||
           advisory.cves.some((id: unknown) => typeof id !== 'string' || !/^CVE-[0-9]{4}-[0-9]{4,}$/i.test(id)))) {
        throw new Error(`Malformed CVE identifiers for advisory: ${key}`)
      }
      if (advisory.ghsa_id !== undefined &&
          (typeof advisory.ghsa_id !== 'string' || !/^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/i.test(advisory.ghsa_id))) {
        throw new Error(`Malformed GHSA identifier for advisory: ${key}`)
      }
      // Every finding must identify its affected artifact, even below the
      // blocking threshold. Otherwise incomplete scanner evidence can pass.
      const packageAliases = [advisory.package, advisory.module_name, advisory.name]
        .filter((candidate) => candidate !== undefined)
      if (packageAliases.some((candidate) => typeof candidate !== 'string' || !candidate.trim() || candidate !== candidate.trim() || /[\u0000-\u001f\u007f]/.test(candidate)) ||
          new Set(packageAliases.map((candidate) => (candidate as string).trim())).size > 1) {
        throw new Error(`Conflicting or malformed package identities for advisory: ${key}`)
      }
      const packageString = (packageAliases[0] as string | undefined)?.trim() ?? ''
      if (!packageString) {
        throw new Error(`Missing package identity for advisory: ${key}`)
      }
      totalVulns++
      if (severity !== 'high' && severity !== 'critical') continue
      highOrCritical++
      const additionalIds: string[] = advisory.cves === undefined ? [] : advisory.cves as string[]
      const ids = [key, ...additionalIds]
      if (typeof advisory.ghsa_id === 'string') ids.push(advisory.ghsa_id)
      const isWaived = !!packageString && ids.some((id) => {
        const waiver = activeWaivers.get(id)
        return waiver !== undefined && waiver.package === packageString && waiver.severity === severity
      })
      if (isWaived) waived++
      else {
        unwaived++
        errors.push(`Unwaived ${severity} vulnerability: ${key} (${packageString || 'unknown-package'})`)
      }
    }

    const summaryDetails = summary as Record<string, unknown>
    const severities = ['info', 'low', 'moderate', 'high', 'critical'] as const
    for (const severity of [...severities, 'total']) {
      const supplied = summaryDetails[severity]
      if (!Number.isSafeInteger(supplied) || (supplied as number) < 0) {
        throw new Error(`Malformed or missing vulnerability summary: ${severity}`)
      }
    }
    const counted = Object.fromEntries(severities.map((severity) => [severity, 0])) as Record<string, number>
    for (const raw of Object.values(value as Record<string, unknown>)) {
      const severity = (raw as Record<string, unknown>).severity as string
      counted[severity]++
    }
    for (const severity of severities) {
      if (counted[severity] !== summaryDetails[severity]) {
        throw new Error(`Audit advisory count disagrees with collector metadata: ${severity}`)
      }
    }
    if (totalVulns !== summaryDetails.total) {
      throw new Error('Audit advisory total disagrees with collector metadata')
    }
  } catch (err) {
    errors.push(`Invalid or unreadable audit report: ${(err as Error).message}`)
  }

  if (expiredWaivers.length) {
    errors.push(`Expired waivers requiring review: ${expiredWaivers.join(', ')}`)
  }

  return {
    passed: unwaived === 0 && expiredWaivers.length === 0 && errors.length === 0,
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
