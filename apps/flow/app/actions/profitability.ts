'use server'

/**
 * Profitability Actions
 *
 * Server actions for quote request → 3 proposals, profitability analysis,
 * and historical mandate profitability reporting.
 */
import { getReadContext } from '@/lib/org-resolver'
import {
  generateTieredProposals,
  calculateQuoteProfitability,
  calculateMandateProfitability,
  type TieredProposal,
  type QuoteProfitability,
  type MandateProfitability,
  type HistoricalCostSource,
} from '@/lib/profitability'

// ── Generate 3 Proposals from Quote Request ────────────────────────────────

export interface QuoteRequestFormData {
  clientName: string
  clientEmail: string
  clientCompany: string
  budget: number
  volume: number
  category: string
  requirements: string
}

export async function generateProposalsAction(
  formData: QuoteRequestFormData,
): Promise<{ ok: boolean; proposals?: TieredProposal[]; error?: string }> {
  try {
    const ctx = await getReadContext()

    // Load products from DB
    const { listProducts } = await import('@nzila/commerce-db')
    const result = await listProducts(ctx, {
      status: 'active',
      category: formData.category || undefined,
      limit: 200,
    })

    const products = result.rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      basePrice: Number(p.basePrice),
      costPrice: Number(p.costPrice),
      category: p.category,
    }))

    // If no products in the requested category, load all
    let allProducts = products
    if (products.length === 0) {
      const allResult = await listProducts(ctx, { status: 'active', limit: 200 })
      allProducts = allResult.rows.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        basePrice: Number(p.basePrice),
        costPrice: Number(p.costPrice),
        category: p.category,
      }))
    }

    if (allProducts.length === 0) {
      return { ok: false, error: 'No products found in catalog. Seed products first.' }
    }

    const proposals = generateTieredProposals(
      {
        budget: formData.budget,
        volume: formData.volume,
        category: formData.category,
        requirements: formData.requirements,
      },
      allProducts,
    )

    return { ok: true, proposals }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to generate proposals' }
  }
}

// ── Quote Profitability Analysis ───────────────────────────────────────────

export async function analyzeQuoteProfitabilityAction(
  quoteId: string,
): Promise<{ ok: boolean; profitability?: QuoteProfitability; error?: string }> {
  try {
    const ctx = await getReadContext()
    const { getQuoteById, listQuoteLines } = await import('@nzila/commerce-db')
    const { listProducts } = await import('@nzila/commerce-db')

    const quote = await getQuoteById(ctx, quoteId)
    if (!quote) return { ok: false, error: 'Quote not found' }

    const lines = await listQuoteLines(ctx, quoteId)
    const productsResult = await listProducts(ctx, { limit: 200 })
    const productMap = new Map(productsResult.rows.map((p) => [p.sku, p]))

    const costLines = lines.map((line) => {
      const product = line.sku ? productMap.get(line.sku) : undefined
      return {
        description: line.description,
        sku: line.sku ?? undefined,
        quantity: line.quantity,
        unitSellPrice: Number(line.unitPrice),
        unitCostPrice: product ? Number(product.costPrice) : Number(line.unitPrice) * 0.6,
        productId: line.productId ?? undefined,
      }
    })

    const profitability = calculateQuoteProfitability(costLines)
    return { ok: true, profitability }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Analysis failed' }
  }
}

// ── Historical Mandate Profitability ───────────────────────────────────────

export async function getMandateProfitabilityAction(
  orderId: string,
): Promise<{ ok: boolean; profitability?: MandateProfitability; error?: string }> {
  try {
    const ctx = await getReadContext()
    const { getOrderById, listOrderLines } = await import('@nzila/commerce-db')

    const order = await getOrderById(ctx, orderId)
    if (!order) return { ok: false, error: 'Order not found' }

    const revenue = Number(order.total)
    const costs: HistoricalCostSource[] = []

    // Source 1: Purchase order costs
    try {
      const {
        db,
        commercePurchaseOrders,
      } = await import('@nzila/db')
      const { eq } = await import('drizzle-orm')

      const pos = await db
        .select()
        .from(commercePurchaseOrders)
        .where(eq(commercePurchaseOrders.orderId, orderId))

      for (const po of pos) {
        costs.push({
          source: 'purchase_order',
          reference: po.ref,
          amount: Number(po.total),
          date: po.createdAt?.toISOString() ?? new Date().toISOString(),
        })
      }
    } catch { /* PO table may not have data */ }

    // Source 2: Order lines cost (using product cost_price)
    try {
      const orderLines = await listOrderLines(ctx, orderId)
      const { listProducts } = await import('@nzila/commerce-db')
      const productsResult = await listProducts(ctx, { limit: 200 })
      const productMap = new Map(productsResult.rows.map((p) => [p.sku, p]))

      // If no PO costs, estimate from product cost prices
      if (costs.length === 0) {
        let productCostTotal = 0
        for (const line of orderLines) {
          const product = line.sku ? productMap.get(line.sku) : undefined
          const unitCost = product ? Number(product.costPrice) : Number(line.unitPrice) * 0.6
          productCostTotal += line.quantity * unitCost
        }
        costs.push({
          source: 'product_costs',
          reference: `Estimated from ${orderLines.length} line items`,
          amount: productCostTotal,
          date: order.createdAt?.toISOString() ?? new Date().toISOString(),
        })
      }
    } catch { /* Order lines may not exist */ }

    // Source 3: Payment records
    try {
      const { db, commercePayments, commerceInvoices } = await import('@nzila/db')
      const { eq } = await import('drizzle-orm')

      const invoices = await db
        .select()
        .from(commerceInvoices)
        .where(eq(commerceInvoices.orderId, orderId))

      for (const inv of invoices) {
        const payments = await db
          .select()
          .from(commercePayments)
          .where(eq(commercePayments.invoiceId, inv.id))

        for (const _pay of payments) {
          // Payments are revenue confirmation, not costs — track them separately
        }
      }
    } catch { /* Payment tables may not exist */ }

    const profitability = calculateMandateProfitability(
      order.ref,
      orderId,
      revenue,
      costs,
    )

    return { ok: true, profitability }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Analysis failed' }
  }
}

// ── List Orders for Profitability Report ───────────────────────────────────

export async function getOrdersForProfitabilityAction(): Promise<{
  ok: boolean
  orders?: Array<{ id: string; ref: string; total: string; status: string; createdAt: string }>
  error?: string
}> {
  try {
    const ctx = await getReadContext()
    const { listOrders } = await import('@nzila/commerce-db')
    const result = await listOrders(ctx, { limit: 100 })

    const orders = result.rows.map((o) => ({
      id: o.id,
      ref: o.ref,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt?.toISOString() ?? '',
    }))

    return { ok: true, orders }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load orders' }
  }
}
