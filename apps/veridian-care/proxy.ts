/**
 * Veridian-care edge proxy.
 *
 * Posture:
 *   - Synthetic-demo healthcare portal. NO real PHI permitted.
 *   - Stamps `x-request-id`, `x-demo-banner: synthetic-demo`, `x-phi-mode: disabled`.
 *   - Rejects requests that obviously contain PHI markers (header `x-phi-payload: true`
 *     or `x-contains-phi: true`) with HTTP 451 to enforce no-PHI invariant at the edge.
 *   - Fail-CLOSED in production (any uncaught error → 503).
 *
 * Constraints:
 *   - Must NOT import `@nzila/platform-auth/entra/*` (Edge runtime node:crypto issue in ACA).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PHI_MARKER_HEADERS = ['x-phi-payload', 'x-contains-phi'] as const

export function proxy(request: NextRequest): NextResponse {
  try {
    for (const h of PHI_MARKER_HEADERS) {
      const v = request.headers.get(h)
      if (v && v.toLowerCase() === 'true') {
        return NextResponse.json(
          {
            error: 'PHI_REJECTED',
            code: 'NO_PHI_ENVIRONMENT',
            message: 'Veridian-care synthetic demo does not accept PHI-bearing payloads.',
          },
          { status: 451 },
        )
      }
    }

    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    const response = NextResponse.next()
    response.headers.set('x-request-id', requestId)
    response.headers.set('x-demo-banner', 'synthetic-demo')
    response.headers.set('x-phi-mode', 'disabled')
    return response
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[veridian-care/proxy] middleware failure', err)
      return NextResponse.next()
    }
    return NextResponse.json(
      { error: 'MIDDLEWARE_FAILURE', code: 'EDGE_GUARD' },
      { status: 503 },
    )
  }
}

export default proxy

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf)$).*)'],
}
