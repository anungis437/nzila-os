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
 * Per-app seeders live INSIDE the staging-seed package (rather than inside
 * each app) so they all share a single registry instance — pnpm symlinks
 * would otherwise produce two distinct module instances and the registry
 * mutation in app-side code would never be visible to the CLI runner.
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

/**
 * CBA Intelligence parity constants.
 *
 * Locked to (4 sources, 3 documents, 3 findings, 1 review decision) to
 * preserve parity with `docs/governance/CBA_INTELLIGENCE_VALIDATION_REPORT.md`
 * line 365. These counts are independent of `SeedProfile` because the
 * validation report cites them as a fixed contract — changing the counts
 * here requires updating that report in the same PR.
 */
const CBA_INTEL_PARITY = {
  sources: 4,
  documents: 3,
  findings: 3,
  reviewDecisions: 1,
} as const

interface SyntheticCbaIntelSource {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly sourceType: 'federal_labour' | 'provincial_labour_board' | 'legal_arbitration' | 'stats_benchmark'
  readonly trustTier: 'official' | 'authoritative'
  readonly jurisdictions: readonly string[]
  readonly baseUrl: string
  readonly updateCadence: 'daily' | 'weekly' | 'quarterly'
  readonly isActive: boolean
}

interface SyntheticCbaIntelDocument {
  readonly id: string
  readonly sourceId: string
  readonly sourceDocId: string
  readonly title: string
  readonly documentType: 'full_agreement' | 'arbitration_decision'
  readonly contentHash: string
  readonly version: number
}

interface SyntheticCbaIntelFinding {
  readonly id: string
  readonly documentId: string
  readonly findingType: string
  readonly clauseFamily: 'wages' | 'remote_hybrid' | 'health_safety'
  readonly label: string
  readonly value: string
  readonly confidence: string
  readonly reviewStatus: 'pending_review' | 'approved'
}

interface SyntheticCbaIntelReviewDecision {
  readonly id: string
  readonly findingId: string
  readonly decision: 'approved'
  readonly reviewerRole: 'officer'
  readonly reason: string
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

  const cbaIntel = buildCbaIntelligence(ctx)

  return { orgs, people, users, stewards, worksites, grievances, claims, duesInvoices, cbas, notifications, activityLogs, cbaIntel }
}

function buildCbaIntelligence(ctx: SeedContext): {
  readonly sources: readonly SyntheticCbaIntelSource[]
  readonly documents: readonly SyntheticCbaIntelDocument[]
  readonly findings: readonly SyntheticCbaIntelFinding[]
  readonly reviewDecisions: readonly SyntheticCbaIntelReviewDecision[]
} {
  // Deterministic IDs for cross-run stability and downstream foreign keys.
  const sources: SyntheticCbaIntelSource[] = [
    { id: ctx.rng.id('cba-src'), slug: 'fslrb-decisions', name: 'Federal Public Sector Labour Relations and Employment Board', sourceType: 'federal_labour', trustTier: 'official', jurisdictions: ['CA-FED'], baseUrl: 'https://decisions.fpslreb-crtespf.gc.ca', updateCadence: 'weekly', isActive: true },
    { id: ctx.rng.id('cba-src'), slug: 'olrb-decisions', name: 'Ontario Labour Relations Board', sourceType: 'provincial_labour_board', trustTier: 'official', jurisdictions: ['CA-ON'], baseUrl: 'https://www.olrb.gov.on.ca', updateCadence: 'weekly', isActive: true },
    { id: ctx.rng.id('cba-src'), slug: 'canlii-arbitration', name: 'CanLII Arbitration Decisions', sourceType: 'legal_arbitration', trustTier: 'authoritative', jurisdictions: ['CA-FED', 'CA-ON', 'CA-QC', 'CA-BC', 'CA-AB'], baseUrl: 'https://www.canlii.org', updateCadence: 'daily', isActive: true },
    { id: ctx.rng.id('cba-src'), slug: 'statscan-wages', name: 'Statistics Canada — Wage Settlements', sourceType: 'stats_benchmark', trustTier: 'official', jurisdictions: ['CA-FED'], baseUrl: 'https://www150.statcan.gc.ca', updateCadence: 'quarterly', isActive: true },
  ]

  // All 3 documents anchor to the FSLRB source (matches legacy seed shape).
  const fslrb = sources[0]!
  const documents: SyntheticCbaIntelDocument[] = [
    { id: ctx.rng.id('cba-doc'), sourceId: fslrb.id, sourceDocId: 'FPSLREB-2026-001', title: 'PSAC v. Treasury Board — Wages Group (PA) — 2026 Renewal', documentType: 'full_agreement', contentHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', version: 1 },
    { id: ctx.rng.id('cba-doc'), sourceId: fslrb.id, sourceDocId: 'FPSLREB-2026-002', title: 'CAPE v. Treasury Board — Economics Group (EC) — Arbitration', documentType: 'arbitration_decision', contentHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', version: 1 },
    { id: ctx.rng.id('cba-doc'), sourceId: fslrb.id, sourceDocId: 'FPSLREB-2026-003', title: 'PIPSC v. CRA — Audit Group (AU) — Health & Safety', documentType: 'full_agreement', contentHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', version: 1 },
  ]

  const findings: SyntheticCbaIntelFinding[] = [
    { id: ctx.rng.id('cba-find'), documentId: documents[0]!.id, findingType: 'wage_adjustment', clauseFamily: 'wages', label: 'PA Group Annual Wage Increase — 2026', value: '3.5% base salary increase for PA group effective April 1, 2026.', confidence: '0.920', reviewStatus: 'approved' },
    { id: ctx.rng.id('cba-find'), documentId: documents[1]!.id, findingType: 'arbitration_outcome', clauseFamily: 'remote_hybrid', label: 'EC Group Binding Arbitration — Remote Work', value: 'Arbitrator ruled in favour of 3-day per week remote work for EC group.', confidence: '0.880', reviewStatus: 'pending_review' },
    { id: ctx.rng.id('cba-find'), documentId: documents[2]!.id, findingType: 'provision_change', clauseFamily: 'health_safety', label: 'AU Group — Enhanced Ergonomic Assessment Requirements', value: 'New provision requiring employer-funded ergonomic assessments every 2 years.', confidence: '0.850', reviewStatus: 'pending_review' },
  ]

  // Single approved review decision against the first finding (parity).
  const reviewDecisions: SyntheticCbaIntelReviewDecision[] = [
    { id: ctx.rng.id('cba-rev'), findingId: findings[0]!.id, decision: 'approved', reviewerRole: 'officer', reason: 'Verified against official FPSLREB decision text.' },
  ]

  if (sources.length !== CBA_INTEL_PARITY.sources)
    throw new Error(`CBA Intelligence parity drift: sources expected=${CBA_INTEL_PARITY.sources} got=${sources.length}`)
  if (documents.length !== CBA_INTEL_PARITY.documents)
    throw new Error(`CBA Intelligence parity drift: documents expected=${CBA_INTEL_PARITY.documents} got=${documents.length}`)
  if (findings.length !== CBA_INTEL_PARITY.findings)
    throw new Error(`CBA Intelligence parity drift: findings expected=${CBA_INTEL_PARITY.findings} got=${findings.length}`)
  if (reviewDecisions.length !== CBA_INTEL_PARITY.reviewDecisions)
    throw new Error(`CBA Intelligence parity drift: reviewDecisions expected=${CBA_INTEL_PARITY.reviewDecisions} got=${reviewDecisions.length}`)

  return { sources, documents, findings, reviewDecisions }
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
    ctx.report.step({ step: 'cba_intel_sources', entity: 'cba_intel_sources', count: plan.cbaIntel.sources.length })
    ctx.report.step({ step: 'cba_intel_documents', entity: 'cba_intel_documents', count: plan.cbaIntel.documents.length })
    ctx.report.step({ step: 'cba_intel_findings', entity: 'cba_intel_findings', count: plan.cbaIntel.findings.length })
    ctx.report.step({ step: 'cba_intel_review_decisions', entity: 'cba_intel_review_decisions', count: plan.cbaIntel.reviewDecisions.length })

    await persistOrSkip(ctx, STAGING_LOCAL.id, [
      { entityType: 'organizations', rows: plan.orgs },
      { entityType: 'members', rows: plan.people },
      { entityType: 'users', rows: plan.users },
      { entityType: 'stewards', rows: plan.stewards.map((s, i) => ({ id: `steward-${ctx.profile}-${i}`, ...s })) },
      { entityType: 'worksites', rows: plan.worksites },
      { entityType: 'grievances', rows: plan.grievances },
      { entityType: 'claims', rows: plan.claims },
      { entityType: 'dues_invoices', rows: plan.duesInvoices },
      { entityType: 'cba', rows: plan.cbas },
      { entityType: 'notifications', rows: plan.notifications },
      { entityType: 'activity_logs', rows: plan.activityLogs },
      { entityType: 'cba_intel_sources', rows: plan.cbaIntel.sources },
      { entityType: 'cba_intel_documents', rows: plan.cbaIntel.documents },
      { entityType: 'cba_intel_findings', rows: plan.cbaIntel.findings },
      { entityType: 'cba_intel_review_decisions', rows: plan.cbaIntel.reviewDecisions },
    ])

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
    await persistResetOrSkip(ctx, STAGING_LOCAL.id)
    ctx.logger.info('union-eyes reset', { org: STAGING_LOCAL.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_LOCAL, unionEyesScale, buildPlan, buildCbaIntelligence, CBA_INTEL_PARITY }
