/**
 * Zoho Integration Types
 *
 * Type definitions for Zoho CRM, Books, and Inventory API integration.
 * Ported from legacy shop_quoter_tool_v1.
 */

// ═══════════════════════════════════════════════════════════════════════════
// OAuth & Credentials
// ═══════════════════════════════════════════════════════════════════════════

export interface ZohoCredentials {
  accessToken: string
  refreshToken: string
  tokenExpiry: Date
  accountsServer: string
  apiServer: string
}

export interface ZohoOAuthTokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  api_domain: string
  scope: string
}

export interface ZohoOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scope: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// API Response Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ZohoApiResponse<T> {
  data?: T[]
  info?: {
    per_page: number
    count: number
    page: number
    more_records: boolean
  }
  status?: string
  message?: string
  code?: string
}

export interface ZohoErrorResponse {
  code: string
  status: 'error'
  message: string
  details?: Record<string, unknown>
}

// ═══════════════════════════════════════════════════════════════════════════
// Zoho CRM Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ZohoContact {
  id: string
  First_Name?: string
  Last_Name: string
  Email?: string
  Phone?: string
  Mobile?: string
  Account_Name?: { id: string; name: string }
  Mailing_Street?: string
  Mailing_City?: string
  Mailing_State?: string
  Mailing_Zip?: string
  Mailing_Country?: string
  Created_Time: string
  Modified_Time: string
  Owner?: { id: string; name: string; email?: string }
}

export interface ZohoDeal {
  id: string
  Deal_Name: string
  Amount?: number
  Stage: string
  Closing_Date?: string
  Contact_Name?: { id: string; name: string }
  Account_Name?: { id: string; name: string }
  Description?: string
  Created_Time: string
  Modified_Time: string
  Owner?: { id: string; name: string; email?: string }
}

export interface ZohoAccount {
  id: string
  Account_Name: string
  Phone?: string
  Website?: string
  Billing_Street?: string
  Billing_City?: string
  Billing_State?: string
  Billing_Code?: string
  Billing_Country?: string
  Created_Time: string
  Modified_Time: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Zoho Books Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ZohoVendor {
  vendor_id: string
  contact_name: string
  company_name?: string
  email?: string
  phone?: string
  currency_code: string
  payment_terms: number
  payment_terms_label: string
  created_time: string
  last_modified_time: string
}

export interface ZohoPurchaseOrder {
  purchaseorder_id: string
  purchaseorder_number: string
  date: string
  delivery_date?: string
  vendor_id: string
  vendor_name: string
  status: 'draft' | 'open' | 'billed' | 'cancelled'
  currency_code: string
  sub_total: number
  tax_total: number
  total: number
  line_items: ZohoPurchaseOrderLine[]
  created_time: string
  last_modified_time: string
}

export interface ZohoPurchaseOrderLine {
  line_item_id: string
  item_id?: string
  name: string
  description?: string
  quantity: number
  rate: number
  amount: number
}

export interface ZohoInvoice {
  invoice_id: string
  invoice_number: string
  date: string
  due_date: string
  customer_id: string
  customer_name: string
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void'
  currency_code: string
  sub_total: number
  tax_total: number
  total: number
  balance: number
  line_items: ZohoInvoiceLine[]
  created_time: string
  last_modified_time: string
}

export interface ZohoInvoiceLine {
  line_item_id: string
  item_id?: string
  name: string
  description?: string
  quantity: number
  rate: number
  amount: number
  tax_id?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Zoho Inventory Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ZohoItem {
  item_id: string
  name: string
  sku?: string
  description?: string
  rate: number
  purchase_rate?: number
  unit: string
  stock_on_hand?: number
  reorder_level?: number
  vendor_id?: string
  vendor_name?: string
  status: 'active' | 'inactive'
  created_time: string
  last_modified_time: string
}

export interface ZohoWarehouse {
  warehouse_id: string
  warehouse_name: string
  is_primary: boolean
  status: 'active' | 'inactive'
  address?: {
    address: string
    city: string
    state: string
    zip: string
    country: string
  }
}

export interface ZohoStockAdjustment {
  adjustment_id: string
  adjustment_number: string
  date: string
  reason: string
  description?: string
  warehouse_id: string
  warehouse_name: string
  line_items: ZohoStockAdjustmentLine[]
  created_time: string
  last_modified_time: string
}

export interface ZohoStockAdjustmentLine {
  item_id: string
  name: string
  sku?: string
  warehouse_id: string
  quantity_adjusted: number
  unit: string
}

export interface ZohoTransferOrder {
  transfer_order_id: string
  transfer_order_number: string
  date: string
  from_warehouse_id: string
  from_warehouse_name?: string
  to_warehouse_id: string
  to_warehouse_name?: string
  status: 'draft' | 'in_transit' | 'received' | 'cancelled'
  notes?: string
  line_items: ZohoTransferOrderLine[]
  created_time?: string
  last_modified_time?: string
}

export interface ZohoTransferOrderLine {
  item_id: string
  name?: string
  sku?: string
  quantity: number
  quantity_received?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Sync Configuration Types
// ═══════════════════════════════════════════════════════════════════════════

export type SyncDirection = 'bidirectional' | 'to_zoho' | 'from_zoho'
export type ConflictResolution = 'zoho_wins' | 'nzila_wins' | 'newest_wins' | 'manual'
export type SyncFrequency = 'realtime' | 'hourly' | 'daily' | 'manual'

export interface FieldMapping {
  nzilaField: string
  zohoField: string
  required: boolean
  transform?: 'uppercase' | 'lowercase' | 'date' | 'currency' | 'json' | 'custom'
  customTransform?: (value: unknown, direction: SyncDirection) => unknown
}

export interface SyncConfig {
  id: string
  entityId: string
  name: string
  nzilaTable: string
  zohoModule: string
  syncDirection: SyncDirection
  fieldMappings: FieldMapping[]
  syncFrequency: SyncFrequency
  conflictResolution: ConflictResolution
  isActive: boolean
  webhookUrl?: string
  lastSyncAt?: Date
}

// ═══════════════════════════════════════════════════════════════════════════
// Sync Operation Types
// ═══════════════════════════════════════════════════════════════════════════

export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface SyncResult {
  configId: string
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsFailed: number
  conflicts: SyncConflict[]
  errors: SyncError[]
  startedAt: Date
  completedAt?: Date
  status: SyncStatus
}

export interface SyncConflict {
  syncRecordId: string
  nzilaRecordId: string
  zohoRecordId?: string
  nzilaData: Record<string, unknown>
  zohoData: Record<string, unknown>
  conflictFields: string[]
  suggestedResolution?: ConflictResolution
}

export interface SyncError {
  recordId: string
  operation: 'create' | 'update' | 'delete'
  errorCode: string
  errorMessage: string
  retryable: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// Webhook Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ZohoWebhookPayload {
  module: string
  operation: 'insert' | 'update' | 'delete'
  ids: string[]
  token?: string
  timestamp: string
}

export interface ZohoWebhookConfig {
  channel_id: string
  events: string[]
  notify_url: string
  token: string
  channel_expiry: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Module Mapping (Nzila <-> Zoho)
// ═══════════════════════════════════════════════════════════════════════════

export const ZOHO_MODULE_MAPPING = {
  commerce_customers: 'Contacts',
  commerce_quotes: 'Deals',
  commerce_orders: 'SalesOrders',
  commerce_invoices: 'Invoices',
  commerce_suppliers: 'Vendors',
  commerce_products: 'Items',
  commerce_purchase_orders: 'PurchaseOrders',
} as const

export type NzilaTable = keyof typeof ZOHO_MODULE_MAPPING
export type ZohoModule = (typeof ZOHO_MODULE_MAPPING)[NzilaTable]
