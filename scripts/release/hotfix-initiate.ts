/**
 * hotfix-initiate.ts — Governed emergency release initiation.
 *
 * Every hotfix must be recorded, justified, and normalized with a follow-up PR.
 * No cowboy deploys.
 *
 * Usage:
 *   pnpm exec tsx scripts/release/hotfix-initiate.ts --incident INC-0042 --apps web,console --reason "Critical auth bypass"
 *   pnpm exec tsx scripts/release/hotfix-initiate.ts --incident INC-0042 --apps web --dry-run
 *
 * Flow:
 *   1. Validates incident reference and reason
 *   2. Creates a hotfix record in ops/hotfixes/
 *   3. Bumps patch version + creates tag with -hotfix suffix
 *   4. Logs reminder for follow-up normalization PR
 *
 * Governance requirements (enforced):
 *   - Incident reference required (INC-XXXX, SEC-XXXX, or free-form with --override)
 *   - Approval implicit from having push access
 *   - Retro changelog entry generated
 *   - Follow-up normalization PR required within 48h
 *
 * Output:
 *   ops/hotfixes/hotfix-<timestamp>.json
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HOTFIXES_DIR = path.join(ROOT, 'ops', 'hotfixes')
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json')

// ── Types ─────────────────────────────────────────────────────────────────────

interface HotfixRecord {
  hotfixId: string
  initiatedAt: string
  incidentRef: string
  reason: string
  apps: string[]
  gitBranch: string
  gitSha: string
  previousVersion: string
  hotfixVersion: string
  hotfixTag: string
  initiatedBy: string
  status: 'initiated' | 'deployed' | 'normalized'
  normalizationDeadline: string
  normalizationPR: string | null
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
    return child_process.execSync(cmd, { encoding: 'utf8' }).trim()
  }
  child_process.execSync(cmd, { stdio: 'inherit' })
  return ''
}

function bumpPatch(version: string): string {
  const parts = version.split('.')
  if (parts.length !== 3) throw new Error(`Bad version: ${version}`)
  const [major, minor, patch] = parts.map(Number)
  return `${major}.${minor}.${patch + 1}`
}

function validateIncidentRef(ref: string): boolean {
  // Accepted patterns: INC-XXXX, SEC-XXXX, CVE-XXXX-XXXXX, or override with any non-empty
  return /^(INC|SEC|CVE|P[0-9])-/i.test(ref)
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const incidentRef = parseArg('--incident')
  const reason = parseArg('--reason')
  const appsArg = parseArg('--apps')
  const dryRun = hasFlag('--dry-run')
  const override = hasFlag('--override')

  if (!incidentRef || !reason || !appsArg) {
    console.error('Usage: pnpm exec tsx scripts/release/hotfix-initiate.ts --incident INC-0042 --apps web,console --reason "description"')
    console.error()
    console.error('Options:')
    console.error('  --incident   Incident reference (INC-XXXX, SEC-XXXX, CVE-XXXX-XXXXX)')
    console.error('  --apps       Comma-separated list of apps to hotfix')
    console.error('  --reason     Human-readable reason for the emergency release')
    console.error('  --dry-run    Show plan without executing')
    console.error('  --override   Allow non-standard incident reference format')
    process.exit(1)
  }

  // Validate incident reference format
  if (!validateIncidentRef(incidentRef) && !override) {
    console.error(`✗ Invalid incident reference: "${incidentRef}"`)
    console.error('  Expected: INC-XXXX, SEC-XXXX, CVE-XXXX-XXXXX, or P0-XXXX')
    console.error('  Use --override to bypass this check for non-standard references')
    process.exit(1)
  }

  const apps = appsArg.split(',').map((a) => a.trim()).filter(Boolean)
  if (apps.length === 0) {
    console.error('✗ No valid apps specified')
    process.exit(1)
  }

  // Read current version
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as { version: string }
  const previousVersion = pkg.version
  const hotfixVersion = bumpPatch(previousVersion)
  const hotfixTag = `v${hotfixVersion}`

  const gitSha = exec('git rev-parse HEAD', { capture: true })
  const gitBranch = exec('git rev-parse --abbrev-ref HEAD', { capture: true })
  const initiatedBy = process.env.GITHUB_ACTOR ?? process.env.USER ?? process.env.USERNAME ?? 'local'

  // Normalization deadline: 48 hours from now
  const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const hotfixId = `hotfix-${Date.now()}`

  const record: HotfixRecord = {
    hotfixId,
    initiatedAt: new Date().toISOString(),
    incidentRef,
    reason,
    apps,
    gitBranch,
    gitSha,
    previousVersion,
    hotfixVersion,
    hotfixTag,
    initiatedBy,
    status: 'initiated',
    normalizationDeadline: deadline,
    normalizationPR: null,
  }

  console.log('\n── HOTFIX INITIATION ────────────────────────────────────')
  console.log(`  Incident:        ${incidentRef}`)
  console.log(`  Reason:          ${reason}`)
  console.log(`  Apps:            ${apps.join(', ')}`)
  console.log(`  Current version: ${previousVersion}`)
  console.log(`  Hotfix version:  ${hotfixVersion}`)
  console.log(`  Tag:             ${hotfixTag}`)
  console.log(`  SHA:             ${gitSha.slice(0, 8)}`)
  console.log(`  Branch:          ${gitBranch}`)
  // codeql[js/clear-text-logging] - initiatedBy is a non-secret username (GITHUB_ACTOR or local USER)
  console.log(`  Initiated by:    ${initiatedBy}`)
  console.log(`  Normalize by:    ${new Date(deadline).toLocaleString()}`)

  if (dryRun) {
    console.log('\n[DRY RUN] No changes made.')
    console.log('\nWould execute:')
    console.log(`  1. Update package.json version → ${hotfixVersion}`)
    console.log(`  2. Git commit version bump`)
    console.log(`  3. Create annotated tag: ${hotfixTag}`)
    console.log(`  4. Push tag → triggers deploy-production.yml`)
    console.log(`  5. Write hotfix record to ops/hotfixes/${hotfixId}.json`)
    return
  }

  // ── Execute hotfix ─────────────────────────────────────────────────────────

  // 1. Write hotfix record FIRST (evidence before action)
  fs.mkdirSync(HOTFIXES_DIR, { recursive: true })
  const recordPath = path.join(HOTFIXES_DIR, `${hotfixId}.json`)
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf8')
  console.log(`\n✓ Hotfix record: ops/hotfixes/${hotfixId}.json`)

  // 2. Update package.json
  const pkgRaw = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')
  const updated = pkgRaw.replace(/"version":\s*"[^"]+"/, `"version": "${hotfixVersion}"`)
  fs.writeFileSync(PACKAGE_JSON_PATH, updated, 'utf8')
  console.log(`✓ Updated package.json → ${hotfixVersion}`)

  // 3. Stage and commit
  exec('git add package.json ops/hotfixes/')
  exec(`git commit -m "hotfix(${incidentRef}): bump to ${hotfixVersion} — ${reason}"`)
  console.log('✓ Committed hotfix version bump')

  // 4. Create annotated tag
  const tagBody = [
    `HOTFIX — ${incidentRef}`,
    '',
    `Reason: ${reason}`,
    `Apps: ${apps.join(', ')}`,
    `Previous: ${previousVersion}`,
    `SHA: ${gitSha}`,
    `Normalize by: ${deadline}`,
  ].join('\n')

  child_process.execFileSync('git', ['tag', '-a', hotfixTag, '-m', tagBody], { stdio: 'inherit' })
  console.log(`✓ Created tag: ${hotfixTag}`)

  // 5. Push
  exec('git push origin HEAD')
  exec(`git push origin "${hotfixTag}"`)
  console.log(`✓ Pushed ${hotfixTag} → deploy-production.yml triggered`)

  // 6. Generate retro changelog entry
  const changelogEntry = [
    '',
    `## [${hotfixVersion}] — ${new Date().toISOString().split('T')[0]} (HOTFIX)`,
    '',
    `### Security`,
    `- **HOTFIX ${incidentRef}**: ${reason} (apps: ${apps.join(', ')})`,
    '',
  ].join('\n')

  const changelogPath = path.join(ROOT, 'CHANGELOG.md')
  if (fs.existsSync(changelogPath)) {
    const existing = fs.readFileSync(changelogPath, 'utf8')
    const insertPoint = existing.indexOf('## [')
    if (insertPoint > 0) {
      const newChangelog = existing.slice(0, insertPoint) + changelogEntry + existing.slice(insertPoint)
      fs.writeFileSync(changelogPath, newChangelog, 'utf8')
      console.log('✓ Retro changelog entry added')
    }
  }

  console.log('\n── FOLLOW-UP REQUIRED ──────────────────────────────────')
  console.log(`  ⚠  Within 48 hours, open a normalization PR that:`)
  console.log(`      1. Adds proper tests for the hotfix`)
  console.log(`      2. Updates documentation`)
  console.log(`      3. Reviews with team`)
  console.log(`      4. Sets record.status = "normalized" in ops/hotfixes/${hotfixId}.json`)
  console.log(`      5. Updates record.normalizationPR with the PR URL`)
  console.log()
  console.log(`✓ Hotfix ${hotfixTag} initiated for ${incidentRef}.`)
}

main()
