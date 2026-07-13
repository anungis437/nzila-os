/**
 * SAGE Phase 8A — recipient acknowledgment API
 *
 * POST /api/delivery/[grantId]/acknowledge
 * Header: X-Delivery-Session: <session token from claim>
 *
 * Explicit, idempotent delivery acknowledgment — separate from download.
 */
import { NextRequest } from 'next/server'
import { acknowledgeRecipientDelivery } from '@/lib/sage/delivery-service'
import { recipientJson } from '@/lib/sage/recipient-headers'
import { SageServiceError } from '@nzila/sage-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS: Record<string, number> = { FORBIDDEN: 403, CONFLICT: 409, INVALID_INPUT: 400, NOT_FOUND: 404 }

export async function POST(request: NextRequest, context: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await context.params
  const sessionToken = request.headers.get('X-Delivery-Session') ?? ''
  if (!sessionToken) {
    return recipientJson({ ok: false, error: { code: 'FORBIDDEN', message: 'A recipient session is required' } }, 403)
  }
  try {
    const result = await acknowledgeRecipientDelivery({ grantId, sessionToken })
    if (!result) {
      return recipientJson({ ok: false, error: { code: 'FORBIDDEN', message: 'Acknowledgment is not available' } }, 403)
    }
    return recipientJson({ ok: true, data: result })
  } catch (error) {
    if (error instanceof SageServiceError) {
      return recipientJson({ ok: false, error: { code: error.code, message: error.message } }, STATUS[error.code] ?? 500)
    }
    return recipientJson({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } }, 500)
  }
}
