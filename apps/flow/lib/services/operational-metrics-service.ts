import { operationalMetricsRepository } from '@/lib/repositories/operational-metrics-repository'

// Global aggregates: callers must first admit a verified platform operator.
// Preserve sequential partial-success fallback when a later read is unavailable.
let requestCount = 0
let errorCount = 0
let totalLatencyMs = 0
let orderCount = 0
let quoteCount = 0
let convertedQuotes = 0
let orderValueSum = 0
let paymentBlockedOrders = 0
let vendorDelayCount = 0
let productionCycleSum = 0
let productionCycleCount = 0

export function recordRequest(latencyMs: number, isError = false) {
  requestCount++
  totalLatencyMs += latencyMs
  if (isError) errorCount++
}

export function recordOrder(value: number) {
  orderCount++
  orderValueSum += value
}

export function recordQuote(converted: boolean) {
  quoteCount++
  if (converted) convertedQuotes++
}

export function recordPaymentBlock() {
  paymentBlockedOrders++
}

export function recordVendorDelay() {
  vendorDelayCount++
}

export function recordProductionCycle(daysElapsed: number) {
  productionCycleSum += daysElapsed
  productionCycleCount++
}

export async function collectOperationalMetrics() {
  // DB-backed business metrics with in-process fallback
  let dbOrderCount = orderCount
  let dbQuoteTotal = quoteCount
  let dbQuoteConverted = convertedQuotes
  let dbAvgOrderValue = orderCount > 0 ? orderValueSum / orderCount : 0
  let dbPaymentBlocked = paymentBlockedOrders
  let dbVendorDelays = vendorDelayCount
  let dbActiveOrders = 0
  let dbBlockedByPayment = 0
  let dbPOPending = 0
  let dbProductionInProgress = 0
  let dbProductionBlocked = 0
  let dbShipmentsInTransit = 0
  let dbDeliveredOrders = 0

  try {
    const [oc] = await operationalMetricsRepository.countOrders()
    dbOrderCount = oc?.count ?? 0
    const [qt] = await operationalMetricsRepository.countQuotes()
    dbQuoteTotal = qt?.count ?? 0
    const [qc] = await operationalMetricsRepository.countAcceptedQuotes()
    dbQuoteConverted = qc?.count ?? 0
    const [av] = await operationalMetricsRepository.averageOrderValue()
    dbAvgOrderValue = Number(av?.avg ?? 0)
    const [pb] = await operationalMetricsRepository.countOverduePayments()
    dbPaymentBlocked = pb?.count ?? 0
    const [vd] = await operationalMetricsRepository.countLatePurchaseOrders()
    dbVendorDelays = vd?.count ?? 0
    const [ao] = await operationalMetricsRepository.countActiveOrders()
    dbActiveOrders = ao?.count ?? 0
    const [bpm] = await operationalMetricsRepository.countPaymentBlockedOrders()
    dbBlockedByPayment = bpm?.count ?? 0
    const [pp] = await operationalMetricsRepository.countPendingPurchaseOrders()
    dbPOPending = pp?.count ?? 0
    const [pji] = await operationalMetricsRepository.countProductionJobsInProgress()
    dbProductionInProgress = pji?.count ?? 0
    const [pjb] = await operationalMetricsRepository.countBlockedProductionJobs()
    dbProductionBlocked = pjb?.count ?? 0
    const [sit] = await operationalMetricsRepository.countShipmentsInTransit()
    dbShipmentsInTransit = sit?.count ?? 0
    const [dc] = await operationalMetricsRepository.countDeliveredOrders()
    dbDeliveredOrders = dc?.count ?? 0
  } catch {
    // Fallback to in-process counters if DB unavailable
  }

  return {
    service: 'flow',
    order_count: dbOrderCount,
    quote_count: dbQuoteTotal,
    quote_conversion_rate:
      dbQuoteTotal > 0 ? Math.round((dbQuoteConverted / dbQuoteTotal) * 10000) / 100 : 0,
    avg_order_value: Math.round(dbAvgOrderValue * 100) / 100,
    active_orders_count: dbActiveOrders,
    delivered_orders_count: dbDeliveredOrders,
    blocked_orders_by_payment_count: dbBlockedByPayment,
    payment_blocked_orders: dbPaymentBlocked,
    purchase_orders_pending_count: dbPOPending,
    purchase_orders_overdue_count: dbVendorDelays,
    vendor_delay_count: dbVendorDelays,
    production_jobs_in_progress_count: dbProductionInProgress,
    production_jobs_blocked_count: dbProductionBlocked,
    production_cycle_time:
      productionCycleCount > 0
        ? Math.round((productionCycleSum / productionCycleCount) * 100) / 100
        : 0,
    shipments_in_transit_count: dbShipmentsInTransit,
    request_count: requestCount,
    error_rate: requestCount > 0 ? Math.round((errorCount / requestCount) * 10000) / 100 : 0,
    latency_ms: requestCount > 0 ? Math.round(totalLatencyMs / requestCount) : 0,
    generated_at: new Date().toISOString(),
  }
}

let activeOrders = 0
let blockedOrders = 0
let productionBacklog = 0
let vendorDelayFlags = 0

export function setActiveOrders(n: number) {
  activeOrders = n
}
export function setBlockedOrders(n: number) {
  blockedOrders = n
}
export function setProductionBacklog(n: number) {
  productionBacklog = n
}
export function setVendorDelayFlags(n: number) {
  vendorDelayFlags = n
}

export async function collectOperationalSummary() {
  // DB-backed operational metrics with in-process fallback
  let dbActiveOrders = activeOrders
  let dbBlockedOrders = blockedOrders
  let dbProductionBacklog = productionBacklog
  let dbVendorDelayFlags = vendorDelayFlags

  try {
    const [ao] = await operationalMetricsRepository.countUndeliveredOrders()
    dbActiveOrders = ao?.count ?? 0
    const [pb] = await operationalMetricsRepository.countOverduePayments()
    dbBlockedOrders = pb?.count ?? 0
    const [bl] = await operationalMetricsRepository.countProductionBacklog()
    dbProductionBacklog = bl?.count ?? 0
    const [vd] = await operationalMetricsRepository.countLatePurchaseOrders()
    dbVendorDelayFlags = vd?.count ?? 0
  } catch {
    // Fallback to in-process counters if DB unavailable
  }

  return {
    service: 'flow',
    active_orders: dbActiveOrders,
    blocked_orders: dbBlockedOrders,
    production_backlog: dbProductionBacklog,
    vendor_delay_flags: dbVendorDelayFlags,
    timestamp: new Date().toISOString(),
  }
}
