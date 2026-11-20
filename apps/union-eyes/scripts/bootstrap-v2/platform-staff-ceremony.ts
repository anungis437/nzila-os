/**
 * Disposable qualification of the platform-staff issuance workflow (lib/authority/platform-organization.ts).
 *
 * Every authority row is produced by the shipped kernel (draftIssuanceRule -> requestRuleAdoption -> two independent votes ->
 * activateIssuanceRule; requestIssuanceApproval -> independent vote -> issueMandate -> acceptInstrument; changeMandate), each step
 * in the production-issued canonical session of the person performing it, on the restricted runtime login. Nothing is inserted
 * into an authority table directly. The platform organization row, its three platform executives and the holder's platform
 * membership are SYNTHETIC: they stand in for the appointments only the deciding Nzila authority can make
 * (docs/union-eyes/convergence/decisions/platform-staff-mandate-decision-record.md). This proves the mechanism, never an
 * institutional appointment, and every instrument it pins says so.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { DEFAULT_ISSUANCE_TEMPLATES, type IssuanceOperation } from '../../lib/authority/issuance'
import { PLATFORM_ORGANIZATION_ID, type PlatformCapability } from '../../lib/authority/platform-organization'
import { activeMembershipSource } from '../../lib/authority/store/active-membership-source'
import {
  acceptInstrument,
  changeMandate,
  draftIssuanceRule,
  issueMandate,
  requestIssuanceApproval,
} from '../../lib/authority/store/lifecycle'
import { openRuntimeSessionFactory } from './runtime-column-fixtures'
import {
  adoptGuardedIssuanceRule,
  createGuardedActor,
  openGuardedSessionHarness,
  voteGuardedApproval,
  type GuardedActor,
} from './runtime-guarded-case-fixtures'

const deps = { memberships: activeMembershipSource }
export const SYNTHETIC_PLATFORM_INSTRUMENT = 'SYNTHETIC disposable qualification only; not a Nzila appointment or resolution'

export interface PlatformStaffCeremonyInput {
  operator: pg.Client
  runtime: pg.Client
  system: pg.Client
  authUrl: string
  authSystemUrl?: string
}

/** The synthetic platform organization and its stand-in executives, created by the owned operator before any session. */
export async function seedSyntheticPlatformOrganization(operator: pg.Client) {
  const existing = await operator.query('SELECT 1 FROM public.organizations WHERE id=$1', [PLATFORM_ORGANIZATION_ID])
  assert.equal(existing.rowCount, 0, 'A disposable fixture must start without a platform organization')
  await operator.query(
    `INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
       member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
     VALUES ($1,'Synthetic platform organization (disposable qualification)','ue-http-platform-'||$2,'platform',ARRAY[]::text[],0,
       ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now())`,
    [PLATFORM_ORGANIZATION_ID, randomUUID()],
  )
  const executives: GuardedActor[] = []
  for (let index = 0; index < 3; index++)
    executives.push(await createGuardedActor(operator, PLATFORM_ORGANIZATION_ID, 'executive'))
  return executives as [GuardedActor, GuardedActor, GuardedActor]
}

export function openPlatformStaffCeremony(
  input: PlatformStaffCeremonyInput,
  executives: readonly [GuardedActor, GuardedActor, GuardedActor],
) {
  const sessions = openRuntimeSessionFactory(input.operator, input.authUrl, input.authSystemUrl)
  const harness = openGuardedSessionHarness({ ...input, sessions })
  const party = { organizationId: PLATFORM_ORGANIZATION_ID, executives: [...executives] as [GuardedActor, GuardedActor, GuardedActor] }
  const [issuer, approver] = executives
  const rules = new Map<IssuanceOperation, string>()
  const adopt = async (operation: IssuanceOperation) => {
    if (rules.has(operation)) return
    const template = DEFAULT_ISSUANCE_TEMPLATES.find((entry) => entry.domain === 'platform_staff' && entry.operation === operation)
    assert(template, `PLATFORM_STAFF_TEMPLATE_REQUIRED:${operation}`)
    const { rationale: _rationale, ...source } = template
    rules.set(operation, (await adoptGuardedIssuanceRule(harness.within, party, source)).ruleId)
  }
  let closed = false
  return {
    /** The real adoption ceremony for issue and revoke: drafter, two independent adopters, separate activation. */
    async adoptRules() {
      await adopt('issue')
      await adopt('revoke')
      return Object.fromEntries(rules)
    },
    /** One per-person mandate: request, independent approval, issue, then the holder's own acceptance. */
    async issue(holderUserId: string, powers: readonly PlatformCapability[], expiresAt: Date) {
      const id = randomUUID()
      const grant = {
        organizationId: PLATFORM_ORGANIZATION_ID,
        issuerUserId: issuer.userId,
        holderUserId,
        kind: 'platform_staff' as const,
        powers,
        scope: {},
        sourceInstrument: `${SYNTHETIC_PLATFORM_INSTRUMENT} ${id}`,
        effectiveAt: new Date(Date.now() - 60_000),
        expiresAt,
      }
      const approvalRequestId = await harness.within(issuer, (_tx, exec) =>
        requestIssuanceApproval(exec, deps, { ...grant, instrumentId: id, namedApproverIds: [approver.userId] }),
      )
      await voteGuardedApproval(harness.within, party, approvalRequestId, [approver])
      const issued = await harness.within(issuer, (_tx, exec) => issueMandate(exec, deps, { ...grant, id, approvalRequestId }))
      assert.equal(issued.mandateId, id)
      await harness.within({ userId: holderUserId, organizationId: PLATFORM_ORGANIZATION_ID }, (_tx, exec) =>
        acceptInstrument(exec, { organizationId: PLATFORM_ORGANIZATION_ID, instrumentType: 'mandate', instrumentId: id, holderUserId }),
      )
      return id
    },
    async revoke(mandateId: string) {
      await harness.within(issuer, (_tx, exec) =>
        changeMandate(exec, deps, { organizationId: PLATFORM_ORGANIZATION_ID, issuerUserId: issuer.userId, mandateId, change: 'revoke' }),
      )
    },
    /** A customer organization's own executive cannot draft platform-wide authority: the kernel refuses it in their session. */
    async refuseCustomerDraft(customerOrganizationId: string) {
      const president = await createGuardedActor(input.operator, customerOrganizationId, 'president')
      const template = DEFAULT_ISSUANCE_TEMPLATES.find((entry) => entry.domain === 'platform_staff' && entry.operation === 'issue')
      assert(template, 'PLATFORM_STAFF_TEMPLATE_REQUIRED:issue')
      const { rationale: _rationale, ...source } = template
      await assert.rejects(
        harness.within(president, (_tx, exec) =>
          draftIssuanceRule(exec, deps, { ...source, organizationId: customerOrganizationId, draftedBy: president.userId }),
        ),
        /only in the platform organization/,
      )
      return president.userId
    },
    async close() {
      if (closed) return { sessionsClosed: true }
      closed = true
      const results = await Promise.allSettled([harness.end(), sessions.dispose()])
      return { sessionsClosed: results.every((result) => result.status === 'fulfilled') }
    },
  }
}
export type PlatformStaffCeremony = ReturnType<typeof openPlatformStaffCeremony>
