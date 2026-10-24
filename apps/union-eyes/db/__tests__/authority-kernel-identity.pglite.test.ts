/**
 * Identity and principal binding on PGlite. Proves an external provider subject
 * only ever reaches an INTERNAL principal through one verified, active, unique
 * binding, that internal ids are not uuids, and that the database receives the
 * internal principal and organization. The fixture tables mirror the canonical
 * identity contract (see authority-kernel-harness.ts). Not a staging pass.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, ORG_B, seedBinding, seedMembership, seedUser, U } from './authority-kernel-harness'
import { freshDb, kit } from './authority-kernel-testkit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import { isPrincipalId, parsePgTextArray, runAuthorityTransaction, type SqlExecutor } from '../../lib/authority/store/executor'
import {
  canonicalMembershipSource,
  listActiveOrganizations,
  resolveAuthorityPrincipal,
  resolveInternalPrincipal,
} from '../../lib/authority/store/identity'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>
const TENANT = '11111111-1111-4111-8111-111111111111'
const sub = (oid: string) => `${TENANT}:${oid}`

const resolve = (provider: string, subject: string) => k.as(U.president)((t) => resolveInternalPrincipal(t, { provider, subject }))

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(async () => {
    await seedBinding(db, 'entra', sub('oid-pres'), U.president)
    await seedBinding(db, 'entra', sub('oid-aud'), U.auditor)
    await seedUser(db, 'user_suspended', { lifecycle: 'suspended' })
    await seedUser(db, 'user_deprov', { lifecycle: 'deprovisioned' })
    await seedUser(db, 'user_inactive', { active: false })
    await seedBinding(db, 'entra', sub('oid-susp'), 'user_suspended')
    await seedBinding(db, 'entra', sub('oid-deprov'), 'user_deprov')
    await seedBinding(db, 'entra', sub('oid-inactive'), 'user_inactive')
    await seedBinding(db, 'entra', sub('oid-disabled'), U.clerk, { disabled: true })
    await seedBinding(db, 'entra', sub('oid-revoked'), U.clerk, { revoked: true })
    await seedBinding(db, 'entra', sub('oid-state'), U.clerk, { state: 'disabled' })
    await seedBinding(db, 'entra', sub('oid-dup-1'), U.steward)
    await seedBinding(db, 'entra', sub('oid-dup-2'), U.steward)
    await seedBinding(db, 'clerk', 'user_2abcLegacy', U.officer)
    await seedBinding(db, 'entra', sub('oid-admin'), 'platform_admin_1')
    await seedUser(db, 'platform_admin_1', { admin: true })
  })
})

describe('provider subject -> internal principal', () => {
  it('resolves exactly one verified active binding to an active user, to a NON-uuid internal id', async () => {
    const p = await resolve('entra', sub('oid-pres'))
    expect(p.internalUserId).toBe(U.president)
    expect(p.internalUserId).not.toBe(sub('oid-pres'))
    expect(isPrincipalId(p.internalUserId)).toBe(true)
    expect((await resolve('entra', sub('oid-aud'))).internalUserId).toBe('entra-oid-auditor-0001')
  })

  it('refuses an unbound subject, and never binds by email or by string equality with an internal id', async () => {
    await expect(resolve('entra', sub('oid-nobody'))).rejects.toThrow(/no single verified active binding/)
    await expect(resolve('entra', U.president)).rejects.toThrow(/Entra subjects must be/) // an internal id is not a provider subject
    await expect(resolve('clerk', U.president)).rejects.toThrow(/no single verified active binding/)
    await expect(resolve('entra', `${TENANT}:${U.president}@example.test`)).rejects.toThrow(/no single verified active binding/)
  })

  it('refuses disabled, revoked and non-active bindings (an unverified binding cannot exist: verified_at is NOT NULL)', async () => {
    for (const oid of ['oid-disabled', 'oid-revoked', 'oid-state']) {
      await expect(resolve('entra', sub(oid))).rejects.toThrow(/no single verified active binding/)
    }
  })

  it('refuses a suspended, deprovisioned or inactive user even with a good binding', async () => {
    for (const oid of ['oid-susp', 'oid-deprov', 'oid-inactive']) {
      await expect(resolve('entra', sub(oid))).rejects.toThrow(/no single verified active binding/)
    }
  })

  it('refuses ambiguity: a user with two active bindings for one provider is not resolved', async () => {
    await expect(resolve('entra', sub('oid-dup-1'))).rejects.toThrow(/more than one active binding/)
    await expect(resolve('entra', sub('oid-dup-2'))).rejects.toThrow(/more than one active binding/)
  })

  it('a provider change is a different provider: the legacy binding resolves on its own provider only', async () => {
    expect((await resolve('clerk', 'user_2abcLegacy')).internalUserId).toBe(U.officer)
    await expect(resolve('entra', 'user_2abcLegacy')).rejects.toThrow(/Entra subjects must be/)
  })

  it('rejects malformed provider identities before any query', async () => {
    await expect(resolve('Entra', sub('x'))).rejects.toThrow(/malformed provider/)
    await expect(resolve('entra', ` ${sub('x')}`)).rejects.toThrow(/malformed subject/)
    await expect(resolve('entra', `${TENANT}:a:b`)).rejects.toThrow(/Entra subjects must be/)
    await expect(resolve('', 'x')).rejects.toThrow(/malformed provider/)
  })

  it('platform staff status is informational and grants nothing in an organization', async () => {
    const p = await resolve('entra', sub('oid-admin'))
    expect(p.platformStaff).toBe(true)
    await expect(k.as(U.president)((t) => resolveAuthorityPrincipal(t, { provider: 'entra', subject: sub('oid-admin'), organizationId: ORG }))).rejects.toThrow(/no membership/)
  })
})

describe('membership and tenant binding', () => {
  it('resolves a principal with exactly one active membership in the explicit organization', async () => {
    const a = await k.as(U.president)((t) => resolveAuthorityPrincipal(t, { provider: 'entra', subject: sub('oid-pres'), organizationId: ORG }))
    expect(a.membership.status).toBe('active')
    expect(a.membership.capacities).toContain('executive')
    expect(a.organizationId).toBe(ORG)
  })

  it('there is no primary-organization fallback and a mismatched session organization is refused', async () => {
    await expect(k.as(U.president)((t) => resolveAuthorityPrincipal(t, { provider: 'entra', subject: sub('oid-pres'), organizationId: 'not-a-uuid' }))).rejects.toThrow(/organization uuid/)
    await expect(k.as(U.president)((t) => resolveAuthorityPrincipal(t, { provider: 'entra', subject: sub('oid-pres'), organizationId: ORG, sessionOrganizationId: ORG_B }))).rejects.toThrow(/session organization does not match/)
    await expect(k.as(U.president)((t) => resolveAuthorityPrincipal(t, { provider: 'entra', subject: sub('oid-pres'), organizationId: ORG_B }))).rejects.toThrow(/no membership/)
  })

  it('multiple memberships: each organization yields its own role and capacities; tenant switching re-resolves', async () => {
    await k.asAdmin(() => seedMembership(db, U.auditor, ORG, 'member'))
    await k.asAdmin(() => seedMembership(db, U.auditor, ORG_B, 'secretary_treasurer'))
    const inA = await k.as(U.auditor)((t) => canonicalMembershipSource(t, ORG, [U.auditor]))
    const inB = await k.as(U.auditor)((t) => canonicalMembershipSource(t, ORG_B, [U.auditor]))
    expect(inA[0].capacities).not.toContain('financial_officer')
    expect(inB[0].capacities).toContain('financial_officer')
    expect(await k.as(U.auditor)((t) => listActiveOrganizations(t, U.auditor))).toEqual([ORG, ORG_B].sort())
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
    for (const u of ['user_m_inactive', 'user_m_susp', 'user_m_gone']) {
      await expect(k.as(U.president)((t) => resolveAuthorityPrincipal(t, { provider: 'x', subject: u, organizationId: ORG }))).rejects.toThrow()
    }
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

describe('row-level security receives the internal principal and organization', () => {
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
