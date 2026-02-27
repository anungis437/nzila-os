/**
 * Zoho CRM API Client
 *
 * Handles HTTP requests to Zoho CRM API with automatic token refresh.
 * Ported from legacy shop_quoter_tool_v1 zoho-crm-integration.ts.
 */

import { logger } from '../logger'
import type { ZohoOAuthClient } from './oauth'
import type {
  ZohoApiResponse,
  ZohoContact,
  ZohoDeal,
  ZohoAccount,
  ZohoErrorResponse,
} from './types'

const ZOHO_CRM_API_BASE = '/crm/v3'

export interface ZohoCrmClientConfig {
  apiServer?: string
}

export class ZohoCrmClient {
  private oauthClient: ZohoOAuthClient
  private apiServer: string

  constructor(oauthClient: ZohoOAuthClient, config?: ZohoCrmClientConfig) {
    this.oauthClient = oauthClient
    this.apiServer = config?.apiServer ?? 'https://www.zohoapis.com'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Contacts (maps to commerce_customers)
  // ─────────────────────────────────────────────────────────────────────────

  async getContacts(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoContact>> {
    return this.apiRequest<ZohoContact>('GET', '/Contacts', {
      page,
      per_page: perPage,
    })
  }

  async getContactById(id: string): Promise<ZohoContact | null> {
    const response = await this.apiRequest<ZohoContact>('GET', `/Contacts/${id}`)
    return response.data?.[0] ?? null
  }

  async createContact(data: Partial<ZohoContact>): Promise<ZohoContact> {
    const response = await this.apiRequest<ZohoContact>('POST', '/Contacts', undefined, {
      data: [data],
    })
    if (!response.data?.[0]) {
      throw new Error('Failed to create Zoho contact')
    }
    return response.data[0]
  }

  async updateContact(id: string, data: Partial<ZohoContact>): Promise<ZohoContact> {
    const response = await this.apiRequest<ZohoContact>('PUT', `/Contacts/${id}`, undefined, {
      data: [{ ...data, id }],
    })
    if (!response.data?.[0]) {
      throw new Error('Failed to update Zoho contact')
    }
    return response.data[0]
  }

  async deleteContact(id: string): Promise<void> {
    await this.apiRequest<never>('DELETE', `/Contacts/${id}`)
  }

  async searchContacts(criteria: string): Promise<ZohoApiResponse<ZohoContact>> {
    return this.apiRequest<ZohoContact>('GET', '/Contacts/search', { criteria })
  }

  async searchContactsByEmail(email: string): Promise<ZohoContact | null> {
    const response = await this.searchContacts(`(Email:equals:${email})`)
    return response.data?.[0] ?? null
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Deals (maps to commerce_quotes when converted)
  // ─────────────────────────────────────────────────────────────────────────

  async getDeals(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoDeal>> {
    return this.apiRequest<ZohoDeal>('GET', '/Deals', {
      page,
      per_page: perPage,
    })
  }

  async getDealById(id: string): Promise<ZohoDeal | null> {
    const response = await this.apiRequest<ZohoDeal>('GET', `/Deals/${id}`)
    return response.data?.[0] ?? null
  }

  async createDeal(data: Partial<ZohoDeal>): Promise<ZohoDeal> {
    const response = await this.apiRequest<ZohoDeal>('POST', '/Deals', undefined, {
      data: [data],
    })
    if (!response.data?.[0]) {
      throw new Error('Failed to create Zoho deal')
    }
    return response.data[0]
  }

  async updateDeal(id: string, data: Partial<ZohoDeal>): Promise<ZohoDeal> {
    const response = await this.apiRequest<ZohoDeal>('PUT', `/Deals/${id}`, undefined, {
      data: [{ ...data, id }],
    })
    if (!response.data?.[0]) {
      throw new Error('Failed to update Zoho deal')
    }
    return response.data[0]
  }

  async deleteDeal(id: string): Promise<void> {
    await this.apiRequest<never>('DELETE', `/Deals/${id}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Accounts (companies)
  // ─────────────────────────────────────────────────────────────────────────

  async getAccounts(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoAccount>> {
    return this.apiRequest<ZohoAccount>('GET', '/Accounts', {
      page,
      per_page: perPage,
    })
  }

  async getAccountById(id: string): Promise<ZohoAccount | null> {
    const response = await this.apiRequest<ZohoAccount>('GET', `/Accounts/${id}`)
    return response.data?.[0] ?? null
  }

  async createAccount(data: Partial<ZohoAccount>): Promise<ZohoAccount> {
    const response = await this.apiRequest<ZohoAccount>('POST', '/Accounts', undefined, {
      data: [data],
    })
    if (!response.data?.[0]) {
      throw new Error('Failed to create Zoho account')
    }
    return response.data[0]
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

    let url = `${this.apiServer}${ZOHO_CRM_API_BASE}${endpoint}`
    if (queryParams) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(queryParams)) {
        params.set(key, String(value))
      }
      url += `?${params.toString()}`
    }

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

    logger.debug({ method, url }, 'Zoho CRM API request')

    const response = await fetch(url, options)
    const responseBody = await response.json()

    if (!response.ok) {
      const errorBody = responseBody as ZohoErrorResponse
      logger.error(
        { status: response.status, error: errorBody, endpoint },
        'Zoho CRM API error',
      )
      throw new Error(`Zoho CRM API error: ${errorBody.message || response.statusText}`)
    }

    return responseBody as ZohoApiResponse<T>
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────────────────

  async bulkCreateContacts(contacts: Partial<ZohoContact>[]): Promise<ZohoApiResponse<ZohoContact>> {
    if (contacts.length > 100) {
      throw new Error('Zoho CRM bulk operations limited to 100 records')
    }
    return this.apiRequest<ZohoContact>('POST', '/Contacts', undefined, {
      data: contacts,
    })
  }

  async bulkUpdateContacts(contacts: Array<{ id: string } & Partial<ZohoContact>>): Promise<ZohoApiResponse<ZohoContact>> {
    if (contacts.length > 100) {
      throw new Error('Zoho CRM bulk operations limited to 100 records')
    }
    return this.apiRequest<ZohoContact>('PUT', '/Contacts', undefined, {
      data: contacts,
    })
  }

  async bulkCreateDeals(deals: Partial<ZohoDeal>[]): Promise<ZohoApiResponse<ZohoDeal>> {
    if (deals.length > 100) {
      throw new Error('Zoho CRM bulk operations limited to 100 records')
    }
    return this.apiRequest<ZohoDeal>('POST', '/Deals', undefined, {
      data: deals,
    })
  }
}
