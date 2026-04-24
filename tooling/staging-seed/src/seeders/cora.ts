/**
 * Cora per-app staging seeder (agricultural intelligence).
 *
 * Generates synthetic intelligence data: yield forecasts, price signals,
 * risk analyses, cooperative performance metrics, traceability rollups.
 *
 * PLAN-ONLY in phase 2 — Cora is in-memory/API today; phase 3 will wire
 * actual cache writes once Cora gains durable storage.
 */
import { registerSeeder } from '../core/registry'
import * as shared from '../shared'
import type {
  SeedAppReport,
  SeedContext,
  SeedProfile,
  SeederModule,
} from '../core/types'

const SUPPORTED_PROFILES: readonly SeedProfile[] = [
  'demo-light',
  'demo-standard',
  'executive-showcase',
  'investor-showcase',
]

const STAGING_ORG = {
  id: 'org-cora-staging-intel-9999',
  name: 'Cora Staging Intelligence 9999',
  slug: 'cora-staging-intel-9999',
}

interface CoraScale {
  readonly forecasts: number
  readonly priceSignals: number
  readonly risks: number
  readonly cooperativeMetrics: number
  readonly traceabilityRollups: number
  readonly notifications: number
  readonly activityLogs: number
}

function coraScale(profile: SeedProfile): CoraScale {
  switch (profile) {
    case 'demo-light':
      return { forecasts: 12, priceSignals: 30, risks: 6, cooperativeMetrics: 10, traceabilityRollups: 12, notifications: 30, activityLogs: 80 }
    case 'demo-standard':
      return { forecasts: 60, priceSignals: 200, risks: 30, cooperativeMetrics: 60, traceabilityRollups: 80, notifications: 150, activityLogs: 500 }
    case 'executive-showcase':
      return { forecasts: 250, priceSignals: 900, risks: 120, cooperativeMetrics: 250, traceabilityRollups: 350, notifications: 700, activityLogs: 2500 }
    case 'investor-showcase':
      return { forecasts: 700, priceSignals: 2500, risks: 350, cooperativeMetrics: 700, traceabilityRollups: 1000, notifications: 2000, activityLogs: 7000 }
  }
}

const CROPS = ['coffee', 'cocoa', 'maize', 'cassava', 'rice', 'sorghum', 'cashew', 'sesame'] as const
const RISK_KINDS = ['weather', 'pest', 'price-volatility', 'logistics', 'compliance', 'fx'] as const
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const
const SIGNAL_DIRECTIONS = ['up', 'down', 'flat'] as const

interface SyntheticForecast {
  readonly id: string
  readonly orgId: string
  readonly crop: (typeof CROPS)[number]
  readonly horizonDays: number
  readonly yieldKgPerHa: number
  readonly confidence: number
  readonly producedAt: string
}

interface SyntheticPriceSignal {
  readonly id: string
  readonly crop: (typeof CROPS)[number]
  readonly market: string
  readonly priceCentsPerKg: number
  readonly direction: (typeof SIGNAL_DIRECTIONS)[number]
  readonly observedAt: string
}

interface SyntheticRisk {
  readonly id: string
  readonly orgId: string
  readonly kind: (typeof RISK_KINDS)[number]
  readonly level: (typeof RISK_LEVELS)[number]
  readonly description: string
  readonly detectedAt: string
}

interface SyntheticCoopMetric {
  readonly id: string
  readonly orgId: string
  readonly metric: 'yield' | 'income' | 'training' | 'compliance' | 'membership'
  readonly value: number
  readonly periodStart: string
  readonly periodEnd: string
}

interface SyntheticTraceabilityRollup {
  readonly id: string
  readonly orgId: string
  readonly batchCount: number
  readonly verifiedPct: number
  readonly windowStart: string
  readonly windowEnd: string
}

function buildPlan(ctx: SeedContext) {
  const scale = coraScale(ctx.profile)
  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [{ ...baseOrg, ...STAGING_ORG, sector: 'agriculture-intel', tier: 'enterprise' as const }]
  const analystPeople = shared.fakePeople(ctx.rng, ctx.time, 6)
  const users = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people: analystPeople, organizations: orgs, count: 6 })

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()
  const ts = () => new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString()

  const forecasts: SyntheticForecast[] = Array.from({ length: scale.forecasts }, () => ({
    id: ctx.rng.id('forecast'),
    orgId: STAGING_ORG.id,
    crop: ctx.rng.pick(CROPS),
    horizonDays: ctx.rng.pick([30, 60, 90, 120, 180]),
    yieldKgPerHa: ctx.rng.intBetween(800, 6000),
    confidence: ctx.rng.intBetween(50, 95),
    producedAt: ts(),
  }))

  const priceSignals: SyntheticPriceSignal[] = Array.from({ length: scale.priceSignals }, () => ({
    id: ctx.rng.id('signal'),
    crop: ctx.rng.pick(CROPS),
    market: ctx.rng.pick(['Lagos', 'Nairobi', 'Accra', 'Dakar', 'Abidjan', 'Kampala', 'Kigali']),
    priceCentsPerKg: ctx.rng.intBetween(50, 5000),
    direction: ctx.rng.pick(SIGNAL_DIRECTIONS),
    observedAt: ts(),
  }))

  const risks: SyntheticRisk[] = Array.from({ length: scale.risks }, () => {
    const kind = ctx.rng.pick(RISK_KINDS)
    return {
      id: ctx.rng.id('risk'),
      orgId: STAGING_ORG.id,
      kind,
      level: ctx.rng.pick(RISK_LEVELS),
      description: `Synthetic ${kind} risk signal`,
      detectedAt: ts(),
    }
  })

  const cooperativeMetrics: SyntheticCoopMetric[] = Array.from({ length: scale.cooperativeMetrics }, () => {
    const start = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    return {
      id: ctx.rng.id('coop-metric'),
      orgId: STAGING_ORG.id,
      metric: ctx.rng.pick(['yield', 'income', 'training', 'compliance', 'membership'] as const),
      value: ctx.rng.intBetween(10, 9999),
      periodStart: start.toISOString(),
      periodEnd: new Date(start.getTime() + 30 * 86_400_000).toISOString(),
    }
  })

  const traceabilityRollups: SyntheticTraceabilityRollup[] = Array.from({ length: scale.traceabilityRollups }, () => {
    const start = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    return {
      id: ctx.rng.id('trace-rollup'),
      orgId: STAGING_ORG.id,
      batchCount: ctx.rng.intBetween(5, 200),
      verifiedPct: ctx.rng.intBetween(60, 100),
      windowStart: start.toISOString(),
      windowEnd: new Date(start.getTime() + 7 * 86_400_000).toISOString(),
    }
  })

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users, count: scale.activityLogs })

  return { orgs, users, forecasts, priceSignals, risks, cooperativeMetrics, traceabilityRollups, notifications, activityLogs }
}

const seeder: SeederModule = {
  app: 'cora',
  description: 'Cora synthetic intelligence: yield forecasts, price signals, risk analyses, cooperative metrics, traceability rollups.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)
    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'users', entity: 'users', count: plan.users.length })
    ctx.report.step({ step: 'forecasts', entity: 'forecasts', count: plan.forecasts.length })
    ctx.report.step({ step: 'price_signals', entity: 'signals', count: plan.priceSignals.length })
    ctx.report.step({ step: 'risks', entity: 'risks', count: plan.risks.length })
    ctx.report.step({ step: 'cooperative_metrics', entity: 'metrics', count: plan.cooperativeMetrics.length })
    ctx.report.step({ step: 'traceability_rollups', entity: 'rollups', count: plan.traceabilityRollups.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    if (ctx.dryRun) {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'dry-run mode' })
    } else {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'phase 2: plan-only — DB writers land in phase 3' })
    }

    ctx.logger.info('cora seed plan computed', {
      profile: ctx.profile, forecasts: plan.forecasts.length, signals: plan.priceSignals.length, risks: plan.risks.length, org: STAGING_ORG.id,
    })
    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    ctx.report.step({ step: 'reset', count: 0, skipped: true, note: `phase 2: nothing to reset — staging org "${STAGING_ORG.id}" untouched` })
    ctx.logger.info('cora reset (no-op in phase 2)', { org: STAGING_ORG.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_ORG, coraScale, buildPlan }
