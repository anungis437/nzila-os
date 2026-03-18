/**
 * Profitability Engine
 *
 * Calculates margins, cost breakdowns, and profitability alerts
 * for quotes, orders, and historical mandates.
 *
 * @module profitability
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface CostLine {
  description: string
  sku?: string
  quantity: number
  unitSellPrice: number
  unitCostPrice: number
  productId?: string
}

export interface LineMargin extends CostLine {
  revenue: number
  cost: number
  marginDollars: number
  marginPercent: number
  status: 'healthy' | 'warning' | 'critical' | 'loss'
}

export interface QuoteProfitability {
  lines: LineMargin[]
  totalRevenue: number
  totalCost: number
  totalMarginDollars: number
  totalMarginPercent: number
  overallStatus: 'healthy' | 'warning' | 'critical' | 'loss'
  alerts: ProfitabilityAlert[]
}

export interface ProfitabilityAlert {
  type: 'margin_below_floor' | 'cost_overrun' | 'negative_margin' | 'thin_margin'
  severity: 'info' | 'warning' | 'critical'
  message: string
  lineDescription?: string
}

export interface TieredProposal {
  tier: 'BUDGET' | 'STANDARD' | 'PREMIUM'
  label: string
  description: string
  lines: ProposalLine[]
  subtotal: number
  marginPercent: number
  marginDollars: number
  totalCost: number
  gst: number
  qst: number
  total: number
  includesVisualMockup: boolean
}

export interface ProposalLine {
  productId: string
  sku: string
  name: string
  description: string
  quantity: number
  unitPrice: number
  unitCost: number
  lineTotal: number
  marginPercent: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const MARGIN_FLOOR_PERCENT = 25 // Below this → warning
const MARGIN_CRITICAL_PERCENT = 15 // Below this → critical
const GST_RATE = 0.05
const QST_RATE = 0.09975
const VISUAL_MOCKUP_THRESHOLD = 5000 // $5000+ mandates get visual mockup

// ── Margin Calculation ─────────────────────────────────────────────────────

export function calculateLineMargin(line: CostLine): LineMargin {
  const revenue = line.quantity * line.unitSellPrice
  const cost = line.quantity * line.unitCostPrice
  const marginDollars = revenue - cost
  const marginPercent = revenue > 0 ? (marginDollars / revenue) * 100 : 0

  let status: LineMargin['status'] = 'healthy'
  if (marginPercent < 0) status = 'loss'
  else if (marginPercent < MARGIN_CRITICAL_PERCENT) status = 'critical'
  else if (marginPercent < MARGIN_FLOOR_PERCENT) status = 'warning'

  return { ...line, revenue, cost, marginDollars, marginPercent, status }
}

export function calculateQuoteProfitability(
  lines: CostLine[],
  marginFloor = MARGIN_FLOOR_PERCENT,
): QuoteProfitability {
  const lineMargins = lines.map(calculateLineMargin)

  const totalRevenue = lineMargins.reduce((s, l) => s + l.revenue, 0)
  const totalCost = lineMargins.reduce((s, l) => s + l.cost, 0)
  const totalMarginDollars = totalRevenue - totalCost
  const totalMarginPercent = totalRevenue > 0 ? (totalMarginDollars / totalRevenue) * 100 : 0

  let overallStatus: QuoteProfitability['overallStatus'] = 'healthy'
  if (totalMarginPercent < 0) overallStatus = 'loss'
  else if (totalMarginPercent < MARGIN_CRITICAL_PERCENT) overallStatus = 'critical'
  else if (totalMarginPercent < marginFloor) overallStatus = 'warning'

  const alerts: ProfitabilityAlert[] = []

  // Overall alerts
  if (totalMarginPercent < 0) {
    alerts.push({
      type: 'negative_margin',
      severity: 'critical',
      message: `Overall margin is negative (${totalMarginPercent.toFixed(1)}%). This quote will lose $${Math.abs(totalMarginDollars).toFixed(2)}.`,
    })
  } else if (totalMarginPercent < MARGIN_CRITICAL_PERCENT) {
    alerts.push({
      type: 'margin_below_floor',
      severity: 'critical',
      message: `Overall margin (${totalMarginPercent.toFixed(1)}%) is below critical threshold of ${MARGIN_CRITICAL_PERCENT}%.`,
    })
  } else if (totalMarginPercent < marginFloor) {
    alerts.push({
      type: 'thin_margin',
      severity: 'warning',
      message: `Overall margin (${totalMarginPercent.toFixed(1)}%) is below target floor of ${marginFloor}%.`,
    })
  }

  // Per-line alerts
  for (const line of lineMargins) {
    if (line.status === 'loss') {
      alerts.push({
        type: 'negative_margin',
        severity: 'critical',
        message: `"${line.description}" has negative margin (${line.marginPercent.toFixed(1)}%)`,
        lineDescription: line.description,
      })
    } else if (line.status === 'critical') {
      alerts.push({
        type: 'margin_below_floor',
        severity: 'warning',
        message: `"${line.description}" margin is critically low (${line.marginPercent.toFixed(1)}%)`,
        lineDescription: line.description,
      })
    }
  }

  return {
    lines: lineMargins,
    totalRevenue,
    totalCost,
    totalMarginDollars,
    totalMarginPercent,
    overallStatus,
    alerts,
  }
}

// ── Tiered Proposal Generator ──────────────────────────────────────────────

interface ProductForProposal {
  id: string
  sku: string
  name: string
  description: string | null
  basePrice: number   // sell price
  costPrice: number   // our cost
  category: string
}

interface QuoteRequestInput {
  budget: number
  volume: number
  category: string
  requirements?: string
}

/**
 * Generate 3 tiered proposals (Budget / Standard / Premium) from a quote request.
 *
 * - **Budget**: Minimises cost, uses most cost-effective products, tighter margins
 * - **Standard**: Balanced mix, targets ~35% margin
 * - **Premium**: Best products, includes visual mockup for $5000+ mandates, higher margin
 */
export function generateTieredProposals(
  request: QuoteRequestInput,
  products: ProductForProposal[],
): TieredProposal[] {
  // Sort products by cost for tier selection
  const sorted = [...products].sort((a, b) => a.costPrice - b.costPrice)

  // Filter by category if available
  const categoryProducts = request.category
    ? sorted.filter((p) => p.category.toLowerCase() === request.category.toLowerCase())
    : sorted

  const available = categoryProducts.length > 0 ? categoryProducts : sorted

  // Select products for each tier
  const budgetProducts = available.slice(0, Math.min(3, available.length))
  const standardProducts = available.length >= 2
    ? available.slice(Math.floor(available.length / 4), Math.floor(available.length / 4) + Math.min(3, available.length))
    : available
  const premiumProducts = available.slice(Math.max(0, available.length - 3))

  const tiers: Array<{
    tier: TieredProposal['tier']
    label: string
    description: string
    products: ProductForProposal[]
    markupMultiplier: number
  }> = [
    {
      tier: 'BUDGET',
      label: 'Essentiel',
      description: 'Solution optimisée pour le budget — produits fiables à prix compétitif.',
      products: budgetProducts,
      markupMultiplier: 1.0, // Use base_price as-is (already has margin)
    },
    {
      tier: 'STANDARD',
      label: 'Professionnel',
      description: 'Rapport qualité-prix optimal — mélange équilibré performance et valeur.',
      products: standardProducts,
      markupMultiplier: 1.0,
    },
    {
      tier: 'PREMIUM',
      label: 'Prestige',
      description: 'Gamme supérieure avec montage visuel personnalisé — pour mandats d\'envergure.',
      products: premiumProducts,
      markupMultiplier: 1.0,
    },
  ]

  return tiers.map(({ tier, label, description, products: tierProducts, markupMultiplier }) => {
    // Distribute volume across selected products
    const perProduct = Math.max(1, Math.ceil(request.volume / tierProducts.length))

    const lines: ProposalLine[] = tierProducts.map((p) => {
      const quantity = Math.min(perProduct, request.volume)
      const unitPrice = p.basePrice * markupMultiplier
      const lineTotal = quantity * unitPrice
      const marginPercent = unitPrice > 0 ? ((unitPrice - p.costPrice) / unitPrice) * 100 : 0

      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description ?? p.name,
        quantity,
        unitPrice,
        unitCost: p.costPrice,
        lineTotal,
        marginPercent,
      }
    })

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
    const totalCost = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0)
    const marginDollars = subtotal - totalCost
    const marginPercent = subtotal > 0 ? (marginDollars / subtotal) * 100 : 0
    const gst = subtotal * GST_RATE
    const qst = subtotal * QST_RATE
    const total = subtotal + gst + qst

    return {
      tier,
      label,
      description,
      lines,
      subtotal,
      marginPercent,
      marginDollars,
      totalCost,
      gst,
      qst,
      total,
      includesVisualMockup: tier === 'PREMIUM' && subtotal >= VISUAL_MOCKUP_THRESHOLD,
    }
  })
}

// ── Historical Profitability ───────────────────────────────────────────────

export interface HistoricalCostSource {
  source: string   // 'purchase_order' | 'invoice' | 'payment' | 'labour'
  reference: string
  amount: number
  date: string
}

export interface MandateProfitability {
  orderId: string
  orderRef: string
  revenue: number
  costs: HistoricalCostSource[]
  totalCost: number
  grossMarginDollars: number
  grossMarginPercent: number
  status: 'profitable' | 'break_even' | 'loss'
}

export function calculateMandateProfitability(
  orderRef: string,
  orderId: string,
  revenue: number,
  costs: HistoricalCostSource[],
): MandateProfitability {
  const totalCost = costs.reduce((s, c) => s + c.amount, 0)
  const grossMarginDollars = revenue - totalCost
  const grossMarginPercent = revenue > 0 ? (grossMarginDollars / revenue) * 100 : 0

  let status: MandateProfitability['status'] = 'profitable'
  if (grossMarginPercent < 0) status = 'loss'
  else if (grossMarginPercent < 5) status = 'break_even'

  return {
    orderId,
    orderRef,
    revenue,
    costs,
    totalCost,
    grossMarginDollars,
    grossMarginPercent,
    status,
  }
}
