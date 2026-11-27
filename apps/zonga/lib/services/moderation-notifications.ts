import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  assertZongaContext,
  ZongaScopeError,
  type OrganizationActionContext,
} from '@/lib/resolve-org'
import { zongaRows } from '@/queries/action-context'
import { appendZongaAudit } from './primary-audit'
export interface NotificationRequest {
  orgId: string
  userId: string
  type: string
  title: string
  body?: string
  link?: string
  caseId?: string
}
export async function notifyModerationResolution(
  context: OrganizationActionContext,
  caseId: string,
  expected?: NotificationRequest,
) {
  assertZongaContext(context)
  if (!['admin', 'manager'].includes(context.role)) throw new ZongaScopeError()
  const id = z.uuid().parse(caseId)
  const [parent] = zongaRows<{ id: string; entityType: string; entityId: string }>(
    await context.db.execute(
      sql`SELECT id,entity_type AS "entityType",entity_id AS "entityId" FROM public.zonga_moderation_cases WHERE id=${id}::uuid AND org_id=${context.orgId}::uuid AND status='resolved' FOR SHARE`,
    ),
  )
  if (!parent) throw new ZongaScopeError('Resolved moderation source is unavailable')
  const owners =
    parent.entityType === 'asset'
      ? zongaRows<{ userId: string }>(
          await context.db.execute(
            sql`SELECT c.user_id AS "userId" FROM public.zonga_content_assets a JOIN public.zonga_creators c ON c.id=a.creator_id WHERE a.id=${parent.entityId}::uuid AND a.org_id=${context.orgId}::uuid AND(c.org_id IS NULL OR c.org_id=a.org_id) FOR SHARE OF a,c`,
          ),
        )
      : parent.entityType === 'release'
        ? zongaRows<{ userId: string }>(
            await context.db.execute(
              sql`SELECT c.user_id AS "userId" FROM public.zonga_releases a JOIN public.zonga_creators c ON c.id=a.creator_id WHERE a.id=${parent.entityId}::uuid AND a.org_id=${context.orgId}::uuid AND(c.org_id IS NULL OR c.org_id=a.org_id) FOR SHARE OF a,c`,
            ),
          )
        : []
  const recipient = owners[0]?.userId
  if (
    !recipient ||
    recipient !== recipient.trim() ||
    recipient.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(recipient)
  )
    throw new ZongaScopeError('Canonical resource owner is unavailable')
  const value = {
    orgId: context.orgId,
    userId: recipient,
    type: 'moderation_resolved',
    title: 'Content review complete',
    body: `Your ${parent.entityType} has been reviewed and the case has been resolved.`,
    link: `/dashboard/catalog/${parent.entityId}`,
  }
  if (expected) {
    z.object({
      orgId: z.uuid(),
      userId: z.string(),
      type: z.string(),
      title: z.string(),
      body: z.string().optional(),
      link: z.string().optional(),
      caseId: z.uuid(),
    })
      .strict()
      .parse(expected)
    for (const key of ['orgId', 'userId', 'type', 'title', 'body', 'link'] as const)
      if (expected[key] !== value[key]) throw new ZongaScopeError()
  }
  await context.db.execute(
    sql`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(${`zonga.notification:case:${parent.id}`}))`,
  )
  const [existing] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`SELECT n.id FROM public.zonga_notifications n JOIN public.audit_log a ON a.action='zonga.notification.created' AND a.metadata->>'notificationId'=n.id::text WHERE a.org_id=${context.orgId}::uuid AND a.metadata->>'caseId'=${parent.id} AND n.org_id=${context.orgId}::uuid AND n.recipient_user_id=${recipient} AND n.user_id IS NULL AND n.type=${value.type} AND n.title=${value.title} AND n.body=${value.body} AND n.link=${value.link} LIMIT 1 FOR SHARE OF n,a`,
    ),
  )
  if (existing) return { success: true, notificationId: existing.id }
  const [created] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.zonga_notifications(org_id,recipient_user_id,user_id,type,title,body,link) VALUES(${context.orgId}::uuid,${recipient},NULL,${value.type},${value.title},${value.body},${value.link}) RETURNING id`,
    ),
  )
  if (!created) throw new Error('Canonical notification was not stored')
  const [trace] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('zonga.notification.created',${context.actorId},'zonga_notification',${context.orgId}::uuid,${JSON.stringify({ notificationId: created.id, caseId: parent.id, resourceId: parent.entityId, recipientUserId: recipient })}::jsonb) RETURNING id`,
    ),
  )
  if (!trace) throw new Error('Notification trace was not stored')
  await appendZongaAudit(context, {
    action: 'zonga.notification.created',
    targetType: 'zonga.notification',
    targetId: created.id,
    afterJson: {
      notificationId: created.id,
      caseId: parent.id,
      resourceId: parent.entityId,
      recipientUserId: recipient,
      traceId: trace.id,
    },
  })
  return { success: true, notificationId: created.id }
}
