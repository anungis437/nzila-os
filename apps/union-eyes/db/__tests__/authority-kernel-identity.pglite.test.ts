/**
 * Identity integration on PGlite. Provider identity is resolved by the platform auth layer, not by this kernel;
 * what is proven here is (1) a resolver's answer is re-validated before it can mean anything, (2) authority
 * transactions take the actor, tenant and session ONLY from a verified binding, and (3) the membership fact
 * source and the database context behave as the contract requires. The real provider -> principal ->
 * membership -> decision -> RLS path runs against the v2 auth bootstrap in
 * authority-kernel-identity-path.native.test.ts. Not a staging pass.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, ORG_B, seedMembership, U } from './authority-kernel-harness'
import { freshDb, kit } from './authority-kernel-testkit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import { isPrincipalId, parsePgTextArray, runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import { canonicalMembershipSource } from '../../lib/authority/store/identity'
import {
  assertVerifiedBinding,
  resolveProviderPrincipal,
  runBoundAuthorityTransaction,
  type ResolvedProviderBinding,
  type VerifiedOrgBinding,
} from '../../lib/authority/store/platform-identity'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>
const TENANT = '11111111-1111-4111-8111-111111111111'
const sub = (oid: string) => `${TENANT}:${oid}`

const good = (over: Partial<ResolvedProviderBinding> = {}): ResolvedProviderBinding => ({
  id: 'b-1', provider: 'entra', providerSubject: sub('oid-pres'), platformUserId: U.president, state: 'active', verifiedAt: new Date(), ...over,
})
const via = (answer: ResolvedProviderBinding | null) => async () => answer
const binding = (over: Partial<VerifiedOrgBinding> = {}): VerifiedOrgBinding => ({
  userId: U.president, organizationId: ORG, role: 'president', sessionToken: 'raw-session-bearer', expiresAt: new Date(Date.now() + 60_000), authority: 'pg-session', ...over,
})

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
})

describe('provider claims -> internal principal (supported resolver, re-validated)', () => {
  it('maps a verified active binding to a NON-uuid internal id', async () => {
    const p = await resolveProviderPrincipal(via(good()), { provider: 'entra', subject: sub('oid-pres') })
    expect(p.internalUserId).toBe(U.president)
    expect(p.internalUserId).not.toBe(sub('oid-pres'))
    expect(isPrincipalId(p.internalUserId)).toBe(true)
  })

  it('refuses when the resolver finds no binding (unbound, revoked, disabled or unverified all look the same)', async () => {
    await expect(resolveProviderPrincipal(via(null), { provider: 'entra', subject: sub('oid-none') })).rejects.toThrow(/no active, verified binding/)
  })

  it('refuses a resolver that answers for a different identity, a non-active state or no verification', async () => {
    const claim = { provider: 'entra', subject: sub('oid-pres') }
    await expect(resolveProviderPrincipal(via(good({ providerSubject: sub('oid-other') })), claim)).rejects.toThrow(/different identity/)
    await expect(resolveProviderPrincipal(via(good({ provider: 'clerk' })), claim)).rejects.toThrow(/different identity/)
    for (const state of ['disabled', 'revoked', 'pending']) {
      await expect(resolveProviderPrincipal(via(good({ state })), claim)).rejects.toThrow(/not active/)
    }
    await expect(resolveProviderPrincipal(via(good({ verifiedAt: 'never' })), claim)).rejects.toThrow(/not verified/)
  })

  it('refuses an inactive principal and an invalid or mismatched principal id', async () => {
    const claim = { provider: 'entra', subject: sub('oid-pres') }
    await expect(resolveProviderPrincipal(via(good({ principal: { id: U.president, state: 'suspended' } })), claim)).rejects.toThrow(/not active/)
    await expect(resolveProviderPrincipal(via(good({ principal: { id: 'someone-else', state: 'active' } })), claim)).rejects.toThrow(/not active/)
    for (const bad of ['', ' padded ', 'with\nnewline']) {
      await expect(resolveProviderPrincipal(via(good({ platformUserId: bad })), claim)).rejects.toThrow(/principal id is not valid/)
    }
  })

  it('rejects malformed provider identities before the resolver is called', async () => {
    let called = 0
    const spy = async () => { called++; return good() }
    for (const bad of [{ provider: 'Entra', subject: sub('o') }, { provider: '', subject: 'x' }, { provider: 'entra', subject: 'only-one-part' }, { provider: 'entra', subject: `${sub('o')}:extra` }, { provider: 'entra', subject: ' padded' }, { provider: 'entra', subject: 'x'.repeat(513) }]) {
      await expect(resolveProviderPrincipal(spy, bad)).rejects.toThrow(/provider identity/)
    }
    expect(called).toBe(0)
  })

  it('never binds by email or by equality with an internal id: the claim is passed through verbatim', async () => {
    const seen: string[] = []
    await resolveProviderPrincipal(async (p, s) => { seen.push(p, s); return good() }, { provider: 'entra', subject: sub('oid-pres') })
    expect(seen).toEqual(['entra', sub('oid-pres')])
  })
})

describe('authority transactions run only as the verified binding', () => {
  const ctx = (b: VerifiedOrgBinding) => runBoundAuthorityTransaction(db as unknown as SqlExecutor, b, (t) =>
    t.query<{ org: string; usr: string; tok: string }>(`SELECT current_setting('app.current_org_id', true) org, current_setting('app.current_user_id', true) usr, current_setting('app.current_session_token', true) tok`))

  it('sets the actor, tenant and session from the binding, for the transaction only', async () => {
    const r = await ctx(binding())
    expect(r.rows[0]).toEqual({ org: ORG, usr: U.president, tok: 'raw-session-bearer' })
    const after = await db.query<{ tok: string }>(`SELECT current_setting('app.current_session_token', true) tok`)
    expect(after.rows[0].tok).toBe('')
  })

  it('refuses an expired session, a missing session, a non-canonical organization and an unsafe principal', async () => {
    await expect(ctx(binding({ expiresAt: new Date(Date.now() - 1) }))).rejects.toThrow(/expired/)
    await expect(ctx(binding({ sessionToken: '' }))).rejects.toThrow(/no session authority/)
    await expect(ctx(binding({ organizationId: 'not-a-uuid' }))).rejects.toThrow(/canonical organization uuid/)
    for (const bad of ['', ' padded ', 'with\nnewline']) await expect(ctx(binding({ userId: bad }))).rejects.toThrow(/valid internal principal id/)
    await expect(ctx(binding({ authority: 'cookie' as never }))).rejects.toThrow(/unsupported authority/)
    expect(() => assertVerifiedBinding(undefined as never)).toThrow(/no authenticated binding/)
  })

  it('a decision for anyone but the bound actor is refused, whatever the caller asks', async () => {
    const CASE = newUuid()
    await k.asAdmin(() => db.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3)`, [CASE, ORG, U.member]))
    const asMember = binding({ userId: U.member, role: 'member' })
    const ask = (who: string) => runBoundAuthorityTransaction(db as unknown as SqlExecutor, asMember, (t) =>
      enforceAuthority(t, k.deps, { principalUserId: who, organizationId: ORG, action: 'case:read', resource: { type: 'case', id: CASE, organizationId: ORG } }, { authenticated: true }))
    expect((await ask(U.member)).effect).toBe('allow')
    const forged = await ask(U.president)
    expect(forged.effect).toBe('deny')
    expect(forged.reasons.map((r) => r.code)).toContain('PRINCIPAL_MISMATCH')
  })

  it('there is no way to run in another tenant than the binding names', async () => {
    const r = await runBoundAuthorityTransaction(db as unknown as SqlExecutor, binding({ organizationId: ORG_B }), (t) => t.query(`SELECT 1 FROM ue_authority_recusals`))
    expect(r.rows).toHaveLength(0)
  })
})
describe('membership and tenant binding', () => {
  it('an active membership in the explicit organization yields its capacities; another organization yields nothing', async () => {
    const [m] = await k.as(U.president)((t) => canonicalMembershipSource(t, ORG, [U.president]))
    expect(m.status).toBe('active')
    expect(m.capacities).toContain('executive')
    expect(await k.as(U.president, ORG_B)((t) => canonicalMembershipSource(t, ORG_B, [U.president]))).toEqual([])
    expect(await k.as(U.president)((t) => canonicalMembershipSource(t, 'not-a-uuid', [U.president]))).toEqual([])
  })
  it('multiple memberships: each organization yields its own role and capacities; tenant switching re-resolves', async () => {
    await k.asAdmin(() => seedMembership(db, U.auditor, ORG, 'member'))
    await k.asAdmin(() => seedMembership(db, U.auditor, ORG_B, 'secretary_treasurer'))
    const inA = await k.as(U.auditor)((t) => canonicalMembershipSource(t, ORG, [U.auditor]))
    const inB = await k.as(U.auditor)((t) => canonicalMembershipSource(t, ORG_B, [U.auditor]))
    expect(inA[0].capacities).not.toContain('financial_officer')
    expect(inB[0].capacities).toContain('financial_officer')
  })

  it('suspension, revocation and inactivity make a membership non-active and authority is denied', async () => {
    await k.asAdmin(async () => {
      await seedMembership(db, 'user_m_inactive', ORG, 'officer', false)
      await seedMembership(db, 'user_m_susp', ORG, 'officer')
      await db.query(`UPDATE user_management.users SET lifecycle_state = 'suspended' WHERE user_id = 'user_m_susp'`)
      await seedMembership(db, 'user_m_gone', ORG, 'officer')
      await db.query(`UPDATE user_management.users SET lifecycle_state = 'deprovisioned' WHERE user_id = 'user_m_gone'`)
    })
    const rows = await k.as(U.president)((t) => canonicalMembershipSource(t, ORG, ['user_m_inactive', 'user_m_susp', 'user_m_gone']))
    expect(Object.fromEntries(rows.map((r) => [r.userId, r.status]))).toEqual({ user_m_inactive: 'inactive', user_m_susp: 'suspended', user_m_gone: 'revoked' })
  })

  it('an unknown lifecycle state fails closed', async () => {
    await k.asAdmin(async () => {
      await seedMembership(db, 'user_m_odd', ORG, 'officer')
      await db.query(`UPDATE user_management.users SET lifecycle_state = 'pending_review' WHERE user_id = 'user_m_odd'`)
    })
    const [m] = await k.as(U.president)((t) => canonicalMembershipSource(t, ORG, ['user_m_odd']))
    expect(m.status).toBe('inactive')
  })

  it('a duplicate membership row makes the kernel deny (contradictory facts)', async () => {
    const CASE = newUuid()
    await k.asAdmin(() => db.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3)`, [CASE, ORG, U.member]))
    const dup = { memberships: async (e: SqlExecutor, org: string, ids: readonly string[]) => [...(await canonicalMembershipSource(e, org, ids)), ...(await canonicalMembershipSource(e, org, ids))] }
    const d = await k.as(U.member)((t) => enforceAuthority(t, dup, { principalUserId: U.member, organizationId: ORG, action: 'case:read', resource: { type: 'case', id: CASE, organizationId: ORG } }, { authenticated: true }))
    expect(d.effect).toBe('deny')
  })

  it('a role is capacity (eligibility) only: an admin or platform role maps to no case or money authority', async () => {
    await k.asAdmin(() => seedMembership(db, 'user_org_admin', ORG, 'admin'))
    await k.asAdmin(() => seedMembership(db, 'user_clc', ORG, 'clc_executive'))
    const rows = await k.as(U.president)((t) => canonicalMembershipSource(t, ORG, ['user_org_admin', 'user_clc']))
    expect(rows.find((r) => r.userId === 'user_org_admin')?.capacities).toEqual(['member'])
    expect(rows.find((r) => r.userId === 'user_clc')?.capacities).toEqual([])
  })
})

describe('row-level security receives the internal principal and organization (plain context)', () => {
  const ctx = (org: string, user: string) => runAuthorityTransaction(db as unknown as SqlExecutor, { organizationId: org, userId: user }, (t) =>
    t.query<{ org: string; usr: string }>(`SELECT current_setting('app.current_org_id', true) org, current_setting('app.current_user_id', true) usr`))

  it('sets the internal (non-uuid) principal id and the organization for the transaction only', async () => {
    const r = await ctx(ORG, U.auditor)
    expect(r.rows[0]).toEqual({ org: ORG, usr: U.auditor })
    const after = await db.query<{ org: string; usr: string }>(`SELECT current_setting('app.current_org_id', true) org, current_setting('app.current_user_id', true) usr`)
    expect(after.rows[0].org).toBe('')
    expect(after.rows[0].usr).toBe('')
  })

  it('refuses a provider subject, a blank id or a control character as the principal', async () => {
    for (const bad of ['', ' padded ', 'with\nnewline', 'x'.repeat(256)]) {
      await expect(ctx(ORG, bad)).rejects.toThrow(/valid internal principal id/)
    }
    await expect(ctx('not-a-uuid', U.auditor)).rejects.toThrow(/organizationId must be a uuid/)
  })

  it('the database domain refuses what the validator refuses', async () => {
    await expect(k.as(U.president)((t) => t.query(
      `INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'r')`, [ORG, ' padded ', newUuid()]))).rejects.toThrow(/ue_authority_principal_chk/)
  })

  it('a foreign tenant context cannot read another organization’s authority rows', async () => {
    await k.asAdmin(() => db.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,$2,'case',$3,'r')`, [ORG, U.member, newUuid()]).catch(() => undefined))
    const seen = await k.as(U.president, ORG_B)((t) => t.query(`SELECT 1 FROM ue_authority_recusals`))
    expect(seen.rows).toHaveLength(0)
  })
})

describe('principal id and array helpers', () => {
  it('accepts legacy and provider-shaped internal ids, refuses unsafe ones', () => {
    for (const ok of ['user_2abc', 'entra-oid-1', '00000000-0000-4000-8000-000000000001', 'a']) expect(isPrincipalId(ok)).toBe(true)
    for (const bad of ['', ' a', 'a ', 'a\u0000b', 'a'.repeat(256), 12 as unknown as string]) expect(isPrincipalId(bad)).toBe(false)
  })

  it('parses Postgres array literals, including quoting, and refuses malformed or NULL elements', () => {
    expect(parsePgTextArray('{}')).toEqual([])
    expect(parsePgTextArray('{a,b}')).toEqual(['a', 'b'])
    expect(parsePgTextArray('{"a b","c,d","e\\"f"}')).toEqual(['a b', 'c,d', 'e"f'])
    expect(parsePgTextArray(['x'])).toEqual(['x'])
    expect(() => parsePgTextArray('{a,NULL}')).toThrow()
    expect(() => parsePgTextArray('nope')).toThrow()
    expect(() => parsePgTextArray('{"open}')).toThrow()
  })
})
