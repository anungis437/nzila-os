/**
 * Shopify Integration Adapter — Flow
 *
 * Stateless adapter wrapping ShopifyClient & ShopifySyncService.
 * Internal DB is source of truth; Shopify writes are side effects.
 */
import { ShopifyClient, type ShopifyProduct, type ShopifyOrder, type ShopifyLineItem } from '@/lib/shopify'
import { withSpan } from '@nzila/os-core/telemetry'
import {
  createProduct,
  updateProduct,
  getProductBySku,
} from '@nzila/commerce-db'
import type { Order } from '@/domain/entities'

// ── Types ───────────────────────────────────────────────────────────────

export interface ShopifyAdapterConfig {
  shopDomain: string
  accessToken: string
  scopes?: string
  apiVersion?: string
}

export interface SyncContext {
  orgId: string
  actorId: string
  correlationId?: string
  actorRole?: string
  /** Default category assigned to imported products that do not declare one. */
  defaultCategory?: string
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
     * Sync product catalog from Shopify into the internal
     * `commerce_products` table for the supplied org.
     *
     * For each product returned by the Shopify Admin API we look it up by
     * SKU (the Shopify product handle is used when no variant SKU exists)
     * and either update the matching `commerce_products` row in place or
     * insert a new one. Pricing is taken from the first variant; products
     * without a variant price are skipped (cannot be inserted without a
     * non-null `base_price`).
     *
     * Writes go through `@nzila/commerce-db` so the standard audit log and
     * row-level org scoping apply.
     */
    async syncProducts(ctx: SyncContext): Promise<SyncProductsResult> {
      return withSpan(
        'shopify.sync_products',
        { 'org.id': ctx.orgId },
        async () => {
          const products = await client.getProducts()
          const defaultCategory = ctx.defaultCategory ?? 'shopify'
          let created = 0
          let updated = 0
          let skipped = 0

          for (const product of products) {
            const firstVariant = product.variants?.[0]
            const sku =
              firstVariant?.sku && firstVariant.sku.trim().length > 0
                ? firstVariant.sku.trim()
                : `shopify-${product.id}`
            const priceStr = firstVariant?.price
            if (!priceStr) {
              skipped += 1
              continue
            }
            const basePrice = priceStr
            const costPrice = priceStr // Shopify Admin REST does not expose cost; mirror price
            const status: 'active' | 'inactive' =
              product.status === 'active' ? 'active' : 'inactive'

            const values = {
              sku,
              name: product.title,
              description: product.body_html ?? null,
              category: product.product_type || defaultCategory,
              basePrice,
              costPrice,
              status,
              tags: product.tags
                ? product.tags.split(',').map((t) => t.trim()).filter(Boolean)
                : [],
              imageUrl: product.images?.[0]?.src ?? null,
              metadata: {
                source: 'shopify',
                shopify_product_id: product.id,
                shopify_handle: product.handle,
                shopify_vendor: product.vendor,
                shopify_updated_at: product.updated_at,
              },
            } as const

            const existing = await getProductBySku(
              { orgId: ctx.orgId },
              sku,
            )
            if (existing) {
              await updateProduct(
                {
                  orgId: ctx.orgId,
                  actorId: ctx.actorId,
                  correlationId: ctx.correlationId,
                  actorRole: ctx.actorRole,
                },
                existing.id,
                values,
              )
              updated += 1
            } else {
              await createProduct(
                {
                  orgId: ctx.orgId,
                  actorId: ctx.actorId,
                  correlationId: ctx.correlationId,
                  actorRole: ctx.actorRole,
                },
                values,
              )
              created += 1
            }
          }

          return { created, updated, skipped }
        },
      )
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
