/**
 * Zonga per-app staging seeder (creator economy / music distribution).
 *
 * Generates synthetic creator-economy data (creators, releases, tracks,
 * listeners, revenue events, payouts, royalty splits, subscriptions,
 * playlists, events/tickets, moderation cases) scoped to a single
 * staging-only org.
 *
 * PLAN-ONLY in phase 2 — Drizzle writes against `zonga*` tables land
 * in phase 3.
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
  id: 'org-zonga-staging-label-9999',
  name: 'Zonga Staging Label 9999',
  slug: 'zonga-staging-label-9999',
}

interface ZongaScale {
  readonly creators: number
  readonly releases: number
  readonly tracks: number
  readonly listeners: number
  readonly revenueEvents: number
  readonly payouts: number
  readonly royaltySplits: number
  readonly subscriptions: number
  readonly playlists: number
  readonly events: number
  readonly ticketPurchases: number
  readonly moderationCases: number
  readonly notifications: number
  readonly activityLogs: number
}

function zongaScale(profile: SeedProfile): ZongaScale {
  switch (profile) {
    case 'demo-light':
      return { creators: 20, releases: 30, tracks: 90, listeners: 150, revenueEvents: 400, payouts: 30, royaltySplits: 60, subscriptions: 80, playlists: 12, events: 4, ticketPurchases: 60, moderationCases: 6, notifications: 80, activityLogs: 250 }
    case 'demo-standard':
      return { creators: 100, releases: 180, tracks: 540, listeners: 800, revenueEvents: 3000, payouts: 180, royaltySplits: 360, subscriptions: 400, playlists: 60, events: 16, ticketPurchases: 400, moderationCases: 25, notifications: 400, activityLogs: 1500 }
    case 'executive-showcase':
      return { creators: 500, releases: 900, tracks: 2700, listeners: 4500, revenueEvents: 18_000, payouts: 900, royaltySplits: 1800, subscriptions: 2200, playlists: 280, events: 80, ticketPurchases: 2200, moderationCases: 120, notifications: 2200, activityLogs: 8000 }
    case 'investor-showcase':
      return { creators: 1500, releases: 2700, tracks: 8100, listeners: 12_000, revenueEvents: 50_000, payouts: 2700, royaltySplits: 5400, subscriptions: 6500, playlists: 800, events: 200, ticketPurchases: 6500, moderationCases: 320, notifications: 6500, activityLogs: 20_000 }
  }
}

const RELEASE_TYPES = ['single', 'ep', 'album', 'mixtape', 'compilation'] as const
const REVENUE_SOURCES = ['stream_apple', 'stream_spotify', 'stream_youtube', 'stream_zonga', 'download', 'sync', 'tip'] as const
const PAYOUT_STATUSES = ['pending', 'processing', 'paid', 'failed'] as const
const SUBSCRIPTION_TIERS = ['free', 'basic', 'premium', 'family', 'student'] as const
const MODERATION_REASONS = ['copyright', 'explicit', 'spam', 'impersonation', 'metadata'] as const
const MODERATION_STATUSES = ['queued', 'in_review', 'resolved', 'escalated', 'dismissed'] as const

interface SyntheticCreator {
  readonly id: string
  readonly orgId: string
  readonly stageName: string
  readonly tier: 'emerging' | 'rising' | 'established' | 'legend'
  readonly followerCount: number
}

interface SyntheticRelease {
  readonly id: string
  readonly creatorId: string
  readonly title: string
  readonly type: (typeof RELEASE_TYPES)[number]
  readonly releasedAt: string
  readonly trackCount: number
}

interface SyntheticTrack {
  readonly id: string
  readonly releaseId: string
  readonly title: string
  readonly durationSec: number
  readonly isrc: string
}

interface SyntheticRevenueEvent {
  readonly id: string
  readonly trackId: string
  readonly source: (typeof REVENUE_SOURCES)[number]
  readonly grossCents: number
  readonly platformFeeCents: number
  readonly at: string
}

interface SyntheticPayout {
  readonly id: string
  readonly creatorId: string
  readonly amountCents: number
  readonly status: (typeof PAYOUT_STATUSES)[number]
  readonly periodStart: string
  readonly periodEnd: string
}

interface SyntheticRoyaltySplit {
  readonly id: string
  readonly trackId: string
  readonly creatorId: string
  readonly sharePct: number
}

interface SyntheticSubscription {
  readonly id: string
  readonly listenerId: string
  readonly tier: (typeof SUBSCRIPTION_TIERS)[number]
  readonly mrrCents: number
  readonly startedAt: string
}

interface SyntheticEvent {
  readonly id: string
  readonly creatorId: string
  readonly title: string
  readonly venue: string
  readonly startsAt: string
  readonly capacity: number
}

interface SyntheticTicketPurchase {
  readonly id: string
  readonly eventId: string
  readonly listenerId: string
  readonly priceCents: number
  readonly purchasedAt: string
}

interface SyntheticModerationCase {
  readonly id: string
  readonly subjectId: string
  readonly reason: (typeof MODERATION_REASONS)[number]
  readonly status: (typeof MODERATION_STATUSES)[number]
  readonly openedAt: string
}

function buildPlan(ctx: SeedContext) {
  const scale = zongaScale(ctx.profile)

  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [{ ...baseOrg, ...STAGING_ORG, sector: 'media', tier: 'enterprise' as const }]

  const creatorPeople = shared.fakePeople(ctx.rng, ctx.time, scale.creators)
  const creators: SyntheticCreator[] = creatorPeople.map((p) => ({
    id: ctx.rng.id('creator'),
    orgId: STAGING_ORG.id,
    stageName: p.fullName,
    tier: ctx.rng.pick(['emerging', 'rising', 'established', 'legend'] as const),
    followerCount: ctx.rng.intBetween(50, 500_000),
  }))

  const listenerPeople = shared.fakePeople(ctx.rng, ctx.time, scale.listeners)
  const listeners = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people: listenerPeople, organizations: orgs, count: scale.listeners })

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()

  const releases: SyntheticRelease[] = Array.from({ length: scale.releases }, () => {
    const type = ctx.rng.pick(RELEASE_TYPES)
    const trackCount = type === 'single' ? 1 : type === 'ep' ? ctx.rng.intBetween(3, 6) : ctx.rng.intBetween(8, 15)
    return {
      id: ctx.rng.id('release'),
      creatorId: ctx.rng.pick(creators).id,
      title: `Synthetic Release ${ctx.rng.intBetween(1, 9999)}`,
      type,
      releasedAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
      trackCount,
    }
  })

  const tracks: SyntheticTrack[] = Array.from({ length: scale.tracks }, (_, i) => ({
    id: ctx.rng.id('track'),
    releaseId: ctx.rng.pick(releases).id,
    title: `Track ${i + 1}`,
    durationSec: ctx.rng.intBetween(90, 360),
    isrc: `STG${String(ctx.rng.intBetween(1, 99_999_999)).padStart(9, '0')}`,
  }))

  const revenueEvents: SyntheticRevenueEvent[] = Array.from({ length: scale.revenueEvents }, () => {
    const gross = ctx.rng.intBetween(1, 500)
    return {
      id: ctx.rng.id('revenue'),
      trackId: ctx.rng.pick(tracks).id,
      source: ctx.rng.pick(REVENUE_SOURCES),
      grossCents: gross,
      platformFeeCents: Math.floor(gross * 0.15),
      at: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
    }
  })

  const payouts: SyntheticPayout[] = Array.from({ length: scale.payouts }, () => {
    const periodStart = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    const periodEnd = new Date(periodStart.getTime() + 30 * 86_400_000)
    return {
      id: ctx.rng.id('payout'),
      creatorId: ctx.rng.pick(creators).id,
      amountCents: ctx.rng.intBetween(500, 500_000),
      status: ctx.rng.pick(PAYOUT_STATUSES),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    }
  })

  const royaltySplits: SyntheticRoyaltySplit[] = Array.from({ length: scale.royaltySplits }, () => ({
    id: ctx.rng.id('split'),
    trackId: ctx.rng.pick(tracks).id,
    creatorId: ctx.rng.pick(creators).id,
    sharePct: ctx.rng.intBetween(5, 80),
  }))

  const subscriptions: SyntheticSubscription[] = Array.from({ length: scale.subscriptions }, () => {
    const tier = ctx.rng.pick(SUBSCRIPTION_TIERS)
    const mrr: Record<(typeof SUBSCRIPTION_TIERS)[number], number> = {
      free: 0, basic: 499, premium: 999, family: 1499, student: 499,
    }
    return {
      id: ctx.rng.id('subscription'),
      listenerId: ctx.rng.pick(listeners).id,
      tier,
      mrrCents: mrr[tier],
      startedAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
    }
  })

  const events: SyntheticEvent[] = Array.from({ length: scale.events }, (_, i) => ({
    id: ctx.rng.id('event'),
    creatorId: ctx.rng.pick(creators).id,
    title: `Synthetic Show ${i + 1}`,
    venue: ctx.rng.pick(['Synthetic Hall', 'Staging Arena', 'Demo Club', 'Test Stage', 'Pilot Lounge']),
    startsAt: ctx.time.daysAhead(ctx.rng.intBetween(7, 180)).toISOString(),
    capacity: ctx.rng.intBetween(100, 5000),
  }))

  const ticketPurchases: SyntheticTicketPurchase[] = Array.from({ length: scale.ticketPurchases }, () => ({
    id: ctx.rng.id('ticket'),
    eventId: ctx.rng.pick(events.length > 0 ? events : [{ id: 'fallback' } as SyntheticEvent]).id,
    listenerId: ctx.rng.pick(listeners).id,
    priceCents: ctx.rng.intBetween(2000, 25_000),
    purchasedAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
  }))

  const moderationCases: SyntheticModerationCase[] = Array.from({ length: scale.moderationCases }, () => ({
    id: ctx.rng.id('moderation'),
    subjectId: ctx.rng.pick(tracks).id,
    reason: ctx.rng.pick(MODERATION_REASONS),
    status: ctx.rng.pick(MODERATION_STATUSES),
    openedAt: new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString(),
  }))

  const playlists = Array.from({ length: scale.playlists }, (_, i) => ({
    id: ctx.rng.id('playlist'),
    ownerId: ctx.rng.pick(listeners).id,
    title: `Synthetic Playlist ${i + 1}`,
    trackCount: ctx.rng.intBetween(5, 60),
  }))

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users: listeners, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users: listeners, count: scale.activityLogs })

  return {
    orgs, creators, listeners, releases, tracks, revenueEvents, payouts,
    royaltySplits, subscriptions, playlists, events, ticketPurchases,
    moderationCases, notifications, activityLogs,
  }
}

const seeder: SeederModule = {
  app: 'zonga',
  description: 'Zonga synthetic label: creators, releases, tracks, revenue events, payouts, listeners, subscriptions, events, moderation.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)

    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'creators', entity: 'creators', count: plan.creators.length })
    ctx.report.step({ step: 'listeners', entity: 'users', count: plan.listeners.length })
    ctx.report.step({ step: 'releases', entity: 'releases', count: plan.releases.length })
    ctx.report.step({ step: 'tracks', entity: 'tracks', count: plan.tracks.length })
    ctx.report.step({ step: 'revenue_events', entity: 'revenue', count: plan.revenueEvents.length })
    ctx.report.step({ step: 'payouts', entity: 'payouts', count: plan.payouts.length })
    ctx.report.step({ step: 'royalty_splits', entity: 'splits', count: plan.royaltySplits.length })
    ctx.report.step({ step: 'subscriptions', entity: 'subscriptions', count: plan.subscriptions.length })
    ctx.report.step({ step: 'playlists', entity: 'playlists', count: plan.playlists.length })
    ctx.report.step({ step: 'events', entity: 'events', count: plan.events.length })
    ctx.report.step({ step: 'ticket_purchases', entity: 'tickets', count: plan.ticketPurchases.length })
    ctx.report.step({ step: 'moderation_cases', entity: 'moderation', count: plan.moderationCases.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    if (ctx.dryRun) {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'dry-run mode' })
    } else {
      // TODO(phase-3): Wire Drizzle writes for zonga* tables, scoped to STAGING_ORG.id only.
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'phase 2: plan-only — DB writers land in phase 3' })
    }

    ctx.logger.info('zonga seed plan computed', {
      profile: ctx.profile,
      creators: plan.creators.length,
      releases: plan.releases.length,
      tracks: plan.tracks.length,
      revenueEvents: plan.revenueEvents.length,
      org: STAGING_ORG.id,
    })
    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    ctx.report.step({
      step: 'reset',
      count: 0,
      skipped: true,
      note: `phase 2: nothing to reset — staging org "${STAGING_ORG.id}" untouched`,
    })
    ctx.logger.info('zonga reset (no-op in phase 2)', { org: STAGING_ORG.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_ORG, zongaScale, buildPlan }
