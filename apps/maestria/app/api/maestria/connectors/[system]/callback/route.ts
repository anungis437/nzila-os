import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { completeConnectorAuth } from '@/lib/maestria-connectors'
import { type ConnectorSystem } from '@/lib/connector-stubs'

function isConnectorSystem(input: string): input is ConnectorSystem {
  return input === 'shopify' || input === 'google-ads' || input === 'zoho'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ system: string }> },
) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'module.internal.view', 'connector.auth.callback', 'connector:oauth-callback')
  if (auth.response) return auth.response

  const { system } = await params
  if (!isConnectorSystem(system)) {
    return NextResponse.json({ ok: false, error: 'unknown_connector' }, { status: 404 })
  }

  const state = request.nextUrl.searchParams.get('state')
  const code = request.nextUrl.searchParams.get('code')
  if (!state || !code) {
    return NextResponse.json({ ok: false, error: 'missing_state_or_code' }, { status: 400 })
  }

  const result = completeConnectorAuth(system, state, code)
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json({ ok: true, account: result.account })
}
