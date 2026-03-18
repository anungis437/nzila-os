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
import { getDbContext, getReadContext } from '@/lib/clerk-org-resolver'

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
  return createProduct(ctx, data)
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
  return updateProduct(ctx, productId, data)
}

export async function deleteProductAction(productId: string) {
  const ctx = await getDbContext()
  return deleteProduct(ctx, productId)
}
