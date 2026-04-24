/**
 * Union-Eyes per-app staging seeder.
 *
 * Generates synthetic union-local domain data (members, stewards, worksites,
 * grievances, claims, dues invoices, CBA, notifications, activity logs)
 * scoped to a single staging-only org, and surfaces counts via the shared
 * reporter.
 *
 * IMPORTANT: This module currently ONLY computes the synthetic plan and
 * reports counts. Actual DB writes against the Django-managed source-of-truth
 * tables and Drizzle edge/cache tables are intentionally deferred to a
 * follow-up PR (Phase 3) so reviewers can audit the entity shapes first.
 *
 * The module registers itself when imported. The CLI imports it from
 * `tooling/staging-seed/src/cli.ts:loadAppSeeders()`.
 */
import {
  registerSeeder,
  shared,
  type SeedAppReport,
  type SeedContext,
  type SeedProfile,
  type SeederModule,
} from '@nzila/staging-seed'

const SUPPORTED_PROFILES: readonly SeedProfile[] = [
  'demo-light',
  'demo-standard',
  'executive-showcase',
  'investor-showcase',
]

const STAGING_LOCAL = {
  id: 'org-ue-staging-local-9999',
  name: 'CUPE Staging Local 9999',
  type: 'local' as const,
  jurisdiction: 'staging',
}

interface UnionEyesScale {
  readonly members: number
  readonly stewards: number
  readonly worksites: number
  readonly grievances: number
  readonly claims: number
  readonly duesInvoices: number
  readonly cbaCount: number
  readonly notifications: number
  readonly activityLogs: number
}

function unionEyesScale(profile: SeedProfile): UnionEyesScale {
  switch (profile) {
    case 'demo-light':
      return { members: 80, stewards: 4, worksites: 3, grievances: 12, claims: 18, duesInvoices: 80, cbaCount: 1, notifications: 60, activityLogs: 120 }
    case 'demo-standard':
      return { members: 400, stewards: 16, worksites: 5, grievances: 60, claims: 90, duesInvoices: 400, cbaCount: 1, notifications: 300, activityLogs: 800 }
    case 'executive-showcase':
      return { members: 2500, stewards: 100, worksites: 12, grievances: 280, claims: 420, duesInvoices: 2500, cbaCount: 2, notifications: 1800, activityLogs: 4000 }
    case 'investor-showcase':
      return { members: 6000, stewards: 240, worksites: 24, grievances: 600, claims: 900, duesInvoices: 6000, cbaCount: 3, notifications: 4200, activityLogs: 9000 }
    default: {
      const _exhaustive: never = profile
      throw new Error(`Unsupported seed profile: ${String(_exhaustive)}`)
    }
  }
}

const WORKSITE_NAMES = [
  'Downtown Service Centre', 'East Operations Yard', 'West Hub', 'North Depot',
  'South Branch', 'Central Maintenance', 'Riverside Plant', 'Harbour Terminal',
  'Airport Annex', 'Suburban Outpost', 'Industrial Park A', 'Industrial Park B',
  'Heritage Building', 'Civic Square', 'Transit Yard', 'Lakeside Centre',
  'Hilltop Office', 'Ridge Facility', 'Valley Operations', 'Coastal Hub',
  'Plateau Site', 'Old Town Office', 'New Town Office', 'Crossroads Centre',
] as const

const GRIEVANCE_STAGES = ['intake', 'step1', 'step2', 'step3', 'arbitration', 'closed'] as const
const GRIEVANCE_OUTCOMES = ['settled', 'withdrawn', 'upheld', 'denied', 'pending'] as const
const CLAIM_TYPES = ['benefits', 'wage', 'pension', 'health', 'wcb', 'leave'] as const
const CLAIM_STATUSES = ['intake', 'in_review', 'approved', 'denied', 'paid'] as const

interface SyntheticWorksite {
  readonly id: string
  readonly orgId: string
  readonly name: string
  readonly address: string
  readonly workerCount: number
}

interface SyntheticGrievance {
  readonly id: string
  readonly workerId: string
  readonly worksite: string
  readonly stage: (typeof GRIEVANCE_STAGES)[number]
  readonly outcome: (typeof GRIEVANCE_OUTCOMES)[number]
  readonly filedAt: string
  readonly resolvedAt: string | null
  readonly cbaArticle: string
}

interface SyntheticClaim {
  readonly id: string
  readonly workerId: string
  readonly type: (typeof CLAIM_TYPES)[number]
  readonly status: (typeof CLAIM_STATUSES)[number]
  readonly filedAt: string
  readonly amountCents: number
}

interface SyntheticCBA {
  readonly id: string
  readonly title: string
  readonly effectiveFrom: string
  readonly effectiveTo: string
  readonly partyEmployer: string
  readonly partyUnion: string
  readonly articleCount: number
}

interface SyntheticStewardAssignment {
  readonly userId: string
  readonly worksite: string
}

function buildPlan(ctx: SeedContext) {
  const scale = unionEyesScale(ctx.profile)

  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [
    { ...baseOrg, id: STAGING_LOCAL.id, name: STAGING_LOCAL.name, slug: 'cupe-staging-local-9999', sector: 'public-sector', tier: 'enterprise' as const },
  ]

  const people = shared.fakePeople(ctx.rng, ctx.time, scale.members)
  const users = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people, organizations: orgs, count: scale.members })

  const worksiteNames = WORKSITE_NAMES.slice(0, scale.worksites)
  const worksites: SyntheticWorksite[] = worksiteNames.map((name, i) => ({
    id: ctx.rng.id('worksite'),
    orgId: STAGING_LOCAL.id,
    name,
    address: `${100 + i * 10} Synthetic Ave, Staging City`,
    workerCount: Math.floor(scale.members / scale.worksites),
  }))

  const stewards: SyntheticStewardAssignment[] = users.slice(0, scale.stewards).map((u, i) => ({
    userId: u.id,
    worksite: worksiteNames[i % worksiteNames.length]!,
  }))

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()

  const grievances: SyntheticGrievance[] = Array.from({ length: scale.grievances }, () => {
    const stage = ctx.rng.pick(GRIEVANCE_STAGES)
    const outcome = stage === 'closed' ? ctx.rng.pick(GRIEVANCE_OUTCOMES) : 'pending'
    const filedAt = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    const resolvedAt =
      stage === 'closed'
        ? new Date(filedAt.getTime() + ctx.rng.intBetween(7, 180) * 86_400_000).toISOString()
        : null
    return {
      id: ctx.rng.id('grievance'),
      workerId: ctx.rng.pick(people).id,
      worksite: ctx.rng.pick(worksiteNames),
      stage,
      outcome,
      filedAt: filedAt.toISOString(),
      resolvedAt,
      cbaArticle: `Art. ${ctx.rng.intBetween(1, 42)}.${ctx.rng.intBetween(1, 9)}`,
    }
  })

  const claims: SyntheticClaim[] = Array.from({ length: scale.claims }, () => {
    const filedAt = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    return {
      id: ctx.rng.id('claim'),
      workerId: ctx.rng.pick(people).id,
      type: ctx.rng.pick(CLAIM_TYPES),
      status: ctx.rng.pick(CLAIM_STATUSES),
      filedAt: filedAt.toISOString(),
      amountCents: ctx.rng.intBetween(15_000, 850_000),
    }
  })

  const duesInvoices = shared.fakeInvoices({ rng: ctx.rng, time: ctx.time, organizations: orgs, count: scale.duesInvoices })

  const cbas: SyntheticCBA[] = Array.from({ length: scale.cbaCount }, (_, i) => ({
    id: ctx.rng.id('cba'),
    title: `${STAGING_LOCAL.name} – Master Agreement v${i + 1}`,
    effectiveFrom: ctx.time.daysAgo(365 * (i + 1)).toISOString(),
    effectiveTo: ctx.time.daysAhead(365 * Math.max(1, 3 - i)).toISOString(),
    partyEmployer: 'Synthetic Public Employer Inc.',
    partyUnion: STAGING_LOCAL.name,
    articleCount: 35 + i * 4,
  }))

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users, count: scale.activityLogs })

  return { orgs, people, users, stewards, worksites, grievances, claims, duesInvoices, cbas, notifications, activityLogs }
}

const seeder: SeederModule = {
  app: 'union-eyes',
  description: 'Union-Eyes synthetic local: members, stewards, worksites, grievances, claims, dues invoices, CBAs.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)

    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'members', entity: 'people', count: plan.people.length })
    ctx.report.step({ step: 'users', entity: 'users', count: plan.users.length })
    ctx.report.step({ step: 'stewards', entity: 'users', count: plan.stewards.length })
    ctx.report.step({ step: 'worksites', entity: 'worksites', count: plan.worksites.length })
    ctx.report.step({ step: 'grievances', entity: 'grievances', count: plan.grievances.length })
    ctx.report.step({ step: 'claims', entity: 'claims', count: plan.claims.length })
    ctx.report.step({ step: 'dues_invoices', entity: 'invoices', count: plan.duesInvoices.length })
    ctx.report.step({ step: 'cba', entity: 'agreements', count: plan.cbas.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    if (ctx.dryRun) {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'dry-run mode' })
    } else {
      // TODO(phase-3): Wire actual DB writers (Drizzle ue_cache + Django API)
      // scoped exclusively to STAGING_LOCAL.id. Until then, the seeder is
      // plan-only so reviewers can audit the entity shape safely.
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'phase 2: plan-only — DB writers land in phase 3' })
    }

    ctx.logger.info('union-eyes seed plan computed', {
      profile: ctx.profile,
      members: plan.people.length,
      grievances: plan.grievances.length,
      claims: plan.claims.length,
      org: STAGING_LOCAL.id,
    })

    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    ctx.report.step({
      step: 'reset',
      count: 0,
      skipped: true,
      note: `phase 2: nothing to reset — staging org "${STAGING_LOCAL.id}" untouched`,
    })
    ctx.logger.info('union-eyes reset (no-op in phase 2)', { org: STAGING_LOCAL.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_LOCAL, unionEyesScale, buildPlan }
