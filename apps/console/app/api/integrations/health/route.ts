import { NextRequest, NextResponse } from 'next/server'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listProviderDefinitions } from '@/lib/integrations-provider-catalog'
import { getDecryptedProviderSecrets, getIntegrationConnection, validateStoredConnection } from '@/lib/integrations-connections'

export async function GET(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.integrations.health.list', {}, async () => {
      const orgId = req.nextUrl.searchParams.get('orgId')
      if (!orgId) {
        const providers = listProviderDefinitions().map((definition) => ({
          provider: definition.key,
          displayName: definition.displayName,
          status: 'down' as const,
          successRate: 0,
          avgLatencyMs: 0,
          consecutiveFailures: 0,
          circuitState: 'open' as const,
          lastCheckedAt: null,
          configured: false,
          details: 'orgId not supplied',
        }))
        return NextResponse.json({ providers })
      }

      const access = await requireOrgAccess(orgId)
      if (!access.ok) return access.response

      const providers = await Promise.all(
        listProviderDefinitions().map(async (definition) => {
          const connection = await getIntegrationConnection(orgId, definition.key)
          const secrets = await getDecryptedProviderSecrets(orgId, definition.key)

          if (!connection || !secrets) {
            return {
              provider: definition.key,
              displayName: definition.displayName,
              status: 'down' as const,
              successRate: 0,
              avgLatencyMs: 0,
              consecutiveFailures: 0,
              circuitState: 'open' as const,
              lastCheckedAt: null,
              configured: false,
              details: 'Not connected',
            }
          }

          const validation = await validateStoredConnection(orgId, definition.key)
          return {
            provider: definition.key,
            displayName: definition.displayName,
            status: validation.ok ? ('ok' as const) : ('degraded' as const),
            successRate: validation.ok ? 1 : 0,
            avgLatencyMs: 0,
            consecutiveFailures: validation.ok ? 0 : 1,
            circuitState: validation.ok ? ('closed' as const) : ('half-open' as const),
            lastCheckedAt: new Date().toISOString(),
            configured: true,
            details: validation.error ?? null,
          }
        }),
      )

      return NextResponse.json({ providers })
    }),
  )
}
