/**
 * @nzila/zonga-monetization — Analytics Hooks
 *
 * Revenue analytics: per-creator, per-event, platform take rate.
 */
import type {
  RevenueRecord,
  CreatorRevenueSnapshot,
  EventRevenueSnapshot,
  PlatformTakeRate,
  RevenueStreamType,
} from './types.js'

/**
 * Compute revenue snapshot per creator for a given period.
 */
export function revenuePerCreator(
  records: RevenueRecord[],
  periodStart: string,
  periodEnd: string,
): CreatorRevenueSnapshot[] {
  const byCreator = new Map<string, RevenueRecord[]>()
  for (const r of records) {
    if (r.recordedAt < periodStart || r.recordedAt > periodEnd) continue
    const existing = byCreator.get(r.creatorId) ?? []
    existing.push(r)
    byCreator.set(r.creatorId, existing)
  }

  const snapshots: CreatorRevenueSnapshot[] = []
  for (const [creatorId, creatorRecords] of byCreator) {
    const byStream = {} as Record<RevenueStreamType, number>
    let totalGross = 0, totalNet = 0, totalFees = 0
    for (const r of creatorRecords) {
      byStream[r.revenueStreamType] = (byStream[r.revenueStreamType] ?? 0) + r.grossAmount
      totalGross += r.grossAmount
      totalNet += r.netAmount
      totalFees += r.platformFee
    }
    snapshots.push({ creatorId, totalGross, totalNet, totalFees, byStream, periodStart, periodEnd })
  }
  return snapshots
}

/**
 * Compute revenue snapshot per event.
 */
export function revenuePerEvent(records: RevenueRecord[]): EventRevenueSnapshot[] {
  const byEvent = new Map<string, RevenueRecord[]>()
  for (const r of records) {
    if (!r.eventId) continue
    const existing = byEvent.get(r.eventId) ?? []
    existing.push(r)
    byEvent.set(r.eventId, existing)
  }

  const snapshots: EventRevenueSnapshot[] = []
  for (const [eventId, eventRecords] of byEvent) {
    let ticketRevenue = 0, fanPayments = 0, merchandiseRevenue = 0
    let totalGross = 0, platformTake = 0
    for (const r of eventRecords) {
      totalGross += r.grossAmount
      platformTake += r.platformFee
      if (r.revenueStreamType === 'event_ticket') ticketRevenue += r.grossAmount
      else if (r.revenueStreamType === 'fan_payment') fanPayments += r.grossAmount
      else if (r.revenueStreamType === 'merchandise') merchandiseRevenue += r.grossAmount
    }
    snapshots.push({ eventId, ticketRevenue, fanPayments, merchandiseRevenue, totalGross, platformTake })
  }
  return snapshots
}

/**
 * Compute platform take rate for a period.
 */
export function platformTakeRate(
  records: RevenueRecord[],
  period: string,
): PlatformTakeRate {
  let totalGross = 0, totalFees = 0
  for (const r of records) {
    totalGross += r.grossAmount
    totalFees += r.platformFee
  }
  return {
    period,
    totalGross: Math.round(totalGross * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    takeRate: totalGross > 0 ? Math.round((totalFees / totalGross) * 10000) / 100 : 0,
  }
}
