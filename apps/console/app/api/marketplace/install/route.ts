/**
 * API — Marketplace Provider Install
 * POST /api/marketplace/install — install a provider from manifest
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'
import { withSpan } from '@nzila/os-core/telemetry'
import { createLogger } from '@nzila/os-core'
import { parseProviderKey, providerCatalog } from '@/lib/integrations-provider-catalog'
import { upsertIntegrationConnection } from '@/lib/integrations-connections'
import { recordIntegrationDelivery, recordIntegrationDlqEntry } from '@/lib/integrations-runtime-store'

const logger = createLogger('api:marketplace:install')

const InstallRequestSchema = z.object({
  providerId: z.string().min(1),
  orgId: z.string().min(1),
  secrets: z.record(z.string()),
})

export async function POST(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.marketplace.install', {}, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const body = await req.json()
      const parsed = InstallRequestSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      }

      const { providerId, orgId, secrets } = parsed.data
      const provider = parseProviderKey(providerId)
      const definition = providerCatalog[provider]

      const testResult = await definition.testConnection(secrets)
      const status = testResult.ok ? 'connected' : 'error'

      const delivery = await recordIntegrationDelivery({
        orgId,
        provider,
        recipient: 'marketplace_install_probe',
        status: testResult.ok ? 'sent' : 'failed',
        attempts: 1,
        maxAttempts: 1,
        payloadJson: { provider, operation: 'marketplace_install' },
        errorMessage: testResult.error ?? null,
      })

      if (!testResult.ok) {
        await recordIntegrationDlqEntry({
          orgId,
          provider,
          eventType: 'marketplace_install',
          retryCount: 1,
          lastError: testResult.error ?? 'Installation test failed',
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
        actorUserId: auth.userId,
      })

      if (!testResult.ok) {
        return NextResponse.json(
          {
            ok: false,
            provider,
            requiredSecrets: definition.requiredSecrets,
            connection,
            delivery,
            error: testResult.error ?? 'Installation failed',
          },
          { status: 422 },
        )
      }

      await recordAuditEvent({
        orgId,
        targetType: 'org',
        targetId: orgId,
        action: 'provider_installed',
        actorClerkUserId: auth.userId,
        afterJson: { providerId: provider, secretCount: Object.keys(secrets).length },
      })

      logger.info('Provider installed', { providerId: provider, orgId })
      return NextResponse.json(
        {
          ok: true,
          provider,
          requiredSecrets: definition.requiredSecrets,
          connection,
          delivery,
        },
        { status: 201 },
      )
    }),
  )
}
