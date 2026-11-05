/**
 * Revocation closure on the real kernel storage (PGlite): a subordinate authority record that is still `active`
 * must stop conferring authority the moment the holder's SESSION is revoked or expired, the MEMBERSHIP is deactivated
 * or removed, or the USER becomes suspended / deprovisioned / inactive.
 *
 * Two readers are proven, both against the same real storage (platform 0013 + cache 0020) and kernel code:
 *   1. the legacy-lineage canonical membership source (direct reads of user_management.*), and
 *   2. the deployed v2 path: the REAL session predicates (`compileAuthOrgBindingSql`) and the reader-owned definer
 *      membership function (`compileAuthorityMembershipReaderSql`), with the runtime role holding NO direct access
 *      to the identity relations, the session bearer travelling in app.current_session_token exactly as in production.
 *
 * Record types covered here: supervisory mandate, emergency-access mandate, executive-office mandate, case
 * assignment (resource relationship), derived creator relationship, executive delegation (holder AND delegator),
 * issuance approvals (an approver's vote), and the member-counsel capacity. The other kernel families (finance,
 * review, WorkAid, own-submission) are swept in lib/authority/__tests__/kernel-revocation-sweep.test.ts.
 * Not a staging isolation pass; the predicates are the repository's, the cluster is PGlite.
 */
import { createHash } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { compileAuthOrgBindingSql } from '@nzila/db/auth-storage-authority'
import type { PGlite } from '@electric-sql/pglite'
import { newUuid, ORG, ROLE, U } from './authority-kernel-harness'
import { daysAhead, freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { enforceAuthority, requireCounselSession, type EnforcementDeps } from '../../lib/authority/store/enforce'
import { assignCase, acceptInstrument, activateIssuanceRule, changeMandate, draftIssuanceRule, issueDelegation, issueMandate, requestIssuanceApproval, requestRuleAdoption } from '../../lib/authority/store/lifecycle'
import { openApprovalRequest, recordApprovalDecision } from '../../lib/authority/store/mutations'
import { auditAuthorityMutation } from '../../lib/authority/store/audit'
import { loadCounselEngagement, recordCounselEngagement } from '../../lib/authority/store/counsel'
import { type SqlExecutor } from '../../lib/authority/store/executor'
import {
  compileAuthorityMembershipReaderSql,
  membershipSourceViaDefiner,
  runBoundAuthorityTransaction,
  type VerifiedOrgBinding,
} from '../../lib/authority/store/platform-identity'
import type { Action, AuthorityRequest, Decision, ReasonCode } from '../../lib/authority/ontology'

let db: PGlite
let k: ReturnType<typeof kit>
const CASE = newUuid()
const MATTER = newUuid()
const POLICY_SUBJECT = newUuid()
let APPROVAL: string
let DELEGATION: string
let OFFICE_VP: string

const codes = (d: Decision): ReasonCode[] => d.reasons.map((r) => r.code)
const caseRef = { type: 'case' as const, id: CASE, organizationId: ORG }
const sha = (token: string) => createHash('sha256').update(token).digest('hex')
const tokenOf = (user: string) => `server-held-bridge-${user}`

interface Probe {
  /** The subordinate record that confers the authority. */
  record: string
  holder: string
  request: (holder: string) => AuthorityRequest
}

const readCase = (holder: string): AuthorityRequest => ({ principalUserId: holder, organizationId: ORG, action: 'case:read', resource: caseRef })
const approve = (holder: string): AuthorityRequest => ({
  principalUserId: holder, organizationId: ORG, action: 'governance:approve' as Action, resource: { type: 'approval_request', id: APPROVAL, organizationId: ORG },
})

const PROBES: Probe[] = [
  { record: 'supervisory mandate', holder: U.chief, request: readCase },
  { record: 'emergency-access mandate', holder: U.steward, request: readCase },
  { record: 'case assignment (resource relationship)', holder: U.steward2, request: readCase },
  { record: 'creator relationship (derived from the case)', holder: U.member, request: readCase },
  { record: 'executive-office mandate', holder: U.vp, request: approve },
  { record: 'executive delegation (delegate)', holder: U.officer, request: (h) => ({ ...approve(h), delegationId: DELEGATION }) },
]

interface IdentityEvent {
  name: string
  apply: (user: string) => [string, unknown[]]
  restore: (user: string) => [string, unknown[]]
  /** Only meaningful where a session exists (the v2 path). */
  session?: true
}
const EVENTS: IdentityEvent[] = [
  { name: 'session revoked', session: true, apply: (u) => [`UPDATE user_management.user_sessions SET is_active = false WHERE user_id = $1`, [u]], restore: (u) => [`UPDATE user_management.user_sessions SET is_active = true WHERE user_id = $1`, [u]] },
  { name: 'session expired', session: true, apply: (u) => [`UPDATE user_management.user_sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1`, [u]], restore: (u) => [`UPDATE user_management.user_sessions SET expires_at = now() + interval '1 hour' WHERE user_id = $1`, [u]] },
  { name: 'membership deactivated', apply: (u) => [`UPDATE user_management.organization_users SET is_active = false WHERE user_id = $1 AND organization_id = '${ORG}'`, [u]], restore: (u) => [`UPDATE user_management.organization_users SET is_active = true WHERE user_id = $1 AND organization_id = '${ORG}'`, [u]] },
  { name: 'membership removed', apply: (u) => [`DELETE FROM user_management.organization_users WHERE user_id = $1 AND organization_id = '${ORG}'`, [u]], restore: (u) => [`INSERT INTO user_management.organization_users (organization_id, user_id, role, is_active) VALUES ('${ORG}', $1, '${ROLE[u]}', true)`, [u]] },
  { name: 'user suspended', apply: (u) => [`UPDATE user_management.users SET lifecycle_state = 'suspended' WHERE user_id = $1`, [u]], restore: (u) => [`UPDATE user_management.users SET lifecycle_state = 'active' WHERE user_id = $1`, [u]] },
  { name: 'user deprovisioned', apply: (u) => [`UPDATE user_management.users SET lifecycle_state = 'deprovisioned' WHERE user_id = $1`, [u]], restore: (u) => [`UPDATE user_management.users SET lifecycle_state = 'active' WHERE user_id = $1`, [u]] },
  { name: 'user deactivated', apply: (u) => [`UPDATE user_management.users SET is_active = false WHERE user_id = $1`, [u]], restore: (u) => [`UPDATE user_management.users SET is_active = true WHERE user_id = $1`, [u]] },
]

const admin = <T>(statement: [string, unknown[]]) => k.asAdmin(() => db.query<T>(statement[0], statement[1]))

type Runner = (user: string) => <T>(fn: (t: SqlExecutor) => Promise<T>) => Promise<T>

const decideFor = (run: Runner, deps: EnforcementDeps, probe: Probe): Promise<Decision> =>
  run(probe.holder)((t) => enforceAuthority(t, deps, probe.request(probe.holder), { authenticated: true }))

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(() => db.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3)`, [CASE, ORG, U.member]))
  await k.adoptDefaultRules()
  await k.grantMandate('supervisory', U.chief, ['read'], { scope: { resourceIds: [CASE] } })
  await k.grantMandate('emergency_access', U.steward, ['read'], {
    scope: { resourceIds: [CASE] }, justification: 'Imminent safety concern in grievance file', effectiveAt: minutesAgo(), expiresAt: new Date(Date.now() + 6 * 3_600_000),
  })
  await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [CASE] } })
  await k.as(U.officer)((t) => assignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, assigneeUserId: U.steward2, permissions: ['read', 'comment'], effectiveAt: minutesAgo() }))
  OFFICE_VP = await k.grantOffice(U.vp, U.president, U.treasurer)
  const delegated = await k.as(U.vp)((t) =>
    issueDelegation(t, k.deps, { organizationId: ORG, delegatorUserId: U.vp, delegateUserId: U.officer, office: 'Vice President', actions: ['governance:approve'], resourceTypes: ['approval_request'], effectiveAt: minutesAgo(), expiresAt: daysAhead(30) }),
  )
  DELEGATION = delegated.delegationId
  await k.as(U.officer)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'delegation', instrumentId: DELEGATION, holderUserId: U.officer }))
  APPROVAL = await k.as(U.steward)((t) =>
    openApprovalRequest(t, { organizationId: ORG, subjectType: 'policy', subjectId: POLICY_SUBJECT, proposedBy: U.steward, requiredApprovals: 1, riskClass: 'medium' }),
  )
})

describe('premise: every subordinate record is live and stays live while identity changes', () => {
  it.each(PROBES)('$record confers authority while the holder is an active member', async (probe) => {
    const d = await decideFor(k.as, k.deps, probe)
    expect(d.effect, JSON.stringify(d.reasons)).toBe('allow')
  })

  it('the kernel records are never touched by the identity events below (they remain active, unrevoked and unexpired)', async () => {
    const live = (
      await admin<{ kind: string; n: number }>([
        `SELECT 'mandate' AS kind, count(*)::int AS n FROM ue_authority_mandates WHERE status = 'active' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
         UNION ALL SELECT 'relationship', count(*)::int FROM ue_authority_resource_relationships WHERE status = 'active' AND revoked_at IS NULL
         UNION ALL SELECT 'delegation', count(*)::int FROM ue_authority_delegations WHERE status = 'active' AND revoked_at IS NULL`,
        [],
      ])
    ).rows
    expect(Object.fromEntries(live.map((r) => [r.kind, r.n]))).toMatchObject({ mandate: 4, relationship: 1, delegation: 1 })
    expect(OFFICE_VP).toBeTruthy()
  })
})

describe('legacy lineage reader (direct canonical membership source): membership and user lifecycle', () => {
  for (const event of EVENTS.filter((e) => !e.session)) {
    describe(event.name, () => {
      it.each(PROBES)('$record is denied (NOT_AN_ACTIVE_MEMBER), then works again once restored', async (probe) => {
        await admin(event.apply(probe.holder))
        try {
          const denied = await decideFor(k.as, k.deps, probe)
          expect(denied.effect).toBe('deny')
          expect(codes(denied)).toContain('NOT_AN_ACTIVE_MEMBER')
        } finally {
          await admin(event.restore(probe.holder))
        }
        expect((await decideFor(k.as, k.deps, probe)).effect).toBe('allow')
      })
    })
  }

  it.each(['membership deactivated', 'user suspended', 'user deprovisioned', 'membership removed'])(
    'a delegation dies with the DELEGATOR’s identity too (%s)',
    async (name) => {
      const event = EVENTS.find((e) => e.name === name)!
      const probe = PROBES.find((p) => p.holder === U.officer)!
      await admin(event.apply(U.vp))
      try {
        const denied = await decideFor(k.as, k.deps, probe)
        expect(denied.effect).toBe('deny')
        expect(codes(denied)).toContain('DELEGATION_INVALID')
      } finally {
        await admin(event.restore(U.vp))
      }
      expect((await decideFor(k.as, k.deps, probe)).effect).toBe('allow')
    },
  )

  it('without an authenticated session in the transaction nothing is decided at all', async () => {
    const d = await enforceAuthority(db as unknown as SqlExecutor, k.deps, readCase(U.chief), { authenticated: true })
    expect(codes(d)).toContain('PRINCIPAL_NOT_AUTHENTICATED')
    const claimed = await enforceAuthority(db as unknown as SqlExecutor, k.deps, readCase(U.chief), { authenticated: false })
    expect(claimed.effect).toBe('deny')
  })

  it('the decided principal must be the transaction’s authenticated principal (a revoked holder cannot be impersonated by a live one)', async () => {
    const d = await k.as(U.officer)((t) => enforceAuthority(t, k.deps, readCase(U.chief), { authenticated: true }))
    expect(codes(d)).toContain('PRINCIPAL_MISMATCH')
  })
})

describe('issuance approvals: a vote does not outlive the approver’s active membership', () => {
  // The positive-control instrument is ended again so it cannot add authority to the probes that follow.
  const endMandate = (mandateId: string) =>
    k.as(U.president)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId, change: 'revoke' }))
  const instrument = (holder: string) => ({
    organizationId: ORG, issuerUserId: U.president, holderUserId: holder, kind: 'supervisory' as const, powers: ['read'],
    scope: { resourceIds: [newUuid()] }, sourceInstrument: `Resolution K1 ${newUuid()}`, effectiveAt: minutesAgo(5), expiresAt: daysAhead(30),
  })

  for (const event of EVENTS.filter((e) => !e.session)) {
    it(`an approval cast before the approver’s ${event.name} no longer counts at issuance`, async () => {
      const id = newUuid()
      const input = instrument(U.chief)
      const request = await k.as(U.president)((t) => requestIssuanceApproval(t, k.deps, { ...input, instrumentId: id, namedApproverIds: [U.treasurer] }))
      await k.as(U.treasurer)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: request, approverUserId: U.treasurer, decision: 'approved' }))
      await admin(event.apply(U.treasurer))
      try {
        await expect(k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id, approvalRequestId: request }))).rejects.toThrow(/APPROVAL_NOT_SATISFIED/)
      } finally {
        await admin(event.restore(U.treasurer))
      }
      // Positive control: the same approval counts again while the approver is an active member, and nothing was left half-written.
      const issued = await k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id, approvalRequestId: request }))
      expect(issued.mandateId).toBe(id)
      await endMandate(id)
    })
  }

  it('a rule-adoption approval is re-checked at activation: a suspended approver no longer adopts the rule', async () => {
    const draft = await k.as(U.president)((t) =>
      draftIssuanceRule(t, k.deps, { domain: 'supervisory', operation: 'amend', issuerCapacities: ['executive'], allowedPowers: ['read', 'assign', 'monitor'], maxTermDays: 365, requiresAcceptance: true, requiredIndependentApprovals: 1, organizationId: ORG, draftedBy: U.president }),
    )
    const adoption = await k.as(U.president)((t) => requestRuleAdoption(t, k.deps, { organizationId: ORG, ruleId: draft, actorUserId: U.president, sourceInstrument: 'Bylaw K1 amendment', namedApproverIds: [U.vp, U.treasurer] }))
    for (const approver of [U.vp, U.treasurer]) {
      await k.as(approver)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: adoption, approverUserId: approver, decision: 'approved' }))
    }
    const suspend = EVENTS.find((e) => e.name === 'user suspended')!
    await admin(suspend.apply(U.treasurer))
    try {
      await expect(k.as(U.vp)((t) => activateIssuanceRule(t, k.deps, { organizationId: ORG, ruleId: draft, actorUserId: U.vp, approvalRequestId: adoption }))).rejects.toThrow(/adoption capacity/)
    } finally {
      await admin(suspend.restore(U.treasurer))
    }
    await k.as(U.vp)((t) => activateIssuanceRule(t, k.deps, { organizationId: ORG, ruleId: draft, actorUserId: U.vp, approvalRequestId: adoption }))
  })

  it('an emergency grant cannot name an approver who has since been suspended', async () => {
    const id = newUuid()
    const input = { ...instrument(U.steward2), kind: 'emergency_access' as const, justification: 'Imminent safety concern in grievance file', expiresAt: new Date(Date.now() + 3 * 3_600_000) }
    const request = await k.as(U.president)((t) => requestIssuanceApproval(t, k.deps, { ...input, instrumentId: id, namedApproverIds: [U.treasurer] }))
    await k.as(U.treasurer)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: request, approverUserId: U.treasurer, decision: 'approved' }))
    await admin(EVENTS.find((e) => e.name === 'user suspended')!.apply(U.treasurer))
    try {
      await expect(k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id, approvalRequestId: request }))).rejects.toThrow(/APPROVAL_NOT_SATISFIED/)
    } finally {
      await admin(EVENTS.find((e) => e.name === 'user suspended')!.restore(U.treasurer))
    }
    const issued = await k.as(U.president)((t) => issueMandate(t, k.deps, { ...input, id, approvalRequestId: request }))
    expect(issued.mandateId).toBe(id)
    await endMandate(id)
  })
})

describe('counsel / WorkAid relationships: member-counsel capacity needs an active membership', () => {
  const LAWYER = U.member2
  const withRegister = (vouch: string) => ({
    isCounselFor: async (_e: unknown, i: { userId: string }) => i.userId === vouch,
    engagement: (e: Parameters<typeof loadCounselEngagement>[0], i: { organizationId: string; matterId: string; userId: string }) => loadCounselEngagement(e, i),
  })
  const session = () => k.as(LAWYER)((t) => requireCounselSession(t, { memberships: k.deps.memberships, counsel: withRegister(LAWYER) }, { organizationId: ORG, matterId: MATTER, claimedUserId: LAWYER }))

  beforeAll(async () => {
    await k.as(U.steward)(async (t) => {
      await t.query(`INSERT INTO ue_authority_workaid_matters (id, organization_id, member_user_id, case_id, referred_by, referred_categories) VALUES ($1,$2,$3,$4,$5,ARRAY['status']::text[])`, [MATTER, ORG, U.member, CASE, U.steward])
      await auditAuthorityMutation(t, { organizationId: ORG, action: 'test.raw', resourceType: 'ue_authority_workaid_matters', resourceId: MATTER })
    })
    await k.as(U.vp)((t) =>
      recordCounselEngagement(t, k.deps, {
        organizationId: ORG, recorderUserId: U.vp, matterId: MATTER, counselUserId: LAWYER, capacity: 'member_counsel', informationBarrier: true, effectiveAt: minutesAgo(10), expiresAt: daysAhead(30),
      }),
    )
  })

  it('positive control: an active member under a live member-counsel engagement is cleared', async () => {
    expect(await session()).toBe(LAWYER)
  })

  for (const event of EVENTS.filter((e) => !e.session && e.name !== 'membership removed')) {
    it(`the live engagement stops clearing the member once the ${event.name}`, async () => {
      await admin(event.apply(LAWYER))
      try {
        await expect(session()).rejects.toThrow(/COUNSEL_MEMBERSHIP_NOT_ACTIVE/)
      } finally {
        await admin(event.restore(LAWYER))
      }
      expect(await session()).toBe(LAWYER)
    })
  }
})

describe('deployed v2 reader: real session predicates and the definer membership function', () => {
  const binding = (user: string, token = tokenOf(user), over: Partial<VerifiedOrgBinding> = {}): VerifiedOrgBinding => ({
    userId: user, organizationId: ORG, role: ROLE[user], sessionToken: token, expiresAt: new Date(Date.now() + 60_000), authority: 'verified-provider-bridge', ...over,
  })
  const v2deps: EnforcementDeps = { memberships: membershipSourceViaDefiner }
  const asV2: Runner = (user) => (fn) => runBoundAuthorityTransaction(db as unknown as SqlExecutor, binding(user), fn)
  const asV2With = (user: string, token: string): Runner => () => (fn) => runBoundAuthorityTransaction(db as unknown as SqlExecutor, binding(user, token), fn)

  beforeAll(async () => {
    await k.asAdmin(async () => {
      await db.exec(`
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nzila_auth_org_authority_reader') THEN
          CREATE ROLE nzila_auth_org_authority_reader NOLOGIN NOINHERIT; END IF; END $$;
        CREATE TABLE user_management.user_sessions (user_id text, organization_id uuid, session_token_hash text, is_active boolean, expires_at timestamptz, session_id uuid DEFAULT gen_random_uuid(), device_info jsonb DEFAULT '{}'::jsonb);
        REVOKE ALL ON user_management.users, user_management.organization_users FROM union_eyes_runtime;
        ALTER TABLE user_management.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE user_management.users FORCE ROW LEVEL SECURITY;
        ALTER TABLE user_management.organization_users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE user_management.organization_users FORCE ROW LEVEL SECURITY;
        ALTER TABLE user_management.user_sessions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE user_management.user_sessions FORCE ROW LEVEL SECURITY;
        ${compileAuthOrgBindingSql()}
        ${compileAuthorityMembershipReaderSql()}
      `)
      for (const user of Object.keys(ROLE)) {
        await db.query(`INSERT INTO user_management.user_sessions VALUES ($1, $2, $3, true, now() + interval '1 hour')`, [user, ORG, sha(tokenOf(user))])
      }
    })
  })

  it('the runtime role has no direct access to the identity relations (membership is only reachable through the definer function)', async () => {
    await expect(k.as(U.chief)((t) => t.query(`SELECT * FROM user_management.organization_users`))).rejects.toThrow(/permission denied/)
  })

  it.each(PROBES)('positive control: $record confers authority with a live session', async (probe) => {
    const d = await decideFor(asV2, v2deps, probe)
    expect(d.effect, JSON.stringify(d.reasons)).toBe('allow')
  })

  for (const event of EVENTS) {
    describe(event.name, () => {
      it.each(PROBES)('$record is denied, then works again once restored', async (probe) => {
        await admin(event.apply(probe.holder))
        try {
          const denied = await decideFor(asV2, v2deps, probe)
          expect(denied.effect).toBe('deny')
          expect(codes(denied)).toContain('NOT_AN_ACTIVE_MEMBER')
        } finally {
          await admin(event.restore(probe.holder))
        }
        expect((await decideFor(asV2, v2deps, probe)).effect).toBe('allow')
      })
    })
  }

  it.each([
    ['another user’s bearer', tokenOf(U.steward)],
    ['a forged bearer', 'forged-bearer'],
    ['the stored hash instead of the bearer', sha(tokenOf(U.chief))],
  ])('a session that is not the holder’s own live bearer confers nothing: %s', async (_name, token) => {
    const d = await decideFor(asV2With(PROBES[0].holder, token), v2deps, PROBES[0])
    expect(d.effect).toBe('deny')
    expect(codes(d)).toContain('NOT_AN_ACTIVE_MEMBER')
  })

  it('a delegation dies with the delegator’s identity under the v2 reader too, but the DELEGATOR’s own session state is irrelevant', async () => {
    const probe = PROBES.find((p) => p.holder === U.officer)!
    await admin(EVENTS.find((e) => e.name === 'session revoked')!.apply(U.vp))
    try {
      expect((await decideFor(asV2, v2deps, probe)).effect).toBe('allow')
    } finally {
      await admin(EVENTS.find((e) => e.name === 'session revoked')!.restore(U.vp))
    }
    for (const name of ['membership deactivated', 'user suspended', 'user deprovisioned']) {
      const event = EVENTS.find((e) => e.name === name)!
      await admin(event.apply(U.vp))
      try {
        const denied = await decideFor(asV2, v2deps, probe)
        expect(denied.effect, name).toBe('deny')
        expect(codes(denied), name).toContain('DELEGATION_INVALID')
      } finally {
        await admin(event.restore(U.vp))
      }
    }
  })

  it('the binding itself refuses an expired or bearer-less session before any statement runs', async () => {
    const run = (b: VerifiedOrgBinding) => runBoundAuthorityTransaction(db as unknown as SqlExecutor, b, async () => 'ran')
    await expect(run(binding(U.chief, tokenOf(U.chief), { expiresAt: new Date(Date.now() - 1) }))).rejects.toThrow(/session has expired/)
    await expect(run(binding(U.chief, ''))).rejects.toThrow(/no session authority/)
  })

  it('a revoked-session holder also loses WRITE paths: no governed mutation succeeds under a dead session', async () => {
    await admin(EVENTS.find((e) => e.name === 'session revoked')!.apply(U.officer))
    try {
      await expect(
        asV2(U.officer)((t) => assignCase(t, v2deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, assigneeUserId: U.steward, permissions: ['read'], effectiveAt: minutesAgo() })),
      ).rejects.toThrow(/DENIED|NOT_AN_ACTIVE_MEMBER|case:assign/)
    } finally {
      await admin(EVENTS.find((e) => e.name === 'session revoked')!.restore(U.officer))
    }
  })

})
