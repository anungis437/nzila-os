/**
 * Nzila OS — MTTR (Mean Time to Remediate) Tracking Dashboard
 * iSSDLC R-8: Vulnerability remediation metrics from dependency-audit artifacts
 *
 * Reads audit-report.json, ACTIVE_WAIVERS, and remediation history log
 * to compute MTTR metrics and SLA compliance for vulnerability management.
 *
 * Usage: pnpm tsx tooling/security/mttr-dashboard.ts
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ACTIVE_WAIVERS, type VulnerabilityWaiver } from './supply-chain-policy'

const ROOT = join(__dirname, '..', '..')

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditAdvisory {
  severity: string
  cves: string[]
  [key: string]: unknown
}

interface AuditReport {
  advisories: Record<string, AuditAdvisory>
  metadata: {
    vulnerabilities: {
      info: number
      low: number
      moderate: number
      high: number
      critical: number
    }
    dependencies: number
    totalDependencies: number
  }
}

export interface RemediationEvent {
  /** CVE, GHSA, or npm advisory ID */
  advisoryId: string
  /** Severity at time of detection */
  severity: 'info' | 'low' | 'moderate' | 'high' | 'critical'
  /** Affected package */
  package: string
  /** ISO timestamp — when the vulnerability was first detected */
  detectedAt: string
  /** ISO timestamp — when the fix was merged/deployed (null if still open) */
  resolvedAt: string | null
  /** MTTR in hours (null if unresolved) */
  mttrHours: number | null
  /** How it was resolved */
  resolvedBy: 'patch' | 'override' | 'waiver' | 'removal' | null
}

interface MttrBySeverity {
  severity: string
  count: number
  avgMttrHours: number
  maxMttrHours: number
  minMttrHours: number
  withinSla: number
  slaTarget: number
}

interface WaiverStatus {
  total: number
  active: number
  expiringSoon: number
  expired: number
  waivers: Array<{
    id: string
    package: string
    severity: string
    expiresAt: string
    daysRemaining: number
    status: 'active' | 'expiring_soon' | 'expired'
  }>
}

export interface MttrDashboard {
  generatedAt: string
  summary: {
    totalDependencies: number
    currentVulnerabilities: number
    vulnFreeRate: number
    openHighCritical: number
    overallMttrHours: number
    criticalMttrHours: number
    highMttrHours: number
    slaMet: boolean
  }
  slaTargets: {
    criticalMttrHours: number
    highMttrHours: number
    vulnFreeRateTarget: number
  }
  mttrBySeverity: MttrBySeverity[]
  activeVulnerabilities: Array<{
    advisoryId: string
    severity: string
    ageHours: number
    slaBreached: boolean
  }>
  waiverStatus: WaiverStatus
  remediationHistory: RemediationEvent[]
}

// ── SLA Targets ──────────────────────────────────────────────────────────────

const SLA_TARGETS = {
  critical: 24,   // hours — must remediate critical within 24h
  high: 72,       // hours — must remediate high within 72h
  moderate: 168,  // hours — 7 days
  low: 720,       // hours — 30 days
  vulnFreeRate: 0.98, // 98% of dependencies must be vulnerability-free
}

// ── Remediation History ──────────────────────────────────────────────────────

const HISTORY_PATH = join(ROOT, 'ops', 'compliance', 'remediation-history.json')

function loadRemediationHistory(): RemediationEvent[] {
  if (!existsSync(HISTORY_PATH)) return []
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, 'utf-8'))
  } catch {
    console.warn('⚠ Could not parse remediation-history.json — starting fresh')
    return []
  }
}

function saveRemediationHistory(events: RemediationEvent[]): void {
  writeFileSync(HISTORY_PATH, JSON.stringify(events, null, 2))
}

// ── Audit Report Parsing ─────────────────────────────────────────────────────

function loadAuditReport(): AuditReport {
  const auditPath = join(ROOT, 'audit-report.json')
  if (!existsSync(auditPath)) {
    console.warn('⚠ audit-report.json not found — run `pnpm audit --json > audit-report.json` first')
    return {
      advisories: {},
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
        dependencies: 0,
        totalDependencies: 0,
      },
    }
  }
  return JSON.parse(readFileSync(auditPath, 'utf-8'))
}

// ── Waiver Analysis ──────────────────────────────────────────────────────────

function analyzeWaivers(waivers: VulnerabilityWaiver[]): WaiverStatus {
  const now = new Date()
  const soonThreshold = 14 // days — warn if expiring within 14 days

  const analyzed = waivers.map((w) => {
    const expiresDate = new Date(w.expiresAt)
    const daysRemaining = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    let status: 'active' | 'expiring_soon' | 'expired'
    if (daysRemaining < 0) {
      status = 'expired'
    } else if (daysRemaining <= soonThreshold) {
      status = 'expiring_soon'
    } else {
      status = 'active'
    }

    return {
      id: w.id,
      package: w.package,
      severity: w.severity,
      expiresAt: w.expiresAt,
      daysRemaining,
      status,
    }
  })

  return {
    total: analyzed.length,
    active: analyzed.filter((w) => w.status === 'active').length,
    expiringSoon: analyzed.filter((w) => w.status === 'expiring_soon').length,
    expired: analyzed.filter((w) => w.status === 'expired').length,
    waivers: analyzed,
  }
}

// ── MTTR Calculation ─────────────────────────────────────────────────────────

function computeMttrBySeverity(history: RemediationEvent[]): MttrBySeverity[] {
  const severities = ['critical', 'high', 'moderate', 'low'] as const
  const slaTargetsMap: Record<string, number> = SLA_TARGETS

  return severities.map((severity) => {
    const resolved = history.filter(
      (e) => e.severity === severity && e.mttrHours != null,
    )

    if (resolved.length === 0) {
      return {
        severity,
        count: 0,
        avgMttrHours: 0,
        maxMttrHours: 0,
        minMttrHours: 0,
        withinSla: 0,
        slaTarget: slaTargetsMap[severity] ?? 720,
      }
    }

    const mttrs = resolved.map((e) => e.mttrHours!)
    const slaTarget = slaTargetsMap[severity] ?? 720

    return {
      severity,
      count: resolved.length,
      avgMttrHours: Math.round(mttrs.reduce((a, b) => a + b, 0) / mttrs.length),
      maxMttrHours: Math.max(...mttrs),
      minMttrHours: Math.min(...mttrs),
      withinSla: resolved.filter((e) => e.mttrHours! <= slaTarget).length,
      slaTarget,
    }
  })
}

// ── Dashboard Generation ─────────────────────────────────────────────────────

function syncRemediationState(
  audit: AuditReport,
  history: RemediationEvent[],
): RemediationEvent[] {
  const now = new Date().toISOString()

  // 1. Mark resolved: any advisory in history that's no longer in audit
  for (const event of history) {
    if (event.resolvedAt == null && !(event.advisoryId in audit.advisories)) {
      event.resolvedAt = now
      event.mttrHours = Math.round(
        (new Date(now).getTime() - new Date(event.detectedAt).getTime()) / (1000 * 60 * 60),
      )
      if (!event.resolvedBy) event.resolvedBy = 'patch'
    }
  }

  // 2. Add new: any advisory in audit not yet in history
  const knownIds = new Set(history.map((e) => e.advisoryId))
  for (const [id, advisory] of Object.entries(audit.advisories)) {
    if (!knownIds.has(id)) {
      const waiver = ACTIVE_WAIVERS.find((w) => w.id === id)
      history.push({
        advisoryId: id,
        severity: advisory.severity as RemediationEvent['severity'],
        package: waiver?.package ?? 'unknown',
        detectedAt: now,
        resolvedAt: null,
        mttrHours: null,
        resolvedBy: null,
      })
    }
  }

  return history
}

function generateDashboard(): MttrDashboard {
  const audit = loadAuditReport()
  let history = loadRemediationHistory()

  // Sync current state with audit report
  history = syncRemediationState(audit, history)
  saveRemediationHistory(history)

  const waiverStatus = analyzeWaivers(ACTIVE_WAIVERS)
  const mttrBySeverity = computeMttrBySeverity(history)
  const now = new Date()

  // Current open vulnerabilities
  const totalVulns =
    audit.metadata.vulnerabilities.critical +
    audit.metadata.vulnerabilities.high +
    audit.metadata.vulnerabilities.moderate +
    audit.metadata.vulnerabilities.low +
    audit.metadata.vulnerabilities.info

  const openHighCritical =
    audit.metadata.vulnerabilities.critical + audit.metadata.vulnerabilities.high

  const vulnFreeRate =
    audit.metadata.totalDependencies > 0
      ? (audit.metadata.totalDependencies - totalVulns) / audit.metadata.totalDependencies
      : 1

  // Active (unresolved) vulnerabilities with age
  const activeVulns = history
    .filter((e) => e.resolvedAt == null)
    .map((e) => {
      const ageHours = Math.round(
        (now.getTime() - new Date(e.detectedAt).getTime()) / (1000 * 60 * 60),
      )
      const slaTarget = (SLA_TARGETS as Record<string, number>)[e.severity] ?? 720
      return {
        advisoryId: e.advisoryId,
        severity: e.severity,
        ageHours,
        slaBreached: ageHours > slaTarget,
      }
    })

  // Overall MTTR (resolved events only)
  const allResolved = history.filter((e) => e.mttrHours != null)
  const overallMttr =
    allResolved.length > 0
      ? Math.round(allResolved.reduce((s, e) => s + e.mttrHours!, 0) / allResolved.length)
      : 0

  const criticalMetrics = mttrBySeverity.find((m) => m.severity === 'critical')
  const highMetrics = mttrBySeverity.find((m) => m.severity === 'high')

  const slaMet =
    (criticalMetrics?.count === 0 || (criticalMetrics?.avgMttrHours ?? 0) <= SLA_TARGETS.critical) &&
    (highMetrics?.count === 0 || (highMetrics?.avgMttrHours ?? 0) <= SLA_TARGETS.high) &&
    vulnFreeRate >= SLA_TARGETS.vulnFreeRate

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalDependencies: audit.metadata.totalDependencies,
      currentVulnerabilities: totalVulns,
      vulnFreeRate: Math.round(vulnFreeRate * 10000) / 100, // percentage with 2 decimals
      openHighCritical,
      overallMttrHours: overallMttr,
      criticalMttrHours: criticalMetrics?.avgMttrHours ?? 0,
      highMttrHours: highMetrics?.avgMttrHours ?? 0,
      slaMet,
    },
    slaTargets: {
      criticalMttrHours: SLA_TARGETS.critical,
      highMttrHours: SLA_TARGETS.high,
      vulnFreeRateTarget: SLA_TARGETS.vulnFreeRate * 100,
    },
    mttrBySeverity,
    activeVulnerabilities: activeVulns,
    waiverStatus,
    remediationHistory: history,
  }
}

// ── CLI Output ───────────────────────────────────────────────────────────────

function main() {
  const dashboard = generateDashboard()
  const s = dashboard.summary

  console.log('\n=== Nzila OS — MTTR Tracking Dashboard ===\n')
  console.log(`Generated: ${dashboard.generatedAt}`)
  console.log(`Dependencies: ${s.totalDependencies}`)
  console.log('')

  // Summary
  console.log('── Vulnerability Summary ──')
  console.log(`  Current vulnerabilities:    ${s.currentVulnerabilities}`)
  console.log(`  Open high/critical:         ${s.openHighCritical}`)
  console.log(`  Vuln-free rate:             ${s.vulnFreeRate}% (target: ${dashboard.slaTargets.vulnFreeRateTarget}%)`)
  console.log('')

  // MTTR
  console.log('── MTTR Metrics ──')
  console.log(`  Overall avg MTTR:           ${s.overallMttrHours}h`)
  console.log(`  Critical avg MTTR:          ${s.criticalMttrHours}h (SLA: ≤${dashboard.slaTargets.criticalMttrHours}h)`)
  console.log(`  High avg MTTR:              ${s.highMttrHours}h (SLA: ≤${dashboard.slaTargets.highMttrHours}h)`)
  console.log(`  SLA status:                 ${s.slaMet ? '✅ MET' : '❌ BREACHED'}`)
  console.log('')

  // MTTR by severity
  if (dashboard.mttrBySeverity.some((m) => m.count > 0)) {
    console.log('── MTTR by Severity ──')
    for (const m of dashboard.mttrBySeverity) {
      if (m.count === 0) continue
      console.log(`  ${m.severity.toUpperCase()}: ${m.count} resolved | avg ${m.avgMttrHours}h | max ${m.maxMttrHours}h | ${m.withinSla}/${m.count} within SLA (≤${m.slaTarget}h)`)
    }
    console.log('')
  }

  // Active vulnerabilities
  if (dashboard.activeVulnerabilities.length > 0) {
    console.log('── Active Vulnerabilities ──')
    for (const v of dashboard.activeVulnerabilities) {
      const icon = v.slaBreached ? '🔴' : '🟡'
      console.log(`  ${icon} ${v.advisoryId} (${v.severity}) — ${v.ageHours}h old${v.slaBreached ? ' [SLA BREACHED]' : ''}`)
    }
    console.log('')
  }

  // Waivers
  console.log('── Waiver Status ──')
  console.log(`  Total: ${dashboard.waiverStatus.total} | Active: ${dashboard.waiverStatus.active} | Expiring soon: ${dashboard.waiverStatus.expiringSoon} | Expired: ${dashboard.waiverStatus.expired}`)
  for (const w of dashboard.waiverStatus.waivers) {
    const icon = { active: '✅', expiring_soon: '⚠️', expired: '❌' }[w.status]
    console.log(`  ${icon} ${w.id} (${w.package}) — ${w.daysRemaining > 0 ? `${w.daysRemaining}d remaining` : `expired ${Math.abs(w.daysRemaining)}d ago`}`)
  }
  console.log('')

  // Write JSON
  const outputPath = join(ROOT, 'ops', 'compliance', 'mttr-dashboard.json')
  writeFileSync(outputPath, JSON.stringify(dashboard, null, 2))
  console.log(`Written to: ${relative(ROOT, outputPath)}`)
}

main()
