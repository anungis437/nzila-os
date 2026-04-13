import { z } from 'zod'

// ── Audit Timeline ──────────────────────────────────────

export type GovernanceEventType =
  | 'policy_evaluated'
  | 'compliance_check'
  | 'evidence_exported'
  | 'approval_granted'
  | 'approval_denied'
  | 'drift_detected'
  | 'remediation_applied'
  | 'workflow_created'
  | 'workflow_step_executed'
  | 'recommendation_generated'
  | 'revenue_event_recorded'
  | 'revenue_payout_issued'
  | 'revenue_fee_collected'

export interface AuditTimelineEntry {
  id: string
  timestamp: string
  eventType: GovernanceEventType
  actor: string
  orgId: string
  app: string
  policyResult: 'pass' | 'fail' | 'warn'
  commitHash: string
  details?: Record<string, unknown>
}

export const auditTimelineEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  eventType: z.enum([
    'policy_evaluated',
    'compliance_check',
    'evidence_exported',
    'approval_granted',
    'approval_denied',
    'drift_detected',
    'remediation_applied',
    'workflow_created',
    'workflow_step_executed',
    'recommendation_generated',
  ]),
  actor: z.string().min(1),
  orgId: z.string().min(1),
  app: z.string().min(1),
  policyResult: z.enum(['pass', 'fail', 'warn']),
  commitHash: z.string().min(1),
  details: z.record(z.unknown()).optional(),
})

// ── Governance Status ───────────────────────────────────

export type ComplianceLevel = 'full' | 'partial' | 'non_compliant'

export interface AppComplianceStatus {
  app: string
  hasSbom: boolean
  hasPolicyEngine: boolean
  hasEvidencePack: boolean
  hasHealthEndpoint: boolean
  hasMetricsEndpoint: boolean
  hasTests: boolean
  complianceLevel: ComplianceLevel
  lastChecked: string
}

export interface GovernanceStatusReport {
  timestamp: string
  commitHash: string
  overallCompliance: ComplianceLevel
  apps: AppComplianceStatus[]
  driftDetected: boolean
  findings: GovernanceFinding[]
}

export interface GovernanceFinding {
  app: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
}

export const appComplianceStatusSchema = z.object({
  app: z.string(),
  hasSbom: z.boolean(),
  hasPolicyEngine: z.boolean(),
  hasEvidencePack: z.boolean(),
  hasHealthEndpoint: z.boolean(),
  hasMetricsEndpoint: z.boolean(),
  hasTests: z.boolean(),
  complianceLevel: z.enum(['full', 'partial', 'non_compliant']),
  lastChecked: z.string().datetime(),
})

export const governanceStatusReportSchema = z.object({
  timestamp: z.string().datetime(),
  commitHash: z.string(),
  overallCompliance: z.enum(['full', 'partial', 'non_compliant']),
  apps: z.array(appComplianceStatusSchema),
  driftDetected: z.boolean(),
  findings: z.array(
    z.object({
      app: z.string(),
      category: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      message: z.string(),
    }),
  ),
})

// ── Governance Status (aggregated) ──────────────────────

export type PolicyEngineHealth = 'healthy' | 'degraded' | 'missing'
export type EvidencePackHealth = 'verified' | 'degraded' | 'missing'
export type ComplianceSnapshotHealth = 'current' | 'stale' | 'missing'
export type AuditTimelineHealth = 'healthy' | 'degraded'

export interface GovernanceStatus {
  policy_engine: PolicyEngineHealth
  evidence_pack: EvidencePackHealth
  sbom_current: boolean
  compliance_snapshot: ComplianceSnapshotHealth
  audit_timeline: AuditTimelineHealth
  generated_at: string
}

export const governanceStatusSchema = z.object({
  policy_engine: z.enum(['healthy', 'degraded', 'missing']),
  evidence_pack: z.enum(['verified', 'degraded', 'missing']),
  sbom_current: z.boolean(),
  compliance_snapshot: z.enum(['current', 'stale', 'missing']),
  audit_timeline: z.enum(['healthy', 'degraded']),
  generated_at: z.string().datetime(),
})

// ── Governance Audit Timeline Entry ─────────────────────

export interface GovernanceAuditTimelineEntry {
  timestamp: string
  event_type: GovernanceEventType
  actor: string
  policy_result: 'pass' | 'fail' | 'warn'
  commit_hash: string
  source: string
}

export const governanceAuditTimelineEntrySchema = z.object({
  timestamp: z.string().datetime(),
  event_type: z.enum([
    'policy_evaluated',
    'compliance_check',
    'evidence_exported',
    'approval_granted',
    'approval_denied',
    'drift_detected',
    'remediation_applied',
    'revenue_event_recorded',
    'revenue_payout_issued',
    'revenue_fee_collected',
  ]),
  actor: z.string(),
  policy_result: z.enum(['pass', 'fail', 'warn']),
  commit_hash: z.string(),
  source: z.string(),
})
