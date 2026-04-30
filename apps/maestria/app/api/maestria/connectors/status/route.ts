import { NextResponse } from 'next/server'
import { resolveActor, hasPermission } from '@/lib/access-control'
import { getConnectorOperationalSnapshot } from '@/lib/maestria-connectors'
import { type ConnectorSystem } from '@/lib/connector-stubs'

const SYSTEMS: ConnectorSystem[] = ['shopify', 'google-ads', 'zoho']

export async function GET(request: Request) {
  const url = new URL(request.url)
  const actor = resolveActor(Object.fromEntries(url.searchParams))
  if (!hasPermission(actor, 'shopify.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const systems = SYSTEMS.map((system) => ({
    ...getConnectorOperationalSnapshot(system),
  }))

  const connected = systems.filter((s) => s.account.status === 'connected').length
  const degraded = systems.filter((s) => s.connector.status === 'degraded').length

  return NextResponse.json({
    total: SYSTEMS.length,
    connected,
    degraded,
    healthy: connected - degraded,
    systems,
    retrievedAt: new Date().toISOString(),
  })
}
