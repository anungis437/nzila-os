/**
 * Supplier Service
 *
 * Handles CRUD operations for suppliers, including Zoho Books vendor sync.
 * Ported from legacy shop_quoter_tool_v1 supplier-management.ts.
 */

import { and, eq, sql, ilike, or } from 'drizzle-orm'
import { db, commerceSuppliers, commercePurchaseOrders } from '@nzila/db'
import { logger } from './logger'
import { ZohoBooksClient } from './zoho/books-client'
import type { ZohoVendor } from './zoho/types'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SupplierStatus = 'active' | 'inactive' | 'pending' | 'blocked'

export interface SupplierAddress {
  street?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
}

export interface CreateSupplierInput {
  entityId: string
  name: string
  contactName?: string
  email?: string
  phone?: string
  address?: SupplierAddress
  paymentTerms?: string
  leadTimeDays?: number
  notes?: string
  tags?: string[]
}

export interface UpdateSupplierInput {
  name?: string
  contactName?: string
  email?: string
  phone?: string
  address?: SupplierAddress
  paymentTerms?: string
  leadTimeDays?: number
  rating?: number
  status?: SupplierStatus
  notes?: string
  tags?: string[]
}

export interface SupplierWithStats {
  supplier: typeof commerceSuppliers.$inferSelect
  stats: {
    totalPOs: number
    totalSpend: number
    averageLeadTime: number | null
    lastOrderDate: Date | null
  }
}

export interface SupplierListFilter {
  entityId: string
  status?: SupplierStatus | SupplierStatus[]
  search?: string
  tags?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function createSupplier(
  input: CreateSupplierInput,
): Promise<typeof commerceSuppliers.$inferSelect> {
  logger.info('Creating supplier', { entityId: input.entityId, name: input.name })

  const [supplier] = await db
    .insert(commerceSuppliers)
    .values({
      entityId: input.entityId,
      name: input.name,
      contactName: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      paymentTerms: input.paymentTerms ?? 'NET 30',
      leadTimeDays: input.leadTimeDays ?? 14,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      status: 'active',
    })
    .returning()

  logger.info('Supplier created', { supplierId: supplier.id, name: supplier.name })

  return supplier
}

export async function getSupplier(supplierId: string): Promise<SupplierWithStats | null> {
  const [supplier] = await db
    .select()
    .from(commerceSuppliers)
    .where(eq(commerceSuppliers.id, supplierId))
    .limit(1)

  if (!supplier) return null

  // Get supplier stats
  const pos = await db
    .select()
    .from(commercePurchaseOrders)
    .where(eq(commercePurchaseOrders.supplierId, supplierId))

  const completedPOs = pos.filter((po) => po.status === 'received')
  const totalSpend = pos.reduce((sum, po) => sum + Number(po.total), 0)

  let averageLeadTime: number | null = null
  if (completedPOs.length > 0) {
    const leadTimes = completedPOs
      .filter((po) => po.sentAt && po.actualDeliveryDate)
      .map((po) => {
        const sent = po.sentAt!.getTime()
        const delivered = po.actualDeliveryDate!.getTime()
        return (delivered - sent) / (1000 * 60 * 60 * 24) // days
      })

    if (leadTimes.length > 0) {
      averageLeadTime = leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
    }
  }

  const lastOrder = pos.length > 0 ? pos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] : null

  return {
    supplier,
    stats: {
      totalPOs: pos.length,
      totalSpend,
      averageLeadTime,
      lastOrderDate: lastOrder?.createdAt ?? null,
    },
  }
}

export async function listSuppliers(filter: SupplierListFilter): Promise<SupplierWithStats[]> {
  const conditions = [eq(commerceSuppliers.entityId, filter.entityId)]

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    conditions.push(sql`${commerceSuppliers.status} = ANY(${statuses})`)
  }

  if (filter.search) {
    conditions.push(
      or(
        ilike(commerceSuppliers.name, `%${filter.search}%`),
        ilike(commerceSuppliers.contactName, `%${filter.search}%`),
        ilike(commerceSuppliers.email, `%${filter.search}%`),
      )!,
    )
  }

  if (filter.tags && filter.tags.length > 0) {
    conditions.push(sql`${commerceSuppliers.tags} ?| ${filter.tags}`)
  }

  const suppliers = await db
    .select()
    .from(commerceSuppliers)
    .where(and(...conditions))
    .orderBy(commerceSuppliers.name)

  // Get stats for each supplier
  const results: SupplierWithStats[] = []
  for (const supplier of suppliers) {
    const data = await getSupplier(supplier.id)
    if (data) {
      results.push(data)
    }
  }

  return results
}

export async function updateSupplier(
  supplierId: string,
  input: UpdateSupplierInput,
): Promise<typeof commerceSuppliers.$inferSelect | null> {
  const [existing] = await db
    .select()
    .from(commerceSuppliers)
    .where(eq(commerceSuppliers.id, supplierId))
    .limit(1)

  if (!existing) return null

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (input.name !== undefined) updates.name = input.name
  if (input.contactName !== undefined) updates.contactName = input.contactName
  if (input.email !== undefined) updates.email = input.email
  if (input.phone !== undefined) updates.phone = input.phone
  if (input.address !== undefined) updates.address = input.address
  if (input.paymentTerms !== undefined) updates.paymentTerms = input.paymentTerms
  if (input.leadTimeDays !== undefined) updates.leadTimeDays = input.leadTimeDays
  if (input.rating !== undefined) updates.rating = input.rating.toFixed(1)
  if (input.status !== undefined) updates.status = input.status
  if (input.notes !== undefined) updates.notes = input.notes
  if (input.tags !== undefined) updates.tags = input.tags

  const [updated] = await db
    .update(commerceSuppliers)
    .set(updates)
    .where(eq(commerceSuppliers.id, supplierId))
    .returning()

  logger.info('Supplier updated', { supplierId, updates: Object.keys(updates) })

  return updated
}

export async function deleteSupplier(supplierId: string): Promise<boolean> {
  // Check for existing POs
  const [existingPO] = await db
    .select({ id: commercePurchaseOrders.id })
    .from(commercePurchaseOrders)
    .where(eq(commercePurchaseOrders.supplierId, supplierId))
    .limit(1)

  if (existingPO) {
    throw new Error('Cannot delete supplier with existing purchase orders. Set status to inactive instead.')
  }

  await db.delete(commerceSuppliers).where(eq(commerceSuppliers.id, supplierId))

  logger.info('Supplier deleted', { supplierId })

  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Zoho Sync
// ─────────────────────────────────────────────────────────────────────────────

export async function syncSupplierToZoho(
  supplierId: string,
  booksClient: ZohoBooksClient,
): Promise<string> {
  const [supplier] = await db
    .select()
    .from(commerceSuppliers)
    .where(eq(commerceSuppliers.id, supplierId))
    .limit(1)

  if (!supplier) {
    throw new Error(`Supplier ${supplierId} not found`)
  }

  const address = supplier.address as SupplierAddress | null

  const zohoVendor: Partial<ZohoVendor> = {
    contact_name: supplier.name,
    company_name: supplier.name,
    email: supplier.email ?? undefined,
    phone: supplier.phone ?? undefined,
    payment_terms: supplier.paymentTerms ? parseInt(supplier.paymentTerms.replace(/\D/g, ''), 10) : 30,
  }

  let zohoVendorId: string

  if (supplier.zohoVendorId) {
    // Update existing
    const updated = await booksClient.updateVendor(supplier.zohoVendorId, zohoVendor)
    zohoVendorId = updated.vendor_id
    logger.info('Updated supplier in Zoho Books', { supplierId, zohoVendorId })
  } else {
    // Create new
    const created = await booksClient.createVendor(zohoVendor)
    zohoVendorId = created.vendor_id

    // Store Zoho vendor ID
    await db
      .update(commerceSuppliers)
      .set({ zohoVendorId, updatedAt: new Date() })
      .where(eq(commerceSuppliers.id, supplierId))

    logger.info('Created supplier in Zoho Books', { supplierId, zohoVendorId })
  }

  return zohoVendorId
}

export async function syncSupplierFromZoho(
  entityId: string,
  zohoVendor: ZohoVendor,
): Promise<typeof commerceSuppliers.$inferSelect> {
  // Check if supplier already exists with this Zoho ID
  const [existing] = await db
    .select()
    .from(commerceSuppliers)
    .where(eq(commerceSuppliers.zohoVendorId, zohoVendor.vendor_id))
    .limit(1)

  const address: SupplierAddress | null = null

  if (existing) {
    // Update existing supplier
    const [updated] = await db
      .update(commerceSuppliers)
      .set({
        name: zohoVendor.contact_name || zohoVendor.company_name || 'Unknown',
        email: zohoVendor.email ?? null,
        phone: zohoVendor.phone ?? null,
        address,
        paymentTerms: zohoVendor.payment_terms ? `NET ${zohoVendor.payment_terms}` : null,
        updatedAt: new Date(),
      })
      .where(eq(commerceSuppliers.id, existing.id))
      .returning()

    logger.info('Updated supplier from Zoho', { supplierId: updated.id })
    return updated
  } else {
    // Create new supplier
    const [created] = await db
      .insert(commerceSuppliers)
      .values({
        entityId,
        name: zohoVendor.contact_name || zohoVendor.company_name || 'Unknown',
        email: zohoVendor.email ?? null,
        phone: zohoVendor.phone ?? null,
        address,
        paymentTerms: zohoVendor.payment_terms ? `NET ${zohoVendor.payment_terms}` : 'NET 30',
        zohoVendorId: zohoVendor.vendor_id,
        status: 'active' as const,
      })
      .returning()

    logger.info('Created supplier from Zoho', { supplierId: created.id, zohoVendorId: zohoVendor.vendor_id })
    return created
  }
}
