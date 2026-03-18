/**
 * Flow — Integration Dispatch Wrappers
 *
 * Registers side-effect handlers for each integration adapter.
 * Import this module at startup alongside register-handlers to activate
 * all integration side-effects triggered by the control layer.
 *
 * Side effects are fire-and-forget — failures produce warnings but
 * never roll back domain state.
 */
import { registerSideEffectHandler } from '@/lib/control/dispatch/side-effect-dispatcher'
import { createZohoAdapter } from '@/lib/integrations/zoho.adapter'
import { createShopifyAdapter } from '@/lib/integrations/shopify.adapter'
import { createCanvaAdapter } from '@/lib/integrations/canva.adapter'
import { logger } from '@/lib/logger'

// ── Zoho Sync ──────────────────────────────────────────────────────────────

registerSideEffectHandler('zoho_sync', async ({ metadata }) => {
  const config = {
    clientId: process.env.ZOHO_CLIENT_ID ?? '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET ?? '',
    refreshToken: process.env.ZOHO_REFRESH_TOKEN ?? '',
    orgId: process.env.ZOHO_ORG_ID ?? '',
    baseUrl: process.env.ZOHO_API_BASE ?? 'https://www.zohoapis.com',
  }

  if (!config.clientId) {
    logger.debug('Zoho sync skipped — no credentials configured')
    return
  }

  const zoho = createZohoAdapter(config)
  const action = metadata?.action as string | undefined

  if (action === 'push_po') {
    await zoho.pushPO(metadata?.po_data as never)
  } else if (action === 'push_invoice') {
    await zoho.pushInvoice(metadata?.invoice_data as never)
  } else if (action === 'sync_vendors') {
    await zoho.syncVendors()
  }
})

// ── Shopify Sync ───────────────────────────────────────────────────────────

registerSideEffectHandler('shopify_sync', async ({ metadata }) => {
  const config = {
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN ?? '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN ?? '',
    apiVersion: process.env.SHOPIFY_API_VERSION ?? '2024-01',
  }

  if (!config.shopDomain) {
    logger.debug('Shopify sync skipped — no credentials configured')
    return
  }

  const shopify = createShopifyAdapter(config)
  const action = metadata?.action as string | undefined

  if (action === 'push_order') {
    await shopify.pushOrder(metadata?.order_data as never)
  } else if (action === 'update_fulfillment') {
    await shopify.updateFulfillment(
      metadata?.shopify_order_id as string,
      metadata?.status as never,
    )
  }
})

// ── Canva Update ───────────────────────────────────────────────────────────

registerSideEffectHandler('canva_update', async ({ metadata }) => {
  const config = {
    apiKey: process.env.CANVA_API_KEY ?? '',
    brandId: process.env.CANVA_BRAND_ID ?? '',
  }

  if (!config.apiKey) {
    logger.debug('Canva update skipped — no credentials configured')
    return
  }

  const canva = createCanvaAdapter(config)
  const action = metadata?.action as string | undefined

  if (action === 'export_design') {
    await canva.exportDesign(metadata?.design_id as string)
  }
})

// ── Customer Notification ──────────────────────────────────────────────────

registerSideEffectHandler('customer_notification', async ({ metadata }) => {
  // Placeholder for notification service integration
  // Will dispatch to email/SMS/push when notification service is available
  logger.info('Customer notification dispatched', {
    type: metadata?.notification_type,
    customer_id: metadata?.customer_id,
  })
})

logger.info('Integration dispatch wrappers registered')
