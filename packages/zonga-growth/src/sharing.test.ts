import { describe, it, expect, vi } from 'vitest'
import {
  buildDeepLink,
  computeViralityMetrics,
  ShareIntentSchema,
} from './sharing'
import type { SharedContent, DeepLinkParams } from './sharing'

function makeShare(overrides: Partial<SharedContent> = {}): SharedContent {
  return {
    id: 's1',
    orgId: 'o1',
    sharerId: 'u1',
    shareType: 'track',
    contentId: 'a1',
    deepLink: 'https://zonga.app/track/a1?ref=s1',
    platform: 'whatsapp',
    clickCount: 5,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── buildDeepLink ────────────────────────────────────────────────────────────

describe('buildDeepLink', () => {
  it('builds correct track deep link', () => {
    const url = buildDeepLink({
      baseUrl: 'https://zonga.app',
      shareType: 'track',
      contentId: 'a1',
      shareId: 's1',
    })
    expect(url).toContain('/track/a1')
    expect(url).toContain('ref=s1')
  })

  it('builds correct playlist deep link', () => {
    const url = buildDeepLink({
      baseUrl: 'https://zonga.app',
      shareType: 'playlist',
      contentId: 'pl1',
      shareId: 's2',
    })
    expect(url).toContain('/playlist/pl1')
  })

  it('includes UTM parameters when provided', () => {
    const url = buildDeepLink({
      baseUrl: 'https://zonga.app',
      shareType: 'event',
      contentId: 'e1',
      shareId: 's3',
      utm: { source: 'whatsapp', medium: 'social', campaign: 'launch' },
    })
    expect(url).toContain('utm_source=whatsapp')
    expect(url).toContain('utm_medium=social')
    expect(url).toContain('utm_campaign=launch')
  })

  it('omits missing UTM fields', () => {
    const url = buildDeepLink({
      baseUrl: 'https://zonga.app',
      shareType: 'artist',
      contentId: 'ar1',
      shareId: 's4',
      utm: { source: 'twitter' },
    })
    expect(url).toContain('utm_source=twitter')
    expect(url).not.toContain('utm_medium')
    expect(url).not.toContain('utm_campaign')
  })
})

// ── computeViralityMetrics ───────────────────────────────────────────────────

describe('computeViralityMetrics', () => {
  it('returns zeros for empty shares', () => {
    const result = computeViralityMetrics([])
    expect(result).toEqual({
      totalShares: 0,
      totalClicks: 0,
      clickThroughRate: 0,
      topPlatform: null,
      topContent: null,
    })
  })

  it('computes correct metrics', () => {
    const shares = [
      makeShare({ clickCount: 10, platform: 'whatsapp', contentId: 'a1' }),
      makeShare({ clickCount: 5, platform: 'whatsapp', contentId: 'a1' }),
      makeShare({ clickCount: 3, platform: 'twitter', contentId: 'a2' }),
    ]
    const result = computeViralityMetrics(shares)

    expect(result.totalShares).toBe(3)
    expect(result.totalClicks).toBe(18)
    expect(result.clickThroughRate).toBe(6)
    expect(result.topPlatform).toBe('whatsapp')
    expect(result.topContent).toEqual({ contentId: 'a1', shares: 2 })
  })

  it('handles shares with no platform', () => {
    const shares = [makeShare({ platform: null, clickCount: 1 })]
    const result = computeViralityMetrics(shares)
    expect(result.topPlatform).toBeNull()
    expect(result.totalShares).toBe(1)
  })
})

// ── ShareIntentSchema ────────────────────────────────────────────────────────

describe('ShareIntentSchema', () => {
  it('validates a correct share intent', () => {
    const result = ShareIntentSchema.safeParse({
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      sharerId: '550e8400-e29b-41d4-a716-446655440001',
      shareType: 'track',
      contentId: '550e8400-e29b-41d4-a716-446655440002',
      platform: 'whatsapp',
    })
    expect(result.success).toBe(true)
  })

  it('allows optional platform', () => {
    const result = ShareIntentSchema.safeParse({
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      sharerId: '550e8400-e29b-41d4-a716-446655440001',
      shareType: 'playlist',
      contentId: '550e8400-e29b-41d4-a716-446655440002',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid shareType', () => {
    const result = ShareIntentSchema.safeParse({
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      sharerId: '550e8400-e29b-41d4-a716-446655440001',
      shareType: 'invalid',
      contentId: '550e8400-e29b-41d4-a716-446655440002',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid orgId', () => {
    const result = ShareIntentSchema.safeParse({
      orgId: 'not-a-uuid',
      sharerId: '550e8400-e29b-41d4-a716-446655440001',
      shareType: 'track',
      contentId: '550e8400-e29b-41d4-a716-446655440002',
    })
    expect(result.success).toBe(false)
  })
})
