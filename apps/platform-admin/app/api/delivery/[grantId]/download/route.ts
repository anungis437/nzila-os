/**
 * SAGE Phase 8A — recipient download API
 *
 * POST /api/delivery/[grantId]/download
 * Header: X-Delivery-Session: <session token from claim>
 *
 * Grant-scoped, identity-bound, integrity-verified. Access is durably receipted
 * BEFORE any bytes stream. Returns the package bytes as an attachment with strict
 * security headers. Never returns a storage reference or workspace metadata.
 */
import { NextRequest, NextResponse } from 'next/server'
import { authorizeRecipientDownload } from '@/lib/sage/delivery-service'
import { applyRecipientSecurityHeaders, recipientJson } from '@/lib/sage/recipient-headers'
import { SageServiceError } from '@nzila/sage-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS: Record<string, number> = { FORBIDDEN: 403, CONFLICT: 409, INVALID_INPUT: 400, RATE_LIMITED: 429, NOT_FOUND: 404, INTEGRITY_ERROR: 500 }

export async function POST(request: NextRequest, context: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await context.params
  const sessionToken = request.headers.get('X-Delivery-Session') ?? ''
  if (!sessionToken) {
    return recipientJson({ ok: false, error: { code: 'FORBIDDEN', message: 'A recipient session is required' } }, 403)
  }
  try {
    const result = await authorizeRecipientDownload({ grantId, sessionToken, intent: 'download' })
    if (!result) {
      return recipientJson({ ok: false, error: { code: 'FORBIDDEN', message: 'Access is not available' } }, 403)
    }
    const res = new NextResponse(result.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': result.mediaType,
        'Content-Disposition': `attachment; filename="sage-export-${grantId}.json"`,
      },
    })
    return applyRecipientSecurityHeaders(res)
  } catch (error) {
    if (error instanceof SageServiceError) {
      return recipientJson({ ok: false, error: { code: error.code, message: error.message } }, STATUS[error.code] ?? 500)
    }
    return recipientJson({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } }, 500)
  }
}
