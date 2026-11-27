/** Coupled app write/primary audit only. Existing canonical-v1 hash/key on the
 * caller's actual platform transaction; no whole-ledger concurrency claim. */
import { sql, eq, desc } from 'drizzle-orm'
import { auditEvents } from '@nzila/db/schema'
import {
  buildCanonicalPayload,
  computeCanonicalHash,
  CANONICAL_HASH_VERSION,
} from '@nzila/db/audit-hash'
import { assertZongaContext, type OrganizationActionContext } from '@/lib/resolve-org'
import { zongaRows } from '@/queries/action-context'
export async function appendZongaAudit(
  context: OrganizationActionContext,
  event: {
    action: string
    targetType: string
    targetId: string
    afterJson: Record<string, unknown>
  },
) {
  assertZongaContext(context)
  await context.db.execute(
    sql`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(${`audit_events:${context.orgId}`}))`,
  )
  const [visibility] = zongaRows<{ filtered: boolean }>(
    await context.db.execute(
      sql`SELECT pg_catalog.row_security_active('public.audit_events'::regclass) AS filtered`,
    ),
  )
  if (visibility?.filtered !== false) throw new Error('Primary audit source is unavailable')
  const [head] = await context.db
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.orgId, context.orgId))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(1)
  const [clock] = zongaRows<{ captured: Date | string }>(
      await context.db.execute(sql`SELECT pg_catalog.clock_timestamp() AS captured`),
    ),
    occurredAt = clock?.captured instanceof Date ? clock.captured : new Date(clock?.captured ?? '')
  if (!Number.isFinite(occurredAt.getTime())) throw new Error('Primary audit clock is unavailable')
  const afterJson = JSON.parse(JSON.stringify(event.afterJson)) as Record<string, unknown>,
    previousHash = head?.hash ?? null
  const hash = computeCanonicalHash(
    buildCanonicalPayload({
      action: event.action,
      actorClerkUserId: context.actorId,
      actorRole: context.role,
      afterJson,
      hashTimestamp: occurredAt.toISOString(),
      orgId: context.orgId,
      targetId: event.targetId,
      targetType: event.targetType,
    }),
    previousHash,
  )
  const [row] = await context.db
    .insert(auditEvents)
    .values({
      orgId: context.orgId,
      actorClerkUserId: context.actorId,
      actorRole: context.role,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      afterJson,
      hash,
      previousHash,
      occurredAt,
      hashVersion: CANONICAL_HASH_VERSION,
      createdAt: sql`pg_catalog.clock_timestamp()`,
    })
    .returning({ id: auditEvents.id })
  if (!row) throw new Error('Mandatory primary audit was not stored')
  return row
}
