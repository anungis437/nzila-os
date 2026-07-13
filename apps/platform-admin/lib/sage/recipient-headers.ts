/**
 * SAGE Phase 8A — recipient security headers (server-only helper)
 *
 * Applied to every recipient-facing response so an external recipient surface is
 * never cached, indexed, referrer-leaked, or MIME-sniffed.
 */
import 'server-only'
import { NextResponse } from 'next/server'

export function applyRecipientSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'private, no-store')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
  return res
}

export function recipientJson(body: unknown, status = 200): NextResponse {
  return applyRecipientSecurityHeaders(NextResponse.json(body, { status }))
}
