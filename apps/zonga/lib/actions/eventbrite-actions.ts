/**
 * Zonga Server Actions — Eventbrite Integration.
 *
 * Connect/disconnect Eventbrite accounts, list remote events,
 * import events + ticket classes into Zonga, and sync updates.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import {
  EventbriteClient,
  EventbriteApiError,
  type EventbriteEvent,
  type EventbriteTicketClass,
} from '@/lib/eventbrite'

/* ─── Types ─── */

export interface EventbriteConnection {
  id: string
  eventbriteOrgId: string | null
  eventbriteOrgName?: string
  connectedAt: string
}

export interface ImportableEvent {
  id: string
  name: string
  description: string | null
  url: string
  startUtc: string
  endUtc: string
  status: string
  venueName: string | null
  city: string | null
  country: string | null
  imageUrl: string | null
  capacity: number | null
  alreadyImported: boolean
  ticketClasses: {
    id: string
    name: string
    price: number
    currency: string
    quantity: number
    sold: number
    free: boolean
  }[]
}

/* ─── Get Connection Status ─── */

export async function getEventbriteConnection(): Promise<EventbriteConnection | null> {
  const ctx = await resolveOrgContext()

  try {
    const [row] = (await platformDb.execute(
      sql`SELECT id, eventbrite_org_id as "eventbriteOrgId",
             connected_at as "connectedAt"
        FROM zonga_eventbrite_connections
        WHERE org_id = ${ctx.orgId}
        LIMIT 1`,
    )) as unknown as [EventbriteConnection | undefined]

    return row ?? null
  } catch (error) {
    logger.error('getEventbriteConnection failed', { error })
    return null
  }
}

/* ─── Connect Eventbrite ─── */

export async function connectEventbrite(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await resolveOrgContext()

  if (!token || token.length < 10) {
    return { success: false, error: 'Invalid API token' }
  }

  try {
    // Validate the token by hitting /users/me
    const client = new EventbriteClient(token)
    const user = await client.validateToken()
    logger.info('Eventbrite token validated', { userId: user.id, name: user.name })

    // Fetch the first org to store as default
    const orgs = await client.listOrganizations()
    const ebOrgId = orgs[0]?.id ?? null

    // Upsert connection (one per creator/org)
    await platformDb.execute(
      sql`INSERT INTO zonga_eventbrite_connections
          (org_id, creator_id, eventbrite_org_id, access_token)
        VALUES (
          ${ctx.orgId},
          (SELECT id FROM zonga_creators WHERE org_id = ${ctx.orgId} LIMIT 1),
          ${ebOrgId},
          ${token}
        )
        ON CONFLICT (creator_id) DO UPDATE
        SET access_token     = EXCLUDED.access_token,
            eventbrite_org_id = EXCLUDED.eventbrite_org_id,
            updated_at       = now()`,
    )

    revalidatePath('/dashboard/settings/integrations')
    return { success: true }
  } catch (error) {
    if (error instanceof EventbriteApiError && error.statusCode === 401) {
      return { success: false, error: 'Invalid or expired API token' }
    }
    logger.error('connectEventbrite failed', { error })
    return { success: false, error: 'Failed to connect — please try again' }
  }
}

/* ─── Disconnect Eventbrite ─── */

export async function disconnectEventbrite(): Promise<{ success: boolean }> {
  const ctx = await resolveOrgContext()

  try {
    await platformDb.execute(
      sql`DELETE FROM zonga_eventbrite_connections WHERE org_id = ${ctx.orgId}`,
    )
    revalidatePath('/dashboard/settings/integrations')
    return { success: true }
  } catch (error) {
    logger.error('disconnectEventbrite failed', { error })
    return { success: false }
  }
}

/* ─── List Importable Events ─── */

export async function listEventbriteEvents(
  opts?: { page?: number },
): Promise<{ events: ImportableEvent[]; hasMore: boolean; error?: string }> {
  const ctx = await resolveOrgContext()

  try {
    // Get stored connection
    const [conn] = (await platformDb.execute(
      sql`SELECT access_token as "accessToken", eventbrite_org_id as "eventbriteOrgId"
        FROM zonga_eventbrite_connections
        WHERE org_id = ${ctx.orgId}
        LIMIT 1`,
    )) as unknown as [{ accessToken: string; eventbriteOrgId: string } | undefined]

    if (!conn) {
      return { events: [], hasMore: false, error: 'No Eventbrite account connected' }
    }

    const client = new EventbriteClient(conn.accessToken)
    const { events: ebEvents, pagination } = await client.listEvents(
      conn.eventbriteOrgId,
      { page: opts?.page ?? 1 },
    )

    // Check which events are already imported
    const ebIds = ebEvents.map((e) => e.id)
    const importedRows = ebIds.length > 0
      ? ((await platformDb.execute(
          sql`SELECT eventbrite_id as "eventbriteId"
            FROM zonga_events
            WHERE eventbrite_id = ANY(${ebIds})`,
        )) as unknown as { eventbriteId: string }[])
      : []
    const importedSet = new Set(importedRows.map((r) => r.eventbriteId))

    // Fetch ticket classes for each event
    const events: ImportableEvent[] = await Promise.all(
      ebEvents.map(async (eb) => {
        let ticketClasses: EventbriteTicketClass[] = []
        try {
          ticketClasses = await client.listTicketClasses(eb.id)
        } catch { /* ticket query may fail for draft events */ }

        return {
          id: eb.id,
          name: eb.name.text,
          description: eb.description?.text ?? null,
          url: eb.url,
          startUtc: eb.start.utc,
          endUtc: eb.end.utc,
          status: eb.status,
          venueName: eb.venue?.name ?? null,
          city: eb.venue?.address?.city ?? null,
          country: eb.venue?.address?.country ?? null,
          imageUrl: eb.logo?.url ?? null,
          capacity: eb.capacity,
          alreadyImported: importedSet.has(eb.id),
          ticketClasses: ticketClasses.map((tc) => ({
            id: tc.id,
            name: tc.name,
            price: tc.free ? 0 : Number(tc.cost?.major_value ?? 0),
            currency: tc.free ? 'USD' : (tc.cost?.currency ?? 'USD'),
            quantity: tc.quantity_total ?? 0,
            sold: tc.quantity_sold,
            free: tc.free,
          })),
        }
      }),
    )

    return {
      events,
      hasMore: pagination.has_more_items,
    }
  } catch (error) {
    if (error instanceof EventbriteApiError && error.statusCode === 401) {
      return { events: [], hasMore: false, error: 'Eventbrite token expired — please reconnect' }
    }
    logger.error('listEventbriteEvents failed', { error })
    return { events: [], hasMore: false, error: 'Failed to fetch events from Eventbrite' }
  }
}

/* ─── Import a Single Event ─── */

export async function importEventbriteEvent(
  eventbriteEventId: string,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const ctx = await resolveOrgContext()

  try {
    // Get connection
    const [conn] = (await platformDb.execute(
      sql`SELECT access_token as "accessToken", eventbrite_org_id as "eventbriteOrgId"
        FROM zonga_eventbrite_connections
        WHERE org_id = ${ctx.orgId}
        LIMIT 1`,
    )) as unknown as [{ accessToken: string; eventbriteOrgId: string } | undefined]

    if (!conn) {
      return { success: false, error: 'No Eventbrite account connected' }
    }

    // Check if already imported
    const [existing] = (await platformDb.execute(
      sql`SELECT id FROM zonga_events WHERE eventbrite_id = ${eventbriteEventId}`,
    )) as unknown as [{ id: string } | undefined]

    if (existing) {
      return { success: false, error: 'Event already imported' }
    }

    const client = new EventbriteClient(conn.accessToken)
    const ebEvent = await client.getEvent(eventbriteEventId)
    const ticketClasses = await client.listTicketClasses(eventbriteEventId)

    // Map Eventbrite status → Zonga status
    const statusMap: Record<string, string> = {
      draft: 'draft',
      live: 'published',
      started: 'published',
      ended: 'completed',
      completed: 'completed',
      canceled: 'cancelled',
    }
    const zongaStatus = statusMap[ebEvent.status] ?? 'draft'

    // Resolve venue info
    let venue = ebEvent.venue?.name ?? ''
    let city = ebEvent.venue?.address?.city ?? ''
    let country = ebEvent.venue?.address?.country ?? ''
    if (!venue && ebEvent.online_event) {
      venue = 'Online Event'
    }

    // Get creator for this org
    const [creator] = (await platformDb.execute(
      sql`SELECT id FROM zonga_creators WHERE org_id = ${ctx.orgId} LIMIT 1`,
    )) as unknown as [{ id: string } | undefined]

    // Insert event
    const startsAt = new Date(ebEvent.start.utc).toISOString()
    const endsAt = new Date(ebEvent.end.utc).toISOString()

    const [inserted] = (await platformDb.execute(
      sql`INSERT INTO zonga_events
          (org_id, creator_id, title, description, venue, city, country,
           starts_at, ends_at, status, image_url, source, eventbrite_id, eventbrite_url)
        VALUES (
          ${ctx.orgId},
          ${creator?.id ?? null},
          ${ebEvent.name.text},
          ${ebEvent.description?.text ?? null},
          ${venue},
          ${city},
          ${country},
          ${startsAt}::timestamptz,
          ${endsAt}::timestamptz,
          ${zongaStatus},
          ${ebEvent.logo?.url ?? null},
          'eventbrite',
          ${eventbriteEventId},
          ${ebEvent.url}
        )
        RETURNING id`,
    )) as unknown as [{ id: string }]

    // Import ticket classes as ticket types
    for (const tc of ticketClasses) {
      const price = tc.free ? 0 : Number(tc.cost?.major_value ?? 0)
      const currency = tc.free ? 'USD' : (tc.cost?.currency ?? 'USD')

      await platformDb.execute(
        sql`INSERT INTO zonga_ticket_types
            (org_id, event_id, ticket_type, price, currency,
             quantity_available, eventbrite_ticket_class_id)
          VALUES (
            ${ctx.orgId},
            ${inserted.id},
            ${tc.name},
            ${price},
            ${currency},
            ${tc.quantity_total ?? 0},
            ${tc.id}
          )`,
      )
    }

    logger.info('Eventbrite event imported', {
      eventbriteId: eventbriteEventId,
      zongaId: inserted.id,
      ticketTypes: ticketClasses.length,
    })

    revalidatePath('/dashboard/events')
    return { success: true, eventId: inserted.id }
  } catch (error) {
    logger.error('importEventbriteEvent failed', { error, eventbriteEventId })
    return { success: false, error: 'Failed to import event' }
  }
}

/* ─── Sync Existing Imported Event ─── */

export async function syncEventbriteEvent(
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await resolveOrgContext()

  try {
    // Get event's Eventbrite ID
    const [event] = (await platformDb.execute(
      sql`SELECT eventbrite_id as "eventbriteId"
        FROM zonga_events
        WHERE id = ${eventId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ eventbriteId: string | null } | undefined]

    if (!event?.eventbriteId) {
      return { success: false, error: 'Event is not linked to Eventbrite' }
    }

    // Get connection
    const [conn] = (await platformDb.execute(
      sql`SELECT access_token as "accessToken"
        FROM zonga_eventbrite_connections
        WHERE org_id = ${ctx.orgId}
        LIMIT 1`,
    )) as unknown as [{ accessToken: string } | undefined]

    if (!conn) {
      return { success: false, error: 'No Eventbrite account connected' }
    }

    const client = new EventbriteClient(conn.accessToken)
    const ebEvent = await client.getEvent(event.eventbriteId)
    const ticketClasses = await client.listTicketClasses(event.eventbriteId)

    // Map status
    const statusMap: Record<string, string> = {
      draft: 'draft',
      live: 'published',
      started: 'published',
      ended: 'completed',
      completed: 'completed',
      canceled: 'cancelled',
    }
    const zongaStatus = statusMap[ebEvent.status] ?? 'draft'

    let venue = ebEvent.venue?.name ?? ''
    let city = ebEvent.venue?.address?.city ?? ''
    let country = ebEvent.venue?.address?.country ?? ''
    if (!venue && ebEvent.online_event) venue = 'Online Event'

    const startsAt = new Date(ebEvent.start.utc).toISOString()
    const endsAt = new Date(ebEvent.end.utc).toISOString()

    // Update event
    await platformDb.execute(
      sql`UPDATE zonga_events SET
          title = ${ebEvent.name.text},
          description = ${ebEvent.description?.text ?? null},
          venue = ${venue},
          city = ${city},
          country = ${country},
          starts_at = ${startsAt}::timestamptz,
          ends_at = ${endsAt}::timestamptz,
          status = ${zongaStatus},
          image_url = ${ebEvent.logo?.url ?? null},
          eventbrite_url = ${ebEvent.url},
          updated_at = now()
        WHERE id = ${eventId} AND org_id = ${ctx.orgId}`,
    )

    // Upsert ticket types
    for (const tc of ticketClasses) {
      const price = tc.free ? 0 : Number(tc.cost?.major_value ?? 0)
      const currency = tc.free ? 'USD' : (tc.cost?.currency ?? 'USD')

      await platformDb.execute(
        sql`INSERT INTO zonga_ticket_types
            (org_id, event_id, ticket_type, price, currency,
             quantity_available, eventbrite_ticket_class_id)
          VALUES (
            ${ctx.orgId}, ${eventId}, ${tc.name}, ${price}, ${currency},
            ${tc.quantity_total ?? 0}, ${tc.id}
          )
          ON CONFLICT (eventbrite_ticket_class_id)
            WHERE eventbrite_ticket_class_id IS NOT NULL
          DO UPDATE SET
            ticket_type = EXCLUDED.ticket_type,
            price = EXCLUDED.price,
            currency = EXCLUDED.currency,
            quantity_available = EXCLUDED.quantity_available`,
      )
    }

    logger.info('Eventbrite event synced', { eventId, eventbriteId: event.eventbriteId })
    revalidatePath(`/dashboard/events/${eventId}`)
    revalidatePath('/dashboard/events')
    return { success: true }
  } catch (error) {
    logger.error('syncEventbriteEvent failed', { error, eventId })
    return { success: false, error: 'Failed to sync from Eventbrite' }
  }
}
