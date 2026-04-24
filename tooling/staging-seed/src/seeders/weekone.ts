/**
 * WeekOne per-app staging seeder (founder operating system).
 *
 * Generates synthetic founder/runway data: subscriptions, cash snapshots,
 * deals (sales pipeline), invoices, weekly briefs, priorities,
 * recommendations, integrations.
 *
 * PLAN-ONLY in phase 2 — Drizzle writes against weekone tables land in phase 3.
 */
import { registerSeeder } from '../core/registry'
import * as shared from '../shared'
import type {
  SeedAppReport,
  SeedContext,
  SeedProfile,
  SeederModule,
} from '../core/types'
import { persistOrSkip, persistResetOrSkip } from './_persist-helpers'

const SUPPORTED_PROFILES: readonly SeedProfile[] = [
  'demo-light',
  'demo-standard',
  'executive-showcase',
  'investor-showcase',
]

const STAGING_ORG = {
  id: 'org-weekone-staging-founder-9999',
  name: 'WeekOne Staging Founder 9999',
  slug: 'weekone-staging-founder-9999',
}

interface WeekOneScale {
  readonly subscriptions: number
  readonly cashSnapshots: number
  readonly deals: number
  readonly invoices: number
  readonly weeklyBriefs: number
  readonly priorities: number
  readonly recommendations: number
  readonly integrations: number
  readonly notifications: number
  readonly activityLogs: number
}

function weekoneScale(profile: SeedProfile): WeekOneScale {
  switch (profile) {
    case 'demo-light':
      return { subscriptions: 1, cashSnapshots: 12, deals: 20, invoices: 30, weeklyBriefs: 12, priorities: 8, recommendations: 10, integrations: 4, notifications: 30, activityLogs: 100 }
    case 'demo-standard':
      return { subscriptions: 1, cashSnapshots: 26, deals: 80, invoices: 120, weeklyBriefs: 26, priorities: 20, recommendations: 30, integrations: 6, notifications: 120, activityLogs: 400 }
    case 'executive-showcase':
      return { subscriptions: 1, cashSnapshots: 52, deals: 250, invoices: 500, weeklyBriefs: 52, priorities: 60, recommendations: 100, integrations: 10, notifications: 400, activityLogs: 1500 }
    case 'investor-showcase':
      return { subscriptions: 1, cashSnapshots: 104, deals: 600, invoices: 1200, weeklyBriefs: 104, priorities: 150, recommendations: 250, integrations: 14, notifications: 1000, activityLogs: 4000 }
  }
}

const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const
const PRIORITY_STATES = ['todo', 'in_progress', 'blocked', 'done'] as const
const RECO_KINDS = ['runway', 'pricing', 'hiring', 'pipeline', 'product', 'cash'] as const
const INTEGRATION_KINDS = ['stripe', 'quickbooks', 'hubspot', 'slack', 'gusto', 'plaid'] as const
const SUB_PLANS = ['founder', 'team', 'scale', 'enterprise'] as const

interface SyntheticCashSnapshot {
  readonly id: string
  readonly orgId: string
  readonly snapshotAt: string
  readonly cashCents: number
  readonly burnCents: number
  readonly runwayMonths: number
}

interface SyntheticDeal {
  readonly id: string
  readonly orgId: string
  readonly title: string
  readonly stage: (typeof DEAL_STAGES)[number]
  readonly valueCents: number
  readonly closeAt: string
}

interface SyntheticBrief {
  readonly id: string
  readonly orgId: string
  readonly weekStart: string
  readonly highlights: number
  readonly risks: number
}

interface SyntheticPriority {
  readonly id: string
  readonly orgId: string
  readonly title: string
  readonly state: (typeof PRIORITY_STATES)[number]
  readonly dueAt: string
}

interface SyntheticRecommendation {
  readonly id: string
  readonly orgId: string
  readonly kind: (typeof RECO_KINDS)[number]
  readonly title: string
  readonly impactScore: number
}

interface SyntheticIntegration {
  readonly id: string
  readonly orgId: string
  readonly kind: (typeof INTEGRATION_KINDS)[number]
  readonly status: 'connected' | 'disconnected' | 'error'
  readonly connectedAt: string
}

interface SyntheticSubscription {
  readonly id: string
  readonly orgId: string
  readonly plan: (typeof SUB_PLANS)[number]
  readonly mrrCents: number
  readonly startedAt: string
}

function buildPlan(ctx: SeedContext) {
  const scale = weekoneScale(ctx.profile)

  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [{ ...baseOrg, ...STAGING_ORG, sector: 'saas', tier: 'enterprise' as const }]
  const founderPeople = shared.fakePeople(ctx.rng, ctx.time, 4)
  const users = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people: founderPeople, organizations: orgs, count: 4 })

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()

  const subscriptions: SyntheticSubscription[] = Array.from({ length: scale.subscriptions }, () => {
    const plan = ctx.rng.pick(SUB_PLANS)
    const mrr: Record<(typeof SUB_PLANS)[number], number> = { founder: 4900, team: 19_900, scale: 49_900, enterprise: 199_900 }
    return {
      id: ctx.rng.id('subscription'),
      orgId: STAGING_ORG.id,
      plan,
      mrrCents: mrr[plan],
      startedAt: ctx.time.daysAgo(ctx.rng.intBetween(30, 720)).toISOString(),
    }
  })

  const cashSnapshots: SyntheticCashSnapshot[] = Array.from({ length: scale.cashSnapshots }, (_, i) => {
    const cash = ctx.rng.intBetween(50_000_00, 5_000_000_00)
    const burn = ctx.rng.intBetween(50_000_00, 400_000_00)
    return {
      id: ctx.rng.id('snapshot'),
      orgId: STAGING_ORG.id,
      snapshotAt: ctx.time.daysAgo((scale.cashSnapshots - i) * 7).toISOString(),
      cashCents: cash,
      burnCents: burn,
      runwayMonths: Math.max(1, Math.round(cash / Math.max(burn, 1))),
    }
  })

  const deals: SyntheticDeal[] = Array.from({ length: scale.deals }, (_, i) => ({
    id: ctx.rng.id('deal'),
    orgId: STAGING_ORG.id,
    title: `Synthetic Deal ${i + 1}`,
    stage: ctx.rng.pick(DEAL_STAGES),
    valueCents: ctx.rng.intBetween(5000_00, 500_000_00),
    closeAt: ctx.time.daysAhead(ctx.rng.intBetween(7, 180)).toISOString(),
  }))

  const invoices = shared.fakeInvoices({ rng: ctx.rng, time: ctx.time, organizations: orgs, count: scale.invoices })

  const weeklyBriefs: SyntheticBrief[] = Array.from({ length: scale.weeklyBriefs }, (_, i) => ({
    id: ctx.rng.id('brief'),
    orgId: STAGING_ORG.id,
    weekStart: ctx.time.daysAgo((scale.weeklyBriefs - i) * 7).toISOString(),
    highlights: ctx.rng.intBetween(2, 8),
    risks: ctx.rng.intBetween(0, 4),
  }))

  const priorities: SyntheticPriority[] = Array.from({ length: scale.priorities }, (_, i) => ({
    id: ctx.rng.id('priority'),
    orgId: STAGING_ORG.id,
    title: `Synthetic Priority ${i + 1}`,
    state: ctx.rng.pick(PRIORITY_STATES),
    dueAt: ctx.time.daysAhead(ctx.rng.intBetween(1, 30)).toISOString(),
  }))

  const recommendations: SyntheticRecommendation[] = Array.from({ length: scale.recommendations }, (_, i) => ({
    id: ctx.rng.id('recommendation'),
    orgId: STAGING_ORG.id,
    kind: ctx.rng.pick(RECO_KINDS),
    title: `Synthetic Recommendation ${i + 1}`,
    impactScore: ctx.rng.intBetween(1, 100),
  }))

  const integrations: SyntheticIntegration[] = Array.from({ length: scale.integrations }, (_, i) => ({
    id: ctx.rng.id('integration'),
    orgId: STAGING_ORG.id,
    kind: INTEGRATION_KINDS[i % INTEGRATION_KINDS.length]!,
    status: ctx.rng.pick(['connected', 'disconnected', 'error'] as const),
    connectedAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
  }))

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users, count: scale.activityLogs })

  return { orgs, users, subscriptions, cashSnapshots, deals, invoices, weeklyBriefs, priorities, recommendations, integrations, notifications, activityLogs }
}

const seeder: SeederModule = {
  app: 'weekone',
  description: 'WeekOne synthetic founder: subscription, cash snapshots, deals, invoices, weekly briefs, priorities, recommendations, integrations.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)
    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'users', entity: 'users', count: plan.users.length })
    ctx.report.step({ step: 'subscription', entity: 'subscriptions', count: plan.subscriptions.length })
    ctx.report.step({ step: 'cash_snapshots', entity: 'cash_snapshots', count: plan.cashSnapshots.length })
    ctx.report.step({ step: 'deals', entity: 'deals', count: plan.deals.length })
    ctx.report.step({ step: 'invoices', entity: 'invoices', count: plan.invoices.length })
    ctx.report.step({ step: 'weekly_briefs', entity: 'briefs', count: plan.weeklyBriefs.length })
    ctx.report.step({ step: 'priorities', entity: 'priorities', count: plan.priorities.length })
    ctx.report.step({ step: 'recommendations', entity: 'recommendations', count: plan.recommendations.length })
    ctx.report.step({ step: 'integrations', entity: 'integrations', count: plan.integrations.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    await persistOrSkip(ctx, STAGING_ORG.id, [
      { entityType: 'organizations', rows: plan.orgs },
      { entityType: 'users', rows: plan.users },
      { entityType: 'subscriptions', rows: plan.subscriptions },
      { entityType: 'cash_snapshots', rows: plan.cashSnapshots },
      { entityType: 'deals', rows: plan.deals },
      { entityType: 'invoices', rows: plan.invoices },
      { entityType: 'weekly_briefs', rows: plan.weeklyBriefs },
      { entityType: 'priorities', rows: plan.priorities },
      { entityType: 'recommendations', rows: plan.recommendations },
      { entityType: 'integrations', rows: plan.integrations },
      { entityType: 'notifications', rows: plan.notifications },
      { entityType: 'activity_logs', rows: plan.activityLogs },
    ])

    ctx.logger.info('weekone seed plan computed', {
      profile: ctx.profile, deals: plan.deals.length, briefs: plan.weeklyBriefs.length, org: STAGING_ORG.id,
    })
    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    await persistResetOrSkip(ctx, STAGING_ORG.id)
    ctx.logger.info('weekone reset', { org: STAGING_ORG.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_ORG, weekoneScale, buildPlan }
