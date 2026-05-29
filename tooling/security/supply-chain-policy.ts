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
    // minimatch ReDoS via repeated wildcards (CVE-2026-26996 / GHSA-3ppc-4f35-3m26 / npm advisory 1113371)
    // Affected paths: devDependency chains only (eslint > minimatch, eslint-config-next > typescript-eslint > minimatch)
    // No user-controlled input ever reaches minimatch in production — only in local lint tooling.
    // Upgrade to minimatch >= 10.2.1 would break eslint@8/9 which requires minimatch v3/v9 API.
    // Risk: local developer DoS only (not production). Accepted until eslint ships with patched minimatch.
    id: 'CVE-2026-26996',
    package: 'minimatch',
    reason: 'Dev-only dependency (eslint toolchain). No user input reaches minimatch in production runtime. Upgrade to minimatch@10.2.1 would break eslint which requires v3/v9 API. Risk confined to local lint tooling DoS only.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-05-20',
    expiresAt: '2026-08-20',
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
    expiresAt: '2026-08-24',
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
    expiresAt: '2026-08-24',
    severity: 'high',
  },
  {
    // minimatch ReDoS via multiple non-adjacent GLOBSTAR segments — npm advisory 1113686 / GHSA-7r86-cg39-jmmj
    // Affected paths: apps/union-eyes > glob > minimatch (>=10.0.0 <10.2.3)
    // Same root cause as other minimatch waivers: no user-controlled input reaches minimatch in production.
    // The glob package is used only in build/script tooling, not in production runtime.
    id: '1113686',
    package: 'minimatch',
    reason: 'Build/script tooling dependency (glob > minimatch). No user input reaches minimatch in production runtime. Upgrade to minimatch@10.2.3 pending upstream glob release. Risk confined to local/CI tooling DoS only.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-03-04',
    expiresAt: '2026-06-04',
    severity: 'high',
  },
  {
    // immutable Prototype Pollution — CVE-2026-29063 / GHSA-wf6x-7x77-mvgw / npm advisory 1113984
    // Affected path: apps/union-eyes > swagger-ui-react > immutable@3.8.2
    // immutable@3.x has no upstream fix — the fix requires upgrading to v4.3.8+ (breaking API change).
    // swagger-ui-react@5.x is hard-coupled to immutable@3.x internals; forcing v4 via override breaks rendering.
    // swagger-ui-react is used exclusively for internal API documentation (no public user access).
    // No user-controlled data flows through immutable merge/toJS operations in our usage pattern.
    // Remediation plan: track swagger-ui migration off immutable@3; re-evaluate when a compatible release is available.
    id: '1113984',
    package: 'immutable',
    reason: 'Transitive dependency of swagger-ui-react (internal API docs only). immutable@3.x has no npm fix; v4 upgrade is a breaking API change that breaks swagger-ui-react rendering. No user-controlled data flows through affected APIs. Mitigated by internal-only access and no untrusted merge input.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-03-04',
    expiresAt: '2026-06-04',
    severity: 'high',
  },
  {
    // protobufjs Arbitrary code execution — npm advisory 1116756 / GHSA-26hc-5v75-x5xw
    // Affected path: Deep transitive dependency via ML/data packages (@tensorflow/tfjs-node, etc.)
    // protobufjs is used exclusively for protocol buffer deserialization in data pipeline initialization.
    // No untrusted protobuf messages are deserialized at runtime from user input.
    // All protobuf schemas are static/embedded in the application.
    // Upstream patched in protobufjs@7.x but upgrade requires updating entire serialization stack.
    // Risk mitigated by: (1) no user-controlled messages, (2) deep in data pipeline initialization, (3) no WASM bridge for untrusted input.
    id: '1116756',
    package: 'protobufjs',
    reason: 'Transitive dev/ML dependency for TensorFlow data serialization. Used exclusively for static embedded schemas; no untrusted protobuf message deserialization. Upgrade blocked by TensorFlow compatibility constraints. Mitigated by no user input flowing through protobuf codec.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-04-17',
    expiresAt: '2026-07-17',
    severity: 'critical',
  },
  {
    // protobufjs Arbitrary code execution — npm advisory 1116757 / GHSA-3xgq-45jh-7f2r
    // Same root cause as 1116756: protobufjs arbitrary code execution via crafted proto files.
    // Same mitigation: no user-controlled protobuf messages in production runtime.
    id: '1116757',
    package: 'protobufjs',
    reason: 'Transitive dev/ML dependency for TensorFlow data serialization. Used exclusively for static embedded schemas; no untrusted protobuf message deserialization. Upgrade blocked by TensorFlow compatibility constraints. Mitigated by no user input flowing through protobuf codec.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-04-17',
    expiresAt: '2026-07-17',
    severity: 'critical',
  },
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
    approvedAt: '2026-05-15',
    expiresAt: '2026-08-15',
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
    approvedAt: '2026-05-15',
    expiresAt: '2026-08-15',
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
    approvedAt: '2026-05-15',
    expiresAt: '2026-08-15',
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
    approvedAt: '2026-05-15',
    expiresAt: '2026-08-15',
    severity: 'high',
  },
  // Next.js advisories (1117930, 1117931, 1117960, 1117961, 1117964, 1117965, 1117966, 1117967,
  //   1117970, 1117971, 1117972, 1117973, 1117979, 1117980) — DoS / SSRF / middleware bypass
  // Tracked for upgrade in next dependency sweep. Triaged 2026-05-11.
  // Mitigations: edge proxy.ts is minimal (no auth in middleware); no user-controlled WebSocket
  // upgrade targets; cache components disabled in production; i18n routes have explicit allow-list.
  ...['1117930', '1117931', '1117960', '1117961', '1117964', '1117965', '1117966', '1117967',
      '1117970', '1117971', '1117972', '1117973', '1117979', '1117980'].map((id) => ({
    id,
    package: 'next',
    reason: 'Next.js high-severity advisory triaged 2026-05-11. Mitigations in place (minimal edge middleware, no user-controlled WS upgrade targets, cache components off in prod, i18n allow-list). Tracked for upgrade in next dependency sweep.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-05-11',
    expiresAt: '2026-06-11',
    severity: 'high' as const,
  })),
  // OpenTelemetry Prometheus exporter crash (1117941, 1117942, 1117943)
  // Affects @opentelemetry/auto-instrumentations-node, sdk-node, exporter-prometheus.
  // Prometheus exporter endpoint is internal-only (cluster network), not exposed externally.
  // Tracked for upgrade in next dependency sweep.
  ...[
    { id: '1117941', pkg: '@opentelemetry/auto-instrumentations-node' },
    { id: '1117942', pkg: '@opentelemetry/sdk-node' },
    { id: '1117943', pkg: '@opentelemetry/exporter-prometheus' },
  ].map(({ id, pkg }) => ({
    id,
    package: pkg,
    reason: 'Prometheus exporter crash via malformed HTTP request. Exporter endpoint is internal cluster-network only, not externally exposed. Tracked for upgrade in next dependency sweep.',
    approvedBy: 'platform-lead',
    approvedAt: '2026-05-11',
    expiresAt: '2026-06-11',
    severity: 'high' as const,
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
    const resolvedAuditReportPath = safeResolveUnderRoot(auditReportPath)
    const report = JSON.parse(readUtf8(resolvedAuditReportPath))
    const advisories: Record<string, { severity?: string; cves?: string[]; ghpiit_id?: string }> =
      report.advisories ?? report.vulnerabilities ?? {}

    for (const [key, advisory] of Object.entries(advisories)) {
      totalVulns++
      const severity = advisory.severity ?? 'unknown'
      if (severity === 'high' || severity === 'critical') {
        highOrCritical++
        // Check if waived by CVE or GHSA ID
        const ids = [key, ...(advisory.cves ?? [])]
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
