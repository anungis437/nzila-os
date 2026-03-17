/**
 * Zoho Webhook Receiver
 *
 * Receives Zoho CRM webhook notifications for record changes (insert/update/delete).
 * Validates the webhook token, then triggers an incremental sync for the affected module.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { ZohoSyncService } from '@/lib/zoho/sync-service'
import { ZohoCrmClient } from '@/lib/zoho/crm-client'
import { ZohoOAuthClient } from '@/lib/zoho/oauth'
import { findZohoCredentialsByOrg } from '@/lib/zoho/credential-lookup'

const ZOHO_WEBHOOK_TOKEN = process.env.ZOHO_WEBHOOK_TOKEN ?? ''

const WebhookPayloadSchema = z.object({
  module: z.string(),
  operation: z.enum(['insert', 'update', 'delete']),
  ids: z.array(z.string()).min(1),
  token: z.string().optional(),
  timestamp: z.string(),
})

function resolveModule(module: string): 'contacts' | 'deals' | null {
  const lower = module.toLowerCase()
  if (lower === 'contacts') return 'contacts'
  if (lower === 'deals') return 'deals'
  return null
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = WebhookPayloadSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn('Invalid Zoho webhook payload', { errors: parsed.error.flatten() })
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const payload = parsed.data

  // Validate webhook token if configured
  if (ZOHO_WEBHOOK_TOKEN && payload.token !== ZOHO_WEBHOOK_TOKEN) {
    logger.warn('Zoho webhook token mismatch')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncModule = resolveModule(payload.module)
  if (!syncModule) {
    logger.info('Ignoring webhook for unhandled Zoho module', { module: payload.module })
    return NextResponse.json({ ok: true, skipped: true })
  }

  logger.info('Zoho webhook received', {
    module: payload.module,
    operation: payload.operation,
    recordCount: payload.ids.length,
  })

  // Build Zoho client — resolve orgId from query param or env fallback
  const orgId = request.nextUrl.searchParams.get('org') ?? process.env.ZOHO_ORG_ID
  if (!orgId) {
    logger.error('No orgId in Zoho webhook URL or ZOHO_ORG_ID env')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Look up Zoho credentials from DB for this org
  const credentials = await findZohoCredentialsByOrg(orgId)

  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    logger.error('Missing Zoho OAuth app credentials (ZOHO_CLIENT_ID/ZOHO_CLIENT_SECRET)')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (!credentials) {
    logger.error('No Zoho credentials found for org', { orgId })
    return NextResponse.json({ error: 'No Zoho credentials for org' }, { status: 500 })
  }

  const oauthClient = new ZohoOAuthClient(orgId, {
    clientId,
    clientSecret,
    redirectUri: process.env.ZOHO_REDIRECT_URI ?? '',
    scope: ['ZohoCRM.modules.ALL'],
  })

  const crmClient = new ZohoCrmClient(oauthClient)
  const syncService = new ZohoSyncService(crmClient, orgId)

  try {
    const result =
      syncModule === 'contacts'
        ? await syncService.syncContacts({ direction: 'zoho_to_nzila' })
        : await syncService.syncDeals({ direction: 'zoho_to_nzila' })

    logger.info('Zoho webhook sync completed', {
      module: syncModule,
      processed: result.recordsProcessed,
      created: result.recordsCreated,
      updated: result.recordsUpdated,
      failed: result.recordsFailed,
      conflicts: result.conflicts.length,
    })

    return NextResponse.json({
      ok: true,
      processed: result.recordsProcessed,
      created: result.recordsCreated,
      updated: result.recordsUpdated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Zoho webhook sync failed', { error: message, module: syncModule })
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
