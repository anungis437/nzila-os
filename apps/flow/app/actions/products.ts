'use server'

import {
  listProducts,
  getProductById,
  getProductBySku,
  getProductCategories,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@nzila/commerce-db'
import { getDbContext, getReadContext } from '@/lib/org-resolver'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

// ── Read Actions ──────────────────────────────────────────────────────────

export async function getProductsAction(opts?: {
  limit?: number
  offset?: number
  status?: 'active' | 'inactive' | 'discontinued'
  category?: string
  supplierId?: string
  search?: string
}) {
  const ctx = await getReadContext()
  return listProducts(ctx, opts)
}

export async function getProductAction(productId: string) {
  const ctx = await getReadContext()
  return getProductById(ctx, productId)
}

export async function getProductBySkuAction(sku: string) {
  const ctx = await getReadContext()
  return getProductBySku(ctx, sku)
}

export async function getCategoriesAction() {
  const ctx = await getReadContext()
  return getProductCategories(ctx)
}

// ── Write Actions ─────────────────────────────────────────────────────────

export async function createProductAction(data: {
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
  weightGrams?: number | null
  dimensions?: string | null
  packagingType?: string | null
  imageUrl?: string | null
  tags?: string[]
  customizable?: boolean
}) {
  const ctx = await getDbContext()
  const result = await createProduct(ctx, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PRODUCT_CREATED', orgId: ctx.orgId, actorId: ctx.actorId }))
  return result
}

export async function updateProductAction(
  productId: string,
  data: Partial<{
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
    status: 'active' | 'inactive' | 'discontinued'
    weightGrams: number | null
    dimensions: string | null
    packagingType: string | null
    imageUrl: string | null
    tags: string[]
    customizable: boolean
  }>,
) {
  const ctx = await getDbContext()
  const result = await updateProduct(ctx, productId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PRODUCT_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { productId } }))
  return result
}

export async function deleteProductAction(productId: string) {
  const ctx = await getDbContext()
  const result = await deleteProduct(ctx, productId)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'PRODUCT_DELETED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { productId } }))
  return result
}
