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
import { db } from '@nzila/db'
import { commerceSuppliers } from '@nzila/db/schema'
import { and, eq } from 'drizzle-orm'

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
        const vendors = (await books.getVendors()).data ?? []
        let synced = 0
        let errors = 0

        for (const vendor of vendors) {
          try {
            const [existing] = await db
              .select({ id: commerceSuppliers.id })
              .from(commerceSuppliers)
              .where(
                and(
                  eq(commerceSuppliers.orgId, config.orgId),
                  eq(commerceSuppliers.zohoVendorId, vendor.vendor_id),
                ),
              )
              .limit(1)

            const values = {
              orgId: config.orgId,
              name: vendor.company_name || vendor.contact_name || `Vendor ${vendor.vendor_id}`,
              contactName: vendor.contact_name || null,
              email: vendor.email || null,
              phone: vendor.phone || null,
              paymentTerms: vendor.payment_terms_label || null,
              leadTimeDays: 14,
              status: 'active' as const,
              zohoVendorId: vendor.vendor_id,
              metadata: {
                source: 'zoho-books',
                currencyCode: vendor.currency_code,
                paymentTermsDays: vendor.payment_terms,
                lastModifiedTime: vendor.last_modified_time,
              },
              updatedAt: new Date(),
            }

            if (existing) {
              await db
                .update(commerceSuppliers)
                .set(values)
                .where(eq(commerceSuppliers.id, existing.id))
            } else {
              await db.insert(commerceSuppliers).values(values)
            }

            synced += 1
          } catch {
            errors += 1
          }
        }

        return { synced, errors }
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
