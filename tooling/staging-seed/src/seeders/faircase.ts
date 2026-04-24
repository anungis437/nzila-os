/**
 * FairCase per-app staging seeder (consumer-facing benefits/case management,
 * historically the ABR app).
 *
 * Generates synthetic case data: case files, applicants, evidence
 * artifacts, hearings, decisions, payments, follow-ups.
 *
 * PLAN-ONLY in phase 2 — backend writes land in phase 3.
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
  id: 'org-faircase-staging-tribunal-9999',
  name: 'FairCase Staging Tribunal 9999',
  slug: 'faircase-staging-tribunal-9999',
}

interface FairCaseScale {
  readonly applicants: number
  readonly cases: number
  readonly evidence: number
  readonly hearings: number
  readonly decisions: number
  readonly payments: number
  readonly followUps: number
  readonly notifications: number
  readonly activityLogs: number
}

function faircaseScale(profile: SeedProfile): FairCaseScale {
  switch (profile) {
    case 'demo-light':
      return { applicants: 30, cases: 40, evidence: 100, hearings: 20, decisions: 25, payments: 30, followUps: 30, notifications: 50, activityLogs: 200 }
    case 'demo-standard':
      return { applicants: 150, cases: 200, evidence: 600, hearings: 100, decisions: 130, payments: 160, followUps: 160, notifications: 250, activityLogs: 1000 }
    case 'executive-showcase':
      return { applicants: 700, cases: 1000, evidence: 3500, hearings: 500, decisions: 700, payments: 800, followUps: 800, notifications: 1500, activityLogs: 5000 }
    case 'investor-showcase':
      return { applicants: 2000, cases: 2800, evidence: 10_000, hearings: 1500, decisions: 2100, payments: 2400, followUps: 2400, notifications: 4500, activityLogs: 14_000 }
  }
}

const CASE_TYPES = ['benefits-appeal', 'wrongful-denial', 'overpayment', 'eligibility', 'reconsideration', 'expedited-review'] as const
const CASE_STATUSES = ['intake', 'review', 'awaiting-evidence', 'hearing-scheduled', 'decided', 'closed'] as const
const HEARING_FORMATS = ['in-person', 'virtual', 'phone', 'paper-only'] as const
const DECISION_OUTCOMES = ['allowed', 'partially-allowed', 'denied', 'remanded', 'withdrawn'] as const
const EVIDENCE_KINDS = ['letter', 'medical-record', 'invoice', 'bank-statement', 'employment-record', 'witness-statement', 'photo'] as const
const PAYMENT_KINDS = ['retroactive-benefit', 'lump-sum', 'monthly-restart', 'reimbursement'] as const
const FOLLOW_UP_KINDS = ['call', 'letter', 'meeting', 'document-request', 'reminder'] as const

interface SyntheticApplicant {
  readonly id: string
  readonly orgId: string
  readonly fullName: string
  readonly intakeAt: string
}

interface SyntheticCase {
  readonly id: string
  readonly orgId: string
  readonly applicantId: string
  readonly caseType: (typeof CASE_TYPES)[number]
  readonly status: (typeof CASE_STATUSES)[number]
  readonly openedAt: string
}

interface SyntheticEvidence {
  readonly id: string
  readonly caseId: string
  readonly kind: (typeof EVIDENCE_KINDS)[number]
  readonly submittedAt: string
  readonly verified: boolean
}

interface SyntheticHearing {
  readonly id: string
  readonly caseId: string
  readonly format: (typeof HEARING_FORMATS)[number]
  readonly scheduledAt: string
}

interface SyntheticDecision {
  readonly id: string
  readonly caseId: string
  readonly outcome: (typeof DECISION_OUTCOMES)[number]
  readonly issuedAt: string
}

interface SyntheticPayment {
  readonly id: string
  readonly caseId: string
  readonly kind: (typeof PAYMENT_KINDS)[number]
  readonly amountCents: number
  readonly issuedAt: string
}

interface SyntheticFollowUp {
  readonly id: string
  readonly caseId: string
  readonly kind: (typeof FOLLOW_UP_KINDS)[number]
  readonly dueAt: string
  readonly completed: boolean
}

function buildPlan(ctx: SeedContext) {
  const scale = faircaseScale(ctx.profile)

  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [{ ...baseOrg, ...STAGING_ORG, sector: 'public-benefits', tier: 'enterprise' as const }]

  const applicantPeople = shared.fakePeople(ctx.rng, ctx.time, scale.applicants)
  const users = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people: applicantPeople, organizations: orgs, count: scale.applicants })

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()
  const ts = () => new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString()

  const applicants: SyntheticApplicant[] = applicantPeople.map((p) => ({
    id: ctx.rng.id('applicant'),
    orgId: STAGING_ORG.id,
    fullName: p.fullName,
    intakeAt: ts(),
  }))

  const cases: SyntheticCase[] = Array.from({ length: scale.cases }, () => ({
    id: ctx.rng.id('case'),
    orgId: STAGING_ORG.id,
    applicantId: ctx.rng.pick(applicants).id,
    caseType: ctx.rng.pick(CASE_TYPES),
    status: ctx.rng.pick(CASE_STATUSES),
    openedAt: ts(),
  }))

  const evidence: SyntheticEvidence[] = Array.from({ length: scale.evidence }, () => ({
    id: ctx.rng.id('evidence'),
    caseId: ctx.rng.pick(cases).id,
    kind: ctx.rng.pick(EVIDENCE_KINDS),
    submittedAt: ts(),
    verified: ctx.rng.next() > 0.25,
  }))

  const hearings: SyntheticHearing[] = Array.from({ length: scale.hearings }, () => ({
    id: ctx.rng.id('hearing'),
    caseId: ctx.rng.pick(cases).id,
    format: ctx.rng.pick(HEARING_FORMATS),
    scheduledAt: ctx.time.daysAhead(ctx.rng.intBetween(7, 120)).toISOString(),
  }))

  const decisions: SyntheticDecision[] = Array.from({ length: scale.decisions }, () => ({
    id: ctx.rng.id('decision'),
    caseId: ctx.rng.pick(cases).id,
    outcome: ctx.rng.pick(DECISION_OUTCOMES),
    issuedAt: ts(),
  }))

  const payments: SyntheticPayment[] = Array.from({ length: scale.payments }, () => ({
    id: ctx.rng.id('payment'),
    caseId: ctx.rng.pick(cases).id,
    kind: ctx.rng.pick(PAYMENT_KINDS),
    amountCents: ctx.rng.intBetween(100_00, 500_000),
    issuedAt: ts(),
  }))

  const followUps: SyntheticFollowUp[] = Array.from({ length: scale.followUps }, () => ({
    id: ctx.rng.id('follow-up'),
    caseId: ctx.rng.pick(cases).id,
    kind: ctx.rng.pick(FOLLOW_UP_KINDS),
    dueAt: ctx.time.daysAhead(ctx.rng.intBetween(1, 60)).toISOString(),
    completed: ctx.rng.next() > 0.4,
  }))

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users, count: scale.activityLogs })

  return { orgs, users, applicants, cases, evidence, hearings, decisions, payments, followUps, notifications, activityLogs }
}

const seeder: SeederModule = {
  app: 'faircase',
  description: 'FairCase synthetic tribunal: applicants, cases, evidence, hearings, decisions, payments, follow-ups.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)
    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'users', entity: 'users', count: plan.users.length })
    ctx.report.step({ step: 'applicants', entity: 'applicants', count: plan.applicants.length })
    ctx.report.step({ step: 'cases', entity: 'cases', count: plan.cases.length })
    ctx.report.step({ step: 'evidence', entity: 'evidence', count: plan.evidence.length })
    ctx.report.step({ step: 'hearings', entity: 'hearings', count: plan.hearings.length })
    ctx.report.step({ step: 'decisions', entity: 'decisions', count: plan.decisions.length })
    ctx.report.step({ step: 'payments', entity: 'payments', count: plan.payments.length })
    ctx.report.step({ step: 'follow_ups', entity: 'follow_ups', count: plan.followUps.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    if (ctx.dryRun) {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'dry-run mode' })
    } else {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'phase 2: plan-only — DB writers land in phase 3' })
    }

    ctx.logger.info('faircase seed plan computed', {
      profile: ctx.profile, cases: plan.cases.length, evidence: plan.evidence.length, decisions: plan.decisions.length, org: STAGING_ORG.id,
    })
    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    ctx.report.step({ step: 'reset', count: 0, skipped: true, note: `phase 2: nothing to reset — staging org "${STAGING_ORG.id}" untouched` })
    ctx.logger.info('faircase reset (no-op in phase 2)', { org: STAGING_ORG.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_ORG, faircaseScale, buildPlan }
