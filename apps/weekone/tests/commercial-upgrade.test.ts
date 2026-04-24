import { describe, expect, it } from 'vitest'
import { computeRetentionInsights } from '@/lib/retention-intelligence'
import { resolveWeekonePriceId, weekoneCheckoutFallbackUrl } from '@/lib/billing-plans'
import { getUsageLimits, shouldShowUpgradePrompt } from '@/lib/usage-limits'

describe('usage limits', () => {
  it('returns free plan limits', () => {
    expect(getUsageLimits('free').collaborators).toBe(1)
  })

  it('shows upgrade prompt when free plan limits are reached', () => {
    const show = shouldShowUpgradePrompt({
      plan: 'free',
      usage: {
        prioritiesCreatedThisWeek: 12,
        collaborators: 1,
        integrationsConnected: 1,
      },
    })

    expect(show).toBe(true)
  })

  it('does not show prompt for team plan', () => {
    const show = shouldShowUpgradePrompt({
      plan: 'team',
      usage: {
        prioritiesCreatedThisWeek: 100,
        collaborators: 2,
        integrationsConnected: 2,
      },
    })

    expect(show).toBe(false)
  })
})

describe('retention intelligence', () => {
  it('computes weeks completed and average score', () => {
    const result = computeRetentionInsights([
      { weekStartDate: '2026-04-01', score: 80 },
      { weekStartDate: '2026-04-08', score: 70 },
      { weekStartDate: '2026-04-15', score: 90 },
    ])

    expect(result.weeksCompleted).toBe(3)
    expect(result.averageScore).toBe(80)
    expect(result.churnRisk).toBe('low')
  })

  it('flags high churn risk for sparse low-score activity', () => {
    const result = computeRetentionInsights([
      { weekStartDate: '2026-01-01', score: 30 },
      { weekStartDate: '2026-03-01', score: 40 },
    ])

    expect(result.churnRisk).toBe('high')
    expect(result.consistency).toBeLessThan(60)
  })
})

describe('billing plans', () => {
  it('falls back when no Stripe price id is configured', () => {
    expect(resolveWeekonePriceId('team', 'monthly')).toBeNull()
  })

  it('builds locale-aware fallback checkout URL', () => {
    expect(weekoneCheckoutFallbackUrl('growth', 'annual', 'fr')).toContain('/fr/settings/billing')
  })
})
