/**
 * Zonga — Ticket Service
 *
 * Handles ticket purchases with inventory locking,
 * order confirmation, and QR token generation.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { randomUUID, createHash } from 'node:crypto'
import { logger } from '@/lib/logger'
import { TICKET_PLATFORM_FEE_PCT } from './types'
import type { TicketOrderFull, IndividualTicket } from './types'

export interface PurchaseTicketParams {
  eventId: string
  ticketTypeId: string
  quantity: number
  buyerId: string
  buyerName: string
  buyerEmail: string
}

export interface PurchaseResult {
  ok: boolean
  orderId?: string
  tickets?: IndividualTicket[]
  error?: string
}

/**
 * Purchase tickets with inventory locking.
 * Uses SELECT FOR UPDATE to prevent overselling.
 */
export async function purchaseTickets(params: PurchaseTicketParams): Promise<PurchaseResult> {
  const { eventId, ticketTypeId, quantity, buyerId, buyerName, buyerEmail } = params

  if (quantity < 1 || quantity > 20) {
    return { ok: false, error: 'Quantity must be between 1 and 20' }
  }

  try {
    // Atomically reserve inventory and create order
    const result = await platformDb.execute(sql`
      WITH event_org AS (
        SELECT org_id FROM zonga_events WHERE id = ${eventId}
      ),
      ticket_lock AS (
        SELECT
          tt.id, tt.price, tt.currency, tt.quantity_total, tt.quantity_sold, tt.quantity_reserved, tt.max_per_order, tt.is_active,
          tt.sale_starts_at, tt.sale_ends_at, eo.org_id
        FROM zonga_ticket_types tt
        JOIN event_org eo ON tt.org_id = eo.org_id
        WHERE tt.id = ${ticketTypeId}
          AND tt.event_id = ${eventId}
        FOR UPDATE OF tt
      ),
      validation AS (
        SELECT
          *,
          CASE
            WHEN NOT is_active THEN 'Ticket type is not available'
            WHEN ${quantity} > max_per_order THEN 'Exceeds maximum per order'
            WHEN (quantity_sold + quantity_reserved + ${quantity}) > quantity_total THEN 'Not enough tickets available'
            WHEN sale_starts_at IS NOT NULL AND now() < sale_starts_at THEN 'Sale has not started'
            WHEN sale_ends_at IS NOT NULL AND now() > sale_ends_at THEN 'Sale has ended'
            ELSE NULL
          END as error_msg
        FROM ticket_lock
      ),
      inventory_update AS (
        UPDATE zonga_ticket_types
        SET quantity_sold = quantity_sold + ${quantity},
            updated_at = now()
        FROM validation
        WHERE zonga_ticket_types.id = validation.id
          AND validation.error_msg IS NULL
        RETURNING zonga_ticket_types.id, validation.price, validation.currency
      ),
      order_insert AS (
        INSERT INTO zonga_ticket_orders (
          event_id, org_id, ticket_type_id,
          buyer_id, buyer_name, buyer_email,
          quantity, unit_price, total_amount, platform_fee, currency,
          status
        )
        SELECT
          ${eventId}, org_id, ${ticketTypeId},
          ${buyerId}, ${buyerName}, ${buyerEmail},
          ${quantity},
          price,
          price * ${quantity},
          (price * ${quantity} * ${TICKET_PLATFORM_FEE_PCT} / 100.0),
          currency,
          'confirmed'
        FROM inventory_update
        RETURNING id, total_amount, platform_fee, currency
      )
      SELECT
        COALESCE(
          (SELECT json_build_object(
            'ok', true,
            'order_id', oi.id,
            'total', oi.total_amount,
            'fee', oi.platform_fee,
            'currency', oi.currency
          ) FROM order_insert oi),
          (SELECT json_build_object(
            'ok', false,
            'error', COALESCE(v.error_msg, 'Ticket type not found')
          ) FROM validation v)
        ) as result
    `)

    const row = (result as unknown as Array<{ result: Record<string, unknown> }>)[0]
    if (!row?.result) return { ok: false, error: 'Transaction failed' }

    const txResult = typeof row.result === 'string' ? JSON.parse(row.result) : row.result

    if (!txResult.ok) {
      return { ok: false, error: txResult.error as string }
    }

    const orderId = txResult.order_id as string

    // Generate individual tickets with QR tokens
    const tickets = await generateTickets(orderId, eventId, ticketTypeId, quantity, buyerId)

    logger.info('Tickets purchased', {
      orderId,
      eventId,
      quantity,
      total: txResult.total,
      buyerId,
    })

    return { ok: true, orderId, tickets }
  } catch (error) {
    logger.error('Ticket purchase failed', { error, eventId, ticketTypeId })
    return { ok: false, error: 'Purchase failed — please try again' }
  }
}

/**
 * Generate individual ticket records with unique QR tokens.
 */
async function generateTickets(
  orderId: string,
  eventId: string,
  ticketTypeId: string,
  quantity: number,
  holderId: string,
): Promise<IndividualTicket[]> {
  const tickets: IndividualTicket[] = []

  for (let i = 0; i < quantity; i++) {
    const ticketId = randomUUID()
    const qrToken = generateQrToken(ticketId, eventId, i)

    await platformDb.execute(sql`
      INSERT INTO zonga_tickets (id, order_id, event_id, ticket_type_id, holder_id, qr_token, status)
      VALUES (${ticketId}, ${orderId}, ${eventId}, ${ticketTypeId}, ${holderId}, ${qrToken}, 'valid')
    `)

    tickets.push({
      id: ticketId,
      orderId,
      eventId,
      ticketTypeId,
      holderId,
      qrToken,
      status: 'valid',
      createdAt: new Date(),
    })
  }

  return tickets
}

/**
 * Generate a tamper-resistant QR token for a ticket.
 * Format: {ticketId}:{hmac}
 */
function generateQrToken(ticketId: string, eventId: string, index: number): string {
  const secret = process.env.ZONGA_TICKET_HMAC_SECRET ?? 'zonga-ticket-secret'
  const payload = `${ticketId}:${eventId}:${index}:${Date.now()}`
  const hmac = createHash('sha256')
    .update(`${secret}:${payload}`)
    .digest('hex')
    .substring(0, 16)
  return `${ticketId}:${hmac}`
}

/**
 * Get a full ticket order with individual tickets.
 */
export async function getOrderFull(orderId: string, orgId: string): Promise<TicketOrderFull | null> {
  const orderRows = await platformDb.execute(sql`
    SELECT o.*, tt.name as ticket_type_name
    FROM zonga_ticket_orders o
    JOIN zonga_ticket_types tt ON tt.id = o.ticket_type_id
    WHERE o.id = ${orderId} AND o.org_id = ${orgId}
  `)
  const order = (orderRows as unknown as Array<Record<string, unknown>>)[0]
  if (!order) return null

  const ticketRows = await platformDb.execute(sql`
    SELECT * FROM zonga_tickets WHERE order_id = ${orderId} ORDER BY created_at
  `)

  return {
    id: order.id as string,
    eventId: order.event_id as string,
    ticketTypeName: order.ticket_type_name as string,
    buyerId: order.buyer_id as string,
    buyerName: order.buyer_name as string,
    buyerEmail: order.buyer_email as string,
    quantity: order.quantity as number,
    unitPrice: Number(order.unit_price),
    totalAmount: Number(order.total_amount),
    platformFee: Number(order.platform_fee),
    currency: order.currency as string,
    status: order.status as TicketOrderFull['status'],
    tickets: (ticketRows as unknown as Array<Record<string, unknown>>).map((t) => ({
      id: t.id as string,
      orderId: t.order_id as string,
      eventId: t.event_id as string,
      ticketTypeId: t.ticket_type_id as string,
      holderId: t.holder_id as string,
      qrToken: t.qr_token as string,
      status: t.status as IndividualTicket['status'],
      checkedInAt: t.checked_in_at ? new Date(t.checked_in_at as string) : undefined,
      createdAt: new Date(t.created_at as string),
    })),
    createdAt: new Date(order.created_at as string),
  }
}

/**
 * Get a listener's own order by buyer ID (no org required).
 */
export async function getMyOrder(orderId: string, buyerId: string): Promise<TicketOrderFull | null> {
  const orderRows = await platformDb.execute(sql`
    SELECT o.*, tt.name as ticket_type_name
    FROM zonga_ticket_orders o
    JOIN zonga_ticket_types tt ON tt.id = o.ticket_type_id
    WHERE o.id = ${orderId} AND o.buyer_id = ${buyerId}
  `)
  const order = (orderRows as unknown as Array<Record<string, unknown>>)[0]
  if (!order) return null

  const ticketRows = await platformDb.execute(sql`
    SELECT * FROM zonga_tickets WHERE order_id = ${orderId} ORDER BY created_at
  `)

  return {
    id: order.id as string,
    eventId: order.event_id as string,
    ticketTypeName: order.ticket_type_name as string,
    buyerId: order.buyer_id as string,
    buyerName: order.buyer_name as string,
    buyerEmail: order.buyer_email as string,
    quantity: order.quantity as number,
    unitPrice: Number(order.unit_price),
    totalAmount: Number(order.total_amount),
    platformFee: Number(order.platform_fee),
    currency: order.currency as string,
    status: order.status as TicketOrderFull['status'],
    tickets: (ticketRows as unknown as Array<Record<string, unknown>>).map((t) => ({
      id: t.id as string,
      orderId: t.order_id as string,
      eventId: t.event_id as string,
      ticketTypeId: t.ticket_type_id as string,
      holderId: t.holder_id as string,
      qrToken: t.qr_token as string,
      status: t.status as IndividualTicket['status'],
      checkedInAt: t.checked_in_at ? new Date(t.checked_in_at as string) : undefined,
      createdAt: new Date(t.created_at as string),
    })),
    createdAt: new Date(order.created_at as string),
  }
}

/**
 * Cancel a ticket order and release inventory (organizer-side).
 */
export async function cancelOrder(orderId: string, orgId: string): Promise<{ ok: boolean; error?: string }> {
  return cancelOrderByFilter(sql`id = ${orderId} AND org_id = ${orgId}`)
}

/**
 * Cancel a listener's own order (no org required).
 */
export async function cancelMyOrder(orderId: string, buyerId: string): Promise<{ ok: boolean; error?: string }> {
  return cancelOrderByFilter(sql`id = ${orderId} AND buyer_id = ${buyerId}`)
}

async function cancelOrderByFilter(whereClause: ReturnType<typeof sql>): Promise<{ ok: boolean; error?: string }> {
  const result = await platformDb.execute(sql`
    WITH order_info AS (
      SELECT id, ticket_type_id, quantity, status
      FROM zonga_ticket_orders
      WHERE ${whereClause}
      FOR UPDATE
    ),
    valid_cancel AS (
      SELECT * FROM order_info
      WHERE status IN ('pending', 'confirmed')
    ),
    refund_inventory AS (
      UPDATE zonga_ticket_types
      SET quantity_sold = GREATEST(quantity_sold - vc.quantity, 0),
          updated_at = now()
      FROM valid_cancel vc
      WHERE zonga_ticket_types.id = vc.ticket_type_id
    ),
    void_tickets AS (
      UPDATE zonga_tickets
      SET status = 'voided', updated_at = now()
      FROM valid_cancel vc
      WHERE zonga_tickets.order_id = vc.id
    ),
    cancel_order AS (
      UPDATE zonga_ticket_orders
      SET status = 'refunded', updated_at = now()
      FROM valid_cancel vc
      WHERE zonga_ticket_orders.id = vc.id
      RETURNING zonga_ticket_orders.id
    )
    SELECT EXISTS(SELECT 1 FROM cancel_order) as cancelled
  `)

  const cancelled = (result as unknown as Array<{ cancelled: boolean }>)[0]?.cancelled
  if (!cancelled) return { ok: false, error: 'Order not found or already cancelled' }

  logger.info('Order cancelled', { orderId: 'resolved' })
  return { ok: true }
}
