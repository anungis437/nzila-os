/**
 * Zoho Integration Adapter — Flow
 *
 * Stateless adapter wrapping ZohoBooksClient, ZohoCrmClient, ZohoSyncService.
 * Internal DB is source of truth; Zoho writes are side effects.
 */
import {
  ZohoBooksClient,
  ZohoCrmClient,
  ZohoOAuthClient,
  type ZohoVendor,
  type ZohoPurchaseOrder,
  type ZohoInvoice,
} from '@/lib/zoho'
import { withSpan } from '@nzila/os-core/telemetry'
import type { PurchaseOrder, Invoice } from '@/domain/entities'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ZohoAdapterConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scope?: string[]
  orgId: string
}

export interface SyncVendorsResult {
  synced: number
  errors: number
}

export interface PushPOResult {
  zohoPOId: string
  success: boolean
}

export interface PushInvoiceResult {
  zohoInvoiceId: string
  success: boolean
}

// ── Adapter ────────────────────────────────────────────────────────────────

export function createZohoAdapter(config: ZohoAdapterConfig) {
  const oauth = new ZohoOAuthClient(config.orgId, {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    scope: config.scope ?? ['ZohoBooks.fullaccess.all'],
  })

  const books = new ZohoBooksClient(oauth, {
    organizationId: config.orgId,
  })

  const crm = new ZohoCrmClient(oauth)

  return {
    /**
     * Fetch all vendors from Zoho Books.
     */
    async getVendors(): Promise<ZohoVendor[]> {
      return withSpan('zoho.get_vendors', {}, async () => {
        const result = await books.getVendors()
        return result.data ?? []
      })
    },

    /**
     * Push an internal purchase order to Zoho Books.
     */
    async pushPurchaseOrder(po: PurchaseOrder): Promise<PushPOResult> {
      return withSpan('zoho.push_po', { 'po.id': po.id }, async () => {
        const zohoPO = await books.createPurchaseOrder({
          vendor_id: po.vendor_id,
          purchaseorder_number: po.id,
        } as Partial<ZohoPurchaseOrder>)
        return { zohoPOId: zohoPO.purchaseorder_id, success: true }
      })
    },

    /**
     * Push an internal invoice to Zoho Books.
     */
    async pushInvoice(invoice: Invoice): Promise<PushInvoiceResult> {
      return withSpan('zoho.push_invoice', { 'invoice.id': invoice.id }, async () => {
        const zohoInvoice = await books.createInvoice({
          invoice_number: invoice.id,
          customer_id: invoice.customer_id,
          total: invoice.amount,
        } as Partial<ZohoInvoice>)
        return { zohoInvoiceId: zohoInvoice.invoice_id, success: true }
      })
    },

    /**
     * Sync vendors from Zoho into internal vendor table.
     */
    async syncVendors(): Promise<SyncVendorsResult> {
      return withSpan('zoho.sync_vendors', {}, async () => {
        const _vendors = await books.getVendors()
        // TODO: upsert into internal vendor table via Drizzle
        return { synced: 0, errors: 0 }
      })
    },

    /**
     * Create or update a CRM contact for a customer.
     */
    async syncCustomerToCRM(customer: { name: string; email: string }) {
      return withSpan('zoho.sync_customer_crm', {}, async () => {
        return crm.createContact({
          First_Name: customer.name.split(' ')[0] ?? '',
          Last_Name: customer.name.split(' ').slice(1).join(' ') || customer.name,
          Email: customer.email,
        })
      })
    },
  }
}
