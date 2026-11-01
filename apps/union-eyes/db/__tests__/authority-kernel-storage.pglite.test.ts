/**
 * Authority storage structure on PGlite: what the database itself enforces,
 * independent of any application caller (constraints, terminal revocation,
 * one-person-one-vote, append-only records, in-transaction events, FORCE RLS).
 * Issuance-rule behaviour is covered in the lifecycle suite; the issuance guard
 * is disabled here, as an administrator, ONLY to reach the CHECK constraints
 * behind it. Real-PostgreSQL concurrency is in the .postgres suite.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authorityKernelEntries } from '../rls-storage-authority/authority-kernel'
import { newUuid, ORG, ORG_B, PLATFORM_SQL, RLS_SQL, U, WORKAID_PLATFORM_SQL, WORKAID_RLS_SQL, WORKAID_WORDING_RLS_SQL, WORKAID_WORDING_SQL } from './authority-kernel-harness'
import { daysAhead, freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { auditAuthorityMutation } from '../../lib/authority/store/audit'
import { declareOwnRecusal, issueDelegation } from '../../lib/authority/store/lifecycle'
import { insertConsent, insertRelationship, openApprovalRequest, recordApprovalDecision } from '../../lib/authority/store/mutations'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>

const INSTRUMENT_GUARDED = ['ue_authority_mandates', 'ue_authority_delegations', 'ue_authority_resource_relationships']
// Actor binding is disabled here, as an administrator, ONLY so a deliberately malformed row reaches the CHECK behind it;
// the binding itself is proven by authority-kernel-actor.pglite.test.ts.
const ACTOR_GUARDED = [...authorityKernelEntries.map((e) => e.table)].filter((t) => t !== 'ue_authority_events')

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(async () => {
    for (const t of INSTRUMENT_GUARDED) await db.exec(`ALTER TABLE ${t} DISABLE TRIGGER ue_authority_guard_issuance`)
    for (const t of ACTOR_GUARDED) await db.exec(`ALTER TABLE ${t} DISABLE TRIGGER ue_authority_guard_actor`)
  })
})
afterAll(async () => {
  await k.asAdmin(async () => {
    for (const t of INSTRUMENT_GUARDED) await db.exec(`ALTER TABLE ${t} ENABLE TRIGGER ue_authority_guard_issuance`)
    for (const t of ACTOR_GUARDED) await db.exec(`ALTER TABLE ${t} ENABLE TRIGGER ue_authority_guard_actor`)
  })
})

/** A raw write that audits like a real caller, so a successful row can commit. */
const raw = (user: string, sql: string, params: unknown[] = [], org = ORG) =>
  k.as(user, org)(async (t) => {
    const r = await t.query(sql, params)
    await auditAuthorityMutation(t, { organizationId: org, action: 'test.raw', resourceType: 'raw' })
    return r
  })

const mandate = (over: Record<string, string> = {}) => ({
  kind: `'supervisory'`, powers: `ARRAY['read']`, scope: `'{"resourceIds":["x"]}'`, granted: `$3`, term: `now() + interval '1 day'`, instrument: `'Bylaw'`, extra: '', ...over,
})
const insertMandate = (o = mandate(), holder = U.chief, issuer = U.president) =>
  raw(issuer, `INSERT INTO ue_authority_mandates (organization_id, principal_user_id, kind, powers, scope, source_instrument, granted_by, effective_at, expires_at${o.extra ? ', ' + o.extra.split('=')[0] : ''})
    VALUES ($1,$2,${o.kind},${o.powers},${o.scope},${o.instrument}, ${o.granted === '$3' ? '$3' : o.granted}, now(), ${o.term}${o.extra ? ', ' + o.extra.split('=')[1] : ''})`,
    o.granted === '$3' ? [ORG, holder, issuer] : [ORG, holder])

describe('migration structure', () => {
  it('registry, migrations and RLS closures agree on the kernel relations plus the WorkAid union-side relations', () => {
    const created = [
      ...PLATFORM_SQL.matchAll(/CREATE TABLE IF NOT EXISTS (ue_authority_\w+)/g),
      ...WORKAID_PLATFORM_SQL.matchAll(/CREATE TABLE IF NOT EXISTS (ue_authority_\w+)/g),
      ...WORKAID_WORDING_SQL.matchAll(/CREATE TABLE IF NOT EXISTS (ue_authority_\w+)/g),
    ].map((m) => m[1]).sort()
    const protectedTables = [
      ...RLS_SQL.matchAll(/ue_create_direct_org_rls_policy\('(ue_authority_\w+)'\)/g),
      ...WORKAID_RLS_SQL.matchAll(/ue_create_direct_org_rls_policy\('(ue_authority_\w+)'\)/g),
      ...WORKAID_WORDING_RLS_SQL.matchAll(/ue_create_direct_org_rls_policy\('(ue_authority_\w+)'\)/g),
    ].map((m) => m[1]).sort()
    expect(authorityKernelEntries.map((e) => e.table).sort()).toEqual(created)
    expect(protectedTables).toEqual(created)
    expect(created).toHaveLength(authorityKernelEntries.length)
  })

  it('no registry entry grants DELETE, and no table is writable beyond its declared DML', async () => {
    for (const e of authorityKernelEntries) expect(e.requiredRuntimePrivileges).not.toContain('DELETE')
    for (const e of authorityKernelEntries) {
      await expect(k.as(U.president)((t) => t.query(`DELETE FROM ${e.table}`))).rejects.toThrow(/permission denied/)
    }
  })

  it('every relation has FORCE RLS and the five canonical policies; the review register and its event history add one restrictive visibility policy each', async () => {
    await k.asAdmin(async () => {
      const narrowed = ['ue_authority_reviews', 'ue_authority_events']
      for (const e of authorityKernelEntries) {
        const c = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`, [e.table])
        expect(c.rows[0], e.table).toEqual({ relrowsecurity: true, relforcerowsecurity: true })
        const p = await db.query<{ n: string }>(`SELECT count(*)::text n FROM pg_policies WHERE tablename = $1`, [e.table])
        expect(Number(p.rows[0].n), e.table).toBe(narrowed.includes(e.table) ? 6 : 5)
      }
      const visibility = await db.query<{ tablename: string; policyname: string; permissive: string; cmd: string; roles: string }>(
        `SELECT tablename, policyname, permissive, cmd, roles::text roles FROM pg_policies WHERE permissive = 'RESTRICTIVE' AND tablename = ANY ($1::text[]) ORDER BY tablename`,
        [authorityKernelEntries.map((e) => e.table)],
      )
      expect(visibility.rows).toEqual([
        { tablename: 'ue_authority_events', policyname: 'ue_authority_events_review_visibility', permissive: 'RESTRICTIVE', cmd: 'SELECT', roles: '{union_eyes_runtime}' },
        { tablename: 'ue_authority_reviews', policyname: 'ue_authority_reviews_visibility', permissive: 'RESTRICTIVE', cmd: 'SELECT', roles: '{union_eyes_runtime}' },
      ])
    })
  })

  it('the schema-qualified principal domain is a text type, not a uuid', async () => {
    const r = await k.asAdmin(() => db.query<{ t: string }>(`SELECT format_type(atttypid, atttypmod) t FROM pg_attribute WHERE attrelid = 'ue_authority_mandates'::regclass AND attname = 'principal_user_id'`))
    expect(r.rows[0].t).toBe('ue_authority_principal')
    const base = await k.asAdmin(() => db.query<{ t: string }>(`SELECT typbasetype::regtype::text t FROM pg_type WHERE typname = 'ue_authority_principal'`))
    expect(base.rows[0].t).toBe('text')
  })
})

describe('mandate constraints', () => {
  it('records a valid mandate; refuses self-granting, no term, no instrument, a bad money limit', async () => {
    await insertMandate()
    await expect(insertMandate(mandate({ granted: `$2` }))).rejects.toThrow(/grantor_chk/)
    await expect(insertMandate(mandate({ term: `now() - interval '1 day'` }))).rejects.toThrow(/term_chk/)
    await expect(insertMandate(mandate({ instrument: `'   '` }))).rejects.toThrow(/instrument_chk/)
    await expect(insertMandate(mandate({ kind: `'financial'`, extra: 'monetary_limit_minor=100' }))).rejects.toThrow(/limit_chk/)
    await expect(insertMandate(mandate({ kind: `'financial'`, extra: 'monetary_limit_minor=-5' }))).rejects.toThrow(/limit_chk/)
  })

  it('refuses a duplicate live mandate for the same instrument', async () => {
    await insertMandate(mandate({ instrument: `'Bylaw dup'` }), U.officer)
    await expect(insertMandate(mandate({ instrument: `'Bylaw dup'` }), U.officer)).rejects.toThrow(/active_uq/)
  })

  it('emergency access: read-only, justified, independently approved, at most 24 hours', async () => {
    const emergency = (over: Record<string, string> = {}) => mandate({
      kind: `'emergency_access'`, powers: `ARRAY['read']`, term: `now() + interval '6 hours'`,
      extra: `approved_by,justification='${U.treasurer}','Urgent safety review of case 4471'`.replace(',justification', '|justification'), ...over })
    void emergency
    const insert = (approved: string | null, justification: string, powers: string, hours: number) => raw(U.president,
      `INSERT INTO ue_authority_mandates (organization_id, principal_user_id, kind, powers, scope, source_instrument, granted_by, effective_at, expires_at, approved_by, justification)
       VALUES ($1,$2,'emergency_access',${powers},'{"resourceIds":["x"]}','Bylaw',$3, now(), now() + interval '${hours} hours', $4, $5)`, [ORG, U.steward, U.president, approved, justification])
    await insert(U.treasurer, 'Urgent safety review of case 4471', `ARRAY['read']`, 6)
    await expect(insert(null, 'Urgent safety review of case 4471', `ARRAY['read']`, 6)).rejects.toThrow(/emergency_chk/)
    await expect(insert(U.steward, 'Urgent safety review of case 4471', `ARRAY['read']`, 6)).rejects.toThrow(/emergency_chk/)
    await expect(insert(U.treasurer, 'because', `ARRAY['read']`, 6)).rejects.toThrow(/emergency_chk/)
    await expect(insert(U.treasurer, 'Urgent safety review of case 4471', `ARRAY['read','write']`, 6)).rejects.toThrow(/emergency_chk/)
    await expect(insert(U.treasurer, 'Urgent safety review of case 4471', `ARRAY['read']`, 25)).rejects.toThrow(/emergency_chk/)
  })

  it('revocation is terminal; the row is otherwise immutable', async () => {
    const [{ id }] = (await k.as(U.president)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_mandates WHERE principal_user_id = $1 AND source_instrument = 'Bylaw dup'`, [U.officer]))).rows
    await expect(raw(U.president, `UPDATE ue_authority_mandates SET powers = ARRAY['read','write'] WHERE id = $1`, [id])).rejects.toThrow(/may only change/)
    await expect(raw(U.president, `UPDATE ue_authority_mandates SET expires_at = expires_at + interval '1 year' WHERE id = $1`, [id])).rejects.toThrow(/may only change/)
    await raw(U.president, `UPDATE ue_authority_mandates SET status = 'revoked', revoked_at = now(), revoked_by = $2 WHERE id = $1`, [id, U.president])
    await expect(raw(U.president, `UPDATE ue_authority_mandates SET status = 'active', revoked_at = NULL, revoked_by = NULL WHERE id = $1`, [id])).rejects.toThrow(/terminal/)
  })

  it('cannot be altered from another organization', async () => {
    const [{ id }] = (await k.as(U.president)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_mandates LIMIT 1`))).rows
    const r = await k.as(U.president, ORG_B)((t) => t.query(`UPDATE ue_authority_mandates SET status = 'suspended' WHERE id = $1 RETURNING id`, [id]))
    expect(r.rows).toHaveLength(0)
  })
})

describe('relationship, delegation, recusal and consent constraints', () => {
  it('a collaborator or privileged grant must be explicit, named and granted by someone else', async () => {
    const base = { organizationId: ORG, principalUserId: U.member, resourceType: 'case' as const, resourceId: newUuid(), effectiveAt: minutesAgo() }
    const ins = (o: Record<string, unknown>) => k.as(String(o.grantedBy ?? U.president))((t) => insertRelationship(t, { ...base, ...o } as never))
    await expect(ins({ relation: 'collaborator', origin: 'derived' })).rejects.toThrow(/explicit_chk/)
    await expect(ins({ relation: 'owner', origin: 'derived', privilegedAccess: true })).rejects.toThrow(/explicit_chk/)
    await expect(ins({ relation: 'collaborator', origin: 'explicit', grantedBy: U.member })).rejects.toThrow(/explicit_chk/)
    await expect(ins({ relation: 'collaborator', origin: 'explicit', grantedBy: U.president })).resolves.toBeTruthy()
  })

  it('a delegation cannot be to oneself or open-ended', async () => {
    const ins = (delegate: string, term: string) => raw(U.vp, `INSERT INTO ue_authority_delegations (organization_id, delegator_user_id, delegate_user_id, office, actions, resource_types, effective_at, expires_at)
      VALUES ($1,$2,$3,'VP',ARRAY['case:read'],ARRAY['case'], now(), ${term})`, [ORG, U.vp, delegate])
    await expect(ins(U.vp, `now() + interval '1 day'`)).rejects.toThrow(/deleg_self_chk/)
    await expect(ins(U.officer, 'NULL')).rejects.toThrow(/null value/)
    await expect(ins(U.officer, `now() - interval '1 day'`)).rejects.toThrow(/term_chk/)
    await ins(U.officer, `now() + interval '1 day'`)
  })

  it('a recusal is lifted by someone else, never the recused person, and only once', async () => {
    const id = await k.as(U.member)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: U.member, resourceType: 'case', resourceId: newUuid(), reason: 'relative of respondent' }))
    await expect(raw(U.member, `UPDATE ue_authority_recusals SET lifted_at = now(), lifted_by = $2 WHERE id = $1`, [id, U.member])).rejects.toThrow(/lift_chk/)
    await raw(U.president, `UPDATE ue_authority_recusals SET lifted_at = now(), lifted_by = $2 WHERE id = $1`, [id, U.president])
    await expect(raw(U.president, `UPDATE ue_authority_recusals SET reason = 'x' WHERE id = $1`, [id])).rejects.toThrow(/terminal/)
  })

  it('consent shape: referral is the member’s act; counsel disclosure names a recipient and is not member-authored', async () => {
    const base = { organizationId: ORG, memberUserId: U.member, matterId: newUuid(), categories: ['status'], purpose: 'referral', grantedAt: minutesAgo(), expiresAt: daysAhead(30) }
    // The counsel check is a different layer (proven in the resources suite); here it vouches for anyone so the database shape rule is what refuses.
    const anyone = { memberships: async () => [], counsel: { isCounselFor: async () => true } }
    const ins = (o: Record<string, unknown>) => k.as(String(o.issuedBy))((t) => insertConsent(t, { ...base, ...o } as never, anyone))
    await expect(ins({ direction: 'union_to_workaid', issuer: 'member', issuedBy: U.president })).rejects.toThrow(/shape_chk/)
    await expect(ins({ direction: 'union_to_workaid', issuer: 'counsel', issuedBy: U.counsel })).rejects.toThrow(/shape_chk/)
    await expect(ins({ direction: 'workaid_to_union', issuer: 'counsel', issuedBy: U.counsel })).rejects.toThrow(/shape_chk/)
    await expect(ins({ direction: 'workaid_to_union', issuer: 'counsel', issuedBy: U.member, recipientUserId: U.officer })).rejects.toThrow(/shape_chk/)
    await expect(ins({ direction: 'union_to_workaid', issuer: 'member', issuedBy: U.member })).resolves.toBeTruthy()
    await expect(ins({ direction: 'workaid_to_union', issuer: 'counsel', issuedBy: U.counsel, recipientUserId: U.officer })).resolves.toBeTruthy()
  })
})

describe('approvals: one person, one vote, segregation, recusal', () => {
  const open = (over: Record<string, unknown> = {}) => k.as(String(over.proposedBy ?? U.officer))((t) => openApprovalRequest(t, {
    organizationId: ORG, subjectType: 'bylaw_amendment', subjectId: newUuid(), proposedBy: U.officer, requiredApprovals: 2, riskClass: 'medium', namedApproverIds: [U.president, U.vp, U.treasurer], ...over }))
  const vote = (rid: string, who: string, decision: 'approved' | 'rejected' = 'approved') =>
    k.as(who)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: rid, approverUserId: who, decision }))
  const status = async (rid: string) => (await k.as(U.officer)((t) => t.query<{ status: string }>(`SELECT status FROM ue_authority_approval_requests WHERE id = $1`, [rid]))).rows[0].status
  const rawVote = (rid: string, who: string) => raw(who, `INSERT INTO ue_authority_approval_decisions (organization_id, approval_request_id, approver_user_id, authority_line_user_id, decision) VALUES ($1,$2,$3,$3,'approved')`, [ORG, rid, who])

  it('high-risk requests need at least two approvals (database constraint)', async () => {
    await expect(open({ riskClass: 'high', requiredApprovals: 1 })).rejects.toThrow(/required_chk/)
    await expect(open({ riskClass: 'critical', requiredApprovals: 1 })).rejects.toThrow(/required_chk/)
  })

  it('resolves after the required independent approvals, then refuses more', async () => {
    const rid = await open()
    await vote(rid, U.president)
    expect(await status(rid)).toBe('open')
    await vote(rid, U.vp)
    expect(await status(rid)).toBe('satisfied')
    await expect(vote(rid, U.treasurer)).rejects.toThrow(/STATE_NOT_ELIGIBLE|ALREADY_DECIDED/)
  })

  it('one person cannot vote twice (kernel and database)', async () => {
    const rid = await open({ requiredApprovals: 3 })
    await vote(rid, U.president)
    await expect(vote(rid, U.president)).rejects.toThrow(/ALREADY_DECIDED/)
    await expect(rawVote(rid, U.president)).rejects.toThrow(/one_vote_uq/)
  })

  it('self-approval, adverse, recused and non-named approvers are refused by the database even with the kernel bypassed', async () => {
    await expect(rawVote(await open({ proposedBy: U.president }), U.president)).rejects.toThrow(/SELF_APPROVAL/)
    await expect(rawVote(await open({ subjectAuthorId: U.vp }), U.vp)).rejects.toThrow(/SELF_APPROVAL/)
    await expect(rawVote(await open({ adverseUserIds: [U.vp] }), U.vp)).rejects.toThrow(/ADVERSE_PARTY/)
    await expect(rawVote(await open({ namedApproverIds: [U.president] }), U.vp)).rejects.toThrow(/NOT_ELIGIBLE_APPROVER/)
    const rec = await open()
    await k.as(U.treasurer)((t) => t.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'approval_request',$3,'conflict')`, [ORG, U.treasurer, rec]).then((r) => auditAuthorityMutation(t, { organizationId: ORG, action: 'test.raw', resourceType: 'raw' }).then(() => r)))
    await expect(rawVote(rec, U.treasurer)).rejects.toThrow(/RECUSED/)
  })

  it('the kernel refuses a proposer, a non-named approver, and a recused or adverse approver', async () => {
    await expect(vote(await open({ proposedBy: U.president }), U.president)).rejects.toThrow(/SELF_APPROVAL/)
    await expect(vote(await open({ namedApproverIds: [U.president] }), U.vp)).rejects.toThrow(/NOT_ELIGIBLE_APPROVER/)
    await expect(vote(await open({ adverseUserIds: [U.vp] }), U.vp)).rejects.toThrow(/ADVERSE_PARTY/)
  })

  it('a rejection resolves the request; status cannot be forced directly', async () => {
    const rid = await open()
    await expect(raw(U.officer, `UPDATE ue_authority_approval_requests SET status = 'satisfied', decided_at = now() WHERE id = $1`, [rid])).rejects.toThrow(/only be resolved by recording a decision/)
    await vote(rid, U.president, 'rejected')
    expect(await status(rid)).toBe('rejected')
  })

  it('delegated votes count under the delegator and block the delegator from voting again', async () => {
    // From here the issuance guard is back on: delegation requires its rule and acceptance.
    await k.asAdmin(async () => { for (const t of INSTRUMENT_GUARDED) await db.exec(`ALTER TABLE ${t} ENABLE TRIGGER ue_authority_guard_issuance`) })
    await k.adoptDefaultRules()
    await k.grantOffice(U.president, U.vp, U.treasurer)
    const { delegationId } = await k.as(U.president)((t) => issueDelegation(t, k.deps, {
      organizationId: ORG, delegatorUserId: U.president, delegateUserId: U.officer, office: 'President', actions: ['governance:approve'], resourceTypes: ['approval_request'], effectiveAt: minutesAgo(), expiresAt: daysAhead(10) }))
    await k.as(U.officer)((t) => t.query(`INSERT INTO ue_authority_acceptances (organization_id, instrument_type, instrument_id, accepted_by) VALUES ($1,'delegation',$2,$3)`, [ORG, delegationId, U.officer]).then(() => auditAuthorityMutation(t, { organizationId: ORG, action: 'test.raw', resourceType: 'raw' })))
    const rid = await k.as(U.steward)((t) => openApprovalRequest(t, { organizationId: ORG, subjectType: 'policy', subjectId: newUuid(), proposedBy: U.steward, requiredApprovals: 3, riskClass: 'medium' }))
    const r = await k.as(U.officer)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: rid, approverUserId: U.officer, decision: 'approved', delegationId }))
    expect(r.kernel.authorityLineUserId).toBe(U.president)
    await expect(vote(rid, U.president)).rejects.toThrow(/ALREADY_DECIDED/)
    // High-risk approvals cannot be delegated.
    const high = await k.as(U.steward)((t) => openApprovalRequest(t, { organizationId: ORG, subjectType: 'policy', subjectId: newUuid(), proposedBy: U.steward, requiredApprovals: 2, riskClass: 'high' }))
    await expect(k.as(U.officer)((t) => recordApprovalDecision(t, k.deps, { organizationId: ORG, approvalRequestId: high, approverUserId: U.officer, decision: 'approved', delegationId }))).rejects.toThrow(/DELEGATION_INVALID/)
  })

  it('an approval in another organization cannot be decided', async () => {
    const rid = await open()
    await expect(k.as(U.president, ORG_B)((t) => recordApprovalDecision(t, { memberships: async (_e, o, ids) => ids.map((u) => ({ userId: u, organizationId: o, status: 'active' as const, capacities: ['executive' as const] })) }, { organizationId: ORG_B, approvalRequestId: rid, approverUserId: U.president, decision: 'approved' }))).rejects.toThrow(/denied/)
  })
})

describe('records are append-only and cannot be forged; tenants are isolated', () => {
  it('events cannot be forged, altered, deleted or truncated — even by an administrator', async () => {
    await k.asAdmin(async () => {
      const [{ id }] = (await db.query<{ id: string }>(`SELECT source_id::text id FROM ue_authority_events LIMIT 1`)).rows
      await expect(db.query(`INSERT INTO ue_authority_events (organization_id, source_table, source_id, operation, row_after) VALUES ($1,'ue_authority_mandates',$2,'INSERT','{}')`, [ORG, id])).rejects.toThrow(/recording trigger/)
      await expect(db.query(`UPDATE ue_authority_events SET actor_user_id = 'x'`)).rejects.toThrow(/append-only/)
      await expect(db.query(`DELETE FROM ue_authority_events`)).rejects.toThrow(/append-only/)
      for (const e of authorityKernelEntries) {
        await expect(db.query(`TRUNCATE ${e.table} CASCADE`), e.table).rejects.toThrow(/append-only/)
        const before = (await db.query<{ n: string }>(`SELECT count(*)::text n FROM ${e.table}`)).rows[0].n
        // A row-level DELETE trigger only fires on rows that exist; the rows that exist must survive.
        await db.query(`DELETE FROM ${e.table}`).catch((err: Error) => expect(err.message, e.table).toMatch(/append-only/))
        expect((await db.query<{ n: string }>(`SELECT count(*)::text n FROM ${e.table}`)).rows[0].n, e.table).toBe(before)
      }
    })
  })

  it('another organization cannot read or write this organization’s authority rows', async () => {
    const seen = (org: string) => k.as(U.president, org)((t) => t.query(`SELECT 1 FROM ue_authority_mandates`)).then((r) => r.rows.length)
    expect(await seen(ORG)).toBeGreaterThan(0)
    expect(await seen(ORG_B)).toBe(0)
    await expect(k.as(U.president, ORG_B)((t) => t.query(
      `INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'x')`, [ORG, U.president, newUuid()]))).rejects.toThrow(/row-level security/)
  })

  it('with no tenant context nothing is visible', async () => {
    await db.query(`SELECT set_config('app.current_org_id', '', false)`)
    expect((await db.query(`SELECT 1 FROM ue_authority_mandates`)).rows).toHaveLength(0)
    expect((await db.query(`SELECT 1 FROM ue_authority_events`)).rows).toHaveLength(0)
  })
})
