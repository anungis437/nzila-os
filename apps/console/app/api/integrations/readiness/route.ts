import { NextRequest, NextResponse } from 'next/server'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listProviderDefinitions } from '@/lib/integrations-provider-catalog'
import { getAllProviderEnvReadiness } from '@/lib/integrations-env-readiness'
import { listIntegrationConnections } from '@/lib/integrations-connections'

export async function GET(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.integrations.readiness', {}, async () => {
      const orgId = req.nextUrl.searchParams.get('orgId')
      const envReadiness = getAllProviderEnvReadiness()
      const envByProvider = new Map(envReadiness.map((item) => [item.provider, item]))

      if (!orgId) {
        return NextResponse.json({
          providers: listProviderDefinitions().map((definition) => {
            const env = envByProvider.get(definition.key)
            return {
              provider: definition.key,
              displayName: definition.displayName,
              requiredSecrets: definition.requiredSecrets,
              configuredFromEnv: env?.configured ?? false,
              missingEnvVars: env?.missingEnvVars ?? [],
              connectedInStore: false,
            }
          }),
        })
      }

      const access = await requireOrgAccess(orgId)
      if (!access.ok) return access.response

      const connections = await listIntegrationConnections(orgId)
      const connectedProviders = new Set(connections.map((connection) => connection.provider))

      return NextResponse.json({
        providers: listProviderDefinitions().map((definition) => {
          const env = envByProvider.get(definition.key)
          return {
            provider: definition.key,
            displayName: definition.displayName,
            requiredSecrets: definition.requiredSecrets,
            configuredFromEnv: env?.configured ?? false,
            missingEnvVars: env?.missingEnvVars ?? [],
            connectedInStore: connectedProviders.has(definition.key),
          }
        }),
      })
    }),
  )
}
