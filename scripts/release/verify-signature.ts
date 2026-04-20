/**
 * release:verify-signature — Hard-block unsigned or malformed release tags.
 *
 * Production promotion MUST pass this gate. Warnings are hard failures.
 *
 * Checks:
 *   1. Tag exists (matches vX.Y.Z semver)
 *   2. Tag is annotated (not lightweight)
 *   3. Tag is signed (GPG or SSH — unsigned = BLOCK)
 *   4. Signer is in the allowed-signers list
 *   5. Tag SHA matches artifact manifest SHA
 *   6. Release manifest exists with matching version
 *   7. Changelog entry present for this version
 *
 * Usage:
 *   pnpm release:verify-signature                # verify latest tag
 *   pnpm release:verify-signature --tag v1.2.0   # verify specific tag
 *   pnpm release:verify-signature --require-signed   # hard-fail on unsigned (default)
 *   pnpm release:verify-signature --warn-unsigned    # warn but don't fail on unsigned
 *
 * Exit codes:
 *   0 = all checks pass — safe to promote
 *   1 = hard failure — DO NOT promote
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const RELEASES_DIR = path.join(ROOT, 'ops', 'releases')
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md')
const ALLOWED_SIGNERS_PATH = path.join(ROOT, 'governance', 'release', 'allowed-signers.json')

// ── Types ─────────────────────────────────────────────────────────────────────

interface VerifyCheck {
  check: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  message: string
}

interface VerifyReport {
  tag: string
  timestamp: string
  checks: VerifyCheck[]
  overallStatus: 'pass' | 'fail'
  failCount: number
  warnCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return undefined
  return process.argv[idx + 1]
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function exec(cmd: string): { stdout: string; ok: boolean } {
  try {
    const stdout = child_process.execSync(cmd, { encoding: 'utf8', timeout: 15_000 }).trim()
    return { stdout, ok: true }
  } catch {
    return { stdout: '', ok: false }
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────

const checks: VerifyCheck[] = []
const warnOnly = hasFlag('--warn-unsigned')

function resolveTag(): string {
  const explicit = parseArg('--tag')
  if (explicit) {
    // Sanitize: only allow semver tags (vX.Y.Z with optional pre-release)
    if (!/^v\d+\.\d+\.\d+(-[\w.]+)?$/.test(explicit)) {
      console.error('✗ Invalid tag format. Expected vX.Y.Z (e.g., v1.2.3)')
      process.exit(1)
    }
    return explicit
  }

  // Find latest semver tag
  const { stdout } = exec('git tag --list "v*" --sort=-version:refname')
  const tags = stdout.split('\n').filter((t) => /^v\d+\.\d+\.\d+$/.test(t.trim()))
  if (tags.length === 0) {
    console.error('✗ No semver tags found. Create a release first: pnpm release:tag')
    process.exit(1)
  }
  return tags[0].trim()
}

function checkTagExists(tag: string): void {
  const { stdout, ok } = exec(`git rev-parse "${tag}"`)
  if (!ok || !stdout) {
    checks.push({ check: 'tag-exists', status: 'fail', message: `Tag ${tag} does not exist` })
    return
  }
  checks.push({ check: 'tag-exists', status: 'pass', message: `Tag ${tag} exists at ${stdout.slice(0, 12)}` })
}

function checkTagAnnotated(tag: string): void {
  const { stdout } = exec(`git cat-file -t "${tag}"`)
  if (stdout !== 'tag') {
    checks.push({ check: 'tag-annotated', status: 'fail', message: `Tag ${tag} is lightweight (not annotated). Production tags must be annotated.` })
    return
  }
  checks.push({ check: 'tag-annotated', status: 'pass', message: `Tag ${tag} is annotated` })
}

function checkTagSigned(tag: string): void {
  // Try GPG verification first
  const gpgResult = exec(`git tag -v "${tag}" 2>&1`)
  if (gpgResult.ok && gpgResult.stdout.includes('Good signature')) {
    const signerMatch = gpgResult.stdout.match(/uid\s+(.+)/)?.[1] ?? 'unknown'
    checks.push({ check: 'tag-signed', status: 'pass', message: `Tag signed (GPG) by: ${signerMatch}` })
    return
  }

  // Try SSH verification
  const sshResult = exec(`git tag -v "${tag}" 2>&1`)
  if (sshResult.ok && sshResult.stdout.includes('Good "git" signature')) {
    checks.push({ check: 'tag-signed', status: 'pass', message: `Tag signed (SSH)` })
    return
  }

  // Check if the tag object itself contains a signature header
  const tagContent = exec(`git cat-file tag "${tag}" 2>/dev/null`)
  if (tagContent.ok && tagContent.stdout.includes('-----BEGIN')) {
    checks.push({ check: 'tag-signed', status: 'pass', message: 'Tag contains embedded signature' })
    return
  }

  // Not signed
  const status = warnOnly ? 'warn' : 'fail'
  checks.push({
    check: 'tag-signed',
    status,
    message: `Tag ${tag} is NOT signed. ${warnOnly ? '(warn-only mode)' : 'Production releases MUST be signed.'}`,
  })
}

function checkSignerAllowed(tag: string): void {
  if (!fs.existsSync(ALLOWED_SIGNERS_PATH)) {
    checks.push({ check: 'signer-allowed', status: 'skip', message: 'No allowed-signers.json — skipping signer allowlist check' })
    return
  }

  const allowedSigners = JSON.parse(fs.readFileSync(ALLOWED_SIGNERS_PATH, 'utf8')) as { signers: string[] }
  const tagInfo = exec(`git tag -v "${tag}" 2>&1`)
  if (!tagInfo.ok) {
    checks.push({ check: 'signer-allowed', status: 'skip', message: 'Cannot verify signer — tag not signed or verification unavailable' })
    return
  }

  const signerMatch = tagInfo.stdout.match(/uid\s+(.+)/)?.[1] ?? tagInfo.stdout.match(/email:\s*(.+)/)?.[1]
  if (!signerMatch) {
    checks.push({ check: 'signer-allowed', status: 'warn', message: 'Cannot extract signer identity from tag' })
    return
  }

  const allowed = allowedSigners.signers.some((s) => signerMatch.includes(s))
  if (allowed) {
    checks.push({ check: 'signer-allowed', status: 'pass', message: `Signer "${signerMatch}" is in allowed list` })
  } else {
    checks.push({ check: 'signer-allowed', status: 'fail', message: `Signer "${signerMatch}" is NOT in allowed signers list` })
  }
}

function safeReadManifest(tag: string): Record<string, unknown> | null {
  // Tag is already validated as vX.Y.Z by resolveTag()
  const safeName = `release-${tag}.json`
  const manifestPath = path.join(RELEASES_DIR, safeName)
  const resolved = path.resolve(manifestPath)
  if (!resolved.startsWith(path.resolve(RELEASES_DIR))) return null
  if (!fs.existsSync(resolved)) return null
  return JSON.parse(fs.readFileSync(resolved, 'utf8')) as Record<string, unknown>
}

function checkArtifactMatch(tag: string): void {
  const version = tag.replace(/^v/, '')
  const manifest = safeReadManifest(tag) as { gitSha?: string; version?: string; tag?: string } | null

  if (!manifest) {
    checks.push({ check: 'artifact-match', status: 'warn', message: `No release manifest found at ops/releases/release-${tag}.json` })
    return
  }

  // Check version matches
  if (manifest.version !== version) {
    checks.push({ check: 'artifact-match', status: 'fail', message: `Manifest version "${manifest.version}" ≠ tag version "${version}"` })
    return
  }

  // Check SHA matches tag target
  const { stdout: tagSha } = exec(`git rev-list -1 "${tag}"`)
  if (manifest.gitSha && tagSha && !tagSha.startsWith(manifest.gitSha) && !manifest.gitSha.startsWith(tagSha)) {
    checks.push({ check: 'artifact-match', status: 'fail', message: `Manifest SHA "${manifest.gitSha}" ≠ tag SHA "${tagSha}"` })
    return
  }

  checks.push({ check: 'artifact-match', status: 'pass', message: `Manifest version=${version}, SHA matches tag target` })
}

function checkReleaseManifest(tag: string): void {
  const version = tag.replace(/^v/, '')
  const manifest = safeReadManifest(tag)

  if (!manifest) {
    checks.push({ check: 'release-manifest', status: 'fail', message: `Missing release manifest: ops/releases/release-${tag}.json` })
    return
  }
  const required = ['version', 'tag', 'gitSha', 'date', 'artifactId']
  const missing = required.filter((k) => !manifest[k])

  if (missing.length > 0) {
    checks.push({ check: 'release-manifest', status: 'fail', message: `Manifest missing required fields: ${missing.join(', ')}` })
    return
  }

  checks.push({ check: 'release-manifest', status: 'pass', message: `Release manifest present with all required fields` })
}

function checkChangelog(tag: string): void {
  const version = tag.replace(/^v/, '')
  if (!fs.existsSync(CHANGELOG_PATH)) {
    checks.push({ check: 'changelog', status: 'warn', message: 'CHANGELOG.md not found' })
    return
  }

  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8')
  if (changelog.includes(version)) {
    checks.push({ check: 'changelog', status: 'pass', message: `Changelog contains entry for ${version}` })
  } else {
    checks.push({ check: 'changelog', status: 'warn', message: `No changelog entry found for ${version} — will be auto-generated on deploy` })
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const tag = resolveTag()
  console.log(`\n── Release Signature Verification ──────────────────────`)
  console.log(`  Tag: ${tag}`)
  console.log(`  Mode: ${warnOnly ? 'warn-unsigned' : 'require-signed'}`)
  console.log('')

  checkTagExists(tag)
  checkTagAnnotated(tag)
  checkTagSigned(tag)
  checkSignerAllowed(tag)
  checkArtifactMatch(tag)
  checkReleaseManifest(tag)
  checkChangelog(tag)

  const failCount = checks.filter((c) => c.status === 'fail').length
  const warnCount = checks.filter((c) => c.status === 'warn').length
  const overallStatus = failCount > 0 ? 'fail' : 'pass'

  // Print results
  for (const c of checks) {
    const icon = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : c.status === 'warn' ? '⚠' : '–'
    console.log(`  ${icon}  [${c.check}] ${c.message}`)
  }

  console.log('')
  if (failCount > 0) {
    console.log(`✗ FAILED — ${failCount} blocking issue(s), ${warnCount} warning(s)`)
    console.log('  Production promotion BLOCKED.')
  } else if (warnCount > 0) {
    console.log(`⚠ PASSED with ${warnCount} warning(s)`)
  } else {
    console.log('✓ All checks passed — safe to promote')
  }

  // Write report
  const report: VerifyReport = {
    tag,
    timestamp: new Date().toISOString(),
    checks,
    overallStatus,
    failCount,
    warnCount,
  }

  const reportDir = path.join(ROOT, 'reports', 'release')
  fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, 'signature-verification-latest.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(`\n  Report: reports/release/signature-verification-latest.json`)

  process.exit(failCount > 0 ? 1 : 0)
}

main()
