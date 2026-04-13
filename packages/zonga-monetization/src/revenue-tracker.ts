/**
 * @nzila/zonga-monetization — Revenue Tracker
 *
 * Records and computes revenue from all Zonga monetization streams.
 * Delegates to @nzila/zonga-economics for double-entry ledger operations.
 */
import {
  type RevenueRecord,
  type PlatformFeeConfig,
  RevenueStreamType,
  PlatformFeeConfigSchema,
  RevenueRecordSchema,
} from './types.js'

const DEFAULT_FEES: PlatformFeeConfig = PlatformFeeConfigSchema.parse({})

/**
 * Calculate platform fee for a revenue event based on stream type.
 */
export function calculatePlatformFee(
  grossAmount: number,
  streamType: RevenueStreamType,
  config: PlatformFeeConfig = DEFAULT_FEES,
): number {
  const rateMap: Record<RevenueStreamType, number> = {
    [RevenueStreamType.STREAMING]: config.streamingRate,
    [RevenueStreamType.EVENT_TICKET]: config.eventTicketRate,
    [RevenueStreamType.FAN_PAYMENT]: config.fanPaymentRate,
    [RevenueStreamType.MERCHANDISE]: config.merchandiseRate,
    [RevenueStreamType.LICENSING]: config.licensingRate,
    [RevenueStreamType.SUBSCRIPTION]: config.subscriptionRate,
  }
  const rate = rateMap[streamType] ?? 0
  return Math.round(grossAmount * rate * 100) / 100
}

/**
 * Build a validated revenue record with computed fee + net.
 */
export function buildRevenueRecord(
  input: Omit<RevenueRecord, 'platformFee' | 'netAmount'>,
  config?: PlatformFeeConfig,
): RevenueRecord {
  const fee = calculatePlatformFee(input.grossAmount, input.revenueStreamType, config)
  const record: RevenueRecord = {
    ...input,
    platformFee: fee,
    netAmount: Math.round((input.grossAmount - fee) * 100) / 100,
  }
  return RevenueRecordSchema.parse(record)
}

/**
 * Aggregate revenue totals by stream type for a set of records.
 */
export function aggregateByStreamType(
  records: RevenueRecord[],
): Record<RevenueStreamType, { gross: number; fees: number; net: number }> {
  const result = {} as Record<RevenueStreamType, { gross: number; fees: number; net: number }>
  for (const type of Object.values(RevenueStreamType)) {
    result[type] = { gross: 0, fees: 0, net: 0 }
  }
  for (const r of records) {
    result[r.revenueStreamType].gross += r.grossAmount
    result[r.revenueStreamType].fees += r.platformFee
    result[r.revenueStreamType].net += r.netAmount
  }
  return result
}
