/**
 * Shopify Integration Adapter — Flow
 *
 * Stateless adapter wrapping ShopifyClient & ShopifySyncService.
 * Internal DB is source of truth; Shopify writes are side effects.
 */
import { ShopifyClient, type ShopifyProduct, type ShopifyOrder } from '@/lib/shopify'
import { withSpan } from '@nzila/os-core/telemetry'
import type { Order } from '@/domain/entities'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ShopifyAdapterConfig {
  shopDomain: string
  accessToken: string
  scopes?: string
  apiVersion?: string
}

export interface PushOrderResult {
  shopifyOrderId: number
  success: boolean
}

export interface SyncProductsResult {
  created: number
  updated: number
  skipped: number
}

export interface FulfillmentStatus {
  shopifyOrderId: number
  fulfillmentStatus: string | null
  trackingNumber: string | null
  trackingUrl: string | null
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createShopifyAdapter(config: ShopifyAdapterConfig) {
  const client = new ShopifyClient({
    shopDomain: config.shopDomain,
    accessToken: config.accessToken,
    scopes: config.scopes ?? 'read_products,read_orders,write_orders',
  })

  return {
    /**
     * Push an internal order to Shopify as a draft order / external record.
     */
    async pushOrder(order: Order): Promise<PushOrderResult> {
      return withSpan('shopify.push_order', { 'order.id': order.id }, async () => {
        // Map internal order to Shopify-compatible shape
        const shopifyPayload: Partial<ShopifyOrder> = {
          financial_status: order.payment_status === 'PAID' ? 'paid' : 'pending',
          note: `Flow order ${order.id}`,
        }

        // In production this would call the Shopify Orders API.
        // For now, return a typed stub that is wired when orders endpoint exists.
        void shopifyPayload
        return { shopifyOrderId: 0, success: false } satisfies PushOrderResult
      })
    },

    /**
     * Sync product catalog from Shopify into internal store.
     */
    async syncProducts(): Promise<SyncProductsResult> {
      return withSpan('shopify.sync_products', {}, async () => {
        const products = await client.getProducts()
        // TODO: upsert into internal product table via Drizzle
        return {
          created: 0,
          updated: 0,
          skipped: products.length,
        }
      })
    },

    /**
     * Check fulfillment status for a Shopify order.
     */
    async getFulfillmentStatus(shopifyOrderId: number): Promise<FulfillmentStatus | null> {
      return withSpan('shopify.get_fulfillment', { shopifyOrderId }, async () => {
        const order = await client.getOrderById(shopifyOrderId)
        if (!order) return null
        return {
          shopifyOrderId,
          fulfillmentStatus: order.fulfillment_status ?? null,
          trackingNumber: null, // extracted from fulfillments array in production
          trackingUrl: null,
        }
      })
    },

    /**
     * Fetch a single product by Shopify ID.
     */
    async getProduct(shopifyProductId: number): Promise<ShopifyProduct | null> {
      return client.getProductById(shopifyProductId)
    },
  }
}
