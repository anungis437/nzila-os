/**
 * Figures of a social campaign, computed from the counters the posts carry.
 *
 * The counters are written by nothing in this application (no collector reads platform analytics yet), so every figure
 * is what a post row holds. The functions say so rather than present zeros as measured performance, report goals only
 * where one was set, and never invent a figure the application does not collect (clicks, conversions).
 */

export interface PostFigures {
  impressionsCount: number | null
  reachCount?: number | null
  likesCount: number | null
  commentsCount: number | null
  sharesCount: number | null
  engagementRate?: string | number | null
  accountPlatform?: string | null
}

export interface CampaignGoals {
  goalImpressions: number | null
  goalEngagementRate: string | number | null
  goalConversions: number | null
}

const n = (value: number | null | undefined) => value ?? 0
const engagementOf = (post: PostFigures) => n(post.likesCount) + n(post.commentsCount) + n(post.sharesCount)

export function summarizePosts(posts: readonly PostFigures[]) {
  return {
    total_posts: posts.length,
    total_impressions: posts.reduce((sum, p) => sum + n(p.impressionsCount), 0),
    total_reach: posts.reduce((sum, p) => sum + n(p.reachCount), 0),
    total_engagement: posts.reduce((sum, p) => sum + engagementOf(p), 0),
    total_likes: posts.reduce((sum, p) => sum + n(p.likesCount), 0),
    total_comments: posts.reduce((sum, p) => sum + n(p.commentsCount), 0),
    total_shares: posts.reduce((sum, p) => sum + n(p.sharesCount), 0),
    // No click collector exists: absent, not zero.
    total_clicks: null as number | null,
  }
}

/** True only when at least one post carries a non-zero counter; otherwise the figures above are defaults, not measurements. */
export function figuresRecorded(posts: readonly PostFigures[]): boolean {
  return posts.some((p) => n(p.impressionsCount) + n(p.reachCount) + engagementOf(p) > 0)
}

export function averageEngagementRate(posts: readonly PostFigures[]): number | null {
  const rated = posts
    .filter((p) => p.engagementRate !== null && p.engagementRate !== undefined && p.engagementRate !== '')
    .map((p) => Number(p.engagementRate))
    .filter((rate) => Number.isFinite(rate))
  return rated.length > 0 ? rated.reduce((a, b) => a + b, 0) / rated.length : null
}

const percent = (actual: number, goal: number) => (goal > 0 ? Math.round((actual / goal) * 1000) / 10 : null)

/** Progress toward the goals the campaign set; null when it set none. Conversions are not collected, so they have no actual. */
export function goalProgress(goals: CampaignGoals, summary: { total_impressions: number }, avgRate: number | null) {
  const goalRate = goals.goalEngagementRate === null ? null : Number(goals.goalEngagementRate)
  const progress = {
    impressions: goals.goalImpressions ? { goal: goals.goalImpressions, actual: summary.total_impressions, percent: percent(summary.total_impressions, goals.goalImpressions) } : null,
    engagement_rate: goalRate !== null && Number.isFinite(goalRate) ? { goal: goalRate, actual: avgRate, percent: avgRate === null ? null : percent(avgRate, goalRate) } : null,
    conversions: goals.goalConversions ? { goal: goals.goalConversions, actual: null, percent: null } : null,
  }
  return progress.impressions || progress.engagement_rate || progress.conversions ? progress : null
}

export function platformFigures(posts: readonly PostFigures[]) {
  const byPlatform = new Map<string, PostFigures[]>()
  for (const post of posts) {
    const key = post.accountPlatform ?? 'unknown'
    byPlatform.set(key, [...(byPlatform.get(key) ?? []), post])
  }
  return [...byPlatform.entries()].map(([platform, group]) => ({
    platform,
    posts: group.length,
    impressions: group.reduce((sum, p) => sum + n(p.impressionsCount), 0),
    engagement: group.reduce((sum, p) => sum + engagementOf(p), 0),
    likes: group.reduce((sum, p) => sum + n(p.likesCount), 0),
    comments: group.reduce((sum, p) => sum + n(p.commentsCount), 0),
    shares: group.reduce((sum, p) => sum + n(p.sharesCount), 0),
    avg_engagement_rate: averageEngagementRate(group),
  }))
}
