/**
 * Nzila OS — Correlation ID Middleware
 *
 * Shared middleware for all Next.js apps in the control system.
 * Extracts, propagates, and generates correlation IDs on every request.
 *
 * Usage (in Next.js middleware.ts):
 *   import { correlationMiddleware } from '@nzila/platform-contracts/correlation'
 *   export const middleware = correlationMiddleware
 *
 * Headers:
 *   x-correlation-id — Stable ID for a logical operation spanning multiple services
 *   x-request-id     — Unique ID per HTTP request
 *   x-trace-id       — OpenTelemetry trace ID (when available)
 */

import { NextRequest, NextResponse } from 'next/server'

export function correlationMiddleware(request: NextRequest): NextResponse {
  const correlationId =
    request.headers.get('x-correlation-id') ?? crypto.randomUUID()
  const requestId =
    request.headers.get('x-request-id') ?? crypto.randomUUID()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-correlation-id', correlationId)
  requestHeaders.set('x-request-id', requestId)


  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('x-correlation-id', correlationId)
  response.headers.set('x-request-id', requestId)
  return response
}

/**
 * Extract correlation context from a NextRequest.
 */
export function getCorrelationContext(request: NextRequest) {
  return {
    correlationId: request.headers.get('x-correlation-id') ?? crypto.randomUUID(),
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
    traceId: request.headers.get('x-trace-id') ?? undefined,
  }
}
