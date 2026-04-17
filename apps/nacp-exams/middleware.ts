import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const incomingRequestId = request.headers.get('x-request-id')
  const requestId = incomingRequestId && incomingRequestId.trim().length > 0
    ? incomingRequestId
    : crypto.randomUUID()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
