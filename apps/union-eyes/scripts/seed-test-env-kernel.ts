/** Owned disposable fixtures: real bearer-bound governance, never role/GUC impersonation. */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { authenticatedOrgBindingSql, withBearerOrgBinding } from '@nzila/platform-auth/org-binding'
import * as schema from '@/db/schema'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { withCanonicalTenantScope } from '@/lib/db/canonical-transaction-scope'
import { runAuthorityTransaction, type SqlExecutor } from '@/lib/authority/store/executor'
import { activeMembershipSource } from '@/lib/authority/store/active-membership-source'
import {
  DEFAULT_ISSUANCE_TEMPLATES,
  type IssuanceDomain,
  type IssuanceOperation,
} from '@/lib/authority/issuance'
import {
  draftIssuanceRule,
  requestRuleAdoption,
  activateIssuanceRule,
  requestIssuanceApproval,
  issueMandate,
  acceptInstrument,
  assignCase,
} from '@/lib/authority/store/lifecycle'
import { recordApprovalDecision } from '@/lib/authority/store/mutations'
import { UE_TEST_CASES } from '@/tests/fixtures/test-cases'
import { UE_TEST_USERS } from '@/tests/fixtures/test-users'

export interface QaAuthorityContext {
  runtimeUrl: string
  sessions: Readonly<Record<string, string>>
}
const sourceInstrument =
  'SYNTHETIC OWNED QA FIXTURE: canonical base case governance; not an institutional resolution'
const issuer = UE_TEST_USERS.executivePrimary
const approvers = [UE_TEST_USERS.governanceApprover, UE_TEST_USERS.financePreparer] as const
const deps = { memberships: activeMembershipSource }
const fixtureCaseIds = [
  UE_TEST_CASES.primarySubmitted.claimId,
  UE_TEST_CASES.primaryAssigned.claimId,
]
const same = (a: readonly string[], b: readonly string[]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

/** The supplied ID selects only an existing fixture; the actual bearer and
 * current membership independently establish its identity and organization. */
export async function runQaAuthorityActor<T>(
  context: QaAuthorityContext,
  userId: string,
  operation: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
  const { fixture, sessionToken } = admitQaActor(context, userId)
  return withBearerOrgBinding(
    sessionToken,
    { organizationId: fixture.orgId, expectedActorUserId: userId },
    async (binding) => {
      const client = new pg.Client({ connectionString: context.runtimeUrl })
      await client.connect()
      try {
        return await runAuthorityTransaction(
          client,
          {
            organizationId: binding.organizationId,
            userId: binding.userId,
            sessionToken: binding.sessionToken,
          },
          async (tx) => {
            await tx.query('SET LOCAL ROLE union_eyes_runtime')
            return operation(tx)
          },
        )
      } finally {
        await client.end()
      }
    },
  )
}

function admitQaActor(context: QaAuthorityContext, userId: string) {
  if (process.env.QA_TEST_ENV !== 'true' || process.env.UE_CANONICAL_BOOTSTRAP_V2 !== '1')
    throw new Error('Owned canonical QA context required')
  const fixture = Object.values(UE_TEST_USERS).find((user) => user.userId === userId)
  const sessionToken = context.sessions[userId]
  const target = new URL(context.runtimeUrl)
  if (
    !fixture ||
    fixture.status !== 'active' ||
    !sessionToken ||
    target.hostname !== '127.0.0.1' ||
    target.username !== 'ue_runtime_web' ||
    target.pathname !== '/ue_runtime'
  )
    throw new Error('Bounded active runtime fixture required')
  return { fixture, sessionToken }
}

/** The same bounded actor admission, with the application's own Drizzle transaction shape: the
 * restricted runtime role, the bearer-bound principal and organization, and the canonical tenant scope
 * (as withRLSContext gives a request). Nothing is impersonated. */
export async function runQaRuntimeActor<T>(
  context: QaAuthorityContext,
  userId: string,
  operation: (tx: RLSTx) => Promise<T>,
): Promise<T> {
  const { fixture, sessionToken } = admitQaActor(context, userId)
  return withBearerOrgBinding(
    sessionToken,
    { organizationId: fixture.orgId, expectedActorUserId: userId },
    async (binding) => {
      const client = new pg.Client({ connectionString: context.runtimeUrl })
      await client.connect()
      try {
        return await drizzle(client, { schema }).transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL search_path = pg_catalog, public, pg_temp`)
          await tx.execute(sql`SET LOCAL ROLE union_eyes_runtime`)
          await tx.execute(authenticatedOrgBindingSql(binding))
          return withCanonicalTenantScope(tx as unknown as RLSTx, binding, operation)
        })
      } finally {
        await client.end()
      }
    },
  )
}

async function ensureRule(
  operator: pg.Client,
  context: QaAuthorityContext,
  domain: IssuanceDomain,
  operation: IssuanceOperation,
): Promise<number> {
  const template = DEFAULT_ISSUANCE_TEMPLATES.find(
    (rule) => rule.domain === domain && rule.operation === operation,
  )
  if (!template) throw new Error('Current source issuance template required')
  const existing = (
    await operator.query(
      `SELECT source_instrument,allowed_powers,issuer_capacities,required_independent_approvals,requires_acceptance,max_term_days FROM public.ue_authority_issuance_rules WHERE organization_id=$1 AND domain=$2 AND operation=$3 AND status='active'`,
      [issuer.orgId, domain, operation],
    )
  ).rows
  if (existing.length) {
    const rule = existing[0]
    if (
      existing.length !== 1 ||
      rule.source_instrument !== sourceInstrument ||
      !same(rule.allowed_powers, template.allowedPowers) ||
      !same(rule.issuer_capacities, template.issuerCapacities) ||
      rule.required_independent_approvals !== template.requiredIndependentApprovals ||
      rule.requires_acceptance !== template.requiresAcceptance ||
      rule.max_term_days !== template.maxTermDays
    )
      throw new Error('Existing fixture issuance authority differs from current source')
    return 0
  }
  const ruleId = await runQaAuthorityActor(context, issuer.userId, (tx) =>
    draftIssuanceRule(tx, deps, {
      ...template,
      organizationId: issuer.orgId,
      draftedBy: issuer.userId,
    }),
  )
  const approvalRequestId = await runQaAuthorityActor(context, issuer.userId, (tx) =>
    requestRuleAdoption(tx, deps, {
      organizationId: issuer.orgId,
      ruleId,
      actorUserId: issuer.userId,
      sourceInstrument,
      namedApproverIds: approvers.map((person) => person.userId),
    }),
  )
  for (const approver of approvers)
    await runQaAuthorityActor(context, approver.userId, (tx) =>
      recordApprovalDecision(tx, deps, {
        organizationId: issuer.orgId,
        approvalRequestId,
        approverUserId: approver.userId,
        decision: 'approved',
        rationale: sourceInstrument,
      }),
    )
  await runQaAuthorityActor(context, approvers[0].userId, (tx) =>
    activateIssuanceRule(tx, deps, {
      organizationId: issuer.orgId,
      ruleId,
      actorUserId: approvers[0].userId,
      approvalRequestId,
    }),
  )
  return 1
}

async function ensureSupervision(
  operator: pg.Client,
  context: QaAuthorityContext,
  holder: typeof UE_TEST_USERS.chiefStewardPrimary | typeof UE_TEST_USERS.supervisorPrimary,
  powers: readonly string[],
  caseIds: readonly string[],
): Promise<number> {
  const existing = (
    await operator.query(
      `SELECT id::text,scope,powers FROM public.ue_authority_mandates WHERE organization_id=$1 AND principal_user_id=$2 AND kind='supervisory' AND status='active' AND revoked_at IS NULL AND effective_at<=clock_timestamp() AND expires_at>clock_timestamp()`,
      [holder.orgId, holder.userId],
    )
  ).rows
  if (
    existing.some((row) => same(row.powers, powers) && same(row.scope?.resourceIds ?? [], caseIds))
  )
    return 0
  const id = randomUUID(),
    effectiveAt = new Date(Date.now() - 1000),
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const grant = {
    id,
    organizationId: holder.orgId,
    issuerUserId: issuer.userId,
    holderUserId: holder.userId,
    kind: 'supervisory' as const,
    powers,
    scope: { resourceIds: caseIds },
    sourceInstrument,
    effectiveAt,
    expiresAt,
  }
  const approvalRequestId = await runQaAuthorityActor(context, issuer.userId, (tx) =>
    requestIssuanceApproval(tx, deps, {
      ...grant,
      instrumentId: id,
      namedApproverIds: [approvers[0].userId],
    }),
  )
  await runQaAuthorityActor(context, approvers[0].userId, (tx) =>
    recordApprovalDecision(tx, deps, {
      organizationId: holder.orgId,
      approvalRequestId,
      approverUserId: approvers[0].userId,
      decision: 'approved',
      rationale: sourceInstrument,
    }),
  )
  await runQaAuthorityActor(context, issuer.userId, (tx) =>
    issueMandate(tx, deps, { ...grant, approvalRequestId }),
  )
  await runQaAuthorityActor(context, holder.userId, (tx) =>
    acceptInstrument(tx, {
      organizationId: holder.orgId,
      instrumentType: 'mandate',
      instrumentId: id,
      holderUserId: holder.userId,
    }),
  )
  return 1
}

/** Explicit synthetic resolution for exactly the returned fixture case IDs.
 * Unknown jurisdiction stays unknown; an organization is never invented as a unit. */
export async function ensureQaCaseSupervision(
  operatorUrl: string,
  context: QaAuthorityContext,
  caseIds: readonly string[],
): Promise<number> {
  const url = new URL(operatorUrl)
  if (
    process.env.QA_TEST_ENV !== 'true' ||
    url.hostname !== '127.0.0.1' ||
    url.username !== 'uev2admin' ||
    url.pathname !== '/ue_runtime' ||
    !caseIds.length
  )
    throw new Error('Owned fixture operator and exact cases required')
  const operator = new pg.Client({ connectionString: operatorUrl })
  await operator.connect()
  try {
    for (const caseId of caseIds) {
      const rows = (
        await operator.query(
          'SELECT member_id FROM public.claims WHERE organization_id=$1 AND claim_id=$2',
          [issuer.orgId, caseId],
        )
      ).rows
      if (rows.length !== 1 || rows[0].member_id !== UE_TEST_USERS.memberPrimary.userId)
        throw new Error('Supervision target is not a represented member fixture case')
    }
    let changed = 0
    for (const [domain, operation] of [
      ['supervisory', 'issue'],
      ['supervisory', 'revoke'],
      ['case_assignment', 'issue'],
      ['case_assignment', 'revoke'],
    ] as const)
      changed += await ensureRule(operator, context, domain, operation)
    changed += await ensureSupervision(
      operator,
      context,
      UE_TEST_USERS.chiefStewardPrimary,
      ['assign'],
      caseIds,
    )
    changed += await ensureSupervision(
      operator,
      context,
      UE_TEST_USERS.supervisorPrimary,
      ['read', 'monitor'],
      caseIds,
    )
    return changed
  } finally {
    await operator.end()
  }
}

/** Only base case fixtures are established. No financial mandate or duty is seeded. */
export async function seedQaCaseAssignments(
  operatorUrl: string,
  context?: QaAuthorityContext,
): Promise<number> {
  if (!context)
    throw new Error(
      'Canonical fixture bearer context required; legacy identity setters are refused',
    )
  let changed = await ensureQaCaseSupervision(operatorUrl, context, fixtureCaseIds)
  const operator = new pg.Client({ connectionString: operatorUrl })
  await operator.connect()
  try {
    for (const caseId of fixtureCaseIds) {
      const live = (
        await operator.query(
          `SELECT principal_user_id,origin,granted_by FROM public.ue_authority_resource_relationships WHERE organization_id=$1 AND resource_type='case' AND resource_id=$2 AND relation='assignee' AND status='active' AND revoked_at IS NULL`,
          [issuer.orgId, caseId],
        )
      ).rows
      if (live.length) {
        if (
          live.length !== 1 ||
          live[0].origin !== 'explicit' ||
          live[0].granted_by !== UE_TEST_USERS.chiefStewardPrimary.userId ||
          ![UE_TEST_USERS.stewardPrimary.userId, UE_TEST_USERS.stewardPrimaryTwo.userId].some(
            (id) => id === live[0].principal_user_id,
          )
        )
          throw new Error('Existing QA assignment lacks governed provenance')
        continue
      }
      await runQaAuthorityActor(context, UE_TEST_USERS.chiefStewardPrimary.userId, (tx) =>
        assignCase(tx, deps, {
          organizationId: issuer.orgId,
          issuerUserId: UE_TEST_USERS.chiefStewardPrimary.userId,
          caseId,
          assigneeUserId: UE_TEST_USERS.stewardPrimary.userId,
          effectiveAt: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }),
      )
      changed++
    }
  } finally {
    await operator.end()
  }
  return changed
}
