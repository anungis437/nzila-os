import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import type { PGlite } from '@electric-sql/pglite'
import { freshDb, kit } from '@/db/__tests__/authority-kernel-testkit'
import { ORG, ORG_B, seedMembership, U } from '@/db/__tests__/authority-kernel-harness'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { isActiveOrganizationAdministrator } from './organization-admin'

let pg: PGlite
let k: ReturnType<typeof kit>
const admin = 'synthetic-business-admin'
const allowed = (signedIn = admin, requestedActor = signedIn, organizationId = ORG) => drizzle(pg).transaction(async tx => {
  await tx.execute(sql`SELECT set_config('app.current_user_id',${signedIn},true),set_config('app.current_org_id',${organizationId},true)`)
  return isActiveOrganizationAdministrator(tx as unknown as RLSTx, { userId: requestedActor, organizationId })
})
beforeAll(async () => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  pg = await freshDb(); k = kit(pg)
  await k.asAdmin(() => seedMembership(pg, admin, ORG, 'admin'))
})
afterAll(async () => { await pg?.close(); vi.unstubAllEnvs() })

describe('live business administration on SQL', () => {
  it('requires direct membership in the organization and the transaction’s actual actor', async () => {
    expect(await allowed()).toBe(true)
    expect(await allowed(U.officer)).toBe(false)
    expect(await allowed(admin, admin, ORG_B)).toBe(false)
    expect(await allowed(U.member, admin)).toBe(false)
  })
  it('rejects suspended identities and inactive memberships', async () => {
    await k.asAdmin(() => pg.query("UPDATE user_management.users SET lifecycle_state='suspended' WHERE user_id=$1", [admin]))
    try { expect(await allowed()).toBe(false) }
    finally { await k.asAdmin(() => pg.query("UPDATE user_management.users SET lifecycle_state='active' WHERE user_id=$1", [admin])) }
    await k.asAdmin(() => pg.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1', [admin]))
    try { expect(await allowed()).toBe(false) }
    finally { await k.asAdmin(() => pg.query('UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1', [admin])) }
  })
  it('propagates unavailable authority storage without a credential or title fallback', async () => {
    await k.asAdmin(() => pg.exec('REVOKE SELECT ON user_management.organization_users FROM union_eyes_runtime'))
    try { await expect(allowed()).rejects.toThrow() }
    finally { await k.asAdmin(() => pg.exec('GRANT SELECT ON user_management.organization_users TO union_eyes_runtime')) }
  })
})
