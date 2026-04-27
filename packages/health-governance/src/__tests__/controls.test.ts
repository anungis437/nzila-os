import { describe, it, expect } from 'vitest'
import { VERIDIAN_CONTROL_MATRIX } from '../controls.js'
import { buildPilotReadinessReport } from '../pilot-readiness.js'
import { ControlStatus } from '../types.js'
import type { PilotReadinessItem } from '../types.js'

describe('VERIDIAN_CONTROL_MATRIX', () => {
  it('has exactly 8 entries', () => {
    expect(VERIDIAN_CONTROL_MATRIX.length).toBe(8)
  })

  it('each entry has all required fields', () => {
    for (const row of VERIDIAN_CONTROL_MATRIX) {
      expect(typeof row.control).toBe('string')
      expect(row.control.length).toBeGreaterThan(0)
      expect(typeof row.description).toBe('string')
      expect(typeof row.evidenceSource).toBe('string')
      expect(typeof row.cadence).toBe('string')
      expect(typeof row.ownerRole).toBe('string')
      expect(Object.values(ControlStatus)).toContain(row.status)
    }
  })

  it('includes a privacy review control', () => {
    const privacyControl = VERIDIAN_CONTROL_MATRIX.find((r) =>
      r.control.toLowerCase().includes('privacy'),
    )
    expect(privacyControl).toBeDefined()
  })

  it('includes a consent logging control', () => {
    const consentControl = VERIDIAN_CONTROL_MATRIX.find((r) =>
      r.control.toLowerCase().includes('consent'),
    )
    expect(consentControl).toBeDefined()
  })
})

describe('buildPilotReadinessReport', () => {
  it('overallReady is true when all items are ready', () => {
    const items: PilotReadinessItem[] = [
      { item: 'Consent logging active', status: 'ready' },
      { item: 'RBAC configured', status: 'ready' },
    ]
    const report = buildPilotReadinessReport('org-001', 'site-001', items)
    expect(report.overallReady).toBe(true)
    expect(report.organizationId).toBe('org-001')
    expect(report.siteId).toBe('site-001')
  })

  it('overallReady is false when any item is not ready', () => {
    const items: PilotReadinessItem[] = [
      { item: 'Consent logging active', status: 'ready' },
      { item: 'Privacy review', status: 'not-ready', notes: 'PIA pending' },
    ]
    const report = buildPilotReadinessReport('org-001', 'site-001', items)
    expect(report.overallReady).toBe(false)
  })

  it('generatedAt is an ISO string', () => {
    const report = buildPilotReadinessReport('org-001', 'site-001', [])
    expect(() => new Date(report.generatedAt)).not.toThrow()
  })
})
