/**
 * @nzila/commerce-db — Products repository
 *
 * Org-scoped CRUD for the commerce_products table.
 * Reads use ReadOnlyScopedDb. Writes use AuditedScopedDb.
 *
 * @module @nzila/commerce-db/products
 */
import {
  createScopedDb,
  createAuditedScopedDb,
  commerceProducts,
} from '@nzila/db'
import { eq } from 'drizzle-orm'
import type { CommerceDbContext, CommerceReadContext, PaginationOpts } from '../types'

type ProductStatus = 'active' | 'inactive' | 'discontinued'

// ── Reads ─────────────────────────────────────────────────────────────────

export async function listProducts(
  ctx: CommerceReadContext,
  opts: PaginationOpts & {
    status?: ProductStatus
    category?: string
    supplierId?: string
    search?: string
  } = {},
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0

  let rows = await db.select(commerceProducts)

  // Filter by status
  if (opts.status) {
    rows = rows.filter((r) => r.status === opts.status)
  }

  // Filter by category
  if (opts.category) {
    rows = rows.filter((r) => r.category === opts.category)
  }

  // Filter by supplier
  if (opts.supplierId) {
    rows = rows.filter((r) => r.supplierId === opts.supplierId)
  }

  // Search filter
  if (opts.search) {
    const search = opts.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        r.sku.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search),
    )
  }

  // Sort by name
  const sorted = rows.sort((a, b) => a.name.localeCompare(b.name))

  return {
    rows: sorted.slice(offset, offset + limit),
    total: sorted.length,
    limit,
    offset,
  }
}

export async function getProductById(
  ctx: CommerceReadContext,
  productId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(
    commerceProducts,
    eq(commerceProducts.id, productId),
  )
  return rows[0] ?? null
}

export async function getProductBySku(
  ctx: CommerceReadContext,
  sku: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(commerceProducts)
  return rows.find((r) => r.sku === sku) ?? null
}

export async function getProductByZohoId(
  ctx: CommerceReadContext,
  zohoItemId: string,
) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(commerceProducts)
  return rows.find((r) => r.zohoItemId === zohoItemId) ?? null
}

export async function getProductCategories(ctx: CommerceReadContext) {
  const db = createScopedDb({ orgId: ctx.entityId })
  const rows = await db.select(commerceProducts)
  const categories = new Set(rows.map((r) => r.category))
  return Array.from(categories).sort()
}

// ── Writes ────────────────────────────────────────────────────────────────

export async function createProduct(
  ctx: CommerceDbContext,
  values: {
    sku: string
    name: string
    nameFr?: string | null
    description?: string | null
    descriptionFr?: string | null
    category: string
    subcategory?: string | null
    basePrice: string
    costPrice: string
    supplierId?: string | null
    status?: ProductStatus
    weightGrams?: number | null
    dimensions?: string | null
    packagingType?: string | null
    imageUrl?: string | null
    tags?: string[]
    customizable?: boolean
    zohoItemId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })
  return db.insert(commerceProducts, values)
}

export async function updateProduct(
  ctx: CommerceDbContext,
  productId: string,
  values: Partial<{
    sku: string
    name: string
    nameFr: string | null
    description: string | null
    descriptionFr: string | null
    category: string
    subcategory: string | null
    basePrice: string
    costPrice: string
    supplierId: string | null
    status: ProductStatus
    weightGrams: number | null
    dimensions: string | null
    packagingType: string | null
    imageUrl: string | null
    tags: string[]
    customizable: boolean
    zohoItemId: string | null
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
    commerceProducts,
    { ...values, updatedAt: new Date() },
    eq(commerceProducts.id, productId),
  )
}

export async function deleteProduct(ctx: CommerceDbContext, productId: string) {
  const db = createAuditedScopedDb({
    orgId: ctx.entityId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    actorRole: ctx.actorRole,
  })
  return db.delete(commerceProducts, eq(commerceProducts.id, productId))
}
