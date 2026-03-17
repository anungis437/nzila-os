/**
 * Shopify Sync Service
 *
 * Handles bi-directional sync between nzila commerce tables and Shopify.
 * Syncs customers and orders, with sync state tracking via the
 * commerce_shopify_sync_records table.
 */

import { eq, and } from 'drizzle-orm'
import {
  db,
  commerceCustomers,
  commerceQuotes,
  commerceShopifyCredentials,
  commerceShopifySyncRecords,
} from '@nzila/db'
import { logger } from '../logger'
import { ShopifyClient } from './client'
import { getOrgSettings } from '@nzila/platform-commerce-org/service'
import type {
  ShopifyCustomer,
  ShopifyOrder,
  ShopifySyncResult,
  ShopifyCredentials,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Field Mapping: Shopify Customers <-> commerce_customers
// ─────────────────────────────────────────────────────────────────────────────

function mapShopifyCustomerToLocal(
  customer: ShopifyCustomer,
): Partial<typeof commerceCustomers.$inferInsert> {
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ')
  const addr = customer.default_address
  return {
    name: name || 'Shopify Customer',
    email: customer.email,
    phone: customer.phone,
    address: addr
      ? {
          street: [addr.address1, addr.address2].filter(Boolean).join(', '),
          city: addr.city,
          state: addr.province,
          zip: addr.zip,
          country: addr.country,
        }
      : null,
  }
}

function _mapLocalCustomerToShopify(
  customer: typeof commerceCustomers.$inferSelect,
): Partial<ShopifyCustomer> {
  const parts = (customer.name ?? '').split(' ')
  const firstName = parts[0] || 'Customer'
  const lastName = parts.slice(1).join(' ') || ''
  return {
    first_name: firstName,
    last_name: lastName,
    email: customer.email ?? undefined,
    phone: customer.phone ?? undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Field Mapping: Shopify Orders -> commerce_quotes (inbound only)
// ─────────────────────────────────────────────────────────────────────────────

const FINANCIAL_STATUS_MAP: Record<string, string> = {
  pending: 'draft',
  authorized: 'draft',
  partially_paid: 'deposit_required',
  paid: 'accepted',
  partially_refunded: 'accepted',
  refunded: 'cancelled',
  voided: 'cancelled',
}

function mapShopifyOrderToQuote(
  order: ShopifyOrder,
  customerId: string | null,
): Partial<typeof commerceQuotes.$inferInsert> {
  return {
    ref: `SHOP-${order.order_number}`,
    customerId: customerId ?? undefined,
    status: (FINANCIAL_STATUS_MAP[order.financial_status] ?? 'draft') as 'draft',
    currency: order.currency,
    subtotal: order.subtotal_price,
    taxTotal: order.total_tax,
    total: order.total_price,
    notes: order.note,
    metadata: {
      shopifyOrderId: order.id,
      shopifyOrderName: order.name,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shopify Sync Service
// ─────────────────────────────────────────────────────────────────────────────

export class ShopifySyncService {
  private client: ShopifyClient
  private orgId: string

  constructor(client: ShopifyClient, orgId: string) {
    this.client = client
    this.orgId = orgId
  }

  /**
   * Create a ShopifySyncService from stored credentials for an org.
   */
  static async fromOrg(orgId: string): Promise<ShopifySyncService | null> {
    const [creds] = await db
      .select()
      .from(commerceShopifyCredentials)
      .where(
        and(
          eq(commerceShopifyCredentials.orgId, orgId),
          eq(commerceShopifyCredentials.isActive, true),
        ),
      )
      .limit(1)

    if (!creds) return null

    const credentials: ShopifyCredentials = {
      shopDomain: creds.shopDomain,
      accessToken: creds.accessToken,
      scopes: creds.scopes,
      webhookSecret: creds.webhookSecret,
    }

    const client = new ShopifyClient(credentials)
    return new ShopifySyncService(client, orgId)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Customer Sync (pull from Shopify)
  // ───────────────────────────────────────────────────────────────────────────

  async syncCustomers(): Promise<ShopifySyncResult> {
    const result: ShopifySyncResult = {
      entity: 'customers',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      startedAt: new Date(),
    }

    const lastSync = await this.getLastSyncTime('customers')
    const params: { limit: number; updated_at_min?: string } = { limit: 250 }
    if (lastSync) params.updated_at_min = lastSync.toISOString()

    try {
      const shopifyCustomers = await this.client.getCustomers(params)

      logger.info('Syncing Shopify customers', {
        count: shopifyCustomers.length,
        orgId: this.orgId,
      })

      for (const sc of shopifyCustomers) {
        try {
          const localId = await this.getLinkedLocalId('customers', String(sc.id))
          const customerData = mapShopifyCustomerToLocal(sc)

          if (localId) {
            await db
              .update(commerceCustomers)
              .set({ ...customerData, updatedAt: new Date() })
              .where(eq(commerceCustomers.id, localId))
            await this.updateSyncRecord('customers', localId, String(sc.id), 'synced')
            result.recordsUpdated++
          } else {
            const [newCustomer] = await db
              .insert(commerceCustomers)
              .values({
                orgId: this.orgId,
                name: customerData.name ?? 'Shopify Customer',
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address,
                metadata: { shopifyCustomerId: sc.id },
              })
              .returning()
            await this.createSyncRecord('customers', newCustomer.id, String(sc.id), 'synced')
            result.recordsCreated++
          }
          result.recordsProcessed++
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          result.recordsFailed++
          result.recordsProcessed++
          result.errors.push({
            recordId: String(sc.id),
            operation: 'update',
            errorMessage: `Failed to sync customer ${sc.id}: ${message}`,
            retryable: true,
          })
        }
      }

      result.completedAt = new Date()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Shopify customer sync failed', { error: message, orgId: this.orgId })
      result.errors.push({
        recordId: '',
        operation: 'update',
        errorMessage: message,
        retryable: true,
      })
    }

    return result
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Order Sync (pull from Shopify → create as quotes)
  // ───────────────────────────────────────────────────────────────────────────

  async syncOrders(): Promise<ShopifySyncResult> {
    const result: ShopifySyncResult = {
      entity: 'orders',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      startedAt: new Date(),
    }

    const lastSync = await this.getLastSyncTime('orders')
    const params: { limit: number; updated_at_min?: string; status: 'any' } = {
      limit: 250,
      status: 'any',
    }
    if (lastSync) params.updated_at_min = lastSync.toISOString()

    try {
      const orders = await this.client.getOrders(params)

      logger.info('Syncing Shopify orders', {
        count: orders.length,
        orgId: this.orgId,
      })

      for (const order of orders) {
        try {
          const localId = await this.getLinkedLocalId('orders', String(order.id))

          // Resolve customer link
          let customerId: string | null = null
          if (order.customer) {
            customerId = await this.getLinkedLocalId('customers', String(order.customer.id))
          }

          const quoteData = mapShopifyOrderToQuote(order, customerId)

          if (localId) {
            await db
              .update(commerceQuotes)
              .set({ ...quoteData, updatedAt: new Date() })
              .where(eq(commerceQuotes.id, localId))
            await this.updateSyncRecord('orders', localId, String(order.id), 'synced')
            result.recordsUpdated++
          } else {
            const [newQuote] = await db
              .insert(commerceQuotes)
              .values({
                orgId: this.orgId,
                createdBy: 'shopify-sync',
                ref: quoteData.ref ?? `SHOP-${order.order_number}`,
                customerId: quoteData.customerId ?? '',
                status: quoteData.status ?? 'draft',
                currency: quoteData.currency ?? (await getOrgSettings(this.orgId)).currency,
                subtotal: quoteData.subtotal ?? '0',
                taxTotal: quoteData.taxTotal ?? '0',
                total: quoteData.total ?? '0',
                notes: quoteData.notes,
                metadata: quoteData.metadata,
              })
              .returning()
            await this.createSyncRecord('orders', newQuote.id, String(order.id), 'synced')
            result.recordsCreated++
          }
          result.recordsProcessed++
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          result.recordsFailed++
          result.recordsProcessed++
          result.errors.push({
            recordId: String(order.id),
            operation: 'update',
            errorMessage: `Failed to sync order ${order.id}: ${message}`,
            retryable: true,
          })
        }
      }

      result.completedAt = new Date()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Shopify order sync failed', { error: message, orgId: this.orgId })
      result.errors.push({
        recordId: '',
        operation: 'update',
        errorMessage: message,
        retryable: true,
      })
    }

    return result
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sync Record Management
  // ───────────────────────────────────────────────────────────────────────────

  private async getLinkedLocalId(
    entityType: string,
    shopifyId: string,
  ): Promise<string | null> {
    const [record] = await db
      .select({ nzilaRecordId: commerceShopifySyncRecords.nzilaRecordId })
      .from(commerceShopifySyncRecords)
      .where(
        and(
          eq(commerceShopifySyncRecords.orgId, this.orgId),
          eq(commerceShopifySyncRecords.entityType, entityType),
          eq(commerceShopifySyncRecords.shopifyId, shopifyId),
        ),
      )
      .limit(1)
    return record?.nzilaRecordId ?? null
  }

  private async getLastSyncTime(entityType: string): Promise<Date | null> {
    const [record] = await db
      .select({ lastSyncedAt: commerceShopifySyncRecords.lastSyncedAt })
      .from(commerceShopifySyncRecords)
      .where(
        and(
          eq(commerceShopifySyncRecords.orgId, this.orgId),
          eq(commerceShopifySyncRecords.entityType, entityType),
          eq(commerceShopifySyncRecords.syncStatus, 'synced'),
        ),
      )
      .limit(1)
    return record?.lastSyncedAt ?? null
  }

  private async createSyncRecord(
    entityType: string,
    localId: string,
    shopifyId: string,
    status: 'synced' | 'failed',
  ): Promise<void> {
    await db.insert(commerceShopifySyncRecords).values({
      orgId: this.orgId,
      entityType,
      nzilaRecordId: localId,
      shopifyId,
      syncStatus: status,
      lastSyncedAt: new Date(),
    })
  }

  private async updateSyncRecord(
    entityType: string,
    localId: string,
    shopifyId: string,
    status: 'synced' | 'failed',
  ): Promise<void> {
    await db
      .update(commerceShopifySyncRecords)
      .set({
        syncStatus: status,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(commerceShopifySyncRecords.orgId, this.orgId),
          eq(commerceShopifySyncRecords.entityType, entityType),
          eq(commerceShopifySyncRecords.nzilaRecordId, localId),
        ),
      )
  }
}
