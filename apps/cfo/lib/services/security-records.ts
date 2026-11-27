import { sql } from 'drizzle-orm'
import {
  assertCfoContextPermission,
  CfoScopeError,
  isCfoOrganizationId,
  type CfoActionContext,
} from '@/lib/resolve-org'
import { cfoRows } from '@/queries/action-context'
import { legacyCfoAuditPredicate } from './cfo-records'
export async function changeLegacySecurityRecord(
  context: CfoActionContext,
  id: string,
  input:
    | { action: 'security.event'; patch: { resolved: true }; receipt: 'security.event.resolved' }
    | {
        action: 'security.incident'
        patch: { status: 'open' | 'investigating' | 'contained' | 'resolved' }
        receipt: 'security.incident.status_changed'
      },
) {
  assertCfoContextPermission(context, 'security:manage')
  if (!isCfoOrganizationId(id)) throw new CfoScopeError()
  const scope = legacyCfoAuditPredicate(context)
  const [parent] = cfoRows<{ id: string }>(
    await context.db.execute(
      sql`SELECT id FROM public.audit_log WHERE ${scope} AND id=${id} AND action=${input.action} FOR UPDATE`,
    ),
  )
  if (!parent) throw new CfoScopeError()
  const [updated] = cfoRows<{ id: string }>(
    await context.db.execute(
      sql`UPDATE public.audit_log SET metadata=metadata||${JSON.stringify(input.patch)}::jsonb WHERE ${scope} AND id=${parent.id} AND action=${input.action} RETURNING id`,
    ),
  )
  if (!updated) throw new CfoScopeError()
  const [receipt] = cfoRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES(${input.receipt},${context.userId},'security',NULL,${JSON.stringify({ securityRecordId: parent.id, ...input.patch, source: 'cfo.security-record.v1', authority: context.purpose === 'platform' ? 'platform' : 'personal' })}::jsonb) RETURNING id`,
    ),
  )
  if (!receipt) throw new Error('Security receipt was not stored')
  return { success: true }
}
