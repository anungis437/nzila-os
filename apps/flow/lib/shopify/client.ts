/**
 * Shopify Admin API Client
 *
 * Handles HTTP requests to Shopify Admin REST API (2024-01).
 * Uses the store's permanent access token for authentication.
 */

import { logger } from '../logger'
import type {
  ShopifyProduct,
  ShopifyOrder,
  ShopifyCustomer,
  ShopifyCredentials,
} from './types'

const API_VERSION = '2024-01'

export class ShopifyClient {
  private shopDomain: string
  private accessToken: string

  constructor(credentials: ShopifyCredentials) {
    this.shopDomain = credentials.shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    this.accessToken = credentials.accessToken
  }

  private get baseUrl(): string {
    return `https://${this.shopDomain}/admin/api/${API_VERSION}`
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Products
  // ─────────────────────────────────────────────────────────────────────────

  async getProducts(params?: {
    limit?: number
    since_id?: number
    updated_at_min?: string
  }): Promise<ShopifyProduct[]> {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.since_id) query.set('since_id', String(params.since_id))
    if (params?.updated_at_min) query.set('updated_at_min', params.updated_at_min)

    const response = await this.apiRequest<{ products: ShopifyProduct[] }>(
      'GET',
      `/products.json?${query.toString()}`,
    )
    return response.products
  }

  async getProductById(id: number): Promise<ShopifyProduct | null> {
    try {
      const response = await this.apiRequest<{ product: ShopifyProduct }>(
        'GET',
        `/products/${id}.json`,
      )
      return response.product
    } catch {
      return null
    }
  }

  async createProduct(data: Partial<ShopifyProduct>): Promise<ShopifyProduct> {
    const response = await this.apiRequest<{ product: ShopifyProduct }>(
      'POST',
      '/products.json',
      { product: data },
    )
    return response.product
  }

  async updateProduct(id: number, data: Partial<ShopifyProduct>): Promise<ShopifyProduct> {
    const response = await this.apiRequest<{ product: ShopifyProduct }>(
      'PUT',
      `/products/${id}.json`,
      { product: { ...data, id } },
    )
    return response.product
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Orders
  // ─────────────────────────────────────────────────────────────────────────

  async getOrders(params?: {
    limit?: number
    since_id?: number
    updated_at_min?: string
    status?: 'open' | 'closed' | 'cancelled' | 'any'
  }): Promise<ShopifyOrder[]> {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.since_id) query.set('since_id', String(params.since_id))
    if (params?.updated_at_min) query.set('updated_at_min', params.updated_at_min)
    if (params?.status) query.set('status', params.status)

    const response = await this.apiRequest<{ orders: ShopifyOrder[] }>(
      'GET',
      `/orders.json?${query.toString()}`,
    )
    return response.orders
  }

  async getOrderById(id: number): Promise<ShopifyOrder | null> {
    try {
      const response = await this.apiRequest<{ order: ShopifyOrder }>(
        'GET',
        `/orders/${id}.json`,
      )
      return response.order
    } catch {
      return null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Customers
  // ─────────────────────────────────────────────────────────────────────────

  async getCustomers(params?: {
    limit?: number
    since_id?: number
    updated_at_min?: string
  }): Promise<ShopifyCustomer[]> {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.since_id) query.set('since_id', String(params.since_id))
    if (params?.updated_at_min) query.set('updated_at_min', params.updated_at_min)

    const response = await this.apiRequest<{ customers: ShopifyCustomer[] }>(
      'GET',
      `/customers.json?${query.toString()}`,
    )
    return response.customers
  }

  async getCustomerById(id: number): Promise<ShopifyCustomer | null> {
    try {
      const response = await this.apiRequest<{ customer: ShopifyCustomer }>(
        'GET',
        `/customers/${id}.json`,
      )
      return response.customer
    } catch {
      return null
    }
  }

  async searchCustomers(query: string): Promise<ShopifyCustomer[]> {
    const response = await this.apiRequest<{ customers: ShopifyCustomer[] }>(
      'GET',
      `/customers/search.json?query=${encodeURIComponent(query)}`,
    )
    return response.customers
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generic Request Handler
  // ─────────────────────────────────────────────────────────────────────────

  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers: HeadersInit = {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    }

    const options: RequestInit = { method, headers }
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body)
    }

    logger.debug('Shopify API request', { method, endpoint })

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Shopify API error', {
        status: response.status,
        error: errorText,
        endpoint,
      })
      throw new Error(`Shopify API error ${response.status}: ${errorText}`)
    }

    return response.json() as Promise<T>
  }
}
