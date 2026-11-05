import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  averageEngagementRate,
  figuresRecorded,
  goalProgress,
  platformFigures,
  summarizePosts,
} from '@/lib/social-media/campaign-figures'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

const post = (o: Partial<Record<string, unknown>> = {}) => ({
  impressionsCount: 0, reachCount: 0, likesCount: 0, commentsCount: 0, sharesCount: 0, engagementRate: null, accountPlatform: 'facebook', ...o,
}) as never

describe('Gate 0 batch B79: social campaign figures and publish handling', () => {
  describe('campaign figures', () => {
    it('totals the counters the posts carry and reports clicks as absent, not zero', () => {
      const totals = summarizePosts([post({ impressionsCount: 100, likesCount: 4, commentsCount: 1, sharesCount: 2 }), post({ impressionsCount: 50 })])
      expect(totals).toMatchObject({ total_posts: 2, total_impressions: 150, total_engagement: 7, total_likes: 4 })
      expect(totals.total_clicks).toBeNull()
    })

    it('says whether any counter was recorded, so default zeros are not presented as measured performance', () => {
      expect(figuresRecorded([post(), post()])).toBe(false)
      expect(figuresRecorded([post({ likesCount: 1 })])).toBe(true)
      expect(figuresRecorded([])).toBe(false)
    })

    it('groups by platform from the real count fields', () => {
      const groups = platformFigures([
        post({ accountPlatform: 'facebook', impressionsCount: 10, likesCount: 2 }),
        post({ accountPlatform: 'facebook', impressionsCount: 5, sharesCount: 1 }),
        post({ accountPlatform: 'twitter', impressionsCount: 7 }),
      ])
      expect(groups.find((g) => g.platform === 'facebook')).toMatchObject({ posts: 2, impressions: 15, engagement: 3, likes: 2, shares: 1 })
      expect(groups.find((g) => g.platform === 'twitter')).toMatchObject({ posts: 1, impressions: 7 })
    })

    it('has no average engagement rate when no post carries one', () => {
      expect(averageEngagementRate([post(), post()])).toBeNull()
      expect(averageEngagementRate([post({ engagementRate: '2.50' }), post({ engagementRate: '3.50' })])).toBe(3)
    })

    it('reports progress only toward goals the campaign set, and no actual for conversions (not collected)', () => {
      const summary = summarizePosts([post({ impressionsCount: 250 })])
      expect(goalProgress({ goalImpressions: null, goalEngagementRate: null, goalConversions: null }, summary, null)).toBeNull()
      const progress = goalProgress({ goalImpressions: 1000, goalEngagementRate: '4.00', goalConversions: 20 }, summary, 2)
      expect(progress?.impressions).toEqual({ goal: 1000, actual: 250, percent: 25 })
      expect(progress?.engagement_rate).toEqual({ goal: 4, actual: 2, percent: 50 })
      expect(progress?.conversions).toEqual({ goal: 20, actual: null, percent: null })
    })
  })

  it('both campaign reads use the helper, and the old hard-coded undefined is gone', () => {
    const analytics = src('app/api/social-media/analytics/route.ts')
    expect(analytics).toContain('platformFigures(posts)')
    expect(analytics).not.toContain('const goalProgress = undefined')
    expect(analytics).toContain('eq(socialPosts.organizationId, organizationId)')
    const campaigns = src('app/api/social-media/campaigns/route.ts')
    expect(campaigns).not.toContain('goal_progress: undefined')
    expect(campaigns).not.toContain('total_clicks: 0')
  })

  it('records an all-platform failure as a failed operation and never returns platform text', () => {
    const route = src('app/api/social-media/posts/review/route.ts')
    expect(route).toContain('throw new AllPlatformsFailedError(published)')
    const service = src('lib/social-media/social-media-service.ts')
    expect(service).toContain("'The platform did not accept the post.'")
    expect(service).not.toContain("error: error instanceof Error ? error.message : 'Unknown error'")
    expect(service).toContain('recorded,')
  })

  it('refreshes a token without forcing an account active or expiring it for a storage failure', () => {
    const accounts = src('app/api/social-media/accounts/route.ts')
    expect(accounts).toContain("account.status === 'suspended' || account.status === 'disconnected'")
    expect(accounts).toContain("status: account.status === 'expired' ? 'active' : account.status")
    expect(accounts).toContain("eq(socialAccounts.status, 'active')")
    expect(accounts).toContain('catch (providerError)')
  })
})
