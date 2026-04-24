/**
 * Control-plane per-app staging seeder (governance / policy).
 *
 * Control-plane is an in-memory governance UI today. The seeder models the
 * synthetic surfaces it presents: tenants, role assignments, policies,
 * policy violations, change requests, approval workflows, governance audit
 * entries.
 *
 * PLAN-ONLY in phase 2 — when control-plane gains durable storage, phase 3
 * will wire writers; until then the report doubles as a fixture spec.
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
  id: 'org-control-plane-staging-governance-9999',
  name: 'Control Plane Staging Governance 9999',
  slug: 'control-plane-staging-governance-9999',
}

interface ControlPlaneScale {
  readonly tenants: number
  readonly roleAssignments: number
  readonly policies: number
  readonly policyViolations: number
  readonly changeRequests: number
  readonly approvals: number
  readonly governanceAudit: number
  readonly notifications: number
  readonly activityLogs: number
}

function controlPlaneScale(profile: SeedProfile): ControlPlaneScale {
  switch (profile) {
    case 'demo-light':
      return { tenants: 6, roleAssignments: 30, policies: 12, policyViolations: 8, changeRequests: 10, approvals: 15, governanceAudit: 60, notifications: 30, activityLogs: 100 }
    case 'demo-standard':
      return { tenants: 25, roleAssignments: 150, policies: 40, policyViolations: 35, changeRequests: 50, approvals: 80, governanceAudit: 300, notifications: 150, activityLogs: 500 }
    case 'executive-showcase':
      return { tenants: 120, roleAssignments: 700, policies: 150, policyViolations: 150, changeRequests: 220, approvals: 350, governanceAudit: 1500, notifications: 700, activityLogs: 2500 }
    case 'investor-showcase':
      return { tenants: 350, roleAssignments: 2000, policies: 400, policyViolations: 450, changeRequests: 650, approvals: 1000, governanceAudit: 4500, notifications: 2000, activityLogs: 7000 }
  }
}

const TENANT_TIERS = ['free', 'team', 'business', 'enterprise', 'partner'] as const
const TENANT_STATUSES = ['active', 'suspended', 'pending', 'archived'] as const
const ROLES = ['owner', 'admin', 'operator', 'auditor', 'viewer'] as const
const POLICY_KINDS = ['rbac', 'data-residency', 'retention', 'encryption', 'mfa-required', 'pii-handling', 'export-control'] as const
const POLICY_SEVERITIES = ['advisory', 'warn', 'block'] as const
const VIOLATION_STATUSES = ['open', 'acknowledged', 'remediated', 'waived'] as const
const CHANGE_KINDS = ['policy-update', 'role-grant', 'feature-flag', 'config-rollout', 'data-deletion'] as const
const APPROVAL_DECISIONS = ['approved', 'rejected', 'pending', 'expired'] as const
const GOV_ACTIONS = ['policy-publish', 'policy-archive', 'tenant-suspend', 'tenant-activate', 'role-grant', 'role-revoke', 'waiver-grant'] as const

interface SyntheticTenant {
  readonly id: string
  readonly name: string
  readonly tier: (typeof TENANT_TIERS)[number]
  readonly status: (typeof TENANT_STATUSES)[number]
  readonly createdAt: string
}

interface SyntheticRoleAssignment {
  readonly id: string
  readonly tenantId: string
  readonly userId: string
  readonly role: (typeof ROLES)[number]
  readonly grantedAt: string
}

interface SyntheticPolicy {
  readonly id: string
  readonly orgId: string
  readonly kind: (typeof POLICY_KINDS)[number]
  readonly severity: (typeof POLICY_SEVERITIES)[number]
  readonly version: number
  readonly publishedAt: string
}

interface SyntheticPolicyViolation {
  readonly id: string
  readonly policyId: string
  readonly tenantId: string
  readonly status: (typeof VIOLATION_STATUSES)[number]
  readonly detectedAt: string
}

interface SyntheticChangeRequest {
  readonly id: string
  readonly orgId: string
  readonly kind: (typeof CHANGE_KINDS)[number]
  readonly title: string
  readonly requestedAt: string
}

interface SyntheticApproval {
  readonly id: string
  readonly changeRequestId: string
  readonly approverUserId: string
  readonly decision: (typeof APPROVAL_DECISIONS)[number]
  readonly decidedAt: string
}

interface SyntheticGovernanceAudit {
  readonly id: string
  readonly orgId: string
  readonly action: (typeof GOV_ACTIONS)[number]
  readonly actorUserId: string
  readonly at: string
}

function buildPlan(ctx: SeedContext) {
  const scale = controlPlaneScale(ctx.profile)

  const baseOrg = shared.fakeOrganization(ctx.rng, ctx.time)
  const orgs = [{ ...baseOrg, ...STAGING_ORG, sector: 'governance', tier: 'enterprise' as const }]

  const adminPeople = shared.fakePeople(ctx.rng, ctx.time, 12)
  const users = shared.fakeUsers({ rng: ctx.rng, time: ctx.time, people: adminPeople, organizations: orgs, count: 12 })

  const window = ctx.time.historyWindow()
  const windowMs = window.end.getTime() - window.start.getTime()
  const ts = () => new Date(window.start.getTime() + ctx.rng.next() * windowMs).toISOString()

  const tenants: SyntheticTenant[] = Array.from({ length: scale.tenants }, (_, i) => ({
    id: ctx.rng.id('tenant'),
    name: `Synthetic Tenant ${i + 1}`,
    tier: ctx.rng.pick(TENANT_TIERS),
    status: ctx.rng.pick(TENANT_STATUSES),
    createdAt: ts(),
  }))

  const roleAssignments: SyntheticRoleAssignment[] = Array.from({ length: scale.roleAssignments }, () => ({
    id: ctx.rng.id('role-assignment'),
    tenantId: ctx.rng.pick(tenants).id,
    userId: ctx.rng.pick(users).id,
    role: ctx.rng.pick(ROLES),
    grantedAt: ts(),
  }))

  const policies: SyntheticPolicy[] = Array.from({ length: scale.policies }, () => ({
    id: ctx.rng.id('policy'),
    orgId: STAGING_ORG.id,
    kind: ctx.rng.pick(POLICY_KINDS),
    severity: ctx.rng.pick(POLICY_SEVERITIES),
    version: ctx.rng.intBetween(1, 9),
    publishedAt: ts(),
  }))

  const policyViolations: SyntheticPolicyViolation[] = Array.from({ length: scale.policyViolations }, () => ({
    id: ctx.rng.id('violation'),
    policyId: ctx.rng.pick(policies).id,
    tenantId: ctx.rng.pick(tenants).id,
    status: ctx.rng.pick(VIOLATION_STATUSES),
    detectedAt: ts(),
  }))

  const changeRequests: SyntheticChangeRequest[] = Array.from({ length: scale.changeRequests }, (_, i) => ({
    id: ctx.rng.id('change-request'),
    orgId: STAGING_ORG.id,
    kind: ctx.rng.pick(CHANGE_KINDS),
    title: `Synthetic Change Request ${i + 1}`,
    requestedAt: ts(),
  }))

  const approvals: SyntheticApproval[] = Array.from({ length: scale.approvals }, () => ({
    id: ctx.rng.id('approval'),
    changeRequestId: ctx.rng.pick(changeRequests).id,
    approverUserId: ctx.rng.pick(users).id,
    decision: ctx.rng.pick(APPROVAL_DECISIONS),
    decidedAt: ts(),
  }))

  const governanceAudit: SyntheticGovernanceAudit[] = Array.from({ length: scale.governanceAudit }, () => ({
    id: ctx.rng.id('gov-audit'),
    orgId: STAGING_ORG.id,
    action: ctx.rng.pick(GOV_ACTIONS),
    actorUserId: ctx.rng.pick(users).id,
    at: ts(),
  }))

  const notifications = shared.fakeNotifications({ rng: ctx.rng, time: ctx.time, users, count: scale.notifications })
  const activityLogs = shared.fakeActivityLogs({ rng: ctx.rng, time: ctx.time, users, count: scale.activityLogs })

  return { orgs, users, tenants, roleAssignments, policies, policyViolations, changeRequests, approvals, governanceAudit, notifications, activityLogs }
}

const seeder: SeederModule = {
  app: 'control-plane',
  description: 'Control-plane synthetic governance: tenants, role assignments, policies, violations, change requests, approvals, governance audit.',
  supportedProfiles: SUPPORTED_PROFILES,

  async seed(ctx: SeedContext): Promise<SeedAppReport> {
    const plan = buildPlan(ctx)
    ctx.report.step({ step: 'organization', entity: 'organizations', count: plan.orgs.length })
    ctx.report.step({ step: 'users', entity: 'users', count: plan.users.length })
    ctx.report.step({ step: 'tenants', entity: 'tenants', count: plan.tenants.length })
    ctx.report.step({ step: 'role_assignments', entity: 'role_assignments', count: plan.roleAssignments.length })
    ctx.report.step({ step: 'policies', entity: 'policies', count: plan.policies.length })
    ctx.report.step({ step: 'policy_violations', entity: 'violations', count: plan.policyViolations.length })
    ctx.report.step({ step: 'change_requests', entity: 'change_requests', count: plan.changeRequests.length })
    ctx.report.step({ step: 'approvals', entity: 'approvals', count: plan.approvals.length })
    ctx.report.step({ step: 'governance_audit', entity: 'gov_audit', count: plan.governanceAudit.length })
    ctx.report.step({ step: 'notifications', entity: 'notifications', count: plan.notifications.length })
    ctx.report.step({ step: 'activity_logs', entity: 'activity_logs', count: plan.activityLogs.length })

    if (ctx.dryRun) {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'dry-run mode' })
    } else {
      ctx.report.step({ step: 'db_write', count: 0, skipped: true, note: 'phase 2: plan-only — DB writers land in phase 3' })
    }

    ctx.logger.info('control-plane seed plan computed', {
      profile: ctx.profile, tenants: plan.tenants.length, policies: plan.policies.length, violations: plan.policyViolations.length, org: STAGING_ORG.id,
    })
    return ctx.report.finish()
  },

  async reset(ctx: SeedContext): Promise<SeedAppReport> {
    ctx.report.step({ step: 'reset', count: 0, skipped: true, note: `phase 2: nothing to reset — staging org "${STAGING_ORG.id}" untouched` })
    ctx.logger.info('control-plane reset (no-op in phase 2)', { org: STAGING_ORG.id })
    return ctx.report.finish()
  },
}

registerSeeder(seeder)

export { seeder, STAGING_ORG, controlPlaneScale, buildPlan }
