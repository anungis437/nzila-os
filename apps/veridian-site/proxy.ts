/**
 * Veridian-site edge proxy.
 *
 * Posture:
 *   - Public marketing site, no auth required at the edge.
 *   - Stamps `x-request-id` for tracing.
 *   - Stamps `x-demo-banner: synthetic-demo` so downstream / observers can detect demo posture.
 *   - Fail-CLOSED in production (any uncaught error → 503) per P0 governance.
 *
 * Constraints:
 *   - Must NOT import `@nzila/platform-auth/entra/*` (node:crypto unavailable on Edge runtime
 *     in Azure Container Apps — see user memory: edge node:crypto incident).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest): NextResponse {
  try {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    const response = NextResponse.next()
    response.headers.set('x-request-id', requestId)
    response.headers.set('x-demo-banner', 'synthetic-demo')
    return response
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[veridian-site/proxy] middleware failure', err)
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
