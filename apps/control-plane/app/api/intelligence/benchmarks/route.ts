import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, requireAuditReadAuth, handleAuthError } from '@/lib/api-auth'
import { requireIntelligenceTier } from '@/lib/intelligence-access'
import { collectDecisionBenchmarks } from '@/lib/services/intelligence-service'

export async function GET(request: NextRequest) {
  try {
    if (request.headers.has('x-api-key')) {
      await requireApiAuth(request)
    }

    const auth = await requireAuditReadAuth(request)
    const tier = requireIntelligenceTier(request, 'enterprise')
    const orgId = request.nextUrl.searchParams.get('orgId')
    const decisionType = request.nextUrl.searchParams.get('decisionType')
    const domain = request.nextUrl.searchParams.get('domain')
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    if (!orgId || !decisionType || !domain) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'orgId, decisionType, and domain are required',
          },
        },
        { status: 400 },
      )
    }

    if (auth.role === 'auditor' && auth.organizationId !== orgId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'ORG_SCOPE_MISMATCH',
            message: 'Auditor token is scoped to another organization',
          },
        },
        { status: 403 },
      )
    }

    return NextResponse.json(
      await collectDecisionBenchmarks({ orgId, decisionType, domain, from, to, tier }),
    )
  } catch (error) {
    return handleAuthError(error)
  }
}
