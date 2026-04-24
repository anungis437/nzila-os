export type WeekonePlan = 'solo' | 'team' | 'growth'
export type BillingInterval = 'monthly' | 'annual'

export function resolveWeekonePriceId(plan: WeekonePlan, interval: BillingInterval): string | null {
  const catalog = {
    solo: {
      monthly: process.env.STRIPE_WEEKONE_SOLO_MONTHLY_PRICE_ID,
      annual: process.env.STRIPE_WEEKONE_SOLO_ANNUAL_PRICE_ID,
    },
    team: {
      monthly: process.env.STRIPE_WEEKONE_TEAM_MONTHLY_PRICE_ID,
      annual: process.env.STRIPE_WEEKONE_TEAM_ANNUAL_PRICE_ID,
    },
    growth: {
      monthly: process.env.STRIPE_WEEKONE_GROWTH_MONTHLY_PRICE_ID,
      annual: process.env.STRIPE_WEEKONE_GROWTH_ANNUAL_PRICE_ID,
    },
  }

  return catalog[plan][interval] ?? null
}

export function weekoneCheckoutFallbackUrl(plan: WeekonePlan, interval: BillingInterval, locale = 'en'): string {
  return `/${locale}/settings/billing?plan=${plan}&interval=${interval}&checkout=placeholder`
}
