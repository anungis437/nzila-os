import { describe, it, expect, beforeEach } from 'vitest'
import {
  assessAppCompliance,
  generateFindings,
  buildGovernanceReport,
  getGovernanceStatus,
} from '../src/governanceStatus'
import { recordAuditEvent, clearAuditTimeline } from '../src/auditTimeline'
import {
  governanceStatusSchema,
  governanceStatusReportSchema,
  governanceAuditTimelineEntrySchema,
} from '../src/types'
import * as governance from '../src'

describe('governanceStatus', () => {
  beforeEach(() => {
    clearAuditTimeline()
  })
  it('returns full compliance when all checks pass', () => {
    const status = assessAppCompliance({
      name: 'shop-quoter',
      hasSbom: true,
      hasPolicyEngine: true,
      hasEvidencePack: true,
      hasHealthEndpoint: true,
      hasMetricsEndpoint: true,
      hasTests: true,
    })

    expect(status.complianceLevel).toBe('full')
    expect(status.app).toBe('shop-quoter')
  })

  it('returns partial compliance when ≥50% checks pass', () => {
    const status = assessAppCompliance({
      name: 'cfo',
      hasSbom: true,
      hasPolicyEngine: true,
      hasEvidencePack: true,
      hasHealthEndpoint: false,
      hasMetricsEndpoint: false,
      hasTests: false,
    })

    expect(status.complianceLevel).toBe('partial')
  })

  it('returns non_compliant when <50% checks pass', () => {
    const status = assessAppCompliance({
      name: 'web',
      hasSbom: false,
      hasPolicyEngine: false,
      hasEvidencePack: false,
      hasHealthEndpoint: true,
      hasMetricsEndpoint: false,
      hasTests: true,
    })

    expect(status.complianceLevel).toBe('non_compliant')
  })

  it('generates findings for missing capabilities', () => {
    const status = assessAppCompliance({
      name: 'partners',
      hasSbom: false,
      hasPolicyEngine: true,
      hasEvidencePack: true,
      hasHealthEndpoint: true,
      hasMetricsEndpoint: true,
      hasTests: true,
    })

    const findings = generateFindings([status])
    expect(findings).toHaveLength(1)
    expect(findings[0].category).toBe('sbom')
    expect(findings[0].severity).toBe('high')
  })

  it('builds governance report with overall compliance', () => {
    const statuses = [
      assessAppCompliance({
        name: 'shop-quoter',
        hasSbom: true,
        hasPolicyEngine: true,
        hasEvidencePack: true,
        hasHealthEndpoint: true,
        hasMetricsEndpoint: true,
        hasTests: true,
      }),
      assessAppCompliance({
        name: 'cfo',
        hasSbom: false,
        hasPolicyEngine: true,
        hasEvidencePack: true,
        hasHealthEndpoint: true,
        hasMetricsEndpoint: true,
        hasTests: true,
      }),
    ]

    const report = buildGovernanceReport(statuses, 'abc123')
    expect(report.overallCompliance).toBe('partial')
    expect(report.driftDetected).toBe(true)
    expect(report.findings.length).toBeGreaterThan(0)
    expect(report.commitHash).toBe('abc123')
  })

  it('builds non_compliant report when any app is non-compliant', () => {
    const report = buildGovernanceReport(
      [
        assessAppCompliance({
          name: 'healthy-app',
          hasSbom: true,
          hasPolicyEngine: true,
          hasEvidencePack: true,
          hasHealthEndpoint: true,
          hasMetricsEndpoint: true,
          hasTests: true,
        }),
        assessAppCompliance({
          name: 'broken-app',
          hasSbom: false,
          hasPolicyEngine: false,
          hasEvidencePack: false,
          hasHealthEndpoint: false,
          hasMetricsEndpoint: false,
          hasTests: false,
        }),
      ],
      'deadbeef',
    )

    expect(report.overallCompliance).toBe('non_compliant')
    expect(report.driftDetected).toBe(true)
  })

  it('getGovernanceStatus returns healthy when all systems are up', () => {
    recordAuditEvent({
      eventType: 'compliance_check',
      actor: 'system',
      orgId: 'org-1',
      app: 'web',
      policyResult: 'pass',
      commitHash: 'abc',
    })

    const status = getGovernanceStatus({
      policyEngineAvailable: true,
      evidencePackValid: true,
      sbomExists: true,
      complianceSnapshotAge: 'current',
    })

    expect(status.policy_engine).toBe('healthy')
    expect(status.evidence_pack).toBe('verified')
    expect(status.sbom_current).toBe(true)
    expect(status.compliance_snapshot).toBe('current')
    expect(status.audit_timeline).toBe('healthy')
    expect(status.generated_at).toBeTruthy()
  })

  it('getGovernanceStatus returns degraded when systems are down', () => {
    const status = getGovernanceStatus({
      policyEngineAvailable: false,
      evidencePackValid: false,
      sbomExists: false,
    })

    expect(status.policy_engine).toBe('missing')
    expect(status.evidence_pack).toBe('missing')
    expect(status.sbom_current).toBe(false)
    expect(status.compliance_snapshot).toBe('missing')
    expect(status.audit_timeline).toBe('degraded')
  })

  it('getGovernanceStatus preserves stale compliance snapshot when provided', () => {
    const status = getGovernanceStatus({
      policyEngineAvailable: true,
      evidencePackValid: true,
      sbomExists: true,
      complianceSnapshotAge: 'stale',
    })

    expect(status.compliance_snapshot).toBe('stale')
  })

  it('validates governance schemas and barrel exports', () => {
    const status = getGovernanceStatus({
      policyEngineAvailable: true,
      evidencePackValid: true,
      sbomExists: true,
      complianceSnapshotAge: 'current',
    })

    const parsedStatus = governanceStatusSchema.safeParse(status)
    expect(parsedStatus.success).toBe(true)

    const report = buildGovernanceReport(
      [
        assessAppCompliance({
          name: 'shop-quoter',
          hasSbom: true,
          hasPolicyEngine: true,
          hasEvidencePack: true,
          hasHealthEndpoint: true,
          hasMetricsEndpoint: true,
          hasTests: true,
        }),
      ],
      'cafebabe',
    )

    const parsedReport = governanceStatusReportSchema.safeParse(report)
    expect(parsedReport.success).toBe(true)

    const parsedTimeline = governanceAuditTimelineEntrySchema.safeParse({
      timestamp: new Date().toISOString(),
      event_type: 'policy_evaluated',
      actor: 'tester',
      policy_result: 'pass',
      commit_hash: 'cafebabe',
      source: 'web',
    })
    expect(parsedTimeline.success).toBe(true)

    expect(typeof governance.validateAppCompliance).toBe('function')
    expect(typeof governance.buildGovernanceReport).toBe('function')
  })
})
