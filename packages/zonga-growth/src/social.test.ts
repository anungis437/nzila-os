import { describe, it, expect, vi } from 'vitest'
import {
  validateFollow,
  safePagination,
  createSocialGraphService,
} from './social'
import type { SocialRepository, FollowRelation, UserActivity } from './social'

function makeFollow(overrides: Partial<FollowRelation> = {}): FollowRelation {
  return {
    id: 'f1',
    orgId: 'o1',
    followerId: 'u1',
    followeeId: 'u2',
    followerType: 'listener',
    followeeType: 'creator',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeActivity(overrides: Partial<UserActivity> = {}): UserActivity {
  return {
    id: 'act1',
    orgId: 'o1',
    userId: 'u1',
    userType: 'listener',
    activityType: 'follow' as UserActivity['activityType'],
    entityType: 'creator',
    contentId: 'u2',
    metadata: {},
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('validateFollow', () => {
  it('returns valid for different users', () => {
    expect(validateFollow('u1', 'u2')).toEqual({ valid: true })
  })

  it('rejects self-follow', () => {
    const result = validateFollow('u1', 'u1')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('yourself')
  })
})

describe('safePagination', () => {
  it('uses defaults for undefined', () => {
    expect(safePagination()).toEqual({ limit: 20, offset: 0 })
  })

  it('caps limit at 100', () => {
    expect(safePagination(500, 0)).toEqual({ limit: 100, offset: 0 })
  })

  it('floors limit at 1', () => {
    expect(safePagination(0, 0)).toEqual({ limit: 1, offset: 0 })
  })

  it('floors offset at 0', () => {
    expect(safePagination(20, -5)).toEqual({ limit: 20, offset: 0 })
  })
})

// ── Social Graph Service ─────────────────────────────────────────────────────

describe('createSocialGraphService', () => {
  function makeMockRepo(): SocialRepository {
    return {
      findFollow: vi.fn().mockResolvedValue(null),
      insertFollow: vi.fn().mockResolvedValue(makeFollow()),
      deleteFollow: vi.fn().mockResolvedValue(true),
      countFollowers: vi.fn().mockResolvedValue(100),
      countFollowing: vi.fn().mockResolvedValue(50),
      listFollowers: vi.fn().mockResolvedValue([makeFollow()]),
      listFollowing: vi.fn().mockResolvedValue([makeFollow()]),
      findMutualFollows: vi.fn().mockResolvedValue(['u3']),
      insertActivity: vi.fn().mockResolvedValue(makeActivity()),
      listFeedForUser: vi.fn().mockResolvedValue([makeActivity()]),
    }
  }

  describe('follow', () => {
    it('creates new follow and records activity', async () => {
      const repo = makeMockRepo()
      const svc = createSocialGraphService({ repo })
      const result = await svc.follow({
        orgId: 'o1',
        followerId: 'u1',
        followeeId: 'u2',
        followerType: 'listener',
        followeeType: 'creator',
      })
      expect(result.id).toBe('f1')
      expect(repo.insertFollow).toHaveBeenCalled()
      expect(repo.insertActivity).toHaveBeenCalled()
    })

    it('returns existing follow without duplicating', async () => {
      const repo = makeMockRepo()
      ;(repo.findFollow as ReturnType<typeof vi.fn>).mockResolvedValue(makeFollow())
      const svc = createSocialGraphService({ repo })
      await svc.follow({ orgId: 'o1', followerId: 'u1', followeeId: 'u2', followerType: 'listener', followeeType: 'creator' })
      expect(repo.insertFollow).not.toHaveBeenCalled()
    })

    it('throws on self-follow', async () => {
      const svc = createSocialGraphService({ repo: makeMockRepo() })
      await expect(svc.follow({ orgId: 'o1', followerId: 'u1', followeeId: 'u1', followerType: 'listener', followeeType: 'listener' }))
        .rejects.toThrow(/yourself/)
    })
  })

  describe('unfollow', () => {
    it('deletes follow relation', async () => {
      const repo = makeMockRepo()
      const svc = createSocialGraphService({ repo })
      const result = await svc.unfollow({ orgId: 'o1', followerId: 'u1', followeeId: 'u2' })
      expect(result).toBe(true)
      expect(repo.deleteFollow).toHaveBeenCalledWith('o1', 'u1', 'u2')
    })
  })

  describe('getFollowStats', () => {
    it('returns combined stats', async () => {
      const repo = makeMockRepo()
      const svc = createSocialGraphService({ repo })
      const stats = await svc.getFollowStats('o1', 'u1')
      expect(stats).toEqual({ userId: 'u1', followerCount: 100, followingCount: 50 })
    })
  })

  describe('isFollowing', () => {
    it('returns false when no relation exists', async () => {
      const svc = createSocialGraphService({ repo: makeMockRepo() })
      expect(await svc.isFollowing('o1', 'u1', 'u2')).toBe(false)
    })

    it('returns true when relation exists', async () => {
      const repo = makeMockRepo()
      ;(repo.findFollow as ReturnType<typeof vi.fn>).mockResolvedValue(makeFollow())
      const svc = createSocialGraphService({ repo })
      expect(await svc.isFollowing('o1', 'u1', 'u2')).toBe(true)
    })
  })

  describe('getFollowers / getFollowing', () => {
    it('passes pagination to repo', async () => {
      const repo = makeMockRepo()
      const svc = createSocialGraphService({ repo })
      await svc.getFollowers('o1', 'u1', 10, 5)
      expect(repo.listFollowers).toHaveBeenCalledWith('o1', 'u1', 10, 5)
    })

    it('applies safe pagination defaults', async () => {
      const repo = makeMockRepo()
      const svc = createSocialGraphService({ repo })
      await svc.getFollowing('o1', 'u1')
      expect(repo.listFollowing).toHaveBeenCalledWith('o1', 'u1', 20, 0)
    })
  })

  describe('getMutualFollows', () => {
    it('returns mutual user IDs', async () => {
      const repo = makeMockRepo()
      const svc = createSocialGraphService({ repo })
      const result = await svc.getMutualFollows('o1', 'u1', 'u2')
      expect(result).toEqual(['u3'])
    })
  })

  describe('recordActivity', () => {
    it('delegates to repo', async () => {
      const repo = makeMockRepo()
      const svc = createSocialGraphService({ repo })
      const result = await svc.recordActivity({
        orgId: 'o1', userId: 'u1', userType: 'listener',
        activityType: 'stream' as UserActivity['activityType'], entityType: 'track', contentId: 'a1', metadata: {},
      })
      expect(result.id).toBe('act1')
    })
  })

  describe('getActivityFeed', () => {
    it('returns activities with safe pagination', async () => {
      const repo = makeMockRepo()
      const svc = createSocialGraphService({ repo })
      const result = await svc.getActivityFeed('o1', 'u1')
      expect(result).toHaveLength(1)
      expect(repo.listFeedForUser).toHaveBeenCalledWith('o1', 'u1', 20, 0)
    })
  })
})
