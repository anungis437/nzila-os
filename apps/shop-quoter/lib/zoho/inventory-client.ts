/**
 * Zoho Inventory API Client
 *
 * Handles HTTP requests to Zoho Inventory API for items, warehouses, and stock.
 * Ported from legacy shop_quoter_tool_v1 zoho-crm-integration.ts.
 */

import { logger } from '../logger'
import type { ZohoOAuthClient } from './oauth'
import type {
  ZohoApiResponse,
  ZohoItem,
  ZohoWarehouse,
  ZohoStockAdjustment,
  ZohoTransferOrder,
  ZohoErrorResponse,
} from './types'

const ZOHO_INVENTORY_API_BASE = '/inventory/v1'

export interface ZohoInventoryClientConfig {
  apiServer?: string
  organizationId: string
}

export class ZohoInventoryClient {
  private oauthClient: ZohoOAuthClient
  private apiServer: string
  private organizationId: string

  constructor(oauthClient: ZohoOAuthClient, config: ZohoInventoryClientConfig) {
    this.oauthClient = oauthClient
    this.apiServer = config.apiServer ?? 'https://www.zohoapis.com'
    this.organizationId = config.organizationId
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Items (Products)
  // ─────────────────────────────────────────────────────────────────────────

  async getItems(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoItem>> {
    return this.apiRequest<ZohoItem>('GET', '/items', {
      page,
      per_page: perPage,
    })
  }

  async getItemById(id: string): Promise<ZohoItem | null> {
    const response = await this.apiRequest<{ item: ZohoItem }>('GET', `/items/${id}`)
    const data = response.data?.[0] as unknown as { item?: ZohoItem } | undefined
    return data?.item ?? null
  }

  async getItemBySku(sku: string): Promise<ZohoItem | null> {
    const response = await this.apiRequest<ZohoItem>('GET', '/items', { sku })
    return response.data?.[0] ?? null
  }

  async createItem(data: Partial<ZohoItem>): Promise<ZohoItem> {
    const response = await this.apiRequest<{ item: ZohoItem }>(
      'POST',
      '/items',
      undefined,
      { item: data },
    )
    const result = response.data?.[0] as unknown as { item?: ZohoItem } | undefined
    if (!result?.item) {
      throw new Error('Failed to create Zoho item')
    }
    return result.item
  }

  async updateItem(id: string, data: Partial<ZohoItem>): Promise<ZohoItem> {
    const response = await this.apiRequest<{ item: ZohoItem }>(
      'PUT',
      `/items/${id}`,
      undefined,
      { item: data },
    )
    const result = response.data?.[0] as unknown as { item?: ZohoItem } | undefined
    if (!result?.item) {
      throw new Error('Failed to update Zoho item')
    }
    return result.item
  }

  async deleteItem(id: string): Promise<void> {
    await this.apiRequest<never>('DELETE', `/items/${id}`)
  }

  async markItemAsActive(id: string): Promise<void> {
    await this.apiRequest<never>('POST', `/items/${id}/active`)
  }

  async markItemAsInactive(id: string): Promise<void> {
    await this.apiRequest<never>('POST', `/items/${id}/inactive`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Warehouses
  // ─────────────────────────────────────────────────────────────────────────

  async getWarehouses(): Promise<ZohoApiResponse<ZohoWarehouse>> {
    return this.apiRequest<ZohoWarehouse>('GET', '/settings/warehouses')
  }

  async getWarehouseById(id: string): Promise<ZohoWarehouse | null> {
    const response = await this.apiRequest<{ warehouse: ZohoWarehouse }>(
      'GET',
      `/settings/warehouses/${id}`,
    )
    const data = response.data?.[0] as unknown as { warehouse?: ZohoWarehouse } | undefined
    return data?.warehouse ?? null
  }

  async createWarehouse(data: Partial<ZohoWarehouse>): Promise<ZohoWarehouse> {
    const response = await this.apiRequest<{ warehouse: ZohoWarehouse }>(
      'POST',
      '/settings/warehouses',
      undefined,
      data,
    )
    const result = response.data?.[0] as unknown as { warehouse?: ZohoWarehouse } | undefined
    if (!result?.warehouse) {
      throw new Error('Failed to create Zoho warehouse')
    }
    return result.warehouse
  }

  async updateWarehouse(id: string, data: Partial<ZohoWarehouse>): Promise<ZohoWarehouse> {
    const response = await this.apiRequest<{ warehouse: ZohoWarehouse }>(
      'PUT',
      `/settings/warehouses/${id}`,
      undefined,
      data,
    )
    const result = response.data?.[0] as unknown as { warehouse?: ZohoWarehouse } | undefined
    if (!result?.warehouse) {
      throw new Error('Failed to update Zoho warehouse')
    }
    return result.warehouse
  }

  async deleteWarehouse(id: string): Promise<void> {
    await this.apiRequest<never>('DELETE', `/settings/warehouses/${id}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stock / Inventory Adjustments
  // ─────────────────────────────────────────────────────────────────────────

  async getItemStock(itemId: string): Promise<Record<string, number>> {
    const response = await this.apiRequest<{ available_stock: Record<string, number> }>(
      'GET',
      `/items/${itemId}`,
    )
    const data = response.data?.[0] as unknown as { item?: { warehouses?: Array<{ warehouse_id: string; warehouse_stock_on_hand: number }> } } | undefined
    const warehouses = data?.item?.warehouses ?? []

    const stockMap: Record<string, number> = {}
    for (const wh of warehouses) {
      stockMap[wh.warehouse_id] = wh.warehouse_stock_on_hand
    }
    return stockMap
  }

  async createStockAdjustment(data: Partial<ZohoStockAdjustment>): Promise<ZohoStockAdjustment> {
    const response = await this.apiRequest<{ inventory_adjustment: ZohoStockAdjustment }>(
      'POST',
      '/inventoryadjustments',
      undefined,
      { inventory_adjustment: data },
    )
    const result = response.data?.[0] as unknown as { inventory_adjustment?: ZohoStockAdjustment } | undefined
    if (!result?.inventory_adjustment) {
      throw new Error('Failed to create Zoho stock adjustment')
    }
    return result.inventory_adjustment
  }

  async getStockAdjustments(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoStockAdjustment>> {
    return this.apiRequest<ZohoStockAdjustment>('GET', '/inventoryadjustments', {
      page,
      per_page: perPage,
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Composite Items (Bundles / Kits)
  // ─────────────────────────────────────────────────────────────────────────

  async getCompositeItems(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoItem>> {
    return this.apiRequest<ZohoItem>('GET', '/compositeitems', {
      page,
      per_page: perPage,
    })
  }

  async createCompositeItem(
    data: Partial<ZohoItem> & { mapped_items: Array<{ item_id: string; quantity: number }> },
  ): Promise<ZohoItem> {
    const response = await this.apiRequest<{ composite_item: ZohoItem }>(
      'POST',
      '/compositeitems',
      undefined,
      { composite_item: data },
    )
    const result = response.data?.[0] as unknown as { composite_item?: ZohoItem } | undefined
    if (!result?.composite_item) {
      throw new Error('Failed to create Zoho composite item')
    }
    return result.composite_item
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Item Groups (Variants)
  // ─────────────────────────────────────────────────────────────────────────

  async getItemGroups(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoItem>> {
    return this.apiRequest<ZohoItem>('GET', '/itemgroups', {
      page,
      per_page: perPage,
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transfer Orders (between warehouses)
  // ─────────────────────────────────────────────────────────────────────────

  async createTransferOrder(data: {
    from_warehouse_id: string
    to_warehouse_id: string
    line_items: Array<{ item_id: string; quantity: number }>
    date?: string
    notes?: string
  }): Promise<ZohoTransferOrder> {
    const response = await this.apiRequest<{ transfer_order: ZohoTransferOrder }>(
      'POST',
      '/transferorders',
      undefined,
      { transfer_order: data },
    )
    const result = response.data?.[0] as unknown as { transfer_order?: ZohoTransferOrder } | undefined
    if (!result?.transfer_order) {
      throw new Error('Failed to create transfer order')
    }
    return result.transfer_order
  }

  async getTransferOrders(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoTransferOrder>> {
    return this.apiRequest<ZohoTransferOrder>('GET', '/transferorders', {
      page,
      per_page: perPage,
    })
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

    // Build URL with organization_id (required for Inventory API)
    const baseParams = { organization_id: this.organizationId }
    const allParams = { ...baseParams, ...queryParams }

    let url = `${this.apiServer}${ZOHO_INVENTORY_API_BASE}${endpoint}`
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

    logger.debug('Zoho Inventory API request', { method, url })

    const response = await fetch(url, options)
    const responseBody = await response.json()

    if (!response.ok || responseBody.code !== 0) {
      const errorBody = responseBody as ZohoErrorResponse
      logger.error('Zoho Inventory API error', {
        status: response.status,
        error: errorBody,
        endpoint,
      })
      throw new Error(`Zoho Inventory API error: ${errorBody.message || response.statusText}`)
    }

    // Zoho Inventory wraps response similarly to Books
    return {
      data: responseBody.items ?? responseBody.warehouses ?? [responseBody],
      info: responseBody.page_context,
    } as ZohoApiResponse<T>
  }
}
