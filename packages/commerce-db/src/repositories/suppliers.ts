/**
 * @nzila/commerce-db — Suppliers repository
 *
 * Org-scoped CRUD for the commerce_suppliers table.
 * Reads use ReadOnlyScopedDb. Writes use AuditedScopedDb.
 *
 * @module @nzila/commerce-db/suppliers
 */
import {
  createScopedDb,
  createAuditedScopedDb,
  commerceSuppliers,
} from '@nzila/db'
import { eq, ilike, or } from 'drizzle-orm'
import type { CommerceDbContext, CommerceReadContext, PaginationOpts } from '../types'

type SupplierStatus = 'active' | 'inactive' | 'pending' | 'blocked'

// ── Reads ─────────────────────────────────────────────────────────────────

export async function listSuppliers(
  ctx: CommerceReadContext,
  opts: PaginationOpts & { status?: SupplierStatus; search?: string } = {},
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0

  let rows = await db.select(commerceSuppliers)

  // Filter by status
  if (opts.status) {
    rows = rows.filter((r) => r.status === opts.status)
  }

  // Search filter
  if (opts.search) {
    const search = opts.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        r.email?.toLowerCase().includes(search) ||
        r.contactName?.toLowerCase().includes(search),
    )
  }

  // Sort by most-recently-created first
  const sorted = rows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return {
    rows: sorted.slice(offset, offset + limit),
    total: sorted.length,
    limit,
    offset,
  }
}

export async function getSupplierById(
  ctx: CommerceReadContext,
  supplierId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(
    commerceSuppliers,
    eq(commerceSuppliers.id, supplierId),
  )
  return rows[0] ?? null
}

export async function getSupplierByZohoId(
  ctx: CommerceReadContext,
  zohoVendorId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(commerceSuppliers)
  return rows.find((r) => r.zohoVendorId === zohoVendorId) ?? null
}

// ── Writes ────────────────────────────────────────────────────────────────

export async function createSupplier(
  ctx: CommerceDbContext,
  values: {
    name: string
    contactName?: string | null
    email?: string | null
    phone?: string | null
    address?: Record<string, unknown> | null
    paymentTerms?: string | null
    leadTimeDays?: number
    status?: SupplierStatus
    zohoVendorId?: string | null
    notes?: string | null
    tags?: string[]
    metadata?: Record<string, unknown>
  },
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })
  return db.insert(commerceSuppliers, values)
}

export async function updateSupplier(
  ctx: CommerceDbContext,
  supplierId: string,
  values: Partial<{
    name: string
    contactName: string | null
    email: string | null
    phone: string | null
    address: Record<string, unknown> | null
    paymentTerms: string | null
    leadTimeDays: number
    rating: string
    status: SupplierStatus
    zohoVendorId: string | null
    notes: string | null
    tags: string[]
    metadata: Record<string, unknown>
  }>,
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })
  return db.update(
    commerceSuppliers,
    { ...values, updatedAt: new Date() },
    eq(commerceSuppliers.id, supplierId),
  )
}

export async function deleteSupplier(ctx: CommerceDbContext, supplierId: string) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })
  return db.delete(commerceSuppliers, eq(commerceSuppliers.id, supplierId))
}
