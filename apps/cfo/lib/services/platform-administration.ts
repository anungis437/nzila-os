import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  assertCfoContextPermission,
  CfoScopeError,
  isCfoOrganizationId,
  type CfoActionContext,
} from '@/lib/resolve-org'
import { cfoRows } from '@/queries/action-context'
export interface Firm {
  id: string
  name: string
  status: 'active' | 'suspended' | 'trial'
  subscriptionTier: 'starter' | 'professional' | 'enterprise'
  userCount: number
  clientCount: number
  createdAt: Date
}
export interface PlatformMetrics {
  totalFirms: number
  activeFirms: number
  totalUsers: number
  totalClients: number
  mrr: number
  trialCount: number
}
const prices: Record<Firm['subscriptionTier'], number> = {
  starter: 199,
  professional: 499,
  enterprise: 999,
}
function privileged(context: CfoActionContext) {
  assertCfoContextPermission(context, 'platform_admin:manage')
  if (context.purpose !== 'platform') throw new CfoScopeError()
}
export async function platformFirms(context: CfoActionContext): Promise<Firm[]> {
  privileged(context)
  return cfoRows<Firm>(
    await context.db.execute(
      sql`SELECT id,metadata->>'name' AS name,metadata->>'status' AS status,metadata->>'subscriptionTier' AS "subscriptionTier",COALESCE((metadata->>'userCount')::int,0) AS "userCount",COALESCE((metadata->>'clientCount')::int,0) AS "clientCount",created_at AS "createdAt" FROM public.audit_log WHERE action='firm.registered' ORDER BY created_at DESC`,
    ),
  )
}
export async function platformMetrics(context: CfoActionContext): Promise<PlatformMetrics> {
  const firms = await platformFirms(context),
    [users] = cfoRows<{ total: string | number }>(
      await context.db.execute(sql`SELECT count(DISTINCT actor_id) AS total FROM public.audit_log`),
    ),
    [clients] = cfoRows<{ total: string | number }>(
      await context.db.execute(
        sql`SELECT count(*) AS total FROM public.audit_log WHERE action='org.created' AND entity_type='client'`,
      ),
    )
  const active = firms.filter((f) => f.status === 'active')
  return {
    totalFirms: firms.length,
    activeFirms: active.length,
    totalUsers: Number(users?.total ?? 0),
    totalClients: Number(clients?.total ?? 0),
    mrr: active.reduce((n, f) => n + (prices[f.subscriptionTier] ?? 0), 0),
    trialCount: firms.filter((f) => f.status === 'trial').length,
  }
}
export async function changeFirm(
  context: CfoActionContext,
  id: string,
  change: { status: 'active' | 'suspended' } | { subscriptionTier: Firm['subscriptionTier'] },
) {
  privileged(context)
  if (!isCfoOrganizationId(id)) throw new CfoScopeError()
  const patch = z
    .union([
      z.object({ status: z.enum(['active', 'suspended']) }).strict(),
      z.object({ subscriptionTier: z.enum(['starter', 'professional', 'enterprise']) }).strict(),
    ])
    .parse(change)
  const [parent] = cfoRows<{ id: string }>(
    await context.db.execute(
      sql`SELECT id FROM public.audit_log WHERE id=${id} AND action='firm.registered' FOR UPDATE`,
    ),
  )
  if (!parent) return { success: false }
  const [updated] = cfoRows<{ id: string }>(
    await context.db.execute(
      sql`UPDATE public.audit_log SET metadata=metadata||${JSON.stringify(patch)}::jsonb WHERE id=${parent.id} AND action='firm.registered' RETURNING id`,
    ),
  )
  if (!updated) throw new CfoScopeError()
  const action =
    'status' in patch
      ? patch.status === 'suspended'
        ? 'firm.suspended'
        : 'firm.reactivated'
      : 'firm.subscription.updated'
  // Global administration has no fabricated organization. The original firm ID
  // is an explicit resource field, and the state/receipt share this transaction.
  const [receipt] = cfoRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES(${action},${context.userId},'firm',NULL,${JSON.stringify({ firmId: parent.id, ...patch, authoritySource: 'cfo.platform-permissions', permission: 'platform_admin:manage' })}::jsonb) RETURNING id`,
    ),
  )
  if (!receipt) throw new Error('Firm audit was not stored')
  return { success: true }
}
