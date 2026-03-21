/**
 * @nzila/zonga-growth — Social Graph Service
 *
 * Follow/unfollow, follower counts, activity feed, mutual connections.
 * All state mutations go through the Flow orchestrator.
 * Pure functions where possible; I/O via ports.
 *
 * @module @nzila/zonga-growth/social
 */

import type { ListenerActivityType } from '@nzila/zonga-core/enums'

// ── Types ───────────────────────────────────────────────────────────────────

export const EntityType = {
  LISTENER: 'listener',
  CREATOR: 'creator',
} as const
export type EntityType = (typeof EntityType)[keyof typeof EntityType]

export interface FollowRelation {
  readonly id: string
  readonly orgId: string
  readonly followerId: string
  readonly followeeId: string
  readonly followerType: EntityType
  readonly followeeType: EntityType
  readonly createdAt: string
}

export interface UserActivity {
  readonly id: string
  readonly orgId: string
  readonly userId: string
  readonly userType: EntityType
  readonly activityType: ListenerActivityType
  readonly entityType: string | null
  readonly contentId: string | null
  readonly metadata: Readonly<Record<string, unknown>>
  readonly createdAt: string
}

export interface FollowStats {
  readonly userId: string
  readonly followerCount: number
  readonly followingCount: number
}

export interface ActivityFeedItem {
  readonly activity: UserActivity
  readonly actorName: string | null
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface SocialRepository {
  findFollow(orgId: string, followerId: string, followeeId: string): Promise<FollowRelation | null>
  insertFollow(follow: Omit<FollowRelation, 'id' | 'createdAt'>): Promise<FollowRelation>
  deleteFollow(orgId: string, followerId: string, followeeId: string): Promise<boolean>
  countFollowers(orgId: string, userId: string): Promise<number>
  countFollowing(orgId: string, userId: string): Promise<number>
  listFollowers(
    orgId: string,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<readonly FollowRelation[]>
  listFollowing(
    orgId: string,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<readonly FollowRelation[]>
  findMutualFollows(
    orgId: string,
    userA: string,
    userB: string,
  ): Promise<readonly string[]>
  insertActivity(activity: Omit<UserActivity, 'id' | 'createdAt'>): Promise<UserActivity>
  listFeedForUser(
    orgId: string,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<readonly UserActivity[]>
}

// ── Pure Helpers ────────────────────────────────────────────────────────────

/** Validates that a follow operation makes sense (no self-follow). */
export function validateFollow(followerId: string, followeeId: string): {
  valid: boolean
  error?: string
} {
  if (followerId === followeeId) {
    return { valid: false, error: 'Cannot follow yourself' }
  }
  return { valid: true }
}

/** Caps pagination params to safe limits. */
export function safePagination(
  limit?: number,
  offset?: number,
): { limit: number; offset: number } {
  const safeLimit = Math.min(Math.max(limit ?? 20, 1), 100)
  const safeOffset = Math.max(offset ?? 0, 0)
  return { limit: safeLimit, offset: safeOffset }
}

// ── Social Graph Service ────────────────────────────────────────────────────

export function createSocialGraphService(deps: { repo: SocialRepository }) {
  const { repo } = deps

  return {
    async follow(params: {
      orgId: string
      followerId: string
      followeeId: string
      followerType: EntityType
      followeeType: EntityType
    }): Promise<FollowRelation> {
      const check = validateFollow(params.followerId, params.followeeId)
      if (!check.valid) throw new Error(check.error)

      // Idempotent — return existing if already following
      const existing = await repo.findFollow(params.orgId, params.followerId, params.followeeId)
      if (existing) return existing

      const follow = await repo.insertFollow(params)

      // Record activity
      await repo.insertActivity({
        orgId: params.orgId,
        userId: params.followerId,
        userType: params.followerType,
        activityType: 'follow' as ListenerActivityType,
        entityType: params.followeeType,
        contentId: params.followeeId,
        metadata: {},
      })

      return follow
    },

    async unfollow(params: {
      orgId: string
      followerId: string
      followeeId: string
    }): Promise<boolean> {
      return repo.deleteFollow(params.orgId, params.followerId, params.followeeId)
    },

    async getFollowStats(orgId: string, userId: string): Promise<FollowStats> {
      const [followerCount, followingCount] = await Promise.all([
        repo.countFollowers(orgId, userId),
        repo.countFollowing(orgId, userId),
      ])
      return { userId, followerCount, followingCount }
    },

    async isFollowing(orgId: string, followerId: string, followeeId: string): Promise<boolean> {
      const relation = await repo.findFollow(orgId, followerId, followeeId)
      return relation !== null
    },

    async getFollowers(
      orgId: string,
      userId: string,
      limit?: number,
      offset?: number,
    ): Promise<readonly FollowRelation[]> {
      const page = safePagination(limit, offset)
      return repo.listFollowers(orgId, userId, page.limit, page.offset)
    },

    async getFollowing(
      orgId: string,
      userId: string,
      limit?: number,
      offset?: number,
    ): Promise<readonly FollowRelation[]> {
      const page = safePagination(limit, offset)
      return repo.listFollowing(orgId, userId, page.limit, page.offset)
    },

    async getMutualFollows(orgId: string, userA: string, userB: string): Promise<readonly string[]> {
      return repo.findMutualFollows(orgId, userA, userB)
    },

    async recordActivity(params: Omit<UserActivity, 'id' | 'createdAt'>): Promise<UserActivity> {
      return repo.insertActivity(params)
    },

    async getActivityFeed(
      orgId: string,
      userId: string,
      limit?: number,
      offset?: number,
    ): Promise<readonly UserActivity[]> {
      const page = safePagination(limit, offset)
      return repo.listFeedForUser(orgId, userId, page.limit, page.offset)
    },
  }
}
