/**
 * Zonga — Event Lifecycle Service
 *
 * Manages the full event lifecycle from draft → completed/cancelled.
 * Enforces state transitions and inventory constraints.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { EventLifecycleState, ZongaEventFull, EventLineupEntry } from './types'
import { EVENT_TRANSITIONS } from './types'

export interface CreateEventParams {
  orgId: string
  title: string
  description?: string
  venueName: string
  address?: string
  city: string
  country: string
  capacity: number
  startsAt: Date
  endsAt?: Date
  genre?: string
  imageUrl?: string
  createdBy: string
}

export interface EventResult {
  ok: boolean
  eventId?: string
  error?: string
}

/**
 * Create a new event in draft state.
 */
export async function createEvent(params: CreateEventParams): Promise<EventResult> {
  try {
    const rows = await platformDb.execute(sql`
      INSERT INTO zonga_events (
        org_id, title, description,
        venue, city, country,
        starts_at, ends_at, status,
        image_url, creator_id
      ) VALUES (
        ${params.orgId}, ${params.title}, ${params.description ?? null},
        ${params.venueName}, ${params.city}, ${params.country},
        ${params.startsAt.toISOString()}::timestamptz,
        ${params.endsAt?.toISOString() ?? null}::timestamptz,
        'draft',
        ${params.imageUrl ?? null}, ${params.createdBy}
      )
      RETURNING id
    `)
    const eventId = (rows as unknown as Array<{ id: string }>)[0].id

    logger.info('Event created', { eventId, title: params.title })
    return { ok: true, eventId }
  } catch (error) {
    logger.error('Event creation failed', { error })
    return { ok: false, error: 'Failed to create event' }
  }
}

/**
 * Transition an event through its lifecycle.
 */
export async function transitionEventState(params: {
  eventId: string
  orgId: string
  targetState: EventLifecycleState
  actorId: string
}): Promise<EventResult> {
  const { eventId, orgId, targetState, actorId } = params

  const rows = await platformDb.execute(sql`
    SELECT status FROM zonga_events
    WHERE id = ${eventId} AND org_id = ${orgId}
  `)
  const event = (rows as unknown as Array<{ status: string }>)[0]

  if (!event) return { ok: false, error: 'Event not found' }

  const currentState = event.status as EventLifecycleState
  const allowed = EVENT_TRANSITIONS[currentState]

  if (!allowed?.includes(targetState)) {
    return { ok: false, error: `Cannot transition from "${currentState}" to "${targetState}"` }
  }

  // On publish, validate minimum requirements
  if (targetState === 'published' || targetState === 'on_sale') {
    const validation = await validateEventForPublishing(eventId, orgId)
    if (!validation.ok) return validation
  }

  await platformDb.execute(sql`
    UPDATE zonga_events
    SET status = ${targetState}, updated_at = now()
    WHERE id = ${eventId} AND org_id = ${orgId}
  `)

  logger.info('Event state transition', { eventId, from: currentState, to: targetState, actorId })
  return { ok: true, eventId }
}

/**
 * Add artists to an event lineup.
 */
export async function addToLineup(params: {
  eventId: string
  artistId?: string
  artistName: string
  role: EventLineupEntry['role']
  setTime?: Date
  sortOrder?: number
}): Promise<{ ok: boolean; lineupEntryId?: string }> {
  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_event_artists (
      event_id, artist_id, artist_name, role, set_time, sort_order
    ) VALUES (
      ${params.eventId}, ${params.artistId ?? null},
      ${params.artistName}, ${params.role},
      ${params.setTime?.toISOString() ?? null}::timestamptz,
      ${params.sortOrder ?? 0}
    )
    RETURNING id
  `)
  const id = (rows as unknown as Array<{ id: string }>)[0].id
  return { ok: true, lineupEntryId: id }
}

/**
 * Define a ticket type for an event.
 */
export async function createTicketType(params: {
  eventId: string
  orgId: string
  name: string
  description?: string
  price: number
  currency: string
  quantityTotal: number
  saleStartsAt?: Date
  saleEndsAt?: Date
  maxPerOrder?: number
}): Promise<{ ok: boolean; ticketTypeId?: string }> {
  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_ticket_types (
      event_id, org_id, name, description,
      price, currency, quantity_total,
      sale_starts_at, sale_ends_at, max_per_order
    ) VALUES (
      ${params.eventId}, ${params.orgId}, ${params.name},
      ${params.description ?? null},
      ${params.price}, ${params.currency}, ${params.quantityTotal},
      ${params.saleStartsAt?.toISOString() ?? null}::timestamptz,
      ${params.saleEndsAt?.toISOString() ?? null}::timestamptz,
      ${params.maxPerOrder ?? 10}
    )
    RETURNING id
  `)
  const id = (rows as unknown as Array<{ id: string }>)[0].id
  return { ok: true, ticketTypeId: id }
}

/**
 * Get the full event details including lineup and ticket types.
 */
export async function getEventFull(
  eventId: string,
  orgId: string,
): Promise<ZongaEventFull | null> {
  const eventRows = await platformDb.execute(sql`
    SELECT * FROM zonga_events WHERE id = ${eventId} AND org_id = ${orgId}
  `)
  const event = (eventRows as unknown as Array<Record<string, unknown>>)[0]
  if (!event) return null

  const lineupRows = await platformDb.execute(sql`
    SELECT * FROM zonga_event_artists WHERE event_id = ${eventId} ORDER BY sort_order
  `)

  const ticketRows = await platformDb.execute(sql`
    SELECT * FROM zonga_ticket_types WHERE event_id = ${eventId} ORDER BY sort_order
  `)

  const salesRows = await platformDb.execute(sql`
    SELECT
      COALESCE(SUM(quantity), 0)::int as total_sold,
      COALESCE(SUM(total_amount), 0)::numeric as total_revenue
    FROM zonga_ticket_orders
    WHERE event_id = ${eventId} AND status = 'confirmed'
  `)
  const sales = (salesRows as unknown as Array<Record<string, unknown>>)[0]

  return {
    id: event.id as string,
    orgId: event.org_id as string,
    title: event.title as string,
    description: event.description as string | undefined,
    venueName: event.venue as string,
    city: event.city as string,
    country: event.country as string,
    capacity: (event.capacity as number) ?? 0,
    startsAt: new Date(event.starts_at as string),
    endsAt: event.ends_at ? new Date(event.ends_at as string) : undefined,
    status: event.status as EventLifecycleState,
    imageUrl: event.image_url as string | undefined,
    genre: event.genre as string | undefined,
    createdBy: event.creator_id as string,
    lineup: (lineupRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      artistId: r.artist_id as string | undefined,
      artistName: r.artist_name as string,
      role: r.role as EventLineupEntry['role'],
      setTime: r.set_time ? new Date(r.set_time as string) : undefined,
      sortOrder: r.sort_order as number,
    })),
    ticketTypes: (ticketRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: r.description as string | undefined,
      price: Number(r.price),
      currency: r.currency as string,
      quantityTotal: r.quantity_total as number,
      quantitySold: r.quantity_sold as number,
      quantityReserved: r.quantity_reserved as number,
      saleStartsAt: r.sale_starts_at ? new Date(r.sale_starts_at as string) : undefined,
      saleEndsAt: r.sale_ends_at ? new Date(r.sale_ends_at as string) : undefined,
      maxPerOrder: r.max_per_order as number,
      isActive: r.is_active as boolean,
    })),
    totalSold: (sales?.total_sold as number) ?? 0,
    totalRevenue: Number(sales?.total_revenue ?? 0),
    createdAt: new Date(event.created_at as string),
    updatedAt: new Date(event.updated_at as string),
  }
}

/**
 * Get attendee list for an event (organizer view).
 */
export async function getAttendeeList(
  eventId: string,
  orgId: string,
): Promise<Array<{
  orderId: string
  buyerName: string
  buyerEmail: string
  quantity: number
  ticketType: string
  status: string
  checkedIn: boolean
}>> {
  const rows = await platformDb.execute(sql`
    SELECT
      o.id as order_id,
      o.buyer_name,
      o.buyer_email,
      o.quantity,
      tt.name as ticket_type,
      o.status,
      EXISTS(
        SELECT 1 FROM zonga_tickets t
        WHERE t.order_id = o.id AND t.status = 'used'
      ) as checked_in
    FROM zonga_ticket_orders o
    JOIN zonga_ticket_types tt ON tt.id = o.ticket_type_id
    WHERE o.event_id = ${eventId} AND o.org_id = ${orgId}
    ORDER BY o.created_at
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    orderId: r.order_id as string,
    buyerName: (r.buyer_name as string) ?? '',
    buyerEmail: r.buyer_email as string,
    quantity: r.quantity as number,
    ticketType: r.ticket_type as string,
    status: r.status as string,
    checkedIn: r.checked_in as boolean,
  }))
}

// ── Validation ──────────────────────────────────────────────────────────────

async function validateEventForPublishing(
  eventId: string,
  orgId: string,
): Promise<EventResult> {
  const eventRows = await platformDb.execute(sql`
    SELECT title, venue, city, country, starts_at
    FROM zonga_events WHERE id = ${eventId} AND org_id = ${orgId}
  `)
  const event = (eventRows as unknown as Array<Record<string, unknown>>)[0]

  if (!event?.title) return { ok: false, error: 'Event title is required' }
  if (!event?.venue) return { ok: false, error: 'Venue is required' }
  if (!event?.city) return { ok: false, error: 'City is required' }
  if (!event?.starts_at) return { ok: false, error: 'Start time is required' }

  const startsAt = new Date(event.starts_at as string)
  if (startsAt <= new Date()) {
    return { ok: false, error: 'Event start time must be in the future' }
  }

  // Must have at least one ticket type
  const ttRows = await platformDb.execute(sql`
    SELECT COUNT(*)::int as count FROM zonga_ticket_types
    WHERE event_id = ${eventId} AND is_active = true
  `)
  const ttCount = (ttRows as unknown as Array<{ count: number }>)[0]?.count ?? 0
  if (ttCount === 0) {
    return { ok: false, error: 'At least one ticket type is required' }
  }

  return { ok: true, eventId }
}
