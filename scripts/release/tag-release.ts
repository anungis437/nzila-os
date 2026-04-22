/**
 * tag-release.ts — Automated semantic versioning and immutable git tagging.
 *
 * Reads the current monorepo version from package.json, applies a semver bump
 * (or accepts an explicit version), creates an annotated git tag, and writes a
 * release manifest to ops/releases/.
 *
 * Every production release MUST go through this script. No manual ad-hoc tags.
 *
 * Usage:
 *   pnpm release:tag --bump patch        # 1.2.3 → 1.2.4
 *   pnpm release:tag --bump minor        # 1.2.3 → 1.3.0
 *   pnpm release:tag --bump major        # 1.2.3 → 2.0.0
 *   pnpm release:tag --version 1.4.0     # explicit version
 *   pnpm release:tag --bump patch --dry-run
 *
 * The annotated tag body contains:
 *   - version, sha, date, artifact-id
 *   - link to GitHub release / changelog section
 *   - release type (standard | hotfix)
 *
 * Output:
 *   ops/releases/release-v<X.Y.Z>.json   (release manifest)
 *   git tag vX.Y.Z (annotated, pushed unless --dry-run)
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json')
const RELEASES_DIR = path.join(ROOT, 'ops', 'releases')

// ── Types ─────────────────────────────────────────────────────────────────────

type BumpType = 'major' | 'minor' | 'patch'

interface ReleaseManifest {
  version: string
  tag: string
  previousVersion: string
  bumpType: BumpType | 'explicit'
  gitSha: string
  gitBranch: string
  date: string
  artifactId: string
  releaseType: 'standard' | 'hotfix'
  signed: boolean
  signMethod: 'gpg' | 'ssh' | 'none'
  changelogUrl: string
  approvedApps: string[]
  createdBy: string
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

function exec(cmd: string, opts?: { capture?: boolean }): string {
  if (opts?.capture) {
    try {
      return child_process.execSync(cmd, { encoding: 'utf8' }).trim()
    } catch {
      return ''
    }
  }
  child_process.execSync(cmd, { stdio: 'inherit' })
  return ''
}

function bumpVersion(current: string, bump: BumpType): string {
  const parts = current.replace(/^v/, '').split('.')
  if (parts.length !== 3) throw new Error(`Unexpected version format: ${current}`)
  const [major, minor, patch] = parts.map(Number)
  switch (bump) {
    case 'major': return `${major + 1}.0.0`
    case 'minor': return `${major}.${minor + 1}.0`
    case 'patch': return `${major}.${minor}.${patch + 1}`
  }
}

function validateSemver(v: string): void {
  if (!/^\d+\.\d+\.\d+$/.test(v)) {
    throw new Error(`Invalid semver: "${v}". Expected X.Y.Z format.`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const dryRun = hasFlag('--dry-run')
  const hotfix = hasFlag('--hotfix')
  const allowNonMain = hasFlag('--allow-non-main')
  const bumpArg = parseArg('--bump') as BumpType | undefined
  const versionArg = parseArg('--version')

  if (!bumpArg && !versionArg) {
    console.error('Usage: pnpm release:tag --bump patch|minor|major')
    console.error('       pnpm release:tag --version X.Y.Z')
    process.exit(1)
  }
  if (bumpArg && !['major', 'minor', 'patch'].includes(bumpArg)) {
    console.error(`Invalid --bump value: "${bumpArg}". Use major|minor|patch`)
    process.exit(1)
  }

  // Read current version
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { version: string }
  const previousVersion = pkg.version
  const newVersion = versionArg ?? bumpVersion(previousVersion, bumpArg!)
  validateSemver(newVersion)

  const tag = `v${newVersion}`
  const gitSha = exec('git rev-parse HEAD', { capture: true })
  const gitBranch = exec('git rev-parse --abbrev-ref HEAD', { capture: true })
  const originMainSha = exec('git rev-parse origin/main', { capture: true })
  const date = new Date().toISOString()
  const artifactId = `nzila-os-${newVersion}-${gitSha.slice(0, 8)}`

  // Production release tags should only be created from main and from the current
  // origin/main commit unless explicitly overridden.
  if (!allowNonMain && gitBranch !== 'main') {
    console.error(`✗ Release tagging must run from main. Current branch: ${gitBranch}`)
    console.error('  Use --allow-non-main only for exceptional recovery workflows.')
    process.exit(1)
  }

  if (!allowNonMain && originMainSha && gitSha !== originMainSha) {
    console.error('✗ HEAD does not match origin/main. Pull/rebase main before tagging.')
    console.error(`  HEAD:        ${gitSha}`)
    console.error(`  origin/main: ${originMainSha}`)
    process.exit(1)
  }

  // Reject if tag already exists
  const existingTags = exec('git tag --list', { capture: true }).split('\n').map((t) => t.trim())
  if (existingTags.includes(tag)) {
    console.error(`✗ Tag ${tag} already exists. Did you mean to bump further?`)
    process.exit(1)
  }

  // Reject on dirty working tree (uncommitted changes)
  const status = exec('git status --porcelain', { capture: true })
  if (status.length > 0) {
    console.error('✗ Working tree is dirty. Commit all changes before tagging.')
    console.error(status)
    process.exit(1)
  }

  const changelogUrl = `https://github.com/anungis437/nzila-os/blob/main/CHANGELOG.md#${newVersion.replace(/\./g, '')}`
  const releaseType = hotfix ? 'hotfix' : 'standard'

  // Detect signing capability
  const signingKeyCheck = exec('git config --get user.signingkey', { capture: true })
  const signFormatCheck = exec('git config --get gpg.format', { capture: true })
  const isSigned = signingKeyCheck.length > 0
  const signMethod: 'gpg' | 'ssh' | 'none' = !isSigned ? 'none' : signFormatCheck === 'ssh' ? 'ssh' : 'gpg'

  const manifest: ReleaseManifest = {
    version: newVersion,
    tag,
    previousVersion,
    bumpType: versionArg ? 'explicit' : bumpArg!,
    gitSha,
    gitBranch,
    date,
    artifactId,
    releaseType,
    signed: isSigned,
    signMethod,
    changelogUrl,
    approvedApps: ['web', 'console', 'partners', 'union-eyes', 'cfo', 'flow', 'abr'],
    createdBy: process.env.GITHUB_ACTOR ?? process.env.USER ?? process.env.USERNAME ?? 'local',
  }

  // Build annotated tag message
  const tagBody = [
    `Nzila OS ${tag} — ${releaseType}`,
    ``,
    `Version:      ${newVersion}`,
    `Previous:     ${previousVersion}`,
    `Bump type:    ${manifest.bumpType}`,
    `SHA:          ${gitSha}`,
    `Branch:       ${gitBranch}`,
    `Date:         ${date}`,
    `Artifact ID:  ${artifactId}`,
    `Release type: ${releaseType}`,
    `Changelog:    ${changelogUrl}`,
  ].join('\n')

  console.log('\n── Release Tag ─────────────────────────────────────────')
  console.log(`  ${previousVersion}  →  ${newVersion}`)
  console.log(`  Tag:         ${tag}`)
  console.log(`  SHA:         ${gitSha}`)
  console.log(`  Artifact ID: ${artifactId}`)
  console.log(`  Type:        ${releaseType}`)
  if (dryRun) console.log('\n[DRY RUN] No changes will be made.')

  if (!dryRun) {
    // Update version in package.json
    const pkgRaw = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')
    const updated = pkgRaw.replace(
      /"version":\s*"[^"]+"/,
      `"version": "${newVersion}"`,
    )
    fs.writeFileSync(PACKAGE_JSON_PATH, updated, 'utf8')
    console.log(`\n✓ Updated package.json → ${newVersion}`)

    // Stage package.json and commit
    exec(`git add package.json`)
    exec(`git commit -m "chore(release): bump version to ${newVersion}"`)
    console.log(`✓ Committed version bump`)

    // Create signed annotated tag (GPG or SSH based on git config)
    // HARD REQUIREMENT: Production releases MUST be signed. No unsigned fallback.
    const signingKey = exec('git config --get user.signingkey', { capture: true }).trim()
    const signFormat = exec('git config --get gpg.format', { capture: true }).trim()
    const canSign = signingKey.length > 0

    if (canSign) {
      exec(`git tag -s "${tag}" -m "${tagBody.replace(/"/g, '\\"')}"`)
      const signMethod = signFormat === 'ssh' ? 'SSH' : 'GPG'
      console.log(`✓ Created signed tag (${signMethod}): ${tag}`)
    } else if (hasFlag('--allow-unsigned')) {
      console.log('⚠  No signing key — creating unsigned tag (--allow-unsigned override)')
      console.log('   WARNING: This tag will be BLOCKED from production promotion.')
      exec(`git tag -a "${tag}" -m "${tagBody.replace(/"/g, '\\"')}"`)
      console.log(`✓ Created annotated tag (unsigned): ${tag}`)
    } else {
      console.error('✗ BLOCKED: No signing key configured.')
      console.error('  Production releases MUST be signed. Configure a key:')
      console.error('    GPG: git config --global user.signingkey <KEY-ID>')
      console.error('    SSH: git config --global gpg.format ssh')
      console.error('         git config --global user.signingkey ~/.ssh/id_ed25519.pub')
      console.error('  To create a development tag anyway: --allow-unsigned')
      process.exit(1)
    }

    // Push commit + tag
    exec(`git push origin HEAD`)
    exec(`git push origin "${tag}"`)
    console.log(`✓ Pushed tag to origin`)

    // Write release manifest
    fs.mkdirSync(RELEASES_DIR, { recursive: true })
    const manifestPath = path.join(RELEASES_DIR, `release-${tag}.json`)
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
    console.log(`✓ Wrote release manifest: ops/releases/release-${tag}.json`)
  }

  console.log(`\n✓ Release ${tag} ready.`)
  console.log(`  Next: deploy-production.yml will trigger on tag push.`)
  console.log(`  Or:   gh workflow run deploy-production.yml`)
}

main()
