/**
 * portfolio-dashboard.ts — Release visibility across all Nzila OS apps.
 *
 * Shows per-app production vs staging version, release age, rollback candidate,
 * failed promotions, and hotfix frequency.
 *
 * Usage:
 *   pnpm release:dashboard
 *   pnpm release:dashboard --output json          # machine-readable
 *   pnpm release:dashboard --output markdown      # docs/ops/release-status.md
 *
 * Data sources:
 *   ops/releases/             — release manifests (one per tag)
 *   ops/evidence/             — staging deploy evidence ledger
 *   ops/rollbacks/            — rollback incident records
 *   ops/hotfixes/             — hotfix records
 *   governance/release/deployment-inventory.json
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as child_process from 'node:child_process'

const ROOT = path.resolve(__dirname, '..', '..')
const OPS = path.join(ROOT, 'ops')

// Module-level path constants
const RELEASES_DIR = path.join(OPS, 'releases')
const EVIDENCE_LEDGER = path.join(OPS, 'evidence', 'deploy-evidence-ledger.json')
const ROLLBACKS_DIR = path.join(OPS, 'rollbacks')
const HOTFIXES_DIR = path.join(OPS, 'hotfixes')
const INVENTORY_PATH = path.join(ROOT, 'governance', 'release', 'deployment-inventory.json')
const DASHBOARD_OUT = path.join(ROOT, 'docs', 'ops', 'release-status.md')

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppConfig {
  releaseStatus: string
  prodPromotionEligible?: boolean
}

interface Inventory {
  apps: Record<string, AppConfig>
}

interface ReleaseManifest {
  version: string
  tag: string
  gitSha: string
  date: string
  releaseType: 'standard' | 'hotfix'
  approvedApps: string[]
}

interface EvidenceRecord {
  evidenceId: string
  timestamp: string
  gitSha: string
  deployedApps: Array<{
    app: string
    imageTag: string
    versionDriftState: string
  }>
  promotionVerdict: string
}

interface EvidenceLedger {
  records: EvidenceRecord[]
}

interface RollbackRecord {
  rollbackId: string
  executedAt: string
  targetTag: string
  previousTag: string
  apps: Array<{ app: string }>
  smokeResult: string
}

interface HotfixRecord {
  hotfixId: string
  initiatedAt: string
  incidentRef: string
  apps: string[]
  status: string
}

interface AppDashboardEntry {
  app: string
  releaseStatus: string
  prodVersion: string | null
  prodDate: string | null
  prodAge: string
  prodReleaseType: string
  stagingVersion: string | null
  stagingSha: string | null
  stagingDate: string | null
  stagingPromoReady: boolean
  rollbackCandidate: string | null
  hotfixCount: number
  rollbackCount: number
  lastRollback: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return undefined
  return process.argv[idx + 1]
}

function ageLabel(isoDate: string | null): string {
  if (!isoDate) return 'unknown'
  const ms = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 8) return `${weeks} weeks ago`
  const months = Math.floor(days / 30)
  return `${months} months ago`
}

function loadInventory(): Inventory {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as Inventory
}

function loadReleaseTags(): ReleaseManifest[] {
  if (!fs.existsSync(RELEASES_DIR)) return []
  const resolvedBase = path.resolve(RELEASES_DIR)
  const files = fs.readdirSync(RELEASES_DIR).filter((f) => f.startsWith('release-v') && f.endsWith('.json'))
  return files
    .map((f) => {
      try {
        const fullPath = path.join(RELEASES_DIR, f)
        if (!path.resolve(fullPath).startsWith(resolvedBase)) return null
        return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as ReleaseManifest
      } catch {
        return null
      }
    })
    .filter((m): m is ReleaseManifest => m !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function loadEvidenceLedger(): EvidenceRecord[] {
  if (!fs.existsSync(EVIDENCE_LEDGER)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(EVIDENCE_LEDGER, 'utf8')) as EvidenceLedger
    return (raw.records ?? []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  } catch {
    return []
  }
}

function loadRollbacks(): RollbackRecord[] {
  if (!fs.existsSync(ROLLBACKS_DIR)) return []
  const resolvedBase = path.resolve(ROLLBACKS_DIR)
  const files = fs.readdirSync(ROLLBACKS_DIR).filter((f) => f.endsWith('.json'))
  return files
    .map((f) => {
      try {
        const fullPath = path.join(ROLLBACKS_DIR, f)
        if (!path.resolve(fullPath).startsWith(resolvedBase)) return null
        return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as RollbackRecord
      } catch {
        return null
      }
    })
    .filter((r): r is RollbackRecord => r !== null)
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
}

function loadHotfixes(): HotfixRecord[] {
  if (!fs.existsSync(HOTFIXES_DIR)) return []
  const resolvedBase = path.resolve(HOTFIXES_DIR)
  const files = fs.readdirSync(HOTFIXES_DIR).filter((f) => f.endsWith('.json'))
  return files
    .map((f) => {
      try {
        const fullPath = path.join(HOTFIXES_DIR, f)
        if (!path.resolve(fullPath).startsWith(resolvedBase)) return null
        return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as HotfixRecord
      } catch {
        return null
      }
    })
    .filter((h): h is HotfixRecord => h !== null)
}

function getLatestGitTags(): string[] {
  try {
    const out = child_process.execSync('git tag --list "v*" --sort=-version:refname', { encoding: 'utf8' })
    return out.split('\n').filter(Boolean).slice(0, 10)
  } catch {
    return []
  }
}

function buildDashboard(): AppDashboardEntry[] {
  const inventory = loadInventory()
  const releases = loadReleaseTags()
  const ledger = loadEvidenceLedger()
  const rollbacks = loadRollbacks()
  const hotfixes = loadHotfixes()
  const gitTags = getLatestGitTags()

  // Latest prod release (most recent tag with manifest)
  const latestProdRelease = releases[0] ?? null
  // Penultimate — rollback candidate
  const rollbackCandidateRelease = releases[1] ?? null

  const latestGitTag = gitTags[0] ?? null

  return Object.entries(inventory.apps).map(([app, cfg]): AppDashboardEntry => {
    // Prod version — from latest release manifest that includes this app
    const prodRelease = releases.find(
      (r) => r.approvedApps?.includes(app) || !r.approvedApps,
    ) ?? latestProdRelease

    // Staging version — from most recent evidence record containing this app
    const latestStagingRecord = ledger.find((e) => e.deployedApps?.some((d) => d.app === app))
    const stagingAppEntry = latestStagingRecord?.deployedApps?.find((d) => d.app === app)

    // Rollback count for this app
    const appRollbacks = rollbacks.filter((r) => r.apps?.some((a) => a.app === app))
    const lastRollback = appRollbacks[0]?.executedAt ?? null

    // Hotfix count for this app
    const appHotfixes = hotfixes.filter((h) => h.apps?.includes(app))

    const rollbackCandidate =
      rollbackCandidateRelease?.approvedApps?.includes(app) || !rollbackCandidateRelease?.approvedApps
        ? (rollbackCandidateRelease?.tag ?? null)
        : null

    const prodVersion = prodRelease?.tag ?? latestGitTag ?? null
    const prodDate = prodRelease?.date ?? null

    return {
      app,
      releaseStatus: cfg.releaseStatus,
      prodVersion,
      prodDate,
      prodAge: ageLabel(prodDate),
      prodReleaseType: prodRelease?.releaseType ?? 'unknown',
      stagingVersion: stagingAppEntry?.imageTag?.slice(0, 8) ?? null,
      stagingSha: latestStagingRecord?.gitSha?.slice(0, 8) ?? null,
      stagingDate: latestStagingRecord?.timestamp ?? null,
      stagingPromoReady: latestStagingRecord?.promotionVerdict === 'ready',
      rollbackCandidate,
      hotfixCount: appHotfixes.length,
      rollbackCount: appRollbacks.length,
      lastRollback: lastRollback ? ageLabel(lastRollback) : null,
    }
  })
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function renderConsole(entries: AppDashboardEntry[]): void {
  const now = new Date().toLocaleString()
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗')
  console.log('║              NZILA OS — PORTFOLIO RELEASE DASHBOARD                       ║')
  console.log(`║  Generated: ${now.padEnd(63)}║`)
  console.log('╠════════════════════════════════════════════════════════════════════════════╣')

  const cols = {
    app: 20,
    status: 16,
    prod: 12,
    age: 14,
    staging: 12,
    stageReady: 12,
    rollback: 10,
    hotfixes: 9,
  }

  const header = [
    'App'.padEnd(cols.app),
    'Status'.padEnd(cols.status),
    'Prod Tag'.padEnd(cols.prod),
    'Prod Age'.padEnd(cols.age),
    'Staging SHA'.padEnd(cols.staging),
    'Promo Ready'.padEnd(cols.stageReady),
    'Rollback#'.padEnd(cols.rollback),
    'Hotfixes',
  ].join('│')
  console.log(`║ ${header} ║`)
  console.log('╠════════════════════════════════════════════════════════════════════════════╣')

  for (const e of entries) {
    const promoReady = e.stagingPromoReady ? '✓ ready' : (e.stagingVersion ? '○ pending' : '— none')
    const row = [
      e.app.padEnd(cols.app),
      e.releaseStatus.padEnd(cols.status),
      (e.prodVersion ?? '—').padEnd(cols.prod),
      e.prodAge.padEnd(cols.age),
      (e.stagingVersion ?? '—').padEnd(cols.staging),
      promoReady.padEnd(cols.stageReady),
      String(e.rollbackCount).padEnd(cols.rollback),
      String(e.hotfixCount),
    ].join('│')
    console.log(`║ ${row} ║`)
  }

  console.log('╚════════════════════════════════════════════════════════════════════════════╝')

  // Rollback candidates
  const rollbackCandidates = entries.filter((e) => e.rollbackCandidate)
  if (rollbackCandidates.length > 0) {
    console.log('\n  Rollback candidates:')
    for (const e of rollbackCandidates) {
      console.log(`    ${e.app.padEnd(20)} → ${e.rollbackCandidate}`)
    }
  }

  // Promo-blocked apps
  const blocked = entries.filter((e) => !e.stagingPromoReady && e.stagingVersion && e.releaseStatus !== 'frozen')
  if (blocked.length > 0) {
    console.log('\n  Promotion-blocked apps (staging not ready):')
    for (const e of blocked) console.log(`    ${e.app}`)
  }

  console.log()
}

function renderMarkdown(entries: AppDashboardEntry[]): string {
  const now = new Date().toISOString()
  const rows = entries.map((e) => {
    const promoReady = e.stagingPromoReady ? '✅' : (e.stagingVersion ? '⏳' : '—')
    const rollbackCol = e.rollbackCandidate ? `\`${e.rollbackCandidate}\`` : '—'
    return `| \`${e.app}\` | ${e.releaseStatus} | ${e.prodVersion ?? '—'} | ${e.prodAge} | ${e.stagingVersion ?? '—'} | ${promoReady} | ${rollbackCol} | ${e.hotfixCount} |`
  })

  return [
    '# Nzila OS — Portfolio Release Status',
    '',
    `> Generated: ${now}`,
    '',
    '| App | Status | Prod Tag | Prod Age | Staging SHA | Promo Ready | Rollback Candidate | Hotfixes |',
    '|-----|--------|----------|----------|-------------|-------------|-------------------|---------|',
    ...rows,
    '',
    '---',
    '',
    '## Rollback Procedure',
    '```bash',
    'pnpm release:rollback --list',
    'pnpm release:rollback --tag v1.2.0 --dry-run',
    'pnpm release:rollback --tag v1.2.0 --execute',
    '```',
    '',
    '## Tag a New Release',
    '```bash',
    'pnpm release:tag --bump patch',
    'pnpm release:tag --bump minor',
    '```',
  ].join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  const outputMode = parseArg('--output') ?? 'console'

  const entries = buildDashboard()

  if (outputMode === 'json') {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), apps: entries }, null, 2))
    return
  }

  if (outputMode === 'markdown') {
    const md = renderMarkdown(entries)
    fs.mkdirSync(path.dirname(DASHBOARD_OUT), { recursive: true })
    fs.writeFileSync(DASHBOARD_OUT, md, 'utf8')
    console.log(`✓ Written to ${DASHBOARD_OUT}`)
    // Also render console summary
    renderConsole(entries)
    return
  }

  // Default: console
  renderConsole(entries)
}

main()
