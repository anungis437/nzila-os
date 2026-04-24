export interface QuoteInsightInput {
  total: number
  status: string
  createdAt: string | Date
}

export interface InvoiceInsightInput {
  total: number
  status: string
  issuedAt: string | Date
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase()
}

export function calculateAverageQuoteSize(quotes: QuoteInsightInput[]): number {
  if (quotes.length === 0) return 0
  const total = quotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0)
  return total / quotes.length
}

export function calculateEstimatedMrr(invoices: InvoiceInsightInput[], monthsWindow = 3): number {
  if (monthsWindow <= 0) return 0

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - monthsWindow)

  const paidTotal = invoices
    .filter((invoice) => normalizeStatus(invoice.status) === 'paid')
    .filter((invoice) => new Date(invoice.issuedAt).getTime() >= cutoff.getTime())
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0)

  return paidTotal / monthsWindow
}

export function calculateCloseRateTrend(quotes: QuoteInsightInput[]): {
  recentCloseRate: number
  previousCloseRate: number
  deltaPoints: number
} {
  const now = Date.now()
  const dayMs = 86_400_000
  const recentWindowStart = now - 30 * dayMs
  const previousWindowStart = now - 60 * dayMs

  const recent = quotes.filter((quote) => {
    const createdAt = new Date(quote.createdAt).getTime()
    return createdAt >= recentWindowStart
  })

  const previous = quotes.filter((quote) => {
    const createdAt = new Date(quote.createdAt).getTime()
    return createdAt >= previousWindowStart && createdAt < recentWindowStart
  })

  const closeRate = (windowQuotes: QuoteInsightInput[]) => {
    if (windowQuotes.length === 0) return 0
    const won = windowQuotes.filter((quote) => ['accepted', 'closed'].includes(normalizeStatus(quote.status))).length
    return Math.round((won / windowQuotes.length) * 100)
  }

  const recentCloseRate = closeRate(recent)
  const previousCloseRate = closeRate(previous)

  return {
    recentCloseRate,
    previousCloseRate,
    deltaPoints: recentCloseRate - previousCloseRate,
  }
}

export function estimateCustomerLifetimeValue(params: {
  averageOrderValue: number
  ordersPerMonth: number
  averageLifetimeMonths: number
}): number {
  const { averageOrderValue, ordersPerMonth, averageLifetimeMonths } = params
  if (averageOrderValue <= 0 || ordersPerMonth <= 0 || averageLifetimeMonths <= 0) return 0
  return averageOrderValue * ordersPerMonth * averageLifetimeMonths
}
