/**
 * Integration adapters barrel — Flow
 */
export { createShopifyAdapter, type ShopifyAdapterConfig, type PushOrderResult, type SyncProductsResult, type FulfillmentStatus } from './shopify.adapter'
export { createZohoAdapter, type ZohoAdapterConfig, type SyncVendorsResult, type PushPOResult, type PushInvoiceResult } from './zoho.adapter'
export { createCanvaAdapter, type CanvaAdapterConfig, type CanvaDesignRef, type CanvaExportResult } from './canva.adapter'
