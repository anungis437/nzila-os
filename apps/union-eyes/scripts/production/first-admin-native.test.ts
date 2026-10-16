import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { decryptSecret } from '../../../../packages/platform-auth/src/mfa/encryption'
import { openNativeRuntimeFixture } from '../bootstrap-v2/native-runtime-fixture'
import { folder, type V2Plan } from '../bootstrap-v2/source'
import {
  bootstrapFirstAdmin,
  BOOTSTRAP_ACTION,
  FirstAdminError,
  type BootstrapDb,
  type FirstAdminInput,
} from './first-admin-bootstrap'

const native = process.env.UE_V2_NATIVE_MANIFEST === '1' ? describe : describe.skip

native('first-admin bootstrap against real PostgreSQL and the canonical V2 schema', () => {
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>>
  let owner: ReturnType<typeof postgres>
  let db: BootstrapDb
  const previousKey = process.env.AUTH_MFA_ENCRYPTION_KEY

  const input = (patch: Partial<FirstAdminInput> = {}): FirstAdminInput => ({
    userId: 'ue-first-admin',
    email: 'first.admin@example.invalid',
    password: 'Correct-Horse-Battery-7!',
    organizationId: '7d2b8f3a-61c4-4b1e-9a55-0c5e7a1d2f10',
    organizationName: 'Synthetic First Organization',
    organizationSlug: 'synthetic-first',
    role: 'admin',
    platformAdmin: true,
    operator: 'synthetic-operator',
    ...patch,
  })
  const count = async (table: string, where = 'true') =>
    Number(
      (await fixture.seed.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`)).rows[0]
        .n,
    )

  beforeAll(async () => {
    process.env.AUTH_MFA_ENCRYPTION_KEY = randomBytes(32).toString('hex')
    fixture = await openNativeRuntimeFixture(plan)
    const url = new URL(fixture.runtimeUrl)
    url.username = 'postgres'
    owner = postgres(url.toString(), { max: 10, onnotice: () => undefined })
    db = drizzle(owner) as unknown as BootstrapDb
  }, 600000)

  afterAll(async () => {
    await owner?.end({ timeout: 5 })
    if (fixture) await fixture.dispose()
    if (previousKey === undefined) delete process.env.AUTH_MFA_ENCRYPTION_KEY
    else process.env.AUTH_MFA_ENCRYPTION_KEY = previousKey
  })

  beforeEach(async () => {
    // Fresh database state per test (replica role skips the append-only and referential triggers).
    await fixture.seed.query('SET session_replication_role = replica')
    await fixture.seed.query(
      'TRUNCATE public.audit_logs, user_management.mfa_totp, user_management.organization_users, user_management.users, public.organizations CASCADE',
    )
    await fixture.seed.query('SET session_replication_role = DEFAULT')
  })

  it('establishes the organization, user, membership, enrolled MFA and one audited chain head', async () => {
    const result = await bootstrapFirstAdmin(db, input())
    expect(result.result).toBe('CREATED')
    expect(await count('public.organizations')).toBe(1)
    expect(
      await count('user_management.users', "user_id='ue-first-admin' AND is_system_admin"),
    ).toBe(1)
    expect(
      await count(
        'user_management.organization_users',
        "user_id='ue-first-admin' AND role='admin' AND is_active",
      ),
    ).toBe(1)

    const stored = (
      await fixture.seed.query(
        "SELECT password_hash, (SELECT secret_encrypted FROM user_management.mfa_totp WHERE user_id='ue-first-admin') AS totp FROM user_management.users WHERE user_id='ue-first-admin'",
      )
    ).rows[0]
    expect(stored.password_hash).toMatch(/^\$argon2/)
    expect(stored.password_hash).not.toContain('Correct-Horse')
    // The one-time provisioning secret matches the encrypted enrollment
    const secret = new URL(
      (result as { totpProvisioningUri: string }).totpProvisioningUri,
    ).searchParams.get('secret')
    expect(decryptSecret(stored.totp)).toBe(secret)

    const audit = await fixture.seed.query(
      `SELECT action, user_id, resource_id, previous_hash, content_hash, details FROM public.audit_logs`,
    )
    expect(audit.rowCount).toBe(1)
    expect(audit.rows[0]).toMatchObject({
      action: BOOTSTRAP_ACTION,
      user_id: 'operator:synthetic-operator',
      resource_id: 'ue-first-admin',
      previous_hash: null,
    })
    expect(audit.rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(audit.rows[0].details)).not.toContain('first.admin@example.invalid')
  })

  it('is idempotent: the same administrator is reported as already established and nothing changes', async () => {
    await bootstrapFirstAdmin(db, input())
    const again = await bootstrapFirstAdmin(db, input())
    expect(again.result).toBe('ALREADY_ESTABLISHED')
    expect(await count('user_management.users')).toBe(1)
    expect(await count('user_management.organization_users')).toBe(1)
    expect(await count('public.audit_logs')).toBe(1)
  })

  it('serializes a concurrent race: exactly one execution creates the administrator', async () => {
    const results = await Promise.all([
      bootstrapFirstAdmin(db, input()),
      bootstrapFirstAdmin(db, input()),
    ])
    expect(results.map((r) => r.result).sort()).toEqual(['ALREADY_ESTABLISHED', 'CREATED'])
    expect(await count('user_management.users')).toBe(1)
    expect(await count('public.audit_logs')).toBe(1)
  })

  it('refuses a different identity once a first administrator was established', async () => {
    await bootstrapFirstAdmin(db, input())
    await expect(
      bootstrapFirstAdmin(db, input({ userId: 'someone-else', email: 'else@example.invalid' })),
    ).rejects.toMatchObject({ code: 'BOOTSTRAP_BY_ANOTHER_IDENTITY' })
    expect(await count('user_management.users')).toBe(1)
    expect(await count('public.audit_logs')).toBe(1)
  })

  it('refuses a database that already has an administrator without a bootstrap marker', async () => {
    const org = randomUUID()
    await fixture.seed.query(
      `INSERT INTO public.organizations (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
       VALUES ($1::uuid,'Existing','existing-org','local',ARRAY[]::text[],0,ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now())`,
      [org],
    )
    await fixture.seed.query(
      "INSERT INTO user_management.users (user_id,email,is_active,lifecycle_state) VALUES ('existing-admin','a@example.invalid',true,'active')",
    )
    await fixture.seed.query(
      "INSERT INTO user_management.organization_users (user_id,organization_id,role,is_primary,is_active,joined_at) VALUES ('existing-admin',$1::uuid,'admin',true,true,now())",
      [org],
    )
    await expect(bootstrapFirstAdmin(db, input())).rejects.toMatchObject({
      code: 'ADMIN_ALREADY_EXISTS',
    })
    expect(await count('user_management.users')).toBe(1)
    expect(await count('public.audit_logs')).toBe(0)
  })

  it('refuses a database that already has a platform administrator', async () => {
    await fixture.seed.query(
      "INSERT INTO user_management.users (user_id,email,is_active,lifecycle_state,is_system_admin) VALUES ('existing-platform','p@example.invalid',true,'active',true)",
    )
    await expect(bootstrapFirstAdmin(db, input())).rejects.toMatchObject({
      code: 'ADMIN_ALREADY_EXISTS',
    })
    expect(await count('public.organizations')).toBe(0)
  })

  it('requires the organization to exist unless a name and slug are provided', async () => {
    await expect(
      bootstrapFirstAdmin(db, input({ organizationName: undefined, organizationSlug: undefined })),
    ).rejects.toMatchObject({ code: 'ORGANIZATION_NOT_FOUND' })
    expect(await count('user_management.users')).toBe(0)
  })

  it('is atomic: a failure after the organization insert leaves nothing behind', async () => {
    // A pre-existing non-admin row with the same user_id makes the user insert fail after the
    // organization has been inserted in the same transaction.
    await fixture.seed.query(
      "INSERT INTO user_management.users (user_id,email,is_active,lifecycle_state) VALUES ('ue-first-admin','dup@example.invalid',true,'active')",
    )
    await expect(bootstrapFirstAdmin(db, input())).rejects.toThrow()
    expect(await count('public.organizations')).toBe(0)
    expect(await count('user_management.organization_users')).toBe(0)
    expect(await count('user_management.mfa_totp')).toBe(0)
    expect(await count('public.audit_logs')).toBe(0)
    expect(await count('user_management.users')).toBe(1)
  })

  it('writes no row when the input is invalid', async () => {
    await expect(bootstrapFirstAdmin(db, input({ password: 'weak' }))).rejects.toBeInstanceOf(
      FirstAdminError,
    )
    expect(await count('user_management.users')).toBe(0)
  })
})
