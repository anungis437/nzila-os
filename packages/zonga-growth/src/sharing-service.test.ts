import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSharingService,
  type SharingRepository,
  type FriendsListeningPort,
  type SharedContent,
} from './sharing'

// ── Helpers ─────────────────────────────────────────────────────────────────

const ORG = '00000000-0000-0000-0000-000000000001'
const USER = '00000000-0000-0000-0000-000000000002'

function makeShare(overrides: Partial<SharedContent> = {}): SharedContent {
  return {
    id: 'share-1',
    orgId: ORG,
    sharerId: USER,
    shareType: 'track',
    contentId: '00000000-0000-0000-0000-000000000099',
    deepLink: '',
    platform: 'whatsapp',
    clickCount: 5,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeRepo(): SharingRepository {
  return {
    insertShare: vi.fn(async (data) => ({
      ...data,
      id: 'share-new',
      clickCount: 0,
      createdAt: new Date().toISOString(),
    })) as unknown as SharingRepository['insertShare'],
    findShareById: vi.fn(async () => makeShare()),
    incrementClickCount: vi.fn(async () => {}),
    listSharesByUser: vi.fn(async () => [makeShare()]),
    listSharesByEntity: vi.fn(async () => [makeShare()]),
    getSharesForPeriod: vi.fn(async () => [
      makeShare({ clickCount: 3 }),
      makeShare({ id: 'share-2', clickCount: 7, platform: 'twitter', contentId: '00000000-0000-0000-0000-000000000088' }),
    ]),
  }
}

function makeFriends(): FriendsListeningPort {
  return {
    getActiveListeners: vi.fn(async () => [
      { userId: 'friend-1', assetId: 'track-x', startedAt: '2025-01-01T12:00:00Z' },
    ]),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createSharingService', () => {
  let repo: SharingRepository
  let friends: FriendsListeningPort
  let service: ReturnType<typeof createSharingService>

  beforeEach(() => {
    vi.restoreAllMocks()
    repo = makeRepo()
    friends = makeFriends()
    service = createSharingService({
      repo,
      friends,
      baseUrl: 'https://app.zonga.co',
    })
  })

  describe('share', () => {
    it('validates intent, inserts share, builds deep link', async () => {
      const result = await service.share({
        orgId: ORG,
        sharerId: USER,
        shareType: 'track',
        contentId: '00000000-0000-0000-0000-000000000099',
        platform: 'whatsapp',
      })

      expect(repo.insertShare).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: ORG,
          sharerId: USER,
          shareType: 'track',
        }),
      )
      expect(result.deepLink).toContain('https://app.zonga.co/track/')
      expect(result.deepLink).toContain('ref=')
      expect(result.deepLink).toContain('utm_source=whatsapp')
    })

    it('uses "direct" as utm_source when no platform given', async () => {
      const result = await service.share({
        orgId: ORG,
        sharerId: USER,
        shareType: 'playlist',
        contentId: '00000000-0000-0000-0000-000000000099',
      })

      expect(result.deepLink).toContain('utm_source=direct')
      expect(result.deepLink).toContain('/playlist/')
    })

    it('throws on invalid intent (bad UUID)', async () => {
      await expect(
        service.share({
          orgId: 'not-a-uuid',
          sharerId: USER,
          shareType: 'track',
          contentId: '00000000-0000-0000-0000-000000000099',
        }),
      ).rejects.toThrow()
    })
  })

  describe('trackClick', () => {
    it('increments click count and returns updated share', async () => {
      const result = await service.trackClick('share-1')

      expect(repo.findShareById).toHaveBeenCalledWith('share-1')
      expect(repo.incrementClickCount).toHaveBeenCalledWith('share-1')
      expect(result).not.toBeNull()
      expect(result!.clickCount).toBe(6) // original 5 + 1
    })

    it('returns null when share not found', async () => {
      vi.mocked(repo.findShareById).mockResolvedValueOnce(null)

      const result = await service.trackClick('nonexistent')
      expect(result).toBeNull()
      expect(repo.incrementClickCount).not.toHaveBeenCalled()
    })
  })

  describe('getViralityMetrics', () => {
    it('computes metrics from period shares', async () => {
      const metrics = await service.getViralityMetrics({
        orgId: ORG,
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      })

      expect(repo.getSharesForPeriod).toHaveBeenCalledWith(ORG, '2025-01-01', '2025-01-31')
      expect(metrics.totalShares).toBe(2)
      expect(metrics.totalClicks).toBe(10) // 3 + 7
      expect(metrics.clickThroughRate).toBe(5) // 10 / 2
      expect(metrics.topPlatform).toBeTruthy()
      expect(metrics.topContent).toBeTruthy()
    })
  })

  describe('getFriendsListening', () => {
    it('returns empty array when friendIds is empty', async () => {
      const result = await service.getFriendsListening({
        orgId: ORG,
        friendIds: [],
      })

      expect(result).toEqual([])
      expect(friends.getActiveListeners).not.toHaveBeenCalled()
    })

    it('delegates to friends port for non-empty list', async () => {
      const result = await service.getFriendsListening({
        orgId: ORG,
        friendIds: ['friend-1', 'friend-2'],
      })

      expect(friends.getActiveListeners).toHaveBeenCalledWith(
        ORG,
        ['friend-1', 'friend-2'],
      )
      expect(result.length).toBe(1)
      expect(result[0]!.userId).toBe('friend-1')
    })
  })

  describe('getUserShares', () => {
    it('uses default limit 20 and offset 0', async () => {
      await service.getUserShares({ orgId: ORG, userId: USER })

      expect(repo.listSharesByUser).toHaveBeenCalledWith(ORG, USER, 20, 0)
    })

    it('caps limit at 100', async () => {
      await service.getUserShares({ orgId: ORG, userId: USER, limit: 500 })

      expect(repo.listSharesByUser).toHaveBeenCalledWith(ORG, USER, 100, 0)
    })

    it('clamps negative offset to 0', async () => {
      await service.getUserShares({ orgId: ORG, userId: USER, offset: -10 })

      expect(repo.listSharesByUser).toHaveBeenCalledWith(ORG, USER, 20, 0)
    })

    it('respects valid limit and offset', async () => {
      await service.getUserShares({ orgId: ORG, userId: USER, limit: 50, offset: 10 })

      expect(repo.listSharesByUser).toHaveBeenCalledWith(ORG, USER, 50, 10)
    })
  })
})
