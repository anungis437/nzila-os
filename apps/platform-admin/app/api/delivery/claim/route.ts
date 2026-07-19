/**
 * SAGE Phase 8A — recipient invitation claim API
 *
 * POST /api/delivery/claim  { token, verifiedEmail }
 *
 * Recipient-facing (no org scope). Binds the recipient identity to the grant and
 * returns a grant-scoped session token (never the invitation token). Rate-limited
 * by a token-prefix key. The invitation token is read from the request body,
 * never from the URL/query/referrer.
 */
import { NextRequest } from 'next/server'
import { claimDeliveryInvitation } from '@/lib/sage/delivery-service'
import { ClaimDeliveryInvitationRequest } from '@/lib/sage/delivery-schemas'
import { recipientJson } from '@/lib/sage/recipient-headers'
import { SageServiceError } from '@nzila/sage-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS: Record<string, number> = { FORBIDDEN: 403, CONFLICT: 409, INVALID_INPUT: 400, RATE_LIMITED: 429, NOT_FOUND: 404 }

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return recipientJson({ ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, 400)
  }
  const parsed = ClaimDeliveryInvitationRequest.safeParse(body)
  if (!parsed.success) {
    return recipientJson({ ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid claim payload' } }, 400)
  }
  try {
    const result = await claimDeliveryInvitation({
      token: parsed.data.token,
      verifiedEmail: parsed.data.verifiedEmail,
      rateLimitKey: `claim:${parsed.data.token.slice(0, 8)}`,
    })
    return recipientJson({
      ok: true,
      data: {
        grantId: result.grantId,
        sessionToken: result.sessionToken,
        accessExpiresAt: result.accessExpiresAt,
        maxAccesses: result.maxAccesses,
        accessCount: result.accessCount,
      },
    })
  } catch (error) {
    if (error instanceof SageServiceError) {
      return recipientJson({ ok: false, error: { code: error.code, message: error.message } }, STATUS[error.code] ?? 500)
    }
    return recipientJson({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } }, 500)
  }
}
