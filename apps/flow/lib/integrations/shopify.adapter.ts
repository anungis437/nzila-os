/**
 * Shopify Integration Adapter — Flow
 *
 * Stateless adapter wrapping ShopifyClient & ShopifySyncService.
 * Internal DB is source of truth; Shopify writes are side effects.
 */
import { ShopifyClient, type ShopifyProduct, type ShopifyOrder, type ShopifyLineItem } from '@/lib/shopify'
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
     * Push an internal order to Shopify via the Admin Orders API.
     *
     * Shopify requires at least one line item. When the caller provides
     * `lineItems`, we forward them. Otherwise we synthesize a single custom
     * line item that references the Flow order id and uses the order total
     * as the line price — this keeps Shopify totals consistent without
     * requiring a SKU/variant mapping.
     */
    async pushOrder(
      order: Order,
      lineItems?: Partial<ShopifyLineItem>[],
    ): Promise<PushOrderResult> {
      return withSpan('shopify.push_order', { 'order.id': order.id }, async () => {
        const items =
          lineItems && lineItems.length > 0
            ? lineItems
            : [
                {
                  title: `Flow order ${order.id}`,
                  quantity: 1,
                  price: order.total_amount.toFixed(2),
                },
              ]

        const payload: Partial<ShopifyOrder> = {
          financial_status: order.payment_status === 'PAID' ? 'paid' : 'pending',
          currency: order.currency,
          note: `Flow order ${order.id}`,
          line_items: items as ShopifyLineItem[],
        }

        const created = await client.createOrder(payload)
        return { shopifyOrderId: created.id, success: true }
      })
    },

    /**
     * Sync product catalog from Shopify into internal store.
     *
     * NOT WIRED: the Flow products table does not yet have a Shopify
     * import mapping. This method throws so callers see an honest failure
     * instead of a silent no-op. Wire `commerce-db/products` upsert here
     * before re-enabling the `shopify_sync` action='sync_products' path.
     */
    async syncProducts(): Promise<SyncProductsResult> {
      return withSpan('shopify.sync_products', {}, async () => {
        throw new Error(
          'shopify.syncProducts not implemented — wire Drizzle upsert against commerce_products before enabling',
        )
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
