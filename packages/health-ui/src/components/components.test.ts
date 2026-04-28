import React from 'react'
import { describe, expect, it } from 'vitest'
import { ConsentBadge, IntegrationCard, PatientHeader, SyntheticBanner, TimelineCard } from '../index'

function toText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child) => toText(child)).join('')
  if (React.isValidElement(node)) return toText(node.props.children)
  return ''
}

describe('health-ui components', () => {
  it('renders patient header with synthetic warning by default', () => {
    const element = PatientHeader({
      mrn: 'MRN-001',
      firstName: 'Amina',
      lastName: 'Njeri',
      dateOfBirth: '1988-05-10',
      gender: 'F',
    })

    const text = toText(element)
    expect(text).toContain('Synthetic clinical demo data')
    expect(text).toContain('Amina Njeri')
    expect(text).toContain('MRN: MRN-001')
  })

  it('renders consent badge status and scoped aria label', () => {
    const element = ConsentBadge({ status: 'break-glass', scope: 'HIV records' })

    expect(element.props['aria-label']).toContain('Break-Glass Access')
    expect(element.props['aria-label']).toContain('HIV records')
    expect(toText(element)).toContain('Break-Glass Access')
  })

  it('renders timeline metadata and flags', () => {
    const element = TimelineCard({
      date: '2026-01-10',
      category: 'lab',
      title: 'CD4 Panel',
      summary: 'Routine follow-up panel',
      provider: 'Dr K',
      facility: 'Nairobi General',
      source: 'EMR',
      flags: ['critical', 'review'],
    })

    const text = toText(element)
    expect(text).toContain('CD4 Panel')
    expect(text).toContain('Routine follow-up panel')
    expect(text).toContain('critical')
    expect(text).toContain('review')
  })

  it('renders integration status and diagnostics', () => {
    const element = IntegrationCard({
      name: 'FHIR Bridge',
      status: 'degraded',
      lastChecked: '2026-02-10T10:00:00Z',
      latencyMs: 900,
      message: 'Intermittent timeouts',
    })

    expect(element.props['aria-label']).toContain('FHIR Bridge')
    expect(element.props.className).toContain('integration-card--degraded')
    const text = toText(element)
    expect(text).toContain('900ms')
    expect(text).toContain('Intermittent timeouts')
  })

  it('uses default synthetic banner message when no message is provided', () => {
    const element = SyntheticBanner({})
    expect(toText(element)).toContain('Synthetic clinical demo data')
    expect(element.props.role).toBe('alert')
  })
})
