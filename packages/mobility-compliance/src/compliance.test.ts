/**
 * @nzila/mobility-compliance — Workflow & Risk Tests
 *
 * Tests the compliance workflow FSM and risk scoring engine.
 * All functions are pure (mock Date for timestamp assertions).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getNextStep,
  deriveCaseStatus,
  initWorkflow,
  advanceWorkflow,
  COMPLIANCE_WORKFLOW_STEPS,
} from './workflows'
import type { ComplianceWorkflowState } from './workflows'
import { computeRiskScore, requiresTwoStepApproval } from './risk'
import type { RiskSignal } from './risk'
import { buildEvidenceEntry, buildEvidencePack } from './evidence'

// ── Workflow Tests ──────────────────────────────────────────────────────────

describe('Compliance Workflows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getNextStep', () => {
    it('returns kyc_intake for empty steps', () => {
      expect(getNextStep([])).toBe('kyc_intake')
    })

    it('returns next incomplete step', () => {
      expect(getNextStep(['kyc_intake'])).toBe('aml_screening')
      expect(getNextStep(['kyc_intake', 'aml_screening'])).toBe('pep_check')
    })

    it('returns null when all steps completed', () => {
      expect(getNextStep([...COMPLIANCE_WORKFLOW_STEPS])).toBeNull()
    })

    it('skips completed steps regardless of order', () => {
      expect(getNextStep(['kyc_intake', 'pep_check'])).toBe('aml_screening')
    })
  })

  describe('initWorkflow', () => {
    it('creates initial state with kyc_intake', () => {
      const state = initWorkflow('case-001')
      expect(state.caseId).toBe('case-001')
      expect(state.currentStep).toBe('kyc_intake')
      expect(state.completedSteps).toEqual([])
      expect(state.blockers).toEqual([])
      expect(state.riskScore).toBe(0)
    })
  })

  describe('deriveCaseStatus', () => {
    it('returns kyc_pending for kyc_intake step', () => {
      const state = initWorkflow('case-001')
      expect(deriveCaseStatus(state)).toBe('kyc_pending')
    })

    it('returns aml_screening for aml step', () => {
      const state: ComplianceWorkflowState = {
        ...initWorkflow('case-001'),
        currentStep: 'aml_screening',
        completedSteps: ['kyc_intake'],
      }
      expect(deriveCaseStatus(state)).toBe('aml_screening')
    })

    it('returns compliance_review when critical blocker exists', () => {
      const state: ComplianceWorkflowState = {
        ...initWorkflow('case-001'),
        currentStep: 'aml_screening',
        blockers: [{
          step: 'kyc_intake',
          reason: 'Failed verification',
          severity: 'critical',
          createdAt: new Date(),
        }],
      }
      expect(deriveCaseStatus(state)).toBe('compliance_review')
    })

    it('returns compliance_review when currentStep is compliance_approval', () => {
      // Even with all steps completed, currentStep=compliance_approval → compliance_review
      const state: ComplianceWorkflowState = {
        ...initWorkflow('case-001'),
        currentStep: 'compliance_approval',
        completedSteps: [...COMPLIANCE_WORKFLOW_STEPS],
      }
      expect(deriveCaseStatus(state)).toBe('compliance_review')
    })

    it('returns document_verification for document verification step', () => {
      const state: ComplianceWorkflowState = {
        ...initWorkflow('case-001'),
        currentStep: 'document_verification',
        completedSteps: ['kyc_intake', 'aml_screening', 'pep_check', 'source_of_funds_review'],
      }
      expect(deriveCaseStatus(state)).toBe('document_verification')
    })

    it('returns approved after all steps completed and currentStep advances past last', () => {
      // When completedSteps has all 6 steps and currentStep is not a named check
      const state: ComplianceWorkflowState = {
        ...initWorkflow('case-001'),
        currentStep: 'pep_check', // any step not in the explicit checks
        completedSteps: [...COMPLIANCE_WORKFLOW_STEPS],
      }
      // Falls through status mapping to completedSteps length check → approved
      expect(deriveCaseStatus(state)).toBe('approved')
    })
  })

  describe('advanceWorkflow', () => {
    it('moves to next step on pass', () => {
      const state = initWorkflow('case-001')
      const result = advanceWorkflow(state, {
        passed: true,
        eventType: 'kyc_completed',
        severity: 'info',
        details: {},
      })
      expect(result.currentStep).toBe('aml_screening')
      expect(result.completedSteps).toContain('kyc_intake')
    })

    it('adds blocker on failure', () => {
      const state = initWorkflow('case-001')
      const result = advanceWorkflow(state, {
        passed: false,
        eventType: 'compliance_rejected',
        severity: 'warning',
        details: { reason: 'Document expired' },
      })
      expect(result.blockers).toHaveLength(1)
      expect(result.blockers[0]!.reason).toBe('Document expired')
      expect(result.currentStep).toBe('kyc_intake') // stays on same step
    })

    it('increases risk score on failure', () => {
      const state = initWorkflow('case-001')
      const result = advanceWorkflow(state, {
        passed: false,
        eventType: 'aml_flag',
        severity: 'critical',
        details: { reason: 'PEP match' },
      })
      expect(result.riskScore).toBe(40) // critical penalty
    })

    it('caps risk score at 100', () => {
      const state: ComplianceWorkflowState = {
        ...initWorkflow('case-001'),
        riskScore: 80,
      }
      const result = advanceWorkflow(state, {
        passed: false,
        eventType: 'aml_flag',
        severity: 'critical',
        details: {},
      })
      expect(result.riskScore).toBe(100)
    })

    it('does not mutate original state', () => {
      const state = initWorkflow('case-001')
      const result = advanceWorkflow(state, {
        passed: true,
        eventType: 'kyc_completed',
        severity: 'info',
        details: {},
      })
      expect(state.completedSteps).toEqual([])
      expect(result.completedSteps).toContain('kyc_intake')
    })

    it('keeps current step unchanged when passing final step (no next step)', () => {
      const state: ComplianceWorkflowState = {
        ...initWorkflow('case-001'),
        currentStep: 'compliance_approval',
        completedSteps: [
          'kyc_intake',
          'aml_screening',
          'pep_check',
          'source_of_funds_review',
          'document_verification',
        ],
      }

      const result = advanceWorkflow(state, {
        passed: true,
        eventType: 'compliance_approved',
        severity: 'info',
        details: {},
      })

      expect(result.currentStep).toBe('compliance_approval')
      expect(result.completedSteps).toHaveLength(6)
    })

    it('adds info-level penalty for info severity failures', () => {
      const state = initWorkflow('case-001')
      const result = advanceWorkflow(state, {
        passed: false,
        eventType: 'kyc_initiated',
        severity: 'info',
        details: {},
      })

      expect(result.riskScore).toBe(5)
    })

    it('returns intake when step is not explicitly mapped and not all steps are complete', () => {
      const state: ComplianceWorkflowState = {
        ...initWorkflow('case-001'),
        currentStep: 'pep_check',
        completedSteps: ['kyc_intake'],
      }

      expect(deriveCaseStatus(state)).toBe('intake')
    })
  })
})

describe('Evidence Pack Builder', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds an evidence entry with optional attachments', () => {
    const entry = buildEvidenceEntry(
      'aml_screening',
      {
        passed: false,
        eventType: 'aml_flag',
        severity: 'warning',
        details: { reason: 'high-risk jurisdiction' },
      },
      'case-123',
      'user-123',
      [{ name: 'report.pdf', mimeType: 'application/pdf', url: 'https://example.com/report.pdf' }],
    )

    expect(entry.stepId).toBe('aml_screening')
    expect(entry.eventType).toBe('aml_flag')
    expect(entry.caseId).toBe('case-123')
    expect(entry.actorId).toBe('user-123')
    expect(entry.attachments).toHaveLength(1)
  })

  it('builds an evidence entry with empty attachments by default', () => {
    const entry = buildEvidenceEntry(
      'kyc_intake',
      {
        passed: true,
        eventType: 'kyc_completed',
        severity: 'info',
        details: {},
      },
      'case-124',
      'user-124',
    )

    expect(entry.attachments).toEqual([])
  })

  it('builds pack summary with pass/fail checks and highest severity', () => {
    const entries = [
      buildEvidenceEntry(
        'kyc_intake',
        { passed: true, eventType: 'kyc_completed', severity: 'info', details: {} },
        'case-200',
        'auditor-1',
      ),
      buildEvidenceEntry(
        'aml_screening',
        { passed: false, eventType: 'aml_flag', severity: 'warning', details: {} },
        'case-200',
        'auditor-1',
      ),
      buildEvidenceEntry(
        'pep_check',
        { passed: false, eventType: 'risk_escalation', severity: 'critical', details: {} },
        'case-200',
        'auditor-1',
      ),
      buildEvidenceEntry(
        'document_verification',
        { passed: true, eventType: 'document_verified', severity: 'info', details: {} },
        'case-200',
        'auditor-1',
      ),
      buildEvidenceEntry(
        'compliance_approval',
        { passed: true, eventType: 'compliance_approved', severity: 'info', details: {} },
        'case-200',
        'auditor-1',
      ),
      buildEvidenceEntry(
        'source_of_funds_review',
        { passed: false, eventType: 'compliance_rejected', severity: 'critical', details: {} },
        'case-200',
        'auditor-1',
      ),
    ]

    const pack = buildEvidencePack('case-200', 'org-200', entries)

    expect(pack.caseId).toBe('case-200')
    expect(pack.orgId).toBe('org-200')
    expect(pack.summary.totalSteps).toBe(6)
    expect(pack.summary.completedSteps).toBe(6)
    expect(pack.summary.passedChecks).toBe(3)
    expect(pack.summary.failedChecks).toBe(3)
    expect(pack.summary.highestSeverity).toBe('critical')
  })

  it('defaults highest severity to info for empty entries', () => {
    const pack = buildEvidencePack('case-empty', 'org-empty', [])
    expect(pack.summary.highestSeverity).toBe('info')
    expect(pack.summary.completedSteps).toBe(0)
    expect(pack.summary.passedChecks).toBe(0)
    expect(pack.summary.failedChecks).toBe(0)
  })
})

// ── Risk Scoring Tests ──────────────────────────────────────────────────────

describe('Risk Scoring', () => {
  const signal = (severity: 'critical' | 'warning' | 'info'): RiskSignal => ({
    source: 'aml',
    severity,
    description: `${severity} signal`,
    timestamp: new Date(),
  })

  describe('computeRiskScore', () => {
    it('returns 0 for no signals', () => {
      const result = computeRiskScore([])
      expect(result.overallScore).toBe(0)
      expect(result.profile).toBe('low')
      expect(result.requiresEscalation).toBe(false)
    })

    it('scores critical signals at 35 points', () => {
      const result = computeRiskScore([signal('critical')])
      expect(result.overallScore).toBe(35)
    })

    it('scores warning signals at 15 points', () => {
      const result = computeRiskScore([signal('warning')])
      expect(result.overallScore).toBe(15)
      expect(result.profile).toBe('medium')
    })

    it('scores info signals at 3 points', () => {
      const result = computeRiskScore([signal('info')])
      expect(result.overallScore).toBe(3)
      expect(result.profile).toBe('low')
    })

    it('caps score at 100', () => {
      const signals = Array.from({ length: 5 }, () => signal('critical'))
      const result = computeRiskScore(signals)
      expect(result.overallScore).toBe(100)
    })

    it('classifies high risk (40-69)', () => {
      const result = computeRiskScore([signal('critical'), signal('warning')])
      expect(result.overallScore).toBe(50)
      expect(result.profile).toBe('high')
      expect(result.requiresEscalation).toBe(true)
    })

    it('classifies critical risk (70+)', () => {
      const result = computeRiskScore([signal('critical'), signal('critical')])
      expect(result.overallScore).toBe(70)
      expect(result.profile).toBe('critical')
      expect(result.requiresEscalation).toBe(true)
    })
  })

  describe('requiresTwoStepApproval', () => {
    it('requires for high risk', () => {
      expect(requiresTwoStepApproval('high')).toBe(true)
    })

    it('requires for critical risk', () => {
      expect(requiresTwoStepApproval('critical')).toBe(true)
    })

    it('does not require for medium risk', () => {
      expect(requiresTwoStepApproval('medium')).toBe(false)
    })

    it('does not require for low risk', () => {
      expect(requiresTwoStepApproval('low')).toBe(false)
    })
  })
})
