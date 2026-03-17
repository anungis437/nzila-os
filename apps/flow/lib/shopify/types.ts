/**
 * Shopify Integration Types
 *
 * Type definitions for Shopify Admin API integration.
 * Covers Products, Orders, Customers, and Webhook payloads.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════

export interface ShopifyCredentials {
  shopDomain: string
  accessToken: string
  scopes: string
  webhookSecret?: string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// Products
// ═══════════════════════════════════════════════════════════════════════════

export interface ShopifyProduct {
  id: number
  title: string
  body_html: string | null
  vendor: string
  product_type: string
  handle: string
  status: 'active' | 'archived' | 'draft'
  tags: string
  variants: ShopifyVariant[]
  images: ShopifyImage[]
  created_at: string
  updated_at: string
}

export interface ShopifyVariant {
  id: number
  product_id: number
  title: string
  price: string
  sku: string | null
  inventory_quantity: number
  weight: number | null
  weight_unit: string | null
  created_at: string
  updated_at: string
}

export interface ShopifyImage {
  id: number
  product_id: number
  src: string
  alt: string | null
  position: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Orders
// ═══════════════════════════════════════════════════════════════════════════

export interface ShopifyOrder {
  id: number
  name: string
  order_number: number
  email: string | null
  financial_status: 'pending' | 'authorized' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'voided'
  fulfillment_status: 'fulfilled' | 'partial' | 'unfulfilled' | null
  total_price: string
  subtotal_price: string
  total_tax: string
  currency: string
  line_items: ShopifyLineItem[]
  customer: ShopifyCustomer | null
  shipping_address: ShopifyAddress | null
  billing_address: ShopifyAddress | null
  note: string | null
  tags: string
  created_at: string
  updated_at: string
}

export interface ShopifyLineItem {
  id: number
  product_id: number | null
  variant_id: number | null
  title: string
  quantity: number
  price: string
  sku: string | null
  name: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Customers
// ═══════════════════════════════════════════════════════════════════════════

export interface ShopifyCustomer {
  id: number
  email: string | null
  first_name: string
  last_name: string
  phone: string | null
  orders_count: number
  total_spent: string
  tags: string
  default_address?: ShopifyAddress | null
  created_at: string
  updated_at: string
}

export interface ShopifyAddress {
  first_name?: string
  last_name?: string
  company?: string
  address1: string
  address2?: string | null
  city: string
  province: string
  province_code?: string
  country: string
  country_code?: string
  zip: string
  phone?: string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// API Response
// ═══════════════════════════════════════════════════════════════════════════

export interface ShopifyPaginatedResponse<T> {
  data: T[]
  pageInfo: {
    hasNextPage: boolean
    nextCursor?: string
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Webhooks
// ═══════════════════════════════════════════════════════════════════════════

export type ShopifyWebhookTopic =
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'orders/create'
  | 'orders/updated'
  | 'orders/fulfilled'
  | 'orders/cancelled'
  | 'customers/create'
  | 'customers/update'

export interface ShopifyWebhookHeaders {
  'x-shopify-topic': ShopifyWebhookTopic
  'x-shopify-hmac-sha256': string
  'x-shopify-shop-domain': string
  'x-shopify-api-version': string
}

// ═══════════════════════════════════════════════════════════════════════════
// Sync
// ═══════════════════════════════════════════════════════════════════════════

export type ShopifySyncEntity = 'products' | 'orders' | 'customers'

export interface ShopifySyncResult {
  entity: ShopifySyncEntity
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsFailed: number
  errors: ShopifySyncError[]
  startedAt: Date
  completedAt?: Date
}

export interface ShopifySyncError {
  recordId: string
  operation: 'create' | 'update' | 'delete'
  errorMessage: string
  retryable: boolean
}
