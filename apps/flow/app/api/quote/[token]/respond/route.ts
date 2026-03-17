/**
 * ShopMoiCa — Quote Response API
 *
 * Handles customer quote acceptance and revision requests via share link token.
 * No authentication required — access controlled by token validation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { processQuoteApproval } from '@/lib/services/quote-approval-service'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Extract client IP for audit hashing
  const forwarded = request.headers.get('x-forwarded-for')
  const clientIp = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? undefined

  const result = await processQuoteApproval(token, body, clientIp)

  if (!result.ok) {
    logger.warn('Quote approval failed', { error: result.error })
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    action: result.action,
    message:
      result.action === 'ACCEPT'
        ? 'Quote accepted successfully'
        : 'Revision request submitted',
  })
}
