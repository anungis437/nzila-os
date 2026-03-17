'use server'

import {
  listInventory,
  getInventoryById,
  getInventoryByProductId,
  listLowStockProducts,
  getStockMovements,
  getInventorySummary,
  createInventoryRecord,
  updateInventory,
  recordStockMovement,
  adjustStock,
  allocateStock,
} from '@nzila/commerce-db'
import { auth } from '@clerk/nextjs/server'
import type { CommerceDbContext, CommerceReadContext } from '@nzila/commerce-db'

async function getDbContext(): Promise<CommerceDbContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return {
    orgId: orgId,
    actorId: userId,
    actorRole: 'user',
  }
}

async function getReadContext(): Promise<CommerceReadContext> {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    throw new Error('Unauthorized')
  }
  return { orgId: orgId }
}

// ── Read Actions ──────────────────────────────────────────────────────────

export async function getInventoryAction(opts?: {
  limit?: number
  offset?: number
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock'
  productId?: string
}) {
  const ctx = await getReadContext()
  return listInventory(ctx, opts)
}

export async function getInventoryRecordAction(inventoryId: string) {
  const ctx = await getReadContext()
  return getInventoryById(ctx, inventoryId)
}

export async function getProductInventoryAction(productId: string) {
  const ctx = await getReadContext()
  return getInventoryByProductId(ctx, productId)
}

export async function getLowStockAction() {
  const ctx = await getReadContext()
  return listLowStockProducts(ctx)
}

export async function getStockMovementsAction(opts?: {
  limit?: number
  offset?: number
  inventoryId?: string
  productId?: string
  movementType?: 'receipt' | 'allocation' | 'adjustment' | 'return' | 'sale'
}) {
  const ctx = await getReadContext()
  return getStockMovements(ctx, opts)
}

export async function getInventorySummaryAction() {
  const ctx = await getReadContext()
  return getInventorySummary(ctx)
}

// ── Write Actions ─────────────────────────────────────────────────────────

export async function createInventoryAction(data: {
  productId: string
  currentStock?: number
  allocatedStock?: number
  reorderPoint?: number
  minStockLevel?: number
  maxStockLevel?: number | null
  location?: string | null
}) {
  const ctx = await getDbContext()
  return createInventoryRecord(ctx, data)
}

export async function updateInventoryAction(
  inventoryId: string,
  data: Partial<{
    currentStock: number
    allocatedStock: number
    reorderPoint: number
    minStockLevel: number
    maxStockLevel: number | null
    location: string | null
  }>,
) {
  const ctx = await getDbContext()
  return updateInventory(ctx, inventoryId, data)
}

export async function recordStockMovementAction(data: {
  inventoryId: string
  productId: string
  movementType: 'receipt' | 'allocation' | 'adjustment' | 'return' | 'sale'
  quantity: number
  referenceType?: string | null
  referenceId?: string | null
  reason?: string | null
}) {
  const ctx = await getDbContext()
  return recordStockMovement(ctx, data)
}

export async function adjustStockAction(
  inventoryId: string,
  newQuantity: number,
  reason: string,
) {
  const ctx = await getDbContext()
  return adjustStock(ctx, inventoryId, newQuantity, reason)
}

export async function allocateStockAction(
  inventoryId: string,
  quantity: number,
  orderId: string,
) {
  const ctx = await getDbContext()
  return allocateStock(ctx, inventoryId, quantity, orderId)
}
