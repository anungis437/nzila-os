import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { type ConnectorSystem } from '@/lib/connector-stubs'
import { buildConnectorAuthUrl, getConnectorOperationalSnapshot } from '@/lib/maestria-connectors'
import { recordOperationalEvent } from '@/lib/maestria-analytics'
import type { Permission } from '@/lib/access-control'

const permissionMap: Record<ConnectorSystem, Permission> = {
  shopify: 'shopify.view',
  'google-ads': 'ads.view',
  zoho: 'crm.view',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ system: string }> },
) {
  const { system } = await params
  if (!(system in permissionMap)) {
    return NextResponse.json({ ok: false, error: 'unknown_connector' }, { status: 404 })
  }

  const connectorSystem = system as ConnectorSystem
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(
    searchParams,
    permissionMap[connectorSystem],
    `${connectorSystem}.sync.read`,
    `connector:${connectorSystem}`,
  )
  if (auth.response) return auth.response

  const snapshot = getConnectorOperationalSnapshot(connectorSystem)

  return NextResponse.json({
    ok: true,
    requestedBy: auth.actor.displayName,
    role: auth.actor.role,
    connector: snapshot,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ system: string }> },
) {
  const { system } = await params
  if (!(system in permissionMap)) {
    return NextResponse.json({ ok: false, error: 'unknown_connector' }, { status: 404 })
  }

  const connectorSystem = system as ConnectorSystem
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(
    searchParams,
    permissionMap[connectorSystem],
    `${connectorSystem}.sync.write`,
    `connector:${connectorSystem}`,
  )
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const payload = (body ?? {}) as Record<string, unknown>
  const action = payload.action
  if (action !== 'start_auth') {
    return NextResponse.json({ ok: false, error: 'unsupported_action', supported: ['start_auth'] }, { status: 400 })
  }

  const flow = buildConnectorAuthUrl(connectorSystem, auth.actor.id)
  recordOperationalEvent({
    eventName: `connector.${connectorSystem}.auth_started`,
    value: 1,
    unit: 'count',
    source: 'maestria.connector',
    dimensions: { actor: auth.actor.id, role: auth.actor.role },
  })

  return NextResponse.json({
    ok: true,
    action,
    connector: connectorSystem,
    authFlow: flow,
  }, { status: 202 })
}
