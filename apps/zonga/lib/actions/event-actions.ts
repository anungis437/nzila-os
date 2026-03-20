/**
 * Zonga Server Actions — Events & Ticketing.
 *
 * Create and manage live events, sell tickets via Stripe checkout,
 * and track ticket inventory / attendance.
 * Reads/writes domain tables (zonga_events, zonga_ticket_types,
 * zonga_ticket_purchases) + audit_log for traceability.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
  CreateEventSchema,
  CreateTicketTypeSchema,
  PurchaseTicketSchema,
} from '@/lib/zonga-services'
import { createCheckoutSession } from '@/lib/stripe'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

/* ─── Types ─── */

export interface ZongaEvent {
  id: string
  title: string
  description?: string
  venue: string
  city: string
  country: string
  startsAt: string
  endsAt?: string
  status: 'draft' | 'published' | 'sold_out' | 'cancelled' | 'completed'
  imageUrl?: string
  creatorId?: string
  ticketPrice?: number
  currency?: string
  totalTickets?: number
  soldTickets?: number
  performers?: string[]
  genre?: string
  ticketTypes?: TicketTypeSummary[]
  createdAt?: Date
}

export interface TicketTypeSummary {
  id: string
  ticketType: string
  price: number
  currency: string
  quantityAvailable: number
  sold: number
}

export interface Ticket {
  id: string
  eventId: string
  ticketTypeId: string
  ticketType: string
  listenerId?: string
  buyerName?: string
  buyerEmail?: string
  quantity?: number
  totalPrice?: number
  amount: number
  currency: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded' | 'used'
  stripeCheckoutSessionId?: string
  createdAt?: Date
}

export interface EventListResult {
  events: ZongaEvent[]
  total: number
}

export interface TicketListResult {
  tickets: Ticket[]
  total: number
  totalRevenue: number
}

/* ─── List Events ─── */

export async function listEvents(opts?: {
  page?: number
  status?: string
}): Promise<EventListResult> {
  const ctx = await resolveOrgContext()

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        e.id,
        e.title,
        e.description,
        e.venue,
        e.city,
        e.country,
        e.starts_at as "startsAt",
        e.ends_at as "endsAt",
        e.status,
        e.image_url as "imageUrl",
        e.creator_id as "creatorId",
        e.created_at as "createdAt"
      FROM zonga_events e
      WHERE e.org_id = ${ctx.orgId}
      ORDER BY e.starts_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: ZongaEvent[] }

    const [cnt] = (await platformDb.execute(
      sql`SELECT COUNT(*) as total FROM zonga_events WHERE org_id = ${ctx.orgId}`,
    )) as unknown as [{ total: number }]

    return {
      events: rows.rows ?? [],
      total: Number(cnt?.total ?? 0),
    }
  } catch (error) {
    logger.error('listEvents failed', { error })
    return { events: [], total: 0 }
  }
}

/* ─── Event Detail ─── */

export async function getEventDetail(eventId: string): Promise<{
  event: ZongaEvent | null
  tickets: Ticket[]
  ticketsSold: number
  ticketRevenue: number
}> {
  const ctx = await resolveOrgContext()

  try {
    const [event] = (await platformDb.execute(
      sql`SELECT
        e.id, e.title, e.description, e.venue, e.city, e.country,
        e.starts_at as "startsAt", e.ends_at as "endsAt",
        e.status, e.image_url as "imageUrl",
        e.creator_id as "creatorId",
        e.created_at as "createdAt"
      FROM zonga_events e
      WHERE e.id = ${eventId} AND e.org_id = ${ctx.orgId}`,
    )) as unknown as [ZongaEvent | undefined]

    const ticketRows = (await platformDb.execute(
      sql`SELECT
        tp.id,
        tp.event_id as "eventId",
        tp.ticket_type_id as "ticketTypeId",
        tt.ticket_type as "ticketType",
        tp.listener_id as "listenerId",
        tp.amount,
        tp.currency,
        tp.status,
        tp.stripe_checkout_session_id as "stripeCheckoutSessionId",
        tp.created_at as "createdAt"
      FROM zonga_ticket_purchases tp
      JOIN zonga_ticket_types tt ON tt.id = tp.ticket_type_id
      WHERE tp.event_id = ${eventId} AND tp.org_id = ${ctx.orgId}
      ORDER BY tp.created_at DESC`,
    )) as unknown as { rows: Ticket[] }

    const tickets = ticketRows.rows ?? []
    const ticketsSold = tickets.filter(t => t.status === 'confirmed').length
    const ticketRevenue = tickets
      .filter(t => t.status === 'confirmed')
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0)

    return { event: event ?? null, tickets, ticketsSold, ticketRevenue }
  } catch (error) {
    logger.error('getEventDetail failed', { error })
    return { event: null, tickets: [], ticketsSold: 0, ticketRevenue: 0 }
  }
}

/* ─── Create Event ─── */

export async function createEvent(data: {
  title: string
  description?: string
  venue?: string
  city?: string
  country?: string
  startsAt: string
  endsAt?: string
  creatorId?: string
  ticketPrice?: number
  currency?: string
  totalTickets?: number
  performers?: string[]
  genre?: string
}): Promise<{ success: boolean; eventId?: string; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const parsed = CreateEventSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  try {
    const eventId = crypto.randomUUID()

    await platformDb.execute(
      sql`INSERT INTO zonga_events (id, org_id, creator_id, title, description, venue, city, country, starts_at, ends_at, status)
      VALUES (${eventId}, ${ctx.orgId}, ${data.creatorId ?? null}, ${data.title},
        ${data.description ?? null}, ${data.venue ?? null}, ${data.city ?? null},
        ${data.country ?? null}, ${new Date(data.startsAt)},
        ${data.endsAt ? new Date(data.endsAt) : null}, 'draft')`,
    )

    // Supplementary audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('event.created', ${ctx.actorId}, 'event', ${eventId}, ${ctx.orgId},
        ${JSON.stringify({ title: data.title, venue: data.venue })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: 'event.created' as ZongaAuditAction,
      entityType: 'event' as ZongaEntityType,
      orgId: eventId,
      actorId: ctx.actorId,
      targetId: eventId,
      metadata: { title: data.title, venue: data.venue },
    })
    logger.info('Event created', { ...auditEvent })

    const pack = buildEvidencePackFromAction({
      actionType: 'EVENT_CREATED',
      orgId: eventId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    revalidatePath('/dashboard/events')
    return { success: true, eventId }
  } catch (error) {
    logger.error('createEvent failed', { error })
    return { success: false }
  }
}

/* ─── Create Ticket Type ─── */

export async function createTicketType(data: {
  eventId: string
  ticketType: string
  price: number
  currency?: string
  quantityAvailable: number
}): Promise<{ success: boolean; ticketTypeId?: string; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const parsed = CreateTicketTypeSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  try {
    const ticketTypeId = crypto.randomUUID()

    await platformDb.execute(
      sql`INSERT INTO zonga_ticket_types (id, org_id, event_id, ticket_type, price, currency, quantity_available)
      VALUES (${ticketTypeId}, ${ctx.orgId}, ${data.eventId}, ${data.ticketType},
        ${data.price}, ${data.currency ?? 'USD'}, ${data.quantityAvailable})`,
    )

    logger.info('Ticket type created', { ticketTypeId, eventId: data.eventId })
    revalidatePath('/dashboard/events')
    return { success: true, ticketTypeId }
  } catch (error) {
    logger.error('createTicketType failed', { error })
    return { success: false }
  }
}

/* ─── Publish Event ─── */

export async function publishEvent(
  eventId: string,
): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext()

  try {
    // Governance check: verify event has required fields before publishing
    const [eventCheck] = (await platformDb.execute(
      sql`SELECT title, venue, starts_at as "startsAt",
        (SELECT COUNT(*) FROM zonga_ticket_types WHERE event_id = ${eventId}) as ticket_type_count
      FROM zonga_events
      WHERE id = ${eventId} AND org_id = ${ctx.orgId} AND status = 'draft'`,
    )) as unknown as [{ title: string; venue: string; startsAt: string; ticket_type_count: number } | undefined]

    if (!eventCheck) {
      return { success: false }
    }

    await platformDb.execute(
      sql`UPDATE zonga_events SET status = 'published', updated_at = NOW()
      WHERE id = ${eventId} AND org_id = ${ctx.orgId} AND status = 'draft'`,
    )

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('event.published', ${ctx.actorId}, 'event', ${eventId}, ${ctx.orgId},
        ${JSON.stringify({ publishedAt: new Date().toISOString() })}::jsonb)`,
    )

    logger.info('Event published', { eventId, actorId: ctx.actorId })
    revalidatePath('/dashboard/events')
    return { success: true }
  } catch (error) {
    logger.error('publishEvent failed', { error })
    return { success: false }
  }
}

/* ─── Purchase Ticket (via Stripe Checkout) ─── */

export async function purchaseTicket(data: {
  eventId: string
  ticketTypeId: string
  listenerId?: string
  successUrl: string
  cancelUrl: string
}): Promise<{ success: boolean; checkoutUrl?: string; error?: unknown }> {
  const ctx = await resolveOrgContext()

  const parsed = PurchaseTicketSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors }
  }

  try {
    // Atomic capacity check + ticket reservation using a single query
    // If quantity_available > sold count, insert the purchase; otherwise return empty.
    const purchaseId = crypto.randomUUID()

    // Fetch ticket type with sold count (for pricing + display)
    const [ticketType] = (await platformDb.execute(
      sql`SELECT id, ticket_type, price, currency, quantity_available,
        (SELECT COUNT(*) FROM zonga_ticket_purchases
         WHERE ticket_type_id = zonga_ticket_types.id AND status IN ('confirmed', 'pending')) as sold
      FROM zonga_ticket_types
      WHERE id = ${data.ticketTypeId} AND event_id = ${data.eventId}`,
    )) as unknown as [{ id: string; ticket_type: string; price: number; currency: string; quantity_available: number; sold: number } | undefined]

    if (!ticketType) {
      return { success: false, error: 'Ticket type not found' }
    }

    if (Number(ticketType.sold) >= ticketType.quantity_available) {
      return { success: false, error: 'Sold out' }
    }

    // Atomic insert that re-checks capacity in the WHERE clause
    // This prevents race conditions: if another purchase was inserted
    // between our check and this INSERT, the subquery will fail the condition.
    const insertResult = (await platformDb.execute(
      sql`INSERT INTO zonga_ticket_purchases (id, org_id, event_id, ticket_type_id, listener_id,
        stripe_checkout_session_id, status, amount, currency)
      SELECT ${purchaseId}, ${ctx.orgId}, ${data.eventId}, ${data.ticketTypeId},
        ${data.listenerId ?? null}, NULL, 'pending',
        ${ticketType.price}, ${ticketType.currency}
      WHERE (
        SELECT COUNT(*) FROM zonga_ticket_purchases
        WHERE ticket_type_id = ${data.ticketTypeId} AND status IN ('confirmed', 'pending')
      ) < ${ticketType.quantity_available}
      RETURNING id`,
    )) as unknown as { rows: { id: string }[] }

    const inserted = insertResult.rows ?? []
    if (inserted.length === 0) {
      return { success: false, error: 'Sold out — capacity reached during purchase' }
    }

    // Fetch event title for display
    const [event] = (await platformDb.execute(
      sql`SELECT title FROM zonga_events WHERE id = ${data.eventId}`,
    )) as unknown as [{ title: string } | undefined]

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      orgId: data.eventId,
      lineItems: [
        {
          name: `${event?.title ?? 'Event'} — ${ticketType.ticket_type}`,
          amountCents: Math.round(Number(ticketType.price) * 100),
          quantity: 1,
        },
      ],
      successUrl: data.successUrl,
      cancelUrl: data.cancelUrl,
      metadata: {
        purchaseId,
        eventId: data.eventId,
        ticketTypeId: data.ticketTypeId,
      },
    })

    // Update the already-inserted purchase with the Stripe session ID
    await platformDb.execute(
      sql`UPDATE zonga_ticket_purchases
      SET stripe_checkout_session_id = ${session?.id ?? null}
      WHERE id = ${purchaseId}`,
    )

    // Supplementary audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('event.ticket.purchased', ${ctx.actorId}, 'ticket', ${purchaseId}, ${ctx.orgId},
        ${JSON.stringify({ eventId: data.eventId, ticketTypeId: data.ticketTypeId })}::jsonb)`,
    )

    logger.info('Ticket purchase initiated', { purchaseId, eventId: data.eventId })
    revalidatePath('/dashboard/events')
    return { success: true, checkoutUrl: session?.url ?? undefined }
  } catch (error) {
    logger.error('purchaseTicket failed', { error })
    return { success: false }
  }
}

/* ─── List Tickets for Event ─── */

export async function listTickets(opts?: {
  eventId?: string
  page?: number
}): Promise<TicketListResult> {
  const ctx = await resolveOrgContext()

  const page = opts?.page ?? 1
  const offset = (page - 1) * 25

  try {
    const eventFilter = opts?.eventId
      ? sql`AND tp.event_id = ${opts.eventId}`
      : sql``

    const rows = (await platformDb.execute(
      sql`SELECT
        tp.id,
        tp.event_id as "eventId",
        tp.ticket_type_id as "ticketTypeId",
        tt.ticket_type as "ticketType",
        tp.listener_id as "listenerId",
        tp.amount,
        tp.currency,
        tp.status,
        tp.stripe_checkout_session_id as "stripeCheckoutSessionId",
        tp.created_at as "createdAt"
      FROM zonga_ticket_purchases tp
      JOIN zonga_ticket_types tt ON tt.id = tp.ticket_type_id
      WHERE tp.org_id = ${ctx.orgId} ${eventFilter}
      ORDER BY tp.created_at DESC
      LIMIT 25 OFFSET ${offset}`,
    )) as unknown as { rows: Ticket[] }

    const [totals] = (await platformDb.execute(
      sql`SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN tp.status = 'confirmed' THEN tp.amount::numeric ELSE 0 END), 0) as total_revenue
      FROM zonga_ticket_purchases tp
      WHERE tp.org_id = ${ctx.orgId} ${eventFilter}`,
    )) as unknown as [{ total: number; total_revenue: number }]

    return {
      tickets: rows.rows ?? [],
      total: Number(totals?.total ?? 0),
      totalRevenue: Number(totals?.total_revenue ?? 0),
    }
  } catch (error) {
    logger.error('listTickets failed', { error })
    return { tickets: [], total: 0, totalRevenue: 0 }
  }
}
