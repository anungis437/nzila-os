import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCfoSourceDatabase } from './fixtures/cfo-source-database'
const port = vi.hoisted(() => ({
  db: null as unknown,
  actor: 'cfo-member',
  role: 'viewer',
  firmRole: 'staff_accountant',
  profileActor: 'cfo-member',
  authCalls: 0,
  changeActorDuringRoles: false,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: async () => {
    port.authCalls++
    return {
      userId: port.changeActorDuringRoles && port.authCalls === 2 ? 'different-actor' : port.actor,
      orgId: null,
      sessionClaims: { publicMetadata: { nzilaRole: port.role, firmRole: port.firmRole } },
    }
  },
  currentUser: async () => ({
    id: port.profileActor,
    primaryEmailAddress: { emailAddress: 'unprivileged-component@example.invalid' },
  }),
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: new Proxy(
    {},
    {
      get(_target, key) {
        if (!port.db) throw new Error('Owned SQL-engine fixture required')
        const value = Reflect.get(port.db as object, key)
        return typeof value === 'function' ? value.bind(port.db) : value
      },
    },
  ),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { listClients, getClientDetail, createClient } from '../client-actions'
import {
  assertCfoActionContext,
  resolveOrgContext,
  withCfoPlatformPurpose,
  type CfoActionContext,
} from '@/lib/resolve-org'

const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222'
let statements: string[] = []
let db: PGlite
let fixture: Awaited<ReturnType<typeof createCfoSourceDatabase>>
const operator = (sql: string, params: unknown[] = []) => fixture.operator(sql, params)
beforeAll(async () => {
  fixture = await createCfoSourceDatabase()
  db = fixture.db
  port.db = fixture.database
  statements = fixture.statements
})
afterAll(async () => {
  await fixture?.close()
})
beforeEach(async () => {
  port.actor = 'cfo-member'
  port.role = 'viewer'
  port.firmRole = 'staff_accountant'
  port.profileActor = port.actor
  port.authCalls = 0
  port.changeActorDuringRoles = false
  await operator('DROP TRIGGER IF EXISTS cfo_audit_failure ON public.audit_log')
  await operator('DROP TRIGGER IF EXISTS cfo_audit_failure ON public.audit_events')
  await operator('DROP FUNCTION IF EXISTS public.cfo_audit_failure()')
  await operator(
    'TRUNCATE public.audit_events,public.audit_log,public.org_members,public.orgs CASCADE',
  )
  await operator(
    "INSERT INTO public.orgs(id,legal_name,jurisdiction,policy_config) VALUES($1,'Own client','CA-ON','{}'),($2,'FOREIGN_SECRET','CA-QC','{}')",
    [a, b],
  )
  await operator(
    "INSERT INTO public.org_members(org_id,user_id,role,status) VALUES($1,'cfo-member','org_viewer','active'),($2,'other-member','org_admin','active')",
    [a, b],
  )
  statements.length = 0
})
describe('CFO actual client scope on selected source declarations (SQL-engine component)', () => {
  it('runs business SQL as a restricted role and lists only actual assigned organizations', async () => {
    expect(
      (await db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user'))
        .rows,
    ).toEqual([{ rolsuper: false, rolbypassrls: false }])
    expect(await listClients()).toMatchObject({
      clients: [{ id: a, name: 'Own client', memberCount: 1 }],
      total: 1,
    })
    expect(await getClientDetail(a)).toMatchObject({ id: a, financialSummary: { totalRevenue: 0 } })
  })
  it('denies a foreign client before business disclosure even with a strong firm metadata role', async () => {
    port.firmRole = 'firm_owner'
    await expect(getClientDetail(b)).rejects.toMatchObject({ status: 403 })
    expect(
      statements.every((query) => !query.includes('audit_log') && !query.includes('policy_config')),
    ).toBe(true)
  })
  it('preserves collection access to multiple real memberships instead of choosing an arbitrary first one', async () => {
    await operator(
      "INSERT INTO public.org_members(org_id,user_id,role,status) VALUES($1,'cfo-member','org_viewer','active')",
      [b],
    )
    expect((await listClients()).clients.map((row) => row.id).sort()).toEqual([a, b])
    await expect(
      resolveOrgContext(
        'organization',
        { permission: 'clients:view' },
        async (context) => context.organizationId,
      ),
    ).rejects.toThrow('Select a verified organization')
  })
  it('rereads a revoked membership rather than reusing a prior verdict', async () => {
    await listClients()
    await operator("UPDATE public.org_members SET status='removed' WHERE user_id='cfo-member'")
    await expect(listClients()).rejects.toMatchObject({ status: 403 })
  })
  it('does not let default or privileged firm metadata create a global organization', async () => {
    port.firmRole = 'firm_owner'
    await expect(createClient({ name: 'Unauthorized global client' })).rejects.toMatchObject({
      status: 403,
    })
    expect(statements).toEqual([])
    expect((await db.query('SELECT count(*)::int AS n FROM public.orgs')).rows).toEqual([{ n: 2 }])
  })
  it('preserves the real platform administrator global view and audited client creation', async () => {
    port.role = 'platform_admin'
    expect((await listClients()).total).toBe(2)
    const result = await createClient({ name: 'Authorized client' })
    expect(result).toMatchObject({ ok: true, id: expect.any(String) })
    expect((await db.query('SELECT actor_id,org_id,metadata FROM public.audit_log')).rows).toEqual([
      expect.objectContaining({
        actor_id: port.actor,
        org_id: result.id,
        metadata: expect.objectContaining({ clientId: result.id, authority: 'platform' }),
      }),
    ])
  })
  it('rolls client creation back on a real mandatory audit failure', async () => {
    port.role = 'platform_admin'
    await operator(
      "CREATE FUNCTION public.cfo_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit outage'; END $$",
    )
    await operator(
      'CREATE TRIGGER cfo_audit_failure BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.cfo_audit_failure()',
    )
    expect(await createClient({ name: 'Must roll back' })).toMatchObject({ ok: false })
    expect((await db.query('SELECT count(*)::int AS n FROM public.orgs')).rows).toEqual([{ n: 2 }])
  })
  it('refuses contradictory actor/profile reads before SQL', async () => {
    port.changeActorDuringRoles = true
    await expect(listClients()).rejects.toMatchObject({ status: 403 })
    expect(statements).toEqual([])
    port.changeActorDuringRoles = false
    port.authCalls = 0
    port.profileActor = 'different-profile'
    await expect(listClients()).rejects.toMatchObject({ status: 403 })
    expect(statements).toEqual([])
  })
  it('expires the actual resolved context and its database access after the callback', async () => {
    let saved: CfoActionContext | undefined
    await resolveOrgContext('collection', { permission: 'clients:view' }, async (context) => {
      saved = context
      assertCfoActionContext(context)
      expect(JSON.stringify(context)).not.toContain('db')
    })
    expect(() => assertCfoActionContext(saved!)).toThrow('Forbidden')
    expect(() => saved!.db).toThrow('Forbidden')
  })
  it('keeps the actual API route scoped and maps authority denial to403 before SQL effects', async () => {
    const api = await import('@/app/api/clients/route')
    const own = await api.GET(new Request('http://localhost/api/clients'))
    expect(own.status).toBe(200)
    expect(JSON.stringify(await own.json())).not.toContain('FOREIGN_SECRET')
    statements.length = 0
    port.firmRole = 'firm_owner'
    const denied = await api.POST(
      new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'No global grant' }),
      }),
    )
    expect(denied.status).toBe(403)
    expect(statements).toEqual([])
  })
  it('preserves actual API field aliases for a permitted platform creation', async () => {
    port.role = 'platform_admin'
    const { POST } = await import('@/app/api/clients/route')
    const response = await POST(
      new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'API client',
          email: 'client@example.invalid',
          businessNumber: 'INC-123',
        }),
      }),
    )
    expect(response.status).toBe(201)
    expect(
      (
        await db.query(
          "SELECT incorporation_number,policy_config->>'contactEmail' AS email FROM public.orgs WHERE legal_name='API client'",
        )
      ).rows,
    ).toEqual([{ incorporation_number: 'INC-123', email: 'client@example.invalid' }])
  })
  it('rejects caller ownership/organization substitutions at the actual API input before writes', async () => {
    port.role = 'platform_admin'
    const { POST } = await import('@/app/api/clients/route')
    const response = await POST(
      new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Forged', orgId: b, actorId: 'other-member' }),
      }),
    )
    expect(response.status).toBe(400)
    expect(statements).toEqual([])
  })
  it('requires actual platform client-create privilege for CSV before any database effect', async () => {
    const { importClientsFromCsv } = await import('../import-actions')
    await expect(
      importClientsFromCsv('name,email\nUnsafe,unsafe@example.invalid'),
    ).rejects.toMatchObject({ status: 403 })
    expect(statements).toEqual([])
  })
  it('preserves partial CSV import with per-row organization/write/primary-audit rollback and truthful counts', async () => {
    port.role = 'platform_admin'
    await operator(
      "CREATE FUNCTION public.cfo_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM orgs WHERE id=NEW.org_id AND legal_name='Fail audit') THEN RAISE EXCEPTION 'synthetic row primary outage'; END IF; RETURN NEW; END $$",
    )
    await operator(
      'CREATE TRIGGER cfo_audit_failure BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.cfo_audit_failure()',
    )
    const { importClientsFromCsv } = await import('../import-actions')
    expect(
      await importClientsFromCsv(
        'name,email\nFail audit,fail@example.invalid\nGood row,good@example.invalid\nInvalid email,bad-email',
      ),
    ).toMatchObject({ ok: true, imported: 1, skipped: 2, errors: expect.any(Array) })
    expect(
      (
        await db.query(
          "SELECT legal_name,policy_config FROM orgs WHERE legal_name IN('Fail audit','Good row','Invalid email')",
        )
      ).rows,
    ).toMatchObject([
      {
        legal_name: 'Good row',
        policy_config: { contactEmail: 'good@example.invalid', importedFrom: 'csv' },
      },
    ])
    expect((await db.query('SELECT actor_id,org_id FROM audit_log')).rows).toHaveLength(1)
    expect(
      (await db.query('SELECT actor_user_id,after_json FROM audit_events')).rows,
    ).toMatchObject([
      { actor_user_id: port.actor, after_json: { operation: 'importClientsFromCsv' } },
    ])
  })
  it('uses the same actual transaction for a freshly verified global subpurpose and expires it independently', async () => {
    port.role = 'platform_admin'
    let saved: CfoActionContext | undefined
    await resolveOrgContext(
      'organization',
      { permission: 'clients:view', organizationId: a },
      async (parent) => {
        await withCfoPlatformPurpose(parent, 'clients:create', async (child) => {
          saved = child
          expect(child.db).toBe(parent.db)
          expect(child.userId).toBe(parent.userId)
          expect(child.purpose).toBe('platform')
        })
        expect(() => saved!.db).toThrow('Forbidden')
        assertCfoActionContext(parent)
      },
    )
    port.role = 'viewer'
    await resolveOrgContext('resource', { permission: 'clients:view' }, async (parent) => {
      await expect(
        withCfoPlatformPurpose(parent, 'clients:create', async () => {
          throw new Error('must not reach global effects')
        }),
      ).rejects.toMatchObject({ status: 403 })
    })
  })
})
