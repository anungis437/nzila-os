/**
 * Shopify Integration — Contract Tests
 *
 * Validates the structural contracts between nzila commerce tables and Shopify APIs.
 * Tests field mapping, sync service shape, webhook HMAC verification, and type contracts.
 *
 * These are unit-level contract tests that verify integration contracts
 * WITHOUT making real API calls.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = resolve(__dirname, '..')

// ── Structural contract tests ──────────────────────────────────────────────

describe('Shopify integration structural contracts', () => {
  it('exports ShopifyClient class with product, order, customer methods', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/client.ts'), 'utf-8')
    expect(content).toContain('class ShopifyClient')
    expect(content).toContain('getProducts(')
    expect(content).toContain('getProductById(')
    expect(content).toContain('createProduct(')
    expect(content).toContain('updateProduct(')
    expect(content).toContain('getOrders(')
    expect(content).toContain('getOrderById(')
    expect(content).toContain('getCustomers(')
    expect(content).toContain('getCustomerById(')
    expect(content).toContain('searchCustomers(')
  })

  it('exports ShopifySyncService class with sync methods', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/sync-service.ts'), 'utf-8')
    expect(content).toContain('class ShopifySyncService')
    expect(content).toContain('async syncCustomers(')
    expect(content).toContain('async syncOrders(')
    expect(content).toContain('static async fromOrg(')
  })

  it('has webhook route handler with HMAC verification', () => {
    const webhookPath = resolve(APP, 'app/api/shopify/webhook/route.ts')
    expect(existsSync(webhookPath)).toBe(true)
    const content = readFileSync(webhookPath, 'utf-8')
    expect(content).toContain('export async function POST')
    expect(content).toContain('x-shopify-hmac-sha256')
    expect(content).toContain('verifyHmac')
    expect(content).toContain('createHmac')
    expect(content).toContain('timingSafeEqual')
  })

  it('has barrel export in lib/shopify/index.ts', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/index.ts'), 'utf-8')
    expect(content).toContain('ShopifyClient')
    expect(content).toContain('ShopifySyncService')
    expect(content).toContain('ShopifyCredentials')
  })

  it('uses X-Shopify-Access-Token authentication', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/client.ts'), 'utf-8')
    expect(content).toContain('X-Shopify-Access-Token')
  })
})

// ── Type contract tests ────────────────────────────────────────────────────

describe('Shopify type contracts', () => {
  it('defines all required Shopify entity types', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/types.ts'), 'utf-8')
    const requiredTypes = [
      'ShopifyCredentials',
      'ShopifyProduct',
      'ShopifyVariant',
      'ShopifyImage',
      'ShopifyOrder',
      'ShopifyLineItem',
      'ShopifyCustomer',
      'ShopifyAddress',
      'ShopifySyncResult',
      'ShopifySyncError',
    ]
    for (const type of requiredTypes) {
      expect(content).toContain(type)
    }
  })

  it('ShopifyCredentials includes required fields', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/types.ts'), 'utf-8')
    expect(content).toContain('shopDomain')
    expect(content).toContain('accessToken')
  })

  it('ShopifySyncResult tracks processed/created/updated/failed counts', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/types.ts'), 'utf-8')
    expect(content).toContain('recordsProcessed')
    expect(content).toContain('recordsCreated')
    expect(content).toContain('recordsUpdated')
    expect(content).toContain('recordsFailed')
  })
})

// ── Field mapping contracts ────────────────────────────────────────────────

describe('Shopify field mapping contracts', () => {
  it('maps Shopify customer to local with first/last name', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/sync-service.ts'), 'utf-8')
    expect(content).toContain('first_name')
    expect(content).toContain('last_name')
    expect(content).toContain('mapShopifyCustomerToLocal')
  })

  it('maps Shopify order financial_status to quote status', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/sync-service.ts'), 'utf-8')
    expect(content).toContain('FINANCIAL_STATUS_MAP')
    expect(content).toContain('financial_status')
    expect(content).toContain('mapShopifyOrderToQuote')
  })

  it('tracks sync records per entity type', () => {
    const content = readFileSync(resolve(APP, 'lib/shopify/sync-service.ts'), 'utf-8')
    expect(content).toContain('commerceShopifySyncRecords')
    expect(content).toContain('entityType')
    expect(content).toContain('shopifyId')
    expect(content).toContain('nzilaRecordId')
  })
})

// ── Webhook security contracts ─────────────────────────────────────────────

describe('Shopify webhook security contracts', () => {
  it('uses HMAC-SHA256 for webhook verification', () => {
    const content = readFileSync(resolve(APP, 'app/api/shopify/webhook/route.ts'), 'utf-8')
    expect(content).toContain("createHmac('sha256'")
    expect(content).toContain('timingSafeEqual')
    expect(content).toContain("digest('base64')")
  })

  it('handles customer and order webhook topics', () => {
    const content = readFileSync(resolve(APP, 'app/api/shopify/webhook/route.ts'), 'utf-8')
    expect(content).toContain("'customers/create'")
    expect(content).toContain("'customers/update'")
    expect(content).toContain("'orders/create'")
    expect(content).toContain("'orders/updated'")
  })

  it('reads Shopify headers for authentication', () => {
    const content = readFileSync(resolve(APP, 'app/api/shopify/webhook/route.ts'), 'utf-8')
    expect(content).toContain('x-shopify-topic')
    expect(content).toContain('x-shopify-shop-domain')
    expect(content).toContain('x-shopify-hmac-sha256')
  })
})
