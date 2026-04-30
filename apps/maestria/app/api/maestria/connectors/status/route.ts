import { NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'
import { getConnectorOperationalSnapshot } from '@/lib/maestria-connectors'
import { type ConnectorSystem } from '@/lib/connector-stubs'

const SYSTEMS: ConnectorSystem[] = ['shopify', 'google-ads', 'zoho']

export async function GET(request: Request) {
  const url = new URL(request.url)
  const auth = authorize(Object.fromEntries(url.searchParams), 'shopify.view', 'connectors.status.read', 'connector:status')
  if (auth.response) return auth.response

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
