import { NextRequest, NextResponse } from 'next/server'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listProviderDefinitions } from '@/lib/integrations-provider-catalog'
import { getIntegrationConnection, validateStoredConnection } from '@/lib/integrations-connections'
import { computeSlaSummary } from '@/lib/integrations-runtime-store'
import { recordAuditEvent } from '@/lib/audit-db'

export async function GET(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.integrations.sla', {}, async () => {
      const orgId = req.nextUrl.searchParams.get('orgId')
      if (!orgId) {
        const results = listProviderDefinitions().map((definition) => ({
          provider: definition.key,
          displayName: definition.displayName,
          availability: 0,
          availabilityTarget: 0.99,
          p95LatencyMs: 0,
          p95LatencyTarget: 5000,
          errorRate: 1,
          sentCount: 0,
          failureCount: 0,
          availabilityMet: false,
          latencyMet: false,
          compliant: false,
          status: 'no_data' as const,
        }))
        return NextResponse.json({ results })
      }

      const access = await requireOrgAccess(orgId)
      if (!access.ok) return access.response

      const emitAudit = req.nextUrl.searchParams.get('emitAudit') === '1'
      const runtimeByProvider = await computeSlaSummary(orgId)
      const runtimeMap = new Map(runtimeByProvider.map((row) => [row.provider, row]))

      const results = await Promise.all(
        listProviderDefinitions().map(async (definition) => {
          const connection = await getIntegrationConnection(orgId, definition.key)
          if (!connection) {
            return {
              provider: definition.key,
              displayName: definition.displayName,
              availability: 0,
              availabilityTarget: 0.99,
              p95LatencyMs: 0,
              p95LatencyTarget: 5000,
              errorRate: 1,
              sentCount: 0,
              failureCount: 0,
              availabilityMet: false,
              latencyMet: false,
              compliant: false,
              status: 'no_data' as const,
            }
          }

          const validation = await validateStoredConnection(orgId, definition.key)
          const runtime = runtimeMap.get(definition.key)
          const available = runtime?.availability ?? (validation.ok ? 1 : 0)
          const sentCount = runtime?.sentCount ?? 0
          const failureCount = runtime?.failureCount ?? (validation.ok ? 0 : 1)
          const errorRate = runtime?.errorRate ?? (validation.ok ? 0 : 1)
          return {
            provider: definition.key,
            displayName: definition.displayName,
            availability: available,
            availabilityTarget: 0.99,
            p95LatencyMs: 0,
            p95LatencyTarget: 5000,
            errorRate,
            sentCount,
            failureCount,
            availabilityMet: available >= 0.99,
            latencyMet: true,
            compliant: available >= 0.99,
            status: available >= 0.99 ? ('compliant' as const) : ('breached' as const),
          }
        }),
      )

      if (emitAudit) {
        const breached = results.filter((result) => result.status === 'breached').map((result) => result.provider)
        if (breached.length > 0) {
          await recordAuditEvent({
            orgId,
            targetType: 'integration_sla',
            targetId: orgId,
            action: 'integration.sla.breach',
            actorClerkUserId: access.context.userId,
            afterJson: { breachedProviders: breached, breachedCount: breached.length },
          })
        }
      }

      return NextResponse.json({ results })
    }),
  )
}
