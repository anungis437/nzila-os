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
import type { SideEffectResult } from '@/lib/control/dispatch/side-effect-dispatcher'
import { createZohoAdapter } from '@/lib/integrations/zoho.adapter'
import { createShopifyAdapter } from '@/lib/integrations/shopify.adapter'
import { createCanvaAdapter } from '@/lib/integrations/canva.adapter'
import { logger } from '@/lib/logger'

// ── Zoho Sync ──────────────────────────────────────────────────────────────

registerSideEffectHandler('zoho_sync', async (request): Promise<SideEffectResult> => {
  const config = {
    clientId: process.env.ZOHO_CLIENT_ID ?? '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET ?? '',
    redirectUri: process.env.ZOHO_REDIRECT_URI ?? '',
    orgId: process.env.ZOHO_ORG_ID ?? '',
  }

  if (!config.clientId) {
    logger.debug('Zoho sync skipped — no credentials configured')
    return { type: 'zoho_sync', success: true, warning: 'No credentials configured' }
  }

  const zoho = createZohoAdapter(config)
  const action = request.metadata?.action as string | undefined

  if (action === 'push_po') {
    await zoho.pushPurchaseOrder(request.metadata?.po_data as never)
  } else if (action === 'push_invoice') {
    await zoho.pushInvoice(request.metadata?.invoice_data as never)
  } else if (action === 'sync_vendors') {
    await zoho.syncVendors()
  }

  return { type: 'zoho_sync', success: true }
})

// ── Shopify Sync ───────────────────────────────────────────────────────────

registerSideEffectHandler('shopify_sync', async (request): Promise<SideEffectResult> => {
  const config = {
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN ?? '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN ?? '',
    apiVersion: process.env.SHOPIFY_API_VERSION ?? '2024-01',
  }

  if (!config.shopDomain) {
    logger.debug('Shopify sync skipped — no credentials configured')
    return { type: 'shopify_sync', success: true, warning: 'No credentials configured' }
  }

  const shopify = createShopifyAdapter(config)
  const action = request.metadata?.action as string | undefined

  if (action === 'push_order') {
    await shopify.pushOrder(request.metadata?.order_data as never)
  } else if (action === 'get_fulfillment_status') {
    const shopifyOrderId = request.metadata?.shopify_order_id as number
    await shopify.getFulfillmentStatus(shopifyOrderId)
  }

  return { type: 'shopify_sync', success: true }
})

// ── Canva Update ───────────────────────────────────────────────────────────

registerSideEffectHandler('canva_update', async (request): Promise<SideEffectResult> => {
  const config = {
    apiToken: process.env.CANVA_API_KEY ?? '',
    brandTemplateId: process.env.CANVA_BRAND_ID ?? '',
  }

  if (!config.apiToken) {
    logger.debug('Canva update skipped — no credentials configured')
    return { type: 'canva_update', success: true, warning: 'No credentials configured' }
  }

  const canva = createCanvaAdapter(config)
  const action = request.metadata?.action as string | undefined

  if (action === 'export_design') {
    await canva.exportDesign(request.metadata?.design_id as string)
  }

  return { type: 'canva_update', success: true }
})

// ── Customer Notification ──────────────────────────────────────────────────

registerSideEffectHandler('customer_notification', async (request): Promise<SideEffectResult> => {
  // Placeholder for notification service integration
  // Will dispatch to email/SMS/push when notification service is available
  logger.info('Customer notification dispatched', {
    type: request.metadata?.notification_type,
    customer_id: request.metadata?.customer_id,
  })

  return { type: 'customer_notification', success: true }
})

logger.info('Integration dispatch wrappers registered')
