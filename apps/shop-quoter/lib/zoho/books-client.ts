/**
 * Zoho Books API Client
 *
 * Handles HTTP requests to Zoho Books API for vendors, purchase orders, and invoices.
 * Ported from legacy shop_quoter_tool_v1 zoho-crm-integration.ts.
 */

import { logger } from '../logger'
import type { ZohoOAuthClient } from './oauth'
import type {
  ZohoApiResponse,
  ZohoVendor,
  ZohoPurchaseOrder,
  ZohoInvoice,
  ZohoErrorResponse,
} from './types'

const ZOHO_BOOKS_API_BASE = '/books/v3'

export interface ZohoBooksClientConfig {
  apiServer?: string
  organizationId: string
}

export class ZohoBooksClient {
  private oauthClient: ZohoOAuthClient
  private apiServer: string
  private organizationId: string

  constructor(oauthClient: ZohoOAuthClient, config: ZohoBooksClientConfig) {
    this.oauthClient = oauthClient
    this.apiServer = config.apiServer ?? 'https://www.zohoapis.com'
    this.organizationId = config.organizationId
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Vendors (suppliers)
  // ─────────────────────────────────────────────────────────────────────────

  async getVendors(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoVendor>> {
    return this.apiRequest<ZohoVendor>('GET', '/vendors', {
      page,
      per_page: perPage,
    })
  }

  async getVendorById(id: string): Promise<ZohoVendor | null> {
    const response = await this.apiRequest<{ vendor: ZohoVendor }>('GET', `/vendors/${id}`)
    // Zoho Books returns vendor nested in response
    const data = response.data?.[0] as unknown as { vendor?: ZohoVendor } | undefined
    return data?.vendor ?? null
  }

  async createVendor(data: Partial<ZohoVendor>): Promise<ZohoVendor> {
    const response = await this.apiRequest<{ vendor: ZohoVendor }>(
      'POST',
      '/vendors',
      undefined,
      data,
    )
    const result = response.data?.[0] as unknown as { vendor?: ZohoVendor } | undefined
    if (!result?.vendor) {
      throw new Error('Failed to create Zoho vendor')
    }
    return result.vendor
  }

  async updateVendor(id: string, data: Partial<ZohoVendor>): Promise<ZohoVendor> {
    const response = await this.apiRequest<{ vendor: ZohoVendor }>(
      'PUT',
      `/vendors/${id}`,
      undefined,
      data,
    )
    const result = response.data?.[0] as unknown as { vendor?: ZohoVendor } | undefined
    if (!result?.vendor) {
      throw new Error('Failed to update Zoho vendor')
    }
    return result.vendor
  }

  async deleteVendor(id: string): Promise<void> {
    await this.apiRequest<never>('DELETE', `/vendors/${id}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Purchase Orders
  // ─────────────────────────────────────────────────────────────────────────

  async getPurchaseOrders(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoPurchaseOrder>> {
    return this.apiRequest<ZohoPurchaseOrder>('GET', '/purchaseorders', {
      page,
      per_page: perPage,
    })
  }

  async getPurchaseOrderById(id: string): Promise<ZohoPurchaseOrder | null> {
    const response = await this.apiRequest<{ purchaseorder: ZohoPurchaseOrder }>(
      'GET',
      `/purchaseorders/${id}`,
    )
    const data = response.data?.[0] as unknown as { purchaseorder?: ZohoPurchaseOrder } | undefined
    return data?.purchaseorder ?? null
  }

  async createPurchaseOrder(data: Partial<ZohoPurchaseOrder>): Promise<ZohoPurchaseOrder> {
    const response = await this.apiRequest<{ purchaseorder: ZohoPurchaseOrder }>(
      'POST',
      '/purchaseorders',
      undefined,
      { purchaseorder: data },
    )
    const result = response.data?.[0] as unknown as { purchaseorder?: ZohoPurchaseOrder } | undefined
    if (!result?.purchaseorder) {
      throw new Error('Failed to create Zoho purchase order')
    }
    return result.purchaseorder
  }

  async updatePurchaseOrder(id: string, data: Partial<ZohoPurchaseOrder>): Promise<ZohoPurchaseOrder> {
    const response = await this.apiRequest<{ purchaseorder: ZohoPurchaseOrder }>(
      'PUT',
      `/purchaseorders/${id}`,
      undefined,
      { purchaseorder: data },
    )
    const result = response.data?.[0] as unknown as { purchaseorder?: ZohoPurchaseOrder } | undefined
    if (!result?.purchaseorder) {
      throw new Error('Failed to update Zoho purchase order')
    }
    return result.purchaseorder
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    await this.apiRequest<never>('DELETE', `/purchaseorders/${id}`)
  }

  async submitPurchaseOrder(id: string): Promise<void> {
    await this.apiRequest<never>('POST', `/purchaseorders/${id}/submit`)
  }

  async approvePurchaseOrder(id: string): Promise<void> {
    await this.apiRequest<never>('POST', `/purchaseorders/${id}/approve`)
  }

  async markPurchaseOrderAsOpen(id: string): Promise<void> {
    await this.apiRequest<never>('POST', `/purchaseorders/${id}/status/open`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Invoices
  // ─────────────────────────────────────────────────────────────────────────

  async getInvoices(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoInvoice>> {
    return this.apiRequest<ZohoInvoice>('GET', '/invoices', {
      page,
      per_page: perPage,
    })
  }

  async getInvoiceById(id: string): Promise<ZohoInvoice | null> {
    const response = await this.apiRequest<{ invoice: ZohoInvoice }>('GET', `/invoices/${id}`)
    const data = response.data?.[0] as unknown as { invoice?: ZohoInvoice } | undefined
    return data?.invoice ?? null
  }

  async createInvoice(data: Partial<ZohoInvoice>): Promise<ZohoInvoice> {
    const response = await this.apiRequest<{ invoice: ZohoInvoice }>(
      'POST',
      '/invoices',
      undefined,
      { invoice: data },
    )
    const result = response.data?.[0] as unknown as { invoice?: ZohoInvoice } | undefined
    if (!result?.invoice) {
      throw new Error('Failed to create Zoho invoice')
    }
    return result.invoice
  }

  async markInvoiceAsSent(id: string): Promise<void> {
    await this.apiRequest<never>('POST', `/invoices/${id}/status/sent`)
  }

  async markInvoiceAsVoid(id: string): Promise<void> {
    await this.apiRequest<never>('POST', `/invoices/${id}/status/void`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generic API Request Handler
  // ─────────────────────────────────────────────────────────────────────────

  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    queryParams?: Record<string, string | number>,
    body?: unknown,
  ): Promise<ZohoApiResponse<T>> {
    const accessToken = await this.oauthClient.getAccessToken()

    // Build URL with organization_id (required for Books API)
    const baseParams = { organization_id: this.organizationId }
    const allParams = { ...baseParams, ...queryParams }

    let url = `${this.apiServer}${ZOHO_BOOKS_API_BASE}${endpoint}`
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(allParams)) {
      params.set(key, String(value))
    }
    url += `?${params.toString()}`

    const headers: HeadersInit = {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body)
    }

    logger.debug('Zoho Books API request', { method, url })

    const response = await fetch(url, options)
    const responseBody = await response.json()

    if (!response.ok || responseBody.code !== 0) {
      const errorBody = responseBody as ZohoErrorResponse
      logger.error('Zoho Books API error', {
        status: response.status,
        error: errorBody,
        endpoint,
      })
      throw new Error(`Zoho Books API error: ${errorBody.message || response.statusText}`)
    }

    // Zoho Books wraps response differently than CRM
    return {
      data: responseBody.data ? [responseBody] : [],
      info: responseBody.page_context,
    } as ZohoApiResponse<T>
  }
}
