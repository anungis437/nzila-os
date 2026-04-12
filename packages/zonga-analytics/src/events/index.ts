/**
 * Analytics event creation — typed event constructors for play, skip, search, share, session.
 */
import { z } from 'zod'

// ── Types ───────────────────────────────────────────────────────────────────

export type EngagementLevel = 'passive' | 'active' | 'power' | 'superfan'

export interface AnalyticsEvent {
  id: string
  type: string
  orgId: string
  userId: string | null
  timestamp: number
  properties: Record<string, unknown>
}

export interface PlayEvent extends AnalyticsEvent {
  type: 'play'
  properties: {
    assetId: string
    creatorId: string
    durationMs: number
    positionMs: number
    completionPercent: number
    quality: string
    country?: string
    deviceType?: string
    isComplete: boolean
    source: 'search' | 'recommendation' | 'playlist' | 'direct' | 'share' | 'radio'
  }
}

export interface SkipEvent extends AnalyticsEvent {
  type: 'skip'
  properties: {
    assetId: string
    creatorId: string
    positionMs: number
    durationMs: number
    skipPercent: number
    reason?: 'manual' | 'queue_next' | 'dislike'
  }
}

export interface SearchEvent extends AnalyticsEvent {
  type: 'search'
  properties: {
    query: string
    resultCount: number
    selectedIndex: number | null
    selectedAssetId: string | null
    latencyMs: number
  }
}

export interface ShareEvent extends AnalyticsEvent {
  type: 'share'
  properties: {
    entityType: 'track' | 'playlist' | 'artist' | 'event'
    contentId: string
    platform: 'whatsapp' | 'twitter' | 'facebook' | 'copy_link' | 'other'
    deepLink: string
  }
}

export interface SessionEvent extends AnalyticsEvent {
  type: 'session_start' | 'session_end'
  properties: {
    sessionId: string
    durationMs?: number
    tracksPlayed?: number
    searchCount?: number
    deviceType?: string
    country?: string
  }
}

// ── Schemas ─────────────────────────────────────────────────────────────────

export const playEventSchema = z.object({
  assetId: z.string().uuid(),
  creatorId: z.string().uuid(),
  durationMs: z.number().int().nonnegative(),
  positionMs: z.number().int().nonnegative(),
  completionPercent: z.number().min(0).max(100),
  quality: z.string(),
  country: z.string().max(3).optional(),
  deviceType: z.string().max(50).optional(),
  isComplete: z.boolean(),
  source: z.enum(['search', 'recommendation', 'playlist', 'direct', 'share', 'radio']),
})

export const skipEventSchema = z.object({
  assetId: z.string().uuid(),
  creatorId: z.string().uuid(),
  positionMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  reason: z.enum(['manual', 'queue_next', 'dislike']).optional(),
})

// ── Event Constructors ──────────────────────────────────────────────────────

let eventCounter = 0

function nextEventId(): string {
  eventCounter++
  return `evt_${Date.now()}_${eventCounter}`
}

export function createPlayEvent(
  orgId: string,
  userId: string | null,
  props: PlayEvent['properties']
): PlayEvent {
  return {
    id: nextEventId(),
    type: 'play',
    orgId,
    userId,
    timestamp: Date.now(),
    properties: {
      ...props,
      skipPercent: undefined as never, // Not applicable for play events
    },
  }
}

export function createSkipEvent(
  orgId: string,
  userId: string | null,
  props: Omit<SkipEvent['properties'], 'skipPercent'>
): SkipEvent {
  const skipPercent = props.durationMs > 0
    ? Math.round((props.positionMs / props.durationMs) * 10000) / 100
    : 0

  return {
    id: nextEventId(),
    type: 'skip',
    orgId,
    userId,
    timestamp: Date.now(),
    properties: { ...props, skipPercent },
  }
}

export function createSearchEvent(
  orgId: string,
  userId: string | null,
  props: SearchEvent['properties']
): SearchEvent {
  return {
    id: nextEventId(),
    type: 'search',
    orgId,
    userId,
    timestamp: Date.now(),
    properties: props,
  }
}

export function createShareEvent(
  orgId: string,
  userId: string | null,
  props: ShareEvent['properties']
): ShareEvent {
  return {
    id: nextEventId(),
    type: 'share',
    orgId,
    userId,
    timestamp: Date.now(),
    properties: props,
  }
}

export function createSessionEvent(
  orgId: string,
  userId: string | null,
  type: 'session_start' | 'session_end',
  props: SessionEvent['properties']
): SessionEvent {
  return {
    id: nextEventId(),
    type,
    orgId,
    userId,
    timestamp: Date.now(),
    properties: props,
  }
}

// ── Engagement Classification ───────────────────────────────────────────────

/**
 * Classify a user's engagement level based on their activity in a time window.
 *
 * Thresholds:
 * - passive: < 3 plays/day
 * - active: 3-10 plays/day
 * - power: 10-30 plays/day
 * - superfan: > 30 plays/day (or > 5 shares, or follows > 10 artists)
 */
export function classifyEngagement(metrics: {
  playsPerDay: number
  sharesPerWeek: number
  followedArtists: number
  sessionMinutesPerDay: number
}): EngagementLevel {
  const { playsPerDay, sharesPerWeek, followedArtists, sessionMinutesPerDay } = metrics

  if (playsPerDay > 30 || sharesPerWeek > 5 || sessionMinutesPerDay > 120) {
    return 'superfan'
  }
  if (playsPerDay > 10 || followedArtists > 10 || sessionMinutesPerDay > 60) {
    return 'power'
  }
  if (playsPerDay >= 3 || sessionMinutesPerDay >= 15) {
    return 'active'
  }
  return 'passive'
}
