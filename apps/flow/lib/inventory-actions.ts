'use server'

/**
 * Inventory Server Actions
 *
 * Next.js server actions for product and inventory management.
 */

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createProduct,
  getProduct,
  getProductBySku,
  listProducts,
  updateProduct,
  deleteProduct,
  recordStockMovement,
  reserveStock,
  releaseReservation,
  getStockHistory,
  getInventorySnapshot,
  getLowStockProducts,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductWithInventory,
  type ProductStatus,
  type MovementType,
  type InventorySnapshot,
} from './inventory-service'
import { commerceProducts, commerceStockMovements } from '@nzila/db'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ActionResult<T> {
  success: boolean
  data?: T
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function createProductAction(
  input: Omit<CreateProductInput, 'orgId'>,
): Promise<ActionResult<ProductWithInventory>> {
  const ctx = await resolveOrgContext()

  try {
    const data = await createProduct({ ...input, orgId: ctx.orgId })

    revalidatePath('/products')
    revalidatePath('/inventory')

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create product',
    }
  }
}

export async function getProductAction(
  productId: string,
): Promise<ActionResult<ProductWithInventory>> {
  await resolveOrgContext()

  try {
    const data = await getProduct(productId)
    if (!data) {
      return { success: false, error: 'Product not found' }
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get product',
    }
  }
}

export async function getProductBySkuAction(
  sku: string,
): Promise<ActionResult<ProductWithInventory>> {
  const ctx = await resolveOrgContext()

  try {
    const data = await getProductBySku(ctx.orgId, sku)
    if (!data) {
      return { success: false, error: 'Product not found' }
    }

    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get product',
    }
  }
}

export async function listProductsAction(filter?: {
  status?: ProductStatus | ProductStatus[]
  search?: string
  categoryId?: string
  supplierId?: string
  lowStock?: boolean
  tags?: string[]
}): Promise<ActionResult<ProductWithInventory[]>> {
  const ctx = await resolveOrgContext()

  try {
    const products = await listProducts({ orgId: ctx.orgId, ...filter })

    return { success: true, data: products }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list products',
    }
  }
}

export async function updateProductAction(
  productId: string,
  input: UpdateProductInput,
): Promise<ActionResult<typeof commerceProducts.$inferSelect>> {
  await resolveOrgContext()

  try {
    const product = await updateProduct(productId, input)
    if (!product) {
      return { success: false, error: 'Product not found' }
    }

    revalidatePath('/products')
    revalidatePath(`/products/${productId}`)
    revalidatePath('/inventory')

    return { success: true, data: product }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update product',
    }
  }
}

export async function deleteProductAction(productId: string): Promise<ActionResult<boolean>> {
  await resolveOrgContext()

  try {
    await deleteProduct(productId)

    revalidatePath('/products')
    revalidatePath('/inventory')

    return { success: true, data: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete product',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function recordStockMovementAction(input: {
  productId: string
  type: MovementType
  quantity: number
  reason?: string
  referenceType?: string
  referenceId?: string
  costPerUnit?: number
  notes?: string
}): Promise<ActionResult<typeof commerceStockMovements.$inferSelect>> {
  const ctx = await resolveOrgContext()

  try {
    const movement = await recordStockMovement({
      ...input,
      orgId: ctx.orgId,
      userId: ctx.actorId,
    })

    revalidatePath('/inventory')
    revalidatePath(`/products/${input.productId}`)

    return { success: true, data: movement }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record stock movement',
    }
  }
}

export async function reserveStockAction(input: {
  productId: string
  quantity: number
  referenceType?: string
  referenceId?: string
}): Promise<ActionResult<boolean>> {
  await resolveOrgContext()

  try {
    await reserveStock(input.productId, input.quantity, input.referenceType, input.referenceId)

    revalidatePath('/inventory')
    revalidatePath(`/products/${input.productId}`)

    return { success: true, data: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reserve stock',
    }
  }
}

export async function releaseReservationAction(input: {
  productId: string
  quantity: number
}): Promise<ActionResult<boolean>> {
  await resolveOrgContext()

  try {
    await releaseReservation(input.productId, input.quantity)

    revalidatePath('/inventory')
    revalidatePath(`/products/${input.productId}`)

    return { success: true, data: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to release reservation',
    }
  }
}

export async function getStockHistoryAction(
  productId: string,
  limit?: number,
): Promise<ActionResult<(typeof commerceStockMovements.$inferSelect)[]>> {
  await resolveOrgContext()

  try {
    const history = await getStockHistory(productId, limit)

    return { success: true, data: history }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stock history',
    }
  }
}

export async function getInventorySnapshotAction(): Promise<ActionResult<InventorySnapshot>> {
  const ctx = await resolveOrgContext()

  try {
    const snapshot = await getInventorySnapshot(ctx.orgId)

    return { success: true, data: snapshot }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get inventory snapshot',
    }
  }
}

export async function getLowStockProductsAction(): Promise<ActionResult<ProductWithInventory[]>> {
  const ctx = await resolveOrgContext()

  try {
    const products = await getLowStockProducts(ctx.orgId)

    return { success: true, data: products }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get low stock products',
    }
  }
}
