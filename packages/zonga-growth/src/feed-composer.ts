/**
 * @nzila/zonga-growth — Feed Composer
 *
 * Transforms raw UserActivity rows into rich, grouped, and
 * interleaved feed items. Supports multiple feed types:
 * following, trending, and combined "for you" feeds.
 *
 * @module @nzila/zonga-growth/feed-composer
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface RawFeedActivity {
  readonly id: string
  readonly userId: string
  readonly activityType: string
  readonly contentId: string | null
  readonly entityType: string | null
  readonly metadata: Readonly<Record<string, unknown>>
  readonly createdAt: string // ISO 8601
}

export interface ActorProfile {
  readonly userId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly isVerified: boolean
}

export interface ContentPreview {
  readonly contentId: string
  readonly contentType: string
  readonly title: string
  readonly subtitle: string | null
  readonly imageUrl: string | null
}

export interface EnrichedFeedItem {
  readonly id: string
  readonly type: 'activity' | 'grouped' | 'recommendation' | 'trending'
  readonly actor: ActorProfile | null
  readonly activityType: string
  readonly content: ContentPreview | null
  readonly timestamp: string
  readonly relativeTime: string
  readonly groupedActors?: readonly ActorProfile[]
  readonly groupCount?: number
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface FeedSection {
  readonly label: string       // e.g. "Just now", "Earlier today", "Yesterday"
  readonly items: readonly EnrichedFeedItem[]
}

export type FeedType = 'following' | 'trending' | 'for-you'

export interface ComposeFeedParams {
  readonly activities: readonly RawFeedActivity[]
  readonly feedType: FeedType
  readonly limit: number
  readonly trendingItems?: readonly EnrichedFeedItem[]
  readonly recommendationCards?: readonly EnrichedFeedItem[]
}

/**
 * Port for resolving actor profiles and content previews.
 */
export interface FeedEnrichmentPort {
  readonly resolveActors: (userIds: readonly string[]) => Promise<ReadonlyMap<string, ActorProfile>>
  readonly resolveContent: (contentIds: readonly string[]) => Promise<ReadonlyMap<string, ContentPreview>>
}

// ── Feed Composition ────────────────────────────────────────────────────────

/**
 * Compose a rich, grouped, and interleaved feed from raw activities.
 */
export async function composeFeed(
  params: ComposeFeedParams,
  enrichment: FeedEnrichmentPort,
  now: number = Date.now(),
): Promise<readonly FeedSection[]> {
  const { activities, feedType, limit, trendingItems = [], recommendationCards = [] } = params

  // 1. Deduplicate (same user + same action + same content within 1 hour)
  const deduped = deduplicateActivities(activities)

  // 2. Resolve actor profiles and content previews in parallel
  const userIds = [...new Set(deduped.map((a) => a.userId))]
  const contentIds = [...new Set(deduped.filter((a) => a.contentId).map((a) => a.contentId!))]

  const [actorMap, contentMap] = await Promise.all([
    enrichment.resolveActors(userIds),
    enrichment.resolveContent(contentIds),
  ])

  // 3. Enrich activities
  const enriched = deduped.map((activity) => enrichActivity(activity, actorMap, contentMap, now))

  // 4. Group similar activities (e.g. "John and 3 others liked this track")
  const grouped = groupSimilarActivities(enriched)

  // 5. Interleave non-activity cards based on feed type
  let finalItems: EnrichedFeedItem[]
  if (feedType === 'for-you') {
    finalItems = interleaveFeed(grouped, trendingItems, recommendationCards)
  } else if (feedType === 'trending') {
    finalItems = [...(trendingItems as EnrichedFeedItem[]), ...grouped]
  } else {
    finalItems = grouped
  }

  // 6. Limit
  const limited = finalItems.slice(0, limit)

  // 7. Bucket into time sections
  return bucketByTime(limited, now)
}

// ── Activity Enrichment ─────────────────────────────────────────────────────

function enrichActivity(
  activity: RawFeedActivity,
  actorMap: ReadonlyMap<string, ActorProfile>,
  contentMap: ReadonlyMap<string, ContentPreview>,
  now: number,
): EnrichedFeedItem {
  const actor = actorMap.get(activity.userId) ?? null
  const content = activity.contentId ? (contentMap.get(activity.contentId) ?? null) : null

  return {
    id: activity.id,
    type: 'activity',
    actor,
    activityType: activity.activityType,
    content,
    timestamp: activity.createdAt,
    relativeTime: formatRelativeTime(new Date(activity.createdAt).getTime(), now),
    metadata: activity.metadata,
  }
}

// ── Deduplication ───────────────────────────────────────────────────────────

function deduplicateActivities(
  activities: readonly RawFeedActivity[],
): RawFeedActivity[] {
  const seen = new Map<string, RawFeedActivity>()
  const ONE_HOUR = 3_600_000

  for (const activity of activities) {
    const key = `${activity.userId}:${activity.activityType}:${activity.contentId ?? ''}`
    const existing = seen.get(key)

    if (existing) {
      const existingTime = new Date(existing.createdAt).getTime()
      const activityTime = new Date(activity.createdAt).getTime()
      if (Math.abs(existingTime - activityTime) < ONE_HOUR) {
        // Keep the more recent one
        if (activityTime > existingTime) {
          seen.set(key, activity)
        }
        continue
      }
    }

    seen.set(key, activity)
  }

  return Array.from(seen.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// ── Grouping ────────────────────────────────────────────────────────────────

/**
 * Group activities of the same type on the same content.
 * e.g., "Alice, Bob, and 3 others liked Track X"
 */
function groupSimilarActivities(items: EnrichedFeedItem[]): EnrichedFeedItem[] {
  const groups = new Map<string, EnrichedFeedItem[]>()
  const ungrouped: EnrichedFeedItem[] = []

  for (const item of items) {
    if (item.content) {
      const key = `${item.activityType}:${item.content.contentId}`
      let group = groups.get(key)
      if (!group) {
        group = []
        groups.set(key, group)
      }
      group.push(item)
    } else {
      ungrouped.push(item)
    }
  }

  const result: EnrichedFeedItem[] = []

  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0]!)
    } else {
      // Create grouped item — primary actor is the most recent
      const sorted = group.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      const primary = sorted[0]!
      const actors = sorted
        .map((i) => i.actor)
        .filter((a): a is ActorProfile => a !== null)

      result.push({
        ...primary,
        type: 'grouped',
        groupedActors: actors.slice(0, 5), // Show up to 5 actor avatars
        groupCount: group.length,
      })
    }
  }

  result.push(...ungrouped)

  // Re-sort by timestamp
  return result.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

// ── Interleaving ────────────────────────────────────────────────────────────

/**
 * Interleave trending and recommendation cards into the activity feed.
 * Pattern: every 5th item is a non-activity card.
 */
function interleaveFeed(
  activities: readonly EnrichedFeedItem[],
  trending: readonly EnrichedFeedItem[],
  recommendations: readonly EnrichedFeedItem[],
): EnrichedFeedItem[] {
  const result: EnrichedFeedItem[] = []
  const cards = [...trending, ...recommendations]
  let cardIdx = 0

  for (let i = 0; i < activities.length; i++) {
    result.push(activities[i]!)

    // Insert a card every 5 activity items
    if ((i + 1) % 5 === 0 && cardIdx < cards.length) {
      result.push(cards[cardIdx]!)
      cardIdx++
    }
  }

  return result
}

// ── Time Bucketing ──────────────────────────────────────────────────────────

function bucketByTime(
  items: readonly EnrichedFeedItem[],
  now: number,
): FeedSection[] {
  const ONE_HOUR = 3_600_000
  const ONE_DAY = 24 * ONE_HOUR
  const ONE_WEEK = 7 * ONE_DAY

  const buckets = new Map<string, EnrichedFeedItem[]>()
  const bucketOrder: string[] = []

  for (const item of items) {
    const ts = new Date(item.timestamp).getTime()
    const age = now - ts

    let label: string
    if (age < ONE_HOUR) {
      label = 'Just now'
    } else if (age < ONE_DAY) {
      label = 'Earlier today'
    } else if (age < 2 * ONE_DAY) {
      label = 'Yesterday'
    } else if (age < ONE_WEEK) {
      label = 'This week'
    } else {
      label = 'Earlier'
    }

    let bucket = buckets.get(label)
    if (!bucket) {
      bucket = []
      buckets.set(label, bucket)
      bucketOrder.push(label)
    }
    bucket.push(item)
  }

  return bucketOrder.map((label) => ({
    label,
    items: buckets.get(label)!,
  }))
}

// ── Relative Time Formatting ────────────────────────────────────────────────

/**
 * Format a timestamp relative to now. Returns strings like:
 * "just now", "5m ago", "2h ago", "yesterday", "3d ago", "2w ago"
 */
export function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp
  if (diff < 0) return 'just now'

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`

  return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
