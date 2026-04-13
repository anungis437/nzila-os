/**
 * Tests for audit/abr.ts — ABR Audit Taxonomy
 */
import { describe, it, expect } from 'vitest'
import {
  AbrAuditAction,
  AbrEntityType,
  buildAbrAuditEvent,
  validateAbrAuditEvent,
  type AbrAuditEvent,
  type BuildAbrAuditOpts,
} from '../abr'

describe('AbrAuditAction', () => {
  it('defines all expected case lifecycle actions', () => {
    expect(AbrAuditAction.CASE_CREATED).toBe('abr.case.created')
    expect(AbrAuditAction.CASE_UPDATED).toBe('abr.case.updated')
    expect(AbrAuditAction.CASE_STATUS_TRANSITIONED).toBe('abr.case.status_transitioned')
    expect(AbrAuditAction.CASE_ASSIGNED).toBe('abr.case.assigned')
    expect(AbrAuditAction.CASE_CLOSED).toBe('abr.case.closed')
  })

  it('defines decision lifecycle actions', () => {
    expect(AbrAuditAction.DECISION_ISSUED).toBe('abr.decision.issued')
    expect(AbrAuditAction.DECISION_APPEALED).toBe('abr.decision.appealed')
  })

  it('defines export/reporting actions', () => {
    expect(AbrAuditAction.EXPORT_GENERATED).toBe('abr.export.generated')
    expect(AbrAuditAction.COMPLIANCE_REPORT_CREATED).toBe('abr.compliance_report.created')
  })

  it('defines evidence actions', () => {
    expect(AbrAuditAction.EVIDENCE_ATTACHED).toBe('abr.evidence.attached')
    expect(AbrAuditAction.EVIDENCE_SEALED).toBe('abr.evidence.sealed')
  })

  it('defines integration and AI/ML actions', () => {
    expect(AbrAuditAction.INTEGRATION_SENT).toBe('abr.integration.sent')
    expect(AbrAuditAction.INTEGRATION_FAILED).toBe('abr.integration.failed')
    expect(AbrAuditAction.AI_CLASSIFICATION_RUN).toBe('abr.ai.classification_run')
    expect(AbrAuditAction.AI_RISK_ASSESSMENT_RUN).toBe('abr.ai.risk_assessment_run')
    expect(AbrAuditAction.ML_PREDICTION_RUN).toBe('abr.ml.prediction_run')
  })

  it('defines auth/access actions', () => {
    expect(AbrAuditAction.ACCESS_DENIED).toBe('abr.access.denied')
    expect(AbrAuditAction.RBAC_ROLE_CHANGED).toBe('abr.rbac.role_changed')
  })
})

describe('AbrEntityType', () => {
  it('defines all entity types', () => {
    expect(AbrEntityType.CASE).toBe('abr_case')
    expect(AbrEntityType.DECISION).toBe('abr_decision')
    expect(AbrEntityType.EVIDENCE_BUNDLE).toBe('abr_evidence_bundle')
    expect(AbrEntityType.COMPLIANCE_REPORT).toBe('abr_compliance_report')
    expect(AbrEntityType.EXPORT).toBe('abr_export')
    expect(AbrEntityType.USER).toBe('abr_user')
  })
})

describe('buildAbrAuditEvent', () => {
  const validOpts: BuildAbrAuditOpts = {
    action: AbrAuditAction.CASE_CREATED,
    orgId: 'org-123',
    actorId: 'user-456',
    correlationId: 'corr-789',
    entityType: AbrEntityType.CASE,
    subjectId: 'case-001',
  }

  it('builds a complete audit event with required fields', () => {
    const event = buildAbrAuditEvent(validOpts)

    expect(event.action).toBe('abr.case.created')
    expect(event.orgId).toBe('org-123')
    expect(event.actorId).toBe('user-456')
    expect(event.appId).toBe('abr')
    expect(event.correlationId).toBe('corr-789')
    expect(event.entityType).toBe('abr_case')
    expect(event.subjectId).toBe('case-001')
    expect(event.timestamp).toBeTruthy()
    expect(new Date(event.timestamp).getTime()).not.toBeNaN()
  })

  it('includes optional state transitions', () => {
    const event = buildAbrAuditEvent({
      ...validOpts,
      fromState: 'open',
      toState: 'closed',
    })

    expect(event.fromState).toBe('open')
    expect(event.toState).toBe('closed')
  })

  it('includes optional metadata', () => {
    const event = buildAbrAuditEvent({
      ...validOpts,
      metadata: { severity: 'high', region: 'NAM' },
    })

    expect(event.metadata).toEqual({ severity: 'high', region: 'NAM' })
  })

  it('leaves optional fields undefined when not provided', () => {
    const event = buildAbrAuditEvent(validOpts)
    expect(event.fromState).toBeUndefined()
    expect(event.toState).toBeUndefined()
    expect(event.metadata).toBeUndefined()
  })
})

describe('validateAbrAuditEvent', () => {
  const validEvent: AbrAuditEvent = {
    action: AbrAuditAction.CASE_CREATED,
    orgId: 'org-123',
    actorId: 'user-456',
    appId: 'abr',
    correlationId: 'corr-789',
    entityType: AbrEntityType.CASE,
    subjectId: 'case-001',
    timestamp: new Date().toISOString(),
  }

  it('returns empty array for valid event', () => {
    expect(validateAbrAuditEvent(validEvent)).toEqual([])
  })

  it('reports missing orgId', () => {
    const errors = validateAbrAuditEvent({ ...validEvent, orgId: '' } as AbrAuditEvent)
    expect(errors).toContain('orgId is required')
  })

  it('reports missing actorId', () => {
    const errors = validateAbrAuditEvent({ ...validEvent, actorId: '' } as AbrAuditEvent)
    expect(errors).toContain('actorId is required')
  })

  it('reports wrong appId', () => {
    const errors = validateAbrAuditEvent({ ...validEvent, appId: 'wrong' as 'abr' })
    expect(errors).toContain('appId must be "abr"')
  })

  it('reports missing correlationId', () => {
    const errors = validateAbrAuditEvent({ ...validEvent, correlationId: '' } as AbrAuditEvent)
    expect(errors).toContain('correlationId is required')
  })

  it('reports unknown action', () => {
    const errors = validateAbrAuditEvent({ ...validEvent, action: 'invalid.action' as AbrAuditAction })
    expect(errors).toContain('Unknown action: invalid.action')
  })

  it('reports unknown entityType', () => {
    const errors = validateAbrAuditEvent({ ...validEvent, entityType: 'invalid_type' as any })
    expect(errors).toContain('Unknown entityType: invalid_type')
  })

  it('reports missing timestamp', () => {
    const errors = validateAbrAuditEvent({ ...validEvent, timestamp: '' } as AbrAuditEvent)
    expect(errors).toContain('timestamp is required')
  })

  it('reports multiple issues at once', () => {
    const errors = validateAbrAuditEvent({
      ...validEvent,
      orgId: '',
      actorId: '',
      correlationId: '',
    } as AbrAuditEvent)
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })
})
