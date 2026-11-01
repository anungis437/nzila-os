/**
 * Rules for the Shopify redemption flow that do not touch the database, so each can be tested exactly.
 *
 * The discount code is the only thing that ties a Shopify order back to a redemption, so the code that is issued and the code that
 * is parsed are defined together here and nowhere else.
 */

const FULL_HEX = /^[0-9a-f]{32}$/i
const DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LEGACY_PREFIX = /^[0-9a-f]{12}$/i

/** `UE` followed by the redemption id without dashes, upper-cased: lossless, 34 characters, and valid as a Shopify discount code. */
export function discountCodeFor(redemptionId: string): string {
  const hex = redemptionId.replace(/-/g, '')
  if (!FULL_HEX.test(hex)) throw new Error('A redemption id must be a UUID')
  return `UE${hex.toUpperCase()}`
}

export type DiscountReference =
  | { kind: 'id'; id: string }
  /** Codes issued before the format was fixed carried only the first 12 hex characters; they resolve inside one organization or not at all. */
  | { kind: 'legacy-prefix'; prefix: string }

const toUuid = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toLowerCase()

/** The redemption a discount code refers to, or null when no code on the order is one of ours. */
export function parseDiscountReference(discountCodes: ReadonlyArray<{ code?: unknown }>): DiscountReference | null {
  for (const entry of discountCodes) {
    const code = typeof entry?.code === 'string' ? entry.code.trim() : ''
    if (!/^UE/i.test(code)) continue
    const body = code.slice(2)
    if (DASHED.test(body)) return { kind: 'id', id: body.toLowerCase() }
    if (FULL_HEX.test(body)) return { kind: 'id', id: toUuid(body) }
    if (LEGACY_PREFIX.test(body)) return { kind: 'legacy-prefix', prefix: body.toLowerCase() }
  }
  return null
}

const text = (value: unknown, max = 100): string | undefined =>
  typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, max) : undefined

/** What is kept of a paid order: the facts needed to run the redemption, never the purchaser. */
export function minimalOrderFacts(payload: Record<string, unknown>) {
  const items = Array.isArray(payload.line_items) ? (payload.line_items as Array<Record<string, unknown>>) : []
  const lineItems = items.slice(0, 50).map((item) => ({
    product_id: text(item.product_id),
    variant_id: text(item.variant_id),
    quantity: Number(item.quantity) || 0,
    price: text(item.price, 20),
  }))
  const itemsCents = lineItems.reduce((sum, item) => sum + Math.round((Number(item.price) || 0) * 100) * item.quantity, 0)
  const declared = Number(payload.total_line_items_price)
  return {
    order_number: text(payload.order_number),
    currency: text(payload.currency, 8),
    total_price: text(payload.total_price, 20),
    // The value the member's credits bought: the line items before the discount, used to size partial refunds.
    line_items_total_cents: Number.isFinite(declared) && declared > 0 ? Math.round(declared * 100) : itemsCents,
    line_items: lineItems,
    paid_at: text(payload.created_at, 40),
  }
}

/** The part of a delivery worth keeping as its receipt: which event it was and what it referred to, with no purchaser data. */
export function receiptSummary(topic: string, shopDomain: string, payload: Record<string, unknown>) {
  return {
    topic,
    shop_domain: shopDomain,
    order_id: text(payload.order_id ?? (topic.startsWith('orders/') ? payload.id : undefined)),
    refund_id: topic === 'refunds/create' ? text(payload.id) : undefined,
  }
}

/**
 * Credits a refund returns. A refund of part of the order returns that share of the credits spent (rounded down, so a member is
 * never credited more than the order's share); the last refund returns whatever is left, so the credits returned over all of an
 * order's refunds never exceed what was spent and a full refund returns exactly what was spent.
 */
export function creditsToReturn(input: {
  creditsSpent: number
  creditsAlreadyReturned: number
  refundCents: number
  orderCents: number
}): number {
  const remaining = Math.max(0, input.creditsSpent - input.creditsAlreadyReturned)
  if (remaining === 0 || input.refundCents <= 0) return 0
  if (input.orderCents <= 0 || input.refundCents >= input.orderCents) return remaining
  const share = Math.floor((input.creditsSpent * input.refundCents) / input.orderCents)
  return Math.min(remaining, share)
}

/** One address per caller for the unsigned-request limit: the first hop of a forwarded list, trimmed, not the whole header string. */
export function clientAddress(forwardedFor: string | null, realIp: string | null): string {
  const first = (forwardedFor ?? '').split(',')[0]?.trim()
  const candidate = first || realIp?.trim() || ''
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate.toLowerCase() : 'unknown'
}
