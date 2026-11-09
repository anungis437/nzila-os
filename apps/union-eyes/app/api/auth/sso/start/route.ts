import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, createRateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limiter'
import { beginOidcSignIn } from '@/lib/sso/oidc-runtime'
import { clientAddress } from '@/lib/public-intake/guard'

export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const providerId = request.nextUrl.searchParams.get('providerId') ?? ''
  if (!UUID.test(providerId)) return NextResponse.json({ error: 'SSO provider is unavailable' }, { status: 404 })
  const rate = await checkRateLimit(`sso-start:${clientAddress(request)}`, RATE_LIMITS.AUTH)
  if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: createRateLimitHeaders(rate) })
  try {
    const target = await beginOidcSignIn({ providerId, returnPath: request.nextUrl.searchParams.get('returnPath') })
    return NextResponse.redirect(target, 303)
  } catch {
    return NextResponse.json({ error: 'SSO provider is unavailable' }, { status: 404 })
  }
}
