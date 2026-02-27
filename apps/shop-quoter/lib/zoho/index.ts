/**
 * Zoho Integration Module
 *
 * Re-exports all Zoho integration components for shop-quoter.
 */

// Types
export * from './types'

// OAuth Client
export { ZohoOAuthClient, createZohoOAuthClient } from './oauth'

// CRM Client
export { ZohoCrmClient, type ZohoCrmClientConfig } from './crm-client'

// Books Client (Vendors, Purchase Orders, Invoices)
export { ZohoBooksClient, type ZohoBooksClientConfig } from './books-client'

// Inventory Client (Items, Warehouses, Stock)
export { ZohoInventoryClient, type ZohoInventoryClientConfig } from './inventory-client'

// Sync Service
export {
  ZohoSyncService,
  type SyncDirection,
  type SyncModule,
  type SyncOptions,
} from './sync-service'
