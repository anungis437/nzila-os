/**
 * @nzila/platform-revenue — Revenue Evidence Bridge
 *
 * Links revenue events to the governance audit timeline and evidence-pack system.
 * Every revenue event, payout, and fee collection generates a traceable audit entry.
 */
import type { RevenueEvent, UnifiedRevenueRecord } from './types'

/** Governance audit entry shape for revenue events */
export interface RevenueAuditEntry {
  traceId: string
  timestamp: string
  eventType: 'revenue_event_recorded' | 'revenue_payout_issued' | 'revenue_fee_collected'
  actor: string
  orgId: string
  app: string
  policyResult: 'pass' | 'fail'
  details: {
    revenueEventId: string
    amount: number
    currency: string
    revenueType?: string
    platformFee?: number
    netAmount?: number
  }
}

/** Generate a deterministic trace ID from event data */
function generateTraceId(eventId: string, timestamp: string): string {
  return `rev-${eventId}-${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}`
}

/**
 * Build a governance audit entry from a revenue event.
 * This is the bridge between platform-revenue and platform-governance.
 */
export function buildRevenueAuditEntry(
  event: RevenueEvent,
  actor: string = 'system',
): RevenueAuditEntry {
  return {
    traceId: generateTraceId(event.id, event.occurredAt),
    timestamp: event.occurredAt,
    eventType: 'revenue_event_recorded',
    actor,
    orgId: event.orgId,
    app: event.appId ?? 'platform',
    policyResult: 'pass',
    details: {
      revenueEventId: event.id,
      amount: event.amount,
      currency: event.currency,
    },
  }
}

/**
 * Build a payout audit entry from a unified revenue record.
 */
export function buildPayoutAuditEntry(
  record: UnifiedRevenueRecord,
  actor: string = 'system',
): RevenueAuditEntry {
  return {
    traceId: generateTraceId(record.id, record.timestamp),
    timestamp: record.timestamp,
    eventType: 'revenue_payout_issued',
    actor,
    orgId: record.orgId,
    app: record.appSource,
    policyResult: record.status === 'failed' ? 'fail' : 'pass',
    details: {
      revenueEventId: record.id,
      amount: record.grossAmount,
      currency: record.currency,
      revenueType: record.revenueType,
      platformFee: record.platformFee,
      netAmount: record.netAmount,
    },
  }
}

/**
 * Build a fee collection audit entry.
 */
export function buildFeeAuditEntry(
  record: UnifiedRevenueRecord,
  actor: string = 'system',
): RevenueAuditEntry {
  return {
    traceId: generateTraceId(record.id, record.timestamp),
    timestamp: record.timestamp,
    eventType: 'revenue_fee_collected',
    actor,
    orgId: record.orgId,
    app: record.appSource,
    policyResult: 'pass',
    details: {
      revenueEventId: record.id,
      amount: record.platformFee,
      currency: record.currency,
      revenueType: record.revenueType,
      netAmount: record.netAmount,
    },
  }
}
