/** Real source actions/RBAC/context/audit on selected current SQL declarations.
 * Verified identity and database connection are I/O ports, not permission mocks. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCfoSourceDatabase } from './fixtures/cfo-source-database'
import { buildCanonicalPayload, computeCanonicalHash } from '@nzila/db/audit-hash'
const port = vi.hoisted(() => ({
  db: null as unknown,
  actor: 'sender',
  role: 'viewer',
  firmRole: 'firm_owner',
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: async () => ({
    userId: port.actor,
    orgId: null,
    sessionClaims: { publicMetadata: { nzilaRole: port.role, firmRole: port.firmRole } },
  }),
  currentUser: async () => ({
    id: port.actor,
    primaryEmailAddress: { emailAddress: 'component@example.invalid' },
  }),
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: new Proxy(
    {},
    {
      get(_target, key) {
        if (!port.db) throw new Error('Owned source database required')
        const value = Reflect.get(port.db as object, key)
        return typeof value === 'function' ? value.bind(port.db) : value
      },
    },
  ),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import {
  createNotification,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../notification-actions'
import { resolveOrgContext } from '@/lib/resolve-org'
import { appendCfoPrimaryAudit } from '@/lib/services/cfo-records'
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222'
let fixture: Awaited<ReturnType<typeof createCfoSourceDatabase>>
const query = <T>(sql: string, values: unknown[] = []) => fixture.db.query<T>(sql, values)
const owner = (sql: string, values: unknown[] = []) => fixture.operator(sql, values)
const input = {
  type: 'system' as const,
  title: 'Private title',
  message: 'Private payload',
  recipientId: 'recipient',
  organizationId: a,
}
const create = async () => {
  expect(await createNotification(input)).toEqual({ success: true })
  const row = (
    await query<{ id: string }>(
      "SELECT id FROM public.audit_log WHERE action='notification.created' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0]
  return row.id
}
beforeAll(async () => {
  fixture = await createCfoSourceDatabase()
  port.db = fixture.database
})
afterAll(async () => {
  await fixture?.close()
})
beforeEach(async () => {
  port.actor = 'sender'
  port.role = 'viewer'
  port.firmRole = 'firm_owner'
  await owner('DROP TRIGGER IF EXISTS cfo_primary_failure ON public.audit_events')
  await owner('DROP FUNCTION IF EXISTS public.cfo_primary_failure()')
  await owner('ALTER TABLE public.audit_events DISABLE ROW LEVEL SECURITY')
  await owner(
    'TRUNCATE public.audit_events,public.audit_log,public.org_members,public.orgs CASCADE',
  )
  await owner(
    "INSERT INTO public.orgs(id,legal_name,jurisdiction,policy_config) VALUES($1,'Own','CA-ON','{}'),($2,'Foreign','CA-QC','{}')",
    [a, b],
  )
  await owner(
    "INSERT INTO public.org_members(org_id,user_id,role,status) VALUES($1,'sender','org_admin','active'),($1,'recipient','org_viewer','active'),($1,'colleague','org_admin','active'),($2,'foreign','org_admin','active')",
    [a, b],
  )
  fixture.statements.length = 0
})
describe('CFO notification source ownership and atomic origin (SQL-engine component)', () => {
  it('stores a real tenant root and canonical primary audit in one transaction and returns only safe recipient projection', async () => {
    const id = await create()
    const rows = (await query<Record<string, unknown>>('SELECT * FROM public.audit_events')).rows
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row).toMatchObject({
      org_id: a,
      actor_user_id: 'sender',
      action: 'cfo.resource.origin.v1',
      target_type: 'cfo.audit_log.root',
      target_id: id,
      hash_version: 'canonical-v1',
    })
    const data = row.after_json as Record<string, unknown>
    expect(data).toMatchObject({
      application: 'cfo',
      operation: 'notification.created',
      rootRecordId: id,
      organizationId: a,
      actorUserId: 'sender',
      bindings: { recipientId: 'recipient', parent: null },
      authoritySource: {
        kind: 'membership',
        source: 'org_members',
        actorUserId: 'sender',
        organizationId: a,
      },
    })
    expect(row.hash).toBe(
      computeCanonicalHash(
        buildCanonicalPayload({
          action: row.action as string,
          actorClerkUserId: row.actor_user_id as string,
          actorRole: null,
          afterJson: data,
          hashTimestamp: new Date(row.occurred_at as string).toISOString(),
          orgId: a,
          targetId: id,
          targetType: 'cfo.audit_log.root',
        }),
        null,
      ),
    )
    port.actor = 'recipient'
    const result = await listNotifications()
    expect(result).toMatchObject({
      unreadCount: 1,
      notifications: [{ id, title: input.title, message: input.message, read: false }],
    })
    expect(Object.keys(result.notifications[0]).sort()).toEqual(
      ['id', 'type', 'title', 'message', 'priority', 'read', 'actionUrl', 'createdAt'].sort(),
    )
    expect(JSON.stringify(result)).not.toContain('authoritySource')
    expect(JSON.stringify(result)).not.toContain('_cfoOrigin')
  })
  it('denies other same-org recipients and platform administrators before private payload or receipt writes', async () => {
    const id = await create()
    for (const [actor, role] of [
      ['colleague', 'viewer'],
      ['sender', 'platform_admin'],
      ['foreign', 'platform_admin'],
    ]) {
      port.actor = actor
      port.role = role
      fixture.statements.length = 0
      expect((await listNotifications()).notifications).toEqual([])
      await expect(markNotificationRead(id)).rejects.toMatchObject({ status: 403 })
      await expect(deleteNotification(id)).rejects.toMatchObject({ status: 403 })
      expect(fixture.statements.some((s) => s.startsWith('insert '))).toBe(false)
      expect(fixture.statements.some((s) => s.startsWith('select "metadata" from'))).toBe(false)
    }
  })
  it('requires the current recipient membership even when a historical origin is genuine', async () => {
    const id = await create()
    port.actor = 'recipient'
    expect(await getUnreadCount()).toBe(1)
    await owner("UPDATE public.org_members SET status='removed' WHERE user_id='recipient'")
    expect((await listNotifications()).notifications).toEqual([])
    await expect(markNotificationRead(id)).rejects.toMatchObject({ status: 403 })
  })
  it('rejects unknown ownership metadata, absent recipients and foreign target members without writes', async () => {
    for (const data of [
      { ...input, recipientId: undefined },
      { ...input, orgId: b },
      { ...input, _cfoOrigin: 'cfo.record-origin.v1' },
    ]) {
      expect(await createNotification(data)).toEqual({ success: false })
    }
    await expect(createNotification({ ...input, recipientId: 'foreign' })).rejects.toMatchObject({
      status: 403,
    })
    expect((await query('SELECT id FROM public.audit_log')).rows).toEqual([])
    expect((await query('SELECT id FROM public.audit_events')).rows).toEqual([])
  })
  it('does not convert an old caller-forged marker into organization authority', async () => {
    const row = (
      await owner(
        "INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('notification.created','colleague','notification',$1,$2::jsonb) RETURNING id",
        [
          a,
          JSON.stringify({
            ...input,
            _cfoOrigin: 'cfo.record-origin.v1',
            scopeVersion: 1,
            authoritySource: { kind: 'membership' },
          }),
        ],
      )
    ).rows[0] as { id: string }
    port.actor = 'recipient'
    expect((await listNotifications()).notifications).toEqual([])
    await expect(markNotificationRead(row.id)).rejects.toMatchObject({ status: 403 })
  })
  it('refuses root/org/actor/recipient substitutions and event replay while preserving originals', async () => {
    const id = await create()
    const clone = (
      await owner(
        'INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata,created_at) SELECT action,actor_id,entity_type,org_id,metadata,created_at FROM public.audit_log WHERE id=$1 RETURNING id',
        [id],
      )
    ).rows[0] as { id: string }
    port.actor = 'recipient'
    await expect(markNotificationRead(clone.id)).rejects.toMatchObject({ status: 403 })
    for (const mutation of [
      'org_id=$2',
      "actor_id='colleague'",
      "metadata=jsonb_set(metadata,'{recipientId}','\"colleague\"')",
    ]) {
      await owner(
        `UPDATE public.audit_log SET ${mutation} WHERE id=$1`,
        mutation.includes('$2') ? [id, b] : [id],
      )
      await expect(markNotificationRead(id)).rejects.toMatchObject({ status: 403 })
      await owner(
        "UPDATE public.audit_log SET org_id=$2,actor_id='sender',metadata=jsonb_set(metadata,'{recipientId}','\"recipient\"') WHERE id=$1",
        [id, a],
      )
    }
    expect(await markNotificationRead(id)).toEqual({ success: true })
    expect(
      (await query("SELECT id FROM public.audit_events WHERE action='cfo.resource.origin.v1'"))
        .rows,
    ).toHaveLength(1)
  })
  it('keeps unqualified historical records private and preserves old labels without adopting tenant scope', async () => {
    const first = (
      await owner(
        "INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('notification.created','sender','notification',$1,$2::jsonb) RETURNING id",
        [b, JSON.stringify({ ...input, recipientId: 'recipient', _oldPrivate: true })],
      )
    ).rows[0] as { id: string }
    await owner(
      'INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES(\'notification.created\',\'sender\',\'notification\',NULL,\'{"title":"Old sender note","message":"Own"}\')',
    )
    port.actor = 'recipient'
    expect((await listNotifications()).notifications.map((n) => n.id)).toEqual([first.id])
    expect(await markNotificationRead(first.id)).toEqual({ success: true })
    expect(
      (await query("SELECT org_id,metadata FROM public.audit_log WHERE action='notification.read'"))
        .rows,
    ).toMatchObject([
      { org_id: null, metadata: { notificationId: first.id, recipientId: 'recipient' } },
    ])
    port.actor = 'colleague'
    expect((await listNotifications()).notifications).toEqual([])
    expect(
      (await query('SELECT org_id FROM public.audit_log WHERE id=$1', [first.id])).rows,
    ).toEqual([{ org_id: b }])
  })
  it('couples read/read-all/delete receipts to real resource IDs and tenant audit, never fake org labels', async () => {
    const id = await create()
    port.actor = 'recipient'
    expect(await markAllNotificationsRead()).toEqual({ success: true })
    expect(await getUnreadCount()).toBe(0)
    expect(await deleteNotification(id)).toEqual({ success: true })
    expect((await listNotifications()).notifications).toEqual([])
    const receipts = (
      await query<{ org_id: string | null; action: string; metadata: unknown }>(
        "SELECT org_id,action,metadata FROM public.audit_log WHERE action<>'notification.created' ORDER BY created_at,id",
      )
    ).rows
    expect(receipts).toHaveLength(2)
    expect(receipts.find((r) => r.action === 'notification.read_all')).toMatchObject({
      org_id: null,
      metadata: { notificationIds: [id] },
    })
    expect(receipts.find((r) => r.action === 'notification.deleted')).toMatchObject({
      org_id: a,
      metadata: { notificationId: id },
    })
    expect(
      (await query("SELECT org_id FROM public.audit_events WHERE action<>'cfo.resource.origin.v1'"))
        .rows,
    ).toEqual([{ org_id: a }, { org_id: a }])
  })
  it('rolls both initial root and later receipt back on an actual mandatory primary audit outage', async () => {
    const id = await create()
    await owner(
      "CREATE FUNCTION public.cfo_primary_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic primary outage'; END$$",
    )
    await owner(
      'CREATE TRIGGER cfo_primary_failure BEFORE INSERT ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.cfo_primary_failure()',
    )
    expect(await createNotification(input)).toEqual({ success: false })
    port.actor = 'recipient'
    expect(await markNotificationRead(id)).toEqual({ success: false })
    expect((await query('SELECT id FROM public.audit_log')).rows).toHaveLength(1)
    expect((await query('SELECT id FROM public.audit_events')).rows).toHaveLength(1)
    expect(await getUnreadCount()).toBe(1)
  })
  it('fails closed on filtered origin facts and rejects attempts to mint reserved identity through generic emitters', async () => {
    const id = await create()
    port.actor = 'recipient'
    await expect(
      resolveOrgContext('resource', { permission: 'notifications:view' }, (ctx) =>
        appendCfoPrimaryAudit(ctx, {
          organizationId: a,
          action: 'cfo.resource.origin.v1',
          targetType: 'arbitrary',
          targetId: id,
          afterJson: {},
        }),
      ),
    ).rejects.toMatchObject({ status: 403 })
    await owner('ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY')
    await expect(listNotifications()).rejects.toMatchObject({ status: 403 })
    await expect(markNotificationRead(id)).rejects.toMatchObject({ status: 403 })
  })
})
