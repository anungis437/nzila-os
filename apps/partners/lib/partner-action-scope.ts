import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { actionRows, readActorPartnerBindings, readActivePartnerById } from '../queries/partner-action-facts'
import { assertPartnerActionContext, type EntityContext, type PartnerContext, type PlatformContext } from './resolve-org'

type ResourceContext = PartnerContext | PlatformContext | EntityContext
export const dealResourceId = sql`CASE WHEN origin.org_id IS NULL THEN origin.id::text ELSE origin.org_id::text END`

/** New roots use their actual event ID and a canonical partner reference.
 * Released roots used org_id as deal ID and actor ID as partnerId. That exact
 * legacy shape proves the original actor's ownership, not an enduring company
 * assignment. It never grants a new colleague access to that personal history. */
export function dealOwnership(context: ResourceContext) {
  assertPartnerActionContext(context)
  if (!['partner','platform','entity'].includes(context.scope)) throw new Error('An actual resource purpose is required')
  if (context.scope === 'platform') return sql`true`
  if (context.scope === 'entity' && context.platformContext) {
    assertPartnerActionContext(context.platformContext)
    if (context.platformContext.scope !== 'platform' || context.platformContext.actorId !== context.actorId)
      throw new Error('An actual matching platform purpose is required')
    return sql`((origin.org_id IS NULL AND origin.metadata->>'dealId'=origin.id::text AND origin.metadata->>'partnerId'=${context.partner.id})
      OR (origin.org_id IS NOT NULL AND origin.metadata->>'partnerId'=origin.actor_id
        AND EXISTS(SELECT 1 FROM public.partner_users u WHERE u.user_id=origin.actor_id AND u.partner_id::text=${context.partner.id})
        AND NOT EXISTS(SELECT 1 FROM public.partner_users other_member JOIN public.partners other_partner ON other_partner.id=other_member.partner_id
          WHERE other_member.user_id=origin.actor_id AND other_partner.status='active' AND other_partner.id::text<>${context.partner.id})))`
  }
  return sql`EXISTS(SELECT 1 FROM public.partners current_partner JOIN public.partner_users current_member ON current_member.partner_id=current_partner.id
      WHERE current_partner.id::text=${context.partner.id} AND current_partner.status='active' AND current_member.user_id=${context.actorId})
    AND ((origin.org_id IS NULL AND origin.metadata->>'dealId'=origin.id::text
      AND origin.metadata->>'partnerId'=${context.partner.id})
    OR (origin.org_id IS NOT NULL AND origin.metadata->>'partnerId'=origin.actor_id
      AND origin.actor_id=${context.actorId}))`
}

export function dealRootScope(context: ResourceContext) {
  return sql`origin.action='deal.registered' AND origin.entity_type='deal' AND (${dealOwnership(context)})
    AND NOT EXISTS(SELECT 1 FROM public.audit_log collision WHERE collision.action='deal.registered'
      AND collision.entity_type='deal' AND collision.id<>origin.id
      AND (CASE WHEN collision.org_id IS NULL THEN collision.id::text ELSE collision.org_id::text END)=${dealResourceId})`
}

export async function requireDealOrigin(context: ResourceContext, resourceId: string) {
  const rows = actionRows<{ id: string; actorId: string; legacy: boolean; metadata: Record<string, unknown> }>(await platformDb.execute(sql`
    SELECT ${dealResourceId} AS id,origin.actor_id AS "actorId",origin.org_id IS NOT NULL AS legacy,origin.metadata
    FROM public.audit_log origin WHERE ${dealRootScope(context)} AND ${dealResourceId}=${resourceId}
    ORDER BY origin.created_at,origin.id LIMIT 2`))
  if (rows.length !== 1) throw new Error('Deal not found')
  const row = rows[0]
  if (context.scope !== 'platform') return { ...row, partner: context.partner }
  const partners = row.legacy ? await readActorPartnerBindings(row.actorId)
    : await readActivePartnerById(String(row.metadata.partnerId ?? ''))
  if (partners.length !== 1) throw new Error('An unambiguous current deal partner is required')
  return { ...row, partner: partners[0] }
}

export function currentDealParent(context: ResourceContext, resourceId: string, partnerId: string) {
  return sql`EXISTS(SELECT 1 FROM public.audit_log origin WHERE ${dealRootScope(context)} AND ${dealResourceId}=${resourceId}
    AND EXISTS(SELECT 1 FROM public.partners p WHERE p.id::text=${partnerId} AND p.status='active')
    AND ((origin.org_id IS NULL AND origin.metadata->>'partnerId'=${partnerId})
      OR (origin.org_id IS NOT NULL AND origin.metadata->>'partnerId'=origin.actor_id
        AND EXISTS(SELECT 1 FROM public.partner_users u WHERE u.user_id=origin.actor_id AND u.partner_id::text=${partnerId})
        AND NOT EXISTS(SELECT 1 FROM public.partner_users other_member JOIN public.partners other_partner ON other_partner.id=other_member.partner_id
          WHERE other_member.user_id=origin.actor_id AND other_partner.status='active' AND other_partner.id::text<>${partnerId}))))`
}

export function commissionOwnership(context: ResourceContext) {
  assertPartnerActionContext(context)
  if (!['partner','platform','entity'].includes(context.scope)) throw new Error('An actual resource purpose is required')
  if (context.scope === 'platform') return sql`true`
  // Commission metadata alone is not proof of the underlying deal's owner.
  return sql`commission.metadata->>'partnerId'=${context.partner.id} AND EXISTS(
    SELECT 1 FROM public.audit_log origin WHERE ${dealRootScope(context)}
      AND ${dealResourceId}=commission.metadata->>'dealId')`
}

export function scopedDeals(context: ResourceContext) {
  return sql`SELECT ${dealResourceId} AS id,origin.metadata->>'accountName' AS "accountName",
    origin.metadata->>'contactName' AS "contactName",origin.metadata->>'contactEmail' AS "contactEmail",
    origin.metadata->>'vertical' AS vertical,(COALESCE(origin.metadata->>'estimatedArr','0'))::numeric AS "estimatedArr",
    origin.metadata->>'expectedCloseDate' AS "expectedCloseDate",origin.metadata->>'notes' AS notes,
    COALESCE(latest.metadata->>'stage',origin.metadata->>'stage') AS stage,
    origin.metadata->>'partnerId' AS "partnerId",origin.metadata->>'partnerName' AS "partnerName",
    origin.actor_id AS "registeredBy",origin.created_at AS "createdAt",latest.metadata->>'updatedAt' AS "updatedAt"
    FROM public.audit_log origin LEFT JOIN LATERAL (
      SELECT change.metadata FROM public.audit_log change WHERE change.action='deal.updated' AND change.entity_type='deal'
        AND (change.org_id::text=${dealResourceId} OR (change.org_id IS NULL AND change.metadata->>'resourceId'=${dealResourceId}))
      ORDER BY change.created_at DESC,change.id DESC LIMIT 1
    ) latest ON true WHERE ${dealRootScope(context)}`
}

export const commissionResourceId = sql`CASE WHEN commission.org_id IS NULL THEN commission.id::text ELSE commission.org_id::text END`
export function scopedCommissions(context: ResourceContext) {
  return sql`SELECT ${commissionResourceId} AS id,commission.metadata->>'dealId' AS "dealId",
    commission.metadata->>'accountName' AS "accountName",commission.metadata->>'partnerId' AS "partnerId",
    commission.metadata->>'partnerName' AS "partnerName",(COALESCE(commission.metadata->>'baseAmount','0'))::numeric AS "baseAmount",
    (COALESCE(commission.metadata->>'multiplier','1'))::numeric AS multiplier,
    (COALESCE(commission.metadata->>'finalAmount','0'))::numeric AS "finalAmount",
    COALESCE(commission.metadata->>'currency','USD') AS currency,
    COALESCE(latest.metadata->>'status',commission.metadata->>'status') AS status,commission.created_at AS "createdAt"
    FROM public.audit_log commission LEFT JOIN LATERAL (
      SELECT change.metadata FROM public.audit_log change WHERE change.action='commission.updated' AND change.entity_type='commission'
        AND (change.org_id::text=${commissionResourceId} OR (change.org_id IS NULL AND change.metadata->>'resourceId'=${commissionResourceId}))
      ORDER BY change.created_at DESC,change.id DESC LIMIT 1
    ) latest ON true WHERE commission.action='commission.created' AND commission.entity_type='commission' AND (${commissionOwnership(context)})`
}
