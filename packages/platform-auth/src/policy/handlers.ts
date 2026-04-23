/**
 * Method-discovery handler for the multi-mode login screen.
 *
 *   GET /api/auth/methods?email=…&organizationId=…
 *
 * Returns the policy-allowed sign-in methods for the given email/org. The
 * UI uses this to decide which buttons to render (password, magic link,
 * SSO). Never reveals whether a user exists in a way that aids enumeration:
 * `userExists` is a UX hint only and the request is rate-limit-bound at the
 * route layer in production.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthMethodAvailability } from './service'

export async function handleGetMethods(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const email = url.searchParams.get('email') ?? undefined
    const organizationId = url.searchParams.get('organizationId') ?? undefined
    const result = await getAuthMethodAvailability(email, organizationId)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
