/**
 * Zonga — Eventbrite API Client.
 *
 * Typed wrapper around the Eventbrite v3 REST API.
 * Used by server actions to fetch events, ticket classes, and attendees
 * from a creator's connected Eventbrite account.
 */

import { logger } from '@/lib/logger'

const EVENTBRITE_API_BASE = 'https://www.eventbriteapi.com/v3'

/* ─── Eventbrite Response Types ─── */

export interface EventbriteOrganization {
  id: string
  name: string
  image_id: string | null
}

export interface EventbriteEvent {
  id: string
  name: { text: string; html: string }
  description: { text: string; html: string } | null
  url: string
  start: { timezone: string; local: string; utc: string }
  end: { timezone: string; local: string; utc: string }
  status: 'draft' | 'live' | 'started' | 'ended' | 'completed' | 'canceled'
  currency: string
  online_event: boolean
  venue_id: string | null
  venue?: EventbriteVenue | null
  logo?: { url: string } | null
  capacity: number | null
  category_id: string | null
}

export interface EventbriteVenue {
  id: string
  name: string | null
  address: {
    address_1: string | null
    city: string | null
    region: string | null
    country: string | null
  }
}

export interface EventbriteTicketClass {
  id: string
  name: string
  description: string | null
  cost: { currency: string; major_value: string; value: number } | null
  free: boolean
  quantity_total: number | null
  quantity_sold: number
  on_sale_status: 'AVAILABLE' | 'SOLD_OUT' | 'NOT_YET_ON_SALE' | 'UNAVAILABLE'
}

export interface EventbritePagination {
  object_count: number
  page_number: number
  page_size: number
  page_count: number
  has_more_items: boolean
}

export interface EventbriteListResponse<T> {
  pagination: EventbritePagination
  [key: string]: T[] | EventbritePagination | unknown
}

/* ─── Client ─── */

export class EventbriteClient {
  private readonly token: string

  constructor(accessToken: string) {
    this.token = accessToken
  }

  /* ── Core fetch wrapper ── */

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${EVENTBRITE_API_BASE}${path}`)
    const apiHost = new URL(EVENTBRITE_API_BASE).hostname
    if (url.hostname !== apiHost) {
      throw new Error('Invalid Eventbrite API path')
    }
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        url.searchParams.set(key, val)
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: controller.signal,
        next: { revalidate: 0 }, // no cache — always fresh
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        logger.error('Eventbrite API error', {
          status: res.status,
          path,
          body: body.slice(0, 500),
        })
        throw new EventbriteApiError(
          `Eventbrite API ${res.status}: ${res.statusText}`,
          res.status,
        )
      }

      return res.json() as Promise<T>
    } finally {
      clearTimeout(timeout)
    }
  }

  /* ── Organizations ── */

  async listOrganizations(): Promise<EventbriteOrganization[]> {
    const data = await this.request<{ organizations: EventbriteOrganization[] }>(
      '/users/me/organizations/',
    )
    return data.organizations
  }

  /* ── Events ── */

  async listEvents(
    orgId: string,
    opts: { status?: string; page?: number } = {},
  ): Promise<{ events: EventbriteEvent[]; pagination: EventbritePagination }> {
    const params: Record<string, string> = {
      expand: 'venue',
      order_by: 'start_desc',
    }
    if (opts.status) params.status = opts.status
    if (opts.page) params.page = String(opts.page)

    const data = await this.request<{
      events: EventbriteEvent[]
      pagination: EventbritePagination
    }>(`/organizations/${orgId}/events/`, params)

    return { events: data.events, pagination: data.pagination }
  }

  async getEvent(eventId: string): Promise<EventbriteEvent> {
    return this.request<EventbriteEvent>(`/events/${eventId}/`, { expand: 'venue' })
  }

  /* ── Ticket Classes ── */

  async listTicketClasses(eventId: string): Promise<EventbriteTicketClass[]> {
    const data = await this.request<{ ticket_classes: EventbriteTicketClass[] }>(
      `/events/${eventId}/ticket_classes/`,
    )
    return data.ticket_classes
  }

  /* ── Venue ── */

  async getVenue(venueId: string): Promise<EventbriteVenue> {
    return this.request<EventbriteVenue>(`/venues/${venueId}/`)
  }

  /* ── Token validation ── */

  async validateToken(): Promise<{ id: string; name: string; email: string }> {
    return this.request<{ id: string; name: string; email: string }>('/users/me/')
  }
}

/* ─── Error class ─── */

export class EventbriteApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'EventbriteApiError'
  }
}
