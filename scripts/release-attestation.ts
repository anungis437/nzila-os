/**
 * Nzila OS — Release Attestation Generator
 *
 * Generates a `release-attestation.json` artifact that captures the full
 * security and quality posture at deploy time. This artifact is uploaded
 * alongside every pilot/prod deploy to create a tamper-evident release record.
 *
 * Contents:
 *   - Commit SHA
 *   - Contract test result (pass/fail)
 *   - SLO gate result (pass/fail)
 *   - SBOM digest (if available)
 *   - Trivy scan summary
 *   - Secret scan summary
 *   - Artifact digests (built bundles: web, console, union-eyes)
 *   - Dependency lockfile hash
 *   - Ed25519 signature (when ATTESTATION_SIGNING_KEY is available)
 *   - Timestamp + attestation hash
 *
 * Usage:
 *   npx tsx scripts/release-attestation.ts --sha <commit-sha> [--contract-pass] [--slo-pass]
 *
 * @module scripts/release-attestation
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { hashDirectory } from './release/artifact-tree.mjs'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ReleaseAttestation {
  /** Schema version */
  version: '2.0'
  /** Git commit SHA being deployed */
  commitSha: string
  /** Whether contract tests passed */
  contractTestResult: 'pass' | 'fail' | 'skipped'
  /** Whether SLO gate passed */
  sloGateResult: 'pass' | 'fail' | 'skipped'
  /** SHA-256 digest of the SBOM file (null if not available) */
  sbomDigest: string | null
  /** Raw staging manifest SHA-256, binding deploy target image digests to signature */
  manifestDigest: string | null
  /** GitHub Actions run ID of the staging artifact build */
  stagingRunId: string | null
  /** Trivy vulnerability scan summary */
  trivySummary: TrivySummary
  /** Secret scan summary */
  secretScanSummary: SecretScanSummary
  /** SHA-256 digests of built bundles (web, console, union-eyes, etc.) */
  artifactDigests: ArtifactDigest[]
  /** SHA-256 hash of the pnpm-lock.yaml lockfile */
  lockfileHash: string | null
  /** Ed25519 signature of the attestation (hex-encoded) */
  signature: string | null
  /** ISO 8601 timestamp of attestation generation */
  timestamp: string
  /** Target environment */
  environment: string
  /** SHA-256 digest of this attestation (excluding this field + signature) */
  attestationDigest: string
}

export interface ArtifactDigest {
  /** App or bundle name (e.g. 'web', 'console', 'union-eyes') */
  name: string
  /** SHA-256 digest of the bundle directory */
  digest: string
  /** File count in the bundle */
  fileCount: number
}

export interface TrivySummary {
  /** Whether Trivy scan completed */
  ran: boolean
  /** Number of critical vulnerabilities */
  critical: number
  /** Number of high vulnerabilities */
  high: number
  /** Number of medium vulnerabilities */
  medium: number
  /** Number of low vulnerabilities */
  low: number
}

export interface SecretScanSummary {
  /** Whether secret scan completed */
  ran: boolean
  /** Number of findings */
  findings: number
  /** Whether all findings are resolved/waived */
  clean: boolean
}

// ── Helpers ─────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, '..')

function readJsonSafe<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

function computeSbomDigest(): string | null {
  const sbomPaths = [
    join(ROOT, 'sbom.json'),
    join(ROOT, 'sbom.spdx.json'),
    join(ROOT, 'sbom.cdx.json'),
  ]
  for (const p of sbomPaths) {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf-8')
      return createHash('sha256').update(content).digest('hex')
    }
  }
  return null
}

function computeManifestDigest(): string | null {
  const path = join(ROOT, 'artifact-manifest.json')
  if (!existsSync(path)) return null
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function parseTrivyResults(): TrivySummary {
  const trivyPaths = [
    join(ROOT, 'trivy-results.json'),
    join(ROOT, 'trivy-report.json'),
  ]

  for (const p of trivyPaths) {
    const data = readJsonSafe<{ Results?: Array<{ Vulnerabilities?: Array<{ Severity: string }> }> }>(p)
    if (data?.Results) {
      const counts = { critical: 0, high: 0, medium: 0, low: 0 }
      for (const result of data.Results) {
        for (const vuln of result.Vulnerabilities ?? []) {
          const sev = vuln.Severity?.toLowerCase() as keyof typeof counts
          if (sev in counts) counts[sev]++
        }
      }
      return { ran: true, ...counts }
    }
  }

  return { ran: false, critical: 0, high: 0, medium: 0, low: 0 }
}

function parseSecretScanResults(): SecretScanSummary {
  const scanPaths = [
    join(ROOT, 'gitleaks-report.json'),
    join(ROOT, 'secret-scan-results.json'),
  ]

  for (const p of scanPaths) {
    const data = readJsonSafe<Array<Record<string, unknown>>>(p)
    if (Array.isArray(data)) {
      return {
        ran: true,
        findings: data.length,
        clean: data.length === 0,
      }
    }
  }

  return { ran: false, findings: 0, clean: true }
}

function deepCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepCanonical)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map(key => [key, deepCanonical((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

function computeAttestationDigest(attestation: Omit<ReleaseAttestation, 'attestationDigest' | 'signature'>): string {
  // A top-level JSON.stringify replacer drops nested security fields. Recursive
  // canonicalisation is mandatory before signing any release evidence.
  return createHash('sha256').update(JSON.stringify(deepCanonical(attestation))).digest('hex')
}

/**
 * Compute SHA-256 digests for built app bundles.
 * Scans .next/ and dist/ directories in apps/.
 */
function computeArtifactDigests(): ArtifactDigest[] {
  const appsDir = join(ROOT, 'apps')
  const targetApps = ['web', 'console', 'union-eyes', 'partners', 'abr', 'cfo', 'trade', 'zonga', 'nacp-exams', 'shop-quoter']
  const digests: ArtifactDigest[] = []

  for (const app of targetApps) {
    const buildDirs = [
      join(appsDir, app, '.next'),
      join(appsDir, app, 'dist'),
    ]
    for (const dir of buildDirs) {
      if (existsSync(dir)) {
        const { digest, fileCount } = hashDirectory(dir)
        digests.push({ name: app, digest, fileCount })
        break // use first found build dir
      }
    }
  }

  return digests
}

// Deterministic, path-bound, domain-separated hashing is in release/artifact-tree.mjs.

/**
 * Compute SHA-256 hash of the pnpm lockfile for supply-chain provenance.
 */
function computeLockfileHash(): string | null {
  const lockfilePath = join(ROOT, 'pnpm-lock.yaml')
  if (!existsSync(lockfilePath)) return null
  const content = readFileSync(lockfilePath, 'utf-8')
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Sign the attestation with an Ed25519 private key.
 * Key must be PEM-encoded in the ATTESTATION_SIGNING_KEY env var.
 */
function signAttestation(digest: string): string | null {
  const key = process.env.ATTESTATION_SIGNING_KEY
  if (!key) return null

  // RSA-512 also yields a 64-byte signature. Enforce the signing algorithm,
  // not merely a PEM private key and an apparently valid signature length.
  let signingKey
  try { signingKey = createPrivateKey(key) }
  catch { throw new Error('Invalid release attestation signing key') }
  if (signingKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Release attestation signing key must be Ed25519')
  }
  return sign(null, Buffer.from(digest, 'hex'), signingKey).toString('hex')
}

/**
 * Verify an attestation signature against its digest.
 */
export function verifyAttestationSignature(
  digest: string,
  signatureHex: string,
  publicKeyPem: string,
): boolean {
  try {
    const key = createPublicKey(publicKeyPem)
    return key.asymmetricKeyType === 'ed25519' &&
      /^[0-9a-f]{64}$/i.test(digest) && /^[0-9a-f]{128}$/i.test(signatureHex) &&
      verify(null, Buffer.from(digest, 'hex'), key, Buffer.from(signatureHex, 'hex'))
  } catch {
    return false
  }
}

// ── Generator ─────────────────────────────────────────────────────────────

export interface GenerateAttestationOptions {
  commitSha: string
  contractTestResult?: 'pass' | 'fail' | 'skipped'
  sloGateResult?: 'pass' | 'fail' | 'skipped'
  environment?: string
}

export function generateReleaseAttestation(opts: GenerateAttestationOptions): ReleaseAttestation {
  const base: Omit<ReleaseAttestation, 'attestationDigest' | 'signature'> = {
    version: '2.0',
    commitSha: opts.commitSha,
    contractTestResult: opts.contractTestResult ?? 'skipped',
    sloGateResult: opts.sloGateResult ?? 'skipped',
    sbomDigest: computeSbomDigest(),
    manifestDigest: computeManifestDigest(),
    stagingRunId: process.env.GITHUB_RUN_ID ?? null,
    trivySummary: parseTrivyResults(),
    secretScanSummary: parseSecretScanResults(),
    artifactDigests: computeArtifactDigests(),
    lockfileHash: computeLockfileHash(),
    timestamp: new Date().toISOString(),
    environment: opts.environment ?? 'unknown',
  }

  const attestationDigest = computeAttestationDigest(base)
  const signature = signAttestation(attestationDigest)
  // A staging artifact that cannot be independently verified must never be
  // published as a promotable release candidate. Non-staging diagnostics may
  // still record an unsigned (non-authoritative) report.
  if (opts.environment === 'staging' && !signature) {
    throw new Error('Staging release attestation requires an Ed25519 signature')
  }

  return {
    ...base,
    attestationDigest,
    signature,
  }
}

// ── CLI Entry ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): GenerateAttestationOptions {
  let commitSha = ''
  let contractTestResult: 'pass' | 'fail' | 'skipped' = 'skipped'
  let sloGateResult: 'pass' | 'fail' | 'skipped' = 'skipped'
  let environment = 'unknown'

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--sha' && argv[i + 1]) {
      commitSha = argv[++i]
    } else if (arg === '--contract-pass') {
      contractTestResult = 'pass'
    } else if (arg === '--contract-fail') {
      contractTestResult = 'fail'
    } else if (arg === '--slo-pass') {
      sloGateResult = 'pass'
    } else if (arg === '--slo-fail') {
      sloGateResult = 'fail'
    } else if (arg === '--env' && argv[i + 1]) {
      environment = argv[++i]
    }
  }

  if (!commitSha) {
    console.error('Usage: release-attestation.ts --sha <commit-sha> [--contract-pass|--contract-fail] [--slo-pass|--slo-fail] [--env <env>]')
    process.exit(1)
  }

  return { commitSha, contractTestResult, sloGateResult, environment }
}

// Only run when executed directly (not imported)
const isDirectExecution = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/release-attestation.ts')
  || process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/release-attestation')

if (isDirectExecution) {
  const opts = parseArgs(process.argv.slice(2))
  const attestation = generateReleaseAttestation(opts)
  const outPath = join(ROOT, 'release-attestation.json')
  writeFileSync(outPath, JSON.stringify(attestation, null, 2) + '\n', 'utf-8')
  console.log(`✓ Release attestation written to ${outPath}`)
  console.log(`  Commit:    ${attestation.commitSha}`)
  console.log(`  Contract:  ${attestation.contractTestResult}`)
  console.log(`  SLO:       ${attestation.sloGateResult}`)
  console.log(`  SBOM:      ${attestation.sbomDigest ?? '(not found)'}`)
  console.log(`  Lockfile:  ${attestation.lockfileHash ?? '(not found)'}`)
  console.log(`  Artifacts: ${attestation.artifactDigests.length} bundle(s) hashed`)
  for (const a of attestation.artifactDigests) {
    console.log(`    ${a.name}: ${a.digest.slice(0, 16)}… (${a.fileCount} files)`)
  }
  console.log(`  Trivy:     ${attestation.trivySummary.ran ? `C:${attestation.trivySummary.critical} H:${attestation.trivySummary.high} M:${attestation.trivySummary.medium} L:${attestation.trivySummary.low}` : '(not run)'}`)
  console.log(`  Secrets:   ${attestation.secretScanSummary.ran ? (attestation.secretScanSummary.clean ? 'clean' : `${attestation.secretScanSummary.findings} finding(s)`) : '(not run)'}`)
  console.log(`  Signed:    ${attestation.signature ? 'yes' : 'no (ATTESTATION_SIGNING_KEY not set)'}`)
  console.log(`  Digest:    ${attestation.attestationDigest}`)
}
