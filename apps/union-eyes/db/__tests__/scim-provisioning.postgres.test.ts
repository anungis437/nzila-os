/**
 * F03-C on real PostgreSQL: SCIM provisioning by a session-less machine caller (app/api/scim/v2/[organizationId]/Users/route.ts).
 *
 * DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID-AND-ACTIVATES-WITHOUT-ACCEPTANCE.
 * An identity provider authenticates with the organization's bearer token and has no session, so the tenant connection cannot serve it, and the
 * system role holds no INSERT on organization_members (and must not be widened to insert members into any organization). The people it provisions
 * are therefore rows of their own directory, public.scim_provisioned_users (platform 0059, cache 0051). The unmodified routes run here as
 * union_eyes_system, with the real token authentication, the real statements of lib/scim/provisioned-members.ts, the real event log and the real
 * canonical audit chain, and show that:
 *   - there is no other way in: the system role cannot insert a roster member, a session-less tenant context refuses, the tenant role reads nothing
 *     of the directory or the event log, the system role can neither delete a directory row nor change an event, and no SECURITY DEFINER function
 *     is executable by a business role (the catalog admission contract refuses one);
 *   - a provisioned person is a PENDING directory entry, never a roster row, whatever the request says, and the identity provider's externalId is kept;
 *   - a person is never created twice (sequentially and under concurrent requests), and one externalId identifies one live person, which the
 *     partial unique indexes enforce even without the application lock;
 *   - a removed person named again is provisioned again as pending and not refused as an existing user;
 *   - a configuration may only act for its own organization, and only while it is live: the statements refuse the others even when the route is skipped;
 *   - the list shows only the organization's own live people, one page at a time; a roster member with an account is unreachable from SCIM;
 *   - a deprovision is the organization's own configured action (suspend, archive or delete) as a state change that removes no row, and each effective
 *     change leaves an audit record (field names, never values) and one event-log row without any request or response body.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
vi.hoisted(() => {
  process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
})
const state = vi.hoisted(() => ({ pool: null as unknown, schema: null as unknown }))

type Executor = { execute: (query: unknown) => Promise<{ rows: Record<string, unknown>[] }> }

async function asRole<T>(role: string, organizationId: string | null, work: (tx: unknown) => Promise<T>): Promise<T> {
  const client = await (state.pool as pg.Pool).connect()
  try {
    return await drizzle(client, { schema: state.schema as never }).transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
      await tx.execute(sql`SELECT set_config('app.current_user_id', '', true), set_config('app.current_org_id', ${organizationId ?? ''}, true)`)
      return work(tx)
    })
  } finally {
    client.release()
  }
}
const asSystem = <T,>(work: (tx: unknown) => Promise<T>) => asRole('union_eyes_system', null, work)

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (work: (tx: unknown) => Promise<unknown>) => asSystem(work),
  // A machine caller has no session: the real tenant context throws for it, so it is not available to these routes.
  withRLSContext: () => { throw new Error('Unauthorized: No authenticated user found. User must be logged in via platform auth.') },
}))
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: async () => ({ allowed: true, resetIn: 60 }) }))
vi.mock('@/lib/api/framework', () => ({
  // The framework runs the route's declared machine credential before its handler and hands the verified caller to it.
  withApi: (config: { auth: { machine: (request: NextRequest, params: Record<string, string>) => Promise<unknown> } }, handler: (ctx: unknown) => Promise<unknown>) =>
    async (request: NextRequest, ctx: { params: Record<string, string> }) => handler({ params: ctx.params, request, machine: await config.auth.machine(request, ctx.params) }),
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    notFound: (message: string) => Object.assign(new Error(message), { status: 404 }),
    conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
    unauthorized: (message: string) => Object.assign(new Error(message), { status: 401 }),
    forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
    rateLimited: () => Object.assign(new Error('rate limited'), { status: 429 }),
    externalService: (_service: string, message: string) => Object.assign(new Error(message), { status: 502 }),
  },
}))

const route = URL ? await import('@/app/api/scim/v2/[organizationId]/Users/route') : null
const itemRoute = URL ? await import('@/app/api/scim/v2/[organizationId]/Users/[id]/route') : null
const configRoute = URL ? await import('@/app/api/scim/v2/[organizationId]/ServiceProviderConfig/route') : null
const tokens = URL ? await import('@/lib/scim/scim-token') : null
const directory = URL ? await import('@/lib/scim/provisioned-members') : null

const codeOf = (error: unknown): unknown => (error as { code?: unknown; cause?: { code?: unknown } })?.code ?? (error as { cause?: { code?: unknown } })?.cause?.code
const isNotLive = (error: unknown) => (error as { name?: unknown })?.name === 'ScimConfigurationNotLiveError'

describe.skipIf(!URL)('SCIM provisioning on the combined schema, as a session-less caller on the system role', () => {
  const sfx = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  let admin: pg.Client
  let pool: pg.Pool
  let tokenA: string
  let tokenB: string
  let configA: string
  let configB: string

  const insertOrganization = (org: string, slug: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [org, slug, slug],
    )
  const insertConfiguration = async (org: string, token: string) =>
    (await admin.query(
      `INSERT INTO scim_configurations (id, organization_id, base_url, token_hash, token_expires_at, enabled, sync_users, sync_groups, deprovision_action, user_attribute_mapping, created_by, created_at, updated_at)
       VALUES (gen_random_uuid(), $1::uuid, 'https://scim.example.test/' || $1::text, $2::text, now() + interval '30 days', true, true, true, 'suspend', '{}'::jsonb, 'native-test', now(), now()) RETURNING id::text AS id`,
      [org, tokens!.hashScimToken(token)],
    )).rows[0].id as string

  const request = (org: string, token: string, body: unknown, method = 'POST', query = '', path = 'Users') =>
    new NextRequest(`http://localhost/api/scim/v2/${org}/${path}${query}`, {
      method,
      headers: { authorization: ['Bearer', token].join(' '), 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      ...(body !== undefined && method !== 'GET' && method !== 'DELETE' ? { body: JSON.stringify(body) } : {}),
    })
  // The routes answer SCIM messages. A refusal is unwrapped into a rejection carrying its status, so the assertions read as they always did.
  const unwrap = async (response: Response): Promise<Record<string, any>> => {
    if (response.status === 204) return {}
    const body = (await response.json()) as Record<string, any>
    if (response.status >= 400) throw Object.assign(new Error(String(body.detail ?? 'refused')), { status: response.status, scimType: body.scimType })
    return body
  }
  const post = (org: string, token: string, body: unknown, pathOrg = org) => route!.POST(request(org, token, body), { params: { organizationId: pathOrg } } as never).then(unwrap)
  const list = (org: string, token: string, query = '') => route!.GET(request(org, token, undefined, 'GET', query), { params: { organizationId: org } } as never).then(unwrap)
  const item = (method: 'GET' | 'PATCH' | 'PUT' | 'DELETE', org: string, token: string, id: string, body?: unknown, pathOrg = org) =>
    itemRoute![method](request(org, token, body, method, '', `Users/${id}`), { params: { organizationId: pathOrg, id } } as never).then(unwrap)
  const PATCH_OP = 'urn:ietf:params:scim:api:messages:2.0:PatchOp'
  const patchUser = (org: string, token: string, id: string, ...Operations: unknown[]) => item('PATCH', org, token, id, { schemas: [PATCH_OP], Operations })
  const audits = async (org: string, id: string) => (await admin.query(`SELECT action, details FROM public.audit_logs WHERE organization_id = $1 AND resource_id = $2 AND action LIKE 'scim.%' ORDER BY created_at, id`, [org, id])).rows
  const events = async (id: string) => (await admin.query(`SELECT event_type, operation, status_code FROM scim_events_log WHERE resource_id = $1 ORDER BY created_at, id`, [id])).rows.map((row) => `${row.event_type} ${row.operation} ${row.status_code}`)
  const COLUMNS = `id::text AS id, user_name, user_name_key, external_id, display_name AS name, email, status, deleted_at, deprovisioned_at, deprovisioned_action, deprovisioned_by, deprovisioned_via, reactivated_at`
  const memberRow = async (id: string) => (await admin.query(`SELECT ${COLUMNS} FROM scim_provisioned_users WHERE id = $1`, [id])).rows[0]
  const setDeprovisionAction = (cfg: string, action: string) => admin.query(`UPDATE scim_configurations SET deprovision_action = $2 WHERE id = $1`, [cfg, action])
  const members = async (org: string) => (await admin.query(`SELECT ${COLUMNS} FROM scim_provisioned_users WHERE organization_id = $1 ORDER BY created_at, id`, [org])).rows
  const rosterCount = async (org: string) => (await admin.query(`SELECT count(*)::int AS n FROM organization_members WHERE organization_id = $1`, [org])).rows[0].n as number
  const ref = (configurationId: string, organizationId: string) => ({ configurationId, organizationId })
  const systemRows = (query: ReturnType<typeof sql>) => asSystem(async (tx) => (await (tx as Executor).execute(query)).rows)
  const runtimeRows = (query: ReturnType<typeof sql>) => asRole('union_eyes_runtime', ORG_A, async (tx) => (await (tx as Executor).execute(query)).rows)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 10 })
    state.pool = pool
    state.schema = await import('@/db/schema')
    await insertOrganization(ORG_A, `scim-a-${sfx}`)
    await insertOrganization(ORG_B, `scim-b-${sfx}`)
    tokenA = tokens!.generateScimToken()
    tokenB = tokens!.generateScimToken()
    configA = await insertConfiguration(ORG_A, tokenA)
    configB = await insertConfiguration(ORG_B, tokenB)
  }, 120_000)

  afterAll(async () => {
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('has no other way in: no roster insert, no session-less tenant context, no tenant read, no directory delete, no event change and no definer function', async () => {
    await expect(systemRows(sql`INSERT INTO organization_members (id, organization_id, user_id, name, email, role, status, is_primary, created_at, updated_at) VALUES (gen_random_uuid(), ${ORG_A}::uuid, 'x', 'x', 'x', 'member', 'active', false, now(), now())`)).rejects.toSatisfy((error) => codeOf(error) === '42501')
    const { withRLSContext } = await import('@/lib/db/with-rls-context')
    expect(() => withRLSContext({ organizationId: ORG_A }, async () => 1)).toThrow('No authenticated user')
    // The tenant role has no privilege on either relation, so an organization's own session cannot read or forge the stream's directory or log.
    await expect(runtimeRows(sql`SELECT id FROM scim_provisioned_users`)).rejects.toSatisfy((error) => codeOf(error) === '42501')
    await expect(runtimeRows(sql`SELECT id FROM scim_events_log`)).rejects.toSatisfy((error) => codeOf(error) === '42501')
    await expect(runtimeRows(sql`INSERT INTO scim_provisioned_users (organization_id, config_id, user_name, user_name_key) VALUES (${ORG_A}::uuid, ${configA}::uuid, 'forged@example.test', 'forged@example.test')`)).rejects.toSatisfy((error) => codeOf(error) === '42501')
    // The system role can read and write the directory, and it cannot remove a row or change or remove an event.
    await expect(systemRows(sql`DELETE FROM scim_provisioned_users WHERE organization_id = ${ORG_A}::uuid`)).rejects.toSatisfy((error) => codeOf(error) === '42501')
    await expect(systemRows(sql`UPDATE scim_events_log SET status = 'error'`)).rejects.toSatisfy((error) => codeOf(error) === '42501')
    await expect(systemRows(sql`DELETE FROM scim_events_log`)).rejects.toSatisfy((error) => codeOf(error) === '42501')
    const definers = (await admin.query(
      `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prosecdef AND n.nspname = 'public'
          AND (has_function_privilege('union_eyes_runtime', p.oid, 'EXECUTE') OR has_function_privilege('union_eyes_system', p.oid, 'EXECUTE') OR has_function_privilege('public', p.oid, 'EXECUTE'))`,
    )).rows
    expect(definers).toEqual([])
    expect((await admin.query(`SELECT proname FROM pg_proc WHERE proname LIKE 'ue\\_scim\\_%'`)).rows).toEqual([])
  })

  it('keeps the directory honest at the database: one live person per userName and per externalId, a closed status vocabulary, and a deprovision that says who made it', async () => {
    const org = randomUUID()
    await insertOrganization(org, `scim-c-${sfx}`)
    const cfg = await insertConfiguration(org, tokens!.generateScimToken())
    const insert = (name: string, key: string, extra = '', values = '') =>
      admin.query(`INSERT INTO scim_provisioned_users (organization_id, config_id, user_name, user_name_key${extra}) VALUES ($1, $2, $3, $4${values})`, [org, cfg, name, key])
    await insert('A@x.test', 'a@x.test')
    await expect(insert('a@X.test', 'a@x.test')).rejects.toMatchObject({ code: '23505' })
    await expect(insert('B@x.test', 'wrong-key')).rejects.toMatchObject({ code: '23514' })
    await insert('E1@x.test', 'e1@x.test', ', external_id', ", 'ext-1'")
    await expect(insert('E2@x.test', 'e2@x.test', ', external_id', ", 'ext-1'")).rejects.toMatchObject({ code: '23505' })
    await expect(insert('S@x.test', 's@x.test', ', status', ", 'active'")).rejects.toMatchObject({ code: '23514' })
    await expect(insert('S@x.test', 's@x.test', ', status', ", 'suspended'")).rejects.toMatchObject({ code: '23514' })
    await expect(insert('S@x.test', 's@x.test', ', deprovisioned_by', ", 'somebody'")).rejects.toMatchObject({ code: '23514' })
    // A removed person frees the userName and the externalId for a new one.
    await admin.query(`UPDATE scim_provisioned_users SET deleted_at = now() WHERE organization_id = $1 AND user_name_key = 'a@x.test'`, [org])
    await insert('A@x.test', 'a@x.test')
    expect((await admin.query(`SELECT count(*)::int AS n FROM scim_provisioned_users WHERE organization_id = $1 AND user_name_key = 'a@x.test'`, [org])).rows[0].n).toBe(2)
  })

  it('provisions a pending directory entry, not a roster member, and keeps the identity provider\'s externalId', async () => {
    const result = await post(ORG_A, tokenA, { userName: 'Jane.Doe@Example.test', externalId: 'idp-subject-1', name: { givenName: 'Jane', familyName: 'Doe' }, emails: [{ value: 'jane.doe@example.test', primary: true }] })
    expect(result).toMatchObject({ userName: 'Jane.Doe@Example.test', externalId: 'idp-subject-1', active: false, name: { formatted: 'Jane Doe' } })
    const rows = await members(ORG_A)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ user_name: 'Jane.Doe@Example.test', user_name_key: 'jane.doe@example.test', external_id: 'idp-subject-1', status: 'pending', deleted_at: null, name: 'Jane Doe', email: 'jane.doe@example.test' })
    expect(rows[0].id).toBe(result.id)
    // Naming a person grants nothing: nobody joined the roster.
    expect(await rosterCount(ORG_A)).toBe(0)
    const audit = (await admin.query(`SELECT action, resource_type, resource_id FROM public.audit_logs WHERE organization_id = $1 AND action LIKE 'scim.%' ORDER BY created_at`, [ORG_A])).rows
    expect(audit).toEqual([{ action: 'scim.user.provision', resource_type: 'scim_provisioned_users', resource_id: result.id }])
    // One event-log row, in the same transaction, with the protocol facts and no body.
    const logged = (await admin.query(`SELECT * FROM scim_events_log WHERE organization_id = $1`, [ORG_A])).rows
    expect(logged).toHaveLength(1)
    expect(logged[0]).toMatchObject({
      config_id: configA, event_type: 'user.created', resource_type: 'User', resource_id: result.id, operation: 'POST',
      request_path: `/api/scim/v2/${ORG_A}/Users`, status: 'success', status_code: 201, authenticated_as: `scim:${configA}`, ip_address: '203.0.113.9',
      request_body: null, response_body: null,
    })
    expect(logged[0].processing_time_ms).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(logged[0])).not.toMatch(/Jane|jane\.doe/)
  })

  it('never creates a person twice, sequentially or under concurrent requests, and one externalId identifies one live person', async () => {
    await expect(post(ORG_A, tokenA, { userName: 'JANE.DOE@example.test' })).rejects.toMatchObject({ status: 409 })
    await expect(post(ORG_A, tokenA, { userName: 'someone.else@example.test', externalId: 'idp-subject-1' })).rejects.toMatchObject({ status: 409 })
    expect(await members(ORG_A)).toHaveLength(1)

    const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => post(ORG_A, tokenA, { userName: 'Racer@Example.test', externalId: 'idp-racer' })))
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((o) => o.status === 'rejected' && (o.reason as { status?: number }).status === 409)).toHaveLength(5)
    expect((await members(ORG_A)).filter((row) => row.user_name_key === 'racer@example.test')).toHaveLength(1)

    // Two different people racing for one externalId: exactly one wins, the other is told it is taken (not a constraint error).
    const external = await Promise.allSettled(['x1@example.test', 'x2@example.test'].map((userName) => post(ORG_A, tokenA, { userName, externalId: 'idp-contested' })))
    expect(external.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
    expect(external.filter((o) => o.status === 'rejected' && (o.reason as { status?: number }).status === 409)).toHaveLength(1)
    // A refusal is not an event: only the changes that happened are logged.
    expect((await admin.query(`SELECT count(*)::int AS n FROM scim_events_log WHERE organization_id = $1`, [ORG_A])).rows[0].n).toBe(3)
  })

  it('stores a hostile userName as inert text and refuses a malformed request before it reaches the database', async () => {
    const hostile = "x'; DELETE FROM scim_provisioned_users; --"
    const created = await post(ORG_A, tokenA, { userName: hostile })
    expect(created.userName).toBe(hostile)
    expect((await members(ORG_A)).some((row) => row.user_name_key === hostile.toLowerCase())).toBe(true)
    await expect(post(ORG_A, tokenA, { userName: 'x'.repeat(321) })).rejects.toMatchObject({ status: 400 })
    await expect(post(ORG_A, tokenA, { userName: 'a', externalId: 'e'.repeat(256) })).rejects.toMatchObject({ status: 400 })
  })

  it('provisions a removed person again as pending, and does not refuse it as an existing user', async () => {
    const before = (await members(ORG_A)).find((row) => row.user_name_key === 'jane.doe@example.test')!
    await admin.query(`UPDATE scim_provisioned_users SET deleted_at = now(), status = 'revoked', deprovisioned_at = now(), deprovisioned_by = 'scim', deprovisioned_action = 'delete' WHERE id = $1`, [before.id])
    const again = await post(ORG_A, tokenA, { userName: 'jane.doe@example.test', externalId: 'idp-subject-1', emails: [{ value: 'jane.new@example.test' }] })
    expect(again).toMatchObject({ id: before.id, active: false, emails: [{ value: 'jane.new@example.test' }] })
    const after = (await members(ORG_A)).find((row) => row.id === before.id)!
    expect(after).toMatchObject({ status: 'pending', deleted_at: null, deprovisioned_at: null, deprovisioned_by: null, email: 'jane.new@example.test' })
    expect((await admin.query(`SELECT action FROM public.audit_logs WHERE organization_id = $1 AND resource_id = $2 ORDER BY created_at`, [ORG_A, before.id])).rows.map((row) => row.action)).toEqual(['scim.user.provision', 'scim.user.reprovision'])
    expect(await events(before.id)).toEqual(['user.created POST 201', 'user.created POST 201'])
  })

  it('lets a configuration act only for its own organization, whatever the path or the call names', async () => {
    await expect(post(ORG_A, tokenA, { userName: 'a@example.test' }, ORG_B)).rejects.toMatchObject({ status: 404 })
    await expect(post(ORG_B, tokenA, { userName: 'a@example.test' }, ORG_B)).rejects.toMatchObject({ status: 404 })
    const before = (await members(ORG_B)).length
    // The route is skipped: the statements themselves refuse another organization's configuration.
    const attempt = (cfg: string, org: string) => asSystem((tx) => directory!.provisionScimMember(tx as never, ref(cfg, org), { userName: 'intruder@example.test' }))
    await expect(attempt(configA, ORG_B)).rejects.toSatisfy(isNotLive)
    await expect(attempt(configB, ORG_A)).rejects.toSatisfy(isNotLive)
    await expect(asSystem((tx) => directory!.listScimMembers(tx as never, ref(configA, ORG_B), { startIndex: 1, count: 10 }))).rejects.toSatisfy(isNotLive)
    expect((await members(ORG_B)).length).toBe(before)
    expect((await members(ORG_B)).some((row) => row.user_name_key.includes('intruder'))).toBe(false)
  })

  it('refuses a configuration that is revoked, expired, disabled or has user sync switched off, at the database', async () => {
    const variants: Array<[string, string]> = [
      ['revoked', 'revoked_at = now()'],
      ['expired', "token_expires_at = now() - interval '1 minute'"],
      ['disabled', 'enabled = false'],
      ['user sync switched off', 'sync_users = false'],
    ]
    for (const [label, set] of variants) {
      // An organization has one SCIM configuration, so each variant has its own.
      const org = randomUUID()
      await insertOrganization(org, `scim-v-${sfx}-${label.replace(/\W+/g, '')}`)
      const cfg = await insertConfiguration(org, tokens!.generateScimToken())
      await admin.query(`UPDATE scim_configurations SET ${set} WHERE id = $1`, [cfg])
      await expect(asSystem((tx) => directory!.provisionScimMember(tx as never, ref(cfg, org), { userName: 'late@example.test' })), label).rejects.toSatisfy(isNotLive)
      expect(await members(org), label).toEqual([])
      if (label === 'user sync switched off') {
        // Switching user sync off stops provisioning, not the read side, which has its own, weaker requirement.
        await expect(asSystem((tx) => directory!.listScimMembers(tx as never, ref(cfg, org), { startIndex: 1, count: 10 }))).resolves.toMatchObject({ total: 0 })
      } else {
        await expect(asSystem((tx) => directory!.listScimMembers(tx as never, ref(cfg, org), { startIndex: 1, count: 10 })), label).rejects.toSatisfy(isNotLive)
      }
    }
  })

  it("lists only the organization's own live people, one page at a time, with the live total", async () => {
    await post(ORG_B, tokenB, { userName: 'only.in.b@example.test' })
    const all = await list(ORG_A, tokenA)
    const own = (await members(ORG_A)).filter((row) => row.deleted_at === null)
    expect(all.totalResults).toBe(own.length)
    expect(all.Resources.map((resource: { id: string }) => resource.id).sort()).toEqual(own.map((row) => row.id).sort())
    expect(all.Resources.every((resource: { userName: string }) => !resource.userName.includes('only.in.b'))).toBe(true)

    const first = await list(ORG_A, tokenA, '?startIndex=1&count=2')
    const second = await list(ORG_A, tokenA, '?startIndex=3&count=2')
    expect(first.itemsPerPage).toBe(2)
    expect(first.totalResults).toBe(own.length)
    expect([...first.Resources, ...second.Resources].map((resource: { id: string }) => resource.id)).toEqual(own.slice(0, first.Resources.length + second.Resources.length).map((row) => row.id))
    expect((await list(ORG_A, tokenA, '?count=0'))).toMatchObject({ totalResults: own.length, itemsPerPage: 0, Resources: [] })
    // A removed person is not listed.
    const removed = own[0]
    await admin.query(`UPDATE scim_provisioned_users SET deleted_at = now() WHERE id = $1`, [removed.id])
    const afterRemoval = await list(ORG_A, tokenA)
    expect(afterRemoval.totalResults).toBe(own.length - 1)
    expect(afterRemoval.Resources.some((resource: { id: string }) => resource.id === removed.id)).toBe(false)
  })

  describe('the lifecycle of a provisioned person', () => {
    const provisionPerson = async (userName: string, externalId?: string) => (await post(ORG_A, tokenA, { userName, ...(externalId ? { externalId } : {}), name: { givenName: 'Dev', familyName: 'Person' } })) as { id: string }

    it('lists, finds and reads only the people the stream provisioned, never a roster member who has an account', async () => {
      const real = randomUUID()
      await admin.query(
        `INSERT INTO organization_members (id, organization_id, user_id, name, email, role, status, is_primary, created_at, updated_at, metadata)
         VALUES ($1, $2, $3, 'Real Person', 'real.person@example.test', 'steward', 'active', false, now(), now(), '{}'::jsonb)`,
        [real, ORG_A, `user_native_${sfx}`],
      )
      const everyone = await list(ORG_A, tokenA)
      expect(everyone.Resources.some((resource: { id: string }) => resource.id === real)).toBe(false)
      expect((await list(ORG_A, tokenA, '?filter=' + encodeURIComponent('userName eq "real.person@example.test"'))).totalResults).toBe(0)
      await expect(item('GET', ORG_A, tokenA, real)).rejects.toMatchObject({ status: 404 })
      await expect(patchUser(ORG_A, tokenA, real, { op: 'replace', path: 'active', value: false })).rejects.toMatchObject({ status: 404 })
      await expect(item('DELETE', ORG_A, tokenA, real)).rejects.toMatchObject({ status: 404 })
      // Whatever the identity provider sends, the person with an account is exactly as they were: the roster is a different table.
      expect((await admin.query(`SELECT status, role, deleted_at, name FROM organization_members WHERE id = $1`, [real])).rows[0]).toMatchObject({ status: 'active', role: 'steward', deleted_at: null, name: 'Real Person' })
      // And the statements refuse it even when the route is skipped.
      const direct = await asSystem((tx) => directory!.deprovisionScimMember(tx as never, ref(configA, ORG_A), real, 'patch'))
      expect(direct).toMatchObject({ outcome: 'not_found', member: null })
      expect((await admin.query(`SELECT status, deleted_at FROM organization_members WHERE id = $1`, [real])).rows[0]).toMatchObject({ status: 'active', deleted_at: null })
    })

    it('finds a person by userName or externalId, reads one person, and refuses a filter it does not understand', async () => {
      const person = await provisionPerson('Finder@Example.test', 'idp-finder-1')
      const byName = await list(ORG_A, tokenA, '?filter=' + encodeURIComponent('userName eq "FINDER@example.test"'))
      expect(byName).toMatchObject({ totalResults: 1, startIndex: 1, itemsPerPage: 1, Resources: [{ id: person.id, userName: 'Finder@Example.test', externalId: 'idp-finder-1' }] })
      expect((await list(ORG_A, tokenA, '?filter=' + encodeURIComponent('externalId eq "idp-finder-1"'))).Resources[0].id).toBe(person.id)
      expect((await list(ORG_A, tokenA, '?filter=' + encodeURIComponent('externalId eq "nobody"'))).totalResults).toBe(0)
      await expect(list(ORG_A, tokenA, '?filter=' + encodeURIComponent('userName co "Find"'))).rejects.toMatchObject({ status: 400, scimType: 'invalidFilter' })
      expect(await item('GET', ORG_A, tokenA, person.id)).toMatchObject({ id: person.id, userName: 'Finder@Example.test', active: false, meta: { resourceType: 'User' } })
      // Another organization's person is not found through this organization's token, by id or by filter.
      const other = (await post(ORG_B, tokenB, { userName: 'finder@example.test' })) as { id: string }
      await expect(item('GET', ORG_A, tokenA, other.id)).rejects.toMatchObject({ status: 404 })
      expect((await list(ORG_B, tokenB, '?filter=' + encodeURIComponent('userName eq "finder@example.test"'))).Resources[0].id).toBe(other.id)
    })

    it('deprovisions by the organization\u2019s own configured action: suspend, archive or delete, and never removes a row', async () => {
      const rowsBefore = (await members(ORG_A)).length
      // suspend (the configured default), asked the way Entra asks
      await setDeprovisionAction(configA, 'suspend')
      const person = await provisionPerson('suspend.me@example.test', 'idp-suspend')
      const suspended = await patchUser(ORG_A, tokenA, person.id, { op: 'Replace', path: 'active', value: 'False' })
      expect(suspended).toMatchObject({ id: person.id, active: false })
      expect(await memberRow(person.id)).toMatchObject({ status: 'suspended', deleted_at: null, deprovisioned_action: 'suspend', deprovisioned_by: 'scim', deprovisioned_via: 'patch' })
      expect((await memberRow(person.id)).deprovisioned_at).not.toBeNull()
      // asking again changes nothing and is not audited or logged again
      await patchUser(ORG_A, tokenA, person.id, { op: 'replace', value: { active: false } })
      expect((await audits(ORG_A, person.id)).map((row) => row.action)).toEqual(['scim.user.provision', 'scim.user.deprovision'])
      expect((await audits(ORG_A, person.id))[1].details).toMatchObject({ action: 'suspend', from: 'pending', via: 'patch' })

      // restoring it undoes only what this stream did
      await patchUser(ORG_A, tokenA, person.id, { op: 'replace', path: 'active', value: true })
      const restored = await memberRow(person.id)
      expect(restored).toMatchObject({ status: 'pending', deleted_at: null, deprovisioned_at: null, deprovisioned_action: null, deprovisioned_by: null, deprovisioned_via: null })
      expect(restored.reactivated_at).not.toBeNull()
      expect((await audits(ORG_A, person.id)).map((row) => row.action)).toEqual(['scim.user.provision', 'scim.user.deprovision', 'scim.user.reactivate'])

      // archive
      await setDeprovisionAction(configA, 'archive')
      expect(await item('DELETE', ORG_A, tokenA, person.id)).toEqual({})
      expect(await memberRow(person.id)).toMatchObject({ status: 'inactive', deleted_at: null, deprovisioned_action: 'archive', deprovisioned_via: 'delete', reactivated_at: null })
      expect(await events(person.id)).toEqual(['user.created POST 201', 'user.deleted PATCH 200', 'user.updated PATCH 200', 'user.deleted DELETE 204'])

      // delete: the entry is soft-deleted and revoked, it leaves the listing, and the same userName can be provisioned again
      await setDeprovisionAction(configA, 'delete')
      const doomed = await provisionPerson('delete.me@example.test', 'idp-delete')
      await item('DELETE', ORG_A, tokenA, doomed.id)
      expect(await memberRow(doomed.id)).toMatchObject({ status: 'revoked', deprovisioned_action: 'delete' })
      expect((await memberRow(doomed.id)).deleted_at).not.toBeNull()
      await expect(item('GET', ORG_A, tokenA, doomed.id)).rejects.toMatchObject({ status: 404 })
      await expect(patchUser(ORG_A, tokenA, doomed.id, { op: 'replace', path: 'active', value: true })).rejects.toMatchObject({ status: 404 })
      expect((await list(ORG_A, tokenA)).Resources.some((resource: { id: string }) => resource.id === doomed.id)).toBe(false)
      const again = await post(ORG_A, tokenA, { userName: 'delete.me@example.test', externalId: 'idp-delete' })
      expect(again).toMatchObject({ id: doomed.id, active: false })
      expect(await memberRow(doomed.id)).toMatchObject({ status: 'pending', deleted_at: null, deprovisioned_at: null })

      // The database owns the vocabulary: no other value can be stored, so no other action can be asked for.
      await expect(setDeprovisionAction(configA, 'obliterate')).rejects.toMatchObject({ code: '23514' })

      await setDeprovisionAction(configA, 'suspend')
      // no row was removed by any of it: only people were added
      expect((await members(ORG_A)).length).toBe(rowsBefore + 2)
      // and the roster never changed
      expect(await rosterCount(ORG_A)).toBe(1)
    })

    it('restores nothing that the organization itself suspended, and writes, audits and logs nothing when it refuses', async () => {
      const person = await provisionPerson('held.by.org@example.test')
      await admin.query(`UPDATE scim_provisioned_users SET status = 'suspended', deprovisioned_at = now(), deprovisioned_by = 'organization' WHERE id = $1`, [person.id])
      await expect(patchUser(ORG_A, tokenA, person.id, { op: 'replace', path: 'active', value: true })).rejects.toMatchObject({ status: 409 })
      expect(await memberRow(person.id)).toMatchObject({ status: 'suspended', deprovisioned_by: 'organization' })
      expect((await audits(ORG_A, person.id)).map((row) => row.action)).toEqual(['scim.user.provision'])
      // and a deprovision of a person already not live is left as it is
      await patchUser(ORG_A, tokenA, person.id, { op: 'replace', path: 'active', value: false })
      expect(await memberRow(person.id)).toMatchObject({ status: 'suspended', deprovisioned_by: 'organization' })
      expect((await audits(ORG_A, person.id)).map((row) => row.action)).toEqual(['scim.user.provision'])
      expect(await events(person.id)).toEqual(['user.created POST 201'])
    })

    it('updates the identity provider\u2019s attributes, keeps one live person per externalId and per userName, and audits fields not values', async () => {
      const first = await provisionPerson('attrs.one@example.test', 'idp-attrs-1')
      const second = await provisionPerson('attrs.two@example.test', 'idp-attrs-2')
      const changed = await patchUser(
        ORG_A, tokenA, first.id,
        { op: 'replace', path: 'name.givenName', value: 'Janet' },
        { op: 'replace', path: 'emails[type eq "work"].value', value: 'janet.attrs@example.test' },
        { op: 'replace', path: 'externalId', value: 'idp-attrs-1b' },
      )
      expect(changed).toMatchObject({ id: first.id, name: { formatted: 'Janet Person' }, emails: [{ value: 'janet.attrs@example.test' }], externalId: 'idp-attrs-1b' })
      expect(await memberRow(first.id)).toMatchObject({ name: 'Janet Person', email: 'janet.attrs@example.test', status: 'pending', external_id: 'idp-attrs-1b' })
      const audit = (await audits(ORG_A, first.id)).find((row) => row.action === 'scim.user.update')!
      expect(audit.details).toMatchObject({ fields: ['name', 'email', 'externalId'], via: 'patch' })
      expect(JSON.stringify(audit)).not.toContain('Janet')
      // an update that changes nothing is not audited or logged
      const updatesBefore = (await audits(ORG_A, first.id)).length
      const eventsBefore = (await events(first.id)).length
      await patchUser(ORG_A, tokenA, first.id, { op: 'replace', path: 'name.givenName', value: 'Janet' })
      expect((await audits(ORG_A, first.id)).length).toBe(updatesBefore)
      expect((await events(first.id)).length).toBe(eventsBefore)
      // one externalId identifies one live person; a userName is the person's key and cannot be changed
      await expect(patchUser(ORG_A, tokenA, second.id, { op: 'replace', path: 'externalId', value: 'idp-attrs-1b' })).rejects.toMatchObject({ status: 409, scimType: 'uniqueness' })
      await expect(patchUser(ORG_A, tokenA, first.id, { op: 'replace', path: 'userName', value: 'renamed@example.test' })).rejects.toMatchObject({ status: 400, scimType: 'mutability' })
      expect((await memberRow(first.id)).user_name_key).toBe('attrs.one@example.test')
      // PUT states attributes, and an externalId removed by PATCH is gone
      expect(await item('PUT', ORG_A, tokenA, second.id, { userName: 'ATTRS.TWO@example.test', displayName: 'Second Person' })).toMatchObject({ name: { formatted: 'Second Person' }, externalId: 'idp-attrs-2' })
      await patchUser(ORG_A, tokenA, second.id, { op: 'remove', path: 'externalId' })
      expect((await item('GET', ORG_A, tokenA, second.id)).externalId).toBeUndefined()
    })

    it('deprovisions once under concurrent requests, with one audit record and one event', async () => {
      const person = await provisionPerson('racing.leaver@example.test')
      const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => patchUser(ORG_A, tokenA, person.id, { op: 'replace', path: 'active', value: false })))
      expect(outcomes.flatMap((outcome) => (outcome.status === 'rejected' ? [String((outcome.reason as Error).message)] : []))).toEqual([])
      expect(await memberRow(person.id)).toMatchObject({ status: 'suspended' })
      expect((await audits(ORG_A, person.id)).filter((row) => row.action === 'scim.user.deprovision')).toHaveLength(1)
      expect(await events(person.id)).toEqual(['user.created POST 201', 'user.deleted PATCH 200'])
    })

    it('lets a configuration act on its own organization\u2019s people only, and only while it is live with user sync on, at the database', async () => {
      const other = (await post(ORG_B, tokenB, { userName: 'b.only@example.test' })) as { id: string }
      // the route: the token decides the organization, whatever the path says
      await expect(item('GET', ORG_A, tokenA, other.id, undefined, ORG_B)).rejects.toMatchObject({ status: 404 })
      await expect(item('DELETE', ORG_A, tokenA, other.id)).rejects.toMatchObject({ status: 404 })
      expect(await memberRow(other.id)).toMatchObject({ status: 'pending', deleted_at: null })
      // the database, with the route skipped: another organization's configuration reaches nothing of this organization's directory
      for (const attempt of [
        () => asSystem((tx) => directory!.deprovisionScimMember(tx as never, ref(configA, ORG_B), other.id, 'patch')),
        () => asSystem((tx) => directory!.updateScimMember(tx as never, ref(configA, ORG_B), other.id, { name: 'x' })),
        () => asSystem((tx) => directory!.getScimMember(tx as never, ref(configA, ORG_B), other.id)),
        () => asSystem((tx) => directory!.findScimMembers(tx as never, ref(configA, ORG_B), { attribute: 'userName', value: 'b.only@example.test' })),
      ]) await expect(attempt()).rejects.toSatisfy(isNotLive)
      // and a configuration that names the right organization still cannot reach a person of another one
      expect(await asSystem((tx) => directory!.getScimMember(tx as never, ref(configA, ORG_A), other.id))).toBeNull()
      // the organization's own person, with user sync off: nothing can be changed, and reading is still allowed
      const org = randomUUID()
      await insertOrganization(org, `scim-sync-${sfx}`)
      const token = tokens!.generateScimToken()
      const cfg = await insertConfiguration(org, token)
      const own = (await post(org, token, { userName: 'sync.off@example.test' })) as { id: string }
      await admin.query(`UPDATE scim_configurations SET sync_users = false WHERE id = $1`, [cfg])
      await expect(asSystem((tx) => directory!.deprovisionScimMember(tx as never, ref(cfg, org), own.id, 'patch'))).rejects.toSatisfy(isNotLive)
      await expect(asSystem((tx) => directory!.updateScimMember(tx as never, ref(cfg, org), own.id, { name: 'x' }))).rejects.toSatisfy(isNotLive)
      expect(await asSystem((tx) => directory!.getScimMember(tx as never, ref(cfg, org), own.id))).toMatchObject({ id: own.id, status: 'pending' })
      expect(await memberRow(own.id)).toMatchObject({ status: 'pending', name: null })
    })

    it('describes what it supports, to the caller that holds the token', async () => {
      const response = await configRoute!.GET(request(ORG_A, tokenA, undefined, 'GET', '', 'ServiceProviderConfig'), { params: { organizationId: ORG_A } } as never)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ patch: { supported: true }, filter: { supported: true, maxResults: 100 }, bulk: { supported: false } })
    })
  })
})
