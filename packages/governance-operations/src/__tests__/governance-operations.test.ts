import { describe, it, expect } from 'vitest'
import {
  buildPostureCard,
  buildTimelineEntry,
  dominantBanding,
  interpretBanding,
  interpretEnvelope,
  interpretVerdict,
  isSurfaceVisible,
  orderTimeline,
  postureToken,
  REFRESH_CADENCE_MS,
  visibleSurfaces,
} from '../index'

describe('posture', () => {
  it('builds a posture card with citation enforced', () => {
    const card = buildPostureCard({
      id: 'card-1',
      surface: 'control-plane',
      product: 'union-eyes',
      banding: 'stable',
      interpretation: 'Posture is stable.',
      doctrineCitations: [{ document: 'docs/nzila-ip/example.md' }],
      observedAt: '2026-05-09T12:00:00.000Z',
    })
    expect(card.banding).toBe('stable')
  })

  it('refuses a posture card with no doctrine citation', () => {
    expect(() =>
      buildPostureCard({
        id: 'card-1',
        surface: 'control-plane',
        product: 'union-eyes',
        banding: 'stable',
        interpretation: 'Posture is stable.',
        doctrineCitations: [],
        observedAt: '2026-05-09T12:00:00.000Z',
      } as never),
    ).toThrow()
  })

  it('returns the strictest band as dominant', () => {
    expect(dominantBanding(['stable', 'warming', 'concerning'])).toBe('concerning')
    expect(dominantBanding(['stable', 'destabilizing'])).toBe('destabilizing')
    expect(dominantBanding([])).toBe('stable')
  })
})

describe('timeline', () => {
  it('refuses entries derived from forbidden payload keys', () => {
    expect(() =>
      buildTimelineEntry({
        id: 't1',
        occurredAt: '2026-05-09T12:00:00.000Z',
        eventType: 'doctrine_enforcement_event',
        severity: 'warning',
        summary: 'pilot isolation enforced',
        sourcePayload: { userId: 'leak' },
      }),
    ).toThrow(/forbidden_payload_key/)
  })

  it('orders timeline newest-first', () => {
    const a = buildTimelineEntry({
      id: 'a',
      occurredAt: '2026-05-08T12:00:00.000Z',
      eventType: 'governance_event',
      severity: 'info',
      summary: 'a',
    })
    const b = buildTimelineEntry({
      id: 'b',
      occurredAt: '2026-05-09T12:00:00.000Z',
      eventType: 'governance_event',
      severity: 'info',
      summary: 'b',
    })
    expect(orderTimeline([a, b])[0].id).toBe('b')
  })
})

describe('role-model', () => {
  it('grants executives posture but not raw evidence', () => {
    expect(isSurfaceVisible('executive', 'posture-cards')).toBe(true)
    expect(isSurfaceVisible('executive', 'evidence-explorer-full')).toBe(false)
  })

  it('restricts pilot operators to pilot scope', () => {
    expect(isSurfaceVisible('pilot-operator', 'pilot-posture')).toBe(true)
    expect(isSurfaceVisible('pilot-operator', 'production-posture')).toBe(false)
  })

  it('grants procurement observers external attestation bundle only', () => {
    const surfaces = visibleSurfaces('procurement-observer')
    expect(surfaces).toEqual(['external-attestation-bundle'])
  })
})

describe('interpretation', () => {
  it('uses calm language for stable banding', () => {
    expect(interpretBanding('stable')).toMatch(/stable/i)
    expect(interpretBanding('stable')).not.toMatch(/urgent|emergency|critical/i)
  })

  it('reserves blocking language for critical envelopes', () => {
    expect(
      interpretEnvelope({ type: 'doctrine_enforcement_event', severity: 'info' }),
    ).toMatch(/routine/)
    expect(
      interpretEnvelope({ type: 'doctrine_enforcement_event', severity: 'warning' }),
    ).toMatch(/advisory/)
    expect(
      interpretEnvelope({ type: 'doctrine_enforcement_event', severity: 'critical' }),
    ).toMatch(/blocking/)
  })

  it('interprets verdicts honestly', () => {
    expect(interpretVerdict('rejected')).toMatch(/Rejected/)
    expect(interpretVerdict('unknown')).toMatch(/Unknown/)
  })
})

describe('design tokens', () => {
  it('exposes one token per posture band', () => {
    expect(postureToken('stable')).toBe('governance.posture.stable')
    expect(postureToken('destabilizing')).toBe('governance.posture.destabilizing')
  })
  it('refresh cadence is at least one minute', () => {
    expect(REFRESH_CADENCE_MS.dashboard).toBeGreaterThanOrEqual(60_000)
  })
})
