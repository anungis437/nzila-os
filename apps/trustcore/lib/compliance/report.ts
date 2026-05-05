/**
 * TrustCore — Compliance Report Generator
 *
 * Produces a structured, human-readable compliance report from the
 * evaluation engine. This object drives:
 *   - The audit export (JSON + PDF)
 *   - The UI report view
 *   - The Trust Center summary
 *
 * All data comes from a single evaluateCompliance() call — no extra queries.
 */

import {
  fetchComplianceInputs,
  evaluateComplianceFromInputs,
} from './engine'
import { listTrustcorePrivacyPrograms } from '@nzila/db/queries/trustcore'
import type { ComplianceEvaluation, RiskItem, RiskCategory } from '@/types/core'
import type { ComplianceInputs } from './engine'

// ── Report types ────────────────────────────────────────────────────────────

export interface ComplianceReportSection {
  title: string
  findings: string[]
}

export interface ComplianceReport {
  generatedAt: string
  framework: 'law-25'
  orgId: string

  // Top-level
  score: number
  confidence: number
  status: ComplianceEvaluation['status']
  auditReadyStatement: string

  // Categorised risks
  risksByCategory: Record<RiskCategory, RiskItem[]>
  blockingRisks: RiskItem[]
  totalRisks: number
  blockingCount: number

  // Summary stats
  summary: ComplianceEvaluation['summary']

  // Narrative sections for PDF/report rendering
  sections: ComplianceReportSection[]

  // Full evaluation (for JSON export)
  evaluation: ComplianceEvaluation

  // Raw inputs (for full audit export)
  inputs: ComplianceInputs

  // Privacy program info (safe to expose in reports)
  privacyOfficerName: string | null
  privacyOfficerEmail: string | null
  privacyOfficerRole: string | null
  programStatus: string | null
  lastReviewedAt: string | null

  evaluatedAt: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const ALL_CATEGORIES: RiskCategory[] = ['governance', 'data', 'pia', 'incident', 'dsr', 'vendor']

const CATEGORY_NAMES: Record<RiskCategory, string> = {
  governance: 'Governance',
  data: 'Data Inventory',
  pia: 'Privacy Impact Assessments',
  incident: 'Incidents',
  dsr: 'DSR Requests',
  vendor: 'Vendors',
}

function buildAuditReadyStatement(
  score: number,
  confidence: number,
  blockingCount: number,
): string {
  if (score >= 85 && blockingCount === 0 && confidence >= 70) {
    return 'This organisation meets the Law 25 compliance thresholds evaluated at this point in time. No blocking risks were identified and data coverage is sufficient to support this assessment.'
  }
  if (score >= 60 && blockingCount === 0) {
    return 'This organisation is partially compliant with Law 25. Gaps have been identified that require remediation before the organisation can be considered audit-ready.'
  }
  if (blockingCount > 0) {
    return `This organisation has ${blockingCount} blocking compliance issue(s) that must be resolved before an audit can proceed. These represent immediate legal obligations under Law 25.`
  }
  return 'This organisation does not currently meet Law 25 compliance thresholds. Significant remediation is required before any audit can be attempted.'
}

function buildNarrativeSections(
  evaluation: ComplianceEvaluation,
  inputs: ComplianceInputs,
): ComplianceReportSection[] {
  const sections: ComplianceReportSection[] = []

  // Executive Summary
  const execFindings: string[] = [
    `Compliance Score: ${evaluation.score}/100 (Confidence: ${evaluation.confidence}%)`,
    `Status: ${evaluation.status.replace('-', ' ')}`,
    `Total Risks: ${evaluation.risks.length}`,
    `Blocking Risks: ${evaluation.risks.filter((r) => r.blocking).length}`,
    `Evaluated: ${new Date(evaluation.evaluatedAt).toLocaleString()}`,
  ]
  sections.push({ title: 'Executive Summary', findings: execFindings })

  // Governance
  const govFindings: string[] = []
  const activeProgram = inputs.programs.find((p) => p.status === 'active')
  if (activeProgram) {
    govFindings.push(`Active privacy program established (status: ${activeProgram.status})`)
    if (activeProgram.privacyOfficerEmail) {
      govFindings.push(`Privacy Officer designated: ${activeProgram.privacyOfficerName ?? 'on file'}`)
    } else {
      govFindings.push('No Privacy Officer email on file — remediation required')
    }
  } else {
    govFindings.push('No active privacy program — immediate action required')
  }
  sections.push({ title: 'Governance', findings: govFindings })

  // Data Inventory
  const dataFindings: string[] = []
  const activeAssets = inputs.assets.filter((a) => a.status === 'active')
  dataFindings.push(`${activeAssets.length} active data asset(s) registered`)
  const highCritical = activeAssets.filter(
    (a) => a.sensitivityLevel === 'high' || a.sensitivityLevel === 'critical',
  )
  if (highCritical.length > 0) {
    dataFindings.push(`${highCritical.length} high/critical sensitivity asset(s) identified`)
  }
  const crossBorder = activeAssets.filter((a) => a.crossBorderTransfer)
  if (crossBorder.length > 0) {
    dataFindings.push(`${crossBorder.length} asset(s) involve cross-border data transfer`)
  }
  sections.push({ title: 'Data Inventory', findings: dataFindings })

  // PIAs
  const piaFindings: string[] = [`${inputs.pias.length} Privacy Impact Assessment(s) on record`]
  const approved = inputs.pias.filter((p) => p.status === 'approved').length
  const mitReq = inputs.pias.filter((p) => p.status === 'mitigation_required').length
  if (approved > 0) piaFindings.push(`${approved} PIA(s) approved`)
  if (mitReq > 0) piaFindings.push(`${mitReq} PIA(s) require mitigation — action needed`)
  sections.push({ title: 'Privacy Impact Assessments', findings: piaFindings })

  // Incidents
  const incidentFindings: string[] = [`${inputs.incidents.length} incident(s) logged in total`]
  const openIncidents = inputs.incidents.filter(
    (i) => i.resolutionStatus === 'open' || i.resolutionStatus === 'contained',
  )
  const criticalOpen = openIncidents.filter((i) => i.severity === 'critical')
  if (openIncidents.length > 0) {
    incidentFindings.push(`${openIncidents.length} incident(s) currently open or contained`)
  }
  if (criticalOpen.length > 0) {
    incidentFindings.push(`${criticalOpen.length} critical incident(s) require immediate action`)
  }
  const unreported = inputs.incidents.filter((i) => i.seriousHarmLikely && !i.reportedToCai)
  if (unreported.length > 0) {
    incidentFindings.push(`${unreported.length} incident(s) with serious harm have NOT been reported to the CAI — statutory deadline may apply`)
  }
  sections.push({ title: 'Incident Register', findings: incidentFindings })

  // DSR
  const dsrFindings: string[] = [`${inputs.dsrRequests.length} data subject rights request(s) received`]
  const overdue = inputs.dsrRequests.filter((r) => r.status === 'overdue').length
  const completed = inputs.dsrRequests.filter((r) => r.status === 'completed').length
  if (completed > 0) dsrFindings.push(`${completed} request(s) completed`)
  if (overdue > 0) dsrFindings.push(`${overdue} request(s) are overdue — immediate response required`)
  sections.push({ title: 'Data Subject Rights', findings: dsrFindings })

  // Vendors
  const vendorFindings: string[] = [
    `${inputs.vendors.filter((v) => v.status === 'active').length} active vendor(s)/subprocessors registered`,
  ]
  const highRisk = inputs.vendors.filter(
    (v) => v.status === 'active' && (v.riskLevel === 'high' || v.riskLevel === 'critical'),
  ).length
  const contractsReviewed = inputs.vendors.filter(
    (v) => v.status === 'active' && v.contractReviewed,
  ).length
  if (highRisk > 0) vendorFindings.push(`${highRisk} high/critical-risk vendor(s) identified`)
  if (contractsReviewed > 0) vendorFindings.push(`${contractsReviewed} vendor contract(s) reviewed`)
  sections.push({ title: 'Vendor Risk', findings: vendorFindings })

  // Evidence Statement
  sections.push({
    title: 'Evidence Statement',
    findings: [
      'This report is generated from a system with immutable audit logging. All actions are recorded with timestamps and attribution.',
      `Report generated at: ${new Date().toISOString()}`,
      'Framework: Quebec Law 25 (An Act to modernize legislative provisions as regards the protection of personal information)',
    ],
  })

  return sections
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a structured compliance report for an org.
 * Performs a single batch load then derives all report fields — no N+1.
 */
export async function generateComplianceReport(orgId: string): Promise<ComplianceReport> {
  const [inputs, programs] = await Promise.all([
    fetchComplianceInputs(orgId),
    listTrustcorePrivacyPrograms(orgId),
  ])

  const evaluation = evaluateComplianceFromInputs(orgId, inputs)

  const activeProgram = programs.find((p) => p.status === 'active') ?? null

  const risksByCategory = ALL_CATEGORIES.reduce<Record<RiskCategory, RiskItem[]>>(
    (acc, cat) => {
      acc[cat] = evaluation.risks.filter((r) => r.category === cat)
      return acc
    },
    { governance: [], data: [], pia: [], incident: [], dsr: [], vendor: [] },
  )

  const blockingRisks = evaluation.risks.filter((r) => r.blocking)

  const sections = buildNarrativeSections(evaluation, inputs)
  const auditReadyStatement = buildAuditReadyStatement(
    evaluation.score,
    evaluation.confidence,
    blockingRisks.length,
  )

  return {
    generatedAt: new Date().toISOString(),
    framework: 'law-25',
    orgId,
    score: evaluation.score,
    confidence: evaluation.confidence,
    status: evaluation.status,
    auditReadyStatement,
    risksByCategory,
    blockingRisks,
    totalRisks: evaluation.risks.length,
    blockingCount: blockingRisks.length,
    summary: evaluation.summary,
    sections,
    evaluation,
    inputs,
    privacyOfficerName: activeProgram?.privacyOfficerName ?? null,
    privacyOfficerEmail: activeProgram?.privacyOfficerEmail ?? null,
    privacyOfficerRole: activeProgram?.privacyOfficerRole ?? null,
    programStatus: activeProgram?.status ?? null,
    lastReviewedAt: activeProgram?.lastReviewedAt?.toISOString() ?? null,
    evaluatedAt: evaluation.evaluatedAt,
  }
}

// Re-export for convenience
export { CATEGORY_NAMES }
