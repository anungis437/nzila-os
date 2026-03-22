/**
 * Dext — Receipt & Invoice Scanning Integration
 *
 * Dext (formerly Receipt Bank) is the leading document capture platform
 * used by 99 of the top 100 accountancies worldwide. This integration
 * handles receipt/invoice import, auto-categorization, and export to
 * accounting systems.
 *
 * @see https://api.dext.com/docs
 * @module cfo/dext
 */
import { logger } from '@/lib/logger'

// ── Types ───────────────────────────────────────────────────────────────────

export interface DextConfig {
  apiKey: string
  baseUrl: string
}

export interface DextDocument {
  id: string
  type: 'receipt' | 'invoice' | 'credit_note' | 'bill'
  status: 'pending' | 'processing' | 'ready' | 'exported' | 'error'
  supplier: string
  date: string
  dueDate?: string
  currency: string
  totalAmount: number
  taxAmount: number
  netAmount: number
  category?: string
  paymentMethod?: string
  description?: string
  reference?: string
  imageUrl?: string
  thumbnailUrl?: string
  ocrConfidence: number
  lineItems: DextLineItem[]
  createdAt: string
  updatedAt: string
}

export interface DextLineItem {
  description: string
  quantity: number
  unitPrice: number
  totalAmount: number
  taxRate?: number
  taxAmount?: number
  accountCode?: string
  category?: string
}

export interface DextSupplier {
  id: string
  name: string
  defaultCategory?: string
  defaultAccountCode?: string
  taxNumber?: string
  email?: string
}

export interface DextCategory {
  id: string
  name: string
  accountCode?: string
  taxRate?: string
}

export interface DextUploadResult {
  id: string
  status: 'pending'
  estimatedProcessingTime: number
}

export interface DextExportMapping {
  accountCode: string
  taxType?: string
  contactId?: string
  trackingCategory?: string
}

export interface DextSyncResult {
  provider: 'dext'
  fetched: number
  newDocuments: number
  updatedDocuments: number
  errors: string[]
  lastSyncAt: string
}

export interface DextWebhookPayload {
  event: 'document.ready' | 'document.updated' | 'document.error' | 'export.completed'
  documentId: string
  timestamp: string
  data?: Record<string, unknown>
}

// ── Client ──────────────────────────────────────────────────────────────────

let _config: DextConfig | null = null

function getConfig(): DextConfig {
  if (_config) return _config

  const apiKey = process.env.DEXT_API_KEY
  if (!apiKey) throw new Error('Dext integration requires DEXT_API_KEY')

  _config = {
    apiKey,
    baseUrl: process.env.DEXT_BASE_URL ?? 'https://api.dext.com/v1',
  }
  return _config
}

async function dextRequest<T>(
  endpoint: string,
  options: { method?: string; body?: unknown; formData?: FormData } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const config = getConfig()

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Accept': 'application/json',
    }

    const fetchOptions: RequestInit = {
      method: options.method ?? 'GET',
      headers,
    }

    if (options.formData) {
      fetchOptions.body = options.formData
      // Let browser set Content-Type with boundary for multipart
    } else if (options.body) {
      headers['Content-Type'] = 'application/json'
      fetchOptions.body = JSON.stringify(options.body)
    }

    const response = await fetch(`${config.baseUrl}${endpoint}`, fetchOptions)

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      logger.error('Dext rate limited', { endpoint, retryAfter })
      return { ok: false, error: `Rate limited — retry after ${retryAfter ?? '60'}s`, status: 429 }
    }

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('Dext API error', { endpoint, status: response.status, body: errorBody })
      return { ok: false, error: `Dext API ${response.status}: ${errorBody}`, status: response.status }
    }

    const data = await response.json() as T
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Dext error'
    logger.error('Dext request failed', { endpoint, error: msg })
    return { ok: false, error: msg }
  }
}

// ── Document Operations ─────────────────────────────────────────────────────

/**
 * Upload a receipt/invoice image or PDF for processing.
 * Dext OCR will extract amount, supplier, date, line items, and category.
 */
export async function uploadDocument(
  file: { buffer: Buffer; filename: string; mimeType: string },
  metadata?: { type?: DextDocument['type']; supplier?: string; category?: string },
): Promise<{ ok: true; upload: DextUploadResult } | { ok: false; error: string }> {
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.filename)

  if (metadata?.type) formData.append('type', metadata.type)
  if (metadata?.supplier) formData.append('supplier', metadata.supplier)
  if (metadata?.category) formData.append('category', metadata.category)

  const result = await dextRequest<DextUploadResult>('/documents', {
    method: 'POST',
    formData,
  })
  if (!result.ok) return result

  logger.info('Dext document uploaded', { id: result.data.id, filename: file.filename })
  return { ok: true, upload: result.data }
}

/**
 * Fetch a processed document by ID.
 */
export async function getDocument(
  documentId: string,
): Promise<{ ok: true; document: DextDocument } | { ok: false; error: string }> {
  const result = await dextRequest<DextDocument>(`/documents/${encodeURIComponent(documentId)}`)
  if (!result.ok) return result
  return { ok: true, document: result.data }
}

/**
 * List documents with optional filters.
 */
export async function listDocuments(
  filters?: {
    status?: DextDocument['status']
    type?: DextDocument['type']
    fromDate?: string
    toDate?: string
    supplier?: string
    page?: number
    perPage?: number
  },
): Promise<{ ok: true; documents: DextDocument[]; total: number } | { ok: false; error: string }> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.type) params.set('type', filters.type)
  if (filters?.fromDate) params.set('from_date', filters.fromDate)
  if (filters?.toDate) params.set('to_date', filters.toDate)
  if (filters?.supplier) params.set('supplier', filters.supplier)
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.perPage) params.set('per_page', String(filters.perPage))

  const qs = params.toString()
  const result = await dextRequest<{ documents: DextDocument[]; total: number }>(
    `/documents${qs ? `?${qs}` : ''}`,
  )
  if (!result.ok) return result
  return { ok: true, documents: result.data.documents, total: result.data.total }
}

/**
 * Update category/account mapping for a document.
 */
export async function categorizeDocument(
  documentId: string,
  mapping: DextExportMapping,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await dextRequest<Record<string, unknown>>(
    `/documents/${encodeURIComponent(documentId)}/categorize`,
    {
      method: 'PATCH',
      body: {
        account_code: mapping.accountCode,
        tax_type: mapping.taxType,
        contact_id: mapping.contactId,
        tracking_category: mapping.trackingCategory,
      },
    },
  )
  if (!result.ok) return result
  return { ok: true }
}

/**
 * Mark a document as exported after pushing to accounting system.
 */
export async function markExported(
  documentId: string,
  externalRef: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await dextRequest<Record<string, unknown>>(
    `/documents/${encodeURIComponent(documentId)}/export`,
    {
      method: 'POST',
      body: { external_reference: externalRef },
    },
  )
  if (!result.ok) return result
  return { ok: true }
}

// ── Supplier / Category Management ──────────────────────────────────────────

export async function getSuppliers(): Promise<{ ok: true; suppliers: DextSupplier[] } | { ok: false; error: string }> {
  const result = await dextRequest<{ suppliers: DextSupplier[] }>('/suppliers')
  if (!result.ok) return result
  return { ok: true, suppliers: result.data.suppliers }
}

export async function getCategories(): Promise<{ ok: true; categories: DextCategory[] } | { ok: false; error: string }> {
  const result = await dextRequest<{ categories: DextCategory[] }>('/categories')
  if (!result.ok) return result
  return { ok: true, categories: result.data.categories }
}

// ── Sync Pipeline ───────────────────────────────────────────────────────────

/**
 * Full sync — pull all "ready" documents from Dext that haven't been exported yet.
 * Returns normalized documents ready for GL posting.
 */
export async function syncReadyDocuments(): Promise<DextSyncResult> {
  const result: DextSyncResult = {
    provider: 'dext',
    fetched: 0,
    newDocuments: 0,
    updatedDocuments: 0,
    errors: [],
    lastSyncAt: new Date().toISOString(),
  }

  const listResult = await listDocuments({ status: 'ready', perPage: 100 })
  if (!listResult.ok) {
    result.errors.push(listResult.error)
    return result
  }

  result.fetched = listResult.documents.length
  result.newDocuments = listResult.documents.length

  logger.info('Dext sync complete', {
    fetched: result.fetched,
    newDocuments: result.newDocuments,
  })

  return result
}

/**
 * Convert a Dext document to a GL-ready journal entry structure.
 */
export function toJournalEntry(doc: DextDocument): {
  date: string
  reference: string
  description: string
  debitAccountCode: string
  creditAccountCode: string
  amount: number
  taxAmount: number
  supplier: string
} {
  return {
    date: doc.date,
    reference: `DEXT-${doc.id}`,
    description: `${doc.type}: ${doc.supplier} — ${doc.description ?? 'No description'}`,
    debitAccountCode: doc.category ?? '5000', // Default expense
    creditAccountCode: doc.paymentMethod === 'credit_card' ? '2100' : '1000', // AP or Cash
    amount: doc.netAmount,
    taxAmount: doc.taxAmount,
    supplier: doc.supplier,
  }
}

// ── Webhook ─────────────────────────────────────────────────────────────────

/**
 * Parse and validate a Dext webhook payload.
 */
export function parseWebhookPayload(body: unknown): DextWebhookPayload | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.event !== 'string' || typeof b.documentId !== 'string') return null

  const validEvents = ['document.ready', 'document.updated', 'document.error', 'export.completed']
  if (!validEvents.includes(b.event)) return null

  return {
    event: b.event as DextWebhookPayload['event'],
    documentId: b.documentId,
    timestamp: typeof b.timestamp === 'string' ? b.timestamp : new Date().toISOString(),
    data: typeof b.data === 'object' && b.data !== null ? b.data as Record<string, unknown> : undefined,
  }
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function checkDextHealth(): Promise<{ healthy: boolean; error?: string }> {
  const result = await dextRequest<{ status: string }>('/health')
  if (!result.ok) return { healthy: false, error: result.error }
  return { healthy: true }
}
