/**
 * Authority kernel storage — platform 0013 + scoped 0020, on a disposable PGlite
 * database. Proves the INTEGRITY the database itself enforces (constraints,
 * terminal revocation, one-person-one-vote, self-approval, recusal, delegation,
 * append-only, in-transaction recording, RLS) independent of any application
 * caller. PGlite is single-connection: true concurrent-transaction behaviour is
 * proven separately against real PostgreSQL (authority-kernel-storage.postgres.test.ts).
 * This is not a staging isolation pass.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { authorityKernelEntries } from '../rls-storage-authority/authority-kernel'
import { assertAllowed, enforceAuthority } from '../../lib/authority/store/enforce'
import { runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import type { MembershipSource } from '../../lib/authority/store/facts'
import { loadAuthorityFacts } from '../../lib/authority/store/facts'
import {
  declareRecusal, grantConsent, grantDelegation, grantMandate, grantRelationship, liftRecusal,
  openApprovalRequest, recordApprovalDecision, revokeDelegation, revokeMandate,
} from '../../lib/authority/store/mutations'
import type { Membership } from '../../lib/authority/ontology'

const APP_ROOT = resolve(__dirname, '..', '..')
const read = (p: string) => readFileSync(resolve(APP_ROOT, p), 'utf8')
const PLATFORM_SQL = read('db/migrations-platform/0013_authority_kernel_storage.sql')
const RLS_SQL = read('db/migrations-cache/0020_authority_kernel_rls_closure.sql')
const HELPER = read('db/migrations-cache/0010_tenant_isolation_rls_foundation.sql')
  .match(/CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy\([\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0]
if (!HELPER) throw new Error('ue_create_direct_org_rls_policy not found')

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORG = id(0xa)
const ORG_B = id(0xb)
const U = { president: id(5), treasurer: id(6), delegate: id(13), other: id(9), member: id(1), clerk: id(14), counsel: id(20), third: id(21) }
let seq = 1000
const fresh = () => id(seq++)

const DAY = 24 * 60 * 60 * 1000
const past = () => new Date(Date.now() - DAY)
const soon = (days = 7) => new Date(Date.now() + days * DAY)

let db: PGlite

async function tx<T>(org: string, user: string, fn: (t: SqlExecutor) => Promise<T>): Promise<T> {
  return runAuthorityTransaction(db as unknown as SqlExecutor, { organizationId: org, userId: user }, fn)
}
const inOrg = <T>(fn: (t: SqlExecutor) => Promise<T>, user = U.other) => tx(ORG, user, fn)

// Memberships come from a port; tests bind it to a map the way Phase 2 binds the canonical relation.
const members = new Map<string, Membership>()
const addMember = (userId: string, capacities: Membership['capacities'], over: Partial<Membership> = {}, org = ORG) =>
  members.set(`${org}:${userId}`, { userId, organizationId: org, status: 'active', capacities, ...over })
const membershipSource: MembershipSource = async (_e, org, ids) =>
  ids.map((u) => members.get(`${org}:${u}`)).filter((m): m is Membership => !!m)
const deps = { memberships: membershipSource }

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE union_eyes_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
    CREATE ROLE union_eyes_system  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN;
  `)
  await db.exec(HELPER!)
  await db.exec(PLATFORM_SQL)
  await db.exec(RLS_SQL)
  for (const e of authorityKernelEntries) {
    await db.exec(`GRANT ${e.requiredRuntimePrivileges.join(', ')} ON ${e.table} TO union_eyes_runtime`)
  }
  await db.exec('SET ROLE union_eyes_runtime')
  addMember(U.president, ['executive'])
  addMember(U.treasurer, ['financial_officer'])
  addMember(U.delegate, ['officer'])
  addMember(U.other, ['officer'])
  addMember(U.member, ['member'])
  addMember(U.third, ['executive'])
})

const mandateInput = (over: Record<string, unknown> = {}) => ({
  organizationId: ORG, principalUserId: U.president, kind: 'executive_office' as const, powers: ['approve'],
  sourceInstrument: `Bylaw 7.2 ${fresh()}`, grantedBy: U.other, effectiveAt: past(), expiresAt: soon(), ...over,
})

describe('migration structure', () => {
  it('registry entries match exactly the relations 0013 creates and 0020 protects', () => {
    const created = [...PLATFORM_SQL.matchAll(/CREATE TABLE IF NOT EXISTS (ue_authority_\w+)/g)].map((m) => m[1]).sort()
    const protectedTables = [...RLS_SQL.matchAll(/ue_create_direct_org_rls_policy\('(ue_authority_\w+)'\)/g)].map((m) => m[1]).sort()
    expect(authorityKernelEntries.map((e) => e.table).sort()).toEqual(created)
    expect(protectedTables).toEqual(created)
    expect(created).toHaveLength(8)
  })

  it('no registry entry grants DELETE', () => {
    for (const e of authorityKernelEntries) expect(e.requiredRuntimePrivileges).not.toContain('DELETE')
  })

  it('every table has FORCE RLS and the four runtime policies', async () => {
    await db.exec('RESET ROLE')
    for (const e of authorityKernelEntries) {
      const c = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`, [e.table])
      expect(c.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true })
      const p = await db.query<{ n: string }>(`SELECT count(*)::text n FROM pg_policies WHERE tablename = $1`, [e.table])
      expect(Number(p.rows[0].n)).toBe(5)
    }
    await db.exec('SET ROLE union_eyes_runtime')
  })
})

describe('mandates', () => {
  it('records a valid mandate', async () => {
    const mid = await inOrg((t) => grantMandate(t, mandateInput()))
    expect(mid).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('refuses self-granting', async () => {
    await expect(inOrg((t) => grantMandate(t, mandateInput({ grantedBy: U.president })))).rejects.toThrow(/grantor_chk/)
  })

  it('refuses an open-ended mandate and a non-positive term', async () => {
    await expect(inOrg((t) => grantMandate(t, mandateInput({ expiresAt: null as unknown as Date })))).rejects.toThrow(/null value/)
    await expect(inOrg((t) => grantMandate(t, mandateInput({ expiresAt: past(), effectiveAt: new Date() })))).rejects.toThrow(/term_chk/)
  })

  it('refuses a mandate without a source instrument', async () => {
    await expect(inOrg((t) => grantMandate(t, mandateInput({ sourceInstrument: '   ' })))).rejects.toThrow(/instrument_chk/)
  })

  it('refuses a money limit without a currency or with a negative limit', async () => {
    await expect(inOrg((t) => grantMandate(t, mandateInput({ kind: 'financial', powers: ['approve'], monetaryLimitMinor: 100 })))).rejects.toThrow(/limit_chk/)
    await expect(inOrg((t) => grantMandate(t, mandateInput({ kind: 'financial', powers: ['approve'], monetaryLimitMinor: -1, currency: 'CAD' })))).rejects.toThrow(/limit_chk/)
  })

  it('refuses a duplicate active mandate for the same instrument', async () => {
    const input = mandateInput()
    await inOrg((t) => grantMandate(t, input))
    await expect(inOrg((t) => grantMandate(t, input))).rejects.toThrow(/active_uq/)
  })

  describe('emergency access', () => {
    const emergency = (over: Record<string, unknown> = {}) => mandateInput({
      kind: 'emergency_access', powers: ['read'], approvedBy: U.third, justification: 'Urgent safety review of case file 4471',
      effectiveAt: new Date(), expiresAt: new Date(Date.now() + 6 * 3600 * 1000), ...over,
    })
    it('accepts a read-only, justified, independently approved, short grant', async () => {
      await expect(inOrg((t) => grantMandate(t, emergency()))).resolves.toBeTruthy()
    })
    it('refuses without an independent approver, or self-approved', async () => {
      await expect(inOrg((t) => grantMandate(t, emergency({ approvedBy: null })))).rejects.toThrow(/emergency_chk/)
      await expect(inOrg((t) => grantMandate(t, emergency({ approvedBy: U.president })))).rejects.toThrow(/emergency_chk/)
    })
    it('refuses a thin justification, a write power, or a term over 24 hours', async () => {
      await expect(inOrg((t) => grantMandate(t, emergency({ justification: 'because' })))).rejects.toThrow(/emergency_chk/)
      await expect(inOrg((t) => grantMandate(t, emergency({ powers: ['read', 'write'] })))).rejects.toThrow(/emergency_chk/)
      await expect(inOrg((t) => grantMandate(t, emergency({ expiresAt: new Date(Date.now() + 25 * 3600 * 1000) })))).rejects.toThrow(/emergency_chk/)
    })
  })

  it('revocation is terminal and the row is otherwise immutable', async () => {
    const mid = await inOrg((t) => grantMandate(t, mandateInput()))
    await expect(inOrg((t) => t.query(`UPDATE ue_authority_mandates SET powers = ARRAY['approve','read'] WHERE id = $1`, [mid]))).rejects.toThrow(/may only change/)
    await expect(inOrg((t) => t.query(`UPDATE ue_authority_mandates SET expires_at = expires_at + interval '1 year' WHERE id = $1`, [mid]))).rejects.toThrow(/may only change/)
    await inOrg((t) => revokeMandate(t, ORG, mid, U.other))
    await expect(inOrg((t) => t.query(`UPDATE ue_authority_mandates SET status = 'active', revoked_at = NULL, revoked_by = NULL WHERE id = $1`, [mid]))).rejects.toThrow(/terminal/)
    await expect(inOrg((t) => revokeMandate(t, ORG, mid, U.other))).rejects.toThrow(/no matching live record/)
  })

  it('cannot be revoked across organizations', async () => {
    const mid = await inOrg((t) => grantMandate(t, mandateInput()))
    await expect(tx(ORG_B, U.other, (t) => revokeMandate(t, ORG_B, mid, U.other))).rejects.toThrow(/no matching live record/)
    await expect(tx(ORG_B, U.other, (t) => revokeMandate(t, ORG, mid, U.other))).rejects.toThrow(/no matching live record/)
  })
})

describe('relationships, delegations, recusals, consents', () => {
  it('a collaborator or privileged grant must be explicit, named and granted by someone else', async () => {
    const base = { organizationId: ORG, principalUserId: U.member, resourceType: 'case' as const, resourceId: fresh(), effectiveAt: past() }
    await expect(inOrg((t) => grantRelationship(t, { ...base, relation: 'collaborator', origin: 'derived' }))).rejects.toThrow(/explicit_chk/)
    await expect(inOrg((t) => grantRelationship(t, { ...base, relation: 'owner', origin: 'derived', privilegedAccess: true }))).rejects.toThrow(/explicit_chk/)
    await expect(inOrg((t) => grantRelationship(t, { ...base, relation: 'collaborator', origin: 'explicit', grantedBy: U.member }))).rejects.toThrow(/explicit_chk/)
    await expect(inOrg((t) => grantRelationship(t, { ...base, relation: 'collaborator', origin: 'explicit', grantedBy: U.other }))).resolves.toBeTruthy()
  })

  it('a delegation cannot be to oneself, open-ended, or reach financial / oversight / counsel powers', async () => {
    const base = { organizationId: ORG, delegatorUserId: U.president, delegateUserId: U.delegate, office: 'President', actions: ['governance:approve'], resourceTypes: ['approval_request' as const], effectiveAt: past(), expiresAt: soon() }
    await expect(inOrg((t) => grantDelegation(t, { ...base, delegateUserId: U.president }))).rejects.toThrow(/deleg_self_chk/)
    for (const action of ['finance:approve', 'review:enforce', 'workaid:read_counsel_material', 'case:read_privileged']) {
      await expect(inOrg((t) => grantDelegation(t, { ...base, actions: ['case:read', action] }))).rejects.toThrow(/nondelegable_chk/)
    }
    await expect(inOrg((t) => grantDelegation(t, { ...base, expiresAt: null as unknown as Date }))).rejects.toThrow(/null value/)
    await expect(inOrg((t) => grantDelegation(t, base))).resolves.toBeTruthy()
  })

  it('a recusal can be lifted by someone else but never by the recused person', async () => {
    const rid = await inOrg((t) => declareRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: fresh(), reason: 'relative of respondent' }))
    await expect(inOrg((t) => liftRecusal(t, ORG, rid, U.member))).rejects.toThrow(/lift_chk/)
    await inOrg((t) => liftRecusal(t, ORG, rid, U.other))
    await expect(inOrg((t) => liftRecusal(t, ORG, rid, U.other))).rejects.toThrow(/no matching live record/)
  })

  it('consent shape: referral is the member’s own act; counsel disclosure names a recipient and is not member-authored', async () => {
    const base = { organizationId: ORG, memberUserId: U.member, matterId: fresh(), categories: ['status'], purpose: 'referral', grantedAt: past(), expiresAt: soon() }
    await expect(inOrg((t) => grantConsent(t, { ...base, direction: 'union_to_workaid', issuer: 'member', issuedBy: U.president }))).rejects.toThrow(/shape_chk/)
    await expect(inOrg((t) => grantConsent(t, { ...base, direction: 'union_to_workaid', issuer: 'counsel', issuedBy: U.counsel }))).rejects.toThrow(/shape_chk/)
    await expect(inOrg((t) => grantConsent(t, { ...base, direction: 'workaid_to_union', issuer: 'counsel', issuedBy: U.counsel }))).rejects.toThrow(/shape_chk/)
    await expect(inOrg((t) => grantConsent(t, { ...base, direction: 'workaid_to_union', issuer: 'counsel', issuedBy: U.member, recipientUserId: U.other }))).rejects.toThrow(/shape_chk/)
    await expect(inOrg((t) => grantConsent(t, { ...base, direction: 'union_to_workaid', issuer: 'member', issuedBy: U.member }))).resolves.toBeTruthy()
    await expect(inOrg((t) => grantConsent(t, { ...base, direction: 'workaid_to_union', issuer: 'counsel', issuedBy: U.counsel, recipientUserId: U.other }))).resolves.toBeTruthy()
  })
})

describe('approvals: one person, one vote, segregation, recusal, delegation', () => {
  const open = (over: Record<string, unknown> = {}) => inOrg((t) => openApprovalRequest(t, {
    organizationId: ORG, subjectType: 'bylaw_amendment', subjectId: fresh(), proposedBy: U.other, requiredApprovals: 2, riskClass: 'medium', ...over,
  }))
  const officeMandate = async (userId: string) => inOrg((t) => grantMandate(t, mandateInput({ principalUserId: userId, sourceInstrument: `Office of ${userId} ${fresh()}` })))
  const status = async (rid: string) => (await inOrg((t) => t.query<{ status: string }>(`SELECT status FROM ue_authority_approval_requests WHERE id = $1`, [rid]))).rows[0].status
  const decide = (rid: string, approver: string, over: Record<string, unknown> = {}) => inOrg((t) => recordApprovalDecision(t, deps, { organizationId: ORG, approvalRequestId: rid, approverUserId: approver, decision: 'approved', ...over }), approver)

  it('high-risk requests need at least two approvals (database constraint)', async () => {
    await expect(open({ riskClass: 'high', requiredApprovals: 1 })).rejects.toThrow(/required_chk/)
    await expect(open({ riskClass: 'critical', requiredApprovals: 1 })).rejects.toThrow(/required_chk/)
  })

  it('satisfies after the required number of independent approvals, then refuses more', async () => {
    await officeMandate(U.president); await officeMandate(U.third)
    const rid = await open()
    await decide(rid, U.president)
    expect(await status(rid)).toBe('open')
    await decide(rid, U.third)
    expect(await status(rid)).toBe('satisfied')
    await expect(decide(rid, U.treasurer)).rejects.toThrow(/STATE_NOT_ELIGIBLE|ALREADY_DECIDED/)
  })

  it('the same person cannot vote twice (kernel and database)', async () => {
    const rid = await open({ requiredApprovals: 3 })
    await decide(rid, U.president)
    await expect(decide(rid, U.president)).rejects.toThrow(/ALREADY_DECIDED|already decided/)
  })

  it('the database alone refuses a second vote on the same authority line even if the kernel is bypassed', async () => {
    const rid = await open({ requiredApprovals: 3 })
    await decide(rid, U.president)
    await expect(inOrg((t) => t.query(
      `INSERT INTO ue_authority_approval_decisions (organization_id, approval_request_id, approver_user_id, authority_line_user_id, decision) VALUES ($1,$2,$3,$3,'approved')`,
      [ORG, rid, U.president]))).rejects.toThrow(/one_vote_uq/)
  })

  it('self-approval is refused by the database even when the kernel is bypassed', async () => {
    const rid = await open({ proposedBy: U.president })
    await expect(inOrg((t) => t.query(
      `INSERT INTO ue_authority_approval_decisions (organization_id, approval_request_id, approver_user_id, authority_line_user_id, decision) VALUES ($1,$2,$3,$3,'approved')`,
      [ORG, rid, U.president]))).rejects.toThrow(/SELF_APPROVAL/)
    const authored = await open({ subjectAuthorId: U.third })
    await expect(inOrg((t) => t.query(
      `INSERT INTO ue_authority_approval_decisions (organization_id, approval_request_id, approver_user_id, authority_line_user_id, decision) VALUES ($1,$2,$3,$3,'approved')`,
      [ORG, authored, U.third]))).rejects.toThrow(/SELF_APPROVAL/)
  })

  it('the kernel refuses a proposer, a non-named approver and a recused or adverse approver', async () => {
    await officeMandate(U.president)
    const proposed = await open({ proposedBy: U.president })
    await expect(decide(proposed, U.president)).rejects.toThrow(/SELF_APPROVAL/)
    const named = await open({ namedApproverIds: [U.third] })
    await expect(decide(named, U.president)).rejects.toThrow(/NOT_ELIGIBLE_APPROVER/)
    const recused = await open()
    await inOrg((t) => declareRecusal(t, { organizationId: ORG, principalUserId: U.president, resourceType: 'approval_request', resourceId: recused, reason: 'conflict' }))
    await expect(decide(recused, U.president)).rejects.toThrow(/RECUSED/)
    const adverse = await open({ adverseUserIds: [U.president] })
    await expect(decide(adverse, U.president)).rejects.toThrow(/ADVERSE_PARTY/)
  })

  it('the database refuses recused, adverse and non-named approvers even when the kernel is bypassed', async () => {
    const raw = (rid: string, who: string) => inOrg((t) => t.query(
      `INSERT INTO ue_authority_approval_decisions (organization_id, approval_request_id, approver_user_id, authority_line_user_id, decision) VALUES ($1,$2,$3,$3,'approved')`,
      [ORG, rid, who]))
    const recused = await open()
    await inOrg((t) => declareRecusal(t, { organizationId: ORG, principalUserId: U.third, resourceType: 'approval_request', resourceId: recused, reason: 'conflict' }))
    await expect(raw(recused, U.third)).rejects.toThrow(/RECUSED/)
    await expect(raw(await open({ adverseUserIds: [U.third] }), U.third)).rejects.toThrow(/ADVERSE_PARTY/)
    await expect(raw(await open({ namedApproverIds: [U.president] }), U.third)).rejects.toThrow(/NOT_ELIGIBLE_APPROVER/)
  })

  it('a rejection resolves the request; the request cannot be forced to satisfied directly', async () => {
    await officeMandate(U.president)
    const rid = await open()
    await expect(inOrg((t) => t.query(`UPDATE ue_authority_approval_requests SET status = 'satisfied', decided_at = now() WHERE id = $1`, [rid]))).rejects.toThrow(/only be resolved by recording a decision/)
    await decide(rid, U.president, { decision: 'rejected' })
    expect(await status(rid)).toBe('rejected')
  })

  describe('delegated votes count under the delegator', () => {
    it('stores the delegator as the authority line and blocks the delegator from voting again', async () => {
      await officeMandate(U.president)
      const did = await inOrg((t) => grantDelegation(t, { organizationId: ORG, delegatorUserId: U.president, delegateUserId: U.delegate, office: 'President', actions: ['governance:approve'], resourceTypes: ['approval_request'], effectiveAt: past(), expiresAt: soon() }))
      const rid = await open({ requiredApprovals: 3 })
      const r = await decide(rid, U.delegate, { delegationId: did })
      expect(r.kernel.authorityLineUserId).toBe(U.president)
      const row = (await inOrg((t) => t.query<{ authority_line_user_id: string }>(`SELECT authority_line_user_id FROM ue_authority_approval_decisions WHERE id = $1`, [r.decisionId]))).rows[0]
      expect(row.authority_line_user_id).toBe(U.president)
      await expect(decide(rid, U.president)).rejects.toThrow(/ALREADY_DECIDED|already decided/)
    })

    it('a revoked delegation, a high-risk request and a foreign delegation are all refused', async () => {
      await officeMandate(U.president)
      const did = await inOrg((t) => grantDelegation(t, { organizationId: ORG, delegatorUserId: U.president, delegateUserId: U.delegate, office: 'President', actions: ['governance:approve'], resourceTypes: ['approval_request'], effectiveAt: past(), expiresAt: soon() }))
      const high = await open({ riskClass: 'high', requiredApprovals: 2 })
      await expect(decide(high, U.delegate, { delegationId: did })).rejects.toThrow(/DELEGATION_INVALID/)
      await inOrg((t) => revokeDelegation(t, ORG, did, U.president))
      await expect(decide(await open(), U.delegate, { delegationId: did })).rejects.toThrow(/DELEGATION_INVALID/)
    })

    it('the database refuses a delegation that is not the approver’s, even when the kernel is bypassed', async () => {
      const did = await inOrg((t) => grantDelegation(t, { organizationId: ORG, delegatorUserId: U.president, delegateUserId: U.delegate, office: 'President', actions: ['case:read'], resourceTypes: ['case'], effectiveAt: past(), expiresAt: soon() }))
      const rid = await open()
      await expect(inOrg((t) => t.query(
        `INSERT INTO ue_authority_approval_decisions (organization_id, approval_request_id, approver_user_id, authority_line_user_id, delegation_id, decision) VALUES ($1,$2,$3,$4,$5,'approved')`,
        [ORG, rid, U.delegate, U.president, did]))).rejects.toThrow(/DELEGATION_INVALID/)
    })
  })

  it('an approval in another organization cannot be decided', async () => {
    const rid = await open()
    await expect(tx(ORG_B, U.president, (t) => recordApprovalDecision(t, { memberships: async (_e, o, ids) => ids.map((u) => ({ userId: u, organizationId: o, status: 'active' as const, capacities: ['executive' as const] })) }, { organizationId: ORG_B, approvalRequestId: rid, approverUserId: U.president, decision: 'approved' }))).rejects.toThrow(/DENIED|RESOURCE_FACTS|denied/)
  })
})

describe('atomic recording: a mutation cannot commit without its record', () => {
  const eventsFor = async (sourceId: string) =>
    (await db.query<{ operation: string; actor_user_id: string | null; source_table: string }>(
      `SELECT operation, actor_user_id, source_table FROM ue_authority_events WHERE source_id = $1 ORDER BY event_seq`, [sourceId])).rows

  it('records INSERT and UPDATE events in the same transaction with the actor', async () => {
    await db.exec('RESET ROLE')
    const mid = await tx(ORG, U.other, async (t) => {
      const m = await grantMandate(t, mandateInput())
      await revokeMandate(t, ORG, m, U.other)
      return m
    })
    const ev = await eventsFor(mid)
    expect(ev.map((e) => e.operation)).toEqual(['INSERT', 'UPDATE'])
    expect(ev.every((e) => e.actor_user_id === U.other && e.source_table === 'ue_authority_mandates')).toBe(true)
    await db.exec('SET ROLE union_eyes_runtime')
  })

  it('a rolled-back mutation leaves neither the row nor an event', async () => {
    await db.exec('RESET ROLE')
    let mid = ''
    await expect(tx(ORG, U.other, async (t) => {
      mid = await grantMandate(t, mandateInput())
      throw new Error('downstream failure after the mutation')
    })).rejects.toThrow(/downstream failure/)
    expect((await db.query(`SELECT 1 FROM ue_authority_mandates WHERE id = $1`, [mid])).rows).toHaveLength(0)
    expect(await eventsFor(mid)).toHaveLength(0)
    await db.exec('SET ROLE union_eyes_runtime')
  })

  it('a failing audit step in the same transaction rolls the business mutation back', async () => {
    await db.exec('RESET ROLE')
    let rid = ''
    await expect(tx(ORG, U.other, async (t) => {
      rid = await openApprovalRequest(t, { organizationId: ORG, subjectType: 'x', subjectId: fresh(), proposedBy: U.other, requiredApprovals: 1, riskClass: 'low' })
      await t.query(`INSERT INTO ue_authority_events (organization_id, source_table, source_id, operation, row_after) VALUES ($1,'ue_authority_mandates',$2,'INSERT','{}')`, [ORG, rid])
    })).rejects.toThrow(/can only be written by the authority recording trigger/)
    expect((await db.query(`SELECT 1 FROM ue_authority_approval_requests WHERE id = $1`, [rid])).rows).toHaveLength(0)
    await db.exec('SET ROLE union_eyes_runtime')
  })

  it('events cannot be forged, altered, deleted or truncated — even by a superuser session', async () => {
    await db.exec('RESET ROLE')
    const mid = await tx(ORG, U.other, (t) => grantMandate(t, mandateInput()))
    await expect(db.query(`INSERT INTO ue_authority_events (organization_id, source_table, source_id, operation, row_after) VALUES ($1,'ue_authority_mandates',$2,'INSERT','{}')`, [ORG, mid])).rejects.toThrow(/recording trigger/)
    await expect(db.query(`UPDATE ue_authority_events SET actor_user_id = 'x' WHERE source_id = $1`, [mid])).rejects.toThrow(/append-only/)
    await expect(db.query(`DELETE FROM ue_authority_events WHERE source_id = $1`, [mid])).rejects.toThrow(/append-only/)
    await expect(db.query(`TRUNCATE ue_authority_events`)).rejects.toThrow(/append-only/)
    for (const t of authorityKernelEntries.map((e) => e.table)) {
      await expect(db.query(`DELETE FROM ${t}`)).rejects.toThrow(/permission denied|append-only/)
      await expect(db.query(`TRUNCATE ${t} CASCADE`)).rejects.toThrow(/append-only/)
    }
    await db.exec('SET ROLE union_eyes_runtime')
  })

  it('the runtime role cannot DELETE any authority relation', async () => {
    for (const e of authorityKernelEntries) {
      await expect(inOrg((t) => t.query(`DELETE FROM ${e.table}`))).rejects.toThrow(/permission denied/)
    }
  })
})

describe('tenant isolation (FORCE RLS)', () => {
  it('another organization cannot read or write this organization’s authority rows', async () => {
    const mid = await inOrg((t) => grantMandate(t, mandateInput()))
    expect(await tx(ORG_B, U.other, async (t) => (await t.query(`SELECT 1 FROM ue_authority_mandates WHERE id = $1`, [mid])).rows.length)).toBe(0)
    expect(await tx(ORG, U.other, async (t) => (await t.query(`SELECT 1 FROM ue_authority_mandates WHERE id = $1`, [mid])).rows.length)).toBe(1)
    await expect(tx(ORG_B, U.other, (t) => grantMandate(t, mandateInput({ organizationId: ORG })))).rejects.toThrow(/row-level security/)
  })

  it('with no tenant context nothing is visible', async () => {
    await db.query(`SELECT set_config('app.current_org_id', '', false)`)
    expect((await db.query(`SELECT 1 FROM ue_authority_mandates`)).rows).toHaveLength(0)
    expect((await db.query(`SELECT 1 FROM ue_authority_events`)).rows).toHaveLength(0)
  })
})

describe('fact loading and enforcement through the store', () => {
  it('loads delegator facts for a delegate and honours expiry and revocation at the database', async () => {
    const org = ORG
    await inOrg((t) => grantMandate(t, mandateInput({ principalUserId: U.president, sourceInstrument: `Office loader ${fresh()}` })))
    const did = await inOrg((t) => grantDelegation(t, { organizationId: org, delegatorUserId: U.president, delegateUserId: U.clerk, office: 'President', actions: ['case:read'], resourceTypes: ['case'], effectiveAt: past(), expiresAt: soon() }))
    const f = await inOrg((t) => loadAuthorityFacts(t, membershipSource, { organizationId: org, principalUserId: U.clerk, authenticated: true }))
    expect(f.delegations.map((d) => d.id)).toContain(did)
    expect(f.mandates.some((m) => m.principalUserId === U.president)).toBe(true)
    await inOrg((t) => revokeDelegation(t, org, did, U.president))
    const g = await inOrg((t) => loadAuthorityFacts(t, membershipSource, { organizationId: org, principalUserId: U.clerk, authenticated: true }))
    expect(g.delegations.map((d) => d.id)).not.toContain(did)
  })

  it('enforcement fails closed when facts cannot be loaded', async () => {
    const d = await inOrg((t) => enforceAuthority(t, { memberships: async () => { throw new Error('membership store down') } }, {
      principalUserId: U.president, organizationId: ORG, action: 'governance:approve',
      resource: { type: 'approval_request', id: fresh(), organizationId: ORG },
    }, { authenticated: true }))
    expect(d.effect).toBe('deny')
    expect(() => assertAllowed(d)).toThrow(/denied/)
  })

  it('platform staff with no organization membership are denied', async () => {
    const platform = fresh()
    const rid = await inOrg((t) => openApprovalRequest(t, { organizationId: ORG, subjectType: 'x', subjectId: fresh(), proposedBy: U.other, requiredApprovals: 1, riskClass: 'low' }))
    const d = await inOrg((t) => enforceAuthority(t, deps, { principalUserId: platform, organizationId: ORG, action: 'governance:approve', resource: { type: 'approval_request', id: rid, organizationId: ORG } }, { authenticated: true }))
    expect(d.effect).toBe('deny')
  })

  it('an unauthenticated principal is denied', async () => {
    const rid = await inOrg((t) => openApprovalRequest(t, { organizationId: ORG, subjectType: 'x', subjectId: fresh(), proposedBy: U.other, requiredApprovals: 1, riskClass: 'low' }))
    const d = await inOrg((t) => enforceAuthority(t, deps, { principalUserId: U.president, organizationId: ORG, action: 'governance:approve', resource: { type: 'approval_request', id: rid, organizationId: ORG } }, { authenticated: false }))
    expect(d.effect).toBe('deny')
  })
})
