/**
 * Console per-app staging seeder (operations dashboard).
 *
 * Console is an in-memory aggregator UI today (no durable store). The seeder
 * therefore models the synthetic surfaces a staging operator would expect to
 * see in the dashboard: app health snapshots, deploy events, on-call shifts,
 * incidents, runbook executions, and audit log entries.
 *
 * PLAN-ONLY in phase 2 — when console gains durable storage, phase 3 will
 * wire the writers; until then the report doubles as a fixture spec.
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
  id: 'org-console-staging-ops-9999',
  name: 'Console Staging Operators 9999',
  slug: 'console-staging-ops-9999',
}

interface ConsoleScale {
  readonly appHealthSnapshots: number
  readonly deployEvents: number
  readonly onCallShifts: number
  readonly incidents: number
  readonly runbookExecutions: number
  readonly auditEntries: number
  readonly notifications: number
  readonly activityLogs: number
}

function consoleScale(profile: SeedProfile): ConsoleScale {
  switch (profile) {
    case 'demo-light':
      return { appHealthSnapshots: 30, deployEvents: 20, onCallShifts: 10, incidents: 5, runbookExecutions: 15, auditEntries: 60, notifications: 30, activityLogs: 100 }
    case 'demo-standard':
      return { appHealthSnapshots: 150, deployEvents: 80, onCallShifts: 40, incidents: 20, runbookExecutions: 60, auditEntries: 300, notifications: 150, activityLogs: 500 }
    case 'executive-showcase':
      return { appHealthSnapshots: 700, deployEvents: 350, onCallShifts: 180, incidents: 90, runbookExecutions: 250, auditEntries: 1500, notifications: 700, activityLogs: 2500 }
    case 'investor-showcase':
      return { appHealthSnapshots: 2000, deployEvents: 1000, onCallShifts: 500, incidents: 250, runbookExecutions: 700, auditEntries: 4500, notifications: 2000, activityLogs: 7000 }
  }
}

const TRACKED_APPS = ['web', 'union-eyes', 'flow', 'zonga', 'weekone', 'agrimo', 'cora', 'faircase', 'partners', 'platform-admin'] as const
const HEALTH_STATUSES = ['healthy', 'degraded', 'unhealthy', 'unknown'] as const
const DEPLOY_OUTCOMES = ['succeeded', 'rolled-back', 'failed', 'in-progress'] as const
const INCIDENT_SEVERITIES = ['sev1', 'sev2', 'sev3', 'sev4'] as const
const INCIDENT_STATUSES = ['open', 'mitigated', 'resolved', 'post-mortem'] as const
const RUNBOOK_KINDS = ['restart-app', 'rotate-secret', 'failover-db', 'flush-cache', 'scale-up', 'scale-down', 'drain-queue'] as const
const RUNBOOK_OUTCOMES = ['ok', 'partial', 'failed'] as const
const AUDIT_ACTIONS = ['login', 'role-grant', 'role-revoke', 'config-change', 'secret-rotate', 'feature-flag-toggle'] as const

interface SyntheticHealthSnapshot {
  readonly id: string
  readonly app: (typeof TRACKED_APPS)[number]
  readonly status: (typeof HEALTH_STATUSES)[number]
  readonly latencyMs: number
  readonly errorRatePct: number
  readonly observedAt: string
}

interface SyntheticDeployEvent {
  readonly id: string
  readonly app: (typeof TRACKED_APPS)[number]
  readonly outcome: (typeof DEPLOY_OUTCOMES)[number]
  readonly commitSha: string
  readonly deployedAt: string
}

interface SyntheticOnCallShift {
  readonly id: string
  readonly orgId: string
  readonly userId: string
  readonly startsAt: string
  readonly endsAt: string
}

interface SyntheticIncident {
  readonly id: string
  readonly orgId: string
  readonly app: (typeof TRACKED_APPS)[number]
  readonly severity: (typeof INCIDENT_SEVERITIES)[number]
  readonly status: (typeof INCIDENT_STATUSES)[number]
  readonly openedAt: string
}

interface SyntheticRunbookExecution {
  readonly id: string
  readonly orgId: string
  readonly kind: (typeof RUNBOOK_KINDS)[number]
  readonly outcome: (typeof RUNBOOK_OUTCOMES)[number]
  readonly executedAt: string
}

interface SyntheticAuditEntry {
  readonly id: string
  readonly orgId: string
  readonly action: (typeof AUDIT_ACTIONS)[number]
  readonly actorUserId: string
  readonly at: string
}

function buildPlan(ctx: SeedContext) {
  const scale = consoleScale(ctx.profile)
  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [{ ...baseOrg, ...STAGING_ORG, sector: 'platform-ops', tier: 'enterprise' as const }]
  const operatorPeople = shared.fakePeople(ctx.rng, ctx.time, 8)
  const users = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people: operatorPeople, organizations: orgs, count: 8 })

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()
  const ts = () => new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString()

  const appHealthSnapshots: SyntheticHealthSnapshot[] = Array.from({ length: scale.appHealthSnapshots }, () => ({
    id: ctx.rng.id('health'),
    app: ctx.rng.pick(TRACKED_APPS),
    status: ctx.rng.pick(HEALTH_STATUSES),
    latencyMs: ctx.rng.intBetween(20, 2000),
    errorRatePct: ctx.rng.intBetween(0, 25),
    observedAt: ts(),
  }))

  const deployEvents: SyntheticDeployEvent[] = Array.from({ length: scale.deployEvents }, () => ({
    id: ctx.rng.id('deploy'),
    app: ctx.rng.pick(TRACKED_APPS),
    outcome: ctx.rng.pick(DEPLOY_OUTCOMES),
    commitSha: ctx.rng.id('sha').slice(-12),
    deployedAt: ts(),
  }))

  const onCallShifts: SyntheticOnCallShift[] = Array.from({ length: scale.onCallShifts }, () => {
    const start = new Date(window.start.getTime() + ctx.rng.next() * windowMs)
    return {
      id: ctx.rng.id('shift'),
      orgId: STAGING_ORG.id,
      userId: ctx.rng.pick(users).id,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 12 * 3_600_000).toISOString(),
    }
  })

  const incidents: SyntheticIncident[] = Array.from({ length: scale.incidents }, () => ({
    id: ctx.rng.id('incident'),
    orgId: STAGING_ORG.id,
    app: ctx.rng.pick(TRACKED_APPS),
    severity: ctx.rng.pick(INCIDENT_SEVERITIES),
    status: ctx.rng.pick(INCIDENT_STATUSES),
    openedAt: ts(),
  }))

  const runbookExecutions: SyntheticRunbookExecution[] = Array.from({ length: scale.runbookExecutions }, () => ({
    id: ctx.rng.id('runbook'),
    orgId: STAGING_ORG.id,
    kind: ctx.rng.pick(RUNBOOK_KINDS),
    outcome: ctx.rng.pick(RUNBOOK_OUTCOMES),
    executedAt: ts(),
  }))

  const auditEntries: SyntheticAuditEntry[] = Array.from({ length: scale.auditEntries }, () => ({
    id: ctx.rng.id('audit'),
    orgId: STAGING_ORG.id,
    action: ctx.rng.pick(AUDIT_ACTIONS),
    actorUserId: ctx.rng.pick(users).id,
    at: ts(),
  }))

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users, count: scale.activityLogs })

  return { orgs, users, appHealthSnapshots, deployEvents, onCallShifts, incidents, runbookExecutions, auditEntries, notifications, activityLogs }
}

const seeder: SeederModule = {
  app: 'console',
  description: 'Console synthetic ops dashboard: health snapshots, deploy events, on-call shifts, incidents, runbook executions, audit entries.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)
    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'users', entity: 'users', count: plan.users.length })
    ctx.report.step({ step: 'app_health_snapshots', entity: 'health_snapshots', count: plan.appHealthSnapshots.length })
    ctx.report.step({ step: 'deploy_events', entity: 'deploys', count: plan.deployEvents.length })
    ctx.report.step({ step: 'on_call_shifts', entity: 'shifts', count: plan.onCallShifts.length })
    ctx.report.step({ step: 'incidents', entity: 'incidents', count: plan.incidents.length })
    ctx.report.step({ step: 'runbook_executions', entity: 'runbooks', count: plan.runbookExecutions.length })
    ctx.report.step({ step: 'audit_entries', entity: 'audit', count: plan.auditEntries.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    if (ctx.dryRun) {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'dry-run mode' })
    } else {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'phase 2: plan-only — DB writers land in phase 3' })
    }

    ctx.logger.info('console seed plan computed', {
      profile: ctx.profile, healthSnapshots: plan.appHealthSnapshots.length, incidents: plan.incidents.length, deploys: plan.deployEvents.length, org: STAGING_ORG.id,
    })
    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    ctx.report.step({ step: 'reset', count: 0, skipped: true, note: `phase 2: nothing to reset — staging org "${STAGING_ORG.id}" untouched` })
    ctx.logger.info('console reset (no-op in phase 2)', { org: STAGING_ORG.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_ORG, consoleScale, buildPlan }
