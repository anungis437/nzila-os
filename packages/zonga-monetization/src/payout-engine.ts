/**
 * @nzila/zonga-monetization — Payout Engine
 *
 * Generates payout batches for creators from accumulated revenue records.
 */
import {
  type RevenueRecord,
  type PayoutRecord,
  PayoutStatus,
  PayoutRecordSchema,
} from './types.js'

/**
 * Group revenue records by creator and produce payout instructions.
 */
export function generateCreatorPayouts(
  records: RevenueRecord[],
  options: { minPayoutAmount?: number } = {},
): PayoutRecord[] {
  const minAmount = options.minPayoutAmount ?? 10
  const byCreator = new Map<string, RevenueRecord[]>()

  for (const r of records) {
    const existing = byCreator.get(r.creatorId) ?? []
    existing.push(r)
    byCreator.set(r.creatorId, existing)
  }

  const payouts: PayoutRecord[] = []
  for (const [creatorId, creatorRecords] of byCreator) {
    const totalNet = creatorRecords.reduce((s, r) => s + r.netAmount, 0)
    if (totalNet < minAmount) continue

    const payout = PayoutRecordSchema.parse({
      id: crypto.randomUUID(),
      orgId: creatorRecords[0].orgId,
      creatorId,
      amount: Math.round(totalNet * 100) / 100,
      currency: creatorRecords[0].currency,
      status: PayoutStatus.PENDING,
      revenueRecordIds: creatorRecords.map(r => r.id),
      initiatedAt: new Date().toISOString(),
    })
    payouts.push(payout)
  }

  return payouts
}

/**
 * Compute total payout liability for an org.
 */
export function computePayoutLiability(
  records: RevenueRecord[],
): { totalNet: number; creatorCount: number } {
  const creators = new Set<string>()
  let total = 0
  for (const r of records) {
    total += r.netAmount
    creators.add(r.creatorId)
  }
  return { totalNet: Math.round(total * 100) / 100, creatorCount: creators.size }
}
