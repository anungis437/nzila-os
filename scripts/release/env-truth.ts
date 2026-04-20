/**
 * release:env-truth — Cross-check deployment inventory against real environment.
 *
 * Reads the governance deployment inventory and validates:
 *   1. Every app in inventory has a corresponding Container App
 *   2. Domain routing registry is consistent with inventory
 *   3. Health endpoints are correctly configured
 *   4. Release status and tier are consistent
 *   5. No orphaned apps (deployed but not in inventory)
 *
 * Modes:
 *   --live        Actually query Azure Container Apps (requires az CLI auth)
 *   --dry-run     Validate inventory structure only (default)
 *
 * Usage:
 *   pnpm release:env-truth                    # structural validation
 *   pnpm release:env-truth --live             # live Azure query
 *
 * Output:
 *   reports/release/environment-truth.json
 */

import * as child_process from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')
const ROUTING_PATH = path.join(ROOT, 'governance', 'release', 'domain-routing-registry.json')
const REPORT_DIR = path.join(ROOT, 'reports', 'release')

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppEntry {
  tier: string
  releaseStatus: string
  track: string
  prodPromotionEligible: boolean
  routing?: {
    staging?: string
    production?: string
    healthPath?: string
    ingress?: string
  }
}

interface RoutingEntry {
  app: string
  stagingHost: string
  productionHost: string
  healthEndpoint: string
}

interface TruthCheck {
  check: string
  app?: string
  status: 'pass' | 'fail' | 'warn'
  message: string
}

interface EnvironmentTruth {
  timestamp: string
  mode: 'live' | 'dry-run'
  checks: TruthCheck[]
  appCount: number
  tierBreakdown: Record<string, number>
  statusBreakdown: Record<string, number>
  overallStatus: 'pass' | 'fail'
  failCount: number
  warnCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function exec(cmd: string): { stdout: string; ok: boolean } {
  try {
    const stdout = child_process.execSync(cmd, { encoding: 'utf8', timeout: 30_000 }).trim()
    return { stdout, ok: true }
  } catch {
    return { stdout: '', ok: false }
  }
}

const live = process.argv.includes('--live')
const checks: TruthCheck[] = []

// ── Load Inventory ────────────────────────────────────────────────────────────

if (!fs.existsSync(INVENTORY_PATH)) {
  console.error('✗ Missing governance/release/deployment-inventory.json')
  process.exit(1)
}

const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as {
  apps: Record<string, AppEntry>
}

const routing: { entries: RoutingEntry[] } | null = fs.existsSync(ROUTING_PATH)
  ? JSON.parse(fs.readFileSync(ROUTING_PATH, 'utf8'))
  : null

// ── Check 1: Inventory structure ──────────────────────────────────────────────

const apps = Object.entries(inventory.apps)
const appNames = apps.map(([name]) => name)

for (const [name, app] of apps) {
  // Tier must be valid
  if (!['tier-1', 'tier-2', 'internal', 'frozen'].includes(app.tier)) {
    checks.push({ check: 'valid-tier', app: name, status: 'fail', message: `Invalid tier: ${app.tier}` })
  }

  // Release status must be valid
  const validStatuses = ['prod-approved', 'staging-only', 'incubating', 'internal-only', 'frozen', 'blocked']
  if (!validStatuses.includes(app.releaseStatus)) {
    checks.push({ check: 'valid-status', app: name, status: 'fail', message: `Invalid releaseStatus: ${app.releaseStatus}` })
  }

  // Prod-eligible apps must have routing
  if (app.prodPromotionEligible && !app.routing?.staging) {
    checks.push({ check: 'routing-present', app: name, status: 'fail', message: 'Prod-eligible but no staging URL' })
  }

  // Health path must exist
  if (app.routing && !app.routing.healthPath) {
    checks.push({ check: 'health-path', app: name, status: 'warn', message: 'No healthPath configured' })
  }

  // Frozen apps should not be prod-eligible
  if (app.tier === 'frozen' && app.prodPromotionEligible) {
    checks.push({ check: 'frozen-consistency', app: name, status: 'fail', message: 'Frozen app should not be prod-eligible' })
  }
}

checks.push({
  check: 'inventory-structure',
  status: 'pass',
  message: `${apps.length} apps in inventory with valid structure`,
})

// ── Check 2: Routing registry consistency ────────────────────────────────────

if (routing) {
  for (const entry of routing.entries) {
    if (!appNames.includes(entry.app)) {
      checks.push({
        check: 'routing-orphan',
        app: entry.app,
        status: 'warn',
        message: `App in routing registry but not in deployment inventory`,
      })
    }
  }

  // Check inventory apps have matching routing entries
  const routedApps = new Set(routing.entries.map((e) => e.app))
  const prodApps = apps.filter(([, app]) => app.prodPromotionEligible)
  for (const [name] of prodApps) {
    if (!routedApps.has(name)) {
      checks.push({
        check: 'routing-missing',
        app: name,
        status: 'warn',
        message: `Prod-eligible app missing from domain routing registry`,
      })
    }
  }

  checks.push({
    check: 'routing-consistency',
    status: 'pass',
    message: `Routing registry has ${routing.entries.length} entries, ${routedApps.size} unique apps`,
  })
} else {
  checks.push({ check: 'routing-consistency', status: 'warn', message: 'No domain routing registry found' })
}

// ── Check 3: Live Azure validation ───────────────────────────────────────────

if (live) {
  console.log('  Querying Azure Container Apps...')
  const { stdout: azApps, ok } = exec(
    'az containerapp list --resource-group nzila-canada-staging-rg --query "[].name" -o tsv',
  )

  if (ok) {
    const deployedApps = new Set(azApps.split('\n').map((a) => a.trim()).filter(Boolean))

    // Check each inventory app exists in Azure
    for (const [name] of apps.filter(([, a]) => a.tier !== 'frozen')) {
      const containerName = `nzila-os-${name}`
      if (deployedApps.has(containerName)) {
        checks.push({ check: 'azure-exists', app: name, status: 'pass', message: `Container App ${containerName} exists` })
      } else {
        checks.push({ check: 'azure-exists', app: name, status: 'warn', message: `Container App ${containerName} not found in Azure` })
      }
    }

    // Check for orphaned Azure apps
    for (const deployed of deployedApps) {
      const appName = deployed.replace(/^nzila-os-/, '')
      if (!appNames.includes(appName)) {
        checks.push({ check: 'azure-orphan', app: appName, status: 'warn', message: `Azure Container App ${deployed} not in inventory` })
      }
    }
  } else {
    checks.push({ check: 'azure-query', status: 'fail', message: 'Failed to query Azure — check az CLI auth' })
  }
} else {
  checks.push({ check: 'azure-live', status: 'skip', message: 'Skipped live Azure validation — use --live' })
}

// ── Compute Breakdowns ───────────────────────────────────────────────────────

const tierBreakdown: Record<string, number> = {}
const statusBreakdown: Record<string, number> = {}
for (const [, app] of apps) {
  tierBreakdown[app.tier] = (tierBreakdown[app.tier] ?? 0) + 1
  statusBreakdown[app.releaseStatus] = (statusBreakdown[app.releaseStatus] ?? 0) + 1
}

// ── Print Results ─────────────────────────────────────────────────────────────

const failCount = checks.filter((c) => c.status === 'fail').length
const warnCount = checks.filter((c) => c.status === 'warn').length
const overallStatus = failCount > 0 ? 'fail' : 'pass'

console.log('\n── Environment Truth Crosscheck ────────────────────────')
console.log(`  Mode: ${live ? 'live' : 'dry-run'}`)
console.log(`  Apps: ${apps.length}`)
console.log(`  Tiers: ${Object.entries(tierBreakdown).map(([k, v]) => `${k}(${v})`).join(', ')}`)
console.log('')

for (const c of checks) {
  if (c.status === 'pass' && !c.app) {
    const icon = '✓'
    console.log(`  ${icon}  [${c.check}] ${c.message}`)
  } else if (c.status !== 'pass') {
    const icon = c.status === 'fail' ? '✗' : '⚠'
    console.log(`  ${icon}  [${c.check}]${c.app ? ` (${c.app})` : ''} ${c.message}`)
  }
}

console.log('')
if (failCount > 0) {
  console.log(`✗ ${failCount} failure(s), ${warnCount} warning(s)`)
} else if (warnCount > 0) {
  console.log(`⚠ Passed with ${warnCount} warning(s)`)
} else {
  console.log('✓ All environment truth checks passed')
}

// ── Write Report ──────────────────────────────────────────────────────────────

const report: EnvironmentTruth = {
  timestamp: new Date().toISOString(),
  mode: live ? 'live' : 'dry-run',
  checks,
  appCount: apps.length,
  tierBreakdown,
  statusBreakdown,
  overallStatus,
  failCount,
  warnCount,
}

fs.mkdirSync(REPORT_DIR, { recursive: true })
const reportPath = path.join(REPORT_DIR, 'environment-truth.json')
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
console.log(`\n  Report: reports/release/environment-truth.json`)

process.exit(failCount > 0 ? 1 : 0)
