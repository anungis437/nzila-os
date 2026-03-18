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
  entityId: string,
  orgId: string,
): Promise<InvariantCheckResult> {
  const violations: string[] = []

  const repo = getRepoForEntity(entityType)
  if (!repo) {
    violations.push(`Unknown entity type: ${entityType}`)
    return { valid: false, violations }
  }

  const entity = await repo.findById(entityId, orgId)
  if (!entity) {
    violations.push(`${entityType} "${entityId}" not found in org "${orgId}"`)
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

  if (!quote.customer_id) {
    violations.push('Quote has no customer assigned')
  } else {
    const customer = await customerRepo.findById(quote.customer_id, orgId)
    if (!customer) {
      violations.push(`Customer "${quote.customer_id}" referenced by quote does not exist`)
    }
  }

  if (quote.total_amount == null || quote.total_amount < 0) {
    violations.push('Quote total_amount is invalid')
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

  if (!order.customer_id) {
    violations.push('Order has no customer assigned')
  }

  if (order.total_amount == null || order.total_amount < 0) {
    violations.push('Order total_amount is invalid')
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

  if (!po.order_id) {
    violations.push('PurchaseOrder has no order_id')
  } else {
    const order = await orderRepo.findById(po.order_id, orgId)
    if (!order) {
      violations.push(`Order "${po.order_id}" referenced by PO does not exist`)
    }
  }

  if (!po.vendor_id) {
    violations.push('PurchaseOrder has no vendor assigned')
  } else {
    const vendor = await vendorRepo.findById(po.vendor_id, orgId)
    if (!vendor) {
      violations.push(`Vendor "${po.vendor_id}" referenced by PO does not exist`)
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

  if (!job.order_id) {
    violations.push('ProductionJob has no order_id')
  }

  if (!job.vendor_id) {
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
