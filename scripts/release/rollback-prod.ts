/**
 * rollback-prod.ts — Production rollback to a previous known-good release tag.
 *
 * Resolves the image SHA for the target tag, executes az containerapp update
 * for each approved production app, runs post-rollback smoke, and generates
 * a complete incident evidence record.
 *
 * Target: rollback completes in < 10 minutes for stateless apps.
 *
 * Usage:
 *   pnpm release:rollback --list                     # List rollback candidates
 *   pnpm release:rollback --tag v1.2.0               # Rollback all prod apps
 *   pnpm release:rollback --tag v1.2.0 --apps web,console
 *   pnpm release:rollback --tag v1.2.0 --dry-run
 *   pnpm release:rollback --tag v1.2.0 --execute     # Execute az commands
 *
 * Requires:
 *   - Azure CLI authenticated (az login or OIDC in CI)
 *   - AZURE_RESOURCE_GROUP env var (production resource group)
 *   - ACR_NAME env var (defaults to nzilacanadaacr)
 *
 * Evidence output:
 *   ops/rollbacks/rollback-prod-<timestamp>.json
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const RELEASES_DIR = path.join(ROOT, 'ops', 'releases')
const ROLLBACKS_DIR = path.join(ROOT, 'ops', 'rollbacks')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')

const ACR_NAME = process.env.ACR_NAME ?? 'nzilacanadaacr'
const RESOURCE_GROUP = process.env.AZURE_RESOURCE_GROUP ?? 'nzila-canada-staging-rg'

// Container app naming convention: nzila-os-<appName>
const CONTAINER_APP_PREFIX = 'nzila-os'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReleaseManifest {
  version: string
  tag: string
  gitSha: string
  date: string
  artifactId: string
  releaseType: 'standard' | 'hotfix'
  approvedApps: string[]
}

interface RollbackTarget {
  app: string
  containerAppName: string
  image: string
  tag: string
}

interface RollbackIncident {
  rollbackId: string
  executedAt: string
  targetTag: string
  targetSha: string
  previousTag: string
  apps: RollbackTarget[]
  executionMode: 'dry-run' | 'execute'
  smokeResult: 'pass' | 'fail' | 'skipped'
  initiatedBy: string
  resourceGroup: string
}

interface AppConfig {
  releaseStatus: string
  prodPromotionEligible?: boolean
}

interface Inventory {
  apps: Record<string, AppConfig>
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

function exec(cmd: string, opts?: { capture?: boolean; allowFail?: boolean }): string {
  try {
    if (opts?.capture) {
      return child_process.execSync(cmd, { encoding: 'utf8' }).trim()
    }
    child_process.execSync(cmd, { stdio: 'inherit' })
    return ''
  } catch (err) {
    if (opts?.allowFail) return ''
    throw err
  }
}

function loadReleaseManifest(tag: string): ReleaseManifest | null {
  // Sanitize tag to prevent path traversal
  const safeTag = path.basename(tag).replace(/[^a-zA-Z0-9._-]/g, '')
  const manifestFile = path.join(RELEASES_DIR, `release-${safeTag}.json`)
  const resolved = path.resolve(manifestFile)
  if (!resolved.startsWith(path.resolve(RELEASES_DIR))) return null
  if (!fs.existsSync(manifestFile)) return null
  try {
    return JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as ReleaseManifest
  } catch {
    return null
  }
}

function getShaForTag(tag: string): string | null {
  try {
    return exec(`git rev-list -n 1 ${tag}`, { capture: true, allowFail: true }) || null
  } catch {
    return null
  }
}

function listRollbackCandidates(): void {
  const tags = exec('git tag --list "v*" --sort=-version:refname', { capture: true })
    .split('\n')
    .filter(Boolean)
    .slice(0, 10)

  console.log('\n── Rollback Candidates (latest first) ──────────────────')
  if (tags.length === 0) {
    console.log('  No versioned tags found. Run pnpm release:tag first.')
    return
  }

  for (const tag of tags) {
    const sha = getShaForTag(tag)
    const manifest = loadReleaseManifest(tag)
    const date = manifest?.date ? new Date(manifest.date).toLocaleDateString() : 'unknown'
    const type = manifest?.releaseType ?? 'unknown'
    const sha8 = sha?.slice(0, 8) ?? 'unknown'
    console.log(`  ${tag.padEnd(16)} sha=${sha8}  date=${date}  type=${type}`)
  }
  console.log()
}

function getProdApps(requestedApps: string[]): string[] {
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as Inventory
  return requestedApps.filter((app) => {
    const cfg = inventory.apps[app]
    if (!cfg) return false
    return cfg.prodPromotionEligible === true || cfg.releaseStatus === 'prod-approved'
  })
}

// ── DB Rollback Safety ────────────────────────────────────────────────────────

function checkDBRollbackSafety(targetTag: string, currentTag: string): string[] {
  const warnings: string[] = []

  // Find migrations between target and current
  try {
    const migrationsInRange = exec(
      `git diff --name-only ${targetTag}..${currentTag} -- "*.sql"`,
      { capture: true, allowFail: true },
    )
    if (!migrationsInRange) return warnings

    const migrationFiles = migrationsInRange.split('\n').filter(
      (f) => f && (f.includes('migration') || f.startsWith('migrations/')),
    )

    if (migrationFiles.length === 0) return warnings

    warnings.push(
      `${migrationFiles.length} migration(s) were applied between ${targetTag} and ${currentTag}:`,
    )

    // Check for destructive operations in those migrations
    const destructivePatterns = [
      /\bDROP\s+TABLE\b/i,
      /\bDROP\s+COLUMN\b/i,
      /\bTRUNCATE\b/i,
      /\bALTER\s+TYPE\b/i,
      /\bRENAME\s+(TABLE|COLUMN)\b/i,
    ]

    for (const file of migrationFiles.slice(0, 10)) {
      try {
        const content = exec(`git show ${currentTag}:${file} 2>/dev/null`, { capture: true, allowFail: true })
        if (!content) continue

        for (const pattern of destructivePatterns) {
          if (pattern.test(content)) {
            warnings.push(`  IRREVERSIBLE: ${file} contains ${pattern.source}`)
            break
          }
        }
      } catch {
        // File may not exist at that tag
      }
    }

    // Check for rollback scripts
    const rollbackDir = path.join(ROOT, 'apps/union-eyes/db/migrations/rollback')
    if (!fs.existsSync(rollbackDir)) {
      warnings.push('  No rollback scripts found at apps/union-eyes/db/migrations/rollback/')
    } else {
      const rollbackFiles = fs.readdirSync(rollbackDir).filter((f) => f.endsWith('.sql'))
      if (rollbackFiles.length === 0) {
        warnings.push('  Rollback directory exists but contains no .sql files')
      } else {
        warnings.push(`  ${rollbackFiles.length} rollback script(s) available — review before applying`)
      }
    }
  } catch {
    // Git diff failed — can't determine migration range
  }

  return warnings
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  if (hasFlag('--list')) {
    listRollbackCandidates()
    return
  }

  const targetTag = parseArg('--tag')
  if (!targetTag) {
    console.error('Usage: pnpm release:rollback --tag v1.2.0')
    console.error('       pnpm release:rollback --list')
    process.exit(1)
  }

  const dryRun = hasFlag('--dry-run') || !hasFlag('--execute')
  const appsArg = parseArg('--apps')
  const requestedApps = appsArg
    ? appsArg.split(',').map((a) => a.trim()).filter(Boolean)
    : ['web', 'console', 'partners', 'union-eyes', 'cfo', 'flow', 'abr']

  // ── Validate target tag ──────────────────────────────────────────────────
  const targetSha = getShaForTag(targetTag)
  if (!targetSha) {
    console.error(`✗ Tag not found: ${targetTag}`)
    console.error('  Run: pnpm release:rollback --list')
    process.exit(1)
  }

  const manifest = loadReleaseManifest(targetTag)
  if (!manifest) {
    console.warn(`⚠  No release manifest found for ${targetTag} in ops/releases/.`)
    console.warn('   Proceeding with git tag SHA resolution only.')
  }

  // ── Resolve prod-approved apps ───────────────────────────────────────────
  const approvedApps = getProdApps(requestedApps)
  if (approvedApps.length === 0) {
    console.error(`✗ None of the requested apps are production-approved: ${requestedApps.join(', ')}`)
    process.exit(1)
  }

  // ── Determine current tag for "previous" record ──────────────────────────
  const currentTag = exec('git describe --tags --abbrev=0 HEAD 2>/dev/null || echo unknown', { capture: true, allowFail: true })

  // ── Build rollback targets ───────────────────────────────────────────────
  const targets: RollbackTarget[] = approvedApps.map((app) => ({
    app,
    containerAppName: `${CONTAINER_APP_PREFIX}-${app}`,
    image: `${ACR_NAME}.azurecr.io/${CONTAINER_APP_PREFIX}-${app}:${targetSha}`,
    tag: targetTag,
  }))

  // ── DB awareness check ─────────────────────────────────────────────────
  const dbWarnings = checkDBRollbackSafety(targetTag, currentTag)
  if (dbWarnings.length > 0) {
    console.log('\n  ⚠ DATABASE ROLLBACK WARNINGS:')
    for (const w of dbWarnings) {
      console.log(`    • ${w}`)
    }
    console.log('    Manual DB rollback may be required — check apps/union-eyes/db/migrations/rollback/')
    console.log()
  }

  // ── Print rollback plan ──────────────────────────────────────────────────
  console.log('\n── Production Rollback Plan ────────────────────────────')
  console.log(`  Target tag:    ${targetTag}`)
  console.log(`  Target SHA:    ${targetSha}`)
  console.log(`  Previous tag:  ${currentTag}`)
  console.log(`  Resource group: ${RESOURCE_GROUP}`)
  console.log(`  Mode:          ${dryRun ? 'DRY RUN (add --execute to apply)' : 'EXECUTE'}`)
  console.log()
  console.log('  Apps:')
  for (const t of targets) {
    console.log(`    ${t.containerAppName.padEnd(28)} → ${t.image}`)
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Azure CLI commands that would run:')
    for (const t of targets) {
      console.log(`  az containerapp update \\`)
      console.log(`    --name ${t.containerAppName} \\`)
      console.log(`    --resource-group ${RESOURCE_GROUP} \\`)
      console.log(`    --image ${t.image}`)
      console.log()
    }
    console.log('Re-run with --execute to apply.')
    writeEvidence(targets, targetTag, targetSha, currentTag, 'dry-run', 'skipped')
    return
  }

  // ── Execute rollback ─────────────────────────────────────────────────────
  console.log('\nExecuting rollback...')
  let allSucceeded = true
  for (const t of targets) {
    console.log(`\n  Updating ${t.containerAppName}...`)
    try {
      exec(
        `az containerapp update --name ${t.containerAppName} --resource-group ${RESOURCE_GROUP} --image ${t.image}`,
      )
      console.log(`  ✓ ${t.containerAppName}`)
    } catch {
      console.error(`  ✗ Failed to rollback ${t.containerAppName}`)
      allSucceeded = false
    }
  }

  // ── Post-rollback smoke ──────────────────────────────────────────────────
  let smokeResult: 'pass' | 'fail' | 'skipped' = 'skipped'
  console.log('\nRunning post-rollback smoke tests...')
  try {
    exec(`pnpm tsx scripts/release/run-smoke.ts --env production --apps ${approvedApps.join(',')}`)
    smokeResult = 'pass'
    console.log('✓ Post-rollback smoke passed')
  } catch {
    smokeResult = 'fail'
    console.error('✗ Post-rollback smoke FAILED — investigate immediately')
  }

  writeEvidence(targets, targetTag, targetSha, currentTag, 'execute', smokeResult)

  if (!allSucceeded || smokeResult === 'fail') {
    console.error('\n✗ Rollback completed with errors. Review ops/rollbacks/ for evidence.')
    process.exit(1)
  }

  console.log(`\n✓ Production rollback to ${targetTag} complete.`)
}

function writeEvidence(
  targets: RollbackTarget[],
  targetTag: string,
  targetSha: string,
  previousTag: string,
  executionMode: 'dry-run' | 'execute',
  smokeResult: 'pass' | 'fail' | 'skipped',
): void {
  const rollbackId = `rollback-${Date.now()}`
  const record: RollbackIncident = {
    rollbackId,
    executedAt: new Date().toISOString(),
    targetTag,
    targetSha,
    previousTag,
    apps: targets,
    executionMode,
    smokeResult,
    initiatedBy: process.env.GITHUB_ACTOR ?? process.env.USER ?? process.env.USERNAME ?? 'local',
    resourceGroup: RESOURCE_GROUP,
  }

  fs.mkdirSync(ROLLBACKS_DIR, { recursive: true })
  const rollbackFile = path.join(ROLLBACKS_DIR, `${rollbackId}.json`)
  fs.writeFileSync(rollbackFile, JSON.stringify(record, null, 2), 'utf8')
  console.log(`\n✓ Rollback evidence: ops/rollbacks/${rollbackId}.json`)
}

main()
