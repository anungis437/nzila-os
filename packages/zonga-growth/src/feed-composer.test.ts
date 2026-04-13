import { describe, it, expect, vi } from 'vitest'
import {
  composeFeed,
  formatRelativeTime,
} from './feed-composer'
import type {
  RawFeedActivity,
  FeedEnrichmentPort,
  ActorProfile,
  ContentPreview,
  EnrichedFeedItem,
} from './feed-composer'

// ── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date('2025-06-01T12:00:00Z').getTime()

function makeActivity(overrides: Partial<RawFeedActivity> = {}): RawFeedActivity {
  return {
    id: 'act-1',
    userId: 'u1',
    activityType: 'listened',
    contentId: 'track-1',
    entityType: 'track',
    metadata: {},
    createdAt: new Date(NOW - 30 * 60 * 1000).toISOString(), // 30 min ago
    ...overrides,
  }
}

function makeActor(userId: string): ActorProfile {
  return { userId, displayName: `User ${userId}`, avatarUrl: null, isVerified: false }
}

function makeContent(contentId: string): ContentPreview {
  return { contentId, contentType: 'track', title: `Track ${contentId}`, subtitle: null, imageUrl: null }
}

function makeEnrichment(
  actors: Map<string, ActorProfile> = new Map(),
  content: Map<string, ContentPreview> = new Map(),
): FeedEnrichmentPort {
  return {
    resolveActors: vi.fn(async () => actors),
    resolveContent: vi.fn(async () => content),
  }
}

// ── formatRelativeTime ──────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps in the future', () => {
    expect(formatRelativeTime(NOW + 5000, NOW)).toBe('just now')
  })

  it('returns "just now" for < 60 seconds', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe('just now')
  })

  it('returns minutes', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('5m ago')
  })

  it('returns hours', () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3h ago')
  })

  it('returns "yesterday"', () => {
    expect(formatRelativeTime(NOW - 24 * 3_600_000, NOW)).toBe('yesterday')
  })

  it('returns days', () => {
    expect(formatRelativeTime(NOW - 4 * 24 * 3_600_000, NOW)).toBe('4d ago')
  })

  it('returns weeks', () => {
    expect(formatRelativeTime(NOW - 14 * 24 * 3_600_000, NOW)).toBe('2w ago')
  })

  it('returns formatted date for > 4 weeks', () => {
    const old = NOW - 60 * 24 * 3_600_000 // ~2 months
    const result = formatRelativeTime(old, NOW)
    // Should be a month/day string like "Apr 2"
    expect(result).toMatch(/\w+ \d+/)
  })
})

// ── composeFeed ─────────────────────────────────────────────────────────────

describe('composeFeed', () => {
  it('enriches and returns activities in time buckets', async () => {
    const activities = [makeActivity()]
    const actorMap = new Map([['u1', makeActor('u1')]])
    const contentMap = new Map([['track-1', makeContent('track-1')]])
    const enrichment = makeEnrichment(actorMap, contentMap)

    const sections = await composeFeed(
      { activities, feedType: 'following', limit: 10 },
      enrichment,
      NOW,
    )

    expect(sections.length).toBeGreaterThan(0)
    const item = sections[0].items[0]
    expect(item.actor?.userId).toBe('u1')
    expect(item.content?.contentId).toBe('track-1')
    expect(item.activityType).toBe('listened')
  })

  it('deduplicates same user + action + content within 1 hour', async () => {
    const activities = [
      makeActivity({ id: 'a1', createdAt: new Date(NOW - 10 * 60_000).toISOString() }),
      makeActivity({ id: 'a2', createdAt: new Date(NOW - 20 * 60_000).toISOString() }),
    ]
    const enrichment = makeEnrichment(
      new Map([['u1', makeActor('u1')]]),
      new Map([['track-1', makeContent('track-1')]]),
    )

    const sections = await composeFeed({ activities, feedType: 'following', limit: 10 }, enrichment, NOW)
    const allItems = sections.flatMap((s) => s.items)
    expect(allItems).toHaveLength(1) // deduplicated
  })

  it('groups similar activities on same content', async () => {
    const activities = [
      makeActivity({ id: 'a1', userId: 'u1', createdAt: new Date(NOW - 5 * 60_000).toISOString() }),
      makeActivity({ id: 'a2', userId: 'u2', createdAt: new Date(NOW - 10 * 60_000).toISOString() }),
      makeActivity({ id: 'a3', userId: 'u3', createdAt: new Date(NOW - 15 * 60_000).toISOString() }),
    ]
    const actorMap = new Map([
      ['u1', makeActor('u1')],
      ['u2', makeActor('u2')],
      ['u3', makeActor('u3')],
    ])
    const contentMap = new Map([['track-1', makeContent('track-1')]])
    const enrichment = makeEnrichment(actorMap, contentMap)

    const sections = await composeFeed({ activities, feedType: 'following', limit: 10 }, enrichment, NOW)
    const allItems = sections.flatMap((s) => s.items)
    // 3 users liked same track → grouped into 1 item
    expect(allItems).toHaveLength(1)
    expect(allItems[0].type).toBe('grouped')
    expect(allItems[0].groupCount).toBe(3)
    expect(allItems[0].groupedActors).toHaveLength(3)
  })

  it('interleaves trending + recommendation cards for "for-you" feed', async () => {
    // Create 6 activities (should trigger card insertion at position 5)
    const activities = Array.from({ length: 6 }, (_, i) =>
      makeActivity({
        id: `a${i}`,
        userId: `u${i}`,
        contentId: `track-${i}`,
        createdAt: new Date(NOW - i * 10 * 60_000).toISOString(),
      }),
    )
    const actorMap = new Map(activities.map((a) => [a.userId, makeActor(a.userId)]))
    const contentMap = new Map(activities.map((a) => [a.contentId!, makeContent(a.contentId!)]))
    const enrichment = makeEnrichment(actorMap, contentMap)

    const trendingCard: EnrichedFeedItem = {
      id: 'trend-1', type: 'trending', actor: null, activityType: 'trending',
      content: null, timestamp: new Date(NOW).toISOString(), relativeTime: 'just now', metadata: {},
    }

    const sections = await composeFeed(
      { activities, feedType: 'for-you', limit: 20, trendingItems: [trendingCard] },
      enrichment,
      NOW,
    )

    const allItems = sections.flatMap((s) => s.items)
    const hasTrending = allItems.some((i) => i.type === 'trending')
    expect(hasTrending).toBe(true)
  })

  it('prepends trending items for "trending" feed type', async () => {
    const activities = [makeActivity()]
    const enrichment = makeEnrichment(
      new Map([['u1', makeActor('u1')]]),
      new Map([['track-1', makeContent('track-1')]]),
    )
    const trendingCard: EnrichedFeedItem = {
      id: 'trend-1', type: 'trending', actor: null, activityType: 'trending',
      content: null, timestamp: new Date(NOW + 1000).toISOString(), relativeTime: 'just now', metadata: {},
    }

    const sections = await composeFeed(
      { activities, feedType: 'trending', limit: 10, trendingItems: [trendingCard] },
      enrichment,
      NOW,
    )
    const allItems = sections.flatMap((s) => s.items)
    expect(allItems.length).toBeGreaterThanOrEqual(2) // trending + activity
  })

  it('respects limit', async () => {
    const activities = Array.from({ length: 20 }, (_, i) =>
      makeActivity({
        id: `a${i}`,
        userId: `u${i}`,
        contentId: `track-${i}`,
        createdAt: new Date(NOW - i * 60_000).toISOString(),
      }),
    )
    const actorMap = new Map(activities.map((a) => [a.userId, makeActor(a.userId)]))
    const contentMap = new Map(activities.map((a) => [a.contentId!, makeContent(a.contentId!)]))
    const enrichment = makeEnrichment(actorMap, contentMap)

    const sections = await composeFeed({ activities, feedType: 'following', limit: 5 }, enrichment, NOW)
    const allItems = sections.flatMap((s) => s.items)
    expect(allItems.length).toBeLessThanOrEqual(5)
  })

  it('buckets items into time sections', async () => {
    const activities = [
      makeActivity({ id: 'a1', userId: 'u1', contentId: 'c1', createdAt: new Date(NOW - 10 * 60_000).toISOString() }),
      makeActivity({ id: 'a2', userId: 'u2', contentId: 'c2', createdAt: new Date(NOW - 5 * 3_600_000).toISOString() }),
      makeActivity({ id: 'a3', userId: 'u3', contentId: 'c3', createdAt: new Date(NOW - 30 * 3_600_000).toISOString() }),
    ]
    const actorMap = new Map(activities.map((a) => [a.userId, makeActor(a.userId)]))
    const contentMap = new Map(activities.map((a) => [a.contentId!, makeContent(a.contentId!)]))
    const enrichment = makeEnrichment(actorMap, contentMap)

    const sections = await composeFeed({ activities, feedType: 'following', limit: 10 }, enrichment, NOW)
    const labels = sections.map((s) => s.label)
    // First should be "Just now" (10 min), then "Earlier today" (5h), then "Yesterday" (30h)
    expect(labels).toContain('Just now')
    expect(labels).toContain('Earlier today')
    expect(labels).toContain('Yesterday')
  })

  it('handles activities without content', async () => {
    const activities = [
      makeActivity({ id: 'a1', contentId: null }),
    ]
    const enrichment = makeEnrichment(new Map([['u1', makeActor('u1')]]), new Map())

    const sections = await composeFeed({ activities, feedType: 'following', limit: 10 }, enrichment, NOW)
    const allItems = sections.flatMap((s) => s.items)
    expect(allItems[0].content).toBeNull()
  })
})
