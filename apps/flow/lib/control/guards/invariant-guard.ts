/**
 * Flow — Invariant Guard
 *
 * Validates domain invariants before any mutation:
 * - entity exists
 * - entity belongs to org
 * - required linked records exist
 * - core relationships are intact
 */
import type { InvariantCheckResult } from '@/lib/control/types'
import { quoteRepo, orderRepo, customerRepo, vendorRepo, purchaseOrderRepo, productionRepo } from '@/lib/repositories'

export async function checkEntityExists(
  entityType: string,
  targetId: string,
  orgId: string,
): Promise<InvariantCheckResult> {
  const violations: string[] = []

  const repo = getRepoForEntity(entityType)
  if (!repo) {
    violations.push(`Unknown entity type: ${entityType}`)
    return { valid: false, violations }
  }

  const entity = await repo.findById(targetId, orgId)
  if (!entity) {
    violations.push(`${entityType} "${targetId}" not found in org "${orgId}"`)
  }

  return { valid: violations.length === 0, violations }
}

export async function checkQuoteInvariants(
  quoteId: string,
  orgId: string,
): Promise<InvariantCheckResult> {
  const violations: string[] = []

  const quote = await quoteRepo.findById(quoteId, orgId)
  if (!quote) {
    violations.push(`Quote "${quoteId}" not found`)
    return { valid: false, violations }
  }

  if (!quote.customerId) {
    violations.push('Quote has no customer assigned')
  } else {
    const customer = await customerRepo.findById(quote.customerId, orgId)
    if (!customer) {
      violations.push(`Customer "${quote.customerId}" referenced by quote does not exist`)
    }
  }

  const quoteTotal = Number(quote.total ?? 0)
  if (quoteTotal < 0) {
    violations.push('Quote total is invalid')
  }

  return { valid: violations.length === 0, violations }
}

export async function checkOrderInvariants(
  orderId: string,
  orgId: string,
): Promise<InvariantCheckResult> {
  const violations: string[] = []

  const order = await orderRepo.findById(orderId, orgId)
  if (!order) {
    violations.push(`Order "${orderId}" not found`)
    return { valid: false, violations }
  }

  if (!order.customerId) {
    violations.push('Order has no customer assigned')
  }

  const orderTotal = Number(order.total ?? 0)
  if (orderTotal < 0) {
    violations.push('Order total is invalid')
  }

  return { valid: violations.length === 0, violations }
}

export async function checkPurchaseOrderInvariants(
  purchaseOrderId: string,
  orgId: string,
): Promise<InvariantCheckResult> {
  const violations: string[] = []

  const po = await purchaseOrderRepo.findById(purchaseOrderId, orgId)
  if (!po) {
    violations.push(`PurchaseOrder "${purchaseOrderId}" not found`)
    return { valid: false, violations }
  }

  if (!po.orderId) {
    violations.push('PurchaseOrder has no orderId')
  } else {
    const order = await orderRepo.findById(po.orderId, orgId)
    if (!order) {
      violations.push(`Order "${po.orderId}" referenced by PO does not exist`)
    }
  }

  if (!po.supplierId) {
    violations.push('PurchaseOrder has no supplier assigned')
  } else {
    const vendor = await vendorRepo.findById(po.supplierId, orgId)
    if (!vendor) {
      violations.push(`Vendor "${po.supplierId}" referenced by PO does not exist`)
    }
  }

  return { valid: violations.length === 0, violations }
}

export async function checkProductionJobInvariants(
  jobId: string,
  orgId: string,
): Promise<InvariantCheckResult> {
  const violations: string[] = []

  const job = await productionRepo.findById(jobId, orgId)
  if (!job) {
    violations.push(`ProductionJob "${jobId}" not found`)
    return { valid: false, violations }
  }

  if (!job.orderId) {
    violations.push('ProductionJob has no orderId')
  }

  if (!job.assignedVendorId) {
    violations.push('ProductionJob has no vendor assigned')
  }

  return { valid: violations.length === 0, violations }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getRepoForEntity(entityType: string) {
  const map: Record<string, { findById: (id: string, orgId: string) => Promise<unknown> }> = {
    quote: quoteRepo,
    order: orderRepo,
    customer: customerRepo,
    vendor: vendorRepo,
    purchase_order: purchaseOrderRepo,
    production_job: productionRepo,
  }
  return map[entityType] ?? null
}
