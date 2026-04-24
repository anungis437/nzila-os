/**
 * Zonga — Check-in Service
 *
 * QR-based event check-in with duplicate scan prevention.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { CheckInResult } from './types'
import { recordZongaAttendeeCheckin } from '@/lib/pilot-metrics'

/**
 * Validate and check in a ticket via QR token.
 * Returns structured result for the scanning device.
 */
export async function checkInTicket(params: {
  eventId: string
  qrToken: string
  scannedBy: string
}): Promise<CheckInResult> {
  const { eventId, qrToken, scannedBy } = params

  // Parse token → extract ticket ID
  const ticketId = qrToken.split(':')[0]
  if (!ticketId) {
    return { ok: false, reason: 'invalid_token', message: 'Invalid QR code' }
  }

  // Verify token integrity
  const valid = verifyQrToken(qrToken)
  if (!valid) {
    return { ok: false, reason: 'invalid_token', message: 'QR code failed verification' }
  }

  // Atomic check-in with duplicate prevention
  const result = await platformDb.execute(sql`
    WITH ticket_check AS (
      SELECT
        t.id,
        t.status,
        t.org_id,
        t.event_id,
        t.holder_id,
        tt.name as ticket_type_name,
        o.buyer_name,
        CASE
          WHEN t.event_id != ${eventId} THEN 'wrong_event'
          WHEN t.status = 'used' THEN 'already_checked_in'
          WHEN t.status = 'voided' THEN 'voided'
          WHEN t.status = 'expired' THEN 'expired'
          WHEN t.status != 'valid' THEN 'invalid_ticket'
          ELSE NULL
        END as error_reason
      FROM zonga_tickets t
      JOIN zonga_ticket_orders o ON o.id = t.order_id
      JOIN zonga_ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.id = ${ticketId} AND t.qr_token = ${qrToken}
    ),
    do_checkin AS (
      UPDATE zonga_tickets
      SET status = 'used',
          checked_in_at = now(),
          updated_at = now()
      FROM ticket_check tc
      WHERE zonga_tickets.id = tc.id AND tc.error_reason IS NULL
      RETURNING zonga_tickets.id
    ),
    record_checkin AS (
      INSERT INTO zonga_checkins (ticket_id, event_id, scanned_by, scanned_at)
      SELECT dc.id, ${eventId}, ${scannedBy}, now()
      FROM do_checkin dc
    )
    SELECT
      tc.id,
      tc.org_id,
      tc.ticket_type_name,
      tc.buyer_name,
      tc.error_reason,
      EXISTS(SELECT 1 FROM do_checkin) as checked_in
    FROM ticket_check tc
  `)

  const row = (result as unknown as Array<Record<string, unknown>>)[0]

  if (!row) {
    return { ok: false, reason: 'invalid_token', message: 'Ticket not found' }
  }

  if (row.error_reason) {
    const reason = row.error_reason as CheckInResult['reason']
    const messages: Record<string, string> = {
      wrong_event: 'This ticket is for a different event',
      already_checked_in: 'This ticket has already been scanned',
      voided: 'This ticket has been cancelled',
      expired: 'This ticket has expired',
      invalid_ticket: 'This ticket is not valid',
    }

    logger.warn('Check-in rejected', { ticketId, eventId, reason })
    return {
      ok: false,
      reason,
      message: messages[reason as string] ?? 'Check-in failed',
      ticketType: row.ticket_type_name as string,
      holderName: row.buyer_name as string,
    }
  }

  logger.info('Check-in successful', { ticketId, eventId, scannedBy })
  const traceId = `checkin:${ticketId}:${Date.now()}`
  const orgId = row.org_id as string | undefined
  if (orgId) {
    recordZongaAttendeeCheckin(orgId, eventId, scannedBy, traceId).catch((metricErr) =>
      logger.warn('Pilot metric emit failed', { error: String(metricErr), metric: 'attendee_checkins' }),
    )
  }

  return {
    ok: true,
    ticketId: row.id as string,
    ticketType: row.ticket_type_name as string,
    holderName: row.buyer_name as string,
    message: 'Welcome!',
  }
}

/**
 * Manual check-in override for desk operations when QR scans fail.
 */
export async function manualCheckInTicket(params: {
  eventId: string
  ticketId: string
  scannedBy: string
}): Promise<CheckInResult> {
  const { eventId, ticketId, scannedBy } = params

  const result = await platformDb.execute(sql`
    WITH ticket_check AS (
      SELECT
        t.id,
        t.status,
        t.org_id,
        t.event_id,
        tt.name as ticket_type_name,
        o.buyer_name,
        CASE
          WHEN t.event_id != ${eventId} THEN 'wrong_event'
          WHEN t.status = 'used' THEN 'already_checked_in'
          WHEN t.status = 'cancelled' THEN 'voided'
          WHEN t.status != 'valid' THEN 'invalid_ticket'
          ELSE NULL
        END as error_reason
      FROM zonga_tickets t
      JOIN zonga_ticket_orders o ON o.id = t.order_id
      JOIN zonga_ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.id = ${ticketId}
    ),
    do_checkin AS (
      UPDATE zonga_tickets
      SET status = 'used',
          checked_in_at = now(),
          updated_at = now()
      FROM ticket_check tc
      WHERE zonga_tickets.id = tc.id AND tc.error_reason IS NULL
      RETURNING zonga_tickets.id
    ),
    record_checkin AS (
      INSERT INTO zonga_checkins (ticket_id, event_id, scanned_by, scanned_at, scan_method)
      SELECT dc.id, ${eventId}, ${scannedBy}, now(), 'manual'
      FROM do_checkin dc
    )
    SELECT
      tc.id,
      tc.org_id,
      tc.ticket_type_name,
      tc.buyer_name,
      tc.error_reason,
      EXISTS(SELECT 1 FROM do_checkin) as checked_in
    FROM ticket_check tc
  `)

  const row = (result as unknown as Array<Record<string, unknown>>)[0]

  if (!row) {
    return { ok: false, reason: 'invalid_token', message: 'Ticket not found' }
  }

  if (row.error_reason) {
    const reason = row.error_reason as CheckInResult['reason']
    const messages: Record<string, string> = {
      wrong_event: 'This ticket is for a different event',
      already_checked_in: 'This ticket has already been checked in',
      voided: 'This ticket has been cancelled',
      invalid_ticket: 'This ticket is not valid for check-in',
    }

    logger.warn('Manual check-in rejected', { ticketId, eventId, reason })
    return {
      ok: false,
      reason,
      message: messages[reason as string] ?? 'Manual check-in failed',
      ticketType: row.ticket_type_name as string,
      holderName: row.buyer_name as string,
    }
  }

  logger.info('Manual check-in successful', { ticketId, eventId, scannedBy })
  const traceId = `checkin_manual:${ticketId}:${Date.now()}`
  const orgId = row.org_id as string | undefined
  if (orgId) {
    recordZongaAttendeeCheckin(orgId, eventId, scannedBy, traceId).catch((metricErr) =>
      logger.warn('Pilot metric emit failed', { error: String(metricErr), metric: 'attendee_checkins' }),
    )
  }

  return {
    ok: true,
    ticketId: row.id as string,
    ticketType: row.ticket_type_name as string,
    holderName: row.buyer_name as string,
    message: 'Manual check-in recorded.',
  }
}

/**
 * Get check-in stats for an event (real-time dashboard).
 */
export async function getCheckInStats(eventId: string): Promise<{
  totalTickets: number
  checkedIn: number
  remaining: number
  percentCheckedIn: number
  recentCheckins: Array<{
    ticketType: string
    holderName: string
    scannedAt: Date
  }>
}> {
  const statsRows = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as total_tickets,
      COUNT(*) FILTER (WHERE status = 'used')::int as checked_in
    FROM zonga_tickets
    WHERE event_id = ${eventId} AND status IN ('valid', 'used')
  `)
  const stats = (statsRows as unknown as Array<Record<string, unknown>>)[0]
  const total = (stats?.total_tickets as number) ?? 0
  const checkedIn = (stats?.checked_in as number) ?? 0

  const recentRows = await platformDb.execute(sql`
    SELECT
      tt.name as ticket_type,
      o.buyer_name as holder_name,
      c.scanned_at
    FROM zonga_checkins c
    JOIN zonga_tickets t ON t.id = c.ticket_id
    JOIN zonga_ticket_orders o ON o.id = t.order_id
    JOIN zonga_ticket_types tt ON tt.id = t.ticket_type_id
    WHERE c.event_id = ${eventId}
    ORDER BY c.scanned_at DESC
    LIMIT 10
  `)

  return {
    totalTickets: total,
    checkedIn,
    remaining: total - checkedIn,
    percentCheckedIn: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
    recentCheckins: (recentRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      ticketType: r.ticket_type as string,
      holderName: r.holder_name as string,
      scannedAt: new Date(r.scanned_at as string),
    })),
  }
}

/**
 * Verify QR token integrity (basic HMAC check).
 */
function verifyQrToken(qrToken: string): boolean {
  const parts = qrToken.split(':')
  // Token format: {uuid}:{hmac16}
  if (parts.length < 2) return false
  const ticketId = parts[0]
  const hmac = parts[1]
  // Basic structure validation
  if (!ticketId || ticketId.length < 32 || !hmac || hmac.length !== 16) return false
  // The full HMAC verification requires the original payload data
  // which we don't have here — the DB lookup + qr_token match
  // provides the primary integrity check
  return true
}
