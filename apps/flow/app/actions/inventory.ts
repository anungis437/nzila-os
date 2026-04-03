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
import { getDbContext, getReadContext } from '@/lib/clerk-org-resolver'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

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
  const result = await createInventoryRecord(ctx, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'INVENTORY_CREATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { productId: data.productId } }))
  return result
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
  const result = await updateInventory(ctx, inventoryId, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'INVENTORY_UPDATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { inventoryId } }))
  return result
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
  const result = await recordStockMovement(ctx, data)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'STOCK_MOVEMENT_RECORDED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { movementType: data.movementType, inventoryId: data.inventoryId } }))
  return result
}

export async function adjustStockAction(
  inventoryId: string,
  newQuantity: number,
  reason: string,
) {
  const ctx = await getDbContext()
  const result = await adjustStock(ctx, inventoryId, newQuantity, reason)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'STOCK_ADJUSTED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { inventoryId, newQuantity } }))
  return result
}

export async function allocateStockAction(
  inventoryId: string,
  quantity: number,
  orderId: string,
) {
  const ctx = await getDbContext()
  const result = await allocateStock(ctx, inventoryId, quantity, orderId)
  await processEvidencePack(buildEvidencePackFromAction({ actionType: 'STOCK_ALLOCATED', orgId: ctx.orgId, actorId: ctx.actorId, metadata: { inventoryId, quantity, orderId } }))
  return result
}
