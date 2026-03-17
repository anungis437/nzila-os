/**
 * Shopify Webhook Receiver
 *
 * Verifies incoming Shopify webhooks via HMAC-SHA256, then triggers an
 * incremental sync for the affected entity type (products, orders, customers).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { logger } from '@/lib/logger'
import { ShopifySyncService } from '@/lib/shopify/sync-service'
import { findShopifyCredentialsByDomain } from '@/lib/shopify/credential-lookup'

const TOPIC_ENTITY_MAP: Record<string, 'customers' | 'orders'> = {
  'customers/create': 'customers',
  'customers/update': 'customers',
  'customers/delete': 'customers',
  'orders/create': 'orders',
  'orders/updated': 'orders',
  'orders/cancelled': 'orders',
  'orders/fulfilled': 'orders',
  'orders/paid': 'orders',
}

function verifyHmac(body: Buffer, secret: string, headerHmac: string): boolean {
  const computed = createHmac('sha256', secret).update(body).digest('base64')
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(headerHmac))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const topic = request.headers.get('x-shopify-topic')
  const shopDomain = request.headers.get('x-shopify-shop-domain')
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256')

  if (!topic || !shopDomain || !hmacHeader) {
    return NextResponse.json({ error: 'Missing Shopify headers' }, { status: 400 })
  }

  // Read raw body for HMAC verification
  const rawBody = Buffer.from(await request.arrayBuffer())

  // Resolve org + webhook secret from shopDomain via DB
  const credentials = await findShopifyCredentialsByDomain(shopDomain)

  if (!credentials || !credentials.isActive) {
    logger.warn('No active Shopify credentials for shop domain', { shopDomain })
    return NextResponse.json({ error: 'Unknown shop' }, { status: 404 })
  }

  const webhookSecret = credentials.webhookSecret ?? process.env.SHOPIFY_WEBHOOK_SECRET
  if (!webhookSecret) {
    logger.error('No webhook secret for Shopify shop', { shopDomain })
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (!verifyHmac(rawBody, webhookSecret, hmacHeader)) {
    logger.warn('Shopify webhook HMAC verification failed', { topic, shopDomain })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const entityType = TOPIC_ENTITY_MAP[topic]
  if (!entityType) {
    logger.info('Ignoring unhandled Shopify webhook topic', { topic })
    return NextResponse.json({ ok: true, skipped: true })
  }

  const orgId = credentials.orgId
  logger.info('Shopify webhook received', { topic, shopDomain, entityType, orgId })

  const syncService = await ShopifySyncService.fromOrg(orgId)
  if (!syncService) {
    logger.error('No Shopify credentials found for org', { orgId })
    return NextResponse.json({ error: 'No Shopify credentials' }, { status: 500 })
  }

  try {
    const result =
      entityType === 'customers'
        ? await syncService.syncCustomers()
        : await syncService.syncOrders()

    logger.info('Shopify webhook sync completed', {
      topic,
      entity: result.entity,
      processed: result.recordsProcessed,
      created: result.recordsCreated,
      updated: result.recordsUpdated,
      failed: result.recordsFailed,
    })

    return NextResponse.json({
      ok: true,
      entity: result.entity,
      processed: result.recordsProcessed,
      created: result.recordsCreated,
      updated: result.recordsUpdated,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Shopify webhook sync failed', { topic, error: message })
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
