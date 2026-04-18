// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformRole, withRequestContext } from '@/lib/api-guards'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  return withRequestContext(request, async () => {
    const auth = await requirePlatformRole('platform_admin', 'studio_admin')
    if (!auth.ok) return auth.response

    const { runId } = await params
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(runId)) {
      return NextResponse.json({ error: 'invalid runId' }, { status: 400 })
    }
    const form = await request.formData()
    const orgId = String(form.get('orgId') ?? '')

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const endpointBase = process.env.ORCHESTRATOR_API_URL?.replace(/\/$/, '')
    if (!endpointBase) {
      return NextResponse.json({ error: 'ORCHESTRATOR_API_URL is not configured' }, { status: 500 })
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-org-id': orgId,
      'x-actor-id': auth.userId,
    }

    const apiKey = process.env.ORCHESTRATOR_API_KEY
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`
    }

    const response = await fetch(`${endpointBase}/execute/${runId}/retry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requestedBy: auth.userId }),
      cache: 'no-store',
    })

    const redirectTo = new URL('/operator/orchestrator', request.nextUrl.origin)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      redirectTo.searchParams.set('error', String(body?.error?.message ?? 'Retry failed'))
      return NextResponse.redirect(redirectTo)
    }

    redirectTo.searchParams.set('action', 'retried')
    return NextResponse.redirect(redirectTo)
  })
}
