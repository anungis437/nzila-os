import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import type { PartnerTier } from '../components/partner/TierBadge'

export interface PartnerBinding {
  id: string
  tier: PartnerTier
  companyName: string
}

/** postgres-js and the existing pg-backed fixtures expose different result envelopes. */
export function actionRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows))
    return result.rows as T[]
  throw new Error('Database result unavailable')
}

/** Fact reads grant no authority; the purpose resolver selects them only
 * after authenticated membership or the existing platform-role check. */
export async function readActorPartnerBindings(actorId: string, requestedPartnerId?: string): Promise<PartnerBinding[]> {
  return actionRows<PartnerBinding>(await platformDb.execute(sql`
    SELECT p.id,p.tier,p.company_name AS "companyName" FROM public.partners p
    WHERE p.status='active'
      AND ${requestedPartnerId ? sql`p.id::text=${requestedPartnerId}` : sql`true`}
      AND EXISTS(SELECT 1 FROM public.partner_users u WHERE u.partner_id=p.id AND u.user_id=${actorId})
    ORDER BY p.created_at,p.id`))
}

export async function readActivePartnerById(partnerId: string): Promise<PartnerBinding[]> {
  return actionRows<PartnerBinding>(await platformDb.execute(sql`
    SELECT p.id,p.tier,p.company_name AS "companyName" FROM public.partners p
    WHERE p.id::text=${partnerId} AND p.status='active'`))
}

/** Existing ml:summary entitlement, joined to an actual active organization.
 * A partner ID or an identity-provider group is never used as a tenant ID. */
export async function partnerEntityBinding(partnerId: string, requestedOrgId?: string): Promise<string> {
  const rows = actionRows<{ orgId: string }>(await platformDb.execute(sql`
    SELECT DISTINCT o.id AS "orgId" FROM public.partner_entities e
    JOIN public.partners p ON p.id=e.partner_id AND p.status='active'
    JOIN public.orgs o ON o.id::text=e.org_id AND o.status='active'
    WHERE e.partner_id::text=${partnerId}
      AND e.allowed_views @> '["ml:summary"]'::jsonb
      AND (e.expires_at IS NULL OR (pg_catalog.isfinite(e.expires_at) AND e.expires_at>pg_catalog.statement_timestamp()))
      AND ${requestedOrgId ? sql`o.id::text=${requestedOrgId}` : sql`true`}
    ORDER BY o.id`))
  if (rows.length !== 1) throw new Error('An unambiguous current ml:summary organization entitlement is required')
  return rows[0].orgId
}

export async function findPartnerEntityEntitlement(actorId: string, view: string, requestedOrgId?: string) {
  const rows = actionRows<{ partnerId: string; tier: PartnerTier; orgId: string }>(await platformDb.execute(sql`
    SELECT p.id AS "partnerId",p.tier,o.id AS "orgId" FROM public.partners p
    JOIN public.partner_users u ON u.partner_id=p.id AND u.user_id=${actorId}
    JOIN public.partner_entities e ON e.partner_id=p.id
    JOIN public.orgs o ON o.id::text=e.org_id AND o.status='active'
    WHERE p.status='active' AND e.allowed_views @> ${JSON.stringify([view])}::jsonb
      AND (e.expires_at IS NULL OR (pg_catalog.isfinite(e.expires_at) AND e.expires_at>pg_catalog.statement_timestamp()))
      AND ${requestedOrgId ? sql`o.id::text=${requestedOrgId}` : sql`true`}
    ORDER BY p.id,o.id LIMIT 1`))
  return rows[0] ?? null
}

