import { describe, it, expect } from 'vitest'

import {
  ENVELOPE_SCHEMA_VERSION,
  validateGovernanceEvent,
  safeValidateGovernanceEvent,
  getEventDefinition,
  listEventDefinitions,
  meetsSeverityFloor,
} from '../index'

const baseEvent = {
  id: '01HXAMPLE000000000000000',
  schemaVersion: ENVELOPE_SCHEMA_VERSION,
  type: 'continuity_posture_changed' as const,
  severity: 'info' as const,
  scope: {
    product: 'union-eyes' as const,
    environment: 'ue-pilot-2026q2',
    environmentClass: 'pilot' as const,
  },
  subject: { kind: 'surface' as const, id: 'ue/cases/list' },
  releaseId: 'UE-2026-05-09-001',
  emittedAt: '2026-05-09T12:00:00.000Z',
  payload: { fromBand: 'stable', toBand: 'warming' },
}

describe('governance-telemetry envelope', () => {
  it('accepts a well-formed info event without doctrine citation', () => {
    expect(() => validateGovernanceEvent(baseEvent)).not.toThrow()
  })

  it('requires doctrine citation for warning severity and above', () => {
    const result = safeValidateGovernanceEvent({
      ...baseEvent,
      type: 'governance_warning',
      severity: 'warning',
    })
    expect(result.success).toBe(false)
  })

  it('accepts warning event with doctrine citation', () => {
    const result = safeValidateGovernanceEvent({
      ...baseEvent,
      type: 'governance_warning',
      severity: 'warning',
      doctrineCitations: [{ document: 'docs/nzila-ip/continuity-doctrine.md' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects payloads with individual-resolving keys', () => {
    const result = safeValidateGovernanceEvent({
      ...baseEvent,
      payload: { userId: 'abc', count: 3 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown event types', () => {
    const result = safeValidateGovernanceEvent({
      ...baseEvent,
      type: 'definitely_not_real',
    })
    expect(result.success).toBe(false)
  })

  it('rejects malformed timestamps', () => {
    const result = safeValidateGovernanceEvent({
      ...baseEvent,
      emittedAt: 'not-a-time',
    })
    expect(result.success).toBe(false)
  })
})

describe('governance-telemetry registry', () => {
  it('returns a definition for every taxonomy event type', () => {
    const defs = listEventDefinitions()
    expect(defs.length).toBeGreaterThan(0)
    for (const def of defs) {
      expect(getEventDefinition(def.type)).toEqual(def)
    }
  })

  it('throws on unknown event types', () => {
    expect(() => getEventDefinition('not_real' as never)).toThrow()
  })

  it('enforces severity floor', () => {
    expect(meetsSeverityFloor('deployment_legitimacy_failure', 'critical')).toBe(true)
    expect(meetsSeverityFloor('deployment_legitimacy_failure', 'warning')).toBe(false)
    expect(meetsSeverityFloor('deployment_legitimacy_failure', 'info')).toBe(false)
    expect(meetsSeverityFloor('continuity_posture_changed', 'info')).toBe(true)
  })
})
