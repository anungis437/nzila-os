import { describe, expect, it, vi } from 'vitest'

import {
  composeFeed,
  formatRelativeTime,
  type RawFeedActivity,
  type FeedEnrichmentPort,
  type ActorProfile,
  type ContentPreview,
} from './feed-composer'

import {
  generateReferralCode,
  validateReferralCode,
  calculateReward,
  computeReferralStats,
  DEFAULT_REFERRAL_CONFIG,
  type ReferralCode,
  type ReferralConversion,
} from './referral'

// ── Feed Composer ───────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps less than 60s ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3h ago')
  })

  it('returns "yesterday"', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 36 * 3_600_000, now)).toBe('yesterday')
  })

  it('returns days ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 4 * 86_400_000, now)).toBe('4d ago')
  })

  it('returns weeks ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 14 * 86_400_000, now)).toBe('2w ago')
  })

  it('returns date for very old timestamps', () => {
    const now = Date.now()
    const old = now - 60 * 86_400_000
    const result = formatRelativeTime(old, now)
    // Should be a month/day format like "Mar 15"
    expect(result).toMatch(/\w+ \d+/)
  })

  it('handles future timestamps', () => {
    const now = Date.now()
    expect(formatRelativeTime(now + 60_000, now)).toBe('just now')
  })
})

describe('composeFeed', () => {
  const now = Date.now()

  function makeActivity(id: string, userId: string, type: string, contentId: string | null, minutesAgo: number): RawFeedActivity {
    return {
      id,
      userId,
      activityType: type,
      contentId,
      entityType: contentId ? 'track' : null,
      metadata: {},
      createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
    }
  }

  const mockEnrichment: FeedEnrichmentPort = {
    resolveActors: vi.fn(async (userIds: readonly string[]) => {
      const map = new Map<string, ActorProfile>()
      for (const uid of userIds) {
        map.set(uid, { userId: uid, displayName: `User ${uid}`, avatarUrl: null, isVerified: false })
      }
      return map
    }),
    resolveContent: vi.fn(async (contentIds: readonly string[]) => {
      const map = new Map<string, ContentPreview>()
      for (const cid of contentIds) {
        map.set(cid, { contentId: cid, contentType: 'track', title: `Track ${cid}`, subtitle: null, imageUrl: null })
      }
      return map
    }),
  }

  it('composes a following feed with time-bucketed sections', async () => {
    const activities: RawFeedActivity[] = [
      makeActivity('a1', 'u1', 'play', 'track-1', 5),    // 5 min ago
      makeActivity('a2', 'u2', 'like', 'track-2', 30),    // 30 min ago
      makeActivity('a3', 'u3', 'share', 'track-3', 180),  // 3 hours ago
    ]

    const sections = await composeFeed(
      { activities, feedType: 'following', limit: 50 },
      mockEnrichment,
      now,
    )

    expect(sections.length).toBeGreaterThanOrEqual(1)
    const allItems = sections.flatMap((s) => s.items)
    expect(allItems).toHaveLength(3)
    // Each item should be enriched with actor and content
    expect(allItems[0]!.actor).not.toBeNull()
    expect(allItems[0]!.content).not.toBeNull()
  })

  it('deduplicates same user + action + content within 1 hour', async () => {
    const activities: RawFeedActivity[] = [
      makeActivity('a1', 'u1', 'play', 'track-1', 5),
      makeActivity('a2', 'u1', 'play', 'track-1', 10), // duplicate (same user, action, content within 1h)
      makeActivity('a3', 'u2', 'play', 'track-1', 15), // different user — NOT a duplicate
    ]

    const sections = await composeFeed(
      { activities, feedType: 'following', limit: 50 },
      mockEnrichment,
      now,
    )

    const allItems = sections.flatMap((s) => s.items)
    // Should have 2 items (u1 deduplicated, u2 kept)
    // But they may be grouped since same activityType + same content
    expect(allItems.length).toBeLessThanOrEqual(2)
  })

  it('respects limit', async () => {
    const activities: RawFeedActivity[] = Array.from({ length: 20 }, (_, i) =>
      makeActivity(`a${i}`, `u${i}`, 'play', `track-${i}`, i + 1),
    )

    const sections = await composeFeed(
      { activities, feedType: 'following', limit: 5 },
      mockEnrichment,
      now,
    )

    const allItems = sections.flatMap((s) => s.items)
    expect(allItems.length).toBeLessThanOrEqual(5)
  })
})

// ── Referral ────────────────────────────────────────────────────────────────

describe('generateReferralCode', () => {
  it('generates a 6-character alphanumeric code', () => {
    const code = generateReferralCode('test-salt')
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })

  it('generates different codes for different salts', () => {
    const a = generateReferralCode('salt-a')
    const b = generateReferralCode('salt-b')
    expect(a).not.toBe(b)
  })

  it('excludes ambiguous characters (0, O, 1, I, L)', () => {
    // Generate many codes to increase coverage
    const codes = Array.from({ length: 50 }, (_, i) => generateReferralCode(`salt-${i}`))
    const allChars = codes.join('')
    expect(allChars).not.toContain('0')
    expect(allChars).not.toContain('O')
    expect(allChars).not.toContain('1')
    expect(allChars).not.toContain('I')
    expect(allChars).not.toContain('L')
  })
})

describe('validateReferralCode', () => {
  const base: ReferralCode = {
    code: 'ABCDEF',
    referrerId: 'referrer-1',
    orgId: 'org-1',
    campaignId: null,
    createdAt: '2025-01-01T00:00:00Z',
    expiresAt: null,
    maxUses: null,
    currentUses: 0,
    isActive: true,
  }

  it('validates a valid code', () => {
    const result = validateReferralCode(base, 'new-user')
    expect(result.valid).toBe(true)
    expect(result.code).toBeDefined()
  })

  it('rejects null code', () => {
    const result = validateReferralCode(null, 'user')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('rejects inactive code', () => {
    const result = validateReferralCode({ ...base, isActive: false }, 'user')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('no longer active')
  })

  it('rejects expired code', () => {
    const expired = { ...base, expiresAt: '2020-01-01T00:00:00Z' }
    const result = validateReferralCode(expired, 'user')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('expired')
  })

  it('rejects maxed-out code', () => {
    const maxed = { ...base, maxUses: 5, currentUses: 5 }
    const result = validateReferralCode(maxed, 'user')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('maximum uses')
  })

  it('prevents self-referral', () => {
    const result = validateReferralCode(base, 'referrer-1')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('own referral')
  })
})

describe('calculateReward', () => {
  it('returns correct rewards for each conversion type', () => {
    const signup = calculateReward('signup', DEFAULT_REFERRAL_CONFIG)
    expect(signup).not.toBeNull()
    expect(signup!.referrerReward).toBe(0)
    expect(signup!.referreeReward).toBe(0)

    const firstStream = calculateReward('first_stream', DEFAULT_REFERRAL_CONFIG)
    expect(firstStream).not.toBeNull()
    expect(firstStream!.referrerReward).toBe(50)
    expect(firstStream!.referreeReward).toBe(25)

    const sub = calculateReward('subscription', DEFAULT_REFERRAL_CONFIG)
    expect(sub).not.toBeNull()
    expect(sub!.referrerReward).toBe(500)
    expect(sub!.referreeReward).toBe(250)
    expect(sub!.currency).toBe('USD')
  })
})

describe('computeReferralStats', () => {
  it('computes referrer statistics', () => {
    const conversions: ReferralConversion[] = [
      { id: '1', orgId: 'org-1', referralCode: 'ABC', referrerId: 'ref-1', referredUserId: 'u1', convertedAt: '2025-01-01', conversionType: 'signup', rewardStatus: 'paid', rewardAmount: 100, rewardCurrency: 'USD' },
      { id: '2', orgId: 'org-1', referralCode: 'ABC', referrerId: 'ref-1', referredUserId: 'u2', convertedAt: '2025-01-02', conversionType: 'first_stream', rewardStatus: 'eligible', rewardAmount: 50, rewardCurrency: 'USD' },
      { id: '3', orgId: 'org-1', referralCode: 'ABC', referrerId: 'ref-1', referredUserId: 'u3', convertedAt: '2025-01-03', conversionType: 'signup', rewardStatus: 'pending', rewardAmount: 100, rewardCurrency: 'USD' },
    ]

    const stats = computeReferralStats('ref-1', conversions)
    expect(stats.referrerId).toBe('ref-1')
    expect(stats.totalReferrals).toBe(3)
    expect(stats.successfulConversions).toBe(2) // paid + eligible
    expect(stats.pendingConversions).toBe(1)
    expect(stats.totalEarned).toBe(150) // 100 + 50 from paid+eligible
    expect(stats.conversionRate).toBeCloseTo(66.67, 1) // 2/3
    expect(stats.topConversionType).toBe('signup') // 2 signups
  })

  it('handles empty conversions', () => {
    const stats = computeReferralStats('ref-1', [])
    expect(stats.totalReferrals).toBe(0)
    expect(stats.conversionRate).toBe(0)
    expect(stats.topConversionType).toBeNull()
  })
})
