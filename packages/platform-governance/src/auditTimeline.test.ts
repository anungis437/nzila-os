import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordAuditEvent,
  getAuditTimeline,
  clearAuditTimeline,
  buildGovernanceAuditTimeline,
} from '../src/auditTimeline'

describe('auditTimeline', () => {
  beforeEach(() => {
    clearAuditTimeline()
  })

  it('records an audit event with unique ID and timestamp', () => {
    const entry = recordAuditEvent({
      eventType: 'policy_evaluated',
      actor: 'user:admin',
      orgId: 'org-1',
      app: 'shop-quoter',
      policyResult: 'pass',
      commitHash: 'abc123',
    })

    expect(entry.id).toBeTruthy()
    expect(entry.timestamp).toBeTruthy()
    expect(entry.eventType).toBe('policy_evaluated')
    expect(entry.policyResult).toBe('pass')
  })

  it('retrieves timeline filtered by app', () => {
    recordAuditEvent({
      eventType: 'policy_evaluated',
      actor: 'user:admin',
      orgId: 'org-1',
      app: 'shop-quoter',
      policyResult: 'pass',
      commitHash: 'abc123',
    })
    recordAuditEvent({
      eventType: 'compliance_check',
      actor: 'system',
      orgId: 'org-1',
      app: 'cfo',
      policyResult: 'fail',
      commitHash: 'abc123',
    })

    const results = getAuditTimeline({ app: 'cfo' })
    expect(results).toHaveLength(1)
    expect(results[0].app).toBe('cfo')
  })

  it('sorts timeline newest first', () => {
    recordAuditEvent({
      eventType: 'policy_evaluated',
      actor: 'user:a',
      orgId: 'org-1',
      app: 'web',
      policyResult: 'pass',
      commitHash: 'a1',
    })
    recordAuditEvent({
      eventType: 'compliance_check',
      actor: 'user:b',
      orgId: 'org-1',
      app: 'web',
      policyResult: 'warn',
      commitHash: 'a2',
    })

    const results = getAuditTimeline({ app: 'web' })
    expect(new Date(results[0].timestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(results[1].timestamp).getTime(),
    )
  })

  it('clears timeline', () => {
    recordAuditEvent({
      eventType: 'drift_detected',
      actor: 'ci',
      orgId: 'org-1',
      app: 'partners',
      policyResult: 'fail',
      commitHash: 'x1',
    })
    clearAuditTimeline()
    expect(getAuditTimeline()).toHaveLength(0)
  })

  it('builds governance audit timeline with structured entries', () => {
    recordAuditEvent({
      eventType: 'policy_evaluated',
      actor: 'user:admin',
      orgId: 'org-1',
      app: 'shop-quoter',
      policyResult: 'pass',
      commitHash: 'abc123',
    })
    recordAuditEvent({
      eventType: 'evidence_exported',
      actor: 'system',
      orgId: 'org-1',
      app: 'cfo',
      policyResult: 'pass',
      commitHash: 'def456',
    })

    const timeline = buildGovernanceAuditTimeline({ orgId: 'org-1' })
    expect(timeline).toHaveLength(2)
    expect(timeline[0]).toMatchObject({
      event_type: expect.any(String),
      actor: expect.any(String),
      policy_result: expect.any(String),
      commit_hash: expect.any(String),
      source: expect.any(String),
    })
  })

  it('buildGovernanceAuditTimeline is deterministic in ordering', () => {
    recordAuditEvent({
      eventType: 'policy_evaluated',
      actor: 'a',
      orgId: 'org-1',
      app: 'web',
      policyResult: 'pass',
      commitHash: 'c1',
    })
    recordAuditEvent({
      eventType: 'compliance_check',
      actor: 'b',
      orgId: 'org-1',
      app: 'web',
      policyResult: 'warn',
      commitHash: 'c2',
    })

    const t1 = buildGovernanceAuditTimeline()
    const t2 = buildGovernanceAuditTimeline()
    expect(t1.map((e) => e.timestamp)).toEqual(t2.map((e) => e.timestamp))
  })

  it('filters timeline by eventType and since date', () => {
    recordAuditEvent({
      eventType: 'policy_evaluated',
      actor: 'seed',
      orgId: 'org-2',
      app: 'web',
      policyResult: 'pass',
      commitHash: 'seed-1',
    })

    const afterFirst = new Date().toISOString()

    recordAuditEvent({
      eventType: 'drift_detected',
      actor: 'seed',
      orgId: 'org-2',
      app: 'web',
      policyResult: 'fail',
      commitHash: 'seed-2',
    })

    const eventFiltered = getAuditTimeline({ eventType: 'drift_detected' })
    expect(eventFiltered).toHaveLength(1)
    expect(eventFiltered[0].eventType).toBe('drift_detected')

    const sinceFiltered = getAuditTimeline({ since: afterFirst })
    expect(sinceFiltered.length).toBeGreaterThanOrEqual(1)
    expect(sinceFiltered.some((entry) => entry.commitHash === 'seed-2')).toBe(true)
  })
})
