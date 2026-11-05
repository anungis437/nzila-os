/**
 * F06 R1 on real PostgreSQL — claiming an ICRA assessment withdraws its bearer capability in the same write.
 *
 * Drives the real claim route handler against the combined database with concurrent claimants, then proves the old capability is
 * refused for the claimed row read back from the database. The route's own conditional UPDATE is what decides the winner.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 * Needs UE_CANONICAL_BOOTSTRAP_V2=0 so the audit goes through the audit_logs insert branch.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ORG, seedUser, type Db } from './authority-kernel-harness'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const PURCHASER = 'user_icra_purchaser'
const PURCHASER_EMAIL = 'purchaser@example.test'

const identity = vi.hoisted(() => ({ userId: 'user_icra_purchaser' as string | null, email: 'purchaser@example.test', admin: true }))
const holder = vi.hoisted(() => ({ pool: null as unknown }))

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: identity.userId }) }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: async () => '00000000-0000-4000-8000-0000000000aa' }))
vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: async () => identity.admin,
  getCurrentUser: async () => ({ email: identity.email }),
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    const client = await (holder.pool as pg.Pool).connect()
    try {
      await client.query('BEGIN')
      const out = await fn(drizzle(client))
      await client.query('COMMIT')
      return out
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}))

const adapt = (c: pg.Client): Db => ({ exec: (q) => c.query(q), query: (q, p) => c.query(q, p as unknown[]) as never })

describe.skipIf(!URL)('ICRA claim revokes the bearer capability on real PostgreSQL', () => {
  let admin: pg.Client
  let pool: pg.Pool

  async function seedAssessment(over: { claimToken?: string; expired?: boolean; email?: string | null } = {}) {
    const id = randomUUID()
    const capability = `cap_${randomUUID()}${randomUUID()}`
    const claimToken = over.claimToken ?? `claim_${randomUUID()}${randomUUID()}`
    const { hashCapabilityToken } = await import('../../lib/icra/assessment-capability')
    await admin.query(
      `INSERT INTO icra_assessments (id, status, claim_email, claim_token, claim_token_expires_at, capability_token_hash, capability_token_expires_at)
       VALUES ($1, 'submitted', $2, $3, $4, $5, now() + interval '30 days')`,
      [
        id,
        over.email === undefined ? PURCHASER_EMAIL : over.email,
        claimToken,
        over.expired ? new Date(Date.now() - 3_600_000) : new Date(Date.now() + 86_400_000),
        hashCapabilityToken(capability),
      ],
    )
    return { id, capability, claimToken }
  }

  const claim = async (id: string, claimToken: string) => {
    const { POST } = await import('../../app/api/icra/[assessmentId]/claim/route')
    return POST(
      new Request(`https://ue.test/api/icra/${id}/claim`, { method: 'POST', body: JSON.stringify({ claimToken }) }) as never,
      { params: Promise.resolve({ assessmentId: id }) },
    )
  }

  const row = async (id: string) =>
    (await admin.query('SELECT claimed_by_user_id, claimed_org_id, claimed_at, claim_token, capability_token_hash, capability_token_expires_at FROM icra_assessments WHERE id = $1', [id])).rows[0]

  beforeAll(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '0'
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 8 })
    holder.pool = pool
    await admin.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
      VALUES ($1,'icra-claim','icra-claim','local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`, ['00000000-0000-4000-8000-0000000000aa'])
    await seedUser(adapt(admin), PURCHASER)
  }, 120_000)

  afterAll(async () => {
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('exactly one of several concurrent claimants wins, and the capability is gone from the row', async () => {
    const a = await seedAssessment()
    const results = await Promise.all(Array.from({ length: 6 }, () => claim(a.id, a.claimToken)))
    const statuses = results.map((r) => r.status).sort()
    expect(statuses.filter((s) => s === 200)).toHaveLength(1)
    expect(statuses.filter((s) => s !== 200).every((s) => s === 404 || s === 409)).toBe(true)

    const after = await row(a.id)
    expect(after.claimed_by_user_id).toBe(PURCHASER)
    expect(after.claim_token).toBeNull()
    expect(after.capability_token_hash).toBeNull()
    expect(after.capability_token_expires_at).toBeNull()

    const winner = results.find((r) => r.status === 200)!
    expect(winner.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i)
  })

  it('refuses the old capability after the claim for an anonymous caller and for a non-owner account', async () => {
    const a = await seedAssessment()
    expect((await claim(a.id, a.claimToken)).status).toBe(200)

    const { authorizeAssessmentToken } = await import('../../lib/icra/assessment-access')
    const claimed = await admin.query(
      'SELECT capability_token_hash AS "capabilityTokenHash", capability_token_expires_at AS "capabilityTokenExpiresAt", claimed_at AS "claimedAt", claimed_org_id AS "claimedOrgId", claimed_by_user_id AS "claimedByUserId" FROM icra_assessments WHERE id = $1',
      [a.id],
    )
    const anonymous = await authorizeAssessmentToken(a.capability, claimed.rows[0], { currentUserId: async () => null, hasRole: async () => false })
    expect(anonymous).toEqual({ ok: false, reason: 'authentication_required' })
    const stranger = await authorizeAssessmentToken(a.capability, claimed.rows[0], { currentUserId: async () => 'user_stranger', hasRole: async () => false })
    expect(stranger).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('does not let a token replay claim an already claimed assessment', async () => {
    const a = await seedAssessment()
    expect((await claim(a.id, a.claimToken)).status).toBe(200)
    expect((await claim(a.id, a.claimToken)).status).not.toBe(200)
  })

  it('leaves an unclaimed assessment capability untouched when the claim is refused', async () => {
    const expired = await seedAssessment({ expired: true })
    expect((await claim(expired.id, expired.claimToken)).status).toBe(410)
    expect((await row(expired.id)).capability_token_hash).not.toBeNull()

    const otherBuyer = await seedAssessment({ email: 'someone.else@example.test' })
    expect((await claim(otherBuyer.id, otherBuyer.claimToken)).status).toBe(403)
    const after = await row(otherBuyer.id)
    expect(after.capability_token_hash).not.toBeNull()
    expect(after.claimed_at).toBeNull()

    identity.admin = false
    try {
      const plainMember = await seedAssessment()
      expect((await claim(plainMember.id, plainMember.claimToken)).status).toBe(403)
      expect((await row(plainMember.id)).capability_token_hash).not.toBeNull()
    } finally {
      identity.admin = true
    }
  })
})

void ORG
