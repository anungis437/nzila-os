import { NextRequest, NextResponse } from 'next/server'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { parseProviderKey } from '@/lib/integrations-provider-catalog'
import { getIntegrationConnection, validateStoredConnection } from '@/lib/integrations-connections'

interface RouteProps {
  params: Promise<{ provider: string }>
}

export async function GET(req: NextRequest, props: RouteProps) {
  return withRequestContext(req, () =>
    withSpan('api.integrations.health.provider', {}, async () => {
      const orgId = req.nextUrl.searchParams.get('orgId')
      const { provider: rawProvider } = await props.params
      const provider = parseProviderKey(rawProvider)

      if (!orgId) {
        return NextResponse.json({
          provider,
          health: {
            status: 'down',
            consecutiveFailures: 0,
            circuitState: 'open',
            circuitOpenedAt: null,
            circuitNextRetryAt: null,
            lastCheckedAt: new Date().toISOString(),
            lastErrorCode: 'org_id_missing',
            lastErrorMessage: 'orgId not supplied',
          },
          metrics: {
            successRate: 0,
            p50LatencyMs: 0,
            p95LatencyMs: 0,
            p99LatencyMs: 0,
            sentCount: 0,
            failureCount: 0,
            rateLimitedCount: 0,
            timeoutCount: 0,
          },
        })
      }

      const access = await requireOrgAccess(orgId)
      if (!access.ok) return access.response

      const connection = await getIntegrationConnection(orgId, provider)

      if (!connection) {
        return NextResponse.json({ error: 'Provider not connected', provider }, { status: 404 })
      }

      const validation = await validateStoredConnection(orgId, provider)

      return NextResponse.json({
        provider,
        connection,
        health: {
          status: validation.ok ? 'ok' : 'degraded',
          consecutiveFailures: validation.ok ? 0 : 1,
          circuitState: validation.ok ? 'closed' : 'half_open',
          circuitOpenedAt: validation.ok ? null : new Date().toISOString(),
          circuitNextRetryAt: null,
          lastCheckedAt: new Date().toISOString(),
          lastErrorCode: validation.ok ? null : 'validation_failed',
          lastErrorMessage: validation.error ?? null,
        },
        metrics: {
          successRate: validation.ok ? 1 : 0,
          p50LatencyMs: 0,
          p95LatencyMs: 0,
          p99LatencyMs: 0,
          sentCount: 0,
          failureCount: validation.ok ? 0 : 1,
          rateLimitedCount: 0,
          timeoutCount: 0,
        },
      })
    }),
  )
}
