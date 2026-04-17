import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { createLogger } from '@nzila/os-core'
import { parseProviderKey, providerCatalog } from '@/lib/integrations-provider-catalog'
import { upsertIntegrationConnection } from '@/lib/integrations-connections'
import { recordIntegrationDelivery, recordIntegrationDlqEntry } from '@/lib/integrations-runtime-store'
import { recordAuditEvent } from '@/lib/audit-db'

const logger = createLogger('api:integrations:connect')

const ConnectRequestSchema = z.object({
  orgId: z.string().uuid(),
  provider: z.string().min(1),
  secrets: z.record(z.string()),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.integrations.connect', {}, async () => {
      const parsed = ConnectRequestSchema.safeParse(await req.json())
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      }

      const { orgId, provider: providerRaw, secrets, metadata } = parsed.data
      const access = await requireOrgAccess(orgId, { minRole: 'org_admin' })
      if (!access.ok) return access.response

      const provider = parseProviderKey(providerRaw)
      const definition = providerCatalog[provider]

      const testResult = await definition.testConnection(secrets)
      const status = testResult.ok ? 'connected' : 'error'

      const delivery = await recordIntegrationDelivery({
        orgId,
        provider,
        recipient: 'provider_connection_probe',
        status: testResult.ok ? 'sent' : 'failed',
        attempts: 1,
        maxAttempts: 1,
        payloadJson: { provider, operation: 'connect' },
        errorMessage: testResult.error ?? null,
      })

      if (!testResult.ok) {
        await recordIntegrationDlqEntry({
          orgId,
          provider,
          eventType: 'provider_connect',
          retryCount: 1,
          lastError: testResult.error ?? 'Connection test failed',
          deliveryId: delivery.id,
          payloadJson: { provider },
        })
      }

      const connection = await upsertIntegrationConnection({
        orgId,
        provider,
        secrets,
        status,
        lastValidationOk: testResult.ok,
        lastValidationError: testResult.error ?? null,
        actorUserId: access.context.userId,
        metadata: metadata as Record<string, unknown> | undefined,
      })

      logger.info('Integration connect attempted', {
        orgId,
        provider,
        ok: testResult.ok,
      })

      await recordAuditEvent({
        orgId,
        targetType: 'integration_connection',
        targetId: connection.id,
        action: testResult.ok ? 'integration.connect.success' : 'integration.connect.failed',
        actorClerkUserId: access.context.userId,
        afterJson: {
          provider,
          connectionId: connection.id,
          deliveryId: delivery.id,
          ok: testResult.ok,
          error: testResult.error ?? null,
        },
      })

      return NextResponse.json(
        {
          ok: testResult.ok,
          provider,
          requiredSecrets: definition.requiredSecrets,
          connection,
          delivery,
          test: testResult,
        },
        { status: testResult.ok ? 200 : 422 },
      )
    }),
  )
}
