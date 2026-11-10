import { NextRequest, NextResponse } from 'next/server'
import { completeOidcSignIn } from '@/lib/sso/oidc-runtime'
import { clientAddress } from '@/lib/public-intake/guard'
import { checkRateLimit, createRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(`sso-callback:${clientAddress(request)}`, RATE_LIMITS.AUTH)
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: createRateLimitHeaders(rate) })
  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  if (!state || !code || state.length > 200 || code.length > 4096) return NextResponse.json({ error: 'Invalid SSO callback' }, { status: 400 })
  try {
    const result = await completeOidcSignIn({
      state,
      code,
      ipAddress: clientAddress(request),
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.redirect(new URL(result.returnPath, request.nextUrl.origin), 303)
  } catch {
    return NextResponse.json({ error: 'SSO sign-in could not be completed' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
}
