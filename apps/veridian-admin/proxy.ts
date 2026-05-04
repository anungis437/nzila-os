/**
 * Veridian-admin edge proxy.
 *
 * Posture:
 *   - Internal admin portal for the synthetic Veridian network.
 *   - Stamps `x-request-id`, `x-demo-banner: internal-demo`, `x-phi-mode: disabled`.
 *   - Rejects PHI-bearing requests with HTTP 451 (same invariant as veridian-care).
 *   - Fail-CLOSED in production.
 *
 * Constraints:
 *   - Must NOT import `@nzila/platform-auth/entra/*` (Edge runtime node:crypto issue in ACA).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PHI_MARKER_HEADERS = ['x-phi-payload', 'x-contains-phi'] as const
const PUBLIC_PATHS = new Set(['/api/health', '/api/ready', '/api/version'])
const VALID_ACCESS_CONTEXT = 'veridian-synthetic-access'

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname)
}

export function proxy(request: NextRequest): NextResponse {
  try {
    const pathname = request.nextUrl.pathname

    if (!isPublicPath(pathname)) {
      const accessContext = request.headers.get('x-veridian-access-context')
      if (!accessContext) {
        return NextResponse.json(
          {
            error: 'ACCESS_CONTEXT_REQUIRED',
            code: 'PROTECTED_ROUTE_DENIED',
            message: 'Protected Veridian-admin routes require valid synthetic access context.',
          },
          { status: 403 },
        )
      }

      if (accessContext !== VALID_ACCESS_CONTEXT) {
        return NextResponse.json(
          {
            error: 'ACCESS_CONTEXT_INVALID',
            code: 'PROTECTED_ROUTE_DENIED',
            message: 'Protected Veridian-admin routes require valid synthetic access context.',
          },
          { status: 403 },
        )
      }
    }

    for (const h of PHI_MARKER_HEADERS) {
      const v = request.headers.get(h)
      if (v && v.toLowerCase() === 'true') {
        return NextResponse.json(
          {
            error: 'PHI_REJECTED',
            code: 'NO_PHI_ENVIRONMENT',
            message: 'Veridian-admin synthetic demo does not accept PHI-bearing payloads.',
          },
          { status: 451 },
        )
      }
    }

    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    const response = NextResponse.next()
    response.headers.set('x-request-id', requestId)
    response.headers.set('x-demo-banner', 'internal-demo')
    response.headers.set('x-phi-mode', 'disabled')
    return response
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[veridian-admin/proxy] middleware failure', err)
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
